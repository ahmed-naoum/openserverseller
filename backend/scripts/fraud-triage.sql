-- ---------------------------------------------------------------------------
-- Fake-lead triage.
--
--   psql "$DATABASE_URL" -f backend/scripts/fraud-triage.sql
--
-- Read-only apart from section 0, which creates one index. Run it BEFORE
-- deciding what to ban: every threshold in this system is a guess until these
-- numbers exist, and section 1 can invalidate the other four outright.
--
-- One caveat that matters for section 2. The running check (lib/leadFraud.ts,
-- `samePerson`) forgives a single typo per word and ignores word order; this
-- file cannot call that function, so it compares sorted, de-punctuated word
-- sets exactly. It is therefore STRICTER than the code: "Ahmed" vs "Ahmad" is
-- one person to the checkout and two identities here. Treat every conflict
-- count below as an upper bound, and read the sample names before acting.
-- Accented spellings are folded crudely for the same reason.
-- ---------------------------------------------------------------------------

\timing on
\pset pager off

-- ---------------------------------------------------------------------------
-- 0. The index the phone check needs.
--
-- Without it every checkout runs a sequential scan of `leads` on the hottest
-- path in the system. CONCURRENTLY so it does not lock the table, which also
-- means it cannot run inside a transaction block — if psql is in one, this is
-- the statement that will complain.
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_phone_key_idx
  ON leads (RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 9));

-- The companion for the reused-identity signal, which groups on the name as
-- typed. Same reason: without it, scoring a page of leads scans the table.
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_name_lower_idx
  ON leads (lower(btrim("fullName")));

\echo ''
\echo '=== 1. Is ipAddress real, or is it our own proxy? ==============='
\echo 'One address holding a large share of all leads AND spanning many'
\echo 'vendors means nginx is not forwarding CF-Connecting-IP. If that is'
\echo 'what you see, sections 3 and 4 are noise and no IP may be banned.'
\echo ''

SELECT
  "ipAddress",
  count(*)                                             AS leads,
  count(DISTINCT "vendorId")                           AS vendors,
  round(100.0 * count(*) / sum(count(*)) OVER (), 2)   AS pct_of_all
FROM leads
WHERE "ipAddress" IS NOT NULL
  AND "createdAt" >= now() - interval '90 days'
GROUP BY 1
ORDER BY leads DESC
LIMIT 10;

SELECT
  count(*)                                          AS leads_90d,
  count(*) FILTER (WHERE "ipAddress" IS NULL)       AS without_ip,
  count(DISTINCT "ipAddress")                       AS distinct_ips
FROM leads
WHERE "createdAt" >= now() - interval '90 days';

\echo ''
\echo '=== 2. One number, two people — the signal that gets blocked ===='
\echo 'This has no innocent reading. Read the names column: anything that'
\echo 'is the same person spelled twice is this file being stricter than'
\echo 'the code, not a real conflict.'
\echo ''

WITH n AS (
  SELECT
    id, "fullName", "vendorId", status, "createdAt",
    RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 9) AS pkey,
    (
      SELECT string_agg(w, ' ' ORDER BY w)
      FROM unnest(string_to_array(
        regexp_replace(
          translate(lower("fullName"), 'àáâãäåèéêëìíîïòóôõöùúûüýÿñç', 'aaaaaaeeeeiiiiooooouuuuyync'),
          '[^a-z ]', ' ', 'g'), ' ')) AS w
      WHERE length(w) > 1
    ) AS nkey
  FROM leads
  WHERE "createdAt" >= now() - interval '90 days'
    AND length(regexp_replace(phone, '[^0-9]', '', 'g')) >= 9
)
SELECT
  pkey                              AS phone_key,
  count(*)                          AS leads,
  count(DISTINCT nkey)              AS identities,
  count(DISTINCT "vendorId")        AS vendors,
  string_agg(DISTINCT "fullName", ' | ') AS names
FROM n
WHERE nkey IS NOT NULL
GROUP BY pkey
HAVING count(DISTINCT nkey) > 1
ORDER BY leads DESC, identities DESC
LIMIT 25;

\echo ''
\echo '--- how many leads that is, in total ---'

WITH n AS (
  SELECT
    id, "createdAt",
    RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 9) AS pkey,
    (
      SELECT string_agg(w, ' ' ORDER BY w)
      FROM unnest(string_to_array(
        regexp_replace(
          translate(lower("fullName"), 'àáâãäåèéêëìíîïòóôõöùúûüýÿñç', 'aaaaaaeeeeiiiiooooouuuuyync'),
          '[^a-z ]', ' ', 'g'), ' ')) AS w
      WHERE length(w) > 1
    ) AS nkey
  FROM leads
  WHERE "createdAt" >= now() - interval '90 days'
    AND length(regexp_replace(phone, '[^0-9]', '', 'g')) >= 9
)
SELECT
  count(*) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM n b
      WHERE b.pkey = a.pkey AND b.nkey IS DISTINCT FROM a.nkey
    )
  )                                                    AS leads_on_conflicted_numbers,
  count(*)                                             AS leads_considered,
  count(*) FILTER (
    WHERE a."createdAt" >= now() - interval '30 days'
      AND EXISTS (
        SELECT 1 FROM n b
        WHERE b.pkey = a.pkey
          AND b."createdAt" < a."createdAt"
          AND b.nkey IS DISTINCT FROM a.nkey
      )
  )                                                    AS would_have_been_refused_30d
FROM n a
WHERE a.nkey IS NOT NULL;

\echo ''
\echo '=== 3. IP clusters, scored by what actually happened ============'
\echo 'The column that matters is `bad`. A cluster that mostly DELIVERED'
\echo 'is a family or an office on one connection — banning it costs you'
\echo 'real money. A cluster that mostly never answered is the fraud.'
\echo ''

SELECT
  "ipAddress",
  count(*)                                                        AS leads,
  count(DISTINCT "vendorId")                                      AS vendors,
  count(*) FILTER (WHERE status IN ('CONFIRMED', 'PUSHED_TO_DELIVERY'))   AS good,
  count(*) FILTER (WHERE status IN ('NO_REPLY', 'DEAD_NO_REPLY',
                                    'UNREACHABLE', 'INVALID', 'CANCELLED')) AS bad,
  min("createdAt")::date                                          AS first_seen,
  max("createdAt")::date                                          AS last_seen
FROM leads
WHERE "ipAddress" IS NOT NULL
  AND "createdAt" >= now() - interval '90 days'
GROUP BY 1
HAVING count(*) >= 3
ORDER BY bad DESC, leads DESC
LIMIT 25;

\echo ''
\echo '=== 4. Bursts on one referral link =============================='
\echo 'The affiliate-fraud shape: many leads on one link inside an hour,'
\echo 'off very few distinct addresses and user agents. `ips` and `uas`'
\echo 'close to 1 while `leads` is high is the pattern worth acting on.'
\echo ''

SELECT
  l."referralLinkId",
  rl.code                                   AS link_code,
  date_trunc('hour', l."createdAt")         AS hour,
  count(*)                                  AS leads,
  count(DISTINCT l."ipAddress")             AS ips,
  count(DISTINCT l."userAgent")             AS uas
FROM leads l
LEFT JOIN referral_links rl ON rl.id = l."referralLinkId"
WHERE l."referralLinkId" IS NOT NULL
  AND l."createdAt" >= now() - interval '90 days'
GROUP BY 1, 2, 3
HAVING count(*) >= 5
ORDER BY leads DESC
LIMIT 25;

\echo ''
\echo '=== 5. One name, many numbers (the NAME_REUSED badge) ==========='
\echo 'A common name repeating is normal here and is NOT what this is.'
\echo 'This is one spelling copied onto several different lines, which'
\echo 'is an identity being reused. Badged at 3+ numbers.'
\echo ''

SELECT
  lower(btrim("fullName"))                                                    AS name,
  count(DISTINCT RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 9))::int     AS numbers,
  count(*)                                                                    AS leads,
  count(DISTINCT "vendorId")                                                  AS vendors
FROM leads
WHERE "createdAt" >= now() - interval '90 days'
  AND length(regexp_replace(phone, '[^0-9]', '', 'g')) >= 9
  AND btrim("fullName") <> ''
GROUP BY 1
HAVING count(DISTINCT RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 9)) >= 3
ORDER BY numbers DESC, leads DESC
LIMIT 25;

\echo ''
\echo '=== 6. One device: same address AND same browser (UA_CLUSTER) ==='
\echo 'Stronger than section 3, because it is one machine rather than'
\echo 'one network. A whole office shares an address; it does not share'
\echo 'a single browser fingerprint.'
\echo ''

SELECT
  "ipAddress",
  left("userAgent", 48)                                                   AS browser,
  count(*)                                                                AS leads,
  count(DISTINCT RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 9))::int AS numbers,
  count(*) FILTER (WHERE status IN ('CONFIRMED', 'PUSHED_TO_DELIVERY'))   AS good,
  count(*) FILTER (WHERE status IN ('NO_REPLY', 'DEAD_NO_REPLY',
                                    'UNREACHABLE', 'INVALID', 'CANCELLED')) AS bad
FROM leads
WHERE "ipAddress" IS NOT NULL
  AND "userAgent" IS NOT NULL
  AND "createdAt" >= now() - interval '90 days'
GROUP BY 1, 2
HAVING count(*) >= 3
ORDER BY leads DESC
LIMIT 25;

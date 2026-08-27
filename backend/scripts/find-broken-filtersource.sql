-- T1 — find landing pages that are silently redirecting 100% of visitors.
--
-- filterSource requires an `_s` token that buildSourceToken() never mints
-- (it has no callers). When sourceMaxUses is set above zero, the referrer
-- fallback is gated off, so NO visitor can satisfy the rule — every one of
-- them is sent to sourceRedirectUrl (default https://google.com).
--
-- Read-only. Run against PRODUCTION. Any row returned is losing money now.

SELECT
    rl.code,
    rl."influencerId",
    lp."customStructure" #>> '{settings,cloaking,sourceMaxUses}'      AS source_max_uses,
    lp."customStructure" #>> '{settings,cloaking,sourceRedirectUrl}'  AS visitors_sent_to
FROM   referral_link_landing_pages lp
JOIN   referral_links rl ON rl.id = lp."referralLinkId"
WHERE  lp."customStructure" #>> '{settings,cloaking,enabled}'       = 'true'
  AND  lp."customStructure" #>> '{settings,cloaking,filterSource}'  = 'true'
  -- a non-null, non-"0" max-uses is the condition that closes the only door in:
  AND  COALESCE(lp."customStructure" #>> '{settings,cloaking,sourceMaxUses}', '0') <> '0'
ORDER BY rl."influencerId", rl.code;

-- To fix a page returned above, either:
--   * turn filterSource OFF for it, or
--   * set sourceMaxUses to 0 (unlimited) — but note the referrer fallback still
--     only works for a same-origin source page, so filterSource remains fragile.
-- The durable fix is T15/T8: wire buildSourceToken() into the Button block, or
-- remove the filterSource control from the builder until it is wired.

# Deployment panel — setup and operation

One-click deploys from `/admin/deployments`, driven by a GitHub webhook that
**notifies but never deploys on its own**.

---

## What it does

1. You push to GitHub.
2. GitHub POSTs to `/api/v1/deploy/webhook`, signed with a shared secret.
3. The server verifies the signature, records the commits, and pushes a live
   notification to any SUPER_ADMIN with the panel open.
4. You click **Déployer maintenant**. The deploy runs and streams its log into
   the page.
5. The result is recorded — who, which commit, how long, success or failure.

**Auto-deploy is deliberately not implemented.** A bad commit deploying itself
takes the public site down while nobody is watching, and the deploy touches the
database. One click is the guardrail.

---

## Setup (once)

### 1. Generate a webhook secret

```bash
openssl rand -hex 32
```

### 2. Store it in the admin panel

Go to **/admin/secrets** → search `GITHUB_WEBHOOK_SECRET` → paste the value.

It lives in the encrypted secret store, not in `.env`, so it can be rotated from
the browser without touching the server.

> Until this is set, the webhook **rejects every request** and logs
> `webhook rejected: GITHUB_WEBHOOK_SECRET is not configured`. That is
> intentional — an unset secret must never mean "skip verification", or the
> endpoint becomes an unauthenticated way to run shell commands on the VPS.
> Manual deploys keep working in the meantime.

### 3. Add the webhook on GitHub

Repository → **Settings → Webhooks → Add webhook**

| Field | Value |
|---|---|
| Payload URL | `https://silacod.com/api/v1/deploy/webhook` |
| Content type | `application/json` |
| Secret | the value from step 1 |
| Events | *Just the push event* |
| Active | ✔ |

GitHub sends a `ping` immediately; a green tick means the signature check
passed. A red ✗ with 401 means the secret does not match.

### 4. Install Chromium on the VPS (for prerendering)

```bash
sudo apt-get update && sudo apt-get install -y chromium-browser
```

`deploy.sh` finds it automatically. Without it the build still succeeds but
ships pages **without prerendering** — crawlers go back to seeing a 2.5 KB
empty shell, silently. Worth checking after the first deploy.

### 5. Confirm nginx serves prerendered routes

Prerendered pages are written as `dist/pricing/index.html`, so the `try_files`
directive must try the directory index **before** falling back to the SPA:

```nginx
try_files $uri $uri/ $uri/index.html /index.html;
```

Without `$uri/index.html`, every prerendered route silently regresses to the
shell and all the SEO work is invisible.

---

## What changed in deploy.sh

The script the panel runs is the same one you run by hand, so there is one
deployment path rather than two that drift apart. Four fixes went in with this
work:

**Path is derived, not hardcoded.** `deploy.sh`, `setup.sh` and
`ecosystem.config.cjs` disagreed about whether the checkout is at
`/var/www/openseller` or `/var/www/silacod`. The script now resolves its own
location, which removes the class of bug.

**The frontend build is atomic.** `vite build` empties its output directory
before writing, so building into the live `dist/` served 404s and half-built
pages for the 60–90 seconds of the build. It now builds into `.dist-next` and
swaps with a `mv`, which is instant. If the build fails, the live site is never
touched.

**`--accept-data-loss` is gone by default.** It was running on every deploy.
That flag lets Prisma silently drop columns and tables — survivable when a human
is watching, not acceptable behind a button. A destructive change now stops the
deploy with an explanation. Set `ALLOW_DATA_LOSS=1` when you genuinely intend
one, after taking a backup.

**A result marker is printed.** The deploy's last step is
`pm2 restart silacod-api`, which kills the API that started it. The script emits
`DEPLOY_RESULT=SUCCESS|FAILED`, and the API reads it on next boot to settle the
deployment record.

---

## How it survives restarting the server

This is the part that would break a naive implementation. The deploy ends by
restarting the API. If the deploy were a child of that API process, it would be
killed halfway — the log stream would die and the outcome would never be
recorded, so every *successful* deploy would look like a crash.

So the runner is spawned **detached**, in its own process group, writing to
`backend/logs/deploys/<id>.log`. It outlives the API. On boot,
`reconcileInterruptedDeploys()` reads the tail of that log, finds the
`DEPLOY_RESULT` marker, and settles the record.

If the marker is missing, the deployment is recorded as `UNKNOWN` rather than
guessed either way.

---

## Safety properties

| Control | Where |
|---|---|
| Webhook HMAC-SHA256, constant-time compare | `deploy.routes.ts` `verifySignature()` |
| **Fails closed** when the secret is unset | same function, returns `false` |
| Raw bytes captured for signing | `verify` hook on `express.json()` in `index.ts` |
| SUPER_ADMIN only for every non-webhook route | `deploy.routes.ts` `authorize('SUPER_ADMIN')` |
| Socket log stream role-gated at subscribe | `index.ts` `deploy:subscribe` |
| Command is fixed server-side, never from the request | `deploy.service.ts` |
| One deploy at a time | `activeDeploymentId` lock |
| 15-minute timeout kills the process group | `DEPLOY_TIMEOUT_MS` |
| Full audit trail incl. failures | `deployments` table |

The socket check matters more than it looks: `io.use()` in this codebase admits
tokenless and invalid-token sockets by design (anonymous visitors are tracked for
presence). A connected socket is **not** an authenticated one, so every sensitive
handler must check for itself.

---

## Operating notes

**The log stream pauses near the end.** The API restarts as its final step, so
the socket drops for a few seconds. The panel says so, and the outcome lands in
the history table regardless.

**"Modifications locales non commitées"** means the server checkout has local
changes. `git pull` may conflict. Investigate on the box before deploying.

**A failed deploy leaves the site running the previous build.** The swap only
happens after a successful build that produced an `index.html`.

**Verify after the first deploy:**

```bash
curl -s -A "ClaudeBot/1.0" https://silacod.com/pricing | wc -c
```

Around 49000 means prerendering is live. 3487 means it regressed to the shell —
check Chromium is installed and the nginx `try_files` line above.

---

## Still worth doing

- **Rate-limit the deploy endpoints.** They inherit the global 100 req/min, but
  `shouldSkipRateLimit` bypasses limits for SUPER_ADMIN tokens.
- **Re-authentication before deploying.** A password or OTP prompt on the deploy
  button would mean a stolen session alone is not enough to ship code.
- **A rollback button.** `git checkout <previous-sha> && redeploy` is the
  mechanism; the history table already records the SHAs needed.

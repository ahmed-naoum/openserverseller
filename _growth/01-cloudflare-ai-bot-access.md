# Task Y3 — Let AI crawlers read silacod.com

**Owner:** you (needs Cloudflare dashboard login)
**Time:** ~15 minutes + 5 minutes verification

---

## ✅ TESTED LIVE — 3 August 2026

I ran the verification against the live site. Results:

### Good news: the 403 network block is gone

All ten crawler user-agents now receive **HTTP 200**:

| Crawler | HTTP | Bytes |
|---|---|---|
| GPTBot, OAI-SearchBot, ChatGPT-User | 200 | 3,487 |
| ClaudeBot | 200 | 3,487 |
| PerplexityBot | 200 | 3,487 |
| Bingbot, Googlebot, Google-Extended | 200 | 3,487 |
| Applebot, CCBot | 200 | 3,487 |

### Bad news #1: robots.txt is Cloudflare's, and it bans the AI crawlers

`https://silacod.com/robots.txt` is **not the file I wrote** — Cloudflare is serving its own managed version. Its operative directives:

```
User-agent: *
Content-Signal: search=yes,ai-train=no,use=reference
Allow: /

User-agent: GPTBot
Disallow: /
User-agent: ClaudeBot
Disallow: /
User-agent: Google-Extended
Disallow: /
User-agent: CCBot
Disallow: /
User-agent: Applebot-Extended
Disallow: /
User-agent: Amazonbot
Disallow: /
User-agent: Bytespider
Disallow: /
User-agent: meta-externalagent
Disallow: /
```

**What this means in practice.** The server answers 200, but robots.txt tells these crawlers "do not crawl," and the major AI companies obey robots.txt. So the current state splits into two groups:

| Can read silacod.com today | Cannot (banned by robots.txt) |
|---|---|
| ✅ **OAI-SearchBot** — ChatGPT Search | ❌ **ClaudeBot** — Claude |
| ✅ **ChatGPT-User** — ChatGPT browsing | ❌ **GPTBot** — OpenAI training |
| ✅ **PerplexityBot** — Perplexity | ❌ **Google-Extended** — Gemini / AI Overviews grounding |
| ✅ Googlebot, Bingbot — classic search | ❌ CCBot, Applebot-Extended, Amazonbot, Meta |

So **ChatGPT and Perplexity can reach you; Claude and Gemini are locked out.** That is Cloudflare's default "allow AI search, block AI training" posture. It is a reasonable default for a news publisher protecting its archive. For SILACOD — whose entire strategy is *to be recommended by AI assistants* — it blocks two of the four engines we are targeting.

`Content-Signal: ai-train=no` additionally declares that your content may not be used for AI training. For a brand that wants to become the known answer for "dropshipping Maroc," that is the opposite of the goal.

### Bad news #2: there is no sitemap, and no content to read

- `https://silacod.com/sitemap.xml` returns **HTTP 200 but serves the SPA's HTML**, not a sitemap — nginx falls back to `index.html` for unknown paths. There is currently no sitemap at all. (Fixed by my `generate-sitemap.mjs` on the next deploy.)
- Every crawler receives **3,487 bytes ending in `<div id="root"></div>`** — an empty shell with no content. The deployed build is still the old one (`index-BW8gofl4.js`), so my SEO work is not live yet either.

**Bottom line:** access is fixed, permission is half-fixed, and there is still nothing to read. Two actions below close the gap.

---

## ACTION 1 — Stop Cloudflare managing robots.txt (5 minutes, you)

1. **dash.cloudflare.com → silacod.com → Security → Bots** (some plans: **Settings → Manage robots.txt**).
2. Find the **AI crawler blocking** / **managed robots.txt** / **Content Signals** feature and turn it **OFF**. It is what injects the `Disallow` block above.
3. Also check **Security → Bots → "AI Scrapers and Crawlers"** and set it to **Off / Allow** if still on.
4. Deploy the site (Action 2). My `frontend/public/robots.txt` then takes over and explicitly **allows** all 16 crawlers.

> **This is a business decision, not just a technical one.** Turning it off means AI companies may use your public marketing pages for training as well as for answering. That is precisely what the Top 1 plan wants — you are trying to become the known answer. It only applies to public marketing pages; dashboards stay blocked in my robots.txt regardless.

## ACTION 2 — Deploy (me + you)

The SEO layer I built is committed but not deployed. Once `bash deploy.sh` runs, the next fetch should return your `robots.txt` (starting with `# robots.txt — silacod.com`) and a real `sitemap.xml`.

Content will still be an empty shell until the prerendering task (C4) ships — that is the separate fix that makes crawlers see actual text.

---

## Re-run the verification after both actions

```bash
curl -s https://silacod.com/robots.txt | head -3
```
Must start with `# robots.txt — silacod.com`. If it still shows the Content-Signal preamble, Cloudflare is still managing the file.

```bash
curl -s https://silacod.com/sitemap.xml | head -3
```
Must start with `<?xml version="1.0"` — not `<!DOCTYPE html>`.

```bash
curl -s -A "ClaudeBot/1.0" https://silacod.com/ | wc -c
```
Over ~15,000 characters means prerendering is working too.

---

## Original guide (still valid for the settings walk-through)

---

## Background: why the site is blocked

Since mid-2025 Cloudflare **blocks AI crawlers by default on new domains**. When you (or anyone) signed up, silacod.com was almost certainly opted into "Block AI Scrapers and Crawlers" automatically. On top of that, Bot Fight Mode and the managed WAF challenge non-browser traffic.

The result: a human in Chrome sees the site fine, so nothing looks broken — but every machine that would recommend you sees a 403 error page.

---

## Step 1 — Turn off AI crawler blocking

1. Log in to **dash.cloudflare.com** and select the **silacod.com** zone.
2. Go to **Security → Bots** (on some plans: **Security → Settings**).
3. Find **"AI Scrapers and Crawlers"** (may be labelled *Block AI bots* or *AI Labyrinth*).
4. Set it to **Off / Allow**.
5. While you are on this screen, also check **Bot Fight Mode**:
   - If **Bot Fight Mode** is ON, turn it **OFF**. It issues JavaScript challenges that no crawler can solve, and it does not distinguish good bots from bad ones.
   - If you are on a paid plan with **Super Bot Fight Mode**, instead set **"Definitely automated" → Allow** for verified bots, and leave "Likely automated" on Managed Challenge.
6. Check **Security → WAF → Managed rules** and **Custom rules** for anything blocking by user-agent or country. If a rule blocks empty/unknown user-agents, it will catch crawlers.

> Also confirm the domain is not in **"Under Attack" mode** (Security → Settings → Security Level). Under Attack challenges everything, including Googlebot.

## Step 2 — Add an explicit allow rule (belt and braces)

Even with the toggle off, add a WAF custom rule so a future default change cannot silently re-block you.

1. **Security → WAF → Custom rules → Create rule**
2. Name: `Allow search and AI crawlers`
3. Choose **Edit expression** and paste:

```
(http.user_agent contains "GPTBot") or
(http.user_agent contains "OAI-SearchBot") or
(http.user_agent contains "ChatGPT-User") or
(http.user_agent contains "ClaudeBot") or
(http.user_agent contains "Claude-Web") or
(http.user_agent contains "anthropic-ai") or
(http.user_agent contains "PerplexityBot") or
(http.user_agent contains "Perplexity-User") or
(http.user_agent contains "Google-Extended") or
(http.user_agent contains "Googlebot") or
(http.user_agent contains "Bingbot") or
(http.user_agent contains "Applebot") or
(http.user_agent contains "CCBot") or
(http.user_agent contains "meta-externalagent") or
(http.user_agent contains "Amazonbot") or
(http.user_agent contains "MistralAI-User")
```

4. Action: **Skip** → tick **All remaining custom rules**, **Rate limiting**, **Managed rules**, **Super Bot Fight Mode**.
5. **Deploy**, and drag this rule to the **top** of the custom rules list so it evaluates first.

> User-agent matching is spoofable in theory. That is an acceptable trade here: the downside of a spoofed crawler reading your public marketing pages is zero, and the downside of blocking real crawlers is the entire plan.

## Step 3 — Do not let Cloudflare serve its own robots.txt

Cloudflare has a **"Managed robots.txt"** / AI-crawler-blocking feature that injects `Disallow` rules for AI bots, overriding the file on your server.

- Go to **Security → Bots** (or **Settings → Manage robots.txt** depending on plan) and make sure Cloudflare is **not** managing or appending to robots.txt.
- I have already committed the correct file at `frontend/public/robots.txt` — it explicitly welcomes all 16 AI/search crawlers and blocks only the dashboards. It ships automatically on the next deploy.

---

## Step 4 — Verify (this is the part that actually matters)

Run these **after deploying**. Use Git Bash (not PowerShell — its `curl` is an alias for `Invoke-WebRequest` and behaves differently).

Each command should print **`200`**. Anything else (403, 503, 429) means still blocked.

```bash
for UA in "GPTBot/1.2" "OAI-SearchBot/1.0" "ClaudeBot/1.0" "PerplexityBot/1.0" "Bingbot/2.0" "Googlebot/2.1"; do printf "%-22s " "$UA"; curl -s -o /dev/null -w "%{http_code}\n" -A "$UA" https://silacod.com/; done
```

Then confirm crawlers receive **real content**, not an empty shell. This counts the characters in the HTML body:

```bash
curl -s -A "GPTBot/1.2" https://silacod.com/ | wc -c
```

- **Under ~3,000 characters** → Cloudflare is unblocked but the page is still an empty React shell. That is expected until my SSR work (task C4) ships; it confirms access is fixed but content is not yet visible.
- **Over ~15,000 characters** → both access *and* content are working. This is the target state.

Check that robots.txt is live and is *yours*:

```bash
curl -s https://silacod.com/robots.txt | head -20
```

It must start with `# robots.txt — silacod.com`. If you instead see generic Cloudflare-generated rules with `Disallow: /` for AI bots, revisit Step 3.

---

## Step 5 — Tell me the results

Paste the output of the loop above back to me. What I need to know:

| Result | What it means | Next step |
|---|---|---|
| All `200` | Access fixed | I proceed with SSR (C4) so there is content to read |
| Any `403` | Still blocked | Send me a screenshot of Security → Bots and I will pinpoint the rule |
| `503` / `1020` | WAF or Under Attack mode | Check Security Level and custom rules |

---

## Related work I have already done

- `frontend/public/robots.txt` — created, explicitly allowing 16 AI/search crawlers, blocking dashboards and auth flows, referencing the sitemap.
- Sitemap generation, meta tags, canonical/hreflang and schema are task **C8**, in progress.
- Server-side rendering so crawlers get real HTML is task **C4** — the reason Step 4's character count matters.

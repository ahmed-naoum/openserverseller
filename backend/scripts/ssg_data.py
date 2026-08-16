"""
Data for the SSG explainer PDF.

Kept separate from the layout so every claim in the document has one obvious
place to be checked and corrected. Anything not directly readable from the repo
is marked MEASURED=False in its caption text — the document must never blur the
line between a measured number and an estimate.
"""

D = {}

# ---------------------------------------------------------------- waterfall
# Bar timings are modelled for a mid-tier Android device on throttled slow 4G.
# They are ESTIMATES of shape, not measurements; the caption says so.
D["waterfall_max_s"] = 10.0
D["waterfall_pixel_marks"] = [9.05, 0.22]
D["waterfall_rows"] = [
    # lane, label, start, duration, colour, note
    (0, "index.html", 0.15, 0.20, "FLAG", "89 KB - the HOMEPAGE"),
    (0, "offer API", 0.38, 0.40, "GOOD", "inline preload - the one good part"),
    (0, "eager JS + CSS", 0.42, 6.13, "FLAG", "1.23 MB gzipped"),
    (0, "homepage images", 0.60, 2.10, "GROW", "437 KB never seen"),
    (0, "parse + execute", 6.55, 1.80, "GROW", "3.89 MB of JS"),
    (0, "ReferralForm.js", 8.35, 0.40, "FLAG", "could not start earlier"),
    (0, "offer renders", 8.75, 0.30, "ACCENT", ""),
    (1, "document (br)", 0.15, 0.05, "GOOD", "4.6 KB - the whole page"),
    (1, "offer renders", 0.20, 0.06, "ACCENT", ""),
    (1, "fbevents.js", 0.25, 0.50, "INK_3", "async, off the critical path"),
    (1, "LCP image", 0.25, 1.05, "ACCENT", ""),
]
D["waterfall_caption"] = (
    "Byte counts are MEASURED from frontend/dist (built 14 Aug). Timings are modelled "
    "on those bytes at Lighthouse 'Slow 4G' — 1.6 Mbps, 150 ms round trip — on a "
    "mid-tier Android device. The two dashed markers are the claim: today the pixel "
    "cannot fire until 3.89 MB of JavaScript has downloaded, parsed and executed; "
    "after the change it fires while the document is still being parsed."
)

# ---------------------------------------------------------------- size bars
D["size_bars"] = [
    ("today, cold visit", 1671.0, "FLAG", "MEASURED, fresh build"),
    ("  of which JS + CSS", 1215.0, "FLAG", "rrweb, recharts, framer-motion"),
    ("  of which HTML", 18.6, "GROW", "the prerendered homepage"),
    ("  of which images", 426.0, "GROW", "homepage photos, never seen"),
    ("compiled page", 4.6, "GOOD", "estimate - document + image on top"),
]
D["size_bars_footnote"] = ("Transferred bytes, gzip on, for one cold visit to /r/CODE. "
                           "All bars are drawn to the same scale.")

# Measured coverage per candidate scope, 16 Aug 2026. The staircase is the
# argument for shipping at 3/7 rather than holding everything back to 7/7.
D["coverage_rows"] = [
    ("original plan — 7 block types", 1, "dev data only — re-run on production"),
    ("express_checkout + button + image", 1, "only link 50, which is checkout-only"),
    ("+ video", 3, "SHIP HERE — proves the infrastructure on real traffic"),
    ("+ video + whatsapp", 5, "one follow-up deploy"),
    ("+ video + audio", 5, "the other follow-up deploy"),
    ("all six in use", 7, "every live page compiled"),
]

# Measured directly from the database, 16 Aug 2026.
D["block_usage"] = [
    ("express_checkout", 5, 5, "v1", "The form itself. Cannot be static — needs a runtime."),
    ("video", 5, 4, "v1", "Player with unmute and play overlays."),
    ("button", 4, 3, "v1", "Sticky behaviour and entrance animations."),
    ("image", 2, 2, "v1", "The only pure-markup block in real use."),
    ("whatsapp", 2, 2, "then", "Floating widget, open/close, click tracking. Takes 3/7 to 5/7."),
    ("audio", 2, 2, "then", "Play/pause, seek, speed control. Takes 5/7 to 7/7."),
    ("header", 0, 0, "not used", "Never placed on any page."),
    ("hero", 0, 0, "not used", "Never placed on any page."),
    ("text", 0, 0, "not used", "Never placed on any page."),
    ("spacer", 0, 0, "not used", "Never placed on any page."),
    ("slider", 0, 0, "not used", "Never placed — note this is where the CSS bug lives."),
    ("countdown", 0, 0, "not used", "Never placed on any page."),
    ("products", 0, 0, "not used", "Never placed. Its API endpoint does not exist."),
]
D["size_caption"] = (
    "Re-measured on 16 Aug from a fresh build of current master: 5,282,886 bytes of eager "
    "JavaScript and CSS, 1,244,821 gzipped. That is slightly WORSE than the 14 Aug build "
    "(5,196,951 / 1,226,154) — the problem has grown, not shrunk. The original sketch's "
    "'5.2 MB' figure was accurate. rrweb is still statically imported by "
    "LiveStreamInspector.tsx:5 and AbandonedCarts.tsx:4, and recharts by the three "
    "dashboards, so all of it loads on a landing page that uses none of it."
)

# Why the vendor chunks do not help — measured, and worth stating plainly.
D["chunk_rows"] = [
    ["assets/index-*.js", "3,976,085", "910,796", "entry chunk — around 130 pages statically imported"],
    ["assets/index-*.css", "328,902", "45,563", "render-blocking"],
    ["vendor-charts", "433,927", "114,388", "recharts — dashboards, statically imported in App.tsx"],
    ["vendor-rrweb", "262,456", "81,818", "session replay — admin screens, statically imported"],
    ["vendor-react", "165,216", "53,750", "react + router"],
    ["vendor-motion", "114,377", "37,554", "framer-motion"],
    ["vendor-rrweb.css", "1,923", "952", "render-blocking"],
    ["<b>eager total</b>", "<b>5,282,886</b>", "<b>1,244,821</b>", "<b>downloaded on every page, /r/ included</b>"],
    ["ReferralForm-*.js", "~28,000", "~9,200", "the only chunk that is actually the landing page"],
]

# ------------------------------------------------------------------- nginx
D["nginx_current"] = [
    "# /etc/nginx/sites-available/silacod   (generated by setup.sh)",
    "",
    "location / {",
    "    root  /var/www/silacod/frontend/dist;",
    "    index index.html;",
    "    try_files $uri $uri/ /index.html;   # <-- /r/CODE lands here",
    "}",
    "",
    "location /api/ {",
    "    proxy_pass http://127.0.0.1:3001;",
    "}",
]

D["nginx_new"] = [
    "# nginx matches prefix locations LONGEST-FIRST, not in file order, so `/r/`",
    "# beats `/` wherever this block sits. `^~` is still worth having: it stops",
    "# nginx evaluating regex locations once this prefix has matched.",
    "",
    "location ^~ /r/ {",
    "    limit_req zone=landing burst=40 nodelay;",
    "    proxy_pass http://127.0.0.1:3001;",
    "    proxy_http_version 1.1;",
    "",
    "    # $host, not $http_host: Host lowercased with the port stripped, which is",
    "    # what getSubdomainFromRequest() compares against in production.",
    "    proxy_set_header Host              $host;",
    "    proxy_set_header X-Real-IP         $remote_addr;",
    "    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;",
    "    proxy_set_header X-Forwarded-Proto $scheme;",
    "",
    "    gzip off;              # the body is already brotli-compressed upstream",
    "    proxy_read_timeout 15s;",
    "}",
]

# -------------------------------------------------------------- middleware
# Measured against backend/src/index.ts:119-273. "Cost" is what the middleware
# adds to a DOCUMENT request specifically — several are free here only because
# a GET with no body skips their real work.
_MW = [
    ("helmet", "yes", "Sets the default Content-Security-Policy. Free on JSON; on HTML it "
                      "blocks inline scripts and <font face='Courier' size='7.5'>connect.facebook.net</font>. "
                      "<b>The route must strip and replace it.</b>"),
    ("cors", "yes", "Synchronous origin check. A top-level navigation sends no Origin, so this "
                    "is a no-op."),
    ("compression", "yes", "Hooks <font face='Courier' size='7.5'>res.end</font>. Kept upstream of the route so "
                           "clients that refuse brotli still get gzip."),
    ("express.json / urlencoded", "yes", "Skipped entirely for a GET with no body."),
    ("morgan + requestLogger", "yes", "One log line, plus a fire-and-forget TrafficLog insert after the "
                                      "response finishes. Deliberately kept — compiled pages should keep "
                                      "feeding traffic analytics exactly as the SPA did."),
    ("securityHeaders", "yes", "Sets <font face='Courier' size='7.5'>X-Frame-Options: DENY</font>. The route "
                               "relaxes this to SAMEORIGIN for <font face='Courier' size='7.5'>/r/</font> only."),
    ("scanner blocklist", "yes", "Seven substring tests for <font face='Courier' size='7.5'>/.env</font>, "
                                 "<font face='Courier' size='7.5'>/wp-admin</font> and friends. Effectively free."),
    ("ipFilter", "yes", "<b>Async.</b> Awaits a settings lookup cached for 30 s. Kept upstream on purpose "
                        "— a blocked IP should not be served a page."),
    ("sanitizeInput", "<b>no</b>", "<b>Async.</b> Awaits the same cached settings, then XSS-scrubs body, query "
                                   "and params — all empty on this route. Pure latency, so the route mounts "
                                   "<i>above</i> it."),
    ("maintenance", "<b>no</b>", "<b>Async.</b> Returns a JSON 503 for every path during maintenance. "
                                           "Ads keep running during maintenance and a JSON error is not a page, "
                                           "so landing pages stay up."),
    ("globalRateLimiter", "<b>no</b>", "Scoped to <font face='Courier' size='7.5'>/api/v1</font> and stays there. "
                                       "100 req/min would be actively harmful — bursty ad traffic is the point "
                                       "of this route. nginx rate-limits it instead."),
    ("notFoundHandler", "<b>no</b>", "What <font face='Courier' size='7.5'>/r/</font> would hit today if nginx "
                                     "forwarded it: a JSON 404. This is why the nginx change and the Express "
                                     "route must land together."),
]
# The build script turns these into Paragraphs — this module stays free of
# reportlab imports so it can be diffed and corrected without running anything.
D["middleware_raw"] = _MW

# ---------------------------------------------------------------- blockers
D["blockers"] = [
    {
        "ref": "backend/src/utils/subdomain.ts:3",
        "title": "Every visitor arriving from an ad would get a 404",
        "body": (
            "The existing host check, <font face='Courier' size='8'>validateInfluencerSubdomain()</font>, "
            "decides which hostname a request came from using "
            "<font face='Courier' size='8'>getRequestHost()</font> — which prefers the "
            "<font face='Courier' size='8'>Origin</font> header, then "
            "<font face='Courier' size='8'>Referer</font>, and only falls back to "
            "<font face='Courier' size='8'>Host</font> if neither is present.<br/><br/>"
            "That order is correct for the API call the React app makes, where the request "
            "is same-origin. It is wrong for a <b>document</b> request. When somebody taps "
            "your ad, the browser sends no Origin header at all and sets Referer to the ad "
            "network. So the check reads the host as "
            "<font face='Courier' size='8'>facebook.com</font>, finds it does not match the "
            "influencer's subdomain, and rejects the request."),
        "code": [
            "// getRequestHost(), simplified — the order is the problem",
            "if (originHeader)  requestHost = new URL(originHeader).host;",
            "if (!requestHost && refererHeader) requestHost = new URL(refererHeader).host;",
            "if (!requestHost && hostHeader)    requestHost = hostHeader;",
            "",
            "// Top-level navigation from an ad:",
            "//   Origin:  (absent)",
            "//   Referer: https://www.facebook.com/     <-- this wins",
            "//   Host:    sub.silacod.com               <-- never reached",
        ],
        "impact": (
            "100% of paid traffic sees a 404 while direct visits and your own testing work "
            "perfectly. The fix is a separate <font face='Courier' size='8'>validateInfluencerHost()</font> "
            "that binds on <font face='Courier' size='8'>Host</font> only."),
    },
    {
        "ref": "backend/src/index.ts:182",
        "title": "Helmet's default policy would block every tracking pixel",
        "body": (
            "<font face='Courier' size='8'>helmet</font> is mounted with only a "
            "<font face='Courier' size='8'>crossOriginResourcePolicy</font> override, which "
            "means its default Content-Security-Policy is active — including "
            "<font face='Courier' size='8'>script-src 'self'</font>.<br/><br/>"
            "This is harmless today because Express only ever returns JSON, and a policy on "
            "a JSON response affects nothing. The moment Express returns HTML, that same "
            "header starts being enforced by the browser against the page: inline scripts "
            "blocked, <font face='Courier' size='8'>connect.facebook.net</font> blocked, "
            "YouTube frames blocked."),
        "impact": (
            "Pages render but no pixel fires — the exact failure this project exists to fix, "
            "introduced by the fix itself. Worse, it also applies on the SPA fallback path, "
            "which nginx currently serves with no CSP at all. <b>Both handlers must strip the "
            "header</b> and set their own."),
    },
    {
        "ref": "frontend/vite.config.ts:19",
        "title": "Returning visitors would keep seeing the old page",
        "body": (
            "The site registers a service worker through "
            "<font face='Courier' size='8'>vite-plugin-pwa</font>. In its default generate "
            "mode the worker answers <b>navigation</b> requests from its own cache, and no "
            "<font face='Courier' size='8'>navigateFallbackDenylist</font> is configured. So "
            "<font face='Courier' size='8'>/r/CODE</font> would be served the cached React "
            "shell from the visitor's own device — the request never reaching nginx, let "
            "alone Node.<br/><br/>"
            "It is worth being precise about this one, because the currently deployed build "
            "makes it look harmless. <b>That build has no "
            "<font face='Courier' size='8'>sw.js</font> in it</b>, so no worker is installed "
            "and nothing is intercepted today. But a fresh build run on 16 August "
            "<b>does</b> produce one — 2,198 bytes, registering a navigation route, with no "
            "denylist anywhere in it. The absence is an accident of a stale build, not the "
            "configuration."),
        "code": [
            "# fresh `vite build`, 16 Aug:",
            "  sw.js                  2,198 bytes   <- generated",
            "  workbox-1ef09536.js   15,082 bytes",
            "",
            "$ grep -c 'NavigationRoute' sw.js   ->  1     answers every navigation",
            "$ grep -c 'denylist'        sw.js   ->  0     nothing excluded",
            "",
            "// frontend/vite.config.ts - must ship in the SAME deploy",
            "workbox: {",
            "  maximumFileSizeToCacheInBytes: 8000000,",
            "  navigateFallbackDenylist: [/^\\/r\\//],",
            "}",
        ],
        "impact": (
            "The compiled page works perfectly in a private window and not at all for anyone "
            "who has visited the site before — a genuinely hard bug to diagnose from a "
            "report of \"it didn't change for me\". One line, same deploy."),
    },
    {
        "ref": "BlockRenderer.tsx:844 and :979",
        "title": "A contained bug that this change would turn into a serious one",
        "body": (
            "The slider block builds a <font face='Courier' size='8'>&lt;style&gt;</font> "
            "element by string interpolation and injects it with "
            "<font face='Courier' size='8'>dangerouslySetInnerHTML</font>. Four values are "
            "interpolated: <font face='Courier' size='8'>block.id</font>, "
            "<font face='Courier' size='8'>cardGap</font>, "
            "<font face='Courier' size='8'>marqueeSpeed</font> and a shadow colour. All four "
            "come from the saved JSON, and the save route performs <b>no validation of any "
            "kind</b> — no schema, no type check, no length limit. It destructures "
            "<font face='Courier' size='8'>req.body</font> and hands it to Prisma five lines "
            "later.<br/><br/>"
            "<b>Today the impact is limited to CSS.</b> Assigning markup to a "
            "<font face='Courier' size='8'>&lt;style&gt;</font> element's "
            "<font face='Courier' size='8'>innerHTML</font> does not create elements — the "
            "browser treats the contents as stylesheet text. So an injected "
            "<font face='Courier' size='8'>&lt;img onerror=&gt;</font> creates nothing and "
            "runs nothing. It is a real bug, but a contained one: restyling the page, or "
            "pulling a background image from an external server.<br/><br/>"
            "<b>The same bytes written into server-generated HTML source do execute.</b> "
            "That is the difference this project introduces."),
        "code": [
            "// frontend/src/components/helper/sitebuilder/BlockRenderer.tsx:843",
            "<style dangerouslySetInnerHTML={{ __html: `",
            "  @keyframes marquee-${id} {        // id comes from saved JSON,",
            "    ...                             // which is never validated",
            "  }",
            "  .track-${id} { gap: ${cardGap}px; }",
            "` }} />",
        ],
        "impact": (
            "The compiler must derive every class and keyframe name from the block's "
            "<b>index</b>, never from <font face='Courier' size='8'>block.id</font>, and "
            "every colour and length must pass an allow-list before reaching CSS. "
            "<b>The slider has never been placed on any page</b> (see section 8), so the "
            "compiler will not touch this code for the foreseeable future — but the save "
            "route validation in phase 0 should still land, because it closes the underlying "
            "hole for the app that exists today."),
    },
    {
        "ref": "lead.routes.ts:143",
        "title": "Pack pricing is already silently wrong in one case",
        "body": (
            "When a visitor picks a product from a "
            "<font face='Courier' size='8'>products</font> block, the checkout form sends "
            "<font face='Courier' size='8'>productVariant</font> as a composite string like "
            "<font face='Courier' size='8'>\"Sac cuir (Pack 2)\"</font>. The server-side "
            "<font face='Courier' size='8'>getPackPrice()</font> matches "
            "<font face='Courier' size='8'>productVariant</font> against the bare pack name "
            "— <font face='Courier' size='8'>\"Pack 2\"</font>. The composite string can "
            "never match, so those leads silently fall back to the product's retail price."),
        "impact": (
            "This is a cash-collection bug that exists today. The compiler must reproduce the "
            "current behaviour <b>exactly</b>, including this quirk, and the bug should be "
            "fixed in its own change — otherwise a pricing correction and a rendering rewrite "
            "land together, and any change in revenue is impossible to attribute."),
    },
]

# ------------------------------------------------------------- xss contexts
D["context_raw"] = [
    ("HTML text", "text.text, hero.title",
     "<font face='Courier' size='7.5'>&lt;script&gt;</font> in the value becomes a real "
     "script tag in the document.", "escape &amp; &lt; &gt; \" ' `"),
    ("HTML attribute", "image.alt, image.url",
     "A stray double quote closes the attribute early; everything after it becomes new "
     "attributes, e.g. <font face='Courier' size='7.5'>onerror=</font>.", "same escape, always"),
    ("CSS value", "themeColor, every *Color",
     "Inside <font face='Courier' size='7.5'>&lt;style&gt;</font> there is no attribute "
     "boundary to escape. A value can close the rule, or fetch a tracking URL via "
     "<font face='Courier' size='7.5'>url()</font>.", "allow-list + fallback"),
    ("URL", "button.link, video.url",
     "<font face='Courier' size='7.5'>javascript:</font> in an href runs on click. Browsers "
     "ignore tabs and NUL bytes inside the scheme, so naive checks miss it.",
     "scheme allow-list"),
    ("JS string", "pack names, pixel ids",
     "<font face='Courier' size='7.5'>&lt;/script&gt;</font> anywhere inside a JSON string "
     "ends the script block, whatever the JSON escaping did.", "escape &lt; &gt; &amp; U+2028/9"),
]

# --------------------------------------------------- preserved / lost table
D["tracking_raw"] = [
    ("ReferralLink.clicks + click rows", "LOST", "flag",
     "Today this is a side-effect of the offer API call. The SSG handler must call the same "
     "code. The 10-second de-duplication map has to be SHARED, or a visitor whose browser "
     "also hits the API gets counted twice."),
    ("100-click notification", "RIDES ALONG", "good",
     "Lives inside the click increment, so preserving one preserves the other."),
    ("Bot / direct / desktop cloaking", "UPGRADED", "good",
     "Decided from User-Agent and Referer before the first byte. Catches bare crawlers that "
     "never ran the JavaScript check. <b>Fix the regex first</b> — see the warning below."),
    ("Country / IPv6 / IP-range cloaking", "UPGRADED", "good",
     "Uses the real socket IP and <font face='Courier' size='7.5'>geoip-lite</font>, already "
     "a dependency. Removes a third-party round trip to ipapi.co on the critical path, and "
     "the visitor can no longer block the check."),
    ("Language cloaking", "NEEDS CARE", "grow",
     "<font face='Courier' size='7.5'>Accept-Language</font> is a weighted list, not "
     "<font face='Courier' size='7.5'>navigator.language</font>. Parse it and test the top "
     "entry, or verdicts shift for bilingual visitors."),
    ("VPN / ASN cloaking", "LOST server-side", "flag",
     "<font face='Courier' size='7.5'>geoip-lite</font> has no VPN or network-operator "
     "fields. Keep these as a small inline re-check, or accept the loss."),
    ("Right-click blocking", "CLIENT-SIDE", "grow",
     "Emitted as a ~180-byte inline script, only when the setting is on."),
    ("Abandoned-cart capture", "ALREADY DEAD", "grow",
     "<b>Not caused by this project.</b> The socket is refused on /r/ paths today, so no "
     "rows are being written at all. Restoring it is a separate improvement."),
    ("rrweb session replay", "ALREADY DEAD", "grow",
     "Same cause. Nothing is being lost here that is not already gone."),
    ("Traffic log for the visit", "UPGRADED", "good",
     "The document request itself gets logged with the real path, instead of the API call "
     "standing in for it."),
    ("x-client-* telemetry", "DEGRADED", "grow",
     "Screen size, window size and similar arrive from JavaScript today. A plain document "
     "request has none. Inline a few bytes to re-post them, or accept lower fidelity."),
    ("Maintenance-mode behaviour", "FIXED", "good",
     "MaintenanceGuard already documents an intent to keep /r/ up during maintenance. "
     "Mounting the route above the middleware finally makes that true."),
    ("WhatsApp click tracking", "MUST BE PORTED", "flag",
     "The widget's tracking call has to be emitted into the static page or the counter "
     "stops moving."),
    ("Pixels and lead submission", "MUST BE PORTED", "flag",
     "The entire point of the page. Both are rebuilt in the compiled runtime."),
]

D["xss_reasons"] = [
    "<b>It runs at the wrong layer.</b> <font face='Courier' size='8'>sanitizeInput</font> "
    "cleans <font face='Courier' size='8'>req.body</font> on the way in, and it is gated "
    "behind a database setting an administrator can switch off. Whether your output is safe "
    "must not depend on a runtime toggle — and rows already in the database were written "
    "under whatever the setting happened to be then.",

    "<b>It works on the wrong unit.</b> <font face='Courier' size='8'>xss()</font> is an "
    "HTML sanitiser: it decides which <i>tags</i> survive. It leaves quotes and ampersands "
    "in ordinary text alone. A stored alt-text of "
    "<font face='Courier' size='8'>\" onerror=alert(1) x=\"</font> contains no tag at all, "
    "so <font face='Courier' size='8'>xss()</font> never looks at it — but dropped into "
    "<font face='Courier' size='8'>alt=\"…\"</font> it escapes the attribute.",

    "<b>It would change what your pages render.</b> "
    "<font face='Courier' size='8'>xss()</font> <i>permits</i> a whitelist of tags. A text "
    "block containing <font face='Courier' size='8'>&lt;a href=x&gt;</font> shows as literal "
    "text today; passed through <font face='Courier' size='8'>xss()</font> it would become a "
    "working link. Silently changing what influencers' pages display is not an acceptable "
    "side effect of an escaping decision.",
]

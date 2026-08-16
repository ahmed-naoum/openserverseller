"""
Builds the explainer PDF for the /r/:code static-compilation plan.

Written for the repo owner, not for a reviewer: it explains WHY each piece
exists before it says what to build. Every number in here is either measured
from the repo or explicitly marked as an estimate — the draft this replaces
carried invented conversion figures, and the whole document is worthless if
the reader cannot tell which is which.

Usage:  python build_ssg_pdf.py [output.pdf]
"""
import os
import sys

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, KeepTogether, NextPageTemplate, PageBreak,
    PageTemplate, Paragraph, Spacer, Table, TableStyle,
)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssg_chrome import (  # noqa: E402
    INK, INK_2, INK_3, RULE, ACCENT, ACCENT_SOFT, FLAG, FLAG_SOFT, GROW,
    GROW_SOFT, GOOD, GOOD_SOFT, BAND, HAIR, MONO, MONO_B, SANS, SANS_B,
    S_EYEBROW, S_TITLE, S_SUB, S_LEDE, S_H2, S_H3, S_BODY, S_CELL, S_CELL_SM,
    S_NOTE, S_CODE, S_CAPTION, esc, style, head_row, table, callout,
    code_block, Waterfall, FlowDiagram, SizeBars, Rule,
)

REPO = r"C:\Users\Victus\Desktop\vegas"
NAME = "Landing_Page_Static_Compilation_Explained.pdf"
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, NAME)
DATE = "16 August 2026"

# Filled from the research pass; anything still None renders as "not measured".
from ssg_data import D  # noqa: E402

# The data module names colours as strings so it stays free of reportlab imports.
_PALETTE = {"INK": INK, "INK_2": INK_2, "INK_3": INK_3, "ACCENT": ACCENT,
            "FLAG": FLAG, "GROW": GROW, "GOOD": GOOD, "RULE": RULE}
D["waterfall_rows"] = [(l, lb, s, d, _PALETTE[c], n)
                       for l, lb, s, d, c, n in D["waterfall_rows"]]
D["size_bars"] = [(lb, v, _PALETTE[c], n) for lb, v, c, n in D["size_bars"]]

story = []
W = A4[0] - 36 * mm


def h2(text, eyebrow=None):
    out = []
    if eyebrow:
        out.append(Paragraph(eyebrow.upper(), S_EYEBROW))
    out.append(Paragraph(esc(text), S_H2))
    out.append(Rule(W, RULE, 0.5))
    out.append(Spacer(1, 7))
    return out


def h3(text):
    return Paragraph(esc(text), S_H3)


def p(text, st=S_BODY):
    """Body text. Inline <b>/<i>/<font> markup is intentional and passes through."""
    return Paragraph(text, st)


def bullets(items, st=S_BODY, bullet="—"):
    return [Paragraph(f'<font color="#8496A2">{bullet}</font>&nbsp;&nbsp;{t}', st)
            for t in items]


def spacer(h=8):
    return Spacer(1, h)


def page_chrome(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFont(MONO, 6.5)
    canvas.setFillColor(INK_3)
    canvas.drawString(18 * mm, h - 12 * mm,
                      "SILACOD · LANDING PAGE STATIC COMPILATION · IMPLEMENTATION BRIEF")
    canvas.drawRightString(w - 18 * mm, h - 12 * mm, DATE)
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.4)
    canvas.line(18 * mm, h - 14 * mm, w - 18 * mm, h - 14 * mm)
    canvas.line(18 * mm, 14 * mm, w - 18 * mm, 14 * mm)
    canvas.setFont(MONO, 6.5)
    canvas.drawString(18 * mm, 10 * mm, "/r/:code  ·  compile on save, serve from Express")
    canvas.drawRightString(w - 18 * mm, 10 * mm, f"{doc.page}")
    canvas.restoreState()


def cover_chrome(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(ACCENT)
    canvas.rect(0, h - 6, w, 6, stroke=0, fill=1)
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.4)
    canvas.line(18 * mm, 14 * mm, w - 18 * mm, 14 * mm)
    canvas.setFont(MONO, 6.5)
    canvas.setFillColor(INK_3)
    canvas.drawString(18 * mm, 10 * mm, "SILACOD")
    canvas.drawRightString(w - 18 * mm, 10 * mm, DATE)
    canvas.restoreState()


# ==========================================================================
# COVER
# ==========================================================================

story += [
    Spacer(1, 26 * mm),
    Paragraph("IMPLEMENTATION BRIEF", S_EYEBROW),
    Spacer(1, 3),
    Paragraph("Serving landing pages as<br/>compiled static HTML", S_TITLE),
    Spacer(1, 6),
    Paragraph(
        "How <b>/r/:code</b> stops booting a React application for every visitor arriving "
        "from a paid ad, and starts serving a pre-built HTML document with the tracking "
        "pixel already running in the first few hundred bytes.",
        S_SUB),
    Spacer(1, 14),
    Rule(W, ACCENT, 1.6),
    Spacer(1, 12),
]

story.append(table([
    [Paragraph('<font size="15"><b>7 of 7</b></font><br/>'
               '<font size="7" color="#8496A2">LIVE PAGES COVERED IN V1<br/>'
               'six block types, measured</font>', S_CELL),
     Paragraph('<font size="15" color="#14717C"><b>~4.6 KB</b></font><br/>'
               '<font size="7" color="#8496A2">TYPICAL PAGE OVER THE WIRE<br/>'
               'brotli, estimated</font>', S_CELL),
     Paragraph('<font size="15" color="#1B6B4A"><b>~0.2 s</b></font><br/>'
               '<font size="7" color="#8496A2">UNTIL THE PIXEL FIRES<br/>'
               'versus ~9 s on slow 4G</font>', S_CELL),
     Paragraph('<font size="15" color="#AE3327"><b>5</b></font><br/>'
               '<font size="7" color="#8496A2">PROBLEMS FOUND IN THE CODE<br/>'
               'two would break the first deploy</font>', S_CELL)],
], [W * 0.25] * 4, zebra=False, pad=7,
    extra=[("BACKGROUND", (0, 0), (-1, -1), colors.white),
           ("LINEBELOW", (0, 0), (-1, 0), 0, colors.white),
           ("LINEAFTER", (0, 0), (-2, -1), 0.4, RULE)]))

story += [
    Spacer(1, 16),
    p("This document explains a change to how influencer landing pages are served. "
      "It is written to be read end to end before any code is written, because three "
      "of the five problems it describes are invisible until the change is live and "
      "expensive to discover then.", S_LEDE),
    Spacer(1, 10),
]

story.append(callout(Paragraph(
    '<font face="Courier" size="6.6" color="#8496A2">WHAT THIS DOCUMENT IS NOT</font><br/>'
    '<br/>'
    'It contains no conversion-rate predictions. An earlier draft of this plan claimed '
    'a jump from "28–33%" to "85–92%" landing page view rate and a "+250% more visitors" '
    'result. Those numbers were not measured and could not be — they are removed. '
    'What is measurable is <b>bytes over the wire</b> and <b>time until the pixel fires</b>, '
    'and only those are claimed here. Whether that converts better is something your own '
    'lead counts will tell you within a week of the rollout.', S_NOTE), "warn", W))

story += [Spacer(1, 14)]

story.append(table([
    [Paragraph('<font face="Courier" size="6.6" color="#8496A2">CONTENTS</font>', S_CELL), ''],
    [p("1 · What happens today, in order", S_CELL), p("The load waterfall, measured", S_CELL_SM)],
    [p("2 · What the change actually is", S_CELL), p("Compile on save, serve from Express", S_CELL_SM)],
    [p("3 · Why an Express route alone does nothing", S_CELL), p("nginx owns /r/ today", S_CELL_SM)],
    [p("4 · Five problems found by reading the code", S_CELL), p("Two would break the first deploy", S_CELL_SM)],
    [p("5 · Losing React means losing escaping", S_CELL), p("The security layer this needs", S_CELL_SM)],
    [p("6 · How pages stay fresh", S_CELL), p("The cache and version strategy", S_CELL_SM)],
    [p("7 · What survives, what degrades, what is lost", S_CELL), p("Tracking and analytics", S_CELL_SM)],
    [p("8 · The work, in order", S_CELL), p("A scope correction, then phases", S_CELL_SM)],
    [p("9 · How you will know it worked", S_CELL), p("Verification and the kill switch", S_CELL_SM)],
], [W * 0.52, W * 0.48], zebra=False, pad=4,
    extra=[("LINEBELOW", (0, 1), (-1, -1), 0.25, HAIR)]))

story.append(NextPageTemplate("body"))
story.append(PageBreak())

# ==========================================================================
# 1 · TODAY
# ==========================================================================

story += h2("What happens today, in order", "section 1")

story += [
    p("A visitor taps your ad on Facebook. Their phone opens "
      "<font face='Courier' size='8'>https://sub.silacod.com/r/NEO-ARTIZEN</font>. nginx "
      "finds no file at that path and falls back to "
      "<font face='Courier' size='8'>frontend/dist/index.html</font> — which, since "
      "prerendering was added, is <b>the fully rendered SILACOD marketing homepage</b>. "
      "So the first thing the visitor's browser paints is your homepage, complete with "
      "navigation, hero and 23 images, before React wipes it off the screen and starts "
      "again. Everything below has to finish <b>before your Meta Pixel can record that the "
      "visit happened at all</b>:"),
    spacer(9),
]

story.append(Waterfall(
    W, D["waterfall_rows"], D["waterfall_max_s"],
    ["today — react spa", "after — compiled html"],
    D["waterfall_pixel_marks"]))

story += [
    spacer(4),
    Paragraph(D["waterfall_caption"], S_CAPTION),
    spacer(11),
]

story += [
    h3("Why the pixel is the number that matters"),
    p("Everything else on that chart is a performance concern. The pixel is a "
      "<b>money</b> concern. Meta optimises your ad delivery from the events it receives. "
      "A visitor who taps, waits, and leaves after two seconds is a visitor Meta never "
      "hears about — so it keeps buying you more of that same audience. You pay for the "
      "click either way."),
    spacer(6),
    p("Moving <font face='Courier' size='8'>fbq('init')</font> and "
      "<font face='Courier' size='8'>fbq('track','PageView')</font> into the "
      "<font face='Courier' size='8'>&lt;head&gt;</font> of a document that is already "
      "complete when it arrives means the event fires during HTML parsing — before any "
      "image, before any stylesheet, and with no JavaScript framework involved at all."),
    spacer(10),
]

story.append(SizeBars(W, D["size_bars"], footnote=D["size_bars_footnote"]))

story += [spacer(4), Paragraph(D["size_caption"], S_CAPTION), spacer(12)]

story.append(KeepTogether([
    h3("Why splitting the bundle did not help here"),
    Spacer(1, 4),
    p("<font face='Courier' size='8'>vite.config.ts</font> already splits vendor code into "
      "named chunks, with careful comments explaining why. The split is real — but "
      "<b>separate chunks are not the same as lazy chunks</b>. A chunk is only deferred if "
      "nothing on the startup path imports it, and "
      "<font face='Courier' size='8'>App.tsx</font> statically imports the dashboard and "
      "admin screens that pull in charts and session replay. So they are separate files that "
      "are all still downloaded:"),
    Spacer(1, 7),
    table([head_row(["chunk", "raw bytes", "gzipped", "why it loads on a landing page"])] +
          [[Paragraph(f'<font face="Courier" size="7.2">{c[0]}</font>', S_CELL),
            Paragraph(f'<font face="Courier" size="7.2">{c[1]}</font>', S_CELL),
            Paragraph(f'<font face="Courier" size="7.2">{c[2]}</font>', S_CELL),
            Paragraph(c[3], S_CELL_SM)] for c in D["chunk_rows"]],
          [W * 0.20, W * 0.14, W * 0.13, W * 0.53], pad=3.2,
          extra=[("ALIGN", (1, 0), (2, -1), "RIGHT")]),
    Spacer(1, 7),
    p("The landing page's own code is the last row: <b>27,976 bytes</b>. Everything above it "
      "is overhead that a visitor who will only ever see one offer page pays in full — and "
      "cannot begin to pay until the entry chunk has executed, because the lazy import lives "
      "inside it.", S_NOTE),
]))

story.append(PageBreak())

# ==========================================================================
# 2 · THE CHANGE
# ==========================================================================

story += h2("What the change actually is", "section 2")

story += [
    p("The landing page builder already stores every page as JSON — a list of blocks "
      "in <font face='Courier' size='8'>ReferralLinkLandingPage.customStructure</font>. "
      "Today that JSON is shipped to the browser and turned into a page by React, on the "
      "visitor's phone, every single time. The change is to do that work <b>once, on the "
      "server, when the page is saved</b>, and store the resulting HTML."),
    spacer(9),
]

story.append(FlowDiagram(W, 104, [
    ("ON SAVE · runs once", BAND),
    ("ON VISIT · runs every request", colors.white),
], [
    (0, 0, "Builder saves", "PUT .../landing-page", "actor"),
    (0, 1, "Compile", "blocks to HTML + CSS", "step"),
    (0, 2, "Compress", "brotli, quality 11", "step"),
    (0, 3, "Store", "compiledHtml, compiledBrotli", "store"),
    (1, 0, "GET /r/:code", "nginx proxies to node", "actor"),
    (1, 1, "Cache lookup", "memory, then database", "step"),
    (1, 2, "Cloak + count", "headers only", "step"),
    (1, 3, "Send bytes", "~4.6 KB, no rendering", "out"),
], [
    ((0, 0), (0, 1), "ok"), ((0, 1), (0, 2), "ok"), ((0, 2), (0, 3), "ok"),
    ((1, 0), (1, 1), "ok"), ((1, 1), (1, 2), "ok"), ((1, 2), (1, 3), "ok"),
]))

story += [
    spacer(6),
    Paragraph("The expensive half runs when an influencer clicks Save. The visitor half "
              "reads a cache and writes bytes to a socket.", S_CAPTION),
    spacer(11),
]

story += [
    h3("The part that makes this maintainable"),
    p("Compiled output goes stale — that is the usual objection to this approach, and the "
      "usual answer is a backfill script somebody has to remember to run. This design "
      "avoids that entirely with a <b>version number</b>."),
    spacer(6),
]

story.append(code_block([
    "// backend/src/services/landingCompiler/index.ts",
    "export const COMPILER_VERSION = 1;",
    "",
    "// on read:",
    "if (row.compiledHtml && row.compilerVersion === COMPILER_VERSION) {",
    "  return row.compiledHtml;          // reuse",
    "}",
    "return await compileLanding(link);  // recompile and persist",
], W))

story += [
    spacer(8),
    p("Fix a bug in the compiler, bump the number to <font face='Courier' size='8'>2</font>, "
      "deploy. Every stored page now fails the equality check, so the first visitor to each "
      "one pays a single recompile and everybody after that gets the fixed version. "
      "<b>No migration, no backfill, no cron job.</b> The fix propagates itself, page by "
      "page, driven by real traffic — which also means your busiest pages are fixed first."),
    spacer(10),
]

story.append(callout(Paragraph(
    '<b>Two independent switches control whether a visitor sees compiled HTML.</b><br/><br/>'
    '<font face="Courier" size="8">SSG_LANDING</font> is an environment variable on the '
    'server: <font face="Courier" size="8">off</font>, '
    '<font face="Courier" size="8">shadow</font>, or <font face="Courier" size="8">on</font>. '
    '<font face="Courier" size="8">landingPage.ssgEnabled</font> is a per-link column. '
    'Both must say yes.<br/><br/>'
    'You chose to deploy with <font face="Courier" size="8">SSG_LANDING=on</font> and '
    '<font face="Courier" size="8">ssgEnabled</font> defaulting to true, so every link '
    'switches on deploy. Keeping the environment variable means you can revert the entire '
    'feature to the React page with <font face="Courier" size="8">pm2 restart</font> — '
    'no code change, no rebuild, about fifteen seconds.', S_NOTE), "good", W))

story.append(PageBreak())

# ==========================================================================
# 3 · NGINX
# ==========================================================================

story += h2("Why an Express route alone does nothing", "section 3")

story += [
    p("This is the single most important correction to the original sketch, and it is the "
      "difference between the feature working and it appearing to do nothing at all."),
    spacer(7),
    p("<b>Express does not currently serve any HTML.</b> It handles "
      "<font face='Courier' size='8'>/api/v1/*</font> and "
      "<font face='Courier' size='8'>/uploads/*</font>, and nothing else. The React "
      "application — including <font face='Courier' size='8'>/r/:code</font> — is served "
      "directly by nginx from disk. Adding "
      "<font face='Courier' size='8'>app.get('/r/:code', ...)</font> to the backend today "
      "would produce a handler that is never called, because the request never reaches "
      "Node."),
    spacer(9),
]

story.append(code_block(D["nginx_current"], W))

story += [
    spacer(8),
    p("A new location block takes over that path. nginx matches prefix locations by "
      "<b>longest match, not by file order</b>, so <font face='Courier' size='8'>/r/</font> "
      "wins over <font face='Courier' size='8'>/</font> wherever it is written. The "
      "<font face='Courier' size='8'>^~</font> is still worth adding — it stops nginx "
      "evaluating regex locations once this prefix has matched:"),
    spacer(6),
]

story.append(code_block(D["nginx_new"], W))

story += [
    spacer(9),
]

story.append(callout(Paragraph(
    'This block lives in <font face="Courier" size="8">/etc/nginx/sites-available/silacod</font> '
    'on the VPS. <font face="Courier" size="8">setup.sh</font> generates that file, but only '
    'at provisioning time — it does not run on deploy. <b>The change must be made in '
    'setup.sh for the next rebuild AND applied by hand to the live server</b>, followed by '
    '<font face="Courier" size="8">nginx -t &amp;&amp; systemctl reload nginx</font>. '
    'Forgetting the second half is the most likely way for this project to appear to have '
    'no effect whatsoever.', S_NOTE), "warn", W))

story += [spacer(11)]

story.append(KeepTogether([
    h3("Something the build already produces and nobody uses"),
    Spacer(1, 4),
    p("While tracing this, one thing turned up that is worth fixing on its own merits."),
    Spacer(1, 5),
    p("<font face='Courier' size='8'>frontend/scripts/prerender.mjs</font> runs after every "
      "build and snapshots your marketing pages. In doing so it <b>overwrites "
      "<font face='Courier' size='8'>dist/index.html</font> with the prerendered "
      "homepage</b> — 89,297 bytes in the current build. It also writes a pristine, "
      "unrendered shell to <font face='Courier' size='8'>dist/spa.html</font>, 7,818 bytes, "
      "for exactly this situation."),
    Spacer(1, 5),
    p("But nginx's <font face='Courier' size='8'>try_files</font> names "
      "<font face='Courier' size='8'>/index.html</font>. So "
      "<font face='Courier' size='8'>spa.html</font> is generated on every single deploy and "
      "<b>read by nothing</b>, while every visitor to a landing page downloads your homepage "
      "markup and watches React throw it away."),
    Spacer(1, 6),
    callout(Paragraph(
        'This means the <i>fallback</i> path improves too. When the compiler declines a page — '
        'unsupported block, compile error, feature switched off — the Express handler serves '
        '<font face="Courier" size="8">spa.html</font> rather than '
        '<font face="Courier" size="8">index.html</font>. Same React application, same '
        'behaviour, about <b>11× less markup</b>. Pages that never get compiled still get '
        'faster.', S_NOTE), "good", W),
]))

story += [spacer(12)]

story += [
    h3("Where the route sits inside Express"),
    p("Once nginx forwards the request, position in the middleware stack matters — some of "
      "what runs on API calls is pure latency on a document request:"),
    spacer(7),
]

story.append(table(
    [head_row(["middleware", "runs for /r/?", "why it is placed there"])] +
    [[Paragraph(f'<font face="Courier" size="7.4">{esc(a)}</font>', S_CELL),
      Paragraph(b, S_CELL_SM), Paragraph(c, S_CELL_SM)]
     for a, b, c in D["middleware_raw"]],
    [W * 0.20, W * 0.11, W * 0.69], pad=4))

story += [
    spacer(8),
    p("The route mounts immediately after "
      "<font face='Courier' size='8'>ipFilter</font> — late enough that security and "
      "logging still apply, early enough to skip two asynchronous settings lookups and the "
      "API rate limiter that a document request has no business paying for.", S_NOTE),
]

story.append(PageBreak())

# ==========================================================================
# 4 · BLOCKERS  (research-fed detail)
# ==========================================================================

story += h2("Five problems found by reading the code", "section 4")

story += [
    p("None of these are speculative — each was confirmed against the actual file. The "
      "first two would break the deploy outright. The third is a trap that is currently "
      "harmless for an accidental reason. The last two are bugs that already exist and "
      "which this project would otherwise inherit and disguise."),
    spacer(10),
]

for i, b in enumerate(D["blockers"], 1):
    block = [
        Paragraph(f'<font face="Courier" size="6.6" color="#AE3327">BLOCKER {i}</font>'
                  f'&nbsp;&nbsp;<font face="Courier" size="6.6" color="#8496A2">'
                  f'{esc(b["ref"])}</font>', S_CELL),
        Spacer(1, 3),
        Paragraph(f'<b>{esc(b["title"])}</b>', S_H3),
        Spacer(1, 3),
        p(b["body"]),
    ]
    if b.get("code"):
        block += [Spacer(1, 6), code_block(b["code"], W)]
    if b.get("impact"):
        block += [Spacer(1, 6),
                  callout(Paragraph(f'<b>If missed:</b> {b["impact"]}', S_NOTE), "warn", W)]
    story.append(KeepTogether(block))
    story.append(Spacer(1, 13))

story.append(PageBreak())

# ==========================================================================
# 5 · ESCAPING
# ==========================================================================

story += h2("Losing React means losing escaping", "section 5")

story += [
    p("This section is the one worth reading twice. It describes a class of bug that does "
      "not announce itself in testing."),
    spacer(7),
    p("Right now, when the builder stores a heading of "
      "<font face='Courier' size='8'>&lt;script&gt;alert(1)&lt;/script&gt;</font>, React "
      "renders those characters as visible text. React escapes everything it interpolates, "
      "automatically, with no way to switch it off by accident. That protection is not "
      "something the codebase does — it is something the framework does <i>for</i> the "
      "codebase."),
    spacer(6),
    p("Building HTML with string templates on the server removes that protection entirely. "
      "Every value now has to be escaped by hand, correctly, for the specific context it "
      "lands in — and the same value needs different treatment depending on where it goes:"),
    spacer(9),
]

story.append(table(
    [head_row(["where the value lands", "example field", "what breaks it", "handled by"])]
    + [[Paragraph(f'<b>{esc(a)}</b>', S_CELL_SM),
        Paragraph(f'<font face="Courier" size="7.2">{esc(b)}</font>', S_CELL_SM),
        Paragraph(c, S_CELL_SM),
        Paragraph(f'<font face="Courier" size="7.2">{d}</font>', S_CELL_SM)]
       for a, b, c, d in D["context_raw"]],
    [W * 0.16, W * 0.19, W * 0.42, W * 0.23], pad=4))

story += [spacer(11), h3("Why the xss package already installed is not the answer")]
story += [spacer(4)]
story += bullets(D["xss_reasons"])
story += [spacer(11)]

story.append(KeepTogether([
    h3("The one subtle case worth understanding"),
    Spacer(1, 4),
    p("Most of the escaping is mechanical. This one is not, and it is the reason "
      "<font face='Courier' size='8'>safeUrl()</font> strips characters before testing "
      "rather than testing the raw string:"),
    Spacer(1, 6),
    code_block([
        "// Both of these NAVIGATE in a real browser:",
        "<a href='java[TAB]script:alert(1)'>   with a real tab character",
        "<a href='java[NUL]script:alert(1)'>   with a real NUL byte",
        "",
        "// So the check STRIPS control characters first, then tests:",
        "const probe = v.replace(/[\\u0000-\\u0020...]/g, '').toLowerCase();",
        "if (/^(javascript|vbscript|file|blob|about):/.test(probe)) return '';",
    ], W),
    Spacer(1, 6),
    p("A naive <font face='Courier' size='8'>startsWith('javascript:')</font> check passes "
      "both of those straight through. This is exactly the kind of detail that makes "
      "hand-rolled escaping risky, and the reason the escape layer is a small, tested "
      "module with its own unit tests rather than helpers scattered across the block "
      "renderers.", S_NOTE),
]))

story.append(PageBreak())

# ==========================================================================
# 6 · FRESHNESS  (written after research lands)
# ==========================================================================

story += h2("How pages stay fresh", "section 6")

story += [
    p("Storing rendered output creates one obvious risk: showing somebody a page that no "
      "longer reflects reality. There are three layers, and it is worth knowing which one "
      "catches which kind of change."),
    spacer(9),
]

story.append(table(
    [head_row(["layer", "lives for", "catches"])] +
    [[Paragraph('<b>Memory cache</b><br/><font face="Courier" size="7">per Node process</font>', S_CELL_SM),
      Paragraph("10 minutes", S_CELL_SM),
      Paragraph("Nothing on its own — it is purely a speed layer. Bounded by both an entry "
                "count and a byte ceiling so one unusually large page cannot push the "
                "process past its 500 MB restart limit.", S_CELL_SM)],
     [Paragraph('<b>Explicit invalidation</b><br/><font face="Courier" size="7">on write</font>', S_CELL_SM),
      Paragraph("immediate", S_CELL_SM),
      Paragraph("An influencer saving the page; pixels being added or removed; a subdomain "
                "or custom domain changing. These fire a targeted purge, so the next visitor "
                "recompiles.", S_CELL_SM)],
     [Paragraph('<b>Version stamp</b><br/><font face="Courier" size="7">COMPILER_VERSION</font>', S_CELL_SM),
      Paragraph("until bumped", S_CELL_SM),
      Paragraph("Every change you make to the compiler itself. Bump the constant and all "
                "stored output is invalid at once, with no backfill.", S_CELL_SM)]],
    [W * 0.22, W * 0.13, W * 0.65], pad=5))

story += [
    spacer(11),
    h3("Three scenarios, end to end"),
    spacer(4),
]

story += bullets([
    "<b>An influencer edits their page.</b> The save route writes "
    "<font face='Courier' size='8'>customStructure</font>, compiles immediately, stores the "
    "HTML, and purges the memory entry. The next visitor gets the new page. Time to "
    "propagate: instant.",

    "<b>You fix a bug in the compiler.</b> Bump "
    "<font face='Courier' size='8'>COMPILER_VERSION</font> and deploy. Nothing is "
    "recompiled at deploy time — instead the first visitor to each page triggers one "
    "recompile, and everyone after gets the fix. Your busiest pages heal first, and a "
    "page nobody visits costs nothing.",

    "<b>A product price changes.</b> Nothing explicitly purges the landing page, because "
    "the price lives on a different table. The ten-minute freshness window catches it. "
    "This is the deliberate trade: a short staleness window in exchange for not having to "
    "find and hook every write path that could possibly affect a page.",
])

story += [spacer(11)]

story.append(callout(Paragraph(
    '<b>Why compiled pages are not cached by browsers or a CDN.</b><br/><br/>'
    'The response carries <font face="Courier" size="8">Cache-Control: no-store</font>. That '
    'looks like a wasted opportunity until you notice that the same URL must return '
    '<i>different things to different people</i> — the cloaking rules redirect some visitors '
    'and not others — and that every view has to count as a click. A shared cache would '
    'serve one visitor\'s cloaking verdict to the next, and would hide visits from your click '
    'counter.<br/><br/>'
    'The cost of that decision is small: the server is doing a memory lookup and a socket '
    'write, on the order of a millisecond or two.', S_NOTE), "note", W))

story.append(PageBreak())

# ==========================================================================
# 7 · TRACKING
# ==========================================================================

story += h2("What survives, what degrades, what is lost", "section 7")

story += [
    p("Bypassing the React application means every side-effect that happened <i>because</i> "
      "React was running has to be accounted for. Most can be preserved; several actually "
      "improve; two turn out to have been broken for a while."),
    spacer(9),
]

_TONE = {"good": ("#1B6B4A", GOOD_SOFT), "grow": ("#9A6114", GROW_SOFT),
         "flag": ("#AE3327", FLAG_SOFT)}

_rows = [head_row(["side-effect", "status", "what it takes"])]
_bg = []
for i, (what, status, tone, detail) in enumerate(D["tracking_raw"], start=1):
    ink, tint = _TONE[tone]
    _rows.append([
        Paragraph(f'<b>{esc(what)}</b>', S_CELL_SM),
        Paragraph(f'<font face="Courier" size="6.6" color="{ink}"><b>{esc(status)}</b></font>',
                  S_CELL_SM),
        Paragraph(detail, S_CELL_SM)])
    _bg.append(("BACKGROUND", (1, i), (1, i), tint))

story.append(table(_rows, [W * 0.22, W * 0.15, W * 0.63], pad=4, zebra=False, extra=_bg))

story += [spacer(11)]

story.append(callout(Paragraph(
    '<font face="Courier" size="6.6" color="#8496A2">A CORRECTION WORTH MAKING EXPLICITLY</font>'
    '<br/><br/>'
    'When we discussed this, you asked to preserve abandoned-cart capture, on the '
    'understanding that serving static HTML would break it. <b>That premise was wrong, and '
    'the mistake was mine.</b><br/><br/>'
    '<font face="Courier" size="8">SocketContext.tsx:19</font> returns early for any path '
    'beginning <font face="Courier" size="8">/r/</font> and never opens a socket connection. '
    'So on landing pages <font face="Courier" size="8">socket</font> is null, the '
    '<font face="Courier" size="8">checkout:progress</font> emitter at '
    '<font face="Courier" size="8">ReferralForm.tsx:69</font> returns immediately, and '
    '<font face="Courier" size="8">socket?.emit(\'checkout:complete\')</font> at line 356 is '
    'a no-op. <b>No abandoned-cart rows are being recorded for landing pages today</b>, and '
    'the same applies to session replay.<br/><br/>'
    'This changes the decision. Rebuilding the capture as a small beacon is still worth '
    'doing — but it is a <i>repair of an existing bug</i>, not a dependency of this project, '
    'and it should be scheduled separately. Before doing the work, check whether any '
    '<font face="Courier" size="8">CheckoutAttempt</font> rows have appeared for referral '
    'traffic recently; if the table is dry, that confirms it.', S_NOTE), "warn", W))

story.append(PageBreak())

# ==========================================================================
# 8 · THE WORK
# ==========================================================================

story += h2("The work, in order", "section 8")

story.append(callout(Paragraph(
    '<font face="Courier" size="6.6" color="#8496A2">SCOPE CORRECTION — AND A CAVEAT ON IT</font>'
    '<br/><br/>'
    'The original plan picked seven block types to support first. Those were chosen from the '
    'builder\'s palette — <b>nobody checked what real pages contain</b>. Querying the '
    'database changes the picture completely: only <b>six</b> block types have ever been '
    'placed on a page, four of the seven planned types are used by nobody, and '
    '<font face="Courier" size="8">video</font> — one of the most common — was left out.'
    '<br/><br/>'
    '<b>The caveat: those counts come from the local development database</b>, which '
    '<font face="Courier" size="8">backend/.env</font> points at '
    '(<font face="Courier" size="8">localhost:5432</font>). Its pages are named '
    '<font face="Courier" size="8">aaaa</font>, <font face="Courier" size="8">dddd</font>, '
    '<font face="Courier" size="8">ccccaaa</font> — scratch data. The figures below are '
    'therefore <b>illustrative of the method, not of your business</b>.<br/><br/>'
    'Before choosing a scope, run '
    '<font face="Courier" size="8">scripts/landing-block-usage.ts</font> on the VPS against '
    'the production database. It prints exactly this table for real pages.', S_NOTE), "warn", W))

story += [spacer(11)]

story.append(table(
    [head_row(["block type", "times placed", "pages", "status", "what it needs"])] +
    [[Paragraph(f'<font face="Courier" size="7.4">{esc(t)}</font>', S_CELL_SM),
      Paragraph(str(n) if n else "—", S_CELL_SM),
      Paragraph(str(pg) if pg else "—", S_CELL_SM),
      Paragraph(f'<font face="Courier" size="6.6" color="'
                f'{"#1B6B4A" if st == "in scope" else "#8496A2"}"><b>{esc(st).upper()}</b></font>',
                S_CELL_SM),
      Paragraph(note, S_CELL_SM)]
     for t, n, pg, st, note in D["block_usage"]],
    [W * 0.19, W * 0.11, W * 0.08, W * 0.13, W * 0.49], pad=3.2,
    extra=[("ALIGN", (1, 0), (2, -1), "RIGHT")]))

story += [
    spacer(7),
    p("The practical effect is a <b>harder</b> phase 1, not an easier one. Of the six blocks "
      "in real use, only <font face='Courier' size='8'>image</font> is pure markup — the "
      "other five all need a small amount of JavaScript. The work shifts away from "
      "reproducing CSS and towards writing compact runtimes. That is worth knowing before "
      "committing to a timeline.", S_NOTE),
    spacer(13),
]

story += [
    p("Ordered so that nothing user-facing changes until the groundwork is in place, and so "
      "the first visible step is also the smallest."),
    spacer(9),
]

_PHASES = [
    ("0", "Groundwork", "no visible change",
     "Extract the click-recording code so one implementation serves both paths — sharing "
     "its de-duplication map is what prevents double counting. Add validation to the save "
     "route, which currently stores any JSON up to 10 MB without inspection. Narrow the "
     "builder's read query so it stops returning the new HTML column. Add the service-worker "
     "denylist.", "good"),
    ("1", "The compiler and the route", "all 7 live pages",
     "The six block types actually in use, the escape layer with its own tests, the cache, "
     "the Express route, the nginx block, server-side cloaking, and the checkout form "
     "rebuilt in plain JavaScript. Any page using a block outside the six is declined and "
     "served the React version instead — a refusal, not a failure.", "accent"),
    ("2", "Only when needed", "deferred",
     "The seven remaining block types have never been placed on a page. Build one when a "
     "page actually uses it; until then the fallback covers it correctly. Spending effort "
     "here before that happens is building for nobody — which is precisely the mistake the "
     "original scope made.", "grow"),
    ("3", "Tuning", "measured improvement",
     "Image dimensions read at compile time to eliminate layout shift; the largest image "
     "given priority; pre-connections opened only for pixel providers actually in use.",
     "grow"),
]

for num, title, outcome, detail, tone in _PHASES:
    ink, hexs = {"good": (GOOD, "#1B6B4A"), "accent": (ACCENT, "#14717C"),
                 "grow": (GROW, "#9A6114")}[tone]
    story.append(table([[
        Paragraph(f'<font size="17" color="{hexs}"><b>{num}</b></font>', S_CELL),
        Paragraph(f'<b>{esc(title)}</b><br/>'
                  f'<font face="Courier" size="6.6" color="#8496A2">{esc(outcome).upper()}</font>',
                  S_CELL),
        Paragraph(detail, S_CELL_SM)]],
        [W * 0.06, W * 0.20, W * 0.74], zebra=False, pad=6,
        extra=[("BACKGROUND", (0, 0), (-1, -1), colors.white),
               ("LINEBELOW", (0, 0), (-1, 0), 0.25, HAIR),
               ("LINEBEFORE", (0, 0), (0, -1), 2, ink),
               ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(Spacer(1, 7))

story += [
    spacer(6),
    h3("Where the effort actually goes"),
    spacer(4),
    p("Before the database was checked, the answer looked like CSS: roughly two hundred "
      "utility classes — <font face='Courier' size='8'>shadow-xl</font>, "
      "<font face='Courier' size='8'>text-4xl md:text-5xl</font>, "
      "<font face='Courier' size='8'>backdrop-blur-sm</font>, responsive grids — reproduced "
      "by hand until the spacing matches. That work is still there, but it is no longer the "
      "bulk of it."),
    spacer(6),
    p("<b>The real cost is the runtimes.</b> Five of the six blocks in use need JavaScript: "
      "the checkout form with its validation and pixel firing, a video player with unmute "
      "and play overlays, an audio player with seek and speed control, the floating WhatsApp "
      "widget, and the sticky button. Each has to be written in plain JavaScript, kept small "
      "enough to inline, and behave exactly as the React version does — including the "
      "existing quirks, so that no behaviour changes underneath the rollout."),
    spacer(6),
    p("This is the part to be honest about in any estimate. It is more work than the original "
      "plan implied, and the reason is that the original plan chose the easy blocks without "
      "checking whether anyone used them.", S_NOTE),
]

story.append(PageBreak())

# ==========================================================================
# 9 · VERIFICATION
# ==========================================================================

story += h2("How you will know it worked", "section 9")

story += [
    h3("Immediately after deploying"),
    spacer(5),
    p("Run this against a real link. Everything you need to know is in the headers:"),
    spacer(6),
]

story.append(code_block([
    "curl -sI https://sub.silacod.com/r/YOURCODE",
    "",
    "# Expected:",
    "#   HTTP/2 200",
    "#   content-type: text/html; charset=utf-8",
    "#   content-encoding: br",
    "#   cache-control: no-store",
    "#   content-security-policy: default-src 'none'; ...",
    "",
    "# The failure to look for: TWO content-security-policy headers, or one",
    "# containing `script-src 'self'`. That is helmet's default leaking",
    "# through, and it means no pixel on the page will fire.",
], W))

story += [spacer(10), h3("Then check these four things, in this order"), spacer(5)]

story += bullets([
    "<b>Real sizes, not estimates.</b> "
    "<font face='Courier' size='8'>curl -s URL | wc -c</font> against "
    "<font face='Courier' size='8'>curl -s -H 'Accept-Encoding: identity' URL | wc -c</font>. "
    "The estimates in this document should be replaced with whatever these actually say.",

    "<b>The page in a browser that has visited the site before.</b> Not a private window — "
    "a normal one, ideally on a phone that has used the platform. This is the check that "
    "would catch a service worker interfering, if the PWA is ever repaired.",

    "<b>Meta Events Manager.</b> PageView events should appear promptly and in greater "
    "numbers than before, because visitors who used to leave during the load are now being "
    "counted. Lead events should match your <font face='Courier' size='8'>Lead</font> row "
    "count.",

    "<b>Compile failures.</b> "
    "<font face='Courier' size='8'>SELECT count(*) FROM referral_link_landing_pages "
    "WHERE \"compileError\" IS NOT NULL;</font> — anything above zero is a real bug, since "
    "an unsupported block is recorded as a decline rather than an error.",
])

story += [spacer(11), h3("The measurement that actually decides it"), spacer(4)]

story.append(callout(Paragraph(
    'Not Lighthouse. <b>Leads per link per day, compared against the same links the week '
    'before.</b><br/><br/>'
    'Page speed is the mechanism, not the goal. If leads do not move, the speed improvement '
    'was real and the bottleneck was somewhere else — the offer, the audience, the price — '
    'and you will have learned something more useful than a performance score. Watch '
    '<font face="Courier" size="8">ReferralLink.clicks</font> alongside it: if clicks hold '
    'steady while leads rise, the change did what it was meant to do.', S_NOTE), "good", W))

story += [spacer(12), h3("If something is wrong"), spacer(5)]

story.append(code_block([
    "# Revert everything to the React page. No rebuild, no code change.",
    "pm2 set silacod-api:SSG_LANDING off   # or edit the env file",
    "pm2 restart silacod-api --update-env",
    "",
    "# Or turn off a single link, leaving the rest compiled:",
    "#   UPDATE referral_link_landing_pages SET \"ssgEnabled\" = false",
    "#   WHERE \"referralLinkId\" = <id>;",
    "",
    "# Or, for one request only, to compare side by side in a browser:",
    "#   https://sub.silacod.com/r/YOURCODE?__ssg=0",
], W))

story += [
    spacer(10),
    p("The nginx change stays in place either way — with "
      "<font face='Courier' size='8'>SSG_LANDING=off</font> the Express route simply serves "
      "the React application itself, using the small "
      "<font face='Courier' size='8'>spa.html</font> shell rather than the 89 KB homepage. "
      "So even the fully reverted state is better than today.", S_NOTE),
]

_tail = [
    Rule(W, RULE, 0.5),
    Spacer(1, 8),
    Paragraph('<font face="Courier" size="6.6" color="#8496A2">FOUND ALONG THE WAY — '
              'SEPARATE FROM THIS WORK</font>', S_CELL),
    Spacer(1, 3),
    p("Three live bugs turned up while reading the code for this plan. None are caused by "
      "this project and none should be fixed inside it, but the first one is costing money "
      "right now.", S_NOTE),
    Spacer(1, 6),
]

_tail += bullets([
    "<b>The bot filter redirects every human visitor.</b> "
    "<font face='Courier' size='8'>cloaking.ts:16</font> contains a bare "
    "<font face='Courier' size='8'>moz</font> pattern, and every browser sends "
    "<font face='Courier' size='8'>Mozilla/5.0</font>. Any link with bot filtering enabled "
    "and no explicit allow-list has been sending 100% of its paid traffic to wikipedia.org. "
    "<font face='Courier' size='8'>instagram</font> and "
    "<font face='Courier' size='8'>whatsapp</font> are also bare patterns, so in-app "
    "browsers are caught too. <b>Fix this before moving cloaking to the server.</b>",

    "<b>The PWA does nothing but cost 89 KB per visit.</b> The build emits a registration "
    "script but no service worker, so every visitor requests "
    "<font face='Courier' size='8'>/sw.js</font>, receives the homepage, and fails to "
    "register.",

    "<b>Three image URLs point at localhost.</b> The prerendered homepage contains "
    "<font face='Courier' size='8'>http://localhost:4173/uploads/...</font> baked in at "
    "build time; those images are broken for every visitor.",
])

story.append(KeepTogether(_tail))

# ==========================================================================

doc = BaseDocTemplate(
    OUT, pagesize=A4,
    leftMargin=18 * mm, rightMargin=18 * mm,
    topMargin=20 * mm, bottomMargin=18 * mm,
    title="Serving landing pages as compiled static HTML",
    author="Silacod",
    subject="Implementation brief for on-demand static compilation of /r/:code landing pages",
)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main",
              leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
doc.addPageTemplates([
    PageTemplate(id="cover", frames=[frame], onPage=cover_chrome),
    PageTemplate(id="body", frames=[frame], onPage=page_chrome),
])
doc.build(story)
print(f"wrote {OUT} ({os.path.getsize(OUT) / 1024:.1f} KB)")

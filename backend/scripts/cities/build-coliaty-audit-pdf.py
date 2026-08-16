"""
Renders the Coliaty-facing audit (data/coliaty-audit.json) as a printable report.

Structure follows what the reader has to decide. The proof that our side already
matches their catalogue comes first, because nothing after it is worth reading if
that is in doubt; then what we found wrong in the catalogue; then what we are
asking them for. The 444-city directory is reference, and sits at the back.

Usage:
    python scripts/cities/build-coliaty-audit-pdf.py [output.pdf]
"""
import json
import math
import os
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Flowable, Frame, KeepTogether, PageBreak, PageTemplate,
    Paragraph, Spacer, Table, TableStyle,
)

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIT = os.path.join(HERE, "data", "coliaty-audit.json")
CARRIER = os.path.join(HERE, "data", "coliaty-cities.json")
BACKEND = os.path.dirname(os.path.dirname(HERE))
REPO = os.path.dirname(BACKEND)
NAME = "Coliaty_City_Matching_and_Placement_Audit_2026.pdf"
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, NAME)
# The previous generator left a copy under backend/ as well; keep the pair in
# step so nobody hands out the stale one.
MIRROR = os.path.join(BACKEND, NAME) if OUT == os.path.join(REPO, NAME) else None

# Same chart-ink palette as the hub audit: quiet slate ground, teal for
# structure, red only for "this needs a decision", amber only for the growth
# proposals — so a reader can tell a finding from a request at a glance.
INK = colors.HexColor("#14202A")
INK_2 = colors.HexColor("#4A5C69")
INK_3 = colors.HexColor("#8496A2")
RULE = colors.HexColor("#CFD9DE")
ACCENT = colors.HexColor("#14717C")
ACCENT_SOFT = colors.HexColor("#E4F0F1")
FLAG = colors.HexColor("#AE3327")
FLAG_SOFT = colors.HexColor("#F8E7E4")
GROW = colors.HexColor("#9A6114")
GROW_SOFT = colors.HexColor("#FBF1E0")
GOOD = colors.HexColor("#1B6B4A")
BAND = colors.HexColor("#F4F7F8")

MONO, MONO_B = "Courier", "Courier-Bold"
SANS, SANS_B = "Helvetica", "Helvetica-Bold"

with open(AUDIT, encoding="utf-8") as fh:
    A = json.load(fh)
with open(CARRIER, encoding="utf-8") as fh:
    CARRIER_ROWS = json.load(fh)

T = A["totals"]
THRESHOLD = A["threshold"]
PLACEMENT = A["placement"]
PROPOSALS = A["proposals"]
DATE = A["generatedAt"]

SUSPECT = sum(h["suspects"] for h in PLACEMENT)
UNPLACED = sum(h["unplaced"] for h in PLACEMENT)


def latin(text):
    """
    Drops scripts the PDF base fonts cannot draw.

    A few OSM names carry the Arabic or Tifinagh spelling alongside the Latin one
    ("Goulmane كولمان"). Helvetica has no glyphs for those, so they come out as
    solid black boxes; and even with an embedded Arabic face ReportLab does no
    RTL shaping, which would render the letters disconnected and reversed. The
    Latin half says the same thing, so it is the half we keep.
    """
    if not text:
        return text
    kept = "".join(ch for ch in text if ord(ch) <= 0x024F)
    return " ".join(kept.split()) or "(Arabic)"


def esc(text):
    """Paragraph markup is XML; carrier names contain & and < often enough."""
    return (latin(str(text)) if text is not None else "") \
        .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


for _hub in PLACEMENT:
    _hub["hub"] = latin(_hub["hub"])
    for _c in _hub["cities"]:
        _c["name"] = latin(_c["name"])
        if _c.get("coliatyName"):
            _c["coliatyName"] = latin(_c["coliatyName"])


# ----------------------------------------------------------------- the map

class CoveragePlot(Flowable):
    """
    The served network and the gaps in it, on one frame.

    Two things are meant to be readable without the tables: where the eighteen
    hubs actually sit relative to the cities they serve, and where the proposed
    hub sites fall — every one of them in a part of the country the current
    crosshairs leave empty.
    """

    def __init__(self, width, height):
        super().__init__()
        self.width, self.height = width, height

        pts = [(c["latitude"], c["longitude"]) for h in PLACEMENT for c in h["cities"]
               if c["latitude"] is not None]
        pts += [(c["latitude"], c["longitude"]) for c in PROPOSALS["cities"]]
        lats = [p[0] for p in pts]
        lons = [p[1] for p in pts]
        self.min_lat, self.max_lat = min(lats) - 0.4, max(lats) + 0.4
        self.min_lon, self.max_lon = min(lons) - 0.4, max(lons) + 0.4

        # Longitude degrees narrow with latitude; without this Morocco reads far
        # too wide and the clusters lose their real shape.
        self.k = math.cos(math.radians((self.min_lat + self.max_lat) / 2))
        span_x = (self.max_lon - self.min_lon) * self.k
        span_y = self.max_lat - self.min_lat
        pad = 12
        self.scale = min((width - pad * 2) / span_x, (height - pad * 2) / span_y)
        self.off_x = (width - span_x * self.scale) / 2
        self.off_y = (height - span_y * self.scale) / 2

    def px(self, lon):
        return self.off_x + (lon - self.min_lon) * self.k * self.scale

    def py(self, lat):
        return self.off_y + (lat - self.min_lat) * self.scale

    def draw(self):
        c = self.canv

        c.setStrokeColor(colors.HexColor("#E2E9EC"))
        c.setLineWidth(0.3)
        c.setFont(MONO, 4.5)
        c.setFillColor(INK_3)
        lat = math.ceil(self.min_lat / 2) * 2
        while lat <= self.max_lat:
            c.line(self.px(self.min_lon), self.py(lat), self.px(self.max_lon), self.py(lat))
            c.drawString(self.px(self.min_lon) + 2, self.py(lat) + 1.5, f"{lat}°N")
            lat += 2
        lon = math.ceil(self.min_lon / 2) * 2
        while lon <= self.max_lon:
            c.line(self.px(lon), self.py(self.min_lat), self.px(lon), self.py(self.max_lat))
            c.drawString(self.px(lon) + 2, self.py(self.min_lat) + 2, f"{lon}°")
            lon += 2

        # Served cities.
        for hub in PLACEMENT:
            for city in hub["cities"]:
                if city["latitude"] is None:
                    continue
                d = city["distanceKm"]
                flagged = d is not None and d > THRESHOLD
                c.setFillColor(FLAG if flagged else colors.HexColor("#9DAEB8"))
                c.circle(self.px(city["longitude"]), self.py(city["latitude"]),
                         1.9 if flagged else 1.1, stroke=0, fill=1)

        # Cities we are proposing: hollow so they read as "not yet served"
        # against the solid dots of the live network.
        for city in PROPOSALS["cities"]:
            c.setStrokeColor(GROW)
            c.setLineWidth(0.6)
            c.circle(self.px(city["longitude"]), self.py(city["latitude"]), 1.6, stroke=1, fill=0)

        # Existing hubs, numbered rather than named: eighteen names in the
        # northern cluster overlap into an unreadable smear, and the key below
        # carries the names without fighting for space.
        for i, hub in enumerate(PLACEMENT, 1):
            if not hub["centre"]:
                continue
            hx, hy = self.px(hub["centre"]["lon"]), self.py(hub["centre"]["lat"])
            c.setStrokeColor(ACCENT)
            c.setLineWidth(0.7)
            c.line(hx - 5, hy, hx + 5, hy)
            c.line(hx, hy - 5, hx, hy + 5)
            c.setFillColor(colors.white)
            c.circle(hx, hy, 3.6, stroke=0, fill=1)
            c.setStrokeColor(ACCENT)
            c.circle(hx, hy, 3.6, stroke=1, fill=0)
            c.setFillColor(ACCENT)
            c.setFont(MONO_B, 4.6)
            c.drawCentredString(hx, hy - 1.7, str(i))

        # Proposed hub sites, lettered, with a ring at the radius each would
        # cover so the empty ground between the crosshairs is visible.
        radius_deg = PROPOSALS["hubRadiusKm"] / 111.0
        for i, hub in enumerate(shown_hub_sites(), 1):
            hx, hy = self.px(hub["longitude"]), self.py(hub["latitude"])
            c.setStrokeColor(GROW)
            c.setLineWidth(0.4)
            c.setDash(1.4, 1.6)
            c.circle(hx, hy, radius_deg * self.scale, stroke=1, fill=0)
            c.setDash()
            c.setFillColor(colors.white)
            c.rect(hx - 3.4, hy - 3.4, 6.8, 6.8, stroke=0, fill=1)
            c.setStrokeColor(GROW)
            c.setLineWidth(0.8)
            c.rect(hx - 3.4, hy - 3.4, 6.8, 6.8, stroke=1, fill=0)
            c.setFillColor(GROW)
            c.setFont(MONO_B, 4.6)
            c.drawCentredString(hx, hy - 1.7, chr(64 + i))


def shown_hub_sites():
    """
    The hub sites worth printing.

    A site that covers one town and has no orders behind it is not a hub
    proposal — it is an argument for extending the nearest existing hub, and it
    is listed that way in the city table instead.
    """
    return [h for h in PROPOSALS["hubs"] if h["covers"] >= 2 or h["demandRows"] > 0]


# -------------------------------------------------------------- page frame

def page_chrome(canvas, doc):
    canvas.saveState()
    w, h = A4

    canvas.setFont(MONO, 6.5)
    canvas.setFillColor(INK_3)
    canvas.drawString(18 * mm, h - 12 * mm, "SILACOD · COLIATY CITY MATCHING, PLACEMENT & COVERAGE AUDIT")
    canvas.drawRightString(w - 18 * mm, h - 12 * mm, DATE)
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.4)
    canvas.line(18 * mm, h - 14 * mm, w - 18 * mm, h - 14 * mm)

    canvas.line(18 * mm, 14 * mm, w - 18 * mm, 14 * mm)
    canvas.setFont(MONO, 6.5)
    canvas.drawString(18 * mm, 10 * mm,
                      f"{T['carrierDistinct']} destinations matched · {T['hubs']} hubs · "
                      f"{len(PROPOSALS['cities'])} cities proposed · {len(shown_hub_sites())} hub sites")
    canvas.drawRightString(w - 18 * mm, 10 * mm, f"{doc.page}")
    canvas.restoreState()


def style(name, **kw):
    base = dict(name=name, fontName=SANS, fontSize=9, leading=12.5,
                textColor=INK, alignment=TA_LEFT)
    base.update(kw)
    return ParagraphStyle(**base)


S_EYEBROW = style("eyebrow", fontName=MONO, fontSize=7, leading=10, textColor=INK_3)
S_TITLE = style("title", fontName=SANS_B, fontSize=20, leading=24, spaceAfter=4)
S_LEDE = style("lede", fontSize=9.5, leading=14, textColor=INK_2)
S_H2 = style("h2", fontName=SANS_B, fontSize=12, leading=15, spaceBefore=2, spaceAfter=5)
S_H3 = style("h3", fontName=SANS_B, fontSize=9.5, leading=12, textColor=ACCENT)
S_BODY = style("body", fontSize=9, leading=13, textColor=INK_2)
S_CELL = style("cell", fontSize=8, leading=10)
S_CELL_SM = style("cellsm", fontSize=7.4, leading=9.4, textColor=INK_2)
S_NOTE = style("note", fontSize=8.4, leading=12, textColor=INK_2)

story = []


def head_row(labels):
    return [Paragraph(f'<font face="Courier" size="6.6" color="#8496A2">{h.upper()}</font>', S_CELL)
            for h in labels]


def table(rows, widths, extra=None, zebra=True, pad=3.5):
    t = Table(rows, colWidths=widths, repeatRows=1)
    ts = [
        ("BACKGROUND", (0, 0), (-1, 0), BAND),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, RULE),
        ("LINEBELOW", (0, 1), (-1, -1), 0.25, colors.HexColor("#E8EEF0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), pad),
        ("BOTTOMPADDING", (0, 0), (-1, -1), pad),
    ]
    if zebra:
        ts += [("BACKGROUND", (0, r), (-1, r), colors.HexColor("#FBFCFC"))
               for r in range(1, len(rows)) if r % 2 == 0]
    t.setStyle(TableStyle(ts + (extra or [])))
    return t


def stat(value, label, colour=None):
    tint = f' color="{colour}"' if colour else ""
    return Paragraph(
        f'<font size="16"{tint}><b>{value}</b></font><br/>'
        f'<font size="7.2" color="#8496A2">{label}</font>', S_CELL)


def stat_strip(cells, width=174 * mm):
    t = Table([cells], colWidths=[width / len(cells)] * len(cells))
    t.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, RULE),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, RULE),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    return t


def banner(text, fill, edge):
    t = Table([[Paragraph(text, S_NOTE)]], colWidths=[174 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), fill),
        ("LINEBEFORE", (0, 0), (0, -1), 2.2, edge),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


# ================================================================== page 1

story.append(Paragraph("SILACOD · DELIVERY INTEGRATION", S_EYEBROW))
story.append(Paragraph("Every destination Coliaty publishes, matched — and where the "
                       "network should grow next", S_TITLE))
story.append(Spacer(1, 3))
story.append(Paragraph(
    f"Silacod holds {T['localities']:,} Moroccan localities and resolves whatever a customer types "
    f"onto one of them before a parcel is created. This report checks that work against Coliaty&rsquo;s "
    f"own published catalogue rather than against our copy of it: every one of the "
    f"<b>{T['carrierDistinct']} destinations</b> Coliaty lists is matched, carries Coliaty&rsquo;s "
    f"<font face='Courier' size='8.5'>city_id</font>, <font face='Courier' size='8.5'>city_code</font> "
    f"and hub, and survives a round trip back to the same id. It then sets out what we are asking "
    f"Coliaty for — <b>{len(PROPOSALS['cities'])} cities</b> to add, <b>{len(shown_hub_sites())} hub "
    f"sites</b> to open, and the catalogue data that would close the gaps we cannot close from here.",
    S_LEDE))
story.append(Spacer(1, 11))

story.append(stat_strip([
    stat(f"{A['linkage']['linked']}/{T['carrierDistinct']}", "destinations matched", "#1B6B4A"),
    stat(f"{A['roundTrip']['correct']}/{A['roundTrip']['total']}", "names round-trip to the same id", "#1B6B4A"),
    stat(f"{len(PROPOSALS['cities'])}", "cities proposed", "#9A6114"),
    stat(f"{len(shown_hub_sites())}", "hub sites proposed", "#9A6114"),
]))
story.append(Spacer(1, 9))

story.append(banner(
    f"<b>Three claims, each measured further down.</b> &nbsp;<b>1.</b> Matching works: "
    f"{A['stress']['byKind']['verbatim']['correct']} of {A['roundTrip']['total']} carrier names resolve correctly, and so do all of "
    f"them under uppercasing, accent-stripping, &lsquo;, Maroc&rsquo; suffixes, hyphenation and "
    f"removed spaces — {A['stress']['correct']:,} of {A['stress']['total']:,} tests across nine input shapes. "
    f"&nbsp;<b>2.</b> Parcels leave under Coliaty&rsquo;s spelling, not ours: "
    f"{len(A['wireDivergence'])} cities are stored under a different display name and are translated "
    f"at the wire. &nbsp;<b>3.</b> The remaining gaps are in data Coliaty holds and we do not — "
    f"{UNPLACED} destinations have no position, {SUSPECT} sit more than {THRESHOLD}&#8202;km from their "
    f"hub&rsquo;s centre, and {A['traffic']['leads']['unresolvedReasons'][0][1]['distinct']} Arabic-script "
    f"entries cannot be matched at all.", ACCENT_SOFT, ACCENT))
story.append(Spacer(1, 10))

key_cells = []
for i, hub in enumerate(PLACEMENT, 1):
    name = hub["hub"].replace("HUB ", "").replace("Hub ", "")
    bad = (f' <font face="Courier-Bold" size="6" color="#AE3327">{hub["suspects"]}</font>'
           if hub["suspects"] else "")
    key_cells.append(Paragraph(
        f'<font face="Courier-Bold" size="6.4" color="#14717C">{i}</font>'
        f'&nbsp;&nbsp;<font size="7">{esc(name)}</font>'
        f'<font face="Courier" size="6" color="#8496A2"> {hub["total"]}</font>{bad}', S_CELL))
for i, hub in enumerate(shown_hub_sites(), 1):
    key_cells.append(Paragraph(
        f'<font face="Courier-Bold" size="6.4" color="#9A6114">{chr(64 + i)}</font>'
        f'&nbsp;&nbsp;<font size="7" color="#9A6114">{esc(hub["name"])}</font>'
        f'<font face="Courier" size="6" color="#8496A2"> +{hub["covers"]}</font>', S_CELL))

key_tbl = Table([[c] for c in key_cells], colWidths=[54 * mm])
key_tbl.setStyle(TableStyle([
    ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ("TOPPADDING", (0, 0), (-1, -1), 1.1),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 1.1),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
]))

# The map and its key sit side by side rather than stacked: Morocco is roughly
# as tall as it is wide once longitude is corrected for latitude, so a
# full-width plot would be all margin, and the key fills that margin exactly.
hero = Table([[
    CoveragePlot(112 * mm, 124 * mm),
    Table([
        [Paragraph('<font face="Courier" size="6.2" color="#8496A2">TODAY&rsquo;S HUBS &amp; PROPOSED SITES</font>', S_CELL)],
        [key_tbl],
        [Paragraph(
            'Hubs read: number, hub, <font face="Courier" size="6">cities served</font>, '
            '<font face="Courier-Bold" size="6" color="#AE3327">flagged</font>.<br/>'
            'Sites read: letter, site, '
            '<font face="Courier" size="6" color="#9A6114">towns brought in</font>.', S_CELL_SM)],
    ], colWidths=[54 * mm], style=TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 1), (-1, 1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 4), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, 0), 0.4, RULE),
    ]))
]], colWidths=[116 * mm, 58 * mm])
hero.setStyle(TableStyle([
    ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
]))
story.append(hero)
story.append(Spacer(1, 5))
story.append(Paragraph(
    'Grey dots are served cities within tolerance and red dots are served cities sitting more than '
    f'{THRESHOLD}&#8202;km from their hub&rsquo;s median centre. Hollow amber rings are cities we are '
    'proposing. Numbered teal crosshairs are today&rsquo;s hubs; lettered amber squares are proposed hub '
    f'sites, each drawn with the {PROPOSALS["hubRadiusKm"]}&#8202;km radius it would cover.', S_CELL_SM))

story.append(PageBreak())

# ================================================================== page 2
# How a typed name becomes a Coliaty destination.

story.append(Paragraph("How a typed name becomes a Coliaty destination", S_H2))
story.append(Paragraph(
    "A city reaches us from a landing page, a Shopify or YouCan webhook, a CSV import or a call-centre "
    "agent typing it by hand. All four go through the same four passes, in this order. The first pass "
    "that answers wins, and each pass is deliberately narrower than the one before it.", S_BODY))
story.append(Spacer(1, 7))

LADDER = [
    ("1", "Clean", "Strip integration noise",
     "A trailing country qualifier is removed &mdash; <font face='Courier' size='7'>&ldquo;Agadir, Morocco&rdquo;</font>, "
     "<font face='Courier' size='7'>&ldquo;Casablanca - Maroc&rdquo;</font> &mdash; and whitespace is collapsed.",
     "&mdash;"),
    ("2", "Slug", "Exact match on a normalised key",
     "Lowercased, unaccented, punctuation and spaces removed. Spaces go rather than collapse because the "
     "separator is the least reliable part of a Moroccan name: <font face='Courier' size='7'>El Jadida</font>, "
     "<font face='Courier' size='7'>El-Jadida</font> and <font face='Courier' size='7'>Eljadida</font> are all "
     "in live data and must land on one row.",
     f"{A['roundTrip']['via'].get('slug', 0)}"),
    ("3", "Alias", "Look the key up in the spelling dictionary",
     f"{T['aliases']} recorded variants point at a canonical row &mdash; the carrier&rsquo;s own spellings, "
     "OpenStreetMap&rsquo;s, and spellings first seen in our own order history.",
     f"{A['roundTrip']['via'].get('alias', 0)}"),
    ("4", "Fuzzy", "Edit distance, with tolerance scaled to length",
     "Nothing for a name of 5 characters or fewer, one edit up to 9, two beyond that. A flat threshold "
     "turns <font face='Courier' size='7'>Saka</font> into <font face='Courier' size='7'>Safi</font>, so short "
     "names get no tolerance at all.",
     f"{A['roundTrip']['via'].get('fuzzy', 0)}"),
]
rows = [head_row(["", "Pass", "Rule", "Why it is shaped that way", "Carrier names resolved here"])]
for n, name, rule, why, hits in LADDER:
    rows.append([
        Paragraph(f'<font face="Courier" size="7" color="#8496A2">{n}</font>', S_CELL),
        Paragraph(f'<b>{name}</b>', S_CELL),
        Paragraph(f'<font size="7.6">{rule}</font>', S_CELL),
        Paragraph(f'<font size="7.2" color="#4A5C69">{why}</font>', S_CELL_SM),
        Paragraph(f'<font face="Courier-Bold" size="8">{hits}</font>', S_CELL),
    ])
story.append(table(rows, [6 * mm, 15 * mm, 40 * mm, 87 * mm, 26 * mm],
                   extra=[("ALIGN", (4, 0), (4, -1), "RIGHT")]))
story.append(Spacer(1, 10))

story.append(banner(
    "<b>The fuzzy pass is switched off at the wire.</b> It exists to guess what a human meant while an "
    "order is still being edited, where a wrong guess is visible and correctable. On dispatch we match "
    "on the exact key only: a guess there would route a parcel to a hub that cannot serve it, and a "
    "silently misrouted parcel is worse than one Coliaty rejects by name. Anything unresolved is sent "
    "through untouched, so a city this cannot improve behaves exactly as it did before.",
    FLAG_SOFT, FLAG))
story.append(Spacer(1, 11))

story.append(Paragraph("The wire rule: parcels leave under Coliaty&rsquo;s spelling", S_H2))
story.append(Paragraph(
    f"OpenStreetMap gives us the accented French form and Coliaty ships plain ASCII, so the two sides name "
    f"the same place differently by design. <b>{len(A['wireDivergence'])} of the {T['carrierDistinct']} "
    f"destinations</b> are stored under a display name that is not the carrier&rsquo;s "
    f"({len([w for w in A['wireDivergence'] if not w['caseOnly']])} differ by more than letter case). Every "
    f"one is translated back to <font face='Courier' size='8'>city_name</font> verbatim at hand-over, "
    f"alongside <font face='Courier' size='8'>city_id</font>. A sample:", S_BODY))
story.append(Spacer(1, 6))

sample = [w for w in A["wireDivergence"] if not w["caseOnly"]][:16]
rows = [head_row(["Shown to the operator", "Sent to Coliaty", "city_id", "code", "Hub"])]
for w in sample:
    rows.append([
        Paragraph(f'<font size="7.6">{esc(w["ourName"])}</font>', S_CELL),
        Paragraph(f'<font face="Courier-Bold" size="7.4" color="#14717C">{esc(w["carrierName"])}</font>', S_CELL),
        Paragraph(f'<font face="Courier" size="7">{w["cityId"]}</font>', S_CELL),
        Paragraph(f'<font face="Courier" size="7" color="#4A5C69">{esc(w["code"])}</font>', S_CELL),
        Paragraph(f'<font size="7" color="#4A5C69">{esc((w["hub"] or "").replace("HUB ", "").replace("Hub ", ""))}</font>', S_CELL),
    ])
story.append(table(rows, [50 * mm, 50 * mm, 20 * mm, 22 * mm, 32 * mm], pad=2.8))
story.append(Paragraph(
    f'{len(A["wireDivergence"]) - len(sample)} further translations are applied and not listed here; the '
    f'full mapping is in the directory at the back, column <i>Sent to Coliaty</i>.', S_CELL_SM))

story.append(PageBreak())

# ================================================================== page 3
# The evidence.

story.append(Paragraph("Evidence that the matching holds", S_H2))
story.append(Paragraph(
    "Three independent checks. The first asks whether we hold every destination; the second whether the "
    "carrier&rsquo;s own spelling comes back out as the same id it went in as; the third whether that "
    "survives the shapes a city field actually arrives in.", S_BODY))
story.append(Spacer(1, 8))

story.append(Paragraph("1 &nbsp;Catalogue linkage", S_H3))
story.append(Spacer(1, 4))
L = A["linkage"]
story.append(stat_strip([
    stat(f"{L['linked']}/{L['total']}", "destinations held on our side", "#1B6B4A"),
    stat(f"{L['hubMatches']}/{L['total']}", "on the same hub as Coliaty", "#1B6B4A"),
    stat(f"{L['codeMatches']}/{L['total']}", "carrying the same city code", "#1B6B4A"),
    stat(f"{len(L['broken'])}", "unresolved discrepancies", "#1B6B4A" if not L["broken"] else "#AE3327"),
]))
story.append(Spacer(1, 10))

story.append(Paragraph("2 &nbsp;Round trip", S_H3))
story.append(Paragraph(
    f"Each of the {A['roundTrip']['total']} names in Coliaty&rsquo;s catalogue was pushed back through the "
    f"same resolver a live order uses, and checked to land on the row carrying that "
    f"<font face='Courier' size='8'>city_id</font>. "
    f"<b>{A['roundTrip']['correct']} of {A['roundTrip']['total']} returned to the id they started from</b> "
    f"&mdash; {A['roundTrip']['via'].get('slug', 0)} on the exact key, "
    f"{A['roundTrip']['via'].get('alias', 0)} through the alias dictionary, and none needing the fuzzy pass.",
    S_BODY))
story.append(Spacer(1, 10))

story.append(Paragraph("3 &nbsp;The shapes a city field actually arrives in", S_H3))
story.append(Paragraph(
    "Every carrier name was re-tested under each distortion below, derived from what live data contains: "
    "checkout forms that shout, exports that strip accents, integrations that append the country, agents "
    "who omit spaces, and ordinary one-key typos.", S_BODY))
story.append(Spacer(1, 6))

ORDER = ["verbatim", "uppercase", "lowercase", "accents stripped", "country appended",
         "padded / doubled spaces", "separators changed", "spaces removed", "one letter dropped"]
EXAMPLE = {
    "verbatim": "Ait Meloul", "uppercase": "AIT MELOUL", "lowercase": "ait meloul",
    "accents stripped": "Kenitra (from K&eacute;nitra)", "country appended": "Ait Meloul, Maroc",
    "padded / doubled spaces": "&nbsp;&nbsp;Ait&nbsp;&nbsp;Meloul&nbsp;&nbsp;", "separators changed": "Ait-Meloul",
    "spaces removed": "AitMeloul", "one letter dropped": "Ait Melul",
}
rows = [head_row(["Input shape", "Example", "Resolved to the right destination", "Rate"])]
extra = []
for i, kind in enumerate(ORDER, 1):
    b = A["stress"]["byKind"][kind]
    pct = 100.0 * b["correct"] / b["total"]
    full = b["correct"] == b["total"]
    rows.append([
        Paragraph(f'<font size="7.8">{kind}</font>', S_CELL),
        Paragraph(f'<font face="Courier" size="7" color="#4A5C69">{EXAMPLE[kind]}</font>', S_CELL),
        Paragraph(f'<font face="Courier-Bold" size="8" color="{"#1B6B4A" if full else "#9A6114"}">'
                  f'{b["correct"]} / {b["total"]}</font>', S_CELL),
        Paragraph(f'<font face="Courier" size="7.6" color="{"#1B6B4A" if full else "#9A6114"}">{pct:.1f}%</font>', S_CELL),
    ])
    if not full:
        extra.append(("BACKGROUND", (0, i), (-1, i), GROW_SOFT))
story.append(table(rows, [42 * mm, 56 * mm, 42 * mm, 34 * mm], extra=extra))
story.append(Spacer(1, 5))
story.append(banner(
    f"The typo row is the one deliberate shortfall. Tolerance scales with name length and is zero at five "
    f"characters or fewer, so <font face='Courier' size='7.6'>Saka</font> is never quietly corrected into "
    f"<font face='Courier' size='7.6'>Safi</font>. That costs "
    f"{A['stress']['byKind']['one letter dropped']['total'] - A['stress']['byKind']['one letter dropped']['correct']} "
    f"of {A['stress']['byKind']['one letter dropped']['total']} single-letter typos, which surface to an "
    f"agent as an unrecognised city rather than as a parcel sent to the wrong town.", BAND, INK_3))
story.append(Spacer(1, 11))

story.append(Paragraph("4 &nbsp;Against live traffic, not test data", S_H3))
story.append(Spacer(1, 4))
tr = A["traffic"]
rows = [head_row(["Source", "Rows", "Distinct spellings", "Resolved to a locality", "Of those, deliverable"])]
for label, key in [("Orders handed to Coliaty", "orders"), ("Leads captured", "leads")]:
    d = tr[key]
    rows.append([
        Paragraph(f'<font size="7.8">{label}</font>', S_CELL),
        Paragraph(f'<font face="Courier" size="7.4">{d["rows"]:,}</font>', S_CELL),
        Paragraph(f'<font face="Courier" size="7.4">{d["distinct"]:,}</font>', S_CELL),
        Paragraph(f'<font face="Courier-Bold" size="7.6" color="#1B6B4A">{d["resolvedRows"]:,} '
                  f'({100.0 * d["resolvedRows"] / max(d["rows"], 1):.1f}%)</font>', S_CELL),
        Paragraph(f'<font face="Courier" size="7.4">{d["deliverableRows"]:,}</font>', S_CELL),
    ])
story.append(table(rows, [52 * mm, 24 * mm, 32 * mm, 40 * mm, 26 * mm]))
story.append(Spacer(1, 6))

reasons = tr["leads"]["unresolvedReasons"]
story.append(Paragraph(
    f"The {tr['leads']['unresolvedDistinct']} lead spellings that did not resolve break down as "
    + ", ".join(f"<b>{r[1]['distinct']} {r[0]}</b>" for r in reasons)
    + ". Only the first is a gap worth closing, and closing it needs data Coliaty holds — see the "
      "requests overleaf.", S_BODY))

story.append(PageBreak())

# ================================================================== page 4
# Findings in Coliaty's catalogue.

story.append(Paragraph("What we found in the catalogue", S_H2))
story.append(Paragraph(
    "Three findings, in the order they cost Coliaty money. None of them break dispatch today — our side "
    "absorbs all three — but each is cheaper to fix at source than to keep absorbing.", S_BODY))
story.append(Spacer(1, 8))

story.append(Paragraph(f"Finding 1 &nbsp;&mdash;&nbsp; {len(A['duplicateGroups'])} places published twice", S_H3))
story.append(Paragraph(
    f"The catalogue returns {T['carrierPublished']} rows for {T['carrierDistinct']} distinct destinations. "
    f"{len(A['duplicateGroups'])} places carry two <font face='Courier' size='8'>city_id</font>s each. Both ids "
    f"in every pair sit in the same hub, which is why this is a housekeeping item and not a routing risk: "
    f"whichever id a parcel carries, it reaches the same hub. We link one id per place and ignore the "
    f"other; if Coliaty retires the id we kept, those parcels start failing.", S_BODY))
story.append(Spacer(1, 6))

rows = [head_row(["Place", "First entry", "Second entry", "Hub", "Same hub"])]
for g in A["duplicateGroups"]:
    e = g["entries"]
    rows.append([
        Paragraph(f'<font size="7.8"><b>{esc(g["name"])}</b></font>', S_CELL),
        Paragraph(f'<font face="Courier" size="7">#{e[0]["cityId"]}</font> '
                  f'<font size="7" color="#4A5C69">{esc(e[0]["name"])} [{esc(e[0]["code"])}]</font>', S_CELL),
        Paragraph(f'<font face="Courier" size="7">#{e[1]["cityId"]}</font> '
                  f'<font size="7" color="#4A5C69">{esc(e[1]["name"])} [{esc(e[1]["code"])}]</font>', S_CELL),
        Paragraph(f'<font size="7" color="#4A5C69">{esc(e[0]["hub"].replace("HUB ", "").replace("Hub ", ""))}</font>', S_CELL),
        Paragraph(f'<font face="Courier" size="7" color="{"#1B6B4A" if g["sameHub"] else "#AE3327"}">'
                  f'{"yes" if g["sameHub"] else "NO"}</font>', S_CELL),
    ])
story.append(table(rows, [30 * mm, 48 * mm, 48 * mm, 30 * mm, 18 * mm], pad=2.8))
story.append(Spacer(1, 11))

story.append(Paragraph(f"Finding 2 &nbsp;&mdash;&nbsp; the catalogue carries no coordinates", S_H3))
story.append(Paragraph(
    f"Coliaty publishes a name, a code and a hub for each city, and no position. We geocode all "
    f"{T['carrierDistinct']} names ourselves to place them on a map and to check they sit near the hub "
    f"that serves them &mdash; {A['geoSources'][0][1]:,} came from OpenStreetMap, "
    f"{[g for g in A['geoSources'] if g[0] == 'nominatim'][0][1]} needed a name-only geocoder lookup, and "
    f"<b>{UNPLACED} destinations still have no position at all</b>. A geocoder answers confidently for the "
    f"wrong town, so every city is measured against the <b>median</b> position of its hub &mdash; a hub "
    f"serves a compact area, and a city far from its siblings is usually misplaced. "
    f"<b>{SUSPECT} sit more than {THRESHOLD}&#8202;km out.</b>", S_BODY))
story.append(Spacer(1, 6))

story.append(banner(
    "<b>Distance is a prompt, not a verdict.</b> Some flagged cities are genuinely remote &mdash; Dakhla "
    "really is 650&#8202;km from the Laayoune hub. Others are plainly wrong: <b>Inzegane</b> is plotted on "
    "Casablanca&rsquo;s coordinates when Inezgane borders Agadir. We resolve each by hand today. One "
    "latitude/longitude column in the catalogue would remove the guesswork for every one of them.",
    FLAG_SOFT, FLAG))
story.append(Spacer(1, 8))

worst = sorted(
    [(h["hub"], c) for h in PLACEMENT for c in h["cities"]
     if c["distanceKm"] is not None and c["distanceKm"] > THRESHOLD],
    key=lambda r: -r[1]["distanceKm"])[:12]
rows = [head_row(["City", "Sent as", "Hub", "From centre", "Coordinates", "Source"])]
for hub_name, c in worst:
    rows.append([
        Paragraph(f'<font size="7.6">{esc(c["name"])}</font>', S_CELL),
        Paragraph(f'<font face="Courier" size="6.8" color="#4A5C69">{esc(c["coliatyName"])}</font>', S_CELL),
        Paragraph(f'<font size="7">{esc(hub_name.replace("HUB ", "").replace("Hub ", ""))}</font>', S_CELL),
        Paragraph(f'<font face="Courier-Bold" size="7.6" color="#AE3327">{c["distanceKm"]} km</font>', S_CELL),
        Paragraph(f'<font face="Courier" size="6.8">{c["latitude"]:.4f}, {c["longitude"]:.4f}</font>', S_CELL),
        Paragraph(f'<font face="Courier" size="6.8" color="#8496A2">{c["geoSource"] or "&mdash;"}</font>', S_CELL),
    ])
story.append(table(rows, [36 * mm, 34 * mm, 28 * mm, 22 * mm, 34 * mm, 20 * mm], pad=2.6))
story.append(Paragraph(
    f'The {SUSPECT - len(worst)} remaining flagged cities and all {UNPLACED} unplaced ones are marked in '
    f'the directory at the back.', S_CELL_SM))
story.append(Spacer(1, 11))

story.append(Paragraph("Finding 3 &nbsp;&mdash;&nbsp; no Arabic spelling is published", S_H3))
arabic = [r for r in reasons if r[0] == "arabic script"]
n_ar = arabic[0][1]["distinct"] if arabic else 0
rows_ar = arabic[0][1]["rows"] if arabic else 0
story.append(Paragraph(
    f"The catalogue is Latin-script only. Customers on Moroccan landing pages type Arabic, and "
    f"<b>{n_ar} distinct Arabic-script entries across {rows_ar} leads</b> cannot be matched to a "
    f"destination — the single largest unresolved category, ahead of both junk input and misspellings. "
    f"These are not obscure places: they are Marrakech, F&egrave;s, Tetouan, Oujda, Casablanca, Sal&eacute; "
    f"and Nador, all of which Coliaty already serves. We hold Arabic names for OpenStreetMap rows, but a "
    f"deliverable city has nothing authoritative to match against.", S_BODY))
story.append(Spacer(1, 5))
story.append(banner(
    f"The Arabic entries themselves are not reproduced here &mdash; the base PDF fonts have no Arabic "
    f"glyphs and no right-to-left shaping, so printing them would produce disconnected, reversed letters. "
    f"They are in the audit data and can be sent as a plain list. What matters is the shape of the gap: "
    f"one <font face='Courier' size='7.6'>city_name_ar</font> column would resolve all {rows_ar} of them.",
    BAND, INK_3))

story.append(PageBreak())

# ================================================================== page 5
# The asks.

story.append(Paragraph("What we are asking Coliaty for", S_H2))
story.append(Paragraph(
    "Two kinds of request. The first is coverage — cities and hubs, set out over the next two pages. "
    "The second is catalogue data: six fields and one endpoint that would close gaps we cannot close from "
    "our side at any effort. Each row below is justified by a number measured in this report, not by "
    "preference.", S_BODY))
story.append(Spacer(1, 8))

ASKS = [
    ("Coordinates per city",
     "<font face='Courier' size='7'>latitude</font>, <font face='Courier' size='7'>longitude</font> on each catalogue row",
     f"We geocode all {T['carrierDistinct']} names ourselves. {UNPLACED} still have no position and "
     f"{SUSPECT} sit more than {THRESHOLD}km from their hub&rsquo;s centre, each needing a manual call. "
     f"Coliaty already knows where its own destinations are."),
    ("Hub centre coordinates",
     "<font face='Courier' size='7'>hub_latitude</font>, <font face='Courier' size='7'>hub_longitude</font>",
     f"Our hub centres are inferred as the median of each hub&rsquo;s members, which is a workaround. It is "
     f"also what every distance in this report is measured from, including the {SUSPECT} flags."),
    ("Arabic city names",
     "<font face='Courier' size='7'>city_name_ar</font>",
     f"{n_ar} distinct Arabic-script entries across {rows_ar} leads cannot be matched today. All of them "
     f"are cities Coliaty already serves."),
    ("Deduplicated ids",
     "one <font face='Courier' size='7'>city_id</font> per place, or a canonical flag",
     f"{len(A['duplicateGroups'])} places are published under two ids each. We keep one and ignore the "
     f"other; if the one we kept is retired, those parcels fail."),
    ("Trimmed, consistent fields",
     "no leading/trailing spaces, one casing convention for <font face='Courier' size='7'>city_code</font>",
     "Names arrive with trailing spaces and codes arrive in mixed case, so every consumer has to normalise "
     "before comparing. It is a one-line fix at source and a permanent class of bug downstream."),
    ("A versioned catalogue endpoint",
     "<font face='Courier' size='7'>updated_at</font> + a change webhook",
     f"Our copy is a dated snapshot. Nothing tells us when a city is added, renamed or retired, and "
     f"{len(A['wireDivergence'])} destinations already depend on an exact carrier spelling &mdash; an "
     f"unseen rename becomes a rejected parcel."),
    ("Documented, per-account rate limits",
     "a published quota keyed to the account rather than the IP",
     "The limit is undocumented and enforced per IP, answering 429 with a temporary block. We carry "
     "exponential backoff with jitter, a global pause, request coalescing and a label cache purely to stay "
     "under an unknown ceiling."),
]
rows = [head_row(["Request", "Field or endpoint", "What in this report justifies it"])]
for name, field, why in ASKS:
    rows.append([
        Paragraph(f'<b><font size="8">{name}</font></b>', S_CELL),
        Paragraph(f'<font size="7.2" color="#14717C">{field}</font>', S_CELL),
        Paragraph(f'<font size="7.4" color="#4A5C69">{why}</font>', S_CELL_SM),
    ])
story.append(table(rows, [38 * mm, 48 * mm, 88 * mm], pad=4))
story.append(Spacer(1, 12))

story.append(Paragraph("Hub sites we are proposing", S_H2))
story.append(Paragraph(
    f"Every town in the growth list was measured to the nearest existing hub centre. "
    f"{PROPOSALS['counts']['newHub']} of them are further than {PROPOSALS['extensionKm']}&#8202;km from any "
    f"hub, which puts them beyond an extended run. Grouping those by what a single site within "
    f"{PROPOSALS['hubRadiusKm']}&#8202;km could cover gives the list below — lettered to match the map on "
    f"page 1. <b>Orders</b> counts destinations in that cluster our customers have already asked for and we "
    f"could not serve.", S_BODY))
story.append(Spacer(1, 7))

rows = [head_row(["", "Proposed site", "Towns it brings in", "Orders already asked for",
                  "Nearest existing hub", "Distance"])]
extra = []
for i, h in enumerate(shown_hub_sites(), 1):
    rows.append([
        Paragraph(f'<font face="Courier-Bold" size="7" color="#9A6114">{chr(64 + i)}</font>', S_CELL),
        Paragraph(f'<b><font size="8">{esc(h["name"])}</font></b><br/>'
                  f'<font face="Courier" size="6.2" color="#8496A2">'
                  f'{h["latitude"]:.4f}, {h["longitude"]:.4f}</font>', S_CELL),
        Paragraph(f'<font face="Courier-Bold" size="8">{h["covers"]}</font>'
                  f'<font size="6.6" color="#8496A2"> &nbsp;'
                  + esc(", ".join(c["name"] for c in h["cities"][:4])) + '</font>', S_CELL),
        Paragraph(f'<font face="Courier-Bold" size="8" color="{"#9A6114" if h["demandRows"] else "#8496A2"}">'
                  f'{h["demandRows"]}</font>', S_CELL),
        Paragraph(f'<font size="7.2">{esc(h["nearestExistingHub"].replace("HUB ", "").replace("Hub ", ""))}</font>', S_CELL),
        Paragraph(f'<font face="Courier" size="7.4">{h["kmFromNearestHub"]} km</font>', S_CELL),
    ])
    if h["demandRows"]:
        extra.append(("BACKGROUND", (0, i), (-1, i), GROW_SOFT))
story.append(table(rows, [7 * mm, 34 * mm, 62 * mm, 24 * mm, 27 * mm, 20 * mm],
                   extra=extra + [("ALIGN", (3, 0), (5, -1), "RIGHT")], pad=3.2))
story.append(Spacer(1, 5))
story.append(Paragraph(
    f'Sites covering a single town with no orders behind them are not listed as hub proposals — they '
    f'are cheaper to serve by extending the nearest hub, and appear in the city table overleaf instead.',
    S_CELL_SM))

story.append(PageBreak())

# ================================================================== page 6
# Cities proposed.

story.append(Paragraph("Cities we are proposing for the catalogue", S_H2))
story.append(Paragraph(
    f"{len(PROPOSALS['cities'])} localities Coliaty does not currently list, drawn from the "
    f"{T['nonDeliverable']:,} non-deliverable rows we hold and filtered to real settlements &mdash; "
    f"OpenStreetMap cities and towns, plus villages and suburbs somebody has actually tried to order to. "
    f"Villages without demand are excluded on purpose: a douar is served through the town beside it, not "
    f"by its own catalogue entry.", S_BODY))
story.append(Spacer(1, 9))

story.append(stat_strip([
    stat(f"{PROPOSALS['counts']['absorb']}", f"within {PROPOSALS['serveableKm']} km — catalogue row", "#1B6B4A"),
    stat(f"{PROPOSALS['counts']['extend']}", f"{PROPOSALS['serveableKm']}–{PROPOSALS['extensionKm']} km — extend a run", "#9A6114"),
    stat(f"{PROPOSALS['counts']['newHub']}", f"beyond {PROPOSALS['extensionKm']} km — new site", "#AE3327"),
    stat(f"{PROPOSALS['counts']['withDemand']}", "already asked for", "#9A6114"),
]))
story.append(Spacer(1, 10))

story.append(banner(
    f"<b>The first column is the ask that costs nothing.</b> {PROPOSALS['counts']['absorb']} of these towns "
    f"sit within {PROPOSALS['serveableKm']}&#8202;km of a hub centre Coliaty already operates — inside "
    f"the working radius of vans that pass them today. Adding them is a catalogue row, not a route. We can "
    f"supply coordinates, French and Arabic names and OpenStreetMap ids for every one.",
    ACCENT_SOFT, ACCENT))
story.append(Spacer(1, 11))

TIER_LABEL = {"absorb": ("catalogue row only", GOOD, "#1B6B4A"),
              "extend": ("extend a run", GROW, "#9A6114"),
              "newHub": ("needs a site", FLAG, "#AE3327")}

story.append(Paragraph("Ordered by demand, then by how close the nearest hub already is", S_H3))
story.append(Spacer(1, 5))

rows = [head_row(["", "City", "Type", "Nearest hub", "Distance", "What it needs", "Orders"])]
extra = []
listed = PROPOSALS["cities"][:64]
for i, c in enumerate(listed, 1):
    label, _, hexcol = TIER_LABEL[c["tier"]]
    rows.append([
        Paragraph(f'<font face="Courier" size="6.6" color="#8496A2">{i}</font>', S_CELL),
        Paragraph(f'<font size="7.6">{esc(c["name"])}</font>', S_CELL),
        Paragraph(f'<font size="6.6" color="#8496A2">{esc(c["placeType"] or "&mdash;")}</font>', S_CELL),
        Paragraph(f'<font size="7">{esc(c["nearestHub"].replace("HUB ", "").replace("Hub ", ""))}</font>', S_CELL),
        Paragraph(f'<font face="Courier" size="7.2">{c["distanceKm"]} km</font>', S_CELL),
        Paragraph(f'<font size="6.8" color="{hexcol}">{label}</font>', S_CELL),
        Paragraph(f'<font face="Courier-Bold" size="7.2" color="{"#9A6114" if c["demandRows"] else "#CFD9DE"}">'
                  f'{c["demandRows"] or "&mdash;"}</font>', S_CELL),
    ])
    if c["demandRows"]:
        extra.append(("BACKGROUND", (0, i), (-1, i), GROW_SOFT))
story.append(table(rows, [7 * mm, 44 * mm, 20 * mm, 28 * mm, 20 * mm, 34 * mm, 16 * mm],
                   extra=extra + [("ALIGN", (4, 0), (4, -1), "RIGHT"), ("ALIGN", (6, 0), (6, -1), "RIGHT")],
                   pad=2.4))
story.append(Spacer(1, 4))
story.append(Paragraph(
    f'{len(PROPOSALS["cities"]) - len(listed)} further proposed cities are held in the audit data and can '
    f'be supplied as a spreadsheet or through the API in whatever shape Coliaty prefers.', S_CELL_SM))

story.append(PageBreak())

# ================================================================== page 7+
# Reference directory.

story.append(Paragraph("Reference: every destination, hub by hub", S_H2))
story.append(Paragraph(
    f"All {T['carrierDistinct']} destinations, with the identifiers we hold for each and the name each "
    f"parcel leaves under. Within a hub, cities are ordered by distance from the hub&rsquo;s median centre, "
    f"so anything worth a second look sits at the top of its section. Rows tinted red sit beyond "
    f"{THRESHOLD}&#8202;km; rows tinted sand have no coordinates yet.", S_BODY))
story.append(Spacer(1, 8))

for hub in PLACEMENT:
    bits = [f'{hub["total"]} cities']
    if hub["unplaced"]:
        bits.append(f'{hub["unplaced"]} unplaced')
    flag_txt = (f'<font face="Courier-Bold" size="7.5" color="#AE3327">{hub["suspects"]} TO CHECK</font>'
                if hub["suspects"] else
                '<font face="Courier" size="7.5" color="#1B6B4A">CLEAN</font>')

    hdr = Table([[
        Paragraph(f'<b>{esc(hub["hub"])}</b>', S_H3),
        Paragraph(f'<font face="Courier" size="7.5" color="#8496A2">{" · ".join(bits)}</font>', S_CELL),
        Paragraph(flag_txt, S_CELL),
    ]], colWidths=[90 * mm, 50 * mm, 34 * mm])
    hdr.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), ACCENT_SOFT),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("ALIGN", (2, 0), (2, 0), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))

    rows = [head_row(["City", "Sent to Coliaty", "city_id", "code", "From centre", "Coordinates", "Source"])]
    body_style = []
    for idx, city in enumerate(hub["cities"], 1):
        d = city["distanceKm"]
        flagged = d is not None and d > THRESHOLD
        if city["latitude"] is None:
            coord = '<font face="Courier" size="6.6" color="#AE3327">no coordinates</font>'
            dist = '<font face="Courier" size="6.8" color="#8496A2">&mdash;</font>'
        else:
            coord = f'<font face="Courier" size="6.6">{city["latitude"]:.4f}, {city["longitude"]:.4f}</font>'
            colour = "#AE3327" if flagged else "#4A5C69"
            face = "Courier-Bold" if flagged else "Courier"
            dist = f'<font face="{face}" size="7" color="{colour}">{d} km</font>'
        rows.append([
            Paragraph(f'<font size="7.4">{esc(city["name"])}</font>', S_CELL),
            Paragraph(f'<font face="Courier" size="6.8" color="#14717C">{esc(city["coliatyName"])}</font>', S_CELL),
            Paragraph(f'<font face="Courier" size="6.6">{city["coliatyCityId"] or "&mdash;"}</font>', S_CELL),
            Paragraph(f'<font face="Courier" size="6.6" color="#4A5C69">{esc(city["coliatyCode"])}</font>', S_CELL),
            Paragraph(dist, S_CELL),
            Paragraph(coord, S_CELL),
            Paragraph(f'<font face="Courier" size="6.4" color="#8496A2">{city["geoSource"] or "&mdash;"}</font>', S_CELL),
        ])
        if flagged:
            body_style.append(("BACKGROUND", (0, idx), (-1, idx), FLAG_SOFT))
        elif city["latitude"] is None:
            body_style.append(("BACKGROUND", (0, idx), (-1, idx), colors.HexColor("#FBF3E8")))

    t = Table(rows, colWidths=[38 * mm, 36 * mm, 15 * mm, 17 * mm, 17 * mm, 30 * mm, 21 * mm], repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BAND),
        ("LINEBELOW", (0, 0), (-1, 0), 0.4, RULE),
        ("LINEBELOW", (0, 1), (-1, -1), 0.25, colors.HexColor("#EDF1F3")),
        ("ALIGN", (4, 0), (4, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 2.2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2),
    ] + body_style))

    # Keep the hub header attached to at least the first rows of its table.
    story.append(KeepTogether([hdr, Spacer(1, 0)]))
    story.append(t)
    story.append(Spacer(1, 9))

# ---------------------------------------------------------------- build

doc = BaseDocTemplate(
    OUT, pagesize=A4,
    leftMargin=18 * mm, rightMargin=18 * mm,
    topMargin=20 * mm, bottomMargin=18 * mm,
    title="Coliaty city matching, placement and coverage audit",
    author="Silacod",
    subject=f"{A['linkage']['linked']} of {T['carrierDistinct']} Coliaty destinations matched; "
            f"{len(PROPOSALS['cities'])} cities and {len(shown_hub_sites())} hub sites proposed",
)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main",
              leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
doc.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=page_chrome)])
doc.build(story)

print(f"wrote {OUT} ({os.path.getsize(OUT) / 1024:.1f} KB)")

if MIRROR:
    import shutil
    shutil.copyfile(OUT, MIRROR)
    print(f"mirrored to {MIRROR}")

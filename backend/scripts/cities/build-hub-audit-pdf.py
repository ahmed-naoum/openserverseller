"""
Renders the hub audit (data/hub-audit.json) as a printable report.

Structure follows how the report is actually used: the cities that need a
decision come first, the full per-hub listing is reference behind them.

Usage:
    python scripts/cities/build-hub-audit-pdf.py [output.pdf]
"""
import json
import math
import os
import sys
from datetime import date

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Flowable, Frame, KeepTogether, NextPageTemplate,
    PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle,
)

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIT = os.path.join(HERE, "data", "hub-audit.json")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "data", "hub-audit.pdf")

# Chart-ink palette: quiet slate ground, teal for structure, red reserved
# entirely for "this needs a decision" so it never competes for attention.
INK = colors.HexColor("#14202A")
INK_2 = colors.HexColor("#4A5C69")
INK_3 = colors.HexColor("#8496A2")
RULE = colors.HexColor("#CFD9DE")
ACCENT = colors.HexColor("#14717C")
ACCENT_SOFT = colors.HexColor("#E4F0F1")
FLAG = colors.HexColor("#AE3327")
FLAG_SOFT = colors.HexColor("#F8E7E4")
BAND = colors.HexColor("#F4F7F8")

MONO = "Courier"
MONO_B = "Courier-Bold"
SANS = "Helvetica"
SANS_B = "Helvetica-Bold"

with open(AUDIT, encoding="utf-8") as fh:
    audit = json.load(fh)

THRESHOLD = audit["threshold"]
HUBS = audit["hubs"]


def latin(text):
    """
    Drops scripts the PDF base fonts cannot draw.

    A few OSM names carry the Arabic or Tifinagh spelling alongside the Latin one
    ("Goulmane كولمان"). Helvetica has no glyphs for those, so they come out as
    solid black boxes; and even with an embedded Arabic face ReportLab does no
    RTL shaping, which would render the letters disconnected and reversed. Since
    the Latin half of the string says the same thing, it is the half we keep.
    """
    if not text:
        return text
    # Latin-1 plus Latin Extended-A/B covers every accent in Moroccan place
    # names — Témara, Aït Melloul, Al Hoceïma.
    kept = "".join(ch for ch in text if ord(ch) <= 0x024F)
    return " ".join(kept.split()) or text


for _hub in HUBS:
    for _city in _hub["cities"]:
        _city["name"] = latin(_city["name"])
        if _city.get("coliatyName"):
            _city["coliatyName"] = latin(_city["coliatyName"])

TOTAL = sum(h["total"] for h in HUBS)
SUSPECT = sum(h["suspects"] for h in HUBS)
UNPLACED = sum(h["unplaced"] for h in HUBS)


# ----------------------------------------------------------------- the map

class MoroccoPlot(Flowable):
    """
    Every deliverable city plotted by position, with each flagged city tied back
    to its hub centre by a hairline.

    The point of drawing it at all is that a mis-geocoded city produces a long
    line straight across the country — far quicker to spot than a distance in a
    table.
    """

    def __init__(self, width, height):
        super().__init__()
        self.width = width
        self.height = height

        pts = [(c[1], c[2]) for h in HUBS for c in
               [(x["name"], x["latitude"], x["longitude"]) for x in h["cities"]]
               if c[1] is not None]
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

        # Leaders first so the dots sit on top of them.
        c.setStrokeColor(FLAG)
        c.setLineWidth(0.35)
        c.setDash(1.5, 1.5)
        for hub in HUBS:
            if not hub["centre"]:
                continue
            hx, hy = self.px(hub["centre"]["lon"]), self.py(hub["centre"]["lat"])
            for city in hub["cities"]:
                d = city["distanceKm"]
                if city["latitude"] is None or d is None or d <= THRESHOLD:
                    continue
                c.line(hx, hy, self.px(city["longitude"]), self.py(city["latitude"]))
        c.setDash()

        for hub in HUBS:
            for city in hub["cities"]:
                if city["latitude"] is None:
                    continue
                d = city["distanceKm"]
                flagged = d is not None and d > THRESHOLD
                c.setFillColor(FLAG if flagged else colors.HexColor("#9DAEB8"))
                c.circle(self.px(city["longitude"]), self.py(city["latitude"]),
                         1.9 if flagged else 1.1, stroke=0, fill=1)

        # Hubs are numbered rather than named on the plot: eighteen names in the
        # northern cluster overlap into an unreadable smear, and the key below
        # the map carries the names without fighting for space.
        for i, hub in enumerate(HUBS, 1):
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


# -------------------------------------------------------------- page frame

def page_chrome(canvas, doc):
    canvas.saveState()
    w, h = A4

    canvas.setFont(MONO, 6.5)
    canvas.setFillColor(INK_3)
    canvas.drawString(18 * mm, h - 12 * mm, "COLIATY DELIVERY NETWORK  ·  CITY PLACEMENT AUDIT")
    canvas.drawRightString(w - 18 * mm, h - 12 * mm, date.today().isoformat())
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.4)
    canvas.line(18 * mm, h - 14 * mm, w - 18 * mm, h - 14 * mm)

    canvas.line(18 * mm, 14 * mm, w - 18 * mm, 14 * mm)
    canvas.setFont(MONO, 6.5)
    canvas.drawString(18 * mm, 10 * mm,
                      f"{TOTAL} cities · {len(HUBS)} hubs · {SUSPECT} beyond {THRESHOLD}km")
    canvas.drawRightString(w - 18 * mm, 10 * mm, f"{doc.page}")
    canvas.restoreState()


styles = getSampleStyleSheet()


def style(name, **kw):
    base = dict(name=name, fontName=SANS, fontSize=9, leading=12.5,
                textColor=INK, alignment=TA_LEFT)
    base.update(kw)
    return ParagraphStyle(**base)


S_EYEBROW = style("eyebrow", fontName=MONO, fontSize=7, leading=10, textColor=INK_3)
S_TITLE = style("title", fontName=SANS_B, fontSize=21, leading=25, spaceAfter=4)
S_LEDE = style("lede", fontSize=9.5, leading=14, textColor=INK_2)
S_H2 = style("h2", fontName=SANS_B, fontSize=12, leading=15, spaceBefore=2, spaceAfter=5)
S_H3 = style("h3", fontName=SANS_B, fontSize=9.5, leading=12, textColor=ACCENT)
S_BODY = style("body", fontSize=9, leading=13, textColor=INK_2)
S_CELL = style("cell", fontSize=8, leading=10)
S_CELL_SM = style("cellsm", fontSize=7.4, leading=9.4, textColor=INK_2)
S_NOTE = style("note", fontSize=8.4, leading=12, textColor=INK_2)

story = []

# ------------------------------------------------------------------ cover

story.append(Paragraph("COLIATY DELIVERY NETWORK", S_EYEBROW))
story.append(Paragraph("Which cities sit where their hub says they should", S_TITLE))
story.append(Spacer(1, 3))
story.append(Paragraph(
    "A hub covers a compact service area, so a city plotted far from the rest of its hub is "
    "usually a geocoding mistake rather than a real outlier. Distances are measured from each "
    "hub&rsquo;s <b>median</b> position, so a few already-wrong cities cannot drag the reference "
    "point toward themselves.", S_LEDE))
story.append(Spacer(1, 11))

stat_data = [[
    Paragraph(f'<font size="17"><b>{TOTAL}</b></font><br/><font size="7.5" color="#8496A2">deliverable cities</font>', S_CELL),
    Paragraph(f'<font size="17"><b>{len(HUBS)}</b></font><br/><font size="7.5" color="#8496A2">hubs</font>', S_CELL),
    Paragraph(f'<font size="17" color="#AE3327"><b>{SUSPECT}</b></font><br/><font size="7.5" color="#8496A2">beyond {THRESHOLD}km from centre</font>', S_CELL),
    Paragraph(f'<font size="17"><b>{UNPLACED}</b></font><br/><font size="7.5" color="#8496A2">no coordinates yet</font>', S_CELL),
]]
stat_tbl = Table(stat_data, colWidths=[43 * mm] * 4)
stat_tbl.setStyle(TableStyle([
    ("BOX", (0, 0), (-1, -1), 0.5, RULE),
    ("INNERGRID", (0, 0), (-1, -1), 0.5, RULE),
    ("BACKGROUND", (0, 0), (-1, -1), colors.white),
    ("LEFTPADDING", (0, 0), (-1, -1), 9),
    ("TOPPADDING", (0, 0), (-1, -1), 8),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
]))
story.append(stat_tbl)
story.append(Spacer(1, 12))

story.append(Paragraph(
    "<b>Distance is a prompt, not a verdict.</b> Some flagged cities are genuinely remote &mdash; "
    "Dakhla really is 650&#8202;km from the Laayoune hub, and Figuig really is out on the Algerian "
    "border. Others are plainly wrong: <b>Inzegane</b> is plotted on Casablanca&rsquo;s coordinates "
    "when Inezgane borders Agadir. Each one needs a human call.", S_NOTE))
story.append(Spacer(1, 12))

story.append(MoroccoPlot(174 * mm, 132 * mm))
story.append(Spacer(1, 4))
story.append(Paragraph(
    "Grey dots are cities within tolerance; red dots are flagged. Numbered crosshairs mark each "
    "hub&rsquo;s median centre, and every dashed line runs from a hub to one of its outliers.",
    S_CELL_SM))
story.append(Spacer(1, 6))

# Key for the numbered crosshairs, three columns so it stays on the cover.
key_cells = []
for i, hub in enumerate(HUBS, 1):
    name = hub["hub"].replace("HUB ", "").replace("Hub ", "")
    bad = (f' <font face="Courier-Bold" size="6" color="#AE3327">{hub["suspects"]}</font>'
           if hub["suspects"] else "")
    key_cells.append(Paragraph(
        f'<font face="Courier-Bold" size="6.4" color="#14717C">{i}</font>'
        f'&nbsp;&nbsp;<font size="7">{name}</font>'
        f'<font face="Courier" size="6" color="#8496A2"> {hub["total"]}</font>{bad}', S_CELL))

rows_needed = (len(key_cells) + 2) // 3
key_rows = [[key_cells[r], key_cells[r + rows_needed] if r + rows_needed < len(key_cells) else "",
             key_cells[r + rows_needed * 2] if r + rows_needed * 2 < len(key_cells) else ""]
            for r in range(rows_needed)]
key_tbl = Table(key_rows, colWidths=[58 * mm] * 3)
key_tbl.setStyle(TableStyle([
    ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ("TOPPADDING", (0, 0), (-1, -1), 1.2),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 1.2),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
]))
story.append(key_tbl)
story.append(Spacer(1, 3))
story.append(Paragraph(
    'Each entry reads: number, hub, <font face="Courier" size="6.6">cities</font>, '
    '<font face="Courier-Bold" size="6.6" color="#AE3327">flagged</font>.', S_CELL_SM))

story.append(PageBreak())

# --------------------------------------------------- part 1: needs a decision

story.append(Paragraph("Cities to check", S_H2))
story.append(Paragraph(
    f"All {SUSPECT} cities sitting more than {THRESHOLD}&#8202;km from their hub&rsquo;s centre, "
    "worst first. <b>Source</b> is where the coordinates came from &mdash; <font face='Courier' size='8'>nominatim</font> "
    "results are the likelier mistakes, since that lookup only had a name to work from.", S_BODY))
story.append(Spacer(1, 7))

flagged_rows = []
for hub in HUBS:
    for city in hub["cities"]:
        d = city["distanceKm"]
        if d is not None and d > THRESHOLD:
            flagged_rows.append((hub["hub"], city, d))
flagged_rows.sort(key=lambda r: -r[2])

head = ["", "City", "Hub", "Distance", "Coordinates", "Source"]
data = [[Paragraph(f'<font face="Courier" size="6.6" color="#8496A2">{h.upper()}</font>', S_CELL) for h in head]]

for i, (hub_name, city, d) in enumerate(flagged_rows, 1):
    name = city["name"]
    if city.get("coliatyName") and city["coliatyName"] != name:
        name += f'<br/><font size="6.4" color="#8496A2">carrier: {city["coliatyName"]}</font>'
    data.append([
        Paragraph(f'<font face="Courier" size="7" color="#8496A2">{i}</font>', S_CELL),
        Paragraph(name, S_CELL),
        Paragraph(f'<font size="7.4">{hub_name.replace("HUB ", "").replace("Hub ", "")}</font>', S_CELL),
        Paragraph(f'<font face="Courier-Bold" size="8" color="#AE3327">{d} km</font>', S_CELL),
        Paragraph(f'<font face="Courier" size="7">{city["latitude"]:.4f}, {city["longitude"]:.4f}</font>', S_CELL),
        Paragraph(f'<font face="Courier" size="7" color="#4A5C69">{city["geoSource"] or "—"}</font>', S_CELL),
    ])

tbl = Table(data, colWidths=[7 * mm, 45 * mm, 30 * mm, 20 * mm, 40 * mm, 20 * mm], repeatRows=1)
tstyle = [
    ("BACKGROUND", (0, 0), (-1, 0), BAND),
    ("LINEBELOW", (0, 0), (-1, 0), 0.5, RULE),
    ("LINEBELOW", (0, 1), (-1, -1), 0.25, colors.HexColor("#E8EEF0")),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("ALIGN", (3, 0), (3, -1), "RIGHT"),
    ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ("TOPPADDING", (0, 0), (-1, -1), 3.5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
]
for r in range(1, len(data)):
    if r % 2 == 0:
        tstyle.append(("BACKGROUND", (0, r), (-1, r), colors.HexColor("#FBFCFC")))
tbl.setStyle(TableStyle(tstyle))
story.append(tbl)

story.append(PageBreak())

# ------------------------------------------------------ part 2: every hub

story.append(Paragraph("Every hub, city by city", S_H2))
story.append(Paragraph(
    "Full reference listing. Within each hub, cities are ordered by distance from the hub centre, "
    "so anything worth a second look sits at the top of its section.", S_BODY))
story.append(Spacer(1, 8))

for hub in HUBS:
    block = []
    bits = [f'{hub["total"]} cities']
    if hub["unplaced"]:
        bits.append(f'{hub["unplaced"]} unplaced')
    tally = " · ".join(bits)
    flag_txt = (f'<font face="Courier-Bold" size="7.5" color="#AE3327">{hub["suspects"]} TO CHECK</font>'
                if hub["suspects"] else
                '<font face="Courier" size="7.5" color="#8496A2">CLEAN</font>')

    hdr = Table([[
        Paragraph(f'<b>{hub["hub"]}</b>', S_H3),
        Paragraph(f'<font face="Courier" size="7.5" color="#8496A2">{tally}</font>', S_CELL),
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
    block.append(hdr)

    rows = [[Paragraph(f'<font face="Courier" size="6.4" color="#8496A2">{h}</font>', S_CELL)
             for h in ["CITY", "FROM CENTRE", "COORDINATES", "SOURCE"]]]
    body_style = []
    for idx, city in enumerate(hub["cities"], 1):
        d = city["distanceKm"]
        flagged = d is not None and d > THRESHOLD
        if city["latitude"] is None:
            coord = '<font face="Courier" size="6.8" color="#AE3327">no coordinates</font>'
            dist = '<font face="Courier" size="7" color="#8496A2">&mdash;</font>'
        else:
            coord = f'<font face="Courier" size="6.8">{city["latitude"]:.4f}, {city["longitude"]:.4f}</font>'
            colour = "#AE3327" if flagged else "#4A5C69"
            face = "Courier-Bold" if flagged else "Courier"
            dist = f'<font face="{face}" size="7.2" color="{colour}">{d} km</font>'
        rows.append([
            Paragraph(f'<font size="7.6">{city["name"]}</font>', S_CELL),
            Paragraph(dist, S_CELL),
            Paragraph(coord, S_CELL),
            Paragraph(f'<font face="Courier" size="6.6" color="#8496A2">{city["geoSource"] or "—"}</font>', S_CELL),
        ])
        if flagged:
            body_style.append(("BACKGROUND", (0, idx), (-1, idx), FLAG_SOFT))
        elif city["latitude"] is None:
            body_style.append(("BACKGROUND", (0, idx), (-1, idx), colors.HexColor("#FBF3E8")))

    t = Table(rows, colWidths=[66 * mm, 24 * mm, 50 * mm, 34 * mm], repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BAND),
        ("LINEBELOW", (0, 0), (-1, 0), 0.4, RULE),
        ("LINEBELOW", (0, 1), (-1, -1), 0.25, colors.HexColor("#EDF1F3")),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 2.4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.4),
    ] + body_style))
    block.append(t)
    block.append(Spacer(1, 9))

    # Keep the hub header attached to at least the first rows of its table.
    story.append(KeepTogether(block[:1] + [Spacer(1, 0)]))
    story.append(block[1])
    story.append(block[2])

# ---------------------------------------------------------------- build

doc = BaseDocTemplate(
    OUT, pagesize=A4,
    leftMargin=18 * mm, rightMargin=18 * mm,
    topMargin=20 * mm, bottomMargin=18 * mm,
    title="Coliaty hub audit — city placement review",
    author="Silacod",
    subject=f"{SUSPECT} of {TOTAL} deliverable cities sit beyond {THRESHOLD}km from their hub centre",
)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main",
              leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
doc.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=page_chrome)])
doc.build(story)

print(f"wrote {OUT} ({os.path.getsize(OUT) / 1024:.1f} KB)")

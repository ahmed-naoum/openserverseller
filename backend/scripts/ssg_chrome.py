"""
Shared page chrome, palette and diagram flowables for the SSG explainer PDF.

Deliberately mirrors backend/scripts/cities/build-coliaty-audit-pdf.py so the two
documents read as the same series: mono eyebrows, slate ground, teal for
structure, red only where a decision is required, amber for "changes behaviour".
"""
import math

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Flowable, Paragraph, Table, TableStyle

# ------------------------------------------------------------------ palette

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
GOOD_SOFT = colors.HexColor("#E3F0EA")
BAND = colors.HexColor("#F4F7F8")
HAIR = colors.HexColor("#E8EEF0")

MONO, MONO_B = "Courier", "Courier-Bold"
SANS, SANS_B, SANS_I = "Helvetica", "Helvetica-Bold", "Helvetica-Oblique"


def esc(text):
    """Paragraph markup is XML; code excerpts are full of & < >."""
    if text is None:
        return ""
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def style(name, **kw):
    base = dict(name=name, fontName=SANS, fontSize=9, leading=12.5,
                textColor=INK, alignment=TA_LEFT)
    base.update(kw)
    return ParagraphStyle(**base)


S_EYEBROW = style("eyebrow", fontName=MONO, fontSize=7, leading=10, textColor=INK_3)
S_TITLE = style("title", fontName=SANS_B, fontSize=20, leading=24, spaceAfter=4)
S_SUB = style("sub", fontName=SANS, fontSize=11, leading=15, textColor=INK_2)
S_LEDE = style("lede", fontSize=9.5, leading=14, textColor=INK_2)
S_H2 = style("h2", fontName=SANS_B, fontSize=12, leading=15, spaceBefore=2, spaceAfter=5)
S_H3 = style("h3", fontName=SANS_B, fontSize=9.5, leading=12, textColor=ACCENT,
             spaceBefore=3, spaceAfter=3)
S_BODY = style("body", fontSize=9, leading=13, textColor=INK_2)
S_CELL = style("cell", fontSize=8, leading=10)
S_CELL_SM = style("cellsm", fontSize=7.4, leading=9.4, textColor=INK_2)
S_NOTE = style("note", fontSize=8.4, leading=12, textColor=INK_2)
S_CODE = style("code", fontName=MONO, fontSize=7.2, leading=9.6, textColor=INK)
S_CODE_C = style("codec", fontName=MONO, fontSize=7.2, leading=9.6, textColor=INK_3)
S_CAPTION = style("caption", fontName=MONO, fontSize=6.6, leading=9, textColor=INK_3)


def head_row(labels):
    return [Paragraph(f'<font face="Courier" size="6.6" color="#8496A2">{h.upper()}</font>',
                      S_CELL) for h in labels]


def table(rows, widths, extra=None, zebra=True, pad=3.5):
    t = Table(rows, colWidths=widths, repeatRows=1)
    ts = [
        ("BACKGROUND", (0, 0), (-1, 0), BAND),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, RULE),
        ("LINEBELOW", (0, 1), (-1, -1), 0.25, HAIR),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
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


def callout(body, kind="note", width=None):
    """
    A single-cell tinted block. Used sparingly — one per page at most, or they
    stop meaning anything.
    """
    tint, edge = {
        "note": (BAND, RULE),
        "warn": (FLAG_SOFT, FLAG),
        "change": (GROW_SOFT, GROW),
        "good": (GOOD_SOFT, GOOD),
    }[kind]
    t = Table([[body]], colWidths=[width] if width else None)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), tint),
        ("LINEBEFORE", (0, 0), (0, -1), 2, edge),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return t


def code_block(lines, width, tint=colors.HexColor("#FAFBFC")):
    """Monospace excerpt. Lines beginning // or # render as comments."""
    rows = []
    for ln in lines:
        stripped = ln.strip()
        st = S_CODE_C if stripped.startswith(("//", "#", "--")) else S_CODE
        rows.append([Paragraph(esc(ln).replace(" ", "&nbsp;") or "&nbsp;", st)])
    t = Table(rows, colWidths=[width])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), tint),
        ("LINEBEFORE", (0, 0), (0, -1), 1.5, RULE),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 0.6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0.6),
        ("TOPPADDING", (0, 0), (-1, 0), 5),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 5),
    ]))
    return t


# ------------------------------------------------------------- flowables

class Waterfall(Flowable):
    """
    Two request timelines stacked on one shared time axis.

    The point the reader should take without reading a word: today the pixel bar
    starts near the right-hand edge, and after the change it starts hard against
    the left. Everything else on the chart is supporting detail.

    rows: list of (lane, label, start_s, dur_s, colour, note)
      lane 0 = "today", lane 1 = "compiled"
    """

    def __init__(self, width, rows, max_s, lane_titles, pixel_marks):
        super().__init__()
        self.width = width
        self.rows = rows
        self.max_s = max_s
        self.lane_titles = lane_titles
        self.pixel_marks = pixel_marks

        self.bar_h = 8.5
        self.gap = 3.2
        lanes = {}
        for lane, *_ in rows:
            lanes.setdefault(lane, 0)
            lanes[lane] += 1
        self.counts = lanes
        self.lane_h = {k: v * (self.bar_h + self.gap) + 20 for k, v in lanes.items()}
        self.height = sum(self.lane_h.values()) + 26

    def x_of(self, seconds):
        return self.pad_l + (seconds / self.max_s) * (self.width - self.pad_l - 6)

    pad_l = 74

    def draw(self):
        c = self.canv
        h = self.height

        # Time axis along the top, in seconds. Gridlines are the only thing
        # tying the two lanes together, so they run the full height.
        c.setFont(MONO, 5.8)
        step = 1 if self.max_s <= 8 else 2
        tick = 0
        while tick <= self.max_s:
            x = self.x_of(tick)
            c.setStrokeColor(colors.HexColor("#EDF2F4"))
            c.setLineWidth(0.3)
            c.line(x, 10, x, h - 12)
            c.setFillColor(INK_3)
            c.drawCentredString(x, h - 8, f"{tick}s")
            tick += step

        y = h - 20
        for lane_idx, title in enumerate(self.lane_titles):
            y -= 12
            c.setFont(MONO_B, 6.4)
            c.setFillColor(INK if lane_idx else INK_2)
            c.drawString(0, y, title.upper())
            title_w = c.stringWidth(title.upper(), MONO_B, 6.4)
            c.setStrokeColor(RULE)
            c.setLineWidth(0.4)
            c.line(0, y - 3.5, self.width, y - 3.5)
            lane_top = y - 3.5
            y -= 8

            for lane, label, start, dur, colour, note in self.rows:
                if lane != lane_idx:
                    continue
                x0 = self.x_of(start)
                x1 = self.x_of(start + dur)
                c.setFont(MONO, 5.9)
                c.setFillColor(INK_2)
                c.drawRightString(self.pad_l - 6, y - self.bar_h + 2.4, label)
                c.setFillColor(colour)
                c.roundRect(x0, y - self.bar_h, max(x1 - x0, 1.4), self.bar_h,
                            1.2, stroke=0, fill=1)
                if note:
                    c.setFont(MONO, 5.4)
                    c.setFillColor(INK_3)
                    c.drawString(x1 + 3, y - self.bar_h + 2.4, note)
                y -= self.bar_h + self.gap

            # The pixel moment: a dashed rule spanning the lane, labelled ON the
            # lane rule rather than beside the mark. Beside the mark the label
            # lands on top of whatever bar happens to be running at that instant
            # — which, in the compiled lane, is always the LCP image.
            mark = self.pixel_marks[lane_idx]
            if mark is not None:
                mx = self.x_of(mark)
                tone = FLAG if lane_idx == 0 else GOOD
                c.setStrokeColor(tone)
                c.setLineWidth(0.9)
                c.setDash(2, 1.6)
                c.line(mx, y + 4, mx, lane_top)
                c.setDash()
                c.setFillColor(tone)
                c.circle(mx, lane_top, 1.8, stroke=0, fill=1)
                c.setFont(MONO_B, 5.8)
                lbl = f"fbq PageView  {mark:g}s"
                lw = c.stringWidth(lbl, MONO_B, 5.8)
                # When the pixel fires almost immediately the mark sits under the
                # lane title, so the label goes on its own line above it. That
                # case is the whole result of the project — it must not collide.
                ly = lane_top + (11.5 if mx < title_w + 10 else 2.6)
                if mx + lw + 8 > self.width:
                    c.drawRightString(mx - 5, ly, lbl)
                else:
                    c.drawString(mx + 5, ly, lbl)
            y -= 6


class FlowDiagram(Flowable):
    """
    The compile/serve architecture as two lanes: what happens on save, and what
    happens on a visit. Drawn rather than described because the whole idea is
    that the expensive half runs once and the visit half touches almost nothing.

    nodes: list of (lane, col, label, sublabel, kind)
      kind: 'actor' | 'step' | 'store' | 'out'
    """

    def __init__(self, width, height, lanes, nodes, edges, notes=()):
        super().__init__()
        self.width, self.height = width, height
        self.lanes, self.nodes, self.edges, self.notes = lanes, nodes, edges, notes

    def box(self, col, lane, ncols):
        pad_l = 66
        avail = self.width - pad_l - 4
        w = avail / ncols
        lane_h = self.height / len(self.lanes)
        cx = pad_l + col * w + w / 2
        cy = self.height - (lane + 0.5) * lane_h
        return cx, cy, w - 12, 30

    def draw(self):
        c = self.canv
        ncols = max(n[1] for n in self.nodes) + 1
        lane_h = self.height / len(self.lanes)

        for i, (title, tint) in enumerate(self.lanes):
            top = self.height - i * lane_h
            c.setFillColor(tint)
            c.rect(0, top - lane_h + 2, self.width, lane_h - 4, stroke=0, fill=1)
            c.setFillColor(INK_3)
            c.setFont(MONO_B, 6.2)
            for j, word in enumerate(title.upper().split(" · ")):
                c.drawString(4, top - 12 - j * 8, word)

        style_of = {
            "actor": (colors.white, INK_2, INK),
            "step": (colors.white, ACCENT, ACCENT),
            "store": (ACCENT_SOFT, ACCENT, ACCENT),
            "out": (GOOD_SOFT, GOOD, GOOD),
            "skip": (colors.HexColor("#F2F4F5"), INK_3, INK_3),
        }

        pos = {}
        for lane, col, label, sublabel, kind in self.nodes:
            cx, cy, w, hh = self.box(col, lane, ncols)
            fill, edge, ink = style_of[kind]
            pos[(lane, col)] = (cx, cy, w, hh)
            c.setFillColor(fill)
            c.setStrokeColor(edge)
            c.setLineWidth(0.8)
            if kind == "store":
                c.roundRect(cx - w / 2, cy - hh / 2, w, hh, 5, stroke=1, fill=1)
            else:
                c.roundRect(cx - w / 2, cy - hh / 2, w, hh, 2, stroke=1, fill=1)
            c.setFillColor(ink)
            c.setFont(SANS_B, 6.8)
            c.drawCentredString(cx, cy + (2.5 if sublabel else -1), label)
            if sublabel:
                c.setFillColor(INK_3)
                c.setFont(MONO, 5.4)
                c.drawCentredString(cx, cy - 6.5, sublabel)

        for a, b, kind in self.edges:
            if a not in pos or b not in pos:
                continue
            ax, ay, aw, ah = pos[a]
            bx, by, bw, bh = pos[b]
            c.setStrokeColor(FLAG if kind == "miss" else ACCENT)
            c.setLineWidth(0.8)
            if kind == "miss":
                c.setDash(2, 1.6)
            if abs(ay - by) < 1:
                x0, x1 = ax + aw / 2, bx - bw / 2
                c.line(x0, ay, x1, ay)
                c.setFillColor(FLAG if kind == "miss" else ACCENT)
                c.setDash()
                p = c.beginPath()
                p.moveTo(x1, by)
                p.lineTo(x1 - 3.4, by + 2)
                p.lineTo(x1 - 3.4, by - 2)
                p.close()
                c.drawPath(p, stroke=0, fill=1)
            else:
                c.line(ax, ay - ah / 2, ax, by + bh / 2)
                c.setDash()
                c.setFillColor(FLAG if kind == "miss" else ACCENT)
                p = c.beginPath()
                p.moveTo(bx, by + bh / 2)
                p.lineTo(bx - 2, by + bh / 2 + 3.4)
                p.lineTo(bx + 2, by + bh / 2 + 3.4)
                p.close()
                c.drawPath(p, stroke=0, fill=1)
            c.setDash()


class SizeBars(Flowable):
    """
    Payload comparison. Log-ish is tempting but dishonest here — the whole story
    is the ratio, so the bars stay linear and the small one stays small.

    items: (label, bytes, colour, note)
    """

    def __init__(self, width, items, unit="KB", footnote=None):
        super().__init__()
        self.width = width
        self.items = items
        self.unit = unit
        self.footnote = footnote
        self.bar_h = 15
        self.height = len(items) * (self.bar_h + 11) + (12 if footnote else 4)

    def draw(self):
        c = self.canv
        pad_l = 96
        avail = self.width - pad_l - 74
        top = max(v for _, v, _, _ in self.items)
        y = self.height - self.bar_h - (12 if self.footnote else 0)

        for label, val, colour, note in self.items:
            w = (val / top) * avail
            c.setFont(MONO, 6.2)
            c.setFillColor(INK_2)
            c.drawRightString(pad_l - 8, y + 4.5, label)
            c.setFillColor(colour)
            # A sliver is the honest rendering, but below ~2.5pt it reads as a
            # rendering fault rather than as a number. Floor it and let the
            # footnote carry the "same scale" claim.
            c.roundRect(pad_l, y, max(w, 2.5), self.bar_h, 1.5, stroke=0, fill=1)
            c.setFont(MONO_B, 6.6)
            c.setFillColor(colour)
            shown = f"{val:,.0f} {self.unit}" if val >= 10 else f"{val:.1f} {self.unit}"
            c.drawString(pad_l + max(w, 2.5) + 5, y + 4.8, shown)
            if note:
                c.setFont(MONO, 5.4)
                c.setFillColor(INK_3)
                c.drawString(pad_l + max(w, 2.5) + 5 +
                             c.stringWidth(shown, MONO_B, 6.6) + 7, y + 4.8, note)
            y -= self.bar_h + 11

        if self.footnote:
            c.setFont(MONO, 5.6)
            c.setFillColor(INK_3)
            c.drawString(pad_l, 2, self.footnote)


class Rule(Flowable):
    """A hairline the width of the frame, for section breaks."""

    def __init__(self, width, colour=RULE, thickness=0.4, space=0):
        super().__init__()
        self.width, self.colour, self.thickness = width, colour, thickness
        self.height = thickness + space

    def draw(self):
        self.canv.setStrokeColor(self.colour)
        self.canv.setLineWidth(self.thickness)
        self.canv.line(0, 0, self.width, 0)

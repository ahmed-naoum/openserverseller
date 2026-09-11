import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_header_footer(num_pages)
            super().showPage()
        super().save()

    def draw_header_footer(self, page_count):
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#64748B"))

        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 750, "SILACOD.MA — PLATFORM SECURITY AUDIT & REMEDIATION PLAN")
            self.drawRightString(558, 750, "CONFIDENTIAL / INTERNAL")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(54, 742, 558, 742)

        # Footer
        self.setFont("Helvetica", 8)
        self.drawString(54, 35, "Generated on September 2026 | Deep Architecture & Static Code Analysis")
        self.drawRightString(558, 35, f"Page {self._pageNumber} of {page_count}")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(54, 47, 558, 47)
        self.restoreState()

def build_pdf(filename="../Silacod_Security_Audit_and_Hardening_Plan_2026.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=60,
        bottomMargin=55
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#EA580C"),
        spaceAfter=12
    )
    h1_style = ParagraphStyle(
        'H1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#0F172A"),
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )
    h2_style = ParagraphStyle(
        'H2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#1E293B"),
        spaceBefore=8,
        spaceAfter=3,
        keepWithNext=True
    )
    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#334155"),
        spaceAfter=5
    )
    code_style = ParagraphStyle(
        'Code',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=7.5,
        leading=10.5,
        textColor=colors.HexColor("#0F172A"),
        backColor=colors.HexColor("#F1F5F9"),
        borderColor=colors.HexColor("#E2E8F0"),
        borderWidth=0.5,
        borderPadding=5,
        spaceAfter=6,
        keepWithNext=True
    )

    story = []

    # Title Banner
    story.append(Paragraph("SILACOD.MA — PLATFORM SECURITY AUDIT", title_style))
    story.append(Paragraph("Codebase Vulnerability Analysis, Multi-Tenant Defense & Hardening Roadmap", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#EA580C"), spaceBefore=0, spaceAfter=12))

    # Executive Summary
    story.append(Paragraph("1. Executive Summary & Audit Overview", h1_style))
    story.append(Paragraph(
        "A comprehensive static code analysis, architectural review, and access-control security audit was conducted on the <b>Silacod (Vegas) COD E-Commerce Platform</b> codebase. "
        "The assessment surveyed 52 backend route controllers, authentication middleware, database queries, third-party webhook integrations, and multi-tenant isolation boundaries. "
        "The review identified <b>10 key vulnerabilities and architectural weaknesses</b> that require remediation to protect the platform from cross-tenant data leaks, authentication bypasses, webhook spoofing, and unauthorized configuration changes.",
        body_style
    ))

    # Summary Table
    summary_data = [
        [Paragraph("<b>Finding ID</b>", body_style), Paragraph("<b>Vulnerability Area</b>", body_style), Paragraph("<b>Severity</b>", body_style), Paragraph("<b>Target File(s)</b>", body_style)],
        ["SEC-01", "JWT Token Type Confusion & 2FA Bypass", "CRITICAL", "middleware/auth.ts"],
        ["SEC-02", "Cross-Tenant IDOR on Orders & Shipping Labels", "HIGH", "routes/order.routes.ts"],
        ["SEC-03", "BOLA / IDOR on Lead Details & Modifications", "HIGH", "routes/lead.routes.ts"],
        ["SEC-04", "Unauthenticated Webhook & Automated Stock/Status Mutation", "HIGH", "routes/webhook.routes.ts"],
        ["SEC-05", "Cross-Tenant Real-Time Financial & Order Data Leak (SSE)", "HIGH", "routes/webhook.routes.ts"],
        ["SEC-06", "SSRF & OAuth Secret Exfiltration in Shopify Token Exchange", "HIGH", "routes/shopify.routes.ts"],
        ["SEC-07", "Unauthenticated WooCommerce Key Overwrite (Account Hijack)", "HIGH", "routes/woocommerce.routes.ts"],
        ["SEC-08", "Shell Command Execution in Media Transcoder (convertToMp3)", "MEDIUM", "routes/upload.routes.ts"],
        ["SEC-09", "System User Password Injection in chpasswd Execution", "MEDIUM", "routes/admin.routes.ts"],
        ["SEC-10", "JWT Exposure via Query Parameters & Missing HSTS Headers", "LOW", "auth.ts, security.ts"]
    ]

    t_summary = Table(summary_data, colWidths=[65, 200, 75, 164])
    t_summary.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0F172A")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#FFFFFF"), colors.HexColor("#F8FAFC")]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('TEXTCOLOR', (2, 1), (2, 1), colors.HexColor("#DC2626")),
        ('TEXTCOLOR', (2, 2), (2, 7), colors.HexColor("#EA580C")),
        ('TEXTCOLOR', (2, 8), (2, 9), colors.HexColor("#D97706")),
        ('TEXTCOLOR', (2, 10), (2, 10), colors.HexColor("#2563EB")),
        ('FONTNAME', (2, 1), (2, -1), 'Helvetica-Bold'),
    ]))
    story.append(t_summary)
    story.append(Spacer(1, 10))

    # Detailed Findings
    story.append(Paragraph("2. Detailed Technical Findings & Root Cause Analysis", h1_style))

    # SEC-01
    story.append(Paragraph("<b>[SEC-01] Critical: JWT Token Type Confusion Allows 2FA & Password-Reset Bypass</b>", h2_style))
    story.append(Paragraph("<b>Affected Components:</b> <code>backend/src/middleware/auth.ts</code>, <code>backend/src/routes/auth.routes.ts</code>", body_style))
    story.append(Paragraph(
        "<b>Vulnerability Description:</b> The authentication middleware <code>authenticate()</code> verifies incoming tokens with <code>jwt.verify(token, JWT_SECRET)</code> without checking the token's <code>type</code> claim. "
        "When an account has 2FA enabled, <code>/auth/login</code> returns a temporary 2FA token (<code>{ userId, type: '2fa' }</code>) meant solely for <code>/auth/login/2fa</code>. "
        "Because <code>authenticate()</code> does not reject non-access token types, an attacker with this temporary token can supply it in the <code>Authorization: Bearer</code> header to access all authenticated endpoints without supplying the required 2FA code.",
        body_style
    ))
    story.append(Paragraph(
        "<b>Remediation:</b> In <code>authenticate()</code>, strictly reject any token where <code>decoded.type && decoded.type !== 'access'</code> with HTTP 401.",
        body_style
    ))
    story.append(Paragraph(
        "// Fix in backend/src/middleware/auth.ts\n"
        "const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; type?: string };\n"
        "if (decoded.type && decoded.type !== 'access') {\n"
        "  return res.status(401).json({ status: 'error', message: 'Invalid token type for authorization.' });\n"
        "}",
        code_style
    ))

    # SEC-02
    story.append(Paragraph("<b>[SEC-02] High: Insecure Direct Object Reference (IDOR) on Orders & Shipping Labels</b>", h2_style))
    story.append(Paragraph("<b>Affected Components:</b> <code>backend/src/routes/order.routes.ts</code> (Lines 221-235 & Lines 436-448)", body_style))
    story.append(Paragraph(
        "<b>Vulnerability Description:</b> In <code>GET /api/v1/orders/:id</code>, the filter <code>where.vendorId = req.user.id</code> is only applied when <code>req.user.roleName === 'VENDOR'</code>. Non-vendor accounts (e.g. Influencers, Grossellers, unconfirmed accounts) bypass this check and can inspect any order by numeric ID, exposing recipient full names, delivery addresses, phone numbers, and COD amounts. In addition, <code>GET /api/v1/orders/parcel/:code/label</code> allows any authenticated user to download any parcel label PDF without validating parcel ownership.",
        body_style
    ))
    story.append(Paragraph(
        "<b>Remediation:</b> Verify tenant ownership on <code>GET /:id</code> and <code>GET /parcel/:code/label</code> (ensure <code>order.vendorId === req.user.id</code> or an authorized helper/admin).",
        body_style
    ))

    # SEC-03
    story.append(Paragraph("<b>[SEC-03] High: Broken Object Level Authorization (BOLA) on Lead Management</b>", h2_style))
    story.append(Paragraph("<b>Affected Components:</b> <code>backend/src/routes/lead.routes.ts</code> (Lines 2248-2305 & Lines 3428-3450)", body_style))
    story.append(Paragraph(
        "<b>Vulnerability Description:</b> The lead detail endpoint <code>GET /api/v1/leads/:id/detail</code> checks call-center agent assignments, but does not verify vendor ownership. A vendor can inspect another vendor's lead by ID, exposing customer contact info, notes, and order history. In <code>PATCH /api/v1/leads/:id</code>, helper assignment scoping is not enforced, allowing helpers to modify leads across any vendor.",
        body_style
    ))
    story.append(Paragraph(
        "<b>Remediation:</b> Scope all lead queries and mutations with <code>vendorId: req.user.id</code> for vendors and verify <code>helperUserAssignment</code> for helpers.",
        body_style
    ))

    # SEC-04 & SEC-05
    story.append(Paragraph("<b>[SEC-04 & SEC-05] High: Unauthenticated Webhooks & Real-Time SSE Multi-Tenant Leak</b>", h2_style))
    story.append(Paragraph("<b>Affected Components:</b> <code>backend/src/routes/webhook.routes.ts</code>", body_style))
    story.append(Paragraph(
        "<b>Vulnerability Description:</b><br/>"
        "1. <b>Unauthenticated Webhook:</b> The Coliaty webhook (<code>POST /api/v1/webhook/coliaty</code>) does not require a secret token, HMAC signature, or IP whitelist. Anyone on the internet can POST synthetic events, altering order statuses to DELIVERED or CANCELED and triggering automated stock adjustments.<br/>"
        "2. <b>Cross-Tenant SSE Stream:</b> The real-time stream <code>GET /api/v1/webhook/stream</code> broadcasts global <code>status_update</code> events—containing order numbers, prices, courier fees, and net profits—to all connected users without vendor filtering.",
        body_style
    ))
    story.append(Paragraph(
        "<b>Remediation:</b> Protect the webhook endpoint with a pre-shared secret token. Filter SSE stream events to send only updates matching <code>data.vendorId === streamUser.id</code>.",
        body_style
    ))

    # SEC-06 & SEC-07
    story.append(Paragraph("<b>[SEC-06 & SEC-07] High: Integration SSRF & OAuth Callback Hijacking</b>", h2_style))
    story.append(Paragraph("<b>Affected Components:</b> <code>backend/src/routes/shopify.routes.ts</code>, <code>backend/src/routes/woocommerce.routes.ts</code>", body_style))
    story.append(Paragraph(
        "<b>Vulnerability Description:</b><br/>"
        "1. <b>Shopify OAuth SSRF:</b> In <code>POST /api/v1/shopify/token</code>, the domain parameter <code>shop</code> is accepted directly without regex validation. An attacker can specify an external host, causing the backend to POST the platform's <code>SHOPIFY_CLIENT_SECRET</code> to an arbitrary endpoint.<br/>"
        "2. <b>WooCommerce Public Callback:</b> <code>POST /api/v1/woocommerce/auth-callback</code> is an unauthenticated public route that overwrites a vendor's WooCommerce API credentials without verifying a signed one-time state token.",
        body_style
    ))
    story.append(Paragraph(
        "<b>Remediation:</b> Validate that Shopify shop domains match <code>/^[a-zA-Z0-9][a-zA-Z0-9\\-]*\\.myshopify\\.com$/</code>. Implement signed HMAC state verification for WooCommerce OAuth.",
        body_style
    ))

    # SEC-08 & SEC-09 & SEC-10
    story.append(Paragraph("<b>[SEC-08, SEC-09, SEC-10] Medium & Low: Shell Execution, Password Injection & Protocol Hygiene</b>", h2_style))
    story.append(Paragraph(
        "• <b>SEC-08 (Shell Execution):</b> In <code>upload.routes.ts</code>, <code>convertToMp3</code> invokes FFmpeg via <code>child_process.exec(cmd)</code> using a shell string. Replace with <code>execFile('ffmpeg', args)</code> to avoid shell interpolation.<br/>"
        "• <b>SEC-09 (Password Injection):</b> In <code>admin.routes.ts</code> (Line 4825), the professional email tool pipes <code>${username}:${password}\\n</code> into <code>chpasswd</code> without validating that the password contains no newlines or colons.<br/>"
        "• <b>SEC-10 (Query Token & HSTS):</b> In <code>middleware/auth.ts</code>, accepting JWTs via <code>req.query.token</code> risks token exposure in server logs. Enforce headers/cookies and enable <code>Strict-Transport-Security</code> (HSTS) in production.",
        body_style
    ))
    story.append(Spacer(1, 10))

    # Remediation Roadmap
    story.append(Paragraph("3. Remediation Action Plan & Hardening Milestones", h1_style))
    roadmap_data = [
        [Paragraph("<b>Phase</b>", body_style), Paragraph("<b>Target Actions & Milestones</b>", body_style), Paragraph("<b>Priority</b>", body_style), Paragraph("<b>Estimated Effort</b>", body_style)],
        [
            "Phase 1: Critical Hotfixes",
            "1. Patch JWT verification to block non-access token types.<br/>"
            "2. Enforce tenant ownership check on order details and shipping labels.<br/>"
            "3. Enforce vendorId scoping on lead details and helper lead edits.",
            "P0 (Immediate)",
            "1 - 2 Hours"
        ],
        [
            "Phase 2: Integration & Webhook Defense",
            "1. Secure /api/v1/webhook/coliaty with a shared secret / token.<br/>"
            "2. Scope SSE real-time updates to match vendorId.<br/>"
            "3. Add myshopify.com domain validation on Shopify OAuth.<br/>"
            "4. Add signed HMAC state verification to WooCommerce auth callback.",
            "P1 (High)",
            "2 - 3 Hours"
        ],
        [
            "Phase 3: System & Hygiene Hardening",
            "1. Migrate convertToMp3 from exec() to execFile().<br/>"
            "2. Sanitize chpasswd inputs against newline/colon characters.<br/>"
            "3. Disallow query param tokens in auth middleware and enforce HSTS.",
            "P2 (Next Sprint)",
            "1 - 2 Hours"
        ]
    ]

    t_roadmap = Table(roadmap_data, colWidths=[90, 249, 90, 75])
    t_roadmap.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1E293B")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor("#FFFFFF"), colors.HexColor("#F8FAFC")]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('TEXTCOLOR', (2, 1), (2, 1), colors.HexColor("#DC2626")),
        ('TEXTCOLOR', (2, 2), (2, 2), colors.HexColor("#EA580C")),
        ('TEXTCOLOR', (2, 3), (2, 3), colors.HexColor("#2563EB")),
        ('FONTNAME', (2, 1), (2, -1), 'Helvetica-Bold'),
    ]))
    story.append(t_roadmap)

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Audit PDF successfully created: {filename}")

if __name__ == '__main__':
    build_pdf()

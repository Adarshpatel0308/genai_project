from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
import io
import os
from datetime import datetime


BRAND_COLOR = colors.HexColor("#6C3FC5")
ACCENT_COLOR = colors.HexColor("#F59E0B")


def generate_pdf(title: str, sections: list, language: str = "en") -> bytes:
    """
    Generate a PDF report.
    sections: list of dicts with 'heading' and 'content' keys
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                            rightMargin=0.75*inch, leftMargin=0.75*inch,
                            topMargin=1*inch, bottomMargin=0.75*inch)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("Title", parent=styles["Title"],
                                  textColor=BRAND_COLOR, fontSize=20, spaceAfter=12)
    heading_style = ParagraphStyle("Heading", parent=styles["Heading2"],
                                    textColor=BRAND_COLOR, fontSize=13, spaceAfter=6)
    body_style = ParagraphStyle("Body", parent=styles["Normal"],
                                 fontSize=10, spaceAfter=4, leading=14)

    story = []

    # Header
    story.append(Paragraph("🌾 PRAGATI - Agriculture AI Platform", title_style))
    story.append(Paragraph(f"Report: {title}", heading_style))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%d %B %Y, %I:%M %p')} | Language: {language.upper()}", body_style))
    story.append(Spacer(1, 0.2*inch))

    # Divider
    story.append(Table([[""]], colWidths=[6.5*inch],
                        style=TableStyle([("LINEABOVE", (0,0), (-1,0), 2, BRAND_COLOR)])))
    story.append(Spacer(1, 0.1*inch))

    # Sections
    for section in sections:
        if section.get("heading"):
            story.append(Paragraph(section["heading"], heading_style))
        if section.get("content"):
            content = section["content"]
            if isinstance(content, str):
                for line in content.split("\n"):
                    if line.strip():
                        story.append(Paragraph(line.strip(), body_style))
            elif isinstance(content, list):
                for item in content:
                    story.append(Paragraph(f"• {item}", body_style))
            elif isinstance(content, dict):
                for k, v in content.items():
                    story.append(Paragraph(f"<b>{k}:</b> {v}", body_style))
        story.append(Spacer(1, 0.15*inch))

    # Footer
    story.append(Spacer(1, 0.3*inch))
    story.append(Table([[""]], colWidths=[6.5*inch],
                        style=TableStyle([("LINEABOVE", (0,0), (-1,0), 1, colors.grey)])))
    story.append(Paragraph("PRAGATI Platform | Empowering Indian Farmers with AI", 
                            ParagraphStyle("Footer", parent=styles["Normal"], 
                                           textColor=colors.grey, fontSize=8, alignment=TA_CENTER)))

    doc.build(story)
    return buffer.getvalue()

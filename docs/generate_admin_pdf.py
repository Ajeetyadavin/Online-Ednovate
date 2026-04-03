from pathlib import Path
import re

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

ROOT = Path(__file__).resolve().parent
md_path = ROOT / "Admin-Panel-User-Guide.md"
pdf_path = ROOT / "Admin-Panel-User-Guide.pdf"

text = md_path.read_text(encoding="utf-8")
lines = text.splitlines()

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="H1x", parent=styles["Heading1"], fontSize=16, leading=20, spaceAfter=8))
styles.add(ParagraphStyle(name="H2x", parent=styles["Heading2"], fontSize=13, leading=17, spaceBefore=6, spaceAfter=4))
styles.add(ParagraphStyle(name="Bodyx", parent=styles["BodyText"], fontSize=10.5, leading=14, alignment=TA_LEFT))
styles.add(ParagraphStyle(name="Bulletx", parent=styles["BodyText"], fontSize=10.5, leading=14, leftIndent=14))
styles.add(ParagraphStyle(name="Numberx", parent=styles["BodyText"], fontSize=10.5, leading=14, leftIndent=14))


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


story = []
for raw in lines:
    line = raw.rstrip()
    if not line.strip():
        story.append(Spacer(1, 6))
        continue

    if line.startswith("# "):
        story.append(Paragraph(esc(line[2:].strip()), styles["H1x"]))
        continue
    if line.startswith("## "):
        story.append(Paragraph(esc(line[3:].strip()), styles["H2x"]))
        continue
    if re.match(r"^\d+\.\s+", line):
        story.append(Paragraph(esc(line), styles["Numberx"]))
        continue
    if line.startswith("- "):
        story.append(Paragraph("• " + esc(line[2:].strip()), styles["Bulletx"]))
        continue

    story.append(Paragraph(esc(line), styles["Bodyx"]))


doc = SimpleDocTemplate(
    str(pdf_path),
    pagesize=A4,
    leftMargin=40,
    rightMargin=40,
    topMargin=40,
    bottomMargin=40,
)
doc.build(story)
print(f"Created: {pdf_path}")

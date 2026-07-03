import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

async function main() {
  const pdfPath = path.join(process.cwd(), 'templates/contrat-template.pdf');
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const page1 = pages[0];

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Draw lines every 50 points from Y=50 to Y=800
  for (let y = 50; y <= 800; y += 50) {
    page1.drawText(`y=${y}`, {
      x: 30,
      y: y,
      size: 8,
      font,
      color: rgb(1, 0, 0),
    });
    page1.drawLine({
      start: { x: 30, y: y },
      end: { x: 550, y: y },
      thickness: 0.5,
      color: rgb(1, 0.9, 0.9),
    });
  }

  // Also draw X markers every 50 points
  for (let x = 50; x <= 550; x += 50) {
    page1.drawText(`x=${x}`, {
      x: x,
      y: 810,
      size: 8,
      font,
      color: rgb(0, 0, 1),
    });
  }

  const outputPath = path.join(process.cwd(), 'uploads/test_p1_grid.pdf');
  fs.writeFileSync(outputPath, await pdfDoc.save());
  console.log('Grid PDF written successfully');
}

main().catch(console.error);

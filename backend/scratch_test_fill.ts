import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

async function main() {
  const pdfPath = path.join(process.cwd(), 'templates/contrat-template.pdf');
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  
  const page1 = pages[0];
  const page4 = pages[3];

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const data = {
    fullName: 'ABDERRAHIM CHAIB',
    cinNumber: 'JT82246',
    city: 'khribga',
    address: 'drarga tikiwin',
    ribAccount: '544684684685468458454658',
    date: '17/06/2026'
  };

  // Calibrated Page 1 - English Column
  page1.drawText(data.fullName, { x: 140, y: 513, size: 8, font: boldFont, color: rgb(0.1, 0.1, 0.3) });
  page1.drawText('Marocaine', { x: 55, y: 496, size: 8, font, color: rgb(0.1, 0.1, 0.3) });
  page1.drawText(data.cinNumber, { x: 55, y: 462, size: 8, font: boldFont, color: rgb(0.1, 0.1, 0.3) });
  
  // Address might need splitting if too long
  const addressText = `${data.address}, ${data.city}`;
  if (addressText.length > 35) {
    page1.drawText(addressText.substring(0, 35), { x: 55, y: 445, size: 8, font, color: rgb(0.1, 0.1, 0.3) });
    page1.drawText(addressText.substring(35), { x: 55, y: 428, size: 8, font, color: rgb(0.1, 0.1, 0.3) });
  } else {
    page1.drawText(addressText, { x: 55, y: 445, size: 8, font, color: rgb(0.1, 0.1, 0.3) });
  }

  // Calibrated Page 1 - Arabic Column (using French/Latin characters since Helvetica doesn't support Arabic)
  page1.drawText(data.fullName, { x: 380, y: 513, size: 8, font: boldFont, color: rgb(0.1, 0.1, 0.3) });
  page1.drawText('Marocaine', { x: 325, y: 496, size: 8, font, color: rgb(0.1, 0.1, 0.3) });
  page1.drawText(data.cinNumber, { x: 440, y: 479, size: 8, font: boldFont, color: rgb(0.1, 0.1, 0.3) });
  if (addressText.length > 35) {
    page1.drawText(addressText.substring(0, 35), { x: 325, y: 462, size: 8, font, color: rgb(0.1, 0.1, 0.3) });
    page1.drawText(addressText.substring(35), { x: 325, y: 445, size: 8, font, color: rgb(0.1, 0.1, 0.3) });
  } else {
    page1.drawText(addressText, { x: 325, y: 462, size: 8, font, color: rgb(0.1, 0.1, 0.3) });
  }

  // Calibrated Page 4
  page4.drawText(data.fullName, { x: 60, y: 735, size: 9, font: boldFont, color: rgb(0.1, 0.1, 0.3) });
  page4.drawText(data.fullName, { x: 115, y: 590, size: 9, font: boldFont, color: rgb(0.1, 0.1, 0.3) });
  page4.drawText(data.ribAccount, { x: 90, y: 570, size: 9, font: boldFont, color: rgb(0.1, 0.1, 0.3) });
  page4.drawText(data.date, { x: 140, y: 525, size: 9, font: boldFont, color: rgb(0.1, 0.1, 0.3) });
  page4.drawText(data.fullName, { x: 430, y: 480, size: 9, font: boldFont, color: rgb(0.1, 0.1, 0.3) });

  const outputPath = path.join(process.cwd(), 'uploads/test_contract_filled.pdf');
  fs.writeFileSync(outputPath, await pdfDoc.save());
  console.log('Calibrated PDF written successfully');
}

main().catch(console.error);

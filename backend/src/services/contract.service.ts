import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

interface ContractData {
  fullName: string;
  cinNumber: string;
  city: string;
  address: string;
  ribAccount: string;
  iceNumber?: string;
  date: string;
}

export async function generateContractPdf(data: ContractData): Promise<Buffer> {
  const templatePath = path.join(process.cwd(), 'templates/contrat-template.pdf');
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Contract template not found at ${templatePath}`);
  }

  const templateBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const pages = pdfDoc.getPages();
  
  // If the PDF is empty or missing pages, grab the first page or create one
  const page = pages[0] || pdfDoc.addPage();
  const { width, height } = page.getSize();

  // Load a standard font
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Page 1 - English Column
  page.drawText(data.fullName, { x: 115, y: 522, size: 8, font: boldFont, color: rgb(0.1, 0.1, 0.3) });
  page.drawText('Marocaine', { x: 75, y: 510, size: 8, font, color: rgb(0.1, 0.1, 0.3) });
  page.drawText(data.cinNumber, { x: 75, y: 483, size: 8, font: boldFont, color: rgb(0.1, 0.1, 0.3) });
  
  const addressText = `${data.address}, ${data.city}`;
  if (addressText.length > 35) {
    page.drawText(addressText.substring(0, 35), { x: 75, y: 470, size: 8, font, color: rgb(0.1, 0.1, 0.3) });
    page.drawText(addressText.substring(35), { x: 75, y: 470, size: 8, font, color: rgb(0.1, 0.1, 0.3) });
  } else {
    page.drawText(addressText, { x: 75, y: 470, size: 8, font, color: rgb(0.1, 0.1, 0.3) });
  }

  // Page 1 - Arabic Column (using Latin/French since standard Helvetica has no Arabic glyphs)
  page.drawText(data.fullName, { x: 360, y: 516, size: 8, font: boldFont, color: rgb(0.1, 0.1, 0.3) });
  page.drawText('Marocaine', { x: 450, y: 503, size: 8, font, color: rgb(0.1, 0.1, 0.3) });
  page.drawText(data.cinNumber, { x: 410, y: 490, size: 8, font: boldFont, color: rgb(0.1, 0.1, 0.3) });
  if (addressText.length > 35) {
    page.drawText(addressText.substring(0, 35), { x: 335, y: 477, size: 8, font, color: rgb(0.1, 0.1, 0.3) });
    page.drawText(addressText.substring(35), { x: 335, y: 477, size: 8, font, color: rgb(0.1, 0.1, 0.3) });
  } else {
    page.drawText(addressText, { x: 335, y: 477, size: 8, font, color: rgb(0.1, 0.1, 0.3) });
  }

  // Page 4 - Fill signature and contract execution details
  const page4 = pages[3];
  if (page4) {
    page4.drawText(data.fullName, { x: 320, y: 613, size: 7, font: boldFont, color: rgb(0.1, 0.1, 0.3) });
    page4.drawText(data.ribAccount, { x: 320, y: 597, size: 8, font: boldFont, color: rgb(0.1, 0.1, 0.3) });
    page4.drawText(data.fullName, { x: 124,  y: 588, size: 7, font: boldFont, color: rgb(0.1, 0.1, 0.3) });
    page4.drawText(data.ribAccount, { x: 120 , y: 571, size: 8, font: boldFont, color: rgb(0.1, 0.1, 0.3) });
    page4.drawText(data.date, { x: 200, y: 525, size: 9, font: boldFont, color: rgb(0.1, 0.1, 0.3) });
    page4.drawText(data.fullName, { x: 410, y: 480, size: 7, font: boldFont, color: rgb(0.1, 0.1, 0.3) });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

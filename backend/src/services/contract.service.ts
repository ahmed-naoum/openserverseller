import { PDFDocument, StandardFonts, rgb, PDFName } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

interface ContractData {
  fullName: string;
  cinNumber: string;
  city: string;
  address: string;
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

  // Set Title to contrat.fin.silacod
  pdfDoc.setTitle('contrat.fin.silacod');

  // Strip unwanted metadata properties
  const infoDict = (pdfDoc as any).getInfoDict();
  if (infoDict) {
    infoDict.delete(PDFName.of('Author'));
    infoDict.delete(PDFName.of('Subject'));
    infoDict.delete(PDFName.of('Keywords'));
    infoDict.delete(PDFName.of('Creator'));
    infoDict.delete(PDFName.of('Producer'));
    infoDict.delete(PDFName.of('CreationDate'));
    infoDict.delete(PDFName.of('ModDate'));
  }

  const pages = pdfDoc.getPages();
  
  // If the PDF is empty or missing pages, grab the first page or create one
  const page = pages[0] || pdfDoc.addPage();

  // Load a standard font
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Clean address: strip trailing country names and truncate to 30 chars
  const cleanAddress = (text: string, maxLen = 70): string => {
    let cleaned = text
      .replace(/,?\s*(morocco|Morocco|maroc|Maroc|المغرب|MOROCCO|MAROC|algeria|Algeria|algérie|Algérie|dz|DZ|dzire|DZire)\s*/gi, '')
      .replace(/,\s*$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (cleaned.length > maxLen) {
      cleaned = cleaned.substring(0, maxLen).trimEnd() + '...';
    }
    return cleaned;
  };

  const rawAddress = data.address.trim().toLowerCase().endsWith(data.city.trim().toLowerCase())
    ? data.address
    : `${data.address}, ${data.city}`;
  const addressText = cleanAddress(rawAddress);

  const textColor = rgb(0.1, 0.1, 0.3);

  // ─── Page 1 - Left Column (French/English) ───
  page.drawText(data.fullName, { x: 150, y: 403, size: 12, font: boldFont, color: textColor });
  page.drawText('Marocaine', { x: 400, y: 403, size: 12, font, color: textColor });
  page.drawText(data.cinNumber, { x: 280, y: 385, size: 12, font: boldFont, color: textColor });
  page.drawText(addressText, { x: 60, y: 370, size: 12, font, color: textColor });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

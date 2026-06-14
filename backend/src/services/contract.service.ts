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

  // Let's overlay the user information box at the top or at a specific position
  // In the recette PDF, usually there's a place for user info. We will place it 
  // on the first page at a clean coordinate.
  page.drawRectangle({
    x: 40,
    y: height - 180,
    width: width - 80,
    height: 120,
    color: rgb(0.96, 0.97, 0.98),
    borderColor: rgb(0.9, 0.9, 0.9),
    borderWidth: 1,
  });

  page.drawText('INFORMATIONS CONTRACTANT / CONTRACTOR INFO', {
    x: 50,
    y: height - 85,
    size: 10,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });

  const lines = [
    `Nom Complet: ${data.fullName}`,
    `CIN: ${data.cinNumber}  |  Ville: ${data.city}`,
    `Adresse: ${data.address}`,
    `Compte Bancaire (RIB): ${data.ribAccount}`,
  ];

  if (data.iceNumber) {
    lines.push(`ICE: ${data.iceNumber}`);
  }
  lines.push(`Fait le: ${data.date}`);

  let y = height - 105;
  for (const line of lines) {
    page.drawText(line, {
      x: 50,
      y,
      size: 9,
      font,
      color: rgb(0.2, 0.2, 0.3),
    });
    y -= 14;
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

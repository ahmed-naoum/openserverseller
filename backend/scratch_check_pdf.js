const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

async function main() {
  const pdfBytes = fs.readFileSync('templates/contrat-template.pdf');
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  pages.forEach((page, i) => {
    console.log(`Page ${i + 1}:`, page.getSize());
  });
}

main().catch(console.error);

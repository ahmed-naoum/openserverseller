import { pdfToPng } from 'pdf-to-png-converter';
import path from 'path';
import fs from 'fs';

async function main() {
  const pdfPath = path.join(process.cwd(), 'templates/contrat-template.pdf');
  const outputDir = "C:\\Users\\Victus\\.gemini\\antigravity\\brain\\407e1ceb-7d93-4b1a-b26f-fa044f76bd21";
  
  const pngPages = await pdfToPng(pdfPath, {
    viewportScale: 2.0,
  });

  for (const page of pngPages) {
    const outputPath = path.join(outputDir, `page_${page.pageNumber}.png`);
    fs.writeFileSync(outputPath, page.content);
    console.log(`Saved page ${page.pageNumber} to ${outputPath}`);
  }
}

main().catch(console.error);

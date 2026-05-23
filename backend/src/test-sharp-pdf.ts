import sharp from 'sharp';
import fs from 'fs';

async function testSharpPdf() {
  try {
    const buffer = fs.readFileSync(process.argv[2]);
    const metadata = await sharp(buffer).metadata();
    console.log('Metadata:', metadata);
  } catch (err) {
    console.error('Sharp PDF failed:', err);
  }
}

testSharpPdf();

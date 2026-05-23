import fs from 'fs';
import path from 'path';
import { OcrService } from './services/ocr.service';

async function testOcr() {
  const imagePath = process.argv[2];
  if (!imagePath) {
    console.error('Please provide an image path');
    process.exit(1);
  }

  try {
    const buffer = fs.readFileSync(imagePath);
    console.log('Testing OCR on:', imagePath);
    const result = await OcrService.extractCinData(buffer);
    console.log('--- OCR RESULTS ---');
    console.log(JSON.stringify(result, null, 2));
    console.log('--- RAW TEXT ---');
    console.log(result.rawText);
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testOcr();

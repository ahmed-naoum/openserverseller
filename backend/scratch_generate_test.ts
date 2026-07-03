import { generateContractPdf } from './src/services/contract.service.ts';
import fs from 'fs';
import path from 'path';

async function main() {
  const data = {
    fullName: 'ABDERRAHIM CHAIB',
    cinNumber: 'JT82246',
    city: 'khribga',
    address: 'drarga tikiwin',
    ribAccount: '544684684685468458454658',
    date: '17/06/2026'
  };

  const buffer = await generateContractPdf(data);
  const outputPath = path.join(process.cwd(), 'uploads/test_contract.pdf');
  fs.writeFileSync(outputPath, buffer);
  console.log('Test contract PDF written to:', outputPath);
}

main().catch(console.error);

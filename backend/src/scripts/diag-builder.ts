/** Diagnostic: what the builder did on its last calls, and whether GPT is really configured. */
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../lib/prisma.js';
import { loadSecrets, getSource } from '../lib/secretStore.js';
import { openaiStatus } from '../services/openai.service.js';
import { getBuilderSettings, getBuilderStats, studioProviders } from '../services/designBrain.service.js';

async function main() {
  await loadSecrets();
  console.log('OPENAI_API_KEY source:', getSource('OPENAI_API_KEY'));
  console.log('openai status:', openaiStatus());
  console.log('settings:', await getBuilderSettings());
  console.log('providers:', JSON.stringify(await studioProviders()));
  console.log('stats:', await getBuilderStats());
  const dir = path.join(process.cwd(), 'uploads', 'opendesign');
  if (fs.existsSync(dir)) {
    for (const store of fs.readdirSync(dir)) {
      const files = fs.readdirSync(path.join(dir, store)).map((f) => `${f} (${Math.round(fs.statSync(path.join(dir, store, f)).size / 1024)} KB)`);
      console.log(`uploads/opendesign/${store}:`, files);
    }
  } else console.log('uploads/opendesign: none');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

import { loadSecrets } from '../lib/secretStore.js';
import { availableImageEngines, generateDesignImages } from '../services/designImages.service.js';
import { resolveCodexBin } from '../services/codexCli.service.js';
async function main() {
  await loadSecrets();
  console.log('codex bin:', resolveCodexBin());
  console.log('engines in order:', availableImageEngines());
  const t = Date.now();
  const r = await generateDesignImages({ brief: 'burgers', subject: 'gourmet flame-grilled beef burger with melted cheddar and golden fries', colours: ['#e4241c', '#ffc72c'], storeId: 'smoke', mood: 'light', keys: ['hero'], onEvent: (e) => console.log('  event', JSON.stringify(e).slice(0, 220)) });
  console.log(`result in ${Date.now() - t} ms:`, JSON.stringify({ images: r.images, sources: r.sources, model: r.model, errors: r.errors }, null, 1));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

import { loadSecrets } from '../lib/secretStore.js';
import { getBuilderSettings, interpretBrief } from '../services/designBrain.service.js';
async function main() {
  await loadSecrets();
  let deltas = 0, chars = 0, thinking = 0, model = '';
  const t = Date.now();
  const r = await interpretBrief({ prompt: 'i want to build a food store, burgers, red and yellow', storeName: 'Smoke', provider: 'claude', settings: { ...(await getBuilderSettings()), enabled: true },
    onEvent: (e) => { if (e.type === 'delta') { deltas++; chars += e.text.length; } else if (e.type === 'thinking') thinking = e.tokens; else model = e.model; } });
  console.log(`done in ${Date.now() - t} ms · model ${model} · thinking ~${thinking} tokens · ${deltas} deltas / ${chars} chars · engine`, r.engine);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

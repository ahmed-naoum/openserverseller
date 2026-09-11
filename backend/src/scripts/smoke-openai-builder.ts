/**
 * Smoke test for the GPT side of OpenDesign, without the HTTP layer.
 *
 *   npx tsx src/scripts/smoke-openai-builder.ts          # config + composer only, no paid call
 *   npx tsx src/scripts/smoke-openai-builder.ts --call   # also one GPT brief reading (cents)
 *   npx tsx src/scripts/smoke-openai-builder.ts --images # also three GPT photos (paid)
 */
import { loadSecrets } from '../lib/secretStore.js';
import { openaiStatus } from '../services/openai.service.js';
import { getBuilderSettings, interpretBrief, studioProviders } from '../services/designBrain.service.js';
import { generateDesignImages } from '../services/designImages.service.js';
import { generateDesign } from '../shared/templates/opendesign.js';

const BRIEF = process.env.BRIEF || 'can you build for me a website for food and i want to sell burgers i want the colors to be red and yellow okey and use images make the animation to be pro';

async function main() {
  await loadSecrets();
  console.log('openai status:', openaiStatus());
  console.log('builder settings:', await getBuilderSettings());
  console.log('studio providers:', JSON.stringify(await studioProviders()));

  // The composer honours per-brief photos and reports them.
  const d = generateDesign({ prompt: BRIEF, storeName: 'Smoke', images: { hero: '/uploads/opendesign/1/x-hero.jpg', promo: '/uploads/opendesign/1/x-promo.jpg' } }, null);
  const json = JSON.stringify(d.pages);
  console.log('hero slot used:', json.includes('/uploads/opendesign/1/x-hero.jpg'), '| promo slot used:', json.includes('/uploads/opendesign/1/x-promo.jpg'));
  console.log('rationale:', d.rationale.find((l) => l.includes('photo')));

  // Without a key the GPT brain declines politely and the built-in reader takes over.
  if (!process.argv.includes('--call')) {
    const r = await interpretBrief({ prompt: BRIEF, storeName: 'Smoke', provider: 'openai', settings: { ...(await getBuilderSettings()), enabled: true } });
    console.log('interpret (no call unless configured):', r.engine);
  } else {
    const t = Date.now();
    const r = await interpretBrief({ prompt: BRIEF, storeName: 'Smoke', provider: 'openai', settings: { ...(await getBuilderSettings()), enabled: true } });
    console.log(`interpret via GPT in ${Date.now() - t} ms:`, r.engine);
    console.log('spec:', JSON.stringify(r.spec, null, 1).slice(0, 1600));
  }
  if (process.argv.includes('--claude')) {
    const t = Date.now();
    const r = await interpretBrief({ prompt: BRIEF, storeName: 'Smoke', provider: 'claude', settings: { ...(await getBuilderSettings()), enabled: true } });
    console.log(`interpret via Claude in ${Date.now() - t} ms:`, r.engine);
    console.log('claude spec:', JSON.stringify(r.spec, null, 1).slice(0, 1600));
  }

  if (process.argv.includes('--images')) {
    const r = await generateDesignImages({ brief: BRIEF, subject: process.env.SUBJECT || 'gourmet flame-grilled beef burgers with melted cheddar and golden fries', colours: ['#e4241c', '#ffc72c'], storeId: 'smoke', mood: 'light', keys: ['hero'] });
    console.log('images:', r);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

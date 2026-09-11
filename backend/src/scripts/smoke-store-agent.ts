/**
 * Smoke test for the store agent, without the HTTP layer. Runs ONE real model
 * call (the configured Claude/GPT brain) and writes drafts on the dev store.
 *
 *   npx tsx src/scripts/smoke-store-agent.ts [storeId] ["instruction"]
 */
import { prisma } from '../lib/prisma.js';
import { loadSecrets } from '../lib/secretStore.js';
import { runStoreAgent, listAgentTargets } from '../services/storeAgent.service.js';

async function main() {
  await loadSecrets();
  const storeId = Number(process.argv[2] || 1);
  const instruction = process.argv[3] || 'Ajoute une section avis clients juste après les produits sur l’accueil, et change le texte du bandeau d’annonce en « Livraison gratuite dès 300 DH ».';
  const store = await (prisma as any).store.findUnique({ where: { id: storeId }, select: { id: true, name: true, userId: true } });
  if (!store) throw new Error(`store ${storeId} not found`);
  console.log('store:', store);
  console.log('targets before:', await listAgentTargets(store.id));
  const t = Date.now();
  const r = await runStoreAgent({ userId: store.userId, instruction, focus: 'home' });
  console.log(`run finished in ${Date.now() - t} ms · model ${r.model} · error ${r.error ?? 'none'}`);
  console.log('summary:', r.summary);
  for (const a of r.actions) console.log(`  [${a.ok ? 'ok' : 'KO'}] r${a.round} #${a.index} ${a.type}${a.target ? ' ' + a.target : ''} — ${a.detail}${a.refused?.length ? '\n       refused: ' + a.refused.map((x) => x.reason).join(' | ') : ''}`);
  console.log('drafts:', r.drafts.map((d) => d.key));
  console.log('usage:', r.usage);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

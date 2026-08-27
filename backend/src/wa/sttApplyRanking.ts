/**
 * Applique le classement STT décidé sur de vraies notes vocales.
 *
 * Run with:  npx tsx src/wa/sttApplyRanking.ts [userId]
 *
 * L'ORDRE VIENT DES MESURES, pas d'un avis. Il a été établi avec
 * wa/sttCompare.ts sur les notes réelles de wa-media :
 *
 *   1. cohere-transcribe-arabic-07-2026  3/3 · ~1,3 s · arabe systématique
 *   2. gemini-3.7-flash                  2/3 · ~5,5 s · arabe (un 503)
 *   3. gemini-3.1-flash-lite             3/3 · ~1,2 s · arabe
 *   4. gemini-3.5-flash                  3/3 · ~5,5 s · arabe
 *
 * TOUT LE RESTE EST DÉSACTIVÉ, et pas seulement écarté de la chaîne. La raison
 * est la même pour chacun : ils RÉUSSISSENT en renvoyant un texte faux.
 * `runChain` ne passe au maillon suivant que sur un ÉCHEC — un moteur qui rend
 * une phrase fluide et fausse est donc un cul-de-sac silencieux, jamais un
 * repli. Whisper transforme un « oui » en « non », Munsit rend trois syllabes
 * pour trente secondes, 3-flash-preview bascule en caractères latins, et
 * 3.5-flash-lite invente des horodatages et du français absent de l'audio.
 *
 * Les laisser activés ne coûterait « que » leur présence dans un menu — mais
 * c'est exactement ainsi qu'ils finissent choisis un jour, et une transcription
 * fausse ne déclenche aucune alerte.
 */

import { prisma } from '../lib/prisma.js';

/**
 * Le classement complet, du meilleur au dernier recours.
 *
 * Mesuré avec wa/sttCompare.ts sur les notes réelles de wa-media :
 *
 *   1.  cohere-transcribe-arabic  3/3 · 1 270 ms · arabe systématique
 *   2.  gemini-3.7-flash          2/3 · 5 467 ms · arabe (un 503)
 *   3.  gemini-3.1-flash-lite     3/3 · 1 223 ms · arabe
 *   4.  gemini-3.5-flash          3/3 · 5 473 ms · arabe
 *   5.  gemini-3-flash-preview    3/3 · 17 597 ms · bascule en latin
 *   6.  gemini-3.5-flash-lite     3/3 · 977 ms · erratique
 *   7.  gemini-3.6-flash          quota épuisé le jour du test
 *   8.  gemini-omni-flash-preview quota épuisé le jour du test
 *   9.  munsit-1                  3/3 · 1 001 ms · illisible
 *   10. whisper-large-v3-turbo    3/3 · ~660 ms · sens inversé
 *   11. whisper-large-v3          3/3 · ~660 ms · sens inversé
 *
 * L'ORDRE EST LA SEULE PROTECTION À PARTIR DU 5e MAILLON, et il faut le dire
 * clairement : runChain n'avance que sur un ÉCHEC. Les maillons 9 à 11
 * n'échouent pas — ils renvoient un texte fluide et faux. S'ils sont atteints,
 * leur sortie DEVIENT le message du client et l'agent y répond sans que rien
 * ne le signale.
 *
 * Ils ne sont donc là que comme dernier recours après l'échec des huit
 * premiers, ce qui suppose une panne simultanée de Cohere et de tout le quota
 * Gemini. À ce moment-là, « une transcription douteuse » vaut peut-être mieux
 * que « [transcription indisponible] » — c'est un arbitrage assumé, pas un
 * oubli.
 */
const RANKING = [
  'cohere:cohere-transcribe-arabic-07-2026',
  'gemini:gemini-3.7-flash',
  'gemini:gemini-3.1-flash-lite',
  'gemini:gemini-3.5-flash',
  'gemini:gemini-3-flash-preview',
  'gemini:gemini-3.5-flash-lite',
  'gemini:gemini-3.6-flash',
  'gemini:gemini-omni-flash-preview',
  'munsit:munsit-1',
  'groq:whisper-large-v3-turbo',
  'groq:whisper-large-v3',
];

const split = (link: string) => {
  const at = link.indexOf(':');
  return { provider: link.slice(0, at), modelId: link.slice(at + 1) };
};

async function main(): Promise<void> {
  const userId = Number(process.argv[2]) || null;

  /* ---- 1. le catalogue ------------------------------------------- */

  // Tout couper d'abord, puis rallumer les quatre retenus : un moteur ajouté
  // au catalogue demain sera donc éteint par défaut plutôt que silencieusement
  // inclus parce que personne n'a repensé à cette liste.
  await prisma.aiModel.updateMany({
    where: { role: 'STT' },
    data: { isEnabled: false, isDefault: false },
  });

  const ids: number[] = [];
  for (const [index, link] of RANKING.entries()) {
    const { provider, modelId } = split(link);
    const row = await prisma.aiModel.findFirst({ where: { role: 'STT', provider, modelId } });
    if (!row) {
      console.error(`ABSENT du catalogue : ${link} — classement interrompu.`);
      process.exit(1);
    }
    await prisma.aiModel.update({
      where: { id: row.id },
      data: { isEnabled: true, isDefault: index === 0, sortOrder: (index + 1) * 10 },
    });
    ids.push(row.id);
  }

  const all = await prisma.aiModel.findMany({
    where: { role: 'STT' },
    orderBy: [{ isEnabled: 'desc' }, { sortOrder: 'asc' }],
    select: { provider: true, modelId: true, isEnabled: true, isDefault: true },
  });

  console.log('CATALOGUE STT');
  for (const m of all) {
    console.log(
      `  ${m.isEnabled ? '[x]' : '[ ]'} ${(m.provider + ':' + m.modelId).padEnd(52)}${m.isDefault ? ' DÉFAUT' : ''}`
    );
  }

  /* ---- 2. le compte ---------------------------------------------- */

  if (!userId) {
    console.log('\nAucun userId fourni : le catalogue est classé, aucun compte modifié.');
    await prisma.$disconnect();
    return;
  }

  const agent = await prisma.whatsappAgent.findUnique({ where: { userId }, select: { id: true } });
  if (!agent) {
    console.error(`\nLe compte ${userId} n'a pas d'agent.`);
    process.exit(1);
  }

  await prisma.whatsappAgent.update({
    where: { userId },
    data: {
      sttModelId: ids[0],
      // Les maillons SUIVANTS seulement : le principal est déjà essayé en
      // premier, et le répéter ici le ferait tenter deux fois.
      sttChain: RANKING.slice(1),
      // Aucune nouvelle tentative sur le même moteur : passer au fournisseur
      // suivant vaut mieux que réessayer celui qui vient de refuser, sur un
      // chemin où le client attend.
      sttRetries: 0,
    },
  });

  const saved = await prisma.whatsappAgent.findUnique({
    where: { userId },
    select: { sttChain: true, sttRetries: true, sttModel: { select: { provider: true, modelId: true } } },
  });

  console.log(`\nCOMPTE ${userId}`);
  console.log(`  principal : ${saved?.sttModel?.provider}:${saved?.sttModel?.modelId}`);
  saved?.sttChain.forEach((link, i) => console.log(`  repli ${i + 1}   : ${link}`));
  console.log(`  tentatives supplémentaires par moteur : ${saved?.sttRetries}`);

  await prisma.$disconnect();
}

void main();

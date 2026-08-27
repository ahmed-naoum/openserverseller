/**
 * Compares every transcription engine on the SAME real voice notes.
 *
 * Run with:  npx tsx src/wa/sttCompare.ts <userId> [nombre de notes]
 *
 * POURQUOI CE SCRIPT PLUTÔT QU'UN TABLEAU DE PRIX. Chaque fournisseur annonce
 * 95 à 99 % de précision sur l'arabe, et aucun de ces chiffres ne dit quoi que
 * ce soit sur la darija : c'est une langue peu dotée, et la variation dialectale
 * est réelle — le /q/ prononcé /g/ au nord, les emprunts berbères au sud. Un
 * modèle entraîné sur la darija centrale se trompera sur vos clients d'une
 * façon qu'aucun benchmark publié ne prédit.
 *
 * Or vous avez déjà la seule mesure qui compte : les vraies notes vocales de
 * vos vrais clients, dans wa-media. Ce script les rejoue à travers chaque
 * moteur et met les transcriptions côte à côte.
 *
 * IL DÉPENSE DE L'ARGENT — un appel API par note et par moteur — et il ÉCRIT
 * dans le journal de l'agent : chaque essai produit sa ligne stt.transcribed
 * avec son moteur, sa durée et son coût. La page Journal, filtrée sur STT, est
 * la version consultable de ce que ce script imprime.
 *
 * Il ne modifie AUCUNE conversation : les transcriptions ne sont pas
 * réécrites. Pour ça, c'est sttBackfill.ts.
 */

import fs from 'node:fs';
import { prisma } from '../lib/prisma.js';
import { loadSecrets, getSecret } from '../lib/secretStore.js';
import { flushWaLogs } from '../services/waLogs.service.js';
import { transcribe } from './speech.js';
import { ensureCatalogue } from './catalogue.js';

/** La clé que chaque fournisseur exige. Pas de clé, pas d'essai. */
const KEY_FOR: Record<string, string> = {
  gemini: 'GEMINI_API_KEY',
  munsit: 'MUNSIT_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  'openrouter-chat': 'OPENROUTER_API_KEY',
  cohere: 'COHERE_API_KEY',
};

interface Attempt {
  engine: string;
  ok: boolean;
  text: string;
  ms: number;
  costCents: number | null;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const pad = (s: string, n: number): string => (s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length));

async function main(): Promise<void> {
  const userId = Number(process.argv[2]);
  const limit = Math.min(20, Math.max(1, Number(process.argv[3]) || 5));

  if (!userId) {
    console.error('usage: npx tsx src/wa/sttCompare.ts <userId> [nombre de notes]');
    process.exit(1);
  }

  await loadSecrets();
  await ensureCatalogue();

  // Tous les moteurs du catalogue, activés ou non : le but est justement de
  // juger ceux qui ne sont pas encore activés.
  const models = await prisma.aiModel.findMany({
    where: { role: 'STT' },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { provider: true, modelId: true, label: true },
  });

  const engines = models.filter((m) => {
    const key = KEY_FOR[m.provider];
    if (key && !getSecret(key)) {
      console.log(`- ignoré : ${m.label} (${key} non configurée)`);
      return false;
    }
    return true;
  });

  if (!engines.length) {
    console.error('Aucun moteur utilisable : configurez au moins une clé.');
    process.exit(1);
  }

  // INBOUND uniquement. Les notes sortantes sont de la synthèse : les
  // transcrire mesurerait la propreté de notre propre TTS, pas la capacité d'un
  // moteur à comprendre un client dans la rue.
  const notes = await prisma.whatsappMessage.findMany({
    where: { userId, kind: 'AUDIO', direction: 'IN', mediaPath: { not: null } },
    orderBy: { id: 'desc' },
    take: limit,
    select: { id: true, mediaPath: true, mediaMime: true, transcript: true },
  });

  if (!notes.length) {
    console.error(`Aucune note vocale entrante pour le compte ${userId}.`);
    process.exit(1);
  }

  console.log(`\n${notes.length} note(s) × ${engines.length} moteur(s)\n`);

  const totals = new Map<string, { ok: number; fail: number; ms: number; cents: number }>();

  for (const note of notes) {
    if (!note.mediaPath || !fs.existsSync(note.mediaPath)) {
      console.log(`#${note.id} — fichier introuvable, ignoré (${note.mediaPath})`);
      continue;
    }

    console.log('='.repeat(100));
    console.log(`Note #${note.id}`);
    if (note.transcript) console.log(`  transcription enregistrée : ${note.transcript}`);
    console.log('-'.repeat(100));

    const attempts: Attempt[] = [];

    for (const engine of engines) {
      const name = `${engine.provider}:${engine.modelId}`;

      // Une pause entre deux essais, et elle n'est pas cosmétique : plusieurs
      // modèles de ce tableau partagent UNE clé. Enchaînés sans respirer, ils
      // se limitent mutuellement en débit, et un 429 se lit alors comme « ce
      // moteur ne marche pas » alors que c'est la comparaison qui l'a saturé.
      await sleep(1500);

      const started = Date.now();
      try {
        const result = await transcribe(note.mediaPath, note.mediaMime || 'audio/ogg', {
          provider: engine.provider,
          modelId: engine.modelId,
          // Pas de chaîne de repli ici, et c'est essentiel : un repli
          // silencieux ferait passer la transcription d'un autre moteur pour
          // celle qu'on est en train de juger.
          chain: [],
          retries: 0,
        });
        attempts.push({
          engine: name,
          ok: true,
          text: result.text,
          ms: Date.now() - started,
          costCents: result.costCents ?? null,
        });
      } catch (err) {
        attempts.push({
          engine: name,
          ok: false,
          text: (err as Error).message,
          ms: Date.now() - started,
          costCents: null,
        });
      }
    }

    for (const a of attempts) {
      const stat = totals.get(a.engine) || { ok: 0, fail: 0, ms: 0, cents: 0 };
      stat[a.ok ? 'ok' : 'fail'] += 1;
      stat.ms += a.ms;
      stat.cents += a.costCents ?? 0;
      totals.set(a.engine, stat);

      const cost = a.costCents !== null ? ` ${a.costCents}c` : '';
      console.log(`${pad(a.engine, 42)} ${a.ok ? ' ' : '✗'} ${pad(`${a.ms}ms${cost}`, 12)} ${a.text}`);
    }
    console.log('');
  }

  console.log('='.repeat(100));
  console.log('TOTAUX');
  for (const [engine, s] of totals) {
    const avg = Math.round(s.ms / Math.max(1, s.ok + s.fail));
    console.log(
      `${pad(engine, 42)} ${s.ok} réussite(s), ${s.fail} échec(s) · ${avg}ms en moyenne${
        s.cents ? ` · ${s.cents}c au total` : ''
      }`
    );
  }
  console.log(
    '\nLa décision se prend en LISANT les transcriptions ci-dessus, pas sur les moyennes :\n' +
      'un moteur rapide qui écrit une phrase plausible mais fausse est le pire des cas,\n' +
      "parce que l'agent y répondra sans qu'aucun compteur ne signale quoi que ce soit.\n"
  );

  // Le logger est asynchrone et ce process s'arrête tout de suite : sans ça,
  // les dernières lignes stt.transcribed n'atteindraient jamais Postgres.
  await flushWaLogs();
  await prisma.$disconnect();
}

void main().catch(async (err) => {
  console.error('[wa/sttCompare]', err);
  await flushWaLogs();
  process.exit(1);
});

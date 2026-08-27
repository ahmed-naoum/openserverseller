/**
 * « Est-ce que ce modèle marche ? » — one real call per catalogue row.
 *
 * WHY A LIVE CALL AND NOT A PING. Everything that actually breaks a model in
 * production is invisible to a reachability check: a key that was rotated, a
 * model id the vendor retired, a preview tier that answers 429 all afternoon, a
 * capability flag set on a model that does not accept the parameter it guards.
 * All four look identical from outside — the row sits there, enabled, and the
 * first person to find out is a customer who got no reply. So each test sends
 * the SAME kind of request the agent sends, through the SAME code path, and
 * reports what came back.
 *
 * IT SPENDS MONEY. One request per test, billed by the vendor at the row's own
 * price. That is the point — a test that avoided the paid path would not prove
 * the paid path. The caller is a SUPER_ADMIN screen and the amounts are one
 * short turn each, but nothing here should ever run on a loop.
 *
 * NO FALLBACKS, EVER. transcribe() and synthesize() both take a chain, and in
 * production that chain is what keeps the agent talking. Here it is disabled:
 * the whole question is whether THIS row works, and a test rescued by the next
 * link would report a dead engine as healthy.
 *
 * Every test writes its normal activity-log rows (STT/TTS/BRAIN) tagged to the
 * admin who ran it, so the Journal screen is the audit trail for what these
 * buttons spent.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getSecret } from '../lib/secretStore.js';
import { prisma } from '../lib/prisma.js';
import { runTurn, buildContext } from './brain.js';
import { synthesize, transcribe, readVerbatim, type VoicePreset } from './speech.js';

/* ------------------------------------------------------------------ */
/* shape of a result                                                   */
/* ------------------------------------------------------------------ */

export interface ModelTestCheck {
  label: string;
  ok: boolean;
  detail?: string | null;
}

export interface ModelTestResult {
  ok: boolean;
  role: string;
  provider: string;
  modelId: string;
  label: string;
  /** Wall clock of the whole test, including the probe audio when one is built. */
  ms: number;
  /** One line, for the row on screen. */
  summary: string;
  /** What the model produced: the reply, the transcript, the spoken text. */
  sample: string | null;
  /** TTS only — a playable file, so "it works" can be heard rather than believed. */
  audioUrl: string | null;
  checks: ModelTestCheck[];
  error: string | null;
  usage: { inputTokens: number; outputTokens: number } | null;
  /** What the vendor said the call cost, when it says at all. */
  costCents: number | null;
}

/** The row this module needs. A subset of AiModel, so callers can pass one whole. */
export interface TestableModel {
  id: number;
  provider: string;
  modelId: string;
  label: string;
  role: string;
  supportsEffort: boolean;
  supportsThinking: boolean;
  supportsMidSystem: boolean;
  supportsFallbacks: boolean;
  maxOutputTokens: number;
}

/**
 * The credential each provider needs, by AiModel.provider.
 *
 * Checked BEFORE the call so a missing key reads as "renseignez GEMINI_API_KEY"
 * instead of whatever 401 body the vendor happens to return. `edge` is absent
 * on purpose: Microsoft's endpoint is unauthenticated.
 */
const KEY_FOR: Record<string, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  'claude-cli': 'CLAUDE_CODE_OAUTH_TOKEN',
  gemini: 'GEMINI_API_KEY',
  munsit: 'MUNSIT_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  'openrouter-chat': 'OPENROUTER_API_KEY',
  cohere: 'COHERE_API_KEY',
  openai: 'OPENAI_API_KEY',
  elevenlabs: 'ELEVENLABS_API_KEY',
};

const mediaRoot = (): string => getSecret('WA_MEDIA_ROOT') || path.join(process.cwd(), 'wa-media');

/** Probe audio and test voice notes. Outside every account's folder — it is platform scratch. */
export const testDir = (): string => path.join(mediaRoot(), '_model-tests');

const clip = (s: unknown, n = 400): string => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/* ------------------------------------------------------------------ */
/* the probes                                                          */
/* ------------------------------------------------------------------ */

/**
 * The sentence every speech test uses, in Arabic script.
 *
 * Darija rather than French because that is what the engines are actually being
 * bought for, and a transcription engine that handles French perfectly and
 * Darija badly is the exact failure this catalogue exists to shop around.
 * Arabic script rather than Arabizi so no transliteration step sits between the
 * admin and the answer.
 */
const SPEECH_PROBE = 'السلام عليكم، بغيت نأكد الطلب ديالي، أنا ساكن في الدار البيضاء.';

/** Kept short: TTS is billed by the character on some engines and read aloud on all of them. */
const TTS_PROBE = 'السلام عليكم، هادي رسالة تجريبية من المتجر.';

/**
 * The audio every STT test is scored against.
 *
 * Built ONCE with Edge — free, keyless, and not one of the engines under test,
 * so scoring a transcription engine never depends on the health of a paid one —
 * then cached on disk and replayed. Ground truth is therefore known, which is
 * what lets the test say "it transcribed it WRONG" and not merely "it answered".
 */
async function sttProbeFile(): Promise<string> {
  const out = path.join(testDir(), 'stt-probe.ogg');

  // A truncated file from an interrupted build would be silently transcribed as
  // nothing and reported as a broken engine, so a stub does not count as cached.
  if (fs.existsSync(out) && fs.statSync(out).size > 2048) return out;

  const preset: VoicePreset = {
    provider: 'edge',
    voiceId: 'ar-MA-MounaNeural',
    rate: 0,
    pitch: 0,
    volume: 0,
  };

  const built = await synthesize(SPEECH_PROBE, preset, {
    modelId: null,
    outDir: testDir(),
    basename: 'stt-probe',
    policy: { chain: [], retries: 1, verify: 'never', onFailure: 'text_only' },
  });

  return built.filePath;
}

/* ------------------------------------------------------------------ */
/* per-role tests                                                      */
/* ------------------------------------------------------------------ */

/** The smallest system prompt that still has a right answer to check against. */
const BRAIN_SYSTEM = `You are the WhatsApp sales agent for "Atlas Store", a Moroccan shop.

# Products and prices (the only prices you may quote)
- Montre Classic | price: 249 MAD | was: 399 MAD

# How you write
Short WhatsApp messages, 1-3 sentences. Reply in the customer's language.
Never invent a price that is not written above.`;

async function testBrain(model: TestableModel, adminId: number): Promise<Partial<ModelTestResult>> {
  const context = buildContext({
    phone: '212600000000',
    pushName: 'Test',
    source: 'ORGANIC',
    draft: {},
    status: 'NEW',
    timezone: 'Africa/Casablanca',
  });

  const result = await runTurn({
    systemPrompt: BRAIN_SYSTEM,
    context,
    history: [{ role: 'user', content: 'salam, chhal taman dyal la montre?' }],
    model: {
      provider: model.provider,
      modelId: model.modelId,
      supportsEffort: model.supportsEffort,
      supportsThinking: model.supportsThinking,
      supportsMidSystem: model.supportsMidSystem,
      supportsFallbacks: model.supportsFallbacks,
      maxOutputTokens: model.maxOutputTokens,
    },
    effort: 'low',
    // Enough for three WhatsApp sentences. The point is the round trip, not the essay.
    maxOutputTokens: 200,
    log: { userId: adminId },
  });

  const reply = String(result.reply || '').trim();

  return {
    sample: reply || null,
    usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens },
    checks: [
      { label: 'Le modèle a répondu', ok: reply.length > 0 },
      // A model that leaks its tool protocol into the text is one the customer
      // would receive raw JSON from — broken, even though the call succeeded.
      { label: 'La réponse est du texte, pas du JSON brut', ok: !reply.startsWith('{') },
      {
        label: 'Il cite le seul prix autorisé',
        ok: /249/.test(reply),
        detail: /249/.test(reply) ? null : 'le prix du prompt (249) n’apparaît pas',
      },
      {
        label: 'Aucun refus de sécurité',
        ok: !result.refusal,
        detail: result.refusal || null,
      },
    ],
  };
}

async function testStt(model: TestableModel, adminId: number): Promise<Partial<ModelTestResult>> {
  let probe: string;
  try {
    probe = await sttProbeFile();
  } catch (err) {
    throw new Error(
      `L'audio de test n'a pas pu être produit (Edge + ffmpeg) : ${(err as Error).message}. ` +
        'Vérifiez FFMPEG_PATH et l’accès réseau ; sans audio, aucun moteur de transcription ne peut être testé.'
    );
  }

  const heard = await transcribe(probe, 'audio/ogg', {
    provider: model.provider,
    modelId: model.modelId,
    // No chain, no retries: the question is whether THIS engine transcribes.
    chain: [],
    retries: 0,
    log: { userId: adminId },
  });

  const text = String(heard.text || '').trim();
  // The same reader the voice pipeline uses to decide whether synthesised audio
  // really said the reply — so "accurate" means here what it means in production.
  const faithful = !!text && readVerbatim(SPEECH_PROBE, text);

  return {
    sample: text || null,
    costCents: heard.costCents ?? null,
    checks: [
      { label: 'Le moteur a rendu une transcription', ok: text.length > 0 },
      {
        label: 'La transcription correspond à ce qui a été dit',
        ok: faithful,
        // Not a failure of the test — a real quality verdict on the engine.
        detail: faithful ? null : `attendu : « ${clip(SPEECH_PROBE, 80)} »`,
      },
    ],
  };
}

/**
 * Speaks one sentence and hands back a file the admin can play.
 *
 * The voice is one the catalogue actually has for this provider, because a
 * voice id the engine does not know is a 400 that would be read as a dead
 * model.
 */
async function testTts(model: TestableModel, adminId: number): Promise<Partial<ModelTestResult>> {
  const voice = await prisma.aiVoice.findFirst({
    where: { provider: model.provider, isEnabled: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { voiceId: true, label: true },
  });

  const fallbackVoice = model.provider === 'gemini' ? 'Sulafat' : 'ar-MA-MounaNeural';

  const preset: VoicePreset = {
    provider: model.provider,
    voiceId: voice?.voiceId || fallbackVoice,
    rate: 0,
    pitch: 0,
    volume: 0,
    stylePrompt: 'Parle en darija marocaine, ton chaleureux et naturel.',
  };

  const basename = `tts-${model.id}`;
  const spoken = await synthesize(TTS_PROBE, preset, {
    modelId: model.modelId,
    outDir: testDir(),
    basename,
    policy: {
      chain: [],
      retries: 0,
      // The verify pass would spend a second call on an STT engine and blame
      // this model for its failures. The admin listens instead.
      verify: 'never',
      onFailure: 'text_only',
      timeoutMs: 90_000,
    },
    log: { userId: adminId },
  });

  const file = path.basename(spoken.filePath);
  const bytes = fs.existsSync(spoken.filePath) ? fs.statSync(spoken.filePath).size : 0;

  return {
    sample: TTS_PROBE,
    audioUrl: `/api/v1/admin/ai/models/test-audio/${file}`,
    checks: [
      { label: 'Le moteur a produit un fichier audio', ok: bytes > 0 },
      // An ogg under a kilobyte is silence with a header — the engine answered
      // and said nothing, which plays as a broken voice note on WhatsApp.
      {
        label: 'Le fichier contient vraiment du son',
        ok: bytes > 1024,
        detail: `${Math.round(bytes / 1024)} Ko`,
      },
      {
        label: 'Aucun repli n’a été nécessaire',
        ok: !spoken.fellBackFrom,
        detail: spoken.fellBackFrom || null,
      },
      { label: `Voix utilisée : ${voice?.label || preset.voiceId}`, ok: true },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* entry point                                                         */
/* ------------------------------------------------------------------ */

/**
 * Runs the test that fits the row's role and never throws.
 *
 * A thrown error IS the answer here — "this model does not work, and here is
 * what the vendor said" — so it is caught and shaped into the same result the
 * success path returns. A test button that 500s tells the admin nothing.
 */
export async function testModel(model: TestableModel, adminId: number): Promise<ModelTestResult> {
  const startedAt = Date.now();

  const base: ModelTestResult = {
    ok: false,
    role: model.role,
    provider: model.provider,
    modelId: model.modelId,
    label: model.label,
    ms: 0,
    summary: '',
    sample: null,
    audioUrl: null,
    checks: [],
    error: null,
    usage: null,
    costCents: null,
  };

  const keyName = KEY_FOR[model.provider];
  if (keyName && !getSecret(keyName)) {
    return {
      ...base,
      ms: Date.now() - startedAt,
      summary: `${keyName} n'est pas renseignée — renseignez-la dans Variables & Secrets.`,
      error: `Clé manquante : ${keyName}`,
      checks: [{ label: `${keyName} est configurée`, ok: false }],
    };
  }

  try {
    let outcome: Partial<ModelTestResult>;

    switch (model.role) {
      case 'BRAIN':
        outcome = await testBrain(model, adminId);
        break;
      case 'STT':
        outcome = await testStt(model, adminId);
        break;
      case 'TTS':
        outcome = await testTts(model, adminId);
        break;
      default:
        // Reached only by a legacy row whose role the catalogue no longer
        // offers — VISION, in practice. There is nothing to exercise: photos
        // are read by the BRAIN model, so a vision row names an engine the
        // agent never calls.
        throw new Error(
          `Le rôle « ${model.role} » n'est plus proposé par le catalogue : rien ne l'appelle, ` +
            'il n’y a donc rien à tester. Les photos sont lues par le modèle de cerveau.'
        );
    }

    const checks = outcome.checks || [];
    const failed = checks.filter((c) => !c.ok);
    const ok = failed.length === 0;
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

    return {
      ...base,
      ...outcome,
      ok,
      ms: Date.now() - startedAt,
      checks,
      summary: ok
        ? `Le modèle a répondu en ${seconds} s.`
        : // The first failed check is the useful half of the sentence: an engine
          // that answered but mis-transcribed is a different problem from one
          // that never answered, and both are "FAIL" without it.
          `${failed[0].label} — non. ${failed.length > 1 ? `(${failed.length} contrôles en échec) ` : ''}${seconds} s.`,
    };
  } catch (err) {
    return {
      ...base,
      ms: Date.now() - startedAt,
      summary: clip((err as Error).message, 300) || 'Le modèle n’a pas répondu.',
      error: clip((err as Error).message, 1000),
      checks: [{ label: 'Appel du fournisseur', ok: false, detail: clip((err as Error).message, 200) }],
    };
  }
}

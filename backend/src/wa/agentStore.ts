/**
 * Reads and writes for one account's agent, plus the first-run defaults.
 *
 * "Of course he is gonna find default configurations, but also he can add his
 * own" — that requirement is implemented here. An account that has never
 * touched the agent still opens the page onto a working setup: a brain, a
 * knowledge base skeleton, and three named voice presets it can send a test
 * message with immediately. Everything is then editable, and anything it
 * creates itself is marked isSystem = false so it can also be deleted.
 */

import { prisma } from '../lib/prisma.js';
import { DEFAULT_KB, normaliseKb, recompilePrompt } from './kb.js';
import { resolveModel, ensureCatalogue, DEFAULT_TTS_CHAIN } from './catalogue.js';

/**
 * The Darija delivery instruction.
 *
 * This is the single most important setting for a Gemini voice, because that
 * engine has NO accent or pace parameters — you describe the delivery in words
 * and it obeys. Saying what NOT to sound like matters as much as what to sound
 * like: left to itself the model drifts to Modern Standard Arabic or an
 * Egyptian accent, which a Moroccan customer hears immediately as a foreigner.
 */
const DARIJA_STYLE =
  'Speak in a warm, natural MOROCCAN DARIJA accent, like a shopkeeper from Casablanca talking to a customer on WhatsApp. ' +
  'Not Egyptian, not Gulf, not Modern Standard Arabic. Speak calmly and clearly.';

/**
 * The shipped voice presets.
 *
 * Deliberately three, not thirty: the point is that the account hears the
 * difference between them in one click and then edits the one it likes.
 *
 * The first two are Gemini/Sulafat, which is the combination the standalone
 * project settled on after listening to the alternatives on real Darija — a
 * Live conversational voice steered into a Moroccan accent beats a genuinely
 * Moroccan voice that reads like a menu system. The third is Edge, which needs
 * no API key, so an account still has a working voice before an admin has
 * configured Gemini.
 */
const DEFAULT_PRESETS = [
  {
    name: 'Sulafat — darija naturelle',
    provider: 'gemini',
    voiceId: 'Sulafat',
    rate: 0,
    pitch: 0,
    volume: 0,
    stylePrompt: DARIJA_STYLE,
  },
  {
    name: 'Sulafat — posée',
    provider: 'gemini',
    voiceId: 'Sulafat',
    // Gemini has no rate parameter, so this -20 is translated into words and
    // appended to the instruction. It is the preset for an older customer, or
    // for reading a long address back.
    rate: -20,
    pitch: 0,
    volume: 0,
    stylePrompt: `${DARIJA_STYLE} Take your time — this is being read back to confirm details.`,
  },
  {
    name: 'Mouna — marocaine (sans clé)',
    provider: 'edge',
    voiceId: 'ar-MA-MounaNeural',
    rate: 0,
    pitch: 0,
    volume: 0,
    stylePrompt:
      'Voix arabe marocaine native. Fonctionne sans clé API — utile tant que Gemini n’est pas configuré.',
  },
];

export interface AgentWithRelations {
  id: number;
  userId: number;
  [key: string]: unknown;
}

/**
 * Returns the account's agent, creating it with sane defaults on first read.
 *
 * Creation picks the platform's default brain, STT and TTS models rather than
 * leaving them null, so the agent is runnable the moment the account connects a
 * number. If the admin has enabled nothing for a role the field stays null and
 * the status endpoint reports it as a missing prerequisite — which is a real
 * configuration problem, not something to paper over with a guessed model id.
 */
export async function getOrCreateAgent(userId: number) {
  const existing = await prisma.whatsappAgent.findUnique({
    where: { userId },
    include: { brainModel: true, sttModel: true, ttsModel: true, activeVoice: true },
  });
  if (existing) return existing;

  await ensureCatalogue();

  const [brain, stt, tts] = await Promise.all([
    resolveModel('BRAIN'),
    resolveModel('STT'),
    resolveModel('TTS'),
  ]);

  await prisma.whatsappAgent.create({
    data: {
      userId,
      kb: DEFAULT_KB as unknown as object,
      brainModelId: brain?.id ?? null,
      sttModelId: stt?.id ?? null,
      ttsModelId: tts?.id ?? null,
      maxOutputTokens: Math.min(600, brain?.maxOutputTokens ?? 600),
      // The measured fallback order. Without it a single failure from the
      // preview-tier Live model means no voice note at all, which on real
      // traffic is most of them.
      ttsChain: DEFAULT_TTS_CHAIN,
    },
  });

  await ensureDefaultVoices(userId);
  await recompilePrompt(userId);

  return prisma.whatsappAgent.findUniqueOrThrow({
    where: { userId },
    include: { brainModel: true, sttModel: true, ttsModel: true, activeVoice: true },
  });
}

/**
 * Writes the shipped presets if the account has none, and points the agent at
 * the first one.
 *
 * Guarded on "has no system presets" rather than "has no presets at all": an
 * account that deleted the defaults and built its own should not have them
 * silently reappear on the next page load.
 */
export async function ensureDefaultVoices(userId: number): Promise<void> {
  const existing = await prisma.whatsappAgentVoice.count({ where: { userId } });
  if (existing > 0) return;

  await ensureCatalogue();

  for (const preset of DEFAULT_PRESETS) {
    const voice = await prisma.aiVoice.findUnique({
      where: { provider_voiceId: { provider: preset.provider, voiceId: preset.voiceId } },
      select: { id: true },
    });

    await prisma.whatsappAgentVoice.upsert({
      where: { userId_name: { userId, name: preset.name } },
      update: {},
      create: { userId, voiceRef: voice?.id ?? null, isSystem: true, ...preset },
    });
  }

  const first = await prisma.whatsappAgentVoice.findFirst({
    where: { userId },
    orderBy: { id: 'asc' },
    select: { id: true },
  });

  if (first) {
    await prisma.whatsappAgent.updateMany({
      where: { userId, activeVoiceId: null },
      data: { activeVoiceId: first.id },
    });
  }
}

/** The agent's knowledge base, always complete. */
export async function getKb(userId: number) {
  const agent = await prisma.whatsappAgent.findUnique({ where: { userId }, select: { kb: true } });
  return normaliseKb(agent?.kb);
}

/**
 * The columns an account is allowed to write.
 *
 * An explicit allow-list, not a spread of req.body: the same row carries
 * `compiledPrompt`, `promptVersion` and the model foreign keys, and a blind
 * spread would let a seller point its agent at a model the admin disabled or
 * overwrite the compiled prompt with anything it liked.
 */
/**
 * Settings the PLATFORM owns, not the seller.
 *
 * These are tuning knobs, not business decisions: how much history to re-read
 * costs money per turn, the delays exist to make the agent feel human, the
 * model choices commit the platform to a provider, and the handoff keywords are
 * the customer's escape hatch — a seller who empties them removes it.
 *
 * An admin sets them per account through
 * PATCH /api/v1/admin/ai/accounts/:uuid/agent.
 */
export const ADMIN_ONLY_AGENT_FIELDS = [
  'historyMessages',
  'typingDelayMs',
  'replyDelayMs',
  'handoffKeywords',
  'sttModelId',
  'ttsModelId',
] as const;

export const WRITABLE_AGENT_FIELDS = [
  'enabled',
  'displayName',
  'timezone',
  'effort',
  'maxOutputTokens',
  'replyTo',
  'adKeywords',
  'workingHoursEnabled',
  'workingHoursStart',
  'workingHoursEnd',
  'afterHoursMessage',
  'afterConfirmed',
  'maxRepliesPerContact',
  'maxRepliesPerDay',
  'minSecondsBetweenReplies',
  'maxInputChars',
  'readImages',
  'readVideos',
  'videoFrames',
  'maxMediaMb',
  'maxMediaPerTurn',
  'sendCatalogueMedia',
  'sttEnabled',
  'sttPrompt',
  'ttsMode',
  'ttsRetries',
  'ttsVerify',
  'ttsOnFailure',
  'ttsTimeoutMs',
  'ttsMaxChars',
  'autoCreateLead',
] as const;

/** Numeric fields and the range each is clamped to. */
const NUMERIC_BOUNDS: Record<string, [number, number]> = {
  maxOutputTokens: [64, 4000],
  historyMessages: [4, 100],
  typingDelayMs: [0, 10_000],
  replyDelayMs: [0, 10_000],
  maxRepliesPerContact: [1, 500],
  maxRepliesPerDay: [1, 20_000],
  minSecondsBetweenReplies: [0, 600],
  maxInputChars: [200, 10_000],
  videoFrames: [1, 10],
  maxMediaMb: [1, 50],
  maxMediaPerTurn: [1, 10],
  ttsMaxChars: [40, 2000],
  ttsRetries: [0, 5],
  ttsTimeoutMs: [10000, 180000],
};

const ENUMS: Record<string, string[]> = {
  effort: ['low', 'medium', 'high', 'xhigh', 'max'],
  replyTo: ['all', 'ads_only'],
  afterConfirmed: ['support', 'stop'],
  ttsMode: ['never', 'mirror', 'always'],
  ttsVerify: ['never', 'live_only', 'always'],
  ttsOnFailure: ['text_only', 'fallback_edge'],
};

/**
 * Filters and clamps a settings patch.
 *
 * Clamping rather than rejecting is deliberate for the numeric fields: these
 * are sliders, and a seller who drags one to an absurd value wants the nearest
 * legal setting, not a form error. Enums do reject, because there is no nearest
 * legal value for a misspelt mode and silently picking one would be a surprise.
 */
export function sanitiseAgentPatch(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const key of WRITABLE_AGENT_FIELDS) {
    if (!(key in body)) continue;
    const value = body[key];

    if (key in NUMERIC_BOUNDS) {
      const [min, max] = NUMERIC_BOUNDS[key];
      const n = Math.trunc(Number(value));
      if (!Number.isFinite(n)) continue;
      out[key] = Math.min(max, Math.max(min, n));
      continue;
    }

    if (key in ENUMS) {
      const v = String(value);
      if (!ENUMS[key].includes(v)) {
        throw new Error(`Valeur invalide pour ${key} : "${v}".`);
      }
      out[key] = v;
      continue;
    }

    if (typeof value === 'boolean') {
      out[key] = value;
      continue;
    }

    if (value === null) {
      out[key] = null;
      continue;
    }

    out[key] = String(value).slice(0, 2000);
  }

  return out;
}

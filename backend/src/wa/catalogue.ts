/**
 * The AI model and voice catalogue the admin console manages.
 *
 * These are DEFAULTS, not a hardcoded list. They are upserted lazily the first
 * time anything reads the catalogue, the same way vendorSubAccount.routes.ts
 * upserts the VENDOR_HELPER role rather than relying on seed.ts — `prisma db
 * push` does not run the seed, so a fresh database would otherwise come up with
 * an empty catalogue and no account could pick a model.
 *
 * Upsert semantics are deliberately narrow: `create` carries everything,
 * `update` carries only the capability and cost columns. An admin who renames a
 * model, disables it, or moves it in the list keeps those edits across a
 * restart; an admin who is holding a stale price does not, because a wrong
 * price silently mis-reports what every account costs.
 */

import { prisma } from '../lib/prisma.js';

/**
 * VISION is kept in the union because the column and any legacy row can still
 * hold it — but it is NOT offered anywhere: admin/ai.routes.ts refuses it and
 * the seller's config no longer accepts a vision model. Photos are read by the
 * brain, inline, so the role never had a code path behind it.
 */
export type ModelRole = 'BRAIN' | 'VISION' | 'STT' | 'TTS';

interface ModelSeed {
  provider: string;
  modelId: string;
  label: string;
  role: ModelRole;
  isDefault?: boolean;
  isEnabled?: boolean;
  supportsEffort?: boolean;
  supportsVision?: boolean;
  supportsThinking?: boolean;
  supportsMidSystem?: boolean;
  supportsFallbacks?: boolean;
  adminOnly?: boolean;
  inputCostPerMTokCents?: number;
  outputCostPerMTokCents?: number;
  maxOutputTokens?: number;
  notes?: string;
  sortOrder?: number;
}

/**
 * Prices are in CENTS PER MILLION TOKENS, so $5.00/MTok is 500.
 *
 * Capability flags are not cosmetic — each one guards a request parameter that
 * is a 400 on a model that does not take it:
 *   supportsThinking  -> thinking: { type: 'adaptive' }
 *   supportsEffort    -> output_config: { effort }
 *   supportsMidSystem -> a mid-conversation { role: 'system' } message
 *   supportsFallbacks -> server-side refusal fallbacks
 */
export const DEFAULT_MODELS: ModelSeed[] = [
  // ---- brains ------------------------------------------------------------
  {
    provider: 'anthropic',
    modelId: 'claude-opus-5',
    label: 'Claude Opus 5',
    role: 'BRAIN',
    isDefault: true,
    supportsEffort: true,
    supportsVision: true,
    supportsThinking: true,
    supportsMidSystem: true,
    supportsFallbacks: true,
    inputCostPerMTokCents: 500,
    outputCostPerMTokCents: 2500,
    maxOutputTokens: 128000,
    notes:
      'Le meilleur choix par défaut. Seul modèle de la liste à accepter à la fois les messages système en cours de conversation (le contexte client reste hors du cache) et les fallbacks de refus.',
    sortOrder: 10,
  },
  {
    provider: 'anthropic',
    modelId: 'claude-sonnet-5',
    label: 'Claude Sonnet 5',
    role: 'BRAIN',
    supportsEffort: true,
    supportsVision: true,
    supportsThinking: true,
    supportsMidSystem: false,
    supportsFallbacks: false,
    inputCostPerMTokCents: 300,
    outputCostPerMTokCents: 1500,
    maxOutputTokens: 128000,
    notes:
      'Moins cher qu’Opus pour un gros volume. Refuse les messages système en cours de conversation : le contexte client est alors replié dans le dernier tour utilisateur.',
    sortOrder: 20,
  },
  {
    provider: 'anthropic',
    modelId: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
    role: 'BRAIN',
    supportsEffort: false,
    supportsVision: true,
    supportsThinking: false,
    supportsMidSystem: false,
    supportsFallbacks: false,
    inputCostPerMTokCents: 100,
    outputCostPerMTokCents: 500,
    maxOutputTokens: 8192,
    notes:
      'Le moins cher. Ni réflexion adaptative ni réglage d’effort — à réserver aux comptes à très gros volume et au discours de vente simple.',
    sortOrder: 30,
  },

  {
    provider: 'claude-cli',
    modelId: 'sonnet',
    label: 'Claude Sonnet — CLI (abonnement, admin uniquement)',
    role: 'BRAIN',
    isEnabled: false,
    adminOnly: true,
    supportsEffort: true,
    supportsVision: true,
    maxOutputTokens: 8192,
    notes:
      'Passe par le binaire claude et facture UN abonnement Claude, pas la clé API de la plateforme. Gratuit, mais 5–20s par réponse, une file de 2 réponses pour toute la plateforme, et aucun coût par compte à attribuer. Réservé aux tests et aux numéros de la plateforme — jamais aux comptes clients.',
    sortOrder: 90,
  },
  {
    provider: 'claude-cli',
    modelId: 'opus',
    label: 'Claude Opus — CLI (abonnement, admin uniquement)',
    role: 'BRAIN',
    isEnabled: false,
    adminOnly: true,
    supportsEffort: true,
    supportsVision: true,
    maxOutputTokens: 8192,
    notes: 'Comme ci-dessus, sur le modèle Opus de votre abonnement.',
    sortOrder: 91,
  },

  // ---- speech to text ----------------------------------------------------
  {
    provider: 'gemini',
    modelId: 'gemini-3.6-flash',
    label: 'Gemini 3.6 Flash — audio natif',
    role: 'STT',
    isDefault: true,
    notes:
      'Entend directement la note vocale. Meilleure précision mesurée sur de la darija réelle. Nécessite GEMINI_API_KEY.',
    sortOrder: 10,
  },
  // Les autres modèles audio joignables avec la MÊME clé Gemini. Aucun code
  // nouveau : le fournisseur `gemini` accepte n'importe quel identifiant, donc
  // ces lignes sont des candidats à comparer, pas une intégration.
  {
    provider: 'gemini',
    modelId: 'gemini-3.7-flash',
    label: 'Gemini 3.7 Flash — audio natif',
    role: 'STT',
    isEnabled: true,
    notes:
      'Meilleure transcription darija mesurée sur de vraies notes (sttCompare) — devant le 3.6, Munsit et Whisper. Candidat au rôle de moteur principal.',
    sortOrder: 11,
  },
  {
    provider: 'gemini',
    modelId: 'gemini-omni-flash-preview',
    label: 'Gemini Omni Flash (aperçu) — audio natif',
    role: 'STT',
    isEnabled: false,
    notes:
      "Modèle omni : l'audio est une entrée de premier ordre et non une pièce jointe. NON VÉRIFIÉ — son quota gratuit était épuisé à chaque essai, donc sa qualité en darija reste inconnue. À mesurer avec sttCompare avant de l'activer.",
    sortOrder: 12,
  },
  // Mesurés sur une vraie note (« بغيت غير وحدة أنا كاين في وجدة ») :
  //   3.7-flash      → exact
  //   3.5-flash      → « واحد » au lieu de « وحدة », mais lisible · ~18 s
  //   3.5-flash-lite → début abîmé, fin correcte · ~1,3 s
  // Aucun ne remplace le 3.7 ; tous les trois valent comme MAILLONS DE REPLI,
  // parce que le quota gratuit est de 20 requêtes par jour ET PAR MODÈLE : le
  // seul moyen gratuit d'aller au-delà est d'en aligner plusieurs.
  {
    provider: 'gemini',
    modelId: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash (aperçu) — audio natif',
    role: 'STT',
    isEnabled: true,
    notes: 'Transcription exacte sur la note de référence, à égalité avec le 3.7, mais deux fois plus lent (~6 s).',
    sortOrder: 16,
  },
  {
    provider: 'gemini',
    modelId: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite — audio natif',
    role: 'STT',
    isEnabled: true,
    notes: "Le meilleur rapport vitesse/précision des « lite » : ~2 s pour une transcription quasi exacte.",
    sortOrder: 17,
  },
  // gemini-2.5-flash et gemini-2.5-flash-lite sont ABSENTS volontairement :
  // ils apparaissent dans la liste des modèles de la clé mais répondent 404 à
  // generateContent. Une ligne de catalogue pour eux ne serait pas un candidat,
  // seulement un maillon de repli qui échoue en silence.
  {
    provider: 'gemini',
    modelId: 'gemini-3.5-flash',
    label: 'Gemini 3.5 Flash — audio natif',
    role: 'STT',
    isEnabled: true,
    notes: 'Qualité proche du 3.6, mais lent (~18 s mesurées). Utile comme maillon de repli, pas comme moteur principal.',
    sortOrder: 14,
  },
  {
    provider: 'gemini',
    modelId: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash Lite — audio natif',
    role: 'STT',
    isEnabled: true,
    notes: 'Le plus rapide des Gemini testés (~1,3 s) et le moins précis sur les premiers mots. Bon dernier maillon.',
    sortOrder: 15,
  },
  {
    provider: 'cohere',
    modelId: 'cohere-transcribe-arabic-07-2026',
    label: 'Cohere Transcribe Arabic — ASR dédié',
    role: 'STT',
    // Désactivé tant qu'il n'a pas été mesuré sur de vraies notes : c'est le
    // candidat le plus prometteur du catalogue, et c'est exactement pour ça
    // qu'il ne faut pas l'activer sur la foi de son argumentaire.
    isEnabled: false,
    notes:
      "Modèle ASR 2B dédié à l'arabe dialectal et à l'alternance codique. Le seul moteur du catalogue conçu pour la darija plutôt que généraliste. Nécessite COHERE_API_KEY. À mesurer avec sttCompare avant activation.",
    sortOrder: 18,
  },
  {
    provider: 'munsit',
    modelId: 'munsit-1',
    label: 'Munsit — ASR arabe',
    role: 'STT',
    notes:
      'ASR native darija, 25+ dialectes, sans paramètre de langue. Nécessite MUNSIT_API_KEY.',
    sortOrder: 20,
  },
  {
    provider: 'groq',
    modelId: 'whisper-large-v3-turbo',
    label: 'Groq — Whisper large v3 turbo',
    role: 'STT',
    // Left DISABLED on purpose. It is the fastest and cheapest of the three by
    // an order of magnitude, and the weakest on darija — Whisper is trained
    // overwhelmingly on Modern Standard Arabic. Worth having wired up as a
    // fallback and as the cheap side of a comparison; not worth making anyone's
    // default without listening to its transcripts first.
    isEnabled: false,
    notes:
      'Whisper hébergé. Le plus rapide et le moins cher (≈ $0.04/h), mais moins bon en darija que Gemini ou Munsit. Nécessite GROQ_API_KEY.',
    sortOrder: 30,
  },
  {
    provider: 'groq',
    modelId: 'whisper-large-v3',
    label: 'Groq — Whisper large v3 (complet)',
    role: 'STT',
    isEnabled: false,
    // `turbo` est une version DISTILLÉE : plus rapide, et c'est justement le
    // genre de compression qui coûte le plus cher sur une langue peu dotée.
    // Le modèle complet mérite d'être mesuré avant de condamner Whisper.
    notes: 'Whisper v3 non distillé, plus lent que le turbo. À comparer : le turbo perd du sens en darija.',
    sortOrder: 31,
  },
  {
    provider: 'openrouter',
    modelId: 'openai/gpt-4o-mini-transcribe',
    label: 'OpenRouter — GPT-4o mini transcribe',
    role: 'STT',
    // One seeded row, but the provider is not limited to it: `modelId` is free
    // text on the AI Models page, so any transcription slug OpenRouter carries
    // can be added as a new row without touching this file.
    isEnabled: false,
    notes:
      "Via OpenRouter : n'importe quel modèle STT du catalogue OpenRouter s'utilise en créant une ligne avec son identifiant (openai/whisper-1, openai/gpt-4o-transcribe…). Nécessite OPENROUTER_API_KEY.",
    sortOrder: 40,
  },
  // Les trois modèles multimodaux GRATUITS d'OpenRouter, appelés par
  // /chat/completions. Ce ne sont pas des moteurs de transcription : ce sont
  // des modèles de conversation à qui on demande de transcrire. À juger sur de
  // vraies notes avant d'en mettre un dans une chaîne de repli — un modèle qui
  // RÉPOND au client au lieu de l'écrire est pire qu'un moteur en panne.
  {
    provider: 'openrouter-chat',
    modelId: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    label: 'OpenRouter — Nemotron 3 Nano Omni (gratuit)',
    role: 'STT',
    isEnabled: false,
    notes: 'Modèle omni gratuit (texte, audio, image, vidéo). Aucun crédit OpenRouter requis.',
    sortOrder: 50,
  },
  {
    provider: 'openrouter-chat',
    modelId: 'thinkingmachines/inkling:free',
    label: 'OpenRouter — Inkling (gratuit)',
    role: 'STT',
    isEnabled: false,
    notes: 'Multimodal gratuit (texte, image, audio). Aucun crédit OpenRouter requis.',
    sortOrder: 51,
  },
  {
    provider: 'openrouter-chat',
    modelId: 'thinkingmachines/inkling-small:free',
    label: 'OpenRouter — Inkling Small (gratuit)',
    role: 'STT',
    isEnabled: false,
    notes: 'Version plus petite et plus rapide d’Inkling. Gratuite.',
    sortOrder: 52,
  },

  // ---- speech out --------------------------------------------------------
  //
  // Ordered as the default fallback chain, and the Live model is the default
  // ON PURPOSE. A `*-native-audio` / `*-live` model speaks conversationally
  // rather than reading aloud, which is the difference between a voice note
  // that sounds like a person and one that sounds like a menu system. It is
  // also preview-tier and fails often, which is why the chain below exists and
  // why every Live take is checked against its own transcript before it is
  // sent (see wa/speech.ts).
  {
    provider: 'gemini',
    modelId: 'gemini-2.5-flash-native-audio-preview-12-2025',
    label: 'Gemini 2.5 Flash — audio natif (Live, conversationnel)',
    role: 'TTS',
    isDefault: true,
    notes:
      'La voix la plus naturelle : conversationnelle, pas lue à voix haute. Modèle Live (WebSocket). Attention, il RÉPOND au texte au lieu de le lire si on ne le contraint pas — chaque prise est vérifiée par transcription avant envoi. Nécessite GEMINI_API_KEY.',
    sortOrder: 10,
  },
  {
    provider: 'gemini',
    modelId: 'gemini-3.1-flash-tts-preview',
    label: 'Gemini 3.1 Flash TTS (aperçu)',
    role: 'TTS',
    notes: 'Deuxième maillon de la chaîne par défaut. Lecture à voix haute, plus stable que le Live.',
    sortOrder: 20,
  },
  {
    provider: 'gemini',
    modelId: 'gemini-2.5-flash-preview-tts',
    label: 'Gemini 2.5 Flash TTS',
    role: 'TTS',
    notes:
      'Troisième maillon. Pas de réglage de vitesse : le débit et l’émotion se décrivent en toutes lettres dans l’instruction de jeu.',
    sortOrder: 30,
  },
  {
    provider: 'gemini',
    modelId: 'gemini-2.5-pro-preview-tts',
    label: 'Gemini 2.5 Pro TTS',
    role: 'TTS',
    notes: 'Dernier maillon de la chaîne par défaut.',
    sortOrder: 40,
  },
  {
    provider: 'gemini',
    modelId: 'gemini-3.1-flash-live-preview',
    label: 'Gemini 3.1 Flash — Live (aperçu)',
    role: 'TTS',
    isEnabled: false,
    notes: 'Autre modèle Live. À activer si la qualité vous convient.',
    sortOrder: 50,
  },
  {
    provider: 'edge',
    modelId: 'edge-neural',
    label: 'Microsoft Edge — voix neuronales',
    role: 'TTS',
    notes:
      'Gratuit, sans clé, et le seul moteur avec une vraie voix arabe marocaine. Vitesse, hauteur et volume réglables (SSML). Sert aussi de repli si vous choisissez « fallback_edge ».',
    sortOrder: 60,
  },
];

/**
 * The default TTS fallback chain, as "provider:model" links tried in order
 * after whichever model the account selected.
 *
 * This is the standalone project's measured chain: the conversational Live
 * model first, then progressively more boring but more reliable read-aloud
 * models. Each link is retried before moving on.
 */
export const DEFAULT_TTS_CHAIN = [
  'gemini:gemini-2.5-flash-native-audio-preview-12-2025',
  'gemini:gemini-3.1-flash-tts-preview',
  'gemini:gemini-2.5-flash-preview-tts',
  'gemini:gemini-2.5-pro-preview-tts',
];

interface VoiceSeed {
  provider: string;
  voiceId: string;
  label: string;
  locale?: string;
  gender?: string;
  isDefault?: boolean;
  supportsProsody?: boolean;
  supportsStyle?: boolean;
  styles?: string[];
  sortOrder?: number;
}

/**
 * The Edge voices come first and the Moroccan ones first of all: this platform
 * sells into Morocco, and ar-MA is the only true Darija-sounding option in any
 * free engine.
 *
 * `supportsProsody` is true for every Edge voice because Edge speaks SSML, so
 * rate/pitch/volume are real controls. `supportsStyle` is left false for them:
 * `mstts:express-as` is only honoured by a handful of Microsoft voices and is
 * silently ignored — or worse, breaks synthesis — on the rest, and none of the
 * Arabic voices support it. Emotion on Edge therefore comes from prosody; on
 * Gemini it comes from the free-text style instruction, which is why the two
 * capability flags are inverted between the providers.
 */
export const DEFAULT_VOICES: VoiceSeed[] = [
  { provider: 'edge', voiceId: 'ar-MA-MounaNeural', label: 'Mouna — arabe marocain (femme)', locale: 'ar-MA', gender: 'FEMALE', supportsProsody: true, sortOrder: 10 },
  { provider: 'edge', voiceId: 'ar-MA-JamalNeural', label: 'Jamal — arabe marocain (homme)', locale: 'ar-MA', gender: 'MALE', supportsProsody: true, sortOrder: 20 },
  { provider: 'edge', voiceId: 'ar-EG-SalmaNeural', label: 'Salma — arabe égyptien (femme)', locale: 'ar-EG', gender: 'FEMALE', supportsProsody: true, sortOrder: 30 },
  { provider: 'edge', voiceId: 'ar-EG-ShakirNeural', label: 'Shakir — arabe égyptien (homme)', locale: 'ar-EG', gender: 'MALE', supportsProsody: true, sortOrder: 40 },
  { provider: 'edge', voiceId: 'ar-SA-ZariyahNeural', label: 'Zariyah — arabe standard (femme)', locale: 'ar-SA', gender: 'FEMALE', supportsProsody: true, sortOrder: 50 },
  { provider: 'edge', voiceId: 'ar-SA-HamedNeural', label: 'Hamed — arabe standard (homme)', locale: 'ar-SA', gender: 'MALE', supportsProsody: true, sortOrder: 60 },
  { provider: 'edge', voiceId: 'fr-FR-DeniseNeural', label: 'Denise — français (femme)', locale: 'fr-FR', gender: 'FEMALE', supportsProsody: true, sortOrder: 70 },
  { provider: 'edge', voiceId: 'fr-FR-HenriNeural', label: 'Henri — français (homme)', locale: 'fr-FR', gender: 'MALE', supportsProsody: true, sortOrder: 80 },
  { provider: 'edge', voiceId: 'en-US-AriaNeural', label: 'Aria — anglais (femme)', locale: 'en-US', gender: 'FEMALE', supportsProsody: true, supportsStyle: true, styles: ['cheerful', 'empathetic', 'excited', 'friendly', 'hopeful', 'sad', 'unfriendly', 'whispering'], sortOrder: 90 },
  { provider: 'edge', voiceId: 'en-US-GuyNeural', label: 'Guy — anglais (homme)', locale: 'en-US', gender: 'MALE', supportsProsody: true, sortOrder: 100 },
];

/**
 * Gemini's prebuilt speech voices. The API exposes no list endpoint, so this is
 * the list. Every one of them is steerable in words, which is where "emotion"
 * actually lives for this provider.
 */
const GEMINI_VOICES = [
  'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede',
  'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba',
  'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar',
  'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi',
  'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat',
];

/**
 * Sulafat is the platform default, not an arbitrary pick from the list: it is
 * the voice the standalone project settled on after listening to the others on
 * real Darija replies. `sortOrder` puts it first so an account sees it before
 * the other twenty-nine.
 */
const DEFAULT_GEMINI_VOICE = 'Sulafat';

for (const [i, name] of GEMINI_VOICES.entries()) {
  const isDefault = name === DEFAULT_GEMINI_VOICE;
  DEFAULT_VOICES.push({
    provider: 'gemini',
    voiceId: name,
    label: `${name} — Gemini`,
    gender: undefined,
    isDefault,
    // No prosody parameters at all on this provider: speed and emotion are
    // described in words in the preset's style instruction instead.
    supportsProsody: false,
    supportsStyle: true,
    sortOrder: isDefault ? 199 : 200 + i,
  });
}

let seeded = false;

/**
 * Writes the defaults if they are missing. Safe to call on every request — it
 * short-circuits on a module flag after the first success, and the upserts are
 * idempotent, so two workers racing at boot cannot duplicate a row (the unique
 * constraints decide).
 */
export async function ensureCatalogue(): Promise<void> {
  if (seeded) return;

  try {
    for (const m of DEFAULT_MODELS) {
      const capabilities = {
        label: m.label,
        supportsEffort: !!m.supportsEffort,
        supportsVision: !!m.supportsVision,
        supportsThinking: !!m.supportsThinking,
        supportsMidSystem: !!m.supportsMidSystem,
        supportsFallbacks: !!m.supportsFallbacks,
        adminOnly: !!m.adminOnly,
        inputCostPerMTokCents: m.inputCostPerMTokCents ?? 0,
        outputCostPerMTokCents: m.outputCostPerMTokCents ?? 0,
        maxOutputTokens: m.maxOutputTokens ?? 4096,
      };

      await prisma.aiModel.upsert({
        where: { provider_modelId_role: { provider: m.provider, modelId: m.modelId, role: m.role } },
        // Capabilities and prices are corrected on every boot; isEnabled,
        // isDefault, notes and sortOrder are the admin's and are left alone.
        update: capabilities,
        create: {
          provider: m.provider,
          modelId: m.modelId,
          role: m.role,
          isEnabled: m.isEnabled ?? true,
          isDefault: !!m.isDefault,
          notes: m.notes ?? null,
          sortOrder: m.sortOrder ?? 0,
          ...capabilities,
        },
      });
    }

    for (const v of DEFAULT_VOICES) {
      await prisma.aiVoice.upsert({
        where: { provider_voiceId: { provider: v.provider, voiceId: v.voiceId } },
        update: {
          supportsProsody: !!v.supportsProsody,
          supportsStyle: !!v.supportsStyle,
          styles: v.styles ?? [],
        },
        create: {
          provider: v.provider,
          voiceId: v.voiceId,
          label: v.label,
          locale: v.locale ?? null,
          gender: v.gender ?? null,
          isDefault: !!v.isDefault,
          supportsProsody: !!v.supportsProsody,
          supportsStyle: !!v.supportsStyle,
          styles: v.styles ?? [],
          sortOrder: v.sortOrder ?? 0,
        },
      });
    }

    // Backfill: an agent created before the fallback chain existed carries an
    // empty one, which would leave it doing a single-shot call to a
    // preview-tier Live model and silently dropping most voice notes.
    //
    // Only ever fills an EMPTY chain. An account that has configured its own —
    // including deliberately clearing it down to one link — is never
    // overwritten, because `isEmpty` stops matching the moment they save one.
    await prisma.whatsappAgent.updateMany({
      where: { ttsChain: { isEmpty: true } },
      data: { ttsChain: DEFAULT_TTS_CHAIN },
    });

    seeded = true;
  } catch (err) {
    // Never block a request on catalogue seeding. Leaving `seeded` false means
    // the next call tries again, which is what we want after a transient
    // database blip at boot.
    console.error('[wa/catalogue] seeding failed:', err);
  }
}

/**
 * The models an ACCOUNT may pick for a role.
 *
 * adminOnly rows are excluded here rather than filtered in the UI: this is what
 * the account-facing /models endpoint returns, and a model that never appears
 * cannot be guessed at by id either (the config route re-checks).
 */
export async function listModels(role: ModelRole) {
  await ensureCatalogue();
  return prisma.aiModel.findMany({
    where: { role, isEnabled: true, adminOnly: false },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
}

/**
 * The model an account should use for a role: its own choice when that row is
 * still enabled, otherwise the platform default, otherwise the first enabled
 * row. Returning null is a real outcome — it means the admin has enabled
 * nothing for this role, and the caller must say so rather than guess an id.
 */
export async function resolveModel(role: ModelRole, preferredId?: number | null) {
  await ensureCatalogue();

  // An explicit assignment is honoured even when the model is adminOnly, and
  // that is the point: an admin putting the CLI engine on a platform-owned
  // account through PATCH /admin/ai/accounts/:uuid/agent must actually take
  // effect. Nothing an ACCOUNT can do reaches this branch with an adminOnly id
  // — listModels() never shows one and the config route re-checks
  // `adminOnly: false` before writing brainModelId — so the write path is where
  // the gate lives, not here.
  if (preferredId) {
    const chosen = await prisma.aiModel.findFirst({ where: { id: preferredId, role, isEnabled: true } });
    if (chosen) return chosen;
  }

  // The fallback never lands on an adminOnly model: an account whose assigned
  // model was disabled must drop to an ordinary one, not silently start billing
  // somebody's personal Claude subscription.
  return (
    (await prisma.aiModel.findFirst({
      where: { role, isEnabled: true, adminOnly: false, isDefault: true },
      orderBy: { sortOrder: 'asc' },
    })) ??
    (await prisma.aiModel.findFirst({
      where: { role, isEnabled: true, adminOnly: false },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    }))
  );
}

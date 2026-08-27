/**
 * Ears and voice for the agent.
 *
 *   speech-to-text : Gemini native audio (default) or Munsit — both Darija-capable
 *   text-to-speech : Gemini Live (native audio) -> Gemini REST TTS -> optionally Edge
 *
 * THE TTS STRATEGY IS THE STANDALONE PROJECT'S, ported whole, because it was
 * arrived at by testing against real Moroccan customers and every part of it
 * exists to stop a specific failure that was actually observed:
 *
 *   LIVE MODELS ANSWER INSTEAD OF READING. `*-native-audio` and `*-live` models
 *   are conversational. Handed "Your order is confirmed, we deliver tomorrow"
 *   they will happily reply to it, and the customer hears the agent talking to
 *   itself. Two guards: a system instruction that says it is a TTS engine and
 *   must speak verbatim, and `outputAudioTranscription` so we can read back what
 *   it really said and REJECT the audio when it drifted.
 *
 *   PREVIEW MODELS FAIL. The good voice is preview-tier. A single-shot call
 *   drops voice replies on real traffic, so there is an ordered chain of models,
 *   each retried, before giving up.
 *
 *   NEVER SILENTLY SWAP THE VOICE. When the chain is exhausted the default is
 *   `text_only`: the text reply still goes out and no voice note is sent. A
 *   customer who has been hearing one person suddenly hearing another is worse
 *   than no voice note. `fallback_edge` is opt-in.
 *
 *   ARABIZI CANNOT BE READ BY AN ARABIC VOICE. "3ndi lik b7al hakka" is Darija,
 *   but an `ar-*` voice reads Latin letters phonetically and produces gibberish.
 *   It is transliterated to Arabic script first, and if that fails the voice note
 *   is abandoned rather than sent as nonsense.
 *
 * WHERE "VOICE, SPEED AND EMOTION" LIVE, per engine:
 *   Gemini has no prosody parameters. Delivery — accent, pace, emotion — is
 *   described in words in the style instruction, which is why the Darija accent
 *   prompt is the important setting there.
 *   Edge speaks SSML, so rate/pitch/volume are real numbers, and a few voices
 *   (none of them Arabic) take a named emotion via `mstts:express-as`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { getSecret } from '../lib/secretStore.js';
import { waLog, type WaLogRef } from '../services/waLogs.service.js';

export interface VoicePreset {
  provider: string;
  voiceId: string;
  /** Percent deltas. Edge only — Gemini ignores them, see paceInWords(). */
  rate: number;
  pitch: number;
  volume: number;
  /** Named emotion, for engines with a fixed list. */
  style?: string | null;
  styleDegree?: number | null;
  /** Free-text delivery instruction, for engines steered in words. */
  stylePrompt?: string | null;
  stability?: number | null;
  similarityBoost?: number | null;
}

/** Everything about how a reply is spoken that is not the voice itself. */
export interface TtsPolicy {
  /** Primary "provider:model", then each fallback, in order. */
  chain: string[];
  retries: number;
  verify: 'never' | 'live_only' | 'always';
  onFailure: 'text_only' | 'fallback_edge';
  timeoutMs: number;
  /** Used by the verify pass to transcribe the audio back. */
  sttProvider?: string;
  sttModelId?: string;
}

/** Runs a binary and resolves its stdout. Used for the ffmpeg audio remux. */
const run = (bin: string, args: string[], timeout = 120_000): Promise<string> =>
  new Promise((resolve, reject) => {
    execFile(bin, args, { timeout, maxBuffer: 1 << 26 }, (err, stdout, stderr) =>
      err
        ? reject(new Error(`${bin}: ${String(stderr || err.message).slice(-300)}`))
        : resolve(String(stdout))
    );
  });

const ffmpeg = () => getSecret('FFMPEG_PATH') || 'ffmpeg';

/** XML-escapes text going into an SSML document. */
function xmlEscape(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** `20` -> `"+20%"`, `-15` -> `"-15%"`, `0` -> `"+0%"`. */
const pct = (n: number): string => `${n >= 0 ? '+' : ''}${Math.trunc(n || 0)}%`;

/**
 * Live-API models speak over a WebSocket session; the `*-tts` models use REST.
 * Derived from the id rather than stored on AiModel so a model an admin adds
 * later is routed correctly without them having to know the difference.
 */
export const isLiveModel = (m: string | null | undefined): boolean =>
  /live|native-audio/i.test(String(m || ''));

/** Which script is this text mostly written in? */
function scriptOf(text: string): 'arabic' | 'latin' | 'none' {
  const t = String(text || '');
  const arabic = (t.match(/[؀-ۿ]/g) || []).length;
  const latin = (t.match(/[A-Za-z]/g) || []).length;
  if (!arabic && !latin) return 'none';
  return arabic >= latin ? 'arabic' : 'latin';
}

/** Voices that pronounce Arabic. Handed Latin letters they spell out nonsense. */
const isArabicVoice = (voice: string): boolean => /^ar-/i.test(String(voice || ''));

/* ------------------------------------------------------------------ */
/* speech to text                                                     */
/* ------------------------------------------------------------------ */

export interface TranscribeResult {
  text: string;
  provider: string;
  /**
   * What the vendor says the call cost, in INTEGER CENTS, when it says at all.
   *
   * Only OpenRouter reports this today. It is carried into the activity log's
   * costCents column so an admin can see what transcription actually costs
   * against what the account was charged — the same question
   * WhatsappAgentUsage answers for the brain.
   */
  costCents?: number | null;
  /** Seconds of audio billed, when the vendor reports it. */
  audioSeconds?: number | null;
  /** Set when the primary engine did not produce this transcript. */
  fellBackFrom?: string | null;
  /** One line per failed attempt, for the activity log. */
  attempts?: string[];
}

/**
 * Transcribes a voice note.
 *
 * Throws with a message written for the activity log rather than for a
 * developer: a dead key must be visible degradation the account can act on, not
 * silent data loss. When this throws the voice note still reaches the inbox and
 * the agent asks the customer to type instead.
 */
export async function transcribe(
  filePath: string,
  mime: string,
  opts: {
    provider: string;
    modelId: string;
    prompt?: string | null;
    log?: WaLogRef | null;
    /** Engines tried after the primary, each "provider:modelId". */
    chain?: string[] | null;
    /** Extra attempts per link before moving on. */
    retries?: number | null;
  }
): Promise<TranscribeResult> {
  const startedAt = Date.now();
  const ref = opts.log || {};

  try {
    const result = await runChain(filePath, mime, opts);

    // The transcript IS the customer's message as far as the model is
    // concerned. Logging it at INFO is the whole point: when a seller says the
    // agent answered something unrelated, this row usually shows why.
    waLog({
      ...ref,
      // A note rescued by a fallback reads as a success everywhere else in the
      // product. It is a WARN here on purpose: it means the primary engine is
      // refusing, and nobody finds that out until the fallback runs out too.
      level: result.text && !result.fellBackFrom ? 'INFO' : 'WARN',
      category: 'STT',
      event: 'stt.transcribed',
      message: result.fellBackFrom
        ? `Note vocale transcrite par ${result.provider} après le repli (${result.fellBackFrom}) : « ${String(
            result.text
          ).slice(0, 120)} »`
        : result.text
          ? `Note vocale transcrite : « ${String(result.text).slice(0, 160)} »`
          : 'Note vocale transcrite, mais vide — le client n’a rien dit d’audible.',
      request: {
        provider: opts.provider,
        modelId: opts.modelId,
        mime,
        prompt: opts.prompt || null,
        chain: opts.chain || [],
      },
      response: {
        text: result.text,
        provider: result.provider,
        fellBackFrom: result.fellBackFrom ?? null,
        attempts: result.attempts ?? [],
      },
      meta: {
        provider: opts.provider,
        modelId: opts.modelId,
        chars: String(result.text || '').length,
        audioSeconds: result.audioSeconds ?? null,
      },
      costCents: result.costCents ?? null,
      durationMs: Date.now() - startedAt,
    });

    return result;
  } catch (err) {
    waLog({
      ...ref,
      category: 'STT',
      event: 'stt.failed',
      message: 'La note vocale n’a pas pu être transcrite ; le client devra écrire.',
      request: { provider: opts.provider, modelId: opts.modelId, mime, chain: opts.chain || [] },
      response: { attempts: (err as { attempts?: string[] }).attempts ?? [] },
      // Named in meta as well as in the request body: meta is what the log
      // screen groups on, and a failure that cannot be grouped by engine is
      // the one row you actually want to count per engine.
      meta: { provider: opts.provider, modelId: opts.modelId, chainLength: (opts.chain || []).length },
      error: err,
      durationMs: Date.now() - startedAt,
    });
    throw err;
  }
}

/**
 * The primary engine, then each fallback link, until one produces a transcript.
 *
 * WHAT ADVANCES THE CHAIN: any failure at all — a rate limit, an exhausted key,
 * a dead credential, a 5xx, or an empty transcript. Empty is included
 * deliberately. It is indistinguishable from "the customer said nothing", but
 * it is also exactly what a degraded engine returns, and the cost of asking a
 * second engine about a genuinely silent note is one wasted call on a fifteen
 * second file. The cost of NOT asking is the agent answering a question it
 * never heard.
 *
 * Links are de-duplicated so listing the primary again in the chain does not
 * try it twice, and an unknown provider is recorded and skipped rather than
 * killing the chain — the whole point is that the last link still runs.
 */
async function runChain(
  filePath: string,
  mime: string,
  opts: {
    provider: string;
    modelId: string;
    prompt?: string | null;
    chain?: string[] | null;
    retries?: number | null;
  }
): Promise<TranscribeResult> {
  const primary = `${opts.provider}:${opts.modelId}`;
  const links = [primary, ...(opts.chain || [])]
    .map((entry) => String(entry).trim())
    .filter((entry, i, all) => entry && all.indexOf(entry) === i);

  const perLink = Math.min(4, Math.max(1, Math.trunc(Number(opts.retries) || 0) + 1));
  const attempts: string[] = [];

  for (const link of links) {
    // Split on the FIRST colon only: an OpenRouter slug is itself
    // "openai/whisper-1", and a naive split would lose everything after it.
    const separator = link.indexOf(':');
    const provider = separator === -1 ? link : link.slice(0, separator);
    const modelId = separator === -1 ? '' : link.slice(separator + 1);

    const engine = STT_ENGINES[provider];
    if (!engine) {
      attempts.push(`${link}: moteur inconnu`);
      continue;
    }

    for (let attempt = 0; attempt < perLink; attempt++) {
      try {
        const result = await engine(filePath, mime, { ...opts, modelId });
        if (!result.text?.trim()) throw new Error('transcription vide');

        return {
          ...result,
          fellBackFrom: link === primary ? null : `${primary} a échoué`,
          attempts,
        };
      } catch (err) {
        attempts.push(`${link}#${attempt + 1}: ${String((err as Error).message).slice(0, 120)}`);
      }
    }
  }

  // The message carries the last few attempts, because "transcription failed"
  // on its own sends whoever reads it to check a key that was never the
  // problem. The COMPLETE trail rides on the error object, so the activity log
  // records every link rather than the tail that fit in a sentence.
  const failure = new Error(
    links.length > 1
      ? `Aucun moteur de transcription n'a abouti. ${attempts.slice(-3).join(' | ')}`
      : attempts[attempts.length - 1] || 'Transcription impossible.'
  ) as Error & { attempts?: string[] };
  failure.attempts = attempts;
  throw failure;
}

/** What every engine below is called with. */
type SttEngine = (
  filePath: string,
  mime: string,
  opts: { modelId: string; prompt?: string | null }
) => Promise<TranscribeResult>;

/**
 * The engines, by AiModel.provider.
 *
 * A table rather than an if-chain because this is the half of the feature the
 * admin console cannot see: `provider` is a free-text field on the AI Models
 * page, so a row can be created for an engine that has no code behind it. The
 * lookup failing by name is what turns that into one clear message in the
 * activity log instead of a request sent to the wrong vendor's API.
 */
const STT_ENGINES: Record<string, SttEngine> = {
  gemini: (filePath, mime, opts) => transcribeGemini(filePath, mime, opts),
  munsit: (filePath, mime) => transcribeMunsit(filePath, mime),
  groq: (filePath, mime, opts) => transcribeGroq(filePath, mime, opts),
  openrouter: (filePath, mime, opts) => transcribeOpenRouter(filePath, mime, opts),
  'openrouter-chat': (filePath, mime, opts) => transcribeOpenRouterChat(filePath, mime, opts),
  cohere: (filePath, mime, opts) => transcribeCohere(filePath, mime, opts),
};

async function transcribeGemini(
  filePath: string,
  mime: string,
  opts: { modelId: string; prompt?: string | null }
): Promise<TranscribeResult> {
  const key = getSecret('GEMINI_API_KEY');
  if (!key) throw new Error('Aucune clé Gemini (GEMINI_API_KEY) — transcription impossible.');

  const audio = fs.readFileSync(filePath).toString('base64');
  const instruction =
    opts.prompt?.trim() ||
    'Transcribe this voice note verbatim. It is most likely Moroccan Darija, possibly mixed with French. Return only the transcription, no commentary.';

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      opts.modelId
    )}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: instruction }, { inlineData: { mimeType: mime || 'audio/ogg', data: audio } }],
          },
        ],
      }),
      signal: AbortSignal.timeout(90_000),
    }
  );

  if (res.status === 429) throw new Error('Limite de débit Gemini atteinte — note vocale non transcrite.');
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini a refusé la transcription (${res.status}). ${body.slice(0, 200)}`);
  }

  const json: any = await res.json();
  const text = (json?.candidates?.[0]?.content?.parts || [])
    .map((p: any) => p?.text || '')
    .join('')
    .trim();

  if (!text) throw new Error('Gemini a renvoyé une transcription vide.');
  return { text, provider: 'gemini' };
}

async function transcribeMunsit(filePath: string, mime: string): Promise<TranscribeResult> {
  const key = getSecret('MUNSIT_API_KEY');
  if (!key) throw new Error('Aucune clé Munsit (MUNSIT_API_KEY) — transcription impossible.');

  // WhatsApp ogg/opus is posted as-is: Munsit transcribes it better than a
  // re-encode to mp3, and re-encoding costs an ffmpeg round trip per note.
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(filePath)], { type: mime || 'audio/ogg' }), path.basename(filePath));

  const res = await fetch('https://api.munsit.com/api/v1/audio/transcribe', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(90_000),
  });

  if (res.status === 401)
    throw new Error('Munsit a rejeté la clé API (401). Générez-en une nouvelle et mettez-la à jour.');
  if (res.status === 429) throw new Error('Limite de débit Munsit atteinte — note vocale non transcrite.');
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Munsit a échoué (${res.status}). ${body.slice(0, 200)}`);
  }

  const json: any = await res.json();

  // The transcript is NESTED: Munsit answers
  // `{ statusCode, data: { transcription, duration, stats }, message }`.
  // Reading `json.transcription` at the top level — which this did until the
  // engine comparison exposed it — finds nothing on every single call and
  // reports "transcription vide", so Munsit looked broken while it was in fact
  // answering correctly in under a second. The top-level spellings are kept as
  // fallbacks in case the envelope changes back.
  const text = String(json?.data?.transcription || json?.text || json?.transcription || '').trim();
  if (!text) throw new Error('Munsit a renvoyé une transcription vide.');

  const seconds = Number(json?.data?.duration);

  return {
    text,
    provider: 'munsit',
    // Munsit bills in its OWN credits, not in cents, so this deliberately does
    // not go into costCents — that column is money and mixing a second unit
    // into it would make the finance view silently wrong.
    audioSeconds: Number.isFinite(seconds) ? seconds : null,
  };
}

/**
 * Whisper large v3, hosted on Groq.
 *
 * WHY IT IS HERE. It is the cheapest and by a distance the fastest engine of
 * the three — an order of magnitude below the others per hour of audio, and it
 * returns a fifteen-second note effectively instantly. That matters more than
 * the money: transcription sits on the critical path between the customer
 * pressing send and the agent starting to think, so every second here is a
 * second of silence in the chat.
 *
 * WHAT IT IS NOT. Whisper is trained on Modern Standard Arabic far more than on
 * darija, so on real Moroccan speech it is expected to read WORSE than Gemini
 * or Munsit. Enable it for speed, for a fallback when Gemini is rate-limited,
 * or as the cheap side of an A/B — not on the assumption that cheaper and
 * faster also means better here. Compare the transcripts on your own notes
 * before switching an account over.
 *
 * The endpoint is OpenAI-shaped, so this same function serves any
 * OpenAI-compatible transcription host: only the base URL, the key and the
 * model id differ.
 */
async function transcribeGroq(
  filePath: string,
  mime: string,
  opts: { modelId: string; prompt?: string | null }
): Promise<TranscribeResult> {
  const key = getSecret('GROQ_API_KEY');
  if (!key) throw new Error('Aucune clé Groq (GROQ_API_KEY) — transcription impossible.');

  const form = new FormData();
  // Posted as-is, like Munsit: Whisper reads ogg/opus natively and an ffmpeg
  // round trip per note would give back the latency this engine is chosen for.
  form.append(
    'file',
    new Blob([fs.readFileSync(filePath)], { type: mime || 'audio/ogg' }),
    path.basename(filePath)
  );
  form.append('model', opts.modelId || 'whisper-large-v3-turbo');
  form.append('response_format', 'json');

  // 'ar' is the closest ISO-639-1 code darija has, and pinning it is the lesser
  // evil: left to auto-detect, Whisper hears a Moroccan sentence carrying a few
  // French words and transcribes the whole note as French. It is a hint, not a
  // filter — the model still returns the French passages of a mixed note.
  form.append('language', 'ar');

  // Whisper's prompt is a STYLE primer, not an instruction: it conditions
  // spelling and register from an example, and it does not obey commands. The
  // account's sttPrompt is written for Gemini ("Transcribe this verbatim…"),
  // so passing it here would put an English sentence into the model's mouth and
  // corrupt the first line of the transcript. Only a short vocabulary hint is
  // safe, and we have none to give per account, so nothing is sent.

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(90_000),
  });

  if (res.status === 401)
    throw new Error('Groq a rejeté la clé API (401). Vérifiez GROQ_API_KEY dans Variables & Secrets.');
  if (res.status === 429) throw new Error('Limite de débit Groq atteinte — note vocale non transcrite.');
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Groq a refusé la transcription (${res.status}). ${body.slice(0, 200)}`);
  }

  const json: any = await res.json();
  const text = String(json?.text || '').trim();
  if (!text) throw new Error('Groq a renvoyé une transcription vide.');
  return { text, provider: 'groq' };
}

/**
 * OpenRouter, mais par /chat/completions au lieu de /audio/transcriptions.
 *
 * POURQUOI DEUX CHEMINS VERS LE MÊME FOURNISSEUR. L'endpoint de transcription
 * n'accepte que des modèles STT dédiés, tous payants. Les modèles multimodaux
 * — eux — entendent l'audio comme n'importe quelle autre entrée, et TROIS
 * d'entre eux sont gratuits sur OpenRouter. Sur un compte sans crédit, ce
 * chemin est le seul qui répond.
 *
 * CE N'EST PAS UN MOTEUR DE TRANSCRIPTION, et il ne faut pas l'oublier en
 * lisant ses sorties : c'est un modèle de conversation à qui on demande de
 * transcrire. Il peut commenter, résumer, traduire, ou répondre à ce que dit le
 * client au lieu de l'écrire. L'instruction ci-dessous est écrite contre
 * exactement ces quatre dérives, et la comparaison sur de vraies notes reste le
 * seul moyen de savoir s'il obéit.
 */
async function transcribeOpenRouterChat(
  filePath: string,
  mime: string,
  opts: { modelId: string; prompt?: string | null }
): Promise<TranscribeResult> {
  const key = getSecret('OPENROUTER_API_KEY');
  if (!key) throw new Error('Aucune clé OpenRouter (OPENROUTER_API_KEY) — transcription impossible.');
  if (!opts.modelId) throw new Error('Aucun modèle OpenRouter sélectionné pour la transcription.');

  const instruction =
    opts.prompt?.trim() ||
    'Transcribe this voice note verbatim. It is most likely Moroccan Darija, possibly mixed with French. ' +
      'Return ONLY the transcription: no translation, no summary, no commentary, and never answer what the speaker says.';

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: opts.modelId,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: instruction },
            {
              type: 'input_audio',
              // Base64 brut, jamais une data: URI — comme sur l'endpoint de
              // transcription, le préfixe fait échouer la requête.
              input_audio: { data: fs.readFileSync(filePath).toString('base64'), format: audioFormat(mime) },
            },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (res.status === 401)
    throw new Error('OpenRouter a rejeté la clé API (401). Vérifiez OPENROUTER_API_KEY dans Variables & Secrets.');
  if (res.status === 402)
    throw new Error('Crédits OpenRouter épuisés (402) — ce modèle est payant, ou rechargez le compte.');
  if (res.status === 429) throw new Error('Limite de débit OpenRouter atteinte — note vocale non transcrite.');
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenRouter a refusé la transcription (${res.status}). ${body.slice(0, 200)}`);
  }

  const json: any = await res.json();

  // Une erreur de fournisseur arrive en 200 avec un corps `error` : sans ce
  // contrôle elle se lirait comme une transcription vide, et on irait chercher
  // le problème du côté de l'audio.
  if (json?.error) throw new Error(`OpenRouter : ${String(json.error.message || json.error).slice(0, 200)}`);

  const text = String(json?.choices?.[0]?.message?.content || '').trim();
  if (!text) throw new Error('OpenRouter a renvoyé une transcription vide.');

  const cost = Number(json?.usage?.cost);

  return {
    text,
    provider: 'openrouter-chat',
    costCents: Number.isFinite(cost) ? Math.ceil(cost * 100) : null,
  };
}

/**
 * Cohere Transcribe Arabic — le premier moteur de cette liste conçu POUR le
 * problème qu'on a.
 *
 * C'est un modèle ASR dédié de 2 milliards de paramètres (encodeur
 * FastConformer, décodeur Transformer), entraîné explicitement sur la variation
 * dialectale arabe et sur l'alternance codique arabe-anglais. Tous les autres
 * moteurs testés ici sont soit généralistes (Whisper, qui rend de l'arabe
 * standard fluide et faux), soit multimodaux (Gemini, qui s'en sort bien mais
 * n'est pas fait pour ça).
 *
 * `language: 'ar'` est ENVOYÉ, contrairement au chemin Gemini où le prompt
 * suffit : ici c'est un paramètre du modèle, pas une suggestion.
 *
 * LIMITE DURE : 25 Mo par fichier. Une note vocale WhatsApp fait 4 à 18 Ko
 * (mesuré sur vos 20 notes), donc la marge est de trois ordres de grandeur —
 * mais un document audio réexpédié par un client pourrait la franchir, et le
 * message d'erreur doit dire lequel des deux problèmes s'est produit.
 */
async function transcribeCohere(
  filePath: string,
  mime: string,
  opts: { modelId: string }
): Promise<TranscribeResult> {
  const key = getSecret('COHERE_API_KEY');
  if (!key) throw new Error('Aucune clé Cohere (COHERE_API_KEY) — transcription impossible.');

  const bytes = fs.readFileSync(filePath);
  if (bytes.length > 25 * 1024 * 1024) {
    throw new Error(`Fichier trop volumineux pour Cohere (${Math.round(bytes.length / 1024 / 1024)} Mo, maximum 25).`);
  }

  const form = new FormData();
  form.append('model', opts.modelId || 'cohere-transcribe-arabic-07-2026');
  form.append('language', 'ar');
  form.append('file', new Blob([bytes], { type: mime || 'audio/ogg' }), path.basename(filePath));

  const res = await fetch('https://api.cohere.com/v2/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(90_000),
  });

  if (res.status === 401)
    throw new Error('Cohere a rejeté la clé API (401). Vérifiez COHERE_API_KEY dans Variables & Secrets.');
  if (res.status === 429)
    throw new Error("Limite de débit Cohere atteinte — la clé d'essai est plafonnée, note vocale non transcrite.");
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Cohere a refusé la transcription (${res.status}). ${body.slice(0, 200)}`);
  }

  const json: any = await res.json();
  const text = String(json?.text || '').trim();
  if (!text) throw new Error('Cohere a renvoyé une transcription vide.');

  return { text, provider: 'cohere' };
}

/** WhatsApp mime -> the format string OpenRouter expects. */
function audioFormat(mime: string): string {
  const m = String(mime || '').toLowerCase();
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('wav')) return 'wav';
  if (m.includes('webm')) return 'webm';
  if (m.includes('flac')) return 'flac';
  if (m.includes('m4a') || m.includes('mp4')) return 'm4a';
  if (m.includes('aac')) return 'aac';
  // WhatsApp push-to-talk is ogg/opus, and that is what almost every note is.
  return 'ogg';
}

/**
 * OpenRouter — every STT model on the platform behind one key.
 *
 * WHY THIS ONE EARNS ITS PLACE next to three engines that already work: it is
 * not a fourth vendor, it is a router. `modelId` is a free-text field on the AI
 * Models page, so once this function exists an admin can put ANY transcription
 * slug OpenRouter carries into a catalogue row — Whisper, GPT-4o-transcribe,
 * Voxtral — and switch an account onto it without a deploy. Every other engine
 * here costs a code change per vendor.
 *
 * The trade is the usual routing trade: one more hop of latency, and the
 * account is exposed to OpenRouter's availability on top of the underlying
 * provider's. For a fixed engine you have already chosen, calling that vendor
 * directly stays the better path — which is exactly what Gemini, Munsit and
 * Groq above are for.
 *
 * The JSON/base64 form is used rather than the multipart one because it is the
 * form OpenRouter documents field by field, including `language`. Base64 costs
 * a third more bytes on the wire, which on a fifteen-second voice note is
 * nothing next to being sure of the request shape.
 */
async function transcribeOpenRouter(
  filePath: string,
  mime: string,
  opts: { modelId: string; prompt?: string | null }
): Promise<TranscribeResult> {
  const key = getSecret('OPENROUTER_API_KEY');
  if (!key) throw new Error('Aucune clé OpenRouter (OPENROUTER_API_KEY) — transcription impossible.');
  if (!opts.modelId) throw new Error('Aucun modèle OpenRouter sélectionné pour la transcription.');

  const res = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: opts.modelId,
      input_audio: {
        // Raw base64, NOT a data: URI — OpenRouter rejects the prefixed form.
        data: fs.readFileSync(filePath).toString('base64'),
        format: audioFormat(mime),
      },
      // Same reasoning as Groq: 'ar' is the closest code darija has, and
      // without it a Moroccan sentence carrying French words comes back
      // transcribed as French. Whether the model honours the hint depends on
      // which one is routed to, which is the price of a router.
      language: 'ar',
      response_format: 'json',
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (res.status === 401)
    throw new Error('OpenRouter a rejeté la clé API (401). Vérifiez OPENROUTER_API_KEY dans Variables & Secrets.');
  if (res.status === 402)
    throw new Error('Crédits OpenRouter épuisés (402) — rechargez le compte ou levez la limite de la clé.');
  if (res.status === 429) throw new Error('Limite de débit OpenRouter atteinte — note vocale non transcrite.');
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenRouter a refusé la transcription (${res.status}). ${body.slice(0, 200)}`);
  }

  const json: any = await res.json();
  const text = String(json?.text || '').trim();
  if (!text) throw new Error('OpenRouter a renvoyé une transcription vide.');

  // `cost` is dollars as a float. Rounded UP to whole cents on the way in, for
  // the same reason lib/waPricing exists: money in this codebase is integer
  // cents, and a half-cent that rounds down is a half-cent the platform eats.
  const cost = Number(json?.usage?.cost);
  const seconds = Number(json?.usage?.seconds);

  return {
    text,
    provider: 'openrouter',
    costCents: Number.isFinite(cost) ? Math.ceil(cost * 100) : null,
    audioSeconds: Number.isFinite(seconds) ? seconds : null,
  };
}

/* ------------------------------------------------------------------ */
/* did it READ the text, or ANSWER it?                                */
/* ------------------------------------------------------------------ */

/**
 * Compares a spoken transcript with what we asked for: shared words plus a sane
 * length ratio.
 *
 * Deliberately fuzzy. A TTS transcript never matches character for character —
 * digits become words, diacritics move — so an exact comparison would reject
 * every good take. What it reliably catches is the failure that matters: the
 * model answering the text instead of reading it, which shares few words with
 * the original and is usually a very different length.
 */
export function readVerbatim(intended: string, spoken: string): boolean {
  const norm = (t: string): string[] =>
    String(t)
      .replace(/[ً-ْٰ]/g, '') // Arabic diacritics
      // Tatweel is a purely cosmetic elongation. Leaving it in made "بـ" and
      // "ب" count as different words, which is a spelling artefact of the
      // WRITTEN reply, not evidence that the audio said something else.
      .replace(/ـ/g, '')
      // Orthographic variants a speech round-trip moves freely between. An STT
      // transcript of good audio routinely writes ة as ه and drops hamza;
      // treating those as mismatches penalised correct takes.
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

  const a = norm(intended);
  const b = norm(spoken);
  if (!a.length || !b.length) return true; // nothing to judge on

  /**
   * Word overlap, but a near-miss still counts.
   *
   * Darija attaches pronouns to verbs, so "نحجزو ليك" and "نحجزوه لك" are the
   * same words differently split — an exact set membership test scores that as
   * two misses out of eight and rejects audio that is perfectly correct.
   */
  const wanted = new Set(a);
  const nearMatch = (w: string): boolean => {
    if (wanted.has(w)) return true;
    // A word that is a prefix of, or contains, an intended word — which is what
    // an attached pronoun or a dropped one looks like.
    return a.some((x) => (x.length >= 4 || w.length >= 4) && (x.startsWith(w) || w.startsWith(x)));
  };

  const overlap = b.filter(nearMatch).length / b.length;
  const ratio = b.length / a.length;

  /**
   * 0.45, not 0.6.
   *
   * This check exists for ONE failure: a conversational model answering the
   * text instead of speaking it. That looks nothing like a noisy transcript —
   * it shares almost no words and is usually far longer, so the length ratio
   * catches it on its own. A high word threshold added no protection against
   * that and silently suppressed a large share of good Darija voice notes,
   * which reads to the seller as "voice replies barely work".
   */
  return overlap >= 0.45 && ratio > 0.5 && ratio < 2;
}

/* ------------------------------------------------------------------ */
/* Arabizi -> Arabic script                                            */
/* ------------------------------------------------------------------ */

/**
 * Darija written in Arabizi ("3ndi lik", "b7al", "khoya") is the SAME spoken
 * language as Darija in Arabic script — but an Arabic voice reads Latin letters
 * phonetically and produces gibberish. The customer only ever hears the audio,
 * so transliterate first.
 */
async function toArabicScript(text: string): Promise<string | null> {
  const key = getSecret('GEMINI_API_KEY');
  if (!key) return null;

  const model = getSecret('WA_TRANSLIT_MODEL') || 'gemini-3.6-flash';

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    'Rewrite this Moroccan Darija text from Latin/Arabizi into ARABIC SCRIPT, exactly as it would be spoken. ' +
                    'Keep the same words and meaning. Convert 3->ع, 7->ح, 9->ق, 2->ء where they stand for letters. ' +
                    'Keep prices and numbers as digits. Keep brand names readable. ' +
                    'Output ONLY the Arabic-script text, nothing else.\n\n' +
                    text,
                },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(30_000),
      }
    );
    if (!res.ok) return null;
    const j: any = await res.json().catch(() => null);
    const out = (j?.candidates?.[0]?.content?.parts || [])
      .map((p: any) => p?.text || '')
      .join(' ')
      .trim();
    return out || null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* text to speech                                                     */
/* ------------------------------------------------------------------ */

export interface SynthesisResult {
  /** Path to an ogg/opus file, ready to send as a WhatsApp push-to-talk note. */
  filePath: string;
  provider: string;
  model: string | null;
  /** Set when the primary engine did not produce the audio. */
  fellBackFrom: string | null;
  retried: number;
  /** One line per failed attempt, for the activity log. */
  attempts: string[];
}

const DEFAULT_POLICY: TtsPolicy = {
  chain: [],
  retries: 2,
  verify: 'live_only',
  onFailure: 'text_only',
  timeoutMs: 90_000,
};

/**
 * Speaks `text` and returns a real WhatsApp voice note.
 *
 * `outDir` is the caller's media directory — never under uploads/, which is
 * served as unauthenticated static.
 */
export async function synthesize(
  text: string,
  preset: VoicePreset,
  opts: {
    modelId?: string | null;
    outDir: string;
    basename: string;
    policy?: Partial<TtsPolicy>;
    log?: WaLogRef | null;
  }
): Promise<SynthesisResult> {
  try {
    return await synthesizeInner(text, preset, opts);
  } catch (err) {
    // Every abandoned voice note ends here — an unknown engine, a chain that
    // failed end to end, or audio that did not say the reply. The text reply
    // still goes out, so without this row the seller sees a conversation that
    // silently stopped speaking and nothing that says why.
    waLog({
      ...(opts.log || {}),
      category: 'TTS',
      event: 'tts.failed',
      message: 'Aucune note vocale n’a pu être produite ; la réponse part en texte.',
      request: {
        text,
        voice: { provider: preset.provider, voiceId: preset.voiceId, style: preset.style || null },
        modelId: opts.modelId || null,
        chain: opts.policy?.chain || [],
      },
      meta: { provider: preset.provider, modelId: opts.modelId || null },
      error: err,
    });
    throw err;
  }
}

async function synthesizeInner(
  text: string,
  preset: VoicePreset,
  opts: {
    modelId?: string | null;
    outDir: string;
    basename: string;
    policy?: Partial<TtsPolicy>;
    log?: WaLogRef | null;
  }
): Promise<SynthesisResult> {
  const policy: TtsPolicy = { ...DEFAULT_POLICY, ...(opts.policy || {}) };
  const ref = opts.log || {};
  const startedAt = Date.now();

  // URLs are never read aloud (a spoken URL is unusable), and markdown markers
  // would be pronounced as punctuation.
  const clean = String(text || '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_~`#]/g, '')
    .trim();
  if (!clean) throw new Error('Rien à dire.');

  let speakText = clean;
  if (scriptOf(clean) === 'latin' && (isArabicVoice(preset.voiceId) || preset.provider === 'munsit')) {
    const arabic = await toArabicScript(clean);
    if (arabic && scriptOf(arabic) === 'arabic') {
      speakText = arabic;
    } else {
      // Better no voice note than a gibberish one — the text reply still goes out.
      throw new Error(
        'Réponse en caractères latins/arabizi impossible à translittérer pour une voix arabe ; envoyée en texte seulement.'
      );
    }
  }

  fs.mkdirSync(opts.outDir, { recursive: true });
  const raw = path.join(opts.outDir, `${opts.basename}.raw`);
  const out = path.join(opts.outDir, `${opts.basename}.ogg`);

  // Build the chain: the engine the account selected, then each configured
  // fallback, de-duplicated so a repeated link is not tried twice.
  const primary = `${preset.provider}:${opts.modelId || ''}`;
  const chain = [primary, ...policy.chain]
    .map((entry) => {
      const [provider, ...rest] = String(entry).split(':');
      return { provider: provider.trim(), model: rest.join(':').trim() || null };
    })
    .filter(
      (c, i, all) =>
        c.provider && all.findIndex((o) => o.provider === c.provider && o.model === c.model) === i
    );

  const speakWith = async (provider: string, model: string | null): Promise<void> => {
    if (provider === 'edge') return edgeTts(speakText, raw, preset);
    if (provider === 'gemini') {
      return isLiveModel(model)
        ? geminiLiveTts(speakText, raw, preset, model!, policy.timeoutMs)
        : geminiRestTts(speakText, raw, preset, model || 'gemini-2.5-flash-preview-tts');
    }
    throw new Error(`Moteur de voix inconnu : "${provider}".`);
  };

  let usedProvider = preset.provider;
  let usedModel: string | null = opts.modelId || null;
  let fellBackFrom: string | null = null;
  let retried = 0;
  const attempts: string[] = [];
  let spoke = false;

  for (const link of chain) {
    for (let attempt = 0; attempt <= policy.retries; attempt++) {
      try {
        await speakWith(link.provider, link.model);
        usedProvider = link.provider;
        usedModel = link.model;
        spoke = true;
        break;
      } catch (err) {
        retried++;
        attempts.push(
          `${link.provider}/${link.model || 'default'}#${attempt + 1}: ${String((err as Error).message).slice(0, 90)}`
        );
      }
    }
    if (spoke) break;
    fellBackFrom = `abandon de ${link.provider}/${link.model || 'default'}`;
  }

  if (!spoke) {
    if (policy.onFailure !== 'fallback_edge') {
      throw new Error(`Tous les moteurs de voix ont échoué. ${attempts.slice(-2).join(' | ')}`);
    }
    await edgeTts(speakText, raw, preset);
    usedProvider = 'edge';
    usedModel = null;
    fellBackFrom = `toute la chaîne a échoué : ${attempts.slice(-1)[0] || ''}`;
  }

  // WhatsApp wants ogg/opus for a push-to-talk note; anything else arrives as a
  // file attachment with a download button instead of a playable waveform.
  await run(ffmpeg(), ['-y', '-i', raw, '-c:a', 'libopus', '-b:a', '48k', '-ar', '48000', '-ac', '1', out]);
  fs.rmSync(raw, { force: true });

  // Belt and braces: transcribe what we produced and confirm it really says the
  // reply. One extra call, so it defaults to Live models only — they are the
  // ones that answer instead of reading.
  const shouldVerify =
    policy.verify === 'always' ||
    (policy.verify === 'live_only' && usedProvider === 'gemini' && isLiveModel(usedModel));

  if (shouldVerify && policy.sttProvider && policy.sttModelId) {
    try {
      const heard = await transcribe(out, 'audio/ogg', {
        provider: policy.sttProvider,
        modelId: policy.sttModelId,
      });
      if (heard.text && !readVerbatim(speakText, heard.text)) {
        const mismatch = `l'audio ne correspond pas à la réponse (entendu : "${heard.text.slice(0, 60)}…")`;
        fs.rmSync(out, { force: true });

        if (policy.onFailure === 'fallback_edge') {
          await edgeTts(speakText, raw, preset);
          await run(ffmpeg(), ['-y', '-i', raw, '-c:a', 'libopus', '-b:a', '48k', '-ar', '48000', '-ac', '1', out]);
          fs.rmSync(raw, { force: true });
          fellBackFrom = `${usedProvider}: ${mismatch}`;
          usedProvider = 'edge';
          usedModel = null;
        } else {
          throw new Error(`Note vocale abandonnée : ${mismatch}`);
        }
      }
    } catch (err) {
      // A verification that cannot run is not a reason to drop a good voice
      // note — but a verification that RAN and failed is, so re-throw ours.
      if (String((err as Error).message).startsWith('Note vocale abandonnée')) throw err;
    }
  }

  // `attempts` is why this row exists rather than a plain success line: a voice
  // note that arrived on the third engine after two silent failures looks
  // identical to a clean one from the outside, right up until the day the
  // fallback is gone too.
  waLog({
    ...ref,
    level: fellBackFrom || retried ? 'WARN' : 'INFO',
    category: 'TTS',
    event: 'tts.spoken',
    message: fellBackFrom
      ? `Note vocale produite par ${usedProvider} après un repli (${fellBackFrom}).`
      : `Note vocale produite par ${usedProvider}.`,
    request: {
      text,
      spokenText: speakText,
      voice: { provider: preset.provider, voiceId: preset.voiceId, style: preset.style || null },
      chain: chain.map((c) => `${c.provider}:${c.model || 'default'}`),
      verify: policy.verify,
      onFailure: policy.onFailure,
    },
    response: { filePath: out, provider: usedProvider, model: usedModel, fellBackFrom, retried, attempts },
    meta: { provider: usedProvider, modelId: usedModel, retried, chars: speakText.length },
    durationMs: Date.now() - startedAt,
  });

  return { filePath: out, provider: usedProvider, model: usedModel, fellBackFrom, retried, attempts };
}

/**
 * Gemini Live (native audio), over the BidiGenerateContent WebSocket.
 *
 * This is the engine that sounds conversational rather than read-aloud, and it
 * is also the one that will answer your text instead of speaking it. Both
 * guards are here: the system instruction, and `outputAudioTranscription` so the
 * transcript can be compared against what we asked for before the audio is
 * accepted.
 */
function geminiLiveTts(
  text: string,
  out: string,
  preset: VoicePreset,
  model: string,
  timeoutMs: number
): Promise<void> {
  const key = getSecret('GEMINI_API_KEY');
  if (!key) throw new Error('Aucune clé Gemini (GEMINI_API_KEY) — voix Gemini indisponible.');

  const style = [preset.stylePrompt?.trim(), paceInWords(preset.rate)].filter(Boolean).join(' ');

  // The verbatim rule comes FIRST and the accent instruction second. Reversed,
  // the model treats the accent as the task and the reading as advice.
  const system =
    'You are a text-to-speech engine, not an assistant. Speak the user message ALOUD VERBATIM, ' +
    'word for word, in the same language and script. Never answer it, never greet, never add, ' +
    'summarise or remove anything.' + (style ? `\n\nDelivery: ${style}` : '');

  return new Promise<void>((resolve, reject) => {
    const url =
      'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=' +
      encodeURIComponent(key);

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      return reject(new Error(`Gemini Live : ${(err as Error).message}`));
    }

    const chunks: Buffer[] = [];
    let spoken = '';
    let settled = false;

    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* already closing */
      }
      if (err) return reject(err);
      if (!chunks.length) return reject(new Error('Gemini Live n’a renvoyé aucun audio.'));

      // Did it read our text, or reply to it? A customer hearing a
      // conversational answer to their own agent is worse than no voice note.
      if (spoken.trim() && !readVerbatim(text, spoken)) {
        return reject(
          new Error(
            `Gemini Live a répondu au texte au lieu de le lire (il a dit : "${spoken.trim().slice(0, 70)}…").`
          )
        );
      }

      fs.writeFileSync(out, pcmToWav(Buffer.concat(chunks), 24000));
      resolve();
    };

    const timer = setTimeout(() => finish(new Error('Gemini Live : délai dépassé.')), timeoutMs);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          setup: {
            model: `models/${model}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: preset.voiceId || 'Sulafat' } } },
            },
            systemInstruction: { parts: [{ text: system }] },
            // The transcript of what it ACTUALLY said. Without this there is no
            // way to tell reading from answering.
            outputAudioTranscription: {},
          },
        })
      );
    };

    ws.onmessage = async (ev: MessageEvent) => {
      let msg: any;
      try {
        const raw =
          typeof ev.data === 'string'
            ? ev.data
            : Buffer.from(await (ev.data as Blob).arrayBuffer()).toString('utf8');
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      if (msg.setupComplete) {
        // Speaking is a plain text turn — no voice-activity detection involved.
        ws.send(
          JSON.stringify({
            clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true },
          })
        );
        return;
      }

      if (msg.serverContent?.outputTranscription?.text) {
        spoken += msg.serverContent.outputTranscription.text;
      }
      for (const p of msg.serverContent?.modelTurn?.parts || []) {
        if (p.inlineData?.data) chunks.push(Buffer.from(p.inlineData.data, 'base64'));
      }
      if (msg.serverContent?.turnComplete) finish();
      if (msg.error) finish(new Error(`Gemini Live : ${JSON.stringify(msg.error).slice(0, 160)}`));
    };

    ws.onerror = () => finish(new Error('Gemini Live : erreur de connexion.'));
    ws.onclose = () => finish(new Error('Gemini Live : connexion fermée avant la fin.'));
  });
}

/**
 * Gemini REST TTS (`*-preview-tts`). Read-aloud rather than conversational, but
 * it does not answer the text, so it is the reliable link in the chain.
 */
async function geminiRestTts(
  text: string,
  out: string,
  preset: VoicePreset,
  modelId: string
): Promise<void> {
  const key = getSecret('GEMINI_API_KEY');
  if (!key) throw new Error('Aucune clé Gemini (GEMINI_API_KEY) — voix Gemini indisponible.');

  const directions = [preset.stylePrompt?.trim(), paceInWords(preset.rate)].filter(Boolean).join(' ');
  const prompt = directions ? `${directions}\n\n${text}` : text;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      modelId
    )}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: preset.voiceId || 'Sulafat' } },
          },
        },
      }),
      signal: AbortSignal.timeout(90_000),
    }
  );

  if (res.status === 429) throw new Error('Limite de débit Gemini TTS atteinte.');
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini TTS a échoué (${res.status}). ${body.slice(0, 200)}`);
  }

  const json: any = await res.json();
  const part = (json?.candidates?.[0]?.content?.parts || []).find((p: any) => p?.inlineData?.data);
  if (!part) throw new Error('Gemini TTS n’a renvoyé aucun audio (le modèle ne parle peut-être pas).');

  // Gemini returns headerless PCM. ffmpeg cannot guess the sample rate, so wrap
  // it in a WAV header using the rate advertised on the mime type.
  const sampleRate = Number((String(part.inlineData.mimeType || '').match(/rate=(\d+)/) || [])[1]) || 24000;
  fs.writeFileSync(out, pcmToWav(Buffer.from(part.inlineData.data, 'base64'), sampleRate));
}

/**
 * Microsoft Edge neural voices. Free, no key, and the only engine here with a
 * true Moroccan Arabic voice — which is why it stays as the `fallback_edge`
 * option and as a first-class choice for accounts without a Gemini key.
 *
 * Two code paths on purpose. `toStream(text, ProsodyOptions)` covers the common
 * case and lets the library build the SSML. A named emotion has no place in
 * that API, so when one is set we hand-write the whole SSML document and use
 * `rawToStream`, which sends it untouched.
 */
async function edgeTts(text: string, out: string, preset: VoicePreset): Promise<void> {
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');

  // The preset's voice may belong to another provider when Edge is being used
  // as the failure fallback; fall back to the Moroccan voice rather than
  // handing Edge a Gemini voice name it will reject.
  const voice = /Neural$/i.test(preset.voiceId) ? preset.voiceId : 'ar-MA-MounaNeural';

  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS);

  const style = preset.style?.trim();
  const { audioStream } = style
    ? tts.rawToStream(buildExpressiveSsml(text, { ...preset, voiceId: voice }))
    : tts.toStream(text, { rate: pct(preset.rate), pitch: pct(preset.pitch), volume: pct(preset.volume) });

  const chunks: Buffer[] = [];
  for await (const c of audioStream) chunks.push(c as Buffer);
  if (!chunks.length) throw new Error('Edge TTS n’a renvoyé aucun audio.');
  fs.writeFileSync(out, Buffer.concat(chunks));
}

/**
 * The SSML for a named emotion. `mstts:express-as` must wrap `prosody`, not the
 * other way round, or Microsoft ignores the style silently.
 */
function buildExpressiveSsml(text: string, preset: VoicePreset): string {
  const locale = preset.voiceId.split('-').slice(0, 2).join('-') || 'en-US';
  const degree = preset.styleDegree && preset.styleDegree > 0 ? preset.styleDegree : 1;

  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${locale}">` +
    `<voice name="${xmlEscape(preset.voiceId)}">` +
    `<mstts:express-as style="${xmlEscape(preset.style || '')}" styledegree="${degree}">` +
    `<prosody rate="${pct(preset.rate)}" pitch="${pct(preset.pitch)}" volume="${pct(preset.volume)}">` +
    xmlEscape(text) +
    `</prosody></mstts:express-as></voice></speak>`
  );
}

/**
 * Turns a percentage speed delta into an instruction a model can follow.
 *
 * Gemini has no rate parameter, so the account's speed slider would otherwise do
 * nothing after switching engines. Describing it in words keeps one control
 * meaningful across both.
 */
function paceInWords(rate: number): string {
  const r = Math.trunc(rate || 0);
  if (r <= -35) return 'Speak very slowly and deliberately.';
  if (r <= -15) return 'Speak a little more slowly than usual.';
  if (r >= 35) return 'Speak quickly and energetically.';
  if (r >= 15) return 'Speak a little faster than usual.';
  return '';
}

/** Wraps headerless PCM in a WAV header so ffmpeg can read it normally. */
function pcmToWav(pcm: Buffer, sampleRate = 24000, channels = 1, bits = 16): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = (sampleRate * channels * bits) / 8;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE((channels * bits) / 8, 32);
  header.writeUInt16LE(bits, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/**
 * The point past which a "voice note" is not a voice note any more.
 *
 * `ttsMaxChars` is the account's taste setting and is deliberately overridable
 * below; this is the structural ceiling that protects the synthesis call
 * itself. Roughly ninety seconds of speech — a reply longer than this has gone
 * wrong as a reply, and turning it into audio would only make that slower to
 * discover.
 */
const VOICE_HARD_CEILING = 1500;

/**
 * Whether this reply should go out as a voice note.
 *
 * `mirror` — the default — only speaks when the customer spoke, which is the
 * behaviour that actually reads as human.
 *
 * THE LENGTH CAP ONLY GOVERNS VOICE WE VOLUNTEER. It used to veto every reply
 * over `maxChars` regardless of why we were speaking, and that is how
 * 212637547479 was failed: he sent nine voice notes, said in one of them "أنا
 * أمي" — I cannot read — and asked over and over to be answered in audio. Three
 * of the answers came in at 415, 312 and 320 characters against a 300 cap, so
 * each one silently became a wall of written Darija sent to a man who had just
 * explained he could not read it. He left.
 *
 * For a customer who asked to be spoken to, text is not a degraded reply, it is
 * no reply at all — so the cap does not get to veto it. Keeping voice notes
 * short is a job for the model, which is now told its budget (see buildContext
 * in brain.ts); the cap's remaining job is to stop us pushing unsolicited audio
 * at someone who never asked for any.
 */
export function shouldSpeak(
  mode: string,
  maxChars: number,
  reply: string,
  customerSentVoice: boolean,
  customerAskedForVoice = false
): boolean {
  if (mode === 'never') return false;

  // `mirror` means mirror the customer — and a customer who TYPES "send me a
  // voice note" has asked just as plainly as one who sent audio. Without this,
  // the agent answers that request in text, which reads as a refusal.
  const required = customerSentVoice || customerAskedForVoice;

  if (reply.length > VOICE_HARD_CEILING) return false;
  if (!required && reply.length > Math.max(1, maxChars)) return false;

  if (mode === 'always') return true;
  return required;
}

/**
 * Did the customer ask to be spoken to?
 *
 * Keyword matching rather than a model call: this runs on every turn, the cost
 * of a false positive is one voice note the customer probably did not mind, and
 * the cost of a false negative is the agent appearing to refuse a direct
 * request. Covers Darija and Arabizi spellings alongside French and English,
 * because that is what these customers actually type.
 */
export function asksForVoice(text: string): boolean {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return false;

  return [
    // Arabic / Darija
    'أوديو', 'اوديو', 'صوتي', 'صوتية', 'صوتيه', 'بالصوت', 'سجل', 'تسجيل', 'رسالة صوتية', 'هضر',
    // Arabizi
    'audio', 'vocal', 'voice', 'sawti', 'sjjel', 'sajel', 'tsjil',
    // French / English
    'note vocale', 'message vocal', 'envoie un vocal', 'parle', 'voice note', 'voice message',
  ].some((k) => t.includes(k));
}

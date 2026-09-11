import { getSecret, getSecretOr } from '../lib/secretStore.js';

/**
 * The platform's OpenAI client, used by the store builder (OpenDesign).
 *
 * Two calls only, both over plain fetch so no SDK is added: a chat completion
 * that must answer with JSON matching a schema (the builder reads a brief
 * with it), and an image generation (the builder illustrates a store with
 * it). The key and the model names come from Variables & Secrets, never from
 * a vendor: a SUPER_ADMIN sets OPENAI_API_KEY there and the feature appears
 * in the Studio; removes it and the feature disappears. No key is ever
 * accepted from the frontend.
 */

const BASE_URL = 'https://api.openai.com/v1';

export const DEFAULT_OPENAI_BUILDER_MODEL = 'gpt-5-mini';
export const DEFAULT_OPENAI_IMAGE_MODEL = 'gpt-image-1';
export const DEFAULT_OPENAI_IMAGE_QUALITY = 'medium';

export type OpenAiImageQuality = 'low' | 'medium' | 'high' | 'auto';

export function openaiConfigured(): boolean {
  return Boolean(getSecret('OPENAI_API_KEY'));
}

export function openaiBuilderModel(): string {
  return getSecretOr('OPENAI_BUILDER_MODEL', DEFAULT_OPENAI_BUILDER_MODEL).trim() || DEFAULT_OPENAI_BUILDER_MODEL;
}

export function openaiImageModel(): string {
  return getSecretOr('OPENAI_IMAGE_MODEL', DEFAULT_OPENAI_IMAGE_MODEL).trim() || DEFAULT_OPENAI_IMAGE_MODEL;
}

export function openaiImageQuality(): OpenAiImageQuality {
  const q = getSecretOr('OPENAI_IMAGE_QUALITY', DEFAULT_OPENAI_IMAGE_QUALITY).trim().toLowerCase();
  return q === 'low' || q === 'high' || q === 'auto' ? q : 'medium';
}

/** What the admin screen and the Studio badge say about the GPT side of the builder. */
export function openaiStatus(): { configured: boolean; model: string; imageModel: string; imageQuality: OpenAiImageQuality } {
  return { configured: openaiConfigured(), model: openaiBuilderModel(), imageModel: openaiImageModel(), imageQuality: openaiImageQuality() };
}

function apiKey(): string {
  const key = getSecret('OPENAI_API_KEY');
  if (!key) throw new Error('Aucune clé OpenAI configurée (OPENAI_API_KEY dans Variables & Secrets).');
  return key;
}

/** The message OpenAI puts in an error body, or the HTTP status when there is none. */
async function readError(res: Response): Promise<string> {
  let text = '';
  try {
    text = await res.text();
  } catch {
    /* ignore */
  }
  try {
    const body = JSON.parse(text);
    const msg = body?.error?.message;
    if (typeof msg === 'string' && msg.trim()) return `${msg.trim()} (HTTP ${res.status})`;
  } catch {
    /* not JSON */
  }
  return `${text.slice(0, 200) || res.statusText || 'erreur inconnue'} (HTTP ${res.status})`;
}

async function post(path: string, body: Record<string, unknown>, timeoutMs: number): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey()}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(await readError(res));
    return await res.json();
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error(`Délai d’attente dépassé pour OpenAI (${Math.round(timeoutMs / 1000)}s).`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** A streamed POST: each `data:` line of the SSE answer, parsed, to `onChunk`. */
async function postStream(path: string, body: Record<string, unknown>, timeoutMs: number, onChunk: (chunk: any) => void): Promise<void> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey()}`, Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(await readError(res));
    if (!res.body) throw new Error('Réponse vide.');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') return;
        try {
          onChunk(JSON.parse(payload));
        } catch {
          /* a malformed line is skipped */
        }
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error(`Délai d’attente dépassé pour OpenAI (${Math.round(timeoutMs / 1000)}s).`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Reasoning models take `reasoning_effort`, refuse `temperature`, and count their thinking in the output budget. */
function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o\d)/i.test(model);
}

export interface ChatJsonResult {
  json: unknown;
  usage: { input: number; output: number };
  model: string;
}

/**
 * One chat completion that must answer with a JSON object shaped by `schema`
 * (Structured Outputs, non-strict: the schema guides, the caller's sanitiser
 * enforces). Returns the parsed object; throws with OpenAI's message on
 * refusal, on a non-JSON answer, or on any HTTP error.
 */
export async function openaiChatJson(input: {
  model?: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  schemaName?: string;
  maxOutputTokens: number;
  timeoutMs?: number;
  /** When given, the answer is streamed and every piece of text is handed over as it arrives. */
  onDelta?: (text: string) => void;
}): Promise<ChatJsonResult> {
  const model = input.model || openaiBuilderModel();
  const reasoning = isReasoningModel(model);
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: input.system },
      { role: 'user', content: input.user },
    ],
    response_format: { type: 'json_schema', json_schema: { name: input.schemaName || 'answer', schema: input.schema, strict: false } },
    // A reasoning model spends part of this budget thinking before it writes,
    // so it gets headroom; a plain model gets exactly the admin's ceiling.
    max_completion_tokens: reasoning ? input.maxOutputTokens + 4000 : input.maxOutputTokens,
  };
  if (reasoning) body.reasoning_effort = 'low';

  let content = '';
  let refusal = '';
  let finishReason: string | null = null;
  let usage: any = {};
  if (input.onDelta) {
    body.stream = true;
    body.stream_options = { include_usage: true };
    await postStream('/chat/completions', body, input.timeoutMs ?? 120_000, (chunk) => {
      const choice = chunk?.choices?.[0];
      const delta = choice?.delta ?? {};
      if (typeof delta.content === 'string' && delta.content) {
        content += delta.content;
        input.onDelta!(delta.content);
      }
      if (typeof delta.refusal === 'string') refusal += delta.refusal;
      if (choice?.finish_reason) finishReason = choice.finish_reason;
      if (chunk?.usage) usage = chunk.usage;
    });
  } else {
    const data = await post('/chat/completions', body, input.timeoutMs ?? 120_000);
    const choice = data?.choices?.[0];
    const message = choice?.message ?? {};
    refusal = typeof message.refusal === 'string' ? message.refusal : '';
    content = typeof message.content === 'string' ? message.content : Array.isArray(message.content) ? message.content.map((c: any) => c?.text ?? '').join('') : '';
    finishReason = choice?.finish_reason ?? null;
    usage = data?.usage ?? {};
  }
  if (refusal.trim()) throw new Error(`Le modèle a refusé : ${refusal.trim().slice(0, 160)}`);
  if (!content.trim()) throw new Error(finishReason === 'length' ? 'Réponse tronquée : augmentez les tokens de sortie max.' : 'Le modèle n’a rien renvoyé.');

  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (!fenced) throw new Error('Le modèle n’a pas renvoyé de JSON valide.');
    json = JSON.parse(fenced[1]);
  }
  return { json, usage: { input: Number(usage.prompt_tokens) || 0, output: Number(usage.completion_tokens) || 0 }, model };
}

export type OpenAiImageSize = '1024x1024' | '1536x1024' | '1024x1536';

/**
 * One generated image as raw bytes. gpt-image models answer with base64;
 * older DALL·E models are asked for base64 too and, should one answer with a
 * URL anyway, the bytes are fetched from it.
 */
export async function openaiGenerateImage(input: { prompt: string; size: OpenAiImageSize; model?: string; quality?: OpenAiImageQuality; timeoutMs?: number }): Promise<{ bytes: Buffer; model: string }> {
  const model = input.model || openaiImageModel();
  const gptImage = /^gpt-image/i.test(model);
  const body: Record<string, unknown> = { model, prompt: input.prompt, n: 1, size: input.size };
  if (gptImage) {
    body.quality = input.quality ?? openaiImageQuality();
    body.output_format = 'jpeg';
  } else {
    body.response_format = 'b64_json';
  }
  const data = await post('/images/generations', body, input.timeoutMs ?? 150_000);
  const item = data?.data?.[0];
  if (item?.b64_json) return { bytes: Buffer.from(String(item.b64_json), 'base64'), model };
  if (item?.url) {
    const res = await fetch(String(item.url));
    if (!res.ok) throw new Error(`Image injoignable (HTTP ${res.status}).`);
    return { bytes: Buffer.from(await res.arrayBuffer()), model };
  }
  throw new Error('OpenAI n’a renvoyé aucune image.');
}

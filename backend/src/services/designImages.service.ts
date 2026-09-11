import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { getSecretOr } from '../lib/secretStore.js';
import { openaiConfigured, openaiGenerateImage, openaiImageModel, type OpenAiImageSize } from './openai.service.js';
import { codexAvailable, codexGenerateImage } from './codexCli.service.js';

/**
 * Photos for a generated store, drawn for the brief instead of taken from the
 * niche's stock set.
 *
 * OpenDesign composes every store with three photographs — the hero, the
 * "our story" band and the promotion — plus three small highlight pictures.
 * The stock ones are pre-generated per niche (assets.ts). A seller can ask
 * for the three large ones to be generated for what they actually sell; the
 * composer then puts these in the same slots. The highlights keep the
 * niche's pictures: they are small, numerous, and not worth three more calls.
 *
 * Three engines, tried in the admin's order (IMAGE_ENGINE_ORDER, default
 * "codex,openai,pollinations") until a slot has its picture:
 *   · Codex CLI — OpenAI's agent on a ChatGPT login; no API credits, ~2 min
 *     a picture, excellent quality;
 *   · OpenAI API — gpt-image-1, paid per picture, ~20 s;
 *   · Pollinations — free, no key, lower quality, a small watermark, and it
 *     throttles parallel calls so it runs one picture at a time.
 * An engine that is not installed or configured is skipped; every failure is
 * kept so the seller and the admin read the real reason.
 *
 * Files land under backend/uploads/opendesign/<storeId>/ and are served by
 * the API's /uploads static route like every other upload. Nothing is
 * deleted automatically: an installed theme keeps pointing at its photos.
 */

export type DesignImageKey = 'hero' | 'story' | 'promo';
export const DESIGN_IMAGE_KEYS: DesignImageKey[] = ['hero', 'story', 'promo'];

export type DesignImages = Partial<Record<DesignImageKey, string>>;
export type ImageEngine = 'codex' | 'openai' | 'pollinations';
export const IMAGE_ENGINES: ImageEngine[] = ['codex', 'openai', 'pollinations'];

/** One photo slot's progress, for a live screen. */
export interface PhotoEvent {
  key: DesignImageKey;
  status: 'start' | 'done' | 'fail';
  engine?: string;
  url?: string;
  error?: string;
  ms?: number;
}

export interface DesignImagesResult {
  images: DesignImages;
  /** Which engine drew each slot that succeeded. */
  sources: Partial<Record<DesignImageKey, ImageEngine>>;
  /** One line per failure, in French, for the seller — including failures a later engine then covered. */
  errors: string[];
  /** The engines that drew at least one photo, e.g. "Codex CLI" or "gpt-image-1 + Pollinations". */
  model: string;
  durationMs: number;
}

const SIZES: Record<DesignImageKey, OpenAiImageSize> = { hero: '1536x1024', story: '1024x1024', promo: '1536x1024' };
const LABELS: Record<DesignImageKey, string> = { hero: 'accroche', story: 'histoire', promo: 'promotion' };

const NO_TEXT = 'No text, no letters, no numbers, no logos, no watermarks, no people, no faces.';

/** The engines the admin ordered that are actually usable right now. */
export function availableImageEngines(): ImageEngine[] {
  const raw = getSecretOr('IMAGE_ENGINE_ORDER', 'codex,openai,pollinations');
  const order = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is ImageEngine => (IMAGE_ENGINES as string[]).includes(s));
  const seen = new Set<ImageEngine>();
  const out: ImageEngine[] = [];
  for (const e of order.length ? order : IMAGE_ENGINES) {
    if (seen.has(e)) continue;
    seen.add(e);
    if (e === 'codex' && !codexAvailable()) continue;
    if (e === 'openai' && !openaiConfigured()) continue;
    out.push(e);
  }
  return out;
}

export function engineLabel(engine: ImageEngine): string {
  return engine === 'codex' ? 'Codex CLI' : engine === 'openai' ? openaiImageModel() : 'Pollinations';
}

/** A plain colour word for a hex value: image models read "red and yellow", not "#e4241c". */
export function colourName(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (l > 0.93) return 'white';
  if (l < 0.12) return 'black';
  if (s < 0.12) return l > 0.6 ? 'light grey' : 'dark grey';
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  const base = h < 15 || h >= 345 ? 'red' : h < 40 ? 'orange' : h < 65 ? 'yellow' : h < 160 ? 'green' : h < 200 ? 'teal' : h < 255 ? 'blue' : h < 290 ? 'purple' : h < 330 ? 'magenta' : 'pink';
  if (base === 'orange' && l < 0.35) return 'brown';
  if (base === 'pink' && l > 0.8) return 'soft pink';
  if (base === 'blue' && l < 0.3) return 'navy blue';
  return l > 0.8 ? `pale ${base}` : l < 0.3 ? `deep ${base}` : base;
}

/**
 * The brief a photographer would get: the brain's `photoSubject` when it
 * answered (concrete, in English), else the seller's sentence itself. A
 * conversational brief ("can you build me a website for…") draws a vague
 * room; a subject ("flame-grilled beef burgers with fries") draws the food.
 */
function subjectOf(input: { brief: string; subject?: string | null }): string {
  const s = String(input.subject ?? '').trim();
  if (s) return s;
  return `the products sold by an online store described as "${input.brief.trim().slice(0, 200)}"`;
}

function promptFor(key: DesignImageKey, subject: string, mood: 'light' | 'dark' | 'auto', colours: string[]): string {
  const ground = mood === 'dark' ? 'dark, moody background' : mood === 'light' ? 'bright, airy background' : 'clean, tasteful background';
  const brand = colours.length ? `brand colours ${colours.join(' and ')} in the backdrop and props` : ground;
  switch (key) {
    case 'hero':
      return `Professional product photography: ${subject}. Hero shot, studio lighting, ${brand}, shallow depth of field, premium and appetizing, advertising quality, calm empty space on one side for a headline, photorealistic. ${NO_TEXT}`;
    case 'story':
      return `Candid editorial photograph: ${subject}, being prepared, made or packed in an authentic real setting, warm natural light, documentary style, photorealistic. ${NO_TEXT}`;
    case 'promo':
      return `Advertising product shot: ${subject}, neatly arranged on a simple backdrop, ${brand}, dramatic directional lighting, high-end commercial look, photorealistic. ${NO_TEXT}`;
  }
}

function safeSegment(v: string | number): string {
  return String(v).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'x';
}

function sizeHint(size: OpenAiImageSize): string {
  return size === '1024x1024' ? 'square (1024x1024)' : size === '1024x1536' ? 'portrait (1024x1536)' : 'landscape (1536x1024, 3:2)';
}

/** One picture from Pollinations: a GET whose answer is the JPEG itself. */
async function pollinationsImage(prompt: string, size: OpenAiImageSize, seed: number): Promise<Buffer> {
  const [w, h] = size.split('x').map(Number);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${seed}&nologo=true&model=flux`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120_000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'silacod-opendesign/1.0' }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`Pollinations HTTP ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length < 5000) throw new Error(`Pollinations : réponse trop petite (${bytes.length} octets)`);
    return bytes;
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error('Pollinations : délai dépassé (120s)');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** One picture from one engine, as raw bytes. */
async function drawWith(engine: ImageEngine, prompt: string, size: OpenAiImageSize, scratch: string, seed: number): Promise<Buffer> {
  if (engine === 'codex') {
    const workDir = path.join(scratch, `codex-${Date.now().toString(36)}-${seed % 1000}`);
    try {
      return await codexGenerateImage({ prompt, sizeHint: sizeHint(size), workDir, outFile: path.join(workDir, 'image.png') });
    } finally {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
  if (engine === 'openai') return (await openaiGenerateImage({ prompt, size })).bytes;
  return pollinationsImage(prompt, size, seed);
}

interface ChainSlot {
  key: DesignImageKey;
  prompt: string;
  size: OpenAiImageSize;
  file: string;
}

interface ChainInput {
  storeId: number | string;
  slots: ChainSlot[];
  onEvent?: (e: PhotoEvent) => void;
}

/**
 * Runs the engine chain over a set of slots: every engine in order, each
 * taking the slots still missing, parallel except Pollinations (serialised,
 * one retry). Saves what succeeds as compressed JPEG under the store's folder.
 */
async function drawChain(input: ChainInput): Promise<{ images: DesignImages; sources: Partial<Record<DesignImageKey, ImageEngine>>; errors: string[]; used: Set<ImageEngine>; started: number }> {
  const started = Date.now();
  const seg = safeSegment(input.storeId);
  const dir = path.join(process.cwd(), 'uploads', 'opendesign', seg);
  const images: DesignImages = {};
  const sources: Partial<Record<DesignImageKey, ImageEngine>> = {};
  const errors: string[] = [];
  const used = new Set<ImageEngine>();
  const seed = Math.floor(Math.random() * 1_000_000);

  const note = (key: DesignImageKey, engine: ImageEngine | 'enregistrement', err: unknown) => {
    const label = engine === 'enregistrement' ? engine : engineLabel(engine);
    const message = String((err as any)?.message || err || 'erreur inconnue').slice(0, 220);
    console.error(`[designImages] ${key} via ${label} failed:`, message);
    errors.push(`Photo « ${LABELS[key]} » (${label}) : ${message}`);
    input.onEvent?.({ key, status: 'fail', engine: label, error: message });
  };
  const save = async (slot: ChainSlot, bytes: Buffer, engine: ImageEngine) => {
    try {
      const jpeg = await sharp(bytes).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, slot.file), jpeg);
      images[slot.key] = `/uploads/opendesign/${seg}/${slot.file}`;
      sources[slot.key] = engine;
      used.add(engine);
      input.onEvent?.({ key: slot.key, status: 'done', engine: engineLabel(engine), url: images[slot.key], ms: Date.now() - started });
      return true;
    } catch (err) {
      note(slot.key, 'enregistrement', err);
      return false;
    }
  };
  const attempt = async (slot: ChainSlot, engine: ImageEngine, attemptSeed: number) => {
    input.onEvent?.({ key: slot.key, status: 'start', engine: engineLabel(engine) });
    try {
      const bytes = await drawWith(engine, slot.prompt, slot.size, dir, attemptSeed);
      return await save(slot, bytes, engine);
    } catch (err) {
      note(slot.key, engine, err);
      return false;
    }
  };

  let missing = [...input.slots];
  for (const engine of availableImageEngines()) {
    if (!missing.length) break;
    if (engine === 'pollinations') {
      // Three parallel calls from one IP get two "fetch failed" back; a queue gets three pictures.
      for (const slot of missing) {
        let ok = await attempt(slot, engine, seed + input.slots.indexOf(slot));
        if (!ok) {
          await new Promise((r) => setTimeout(r, 2500));
          ok = await attempt(slot, engine, seed + input.slots.indexOf(slot) + 101);
        }
      }
    } else {
      await Promise.all(missing.map((slot) => attempt(slot, engine, seed + input.slots.indexOf(slot))));
    }
    missing = missing.filter((slot) => !images[slot.key]);
  }
  return { images, sources, errors, used, started };
}

function modelLabel(used: Set<ImageEngine>): string {
  const labels = IMAGE_ENGINES.filter((e) => used.has(e)).map(engineLabel);
  if (labels.length) return labels.join(' + ');
  const first = availableImageEngines()[0];
  return first ? engineLabel(first) : 'aucun moteur';
}

/**
 * Generates the requested slots and saves what succeeded. Never throws for a
 * failed slot: the composer uses the niche's stock photo there and the
 * seller reads why in `errors`.
 */
export async function generateDesignImages(input: {
  brief: string;
  storeId: number | string;
  /** What to shoot, in English (the brain's photoSubject). Falls back to the brief. */
  subject?: string | null;
  /** Brand colours as hex; named in the prompt so the props match the palette. */
  colours?: string[];
  mood?: 'light' | 'dark' | 'auto';
  keys?: DesignImageKey[];
  onEvent?: (e: PhotoEvent) => void;
}): Promise<DesignImagesResult> {
  const subject = subjectOf(input);
  const colours = (input.colours ?? []).map(colourName).filter((c): c is string => Boolean(c)).filter((c, i, a) => a.indexOf(c) === i).slice(0, 2);
  const keys = (input.keys?.length ? input.keys : DESIGN_IMAGE_KEYS).filter((k) => DESIGN_IMAGE_KEYS.includes(k));
  const stamp = Date.now().toString(36);
  const r = await drawChain({
    storeId: input.storeId,
    slots: keys.map((key) => ({ key, prompt: promptFor(key, subject, input.mood ?? 'auto', colours), size: SIZES[key], file: `${stamp}-${key}.jpg` })),
    onEvent: input.onEvent,
  });
  return { images: r.images, sources: r.sources, errors: r.errors, model: modelLabel(r.used), durationMs: Date.now() - r.started };
}

/**
 * One picture for the store agent: a subject chosen by the model, a size, the
 * store's colours. Same engines and chain as the slots above; the file lands
 * in the same folder and the URL is what a block's image prop takes.
 */
export async function generateSingleImage(input: {
  storeId: number | string;
  subject: string;
  size?: 'landscape' | 'square' | 'portrait';
  colours?: string[];
  mood?: 'light' | 'dark' | 'auto';
}): Promise<{ url: string | null; engine: string | null; errors: string[]; durationMs: number }> {
  const size: OpenAiImageSize = input.size === 'square' ? '1024x1024' : input.size === 'portrait' ? '1024x1536' : '1536x1024';
  const colours = (input.colours ?? []).map(colourName).filter((c): c is string => Boolean(c)).filter((c, i, a) => a.indexOf(c) === i).slice(0, 2);
  const r = await drawChain({
    storeId: input.storeId,
    slots: [{ key: 'hero', prompt: promptFor('hero', input.subject.trim().slice(0, 200), input.mood ?? 'auto', colours), size, file: `${Date.now().toString(36)}-agent.jpg` }],
  });
  const engine = r.sources.hero ? engineLabel(r.sources.hero) : null;
  return { url: r.images.hero ?? null, engine, errors: r.errors, durationMs: Date.now() - r.started };
}

/** The image map a client may send back so a re-composition keeps its photos: known keys, local uploads or https only. */
export function sanitizeDesignImages(raw: unknown): DesignImages | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: DesignImages = {};
  for (const key of DESIGN_IMAGE_KEYS) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v !== 'string' || v.length > 500) continue;
    if (v.startsWith('/uploads/') || /^https:\/\//i.test(v)) out[key] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

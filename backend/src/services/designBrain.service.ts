import { runClaudeCliJson, type BrainEvent } from './claudeCliJson.service.js';
import { streamAnthropic } from './brainJson.service.js';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../lib/prisma.js';
import { getSecret } from '../lib/secretStore.js';
import { resolveModel, type ModelRole } from '../wa/catalogue.js';
import { resolveBin } from '../wa/cliProvider.js';
import { BRIEF_SPEC_SCHEMA, sanitizeSpec, type BriefSpec } from '../shared/templates/briefSpec.js';
import { openaiBuilderModel, openaiChatJson, openaiConfigured, openaiStatus } from './openai.service.js';
import { availableImageEngines, engineLabel } from './designImages.service.js';

/**
 * The builder's brain: a language model reading a seller's brief for OpenDesign.
 *
 * Off by default. A SUPER_ADMIN turns it on from the AI catalogue, picks which
 * model reads briefs (any Anthropic model of the BUILDER or BRAIN role), and
 * whether the model also writes the store's copy. When it is off, or the key
 * is missing, or the call fails, OpenDesign falls back to its built-in reader
 * — the seller always gets a design; the admin gets the failure in the stats.
 *
 * The model never composes pages. It fills a fixed spec (briefSpec.ts) through
 * a tool call, the spec is sanitised, and the deterministic composer arranges
 * the store from it. Nothing a model returns can reach a page unvalidated.
 *
 * Calls are billed to the platform's Anthropic key, not to a vendor's credit
 * account: a design costs one short call and the seller is not charged for it.
 *
 * A second brain, GPT, sits beside the Claude one: when a SUPER_ADMIN has set
 * OPENAI_API_KEY in Variables & Secrets, the seller may pick "Mode IA GPT" in
 * the Studio and the same spec is filled by the OpenAI model named in
 * OPENAI_BUILDER_MODEL (openai.service.ts). Same prompt, same schema, same
 * sanitiser, same stats.
 */

export type BuilderProvider = 'claude' | 'openai';

/** The engines a seller may pick in the Studio: the Claude brain, the GPT brain, or the instant built-in reader. */
export type StudioMode = 'claude' | 'gpt' | 'instant';
export const STUDIO_MODES: StudioMode[] = ['claude', 'gpt', 'instant'];

export interface BuilderSettings {
  enabled: boolean;
  /** An ai_models row id, or null for the role default. */
  modelId: number | null;
  /** Explicit local CLI choice; null preserves catalogue/automatic selection. */
  cliModel: 'sonnet' | 'opus' | 'haiku' | null;
  /** An ai_models row (provider openai) for the GPT mode, or null for the OPENAI_BUILDER_MODEL secret. */
  gptModelId: number | null;
  /** Whether the model writes copy for the brief, or only reads it. */
  writeCopy: boolean;
  maxOutputTokens: number;
  /** Extra guidance an admin can add to the system prompt (house style, forbidden claims). */
  instructions: string;
  /** Which engines the Studio offers sellers. An engine also needs its key or binary to actually appear. */
  sellerModes: Record<StudioMode, boolean>;
  /** The engine pre-selected when a seller opens the Studio. */
  sellerDefault: StudioMode;
  /** Whether sellers may ask GPT to draw the store's photos (three paid image calls). */
  gptImages: boolean;
  /** The store agent (Studio "IA" tab): on/off, and whether a seller may ask it to publish in the same run. */
  agent: { enabled: boolean; allowPublish: boolean };
}

export interface BuilderStats {
  calls: number;
  failures: number;
  lastModel: string | null;
  lastAt: string | null;
  lastError: string | null;
  lastDurationMs: number | null;
  inputTokens: number;
  outputTokens: number;
}

const SETTINGS_KEY = 'builder_ai';
const STATS_KEY = 'builder_ai_stats';

export const DEFAULT_BUILDER_SETTINGS: BuilderSettings = {
  enabled: false,
  modelId: null,
  cliModel: null,
  gptModelId: null,
  writeCopy: true,
  maxOutputTokens: 2500,
  instructions: '',
  sellerModes: { claude: true, gpt: true, instant: true },
  sellerDefault: 'claude',
  gptImages: true,
  agent: { enabled: true, allowPublish: false },
};

function readAgent(v: unknown, fallback: { enabled: boolean; allowPublish: boolean }): { enabled: boolean; allowPublish: boolean } {
  const src = (v && typeof v === 'object' ? v : {}) as Partial<Record<'enabled' | 'allowPublish', unknown>>;
  return {
    enabled: typeof src.enabled === 'boolean' ? src.enabled : fallback.enabled,
    allowPublish: typeof src.allowPublish === 'boolean' ? src.allowPublish : fallback.allowPublish,
  };
}

function readModes(v: unknown, fallback: Record<StudioMode, boolean>): Record<StudioMode, boolean> {
  const src = (v && typeof v === 'object' ? v : {}) as Partial<Record<StudioMode, unknown>>;
  const out = { ...fallback };
  for (const m of STUDIO_MODES) if (typeof src[m] === 'boolean') out[m] = src[m] as boolean;
  // The instant reader is what every failure falls back to; with no engine
  // offered at all a seller could not generate anything, so it stays on.
  if (!out.claude && !out.gpt) out.instant = true;
  return out;
}

function readDefault(v: unknown, modes: Record<StudioMode, boolean>, fallback: StudioMode): StudioMode {
  const wanted = (STUDIO_MODES as string[]).includes(String(v)) ? (v as StudioMode) : fallback;
  if (modes[wanted]) return wanted;
  return STUDIO_MODES.find((m) => modes[m]) ?? 'instant';
}

const EMPTY_STATS: BuilderStats = { calls: 0, failures: 0, lastModel: null, lastAt: null, lastError: null, lastDurationMs: null, inputTokens: 0, outputTokens: 0 };

export async function getBuilderSettings(): Promise<BuilderSettings> {
  const row = await prisma.platformSettings.findUnique({ where: { key: SETTINGS_KEY } });
  const v = (row?.value ?? {}) as Partial<BuilderSettings>;
  const cliAvailable = Boolean(resolveBin());
  const modes = readModes(v.sellerModes, DEFAULT_BUILDER_SETTINGS.sellerModes);
  // Unset means "on if something can read": the local Claude CLI, or a GPT key.
  return {
    enabled: typeof v.enabled === 'boolean' ? v.enabled : (cliAvailable || openaiConfigured() || DEFAULT_BUILDER_SETTINGS.enabled),
    modelId: Number.isInteger(v.modelId) ? (v.modelId as number) : null,
    cliModel: ['sonnet', 'opus', 'haiku'].includes(v.cliModel ?? '') ? v.cliModel! : null,
    gptModelId: Number.isInteger(v.gptModelId) ? (v.gptModelId as number) : null,
    writeCopy: v.writeCopy !== false,
    maxOutputTokens: Math.min(8000, Math.max(600, Number(v.maxOutputTokens) || DEFAULT_BUILDER_SETTINGS.maxOutputTokens)),
    instructions: typeof v.instructions === 'string' ? v.instructions.slice(0, 2000) : '',
    sellerModes: modes,
    sellerDefault: readDefault(v.sellerDefault, modes, DEFAULT_BUILDER_SETTINGS.sellerDefault),
    gptImages: v.gptImages !== false,
    agent: readAgent(v.agent, DEFAULT_BUILDER_SETTINGS.agent),
  };
}

export async function setBuilderSettings(patch: Partial<BuilderSettings>): Promise<BuilderSettings> {
  const current = await getBuilderSettings();
  const next: BuilderSettings = {
    enabled: typeof patch.enabled === 'boolean' ? patch.enabled : current.enabled,
    modelId: patch.modelId === null ? null : Number.isInteger(patch.modelId) ? (patch.modelId as number) : current.modelId,
    cliModel: patch.cliModel === null ? null : ['sonnet', 'opus', 'haiku'].includes(patch.cliModel ?? '') ? patch.cliModel! : current.cliModel,
    gptModelId: patch.gptModelId === null ? null : Number.isInteger(patch.gptModelId) ? (patch.gptModelId as number) : current.gptModelId,
    writeCopy: typeof patch.writeCopy === 'boolean' ? patch.writeCopy : current.writeCopy,
    maxOutputTokens: Math.min(8000, Math.max(600, Number(patch.maxOutputTokens) || current.maxOutputTokens)),
    instructions: typeof patch.instructions === 'string' ? patch.instructions.slice(0, 2000) : current.instructions,
    sellerModes: readModes(patch.sellerModes, current.sellerModes),
    sellerDefault: 'instant',
    gptImages: typeof patch.gptImages === 'boolean' ? patch.gptImages : current.gptImages,
    agent: readAgent(patch.agent, current.agent),
  };
  next.sellerDefault = readDefault(patch.sellerDefault ?? current.sellerDefault, next.sellerModes, current.sellerDefault);
  await prisma.platformSettings.upsert({ where: { key: SETTINGS_KEY }, update: { value: next as any }, create: { key: SETTINGS_KEY, value: next as any } });
  return next;
}

export async function getBuilderStats(): Promise<BuilderStats> {
  const row = await prisma.platformSettings.findUnique({ where: { key: STATS_KEY } });
  return { ...EMPTY_STATS, ...((row?.value ?? {}) as Partial<BuilderStats>) };
}

async function recordCall(update: Partial<BuilderStats> & { ok: boolean; tokensIn?: number; tokensOut?: number }): Promise<void> {
  try {
    const s = await getBuilderStats();
    const next: BuilderStats = {
      calls: s.calls + 1,
      failures: s.failures + (update.ok ? 0 : 1),
      lastModel: update.lastModel ?? s.lastModel,
      lastAt: new Date().toISOString(),
      lastError: update.ok ? null : (update.lastError ?? 'unknown'),
      lastDurationMs: update.lastDurationMs ?? s.lastDurationMs,
      inputTokens: s.inputTokens + (update.tokensIn ?? 0),
      outputTokens: s.outputTokens + (update.tokensOut ?? 0),
    };
    await prisma.platformSettings.upsert({ where: { key: STATS_KEY }, update: { value: next as any }, create: { key: STATS_KEY, value: next as any } });
  } catch (err) {
    console.error('[designBrain] could not record stats', err);
  }
}

/**
 * The model that reads briefs:
 * 1. The admin's explicit choice (if enabled Anthropic or Claude CLI row).
 * 2. The BUILDER default model, else the BRAIN default model (Anthropic or Claude CLI).
 * 3. The auto-detected local Claude CLI binary if available.
 */
export async function resolveBuilderModel(settings?: BuilderSettings): Promise<BuilderModelLike | null> {
  const s = settings ?? (await getBuilderSettings());
  if (s.cliModel) {
    return resolveBin() ? { provider: 'claude-cli', modelId: s.cliModel, maxOutputTokens: 8192, supportsEffort: true } : null;
  }
  if (s.modelId) {
    const chosen = await prisma.aiModel.findFirst({
      where: { id: s.modelId, isEnabled: true, provider: { in: ['anthropic', 'claude-cli'] } },
    });
    if (chosen) {
      return {
        provider: chosen.provider,
        modelId: chosen.modelId,
        maxOutputTokens: chosen.maxOutputTokens || 8192,
        supportsEffort: chosen.supportsEffort || false,
      };
    }
  }
  for (const role of ['BUILDER', 'BRAIN'] as ModelRole[]) {
    const m = await resolveModel(role);
    if (m && (m.provider === 'anthropic' || m.provider === 'claude-cli')) {
      return {
        provider: m.provider,
        modelId: m.modelId,
        maxOutputTokens: m.maxOutputTokens || 8192,
        supportsEffort: m.supportsEffort || false,
      };
    }
  }
  const bin = resolveBin();
  if (bin) {
    return {
      provider: 'claude-cli',
      modelId: 'sonnet',
      maxOutputTokens: 8192,
      supportsEffort: true,
    };
  }
  return null;
}

/** What the API tells the seller about how the brief was read. */
export interface EngineInfo {
  ai: boolean;
  model: string | null;
  note: string | null;
}

let client: Anthropic | null = null;
let clientKey = '';
function getClient(): Anthropic {
  const apiKey = getSecret('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('Aucune clé Anthropic configurée (ANTHROPIC_API_KEY dans Variables & Secrets).');
  if (!client || clientKey !== apiKey) {
    client = new Anthropic({ apiKey });
    clientKey = apiKey;
  }
  return client;
}

const SYSTEM = `You read a merchant's one-sentence brief for an online store and fill in the design_store tool. The store sells with cash on delivery in Morocco; copy is in French unless the brief is clearly written in another language, in which case use that language. Be concrete and specific to what they sell; never write placeholders, lorem ipsum, markdown or emoji-only lines. Colours: only when the brief names or clearly implies them — "background black" is bg, "red buttons" or "red page" is primary. Elements: "add a button", "with reviews" are wants; "no FAQ", "sans avis" are drops. Never invent products, prices or delivery promises beyond 24/48h cash-on-delivery delivery in Morocco. Keep every string within its length limit.`;

/**
 * Reads a brief with the configured model. Returns null — and never throws —
 * when the builder is off, unconfigured, or the call fails; the caller falls
 * back to the built-in reader.
 */
export interface BuilderModelLike {
  provider: string;
  modelId: string;
  maxOutputTokens: number;
  supportsEffort: boolean;
}

async function interpretWithCli(input: {
  prompt: string;
  storeName?: string;
  settings: BuilderSettings;
  model: BuilderModelLike;
  started: number;
  onEvent?: (e: BrainEvent) => void;
}): Promise<{ spec: BriefSpec; engine: EngineInfo } | { spec: null; engine: EngineInfo }> {
  const bin = resolveBin();
  if (!bin) {
    return {
      spec: null,
      engine: {
        ai: false,
        model: input.model.modelId,
        note: 'Binaire Claude CLI introuvable sur le serveur ; lecture intégrée utilisée.',
      },
    };
  }

  try {
    const { json, usage } = await runClaudeCliJson({
      system: systemFor(input.settings),
      user: `Store name: ${input.storeName || 'not given'}\nBrief: ${input.prompt.slice(0, 600)}`,
      schema: BRIEF_SPEC_SCHEMA as unknown as Record<string, unknown>,
      modelId: input.model.modelId,
      timeoutMs: 120_000,
      onEvent: input.onEvent,
    });
    const spec = sanitizeSpec(json);

    if (!spec) {
      await recordCall({
        ok: false,
        lastModel: input.model.modelId,
        lastError: 'Le modèle CLI n’a pas renvoyé de spécification valide.',
        lastDurationMs: Date.now() - input.started,
      });
      return {
        spec: null,
        engine: {
          ai: false,
          model: `Claude CLI (${input.model.modelId})`,
          note: 'Le modèle CLI n’a rien renvoyé d’exploitable ; lecture intégrée utilisée.',
        },
      };
    }

    await recordCall({
      ok: true,
      lastModel: input.model.modelId,
      lastDurationMs: Date.now() - input.started,
      tokensIn: Number(usage.input) || 0,
      tokensOut: Number(usage.output) || 0,
    });

    return {
      spec,
      engine: {
        ai: true,
        model: `Claude CLI (${input.model.modelId})`,
        note: spec.summary ?? null,
      },
    };
  } catch (err: any) {
    const message = err?.message || String(err);
    console.error('[designBrain] CLI interpret failed:', message);
    await recordCall({
      ok: false,
      lastModel: input.model.modelId,
      lastError: message.slice(0, 300),
      lastDurationMs: Date.now() - input.started,
    });

    let cleanNote = `Claude CLI indisponible — ${message.slice(0, 170)} ; lecture intégrée utilisée.`;
    if (/limit|quota|429/i.test(message)) {
      cleanNote = `Claude CLI : limite de session atteinte — ${message.slice(0, 170)} ; lecture intégrée utilisée.`;
    }

    return {
      spec: null,
      engine: {
        ai: false,
        model: `Claude CLI (${input.model.modelId})`,
        note: cleanNote,
      },
    };
  }
}

function systemFor(settings: BuilderSettings): string {
  return [
    SYSTEM,
    settings.writeCopy
      ? 'Write the copy: headline, subhead, kicker, cta, announcement, 3-4 usp, 3 highlights, 3 stats, promo, story, 3 quotes (invented but plausible Moroccan first names and cities), 4 faqs, catalogue title and subtitle, about. Avoid unverifiable claims (no awards, no certifications not in the brief).'
      : 'Do not write copy: leave the copy field out. Only read niche, mood, colours, font, elements and button label.',
    settings.instructions ? `Admin instructions: ${settings.instructions}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** The GPT model: the admin's catalogue pick (an enabled `openai` row), else the OPENAI_BUILDER_MODEL secret. */
export interface GptModelLike {
  id: number | null;
  modelId: string;
  label: string;
  maxOutputTokens: number;
  source: 'catalogue' | 'secret';
}

export async function resolveGptModel(settings?: BuilderSettings): Promise<GptModelLike> {
  const s = settings ?? (await getBuilderSettings());
  if (s.gptModelId) {
    const row = await prisma.aiModel.findFirst({ where: { id: s.gptModelId, isEnabled: true, provider: 'openai' } });
    if (row) return { id: row.id, modelId: row.modelId, label: row.label, maxOutputTokens: row.maxOutputTokens || 0, source: 'catalogue' };
  }
  const modelId = openaiBuilderModel();
  return { id: null, modelId, label: modelId, maxOutputTokens: 0, source: 'secret' };
}

/** The GPT brain: the same spec, filled by the OpenAI model the admin picked (catalogue row or Variables & Secrets). */
async function interpretWithOpenAI(input: { prompt: string; storeName?: string; settings: BuilderSettings; started: number; onEvent?: (e: BrainEvent) => void }): Promise<{ spec: BriefSpec; engine: EngineInfo } | { spec: null; engine: EngineInfo }> {
  const gpt = await resolveGptModel(input.settings);
  const modelId = gpt.modelId;
  const label = `GPT (${modelId})`;
  if (!openaiConfigured()) {
    return { spec: null, engine: { ai: false, model: null, note: 'Aucune clé OpenAI configurée (OPENAI_API_KEY dans Variables & Secrets) ; lecture intégrée utilisée.' } };
  }
  try {
    const system = `${systemFor(input.settings)}\n\nAnswer with one JSON object only, matching the design_store schema.`;
    const { json, usage } = await openaiChatJson({
      model: modelId,
      system,
      user: `Store name: ${input.storeName || 'not given'}\nBrief: ${input.prompt.slice(0, 600)}`,
      schema: BRIEF_SPEC_SCHEMA as unknown as Record<string, unknown>,
      schemaName: 'design_store',
      maxOutputTokens: gpt.maxOutputTokens ? Math.min(input.settings.maxOutputTokens, gpt.maxOutputTokens) : input.settings.maxOutputTokens,
      onDelta: input.onEvent ? (t: string) => input.onEvent!({ type: 'delta', text: t }) : undefined,
    });
    const spec = sanitizeSpec(json);
    if (!spec) {
      await recordCall({ ok: false, lastModel: label, lastError: 'Le modèle GPT n’a pas renvoyé de spécification valide.', lastDurationMs: Date.now() - input.started, tokensIn: usage.input, tokensOut: usage.output });
      return { spec: null, engine: { ai: false, model: label, note: 'Le modèle GPT n’a rien renvoyé d’exploitable ; lecture intégrée utilisée.' } };
    }
    await recordCall({ ok: true, lastModel: label, lastDurationMs: Date.now() - input.started, tokensIn: usage.input, tokensOut: usage.output });
    return { spec, engine: { ai: true, model: label, note: spec.summary ?? null } };
  } catch (err: any) {
    const message = String(err?.message || err);
    console.error('[designBrain] OpenAI interpret failed:', message);
    await recordCall({ ok: false, lastModel: label, lastError: message.slice(0, 300), lastDurationMs: Date.now() - input.started });
    const note = /limit|quota|429|insufficient_quota|credits/i.test(message)
      ? `GPT : quota, crédit ou limite atteinte — ${message.slice(0, 170)} ; lecture intégrée utilisée.`
      : `GPT indisponible — ${message.slice(0, 170)} ; lecture intégrée utilisée.`;
    return { spec: null, engine: { ai: false, model: label, note } };
  }
}

export async function interpretBrief(input: { prompt: string; storeName?: string; settings?: BuilderSettings; model?: BuilderModelLike; provider?: BuilderProvider; onEvent?: (e: BrainEvent) => void }): Promise<{ spec: BriefSpec; engine: EngineInfo } | { spec: null; engine: EngineInfo }> {
  const settings = input.settings ?? (await getBuilderSettings());
  if (!settings.enabled) return { spec: null, engine: { ai: false, model: null, note: 'Lecture intégrée : l’IA du constructeur est désactivée.' } };

  if (input.provider === 'openai') {
    input.onEvent?.({ type: 'model', model: (await resolveGptModel(settings)).modelId });
    return interpretWithOpenAI({ prompt: input.prompt, storeName: input.storeName, settings, started: Date.now(), onEvent: input.onEvent });
  }

  const model = input.model ?? (await resolveBuilderModel(settings));
  if (!model) return { spec: null, engine: { ai: false, model: null, note: 'Aucun modèle IA activé pour le constructeur.' } };
  if (model.provider !== 'anthropic' && model.provider !== 'claude-cli') {
    return { spec: null, engine: { ai: false, model: model.modelId, note: `Le fournisseur « ${model.provider} » n’est pas pris en charge par le constructeur ; lecture intégrée utilisée.` } };
  }

  const started = Date.now();
  if (model.provider === 'claude-cli') {
    return interpretWithCli({ prompt: input.prompt, storeName: input.storeName, settings, model, started, onEvent: input.onEvent });
  }

  try {
    const anthropic = getClient();
    const tool: Anthropic.Tool = {
      name: 'design_store',
      description: 'Describe the store design the brief asks for. Fill copy when asked to.',
      input_schema: BRIEF_SPEC_SCHEMA as unknown as Anthropic.Tool['input_schema'],
    };
    const system = systemFor(settings);

    const params: Record<string, unknown> = {
      model: model.modelId,
      max_tokens: Math.min(settings.maxOutputTokens, model.maxOutputTokens || settings.maxOutputTokens),
      system,
      tools: [tool],
      tool_choice: { type: 'tool', name: 'design_store' },
      messages: [{ role: 'user', content: `Store name: ${input.storeName || 'not given'}\nBrief: ${input.prompt.slice(0, 600)}` }],
    };
    if (model.supportsEffort) params.output_config = { effort: 'low' };

    const response = input.onEvent ? await streamAnthropic(anthropic, params, 120_000, input.onEvent) : ((await (anthropic.messages.create as any)(params)) as Anthropic.Message);
    const use = response.content.find((c) => c.type === 'tool_use') as Anthropic.ToolUseBlock | undefined;
    const spec = use ? sanitizeSpec(use.input) : null;
    const usage = (response as any).usage ?? {};
    if (!spec) {
      await recordCall({ ok: false, lastModel: model.modelId, lastError: 'Le modèle n’a pas appelé l’outil design_store.', lastDurationMs: Date.now() - started, tokensIn: usage.input_tokens, tokensOut: usage.output_tokens });
      return { spec: null, engine: { ai: false, model: model.modelId, note: 'Le modèle n’a rien renvoyé d’exploitable ; lecture intégrée utilisée.' } };
    }
    await recordCall({ ok: true, lastModel: model.modelId, lastDurationMs: Date.now() - started, tokensIn: usage.input_tokens, tokensOut: usage.output_tokens });
    return { spec, engine: { ai: true, model: model.modelId, note: spec.summary ?? null } };
  } catch (err: any) {
    const message = err?.error?.error?.message || err?.message || String(err);
    console.error('[designBrain] interpretBrief failed', message);
    await recordCall({ ok: false, lastModel: model.modelId, lastError: String(message).slice(0, 300), lastDurationMs: Date.now() - started });
    return { spec: null, engine: { ai: false, model: model.modelId, note: `Le modèle a échoué (${String(message).slice(0, 120)}) ; lecture intégrée utilisée.` } };
  }
}

/** What the Studio may offer a seller right now: the admin's choice, narrowed by what is actually configured. */
export interface StudioProviders {
  claude: { available: boolean; model: string | null };
  /** `images` and `imageEngines` describe the photo chain (Codex CLI → OpenAI → Pollinations), whichever brain reads the brief. */
  openai: { available: boolean; model: string | null; images: boolean; imageModel: string; imageEngines: string[] };
  instant: { available: boolean };
  default: StudioMode;
}

export async function studioProviders(settings?: BuilderSettings): Promise<StudioProviders> {
  const s = settings ?? (await getBuilderSettings());
  const model = s.enabled && s.sellerModes.claude ? await resolveBuilderModel(s) : null;
  const oa = openaiStatus();
  const gpt = oa.configured ? await resolveGptModel(s) : null;
  const engines = availableImageEngines();
  const claude = Boolean(model);
  const openai = s.enabled && s.sellerModes.gpt && oa.configured;
  // Nothing else on means the instant reader stays on, whatever the admin ticked.
  const instant = s.sellerModes.instant || (!claude && !openai);
  const order: StudioMode[] = [s.sellerDefault, 'claude', 'gpt', 'instant'];
  const on: Record<StudioMode, boolean> = { claude, gpt: openai, instant };
  return {
    claude: { available: claude, model: model ? (model.provider === 'claude-cli' ? `Claude CLI (${model.modelId})` : model.modelId) : null },
    openai: { available: openai, model: gpt ? `GPT (${gpt.modelId})` : null, images: s.enabled && s.gptImages && engines.length > 0, imageModel: engines[0] ? engineLabel(engines[0]) : oa.imageModel, imageEngines: engines.map(engineLabel) },
    instant: { available: instant },
    default: order.find((m) => on[m]) ?? 'instant',
  };
}

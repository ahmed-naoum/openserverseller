import { api, API_URL } from '../lib/api';
import type { Op, PageDocument, OutlineNode, PageKind } from '@shared/document/index.js';

/**
 * The Studio API client. Two calls per target: read the document, send ops.
 *
 * Everything the editor does locally goes through the same `applyOps` the
 * server runs, so a batch that lands here has already been accepted once; the
 * server's answer is the authoritative document and the refusals, if any.
 */

export type StudioTarget =
  | { kind: 'landing'; id: number }
  | { kind: 'store-home' }
  | { kind: 'store-header' }
  | { kind: 'store-footer' }
  | { kind: 'store-product' }
  | { kind: 'store-catalogue' }
  | { kind: 'store-page'; id: number };

export function targetPath(t: StudioTarget): string {
  if (t.kind === 'landing') return `/studio/landing/${t.id}`;
  if (t.kind === 'store-home') return '/studio/store/home';
  if (t.kind === 'store-header') return '/studio/store/header';
  if (t.kind === 'store-footer') return '/studio/store/footer';
  if (t.kind === 'store-product') return '/studio/store/product';
  if (t.kind === 'store-catalogue') return '/studio/store/catalogue';
  return `/studio/store/pages/${t.id}`;
}

export interface StudioPagePayload {
  document: PageDocument;
  outline: OutlineNode[];
  outlineText: string;
  target: { kind: PageKind; label: string; previewPath: string };
  /** True when a draft exists: the document above is the draft, not the live page. */
  hasDraft: boolean;
  versions: VersionSummary[];
  templates: { id: string; label: { fr: string; en: string }; description: { fr: string; en: string } }[];
  link?: { id: number; code: string; productId: number; productName: string | null };
  page?: { themeColor: string; title: string | null; description: string | null; buttonText: string | null };
  store?: { id: number; name: string; slug: string };
  storePage?: { id: number; title: string; slug: string };
  /** What `$primary`, `$secondary` and `$font` resolve to on this target. */
  theme?: { primary: string; secondary: string; font: string };
}

export interface VersionSummary {
  id: number;
  label: string | null;
  source: string;
  createdById: number | null;
  createdAt: string;
}

export interface StudioOpsPayload extends StudioPagePayload {
  applied: number;
  inverse: Op[];
  refused: { index: number; op: Op; reason: string }[];
  storedAs?: 'flat' | 'tree';
  compile?: any;
}

/** Which brains the Studio may offer for OpenDesign, as the API reports them. */
export interface DesignProviders {
  claude: { available: boolean; model: string | null };
  openai: { available: boolean; model: string | null; images: boolean; imageModel?: string; imageEngines?: string[] };
  instant: { available: boolean };
  /** The engine the admin wants pre-selected. */
  default: 'claude' | 'gpt' | 'instant';
}

/** One Server-Sent Event from the streaming generation. */
export interface GenerateEvent {
  event: 'stage' | 'brain' | 'engine' | 'spec' | 'photo' | 'section' | 'page' | 'done' | 'error' | string;
  data: any;
}

/**
 * OpenDesign, streamed: the same request as `generateDesign`, but every step
 * arrives as an event while the server works — the model's answer as it is
 * written, each photo, each section — and the final payload is returned.
 * Plain fetch: axios does not expose a response stream.
 */
export async function generateDesignStream(
  data: Parameters<typeof studioApi.generateDesign>[0],
  onEvent: (e: GenerateEvent) => void,
  signal?: AbortSignal,
): Promise<{ design: any; engine?: any; images?: Record<string, string> | null; photos?: any }> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch(`${API_URL}/studio/store/themes/generate/stream`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(data),
    signal,
  });
  if (!res.ok || !res.body) {
    let message = `HTTP ${res.status}`;
    try {
      message = (await res.json())?.message || message;
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let done: any = null;
  let error: string | null = null;
  for (;;) {
    const { value, done: end } = await reader.read();
    if (end) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      if (!chunk || chunk.startsWith(':')) continue;
      let event = 'message';
      const lines: string[] = [];
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) lines.push(line.slice(5).trimStart());
      }
      if (!lines.length) continue;
      let parsed: any;
      try {
        parsed = JSON.parse(lines.join('\n'));
      } catch {
        continue;
      }
      if (event === 'done') done = parsed;
      else if (event === 'error') error = parsed?.message || 'La génération a échoué.';
      onEvent({ event, data: parsed });
    }
  }
  if (error) throw new Error(error);
  if (!done) throw new Error('Le flux s’est interrompu avant la fin de la génération.');
  return done;
}

/** What the store agent may do right now, and what it did lately. */
export interface AgentStatus {
  enabled: boolean;
  allowPublish: boolean;
  providers: DesignProviders;
  targets: { key: string; label: string; studioPath: string; hasDraft: boolean }[];
  runs: { id: number; instruction: string; provider: string; model: string | null; status: string; summary: string | null; actions: unknown; durationMs: number; createdAt: string }[];
}

export interface AgentRunResult {
  id: number | null;
  summary: string;
  model: string | null;
  provider: 'claude' | 'openai';
  actions: { index: number; round: number; type: string; target?: string; note?: string; ok: boolean; detail: string; applied?: number; refused?: { reason: string }[] }[];
  drafts: { key: string; label: string; studioPath: string; hasDraft: boolean }[];
  published: { key: string; label: string; studioPath: string; hasDraft: boolean }[];
  durationMs: number;
  usage: { input: number; output: number };
  error?: string;
}

export const studioApi = {
  /** The store agent: a sentence in, drafts out. */
  agentStatus: () => api.get<{ status: string; data: AgentStatus }>('/studio/store/agent/status'),
  agentRun: (data: { instruction: string; provider?: 'claude' | 'openai'; focus?: string | null; publish?: boolean }) =>
    api.post<{ status: string; data: AgentRunResult }>('/studio/store/agent/run', data, { timeout: 480000 }),
  get: (t: StudioTarget) => api.get<{ status: string; data: StudioPagePayload }>(targetPath(t)),
  applyOps: (t: StudioTarget, ops: Op[], atomic = true) =>
    api.post<{ status: string; data: StudioOpsPayload }>(`${targetPath(t)}/ops`, { ops, atomic }),
  publish: (t: StudioTarget, label?: string) =>
    api.post<{ status: string; data: StudioPagePayload & { published: boolean; version: VersionSummary; compile?: any } }>(`${targetPath(t)}/publish`, { label }),
  discard: (t: StudioTarget) => api.post<{ status: string; data: StudioPagePayload }>(`${targetPath(t)}/discard`),
  restore: (t: StudioTarget, versionId: number) =>
    api.post<{ status: string; data: StudioPagePayload }>(`${targetPath(t)}/versions/${versionId}/restore`),
  themes: () => api.get('/studio/store/themes'),
  installTheme: (id: string) => api.post(`/studio/store/themes/${id}/install`),
  installCustomTheme: (data: { label?: string; palette: any; fontFamily?: string; pages: any }) =>
    api.post('/studio/store/themes/custom/install', data),
  /** A shipped theme's page, compiled with the seller's own products. */
  previewTheme: (id: string, page: 'home' | 'product' | 'catalogue') =>
    api.get<{ status: string; data: { page: string; html: string; placeholder: boolean; products: number } }>(`/studio/store/themes/${id}/preview`, { params: { page } }),
  /** A generated design's page, compiled the same way. */
  previewDesign: (data: { pages: any; palette: any; fontFamily?: string; page: 'home' | 'product' | 'catalogue'; inspect?: boolean; reveal?: boolean }) =>
    api.post<{ status: string; data: { page: string; html: string; placeholder: boolean; products: number } }>('/studio/store/themes/preview', data),
  /**
   * OpenDesign: a complete store from a sentence. `provider` picks the brain
   * (Claude CLI by default, GPT when the admin has set an OpenAI key);
   * `withImages` asks GPT to draw the hero, story and promo photos, and
   * `images` sends photos from a previous generation back so a new
   * arrangement keeps them.
   */
  generateDesign: (data: {
    prompt: string;
    seed?: number;
    mode?: 'auto' | 'light' | 'dark';
    palette?: Record<string, string>;
    fontFamily?: string;
    extraSectionIds?: string[];
    skipAi?: boolean;
    provider?: 'claude' | 'openai';
    withImages?: boolean;
    images?: Record<string, string>;
  }) =>
    api.post<{
      status: string;
      data: {
        design: any;
        engine?: any;
        images?: Record<string, string> | null;
        photos?: { model: string; generated: number; sources?: Record<string, 'openai' | 'pollinations'>; errors: string[]; durationMs: number } | null;
      };
    }>('/studio/store/themes/generate', data, { timeout: 240000 }),
  designExamples: () =>
    api.get<{
      status: string;
      data: {
        examples: { title: string; prompt: string }[];
        niches: { id: string; label: string }[];
        engine?: { ai: boolean; model: string | null; note: string | null };
        providers?: DesignProviders;
      };
    }>('/studio/store/themes/examples'),
};

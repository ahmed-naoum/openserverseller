import { prisma } from '../lib/prisma.js';
import {
  applyOps,
  validateDocument,
  ensureDocument,
  outlineText,
  type Op,
  type PageDocument,
  type PageKind,
  type SectionNode,
} from '../shared/document/index.js';
import { BLOCKS } from '../shared/blocks/index.js';
import { SECTIONS_CATALOG, findSection } from '../shared/templates/sections.js';
import { generateDesign } from '../shared/templates/opendesign.js';
import { getOrCreateVendorStore, getOrCreateGlobalSection, createStorePage, type GlobalSectionKey } from './store.service.js';
import { getDraft, saveDraft, deleteDraft, recordVersion } from './studioVersions.service.js';
import { invalidateStore } from './storeCompiler/index.js';
import { askJson } from './brainJson.service.js';
import { getBuilderSettings, interpretBrief, studioProviders, type BuilderProvider, type BuilderSettings } from './designBrain.service.js';
import { generateDesignImages, generateSingleImage } from './designImages.service.js';

/**
 * The store agent: a seller says what they want changed, in a sentence, and
 * the model changes the store.
 *
 * It does not get a free hand. It gets the same door the Studio editor and
 * OpenDesign use — operations on page documents, validated by `applyOps`,
 * plus a short list of store-level actions — and everything it does to a
 * page lands in that page's DRAFT. Nothing a customer sees moves until the
 * seller publishes, unless the seller asked for that in the same breath and
 * the admin allows it.
 *
 * One model call plans the whole change as a list of actions; the server
 * runs them in order and keeps every refusal. When something was refused, a
 * second call sees the refusals and the fresh state of those pages and
 * repairs. Two calls at most: the Claude CLI takes half a minute per answer,
 * a chat loop of ten steps would take ten minutes.
 *
 * Every run is recorded (store_agent_runs) so the seller can read back what
 * the agent did and an admin can see how it behaves.
 */

export type AgentTargetKey = 'home' | 'header' | 'footer' | 'product' | 'catalogue' | `page:${number}`;

export interface AgentTargetInfo {
  key: AgentTargetKey;
  label: string;
  /** Path under the dashboard base, e.g. /store/studio/home. */
  studioPath: string;
  hasDraft: boolean;
}

interface AgentTarget extends AgentTargetInfo {
  kind: PageKind;
  versionKind: string;
  versionKey: string;
  load(): Promise<PageDocument>;
  saveLive(doc: PageDocument): Promise<void>;
}

export type AgentActionType = 'ops' | 'insert_section' | 'update_store' | 'create_page' | 'generate_image' | 'redesign';

export interface AgentActionResult {
  index: number;
  round: number;
  type: string;
  target?: string;
  note?: string;
  ok: boolean;
  detail: string;
  applied?: number;
  refused?: { reason: string }[];
}

export interface AgentRunResult {
  id: number | null;
  summary: string;
  model: string | null;
  provider: BuilderProvider;
  actions: AgentActionResult[];
  /** Targets that now carry a draft the seller should look at and publish. */
  drafts: AgentTargetInfo[];
  /** Targets published live during this run (only when allowed and asked). */
  published: AgentTargetInfo[];
  durationMs: number;
  usage: { input: number; output: number };
  error?: string;
}

const MAX_ACTIONS = 30;
const MAX_OPS_PER_ACTION = 200;
const SURFACES: GlobalSectionKey[] = ['header', 'footer', 'product', 'catalogue'];
const SURFACE_KIND: Record<GlobalSectionKey, PageKind> = { header: 'page', footer: 'page', product: 'product', catalogue: 'collection' };
const SURFACE_LABEL: Record<GlobalSectionKey, string> = { header: 'En-tête', footer: 'Pied de page', product: 'Fiche produit', catalogue: 'Catalogue' };

// ───────────────────────────────────────────── targets

async function targetFor(store: any, key: AgentTargetKey): Promise<AgentTarget | null> {
  const base = { versionKey: `store:${store.id}` };
  if (key === 'home') {
    const t: AgentTarget = {
      key, label: 'Accueil', studioPath: '/store/studio/home', hasDraft: false, kind: 'home', versionKind: 'store-home', ...base,
      async load() {
        const fresh = await (prisma as any).store.findUnique({ where: { id: store.id }, select: { homeStructure: true } });
        return ensureDocument(fresh?.homeStructure, 'home');
      },
      async saveLive(doc) {
        await (prisma as any).store.update({ where: { id: store.id }, data: { homeStructure: doc } });
      },
    };
    return t;
  }
  if ((SURFACES as string[]).includes(key)) {
    const k = key as GlobalSectionKey;
    const page = await getOrCreateGlobalSection(store.id, k);
    const t: AgentTarget = {
      key, label: SURFACE_LABEL[k], studioPath: `/store/studio/${k}`, hasDraft: false, kind: SURFACE_KIND[k], versionKind: `store-${k}`, ...base,
      async load() {
        const fresh = await (prisma as any).storePage.findUnique({ where: { id: page.id }, select: { customStructure: true } });
        return ensureDocument(fresh?.customStructure, SURFACE_KIND[k]);
      },
      async saveLive(doc) {
        await (prisma as any).storePage.update({ where: { id: page.id }, data: { customStructure: doc } });
      },
    };
    return t;
  }
  const m = /^page:(\d+)$/.exec(key);
  if (!m) return null;
  const pageId = Number(m[1]);
  const page = await (prisma as any).storePage.findFirst({ where: { id: pageId, storeId: store.id } });
  if (!page || String(page.slug).startsWith('__')) return null;
  const t: AgentTarget = {
    key, label: page.title, studioPath: `/store/studio/pages/${page.id}`, hasDraft: false, kind: 'page', versionKind: 'store-page', versionKey: `store:${store.id}:page:${page.id}`,
    async load() {
      const fresh = await (prisma as any).storePage.findUnique({ where: { id: page.id }, select: { customStructure: true } });
      return ensureDocument(fresh?.customStructure, 'page');
    },
    async saveLive(doc) {
      await (prisma as any).storePage.update({ where: { id: page.id }, data: { customStructure: doc } });
    },
  };
  return t;
}

async function working(t: AgentTarget): Promise<{ doc: PageDocument; hasDraft: boolean }> {
  const draft = await getDraft(t.versionKind, t.versionKey);
  if (draft) return { doc: draft.document, hasDraft: true };
  return { doc: await t.load(), hasDraft: false };
}

function parseKey(raw: unknown): AgentTargetKey | null {
  const v = String(raw ?? '').trim();
  if (['home', 'header', 'footer', 'product', 'catalogue'].includes(v)) return v as AgentTargetKey;
  return /^page:\d+$/.test(v) ? (v as AgentTargetKey) : null;
}

/** Every page the agent may touch, with whether a draft is waiting. */
export async function listAgentTargets(storeId: number): Promise<AgentTargetInfo[]> {
  const store = await (prisma as any).store.findUnique({ where: { id: storeId } });
  const keys: AgentTargetKey[] = ['home', 'header', 'footer', 'product', 'catalogue'];
  const pages = await (prisma as any).storePage.findMany({ where: { storeId }, orderBy: { id: 'asc' }, select: { id: true, slug: true } });
  for (const p of pages) if (!String(p.slug).startsWith('__')) keys.push(`page:${p.id}` as AgentTargetKey);
  const out: AgentTargetInfo[] = [];
  for (const key of keys) {
    const t = await targetFor(store, key);
    if (!t) continue;
    const draft = await getDraft(t.versionKind, t.versionKey);
    out.push({ key: t.key, label: t.label, studioPath: t.studioPath, hasDraft: Boolean(draft) });
  }
  return out;
}

// ───────────────────────────────────────────── the model's brief

const ACTION_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', maxLength: 500, description: 'For the seller, in the language of their instruction: what you changed and why, 1-3 sentences. Mention anything you could not do.' },
    actions: {
      type: 'array',
      maxItems: MAX_ACTIONS,
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['ops', 'insert_section', 'update_store', 'create_page', 'generate_image', 'redesign'] },
          target: { type: 'string', description: 'home | header | footer | product | catalogue | page:<id>. Required for ops, insert_section, generate_image.' },
          note: { type: 'string', maxLength: 120, description: 'Short label of this step, for the seller.' },
          ops: { type: 'array', items: { type: 'object' }, description: 'For type "ops": Studio operations, applied in order to the target page.' },
          sectionId: { type: 'string', description: 'For insert_section: an id from the sections catalogue.' },
          index: { type: ['integer', 'null'], description: 'For insert_section: position among the root sections; null = at the end.' },
          nodeId: { type: 'string', description: 'For generate_image: the block that receives the picture.' },
          prop: { type: 'string', description: 'For generate_image: the prop path that takes the URL, e.g. "props.url", "props.mediaUrl", "style.backgroundImage". Default props.url.' },
          subject: { type: 'string', maxLength: 200, description: 'For generate_image: in English, the concrete thing to photograph (objects, never a person).' },
          size: { type: 'string', enum: ['landscape', 'square', 'portrait'] },
          settings: { type: 'object', description: 'For update_store: the fields to change (see allowed fields).' },
          title: { type: 'string', maxLength: 80, description: 'For create_page.' },
          slug: { type: 'string', maxLength: 60, description: 'For create_page: lowercase, hyphens.' },
          sections: { type: 'array', items: { type: 'string' }, description: 'For create_page: catalogue section ids to compose the page with, in order.' },
          brief: { type: 'string', maxLength: 600, description: 'For redesign: the one-sentence brief for a complete new design of the five pages.' },
          withImages: { type: 'boolean', description: 'For redesign: also draw the hero, story and promo photos.' },
        },
        required: ['type'],
      },
    },
  },
  required: ['summary', 'actions'],
} as const;

const STORE_FIELDS: Record<string, (v: unknown) => unknown> = {
  name: (v) => str(v, 80),
  tagline: (v) => str(v, 160),
  description: (v) => str(v, 2000),
  primaryColor: (v) => hex(v),
  secondaryColor: (v) => hex(v),
  fontFamily: (v) => str(v, 40),
  announcementText: (v) => (v === null ? null : str(v, 200)),
  announcementActive: (v) => (typeof v === 'boolean' ? v : undefined),
  whatsappNumber: (v) => str(v, 30),
  contactPhone: (v) => str(v, 30),
  contactEmail: (v) => str(v, 120),
  instagramUrl: (v) => url(v),
  facebookUrl: (v) => url(v),
  tiktokUrl: (v) => url(v),
  metaTitle: (v) => str(v, 120),
  metaDescription: (v) => str(v, 300),
  headerStyle: (v) => str(v, 30),
  footerStyle: (v) => str(v, 30),
  freeShippingThreshold: (v) => (v === null ? null : num(v)),
  standardShippingFee: (v) => num(v),
};

function str(v: unknown, max: number): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;
}
function hex(v: unknown): string | undefined {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim().toLowerCase() : undefined;
}
function url(v: unknown): string | undefined {
  const s = str(v, 300);
  return s && /^https?:\/\//i.test(s) ? s : undefined;
}
function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function blockCatalogueText(): string {
  return BLOCKS.map((b) => {
    const shape = (b.schema as any)?.shape ?? {};
    const defaults = JSON.stringify(b.defaults ?? {});
    return `- ${b.type} (${b.meta.label.fr}): fields ${Object.keys(shape).join(', ')}${b.presets ? `; presets ${Object.keys(b.presets).join(', ')}` : ''}\n  defaults: ${defaults.length > 700 ? defaults.slice(0, 700) + '…' : defaults}`;
  }).join('\n');
}

function sectionsCatalogueText(): string {
  return SECTIONS_CATALOG.map((s) => `- ${s.id} — ${s.name} [${s.category}]: ${s.description}`).join('\n');
}

const SYSTEM = `You are the store agent of a Moroccan cash-on-delivery e-commerce platform. A seller tells you, in one message, what to change in their online store; you answer with a plan of actions the server executes. You never write HTML: a store is made of pages, each page is a document of root SECTIONS containing LAYOUTS (row/grid) and BLOCKS from a fixed registry. Changes to pages go into DRAFTS the seller reviews and publishes; store settings apply at once.

## Actions
- "ops": Studio operations on one page ("target"). Operations, applied in order:
  · {"op":"insert","parentId":<section or layout id, or null for a new root section>,"index":<position>,"node":<node>}
    node shapes: block {"id","type":"block","block":<registry type>,"props":{…}} · layout {"id","type":"layout","layout":"row"|"grid","columns":[twelfths…],"children":[…]} · section {"id","type":"section","label"?,"style"?,"children":[…]} (sections only at the root).
  · {"op":"remove","nodeId"} · {"op":"move","nodeId","parentId","index"} · {"op":"duplicate","nodeId"} · {"op":"rename","nodeId","label"}
  · {"op":"set","nodeId","path","value"} — path is dotted: "props.title", "props.items", "style.paddingTop", "style.background", "responsive.sm.hidden", "hidden", "label"; value undefined/null deletes.
  · {"op":"applyPreset","nodeId","preset"} · {"op":"wrap","nodeIds":[…],"wrapperId","layout":"row","columns":[6,6]}
  New ids: letters, digits, _ or -, max 64 chars, unique in the page — prefix yours with "ag_". Locked nodes cannot be removed or moved.
  Brand values are tokens, not hex: "$primary", "$secondary", "$bg", "$text", "$muted", "$font" — use them for colours and fonts so the page follows the store's palette.
- "insert_section": add a ready-made section from the catalogue to a page (preferred over hand-building). Its blocks get their default copy; follow with "ops" only if you already know the text to change (you will see the new ids in a repair round if something must be adjusted).
- "update_store": settings — allowed fields: name, tagline, description, primaryColor, secondaryColor (hex "#rrggbb"), fontFamily, announcementText, announcementActive, whatsappNumber, contactPhone, contactEmail, instagramUrl, facebookUrl, tiktokUrl, metaTitle, metaDescription, headerStyle, footerStyle, freeShippingThreshold, standardShippingFee.
- "create_page": a new custom page from catalogue sections (created unpublished; the seller publishes it).
- "generate_image": a photo drawn for a block: give the target, the nodeId, the prop path and a concrete English subject (products or scenes, never a person).
- "redesign": a complete new design of the five pages (home, header, footer, product, catalogue) from a one-sentence brief. Only when the seller asks for a whole new look; it replaces the drafts of all five pages.

## Rules
- Do only what the instruction asks; keep everything else as it is. Never remove the site_header or site_footer blocks, the express_checkout or product_detail blocks, unless explicitly asked.
- Copy in the language of the store's existing content (French unless it is clearly in another language). Concrete, commercial, no placeholders, no markdown. Delivery is cash on delivery in Morocco, 24/48h.
- To change a text, "set" the exact prop shown in the page data. To add content, prefer a catalogue section. Keep pages coherent: one hero, sections in a sensible order.
- Every action needs its target when it edits a page. Refer only to node ids that exist in the page data, or to ids you create in an earlier action of the same plan.
- At most ${MAX_ACTIONS} actions. Prefer fewer, larger "ops" actions per page.
- summary: for the seller, in the language of their instruction, 1-3 sentences; say what you could not do.`;

function trimStrings(value: unknown, max = 220): unknown {
  if (typeof value === 'string') return value.length > max ? value.slice(0, max) + '…' : value;
  if (Array.isArray(value)) return value.map((v) => trimStrings(v, max));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = trimStrings(v, max);
    return out;
  }
  return value;
}

function cap(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + `\n… (${text.length - max} more characters)` : text;
}

async function storeContext(store: any, targets: AgentTarget[], focus: AgentTargetKey | null, fullFor: Set<AgentTargetKey>): Promise<string> {
  const settings = {
    name: store.name, slug: store.slug, tagline: store.tagline, description: store.description ? String(store.description).slice(0, 300) : null,
    primaryColor: store.primaryColor, secondaryColor: store.secondaryColor, fontFamily: store.fontFamily, themeName: store.themeName,
    announcementText: store.announcementText, announcementActive: store.announcementActive,
    whatsappNumber: store.whatsappNumber, contactPhone: store.contactPhone, contactEmail: store.contactEmail,
    instagramUrl: store.instagramUrl, facebookUrl: store.facebookUrl, tiktokUrl: store.tiktokUrl,
    metaTitle: store.metaTitle, metaDescription: store.metaDescription, freeShippingThreshold: store.freeShippingThreshold, standardShippingFee: store.standardShippingFee,
  };
  const parts: string[] = [`## Store settings\n${JSON.stringify(settings)}`];
  parts.push(`## Pages\n${targets.map((t) => `- ${t.key}: ${t.label}${t.hasDraft ? ' (has an unpublished draft — you edit the draft)' : ''}`).join('\n')}`);
  for (const t of targets) {
    const { doc } = await working(t);
    const full = fullFor.has(t.key) || t.key === focus;
    const body = full ? cap(JSON.stringify(trimStrings(doc.root)), 26_000) : cap(outlineText(doc), 3_500);
    parts.push(`## Page ${t.key} — ${t.label}${full ? ' (full data: sections → children; edit props by exact path)' : ' (outline: type#id block "glance text")'}\n${body || '(empty page)'}`);
  }
  return parts.join('\n\n');
}

// ───────────────────────────────────────────── executing actions

interface ExecContext {
  store: any;
  userId: number;
  targets: Map<AgentTargetKey, AgentTarget>;
  touched: Set<AgentTargetKey>;
  provider: BuilderProvider;
  settings: BuilderSettings;
}

async function getTarget(ctx: ExecContext, raw: unknown): Promise<AgentTarget | null> {
  const key = parseKey(raw);
  if (!key) return null;
  const cached = ctx.targets.get(key);
  if (cached) return cached;
  const t = await targetFor(ctx.store, key);
  if (t) ctx.targets.set(key, t);
  return t;
}

async function applyToDraft(ctx: ExecContext, t: AgentTarget, ops: Op[]): Promise<{ ok: boolean; detail: string; applied: number; refused: { reason: string }[] }> {
  const { doc } = await working(t);
  const result = applyOps(doc, ops, { atomic: false });
  const refused = result.refused.map((r) => ({ reason: `op ${r.index} (${r.op.op}): ${r.reason}` }));
  if (result.applied === 0) return { ok: false, detail: `Aucune opération acceptée sur ${t.label}.`, applied: 0, refused };
  const problems = validateDocument(result.doc);
  if (problems.length) return { ok: false, detail: `Page invalide après modification : ${problems[0]}`, applied: 0, refused };
  await saveDraft(t.versionKind, t.versionKey, result.doc, ctx.userId);
  ctx.touched.add(t.key);
  return { ok: refused.length === 0, detail: `${result.applied} opération${result.applied > 1 ? 's' : ''} appliquée${result.applied > 1 ? 's' : ''} au brouillon de ${t.label}${refused.length ? `, ${refused.length} refusée${refused.length > 1 ? 's' : ''}` : ''}.`, applied: result.applied, refused };
}

function sanitizeOps(raw: unknown): Op[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((o) => o && typeof o === 'object' && typeof (o as any).op === 'string').slice(0, MAX_OPS_PER_ACTION) as Op[];
}

async function execute(ctx: ExecContext, action: any, index: number, round: number): Promise<AgentActionResult> {
  const base = { index, round, type: String(action?.type ?? '?'), target: typeof action?.target === 'string' ? action.target : undefined, note: str(action?.note, 120) };
  try {
    switch (action?.type) {
      case 'ops': {
        const t = await getTarget(ctx, action.target);
        if (!t) return { ...base, ok: false, detail: `Page inconnue : « ${action.target} ».` };
        const ops = sanitizeOps(action.ops);
        if (!ops.length) return { ...base, ok: false, detail: 'Aucune opération fournie.' };
        const r = await applyToDraft(ctx, t, ops);
        return { ...base, ...r };
      }
      case 'insert_section': {
        const t = await getTarget(ctx, action.target);
        if (!t) return { ...base, ok: false, detail: `Page inconnue : « ${action.target} ».` };
        const def = findSection(String(action.sectionId ?? ''));
        if (!def) return { ...base, ok: false, detail: `Section inconnue : « ${action.sectionId} ».` };
        const { doc } = await working(t);
        const node: SectionNode = def.build('ag');
        const index = Number.isInteger(action.index) && action.index >= 0 ? Math.min(Number(action.index), doc.root.length) : doc.root.length;
        const r = await applyToDraft(ctx, t, [{ op: 'insert', parentId: null, index, node }]);
        return { ...base, ...r, detail: r.ok ? `Section « ${def.name} » ajoutée à ${t.label} (id ${node.id}) : ${outlineText({ ...doc, root: [node] }).split('\n').slice(0, 12).join(' | ')}` : r.detail };
      }
      case 'update_store': {
        const data: Record<string, unknown> = {};
        const raw = action.settings && typeof action.settings === 'object' ? action.settings : {};
        const rejected: string[] = [];
        for (const [k, v] of Object.entries(raw)) {
          const read = STORE_FIELDS[k];
          if (!read) {
            rejected.push(k);
            continue;
          }
          const value = read(v);
          if (value === undefined) rejected.push(k);
          else data[k] = value;
        }
        if (!Object.keys(data).length) return { ...base, ok: false, detail: `Aucun réglage valide${rejected.length ? ` (refusés : ${rejected.join(', ')})` : ''}.` };
        await (prisma as any).store.update({ where: { id: ctx.store.id }, data });
        Object.assign(ctx.store, data);
        invalidateStore(ctx.store.id);
        return { ...base, ok: rejected.length === 0, detail: `Réglages mis à jour : ${Object.keys(data).join(', ')}${rejected.length ? ` ; refusés : ${rejected.join(', ')}` : ''}.` };
      }
      case 'create_page': {
        const title = str(action.title, 80);
        if (!title) return { ...base, ok: false, detail: 'Titre de page manquant.' };
        const ids: string[] = Array.isArray(action.sections) ? action.sections.map(String) : [];
        const root: SectionNode[] = [];
        const unknown: string[] = [];
        for (const id of ids) {
          const def = findSection(id);
          if (def) root.push(def.build('ag'));
          else unknown.push(id);
        }
        const doc: PageDocument = { version: 3, kind: 'page', settings: {}, root };
        const problems = validateDocument(doc);
        if (problems.length) return { ...base, ok: false, detail: `Page invalide : ${problems[0]}` };
        const page = await createStorePage(ctx.userId, { title, slug: str(action.slug, 60), customStructure: doc, isPublished: false });
        const key = `page:${page.id}` as AgentTargetKey;
        const t = await targetFor(ctx.store, key);
        if (t) {
          ctx.targets.set(key, t);
          ctx.touched.add(key);
        }
        return { ...base, target: key, ok: unknown.length === 0, detail: `Page « ${title} » créée (/pages/${page.slug}, non publiée) avec ${root.length} section${root.length > 1 ? 's' : ''}${unknown.length ? ` ; sections inconnues : ${unknown.join(', ')}` : ''}.` };
      }
      case 'generate_image': {
        const t = await getTarget(ctx, action.target);
        if (!t) return { ...base, ok: false, detail: `Page inconnue : « ${action.target} ».` };
        const nodeId = str(action.nodeId, 64);
        const subject = str(action.subject, 200);
        if (!nodeId || !subject) return { ...base, ok: false, detail: 'nodeId et subject sont requis.' };
        const prop = str(action.prop, 80) ?? 'props.url';
        const img = await generateSingleImage({ storeId: ctx.store.id, subject, size: action.size, colours: [ctx.store.primaryColor, ctx.store.secondaryColor] });
        if (!img.url) return { ...base, ok: false, detail: `Photo non générée : ${img.errors.join(' ; ') || 'erreur inconnue'}` };
        const r = await applyToDraft(ctx, t, [{ op: 'set', nodeId, path: prop, value: img.url }]);
        return { ...base, ...r, detail: r.ok ? `Photo « ${subject} » dessinée par ${img.engine} (${Math.round(img.durationMs / 1000)} s) et placée sur ${nodeId}.${prop} de ${t.label}.` : `Photo dessinée (${img.url}) mais non placée : ${r.refused[0]?.reason ?? r.detail}` };
      }
      case 'redesign': {
        const brief = str(action.brief, 600);
        if (!brief) return { ...base, ok: false, detail: 'Brief manquant.' };
        const { spec, engine } = await interpretBrief({ prompt: brief, storeName: ctx.store.name, provider: ctx.provider, settings: ctx.settings });
        let design = generateDesign({ prompt: brief, storeName: ctx.store.name }, spec);
        let photos = '';
        if (action.withImages) {
          const drawn = await generateDesignImages({ brief, subject: spec?.photoSubject, colours: [design.palette.primary, design.palette.secondary], storeId: ctx.store.id, mood: design.mood });
          if (Object.keys(drawn.images).length) design = generateDesign({ prompt: brief, storeName: ctx.store.name, images: drawn.images }, spec);
          photos = ` ${Object.keys(drawn.images).length} photo(s) par ${drawn.model}${drawn.errors.length ? ` (${drawn.errors.length} échec(s))` : ''}.`;
        }
        for (const [name, doc] of Object.entries(design.pages)) {
          const problems = validateDocument(doc as PageDocument);
          if (problems.length) return { ...base, ok: false, detail: `Design invalide (${name}) : ${problems[0]}` };
        }
        for (const key of ['home', 'header', 'footer', 'product', 'catalogue'] as const) {
          const t = await getTarget(ctx, key);
          if (!t) continue;
          await saveDraft(t.versionKind, t.versionKey, (design.pages as any)[key], ctx.userId);
          ctx.touched.add(key);
        }
        await (prisma as any).store.update({ where: { id: ctx.store.id }, data: { primaryColor: design.palette.primary, secondaryColor: design.palette.secondary, fontFamily: design.fontFamily, themeName: 'CUSTOM_OPENDESIGN' } });
        Object.assign(ctx.store, { primaryColor: design.palette.primary, secondaryColor: design.palette.secondary, fontFamily: design.fontFamily });
        invalidateStore(ctx.store.id);
        return { ...base, ok: true, detail: `Nouveau design « ${design.label} » (${engine.ai ? `lu par ${engine.model}` : 'lecture intégrée'}) en brouillon sur les 5 pages ; palette ${design.palette.primary}/${design.palette.secondary}, police ${design.fontFamily} appliquées.${photos}` };
      }
      default:
        return { ...base, ok: false, detail: `Action inconnue : « ${action?.type} ».` };
    }
  } catch (err: any) {
    return { ...base, ok: false, detail: `Erreur : ${String(err?.message || err).slice(0, 200)}` };
  }
}

async function publishTargets(ctx: ExecContext, keys: AgentTargetKey[], label: string): Promise<AgentTargetInfo[]> {
  const out: AgentTargetInfo[] = [];
  for (const key of keys) {
    const t = await getTarget(ctx, key);
    if (!t) continue;
    const draft = await getDraft(t.versionKind, t.versionKey);
    if (!draft) continue;
    const problems = validateDocument(draft.document);
    if (problems.length) continue;
    await t.saveLive(draft.document);
    await recordVersion(t.versionKind, t.versionKey, draft.document, { label, source: 'agent', userId: ctx.userId });
    await deleteDraft(t.versionKind, t.versionKey);
    out.push({ key: t.key, label: t.label, studioPath: t.studioPath, hasDraft: false });
  }
  if (out.length) invalidateStore(ctx.store.id);
  return out;
}

// ───────────────────────────────────────────── the run

export async function runStoreAgent(input: {
  userId: number;
  instruction: string;
  provider?: BuilderProvider;
  /** The page the seller is looking at: sent in full so exact props can be edited. */
  focus?: AgentTargetKey | null;
  /** Publish every page the run touched, when the admin allows it. */
  publish?: boolean;
}): Promise<AgentRunResult> {
  const started = Date.now();
  const settings = await getBuilderSettings();
  const store = await getOrCreateVendorStore(input.userId);
  const offered = await studioProviders(settings);
  let provider: BuilderProvider = input.provider === 'openai' ? 'openai' : 'claude';
  if (provider === 'openai' && !offered.openai.available) provider = 'claude';
  if (provider === 'claude' && !offered.claude.available && offered.openai.available) provider = 'openai';
  const usage = { input: 0, output: 0 };
  const results: AgentActionResult[] = [];
  let model: string | null = null;
  let summary = '';
  const ctx: ExecContext = { store, userId: input.userId, targets: new Map(), touched: new Set(), provider, settings };

  const record = async (status: string, error?: string): Promise<number | null> => {
    try {
      const row = await (prisma as any).storeAgentRun.create({
        data: { storeId: store.id, userId: input.userId, instruction: input.instruction.slice(0, 2000), provider, model, status, summary: summary || null, actions: results as any, durationMs: Date.now() - started, inputTokens: usage.input, outputTokens: usage.output },
      });
      return row.id;
    } catch (err) {
      console.error('[storeAgent] could not record run', err, error);
      return null;
    }
  };

  if (!settings.agent.enabled) {
    return { id: null, summary: '', model: null, provider, actions: [], drafts: [], published: [], durationMs: 0, usage, error: 'L’agent boutique est désactivé par l’administrateur.' };
  }
  if (!offered.claude.available && !offered.openai.available) {
    return { id: null, summary: '', model: null, provider, actions: [], drafts: [], published: [], durationMs: 0, usage, error: 'Aucun modèle IA disponible : l’administrateur doit activer Claude ou GPT pour le constructeur.' };
  }

  const infos = await listAgentTargets(store.id);
  const targets: AgentTarget[] = [];
  for (const info of infos) {
    const t = await targetFor(store, info.key);
    if (t) {
      t.hasDraft = info.hasDraft;
      targets.push(t);
      ctx.targets.set(t.key, t);
    }
  }
  const focus = input.focus && ctx.targets.has(input.focus) ? input.focus : null;

  const plan = async (user: string, fullFor: Set<AgentTargetKey>) => {
    const context = await storeContext(store, targets, focus, fullFor);
    // The catalogues and the store travel in the message, not the system
    // prompt: the Claude CLI takes the system prompt as a command-line
    // argument, and Windows caps a command line at 32k characters.
    const r = await askJson({
      provider,
      system: SYSTEM,
      user: `## Block registry\n${blockCatalogueText()}\n\n## Sections catalogue (ids for insert_section / create_page)\n${sectionsCatalogueText()}\n\n${context}\n\n## Instruction from the seller\n${user}`,
      schema: ACTION_SCHEMA as unknown as Record<string, unknown>,
      schemaName: 'store_actions',
      maxOutputTokens: 8000,
      timeoutMs: 240_000,
      settings,
    });
    usage.input += r.usage.input;
    usage.output += r.usage.output;
    model = r.model;
    const json = (r.json && typeof r.json === 'object' ? r.json : {}) as any;
    const actions: any[] = Array.isArray(json.actions) ? json.actions.slice(0, MAX_ACTIONS) : [];
    return { summary: str(json.summary, 500) ?? '', actions };
  };

  try {
    const first = await plan(input.instruction, new Set());
    summary = first.summary;
    for (let i = 0; i < first.actions.length; i++) results.push(await execute(ctx, first.actions[i], i, 1));

    // One repair round: the model sees what was refused, with the full data
    // of those pages, and fixes only that.
    const failed = results.filter((r) => !r.ok || (r.refused && r.refused.length));
    if (failed.length && first.actions.length) {
      const fullFor = new Set<AgentTargetKey>();
      for (const f of failed) {
        const k = parseKey(f.target);
        if (k && ctx.targets.has(k)) fullFor.add(k);
      }
      const report = failed.map((f) => `- action ${f.index} (${f.type}${f.target ? ` on ${f.target}` : ''}): ${f.detail}${f.refused?.length ? '\n  refused: ' + f.refused.map((x) => x.reason).join('; ') : ''}`).join('\n');
      const repair = await plan(`${input.instruction}\n\n## Repair round\nYour previous plan was executed. These steps failed or were partly refused:\n${report}\n\nThe page data above is the CURRENT state (after the accepted steps). Answer with only the actions needed to complete what failed; do not repeat what succeeded. If nothing can be done, answer with an empty actions list and say why in the summary.`, fullFor);
      for (let i = 0; i < repair.actions.length; i++) results.push(await execute(ctx, repair.actions[i], results.length, 2));
      if (repair.summary) summary = `${summary} ${repair.summary}`.trim();
    }
  } catch (err: any) {
    const message = String(err?.message || err).slice(0, 300);
    console.error('[storeAgent] failed:', message);
    const id = await record('failed', message);
    return { id, summary, model, provider, actions: results, drafts: [], published: [], durationMs: Date.now() - started, usage, error: `Le modèle n’a pas répondu : ${message}` };
  }

  let published: AgentTargetInfo[] = [];
  if (input.publish && settings.agent.allowPublish && ctx.touched.size) {
    published = await publishTargets(ctx, [...ctx.touched], `Agent IA : ${input.instruction.slice(0, 60)}`);
  }
  const drafts: AgentTargetInfo[] = [];
  for (const key of ctx.touched) {
    if (published.some((p) => p.key === key)) continue;
    const t = ctx.targets.get(key);
    if (!t) continue;
    const draft = await getDraft(t.versionKind, t.versionKey);
    if (draft) drafts.push({ key: t.key, label: t.label, studioPath: t.studioPath, hasDraft: true });
  }
  const id = await record(results.every((r) => r.ok) ? 'done' : 'partial');
  return { id, summary, model, provider, actions: results, drafts, published, durationMs: Date.now() - started, usage };
}

export async function listAgentRuns(storeId: number, limit = 10) {
  const rows = await (prisma as any).storeAgentRun.findMany({ where: { storeId }, orderBy: { createdAt: 'desc' }, take: limit });
  return rows.map((r: any) => ({ id: r.id, instruction: r.instruction, provider: r.provider, model: r.model, status: r.status, summary: r.summary, actions: r.actions, durationMs: r.durationMs, createdAt: r.createdAt }));
}

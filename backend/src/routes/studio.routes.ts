import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { productScopeOf, isProductInScope, OUT_OF_SCOPE } from '../lib/subAccountProductScope.js';
import { invalidate, compileNow } from '../services/landingCompiler/index.js';
import { invalidateStore, compileStoreDocument } from '../services/storeCompiler/index.js';
import { INSPECT_RUNTIME } from '../services/storeCompiler/inspectRuntime.js';
import { getOrCreateVendorStore, getOrCreateGlobalSection, getStoreProducts, type GlobalSectionKey } from '../services/store.service.js';
import { getDraft, saveDraft, deleteDraft, recordVersion, listVersions, getVersion } from '../services/studioVersions.service.js';
import { mode } from './landing.routes.js';
import { validateLandingPageUpdate } from '../validations/landingPage.validation.js';
import { BLOCKS } from '../shared/blocks/index.js';
import { TEMPLATES, templatesFor } from '../shared/templates/index.js';
import { getTheme, themeSummaries } from '../shared/templates/themes.js';
import { generateDesign, EXAMPLE_BRIEFS, NICHE_LABELS } from '../shared/templates/opendesign.js';
import { interpretBrief, studioProviders, getBuilderSettings, type BuilderProvider } from '../services/designBrain.service.js';
import { generateDesignImages, sanitizeDesignImages, type DesignImages } from '../services/designImages.service.js';
import { runStoreAgent, listAgentRuns, listAgentTargets, type AgentTargetKey } from '../services/storeAgent.service.js';
import {
  applyOps,
  ensureDocument,
  flatBlocks,
  outlineTree,
  outlineText,
  roundTrips,
  toLegacy,
  validateDocument,
  type Op,
  type PageDocument,
  type PageKind,
} from '../shared/document/index.js';

/**
 * The Studio API: the one door through which a page document changes.
 *
 * The editor calls `POST .../ops` when a person drags a block. An agent will
 * call the same route when a person asks for a page in a sentence. Both send
 * operations, both get back the document, its outline and any refusals, and
 * both are refused the same things for the same reasons — the validation is
 * `applyOps` in shared/document, not anything here.
 *
 * Every change lands in a DRAFT. Nothing a customer sees moves until
 * `POST .../publish`, which copies the draft into the live page (compiling a
 * landing page on the way, exactly as the old save route did), records a
 * version, and clears the draft. History is append-only; a restore writes a
 * new draft from an old version and the seller publishes it like any change.
 *
 * Seven targets share the routine: a referral link's landing page; a store's
 * home; its header, footer, product template and catalogue template
 * (reserved store pages); and each custom page. Each knows how to load its
 * live document, how to write it, and what to tell the editor about itself.
 */

const prisma = new PrismaClient();
const router = Router();

const EDIT_ROLES = ['VENDOR', 'INFLUENCER', 'HELPER', 'SUPER_ADMIN'] as const;
const STORE_ROLES = ['VENDOR', 'SUPER_ADMIN', 'INFLUENCER'] as const;

interface Target {
  kind: PageKind;
  /** The (kind, key) pair drafts and versions are filed under. */
  versionKind: string;
  versionKey: string;
  /** Shown in the editor's title bar. */
  label: string;
  /** Path the compiled or served page lives at, on the owner's host. */
  previewPath: string;
  load(): Promise<PageDocument>;
  save(doc: PageDocument): Promise<{ storedAs: 'flat' | 'tree'; compile?: any }>;
  /** Extra fields the editor shows for this target. */
  extra: Record<string, unknown>;
}

// ───────────────────────────────────────────────── landing page target

/** Mirrors the landing-page save route: owner, admin, or an assigned helper. */
async function landingTarget(req: Request, linkId: number): Promise<Target> {
  if (!Number.isInteger(linkId) || linkId <= 0) throw new AppException(400, 'Invalid link id');

  const scope = productScopeOf(req);
  const link = await (prisma as any).referralLink.findUnique({
    where: { id: linkId },
    include: { landingPage: true, product: { select: { id: true, nameFr: true } } },
  });
  if (!link) throw new AppException(404, 'Referral link not found');
  if (scope && !isProductInScope(scope, link.productId)) throw new AppException(403, OUT_OF_SCOPE);

  const userId = req.user!.id;
  const isAdmin = req.user!.roleName === 'SUPER_ADMIN';
  const isOwner = link.influencerId === userId;
  let isHelper = false;
  if (req.user!.roleName === 'HELPER' && (req.user as any).canManageInfluencerLinks) {
    const assignment = await (prisma as any).helperUserAssignment.findFirst({
      where: { helperId: userId, targetUserId: link.influencerId },
    });
    isHelper = Boolean(assignment);
  }
  if (!isAdmin && !isOwner && !isHelper) {
    throw new AppException(403, 'You do not have permission to perform this action');
  }

  return {
    kind: 'landing',
    versionKind: 'landing',
    versionKey: `link:${link.id}`,
    label: link.product?.nameFr || link.code,
    previewPath: `/r/${link.code}`,
    extra: {
      theme: { primary: link.landingPage?.themeColor ?? '#f97316', secondary: '#1e293b', font: 'Inter' },
      link: { id: link.id, code: link.code, productId: link.productId, productName: link.product?.nameFr ?? null },
      page: {
        themeColor: link.landingPage?.themeColor ?? '#f97316',
        title: link.landingPage?.title ?? null,
        description: link.landingPage?.description ?? null,
        buttonText: link.landingPage?.buttonText ?? null,
      },
    },
    async load() {
      return ensureDocument(link.landingPage?.customStructure, 'landing');
    },
    async save(doc) {
      // Store flat while flat is enough; the tree only once it carries structure.
      const flat = roundTrips(doc) ? toLegacy(doc) : null;
      const customStructure = flat ?? doc;
      const problem = validateLandingPageUpdate({ customStructure });
      if (problem) throw new AppException(400, problem);

      const landingPage = await (prisma as any).referralLinkLandingPage.upsert({
        where: { referralLinkId: link.id },
        update: { customStructure },
        create: { referralLinkId: link.id, customStructure },
      });
      try {
        await (prisma as any).referralLinkCompiledPage.updateMany({
          where: { landingPageId: landingPage.id },
          data: { compiledAt: null, compilerVersion: null },
        });
      } catch (err) {
        console.error('[Studio] failed to mark compiled page stale for link', link.id, err);
      }
      invalidate(link.code);
      let compile = null;
      try {
        compile = await compileNow(link.code, mode());
      } catch (err) {
        console.error('[Studio] compile-on-save failed for', link.code, err);
      }
      return { storedAs: flat ? 'flat' : 'tree', compile };
    },
  };
}

// ───────────────────────────────────────────────── store targets

/**
 * The brand values the editor resolves tokens against, so `$primary` on the
 * canvas is the store's colour and not a literal dollar sign. The same three
 * values the compiler reads; nothing else on the row is a token.
 */
function storeTheme(store: any): { primary: string; secondary: string; font: string } {
  return {
    primary: typeof store?.primaryColor === 'string' && store.primaryColor ? store.primaryColor : '#f97316',
    secondary: typeof store?.secondaryColor === 'string' && store.secondaryColor ? store.secondaryColor : '#1e293b',
    font: typeof store?.fontFamily === 'string' && store.fontFamily ? store.fontFamily : 'Inter',
  };
}

function assertDocument(doc: PageDocument): void {
  const problems = validateDocument(doc);
  if (problems.length) throw new AppException(400, problems[0]);
}

async function storeHomeTarget(req: Request): Promise<Target> {
  const store = await getOrCreateVendorStore(req.user!.id);
  return {
    kind: 'home',
    versionKind: 'store-home',
    versionKey: `store:${store.id}`,
    label: `${store.name} — Accueil`,
    previewPath: '/',
    extra: { store: { id: store.id, name: store.name, slug: store.slug }, theme: storeTheme(store) },
    async load() {
      return ensureDocument(store.homeStructure, 'home');
    },
    async save(doc) {
      assertDocument(doc);
      await (prisma as any).store.update({ where: { id: store.id }, data: { homeStructure: doc } });
      invalidateStore(store.id);
      return { storedAs: 'tree' };
    },
  };
}

async function storePageTarget(req: Request, pageId: number): Promise<Target> {
  if (!Number.isInteger(pageId) || pageId <= 0) throw new AppException(400, 'Invalid page id');
  const store = await getOrCreateVendorStore(req.user!.id);
  const page = await (prisma as any).storePage.findFirst({ where: { id: pageId, storeId: store.id } });
  if (!page) throw new AppException(404, 'Page introuvable');
  return {
    kind: 'page',
    versionKind: 'store-page',
    versionKey: `store:${store.id}:page:${page.id}`,
    label: page.title,
    previewPath: `/pages/${page.slug}`,
    extra: { store: { id: store.id, name: store.name, slug: store.slug }, storePage: { id: page.id, title: page.title, slug: page.slug }, theme: storeTheme(store) },
    async load() {
      return ensureDocument(page.customStructure, 'page');
    },
    async save(doc) {
      assertDocument(doc);
      await (prisma as any).storePage.update({ where: { id: page.id }, data: { customStructure: doc } });
      invalidateStore(store.id);
      return { storedAs: 'tree' };
    },
  };
}

const SECTION_LABEL: Record<GlobalSectionKey, string> = { header: 'En-tête', footer: 'Pied de page', product: 'Fiche produit', catalogue: 'Catalogue' };
const SECTION_KIND: Record<GlobalSectionKey, PageKind> = { header: 'page', footer: 'page', product: 'product', catalogue: 'collection' };

async function globalSectionTarget(req: Request, key: GlobalSectionKey): Promise<Target> {
  const store = await getOrCreateVendorStore(req.user!.id);
  const page = await getOrCreateGlobalSection(store.id, key);
  return {
    kind: SECTION_KIND[key],
    versionKind: `store-${key}`,
    versionKey: `store:${store.id}`,
    label: `${store.name} — ${SECTION_LABEL[key]}`,
    previewPath: key === 'catalogue' ? '/products' : '/',
    extra: { store: { id: store.id, name: store.name, slug: store.slug }, globalSection: key, theme: storeTheme(store) },
    async load() {
      return ensureDocument(page.customStructure, SECTION_KIND[key]);
    },
    async save(doc) {
      assertDocument(doc);
      await (prisma as any).storePage.update({ where: { id: page.id }, data: { customStructure: doc } });
      invalidateStore(store.id);
      return { storedAs: 'tree' };
    },
  };
}

// ───────────────────────────────────────────────── shared handlers

async function payload(target: Target, doc: PageDocument, hasDraft: boolean) {
  const versions = await listVersions(target.versionKind, target.versionKey, 20);
  return {
    document: doc,
    outline: outlineTree(doc),
    outlineText: outlineText(doc),
    target: { kind: target.kind, label: target.label, previewPath: target.previewPath },
    hasDraft,
    versions,
    templates: templatesFor(target.kind).map((t) => ({ id: t.id, label: t.label, description: t.description })),
    ...target.extra,
  };
}

/** The draft when there is one, else the live page. What the editor edits. */
async function working(target: Target): Promise<{ doc: PageDocument; hasDraft: boolean }> {
  const draft = await getDraft(target.versionKind, target.versionKey);
  if (draft) return { doc: draft.document, hasDraft: true };
  return { doc: await target.load(), hasDraft: false };
}

async function handleGet(target: Target, res: Response) {
  const { doc, hasDraft } = await working(target);
  res.json({ status: 'success', data: await payload(target, doc, hasDraft) });
}

/** Applies ops to the draft. Nothing live changes. */
async function handleOps(target: Target, req: Request, res: Response) {
  const ops = req.body?.ops;
  if (!Array.isArray(ops) || !ops.length) throw new AppException(400, 'ops must be a non-empty array');
  if (ops.length > 500) throw new AppException(400, 'at most 500 ops per request');

  const { doc: before, hasDraft } = await working(target);
  const result = applyOps(before, ops as Op[], { atomic: req.body?.atomic !== false });

  if (result.applied === 0) {
    return res.json({ status: 'success', data: { ...(await payload(target, before, hasDraft)), applied: 0, inverse: [], refused: result.refused } });
  }

  assertDocument(result.doc);
  await saveDraft(target.versionKind, target.versionKey, result.doc, req.user!.id);
  res.json({
    status: 'success',
    data: { ...(await payload(target, result.doc, true)), applied: result.applied, inverse: result.inverse, refused: result.refused, storedAs: 'draft' },
  });
}

/** Draft → live. The only route that changes what a customer sees. */
async function handlePublish(target: Target, req: Request, res: Response) {
  const draft = await getDraft(target.versionKind, target.versionKey);
  if (!draft) throw new AppException(400, 'Rien à publier : aucun brouillon.');

  const saved = await target.save(draft.document);
  const version = await recordVersion(target.versionKind, target.versionKey, draft.document, {
    label: typeof req.body?.label === 'string' ? req.body.label : null,
    source: 'publish',
    userId: req.user!.id,
  });
  await deleteDraft(target.versionKind, target.versionKey);

  res.json({ status: 'success', data: { ...(await payload(target, draft.document, false)), published: true, version, ...saved } });
}

async function handleDiscard(target: Target, res: Response) {
  await deleteDraft(target.versionKind, target.versionKey);
  const live = await target.load();
  res.json({ status: 'success', data: await payload(target, live, false) });
}

async function handleRestore(target: Target, req: Request, res: Response) {
  const id = parseInt(String(req.params.vid), 10);
  const version = await getVersion(target.versionKind, target.versionKey, id);
  if (!version) throw new AppException(404, 'Version introuvable');
  // A restore is a new draft, never a live write: the seller looks, then publishes.
  await saveDraft(target.versionKind, target.versionKey, version.document, req.user!.id);
  res.json({ status: 'success', data: { ...(await payload(target, version.document, true)), restoredFrom: version.id } });
}

function mount(path: string, roles: readonly string[], resolve: (req: Request) => Promise<Target>) {
  const auth = [authenticate, authorize(...(roles as any))];
  router.get(path, ...auth, asyncHandler(async (req, res) => handleGet(await resolve(req), res)));
  router.post(`${path}/ops`, ...auth, asyncHandler(async (req, res) => handleOps(await resolve(req), req, res)));
  router.post(`${path}/publish`, ...auth, asyncHandler(async (req, res) => handlePublish(await resolve(req), req, res)));
  router.post(`${path}/discard`, ...auth, asyncHandler(async (req, res) => handleDiscard(await resolve(req), res)));
  router.get(`${path}/versions`, ...auth, asyncHandler(async (req, res) => {
    const target = await resolve(req);
    res.json({ status: 'success', data: { versions: await listVersions(target.versionKind, target.versionKey, 50) } });
  }));
  router.post(`${path}/versions/:vid/restore`, ...auth, asyncHandler(async (req, res) => handleRestore(await resolve(req), req, res)));
}

// ───────────────────────────────────────────────── catalogue, templates, themes

/**
 * The block registry as data, for the palette, the inspector and an agent's
 * tool catalogue. Schemas travel as their field names: zod is not
 * serialisable, and what a caller needs is which keys exist, their defaults
 * and how they group.
 */
router.get('/catalogue', authenticate, authorize(...EDIT_ROLES), asyncHandler(async (_req: Request, res: Response) => {
  const blocks = BLOCKS.map((b) => {
    const shape = (b.schema as any)._def?.shape?.() ?? (b.schema as any).shape ?? {};
    return {
      type: b.type, label: b.meta.label, description: b.meta.description, category: b.meta.category, icon: b.meta.icon,
      badge: b.meta.badge ?? null, fields: Object.keys(shape), defaults: b.defaults, inspector: b.inspector,
      presets: Object.keys(b.presets ?? {}), binds: b.binds, needsRuntime: b.needsRuntime, compiled: b.compiled,
    };
  });
  res.json({ status: 'success', data: { blocks } });
}));

router.get('/templates', authenticate, authorize(...EDIT_ROLES), asyncHandler(async (req: Request, res: Response) => {
  const kind = typeof req.query.kind === 'string' ? (req.query.kind as PageKind) : null;
  const list = kind ? templatesFor(kind) : TEMPLATES;
  res.json({ status: 'success', data: { templates: list } });
}));

router.get('/store/themes', authenticate, authorize(...STORE_ROLES), asyncHandler(async (_req: Request, res: Response) => {
  res.json({ status: 'success', data: { themes: themeSummaries() } });
}));

// ───────────────────────────────────────────────── previews and OpenDesign

type PreviewPage = 'home' | 'product' | 'catalogue';
const PREVIEW_PAGES: PreviewPage[] = ['home', 'product', 'catalogue'];

interface ThemePages {
  home: unknown;
  header?: unknown;
  footer?: unknown;
  product?: unknown;
  catalogue?: unknown;
}

/**
 * What a preview shows when the store has no products yet: six believable
 * cards, so a seller judges the design and not an empty grid. Real products
 * take over the moment there are three of them.
 */
const PLACEHOLDER_PRODUCTS = [
  { id: -1, ref: 'exemple-1', nameFr: 'Produit vedette', description: 'Un exemple de fiche. Vos propres produits apparaîtront ici dès que vous en aurez ajouté.', retailPriceMad: 349, stockQuantity: 12 },
  { id: -2, ref: 'exemple-2', nameFr: 'Best-seller de la semaine', description: 'Le produit que vos clients recommandent le plus.', retailPriceMad: 249, stockQuantity: 30 },
  { id: -3, ref: 'exemple-3', nameFr: 'Nouveauté', description: 'La dernière arrivée du catalogue.', retailPriceMad: 199, stockQuantity: 8 },
  { id: -4, ref: 'exemple-4', nameFr: 'Coffret découverte', description: 'Trois produits pour tester la gamme.', retailPriceMad: 499, stockQuantity: 5 },
  { id: -5, ref: 'exemple-5', nameFr: 'Édition limitée', description: 'Quantités limitées, prix bloqué.', retailPriceMad: 599, stockQuantity: 3 },
  { id: -6, ref: 'exemple-6', nameFr: 'L’essentiel', description: 'Le produit du quotidien, au bon prix.', retailPriceMad: 129, stockQuantity: 40 },
].map((p) => ({ ...p, sku: p.ref.toUpperCase(), images: [], categories: [{ nameFr: 'Exemple' }] }));

/**
 * The header and footer of a theme carry no brand text of their own; the
 * store's name goes in when the pages are previewed or installed, so the
 * seller never sees "MA BOUTIQUE" where their name should be.
 */
function branded<T extends ThemePages>(pages: T, storeName: string): T {
  const name = String(storeName ?? '').trim();
  const stamp = (doc: unknown, type: string): unknown => {
    if (!doc || typeof doc !== 'object' || !name) return doc;
    const copy = JSON.parse(JSON.stringify(doc));
    const visit = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'block' && node.block === type) {
        node.props = node.props ?? {};
        if (!String(node.props.brandText ?? '').trim() || node.props.brandText === 'MA BOUTIQUE') node.props.brandText = name;
        if (type === 'site_footer' && /^© 2026 (— |Ma boutique\.|Ma Boutique\.)/.test(String(node.props.copyright ?? ''))) node.props.copyright = `© 2026 ${name}. Tous droits réservés.`;
      }
      if (Array.isArray(node.children)) node.children.forEach(visit);
    };
    if (Array.isArray(copy.root)) copy.root.forEach(visit);
    return copy;
  };
  return { ...pages, header: stamp(pages.header, 'site_header'), footer: stamp(pages.footer, 'site_footer') };
}

async function sampleProducts(storeId: number): Promise<any[]> {
  try {
    const r = await getStoreProducts(storeId, { page: 1, limit: 12 });
    const products = Array.isArray(r?.products) ? r.products : [];
    if (products.length >= 3) return products;
  } catch (err) {
    console.error('[Studio] preview: could not load store products', err);
  }
  return PLACEHOLDER_PRODUCTS;
}

/** Inside the dashboard's iframe a link must not navigate; a click is a look, not a visit. */
const PREVIEW_GUARD =
  `<script>document.addEventListener('click',function(e){var t=e.target;var a=t&&t.closest?t.closest('a'):null;` +
  `if(a){e.preventDefault();e.stopPropagation();}},true);</script>`;

/**
 * A one-time reveal: the page's top-level nodes (the sections) slide in one
 * after another, so a seller sees the store they just generated being laid
 * out rather than popping in whole. Purely visual; the HTML is the final one.
 */
const REVEAL_RUNTIME =
  `<style>[data-od-reveal]{opacity:0;transform:translateY(22px);transition:opacity .5s ease,transform .5s ease}[data-od-reveal="on"]{opacity:1;transform:none}</style>` +
  `<script>(function(){function top(){var all=Array.prototype.slice.call(document.querySelectorAll('[data-od-node]'));` +
  `var t=all.filter(function(e){var p=e.parentElement;while(p){if(p.hasAttribute&&p.hasAttribute('data-od-node'))return false;p=p.parentElement;}return true;});` +
  `if(!t.length){t=Array.prototype.slice.call(document.body.children).filter(function(e){return e.tagName!=='SCRIPT'&&e.tagName!=='STYLE'&&e.getBoundingClientRect().height>40;});}return t;}` +
  `var els=top();els.forEach(function(e){e.setAttribute('data-od-reveal','');});` +
  `els.forEach(function(e,i){setTimeout(function(){e.setAttribute('data-od-reveal','on');},150+i*190);});})();</script>`;

/**
 * A theme's page compiled exactly as the storefront would compile it — the
 * same renderers, the same runtime, the seller's own products — so what the
 * gallery shows is what installing gives, not a drawing of it.
 */
async function renderPreview(req: Request, res: Response, pages: ThemePages, palette: any, fontFamily: string | null, which: PreviewPage, inspect = false, reveal = false) {
  const store = await getOrCreateVendorStore(req.user!.id);
  const products = await sampleProducts(store.id);
  const preview = {
    name: store.name, logoUrl: store.logoUrl ?? null, metaTitle: store.name,
    primaryColor: palette?.primary || store.primaryColor, secondaryColor: palette?.secondary || store.secondaryColor,
    fontFamily: fontFamily || store.fontFamily || null,
  };
  const catalogue = async (opts: { limit?: number }) => products.slice(0, opts.limit ?? 24);
  const bindings = { product: products[0], collection: null, catalogue, storeId: store.id };
  const page = which === 'home' ? pages.home : which === 'product' ? pages.product : pages.catalogue;
  if (!page) throw new AppException(400, `Ce modèle n’a pas de page « ${which} »`);
  const chrome = branded(pages, store.name);

  const out = await compileStoreDocument({
    store: preview, user: { subdomain: null, pixels: [] }, kind: which,
    page, header: chrome.header ?? null, footer: chrome.footer ?? null,
    path: which === 'home' ? '/' : which === 'product' ? `/p/${products[0].ref}` : '/products',
    title: which === 'product' ? products[0].nameFr : which === 'catalogue' ? 'Tous les produits' : null,
    bindings,
    inspect,
  });
  if (!out) throw new AppException(422, 'Cette page contient un bloc que le compilateur ne rend pas encore');

  // Relative URLs — product images under /uploads, the cart runtime's API —
  // resolve against this API's own origin, not the dashboard's.
  const origin = `${req.protocol}://${req.get('host')}`;
  // The click-to-edit runtime replaces the plain guard: it swallows link and
  // form activation itself, then reports clicks and text edits to the panel.
  const html = out.html.replace('<head>', `<head><base href="${origin}/">`).replace('</body>', `${inspect ? INSPECT_RUNTIME : PREVIEW_GUARD}${reveal ? REVEAL_RUNTIME : ''}</body>`);
  res.json({ status: 'success', data: { page: which, html, products: products.length, placeholder: products === PLACEHOLDER_PRODUCTS } });
}

function previewPage(raw: unknown): PreviewPage {
  const value = String(raw ?? 'home');
  return (PREVIEW_PAGES as string[]).includes(value) ? (value as PreviewPage) : 'home';
}

router.get('/store/themes/examples', authenticate, authorize(...STORE_ROLES), asyncHandler(async (_req: Request, res: Response) => {
  // Which brains the Studio may offer: the admin's choice (Builder AI panel),
  // narrowed by what is configured. GPT needs OPENAI_API_KEY in Variables &
  // Secrets; the key itself never leaves the server.
  const providers = await studioProviders();
  const engine = {
    ai: providers.claude.available,
    model: providers.claude.model,
    note: providers.claude.available ? (providers.claude.model?.startsWith('Claude CLI') ? 'Propulsé par Claude CLI local' : null) : 'Lecture intégrée',
  };
  res.json({ status: 'success', data: { examples: EXAMPLE_BRIEFS, niches: NICHE_LABELS, engine, providers } });
}));

type GenEmit = (event: string, data: unknown) => void;

/**
 * OpenDesign: a complete store design from a sentence. Deterministic for a
 * brief and a seed; validated here so nothing the engine composes can reach
 * an install without passing the same gate a Studio edit does.
 *
 * Shared by the JSON route and the streaming route: every step is reported
 * through `emit` — the model's answer as it is written, each photo, each
 * section the composer places — so a seller watches the real work, not a
 * timer.
 */
async function generateStore(req: Request, emit: GenEmit) {
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  if (!prompt) throw new AppException(400, 'Décrivez votre boutique en une phrase pour générer un design');
  if (prompt.length > 600) throw new AppException(400, 'La description doit faire moins de 600 caractères');
  const store = await getOrCreateVendorStore(req.user!.id);
  const mode = ['auto', 'light', 'dark'].includes(req.body?.mode) ? req.body.mode : 'auto';
  // The engine is the seller's pick, but only among what the admin offers:
  // a request for an engine that is off is answered with the next one on.
  const settings = await getBuilderSettings();
  const offered = await studioProviders(settings);
  let skipAi = Boolean(req.body?.skipAi);
  let provider: BuilderProvider = req.body?.provider === 'openai' ? 'openai' : 'claude';
  if (skipAi && !offered.instant.available) skipAi = false;
  if (!skipAi) {
    const ok = (p: BuilderProvider) => (p === 'openai' ? offered.openai.available : offered.claude.available);
    if (!ok(provider)) {
      const other: BuilderProvider = provider === 'openai' ? 'claude' : 'openai';
      if (ok(other)) provider = other;
      else skipAi = true;
    }
  }
  // Photos: the ones a previous generation drew for this brief come back from
  // the client so a new arrangement keeps them; `withImages` asks for a fresh
  // set, drawn AFTER the brief is read so the photographer gets the brain's
  // subject ("flame-grilled beef burgers") and the design's own colours.
  const keptImages = sanitizeDesignImages(req.body?.images);
  const withImages = Boolean(req.body?.withImages) && offered.openai.images;

  const brainLabel = provider === 'openai' ? offered.openai.model : offered.claude.model;
  emit('stage', { id: 'read', label: skipAi ? 'Lecture instantanée intégrée du brief' : `Lecture de votre brief par ${brainLabel ?? 'le modèle'}`, provider, skipAi });
  const readStarted = Date.now();
  // The builder model, when an admin has enabled one, reads the brief and may
  // write the copy; the composer below arranges the store either way.
  const { spec, engine } = skipAi
    ? { spec: null, engine: { ai: false, model: null, note: 'Lecture instantanée intégrée' } }
    : await interpretBrief({ prompt, storeName: store.name, provider, settings, onEvent: (e) => emit('brain', e) });
  emit('engine', { ...engine, ms: Date.now() - readStarted });
  if (spec) {
    emit('spec', {
      niche: spec.niche, mood: spec.mood, colours: spec.colours ?? null, font: spec.font ?? null, wants: spec.wants ?? [], drops: spec.drops ?? [],
      buttonLabel: spec.buttonLabel ?? null, minimal: Boolean(spec.minimal), summary: spec.summary ?? null, photoSubject: spec.photoSubject ?? null,
      headline: spec.copy?.headline ?? null, subhead: spec.copy?.subhead ?? null, copyFields: spec.copy ? Object.keys(spec.copy) : [],
    });
  }

  const briefFor = (images?: DesignImages) => ({
    prompt,
    seed: Number.isFinite(Number(req.body?.seed)) ? Number(req.body.seed) : 0,
    mode,
    palette: req.body?.palette && typeof req.body.palette === 'object' ? req.body.palette : undefined,
    fontFamily: typeof req.body?.fontFamily === 'string' ? req.body.fontFamily : undefined,
    storeName: store.name,
    extraSectionIds: Array.isArray(req.body?.extraSectionIds) ? req.body.extraSectionIds : undefined,
    images,
  });
  // A first, photo-less composition is cheap and tells the photographer the palette and mood.
  emit('stage', { id: 'compose', label: 'Composition des 5 pages à partir de la lecture' });
  const draft = generateDesign(briefFor(keptImages), spec);
  let drawn: Awaited<ReturnType<typeof generateDesignImages>> | null = null;
  if (withImages) {
    emit('stage', { id: 'photos', label: `Photos pour « ${spec?.photoSubject ?? prompt.slice(0, 60)} »` });
    drawn = await generateDesignImages({ brief: prompt, subject: spec?.photoSubject, colours: [draft.palette.primary, draft.palette.secondary], storeId: store.id, mood: draft.mood, onEvent: (e) => emit('photo', e) });
  }
  const images: DesignImages | undefined = drawn && Object.keys(drawn.images).length ? { ...keptImages, ...drawn.images } : keptImages;
  const design = drawn && Object.keys(drawn.images).length ? generateDesign(briefFor(images), spec) : draft;
  design.sections.forEach((label, index) => emit('section', { index, label, total: design.sections.length, variant: design.variant?.[label] ?? null }));
  for (const [key, doc] of Object.entries(design.pages)) emit('page', { key, blocks: flatBlocks(doc as PageDocument).length, sections: (doc as PageDocument).root.length });
  emit('stage', { id: 'validate', label: 'Validation des 5 pages' });
  for (const [name, doc] of Object.entries(design.pages)) {
    const problems = validateDocument(doc as PageDocument);
    if (problems.length) throw new AppException(500, `La page « ${name} » générée est invalide : ${problems[0]}`);
  }
  const photos = drawn
    ? { model: drawn.model, generated: Object.keys(drawn.images).length, sources: drawn.sources, errors: drawn.errors, durationMs: drawn.durationMs }
    : null;
  return { design, engine, images: images ?? null, photos };
}

router.post('/store/themes/generate', authenticate, authorize(...STORE_ROLES), asyncHandler(async (req: Request, res: Response) => {
  const data = await generateStore(req, () => {});
  res.json({ status: 'success', data });
}));

/** The same generation as Server-Sent Events: the model writing, each photo, each section, then the whole design. */
router.post('/store/themes/generate/stream', authenticate, authorize(...STORE_ROLES), asyncHandler(async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  // no-transform keeps the compression middleware from buffering the stream.
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  const flush = () => {
    const r = res as any;
    if (typeof r.flush === 'function') r.flush();
  };
  const emit: GenEmit = (event, data) => {
    if (res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    flush();
  };
  const ping = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': ping\n\n');
      flush();
    }
  }, 15_000);
  try {
    const data = await generateStore(req, emit);
    emit('done', data);
  } catch (err: any) {
    emit('error', { message: String(err?.message || err).slice(0, 300) });
  } finally {
    clearInterval(ping);
    res.end();
  }
}));

// ───────────────────────────────────────────────── the store agent

/**
 * The store agent: a sentence from the seller, a plan of actions from the
 * model, drafts on the pages it touched. See services/storeAgent.service.ts.
 */
router.get('/store/agent/status', authenticate, authorize(...STORE_ROLES), asyncHandler(async (req: Request, res: Response) => {
  const settings = await getBuilderSettings();
  const store = await getOrCreateVendorStore(req.user!.id);
  const providers = await studioProviders(settings);
  res.json({
    status: 'success',
    data: {
      enabled: settings.agent.enabled && (providers.claude.available || providers.openai.available),
      allowPublish: settings.agent.allowPublish,
      providers,
      targets: await listAgentTargets(store.id),
      runs: await listAgentRuns(store.id, 10),
    },
  });
}));

router.post('/store/agent/run', authenticate, authorize(...STORE_ROLES), asyncHandler(async (req: Request, res: Response) => {
  const instruction = typeof req.body?.instruction === 'string' ? req.body.instruction.trim() : '';
  if (!instruction) throw new AppException(400, 'Dites à l’agent ce que vous voulez changer.');
  if (instruction.length > 2000) throw new AppException(400, 'L’instruction doit faire moins de 2000 caractères.');
  const focusRaw = typeof req.body?.focus === 'string' ? req.body.focus : null;
  const focus = focusRaw && /^(home|header|footer|product|catalogue|page:\d+)$/.test(focusRaw) ? (focusRaw as AgentTargetKey) : null;
  const result = await runStoreAgent({
    userId: req.user!.id,
    instruction,
    provider: req.body?.provider === 'openai' ? 'openai' : 'claude',
    focus,
    publish: Boolean(req.body?.publish),
  });
  res.json({ status: 'success', data: result });
}));

router.get('/store/agent/runs', authenticate, authorize(...STORE_ROLES), asyncHandler(async (req: Request, res: Response) => {
  const store = await getOrCreateVendorStore(req.user!.id);
  res.json({ status: 'success', data: { runs: await listAgentRuns(store.id, 30) } });
}));

/** A generated (or hand-edited) design, compiled for the panel's iframe. */
router.post('/store/themes/preview', authenticate, authorize(...STORE_ROLES), asyncHandler(async (req: Request, res: Response) => {
  const pages = req.body?.pages;
  if (!pages || typeof pages !== 'object' || !pages.home) throw new AppException(400, 'pages.home est requis');
  for (const key of ['home', 'header', 'footer', 'product', 'catalogue'] as const) {
    if (pages[key]) {
      const problems = validateDocument(pages[key] as PageDocument);
      if (problems.length) throw new AppException(400, `Page « ${key} » invalide : ${problems[0]}`);
    }
  }
  await renderPreview(req, res, pages, req.body?.palette, typeof req.body?.fontFamily === 'string' ? req.body.fontFamily : null, previewPage(req.body?.page), Boolean(req.body?.inspect), Boolean(req.body?.reveal));
}));

/** A shipped theme, compiled for the gallery's preview. */
router.get('/store/themes/:id/preview', authenticate, authorize(...STORE_ROLES), asyncHandler(async (req: Request, res: Response) => {
  const theme = getTheme(String(req.params.id));
  if (!theme) throw new AppException(404, 'Modèle introuvable');
  await renderPreview(req, res, theme.pages, theme.palette, theme.fontFamily, previewPage(req.query.page));
}));

/**
 * Install a theme: the brand values, then the five surfaces, each written
 * live after its previous document is recorded as a version. Drafts on those
 * surfaces are dropped — a draft of the old look over the new one would be
 * confusing to publish.
 */
/**
 * Install a custom OpenDesign-generated theme directly into the vendor's store.
 */
router.post('/store/themes/custom/install', authenticate, authorize(...STORE_ROLES), asyncHandler(async (req: Request, res: Response) => {
  const { palette, fontFamily, label, pages } = req.body;
  if (!palette || !pages?.home) throw new AppException(400, 'Palette et page d\'accueil requises');
  for (const key of ['home', 'header', 'footer', 'product', 'catalogue'] as const) {
    if (pages[key]) {
      const problems = validateDocument(pages[key] as PageDocument);
      if (problems.length) throw new AppException(400, `Page « ${key} » invalide : ${problems[0]}`);
    }
  }
  const userId = req.user!.id;
  const store = await getOrCreateVendorStore(userId);

  await (prisma as any).store.update({
    where: { id: store.id },
    data: {
      primaryColor: palette.primary || '#2563eb',
      secondaryColor: palette.secondary || '#0f172a',
      fontFamily: fontFamily || 'Manrope',
      themeName: 'CUSTOM_OPENDESIGN',
    },
  });

  const stamped = branded(pages as ThemePages, store.name) as any;
  const versionLabel = `Avant création OpenDesign : ${label || 'Modèle Personnalisé'}`;
  const replaced: string[] = [];

  const homeBefore = ensureDocument(store.homeStructure, 'home');
  if (flatBlocks(homeBefore).length) await recordVersion('store-home', `store:${store.id}`, homeBefore, { label: versionLabel, source: 'theme-install', userId });
  await (prisma as any).store.update({ where: { id: store.id }, data: { homeStructure: pages.home } });
  await deleteDraft('store-home', `store:${store.id}`);
  replaced.push('home');

  for (const key of ['header', 'footer', 'product', 'catalogue'] as const) {
    if (pages[key]) {
      const page = await getOrCreateGlobalSection(store.id, key);
      const before = ensureDocument(page.customStructure, SECTION_KIND[key]);
      if (flatBlocks(before).length) await recordVersion(`store-${key}`, `store:${store.id}`, before, { label: versionLabel, source: 'theme-install', userId });
      await (prisma as any).storePage.update({ where: { id: page.id }, data: { customStructure: stamped[key] } });
      await deleteDraft(`store-${key}`, `store:${store.id}`);
      replaced.push(key);
    }
  }

  invalidateStore(store.id);
  res.json({ status: 'success', data: { installed: 'custom', replaced, palette } });
}));

router.post('/store/themes/:id/install', authenticate, authorize(...STORE_ROLES), asyncHandler(async (req: Request, res: Response) => {
  const theme = getTheme(String(req.params.id));
  if (!theme) throw new AppException(404, 'Modèle introuvable');
  const userId = req.user!.id;
  const store = await getOrCreateVendorStore(userId);

  await (prisma as any).store.update({
    where: { id: store.id },
    data: { primaryColor: theme.palette.primary, secondaryColor: theme.palette.secondary, fontFamily: theme.fontFamily, themeName: theme.id.toUpperCase() },
  });

  const label = `Avant le modèle ${theme.label.fr}`;
  const replaced: string[] = [];
  const pages = branded(theme.pages, store.name);

  // Home lives on the store row.
  const homeBefore = ensureDocument(store.homeStructure, 'home');
  if (flatBlocks(homeBefore).length) await recordVersion('store-home', `store:${store.id}`, homeBefore, { label, source: 'theme-install', userId });
  await (prisma as any).store.update({ where: { id: store.id }, data: { homeStructure: theme.pages.home } });
  await deleteDraft('store-home', `store:${store.id}`);
  replaced.push('home');

  for (const key of ['header', 'footer', 'product', 'catalogue'] as const) {
    const page = await getOrCreateGlobalSection(store.id, key);
    const before = ensureDocument(page.customStructure, SECTION_KIND[key]);
    if (flatBlocks(before).length) await recordVersion(`store-${key}`, `store:${store.id}`, before, { label, source: 'theme-install', userId });
    await (prisma as any).storePage.update({ where: { id: page.id }, data: { customStructure: pages[key] } });
    await deleteDraft(`store-${key}`, `store:${store.id}`);
    replaced.push(key);
  }

  invalidateStore(store.id);
  res.json({ status: 'success', data: { installed: theme.id, replaced, palette: theme.palette } });
}));

// ───────────────────────────────────────────────── the targets

mount('/landing/:id', EDIT_ROLES, (req) => landingTarget(req, parseInt(String(req.params.id), 10)));
mount('/store/home', STORE_ROLES, (req) => storeHomeTarget(req));
for (const key of ['header', 'footer', 'product', 'catalogue'] as const) {
  mount(`/store/${key}`, STORE_ROLES, (req) => globalSectionTarget(req, key));
}
mount('/store/pages/:id', STORE_ROLES, (req) => storePageTarget(req, parseInt(String(req.params.id), 10)));

export default router;

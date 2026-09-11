import { brotliCompressSync, constants as zlib } from 'zlib';
import { prisma } from '../../lib/prisma.js';
import { renderDocument } from '../landingCompiler/document.js';
import { COMPILER_VERSION, unsupportedBlocks } from '../landingCompiler/index.js';
import { resolveStoreByHost, GLOBAL_SECTION_SLUGS, DEFAULT_TEMPLATES, getStoreProducts, getStoreProductBySlug } from '../store.service.js';
import { resolveBindings, type BindingContext } from './bindings.js';
import {
  ensureDocument,
  flatBlocks,
  resolveDocument,
  themeFromStore,
  type PageDocument,
  type AnyNode,
  type SectionNode,
} from '../../shared/document/index.js';

/**
 * The store compiler: a storefront page as static HTML.
 *
 * Same engine as the landing pages — the same block renderers, the same CSS
 * assembly, the same per-page content policy, the same brotli — pointed at a
 * store's documents instead of a link's. What is new is composition: the
 * store's global header and footer are spliced around the page, theme tokens
 * are resolved against the store, and the head carries the store's own title
 * and canonical URL rather than a product's.
 *
 * Cached in memory, keyed on everything the output depends on: the compiler
 * version, the store row's updatedAt, and the updatedAt of the page and of
 * both global sections. A save in Studio also drops the entry outright. A
 * process restart loses the cache and the next visitor pays one compile —
 * milliseconds — which is the trade for not pushing a table onto a live
 * database yet.
 *
 * Served for the store home and custom pages. Product, collection and cart
 * pages still need data bindings and a cart runtime; they stay with the SPA
 * until those exist.
 */

export const STORE_CODE = '__store__';

export type StorePageKind = 'home' | 'page' | 'product' | 'catalogue' | 'collection';

export interface CompiledStorePage {
  html: Buffer;
  brotli: Buffer;
  csp: string;
  version: string;
}

const cache = new Map<string, CompiledStorePage>();
const inFlight = new Map<string, Promise<CompiledStorePage | null>>();

/** Drops every compiled page of a store. Called on any Studio save for it. */
export function invalidateStore(storeId: number): void {
  const prefix = `${storeId}:`;
  for (const key of [...cache.keys()]) if (key.startsWith(prefix)) cache.delete(key);
}

export function storeCacheStats(): { entries: number } {
  return { entries: cache.size };
}

// ─────────────────────────────────────────────── composition (pure)

/**
 * Prefix every id in a document so two documents can share a page.
 *
 * Each of the three documents was migrated on its own and every one of them
 * calls its implicit section `page`; without this the header's and the
 * footer's root sections would carry the same id as the body's, and the
 * responsive rules keyed on `.n-<id>` would land on all three.
 */
function prefixIds(doc: PageDocument, prefix: string): SectionNode[] {
  const visit = (node: AnyNode): AnyNode => {
    const id = `${prefix}${node.id}`;
    if (node.type === 'block') return { ...node, id };
    return { ...node, id, children: node.children.map(visit) } as AnyNode;
  };
  return doc.root.map((s) => visit(s) as SectionNode);
}

export interface StoreCompileInput {
  store: any;
  /** The store's owner, for the host and the pixels. */
  user: { subdomain?: string | null; customDomain?: string | null; customDomainStatus?: string | null; pixels?: any[] } | null;
  kind: StorePageKind;
  /** The page document. Null means the store has not built this page in Studio. */
  page: unknown;
  header: unknown;
  footer: unknown;
  /** Path on the store's host, for the canonical URL. */
  path: string;
  /** Custom page title, when the page is one. */
  title?: string | null;
  /** What the bindings resolve against. Absent means nothing is bound. */
  bindings?: BindingContext;
  /** Tag each block with its node id, for the dashboard's click-to-edit preview. */
  inspect?: boolean;
}

/** The page with its chrome around it, tokens resolved. Null when there is no page to compile. */
export function composeStorePage(input: StoreCompileInput): PageDocument | null {
  const body = ensureDocument(input.page, input.kind === 'catalogue' ? 'collection' : input.kind);
  if (!flatBlocks(body).length) return null;

  const theme = themeFromStore(input.store);
  const header = ensureDocument(input.header, 'page');
  const footer = ensureDocument(input.footer, 'page');

  const composed: PageDocument = {
    ...body,
    // A landing page is a 640px column by default; a store page is a site.
    // Only the default moves — a width set in Studio stands.
    settings: { maxWidth: 1600, ...(body.settings || {}) },
    root: [
      ...(flatBlocks(header).length ? prefixIds(header, 'h_') : []),
      ...body.root,
      ...(flatBlocks(footer).length ? prefixIds(footer, 'f_') : []),
    ],
  };
  return resolveDocument(composed, theme);
}

function originFor(user: StoreCompileInput['user']): string | null {
  if (user?.customDomain && user.customDomainStatus === 'ACTIVE') return `https://${user.customDomain}`;
  if (!user?.subdomain) return null;
  try {
    const base = new URL(process.env.FRONTEND_URL || 'https://silacod.com');
    return `${base.protocol}//${user.subdomain}.${base.host.replace(/^www\./i, '')}`;
  } catch {
    return null;
  }
}

/** Compile one store page from data already in hand. Pure apart from image probing. */
export async function compileStoreDocument(input: StoreCompileInput): Promise<{ html: string; csp: string } | null> {
  const composed = composeStorePage(input);
  if (!composed) return null;
  const doc = input.bindings ? await resolveBindings(composed, input.bindings) : composed;
  const blocks = flatBlocks(doc);
  if (unsupportedBlocks(doc).length) return null;

  const store = input.store || {};
  const title = input.title ? `${input.title} — ${store.name || ''}`.trim() : store.metaTitle || store.name || 'Boutique';

  const rendered = await renderDocument({
    code: STORE_CODE,
    blocks,
    document: doc,
    // The brand font rides in settings so the head loads it and the sheet
    // uses it; a page whose settings already name a font keeps its own.
    settings: { fontFamily: store.fontFamily || undefined, ...(doc.settings || {}) },
    landingPage: { themeColor: store.primaryColor || '#f97316', title, description: store.metaDescription || store.tagline || store.description || '' },
    product: null,
    influencerPixels: input.user?.pixels || [],
    influencerName: store.name || null,
    influencerAvatar: store.logoUrl || null,
    origin: originFor(input.user),
    canonicalPath: input.path,
    ogImage: store.ogImageUrl || store.logoUrl || null,
    inspect: Boolean(input.inspect),
  });
  return rendered;
}

// ─────────────────────────────────────────────── lookup + cache

async function loadStoreForHost(host: string, devSlug?: string) {
  const resolved = await resolveStoreByHost(host, devSlug);
  if (!resolved) return null;
  const store = await (prisma as any).store.findUnique({
    where: { id: resolved.store.id },
    include: {
      user: { select: { subdomain: true, customDomain: true, customDomainStatus: true, pixels: true } },
      customPages: {
        where: { slug: { in: Object.values(GLOBAL_SECTION_SLUGS) } },
        select: { slug: true, customStructure: true, updatedAt: true },
      },
    },
  });
  if (!store || !store.isPublished || store.status !== 'ACTIVE') return null;
  return store;
}

/**
 * The compiled page for a host and path, or null when the store has not built
 * that page in Studio (the SPA then serves its stock layout) or the compiler
 * declines it.
 */
export async function getCompiledStorePage(
  host: string,
  kind: StorePageKind,
  slug: string | null,
  devSlug?: string
): Promise<CompiledStorePage | null> {
  const store = await loadStoreForHost(host, devSlug);
  if (!store) return null;

  const reserved = (key: keyof typeof GLOBAL_SECTION_SLUGS) => store.customPages.find((p: any) => p.slug === GLOBAL_SECTION_SLUGS[key]);
  const header = reserved('header');
  const footer = reserved('footer');

  // What this URL's body is, and what it binds against.
  let body: unknown = null;
  let title: string | null = null;
  let path = '/';
  let entityVersion = '0';
  let bindings: BindingContext | undefined;
  const catalogue: BindingContext['catalogue'] = async (opts) => {
    const r = await getStoreProducts(store.id, { page: 1, limit: opts.limit ?? 24, collectionSlug: opts.collectionSlug });
    return r.products;
  };

  if (kind === 'home') {
    body = store.homeStructure;
  } else if (kind === 'page') {
    if (!slug || slug.startsWith('__')) return null;
    const page = await (prisma as any).storePage.findFirst({
      where: { storeId: store.id, slug: slug.toLowerCase(), isPublished: true },
      select: { title: true, slug: true, customStructure: true, updatedAt: true },
    });
    if (!page) return null;
    body = page.customStructure;
    title = page.title;
    path = `/pages/${page.slug}`;
    entityVersion = String(new Date(page.updatedAt).getTime());
  } else if (kind === 'product') {
    if (!slug) return null;
    let product: any;
    try {
      // The lookup answers { product, related }; the binding wants the product.
      product = (await getStoreProductBySlug(store.id, slug)).product;
    } catch {
      return null;
    }
    const template = reserved('product');
    body = template?.customStructure ?? DEFAULT_TEMPLATES.product;
    title = product.nameFr || product.nameAr || null;
    path = `/p/${encodeURIComponent(slug)}`;
    entityVersion = `${product.id}:${new Date(product.updatedAt ?? 0).getTime()}:${template ? new Date(template.updatedAt).getTime() : 0}`;
    bindings = { product, collection: null, catalogue, storeId: store.id };
  } else {
    // catalogue and collection share the catalogue template
    const template = reserved('catalogue');
    body = template?.customStructure ?? DEFAULT_TEMPLATES.catalogue;
    const collectionSlug = kind === 'collection' ? slug : null;
    if (kind === 'collection' && !collectionSlug) return null;
    title = kind === 'collection' ? collectionSlug : 'Tous les produits';
    path = kind === 'collection' ? `/collections/${encodeURIComponent(collectionSlug!)}` : '/products';
    // Catalogue pages change whenever any product does; the store's own
    // updatedAt does not move for that, so they take a short time bucket.
    entityVersion = `${collectionSlug ?? 'all'}:${template ? new Date(template.updatedAt).getTime() : 0}:${Math.floor(Date.now() / 60000)}`;
    bindings = { product: null, collection: collectionSlug ? { slug: collectionSlug } : null, catalogue, storeId: store.id };
  }

  const version = [
    COMPILER_VERSION,
    new Date(store.updatedAt).getTime(),
    entityVersion,
    header ? new Date(header.updatedAt).getTime() : 0,
    footer ? new Date(footer.updatedAt).getTime() : 0,
  ].join(':');

  const key = `${store.id}:${kind}:${slug ?? ''}`;
  const hit = cache.get(key);
  if (hit && hit.version === version) return hit;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const work = (async () => {
    try {
      const rendered = await compileStoreDocument({
        store,
        user: store.user,
        kind: kind === 'collection' ? 'catalogue' : kind,
        page: body,
        header: header?.customStructure ?? null,
        footer: footer?.customStructure ?? null,
        path,
        title,
        bindings,
      });
      if (!rendered) {
        cache.delete(key);
        return null;
      }
      const html = Buffer.from(rendered.html, 'utf8');
      const brotli = brotliCompressSync(html, {
        params: { [zlib.BROTLI_PARAM_QUALITY]: 11, [zlib.BROTLI_PARAM_SIZE_HINT]: html.length },
      });
      const entry: CompiledStorePage = { html, brotli, csp: rendered.csp, version };
      cache.set(key, entry);
      return entry;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, work);
  return work;
}

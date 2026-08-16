import zlib from 'zlib';
import { PrismaClient } from '@prisma/client';
import { renderDocument } from './document.js';
import { supportedTypes } from './blocks/index.js';

const prisma = new PrismaClient();

/**
 * Compiles a saved landing page into a self-contained HTML document.
 *
 * Bump this on ANY change to compiler output. Stored rows carry the version
 * they were built with, so a mismatch makes every page recompile on its next
 * visit — the fix propagates itself, busiest pages first, with no backfill and
 * no migration.
 */
// 2: checkout redirects to /thank-you instead of revealing an inline panel.
// 3: whatsapp widget renderer added.
export const COMPILER_VERSION = 3;

/**
 * Block types the compiler can render, derived from the renderer registry.
 *
 * Registering a renderer widens coverage on its own: a page becomes eligible the
 * moment every block on it is supported, with no flag and no data migration. A
 * page containing anything unregistered declines and is served the React app.
 *
 * Scope must follow what live pages actually contain — run
 * `scripts/landing-block-usage.ts` against production, not a dev database,
 * before adding a renderer. The first version of this plan picked seven types
 * from the builder's palette, four of which no page had ever used.
 */
export const SUPPORTED_BLOCKS = supportedTypes();

const FRESH_MS = Number(process.env.SSG_FRESH_MS || 10 * 60 * 1000);
const MAX_ENTRIES = Number(process.env.SSG_CACHE_ENTRIES || 200);
const MAX_BYTES = Number(process.env.SSG_CACHE_BYTES || 32 * 1024 * 1024);
const MISS_TTL_MS = 30_000;

export interface CompiledPage {
  code: string;
  linkId: number;
  influencerId: number;
  subdomain: string | null;
  customDomain: string | null;
  ssgEnabled: boolean;
  cloaking: any | null;
  /** null when the page declined to compile — the caller serves the SPA. */
  html: Buffer | null;
  brotli: Buffer | null;
  csp: string;
  compiledAt: number;
}

/** Insertion order gives LRU for free: delete + set moves an entry to the newest end. */
const cache = new Map<string, CompiledPage>();
/** Collapses a stampede — 500 concurrent ad clicks on a cold page compile once. */
const inFlight = new Map<string, Promise<CompiledPage | null>>();
/** Scanners hammer /r/*; remembering a miss keeps them off the database. */
const missUntil = new Map<string, number>();

function cacheBytes(): number {
  let total = 0;
  for (const page of cache.values()) {
    total += (page.brotli?.length ?? 0) + (page.html?.length ?? 0);
  }
  return total;
}

function remember(page: CompiledPage): void {
  cache.delete(page.code);
  cache.set(page.code, page);
  while (cache.size > MAX_ENTRIES || cacheBytes() > MAX_BYTES) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
}

/** Drop a page from the memory cache. Called from the save route, after the upsert. */
export function invalidate(code: string): void {
  cache.delete(code);
  missUntil.delete(code);
}

/**
 * Drop every cached page belonging to an influencer.
 *
 * Pixels, subdomain and custom domain live on `User`, not on the landing page,
 * so editing them leaves `updatedAt` untouched and the row looks fresh.
 */
export function invalidateByInfluencer(influencerId: number): void {
  for (const [code, page] of cache) {
    if (page.influencerId === influencerId) cache.delete(code);
  }
}

export function cacheStats(): { entries: number; bytes: number } {
  return { entries: cache.size, bytes: cacheBytes() };
}

function blocksOf(customStructure: any): any[] {
  // Two shapes exist in the wild: a bare array (legacy) and { blocks, settings }.
  if (Array.isArray(customStructure)) return customStructure;
  return customStructure?.blocks || [];
}

function cloakingOf(customStructure: any): any | null {
  if (Array.isArray(customStructure)) return null;
  const cloaking = customStructure?.settings?.cloaking;
  return cloaking?.enabled ? cloaking : null;
}

/** Block types on this page that no renderer handles yet. */
export function unsupportedBlocks(customStructure: any): string[] {
  const types = blocksOf(customStructure)
    .map((b: any) => b?.type)
    .filter(Boolean) as string[];
  return [...new Set(types.filter((t) => !SUPPORTED_BLOCKS.has(t)))];
}

async function loadLink(code: string): Promise<any | null> {
  return (prisma as any).referralLink.findUnique({
    where: { code },
    include: {
      // The only query in the codebase that pulls the compiled bytes. Every
      // other landingPage read is unaffected by their existence.
      landingPage: { include: { compiledPage: true } },
      product: { include: { images: true } },
      influencer: {
        select: {
          id: true,
          subdomain: true,
          customDomain: true,
          pixels: true,
          profile: { select: { fullName: true, avatarUrl: true } },
        },
      },
    },
  });
}

/**
 * Builds the HTML for one landing page, or returns null to decline.
 *
 * Declining is a normal outcome, not a failure: an unsupported block means the
 * SPA renders the page instead. Only a thrown error is a bug, and it is what
 * lands in `compileError`.
 */
export async function compileLanding(link: any): Promise<{ html: Buffer; csp: string } | null> {
  const structure = link?.landingPage?.customStructure;
  const blocks = blocksOf(structure);

  if (!blocks.length) return null;
  if (unsupportedBlocks(structure).length) return null;

  const rendered = await renderDocument({
    code: link.code,
    blocks,
    settings: Array.isArray(structure) ? {} : structure?.settings || {},
    landingPage: link.landingPage,
    product: link.product,
    influencerPixels: link.influencer?.pixels || [],
    influencerName: link.influencer?.profile?.fullName || null,
    influencerAvatar: link.influencer?.profile?.avatarUrl || null,
    origin: originFor(link),
  });

  return rendered ? { html: Buffer.from(rendered.html, 'utf8'), csp: rendered.csp } : null;
}

/**
 * The host this link is served from, for canonical and Open Graph URLs.
 *
 * Derived from stored configuration rather than the request, because a page is
 * compiled once and served to everyone — a per-request host would bake one
 * visitor's Host header into every future response.
 */
function originFor(link: any): string | null {
  const custom = link?.influencer?.customDomain;
  if (custom) return `https://${custom}`;

  const subdomain = link?.influencer?.subdomain;
  if (!subdomain) return null;

  try {
    const base = new URL(process.env.FRONTEND_URL || 'https://silacod.com');
    return `${base.protocol}//${subdomain}.${base.host.replace(/^www\./i, '')}`;
  } catch {
    return null;
  }
}

async function build(code: string): Promise<CompiledPage | null> {
  const link = await loadLink(code);

  if (!link || !link.isActive || !link.product?.isActive) {
    missUntil.set(code, Date.now() + MISS_TTL_MS);
    return null;
  }

  const page: CompiledPage = {
    code,
    linkId: link.id,
    influencerId: link.influencerId,
    subdomain: link.influencer?.subdomain ?? null,
    customDomain: link.influencer?.customDomain ?? null,
    ssgEnabled: link.landingPage?.ssgEnabled ?? true,
    cloaking: cloakingOf(link.landingPage?.customStructure),
    html: null,
    brotli: null,
    csp: '',
    compiledAt: Date.now(),
  };

  const landingPage = link.landingPage;
  const stored = landingPage?.compiledPage;
  const storedIsFresh =
    stored?.html &&
    stored.compilerVersion === COMPILER_VERSION &&
    stored.compiledAt &&
    Date.now() - new Date(stored.compiledAt).getTime() < FRESH_MS;

  if (storedIsFresh) {
    // The database is the warm cache across processes, so a pm2 restart costs
    // one query per page rather than a recompile.
    page.html = Buffer.from(stored.html, 'utf8');
    page.brotli = stored.brotli ? Buffer.from(stored.brotli) : null;
    page.csp = stored.csp || '';
    remember(page);
    return page;
  }

  let compiled: { html: Buffer; csp: string } | null = null;
  let compileError: string | null = null;
  try {
    compiled = await compileLanding(link);
  } catch (err: any) {
    compileError = String(err?.stack || err?.message || err).slice(0, 4000);
    console.error('[SSG] compile threw for', code, err);
  }

  if (compiled) {
    page.html = compiled.html;
    page.csp = compiled.csp;
    // Quality 11 once at compile time. The `compression` package has no brotli —
    // it gzips level 6 per request on the main thread — so this is both smaller
    // and free at serve time.
    page.brotli = zlib.brotliCompressSync(compiled.html, {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
    });
  }

  if (landingPage) {
    // A storage failure must not stop us serving the page we just built, so this
    // is best-effort. A page that fails to persist simply recompiles next time.
    const record = {
      html: compiled ? compiled.html.toString('utf8') : null,
      csp: compiled ? compiled.csp : null,
      brotli: page.brotli,
      compiledAt: compiled ? new Date() : null,
      compilerVersion: compiled ? COMPILER_VERSION : null,
      compileError,
    };
    try {
      await (prisma as any).referralLinkCompiledPage.upsert({
        where: { landingPageId: landingPage.id },
        update: record,
        create: { landingPageId: landingPage.id, ...record },
      });
    } catch (err) {
      console.error('[SSG] failed to persist compiled page for', code, err);
    }
  }

  remember(page);
  return page;
}

/** Cached lookup. Returns null when there is no servable link for this code. */
export async function getCompiledLanding(code: string): Promise<CompiledPage | null> {
  const now = Date.now();

  const missedUntil = missUntil.get(code);
  if (missedUntil !== undefined) {
    if (now < missedUntil) return null;
    missUntil.delete(code);
  }

  const hit = cache.get(code);
  if (hit && now - hit.compiledAt < FRESH_MS) {
    cache.delete(code);
    cache.set(code, hit);
    return hit;
  }

  const pending = inFlight.get(code);
  if (pending) return pending;

  const task = build(code).finally(() => inFlight.delete(code));
  inFlight.set(code, task);
  return task;
}

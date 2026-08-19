import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import type { ImageDimensions, ImageVariant } from './blocks/types.js';

/**
 * Intrinsic dimensions for locally-uploaded images, so compiled pages can carry
 * real width/height attributes and reserve the right space before the bytes
 * arrive. This is what removes layout shift.
 *
 * `sharp().metadata()` reads the header only — no decode, around a millisecond
 * for a webp — and results are memoised, so a page with the same image in
 * several blocks probes once.
 */

const cache = new Map<string, ImageDimensions | null>();
const MAX_CACHE = 2000;
/** Variant files sharp is currently writing, so two compiles never race on one. */
const building = new Set<string>();

/**
 * Remote images are deliberately not fetched.
 *
 * Probing an arbitrary https URL would put a third-party host on the critical
 * path of an influencer clicking Save — a slow or hanging server would stall the
 * request. Those images simply render without dimensions, exactly as they do in
 * the React version today.
 */
/**
 * Cache-only lookup, safe to call from a synchronous renderer.
 *
 * `sharp().metadata()` is asynchronous, so dimensions cannot be read on demand
 * from inside `render()`. `warmImageCache` runs first and fills this in; a miss
 * here simply means the image renders without dimensions, which is what the
 * React version does for every image today.
 */
export function probeImage(url: string): ImageDimensions | null {
  return cache.get(url) ?? null;
}

/**
 * Resolves an upload URL to a path inside the uploads root, or null.
 *
 * The containment check matters: `url` comes from saved JSON, so a crafted
 * `../../` would otherwise let a compile read arbitrary files off disk.
 */
function resolveUpload(url: string): string | null {
  if (!url.startsWith('/uploads/')) return null;
  try {
    const root = path.resolve(process.cwd(), 'uploads');
    const relative = decodeURIComponent(url.slice('/uploads/'.length));
    const file = path.resolve(root, relative);
    if (file === root || !file.startsWith(root + path.sep)) return null;
    return file;
  } catch {
    return null;
  }
}

/**
 * Widths generated for `srcset`.
 *
 * Bounded by what the page can actually display: `.pg` is a max-width column
 * that defaults to 640 CSS px, so 960 already covers a 640 px column on a
 * 1.5x screen and anything wider is served by the original file.
 *
 * The upload pipeline caps at 1200 px wide (upload.routes.ts), which is why
 * oversized images were never caught there: a 1000x5662 sales image is already
 * under the cap and passes through untouched, then gets sent in full to a 412 px
 * phone. These variants are what actually fixes that.
 */
const VARIANT_WIDTHS = [400, 640, 960];

/** `foo-optimized.webp` + 640 -> `foo-optimized-w640.webp`. */
function variantName(name: string, width: number): string {
  const ext = path.extname(name);
  return `${name.slice(0, name.length - ext.length)}-w${width}${ext}`;
}

/**
 * Which variants of an image already exist, and which still need building.
 *
 * Existence is checked rather than assumed because generation is fire-and-forget:
 * a compile emits `srcset` only for files it has confirmed on disk, so a half
 * finished batch can never produce a 404 in a srcset candidate.
 */
function planVariants(file: string, url: string, width: number) {
  const ready: ImageVariant[] = [];
  const missing: Array<{ width: number; out: string }> = [];

  for (const w of VARIANT_WIDTHS) {
    // Never upscale: a wider "variant" is a bigger file for no visual gain.
    if (w >= width) continue;

    const out = variantName(file, w);
    if (fs.existsSync(out)) ready.push({ width: w, url: variantName(url, w) });
    else missing.push({ width: w, out });
  }

  return { ready, missing };
}

/**
 * Builds missing variants in the background.
 *
 * Deliberately not awaited. Re-encoding an 8000 px tall webp three times costs
 * seconds, and an influencer pressing Save must not wait for it — the compile
 * that triggered generation ships without `srcset` and the next one, minutes
 * later at most, picks the files up via refreshVariants. Errors are swallowed
 * for the same reason: a page that cannot be made smaller must still be servable.
 */
function generateVariants(file: string, missing: Array<{ width: number; out: string }>): void {
  for (const { width, out } of missing) {
    // Two concurrent compiles of pages sharing an image would otherwise have
    // sharp writing the same path twice at once, and the loser of that race
    // leaves a truncated file that IS then found by existsSync.
    if (building.has(out)) continue;
    building.add(out);

    sharp(file)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(out)
      .catch(() => {
        // Remove the partial file, or existsSync would advertise it forever.
        try {
          fs.unlinkSync(out);
        } catch {
          /* nothing written, or already gone */
        }
      })
      .finally(() => building.delete(out));
  }
}

/** How many variants this image is eligible for, given its intrinsic width. */
function expectedVariants(width: number): number {
  return VARIANT_WIDTHS.filter((w) => w < width).length;
}

/**
 * Re-checks the disk for variants a previous warm did not find.
 *
 * Load-bearing, and the reason is easy to miss: the FIRST warm of an image
 * always finds no variants, because that warm is what starts sharp. Memoising
 * that empty list — dimensions and variants share one cache entry — would pin
 * `srcset` off for the life of the process, and since nothing evicts the entry
 * (clearImageCache has no callers, and invalidate() only drops compiled HTML)
 * responsive images would first appear only after the next restart.
 *
 * Cheap enough to run on every cache hit: at most three existsSync calls, and
 * none once the set is complete.
 */
function refreshVariants(url: string, dims: ImageDimensions): void {
  if ((dims.variants?.length ?? 0) >= expectedVariants(dims.width)) return;

  const file = resolveUpload(url);
  if (!file) return;

  const { ready } = planVariants(file, url, dims.width);
  // Mutated in place: renderers hold this object via probeImage, and
  // renderDocument awaits this function before any of them run.
  dims.variants = ready.sort((a, b) => a.width - b.width);
}

/** Pre-reads every local image on a page so renderers can stay synchronous. */
export async function warmImageCache(urls: string[]): Promise<void> {
  if (cache.size > MAX_CACHE) cache.clear();

  await Promise.all(
    urls.map(async (url) => {
      const cached = cache.get(url);
      if (cached !== undefined) {
        if (cached) refreshVariants(url, cached);
        return;
      }

      const file = resolveUpload(url);
      if (!file) {
        cache.set(url, null);
        return;
      }

      try {
        const meta = await sharp(file).metadata();
        if (!meta.width || !meta.height) {
          cache.set(url, null);
          return;
        }

        const { ready, missing } = planVariants(file, url, meta.width);
        if (missing.length) generateVariants(file, missing);

        cache.set(url, {
          width: meta.width,
          height: meta.height,
          variants: ready.sort((a, b) => a.width - b.width),
        });
      } catch {
        cache.set(url, null);
      }
    })
  );
}

export function clearImageCache(): void {
  cache.clear();
}

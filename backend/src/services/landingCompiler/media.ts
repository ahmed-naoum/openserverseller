import path from 'path';
import sharp from 'sharp';
import type { ImageDimensions } from './blocks/types.js';

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

/** Pre-reads every local image on a page so renderers can stay synchronous. */
export async function warmImageCache(urls: string[]): Promise<void> {
  if (cache.size > MAX_CACHE) cache.clear();

  await Promise.all(
    urls.map(async (url) => {
      if (cache.has(url)) return;

      const file = resolveUpload(url);
      if (!file) {
        cache.set(url, null);
        return;
      }

      try {
        const meta = await sharp(file).metadata();
        cache.set(
          url,
          meta.width && meta.height ? { width: meta.width, height: meta.height } : null
        );
      } catch {
        cache.set(url, null);
      }
    })
  );
}

export function clearImageCache(): void {
  cache.clear();
}

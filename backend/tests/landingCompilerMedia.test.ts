import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import {
  warmImageCache,
  probeImage,
  clearImageCache,
} from '../src/services/landingCompiler/media.js';

/**
 * The variant pipeline has one non-obvious ordering property, and getting it
 * wrong is silent: dimensions and variants share a cache entry, and the FIRST
 * warm of an image always finds no variants on disk because that warm is what
 * starts sharp. Memoising that empty list would pin `srcset` off for the whole
 * process — the feature would look implemented, ship nothing, and only begin
 * working after an unrelated restart.
 */

const ROOT = path.resolve(process.cwd(), 'uploads');
const NAME = 'vitest-media-probe-optimized.webp';
const URL = `/uploads/${NAME}`;
const FILE = path.join(ROOT, NAME);
const WIDTHS = [400, 640, 960];

/** sharp writes in the background; existsSync is the only signal it finished. */
async function waitForVariants(timeoutMs = 8_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (WIDTHS.every((w) => fs.existsSync(variantPath(w)))) return;
    await new Promise((r) => setTimeout(r, 50));
  }
}

function variantPath(width: number): string {
  return FILE.replace(/\.webp$/, `-w${width}.webp`);
}

function cleanup(): void {
  for (const f of [FILE, ...WIDTHS.map(variantPath)]) {
    try {
      fs.unlinkSync(f);
    } catch {
      /* never created */
    }
  }
}

describe('image variants', () => {
  beforeAll(async () => {
    fs.mkdirSync(ROOT, { recursive: true });
    cleanup();
    clearImageCache();
    // The shape that caused the problem: a long-form sales image, wide enough
    // that every variant width applies.
    await sharp({
      create: { width: 1000, height: 5662, channels: 3, background: { r: 200, g: 120, b: 40 } },
    })
      .webp({ quality: 80 })
      .toFile(FILE);
  }, 30_000);

  afterAll(() => {
    cleanup();
    clearImageCache();
  });

  it('picks up variants on a later compile without needing a restart', async () => {
    await warmImageCache([URL]);

    // First warm: real dimensions, no variants yet — generation has only just
    // been scheduled, and nothing awaited it.
    const first = probeImage(URL);
    expect(first).not.toBeNull();
    expect(first!.width).toBe(1000);
    expect(first!.height).toBe(5662);
    expect(first!.variants ?? []).toHaveLength(0);

    await waitForVariants();

    // Second warm, same process, same cache entry. This is the assertion that
    // fails if the entry is treated as immutable.
    await warmImageCache([URL]);
    const second = probeImage(URL);
    expect(second!.variants?.map((v) => v.width)).toEqual(WIDTHS);
    expect(second!.variants?.map((v) => v.url)).toEqual(
      WIDTHS.map((w) => `/uploads/${NAME.replace(/\.webp$/, `-w${w}.webp`)}`)
    );
  }, 30_000);

  it('never advertises a variant wider than the source', async () => {
    // Upscaling produces a larger file for no visual gain, so a narrow image
    // must simply carry fewer candidates rather than fabricated ones.
    const narrow = 'vitest-media-narrow-optimized.webp';
    const narrowFile = path.join(ROOT, narrow);
    await sharp({ create: { width: 500, height: 500, channels: 3, background: { r: 1, g: 2, b: 3 } } })
      .webp()
      .toFile(narrowFile);

    try {
      await warmImageCache([`/uploads/${narrow}`]);
      await new Promise((r) => setTimeout(r, 1_000));
      await warmImageCache([`/uploads/${narrow}`]);

      const dims = probeImage(`/uploads/${narrow}`);
      for (const v of dims!.variants ?? []) expect(v.width).toBeLessThan(500);
      expect(fs.existsSync(narrowFile.replace(/\.webp$/, '-w640.webp'))).toBe(false);
      expect(fs.existsSync(narrowFile.replace(/\.webp$/, '-w960.webp'))).toBe(false);
    } finally {
      for (const f of [narrowFile, ...WIDTHS.map((w) => narrowFile.replace(/\.webp$/, `-w${w}.webp`))]) {
        try {
          fs.unlinkSync(f);
        } catch {
          /* never created */
        }
      }
    }
  }, 30_000);

  it('refuses to probe outside the uploads root', async () => {
    await warmImageCache(['/uploads/../../etc/passwd', '/uploads/%2e%2e/secret.webp']);
    expect(probeImage('/uploads/../../etc/passwd')).toBeNull();
    expect(probeImage('/uploads/%2e%2e/secret.webp')).toBeNull();
  });
});

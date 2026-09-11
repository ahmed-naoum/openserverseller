import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import path from 'path';
import { THEME_ASSETS, asset } from '../src/shared/templates/assets.js';
import { THEMES } from '../src/shared/templates/themes.js';
import { generateDesign, EXAMPLE_BRIEFS } from '../src/shared/templates/opendesign.js';
import { flatBlocks, validateDocument } from '../src/shared/document/index.js';

/**
 * The manifest is generated from disk, so a theme can never reference a
 * picture that is not there — and with or without pictures, every page must
 * still compose and validate, because the pictures are optional by design.
 */

describe('theme assets', () => {
  it('every manifest entry is a real file under uploads/themes', () => {
    for (const [set, files] of Object.entries(THEME_ASSETS)) {
      for (const [key, url] of Object.entries(files)) {
        expect(url, `${set}.${key}`).toMatch(/^\/uploads\/themes\/[a-z0-9-]+\/(hero|story|promo|h[123])\.jpg$/);
        const file = path.join(process.cwd(), url.slice(1).replace(/\//g, path.sep));
        expect(existsSync(file), `${set}.${key} → ${file}`).toBe(true);
      }
    }
  });

  it('a missing picture resolves to an empty string, never a broken URL', () => {
    expect(asset('no-such-theme', 'hero')).toBe('');
  });

  it('themes only carry image blocks whose URL is in the manifest', () => {
    const known = new Set(Object.values(THEME_ASSETS).flatMap((f) => Object.values(f)));
    for (const t of THEMES) {
      for (const [name, doc] of Object.entries(t.pages)) {
        for (const b of flatBlocks(doc)) {
          if (b.type === 'image') expect(known.has(String(b.content?.url)), `${t.id}.${name} image ${b.content?.url}`).toBe(true);
          if (b.type === 'slider') for (const s of (b.content as any)?.slides ?? []) if (s.mediaUrl) expect(known.has(s.mediaUrl), `${t.id}.${name} slide ${s.mediaUrl}`).toBe(true);
        }
        expect(validateDocument(doc), `${t.id}.${name}`).toEqual([]);
      }
    }
  });

  it('generated designs stay valid whether or not their niche has pictures', () => {
    for (const ex of EXAMPLE_BRIEFS) {
      const d = generateDesign({ prompt: ex.prompt });
      for (const [name, doc] of Object.entries(d.pages)) expect(validateDocument(doc), `${ex.title}.${name}`).toEqual([]);
    }
  });
});

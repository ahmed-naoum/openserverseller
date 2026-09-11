/**
 * The photographs the themes and the OpenDesign niches ship with.
 *
 * GENERATED — do not edit by hand. `backend/scripts/theme-images.py` writes
 * the files under `backend/uploads/themes/<set>/<key>.jpg` and rewrites this
 * manifest to list exactly what exists on disk. A theme asks for
 * `asset('novatrade', 'hero')` and gets the URL, or '' when the picture has
 * not been generated, in which case the composition falls back to its
 * photo-less layout. Nothing here can point at a file that is not there; a
 * test checks that.
 *
 * Keys:
 *   hero   16:9  the opening picture
 *   story  4:3   beside the "about us" copy
 *   promo  3:2   beside the promotion
 *   h1–h3  1:1   the three highlight cards
 *
 * Served by the API's /uploads static route, which every renderer already
 * resolves: the compiler probes and resizes it, the React storefront prefixes
 * the API origin, and the gallery preview's <base> points at the API.
 */

export type AssetKey = 'hero' | 'story' | 'promo' | 'h1' | 'h2' | 'h3';

export const THEME_ASSETS: Record<string, Partial<Record<AssetKey, string>>> = {
  'atlas': { hero: '/uploads/themes/atlas/hero.jpg', story: '/uploads/themes/atlas/story.jpg', promo: '/uploads/themes/atlas/promo.jpg', h1: '/uploads/themes/atlas/h1.jpg', h2: '/uploads/themes/atlas/h2.jpg', h3: '/uploads/themes/atlas/h3.jpg' },
  'casablanca': { hero: '/uploads/themes/casablanca/hero.jpg', story: '/uploads/themes/casablanca/story.jpg', promo: '/uploads/themes/casablanca/promo.jpg', h1: '/uploads/themes/casablanca/h1.jpg', h2: '/uploads/themes/casablanca/h2.jpg', h3: '/uploads/themes/casablanca/h3.jpg' },
  'chronotask': { hero: '/uploads/themes/chronotask/hero.jpg', story: '/uploads/themes/chronotask/story.jpg', promo: '/uploads/themes/chronotask/promo.jpg', h1: '/uploads/themes/chronotask/h1.jpg', h2: '/uploads/themes/chronotask/h2.jpg', h3: '/uploads/themes/chronotask/h3.jpg' },
  'cleanenergy': { hero: '/uploads/themes/cleanenergy/hero.jpg', story: '/uploads/themes/cleanenergy/story.jpg', promo: '/uploads/themes/cleanenergy/promo.jpg', h1: '/uploads/themes/cleanenergy/h1.jpg', h2: '/uploads/themes/cleanenergy/h2.jpg', h3: '/uploads/themes/cleanenergy/h3.jpg' },
  'estateo': { hero: '/uploads/themes/estateo/hero.jpg', story: '/uploads/themes/estateo/story.jpg', promo: '/uploads/themes/estateo/promo.jpg', h1: '/uploads/themes/estateo/h1.jpg', h2: '/uploads/themes/estateo/h2.jpg', h3: '/uploads/themes/estateo/h3.jpg' },
  'finpay': { hero: '/uploads/themes/finpay/hero.jpg', story: '/uploads/themes/finpay/story.jpg', promo: '/uploads/themes/finpay/promo.jpg', h1: '/uploads/themes/finpay/h1.jpg', h2: '/uploads/themes/finpay/h2.jpg', h3: '/uploads/themes/finpay/h3.jpg' },
  'growplus': { hero: '/uploads/themes/growplus/hero.jpg', story: '/uploads/themes/growplus/story.jpg', promo: '/uploads/themes/growplus/promo.jpg', h1: '/uploads/themes/growplus/h1.jpg', h2: '/uploads/themes/growplus/h2.jpg', h3: '/uploads/themes/growplus/h3.jpg' },
  'hideaway': { hero: '/uploads/themes/hideaway/hero.jpg', story: '/uploads/themes/hideaway/story.jpg', promo: '/uploads/themes/hideaway/promo.jpg', h1: '/uploads/themes/hideaway/h1.jpg', h2: '/uploads/themes/hideaway/h2.jpg', h3: '/uploads/themes/hideaway/h3.jpg' },
  'jasmine': { hero: '/uploads/themes/jasmine/hero.jpg', story: '/uploads/themes/jasmine/story.jpg', promo: '/uploads/themes/jasmine/promo.jpg', h1: '/uploads/themes/jasmine/h1.jpg', h2: '/uploads/themes/jasmine/h2.jpg', h3: '/uploads/themes/jasmine/h3.jpg' },
  'matcha': { hero: '/uploads/themes/matcha/hero.jpg', story: '/uploads/themes/matcha/story.jpg', promo: '/uploads/themes/matcha/promo.jpg', h1: '/uploads/themes/matcha/h1.jpg', h2: '/uploads/themes/matcha/h2.jpg', h3: '/uploads/themes/matcha/h3.jpg' },
  'niche-artisan': { hero: '/uploads/themes/niche-artisan/hero.jpg', story: '/uploads/themes/niche-artisan/story.jpg', promo: '/uploads/themes/niche-artisan/promo.jpg', h1: '/uploads/themes/niche-artisan/h1.jpg', h2: '/uploads/themes/niche-artisan/h2.jpg', h3: '/uploads/themes/niche-artisan/h3.jpg' },
  'niche-beauty': { hero: '/uploads/themes/niche-beauty/hero.jpg', story: '/uploads/themes/niche-beauty/story.jpg', promo: '/uploads/themes/niche-beauty/promo.jpg', h1: '/uploads/themes/niche-beauty/h1.jpg', h2: '/uploads/themes/niche-beauty/h2.jpg', h3: '/uploads/themes/niche-beauty/h3.jpg' },
  'niche-energy': { hero: '/uploads/themes/niche-energy/hero.jpg', story: '/uploads/themes/niche-energy/story.jpg', promo: '/uploads/themes/niche-energy/promo.jpg', h1: '/uploads/themes/niche-energy/h1.jpg', h2: '/uploads/themes/niche-energy/h2.jpg', h3: '/uploads/themes/niche-energy/h3.jpg' },
  'niche-fashion': { hero: '/uploads/themes/niche-fashion/hero.jpg', story: '/uploads/themes/niche-fashion/story.jpg', promo: '/uploads/themes/niche-fashion/promo.jpg', h1: '/uploads/themes/niche-fashion/h1.jpg', h2: '/uploads/themes/niche-fashion/h2.jpg', h3: '/uploads/themes/niche-fashion/h3.jpg' },
  'niche-food': { hero: '/uploads/themes/niche-food/hero.jpg', story: '/uploads/themes/niche-food/story.jpg', promo: '/uploads/themes/niche-food/promo.jpg', h1: '/uploads/themes/niche-food/h1.jpg', h2: '/uploads/themes/niche-food/h2.jpg', h3: '/uploads/themes/niche-food/h3.jpg' },
  'niche-general': { hero: '/uploads/themes/niche-general/hero.jpg', story: '/uploads/themes/niche-general/story.jpg', promo: '/uploads/themes/niche-general/promo.jpg', h1: '/uploads/themes/niche-general/h1.jpg', h2: '/uploads/themes/niche-general/h2.jpg', h3: '/uploads/themes/niche-general/h3.jpg' },
  'niche-home': { hero: '/uploads/themes/niche-home/hero.jpg', story: '/uploads/themes/niche-home/story.jpg', promo: '/uploads/themes/niche-home/promo.jpg', h1: '/uploads/themes/niche-home/h1.jpg', h2: '/uploads/themes/niche-home/h2.jpg', h3: '/uploads/themes/niche-home/h3.jpg' },
  'niche-jewelry': { hero: '/uploads/themes/niche-jewelry/hero.jpg', story: '/uploads/themes/niche-jewelry/story.jpg', promo: '/uploads/themes/niche-jewelry/promo.jpg', h1: '/uploads/themes/niche-jewelry/h1.jpg', h2: '/uploads/themes/niche-jewelry/h2.jpg', h3: '/uploads/themes/niche-jewelry/h3.jpg' },
  'niche-kids': { hero: '/uploads/themes/niche-kids/hero.jpg', story: '/uploads/themes/niche-kids/story.jpg', promo: '/uploads/themes/niche-kids/promo.jpg', h1: '/uploads/themes/niche-kids/h1.jpg', h2: '/uploads/themes/niche-kids/h2.jpg', h3: '/uploads/themes/niche-kids/h3.jpg' },
  'niche-saas': { hero: '/uploads/themes/niche-saas/hero.jpg', story: '/uploads/themes/niche-saas/story.jpg', promo: '/uploads/themes/niche-saas/promo.jpg', h1: '/uploads/themes/niche-saas/h1.jpg', h2: '/uploads/themes/niche-saas/h2.jpg', h3: '/uploads/themes/niche-saas/h3.jpg' },
  'niche-sport': { hero: '/uploads/themes/niche-sport/hero.jpg', story: '/uploads/themes/niche-sport/story.jpg', promo: '/uploads/themes/niche-sport/promo.jpg', h1: '/uploads/themes/niche-sport/h1.jpg', h2: '/uploads/themes/niche-sport/h2.jpg', h3: '/uploads/themes/niche-sport/h3.jpg' },
  'niche-tech': { hero: '/uploads/themes/niche-tech/hero.jpg', story: '/uploads/themes/niche-tech/story.jpg', promo: '/uploads/themes/niche-tech/promo.jpg', h1: '/uploads/themes/niche-tech/h1.jpg', h2: '/uploads/themes/niche-tech/h2.jpg', h3: '/uploads/themes/niche-tech/h3.jpg' },
  'novatrade': { hero: '/uploads/themes/novatrade/hero.jpg', story: '/uploads/themes/novatrade/story.jpg', promo: '/uploads/themes/novatrade/promo.jpg', h1: '/uploads/themes/novatrade/h1.jpg', h2: '/uploads/themes/novatrade/h2.jpg', h3: '/uploads/themes/novatrade/h3.jpg' },
  'souk': { hero: '/uploads/themes/souk/hero.jpg', story: '/uploads/themes/souk/story.jpg', promo: '/uploads/themes/souk/promo.jpg', h1: '/uploads/themes/souk/h1.jpg', h2: '/uploads/themes/souk/h2.jpg', h3: '/uploads/themes/souk/h3.jpg' },
};

export function asset(set: string, key: AssetKey): string {
  return THEME_ASSETS[set]?.[key] ?? '';
}

export function assetsOf(set: string): Partial<Record<AssetKey, string>> {
  return THEME_ASSETS[set] ?? {};
}

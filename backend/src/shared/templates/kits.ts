import type { Shadow } from './compose.js';

/**
 * Style kits: how a store is drawn, as opposed to what it is made of.
 *
 * Two themes with the same sections in the same order still look alike when
 * every hero is centred at 48px, every card has the same corners and every
 * product tile is the same white box. A kit decides those things once —
 * hero alignment and scale, heading scale, button shape, card surface,
 * product tile style, section spacing — and every helper in compose.ts
 * reads its kit from the Look it is handed. Twelve kits, twelve ways to draw
 * the same store; a theme picks one, OpenDesign draws one at random.
 */

export interface Kit {
  id: string;
  label: string;
  hero: {
    align: 'left' | 'center';
    titleSize: 'md' | 'lg' | 'xl' | '2xl';
    uppercase: boolean;
    kicker: 'plain' | 'pill' | 'line';
    /** A gradient band behind the hero, or a flat colour. */
    band: 'flat' | 'gradient';
  };
  heading: {
    size: 'md' | 'lg' | 'xl';
    align: 'left' | 'center';
    uppercase: boolean;
    weight: 'bold' | 'black';
    tracking: 'normal' | 'wide' | 'tight';
  };
  button: {
    radius: number;
    paddingX: number;
    paddingY: number;
    textSize: number;
  };
  card: {
    radius: number;
    border: boolean;
    shadow: Shadow;
    align: 'left' | 'center';
  };
  product: {
    cardStyle: 'card' | 'flat' | 'minimal';
    imageHeight: number;
    imageFit: 'contain' | 'cover';
    buttonStyle: 'solid' | 'outline' | 'text';
    buttonRadius: number;
    radius: number;
    shadow: Shadow;
    titleAlign: 'left' | 'center';
  };
  section: {
    /** Multiplies every band's vertical padding. */
    spacing: number;
    maxWidth: number;
    /** A hairline around alternating bands. */
    divider: boolean;
    /** Corners on coloured bands (promotions, calls to action). */
    radius: number;
  };
}

const kit = (k: Kit) => k;

export const KITS: Record<string, Kit> = {
  clean: kit({
    id: 'clean', label: 'Épuré classique',
    hero: { align: 'center', titleSize: 'lg', uppercase: false, kicker: 'plain', band: 'flat' },
    heading: { size: 'md', align: 'center', uppercase: false, weight: 'bold', tracking: 'normal' },
    button: { radius: 12, paddingX: 32, paddingY: 14, textSize: 15 },
    card: { radius: 16, border: true, shadow: 'sm', align: 'left' },
    product: { cardStyle: 'card', imageHeight: 200, imageFit: 'contain', buttonStyle: 'solid', buttonRadius: 12, radius: 16, shadow: 'sm', titleAlign: 'left' },
    section: { spacing: 1, maxWidth: 1200, divider: false, radius: 0 },
  }),
  editorial: kit({
    id: 'editorial', label: 'Éditorial',
    hero: { align: 'left', titleSize: 'xl', uppercase: false, kicker: 'line', band: 'flat' },
    heading: { size: 'lg', align: 'left', uppercase: false, weight: 'bold', tracking: 'tight' },
    button: { radius: 2, paddingX: 30, paddingY: 15, textSize: 14 },
    card: { radius: 4, border: true, shadow: 'none', align: 'left' },
    product: { cardStyle: 'flat', imageHeight: 300, imageFit: 'cover', buttonStyle: 'text', buttonRadius: 0, radius: 4, shadow: 'none', titleAlign: 'left' },
    section: { spacing: 1.2, maxWidth: 1240, divider: true, radius: 0 },
  }),
  bold: kit({
    id: 'bold', label: 'Impact',
    hero: { align: 'center', titleSize: '2xl', uppercase: true, kicker: 'pill', band: 'gradient' },
    heading: { size: 'xl', align: 'center', uppercase: true, weight: 'black', tracking: 'tight' },
    button: { radius: 999, paddingX: 40, paddingY: 18, textSize: 16 },
    card: { radius: 24, border: false, shadow: 'lg', align: 'center' },
    product: { cardStyle: 'card', imageHeight: 220, imageFit: 'cover', buttonStyle: 'solid', buttonRadius: 999, radius: 24, shadow: 'lg', titleAlign: 'center' },
    section: { spacing: 1.1, maxWidth: 1280, divider: false, radius: 32 },
  }),
  minimal: kit({
    id: 'minimal', label: 'Minimal',
    hero: { align: 'left', titleSize: 'xl', uppercase: false, kicker: 'plain', band: 'flat' },
    heading: { size: 'md', align: 'left', uppercase: true, weight: 'bold', tracking: 'wide' },
    button: { radius: 0, paddingX: 28, paddingY: 14, textSize: 13 },
    card: { radius: 0, border: false, shadow: 'none', align: 'left' },
    product: { cardStyle: 'minimal', imageHeight: 320, imageFit: 'cover', buttonStyle: 'text', buttonRadius: 0, radius: 0, shadow: 'none', titleAlign: 'left' },
    section: { spacing: 1.35, maxWidth: 1320, divider: false, radius: 0 },
  }),
  soft: kit({
    id: 'soft', label: 'Douceur',
    hero: { align: 'center', titleSize: 'lg', uppercase: false, kicker: 'pill', band: 'gradient' },
    heading: { size: 'lg', align: 'center', uppercase: false, weight: 'black', tracking: 'normal' },
    button: { radius: 999, paddingX: 34, paddingY: 16, textSize: 15 },
    card: { radius: 28, border: false, shadow: 'md', align: 'center' },
    product: { cardStyle: 'card', imageHeight: 210, imageFit: 'cover', buttonStyle: 'solid', buttonRadius: 999, radius: 28, shadow: 'md', titleAlign: 'center' },
    section: { spacing: 1.15, maxWidth: 1200, divider: false, radius: 36 },
  }),
  tech: kit({
    id: 'tech', label: 'Tech',
    hero: { align: 'center', titleSize: 'xl', uppercase: false, kicker: 'pill', band: 'gradient' },
    heading: { size: 'lg', align: 'left', uppercase: false, weight: 'black', tracking: 'tight' },
    button: { radius: 8, paddingX: 30, paddingY: 14, textSize: 14 },
    card: { radius: 12, border: true, shadow: 'none', align: 'left' },
    product: { cardStyle: 'card', imageHeight: 200, imageFit: 'contain', buttonStyle: 'outline', buttonRadius: 8, radius: 12, shadow: 'none', titleAlign: 'left' },
    section: { spacing: 1, maxWidth: 1200, divider: true, radius: 16 },
  }),
  luxe: kit({
    id: 'luxe', label: 'Luxe',
    hero: { align: 'center', titleSize: 'xl', uppercase: false, kicker: 'line', band: 'flat' },
    heading: { size: 'lg', align: 'center', uppercase: true, weight: 'bold', tracking: 'wide' },
    button: { radius: 0, paddingX: 40, paddingY: 16, textSize: 13 },
    card: { radius: 0, border: true, shadow: 'none', align: 'center' },
    product: { cardStyle: 'flat', imageHeight: 340, imageFit: 'cover', buttonStyle: 'outline', buttonRadius: 0, radius: 0, shadow: 'none', titleAlign: 'center' },
    section: { spacing: 1.4, maxWidth: 1160, divider: true, radius: 0 },
  }),
  street: kit({
    id: 'street', label: 'Street',
    hero: { align: 'left', titleSize: '2xl', uppercase: true, kicker: 'plain', band: 'flat' },
    heading: { size: 'xl', align: 'left', uppercase: true, weight: 'black', tracking: 'tight' },
    button: { radius: 0, paddingX: 36, paddingY: 18, textSize: 15 },
    card: { radius: 0, border: true, shadow: 'none', align: 'left' },
    product: { cardStyle: 'flat', imageHeight: 280, imageFit: 'cover', buttonStyle: 'solid', buttonRadius: 0, radius: 0, shadow: 'none', titleAlign: 'left' },
    section: { spacing: 0.9, maxWidth: 1320, divider: true, radius: 0 },
  }),
  boutique: kit({
    id: 'boutique', label: 'Boutique',
    hero: { align: 'left', titleSize: 'lg', uppercase: false, kicker: 'line', band: 'flat' },
    heading: { size: 'md', align: 'left', uppercase: false, weight: 'bold', tracking: 'normal' },
    button: { radius: 6, paddingX: 30, paddingY: 14, textSize: 14 },
    card: { radius: 10, border: true, shadow: 'sm', align: 'left' },
    product: { cardStyle: 'flat', imageHeight: 260, imageFit: 'cover', buttonStyle: 'outline', buttonRadius: 6, radius: 10, shadow: 'none', titleAlign: 'left' },
    section: { spacing: 1.1, maxWidth: 1180, divider: false, radius: 12 },
  }),
  playful: kit({
    id: 'playful', label: 'Ludique',
    hero: { align: 'center', titleSize: 'xl', uppercase: false, kicker: 'pill', band: 'gradient' },
    heading: { size: 'lg', align: 'center', uppercase: false, weight: 'black', tracking: 'normal' },
    button: { radius: 20, paddingX: 34, paddingY: 16, textSize: 16 },
    card: { radius: 32, border: false, shadow: 'lg', align: 'center' },
    product: { cardStyle: 'card', imageHeight: 200, imageFit: 'contain', buttonStyle: 'solid', buttonRadius: 20, radius: 32, shadow: 'lg', titleAlign: 'center' },
    section: { spacing: 1.05, maxWidth: 1200, divider: false, radius: 40 },
  }),
  brutal: kit({
    id: 'brutal', label: 'Brut',
    hero: { align: 'left', titleSize: '2xl', uppercase: true, kicker: 'pill', band: 'flat' },
    heading: { size: 'xl', align: 'left', uppercase: true, weight: 'black', tracking: 'normal' },
    button: { radius: 0, paddingX: 32, paddingY: 16, textSize: 14 },
    card: { radius: 0, border: true, shadow: 'none', align: 'left' },
    product: { cardStyle: 'card', imageHeight: 240, imageFit: 'cover', buttonStyle: 'solid', buttonRadius: 0, radius: 0, shadow: 'none', titleAlign: 'left' },
    section: { spacing: 0.95, maxWidth: 1280, divider: true, radius: 0 },
  }),
  magazine: kit({
    id: 'magazine', label: 'Magazine',
    hero: { align: 'center', titleSize: '2xl', uppercase: false, kicker: 'line', band: 'flat' },
    heading: { size: 'xl', align: 'center', uppercase: false, weight: 'bold', tracking: 'tight' },
    button: { radius: 999, paddingX: 36, paddingY: 14, textSize: 13 },
    card: { radius: 8, border: false, shadow: 'none', align: 'center' },
    product: { cardStyle: 'flat', imageHeight: 320, imageFit: 'cover', buttonStyle: 'text', buttonRadius: 0, radius: 8, shadow: 'none', titleAlign: 'center' },
    section: { spacing: 1.3, maxWidth: 1240, divider: false, radius: 0 },
  }),
};

export const KIT_IDS = Object.keys(KITS);

export function kitOf(id: string | undefined): Kit {
  return (id && KITS[id]) || KITS.clean;
}

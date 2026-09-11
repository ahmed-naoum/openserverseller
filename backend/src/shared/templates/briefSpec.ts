/**
 * What a model tells the composer after reading a brief.
 *
 * OpenDesign's built-in reader turns a sentence into this same shape with
 * regular expressions; a language model, when an admin has enabled one, fills
 * it in with judgement instead — and can also write the store's copy for the
 * brief rather than reuse the niche's stock lines. Either way the composer
 * (opendesign.ts) does the arranging, so nothing a model says can produce a
 * page that does not validate: it chooses among parts, it does not invent
 * them.
 *
 * `BRIEF_SPEC_SCHEMA` is the JSON Schema handed to the model as a tool input,
 * and `sanitizeSpec` is what the API trusts — the schema describes, the
 * sanitiser enforces. Pure TypeScript, shared with the frontend.
 */

export const SPEC_NICHES = ['beauty', 'fashion', 'tech', 'food', 'home', 'kids', 'sport', 'jewelry', 'saas', 'energy', 'artisan', 'general'] as const;
export const SPEC_ELEMENTS = ['button', 'countdown', 'promo', 'reviews', 'faq', 'story', 'steps', 'stats', 'whatsapp', 'ticker', 'slider', 'grid', 'photos'] as const;
export const SPEC_FONTS = ['Manrope', 'Plus Jakarta Sans', 'Space Grotesk', 'Playfair Display', 'Cairo', 'Inter', 'Poppins', 'DM Sans', 'Lora', 'Montserrat'] as const;

export interface SpecCopy {
  kicker?: string;
  headline?: string;
  subhead?: string;
  cta?: string;
  announcement?: string;
  usp?: { title: string; description: string }[];
  highlights?: { title: string; description: string }[];
  stats?: { value: string; label: string }[];
  promo?: { title: string; subtitle: string; cta: string; countdown?: string };
  story?: { title: string; paragraphs: string[] };
  quotes?: { name: string; city: string; text: string }[];
  faqs?: { q: string; a: string }[];
  catalogueTitle?: string;
  catalogueSubtitle?: string;
  about?: string;
}

export interface BriefSpec {
  niche: (typeof SPEC_NICHES)[number];
  mood: 'light' | 'dark' | 'auto';
  colours?: { primary?: string; secondary?: string; bg?: string; text?: string };
  font?: (typeof SPEC_FONTS)[number];
  /** Elements the brief asks for. */
  wants?: (typeof SPEC_ELEMENTS)[number][];
  /** Elements the brief asks to leave out. */
  drops?: (typeof SPEC_ELEMENTS)[number][];
  /** The label of an extra button in the accroche, when one is asked for. */
  buttonLabel?: string;
  minimal?: boolean;
  /** Copy written for this brief, in the brief's language. Absent fields keep the niche's stock copy. */
  copy?: SpecCopy;
  /** One or two sentences, in French, on what was understood. Shown to the seller. */
  summary?: string;
  /** In English, 5-15 words: the concrete products the store's photos should show. Drives image generation. */
  photoSubject?: string;
}

const HEX = { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' };
const short = (max: number) => ({ type: 'string', maxLength: max });
const pair = (a: string, b: string, maxA: number, maxB: number, max: number) => ({
  type: 'array', maxItems: max,
  items: { type: 'object', properties: { [a]: short(maxA), [b]: short(maxB) }, required: [a, b] },
});

/** JSON Schema for the model's tool input. Keep in step with BriefSpec. */
export const BRIEF_SPEC_SCHEMA = {
  type: 'object',
  properties: {
    niche: { type: 'string', enum: [...SPEC_NICHES], description: 'The closest niche. "general" only when nothing fits.' },
    mood: { type: 'string', enum: ['light', 'dark', 'auto'], description: 'Page ground. "auto" when the brief does not say.' },
    colours: {
      type: 'object',
      properties: { primary: HEX, secondary: HEX, bg: HEX, text: HEX },
      description: 'Only colours the brief names or clearly implies, as hex. primary = buttons and prices; bg = page background.',
    },
    font: { type: 'string', enum: [...SPEC_FONTS] },
    wants: { type: 'array', items: { type: 'string', enum: [...SPEC_ELEMENTS] }, description: 'Elements the brief asks for.' },
    drops: { type: 'array', items: { type: 'string', enum: [...SPEC_ELEMENTS] }, description: 'Elements the brief asks to leave out.' },
    buttonLabel: { ...short(40), description: 'Label of an extra button in the hero, only if the brief asks for a button. In the brief’s language.' },
    minimal: { type: 'boolean' },
    copy: {
      type: 'object',
      description: 'Copy written for this specific store, in the language of the brief (French unless the brief is clearly in another language). Concrete, no placeholders, no markdown.',
      properties: {
        kicker: short(40),
        headline: short(70),
        subhead: short(180),
        cta: short(32),
        announcement: short(110),
        usp: pair('title', 'description', 40, 110, 4),
        highlights: pair('title', 'description', 40, 90, 3),
        stats: pair('value', 'label', 14, 40, 4),
        promo: { type: 'object', properties: { title: short(70), subtitle: short(160), cta: short(32), countdown: short(80) }, required: ['title', 'subtitle', 'cta'] },
        story: { type: 'object', properties: { title: short(50), paragraphs: { type: 'array', items: short(260), maxItems: 3 } }, required: ['title', 'paragraphs'] },
        quotes: { type: 'array', maxItems: 4, items: { type: 'object', properties: { name: short(30), city: short(30), text: short(180) }, required: ['name', 'city', 'text'] } },
        faqs: pair('q', 'a', 90, 220, 5),
        catalogueTitle: short(50),
        catalogueSubtitle: short(120),
        about: short(200),
      },
    },
    summary: { ...short(300), description: 'One or two sentences in French telling the seller what was understood and decided.' },
    photoSubject: { ...short(120), description: 'Always fill. In English, 5-15 words: the concrete products or dishes a photographer should shoot for this store, e.g. "gourmet flame-grilled beef burgers with melted cheddar and fries". Objects only, never a person.' },
  },
  required: ['niche', 'mood'],
} as const;

const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
const str = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
const list = <T>(v: unknown, max: number, map: (x: any) => T | null): T[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const out = v.map(map).filter((x): x is T => x !== null).slice(0, max);
  return out.length ? out : undefined;
};

/** The spec the API trusts: every field checked, every string bounded, unknown keys dropped. */
export function sanitizeSpec(raw: unknown): BriefSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, any>;
  const niche = (SPEC_NICHES as readonly string[]).includes(r.niche) ? (r.niche as BriefSpec['niche']) : 'general';
  const mood: BriefSpec['mood'] = r.mood === 'light' || r.mood === 'dark' ? r.mood : 'auto';
  const spec: BriefSpec = { niche, mood };

  if (r.colours && typeof r.colours === 'object') {
    const c: NonNullable<BriefSpec['colours']> = {};
    for (const k of ['primary', 'secondary', 'bg', 'text'] as const) if (isHex(r.colours[k])) c[k] = r.colours[k].toLowerCase();
    if (Object.keys(c).length) spec.colours = c;
  }
  if ((SPEC_FONTS as readonly string[]).includes(r.font)) spec.font = r.font;
  const elements = (v: unknown) => list(v, 12, (x) => ((SPEC_ELEMENTS as readonly string[]).includes(x) ? (x as (typeof SPEC_ELEMENTS)[number]) : null));
  const wants = elements(r.wants);
  const drops = elements(r.drops);
  if (wants) spec.wants = wants;
  if (drops) spec.drops = drops.filter((d) => !wants?.includes(d));
  const buttonLabel = str(r.buttonLabel, 40);
  if (buttonLabel) spec.buttonLabel = buttonLabel;
  if (typeof r.minimal === 'boolean') spec.minimal = r.minimal;
  const summary = str(r.summary, 300);
  if (summary) spec.summary = summary;
  const photoSubject = str(r.photoSubject, 120);
  if (photoSubject) spec.photoSubject = photoSubject;

  if (r.copy && typeof r.copy === 'object') {
    const c = r.copy as Record<string, any>;
    const copy: SpecCopy = {};
    const put = <K extends keyof SpecCopy>(k: K, v: SpecCopy[K] | undefined) => {
      if (v !== undefined) copy[k] = v;
    };
    put('kicker', str(c.kicker, 40));
    put('headline', str(c.headline, 70));
    put('subhead', str(c.subhead, 180));
    put('cta', str(c.cta, 32));
    put('announcement', str(c.announcement, 110));
    put('usp', list(c.usp, 4, (x) => (str(x?.title, 40) && str(x?.description, 110) ? { title: str(x.title, 40)!, description: str(x.description, 110)! } : null)));
    put('highlights', list(c.highlights, 3, (x) => (str(x?.title, 40) && str(x?.description, 90) ? { title: str(x.title, 40)!, description: str(x.description, 90)! } : null)));
    put('stats', list(c.stats, 4, (x) => (str(x?.value, 14) && str(x?.label, 40) ? { value: str(x.value, 14)!, label: str(x.label, 40)! } : null)));
    if (c.promo && str(c.promo.title, 70) && str(c.promo.subtitle, 160) && str(c.promo.cta, 32)) {
      put('promo', { title: str(c.promo.title, 70)!, subtitle: str(c.promo.subtitle, 160)!, cta: str(c.promo.cta, 32)!, countdown: str(c.promo.countdown, 80) });
    }
    if (c.story && str(c.story.title, 50)) {
      const paragraphs = list(c.story.paragraphs, 3, (x) => str(x, 260) ?? null);
      if (paragraphs) put('story', { title: str(c.story.title, 50)!, paragraphs });
    }
    put('quotes', list(c.quotes, 4, (x) => (str(x?.name, 30) && str(x?.city, 30) && str(x?.text, 180) ? { name: str(x.name, 30)!, city: str(x.city, 30)!, text: str(x.text, 180)! } : null)));
    put('faqs', list(c.faqs, 5, (x) => (str(x?.q, 90) && str(x?.a, 220) ? { q: str(x.q, 90)!, a: str(x.a, 220)! } : null)));
    put('catalogueTitle', str(c.catalogueTitle, 50));
    put('catalogueSubtitle', str(c.catalogueSubtitle, 120));
    put('about', str(c.about, 200));
    if (Object.keys(copy).length) spec.copy = copy;
  }
  return spec;
}

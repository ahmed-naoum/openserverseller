/**
 * The accent colour of a Google Sheets pack card.
 *
 * WHY INLINE STYLES AND NOT TAILWIND CLASSES. Tailwind only emits the classes it
 * can see in the source at BUILD time. A class name assembled from a value read
 * out of the database — `text-${plan.color}-600` — is invisible to that scan, gets
 * purged, and the card renders with no colour at all. So the server stores a hex
 * and this module turns it into style objects the browser applies directly.
 *
 * WHY THE HEX IS NEVER TRUSTED HERE EITHER. It reaches a `style` attribute, and
 * the admin who set it is not the seller who sees it. The server validates on
 * write (accentOrNull in admin/sheetPlans.routes.ts); `normaliseAccent` below is
 * the second gate, so a row written before that validation existed — or by hand in
 * psql — still cannot put arbitrary text into the DOM.
 */

/** What a pack with no colour of its own uses. The emerald the packs shipped with. */
export const DEFAULT_ACCENT = '#059669';

/**
 * The swatches the admin picks from.
 *
 * A curated row rather than only a raw colour well: most packs want to be visibly
 * distinct from each other, not precisely branded, and picking from six that are
 * known to read well on white is faster and harder to get wrong than typing hex.
 * The free hex input is still there for the case the row does not cover.
 */
export const ACCENT_PRESETS: { hex: string; label: string }[] = [
  { hex: '#059669', label: 'Émeraude' },
  { hex: '#2563eb', label: 'Bleu' },
  { hex: '#7c3aed', label: 'Violet' },
  { hex: '#db2777', label: 'Rose' },
  { hex: '#ea580c', label: 'Orange' },
  { hex: '#0891b2', label: 'Cyan' },
];

/** `#abc` / `abcdef` / junk -> `#aabbcc` / `#abcdef` / null. Mirrors the server's rule. */
export function normaliseAccent(value: unknown): string | null {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return null;
  const short = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(raw);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  const full = /^#?([0-9a-f]{6})$/.exec(raw);
  return full ? `#${full[1]}` : null;
}

/** A validated accent, falling back to the default for anything unusable. */
export function accentOf(value: unknown): string {
  return normaliseAccent(value) ?? DEFAULT_ACCENT;
}

/**
 * `#059669` at 12% -> `rgba(5, 150, 105, 0.12)`.
 *
 * Built by hand rather than with `color-mix()` so the tint does not depend on how
 * new the seller's browser is — a card whose background silently fails to paint
 * looks broken, not gracefully degraded.
 */
export function accentAlpha(hex: string, alpha: number): string {
  const clean = normaliseAccent(hex) ?? DEFAULT_ACCENT;
  const r = parseInt(clean.slice(1, 3), 16);
  const g = parseInt(clean.slice(3, 5), 16);
  const b = parseInt(clean.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Every style one card needs, derived from one colour.
 *
 * Grouped into a single object so a card never mixes an accent from one plan with
 * a tint from another, and so the alpha values live in one place instead of being
 * re-guessed at each call site.
 */
export function accentStyles(value: unknown) {
  const hex = accentOf(value);
  return {
    hex,
    /** Quota, per-lead rate — the figures that sell the pack. */
    text: { color: hex },
    /** The card itself when it is the seller's current pack. */
    surface: { backgroundColor: accentAlpha(hex, 0.06), borderColor: accentAlpha(hex, 0.35) },
    /** A quiet border for a card that is merely on offer. */
    outline: { borderColor: accentAlpha(hex, 0.22) },
    /** The "current pack" chip. */
    chip: { backgroundColor: accentAlpha(hex, 0.12), color: hex },
    /** The call to action. */
    solid: { backgroundColor: hex, color: '#ffffff' },
  };
}

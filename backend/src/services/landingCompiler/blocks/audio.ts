import { esc, safeUrl, safeColor, num } from '../escape.js';
import { AUDIO_RUNTIME } from '../runtime/audio.js';
import type { BlockRenderer, BlockContext } from './types.js';

/**
 * Ported from BlockRenderer.tsx `case 'audio'` (:249), AudioBlockComponent
 * (:1663) and WhatsAppVoiceNotePlayer (:1745).
 *
 * Two themes, and the default is the interesting one: React treats an ABSENT
 * `themeStyle` as WhatsApp (`themeStyle === 'whatsapp' || !themeStyle`), and no
 * audio block in production sets the field — so every live page renders the
 * voice-note bubble, not the plain <audio> card. The card is still ported
 * because a page that sets `themeStyle` to anything else would otherwise render
 * the wrong thing entirely.
 *
 * Tracks live in `content.audios`; the legacy single-track shape
 * (`content.url` / `content.title`) is kept because AudioBlockComponent still
 * falls back to it.
 */

/**
 * The 32 waveform heights, seeded from the track.
 *
 * Ported bit-for-bit from getWaveformBars (BlockRenderer.tsx:1645), including
 * the `hash |= 0` truncation to a signed 32-bit int — drop it and the arithmetic
 * silently diverges on long ids, giving the compiled page a different waveform
 * from the React one for the same audio.
 */
export function waveformBars(seed: unknown): number[] {
  const str = String(seed || 'audio');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const base = [
    6, 14, 22, 10, 18, 28, 34, 20, 12, 24, 30, 18, 10, 26, 32, 28, 14, 22, 28, 20, 10, 16, 26, 32,
    18, 8, 14, 24, 18, 10, 6, 12,
  ];
  return base.map((h, i) => {
    const variation = (Math.abs(hash + i * 19) % 9) - 4;
    return Math.max(5, Math.min(32, h + variation));
  });
}

/** formatAudioTime, BlockRenderer.tsx:1638. */
export function formatAudioTime(seconds: unknown): string {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

const AVATAR_SVG =
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">` +
  `<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;

const MIC_SVG =
  `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">` +
  `<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>`;

const WA_SVG =
  `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">` +
  `<path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.45L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.852.002-2.63-1.023-5.101-2.883-6.963C16.593 1.928 14.122.904 11.492.904 6.056.904 1.63 5.324 1.626 10.757c-.001 1.701.446 3.362 1.3 4.8l-.949 3.466 3.549-.931.131.078z"/></svg>`;

const CHECKS_SVG =
  `<svg width="14" height="14" viewBox="0 0 24 24" fill="#0ea5e9" aria-hidden="true">` +
  `<path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.41 11.93 6 13.34l5.66 5.66 12-12-1.42-1.41zM.41 13.34l5.66 5.66 1.41-1.41L1.83 11.93.41 13.34z"/></svg>`;

const PLAY_SVG =
  `<svg class="i-play" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">` +
  `<path d="M8 5v14l11-7z"/></svg>`;

const PAUSE_SVG =
  `<svg class="i-pause" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">` +
  `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

/** One voice-note bubble. */
function voiceNote(track: any, idx: number, c: any): string {
  const src = safeUrl(track?.url || '');
  const bubble = safeColor(c.bubbleColor ?? track?.bubbleColor, '#ffffff');
  const playBtn = safeColor(c.playBtnColor, '#25D366');
  const activeWave = safeColor(c.activeWaveColor, '#34B7F1');

  const sender = String(track?.senderName || track?.title || `Client ${idx + 1}`);
  const stamp = String(track?.time || '11:42');
  const avatar = safeUrl(track?.avatarUrl || '');

  // React seeds from `audio.id || audio.url || idx`, so index 0 with no id and
  // no url falls through to the string 'audio' inside getWaveformBars.
  const bars = waveformBars(track?.id || track?.url || idx)
    .map((h) => `<span style="height:${h}px"></span>`)
    .join('');

  const head =
    `<div class="bk-au-h"><div class="bk-au-av">` +
    (avatar
      ? `<img class="bk-au-pic" src="${esc(avatar)}" alt="" width="36" height="36" loading="lazy">`
      : `<div class="bk-au-ph">${AVATAR_SVG}</div>`) +
    `<div class="bk-au-mic">${MIC_SVG}</div></div>` +
    `<div class="bk-au-meta"><div class="bk-au-nm"><b>${esc(sender)}</b>` +
    `<span class="bk-au-ok">&#10003;</span></div>` +
    `<span class="bk-au-sub"><span class="bk-au-dot"></span>Message Vocal Audio</span></div>` +
    `<div class="bk-au-wa">${WA_SVG}</div></div>`;

  const body = src
    ? `<div class="bk-au-row">` +
      `<button type="button" class="bk-au-play" data-au-play style="background:${playBtn}" ` +
      `aria-label="Lire">${PLAY_SVG}${PAUSE_SVG}</button>` +
      `<div class="bk-au-mid">` +
      `<div class="bk-au-wave" data-au-wave title="Cliquez pour naviguer dans l'audio">${bars}</div>` +
      `<div class="bk-au-t"><span data-au-cur>0:00</span>` +
      // React shows the track's own duration until metadata arrives, then the
      // real one. A compiled page has no metadata, so the placeholder ships and
      // the runtime replaces it.
      `<span data-au-dur>${esc(track?.duration ? formatAudioTime(track.duration) : '0:35')}</span>` +
      `</div></div>` +
      (c.showSpeedToggle !== false
        ? `<button type="button" class="bk-au-sp" data-au-speed ` +
          `title="Changer la vitesse de lecture">1x</button>`
        : '') +
      `</div>`
    : `<div class="bk-au-none"><b>&#127908; Aucun fichier audio associ&eacute;</b>` +
      `<i>T&eacute;l&eacute;chargez un MP3 dans le panneau de droite</i></div>`;

  const foot =
    `<div class="bk-au-f"><span>${esc(stamp)}</span>` +
    (c.showCheckmarks !== false ? CHECKS_SVG : '') +
    `</div>`;

  // autoplay is first-track-only in React, and only outside the editor.
  const audioEl = src
    ? `<audio src="${esc(src)}" preload="metadata"` +
      (c.loop ? ' loop' : '') +
      (c.autoplay && idx === 0 ? ' autoplay' : '') +
      `></audio>`
    : '';

  return (
    `<div class="bk-au-w">${audioEl}` +
    `<div class="bk-au-b" data-au data-au-active="${esc(activeWave)}" ` +
    `style="background:${bubble}"><div class="bk-au-tail" style="background:${bubble}"></div>` +
    `${head}${body}${foot}</div></div>`
  );
}

/** The plain card, for a block that explicitly asks for a non-WhatsApp theme. */
function classicCard(track: any, idx: number, c: any): string {
  const src = safeUrl(track?.url || '');
  const bg = safeColor(c.bgColor, '#ffffff');
  const border = safeColor(c.borderColor, '#f3f4f6');
  const title = String(track?.title || '');

  return (
    `<div class="bk-au-c" style="background:${bg};border-color:${border}">` +
    (title
      ? `<div class="bk-au-c-t">${esc(title)}</div>`
      : `<div class="bk-au-c-t e">Audio ${idx + 1}</div>`) +
    (src
      ? `<audio src="${esc(src)}" controlsList="nodownload" preload="metadata"` +
        (c.controls !== false ? ' controls' : '') +
        (c.autoplay && idx === 0 ? ' autoplay' : '') +
        (c.loop ? ' loop' : '') +
        `></audio>`
      : `<div class="bk-au-none"><b>&#127925; Lecteur Audio &mdash; Aucun fichier</b>` +
        `<i>T&eacute;l&eacute;chargez un audio dans les propri&eacute;t&eacute;s</i></div>`) +
    `</div>`
  );
}

export const audioBlock: BlockRenderer = {
  type: 'audio',

  css:
    `.bk-au{width:100%;max-width:1024px;margin-left:auto;margin-right:auto;padding-left:16px;` +
    `padding-right:16px;display:flex;flex-direction:column;align-items:center;` +
    `-webkit-user-select:none;user-select:none}` +
    `@media(min-width:640px){.bk-au{padding-left:24px;padding-right:24px}}` +
    `.bk-au-g{display:grid;grid-template-columns:1fr;gap:16px;width:100%}` +
    `@media(min-width:640px){.bk-au-g{gap:24px}}` +
    // 1 track is a single narrow column, 2 pair up, 3+ go to three across —
    // the same max-w-md / max-w-3xl / lg:grid-cols-3 ladder React uses.
    `.bk-au-g.n1{max-width:448px;margin-left:auto;margin-right:auto}` +
    `.bk-au-g.n2{max-width:768px;margin-left:auto;margin-right:auto}` +
    `@media(min-width:768px){.bk-au-g.n2,.bk-au-g.n3{grid-template-columns:repeat(2,1fr)}}` +
    `@media(min-width:1024px){.bk-au-g.n3{grid-template-columns:repeat(3,1fr)}}` +
    `.bk-au-w{width:100%;display:flex;flex-direction:column;align-items:center}` +
    `.bk-au-b{width:100%;position:relative;border-radius:16px;padding:14px;` +
    `border:1px solid rgba(226,232,240,.7);box-shadow:0 4px 6px -1px rgba(0,0,0,.1)}` +
    `.bk-au-tail{position:absolute;top:-6px;left:16px;width:14px;height:14px;` +
    `transform:rotate(45deg);border-left:1px solid rgba(226,232,240,.7);` +
    `border-top:1px solid rgba(226,232,240,.7)}` +
    `.bk-au-h{display:flex;align-items:center;gap:10px;margin-bottom:10px;padding-bottom:8px;` +
    `border-bottom:1px solid rgba(241,245,249,.8)}` +
    `.bk-au-av{position:relative;flex-shrink:0}` +
    `.bk-au-pic{width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid #e2e8f0}` +
    `.bk-au-ph{width:36px;height:36px;border-radius:50%;background:#e2e8f0;color:#94a3b8;` +
    `display:flex;align-items:center;justify-content:center;border:1px solid #cbd5e1}` +
    `.bk-au-mic{position:absolute;bottom:-4px;right:-4px;width:16px;height:16px;border-radius:50%;` +
    `background:#10b981;color:#fff;display:flex;align-items:center;justify-content:center}` +
    `.bk-au-meta{flex:1;min-width:0}` +
    `.bk-au-nm{display:flex;align-items:center;gap:6px}` +
    `.bk-au-nm b{font-size:12px;font-weight:900;color:#1e293b;overflow:hidden;` +
    `text-overflow:ellipsis;white-space:nowrap}` +
    `.bk-au-ok{width:14px;height:14px;border-radius:50%;background:#d1fae5;color:#059669;` +
    `display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:900;` +
    `flex-shrink:0}` +
    `.bk-au-sub{font-size:10px;color:#059669;font-weight:700;display:flex;align-items:center;gap:4px}` +
    `.bk-au-dot{width:6px;height:6px;border-radius:50%;background:#10b981;` +
    `animation:bk-au-pulse 2s cubic-bezier(.4,0,.6,1) infinite}` +
    `@keyframes bk-au-pulse{0%,100%{opacity:1}50%{opacity:.5}}` +
    `.bk-au-wa{width:24px;height:24px;border-radius:50%;background:#ecfdf5;color:#059669;` +
    `display:flex;align-items:center;justify-content:center;flex-shrink:0}` +
    `.bk-au-row{display:flex;align-items:center;gap:12px}` +
    `.bk-au-play{width:44px;height:44px;border-radius:50%;border:0;color:#fff;display:flex;` +
    `align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;` +
    `box-shadow:0 4px 6px -1px rgba(0,0,0,.1)}` +
    // The pause glyph ships in the markup and swaps on a class, so the button
    // never has to build an icon at runtime.
    `.bk-au-play .i-pause{display:none}` +
    `.bk-au-play.on .i-play{display:none}` +
    `.bk-au-play.on .i-pause{display:block}` +
    `.bk-au-mid{flex:1;display:flex;flex-direction:column;justify-content:center;min-width:0}` +
    `.bk-au-wave{height:36px;display:flex;align-items:center;gap:2.5px;cursor:pointer;` +
    `padding-top:4px;padding-bottom:4px}` +
    `.bk-au-wave span{flex:1;border-radius:999px;min-width:2px;max-width:4px;background:#cbd5e1}` +
    `.bk-au-t{display:flex;align-items:center;justify-content:space-between;font-size:11px;` +
    `font-weight:700;color:#64748b;margin-top:-2px;` +
    `font-family:ui-monospace,SFMono-Regular,Menlo,monospace}` +
    `.bk-au-sp{padding:4px 8px;background:#f1f5f9;color:#334155;font-size:10px;font-weight:700;` +
    `border-radius:8px;border:1px solid #e2e8f0;cursor:pointer;flex-shrink:0;` +
    `font-family:ui-monospace,SFMono-Regular,Menlo,monospace}` +
    `.bk-au-f{display:flex;align-items:center;justify-content:flex-end;gap:4px;margin-top:8px;` +
    `font-size:10px;color:#94a3b8;font-weight:500}` +
    `.bk-au-none{padding:16px 12px;background:#f8fafc;border-radius:12px;` +
    `border:1px dashed #e2e8f0;text-align:center}` +
    `.bk-au-none b{font-size:14px;font-weight:700;color:#64748b;display:block}` +
    `.bk-au-none i{font-size:10px;color:#94a3b8;display:block;font-style:normal;margin-top:4px}` +
    `.bk-au-c{width:100%;border-radius:16px;border:1px solid #f3f4f6;padding:20px;display:flex;` +
    `flex-direction:column;gap:12px;box-shadow:0 4px 6px -1px rgba(0,0,0,.1)}` +
    `.bk-au-c-t{font-size:12px;font-weight:900;color:#6b7280;text-transform:uppercase;` +
    `letter-spacing:.1em;text-align:center;margin-bottom:4px;overflow:hidden;` +
    `text-overflow:ellipsis;white-space:nowrap}` +
    `.bk-au-c-t.e{color:#9ca3af;font-style:italic}` +
    `.bk-au-c audio{width:100%;display:block}`,

  runtime: AUDIO_RUNTIME,

  render(block: any, ctx: BlockContext): string {
    const c = block?.content || {};

    // Same fallback chain as AudioBlockComponent: the tracks array, or the
    // legacy single-track fields promoted into one.
    const tracks: any[] = Array.isArray(c.audios) && c.audios.length
      ? c.audios
      : [{ id: 'default', title: c.title || '', url: c.url || '' }];

    const wrapStyle =
      `padding-top:${num(c.paddingTop, 16, 0, 400)}px;` +
      `padding-bottom:${num(c.paddingBottom, 16, 0, 400)}px;` +
      `margin-top:${num(c.marginTop, 0, -200, 400)}px;` +
      `margin-bottom:${num(c.marginBottom, 0, -200, 400)}px`;

    // Absent themeStyle means WhatsApp, which is every audio block in production.
    const isWhatsApp = c.themeStyle === 'whatsapp' || !c.themeStyle;
    const grid = tracks.length === 1 ? 'n1' : tracks.length === 2 ? 'n2' : 'n3';

    const cards = tracks
      .map((track, idx) => (isWhatsApp ? voiceNote(track, idx, c) : classicCard(track, idx, c)))
      .join('');

    return (
      `<div class="bk bk-au" style="${wrapStyle}">` +
      `<div class="bk-au-g ${grid}">${cards}</div></div>`
    );
  },
};

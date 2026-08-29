import { esc, safeUrl, safeColor, num } from '../escape.js';
import { VIDEO_RUNTIME } from '../runtime/video.js';
import type { BlockRenderer, BlockContext } from './types.js';

/**
 * Ported from BlockRenderer.tsx `case 'video'` (:158-181) and
 * VideoBlockComponent (:1213-1400).
 *
 * Two shapes, exactly as in React: a YouTube/Vimeo URL becomes an iframe, and
 * anything else becomes a <video> element with the buffering spinner and the
 * unmute overlay that autoplay requires.
 */

interface Embed {
  type: 'youtube' | 'vimeo';
  url: string;
}

/**
 * Recognises YouTube and Vimeo, matching getVideoEmbedUrl (BlockRenderer:1163).
 *
 * The 11-character check on the YouTube id is load-bearing: the pattern is loose
 * enough to match almost any URL containing `v/` or `embed/`, so without it a
 * plain MP4 path could be mistaken for a video id and produce a dead iframe.
 */
export function videoEmbed(
  rawUrl: string,
  o: { autoplay?: boolean; loop?: boolean; muted?: boolean; controls?: boolean }
): Embed | null {
  const url = String(rawUrl || '').trim();
  if (!url) return null;

  const yt = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/);
  if (yt && yt[2] && yt[2].length === 11) {
    const id = yt[2];
    const params = new URLSearchParams();
    if (o.autoplay) params.append('autoplay', '1');
    if (o.muted || o.autoplay) params.append('mute', '1');
    if (o.loop) {
      params.append('loop', '1');
      params.append('playlist', id);
    }
    if (o.controls === false) params.append('controls', '0');
    params.append('rel', '0');
    params.append('enablejsapi', '1');
    return { type: 'youtube', url: `https://www.youtube.com/embed/${id}?${params.toString()}` };
  }

  const vimeo = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([0-9]+)/);
  if (vimeo && vimeo[1]) {
    const params = new URLSearchParams();
    if (o.autoplay) params.append('autoplay', '1');
    if (o.muted || o.autoplay) params.append('muted', '1');
    if (o.loop) params.append('loop', '1');
    return { type: 'vimeo', url: `https://player.vimeo.com/video/${vimeo[1]}?${params.toString()}` };
  }

  return null;
}

export const videoBlock: BlockRenderer = {
  type: 'video',

  css:
    `.bk-vid{display:flex;justify-content:center;margin-left:auto;margin-right:auto}` +
    `.bk-vid-i{position:relative;overflow:hidden;width:100%;display:flex;justify-content:center;` +
    `border-radius:16px;background:#0f172a}` +
    `.bk-vid-i video{height:auto;width:100%;object-fit:contain;display:block}` +
    `.bk-vid-f{width:100%;aspect-ratio:16/9}` +
    `.bk-vid-f iframe{width:100%;height:100%;border:0;border-radius:16px;display:block}` +
    // Hidden until the runtime reveals it; a page with JS disabled therefore
    // never shows a spinner that can never resolve.
    `.bk-vid-sp{display:none;position:absolute;inset:0;align-items:center;justify-content:center;` +
    `background:rgba(0,0,0,.3);z-index:20;pointer-events:none}` +
    `.bk-vid-sp.on{display:flex}` +
    `.bk-vid-sp i{width:48px;height:48px;border-radius:50%;border:4px solid rgba(255,255,255,.2);` +
    `border-top-color:#f97316;animation:bkspin 1s linear infinite;display:block}` +
    `@keyframes bkspin{to{transform:rotate(360deg)}}` +
    `.bk-vid-un{display:none;position:absolute;inset:0;align-items:center;justify-content:center;` +
    `cursor:pointer;z-index:10;background:transparent;border:0;width:100%}` +
    `.bk-vid-un.on{display:flex}` +
    `.bk-vid-un span{padding:12px 20px;border-radius:12px;display:inline-flex;align-items:center;` +
    `gap:12px;font-weight:700;font-size:15px}`,

  runtime: VIDEO_RUNTIME,

  render(block: any, ctx: BlockContext): string {
    const c = block?.content || {};

    // Note the defaults: video padding is 16px, not 0 like every other block.
    const wrapStyle =
      `padding-top:${num(c.paddingTop, 16, 0, 400)}px;` +
      `padding-bottom:${num(c.paddingBottom, 16, 0, 400)}px;` +
      `margin-top:${num(c.marginTop, 0, -200, 400)}px;` +
      `margin-bottom:${num(c.marginBottom, 0, -200, 400)}px`;

    const rawUrl = String(c.url || '');
    if (!rawUrl) return `<div class="bk bk-vid" style="${wrapStyle}"></div>`;

    const width = c.width ? `${num(c.width, 100, 1, 100)}%` : '100%';
    const maxHeight = c.maxHeight ? `max-height:${num(c.maxHeight, 0, 1, 4000)}px;` : '';
    const boxStyle = `width:${width};${maxHeight}`;

    const autoplay = !!c.autoplay;
    const loop = !!c.loop;
    const controls = c.controls !== false;

    // Same sanitiser as the Button's href: an unusable destination becomes '',
    // and the attribute is then simply not emitted, so the runtime does nothing
    // rather than navigating somewhere unexpected.
    const redirect = safeUrl(c.redirectUrl || '');
    const redirectAttr = redirect ? ` data-vid-redirect="${esc(redirect)}"` : '';

    const embed = videoEmbed(rawUrl, { autoplay, loop, muted: !!c.muted, controls });
    if (embed) {
      // Only the two hosts we construct URLs for; safeUrl re-checks the scheme.
      const src = safeUrl(embed.url);
      if (!src) return `<div class="bk bk-vid" style="${wrapStyle}"></div>`;
      return (
        `<div class="bk bk-vid" style="${wrapStyle}">` +
        `<div class="bk-vid-i"${redirectAttr} style="${boxStyle}">` +
        `<div class="bk-vid-f"><iframe src="${esc(src)}" title="Video"` +
        ` loading="lazy"` +
        ` allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"` +
        ` allowfullscreen></iframe></div>` +
        `</div></div>`
      );
    }

    const src = safeUrl(rawUrl);
    if (!src) return `<div class="bk bk-vid" style="${wrapStyle}"></div>`;

    // Browsers only permit autoplay while muted, so autoplay forces muted on and
    // the unmute overlay is what lets the visitor turn sound on afterwards.
    const muted = autoplay || !!c.muted;

    const poster = safeUrl(c.poster || c.posterUrl || c.thumbnail || '');

    return (
      `<div class="bk bk-vid" style="${wrapStyle}">` +
      `<div class="bk-vid-i" data-vid${redirectAttr} style="${boxStyle}">` +
      // `metadata`, never `auto`: `auto` pulled the whole file during load — a
      // 2.4 MB webm was 65% of a measured page's weight and finished 3.4 s in,
      // starving the LCP image of bandwidth. `metadata` costs a few KB, still
      // yields intrinsic dimensions (so the box reserves the right height and
      // CLS stays 0), and the runtime upgrades it to `auto` on approach.
      `<video` +
      (ctx.protectVideos
        ? ` data-vsrc="${esc(src)}" controlsList="nodownload" disablepictureinpicture data-vid-protect ondragstart="return false;" oncontextmenu="return false;"`
        : ` src="${esc(src)}"`) +
      ` preload="metadata" playsinline` +
      (poster ? ` poster="${esc(poster)}"` : '') +
      (controls && !autoplay ? ' controls' : '') +
      (autoplay ? ' data-vid-auto="1"' : '') +
      (loop ? ' loop' : '') +
      (muted ? ' muted' : '') +
      (maxHeight ? ` style="${maxHeight}"` : '') +
      `></video>` +
      `<div class="bk-vid-sp" data-vid-spin><i></i></div>` +
      (autoplay
        ? `<button type="button" class="bk-vid-un" data-vid-unmute` +
          ` data-vid-controls="${controls ? 'on' : 'off'}"` +
          ` data-vid-restart="${c.restartOnUnmute ? 'on' : 'off'}"` +
          ` aria-label="Activer le son">` +
          // safeColor, not esc: these land inside a style attribute, where esc
          // stops the attribute being closed but would still let a value like
          // "red;background-image:url(...)" inject further declarations.
          `<span style="background:${safeColor(c.unmuteBtnColor, 'rgba(239,68,68,.95)')};` +
          `color:${safeColor(c.unmuteTextColor, '#ffffff')}">` +
          `${esc(c.unmuteText || 'اضغط لتشغيل الصوت')}</span></button>`
        : '') +
      `</div></div>`
    );
  },
};

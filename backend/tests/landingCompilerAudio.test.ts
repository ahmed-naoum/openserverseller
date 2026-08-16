import { describe, it, expect } from 'vitest';
import { renderDocument } from '../src/services/landingCompiler/document.js';
import { waveformBars, formatAudioTime } from '../src/services/landingCompiler/blocks/audio.js';
import { AUDIO_RUNTIME } from '../src/services/landingCompiler/runtime/audio.js';

async function render(input: any): Promise<string | null> {
  const out = await renderDocument(input as any);
  return out ? out.html : null;
}

/** The document with the runtime <script> and the stylesheet removed. */
function markup(html: string): string {
  return html.replace(/<script>[\s\S]*?<\/script>/g, '').replace(/<style>[\s\S]*?<\/style>/g, '');
}

/**
 * The subtree of the first <div> carrying `attr`, i.e. exactly what
 * `root.querySelector(...)` can reach from that element.
 *
 * Counting <div> depth is enough here because the hook always lands on a div and
 * nothing nested inside it (svg, span, button, audio) opens one.
 */
function scopeOf(html: string, attr: string): string {
  const start = html.indexOf(`<div class="bk-au-w" ${attr}`);
  if (start === -1) throw new Error(`no <div> carrying ${attr}`);

  let depth = 0;
  let i = start;
  while (i < html.length) {
    const open = html.indexOf('<div', i);
    const close = html.indexOf('</div>', i);
    if (close === -1) break;
    if (open !== -1 && open < close) {
      depth++;
      i = open + 4;
    } else {
      depth--;
      if (depth === 0) return html.slice(start, close + 6);
      i = close + 6;
    }
  }
  throw new Error(`unbalanced markup for ${attr}`);
}

function withAudio(content: any) {
  return render({
    code: 'CODE1',
    blocks: [{ id: 'a1', type: 'audio', content }],
    settings: {},
    landingPage: { themeColor: '#f97316', title: 'T', description: 'D' },
    product: { nameFr: 'P', retailPriceMad: 249, images: [] },
    influencerPixels: [],
    origin: 'https://sub.silacod.com',
  });
}

const TRACK = { id: '1', url: '/uploads/a.mp3', title: 'clien 1' };

describe('waveformBars', () => {
  it('produces 32 bars inside the clamp', () => {
    for (const seed of ['1', 'qrtz5gt', '/uploads/a.mp3', 0, '']) {
      const bars = waveformBars(seed);
      expect(bars, `for ${JSON.stringify(seed)}`).toHaveLength(32);
      for (const h of bars) {
        expect(h).toBeGreaterThanOrEqual(5);
        expect(h).toBeLessThanOrEqual(32);
      }
    }
  });

  it('is deterministic and seed-dependent', () => {
    expect(waveformBars('1')).toEqual(waveformBars('1'));
    expect(waveformBars('1')).not.toEqual(waveformBars('2'));
  });

  it('matches the React hash on a long id, where the 32-bit truncation bites', () => {
    // getWaveformBars does `hash |= 0` every iteration. Without it the running
    // value leaves the safe-integer range on a long seed and every bar drifts.
    const seed = '/uploads/8135dd0b-0659-4ad2-ba95-e1e4dc3f79ae.mp3';
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    const base = [
      6, 14, 22, 10, 18, 28, 34, 20, 12, 24, 30, 18, 10, 26, 32, 28, 14, 22, 28, 20, 10, 16, 26,
      32, 18, 8, 14, 24, 18, 10, 6, 12,
    ];
    const expected = base.map((h, i) =>
      Math.max(5, Math.min(32, h + ((Math.abs(hash + i * 19) % 9) - 4)))
    );
    expect(waveformBars(seed)).toEqual(expected);
  });

  it('falls back to the "audio" seed for a falsy one, as React does', () => {
    expect(waveformBars(0)).toEqual(waveformBars('audio'));
    expect(waveformBars('')).toEqual(waveformBars('audio'));
  });
});

describe('formatAudioTime', () => {
  it('pads seconds and floors', () => {
    expect(formatAudioTime(0)).toBe('0:00');
    expect(formatAudioTime(5)).toBe('0:05');
    expect(formatAudioTime(65)).toBe('1:05');
    expect(formatAudioTime(3599)).toBe('59:59');
    expect(formatAudioTime(35.9)).toBe('0:35');
  });

  it('answers 0:00 for the states an unloaded <audio> reports', () => {
    for (const v of [NaN, -1, undefined, null, Infinity, 'x']) {
      expect(formatAudioTime(v), `for ${String(v)}`).toBe('0:00');
    }
  });
});

describe('audio block — whatsapp voice note', () => {
  it('renders the bubble when themeStyle is absent, which is every live block', async () => {
    const html = (await withAudio({ audios: [TRACK] }))!;
    expect(html).toContain('data-au');
    expect(html).toContain('data-au-play');
    expect(html).toContain('data-au-wave');
    expect(html).toContain('src="/uploads/a.mp3"');
    // The plain card must NOT appear.
    expect(markup(html)).not.toContain('bk-au-c-t');
  });

  it('emits 32 bars per track with baked heights', async () => {
    const html = (await withAudio({ audios: [TRACK] }))!;
    const bars = [...markup(html).matchAll(/<span style="height:(\d+)px"><\/span>/g)];
    expect(bars).toHaveLength(32);
    expect(bars.map((m) => Number(m[1]))).toEqual(waveformBars('1'));
  });

  it('autoplays only the first track', async () => {
    const html = (await withAudio({
      autoplay: true,
      audios: [TRACK, { id: '2', url: '/uploads/b.mp3', title: 't2' }],
    }))!;
    const tags = [...markup(html).matchAll(/<audio [^>]*>/g)].map((m) => m[0]);
    expect(tags).toHaveLength(2);
    expect(tags[0]).toContain(' autoplay');
    expect(tags[1]).not.toContain(' autoplay');
  });

  it('carries loop onto every track', async () => {
    const html = (await withAudio({ loop: true, audios: [TRACK] }))!;
    expect(markup(html)).toMatch(/<audio [^>]*\sloop/);
  });

  it('picks the column ladder from the track count', async () => {
    expect((await withAudio({ audios: [TRACK] }))!).toContain('bk-au-g n1');
    expect((await withAudio({ audios: [TRACK, TRACK] }))!).toContain('bk-au-g n2');
    expect((await withAudio({ audios: [TRACK, TRACK, TRACK] }))!).toContain('bk-au-g n3');
    expect((await withAudio({ audios: Array(8).fill(TRACK) }))!).toContain('bk-au-g n3');
  });

  it('falls back to the legacy single-track fields', async () => {
    const html = (await withAudio({ url: '/uploads/legacy.mp3', title: 'Vieux' }))!;
    expect(html).toContain('src="/uploads/legacy.mp3"');
    expect(html).toContain('Vieux');
  });

  it('shows the placeholder and no <audio> for a track with no file', async () => {
    const html = (await withAudio({ audios: [{ id: '3', url: '', title: 'Audio 3' }] }))!;
    expect(markup(html)).not.toContain('<audio');
    expect(html).toContain('bk-au-none');
    // Still a bubble, so the layout does not collapse.
    expect(html).toContain('bk-au-b');
    // ...but nothing for the runtime to bind: no track, no hook.
    expect(markup(html)).not.toContain('data-au ');
  });

  it('names the sender from the track, falling back to Client N', async () => {
    expect((await withAudio({ audios: [TRACK] }))!).toContain('clien 1');
    const unnamed = (await withAudio({ audios: [{ id: 'x', url: '/uploads/a.mp3' }] }))!;
    expect(unnamed).toContain('Client 1');
  });

  it('ships the track duration as a placeholder until metadata loads', async () => {
    expect((await withAudio({ audios: [TRACK] }))!).toContain('data-au-dur>0:35<');
    const known = (await withAudio({ audios: [{ ...TRACK, duration: 95 }] }))!;
    expect(known).toContain('data-au-dur>1:35<');
  });

  it('honours the speed and checkmark toggles', async () => {
    expect((await withAudio({ audios: [TRACK] }))!).toContain('data-au-speed');
    const off = (await withAudio({ audios: [TRACK], showSpeedToggle: false, showCheckmarks: false }))!;
    expect(markup(off)).not.toContain('data-au-speed');
    expect(markup(off)).not.toContain('fill="#0ea5e9"');
  });
});

describe('audio block — safety', () => {
  it('rejects a javascript: track url', async () => {
    const html = (await withAudio({ audios: [{ id: '1', url: 'javascript:alert(1)' }] }))!;
    expect(html).not.toContain('javascript:');
    expect(markup(html)).not.toContain('<audio');
  });

  it('rejects an injected colour rather than letting it close the declaration', async () => {
    const html = (await withAudio({
      audios: [TRACK],
      bubbleColor: 'red;background-image:url(https://evil.example/x)',
      playBtnColor: '#25D366',
    }))!;
    expect(html).not.toContain('evil.example');
    expect(html).toContain('background:#ffffff');
  });

  it('escapes the sender name and timestamp', async () => {
    const html = (await withAudio({
      audios: [{ id: '1', url: '/uploads/a.mp3', title: '"><script>alert(1)</script>', time: '<b>x' }],
    }))!;
    expect(html).not.toContain('<script>alert(1)');
    expect(html).not.toContain('<b>x');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes the active-wave colour it hands the runtime', async () => {
    const html = (await withAudio({ audios: [TRACK], activeWaveColor: '" onload="alert(1)' }))!;
    expect(html).not.toContain('onload=');
    expect(html).toContain('data-au-active="#34B7F1"');
  });
});

describe('audio block — classic theme', () => {
  it('renders the plain card when themeStyle asks for something else', async () => {
    const html = (await withAudio({ themeStyle: 'classic', audios: [TRACK] }))!;
    expect(html).toContain('bk-au-c-t');
    expect(html).toContain('controlsList="nodownload"');
    expect(markup(html)).not.toContain('data-au-play');
  });

  it('numbers an untitled track', async () => {
    const html = (await withAudio({
      themeStyle: 'classic',
      audios: [{ id: '1', url: '/uploads/a.mp3' }],
    }))!;
    expect(html).toContain('Audio 1');
  });

  it('drops controls only on an explicit false', async () => {
    expect((await withAudio({ themeStyle: 'classic', audios: [TRACK] }))!).toMatch(
      /<audio [^>]*\scontrols/
    );
    const off = (await withAudio({ themeStyle: 'classic', audios: [TRACK], controls: false }))!;
    expect(markup(off)).not.toMatch(/<audio [^>]*\scontrols[\s>]/);
  });
});

describe('audio block — page integration', () => {
  it('lets a page with an audio block compile alongside other blocks', async () => {
    const out = await render({
      code: 'CODE1',
      blocks: [
        { id: 'a1', type: 'audio', content: { audios: [TRACK] } },
        { id: 'c1', type: 'express_checkout', content: {} },
        { id: 'b1', type: 'button', content: { text: 'Acheter' } },
      ],
      settings: {},
      landingPage: { themeColor: '#f97316', title: 'T', description: 'D' },
      product: { nameFr: 'P', retailPriceMad: 249, images: [] },
      influencerPixels: [],
      origin: 'https://sub.silacod.com',
    });
    expect(out).toBeTruthy();
    expect(out).toContain('data-au');
    expect(out).toContain('data-ck-root');
  });

  it('emits one stylesheet and one runtime however many audio blocks there are', async () => {
    const out = (await render({
      code: 'CODE1',
      blocks: [
        { id: 'a1', type: 'audio', content: { audios: [TRACK] } },
        { id: 'a2', type: 'audio', content: { audios: [TRACK] } },
      ],
      settings: {},
      landingPage: { themeColor: '#f97316', title: 'T', description: 'D' },
      product: { nameFr: 'P', retailPriceMad: 249, images: [] },
      influencerPixels: [],
      origin: 'https://sub.silacod.com',
    }))!;
    expect(out.split('.bk-au-wave span{').length - 1).toBe(1);
    expect(out.split('data-au-wave]').length - 1).toBe(1);
  });
});

describe('audio runtime', () => {
  it('is syntactically valid JavaScript', () => {
    expect(() => new Function(AUDIO_RUNTIME)).not.toThrow();
  });

  it('carries no unexpanded template placeholders', () => {
    expect(AUDIO_RUNTIME).not.toMatch(/\$\{/);
  });

  it('queries only hooks the renderer emits', async () => {
    const html = (await withAudio({ audios: [TRACK] }))!;
    const hooks = [...AUDIO_RUNTIME.matchAll(/\[data-au[a-z-]*\]/g)].map((m) => m[0]);
    expect(hooks.length).toBeGreaterThan(0);
    for (const hook of new Set(hooks)) {
      expect(html, `runtime queries ${hook}`).toContain(hook.slice(1, -1));
    }
  });

  it('scopes every lookup inside the element it binds to', async () => {
    // The bug this exists for: data-au sat on the bubble while the <audio> was
    // its sibling, so `root.querySelector('audio')` found nothing and init()
    // bailed before wiring a single listener. Every play button on every page
    // was dead, and presence-only assertions could not see it — the hooks were
    // all in the document, just not in the runtime's scope.
    const html = (await withAudio({ audios: [TRACK] }))!;
    const scope = scopeOf(html, 'data-au ');

    expect(scope, 'the <audio> the runtime drives').toContain('<audio');
    const hooks = [...AUDIO_RUNTIME.matchAll(/\[data-au[a-z-]*\]/g)].map((m) => m[0]);
    for (const hook of new Set(hooks)) {
      expect(scope, `root.querySelector(${hook}) must resolve`).toContain(hook.slice(1, -1));
    }
  });

  it('reads the active colour from the element rather than baking one in', () => {
    // Each bubble carries its own colour, so a page with two differently themed
    // blocks cannot be served by a runtime holding a single constant.
    expect(AUDIO_RUNTIME).toContain("getAttribute('data-au-active')");
  });

  it('cycles 1x, 1.5x and 2x like the React button', () => {
    expect(AUDIO_RUNTIME).toContain('[1, 1.5, 2]');
  });
});

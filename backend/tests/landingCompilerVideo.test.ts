import { describe, it, expect } from 'vitest';
import { renderDocument } from '../src/services/landingCompiler/document.js';
import { videoEmbed } from '../src/services/landingCompiler/blocks/video.js';
import { VIDEO_RUNTIME } from '../src/services/landingCompiler/runtime/video.js';

async function render(input: any): Promise<string | null> {
  const out = await renderDocument(input as any);
  return out ? out.html : null;
}

/**
 * The document with the runtime <script> removed.
 *
 * The runtime contains its own selector strings, so asserting against the whole
 * document would match the JavaScript looking for an element rather than the
 * element itself.
 */
function markup(html: string): string {
  return html.replace(/<script>[\s\S]*?<\/script>/g, '');
}

function withVideo(content: any) {
  return render({
    code: 'CODE1',
    blocks: [{ id: 'v1', type: 'video', content }],
    settings: {},
    landingPage: { themeColor: '#f97316', title: 'T', description: 'D' },
    product: { nameFr: 'P', retailPriceMad: 249, images: [] },
    influencerPixels: [],
    origin: 'https://sub.silacod.com',
  });
}

describe('videoEmbed', () => {
  it('recognises the YouTube URL shapes the builder accepts', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    ]) {
      const embed = videoEmbed(url, {});
      expect(embed, url).toBeTruthy();
      expect(embed!.type).toBe('youtube');
      expect(embed!.url).toContain('/embed/dQw4w9WgXcQ');
    }
  });

  it('recognises Vimeo', () => {
    const embed = videoEmbed('https://vimeo.com/123456789', {});
    expect(embed!.type).toBe('vimeo');
    expect(embed!.url).toContain('player.vimeo.com/video/123456789');
  });

  it('does not mistake an uploaded file for an embed', () => {
    // The YouTube pattern matches almost any URL containing "v/" or "embed/";
    // only the 11-character id check keeps an MP4 path out of an iframe.
    expect(videoEmbed('/uploads/videos/promo.mp4', {})).toBeNull();
    expect(videoEmbed('https://cdn.example.com/v/short.mp4', {})).toBeNull();
  });

  it('forces mute when autoplay is on, because browsers require it', () => {
    const embed = videoEmbed('https://youtu.be/dQw4w9WgXcQ', { autoplay: true });
    expect(embed!.url).toContain('autoplay=1');
    expect(embed!.url).toContain('mute=1');
  });

  it('sets the playlist parameter when looping, or YouTube ignores loop', () => {
    const embed = videoEmbed('https://youtu.be/dQw4w9WgXcQ', { loop: true });
    expect(embed!.url).toContain('loop=1');
    expect(embed!.url).toContain('playlist=dQw4w9WgXcQ');
  });
});

describe('video block', () => {
  it('renders an iframe for YouTube and no <video> element', async () => {
    const html = (await withVideo({ url: 'https://youtu.be/dQw4w9WgXcQ' }))!;
    expect(html).toContain('<iframe');
    expect(html).toContain('youtube.com/embed/dQw4w9WgXcQ');
    expect(html).not.toContain('<video');
  });

  it('renders a <video> element for an uploaded file', async () => {
    const html = (await withVideo({ url: '/uploads/videos/promo.mp4' }))!;
    expect(html).toContain('<video src="/uploads/videos/promo.mp4"');
    expect(html).toContain('playsinline');
    expect(html).not.toContain('<iframe');
  });

  it('mutes an autoplaying video and withholds controls behind the overlay', async () => {
    const html = (await withVideo({ url: '/uploads/v.mp4', autoplay: true }))!;
    expect(html).toMatch(/<video[^>]*\smuted/);
    expect(html).toMatch(/<video[^>]*\sautoplay/);
    // React hides the native controls while the unmute prompt is up.
    expect(html).not.toMatch(/<video[^>]*\scontrols/);
    expect(html).toContain('data-vid-unmute');
  });

  it('shows controls and no overlay when autoplay is off', async () => {
    const html = (await withVideo({ url: '/uploads/v.mp4' }))!;
    expect(html).toMatch(/<video[^>]*\scontrols/);
    expect(markup(html)).not.toContain('data-vid-unmute');
  });

  it('honours controls:false', async () => {
    const html = (await withVideo({ url: '/uploads/v.mp4', controls: false }))!;
    expect(html).not.toMatch(/<video[^>]*\scontrols/);
  });

  it('uses the block default of 16px vertical padding, not 0', async () => {
    const html = (await withVideo({ url: '/uploads/v.mp4' }))!;
    expect(html).toContain('padding-top:16px');
    expect(html).toContain('padding-bottom:16px');
  });

  it('rejects a javascript: source', async () => {
    const html = (await withVideo({ url: 'javascript:alert(1)' }))!;
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<video');
  });

  it('keeps injected colours out of the style attribute', async () => {
    const html = (await withVideo({
      url: '/uploads/v.mp4',
      autoplay: true,
      unmuteBtnColor: 'red;background-image:url(https://evil.example/beacon)',
    }))!;
    expect(html).not.toContain('evil.example');
    // Falls back to the default rather than dropping the declaration entirely.
    expect(html).toContain('rgba(239,68,68,.95)');
  });

  it('emits one runtime for a page with several videos', async () => {
    const html = (await render({
      code: 'CODE1',
      blocks: [
        { id: 'v1', type: 'video', content: { url: '/uploads/a.mp4' } },
        { id: 'v2', type: 'video', content: { url: '/uploads/b.mp4' } },
      ],
      settings: {},
      landingPage: { themeColor: '#f97316', title: 'T', description: 'D' },
      product: { nameFr: 'P', images: [] },
      influencerPixels: [],
      origin: 'https://sub.silacod.com',
    }))!;
    expect((markup(html).match(/data-vid(?![-a-z])/g) || []).length).toBe(2);
    expect((html.match(/<script>/g) || []).length).toBe(1);
  });
});

describe('video runtime', () => {
  it('is syntactically valid JavaScript', () => {
    expect(() => new Function(VIDEO_RUNTIME)).not.toThrow();
  });

  it('carries no unexpanded template placeholders', () => {
    expect(VIDEO_RUNTIME).not.toMatch(/\$\{/);
  });

  it('queries only hooks the renderer emits', async () => {
    const html = (await withVideo({ url: '/uploads/v.mp4', autoplay: true }))!;
    for (const hook of ['data-vid', 'data-vid-spin', 'data-vid-unmute']) {
      expect(VIDEO_RUNTIME, hook).toContain(hook);
      expect(html, hook).toContain(hook);
    }
  });
});

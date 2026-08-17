import { describe, it, expect } from 'vitest';
import { renderDocument } from '../src/services/landingCompiler/document.js';
import { SLIDER_RUNTIME } from '../src/services/landingCompiler/runtime/slider.js';
import { startIndices } from '../src/services/landingCompiler/blocks/slider.js';

async function render(blocks: any[]): Promise<string | null> {
  const out = await renderDocument({
    code: 'CODE1',
    blocks,
    settings: {},
    landingPage: { themeColor: '#f97316', title: 'T', description: 'D' },
    product: { nameFr: 'P', retailPriceMad: 249, images: [] },
    influencerPixels: [],
    origin: 'https://sub.silacod.com',
  } as any);
  return out ? out.html : null;
}

const slider = (content: any) => render([{ id: 's1', type: 'slider', content }]);

/** The document with the stylesheet removed, so rules cannot satisfy an assertion. */
function markup(html: string): string {
  return html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<script>[\s\S]*?<\/script>/g, '');
}

const SLIDES = [
  { title: 'Carte 1', description: 'Une', mediaUrl: '/uploads/a.webp' },
  { title: 'Carte 2', description: 'Deux', mediaUrl: '' },
];

/** The shape every live slider has today: two cards, one per view, autoplaying. */
const LIVE = {
  slides: SLIDES,
  cardBg: '#ffffff',
  cardGap: 16,
  autoPlay: true,
  dotColor: '#f97316',
  showDots: true,
  showArrows: true,
  descColor: '#6b7280',
  titleColor: '#111827',
  cardRadius: 20,
  cardShadow: 'md',
  cardsPerView: 1,
  mediaHeight: 280,
  autoPlaySpeed: 4000,
  paddingTop: 24,
  paddingBottom: 24,
};

describe('startIndices', () => {
  it('steps one card at a time, stopping where the last full view begins', () => {
    expect(startIndices(5, 2, 'card')).toEqual([0, 1, 2, 3]);
  });

  it('clamps the last page so it is always full, and drops the repeat that causes', () => {
    // i = 0, 2, 4 -> 4 clamps to 3, which is new; a sixth slide would make the
    // clamped value 4 and the page count 3 either way.
    expect(startIndices(5, 2, 'page')).toEqual([0, 2, 3]);
  });

  it('never returns an empty list, even with fewer slides than a view holds', () => {
    expect(startIndices(1, 3, 'card')).toEqual([0]);
    expect(startIndices(0, 1, 'card')).toEqual([0]);
  });
});

describe('slider block', () => {
  it('renders one card per slide, with its copy', async () => {
    const html = markup((await slider(LIVE))!);
    expect(html.split('class="bk-sl-c').length - 1).toBe(2);
    expect(html).toContain('Carte 1');
    expect(html).toContain('Une');
    expect(html).toContain('Carte 2');
  });

  it('omits a heading or paragraph the slide does not have', async () => {
    const html = markup((await slider({ slides: [{ mediaUrl: '/uploads/a.webp' }] }))!);
    expect(html).not.toContain('<h3');
    expect(html).not.toContain('<p ');
  });

  it('renders an image for a picture and a muted looping video for a clip', async () => {
    const img = markup((await slider({ slides: [{ mediaUrl: '/uploads/a.webp' }] }))!);
    expect(img).toContain('<img src="/uploads/a.webp"');
    // Which of eager and lazy this one gets is the loading test's subject.
    expect(img).toMatch(/loading="(eager|lazy)"/);

    const vid = markup((await slider({ slides: [{ mediaUrl: '/uploads/a.mp4' }] }))!);
    expect(vid).toContain('<video src="/uploads/a.mp4"');
    expect(vid).toContain('autoplay loop muted playsinline');
  });

  it('leaves the media box out when the slide has no media at all', async () => {
    const html = markup((await slider({ slides: [{ title: 'x' }] }))!);
    expect(html).not.toContain('bk-sl-m');
  });

  it('keeps the box, empty, when the media URL exists but is not servable', async () => {
    // React keys the wrapper on the field being truthy, not on it being usable,
    // so dropping the box here would close a gap the React page still leaves.
    const html = markup((await slider({ slides: [{ mediaUrl: 'javascript:alert(1)' }] }))!);
    expect(html).toContain('bk-sl-m');
    expect(html).not.toContain('javascript:');
  });

  it('renders nothing but its spacing for a slider with no cards', async () => {
    // React draws the builder's dashed "Aucune carte" panel here. A customer
    // must not be shown it — the same call image.ts makes.
    const html = markup((await slider({ slides: [], paddingTop: 24, marginBottom: 8 }))!);
    expect(html).not.toContain('Aucune carte');
    expect(html).toContain('<div class="bk bk-sl" style="padding-top:24px');
    expect(html).toContain('margin-bottom:8px');
  });

  it('applies the block spacing defaults, 24px top and bottom', async () => {
    const html = (await slider({ slides: SLIDES }))!;
    expect(html).toContain('padding-top:24px;padding-bottom:24px;margin-top:0px;margin-bottom:0px');
  });
});

describe('slider navigation', () => {
  it('gives one dot per page and a counter that starts at the first', async () => {
    const html = markup((await slider({ ...LIVE, slides: [...SLIDES, ...SLIDES] }))!);
    expect(html.split('data-sl-dot').length - 1).toBe(4);
    expect(html).toContain('1 / 4');
  });

  it('pages by view when slideBy is page', async () => {
    const html = markup(
      (await slider({ ...LIVE, cardsPerView: 2, slideBy: 'page', slides: [...SLIDES, ...SLIDES, SLIDES[0]] }))!
    );
    expect(html.split('data-sl-dot').length - 1).toBe(3);
    expect(html).toContain('data-sl-by="page"');
  });

  it('hides the arrows, dots and counter when everything already fits', async () => {
    const html = markup((await slider({ ...LIVE, slides: [SLIDES[0]] }))!);
    expect(html).not.toContain('data-sl-prev');
    expect(html).not.toContain('data-sl-dot');
    expect(html).not.toContain('bk-sl-n');
  });

  it('honours the two visibility toggles independently', async () => {
    const noArrows = markup((await slider({ ...LIVE, showArrows: false }))!);
    expect(noArrows).not.toContain('data-sl-prev');
    expect(noArrows).toContain('data-sl-dot');

    const noDots = markup((await slider({ ...LIVE, showDots: false }))!);
    expect(noDots).toContain('data-sl-prev');
    expect(noDots).not.toContain('data-sl-dot');
    // The counter is not gated on the dots in React, and is not here either.
    expect(noDots).toContain('1 / 2');
  });

  it('passes the autoplay settings to the runtime', async () => {
    expect((await slider(LIVE))!).toContain('data-sl-auto="on" data-sl-speed="4000"');
    expect((await slider({ ...LIVE, autoPlay: false, autoPlaySpeed: 9000 }))!).toContain(
      'data-sl-auto="off" data-sl-speed="9000"'
    );
    // `content.autoPlaySpeed || 4000`, so a stored 0 is 4000 rather than a
    // timer that fires every millisecond.
    expect((await slider({ ...LIVE, autoPlaySpeed: 0 }))!).toContain('data-sl-speed="4000"');
  });
});

describe('slider layout and geometry', () => {
  it('sizes a card by the space its neighbours leave', async () => {
    const html = (await slider({ ...LIVE, cardsPerView: 3, cardGap: 24 }))!;
    // 24 * (3 - 1) / 3
    expect(html).toContain('--sl-w:calc(100% / 3 - 16px)');
    expect(html).toContain('data-sl-per="3" data-sl-gap="24"');
  });

  it('drops the type one step above two cards per view', async () => {
    expect((await slider({ ...LIVE, cardsPerView: 2 }))!).not.toContain('bk-sl sm');
    expect((await slider({ ...LIVE, cardsPerView: 3 }))!).toContain('bk-sl sm');
  });

  it('applies fade only at one card per view, and marks the first card shown', async () => {
    const one = markup((await slider({ ...LIVE, transitionEffect: 'fade' }))!);
    expect(one).toContain('data-sl-fade="on"');
    expect(one).toContain('class="bk-sl-i is-on"');

    const two = (await slider({ ...LIVE, cardsPerView: 2, transitionEffect: 'fade' }))!;
    expect(two).toContain('data-sl-fade="off"');
  });

  it('marks the cards a zoom slider starts with as visible', async () => {
    const html = markup(
      (await slider({ ...LIVE, cardsPerView: 2, transitionEffect: 'zoom', slides: [...SLIDES, ...SLIDES] }))!
    );
    expect(html.split('class="bk-sl-i is-vis"').length - 1).toBe(2);
    expect(html).toContain('data-sl-zoom="on"');
  });

  it('takes the media height from the block, or lets it fill the card', async () => {
    expect((await slider({ ...LIVE, mediaHeight: 400 }))!).toContain('style="height:400px"');
    // `content.mediaHeight || 280`: a stored 0 is 280.
    expect((await slider({ ...LIVE, mediaHeight: 0 }))!).toContain('style="height:280px"');
    const full = (await slider({ ...LIVE, mediaHeight100: true }))!;
    expect(full).toContain('style="height:100%"');
    expect(full).toContain('bk-sl-m gr');
  });

  it('maps the shadow names React uses, not the Tailwind ones they resemble', async () => {
    expect((await slider({ ...LIVE, cardShadow: 'none' }))!).toContain('class="bk-sl-c"');
    expect((await slider({ ...LIVE, cardShadow: 'sm' }))!).toContain('bk-sl-c sh-s');
    expect((await slider({ ...LIVE, cardShadow: 'md' }))!).toContain('bk-sl-c sh-m');
    expect((await slider({ ...LIVE, cardShadow: 'lg' }))!).toContain('bk-sl-c sh-l');
    expect((await slider({ ...LIVE, cardShadow: 'xl' }))!).toContain('bk-sl-c sh-x');
  });

  it('aligns the card copy the way the block asks, defaulting to left', async () => {
    // SiteBuilderV2 and every template write 'center' into a new slider; V1
    // writes 'left'. Both reach the element React puts the style on.
    expect((await slider({ ...LIVE, textAlign: 'center' }))!).toContain('--sl-ta:center');
    expect((await slider({ ...LIVE, textAlign: 'right' }))!).toContain('--sl-ta:right');
    expect((await slider(LIVE))!).toContain('--sl-ta:left');
    // A marquee card carries the same style in React, so it does here too.
    expect(
      (await slider({ ...LIVE, autoplayMode: 'marquee', textAlign: 'center' }))!
    ).toContain('--sl-ta:center');
  });

  it('refuses an alignment outside the three the builder can write', async () => {
    const html = (await slider({ ...LIVE, textAlign: 'left;position:fixed' }))!;
    expect(html).toContain('--sl-ta:left;');
    expect(html).not.toContain('position:fixed');
  });

  it('loads the cards on screen eagerly and the rest lazily', async () => {
    // React sets no loading attribute at all, so a lazy first card would make
    // the compiled page slower than the one it replaces.
    const html = markup(
      (await render([
        {
          id: 's1',
          type: 'slider',
          content: {
            ...LIVE,
            cardsPerView: 1,
            slides: [
              { title: 'A', mediaUrl: '/uploads/a.webp' },
              { title: 'B', mediaUrl: '/uploads/b.webp' },
            ],
          },
        },
      ]))!
    );
    expect(html.split('loading="eager"').length - 1).toBe(1);
    expect(html.split('loading="lazy"').length - 1).toBe(1);
    expect(html.split('fetchpriority="high"').length - 1).toBe(1);
  });

  it('lazy-loads every card of a slider that opens below the fold', async () => {
    const html = markup(
      (await render([
        { id: 'a', type: 'spacer', content: {} },
        { id: 'b', type: 'spacer', content: {} },
        { id: 's1', type: 'slider', content: LIVE },
      ]))!
    );
    expect(html).not.toContain('loading="eager"');
    expect(html).not.toContain('fetchpriority=');
    expect(html).toContain('loading="lazy"');
  });

  it('draws the border only when one was asked for', async () => {
    expect((await slider({ ...LIVE, cardBorderWidth: 0 }))!).toContain('border:none');
    expect((await slider({ ...LIVE, cardBorderWidth: 15, cardBorderColor: '#1354d8' }))!).toContain(
      'border:15px solid #1354d8'
    );
  });
});

describe('slider marquee mode', () => {
  const MARQUEE = { ...LIVE, autoplayMode: 'marquee', marqueeSpeed: 33, cardsPerView: 3 };

  it('emits three copies of the slides so the loop closes on itself', async () => {
    const html = markup((await slider(MARQUEE))!);
    expect(html.split('class="bk-sl-mi"').length - 1).toBe(6);
    expect(html).toContain('bk-sl-mt');
    expect(html).toContain('--sl-dur:33s');
  });

  it('has no arrows, dots or counter to drive', async () => {
    const html = markup((await slider(MARQUEE))!);
    expect(html).not.toContain('data-sl-prev');
    expect(html).not.toContain('data-sl-dot');
    expect(html).not.toContain('bk-sl-n');
    expect(html).toContain('data-sl-mq="on"');
  });

  it('pauses on hover unless the block opts out', async () => {
    expect(markup((await slider(MARQUEE))!)).toContain('bk-sl-mt pz');
    expect(markup((await slider({ ...MARQUEE, pauseOnHover: false }))!)).toContain('class="bk-sl-mt"');
  });

  it('sizes a marquee card against the viewport, capped at 900px of track', async () => {
    const html = (await slider(MARQUEE))!;
    expect(html).toContain('--sl-w:calc((100vw - 32px) / 3 - 10.666666666666666px)');
    expect(html).toContain('--sl-mw:calc(900px / 3 - 10.666666666666666px)');
  });
});

describe('slider entrance animation', () => {
  it('stages the cards and staggers them', async () => {
    const html = (await slider({ ...LIVE, entranceAnimation: 'fade-up' }))!;
    expect(html).toContain('ent ent-fu');
    expect(html).toContain('data-sl-ent="on"');
    expect(html).toContain('animation-delay:0.12s');
  });

  it('uses the marquee stagger inside a marquee', async () => {
    const html = (await slider({ ...LIVE, autoplayMode: 'marquee', entranceAnimation: 'zoom-in' }))!;
    expect(html).toContain('ent ent-zi');
    expect(html).toContain('animation-delay:0.1s');
  });

  it('shows the cards anyway when the observer will never run', async () => {
    // The rule that hides them is CSS; without this a browser with JS disabled
    // would be left looking at an empty block forever.
    const html = (await slider({ ...LIVE, entranceAnimation: 'fade-in' }))!;
    expect(html).toContain('<noscript><style>.bk-sl.ent .bk-sl-c{opacity:1}</style></noscript>');
  });

  it('adds neither the class nor the fallback when no animation was chosen', async () => {
    const html = (await slider(LIVE))!;
    // Stripped, because the sheet carries the `ent-*` rules whether or not any
    // block on the page uses them.
    expect(markup(html)).not.toContain('ent-');
    expect(html).not.toContain('<noscript><style>');
    expect(html).toContain('data-sl-ent="off"');
  });
});

describe('slider escaping', () => {
  it('escapes the card copy', async () => {
    const html = (await slider({
      slides: [{ title: '"><script>alert(1)</script>', description: '<img src=x onerror=alert(2)>' }],
    }))!;
    expect(html).not.toContain('<script>alert(1)');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
  });

  it('rejects an injected colour rather than letting it close the declaration', async () => {
    const html = (await slider({
      ...LIVE,
      cardBg: 'red;background-image:url(https://evil.example/x)',
      titleColor: '#111827',
    }))!;
    expect(html).not.toContain('evil.example');
    expect(html).toContain('background:#ffffff');
  });

  it('only builds the 8-digit glow from a colour that can carry alpha', async () => {
    expect((await slider({ ...LIVE, hoverEffect: 'glow', dotColor: '#f97316' }))!).toContain(
      '--sl-glow:#f9731666'
    );
    // rgb() cannot take a hex suffix; appending one would drop the shadow.
    expect((await slider({ ...LIVE, hoverEffect: 'glow', dotColor: 'rgb(1,2,3)' }))!).toContain(
      '--sl-glow:rgb(1,2,3)'
    );
  });
});

describe('slider runtime', () => {
  it('is syntactically valid JavaScript', () => {
    expect(() => new Function(SLIDER_RUNTIME)).not.toThrow();
  });

  it('carries no unexpanded template placeholders', () => {
    expect(SLIDER_RUNTIME).not.toMatch(/\$\{/);
  });

  it('queries only hooks the renderer emits', async () => {
    const html = (await slider(LIVE))!;
    for (const hook of ['[data-sl-track]', '[data-sl-dot]', '[data-sl-prev]', '[data-sl-next]', '[data-sl-n]']) {
      expect(SLIDER_RUNTIME, `runtime queries ${hook}`).toContain(hook);
      expect(html, `markup provides ${hook}`).toContain(hook.slice(1, -1));
    }
  });
});

describe('slider — page integration', () => {
  it('ships one sheet and one runtime however many sliders a page has', async () => {
    const html = (await render([
      { id: 's1', type: 'slider', content: LIVE },
      { id: 's2', type: 'slider', content: { ...LIVE, autoplayMode: 'marquee' } },
    ]))!;
    expect(html.split('.bk-sl{position:relative').length - 1).toBe(1);
    expect(html.split("document.querySelectorAll('[data-sl]')").length - 1).toBe(1);
  });

  it('is absent entirely from a page with no slider', async () => {
    const html = (await render([{ id: 'h1', type: 'hero', content: {} }]))!;
    expect(html).not.toContain('bk-sl');
    expect(html).not.toContain('data-sl');
  });

  it('compiles alongside the blocks it shares pages with', async () => {
    const html = await render([
      { id: 's1', type: 'slider', content: LIVE },
      { id: 'i1', type: 'image', content: { url: '/uploads/a.webp' } },
      { id: 'c1', type: 'express_checkout', content: {} },
    ]);
    expect(html).toBeTruthy();
    expect(html).toContain('bk-sl-c');
    expect(html).toContain('data-ck-root');
  });
});

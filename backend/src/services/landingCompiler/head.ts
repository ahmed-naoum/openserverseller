import { esc, safeUrl, jsonForScript } from './escape.js';

/**
 * The `<head>` of a compiled landing page.
 *
 * The whole point of this project lives here: the pixel bootstrap is the first
 * script in the document, so `fbq('track','PageView')` runs while the parser is
 * still reading the page rather than after a framework has booted and fetched
 * data. Everything else in this file is in service of not delaying that.
 */

export interface ActivePixel {
  platform: string;
  pixelId: string;
  conversionEvent: string;
}

export interface HeadInput {
  title: string;
  description: string;
  /** Absolute or root-relative URL of the image most likely to be the LCP element. */
  lcpImage: string | null;
  /** The LCP image's srcset, when it has responsive variants. Must match the <img>. */
  lcpImageSrcset?: string | null;
  /** The LCP image's sizes attribute, paired with lcpImageSrcset. */
  lcpImageSizes?: string | null;
  pixels: ActivePixel[];
  themeColor: string;
  css: string;
  rtl: boolean;
  canonical: string | null;
  ogImage: string | null;
}

/**
 * The raw pixel rows that apply to this link, precedence applied.
 *
 * Mirrors ReferralForm.tsx: a SINGLE pixel naming this code wins outright, and
 * only if none does do the GLOBAL pixels apply. Keeping the precedence identical
 * matters — an influencer who set a per-link pixel is deliberately excluding the
 * global one, and quietly firing both would corrupt their attribution.
 *
 * Also the precedence the Conversions API reporter uses (metaCapi.service.ts),
 * and it must stay the ONE implementation: a server event sent for a pixel the
 * page never fired would have no browser twin to deduplicate against.
 */
export function pixelRowsForCode(pixels: any[], code: string): any[] {
  if (!Array.isArray(pixels)) return [];

  const single = pixels.filter(
    (p) => p?.type === 'SINGLE' && Array.isArray(p?.targetIds) && p.targetIds.includes(code)
  );
  if (single.length) return single;

  return pixels.filter((p) => p?.type === 'GLOBAL');
}

/**
 * Chooses which of an influencer's pixels apply to this link, reduced to the
 * three fields a page needs. The projection is load-bearing, not cosmetic:
 * rows can carry a Conversions API access token, and this is the doorway
 * through which pixels reach compiled HTML.
 */
export function selectActivePixels(pixels: any[], code: string): ActivePixel[] {
  return pixelRowsForCode(pixels, code)
    .map((p: any): ActivePixel => ({
      platform: String(p.platform || 'META').toUpperCase(),
      pixelId: String(p.pixelId || ''),
      conversionEvent: String(p.conversionEvent || 'Lead'),
    }))
    .filter((p) => p.pixelId);
}

/** Verbatim from ReferralForm.getNoScriptUrl — the fallback beacon for JS-less clients. */
function noscriptUrl(pixel: ActivePixel): string {
  const id = encodeURIComponent(pixel.pixelId);
  switch (pixel.platform) {
    case 'META':
      return `https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1`;
    case 'SNAPCHAT':
      return `https://tr.snapchat.com/cm/i?id=${id}&ev=PAGE_VIEW&noscript=1`;
    case 'TIKTOK':
      return `https://analytics.tiktok.com/api/v2/pixel?id=${id}&ev=PageView&noscript=1`;
    case 'GOOGLE':
      return `https://www.googletagmanager.com/ns.html?id=${id}`;
    default:
      return '';
  }
}

/**
 * Content-Security-Policy for a compiled page.
 *
 * Express strips helmet's default policy for this route — its `script-src 'self'`
 * would block every pixel — so without this the page would ship with no policy
 * at all. Because the compiler owns the whole document, the replacement can be
 * far tighter than anything the SPA could use.
 *
 * `'unsafe-inline'` is unavoidable for style: generated pages carry inline style
 * attributes on nearly every element. Scripts do NOT get it — the inline
 * bootstrap and runtime are allow-listed by hash instead.
 */
export function buildCsp(pixels: ActivePixel[], scriptHashes: string[]): string {
  const platforms = new Set(pixels.map((p) => p.platform));

  const script = ["'self'", ...scriptHashes.map((h) => `'sha256-${h}'`)];
  const connect = ["'self'"];
  const frame: string[] = [];

  if (platforms.has('META')) {
    script.push('https://connect.facebook.net');
    connect.push('https://www.facebook.com', 'https://connect.facebook.net');
  }
  if (platforms.has('GOOGLE')) {
    script.push('https://www.googletagmanager.com', 'https://www.google-analytics.com');
    connect.push('https://www.google-analytics.com', 'https://analytics.google.com');
  }
  if (platforms.has('TIKTOK')) {
    script.push('https://analytics.tiktok.com');
    connect.push('https://analytics.tiktok.com');
  }
  if (platforms.has('SNAPCHAT')) {
    script.push('https://sc-static.net');
    connect.push('https://tr.snapchat.com');
  }

  // Escape hatch: a pixel vendor moving to a new host fails silently and costs
  // conversions before anyone notices, so operators can widen this without a deploy.
  const extra = String(process.env.SSG_CSP_EXTRA_HOSTS || '')
    .split(/[\s,]+/)
    .filter(Boolean);
  if (extra.length) {
    script.push(...extra);
    connect.push(...extra);
  }

  return [
    "default-src 'none'",
    `script-src ${script.join(' ')}`,
    `connect-src ${connect.join(' ')}`,
    "img-src 'self' data: https:",
    "media-src 'self' https:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    frame.length ? `frame-src ${frame.join(' ')}` : "frame-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
    "frame-ancestors 'self'",
  ].join('; ');
}

/** Hosts to warm up, but only for platforms this page actually uses. */
function preconnectHosts(pixels: ActivePixel[]): string[] {
  const hosts = new Set<string>();
  for (const p of pixels) {
    if (p.platform === 'META') hosts.add('https://connect.facebook.net');
    if (p.platform === 'GOOGLE') hosts.add('https://www.googletagmanager.com');
    if (p.platform === 'TIKTOK') hosts.add('https://analytics.tiktok.com');
    if (p.platform === 'SNAPCHAT') hosts.add('https://sc-static.net');
  }
  return [...hosts];
}

/**
 * Whether vendor SDK downloads wait for idle or first interaction.
 *
 * `SSG_PIXEL_DEFER=off` restores the previous byte-for-byte behaviour, because
 * the one thing that must never need a deploy is turning tracking back to how
 * it was the day conversions looked right.
 */
function deferPixels(): boolean {
  return process.env.SSG_PIXEL_DEFER !== 'off';
}

/**
 * Drains the deferred SDK loaders registered by the vendor snippets.
 *
 * Measured cost of NOT deferring: fbevents.js plus nine `signals/config`
 * responses came to 413 KB and 1,170 ms of main-thread time, and owned twelve of
 * the page's thirteen long tasks — the last of them landing 4.5 s into the load,
 * long after the content had painted.
 *
 * What is deferred is only the SDK *download*. Every vendor stub, `init` and
 * `track` call still runs in document order and queues exactly as before; they
 * flush the moment the SDK arrives. Three things trigger that: first
 * interaction, browser idle, and the tab being backgrounded.
 *
 * `pagehide` is the fourth trigger and it is a different mechanism, because on a
 * terminal navigation inserting a <script> is useless — the fetch is cancelled
 * when the navigation commits and the queued PageView dies with the document.
 * That path instead reports PageView directly through the vendor's own pixel
 * endpoint, the same URL the <noscript> fallback uses, as an image GET. Meta's
 * /tr accepts GET; sendBeacon would POST, so it is deliberately not used.
 *
 * Firing the beacon then also strips the queued PageView, so a page restored
 * from the back/forward cache — which the Cache-Control change now allows —
 * loads its SDK without reporting a second PageView for the same visit.
 */
function pixelDrain(beacons: string[]): string {
  return (
    `(function(w,d,B){var evs=['pointerdown','keydown','touchstart','wheel','scroll'],done=0,sent=0;` +
    // The beacon has already reported this page view; the SDK must not repeat it.
    `function strip(){` +
    `try{if(w.fbq&&w.fbq.queue)w.fbq.queue=w.fbq.queue.filter(function(a){` +
    `return !(a&&a[0]==='track'&&a[1]==='PageView')})}catch(e){}` +
    `try{if(w.snaptr&&w.snaptr.queue)w.snaptr.queue=w.snaptr.queue.filter(function(a){` +
    `return !(a&&a[0]==='track'&&a[1]==='PAGE_VIEW')})}catch(e){}}` +
    `function go(){if(done)return;done=1;` +
    `for(var i=0;i<evs.length;i++)w.removeEventListener(evs[i],go,true);` +
    `if(sent)strip();` +
    `var q=w.__pxq||[];w.__pxq={push:function(f){try{f()}catch(e){}}};` +
    `for(var j=0;j<q.length;j++){try{q[j]()}catch(e){}}}` +
    `function bail(){if(done||sent||!B.length)return;sent=1;` +
    `for(var i=0;i<B.length;i++){try{var im=new w.Image();im.src=B[i]}catch(e){}}}` +
    `for(var i=0;i<evs.length;i++)w.addEventListener(evs[i],go,{passive:true,capture:true});` +
    `(w.requestIdleCallback||function(c){w.setTimeout(c,1200)})(go,{timeout:2500});` +
    `d.addEventListener('visibilitychange',function(){if(d.visibilityState==='hidden')go()});` +
    `w.addEventListener('pagehide',bail);` +
    `})(window,document,${jsonForScript(beacons)});`
  );
}

/**
 * Pixel endpoints that can report a page view with a bare image GET.
 *
 * Only the platforms whose deferred SDK owns the PageView. TikTok still injects
 * inline, so beaconing it would double-count; Google's noscript URL is a GTM
 * iframe, not a measurement endpoint.
 */
function terminalBeacons(pixels: ActivePixel[]): string[] {
  return pixels
    .filter((p) => p.platform === 'META' || p.platform === 'SNAPCHAT')
    .map(noscriptUrl)
    .filter(Boolean);
}

/**
 * The pixel bootstraps, copied from ReferralForm.tsx rather than rewritten.
 *
 * These are vendor snippets. Tidying them is how you introduce a subtle
 * difference in queue handling that loses events, so they stay as shipped —
 * only the id is interpolated, and it goes through jsonForScript so a malformed
 * id cannot break out of the script.
 *
 * The single edit made to them is mechanical and identical in each: the two or
 * three statements that append the vendor's <script> tag move into a closure
 * pushed onto `window.__pxq`. Nothing else is touched, and `__pxq` replaces
 * itself with a run-immediately shim once drained, so a snippet registering late
 * still loads. TikTok is left exactly as shipped — its `ttq.load` both
 * configures the queue and injects the script, and splitting that is the kind of
 * cleverness that quietly loses events.
 */
function pixelBootstrap(pixels: ActivePixel[]): string {
  const parts: string[] = [];
  const defer = deferPixels();
  let deferred = false;

  /** `body` verbatim when deferral is off, wrapped in the queue when it is on. */
  const later = (body: string): string => {
    if (!defer) return body;
    deferred = true;
    return `(window.__pxq=window.__pxq||[]).push(function(){${body}});`;
  };

  for (const pixel of pixels) {
    const id = jsonForScript(pixel.pixelId);

    if (pixel.platform === 'META') {
      parts.push(
        `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?` +
          `n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;` +
          `n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];` +
          `t=b.createElement(e);t.async=!0;` +
          `t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)` +
          `}` +
          `(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');` +
          `fbq('init',${id});fbq('track','PageView');`
      );
    } else if (pixel.platform === 'GOOGLE') {
      parts.push(
        `(function(){window.dataLayer=window.dataLayer||[];` +
          `window.gtag=function(){window.dataLayer.push(arguments)};` +
          `gtag('js',new Date());gtag('config',${id});` +
          later(
            `var s=document.createElement('script');s.async=!0;` +
              `s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(${id});` +
              `document.head.appendChild(s)`
          ) +
          `})();`
      );
    } else if (pixel.platform === 'TIKTOK') {
      parts.push(
        `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];` +
          `ttq.methods=["page","track","identify","instances","debug","on","off","once","ready",` +
          `"alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],` +
          `ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};` +
          `for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);` +
          `ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)` +
          `ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){` +
          `var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;` +
          `ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,` +
          `ttq._o=ttq._o||{},ttq._o[e]=n||{};var s=document.createElement("script");` +
          `s.type="text/javascript",s.async=!0,s.src=r+"?sdkid="+e+"&lib="+t;` +
          `var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(s,a)};` +
          `ttq.load(${id});ttq.page();}(window,document,'ttq');`
      );
    } else if (pixel.platform === 'SNAPCHAT') {
      parts.push(
        `!function(e,t,n){if(e.snaptr)return;var r=e.snaptr=function(){` +
          `r.handleRequest?r.handleRequest.apply(r,arguments):r.queue.push(arguments)};r.queue=[];` +
          later(
            `var a=t.createElement(n);a.async=!0;a.src="https://sc-static.net/scevent.min.js";` +
              `var s=t.getElementsByTagName(n)[0];s.parentNode.insertBefore(a,s)`
          ) +
          `}` +
          `(window,document,"script");snaptr('init',${id});snaptr('track','PAGE_VIEW');`
      );
    }
  }

  if (deferred) parts.push(pixelDrain(terminalBeacons(pixels)));

  return parts.join('');
}

export function renderNoscriptPixels(pixels: ActivePixel[]): string {
  return pixels
    .map((pixel) => {
      const url = noscriptUrl(pixel);
      if (!url) return '';
      if (pixel.platform === 'GOOGLE') {
        return `<iframe src="${esc(url)}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
      }
      return `<img height="1" width="1" style="display:none" alt="" src="${esc(url)}">`;
    })
    .filter(Boolean)
    .join('');
}

export function renderHead(input: HeadInput): string {
  const parts: string[] = [];

  parts.push('<meta charset="utf-8">');
  parts.push('<meta name="viewport" content="width=device-width,initial-scale=1">');
  parts.push(`<meta name="theme-color" content="${esc(input.themeColor)}">`);
  parts.push('<meta name="robots" content="noindex,nofollow">');

  parts.push(`<title>${esc(input.title)}</title>`);
  if (input.description) {
    parts.push(`<meta name="description" content="${esc(input.description)}">`);
  }

  // Open Graph, so a shared link previews the offer. The SPA never set these,
  // so today a shared /r/ link shows whatever the prerendered homepage carries.
  parts.push(`<meta property="og:title" content="${esc(input.title)}">`);
  if (input.description) {
    parts.push(`<meta property="og:description" content="${esc(input.description)}">`);
  }
  parts.push('<meta property="og:type" content="product">');
  if (input.ogImage) {
    const url = safeUrl(input.ogImage);
    if (url) parts.push(`<meta property="og:image" content="${esc(url)}">`);
  }
  if (input.canonical) {
    const url = safeUrl(input.canonical);
    if (url) parts.push(`<link rel="canonical" href="${esc(url)}">`);
  }

  // Preconnect before the pixel scripts so the TLS handshake overlaps parsing,
  // and only for platforms this page uses.
  //
  // No `crossorigin`: fbevents.js and its peers are fetched as ordinary scripts,
  // not CORS ones, so a crossorigin hint warms a connection nothing then uses
  // and the browser opens a second one anyway. Lighthouse reports it as an
  // invalid resource hint, and it is — it cost a handshake rather than saving one.
  for (const host of preconnectHosts(input.pixels)) {
    parts.push(`<link rel="preconnect" href="${esc(host)}">`);
  }

  // The LCP image, declared as a tag the preload scanner sees at byte ~400.
  // The SPA needs an inline script to work this out at runtime; we know it at
  // compile time.
  if (input.lcpImage) {
    const url = safeUrl(input.lcpImage);
    if (url) {
      // imagesrcset MUST mirror the <img> exactly. Without it the preload picks
      // the full-size file while the img picks a variant, and the page downloads
      // both — the responsive images would cost bytes instead of saving them.
      const srcset = input.lcpImageSrcset
        ? ` imagesrcset="${esc(input.lcpImageSrcset)}" imagesizes="${esc(input.lcpImageSizes || '100vw')}"`
        : '';
      parts.push(`<link rel="preload" as="image" href="${esc(url)}"${srcset} fetchpriority="high">`);
    }
  }

  parts.push(`<style>${input.css}</style>`);

  const bootstrap = pixelBootstrap(input.pixels);
  if (bootstrap) parts.push(`<script>${bootstrap}</script>`);

  return parts.join('');
}

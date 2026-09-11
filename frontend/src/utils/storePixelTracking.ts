import { StorePixel } from '../contexts/StoreContext';

const initializedPixels = new Set<string>();

/**
 * Initializes and injects tracking scripts for configured global store pixels.
 * Supports META, TIKTOK, GOOGLE, and SNAPCHAT.
 */
export function initStorePixels(pixels: StorePixel[]): void {
  if (typeof window === 'undefined' || !Array.isArray(pixels) || pixels.length === 0) return;

  const w = window as any;
  const d = document;

  pixels.forEach((pixel) => {
    if (!pixel?.pixelId) return;

    const platform = (pixel.platform || 'META').toUpperCase();
    const pixelKey = `${platform}:${pixel.pixelId}`;

    if (initializedPixels.has(pixelKey)) return;
    initializedPixels.add(pixelKey);

    try {
      if (platform === 'META') {
        if (!w.fbq) {
          (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
            if (f.fbq) return;
            n = f.fbq = function () {
              n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
            };
            if (!f._fbq) f._fbq = n;
            n.push = n;
            n.loaded = !0;
            n.version = '2.0';
            n.queue = [];
            t = b.createElement(e);
            t.async = !0;
            t.src = v;
            s = b.getElementsByTagName(e)[0];
            if (s && s.parentNode) s.parentNode.insertBefore(t, s);
          })(w, d, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
        }
        if (w.fbq) {
          w.fbq('init', pixel.pixelId);
          if (pixel.testEventCode) {
            w.fbq('set', 'testEventCode', pixel.testEventCode);
          }
        }
      } else if (platform === 'GOOGLE') {
        if (!d.getElementById(`gtag-${pixel.pixelId}`)) {
          const script = d.createElement('script');
          script.id = `gtag-${pixel.pixelId}`;
          script.async = true;
          script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(pixel.pixelId)}`;
          d.head.appendChild(script);

          w.dataLayer = w.dataLayer || [];
          function gtag() {
            w.dataLayer.push(arguments);
          }
          w.gtag = gtag;
          w.gtag('js', new Date());
          w.gtag('config', pixel.pixelId);
        }
      } else if (platform === 'TIKTOK') {
        if (!w.ttq) {
          (function (w: any, d: any, t: any) {
            w.TiktokAnalyticsObject = t;
            var ttq = (w[t] = w[t] || []);
            ttq.methods = [
              'page',
              'track',
              'identify',
              'instances',
              'debug',
              'on',
              'off',
              'once',
              'ready',
              'alias',
              'group',
              'enableCookie',
              'disableCookie',
              'holdConsent',
              'revokeConsent',
              'grantConsent',
            ];
            ttq.setAndDefer = function (t: any, e: any) {
              t[e] = function () {
                t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
              };
            };
            for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
            ttq.instance = function (t: any) {
              for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]);
              return e;
            };
            ttq.load = function (e: any, n: any) {
              var r = 'https://analytics.tiktok.com/i18n/pixel/events.js',
                o = n && n.partner;
              (ttq._i = ttq._i || {}),
                (ttq._i[e] = []),
                (ttq._i[e]._u = r),
                (ttq._t = ttq._t || {}),
                (ttq._t[e] = +new Date()),
                (ttq._o = ttq._o || {}),
                (ttq._o[e] = n || {});
              var s = d.createElement('script');
              (s.type = 'text/javascript'), (s.async = !0), (s.src = r + '?sdkid=' + e + '&lib=' + t);
              var a = d.getElementsByTagName('script')[0];
              if (a && a.parentNode) a.parentNode.insertBefore(s, a);
            };
          })(w, d, 'ttq');
        }
        if (w.ttq) {
          w.ttq.load(pixel.pixelId);
        }
      } else if (platform === 'SNAPCHAT') {
        if (!w.snaptr) {
          (function (e: any, t: any, n: any) {
            if (e.snaptr) return;
            var r: any = (e.snaptr = function () {
              r.handleRequest ? r.handleRequest.apply(r, arguments) : r.queue.push(arguments);
            });
            r.queue = [];
            var a = t.createElement(n);
            a.async = !0;
            a.src = 'https://sc-static.net/scevent.min.js';
            var s = t.getElementsByTagName(n)[0];
            if (s && s.parentNode) s.parentNode.insertBefore(a, s);
          })(w, d, 'script');
        }
        if (w.snaptr) {
          w.snaptr('init', pixel.pixelId);
        }
      }
    } catch {
      /* never break the page on blocked tracker */
    }
  });
}

/**
 * Fires a PageView event on all configured store pixels.
 */
export function trackStorePageView(pixels: StorePixel[], url?: string): void {
  if (typeof window === 'undefined' || !Array.isArray(pixels) || pixels.length === 0) return;
  const w = window as any;

  pixels.forEach((pixel) => {
    const platform = (pixel.platform || 'META').toUpperCase();
    try {
      if (platform === 'META' && w.fbq) {
        w.fbq('track', 'PageView');
      } else if (platform === 'TIKTOK' && w.ttq) {
        w.ttq.page();
      } else if (platform === 'GOOGLE' && w.gtag) {
        w.gtag('event', 'page_view', {
          page_location: url || window.location.href,
          page_path: window.location.pathname,
        });
      } else if (platform === 'SNAPCHAT' && w.snaptr) {
        w.snaptr('track', 'PAGE_VIEW');
      }
    } catch {
      /* ignore */
    }
  });
}

/**
 * Fires ViewContent event on product views.
 */
export function trackStoreViewContent(
  pixels: StorePixel[],
  product: { id: number | string; title: string; price: number; currency?: string }
): void {
  if (typeof window === 'undefined' || !Array.isArray(pixels) || pixels.length === 0) return;
  const w = window as any;
  const currency = product.currency || 'MAD';

  pixels.forEach((pixel) => {
    const platform = (pixel.platform || 'META').toUpperCase();
    try {
      if (platform === 'META' && w.fbq) {
        w.fbq('track', 'ViewContent', {
          content_name: product.title,
          content_ids: [String(product.id)],
          content_type: 'product',
          value: product.price,
          currency,
        });
      } else if (platform === 'TIKTOK' && w.ttq) {
        w.ttq.track('ViewContent', {
          content_id: String(product.id),
          content_type: 'product',
          content_name: product.title,
          value: product.price,
          currency,
        });
      } else if (platform === 'GOOGLE' && w.gtag) {
        w.gtag('event', 'view_item', {
          currency,
          value: product.price,
          items: [{ item_id: String(product.id), item_name: product.title, price: product.price }],
        });
      } else if (platform === 'SNAPCHAT' && w.snaptr) {
        w.snaptr('track', 'VIEW_CONTENT', {
          item_ids: [String(product.id)],
          price: product.price,
          currency,
        });
      }
    } catch {
      /* ignore */
    }
  });
}

/**
 * Fires AddToCart event when a product is added.
 */
export function trackStoreAddToCart(
  pixels: StorePixel[],
  item: { productId: number | string; title: string; price: number; quantity: number; currency?: string }
): void {
  if (typeof window === 'undefined' || !Array.isArray(pixels) || pixels.length === 0) return;
  const w = window as any;
  const currency = item.currency || 'MAD';
  const totalValue = item.price * (item.quantity || 1);

  pixels.forEach((pixel) => {
    const platform = (pixel.platform || 'META').toUpperCase();
    try {
      if (platform === 'META' && w.fbq) {
        w.fbq('track', 'AddToCart', {
          content_name: item.title,
          content_ids: [String(item.productId)],
          content_type: 'product',
          value: totalValue,
          currency,
        });
      } else if (platform === 'TIKTOK' && w.ttq) {
        w.ttq.track('AddToCart', {
          content_id: String(item.productId),
          content_name: item.title,
          value: totalValue,
          currency,
        });
      } else if (platform === 'GOOGLE' && w.gtag) {
        w.gtag('event', 'add_to_cart', {
          currency,
          value: totalValue,
          items: [
            {
              item_id: String(item.productId),
              item_name: item.title,
              price: item.price,
              quantity: item.quantity,
            },
          ],
        });
      } else if (platform === 'SNAPCHAT' && w.snaptr) {
        w.snaptr('track', 'ADD_CART', {
          item_ids: [String(item.productId)],
          price: totalValue,
          currency,
        });
      }
    } catch {
      /* ignore */
    }
  });
}

/**
 * Fires InitiateCheckout event when visiting the checkout page.
 */
export function trackStoreInitiateCheckout(
  pixels: StorePixel[],
  data: { value: number; numItems: number; currency?: string }
): void {
  if (typeof window === 'undefined' || !Array.isArray(pixels) || pixels.length === 0) return;
  const w = window as any;
  const currency = data.currency || 'MAD';

  pixels.forEach((pixel) => {
    const platform = (pixel.platform || 'META').toUpperCase();
    try {
      if (platform === 'META' && w.fbq) {
        w.fbq('track', 'InitiateCheckout', {
          value: data.value,
          currency,
          num_items: data.numItems,
        });
      } else if (platform === 'TIKTOK' && w.ttq) {
        w.ttq.track('InitiateCheckout', {
          value: data.value,
          currency,
        });
      } else if (platform === 'GOOGLE' && w.gtag) {
        w.gtag('event', 'begin_checkout', {
          value: data.value,
          currency,
        });
      } else if (platform === 'SNAPCHAT' && w.snaptr) {
        w.snaptr('track', 'START_CHECKOUT', {
          price: data.value,
          currency,
        });
      }
    } catch {
      /* ignore */
    }
  });
}

/**
 * Fires Purchase (or conversionEvent) with optional Meta CAPI eventId deduplication.
 */
export function trackStorePurchase(
  pixels: StorePixel[],
  order: { reference?: string; totalAmountMad: number; currency?: string; capiEventId?: string }
): void {
  if (typeof window === 'undefined' || !Array.isArray(pixels) || pixels.length === 0) return;
  const w = window as any;
  const value = order.totalAmountMad;
  const currency = order.currency || 'MAD';

  pixels.forEach((pixel) => {
    const platform = (pixel.platform || 'META').toUpperCase();
    const eventName = pixel.conversionEvent || 'Purchase';
    try {
      if (platform === 'META') {
        if (w.fbq) {
          w.fbq(
            'track',
            eventName,
            { value, currency },
            order.capiEventId ? { eventID: order.capiEventId } : undefined
          );
        }
      } else if (platform === 'GOOGLE' && w.gtag) {
        w.gtag('event', 'purchase', {
          transaction_id: order.reference,
          value,
          currency,
        });
      } else if (platform === 'TIKTOK' && w.ttq) {
        const ttEvent = eventName === 'Purchase' ? 'CompletePayment' : 'CompleteRegistration';
        w.ttq.track(ttEvent, { value, currency });
      } else if (platform === 'SNAPCHAT' && w.snaptr) {
        const snapEvent = eventName === 'Purchase' ? 'PURCHASE' : 'SIGN_UP';
        w.snaptr('track', snapEvent, { price: value, currency });
      }
    } catch {
      /* ignore */
    }
  });
}

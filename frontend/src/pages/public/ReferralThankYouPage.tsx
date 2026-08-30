import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import BlockRenderer, { EditorBlock } from '../../components/helper/sitebuilder/BlockRenderer';
import { publicApi } from '../../lib/api';
import { readOrderHandoff, clearOrderHandoff, OrderHandoff } from '../../utils/orderHandoff';
import ThankYouPage from './ThankYouPage';

/**
 * The per-link thank-you page, served at /r/:code/thank-you.
 *
 * Renders the blocks the seller built in the site builder. When they have not
 * built one — which is every link until they do — it falls back to the shared
 * default page, so this route is safe to send every order to from day one.
 *
 * The conversion pixel fires HERE rather than on the landing page. That is both
 * the conventional place for it (the event means "an order happened", and this
 * page is only reachable after one did) and the only place with the order value
 * to attach, which is what Meta and Google actually optimise against.
 */

interface ThankYouData {
  code: string;
  themeColor: string;
  thankYouStructure: any;
  product: { id: number; nameFr: string; nameAr?: string; retailPriceMad: any; image: string | null } | null;
  influencerName: string | null;
  influencerAvatar: string | null;
  pixels: any[];
}

/** Blocks out of a saved structure, tolerating the legacy bare-array shape. */
function blocksOf(structure: any): EditorBlock[] {
  if (!structure) return [];
  if (Array.isArray(structure)) return structure as EditorBlock[];
  return Array.isArray(structure.blocks) ? (structure.blocks as EditorBlock[]) : [];
}

function settingsOf(structure: any): any {
  if (!structure || Array.isArray(structure)) return {};
  return structure.settings || {};
}

export default function ReferralThankYouPage() {
  const { code } = useParams<{ code: string }>();
  const [data, setData] = useState<ThankYouData | null>(null);
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderHandoff | null>(null);
  // Pixels must fire exactly once, however many times React renders this.
  const firedRef = useRef(false);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    setOrder(readOrderHandoff(code));

    publicApi
      .getThankYouPage(code)
      .then((res: any) => {
        const body = res.data?.status === 'success' ? res.data.data : res.data;
        if (!cancelled) setData(body ?? null);
      })
      .catch(() => {
        // A failed lookup must not deny a paying customer their confirmation —
        // the default page below needs no data at all.
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [code]);

  const blocks = useMemo(() => blocksOf(data?.thankYouStructure), [data]);
  const settings = useMemo(() => settingsOf(data?.thankYouStructure), [data]);

  // Conversion tracking. Runs once the page has its data, whether or not the
  // seller built a custom page — the event is about the order, not the layout.
  useEffect(() => {
    if (firedRef.current) return;
    if (loading) return;
    const pixels = data?.pixels || [];
    if (!pixels.length || typeof window === 'undefined') return;

    firedRef.current = true;

    const value = order?.price ?? null;
    const currency = order?.currency || 'MAD';

    pixels.forEach((pixel: any) => {
      const platform = (pixel.platform || 'META').toUpperCase();
      const eventName = pixel.conversionEvent || 'Purchase';
      const w = window as any;

      // Value and currency are what make the event usable for optimisation and
      // ROAS. They are omitted rather than guessed when the handoff is absent.
      const meta = value != null ? { value, currency } : undefined;

      try {
        if (platform === 'META') {
          if (!w.fbq && pixel.pixelId) {
            (function(f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
              if (f.fbq) return;
              n = f.fbq = function() {
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
            })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
            w.fbq('init', pixel.pixelId);
          }
          if (w.fbq) {
            w.fbq('track', eventName, meta, order?.capiEventId ? { eventID: order.capiEventId } : undefined);
          }
        } else if (platform === 'GOOGLE' && w.gtag) {
          w.gtag('event', eventName, { event_category: 'conversion', ...(value != null ? { value, currency } : {}) });
        } else if (platform === 'TIKTOK' && w.ttq) {
          const ttEvent = eventName === 'Purchase' ? 'CompletePayment' : 'CompleteRegistration';
          w.ttq.track(ttEvent, meta);
        } else if (platform === 'SNAPCHAT' && w.snaptr) {
          const snapEvent = eventName === 'Purchase' ? 'PURCHASE' : 'SIGN_UP';
          w.snaptr('track', snapEvent, value != null ? { price: value, currency } : undefined);
        }
      } catch {
        /* a blocked or half-loaded pixel must never break the page */
      }
    });

    // Spent — a refresh must not double-count the same order.
    clearOrderHandoff();
  }, [loading, data, order]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div
          className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200"
          style={{ borderTopColor: data?.themeColor || '#f97316' }}
        />
      </div>
    );
  }

  // No custom page built for this link: the shared default, unchanged.
  if (!blocks.length) return <ThankYouPage />;

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: settings.backgroundColor || '#ffffff' }}
    >
      <div
        className="mx-auto"
        style={{ maxWidth: settings.maxWidth ? `${settings.maxWidth}px` : 640 }}
      >
        <BlockRenderer blocks={blocks} />
      </div>
    </div>
  );
}

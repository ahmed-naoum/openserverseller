import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import BlockRenderer, { EditorBlock } from '../../components/helper/sitebuilder/BlockRenderer';
import { publicApi } from '../../lib/api';
import { readOrderHandoff, clearOrderHandoff, OrderHandoff } from '../../utils/orderHandoff';
import ThankYouPage from './ThankYouPage';
import { flatBlocks, settingsOf as sharedSettingsOf } from '@shared/document/migrate.js';

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

/** Blocks out of a saved structure, whichever of the three shapes it is in. */
function blocksOf(structure: any): EditorBlock[] {
  return flatBlocks(structure) as EditorBlock[];
}

function settingsOf(structure: any): any {
  return sharedSettingsOf(structure);
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
    // Only the SPA checkout writes an order handoff, and it is the one flow
    // whose conversion fires here. The compiled landing page fires its own
    // fbq('track', ..., {eventID}) before navigating, so firing again on
    // arrival — without that eventID — would give Meta a second Purchase it
    // cannot deduplicate, double-counting every compiled-flow order. The same
    // guard keeps a direct or revisited thank-you URL from minting phantom
    // conversions.
    if (!order) return;
    const rawPixels = data?.pixels || [];
    const matchingSinglePixels = rawPixels.filter((p: any) => p.type === 'SINGLE' && p.targetIds?.includes(code));
    const candidatePixels = matchingSinglePixels.length > 0
      ? matchingSinglePixels
      : rawPixels.filter((p: any) => p.type === 'GLOBAL' || !p.type);

    const seen = new Set<string>();
    const pixels: any[] = [];
    for (const p of candidatePixels) {
      const platform = String(p?.platform || 'META').toUpperCase();
      const pixelId = String(p?.pixelId || '').trim();
      if (!pixelId) continue;
      const key = `${platform}:${pixelId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pixels.push({
        ...p,
        platform,
        pixelId,
        conversionEvent: p?.conversionEvent || 'Purchase'
      });
    }

    if (!pixels.length || typeof window === 'undefined') return;

    firedRef.current = true;

    const value = order?.price ?? null;
    const currency = order?.currency || 'MAD';
    const meta = value != null ? { value, currency } : undefined;
    const w = window as any;

    const metaPixels = pixels.filter((p: any) => p.platform === 'META');
    const googlePixels = pixels.filter((p: any) => p.platform === 'GOOGLE');
    const tiktokPixels = pixels.filter((p: any) => p.platform === 'TIKTOK');
    const snapPixels = pixels.filter((p: any) => p.platform === 'SNAPCHAT');

    if (metaPixels.length > 0) {
      if (!w.fbq) {
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
      }
      metaPixels.forEach((pixel: any) => {
        try {
          w.fbq('init', pixel.pixelId);
          const eventName = pixel.conversionEvent || 'Purchase';
          w.fbq('trackSingle', pixel.pixelId, eventName, meta, order?.capiEventId ? { eventID: order.capiEventId } : undefined);
        } catch {}
      });
    }

    if (googlePixels.length > 0 && w.gtag) {
      try {
        const ev = googlePixels[0]?.conversionEvent || 'Purchase';
        w.gtag('event', ev, { event_category: 'conversion', ...(value != null ? { value, currency } : {}) });
      } catch {}
    }

    if (tiktokPixels.length > 0 && w.ttq) {
      try {
        const ev = tiktokPixels[0]?.conversionEvent || 'Purchase';
        const ttEvent = ev === 'Purchase' ? 'CompletePayment' : 'CompleteRegistration';
        w.ttq.track(ttEvent, meta, order?.capiEventId ? { event_id: order.capiEventId } : undefined);
      } catch {}
    }

    if (snapPixels.length > 0 && w.snaptr) {
      try {
        const ev = snapPixels[0]?.conversionEvent || 'Purchase';
        const snapEvent = ev === 'Purchase' ? 'PURCHASE' : 'SIGN_UP';
        w.snaptr('track', snapEvent, value != null ? { price: value, currency } : undefined);
      } catch {}
    }

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

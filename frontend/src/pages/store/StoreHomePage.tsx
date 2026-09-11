import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../contexts/StoreContext';
import { storePublicApi } from '../../lib/api';
import StoreProductCard from '../../components/store/StoreProductCard';
import StoreDocument from '../../components/store/StoreDocument';
import { flatBlocks } from '@shared/document/migrate.js';
import {
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Truck,
  RefreshCw,
  ShoppingBag,
  Headphones,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
  CreditCard,
  MousePointerClick,
  Plus,
  Minus,
  Sparkles,
} from 'lucide-react';
import {
  HERO_SLIDES,
  DEMO_CATEGORIES,
  PROMO_PANELS,
  LOOKBOOK,
  MOOD_GRID,
  EDITORIAL,
  unsplash,
} from '../../lib/storeMedia';

const money = (n: number) => new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 2 }).format(n);

/* ------------------------------------------------------------------ *
 * Section chrome
 * ------------------------------------------------------------------ */

function SectionHead({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
      <div>
        {eyebrow && (
          <span className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">{eyebrow}</span>
        )}
        <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mt-1">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-1.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 1. Hero slider
 * ------------------------------------------------------------------ */

function HeroSlider({ store, primaryColor }: { store: any; primaryColor: string }) {
  /** The seller's own banner leads when they have one; the stock slides carry
   *  the rest so a fresh shop still opens on something worth looking at. */
  const slides = useMemo(() => {
    const stock = HERO_SLIDES.map((s) => ({ ...s, src: unsplash(s.id, 1600, 900, 80) }));
    if (!store.bannerUrl) return stock;
    return [
      {
        ...HERO_SLIDES[0],
        src: store.bannerUrl,
        title: store.name,
        subtitle: store.tagline || HERO_SLIDES[0].subtitle,
        eyebrow: 'Boutique officielle',
      },
      ...stock.slice(1),
    ];
  }, [store.bannerUrl, store.name, store.tagline]);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback((n: number) => setIndex((n + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => window.clearInterval(t);
  }, [paused, slides.length]);

  return (
    <section
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      <div className="relative h-[420px] sm:h-[520px] lg:h-[600px] overflow-hidden bg-gray-900">
        {slides.map((slide, i) => (
          <div
            key={i}
            className={`absolute inset-0 transition-opacity duration-700 ${
              i === index ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            aria-hidden={i !== index}
          >
            <img src={slide.src} alt="" className="w-full h-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} />
            <div className="absolute inset-0 bg-black/55 sm:bg-transparent" />
            <div
              className={`absolute inset-0 ${
                slide.align === 'right'
                  ? 'bg-gradient-to-l from-black/75 via-black/40 to-transparent'
                  : 'bg-gradient-to-r from-black/75 via-black/40 to-transparent'
              }`}
            />

            <div className="absolute inset-0 flex items-center">
              <div className="max-w-7xl mx-auto w-full px-6 sm:px-8 lg:px-10">
                <div className={`max-w-xl ${slide.align === 'right' ? 'sm:ml-auto sm:text-right' : ''}`}>
                  <span
                    className="inline-block px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest text-white mb-4"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {slide.eyebrow}
                  </span>
                  <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.05]">
                    {slide.title}
                  </h1>
                  <p className="text-sm sm:text-base text-gray-200 mt-4 leading-relaxed">{slide.subtitle}</p>
                  <div className={`flex flex-wrap gap-3 mt-7 ${slide.align === 'right' ? 'sm:justify-end' : ''}`}>
                    <Link
                      to={slide.href}
                      className="px-7 py-3.5 rounded-full text-white font-black text-sm shadow-xl hover:scale-[1.03] transition-transform flex items-center gap-2"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {slide.cta}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link
                      to="/products"
                      className="px-6 py-3.5 rounded-full bg-white/10 backdrop-blur-md border border-white/25 text-white font-bold text-sm hover:bg-white/20 transition-colors"
                    >
                      Tout le catalogue
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {slides.length > 1 && (
          <>
            <button
              onClick={() => go(index - 1)}
              className="absolute left-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur-md text-white hidden sm:flex items-center justify-center transition-colors"
              aria-label="Slide précédente"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => go(index + 1)}
              className="absolute right-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur-md text-white hidden sm:flex items-center justify-center transition-colors"
              aria-label="Slide suivante"
            >
              <ArrowRight className="w-5 h-5" />
            </button>

            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => go(i)}
                  aria-label={`Aller à la slide ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${i === index ? 'w-8 bg-white' : 'w-3 bg-white/45 hover:bg-white/70'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * 2. Reassurance strip
 * ------------------------------------------------------------------ */

function UspStrip({ store, primaryColor }: { store: any; primaryColor: string }) {
  const items = [
    {
      icon: Truck,
      title: 'Livraison 24/48h',
      body:
        store.freeShippingThreshold && store.freeShippingThreshold > 0
          ? `Offerte dès ${money(store.freeShippingThreshold)} ${store.currency || 'MAD'}`
          : store.standardShippingFee > 0
          ? `${money(store.standardShippingFee)} ${store.currency || 'MAD'} partout au Maroc`
          : 'Partout au Maroc',
      color: primaryColor,
    },
    {
      icon: ShieldCheck,
      title: store.enableCod ? 'Paiement à la livraison' : 'Paiement sécurisé',
      body: store.enableCod ? 'Vous payez le livreur, en espèces' : 'Transaction protégée',
      color: '#059669',
    },
    { icon: RefreshCw, title: 'Échange sous 7 jours', body: 'Article non conforme repris', color: '#4f46e5' },
    { icon: Headphones, title: 'Support 7j/7', body: 'Une équipe qui répond vraiment', color: '#db2777' },
  ];

  return (
    <section className="border-b border-gray-100 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-gray-100">
          {items.map((it) => (
            <div key={it.title} className="flex items-center gap-3 py-5 px-3 sm:px-5">
              <div className="w-11 h-11 shrink-0 rounded-2xl bg-gray-50 flex items-center justify-center">
                <it.icon className="w-5 h-5" style={{ color: it.color }} />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-black text-gray-900 leading-tight">{it.title}</h3>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{it.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * 3. Categories
 * ------------------------------------------------------------------ */

/** Tailwind needs the class spelled out, so the count maps to a fixed set. */
const GRID_COLS: Record<number, string> = {
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
};

function CategoryRail({ store }: { store: any }) {
  /**
   * Real collections win. Without them the stock tiles run the shop's own
   * search, so they stay useful the day stock arrives instead of becoming
   * decoration the seller has to hunt down and delete.
   */
  const tiles = store.collections?.length
    ? store.collections.map((c: any, i: number) => ({
        key: `col-${c.id}`,
        label: c.nameFr,
        sub: c.nameAr || null,
        href: `/collections/${c.slug}`,
        src: c.imageUrl || unsplash(DEMO_CATEGORIES[i % DEMO_CATEGORIES.length].id, 500, 500),
      }))
    : DEMO_CATEGORIES.map((c) => ({
        key: c.query,
        label: c.label,
        sub: null,
        href: `/products?search=${encodeURIComponent(c.query)}`,
        src: unsplash(c.id, 500, 500),
      }));

  /** Six collections in a four-up grid leaves a hole in the last row; the
   *  column count follows the tile count so every row fills. */
  const cols = tiles.length % 4 === 0 ? 4 : tiles.length % 3 === 0 ? 3 : tiles.length % 5 === 0 ? 5 : 4;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <SectionHead
        eyebrow="Parcourir"
        title="Achetez par catégorie"
        subtitle="Trouvez ce que vous cherchez en deux clics"
        action={
          <Link to="/products" className="text-xs font-bold text-gray-900 hover:underline flex items-center gap-1.5">
            Tout voir <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        }
      />

      <div className={`grid grid-cols-2 sm:grid-cols-3 ${GRID_COLS[cols]} gap-3 sm:gap-5`}>
        {tiles.map((t: any) => (
          <Link
            key={t.key}
            to={t.href}
            className="group relative rounded-2xl overflow-hidden aspect-[4/5] sm:aspect-square bg-gray-100 shadow-sm hover:shadow-xl transition-all"
          >
            <img
              src={t.src}
              alt={t.label}
              className="w-full h-full object-cover group-hover:scale-[1.07] transition-transform duration-700"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4">
              <span className="block text-white font-black text-sm sm:text-base leading-tight">{t.label}</span>
              {t.sub && (
                <span className="block text-left text-gray-300 text-xs font-arabic mt-0.5" dir="rtl">
                  {t.sub}
                </span>
              )}
              <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-white/85 group-hover:gap-2 transition-all">
                Découvrir <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * 5. Product grid with real sort tabs
 * ------------------------------------------------------------------ */

const SORT_TABS = [
  { key: 'newest', label: 'Nouveautés' },
  { key: 'price_asc', label: 'Prix croissant' },
  { key: 'price_desc', label: 'Prix décroissant' },
  { key: 'name', label: 'A → Z' },
] as const;

function ProductSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 animate-pulse space-y-3">
      <div className="aspect-square bg-gray-100 rounded-xl" />
      <div className="h-3 bg-gray-100 rounded w-1/2" />
      <div className="h-4 bg-gray-100 rounded w-3/4" />
      <div className="h-5 bg-gray-100 rounded w-1/3" />
    </div>
  );
}

function EmptyCatalogue({ store, primaryColor }: { store: any; primaryColor: string }) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white overflow-hidden grid md:grid-cols-2">
      <div className="p-8 sm:p-12 flex flex-col justify-center">
        <span className="inline-flex w-fit items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 text-[11px] font-black uppercase tracking-wide">
          <Sparkles className="w-3.5 h-3.5" />
          Catalogue en préparation
        </span>
        <h3 className="text-2xl font-black text-gray-900 mt-4 leading-tight">
          Nos premiers articles arrivent très bientôt
        </h3>
        <p className="text-sm text-gray-500 mt-3 leading-relaxed">
          La boutique est ouverte et prête à recevoir vos commandes. Écrivez-nous pour être prévenu dès la mise en
          ligne — ou pour une demande particulière, nous cherchons le produit pour vous.
        </p>
        <div className="flex flex-wrap gap-3 mt-6">
          {store.whatsappNumber ? (
            <a
              href={`https://wa.me/${store.whatsappNumber.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors"
            >
              Nous écrire sur WhatsApp
            </a>
          ) : null}
          <Link
            to="/products"
            className="px-6 py-3 rounded-xl text-white text-sm font-bold hover:opacity-95 transition-opacity"
            style={{ backgroundColor: primaryColor }}
          >
            Actualiser le catalogue
          </Link>
        </div>
      </div>
      <div className="relative min-h-[240px] bg-gray-100">
        <img src={unsplash(EDITORIAL.storefront, 900, 700, 75)} alt="" className="w-full h-full object-cover" loading="lazy" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 7. Horizontal product rail
 * ------------------------------------------------------------------ */

function ProductRail({ products }: { products: any[] }) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="flex gap-4 sm:gap-5 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((p) => (
          <div key={p.id} className="snap-start shrink-0 w-[62%] sm:w-[38%] lg:w-[23.5%]">
            <StoreProductCard product={p} variant="compact" />
          </div>
        ))}
      </div>

      <button
        onClick={() => scrollBy(-1)}
        className="hidden lg:flex absolute -left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg border border-gray-100 items-center justify-center text-gray-700 hover:text-gray-900 hover:shadow-xl transition-all"
        aria-label="Précédent"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={() => scrollBy(1)}
        className="hidden lg:flex absolute -right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg border border-gray-100 items-center justify-center text-gray-700 hover:text-gray-900 hover:shadow-xl transition-all"
        aria-label="Suivant"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 12. FAQ
 * ------------------------------------------------------------------ */

function Faq({ store }: { store: any }) {
  const [open, setOpen] = useState<number | null>(0);

  const currency = store.currency || 'MAD';
  const items = [
    {
      q: 'Comment se passe le paiement ?',
      a: store.enableCod
        ? "Vous ne payez rien à la commande. Le livreur encaisse le montant en espèces au moment de la remise du colis, après que vous l'ayez vérifié."
        : 'Le règlement se fait au moment de la commande via les moyens de paiement proposés au checkout.',
    },
    {
      q: 'Quels sont les délais de livraison ?',
      a: 'Les commandes validées avant la fin de journée partent le jour ouvré suivant. Comptez 24h dans les grandes villes et 48h pour le reste du Maroc.',
    },
    {
      q: 'Combien coûte la livraison ?',
      a:
        store.freeShippingThreshold && store.freeShippingThreshold > 0
          ? `La livraison est offerte à partir de ${money(store.freeShippingThreshold)} ${currency} d'achat. En dessous, elle est facturée ${money(store.standardShippingFee || 0)} ${currency}.`
          : store.standardShippingFee > 0
          ? `Les frais de livraison sont de ${money(store.standardShippingFee)} ${currency} par commande, quel que soit le nombre d'articles.`
          : 'La livraison est incluse dans le prix affiché, sans frais supplémentaires au moment de la commande.',
    },
    {
      q: 'Puis-je échanger un article ?',
      a: "Oui. Si l'article ne correspond pas à votre commande ou présente un défaut, contactez-nous sous 7 jours après réception et nous organisons l'échange.",
    },
    {
      q: 'Comment suivre ma commande ?',
      a: "Vous recevez un appel de confirmation puis un SMS avec le numéro de suivi dès l'expédition. Notre équipe reste joignable à tout moment pour vous situer le colis.",
    },
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)] gap-8 lg:gap-14">
        <div className="lg:sticky lg:top-44 lg:self-start">
          <span className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Aide</span>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mt-1">Questions fréquentes</h2>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Tout ce qu'il faut savoir avant de commander. Une question qui n'est pas ici ? Écrivez-nous, on répond
            vite.
          </p>
          {store.whatsappNumber && (
            <a
              href={`https://wa.me/${store.whatsappNumber.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors"
            >
              Poser une question
            </a>
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white divide-y divide-gray-100 overflow-hidden">
          {items.map((it, i) => (
            <div key={i}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-4 text-left hover:bg-gray-50/70 transition-colors"
                aria-expanded={open === i}
              >
                <span className="text-sm font-bold text-gray-900">{it.q}</span>
                <span className="w-7 h-7 shrink-0 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                  {open === i ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </span>
              </button>
              {open === i && <p className="px-5 sm:px-6 pb-5 -mt-1 text-sm text-gray-600 leading-relaxed">{it.a}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export default function StoreHomePage() {
  const { store } = useStore();
  const [sort, setSort] = useState<string>('newest');
  const [products, setProducts] = useState<any[]>([]);
  const [rail, setRail] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const primaryColor = store?.primaryColor || '#f97316';
  const storeId = store?.id;

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    storePublicApi
      .getProducts({ storeId, limit: 8, sort })
      .then((res) => {
        setProducts(res.data?.data?.products || []);
        setTotal(res.data?.data?.total || 0);
      })
      .catch((err) => console.error('Failed to fetch home products:', err))
      .finally(() => setLoading(false));
  }, [storeId, sort]);

  /** A second, independently sorted pull so the rail is not the grid again. */
  useEffect(() => {
    if (!storeId) return;
    storePublicApi
      .getProducts({ storeId, limit: 10, sort: 'price_desc' })
      .then((res) => setRail(res.data?.data?.products || []))
      .catch(() => setRail([]));
  }, [storeId]);

  if (!store) return null;

  // A home page built in Studio replaces the stock layout below. The blocks
  // stack here; the compiler is what draws rows and styled sections, and the
  // SPA is the fallback for whatever it declines.
  if (flatBlocks(store.homeStructure).length) {
    return <StoreDocument structure={store.homeStructure} kind="home" store={store} className="pb-16" />;
  }

  const hasProducts = products.length > 0;
  const currency = store.currency || 'MAD';

  return (
    <div className="pb-20">
      <HeroSlider store={store} primaryColor={primaryColor} />
      <UspStrip store={store} primaryColor={primaryColor} />

      <div className="space-y-16 sm:space-y-20 pt-14 sm:pt-16">
        <CategoryRail store={store} />

        {/* Catalogue with real sort tabs */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHead
            eyebrow="Le catalogue"
            title={hasProducts ? 'Nos produits' : 'Bientôt en rayon'}
            subtitle={total > 0 ? `${total} article${total > 1 ? 's' : ''} disponible${total > 1 ? 's' : ''}` : undefined}
            action={
              hasProducts ? (
                <Link
                  to="/products"
                  className="text-xs font-bold text-white px-5 py-2.5 rounded-full shadow-sm hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: primaryColor }}
                >
                  Voir tous les produits
                </Link>
              ) : undefined
            }
          />

          {(hasProducts || loading) && (
            <div className="flex items-center gap-2 overflow-x-auto pb-4 -mt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {SORT_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setSort(t.key)}
                  className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold border transition-all ${
                    sort === t.key
                      ? 'text-white border-transparent shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                  style={sort === t.key ? { backgroundColor: primaryColor } : undefined}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <ProductSkeleton key={n} />
              ))}
            </div>
          ) : hasProducts ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {products.map((p) => (
                <StoreProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <EmptyCatalogue store={store} primaryColor={primaryColor} />
          )}
        </section>

        {/* Promo panels */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-5">
            {PROMO_PANELS.map((p) => (
              <Link
                key={p.id}
                to={p.href}
                className="group relative rounded-3xl overflow-hidden h-64 sm:h-72 shadow-sm hover:shadow-xl transition-shadow"
              >
                <img
                  src={unsplash(p.id, 900, 600, 75)}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  loading="lazy"
                />
                <div
                  className={`absolute inset-0 ${
                    p.tone === 'dark'
                      ? 'bg-gradient-to-r from-black/80 via-black/45 to-transparent'
                      : 'bg-gradient-to-r from-white from-25% via-white/90 via-65% to-transparent'
                  }`}
                />
                <div className="absolute inset-0 flex flex-col justify-center p-7 sm:p-9 max-w-sm">
                  <span
                    className={`text-[11px] font-black uppercase tracking-[0.18em] ${
                      p.tone === 'dark' ? 'text-white/70' : 'text-gray-500'
                    }`}
                  >
                    {p.kicker}
                  </span>
                  <h3
                    className={`text-2xl sm:text-3xl font-black mt-2 leading-tight ${
                      p.tone === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {p.title}
                  </h3>
                  <p className={`text-sm mt-2.5 ${p.tone === 'dark' ? 'text-gray-200' : 'text-gray-600'}`}>{p.body}</p>
                  <span
                    className={`mt-5 inline-flex w-fit items-center gap-2 text-xs font-black uppercase tracking-wide group-hover:gap-3 transition-all ${
                      p.tone === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {p.cta} <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Premium rail — only when there is real stock to put in it */}
        {rail.length > 2 && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionHead
              eyebrow="Sélection"
              title="Les pièces les plus recherchées"
              subtitle="Notre haut de gamme, livré avec le même soin"
              action={
                <Link
                  to="/products?sort=price_desc"
                  className="text-xs font-bold text-gray-900 hover:underline flex items-center gap-1.5"
                >
                  Voir la sélection <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              }
            />
            <ProductRail products={rail} />
          </section>
        )}

        {/* How it works */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHead eyebrow="Simple" title="Commander en 3 étapes" subtitle="Aucune carte bancaire, aucun compte à créer" />
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              {
                icon: MousePointerClick,
                step: '01',
                title: 'Choisissez vos articles',
                body: 'Ajoutez au panier puis remplissez le formulaire : nom, téléphone, ville, adresse. Rien de plus.',
              },
              {
                icon: PackageCheck,
                step: '02',
                title: 'Nous confirmons par téléphone',
                body: 'Un conseiller vous rappelle pour valider la commande et l’adresse avant expédition.',
              },
              {
                icon: CreditCard,
                step: '03',
                title: store.enableCod ? 'Payez à la réception' : 'Recevez votre colis',
                body: store.enableCod
                  ? 'Vous ouvrez le colis, vous vérifiez, puis vous réglez le livreur en espèces.'
                  : 'Le livreur vous remet le colis dans le créneau convenu.',
              },
            ].map((s) => (
              <div
                key={s.step}
                className="relative bg-white rounded-2xl border border-gray-100 p-7 shadow-sm hover:shadow-lg transition-shadow"
              >
                <span className="absolute top-5 right-6 text-4xl font-black text-gray-100 select-none">{s.step}</span>
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm"
                  style={{ backgroundColor: primaryColor }}
                >
                  <s.icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-gray-900 mt-5">{s.title}</h3>
                <p className="text-sm text-gray-500 mt-2 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Lookbook */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHead eyebrow="Inspiration" title="Le lookbook de la saison" subtitle="Trois façons de porter nos essentiels" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5">
            {LOOKBOOK.map((shot, i) => (
              <Link
                key={shot.id}
                to={`/products?search=${encodeURIComponent(shot.query)}`}
                className={`group relative rounded-3xl overflow-hidden bg-gray-100 ${
                  i === 0 ? 'col-span-2 aspect-[4/3] sm:col-span-1 sm:aspect-[3/4]' : 'aspect-[3/4]'
                }`}
              >
                <img
                  src={unsplash(shot.id, 700, 933, 75)}
                  alt={shot.label}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <span className="text-white text-xl font-black">{shot.label}</span>
                  <span className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-white/80 group-hover:gap-2.5 transition-all">
                    Voir les pièces <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* COD trust banner */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl overflow-hidden bg-gray-900 text-white shadow-2xl">
            <img
              src={unsplash(EDITORIAL.counter, 1400, 700, 70)}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-25"
              loading="lazy"
            />
            <div className="relative grid lg:grid-cols-2 gap-8 p-8 sm:p-12 lg:p-14">
              <div>
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">Notre engagement</span>
                <h3 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">Commandez en toute confiance</h3>
                <p className="text-sm text-gray-300 mt-4 leading-relaxed max-w-lg">
                  {store.enableCod
                    ? 'Vous ne payez rien en ligne. Le colis vous est remis, vous le vérifiez, et vous réglez le livreur en espèces. Si le produit ne correspond pas, vous le refusez sur place.'
                    : 'Chaque commande est confirmée par téléphone avant expédition, et suivie jusqu’à votre porte par notre équipe.'}
                </p>
                <Link
                  to="/products"
                  className="mt-7 inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-white font-black text-sm shadow-xl hover:scale-[1.03] transition-transform"
                  style={{ backgroundColor: primaryColor }}
                >
                  Commencer mes achats <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 self-center">
                {[
                  { icon: Truck, label: 'Livraison 24/48h', sub: 'Toutes les villes' },
                  {
                    icon: ShieldCheck,
                    label: store.enableCod ? 'Paiement à la livraison' : 'Paiement sécurisé',
                    sub: store.enableCod ? 'Espèces, à la remise' : 'Au moment du checkout',
                  },
                  { icon: RefreshCw, label: 'Échange 7 jours', sub: 'Sans discussion' },
                  { icon: Headphones, label: 'Support 7j/7', sub: 'Téléphone & WhatsApp' },
                ].map((b) => (
                  <div key={b.label} className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4">
                    <b.icon className="w-5 h-5 mb-2.5" style={{ color: primaryColor }} />
                    <p className="text-xs font-black leading-tight">{b.label}</p>
                    <p className="text-[11px] text-gray-300 mt-1">{b.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Mood grid */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHead
            eyebrow="Notre univers"
            title={store.name}
            subtitle="Les matières, les couleurs et les détails qui font notre sélection"
          />
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3">
            {MOOD_GRID.map((id) => (
              <div key={id} className="relative aspect-square rounded-xl sm:rounded-2xl overflow-hidden bg-gray-100">
                <img
                  src={unsplash(id, 400, 400, 70)}
                  alt=""
                  className="w-full h-full object-cover hover:scale-110 transition-transform duration-700"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </section>

        <Faq store={store} />
      </div>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useStore } from '../../contexts/StoreContext';
import { useCart } from '../../contexts/CartContext';
import { storePublicApi } from '../../lib/api';
import { trackStoreViewContent } from '../../utils/storePixelTracking';
import StoreProductCard from '../../components/store/StoreProductCard';
import { productFallbackImage } from '../../lib/storeMedia';
import {
  ShoppingBag,
  Truck,
  ShieldCheck,
  RotateCcw,
  Check,
  Plus,
  Minus,
  MessageCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Flame,
  Headphones,
  PackageCheck,
} from 'lucide-react';

const money = (n: number) => new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 2 }).format(n);

/**
 * A delivery window the shopper can hold us to, phrased as an estimate.
 * Sunday is skipped on both ends because nothing moves that day.
 */
function deliveryWindow() {
  const bump = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  };
  return { from: bump(1), to: bump(3) };
}

function Accordion({ items }: { items: Array<{ title: string; body: React.ReactNode }> }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="rounded-2xl border border-gray-100 bg-white divide-y divide-gray-100 overflow-hidden">
      {items.map((it, i) => (
        <div key={it.title}>
          <button
            onClick={() => setOpen(open === i ? -1 : i)}
            className="w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-4 text-left hover:bg-gray-50/70 transition-colors"
            aria-expanded={open === i}
          >
            <span className="text-sm font-black text-gray-900">{it.title}</span>
            <span className="w-7 h-7 shrink-0 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
              {open === i ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </span>
          </button>
          {open === i && <div className="px-5 sm:px-6 pb-5 -mt-1 text-sm text-gray-600 leading-relaxed">{it.body}</div>}
        </div>
      ))}
    </div>
  );
}

export default function StoreProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { store, pixels } = useStore();
  const { addItem } = useCart();
  const navigate = useNavigate();

  const [productData, setProductData] = useState<any>(null);
  const [related, setRelated] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [imageIdx, setImageIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const primaryColor = store?.primaryColor || '#f97316';
  const currency = store?.currency || 'MAD';

  useEffect(() => {
    if (!store?.id || !slug) return;

    setLoading(true);
    setError(null);
    storePublicApi
      .getProduct(slug, store.id)
      .then((res) => {
        const data = res.data?.data;
        if (data?.product) {
          setProductData(data.product);
          setRelated(data.related || []);
          setImageIdx(0);
          setQuantity(1);

          trackStoreViewContent(pixels, {
            id: data.product.id,
            title: data.product.title,
            price: data.product.price,
            currency: store?.currency || 'MAD',
          });
        } else {
          setError('Produit introuvable');
        }
      })
      .catch((err) => {
        console.error('Failed to load product:', err);
        setError('Impossible de charger ce produit.');
      })
      .finally(() => setLoading(false));
  }, [store?.id, slug]);

  const p = productData;

  const images: string[] = useMemo(() => {
    if (!p) return [];
    const real = (p.images || []).map((i: any) => i.url).filter(Boolean);
    return real.length ? real : [productFallbackImage(p.id, 900)];
  }, [p]);

  const window_ = useMemo(deliveryWindow, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex justify-center">
        <div
          className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: primaryColor, borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  if (error || !p) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-gray-900">{error || 'Produit introuvable'}</h2>
        <Link to="/products" className="inline-block px-6 py-2.5 bg-gray-900 text-white font-bold text-xs rounded-xl">
          Retour au catalogue
        </Link>
      </div>
    );
  }

  const outOfStock = p.stockStatus === 'out_of_stock';
  const stockLeft = typeof p.stockQuantity === 'number' ? p.stockQuantity : null;
  const lowStock = !outOfStock && stockLeft !== null && stockLeft > 0 && stockLeft <= 5;
  /** Never let the stepper promise more units than the shop can ship. */
  const maxQty = outOfStock ? 0 : Math.min(99, stockLeft && stockLeft > 0 ? stockLeft : 99);
  const lineTotal = p.retailPriceMad * quantity;

  const cartPayload = () => ({
    productId: p.id,
    productName: p.nameFr,
    sku: p.sku,
    imageUrl: (p.images || [])[0]?.url || null,
    quantity,
    unitPriceMad: p.retailPriceMad,
  });

  const handleAddToCart = () => {
    if (outOfStock) return;
    addItem(cartPayload());
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  const handleBuyNow = () => {
    if (outOfStock) return;
    addItem(cartPayload(), false);
    navigate('/checkout');
  };

  const cleanWhatsApp = store?.whatsappNumber?.replace(/[^0-9]/g, '');
  const waProductUrl = cleanWhatsApp
    ? `https://wa.me/${cleanWhatsApp}?text=${encodeURIComponent(
        `Bonjour ${store?.name}, je souhaite commander le produit "${p.nameFr}" (${money(p.retailPriceMad)} ${currency}).`
      )}`
    : null;

  const shippingLine =
    store?.freeShippingThreshold && store.freeShippingThreshold > 0
      ? `Livraison offerte dès ${money(store.freeShippingThreshold)} ${currency} d'achat, sinon ${money(
          store.standardShippingFee || 0
        )} ${currency}.`
      : store?.standardShippingFee
      ? `Frais de livraison : ${money(store.standardShippingFee)} ${currency} par commande.`
      : 'Livraison incluse, sans frais supplémentaires à la commande.';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-14 pb-32 lg:pb-16">
      <nav className="flex items-center gap-2 text-xs font-semibold text-gray-500 flex-wrap">
        <Link to="/" className="hover:text-gray-900">
          Accueil
        </Link>
        <span>/</span>
        <Link to="/products" className="hover:text-gray-900">
          Produits
        </Link>
        <span>/</span>
        <span className="text-gray-900 truncate max-w-[16rem]">{p.nameFr}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-start">
        {/* Gallery */}
        <div className="lg:sticky lg:top-44 space-y-3">
          <div className="relative aspect-square bg-gray-50 rounded-3xl overflow-hidden border border-gray-100 shadow-sm">
            <img src={images[imageIdx]} alt={p.nameFr} className="w-full h-full object-cover" />

            <div className="absolute top-4 left-4 flex flex-col items-start gap-2">
              {outOfStock && (
                <span className="px-3 py-1.5 bg-gray-900/85 backdrop-blur-md text-white text-[11px] font-black uppercase tracking-wider rounded-xl">
                  Rupture de stock
                </span>
              )}
              {lowStock && (
                <span className="px-3 py-1.5 bg-rose-600 text-white text-[11px] font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5" />
                  Plus que {stockLeft} en stock
                </span>
              )}
            </div>

            {images.length > 1 && (
              <>
                <button
                  onClick={() => setImageIdx((i) => (i - 1 + images.length) % images.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm shadow-md flex items-center justify-center text-gray-700 hover:bg-white transition-colors"
                  aria-label="Photo précédente"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setImageIdx((i) => (i + 1) % images.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm shadow-md flex items-center justify-center text-gray-700 hover:bg-white transition-colors"
                  aria-label="Photo suivante"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <span className="absolute bottom-4 right-4 px-2.5 py-1 rounded-lg bg-black/55 backdrop-blur-sm text-white text-[11px] font-bold">
                  {imageIdx + 1} / {images.length}
                </span>
              </>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {images.map((url, idx) => (
                <button
                  key={url + idx}
                  onClick={() => setImageIdx(idx)}
                  className={`w-20 h-20 rounded-2xl overflow-hidden shrink-0 border-2 transition-all ${
                    imageIdx === idx ? 'shadow-md' : 'border-gray-100 hover:border-gray-300'
                  }`}
                  style={imageIdx === idx ? { borderColor: primaryColor } : undefined}
                  aria-label={`Photo ${idx + 1}`}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Buy box */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {/* The old page claimed "En stock" for every product, including
                  the ones that were not. This follows the row. */}
              {outOfStock ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                  Momentanément indisponible
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                  <Check className="w-3 h-3" />
                  En stock — expédié sous 24h
                </span>
              )}
              <span className="text-[11px] text-gray-400 font-mono">RÉF : {p.sku}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-[2.5rem] font-black text-gray-900 tracking-tight leading-[1.1]">
              {p.nameFr}
            </h1>
            {p.nameAr && (
              <p className="text-base text-left text-gray-500 mt-1.5 font-arabic" dir="rtl">
                {p.nameAr}
              </p>
            )}
          </div>

          <div className="flex items-end gap-3 flex-wrap pb-6 border-b border-gray-100">
            <span className="text-4xl font-black leading-none" style={{ color: primaryColor }}>
              {money(p.retailPriceMad)}
              <span className="text-lg font-bold text-gray-500 ml-1.5">{currency}</span>
            </span>
            {store?.enableCod && (
              <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg">
                Paiement à la livraison
              </span>
            )}
          </div>

          {p.description && <p className="text-sm text-gray-600 leading-relaxed">{p.description}</p>}

          {/* Delivery estimate — the question every COD shopper asks first. */}
          <div className="flex items-start gap-3 rounded-2xl bg-gray-50 border border-gray-100 p-4">
            <PackageCheck className="w-5 h-5 mt-0.5 shrink-0" style={{ color: primaryColor }} />
            <div className="text-sm">
              <p className="font-bold text-gray-900">
                Livraison estimée entre {window_.from} et {window_.to}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{shippingLine}</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500">Quantité</label>
            <div className="flex items-center gap-4">
              <div className="flex items-center border border-gray-200 rounded-2xl bg-white p-1">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                  aria-label="Diminuer la quantité"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-12 text-center text-sm font-black text-gray-900">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                  disabled={quantity >= maxQty}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                  aria-label="Augmenter la quantité"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {quantity > 1 && (
                <span className="text-sm text-gray-500">
                  Total :{' '}
                  <strong className="text-gray-900 font-black">
                    {money(lineTotal)} {currency}
                  </strong>
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                onClick={handleAddToCart}
                disabled={outOfStock}
                className={`flex-1 py-3.5 px-6 font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-2 ${
                  outOfStock
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : added
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-900 hover:bg-black text-white shadow-md'
                }`}
              >
                {added ? <Check className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
                {added ? 'Ajouté au panier' : 'Ajouter au panier'}
              </button>
            </div>

            <button
              onClick={handleBuyNow}
              disabled={outOfStock}
              className={`w-full py-4 px-6 text-white font-black text-base rounded-2xl transition-all flex items-center justify-center gap-2 ${
                outOfStock ? 'bg-gray-300 cursor-not-allowed' : 'shadow-xl hover:scale-[1.01]'
              }`}
              style={outOfStock ? undefined : { backgroundColor: primaryColor }}
            >
              {outOfStock
                ? 'Produit indisponible'
                : store?.enableCod
                ? 'Commander — paiement à la livraison'
                : 'Commander maintenant'}
              {!outOfStock && <ArrowRight className="w-5 h-5" />}
            </button>

            {waProductUrl && (
              <a
                href={waProductUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-2xl transition-colors flex items-center justify-center gap-2 border border-emerald-200/60"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                Commander via WhatsApp
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            {[
              { Icon: Truck, label: 'Livraison 24/48h', sub: 'Partout au Maroc' },
              {
                Icon: ShieldCheck,
                label: store?.enableCod ? 'Payez à la réception' : 'Paiement sécurisé',
                sub: store?.enableCod ? 'Après vérification' : 'Au checkout',
              },
              { Icon: RotateCcw, label: 'Échange 7 jours', sub: 'Article non conforme' },
              { Icon: Headphones, label: 'Support 7j/7', sub: 'Téléphone & WhatsApp' },
            ].map((b) => (
              <div key={b.label} className="flex items-center gap-2.5 rounded-2xl border border-gray-100 bg-white p-3">
                <b.Icon className="w-[18px] h-[18px] shrink-0" style={{ color: primaryColor }} />
                <div className="min-w-0">
                  <p className="text-[11px] font-black text-gray-900 leading-tight">{b.label}</p>
                  <p className="text-[10px] text-gray-500 leading-tight mt-0.5">{b.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Accordion
        items={[
          {
            title: 'Description détaillée',
            body: p.longDescription ? (
              <div className="prose prose-sm max-w-none text-gray-600" dangerouslySetInnerHTML={{ __html: p.longDescription }} />
            ) : (
              <p>{p.description || 'Aucune description supplémentaire pour cet article.'}</p>
            ),
          },
          {
            title: 'Livraison & paiement',
            body: (
              <div className="space-y-2">
                <p>{shippingLine}</p>
                <p>
                  Livraison estimée entre {window_.from} et {window_.to} après confirmation téléphonique de votre
                  commande.
                </p>
                {store?.enableCod && (
                  <p>
                    Vous ne réglez rien en ligne : le livreur encaisse le montant en espèces à la remise du colis, une
                    fois que vous l'avez vérifié.
                  </p>
                )}
              </div>
            ),
          },
          {
            title: 'Échange & garantie',
            body: (
              <p>
                Si l'article reçu ne correspond pas à votre commande ou présente un défaut, contactez-nous sous 7 jours
                après réception et nous organisons l'échange. Notre service client reste joignable 7j/7 par téléphone et
                sur WhatsApp.
              </p>
            ),
          },
        ]}
      />

      {related.length > 0 && (
        <section className="space-y-6 pt-6 border-t border-gray-100">
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Sélection</span>
              <h2 className="text-2xl font-black text-gray-900 mt-1">Vous aimerez aussi</h2>
            </div>
            <Link to="/products" className="text-xs font-bold text-gray-900 hover:underline flex items-center gap-1.5">
              Voir tout <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {related.map((rp) => (
              <StoreProductCard key={rp.id} product={rp} />
            ))}
          </div>
        </section>
      )}

      {/* Sticky buy bar. It sits one bar-height up so it stacks on top of the
          storefront's mobile navigation instead of underneath it. */}
      <div className="fixed bottom-16 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-3 lg:hidden shadow-[0_-4px_16px_rgba(0,0,0,0.06)] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[10px] text-gray-500 block leading-none">
            {quantity > 1 ? `${quantity} articles` : 'Total'}
          </span>
          <span className="text-base font-black text-gray-900">
            {money(lineTotal)} {currency}
          </span>
        </div>
        <button
          onClick={handleBuyNow}
          disabled={outOfStock}
          className={`flex-1 max-w-[60%] py-3 px-4 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 ${
            outOfStock ? 'bg-gray-300 cursor-not-allowed' : ''
          }`}
          style={outOfStock ? undefined : { backgroundColor: primaryColor }}
        >
          {outOfStock ? 'Indisponible' : 'Commander'}
          {!outOfStock && <ArrowRight className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { useStore } from '../../contexts/StoreContext';
import { ShoppingBag, Eye, Check, Truck, Flame } from 'lucide-react';
import { productFallbackImage } from '../../lib/storeMedia';

export interface StoreProductCardProps {
  product: {
    id: number;
    sku: string;
    ref: string;
    nameFr: string;
    nameAr?: string | null;
    description?: string | null;
    retailPriceMad: number;
    stockQuantity?: number;
    stockStatus?: string;
    images?: Array<{ id: number; url: string; sortOrder?: number }>;
    categories?: Array<{ id: number; nameFr: string; slug: string }>;
    wholesalePacks?: Array<{ minQuantity: number; pricePerUnitMad: number }>;
  };
  /** `compact` drops the reassurance line for dense rails; the grid uses `full`. */
  variant?: 'full' | 'compact';
}

const money = (n: number) => new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 2 }).format(n);

export default function StoreProductCard({ product, variant = 'full' }: StoreProductCardProps) {
  const { addItem } = useCart();
  const { store } = useStore();
  const [added, setAdded] = useState(false);

  const primaryColor = store?.primaryColor || '#f97316';
  const images = product.images || [];
  const mainImage = images[0]?.url || productFallbackImage(product.id);
  /** Swapping to shot two on hover is the one storefront trick that reliably
   *  lifts click-through; products with a single photo simply keep it. */
  const hoverImage = images[1]?.url || null;
  const targetUrl = `/p/${product.ref || product.id}`;

  const outOfStock = product.stockStatus === 'out_of_stock';
  const lowStock =
    !outOfStock && typeof product.stockQuantity === 'number' && product.stockQuantity > 0 && product.stockQuantity <= 5;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock) return;

    addItem({
      productId: product.id,
      productName: product.nameFr,
      sku: product.sku,
      imageUrl: images[0]?.url || null,
      quantity: 1,
      unitPriceMad: product.retailPriceMad,
    });

    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  };

  return (
    <div className="group relative bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl hover:border-gray-200 transition-all duration-300 flex flex-col h-full">
      <Link to={targetUrl} className="relative aspect-square bg-gray-50 overflow-hidden block">
        <img
          src={mainImage}
          alt={product.nameFr}
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ${
            hoverImage ? 'group-hover:opacity-0' : 'group-hover:scale-105'
          }`}
          loading="lazy"
        />
        {hoverImage && (
          <img
            src={hoverImage}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
            loading="lazy"
          />
        )}

        {/* Badge column — stock state first, it is the one that changes a decision. */}
        <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5 z-10">
          {outOfStock && (
            <span className="px-2.5 py-1 bg-gray-900/85 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-wider rounded-lg">
              Rupture
            </span>
          )}
          {lowStock && (
            <span className="px-2.5 py-1 bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1 shadow-sm">
              <Flame className="w-3 h-3" />
              Plus que {product.stockQuantity}
            </span>
          )}
          {product.categories && product.categories[0] && (
            <span className="px-2.5 py-1 bg-white/85 backdrop-blur-md text-gray-700 text-[10px] font-bold uppercase tracking-wider rounded-lg">
              {product.categories[0].nameFr}
            </span>
          )}
        </div>

        {/* Hover affordance, desktop only — on touch the whole tile is the target. */}
        <div className="absolute inset-x-0 bottom-0 p-3 hidden sm:flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="px-4 py-2 bg-white/95 backdrop-blur-sm text-gray-900 text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 translate-y-2 group-hover:translate-y-0 transition-transform">
            <Eye className="w-3.5 h-3.5" />
            Voir le produit
          </span>
        </div>
      </Link>

      <div className="p-4 flex-1 flex flex-col">
        {variant === 'full' && (
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 mb-2">
            <Truck className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">Paiement à la livraison</span>
            <span className="hidden sm:inline">Livraison 24/48h · Paiement à la livraison</span>
          </div>
        )}

        <Link to={targetUrl} className="block">
          <h3 className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug group-hover:underline decoration-2 underline-offset-2">
            {product.nameFr}
          </h3>
        </Link>
        {product.nameAr && (
          <p className="text-xs text-left text-gray-400 mt-1 line-clamp-1 font-arabic" dir="rtl">
            {product.nameAr}
          </p>
        )}

        <div className="mt-auto pt-3 flex items-end justify-between gap-2">
          <div className="leading-none">
            <span className="text-lg font-black text-gray-900">{money(product.retailPriceMad)}</span>
            <span className="text-xs font-bold text-gray-500 ml-1">{store?.currency || 'MAD'}</span>
          </div>

          <button
            onClick={handleQuickAdd}
            disabled={outOfStock}
            className={`px-3 py-2.5 rounded-xl text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 ${
              outOfStock ? 'bg-gray-300 cursor-not-allowed' : 'hover:opacity-95 active:scale-95'
            }`}
            style={outOfStock ? undefined : { backgroundColor: added ? '#059669' : primaryColor }}
            title={outOfStock ? 'Produit indisponible' : 'Ajouter au panier'}
            aria-label={outOfStock ? 'Produit indisponible' : 'Ajouter au panier'}
          >
            {added ? <Check className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
            <span className="hidden sm:inline">{added ? 'Ajouté' : 'Ajouter'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { useStore } from '../../contexts/StoreContext';
import { ShoppingBag, Trash2, Plus, Minus, ArrowRight, ArrowLeft, Truck, ShieldCheck } from 'lucide-react';

export default function StoreCartPage() {
  const {
    items,
    removeItem,
    updateQuantity,
    clearCart,
    subtotalMad,
    shippingFeeMad,
    totalAmountMad,
    freeShippingRemainingMad,
  } = useCart();
  const { store } = useStore();
  const navigate = useNavigate();

  const primaryColor = store?.primaryColor || '#f97316';

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-300 mx-auto">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-black text-gray-900">Votre panier est vide</h1>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Vous n'avez pas encore sélectionné d'articles. Découvrez notre catalogue pour commander !
        </p>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 px-8 py-3.5 text-white font-bold text-sm rounded-2xl shadow-lg hover:opacity-95"
          style={{ backgroundColor: primaryColor }}
        >
          <span>Découvrir nos produits</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Mon Panier</h1>
          <p className="text-xs text-gray-500 mt-1">{items.length} articles sélectionnés</p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs font-bold text-gray-400 hover:text-red-600 transition-colors"
        >
          Vider le panier
        </button>
      </div>

      {/* Free Shipping Alert */}
      {store?.freeShippingThreshold !== null && store?.freeShippingThreshold !== undefined && store.freeShippingThreshold > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-3 text-xs font-semibold text-amber-900">
          <Truck className="w-5 h-5 text-amber-600 flex-shrink-0" />
          {freeShippingRemainingMad && freeShippingRemainingMad > 0 ? (
            <span>
              Ajoutez encore <strong>{freeShippingRemainingMad} MAD</strong> de produits pour bénéficier de la <strong>livraison 100% gratuite</strong> !
            </span>
          ) : (
            <span className="text-emerald-800 font-bold">Félicitations ! Vous bénéficiez de la livraison gratuite sur votre commande.</span>
          )}
        </div>
      )}

      {/* Main Cart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Items Table */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 p-6 shadow-xs divide-y divide-gray-100">
          {items.map((item, idx) => (
            <div key={`${item.productId}-${item.variantOptionId || idx}`} className="py-5 first:pt-0 last:pb-0 flex gap-4 sm:gap-6 items-center">
              {/* Product Thumbnail */}
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                ) : (
                  <ShoppingBag className="w-8 h-8 text-gray-300" />
                )}
              </div>

              {/* Product Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-gray-900 truncate">{item.productName}</h3>
                {item.variantName && (
                  <p className="text-xs text-gray-500 font-medium mt-0.5">{item.variantName}</p>
                )}
                <span className="text-xs font-bold text-gray-400 block mt-1">{item.unitPriceMad} MAD / unité</span>
              </div>

              {/* Quantity Stepper */}
              <div className="flex items-center border border-gray-200 rounded-xl bg-gray-50/50 p-1">
                <button
                  onClick={() => updateQuantity(item.productId, item.variantOptionId, item.quantity - 1)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:bg-white"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-8 text-center text-xs font-black text-gray-900">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.productId, item.variantOptionId, item.quantity + 1)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-600 hover:bg-white"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Total & Remove */}
              <div className="text-right flex flex-col items-end gap-2">
                <span className="text-base font-black text-gray-900">{item.totalPriceMad} MAD</span>
                <button
                  onClick={() => removeItem(item.productId, item.variantOptionId)}
                  className="text-gray-400 hover:text-red-500 p-1"
                  aria-label="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary Card */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-md space-y-6">
          <h2 className="text-lg font-black text-gray-900">Résumé de la commande</h2>

          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Sous-total articles</span>
              <span className="font-bold text-gray-900">{subtotalMad} MAD</span>
            </div>
            <div className="flex justify-between">
              <span>Livraison estimée</span>
              <span className="font-bold text-gray-900">
                {shippingFeeMad === 0 ? <span className="text-emerald-600 font-bold">Gratuite</span> : `${shippingFeeMad} MAD`}
              </span>
            </div>
            <div className="flex justify-between text-base font-black text-gray-900 pt-4 border-t border-gray-100">
              <span>Total à payer (COD)</span>
              <span className="text-xl" style={{ color: primaryColor }}>{totalAmountMad} MAD</span>
            </div>
          </div>

          <button
            onClick={() => navigate('/checkout')}
            className="w-full py-4 text-white font-black text-sm rounded-2xl shadow-xl hover:opacity-95 transition-all flex items-center justify-center gap-2"
            style={{ backgroundColor: primaryColor }}
          >
            <span>Passer à la caisse</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 text-xs text-gray-400 justify-center">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Paiement 100% en espèces à la livraison</span>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { useStore } from '../../contexts/StoreContext';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, Truck } from 'lucide-react';

export default function StoreCartDrawer() {
  const {
    items,
    removeItem,
    updateQuantity,
    isDrawerOpen,
    setIsDrawerOpen,
    subtotalMad,
    shippingFeeMad,
    totalAmountMad,
    freeShippingRemainingMad,
  } = useCart();
  const { store } = useStore();
  const navigate = useNavigate();

  if (!isDrawerOpen) return null;

  const primaryColor = store?.primaryColor || '#f97316';

  const handleCheckoutClick = () => {
    setIsDrawerOpen(false);
    navigate('/checkout');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fadeIn">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={() => setIsDrawerOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-gray-900" />
              <h2 className="text-lg font-black text-gray-900">Mon Panier</h2>
              <span className="text-xs font-bold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                {items.length} {items.length > 1 ? 'articles' : 'article'}
              </span>
            </div>
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="p-2 -mr-2 text-gray-400 hover:text-gray-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free Shipping Progress Indicator */}
          {store?.freeShippingThreshold !== null && store?.freeShippingThreshold !== undefined && store.freeShippingThreshold > 0 && (
            <div className="px-5 py-3 bg-amber-50/70 border-b border-amber-100/80">
              {freeShippingRemainingMad && freeShippingRemainingMad > 0 ? (
                <div className="text-xs font-semibold text-amber-900">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Truck className="w-4 h-4 text-amber-600" />
                    <span>
                      Plus que <strong className="text-amber-950 font-black">{freeShippingRemainingMad} MAD</strong> pour profiter de la <strong>livraison gratuite</strong> !
                    </span>
                  </div>
                  <div className="w-full bg-amber-200/70 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, (subtotalMad / store.freeShippingThreshold) * 100)}%`,
                        backgroundColor: primaryColor,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                  <Truck className="w-4 h-4 text-emerald-600" />
                  <span>Félicitations ! La livraison est 100% gratuite pour votre commande.</span>
                </div>
              )}
            </div>
          )}

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-5 divide-y divide-gray-100">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-4">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-gray-900">Votre panier est vide</h3>
                <p className="text-xs text-gray-500 mt-1 max-w-xs">
                  Découvrez nos produits et ajoutez vos coups de cœur au panier !
                </p>
                <button
                  onClick={() => {
                    setIsDrawerOpen(false);
                    navigate('/products');
                  }}
                  className="mt-6 px-6 py-2.5 text-xs font-bold text-white rounded-xl shadow-sm hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: primaryColor }}
                >
                  Découvrir les produits
                </button>
              </div>
            ) : (
              items.map((item, idx) => (
                <div key={`${item.productId}-${item.variantOptionId || idx}`} className="py-4 first:pt-0 flex gap-4">
                  {/* Thumbnail */}
                  <div className="w-20 h-20 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                    ) : (
                      <ShoppingBag className="w-6 h-6 text-gray-300" />
                    )}
                  </div>

                  {/* Info & Stepper */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-bold text-gray-900 line-clamp-1">{item.productName}</h4>
                        <button
                          onClick={() => removeItem(item.productId, item.variantOptionId)}
                          className="text-gray-400 hover:text-red-500 p-1 -mr-1"
                          aria-label="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {item.variantName && (
                        <p className="text-xs font-medium text-gray-500 mt-0.5">{item.variantName}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      {/* Quantity Stepper */}
                      <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50/50">
                        <button
                          onClick={() => updateQuantity(item.productId, item.variantOptionId, item.quantity - 1)}
                          className="p-1.5 text-gray-600 hover:text-gray-900"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-7 text-center text-xs font-bold text-gray-900">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.variantOptionId, item.quantity + 1)}
                          className="p-1.5 text-gray-600 hover:text-gray-900"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Line Price */}
                      <span className="text-sm font-black text-gray-900">{item.totalPriceMad} MAD</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Checkout Summary */}
          {items.length > 0 && (
            <div className="p-5 border-t border-gray-100 bg-gray-50/50 space-y-3">
              <div className="space-y-1.5 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Sous-total</span>
                  <span className="font-bold text-gray-900">{subtotalMad} MAD</span>
                </div>
                <div className="flex justify-between">
                  <span>Frais de livraison</span>
                  <span className="font-bold text-gray-900">
                    {shippingFeeMad === 0 ? <span className="text-emerald-600 font-bold">Gratuit</span> : `${shippingFeeMad} MAD`}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-black text-gray-900 pt-2 border-t border-gray-200">
                  <span>Total (TTC)</span>
                  <span className="text-base" style={{ color: primaryColor }}>
                    {totalAmountMad} MAD
                  </span>
                </div>
              </div>

              <button
                onClick={handleCheckoutClick}
                className="w-full py-3.5 px-4 text-white font-black text-sm rounded-xl shadow-md hover:opacity-95 transition-all flex items-center justify-center gap-2"
                style={{ backgroundColor: primaryColor }}
              >
                <span>Passer la commande (Paiement à la livraison)</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-[11px] text-center text-gray-400 font-medium">
                Paiement en espèces à la réception de votre colis.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { useStore } from '../../contexts/StoreContext';
import { storePublicApi, api } from '../../lib/api';
import { trackStoreInitiateCheckout } from '../../utils/storePixelTracking';
import { makeCapiEventId, readCookie, fbcValue } from '../../utils/capi';
import toast from 'react-hot-toast';
import {
  ShieldCheck,
  Truck,
  CheckCircle2,
  Lock,
  Phone,
  User,
  MapPin,
  FileText,
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';

export default function StoreCheckoutPage() {
  const { items, subtotalMad, shippingFeeMad, totalAmountMad, clearCart, hydrated } = useCart();
  const { store, vendor, pixels } = useStore();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const [citiesList, setCitiesList] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sessionIdRef = useRef<string>(`ck_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
  const initiatedRef = useRef(false);

  const primaryColor = store?.primaryColor || '#f97316';

  // Fire InitiateCheckout on checkout mount
  useEffect(() => {
    if (items.length > 0 && !initiatedRef.current) {
      initiatedRef.current = true;
      trackStoreInitiateCheckout(pixels, {
        value: totalAmountMad,
        numItems: items.length,
        currency: store?.currency || 'MAD',
      });
    }
  }, [items.length, pixels, totalAmountMad, store?.currency]);

  // Fetch deliverable Moroccan cities
  useEffect(() => {
    api
      .get('/public/cities')
      .then((res) => {
        setCitiesList(res.data?.data?.cities || []);
      })
      .catch((err) => console.error('Failed to load cities:', err));
  }, []);

  // Redirect if cart is empty
  useEffect(() => {
    // `hydrated` guards a refresh landing straight on /checkout: the cart is
    // read back only once the store resolves, and redirecting before that
    // bounced shoppers with a full cart back to /cart.
    if (hydrated && items.length === 0 && !isSubmitting) {
      navigate('/cart');
    }
  }, [hydrated, items.length, isSubmitting, navigate]);

  // Telemetry: Debounced abandoned cart progress beacon
  useEffect(() => {
    const fieldsCount = [fullName, phone, city, address].filter((f) => f.trim().length > 0).length;
    if (fieldsCount === 0 || !store?.id) return;

    const timer = setTimeout(() => {
      fetch('/api/v1/public/checkout-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sid: sessionIdRef.current,
          fields: { fullName, phone, city, address },
          filled: fieldsCount,
          code: store.slug,
          productName: items.map((i) => `${i.quantity}x ${i.productName}`).join(', '),
          path: window.location.pathname,
        }),
      }).catch(() => {});
    }, 800);

    return () => clearTimeout(timer);
  }, [fullName, phone, city, address, store?.id, store?.slug, items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast.error('Veuillez entrer votre nom complet.');
      return;
    }

    const cleanPhone = phone.replace(/[\s-]/g, '');
    if (!cleanPhone || cleanPhone.length < 9) {
      toast.error('Veuillez entrer un numéro de téléphone valide.');
      return;
    }

    if (!city.trim()) {
      toast.error('Veuillez sélectionner votre ville de livraison.');
      return;
    }

    if (!address.trim()) {
      toast.error('Veuillez entrer votre adresse de livraison.');
      return;
    }

    if (items.length === 0) {
      toast.error('Votre panier est vide.');
      return;
    }

    try {
      setIsSubmitting(true);

      const capiEventId = makeCapiEventId();
      const fbp = readCookie('_fbp') || undefined;
      const fbc = fbcValue() || undefined;

      const payload = {
        storeId: store!.id,
        fullName: fullName.trim(),
        phone: cleanPhone,
        city: city.trim(),
        address: address.trim(),
        notes: notes.trim() || undefined,
        cartItems: items.map((it) => ({
          productId: it.productId,
          variantName: it.variantName || undefined,
          variantOptionId: it.variantOptionId || undefined,
          quantity: it.quantity,
        })),
        checkoutSessionId: sessionIdRef.current,
        eventSourceUrl: window.location.href,
        capiEventId,
        fbp,
        fbc,
      };

      const res = await storePublicApi.checkout(payload);
      const data = res.data?.data;

      // Clear basket upon successful order
      clearCart();

      // Navigate to order confirmation
      navigate('/order-confirmed', {
        replace: true,
        state: {
          order: { ...(data || {}), capiEventId },
          storeName: store?.name,
          storePhone: store?.contactPhone || store?.whatsappNumber,
        },
      });
    } catch (err: any) {
      console.error('Checkout error:', err);
      toast.error(err?.response?.data?.message || 'Une erreur est survenue. Veuillez réessayer.');
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Step Indicator */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <Link to="/cart" className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900">
            <ArrowLeft className="w-4 h-4" />
            <span>Modifier le panier</span>
          </Link>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Commande 100% Sécurisée (Paiement à la livraison)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form Side (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-md space-y-6">
            <div>
              <h1 className="text-2xl font-black text-gray-900">Informations de Livraison</h1>
              <p className="text-xs text-gray-500 mt-1">
                Remplissez le formulaire ci-dessous pour valider votre commande. Vous paierez en espèces à la livraison.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  <span>Nom Complet *</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Mohammed Alami"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  <span>Numéro de Téléphone * (Pour confirmation et livraison)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                    🇲🇦 +212
                  </span>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="06 12 34 56 78"
                    className="w-full pl-20 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* City Dropdown */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  <span>Ville de Livraison *</span>
                </label>
                <select
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Sélectionnez votre ville...</option>
                  {citiesList.map((c: any) => (
                    <option key={c.id || c.name} value={c.nameFr || c.name}>
                      {c.nameFr || c.name} {c.nameAr ? `(${c.nameAr})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  <span>Adresse / Quartier *</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex: N° 12, Rue Hassan II, Quartier Al Qods..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>

              {/* Additional Notes */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-gray-400" />
                  <span>Notes pour le livreur (Optionnel)</span>
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Appeler avant d'arriver..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Submit CTA */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 px-6 text-white font-black text-base rounded-2xl shadow-xl hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  style={{ backgroundColor: primaryColor }}
                >
                  {isSubmitting ? (
                    <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Confirmer la commande ({totalAmountMad} MAD)</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
                <p className="text-[11px] text-center text-gray-400 mt-2">
                  En cliquant sur confirmer, vous acceptez d'être contacté par notre service client pour la confirmation du colis.
                </p>
              </div>
            </form>
          </div>

          {/* Order Summary Side (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-md space-y-6">
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              <span>Articles ({items.length})</span>
            </h2>

            {/* Items List */}
            <div className="space-y-4 max-h-80 overflow-y-auto pr-1 divide-y divide-gray-100">
              {items.map((item, idx) => (
                <div key={idx} className="pt-3 first:pt-0 flex gap-3 items-center">
                  <div className="w-14 h-14 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                    ) : (
                      <ShoppingBag className="w-5 h-5 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-gray-900 truncate">{item.productName}</h4>
                    {item.variantName && (
                      <p className="text-[11px] text-gray-500">{item.variantName}</p>
                    )}
                    <span className="text-[11px] font-bold text-gray-400">Qté: {item.quantity}</span>
                  </div>
                  <span className="text-xs font-black text-gray-900">{item.totalPriceMad} MAD</span>
                </div>
              ))}
            </div>

            {/* Price Calculations */}
            <div className="pt-4 border-t border-gray-100 space-y-2.5 text-xs text-gray-600">
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
              <div className="flex justify-between text-sm font-black text-gray-900 pt-3 border-t border-gray-200">
                <span>Total à payer à la livraison</span>
                <span className="text-lg" style={{ color: primaryColor }}>{totalAmountMad} MAD</span>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="bg-emerald-50/60 rounded-2xl p-4 border border-emerald-100/80 space-y-2 text-xs font-semibold text-emerald-950">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Paiement en espèces à la livraison (COD)</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Expédition rapide en 24h à 48h</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Vérifiez votre colis avant de payer</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

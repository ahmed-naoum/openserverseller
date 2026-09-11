import React, { useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useStore } from '../../contexts/StoreContext';
import { trackStorePurchase } from '../../utils/storePixelTracking';
import { CheckCircle2, ShoppingBag, Truck, Phone, MessageCircle, ArrowRight, Package } from 'lucide-react';

export default function StoreThankYouPage() {
  const location = useLocation();
  const { store, pixels } = useStore();
  const state = (location.state as any) || {};
  const order = state.order || null;
  const firedRef = useRef(false);

  // Track purchase event once
  useEffect(() => {
    if (!order || firedRef.current) return;
    firedRef.current = true;

    trackStorePurchase(pixels, {
      reference: order.reference,
      totalAmountMad: order.totalAmountMad || 0,
      currency: store?.currency || 'MAD',
      capiEventId: order.capiEventId,
    });
  }, [order, pixels, store?.currency]);

  const primaryColor = store?.primaryColor || '#f97316';

  const cleanWhatsApp = store?.whatsappNumber?.replace(/[^0-9]/g, '');
  const waOrderUrl = cleanWhatsApp && order?.reference
    ? `https://wa.me/${cleanWhatsApp}?text=${encodeURIComponent(
        `Bonjour ${store?.name}, j'ai passé la commande N° ${order.reference} et je souhaite avoir des informations.`
      )}`
    : null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
      <div className="bg-white rounded-3xl border border-gray-100 p-8 sm:p-12 shadow-xl space-y-8 text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner animate-bounce">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        {/* Confirmation Header */}
        <div className="space-y-2">
          {/* "Reçue", not "Confirmée". Nothing is confirmed until an agent has
              phoned the customer — that call is what creates the order and the
              parcel, and promising otherwise here is what generates the "where
              is my package" tickets. */}
          <span className="text-xs font-black uppercase tracking-wider text-emerald-600">Commande Reçue</span>
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
            Merci pour votre commande !
          </h1>
          <p className="text-sm text-gray-600 max-w-md mx-auto">
            Votre commande a bien été enregistrée. Notre service client va vous contacter par téléphone pour confirmer l'expédition de votre colis.
          </p>
        </div>

        {/* Order Details Card */}
        {order && (
          <div className="bg-gray-50/80 rounded-2xl p-6 border border-gray-100 text-left space-y-4 max-w-lg mx-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <span className="text-xs text-gray-500 font-bold">Référence</span>
              <span className="text-sm font-mono font-black text-gray-900">{order.reference}</span>
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <span className="text-xs text-gray-500 font-bold">Destinataire</span>
              <span className="text-xs font-bold text-gray-900">{order.customerName} ({order.customerPhone})</span>
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <span className="text-xs text-gray-500 font-bold">Ville de livraison</span>
              <span className="text-xs font-bold text-gray-900">{order.customerCity}</span>
            </div>

            <div className="flex items-center justify-between pt-1 text-sm font-black text-gray-900">
              <span>Montant Total à payer (COD)</span>
              <span className="text-base" style={{ color: primaryColor }}>{order.totalAmountMad} MAD</span>
            </div>
          </div>
        )}

        {/* Next Steps Box */}
        <div className="bg-orange-50/50 rounded-2xl p-5 border border-orange-100 max-w-lg mx-auto text-left space-y-2">
          <h4 className="text-xs font-black text-orange-950 uppercase tracking-wider flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-orange-600" />
            <span>Prochaines étapes</span>
          </h4>
          <ul className="text-xs text-orange-900 space-y-1 list-disc list-inside">
            <li>Notre opératrice va vous appeler pour valider votre adresse.</li>
            <li>Le livreur vous contactera dès son arrivée chez vous.</li>
            <li>Vous vérifiez le colis et réglez le montant en espèces au livreur.</li>
          </ul>
        </div>

        {/* WhatsApp & Home Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          {waOrderUrl && (
            <a
              href={waOrderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl transition-colors flex items-center justify-center gap-2 shadow-md"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Contacter le support WhatsApp</span>
            </a>
          )}

          <Link
            to="/"
            className="w-full sm:w-auto px-6 py-3.5 bg-gray-900 hover:bg-black text-white font-bold text-xs rounded-2xl transition-colors flex items-center justify-center gap-2 shadow-md"
          >
            <span>Retourner à la boutique</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

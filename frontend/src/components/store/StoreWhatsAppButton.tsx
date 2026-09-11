import React from 'react';
import { useStore } from '../../contexts/StoreContext';
import { MessageCircle } from 'lucide-react';

export default function StoreWhatsAppButton() {
  const { store } = useStore();

  if (!store?.whatsappNumber) return null;

  const cleanNumber = store.whatsappNumber.replace(/[^0-9]/g, '');
  const message = encodeURIComponent(`Bonjour ${store.name}, je souhaite avoir plus d'informations sur vos produits.`);
  const url = `https://wa.me/${cleanNumber}?text=${message}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="hidden lg:flex fixed bottom-6 right-6 z-40 p-4 rounded-full bg-emerald-500 text-white shadow-xl hover:bg-emerald-600 hover:scale-105 transition-all duration-300 flex items-center justify-center group"
      aria-label="Contactez-nous sur WhatsApp"
    >
      <MessageCircle className="w-7 h-7 fill-white/20" />
      <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 ease-in-out font-bold text-xs pl-0 group-hover:pl-2">
        WhatsApp
      </span>
    </a>
  );
}

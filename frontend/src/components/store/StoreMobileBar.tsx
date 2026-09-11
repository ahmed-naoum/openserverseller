import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../../contexts/StoreContext';
import { useCart } from '../../contexts/CartContext';
import { Home, LayoutGrid, Search, ShoppingBag, MessageCircle } from 'lucide-react';

/**
 * The thumb-reachable bar every large Moroccan shop runs on mobile, where most
 * of this traffic lands. It only ever links to destinations that exist: the
 * WhatsApp slot disappears for a seller who never set a number, and the row
 * re-balances itself around whatever is left.
 */
export default function StoreMobileBar() {
  const { store } = useStore();
  const { itemsCount, setIsDrawerOpen } = useCart();
  const location = useLocation();
  const navigate = useNavigate();

  if (!store) return null;

  const primaryColor = store.primaryColor || '#f97316';
  const path = location.pathname;

  const items: Array<{
    key: string;
    label: string;
    Icon: any;
    active: boolean;
    onClick: () => void;
    badge?: number;
    tint?: string;
  }> = [
    { key: 'home', label: 'Accueil', Icon: Home, active: path === '/', onClick: () => navigate('/') },
    {
      key: 'shop',
      label: 'Boutique',
      Icon: LayoutGrid,
      active: path.startsWith('/products') || path.startsWith('/collections'),
      onClick: () => navigate('/products'),
    },
    {
      key: 'search',
      label: 'Recherche',
      Icon: Search,
      active: false,
      onClick: () => navigate('/products?focus=search'),
    },
    {
      key: 'cart',
      label: 'Panier',
      Icon: ShoppingBag,
      active: false,
      onClick: () => setIsDrawerOpen(true),
      badge: itemsCount,
    },
  ];

  if (store.whatsappNumber) {
    items.push({
      key: 'wa',
      label: 'Aide',
      Icon: MessageCircle,
      active: false,
      tint: '#059669',
      onClick: () =>
        window.open(`https://wa.me/${store.whatsappNumber!.replace(/[^0-9]/g, '')}`, '_blank', 'noopener'),
    });
  }

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 pb-[env(safe-area-inset-bottom)]"
      aria-label="Navigation rapide"
    >
      <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((it) => (
          <button
            key={it.key}
            onClick={it.onClick}
            className="relative flex flex-col items-center justify-center gap-1 py-2.5 active:bg-gray-50 transition-colors"
            aria-label={it.label}
          >
            <span className="relative">
              <it.Icon
                className="w-5 h-5"
                style={{ color: it.tint || (it.active ? primaryColor : '#6b7280') }}
              />
              {it.badge ? (
                <span
                  className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full text-white text-[9px] font-black flex items-center justify-center"
                  style={{ backgroundColor: primaryColor }}
                >
                  {it.badge}
                </span>
              ) : null}
            </span>
            <span
              className="text-[10px] font-bold leading-none"
              style={{ color: it.tint || (it.active ? primaryColor : '#6b7280') }}
            >
              {it.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}

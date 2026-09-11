import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../../contexts/StoreContext';
import { useCart } from '../../contexts/CartContext';
import {
  ShoppingBag,
  Search,
  Menu,
  X,
  Phone,
  MessageCircle,
  ChevronDown,
  Truck,
  ShieldCheck,
  Instagram,
  Facebook,
  Mail,
  Sparkles,
} from 'lucide-react';
import { DEMO_CATEGORIES, unsplash } from '../../lib/storeMedia';

const money = (n: number) => new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 2 }).format(n);

export default function StoreHeader() {
  const { store } = useStore();
  const { itemsCount, subtotalMad, freeShippingRemainingMad, setIsDrawerOpen } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const megaTimer = useRef<number | null>(null);

  /** The drawer owns the scroll while it is open, or the page slides behind it. */
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setMegaOpen(false);
  }, [location.pathname]);

  if (!store) return null;

  const primaryColor = store.primaryColor || '#f97316';
  const currency = store.currency || 'MAD';

  const navLinks =
    store.navigationMenu && Array.isArray(store.navigationMenu) && store.navigationMenu.length > 0
      ? store.navigationMenu
      : [
          { label: 'Accueil', url: '/' },
          { label: 'Tous les Produits', url: '/products' },
        ];

  /**
   * The mega menu prefers the seller's own collections and falls back to the
   * stock category set, which searches the real catalogue — so the menu is
   * never empty and never advertises a section that leads nowhere.
   */
  const hasCollections = Boolean(store.collections && store.collections.length);
  const megaItems = hasCollections
    ? store.collections.map((c, i) => ({
        label: c.nameFr,
        href: `/collections/${c.slug}`,
        image: c.imageUrl || unsplash(DEMO_CATEGORIES[i % DEMO_CATEGORIES.length].id, 200, 200),
      }))
    : DEMO_CATEGORIES.map((c) => ({
        label: c.label,
        href: `/products?search=${encodeURIComponent(c.query)}`,
        image: unsplash(c.id, 200, 200),
      }));

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setMobileMenuOpen(false);
      setSearchQuery('');
    }
  };

  const openMega = () => {
    if (megaTimer.current) window.clearTimeout(megaTimer.current);
    setMegaOpen(true);
  };
  const closeMega = () => {
    if (megaTimer.current) window.clearTimeout(megaTimer.current);
    megaTimer.current = window.setTimeout(() => setMegaOpen(false), 140);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
      {/* Announcement — the seller's line, or the free-shipping progress once a
          threshold is configured and the visitor has something in the cart. */}
      {store.announcementActive && store.announcementText && (
        <div
          className="text-white text-[11px] sm:text-xs font-semibold py-2 px-4 text-center tracking-wide"
          style={{ backgroundColor: primaryColor }}
        >
          <span className="inline-flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            {freeShippingRemainingMad && freeShippingRemainingMad > 0
              ? `Plus que ${money(freeShippingRemainingMad)} ${currency} pour la livraison offerte !`
              : store.announcementText}
          </span>
        </div>
      )}

      {/* Utility strip — contact and reassurance, the row every large Moroccan
          shop keeps above the logo. Hidden on phones where it costs more than
          it gives. */}
      <div className="hidden lg:block bg-gray-900 text-gray-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-9 flex items-center justify-between text-[11px] font-medium">
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" style={{ color: primaryColor }} />
              Livraison 24/48h partout au Maroc
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Paiement à la livraison
            </span>
          </div>
          <div className="flex items-center gap-4">
            {store.contactPhone && (
              <a href={`tel:${store.contactPhone}`} className="flex items-center gap-1.5 hover:text-white transition-colors">
                <Phone className="w-3.5 h-3.5" />
                {store.contactPhone}
              </a>
            )}
            {store.contactEmail && (
              <a href={`mailto:${store.contactEmail}`} className="flex items-center gap-1.5 hover:text-white transition-colors">
                <Mail className="w-3.5 h-3.5" />
                {store.contactEmail}
              </a>
            )}
            {store.instagramUrl && (
              <a href={store.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="hover:text-white">
                <Instagram className="w-3.5 h-3.5" />
              </a>
            )}
            {store.facebookUrl && (
              <a href={store.facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="hover:text-white">
                <Facebook className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Main bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 h-16 sm:h-20">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-lg text-gray-700 hover:bg-gray-100"
            aria-label="Ouvrir le menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          <Link to="/" className="flex items-center gap-3 shrink-0">
            {store.logoUrl ? (
              <img
                src={store.logoUrl}
                alt={store.name}
                className="h-10 sm:h-12 w-auto object-contain max-w-[150px] sm:max-w-[200px]"
              />
            ) : (
              <span className="text-xl sm:text-2xl font-black tracking-tight text-gray-900">{store.name}</span>
            )}
          </Link>

          {/* Desktop search takes the middle of the bar: on a catalogue shop it
              is the most used control on the page. */}
          <form onSubmit={handleSearchSubmit} className="hidden lg:flex flex-1 max-w-xl mx-auto">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un produit..."
                className="w-full pl-11 pr-24 py-3 bg-gray-50 border border-gray-200 rounded-full text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:bg-white transition-all"
                style={{ ['--tw-ring-color' as any]: primaryColor }}
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-2 text-xs font-bold text-white rounded-full hover:opacity-90 transition-opacity"
                style={{ backgroundColor: primaryColor }}
              >
                Chercher
              </button>
            </div>
          </form>

          <div className="flex items-center gap-1 sm:gap-2 ml-auto">
            <button
              onClick={() => setSearchOpen((v) => !v)}
              className="lg:hidden p-2 rounded-full text-gray-600 hover:bg-gray-100"
              aria-label="Recherche"
            >
              <Search className="w-5 h-5" />
            </button>

            {store.whatsappNumber && (
              <a
                href={`https://wa.me/${store.whatsappNumber.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="hidden xl:inline">Commander par WhatsApp</span>
                <span className="xl:hidden">WhatsApp</span>
              </a>
            )}

            <button
              onClick={() => setIsDrawerOpen(true)}
              className="flex items-center gap-2.5 pl-2 pr-3 py-2 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Panier"
            >
              <span className="relative">
                <ShoppingBag className="w-6 h-6 text-gray-800" />
                {itemsCount > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 text-white text-[10px] font-black w-4.5 h-4.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shadow-sm"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {itemsCount}
                  </span>
                )}
              </span>
              <span className="hidden md:flex flex-col items-start leading-tight">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Panier</span>
                <span className="text-xs font-black text-gray-900">
                  {money(subtotalMad)} {currency}
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Category bar with the mega menu */}
      <nav className="hidden lg:block border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-7 h-12">
            <div className="relative" onMouseEnter={openMega} onMouseLeave={closeMega}>
              <button
                className="flex items-center gap-1.5 text-sm font-bold text-gray-900 h-12"
                aria-expanded={megaOpen}
                onClick={() => setMegaOpen((v) => !v)}
              >
                <Menu className="w-4 h-4" />
                Toutes les catégories
                <ChevronDown className={`w-4 h-4 transition-transform ${megaOpen ? 'rotate-180' : ''}`} />
              </button>

              {megaOpen && (
                <div className="absolute left-0 top-full w-[720px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 z-50">
                  <div className="grid grid-cols-4 gap-3">
                    {megaItems.map((item) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        className="group flex flex-col gap-2 p-2 rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        <div className="aspect-[4/3] rounded-lg overflow-hidden bg-gray-100">
                          <img
                            src={item.image}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-800 group-hover:text-gray-950">{item.label}</span>
                      </Link>
                    ))}
                  </div>
                  <Link
                    to="/products"
                    className="mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Voir tout le catalogue
                  </Link>
                </div>
              )}
            </div>

            {navLinks.map((link, idx) => {
              const isActive = location.pathname === link.url;
              return (
                <Link
                  key={idx}
                  to={link.url}
                  className="text-sm font-semibold transition-colors"
                  style={{ color: isActive ? primaryColor : undefined }}
                >
                  <span className={isActive ? '' : 'text-gray-600 hover:text-gray-900'}>{link.label}</span>
                </Link>
              );
            })}

            {store.customPages?.slice(0, 3).map((pg) => (
              <Link
                key={pg.id}
                to={`/pages/${pg.slug}`}
                className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
              >
                {pg.title}
              </Link>
            ))}

            <span className="ml-auto flex items-center gap-1.5 text-xs font-bold text-emerald-700">
              <ShieldCheck className="w-4 h-4" />
              Satisfait ou échangé sous 7 jours
            </span>
          </div>
        </div>
      </nav>

      {/* Mobile search drop-down */}
      {searchOpen && (
        <div className="lg:hidden border-t border-gray-100 bg-gray-50 px-4 py-3">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un produit..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 text-gray-900"
                style={{ ['--tw-ring-color' as any]: primaryColor }}
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 text-sm font-bold text-white rounded-xl"
              style={{ backgroundColor: primaryColor }}
            >
              OK
            </button>
            <button type="button" onClick={() => setSearchOpen(false)} className="p-2 text-gray-400" aria-label="Fermer">
              <X className="w-5 h-5" />
            </button>
          </form>
        </div>
      )}

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 max-w-xs w-full bg-white shadow-2xl z-50 flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <span className="font-black text-lg text-gray-900">{store.name}</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 -mr-2 text-gray-400" aria-label="Fermer">
                <X className="w-6 h-6" />
              </button>
            </div>

            <nav className="flex flex-col p-6 gap-1">
              {navLinks.map((link, idx) => (
                <Link key={idx} to={link.url} className="text-base font-bold text-gray-800 py-2.5 border-b border-gray-50">
                  {link.label}
                </Link>
              ))}

              <span className="text-[11px] font-black text-gray-400 uppercase tracking-wider mt-5 mb-2">Catégories</span>
              <div className="grid grid-cols-2 gap-2.5">
                {megaItems.map((item) => (
                  <Link key={item.href} to={item.href} className="relative rounded-xl overflow-hidden aspect-[4/3] bg-gray-100">
                    <img src={item.image} alt="" className="w-full h-full object-cover" loading="lazy" />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent flex items-end p-2">
                      <span className="text-white text-[11px] font-bold leading-tight">{item.label}</span>
                    </span>
                  </Link>
                ))}
              </div>

              {store.customPages && store.customPages.length > 0 && (
                <div className="mt-5 flex flex-col gap-1">
                  <span className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-1">Informations</span>
                  {store.customPages.map((pg) => (
                    <Link key={pg.id} to={`/pages/${pg.slug}`} className="text-sm font-medium text-gray-600 py-1.5">
                      {pg.title}
                    </Link>
                  ))}
                </div>
              )}
            </nav>

            <div className="mt-auto p-6 border-t border-gray-100 space-y-2">
              {store.whatsappNumber && (
                <a
                  href={`https://wa.me/${store.whatsappNumber.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 text-white font-bold rounded-xl text-sm"
                >
                  <MessageCircle className="w-5 h-5" />
                  Commander via WhatsApp
                </a>
              )}
              {store.contactPhone && (
                <a
                  href={`tel:${store.contactPhone}`}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-gray-100 text-gray-800 font-bold rounded-xl text-sm"
                >
                  <Phone className="w-4 h-4" />
                  {store.contactPhone}
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../contexts/StoreContext';
import {
  Phone,
  Mail,
  MessageCircle,
  ShieldCheck,
  Truck,
  RotateCcw,
  Headphones,
  Instagram,
  Facebook,
  MapPin,
  Banknote,
  ArrowUp,
  ArrowRight,
} from 'lucide-react';
import { DEMO_CATEGORIES } from '../../lib/storeMedia';

/** lucide ships no TikTok glyph, and the footer looks unfinished without it. */
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 1 1 .77-5.06V9.72a5.67 5.67 0 0 0-.77-.05 5.67 5.67 0 1 0 5.67 5.67V9.01a7.35 7.35 0 0 0 4.29 1.38V7.3a4.29 4.29 0 0 1-3.22-1.48z" />
    </svg>
  );
}

export default function StoreFooter() {
  const { store } = useStore();

  if (!store) return null;

  const primaryColor = store.primaryColor || '#f97316';
  const year = new Date().getFullYear();

  const menuLinks =
    store.footerMenu && Array.isArray(store.footerMenu) && store.footerMenu.length > 0
      ? store.footerMenu
      : [
          { label: 'Politique de Livraison', url: '/pages/livraison' },
          { label: 'Conditions Générales', url: '/pages/terms' },
          { label: 'À Propos', url: '/pages/about' },
        ];

  /**
   * The seller's footer menu usually points at their own custom pages, so
   * listing both verbatim printed "Politique de Livraison" twice. Merge on the
   * destination and keep the menu's wording, which is the one they chose.
   */
  const footerLinks = [
    ...menuLinks,
    ...(store.customPages || []).map((pg) => ({ label: pg.title, url: `/pages/${pg.slug}` })),
  ].filter((link, i, all) => all.findIndex((o) => o.url === link.url) === i);

  const shopLinks = store.collections?.length
    ? store.collections.slice(0, 6).map((c) => ({ label: c.nameFr, url: `/collections/${c.slug}` }))
    : DEMO_CATEGORIES.slice(0, 6).map((c) => ({
        label: c.label,
        url: `/products?search=${encodeURIComponent(c.query)}`,
      }));

  const socials = [
    store.instagramUrl && { href: store.instagramUrl, Icon: Instagram, label: 'Instagram' },
    store.facebookUrl && { href: store.facebookUrl, Icon: Facebook, label: 'Facebook' },
    store.tiktokUrl && { href: store.tiktokUrl, Icon: TikTokIcon, label: 'TikTok' },
  ].filter(Boolean) as Array<{ href: string; Icon: any; label: string }>;

  const hasContact = Boolean(store.contactPhone || store.whatsappNumber || store.contactEmail);

  return (
    <footer className="mt-20 bg-gray-900 text-gray-300">
      {/* Reassurance bar */}
      <div className="border-b border-gray-800 bg-gray-950/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-9">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { Icon: Truck, color: primaryColor, title: 'Livraison Express', body: '24h à 48h partout au Maroc' },
              {
                Icon: ShieldCheck,
                color: '#34d399',
                title: store.enableCod ? 'Paiement à la Livraison' : 'Paiement Sécurisé',
                body: store.enableCod ? 'Vous vérifiez avant de payer' : 'Transaction protégée',
              },
              { Icon: RotateCcw, color: '#818cf8', title: 'Échange 7 Jours', body: 'Article non conforme repris' },
              { Icon: Headphones, color: '#f472b6', title: 'Support 7j/7', body: 'WhatsApp et téléphone' },
            ].map((it) => (
              <div key={it.title} className="flex items-center gap-3.5">
                <div className="p-3 bg-gray-800/80 rounded-2xl shrink-0">
                  <it.Icon className="w-5 h-5" style={{ color: it.color }} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-white leading-tight">{it.title}</h4>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{it.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Help band — only when the seller published a way to be reached. A
          contact strip with nothing behind it is worse than no strip. */}
      {hasContact && (
        <div className="border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row items-center justify-between gap-5 text-center lg:text-left">
            <div>
              <h3 className="text-lg sm:text-xl font-black text-white">Une question avant de commander ?</h3>
              <p className="text-sm text-gray-400 mt-1">
                Notre équipe répond en quelques minutes, du samedi au jeudi.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {store.whatsappNumber && (
                <a
                  href={`https://wa.me/${store.whatsappNumber.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </a>
              )}
              {store.contactPhone && (
                <a
                  href={`tel:${store.contactPhone}`}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  {store.contactPhone}
                </a>
              )}
              {store.contactEmail && (
                <a
                  href={`mailto:${store.contactEmail}`}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Écrire un e-mail
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Link columns */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10">
          <div className="col-span-2">
            {store.logoUrl ? (
              <img src={store.logoUrl} alt={store.name} className="h-11 w-auto object-contain mb-4" />
            ) : (
              <h3 className="text-xl font-black text-white">{store.name}</h3>
            )}
            {store.tagline && <p className="text-sm text-gray-400 mt-3 max-w-sm leading-relaxed">{store.tagline}</p>}
            {store.description && (
              <p className="text-xs text-gray-500 mt-3 max-w-sm leading-relaxed line-clamp-4">{store.description}</p>
            )}

            {socials.length > 0 && (
              <div className="flex items-center gap-2.5 mt-6">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="w-10 h-10 rounded-xl bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
                  >
                    <s.Icon className="w-[18px] h-[18px]" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-[11px] font-black uppercase tracking-wider text-white mb-4">Boutique</h4>
            <ul className="space-y-2.5 text-sm">
              {shopLinks.map((l) => (
                <li key={l.url}>
                  <Link to={l.url} className="text-gray-400 hover:text-white transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-black uppercase tracking-wider text-white mb-4">Informations</h4>
            <ul className="space-y-2.5 text-sm">
              {footerLinks.map((link) => (
                <li key={link.url}>
                  <Link to={link.url} className="text-gray-400 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-black uppercase tracking-wider text-white mb-4">Contact</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2 text-gray-400">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Livraison partout au Maroc</span>
              </li>
              {store.contactPhone && (
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-500 shrink-0" />
                  <a href={`tel:${store.contactPhone}`} className="text-gray-300 hover:text-white transition-colors">
                    {store.contactPhone}
                  </a>
                </li>
              )}
              {store.contactEmail && (
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-500 shrink-0" />
                  <a
                    href={`mailto:${store.contactEmail}`}
                    className="text-gray-300 hover:text-white transition-colors break-all"
                  >
                    {store.contactEmail}
                  </a>
                </li>
              )}
              {store.whatsappNumber && (
                <li className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <a
                    href={`https://wa.me/${store.whatsappNumber.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
                  >
                    Support WhatsApp
                  </a>
                </li>
              )}
              <li>
                <Link
                  to="/products"
                  className="inline-flex items-center gap-1.5 text-xs font-bold mt-1 hover:gap-2.5 transition-all"
                  style={{ color: primaryColor }}
                >
                  Parcourir le catalogue <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-7 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <p>
            © {year} {store.name}. Tous droits réservés.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {store.enableCod && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 font-semibold">
                <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                Paiement à la livraison
              </span>
            )}
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 font-semibold">
              <Truck className="w-3.5 h-3.5" style={{ color: primaryColor }} />
              Livraison 24/48h
            </span>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold transition-colors"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              Haut de page
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

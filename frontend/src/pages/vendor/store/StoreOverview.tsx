import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { vendorStoreApi } from '../../../lib/api';
import { buildStoreUrl } from '../../../utils/referral';
import toast from 'react-hot-toast';
import { currentBasePath } from '../../../lib/dashboardBase';
import { useAuth } from '../../../contexts/AuthContext';
import {
  LayoutTemplate, ShoppingBag, ExternalLink, Copy, Check, Palette, Layers,
  FileText, Settings, Globe, Truck, ArrowRight, Store, PanelTop, PanelBottom,
  CreditCard, Gift, AlertCircle,
} from 'lucide-react';

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-4';
const secondaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 ' + focusRing;

export default function StoreOverview() {
  const { user } = useAuth() as any;
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();
  const basePath = currentBasePath(user?.role);
  const storePath = basePath + '/store/';

  const loadStore = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await vendorStoreApi.getMyStore();
      const nextStore = res.data?.data?.store || null;
      setStore(nextStore);
      setFailed(!nextStore);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStore();
    return () => clearTimeout(copyTimer.current);
  }, []);

  const publicUrl = !store ? '' : store.user?.customDomain && store.user?.customDomainStatus === 'ACTIVE'
    ? 'https://' + store.user.customDomain
    : store.user?.subdomain || store.slug
      ? 'https://' + (store.user?.subdomain || store.slug) + '.silacod.com'
      : '';
  const previewUrl = publicUrl
    ? buildStoreUrl('', store.user?.subdomain || store.slug, store.user?.customDomain, store.user?.customDomainStatus)
    : '';

  const handleCopyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success('Lien de la boutique copié');
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Impossible de copier le lien. Copiez l’adresse affichée.');
    }
  };

  if (loading) {
    return (
      <div role="status" className="mx-auto flex min-h-[400px] max-w-7xl items-center justify-center gap-3 text-sm text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-primary-600 motion-reduce:animate-none" />
        Chargement de votre boutique…
      </div>
    );
  }

  if (failed) {
    return (
      <div role="alert" className="mx-auto flex max-w-7xl flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
        <AlertCircle className="h-8 w-8 text-orange-600" />
        <h1 className="text-xl font-semibold text-slate-900">Votre boutique n’a pas pu être chargée</h1>
        <p className="text-sm text-slate-500">Réessayez pour retrouver vos réglages et votre éditeur.</p>
        <button type="button" onClick={() => void loadStore()} className={secondaryButton}>Réessayer</button>
      </div>
    );
  }

  const editorLinks = [
    { path: 'header', title: 'En-tête', description: 'Logo et navigation', icon: PanelTop },
    { path: 'footer', title: 'Pied de page', description: 'Liens et informations', icon: PanelBottom },
    { path: 'product', title: 'Fiche produit', description: 'Présentation des produits', icon: ShoppingBag },
    { path: 'catalogue', title: 'Catalogue', description: 'Grille et collections', icon: Layers },
  ];
  const managementLinks = [
    { path: 'settings', title: 'Identité & contact', description: 'Logo, coordonnées et réseaux sociaux : les essentiels de votre marque.', action: 'Configurer', icon: Settings, color: 'bg-orange-50 text-orange-700' },
    { path: 'themes', title: 'Modèles de boutique', description: 'Choisissez un style prêt à personnaliser pour toute votre boutique.', action: 'Choisir un modèle', icon: Palette, color: 'bg-violet-50 text-violet-700' },
    { path: 'collections', title: 'Catégories & collections', description: 'Organisez vos produits pour aider vos clients à trouver leur bonheur.', action: 'Gérer les collections', count: store?.collections?.length || 0, icon: Layers, color: 'bg-blue-50 text-blue-700' },
    { path: 'pages', title: 'Pages & politiques', description: 'Présentez votre activité et précisez vos conditions de vente et de livraison.', action: 'Gérer les pages', count: store?.customPages?.length || 0, icon: FileText, color: 'bg-emerald-50 text-emerald-700' },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-8 text-slate-900">
      <header className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Votre espace boutique</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Boutique en ligne</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Tout pour créer une boutique à votre image et accueillir vos clients.</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="absolute inset-y-0 left-0 w-1 bg-orange-500" />
          <div className="flex flex-col gap-6 p-5 sm:p-7 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                <Store className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="break-words text-xl font-semibold tracking-tight sm:text-2xl">{store?.name || 'Ma boutique'}</h2>
                <div className="mt-2 flex min-w-0 items-start gap-2 text-sm text-slate-500">
                  <Globe className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="break-all select-text">{publicUrl.replace('https://', '') || 'Adresse de boutique indisponible'}</span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
              {previewUrl && <a href={previewUrl} target="_blank" rel="noopener noreferrer" className={secondaryButton}>
                Voir la boutique <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
              </a>}
              <Link to={storePath + 'studio/home'} className={'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 ' + focusRing}>
                <LayoutTemplate className="h-4 w-4 shrink-0" aria-hidden="true" /> Modifier dans Studio
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-2 sm:px-7">
            <p className="text-sm text-slate-500">Partagez votre boutique avec vos clients.</p>
            <button type="button" onClick={handleCopyLink} disabled={!publicUrl} className={'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-700 transition-colors hover:text-primary-600 disabled:opacity-50 ' + focusRing} aria-live="polite">
              {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {copied ? 'Lien copié' : 'Copier le lien'}
            </button>
          </div>
        </div>
      </header>

      <section aria-labelledby="appearance-title" className="space-y-4">
        <div>
          <h2 id="appearance-title" className="text-lg font-semibold tracking-tight">Personnaliser l’apparence</h2>
          <p className="mt-1 text-sm text-slate-500">Accédez directement à la partie que vous souhaitez modifier.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {editorLinks.map(({ path, title, description, icon: Icon }) => (
            <Link key={path} to={storePath + 'studio/' + path} className={'group flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-primary-200 hover:bg-primary-50/40 ' + focusRing}>
              <Icon className="h-5 w-5 shrink-0 text-slate-400 group-hover:text-primary-600" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-primary-600" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="management-title" className="space-y-4">
        <h2 id="management-title" className="text-lg font-semibold tracking-tight">Gérer votre boutique</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {managementLinks.map(({ path, title, description, action, count, icon: Icon, color }) => (
            <Link key={path} to={storePath + path} className={'group flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-primary-200 hover:bg-slate-50/50 ' + focusRing}>
              <div className="mb-5 flex items-center justify-between gap-3">
                <span className={'flex h-10 w-10 items-center justify-center rounded-xl ' + color}><Icon className="h-5 w-5" aria-hidden="true" /></span>
                {count !== undefined && <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{count} {path === 'pages' ? (count === 1 ? 'page' : 'pages') : (count === 1 ? 'collection' : 'collections')}</span>}
              </div>
              <h3 className="text-base font-semibold tracking-tight">{title}</h3>
              <p className="mb-5 mt-2 text-sm leading-6 text-slate-500">{description}</p>
              <span className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-4 text-sm font-semibold text-primary-600">
                {action}<ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="operations-title" className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 id="operations-title" className="text-lg font-semibold tracking-tight">Paiement & livraison</h2>
          <Link to={storePath + 'settings'} className={'inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-primary-600 hover:bg-primary-50 ' + focusRing}>
            Modifier les réglages <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <dl className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-3 md:divide-x md:divide-y-0">
          <div className="p-5 sm:p-6">
            <dt className="flex items-center gap-2 text-sm text-slate-500"><CreditCard className="h-4 w-4" aria-hidden="true" /> Mode de paiement</dt>
            <dd className="mt-3 text-base font-semibold">Paiement à la livraison</dd>
            <dd className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700"><Check className="h-3.5 w-3.5" aria-hidden="true" /> Actif par défaut · COD</dd>
          </div>
          <div className="p-5 sm:p-6">
            <dt className="flex items-center gap-2 text-sm text-slate-500"><Truck className="h-4 w-4" aria-hidden="true" /> Livraison standard</dt>
            <dd className="mt-3 text-base font-semibold">{store?.standardShippingFee ?? 0} <span className="text-sm font-normal text-slate-500">MAD</span></dd>
            <dd className="mt-2 text-xs leading-5 text-slate-500">Partout au Maroc</dd>
          </div>
          <div className="p-5 sm:p-6">
            <dt className="flex items-center gap-2 text-sm text-slate-500"><Gift className="h-4 w-4" aria-hidden="true" /> Livraison gratuite</dt>
            <dd className="mt-3 text-base font-semibold">{store?.freeShippingThreshold != null ? 'Dès ' + store.freeShippingThreshold + ' MAD' : 'Aucun seuil défini'}</dd>
            <dd className="mt-2 text-xs leading-5 text-slate-500">{store?.freeShippingThreshold != null ? 'Offerte à partir de ce montant' : 'Définissez un montant dans les réglages'}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

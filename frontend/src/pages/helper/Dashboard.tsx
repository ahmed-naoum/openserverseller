import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, getFileUrl } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  Users, TrendingUp, CheckCircle2, Clock, AlertTriangle, Package, Truck,
  RotateCcw, Banknote, ArrowRight, RefreshCw, ScanLine, FileText, Tag,
  Headphones, Building2, Link2, ShoppingCart, ArrowUpRight, Layers,
} from 'lucide-react';

/* ── types ─────────────────────────────────────────────────────────────── */

interface DashboardData {
  scope: {
    isHelper: boolean;
    accountsCount: number;
    permissions: Record<string, boolean>;
  };
  leads: {
    total: number; today: number; last7d: number; last30d: number;
    byStatus: Record<string, number>; unassigned: number;
  };
  parcels: {
    total: number; withCode: number; notSynced: number; readyForPickup: number;
    delivered: number; returned: number; inTransit: number;
    byStatus: Record<string, number>;
  };
  revenue: { total: number; delivered: number; inTransit: number; returned: number };
  rates: { delivery: number | null; return: number | null };
  alerts: {
    staleParcels: number; uninvoicedReturns: number; notSynced: number;
    unassignedLeads: number; readyForPickup: number;
  };
  series: { date: string; leads: number; parcels: number; delivered: number; revenue: number }[];
  topProducts: {
    id: number; name: string; sku: string | null; image: string | null;
    parcels: number; units: number; revenue: number; delivered: number;
    returned: number; deliveryRate: number | null;
  }[];
  topAccounts: {
    id: number; name: string; leads: number; parcels: number; revenue: number;
    delivered: number; returned: number; deliveryRate: number | null;
  }[];
  topAgents: {
    id: number; name: string; leads: number; parcels: number; delivered: number;
    returned: number; revenue: number; deliveryRate: number | null;
  }[];
}

/* ── labels ────────────────────────────────────────────────────────────── */

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Nouveau', AVAILABLE: 'En attente CC', ASSIGNED: 'Assigné',
  CONTACTED: 'Contacté', CONFIRMED: 'Confirmé', CALL_LATER: 'Rappel',
  NO_ANSWER: 'Sans réponse', CANCELLED: 'Annulé', PUSHED_TO_DELIVERY: 'En livraison',
  ORDERED: 'Commandé', SHIPPED: 'Expédié', DELIVERED: 'Livré', RETURNED: 'Retourné',
  PENDING: 'En attente', WAITING_PICKUP: 'Attente collecte', PREPARED: 'Préparé',
  PICKED_UP: 'Collecté', SENT: 'Expédié', RECEIVED: 'Reçu', DISTRIBUTION: 'En livraison',
  POSTPONED: 'Reporté', NOANSWER: 'Pas de réponse', REFUSE: 'Refusé',
  INCORRECT_ADDRESS: 'Adresse erronée', NEW_PARCEL: 'Nouveau colis',
};

const label = (key: string) => STATUS_LABELS[key] || key.replace(/_/g, ' ');

const STATUS_TONE: Record<string, string> = {
  DELIVERED: 'bg-emerald-500', RETURNED: 'bg-orange-500', PENDING: 'bg-amber-500',
  DISTRIBUTION: 'bg-cyan-500', SENT: 'bg-violet-500', PICKED_UP: 'bg-blue-500',
  CONFIRMED: 'bg-blue-500', REFUSE: 'bg-red-500', NOANSWER: 'bg-rose-500',
  CANCELLED: 'bg-red-500', PUSHED_TO_DELIVERY: 'bg-indigo-500',
};

const fmtMad = (n: number) => `${Math.round(n || 0).toLocaleString('fr-FR')} MAD`;
const fmtNum = (n: number) => (n || 0).toLocaleString('fr-FR');

/* ── small building blocks ─────────────────────────────────────────────── */

function KpiCard({
  to, label: text, value, sub, icon: Icon, gradient, trend,
}: {
  to?: string; label: string; value: string; sub?: string;
  icon: React.ComponentType<any>; gradient: string; trend?: string;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between">
        <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg shadow-slate-200/60`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-50 text-slate-500 text-[10px] font-black">
            <ArrowUpRight className="w-3 h-3" />
            {trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-black text-slate-900 mt-4 tabular-nums truncate" title={value}>{value}</p>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">{text}</p>
      {sub && <p className="text-[11px] text-slate-400 font-medium mt-1.5 truncate" title={sub}>{sub}</p>}
      {to && (
        <span className="inline-flex items-center gap-1 text-[11px] font-black text-slate-400 group-hover:text-indigo-600 transition-colors mt-3">
          Ouvrir <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </span>
      )}
    </>
  );

  const cls =
    'group bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex flex-col transition-all hover:shadow-lg hover:-translate-y-0.5';

  return to ? <Link to={to} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

function SectionCard({
  title, icon: Icon, action, children, empty,
}: {
  title: string; icon: React.ComponentType<any>;
  action?: { to: string; label: string };
  children: React.ReactNode; empty?: boolean;
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5 gap-3">
        <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-wider">
          <Icon className="w-4 h-4 text-indigo-500" />
          {title}
        </h2>
        {action && (
          <Link
            to={action.to}
            className="inline-flex items-center gap-1 text-[11px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-wider whitespace-nowrap"
          >
            {action.label} <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      {empty ? (
        <p className="text-sm text-slate-400 italic py-8 text-center">Aucune donnée pour le moment.</p>
      ) : (
        children
      )}
    </div>
  );
}

/** Bars are sized against the series max so a quiet month still reads clearly. */
function ActivityChart({ series }: { series: DashboardData['series'] }) {
  const max = Math.max(1, ...series.map(s => Math.max(s.leads, s.parcels)));

  return (
    <div>
      <div className="flex items-end gap-[3px] h-40">
        {series.map(s => {
          const day = new Date(s.date);
          const title = `${day.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} — ${s.leads} lead(s), ${s.parcels} colis, ${s.delivered} livré(s)`;
          return (
            <div key={s.date} className="flex-1 flex flex-col justify-end gap-[2px] group relative" title={title}>
              <div
                className="w-full bg-indigo-200 group-hover:bg-indigo-300 rounded-t-sm transition-colors"
                style={{ height: `${(s.leads / max) * 100}%` }}
              />
              <div
                className="w-full bg-emerald-400 group-hover:bg-emerald-500 rounded-b-sm transition-colors"
                style={{ height: `${(s.delivered / max) * 100}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-3 text-[10px] font-bold text-slate-400">
        <span>{new Date(series[0]?.date || Date.now()).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-200" /> Leads créés</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Colis livrés</span>
        </div>
        <span>Aujourd'hui</span>
      </div>
    </div>
  );
}

/* ── page ──────────────────────────────────────────────────────────────── */

export default function HelperDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await api.get('/helper/dashboard');
      setData(res.data?.data || null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors du chargement du tableau de bord');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const perms = data?.scope.permissions || {};
  // SUPER_ADMIN sees everything; a helper only sees what they're allowed to open.
  const can = (key: string) => (user?.role === 'HELPER' ? !!perms[key] : true);

  const leadStatusRows = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.leads.byStatus)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [data]);

  const parcelStatusRows = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.parcels.byStatus)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [data]);

  /** Only surfaces an alert the user can actually act on. */
  const alerts = useMemo(() => {
    if (!data) return [];
    const list = [
      {
        key: 'stale',
        show: can('canManageOrders') && data.alerts.staleParcels > 0,
        count: data.alerts.staleParcels,
        title: 'Colis bloqués depuis +7 jours',
        desc: 'Toujours en circulation, sans issue.',
        to: '/helper/colis',
        tone: 'rose' as const,
        icon: AlertTriangle,
      },
      {
        key: 'pickup',
        show: can('canManageTickets') && data.alerts.readyForPickup > 0,
        count: data.alerts.readyForPickup,
        title: 'Colis prêts à ramasser',
        desc: 'Synchronisés mais sans bon de ramassage.',
        to: '/helper/tickets',
        tone: 'amber' as const,
        icon: FileText,
      },
      {
        key: 'returns',
        show: can('canManageOrders') && data.alerts.uninvoicedReturns > 0,
        count: data.alerts.uninvoicedReturns,
        title: 'Retours non facturés',
        desc: 'Retournés et non encore facturés.',
        to: '/helper/retours',
        tone: 'violet' as const,
        icon: RotateCcw,
      },
      {
        key: 'sync',
        show: can('canManageOrders') && data.alerts.notSynced > 0,
        count: data.alerts.notSynced,
        title: 'Colis non synchronisés',
        desc: 'Aucun code Coliaty attribué.',
        to: '/helper/colis?code=no',
        tone: 'slate' as const,
        icon: Package,
      },
      {
        key: 'unassigned',
        show: can('canManageLeads') && data.alerts.unassignedLeads > 0,
        count: data.alerts.unassignedLeads,
        title: 'Leads sans agent',
        desc: 'Aucun agent call center assigné.',
        to: '/helper/leads',
        tone: 'blue' as const,
        icon: Headphones,
      },
    ];
    return list.filter(a => a.show);
  }, [data, perms, user]);

  const shortcuts = useMemo(
    () =>
      [
        { key: 'canManageLeads', to: '/helper/leads', label: 'Tous les leads', icon: Users, tone: 'from-violet-500 to-indigo-500' },
        { key: 'canManageOrders', to: '/helper/colis', label: 'Colis', icon: Package, tone: 'from-blue-500 to-cyan-500' },
        { key: 'canScanReturns', to: '/helper/retours', label: 'Retours', icon: RotateCcw, tone: 'from-orange-500 to-amber-500' },
        { key: 'canScanReturns', to: '/helper/scanner', label: 'Scanner', icon: ScanLine, tone: 'from-slate-700 to-slate-900' },
        { key: 'canManageTickets', to: '/helper/tickets', label: 'Ramassage', icon: FileText, tone: 'from-emerald-500 to-teal-500' },
        { key: 'canManageProducts', to: '/helper/products', label: 'Produits', icon: Tag, tone: 'from-pink-500 to-rose-500' },
        { key: 'canManageProducts', to: '/helper/marketplace', label: 'Marketplace', icon: ShoppingCart, tone: 'from-fuchsia-500 to-purple-500' },
        { key: 'canManageInfluencerLinks', to: '/helper/links', label: 'Liens', icon: Link2, tone: 'from-sky-500 to-blue-500' },
        { key: 'canImpersonate', to: '/helper/users', label: 'Utilisateurs', icon: Building2, tone: 'from-teal-500 to-emerald-500' },
        { key: 'canManageAffiliateInvites', to: '/helper/affiliate', label: 'Affiliation', icon: TrendingUp, tone: 'from-amber-500 to-orange-500' },
      ].filter(s => can(s.key)),
    [perms, user]
  );

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="h-24 bg-white rounded-3xl border border-slate-100 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-40 bg-white rounded-3xl border border-slate-100 animate-pulse" />
          ))}
        </div>
        <div className="h-72 bg-white rounded-3xl border border-slate-100 animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto text-center py-24">
        <p className="text-slate-400 font-medium">Impossible de charger le tableau de bord.</p>
        <button
          onClick={() => fetchData(true)}
          className="mt-5 px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-slate-800 transition-all"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const noScope = data.scope.isHelper && data.scope.accountsCount === 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Tableau de bord</h1>
          <p className="text-sm text-slate-500 mt-1">
            {data.scope.isHelper
              ? `${data.scope.accountsCount} compte${data.scope.accountsCount > 1 ? 's' : ''} sous votre gestion`
              : 'Vue globale de la plateforme'}
            {' · '}
            {fmtNum(data.leads.total)} lead{data.leads.total > 1 ? 's' : ''} au total
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-95 disabled:opacity-60 self-start"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {noScope && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-black text-amber-900 text-sm">Aucun compte assigné</p>
            <p className="text-xs text-amber-700 mt-1">
              Aucun vendeur ou créateur ne vous est encore assigné, donc les statistiques sont vides.
              Contactez un administrateur pour recevoir vos comptes.
            </p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          to={can('canManageLeads') ? '/helper/leads' : undefined}
          label="Leads"
          value={fmtNum(data.leads.total)}
          sub={`${data.leads.today} aujourd'hui · ${data.leads.last7d} sur 7 j`}
          icon={Users}
          gradient="from-violet-500 to-indigo-500"
          trend={data.leads.last30d > 0 ? `${fmtNum(data.leads.last30d)} / 30 j` : undefined}
        />
        <KpiCard
          to={can('canManageOrders') ? '/helper/colis' : undefined}
          label="Colis en circulation"
          value={fmtNum(data.parcels.inTransit)}
          sub={`${fmtMad(data.revenue.inTransit)} en jeu`}
          icon={Truck}
          gradient="from-cyan-500 to-blue-500"
        />
        <KpiCard
          to={can('canManageOrders') ? '/helper/colis?status=DELIVERED' : undefined}
          label="Encaissé (livré)"
          value={fmtMad(data.revenue.delivered)}
          sub={`${fmtNum(data.parcels.delivered)} colis livrés`}
          icon={Banknote}
          gradient="from-emerald-500 to-teal-500"
        />
        <KpiCard
          to={can('canManageOrders') ? '/helper/colis?status=RETURNED' : undefined}
          label="Taux de livraison"
          value={data.rates.delivery === null ? '—' : `${data.rates.delivery}%`}
          sub={`${fmtNum(data.parcels.returned)} retour${data.parcels.returned > 1 ? 's' : ''} · ${fmtMad(data.revenue.returned)}`}
          icon={CheckCircle2}
          gradient={
            data.rates.delivery !== null && data.rates.delivery < 60
              ? 'from-rose-500 to-red-500'
              : 'from-fuchsia-500 to-purple-500'
          }
        />
      </div>

      {/* Action items */}
      {alerts.length > 0 && (
        <div>
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            À traiter
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {alerts.map(a => {
              const tones: Record<string, string> = {
                rose: 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100',
                amber: 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100',
                violet: 'bg-violet-50 border-violet-200 text-violet-600 hover:bg-violet-100',
                slate: 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100',
                blue: 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100',
              };
              return (
                <Link
                  key={a.key}
                  to={a.to}
                  className={`group flex items-center gap-4 p-4 rounded-2xl border transition-all ${tones[a.tone]}`}
                >
                  <a.icon className="w-5 h-5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-sm text-slate-900">
                      {fmtNum(a.count)} · {a.title}
                    </p>
                    <p className="text-[11px] font-medium opacity-80 truncate">{a.desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Shortcuts */}
      {shortcuts.length > 0 && (
        <div>
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Layers className="w-3.5 h-3.5" />
            Accès rapide
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-10 gap-3">
            {shortcuts.map(s => (
              <Link
                key={s.to}
                to={s.to}
                className="group bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col items-center gap-2 hover:shadow-md hover:-translate-y-0.5 transition-all text-center"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.tone} flex items-center justify-center shadow-sm`}>
                  <s.icon className="w-4.5 h-4.5 text-white" />
                </div>
                <span className="text-[10px] font-black text-slate-600 group-hover:text-slate-900 leading-tight">
                  {s.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Activity */}
      <SectionCard title="Activité sur 30 jours" icon={TrendingUp}>
        <ActivityChart series={data.series} />
      </SectionCard>

      {/* Status breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard
          title="Leads par statut"
          icon={Users}
          empty={leadStatusRows.length === 0}
          action={can('canManageLeads') ? { to: '/helper/leads', label: 'Voir tout' } : undefined}
        >
          <div className="space-y-2.5">
            {leadStatusRows.map(([status, count]) => {
              const pct = data.leads.total > 0 ? (count / data.leads.total) * 100 : 0;
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-600 w-32 truncate" title={label(status)}>
                    {label(status)}
                  </span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${STATUS_TONE[status] || 'bg-indigo-400'}`}
                      style={{ width: `${Math.max(pct, 1.5)}%` }}
                    />
                  </div>
                  <span className="text-xs font-black text-slate-900 tabular-nums w-12 text-right">{fmtNum(count)}</span>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title="Colis par statut"
          icon={Package}
          empty={parcelStatusRows.length === 0}
          action={can('canManageOrders') ? { to: '/helper/colis', label: 'Voir tout' } : undefined}
        >
          <div className="space-y-2.5">
            {parcelStatusRows.map(([status, count]) => {
              const pct = data.parcels.total > 0 ? (count / data.parcels.total) * 100 : 0;
              const row = (
                <>
                  <span className="text-xs font-bold text-slate-600 w-32 truncate" title={label(status)}>
                    {label(status)}
                  </span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${STATUS_TONE[status] || 'bg-indigo-400'}`}
                      style={{ width: `${Math.max(pct, 1.5)}%` }}
                    />
                  </div>
                  <span className="text-xs font-black text-slate-900 tabular-nums w-12 text-right">{fmtNum(count)}</span>
                </>
              );
              return can('canManageOrders') ? (
                <Link
                  key={status}
                  to={`/helper/colis?status=${status}`}
                  className="flex items-center gap-3 -mx-2 px-2 py-1 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  {row}
                </Link>
              ) : (
                <div key={status} className="flex items-center gap-3">{row}</div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      {/* Top products */}
      {can('canManageOrders') && (
        <SectionCard
          title="Meilleurs produits"
          icon={Tag}
          empty={data.topProducts.length === 0}
          action={{ to: '/helper/colis', label: 'Filtrer les colis' }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.topProducts.map((p, i) => (
              <Link
                key={p.id}
                to={`/helper/colis?productId=${p.id}`}
                className="group flex items-center gap-3 p-3 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-slate-50/60 transition-all"
              >
                <span className="text-[10px] font-black text-slate-300 w-4 flex-shrink-0">#{i + 1}</span>
                {p.image ? (
                  <img
                    src={getFileUrl(p.image)}
                    alt={p.name}
                    loading="lazy"
                    className="w-12 h-12 rounded-xl object-cover border border-slate-100 flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Package className="w-5 h-5 text-slate-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 truncate group-hover:text-indigo-700">{p.name}</p>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {fmtNum(p.parcels)} colis · {fmtNum(p.units)} u.
                    {p.deliveryRate !== null && ` · ${p.deliveryRate}% livrés`}
                  </p>
                </div>
                <span className="text-sm font-black text-emerald-600 tabular-nums flex-shrink-0">
                  {fmtMad(p.revenue)}
                </span>
              </Link>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Accounts + agents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard
          title="Comptes les plus actifs"
          icon={Building2}
          empty={data.topAccounts.length === 0}
          action={can('canImpersonate') ? { to: '/helper/users', label: 'Gérer' } : undefined}
        >
          <div className="space-y-1.5">
            {data.topAccounts.map((a, i) => (
              <Link
                key={a.id}
                to={can('canManageOrders') ? `/helper/colis?vendorId=${a.id}` : '#'}
                className="group flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <span className="text-[10px] font-black text-slate-300 w-4">#{i + 1}</span>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center text-purple-700 font-black text-xs flex-shrink-0">
                  {a.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800 truncate group-hover:text-indigo-700">{a.name}</p>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {fmtNum(a.leads)} leads · {fmtNum(a.parcels)} colis
                    {a.deliveryRate !== null && ` · ${a.deliveryRate}% livrés`}
                  </p>
                </div>
                <span className="text-xs font-black text-emerald-600 tabular-nums flex-shrink-0">{fmtMad(a.revenue)}</span>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Agents call center"
          icon={Headphones}
          empty={data.topAgents.length === 0}
          action={can('canManageOrders') ? { to: '/helper/colis', label: 'Filtrer' } : undefined}
        >
          <div className="space-y-1.5">
            {data.topAgents.map((a, i) => (
              <Link
                key={a.id}
                to={can('canManageOrders') ? `/helper/colis?agentId=${a.id}` : '#'}
                className="group flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <span className="text-[10px] font-black text-slate-300 w-4">#{i + 1}</span>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-100 to-emerald-100 flex items-center justify-center text-teal-700 font-black text-xs flex-shrink-0">
                  {a.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800 truncate group-hover:text-teal-700">{a.name}</p>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {fmtNum(a.leads)} leads · {fmtNum(a.delivered)} livrés · {fmtNum(a.returned)} retours
                  </p>
                </div>
                {a.deliveryRate !== null && (
                  <span
                    className={`text-xs font-black tabular-nums px-2 py-1 rounded-lg flex-shrink-0 ${
                      a.deliveryRate >= 70
                        ? 'text-emerald-700 bg-emerald-50'
                        : a.deliveryRate >= 50
                        ? 'text-amber-700 bg-amber-50'
                        : 'text-rose-700 bg-rose-50'
                    }`}
                  >
                    {a.deliveryRate}%
                  </span>
                )}
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Footer summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Chiffre total', value: fmtMad(data.revenue.total), icon: Banknote },
          { label: 'Colis synchronisés', value: `${fmtNum(data.parcels.withCode)} / ${fmtNum(data.parcels.total)}`, icon: Package },
          { label: 'Prêts à ramasser', value: fmtNum(data.parcels.readyForPickup), icon: FileText },
          { label: 'Taux de retour', value: data.rates.return === null ? '—' : `${data.rates.return}%`, icon: RotateCcw },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3">
            <s.icon className="w-4 h-4 text-slate-300 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-900 truncate tabular-nums">{s.value}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-[11px] text-slate-300 font-medium flex items-center justify-center gap-1.5">
        <Clock className="w-3 h-3" />
        Statistiques calculées sur l'ensemble de votre périmètre
      </p>
    </div>
  );
}

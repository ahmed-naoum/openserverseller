/**
 * SUPER_ADMIN — les comptes de la plateforme face à l'agent WhatsApp.
 *
 * Une ligne par vendeur / influenceur : de quoi décider d'ouvrir l'agent à un
 * compte, lui vendre des crédits, et comprendre pourquoi son agent ne répond
 * plus sans avoir à ouvrir sa session.
 *
 * Tous les montants arrivent en CENTS entiers et ne sont jamais divisés ici :
 * formatWaMoney possède cette conversion, au bord de l'affichage.
 */

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertTriangle,
  Bot,
  Brain,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Coins,
  Gift,
  Loader2,
  Megaphone,
  MessageSquare,
  MinusCircle,
  PlugZap,
  PlusCircle,
  RefreshCw,
  Search,
  Smartphone,
  Sparkles,
  SlidersHorizontal,
  Store,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { waAdminApi, formatWaMoney } from '../../lib/waAgentApi';
import type { AdminAccountRow, AgentConfig, AiModel, SessionStatus } from '../../lib/waAgentApi';

/* ------------------------------------------------------------------ */
/* types & constantes                                                  */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 25;

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AccountsPayload {
  accounts: AdminAccountRow[];
  /** Tarif facturé au compte pour une réponse de l'agent. Cents entiers. */
  priceCents: number;
  pagination: Pagination;
}

/** Une journée locale du compte, telle que l'agrégat la stocke. */
interface UsageDay {
  id: number;
  /** YYYY-MM-DD, dans le fuseau du compte. */
  day: string;
  turns: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costCents: number;
}

interface CreditTx {
  id: number;
  type: string;
  /** Signé : positif sur un crédit, négatif sur une consommation. Cents. */
  amount: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
}

interface AccountDetail {
  user: {
    uuid: string;
    email: string;
    whatsappAgentEnabled: boolean;
    whatsappAgentGateFrom: string | null;
    profile: { fullName: string | null } | null;
  };
  agent: AgentConfig | null;
  session: {
    status: SessionStatus;
    desiredState: string;
    phoneNumber: string | null;
    lastError: string | null;
    lastConnectedAt: string | null;
  } | null;
  credits: { balance: number; totalGranted: number; totalConsumed: number } | null;
  usage: UsageDay[];
  transactions: CreditTx[];
  priceCents: number;
}

/**
 * Le seul endroit qui traduit un état de socket WhatsApp en quelque chose
 * qu'un admin peut lire. Un état non couvert ici n'existe pas côté worker.
 */
const SESSION_META: Record<SessionStatus, { label: string; tone: string; dot: string }> = {
  CONNECTED: {
    label: 'Connecté',
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  QR: {
    label: 'En attente du scan',
    tone: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  CONNECTING: {
    label: 'Connexion…',
    tone: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500 animate-pulse',
  },
  DISCONNECTED: {
    label: 'Déconnecté',
    tone: 'bg-gray-100 text-gray-600 border-gray-200',
    dot: 'bg-gray-400',
  },
  LOGGED_OUT: {
    label: 'Déconnecté (délié)',
    tone: 'bg-gray-100 text-gray-600 border-gray-200',
    dot: 'bg-gray-400',
  },
  BANNED: {
    label: 'Bloqué par WhatsApp',
    tone: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
  },
};

/** Comment chaque écriture du grand livre se lit. */
const TX_META: Record<string, { label: string; tone: string }> = {
  GRANT: { label: 'Crédit', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  CONSUME: { label: 'Consommation', tone: 'bg-gray-50 text-gray-500 border-gray-200' },
  ADMIN_DEBIT: { label: 'Débit admin', tone: 'bg-rose-50 text-rose-700 border-rose-100' },
  REFUND: { label: 'Remboursement', tone: 'bg-sky-50 text-sky-700 border-sky-100' },
};

const ROLE_META: Record<AdminAccountRow['role'], { label: string; tone: string; icon: LucideIcon }> =
  {
    VENDOR: {
      label: 'Vendeur',
      tone: 'bg-primary-50 text-primary-700 border-primary-100',
      icon: Store,
    },
    INFLUENCER: {
      label: 'Influenceur',
      tone: 'bg-influencer-50 text-influencer-700 border-influencer-100',
      icon: Megaphone,
    },
  };

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function apiMessage(err: unknown, fallback: string): string {
  const shaped = err as { response?: { data?: { message?: string } } };
  return shaped?.response?.data?.message || fallback;
}

const formatCount = (n: number) => (Number(n) || 0).toLocaleString('fr-FR');

const replyLabel = (count: number) => `${formatCount(count)} réponse${count > 1 ? 's' : ''}`;

const formatDate = (iso: string | null | undefined) =>
  iso ? format(new Date(iso), 'dd MMM yyyy', { locale: fr }) : '—';

const formatDateTime = (iso: string) => format(new Date(iso), 'dd/MM/yyyy HH:mm', { locale: fr });

/**
 * `day` est une date LOCALE du compte écrite YYYY-MM-DD. `new Date(day)` la
 * lirait comme minuit UTC, ce qui la recule d'un jour à l'ouest de Greenwich —
 * la ligne du mardi s'afficherait « lundi ». On la construit donc composant par
 * composant.
 */
const formatUsageDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) return day;
  return format(new Date(y, m - 1, d), 'dd MMM', { locale: fr });
};

/* ------------------------------------------------------------------ */
/* primitives locales                                                  */
/* ------------------------------------------------------------------ */

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onChange}
      className={`w-12 h-6 shrink-0 rounded-full p-1 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-emerald-500' : 'bg-gray-300'
      }`}
    >
      <div
        className={`w-4 h-4 bg-white rounded-full shadow transition-transform duration-300 ${
          checked ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  alert,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone: string;
  alert?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${tone}`}>
          <Icon size={18} />
        </div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
      </div>
      <p className="mt-4 text-3xl font-black text-gray-900 tabular-nums">{value}</p>
      {hint && (
        <p className={`mt-1 text-xs font-medium ${alert ? 'text-rose-500' : 'text-gray-400'}`}>
          {hint}
        </p>
      )}
    </div>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-100 bg-white">
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-gray-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-gray-500 truncate">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors shrink-0"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
      {helper && <p className="mt-1 text-xs text-gray-500">{helper}</p>}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-gray-100">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-5 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-gray-100 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-100 rounded-full w-48" />
            <div className="h-2.5 bg-gray-50 rounded-full w-64" />
          </div>
          <div className="hidden md:block h-6 w-16 bg-gray-100 rounded-lg" />
          <div className="hidden md:block h-6 w-12 bg-gray-100 rounded-full" />
          <div className="hidden lg:block h-6 w-28 bg-gray-100 rounded-lg" />
          <div className="h-6 w-20 bg-gray-100 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function AgentAccountsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [rows, setRows] = useState<AdminAccountRow[]>([]);
  const [priceCents, setPriceCents] = useState(0);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });

  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  // uuid du compte en cours d'écriture — verrouille son interrupteur.
  const [busyUuid, setBusyUuid] = useState<string | null>(null);

  const [expandedUuid, setExpandedUuid] = useState<string | null>(null);
  const [detail, setDetail] = useState<AccountDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);
  /** La dernière ligne demandée : une réponse plus lente d'une ligne refermée est jetée. */
  const detailRequest = useRef<string | null>(null);

  /**
   * Le catalogue des moteurs, chargé une seule fois : il alimente les
   * sélecteurs STT/TTS de chaque ligne dépliée et ne change pas d'un compte à
   * l'autre.
   */
  const [aiModels, setAiModels] = useState<AiModel[]>([]);

  const [disableTarget, setDisableTarget] = useState<AdminAccountRow | null>(null);

  const [creditTarget, setCreditTarget] = useState<AdminAccountRow | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditDescription, setCreditDescription] = useState('');
  const [creditDirection, setCreditDirection] = useState<'GRANT' | 'DEBIT'>('GRANT');
  const [creditSaving, setCreditSaving] = useState(false);

  /* ---------------- chargement ---------------- */

  const load = async () => {
    setRefreshing(true);
    try {
      const res = await waAdminApi.accounts({ role, status, q, page, limit: PAGE_SIZE });
      const payload = res.data.data as AccountsPayload;
      setRows(payload.accounts || []);
      // Le tarif fait autorité côté serveur : rien ici ne l'écrit en dur.
      setPriceCents(Number(payload.priceCents) || 0);
      if (payload.pagination) setPagination(payload.pagination);
    } catch (err) {
      toast.error(apiMessage(err, 'Erreur lors du chargement des comptes'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // La frappe ne doit pas déclencher une requête par caractère. Une recherche
  // qui se pose ramène toujours à la première page : la page 3 des résultats
  // précédents n'existe probablement plus.
  useEffect(() => {
    const next = searchInput.trim();
    const timer = window.setTimeout(() => {
      setQ(next);
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, status, q, page]);

  useEffect(() => {
    let cancelled = false;
    waAdminApi
      .models()
      .then((res) => {
        const payload = res.data.data as { models?: AiModel[] } | null;
        if (!cancelled) setAiModels(Array.isArray(payload?.models) ? payload.models : []);
      })
      .catch(() => {
        // Le reste du panneau reste utilisable : seuls les sélecteurs de
        // moteurs resteront vides, et l'admin le voit tout de suite.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadDetail = async (uuid: string) => {
    detailRequest.current = uuid;
    setDetail(null);
    setDetailError(false);
    setDetailLoading(true);
    try {
      const res = await waAdminApi.account(uuid);
      if (detailRequest.current !== uuid) return;
      setDetail(res.data.data as AccountDetail);
    } catch (err) {
      if (detailRequest.current !== uuid) return;
      setDetailError(true);
      toast.error(apiMessage(err, 'Erreur lors du chargement du détail du compte'));
    } finally {
      if (detailRequest.current === uuid) setDetailLoading(false);
    }
  };

  const toggleExpand = (uuid: string) => {
    if (expandedUuid === uuid) {
      detailRequest.current = null;
      setExpandedUuid(null);
      setDetail(null);
      return;
    }
    setExpandedUuid(uuid);
    loadDetail(uuid);
  };

  /* ---------------- accès à l'agent ---------------- */

  const applyEntitlement = async (account: AdminAccountRow, enabled: boolean) => {
    setBusyUuid(account.uuid);
    try {
      await waAdminApi.setEntitlement(account.uuid, enabled);
      toast.success(
        enabled
          ? `Agent activé pour ${account.name}`
          : `Agent désactivé — la session WhatsApp de ${account.name} a été coupée`
      );
      await load();
      if (expandedUuid === account.uuid) await loadDetail(account.uuid);
    } catch (err) {
      toast.error(apiMessage(err, "Erreur lors de la mise à jour de l'accès à l'agent"));
    } finally {
      setBusyUuid(null);
      setDisableTarget(null);
    }
  };

  const handleToggleEntitlement = (account: AdminAccountRow) => {
    // Couper l'accès coupe aussi la session en cours : cela se confirme.
    if (account.entitlement.enabled) {
      setDisableTarget(account);
      return;
    }
    applyEntitlement(account, true);
  };

  /* ---------------- crédits ---------------- */

  const openCreditModal = (account: AdminAccountRow) => {
    setCreditTarget(account);
    setCreditAmount('');
    setCreditDescription('');
    setCreditDirection('GRANT');
  };

  const closeCreditModal = () => {
    if (creditSaving) return;
    setCreditTarget(null);
    setCreditAmount('');
    setCreditDescription('');
    setCreditDirection('GRANT');
  };

  // Le serveur attend des dollars et convertit lui-même ; on ne repasse en cents
  // que pour l'aperçu, en arrondissant pour ne pas traîner les décimales de 9.99.
  const creditCents = Math.round((Number(creditAmount) || 0) * 100);
  const creditReplies = priceCents > 0 ? Math.floor(creditCents / priceCents) : 0;

  const submitCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditTarget || creditCents <= 0) return;

    setCreditSaving(true);
    try {
      const res = await waAdminApi.grantCredits(
        creditTarget.uuid,
        Number(creditAmount),
        creditDescription.trim() || undefined,
        creditDirection
      );
      const balance = Number((res.data.data as { balance?: number })?.balance) || 0;
      toast.success(
        `${creditDirection === 'GRANT' ? 'Crédits accordés' : 'Crédits repris'} — nouveau solde : ${formatWaMoney(balance)}`
      );
      const uuid = creditTarget.uuid;
      setCreditTarget(null);
      setCreditAmount('');
      setCreditDescription('');
      setCreditDirection('GRANT');
      await load();
      if (expandedUuid === uuid) await loadDetail(uuid);
    } catch (err) {
      toast.error(apiMessage(err, "Erreur lors de l'opération sur les crédits"));
    } finally {
      setCreditSaving(false);
    }
  };

  /* ---------------- totaux ---------------- */

  const totals = useMemo(
    () => ({
      entitled: rows.filter((a) => a.entitlement.enabled).length,
      connected: rows.filter((a) => a.session?.status === 'CONNECTED').length,
      credits: rows.reduce((sum, a) => sum + (a.credits?.balance || 0), 0),
      dry: rows.filter((a) => a.entitlement.enabled && (a.credits?.affordable || 0) === 0).length,
    }),
    [rows]
  );

  const filtered = q !== '' || role !== 'all' || status !== 'all';

  /* ---------------- rendu ---------------- */

  return (
    <div className="space-y-6 p-1">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900 tracking-tight">
            <Users className="h-6 w-6 text-primary-500" />
            Comptes &amp; agent WhatsApp
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Vendeurs et influenceurs : ouvrez l'agent, vendez des crédits, surveillez les sessions.
            {priceCents > 0 && (
              <span className="font-semibold text-slate-600">
                {' '}
                Tarif facturé : {formatWaMoney(priceCents)} / réponse.
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => load()}
          disabled={refreshing}
          title="Actualiser"
          className="p-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl hover:text-primary-600 hover:border-primary-100 transition-all shadow-sm disabled:opacity-50 w-fit"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Totaux */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          icon={Users}
          label="Comptes"
          value={formatCount(pagination.total)}
          hint={filtered ? 'Correspondant aux filtres' : 'Vendeurs et influenceurs'}
          tone="bg-indigo-50 text-indigo-600"
        />
        <StatCard
          icon={Bot}
          label="Agent activé"
          value={formatCount(totals.entitled)}
          hint="Sur cette page"
          tone="bg-primary-50 text-primary-600"
        />
        <StatCard
          icon={PlugZap}
          label="Sessions connectées"
          value={formatCount(totals.connected)}
          hint="Sur cette page"
          tone="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          icon={Wallet}
          label="Crédits en circulation"
          value={formatWaMoney(totals.credits)}
          hint={
            totals.dry > 0
              ? `${formatCount(totals.dry)} compte(s) activé(s) à sec`
              : 'Solde cumulé de cette page'
          }
          tone="bg-amber-50 text-amber-600"
          alert={totals.dry > 0}
        />
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Rechercher par email, téléphone ou nom…"
            className="input ps-11 pe-10"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              title="Effacer la recherche"
              className="absolute end-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
          className="input sm:w-52"
          aria-label="Filtrer par rôle"
        >
          <option value="all">Tous les rôles</option>
          <option value="VENDOR">Vendeurs</option>
          <option value="INFLUENCER">Influenceurs</option>
        </select>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="input sm:w-52"
          aria-label="Filtrer par état de l'agent"
        >
          <option value="all">Tous les statuts</option>
          <option value="enabled">Agent activé</option>
          <option value="disabled">Agent désactivé</option>
        </select>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400">
              <Bot size={30} />
            </div>
            <h3 className="text-base font-black text-gray-900">Aucun compte trouvé</h3>
            <p className="mt-1.5 text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
              {filtered
                ? "Aucun vendeur ni influenceur ne correspond à ces filtres. Élargissez la recherche pour retrouver le compte."
                : "La plateforme ne compte encore aucun vendeur ni influenceur à qui ouvrir l'agent."}
            </p>
          </div>
        ) : (
          <div className={`overflow-x-auto transition-opacity ${refreshing ? 'opacity-60' : ''}`}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  <th className="py-3.5 px-6 text-start">Compte</th>
                  <th className="py-3.5 px-4 text-center">Statut</th>
                  <th className="py-3.5 px-4 text-center">Agent</th>
                  <th className="py-3.5 px-4 text-start">Activé depuis</th>
                  <th className="py-3.5 px-4 text-start">Session WhatsApp</th>
                  <th className="py-3.5 px-4 text-end">Crédits IA</th>
                  <th className="py-3.5 px-4 text-center">Conv.</th>
                  <th className="py-3.5 px-6 text-end">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((account) => {
                  const isExpanded = expandedUuid === account.uuid;
                  const roleMeta = ROLE_META[account.role];
                  const RoleIcon = roleMeta?.icon ?? Store;
                  const sessionMeta = account.session ? SESSION_META[account.session.status] : null;
                  const affordable = account.credits?.affordable ?? 0;
                  // Un solde qui n'achète plus une seule réponse : l'agent se
                  // taira au prochain message du client. Se voit de loin.
                  const dry = affordable === 0;

                  return (
                    <Fragment key={account.uuid}>
                      <tr
                        onClick={() => toggleExpand(account.uuid)}
                        className={`cursor-pointer transition-colors ${
                          isExpanded ? 'bg-primary-50/40' : 'hover:bg-gray-50/70'
                        }`}
                      >
                        {/* Compte */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <ChevronDown
                              size={16}
                              className={`text-gray-300 shrink-0 transition-transform ${
                                isExpanded ? 'rotate-180 text-primary-500' : ''
                              }`}
                            />
                            <div
                              className={`w-10 h-10 rounded-xl border flex items-center justify-center font-black text-sm uppercase shrink-0 ${roleMeta?.tone}`}
                            >
                              {account.name?.charAt(0) || '?'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold text-gray-900 truncate max-w-[220px]">
                                  {account.name}
                                </p>
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${roleMeta?.tone}`}
                                >
                                  <RoleIcon size={10} />
                                  {roleMeta?.label ?? account.role}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 truncate max-w-[260px]">
                                {account.email}
                                {account.phone ? ` · ${account.phone}` : ''}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Statut du compte */}
                        <td className="py-4 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                              account.isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : 'bg-gray-100 text-gray-500 border-gray-200'
                            }`}
                          >
                            {account.isActive ? 'Actif' : 'Suspendu'}
                          </span>
                        </td>

                        {/* Accès à l'agent */}
                        <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-center">
                            <Toggle
                              checked={account.entitlement.enabled}
                              disabled={busyUuid === account.uuid}
                              onChange={() => handleToggleEntitlement(account)}
                              label={
                                account.entitlement.enabled
                                  ? `Désactiver l'agent de ${account.name}`
                                  : `Activer l'agent de ${account.name}`
                              }
                            />
                          </div>
                        </td>

                        {/* Activé depuis */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span
                            className={`text-xs font-medium ${
                              account.entitlement.since ? 'text-gray-600' : 'text-gray-300'
                            }`}
                          >
                            {formatDate(account.entitlement.since)}
                          </span>
                        </td>

                        {/* Session WhatsApp */}
                        <td className="py-4 px-4">
                          {sessionMeta && account.session ? (
                            <div className="space-y-1">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${sessionMeta.tone}`}
                                title={account.session.lastError || undefined}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${sessionMeta.dot}`} />
                                {sessionMeta.label}
                              </span>
                              {account.session.phoneNumber && (
                                <p className="text-xs text-gray-500 tabular-nums">
                                  {account.session.phoneNumber}
                                </p>
                              )}
                              {account.session.lastError && (
                                <p
                                  className="flex items-center gap-1 text-[11px] text-rose-500 truncate max-w-[190px]"
                                  title={account.session.lastError}
                                >
                                  <AlertTriangle size={11} className="shrink-0" />
                                  {account.session.lastError}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border bg-gray-100 text-gray-500 border-gray-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                              Jamais connecté
                            </span>
                          )}
                        </td>

                        {/* Crédits IA */}
                        <td className="py-4 px-4 text-end whitespace-nowrap">
                          <p
                            className={`text-sm font-black tabular-nums ${
                              dry ? 'text-rose-600' : 'text-gray-900'
                            }`}
                          >
                            {formatWaMoney(account.credits?.balance ?? 0)}
                          </p>
                          <p
                            className={`mt-0.5 text-[11px] font-semibold tabular-nums ${
                              dry ? 'text-rose-500' : 'text-gray-400'
                            }`}
                          >
                            ≈ {replyLabel(affordable)}
                          </p>
                        </td>

                        {/* Conversations */}
                        <td className="py-4 px-4 text-center">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 text-xs font-bold tabular-nums">
                            <MessageSquare size={12} className="text-gray-400" />
                            {formatCount(account.conversations)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6 text-end" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => openCreditModal(account)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-primary-50 hover:text-primary-700 hover:border-primary-200 transition-colors"
                          >
                            <Coins size={14} />
                            Créditer
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-gray-50/70">
                          <td colSpan={8} className="p-0">
                            <AccountDetailPanel
                              detail={detail}
                              loading={detailLoading}
                              error={detailError}
                              models={aiModels}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && rows.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/60">
            <p className="text-xs text-gray-500 tabular-nums">
              Page <span className="font-bold text-gray-700">{pagination.page}</span> sur{' '}
              {Math.max(1, pagination.totalPages)} · {formatCount(pagination.total)} compte(s)
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || refreshing}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} className="rtl:rotate-180" />
                Précédent
              </button>
              <button
                type="button"
                disabled={page >= pagination.totalPages || refreshing}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Suivant
                <ChevronRight size={14} className="rtl:rotate-180" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================= MODALE CRÉDITS ========================= */}
      {creditTarget && (
        <Modal
          title="Crédits IA"
          subtitle={`${creditTarget.name} · ${creditTarget.email}`}
          onClose={closeCreditModal}
        >
          <form onSubmit={submitCredit} className="p-6 space-y-5">
            {/* Ce que le compte a maintenant */}
            <div className="flex items-end justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Solde actuel
                </p>
                <p className="mt-1 text-2xl font-black text-gray-900 tabular-nums">
                  {formatWaMoney(creditTarget.credits?.balance ?? 0)}
                </p>
              </div>
              <p className="text-xs font-semibold text-emerald-600 tabular-nums text-end">
                ≈ {replyLabel(creditTarget.credits?.affordable ?? 0)}
              </p>
            </div>

            {/* Sens de l'opération */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCreditDirection('GRANT')}
                className={`inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl border transition-colors ${
                  creditDirection === 'GRANT'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <PlusCircle size={16} />
                Créditer
              </button>
              <button
                type="button"
                onClick={() => setCreditDirection('DEBIT')}
                className={`inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl border transition-colors ${
                  creditDirection === 'DEBIT'
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <MinusCircle size={16} />
                Débiter
              </button>
            </div>

            <Field
              label="Montant (en dollars)"
              helper={
                creditCents > 0 && priceCents > 0 ? (
                  <span className="tabular-nums">
                    {formatWaMoney(creditCents)} ={' '}
                    <span
                      className={`font-bold ${
                        creditDirection === 'GRANT' ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {creditDirection === 'GRANT' ? '+' : '−'} {replyLabel(creditReplies)}
                    </span>{' '}
                    au tarif de {formatWaMoney(priceCents)} par réponse.
                  </span>
                ) : (
                  'Saisissez un montant pour voir combien de réponses il achète.'
                )
              }
            >
              <div className="relative">
                <span className="absolute start-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  autoFocus
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="10.00"
                  className="input ps-8 tabular-nums"
                />
              </div>
            </Field>

            <Field
              label="Description"
              helper="Cette note reste dans le grand livre du compte et s'affiche dans son historique."
            >
              <input
                type="text"
                maxLength={500}
                value={creditDescription}
                onChange={(e) => setCreditDescription(e.target.value)}
                placeholder="Pack de lancement payé par virement…"
                className="input"
              />
            </Field>

            <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeCreditModal}
                disabled={creditSaving}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-xl transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={creditSaving || creditCents <= 0}
                className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  creditDirection === 'GRANT'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {creditSaving && <Loader2 size={16} className="animate-spin" />}
                {creditSaving
                  ? 'Enregistrement…'
                  : creditDirection === 'GRANT'
                    ? `Créditer ${creditCents > 0 ? formatWaMoney(creditCents) : ''}`
                    : `Débiter ${creditCents > 0 ? formatWaMoney(creditCents) : ''}`}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= CONFIRMATION DE COUPURE DE L'AGENT ================= */}
      {disableTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm"
            onClick={() => {
              if (!busyUuid) setDisableTarget(null);
            }}
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-black text-gray-900">
                  Couper l'agent de « {disableTarget.name} » ?
                </h3>
                {/* La conséquence est dite en clair : ce n'est pas qu'un drapeau. */}
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                  Sa session WhatsApp en cours sera <span className="font-semibold text-gray-700">immédiatement déconnectée</span> et
                  son agent <span className="font-semibold text-gray-700">cessera de répondre à ses clients</span> dès
                  maintenant — les messages qui arrivent ensuite resteront sans réponse. Ses crédits
                  restants ne sont pas repris, et réactiver l'agent ne déplacera pas sa date de
                  facturation.
                </p>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => setDisableTarget(null)}
                disabled={!!busyUuid}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={() => applyEntitlement(disableTarget, false)}
                disabled={!!busyUuid}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                {busyUuid ? <Loader2 size={16} className="animate-spin" /> : <MinusCircle size={16} />}
                Désactiver et déconnecter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* détail d'un compte                                                  */
/* ------------------------------------------------------------------ */

function AccountDetailPanel({
  detail,
  loading,
  error,
  models,
}: {
  detail: AccountDetail | null;
  loading: boolean;
  error: boolean;
  models: AiModel[];
}) {
  if (error) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-rose-600">
          <AlertTriangle size={16} />
          Impossible de charger le détail de ce compte.
        </p>
      </div>
    );
  }

  if (loading || !detail) {
    return (
      <div className="px-6 py-10 flex items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
        <span className="text-sm text-gray-500">Chargement du détail…</span>
      </div>
    );
  }

  const agent = detail.agent;
  const usage = detail.usage ?? [];
  const transactions = detail.transactions ?? [];

  const usageTotals = usage.reduce(
    (acc, day) => ({
      turns: acc.turns + day.turns,
      tokens: acc.tokens + day.inputTokens + day.outputTokens,
      cost: acc.cost + day.costCents,
    }),
    { turns: 0, tokens: 0, cost: 0 }
  );

  return (
    <div className="border-t border-gray-100 p-5 sm:p-6 space-y-5">
      {/* Configuration de l'agent */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <DetailTile
          icon={Brain}
          label="Modèle (cerveau)"
          value={agent?.brainModel?.label || 'Modèle par défaut du rôle'}
        />
        <DetailTile
          icon={Sparkles}
          label="Lead automatique"
          value={agent ? (agent.autoCreateLead ? 'Oui' : 'Non') : '—'}
          tone={agent?.autoCreateLead ? 'text-emerald-600' : 'text-gray-500'}
        />
        <DetailTile
          icon={Bot}
          label="Agent"
          value={agent ? (agent.enabled ? 'Allumé' : 'Éteint') : 'Jamais configuré'}
          tone={agent?.enabled ? 'text-emerald-600' : 'text-gray-500'}
        />
        <DetailTile
          icon={Smartphone}
          label="Numéro lié"
          value={detail.session?.phoneNumber || '—'}
        />
      </div>

      {/* Réglages que le vendeur ne voit pas : ils tiennent au coût et au réalisme, pas à son commerce. */}
      <AgentTuningCard uuid={detail.user.uuid} agent={agent} models={models} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Consommation */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50/60">
            <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">
              Consommation · 30 derniers jours
            </h4>
            <span className="text-[11px] font-semibold text-gray-500 tabular-nums whitespace-nowrap">
              {formatCount(usageTotals.turns)} tours · {formatWaMoney(usageTotals.cost)}
            </span>
          </div>
          {usage.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-400">
              Aucune activité sur la période.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-400">
                    <th className="py-2.5 px-4 text-start">Jour</th>
                    <th className="py-2.5 px-3 text-end">Tours</th>
                    <th className="py-2.5 px-3 text-end">Tokens</th>
                    <th className="py-2.5 px-4 text-end">Coût</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-sm">
                  {usage.map((day) => (
                    <tr key={day.id} className="hover:bg-gray-50/60">
                      <td className="py-2.5 px-4 text-start whitespace-nowrap font-medium text-gray-700">
                        {formatUsageDay(day.day)}
                      </td>
                      <td className="py-2.5 px-3 text-end tabular-nums text-gray-600">
                        {formatCount(day.turns)}
                      </td>
                      <td className="py-2.5 px-3 text-end tabular-nums text-gray-400">
                        {formatCount(day.inputTokens + day.outputTokens)}
                      </td>
                      <td className="py-2.5 px-4 text-end tabular-nums font-bold text-gray-900">
                        {formatWaMoney(day.costCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Grand livre des crédits */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50/60">
            <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">
              Dernières opérations de crédit
            </h4>
            <span className="text-[11px] font-semibold text-gray-500 tabular-nums whitespace-nowrap">
              Solde {formatWaMoney(detail.credits?.balance ?? 0)}
            </span>
          </div>
          {transactions.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-400">
              Aucune opération enregistrée.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-400">
                    <th className="py-2.5 px-4 text-start">Type</th>
                    <th className="py-2.5 px-3 text-end">Montant</th>
                    <th className="py-2.5 px-3 text-end">Solde après</th>
                    <th className="py-2.5 px-4 text-start">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-sm">
                  {transactions.map((tx) => {
                    const meta = TX_META[tx.type] ?? {
                      label: tx.type,
                      tone: 'bg-gray-50 text-gray-500 border-gray-200',
                    };
                    return (
                      <tr key={tx.id} className="hover:bg-gray-50/60 align-top">
                        <td className="py-2.5 px-4 text-start">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${meta.tone}`}
                          >
                            {tx.type === 'GRANT' && <Gift size={9} />}
                            {meta.label}
                          </span>
                          {tx.description && (
                            <p
                              className="mt-1 text-xs text-gray-400 truncate max-w-[200px]"
                              title={tx.description}
                            >
                              {tx.description}
                            </p>
                          )}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-end tabular-nums font-bold ${
                            tx.amount < 0 ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          {tx.amount > 0 ? '+' : ''}
                          {formatWaMoney(tx.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-end tabular-nums font-bold text-gray-900">
                          {formatWaMoney(tx.balanceAfter)}
                        </td>
                        <td className="py-2.5 px-4 text-start text-gray-400 whitespace-nowrap tabular-nums">
                          {formatDateTime(tx.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* réglages de plateforme                                              */
/* ------------------------------------------------------------------ */

/**
 * La chaîne de repli de la transcription.
 *
 * POURQUOI CET ÉCRAN EXISTE. Chaque moteur STT a un quota : Gemini limite le
 * débit, une clé OpenRouter tombe à court de crédit, Groq throttle. Quand le
 * moteur principal refuse, la note vocale arrive au modèle sous la forme
 * « [voice note - transcription unavailable] » et l'agent répond à côté — la
 * panne la plus vicieuse de tout le pipeline, parce qu'elle est invisible et
 * que l'agent continue de parler. Un deuxième moteur sur le quota d'un autre
 * fournisseur ne coûte rien jusqu'au jour où c'est le seul qui marche.
 *
 * L'ORDRE COMPTE : c'est l'ordre d'essai. Le premier qui rend une transcription
 * gagne, et le tour continue normalement.
 */
function SttChainEditor({
  chain,
  models,
  primaryId,
  onChange,
}: {
  chain: string[];
  models: AiModel[];
  primaryId: string;
  onChange: (next: string[]) => void;
}) {
  // Le moteur principal est déjà essayé en premier : le reproposer dans la
  // liste ferait croire à un repli qui n'en est pas un.
  const primary = models.find((m) => String(m.id) === primaryId);
  const primaryKey = primary ? `${primary.provider}:${primary.modelId}` : null;

  const available = models
    .map((m) => ({ key: `${m.provider}:${m.modelId}`, label: `${m.label} · ${m.provider}` }))
    .filter((m) => m.key !== primaryKey && !chain.includes(m.key));

  const labelFor = (key: string) => {
    const model = models.find((m) => `${m.provider}:${m.modelId}` === key);
    return model ? `${model.label} · ${model.provider}` : key;
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= chain.length) return;
    const next = [...chain];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
        Repli si le moteur principal échoue
      </p>

      {chain.length === 0 ? (
        <p className="mt-2 text-xs text-gray-500 leading-relaxed">
          Aucun repli. Si le moteur principal est saturé ou à court de crédit, la note vocale
          n&apos;est pas transcrite et l&apos;agent répond sans l&apos;avoir entendue.
        </p>
      ) : (
        <ol className="mt-2 space-y-1.5">
          {chain.map((link, index) => (
            <li
              key={link}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5"
            >
              <span className="text-[10px] font-black text-gray-400 tabular-nums w-4">
                {index + 1}.
              </span>
              <span className="flex-1 text-xs font-semibold text-gray-700 truncate">
                {labelFor(link)}
              </span>
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                title="Monter"
                className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
              >
                <ChevronUp size={13} />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === chain.length - 1}
                title="Descendre"
                className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
              >
                <ChevronDown size={13} />
              </button>
              <button
                type="button"
                onClick={() => onChange(chain.filter((_, j) => j !== index))}
                title="Retirer"
                className="p-1 text-gray-400 hover:text-rose-600"
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ol>
      )}

      {available.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            if (!e.target.value) return;
            onChange([...chain, e.target.value]);
          }}
          className="input mt-2 text-xs"
          aria-label="Ajouter un moteur de repli"
        >
          <option value="">+ Ajouter un moteur de repli…</option>
          {available.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

/**
 * Les six réglages que le vendeur ne peut plus toucher.
 *
 * Ce ne sont pas des décisions commerciales : ils fixent ce qu'un tour coûte
 * (l'historique relu), à quel point l'agent a l'air humain (les deux délais),
 * et quels moteurs entendent et parlent. Le backend les refuse désormais sur
 * l'endpoint vendeur et ne les accepte qu'ici.
 *
 * Les champs numériques restent des chaînes tant qu'on les saisit : vider une
 * case ne doit pas se lire « 0 » avant même d'avoir retapé un chiffre.
 */
interface TuningDraft {
  historyMessages: string;
  typingDelayMs: string;
  replyDelayMs: string;
  handoffKeywords: string;
  sttModelId: string;
  /** Moteurs de repli, dans l'ordre. Chaque entrée est « provider:modelId ». */
  sttChain: string[];
  ttsModelId: string;
}

function tuningDraftFrom(agent: AgentConfig | null): TuningDraft {
  return {
    historyMessages: String(agent?.historyMessages ?? 12),
    typingDelayMs: String(agent?.typingDelayMs ?? 200),
    replyDelayMs: String(agent?.replyDelayMs ?? 200),
    handoffKeywords: agent?.handoffKeywords ?? '',
    sttModelId: agent?.sttModelId != null ? String(agent.sttModelId) : '',
    sttChain: agent?.sttChain ?? [],
    ttsModelId: agent?.ttsModelId != null ? String(agent.ttsModelId) : '',
  };
}

function AgentTuningCard({
  uuid,
  agent,
  models,
}: {
  uuid: string;
  agent: AgentConfig | null;
  models: AiModel[];
}) {
  const [form, setForm] = useState<TuningDraft>(() => tuningDraftFrom(agent));
  const [saving, setSaving] = useState(false);

  // Une autre ligne dépliée, ou le même compte rechargé après un crédit :
  // le formulaire repart toujours de ce que le serveur vient de répondre.
  useEffect(() => {
    setForm(tuningDraftFrom(agent));
  }, [agent]);

  const sttModels = useMemo(() => models.filter((m) => m.role === 'STT' && m.isEnabled), [models]);
  const ttsModels = useMemo(() => models.filter((m) => m.role === 'TTS' && m.isEnabled), [models]);

  const patch = (next: Partial<TuningDraft>) => setForm((f) => ({ ...f, ...next }));

  if (!agent) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-5">
        <h4 className="flex items-center gap-2 text-xs font-black text-gray-900 uppercase tracking-widest">
          <SlidersHorizontal size={13} className="text-gray-400" />
          Réglages de l'agent
        </h4>
        <p className="mt-2 text-sm text-gray-400">
          Ce compte n'a pas encore ouvert son agent : sa configuration n'existe pas, il n'y a donc
          rien à régler pour l'instant.
        </p>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    const history = Number(form.historyMessages);
    if (!Number.isFinite(history) || history < 4 || history > 100) {
      toast.error("Les messages d'historique doivent être compris entre 4 et 100.");
      return;
    }

    const typing = Number(form.typingDelayMs);
    if (!Number.isFinite(typing) || typing < 0 || typing > 10000) {
      toast.error("Le délai d'écriture doit être compris entre 0 et 10 000 ms.");
      return;
    }

    const reply = Number(form.replyDelayMs);
    if (!Number.isFinite(reply) || reply < 0 || reply > 10000) {
      toast.error('Le délai avant réponse doit être compris entre 0 et 10 000 ms.');
      return;
    }

    // Une liste vide couperait la seule sortie de secours du client. Le serveur
    // la refuse ; on le dit ici, avant de partir pour rien.
    const keywords = form.handoffKeywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    if (keywords.length === 0) {
      toast.error(
        "Laissez au moins un mot-clé : c'est le seul moyen pour un client d'atteindre une personne."
      );
      return;
    }

    setSaving(true);
    try {
      await waAdminApi.updateAccountAgent(uuid, {
        historyMessages: Math.round(history),
        typingDelayMs: Math.round(typing),
        replyDelayMs: Math.round(reply),
        handoffKeywords: keywords.join(', '),
        sttModelId: form.sttModelId === '' ? null : Number(form.sttModelId),
        sttChain: form.sttChain,
        ttsModelId: form.ttsModelId === '' ? null : Number(form.ttsModelId),
      });
      toast.success("Réglages de l'agent enregistrés");
    } catch (err) {
      toast.error(apiMessage(err, "Erreur lors de l'enregistrement des réglages de l'agent"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50/60">
        <h4 className="flex items-center gap-2 text-xs font-black text-gray-900 uppercase tracking-widest">
          <SlidersHorizontal size={13} className="text-gray-400" />
          Réglages de l'agent
        </h4>
        <span className="text-[11px] font-semibold text-gray-400">
          Invisibles pour le vendeur
        </span>
      </div>

      <div className="p-4 sm:p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field
            label="Messages d'historique relus"
            helper="4 à 100. Chaque message supplémentaire est relu — et payé — à chaque tour."
          >
            <input
              type="number"
              min={4}
              max={100}
              step={1}
              value={form.historyMessages}
              onChange={(e) => patch({ historyMessages: e.target.value })}
              className="input tabular-nums"
            />
          </Field>

          <Field
            label="Délai d'écriture simulé (ms)"
            helper="0 à 10 000. Durée du « en train d'écrire… ». Ne sert qu'à faire humain, et retarde d'autant la réponse."
          >
            <input
              type="number"
              min={0}
              max={10000}
              step={50}
              value={form.typingDelayMs}
              onChange={(e) => patch({ typingDelayMs: e.target.value })}
              className="input tabular-nums"
            />
          </Field>

          <Field
            label="Délai avant réponse (ms)"
            helper="0 à 10 000. Attente avant que l'agent commence. Même effet : plus humain, plus lent."
          >
            <input
              type="number"
              min={0}
              max={10000}
              step={50}
              value={form.replyDelayMs}
              onChange={(e) => patch({ replyDelayMs: e.target.value })}
              className="input tabular-nums"
            />
          </Field>
        </div>

        <Field
          label="Mots-clés de passage à un humain"
          helper={
            <>
              Séparés par des virgules. Dès qu'un client écrit l'un de ces mots, l'agent se tait et
              rend la main.{' '}
              <span className="font-semibold text-amber-600">
                Ne laissez jamais cette liste vide : c'est la seule façon pour un client de joindre
                une personne, et l'API refuse l'enregistrement.
              </span>
            </>
          }
        >
          <textarea
            rows={2}
            value={form.handoffKeywords}
            onChange={(e) => patch({ handoffKeywords: e.target.value })}
            placeholder="humain, responsable, réclamation, avocat"
            className="input leading-relaxed"
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Transcription des vocaux (STT)"
            helper="Le moteur qui transcrit les notes vocales des clients."
          >
            <select
              value={form.sttModelId}
              onChange={(e) => patch({ sttModelId: e.target.value })}
              className="input"
            >
              <option value="">— Défaut de la plateforme —</option>
              {sttModels.map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.label} · {m.provider}
                </option>
              ))}
            </select>

            <SttChainEditor
              chain={form.sttChain}
              models={sttModels}
              primaryId={form.sttModelId}
              onChange={(next) => patch({ sttChain: next })}
            />
          </Field>

          <Field
            label="Synthèse vocale (TTS)"
            helper="Le moteur qui prononce les réponses de l'agent."
          >
            <select
              value={form.ttsModelId}
              onChange={(e) => patch({ ttsModelId: e.target.value })}
              className="input"
            >
              <option value="">— Défaut de la plateforme —</option>
              {ttsModels.map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.label} · {m.provider}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="pt-4 border-t border-gray-100 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? 'Enregistrement…' : 'Enregistrer les réglages'}
          </button>
        </div>
      </div>
    </form>
  );
}

function DetailTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3.5 shadow-sm">
      <div className="flex items-center gap-1.5 text-gray-400">
        <Icon size={13} />
        <p className="text-[10px] font-black uppercase tracking-widest">{label}</p>
      </div>
      <p className={`mt-1.5 text-sm font-bold truncate ${tone || 'text-gray-900'}`} title={value}>
        {value}
      </p>
    </div>
  );
}

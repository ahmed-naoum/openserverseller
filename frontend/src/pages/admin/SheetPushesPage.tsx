/**
 * SUPER_ADMIN / FINANCE_ADMIN — « Envoi des leads » vers Google Sheets.
 *
 * Cinq onglets pour une seule question : où en est le pipeline sortant, et
 * qui paie pour lui.
 *
 *   Vue d'ensemble — la santé de la file et l'argent en circulation.
 *   Historique     — chaque envoi tenté, son statut, et ce qu'il a coûté.
 *   Comptes        — un compte par ligne : droit, connexion, solde, file
 *                    d'attente, et les leviers (créditer, relancer le drain).
 *   Grand livre    — toutes les écritures de crédit, tous comptes confondus.
 *   Packs          — les abonnements mensuels : la file des demandes à valider,
 *                    et le catalogue vendu. Un compte sur un pack ne consomme
 *                    pas son solde tant qu'il lui reste du quota.
 *
 * TOUS LES MONTANTS ARRIVENT EN CENTS ENTIERS et ne sont jamais divisés ici :
 * lib/sheetMoney possède cette conversion. Le TARIF n'est pas écrit en dur non
 * plus — le serveur l'envoie (`priceCents`), une hausse de prix est un
 * changement serveur.
 */

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  DollarSign,
  ExternalLink,
  FileSpreadsheet,
  History,
  Loader2,
  Megaphone,
  Package,
  MinusCircle,
  PlusCircle,
  RefreshCw,
  RotateCw,
  Search,
  Send,
  Store,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatMoney, centsToLeads } from '../../lib/sheetMoney';
import { sheetAdminApi } from '../../lib/sheetAdminApi';
import SheetPlansAdminPanel from '../../components/admin/SheetPlansAdminPanel';
import type {
  AccountDetail,
  AccountRow,
  DrainStats,
  JobRow,
  JobStatus,
  LedgerRow,
  Pagination,
  SheetOverview,
  TxType,
} from '../../lib/sheetAdminApi';

/* ------------------------------------------------------------------ */
/* types & constantes                                                  */
/* ------------------------------------------------------------------ */

type Tab = 'overview' | 'jobs' | 'accounts' | 'ledger' | 'plans';

const PAGE_SIZE = 25;

const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: 'overview', label: "Vue d'ensemble", icon: Zap },
  { key: 'jobs', label: 'Historique des envois', icon: History },
  { key: 'accounts', label: 'Comptes & crédits', icon: Users },
  { key: 'ledger', label: 'Grand livre', icon: Wallet },
  { key: 'plans', label: 'Packs & abonnements', icon: Package },
];

/**
 * Le seul endroit qui traduit un statut de SheetPushJob en quelque chose qu'un
 * admin peut lire. Un statut absent d'ici n'existe pas côté serveur.
 *
 * `help` dit ce qu'il faut FAIRE, pas ce que le mot signifie : c'est la
 * différence entre « bloqué » et « vendez des crédits à ce compte ».
 */
const JOB_META: Record<JobStatus, { label: string; tone: string; help: string }> = {
  PENDING: {
    label: 'En attente',
    tone: 'bg-amber-50 text-amber-700 border-amber-200',
    help: 'Dans la file. Le cron la vide toutes les quelques secondes.',
  },
  SENDING: {
    label: 'En cours',
    tone: 'bg-sky-50 text-sky-700 border-sky-200',
    help: "Un drain tient la ligne en ce moment. Ne pas relancer : c'est ainsi qu'un lead finit deux fois dans la feuille.",
  },
  SENT: {
    label: 'Envoyé',
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    help: 'Google a confirmé la ligne. Le crédit est débité après cette confirmation, jamais avant.',
  },
  BLOCKED_NO_CREDITS: {
    label: 'Crédits épuisés',
    tone: 'bg-rose-50 text-rose-700 border-rose-200',
    help: "Le compte n'a plus de quoi payer la ligne. Créditez-le : la file repart au tick suivant.",
  },
  FAILED: {
    label: 'Échec',
    tone: 'bg-rose-50 text-rose-700 border-rose-200',
    help: 'Google a refusé la ligne après toutes les tentatives. Le motif est dans la colonne erreur.',
  },
  SKIPPED: {
    label: 'Abandonné',
    tone: 'bg-gray-100 text-gray-600 border-gray-200',
    help: "La connexion Google du vendeur n'est plus active : rien ne pouvait plus partir.",
  },
  REMOVED: {
    label: 'Supprimé de la feuille',
    tone: 'bg-violet-50 text-violet-700 border-violet-200',
    help: 'La ligne a bien été écrite, puis le vendeur l’a supprimée à la main. Un renvoi est gratuit.',
  },
};

const TX_META: Record<TxType, { label: string; tone: string }> = {
  GRANT: { label: 'Crédit accordé', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CONSUME: { label: 'Lead envoyé', tone: 'bg-gray-100 text-gray-600 border-gray-200' },
  ADMIN_DEBIT: { label: 'Repris par un admin', tone: 'bg-rose-50 text-rose-700 border-rose-200' },
  REFUND: { label: 'Remboursement', tone: 'bg-sky-50 text-sky-700 border-sky-200' },
};

const ROLE_META: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  VENDOR: { label: 'Vendeur', icon: Store, tone: 'bg-primary-50 text-primary-700 border-primary-100' },
  INFLUENCER: {
    label: 'Influenceur',
    icon: Megaphone,
    tone: 'bg-influencer-50 text-influencer-700 border-influencer-100',
  },
};

/**
 * Au-delà de ça, un PENDING n'attend plus le prochain tick : le cron ne tourne
 * pas. Le drain vise quelques secondes, donc dix minutes est déjà une panne et
 * non un pic de charge.
 */
const STALE_QUEUE_MS = 10 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function apiMessage(err: unknown, fallback: string): string {
  const shaped = err as { response?: { data?: { message?: string } } };
  return shaped?.response?.data?.message || fallback;
}

const formatCount = (n: number) => (Number(n) || 0).toLocaleString('fr-FR');

const leadLabel = (count: number) => `${formatCount(count)} lead${count > 1 ? 's' : ''}`;

const formatDateTime = (iso: string | null | undefined) =>
  iso ? format(new Date(iso), 'dd/MM/yyyy HH:mm', { locale: fr }) : '—';

const formatDate = (iso: string | null | undefined) =>
  iso ? format(new Date(iso), 'dd MMM yyyy', { locale: fr }) : '—';

/** « il y a 3 h » — pour dire l'âge d'une file sans faire lire une date. */
function ago(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "à l'instant";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

/** Les compteurs que le drain renvoie, en une phrase lisible. */
function drainSummary(stats: DrainStats | null | undefined): string {
  if (!stats) return 'Rien à envoyer.';
  const parts: string[] = [];
  if (stats.sent) parts.push(`${leadLabel(stats.sent)} envoyé(s)`);
  if (stats.blocked) parts.push(`${stats.blocked} en attente de crédits`);
  if (stats.failed) parts.push(`${stats.failed} en échec`);
  if (stats.skipped) parts.push(`${stats.skipped} abandonné(s)`);
  if (stats.alreadySent) parts.push(`${stats.alreadySent} déjà dans la feuille`);
  return parts.length ? parts.join(' · ') : 'Rien à envoyer.';
}

/* ------------------------------------------------------------------ */
/* primitives locales                                                  */
/* ------------------------------------------------------------------ */

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
        <p className={`mt-1 text-xs font-medium ${alert ? 'text-rose-500' : 'text-gray-400'}`}>{hint}</p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: JobStatus }) {
  const meta = JOB_META[status] ?? {
    label: status,
    tone: 'bg-gray-100 text-gray-600 border-gray-200',
    help: '',
  };
  return (
    <span
      title={meta.help}
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${meta.tone}`}
    >
      {meta.label}
    </span>
  );
}

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

function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-gray-100">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-5 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-gray-100 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-100 rounded-full w-48" />
            <div className="h-2.5 bg-gray-50 rounded-full w-64" />
          </div>
          <div className="hidden md:block h-6 w-20 bg-gray-100 rounded-full" />
          <div className="hidden lg:block h-6 w-24 bg-gray-100 rounded-lg" />
          <div className="h-6 w-16 bg-gray-100 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

function Pager({
  pagination,
  page,
  busy,
  unit,
  onPage,
}: {
  pagination: Pagination;
  page: number;
  busy: boolean;
  unit: string;
  onPage: (next: number) => void;
}) {
  if (pagination.totalPages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/60">
      <p className="text-xs text-gray-500">
        Page <span className="font-bold text-gray-700">{pagination.page}</span> sur{' '}
        {Math.max(1, pagination.totalPages)} · {formatCount(pagination.total)} {unit}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1 || busy}
          onClick={() => onPage(Math.max(1, page - 1))}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={14} className="rtl:rotate-180" />
          Précédent
        </button>
        <button
          type="button"
          disabled={page >= pagination.totalPages || busy}
          onClick={() => onPage(Math.min(pagination.totalPages, page + 1))}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Suivant
          <ChevronRight size={14} className="rtl:rotate-180" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function SheetPushesPage() {
  const [tab, setTab] = useState<Tab>('overview');

  /**
   * « Actualiser » : un état pour le bouton lui-même, et un jeton pour l'onglet
   * Packs.
   *
   * Le bouton recharge l'onglet visible, mais l'onglet Packs est un composant
   * séparé qui possède ses propres données — sans ce jeton, cliquer « Actualiser »
   * sur cet onglet ne rechargeait que la vue d'ensemble, en silence : rien ne
   * bougeait à l'écran et le bouton passait pour cassé. `refreshing` fait tourner
   * l'icône le temps des requêtes, pour la même raison — un rafraîchissement
   * invisible est indiscernable d'un clic perdu.
   */
  const [refreshing, setRefreshing] = useState(false);
  const [plansRefreshToken, setPlansRefreshToken] = useState(0);

  /* ---------------- vue d'ensemble ---------------- */
  const [overview, setOverview] = useState<SheetOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  /* ---------------- historique ---------------- */
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [jobsPagination, setJobsPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsPage, setJobsPage] = useState(1);
  const [jobStatus, setJobStatus] = useState('');
  const [jobSearchInput, setJobSearchInput] = useState('');
  const [jobSearch, setJobSearch] = useState('');
  const [jobFrom, setJobFrom] = useState('');
  const [jobTo, setJobTo] = useState('');
  /** Compte épinglé depuis l'onglet Comptes — 0 = tous. */
  const [jobUserId, setJobUserId] = useState(0);
  const [jobUserLabel, setJobUserLabel] = useState('');
  const [retryingJobId, setRetryingJobId] = useState<number | null>(null);

  /* ---------------- comptes ---------------- */
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [accountsPagination, setAccountsPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsPage, setAccountsPage] = useState(1);
  const [accountSearchInput, setAccountSearchInput] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const [entitlement, setEntitlement] = useState('ENABLED');
  const [busyUuid, setBusyUuid] = useState<string | null>(null);

  const [expandedUuid, setExpandedUuid] = useState<string | null>(null);
  const [detail, setDetail] = useState<AccountDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  /** La dernière ligne demandée : une réponse plus lente d'une ligne refermée est jetée. */
  const detailRequest = useRef<string | null>(null);

  /* ---------------- grand livre ---------------- */
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [ledgerPagination, setLedgerPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerType, setLedgerType] = useState('');
  const [ledgerUserId, setLedgerUserId] = useState(0);
  const [ledgerUserLabel, setLedgerUserLabel] = useState('');

  /* ---------------- modale crédits ---------------- */
  const [creditTarget, setCreditTarget] = useState<AccountRow | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditDescription, setCreditDescription] = useState('');
  const [creditDirection, setCreditDirection] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [creditSaving, setCreditSaving] = useState(false);

  /**
   * Le tarif fait autorité côté serveur. Chaque payload le porte ; on garde le
   * dernier vu pour que les onglets qui ne l'ont pas encore chargé n'affichent
   * pas un prix inventé.
   */
  const [priceCents, setPriceCents] = useState(0);
  const takePrice = (value: unknown) => {
    const n = Number(value) || 0;
    if (n > 0) setPriceCents(n);
  };

  /* ---------------- chargements ---------------- */

  const loadOverview = async (silent = false) => {
    if (!silent) setOverviewLoading(true);
    try {
      const res = await sheetAdminApi.overview();
      const payload = res.data.data as SheetOverview;
      setOverview(payload);
      takePrice(payload?.priceCents);
    } catch (err) {
      toast.error(apiMessage(err, 'Erreur lors du chargement de la vue d’ensemble'));
    } finally {
      setOverviewLoading(false);
    }
  };

  const loadJobs = async () => {
    setJobsLoading(true);
    try {
      const res = await sheetAdminApi.jobs({
        page: jobsPage,
        limit: PAGE_SIZE,
        status: jobStatus || undefined,
        search: jobSearch || undefined,
        userId: jobUserId || undefined,
        from: jobFrom || undefined,
        to: jobTo || undefined,
      });
      const payload = res.data.data as { jobs: JobRow[]; pagination: Pagination; priceCents: number };
      setJobs(payload.jobs || []);
      if (payload.pagination) setJobsPagination(payload.pagination);
      takePrice(payload?.priceCents);
    } catch (err) {
      toast.error(apiMessage(err, "Erreur lors du chargement de l'historique"));
    } finally {
      setJobsLoading(false);
    }
  };

  const loadAccounts = async () => {
    setAccountsLoading(true);
    try {
      const res = await sheetAdminApi.accounts({
        page: accountsPage,
        limit: PAGE_SIZE,
        search: accountSearch || undefined,
        entitlement,
      });
      const payload = res.data.data as {
        accounts: AccountRow[];
        pagination: Pagination;
        priceCents: number;
      };
      setAccounts(payload.accounts || []);
      if (payload.pagination) setAccountsPagination(payload.pagination);
      takePrice(payload?.priceCents);
    } catch (err) {
      toast.error(apiMessage(err, 'Erreur lors du chargement des comptes'));
    } finally {
      setAccountsLoading(false);
    }
  };

  const loadLedger = async () => {
    setLedgerLoading(true);
    try {
      const res = await sheetAdminApi.transactions({
        page: ledgerPage,
        limit: PAGE_SIZE,
        type: ledgerType || undefined,
        userId: ledgerUserId || undefined,
      });
      const payload = res.data.data as {
        transactions: LedgerRow[];
        pagination: Pagination;
        priceCents: number;
      };
      setLedger(payload.transactions || []);
      if (payload.pagination) setLedgerPagination(payload.pagination);
      takePrice(payload?.priceCents);
    } catch (err) {
      toast.error(apiMessage(err, 'Erreur lors du chargement du grand livre'));
    } finally {
      setLedgerLoading(false);
    }
  };

  const loadDetail = async (uuid: string) => {
    detailRequest.current = uuid;
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await sheetAdminApi.account(uuid);
      if (detailRequest.current !== uuid) return;
      setDetail(res.data.data as AccountDetail);
    } catch (err) {
      if (detailRequest.current !== uuid) return;
      toast.error(apiMessage(err, 'Erreur lors du chargement du détail du compte'));
    } finally {
      if (detailRequest.current === uuid) setDetailLoading(false);
    }
  };

  // La frappe ne doit pas déclencher une requête par caractère, et une recherche
  // qui se pose ramène toujours à la première page : la page 3 des résultats
  // précédents n'existe probablement plus.
  useEffect(() => {
    const next = jobSearchInput.trim();
    const timer = window.setTimeout(() => {
      setJobSearch(next);
      setJobsPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [jobSearchInput]);

  useEffect(() => {
    const next = accountSearchInput.trim();
    const timer = window.setTimeout(() => {
      setAccountSearch(next);
      setAccountsPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [accountSearchInput]);

  useEffect(() => {
    loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chaque onglet ne charge que quand il est ouvert : l'historique et le grand
  // livre sont paginés sur des tables qui grossissent à chaque lead.
  useEffect(() => {
    if (tab !== 'jobs') return;
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, jobsPage, jobStatus, jobSearch, jobUserId, jobFrom, jobTo]);

  useEffect(() => {
    if (tab !== 'accounts') return;
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, accountsPage, accountSearch, entitlement]);

  useEffect(() => {
    if (tab !== 'ledger') return;
    loadLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, ledgerPage, ledgerType, ledgerUserId]);

  /* ---------------- actions ---------------- */

  const refreshCurrentTab = async () => {
    if (refreshing) return;
    setRefreshing(true);
    // Les loaders avalent leurs propres erreurs (toast), donc aucun d'eux ne
    // rejette : le Promise.all ne peut pas laisser le bouton tourner sans fin.
    try {
      if (tab === 'plans') setPlansRefreshToken((n) => n + 1);
      await Promise.all([
        loadOverview(true),
        tab === 'jobs' ? loadJobs() : null,
        tab === 'accounts' ? loadAccounts() : null,
        tab === 'ledger' ? loadLedger() : null,
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const retryJob = async (job: JobRow) => {
    setRetryingJobId(job.id);
    try {
      const res = await sheetAdminApi.retryJob(job.id);
      const stats = res.data.data as DrainStats;
      if (stats?.sent) toast.success(drainSummary(stats));
      else toast(drainSummary(stats), { icon: '↩️' });
      await loadJobs();
      loadOverview(true);
    } catch (err) {
      toast.error(apiMessage(err, "Erreur lors de la relance de l'envoi"));
    } finally {
      setRetryingJobId(null);
    }
  };

  const drainAccount = async (account: AccountRow, reconcile: boolean) => {
    setBusyUuid(account.uuid);
    try {
      const res = await sheetAdminApi.drain(account.uuid, reconcile);
      const payload = res.data.data as {
        stats: DrainStats;
        reconciled: { checked: number; removed: number; restored: number } | null;
      };
      const parts = [drainSummary(payload?.stats)];
      if (payload?.reconciled) {
        parts.push(
          `feuille relue : ${payload.reconciled.removed} ligne(s) disparue(s), ${payload.reconciled.restored} revenue(s)`
        );
      }
      toast.success(parts.join(' · '));
      await loadAccounts();
      if (expandedUuid === account.uuid) await loadDetail(account.uuid);
      loadOverview(true);
    } catch (err) {
      toast.error(apiMessage(err, 'Erreur lors de la relance du drain'));
    } finally {
      setBusyUuid(null);
    }
  };

  const toggleEntitlement = async (account: AccountRow) => {
    const next = !account.entitlement.enabled;
    setBusyUuid(account.uuid);
    try {
      await sheetAdminApi.setEntitlement(account.uuid, next);
      toast.success(
        next
          ? `Envoi des leads activé pour ${account.name}`
          : `Envoi des leads désactivé pour ${account.name}`
      );
      await loadAccounts();
      if (expandedUuid === account.uuid) await loadDetail(account.uuid);
      loadOverview(true);
    } catch (err) {
      toast.error(apiMessage(err, 'Erreur lors de la mise à jour du droit'));
    } finally {
      setBusyUuid(null);
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

  /** Ouvre l'historique filtré sur un compte — la question qui suit toujours une ligne. */
  const showAccountHistory = (account: AccountRow) => {
    setJobUserId(account.id);
    setJobUserLabel(account.name);
    setJobStatus('');
    setJobsPage(1);
    setTab('jobs');
  };

  const showAccountLedger = (account: AccountRow) => {
    setLedgerUserId(account.id);
    setLedgerUserLabel(account.name);
    setLedgerType('');
    setLedgerPage(1);
    setTab('ledger');
  };

  const closeCreditModal = () => {
    if (creditSaving) return;
    setCreditTarget(null);
    setCreditAmount('');
    setCreditDescription('');
    setCreditDirection('CREDIT');
  };

  // Le serveur attend des dollars et convertit lui-même ; on ne repasse en cents
  // que pour l'aperçu, en arrondissant pour ne pas traîner les décimales de 9.99.
  const creditCents = Math.round((Number(creditAmount) || 0) * 100);
  const creditLeads = centsToLeads(creditCents, priceCents);

  const submitCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditTarget || creditCents <= 0) return;

    setCreditSaving(true);
    try {
      const res = await sheetAdminApi.adjustCredits({
        userId: creditTarget.id,
        amount: Number(creditAmount),
        type: creditDirection,
        description: creditDescription.trim() || undefined,
      });
      const payload = res.data.data as { balance?: number; unlockedLeads?: number };
      const balance = Number(payload?.balance) || 0;
      const unlocked = Number(payload?.unlockedLeads) || 0;
      toast.success(
        `${creditDirection === 'CREDIT' ? 'Crédits accordés' : 'Crédits repris'} — nouveau solde : ${formatMoney(balance)}` +
          (unlocked > 0 ? ` · ${leadLabel(unlocked)} débloqué(s)` : '')
      );
      const uuid = creditTarget.uuid;
      setCreditTarget(null);
      setCreditAmount('');
      setCreditDescription('');
      setCreditDirection('CREDIT');
      await loadAccounts();
      if (expandedUuid === uuid) await loadDetail(uuid);
      loadOverview(true);
    } catch (err) {
      toast.error(apiMessage(err, "Erreur lors de l'opération sur les crédits"));
    } finally {
      setCreditSaving(false);
    }
  };

  /* ---------------- dérivés ---------------- */

  const queueStale = useMemo(() => {
    if (!overview?.oldestPendingAt) return false;
    return Date.now() - new Date(overview.oldestPendingAt).getTime() > STALE_QUEUE_MS;
  }, [overview?.oldestPendingAt]);

  const blockedCount = overview?.jobs?.BLOCKED_NO_CREDITS ?? 0;
  const pendingCount = (overview?.jobs?.PENDING ?? 0) + (overview?.jobs?.SENDING ?? 0);

  /* ================================================================== */
  /* rendu                                                              */
  /* ================================================================== */

  return (
    <div className="space-y-6">
      {/* ============================ EN-TÊTE ============================ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600">
            <FileSpreadsheet size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-gray-900">Envoi des leads</h1>
            <p className="text-sm text-gray-500">
              Tous les leads poussés vers les Google Sheets des vendeurs, et les crédits qui les
              paient.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/finance"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <DollarSign size={14} />
            Finance
          </Link>
          <button
            type="button"
            onClick={refreshCurrentTab}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Le tarif vient du serveur : il est affiché, jamais deviné. */}
      {priceCents > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
          <Coins size={16} className="text-emerald-600" />
          <p className="text-sm text-emerald-900">
            Tarif en vigueur : <span className="font-bold">{formatMoney(priceCents)}</span> par lead
            écrit dans la feuille. Le crédit n'est débité qu'
            <span className="font-semibold">après</span> confirmation de Google — une ligne qui
            n'arrive jamais ne coûte rien.
          </p>
        </div>
      )}

      {/* ============================ ONGLETS ============================ */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const TabIcon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
                active
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <TabIcon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ======================= VUE D'ENSEMBLE ======================= */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {queueStale && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-600" />
              <div className="text-sm text-rose-900">
                <p className="font-bold">La file ne se vide plus.</p>
                <p className="mt-0.5">
                  Le plus ancien envoi en attente date de {ago(overview?.oldestPendingAt)} alors que
                  le drain tourne toutes les quelques secondes. Vérifiez que le worker tourne et que
                  la clé de service Google est configurée — ce n'est pas un problème de crédits, un
                  compte à sec attend dans « Crédits épuisés ».
                </p>
              </div>
            </div>
          )}

          {overviewLoading && !overview ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-36 animate-pulse rounded-2xl border border-gray-100 bg-white" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  icon={Send}
                  label="Envoyés (24 h)"
                  value={formatCount(overview?.sent24h ?? 0)}
                  hint={`${formatCount(overview?.sent30d ?? 0)} sur 30 jours`}
                  tone="bg-emerald-50 text-emerald-600"
                />
                <StatCard
                  icon={Clock}
                  label="Dans la file"
                  value={formatCount(pendingCount)}
                  hint={
                    overview?.oldestPendingAt
                      ? `plus ancien : ${ago(overview.oldestPendingAt)}`
                      : 'file vide'
                  }
                  tone="bg-amber-50 text-amber-600"
                  alert={queueStale}
                />
                <StatCard
                  icon={Ban}
                  label="Crédits épuisés"
                  value={formatCount(blockedCount)}
                  hint={
                    blockedCount > 0
                      ? 'des leads attendent un rechargement'
                      : 'aucun compte bloqué'
                  }
                  tone="bg-rose-50 text-rose-600"
                  alert={blockedCount > 0}
                />
                <StatCard
                  icon={AlertTriangle}
                  label="Échecs"
                  value={formatCount(overview?.jobs?.FAILED ?? 0)}
                  hint={`${formatCount(overview?.jobs?.SKIPPED ?? 0)} abandonné(s) · ${formatCount(
                    overview?.jobs?.REMOVED ?? 0
                  )} supprimé(s) de la feuille`}
                  tone="bg-gray-100 text-gray-600"
                />
                <StatCard
                  icon={Users}
                  label="Comptes activés"
                  value={formatCount(overview?.accounts?.entitled ?? 0)}
                  hint={`${formatCount(overview?.accounts?.connected ?? 0)} feuille(s) connectée(s) · ${formatCount(
                    overview?.accounts?.autoOn ?? 0
                  )} en auto`}
                  tone="bg-sky-50 text-sky-600"
                />
                <StatCard
                  icon={Wallet}
                  label="Crédits en circulation"
                  value={formatMoney(overview?.credits?.outstanding ?? 0)}
                  hint={`≈ ${leadLabel(centsToLeads(overview?.credits?.outstanding ?? 0, priceCents))} encore payables`}
                  tone="bg-indigo-50 text-indigo-600"
                />
                <StatCard
                  icon={Coins}
                  label="Facturé (30 j)"
                  value={formatMoney(overview?.credits?.billed30d ?? 0)}
                  hint={`${formatMoney(overview?.credits?.granted30d ?? 0)} vendus sur la période`}
                  tone="bg-emerald-50 text-emerald-600"
                />
                <StatCard
                  icon={BadgeCheck}
                  label="Total consommé"
                  value={formatMoney(overview?.credits?.totalConsumed ?? 0)}
                  hint={`sur ${formatMoney(overview?.credits?.totalGranted ?? 0)} accordés depuis le début`}
                  tone="bg-violet-50 text-violet-600"
                />
              </div>

              {/* Répartition complète : c'est la légende de l'historique. */}
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-black text-gray-900">Tous les envois par statut</h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  Depuis le début. Cliquez un statut pour ouvrir l'historique filtré.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(Object.keys(JOB_META) as JobStatus[]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      title={JOB_META[status].help}
                      onClick={() => {
                        setJobStatus(status);
                        setJobsPage(1);
                        setTab('jobs');
                      }}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-transform hover:-translate-y-0.5 ${JOB_META[status].tone}`}
                    >
                      {JOB_META[status].label}
                      <span className="tabular-nums">{formatCount(overview?.jobs?.[status] ?? 0)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================= HISTORIQUE ========================= */}
      {tab === 'jobs' && (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/60 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search
                size={15}
                className="absolute start-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={jobSearchInput}
                onChange={(e) => setJobSearchInput(e.target.value)}
                placeholder="Lead, téléphone, n° de lead, vendeur…"
                className="input ps-10"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={jobStatus}
                onChange={(e) => {
                  setJobStatus(e.target.value);
                  setJobsPage(1);
                }}
                className="input w-auto"
              >
                <option value="">Tous les statuts</option>
                {(Object.keys(JOB_META) as JobStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {JOB_META[s].label}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={jobFrom}
                onChange={(e) => {
                  setJobFrom(e.target.value);
                  setJobsPage(1);
                }}
                className="input w-auto"
                aria-label="Depuis"
              />
              <input
                type="date"
                value={jobTo}
                onChange={(e) => {
                  setJobTo(e.target.value);
                  setJobsPage(1);
                }}
                className="input w-auto"
                aria-label="Jusqu'au"
              />
            </div>
          </div>

          {jobUserId > 0 && (
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-primary-50/60 px-5 py-2.5">
              <p className="text-xs font-semibold text-primary-700">
                Filtré sur le compte : {jobUserLabel}
              </p>
              <button
                type="button"
                onClick={() => {
                  setJobUserId(0);
                  setJobUserLabel('');
                  setJobsPage(1);
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-primary-700 hover:text-primary-900"
              >
                <X size={13} />
                Retirer
              </button>
            </div>
          )}

          {jobsLoading ? (
            <TableSkeleton />
          ) : jobs.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-gray-400">
              Aucun envoi ne correspond à ces filtres.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {jobs.map((job) => {
                const busy = retryingJobId === job.id;
                const retryable = job.status !== 'SENT' && job.status !== 'SENDING';
                return (
                  <li key={job.id} className="px-5 py-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-gray-900">
                            {job.lead?.fullName || `Lead #${job.lead?.id ?? '—'}`}
                          </span>
                          <StatusBadge status={job.status} />
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-gray-500">
                            {job.origin === 'AUTO' ? 'Auto' : 'Manuel'}
                          </span>
                          {job.attempts > 1 && (
                            <span className="text-[11px] font-semibold text-gray-400 tabular-nums">
                              {job.attempts} tentatives
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                          {job.lead?.phone && (
                            <span className="font-mono">{job.lead.phone}</span>
                          )}
                          {job.lead?.id && <span>Lead #{job.lead.id}</span>}
                          <span className="truncate">{job.vendor.name}</span>
                          <span>Capté {formatDateTime(job.createdAt)}</span>
                          {job.sentAt && <span>Écrit {formatDateTime(job.sentAt)}</span>}
                          {job.rowRange && <span className="font-mono">{job.rowRange}</span>}
                        </div>

                        {job.lastError && (
                          <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                            {job.lastError}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <div className="text-end">
                          <p
                            className={`text-sm font-black tabular-nums ${
                              job.chargedCents ? 'text-gray-900' : 'text-gray-300'
                            }`}
                          >
                            {job.chargedCents ? formatMoney(job.chargedCents) : 'gratuit'}
                          </p>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                            {job.chargedCents ? 'débité' : 'aucun débit'}
                          </p>
                        </div>

                        {retryable && (
                          <button
                            type="button"
                            onClick={() => retryJob(job)}
                            disabled={busy}
                            title="Renvoyer ce lead maintenant, par le même chemin que le bouton du vendeur"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-50 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {busy ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <RotateCw size={14} />
                            )}
                            Renvoyer
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <Pager
            pagination={jobsPagination}
            page={jobsPage}
            busy={jobsLoading}
            unit="envoi(s)"
            onPage={setJobsPage}
          />
        </div>
      )}

      {/* ========================== COMPTES ========================== */}
      {tab === 'accounts' && (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search
                size={15}
                className="absolute start-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={accountSearchInput}
                onChange={(e) => setAccountSearchInput(e.target.value)}
                placeholder="Nom, e-mail, téléphone…"
                className="input ps-10"
              />
            </div>
            <select
              value={entitlement}
              onChange={(e) => {
                setEntitlement(e.target.value);
                setAccountsPage(1);
              }}
              className="input w-auto"
            >
              <option value="ENABLED">Comptes activés</option>
              <option value="DISABLED">Non activés</option>
              <option value="ALL">Tous</option>
            </select>
          </div>

          {accountsLoading ? (
            <TableSkeleton />
          ) : accounts.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-gray-400">
              Aucun compte ne correspond à cette recherche.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {accounts.map((account) => {
                const roleMeta = ROLE_META[account.role] || {
                  label: account.role,
                  icon: Users,
                  tone: 'bg-gray-100 text-gray-600 border-gray-200',
                };
                const RoleIcon = roleMeta.icon;
                const busy = busyUuid === account.uuid;
                const expanded = expandedUuid === account.uuid;

                return (
                  <Fragment key={account.uuid}>
                    <li className="px-5 py-4">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleExpand(account.uuid)}
                              className="inline-flex items-center gap-1.5 font-bold text-gray-900 hover:text-primary-600"
                            >
                              <ChevronDown
                                size={14}
                                className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
                              />
                              {account.name}
                            </button>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${roleMeta.tone}`}
                            >
                              <RoleIcon size={10} />
                              {roleMeta.label}
                            </span>
                            {account.connection.connected ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                                <FileSpreadsheet size={10} />
                                {account.connection.active ? 'Feuille connectée' : 'En pause'}
                              </span>
                            ) : (
                              <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-gray-500">
                                Aucune feuille
                              </span>
                            )}
                            {account.connection.auto && (
                              <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-sky-700">
                                Auto
                              </span>
                            )}
                          </div>

                          <p className="mt-1 truncate text-xs text-gray-500">{account.email}</p>

                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                            <span>
                              Envoyés{' '}
                              <span className="font-bold text-gray-700 tabular-nums">
                                {formatCount(account.jobs.sent)}
                              </span>
                            </span>
                            <span>
                              En file{' '}
                              <span className="font-bold text-gray-700 tabular-nums">
                                {formatCount(account.jobs.pending)}
                              </span>
                            </span>
                            <span className={account.jobs.blocked > 0 ? 'text-rose-600' : undefined}>
                              Bloqués{' '}
                              <span className="font-bold tabular-nums">
                                {formatCount(account.jobs.blocked)}
                              </span>
                            </span>
                            <span className={account.jobs.failed > 0 ? 'text-rose-600' : undefined}>
                              Échecs{' '}
                              <span className="font-bold tabular-nums">
                                {formatCount(account.jobs.failed)}
                              </span>
                            </span>
                            <span>Dernier envoi {ago(account.lastSentAt)}</span>
                          </div>

                          {account.connection.lastError && (
                            <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                              {account.connection.lastError}
                              <span className="ms-1 text-rose-400">
                                ({formatDateTime(account.connection.lastErrorAt)})
                              </span>
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-3">
                          <div className="text-end">
                            <p
                              className={`text-lg font-black tabular-nums ${
                                account.credits.balance > 0 ? 'text-gray-900' : 'text-rose-600'
                              }`}
                            >
                              {formatMoney(account.credits.balance)}
                            </p>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                              ≈ {leadLabel(account.credits.affordable)}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => setCreditTarget(account)}
                            disabled={!account.entitlement.enabled}
                            title={
                              account.entitlement.enabled
                                ? 'Vendre ou reprendre des crédits'
                                : "Activez d'abord l'envoi des leads sur ce compte"
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Coins size={14} />
                            Crédits
                          </button>

                          <button
                            type="button"
                            onClick={() => drainAccount(account, false)}
                            disabled={busy || !account.entitlement.enabled}
                            title="Vider la file de ce compte maintenant, sans attendre le cron"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-50 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            Drainer
                          </button>

                          <Toggle
                            checked={account.entitlement.enabled}
                            disabled={busy}
                            onChange={() => toggleEntitlement(account)}
                            label={
                              account.entitlement.enabled
                                ? "Retirer le droit d'envoi des leads"
                                : "Activer l'envoi des leads"
                            }
                          />
                        </div>
                      </div>
                    </li>

                    {expanded && (
                      <li className="border-t border-gray-100 bg-gray-50/60 px-5 py-5">
                        {detailLoading || !detail ? (
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <Loader2 size={16} className="animate-spin" />
                            Chargement du détail…
                          </div>
                        ) : (
                          <div className="space-y-5">
                            {/* La réservation : ce que le vendeur ne voit pas encore. */}
                            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                              <div className="rounded-xl border border-gray-200 bg-white p-3.5">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                  Leads non envoyés
                                </p>
                                <p className="mt-1 text-xl font-black tabular-nums text-gray-900">
                                  {formatCount(detail.gate?.unsent ?? 0)}
                                </p>
                              </div>
                              <div className="rounded-xl border border-gray-200 bg-white p-3.5">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                  Verrouillés
                                </p>
                                <p
                                  className={`mt-1 text-xl font-black tabular-nums ${
                                    (detail.gate?.locked ?? 0) > 0 ? 'text-rose-600' : 'text-gray-900'
                                  }`}
                                >
                                  {formatCount(detail.gate?.locked ?? 0)}
                                </p>
                                <p className="mt-0.5 text-[11px] text-gray-400">
                                  numéros masqués faute de crédit
                                </p>
                              </div>
                              <div className="rounded-xl border border-gray-200 bg-white p-3.5">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                  Capacité restante
                                </p>
                                <p className="mt-1 text-xl font-black tabular-nums text-gray-900">
                                  {formatCount(Math.max(0, detail.gate?.capacity ?? 0))}
                                </p>
                              </div>
                              <div className="rounded-xl border border-gray-200 bg-white p-3.5">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                  Droit activé le
                                </p>
                                <p className="mt-1 text-sm font-bold text-gray-900">
                                  {formatDate(detail.account?.entitlement?.since)}
                                </p>
                                <p className="mt-0.5 text-[11px] text-gray-400">
                                  rien avant cette date n'est facturé
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => showAccountHistory(account)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-50 hover:text-primary-600"
                              >
                                <History size={14} />
                                Voir tous ses envois
                              </button>
                              <button
                                type="button"
                                onClick={() => showAccountLedger(account)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-50 hover:text-primary-600"
                              >
                                <Wallet size={14} />
                                Voir son grand livre
                              </button>
                              <button
                                type="button"
                                onClick={() => drainAccount(account, true)}
                                disabled={busy || !account.entitlement.enabled}
                                title="Relit d'abord la feuille du vendeur : les lignes qu'il a supprimées à la main repassent en « supprimé »"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-50 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <RefreshCw size={14} />
                                Relire la feuille puis drainer
                              </button>
                              {account.connection.url && (
                                <a
                                  href={account.connection.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-50 hover:text-primary-600"
                                >
                                  <ExternalLink size={14} />
                                  Ouvrir la feuille
                                  {account.connection.tab ? ` · ${account.connection.tab}` : ''}
                                </a>
                              )}
                            </div>

                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                              {/* Derniers envois */}
                              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                                <p className="border-b border-gray-100 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-gray-400">
                                  20 derniers envois
                                </p>
                                {detail.jobs.length === 0 ? (
                                  <p className="px-4 py-6 text-center text-xs text-gray-400">
                                    Aucun envoi.
                                  </p>
                                ) : (
                                  <ul className="divide-y divide-gray-50">
                                    {detail.jobs.map((j) => (
                                      <li
                                        key={j.id}
                                        className="flex items-center justify-between gap-3 px-4 py-2.5"
                                      >
                                        <div className="min-w-0">
                                          <p className="truncate text-xs font-semibold text-gray-800">
                                            {j.lead?.fullName || `Lead #${j.lead?.id ?? '—'}`}
                                          </p>
                                          <p className="text-[11px] text-gray-400">
                                            {formatDateTime(j.sentAt || j.createdAt)}
                                          </p>
                                        </div>
                                        <StatusBadge status={j.status} />
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>

                              {/* Dernières écritures */}
                              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                                <p className="border-b border-gray-100 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-gray-400">
                                  20 dernières écritures
                                </p>
                                {detail.transactions.length === 0 ? (
                                  <p className="px-4 py-6 text-center text-xs text-gray-400">
                                    Aucune écriture — ce compte n'a jamais reçu de crédits.
                                  </p>
                                ) : (
                                  <ul className="divide-y divide-gray-50">
                                    {detail.transactions.map((t) => (
                                      <li
                                        key={t.id}
                                        className="flex items-center justify-between gap-3 px-4 py-2.5"
                                      >
                                        <div className="min-w-0">
                                          <p className="truncate text-xs font-semibold text-gray-800">
                                            {t.description ||
                                              TX_META[t.type]?.label ||
                                              t.type}
                                          </p>
                                          <p className="text-[11px] text-gray-400">
                                            {formatDateTime(t.createdAt)}
                                          </p>
                                        </div>
                                        <div className="text-end">
                                          <p
                                            className={`text-xs font-black tabular-nums ${
                                              t.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                            }`}
                                          >
                                            {t.amount >= 0 ? '+' : '−'}
                                            {formatMoney(Math.abs(t.amount))}
                                          </p>
                                          <p className="text-[10px] tabular-nums text-gray-400">
                                            solde {formatMoney(t.balanceAfter)}
                                          </p>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </li>
                    )}
                  </Fragment>
                );
              })}
            </ul>
          )}

          <Pager
            pagination={accountsPagination}
            page={accountsPage}
            busy={accountsLoading}
            unit="compte(s)"
            onPage={setAccountsPage}
          />
        </div>
      )}

      {/* ========================= GRAND LIVRE ========================= */}
      {tab === 'ledger' && (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              Chaque mouvement de crédit, tous comptes confondus. Une consommation vaut exactement
              un lead écrit — la colonne « lead » dit lequel.
            </p>
            <select
              value={ledgerType}
              onChange={(e) => {
                setLedgerType(e.target.value);
                setLedgerPage(1);
              }}
              className="input w-auto"
            >
              <option value="">Tous les types</option>
              {(Object.keys(TX_META) as TxType[]).map((t) => (
                <option key={t} value={t}>
                  {TX_META[t].label}
                </option>
              ))}
            </select>
          </div>

          {ledgerUserId > 0 && (
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-primary-50/60 px-5 py-2.5">
              <p className="text-xs font-semibold text-primary-700">
                Filtré sur le compte : {ledgerUserLabel}
              </p>
              <button
                type="button"
                onClick={() => {
                  setLedgerUserId(0);
                  setLedgerUserLabel('');
                  setLedgerPage(1);
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-primary-700 hover:text-primary-900"
              >
                <X size={13} />
                Retirer
              </button>
            </div>
          )}

          {ledgerLoading ? (
            <TableSkeleton />
          ) : ledger.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-gray-400">
              Aucune écriture pour ces filtres.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {ledger.map((t) => {
                const meta = TX_META[t.type] || {
                  label: t.type,
                  tone: 'bg-gray-100 text-gray-600 border-gray-200',
                };
                return (
                  <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-gray-900">{t.user?.name || '—'}</span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${meta.tone}`}
                        >
                          {meta.label}
                        </span>
                        {t.leadId && (
                          <span className="text-[11px] font-semibold text-gray-400">
                            Lead #{t.leadId}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {t.description || '—'}
                        <span className="ms-2 text-gray-400">{formatDateTime(t.createdAt)}</span>
                      </p>
                    </div>
                    <div className="text-end">
                      <p
                        className={`text-sm font-black tabular-nums ${
                          t.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {t.amount >= 0 ? '+' : '−'}
                        {formatMoney(Math.abs(t.amount))}
                      </p>
                      <p className="text-[10px] tabular-nums text-gray-400">
                        solde {formatMoney(t.balanceAfter)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <Pager
            pagination={ledgerPagination}
            page={ledgerPage}
            busy={ledgerLoading}
            unit="écriture(s)"
            onPage={setLedgerPage}
          />
        </div>
      )}

      {/* ========================= MODALE CRÉDITS ========================= */}
      {creditTarget && (
        <Modal
          title="Crédits Google Sheets"
          subtitle={`${creditTarget.name} · ${creditTarget.email}`}
          onClose={closeCreditModal}
        >
          <form onSubmit={submitCredit} className="p-6 space-y-5">
            <div className="flex items-end justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Solde actuel
                </p>
                <p className="mt-1 text-2xl font-black tabular-nums text-gray-900">
                  {formatMoney(creditTarget.credits.balance)}
                </p>
              </div>
              <p className="text-end text-xs font-semibold tabular-nums text-emerald-600">
                ≈ {leadLabel(creditTarget.credits.affordable)}
              </p>
            </div>

            {creditTarget.jobs.blocked > 0 && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                {leadLabel(creditTarget.jobs.blocked)} attend(ent) faute de crédit. Un rechargement
                les repart au prochain passage du drain — inutile de les relancer un par un.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCreditDirection('CREDIT')}
                className={`inline-flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                  creditDirection === 'CREDIT'
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <PlusCircle size={16} />
                Créditer
              </button>
              <button
                type="button"
                onClick={() => setCreditDirection('DEBIT')}
                className={`inline-flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                  creditDirection === 'DEBIT'
                    ? 'border-rose-600 bg-rose-600 text-white'
                    : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
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
                    {formatMoney(creditCents)} ={' '}
                    <span
                      className={`font-bold ${
                        creditDirection === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {creditDirection === 'CREDIT' ? '+' : '−'} {leadLabel(creditLeads)}
                    </span>{' '}
                    au tarif de {formatMoney(priceCents)} par lead.
                  </span>
                ) : (
                  'Saisissez un montant pour voir combien de leads il achète.'
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
                placeholder="Pack de 500 leads payé par virement…"
                className="input"
              />
            </Field>

            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={closeCreditModal}
                disabled={creditSaving}
                className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={creditSaving || creditCents <= 0}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  creditDirection === 'CREDIT'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {creditSaving && <Loader2 size={16} className="animate-spin" />}
                {creditSaving
                  ? 'Enregistrement…'
                  : creditDirection === 'CREDIT'
                    ? `Créditer ${creditCents > 0 ? formatMoney(creditCents) : ''}`
                    : `Débiter ${creditCents > 0 ? formatMoney(creditCents) : ''}`}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ======================= PACKS & ABONNEMENTS ======================= */}
      {/* Tout est dans le composant : cette page ne connaît ni le catalogue ni
          la file de validation, exactement comme elle ne connaît pas la vente
          de crédits (POST /admin/sheet-credits/adjust). */}
      {tab === 'plans' && <SheetPlansAdminPanel refreshToken={plansRefreshToken} />}

    </div>
  );
}

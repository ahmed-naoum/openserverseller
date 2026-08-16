import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { leadsApi, ordersApi } from '../../lib/api';
import { CitySelect } from '../../components/ui/CitySelect';
import { PAYMENT_SITUATION_OPTIONS, normalizePaymentSituation } from '../../lib/paymentSituation';
import toast from 'react-hot-toast';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Package,
  MapPin,
  Phone,
  RefreshCw,
  Truck,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  CheckCircle2,
  Clock,
  Box,
  X,
  SlidersHorizontal,
  Printer,
  AlertTriangle,
  User,
  Banknote,
  Layers,
  Zap,
  TrendingUp,
  CalendarClock,
} from 'lucide-react';

interface Parcel {
  id: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerCity: string;
  customerAddress: string;
  totalAmountMad: number;
  status: string;
  paymentMethod: string;
  coliatyPackageCode: string | null;
  coliatyPackageId: number | null;
  coliatyPickupRef: string | null;
  packageContent: string | null;
  packageNoOpen: boolean;
  productVariant: string | null;
  items: Array<{
    id: number;
    productName: string;
    productImage: string | null;
    productSku: string | null;
    quantity: number;
    unitPriceMad: number;
    totalPriceMad: number;
  }>;
  leadId: number;
  leadFullName: string;
  leadStatus?: string;
  notes?: string | null;
  paymentSituation?: string;
  vendorId: number | null;
  vendorName: string | null;
  vendorEmail: string | null;
  createdAt: string;
  updatedAt?: string;
  lastStatusNote?: string | null;
  lastStatusAt?: string | null;
  lastStatusBy?: string | null;
}

interface HistoryEntry {
  id: string;
  HISTORY_TYPE: string;
  HISTORY_TIMESTAMP: number;
  HISTORY_STATUS: string;
  HISTORY_SITUATION: string;
  HISTORY_COMMENT: string | null;
  HISTORY_PROOF: string | null;
  HISTORY_STATUS_DATE: string | null;
  HISTORY_LIVREUR: any;
}

interface Stats {
  total: number;
  withColiaty: number;
  pending: number;
  delivered: number;
  returned: number;
  uninvoicedReturns: number;
  byStatus: Record<string, number>;
  revenueTotal: number;
  revenueDelivered: number;
  revenueInTransit: number;
  revenueReturned: number;
  /** Delivered revenue minus delivery fees, the platform's cut and the call
   *  center's saisie fee — the same net the invoice pays out, so the two can be
   *  reconciled line by line. */
  profitDelivered: number;
  shippingCostDelivered: number;
  platformFeeDelivered: number;
  /** Saisie fee of the assigned agent × delivered parcels. */
  agentCommissionDelivered: number;
  /** What the agent themself earns: their rate × delivered parcels. This page
   *  is agent-only, so this — not `profitDelivered` — is the figure the
   *  "bénéfice net" card shows, and it matches their facturation to the dirham. */
  agentEarningsDelivered: number;
  /** The rate behind the figure above, as the admin set it. Null for the roles
   *  that don't have one — only an agent is paid per parcel. */
  agentRatePerParcel: number | null;
}

const EMPTY_STATS: Stats = {
  total: 0,
  withColiaty: 0,
  pending: 0,
  delivered: 0,
  returned: 0,
  uninvoicedReturns: 0,
  byStatus: {},
  revenueTotal: 0,
  revenueDelivered: 0,
  revenueInTransit: 0,
  revenueReturned: 0,
  profitDelivered: 0,
  shippingCostDelivered: 0,
  platformFeeDelivered: 0,
  agentCommissionDelivered: 0,
  agentEarningsDelivered: 0,
  agentRatePerParcel: null,
};

interface Filters {
  search: string;
  statuses: string[];
  paymentSituation: string;
  city: string;
  vendorId: string;
  hasCode: '' | 'yes' | 'no';
  dateFrom: string;
  dateTo: string;
  minAmount: string;
  maxAmount: string;
  sort: string;
  /** A page size, or 'all' to pull the whole scope in one page (server caps at 5000). */
  limit: number | 'all';
}

const PAGE_SIZES: (number | 'all')[] = [10, 25, 50, 100, 200, 500, 'all'];

const DEFAULT_FILTERS: Filters = {
  search: '',
  statuses: [],
  paymentSituation: '',
  city: '',
  vendorId: '',
  hasCode: '',
  dateFrom: '',
  dateTo: '',
  minAmount: '',
  maxAmount: '',
  sort: 'recent',
  limit: 25,
};

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ComponentType<any> }> = {
  // Cycle de vie / Stock
  'NEW_PARCEL': { label: 'Nouveau Colis', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-100', icon: Box },
  'WAITING_PICKUP': { label: 'Attente Collecte', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100', icon: Clock },
  'WAITING_PREPARATION': { label: 'Attente Préparation', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100', icon: Clock },
  'PREPARED': { label: 'Préparé', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', icon: CheckCircle2 },
  'ENCORE_PREPARED': { label: 'En préparation', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', icon: RefreshCw },

  // En transit
  'PICKED_UP': { label: 'Collecté', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', icon: Package },
  'SENT': { label: 'Expédié', color: 'text-violet-600', bg: 'bg-violet-50 border-violet-100', icon: Truck },
  'SHIPPED': { label: 'Expédié', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100', icon: Truck },
  'RECEIVED': { label: 'Reçu (Destination)', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100', icon: MapPin },
  'DISTRIBUTION': { label: 'En livraison', color: 'text-cyan-600', bg: 'bg-cyan-50 border-cyan-100', icon: Truck },
  'PROGRAMMER_AUTO': { label: 'Livraison Auto', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-100', icon: Clock },
  'POSTPONED': { label: 'Reporté', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100', icon: Clock },
  'NOANSWER': { label: 'Pas de réponse', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100', icon: Phone },
  'ERR': { label: 'Tél Erroné', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100', icon: Phone },
  'PROGRAMMER': { label: 'Programmé', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', icon: Clock },
  'INCORRECT_ADDRESS': { label: 'Adresse Erronée', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100', icon: MapPin },

  // Livraison terminée
  'DELIVERED': { label: 'Livré', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', icon: CheckCircle2 },
  'RETURNED': { label: 'Retourné', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100', icon: Box },

  // Annulations
  'CANCELED_BY_SELLER': { label: 'Annulé (Vendeur)', color: 'text-red-600', bg: 'bg-red-50 border-red-100', icon: Box },
  'CANCELED_BY_SYSTEM': { label: 'Annulé (Système)', color: 'text-red-600', bg: 'bg-red-50 border-red-100', icon: Box },
  'CANCELED': { label: 'Annulé (Livreur)', color: 'text-red-600', bg: 'bg-red-50 border-red-100', icon: Box },
  'CANCELLED': { label: 'Annulé', color: 'text-red-600', bg: 'bg-red-50 border-red-100', icon: Box },
  'REFUSE': { label: 'Refusé', color: 'text-red-600', bg: 'bg-red-50 border-red-100', icon: Box },

  // Compatibility & Lead Statuses
  'PENDING': { label: 'En attente', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100', icon: Clock },
  'CONFIRMED': { label: 'Confirmé', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', icon: CheckCircle2 },
  'PUSHED_TO_DELIVERY': { label: 'En livraison', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100', icon: Truck },
  'CALL_LATER': { label: 'Rappel', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100', icon: Clock },
};

// Groups drive both the quick tabs and the checkbox panel, so a status can never
// be filterable in one place and unreachable in the other.
const STATUS_GROUPS: { key: string; label: string; emoji: string; statuses: string[] }[] = [
  {
    key: 'prep',
    label: 'Préparation',
    emoji: '📦',
    statuses: ['PENDING', 'CONFIRMED', 'NEW_PARCEL', 'WAITING_PICKUP', 'WAITING_PREPARATION', 'ENCORE_PREPARED', 'PREPARED'],
  },
  {
    key: 'transit',
    label: 'En transit',
    emoji: '🚚',
    statuses: ['PICKED_UP', 'SENT', 'SHIPPED', 'RECEIVED', 'DISTRIBUTION', 'PROGRAMMER', 'PROGRAMMER_AUTO', 'PUSHED_TO_DELIVERY'],
  },
  {
    key: 'issues',
    label: 'Incidents',
    emoji: '⚠️',
    statuses: ['POSTPONED', 'NOANSWER', 'ERR', 'INCORRECT_ADDRESS', 'CALL_LATER'],
  },
  { key: 'delivered', label: 'Livrés', emoji: '✅', statuses: ['DELIVERED'] },
  { key: 'returned', label: 'Retours', emoji: '↩️', statuses: ['RETURNED'] },
  {
    key: 'canceled',
    label: 'Annulés',
    emoji: '🚫',
    statuses: ['CANCELED_BY_SELLER', 'CANCELED_BY_SYSTEM', 'CANCELED', 'CANCELLED', 'REFUSE'],
  },
];

// Every situation the column can hold, FACTURED-CC included — a parcel the agent
// has already billed on /agent/facturation must not read as "Non payé" here.
const paymentConfig: Record<string, { label: string; color: string; bg: string; hint: string }> =
  Object.fromEntries(
    PAYMENT_SITUATION_OPTIONS.map(o => [o.value, { label: o.label, color: o.text, bg: o.bg, hint: o.hint }])
  );

const historyStatusLabels: Record<string, string> = {
  'NEW_PARCEL': 'Nouveau Colis',
  'WAITING_PICKUP': 'En attente de ramassage',
  'WAITING_PREPARATION': 'En attente de préparation',
  'ENCORE_PREPARED': 'En cours de traitement',
  'PREPARED': 'Préparé',
  'PICKED_UP': 'Ramassé',
  'SENT': 'En route (Destination)',
  'RECEIVED': 'Reçu à la destination',
  'PROGRAMMER_AUTO': 'Programmé (Auto)',
  'CANCELED_BY_SELLER': 'Annulé par le vendeur',
  'CANCELED_BY_SYSTEM': 'Annulé par le système',
  'DISTRIBUTION': 'En cours de distribution',
  'DELIVERED': 'Livré avec succès',
  'RETURNED': 'Retourné au hub',
  'POSTPONED': 'Livraison reportée',
  'NOANSWER': 'Pas de réponse',
  'CANCELED': 'Annulé lors de la livraison',
  'REFUSE': 'Refusé par le client',
  'ERR': 'Numéro de téléphone erroné',
  'PROGRAMMER': 'Livraison programmée',
  'INCORRECT_ADDRESS': 'Adresse erronée',
};

// Statuses where the parcel has stopped moving — used for the "en cours" ageing badge
const CLOSED_STATUSES = new Set([
  'DELIVERED', 'RETURNED', 'REFUSE',
  'CANCELED', 'CANCELED_BY_SELLER', 'CANCELED_BY_SYSTEM', 'CANCELLED',
]);

/* ── helpers ───────────────────────────────────────────────────────────── */

const parseDate = (value: unknown): Date | null => {
  if (!value) return null;
  const d = new Date(value as string);
  return isValid(d) ? d : null;
};

const fmtDate = (value: unknown, pattern = "dd MMM yyyy 'à' HH:mm") => {
  const d = parseDate(value);
  return d ? format(d, pattern, { locale: fr }) : '—';
};

/** Days since `value`, or null when the date is missing/unparseable. */
const daysSince = (value: unknown): number | null => {
  const d = parseDate(value);
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
};

const fmtAge = (days: number) => (days <= 0 ? "aujourd'hui" : days === 1 ? 'hier' : `il y a ${days} j`);

const fmtMad = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} MAD`;

/** A per-parcel rate, which an admin may have set to a half-dirham — so unlike
 *  the totals above this one keeps its decimals. */
const fmtRate = (n: number | null) =>
  `${(Number(n) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} MAD`;

/** Local `YYYY-MM-DD` — what a `date` input reads and writes. `toISOString`
 *  would shift the day for anyone east of UTC late in the evening. */
const toDateInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const daysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toDateInput(d);
};

/**
 * The same windows the agent dashboard offers, so the two pages answer "hier"
 * with the same range. Both bounds are inclusive whole days server-side, which
 * is why "Hier" closes on yesterday rather than opening onto today, and the
 * multi-day presets leave `to` empty instead of pinning it to this morning.
 */
const DATE_PRESETS: { key: string; label: string; range: () => { from: string; to: string } }[] = [
  { key: 'today', label: "Aujourd'hui", range: () => ({ from: daysAgo(0), to: '' }) },
  { key: 'yesterday', label: 'Hier', range: () => ({ from: daysAgo(1), to: daysAgo(1) }) },
  { key: '7d', label: '7 jours', range: () => ({ from: daysAgo(6), to: '' }) },
  { key: '30d', label: '30 jours', range: () => ({ from: daysAgo(29), to: '' }) },
  { key: 'all', label: 'Tout', range: () => ({ from: '', to: '' }) },
];

/** One decimal, only when it carries information — 2/16 has to read 12.5%, not 13%. */
const fmtPct = (n: number) => `${String(Math.round(n * 10) / 10)}%`;

/** Moroccan numbers reach WhatsApp as 212XXXXXXXXX, whatever shape they're stored in. */
const waNumber = (phone: string) => {
  const digits = (phone || '').replace(/\D/g, '');
  const local = digits.replace(/^(?:00212|212|0)/, '');
  return `212${local}`;
};

const downloadPdf = (base64: string, filename: string) => {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke late so the download has definitely started
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
};

// CSV export and the bulk-selection actions that fed it were removed on purpose:
// a call-center agent must not be able to walk off with the customer list
// (names, phones, addresses) in one click. Single-parcel actions stay.

/** Escape / backdrop-click / scroll-lock, so every modal on the page behaves the same. */
function Modal({
  onClose,
  children,
  widthClass = 'max-w-lg',
}: {
  onClose: () => void;
  children: React.ReactNode;
  widthClass?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`w-full ${widthClass} animate-slide-up`} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>,
    document.body
  );
}

/* ── page ──────────────────────────────────────────────────────────────── */

export default function AgentLivraison() {
  const [theme, setTheme] = useState<'classic' | 'girly' | 'princess'>(() => {
    return (localStorage.getItem('agent-theme') as 'classic' | 'girly' | 'princess') || 'girly';
  });

  const changeTheme = (next: 'classic' | 'girly' | 'princess') => {
    setTheme(next);
    localStorage.setItem('agent-theme', next);
    window.dispatchEvent(new Event('agent-theme-change'));
  };

  useEffect(() => {
    const syncTheme = () => {
      const current = (localStorage.getItem('agent-theme') as 'classic' | 'girly' | 'princess') || 'girly';
      setTheme(current);
    };
    window.addEventListener('agent-theme-change', syncTheme);
    return () => window.removeEventListener('agent-theme-change', syncTheme);
  }, []);

  const isGirly = theme === 'girly';
  const isPrincess = theme === 'princess';

  const [searchParams, setSearchParams] = useSearchParams();

  // The whole filter set lives in the URL, so a view is bookmarkable, survives a
  // refresh, and the dashboard's ?status=XXX deep link keeps working unchanged.
  const [filters, setFilters] = useState<Filters>(() => {
    const status = searchParams.get('status');
    return {
      ...DEFAULT_FILTERS,
      search: searchParams.get('q') || '',
      statuses: status ? status.split(',').filter(Boolean) : [],
      paymentSituation: searchParams.get('payment') || '',
      city: searchParams.get('city') || '',
      vendorId: searchParams.get('vendor') || '',
      hasCode: (searchParams.get('code') as Filters['hasCode']) || '',
      dateFrom: searchParams.get('from') || '',
      dateTo: searchParams.get('to') || '',
      minAmount: searchParams.get('min') || '',
      maxAmount: searchParams.get('max') || '',
      sort: searchParams.get('sort') || DEFAULT_FILTERS.sort,
      limit:
        searchParams.get('limit') === 'all'
          ? 'all'
          : Number(searchParams.get('limit')) || DEFAULT_FILTERS.limit,
    };
  });
  const [page, setPage] = useState(() => Number(searchParams.get('page')) || 1);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search.trim());
  const [showFilters, setShowFilters] = useState(false);

  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [filterOptions, setFilterOptions] = useState<{ cities: string[]; vendors: { id: number; name: string }[] }>({
    cities: [],
    vendors: [],
  });
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [revertingId, setRevertingId] = useState<number | null>(null);
  const [downloadingCode, setDownloadingCode] = useState<string | null>(null);

  const [coliatyCities, setColiatyCities] = useState<any[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [editingParcel, setEditingParcel] = useState<Parcel | null>(null);
  const [editMode, setEditMode] = useState<'edit' | 'relance'>('edit');
  const [editingSubmit, setEditingSubmit] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    price: '',
    note: '',
    city: '',
    address: '',
    package_content: '',
    package_no_open: false,
  });

  const [cancelTarget, setCancelTarget] = useState<Parcel | null>(null);

  const [historyParcel, setHistoryParcel] = useState<Parcel | null>(null);
  const [parcelHistory, setParcelHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [internalTimeline, setInternalTimeline] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [historyTab, setHistoryTab] = useState<'internal' | 'coliaty'>('internal');

  const [liveConnected, setLiveConnected] = useState(false);
  const [lastLiveUpdate, setLastLiveUpdate] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(() => localStorage.getItem('livraison-auto-refresh') === '1');
  const eventSourceRef = useRef<EventSource | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  /* ── data ────────────────────────────────────────────────────────────── */

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search.trim()), 400);
    return () => clearTimeout(t);
  }, [filters.search]);

  const queryParams = useMemo(() => {
    const params: Record<string, any> = { page, limit: filters.limit, sort: filters.sort };
    if (debouncedSearch) params.search = debouncedSearch;
    if (filters.statuses.length) params.status = filters.statuses.join(',');
    if (filters.paymentSituation) params.paymentSituation = filters.paymentSituation;
    if (filters.city) params.city = filters.city;
    if (filters.vendorId) params.vendorId = filters.vendorId;
    if (filters.hasCode) params.hasCode = filters.hasCode;
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    params.dateField = 'updatedAt';
    params.dateType = 'updatedAt';
    if (filters.minAmount) params.minAmount = filters.minAmount;
    if (filters.maxAmount) params.maxAmount = filters.maxAmount;
    return params;
  }, [page, filters, debouncedSearch]);

  const fetchParcels = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await leadsApi.livraison(queryParams);
        const data = res.data?.data || {};
        setParcels(data.parcels || []);
        setTotalResults(data.total || 0);
        setTotalPages(data.totalPages || 1);
        if (data.stats) setStats({ ...EMPTY_STATS, ...data.stats });
        if (data.filterOptions) setFilterOptions(data.filterOptions);
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Erreur lors du chargement des livraisons');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [queryParams]
  );

  useEffect(() => {
    fetchParcels();
  }, [fetchParcels]);

  // Mirror the filter set into the URL (replace, so filtering doesn't fill history)
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.statuses.length) params.set('status', filters.statuses.join(','));
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (filters.paymentSituation) params.set('payment', filters.paymentSituation);
    if (filters.city) params.set('city', filters.city);
    if (filters.vendorId) params.set('vendor', filters.vendorId);
    if (filters.hasCode) params.set('code', filters.hasCode);
    if (filters.dateFrom) params.set('from', filters.dateFrom);
    if (filters.dateTo) params.set('to', filters.dateTo);
    if (filters.minAmount) params.set('min', filters.minAmount);
    if (filters.maxAmount) params.set('max', filters.maxAmount);
    if (filters.sort !== DEFAULT_FILTERS.sort) params.set('sort', filters.sort);
    if (filters.limit !== DEFAULT_FILTERS.limit) params.set('limit', String(filters.limit));
    if (page > 1) params.set('page', String(page));
    setSearchParams(params, { replace: true });
  }, [filters, debouncedSearch, page, setSearchParams]);

  // Any change to the filter set invalidates the current page number
  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearch, filters.statuses, filters.paymentSituation, filters.city, filters.vendorId,
    filters.hasCode, filters.dateFrom, filters.dateTo, filters.minAmount, filters.maxAmount,
    filters.sort, filters.limit,
  ]);

  useEffect(() => {
    setLoadingCities(true);
    leadsApi
      .getColiatyCities()
      .then(res => setColiatyCities(res.data?.data || []))
      .catch(() => toast.error('Impossible de charger la liste des villes Coliaty'))
      .finally(() => setLoadingCities(false));
  }, []);

  // Live status pushes from the Coliaty webhooks
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const API_URL =
      (import.meta.env as any).VITE_API_URL ||
      (import.meta.env.PROD && typeof window !== 'undefined'
        ? `${window.location.origin}/api/v1`
        : 'http://localhost:3001/api/v1');
    const es = new EventSource(`${API_URL}/webhooks/stream?token=${token}`);
    eventSourceRef.current = es;

    es.addEventListener('connected', () => setLiveConnected(true));

    es.addEventListener('status_update', e => {
      let data: any;
      try {
        data = JSON.parse((e as MessageEvent).data);
      } catch {
        return; // a malformed frame must not take the stream down
      }

      setParcels(prev => prev.map(p => (p.id === data.orderId ? { ...p, status: data.newStatus } : p)));
      // Keep the scope counters honest without a full refetch
      const oldStatus: string | undefined = data.oldStatus;
      const newStatus: string = data.newStatus;
      setStats(prev => {
        const previous = oldStatus ? prev.byStatus[oldStatus] ?? 0 : 0;
        const byStatus: Record<string, number> = {
          ...prev.byStatus,
          [newStatus]: (prev.byStatus[newStatus] || 0) + 1,
        };
        if (oldStatus && previous > 0) byStatus[oldStatus] = previous - 1;
        return {
          ...prev,
          byStatus,
          pending: byStatus['PENDING'] || 0,
          delivered: byStatus['DELIVERED'] || 0,
          returned: byStatus['RETURNED'] || 0,
        };
      });
      setLastLiveUpdate(new Date().toLocaleTimeString('fr-FR'));
      toast.success(`📦 Colis ${data.packageCode} → ${statusConfig[data.newStatus]?.label || data.newStatus}`, {
        duration: 6000,
        id: `ws-${data.packageCode}`,
      });
    });

    es.onerror = () => setLiveConnected(false);

    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  // Fallback poll — SSE covers carrier pushes, this catches everything else
  useEffect(() => {
    localStorage.setItem('livraison-auto-refresh', autoRefresh ? '1' : '0');
    if (!autoRefresh) return;
    const id = setInterval(() => fetchParcels(true), 45_000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchParcels]);

  // "/" focuses search, like every list view in the app
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ── derived ─────────────────────────────────────────────────────────── */

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of STATUS_GROUPS) {
      counts[g.key] = g.statuses.reduce((sum, s) => sum + (stats.byStatus[s] || 0), 0);
    }
    return counts;
  }, [stats.byStatus]);

  const activeGroupKey = useMemo(() => {
    if (!filters.statuses.length) return 'all';
    const current = [...filters.statuses].sort().join(',');
    return STATUS_GROUPS.find(g => [...g.statuses].sort().join(',') === current)?.key ?? null;
  }, [filters.statuses]);

  // Statuses the server reports that we have no label for yet — surfaced so none
  // of them is ever unreachable from the filter panel.
  const unknownStatuses = useMemo(
    () => Object.keys(stats.byStatus).filter(k => !statusConfig[k] && k !== 'UNKNOWN').sort(),
    [stats.byStatus]
  );

  // Share of everything in scope that actually landed. Parcels still moving count
  // against it on purpose: the card sits next to "Total colis", so any narrower
  // denominator gets read as a share of that total.
  const deliveryRate = useMemo(
    () => (stats.total > 0 ? (stats.delivered / stats.total) * 100 : null),
    [stats.delivered, stats.total]
  );

  // The red warning still keys off closed parcels — a low rate above only means
  // parcels are in transit, while losing most of the finished ones to returns is
  // the thing actually worth flagging.
  const closedDeliveryRate = useMemo(() => {
    const closed = stats.delivered + stats.returned;
    return closed > 0 ? Math.round((stats.delivered / closed) * 100) : null;
  }, [stats.delivered, stats.returned]);

  // Match on both bounds so a closed preset ("Hier") lights its chip. A range
  // typed by hand matches none, which is what tells the two apart.
  const activeDatePreset = useMemo(() => {
    if (!filters.dateFrom && !filters.dateTo) return 'all';
    return DATE_PRESETS.find(p => {
      const { from, to } = p.range();
      return from === filters.dateFrom && to === filters.dateTo;
    })?.key ?? null;
  }, [filters.dateFrom, filters.dateTo]);

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (debouncedSearch) {
      chips.push({ key: 'search', label: `Recherche : "${debouncedSearch}"`, clear: () => setFilters(f => ({ ...f, search: '' })) });
    }
    filters.statuses.forEach(s =>
      chips.push({
        key: `status-${s}`,
        label: `Statut : ${statusConfig[s]?.label || s}`,
        clear: () => setFilters(f => ({ ...f, statuses: f.statuses.filter(x => x !== s) })),
      })
    );
    if (filters.paymentSituation) {
      chips.push({
        key: 'payment',
        label: `Paiement : ${paymentConfig[filters.paymentSituation]?.label || filters.paymentSituation}`,
        clear: () => setFilters(f => ({ ...f, paymentSituation: '' })),
      });
    }
    if (filters.city) chips.push({ key: 'city', label: `Ville : ${filters.city}`, clear: () => setFilters(f => ({ ...f, city: '' })) });
    if (filters.vendorId) {
      const v = filterOptions.vendors.find(x => String(x.id) === filters.vendorId);
      chips.push({ key: 'vendor', label: `Référent : ${v?.name || filters.vendorId}`, clear: () => setFilters(f => ({ ...f, vendorId: '' })) });
    }
    if (filters.hasCode) {
      chips.push({
        key: 'code',
        label: filters.hasCode === 'yes' ? 'Avec code Coliaty' : 'Sans code Coliaty',
        clear: () => setFilters(f => ({ ...f, hasCode: '' })),
      });
    }
    if (filters.dateFrom) chips.push({ key: 'from', label: `Du ${filters.dateFrom}`, clear: () => setFilters(f => ({ ...f, dateFrom: '' })) });
    if (filters.dateTo) chips.push({ key: 'to', label: `Au ${filters.dateTo}`, clear: () => setFilters(f => ({ ...f, dateTo: '' })) });
    if (filters.minAmount) chips.push({ key: 'min', label: `Min ${filters.minAmount} MAD`, clear: () => setFilters(f => ({ ...f, minAmount: '' })) });
    if (filters.maxAmount) chips.push({ key: 'max', label: `Max ${filters.maxAmount} MAD`, clear: () => setFilters(f => ({ ...f, maxAmount: '' })) });
    return chips;
  }, [filters, debouncedSearch, filterOptions]);

  /* ── actions ─────────────────────────────────────────────────────────── */

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  const toggleStatusFilter = (status: string) =>
    setFilters(f => ({
      ...f,
      statuses: f.statuses.includes(status) ? f.statuses.filter(s => s !== status) : [...f.statuses, status],
    }));

  const applyDatePreset = (preset: (typeof DATE_PRESETS)[number]) => {
    const { from, to } = preset.range();
    setFilters(f => ({ ...f, dateFrom: from, dateTo: to }));
  };

  const applyGroup = (key: string) => {
    const group = STATUS_GROUPS.find(g => g.key === key);
    setFilters(f => ({ ...f, statuses: group ? [...group.statuses] : [] }));
  };

  const handleCopy = (text: string, message: string, codeKey?: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        if (codeKey) {
          setCopiedCode(codeKey);
          setTimeout(() => setCopiedCode(null), 2000);
        }
        toast.success(message);
      })
      .catch(() => toast.error('Copie impossible dans ce navigateur'));
  };

  const handleDownloadLabel = async (code: string) => {
    setDownloadingCode(code);
    try {
      const res = await ordersApi.getParcelLabel(code);
      const base64 = res.data?.data?.pdf;
      if (!base64) throw new Error('PDF manquant');
      downloadPdf(base64, `etiquette-${code}.pdf`);
      toast.success('Étiquette téléchargée');
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Impossible de récupérer l'étiquette");
    } finally {
      setDownloadingCode(null);
    }
  };

  const handleRevertToLead = async (parcel: Parcel) => {
    setRevertingId(parcel.id);
    try {
      await ordersApi.revertToLead(parcel.id);
      toast.success('Colis annulé et retourné aux leads !');
      setCancelTarget(null);
      fetchParcels(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Erreur lors de l'annulation du colis");
    } finally {
      setRevertingId(null);
    }
  };

  const handleOpenEdit = (parcel: Parcel, mode: 'edit' | 'relance') => {
    setEditingParcel(parcel);
    setEditMode(mode);
    setEditForm({
      name: parcel.customerName,
      phone: parcel.customerPhone,
      price: String(Math.round(Number(parcel.totalAmountMad) || 0)),
      note: '',
      city: parcel.customerCity,
      address: parcel.customerAddress,
      package_content: parcel.packageContent || '',
      package_no_open: parcel.packageNoOpen || false,
    });
  };

  const handleOpenHistory = async (parcel: Parcel) => {
    setHistoryParcel(parcel);
    setParcelHistory([]);
    setInternalTimeline([]);
    setHistoryTab('internal');

    setLoadingTimeline(true);
    leadsApi
      .timeline(parcel.leadId)
      .then(res => setInternalTimeline(res.data?.data?.entries || []))
      .catch(() => {})
      .finally(() => setLoadingTimeline(false));

    if (!parcel.coliatyPackageCode) return;
    setLoadingHistory(true);
    try {
      const res = await leadsApi.getParcelHistory(parcel.coliatyPackageCode);
      setParcelHistory(res.data?.data?.details || []);
    } catch {
      toast.error("Impossible de récupérer l'historique du colis");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParcel) return;

    if (editMode === 'relance' && !editForm.note.trim()) {
      toast.error('Merci de préciser le motif de la relance');
      return;
    }

    setEditingSubmit(true);
    try {
      if (editMode === 'relance') {
        const destinationChanged =
          editForm.city !== editingParcel.customerCity || editForm.address !== editingParcel.customerAddress;

        await ordersApi.changeDemand(editingParcel.id, {
          package_code: editingParcel.coliatyPackageCode,
          request_type: destinationChanged ? 'CHANGE_DESTINATION' : 'CORRECT_INFORMATION',
          package_reciever: editForm.name,
          package_phone: editForm.phone,
          package_price: Number(editForm.price),
          package_note: editForm.note,
          package_city: editForm.city,
          package_address: editForm.address,
        });
        toast.success('Relance envoyée avec succès !');
      } else {
        await ordersApi.updateNormal(editingParcel.id, {
          package_reciever: editForm.name,
          package_phone: editForm.phone,
          package_price: Number(editForm.price),
          package_city: editForm.city,
          package_addresse: editForm.address,
          package_content: editForm.package_content,
          package_no_open: editForm.package_no_open,
        });
        toast.success('Colis modifié avec succès !');
      }

      setEditingParcel(null);
      fetchParcels(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Erreur lors de l'opération");
    } finally {
      setEditingSubmit(false);
    }
  };

  /* ── render ──────────────────────────────────────────────────────────── */

  const cardBorder = isPrincess ? 'border-amber-100/40' : isGirly ? 'border-pink-100/40' : 'border-gray-100';
  const ringAccent =
    isPrincess ? 'focus:ring-amber-400' : isGirly ? 'focus:ring-pink-400' : 'focus:ring-indigo-500';

  const kpis = [
    {
      label: 'Total colis',
      value: String(stats.total),
      sub: `${stats.withColiaty} synchronisés`,
      icon: Package,
      color: isPrincess ? 'from-amber-400 via-pink-500 to-rose-500' : isGirly ? 'from-pink-400 to-rose-500' : 'from-blue-500 to-indigo-500',
      shadow: isPrincess ? 'shadow-amber-100' : isGirly ? 'shadow-pink-100' : 'shadow-blue-200',
    },
    {
      label: 'En cours',
      value: fmtMad(stats.revenueInTransit),
      sub: `${stats.total - stats.delivered - stats.returned} colis en circulation`,
      icon: Truck,
      color: 'from-cyan-400 to-blue-500',
      shadow: 'shadow-cyan-200',
    },
    {
      label: 'Encaissé (livré)',
      value: fmtMad(stats.revenueDelivered),
      sub: `${stats.delivered} colis livrés`,
      icon: Banknote,
      color: 'from-emerald-400 to-teal-500',
      shadow: 'shadow-emerald-200',
    },
    {
      // The agent's own earnings on the parcels that reached the customer — the
      // card above is what the customer paid, this is what the agent keeps. The
      // courier and the platform's cut come out of the vendor's margin, never
      // out of this, so it can never go negative.
      label: 'Bénéfice net (livré)',
      value: fmtMad(stats.agentEarningsDelivered),
      sub:
        stats.delivered > 0
          ? `${stats.delivered} colis livré${stats.delivered > 1 ? 's' : ''} × ${fmtRate(
              stats.agentRatePerParcel
            )} · à facturer dans Facturation`
          : 'Aucun colis livré pour le moment',
      icon: TrendingUp,
      color: 'from-lime-400 to-green-500',
      shadow: 'shadow-lime-200',
    },
    {
      label: 'Taux de livraison',
      value: deliveryRate === null ? '—' : fmtPct(deliveryRate),
      sub: `${stats.delivered}/${stats.total} livrés · ${stats.returned} retour${stats.returned > 1 ? 's' : ''} · ${fmtMad(stats.revenueReturned)}`,
      icon: CheckCircle2,
      color: closedDeliveryRate !== null && closedDeliveryRate < 60 ? 'from-rose-400 to-red-500' : 'from-violet-400 to-purple-500',
      shadow: closedDeliveryRate !== null && closedDeliveryRate < 60 ? 'shadow-rose-200' : 'shadow-violet-200',
    },
  ];

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg ${
                isPrincess
                  ? 'bg-gradient-to-br from-amber-400 via-pink-500 to-rose-500 shadow-amber-200'
                  : isGirly
                  ? 'bg-gradient-to-br from-pink-400 to-rose-500 shadow-pink-200'
                  : 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-200'
              }`}
            >
              <Truck className="w-5 h-5 text-white" />
            </div>
            {isPrincess ? 'Livraison Princesse Royale 👑' : isGirly ? 'Livraison Coliaty 🌸' : 'Livraison Coliaty'}
          </h1>
          <p className="text-sm text-gray-500 mt-1 sm:ml-13">
            Suivez, corrigez et imprimez vos colis envoyés à la livraison.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative inline-block">
            <select
              value={theme}
              onChange={e => changeTheme(e.target.value as any)}
              aria-label="Thème de la page"
              className={`pl-3 pr-8 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-300 shadow-sm border outline-none appearance-none cursor-pointer ${
                isPrincess
                  ? 'bg-gradient-to-r from-amber-500 via-pink-500 to-rose-500 text-white border-amber-600 shadow-md shadow-amber-500/20'
                  : isGirly
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white border-pink-600 shadow-md shadow-pink-500/20'
                  : 'bg-indigo-600 text-white border-indigo-700'
              }`}
            >
              <option value="classic" className="text-gray-900 bg-white font-bold">🕶️ Classique</option>
              <option value="girly" className="text-gray-900 bg-white font-bold">🌸 Thème Girly ✨</option>
              <option value="princess" className="text-gray-900 bg-white font-bold">💅 Princess Pink 👑</option>
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-white font-black text-[8px]">▼</div>
          </div>

          <button
            onClick={() => setAutoRefresh(a => !a)}
            title="Rafraîchir automatiquement toutes les 45 secondes"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
              autoRefresh
                ? 'bg-violet-50 text-violet-600 border-violet-200'
                : 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100'
            }`}
          >
            <Zap className={`w-3 h-3 ${autoRefresh ? 'fill-violet-400' : ''}`} />
            Auto
          </button>

          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
              liveConnected ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-50 text-gray-400 border-gray-100'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${liveConnected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
            {liveConnected ? 'Live' : 'Hors ligne'}
            {lastLiveUpdate && liveConnected && (
              <span className="text-emerald-400 font-medium normal-case tracking-normal ml-1">· {lastLiveUpdate}</span>
            )}
          </div>

          <button
            onClick={() => fetchParcels(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      {/* KPIs — computed server-side over the agent's whole scope, not this page */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {kpis.map(kpi => (
          <div
            key={kpi.label}
            className={`bg-white rounded-2xl border shadow-sm p-5 hover:shadow-md transition-all duration-300 ${cardBorder}`}
          >
            <div className={`w-10 h-10 bg-gradient-to-br ${kpi.color} rounded-xl flex items-center justify-center shadow-lg ${kpi.shadow} mb-3`}>
              <kpi.icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-gray-900 tabular-nums truncate" title={kpi.value}>
              {kpi.value}
            </p>
            <p className="text-xs text-gray-500 font-medium mt-0.5">{kpi.label}</p>
            <p className="text-[10px] text-gray-400 font-medium mt-1 truncate" title={kpi.sub}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Quick status tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
        <button
          onClick={() => applyGroup('all')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black whitespace-nowrap transition-all border ${
            activeGroupKey === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md'
              : 'bg-white text-slate-500 border-gray-100 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Tous
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeGroupKey === 'all' ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
            {stats.total}
          </span>
        </button>
        {STATUS_GROUPS.map(g => (
          <button
            key={g.key}
            onClick={() => applyGroup(g.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black whitespace-nowrap transition-all border ${
              activeGroupKey === g.key
                ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                : 'bg-white text-slate-500 border-gray-100 hover:bg-slate-50'
            }`}
          >
            <span>{g.emoji}</span>
            {g.label}
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeGroupKey === g.key ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
              {groupCounts[g.key] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className={`bg-white rounded-2xl border shadow-sm p-4 space-y-4 ${cardBorder}`}>
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              placeholder="Rechercher par nom, téléphone, ville, n° commande, code Coliaty...  ( / )"
              className={`w-full pl-10 pr-9 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none transition-all focus:border-transparent focus:ring-2 ${ringAccent}`}
            />
            {filters.search && (
              <button
                onClick={() => setFilters(f => ({ ...f, search: '' }))}
                aria-label="Effacer la recherche"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <select
            value={filters.sort}
            onChange={e => setFilters(f => ({ ...f, sort: e.target.value }))}
            aria-label="Trier les colis"
            className={`px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 outline-none cursor-pointer focus:ring-2 ${ringAccent}`}
          >
            <option value="recent">Trier : Plus récents</option>
            <option value="oldest">Trier : Plus anciens</option>
            <option value="newest_order">Trier : Date de commande ↓</option>
            <option value="oldest_order">Trier : Date de commande ↑</option>
            <option value="amount_desc">Trier : Montant ↓</option>
            <option value="amount_asc">Trier : Montant ↑</option>
            <option value="customer">Trier : Client (A-Z)</option>
          </select>

          <button
            onClick={() => setShowFilters(s => !s)}
            className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all border ${
              showFilters || activeFilterChips.length > 0
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filtres
            {activeFilterChips.length > 0 && (
              <span className="px-1.5 py-0.5 bg-white/25 rounded-md text-[10px] font-black">{activeFilterChips.length}</span>
            )}
            {showFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

        </div>

        {showFilters && (
          <div className="border-t border-gray-100 pt-4 space-y-4">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Statut du colis</p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {STATUS_GROUPS.map(group => (
                  <div key={group.key} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2">
                      {group.emoji} {group.label}
                    </p>
                    <div className="space-y-1">
                      {group.statuses.map(s => (
                        <label key={s} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={filters.statuses.includes(s)}
                            onChange={() => toggleStatusFilter(s)}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span className="text-[11px] font-semibold text-gray-600 group-hover:text-indigo-600 transition-colors flex-1 truncate">
                            {statusConfig[s]?.label || s}
                          </span>
                          {(stats.byStatus[s] || 0) > 0 && (
                            <span className="text-[9px] font-black text-gray-400 bg-white px-1.5 py-0.5 rounded border border-gray-100">
                              {stats.byStatus[s]}
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                {unknownStatuses.length > 0 && (
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2">❔ Autres statuts</p>
                    <div className="space-y-1">
                      {unknownStatuses.map(s => (
                        <label key={s} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={filters.statuses.includes(s)}
                            onChange={() => toggleStatusFilter(s)}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span className="text-[11px] font-semibold text-gray-600 flex-1 truncate">{s}</span>
                          <span className="text-[9px] font-black text-gray-400 bg-white px-1.5 py-0.5 rounded border border-gray-100">
                            {stats.byStatus[s]}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Situation de paiement</label>
                <select
                  value={filters.paymentSituation}
                  onChange={e => setFilters(f => ({ ...f, paymentSituation: e.target.value }))}
                  className={`mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none cursor-pointer focus:ring-2 ${ringAccent}`}
                >
                  <option value="">Toutes</option>
                  {Object.entries(paymentConfig).map(([val, cfg]) => (
                    <option key={val} value={val}>{cfg.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Ville</label>
                <select
                  value={filters.city}
                  onChange={e => setFilters(f => ({ ...f, city: e.target.value }))}
                  className={`mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none cursor-pointer focus:ring-2 ${ringAccent}`}
                >
                  <option value="">Toutes les villes</option>
                  {filterOptions.cities.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Référent</label>
                <select
                  value={filters.vendorId}
                  onChange={e => setFilters(f => ({ ...f, vendorId: e.target.value }))}
                  className={`mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none cursor-pointer focus:ring-2 ${ringAccent}`}
                >
                  <option value="">Tous les référents</option>
                  {filterOptions.vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Code Coliaty</label>
                <select
                  value={filters.hasCode}
                  onChange={e => setFilters(f => ({ ...f, hasCode: e.target.value as Filters['hasCode'] }))}
                  className={`mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none cursor-pointer focus:ring-2 ${ringAccent}`}
                >
                  <option value="">Tous</option>
                  <option value="yes">Synchronisés</option>
                  <option value="no">Non synchronisés</option>
                </select>
              </div>

              {/* Raccourcis de période — la fenêtre s'applique aussi aux KPIs
                  en haut de page, qui sont calculés côté serveur sur la même
                  plage que la liste. */}
              <div className="sm:col-span-2 xl:col-span-4">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarClock className="w-3 h-3" />
                  Période
                </label>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {DATE_PRESETS.map(preset => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => applyDatePreset(preset)}
                      aria-pressed={activeDatePreset === preset.key}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                        activeDatePreset === preset.key
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-white text-gray-500 border-gray-200 hover:text-gray-900 hover:border-gray-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Du</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                  className={`mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 ${ringAccent}`}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Au</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                  className={`mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 ${ringAccent}`}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Montant (MAD)</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={filters.minAmount}
                    onChange={e => setFilters(f => ({ ...f, minAmount: e.target.value }))}
                    placeholder="Min"
                    className={`w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 ${ringAccent}`}
                  />
                  <input
                    type="number"
                    min={0}
                    value={filters.maxAmount}
                    onChange={e => setFilters(f => ({ ...f, maxAmount: e.target.value }))}
                    placeholder="Max"
                    className={`w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 ${ringAccent}`}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Colis par page</label>
                <select
                  value={String(filters.limit)}
                  onChange={e =>
                    setFilters(f => ({ ...f, limit: e.target.value === 'all' ? 'all' : Number(e.target.value) }))
                  }
                  className={`mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none cursor-pointer focus:ring-2 ${ringAccent}`}
                >
                  {PAGE_SIZES.map(n => (
                    <option key={String(n)} value={String(n)}>
                      {n === 'all' ? 'Tout afficher' : n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Result count + active chips */}
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
          <span className="text-xs font-bold text-gray-500">
            {totalResults} colis trouvé{totalResults > 1 ? 's' : ''}
            {filters.limit !== 'all' && totalPages > 1 && (
              <span className="text-gray-400 font-medium"> · {parcels.length} affichés</span>
            )}
          </span>

          {/* One click to drop pagination entirely and render the whole result set */}
          <button
            onClick={() => setFilters(f => ({ ...f, limit: f.limit === 'all' ? DEFAULT_FILTERS.limit : 'all' }))}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider border transition-all ${
              filters.limit === 'all'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
            }`}
            title={
              filters.limit === 'all'
                ? 'Revenir à la pagination'
                : 'Afficher tous les colis sur une seule page'
            }
          >
            <Layers className="w-3 h-3" />
            {filters.limit === 'all' ? 'Tout affiché' : 'Tout afficher'}
          </button>

          {activeFilterChips.map(chip => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-[11px] font-bold"
            >
              {chip.label}
              <button onClick={chip.clear} aria-label={`Retirer ${chip.label}`} className="hover:text-indigo-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {activeFilterChips.length > 0 && (
            <button
              onClick={resetFilters}
              className="ml-auto px-3 py-1 text-[11px] font-black text-rose-600 hover:bg-rose-50 rounded-lg transition-colors uppercase tracking-wider"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Parcels */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className={`w-12 h-12 border-4 rounded-full animate-spin ${isGirly ? 'border-pink-100 border-t-pink-500' : 'border-indigo-100 border-t-indigo-500'}`} />
          <p className="text-gray-400 text-sm font-medium">Chargement des livraisons...</p>
        </div>
      ) : parcels.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 ${isGirly ? 'bg-gradient-to-br from-pink-50 to-rose-50' : 'bg-gradient-to-br from-indigo-50 to-purple-50'}`}>
            <Truck className={`w-10 h-10 ${isGirly ? 'text-pink-300' : 'text-indigo-300'}`} />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">
            {activeFilterChips.length > 0 ? 'Aucun résultat' : 'Aucune livraison'}
          </h3>
          <p className="text-gray-400 text-sm max-w-xs mx-auto">
            {activeFilterChips.length > 0
              ? 'Aucun colis ne correspond aux filtres sélectionnés.'
              : 'Envoyez des commandes à la livraison depuis la page "Mes Prospects" et elles apparaîtront ici.'}
          </p>
          {activeFilterChips.length > 0 && (
            <button
              onClick={resetFilters}
              className="mt-5 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-800 transition-all"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {parcels.map(parcel => {
            const status = statusConfig[parcel.status] || {
              label: parcel.status,
              color: 'text-gray-600',
              bg: 'bg-gray-50 border-gray-200',
              icon: Package,
            };
            const StatusIcon = status.icon;
            const isExpanded = expandedId === parcel.id;
            const payment = parcel.paymentSituation
              ? paymentConfig[normalizePaymentSituation(parcel.paymentSituation)]
              : undefined;
            const age = daysSince(parcel.createdAt);
            const isStale = age !== null && age >= 7 && !CLOSED_STATUSES.has(parcel.status);
            // The parcel's product is what an agent scans the row for; the
            // customer's initial told them nothing they could not read beside it.
            const productImage = parcel.items?.find(i => i.productImage)?.productImage || null;

            return (
              <div
                key={parcel.id}
                className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden ${
                  isGirly ? 'border-pink-100/40 hover:border-pink-200' : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Left: product + customer */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        {productImage ? (
                          <img
                            src={productImage}
                            alt={parcel.items?.[0]?.productName || 'Produit'}
                            loading="lazy"
                            title={parcel.items?.map(i => `${i.productName} x${i.quantity}`).join(' · ')}
                            className="w-10 h-10 rounded-xl object-cover border border-gray-100 bg-gray-50 flex-shrink-0"
                          />
                        ) : (
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${
                              isGirly ? 'from-pink-100 to-rose-100 text-pink-600' : 'from-indigo-100 to-purple-100 text-indigo-600'
                            }`}
                            title={parcel.packageContent || 'Produit'}
                          >
                            <Package className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 truncate">{parcel.customerName}</p>
                          <p className="text-xs text-gray-400 font-medium">#{parcel.orderNumber}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-gray-500">
                        <a
                          href={`tel:${parcel.customerPhone}`}
                          className={`flex items-center gap-1.5 transition-colors font-medium ${isGirly ? 'hover:text-pink-600' : 'hover:text-indigo-600'}`}
                        >
                          <Phone className="w-3.5 h-3.5" />
                          {parcel.customerPhone}
                        </a>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          {parcel.customerCity}
                        </span>
                        {payment && (
                          <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border ${payment.bg} ${payment.color}`}>
                            {payment.label}
                          </span>
                        )}
                        {isStale && (
                          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-100">
                            <AlertTriangle className="w-3 h-3" />
                            En cours depuis {age} j
                          </span>
                        )}
                        {parcel.packageContent && (
                          <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold ${isGirly ? 'text-pink-600 bg-pink-50' : 'text-indigo-600 bg-indigo-50'}`}>
                            📦 {parcel.packageContent}
                          </span>
                        )}
                        {parcel.packageNoOpen && (
                          <span className="flex items-center gap-1.5 text-red-600 bg-red-50 px-2 py-0.5 rounded-md text-[11px] font-bold">
                            🚫 Ne pas ouvrir
                          </span>
                        )}
                        {(parcel.vendorName || parcel.vendorEmail) && (
                          <span className="flex items-center gap-1.5 text-purple-700 bg-purple-50 px-2 py-1 rounded-md text-[11px] font-bold border border-purple-100">
                            <User className="w-3 h-3" />
                            {parcel.vendorName || parcel.vendorEmail}
                          </span>
                        )}
                        {parcel.notes && (
                          <span
                            className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md text-[11px] font-bold border border-amber-100 max-w-[250px] truncate"
                            title={parcel.notes}
                          >
                            📝 {parcel.notes}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Center: Coliaty code */}
                    <div className="flex-shrink-0">
                      {parcel.coliatyPackageCode ? (
                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl px-4 py-3">
                          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Code Coliaty</p>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-indigo-700 text-sm tracking-wide">{parcel.coliatyPackageCode}</span>
                            <button
                              onClick={() => handleCopy(parcel.coliatyPackageCode!, 'Code copié !', parcel.coliatyPackageCode!)}
                              className="p-1 rounded-lg hover:bg-indigo-100 transition-colors text-indigo-400 hover:text-indigo-600"
                              title="Copier le code"
                            >
                              {copiedCode === parcel.coliatyPackageCode ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDownloadLabel(parcel.coliatyPackageCode!)}
                              disabled={downloadingCode === parcel.coliatyPackageCode}
                              className="p-1 rounded-lg hover:bg-indigo-100 transition-colors text-indigo-400 hover:text-indigo-600 disabled:opacity-50"
                              title="Télécharger l'étiquette"
                            >
                              <Printer className={`w-3.5 h-3.5 ${downloadingCode === parcel.coliatyPackageCode ? 'animate-pulse' : ''}`} />
                            </button>
                          </div>
                          {parcel.coliatyPickupRef && (
                            <p className="text-[9px] text-indigo-300 mt-0.5">Bon : {parcel.coliatyPickupRef}</p>
                          )}
                        </div>
                      ) : (
                        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Code Coliaty</p>
                          <p className="text-sm font-medium text-gray-400 italic">Non synchronisé</p>
                        </div>
                      )}
                    </div>

                    {/* Right: amount + status */}
                    <div className="flex sm:flex-col items-center sm:items-end gap-3">
                      <span className="text-xl font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl whitespace-nowrap">
                        {Math.round(Number(parcel.totalAmountMad) || 0)} MAD
                      </span>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${status.bg} ${status.color}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {status.label}
                      </span>
                    </div>
                  </div>

                  {/* Last recorded status change, with the reason the operator gave */}
                  {parcel.lastStatusNote && (
                    <div className="mt-3 flex items-start gap-2 bg-amber-50/50 border border-amber-100 rounded-xl px-3 py-2">
                      <span className="text-xs mt-0.5">💬</span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-amber-900 leading-relaxed">{parcel.lastStatusNote}</p>
                        <p className="text-[10px] text-amber-600/80 font-medium mt-0.5">
                          {parcel.lastStatusBy || 'Système'} · {fmtDate(parcel.lastStatusAt)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-gray-50">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-gray-400" title={fmtDate(parcel.createdAt)}>
                        {fmtDate(parcel.createdAt, 'dd MMM yyyy')}
                        {age !== null && <span className="text-gray-300"> · {fmtAge(age)}</span>}
                      </span>
                      <span className="inline-block px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded-lg border border-purple-100">
                        💳 {parcel.paymentMethod || 'COD'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {parcel.items.length} article{parcel.items.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {parcel.coliatyPackageCode && (
                        <>
                          <button
                            onClick={() => handleOpenEdit(parcel, 'relance')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-xs font-bold hover:bg-orange-100 hover:text-orange-700 transition-colors border border-orange-200 shadow-sm"
                            title="Créer une demande de relance / changement de destination"
                          >
                            🔄 Relance
                          </button>

                          {parcel.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleOpenEdit(parcel, 'edit')}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 hover:text-blue-700 transition-colors border border-blue-200 shadow-sm"
                                title="Éditer directement ce colis (nouveaux colis uniquement)"
                              >
                                ✏️ Éditer
                              </button>
                              <button
                                onClick={() => setCancelTarget(parcel)}
                                disabled={revertingId === parcel.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 hover:text-red-700 transition-colors border border-red-200 shadow-sm disabled:opacity-50"
                              >
                                {revertingId === parcel.id ? '⏳ Annulation...' : '❌ Annuler'}
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => handleOpenHistory(parcel)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors border border-indigo-100"
                            title="Voir l'historique du colis"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            Historique
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => setExpandedId(isExpanded ? null : parcel.id)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-indigo-600 transition-colors px-2"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        {isExpanded ? 'Masquer' : 'Détails'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50/50 p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                        <h5 className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2">Adresse de livraison</h5>
                        <p className="text-sm font-semibold text-gray-800 leading-relaxed">{parcel.customerAddress || '—'}</p>
                        <p className="text-xs text-gray-500 mt-1">{parcel.customerCity}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <button
                            onClick={() => handleCopy(`${parcel.customerAddress}, ${parcel.customerCity}`, 'Adresse copiée !')}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-[11px] font-bold hover:bg-gray-200 transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                            Copier
                          </button>
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                        <h5 className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2">Contacter le client</h5>
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={`tel:${parcel.customerPhone}`}
                            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500 text-white rounded-lg text-xs font-bold hover:bg-indigo-600 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            Appeler
                          </a>
                          <a
                            href={`https://wa.me/${waNumber(parcel.customerPhone)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-2 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 transition-colors"
                          >
                            💬 WhatsApp
                          </a>
                        </div>
                        <dl className="mt-3 space-y-1 text-[11px]">
                          <div className="flex justify-between gap-2">
                            <dt className="text-gray-400 font-medium">Lead</dt>
                            <dd className="text-gray-700 font-bold truncate">{parcel.leadFullName}</dd>
                          </div>
                          {parcel.coliatyPackageId && (
                            <div className="flex justify-between gap-2">
                              <dt className="text-gray-400 font-medium">ID Coliaty</dt>
                              <dd className="text-gray-700 font-bold">#{parcel.coliatyPackageId}</dd>
                            </div>
                          )}
                          {parcel.updatedAt && (
                            <div className="flex justify-between gap-2">
                              <dt className="text-gray-400 font-medium">Dernière MAJ</dt>
                              <dd className="text-gray-700 font-bold">{fmtDate(parcel.updatedAt, 'dd/MM/yyyy HH:mm')}</dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    </div>

                    {parcel.notes && (
                      <div className="bg-amber-50/40 border border-amber-100/70 rounded-2xl p-4 shadow-sm">
                        <h5 className="text-[11px] font-black text-amber-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                          <span>📝</span> Notes (internes &amp; livraison Coliaty)
                        </h5>
                        <p className="text-xs font-semibold text-amber-900 leading-relaxed whitespace-pre-wrap">{parcel.notes}</p>
                      </div>
                    )}

                    <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                      <Box className="w-4 h-4 text-gray-400" />
                      Produits commandés
                    </h4>
                    {parcel.items.map(item => (
                      <div key={item.id} className="flex items-center gap-4 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                        {item.productImage ? (
                          <img
                            src={item.productImage}
                            alt={item.productName}
                            loading="lazy"
                            className="w-14 h-14 rounded-lg object-cover border border-gray-100 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center flex-shrink-0">
                            <Package className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-gray-900 truncate text-sm">{item.productName || 'Produit'}</p>
                            {item.productSku && (
                              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[9px] font-bold rounded border border-gray-200">
                                {item.productSku}
                              </span>
                            )}
                            {parcel.productVariant && (
                              <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase rounded border border-indigo-100">
                                {parcel.productVariant}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Qté : <strong className="text-gray-700">{item.quantity}</strong>
                            {' · '}
                            Prix : <strong className="text-gray-700">{Math.round(Number(item.unitPriceMad) || 0)} MAD</strong>
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-black text-gray-900 text-sm">{Math.round(Number(item.totalPriceMad) || 0)} MAD</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className={`flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl border shadow-sm p-4 ${cardBorder}`}>
          <p className="text-xs font-bold text-gray-500">
            Page {page} sur {totalPages} · {totalResults} colis
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Précédent
            </button>

            {/* A sliding window of 5 page buttons around the current page */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              return start + i;
            })
              .filter(n => n >= 1 && n <= totalPages)
              .map(n => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-9 h-9 rounded-xl text-xs font-black transition-all ${
                    n === page ? 'bg-slate-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {n}
                </button>
              ))}

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Suivant
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Cancel confirmation */}
      {cancelTarget && (
        <Modal onClose={() => setCancelTarget(null)} widthClass="max-w-md">
          <div className="bg-white rounded-2xl p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-gray-900 mb-2">Annuler ce colis Coliaty ?</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Le colis <strong className="text-gray-800">{cancelTarget.coliatyPackageCode}</strong> de{' '}
              <strong className="text-gray-800">{cancelTarget.customerName}</strong> sera annulé chez Coliaty et le lead
              redeviendra modifiable. Cette action est irréversible.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setCancelTarget(null)}
                className="flex-1 px-4 py-2.5 text-gray-600 bg-gray-100 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors"
              >
                Garder le colis
              </button>
              <button
                onClick={() => handleRevertToLead(cancelTarget)}
                disabled={revertingId === cancelTarget.id}
                className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl font-bold text-sm hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                {revertingId === cancelTarget.id ? '⏳ Annulation...' : 'Oui, annuler'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit / relance modal */}
      {editingParcel && (
        <Modal onClose={() => !editingSubmit && setEditingParcel(null)} widthClass="max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl relative overflow-hidden max-h-[88vh] flex flex-col">
            <div className={`absolute top-0 left-0 right-0 h-1 ${editMode === 'relance' ? 'bg-gradient-to-r from-orange-400 to-orange-600' : 'bg-gradient-to-r from-blue-400 to-blue-600'}`} />
            <div className="flex justify-between items-center p-6 pb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {editMode === 'relance' ? '🔄 Relancer le colis' : '✏️ Modifier le colis'}
                </h3>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                  {editingParcel.coliatyPackageCode} · #{editingParcel.orderNumber}
                </p>
              </div>
              <button
                onClick={() => setEditingParcel(null)}
                className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 px-6 pb-6 overflow-y-auto scrollbar-thin">
              <div className={`p-3 rounded-lg border ${editMode === 'relance' ? 'bg-orange-50 border-orange-100' : 'bg-blue-50 border-blue-100'}`}>
                <p className={`text-xs ${editMode === 'relance' ? 'text-orange-700' : 'text-blue-700'}`}>
                  {editMode === 'relance'
                    ? "Demander une relance ou modifier la destination d'un colis déjà en cours. Coliaty traite la demande manuellement."
                    : 'Modification directe des informations du colis (réservé aux colis en attente).'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du destinataire</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <input
                  type="tel"
                  required
                  value={editForm.phone}
                  onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prix à payer (MAD)</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={editForm.price}
                  onChange={e => setEditForm({ ...editForm, price: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {editMode === 'edit' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contenu du colis</label>
                    <input
                      type="text"
                      value={editForm.package_content}
                      onChange={e => setEditForm({ ...editForm, package_content: e.target.value })}
                      placeholder="Ex : Marchandise, Vêtements, etc."
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.package_no_open}
                      onChange={e => setEditForm({ ...editForm, package_no_open: e.target.checked })}
                      className="w-4 h-4 text-blue-500 rounded border-gray-300 focus:ring-blue-500"
                    />
                    Interdire l'ouverture du colis
                  </label>
                </>
              )}

              {editMode === 'relance' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Motif de la relance <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={editForm.note}
                    onChange={e => setEditForm({ ...editForm, note: e.target.value })}
                    placeholder="Ex : Le client demande une livraison après 18h, nouveau numéro à appeler..."
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none resize-none"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Ce message est transmis tel quel à l'équipe Coliaty.
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-gray-100">
                <h4 className="text-sm font-bold text-gray-800 mb-3">Destination</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                    {loadingCities ? (
                      <div className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 animate-pulse">
                        Chargement des villes...
                      </div>
                    ) : (
                      /* A city already out for delivery is the expensive one to get
                         wrong, so the hub is shown alongside each option and the map
                         confirms the destination before the change is applied. */
                      <CitySelect
                        deliverableOnly
                        showHub
                        value={editForm.city}
                        onChange={name => setEditForm({ ...editForm, city: name })}
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adresse complète</label>
                    <input
                      type="text"
                      required
                      value={editForm.address}
                      onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingParcel(null)}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={editingSubmit}
                  className={`flex-1 py-2 text-white rounded-xl font-bold transition-all shadow-md disabled:opacity-50 flex justify-center items-center gap-2 ${
                    editMode === 'relance' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {editingSubmit
                    ? '⏳ Enregistrement...'
                    : editMode === 'relance'
                    ? '📨 Envoyer la relance'
                    : '💾 Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* History modal */}
      {historyParcel && (
        <Modal onClose={() => setHistoryParcel(null)} widthClass="max-w-lg">
          <div className="bg-white rounded-3xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50/30">
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-500" />
                  Suivi du colis
                </h3>
                <p className="text-xs text-gray-500 font-bold mt-1 uppercase tracking-wider">
                  CODE : {historyParcel.coliatyPackageCode || 'Non synchronisé'} · #{historyParcel.orderNumber}
                </p>
              </div>
              <button
                onClick={() => setHistoryParcel(null)}
                className="text-gray-400 hover:text-gray-600 bg-white shadow-sm p-2 rounded-full transition-all hover:rotate-90"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-1 p-2 bg-gray-50 border-b border-gray-100">
              <button
                onClick={() => setHistoryTab('internal')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
                  historyTab === 'internal' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-white'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Historique interne ({internalTimeline.length})
              </button>
              <button
                onClick={() => setHistoryTab('coliaty')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
                  historyTab === 'coliaty' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-white'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                Suivi Coliaty ({parcelHistory.length})
              </button>
            </div>

            <div className={`flex-1 overflow-y-auto p-6 scrollbar-thin ${historyTab === 'internal' ? '' : 'hidden'}`}>
              {loadingTimeline ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="w-10 h-10 border-4 border-slate-100 border-t-slate-500 rounded-full animate-spin" />
                  <p className="text-gray-400 text-sm font-medium">Chargement de l'historique interne...</p>
                </div>
              ) : internalTimeline.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 font-medium italic">Aucun changement de statut interne enregistré.</p>
                </div>
              ) : (
                <div className="relative pl-6 border-l-2 border-slate-100 space-y-6 py-2 ml-2">
                  {internalTimeline.map((entry, idx) => (
                    <div key={entry.id} className="relative">
                      <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm ${idx === 0 ? 'bg-slate-900 scale-125' : 'bg-slate-300'}`} />
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                            entry.scope === 'ORDER' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {entry.scope === 'ORDER' ? 'Commande' : 'Lead'}
                          </span>
                          <span className="text-[10px] font-bold text-gray-400">{fmtDate(entry.createdAt)}</span>
                        </div>

                        <div className="bg-gray-50 rounded-2xl p-4 mt-1 border border-white shadow-sm">
                          <div className="flex items-center gap-2 flex-wrap">
                            {entry.oldStatus && (
                              <>
                                <span className="text-[11px] font-medium text-gray-400 line-through">
                                  {statusConfig[entry.oldStatus]?.label || entry.oldStatus}
                                </span>
                                <span className="text-gray-300">➔</span>
                              </>
                            )}
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider border ${
                              statusConfig[entry.newStatus]?.bg || 'bg-gray-100 border-gray-200'
                            } ${statusConfig[entry.newStatus]?.color || 'text-gray-700'}`}>
                              {statusConfig[entry.newStatus]?.label || entry.newStatus}
                            </span>
                          </div>
                          {entry.changedBy && (
                            <p className="text-[10px] font-bold text-indigo-600 mt-2 uppercase tracking-wider">Par : {entry.changedBy}</p>
                          )}
                          {entry.notes && (
                            <p className="text-sm font-bold text-gray-700 leading-relaxed italic mt-2 bg-amber-50/60 border border-amber-100 rounded-xl p-3">
                              "{entry.notes}"
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={`flex-1 overflow-y-auto p-6 scrollbar-thin ${historyTab === 'coliaty' ? '' : 'hidden'}`}>
              {!historyParcel.coliatyPackageCode ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 font-medium italic">Ce colis n'a pas encore de code Coliaty.</p>
                </div>
              ) : loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
                  <p className="text-gray-400 text-sm font-medium">Récupération de l'historique...</p>
                </div>
              ) : parcelHistory.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 font-medium italic">Aucun historique disponible pour ce colis.</p>
                </div>
              ) : (
                <div className="relative pl-6 border-l-2 border-indigo-50 space-y-8 py-2 ml-2">
                  {parcelHistory.map((entry, idx) => (
                    <div key={entry.id} className="relative">
                      <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm ${idx === 0 ? 'bg-indigo-500 scale-125' : 'bg-indigo-200'}`} />

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-[11px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-md ${
                            idx === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {historyStatusLabels[entry.HISTORY_STATUS] || entry.HISTORY_STATUS}
                          </span>
                          <span className="text-[10px] font-bold text-gray-400">
                            {fmtDate(entry.HISTORY_TIMESTAMP * 1000)}
                          </span>
                        </div>

                        <div className="bg-gray-50 rounded-2xl p-4 mt-2 border border-white shadow-sm">
                          {entry.HISTORY_COMMENT ? (
                            <p className="text-sm font-bold text-gray-700 leading-relaxed italic">"{entry.HISTORY_COMMENT}"</p>
                          ) : (
                            <p className="text-xs text-gray-400 italic">Aucun commentaire</p>
                          )}

                          {entry.HISTORY_LIVREUR && !Array.isArray(entry.HISTORY_LIVREUR) && entry.HISTORY_LIVREUR.name && (
                            <div className="mt-3 pt-3 border-t border-gray-200/50 flex items-center justify-between">
                              <p className="text-[10px] font-bold text-gray-500 flex items-center gap-1.5 uppercase tracking-wider">
                                👤 {entry.HISTORY_LIVREUR.name}
                              </p>
                              {entry.HISTORY_LIVREUR.phone && (
                                <a
                                  href={`tel:${entry.HISTORY_LIVREUR.phone}`}
                                  className="text-[10px] font-black text-indigo-600 hover:underline flex items-center gap-1"
                                >
                                  <Phone size={10} /> {entry.HISTORY_LIVREUR.phone}
                                </a>
                              )}
                            </div>
                          )}

                          <div className="mt-3 pt-3 border-t border-gray-200/50 flex flex-wrap items-center gap-4">
                            {entry.HISTORY_SITUATION && (
                              <p className="text-[10px] font-black text-indigo-500 flex items-center gap-1.5 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-md">
                                Situation :{' '}
                                {entry.HISTORY_SITUATION === 'NOT_PAID'
                                  ? 'Non payé'
                                  : entry.HISTORY_SITUATION === 'PAID'
                                  ? 'Payé'
                                  : entry.HISTORY_SITUATION}
                              </p>
                            )}

                            {entry.HISTORY_STATUS_DATE && (
                              <p className="text-[10px] font-bold text-gray-400 flex items-center gap-1.5 uppercase tracking-wider" title="Date d'effet sur le terrain">
                                <Clock size={10} /> Date : {fmtDate(parseInt(entry.HISTORY_STATUS_DATE) * 1000, 'dd/MM/yyyy HH:mm')}
                              </p>
                            )}

                            {entry.HISTORY_PROOF && typeof entry.HISTORY_PROOF === 'string' && (
                              <a
                                href={entry.HISTORY_PROOF}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] font-bold text-emerald-500 flex items-center gap-1.5 uppercase tracking-wider bg-emerald-50 px-2 py-1 rounded-md hover:bg-emerald-100 transition-colors"
                              >
                                📸 Preuve disponible
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center gap-3">
              {historyParcel.coliatyPackageCode && (
                <button
                  onClick={() => handleDownloadLabel(historyParcel.coliatyPackageCode!)}
                  disabled={downloadingCode === historyParcel.coliatyPackageCode}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-black rounded-xl text-xs hover:bg-gray-100 transition-all disabled:opacity-50"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Étiquette
                </button>
              )}
              <button
                onClick={() => setHistoryParcel(null)}
                className="ml-auto px-6 py-2.5 bg-slate-900 text-white font-black rounded-xl text-xs hover:bg-slate-800 transition-all active:scale-95 shadow-sm"
              >
                FERMER
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

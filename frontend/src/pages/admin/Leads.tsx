import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { leadsApi, productsApi } from '../../lib/api';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import {
  Users, Search, Download,
  ChevronLeft, ChevronRight,
  Phone, MapPin, Calendar, Tag, Headphones,
  Trash2, CheckCircle2, CheckSquare, Clock, Box, AlertCircle, Truck,
  ChevronDown, ChevronUp, Package, X, Eye, RefreshCw,
  SlidersHorizontal, Wallet, TrendingUp, MessageCircle, Link2,
  FileSpreadsheet, PhoneCall, StickyNote, Home, Hash,
  Store, Megaphone, MonitorPlay, Globe, Wifi, PlayCircle, ExternalLink,
} from 'lucide-react';
import { buildReferralUrl } from '../../utils/referral';
import { fetchAllPages } from '../../utils/paging';
import {
  PAYMENT_SITUATION_OPTIONS,
  paymentSituationLabel,
  paymentSituationMeta,
  normalizePaymentSituation,
} from '../../lib/paymentSituation';
import { fetchAllProducts } from '../../lib/apiPaging';

const STATUS_BADGES: Record<string, { label: string; color: string; icon: any }> = {
  NEW: { label: 'Nouveau', color: 'bg-slate-50 text-slate-600 border-slate-200', icon: Clock },
  LEAD: { label: 'Lead', color: 'bg-slate-50 text-slate-600 border-slate-200', icon: Clock },
  AVAILABLE: { label: 'Disponible', color: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: CheckCircle2 },
  ASSIGNED: { label: 'Au Call Center', icon: Headphones, color: 'bg-cyan-50 text-cyan-600 border-cyan-200' },
  CONTACTED: { label: 'Contacté', icon: Phone, color: 'bg-amber-50 text-amber-600 border-amber-200' },
  INTERESTED: { label: 'Intéressé', icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  CONFIRMED: { label: 'Confirmé', icon: CheckCircle2, color: 'bg-blue-50 text-blue-600 border-blue-200' },
  ORDERED: { label: 'Commandé', icon: Tag, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CALLBACK_REQUESTED: { label: 'Rappel demandé', icon: Clock, color: 'bg-orange-50 text-orange-600 border-orange-200' },
  NOT_INTERESTED: { label: 'Pas intéressé', icon: AlertCircle, color: 'bg-rose-50 text-rose-600 border-rose-200' },
  UNREACHABLE: { label: 'Injoignable', icon: AlertCircle, color: 'bg-slate-100 text-slate-500 border-slate-200' },
  INVALID: { label: 'Invalide', icon: AlertCircle, color: 'bg-rose-50 text-rose-600 border-rose-200' },
  PUSHED_TO_DELIVERY: { label: 'En livraison', icon: Truck, color: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  DELIVERED: { label: 'Livré', icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  RETURNED: { label: 'Retourné', icon: Box, color: 'bg-orange-50 text-orange-600 border-orange-200' },
  CANCELLED: { label: 'Annulé', icon: AlertCircle, color: 'bg-rose-50 text-rose-600 border-rose-200' },
};

// Canonical chip order; anything else present in the data is appended automatically
const STATUS_ORDER = [
  'NEW', 'LEAD', 'AVAILABLE', 'ASSIGNED', 'CONTACTED', 'CALLBACK_REQUESTED',
  'INTERESTED', 'CONFIRMED', 'ORDERED', 'PUSHED_TO_DELIVERY', 'DELIVERED',
  'RETURNED', 'NOT_INTERESTED', 'UNREACHABLE', 'INVALID', 'CANCELLED',
];

// A lead the call center has never seen — the only kind worth handing over
const CALL_CENTER_READY_STATUSES = ['NEW', 'LEAD'];

// Groups used by the KPI cards
const IN_PROGRESS_STATUSES = ['ASSIGNED', 'CONTACTED', 'CALLBACK_REQUESTED'];
const CONFIRMED_STATUSES = ['INTERESTED', 'CONFIRMED', 'ORDERED'];
const SHIPPING_STATUSES = [
  'PUSHED_TO_DELIVERY', 'SHIPPED', 'PENDING', 'NEW_PARCEL', 'WAITING_PICKUP', 'WAITING_PREPARATION',
  'PREPARED', 'ENCORE_PREPARED', 'PICKED_UP', 'SENT', 'RECEIVED', 'DISTRIBUTION',
  'PROGRAMMER', 'PROGRAMMER_AUTO', 'POSTPONED',
];

const DETAILED_STATUS_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  NEW: { label: 'Nouveau', icon: '🆕', color: 'bg-blue-50 text-blue-600' },
  LEAD: { label: 'Lead', icon: '🆕', color: 'bg-slate-50 text-slate-600' },
  AVAILABLE: { label: 'Disponible', icon: '🟢', color: 'bg-emerald-50 text-emerald-600' },
  ASSIGNED: { label: 'Assigné', icon: '👤', color: 'bg-purple-50 text-purple-600' },
  CONTACTED: { label: 'Contacté', icon: '📞', color: 'bg-blue-50 text-blue-600' },
  INTERESTED: { label: 'Intéressé', icon: '✅', color: 'bg-emerald-50 text-emerald-600' },
  CONFIRMED: { label: 'Confirmé', icon: '✅', color: 'bg-blue-50 text-blue-600' },
  ORDERED: { label: 'Commandé', icon: '🛒', color: 'bg-emerald-50 text-emerald-600' },
  CALLBACK_REQUESTED: { label: 'Rappel', icon: '🔁', color: 'bg-orange-50 text-orange-600' },
  NOT_INTERESTED: { label: 'Pas intéressé', icon: '❌', color: 'bg-rose-50 text-rose-600' },
  UNREACHABLE: { label: 'Injoignable', icon: '📵', color: 'bg-slate-50 text-slate-600' },
  INVALID: { label: 'Invalide', icon: '🚫', color: 'bg-rose-50 text-rose-600' },
  PUSHED_TO_DELIVERY: { label: 'En livraison', icon: '🚚', color: 'bg-indigo-50 text-indigo-600' },
  'NEW_PARCEL': { label: 'Nouveau Colis', icon: '📦', color: 'bg-slate-50 text-slate-600' },
  'WAITING_PICKUP': { label: 'Attente Collecte', icon: '⏳', color: 'bg-amber-50 text-amber-600' },
  'WAITING_PREPARATION': { label: 'Attente Préparation', icon: '⏳', color: 'bg-orange-50 text-orange-600' },
  'PREPARED': { label: 'Préparé', icon: '📦', color: 'bg-emerald-50 text-emerald-600' },
  'ENCORE_PREPARED': { label: 'En préparation', icon: '🔄', color: 'bg-blue-50 text-blue-600' },
  'PICKED_UP': { label: 'Collecté', icon: '🚚', color: 'bg-blue-50 text-blue-600' },
  'SENT': { label: 'Expédié', icon: '✈️', color: 'bg-violet-50 text-violet-600' },
  'RECEIVED': { label: 'Reçu (Dest.)', icon: '📍', color: 'bg-indigo-50 text-indigo-600' },
  'DISTRIBUTION': { label: 'En livraison', icon: '🛵', color: 'bg-cyan-50 text-cyan-600' },
  'PROGRAMMER_AUTO': { label: 'Livraison Auto', icon: '🤖', color: 'bg-purple-50 text-purple-600' },
  'POSTPONED': { label: 'Reporté', icon: '📅', color: 'bg-orange-50 text-orange-600' },
  'NOANSWER': { label: 'Pas de réponse', icon: '📵', color: 'bg-rose-50 text-rose-600' },
  'ERR': { label: 'Tél Erroné', icon: '⚠️', color: 'bg-rose-50 text-rose-600' },
  'PROGRAMMER': { label: 'Programmé', icon: '📅', color: 'bg-blue-50 text-blue-600' },
  'INCORRECT_ADDRESS': { label: 'Adresse Erronée', icon: '📍', color: 'bg-rose-50 text-rose-600' },
  'DELIVERED': { label: 'Livré', icon: '🎉', color: 'bg-emerald-50 text-emerald-600' },
  'RETURNED': { label: 'Retourné', icon: '↩️', color: 'bg-orange-50 text-orange-600' },
  'CANCELED_BY_SELLER': { label: 'Annulé (Vendeur)', icon: '❌', color: 'bg-rose-50 text-rose-600' },
  'CANCELED_BY_SYSTEM': { label: 'Annulé (Système)', icon: '🤖', color: 'bg-rose-50 text-rose-600' },
  'CANCELED': { label: 'Annulé (Livreur)', icon: '❌', color: 'bg-rose-50 text-rose-600' },
  'REFUSE': { label: 'Refusé', icon: '✋', color: 'bg-rose-50 text-rose-600' },
  'PENDING': { label: 'En attente', icon: '⏳', color: 'bg-amber-50 text-amber-600' },
  'SHIPPED': { label: 'Expédié', icon: '🚚', color: 'bg-indigo-50 text-indigo-600' },
  'CANCELLED': { label: 'Annulé', icon: '❌', color: 'bg-rose-50 text-rose-600' },
};

const COLIATY_STATUS_LABELS: Record<string, string> = {
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
  'INCORRECT_ADDRESS': 'Adresse erronée'
};

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  MANUAL: { label: 'Manuel', color: 'bg-slate-50 text-slate-600 border-slate-200' },
  WHATSAPP: { label: 'WhatsApp', color: 'bg-green-50 text-green-600 border-green-200' },
  YOUCAN: { label: 'YouCan', color: 'bg-orange-50 text-orange-600 border-orange-200' },
  SHOPIFY: { label: 'Shopify', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  WOOCOMMERCE: { label: 'WooCommerce', color: 'bg-purple-50 text-purple-600 border-purple-200' },
  GOOGLE_SHEETS: { label: 'Google Sheets', color: 'bg-teal-50 text-teal-600 border-teal-200' },
  ABANDONED_CART: { label: 'Panier abandonné', color: 'bg-rose-50 text-rose-600 border-rose-200' },
  IMPORT: { label: 'Import', color: 'bg-blue-50 text-blue-600 border-blue-200' },
};

// Labels, colours and the filter list all come from lib/paymentSituation so the
// admin sees the same vocabulary as the agent — FACTURED-CC included.

interface Filters {
  search: string;
  status: string;
  vendorId: string;
  productId: string;
  agentId: string;
  city: string;
  source: string;
  sourceMode: string;
  paymentSituation: string;
  hasOrder: '' | 'yes' | 'no';
  dateFrom: string;
  dateTo: string;
  sort: string;
  limit: number;
}

const DEFAULT_FILTERS: Filters = {
  search: '', status: 'ALL', vendorId: '', productId: '', agentId: '', city: '',
  source: '', sourceMode: '', paymentSituation: '', hasOrder: '',
  dateFrom: '', dateTo: '', sort: 'recent', limit: 25,
};

const money = (n: any) => `${Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} MAD`;

function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  className = ""
}: {
  options: { id: string | number, label: string }[],
  value: string,
  onChange: (v: string) => void,
  placeholder: string,
  className?: string
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
  const selectedOption = options.find(o => String(o.id) === String(value));

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <div
        className={`px-3 py-2.5 bg-gray-50 border rounded-xl text-sm font-medium cursor-pointer flex justify-between items-center gap-2 transition-all hover:bg-gray-100/80 ${
          value ? 'border-primary-300 ring-1 ring-primary-100' : 'border-gray-200'
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`truncate ${value ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={16} className={`text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-white border border-gray-100 rounded-xl shadow-xl max-h-72 overflow-hidden flex flex-col ring-1 ring-black/5">
          <div className="p-2 border-b border-gray-50 bg-gray-50/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder:text-gray-400"
                placeholder="Rechercher..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onClick={e => e.stopPropagation()}
                autoFocus
              />
            </div>
          </div>
          <div className="overflow-y-auto p-1 custom-scrollbar">
            <div
              className={`px-3 py-2.5 text-sm cursor-pointer rounded-lg hover:bg-gray-50 transition-colors ${!value ? 'bg-primary-50 text-primary-700 font-bold' : 'text-gray-700'}`}
              onClick={() => { onChange(''); setIsOpen(false); setSearch(''); }}
            >
              {placeholder}
            </div>
            {filteredOptions.map(option => (
              <div
                key={option.id}
                className={`px-3 py-2.5 text-sm cursor-pointer rounded-lg hover:bg-gray-50 truncate transition-colors ${String(value) === String(option.id) ? 'bg-primary-50 text-primary-700 font-bold' : 'text-gray-700'}`}
                onClick={() => { onChange(String(option.id)); setIsOpen(false); setSearch(''); }}
              >
                {option.label}
              </div>
            ))}
            {filteredOptions.length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-400 text-center flex flex-col items-center gap-2">
                <Search className="w-5 h-5 text-gray-300" />
                Aucun résultat
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string | number; sub?: string; icon: any; accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md hover:border-gray-200 transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon className="w-4 h-4" strokeWidth={2.4} />
        </div>
        {sub && (
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider text-right leading-tight">
            {sub}
          </span>
        )}
      </div>
      <p className="text-2xl font-black text-gray-900 mt-3 tracking-tight tabular-nums">{value}</p>
      <p className="text-[11px] text-gray-500 font-bold mt-0.5 uppercase tracking-wider">{label}</p>
    </div>
  );
}

// Account role (VENDOR / INFLUENCER) + the mode that account is currently operating in
const ACCOUNT_TYPE_META: Record<string, { label: string; color: string; icon: any }> = {
  VENDOR: { label: 'Vendeur', color: 'bg-cyan-50 text-cyan-700 border-cyan-200', icon: Store },
  INFLUENCER: { label: 'Influenceur', color: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200', icon: Megaphone },
  SUPER_ADMIN: { label: 'Admin', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Users },
  HELPER: { label: 'Assistant', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Users },
  CALL_CENTER_AGENT: { label: 'Agent', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: Headphones },
};

const MODE_META: Record<string, { label: string; color: string }> = {
  SELLER: { label: 'Mode Vendeur', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  VENDOR: { label: 'Mode Vendeur', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  AFFILIATE: { label: 'Mode Affilié', color: 'bg-violet-50 text-violet-600 border-violet-200' },
};

function AccountTypeBadge({ accountType, accountMode, size = 'sm' }: {
  accountType?: string | null; accountMode?: string | null; size?: 'sm' | 'xs';
}) {
  if (!accountType && !accountMode) return null;
  const meta = accountType ? ACCOUNT_TYPE_META[accountType] : null;
  const TypeIcon = meta?.icon;
  const mode = accountMode ? MODE_META[accountMode] : null;
  const pad = size === 'xs' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]';

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {meta && (
        <span className={`inline-flex items-center gap-1 ${pad} font-black uppercase tracking-wider rounded border ${meta.color}`}>
          {TypeIcon && <TypeIcon className="w-2.5 h-2.5" />}
          {meta.label}
        </span>
      )}
      {!meta && accountType && (
        <span className={`inline-flex items-center ${pad} font-black uppercase tracking-wider rounded border bg-gray-50 text-gray-600 border-gray-200`}>
          {accountType}
        </span>
      )}
      {mode && (
        <span className={`inline-flex items-center ${pad} font-black uppercase tracking-wider rounded border ${mode.color}`}>
          {mode.label}
        </span>
      )}
    </span>
  );
}

// Clickable public referral URL, rebuilt from the link owner's subdomain / custom domain
function ReferralLinkChip({ link }: { link: any }) {
  if (!link?.code) return <span className="text-gray-400 font-medium">—</span>;
  const url = buildReferralUrl(link.code, link.ownerSubdomain, link.ownerCustomDomain, link.ownerCustomDomainStatus);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:text-primary-800 hover:underline break-all"
      title={url}
    >
      <Link2 className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="font-mono">{url.replace(/^https?:\/\//, '')}</span>
      <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-60" />
    </a>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 uppercase font-black tracking-wider">{label}</p>
      <div className="text-sm font-bold text-gray-700 mt-1 break-words">{children}</div>
    </div>
  );
}

export default function AdminLeads() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showStats, setShowStats] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  // Anchored to viewport coordinates and rendered through a portal, so the
  // table's horizontal scroll container cannot clip it.
  const [notePopover, setNotePopover] = useState<
    { id: number; text: string; top: number; left: number; placement: 'below' | 'above' } | null
  >(null);

  const openNotePopover = (e: React.MouseEvent<HTMLButtonElement>, leadId: number, text: string) => {
    if (notePopover?.id === leadId) {
      setNotePopover(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const WIDTH = 288;
    const ESTIMATED_HEIGHT = 160;
    const GAP = 6;

    // Right-align to the button, then clamp inside the viewport
    let left = rect.right - WIDTH;
    left = Math.min(Math.max(8, left), window.innerWidth - WIDTH - 8);

    const spaceBelow = window.innerHeight - rect.bottom;
    const placement: 'below' | 'above' = spaceBelow < ESTIMATED_HEIGHT ? 'above' : 'below';
    const top = placement === 'below' ? rect.bottom + GAP : rect.top - GAP;

    setNotePopover({ id: leadId, text, top, left, placement });
  };

  // Close on scroll / resize / Escape — the anchor position would otherwise go stale
  useEffect(() => {
    if (!notePopover) return;
    const close = () => setNotePopover(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [notePopover]);
  // Keyed by lead id and holding the row itself: a selection can span pages, and
  // the bulk actions need each lead's status / phone / tracking code after the
  // page it came from is gone.
  const [selected, setSelected] = useState<Map<number, any>>(new Map());
  const [exporting, setExporting] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  // Both the row button and the bulk bar open the same confirmation
  const [pushTargets, setPushTargets] = useState<any[] | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<any[] | null>(null);

  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [leadDetail, setLeadDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [coliatyHistory, setColiatyHistory] = useState<any[]>([]);
  const [loadingColiaty, setLoadingColiaty] = useState(false);
  const [leadSessions, setLeadSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<any | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search.trim()), 400);
    return () => clearTimeout(t);
  }, [filters.search]);

  // Any filter change resets to page 1
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters.status, filters.vendorId, filters.productId, filters.agentId,
      filters.city, filters.source, filters.sourceMode, filters.paymentSituation, filters.hasOrder,
      filters.dateFrom, filters.dateTo, filters.sort, filters.limit]);

  const queryParams = useMemo(() => {
    const p: any = {
      page,
      limit: filters.limit,
      viewMode: 'ALL',
      withStats: 'true',
      sort: filters.sort,
    };
    if (debouncedSearch) p.search = debouncedSearch;
    if (filters.status !== 'ALL') p.status = filters.status;
    if (filters.vendorId) p.vendorId = filters.vendorId;
    if (filters.productId) p.productId = filters.productId;
    if (filters.agentId) p.agentId = filters.agentId;
    if (filters.city) p.city = filters.city;
    if (filters.source) p.source = filters.source;
    if (filters.sourceMode) p.sourceMode = filters.sourceMode;
    if (filters.paymentSituation) p.paymentSituation = filters.paymentSituation;
    if (filters.hasOrder) p.hasOrder = filters.hasOrder;
    if (filters.dateFrom) p.dateFrom = filters.dateFrom;
    if (filters.dateTo) p.dateTo = filters.dateTo;
    return p;
  }, [page, filters, debouncedSearch]);

  const { data: leadsData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-all-leads', queryParams],
    queryFn: () => leadsApi.list(queryParams),
    placeholderData: keepPreviousData,
  });

  const { data: vendorsRes } = useQuery({
    queryKey: ['admin-vendors'],
    queryFn: () => leadsApi.getVendors(),
  });
  const vendors = vendorsRes?.data?.data || [];

  const { data: productsRes } = useQuery({
    queryKey: ['admin-all-products'],
    queryFn: () => fetchAllProducts(),
  });
  const products = productsRes || [];

  const leads = leadsData?.data?.data?.leads || [];
  const pagination = leadsData?.data?.data?.pagination || { totalPages: 1, total: 0, page: 1 };
  const stats = leadsData?.data?.data?.stats || {
    total: 0, byStatus: {}, ordersCount: 0, ordersRevenue: 0, deliveredCount: 0, deliveredRevenue: 0,
  };
  const filterOptions = leadsData?.data?.data?.filterOptions || { cities: [], sources: [], agents: [] };

  const byStatus: Record<string, number> = stats.byStatus || {};
  const sumOf = (keys: string[]) => keys.reduce((acc, k) => acc + (byStatus[k] || 0), 0);

  const inProgress = sumOf(IN_PROGRESS_STATUSES);
  const confirmed = sumOf(CONFIRMED_STATUSES);
  const shipping = sumOf(SHIPPING_STATUSES);
  const conversionRate = stats.total > 0 ? (stats.deliveredCount / stats.total) * 100 : 0;

  // Chips: canonical order first, then any extra status found in the data
  const statusChips = useMemo(() => {
    const present = Object.keys(byStatus).filter(s => byStatus[s] > 0);
    const ordered = STATUS_ORDER.filter(s => present.includes(s));
    const extras = present.filter(s => !STATUS_ORDER.includes(s)).sort();
    const list = [...ordered, ...extras];
    // Always keep the active filter visible even if its count dropped to 0
    if (filters.status !== 'ALL' && !list.includes(filters.status)) list.push(filters.status);
    return list;
  }, [byStatus, filters.status]);

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    const set = (patch: Partial<Filters>) => () => setFilters(f => ({ ...f, ...patch }));
    if (debouncedSearch) chips.push({ key: 'q', label: `Recherche : "${debouncedSearch}"`, clear: set({ search: '' }) });
    if (filters.status !== 'ALL') chips.push({ key: 'st', label: `Statut : ${STATUS_BADGES[filters.status]?.label || filters.status}`, clear: set({ status: 'ALL' }) });
    if (filters.vendorId) {
      const v = vendors.find((x: any) => String(x.id) === filters.vendorId);
      chips.push({ key: 'v', label: `Compte : ${v?.fullName || filters.vendorId}`, clear: set({ vendorId: '' }) });
    }
    if (filters.productId) {
      const p = products.find((x: any) => String(x.id) === filters.productId);
      chips.push({ key: 'p', label: `Produit : ${p?.nameFr || p?.nameAr || filters.productId}`, clear: set({ productId: '' }) });
    }
    if (filters.agentId) {
      const a = filterOptions.agents.find((x: any) => String(x.id) === filters.agentId);
      chips.push({ key: 'a', label: `Agent : ${a?.name || filters.agentId}`, clear: set({ agentId: '' }) });
    }
    if (filters.city) chips.push({ key: 'c', label: `Ville : ${filters.city}`, clear: set({ city: '' }) });
    if (filters.source) chips.push({ key: 's', label: `Source : ${SOURCE_LABELS[filters.source]?.label || filters.source}`, clear: set({ source: '' }) });
    if (filters.sourceMode) chips.push({ key: 'sm', label: `Canal : ${filters.sourceMode}`, clear: set({ sourceMode: '' }) });
    if (filters.paymentSituation) chips.push({ key: 'ps', label: `Paiement : ${paymentSituationLabel(filters.paymentSituation)}`, clear: set({ paymentSituation: '' }) });
    if (filters.hasOrder) chips.push({ key: 'ho', label: filters.hasOrder === 'yes' ? 'Avec commande' : 'Sans commande', clear: set({ hasOrder: '' }) });
    if (filters.dateFrom) chips.push({ key: 'df', label: `Du ${filters.dateFrom}`, clear: set({ dateFrom: '' }) });
    if (filters.dateTo) chips.push({ key: 'dt', label: `Au ${filters.dateTo}`, clear: set({ dateTo: '' }) });
    return chips;
  }, [filters, debouncedSearch, vendors, products, filterOptions]);

  const confirmDelete = async () => {
    if (!leadToDelete) return;
    try {
      await leadsApi.delete(String(leadToDelete.id));
      toast.success('Lead supprimé avec succès');
      setSelected(prev => {
        if (!prev.has(leadToDelete.id)) return prev;
        const next = new Map(prev);
        next.delete(leadToDelete.id);
        return next;
      });
      setLeadToDelete(null);
      refetch();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const loadHistory = async (leadId: number, coliatyPackageCode: string | null) => {
    setSelectedLeadId(leadId);
    setLoadingDetail(true);
    setColiatyHistory([]);
    setLeadSessions([]);
    try {
      const res = await leadsApi.detail(leadId);
      const d = res.data?.data || res.data;
      setLeadDetail(d);

      const code = coliatyPackageCode || d?.lead?.order?.coliatyPackageCode || null;
      if (code) {
        setLoadingColiaty(true);
        leadsApi.getParcelHistory(code).then(hRes => {
          setColiatyHistory(hRes.data?.data?.details || []);
        }).catch(() => {}).finally(() => setLoadingColiaty(false));
      }

      // Streaming Direct & Replay — browsing sessions tied to this lead
      setLoadingSessions(true);
      leadsApi.sessions(leadId).then(sRes => {
        setLeadSessions(sRes.data?.data?.sessions || []);
      }).catch(() => {}).finally(() => setLoadingSessions(false));
    } catch {
      setLeadDetail(null);
      toast.error('Erreur lors du chargement des détails du lead');
    } finally {
      setLoadingDetail(false);
    }
  };

  const getDetailedStatusBadge = (status: string) => {
    const s = DETAILED_STATUS_LABELS[status] || { label: status, icon: '', color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-bold ${s.color}`}>
        {s.icon} {s.label}
      </span>
    );
  };

  // --- CSV export of the current filter set (not just the visible page) ---
  const exportCsv = async (onlySelected = false) => {
    setExporting(true);
    try {
      let rows: any[];
      if (onlySelected) {
        rows = Array.from(selected.values());
      } else {
        // One request capped at 1000 used to be the whole export, which meant an
        // unfiltered export of a five-figure lead list handed over a thousand rows
        // and a toast. Walk the pages instead, so the file is the filter set.
        const res = await fetchAllPages<any>(async (page, limit) => {
          const r = await leadsApi.list({ ...queryParams, page, limit, withStats: 'false' } as any);
          return { rows: r.data?.data?.leads || [], total: r.data?.data?.pagination?.total || 0 };
        });
        rows = res.rows;
        if (!res.complete) {
          toast(`Export limité aux ${rows.length} premiers leads sur ${res.total}.`, { icon: '⚠️' });
        }
      }

      if (rows.length === 0) {
        toast.error('Aucun lead à exporter');
        return;
      }

      const columns: { key: string; label: string; get: (l: any) => any }[] = [
        { key: 'id', label: 'ID', get: l => l.id },
        { key: 'fullName', label: 'Client', get: l => l.fullName },
        { key: 'phone', label: 'Téléphone', get: l => l.phone },
        { key: 'whatsapp', label: 'WhatsApp', get: l => l.whatsapp || '' },
        { key: 'city', label: 'Ville', get: l => l.city || '' },
        { key: 'address', label: 'Adresse', get: l => l.address || '' },
        { key: 'status', label: 'Statut', get: l => STATUS_BADGES[l.status]?.label || l.status },
        { key: 'product', label: 'Produit', get: l => l.product?.name || '' },
        { key: 'sku', label: 'SKU', get: l => l.product?.sku || '' },
        { key: 'variant', label: 'Variante', get: l => l.productVariant || '' },
        { key: 'price', label: 'Prix (MAD)', get: l => l.productPrice ?? '' },
        { key: 'orderNumber', label: 'N° Commande', get: l => l.order?.orderNumber || '' },
        { key: 'orderStatus', label: 'Statut Commande', get: l => l.order?.status || '' },
        { key: 'orderTotal', label: 'Total Commande (MAD)', get: l => l.order?.totalAmountMad ?? '' },
        { key: 'tracking', label: 'Code Coliaty', get: l => l.coliatyPackageCode || '' },
        { key: 'payment', label: 'Situation Paiement', get: l => (l.paymentSituation ? paymentSituationLabel(l.paymentSituation) : '') },
        { key: 'agent', label: 'Agent', get: l => l.assignedAgent?.fullName || '' },
        { key: 'vendor', label: 'Propriétaire', get: l => l.vendor?.fullName || '' },
        { key: 'source', label: 'Source', get: l => l.source || '' },
        { key: 'sourceMode', label: 'Canal', get: l => l.sourceMode || '' },
        { key: 'calls', label: 'Appels', get: l => l.recentCalls ?? 0 },
        { key: 'callbackAt', label: 'Rappel prévu', get: l => l.callbackAt ? format(new Date(l.callbackAt), 'dd/MM/yyyy HH:mm') : '' },
        { key: 'notes', label: 'Notes', get: l => l.notes || '' },
        { key: 'createdAt', label: 'Créé le', get: l => format(new Date(l.createdAt), 'dd/MM/yyyy HH:mm') },
      ];

      const escape = (v: any) => {
        const s = v === null || v === undefined ? '' : String(v);
        return `"${s.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
      };

      const csv = [
        columns.map(c => escape(c.label)).join(';'),
        ...rows.map(l => columns.map(c => escape(c.get(l))).join(';')),
      ].join('\r\n');

      // BOM so Excel opens UTF-8 accents correctly
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${rows.length} lead${rows.length > 1 ? 's' : ''} exporté${rows.length > 1 ? 's' : ''}`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erreur lors de l\'export');
    } finally {
      setExporting(false);
    }
  };

  const allPageSelected = leads.length > 0 && leads.every((l: any) => selected.has(l.id));

  const toggleAllOnPage = () => {
    setSelected(prev => {
      const next = new Map(prev);
      if (allPageSelected) leads.forEach((l: any) => next.delete(l.id));
      else leads.forEach((l: any) => next.set(l.id, l));
      return next;
    });
  };

  const toggleOne = (lead: any) => {
    setSelected(prev => {
      const next = new Map(prev);
      if (next.has(lead.id)) next.delete(lead.id);
      else next.set(lead.id, lead);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Map());

  const selectedList = useMemo(() => Array.from(selected.values()), [selected]);

  // Only a lead that has not left the vendor's hands yet can be handed over
  const pushableLeads = useMemo(
    () => selectedList.filter(l => CALL_CENTER_READY_STATUSES.includes(l.status)),
    [selectedList]
  );

  // Already at Coliaty — the backend skips these, so warn before firing
  const undeletableCount = useMemo(
    () => (deleteTargets ?? selectedList).filter(l => l.coliatyPackageCode).length,
    [deleteTargets, selectedList]
  );

  // Same guards the backend applies, run first so the user gets the offending
  // number instead of a generic 400.
  const openPushModal = (targets: any[]) => {
    if (targets.length === 0) return;

    const seen = new Map<string, any>();
    for (const l of targets) {
      const key = String(l.phone || '').replace(/\D/g, '');
      if (!key) continue;
      if (seen.has(key)) {
        toast.error(`Doublon : le numéro ${l.phone} apparaît deux fois dans la sélection`);
        return;
      }
      seen.set(key, l);
    }

    // Best-effort duplicate check against what is loaded on this page
    const targetIds = new Set(targets.map(l => l.id));
    const alreadyActive = leads.find((l: any) =>
      !targetIds.has(l.id) &&
      ['AVAILABLE', 'ASSIGNED'].includes(l.status) &&
      seen.has(String(l.phone || '').replace(/\D/g, ''))
    );
    if (alreadyActive) {
      toast.error(`Le numéro ${alreadyActive.phone} est déjà actif au Call Center (Lead #${alreadyActive.id})`);
      return;
    }

    setPushTargets(targets);
  };

  const confirmPush = async () => {
    if (!pushTargets || pushTargets.length === 0) return;
    const ids = pushTargets.map(l => l.id);
    setBulkBusy(true);
    try {
      await leadsApi.bulkUpdateStatus({ ids, status: 'AVAILABLE' });
      toast.success(`${ids.length} lead${ids.length > 1 ? 's envoyés' : ' envoyé'} au Call Center`);
      setPushTargets(null);
      setSelected(prev => {
        const next = new Map(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
      refetch();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erreur lors de l\'envoi au Call Center');
    } finally {
      setBulkBusy(false);
    }
  };

  const confirmBulkDelete = async () => {
    if (!deleteTargets || deleteTargets.length === 0) return;
    const ids = deleteTargets.map(l => l.id);
    setBulkBusy(true);
    try {
      const res = await leadsApi.bulkDelete(ids);
      const { deleted = 0, skipped = 0 } = res.data?.data || {};
      toast.success(`${deleted} lead${deleted > 1 ? 's supprimés' : ' supprimé'}`);
      if (skipped > 0) {
        toast(`${skipped} lead${skipped > 1 ? 's ignorés' : ' ignoré'} : déjà en livraison.`, { icon: '⚠️' });
      }
      setDeleteTargets(null);
      setSelected(prev => {
        const next = new Map(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
      refetch();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erreur lors de la suppression groupée');
    } finally {
      setBulkBusy(false);
    }
  };

  // Page buttons around the current page, clamped to real bounds
  const pageButtons = useMemo(() => {
    const total = pagination.totalPages || 1;
    const span = Math.min(5, total);
    let start = Math.max(1, page - Math.floor(span / 2));
    if (start + span - 1 > total) start = total - span + 1;
    return Array.from({ length: span }, (_, i) => start + i);
  }, [page, pagination.totalPages]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-200/50">
              <Users className="w-5 h-5 text-white" />
            </div>
            Tous les Leads
          </h1>
          <p className="text-sm text-gray-500 mt-1 ml-[52px]">
            Vue globale de tous les prospects de la plateforme
            {isFetching && <span className="ml-2 text-primary-500 font-semibold">· actualisation…</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all shadow-sm disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <button
            onClick={() => setShowStats(!showStats)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all shadow-sm"
          >
            {showStats ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Statistiques
          </button>
          <button
            onClick={() => exportCsv(false)}
            disabled={exporting}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-sm disabled:opacity-60"
          >
            <Download className={`w-3.5 h-3.5 ${exporting ? 'animate-pulse' : ''}`} />
            {exporting ? 'Export…' : 'Exporter CSV'}
          </button>
        </div>
      </div>

      {/* KPI cards — real aggregates over the active filter set */}
      {showStats && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <StatCard
            label="Total leads" value={stats.total.toLocaleString('fr-FR')}
            icon={Users} accent="bg-blue-50 text-blue-600"
          />
          <StatCard
            label="En traitement" value={inProgress.toLocaleString('fr-FR')}
            sub="Call center" icon={Headphones} accent="bg-amber-50 text-amber-600"
          />
          <StatCard
            label="Confirmés" value={confirmed.toLocaleString('fr-FR')}
            icon={CheckCircle2} accent="bg-emerald-50 text-emerald-600"
          />
          <StatCard
            label="En livraison" value={shipping.toLocaleString('fr-FR')}
            sub={`${stats.ordersCount} cmd`} icon={Truck} accent="bg-indigo-50 text-indigo-600"
          />
          <StatCard
            label="Livrés" value={stats.deliveredCount.toLocaleString('fr-FR')}
            sub={`${conversionRate.toFixed(1)}% conv.`} icon={TrendingUp} accent="bg-teal-50 text-teal-600"
          />
          <StatCard
            label="CA livré" value={money(stats.deliveredRevenue)}
            sub={`${money(stats.ordersRevenue)} total`} icon={Wallet} accent="bg-violet-50 text-violet-600"
          />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, téléphone, WhatsApp, ville, adresse, n° commande, code Coliaty…"
              className="w-full pl-10 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all font-medium text-sm"
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
            />
            {filters.search && (
              <button
                onClick={() => setFilters(f => ({ ...f, search: '' }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <SearchableSelect
              className="w-full sm:w-[190px]"
              placeholder="Tous les comptes"
              value={filters.vendorId}
              onChange={(val) => setFilters(f => ({ ...f, vendorId: val }))}
              options={vendors.map((v: any) => ({
                id: v.id,
                label: v.profile?.fullName || v.fullName || v.email
              }))}
            />
            <SearchableSelect
              className="w-full sm:w-[190px]"
              placeholder="Tous les produits"
              value={filters.productId}
              onChange={(val) => setFilters(f => ({ ...f, productId: val }))}
              options={products.map((p: any) => ({
                id: p.id,
                label: p.nameFr || p.nameAr || p.name
              }))}
            />
            <select
              value={filters.sort}
              onChange={e => setFilters(f => ({ ...f, sort: e.target.value }))}
              className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-primary-500/30 cursor-pointer"
            >
              <option value="recent">Plus récents</option>
              <option value="oldest">Plus anciens</option>
              <option value="updated">Récemment modifiés</option>
              <option value="name">Client (A-Z)</option>
              <option value="city">Ville (A-Z)</option>
              <option value="amount_desc">Montant ↓</option>
              <option value="amount_asc">Montant ↑</option>
            </select>
            <button
              onClick={() => setShowFilters(s => !s)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                showFilters || activeChips.length > 0
                  ? 'bg-primary-600 text-white border-primary-600 shadow-md shadow-primary-100'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filtres
              {activeChips.length > 0 && (
                <span className="px-1.5 py-0.5 bg-white/25 rounded-md text-[10px] font-black">{activeChips.length}</span>
              )}
            </button>
          </div>
        </div>

        {/* Advanced filters */}
        {showFilters && (
          <div className="border-t border-gray-100 pt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Agent</label>
              <SearchableSelect
                className="mt-1"
                placeholder="Tous les agents"
                value={filters.agentId}
                onChange={val => setFilters(f => ({ ...f, agentId: val }))}
                options={filterOptions.agents.map((a: any) => ({ id: a.id, label: a.name }))}
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Ville</label>
              <SearchableSelect
                className="mt-1"
                placeholder="Toutes les villes"
                value={filters.city}
                onChange={val => setFilters(f => ({ ...f, city: val }))}
                options={filterOptions.cities.map((c: string) => ({ id: c, label: c }))}
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Source</label>
              <select
                value={filters.source}
                onChange={e => setFilters(f => ({ ...f, source: e.target.value }))}
                className="mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/30 cursor-pointer"
              >
                <option value="">Toutes les sources</option>
                {filterOptions.sources.map((s: string) => (
                  <option key={s} value={s}>{SOURCE_LABELS[s]?.label || s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Canal</label>
              <select
                value={filters.sourceMode}
                onChange={e => setFilters(f => ({ ...f, sourceMode: e.target.value }))}
                className="mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/30 cursor-pointer"
              >
                <option value="">Tous les canaux</option>
                <option value="VENDOR">Vendeur</option>
                <option value="AFFILIATE">Affilié</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Situation paiement</label>
              <select
                value={filters.paymentSituation}
                onChange={e => setFilters(f => ({ ...f, paymentSituation: e.target.value }))}
                className="mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/30 cursor-pointer"
              >
                <option value="">Toutes</option>
                {PAYMENT_SITUATION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value} title={opt.hint}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Commande</label>
              <select
                value={filters.hasOrder}
                onChange={e => setFilters(f => ({ ...f, hasOrder: e.target.value as Filters['hasOrder'] }))}
                className="mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/30 cursor-pointer"
              >
                <option value="">Tous</option>
                <option value="yes">Avec commande</option>
                <option value="no">Sans commande</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Période</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                  className="w-full px-2.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary-500/30"
                />
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                  className="w-full px-2.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary-500/30"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Leads par page</label>
              <select
                value={filters.limit}
                onChange={e => setFilters(f => ({ ...f, limit: Number(e.target.value) }))}
                className="mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-500/30 cursor-pointer"
              >
                {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Status chips with live counts */}
        <div className="flex flex-wrap gap-1.5 border-t border-gray-100 pt-3">
          <button
            onClick={() => setFilters(f => ({ ...f, status: 'ALL' }))}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
              filters.status === 'ALL'
                ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Tout ({stats.total.toLocaleString('fr-FR')})
          </button>
          {statusChips.map(status => {
            const badge = STATUS_BADGES[status] || { label: status, color: 'bg-gray-50 text-gray-600 border-gray-200', icon: Clock };
            const IconComp = badge.icon;
            const isActive = filters.status === status;
            return (
              <button
                key={status}
                onClick={() => setFilters(f => ({ ...f, status }))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                  isActive
                    ? `${badge.color} border-current shadow-md ring-1 ring-current/20`
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <IconComp className="w-3 h-3" />
                {badge.label}
                <span className={isActive ? 'opacity-70' : 'text-gray-400'}>({byStatus[status] || 0})</span>
              </button>
            );
          })}
        </div>

        {/* Active filters + selection actions */}
        {(activeChips.length > 0 || selected.size > 0) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
            {activeChips.map(chip => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary-50 text-primary-700 border border-primary-100 rounded-lg text-[11px] font-bold"
              >
                {chip.label}
                <button onClick={chip.clear} className="hover:text-primary-900"><X className="w-3 h-3" /></button>
              </span>
            ))}
            {selected.size > 0 && (
              <span className="inline-flex items-center gap-2 px-2.5 py-1 bg-slate-900 text-white rounded-lg text-[11px] font-bold">
                {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
                <button onClick={clearSelection} title="Effacer la sélection"><X className="w-3 h-3" /></button>
              </span>
            )}
            {activeChips.length > 0 && (
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="ml-auto px-3 py-1 text-[11px] font-black text-rose-600 hover:bg-rose-50 rounded-lg transition-colors uppercase tracking-wider"
              >
                Réinitialiser
              </button>
            )}
          </div>
        )}
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[1180px]">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100">
                <th className="pl-4 pr-2 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleAllOnPage}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                  />
                </th>
                {['Client', 'Produit', 'Montant', 'Statut', 'Équipe', 'Source', 'Activité', 'Date'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
                    {h}
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={10} className="px-5 py-4"><div className="h-11 bg-gray-100 rounded-lg w-full" /></td>
                  </tr>
                ))
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-16 text-center">
                    <Package className="w-12 h-12 mx-auto text-gray-200 mb-3" />
                    <p className="text-gray-500 font-bold">Aucun lead trouvé</p>
                    {activeChips.length > 0 && (
                      <button
                        onClick={() => setFilters(DEFAULT_FILTERS)}
                        className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-slate-800"
                      >
                        Réinitialiser les filtres
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                leads.map((lead: any) => {
                  const statusInfo = STATUS_BADGES[lead.status] || { label: lead.status, color: 'bg-gray-50 text-gray-600 border-gray-200', icon: Clock };
                  const StatusIcon = statusInfo.icon;
                  const productImage = lead.product?.image;
                  const isExpanded = expandedRow === lead.id;
                  const orderStatus = lead.order?.status && lead.order.status !== lead.status
                    ? DETAILED_STATUS_LABELS[lead.order.status] : null;
                  const src = SOURCE_LABELS[lead.source] || { label: lead.source || '—', color: 'bg-gray-50 text-gray-600 border-gray-200' };
                  const isSelected = selected.has(lead.id);
                  const canPushToCallCenter = CALL_CENTER_READY_STATUSES.includes(lead.status);
                  const clicks = lead.contactClicks || { whatsapp: 0, call: 0, lastWhatsappAt: null, lastCallAt: null };

                  return (
                    <Fragment key={lead.id}>
                      <tr
                        className={`transition-colors group ${isSelected ? 'bg-primary-50/40' : 'hover:bg-gray-50/60'}`}
                      >
                        <td className="pl-4 pr-2 py-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOne(lead)}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                          />
                        </td>

                        {/* Client */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900 leading-tight">{lead.fullName}</span>
                            <div className="flex items-center gap-2.5 mt-1 text-[10px] text-gray-500 font-semibold">
                              <a href={`tel:${lead.phone}`} className="flex items-center gap-1 hover:text-primary-600 transition-colors">
                                <Phone className="w-2.5 h-2.5" /> {lead.phone}
                              </a>
                              {lead.whatsapp && (
                                <a
                                  href={`https://wa.me/${String(lead.whatsapp).replace(/[^0-9]/g, '').replace(/^0/, '212')}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-green-600 hover:text-green-700"
                                  title={`WhatsApp : ${lead.whatsapp}`}
                                >
                                  <MessageCircle className="w-2.5 h-2.5" />
                                </a>
                              )}
                              <span className="flex items-center gap-1 text-gray-400">
                                <MapPin className="w-2.5 h-2.5" /> {lead.city || '—'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Produit */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            {productImage ? (
                              <img src={productImage} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <Package className="w-4 h-4 text-gray-400" />
                              </div>
                            )}
                            <div className="flex flex-col min-w-0 max-w-[180px]">
                              <span className="text-xs font-bold text-gray-900 truncate">{lead.product?.name || '—'}</span>
                              <div className="flex items-center gap-1 mt-0.5">
                                {lead.product?.sku && (
                                  <span className="text-[9px] font-bold text-gray-400 truncate">{lead.product.sku}</span>
                                )}
                                {lead.productVariant && (
                                  <span className="text-[9px] font-black text-primary-600 uppercase bg-primary-50 px-1.5 py-0.5 rounded truncate">
                                    {lead.productVariant}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Montant */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-gray-900 tracking-tight tabular-nums">
                              {lead.productPrice > 0 ? money(lead.productPrice) : '—'}
                            </span>
                            {lead.product?.price && Math.abs(lead.productPrice - lead.product.price) > 0.01 && (
                              <span className="text-[10px] text-gray-400 line-through font-medium tabular-nums">
                                {money(lead.product.price)}
                              </span>
                            )}
                            {lead.requestedPriceMad && lead.requestedPriceStatus === 'PENDING' && (
                              <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded mt-0.5 w-fit uppercase">
                                Demande {money(lead.requestedPriceMad)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Statut */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${statusInfo.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {statusInfo.label}
                            </span>
                            {orderStatus && (
                              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${orderStatus.color}`}>
                                {orderStatus.icon} {orderStatus.label}
                              </span>
                            )}
                            {lead.coliatyPackageCode && (
                              <span className="flex items-center gap-1 text-[9px] font-bold text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                <Box className="w-2.5 h-2.5" />
                                {lead.coliatyPackageCode}
                              </span>
                            )}
                            {lead.paymentSituation && normalizePaymentSituation(lead.paymentSituation) !== 'NOT_PAID' && (
                              <span
                                title={paymentSituationMeta(lead.paymentSituation).hint}
                                className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${paymentSituationMeta(lead.paymentSituation).badge}`}
                              >
                                {paymentSituationLabel(lead.paymentSituation)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Équipe (call center + propriétaire du produit) */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-2 min-w-[150px]">
                            {/* Call center agent */}
                            <div className="flex items-center gap-1.5" title="Agent call center">
                              <span className="w-5 h-5 bg-purple-100 rounded-md flex items-center justify-center flex-shrink-0" title="Call center">
                                <Headphones className="w-3 h-3 text-purple-600" />
                              </span>
                              {lead.assignedAgent ? (
                                <span className="text-[11px] font-bold text-gray-700 truncate max-w-[110px]">
                                  {lead.assignedAgent.fullName}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-gray-300 uppercase italic">Non assigné</span>
                              )}
                            </div>

                            {/* Product / lead owner */}
                            {lead.vendor && (
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5" title="Propriétaire du produit">
                                  <span className="w-5 h-5 bg-cyan-100 rounded-md flex items-center justify-center flex-shrink-0">
                                    <Store className="w-3 h-3 text-cyan-600" />
                                  </span>
                                  <span className="text-[11px] font-bold text-gray-600 truncate max-w-[110px]">
                                    {lead.vendor.fullName}
                                  </span>
                                </div>
                                <div className="pl-[26px]">
                                  <AccountTypeBadge
                                    accountType={lead.vendor.accountType}
                                    accountMode={lead.vendor.accountMode}
                                    size="xs"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Source */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${src.color}`}>
                              {src.label}
                            </span>
                            {lead.sourceMode && (
                              <span className="text-[9px] font-bold text-gray-400 uppercase">
                                {lead.sourceMode === 'AFFILIATE' ? 'Affilié' : 'Vendeur'}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Activité */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-1 text-[10px] font-semibold min-w-[120px]">
                            {/* WhatsApp click tracking */}
                            {clicks.whatsapp > 0 ? (
                              <span
                                className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 w-fit font-black"
                                title={clicks.lastWhatsappAt
                                  ? `Dernier clic : ${format(new Date(clicks.lastWhatsappAt), "dd/MM/yyyy 'à' HH:mm")}`
                                  : undefined}
                              >
                                <MessageCircle className="w-2.5 h-2.5" />
                                WhatsApp (Cliqué) ×{clicks.whatsapp}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-gray-300">
                                <MessageCircle className="w-2.5 h-2.5" />
                                WhatsApp
                              </span>
                            )}

                            {/* Call click tracking */}
                            {clicks.call > 0 ? (
                              <span
                                className="flex items-center gap-1 text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5 w-fit font-black"
                                title={clicks.lastCallAt
                                  ? `Dernier clic : ${format(new Date(clicks.lastCallAt), "dd/MM/yyyy 'à' HH:mm")}`
                                  : undefined}
                              >
                                <PhoneCall className="w-2.5 h-2.5" />
                                Appel (Cliqué) ×{clicks.call}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-gray-300">
                                <PhoneCall className="w-2.5 h-2.5" />
                                Appel
                              </span>
                            )}

                            {/* Logged calls (call center) */}
                            {lead.recentCalls > 0 && (
                              <span className="flex items-center gap-1 text-gray-600">
                                <Headphones className="w-2.5 h-2.5" />
                                {lead.recentCalls} journal{lead.recentCalls > 1 ? 'ux' : ''}
                              </span>
                            )}

                            {lead.callbackAt && (
                              <span className="flex items-center gap-1 text-orange-600" title="Rappel programmé">
                                <Clock className="w-2.5 h-2.5" />
                                {format(new Date(lead.callbackAt), 'dd/MM HH:mm')}
                              </span>
                            )}

                            {/* Note → opens a portalled popover (the table scroll
                                container would otherwise clip an absolute one) */}
                            {lead.notes && (
                              <button
                                onClick={e => openNotePopover(e, lead.id, lead.notes)}
                                className={`flex items-center gap-1 rounded px-1.5 py-0.5 border transition-all w-fit ${
                                  notePopover?.id === lead.id
                                    ? 'bg-amber-500 text-white border-amber-500'
                                    : 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
                                }`}
                              >
                                <StickyNote className="w-2.5 h-2.5" />
                                Note
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col text-[10px] text-gray-500 font-semibold">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-2.5 h-2.5" />
                              {format(new Date(lead.createdAt), 'dd MMM yyyy', { locale: fr })}
                            </span>
                            <span className="flex items-center gap-1 mt-0.5 text-gray-400">
                              <Clock className="w-2.5 h-2.5" />
                              {format(new Date(lead.createdAt), 'HH:mm')}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canPushToCallCenter && (
                              <button
                                onClick={() => openPushModal([lead])}
                                className="p-1.5 text-cyan-500 hover:text-white hover:bg-cyan-500 rounded-lg transition-all"
                                title="Envoyer au Call Center"
                              >
                                <Headphones className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => setExpandedRow(isExpanded ? null : lead.id)}
                              className={`p-1.5 rounded-lg transition-all ${isExpanded ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
                              title={isExpanded ? 'Masquer' : 'Aperçu rapide'}
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => loadHistory(lead.id, lead.coliatyPackageCode)}
                              className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                              title="Historique & détails complets"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setLeadToDelete(lead)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded quick view */}
                      {isExpanded && (
                        <tr className="bg-gray-50/60">
                          <td colSpan={10} className="px-6 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                              <Field label="Adresse">
                                <span className="flex items-start gap-1.5 font-medium text-gray-600">
                                  <Home className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                                  {lead.address || '—'}
                                </span>
                              </Field>
                              <Field label="Commande">
                                {lead.order ? (
                                  <span className="flex items-center gap-1.5 font-mono text-xs">
                                    <Hash className="w-3.5 h-3.5 text-gray-400" />
                                    {lead.order.orderNumber} · {money(lead.order.totalAmountMad)}
                                  </span>
                                ) : <span className="text-gray-400 font-medium">Aucune commande</span>}
                              </Field>
                              <Field label="Lien de parrainage">
                                <div className="flex flex-col gap-1">
                                  <ReferralLinkChip link={lead.referralLink} />
                                  {lead.referralLink?.landingPageTitle && (
                                    <span className="text-[10px] text-gray-400 font-medium">
                                      {lead.referralLink.landingPageTitle}
                                    </span>
                                  )}
                                </div>
                              </Field>
                              <Field label="Propriétaire du lien">
                                {lead.linkOwner ? (
                                  <div className="flex flex-col gap-1">
                                    <span className="text-xs">{lead.linkOwner.fullName}</span>
                                    <AccountTypeBadge
                                      accountType={lead.linkOwner.accountType}
                                      accountMode={lead.linkOwner.accountMode}
                                      size="xs"
                                    />
                                  </div>
                                ) : <span className="text-gray-400 font-medium">—</span>}
                              </Field>
                              <Field label="Canal du lead">
                                <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded border ${
                                  MODE_META[lead.sourceMode]?.color || 'bg-gray-50 text-gray-600 border-gray-200'
                                }`}>
                                  {MODE_META[lead.sourceMode]?.label || lead.sourceMode || '—'}
                                </span>
                              </Field>
                              <Field label="Import">
                                {lead.importBatch?.fileName ? (
                                  <span className="flex items-center gap-1.5 text-xs">
                                    <FileSpreadsheet className="w-3.5 h-3.5 text-gray-400" />
                                    {lead.importBatch.fileName}
                                  </span>
                                ) : <span className="text-gray-400 font-medium">—</span>}
                              </Field>
                              <Field label="Dernier appel">
                                {lead.lastCall
                                  ? format(new Date(lead.lastCall), "dd MMM yyyy 'à' HH:mm", { locale: fr })
                                  : <span className="text-gray-400 font-medium">Jamais</span>}
                              </Field>
                              <Field label="Dernière modification">
                                {lead.updatedAt
                                  ? format(new Date(lead.updatedAt), "dd MMM yyyy 'à' HH:mm", { locale: fr })
                                  : '—'}
                              </Field>
                              <Field label="Dernier changement de statut">
                                {lead.lastStatusChange ? (
                                  <span className="text-xs">
                                    {DETAILED_STATUS_LABELS[lead.lastStatusChange.oldStatus]?.label || lead.lastStatusChange.oldStatus || '—'}
                                    {' → '}
                                    <strong>{DETAILED_STATUS_LABELS[lead.lastStatusChange.newStatus]?.label || lead.lastStatusChange.newStatus}</strong>
                                  </span>
                                ) : <span className="text-gray-400 font-medium">—</span>}
                              </Field>
                              <Field label="Notes">
                                {lead.notes
                                  ? <span className="text-xs font-medium text-gray-600 italic">"{lead.notes}"</span>
                                  : <span className="text-gray-400 font-medium">—</span>}
                              </Field>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-5 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/40">
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
            {leads.length > 0
              ? `${(pagination.page - 1) * filters.limit + 1}–${(pagination.page - 1) * filters.limit + leads.length} sur ${pagination.total.toLocaleString('fr-FR')} leads`
              : '0 lead'}
          </p>
          {pagination.totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 disabled:opacity-30 hover:bg-gray-50 transition-all shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {pageButtons.map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all shadow-sm ${
                    page === pageNum
                      ? 'bg-primary-500 text-white shadow-primary-200'
                      : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 disabled:opacity-30 hover:bg-gray-50 transition-all shadow-sm"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Note popover — portalled above everything, positioned from the button rect */}
      {notePopover && createPortal(
        <>
          <div className="fixed inset-0 z-[999998]" onClick={() => setNotePopover(null)} />
          <div
            className="fixed z-[999999] w-72 bg-white border border-amber-200 rounded-xl shadow-2xl p-3 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150"
            style={{
              top: notePopover.top,
              left: notePopover.left,
              transform: notePopover.placement === 'above' ? 'translateY(-100%)' : undefined,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[9px] font-black text-amber-600 uppercase tracking-wider flex items-center gap-1">
                <StickyNote className="w-3 h-3" />
                Note du lead
              </p>
              <button onClick={() => setNotePopover(null)} className="text-gray-300 hover:text-gray-600">
                <X className="w-3 h-3" />
              </button>
            </div>
            <p className="text-[11px] font-medium text-gray-700 leading-relaxed whitespace-pre-wrap normal-case max-h-60 overflow-y-auto">
              {notePopover.text}
            </p>
          </div>
        </>,
        document.body
      )}

      {/* Lead Details Modal */}
      {selectedLeadId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-50 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Header */}
            <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Détails du Lead</h2>
                <p className="text-xs text-gray-500 mt-0.5">Historique complet et informations</p>
              </div>
              <button
                onClick={() => { setSelectedLeadId(null); setLeadDetail(null); }}
                className="p-2 bg-gray-50 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto">
              {loadingDetail ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-100 border-t-indigo-500 mb-4"></div>
                  <p className="text-gray-500 font-medium text-sm">Chargement des détails...</p>
                </div>
              ) : leadDetail ? (
                <div className="space-y-6">
                  {/* Lead Info Card */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4">
                      <h2 className="text-white font-bold flex items-center gap-2 text-lg">👤 {leadDetail.lead?.fullName}</h2>
                      <div className="flex items-center gap-4 text-white/80 text-xs mt-1 font-medium flex-wrap">
                        <span className="flex items-center gap-1"><Phone size={12} /> {leadDetail.lead?.phone}</span>
                        <span className="flex items-center gap-1"><MapPin size={12} /> {leadDetail.lead?.city || 'Ville non spécifiée'}</span>
                        {leadDetail.lead?.address && (
                          <span className="flex items-center gap-1"><Home size={12} /> {leadDetail.lead.address}</span>
                        )}
                      </div>
                    </div>
                    <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <Field label="Statut actuel">{getDetailedStatusBadge(leadDetail.lead?.status)}</Field>
                      <Field label="Agent (call center)">
                        <span className="flex items-center gap-1.5">
                          <Headphones className="w-3.5 h-3.5 text-purple-500" />
                          {leadDetail.lead?.assignedAgent?.profile?.fullName || 'Non assigné'}
                        </span>
                      </Field>
                      <Field label="Influenceur / Affilié">
                        {leadDetail.influencer ? (
                          <div className="flex flex-col gap-1">
                            <span>{leadDetail.influencer.fullName}</span>
                            <AccountTypeBadge
                              accountType={leadDetail.influencer.accountType}
                              accountMode={leadDetail.influencer.accountMode}
                              size="xs"
                            />
                          </div>
                        ) : '—'}
                      </Field>
                      <Field label="Créé le">
                        {leadDetail.lead?.createdAt ? format(new Date(leadDetail.lead.createdAt), 'dd MMM yyyy HH:mm', { locale: fr }) : '—'}
                      </Field>
                    </div>

                    {/* Order / delivery summary — tracking code lives here */}
                    <div className="px-5 pb-5 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-gray-50 pt-4">
                      <Field label="Propriétaire du produit">
                        {leadDetail.vendor ? (
                          <span className="flex items-center gap-1.5">
                            <Store className="w-3.5 h-3.5 text-cyan-500" />
                            {leadDetail.vendor.fullName}
                          </span>
                        ) : '—'}
                      </Field>
                      <Field label="Canal du lead">
                        <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded border ${
                          MODE_META[leadDetail.lead?.sourceMode]?.color || 'bg-gray-50 text-gray-600 border-gray-200'
                        }`}>
                          {MODE_META[leadDetail.lead?.sourceMode]?.label || leadDetail.lead?.sourceMode || '—'}
                        </span>
                      </Field>
                      <Field label="Commande">
                        {leadDetail.lead?.order ? (
                          <span className="font-mono text-xs">
                            {leadDetail.lead.order.orderNumber} · {money(leadDetail.lead.order.totalAmountMad)}
                          </span>
                        ) : <span className="text-gray-400">Aucune commande</span>}
                      </Field>
                      <Field label="Code Coliaty">
                        {leadDetail.lead?.order?.coliatyPackageCode ? (
                          <span className="inline-flex items-center gap-1.5 font-mono text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-lg">
                            <Box className="w-3.5 h-3.5" />
                            {leadDetail.lead.order.coliatyPackageCode}
                          </span>
                        ) : <span className="text-gray-400">Non expédié</span>}
                      </Field>
                    </div>

                    {leadDetail.lead?.referralLink?.code && (
                      <div className="px-5 pb-5 border-t border-gray-50 pt-4">
                        <Field label="Lien de parrainage (page publique)">
                          <ReferralLinkChip
                            link={{
                              code: leadDetail.lead.referralLink.code,
                              ownerSubdomain: leadDetail.influencer?.subdomain,
                              ownerCustomDomain: leadDetail.influencer?.customDomain,
                              ownerCustomDomainStatus: leadDetail.influencer?.customDomainStatus,
                            }}
                          />
                        </Field>
                      </div>
                    )}
                  </div>

                  {/* Streaming Direct & Replay — sessions behind this lead */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="font-bold text-gray-900 flex items-center gap-2">
                        <MonitorPlay className="w-5 h-5 text-rose-500" />
                        Streaming Direct &amp; Replay
                      </h2>
                      <span className="text-[10px] font-black text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                        {leadSessions.length} session{leadSessions.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    {loadingSessions ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-3">
                        <div className="w-8 h-8 border-3 border-rose-100 border-t-rose-500 rounded-full animate-spin" />
                        <p className="text-gray-400 text-sm font-medium">Recherche des sessions...</p>
                      </div>
                    ) : leadSessions.length === 0 ? (
                      <div className="bg-gray-50 rounded-xl p-8 text-center border border-dashed border-gray-200">
                        <MonitorPlay className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm font-medium">
                          Aucune session de navigation trouvée pour ce lead.
                        </p>
                        <p className="text-gray-400 text-xs mt-1">
                          Les sessions sont rattachées via le panier abandonné converti ou le numéro de téléphone
                          saisi sur la page <span className="font-mono">/r/&lt;code&gt;</span>.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {leadSessions.map((s: any) => (
                          <div key={s.attemptId} className="bg-gray-50 rounded-2xl border border-gray-100 p-4">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                                  s.matchedBy === 'CONVERTED'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-blue-50 text-blue-700 border-blue-200'
                                }`}>
                                  {s.matchedBy === 'CONVERTED' ? 'Panier converti' : 'Associé par téléphone'}
                                </span>
                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                                  s.completed
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {s.completed ? 'Commande finalisée' : 'Abandonné'}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-gray-400">
                                {format(new Date(s.createdAt), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                              <div>
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">IP</p>
                                <p className="text-xs font-mono font-bold text-gray-700 flex items-center gap-1 mt-0.5">
                                  <Wifi className="w-3 h-3 text-gray-400" /> {s.ip || '—'}
                                </p>
                              </div>
                              <div>
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Page</p>
                                <p className="text-xs font-mono font-bold text-gray-700 flex items-center gap-1 mt-0.5 truncate" title={s.path || ''}>
                                  <Globe className="w-3 h-3 text-gray-400 flex-shrink-0" /> {s.path || '—'}
                                </p>
                              </div>
                              <div>
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Durée</p>
                                <p className="text-xs font-bold text-gray-700 mt-0.5">
                                  {s.durationSec != null ? `${Math.floor(s.durationSec / 60)}m ${s.durationSec % 60}s` : '—'}
                                </p>
                              </div>
                              <div>
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Champs remplis</p>
                                <p className="text-xs font-bold text-gray-700 mt-0.5">{s.fieldsFilled ?? 0}</p>
                              </div>
                            </div>

                            {s.userAgent && (
                              <p className="text-[10px] text-gray-400 font-medium mt-2.5 truncate" title={s.userAgent}>
                                {s.userAgent}
                              </p>
                            )}

                            <div className="flex items-center gap-2 mt-3 flex-wrap">
                              {s.referralCode && (
                                <span className="text-[10px] font-mono font-bold text-primary-600 bg-primary-50 border border-primary-100 px-2 py-0.5 rounded">
                                  /r/{s.referralCode}
                                </span>
                              )}
                              {s.productName && (
                                <span className="text-[10px] font-bold text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded">
                                  {s.productName}
                                </span>
                              )}
                              {s.recordingId ? (
                                <a
                                  href={`/admin/live-stream?recording=${s.recordingId}`}
                                  className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-rose-700 transition-all"
                                >
                                  <PlayCircle className="w-3.5 h-3.5" />
                                  Voir le replay
                                </a>
                              ) : (
                                <span className="ml-auto text-[10px] font-bold text-gray-400 italic">
                                  Replay non enregistré
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Status History Timeline */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="font-bold text-gray-900 flex items-center gap-2">
                          🔄 Historique Interne
                        </h2>
                        <span className="text-xs font-black text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                          {(leadDetail.lead?.statusHistory || []).length} changements
                        </span>
                      </div>

                      {((leadDetail.lead?.statusHistory || []).length === 0) ? (
                        <div className="bg-gray-50 rounded-xl p-8 text-center border border-dashed border-gray-200">
                          <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-gray-500 text-sm font-medium">Aucun changement de statut interne enregistré.</p>
                        </div>
                      ) : (
                        <div className="space-y-4 pt-2 relative">
                          <div className="absolute left-1.5 top-2 bottom-4 w-px bg-gray-200"></div>
                          {(leadDetail.lead?.statusHistory || []).map((h: any, index: number) => {
                            const oldS = DETAILED_STATUS_LABELS[h.oldStatus] || { label: h.oldStatus, icon: '', color: 'bg-gray-100 text-gray-800' };
                            const newS = DETAILED_STATUS_LABELS[h.newStatus] || { label: h.newStatus, icon: '', color: 'bg-gray-100 text-gray-800' };

                            return (
                              <div key={h.id || index} className="flex gap-4 relative z-10">
                                <div className="flex flex-col items-center">
                                  <div className={`w-3 h-3 rounded-full mt-1.5 ring-4 ring-white ${
                                    h.newStatus === 'ORDERED' ? 'bg-emerald-500' :
                                    h.newStatus === 'AVAILABLE' ? 'bg-yellow-500' :
                                    h.newStatus === 'ASSIGNED' ? 'bg-amber-500' :
                                    ['NOT_INTERESTED', 'INVALID', 'CANCELED'].includes(h.newStatus) ? 'bg-red-500' :
                                    'bg-indigo-500'
                                  }`} />
                                </div>
                                <div className="flex-1 pb-4">
                                  <div className="flex flex-wrap justify-between items-start gap-2">
                                    <div className="flex items-center gap-2 flex-wrap bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                                      <span className="text-[11px] font-medium text-gray-400 line-through px-1">
                                        {oldS.icon} {oldS.label}
                                      </span>
                                      <span className="text-gray-300">➔</span>
                                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider ${newS.color}`}>
                                        {newS.icon} {newS.label}
                                      </span>
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
                                      {format(new Date(h.createdAt), 'dd MMM yyyy • HH:mm:ss', { locale: fr })}
                                    </span>
                                  </div>
                                  {h.changer && (
                                    <p className="text-[11px] text-purple-600 font-bold mt-2 flex items-center gap-1.5">
                                      <span className="w-4 h-4 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 text-[8px]">
                                        {h.changer.profile?.fullName?.charAt(0) || h.changer.email?.charAt(0) || '?'}
                                      </span>
                                      Par: {h.changer.profile?.fullName || h.changer.email}
                                    </p>
                                  )}
                                  {h.notes && (
                                    <p className="text-[13px] text-gray-600 mt-2.5 bg-yellow-50/50 p-3 rounded-xl border border-yellow-100 leading-relaxed">
                                      {h.notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Coliaty History Timeline */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="font-bold text-gray-900 flex items-center gap-2">
                          <Truck className="w-5 h-5 text-indigo-500" />
                          Suivi Coliaty
                        </h2>
                        {leadDetail.lead?.order?.coliatyPackageCode && (
                          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                            {leadDetail.lead.order.coliatyPackageCode}
                          </span>
                        )}
                      </div>

                      {!leadDetail.lead?.order?.coliatyPackageCode && (leadDetail.lead?.order?.statusHistory || []).length === 0 ? (
                        <div className="bg-gray-50 rounded-xl p-8 text-center border border-dashed border-gray-200">
                          <Box className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-gray-500 text-sm font-medium">Ce lead n'a pas encore été expédié via Coliaty.</p>
                        </div>
                      ) : loadingColiaty ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                          <div className="w-8 h-8 border-3 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
                          <p className="text-gray-400 text-sm font-medium">Récupération de l'historique Coliaty...</p>
                        </div>
                      ) : coliatyHistory.length === 0 && (leadDetail.lead?.order?.statusHistory || []).length === 0 ? (
                        <div className="text-center py-12">
                          <p className="text-gray-400 font-medium italic">Aucun historique disponible pour ce colis.</p>
                        </div>
                      ) : (
                        <div className="relative pl-6 border-l-2 border-indigo-50 space-y-8 py-2 ml-2">
                          {coliatyHistory.map((entry: any, idx: number) => (
                            <div key={`coliaty-${entry.id || idx}`} className="relative">
                              <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                                idx === 0 ? 'bg-indigo-500 scale-125' : 'bg-indigo-200'
                              }`} />

                              <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                  <span className={`text-[11px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-md ${
                                    idx === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
                                  }`}>
                                    {COLIATY_STATUS_LABELS[entry.HISTORY_STATUS] || entry.HISTORY_STATUS}
                                  </span>
                                  <span className="text-[10px] font-bold text-gray-400">
                                    {format(new Date(entry.HISTORY_TIMESTAMP * 1000), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                                  </span>
                                </div>

                                <div className="bg-gray-50 rounded-2xl p-4 mt-2 border border-white shadow-sm">
                                  {entry.HISTORY_COMMENT ? (
                                    <p className="text-sm font-bold text-gray-700 leading-relaxed italic">
                                      "{entry.HISTORY_COMMENT}"
                                    </p>
                                  ) : (
                                    <p className="text-xs text-gray-400 italic">Aucun commentaire</p>
                                  )}

                                  {entry.HISTORY_LIVREUR && !Array.isArray(entry.HISTORY_LIVREUR) && entry.HISTORY_LIVREUR.name && (
                                    <div className="mt-3 pt-3 border-t border-gray-200/50 flex items-center justify-between">
                                      <p className="text-[10px] font-bold text-gray-500 flex items-center gap-1.5 uppercase tracking-wider">
                                        👤 {entry.HISTORY_LIVREUR.name}
                                      </p>
                                      {entry.HISTORY_LIVREUR.phone && (
                                        <a href={`tel:${entry.HISTORY_LIVREUR.phone}`} className="text-indigo-600 hover:text-indigo-700">
                                          <Phone className="w-3.5 h-3.5" />
                                        </a>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}

                          {/* Order status changes (webhooks + manual, with their reason) */}
                          {(leadDetail.lead?.order?.statusHistory || []).map((h: any, idx: number) => {
                            const oldS = DETAILED_STATUS_LABELS[h.oldStatus] || { label: h.oldStatus, icon: '', color: 'bg-gray-100 text-gray-800' };
                            const newS = DETAILED_STATUS_LABELS[h.newStatus] || { label: h.newStatus, icon: '', color: 'bg-gray-100 text-gray-800' };
                            const automatic = h.notes?.includes('Mise à jour automatique') || !h.changedByUser;
                            return (
                              <div key={`order-${h.id || idx}`} className="relative">
                                <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                                  idx === 0 && coliatyHistory.length === 0 ? 'bg-indigo-500 scale-125' : 'bg-indigo-200'
                                }`} />

                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center justify-between">
                                    <span className={`text-[11px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-md ${
                                      automatic ? 'bg-gray-100 text-gray-500' : 'bg-indigo-100 text-indigo-700'
                                    }`}>
                                      {automatic ? 'Mise à jour automatique' : 'Changement manuel'}
                                    </span>
                                    <span className="text-[10px] font-bold text-gray-400">
                                      {format(new Date(h.createdAt), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                                    </span>
                                  </div>

                                  <div className="bg-gray-50 rounded-2xl p-4 mt-2 border border-white shadow-sm">
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                      {h.oldStatus && (
                                        <>
                                          <span className="text-[11px] font-medium text-gray-400 line-through">
                                            {oldS.icon} {oldS.label}
                                          </span>
                                          <span className="text-gray-300">➔</span>
                                        </>
                                      )}
                                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider ${newS.color}`}>
                                        {newS.icon} {newS.label}
                                      </span>
                                    </div>
                                    {h.changedByUser && (
                                      <p className="text-[11px] text-indigo-600 font-bold mb-2">
                                        Par : {h.changedByUser.profile?.fullName || h.changedByUser.email}
                                      </p>
                                    )}
                                    {h.notes && (
                                      <p className="text-sm font-bold text-gray-700 leading-relaxed italic">
                                        "{h.notes}"
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 text-gray-400 font-medium">
                  Impossible de charger les détails de ce lead.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {leadToDelete && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">
                Supprimer ce lead ?
              </h3>
              <p className="text-sm text-gray-500 font-medium">
                <strong className="text-gray-800">{leadToDelete.fullName}</strong>
                {leadToDelete.phone ? ` · ${leadToDelete.phone}` : ''}
                <br />
                Cette action est irréversible. Le lead et ses éventuelles données liées seront définitivement effacés.
              </p>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex gap-3">
              <button
                onClick={() => setLeadToDelete(null)}
                className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all shadow-sm"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-red-200 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk delete confirmation */}
      {deleteTargets && deleteTargets.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">
                Supprimer {deleteTargets.length} lead{deleteTargets.length > 1 ? 's' : ''} ?
              </h3>
              <p className="text-sm text-gray-500 font-medium">
                Cette action est irréversible. Les leads et leurs données liées (commandes non expédiées,
                historiques, journaux d'appels) seront définitivement effacés.
              </p>
              {undeletableCount > 0 && (
                <p className="mt-3 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  {undeletableCount} lead{undeletableCount > 1 ? 's' : ''} déjà en livraison
                  {undeletableCount > 1 ? ' seront ignorés' : ' sera ignoré'} — annulez la commande d'abord.
                </p>
              )}
            </div>
            <div className="bg-gray-50 px-6 py-4 flex gap-3">
              <button
                onClick={() => setDeleteTargets(null)}
                disabled={bulkBusy}
                className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all shadow-sm disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                onClick={confirmBulkDelete}
                disabled={bulkBusy}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-red-200 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" />
                {bulkBusy ? 'Suppression…' : `Supprimer (${deleteTargets.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send to call center confirmation (row button and bulk bar share it) */}
      {pushTargets && pushTargets.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-cyan-50 rounded-full flex items-center justify-center mb-4">
                <Headphones className="w-8 h-8 text-cyan-500" />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">
                {pushTargets.length === 1
                  ? 'Envoyer ce lead au Call Center ?'
                  : `Envoyer ${pushTargets.length} leads au Call Center ?`}
              </h3>
              {pushTargets.length === 1 ? (
                <p className="text-sm text-gray-500 font-medium">
                  <strong className="text-gray-800">{pushTargets[0].fullName}</strong>
                  {pushTargets[0].phone ? ` · ${pushTargets[0].phone}` : ''}
                  <br />
                  Il passera en « Disponible » et les agents pourront le réclamer immédiatement.
                </p>
              ) : (
                <p className="text-sm text-gray-500 font-medium">
                  Ces leads passeront en « Disponible » et les agents pourront les réclamer immédiatement.
                </p>
              )}
              <div className="mt-4 w-full max-h-40 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50 text-left">
                {pushTargets.slice(0, 20).map(l => (
                  <div key={l.id} className="px-3 py-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-gray-700 truncate">{l.fullName}</span>
                    <span className="text-[10px] font-semibold text-gray-400 whitespace-nowrap">{l.phone}</span>
                  </div>
                ))}
                {pushTargets.length > 20 && (
                  <div className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
                    + {pushTargets.length - 20} autre{pushTargets.length - 20 > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex gap-3">
              <button
                onClick={() => setPushTargets(null)}
                disabled={bulkBusy}
                className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all shadow-sm disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                onClick={confirmPush}
                disabled={bulkBusy}
                className="flex-1 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-cyan-200 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Headphones className="w-4 h-4" />
                {bulkBusy ? 'Envoi…' : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk action bar — floats above the table while a selection is live */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2 flex-wrap justify-center bg-slate-900 text-white rounded-2xl shadow-2xl shadow-slate-900/30 ring-1 ring-white/10 px-3 py-2.5 animate-in slide-in-from-bottom-4 duration-200">
            <span className="flex items-center gap-2 px-2 text-xs font-black uppercase tracking-wider">
              <CheckSquare className="w-4 h-4 text-primary-300" />
              {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
            </span>

            <span className="w-px h-6 bg-white/15" />

            {pushableLeads.length > 0 && (
              <button
                onClick={() => openPushModal(pushableLeads)}
                disabled={bulkBusy}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-60"
                title="Les leads Nouveau / Lead de la sélection passeront en Disponible"
              >
                <Headphones className="w-3.5 h-3.5" />
                Envoyer au Call Center ({pushableLeads.length})
              </button>
            )}

            <button
              onClick={() => exportCsv(true)}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-60"
            >
              <Download className={`w-3.5 h-3.5 ${exporting ? 'animate-pulse' : ''}`} />
              Exporter
            </button>

            <button
              onClick={() => setDeleteTargets(selectedList)}
              disabled={bulkBusy}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-60"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Supprimer ({selected.size})
            </button>

            <button
              onClick={clearSelection}
              className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              title="Effacer la sélection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

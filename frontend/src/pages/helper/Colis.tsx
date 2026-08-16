import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { leadsApi, ordersApi, getFileUrl } from '../../lib/api';
import {
  PAYMENT_SITUATION_OPTIONS,
  normalizePaymentSituation,
  paymentSituationLabel,
  paymentSituationMeta,
} from '../../lib/paymentSituation';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
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
  FileText,
  ShieldAlert,
  Box,
  QrCode,
  SlidersHorizontal,
  X,
  MessageSquareWarning,
  ZoomIn,
  Tag,
  Building2,
  Headphones,
} from 'lucide-react';
import StatusReasonModal, {
  REASON_REQUIRED_STATUSES as REASON_REQUIRED,
  MIN_REASON_LENGTH,
} from '../../components/helper/StatusReasonModal';

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
  packageContent: string | null;
  packageNoOpen: boolean;
  productVariant: string | null;
  items: Array<{
    id: number;
    productId: number | null;
    productName: string;
    productImage: string | null;
    productSku: string | null;
    quantity: number;
    unitPriceMad: number;
    totalPriceMad: number;
  }>;
  leadId: number;
  leadFullName: string;
  vendorId: number | null;
  vendorName: string | null;
  vendorEmail: string | null;
  agentId: number | null;
  agentName: string | null;
  agentEmail: string | null;
  paymentSituation: string;
  createdAt: string;
  lastStatusNote: string | null;
  lastStatusAt: string | null;
  lastStatusBy: string | null;
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

interface Filters {
  search: string;
  statuses: string[];
  paymentSituation: string;
  city: string;
  vendorId: string;
  productId: string;
  agentId: string;
  hasCode: '' | 'yes' | 'no';
  dateFrom: string;
  dateTo: string;
  minAmount: string;
  maxAmount: string;
  sort: string;
  limit: number;
}

const DEFAULT_FILTERS: Filters = {
  search: '',
  statuses: [],
  paymentSituation: '',
  city: '',
  vendorId: '',
  productId: '',
  agentId: '',
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
  'NEW_PARCEL': { label: 'Nouveau Colis', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-100', icon: Package },
  'WAITING_PICKUP': { label: 'Attente Collecte', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100', icon: Clock },
  'WAITING_PREPARATION': { label: 'Attente Préparation', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100', icon: Clock },
  'PREPARED': { label: 'Préparé', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', icon: CheckCircle2 },
  'ENCORE_PREPARED': { label: 'En préparation', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', icon: RefreshCw },

  // En transit
  'PICKED_UP': { label: 'Collecté', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', icon: Package },
  'SENT': { label: 'Expédié', color: 'text-violet-600', bg: 'bg-violet-50 border-violet-100', icon: Truck },
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
  'CANCELED_BY_SELLER': { label: 'Annulé (Vendeur)', color: 'text-red-600', bg: 'bg-red-50 border-red-100', icon: Package },
  'CANCELED_BY_SYSTEM': { label: 'Annulé (Système)', color: 'text-red-600', bg: 'bg-red-50 border-red-100', icon: ShieldAlert },
  'CANCELED': { label: 'Annulé (Livreur)', color: 'text-red-600', bg: 'bg-red-50 border-red-100', icon: Package },
  'REFUSE': { label: 'Refusé', color: 'text-red-600', bg: 'bg-red-50 border-red-100', icon: Package },

  // Compatibility / Old / Lead Statuses
  'PENDING': { label: 'En attente', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100', icon: Clock },
  'SHIPPED': { label: 'Expédié', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100', icon: Truck },
  'CANCELLED': { label: 'Annulé', color: 'text-red-600', bg: 'bg-red-50 border-red-100', icon: Package },
  'CONFIRMED': { label: 'Confirmé', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', icon: CheckCircle2 },
  'PUSHED_TO_DELIVERY': { label: 'En livraison', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100', icon: Truck },
  'CALL_LATER': { label: 'Rappel', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100', icon: Clock },
};

// Grouped statuses drive both the filter panel and the per-parcel status picker
const STATUS_GROUPS: { label: string; statuses: string[] }[] = [
  { label: 'Préparation', statuses: ['PENDING', 'CONFIRMED', 'NEW_PARCEL', 'WAITING_PICKUP', 'WAITING_PREPARATION', 'ENCORE_PREPARED', 'PREPARED'] },
  { label: 'En transit', statuses: ['PICKED_UP', 'SENT', 'SHIPPED', 'RECEIVED', 'DISTRIBUTION', 'PROGRAMMER', 'PROGRAMMER_AUTO'] },
  { label: 'Incidents', statuses: ['POSTPONED', 'NOANSWER', 'ERR', 'INCORRECT_ADDRESS', 'CALL_LATER'] },
  { label: 'Terminé', statuses: ['DELIVERED', 'RETURNED'] },
  { label: 'Annulations', statuses: ['CANCELED_BY_SELLER', 'CANCELED_BY_SYSTEM', 'CANCELED', 'CANCELLED', 'REFUSE'] },
];

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
  'INCORRECT_ADDRESS': 'Adresse erronée'
};

export default function HelperColis() {
  const { user } = useAuth();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'uninvoiced_returns'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
  const [updatingPaymentId, setUpdatingPaymentId] = useState<number | null>(null);

  // Filters (search is debounced into `debouncedSearch` before hitting the API).
  // Seeded from the URL so the dashboard's drill-down links land pre-filtered.
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => {
    const status = searchParams.get('status');
    return {
      ...DEFAULT_FILTERS,
      search: searchParams.get('q') || '',
      statuses: status ? status.split(',').filter(Boolean) : [],
      paymentSituation: searchParams.get('payment') || '',
      city: searchParams.get('city') || '',
      vendorId: searchParams.get('vendorId') || '',
      productId: searchParams.get('productId') || '',
      agentId: searchParams.get('agentId') || '',
      hasCode: (searchParams.get('code') as Filters['hasCode']) || '',
      dateFrom: searchParams.get('from') || '',
      dateTo: searchParams.get('to') || '',
      sort: searchParams.get('sort') || DEFAULT_FILTERS.sort,
    };
  });
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('q') || '');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    withColiaty: 0,
    pending: 0,
    delivered: 0,
    returned: 0,
    uninvoicedReturns: 0,
    byStatus: {} as Record<string, number>,
  });
  const [filterOptions, setFilterOptions] = useState<{
    cities: string[];
    vendors: { id: number; name: string }[];
    agents: { id: number; name: string }[];
    products: { id: number; name: string; sku: string | null }[];
    unassignedAgentCount: number;
  }>({ cities: [], vendors: [], agents: [], products: [], unassignedAgentCount: 0 });

  // Product image lightbox
  const [zoomImage, setZoomImage] = useState<{ url: string; name: string } | null>(null);

  const [historyParcel, setHistoryParcel] = useState<Parcel | null>(null);
  const [parcelHistory, setParcelHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [internalTimeline, setInternalTimeline] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [historyTab, setHistoryTab] = useState<'internal' | 'coliaty'>('internal');
  const [liveConnected, setLiveConnected] = useState(false);
  const [lastLiveUpdate, setLastLiveUpdate] = useState<string | null>(null);
  const [downloadingCode, setDownloadingCode] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Mandatory-reason modal for DELIVERED / RETURNED
  const [reasonModal, setReasonModal] = useState<{ parcel: Parcel; status: string } | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [submittingReason, setSubmittingReason] = useState(false);

  const canManage = !(user?.role === 'HELPER' && !user?.canManageOrders);

  // Debounce the free-text search so typing doesn't hammer the API
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search.trim()), 400);
    return () => clearTimeout(t);
  }, [filters.search]);

  const queryParams = useMemo(() => {
    const params: any = {
      page,
      limit: filters.limit,
      sort: filters.sort,
      tab: activeTab,
    };
    if (debouncedSearch) params.search = debouncedSearch;
    if (filters.statuses.length) params.status = filters.statuses.join(',');
    if (filters.paymentSituation) params.paymentSituation = filters.paymentSituation;
    if (filters.city) params.city = filters.city;
    if (filters.vendorId) params.vendorId = filters.vendorId;
    if (filters.productId) params.productId = filters.productId;
    if (filters.agentId) params.agentId = filters.agentId;
    if (filters.hasCode) params.hasCode = filters.hasCode;
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    if (filters.minAmount) params.minAmount = filters.minAmount;
    if (filters.maxAmount) params.maxAmount = filters.maxAmount;
    return params;
  }, [page, filters, debouncedSearch, activeTab]);

  const fetchParcels = useCallback(async (isRefresh = false) => {
    if (!canManage) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await leadsApi.livraison(queryParams);
      const data = res.data?.data || {};
      setParcels(data.parcels || []);
      setTotalPages(data.totalPages || 1);
      setTotalResults(data.total || 0);
      if (data.stats) setStats(data.stats);
      if (data.filterOptions) {
        setFilterOptions({
          cities: [], vendors: [], agents: [], products: [], unassignedAgentCount: 0,
          ...data.filterOptions,
        });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors du chargement des livraisons');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [queryParams, canManage]);

  useEffect(() => {
    fetchParcels();
  }, [fetchParcels]);

  // Reset to the first page whenever the filter set changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters.statuses, filters.paymentSituation, filters.city, filters.vendorId,
      filters.productId, filters.agentId,
      filters.hasCode, filters.dateFrom, filters.dateTo, filters.minAmount, filters.maxAmount,
      filters.sort, filters.limit, activeTab]);

  useEffect(() => {
    if (!canManage) return;

    // Open SSE stream for real-time status updates from Coliaty webhooks
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const API_URL = (import.meta.env as any).VITE_API_URL || (import.meta.env.PROD && typeof window !== 'undefined' ? `${window.location.origin}/api/v1` : 'http://localhost:3001/api/v1');
    const es = new EventSource(`${API_URL}/webhooks/stream?token=${token}`);
    eventSourceRef.current = es;

    es.addEventListener('connected', () => {
      setLiveConnected(true);
    });

    es.addEventListener('status_update', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      // Update the matching parcel in-place without a full refresh
      setParcels(prev =>
        prev.map(p =>
          p.id === data.orderId ? { ...p, status: data.newStatus } : p
        )
      );
      setLastLiveUpdate(new Date().toLocaleTimeString('fr-FR'));
      toast.success(
        `📦 Colis ${data.packageCode} → ${data.newStatus}`,
        { duration: 6000, id: `ws-${data.packageCode}` }
      );
    });

    es.onerror = () => {
      setLiveConnected(false);
      // Auto-reconnect is handled by the browser; don't close manually
    };

    return () => {
      eventSourceRef.current?.close();
    };
  }, [canManage]);

  // Escape closes the image lightbox
  useEffect(() => {
    if (!zoomImage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomImage(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomImage]);

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (debouncedSearch) {
      chips.push({ key: 'search', label: `Recherche: "${debouncedSearch}"`, clear: () => setFilters(f => ({ ...f, search: '' })) });
    }
    filters.statuses.forEach(s => {
      chips.push({
        key: `status-${s}`,
        label: `Statut: ${statusConfig[s]?.label || s}`,
        clear: () => setFilters(f => ({ ...f, statuses: f.statuses.filter(x => x !== s) })),
      });
    });
    if (filters.paymentSituation) {
      chips.push({ key: 'pay', label: `Paiement: ${paymentConfig[filters.paymentSituation]?.label || filters.paymentSituation}`, clear: () => setFilters(f => ({ ...f, paymentSituation: '' })) });
    }
    if (filters.city) chips.push({ key: 'city', label: `Ville: ${filters.city}`, clear: () => setFilters(f => ({ ...f, city: '' })) });
    if (filters.vendorId) {
      const v = filterOptions.vendors.find(x => String(x.id) === filters.vendorId);
      chips.push({ key: 'vendor', label: `Compte: ${v?.name || filters.vendorId}`, clear: () => setFilters(f => ({ ...f, vendorId: '' })) });
    }
    if (filters.productId) {
      const p = filterOptions.products.find(x => String(x.id) === filters.productId);
      chips.push({ key: 'product', label: `Produit: ${p?.name || filters.productId}`, clear: () => setFilters(f => ({ ...f, productId: '' })) });
    }
    if (filters.agentId) {
      const a = filterOptions.agents.find(x => String(x.id) === filters.agentId);
      chips.push({
        key: 'agent',
        label: `Agent: ${filters.agentId === 'none' ? 'Non assigné' : a?.name || filters.agentId}`,
        clear: () => setFilters(f => ({ ...f, agentId: '' })),
      });
    }
    if (filters.hasCode) chips.push({ key: 'code', label: filters.hasCode === 'yes' ? 'Avec code Coliaty' : 'Sans code Coliaty', clear: () => setFilters(f => ({ ...f, hasCode: '' })) });
    if (filters.dateFrom) chips.push({ key: 'from', label: `Du ${filters.dateFrom}`, clear: () => setFilters(f => ({ ...f, dateFrom: '' })) });
    if (filters.dateTo) chips.push({ key: 'to', label: `Au ${filters.dateTo}`, clear: () => setFilters(f => ({ ...f, dateTo: '' })) });
    if (filters.minAmount) chips.push({ key: 'min', label: `Min ${filters.minAmount} MAD`, clear: () => setFilters(f => ({ ...f, minAmount: '' })) });
    if (filters.maxAmount) chips.push({ key: 'max', label: `Max ${filters.maxAmount} MAD`, clear: () => setFilters(f => ({ ...f, maxAmount: '' })) });
    return chips;
  }, [filters, debouncedSearch, filterOptions]);

  // Permission Guard (rendered after hooks so hook order stays stable)
  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mb-6 animate-bounce">
          <ShieldAlert size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Accès Non Autorisé</h2>
        <p className="text-slate-500 max-w-md mb-8">
          Vous n'avez pas la permission de gérer les expéditions. Veuillez contacter un administrateur pour obtenir l'accès.
        </p>
        <Link
          to="/helper"
          className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
        >
          Retour au Tableau de Bord
        </Link>
      </div>
    );
  }

  const handleDownloadLabel = async (code: string) => {
    setDownloadingCode(code);
    try {
      const res = await ordersApi.getParcelLabel(code);
      const base64 = res.data?.data?.pdf;
      if (!base64) throw new Error('PDF data missing');

      // Convert base64 to blob
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ticket-${code}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Étiquette téléchargée !');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors du téléchargement de l\'étiquette');
    } finally {
      setDownloadingCode(null);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      toast.success('Code copié !');
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  const applyStatus = async (parcelId: number, newStatus: string, reason?: string) => {
    setUpdatingStatusId(parcelId);
    try {
      await ordersApi.updateStatus(parcelId.toString(), {
        status: newStatus,
        ...(reason ? { notes: reason } : {}),
      });
      toast.success(`Statut mis à jour : ${statusConfig[newStatus]?.label || newStatus}`);
      await fetchParcels(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la mise à jour du statut');
      throw err;
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // DELIVERED / RETURNED never go through directly — they require a written reason
  const handleStatusSelect = (parcel: Parcel, newStatus: string) => {
    if (newStatus === parcel.status) return;
    if (REASON_REQUIRED[newStatus]) {
      setReasonText('');
      setReasonModal({ parcel, status: newStatus });
      return;
    }
    applyStatus(parcel.id, newStatus).catch(() => {});
  };

  const handleConfirmReason = async () => {
    if (!reasonModal) return;
    const reason = reasonText.trim();
    if (reason.length < MIN_REASON_LENGTH) return;
    setSubmittingReason(true);
    try {
      await applyStatus(reasonModal.parcel.id, reasonModal.status, reason);
      setReasonModal(null);
      setReasonText('');
    } catch {
      // error already surfaced by applyStatus
    } finally {
      setSubmittingReason(false);
    }
  };

  const handlePaymentUpdate = async (parcelId: number, leadId: number, status: string) => {
    setUpdatingPaymentId(parcelId);
    try {
      await leadsApi.updatePaymentSituation(leadId.toString(), { paymentSituation: status });
      toast.success(`Situation mise à jour : ${paymentConfig[status]?.label || status}`);
      fetchParcels(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la mise à jour de la situation');
    } finally {
      setUpdatingPaymentId(null);
    }
  };

  const handleOpenHistory = async (parcel: Parcel) => {
    setHistoryParcel(parcel);
    setParcelHistory([]);
    setInternalTimeline([]);

    // Internal timeline (lead + order status changes, with their reasons)
    setLoadingTimeline(true);
    leadsApi.timeline(parcel.leadId)
      .then(res => setInternalTimeline(res.data?.data?.entries || []))
      .catch(() => { })
      .finally(() => setLoadingTimeline(false));

    // Coliaty carrier history
    if (!parcel.coliatyPackageCode) return;
    setLoadingHistory(true);
    try {
      const res = await leadsApi.getParcelHistory(parcel.coliatyPackageCode);
      setParcelHistory(res.data?.data?.details || []);
    } catch (err: any) {
      toast.error('Impossible de récupérer l\'historique du colis');
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleStatusFilter = (status: string) => {
    setFilters(f => ({
      ...f,
      statuses: f.statuses.includes(status)
        ? f.statuses.filter(s => s !== status)
        : [...f.statuses, status],
    }));
  };

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Truck className="w-5 h-5 text-white" />
            </div>
            Livraison Coliaty
          </h1>
          <p className="text-sm text-gray-500 mt-1 ml-13">
            Suivez vos colis envoyés à la livraison via Coliaty
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Live connection indicator */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
            liveConnected
              ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
              : 'bg-gray-50 text-gray-400 border-gray-100'
          }`}>
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
          <Link
            to="/helper/scanner"
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md active:scale-95 shadow-indigo-100"
          >
            <QrCode className="w-4 h-4" />
            Scanner de Retours
          </Link>
        </div>
      </div>

      {/* Stats Cards (computed server-side over the full scope, not just this page) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total envoyés', value: stats.total, icon: Package, color: 'from-blue-500 to-indigo-500', shadow: 'shadow-blue-200' },
          { label: 'Avec Coliaty', value: stats.withColiaty, icon: Truck, color: 'from-purple-500 to-pink-500', shadow: 'shadow-purple-200' },
          { label: 'En attente', value: stats.pending, icon: Clock, color: 'from-amber-400 to-orange-500', shadow: 'shadow-amber-200' },
          { label: 'Livré', value: stats.delivered, icon: CheckCircle2, color: 'from-emerald-400 to-teal-500', shadow: 'shadow-emerald-200' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center shadow-lg ${stat.shadow} mb-3`}>
              <stat.icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-2xl font-black text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500 font-medium mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border border-gray-100 bg-white p-1.5 rounded-2xl shadow-sm gap-1">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-black transition-all ${
            activeTab === 'all'
              ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Package className="w-4 h-4" />
          Tous les Colis ({stats.total})
        </button>
        <button
          onClick={() => setActiveTab('uninvoiced_returns')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-black transition-all ${
            activeTab === 'uninvoiced_returns'
              ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/10'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Box className="w-4 h-4" />
          Retours Non Facturés ({stats.uninvoicedReturns})
        </button>
      </div>

      {/* Search + filter controls */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              placeholder="Rechercher par nom, téléphone, ville, n° commande, code Coliaty..."
              className="w-full pl-10 pr-9 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
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

          <select
            value={filters.sort}
            onChange={e => setFilters(f => ({ ...f, sort: e.target.value }))}
            className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
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
              <span className="px-1.5 py-0.5 bg-white/25 rounded-md text-[10px] font-black">
                {activeFilterChips.length}
              </span>
            )}
            {showFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Advanced filters panel */}
        {showFilters && (
          <div className="border-t border-gray-100 pt-4 space-y-4">
            {/* Status checkboxes, grouped */}
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Statut du colis</p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                {STATUS_GROUPS.map(group => (
                  <div key={group.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2">{group.label}</p>
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
                          {stats.byStatus?.[s] > 0 && (
                            <span className="text-[9px] font-black text-gray-400 bg-white px-1.5 py-0.5 rounded border border-gray-100">
                              {stats.byStatus[s]}
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Other filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Situation de paiement</label>
                <select
                  value={filters.paymentSituation}
                  onChange={e => setFilters(f => ({ ...f, paymentSituation: e.target.value }))}
                  className="mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
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
                  className="mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="">Toutes les villes</option>
                  {filterOptions.cities.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Compte (référent)</label>
                <select
                  value={filters.vendorId}
                  onChange={e => setFilters(f => ({ ...f, vendorId: e.target.value }))}
                  className="mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="">Tous les comptes</option>
                  {filterOptions.vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Produit</label>
                <select
                  value={filters.productId}
                  onChange={e => setFilters(f => ({ ...f, productId: e.target.value }))}
                  className="mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="">Tous les produits</option>
                  {filterOptions.products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.sku ? ` · ${p.sku}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Agent call center</label>
                <select
                  value={filters.agentId}
                  onChange={e => setFilters(f => ({ ...f, agentId: e.target.value }))}
                  className="mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="">Tous les agents</option>
                  {filterOptions.unassignedAgentCount > 0 && (
                    <option value="none">Non assigné ({filterOptions.unassignedAgentCount})</option>
                  )}
                  {filterOptions.agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Code Coliaty</label>
                <select
                  value={filters.hasCode}
                  onChange={e => setFilters(f => ({ ...f, hasCode: e.target.value as Filters['hasCode'] }))}
                  className="mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="">Tous</option>
                  <option value="yes">Synchronisés</option>
                  <option value="no">Non synchronisés</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Du</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                  className="mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Au</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                  className="mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="number"
                    min={0}
                    value={filters.maxAmount}
                    onChange={e => setFilters(f => ({ ...f, maxAmount: e.target.value }))}
                    placeholder="Max"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Colis par page</label>
                <select
                  value={filters.limit}
                  onChange={e => setFilters(f => ({ ...f, limit: Number(e.target.value) }))}
                  className="mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  {[10, 25, 50, 100, 200].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Active filter chips + result count */}
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
          <span className="text-xs font-bold text-gray-500">
            {totalResults} colis trouvé{totalResults > 1 ? 's' : ''}
          </span>
          {activeFilterChips.map(chip => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-[11px] font-bold"
            >
              {chip.label}
              <button onClick={chip.clear} className="hover:text-indigo-900">
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

      {/* Parcels List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-gray-400 text-sm font-medium">Chargement des livraisons...</p>
        </div>
      ) : parcels.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <Truck className="w-10 h-10 text-indigo-300" />
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
            const status = statusConfig[parcel.status] || { label: parcel.status, color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200', icon: Package };
            const StatusIcon = status.icon;
            const isExpanded = expandedId === parcel.id;
            const showReason = !!parcel.lastStatusNote && !!REASON_REQUIRED[parcel.status];
            const primaryItem = parcel.items[0];

            return (
              <div
                key={parcel.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                {/* Card Header */}
                <div className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Left: Customer Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        {/* The parcel's product is what the operator actually needs to
                            recognise here, so it replaces the customer initial. */}
                        {primaryItem?.productImage ? (
                          <button
                            type="button"
                            onClick={() => setZoomImage({ url: getFileUrl(primaryItem.productImage), name: primaryItem.productName || 'Produit' })}
                            title="Agrandir l'image du produit"
                            className="relative w-12 h-12 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0 group/img hover:border-indigo-400 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <img
                              src={getFileUrl(primaryItem.productImage)}
                              alt={primaryItem.productName || 'Produit'}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-300"
                            />
                            <span className="absolute inset-0 bg-black/45 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                              <ZoomIn className="w-4 h-4 text-white" />
                            </span>
                            {parcel.items.length > 1 && (
                              <span className="absolute bottom-0 right-0 px-1 bg-slate-900 text-white text-[9px] font-black rounded-tl-md">
                                +{parcel.items.length - 1}
                              </span>
                            )}
                          </button>
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center flex-shrink-0 border border-gray-200">
                            <Package className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 truncate">{parcel.customerName}</p>
                          <p className="text-xs text-gray-400 font-medium">#{parcel.orderNumber}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                        <a href={`tel:${parcel.customerPhone}`} className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors font-medium">
                          <Phone className="w-3.5 h-3.5" />
                          {parcel.customerPhone}
                        </a>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          {parcel.customerCity}
                        </span>
                        {parcel.packageContent && (
                          <span className="flex items-center gap-1.5 text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md text-[11px] font-bold">
                            📦 {parcel.packageContent}
                          </span>
                        )}
                        {parcel.packageNoOpen && (
                          <span className="flex items-center gap-1.5 text-red-600 bg-red-50 px-2 py-0.5 rounded-md text-[11px] font-bold">
                            🚫 Ne pas ouvrir
                          </span>
                        )}
                        {/* Product / account / agent — click to filter the list down to it */}
                        {primaryItem?.productName && (
                          <button
                            type="button"
                            onClick={() =>
                              primaryItem.productId &&
                              setFilters(f => ({ ...f, productId: String(primaryItem.productId) }))
                            }
                            title={primaryItem.productId ? `Filtrer sur « ${primaryItem.productName} »` : undefined}
                            className="flex items-center gap-1.5 text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md text-[11px] font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors max-w-[220px]"
                          >
                            <Tag className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{primaryItem.productName}</span>
                            {primaryItem.productSku && (
                              <span className="text-indigo-400 font-medium flex-shrink-0">· {primaryItem.productSku}</span>
                            )}
                          </button>
                        )}

                        {(parcel.vendorName || parcel.vendorEmail) && (
                          <button
                            type="button"
                            onClick={() => parcel.vendorId && setFilters(f => ({ ...f, vendorId: String(parcel.vendorId) }))}
                            title={parcel.vendorEmail || undefined}
                            className="flex items-center gap-1.5 text-purple-700 bg-purple-50 px-2 py-1 rounded-md text-[11px] font-bold border border-purple-100 hover:bg-purple-100 transition-colors max-w-[220px]"
                          >
                            <Building2 className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{parcel.vendorName || parcel.vendorEmail}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            setFilters(f => ({ ...f, agentId: parcel.agentId ? String(parcel.agentId) : 'none' }))
                          }
                          title={parcel.agentEmail || "Filtrer sur cet agent"}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-bold border transition-colors max-w-[220px] ${
                            parcel.agentName
                              ? 'text-teal-700 bg-teal-50 border-teal-100 hover:bg-teal-100'
                              : 'text-gray-400 bg-gray-50 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <Headphones className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{parcel.agentName || 'Agent non assigné'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Center: Coliaty Code */}
                    <div className="flex-shrink-0">
                      {parcel.coliatyPackageCode ? (
                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl px-4 py-3">
                          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Code Coliaty</p>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-indigo-700 text-sm tracking-wide">{parcel.coliatyPackageCode}</span>
                            <button
                              onClick={() => handleCopyCode(parcel.coliatyPackageCode!)}
                              className="p-1 rounded-lg hover:bg-indigo-100 transition-colors text-indigo-400 hover:text-indigo-600"
                              title="Copier le code"
                            >
                              {copiedCode === parcel.coliatyPackageCode
                                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                : <Copy className="w-3.5 h-3.5" />
                              }
                            </button>
                          </div>
                          {parcel.coliatyPackageId && (
                            <p className="text-[9px] text-indigo-300 mt-0.5">ID: #{parcel.coliatyPackageId}</p>
                          )}
                        </div>
                      ) : (
                        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Code Coliaty</p>
                          <p className="text-sm font-medium text-gray-400 italic">Non synchronisé</p>
                        </div>
                      )}
                    </div>

                    {/* Right: Amount + Status */}
                    <div className="flex sm:flex-col items-center sm:items-end gap-3">
                      <span className="text-xl font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl">
                        {Number(parcel.totalAmountMad).toFixed(0)} MAD
                      </span>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${status.bg} ${status.color}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {status.label}
                        </span>

                        {/* Status Changer for Helper */}
                        <div className="relative group">
                          <select
                            disabled={updatingStatusId === parcel.id}
                            value={parcel.status}
                            onChange={(e) => handleStatusSelect(parcel, e.target.value)}
                            className={`
                              appearance-none pl-3 pr-8 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider
                              border border-gray-100 bg-gray-50 text-gray-400 hover:border-indigo-200 hover:text-indigo-600
                              transition-all cursor-pointer outline-none disabled:opacity-50
                            `}
                          >
                            {!STATUS_GROUPS.some(g => g.statuses.includes(parcel.status)) && (
                              <option value={parcel.status}>{status.label}</option>
                            )}
                            {STATUS_GROUPS.map(group => (
                              <optgroup key={group.label} label={group.label}>
                                {group.statuses.map(val => (
                                  <option key={val} value={val}>
                                    {statusConfig[val]?.label || val}
                                    {REASON_REQUIRED[val] ? ' *' : ''}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-300 pointer-events-none group-hover:text-indigo-400" />
                        </div>
                        <p className="text-[9px] text-gray-300 font-bold uppercase tracking-wider">* raison obligatoire</p>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span
                          title={paymentSituationMeta(parcel.paymentSituation).hint}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border ${paymentSituationMeta(parcel.paymentSituation).bg} ${paymentSituationMeta(parcel.paymentSituation).text}`}
                        >
                          💳 {paymentSituationLabel(parcel.paymentSituation)}
                        </span>

                        {/* Payment Situation Changer */}
                        <div className="relative group">
                          <select
                            disabled={updatingPaymentId === parcel.id}
                            value={normalizePaymentSituation(parcel.paymentSituation)}
                            onChange={(e) => handlePaymentUpdate(parcel.id, parcel.leadId, e.target.value)}
                            className={`
                              appearance-none pl-3 pr-8 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider
                              border border-gray-100 bg-gray-50 text-gray-400 hover:border-blue-200 hover:text-blue-600
                              transition-all cursor-pointer outline-none disabled:opacity-50
                            `}
                          >
                            {Object.entries(paymentConfig).map(([val, cfg]) => {
                              // The two facture states are produced by invoicing —
                              // the admin's for FACTURED, the agent's for FACTURED-CC.
                              // Neither is settable here; they only appear so the
                              // select has a value matching the parcel it shows.
                              if (val.startsWith('FACTURED') && normalizePaymentSituation(parcel.paymentSituation) !== val) return null;
                              return <option key={val} value={val}>{cfg.label}</option>;
                            })}
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-300 pointer-events-none group-hover:text-blue-400" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Justification of the last final status */}
                  {showReason && (
                    <div className="mt-4 flex items-start gap-2.5 bg-amber-50/60 border border-amber-100 rounded-xl px-4 py-3">
                      <MessageSquareWarning className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider">
                          Raison ({status.label})
                        </p>
                        <p className="text-sm text-amber-900 font-medium italic mt-0.5 break-words">
                          "{parcel.lastStatusNote}"
                        </p>
                        <p className="text-[10px] text-amber-500 font-bold mt-1">
                          {parcel.lastStatusBy ? `${parcel.lastStatusBy} · ` : ''}
                          {parcel.lastStatusAt
                            ? format(new Date(parcel.lastStatusAt), "dd MMM yyyy 'à' HH:mm", { locale: fr })
                            : ''}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Footer Row */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">
                        {format(new Date(parcel.createdAt), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                      </span>
                      <span className="inline-block px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded-lg border border-purple-100">
                        💳 {parcel.paymentMethod || 'COD'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {parcel.items.length} article{parcel.items.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                        {parcel.coliatyPackageCode && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenHistory(parcel)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors border border-indigo-100"
                              title="Voir l'historique du colis"
                            >
                              <Clock className="w-3.5 h-3.5" />
                              Suivi
                            </button>
                            <button
                              onClick={() => handleDownloadLabel(parcel.coliatyPackageCode!)}
                              disabled={downloadingCode === parcel.coliatyPackageCode}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors border border-emerald-100 disabled:opacity-50"
                              title="Télécharger l'étiquette PDF"
                            >
                              <FileText className={`w-3.5 h-3.5 ${downloadingCode === parcel.coliatyPackageCode ? 'animate-pulse' : ''}`} />
                              Ticket
                            </button>
                          </div>
                        )}

                        <button
                          onClick={() => setExpandedId(isExpanded ? null : parcel.id)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-indigo-600 transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          {isExpanded ? 'Masquer' : 'Détails'}
                        </button>
                    </div>
                  </div>
                </div>

                {/* Expanded: Products */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50/50 p-5 space-y-3">
                    <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                      <Package className="w-4 h-4 text-gray-400" />
                      Produits commandés
                    </h4>
                    {parcel.items.map(item => (
                      <div key={item.id} className="flex items-center gap-4 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                        {item.productImage ? (
                          <img
                            src={item.productImage}
                            alt={item.productName}
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
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase rounded-md border border-indigo-100">
                                {parcel.productVariant}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Qty: <strong className="text-gray-700">{item.quantity}</strong>
                            {' · '}
                            Prix: <strong className="text-gray-700">{Number(item.unitPriceMad).toFixed(0)} MAD</strong>
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-black text-gray-900 text-sm">{Number(item.totalPriceMad).toFixed(0)} MAD</p>
                        </div>
                      </div>
                    ))}

                    {/* Links */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <a
                        href={`tel:${parcel.customerPhone}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-xs font-bold hover:bg-indigo-600 transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Appeler
                      </a>
                      <a
                        href={`https://wa.me/212${parcel.customerPhone.replace(/[^0-9]/g, '').replace(/^(212|0)/, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 transition-colors"
                      >
                        💬 WhatsApp
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && parcels.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3">
          <p className="text-xs font-bold text-gray-500">
            Page {page} sur {totalPages} · {totalResults} colis
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Précédent
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Suivant
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Mandatory reason modal for DELIVERED / RETURNED */}
      {reasonModal && (
        <StatusReasonModal
          status={reasonModal.status}
          parcelLabel={reasonModal.parcel.coliatyPackageCode || `#${reasonModal.parcel.orderNumber}`}
          customerName={reasonModal.parcel.customerName}
          reason={reasonText}
          onReasonChange={setReasonText}
          onCancel={() => setReasonModal(null)}
          onConfirm={handleConfirmReason}
          submitting={submittingReason}
        />
      )}

      {/* History Modal */}
      {historyParcel && createPortal(
        <div
          className="fixed inset-0 z-[999999] bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-200"
          onClick={() => setHistoryParcel(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] overflow-hidden shadow-2xl relative flex flex-col cursor-default animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50/30">
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-500" />
                  Suivi du Colis
                </h3>
                <p className="text-xs text-gray-500 font-bold mt-1 uppercase tracking-wider">
                  CODE: {historyParcel.coliatyPackageCode || 'Non synchronisé'} · #{historyParcel.orderNumber}
                </p>
              </div>
              <button
                onClick={() => setHistoryParcel(null)}
                className="text-gray-400 hover:text-gray-600 bg-white shadow-sm p-2 rounded-full transition-all hover:rotate-90"
              >
                ✕
              </button>
            </div>

            {/* Internal history vs carrier history */}
            <div className="flex gap-1 p-2 bg-gray-50 border-b border-gray-100">
              <button
                onClick={() => setHistoryTab('internal')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
                  historyTab === 'internal'
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-500 hover:bg-white'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Historique Interne ({internalTimeline.length})
              </button>
              <button
                onClick={() => setHistoryTab('coliaty')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
                  historyTab === 'coliaty'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-500 hover:bg-white'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                Suivi Coliaty ({parcelHistory.length})
              </button>
            </div>

            <div className={`flex-1 overflow-y-auto p-6 scrollbar-thin ${historyTab === 'internal' ? '' : 'hidden'}`}>
              {loadingTimeline ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="w-10 h-10 border-3 border-slate-100 border-t-slate-500 rounded-full animate-spin" />
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
                      <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                        idx === 0 ? 'bg-slate-900 scale-125' : 'bg-slate-300'
                      }`} />
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                            entry.scope === 'ORDER'
                              ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {entry.scope === 'ORDER' ? 'Commande' : 'Lead'}
                          </span>
                          <span className="text-[10px] font-bold text-gray-400">
                            {format(new Date(entry.createdAt), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                          </span>
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
                            <p className="text-[10px] font-bold text-indigo-600 mt-2 uppercase tracking-wider">
                              Par : {entry.changedBy}
                            </p>
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
              {historyParcel.lastStatusNote && (
                <div className="mb-6 bg-amber-50/60 border border-amber-100 rounded-2xl p-4">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider mb-1">
                    Dernière raison saisie
                  </p>
                  <p className="text-sm text-amber-900 font-medium italic">"{historyParcel.lastStatusNote}"</p>
                  <p className="text-[10px] text-amber-500 font-bold mt-1.5">
                    {historyParcel.lastStatusBy ? `${historyParcel.lastStatusBy} · ` : ''}
                    {historyParcel.lastStatusAt
                      ? format(new Date(historyParcel.lastStatusAt), "dd MMM yyyy 'à' HH:mm", { locale: fr })
                      : ''}
                  </p>
                </div>
              )}
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="w-10 h-10 border-3 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
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
                      {/* Timeline Dot */}
                      <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                        idx === 0 ? 'bg-indigo-500 scale-125' : 'bg-indigo-200'
                      }`} />

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-[11px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-md ${
                            idx === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {historyStatusLabels[entry.HISTORY_STATUS] || entry.HISTORY_STATUS}
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
                                Situation: {entry.HISTORY_SITUATION === 'NOT_PAID' ? 'Non payé' : entry.HISTORY_SITUATION === 'PAID' ? 'Payé' : entry.HISTORY_SITUATION}
                              </p>
                            )}

                            {entry.HISTORY_STATUS_DATE && (
                              <p className="text-[10px] font-bold text-gray-400 flex items-center gap-1.5 uppercase tracking-wider tooltip" title="Date d'effet sur le terrain">
                                <Clock size={10} /> Date: {format(new Date(parseInt(entry.HISTORY_STATUS_DATE) * 1000), "dd/MM/yyyy HH:mm", { locale: fr })}
                              </p>
                            )}

                            {entry.HISTORY_PROOF && typeof entry.HISTORY_PROOF === 'string' && (
                              <a href={entry.HISTORY_PROOF} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-emerald-500 flex items-center gap-1.5 uppercase tracking-wider bg-emerald-50 px-2 py-1 rounded-md hover:bg-emerald-100 transition-colors">
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

            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setHistoryParcel(null)}
                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-black rounded-xl text-xs hover:bg-gray-100 transition-all active:scale-95 shadow-sm"
              >
                FERMER
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Product image lightbox */}
      {zoomImage && createPortal(
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60]"
          onMouseDown={e => {
            if (e.target === e.currentTarget) setZoomImage(null);
          }}
        >
          <div className="relative max-w-3xl w-full">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-black text-sm truncate pr-4">{zoomImage.name}</p>
              <button
                onClick={() => setZoomImage(null)}
                aria-label="Fermer"
                className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={zoomImage.url}
              alt={zoomImage.name}
              className="w-full max-h-[80vh] object-contain rounded-2xl bg-white/5"
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { leadsApi, ordersApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Package,
  MapPin,
  Phone,
  RefreshCw,
  Copy,
  CheckCircle2,
  Clock,
  FileText,
  ShieldAlert,
  Box,
  QrCode,
  RotateCcw,
  DollarSign,
  ChevronDown,
  ChevronUp
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
  vendorName: string | null;
  vendorEmail: string | null;
  paymentSituation: string;
  createdAt: string;
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

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ComponentType<any> }> = {
  'NEW_PARCEL': { label: 'Nouveau Colis', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-100', icon: Package },
  'WAITING_PICKUP': { label: 'Attente Collecte', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100', icon: Clock },
  'WAITING_PREPARATION': { label: 'Attente Préparation', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100', icon: Clock },
  'PREPARED': { label: 'Préparé', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', icon: CheckCircle2 },
  'ENCORE_PREPARED': { label: 'En préparation', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', icon: RefreshCw },
  'PICKED_UP': { label: 'Collecté', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', icon: Package },
  'SENT': { label: 'Expédié', color: 'text-violet-600', bg: 'bg-violet-50 border-violet-100', icon: Package }, // generic fallback
  'RECEIVED': { label: 'Reçu (Destination)', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100', icon: MapPin },
  'DISTRIBUTION': { label: 'En livraison', color: 'text-cyan-600', bg: 'bg-cyan-50 border-cyan-100', icon: Clock },
  'PROGRAMMER_AUTO': { label: 'Livraison Auto', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-100', icon: Clock },
  'POSTPONED': { label: 'Reporté', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100', icon: Clock },
  'NOANSWER': { label: 'Pas de réponse', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100', icon: Phone },
  'ERR': { label: 'Tél Erroné', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100', icon: Phone },
  'PROGRAMMER': { label: 'Programmé', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', icon: Clock },
  'INCORRECT_ADDRESS': { label: 'Adresse Erronée', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100', icon: MapPin },
  'DELIVERED': { label: 'Livré', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', icon: CheckCircle2 },
  'RETURNED': { label: 'Retourné', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100', icon: Box },
  'CANCELED_BY_SELLER': { label: 'Annulé (Vendeur)', color: 'text-red-600', bg: 'bg-red-50 border-red-100', icon: Package },
  'CANCELED_BY_SYSTEM': { label: 'Annulé (Système)', color: 'text-red-600', bg: 'bg-red-50 border-red-100', icon: ShieldAlert },
  'CANCELED': { label: 'Annulé (Livreur)', color: 'text-red-600', bg: 'bg-red-50 border-red-100', icon: Package },
  'REFUSE': { label: 'Refusé', color: 'text-red-600', bg: 'bg-red-50 border-red-100', icon: Package },
  'PENDING': { label: 'En attente', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100', icon: Clock },
  'SHIPPED': { label: 'Expédié', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100', icon: Package },
  'CANCELLED': { label: 'Annulé', color: 'text-red-600', bg: 'bg-red-50 border-red-100', icon: Package },
  'CONFIRMED': { label: 'Confirmé', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', icon: CheckCircle2 },
  'PUSHED_TO_DELIVERY': { label: 'En livraison', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100', icon: Package },
  'CALL_LATER': { label: 'Rappel', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100', icon: Clock },
};

const paymentConfig: Record<string, { label: string; color: string; bg: string }> = {
  NOT_PAID: { label: 'Non payé', color: 'text-red-600', bg: 'bg-rose-50 border-rose-100' },
  PAID: { label: 'Payé', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
  FACTURED: { label: 'Facturée', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
};

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

export default function HelperRetours() {
  const { user } = useAuth();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);

  // Permission Guard
  if (user?.role === 'HELPER' && !user?.canScanReturns) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mb-6 animate-bounce">
          <ShieldAlert size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Accès Non Autorisé</h2>
        <p className="text-slate-500 max-w-md mb-8">
          Vous n'avez pas la permission de gérer ou de scanner les retours. Veuillez contacter un administrateur pour obtenir l'accès.
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

  const [activeTab, setActiveTab] = useState<'all' | 'unvoiced' | 'voiced'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
  const [updatingPaymentId, setUpdatingPaymentId] = useState<number | null>(null);

  const [historyParcel, setHistoryParcel] = useState<Parcel | null>(null);
  const [parcelHistory, setParcelHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  const [lastLiveUpdate, setLastLiveUpdate] = useState<string | null>(null);
  const [downloadingCode, setDownloadingCode] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchParcels = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await leadsApi.livraison({ limit: 150 });
      setParcels(res.data?.data?.parcels || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors du chargement des livraisons');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchParcels();

    const token = localStorage.getItem('accessToken');
    if (token) {
      const API_URL = (import.meta.env as any).VITE_API_URL || (import.meta.env.PROD && typeof window !== 'undefined' ? `${window.location.origin}/api/v1` : 'http://localhost:3001/api/v1');
      const es = new EventSource(`${API_URL}/webhooks/stream?token=${token}`);
      eventSourceRef.current = es;

      es.addEventListener('connected', () => {
        setLiveConnected(true);
      });

      es.addEventListener('status_update', (e) => {
        const data = JSON.parse(e.data);
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
      };
    }

    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const handleDownloadLabel = async (code: string) => {
    setDownloadingCode(code);
    try {
      const res = await ordersApi.getParcelLabel(code);
      const base64 = res.data?.data?.pdf;
      if (!base64) throw new Error('PDF data missing');

      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

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

  const handleStatusUpdate = async (parcelId: number, newStatus: string) => {
    setUpdatingStatusId(parcelId);
    try {
      await ordersApi.updateStatus(parcelId.toString(), { status: newStatus });
      toast.success(`Statut mis à jour : ${newStatus}`);
      fetchParcels();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la mise à jour du statut');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handlePaymentUpdate = async (parcelId: number, leadId: number, status: string) => {
    setUpdatingPaymentId(parcelId);
    try {
      await leadsApi.updatePaymentSituation(leadId.toString(), { paymentSituation: status });
      toast.success(`Situation mise à jour : ${paymentConfig[status]?.label || status}`);
      fetchParcels();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la mise à jour de la situation');
    } finally {
      setUpdatingPaymentId(null);
    }
  };

  const handleOpenHistory = async (parcel: Parcel) => {
    setHistoryParcel(parcel);
    setLoadingHistory(true);
    setParcelHistory([]);
    try {
      if (!parcel.coliatyPackageCode) return;
      const res = await leadsApi.getParcelHistory(parcel.coliatyPackageCode);
      setParcelHistory(res.data?.data?.details || []);
    } catch (err: any) {
      toast.error('Impossible de récupérer l\'historique du colis');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Filter ONLY returned parcels (both RETURNED or REFUSE)
  const returnedParcels = parcels.filter(p => p.status === 'RETURNED' || p.status === 'REFUSE');

  const filtered = returnedParcels.filter(p => {
    if (activeTab === 'unvoiced') {
      if (p.paymentSituation === 'FACTURED') return false;
    }
    if (activeTab === 'voiced') {
      if (p.paymentSituation !== 'FACTURED') return false;
    }
    return (
      !search ||
      p.customerName.toLowerCase().includes(search.toLowerCase()) ||
      p.customerPhone.includes(search) ||
      p.customerCity.toLowerCase().includes(search.toLowerCase()) ||
      (p.coliatyPackageCode || '').toLowerCase().includes(search.toLowerCase()) ||
      p.orderNumber.toLowerCase().includes(search.toLowerCase())
    );
  });

  const stats = {
    total: returnedParcels.length,
    unvoiced: returnedParcels.filter(p => p.paymentSituation !== 'FACTURED').length,
    voiced: returnedParcels.filter(p => p.paymentSituation === 'FACTURED').length,
    totalAmount: returnedParcels.reduce((acc, p) => acc + Number(p.totalAmountMad || 0), 0)
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-rose-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-200">
              <RotateCcw className="w-5 h-5 text-white" />
            </div>
            Colis Retournés & Refusés
          </h1>
          <p className="text-sm text-gray-500 mt-1 ml-13">
            Gérez et suivez tous les colis en statut Retourné ou Refusé
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Retours', value: stats.total, icon: RotateCcw, color: 'from-orange-500 to-rose-500', shadow: 'shadow-orange-200' },
          { label: 'Non Facturés', value: stats.unvoiced, icon: Clock, color: 'from-amber-400 to-orange-500', shadow: 'shadow-amber-200' },
          { label: 'Facturés / Clôturés', value: stats.voiced, icon: CheckCircle2, color: 'from-emerald-400 to-teal-500', shadow: 'shadow-emerald-200' },
          { label: 'Valeur Marchande', value: `${stats.totalAmount.toFixed(0)} MAD`, icon: DollarSign, color: 'from-blue-500 to-indigo-500', shadow: 'shadow-blue-200' },
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
          <Box className="w-4 h-4" />
          Tous les Retours ({stats.total})
        </button>
        <button
          onClick={() => setActiveTab('unvoiced')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-black transition-all ${
            activeTab === 'unvoiced'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/10'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Clock className="w-4 h-4" />
          Non Facturés ({stats.unvoiced})
        </button>
        <button
          onClick={() => setActiveTab('voiced')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-black transition-all ${
            activeTab === 'voiced'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/10'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Facturés ({stats.voiced})
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un retour par nom, téléphone, ville, code Coliaty..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all shadow-sm"
        />
      </div>

      {/* Parcels List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-gray-400 text-sm font-medium">Chargement des retours...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-50 to-rose-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <RotateCcw className="w-10 h-10 text-orange-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">
            {search ? 'Aucun résultat' : 'Aucun colis retourné'}
          </h3>
          <p className="text-gray-400 text-sm max-w-xs mx-auto">
            {search
              ? `Aucun retour ne correspond à "${search}"`
              : 'Tous vos retours logistiques apparaîtront sur cette page dédiée.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(parcel => {
            const status = statusConfig[parcel.status] || { label: parcel.status, color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200', icon: Package };
            const StatusIcon = status.icon;
            const isExpanded = expandedId === parcel.id;

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
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-rose-100 rounded-full flex items-center justify-center text-orange-700 font-black text-base flex-shrink-0">
                          {parcel.customerName.charAt(0).toUpperCase()}
                        </div>
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
                        {(parcel.vendorName || parcel.vendorEmail) && (
                          <span className="flex items-center gap-1.5 text-purple-700 bg-purple-50 px-2 py-1 rounded-md text-[11px] font-bold border border-purple-100">
                            👤 Référent: {parcel.vendorName || '—'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Center: Coliaty Code */}
                    <div className="flex-shrink-0">
                      {parcel.coliatyPackageCode ? (
                        <div className="bg-gradient-to-br from-orange-50 to-rose-50 border border-orange-200 rounded-xl px-4 py-3">
                          <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-1">Code Coliaty</p>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-orange-700 text-sm tracking-wide">{parcel.coliatyPackageCode}</span>
                            <button
                              onClick={() => handleCopyCode(parcel.coliatyPackageCode!)}
                              className="p-1 rounded-lg hover:bg-orange-100 transition-colors text-orange-400 hover:text-orange-600"
                            >
                              {copiedCode === parcel.coliatyPackageCode
                                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                : <Copy className="w-3.5 h-3.5" />
                              }
                            </button>
                          </div>
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
                        
                        <div className="relative group">
                          <select
                            disabled={updatingStatusId === parcel.id}
                            value={parcel.status}
                            onChange={(e) => handleStatusUpdate(parcel.id, e.target.value)}
                            className="appearance-none pl-3 pr-8 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border border-gray-100 bg-gray-50 text-gray-400 hover:border-indigo-200 hover:text-indigo-600 transition-all cursor-pointer outline-none"
                          >
                            {Object.entries(statusConfig).map(([val, cfg]) => (
                              <option key={val} value={val}>{cfg.label}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-300 pointer-events-none" />
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border ${paymentConfig[parcel.paymentSituation]?.bg || 'bg-gray-50 border-gray-200'} ${paymentConfig[parcel.paymentSituation]?.color || 'text-gray-400'}`}>
                          💳 {paymentConfig[parcel.paymentSituation]?.label || parcel.paymentSituation}
                        </span>
                        
                        <div className="relative group">
                          <select
                            disabled={updatingPaymentId === parcel.id}
                            value={parcel.paymentSituation}
                            onChange={(e) => handlePaymentUpdate(parcel.id, parcel.leadId, e.target.value)}
                            className="appearance-none pl-3 pr-8 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border border-gray-100 bg-gray-50 text-gray-400 hover:border-blue-200 hover:text-blue-600 transition-all cursor-pointer outline-none"
                          >
                            {Object.entries(paymentConfig).map(([val, cfg]) => {
                              if (val === 'FACTURED' && parcel.paymentSituation !== 'FACTURED') return null;
                              return <option key={val} value={val}>{cfg.label}</option>;
                            })}
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-300 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  </div>

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
                          >
                            <Clock className="w-3.5 h-3.5" />
                            Suivi
                          </button>
                          <button
                            onClick={() => handleDownloadLabel(parcel.coliatyPackageCode!)}
                            disabled={downloadingCode === parcel.coliatyPackageCode}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors border border-emerald-100 disabled:opacity-50"
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
                      Produits retournés
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

      {/* History Modal */}
      {historyParcel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] overflow-hidden shadow-2xl relative flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50/30">
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-500" />
                  Suivi du Colis
                </h3>
                <p className="text-xs text-gray-500 font-bold mt-1 uppercase tracking-wider">CODE: {historyParcel.coliatyPackageCode}</p>
              </div>
              <button 
                onClick={() => setHistoryParcel(null)}
                className="text-gray-400 hover:text-gray-600 bg-white shadow-sm p-2 rounded-full transition-all hover:rotate-90"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
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
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple internal component to bypass lucide Search icon naming collisions
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

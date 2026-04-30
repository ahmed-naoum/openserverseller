import { useState, useEffect, useRef } from 'react';
import { leadsApi, ordersApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Package,
  MapPin,
  Phone,
  RefreshCw,
  ExternalLink,
  Truck,
  Search,
  ChevronDown,
  ChevronUp,
  Copy,
  CheckCircle2,
  Clock,
  Box
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
  PENDING: { label: 'En attente', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: Clock },
  CONFIRMED: { label: 'Confirmé', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: CheckCircle2 },
  SHIPPED: { label: 'Expédié', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200', icon: Truck },
  DELIVERED: { label: 'Livré', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
  CANCELLED: { label: 'Annulé', color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: Clock },
  RETURNED: { label: 'Retourné', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', icon: Box },
};

const historyStatusLabels: Record<string, string> = {
  'NEW_PARCEL': 'Nouveau',
  'WAITING_PICKUP': 'En attente de ramassage',
  'WAITING_PREPARATION': 'En attente de préparation',
  'ENCORE_PREPARED': 'Encore préparé',
  'PREPARED': 'Préparé',
  'PICKED_UP': 'Ramassé',
  'SENT': 'Expédié',
  'RECEIVED': 'Reçu à la destination',
  'PROGRAMMER_AUTO': 'Auto-Programmé',
  'CANCELED_BY_SELLER': 'Annulé par le vendeur',
  'CANCELED_BY_SYSTEM': 'Annulé par le système',
  'DISTRIBUTION': 'En distribution',
  'IN_PROGRESS': 'En cours',
  'DELIVERED': 'Livré',
  'RETOUR_IN_PROGRESS': 'Retour vers hub',
  'RETOUR_HUB_AVAILABLE': 'Retour disponible votre hub',
  'RETOUR_WAREHOUSE_RETURNED_IN_PROGRESS': 'Retour au stock en cours',
  'RETOUR_WAREHOUSE_RETURNED': 'Retourné au stock',
  'RETOUR_CLIENT_PREPARED_FOR_DELIVERY': 'Retour prêt à livrer',
  'RETOUR_CLIENT_DELIVERED': 'Retour livré à la clientèle',
  'DISTINATION_CHANGED': 'Destination changée',
  'INCORRECT_ADDRESS': 'Adresse incorrecte',
  'CANCELED': 'Annulé',
  'REFUSE': 'Refusé',
  'BV': 'Boite vocal',
  'UNREACHABLE': 'Injoignable',
  'CPC': 'Client pas commandé',
  'POSTPONED': 'Reporté',
  'OUT_OF_AREA': 'Hors zone',
  'NOANSWER': 'Non répondu',
  'EN_VOYAGE': 'Client en voyage',
  'CLIENT_INTERESE': 'Client intéressé',
  'INJO': 'Injoignable',
  'ERR': 'Numéro erroné',
  'PLTR': 'Rappelez plus tard',
  'CNI': 'Client pas intéressé',
  'PROGRAMMER': 'Programmé',
  'CDM': 'Colis endommagé',
  'CORRECTED_INFORMATION': 'Informations corrigées'
};

export default function AgentLivraison() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [revertingId, setRevertingId] = useState<number | null>(null);

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
    package_no_open: false
  });

  const [historyParcel, setHistoryParcel] = useState<Parcel | null>(null);
  const [parcelHistory, setParcelHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  const [lastLiveUpdate, setLastLiveUpdate] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchCities = async () => {
    setLoadingCities(true);
    try {
      const res = await leadsApi.getColiatyCities();
      setColiatyCities(res.data?.data || []);
    } catch (err) {
      console.error('Failed to load cities');
    } finally {
      setLoadingCities(false);
    }
  };

  const fetchParcels = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await leadsApi.livraison({ limit: 100 });
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
    fetchCities();

    // Open SSE stream for real-time status updates from Coliaty webhooks
    const token = localStorage.getItem('accessToken');
    if (token) {
      const API_URL = (import.meta.env as any).VITE_API_URL || 'http://localhost:3001/api/v1';
      const es = new EventSource(`${API_URL}/webhooks/stream?token=${token}`);
      eventSourceRef.current = es;

      es.addEventListener('connected', () => {
        setLiveConnected(true);
      });

      es.addEventListener('status_update', (e) => {
        const data = JSON.parse(e.data);
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
    }

    return () => {
      eventSourceRef.current?.close();
    };
  }, []);


  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      toast.success('Code copié !');
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  const handleRevertToLead = async (id: number) => {
    // We remove window.confirm to prevent silent abortion in strict browsers.
    setRevertingId(id);
    try {
      await ordersApi.revertToLead(id);
      toast.success('Colis annulé et retourné aux leads !');
      fetchParcels();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'annulation du colis');
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
      price: parcel.totalAmountMad.toString(),
      note: '',
      city: parcel.customerCity,
      address: parcel.customerAddress,
      package_content: parcel.packageContent || '',
      package_no_open: parcel.packageNoOpen || false
    });
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

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParcel) return;

    setEditingSubmit(true);
    
    try {
      if (editMode === 'relance') {
        const isCityOrAddressChanged = 
          editForm.city !== editingParcel.customerCity || 
          editForm.address !== editingParcel.customerAddress;

        const request_type = isCityOrAddressChanged ? 'CHANGE_DESTINATION' : 'CORRECT_INFORMATION';

        await ordersApi.changeDemand(editingParcel.id, {
          package_code: editingParcel.coliatyPackageCode,
          request_type,
          package_reciever: editForm.name,
          package_phone: editForm.phone,
          package_price: Number(editForm.price),
          package_note: editForm.note,
          package_city: editForm.city,
          package_address: editForm.address
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
          package_no_open: editForm.package_no_open
        });
        toast.success('Colis modifié avec succès !');
      }

      setEditingParcel(null);
      fetchParcels();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'opération');
    } finally {
      setEditingSubmit(false);
    }
  };

  const filtered = parcels.filter(p => {
    const matchesSearch = !search ||
      p.customerName.toLowerCase().includes(search.toLowerCase()) ||
      p.customerPhone.includes(search) ||
      p.customerCity.toLowerCase().includes(search.toLowerCase()) ||
      (p.coliatyPackageCode || '').toLowerCase().includes(search.toLowerCase()) ||
      p.orderNumber.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = selectedStatus === 'ALL' || p.status === selectedStatus;
    
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: parcels.length,
    withColiaty: parcels.filter(p => p.coliatyPackageCode).length,
    pending: parcels.filter(p => p.status === 'PENDING').length,
    delivered: parcels.filter(p => p.status === 'DELIVERED').length,
  };

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
        </div>
      </div>

      {/* Stats Cards */}
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

      {/* Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, téléphone, ville, code Coliaty..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all shadow-sm"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          <button
            onClick={() => setSelectedStatus('ALL')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
              selectedStatus === 'ALL'
                ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                : 'bg-white text-gray-500 border-gray-100 hover:border-gray-200'
            }`}
          >
            Tous
          </button>
          {Object.entries(statusConfig).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setSelectedStatus(key)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                selectedStatus === key
                  ? `${config.bg.replace('bg-', 'bg-').split(' ')[0]} ${config.color} ${config.bg.split(' ')[1]} shadow-sm`
                  : 'bg-white text-gray-500 border-gray-100 hover:border-gray-200'
              }`}
            >
              {config.label}
              <span className="ml-1.5 px-1.5 py-0.5 bg-white/50 rounded-md text-[10px] opacity-70">
                {parcels.filter(p => p.status === key).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Parcels List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-gray-400 text-sm font-medium">Chargement des livraisons...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <Truck className="w-10 h-10 text-indigo-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">
            {search ? 'Aucun résultat' : 'Aucune livraison'}
          </h3>
          <p className="text-gray-400 text-sm max-w-xs mx-auto">
            {search
              ? `Aucun colis ne correspond à "${search}"`
              : 'Envoyez des commandes à la livraison depuis la page "Mes Prospects" et elles apparaîtront ici.'}
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
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center text-indigo-700 font-black text-base flex-shrink-0">
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
                        {parcel.packageNoOpen && (
                          <span className="flex items-center gap-1.5 text-red-600 bg-red-50 px-2 py-0.5 rounded-md text-[11px] font-bold">
                            🚫 Ne pas ouvrir
                          </span>
                        )}
                        {(parcel.vendorName || parcel.vendorEmail) && (
                          <span className="flex items-center gap-1.5 text-purple-700 bg-purple-50 px-2 py-1 rounded-md text-[11px] font-bold border border-purple-100">
                            👤 Référent: {parcel.vendorName || '—'}{parcel.vendorEmail ? ` · ${parcel.vendorEmail}` : ''}
                          </span>
                        )}
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
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${status.bg} ${status.color}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {status.label}
                      </span>
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
                        <>
                          <button
                            onClick={() => handleOpenEdit(parcel, 'relance')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-xs font-bold hover:bg-orange-100 hover:text-orange-700 transition-colors border border-orange-200 shadow-sm"
                            title="Créer une demande de Relance / Changement de destination"
                          >
                            🔄 Relance
                          </button>
                          
                          {parcel.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleOpenEdit(parcel, 'edit')}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 hover:text-blue-700 transition-colors border border-blue-200 shadow-sm"
                                title="Éditer directement ce colis (Optionnel: Nouveaux colis uniquement)"
                              >
                                ✏️ Éditer colis
                              </button>
                              <button
                                onClick={() => handleRevertToLead(parcel.id)}
                                disabled={revertingId === parcel.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 hover:text-red-700 transition-colors border border-red-200 shadow-sm disabled:opacity-50"
                              >
                                {revertingId === parcel.id ? '⏳ Annulation...' : '❌ Annuler le colis Coliaty'}
                              </button>
                            </>
                          )}
                        </>
                      )}
                      
                        {parcel.coliatyPackageCode && (
                          <button
                            onClick={() => handleOpenHistory(parcel)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors border border-indigo-100"
                            title="Voir l'historique du colis"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            Historique
                          </button>
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
                      <Box className="w-4 h-4 text-gray-400" />
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
                              <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase rounded border border-indigo-100">
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
      
      {/* Edit Modal */}
      {editingParcel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden animate-slide-up">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                {editMode === 'relance' ? '🔄 Relancer le Colis' : '✏️ Modifier le Colis'}
              </h3>
              <button 
                onClick={() => setEditingParcel(null)}
                className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-all"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className={`p-3 rounded-lg border mb-4 ${editMode === 'relance' ? 'bg-orange-50 border-orange-100' : 'bg-blue-50 border-blue-100'}`}>
                <p className={`text-xs ${editMode === 'relance' ? 'text-orange-700' : 'text-blue-700'}`}>
                  {editMode === 'relance' 
                    ? "Demander une relance ou modifier la destination pour un colis déjà en cours." 
                    : "Modification directe des informations du colis (Réservé aux Nouveaux colis)."}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du Destinataire</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <input
                  type="tel"
                  required
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prix à payer (MAD)</label>
                <input
                  type="number"
                  required
                  value={editForm.price}
                  onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contenu du Colis</label>
                <input
                  type="text"
                  value={editForm.package_content}
                  onChange={(e) => setEditForm({ ...editForm, package_content: e.target.value })}
                  placeholder="Ex: Marchandise, Vetements, etc."
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {editMode === 'edit' && (
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.package_no_open}
                      onChange={(e) => setEditForm({ ...editForm, package_no_open: e.target.checked })}
                      className="w-4 h-4 text-blue-500 rounded border-gray-300 focus:ring-blue-500"
                    />
                    Interdire Ouverture
                  </label>
                </div>
              )}

              <div className="pt-3 border-t border-gray-100">
                <h4 className="text-sm font-bold text-gray-800 mb-3">Changement de Destination</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                    {loadingCities ? (
                      <div className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 animate-pulse">
                        Chargement des villes...
                      </div>
                    ) : (
                      <select
                        required
                        value={editForm.city}
                        onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none max-h-48 overflow-y-auto"
                      >
                        <option value="">Sélectionner une ville...</option>
                        {coliatyCities.map((city) => (
                          <option key={city.city_id} value={city.city_name}>
                            {city.city_name} (Hub: {city.hub_name})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adresse Complète</label>
                    <input
                      type="text"
                      required
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
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
                  className="flex-1 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {editingSubmit ? '⏳ Enregistrement...' : '💾 Enregistrer les modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyParcel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] overflow-hidden shadow-2xl relative animate-slide-up flex flex-col">
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
        </div>
      )}
    </div>
  );
}

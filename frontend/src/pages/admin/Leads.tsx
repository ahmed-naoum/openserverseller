import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { leadsApi, productsApi } from '../../lib/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { 
  Users, Search, Filter, Download, 
  ChevronLeft, ChevronRight, 
  Phone, MapPin, Calendar, Tag, Headphones,
  Trash2, Edit, CheckCircle2, Clock, Box, AlertCircle, Truck,
  ChevronDown, ChevronUp, MousePointerClick, UserCheck, ShoppingCart, Package, X, ExternalLink, Eye
} from 'lucide-react';

const STATUS_BADGES: Record<string, { label: string; color: string; icon: any }> = {
  NEW: { label: 'Nouveau', color: 'bg-slate-50 text-slate-600 border-slate-100', icon: Clock },
  AVAILABLE: { label: 'Disponible', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: CheckCircle2 },
  ASSIGNED: { label: 'Au Call Center', icon: Headphones, color: 'bg-cyan-50 text-cyan-600 border-cyan-100' },
  CONTACTED: { label: 'Contacté', icon: Phone, color: 'bg-amber-50 text-amber-600 border-amber-100' },
  INTERESTED: { label: 'Intéressé', icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  ORDERED: { label: 'Commandé', icon: Tag, color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  CALLBACK_REQUESTED: { label: 'Rappel demandé', icon: Clock, color: 'bg-orange-50 text-orange-600 border-orange-100' },
  NOT_INTERESTED: { label: 'Pas intéressé', icon: AlertCircle, color: 'bg-rose-50 text-rose-600 border-rose-100' },
  UNREACHABLE: { label: 'Injoignable', icon: AlertCircle, color: 'bg-slate-100 text-slate-400 border-slate-200' },
  INVALID: { label: 'Invalide', icon: AlertCircle, color: 'bg-rose-50 text-rose-600 border-rose-100' },
  PUSHED_TO_DELIVERY: { label: 'En livraison', icon: Truck, color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
};

const DETAILED_STATUS_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  NEW: { label: 'Nouveau', icon: '🆕', color: 'bg-blue-50 text-blue-600' },
  AVAILABLE: { label: 'Disponible', icon: '🟢', color: 'bg-emerald-50 text-emerald-600' },
  ASSIGNED: { label: 'Assigné', icon: '👤', color: 'bg-purple-50 text-purple-600' },
  CONTACTED: { label: 'Contacté', icon: '📞', color: 'bg-blue-50 text-blue-600' },
  INTERESTED: { label: 'Intéressé', icon: '✅', color: 'bg-emerald-50 text-emerald-600' },
  ORDERED: { label: 'Commandé', icon: '🛒', color: 'bg-emerald-50 text-emerald-600' },
  CALLBACK_REQUESTED: { label: 'Rappel', icon: '🔁', color: 'bg-orange-50 text-orange-600' },
  NOT_INTERESTED: { label: 'Pas intéressé', icon: '❌', color: 'bg-rose-50 text-rose-600' },
  UNREACHABLE: { label: 'Injoignable', icon: '📵', color: 'bg-slate-50 text-slate-600' },
  INVALID: { label: 'Invalide', icon: '🚫', color: 'bg-rose-50 text-rose-600' },
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
        className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium cursor-pointer flex justify-between items-center transition-all hover:bg-gray-100/80"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate text-gray-700">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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

export default function AdminLeads() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [showStats, setShowStats] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [leadDetail, setLeadDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [coliatyHistory, setColiatyHistory] = useState<any[]>([]);
  const [loadingColiaty, setLoadingColiaty] = useState(false);
  const limit = 20;

  const { data: leadsData, isLoading, refetch } = useQuery({
    queryKey: ['admin-all-leads', { page, search, statusFilter, selectedVendorId, selectedProductId }],
    queryFn: () => leadsApi.list({ 
      page, 
      limit, 
      search, 
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      vendorId: selectedVendorId || undefined,
      productId: selectedProductId || undefined,
      viewMode: 'ALL'
    }),
  });

  const { data: vendorsRes } = useQuery({
    queryKey: ['admin-vendors'],
    queryFn: () => leadsApi.getVendors(),
  });
  const vendors = vendorsRes?.data?.data || [];

  const { data: productsRes } = useQuery({
    queryKey: ['admin-all-products'],
    queryFn: () => productsApi.list({ limit: 1000 }),
  });
  const products = productsRes?.data?.data?.products || [];

  const leads = leadsData?.data?.data?.leads || [];
  const pagination = leadsData?.data?.data?.pagination || { totalPages: 1, total: 0 };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce lead ?')) return;
    try {
      await leadsApi.delete(id.toString());
      toast.success('Lead supprimé avec succès');
      refetch();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const isColiatyRelated = (h: any) => {
    if (!h) return false;
    return (
      h.notes?.includes('Mise à jour automatique via Livraison') ||
      h.notes?.toLowerCase().includes('via coliaty') ||
      h.newStatus === 'PUSHED_TO_DELIVERY' ||
      h.newStatus === 'SHIPPED'
    );
  };

  const loadHistory = async (leadId: number, coliatyPackageCode: string | null) => {
    setSelectedLeadId(leadId);
    setLoadingDetail(true);
    setColiatyHistory([]);
    try {
      const res = await leadsApi.detail(leadId);
      const d = res.data?.data || res.data;
      setLeadDetail(d);

      if (coliatyPackageCode) {
        setLoadingColiaty(true);
        leadsApi.getParcelHistory(coliatyPackageCode).then(hRes => {
          setColiatyHistory(hRes.data?.data?.details || []);
        }).catch(() => {}).finally(() => setLoadingColiaty(false));
      }
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

  // Build status list for chips (we show all possible ones for admin)
  const allStatuses = Object.keys(STATUS_BADGES);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
             Tous les Leads
          </h1>
          <p className="text-sm text-gray-500 mt-1">Gérez et suivez tous les prospects de la plateforme.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStats(!showStats)}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all shadow-sm"
          >
            {showStats ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Statistiques
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all shadow-sm">
            <Download className="w-3.5 h-3.5" />
            Exporter CSV
          </button>
        </div>
      </div>

      {/* Stats Quick View */}
      {showStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-200/50">
            <Users className="w-7 h-7 mb-2 opacity-80" />
            <h3 className="text-2xl font-black">{pagination.total.toLocaleString()}</h3>
            <p className="text-[11px] font-medium opacity-80 mt-1 uppercase tracking-wider">Total Leads</p>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-lg shadow-orange-200/50">
            <Headphones className="w-7 h-7 mb-2 opacity-80" />
            <h3 className="text-2xl font-black">---</h3>
            <p className="text-[11px] font-medium opacity-80 mt-1 uppercase tracking-wider">En Traitement</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-5 text-white shadow-lg shadow-green-200/50">
            <CheckCircle2 className="w-7 h-7 mb-2 opacity-80" />
            <h3 className="text-2xl font-black">---</h3>
            <p className="text-[11px] font-medium opacity-80 mt-1 uppercase tracking-wider">Confirmés</p>
          </div>
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg shadow-indigo-200/50">
            <Truck className="w-7 h-7 mb-2 opacity-80" />
            <h3 className="text-2xl font-black">---</h3>
            <p className="text-[11px] font-medium opacity-80 mt-1 uppercase tracking-wider">En Livraison</p>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, téléphone, ville..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary-500 transition-all font-medium text-sm"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex gap-2">
            <SearchableSelect
              className="w-full sm:w-[200px]"
              placeholder="Tous les comptes"
              value={selectedVendorId}
              onChange={(val) => { setSelectedVendorId(val); setPage(1); }}
              options={vendors.map((v: any) => ({
                id: v.id,
                label: v.profile?.fullName || v.fullName || v.email
              }))}
            />
            <SearchableSelect
              className="w-full sm:w-[200px]"
              placeholder="Tous les produits"
              value={selectedProductId}
              onChange={(val) => { setSelectedProductId(val); setPage(1); }}
              options={products.map((p: any) => ({
                id: p.id,
                label: p.nameFr || p.nameAr || p.name
              }))}
            />
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setStatusFilter('ALL'); setPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
              statusFilter === 'ALL'
                ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Tout ({pagination.total})
          </button>
          {allStatuses.map(status => {
            const badge = STATUS_BADGES[status];
            const IconComp = badge.icon;
            const isActive = statusFilter === status;
            return (
              <button
                key={status}
                onClick={() => { setStatusFilter(status); setPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                  isActive
                    ? `${badge.color} border-current shadow-md`
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <IconComp className="w-3 h-3" />
                {badge.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary-500" />
            {statusFilter === 'ALL' ? 'Tous les Leads' : STATUS_BADGES[statusFilter]?.label}
            <span className="text-gray-400 font-medium">({leads.length})</span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Client</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Produit</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Montant</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Agent</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Propriétaire</th>
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                <th className="px-5 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={8} className="px-5 py-4"><div className="h-10 bg-gray-100 rounded-lg w-full"></div></td>
                  </tr>
                ))
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-gray-400 font-medium">
                    <Package className="w-12 h-12 mx-auto text-gray-100 mb-3" />
                    Aucun lead trouvé
                  </td>
                </tr>
              ) : (
                leads.map((lead: any) => {
                  const statusInfo = STATUS_BADGES[lead.status] || { label: lead.status, color: 'bg-gray-100 text-gray-800', icon: Clock };
                  const StatusIcon = statusInfo.icon;
                  const productImage = lead.product?.image;
                  
                  return (
                    <tr key={lead.id} className="hover:bg-gray-50/50 transition-colors group">
                      {/* Client */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-900">{lead.fullName}</span>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                            <span className="flex items-center gap-1"><Phone className="w-2.5 h-2.5" /> {lead.phone}</span>
                            <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {lead.city || '-'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Produit */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {productImage ? (
                            <img src={productImage} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0 shadow-sm" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <Package className="w-4 h-4 text-gray-400" />
                            </div>
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold text-gray-900 truncate">{lead.product?.name || '-'}</span>
                            {lead.productVariant && (
                              <span className="text-[10px] font-black text-primary-600 truncate uppercase tracking-tighter bg-primary-50 px-1.5 py-0.5 rounded-md w-fit mt-0.5">
                                {lead.productVariant}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Montant */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-gray-900 tracking-tight">
                            {lead.productPrice > 0 ? `${Number(lead.productPrice).toFixed(2)} MAD` : '-'}
                          </span>
                          {lead.product?.price && Math.abs(lead.productPrice - lead.product.price) > 0.01 && (
                            <span className="text-[10px] text-gray-400 line-through font-medium">
                              {Number(lead.product.price).toFixed(2)} MAD
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1.5 items-start">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${statusInfo.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusInfo.label}
                          </span>
                          {lead.coliatyPackageCode && (
                            <span className="flex items-center gap-1 text-[9px] font-bold text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100 w-fit">
                              <Box className="w-2.5 h-2.5" />
                              {lead.coliatyPackageCode}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Agent */}
                      <td className="px-5 py-4">
                        {lead.assignedAgent ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center text-[10px] font-black text-purple-600 shadow-sm border border-white">
                              {lead.assignedAgent.fullName?.charAt(0) || 'A'}
                            </div>
                            <span className="text-xs font-bold text-gray-600">{lead.assignedAgent.fullName}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-gray-300 uppercase italic tracking-wider">Non assigné</span>
                        )}
                      </td>

                      {/* Propriétaire */}
                      <td className="px-5 py-4">
                        {lead.vendor ? (
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-gray-900">{lead.vendor.fullName}</span>
                            {lead.vendor.phone && (
                              <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1 mt-0.5">
                                <Phone className="w-2.5 h-2.5 text-cyan-500" /> {lead.vendor.phone}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-gray-300 uppercase italic tracking-wider">Aucun</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col text-[11px] text-gray-500 font-medium">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> 
                            {format(new Date(lead.createdAt), 'dd MMM yyyy')}
                          </span>
                          <span className="flex items-center gap-1 mt-0.5 opacity-60">
                            <Clock className="w-3 h-3" /> 
                            {format(new Date(lead.createdAt), 'HH:mm')}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleDelete(lead.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => loadHistory(lead.id, lead.coliatyPackageCode)}
                            className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-all" 
                            title="Historique & Détails"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-5 border-t border-gray-100 flex items-center justify-between bg-gray-50/30">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
              {leads.length} sur {pagination.total} leads
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 disabled:opacity-30 hover:bg-gray-50 transition-all shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, pagination.totalPages) }).map((_, i) => {
                  let pageNum = i + 1;
                  if (pagination.totalPages > 5 && page > 3) {
                    pageNum = page - 2 + i;
                    if (pageNum > pagination.totalPages) pageNum = pagination.totalPages - (4 - i);
                    if (pageNum < 1) pageNum = i + 1;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all shadow-sm ${
                        page === pageNum
                          ? 'bg-primary-500 text-white shadow-primary-200 border-primary-500'
                          : 'bg-white border border-gray-200 text-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                disabled={page === pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 disabled:opacity-30 hover:bg-gray-50 transition-all shadow-sm"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

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
                      <div className="flex items-center gap-4 text-white/80 text-xs mt-1 font-medium">
                        <span className="flex items-center gap-1"><Phone size={12} /> {leadDetail.lead?.phone}</span>
                        <span className="flex items-center gap-1"><MapPin size={12} /> {leadDetail.lead?.city || 'Ville non spécifiée'}</span>
                      </div>
                    </div>
                    <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Statut actuel</p>
                        <div className="mt-1.5">{getDetailedStatusBadge(leadDetail.lead?.status)}</div>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Agent</p>
                        <p className="text-sm font-bold text-gray-700 mt-1">
                          {leadDetail.lead?.assignedAgent?.profile?.fullName || 'Non assigné'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Influenceur / Affilié</p>
                        <p className="text-sm font-bold text-gray-700 mt-1">
                          {leadDetail.influencer?.fullName || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Créé le</p>
                        <p className="text-sm font-bold text-gray-700 mt-1">
                          {leadDetail.lead?.createdAt ? format(new Date(leadDetail.lead.createdAt), 'dd MMM yyyy HH:mm') : '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Status History Timeline */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="font-bold text-gray-900 flex items-center gap-2">
                          🔄 Historique Interne
                        </h2>
                        <span className="text-xs font-black text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                          {(leadDetail.lead?.statusHistory || []).filter((h: any) => !isColiatyRelated(h)).length} changements
                        </span>
                      </div>

                      {((leadDetail.lead?.statusHistory || []).filter((h: any) => !isColiatyRelated(h)).length === 0) ? (
                        <div className="bg-gray-50 rounded-xl p-8 text-center border border-dashed border-gray-200">
                          <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-gray-500 text-sm font-medium">Aucun changement de statut interne enregistré.</p>
                        </div>
                      ) : (
                        <div className="space-y-4 pt-2 relative">
                          <div className="absolute left-1.5 top-2 bottom-4 w-px bg-gray-200"></div>
                          {(leadDetail.lead?.statusHistory || []).filter((h: any) => !isColiatyRelated(h)).map((h: any, index: number) => {
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
                                      {format(new Date(h.createdAt), 'dd MMM yyyy • HH:mm:ss')}
                                    </span>
                                  </div>
                                  {h.changer && (
                                    <p className="text-[11px] text-purple-600 font-bold mt-2 flex items-center gap-1.5">
                                      <div className="w-4 h-4 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 text-[8px]">
                                        {h.changer.profile?.fullName?.charAt(0) || h.changer.email?.charAt(0) || '?'}
                                      </div>
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

                      {!leadDetail.lead?.order?.coliatyPackageCode && (leadDetail.lead?.statusHistory || []).filter(isColiatyRelated).length === 0 ? (
                        <div className="bg-gray-50 rounded-xl p-8 text-center border border-dashed border-gray-200">
                          <Box className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-gray-500 text-sm font-medium">Ce lead n'a pas encore été expédié via Coliaty.</p>
                        </div>
                      ) : loadingColiaty ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                          <div className="w-8 h-8 border-3 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
                          <p className="text-gray-400 text-sm font-medium">Récupération de l'historique Coliaty...</p>
                        </div>
                      ) : coliatyHistory.length === 0 && (leadDetail.lead?.statusHistory || []).filter(isColiatyRelated).length === 0 ? (
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
                                    {format(new Date(entry.HISTORY_TIMESTAMP * 1000), "dd MMM yyyy 'à' HH:mm")}
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

                          {/* Add Webhook History (from system) */}
                          {(leadDetail.lead?.statusHistory || []).filter(isColiatyRelated).map((h: any, idx: number) => {
                            const newS = DETAILED_STATUS_LABELS[h.newStatus] || { label: h.newStatus, icon: '', color: 'bg-gray-100 text-gray-800' };
                            return (
                              <div key={`webhook-${h.id || idx}`} className="relative">
                                <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                                  idx === 0 && coliatyHistory.length === 0 ? 'bg-indigo-500 scale-125' : 'bg-indigo-200'
                                }`} />
                                
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center justify-between">
                                    <span className={`text-[11px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-md ${
                                      idx === 0 && coliatyHistory.length === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                      {h.notes?.includes('Mise à jour automatique') ? 'Mise à jour automatique' : 'Action Système'}
                                    </span>
                                    <span className="text-[10px] font-bold text-gray-400">
                                      {format(new Date(h.createdAt), "dd MMM yyyy 'à' HH:mm")}
                                    </span>
                                  </div>
                                  
                                  <div className="bg-gray-50 rounded-2xl p-4 mt-2 border border-white shadow-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider ${newS.color}`}>
                                        {newS.icon} {newS.label}
                                      </span>
                                    </div>
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
    </div>
  );
}

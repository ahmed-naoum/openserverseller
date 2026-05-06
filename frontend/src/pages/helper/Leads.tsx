import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import {
  Users, Plus, Search, Edit2, X, Save, ChevronLeft, ChevronRight,
  DollarSign, CheckCircle, AlertCircle, FileText, RefreshCw, ChevronDown, ShieldAlert,
  Calendar, Clock, Truck
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface Lead {
  id: number;
  fullName: string;
  phone: string;
  whatsapp?: string;
  city?: string;
  address?: string;
  status: string;
  paymentSituation?: string;
  notes?: string;
  coliatyPackageCode?: string | null;
  brand?: { id: number; name: string } | null;
  vendor?: { id: number; fullName?: string; email: string; profile?: { fullName?: string } } | null;
  createdAt: string;
  productVariant?: string;
  productPrice?: number;
  order?: { totalAmountMad: number; coliatyPackageCode?: string; orderNumber?: string };
}

interface Vendor { id: number; fullName?: string; email?: string; role?: string }

// ─── Constants ───────────────────────────────────────────────────────────────
const LEAD_STATUSES = [
  'NEW', 'ASSIGNED', 'CONTACTED', 'INTERESTED', 'NOT_INTERESTED',
  'CALL_LATER', 'CONFIRMED', 'UNREACHABLE', 'INVALID',
];

const ALL_STATUSES = [
  'NEW', 'ASSIGNED', 'CALL_LATER', 'NO_REPLY', 'CONTACTED', 'INTERESTED', 'NOT_INTERESTED',
  'CONFIRMED', 'ORDERED', 'PUSHED_TO_DELIVERY', 'UNREACHABLE', 
  'WRONG_ORDER', 'CANCEL_REASON_PRICE', 'CANCEL_ORDER', 'INVALID',
];

const PAYMENT_SITUATIONS = [
  { value: 'NOT_PAID', label: 'Non Payé', color: 'bg-rose-100 text-rose-700' },
  { value: 'PAID',     label: 'Payé',     color: 'bg-emerald-100 text-emerald-700' },
  { value: 'FACTURED', label: 'Facturé',  color: 'bg-blue-100 text-blue-700' },
];

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-slate-50 text-slate-600 border-slate-100',
  ASSIGNED: 'bg-purple-50 text-purple-600 border-purple-100',
  CALL_LATER: 'bg-orange-50 text-orange-600 border-orange-100',
  NO_REPLY: 'bg-rose-50 text-rose-500 border-rose-100',
  CONTACTED: 'bg-amber-50 text-amber-700 border-amber-100',
  INTERESTED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  NOT_INTERESTED: 'bg-rose-50 text-rose-700 border-rose-100',
  CALLBACK_REQUESTED: 'bg-orange-50 text-orange-700 border-orange-100',
  CONFIRMED: 'bg-blue-50 text-blue-600 border-blue-100',
  ORDERED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  PUSHED_TO_DELIVERY: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  UNREACHABLE: 'bg-slate-100 text-slate-500 border-slate-200',
  WRONG_ORDER: 'bg-rose-50 text-rose-500 border-rose-100',
  CANCEL_REASON_PRICE: 'bg-rose-50 text-rose-600 border-rose-100',
  CANCEL_ORDER: 'bg-rose-100 text-rose-700 border-rose-200',
  INVALID: 'bg-rose-100 text-rose-600 border-rose-200',
};

// ─── Empty form state ─────────────────────────────────────────────────────────
const emptyForm = () => ({
  fullName: '', phone: '', whatsapp: '', city: '', address: '', notes: '', vendorId: '',
});

// ─── Main Component ───────────────────────────────────────────────────────────
export default function HelperLeads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [agents, setAgents] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  // Permission Guard
  if (user?.role === 'HELPER' && !user?.canManageLeads) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mb-6 animate-bounce">
          <ShieldAlert size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Accès Non Autorisé</h2>
        <p className="text-slate-500 max-w-md mb-8">
          Vous n'avez pas la permission de gérer les leads. Veuillez contacter un administrateur pour obtenir l'accès.
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
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modal state
  const [showCreate, setShowCreate] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [callbackModal, setCallbackModal] = useState<{ lead: Lead; date: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [selectedLeadForDelivery, setSelectedLeadForDelivery] = useState<Lead | null>(null);
  const [coliatyCities, setColiatyCities] = useState<any[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [isPushingDelivery, setIsPushingDelivery] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({
    name: '',
    phone: '',
    city: '',
    address: '',
    price: 0,
    package_no_open: false,
    productVariant: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [expandedNotes, setExpandedNotes] = useState<number | null>(null);

  // Fetch leads
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ 
        page: String(page), 
        limit: '20'
      });
      
      if (statusFilter) {
        if (statusFilter === 'ALL') {
        } else if (statusFilter === 'ACTIVE') {
          params.set('excludeProcessed', 'true');
        } else {
          params.set('status', statusFilter);
        }
      }

      if (search) params.set('search', search);
      if (vendorFilter) params.set('vendorId', vendorFilter);
      const res = await api.get(`/leads?${params}`);
      setLeads(res.data.data.leads);
      setTotalPages(res.data.data.pagination.totalPages);
      setTotal(res.data.data.pagination.total);
    } catch {
      toast.error('Erreur chargement leads');
    } finally { setLoading(false); }
  }, [page, search, vendorFilter, statusFilter]);

  const loadCities = async () => {
    if (coliatyCities.length > 0) return;
    setLoadingCities(true);
    try {
      const res = await api.get('/leads/coliaty/cities');
      if (res.data?.data) setColiatyCities(res.data.data);
    } catch (err) {
      toast.error('Erreur villes Coliaty');
    } finally { setLoadingCities(false); }
  };

  const handleOpenDeliveryModal = (lead: Lead) => {
    setSelectedLeadForDelivery(lead);
    setDeliveryForm({
      name: lead.fullName || '',
      phone: lead.phone || '',
      city: lead.city || '',
      address: lead.address || '',
      price: (lead as any).productPrice || 0,
      package_no_open: false,
      productVariant: lead.productVariant || ''
    });
    setShowDeliveryModal(true);
    setFormErrors({});
    loadCities();
  };

  const validateDeliveryForm = () => {
    const errors: Record<string, string> = {};
    if (!deliveryForm.name || deliveryForm.name.trim().length < 3) errors.name = "Min. 3 caractères";
    const phoneDigits = deliveryForm.phone.replace(/\D/g, '');
    if (!phoneDigits.startsWith('0') || phoneDigits.length !== 10) errors.phone = "Format 06XXXXXXXX";
    if (!deliveryForm.city) errors.city = "Obligatoire";
    if (!deliveryForm.address || deliveryForm.address.trim().length < 10) errors.address = "Adresse trop courte";
    if (deliveryForm.price <= 0) errors.price = "Prix > 0";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleConfirmDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadForDelivery) return;
    if (!validateDeliveryForm()) return toast.error('Veuillez corriger les erreurs');
    
    setIsPushingDelivery(true);
    try {
      await api.post(`/leads/${selectedLeadForDelivery.id}/push-to-delivery`, {
        productId: (selectedLeadForDelivery as any).product?.id || 0,
        package_reciever: deliveryForm.name,
        package_phone: deliveryForm.phone,
        package_city: deliveryForm.city,
        package_addresse: deliveryForm.address,
        package_price: deliveryForm.price,
        package_no_open: deliveryForm.package_no_open,
        productVariant: deliveryForm.productVariant
      });
      toast.success('Lead envoyé à Coliaty !');
      setShowDeliveryModal(false);
      fetchLeads();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'envoi');
    } finally { setIsPushingDelivery(false); }
  };

  const fetchVendors = useCallback(async () => {
    try {
      const res = await api.get('/users?limit=200');
      const allUsers = res.data.data.users || [];
      setVendors(allUsers);
      setAgents(allUsers.filter((u: any) => u.role === 'CALL_CENTER_AGENT'));
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const openCreate = () => { setForm(emptyForm()); setShowCreate(true); };
  const openEdit = (lead: Lead) => {
    setEditLead(lead);
    setForm({
      fullName: lead.fullName,
      phone: lead.phone,
      whatsapp: lead.whatsapp || '',
      city: lead.city || '',
      address: lead.address || '',
      notes: lead.notes || '',
      vendorId: lead.vendor?.id ? String(lead.vendor.id) : '',
    });
  };
  const closeModals = () => { setShowCreate(false); setEditLead(null); setShowDeliveryModal(false); };

  const [form, setForm] = useState(emptyForm());

  const handleCreate = async () => {
    if (!form.fullName || !form.phone) return toast.error('Nom et téléphone requis');
    if (!form.vendorId) return toast.error('Veuillez sélectionner un vendeur');
    setSaving(true);
    try {
      await api.post('/leads', { ...form, vendorId: Number(form.vendorId) });
      toast.success('Lead créé avec succès');
      closeModals();
      fetchLeads();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erreur lors de la création');
    } finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!editLead) return;
    setSaving(true);
    try {
      await api.patch(`/leads/${editLead.id}`, form);
      toast.success('Lead mis à jour');
      closeModals();
      fetchLeads();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erreur lors de la mise à jour');
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (lead: Lead, status: string) => {
    if (status === 'CALL_LATER') {
      setCallbackModal({ lead, date: '' });
      return;
    }
    try {
      await api.patch(`/leads/${lead.id}/status`, { status });
      toast.success('Statut mis à jour');
      fetchLeads();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erreur statut');
    }
  };

  const handleConfirmCallback = async () => {
    if (!callbackModal || !callbackModal.date) return toast.error('Veuillez sélectionner une date');
    setSaving(true);
    try {
      const isoDate = new Date(callbackModal.date).toISOString();
      await api.patch(`/leads/${callbackModal.lead.id}/status`, { 
        status: 'CALL_LATER',
        callbackAt: isoDate
      });
      toast.success('Rappel programmé');
      setCallbackModal(null);
      fetchLeads();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erreur rappel');
    } finally { setSaving(false); }
  };

  const handleAssignAgent = async (leadId: number, agentId: string) => {
    if (!agentId) return;
    try {
      await api.post(`/leads/${leadId}/assign`, { agentId: Number(agentId) });
      toast.success('Agent assigné');
      fetchLeads();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erreur assignment');
    }
  };


  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <Users className="text-indigo-600" size={32} /> Tous les Leads
          </h1>
          <p className="text-gray-500 mt-1">{total} leads au total</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchLeads}
            className="p-3 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 text-gray-400 transition-all shadow-sm"
            title="Actualiser"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-600/20 transition-all hover:scale-105"
          >
            <Plus size={18} /> Nouveau Lead
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-[2]">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, téléphone, ville ou adresse..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 shadow-sm transition-all"
          />
        </div>
        <div className="relative flex-1">
          <Users size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            value={vendorFilter}
            onChange={(e) => { setVendorFilter(e.target.value); setPage(1); }}
            className="w-full pl-11 pr-10 py-3 bg-white border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 shadow-sm appearance-none transition-all"
          >
            <option value="">Tous les Comptes</option>
            {vendors.map(v => (
              <option key={v.id} value={v.id}>
                {v.fullName || v.email} {v.role ? `(${v.role})` : ''}
              </option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
            <ChevronDown size={16} />
          </div>
        </div>
        <div className="relative flex-1">
          <RefreshCw size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className={`w-full pl-11 pr-10 py-3 bg-white border border-gray-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 shadow-sm appearance-none transition-all ${statusFilter ? STATUS_COLORS[statusFilter] : 'text-gray-500'}`}
          >
            <option value="ALL">🌍 Tous les Leads</option>
            <option value="ACTIVE">🚀 Leads Actifs</option>
            <optgroup label="Filtrer par statut" className="bg-gray-50 text-gray-400 text-[10px] uppercase font-black">
              {ALL_STATUSES.map(s => (
                <option key={s} value={s} className="bg-white text-gray-900 font-bold">
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </optgroup>
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
            <ChevronDown size={16} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400 text-sm font-medium">Chargement des données...</div>
        ) : leads.length === 0 ? (
          <div className="p-10 text-center text-gray-400">Aucun lead trouvé.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/30">
                  <th className="px-6 py-4 text-left whitespace-nowrap">Infos Client & Notes</th>
                  <th className="px-4 py-4 text-left whitespace-nowrap">Contact & Livraison</th>
                  <th className="px-4 py-4 text-left whitespace-nowrap">Option</th>
                  <th className="px-4 py-4 text-left whitespace-nowrap">Source / Vendeur</th>
                  <th className="px-4 py-4 text-left whitespace-nowrap">Agent / Statut</th>
                  <th className="px-4 py-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="px-6 py-4 align-top w-1/3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900 text-[15px]">{lead.fullName}</p>
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono font-bold">#{lead.id}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-1">
                          Créé le {new Date(lead.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {lead.notes && (
                          <div 
                            className={`mt-1 p-2 rounded-xl bg-amber-50/50 border border-amber-100/50 text-xs text-amber-800 ${expandedNotes === lead.id ? '' : 'line-clamp-2 cursor-pointer hover:bg-amber-50'}`}
                            onClick={() => setExpandedNotes(expandedNotes === lead.id ? null : lead.id)}
                          >
                            <span className="font-bold text-amber-600 mr-1">Notes:</span>
                            {lead.notes}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-1.5">
                        <p className="text-sm text-gray-700 font-mono font-bold bg-gray-50 px-2 py-0.5 rounded inline-flex w-fit">
                          📞 {lead.phone}
                        </p>
                        {lead.whatsapp && lead.whatsapp !== lead.phone && (
                          <p className="text-[11px] text-emerald-600 font-mono font-bold">
                            💬 WA: {lead.whatsapp}
                          </p>
                        )}
                        <div className="mt-1">
                          <p className="text-xs text-gray-600 font-semibold">{lead.city || 'Ville non spécifiée'}</p>
                          {lead.address && <p className="text-[11px] text-gray-400 leading-tight mt-0.5 line-clamp-2" title={lead.address}>{lead.address}</p>}
                        </div>
                        {lead.coliatyPackageCode && (
                          <div className="mt-2 bg-indigo-50/50 border border-indigo-100 rounded-lg px-2 py-1 w-fit">
                            <span className="text-[9px] font-black tracking-widest text-indigo-400 uppercase block mb-0.5">Code Coliaty</span>
                            <span className="text-xs font-mono font-bold text-indigo-700">{lead.coliatyPackageCode}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top w-[120px]">
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black tracking-widest text-gray-400 uppercase mb-1">Pack</span>
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border w-fit ${lead.productVariant ? 'text-indigo-600 bg-indigo-50/50 border-indigo-100' : 'text-gray-400 bg-gray-50 border-gray-100'}`}>
                             {lead.productVariant || 'N/A'}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black tracking-widest text-gray-400 uppercase mb-1">Prix</span>
                          <span className="text-[13px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-100 w-fit shadow-sm">
                             {(lead.productPrice || lead.order?.totalAmountMad || 0).toLocaleString()} <span className="text-[9px]">MAD</span>
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      {lead.vendor ? (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[9px] font-black tracking-widest text-gray-400 uppercase">Propriétaire</span>
                          <div className="flex items-center gap-2.5 group/vendor">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/50 border border-indigo-100 flex items-center justify-center text-indigo-600 text-[11px] font-black shadow-sm group-hover/vendor:scale-110 transition-transform">
                              {(lead.vendor.profile?.fullName || lead.vendor.fullName || lead.vendor.email).charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[11px] font-bold text-slate-700 leading-none">
                                {lead.vendor.profile?.fullName || lead.vendor.fullName || lead.vendor.email}
                              </span>
                              <span className="text-[9px] text-gray-400 mt-0.5">{lead.vendor.email}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5 opacity-40">
                          <span className="text-[9px] font-black tracking-widest text-gray-400 uppercase">Propriétaire</span>
                          <span className="text-xs text-gray-400 italic font-medium">Non assigné</span>
                        </div>
                      )}
                      
                      {lead.brand && (
                        <div className="mt-3 pt-3 border-t border-gray-50 flex flex-col gap-1">
                          <span className="text-[9px] font-black tracking-widest text-purple-400 uppercase">Marque</span>
                          <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded w-fit">
                            {lead.brand.name}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Agent & Status */}
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-2">
                        {/* Agent Assignment */}
                        <div className="relative group/select">
                          <Users size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                          <select
                            value={(lead as any).assignedAgent?.id || ''}
                            onChange={(e) => handleAssignAgent(lead.id, e.target.value)}
                            className="text-[11px] font-bold pl-8 pr-6 py-1.5 rounded-lg border border-gray-100 bg-white hover:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer transition-all appearance-none w-full shadow-sm"
                          >
                            <option value="">— Assigner Agent —</option>
                            {agents.map(a => (
                              <option key={a.id} value={a.id}>{a.fullName || a.email}</option>
                            ))}
                          </select>
                          <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>

                        {/* Status Change */}
                        <div className="relative">
                          <select
                            value={lead.status}
                            onChange={(e) => handleStatusChange(lead, e.target.value)}
                            disabled={!(lead as any).assignedAgent?.id || !!lead.coliatyPackageCode}
                            className={`text-xs font-bold px-2.5 py-1.5 rounded-xl border-0 outline-none transition-all focus:ring-2 focus:ring-indigo-300 w-full shadow-sm ${STATUS_COLORS[lead.status] || 'bg-gray-100 text-gray-500'} ${(!(lead as any).assignedAgent?.id || !!lead.coliatyPackageCode) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            style={{ appearance: 'none' }}
                          >
                            {[...new Set([lead.status, ...LEAD_STATUSES.filter(s => {
                              if ((lead as any).assignedAgent?.id) {
                                return s !== 'NEW';
                              }
                              return true;
                            })])].map(s => (
                              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none" />
                        </div>

                        {/* Callback Date */}
                        {lead.status === 'CALL_LATER' && lead.callbackAt && (
                          <div className="mt-1.5 flex items-center justify-center gap-1.5 px-2.5 py-1 bg-orange-50 border border-orange-100 rounded-xl text-[10px] font-black text-orange-600 animate-pulse shadow-sm">
                            <Clock size={10} className="text-orange-400" />
                            {format(new Date(lead.callbackAt), 'dd MMM, HH:mm')}
                          </div>
                        )}

                        {/* Delivery Button */}
                        {['ORDERED', 'CONFIRMED'].includes(lead.status) && !lead.coliatyPackageCode && (
                           <button
                             onClick={() => handleOpenDeliveryModal(lead)}
                             className="w-full mt-1.5 py-1.5 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-600 transition-all shadow-md flex justify-center items-center gap-1.5 group/ship"
                           >
                             <Truck size={12} className="group-hover/ship:translate-x-1 transition-transform" />
                             Pousser à Coliaty 🚀
                           </button>
                         )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4 align-top text-right">
                      <button
                        onClick={() => openEdit(lead)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-xl transition-all shadow-sm group/btn"
                        title="Détails & Modification"
                      >
                        <Edit2 size={14} className="group-hover/btn:scale-110 transition-transform" />
                        <span className="text-xs font-bold">Éditer</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-50 bg-gray-50/50">

            <p className="text-sm text-gray-400">Page {page} / {totalPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create Modal ─────────────────────────────────────────────────── */}
      {showCreate && (
        <Modal title="Nouveau Lead" onClose={closeModals}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nom complet *">
              <input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Ahmed Naoum" className={inputCls} />
            </Field>
            <Field label="Téléphone *">
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0612345678" className={inputCls} />
            </Field>
            <Field label="WhatsApp">
              <input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="0612345678" className={inputCls} />
            </Field>
            <Field label="Ville">
              <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Casablanca" className={inputCls} />
            </Field>
            <Field label="Adresse" className="col-span-2">
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Rue..." className={inputCls} />
            </Field>
            <Field label="Vendeur *" className="col-span-2">
              <select value={form.vendorId} onChange={e => setForm(f => ({ ...f, vendorId: e.target.value }))} className={inputCls}>
                <option value="">— Sélectionner un vendeur —</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.fullName || v.email || `#${v.id}`}</option>
                ))}
              </select>
            </Field>
            <Field label="Notes" className="col-span-2">
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Notes..." className={inputCls} />
            </Field>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={closeModals} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-all">Annuler</button>
            <button onClick={handleCreate} disabled={saving} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-60">
              <Save size={16} /> {saving ? 'Enregistrement...' : 'Créer'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Edit Modal ───────────────────────────────────────────────────── */}
      {editLead && (
        <Modal title={`Modifier — ${editLead.fullName}`} onClose={closeModals}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nom complet">
              <input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Téléphone">
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="WhatsApp">
              <input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Ville">
              <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Adresse" className="col-span-2">
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Notes" className="col-span-2">
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className={inputCls} />
            </Field>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={closeModals} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-all">Annuler</button>
            <button onClick={handleEdit} disabled={saving} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-60">
              <Save size={16} /> {saving ? 'Enregistrement...' : 'Sauvegarder'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Callback Modal ───────────────────────────────────────────────── */}
      {callbackModal && (
        <Modal onClose={() => setCallbackModal(null)}>
          <div className="bg-indigo-600 p-10 text-center relative">
             <button onClick={() => setCallbackModal(null)} className="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition-all">
               <X size={20} />
             </button>
             <div className="bg-white/20 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-md">
               <Clock size={40} className="text-white" />
             </div>
             <h3 className="text-white text-2xl font-black mb-2">Programmer le rappel</h3>
             <p className="text-indigo-100 text-sm font-medium">À quel moment souhaitez-vous rappeler {callbackModal.lead.fullName} ?</p>
          </div>
          
          <div className="p-8">
            <div className="flex gap-4 mb-10">
               <div className="flex-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Date</label>
                  <div className="relative">
                    <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="date" 
                      value={callbackModal.date.split('T')[0] || ''}
                      onChange={e => {
                        const time = callbackModal.date.split('T')[1] || '12:00';
                        setCallbackModal(prev => prev ? { ...prev, date: `${e.target.value}T${time}` } : null)
                      }}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-4 py-4 font-bold text-gray-700 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                    />
                  </div>
               </div>
               <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block text-center">Heure (24H)</label>
                  <div className="flex items-center gap-3">
                     <input 
                       type="text" placeholder="12"
                       value={callbackModal.date.split('T')[1]?.split(':')[0] || ''}
                       onKeyDown={e => {
                         if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                           e.preventDefault();
                           const current = parseInt(callbackModal.date.split('T')[1]?.split(':')[0] || '12');
                           const next = e.key === 'ArrowUp' ? (current + 1) % 24 : (current - 1 + 24) % 24;
                           const date = callbackModal.date.split('T')[0] || new Date().toISOString().split('T')[0];
                           const min = callbackModal.date.split('T')[1]?.split(':')[1] || '00';
                           setCallbackModal(prev => prev ? { ...prev, date: `${date}T${next.toString().padStart(2, '0')}:${min}` } : null);
                         }
                       }}
                       onChange={e => {
                         const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                         const date = callbackModal.date.split('T')[0] || new Date().toISOString().split('T')[0];
                         const min = callbackModal.date.split('T')[1]?.split(':')[1] || '00';
                         setCallbackModal(prev => prev ? { ...prev, date: `${date}T${v}:${min}` } : null)
                       }}
                       className="w-20 bg-gray-50 border border-gray-100 rounded-2xl p-4 font-bold text-center text-gray-700 text-lg focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                     />
                     <span className="text-gray-300 font-bold text-xl">:</span>
                     <input 
                       type="text" placeholder="00"
                       value={callbackModal.date.split('T')[1]?.split(':')[1] || ''}
                       onKeyDown={e => {
                         if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                           e.preventDefault();
                           const current = parseInt(callbackModal.date.split('T')[1]?.split(':')[1] || '00');
                           const next = e.key === 'ArrowUp' ? (current + 1) % 60 : (current - 1 + 60) % 60;
                           const date = callbackModal.date.split('T')[0] || new Date().toISOString().split('T')[0];
                           const hour = callbackModal.date.split('T')[1]?.split(':')[0] || '12';
                           setCallbackModal(prev => prev ? { ...prev, date: `${date}T${hour}:${next.toString().padStart(2, '0')}` } : null);
                         }
                       }}
                       onChange={e => {
                         const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                         const date = callbackModal.date.split('T')[0] || new Date().toISOString().split('T')[0];
                         const hour = callbackModal.date.split('T')[1]?.split(':')[0] || '12';
                         setCallbackModal(prev => prev ? { ...prev, date: `${date}T${hour}:${v}` } : null)
                       }}
                       className="w-20 bg-gray-50 border border-gray-100 rounded-2xl p-4 font-bold text-center text-gray-700 text-lg focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                     />
                  </div>
               </div>
            </div>

            <div className="flex gap-4">
               <button onClick={() => setCallbackModal(null)} className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-black rounded-2xl transition-all">Annuler</button>
               <button 
                 onClick={handleConfirmCallback} 
                 disabled={saving}
                 className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50"
               >
                 {saving ? '...' : 'Confirmer'}
               </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Delivery Modal ─────────────────────────────────────────────────── */}
      {showDeliveryModal && selectedLeadForDelivery && (
        <Modal title="📦 Confirmation Coliaty" onClose={() => setShowDeliveryModal(false)}>
          <form onSubmit={handleConfirmDelivery} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nom Destinataire *" className="col-span-2">
                <input
                  required
                  value={deliveryForm.name}
                  onChange={e => setDeliveryForm({ ...deliveryForm, name: e.target.value })}
                  className={inputCls}
                />
                {formErrors.name && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.name}</p>}
              </Field>

              <Field label="Téléphone *">
                <input
                  required
                  value={deliveryForm.phone}
                  onChange={e => setDeliveryForm({ ...deliveryForm, phone: e.target.value })}
                  className={inputCls}
                  placeholder="06XXXXXXXX"
                />
                {formErrors.phone && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.phone}</p>}
              </Field>

              <Field label="Ville (Coliaty) *">
                {loadingCities ? (
                  <div className={`${inputCls} animate-pulse bg-gray-100`}>Chargement...</div>
                ) : (
                  <select
                    required
                    value={deliveryForm.city}
                    onChange={e => setDeliveryForm({ ...deliveryForm, city: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">— Ville —</option>
                    {coliatyCities.map(city => (
                      <option key={city.city_id} value={city.city_name}>{city.city_name}</option>
                    ))}
                  </select>
                )}
                {formErrors.city && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.city}</p>}
              </Field>

              <Field label="Adresse Détaillée *" className="col-span-2">
                <textarea
                  required
                  rows={2}
                  value={deliveryForm.address}
                  onChange={e => setDeliveryForm({ ...deliveryForm, address: e.target.value })}
                  className={inputCls}
                />
                {formErrors.address && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.address}</p>}
              </Field>

              <Field label="Prix (MAD) *">
                <input
                  type="number"
                  required
                  value={deliveryForm.price || ''}
                  onChange={e => setDeliveryForm({ ...deliveryForm, price: Number(e.target.value) })}
                  className={inputCls}
                />
                {formErrors.price && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.price}</p>}
              </Field>

              <Field label="Pack / Option">
                <input
                  value={deliveryForm.productVariant}
                  onChange={e => setDeliveryForm({ ...deliveryForm, productVariant: e.target.value })}
                  className={inputCls}
                />
              </Field>

              <div className="col-span-2 flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <input
                  type="checkbox"
                  id="no-open"
                  checked={deliveryForm.package_no_open}
                  onChange={e => setDeliveryForm({ ...deliveryForm, package_no_open: e.target.checked })}
                  className="w-5 h-5 text-indigo-600 rounded-lg border-gray-300 focus:ring-indigo-500/20"
                />
                <label htmlFor="no-open" className="text-xs font-bold text-gray-600 cursor-pointer">
                  Interdire Ouverture (Ne pas ouvrir avant paiement)
                </label>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                type="button"
                onClick={() => setShowDeliveryModal(false)}
                className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-black rounded-2xl transition-all"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isPushingDelivery || !deliveryForm.city}
                className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl transition-all shadow-lg shadow-emerald-500/30 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isPushingDelivery ? 'Envoi...' : 'Confirmer l\'envoi 🚀'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Helper sub-components ────────────────────────────────────────────────────
const inputCls = 'w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-300 transition-all';

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg pointer-events-auto overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          {title && (
            <div className="flex items-center justify-between px-8 py-6 border-b border-gray-50">
              <h2 className="text-xl font-extrabold text-gray-900">{title}</h2>
              <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all">
                <X size={20} />
              </button>
            </div>
          )}
          <div className={title ? 'px-8 py-6' : ''}>{children}</div>
        </div>
      </div>
    </>
  );
}

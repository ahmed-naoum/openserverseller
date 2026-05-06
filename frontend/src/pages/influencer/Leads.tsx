import { useState, useEffect } from 'react';
import { influencerApi } from '../../lib/api';
import { ReferralLink, InfluencerCommission } from '../../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  Users, MousePointerClick, UserCheck, ShoppingCart,
  Filter, Download, Search, Calendar,
  MapPin, Phone, Package, Clock, Trash2, Headphones, RefreshCw,
  ChevronDown, ChevronUp, Truck, CheckCircle2, Box, AlertCircle, X, BarChart3, Activity, PieChart as PieIcon, Zap, TrendingUp, History
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const ALL_STATUS_BADGES: Record<string, { label: string; color: string; icon: React.ComponentType<any> }> = {
  // --- Cycle de vie / Stock ---
  'NEW_PARCEL': { label: 'Nouveau Colis', color: 'bg-slate-50 text-slate-600 border border-slate-100', icon: Box },
  'WAITING_PICKUP': { label: 'Attente Collecte', color: 'bg-amber-50 text-amber-600 border border-amber-100', icon: Clock },
  'WAITING_PREPARATION': { label: 'Attente Préparation', color: 'bg-orange-50 text-orange-600 border border-orange-100', icon: Clock },
  'PREPARED': { label: 'Préparé', color: 'bg-emerald-50 text-emerald-600 border border-emerald-100', icon: CheckCircle2 },
  'ENCORE_PREPARED': { label: 'En préparation', color: 'bg-blue-50 text-blue-600 border border-blue-100', icon: RefreshCw },
  'PICKED_UP': { label: 'Collecté', color: 'bg-blue-50 text-blue-600 border border-blue-100', icon: Package },

  // --- En transit ---
  'SENT': { label: 'Expédié', color: 'bg-violet-50 text-violet-600 border border-violet-100', icon: Truck },
  'RECEIVED': { label: 'Reçu (Destination)', color: 'bg-indigo-50 text-indigo-600 border border-indigo-100', icon: MapPin },
  'DISTRIBUTION': { label: 'En livraison', color: 'bg-cyan-50 text-cyan-600 border border-cyan-100', icon: Truck },
  'PROGRAMMER_AUTO': { label: 'Livraison Auto', color: 'bg-purple-50 text-purple-600 border border-purple-100', icon: Calendar },
  'POSTPONED': { label: 'Reporté', color: 'bg-orange-50 text-orange-600 border border-orange-100', icon: Calendar },
  'NOANSWER': { label: 'Pas de réponse', color: 'bg-rose-50 text-rose-600 border border-rose-100', icon: Phone },
  'ERR': { label: 'Tél Erroné', color: 'bg-rose-50 text-rose-600 border border-rose-100', icon: Phone },
  'PROGRAMMER': { label: 'Programmé', color: 'bg-blue-50 text-blue-600 border border-blue-100', icon: Calendar },
  'INCORRECT_ADDRESS': { label: 'Adresse Erronée', color: 'bg-rose-50 text-rose-600 border border-rose-100', icon: MapPin },

  // --- Livraison terminée ---
  'DELIVERED': { label: 'Livré', color: 'bg-emerald-50 text-emerald-600 border border-emerald-100', icon: CheckCircle2 },
  'RETURNED': { label: 'Retourné', color: 'bg-orange-50 text-orange-600 border border-orange-100', icon: Box },

  // --- Annulations ---
  'CANCELED_BY_SELLER': { label: 'Annulé (Vendeur)', color: 'bg-red-50 text-red-600 border border-red-100', icon: X },
  'CANCELED_BY_SYSTEM': { label: 'Annulé (Système)', color: 'bg-red-50 text-red-600 border border-red-100', icon: AlertCircle },
  'CANCELED': { label: 'Annulé (Livreur)', color: 'bg-red-50 text-red-600 border border-red-100', icon: Trash2 },
  'REFUSE': { label: 'Refusé', color: 'bg-red-50 text-red-600 border border-red-100', icon: X },

  'PUSHED_TO_DELIVERY': { label: 'En livraison', color: 'bg-indigo-50 text-indigo-600 border border-indigo-100', icon: Truck },
  'CALL_LATER': { label: 'Rappel', color: 'bg-orange-50 text-orange-600 border border-orange-100', icon: Clock },

  // --- Legacy ---
  'LEAD': { label: 'Prospect', color: 'bg-indigo-50 text-indigo-600 border border-indigo-100', icon: Users },
  'AVAILABLE': { label: 'En attente (CC)', color: 'bg-yellow-50 text-yellow-600 border border-yellow-100', icon: Clock },
  'ASSIGNED': { label: 'Au Call Center', color: 'bg-cyan-50 text-cyan-600 border border-cyan-100', icon: Headphones },
  'PENDING': { label: 'En attente', color: 'bg-amber-50 text-amber-600 border border-amber-100', icon: Clock },
  'CONFIRMED': { label: 'Confirmé', color: 'bg-blue-50 text-blue-600 border border-blue-100', icon: CheckCircle2 },
  'SHIPPED': { label: 'Expédié', color: 'bg-violet-50 text-violet-600 border border-violet-100', icon: Truck },
  'CANCELLED': { label: 'Annulé', color: 'bg-red-50 text-red-600 border border-red-100', icon: AlertCircle },
};

const PAYMENT_SITUATION_BADGES: Record<string, { label: string; color: string }> = {
  PAID: { label: 'Payé', color: 'bg-emerald-50 text-emerald-600 border border-emerald-100' },
  NOT_PAID: { label: 'Non Payé', color: 'bg-rose-50 text-rose-600 border border-rose-100' },
  FACTURED: { label: 'Facturé', color: 'bg-blue-50 text-blue-600 border border-blue-100' },
};

export default function InfluencerLeads() {
  const [links, setLinks] = useState<ReferralLink[]>([]);
  const [commissions, setCommissions] = useState<InfluencerCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showStats, setShowStats] = useState(true);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isPushingBulk, setIsPushingBulk] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'primary' | 'danger';
    isLoading?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'primary',
  });
  const [duplicateCheck, setDuplicateCheck] = useState<{
    isOpen: boolean;
    ids: number[];
    groups: Record<string, InfluencerCommission[]>;
  }>({
    isOpen: false,
    ids: [],
    groups: {},
  });
  const [historyModal, setHistoryModal] = useState<{
    isOpen: boolean;
    customerName: string;
    history: Array<{ id: number; oldStatus: string; newStatus: string; notes?: string; createdAt: string; changer?: { profile?: { fullName?: string } } }>;
  }>({
    isOpen: false,
    customerName: '',
    history: [],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [linksRes, commissionsRes] = await Promise.all([
        influencerApi.getLinks(),
        influencerApi.getCustomers() // This returns commissions with orders
      ]);
      setLinks(linksRes.data);
      // API returns { status, data: { commissions, pagination } }
      const commissionsData = commissionsRes.data?.data?.commissions || commissionsRes.data?.commissions || [];
      setCommissions(commissionsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };
 
  // Filter commissions by date for ALL calculations
  const dateFilteredCommissions = commissions.filter(c => {
    if (!startDate && !endDate) return true;
    const leadDate = new Date(c.order?.createdAt || c.createdAt);
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (leadDate < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (leadDate > end) return false;
    }
    return true;
  });

  const totalClicks = links.reduce((sum, l) => sum + l.clicks, 0);
  const converted = links.reduce((sum, l) => sum + l.conversions, 0);
  
  const totalLeads = dateFilteredCommissions.length;

  const confirmationStatuses = [
    'LEAD', 'AVAILABLE', 'ASSIGNED', 'CALL_LATER', 
    'NO_REPLY', 'UNREACHABLE', 'INVALID', 
    'CONTACTED', 'INTERESTED', 'NOT_INTERESTED',
    'CANCEL_REASON_PRICE', 'WRONG_ORDER', 'CANCEL_ORDER'
  ];
  
  const deliveryStatuses = ['PENDING', 'PUSHED_TO_DELIVERY', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED', 'CONFIRMED_DELIVERY'];

  const confirmedLeads = dateFilteredCommissions.filter(c => {
    const s = (c.order?.status || 'UNKNOWN').toUpperCase();
    return s === 'CONFIRMED' || deliveryStatuses.includes(s);
  }).length;
  
  const deliveredLeads = dateFilteredCommissions.filter(c => (c.order?.status || '').toUpperCase() === 'DELIVERED').length;

  const confirmationRate = totalLeads > 0 ? (confirmedLeads / totalLeads) * 100 : 0;
  const deliveryRate = confirmedLeads > 0 ? (deliveredLeads / confirmedLeads) * 100 : 0;

  // Payment situation totals
  const paidLeads = dateFilteredCommissions.filter(c => (c.order as any)?.lead?.paymentSituation === 'PAID').length;
  const nonPaidLeads = dateFilteredCommissions.filter(c => (c.order as any)?.lead?.paymentSituation === 'NOT_PAID' || !(c.order as any)?.lead?.paymentSituation).length;
  const facturedLeads = dateFilteredCommissions.filter(c => (c.order as any)?.lead?.paymentSituation === 'FACTURED').length;

  // Build status counts for filter chips
  const statusCounts: Record<string, number> = {};
  dateFilteredCommissions.forEach(c => {
    let s = (c.order?.status || 'UNKNOWN').toUpperCase();
    if (s === 'CONFIRMED' && c.order?.coliatyPackageCode) {
      s = 'CONFIRMED_DELIVERY';
    }
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  // Predefine all statuses we want to show in the filter
  const activeStatuses = [
    'LEAD', 'AVAILABLE', 'ASSIGNED', 'PENDING', 'CALL_LATER', 
    'CONFIRMED', 'CONFIRMED_DELIVERY', 'PUSHED_TO_DELIVERY', 'SHIPPED', 'DELIVERED', 
    'CANCELLED', 'NO_REPLY', 'UNREACHABLE', 'INVALID', 
    'CONTACTED', 'INTERESTED', 'NOT_INTERESTED',
    'CANCEL_REASON_PRICE', 'WRONG_ORDER', 
    'CANCEL_ORDER', 'RETURNED', 'REFUNDED'
  ];
  // Add any statuses not in our predefined list that actually have count > 0
  Object.keys(statusCounts).forEach(s => {
    if (!activeStatuses.includes(s) && statusCounts[s] > 0) activeStatuses.push(s);
  });

  const filteredCommissions = dateFilteredCommissions.filter(c => {
    // Status filter
    if (statusFilter !== 'ALL') {
      const s = (c.order?.status || 'UNKNOWN').toUpperCase();
      if (s !== statusFilter.toUpperCase()) return false;
    }
    // Search filter
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (c.order?.customerName?.toLowerCase().includes(term)) ||
      (c.order?.customerPhone?.includes(searchTerm)) ||
      (c.order?.customerCity?.toLowerCase().includes(term))
    );
  });

  // Sort by date descending (newest first)
  const sortedCommissions = [...filteredCommissions].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const getStatusColorHex = (status: string) => {
    const colorClass = ALL_STATUS_BADGES[status]?.color || '';
    if (colorClass.includes('emerald')) return '#10b981';
    if (colorClass.includes('blue')) return '#3b82f6';
    if (colorClass.includes('amber')) return '#f59e0b';
    if (colorClass.includes('violet')) return '#8b5cf6';
    if (colorClass.includes('indigo')) return '#6366f1';
    if (colorClass.includes('cyan')) return '#06b6d4';
    if (colorClass.includes('red')) return '#ef4444';
    if (colorClass.includes('orange')) return '#f97316';
    if (colorClass.includes('yellow')) return '#eab308';
    return '#94a3b8';
  };

  // Data for Confirmation Analytics
  const totalConfirmed = (statusCounts['CONFIRMED'] || 0) + 
    deliveryStatuses.reduce((sum, status) => sum + (statusCounts[status] || 0), 0);

  const confirmationDistData = Object.entries(statusCounts)
    .filter(([status]) => confirmationStatuses.includes(status.toUpperCase()))
    .map(([status, count]) => ({
      name: ALL_STATUS_BADGES[status.toUpperCase()]?.label || status,
      value: count,
      color: getStatusColorHex(status.toUpperCase())
    }));

  if (totalConfirmed > 0) {
    confirmationDistData.push({
      name: ALL_STATUS_BADGES['CONFIRMED']?.label || 'Confirmé',
      value: totalConfirmed,
      color: getStatusColorHex('CONFIRMED')
    });
  }
  
  confirmationDistData.sort((a, b) => b.value - a.value);

  const deliveryDistData = Object.entries(statusCounts)
    .filter(([status]) => deliveryStatuses.includes(status.toUpperCase()))
    .map(([status, count]) => ({
      name: ALL_STATUS_BADGES[status.toUpperCase()]?.label || status,
      value: count,
      color: getStatusColorHex(status.toUpperCase())
    })).sort((a, b) => b.value - a.value);

  // Data for Volume Trend (by Day)
  const volumeTrendData = commissions.reduce((acc: any[], comm) => {
    const date = format(new Date(comm.createdAt), 'dd MMM');
    const existing = acc.find(item => item.date === date);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ date, count: 1 });
    }
    return acc;
  }, []).slice(-10);

  // Data for City Distribution (Only for leads successfully DELIVERED)
  const pushedLeadsForCity = commissions.filter(c => 
    c.order?.status === 'DELIVERED'
  );
  const totalPushedLeads = pushedLeadsForCity.length;

  const cityCounts: Record<string, number> = {};
  pushedLeadsForCity.forEach(c => {
    let city = (c.order?.customerCity || 'Inconnue').trim();
    // Normalize: lowercase then capitalize first letter of each word
    city = city.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    
    cityCounts[city] = (cityCounts[city] || 0) + 1;
  });

  const cityDistData = Object.entries(cityCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
    .map((item, i) => ({
      ...item,
      color: ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#f43f5e', '#84cc16', '#6366f1', '#ec4899'][i]
    }));

  const pushableLeads = sortedCommissions.filter(c => (c.order?.status || 'PENDING') === 'LEAD');

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const ids = pushableLeads.map(c => Number(String(c.id).replace('lead-', '')));
      setSelectedIds(ids);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkPush = (idsToPush?: number[]) => {
    const ids = idsToPush || selectedIds;
    if (ids.length === 0) return;

    // Find full lead objects for these ids
    const leadsToProcess = commissions.filter(c => {
      const numericId = Number(String(c.id).replace('lead-', ''));
      return ids.includes(numericId);
    });

    // Group by phone
    const groups: Record<string, InfluencerCommission[]> = {};
    leadsToProcess.forEach(c => {
      const phone = c.order?.customerPhone || 'no-phone';
      if (!groups[phone]) groups[phone] = [];
      groups[phone].push(c);
    });

    const duplicateGroups = Object.values(groups).filter(g => g.length > 1);

    if (duplicateGroups.length > 0) {
      // Create a set of IDs to keep: for each group, only keep the first one
      const idsToKeep = new Set<number>();
      Object.values(groups).forEach(group => {
        if (group.length > 0) {
          const firstId = Number(String(group[0].id).replace('lead-', ''));
          idsToKeep.add(firstId);
        }
      });

      setDuplicateCheck({
        isOpen: true,
        ids: Array.from(idsToKeep),
        groups: groups
      });
    } else {
      proceedWithBulkPush(ids);
    }
  };

  const proceedWithBulkPush = (ids: number[]) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirmation d\'envoi',
      message: `Envoyer ${ids.length} leads au Call Center ?`,
      variant: 'primary',
      onConfirm: async () => {
        try {
          setIsPushingBulk(true);
          await influencerApi.pushLeadsToCallCenterBulk(ids);
          toast.success(`${ids.length} leads envoyés au Call Center!`);
          setSelectedIds([]);
          loadData();
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          toast.error(err?.response?.data?.message || 'Erreur lors de l\'envoi groupé');
        } finally {
          setIsPushingBulk(false);
        }
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    
    setConfirmModal({
      isOpen: true,
      title: 'Confirmation de suppression',
      message: `Êtes-vous sûr de vouloir supprimer ${selectedIds.length} leads ? Cette action est irréversible.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          setIsPushingBulk(true); // Reusing this loading state or could add a new one
          await influencerApi.deleteLeadsBulk(selectedIds);
          toast.success(`${selectedIds.length} leads supprimés!`);
          setSelectedIds([]);
          loadData();
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          toast.error(err?.response?.data?.message || 'Erreur lors de la suppression');
        } finally {
          setIsPushingBulk(false);
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-influencer-200 border-t-influencer-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Mes Leads & Parrainages</h1>
          <p className="text-sm text-gray-500 mt-1">Suivez tous vos leads, conversions et livraisons en un seul endroit.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:text-influencer-600 hover:border-influencer-100 hover:bg-influencer-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <button
            onClick={() => setShowStats(!showStats)}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all"
          >
            {showStats ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Statistiques
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all">
            <Download className="w-3.5 h-3.5" />
            Exporter
          </button>
        </div>
      </div>

      {/* Collapsible Stats & Analytics */}
      {showStats && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm text-center">
              <Zap className="w-5 h-5 mx-auto mb-2 text-green-500" />
              <h3 className="text-xl font-black text-gray-900">{totalLeads.toLocaleString()}</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Total Leads</p>
            </div>
            <div className="relative bg-white rounded-3xl p-5 border border-gray-100 shadow-sm text-center border-b-4 border-b-amber-400 pb-8">
              <CheckCircle2 className="w-5 h-5 mx-auto mb-2 text-amber-600" />
              <h3 className="text-xl font-black text-amber-600">{confirmationRate.toFixed(1)}%</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Taux de Confirmation</p>
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[13px] font-black px-5 py-2 rounded-full shadow-lg border-2 border-white whitespace-nowrap uppercase tracking-widest">
                {confirmedLeads} LEADS CONFIRMÉS
              </div>
            </div>
            <div className="relative bg-white rounded-3xl p-5 border border-gray-100 shadow-sm text-center border-b-4 border-b-emerald-400 pb-8">
              <Truck className="w-5 h-5 mx-auto mb-2 text-emerald-600" />
              <h3 className="text-xl font-black text-emerald-600">{deliveryRate.toFixed(1)}%</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Taux de Livraison</p>
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[13px] font-black px-5 py-2 rounded-full shadow-lg border-2 border-white whitespace-nowrap uppercase tracking-widest">
                {deliveredLeads} LEADS LIVRÉS
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-4 h-4 text-influencer-500" />
                  Flux des Leads (10 derniers jours)
                </h3>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeTrendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                    <RechartsTooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
               <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2 mb-6">
                  <MapPin className="w-4 h-4 text-orange-500" />
                  Top Villes Performance
                </h3>
                <div className="flex-1 min-h-[200px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={cityDistData}
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {cityDistData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-black text-gray-900">{cityDistData.length}</span>
                    <span className="text-[8px] font-bold text-gray-400 uppercase">Villes Top</span>
                  </div>
                </div>
                <div className="mt-4 space-y-1">
                  {cityDistData.map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{backgroundColor: item.color}} />
                        <span className="text-[10px] font-bold text-gray-500 truncate max-w-[100px]">{item.name}</span>
                      </div>
                      <span className="text-[10px] font-black text-gray-900">
                        {totalPushedLeads > 0 ? Math.round((item.value / totalPushedLeads) * 100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {/* Confirmation Analytics */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2 mb-6">
                <PieIcon className="w-4 h-4 text-blue-500" />
                Analyse de Confirmation
              </h3>
              {confirmationDistData.length > 0 ? (
                <>
                  <div className="flex-1 min-h-[220px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={confirmationDistData}
                          innerRadius={60}
                          outerRadius={85}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {confirmationDistData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-2xl font-black text-gray-900">
                        {confirmationDistData.reduce((acc, curr) => acc + curr.value, 0)}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</span>
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-2">
                    {confirmationDistData.map((item, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-xl">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{backgroundColor: item.color}} />
                          <span className="text-[10px] font-bold text-gray-600 truncate max-w-[80px]">{item.name}</span>
                        </div>
                        <span className="text-xs font-black text-gray-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 min-h-[200px]">
                  <PieIcon className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm font-medium">Aucune donnée disponible</p>
                </div>
              )}
            </div>

            {/* Delivery Analytics */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2 mb-6">
                <Truck className="w-4 h-4 text-emerald-500" />
                Analyse de Livraison
              </h3>
              
              {/* Payment Summary Cards */}
              <div className="grid grid-cols-3 gap-2 mb-6">
                <div className="bg-red-50 p-2.5 rounded-2xl border border-red-100 text-center">
                  <span className="block text-[10px] font-black text-red-400 uppercase tracking-tighter mb-0.5">Non Payé</span>
                  <span className="text-lg font-black text-red-600">{nonPaidLeads}</span>
                </div>
                <div className="bg-blue-50 p-2.5 rounded-2xl border border-blue-100 text-center">
                  <span className="block text-[10px] font-black text-blue-400 uppercase tracking-tighter mb-0.5">Facturé</span>
                  <span className="text-lg font-black text-blue-600">{facturedLeads}</span>
                </div>
                <div className="bg-emerald-50 p-2.5 rounded-2xl border border-emerald-100 text-center">
                  <span className="block text-[10px] font-black text-emerald-400 uppercase tracking-tighter mb-0.5">Payé</span>
                  <span className="text-lg font-black text-emerald-600">{paidLeads}</span>
                </div>
              </div>

              {deliveryDistData.length > 0 ? (
                <>
                  <div className="flex-1 min-h-[220px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={deliveryDistData}
                          innerRadius={60}
                          outerRadius={85}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {deliveryDistData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-2xl font-black text-gray-900">
                        {deliveryDistData.reduce((acc, curr) => acc + curr.value, 0)}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</span>
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-2">
                    {deliveryDistData.map((item, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-xl">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{backgroundColor: item.color}} />
                          <span className="text-[10px] font-bold text-gray-600 truncate max-w-[80px]">{item.name}</span>
                        </div>
                        <span className="text-xs font-black text-gray-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 min-h-[200px]">
                  <Truck className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm font-medium">Aucune livraison en cours</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search + Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-influencer-500 transition-all font-medium"
                placeholder="Date de début"
              />
            </div>
            <div className="relative flex-1">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-influencer-500 transition-all font-medium"
                placeholder="Date de fin"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="px-4 py-2.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
              >
                Réinitialiser
              </button>
            )}
          </div>
          
          <div className="relative flex-[1.5]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, téléphone ou ville..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-influencer-500 transition-all font-medium"
            />
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              statusFilter === 'ALL'
                ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Tout ({dateFilteredCommissions.length})
          </button>
          {(() => {
            const renderedLabels = new Set();
            return activeStatuses.map(status => {
              const badge = ALL_STATUS_BADGES[status.toUpperCase()] || { label: status, color: 'bg-gray-100 text-gray-800', icon: Package };
              
              // Skip if we already rendered a button with this label (e.g. Expédié)
              if (renderedLabels.has(badge.label)) return null;
              renderedLabels.add(badge.label);

              const count = statusCounts[status.toUpperCase()] || 0;
              const isActive = statusFilter === status;
              const IconComp = badge.icon;
              
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    isActive
                      ? `${badge.color} border-current shadow-md`
                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <IconComp className="w-3 h-3" />
                  {badge.label} ({count})
                </button>
              );
            });
          })()}
        </div>
      </div>

      {/* Unified Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <Filter className="w-4 h-4 text-influencer-500" />
            {statusFilter === 'ALL' ? 'Tous les Leads' : (ALL_STATUS_BADGES[statusFilter]?.label || statusFilter)}
            <span className="text-gray-400 font-medium">({sortedCommissions.length})</span>
          </h2>

          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <button
                onClick={() => handleBulkPush()}
                disabled={isPushingBulk}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-influencer-100 text-influencer-700 rounded-lg text-[10px] font-bold hover:bg-influencer-200 transition-all"
              >
                <Headphones className="w-3.5 h-3.5" />
                Pousser la sélection ({selectedIds.length})
              </button>
            )}
            {selectedIds.length > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={isPushingBulk}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-[10px] font-bold hover:bg-red-200 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer ({selectedIds.length})
              </button>
            )}
          </div>
        </div>

        {sortedCommissions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-5 py-3 text-left">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-influencer-600 border-gray-300 rounded focus:ring-influencer-500"
                      checked={pushableLeads.length > 0 && selectedIds.length === pushableLeads.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tracking Number</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Client</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Produit</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Pack/Option</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Montant</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Situation</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Commentaires</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {sortedCommissions.map((commission) => {
                  const status = ((commission.order?.status || 'PENDING') as string).trim().toUpperCase();
                  let badge = ALL_STATUS_BADGES[status] || { label: status, color: 'bg-gray-100 text-gray-800', icon: Package };
                  
                  // Special case: If confirmed but has a tracking code, it's a delivery-stage lead
                  if (status === 'CONFIRMED' && commission.order?.coliatyPackageCode) {
                    badge = {
                      ...ALL_STATUS_BADGES['PUSHED_TO_DELIVERY'],
                      label: 'Confirmé (Livraison)'
                    };
                  }
                  
                  const StatusIcon = badge.icon;
                  const productImage = commission.referralLink?.product?.images?.[0]?.imageUrl;

                  let packPriceMad: number | null = null;
                  const productVariant = commission.order?.productVariant || (commission as any).order?.productVariant;
                  if (productVariant && commission.referralLink?.landingPage?.customStructure) {
                    try {
                      const structure = commission.referralLink.landingPage.customStructure;
                      const blocks = Array.isArray(structure) ? structure : (structure.blocks || []);
                      const checkoutBlock = blocks.find((b: any) => b.type === 'express_checkout');
                      if (checkoutBlock?.content?.options) {
                        const option = checkoutBlock.content.options.find((o: any) => o.name === productVariant);
                        if (option && option.price) {
                          packPriceMad = Number(option.price);
                        }
                      }
                    } catch (e) {
                      // fallback
                    }
                  }

                  return (
                    <tr key={commission.id} className={`hover:bg-gray-50/50 transition-colors group ${selectedIds.includes(Number(String(commission.id).replace('lead-', ''))) ? 'bg-influencer-50/30' : ''}`}>
                      {/* Checkbox */}
                      <td className="px-5 py-4">
                        {status === 'LEAD' && (
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-influencer-600 border-gray-300 rounded focus:ring-influencer-500"
                            checked={selectedIds.includes(Number(String(commission.id).replace('lead-', '')))}
                            onChange={() => handleSelectOne(Number(String(commission.id).replace('lead-', '')))}
                          />
                        )}
                      </td>

                      {/* Tracking Number */}
                      <td className="px-5 py-4">
                        {commission.order?.coliatyPackageCode && (
                          <div className="flex flex-col items-start">
                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded border border-violet-100 text-[9px] font-black">
                              <Truck className="w-2.5 h-2.5" />
                              <span>{commission.order.coliatyPackageCode}</span>
                            </div>
                            {commission.order.coliatyPackageId && (
                              <span className="text-[8px] font-bold text-gray-400 mt-0.5">ID: #{commission.order.coliatyPackageId}</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Client */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-900">{commission.order?.customerName || '-'}</span>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                            <span className="flex items-center gap-1"><Phone className="w-2.5 h-2.5" /> {commission.order?.customerPhone}</span>
                            <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {commission.order?.customerCity || '-'}</span>
                          </div>
                          {commission.order?.customerAddress && (
                            <span className="text-[10px] text-gray-400 mt-1 truncate max-w-[200px]">📍 {commission.order.customerAddress}</span>
                          )}
                        </div>
                      </td>

                      {/* Produit */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {productImage ? (
                            <img src={productImage} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <Package className="w-4 h-4 text-gray-400" />
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900">{commission.referralLink?.product?.nameFr || '-'}</span>
                            <span className="text-[10px] text-gray-400 font-mono mt-0.5 uppercase">SKU: {commission.referralLink?.product?.sku || '-'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Option */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-0.5">Sélection</span>
                          <span className="text-xs font-black text-influencer-600 truncate max-w-[100px]">
                            {(commission.order as any)?.productVariant || (commission as any).order?.productVariant || '-'}
                          </span>
                        </div>
                      </td>

                      {/* Montant */}
                      <td className="px-5 py-4">
                        <span className="text-sm font-bold text-gray-900">
                          {Number(commission.order?.totalAmountMad) > 0
                            ? `${Number(commission.order!.totalAmountMad).toFixed(2)} MAD`
                            : packPriceMad !== null
                              ? `${packPriceMad.toFixed(2)} MAD`
                              : commission.referralLink?.product?.retailPriceMad
                                ? `${Number(commission.referralLink.product.retailPriceMad).toFixed(2)} MAD`
                                : '-'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${badge.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {badge.label}
                          </span>
                          {status === 'CALL_LATER' && (commission.order as any)?.lead?.callbackDate && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded border border-orange-100 text-[8px] font-black uppercase shadow-sm animate-pulse">
                              <Calendar className="w-2 h-2" />
                              {format(new Date((commission.order as any).lead.callbackDate), 'dd MMM HH:mm')}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col text-xs text-gray-500 font-medium whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> 
                            {commission.createdAt ? format(new Date(commission.createdAt), 'dd MMM yyyy') : '-'}
                          </span>
                          <span className="flex items-center gap-1 mt-0.5 opacity-60">
                            <Clock className="w-3 h-3" /> 
                            {commission.createdAt ? format(new Date(commission.createdAt), 'HH:mm') : '-'}
                          </span>
                        </div>
                      </td>

                      {/* Situation */}
                      <td className="px-5 py-4">
                        {(() => {
                          const sit = (commission.order as any)?.lead?.paymentSituation || 'NOT_PAID';
                          const badge = PAYMENT_SITUATION_BADGES[sit] || PAYMENT_SITUATION_BADGES.NOT_PAID;
                          return (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${badge.color}`}>
                              {badge.label}
                            </span>
                          );
                        })()}
                      </td>
                      
                      {/* Commentaires */}
                      <td className="px-5 py-4">
                        {(commission.order as any)?.lead?.notes ? (
                          <div className="max-w-[200px]">
                            <p className="text-[10px] text-gray-600 font-medium line-clamp-2 italic" title={(commission.order as any).lead.notes}>
                              "{(commission.order as any).lead.notes}"
                            </p>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-300 italic">Aucun commentaire</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          {commission.order?.status === 'LEAD' && (
                            <>
                              <button
                                onClick={async () => {
                                  const realId = String(commission.id).replace('lead-', '');
                                  try {
                                    await influencerApi.pushLeadToCallCenter(Number(realId));
                                    toast.success('Lead envoyé au Call Center!');
                                    loadData();
                                  } catch (err: any) {
                                    toast.error(err?.response?.data?.message || 'Erreur');
                                  }
                                }}
                                className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-all" title="Envoyer au Call Center"
                              >
                                <Headphones className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  const realId = String(commission.id).replace('lead-', '');
                                  setConfirmModal({
                                    isOpen: true,
                                    title: 'Supprimer ce lead ?',
                                    message: 'Cette action est irréversible. Voulez-vous vraiment continuer ?',
                                    variant: 'danger',
                                    onConfirm: async () => {
                                      try {
                                        await influencerApi.deleteLead(Number(realId));
                                        toast.success('Lead supprimé');
                                        loadData();
                                        setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                      } catch (err: any) {
                                        toast.error(err?.response?.data?.message || 'Erreur');
                                      }
                                    }
                                  });
                                }}
                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-all" title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {commission.order?.status === 'ASSIGNED' && (
                            <span className="text-[10px] text-cyan-600 font-bold bg-cyan-50 px-2 py-1 rounded-lg">Au Call Center</span>
                          )}
                          {/* History button always visible */}
                          {(() => {
                            const leadHistory = (commission.order as any)?.lead?.statusHistory || (commission as any)?.statusHistory || [];
                            const orderHistory = (commission.order as any)?.statusHistory || [];
                            
                            // Merge and normalize histories
                            const mergedHistory = [
                              ...leadHistory.map((h: any) => ({ ...h, type: 'LEAD' })),
                              ...orderHistory.map((h: any) => ({ 
                                ...h, 
                                type: 'ORDER',
                                changer: h.changedByUser // Normalize to same field name
                              }))
                            ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

                            return mergedHistory.length > 0 ? (
                              <button
                                onClick={() => setHistoryModal({
                                  isOpen: true,
                                  customerName: commission.order?.customerName || '-',
                                  history: mergedHistory,
                                })}
                                className="p-1.5 rounded-lg text-violet-500 hover:bg-violet-50 transition-all" title="Voir l'historique"
                              >
                                <History className="w-4 h-4" />
                              </button>
                            ) : null;
                          })()}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 mx-auto text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">Aucun lead trouvé</p>
            <p className="text-gray-400 text-sm mt-1">
              {statusFilter !== 'ALL'
                ? `Aucun lead avec le statut "${ALL_STATUS_BADGES[statusFilter]?.label || statusFilter}".`
                : 'Vos leads apparaîtront ici dès qu\'un client commande via vos liens.'}
            </p>
          </div>
        )}
      </div>

      {/* History Modal */}
      {historyModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl border border-white/20 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <History className="w-5 h-5 text-violet-500" />
                  Historique des statuts
                </h2>
                <p className="text-xs text-gray-400 font-medium mt-0.5">{historyModal.customerName}</p>
              </div>
              <button
                onClick={() => setHistoryModal(prev => ({ ...prev, isOpen: false }))}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Timeline */}
            <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
              {historyModal.history.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <History className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm font-medium">Aucun historique disponible</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-100" />

                  <div className="space-y-5">
                    {historyModal.history.map((entry, i) => {
                      const oldBadge = ALL_STATUS_BADGES[entry.oldStatus?.toUpperCase()] || { label: entry.oldStatus, color: 'bg-gray-100 text-gray-600', icon: Package };
                      const newBadge = ALL_STATUS_BADGES[entry.newStatus?.toUpperCase()] || { label: entry.newStatus, color: 'bg-gray-100 text-gray-600', icon: Package };
                      const NewIcon = newBadge.icon;
                      const isLast = i === historyModal.history.length - 1;
                      return (
                        <div key={entry.id} className="relative flex gap-4 pl-10">
                          {/* Circle on timeline */}
                          <div className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-sm z-10 ${
                            isLast ? 'bg-violet-500' : 'bg-gray-200'
                          }`}>
                            <NewIcon className={`w-4 h-4 ${isLast ? 'text-white' : 'text-gray-500'}`} />
                          </div>

                          <div className="flex-1 bg-gray-50 rounded-2xl px-4 py-3">
                            <div className="flex items-center flex-wrap gap-2 mb-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${oldBadge.color}`}>
                                {oldBadge.label}
                              </span>
                              <span className="text-gray-400 text-xs">→</span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${newBadge.color}`}>
                                {newBadge.label}
                              </span>
                            </div>
                            {entry.notes && (
                              <p className="text-[10px] text-gray-500 italic mt-1">💬 {entry.notes}</p>
                            )}
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                                {entry.changer?.profile?.fullName || 'Système'}
                              </span>
                              <span className="text-[9px] text-gray-400">
                                {entry.createdAt ? format(new Date(entry.createdAt), 'dd MMM yyyy HH:mm') : '-'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 pb-6 pt-2">
              <button
                onClick={() => setHistoryModal(prev => ({ ...prev, isOpen: false }))}
                className="w-full px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Check Modal */}
      {duplicateCheck.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[150] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-white/20 animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                      <AlertCircle className="w-6 h-6 text-amber-500" />
                    </div>
                    Vérification des Doublons
                  </h2>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-2">
                    {Object.values(duplicateCheck.groups).filter(g => g.length > 1).length} groupes de numéros identiques trouvés
                  </p>
                </div>
                <button
                  onClick={() => setDuplicateCheck(prev => ({ ...prev, isOpen: false }))}
                  className="p-3 rounded-2xl bg-gray-50 text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-4">
                <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
                  <Headphones size={20} />
                </div>
                <div>
                  <p className="text-sm font-black text-amber-900 uppercase tracking-tight">Optimisation de l'envoi</p>
                  <p className="text-xs text-amber-700/70 font-medium mt-1 leading-relaxed">
                    Nous avons détecté des prospects avec le même numéro de téléphone. Veuillez sélectionner uniquement ceux que vous souhaitez envoyer au Call Center.
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {Object.entries(duplicateCheck.groups)
                  .filter(([_, group]) => group.length > 1)
                  .map(([phone, group], groupIdx) => (
                    <div key={phone} className="bg-slate-50/50 border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm transition-all hover:shadow-md">
                      <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                            <Phone className="w-4 h-4 text-slate-400" />
                          </div>
                          <span className="text-sm font-black text-slate-700 tracking-tight">{phone}</span>
                        </div>
                        <span className="px-3 py-1 bg-white rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-100">
                          {group.length} Doublons
                        </span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {group.map((lead) => {
                          const leadId = Number(String(lead.id).replace('lead-', ''));
                          const isSelected = duplicateCheck.ids.includes(leadId);
                          return (
                            <div 
                              key={lead.id} 
                              onClick={() => {
                                setDuplicateCheck(prev => {
                                  const newIds = prev.ids.includes(leadId) 
                                    ? prev.ids.filter(id => id !== leadId)
                                    : [...prev.ids, leadId];
                                  return { ...prev, ids: newIds };
                                });
                              }}
                              className={`p-6 flex items-center gap-4 cursor-pointer transition-all ${
                                isSelected ? 'bg-white' : 'opacity-60 grayscale-[0.5]'
                              }`}
                            >
                              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                isSelected 
                                  ? 'bg-influencer-500 border-influencer-500 text-white shadow-lg shadow-influencer-500/20' 
                                  : 'border-slate-200'
                              }`}>
                                {isSelected && <CheckCircle2 size={14} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-black text-slate-900 truncate tracking-tight">{lead.order?.customerName}</p>
                                <div className="flex items-center gap-3 mt-1.5">
                                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                                    <MapPin size={10} /> {lead.order?.customerCity || '—'}
                                  </span>
                                  <span className="w-1 h-1 rounded-full bg-slate-200" />
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                                    {format(new Date(lead.createdAt), 'dd MMM yyyy')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="p-8 bg-slate-50/50 border-t border-gray-100 flex gap-4">
              <button
                onClick={() => setDuplicateCheck(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 px-8 py-4 bg-white text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-slate-200 hover:bg-gray-50 transition-all"
              >
                Annuler
              </button>
              {(() => {
                const hasDuplicateSelections = Object.entries(duplicateCheck.groups).some(([phone, group]) => {
                  const selectedCountInGroup = group.filter(lead => {
                    const leadId = Number(String(lead.id).replace('lead-', ''));
                    return duplicateCheck.ids.includes(leadId);
                  }).length;
                  return selectedCountInGroup > 1;
                });

                return (
                  <button
                    onClick={() => {
                      setDuplicateCheck(prev => ({ ...prev, isOpen: false }));
                      proceedWithBulkPush(duplicateCheck.ids);
                    }}
                    disabled={hasDuplicateSelections || duplicateCheck.ids.length === 0}
                    className={`flex-[2] px-8 py-4 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2 ${
                      hasDuplicateSelections || duplicateCheck.ids.length === 0
                        ? 'bg-gray-300 cursor-not-allowed shadow-none'
                        : 'bg-gray-900 hover:bg-black shadow-gray-900/20'
                    }`}
                  >
                    <Headphones size={16} />
                    {hasDuplicateSelections ? 'Doublons sélectionnés' : `Confirmer l'envoi (${duplicateCheck.ids.length})`}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl border border-white/20 animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${confirmModal.variant === 'danger' ? 'bg-red-50 text-red-500' : 'bg-influencer-50 text-influencer-600'}`}>
                {confirmModal.variant === 'danger' ? <AlertCircle size={32} /> : <Headphones size={32} />}
              </div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight mb-2">
                {confirmModal.title}
              </h2>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">
                {confirmModal.message}
              </p>
            </div>
            
            <div className="p-6 bg-slate-50/50 flex gap-3">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 bg-white border border-slate-100 rounded-2xl transition-all shadow-sm"
              >
                Annuler
              </button>
              <button
                onClick={confirmModal.onConfirm}
                disabled={isPushingBulk}
                className={`flex-1 px-6 py-3 text-xs font-black uppercase tracking-widest text-white rounded-2xl shadow-lg transition-all ${
                  confirmModal.variant === 'danger' 
                    ? 'bg-red-500 hover:bg-red-600 shadow-red-200' 
                    : 'bg-influencer-600 hover:bg-influencer-700 shadow-influencer-200'
                }`}
              >
                {isPushingBulk ? 'En cours...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

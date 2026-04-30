import { useState, useEffect } from 'react';
import { influencerApi } from '../../lib/api';
import { ReferralLink, InfluencerCommission } from '../../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  Users, MousePointerClick, UserCheck, ShoppingCart,
  Filter, Download, Search, Calendar,
  MapPin, Phone, Package, Clock, Trash2, Headphones, RefreshCw,
  ChevronDown, ChevronUp, Truck, CheckCircle2, Box, AlertCircle, X, BarChart3, Activity, PieChart as PieIcon, Zap, TrendingUp
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const ALL_STATUS_BADGES: Record<string, { label: string; color: string; icon: React.ComponentType<any> }> = {
  // Order-level statuses
  LEAD: { label: 'Prospect', color: 'bg-indigo-100 text-indigo-800', icon: Users },
  AVAILABLE: { label: 'En attente (Call Center)', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  ASSIGNED: { label: 'Au Call Center', color: 'bg-cyan-100 text-cyan-800', icon: Headphones },
  PENDING: { label: 'En attente', color: 'bg-amber-100 text-amber-800', icon: Clock },
  CONFIRMED: { label: 'Confirmé', color: 'bg-blue-100 text-blue-800', icon: CheckCircle2 },
  PUSHED_TO_DELIVERY: { label: 'Expédié', color: 'bg-violet-100 text-violet-800', icon: Truck },
  SHIPPED: { label: 'Expédié', color: 'bg-violet-100 text-violet-800', icon: Truck },
  DELIVERED: { label: 'Livré', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 },
  CANCELLED: { label: 'Annulé', color: 'bg-red-100 text-red-800', icon: AlertCircle },
  RETURNED: { label: 'Retourné', color: 'bg-orange-100 text-orange-800', icon: Box },
  REFUNDED: { label: 'Remboursé', color: 'bg-gray-100 text-gray-800', icon: RefreshCw },
};

const PAYMENT_SITUATION_BADGES: Record<string, { label: string; color: string }> = {
  PAID: { label: 'Payé', color: 'bg-green-100 text-green-700' },
  NOT_PAID: { label: 'Non Payé', color: 'bg-red-100 text-red-700' },
  FACTURED: { label: 'Facturé', color: 'bg-blue-100 text-blue-700' },
};

export default function InfluencerLeads() {
  const [links, setLinks] = useState<ReferralLink[]>([]);
  const [commissions, setCommissions] = useState<InfluencerCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showStats, setShowStats] = useState(true);
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
 
  const totalClicks = links.reduce((sum, l) => sum + l.clicks, 0);
  const converted = links.reduce((sum, l) => sum + l.conversions, 0);

  const totalLeads = commissions.length;
  const confirmedLeads = commissions.filter(c => 
    ['CONFIRMED', 'SHIPPED', 'DELIVERED', 'PUSHED_TO_DELIVERY', 'ORDERED'].includes(c.order?.status || '')
  ).length;
  const deliveredLeads = commissions.filter(c => c.order?.status === 'DELIVERED').length;

  const confirmationRate = totalLeads > 0 ? (confirmedLeads / totalLeads) * 100 : 0;
  const deliveryRate = confirmedLeads > 0 ? (deliveredLeads / confirmedLeads) * 100 : 0;

  // Build status counts for filter chips
  const statusCounts: Record<string, number> = {};
  commissions.forEach(c => {
    const s = c.order?.status || 'UNKNOWN';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  // Sorted status order for display
  const statusOrder = ['LEAD', 'AVAILABLE', 'ASSIGNED', 'PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'];
  const activeStatuses = statusOrder.filter(s => statusCounts[s] > 0);
  // Add any statuses not in our predefined list
  Object.keys(statusCounts).forEach(s => {
    if (!activeStatuses.includes(s)) activeStatuses.push(s);
  });

  const filteredCommissions = commissions.filter(c => {
    // Status filter
    if (statusFilter !== 'ALL') {
      if ((c.order?.status || 'UNKNOWN') !== statusFilter) return false;
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

  // Data for Status Distribution Chart
  const statusDistData = Object.entries(statusCounts).map(([status, count]) => ({
    name: ALL_STATUS_BADGES[status]?.label || status,
    value: count,
    color: ALL_STATUS_BADGES[status]?.color.includes('emerald') ? '#10b981' :
           ALL_STATUS_BADGES[status]?.color.includes('blue') ? '#3b82f6' :
           ALL_STATUS_BADGES[status]?.color.includes('amber') ? '#f59e0b' :
           ALL_STATUS_BADGES[status]?.color.includes('violet') ? '#8b5cf6' :
           ALL_STATUS_BADGES[status]?.color.includes('indigo') ? '#6366f1' :
           ALL_STATUS_BADGES[status]?.color.includes('cyan') ? '#06b6d4' : '#94a3b8'
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

  // Data for City Distribution
  const cityCounts: Record<string, number> = {};
  commissions.forEach(c => {
    const city = c.order?.customerCity || 'Inconnue';
    cityCounts[city] = (cityCounts[city] || 0) + 1;
  });

  const cityDistData = Object.entries(cityCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map((item, i) => ({
      ...item,
      color: ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'][i]
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm text-center">
              <MousePointerClick className="w-5 h-5 mx-auto mb-2 text-blue-500" />
              <h3 className="text-xl font-black text-gray-900">{totalClicks.toLocaleString()}</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Page Views</p>
            </div>
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm text-center">
              <Zap className="w-5 h-5 mx-auto mb-2 text-green-500" />
              <h3 className="text-xl font-black text-gray-900">{converted.toLocaleString()}</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Ventes</p>
            </div>
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm text-center">
              <TrendingUp className="w-5 h-5 mx-auto mb-2 text-purple-500" />
              <h3 className="text-xl font-black text-gray-900">{totalClicks > 0 ? ((converted / totalClicks) * 100).toFixed(1) : 0}%</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Conv. Rate</p>
            </div>
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm text-center border-b-4 border-b-amber-400">
              <CheckCircle2 className="w-5 h-5 mx-auto mb-2 text-amber-600" />
              <h3 className="text-xl font-black text-amber-600">{confirmationRate.toFixed(1)}%</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Confirmation</p>
            </div>
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm text-center border-b-4 border-b-emerald-400">
              <Truck className="w-5 h-5 mx-auto mb-2 text-emerald-600" />
              <h3 className="text-xl font-black text-emerald-600">{deliveryRate.toFixed(1)}%</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Livraison</p>
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
                      <span className="text-[10px] font-black text-gray-900">{Math.round((item.value / totalLeads) * 100)}%</span>
                    </div>
                  ))}
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Search + Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
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
            Tout ({commissions.length})
          </button>
          {activeStatuses.map(status => {
            const badge = ALL_STATUS_BADGES[status] || { label: status, color: 'bg-gray-100 text-gray-800', icon: Package };
            const IconComp = badge.icon;
            const isActive = statusFilter === status;
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
                {badge.label} ({statusCounts[status]})
              </button>
            );
          })}
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
            {pushableLeads.length > 0 && (
              <button
                onClick={() => handleBulkPush(pushableLeads.map(l => Number(String(l.id).replace('lead-', ''))))}
                disabled={isPushingBulk}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-[10px] font-bold hover:bg-black transition-all shadow-sm"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                Tout pousser au Call Center ({pushableLeads.length})
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
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Client</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Produit</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Pack/Option</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Montant</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Situation</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {sortedCommissions.map((commission) => {
                  const status = (commission.order?.status || 'PENDING') as string;
                  const badge = ALL_STATUS_BADGES[status] || { label: status, color: 'bg-gray-100 text-gray-800', icon: Package };
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
                            {commission.order?.productVariant || (commission as any).order?.productVariant || '-'}
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
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${badge.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {badge.label}
                        </span>
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
                          const sit = commission.order?.lead?.paymentSituation || 'NOT_PAID';
                          const badge = PAYMENT_SITUATION_BADGES[sit] || PAYMENT_SITUATION_BADGES.NOT_PAID;
                          return (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${badge.color}`}>
                              {badge.label}
                            </span>
                          );
                        })()}
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

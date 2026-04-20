import { useState, useEffect } from 'react';
import { influencerApi } from '../../lib/api';
import { ReferralLink, InfluencerCommission } from '../../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  Users, MousePointerClick, UserCheck, ShoppingCart,
  Filter, Download, Search, Calendar,
  MapPin, Phone, Package, Clock, Trash2, Headphones,
  ChevronDown, ChevronUp, Truck, CheckCircle2, Box, AlertCircle
} from 'lucide-react';

const ALL_STATUS_BADGES: Record<string, { label: string; color: string; icon: React.ComponentType<any> }> = {
  // Order-level statuses
  LEAD: { label: 'Prospect', color: 'bg-indigo-100 text-indigo-800', icon: Users },
  AVAILABLE: { label: 'En attente (Call Center)', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  ASSIGNED: { label: 'Au Call Center', color: 'bg-cyan-100 text-cyan-800', icon: Headphones },
  PENDING: { label: 'En attente', color: 'bg-amber-100 text-amber-800', icon: Clock },
  CONFIRMED: { label: 'Confirmé', color: 'bg-blue-100 text-blue-800', icon: CheckCircle2 },
  SHIPPED: { label: 'Expédié', color: 'bg-violet-100 text-violet-800', icon: Truck },
  DELIVERED: { label: 'Livré', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 },
  CANCELLED: { label: 'Annulé', color: 'bg-red-100 text-red-800', icon: AlertCircle },
  RETURNED: { label: 'Retourné', color: 'bg-orange-100 text-orange-800', icon: Box },
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

  const totalReferrals = links.reduce((sum, l) => sum + l.clicks, 0);
  const registered = links.reduce((sum, l) => sum + Math.floor(l.clicks * 0.3), 0);
  const converted = links.reduce((sum, l) => sum + l.conversions, 0);

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

  const handleBulkPush = async (idsToPush?: number[]) => {
    const ids = idsToPush || selectedIds;
    if (ids.length === 0) return;
    
    if (!confirm(`Envoyer ${ids.length} leads au Call Center ?`)) return;

    try {
      setIsPushingBulk(true);
      await influencerApi.pushLeadsToCallCenterBulk(ids);
      toast.success(`${ids.length} leads envoyés au Call Center!`);
      setSelectedIds([]);
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erreur lors de l\'envoi groupé');
    } finally {
      setIsPushingBulk(false);
    }
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

      {/* Collapsible Stats */}
      {showStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fadeIn">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white text-center shadow-lg shadow-blue-200/50">
            <MousePointerClick className="w-7 h-7 mx-auto mb-2 opacity-80" />
            <h3 className="text-2xl font-black">{totalReferrals.toLocaleString()}</h3>
            <p className="text-[11px] font-medium opacity-80 mt-1">Clics Totaux</p>
          </div>
          <div className="bg-gradient-to-br from-influencer-500 to-purple-600 rounded-2xl p-5 text-white text-center shadow-lg shadow-purple-200/50">
            <UserCheck className="w-7 h-7 mx-auto mb-2 opacity-80" />
            <h3 className="text-2xl font-black">{registered.toLocaleString()}</h3>
            <p className="text-[11px] font-medium opacity-80 mt-1">Inscrits (Est.)</p>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-5 text-white text-center shadow-lg shadow-green-200/50">
            <ShoppingCart className="w-7 h-7 mx-auto mb-2 opacity-80" />
            <h3 className="text-2xl font-black">{converted.toLocaleString()}</h3>
            <p className="text-[11px] font-medium opacity-80 mt-1">Ventes Confirmées</p>
          </div>
          <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-5 text-white text-center shadow-lg shadow-orange-200/50">
            <Package className="w-7 h-7 mx-auto mb-2 opacity-80" />
            <h3 className="text-2xl font-black">{commissions.length}</h3>
            <p className="text-[11px] font-medium opacity-80 mt-1">Total Leads</p>
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
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Montant</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Commission</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {sortedCommissions.map((commission) => {
                  const status = (commission.order?.status || 'PENDING') as string;
                  const badge = ALL_STATUS_BADGES[status] || { label: status, color: 'bg-gray-100 text-gray-800', icon: Package };
                  const StatusIcon = badge.icon;
                  const productImage = commission.referralLink?.product?.images?.[0]?.imageUrl;

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

                      {/* Montant */}
                      <td className="px-5 py-4">
                        <span className="text-sm font-bold text-gray-900">
                          {Number(commission.order?.totalAmountMad) > 0
                            ? `${Number(commission.order!.totalAmountMad).toFixed(2)} MAD`
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

                      {/* Commission */}
                      <td className="px-5 py-4">
                        <span className="text-sm font-black text-green-600">+{commission.amount.toFixed(2)} MAD</span>
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
                                onClick={async () => {
                                  if (!confirm('Supprimer ce lead ?')) return;
                                  const realId = String(commission.id).replace('lead-', '');
                                  try {
                                    await influencerApi.deleteLead(Number(realId));
                                    toast.success('Lead supprimé');
                                    loadData();
                                  } catch (err: any) {
                                    toast.error(err?.response?.data?.message || 'Erreur');
                                  }
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
                          {commission.order?.status === 'CONFIRMED' && (
                            <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded-lg">Confirmé</span>
                          )}
                          {commission.order?.status === 'SHIPPED' && (
                            <span className="text-[10px] text-violet-600 font-bold bg-violet-50 px-2 py-1 rounded-lg flex items-center gap-1">
                              <Truck className="w-3 h-3" /> En livraison
                            </span>
                          )}
                          {commission.order?.status === 'DELIVERED' && (
                            <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-lg flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Livré ✓
                            </span>
                          )}
                          {commission.order?.status === 'CANCELLED' && (
                            <span className="text-[10px] text-red-600 font-bold bg-red-50 px-2 py-1 rounded-lg">Annulé</span>
                          )}
                          {commission.order?.status === 'RETURNED' && (
                            <span className="text-[10px] text-orange-600 font-bold bg-orange-50 px-2 py-1 rounded-lg">Retourné</span>
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
    </div>
  );
}

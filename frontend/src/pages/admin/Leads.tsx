import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { leadsApi } from '../../lib/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { 
  Users, Search, Filter, Download, 
  ChevronLeft, ChevronRight, 
  Phone, MapPin, Calendar, Tag, Headphones,
  Trash2, Edit, CheckCircle2, Clock, Box, AlertCircle, Truck,
  ChevronDown, ChevronUp, MousePointerClick, UserCheck, ShoppingCart, Package
} from 'lucide-react';

const STATUS_BADGES: Record<string, { label: string; color: string; icon: any }> = {
  NEW: { label: 'Nouveau', color: 'bg-blue-100 text-blue-800', icon: Clock },
  AVAILABLE: { label: 'Disponible', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 },
  ASSIGNED: { label: 'Au Call Center', icon: Headphones, color: 'bg-cyan-100 text-cyan-800' },
  CONTACTED: { label: 'Contacté', icon: Phone, color: 'bg-blue-100 text-blue-800' },
  INTERESTED: { label: 'Intéressé', icon: CheckCircle2, color: 'bg-green-100 text-green-800' },
  ORDERED: { label: 'Commandé', icon: Tag, color: 'bg-emerald-100 text-emerald-800' },
  CALLBACK_REQUESTED: { label: 'Rappel demandé', icon: Clock, color: 'bg-orange-100 text-orange-800' },
  NOT_INTERESTED: { label: 'Pas intéressé', icon: AlertCircle, color: 'bg-red-100 text-red-800' },
  UNREACHABLE: { label: 'Injoignable', icon: AlertCircle, color: 'bg-gray-100 text-gray-800' },
  INVALID: { label: 'Invalide', icon: AlertCircle, color: 'bg-red-100 text-red-800' },
  PUSHED_TO_DELIVERY: { label: 'En livraison', icon: Truck, color: 'bg-indigo-100 text-indigo-800' },
};

export default function AdminLeads() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showStats, setShowStats] = useState(true);
  const limit = 20;

  const { data: leadsData, isLoading, refetch } = useQuery({
    queryKey: ['admin-all-leads', { page, search, statusFilter }],
    queryFn: () => leadsApi.list({ 
      page, 
      limit, 
      search, 
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      viewMode: 'ALL'
    }),
  });

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
        <div className="relative">
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
                <th className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                <th className="px-5 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-5 py-4"><div className="h-10 bg-gray-100 rounded-lg w-full"></div></td>
                  </tr>
                ))
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-400 font-medium">
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
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${statusInfo.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusInfo.label}
                        </span>
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
                          <button className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-all" title="Détails">
                            <Edit className="w-4 h-4" />
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
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { leadsApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

type TabType = 'ALL' | 'MY_LEADS' | 'AVAILABLE' | 'PUSHED';

export default function AgentMyLeads() {
  const [activeTab, setActiveTab ] = useState<TabType>('ALL');
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [claiming, setClaiming ] = useState<number | null>(null);
  const navigate = useNavigate();

  const loadData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      let response;
      if (activeTab === 'ALL') {
        response = await leadsApi.list({ 
            page, 
            limit: 15, 
            search, 
            viewMode: 'ALL'
        });
      } else if (activeTab === 'AVAILABLE') {
        response = await leadsApi.available();
        const data = response.data?.data || response.data;
        setLeads(data.leads || []);
        setPagination({ page: 1, limit: 100, total: (data.leads || []).length, totalPages: 1 });
        setLoading(false);
        return;
      } else {
        let status = '';
        if (activeTab === 'PUSHED') {
          status = 'PUSHED_TO_DELIVERY';
        } else if (activeTab === 'MY_LEADS') {
          status = 'ASSIGNED,CALL_LATER,NO_REPLY,CONFIRMED,WRONG_ORDER,CANCEL_REASON_PRICE,CANCEL_ORDER';
        }
        
        response = await leadsApi.list({ 
            page, 
            limit: 15, 
            search, 
            status 
        });
      }
      const data = response.data?.data || response.data;
      setLeads(data.leads || []);
      setPagination(data.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (error) {
      console.error('Failed to load leads:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadData(1);
    }, 400);
    return () => clearTimeout(timeout);
  }, [loadData]);

  const handleClaim = async (leadId: number) => {
    setClaiming(leadId);
    try {
      await leadsApi.claim(leadId);
      toast.success('Lead réclamé !');
      setActiveTab('MY_LEADS');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erreur lors de la réclamation');
    } finally {
      setClaiming(null);
    }
  };

  const handlePushToDelivery = async (lead: any) => {
    try {
      await leadsApi.pushToDelivery(lead.id, { productId: lead.product?.id || 0 });
      toast.success('Commande créée avec succès !');
      loadData(pagination.page);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la création de la commande');
    }
  };

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'ALL', label: 'Tout', icon: '🌐' },
    { id: 'MY_LEADS', label: '👤 Mes Prospects', icon: '👤' },
    { id: 'AVAILABLE', label: '🔔 Disponibles', icon: '🔔' },
    { id: 'PUSHED', label: '📦 Commandes Pushées', icon: '📦' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">📋 Tous les Prospects</h1>
          <p className="text-sm text-gray-500 mt-1">Vue centralisée pour gérer, réclamer et suivre vos leads.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 p-1 bg-gray-100 rounded-2xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative max-w-md">
            <input
                type="text"
                placeholder="Rechercher par nom, téléphone, ville..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary-500"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
        </div>
      </div>

      {/* List / Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-[11px] font-black uppercase text-gray-500 tracking-wider">
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-200 border-t-primary-500"></div>
                        <span className="text-gray-400 text-xs font-medium">Chargement...</span>
                    </div>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center">
                            <span className="text-2xl">📭</span>
                        </div>
                        <div>
                            <p className="text-gray-900 font-bold">Aucun prospect</p>
                            <p className="text-gray-400 text-xs mt-1">Aucune donnée trouvée dans cet onglet.</p>
                        </div>
                    </div>
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-black text-sm">
                          {lead.fullName?.charAt(0) || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 truncate text-sm">{lead.fullName}</p>
                          <p className="text-[11px] text-gray-400 flex items-center gap-1">📍 {lead.city || 'Inconnue'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <a href={`tel:${lead.phone}`} className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">
                        {lead.phone}
                      </a>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider w-fit ${
                          lead.status === 'ASSIGNED' ? 'bg-amber-100 text-amber-700' :
                          lead.status === 'CALL_LATER' ? 'bg-blue-100 text-blue-700' :
                          lead.status === 'NO_REPLY' ? 'bg-gray-100 text-gray-700' :
                          lead.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                          lead.status === 'WRONG_ORDER' ? 'bg-amber-100 text-amber-700' :
                          lead.status === 'CANCEL_REASON_PRICE' ? 'bg-gray-100 text-gray-700' :
                          lead.status === 'CANCEL_ORDER' ? 'bg-red-100 text-red-700' :
                          lead.status === 'PUSHED_TO_DELIVERY' ? 'bg-indigo-100 text-indigo-700' :
                          lead.status === 'NEW' || lead.status === 'AVAILABLE' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {lead.status === 'PUSHED_TO_DELIVERY' ? 'EN LIVRAISON' : lead.status}
                        </span>
                        {lead.callbackAt && lead.status === 'CALL_LATER' && (
                          <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 flex items-center gap-1 w-fit">
                            ⏰ {format(new Date(lead.callbackAt), 'dd/MM HH:mm')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[11px] text-gray-400">
                      {format(new Date(lead.createdAt), 'dd MMMM yyyy HH:mm')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(activeTab === 'MY_LEADS' || (activeTab === 'ALL' && lead.assignedAgentId)) && lead.status !== 'PUSHED_TO_DELIVERY' && (
                          <>
                            <button
                              onClick={() => navigate(`/agent/leads/${lead.id}`)}
                              className="p-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-all flex items-center gap-1.5 text-[10px] font-bold"
                            >
                                👁️ Détails
                            </button>
                            {['ORDERED', 'CONFIRMED'].includes(lead.status) && (
                              <button
                                onClick={() => handlePushToDelivery(lead)}
                                className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all flex items-center gap-1.5 text-[10px] font-bold"
                              >
                                  🚚 Envoyer
                              </button>
                            )}
                          </>
                        )}
                        {(activeTab === 'AVAILABLE' || (activeTab === 'ALL' && !lead.assignedAgentId)) && (
                          <button
                            onClick={() => handleClaim(lead.id)}
                            disabled={claiming === lead.id}
                            className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-all text-[10px] font-black uppercase tracking-tighter"
                          >
                            {claiming === lead.id ? '⏳...' : '⚡ Réclamer'}
                          </button>
                        )}
                        {(activeTab === 'PUSHED' || (activeTab === 'ALL' && lead.status === 'PUSHED_TO_DELIVERY')) && (
                           <button
                             onClick={() => navigate(`/agent/orders`)}
                             className="p-1.5 bg-indigo-50 color-indigo-600 rounded-lg hover:bg-indigo-100 transition-all text-[10px] font-bold"
                           >
                               📦 Voir Commande
                           </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && activeTab !== 'AVAILABLE' && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            disabled={pagination.page === 1}
            onClick={() => loadData(pagination.page - 1)}
            className="p-2 rounded-xl bg-white border border-gray-200 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-bold text-gray-700">
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            disabled={pagination.page === pagination.totalPages}
            onClick={() => loadData(pagination.page + 1)}
            className="p-2 rounded-xl bg-white border border-gray-200 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

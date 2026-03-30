import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { leadsApi } from '../../lib/api';
import { format } from 'date-fns';

const STATUS_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  NEW: { label: 'Nouveau', icon: '🆕', color: 'bg-blue-100 text-blue-800' },
  AVAILABLE: { label: 'Disponible', icon: '🟢', color: 'bg-emerald-100 text-emerald-800' },
  ASSIGNED: { label: 'Assigné', icon: '👤', color: 'bg-amber-100 text-amber-800' },
  CONTACTED: { label: 'Contacté', icon: '📞', color: 'bg-blue-100 text-blue-800' },
  INTERESTED: { label: 'Intéressé', icon: '✅', color: 'bg-green-100 text-green-800' },
  ORDERED: { label: 'Commandé', icon: '🛒', color: 'bg-emerald-100 text-emerald-800' },
  CALLBACK_REQUESTED: { label: 'Rappel demandé', icon: '🔁', color: 'bg-orange-100 text-orange-800' },
  NOT_INTERESTED: { label: 'Pas intéressé', icon: '❌', color: 'bg-red-100 text-red-800' },
  UNREACHABLE: { label: 'Injoignable', icon: '📵', color: 'bg-gray-100 text-gray-800' },
  INVALID: { label: 'Invalide', icon: '🚫', color: 'bg-red-100 text-red-800' },
  PUSHED_TO_DELIVERY: { label: 'En livraison', icon: '🚚', color: 'bg-indigo-100 text-indigo-800' },
};

export default function AdminLeadHistory() {
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [leadDetail, setLeadDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch] = useState('');

  const { data: leadsData, isLoading } = useQuery({
    queryKey: ['admin-leads', { viewMode: 'ALL' }],
    queryFn: () => leadsApi.list({ viewMode: 'ALL', limit: 200 }),
  });

  const leads = leadsData?.data?.data?.leads || [];

  const filteredLeads = leads.filter((lead: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      lead.fullName?.toLowerCase().includes(q) ||
      lead.phone?.includes(q) ||
      lead.city?.toLowerCase().includes(q)
    );
  });

  const loadHistory = async (leadId: number) => {
    setSelectedLeadId(leadId);
    setLoadingDetail(true);
    try {
      const res = await leadsApi.detail(leadId);
      const d = res.data?.data || res.data;
      setLeadDetail(d);
    } catch {
      setLeadDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = STATUS_LABELS[status] || { label: status, icon: '', color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-bold ${s.color}`}>
        {s.icon} {s.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">📋 Historique des Leads</h1>
        <p className="text-gray-500 mt-1">Consultez l'historique de confirmation de chaque lead.</p>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher par nom, téléphone ou ville..."
            className="input pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leads List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-5 py-3">
              <h2 className="text-white font-bold text-sm">Tous les Leads ({filteredLeads.length})</h2>
            </div>
            <div className="divide-y divide-gray-50 max-h-[70vh] overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center text-gray-400">Chargement...</div>
              ) : filteredLeads.length === 0 ? (
                <div className="p-8 text-center text-gray-400">Aucun lead trouvé</div>
              ) : (
                filteredLeads.map((lead: any) => (
                  <button
                    key={lead.id}
                    onClick={() => loadHistory(lead.id)}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                      selectedLeadId === lead.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{lead.fullName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{lead.phone}</p>
                        {lead.city && <p className="text-xs text-gray-400">{lead.city}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(lead.status)}
                        <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      {lead.assignedAgent?.fullName && (
                        <span className="text-xs text-purple-600 font-medium">
                          👤 {lead.assignedAgent.fullName}
                        </span>
                      )}
                      <span className="text-xs text-gray-300">
                        {new Date(lead.createdAt).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* History Detail Panel */}
        <div className="lg:col-span-2">
          {!selectedLeadId ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
              <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Sélectionnez un lead</h3>
              <p className="text-gray-500">Cliquez sur l'icône 👁️ d'un lead pour voir son historique complet.</p>
            </div>
          ) : loadingDetail ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-500 mx-auto"></div>
              <p className="text-gray-400 mt-4">Chargement de l'historique...</p>
            </div>
          ) : leadDetail ? (
            <div className="space-y-4">
              {/* Lead Info Card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4">
                  <h2 className="text-white font-bold flex items-center gap-2">👤 {leadDetail.lead?.fullName}</h2>
                  <p className="text-white/70 text-sm mt-1">{leadDetail.lead?.phone} • {leadDetail.lead?.city || 'Ville non spécifiée'}</p>
                </div>
                <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-medium">Statut actuel</p>
                    <div className="mt-1">{getStatusBadge(leadDetail.lead?.status)}</div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-medium">Agent</p>
                    <p className="text-sm font-bold text-gray-700 mt-1">
                      {leadDetail.lead?.assignedAgent?.profile?.fullName || 'Non assigné'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-medium">Influenceur</p>
                    <p className="text-sm font-bold text-gray-700 mt-1">
                      {leadDetail.influencer?.fullName || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-medium">Créé le</p>
                    <p className="text-sm font-bold text-gray-700 mt-1">
                      {leadDetail.lead?.createdAt ? format(new Date(leadDetail.lead.createdAt), 'dd MMM yyyy HH:mm') : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status History Timeline */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="font-bold text-gray-900 mb-5 flex items-center gap-2">
                  🔄 Historique des statuts
                  <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {leadDetail.lead?.statusHistory?.length || 0} changements
                  </span>
                </h2>

                {(!leadDetail.lead?.statusHistory || leadDetail.lead.statusHistory.length === 0) ? (
                  <p className="text-gray-400 text-sm text-center py-6">Aucun changement de statut enregistré.</p>
                ) : (
                  <div className="space-y-4 pt-2">
                    {leadDetail.lead.statusHistory.map((h: any, index: number) => {
                      const oldS = STATUS_LABELS[h.oldStatus] || { label: h.oldStatus, icon: '', color: 'bg-gray-100 text-gray-800' };
                      const newS = STATUS_LABELS[h.newStatus] || { label: h.newStatus, icon: '', color: 'bg-gray-100 text-gray-800' };

                      return (
                        <div key={h.id || index} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className={`w-3 h-3 rounded-full mt-1 ${
                              h.newStatus === 'ORDERED' ? 'bg-emerald-500' :
                              h.newStatus === 'AVAILABLE' ? 'bg-yellow-500' :
                              h.newStatus === 'ASSIGNED' ? 'bg-amber-500' :
                              ['NOT_INTERESTED', 'INVALID'].includes(h.newStatus) ? 'bg-red-500' :
                              'bg-indigo-500'
                            }`} />
                            {index !== leadDetail.lead.statusHistory.length - 1 && (
                              <div className="w-px h-full bg-gray-200 my-1" />
                            )}
                          </div>
                          <div className="flex-1 pb-4">
                            <div className="flex flex-wrap justify-between items-start gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-medium text-gray-400 line-through">
                                  {oldS.icon} {oldS.label}
                                </span>
                                <span className="text-gray-300">➔</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${newS.color}`}>
                                  {newS.icon} {newS.label}
                                </span>
                              </div>
                              <span className="text-xs font-medium text-gray-400 whitespace-nowrap">
                                {format(new Date(h.createdAt), 'dd MMM yyyy HH:mm:ss')}
                              </span>
                            </div>
                            {h.changer && (
                              <p className="text-xs text-purple-600 font-medium mt-1">
                                👤 Par: {h.changer.profile?.fullName || h.changer.email}
                              </p>
                            )}
                            {h.notes && (
                              <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2.5 rounded-lg border border-gray-100 italic">
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
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

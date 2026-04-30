import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { leadsApi } from '../../lib/api';
import { socket, connectToCallCenter, disconnectSocket } from '../../lib/socket';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function AgentLeads() {
  const [availableLeads, setAvailableLeads] = useState<any[]>([]);
  const [myLeads, setMyLeads] = useState<any[]>([]);
  const [hasActiveLead, setHasActiveLead] = useState(false);
  const [activeLeadId, setActiveLeadId] = useState<number | null>(null);
  const [assignedInfluencers, setAssignedInfluencers] = useState<any[]>([]);
  const [selectedInfluencerId, setSelectedInfluencerId] = useState<number | ''>('');
  const [claiming, setClaiming] = useState<number | null>(null);
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    try {
      const [availRes, myRes] = await Promise.all([
        leadsApi.available(selectedInfluencerId ? { influencerId: selectedInfluencerId } : undefined),
        leadsApi.list({ status: '' })
      ]);
      const availData = availRes.data?.data || availRes.data;
      setAvailableLeads(availData?.leads || []);
      setHasActiveLead(availData?.hasActiveLead || false);
      setActiveLeadId(availData?.activeLeadId || null);
      setAssignedInfluencers(availData?.assignedInfluencers || []);

      const myData = myRes.data?.data || myRes.data;
      setMyLeads(myData?.leads || []);
    } catch (error) {
      console.error('Failed to load leads:', error);
    }
  }, [selectedInfluencerId]);

  useEffect(() => {
    loadData();
    connectToCallCenter();

    // Real-time events
    socket.on('new-available-lead', (lead: any) => {
      // Basic client-side filter if an influencer is selected
      if (selectedInfluencerId && lead.influencer?.id !== selectedInfluencerId) return;
      
      setAvailableLeads(prev => [lead, ...prev]);
      toast('⚡ Nouveau lead disponible!', { icon: '🔔', duration: 4000 });
    });

    socket.on('lead-claimed', ({ leadId }: { leadId: number }) => {
      setAvailableLeads(prev => prev.filter(l => l.id !== leadId));
    });

    // Poll every 8s as fallback
    const interval = setInterval(loadData, 8000);

    return () => {
      clearInterval(interval);
      socket.off('new-available-lead');
      socket.off('lead-claimed');
      disconnectSocket();
    };
  }, [loadData, selectedInfluencerId]);

  const handleClaim = async (leadId: number) => {
    if (hasActiveLead) {
      toast.error('Terminez votre lead en cours avant d\'en réclamer un autre.');
      if (activeLeadId) navigate(`/agent/leads/${activeLeadId}`);
      return;
    }
    setClaiming(leadId);
    try {
      await leadsApi.claim(leadId);
      toast.success('Lead réclamé! Redirection...');
      navigate(`/agent/leads/${leadId}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Ce lead a déjà été pris!');
      loadData();
    } finally {
      setClaiming(null);
    }
  };

  // We still want to let the user see the page header and dropdown even while loading
  // So we'll remove the blocking full-page loader.
  
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Gestion des Leads</h1>
          <p className="text-sm text-gray-500 mt-1">Réclamez des leads et contactez-les en premier!</p>
        </div>
        {hasActiveLead && activeLeadId && (
          <button
            onClick={() => navigate(`/agent/leads/${activeLeadId}`)}
            className="px-5 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 transition-all animate-pulse"
          >
            ⚡ Continuer mon lead en cours
          </button>
        )}
      </div>

      {/* Available Leads Pool */}
      <div className="space-y-4">
        {/* Fixed Header with Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <h2 className="text-lg font-bold text-gray-900">⚡ Leads Disponibles</h2>
              {availableLeads.length > 0 && (
                <span className="absolute -top-1 -right-8 bg-red-500 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center animate-bounce">
                  {availableLeads.length}
                </span>
              )}
            </div>
          </div>
          
          {assignedInfluencers.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500 font-medium whitespace-nowrap">Influenceur:</label>
              <select
                value={selectedInfluencerId}
                onChange={(e) => setSelectedInfluencerId(e.target.value === '' ? '' : Number(e.target.value))}
                className="input py-1.5 px-3 border-gray-200 bg-white text-sm min-w-[180px]"
              >
                <option value="">Tous mes influenceurs</option>
                {assignedInfluencers.map(inf => (
                  <option key={inf.id} value={inf.id}>{inf.fullName}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Conditional Leads/Empty Render */}
        {availableLeads.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableLeads.map((lead) => (
              <div
                key={lead.id}
                className="relative bg-white rounded-2xl border-2 border-dashed border-green-300 p-5 hover:border-green-500 hover:shadow-lg transition-all group"
              >
                {/* Pulse indicator */}
                <div className="absolute top-3 right-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold">
                    {lead.fullName?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{lead.fullName}</p>
                    <p className="text-xs text-gray-400">{lead.city || 'Ville inconnue'}</p>
                  </div>
                </div>

                {lead.product && (
                  <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded-lg">
                    {lead.product.image && (
                      <img src={lead.product.image} alt="" className="w-8 h-8 rounded-lg object-cover" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-700 truncate">{lead.product.name}</p>
                      <p className="text-[10px] text-gray-400">SKU: {lead.product.sku}</p>
                    </div>
                  </div>
                )}

                {lead.influencer && (
                  <p className="text-[10px] text-gray-400 mb-3">
                    Référé par: <span className="text-gray-600 font-medium">{lead.influencer.fullName}</span>
                  </p>
                )}

                <p className="text-[10px] text-gray-400 mb-3">
                  {format(new Date(lead.createdAt), 'dd MMM yyyy HH:mm')}
                </p>

                <button
                  onClick={() => handleClaim(lead.id)}
                  disabled={claiming === lead.id || hasActiveLead}
                  className={`w-full py-2.5 rounded-xl text-sm font-extrabold transition-all ${
                    hasActiveLead
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : claiming === lead.id
                        ? 'bg-green-300 text-white cursor-wait'
                        : 'bg-green-500 text-white hover:bg-green-600 hover:scale-[1.02] active:scale-95 shadow-lg shadow-green-200'
                  }`}
                >
                  {claiming === lead.id ? '⏳ Réclamation...' : hasActiveLead ? '🔒 Bloqué (Lead en cours)' : '⚡ RÉCLAMER'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center mt-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📭</span>
            </div>
            <p className="text-gray-500 font-medium">Aucun lead disponible</p>
            <p className="text-gray-400 text-sm mt-1">Les nouveaux leads apparaîtront ici en temps réel.</p>
          </div>
        )}
      </div>

      {/* My Claimed Leads */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900">📋 Mes Leads ({myLeads.length})</h2>

        {myLeads.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myLeads.map((lead: any) => (
              <div key={lead.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-primary-700 font-semibold">{lead.fullName.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{lead.fullName}</p>
                      <p className="text-sm text-gray-500">{lead.city || 'Ville inconnue'}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    lead.status === 'ASSIGNED' ? 'bg-amber-100 text-amber-800' :
                    lead.status === 'CONTACTED' ? 'bg-blue-100 text-blue-800' :
                    lead.status === 'INTERESTED' ? 'bg-green-100 text-green-800' :
                    lead.status === 'ORDERED' ? 'bg-emerald-100 text-emerald-800' :
                    lead.status === 'NOT_INTERESTED' ? 'bg-red-100 text-red-800' :
                    lead.status === 'UNREACHABLE' ? 'bg-gray-100 text-gray-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {lead.status}
                  </span>
                </div>

                <div className="space-y-1.5 mb-4">
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    📞 <a href={`tel:${lead.phone}`} className="hover:text-primary-600 font-medium">{lead.phone}</a>
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/agent/leads/${lead.id}`)}
                      className={`flex-1 py-2 text-white rounded-xl text-xs font-bold transition-all ${
                        lead.status === 'ASSIGNED' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-gray-800 hover:bg-gray-900'
                      }`}
                    >
                      {lead.status === 'ASSIGNED' ? '▶ Traiter' : '👁️ Détails'}
                    </button>
                    <a
                      href={`tel:${lead.phone}`}
                      className="flex-1 py-2 bg-primary-500 text-white rounded-xl text-xs font-bold hover:bg-primary-600 transition-all text-center flex justify-center items-center gap-1"
                    >
                      📞 Appeler
                    </a>
                  </div>
                  {lead.status === 'ORDERED' && (
                    <button
                      onClick={async () => {
                        try {
                          await leadsApi.pushToDelivery(lead.id, { productId: lead.product?.id || 0 });
                          toast.success('Commande créée avec succès !');
                          loadData();
                        } catch (err: any) {
                          toast.error(err.response?.data?.message || 'Erreur lors de la création de la commande');
                        }
                      }}
                       className="w-full py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-all shadow-md flex justify-center items-center gap-2"
                    >
                      🚚 Envoyer à la livraison
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400">Réclamez des leads depuis la section ci-dessus!</p>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
            <div className="flex flex-wrap items-center gap-2 relative w-full sm:w-auto" ref={dropdownRef}>
              <label className="text-sm text-gray-500 font-medium whitespace-nowrap">Vendeur/Influenceur:</label>

              <div className="relative w-full sm:w-auto sm:min-w-[240px]">
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(!isDropdownOpen);
                    setDropdownSearch('');
                  }}
                  className="w-full flex items-center justify-between py-2 px-3 border border-gray-200 bg-white rounded-xl text-sm font-semibold hover:border-gray-300 transition-colors shadow-sm text-left"
                >
                  <span className="truncate min-w-0">
                    {selectedInfluencerId
                      ? assignedInfluencers.find(inf => inf.id === selectedInfluencerId)?.fullName || 'Tous mes influenceurs/vendeurs'
                      : 'Tous mes influenceurs/vendeurs'
                    }
                  </span>
                  <span className="text-gray-400 shrink-0 ml-2">▼</span>
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-full sm:w-72 bg-white rounded-2xl border border-gray-100 shadow-xl z-50 p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="relative">
                      <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">🔍</span>
                      <input
                        type="text"
                        autoFocus
                        value={dropdownSearch}
                        onChange={(e) => setDropdownSearch(e.target.value)}
                        placeholder="Rechercher par nom ou email..."
                        className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedInfluencerId('');
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-colors flex flex-col gap-0.5 ${
                          selectedInfluencerId === ''
                            ? 'bg-indigo-50 text-indigo-600'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span>Tous mes influenceurs/vendeurs</span>
                      </button>

                      {assignedInfluencers
                        .filter(inf => 
                          (inf.fullName || '').toLowerCase().includes(dropdownSearch.toLowerCase()) ||
                          (inf.email || '').toLowerCase().includes(dropdownSearch.toLowerCase())
                        )
                        .map(inf => (
                          <button
                            key={inf.id}
                            type="button"
                            onClick={() => {
                              setSelectedInfluencerId(inf.id);
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-colors flex flex-col gap-0.5 mt-1 ${
                              selectedInfluencerId === inf.id
                                ? 'bg-indigo-50 text-indigo-600'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <span className="font-extrabold">{inf.fullName}</span>
                            {inf.email && (
                              <span className="text-[10px] text-gray-400 font-medium normal-case">{inf.email}</span>
                            )}
                          </button>
                        ))
                      }

                      {assignedInfluencers.filter(inf => 
                        (inf.fullName || '').toLowerCase().includes(dropdownSearch.toLowerCase()) ||
                        (inf.email || '').toLowerCase().includes(dropdownSearch.toLowerCase())
                      ).length === 0 && (
                        <p className="text-center text-[10px] text-gray-400 py-3 font-semibold">Aucun partenaire trouvé</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Conditional Leads/Empty Render */}
        {availableLeads.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableLeads.map((lead, index) => {
              const timeVal = lead.updatedAt || lead.createdAt;
              const leadTime = timeVal ? new Date(timeVal).getTime() : 0;
              const isNew = leadTime > 0 && (new Date().getTime() - leadTime) <= 5 * 60 * 1000;
              const isTopNewest = isNew && index === 0;

              return (
                <div
                  key={lead.id}
                  className={`relative bg-white rounded-2xl border-2 border-dashed p-5 hover:shadow-lg transition-all group ${
                    isNew ? 'border-green-400 ring-2 ring-green-400/50 shadow-md shadow-green-100' : 'border-green-300 hover:border-green-500'
                  }`}
                >
                  {/* 5-minute NOUVEAU Badge */}
                  {isNew && (
                    <div className="absolute -top-3 left-4 z-10">
                      <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-emerald-500 via-teal-500 to-green-500 text-white shadow-md border border-white animate-bounce">
                        ✨ {isTopNewest ? 'LEAD RÉCENT 🔥' : 'NOUVEAU'}
                      </span>
                    </div>
                  )}

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
            );
          })}
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

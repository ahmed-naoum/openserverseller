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
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [claiming, setClaiming] = useState<number | null>(null);

  // Delivery Modal State
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [selectedLeadForDelivery, setSelectedLeadForDelivery] = useState<any>(null);
  const [coliatyCities, setColiatyCities] = useState<any[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [isPushingDelivery, setIsPushingDelivery] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({
    name: '',
    phone: '',
    city: '',
    address: '',
    price: 0,
    package_no_open: false
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    try {
      const [availRes, myRes] = await Promise.all([
        leadsApi.available(selectedInfluencerId ? { influencerId: selectedInfluencerId } : undefined),
        leadsApi.list({ status: statusFilter })
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
  }, [selectedInfluencerId, statusFilter]);

  const loadCities = async () => {
    if (coliatyCities.length > 0) return;
    setLoadingCities(true);
    try {
      const res = await leadsApi.getColiatyCities();
      if (res.data?.data) {
        setColiatyCities(res.data.data);
      }
    } catch (err: any) {
      toast.error('Erreur lors du chargement des villes Coliaty');
    } finally {
      setLoadingCities(false);
    }
  };

  const handleOpenDeliveryModal = (lead: any) => {
    setSelectedLeadForDelivery(lead);
    setDeliveryForm({
      name: lead.fullName || '',
      phone: lead.phone || '',
      city: lead.city || '',
      address: lead.address || '',
      price: lead.productPrice || 0,
      package_no_open: false
    });
    setShowDeliveryModal(true);
    setFormErrors({});
    loadCities();
  };

  const validateDeliveryForm = () => {
    const errors: Record<string, string> = {};
    
    if (!deliveryForm.name || deliveryForm.name.trim().length < 3) {
      errors.name = "Le nom doit contenir au moins 3 caractères.";
    }
    
    const phoneDigits = deliveryForm.phone.replace(/\D/g, '');
    if (!phoneDigits.startsWith('0') || phoneDigits.length !== 10) {
      errors.phone = "Le téléphone doit être au format 0612345678 (10 chiffres).";
    }

    if (!deliveryForm.city) {
      errors.city = "La ville est obligatoire.";
    }

    if (!deliveryForm.address || deliveryForm.address.trim().length < 10) {
      errors.address = "L'adresse doit être détaillée (min. 10 caractères).";
    }

    if (deliveryForm.price <= 0) {
      errors.price = "Le prix doit être supérieur à 0.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleConfirmDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadForDelivery) return;
    
    if (!validateDeliveryForm()) {
      toast.error('Veuillez corriger les erreurs dans le formulaire.');
      return;
    }
    
    setIsPushingDelivery(true);
    try {
      await leadsApi.pushToDelivery(selectedLeadForDelivery.id, {
        package_reciever: deliveryForm.name,
        package_phone: deliveryForm.phone,
        package_city: deliveryForm.city,
        package_addresse: deliveryForm.address,
        package_price: deliveryForm.price,
        package_no_open: deliveryForm.package_no_open
      });
      toast.success('Lead poussé à la livraison sur Coliaty!');
      setShowDeliveryModal(false);
      loadData();
    } catch (err: any) {
      console.error('[Coliaty Push Error]', err.response?.data);
      const errorMessage = err.response?.data?.message || 'Erreur lors de la création de la commande';
      toast.error(errorMessage);
    } finally {
      setIsPushingDelivery(false);
    }
  };

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
  }, [loadData]);

  const handleCall = async (phone: string, leadId: number) => {
    window.location.href = `tel:${phone}`;
    try {
      if (myLeads.find(l => l.id === leadId)?.status === 'ASSIGNED') {
         await leadsApi.updateStatus(leadId.toString(), { status: 'CONTACTED' });
         loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelLead = async (id: number) => {
    try {
      await leadsApi.delete(id.toString());
      toast.success('Lead complètement supprimé.');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'annulation');
    }
  };

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
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-700 truncate">{lead.product.name}</p>
                      <p className="text-[10px] text-gray-400">SKU: {lead.product.sku}</p>
                    </div>
                    {lead.productPrice > 0 && (
                      <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg whitespace-nowrap">
                        {Number(lead.productPrice).toFixed(2)} MAD
                      </span>
                    )}
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
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">📋 Mes Leads ({myLeads.length})</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500">Statut:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none cursor-pointer"
            >
              <option value="">Tous les statuts</option>
              <option value="ASSIGNED">Assigné</option>
              <option value="CONTACTED">Contacté</option>
              <option value="INTERESTED">Intéressé</option>
              <option value="ORDERED">Commandé</option>
              <option value="CALLBACK_REQUESTED">Rappel demandé</option>
              <option value="NOT_INTERESTED">Pas intéressé</option>
              <option value="UNREACHABLE">Injoignable</option>
              <option value="INVALID">Invalide</option>
            </select>
          </div>
        </div>

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
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600 flex items-center gap-2">
                      📞 <a href={`tel:${lead.phone}`} className="hover:text-primary-600 font-medium">{lead.phone}</a>
                    </p>
                    <a
                      href={`https://wa.me/212${(lead.whatsapp || lead.phone || '').replace(/[^0-9]/g, '').replace(/^(212|0)/, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-green-600 font-bold hover:underline flex items-center gap-1 bg-green-50 px-2.5 py-1 rounded-lg"
                      title="Contacter sur WhatsApp"
                    >
                      💬 WhatsApp
                    </a>
                  </div>
                </div>

                {lead.product && (
                  <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded-lg">
                    {lead.product.image && (
                      <img src={lead.product.image} alt="" className="w-8 h-8 rounded-lg object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-700 truncate">{lead.product.name}</p>
                      <p className="text-[10px] text-gray-400">SKU: {lead.product.sku}</p>
                    </div>
                    {lead.productPrice > 0 && (
                      <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg whitespace-nowrap">
                        {Number(lead.productPrice).toFixed(2)} MAD
                      </span>
                    )}
                  </div>
                )}

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
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCancelLead(lead.id)}
                         className="px-3 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-all shadow-sm flex items-center justify-center border border-red-200"
                         title="Annuler le lead"
                      >
                        ❌
                      </button>
                      <button
                        onClick={() => handleOpenDeliveryModal(lead)}
                         className="flex-1 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-all shadow-md flex justify-center items-center gap-2"
                      >
                        🚚 Envoyer à la livraison
                      </button>
                    </div>
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

      {showDeliveryModal && selectedLeadForDelivery && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden animate-slide-up">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-600"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                📦 Confirmation Coliaty
              </h3>
              <button 
                onClick={() => setShowDeliveryModal(false)}
                className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-all"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleConfirmDelivery} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom Complet du Destinataire</label>
                <input
                  type="text"
                  required
                  value={deliveryForm.name}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, name: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none ${
                    formErrors.name ? 'border-red-500 bg-red-50' : 'border-gray-200'
                  }`}
                />
                {formErrors.name && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <input
                  type="tel"
                  required
                  value={deliveryForm.phone}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, phone: e.target.value })}
                   className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none ${
                    formErrors.phone ? 'border-red-500 bg-red-50' : 'border-gray-200'
                  }`}
                  placeholder="Ex: 0612345678"
                />
                {formErrors.phone && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.phone}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ville (Sélection Coliaty)</label>
                {loadingCities ? (
                  <div className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 animate-pulse">
                    Chargement des villes...
                  </div>
                ) : (
                  <select
                    required
                    value={deliveryForm.city}
                    onChange={(e) => setDeliveryForm({ ...deliveryForm, city: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none max-h-48 overflow-y-auto ${
                      formErrors.city ? 'border-red-500 bg-red-50' : 'border-gray-200'
                    }`}
                  >
                    <option value="">Sélectionner une ville...</option>
                    {coliatyCities.map((city) => (
                      <option key={city.city_id} value={city.city_name}>
                        {city.city_name} (Hub: {city.hub_name})
                      </option>
                    ))}
                  </select>
                )}
                {formErrors.city && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.city}</p>}
                {deliveryForm.city === '' && !loadingCities && selectedLeadForDelivery.city && (
                  <p className="text-xs text-amber-600 mt-1">Ville du prospect ({selectedLeadForDelivery.city}) non trouvée. Veuillez sélectionner manuellement.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adresse Détaillée</label>
                <textarea
                  required
                  rows={2}
                  value={deliveryForm.address}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, address: e.target.value })}
                   className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none ${
                    formErrors.address ? 'border-red-500 bg-red-50' : 'border-gray-200'
                  }`}
                />
                {formErrors.address && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.address}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prix à encaisser (MAD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={deliveryForm.price || ''}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, price: Number(e.target.value) })}
                  className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none ${
                    formErrors.price ? 'border-red-500 bg-red-50' : 'border-gray-200'
                  }`}
                />
                {formErrors.price && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.price}</p>}
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deliveryForm.package_no_open}
                    onChange={(e) => setDeliveryForm({ ...deliveryForm, package_no_open: e.target.checked })}
                    className="w-4 h-4 text-emerald-500 rounded border-gray-300 focus:ring-emerald-500"
                  />
                  Interdire Ouverture (Ne pas ouvrir avant paiement)
                </label>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeliveryModal(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all"
                  disabled={isPushingDelivery}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPushingDelivery || !deliveryForm.city}
                  className="flex-1 flex justify-center items-center gap-2 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isPushingDelivery ? 'Envoi en cours...' : 'Confirmer l\'envoi'} 🚀
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

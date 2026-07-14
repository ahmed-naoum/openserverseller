import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { leadsApi } from '../../lib/api';
import { socket, connectToCallCenter, disconnectSocket } from '../../lib/socket';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Sparkles, Phone, MessageSquare, Zap, Clock, Package, Heart, Filter, ChevronRight, X, AlertCircle, Activity } from 'lucide-react';

const AssignedTimer = ({ lead, onTimeout, isGirly, isPrincess }: { lead: any; onTimeout?: () => void; isGirly: boolean; isPrincess: boolean }) => {
  const [globalCooldown, setGlobalCooldown] = useState<number>(0);

  useEffect(() => {
    const isAssigned = lead.status === 'ASSIGNED';
    const isWrongOrder = lead.status === 'WRONG_ORDER';
    const isCancelOrder = lead.status === 'CANCEL_ORDER';

    if (!isAssigned && !isWrongOrder && !isCancelOrder) return;

    const storageKey = `lead_cooldown_${lead.id}`;
    let savedStart = sessionStorage.getItem(storageKey);
    let parsedStartVal = savedStart ? parseInt(savedStart, 10) : NaN;
    
    // If it's NaN, delete it from storage
    if (savedStart && isNaN(parsedStartVal)) {
      sessionStorage.removeItem(storageKey);
      savedStart = null;
      parsedStartVal = NaN;
    }

    const leadUpdatedTime = lead.updatedAt ? new Date(lead.updatedAt).getTime() : Date.now();
    const startTime = !isNaN(parsedStartVal) 
      ? parsedStartVal 
      : (!isNaN(leadUpdatedTime) ? leadUpdatedTime : Date.now());

    const isShortTimeout = isWrongOrder || isCancelOrder;
    const totalCooldownSeconds = isShortTimeout ? 120 : 420; // 2 mins for short timeouts, 7 mins for ASSIGNED

    const calculateGlobal = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const val = Math.max(0, totalCooldownSeconds - elapsed);
      return isNaN(val) ? 0 : val;
    };

    setGlobalCooldown(calculateGlobal());

    const interval = setInterval(() => {
      const remaining = calculateGlobal();
      setGlobalCooldown(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        if (onTimeout) onTimeout();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lead.status, lead.id, lead.updatedAt, onTimeout]);

  const isAssigned = lead.status === 'ASSIGNED';
  const isWrongOrder = lead.status === 'WRONG_ORDER';
  const isCancelOrder = lead.status === 'CANCEL_ORDER';
  if ((!isAssigned && !isWrongOrder && !isCancelOrder) || isNaN(globalCooldown) || globalCooldown <= 0) return null;

  const isShortTimeout = isWrongOrder || isCancelOrder;

  return (
    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border flex items-center gap-1 animate-pulse ${
      isShortTimeout
        ? 'text-amber-800 bg-amber-50 border-amber-200'
        : isPrincess
        ? 'text-amber-800 bg-amber-50 border-amber-200'
        : isGirly 
        ? 'text-rose-600 bg-rose-50 border-rose-100' 
        : 'text-indigo-600 bg-indigo-50 border-indigo-100'
    }`}>
      ⏱️ {Math.floor(globalCooldown / 60)}:{(Math.floor(globalCooldown % 60)).toString().padStart(2, '0')}
    </span>
  );
};

export default function AgentLeads() {
  const [theme, setTheme] = useState<'classic' | 'girly' | 'princess'>(() => {
    return (localStorage.getItem('agent-theme') as 'classic' | 'girly' | 'princess') || 'girly';
  });

  const changeTheme = (next: 'classic' | 'girly' | 'princess') => {
    setTheme(next);
    localStorage.setItem('agent-theme', next);
    window.dispatchEvent(new Event('agent-theme-change'));
  };

  useEffect(() => {
    const syncTheme = () => {
      const current = (localStorage.getItem('agent-theme') as 'classic' | 'girly' | 'princess') || 'girly';
      setTheme(current);
    };
    window.addEventListener('agent-theme-change', syncTheme);
    return () => window.removeEventListener('agent-theme-change', syncTheme);
  }, []);

  const [availableLeads, setAvailableLeads] = useState<any[]>([]);
  const [myLeads, setMyLeads] = useState<any[]>([]);
  const [hasActiveLead, setHasActiveLead] = useState(false);
  const [activeLeadId, setActiveLeadId] = useState<number | null>(null);
  const [assignedInfluencers, setAssignedInfluencers] = useState<any[]>([]);
  const [selectedInfluencerId, setSelectedInfluencerId] = useState<number | ''>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [claiming, setClaiming] = useState<number | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    package_no_open: false,
    productVariant: ''
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
      const allMyLeads = myData?.leads || [];
      const allowedAgentStatuses = ['ASSIGNED', 'CALL_LATER', 'NO_REPLY', 'CONFIRMED', 'WRONG_ORDER', 'CANCEL_REASON_PRICE', 'CANCEL_ORDER', 'INVALID', 'CONTACTED', 'PRICE_CONFIRMED'];
      setMyLeads(allMyLeads.filter((l: any) => allowedAgentStatuses.includes(l.status)));
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
      package_no_open: false,
      productVariant: lead.productVariant || ''
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

    if (deliveryForm.price < 0) {
      errors.price = "Le prix doit être supérieur ou égal à 0.";
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
        productId: selectedLeadForDelivery.product?.id || 0,
        package_reciever: deliveryForm.name,
        package_phone: deliveryForm.phone,
        package_city: deliveryForm.city,
        package_addresse: deliveryForm.address,
        package_price: deliveryForm.price,
        package_no_open: deliveryForm.package_no_open,
        productVariant: deliveryForm.productVariant
      });
      toast.success(theme === 'girly' ? 'Lead poussé à la livraison sur Coliaty! 🎀' : 'Lead envoyé à la livraison!');
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
      if (selectedInfluencerId && lead.influencer?.id !== selectedInfluencerId) return;

      setAvailableLeads(prev => [lead, ...prev]);
      toast(theme === 'girly' ? '💖 Nouveau lead disponible!' : '⚡ Nouveau lead disponible!', { 
        icon: theme === 'girly' ? '🌸' : '🔔', 
        duration: 4000 
      });
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
  }, [loadData, selectedInfluencerId, theme]);

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

  const handleClaim = async (leadId: number) => {
    if (hasActiveLead) {
      toast.error(theme === 'girly' ? 'Terminez votre lead en cours avant d\'en réclamer un autre. 💕' : 'Vous avez déjà un lead en cours.');
      if (activeLeadId) navigate(`/agent/leads/${activeLeadId}`);
      return;
    }
    setClaiming(leadId);
    try {
      await leadsApi.claim(leadId);
      toast.success(theme === 'girly' ? 'Lead réclamé avec succès! ✨' : 'Lead réclamé avec succès.');
      navigate(`/agent/leads/${leadId}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Ce lead a déjà été pris!');
      loadData();
    } finally {
      setClaiming(null);
    }
  };

  const isClassic = theme === 'classic';
  const isGirly = theme === 'girly';
  const isPrincess = theme === 'princess';

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-1 sm:px-4">
      {/* Sparkly Header */}
      <div className={`rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden transition-all duration-500 ${
        isPrincess
          ? 'bg-gradient-to-r from-amber-500 via-pink-500 to-rose-600'
          : isGirly 
          ? 'bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-500' 
          : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700'
      }`}>
        <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]"></div>
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2.5">
              {isPrincess ? (
                <div className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 rounded-full text-xs font-black uppercase tracking-wider">
                  <Heart className="w-3.5 h-3.5 fill-current animate-pulse text-white" /> Espace Princess Royal 👑
                </div>
              ) : isGirly ? (
                <div className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 rounded-full text-xs font-black uppercase tracking-wider">
                  <Heart className="w-3.5 h-3.5 fill-current animate-pulse text-white" /> Espace Leads Féminin
                </div>
              ) : (
                <div className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 rounded-full text-xs font-black uppercase tracking-wider">
                  <Activity className="w-3.5 h-3.5 text-white animate-pulse" /> Espace Leads Classique
                </div>
              )}
              
              {/* Theme Dropdown Select */}
              <div className="relative inline-block">
                <select
                  value={theme}
                  onChange={(e) => changeTheme(e.target.value as any)}
                  className={`pl-3 pr-8 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-300 shadow-sm border outline-none appearance-none cursor-pointer ${
                    isPrincess 
                      ? 'bg-white text-rose-600 border-white hover:bg-rose-50'
                      : isGirly 
                      ? 'bg-white text-pink-600 border-pink-200/50 hover:bg-pink-50' 
                      : 'bg-white text-indigo-700 border-white hover:bg-indigo-50'
                  }`}
                >
                  <option value="classic" className="text-gray-900 bg-white font-bold">🕶️ Classique</option>
                  <option value="girly" className="text-gray-900 bg-white font-bold">🌸 Thème Girly ✨</option>
                  <option value="princess" className="text-gray-900 bg-white font-bold">💅 Princess Pink 👑</option>
                </select>
                <div className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none font-black text-[8px] ${
                  isPrincess ? 'text-rose-600' : isGirly ? 'text-pink-600' : 'text-indigo-700'
                }`}>
                  ▼
                </div>
              </div>
            </div>

            <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-2 flex items-center gap-2">
              {isPrincess ? 'Gestion Royale des Leads 👑✨' : isGirly ? 'Gestion des Leads 🌸' : 'Gestion des Leads 📋'}
            </h1>
            <p className="text-white/90 text-xs sm:text-sm font-medium">Réclamez des leads et contactez-les avec douceur et efficacité !</p>
          </div>
          {hasActiveLead && activeLeadId && (
            <button
              onClick={() => navigate(`/agent/leads/${activeLeadId}`)}
              className={`px-6 py-3 rounded-2xl text-xs font-black transition-all duration-300 shadow-lg flex items-center gap-2 animate-bounce self-start md:self-auto ${
                isPrincess ? 'bg-white text-rose-600 hover:bg-rose-50' : isGirly ? 'bg-white text-pink-600 hover:bg-pink-50' : 'bg-white text-indigo-700 hover:bg-indigo-50'
              }`}
            >
              {isPrincess || isGirly ? (
                <Sparkles className={`w-4 h-4 animate-pulse ${isPrincess ? 'text-amber-500' : 'text-pink-500'}`} />
              ) : (
                <Activity className="w-4 h-4 text-indigo-500 animate-pulse" />
              )}
              Continuer mon lead en cours
            </button>
          )}
        </div>
      </div>

      {/* Available Leads Pool */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                {isPrincess ? (
                  <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                ) : isGirly ? (
                  <Sparkles className="w-5 h-5 text-pink-500 animate-pulse" />
                ) : (
                  <Zap className="w-5 h-5 text-indigo-500 animate-pulse" />
                )}
                Leads Disponibles
              </h2>
              {availableLeads.length > 0 && (
                <span className={`absolute -top-1 -right-8 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center animate-bounce shadow-md ${
                  isPrincess ? 'bg-amber-500 shadow-amber-200' : isGirly ? 'bg-pink-500 shadow-pink-200' : 'bg-indigo-500 shadow-indigo-200'
                }`}>
                  {availableLeads.length}
                </span>
              )}
            </div>
          </div>
          
          {assignedInfluencers.length > 0 && (
            <div className="flex items-center gap-2 relative" ref={dropdownRef}>
              <Filter className={`w-4 h-4 ${isPrincess ? 'text-amber-400' : isGirly ? 'text-pink-400' : 'text-indigo-400'}`} />
              <span className="text-xs font-black text-gray-500 uppercase">Vendeur/Influenceur:</span>
              
              <div className="relative min-w-[240px]">
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(!isDropdownOpen);
                    setDropdownSearch('');
                  }}
                  className={`w-full flex items-center justify-between py-1.5 px-3 border rounded-xl bg-white text-xs font-bold text-gray-700 outline-none shadow-sm text-left hover:bg-gray-50 transition-all ${
                    isPrincess ? 'border-amber-100' : isGirly ? 'border-pink-100' : 'border-indigo-100'
                  }`}
                >
                  <span className="truncate max-w-[200px]">
                    {selectedInfluencerId
                      ? assignedInfluencers.find(inf => inf.id === selectedInfluencerId)?.fullName || `Tous mes influenceurs/vendeurs ${isPrincess ? '👑' : isGirly ? '🌸' : '📋'}`
                      : `Tous mes influenceurs/vendeurs ${isPrincess ? '👑' : isGirly ? '🌸' : '📋'}`
                    }
                  </span>
                  <span className="text-gray-400">▼</span>
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-gray-100 shadow-xl z-50 p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
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
                        <span>Tous mes influenceurs/vendeurs {isPrincess ? '👑' : isGirly ? '🌸' : '📋'}</span>
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

        {availableLeads.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableLeads.map((lead) => (
              <div
                key={lead.id}
                className={`relative bg-white rounded-3xl border-2 border-dashed p-5 hover:shadow-xl transition-all duration-300 group hover:-translate-y-1 ${
                  isPrincess
                    ? 'border-amber-200 hover:border-amber-500 hover:shadow-amber-50/55'
                    : isGirly 
                    ? 'border-pink-200 hover:border-pink-500 hover:shadow-pink-50/55' 
                    : 'border-indigo-200 hover:border-indigo-500 hover:shadow-indigo-50/55'
                }`}
              >
                <div className="absolute top-4 right-4">
                  <span className="relative flex h-3 w-3">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      isPrincess ? 'bg-amber-400' : isGirly ? 'bg-pink-400' : 'bg-indigo-400'
                    }`}></span>
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${
                      isPrincess ? 'bg-amber-500' : isGirly ? 'bg-pink-500' : 'bg-indigo-500'
                    }`}></span>
                  </span>
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black shadow-inner border border-white ${
                    isPrincess ? 'bg-amber-100 text-amber-600' : isGirly ? 'bg-pink-100 text-pink-600' : 'bg-indigo-100 text-indigo-600'
                  }`}>
                    {lead.fullName?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className={`font-bold text-gray-900 transition-colors ${
                      isPrincess ? 'group-hover:text-amber-600' : isGirly ? 'group-hover:text-pink-600' : 'group-hover:text-indigo-600'
                    }`}>{lead.fullName}</p>
                    <p className="text-xs text-gray-400 font-medium">📍 {lead.city || 'Ville inconnue'}</p>
                  </div>
                </div>

                {lead.product && (
                  <div className={`flex items-center gap-3 mb-4 p-2.5 rounded-2xl border ${
                    isPrincess ? 'bg-amber-50/30 border-amber-100/20' : isGirly ? 'bg-pink-50/30 border-pink-100/20' : 'bg-indigo-50/30 border-indigo-100/20'
                  }`}>
                    {lead.product.image && (
                      <img src={lead.product.image} alt="" className={`w-10 h-10 rounded-xl object-cover border ${
                        isPrincess ? 'border-amber-100' : isGirly ? 'border-pink-100' : 'border-indigo-100'
                      }`} />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-700 truncate">{lead.product.name}</p>
                      <p className="text-[10px] text-gray-400 font-medium">SKU: {lead.product.sku}</p>
                      {lead.productVariant && (
                        <p className={`text-[9px] font-black truncate mt-1 px-2 py-0.5 bg-white rounded-full w-fit border ${
                          isPrincess ? 'text-amber-600 border-amber-100/50' : isGirly ? 'text-pink-600 border-pink-100/50' : 'text-indigo-600 border-indigo-100/50'
                        }`}>
                          📦 {lead.productVariant}
                        </p>
                      )}
                    </div>
                    {lead.productPrice > 0 && (
                      <span className={`text-xs font-black bg-white border px-2 py-1 rounded-xl whitespace-nowrap shadow-sm ${
                        isPrincess ? 'text-amber-600 border-amber-100' : isGirly ? 'text-pink-600 border-pink-100' : 'text-indigo-600 border-indigo-100'
                      }`}>
                        {Number(lead.productPrice).toFixed(2)} MAD
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium mb-4">
                  {lead.influencer && (
                    <span>Par: <span className="text-gray-600 font-bold">{lead.influencer.fullName}</span></span>
                  )}
                  <span>{format(new Date(lead.createdAt), 'dd MMM à HH:mm')}</span>
                </div>

                <button
                  onClick={() => handleClaim(lead.id)}
                  disabled={claiming === lead.id || hasActiveLead}
                  className={`w-full py-3 rounded-2xl text-xs font-black tracking-widest transition-all duration-300 ${
                    hasActiveLead
                      ? 'bg-gray-50 text-gray-400 border border-gray-100 cursor-not-allowed'
                      : claiming === lead.id
                        ? (isPrincess ? 'bg-amber-300 text-white cursor-wait' : isGirly ? 'bg-pink-300 text-white cursor-wait' : 'bg-indigo-300 text-white cursor-wait')
                        : (isPrincess
                            ? 'bg-gradient-to-r from-amber-500 via-pink-500 to-rose-500 text-white hover:opacity-95 shadow-lg shadow-amber-100 hover:shadow-xl active:scale-95'
                            : isGirly 
                            ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:opacity-95 shadow-lg shadow-pink-100 hover:shadow-xl active:scale-95' 
                            : 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:opacity-95 shadow-lg shadow-indigo-100 hover:shadow-xl active:scale-95')
                  }`}
                >
                  {claiming === lead.id ? '⏳ RÉCLAMATION...' : hasActiveLead ? '🔒 DÉJÀ UN LEAD EN COURS' : (isPrincess ? '👑 RÉCLAMER CE LEAD' : isGirly ? '💖 RÉCLAMER CE LEAD' : '⚡ RÉCLAMER CE LEAD')}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className={`bg-white rounded-3xl border p-12 text-center shadow-sm ${isPrincess ? 'border-amber-100/50' : isGirly ? 'border-pink-100/50' : 'border-indigo-100/50'}`}>
            {isPrincess ? (
              <Heart className="w-12 h-12 text-amber-300 mx-auto mb-4 fill-current animate-pulse" />
            ) : isGirly ? (
              <Heart className="w-12 h-12 text-pink-300 mx-auto mb-4 fill-current animate-pulse" />
            ) : (
              <Zap className="w-12 h-12 text-indigo-300 mx-auto mb-4 animate-pulse" />
            )}
            <p className="text-gray-900 font-black text-sm">{isPrincess || isGirly ? 'Tout est tranquille pour l\'instant ! ✨' : 'Aucun lead disponible.'}</p>
            <p className="text-gray-400 text-xs mt-1 font-medium">Les nouveaux leads apparaîtront ici dès qu'ils arrivent.</p>
          </div>
        )}
      </div>

      {/* My Claimed Leads */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
            📋 Mes Leads Assignés ({myLeads.length})
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-gray-400 uppercase">Statut:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`py-1.5 px-3 border rounded-xl bg-white text-xs font-bold text-gray-700 focus:ring-2 outline-none cursor-pointer shadow-sm ${
                isPrincess ? 'border-amber-100 focus:ring-amber-400' : isGirly ? 'border-pink-100 focus:ring-pink-400' : 'border-indigo-100 focus:ring-indigo-400'
              }`}
            >
              <option value="">Tous les statuts {isPrincess ? '👑' : isGirly ? '🌸' : '📋'}</option>
              <option value="ASSIGNED">Assigné</option>
              <option value="CALL_LATER">Rappel</option>
              <option value="NO_REPLY">Pas de réponse</option>
              <option value="CONFIRMED">Confirmé</option>
              <option value="WRONG_ORDER">Mauvaise commande</option>
              <option value="CANCEL_REASON_PRICE">Annulé - Prix</option>
              <option value="CANCEL_ORDER">Annulé</option>
              <option value="PRICE_CONFIRMED">Price CONFIRMED</option>
              <option value="INVALID">Invalide</option>
            </select>
          </div>
        </div>

        {myLeads.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myLeads.map((lead: any) => (
              <div key={lead.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 p-5 relative overflow-hidden flex flex-col justify-between">
                <div className={`absolute top-0 left-0 w-1.5 h-full ${isPrincess ? 'bg-amber-400' : isGirly ? 'bg-pink-400' : 'bg-indigo-400'}`}></div>
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black shadow-inner border border-white ${
                        isPrincess ? 'bg-amber-100 text-amber-600' : isGirly ? 'bg-pink-100 text-pink-600' : 'bg-indigo-100 text-indigo-600'
                      }`}>
                        {lead.fullName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{lead.fullName}</p>
                        <p className="text-xs text-gray-400 font-medium">📍 {lead.city || 'Ville inconnue'}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        lead.status === 'ASSIGNED' ? 'bg-purple-100 text-purple-700' :
                        lead.status === 'CALL_LATER' ? 'bg-orange-100 text-orange-700' :
                        lead.status === 'NO_REPLY' ? 'bg-rose-100 text-rose-700' :
                        lead.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' :
                        lead.status === 'WRONG_ORDER' ? 'bg-amber-100 text-amber-700' :
                        lead.status === 'CANCEL_REASON_PRICE' ? 'bg-red-100 text-red-700' :
                        lead.status === 'PRICE_CONFIRMED' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {lead.status === 'PRICE_CONFIRMED' ? 'PRIX CONFIRMÉ' : lead.status}
                      </span>
                      <AssignedTimer lead={lead} onTimeout={loadData} isGirly={isGirly} isPrincess={isPrincess} />
                      {lead.callbackAt && lead.status === 'CALL_LATER' && (
                        <span className={`text-[9px] font-black bg-white px-2 py-0.5 rounded border flex items-center gap-1 animate-pulse ${
                          isPrincess ? 'text-amber-600 border-amber-100' : isGirly ? 'text-pink-600 border-pink-100' : 'text-indigo-600 border-indigo-100'
                        }`}>
                          ⏰ {format(new Date(lead.callbackAt), 'dd/MM à HH:mm')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 mb-4">
                    <a 
                      href={`tel:${lead.phone}`} 
                      className={`text-xs font-black flex items-center gap-1 px-2.5 py-1.5 rounded-xl border ${
                        isPrincess
                          ? 'text-amber-600 hover:text-amber-700 bg-amber-50 border-amber-100'
                          : isGirly 
                          ? 'text-pink-500 hover:text-pink-600 bg-pink-50 border-pink-100' 
                          : 'text-indigo-500 hover:text-indigo-600 bg-indigo-50 border-indigo-100'
                      }`}
                    >
                      📞 {lead.phone}
                    </a>
                    <a
                      href={`https://wa.me/212${(lead.whatsapp || lead.phone || '').replace(/[^0-9]/g, '').replace(/^(212|0)/, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-green-600 font-bold hover:opacity-90 flex items-center gap-1 bg-green-50 px-2.5 py-1.5 rounded-xl border border-green-100"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-green-500" /> WhatsApp
                    </a>
                  </div>

                  {lead.product && (
                    <div className="flex items-center gap-2 mb-4 p-2 bg-gray-50 rounded-2xl border border-gray-100">
                      {lead.product.image && (
                        <img src={lead.product.image} alt="" className="w-8 h-8 rounded-lg object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-gray-700 truncate">{lead.product.name}</p>
                        {lead.productVariant && (
                          <p className={`text-[9px] font-bold truncate mt-0.5 ${
                            isPrincess ? 'text-amber-600' : isGirly ? 'text-pink-600' : 'text-indigo-600'
                          }`}>
                            📦 {lead.productVariant}
                          </p>
                        )}
                      </div>
                      {lead.productPrice > 0 && (
                        <span className="text-[10px] font-black text-gray-900 bg-white border px-1.5 py-0.5 rounded-md">
                          {Number(lead.productPrice).toFixed(2)} MAD
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2 mt-auto">
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/agent/leads/${lead.id}`)}
                      className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                        lead.status === 'ASSIGNED' 
                          ? (isPrincess
                              ? 'bg-gradient-to-r from-amber-500 via-pink-500 to-rose-500 text-white hover:opacity-95 shadow-sm shadow-amber-500/10'
                              : isGirly 
                              ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:opacity-95 shadow-sm' 
                              : 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:opacity-95 shadow-sm')
                          : 'bg-gray-900 text-white hover:bg-black'
                      }`}
                    >
                      {lead.status === 'ASSIGNED' ? '▶ Traiter' : '👁️ Détails'}
                    </button>
                    <a
                      href={`tel:${lead.phone}`}
                      onClick={() => handleCall(lead.phone, lead.id)}
                      className={`flex-1 py-2 rounded-xl text-xs font-black transition-all text-center flex justify-center items-center gap-1 border ${
                        isPrincess
                          ? 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100'
                          : isGirly 
                          ? 'bg-pink-50 text-pink-600 border-pink-100 hover:bg-pink-100' 
                          : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100'
                      }`}
                    >
                      📞 Appeler
                    </a>
                  </div>
                  
                  {['ORDERED', 'CONFIRMED'].includes(lead.status) && !lead.order?.coliatyPackageCode && (
                    <button
                      onClick={() => handleOpenDeliveryModal(lead)}
                      className="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-xs font-black hover:opacity-95 transition-all shadow-md flex justify-center items-center gap-1.5"
                    >
                      🚚 Envoyer à la livraison
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-100 p-8 text-center shadow-sm">
            <p className="text-gray-400 font-medium text-xs">Réclamez des leads pour commencer your journée !</p>
          </div>
        )}
      </div>

      {showDeliveryModal && selectedLeadForDelivery && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden animate-slide-up border border-gray-100">
            <div className={`absolute top-0 left-0 right-0 h-1.5 ${
              isPrincess
                ? 'bg-gradient-to-r from-amber-400 via-pink-400 to-rose-500'
                : isGirly 
                ? 'bg-gradient-to-r from-pink-400 via-rose-400 to-fuchsia-400' 
                : 'bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-600'
            }`}></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                📦 Confirmation Coliaty
              </h3>
              <button 
                onClick={() => setShowDeliveryModal(false)}
                className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 p-2 rounded-full transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleConfirmDelivery} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-1">Nom Complet du Destinataire</label>
                <input
                  type="text"
                  required
                  value={deliveryForm.name}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, name: e.target.value })}
                  className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 outline-none text-sm font-semibold ${
                    formErrors.name ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  } ${isGirly ? 'focus:ring-pink-400' : 'focus:ring-indigo-400'}`}
                />
                {formErrors.name && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-1">Téléphone</label>
                <input
                  type="tel"
                  required
                  value={deliveryForm.phone}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, phone: e.target.value })}
                  className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 outline-none text-sm font-semibold ${
                    formErrors.phone ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  } ${isGirly ? 'focus:ring-pink-400' : 'focus:ring-indigo-400'}`}
                  placeholder="Ex: 0612345678"
                />
                {formErrors.phone && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.phone}</p>}
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-1">Ville (Sélection Coliaty)</label>
                {loadingCities ? (
                  <div className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 text-xs font-bold animate-pulse">
                    Chargement des villes...
                  </div>
                ) : (
                  <select
                    required
                    value={deliveryForm.city}
                    onChange={(e) => setDeliveryForm({ ...deliveryForm, city: e.target.value })}
                    className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 outline-none text-sm font-bold max-h-48 overflow-y-auto ${
                      formErrors.city ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    } ${isGirly ? 'focus:ring-pink-400' : 'focus:ring-indigo-400'}`}
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
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Ville du prospect ({selectedLeadForDelivery.city}) non trouvée. Sélectionnez manuellement.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-1">Adresse Détaillée</label>
                <textarea
                  required
                  rows={2}
                  value={deliveryForm.address}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, address: e.target.value })}
                  className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 outline-none text-xs font-semibold resize-none ${
                    formErrors.address ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  } ${isGirly ? 'focus:ring-pink-400' : 'focus:ring-indigo-400'}`}
                />
                {formErrors.address && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.address}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase mb-1">Prix Encaisser (MAD)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={deliveryForm.price || ''}
                    onChange={(e) => setDeliveryForm({ ...deliveryForm, price: Number(e.target.value) })}
                    className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 outline-none text-sm font-bold ${
                      formErrors.price ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    } ${isGirly ? 'focus:ring-pink-400' : 'focus:ring-indigo-400'}`}
                  />
                  {formErrors.price && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.price}</p>}
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase mb-1">Pack / Variante</label>
                  <input
                    type="text"
                    value={deliveryForm.productVariant}
                    onChange={(e) => setDeliveryForm({ ...deliveryForm, productVariant: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 outline-none text-sm font-semibold"
                    placeholder="Ex: Pack 2 + 1"
                  />
                </div>
              </div>
              
              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deliveryForm.package_no_open}
                    onChange={(e) => setDeliveryForm({ ...deliveryForm, package_no_open: e.target.checked })}
                    className={`w-4 h-4 rounded border-gray-300 cursor-pointer ${
                      isGirly ? 'text-pink-500 focus:ring-pink-500' : 'text-indigo-500 focus:ring-indigo-500'
                    }`}
                  />
                  Interdire Ouverture (Ne pas ouvrir avant paiement)
                </label>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeliveryModal(false)}
                  className="flex-1 py-3 bg-gray-50 border border-gray-100 text-gray-700 font-black rounded-xl hover:bg-gray-100 transition-all text-xs"
                  disabled={isPushingDelivery}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPushingDelivery || !deliveryForm.city}
                  className={`flex-1 flex justify-center items-center gap-2 py-3 text-white font-black rounded-xl hover:opacity-95 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs ${
                    isGirly ? 'bg-gradient-to-r from-pink-500 to-rose-500' : 'bg-gradient-to-r from-indigo-500 to-indigo-600'
                  }`}
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

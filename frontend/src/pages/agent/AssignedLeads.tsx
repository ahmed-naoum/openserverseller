import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { leadsApi } from '../../lib/api';
import { useSocket } from '../../contexts/SocketContext';
import toast from 'react-hot-toast';
import {
  Sparkles, Zap, Package, Heart, Filter, X, Search,
  Users, ShieldAlert, Lock, Activity, PhoneOff,
} from 'lucide-react';
import { SearchableSelect } from '../../components/ui/SearchableSelect';

// Mirrors FORCE_CLAIMABLE_STATUSES on the server. Anything past the
// confirmation call never reaches this page.
const STATUS_META: Record<string, { label: string; icon: string; className: string }> = {
  ASSIGNED: { label: 'En traitement', icon: '🎯', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  CALL_LATER: { label: 'Rappel demandé', icon: '📞', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  NO_REPLY: { label: 'Pas de réponse', icon: '📵', className: 'bg-gray-100 text-gray-700 border-gray-200' },
};

export default function AgentAssignedLeads() {
  const { socket } = useSocket();
  const navigate = useNavigate();

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
      setTheme((localStorage.getItem('agent-theme') as 'classic' | 'girly' | 'princess') || 'girly');
    };
    window.addEventListener('agent-theme-change', syncTheme);
    return () => window.removeEventListener('agent-theme-change', syncTheme);
  }, []);

  const isGirly = theme === 'girly';
  const isPrincess = theme === 'princess';

  const [leads, setLeads] = useState<any[]>([]);
  const [totalAssigned, setTotalAssigned] = useState(0);
  const [totalScope, setTotalScope] = useState(0);
  // The count next to the heading reads "N / total" whenever the page is showing
  // fewer than everything, so a 20-row default cannot be mistaken for "there are
  // only 20" — the agent still sees how many are assigned in total.
  const [limit, setLimit] = useState<number | 'max'>(20);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [productId, setProductId] = useState<number | ''>('');
  const [filterOptions, setFilterOptions] = useState<{
    products: { id: number; name: string }[];
  }>({ products: [] });
  const [assignedInfluencers, setAssignedInfluencers] = useState<any[]>([]);
  const [selectedInfluencerId, setSelectedInfluencerId] = useState<number | ''>('');
  const [hasActiveLead, setHasActiveLead] = useState(false);
  const [activeLeadId, setActiveLeadId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Force-claim modal
  const [target, setTarget] = useState<any>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const res = await leadsApi.assignedAll({
        influencerId: selectedInfluencerId ? Number(selectedInfluencerId) : undefined,
        limit,
        search: search.trim() || undefined,
        productId: productId || undefined,
      });
      const data = res.data?.data || res.data;
      setLeads(data?.leads || []);
      setTotalAssigned(data?.totalAssigned ?? (data?.leads?.length || 0));
      setTotalScope(data?.totalScope ?? 0);
      setFilterOptions({ products: data?.filterOptions?.products || [] });
      setAssignedInfluencers(data?.assignedInfluencers || []);
      setHasActiveLead(data?.hasActiveLead || false);
      setActiveLeadId(data?.activeLeadId || null);
    } catch (error) {
      console.error('Failed to load assigned leads:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedInfluencerId, limit, search, productId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Debounce typing so each keystroke doesn't hit the API
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Someone took one of *my* leads: warn me immediately. The matching bell
  // notification is persisted server-side by createNotification().
  useEffect(() => {
    if (!socket) return;

    const handleForceClaimed = ({ leadName, byAgent, reason }: any) => {
      toast.error(
        `${byAgent} a réclamé votre lead${leadName ? ` « ${leadName} »` : ''}.${reason ? ` Motif : ${reason}` : ''}`,
        { icon: '⚠️', duration: 9000 }
      );
      loadData();
    };

    socket.on('lead-force-claimed', handleForceClaimed);
    return () => {
      socket.off('lead-force-claimed', handleForceClaimed);
    };
  }, [socket, loadData]);

  const openModal = (lead: any) => {
    if (hasActiveLead) {
      toast.error('Terminez votre lead en cours avant d\'en réclamer un autre.');
      if (activeLeadId) navigate(`/agent/leads/${activeLeadId}`);
      return;
    }
    setTarget(lead);
    setPhoneInput('');
    setModalError('');
  };

  const closeModal = () => {
    if (submitting) return;
    setTarget(null);
    setModalError('');
  };

  const submitForceClaim = async () => {
    if (!target) return;

    const digits = phoneInput.replace(/\D/g, '');
    if (digits.length < 9) {
      setModalError('Saisissez le numéro complet du client.');
      return;
    }

    setSubmitting(true);
    setModalError('');
    try {
      await leadsApi.forceClaim(target.id, { phone: phoneInput });
      toast.success('Lead réclamé ! Redirection...');
      setTarget(null);
      navigate(`/agent/leads/${target.id}`);
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Réclamation impossible.';
      setModalError(message);
      loadData();
    } finally {
      setSubmitting(false);
    }
  };

  const hasFilters = !!(search || productId);
  const resetFilters = () => {
    setSearchInput(''); setProductId('');
  };

  const accentText = isPrincess ? 'text-amber-500' : isGirly ? 'text-pink-500' : 'text-indigo-500';
  const accentBorder = isPrincess ? 'border-amber-100' : isGirly ? 'border-pink-100' : 'border-indigo-100';

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-1 sm:px-4">
      {/* Header */}
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
              <div className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 rounded-full text-xs font-black uppercase tracking-wider">
                <Users className="w-3.5 h-3.5 text-white" /> Leads de toute l'équipe
              </div>

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
              Leads Assignés {isPrincess ? '👑' : isGirly ? '🌸' : '📋'}
            </h1>
            <p className="text-white/90 text-xs sm:text-sm font-medium max-w-2xl">
              Les leads déjà pris par un agent. Pour en récupérer un, il faut connaître le numéro du client et
              justifier la reprise — l'agent concerné en est averti.
            </p>
          </div>

          {hasActiveLead && activeLeadId && (
            <button
              onClick={() => navigate(`/agent/leads/${activeLeadId}`)}
              className={`px-6 py-3 rounded-2xl text-xs font-black transition-all duration-300 shadow-lg flex items-center gap-2 animate-bounce self-start md:self-auto ${
                isPrincess ? 'bg-white text-rose-600 hover:bg-rose-50' : isGirly ? 'bg-white text-pink-600 hover:bg-pink-50' : 'bg-white text-indigo-700 hover:bg-indigo-50'
              }`}
            >
              <Activity className={`w-4 h-4 animate-pulse ${isPrincess ? 'text-amber-500' : isGirly ? 'text-pink-500' : 'text-indigo-500'}`} />
              Continuer mon lead en cours
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex items-center gap-2">
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                {isPrincess || isGirly
                  ? <Sparkles className={`w-5 h-5 animate-pulse ${accentText}`} />
                  : <Zap className="w-5 h-5 text-indigo-500 animate-pulse" />}
                Leads en cours de traitement
              </h2>
              {leads.length > 0 && (
                <span className={`text-white text-[10px] font-black rounded-full px-2 py-0.5 shadow-md ${
                  isPrincess ? 'bg-amber-500 shadow-amber-200' : isGirly ? 'bg-pink-500 shadow-pink-200' : 'bg-indigo-500 shadow-indigo-200'
                }`}>
                  {leads.length} {totalAssigned > leads.length ? `/ ${totalAssigned}` : ''}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-xl">
              <span className="text-[10px] font-black text-gray-400 uppercase px-1.5">Afficher:</span>
              {([20, 50, 100, 200, 'max'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setLimit(opt)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-black transition-all ${
                    limit === opt
                      ? isPrincess
                        ? 'bg-amber-500 text-white shadow-xs'
                        : isGirly
                        ? 'bg-pink-500 text-white shadow-xs'
                        : 'bg-indigo-600 text-white shadow-xs'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  {opt === 'max' ? 'Tout' : opt}
                </button>
              ))}
            </div>
          </div>

          {assignedInfluencers.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 relative w-full sm:w-auto" ref={dropdownRef}>
              <Filter className={`w-4 h-4 shrink-0 ${isPrincess ? 'text-amber-400' : isGirly ? 'text-pink-400' : 'text-indigo-400'}`} />
              <span className="text-xs font-black text-gray-500 uppercase">Vendeur/Influenceur:</span>

              <div className="relative w-full sm:w-auto sm:min-w-[240px]">
                <button
                  type="button"
                  onClick={() => { setIsDropdownOpen(!isDropdownOpen); setDropdownSearch(''); }}
                  className={`w-full flex items-center justify-between py-1.5 px-3 border rounded-xl bg-white text-xs font-bold text-gray-700 outline-none shadow-sm text-left hover:bg-gray-50 transition-all ${accentBorder}`}
                >
                  <span className="truncate min-w-0">
                    {selectedInfluencerId
                      ? assignedInfluencers.find(inf => inf.id === selectedInfluencerId)?.fullName || 'Tous mes influenceurs/vendeurs'
                      : 'Tous mes influenceurs/vendeurs'}
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
                        onClick={() => { setSelectedInfluencerId(''); setIsDropdownOpen(false); }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                          selectedInfluencerId === '' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        Tous mes influenceurs/vendeurs
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
                            onClick={() => { setSelectedInfluencerId(inf.id); setIsDropdownOpen(false); }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-colors flex flex-col gap-0.5 mt-1 ${
                              selectedInfluencerId === inf.id ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <span className="font-extrabold">{inf.fullName}</span>
                            {inf.email && (
                              <span className="text-[10px] text-gray-400 font-medium normal-case">{inf.email}</span>
                            )}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Search & filters. The phone is matched server-side but never rendered:
            knowing it is what unlocks the force-claim, so it must not leak here. */}
        <div className={`bg-white rounded-2xl border p-3 shadow-sm ${accentBorder}`}>
          <div className="flex flex-col lg:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${
                isPrincess ? 'text-amber-400' : isGirly ? 'text-pink-400' : 'text-indigo-400'
              }`} />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Rechercher par numéro, nom, ville, adresse, produit, SKU..."
                className={`w-full pl-10 pr-9 py-2.5 bg-gray-50 border rounded-xl text-sm font-medium outline-none transition-all focus:bg-white ${
                  isPrincess
                    ? 'border-amber-100 focus:ring-2 focus:ring-amber-200'
                    : isGirly
                    ? 'border-pink-100 focus:ring-2 focus:ring-pink-200'
                    : 'border-indigo-100 focus:ring-2 focus:ring-indigo-200'
                }`}
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="w-full lg:w-[200px] flex-shrink-0">
              <SearchableSelect
                theme={theme}
                value={productId}
                onChange={v => setProductId(v === '' ? '' : Number(v))}
                placeholder="Tous les produits"
                searchPlaceholder="Chercher un produit..."
                icon={<Package className="w-4 h-4" />}
                options={[
                  { value: '', label: 'Tous les produits' },
                  ...filterOptions.products.map(p => ({ value: p.id, label: p.name })),
                ]}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap mt-2.5 pt-2.5 border-t border-gray-50">
            <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1.5">
              <PhoneOff className="w-3.5 h-3.5" />
              Les numéros ne sont pas affichés — la recherche par numéro fonctionne quand même.
            </span>
            {hasFilters && (
              <>
                <span className="text-[11px] font-black text-gray-500 ml-auto">
                  {totalAssigned} résultat{totalAssigned > 1 ? 's' : ''}
                  {totalScope > totalAssigned && (
                    <span className="text-gray-300 font-bold"> sur {totalScope} assignés</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  Réinitialiser
                </button>
              </>
            )}
          </div>
        </div>

        {leads.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {leads.map((lead) => {
              const meta = STATUS_META[lead.status] || {
                label: lead.status, icon: '•', className: 'bg-gray-100 text-gray-700 border-gray-200',
              };
              const isMine = !!lead.assignedAgent?.isMe;

              return (
                <div
                  key={lead.id}
                  className={`relative bg-white rounded-3xl border-2 p-5 hover:shadow-xl transition-all duration-300 group hover:-translate-y-1 ${
                    isMine
                      ? isPrincess
                        ? 'border-amber-300 ring-1 ring-amber-200'
                        : isGirly
                        ? 'border-pink-300 ring-1 ring-pink-200'
                        : 'border-indigo-300 ring-1 ring-indigo-200'
                      : 'border-gray-100 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black shadow-inner border border-white shrink-0 ${
                        isPrincess ? 'bg-amber-100 text-amber-600' : isGirly ? 'bg-pink-100 text-pink-600' : 'bg-indigo-100 text-indigo-600'
                      }`}>
                        {lead.fullName?.charAt(0) || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 truncate">{lead.fullName}</p>
                        <p className="text-xs text-gray-400 font-medium truncate">📍 {lead.city || 'Ville inconnue'}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${meta.className}`}>
                      {meta.icon} {meta.label}
                    </span>
                  </div>

                  {/* Who holds this lead right now */}
                  <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-2xl border ${
                    isMine
                      ? 'bg-emerald-50/60 border-emerald-100'
                      : 'bg-gray-50 border-gray-100'
                  }`}>
                    <Users className={`w-3.5 h-3.5 shrink-0 ${isMine ? 'text-emerald-500' : 'text-gray-400'}`} />
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-wider text-gray-400">Assigné à</p>
                      <p className={`text-xs font-black truncate ${isMine ? 'text-emerald-700' : 'text-gray-700'}`}>
                        {lead.assignedAgent?.fullName || 'Agent inconnu'}{isMine ? ' (vous)' : ''}
                      </p>
                    </div>
                  </div>

                  {lead.product && (
                    <div className={`flex items-center gap-3 mb-4 p-2.5 rounded-2xl border ${
                      isPrincess ? 'bg-amber-50/30 border-amber-100/20' : isGirly ? 'bg-pink-50/30 border-pink-100/20' : 'bg-indigo-50/30 border-indigo-100/20'
                    }`}>
                      {lead.product.image && (
                        <img src={lead.product.image} alt="" className={`w-10 h-10 rounded-xl object-cover border ${accentBorder}`} />
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

                  {isMine ? (
                    <button
                      onClick={() => navigate(`/agent/leads/${lead.id}`)}
                      className="w-full py-3 rounded-2xl text-xs font-black tracking-widest bg-gray-800 text-white hover:bg-gray-900 transition-all"
                    >
                      ▶ OUVRIR MON LEAD
                    </button>
                  ) : (
                    <button
                      onClick={() => openModal(lead)}
                      disabled={hasActiveLead}
                      className={`w-full py-3 rounded-2xl text-xs font-black tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${
                        hasActiveLead
                          ? 'bg-gray-50 text-gray-400 border border-gray-100 cursor-not-allowed'
                          : 'bg-gradient-to-r from-rose-500 to-red-600 text-white hover:opacity-95 shadow-lg shadow-rose-100 hover:shadow-xl active:scale-95'
                      }`}
                    >
                      {hasActiveLead ? (
                        <><Lock className="w-3.5 h-3.5" /> DÉJÀ UN LEAD EN COURS</>
                      ) : (
                        <><ShieldAlert className="w-3.5 h-3.5" /> RÉCLAMER CE LEAD</>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`bg-white rounded-3xl border p-12 text-center shadow-sm ${accentBorder}`}>
            {isPrincess || isGirly
              ? <Heart className={`w-12 h-12 mx-auto mb-4 fill-current animate-pulse ${isPrincess ? 'text-amber-300' : 'text-pink-300'}`} />
              : <Zap className="w-12 h-12 text-indigo-300 mx-auto mb-4 animate-pulse" />}
            {loading ? (
              <p className="text-gray-400 font-medium text-sm">Chargement...</p>
            ) : hasFilters ? (
              <>
                <p className="text-gray-900 font-black text-sm">Aucun lead ne correspond à votre recherche.</p>
                <p className="text-gray-400 text-xs mt-1 font-medium">
                  {totalScope > 0
                    ? `${totalScope} lead${totalScope > 1 ? 's' : ''} assigné${totalScope > 1 ? 's' : ''} sans filtre.`
                    : 'Aucun lead assigné pour le moment.'}
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-4 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                >
                  Réinitialiser les filtres
                </button>
              </>
            ) : (
              <>
                <p className="text-gray-900 font-black text-sm">Aucun lead assigné pour le moment.</p>
                <p className="text-gray-400 text-xs mt-1 font-medium">
                  Les leads pris en charge par un agent de votre portefeuille apparaîtront ici.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Force-claim modal */}
      {target && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-rose-500 to-red-600 px-6 py-5 text-white relative">
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 mb-1">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="text-lg font-black">Réclamer ce lead</h3>
              </div>
              <p className="text-white/90 text-xs font-medium">
                <span className="font-black">{target.fullName}</span> — actuellement chez{' '}
                <span className="font-black">{target.assignedAgent?.fullName || 'un agent'}</span>
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-2xl">
                <span className="text-lg leading-none">⚠️</span>
                <p className="text-[11px] font-semibold text-amber-800 leading-relaxed">
                  {target.assignedAgent?.fullName || "L'agent"} sera notifié de la reprise. Celle-ci est
                  enregistrée dans l'historique du lead.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5">
                  Numéro du client <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  autoFocus
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="0612345678"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-rose-200 transition-all"
                />
                <p className="text-[10px] text-gray-400 font-medium mt-1.5">
                  Vous devez déjà connaître le numéro — il n'est affiché nulle part sur cette page.
                </p>
              </div>

              {modalError && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl">
                  <X className="w-4 h-4 text-rose-500 shrink-0" />
                  <p className="text-[11px] font-bold text-rose-700">{modalError}</p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="flex-1 py-3 rounded-2xl text-xs font-black tracking-wider bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all disabled:opacity-50"
                >
                  ANNULER
                </button>
                <button
                  type="button"
                  onClick={submitForceClaim}
                  disabled={submitting}
                  className="flex-1 py-3 rounded-2xl text-xs font-black tracking-wider bg-gradient-to-r from-rose-500 to-red-600 text-white hover:opacity-95 shadow-lg shadow-rose-100 transition-all disabled:opacity-60 disabled:cursor-wait"
                >
                  {submitting ? '⏳ RÉCLAMATION...' : 'CONFIRMER LA REPRISE'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

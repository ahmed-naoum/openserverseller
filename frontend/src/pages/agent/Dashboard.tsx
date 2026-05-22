import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { leadsApi } from '../../lib/api';
import { Link } from 'react-router-dom';
import { 
  Headphones, Truck, CheckCircle2, Phone, 
  XCircle, Clock, Zap, PieChart as PieIcon,
  Activity, ArrowRight, RefreshCw, Sparkles, Moon, Sun, Heart
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';

export default function AgentDashboard() {
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

  const isClassic = theme === 'classic';
  const isGirly = theme === 'girly';
  const isPrincess = theme === 'princess';

  const { data: leadsData, isLoading: leadsLoading, refetch: refetchLeads, isRefetching: isRefetchingLeads } = useQuery({
    queryKey: ['leads'],
    queryFn: () => leadsApi.list(),
  });

  const { data: deliveryData, isLoading: deliveryLoading, refetch: refetchDelivery, isRefetching: isRefetchingDelivery } = useQuery({
    queryKey: ['livraison'],
    queryFn: () => leadsApi.livraison({ limit: 1000 }),
  });

  const { data: availableData, isLoading: availableLoading, refetch: refetchAvailable, isRefetching: isRefetchingAvailable } = useQuery({
    queryKey: ['available-leads'],
    queryFn: () => leadsApi.available(),
  });

  const isRefreshing = isRefetchingLeads || isRefetchingDelivery || isRefetchingAvailable;

  const leads = leadsData?.data?.data?.leads || leadsData?.data?.leads || [];
  const parcels = deliveryData?.data?.data?.parcels || [];
  const availableCount = availableData?.data?.data?.leads?.length || availableData?.data?.leads?.length || 0;
  const confirmedNotPushedCount = leads.filter((l: any) => l.status === 'CONFIRMED').length;

  // --- Confirmation Stats ---
  const confirmationStats = {
    total: leads.length + parcels.length,
    assigned: leads.filter((l: any) => l.status === 'ASSIGNED' || l.status === 'NEW').length,
    confirmed: leads.filter((l: any) => l.status === 'CONFIRMED').length + parcels.length,
    callLater: leads.filter((l: any) => l.status === 'CALL_LATER').length,
    noReply: leads.filter((l: any) => l.status === 'NO_REPLY').length,
    wrongOrder: leads.filter((l: any) => l.status === 'WRONG_ORDER').length,
    cancelPrice: leads.filter((l: any) => l.status === 'CANCEL_REASON_PRICE').length,
    cancelOrder: leads.filter((l: any) => l.status === 'CANCEL_ORDER').length,
    invalid: leads.filter((l: any) => l.status === 'INVALID').length,
  };

  const confirmationRate = confirmationStats.total > 0 
    ? ((confirmationStats.confirmed / confirmationStats.total) * 100).toFixed(1) 
    : 0;

  const confirmationDistData = isPrincess ? [
    { name: 'Confirmés', value: confirmationStats.confirmed, color: '#f59e0b' },
    { name: 'En cours', value: confirmationStats.assigned, color: '#ec4899' },
    { name: 'Rappels', value: confirmationStats.callLater, color: '#db2777' },
    { name: 'Injoignables', value: confirmationStats.noReply, color: '#d946ef' },
    { name: 'Mauvaise Commande', value: confirmationStats.wrongOrder, color: '#eab308' },
    { name: 'Annulés (Prix)', value: confirmationStats.cancelPrice, color: '#ef4444' },
    { name: 'Annulés', value: confirmationStats.cancelOrder, color: '#64748b' },
    { name: 'Invalide', value: confirmationStats.invalid, color: '#94a3b8' },
  ].filter(d => d.value > 0) : isGirly ? [
    { name: 'Confirmés', value: confirmationStats.confirmed, color: '#ec4899' },
    { name: 'En cours', value: confirmationStats.assigned, color: '#f43f5e' },
    { name: 'Rappels', value: confirmationStats.callLater, color: '#f59e0b' },
    { name: 'Injoignables', value: confirmationStats.noReply, color: '#d946ef' },
    { name: 'Mauvaise Commande', value: confirmationStats.wrongOrder, color: '#eab308' },
    { name: 'Annulés (Prix)', value: confirmationStats.cancelPrice, color: '#ef4444' },
    { name: 'Annulés', value: confirmationStats.cancelOrder, color: '#64748b' },
    { name: 'Invalide', value: confirmationStats.invalid, color: '#94a3b8' },
  ].filter(d => d.value > 0) : [
    { name: 'Confirmés', value: confirmationStats.confirmed, color: '#4f46e5' },
    { name: 'En cours', value: confirmationStats.assigned, color: '#06b6d4' },
    { name: 'Rappels', value: confirmationStats.callLater, color: '#f59e0b' },
    { name: 'Injoignables', value: confirmationStats.noReply, color: '#6366f1' },
    { name: 'Mauvaise Commande', value: confirmationStats.wrongOrder, color: '#eab308' },
    { name: 'Annulés (Prix)', value: confirmationStats.cancelPrice, color: '#ef4444' },
    { name: 'Annulés', value: confirmationStats.cancelOrder, color: '#475569' },
    { name: 'Invalide', value: confirmationStats.invalid, color: '#94a3b8' },
  ].filter(d => d.value > 0);

  // --- Delivery Stats ---
  const deliveryStats = {
    total: parcels.length,
    delivered: parcels.filter((p: any) => p.status === 'DELIVERED').length,
    returned: parcels.filter((p: any) => ['RETURNED', 'CANCELED', 'REFUSE', 'CANCELED_BY_SELLER', 'CANCELED_BY_SYSTEM', 'INCORRECT_ADDRESS', 'ERR'].includes(p.status)).length,
    inTransit: parcels.filter((p: any) => !['DELIVERED', 'RETURNED', 'CANCELED', 'REFUSE', 'CANCELED_BY_SELLER', 'CANCELED_BY_SYSTEM', 'INCORRECT_ADDRESS', 'ERR'].includes(p.status)).length,
  };

  const deliveryRate = deliveryStats.total > 0 
    ? ((deliveryStats.delivered / deliveryStats.total) * 100).toFixed(1) 
    : 0;

  const deliveryDistData = isPrincess ? [
    { name: 'Livrés', value: deliveryStats.delivered, color: '#f59e0b' },
    { name: 'En transit', value: deliveryStats.inTransit, color: '#ec4899' },
    { name: 'Retournés', value: deliveryStats.returned, color: '#ef4444' },
  ].filter(d => d.value > 0) : isGirly ? [
    { name: 'Livrés', value: deliveryStats.delivered, color: '#ec4899' },
    { name: 'En transit', value: deliveryStats.inTransit, color: '#f43f5e' },
    { name: 'Retournés', value: deliveryStats.returned, color: '#ef4444' },
  ].filter(d => d.value > 0) : [
    { name: 'Livrés', value: deliveryStats.delivered, color: '#10b981' },
    { name: 'En transit', value: deliveryStats.inTransit, color: '#3b82f6' },
    { name: 'Retournés', value: deliveryStats.returned, color: '#ef4444' },
  ].filter(d => d.value > 0);

  if (leadsLoading || deliveryLoading) {
    return (
      <div className={`flex items-center justify-center h-64 rounded-3xl ${
        isPrincess 
          ? 'bg-gradient-to-br from-amber-50/10 via-rose-50/10 to-purple-50/10' 
          : isGirly ? 'bg-rose-50/20' : 'bg-slate-50'
      }`}>
        <div className="relative w-12 h-12">
          <div className={`absolute inset-0 border-4 rounded-full animate-spin ${
            isPrincess 
              ? 'border-amber-100 border-t-amber-500' 
              : isGirly ? 'border-rose-100 border-t-pink-500' : 'border-indigo-100 border-t-indigo-500'
          }`}></div>
          {isPrincess || isGirly ? (
            <Sparkles className={`w-5 h-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse ${
              isPrincess ? 'text-amber-500' : 'text-pink-400'
            }`} />
          ) : (
            <Activity className="w-5 h-5 text-indigo-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-4">
      {/* Chic Header */}
      <div className={`rounded-3xl p-6 md:p-8 border shadow-sm relative overflow-hidden transition-all duration-500 ${
        isPrincess
          ? 'bg-gradient-to-br from-amber-50 via-pink-50/50 to-purple-50/30 border-amber-200/50 shadow-md shadow-pink-500/5'
          : isGirly 
          ? 'bg-gradient-to-br from-rose-50 via-pink-50/50 to-fuchsia-50/30 border-pink-100/50' 
          : 'bg-gradient-to-br from-slate-50 via-indigo-50/20 to-purple-50/10 border-indigo-100/30'
      }`}>
        {/* Decorative Background Elements */}
        {isPrincess ? (
          <>
            <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-amber-300/10 via-pink-400/10 to-purple-400/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-rose-200/10 to-amber-300/5 rounded-full blur-2xl -ml-20 -mb-20"></div>
          </>
        ) : isGirly ? (
          <>
            <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-pink-300/10 to-fuchsia-400/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-rose-200/10 to-pink-300/5 rounded-full blur-2xl -ml-20 -mb-20"></div>
          </>
        ) : (
          <>
            <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-indigo-300/10 to-purple-400/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-blue-200/10 to-indigo-300/5 rounded-full blur-2xl -ml-20 -mb-20"></div>
          </>
        )}
        
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {isPrincess ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100/60 border border-amber-200/40 text-amber-800 text-[10px] font-black backdrop-blur-sm shadow-sm uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" /> Espace Princess Royal 👑✨
                </div>
              ) : isGirly ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pink-100/60 border border-pink-200/40 text-pink-700 text-[10px] font-black backdrop-blur-sm shadow-sm uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-pink-500 animate-pulse" /> Espace Agent Féminin ✨
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-100/60 border border-indigo-200/40 text-indigo-700 text-[10px] font-black backdrop-blur-sm shadow-sm uppercase tracking-wider">
                  <Activity className="w-3.5 h-3.5 text-indigo-500 animate-pulse" /> Espace Confirmation Classique 🕶️
                </div>
              )}

              {/* Theme Dropdown Select */}
              <div className="relative inline-block">
                <select
                  value={theme}
                  onChange={(e) => changeTheme(e.target.value as any)}
                  className={`pl-3 pr-8 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-300 shadow-sm border outline-none appearance-none cursor-pointer ${
                    isPrincess 
                      ? 'bg-gradient-to-r from-amber-500 via-pink-500 to-rose-500 text-white border-amber-600 shadow-md shadow-amber-500/20'
                      : isGirly 
                      ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white border-pink-600 shadow-md shadow-pink-500/20' 
                      : 'bg-indigo-600 text-white border-indigo-700'
                  }`}
                >
                  <option value="classic" className="text-gray-900 bg-white font-bold">🕶️ Classique</option>
                  <option value="girly" className="text-gray-900 bg-white font-bold">🌸 Thème Girly ✨</option>
                  <option value="princess" className="text-gray-900 bg-white font-bold">💅 Princess Pink 👑</option>
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-white font-black text-[8px]">
                  ▼
                </div>
              </div>
            </div>
            
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight mb-2">
              {isPrincess ? 'Espace Princesse Royale 👑✨' : isGirly ? 'Mon Tableau de Bord Agent 🌸' : 'Tableau de Bord Agent 📊'}
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm font-medium">Aperçu chic et optimisé de vos performances de confirmation et de livraison.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Confirmed Not Pushed Badge */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border shadow-sm transition-colors ${
              isPrincess ? 'bg-amber-100/50 border-amber-200/30' : isGirly ? 'bg-pink-100/50 border-pink-200/30' : 'bg-indigo-50 border-indigo-100'
            }`}>
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isPrincess ? 'bg-amber-400' : isGirly ? 'bg-pink-400' : 'bg-indigo-400'
                }`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  isPrincess ? 'bg-amber-500' : isGirly ? 'bg-pink-500' : 'bg-indigo-500'
                }`}></span>
              </span>
              <span className={`text-xs font-black ${isPrincess ? 'text-amber-800' : isGirly ? 'text-pink-700' : 'text-indigo-700'}`}>
                {confirmedNotPushedCount} <span className={`font-medium ${isPrincess ? 'text-rose-700/80' : isGirly ? 'text-pink-600/80' : 'text-indigo-600/80'}`}>En attente</span>
              </span>
            </div>

            {/* Available Leads Badge */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border shadow-sm transition-colors ${
              isGirly ? 'bg-rose-100/50 border-rose-200/30' : 'bg-emerald-50 border-emerald-100'
            }`}>
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isGirly ? 'bg-rose-400' : 'bg-emerald-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isGirly ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
              </span>
              <span className={`text-xs font-black ${isGirly ? 'text-rose-700' : 'text-emerald-700'}`}>
                {availableCount} <span className={`font-medium ${isGirly ? 'text-rose-600/80' : 'text-emerald-600/80'}`}>Disponibles</span>
              </span>
            </div>

            <button
              onClick={() => {
                refetchLeads();
                refetchDelivery();
                refetchAvailable();
              }}
              disabled={isRefreshing}
              className={`p-2.5 bg-white text-gray-500 rounded-xl transition-all border shadow-sm disabled:opacity-50 ${
                isGirly 
                  ? 'hover:bg-pink-50 hover:text-pink-600 border-gray-200 hover:border-pink-200' 
                  : 'hover:bg-indigo-50 hover:text-indigo-600 border-gray-200 hover:border-indigo-200'
              }`}
              title="Actualiser les statistiques"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-pink-500' : ''}`} />
            </button>
            
            <Link 
              to="/agent/leads" 
              className={`flex items-center gap-1.5 px-4 py-2.5 text-white font-black rounded-xl hover:opacity-95 shadow-sm hover:shadow-lg transition-all text-xs ${
                isGirly 
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 hover:shadow-pink-100' 
                  : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-100'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-white/80" />
              Réclamer Leads
            </Link>
            
            <Link 
              to="/agent/livraison" 
              className={`flex items-center gap-1.5 px-4 py-2.5 font-black rounded-xl transition-all text-xs border ${
                isGirly 
                  ? 'bg-pink-50 text-pink-600 hover:bg-pink-100/80 border-pink-100' 
                  : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100/80 border-indigo-100'
              }`}
            >
              <Truck className="w-3.5 h-3.5 opacity-80" />
              Suivi Livraison
            </Link>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Confirmation Section */}
        <div className="space-y-6">
          <div className={`bg-white p-6 rounded-3xl border shadow-sm relative overflow-hidden transition-all ${
            isGirly ? 'border-pink-100/40' : 'border-indigo-100/20'
          }`}>
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl ${
              isGirly ? 'bg-pink-50/40' : 'bg-indigo-50/30'
            }`}></div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Headphones className={`w-5 h-5 ${isGirly ? 'text-pink-500' : 'text-indigo-500'}`} />
                Phase 1: Confirmation
              </h2>
              <span className={`px-3 py-1 text-xs font-black rounded-lg border w-fit ${
                isGirly ? 'bg-pink-50 text-pink-600 border-pink-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'
              }`}>
                Taux de Confirmation: {confirmationRate}%
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 mb-6 relative z-10">
              <div className={`p-4 rounded-2xl border shadow-sm hover:scale-[1.02] transition-all ${
                isGirly ? 'bg-rose-50/40 border-rose-100/30 text-rose-700' : 'bg-slate-50/60 border-slate-100 text-slate-700'
              }`}>
                <span className="text-[10px] font-black tracking-wider uppercase opacity-80">Leads Traités</span>
                <p className="text-2xl font-black mt-1">{confirmationStats.total}</p>
              </div>
              <div className={`p-4 rounded-2xl border shadow-sm hover:scale-[1.02] transition-all ${
                isGirly ? 'bg-pink-50/40 border-pink-100/30 text-pink-700' : 'bg-indigo-50/40 border-indigo-100/30 text-indigo-700'
              }`}>
                <span className="text-[10px] font-black tracking-wider uppercase opacity-80">Confirmés</span>
                <p className="text-2xl font-black mt-1">{confirmationStats.confirmed}</p>
              </div>
              <div className={`p-4 rounded-2xl border shadow-sm hover:scale-[1.02] transition-all ${
                isGirly ? 'bg-fuchsia-50/40 border-fuchsia-100/30 text-fuchsia-700' : 'bg-cyan-50/40 border-cyan-100/30 text-cyan-700'
              }`}>
                <span className="text-[10px] font-black tracking-wider uppercase opacity-80">En Cours</span>
                <p className="text-2xl font-black mt-1">{confirmationStats.assigned}</p>
              </div>
              <div className={`p-4 rounded-2xl border shadow-sm hover:scale-[1.02] transition-all ${
                isGirly ? 'bg-purple-50/40 border-purple-100/30 text-purple-700' : 'bg-indigo-50/20 border-indigo-100/10 text-indigo-700'
              }`}>
                <span className="text-[10px] font-black tracking-wider uppercase opacity-80">Rappels</span>
                <p className="text-2xl font-black mt-1">{confirmationStats.callLater}</p>
              </div>
              <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-100/30 shadow-sm hover:scale-[1.02] transition-all text-amber-700">
                <span className="text-[10px] font-black tracking-wider uppercase opacity-80">Injoignables</span>
                <p className="text-2xl font-black mt-1">{confirmationStats.noReply}</p>
              </div>
              <div className="bg-orange-50/40 p-4 rounded-2xl border border-orange-100/30 shadow-sm hover:scale-[1.02] transition-all text-orange-700">
                <span className="text-[10px] font-black tracking-wider uppercase opacity-80">Mauvaise Cde</span>
                <p className="text-2xl font-black mt-1">{confirmationStats.wrongOrder}</p>
              </div>
              <div className="bg-red-50/40 p-4 rounded-2xl border border-red-100/30 shadow-sm hover:scale-[1.02] transition-all text-red-700">
                <span className="text-[10px] font-black tracking-wider uppercase opacity-80">Refusés Prix</span>
                <p className="text-2xl font-black mt-1">{confirmationStats.cancelPrice}</p>
              </div>
              <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200/50 shadow-sm hover:scale-[1.02] transition-all text-slate-700">
                <span className="text-[10px] font-black tracking-wider uppercase opacity-80">Annulés</span>
                <p className="text-2xl font-black mt-1">{confirmationStats.cancelOrder}</p>
              </div>
            </div>

            {/* Confirmation Chart */}
            <div className="h-[220px] relative">
              {confirmationDistData.length > 0 ? (
                <>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-gray-900">{confirmationStats.total}</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Total</span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%" className="relative z-10">
                    <PieChart>
                      <Pie
                        data={confirmationDistData}
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {confirmationDistData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip wrapperStyle={{ zIndex: 100 }} content={<CustomPieTooltip total={confirmationStats.total} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <PieIcon className="w-8 h-8 opacity-20 mb-2" />
                  <span className="text-sm font-medium">Aucune donnée</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Delivery Section */}
        <div className="space-y-6">
          <div className={`bg-white p-6 rounded-3xl border shadow-sm relative overflow-hidden transition-all ${
            isGirly ? 'border-pink-100/40' : 'border-indigo-100/20'
          }`}>
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl ${
              isGirly ? 'bg-pink-50/40' : 'bg-indigo-50/30'
            }`}></div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Truck className={`w-5 h-5 ${isGirly ? 'text-pink-500' : 'text-indigo-500'}`} />
                Phase 2: Livraison Coliaty
              </h2>
              <span className={`px-3 py-1 text-xs font-black rounded-lg border w-fit ${
                isGirly ? 'bg-pink-50 text-pink-600 border-pink-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'
              }`}>
                Taux de Livraison: {deliveryRate}%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
              <div className={`p-4 rounded-2xl border shadow-sm hover:scale-[1.02] transition-all ${
                isGirly ? 'bg-rose-50/40 border-rose-100/30 text-rose-700' : 'bg-slate-50/60 border-slate-100 text-slate-700'
              }`}>
                <span className="text-xs font-bold uppercase opacity-85">Colis Envoyés</span>
                <p className="text-2xl font-black mt-1">{deliveryStats.total}</p>
              </div>
              <div className={`p-4 rounded-2xl border shadow-sm hover:scale-[1.02] transition-all ${
                isGirly ? 'bg-pink-50/40 border-pink-100/30 text-pink-700' : 'bg-emerald-50/40 border-emerald-100/30 text-emerald-700'
              }`}>
                <span className="text-xs font-bold uppercase opacity-85">Livrés</span>
                <p className="text-2xl font-black mt-1">{deliveryStats.delivered}</p>
              </div>
              <div className={`p-4 rounded-2xl border shadow-sm hover:scale-[1.02] transition-all ${
                isGirly ? 'bg-fuchsia-50/40 border-fuchsia-100/30 text-fuchsia-700' : 'bg-blue-50/40 border-blue-100/30 text-blue-700'
              }`}>
                <span className="text-xs font-bold uppercase opacity-85">En Transit</span>
                <p className="text-2xl font-black mt-1">{deliveryStats.inTransit}</p>
              </div>
              <div className="bg-rose-50/30 p-4 rounded-2xl border border-rose-100/30 shadow-sm hover:scale-[1.02] transition-all text-rose-700">
                <span className="text-xs font-bold uppercase opacity-85">Retournés</span>
                <p className="text-2xl font-black mt-1">{deliveryStats.returned}</p>
              </div>
            </div>

            {/* Delivery Chart */}
            <div className="h-[220px] relative">
              {deliveryDistData.length > 0 ? (
                <>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-gray-900">{deliveryStats.total}</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Total</span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%" className="relative z-10">
                    <PieChart>
                      <Pie
                        data={deliveryDistData}
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {deliveryDistData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip wrapperStyle={{ zIndex: 100 }} content={<CustomPieTooltip total={deliveryStats.total} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <PieIcon className="w-8 h-8 opacity-20 mb-2" />
                  <span className="text-sm font-medium">Aucune donnée</span>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Priority Leads List */}
      <div className={`bg-white rounded-3xl border shadow-sm overflow-hidden relative transition-colors ${
        isGirly ? 'border-pink-100/40' : 'border-indigo-100/20'
      }`}>
        <div className={`p-6 border-b flex items-center justify-between ${
          isGirly ? 'border-pink-100/40 bg-pink-50/10' : 'border-indigo-100/10 bg-indigo-50/5'
        }`}>
          <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <Activity className={`w-5 h-5 animate-pulse ${isGirly ? 'text-pink-500' : 'text-indigo-500'}`} />
            {isGirly ? 'Action Requise Immédiate ✨' : 'Actions Requises'}
          </h3>
          <Link to="/agent/leads" className={`text-sm font-bold flex items-center gap-1 ${
            isGirly ? 'text-pink-600 hover:text-pink-700' : 'text-indigo-600 hover:text-indigo-700'
          }`}>
            Voir tout <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className={`divide-y ${isGirly ? 'divide-pink-50/40' : 'divide-indigo-50/10'}`}>
          {leads.filter((l: any) => l.status === 'NEW' || l.status === 'ASSIGNED').slice(0, 5).length > 0 ? (
             leads.filter((l: any) => l.status === 'NEW' || l.status === 'ASSIGNED').slice(0, 5).map((lead: any) => (
              <div key={lead.id} className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                isGirly ? 'hover:bg-pink-50/10' : 'hover:bg-indigo-50/5'
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black shadow-inner border border-white ${
                    isGirly ? 'bg-pink-100 text-pink-600' : 'bg-indigo-100 text-indigo-600'
                  }`}>
                    {lead.fullName.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{lead.fullName}</div>
                    <div className="text-xs sm:text-sm font-medium text-gray-500 flex items-center gap-2">
                      <Phone className={`w-3.5 h-3.5 ${isGirly ? 'text-pink-400' : 'text-indigo-400'}`} /> {lead.phone}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-16 sm:ml-0">
                  <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg border ${
                    isGirly ? 'bg-pink-50 text-pink-600 border-pink-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                  }`}>
                    Nouveau
                  </span>
                  <Link 
                    to={`/agent/leads/${String(lead.id).replace('lead-', '')}`} 
                    className={`px-4 py-2 text-white rounded-xl text-xs font-black shadow-sm hover:shadow-lg transition-all ${
                      isGirly 
                        ? 'bg-pink-600 hover:bg-pink-700 hover:shadow-pink-100' 
                        : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-100'
                    }`}
                  >
                    Traiter
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center">
              <CheckCircle2 className={`w-12 h-12 mx-auto mb-3 animate-bounce ${isGirly ? 'text-pink-400' : 'text-indigo-400'}`} />
              <p className="font-black text-gray-900">{isGirly ? 'Tout est à jour ! 🌸' : 'Tout est à jour ! ✅'}</p>
              <p className="text-sm text-gray-500 mt-1">Vous n'avez aucun prospect en attente de traitement.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CustomPieTooltip({ active, payload, total }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const percent = total > 0 ? ((data.value / total) * 100).toFixed(1) : 0;
    return (
      <div className="bg-white p-3 rounded-2xl shadow-xl border border-gray-100 flex flex-col gap-1 z-50 relative outline-none">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: data.color || data.fill || '#cbd5e1' }} />
          <span className="text-[10px] font-bold text-gray-500 uppercase">{data.name}</span>
        </div>
        <div className="flex items-baseline gap-1.5 pl-4">
          <span className="text-sm font-black text-gray-900">{percent}%</span>
        </div>
      </div>
    );
  }
  return null;
}

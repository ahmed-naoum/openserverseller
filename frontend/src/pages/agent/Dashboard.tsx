import { useQuery } from '@tanstack/react-query';
import { leadsApi } from '../../lib/api';
import { Link } from 'react-router-dom';
import { 
  Headphones, Truck, CheckCircle2, Phone, 
  XCircle, Clock, Zap, PieChart as PieIcon,
  Activity, ArrowRight, RefreshCw
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

export default function AgentDashboard() {
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

  const confirmationDistData = [
    { name: 'Confirmés', value: confirmationStats.confirmed, color: '#10b981' },
    { name: 'En cours', value: confirmationStats.assigned, color: '#3b82f6' },
    { name: 'Rappels', value: confirmationStats.callLater, color: '#f59e0b' },
    { name: 'Injoignables', value: confirmationStats.noReply, color: '#8b5cf6' },
    { name: 'Mauvaise Commande', value: confirmationStats.wrongOrder, color: '#eab308' },
    { name: 'Annulés (Prix)', value: confirmationStats.cancelPrice, color: '#f43f5e' },
    { name: 'Annulés', value: confirmationStats.cancelOrder, color: '#ef4444' },
    { name: 'Invalide', value: confirmationStats.invalid, color: '#64748b' },
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

  const deliveryDistData = [
    { name: 'Livrés', value: deliveryStats.delivered, color: '#10b981' },
    { name: 'En transit', value: deliveryStats.inTransit, color: '#3b82f6' },
    { name: 'Retournés', value: deliveryStats.returned, color: '#ef4444' },
  ].filter(d => d.value > 0);

  if (leadsLoading || deliveryLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">Tableau de Bord Agent 🎧</h1>
            <p className="text-gray-500">Aperçu de vos performances de confirmation et de livraison.</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Confirmed Not Pushed Badge */}
            <div className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-emerald-50 rounded-xl border border-emerald-100 shadow-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-sm font-black text-emerald-700">
                {confirmedNotPushedCount} <span className="font-medium">En attente Livraison</span>
              </span>
            </div>

            {/* Available Leads Badge */}
            <div className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-amber-50 rounded-xl border border-amber-100 shadow-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              <span className="text-sm font-black text-amber-700">
                {availableCount} <span className="font-medium">Disponibles</span>
              </span>
            </div>

            <button
              onClick={() => {
                refetchLeads();
                refetchDelivery();
                refetchAvailable();
              }}
              disabled={isRefreshing}
              className="p-2.5 bg-white text-gray-500 rounded-xl hover:bg-gray-50 hover:text-gray-700 transition-all border border-gray-200 shadow-sm disabled:opacity-50"
              title="Actualiser les statistiques"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-indigo-500' : ''}`} />
            </button>
            <Link 
              to="/agent/leads" 
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 transition-colors"
            >
              <Zap className="w-4 h-4" />
              Réclamer Leads
            </Link>
            <Link 
              to="/agent/livraison" 
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50 text-emerald-600 font-bold rounded-xl hover:bg-emerald-100 transition-colors"
            >
              <Truck className="w-4 h-4" />
              Suivi Livraison
            </Link>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Confirmation Section */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Headphones className="w-5 h-5 text-indigo-500" />
                Phase 1: Confirmation
              </h2>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-lg border border-indigo-100">
                Taux de Confirmation: {confirmationRate}%
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 shadow-sm">
                <span className="text-[10px] font-black tracking-wider text-gray-500 uppercase">Leads Traités</span>
                <p className="text-2xl font-black text-gray-900 mt-1">{confirmationStats.total}</p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 shadow-sm">
                <span className="text-[10px] font-black tracking-wider text-emerald-600 uppercase">Confirmed</span>
                <p className="text-2xl font-black text-emerald-700 mt-1">{confirmationStats.confirmed}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 shadow-sm">
                <span className="text-[10px] font-black tracking-wider text-blue-600 uppercase">En Cours</span>
                <p className="text-2xl font-black text-blue-700 mt-1">{confirmationStats.assigned}</p>
              </div>
              <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 shadow-sm">
                <span className="text-[10px] font-black tracking-wider text-indigo-600 uppercase">Call Later</span>
                <p className="text-2xl font-black text-indigo-700 mt-1">{confirmationStats.callLater}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100 shadow-sm">
                <span className="text-[10px] font-black tracking-wider text-purple-600 uppercase">No Reply</span>
                <p className="text-2xl font-black text-purple-700 mt-1">{confirmationStats.noReply}</p>
              </div>
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 shadow-sm">
                <span className="text-[10px] font-black tracking-wider text-amber-600 uppercase">Wrong Order</span>
                <p className="text-2xl font-black text-amber-700 mt-1">{confirmationStats.wrongOrder}</p>
              </div>
              <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 shadow-sm">
                <span className="text-[10px] font-black tracking-wider text-rose-600 uppercase">Cancel (Price)</span>
                <p className="text-2xl font-black text-rose-700 mt-1">{confirmationStats.cancelPrice}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-2xl border border-red-100 shadow-sm">
                <span className="text-[10px] font-black tracking-wider text-red-600 uppercase">Cancel Order</span>
                <p className="text-2xl font-black text-red-700 mt-1">{confirmationStats.cancelOrder}</p>
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
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-500" />
                Phase 2: Livraison Coliaty
              </h2>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-lg border border-emerald-100">
                Taux de Livraison: {deliveryRate}%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <span className="text-xs font-bold text-gray-500 uppercase">Colis Envoyés</span>
                <p className="text-2xl font-black text-gray-900 mt-1">{deliveryStats.total}</p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                <span className="text-xs font-bold text-emerald-600 uppercase">Livrés</span>
                <p className="text-2xl font-black text-emerald-700 mt-1">{deliveryStats.delivered}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <span className="text-xs font-bold text-blue-600 uppercase">En Transit</span>
                <p className="text-2xl font-black text-blue-700 mt-1">{deliveryStats.inTransit}</p>
              </div>
              <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
                <span className="text-xs font-bold text-rose-600 uppercase">Retournés</span>
                <p className="text-2xl font-black text-rose-700 mt-1">{deliveryStats.returned}</p>
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
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-500" />
            Action Requise Immédiate
          </h3>
          <Link to="/agent/leads" className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
            Voir tout <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {leads.filter((l: any) => l.status === 'NEW' || l.status === 'ASSIGNED').slice(0, 5).length > 0 ? (
             leads.filter((l: any) => l.status === 'NEW' || l.status === 'ASSIGNED').slice(0, 5).map((lead: any) => (
              <div key={lead.id} className="p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-black">
                    {lead.fullName.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{lead.fullName}</div>
                    <div className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5" /> {lead.phone}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-amber-100">
                    Nouveau
                  </span>
                  <Link to={`/agent/leads/${String(lead.id).replace('lead-', '')}`} className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all">
                    Traiter
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="p-10 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <p className="font-bold text-gray-900">Tout est à jour !</p>
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

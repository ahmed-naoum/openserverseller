import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { adminApi } from '../../lib/api';
import { 
  Users, 
  ShoppingCart, 
  DollarSign, 
  Target, 
  CreditCard, 
  Package, 
  TrendingUp,
  Award,
  Activity,
  MapPin,
  HelpCircle,
  FileText,
  Clock,
  ArrowUpRight,
  TrendingDown,
  Percent,
  Radio,
  Eye,
  Truck
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';

function parseUserAgent(ua: string) {
  if (!ua || ua === 'unknown') return 'Navigateur Inconnu';
  
  let os = 'OS inconnu';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('iPhone')) os = 'iOS';
  else if (ua.includes('iPad')) os = 'iPadOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('Linux')) os = 'Linux';

  let browser = 'Navigateur';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

  return `${browser} (${os})`;
}

function StatCard({ icon: Icon, label, value, sub, gradient }: { icon: any; label: string; value: string | number; sub?: string; gradient: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${gradient}`}>
      <div className="absolute top-3 right-3 opacity-20">
        <Icon size={40} />
      </div>
      <Icon size={20} className="mb-2 opacity-80" />
      <h3 className="text-2xl font-black">{typeof value === 'number' ? value.toLocaleString() : value}</h3>
      <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider mt-1">{label}</p>
      {sub && <p className="text-[9px] opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [chartType, setChartType] = useState<'revenue' | 'volume'>('revenue');
  const [activeTab, setActiveTab] = useState<'roles' | 'details'>('roles');
  const [realtimeUsers, setRealtimeUsers] = useState<{
    anonymousCount: number;
    activeRoles: Record<string, number>;
    totalActive: number;
    activeUsersList?: any[];
  } | null>(null);

  useEffect(() => {
    if (!socket) return;

    const handleActiveUsers = (data: any) => {
      console.log('⚡ Real-time active users count:', data);
      setRealtimeUsers(data);
    };

    socket.on('realtime:active-users', handleActiveUsers);
    
    socket.emit('realtime:request-counts');

    return () => {
      socket.off('realtime:active-users', handleActiveUsers);
    };
  }, [socket]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => adminApi.dashboard(),
    enabled: user?.role !== 'SYSTEM_SUPPORT',
  });

  if (user?.role === 'SYSTEM_SUPPORT') {
    return <Navigate to="/admin/support" replace />;
  }

  const dashboardData = data?.data?.data;
  const stats = dashboardData?.stats;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Chargement des données...</p>
        </div>
      </div>
    );
  }

  // Format Daily Charts Data (chronologically)
  const chartData = [...(dashboardData?.charts?.ordersByDay || [])]
    .map((item: any) => ({
      date: new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      count: Number(item.count || 0),
      revenue: Number(item.revenue || 0)
    }))
    .reverse();

  // Pie chart for Order Statuses
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];
  const pieData = (stats?.orderStatusesDistribution || [])
    .map((item: any) => ({
      name: item.status,
      value: item.count
    }))
    .filter((item: any) => item.value > 0);

  // Role distribution map with beautiful badge stylings
  const roleStylings: Record<string, { label: string, color: string }> = {
    SUPER_ADMIN: { label: 'Administrateur', color: 'bg-rose-500' },
    FINANCE_ADMIN: { label: 'Finance', color: 'bg-amber-500' },
    CALL_CENTER_AGENT: { label: 'Agent Call Center', color: 'bg-indigo-500' },
    VENDOR: { label: 'Vendeur', color: 'bg-emerald-500' },
    INFLUENCER: { label: 'Influenceur', color: 'bg-purple-500' },
    HELPER: { label: 'Helper', color: 'bg-cyan-500' },
  };

  const getRoleInfo = (roleName: string) => {
    return roleStylings[roleName] || { label: roleName, color: 'bg-slate-400' };
  };

  const totalOrders = stats?.orders?.total || 0;
  const deliveredOrders = stats?.orderStatusesDistribution?.find((o: any) => o.status === 'DELIVERED')?.count || 0;
  const deliveryRate = totalOrders > 0 ? Number(((deliveredOrders / totalOrders) * 100).toFixed(1)) : 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700 ease-out">
      {/* Welcome Hero Banner */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-[#1e204b] via-[#2c2f74] to-[#3a3f9c] p-8 md:p-10 text-white shadow-xl">
        <div className="relative z-10 space-y-3">
          <span className="px-4 py-1.5 rounded-full bg-white/10 text-xs font-black uppercase tracking-widest text-primary-200 backdrop-blur-md">
            Centre de Contrôle Global
          </span>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">Tableau de bord Admin <span className="text-primary-400">🛡️</span></h2>
          <p className="text-primary-100/70 font-medium text-base md:text-lg max-w-2xl leading-relaxed">
            Gérez, analysez et suivez les performances globales de l'écosystème SILACOD en temps réel.
          </p>
        </div>
        
        {/* Background light blooms */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary-400/20 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -ml-20 -mb-20" />
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Users} label="Utilisateurs" value={stats?.users?.total || 0} sub={`${stats?.users?.vendors || 0} vendeurs / ${stats?.users?.agents || 0} agents`} gradient="bg-gradient-to-br from-violet-500 to-purple-600 shadow-purple-200/50" />
        <StatCard icon={Target} label="Total Leads" value={stats?.leads?.total || 0} sub={`${stats?.leads?.unassigned || 0} non assignés`} gradient="bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-200/50" />
        <StatCard icon={Percent} label="Confirmation" value={`${stats?.leadConversion?.conversionRate || 0}%`} sub={`${stats?.leadConversion?.convertedCount || 0} confirmés`} gradient="bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-200/50" />
        <StatCard icon={Truck} label="Livraison" value={`${deliveryRate}%`} sub={`${deliveredOrders} livrés / ${totalOrders} cmd`} gradient="bg-gradient-to-br from-teal-500 to-emerald-600 shadow-emerald-200/50" />
        <StatCard icon={DollarSign} label="Revenus Total" value={`${Number(stats?.revenue?.total || 0).toLocaleString()} MAD`} sub="Commandes livrées" gradient="bg-gradient-to-br from-rose-500 to-pink-600 shadow-pink-200/50" />
        <StatCard icon={Award} label="Vérifications" value={stats?.verifications?.pending || 0} sub="KYC en attente" gradient="bg-gradient-to-br from-amber-500 to-orange-600 shadow-orange-200/50" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard icon={ShoppingCart} label="Commandes Totales" value={stats?.orders?.total || 0} sub={`${stats?.orders?.pending || 0} en attente`} gradient="bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-200/50" />
        <StatCard icon={Package} label="Produits Actifs" value={stats?.products || 0} sub="Catalogue actif" gradient="bg-gradient-to-br from-green-500 to-emerald-600 shadow-green-200/50" />
        <StatCard icon={DollarSign} label="Total Gagné (Portefeuilles)" value={`${Number(stats?.payouts?.earned || 0).toLocaleString()} MAD`} sub="Cumul des gains wallets" gradient="bg-gradient-to-br from-amber-500 to-orange-600 shadow-orange-200/50" />
        <StatCard icon={CreditCard} label="Retraits Validés" value={`${Number(stats?.payouts?.total || 0).toLocaleString()} MAD`} sub="Total retiré" gradient="bg-gradient-to-br from-cyan-500 to-blue-600 shadow-blue-200/50" />
        <StatCard icon={Clock} label="Retraits En Attente" value={stats?.payouts?.pending || 0} sub="Demandes à valider" gradient="bg-gradient-to-br from-slate-500 to-slate-700 shadow-slate-200/50" />
      </div>

      {/* Charts & Distributions (Row 1) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Daily Orders & Revenue Chart */}
        <div className="lg:col-span-8 bento-card bg-white h-[450px] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary-500" />
                Performance des 30 Derniers Jours
              </h3>
              <p className="text-xs text-slate-400 font-bold mt-0.5">Suivi quotidien de l'activité commerciale</p>
            </div>
            
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setChartType('revenue')}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                  chartType === 'revenue' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'
                }`}
              >
                Chiffre d'Affaires
              </button>
              <button
                onClick={() => setChartType('volume')}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                  chartType === 'volume' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-400'
                }`}
              >
                Volume
              </button>
            </div>
          </div>

          <div className="flex-1 w-full min-h-[300px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="adminChartColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartType === 'revenue' ? '#10b981' : '#3b82f6'} stopOpacity={0.15}/>
                      <stop offset="95%" stopColor={chartType === 'revenue' ? '#10b981' : '#3b82f6'} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} 
                    tickFormatter={(val) => chartType === 'revenue' ? `${val} DH` : val}
                  />
                  <RechartsTooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px'}}
                    itemStyle={{fontWeight: 900, color: chartType === 'revenue' ? '#10b981' : '#3b82f6'}}
                    formatter={(val: number) => [
                      chartType === 'revenue' ? `${val.toLocaleString()} MAD` : `${val} Commandes`,
                      chartType === 'revenue' ? 'Revenu' : 'Commandes'
                    ]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey={chartType === 'revenue' ? 'revenue' : 'count'} 
                    stroke={chartType === 'revenue' ? '#10b981' : '#3b82f6'} 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#adminChartColor)" 
                    animationDuration={800}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-300">
                <Activity className="w-12 h-12 mb-2" />
                <p className="text-xs font-black uppercase tracking-widest">Aucune donnée disponible</p>
              </div>
            )}
          </div>
        </div>

        {/* Real-time Active Accounts & Guests */}
        <div className="lg:col-span-4 bento-card bg-white h-[450px] flex flex-col justify-between">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm flex items-center gap-2">
                <Radio className="w-5 h-5 text-indigo-500 animate-pulse" />
                Utilisateurs Actifs Live
              </h3>
              <p className="text-xs text-slate-400 font-bold mt-0.5">Activité en temps réel sur la plateforme</p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[10px] font-black uppercase tracking-wider text-emerald-600 animate-pulse shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
              <span>{realtimeUsers?.totalActive || 0} Live</span>
            </div>
          </div>

          {/* Tab Selection Controls */}
          <div className="flex bg-slate-100 p-0.5 rounded-xl text-xs font-black border border-slate-200 mb-4 shrink-0">
            <button 
              onClick={() => setActiveTab('roles')}
              className={`flex-1 py-1.5 px-3 rounded-lg transition-all duration-300 ${activeTab === 'roles' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Rôles
            </button>
            <button 
              onClick={() => setActiveTab('details')}
              className={`flex-1 py-1.5 px-3 rounded-lg transition-all duration-300 ${activeTab === 'details' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Détails ({realtimeUsers?.activeUsersList?.length || 0})
            </button>
          </div>

          {activeTab === 'roles' ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Anonymous Visitors Highlight Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/40 via-purple-50/40 to-slate-50 border border-indigo-100/40 flex items-center justify-between shadow-sm mb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-white text-indigo-600 shadow-sm border border-slate-100">
                    <Eye className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">Visiteurs Anonymes</h4>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">Sur les pages publiques</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-indigo-600">{realtimeUsers?.anonymousCount || 0}</span>
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block leading-none mt-1">Visiteurs</span>
                </div>
              </div>

              {/* Registered Accounts Active Breakdown */}
              <div className="flex-1 space-y-3 overflow-y-auto pr-1 min-h-0">
                {Object.entries(roleStylings).map(([roleKey, roleInfo]) => {
                  const activeCount = realtimeUsers?.activeRoles?.[roleKey] || 0;
                  const registeredCount = stats?.rolesDistribution?.find((r: any) => r.roleName === roleKey)?.count || 0;
                  const activePercentage = registeredCount > 0 ? Math.min(100, Math.round((activeCount / registeredCount) * 100)) : 0;

                  return (
                    <div key={roleKey} className="space-y-1 p-1.5 rounded-xl hover:bg-slate-50 transition-all duration-300">
                      <div className="flex items-center justify-between text-xs font-black">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${roleInfo.color} ${activeCount > 0 ? 'animate-ping' : ''}`} />
                          <span className="text-slate-700">{roleInfo.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                          <span className="text-slate-900 font-black">{activeCount} actif(s)</span>
                          <span>/</span>
                          <span>{registeredCount} total</span>
                        </div>
                      </div>
                      
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${roleInfo.color} transition-all duration-1000`}
                          style={{ 
                            width: `${registeredCount > 0 ? activePercentage : 0}%` 
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
              {realtimeUsers?.activeUsersList && realtimeUsers.activeUsersList.length > 0 ? (
                realtimeUsers.activeUsersList.map((item: any) => {
                  const info = item.role ? (roleStylings[item.role] || { label: item.role, color: 'bg-slate-500' }) : null;
                  return (
                    <div key={item.key} className="p-3 rounded-2xl border border-slate-100 hover:border-indigo-100 bg-slate-50/50 hover:bg-white transition-all duration-300 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          {item.type === 'AUTHENTICATED' ? (
                            <div className="relative">
                              {item.avatarUrl ? (
                                <img src={item.avatarUrl} alt="" className="w-8 h-8 rounded-full border border-slate-200 object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black uppercase">
                                  {item.fullName?.substring(0, 2) || 'US'}
                                </div>
                              )}
                              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border border-white rounded-full" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs border border-slate-300">
                              <Eye className="w-4 h-4" />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-black text-slate-800 truncate max-w-[120px]">
                                {item.type === 'AUTHENTICATED' ? item.fullName : 'Visiteur Anonyme'}
                              </span>
                              {item.tabsCount > 1 && (
                                <span className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider bg-amber-50 border border-amber-200 text-amber-600 rounded">
                                  {item.tabsCount} onglets
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold leading-none mt-0.5">
                              {item.type === 'AUTHENTICATED' ? info?.label || item.role : 'Visiteur Guest'}
                            </p>
                          </div>
                        </div>
                        <div className="text-[9px] text-slate-400 font-bold text-right shrink-0">
                          <span className="block">{item.ip}</span>
                          <span className="block text-[8px] font-medium text-slate-300 truncate max-w-[100px]" title={item.userAgent}>
                            {parseUserAgent(item.userAgent)}
                          </span>
                        </div>
                      </div>

                      {/* Pages entered */}
                      {item.pages && item.pages.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-start gap-1.5 flex-wrap">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-0.5">Pages :</span>
                          {item.pages.map((p: any, idx: number) => (
                            <span key={idx} className="px-2 py-0.5 rounded-lg bg-indigo-50/50 text-indigo-700 text-[9px] font-bold border border-indigo-100/30 flex items-center gap-1.5 shadow-sm">
                              <span>{p.path === '/' ? 'Accueil' : p.path}</span>
                              <span className="px-1.5 py-0.2 rounded-md bg-indigo-100 text-indigo-800 text-[8px] font-black shrink-0">
                                {p.count}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-300 py-8">
                  <Radio className="w-12 h-12 mb-2 animate-pulse" />
                  <p className="text-xs font-black uppercase tracking-widest text-center">Aucun utilisateur actif</p>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Secondary Detailed Cards Grid (Row 2) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        
        {/* Order Status Distribution */}
        <div className="bento-card bg-white flex flex-col h-[400px]">
          <div className="mb-4">
            <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-amber-500" />
              Statuts des Commandes
            </h3>
            <p className="text-xs text-slate-400 font-bold mt-0.5">Vue globale sur les états des commandes</p>
          </div>

          <div className="flex-1 flex flex-col justify-center items-center relative">
            {pieData.length > 0 ? (
              <div className="w-full flex items-center gap-4">
                <div className="w-1/2 h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 space-y-2">
                  {pieData.slice(0, 5).map((item: any, idx: number) => (
                    <div key={item.name} className="flex items-center gap-2 text-[11px] font-bold">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="text-slate-600 truncate">{item.name}</span>
                      <span className="text-slate-900 ml-auto">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 opacity-30">
                <ShoppingCart size={40} className="mx-auto mb-2 text-slate-400" />
                <p className="text-xs font-black uppercase tracking-widest">Aucune commande</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Moroccan Cities by Sales */}
        <div className="bento-card bg-white flex flex-col h-[400px]">
          <div className="mb-4 flex justify-between items-center">
            <div>
              <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm flex items-center gap-2">
                <MapPin className="w-5 h-5 text-rose-500" />
                Top Villes (Maroc)
              </h3>
              <p className="text-xs text-slate-400 font-bold mt-0.5">Ventes régionales les plus performantes</p>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto">
            {stats?.citiesDistribution?.length > 0 ? (
              stats.citiesDistribution.map((item: any, idx: number) => (
                <div key={item.city} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:border-primary-100 transition-all duration-300">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-black text-xs">
                      #{idx + 1}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800 capitalize">{(item.city || '').toString().toLowerCase()}</p>
                      <p className="text-[10px] font-bold text-slate-400">{item.ordersCount} commandes</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-900">{Number(item.totalRevenue).toLocaleString()}</p>
                    <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">MAD</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-300">
                <MapPin className="w-10 h-10 mb-2" />
                <p className="text-xs font-black uppercase tracking-widest">Aucune vente par ville</p>
              </div>
            )}
          </div>
        </div>

        {/* Support Tickets & Affiliate Claims */}
        <div className="bento-card bg-white flex flex-col h-[400px]">
          <div className="mb-6">
            <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-indigo-500" />
              Demandes & Support
            </h3>
            <p className="text-xs text-slate-400 font-bold mt-0.5">Suivi des tickets et affiliations</p>
          </div>

          <div className="space-y-6 flex-1 flex flex-col justify-between">
            {/* Support Requests */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tickets Support</span>
                <Link to="/admin/support" className="text-[10px] font-black text-primary-600 hover:text-primary-800 transition-colors uppercase tracking-widest">Gérer →</Link>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-center">
                  <p className="text-2xl font-black text-slate-800">
                    {stats?.supportDistribution?.find((s: any) => s.status === 'OPEN')?.count || 0}
                  </p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Ouverts</p>
                </div>
                <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl text-center">
                  <p className="text-2xl font-black text-indigo-700">
                    {stats?.supportDistribution?.find((s: any) => s.status === 'IN_PROGRESS')?.count || 0}
                  </p>
                  <p className="text-[9px] font-black text-indigo-500 uppercase tracking-wider">En cours</p>
                </div>
              </div>
            </div>

            {/* Affiliate Claims */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Demande Produit</span>
                <Link to="/admin/affiliate-claims" className="text-[10px] font-black text-primary-600 hover:text-primary-800 transition-colors uppercase tracking-widest">Gérer →</Link>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-center">
                  <p className="text-2xl font-black text-slate-800">
                    {stats?.claimsDistribution?.find((c: any) => c.status === 'PENDING')?.count || 0}
                  </p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">En attente</p>
                </div>
                <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl text-center">
                  <p className="text-2xl font-black text-emerald-700">
                    {stats?.claimsDistribution?.find((c: any) => c.status === 'APPROVED')?.count || 0}
                  </p>
                  <p className="text-[9px] font-black text-emerald-500 uppercase tracking-wider">Approuvés</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Row 3: Top Vendors & Recent Platform Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Top Vendors Ranking */}
        <div className="lg:col-span-5 bento-card bg-white flex flex-col h-[450px]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <Award size={20} />
              </div>
              <div>
                <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm">Top Vendeurs</h3>
                <p className="text-xs text-slate-400 font-bold mt-0.5">Meilleurs contributeurs en chiffre d'affaires</p>
              </div>
            </div>
            <TrendingUp size={16} className="text-emerald-500" />
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            {dashboardData?.topVendors?.length > 0 ? (
              dashboardData.topVendors.slice(0, 5).map((vendor: any, index: number) => (
                <div key={vendor.uuid} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/50 border border-slate-100 group/item hover:bg-white hover:border-primary-100 transition-all duration-300">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shadow-sm transition-transform group-hover/item:scale-110 ${
                      index === 0 ? 'bg-amber-100 text-amber-600' : index === 1 ? 'bg-slate-200 text-slate-600' : index === 2 ? 'bg-orange-100 text-orange-600' : 'bg-white text-slate-400'
                    }`}>
                      #{index + 1}
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-black text-slate-800 group-hover/item:text-primary-600 transition-colors">{vendor.fullName || 'Vendeur'}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">E-commerce Pro</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-900">{Number(vendor.totalRevenue).toLocaleString()}</p>
                    <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">MAD</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-10 opacity-30">
                <Award size={40} className="mb-2" />
                <p className="text-xs font-black uppercase tracking-widest">Aucun vendeur</p>
              </div>
            )}
          </div>

          <Link to="/admin/users" className="w-full mt-4 py-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 text-[10px] font-black uppercase text-center tracking-[0.15em] transition-all">
            Voir tous les utilisateurs
          </Link>
        </div>

        {/* Recent Platform Activities */}
        <div className="lg:col-span-7 bento-card bg-white flex flex-col h-[450px]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Clock size={20} />
              </div>
              <div>
                <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm">Activités Récentes</h3>
                <p className="text-xs text-slate-400 font-bold mt-0.5">Dernières actions système enregistrées</p>
              </div>
            </div>
            <Link to="/admin/activity-logs" className="p-2 text-primary-600 hover:text-primary-800 transition-colors hover:scale-105">
              <ArrowUpRight size={18} />
            </Link>
          </div>

          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            {stats?.recentLogs?.length > 0 ? (
              stats.recentLogs.map((log: any) => (
                <div key={log.id} className="flex items-start gap-4 p-3 rounded-2xl bg-slate-50/60 border border-slate-100/80 hover:bg-white hover:border-indigo-100 transition-all duration-300">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 shrink-0 mt-0.5">
                    <FileText size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 leading-tight">
                      {log.action}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-[9px] font-black uppercase tracking-wider text-slate-400">
                      <span>Par: {log.user?.fullName || 'Système'}</span>
                      <span>•</span>
                      <span>Cible: {log.modelType || 'N/A'}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 shrink-0">
                    {new Date(log.createdAt).toLocaleDateString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-300">
                <Clock className="w-10 h-10 mb-2" />
                <p className="text-xs font-black uppercase tracking-widest">Aucune activité enregistrée</p>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

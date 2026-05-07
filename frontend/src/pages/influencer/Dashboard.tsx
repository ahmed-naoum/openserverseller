import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardApi, influencerApi } from '../../lib/api';
import { ReferralLink, InfluencerCommission } from '../../types';
import {
  DollarSign, TrendingUp, Zap, MousePointerClick, ArrowUpRight, Crown,
  Plus, ShoppingBag, Wallet, Activity, BarChart3, CheckCircle2, Truck, ExternalLink, Eye, RefreshCw
} from 'lucide-react';
import { ProCard } from '../../components/common/ProCard';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip
} from 'recharts';
import toast from 'react-hot-toast';

export default function InfluencerDashboard() {
  const { user } = useAuth();
  const [referralLinks, setReferralLinks] = useState<ReferralLink[]>([]);
  const [commissions, setCommissions] = useState<InfluencerCommission[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [walletTransactions, setWalletTransactions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ conversions: 0, confirmed: 0, delivered: 0 });
  const [dateRange, setDateRange] = useState<number | 'custom' | 'all'>(7);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [chartType, setChartType] = useState<'revenue' | 'balance'>('revenue');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (dateRange !== 'custom' || (startDate && endDate)) {
      loadDashboard();
    }
  }, [dateRange, startDate, endDate]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (dateRange === 'custom') {
        if (startDate) params.start = startDate;
        if (endDate) params.end = endDate;
      } else {
        params.days = dateRange;
      }

      const [dashboardRes, linksRes, customersRes] = await Promise.all([
        dashboardApi.influencer(params),
        influencerApi.getLinks(),
        influencerApi.getCustomers()
      ]);
      
      setReferralLinks(linksRes.data);
      // Use commissions from dashboardRes which are correctly filtered by date
      setCommissions(dashboardRes.data.commissions || []);
      setWallet(dashboardRes.data.wallet);
      setWalletTransactions(dashboardRes.data.walletTransactions || []);
      setStats(dashboardRes.data.stats || { conversions: 0, confirmed: 0, delivered: 0 });
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const todayClicks = referralLinks.reduce((sum, l) => sum + l.clicks, 0);
  const todayConversions = stats.conversions;
  
  const totalItems = stats.conversions;
  const confirmedItems = stats.confirmed;
  const deliveredItems = stats.delivered;

  const confirmationRate = totalItems > 0 ? (confirmedItems / totalItems) * 100 : 0;
  const deliveryRate = confirmedItems > 0 ? (deliveredItems / confirmedItems) * 100 : 0;

  // Generate chart day keys based on range
  const getNumDays = () => {
    if (dateRange === 'all') {
      if (commissions.length === 0) return 7;
      const firstDate = new Date(Math.min(...commissions.map(c => new Date(c.createdAt).getTime())));
      const diffTime = Math.abs(new Date().getTime() - firstDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.min(diffDays + 1, 30); // Cap at 30 for chart readability even in "All" mode, or show all if you prefer
    }
    return dateRange === 'custom' ? 7 : Number(dateRange);
  };

  const numDays = getNumDays();
  const chartDays = [...Array(numDays)].map((_, i) => {
    const d = new Date(dateRange === 'custom' && endDate ? endDate : new Date());
    d.setDate(d.getDate() - (numDays - 1 - i));
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  });

  const revenueData = chartDays.map(date => {
    const amount = walletTransactions.reduce((sum, tx) => {
      const txDate = new Date(tx.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      // Only count positive transactions (income) in the revenue chart
      return (txDate === date && tx.amountMad > 0) ? sum + tx.amountMad : sum;
    }, 0);
    return { date, amount: Number(amount.toFixed(2)) };
  });

  // Process Wallet Balance Data
  const balanceData = chartDays.map((date, idx) => {
    // Better logic: find the latest transaction that happened BEFORE or ON this date's end
    const targetDate = new Date(dateRange === 'custom' && endDate ? endDate : new Date());
    targetDate.setDate(targetDate.getDate() - (numDays - 1 - idx));
    targetDate.setHours(23, 59, 59, 999);
    
    const latestTxBefore = walletTransactions
      .filter(tx => new Date(tx.createdAt) <= targetDate)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    const val = latestTxBefore ? latestTxBefore.balanceAfterMad : (wallet?.balanceMad || 0);
    return { date, balance: Number(val.toFixed(2)) };
  });

  // Calculate Top Products based on current commissions (respects date range)
  const topProducts = commissions.reduce((acc: any[], comm) => {
    const productId = comm.referralLink?.productId;
    if (!productId) return acc;
    
    const existing = acc.find(p => p.productId === productId);
    if (existing) {
      existing.earnings += comm.amount;
      existing.sales += 1;
    } else {
      acc.push({
        productId,
        name: comm.referralLink?.product?.nameFr || 'Produit sans nom',
        image: comm.referralLink?.product?.images?.[0]?.url || '',
        earnings: comm.amount,
        sales: 1
      });
    }
    return acc;
  }, [])
  .sort((a, b) => b.earnings - a.earnings)
  .slice(0, 3);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-influencer-200 border-t-influencer-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 p-4 md:p-8">
      {/* Header Section */}
      <div className="relative overflow-hidden bg-slate-900 rounded-[3rem] p-8 md:p-12 text-white shadow-2xl">
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,#8b5cf6_0%,transparent_40%)]" />
          <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_70%_80%,#3b82f6_0%,transparent_40%)]" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
              <span className="text-xl">🚀</span>
              <span className="text-xs font-black uppercase tracking-widest">Tableau de Bord Influenceur</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight">
              Salut, <span className="text-transparent bg-clip-text bg-gradient-to-r from-influencer-300 to-white">{user?.fullName?.split(' ')[0]}</span>!
            </h1>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <Link to="/influencer/links" className="flex items-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-2xl text-sm font-black transition-all">
              <Plus className="w-4 h-4" /> Nouveau Lien
            </Link>
            <Link to="/influencer/marketplace" className="flex items-center gap-2 px-8 py-4 bg-white text-slate-900 rounded-2xl text-sm font-black hover:shadow-2xl transition-all">
              <ShoppingBag className="w-4 h-4" /> Marketplace
            </Link>
          </div>
        </div>
      </div>

      {/* Main Grid: Financial Cards (3) + Analytics (Chart) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: 3 Financial Cards */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Card 1: Main Balance - Solid Dark Background for Maximum Contrast */}
          <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group border border-slate-800">
            <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
              <Wallet className="w-24 h-24 text-white" />
            </div>
            <div className="relative z-10 space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Solde Portefeuille</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-5xl font-black text-white">{wallet?.balanceMad?.toLocaleString() || 0}</h3>
                <span className="text-sm font-bold text-slate-400 uppercase">DH</span>
              </div>
              <Link to="/influencer/wallet" className="flex items-center gap-2 text-xs font-black text-influencer-400 hover:text-white transition-colors group/link">
                GÉRER MES RETRAITS <ArrowUpRight className="w-3 h-3 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Card 2: Total Earned - Clean White Card */}
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-500">
              <TrendingUp className="w-24 h-24 text-slate-900" />
            </div>
            <div className="relative z-10 space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Gagné</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black text-green-600">+{wallet?.totalEarnedMad?.toLocaleString() || 0}</h3>
                <span className="text-sm font-bold text-slate-400 uppercase">DH</span>
              </div>
              <p className="text-[9px] font-bold text-slate-300 italic">Depuis la création du compte</p>
            </div>
          </div>

          {/* Card 3: Total Retiré - Clean White Card */}
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-500">
              <DollarSign className="w-24 h-24 text-slate-900" />
            </div>
            <div className="relative z-10 space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Retiré</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black text-blue-600">-{wallet?.totalWithdrawnMad?.toLocaleString() || 0}</h3>
                <span className="text-sm font-bold text-slate-400 uppercase">DH</span>
              </div>
              <p className="text-[9px] font-bold text-slate-300 italic">Virements effectués</p>
            </div>
          </div>
        </div>

        {/* Right Column: Analytics Chart */}
        <div className="lg:col-span-8">
          <ProCard variant="glass" className="h-full p-8 bg-white border border-slate-100 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  {chartType === 'revenue' ? (
                    <><Activity className="w-6 h-6 text-influencer-500" /> Performance</>
                  ) : (
                    <><Wallet className="w-6 h-6 text-blue-500" /> Évolution du Solde</>
                  )}
                </h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {chartType === 'revenue' ? `Revenus des ${dateRange === 'custom' ? 'derniers' : dateRange} jours` : `Suivi du portefeuille sur ${dateRange === 'custom' ? 'la période' : dateRange + ' jours'}`}
                </p>
              </div>

              <div className="flex flex-col items-end gap-3">
                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                  <button
                    onClick={() => loadDashboard()}
                    className="p-2 text-slate-400 hover:text-slate-600 transition-all"
                    title="Actualiser"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  <div className="w-px h-3 bg-slate-200 mx-1" />
                  <div className="flex items-center">
                    {[7, 30, 'all', 'custom'].map((range) => (
                      <button
                        key={range}
                        onClick={() => setDateRange(range as any)}
                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                          dateRange === range 
                            ? 'bg-white text-slate-900 shadow-sm border border-slate-100' 
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        {range === 'custom' ? 'Custom' : range === 'all' ? 'Tout' : `${range}J`}
                      </button>
                    ))}
                  </div>
                  <div className="w-px h-3 bg-slate-200 mx-2" />
                  <div className="flex bg-slate-200/50 p-0.5 rounded-lg">
                    <button
                      onClick={() => setChartType('revenue')}
                      className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-md transition-all ${
                        chartType === 'revenue' ? 'bg-white text-influencer-600 shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      Ventes
                    </button>
                    <button
                      onClick={() => setChartType('balance')}
                      className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-md transition-all ${
                        chartType === 'balance' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      Solde
                    </button>
                  </div>
                </div>

                {dateRange === 'custom' && (
                  <div className="flex items-center gap-2 animate-in slide-in-from-top-1 duration-300">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-600 outline-none focus:border-slate-300 transition-all"
                    />
                    <span className="text-slate-300 font-bold text-[10px]">→</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-600 outline-none focus:border-slate-300 transition-all"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartType === 'revenue' ? revenueData : balanceData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartType === 'revenue' ? '#8b5cf6' : '#3b82f6'} stopOpacity={0.1}/>
                      <stop offset="95%" stopColor={chartType === 'revenue' ? '#8b5cf6' : '#3b82f6'} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} tickFormatter={(val) => `${val} DH`} />
                  <RechartsTooltip 
                    contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px'}}
                    itemStyle={{fontWeight: 900, color: chartType === 'revenue' ? '#8b5cf6' : '#3b82f6'}}
                    formatter={(val: number) => [`${val.toLocaleString()} DH`, chartType === 'revenue' ? 'Revenu' : 'Solde']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey={chartType === 'revenue' ? 'amount' : 'balance'} 
                    stroke={chartType === 'revenue' ? '#8b5cf6' : '#3b82f6'} 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                    animationDuration={1000}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ProCard>
        </div>
      </div>

      {/* Stats Quick Cards: Grid of 5 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
        {[
          { label: 'Page Views', val: todayClicks, icon: MousePointerClick, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Ventes', val: todayConversions, icon: Zap, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Taux de Conv.', val: `${todayClicks > 0 ? ((todayConversions / todayClicks) * 100).toFixed(1) : 0}%`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Confirmation', val: `${confirmationRate.toFixed(1)}%`, icon: CheckCircle2, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Livraison', val: `${deliveryRate.toFixed(1)}%`, icon: Truck, color: 'text-emerald-600', bg: 'bg-emerald-50' }
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
            <div className="flex items-center justify-between mt-3">
              <h3 className={`text-2xl font-black ${stat.color}`}>{stat.val}</h3>
              <div className={`p-2.5 ${stat.bg} ${stat.color} rounded-2xl group-hover:scale-110 transition-transform`}>
                <stat.icon className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Meilleurs Produits */}
      <ProCard variant="glass" className="p-8 bg-white border border-slate-100 shadow-sm">
        <h2 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-influencer-500" /> Meilleurs Produits Performance
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {topProducts.length > 0 ? topProducts.map((product, idx) => (
            <div key={product.productId} className="flex items-center gap-4 p-6 rounded-[2.5rem] bg-slate-50/50 hover:bg-white border border-transparent hover:border-slate-100 transition-all group">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-sm border border-slate-100 group-hover:scale-110 transition-transform duration-500">
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center text-2xl">📦</div>
                  )}
                </div>
                <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white shadow-md border border-slate-100 flex items-center justify-center text-xs">
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-900 truncate">{product.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{product.sales} Ventes</p>
                  <div className="w-1 h-1 bg-slate-300 rounded-full" />
                  <p className="text-sm font-black text-green-600">+{product.earnings.toFixed(2)} DH</p>
                </div>
              </div>
            </div>
          )) : (
            <div className="col-span-3 text-center py-12 text-slate-400 font-medium bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
              <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-20" />
              Aucun produit performant pour le moment
            </div>
          )}
        </div>
      </ProCard>
    </div>
  );
}

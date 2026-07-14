import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { dashboardApi, influencerApi } from '../../lib/api';
import { ReferralLink, InfluencerCommission } from '../../types';
import {
  DollarSign, TrendingUp, Zap, MousePointerClick, ArrowUpRight, Crown,
  Plus, ShoppingBag, Wallet, Activity, BarChart3, CheckCircle2, Truck, ExternalLink, Eye, RefreshCw,
  MessageCircle
} from 'lucide-react';
import { ProCard } from '../../components/common/ProCard';
import { TierProgressBanner } from '../../components/influencer/TierProgressBanner';
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
  const { t } = useLanguage();
  const [referralLinks, setReferralLinks] = useState<ReferralLink[]>([]);
  const [commissions, setCommissions] = useState<InfluencerCommission[]>([]);
  const [allCommissions, setAllCommissions] = useState<InfluencerCommission[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [walletTransactions, setWalletTransactions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    conversions: 0,
    confirmed: 0,
    delivered: 0,
    totalViews: 0,
    uniqueVisitors: 0,
    whatsappClicks: 0
  });
  const [leadCountsByLink, setLeadCountsByLink] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<number | 'custom' | 'all'>('all');
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

      // Filter links stats by the same date range
      const linkParams: any = {};
      if (dateRange === 'custom') {
        if (startDate) linkParams.start = startDate;
        if (endDate) linkParams.end = endDate;
      } else if (typeof dateRange === 'number') {
        const start = new Date();
        start.setDate(start.getDate() - (dateRange - 1));
        linkParams.start = start.toISOString().split('T')[0];
        linkParams.end = new Date().toISOString().split('T')[0];
      }

      const [dashboardRes, linksRes, customersRes] = await Promise.all([
        dashboardApi.influencer(params),
        influencerApi.getLinks(linkParams),
        influencerApi.getCustomers({ all: true })
      ]);
      
      setReferralLinks(linksRes.data);
      // Use commissions from dashboardRes which are correctly filtered by date
      setCommissions(dashboardRes.data.commissions || []);
      setWallet(dashboardRes.data.wallet);
      setWalletTransactions(dashboardRes.data.walletTransactions || []);
      setStats(dashboardRes.data.stats || { conversions: 0, confirmed: 0, delivered: 0 });
      setLeadCountsByLink(dashboardRes.data.leadCountsByLink || []);

      const commissionsData = customersRes.data?.data?.commissions || customersRes.data?.commissions || [];
      setAllCommissions(commissionsData);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalViews = stats.totalViews || 0;
  const uniqueVisitors = stats.uniqueVisitors || 0;
  const whatsappClicks = stats.whatsappClicks || 0;

  const totalLeads = stats.conversions || 0;
  const confirmedLeads = stats.confirmed || 0;
  const deliveredLeads = stats.delivered || 0;

  const confirmationRate = totalLeads > 0 ? (confirmedLeads / totalLeads) * 100 : 0;
  const deliveryRate = confirmedLeads > 0 ? (deliveredLeads / confirmedLeads) * 100 : 0;

  const todayConversions = totalLeads;
  const totalItems = totalLeads;
  const confirmedItems = confirmedLeads;
  const deliveredItems = deliveredLeads;

  const totalLinkClicks = referralLinks.reduce((sum, l) => sum + (l.clicks || 0), 0);
  const totalLinkConversions = referralLinks.reduce((sum, l) => sum + (l.conversions || 0), 0);
  const totalLinkRawClicks = referralLinks.reduce((sum, l) => sum + (l.rawClicks || l.clicks || 0), 0);
  const totalLinkWhatsappClicks = referralLinks.reduce((sum, l) => sum + (l.whatsappClicks || 0), 0);

  // Generate chart day keys based on range
  const getNumDays = () => {
    if (dateRange === 'all') {
      const allDates = [
        ...commissions.map(c => new Date(c.createdAt).getTime()),
        ...walletTransactions.map(tx => new Date(tx.createdAt).getTime())
      ];
      if (allDates.length === 0) return 7;
      const firstDate = new Date(Math.min(...allDates));
      const diffTime = Math.abs(new Date().getTime() - firstDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(7, Math.min(diffDays + 1, 365)); // Ensure at least 7 days to draw a nice line, cap at 365
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

    const val = latestTxBefore ? latestTxBefore.balanceAfterMad : (walletTransactions.length > 0 ? 0 : (wallet?.balanceMad || 0));
    return { date, balance: Number(val.toFixed(2)) };
  });


  // Financial calculations based on filtered transactions
  const periodEarned = walletTransactions.reduce((sum, tx) => tx.amountMad > 0 ? sum + tx.amountMad : sum, 0);
  const periodWithdrawn = Math.abs(walletTransactions.reduce((sum, tx) => tx.amountMad < 0 ? sum + tx.amountMad : sum, 0));
  
  // Use period-based stats if date filter is active, otherwise use all-time wallet totals
  const isFiltered = dateRange !== 'all';
  const displayEarned = isFiltered ? periodEarned : (wallet?.totalEarnedMad || 0);
  const displayWithdrawn = isFiltered ? periodWithdrawn : (wallet?.totalWithdrawnMad || 0);
  
  // For balance, we usually show current balance unless it's a historical report
  // But to be consistent with "filter effect", we'll show the balance as of the end of the period
  const displayBalance = (isFiltered && walletTransactions.length > 0) 
    ? walletTransactions[0].balanceAfterMad 
    : (wallet?.balanceMad || 0);

  // Tier Calculation (always based on all-time earned for progression)
  const totalEarnedAllTime = wallet?.totalEarnedMad || 0;
  let currentTier = { name: 'Bronze', color: 'text-amber-700 bg-amber-50' };
  let nextTier: { name: string, limit: number, color: string, textColor: string } | null = null;
  let progress = 0;

  if (totalEarnedAllTime >= 10000000) {
    currentTier = { name: 'Platine', color: 'text-indigo-600 bg-indigo-50' };
    nextTier = null;
    progress = 100;
  } else if (totalEarnedAllTime >= 1000000) {
    currentTier = { name: 'Gold', color: 'text-yellow-600 bg-yellow-50' };
    nextTier = { name: 'Platine', limit: 10000000, color: 'bg-indigo-400', textColor: 'text-indigo-500' };
    progress = (totalEarnedAllTime / 10000000) * 100;
  } else if (totalEarnedAllTime >= 100000) {
    currentTier = { name: 'Silver', color: 'text-slate-600 bg-slate-100' };
    nextTier = { name: 'Gold', limit: 1000000, color: 'bg-yellow-400', textColor: 'text-yellow-600' };
    progress = (totalEarnedAllTime / 1000000) * 100;
  } else {
    currentTier = { name: 'Débutant', color: 'text-slate-500 bg-slate-100' };
    nextTier = { name: 'Silver', limit: 100000, color: 'bg-slate-300', textColor: 'text-slate-400' };
    progress = (totalEarnedAllTime / 100000) * 100;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-influencer-200 border-t-influencer-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">


      {/* Tier Progress Banner */}
      <TierProgressBanner totalEarned={wallet?.totalEarnedMad || 0} />

      {/* Stats Quick Cards: Grid of 7 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 xl:gap-6">
        {/* Card 1: Vues de Page */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group flex flex-col justify-between min-h-[145px]">
          <div className="flex items-start justify-between">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{t('db_page_views', 'dashboard')}</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-3xl font-black text-blue-600 tracking-tight">{totalLinkRawClicks.toLocaleString()}</h3>
          </div>
          <div className="mt-4 pt-2 border-t border-slate-100/50 flex items-center justify-between text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">
            <span>{t('db_total_views', 'dashboard')}</span>
          </div>
        </div>

        {/* Card 2: Visiteurs Uniques */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group flex flex-col justify-between min-h-[145px]">
          <div className="flex items-start justify-between">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{t('db_uniques', 'dashboard')}</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform">
              <MousePointerClick className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-3xl font-black text-indigo-600 tracking-tight">{totalLinkClicks.toLocaleString()}</h3>
          </div>
          <div className="mt-4 pt-2 border-t border-slate-100/50 flex items-center justify-between text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">
            <span>{t('db_unique_traffic', 'dashboard')}</span>
          </div>
        </div>

        {/* Card 3: Clics WhatsApp */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group flex flex-col justify-between min-h-[145px]">
          <div className="flex items-start justify-between">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{t('db_whatsapp_clicks', 'dashboard')}</span>
            <div className="p-2 bg-green-50 text-green-600 rounded-xl group-hover:scale-110 transition-transform">
              <MessageCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-3xl font-black text-green-600 tracking-tight">{totalLinkWhatsappClicks.toLocaleString()}</h3>
          </div>
          <div className="mt-4 pt-2 border-t border-slate-100/50 flex items-center justify-between text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">
            <span>{t('db_whatsapp_clicks', 'dashboard')}</span>
          </div>
        </div>

        {/* Card 4: Leads Totaux */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group flex flex-col justify-between min-h-[145px]">
          <div className="flex items-start justify-between">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{t('db_total_leads', 'dashboard')}</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-3xl font-black text-emerald-600 tracking-tight">{todayConversions.toLocaleString()}</h3>
          </div>
          <div className="mt-4 pt-2 border-t border-slate-100/50 flex items-center justify-between text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">
            <span>{t('db_total_leads', 'dashboard')}</span>
          </div>
        </div>

        {/* Card 5: Taux de Conversion */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group flex flex-col justify-between min-h-[145px]">
          <div className="flex items-start justify-between">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{t('db_conv_rate', 'dashboard')}</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl group-hover:scale-110 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-3xl font-black text-purple-600 tracking-tight">
              {totalLinkClicks > 0 ? ((totalLinkConversions / totalLinkClicks) * 100).toFixed(1) : '0.0'}%
            </h3>
          </div>
          <div className="mt-4 pt-2 border-t border-slate-100/50 flex items-center justify-between text-[8px] font-extrabold text-purple-700 uppercase tracking-wider">
            <span>{t('db_leads_visitors', 'dashboard')}</span>
          </div>
        </div>

        {/* Card 6: Taux de Confirmation */}
        <div className="relative bg-white p-5 rounded-2xl border border-slate-100/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group flex flex-col justify-between min-h-[145px] border-b-4 border-b-amber-400 pb-7">
          <div className="flex items-start justify-between">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{t('db_confirmation', 'dashboard')}</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-3xl font-black text-amber-600 tracking-tight">
              {confirmationRate.toFixed(1)}%
            </h3>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{t('db_ratio', 'dashboard')} ({confirmedItems}/{totalItems})</p>
          </div>
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[9px] font-black px-3.5 py-1.5 rounded-full shadow-lg border-2 border-white whitespace-nowrap uppercase tracking-widest transition-transform group-hover:scale-105">
            {confirmedItems} {t('db_leads_confirmed', 'dashboard')}
          </div>
        </div>

        {/* Card 7: Taux de Livraison */}
        <div className="relative bg-white p-5 rounded-2xl border border-slate-100/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group flex flex-col justify-between min-h-[145px] border-b-4 border-b-emerald-400 pb-7">
          <div className="flex items-start justify-between">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{t('db_delivery', 'dashboard')}</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-3xl font-black text-emerald-600 tracking-tight">
              {deliveryRate.toFixed(1)}%
            </h3>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{t('db_ratio', 'dashboard')} ({deliveredItems}/{confirmedItems})</p>
          </div>
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[9px] font-black px-3.5 py-1.5 rounded-full shadow-lg border-2 border-white whitespace-nowrap uppercase tracking-widest transition-transform group-hover:scale-105">
            {deliveredItems} {t('db_leads_delivered', 'dashboard')}
          </div>
        </div>
      </div>



      {/* Main Grid: Financial Cards (3) + Analytics (Chart) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: 3 Financial Cards */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Card 1: Main Balance - Solid Dark Background for Maximum Contrast */}
          <div className="bg-slate-900 rounded-2xl p-6 shadow-md relative overflow-hidden group border border-slate-800">
            <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
              <Wallet className="w-24 h-24 text-white" />
            </div>
            <div className="relative z-10 space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isFiltered ? t('db_final_balance', 'dashboard') : t('db_wallet_balance', 'dashboard')}</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-5xl font-black text-white">{displayBalance?.toLocaleString() || 0}</h3>
                <span className="text-sm font-bold text-slate-400 uppercase">DH</span>
              </div>
              <Link to="/influencer/wallet" className="flex items-center gap-2 text-xs font-black text-influencer-400 hover:text-white transition-colors group/link">
                {t('db_manage_withdrawals', 'dashboard')} <ArrowUpRight className="w-3 h-3 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Card 2: Total Earned - Clean White Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-500">
              <TrendingUp className="w-24 h-24 text-slate-900" />
            </div>
            <div className="relative z-10 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isFiltered ? t('db_earned_period', 'dashboard') : t('db_total_earned', 'dashboard')}</p>
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${currentTier.color}`}>
                    {t(currentTier.name === 'Débutant' ? 'tier_beginner' : currentTier.name === 'Silver' ? 'tier_silver' : currentTier.name === 'Gold' ? 'tier_gold' : currentTier.name === 'Platine' ? 'tier_platine' : currentTier.name, 'dashboard')}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-green-600">+{displayEarned?.toLocaleString() || 0}</h3>
                  <span className="text-sm font-bold text-slate-400 uppercase">DH</span>
                </div>
                <p className="text-[9px] font-bold text-slate-300 italic mt-1">{isFiltered ? t('db_selected_period', 'dashboard') : t('db_since_creation', 'dashboard')}</p>
              </div>
            </div>
          </div>

          {/* Card 3: Total Retiré - Clean White Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-500">
              <DollarSign className="w-24 h-24 text-slate-900" />
            </div>
            <div className="relative z-10 space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isFiltered ? t('db_withdrawn_period', 'dashboard') : t('db_total_withdrawn', 'dashboard')}</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black text-blue-600">-{displayWithdrawn?.toLocaleString() || 0}</h3>
                <span className="text-sm font-bold text-slate-400 uppercase">DH</span>
              </div>
              <p className="text-[9px] font-bold text-slate-300 italic">{isFiltered ? t('db_selected_period', 'dashboard') : t('db_wire_transfers', 'dashboard')}</p>
            </div>
          </div>
        </div>

        {/* Right Column: Analytics Chart */}
        <div className="lg:col-span-8">
          <ProCard variant="glass" className="h-full p-6 bg-white border border-slate-100 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">

              <div className="space-y-1">
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  {chartType === 'revenue' ? (
                    <><Activity className="w-6 h-6 text-influencer-500" /> {t('db_performance', 'dashboard')}</>
                  ) : (
                    <><Wallet className="w-6 h-6 text-blue-500" /> {t('db_balance_evolution', 'dashboard')}</>
                  )}
                </h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {chartType === 'revenue' 
                    ? (dateRange === 'custom' 
                        ? t('db_revenue_chart_sub', 'dashboard') 
                        : dateRange === 'all' 
                        ? t('db_revenue_chart_all', 'dashboard') 
                        : dateRange === 1 
                        ? t('db_revenue_chart_today', 'dashboard') 
                        : t('db_revenue_chart_days', 'dashboard').replace('{days}', String(dateRange)))
                    : (dateRange === 'custom' 
                        ? t('db_balance_chart_sub', 'dashboard') 
                        : dateRange === 'all' 
                        ? t('db_balance_chart_all', 'dashboard') 
                        : dateRange === 1 
                        ? t('db_balance_chart_today', 'dashboard') 
                        : t('db_balance_chart_days', 'dashboard').replace('{days}', String(dateRange)))}
                </p>
              </div>

              <div className="flex flex-col items-end gap-3">
                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                  <button
                    onClick={() => loadDashboard()}
                    className="p-2 text-slate-400 hover:text-slate-600 transition-all"
                    title={t('db_refresh', 'dashboard')}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  <div className="w-px h-3 bg-slate-200 mx-1" />
                  <div className="flex items-center">
                    {['all', 1, 7, 30, 'custom'].map((range) => (
                      <button
                        key={range}
                        onClick={() => setDateRange(range as any)}
                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                          dateRange === range 
                            ? 'bg-white text-slate-900 shadow-sm border border-slate-100' 
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        {range === 'custom' ? t('db_custom', 'dashboard') : range === 'all' ? t('db_all', 'dashboard') : range === 1 ? t('db_today', 'dashboard') : `${range}J`}
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
                      {t('db_sales', 'dashboard')}
                    </button>
                    <button
                      onClick={() => setChartType('balance')}
                      className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-md transition-all ${
                        chartType === 'balance' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      {t('db_balance_title', 'dashboard')}
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
            <div className="h-[300px] w-full">
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
                    formatter={(val: number) => [`${val.toLocaleString()} DH`, chartType === 'revenue' ? t('db_revenue_title', 'dashboard') : t('db_balance_title', 'dashboard')]}
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



    </div>
  );
}

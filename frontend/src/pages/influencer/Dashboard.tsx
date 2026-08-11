import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { dashboardApi, influencerApi } from '../../lib/api';
import { ReferralLink, InfluencerCommission } from '../../types';
import {
  DollarSign, TrendingUp, Zap, MousePointerClick, ArrowUpRight, Crown,
  Plus, ShoppingBag, Wallet, Activity, BarChart3, CheckCircle2, Truck, ExternalLink, Eye, RefreshCw,
  MessageCircle, Mail, Smartphone, Copy
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
  const { t, language } = useLanguage();
  const [referralLinks, setReferralLinks] = useState<ReferralLink[]>([]);
  const [commissions, setCommissions] = useState<InfluencerCommission[]>([]);
  const [periodLeads, setPeriodLeads] = useState<any[]>([]);
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
  const [helpers, setHelpers] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<number | 'custom' | 'all' | 'yesterday'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [chartType, setChartType] = useState<'revenue' | 'balance'>('revenue');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, [dateRange, startDate, endDate]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const params: any = { days: dateRange };
      if (dateRange === 'custom') {
        params.start = startDate;
        params.end = endDate;
      }

      const linkParams: any = { days: dateRange };
      if (dateRange === 'custom') {
        linkParams.start = startDate;
        linkParams.end = endDate;
      } else if (dateRange === 'all') {
        linkParams.days = 'all';
      } else if (dateRange === 'yesterday') {
        linkParams.start = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        linkParams.end = new Date().toISOString().split('T')[0];
      }

      const [dashboardRes, linksRes] = await Promise.all([
        dashboardApi.influencer(params),
        influencerApi.getLinks(linkParams),
      ]);
      
      setReferralLinks(linksRes.data);
      setCommissions(dashboardRes.data.commissions || []);
      setWallet(dashboardRes.data.wallet);
      setWalletTransactions(dashboardRes.data.walletTransactions || []);
      setStats(dashboardRes.data.stats || { conversions: 0, confirmed: 0, delivered: 0 });
      setLeadCountsByLink(dashboardRes.data.leadCountsByLink || []);
      setHelpers(dashboardRes.data.helpers || []);
      setPeriodLeads(dashboardRes.data.periodLeads || []);
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

      {/* Helpers / Account Managers Info */}
      {helpers && helpers.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">
            {helpers.length > 1 ? t('silacod_managers', 'dashboard') : t('silacod_manager', 'dashboard')}
          </h2>
          <div className={`grid grid-cols-1 ${helpers.length > 1 ? 'lg:grid-cols-2' : ''} gap-4`}>
            {helpers.map((h: any, idx: number) => (
              <div key={idx} className="bg-slate-900 rounded-3xl p-[2px] text-white shadow-xl relative overflow-hidden group border border-slate-800" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                {/* Inner glowing background or animated border */}
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-xl"></div>
                
                <div className="bg-slate-900 rounded-[22px] p-6 relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-inner h-full">
                  <div className="flex flex-col sm:flex-row items-center gap-5 w-full">
                    {/* Avatar with ring and online dot */}
                    <div className="relative shrink-0">
                      <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-black text-xl uppercase shadow-lg shadow-indigo-500/30 ring-2 ring-white/5 group-hover:ring-indigo-500/50 transition-all duration-300 overflow-hidden">
                        {h.avatarUrl ? (
                          <img src={h.avatarUrl} alt={h.fullName} className="w-full h-full object-cover" />
                        ) : (
                          h.fullName?.charAt(0) || '?'
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-900 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                    </div>
                    
                    <div className="text-center sm:text-start w-full">
                      <div className="flex items-center gap-2 justify-center sm:justify-start">
                        <h3 className="text-lg font-black tracking-tight text-white">{h.fullName}</h3>
                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[9px] font-black uppercase tracking-widest border border-indigo-500/20">
                          {t('silacod_manager', 'dashboard')}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-medium mt-1">
                        {language === 'ar' ? 'مكرس لنجاحك. تواصل معي في أي وقت.' : language === 'en' ? 'Dedicated to your success. Contact me at any time.' : 'Dédié à votre réussite. Contactez-moi à tout moment.'}
                      </p>
                      
                      {/* Contact info text with copy buttons */}
                      <div className="flex flex-wrap items-center gap-3 mt-3 justify-center sm:justify-start">
                        {h.email && (
                          <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 hover:border-white/20 transition-colors">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span className="text-[10.5px] text-slate-200 font-bold tracking-wide">{h.email}</span>
                            <button 
                              onClick={() => { navigator.clipboard.writeText(h.email); toast.success('Email copié !'); }}
                              className="p-1 hover:bg-white/10 rounded-md transition-colors text-slate-400 hover:text-white"
                              title="Copier l'email"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        {h.phone && (
                          <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 hover:border-white/20 transition-colors">
                            <Smartphone className="w-3 h-3 text-slate-400" />
                            <span className="text-[10.5px] text-slate-200 font-bold tracking-wide">{h.phone}</span>
                            <button 
                              onClick={() => { navigator.clipboard.writeText(h.phone); toast.success('Numéro copié !'); }}
                              className="p-1 hover:bg-white/10 rounded-md transition-colors text-slate-400 hover:text-white"
                              title="Copier le numéro"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 w-full sm:w-auto shrink-0 mt-4 sm:mt-0 flex-col sm:flex-row">
                    {h.email && (
                      <a
                        href={`mailto:${h.email}`}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                      >
                        <Mail className="w-4 h-4 text-indigo-400" />
                        <span>Email</span>
                      </a>
                    )}
                    {h.phone && (
                      <a
                        href={h.phone.replace(/[^0-9]/g, '').startsWith('0') ? `https://wa.me/212${h.phone.replace(/[^0-9]/g, '').slice(1)}` : `https://wa.me/${h.phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all text-emerald-400 hover:text-emerald-300"
                      >
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <path d="M12.012 2c-5.506 0-9.975 4.47-9.975 9.977 0 1.762.457 3.483 1.332 5.002L2 22l5.176-1.36c1.467.8 3.12 1.22 4.828 1.22 5.507 0 9.976-4.47 9.976-9.978C21.988 6.47 17.52 2 12.012 2zm5.727 13.917c-.244.692-1.2 1.258-1.656 1.31-.418.048-.962.072-1.564-.122-.38-.122-.862-.288-1.464-.537-2.585-1.07-4.25-3.69-4.378-3.864-.128-.172-.942-1.257-.942-2.398 0-1.14.59-1.702.825-1.93.243-.227.534-.287.712-.287.177 0 .355.002.51.01.164.008.384-.06.602.463.226.54.776 1.897.842 2.032.067.136.11.293.02.474-.09.18-.135.293-.27.452-.136.16-.285.358-.407.48-.136.136-.28.286-.12.56.16.273.714 1.18 1.53 1.91.815.73 1.5.95 1.716 1.062.215.112.34.093.466-.053.126-.146.544-.633.69-.85.145-.218.292-.18.497-.103.204.077 1.3.614 1.527.728.225.114.375.17.43.266.057.095.057.553-.187 1.245z"/>
                        </svg>
                        <span>WhatsApp</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

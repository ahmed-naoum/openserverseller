import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { dashboardApi, influencerApi } from '../../lib/api';
import { isConfirmedRow, isDeliveredRow, getLeadDate, getLeadActivityDate } from '../../lib/leadStatus';
import { ReferralLink, InfluencerCommission } from '../../types';
import {
  DollarSign, TrendingUp, Zap, MousePointerClick, ArrowUpRight, Crown,
  Plus, ShoppingBag, Wallet, BarChart3, CheckCircle2, Truck, ExternalLink, Eye, RefreshCw,
  MessageCircle, Mail, Smartphone, Copy, CalendarClock, Filter
} from 'lucide-react';
import { ProCard } from '../../components/common/ProCard';
import { TierProgressBanner } from '../../components/influencer/TierProgressBanner';
import { currentBasePath } from '../../lib/dashboardBase';
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

/**
 * The Performance card can be read two ways. Both count leads rather than money,
 * so neither carries a currency, and their colours mirror the confirmation and
 * delivery stat cards above the chart. (It also used to offer wallet "revenue"
 * and "balance" series; those were dropped — the wallet card covers them.)
 */
type ChartType = 'confirmed' | 'delivered';

const CHART_STYLES: Record<ChartType, { color: string; dataKey: string; isMoney: boolean }> = {
  confirmed: { color: '#f59e0b', dataKey: 'confirmed', isMoney: false },
  delivered: { color: '#10b981', dataKey: 'delivered', isMoney: false }
};

/** Local midnight yesterday — the anchor the HIER range is built from. */
const startOfYesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Local calendar date, not the UTC one toISOString() would give. West of
 * Greenwich that shifts a day; the API filters on the vendor's own dates.
 */
const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * The day before `now`, as the same `toDateString()` key the day filters
 * compare on. Built by stepping a copy back one day rather than subtracting
 * 24h, so it stays correct across a DST change.
 */
const yesterdayDateString = (now: Date) => {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return d.toDateString();
};

const CHART_TABS: { type: ChartType; labelKey: string }[] = [
  { type: 'confirmed', labelKey: 'db_chart_confirmed' },
  { type: 'delivered', labelKey: 'db_chart_delivered' }
];

/**
 * One bound of the custom range, read the way the server reads it. The two must
 * agree: the cards below count rows the API already filtered, so a bound parsed
 * differently here would drop leads the totals still include.
 *
 * A bare `YYYY-MM-DD` is local midnight — `new Date('2026-08-09')` would be UTC
 * midnight and shift the day. An inclusive end bound covers its whole day, or
 * its whole minute once the vendor picks an hour, so "jusqu'à 14:30" keeps
 * 14:30:45.
 */
const parseBound = (value: string, isEnd: boolean): Date | null => {
  if (!value) return null;
  const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = bare ? new Date(Number(bare[1]), Number(bare[2]) - 1, Number(bare[3])) : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (isEnd) {
    if (bare) d.setHours(23, 59, 59, 999);
    else d.setSeconds(59, 999);
  }
  return d;
};

/** The period presets, in the order they appear in the bar. */
const RANGE_KEYS = ['all', 1, 'yesterday', 7, 30, 'custom'] as const;

export default function VendorDashboard() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  // This page is mounted under both /dashboard and the sub-account tree, so in-page
  // links have to follow the URL rather than assume the vendor's own prefix.
  const base = currentBasePath(user?.role);
  const [referralLinks, setReferralLinks] = useState<ReferralLink[]>([]);
  // The dashboard's own commission list is a page and nothing here renders it;
  // the cards below count `periodLeads`, which comes from the sellerAffiliate endpoint.
  const [periodLeads, setPeriodLeads] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  // No transaction list is rendered here — the page of rows the API returns is
  // left unread, and only the window's totals below are used.
  const [walletStats, setWalletStats] = useState<any>(null);
  const [commissionsMeta, setCommissionsMeta] = useState<any>(null);
  // The only server-side figures this page still holds. Everything else it shows
  // is folded out of `periodLeads` in the browser — the response's own
  // conversions/confirmed/delivered describe the whole history and no card reads
  // them, so they are not kept. Clicks cannot be folded that way: the browser
  // never receives the click rows, so these three follow the period bar back to
  // the server on their own.
  const [traffic, setTraffic] = useState({ totalViews: 0, uniqueVisitors: 0, whatsappClicks: 0 });
  const [trafficLoading, setTrafficLoading] = useState(true);
  // Bumped by the refresh button so the traffic cards reload with everything
  // else — their window has not changed, so nothing else would re-trigger them.
  const [trafficNonce, setTrafficNonce] = useState(0);
  const [leadCountsByLink, setLeadCountsByLink] = useState<{ referralLinkId: number; _count: number }[]>([]);
  const [helpers, setHelpers] = useState<any[]>([]);
  // No "Tous" option: the page opens on the last 30 days, like the Leads page
  // it is read next to. An all-time window made the cards above answer a
  // question nobody asks of a dashboard.
  const [tableDateRange, setTableDateRange] = useState<'AUJOURD_HUI' | 'HIER' | '7J' | '15J' | '30J' | '90J' | 'CUSTOM'>('30J');
  const [tableSelectedProductId, setTableSelectedProductId] = useState<string>('ALL');
  const [dateBasis, setDateBasis] = useState<'STATUS' | 'CREATED'>('CREATED');
  const [dateRange, setDateRange] = useState<number | 'custom' | 'all' | 'yesterday'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [chartType, setChartType] = useState<ChartType>('confirmed');
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const currentMode = searchParams.get('mode') || user?.mode || 'SELLER';

  // Only the mode changes what the server returns: the payload is the account's
  // whole (slim) lead history plus aggregates, and every period pill, custom
  // range and product filter below works on it client-side. Refetching on each
  // pill click re-downloaded the identical payload — the deps used to include
  // every filter state and made switching periods feel like a page load.
  useEffect(() => {
    loadDashboard();
  }, [currentMode]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const params: any = { days: 'all' };
      const linkParams: any = { days: 'all' };

      const [dashboardRes, linksRes] = await Promise.all([
        dashboardApi.sellerAffiliate({ ...params, mode: currentMode }),
        influencerApi.getLinks({ ...linkParams, mode: currentMode }).catch(() => null)
      ]);

      setReferralLinks(linksRes?.data || []);
      setWallet(dashboardRes.data.wallet);
      setWalletStats(dashboardRes.data.walletStats || null);
      setCommissionsMeta(dashboardRes.data.commissionsMeta || null);
      setLeadCountsByLink(dashboardRes.data.leadCountsByLink || []);
      setHelpers(dashboardRes.data.helpers || []);
      setPeriodLeads(dashboardRes.data.periodLeads || []);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * The window the traffic cards ask the server for, spelled exactly the way the
   * lead filter below reads the same pills — otherwise the views card and the
   * leads card next to it would describe two different periods. The day pills
   * start at local midnight N days back and have no upper bound; AUJOURD_HUI is
   * the single day. Bare `YYYY-MM-DD` is what the API's parser wants: it reads
   * one as local midnight, where an ISO timestamp would shift the day.
   */
  const trafficWindow = useMemo<{ start?: string; end?: string }>(() => {
    if (tableDateRange === 'CUSTOM') {
      return { start: startDate || undefined, end: endDate || undefined };
    }
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    if (tableDateRange === 'AUJOURD_HUI') return { start: toISODate(from), end: toISODate(from) };
    if (tableDateRange === 'HIER') {
      from.setDate(from.getDate() - 1);
      return { start: toISODate(from), end: toISODate(from) };
    }
    from.setDate(from.getDate() - Number(tableDateRange.replace('J', '')));
    return { start: toISODate(from) };
  }, [tableDateRange, startDate, endDate]);

  /**
   * Clicks are the one thing on this screen the browser cannot narrow itself: it
   * holds the lead history, never the click rows. So the period bar re-reads
   * these three aggregates while every other card answers from memory, which is
   * what keeps pressing a pill from feeling like a page load.
   */
  useEffect(() => {
    let current = true;
    setTrafficLoading(true);
    dashboardApi
      .sellerAffiliateTraffic({
        ...trafficWindow,
        ...(tableSelectedProductId !== 'ALL' ? { referralLinkId: tableSelectedProductId } : {})
      })
      .then(res => { if (current) setTraffic(res.data); })
      .catch(() => { if (current) setTraffic({ totalViews: 0, uniqueVisitors: 0, whatsappClicks: 0 }); })
      .finally(() => { if (current) setTrafficLoading(false); });
    // Pills are pressed faster than these aggregates come back, so a stale reply
    // must not land on top of a newer window.
    return () => { current = false; };
  }, [trafficWindow, tableSelectedProductId, currentMode, trafficNonce]);

  const totalViews = traffic.totalViews || 0;
  const uniqueVisitors = traffic.uniqueVisitors || 0;
  const whatsappClicks = traffic.whatsappClicks || 0;

  const getRowDate = getLeadDate;

  const dateFilteredCommissions = useMemo(() => periodLeads.filter(c => {
    if (tableSelectedProductId !== 'ALL' && String(c.referralLinkId) !== tableSelectedProductId) {
      return false;
    }

    const leadDate = getRowDate(c);

    const now = new Date();
    if (tableDateRange === 'AUJOURD_HUI') {
      return leadDate.toDateString() === now.toDateString();
    }

    if (tableDateRange === 'HIER') {
      return leadDate.toDateString() === yesterdayDateString(now);
    }

    if (tableDateRange === 'CUSTOM') {
      if (!startDate && !endDate) return true;
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (leadDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (leadDate > end) return false;
      }
      return true;
    }

    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (tableDateRange === '7J') d.setDate(now.getDate() - 7);
    else if (tableDateRange === '15J') d.setDate(now.getDate() - 15);
    else if (tableDateRange === '30J') d.setDate(now.getDate() - 30);
    else if (tableDateRange === '90J') d.setDate(now.getDate() - 90);

    return leadDate >= d;
  }), [periodLeads, tableSelectedProductId, tableDateRange, startDate, endDate]);

  const createdLeadsInPeriod = useMemo(() => periodLeads.filter(c => {
    if (tableSelectedProductId !== 'ALL' && String(c.referralLinkId) !== tableSelectedProductId) {
      return false;
    }
    const leadDate = getLeadDate(c);
    const now = new Date();
    if (tableDateRange === 'AUJOURD_HUI') return leadDate.toDateString() === now.toDateString();
    if (tableDateRange === 'HIER') return leadDate.toDateString() === yesterdayDateString(now);
    if (tableDateRange === 'CUSTOM') {
      if (!startDate && !endDate) return true;
      if (startDate && leadDate < new Date(startDate)) return false;
      if (endDate && leadDate > new Date(endDate)) return false;
      return true;
    }
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (tableDateRange === '7J') d.setDate(now.getDate() - 7);
    else if (tableDateRange === '15J') d.setDate(now.getDate() - 15);
    else if (tableDateRange === '30J') d.setDate(now.getDate() - 30);
    else if (tableDateRange === '90J') d.setDate(now.getDate() - 90);
    return leadDate >= d;
  }), [periodLeads, tableSelectedProductId, tableDateRange, startDate, endDate]);

  const totalLeads = dateFilteredCommissions.length;

  // Shared with the Leads page — these two screens are compared side by side, so
  // they must not carry their own copies of the confirmed/delivered rules.
  const confirmedLeads = dateFilteredCommissions.filter(isConfirmedRow).length;

  const deliveredLeads = dateFilteredCommissions.filter(isDeliveredRow).length;

  const confirmationRate = totalLeads > 0 ? (confirmedLeads / totalLeads) * 100 : 0;
  const deliveryRate = confirmedLeads > 0 ? (deliveredLeads / confirmedLeads) * 100 : 0;

  const todayConversions = totalLeads;
  const totalItems = totalLeads;
  const confirmedItems = confirmedLeads;
  const deliveredItems = deliveredLeads;

  // Generate chart day keys based on range
  const getNumDays = () => {
    if (dateRange === 'all') {
      // Both lists arrive newest-first and paged, so their oldest row is not on
      // the page we hold. The API reports the two first-seen dates instead.
      const allDates = [
        commissionsMeta?.firstCommissionAt,
        walletStats?.firstTransactionAt
      ]
        .filter(Boolean)
        .map(d => new Date(d as string).getTime())
        .filter(ts => !isNaN(ts));
      if (allDates.length === 0) return 7;
      const firstDate = new Date(Math.min(...allDates));
      const diffTime = Math.abs(new Date().getTime() - firstDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(7, Math.min(diffDays + 1, 365)); // Ensure at least 7 days to draw a nice line, cap at 365
    }
    if (dateRange === 'yesterday') return 1;
    return dateRange === 'custom' ? 7 : Number(dateRange);
  };

  /**
   * Last day of the selected range. Only "days back from now" ranges end today —
   * HIER ends yesterday and a custom window ends on its own end date.
   */
  const rangeEnd = () => {
    if (dateRange === 'yesterday') return startOfYesterday();
    if (dateRange === 'custom' && endDate) return new Date(endDate);
    return new Date();
  };

  const numDays = getNumDays();

  // ---- Confirmed / delivered leads over time -------------------------------
  // Built from dateFilteredCommissions, the same list the confirmation and
  // delivery stat cards count, so the chart totals can never disagree with them.
  // The wallet charts key off transactions, which is why these get their own
  // buckets: a vendor can have leads on days with no wallet movement at all.

  // On TODAY and HIER a single day-bucket would draw one dot, so leads are
  // spread over the 24 hours instead — that is the "date and time" view.
  const leadsHourly = dateRange === 1 || dateRange === 'yesterday';

  const leadsNumDays = (() => {
    if (leadsHourly) return 1;
    if (dateRange === 'custom') {
      if (!startDate || !endDate) return numDays;
      const span = Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
      return Math.max(1, Math.min(span, 365));
    }
    if (dateRange === 'all') {
      const times = dateFilteredCommissions
        .map((c: any) => getLeadDate(c).getTime())
        .filter((ts: number) => !isNaN(ts));
      if (times.length === 0) return 7;
      const diffDays = Math.ceil(Math.abs(new Date().getTime() - Math.min(...times)) / 86400000);
      return Math.max(7, Math.min(diffDays + 1, 365));
    }
    // 7J/30J keep every lead the stat cards counted: their filter starts at
    // midnight N days back and runs through today, which is N+1 calendar days.
    // One bucket short here and a boundary lead is counted but never drawn.
    return Number(dateRange) + 1;
  })();

  const leadBucketKey = (d: Date) => leadsHourly
    ? `${String(d.getHours()).padStart(2, '0')}h`
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

  const leadsChartKeys = leadsHourly
    ? [...Array(24)].map((_, h) => `${String(h).padStart(2, '0')}h`)
    : [...Array(leadsNumDays)].map((_, i) => {
        const d = rangeEnd();
        d.setDate(d.getDate() - (leadsNumDays - 1 - i));
        return leadBucketKey(d);
      });

  const leadsData = (() => {
    const buckets = new Map<string, { total: number; confirmed: number; delivered: number }>();
    dateFilteredCommissions.forEach((c: any) => {
      const d = getLeadDate(c);
      if (isNaN(d.getTime())) return;
      const key = leadBucketKey(d);
      const bucket = buckets.get(key) || { total: 0, confirmed: 0, delivered: 0 };
      bucket.total += 1;
      if (isConfirmedRow(c)) bucket.confirmed += 1;
      if (isDeliveredRow(c)) bucket.delivered += 1;
      buckets.set(key, bucket);
    });
    return leadsChartKeys.map(date => ({
      date,
      ...(buckets.get(date) || { total: 0, confirmed: 0, delivered: 0 })
    }));
  })();

  const chartStyle = CHART_STYLES[chartType];
  // Only lead-count series remain, so there is no money branch left to pick.
  const chartData = leadsData;

  const chartSubtitle = (() => {
    const prefix = chartType === 'confirmed' ? 'db_confirmed_chart' : 'db_delivered_chart';
    if (dateRange === 'custom') return t(`${prefix}_sub`, 'dashboard');
    if (dateRange === 'all') return t(`${prefix}_all`, 'dashboard');
    if (dateRange === 1) return t(`${prefix}_today`, 'dashboard');
    if (dateRange === 'yesterday') return t(`${prefix}_yesterday`, 'dashboard');
    return t(`${prefix}_days`, 'dashboard').replace('{days}', String(dateRange));
  })();

  // Financial figures for the selected window. These are summed by the API over
  // every transaction in the window — `walletTransactions` only holds the first
  // page, so folding them here would report one page's worth of money.
  const periodEarned = walletStats?.periodEarnedMad || 0;
  const periodWithdrawn = walletStats?.periodWithdrawnMad || 0;

  // Use period-based stats if date filter is active, otherwise use all-time wallet totals
  const isFiltered = dateRange !== 'all';
  const displayEarned = isFiltered ? periodEarned : (wallet?.totalEarnedMad || 0);
  const displayWithdrawn = isFiltered ? periodWithdrawn : (wallet?.totalWithdrawnMad || 0);

  // For balance, we usually show current balance unless it's a historical report
  // But to be consistent with "filter effect", we'll show the balance as of the end of the period
  const displayBalance = (isFiltered && walletStats?.transactionCount > 0)
    ? walletStats.closingBalanceMad
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


      {/* Header with Mode Badge */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          {t('dashboard', 'dashboard')}
          {currentMode === 'SELLER' && <span className="ml-2 text-emerald-600 text-lg font-bold">({t('dashboard_seller_short', 'dashboard')})</span>}
          {currentMode === 'AFFILIATE' && <span className="ml-2 text-indigo-600 text-lg font-bold">({t('dashboard_affiliate_short', 'dashboard')})</span>}
        </h1>
      </div>

      {/* Tier Progress Banner */}
      <TierProgressBanner
        totalEarned={wallet?.totalEarnedMad || 0} 
        title={currentMode === 'SELLER' ? t('dashboard_seller', 'dashboard') : t('dashboard_affiliate', 'dashboard')}
        productsUrl={`${base}/inventory`}
        marketplaceUrl={`${base}/marketplace`}
      />

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

      {/* Global Stats Filter */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col xl:flex-row items-start xl:items-center gap-4 justify-between">
        <div className="flex items-center gap-2 mb-2 xl:mb-0">
          <Filter className="w-4 h-4 text-influencer-500" />
          <span className="text-xs font-black text-gray-900 uppercase tracking-widest">{t('filters_global', 'leads', 'Filtres Globaux')}</span>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
          {/* Product Filter */}
          <select 
            value={tableSelectedProductId}
            onChange={(e) => setTableSelectedProductId(e.target.value)}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-influencer-500 transition-all text-gray-600"
          >
            <option value="ALL">{t('all_products', 'leads', 'Tous les produits')}</option>
            {referralLinks.map(link => (
              <option key={link.id} value={link.id}>
                {link.product?.nameFr || link.code} {link.product?.sku ? `(${link.product.sku})` : ''}
              </option>
            ))}
          </select>

          {/* Date Range Pills */}
          <div className="flex flex-wrap items-center bg-gray-50 p-1 rounded-xl border border-gray-100 w-full sm:w-auto">
            {['AUJOURD_HUI', 'HIER', '7J', '15J', '30J', '90J', 'CUSTOM'].map((r) => {
              let label = r;
              if (r === 'AUJOURD_HUI') label = t('range_today', 'leads', "Aujourd'hui");
              else if (r === 'HIER') label = t('range_yesterday', 'leads', 'Hier');
              else if (r === 'CUSTOM') label = t('range_custom', 'leads', 'Personnalisé');
              else if (r.endsWith('J')) {
                const count = r.replace('J', '');
                label = t('range_days', 'leads', '{count}j').replace('{count}', count);
              }
              return (
                <button
                  key={r}
                  onClick={() => setTableDateRange(r as any)}
                  className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all flex-1 sm:flex-none text-center ${
                    tableDateRange === r 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {tableDateRange === 'CUSTOM' && (
            <div className="flex items-center gap-2 animate-fadeIn w-full sm:w-auto">
               <input 
                 type="date"
                 value={startDate}
                 onChange={(e) => setStartDate(e.target.value)}
                 className="flex-1 sm:flex-none text-[10px] font-bold bg-white border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-influencer-500/20"
               />
               <span className="text-[10px] text-gray-400 font-bold uppercase">{t('date_separator', 'leads', 'au')}</span>
               <input 
                 type="date"
                 value={endDate}
                 onChange={(e) => setEndDate(e.target.value)}
                 className="flex-1 sm:flex-none text-[10px] font-bold bg-white border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-influencer-500/20"
               />
            </div>
          )}

          <button
            onClick={() => { loadDashboard(); setTrafficNonce(n => n + 1); }}
            className="p-2 text-slate-400 hover:text-slate-600 transition-all"
            title={t('db_refresh', 'dashboard')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || trafficLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

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
            <h3 className={`text-3xl font-black text-blue-600 tracking-tight transition-opacity ${trafficLoading ? 'opacity-40' : ''}`}>{totalViews.toLocaleString()}</h3>
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
            <h3 className={`text-3xl font-black text-indigo-600 tracking-tight transition-opacity ${trafficLoading ? 'opacity-40' : ''}`}>{uniqueVisitors.toLocaleString()}</h3>
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
            <h3 className={`text-3xl font-black text-green-600 tracking-tight transition-opacity ${trafficLoading ? 'opacity-40' : ''}`}>{whatsappClicks.toLocaleString()}</h3>
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
            {(() => {
              // Both figures describe the selected window, so the ratio can no
              // longer read this period's leads against all-time visitors.
              //
              // The denominator is the visitor count as shown two cards to the
              // left, nothing else. It used to be Math.max(leads, visitors),
              // which pinned the card at 100% and printed a "Ratio (6/6)" next
              // to a Uniques card reading 2 — two numbers on the same screen
              // contradicting each other.
              //
              // Above 100% is a real reading, not an error: only landing-page
              // visits are tracked, while leads also arrive from manual
              // inserts, imports and WhatsApp, so a vendor who inserts orders
              // by hand genuinely has more leads than tracked visitors.
              const convRate = uniqueVisitors > 0 ? (totalLeads / uniqueVisitors) * 100 : null;
              return (
                <>
                  <h3 className="text-3xl font-black text-purple-600 tracking-tight">
                    {/* No visitors at all leaves the rate undefined — 0% would
                        read as "nobody converted" on a window with leads. */}
                    {convRate === null ? '—' : `${convRate.toFixed(1)}%`}
                  </h3>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Ratio ({totalLeads}/{uniqueVisitors})</p>
                </>
              );
            })()}
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
              <Link to={`${base}/wallet`} className="flex items-center gap-2 text-xs font-black text-influencer-400 hover:text-white transition-colors group/link">
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
                  {chartType === 'confirmed' && <><CheckCircle2 className="w-6 h-6 text-amber-500" /> {t('db_confirmed_evolution', 'dashboard')}</>}
                  {chartType === 'delivered' && <><Truck className="w-6 h-6 text-emerald-500" /> {t('db_delivered_evolution', 'dashboard')}</>}
                </h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {chartSubtitle}
                </p>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: chartStyle.color }}>
                  {chartType === 'confirmed'
                    ? `${confirmedItems} ${t('db_leads_confirmed', 'dashboard')}`
                    : `${deliveredItems} ${t('db_leads_delivered', 'dashboard')}`}
                </p>
              </div>

              {/* The period moved to the bar at the top of the page — it scopes
                  every card, not just this chart. Only the series switch is
                  local to the chart, so only it stays here. */}
              <div className="flex flex-wrap justify-end gap-1 bg-slate-100/70 p-1 rounded-xl border border-slate-100 self-start">
                {CHART_TABS.map(tab => (
                  <button
                    key={tab.type}
                    onClick={() => setChartType(tab.type)}
                    className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${
                      chartType === tab.type ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                    style={chartType === tab.type ? { color: CHART_STYLES[tab.type].color } : undefined}
                  >
                    {t(tab.labelKey, 'dashboard')}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartStyle.color} stopOpacity={0.1}/>
                      <stop offset="95%" stopColor={chartStyle.color} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}}
                    allowDecimals={chartStyle.isMoney}
                    tickFormatter={(val) => chartStyle.isMoney ? `${val} DH` : `${val}`}
                  />
                  <RechartsTooltip
                    contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px'}}
                    itemStyle={{fontWeight: 900, color: chartStyle.color}}
                    formatter={(val: number) => [
                      chartStyle.isMoney ? `${val.toLocaleString()} DH` : `${val.toLocaleString()} ${t('db_leads_unit', 'dashboard')}`,
                      chartType === 'confirmed' ? t('db_leads_confirmed', 'dashboard')
                        : t('db_leads_delivered', 'dashboard')
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey={chartStyle.dataKey}
                    stroke={chartStyle.color}
                    strokeWidth={4}
                    fillOpacity={1}
                    fill="url(#colorValue)"
                    dot={{ r: 3, fill: chartStyle.color, strokeWidth: 0 }}
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

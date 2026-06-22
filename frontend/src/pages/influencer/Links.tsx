import { useState, useEffect, Fragment } from 'react';
import { influencerApi } from '../../lib/api';
import { ReferralLink } from '../../types';
import { Search, Plus, MousePointerClick, Zap, Target, DollarSign, Copy, QrCode, RefreshCw, AlertCircle, Link as LinkIcon, Power, Eye, TrendingUp, Activity, Calendar, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  ResponsiveContainer, ComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, Legend 
} from 'recharts';
import { useLanguage } from '../../contexts/LanguageContext';
import { containsBlockedWord } from '../../utils/blockedWords';

export default function InfluencerLinks() {
  const { t } = useLanguage();
  const [links, setLinks] = useState<ReferralLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'earnings' | 'clicks' | 'conversions' | 'date'>('date');
  const [dailyStats, setDailyStats] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<number | 'custom' | 'all'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLinkIdForChart, setSelectedLinkIdForChart] = useState<number | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Record<number, boolean>>({});
  
  // Modal states
  const [selectedLink, setSelectedLink] = useState<ReferralLink | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  
  // Link Creation Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [claims, setClaims] = useState<any[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [customName, setCustomName] = useState('');
  const [customNameError, setCustomNameError] = useState('');
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [confirmInputValue, setConfirmInputValue] = useState('');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    icon: React.ReactNode;
    confirmText: string;
    variant: 'primary' | 'danger';
    isLoading?: boolean;
    requiresConfirmationText?: string;
    step?: 'send' | 'verify';
    maskedEmail?: string;
    linkId?: number;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    icon: <RefreshCw size={24} />,
    confirmText: 'Régénérer',
    variant: 'primary',
    requiresConfirmationText: '',
    step: 'send',
    maskedEmail: '',
    linkId: undefined
  });
  const [isToggling, setIsToggling] = useState<number | null>(null);

  const loadLinks = async () => {
    try {
      const params: any = {};
      if (dateRange === 'custom') {
        if (startDate) params.start = startDate;
        if (endDate) params.end = endDate;
      } else if (typeof dateRange === 'number') {
        const start = new Date();
        start.setDate(start.getDate() - (dateRange - 1));
        params.start = start.toISOString().split('T')[0];
        params.end = new Date().toISOString().split('T')[0];
      }
      const res = await influencerApi.getLinks(params);
      setLinks(res.data);
    } catch (error) {
      console.error('Failed to load links:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDailyStats = async () => {
    setIsStatsLoading(true);
    try {
      const params: any = {};
      if (dateRange === 'custom') {
        if (startDate) params.start = startDate;
        if (endDate) params.end = endDate;
      } else {
        params.days = dateRange;
      }
      if (selectedLinkIdForChart) {
        params.referralLinkId = selectedLinkIdForChart;
      }
      const res = await influencerApi.getDailyAnalytics(params);
      setDailyStats(res.data);
    } catch (err) {
      console.error('Failed to load daily stats:', err);
    } finally {
      setIsStatsLoading(false);
    }
  };

  // Single effect for date range changes — also fires on mount with default dateRange=1
  useEffect(() => {
    if (dateRange !== 'custom' || (startDate && endDate)) {
      loadLinks();
      loadDailyStats();
    }

    // Auto-refresh for real-time performance (every 30s)
    const interval = setInterval(() => {
       if (dateRange === 1 || dateRange === 7) {
         loadDailyStats();
       }
    }, 30000);

    return () => clearInterval(interval);
  }, [dateRange, startDate, endDate]);

  // Refetch chart when a specific link is selected/deselected
  useEffect(() => {
    if (dateRange !== 'custom' || (startDate && endDate)) {
      loadDailyStats();
    }
  }, [selectedLinkIdForChart]);

  const copyLink = (code: string) => {
    const link = `${window.location.origin}/r/${code}`;
    navigator.clipboard.writeText(link);
    toast.success(t('toast_copied', 'links'));
  };

  const handleToggleStatus = (link: ReferralLink) => {
    setConfirmModal({
      isOpen: true,
      title: link.isActive ? t('confirm_deactivate_title', 'links') || "Désactiver le lien ?" : t('confirm_activate_title', 'links') || "Activer le lien ?",
      message: link.isActive 
        ? t('confirm_deactivate_message', 'links') || "Êtes-vous sûr de vouloir désactiver ce lien ? Les visiteurs cliquant sur ce lien ne pourront plus accéder à l'offre et verront le message 'Offre indisponible'."
        : t('confirm_activate_message', 'links') || "Êtes-vous sûr de vouloir réactiver ce lien de parrainage ?",
      icon: <Power size={32} className={link.isActive ? "text-red-500 animate-pulse" : "text-emerald-500"} />,
      confirmText: link.isActive ? t('btn_deactivate', 'links') || "Oui, désactiver" : t('btn_activate', 'links') || "Oui, activer",
      variant: link.isActive ? 'danger' : 'primary',
      isLoading: false,
      step: undefined,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          const res = await influencerApi.updateLinkStatus(link.id, !link.isActive);
          setLinks(prev => prev.map(l => l.id === link.id ? { ...l, isActive: res.data.isActive } : l));
          toast.success(link.isActive ? t('toast_deactivated', 'links') : t('toast_activated', 'links'));
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          toast.error(t('toast_status_error', 'links'));
        } finally {
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  const toggleProductExpand = (productId: number) => {
    setExpandedProducts(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }));
  };

  const handleRegenerateCode = async (link: ReferralLink) => {
    // Step 1: Send OTP to influencer email
    setConfirmInputValue('');
    setConfirmModal({
      isOpen: true,
      title: t('otp_modal_title', 'links'),
      message: t('otp_modal_message', 'links'),
      icon: <AlertCircle size={32} className="text-amber-500" />,
      confirmText: t('btn_send_code', 'links'),
      variant: 'primary',
      isLoading: false,
      step: 'send',
      maskedEmail: '',
      linkId: link.id,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          const res = await influencerApi.sendRegenOtp(link.id);
          const maskedEmail = res.data?.data?.maskedEmail || res.data?.maskedEmail || '***';
          // Move to step 2: enter OTP
          setConfirmInputValue('');
          setConfirmModal(prev => ({
            ...prev,
            isLoading: false,
            step: 'verify',
            title: t('otp_verify_title', 'links'),
            message: t('otp_verify_message', 'links').replace('{email}', maskedEmail),
            icon: <AlertCircle size={32} className="text-blue-500" />,
            confirmText: t('btn_confirm', 'links'),
            variant: 'danger',
            maskedEmail,
            onConfirm: async () => {
              // This will be overridden by the verify handler below
            }
          }));
        } catch (err: any) {
          toast.error(err?.response?.data?.message || t('toast_send_code_error', 'links'));
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  const handleVerifyOtp = async () => {
    if (!confirmModal.linkId || confirmInputValue.length !== 6) return;
    setConfirmModal(prev => ({ ...prev, isLoading: true }));
    try {
      const res = await influencerApi.verifyRegenOtp(confirmModal.linkId, confirmInputValue);
      setLinks(prev => prev.map(l => l.id === confirmModal.linkId ? { ...l, code: res.data.code } : l));
      toast.success(t('toast_regen_success', 'links'));
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('toast_incorrect_otp', 'links'));
      setConfirmModal(prev => ({ ...prev, isLoading: false }));
    }
  };

  const fetchApprovedClaims = async () => {
    setClaimsLoading(true);
    try {
      const res = await influencerApi.getClaims();
      const claimsList = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setClaims(claimsList.filter((c: any) => c.status === 'APPROVED'));
    } catch (err) {
      toast.error(t('toast_load_claims_error', 'links'));
    } finally {
      setClaimsLoading(false);
    }
  };

  const handleNameChange = (val: string) => {
    let clean = val.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '');
    setCustomName(clean);

    if (!clean) {
      setCustomNameError('');
      return;
    }
    if (clean.length < 3) {
      setCustomNameError(t('err_name_short', 'links'));
      return;
    }
    if (clean.length > 20) {
      setCustomNameError(t('err_name_long', 'links'));
      return;
    }
    const regex = /^[a-zA-Z0-9-_]+$/;
    if (!regex.test(clean)) {
      setCustomNameError(t('err_name_invalid_chars', 'links'));
      return;
    }
    const blocked = containsBlockedWord(clean);
    if (blocked) {
      setCustomNameError(t('err_name_blocked', 'links'));
      return;
    }
    setCustomNameError('');
  };

  useEffect(() => {
    if (!customName || customName.length < 3 || customName.length > 20 || !/^[a-zA-Z0-9-_]+$/.test(customName)) {
      return;
    }
    if (containsBlockedWord(customName)) {
      return;
    }
    const timer = setTimeout(async () => {
      setIsCheckingName(true);
      try {
        const res = await influencerApi.checkLinkNameUnique(customName);
        if (!res.data.unique) {
          setCustomNameError(t('err_name_taken', 'links'));
        } else {
          setCustomNameError('');
        }
      } catch (err) {
        console.error('Error checking name uniqueness', err);
      } finally {
        setIsCheckingName(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [customName]);

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !customName || customNameError) return;

    setIsCreatingLink(true);
    try {
      await influencerApi.createLink(selectedProductId, customName);
      toast.success(t('toast_create_success', 'links'));
      setShowCreateModal(false);
      setCustomName('');
      setSelectedProductId(null);
      loadLinks();
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('toast_create_failed', 'links'));
    } finally {
      setIsCreatingLink(false);
    }
  };

  const totalClicks = links.reduce((sum, l) => sum + l.clicks, 0);
  const totalRawClicks = links.reduce((sum, l) => sum + (l.rawClicks || l.clicks), 0);
  const totalWhatsappClicks = links.reduce((sum, l) => sum + (l.whatsappClicks || 0), 0);
  const totalConversions = links.reduce((sum, l) => sum + l.conversions, 0);
  const totalEarnings = links.reduce((sum, l) => sum + l.earnings, 0);
  
  const totalLinksCount = links.length;
  const activeLinksCount = links.filter(l => l.isActive).length;
  const globalCTR = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

  const filteredLinks = links
    .filter(l => {
      if (!search) return true;
      const productName = l.product?.nameFr || '';
      return productName.toLowerCase().includes(search.toLowerCase()) || l.code.toLowerCase().includes(search.toLowerCase());
    })
    .sort((a, b) => {
      if (sortBy === 'earnings') return b.earnings - a.earnings;
      if (sortBy === 'clicks') return b.clicks - a.clicks;
      if (sortBy === 'conversions') return b.conversions - a.conversions;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  // Grouping filtered links by product ID
  const groupedProducts = filteredLinks.reduce((acc: any[], link) => {
    const productId = link.productId;
    let group = acc.find(g => g.productId === productId);
    if (!group) {
      group = {
        productId,
        product: link.product,
        links: [],
        totalRawClicks: 0,
        totalClicks: 0,
        totalConversions: 0,
        totalWhatsappClicks: 0,
        totalEarnings: 0,
        mostRecentDate: new Date(0)
      };
      acc.push(group);
    }
    
    group.links.push(link);
    group.totalRawClicks += (link.rawClicks || link.clicks);
    group.totalClicks += link.clicks;
    group.totalConversions += link.conversions;
    group.totalWhatsappClicks += (link.whatsappClicks || 0);
    group.totalEarnings += link.earnings;
    
    const linkDate = new Date(link.createdAt);
    if (linkDate > group.mostRecentDate) {
      group.mostRecentDate = linkDate;
    }
    
    return acc;
  }, []);

  const sortedGroupedProducts = [...groupedProducts].sort((a, b) => {
    if (sortBy === 'earnings') return b.totalEarnings - a.totalEarnings;
    if (sortBy === 'clicks') return b.totalClicks - a.totalClicks;
    if (sortBy === 'conversions') return b.totalConversions - a.totalConversions;
    return b.mostRecentDate.getTime() - a.mostRecentDate.getTime();
  });


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-influencer-200 border-t-influencer-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">{t('title', 'links')}</h1>
          <p className="text-slate-500 font-medium mt-1">{t('subtitle', 'links')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              setLoading(true);
              try {
                await Promise.all([loadLinks(), loadDailyStats()]);
                toast.success(t('toast_refresh_success', 'links'));
              } catch (err) {
                toast.error(t('toast_refresh_failed', 'links'));
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading || isStatsLoading}
            className="flex items-center justify-center p-3.5 bg-white border border-slate-100 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
            title={t('tooltip_refresh', 'links')}
          >
            <RefreshCw className={`w-5 h-5 ${(loading || isStatsLoading) ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              setShowCreateModal(true);
              fetchApprovedClaims();
            }}
            className="flex items-center gap-2 px-8 py-3.5 bg-slate-900 text-white rounded-2xl text-sm font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
          >
            <Plus className="w-4 h-4" /> {t('btn_create_link', 'links')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-7 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('stat_total_views', 'links')}</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-slate-900">{totalRawClicks.toLocaleString()}</h3>
            <div className="p-2 bg-violet-50 text-violet-600 rounded-xl"><Eye className="w-4 h-4" /></div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('stat_unique_visitors', 'links')}</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-slate-900">{totalClicks.toLocaleString()}</h3>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><MousePointerClick className="w-4 h-4" /></div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('stat_total_sales', 'links')}</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-slate-900">{totalConversions.toLocaleString()}</h3>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl"><Zap className="w-4 h-4" /></div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('stat_whatsapp_clicks', 'links')}</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-slate-900">{totalWhatsappClicks.toLocaleString()}</h3>
            <div className="p-2 bg-green-50 text-green-600 rounded-xl"><MessageCircle className="w-4 h-4" /></div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('stat_conv_rate', 'links')}</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-indigo-600">{globalCTR.toFixed(1)}%</h3>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Target className="w-4 h-4" /></div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('stat_active_links', 'links')}</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-emerald-600">{activeLinksCount}</h3>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><Power className="w-4 h-4" /></div>
          </div>
        </div>
        <div className="bg-slate-900 p-4 rounded-xl shadow-md">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('stat_total_links', 'links')}</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-white">{totalLinksCount}</h3>
            <div className="p-2 bg-white/10 text-white rounded-xl"><LinkIcon className="w-4 h-4" /></div>
          </div>
        </div>
      </div>

      {/* Performance Chart Section */}
      <div id="performance-chart" className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-5 h-5 text-influencer-500" /> {t('chart_title', 'links')} ({dateRange === 'custom' ? t('range_custom', 'links') : dateRange === 'all' ? t('range_all', 'links') : `${dateRange}j`})
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                {selectedLinkIdForChart 
                  ? `${t('chart_single_prefix', 'links')}: ${links.find(l => l.id === selectedLinkIdForChart)?.product?.nameFr}` 
                  : t('chart_global_desc', 'links')}
              </p>
            </div>
            {selectedLinkIdForChart && (
              <button 
                onClick={() => setSelectedLinkIdForChart(null)}
                className="px-3 py-1 bg-red-50 text-red-500 text-[10px] font-black rounded-lg border border-red-100 hover:bg-red-100 transition-all flex items-center gap-2"
              >
                <AlertCircle size={12} /> {t('btn_clear_filter', 'links')}
              </button>
            )}
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            <div className="flex flex-wrap items-center gap-4">
              <select
                value={selectedLinkIdForChart || ''}
                onChange={(e) => setSelectedLinkIdForChart(e.target.value ? Number(e.target.value) : null)}
                className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-1.5 text-[10px] font-bold outline-none focus:border-slate-900 transition-all"
              >
                <option value="">{t('option_all_links', 'links')}</option>
                {links.map(l => (
                  <option key={l.id} value={l.id}>{l.product?.nameFr || l.code}</option>
                ))}
              </select>

              <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                <button
                  onClick={() => setDateRange('all')}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                    dateRange === 'all'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {t('range_all', 'links')}
                </button>
                {[1, 7, 15, 30, 90].map((days) => (
                  <button
                    key={days}
                    onClick={() => setDateRange(days)}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                      dateRange === days
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                  }`}
                  >
                    {days === 1 ? t('range_today', 'links') : `${days}j`}
                  </button>
                ))}
                <button
                  onClick={() => setDateRange('custom')}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                    dateRange === 'custom'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {t('range_custom', 'links')}
                </button>
              </div>

              {dateRange === 'custom' && (
                <div className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-300">
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-[10px] font-bold outline-none focus:border-slate-900 transition-all"
                  />
                  <span className="text-[10px] font-black text-slate-300">{t('date_separator', 'links')}</span>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-[10px] font-bold outline-none focus:border-slate-900 transition-all"
                  />
                </div>
              )}
            </div>
            <div className="hidden lg:block h-8 w-[1px] bg-slate-100" />
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-blue-500 rounded-full" /> {t('views_visitors', 'links')}</div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-violet-500 rounded-full" /> {t('views_total', 'links')}</div>
            </div>
          </div>
        </div>
        
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart 
              data={dailyStats} 
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorRawViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{fontSize: 9, fontWeight: 700, fill: '#64748b'}}
                tickFormatter={(str) => {
                  const d = new Date(str);
                  if (dateRange === 1) {
                    return d.toLocaleTimeString('fr-FR', { hour: '2-digit' });
                  }
                  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                }}
              />
              <YAxis 
                yAxisId="left"
                axisLine={false} 
                tickLine={false} 
                tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} 
              />
              <RechartsTooltip 
                contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '15px' }}
                itemStyle={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}
                labelStyle={{ marginBottom: '10px', fontSize: '12px', fontWeight: 900, color: '#1e293b' }}
                cursor={{ stroke: '#f1f5f9', strokeWidth: 2 }}
                labelFormatter={(label) => {
                  const d = new Date(label);
                  if (dateRange === 1) {
                    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                  }
                  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
                }}
              />
              <Area 
                yAxisId="left"
                type="monotone" 
                dataKey="rawViews" 
                stroke="#8b5cf6" 
                strokeWidth={3}
                fillOpacity={1} 
                dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, strokeWidth: 0, fill: '#8b5cf6' }}
                fill="url(#colorRawViews)" 
                name={t('views_total', 'links')}
              />
              <Area 
                yAxisId="left"
                type="monotone" 
                dataKey="views" 
                stroke="#3b82f6" 
                strokeWidth={2}
                fillOpacity={1} 
                dot={{ r: 3, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 5, strokeWidth: 0, fill: '#3b82f6' }}
                fill="url(#colorViews)" 
                name={t('views_visitors', 'links')}
              />

            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>


      {/* Filters & Actions */}
      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="flex-1 relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            className="w-full pl-12 pr-4 py-3.5 bg-white rounded-2xl border border-slate-100 shadow-sm focus:ring-2 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all font-medium text-sm"
            placeholder={t('search_placeholder', 'links')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-100 shadow-sm">
          {(['date', 'earnings', 'clicks', 'conversions'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                sortBy === s
                  ? 'bg-slate-900 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              {s === 'date' ? t('sort_date', 'links') : s === 'earnings' ? t('sort_earnings', 'links') : s === 'clicks' ? t('sort_visitors', 'links') : t('sort_sales', 'links')}
            </button>
          ))}
        </div>
      </div>

      {/* Links Pro Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {sortedGroupedProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('th_product', 'links')}</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('th_links_count', 'links') || "Liens"}</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('th_performance_combined', 'links') || "Performance Cumulée"}</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{t('th_earnings_combined', 'links') || "Gains Totaux"}</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{t('th_actions', 'links')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedGroupedProducts.map((group) => {
                  const isExpanded = !!expandedProducts[group.productId];
                  const activeCount = group.links.filter((l: any) => l.isActive).length;
                  const combinedCtr = group.totalClicks > 0 ? ((group.totalConversions / group.totalClicks) * 100).toFixed(1) : '0.0';
                  const isLimitReached = group.links.length >= 5;
                  
                  return (
                    <Fragment key={`group-${group.productId}`}>
                      <tr 
                        onClick={() => toggleProductExpand(group.productId)}
                        className={`hover:bg-slate-50/50 transition-all group cursor-pointer ${isExpanded ? 'bg-slate-50/20' : ''}`}
                      >
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="relative w-12 h-12 rounded-2xl overflow-hidden border border-slate-100 shadow-sm flex-shrink-0">
                              {group.product?.images?.[0]?.imageUrl ? (
                                <img src={group.product.images[0].imageUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400"><Eye size={16} /></div>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-900 truncate max-w-[200px]">{group.product?.nameFr || t('default_product', 'links')}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase">SKU: {group.product?.sku}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <span className="px-2.5 py-1 bg-slate-50 text-slate-700 rounded-xl text-xs font-bold border border-slate-100">
                              {group.links.length} {group.links.length > 1 ? t('links_plural', 'links') || "liens" : t('links_singular', 'links') || "lien"}
                            </span>
                            <span className="text-[9px] font-bold text-emerald-600">
                              {activeCount} {t('active_label', 'links') || "actifs"}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center justify-center">
                            <div className="flex items-center gap-6">
                              <div className="text-center">
                                <p className="text-xs font-black text-slate-900 mb-0.5">{group.totalRawClicks.toLocaleString()}</p>
                                <div className="flex items-center justify-center gap-1">
                                  <Eye size={10} className="text-violet-500" />
                                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{t('perf_views', 'links')}</p>
                                </div>
                              </div>
                              <div className="text-center">
                                <p className="text-xs font-black text-slate-900 mb-0.5">{group.totalClicks.toLocaleString()}</p>
                                <div className="flex items-center justify-center gap-1">
                                  <MousePointerClick size={10} className="text-blue-500" />
                                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{t('perf_visitors', 'links')}</p>
                                </div>
                              </div>
                              <div className="text-center">
                                <p className="text-xs font-black text-slate-900 mb-0.5">{group.totalConversions.toLocaleString()}</p>
                                <div className="flex items-center justify-center gap-1">
                                  <Zap size={10} className="text-purple-500" />
                                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{t('perf_sales', 'links')}</p>
                                </div>
                              </div>
                              <div className="text-center">
                                <p className="text-xs font-black text-indigo-600 mb-0.5">{combinedCtr}%</p>
                                <div className="flex items-center justify-center gap-1">
                                  <Target size={10} className="text-indigo-500" />
                                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{t('perf_ctr', 'links')}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right font-black text-slate-950 text-sm">
                          {group.totalEarnings.toLocaleString()} MAD
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex items-center justify-end gap-3" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                setSelectedProductId(group.productId);
                                setCustomName('');
                                setCustomNameError('');
                                setShowCreateModal(true);
                                fetchApprovedClaims();
                              }}
                              disabled={isLimitReached}
                              className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              {t('btn_create', 'links') || "Créer"}
                            </button>
                            <button
                              onClick={() => toggleProductExpand(group.productId)}
                              className="p-2 bg-slate-50 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                      
                      {isExpanded && (
                        <tr key={`expanded-${group.productId}`}>
                          <td colSpan={5} className="bg-slate-50/50 px-8 py-6 border-b border-slate-100">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                                  {t('links_details_title', 'links') || "Détails des Liens pour"} {group.product?.nameFr}
                                </h4>
                              </div>
                              <div className="bg-white rounded-xl border border-slate-100/70 overflow-hidden shadow-sm">
                                <table className="w-full text-left">
                                  <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/30">
                                      <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('th_code', 'links')}</th>
                                      <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">{t('th_performance', 'links')}</th>
                                      <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('th_status', 'links')}</th>
                                      <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">{t('th_actions', 'links')}</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {group.links.map((link: any) => {
                                      const ctr = link.clicks > 0 ? ((link.conversions / link.clicks) * 100).toFixed(1) : '0.0';
                                      return (
                                        <tr 
                                          key={link.id}
                                          onClick={() => {
                                            setSelectedLinkIdForChart(link.id);
                                            const chartEl = document.getElementById('performance-chart');
                                            if (chartEl) {
                                              window.scrollTo({ top: chartEl.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
                                            }
                                          }}
                                          className={`hover:bg-slate-50/30 transition-all cursor-pointer ${selectedLinkIdForChart === link.id ? 'bg-influencer-50/20' : ''}`}
                                        >
                                          <td className="px-6 py-4">
                                            <div className="space-y-1">
                                              <span className="px-2.5 py-1 bg-slate-50 text-slate-600 rounded-lg text-xs font-mono font-bold border border-slate-100 inline-block">
                                                {link.code}
                                              </span>
                                              <p className="text-[9px] text-slate-400 font-bold uppercase truncate max-w-[200px]">
                                                URL: {window.location.origin}/r/{link.code}
                                              </p>
                                            </div>
                                          </td>
                                          <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-4">
                                              <div className="text-center">
                                                <p className="text-xs font-black text-slate-900 mb-0.5">{(link.rawClicks || link.clicks).toLocaleString()}</p>
                                                <div className="flex items-center justify-center gap-0.5">
                                                  <Eye size={8} className="text-violet-500" />
                                                  <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">{t('perf_views', 'links')}</span>
                                                </div>
                                              </div>
                                              <div className="text-center">
                                                <p className="text-xs font-black text-slate-900 mb-0.5">{link.clicks.toLocaleString()}</p>
                                                <div className="flex items-center justify-center gap-0.5">
                                                  <MousePointerClick size={8} className="text-blue-500" />
                                                  <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">{t('perf_visitors', 'links')}</span>
                                                </div>
                                              </div>
                                              <div className="text-center">
                                                <p className="text-xs font-black text-slate-900 mb-0.5">{link.conversions.toLocaleString()}</p>
                                                <div className="flex items-center justify-center gap-0.5">
                                                  <Zap size={8} className="text-purple-500" />
                                                  <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">{t('perf_sales', 'links')}</span>
                                                </div>
                                              </div>
                                              <div className="text-center">
                                                <p className="text-xs font-black text-slate-900 mb-0.5">{link.whatsappClicks || 0}</p>
                                                <div className="flex items-center justify-center gap-0.5">
                                                  <MessageCircle size={8} className="text-green-500" />
                                                  <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">{t('perf_whatsapp', 'links')}</span>
                                                </div>
                                              </div>
                                              <div className="text-center">
                                                <p className="text-xs font-black text-indigo-600 mb-0.5">{ctr}%</p>
                                                <div className="flex items-center justify-center gap-0.5">
                                                  <Target size={8} className="text-indigo-500" />
                                                  <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">{t('perf_ctr', 'links')}</span>
                                                </div>
                                              </div>
                                            </div>
                                          </td>
                                          <td className="px-6 py-4">
                                            {link.status === 'SUSPENDED' ? (
                                              <div className="flex items-center gap-1.5 px-2 py-1 bg-rose-50 text-rose-600 rounded-lg w-fit border border-rose-100">
                                                <AlertCircle size={10} className="text-rose-500" />
                                                <span className="text-[9px] font-black uppercase tracking-wider">Bloqué</span>
                                              </div>
                                            ) : link.status === 'BUILDING' ? (
                                              <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 text-amber-600 rounded-lg w-fit">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                <span className="text-[9px] font-black uppercase tracking-wider">{t('status_building', 'links')}</span>
                                              </div>
                                            ) : (
                                              <button
                                                onClick={(e) => { e.stopPropagation(); handleToggleStatus(link); }}
                                                disabled={isToggling === link.id}
                                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all ${
                                                  link.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                                                }`}
                                              >
                                                <Power className={`w-2.5 h-2.5 ${link.isActive ? 'text-emerald-500' : 'text-slate-400'}`} />
                                                <span className="text-[9px] font-black uppercase tracking-wider">{link.isActive ? t('status_active', 'links') : t('status_paused', 'links')}</span>
                                              </button>
                                            )}
                                          </td>
                                          <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                              <button 
                                                onClick={() => copyLink(link.code)} 
                                                disabled={link.status === 'SUSPENDED'}
                                                className="p-2 bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-all" 
                                                title={t('btn_copy', 'links')}
                                              >
                                                <Copy size={12} />
                                              </button>
                                              <button 
                                                onClick={() => { setSelectedLink(link); setShowQrModal(true); }} 
                                                disabled={link.status === 'SUSPENDED'}
                                                className="p-2 bg-slate-50 text-slate-400 hover:text-purple-600 hover:bg-purple-50 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-all" 
                                                title={t('btn_qr', 'links')}
                                              >
                                                <QrCode size={12} />
                                              </button>
                                              <button 
                                                onClick={() => handleRegenerateCode(link)} 
                                                disabled={link.status === 'SUSPENDED'}
                                                className="p-2 bg-red-50/30 text-red-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-all" 
                                                title={t('tooltip_regenerate', 'links')}
                                              >
                                                <RefreshCw size={12} />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-20 text-center bg-slate-50/50">
            <LinkIcon className="w-16 h-16 mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">{t('no_links_found', 'links')}</p>
          </div>
        )}
      </div>

      {/* OTP Verification Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-white/20 animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center bg-slate-50">
                {confirmModal.icon}
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-3">
                {confirmModal.title}
              </h2>
              <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">
                {confirmModal.message}
              </p>

              {confirmModal.step === 'verify' && (
                <div className="animate-in slide-in-from-bottom-2 duration-300">
                  <div className="flex justify-center gap-2 mb-4">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <input
                        key={i}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        className="w-12 h-14 bg-slate-50 border-2 border-slate-200 rounded-xl text-center text-xl font-black text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                        value={confirmInputValue[i] || ''}
                        autoFocus={i === 0}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          if (!val && e.target.value) return;
                          const newValue = confirmInputValue.split('');
                          newValue[i] = val;
                          const joined = newValue.join('').slice(0, 6);
                          setConfirmInputValue(joined);
                          // Auto-focus next input
                          if (val && i < 5) {
                            const next = e.target.parentElement?.children[i + 1] as HTMLInputElement;
                            next?.focus();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Backspace' && !confirmInputValue[i] && i > 0) {
                            const prev = (e.target as HTMLElement).parentElement?.children[i - 1] as HTMLInputElement;
                            prev?.focus();
                          }
                        }}
                        onPaste={(e) => {
                          e.preventDefault();
                          const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                          setConfirmInputValue(pasted);
                          // Focus last filled input
                          const target = (e.target as HTMLElement).parentElement?.children[Math.min(pasted.length, 5)] as HTMLInputElement;
                          target?.focus();
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    {t('otp_expiry_desc', 'links')}
                  </p>
                </div>
              )}
            </div>
            <div className="p-8 bg-slate-50/50 flex gap-4">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                disabled={confirmModal.isLoading}
                className="flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 bg-white border border-slate-100 rounded-2xl transition-all disabled:opacity-50"
              >
                {t('btn_cancel', 'links')}
              </button>
              <button
                onClick={confirmModal.step === 'verify' ? handleVerifyOtp : confirmModal.onConfirm}
                disabled={confirmModal.isLoading || (confirmModal.step === 'verify' && confirmInputValue.length !== 6)}
                className={`flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-white rounded-2xl shadow-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                  confirmModal.variant === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                {confirmModal.isLoading && (
                  <RefreshCw size={14} className="animate-spin" />
                )}
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && selectedLink && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-10 text-center animate-in zoom-in-95 duration-300">
            <h2 className="text-2xl font-black text-slate-900 mb-2">{t('qr_title', 'links')}</h2>
            <p className="text-sm text-slate-400 font-medium mb-8">{t('qr_subtitle', 'links')}</p>
            <div className="bg-white p-6 rounded-2xl border-4 border-dashed border-slate-100 inline-block mb-8">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`${window.location.origin}/r/${selectedLink?.code}`)}`}
                alt="QR Code"
                className="w-48 h-48 mx-auto"
              />
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(`${window.location.origin}/r/${selectedLink?.code}`)}`;
                  link.download = `qr-link-${selectedLink?.code}.png`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  toast.success(t('toast_qr_ready', 'links'));
                }}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl"
              >
                {t('btn_download_hd', 'links')}
              </button>
              <button onClick={() => setShowQrModal(false)} className="w-full py-4 bg-slate-50 text-slate-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all">{t('btn_close', 'links')}</button>
            </div>
          </div>
        </div>
      )}
      {/* Create Link Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t('create_modal_title', 'links')}</h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{t('create_modal_subtitle', 'links')}</p>
                </div>
                <button 
                  onClick={() => {
                    setShowCreateModal(false);
                    setCustomName('');
                    setCustomNameError('');
                    setSelectedProductId(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors text-sm font-black p-2 hover:bg-slate-50 rounded-xl"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateLink} className="space-y-6">
                {/* Product Dropdown */}
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{t('label_select_product', 'links')}</label>
                  {claimsLoading ? (
                    <div className="h-12 bg-slate-50 rounded-2xl animate-pulse flex items-center px-4 text-xs font-bold text-slate-400">
                      {t('claims_loading', 'links')}
                    </div>
                  ) : claims.length === 0 ? (
                    <div className="p-4 bg-amber-50 border border-amber-100 text-amber-600 rounded-2xl text-xs font-bold text-center">
                      {t('claims_empty_warning', 'links')}
                    </div>
                  ) : (
                    <select
                      value={selectedProductId || ''}
                      onChange={(e) => setSelectedProductId(Number(e.target.value) || null)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:border-slate-900 transition-all"
                      required
                    >
                      <option value="">{t('option_choose_product', 'links')}</option>
                      {claims.map((claim) => {
                        const productLinksCount = links.filter((l) => l.productId === claim.productId).length;
                        const isLimitReached = productLinksCount >= 5;
                        return (
                          <option 
                            key={claim.productId} 
                            value={claim.productId}
                            disabled={isLimitReached}
                          >
                            {claim.product?.nameFr} {isLimitReached ? t('limit_reached_label', 'links') : `(${productLinksCount}/5 ${t('links_label', 'links')})`}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>

                {/* Custom Name input */}
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{t('label_custom_name', 'links')}</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={t('custom_name_placeholder', 'links')}
                      value={customName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className={`w-full px-4 py-3 bg-slate-50 border rounded-2xl text-sm font-mono font-bold text-slate-700 focus:outline-none transition-all ${
                        customNameError 
                          ? 'border-red-300 focus:border-red-500' 
                          : customName && !isCheckingName 
                            ? 'border-emerald-300 focus:border-emerald-500' 
                            : 'border-slate-100 focus:border-slate-900'
                      }`}
                      required
                      minLength={3}
                      maxLength={20}
                    />
                    {isCheckingName && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <RefreshCw size={14} className="animate-spin text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">
                      {t('final_url_prefix', 'links')}: {window.location.origin}/r/{customName || t('name_placeholder', 'links')}
                    </span>
                    <span className={`text-[10px] font-black uppercase ${customName.length >= 3 && customName.length <= 20 ? 'text-slate-400' : 'text-amber-500'}`}>
                      {customName.length}/20 chars
                    </span>
                  </div>
                  {customNameError && (
                    <p className="text-xs font-bold text-red-500 flex items-center gap-1.5 mt-1">
                      <AlertCircle size={12} /> {customNameError}
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setCustomName('');
                      setCustomNameError('');
                      setSelectedProductId(null);
                    }}
                    className="flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all"
                  >
                    {t('btn_cancel', 'links')}
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingLink || claimsLoading || !selectedProductId || !customName || !!customNameError || isCheckingName}
                    className="flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-white bg-slate-900 hover:bg-slate-800 rounded-2xl shadow-lg shadow-slate-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isCreatingLink && (
                      <RefreshCw size={14} className="animate-spin" />
                    )}
                    {t('btn_generate', 'links', 'GÉNÉRER')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

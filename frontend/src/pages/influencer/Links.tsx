import { useState, useEffect } from 'react';
import { influencerApi } from '../../lib/api';
import { ReferralLink } from '../../types';
import { Search, Plus, MousePointerClick, Zap, Target, DollarSign, Copy, QrCode, RefreshCw, AlertCircle, Link as LinkIcon, Power, Eye, TrendingUp, Activity, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  ResponsiveContainer, ComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, Legend 
} from 'recharts';

export default function InfluencerLinks() {
  const [links, setLinks] = useState<ReferralLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'earnings' | 'clicks' | 'conversions' | 'date'>('date');
  const [dailyStats, setDailyStats] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<number | 'custom'>(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLinkIdForChart, setSelectedLinkIdForChart] = useState<number | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  
  // Modal states
  const [selectedLink, setSelectedLink] = useState<ReferralLink | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    icon: React.ReactNode;
    confirmText: string;
    variant: 'primary' | 'danger';
    isLoading?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    icon: <RefreshCw size={24} />,
    confirmText: 'Régénérer',
    variant: 'primary'
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
    toast.success('Lien copié!');
  };

  const handleToggleStatus = async (link: ReferralLink) => {
    setIsToggling(link.id);
    try {
      const res = await influencerApi.updateLinkStatus(link.id, !link.isActive);
      setLinks(prev => prev.map(l => l.id === link.id ? { ...l, isActive: res.data.isActive } : l));
      toast.success(link.isActive ? 'Lien désactivé' : 'Lien activé');
    } catch (err: any) {
      toast.error('Erreur lors du changement de statut');
    } finally {
      setIsToggling(null);
    }
  };

  const handleRegenerateCode = (link: ReferralLink) => {
    setConfirmModal({
      isOpen: true,
      title: '⚠️ Attention : Risque de perte de leads',
      message: `Si vous régénérez ce code, les anciens partages deviendront obsolètes.`,
      icon: <AlertCircle size={32} className="text-red-500 animate-pulse" />,
      confirmText: 'Régénérer',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await influencerApi.regenerateLink(link.id);
          setLinks(prev => prev.map(l => l.id === link.id ? { ...l, code: res.data.code } : l));
          toast.success('Code régénéré !');
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          toast.error('Erreur lors de la régénération');
        }
      }
    });
  };

  const totalClicks = links.reduce((sum, l) => sum + l.clicks, 0);
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


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-influencer-200 border-t-influencer-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Performance des Liens</h1>
          <p className="text-slate-500 font-medium mt-1">Analysez la rentabilité de vos parrainages en temps réel.</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/influencer/marketplace"
            className="flex items-center gap-2 px-8 py-3.5 bg-slate-900 text-white rounded-2xl text-sm font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
          >
            <Plus className="w-4 h-4" /> Créer un Lien
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Visiteurs Uniques Totaux</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-slate-900">{totalClicks.toLocaleString()}</h3>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><MousePointerClick className="w-4 h-4" /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ventes Totales</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-slate-900">{totalConversions.toLocaleString()}</h3>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl"><Zap className="w-4 h-4" /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Taux de Conv.</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-indigo-600">{globalCTR.toFixed(1)}%</h3>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Target className="w-4 h-4" /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Liens Actifs</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-emerald-600">{activeLinksCount}</h3>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><Power className="w-4 h-4" /></div>
          </div>
        </div>
        <div className="bg-slate-900 p-6 rounded-3xl shadow-xl">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Liens</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-white">{totalLinksCount}</h3>
            <div className="p-2 bg-white/10 text-white rounded-xl"><LinkIcon className="w-4 h-4" /></div>
          </div>
        </div>
      </div>

      {/* Performance Chart Section */}
      <div id="performance-chart" className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-5 h-5 text-influencer-500" /> Performance Temporelle ({dateRange === 'custom' ? 'Custom' : `${dateRange}j`})
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                {selectedLinkIdForChart 
                  ? `Analyse du produit: ${links.find(l => l.id === selectedLinkIdForChart)?.product?.nameFr}` 
                  : 'Évolution globale des parrainages'}
              </p>
            </div>
            {selectedLinkIdForChart && (
              <button 
                onClick={() => setSelectedLinkIdForChart(null)}
                className="px-3 py-1 bg-red-50 text-red-500 text-[10px] font-black rounded-lg border border-red-100 hover:bg-red-100 transition-all flex items-center gap-2"
              >
                <AlertCircle size={12} /> EFFACER FILTRE
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
                <option value="">Tous les liens</option>
                {links.map(l => (
                  <option key={l.id} value={l.id}>{l.product?.nameFr || l.code}</option>
                ))}
              </select>

              <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
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
                    {days === 1 ? 'Aujourd\'hui' : `${days}j`}
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
                  Custom
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
                  <span className="text-[10px] font-black text-slate-300">AU</span>
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
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-blue-500 rounded-full" /> Visiteurs Uniques</div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-purple-500 rounded-full" /> Ventes</div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-indigo-500 rounded-full" /> Taux Conv.</div>
            </div>
          </div>
        </div>
        
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dailyStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
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
              <YAxis 
                yAxisId="right"
                orientation="right"
                axisLine={false} 
                tickLine={false} 
                tick={{fontSize: 10, fontWeight: 700, fill: '#6366f1'}}
                tickFormatter={(val) => `${val}%`}
              />
              <RechartsTooltip 
                contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '15px' }}
                itemStyle={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}
                labelStyle={{ marginBottom: '10px', fontSize: '12px', fontWeight: 900, color: '#1e293b' }}
              />
              <Area 
                yAxisId="left"
                type="monotone" 
                dataKey="views" 
                stroke="#3b82f6" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorViews)" 
                name="Visiteurs Uniques"
              />
              <Bar 
                yAxisId="left"
                dataKey="sales" 
                fill="#8b5cf6" 
                radius={[4, 4, 0, 0]} 
                barSize={20} 
                name="Ventes" 
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="convRate" 
                stroke="#6366f1" 
                strokeWidth={3}
                dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                name="Taux Conv."
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
            placeholder="Rechercher un produit ou un code..."
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
              {s === 'date' ? 'Date' : s === 'earnings' ? 'Revenus' : s === 'clicks' ? 'Visiteurs' : 'Ventes'}
            </button>
          ))}
        </div>
      </div>

      {/* Links Pro Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        {filteredLinks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Produit</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Code</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Performance</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredLinks.map((link) => {
                  const ctr = link.clicks > 0 ? ((link.conversions / link.clicks) * 100).toFixed(1) : '0.0';
                  const epc = link.clicks > 0 ? (link.earnings / link.clicks).toFixed(2) : '0.00';
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
                      className={`hover:bg-slate-50/50 transition-all group cursor-pointer ${selectedLinkIdForChart === link.id ? 'bg-influencer-50/30' : ''}`}
                    >
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="relative w-12 h-12 rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
                            {link.product?.images?.[0]?.imageUrl ? (
                              <img src={link.product.images[0].imageUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400"><Eye size={16} /></div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 truncate max-w-[200px]">{link.product?.nameFr || 'Produit'}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Généré le {new Date(link.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-xl text-xs font-mono font-bold border border-slate-100">
                          {link.code}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-6">
                            <div className="text-center">
                              <p className="text-xs font-black text-slate-900">{link.clicks.toLocaleString()}</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase">Visiteurs</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs font-black text-slate-900">{link.conversions.toLocaleString()}</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase">Ventes</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs font-black text-indigo-600">{link.clicks > 0 ? ((link.conversions / link.clicks) * 100).toFixed(1) : '0.0'}%</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase">Taux Conv.</p>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleStatus(link); }}
                          disabled={isToggling === link.id}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all ${
                            link.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          <Power className={`w-3 h-3 ${link.isActive ? 'text-emerald-500' : 'text-slate-400'}`} />
                          <span className="text-[10px] font-black uppercase tracking-wider">{link.isActive ? 'Actif' : 'Pause'}</span>
                        </button>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {/* Safe Actions */}
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={(e) => { e.stopPropagation(); copyLink(link.code); }} className="p-2.5 bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all" title="Copier"><Copy size={16} /></button>
                            <button onClick={(e) => { e.stopPropagation(); setSelectedLink(link); setShowQrModal(true); }} className="p-2.5 bg-slate-50 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all" title="QR Code"><QrCode size={16} /></button>
                          </div>
                          
                          {/* Danger Zone Separator */}
                          <div className="w-[1px] h-6 bg-slate-100 opacity-0 group-hover:opacity-100 transition-all" />
                          
                          {/* Dangerous Actions */}
                          <div className="opacity-0 group-hover:opacity-100 transition-all">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleRegenerateCode(link); }} 
                              className="p-2.5 bg-red-50/30 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" 
                              title="Régénérer le code (Attention: rend l'ancien lien obsolète)"
                            >
                              <RefreshCw size={16} />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-20 text-center bg-slate-50/50">
            <LinkIcon className="w-16 h-16 mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Aucun lien trouvé</p>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl border border-white/20 animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center bg-slate-50">
                {confirmModal.icon}
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-3">
                {confirmModal.title}
              </h2>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">
                {confirmModal.message}
              </p>
            </div>
            <div className="p-8 bg-slate-50/50 flex gap-4">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 bg-white border border-slate-100 rounded-2xl transition-all"
              >
                Annuler
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className={`flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-white rounded-2xl shadow-lg transition-all ${
                  confirmModal.variant === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && selectedLink && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl max-w-sm w-full p-10 text-center animate-in zoom-in-95 duration-300">
            <h2 className="text-2xl font-black text-slate-900 mb-2">QR Code Pro</h2>
            <p className="text-sm text-slate-400 font-medium mb-8">Partagez visuellement votre lien.</p>
            <div className="bg-white p-6 rounded-[2rem] border-4 border-dashed border-slate-100 inline-block mb-8">
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
                  toast.success('QR Code prêt!');
                }}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl"
              >
                Télécharger HD
              </button>
              <button onClick={() => setShowQrModal(false)} className="w-full py-4 bg-slate-50 text-slate-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

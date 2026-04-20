import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardApi, influencerApi } from '../../lib/api';
import { ReferralLink, InfluencerCommission } from '../../types';
import {
  Copy, Link as LinkIcon, DollarSign, TrendingUp, Star, Zap,
  BarChart3, Users, MousePointerClick, ArrowUpRight, Crown,
  Sparkles, Eye, Plus, ShoppingBag, Wallet, Activity
} from 'lucide-react';
import { ProCard } from '../../components/common/ProCard';

export default function InfluencerDashboard() {
  const { user } = useAuth();
  const [referralLinks, setReferralLinks] = useState<ReferralLink[]>([]);
  const [commissions, setCommissions] = useState<InfluencerCommission[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [dashboardRes, linksRes, commissionsRes] = await Promise.all([
        dashboardApi.influencer(),
        influencerApi.getLinks(),
        influencerApi.getCommissions()
      ]);
      setReferralLinks(linksRes.data);
      setCommissions(commissionsRes.data.commissions);
      setTotalEarnings(dashboardRes.data.totalEarnings || 0);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const todayClicks = referralLinks.reduce((sum, l) => sum + l.clicks, 0);
  const todayConversions = referralLinks.reduce((sum, l) => sum + l.conversions, 0);

  const totalFollowers = user?.instagramFollowers || 0;

  const getTier = () => {
    if (totalEarnings >= 50000) return { name: 'Diamond', color: 'text-cyan-400', bg: 'bg-cyan-50', border: 'border-cyan-200', icon: '💎', rate: '18%' };
    if (totalEarnings >= 10000) return { name: 'Gold', color: 'text-yellow-500', bg: 'bg-yellow-50', border: 'border-yellow-200', icon: '🥇', rate: '15%' };
    return { name: 'Silver', color: 'text-gray-400', bg: 'bg-gray-50', border: 'border-gray-200', icon: '🥈', rate: '12%' };
  };

  const tier = getTier();

  const topLinks = [...referralLinks]
    .sort((a, b) => b.earnings - a.earnings)
    .slice(0, 3);

  const recentCommissions = [...commissions]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-influencer-200 border-t-influencer-500"></div>
          <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-influencer-500" />
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {/* Pro Max Header: Mesh Gradient & Design Intelligence */}
      <div className="relative overflow-hidden bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-slate-200">
        {/* Animated Mesh Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-50">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-influencer-600 rounded-full blur-[120px] animate-mesh-light" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600 rounded-full blur-[120px] animate-mesh-light stagger-2" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
              <Crown className="w-4 h-4 text-yellow-400" />
              <span className="text-[10px] font-black uppercase tracking-widest">
                Tier {tier.name} • {tier.rate} Commission
              </span>
            </div>
            <h1 className="text-4xl font-black tracking-tight leading-tight">
              Bienvenue, <span className="text-transparent bg-clip-text bg-gradient-to-r from-influencer-300 to-white">{user?.fullName?.split(' ')[0] || 'Influenceur'}</span>! 👋
            </h1>
            <p className="text-white/60 text-sm max-w-md font-medium">
              Votre performance est à son apogée. Continuez à générer des liens et maximisez vos gains.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Link
              to="/influencer/links"
              className="group flex items-center gap-2 px-6 py-3.5 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-2xl text-sm font-black transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
              Nouveau Lien
            </Link>
            <Link
              to="/influencer/marketplace"
              className="flex items-center gap-2 px-6 py-3.5 bg-white text-slate-900 hover:shadow-xl hover:shadow-white/10 rounded-2xl text-sm font-black transition-all active:scale-95"
            >
              <ShoppingBag className="w-4 h-4" />
              Marché
            </Link>
          </div>
        </div>
        
        {/* Grain Overlay */}
        <div className="bg-noise absolute inset-0 mix-blend-overlay opacity-20 pointer-events-none" />
      </div>

      {/* Stats Grid: Bento Pro Card Style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <ProCard variant="glass" className="border-l-4 border-l-influencer-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Solde Actuel</p>
              <div className="flex items-baseline gap-1 mt-2">
                <h3 className="text-3xl font-black text-slate-900 leading-none">{totalEarnings.toFixed(2)}</h3>
                <span className="text-xs font-bold text-slate-400 uppercase">MAD</span>
              </div>
              <div className="mt-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-50 text-green-600 text-[10px] font-black">
                <ArrowUpRight className="w-2.5 h-2.5" /> +12%
              </div>
            </div>
            <div className="p-3 bg-influencer-50 text-influencer-600 rounded-2xl shadow-sm shadow-influencer-100/50">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
        </ProCard>

        <ProCard variant="glass" className="border-l-4 border-l-blue-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clicks Actifs</p>
              <h3 className="text-3xl font-black text-slate-900 mt-2 leading-none">{todayClicks}</h3>
              <div className="mt-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[10px] font-black">
                <Activity className="w-2.5 h-2.5" /> Live
              </div>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-sm shadow-blue-100/50">
              <MousePointerClick className="w-5 h-5" />
            </div>
          </div>
        </ProCard>

        <ProCard variant="glass" className="border-l-4 border-l-green-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Conversions</p>
              <h3 className="text-3xl font-black text-slate-900 mt-2 leading-none">{todayConversions}</h3>
              <div className="mt-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-50 text-green-600 text-[10px] font-black">
                <Zap className="w-2.5 h-2.5" /> High
              </div>
            </div>
            <div className="p-3 bg-green-50 text-green-600 rounded-2xl shadow-sm shadow-green-100/50">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </ProCard>

        <ProCard variant="glass" className="border-l-4 border-l-purple-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Commission Estimée</p>
              <div className="flex items-baseline gap-1 mt-2">
                <h3 className="text-3xl font-black text-slate-900 leading-none">{(totalEarnings * 0.15).toFixed(2)}</h3>
                <span className="text-xs font-bold text-slate-400 uppercase">MAD</span>
              </div>
              <div className="mt-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-600 text-[10px] font-black">
                <Sparkles className="w-2.5 h-2.5" /> VIP
              </div>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl shadow-sm shadow-purple-100/50">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </ProCard>
      </div>

      {/* Ma      {/* Main Content Grid: Advanced Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top Performing Links: Bento Double Span */}
        <ProCard variant="glass" className="lg:col-span-8 overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-influencer-500" />
                Performance des Liens
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Top performers sur les 30 derniers jours</p>
            </div>
            <Link to="/influencer/links" className="group flex items-center gap-1.5 px-4 py-2 bg-slate-50 border border-slate-100/50 rounded-xl text-xs font-black text-slate-600 hover:bg-white hover:shadow-xl hover:shadow-slate-100 transition-all">
              Gérer les liens <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>

          {topLinks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {topLinks.map((link, idx) => (
                <div key={link.id} className={`group relative p-6 rounded-3xl border border-slate-100 hover:border-influencer-200 hover:bg-influencer-50/20 transition-all duration-500 ${idx === 0 ? 'md:col-span-2' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg ${
                        idx === 0 ? 'bg-gradient-to-tr from-yellow-400 to-orange-500 shadow-orange-200' :
                        idx === 1 ? 'bg-gradient-to-tr from-slate-300 to-slate-500 shadow-slate-200' :
                        'bg-gradient-to-tr from-amber-600 to-amber-800 shadow-amber-200'
                      }`}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">{link.product?.nameFr || `Produit #${link.productId}`}</p>
                        <code className="text-[10px] font-black tracking-widest text-slate-400 uppercase">{link.code}</code>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-green-600 leading-none">{link.earnings.toFixed(2)}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">MAD GAGNÉS</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 mt-6">
                    <div className="p-3 bg-white/50 backdrop-blur-sm rounded-2xl border border-white/50">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Clicks</p>
                      <p className="text-sm font-black text-slate-900 mt-1">{link.clicks}</p>
                    </div>
                    <div className="p-3 bg-white/50 backdrop-blur-sm rounded-2xl border border-white/50">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Conversions</p>
                      <p className="text-sm font-black text-slate-900 mt-1">{link.conversions}</p>
                    </div>
                    <div className="p-3 bg-white/50 backdrop-blur-sm rounded-2xl border border-white/50">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Taux</p>
                      <p className="text-sm font-black text-slate-900 mt-1">
                        {link.clicks > 0 ? ((link.conversions / link.clicks) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-100">
              <LinkIcon className="w-12 h-12 mx-auto text-slate-200 mb-4" />
              <p className="text-slate-500 font-black text-sm uppercase tracking-widest">Initialisez votre premier lien</p>
              <p className="text-slate-400 text-xs mt-2 max-w-xs mx-auto">Propulsez vos revenus en sélectionnant des produits à fort potentiel hautement rémunérateurs.</p>
              <Link to="/influencer/marketplace" className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-influencer-500 text-white rounded-2xl text-xs font-black hover:shadow-xl hover:shadow-influencer-200 active:scale-95 transition-all">
                Démarrer la prospection 🚀
              </Link>
            </div>
          )}
        </ProCard>

        {/* Info Bento: Tier & Actions */}
        <div className="lg:col-span-4 space-y-6">
          <ProCard variant="glass" className={`${tier.border} border-2 relative overflow-hidden group`}>
             {/* Dynamic Progress indicator */}
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Crown className="w-24 h-24" />
            </div>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-white shadow-xl shadow-slate-200 rounded-3xl flex items-center justify-center text-2xl border border-slate-100">
                {tier.icon}
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 leading-tight">Statut {tier.name}</h3>
                <p className="text-[10px] font-black text-influencer-600 uppercase tracking-[0.2em] mt-1">Ambassadeur Certifié</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-tight">
                <span>Progression de Gains</span>
                <span className="text-slate-900">{totalEarnings.toFixed(0)} / {totalEarnings >= 50000 ? 'MAX' : totalEarnings >= 10000 ? '50,000' : '10,000'} MAD</span>
              </div>
              <div className="h-4 bg-slate-100 rounded-full overflow-hidden p-1 border border-slate-200/50 shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-influencer-400 to-influencer-600 shadow-[0_0_12px_rgba(217,70,239,0.3)] transition-all duration-1000 ease-out"
                  style={{
                    width: `${Math.min(100, totalEarnings >= 50000 ? 100 : totalEarnings >= 10000
                      ? ((totalEarnings - 10000) / 40000) * 100
                      : (totalEarnings / 10000) * 100
                    )}%`
                  }}
                />
              </div>
              <p className="text-[10px] text-slate-400 font-medium text-center italic">Atteignez le prochain Tier pour débloquer {totalEarnings >= 50000 ? 'des bonus exclusifs' : '18% de commission'}!</p>
            </div>
          </ProCard>

          <ProCard variant="glass">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-influencer-500" />
              Intelligence Opérationnelle
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Générer Lien', icon: Plus, to: '/influencer/links', bg: 'bg-influencer-50 text-influencer-700' },
                { label: 'Mes Leads', icon: Users, to: '/influencer/leads', bg: 'bg-slate-50 text-slate-700' },
                { label: 'Marketplace', icon: ShoppingBag, to: '/influencer/marketplace', bg: 'bg-slate-50 text-slate-700' },
                { label: 'Analytique', icon: BarChart3, to: '/influencer/analytics', bg: 'bg-slate-50 text-slate-700' }
              ].map((action) => (
                <Link 
                  key={action.label}
                  to={action.to} 
                  className={`flex flex-col items-center gap-2 p-4 rounded-3xl transition-all hover:scale-[1.03] active:scale-95 border border-slate-100 group ${action.bg}`}
                >
                  <action.icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-tighter text-center">{action.label}</span>
                </Link>
              ))}
            </div>
          </ProCard>
        </div>
      </div>

      {/* Statistics & Activity Bento Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Commissions: Bento Style */}
        <ProCard variant="glass" className="lg:col-span-2">
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-500" />
                Dernières Commissions
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Historique des 30 derniers jours</p>
            </div>
            <Link to="/influencer/wallet" className="group flex items-center gap-1.5 px-4 py-2 bg-slate-50 border border-slate-100/50 rounded-xl text-xs font-black text-slate-600 hover:bg-white hover:shadow-xl hover:shadow-slate-100 transition-all">
              Bilan complet <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>

          {recentCommissions.length > 0 ? (
            <div className="space-y-3">
              {recentCommissions.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 border border-slate-100/50 hover:bg-white hover:shadow-md transition-all group">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-xl ${
                      c.status === 'PAID' ? 'bg-green-100 text-green-600' :
                      c.status === 'APPROVED' ? 'bg-blue-100 text-blue-600' :
                      'bg-amber-100 text-amber-600'
                    }`}>
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800">{c.referralLink?.product?.nameFr || 'Commission Directe'}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{new Date(c.createdAt).toLocaleDateString()} • {c.status === 'PAID' ? '🔒 Archivé' : '⌛ Actif'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-green-600">+{c.amount.toFixed(2)} MAD</p>
                    <div className={`text-[9px] font-black uppercase mt-1 px-2 py-0.5 rounded-full inline-block ${
                      c.status === 'PAID' ? 'bg-green-50 text-green-700' :
                      c.status === 'APPROVED' ? 'bg-blue-50 text-blue-700' :
                      'bg-amber-50 text-amber-700'
                    }`}>
                      {c.status === 'PAID' ? 'Payé' : c.status === 'APPROVED' ? 'Approuvé' : 'En attente'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-100">
              <DollarSign className="w-12 h-12 mx-auto text-slate-200 mb-2" />
              <p className="text-slate-500 font-black text-sm uppercase tracking-widest">Activité Néante</p>
              <p className="text-slate-400 text-xs mt-2">Activez vos sources de trafic pour générer des leads.</p>
            </div>
          )}
        </ProCard>

        {/* Dynamic Referral Code: Pro Design */}
        <ProCard variant="glass" className="relative group overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-influencer-500/5 to-purple-500/5 pointer-events-none" />
          
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="w-20 h-20 bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-100 flex items-center justify-center translate-y-[-10px] group-hover:scale-110 transition-transform duration-700">
              <Star className="w-8 h-8 text-influencer-500" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900 leading-tight">Votre Hub de Parrainage</h3>
              <p className="text-xs text-slate-400 font-medium px-4">Utilisez ce code pour onboarder de nouveaux affiliés sous votre commandement.</p>
            </div>
            
            <div className="w-full space-y-3">
              <div className="relative group/code">
                <div className="absolute inset-0 bg-influencer-500/10 blur-xl opacity-0 group-hover/code:opacity-100 transition-opacity" />
                <code className="relative w-full block bg-white px-6 py-4 rounded-[1.5rem] text-2xl font-black text-influencer-700 border-2 border-slate-100 transition-all group-hover/code:border-influencer-400 tracking-[0.2em] shadow-sm">
                  {user?.referralCode || 'NOT_FOUND'}
                </code>
              </div>
              
              <button
                onClick={() => {
                  navigator.clipboard.writeText(user?.referralCode || '');
                  // toast.success('Code copié !');
                }}
                className="w-full flex items-center justify-center gap-2 py-4 bg-slate-900 text-white rounded-[1.5rem] text-sm font-black hover:bg-slate-800 shadow-xl shadow-slate-900/10 active:scale-95 transition-all"
              >
                <Copy className="w-4 h-4" />
                COPIER LE CODE
              </button>
            </div>

            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Digital Ambassador System v3.1</p>
          </div>
        </ProCard>
      </div>
    </div>
  );
}

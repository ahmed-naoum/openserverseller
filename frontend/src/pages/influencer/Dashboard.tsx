import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardApi, influencerApi } from '../../lib/api';
import { ReferralLink, InfluencerCommission } from '../../types';
import {
  Copy, Link as LinkIcon, DollarSign, TrendingUp, Star, Zap,
  BarChart3, Users, MousePointerClick, ArrowUpRight, Crown,
  Sparkles, Eye, Plus, ShoppingBag
} from 'lucide-react';

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
      {/* Welcome Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-influencer-600 via-influencer-500 to-purple-600 rounded-2xl p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-5 h-5 text-yellow-300" />
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm`}>
                {tier.icon} {tier.name} • {tier.rate} Commission
              </span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Bienvenue, {user?.fullName || 'Influenceur'}! 👋
            </h1>
            <p className="text-white/70 mt-1 text-sm">Voici votre résumé de performance du jour.</p>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Link
              to="/influencer/links"
              className="flex items-center gap-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-xl text-sm font-bold transition-all"
            >
              <Plus className="w-4 h-4" />
              Nouveau Lien
            </Link>
            <Link
              to="/influencer/marketplace"
              className="flex items-center gap-1.5 px-4 py-2 bg-white text-influencer-700 hover:bg-white/90 rounded-xl text-sm font-bold transition-all"
            >
              <ShoppingBag className="w-4 h-4" />
              Marché
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card p-4 border-l-4 border-l-influencer-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Solde Actuel</p>
              <h3 className="text-xl font-black text-gray-900 mt-1">{totalEarnings.toFixed(2)} <span className="text-sm font-medium text-gray-400">MAD</span></h3>
            </div>
            <div className="p-2 bg-influencer-50 text-influencer-600 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="card p-4 border-l-4 border-l-blue-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Clics Aujourd'hui</p>
              <h3 className="text-xl font-black text-gray-900 mt-1">{todayClicks}</h3>
            </div>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <MousePointerClick className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="card p-4 border-l-4 border-l-green-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Conversions</p>
              <h3 className="text-xl font-black text-gray-900 mt-1">{todayConversions}</h3>
            </div>
            <div className="p-2 bg-green-50 text-green-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="card p-4 border-l-4 border-l-purple-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mes Leads</p>
              <h3 className="text-xl font-black text-gray-900 mt-1">{commissions.length}</h3>
            </div>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="card p-4 border-l-4 border-l-pink-500 col-span-2 lg:col-span-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Liens Actifs</p>
              <h3 className="text-xl font-black text-gray-900 mt-1">{referralLinks.filter(l => l.isActive).length}</h3>
            </div>
            <div className="p-2 bg-pink-50 text-pink-600 rounded-lg">
              <LinkIcon className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Performing Links */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-influencer-500" />
              Top Liens Performants
            </h2>
            <Link to="/influencer/links" className="text-sm font-bold text-influencer-600 hover:text-influencer-700 flex items-center gap-1">
              Voir tout <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {topLinks.length > 0 ? (
            <div className="space-y-3">
              {topLinks.map((link, idx) => (
                <div key={link.id} className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100 hover:border-influencer-200 transition-all group">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm ${
                    idx === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
                    idx === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400' :
                    'bg-gradient-to-br from-amber-600 to-amber-700'
                  }`}>
                    #{idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{link.product?.nameFr || `Produit #${link.productId}`}</p>
                    <p className="text-xs text-gray-500 font-mono">{link.code}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-green-600">{link.earnings.toFixed(2)} MAD</p>
                    <p className="text-xs text-gray-500">{link.clicks} clics • {link.conversions} conv.</p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/ref/${link.code}`);
                    }}
                    className="p-2 rounded-lg text-gray-400 hover:text-influencer-600 hover:bg-influencer-50 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <LinkIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">Pas encore de liens</p>
              <p className="text-gray-400 text-sm mt-1">Explorez le marché pour créer vos premiers liens de parrainage!</p>
              <Link to="/influencer/marketplace" className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-influencer-500 text-white rounded-xl text-sm font-bold hover:bg-influencer-600 transition-all">
                <ShoppingBag className="w-4 h-4" />
                Explorer le Marché
              </Link>
            </div>
          )}
        </div>

        {/* Quick Actions + Tier */}
        <div className="space-y-6">
          {/* Performance Tier */}
          <div className={`card p-5 ${tier.border} border-2`}>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{tier.icon}</span>
              <div>
                <h3 className="font-bold text-gray-900">Tier {tier.name}</h3>
                <p className="text-xs text-gray-500">Commission actuelle: {tier.rate}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium text-gray-500">
                <span>Progression</span>
                <span>{totalEarnings.toFixed(0)} / {totalEarnings >= 50000 ? '∞' : totalEarnings >= 10000 ? '50,000' : '10,000'} MAD</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-influencer-400 to-influencer-600 transition-all duration-500"
                  style={{
                    width: `${Math.min(100, totalEarnings >= 50000 ? 100 : totalEarnings >= 10000
                      ? ((totalEarnings - 10000) / 40000) * 100
                      : (totalEarnings / 10000) * 100
                    )}%`
                  }}
                />
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-influencer-500" />
              Actions Rapides
            </h3>
            <div className="space-y-2">
              <Link to="/influencer/links" className="flex items-center gap-3 p-3 rounded-xl bg-influencer-50 text-influencer-700 hover:bg-influencer-100 transition-all border border-influencer-100">
                <Plus className="w-4 h-4" />
                <span className="text-sm font-bold">Générer un Lien</span>
              </Link>
              <Link to="/influencer/leads" className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-all text-gray-700">
                <Users className="w-4 h-4" />
                <span className="text-sm font-bold">Voir mes Leads</span>
              </Link>
              <Link to="/influencer/marketplace" className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-all text-gray-700">
                <ShoppingBag className="w-4 h-4" />
                <span className="text-sm font-bold">Explorer les Produits</span>
              </Link>
              <Link to="/influencer/analytics" className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-all text-gray-700">
                <BarChart3 className="w-4 h-4" />
                <span className="text-sm font-bold">Voir les Analytics</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Commissions */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-500" />
            Commissions Récentes
          </h2>
          <Link to="/influencer/wallet" className="text-sm font-bold text-influencer-600 hover:text-influencer-700 flex items-center gap-1">
            Voir tout <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentCommissions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Produit</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentCommissions.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.referralLink?.product?.nameFr || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm font-black text-green-600">{c.amount.toFixed(2)} MAD</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                        c.status === 'PAID' ? 'bg-green-100 text-green-700' :
                        c.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {c.status === 'PAID' ? 'Payé' : c.status === 'APPROVED' ? 'Approuvé' : 'En attente'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <DollarSign className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500 font-medium">Aucune commission pour le moment</p>
            <p className="text-gray-400 text-sm">Partagez vos liens pour commencer à gagner!</p>
          </div>
        )}
      </div>

      {/* Referral Code Section */}
      <div className="card p-6 bg-gradient-to-r from-influencer-50 to-purple-50 border-influencer-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Star className="w-5 h-5 text-influencer-500" />
              Votre Code de Parrainage
            </h3>
            <p className="text-sm text-gray-500 mt-1">Partagez ce code pour inviter d'autres utilisateurs!</p>
          </div>
          <div className="flex items-center gap-2">
            <code className="bg-white px-5 py-2.5 rounded-xl text-lg font-mono font-bold text-influencer-700 border border-influencer-200 shadow-sm">
              {user?.referralCode || 'N/A'}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(user?.referralCode || '')}
              className="p-2.5 bg-influencer-500 text-white rounded-xl hover:bg-influencer-600 transition-all"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

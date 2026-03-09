import { useState, useEffect } from 'react';
import { influencerApi } from '../../lib/api';
import { ReferralLink } from '../../types';
import {
  BarChart3, TrendingUp, MousePointerClick, DollarSign,
  Download, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

export default function InfluencerAnalytics() {
  const [links, setLinks] = useState<ReferralLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7' | '30' | '90'>('30');

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const res = await influencerApi.getLinks();
      setLinks(res.data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalClicks = links.reduce((sum, l) => sum + l.clicks, 0);
  const totalConversions = links.reduce((sum, l) => sum + l.conversions, 0);
  const totalRevenue = links.reduce((sum, l) => sum + l.earnings, 0);
  const avgCTR = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : '0.0';

  const topProducts = [...links]
    .sort((a, b) => b.earnings - a.earnings)
    .slice(0, 5);

  const topByClicks = [...links]
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-influencer-200 border-t-influencer-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Analytics & Rapports</h1>
          <p className="text-sm text-gray-500 mt-1">Analysez votre performance et suivez vos KPIs.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden">
            {(['7', '30', '90'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-2 text-xs font-bold transition-all ${
                  period === p
                    ? 'bg-influencer-50 text-influencer-700'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {p}j
              </button>
            ))}
          </div>
          <button className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all">
            <Download className="w-3.5 h-3.5" />
            Exporter
          </button>
        </div>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <MousePointerClick className="w-5 h-5" />
            </div>
            <span className="flex items-center gap-0.5 text-xs font-bold text-green-600">
              <ArrowUpRight className="w-3 h-3" />
              +12%
            </span>
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Clics</p>
          <h3 className="text-2xl font-black text-gray-900 mt-1">{totalClicks.toLocaleString()}</h3>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-green-50 text-green-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="flex items-center gap-0.5 text-xs font-bold text-green-600">
              <ArrowUpRight className="w-3 h-3" />
              +8%
            </span>
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Conversions</p>
          <h3 className="text-2xl font-black text-gray-900 mt-1">{totalConversions.toLocaleString()}</h3>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="flex items-center gap-0.5 text-xs font-bold text-green-600">
              <ArrowUpRight className="w-3 h-3" />
              +15%
            </span>
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Revenus</p>
          <h3 className="text-2xl font-black text-green-600 mt-1">{totalRevenue.toFixed(2)} <span className="text-sm font-medium text-gray-400">MAD</span></h3>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <BarChart3 className="w-5 h-5" />
            </div>
            <span className="flex items-center gap-0.5 text-xs font-bold text-red-500">
              <ArrowDownRight className="w-3 h-3" />
              -2%
            </span>
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">CTR Moyen</p>
          <h3 className="text-2xl font-black text-gray-900 mt-1">{avgCTR}%</h3>
        </div>
      </div>

      {/* Charts Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-influencer-500" />
            Clics & Conversions
          </h2>
          <div className="h-64 flex items-center justify-center bg-gradient-to-br from-gray-50 to-influencer-50/30 rounded-xl border border-gray-100">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 mx-auto text-influencer-300 mb-2" />
              <p className="text-sm text-gray-400 font-medium">Graphique de performance</p>
              <p className="text-xs text-gray-400">Données sur {period} jours</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-500" />
            Revenus par Jour
          </h2>
          <div className="h-64 flex items-center justify-center bg-gradient-to-br from-gray-50 to-green-50/30 rounded-xl border border-gray-100">
            <div className="text-center">
              <TrendingUp className="w-12 h-12 mx-auto text-green-300 mb-2" />
              <p className="text-sm text-gray-400 font-medium">Courbe de revenus</p>
              <p className="text-xs text-gray-400">Derniers {period} jours</p>
            </div>
          </div>
        </div>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products by Revenue */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">🏆 Top Produits (Revenus)</h2>
          <div className="space-y-3">
            {topProducts.map((link, idx) => (
              <div key={link.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black ${
                  idx === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
                  idx === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400' :
                  idx === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700' :
                  'bg-gray-200 text-gray-600'
                }`}>
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{link.product?.nameFr || `Produit #${link.productId}`}</p>
                  <p className="text-xs text-gray-500">{link.clicks} clics • {link.conversions} conv.</p>
                </div>
                <span className="text-sm font-black text-green-600">{link.earnings.toFixed(2)} MAD</span>
              </div>
            ))}
            {topProducts.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-4">Aucune donnée</p>
            )}
          </div>
        </div>

        {/* Top Products by Clicks */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">📊 Top Produits (Clics)</h2>
          <div className="space-y-3">
            {topByClicks.map((link, idx) => (
              <div key={link.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black ${
                  idx === 0 ? 'bg-gradient-to-br from-blue-400 to-blue-600' :
                  idx === 1 ? 'bg-gradient-to-br from-blue-300 to-blue-400' :
                  idx === 2 ? 'bg-gradient-to-br from-blue-200 to-blue-300 text-blue-700' :
                  'bg-gray-200 text-gray-600'
                }`}>
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{link.product?.nameFr || `Produit #${link.productId}`}</p>
                  <p className="text-xs text-gray-500">{link.conversions} conv. • {link.earnings.toFixed(2)} MAD</p>
                </div>
                <span className="text-sm font-black text-blue-600">{link.clicks.toLocaleString()}</span>
                <span className="text-xs text-gray-400">clics</span>
              </div>
            ))}
            {topByClicks.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-4">Aucune donnée</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

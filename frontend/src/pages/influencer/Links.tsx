import { useState, useEffect } from 'react';
import { influencerApi } from '../../lib/api';
import { ReferralLink } from '../../types';
import {
  Link as LinkIcon, Copy, ExternalLink, QrCode,
  Search, SlidersHorizontal, Plus, MousePointerClick,
  TrendingUp, DollarSign, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function InfluencerLinks() {
  const [links, setLinks] = useState<ReferralLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'earnings' | 'clicks' | 'conversions' | 'date'>('date');
  
  // Modal states
  const [selectedLink, setSelectedLink] = useState<ReferralLink | null>(null);
  const [showUtmModal, setShowUtmModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [utmSource, setUtmSource] = useState('instagram');
  const [utmMedium, setUtmMedium] = useState('referral');
  const [utmCampaign, setUtmCampaign] = useState('summer_sale');

  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = async () => {
    try {
      const res = await influencerApi.getLinks();
      setLinks(res.data);
    } catch (error) {
      console.error('Failed to load links:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = (code: string) => {
    const link = `${window.location.origin}/ref/${code}`;
    navigator.clipboard.writeText(link);
    toast.success('Lien copié!');
  };

  const copyUTMLink = (code: string, source: string) => {
    const base = `${window.location.origin}/ref/${code}`;
    const utm = `${base}?utm_source=${source}&utm_medium=referral&utm_campaign=influencer`;
    navigator.clipboard.writeText(utm);
    toast.success('Lien UTM copié!');
  };

  const totalClicks = links.reduce((sum, l) => sum + l.clicks, 0);
  const totalConversions = links.reduce((sum, l) => sum + l.conversions, 0);
  const totalEarnings = links.reduce((sum, l) => sum + l.earnings, 0);

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Mes Liens de Parrainage</h1>
          <p className="text-sm text-gray-500 mt-1">Gérez, suivez et optimisez vos liens de parrainage.</p>
        </div>
        <a
          href="/influencer/marketplace"
          className="flex items-center gap-1.5 px-5 py-2.5 bg-influencer-500 text-white rounded-xl text-sm font-bold hover:bg-influencer-600 transition-all"
        >
          <Plus className="w-4 h-4" />
          Créer un Lien
        </a>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2.5 bg-influencer-50 text-influencer-600 rounded-xl">
            <LinkIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">Total Liens</p>
            <p className="text-lg font-black text-gray-900">{links.length}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <MousePointerClick className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">Total Clics</p>
            <p className="text-lg font-black text-gray-900">{totalClicks.toLocaleString()}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2.5 bg-green-50 text-green-600 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">Conversions</p>
            <p className="text-lg font-black text-gray-900">{totalConversions.toLocaleString()}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">Revenus</p>
            <p className="text-lg font-black text-green-600">{totalEarnings.toFixed(2)} MAD</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            className="input pl-9"
            placeholder="Rechercher par produit ou code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-gray-400" />
          {(['date', 'earnings', 'clicks', 'conversions'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                sortBy === s
                  ? 'bg-influencer-50 text-influencer-700 ring-1 ring-influencer-200'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {s === 'date' ? 'Date' : s === 'earnings' ? 'Revenus' : s === 'clicks' ? 'Clics' : 'Conv.'}
            </button>
          ))}
        </div>
      </div>

      {/* Links Table */}
      <div className="card overflow-hidden">
        {filteredLinks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Produit</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Clics</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Conv.</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">CTR</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Revenus</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredLinks.map((link) => {
                  const ctr = link.clicks > 0 ? ((link.conversions / link.clicks) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={link.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {link.product?.images?.[0]?.imageUrl ? (
                            <img src={link.product.images[0].imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                              <Eye className="w-4 h-4" />
                            </div>
                          )}
                          <p className="text-sm font-bold text-gray-900 truncate max-w-[180px]">{link.product?.nameFr || `Produit #${link.productId}`}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{link.code}</code>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">{link.clicks.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">{link.conversions.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          parseFloat(ctr) >= 5 ? 'bg-green-100 text-green-700' :
                          parseFloat(ctr) >= 2 ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{ctr}%</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-black text-green-600">{link.earnings.toFixed(2)} MAD</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => copyLink(link.code)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-influencer-600 hover:bg-influencer-50 transition-all"
                            title="Copier lien"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedLink(link);
                              setShowUtmModal(true);
                            }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                            title="UTM Builder"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <button
                            className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-all"
                            title="QR Code"
                            onClick={() => {
                              setSelectedLink(link);
                              setShowQrModal(true);
                            }}
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <LinkIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Aucun lien trouvé</p>
            <p className="text-gray-400 text-sm mt-1">Explorez le marché pour créer vos premiers liens!</p>
          </div>
        )}
      </div>

      {/* UTM Builder Modal */}
      {showUtmModal && selectedLink && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-900/75 backdrop-blur-sm" onClick={() => setShowUtmModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
              <h2 className="text-xl font-extrabold text-gray-900 mb-1">UTM Builder</h2>
              <p className="text-sm text-gray-500 mb-6">Créez des liens personnalisés pour suivre vos sources de trafic.</p>

              <div className="space-y-4">
                <div>
                  <label className="label">Source (utm_source)</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['instagram', 'tiktok', 'facebook', 'snapchat', 'youtube', 'other'].map(s => (
                      <button
                        key={s}
                        onClick={() => setUtmSource(s)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                          utmSource === s 
                          ? 'bg-influencer-50 border-influencer-200 text-influencer-700' 
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                  {utmSource === 'other' && (
                    <input 
                      type="text" 
                      className="input mt-2" 
                      placeholder="Spécifiez la source..." 
                      onChange={(e) => setUtmSource(e.target.value)}
                    />
                  )}
                </div>

                <div>
                  <label className="label">Medium (utm_medium)</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={utmMedium}
                    onChange={(e) => setUtmMedium(e.target.value)}
                    placeholder="e.g. bio, story, post" 
                  />
                </div>

                <div>
                  <label className="label">Campagne (utm_campaign)</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={utmCampaign}
                    onChange={(e) => setUtmCampaign(e.target.value)}
                    placeholder="e.g. summer_promo" 
                  />
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-2">Lien Généré</p>
                  <code className="text-[10px] break-all text-gray-600 block bg-white p-2 rounded border border-gray-200">
                    {`${window.location.origin}/ref/${selectedLink?.code}?utm_source=${utmSource}&utm_medium=${utmMedium}&utm_campaign=${utmCampaign}`}
                  </code>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowUtmModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all"
                >
                  Fermer
                </button>
                <button
                  onClick={() => {
                    const finalLink = `${window.location.origin}/ref/${selectedLink?.code}?utm_source=${utmSource}&utm_medium=${utmMedium}&utm_campaign=${utmCampaign}`;
                    navigator.clipboard.writeText(finalLink);
                    toast.success('Lien UTM copié!');
                    setShowUtmModal(false);
                  }}
                  className="flex-1 px-4 py-2.5 bg-influencer-500 text-white rounded-xl text-sm font-bold hover:bg-influencer-600 transition-all flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copier le Lien
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && selectedLink && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-900/75 backdrop-blur-sm" onClick={() => setShowQrModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
              <h2 className="text-xl font-extrabold text-gray-900 mb-1">QR Code</h2>
              <p className="text-sm text-gray-500 mb-6">Scanner pour accéder au produit.</p>

              <div className="bg-white p-4 rounded-2xl border-2 border-dashed border-gray-200 inline-block mb-6">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/ref/${selectedLink?.code}`)}`}
                  alt="QR Code"
                  className="w-48 h-48 mx-auto"
                />
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(`${window.location.origin}/ref/${selectedLink?.code}`)}`;
                    link.download = `qr-code-${selectedLink?.code}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    toast.success('Téléchargement lancé!');
                  }}
                  className="w-full px-4 py-2.5 bg-influencer-500 text-white rounded-xl text-sm font-bold hover:bg-influencer-600 transition-all flex items-center justify-center gap-2"
                >
                  <QrCode className="w-4 h-4" />
                  Télécharger le QR Code
                </button>
                <button
                  onClick={() => setShowQrModal(false)}
                  className="w-full px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 transition-all"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

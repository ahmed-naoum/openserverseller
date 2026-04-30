import { useState, useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { helperApi } from '../../lib/api';
import {
  Link as LinkIcon, Copy, QrCode, Search, RefreshCw, Power,
  AlertCircle, User, MousePointerClick, TrendingUp, Eye, ShieldAlert,
  Wand2
} from 'lucide-react';
import toast from 'react-hot-toast';
import LandingPageBuilderModal from '../../components/helper/LandingPageBuilderModal';

interface ReferralLink {
  id: number;
  code: string;
  clicks: number;
  conversions: number;
  earnings: number;
  isActive: boolean;
  createdAt: string;
  product?: { nameFr?: string; images?: { url: string }[] };
  influencer?: { id: number; fullName?: string; email?: string };
}

export default function HelperLinks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [links, setLinks] = useState<ReferralLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // Permission Guard
  if (user?.role === 'HELPER' && !user?.canManageInfluencerLinks) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mb-6 animate-bounce">
          <ShieldAlert size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Accès Non Autorisé</h2>
        <p className="text-slate-500 max-w-md mb-8">
          Vous n'avez pas la permission de gérer les liens de parrainage. Veuillez contacter un administrateur pour obtenir l'accès.
        </p>
        <Link 
          to="/helper" 
          className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
        >
          Retour au Tableau de Bord
        </Link>
      </div>
    );
  }

  useEffect(() => { loadLinks(); }, []);

  const loadLinks = async () => {
    try {
      const res = await helperApi.getAssignedLinks();
      setLinks(res.data);
    } catch {
      toast.error('Erreur lors du chargement des liens');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/r/${code}`);
    toast.success('Lien copié !');
  };

  const filtered = links.filter(l => {
    if (!search) return true;
    const name = l.product?.nameFr?.toLowerCase() || '';
    const influencer = l.influencer?.fullName?.toLowerCase() || '';
    const code = l.code.toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || influencer.includes(q) || code.includes(q);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Liens de Parrainage</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gérez les liens de tous vos influenceurs assignés — {links.length} lien{links.length !== 1 ? 's' : ''} au total.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Liens', value: links.length, icon: LinkIcon, color: 'orange' },
          { label: 'Total Clics', value: links.reduce((s, l) => s + l.clicks, 0).toLocaleString(), icon: MousePointerClick, color: 'blue' },
          { label: 'Conversions', value: links.reduce((s, l) => s + l.conversions, 0), icon: TrendingUp, color: 'emerald' },
          { label: 'Liens Actifs', value: links.filter(l => l.isActive).length, icon: Eye, color: 'purple' },
        ].map(stat => (
          <div key={stat.label} className="card p-4 flex items-center gap-3">
            <div className={`p-2.5 bg-${stat.color}-50 text-${stat.color}-600 rounded-xl`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase">{stat.label}</p>
              <p className="text-lg font-black text-gray-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            className="input pl-10 w-full"
            placeholder="Rechercher par produit, influenceur ou code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Influenceur</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Produit</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Clics</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Conv.</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(link => (
                  <tr key={link.id} className="group hover:bg-gray-50/50 transition-colors">
                    {/* Influencer */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-black text-xs flex-shrink-0">
                          {link.influencer?.fullName?.charAt(0)?.toUpperCase() || <User className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{link.influencer?.fullName || 'Inconnu'}</p>
                          <p className="text-xs text-gray-400 truncate">{link.influencer?.email}</p>
                        </div>
                      </div>
                    </td>
                    {/* Product */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {link.product?.images?.[0]?.url ? (
                          <img src={link.product.images[0].url} className="w-8 h-8 rounded-lg object-cover" alt="" />
                        ) : (
                          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                            <LinkIcon className="w-3.5 h-3.5 text-gray-400" />
                          </div>
                        )}
                        <span className="text-sm font-bold text-gray-900 truncate max-w-[140px]">{link.product?.nameFr || '—'}</span>
                      </div>
                    </td>
                    {/* Code */}
                    <td className="px-6 py-4">
                      <code className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-1 rounded-lg">{link.code}</code>
                    </td>
                    {/* Clicks */}
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{link.clicks.toLocaleString()}</td>
                    {/* Conversions */}
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{link.conversions.toLocaleString()}</td>
                    {/* Status */}
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                        link.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {link.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end">
                        <div className="inline-flex items-center gap-3 p-2 bg-gray-50/50 backdrop-blur-sm border border-gray-100 rounded-xl opacity-0 group-hover:opacity-100 group-hover:translate-x-0 translate-x-2 transition-all duration-200">
                          <button
                            onClick={() => copyLink(link.code)}
                            className="p-2 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 hover:scale-110 transition-all duration-200"
                            title="Copier le lien"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => navigate(`/helper/links/${link.id}/builder`)}
                            className="p-2 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 hover:scale-110 transition-all duration-200"
                            title="Constructeur de Page"
                          >
                            <Wand2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <LinkIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">
              {search ? 'Aucun lien trouvé pour cette recherche' : 'Aucun lien de parrainage pour vos influenceurs assignés'}
            </p>
          </div>
        )}
      </div>

    </div>
  );
}

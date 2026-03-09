import { useState, useEffect } from 'react';
import { influencerApi } from '../../lib/api';
import { InfluencerCampaign } from '../../types';
import {
  Zap, Plus, Play, Pause, Target,
  Calendar, BarChart3, ArrowUpRight
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function InfluencerCampaigns() {
  const [campaigns, setCampaigns] = useState<InfluencerCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'ACTIVE' | 'PAUSED' | 'ENDED'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      const res = await influencerApi.getCampaigns();
      setCampaigns(res.data);
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCampaigns = activeFilter === 'all'
    ? campaigns
    : campaigns.filter(c => c.status === activeFilter);

  const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE').length;
  const pausedCampaigns = campaigns.filter(c => c.status === 'PAUSED').length;

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
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Mes Campagnes</h1>
          <p className="text-sm text-gray-500 mt-1">Créez et gérez vos campagnes marketing. Max 10 campagnes actives.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={activeCampaigns >= 10}
          className="flex items-center gap-1.5 px-5 py-2.5 bg-influencer-500 text-white rounded-xl text-sm font-bold hover:bg-influencer-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <Plus className="w-4 h-4" />
          Nouvelle Campagne
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2.5 bg-influencer-50 text-influencer-600 rounded-xl">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">Total</p>
            <p className="text-lg font-black text-gray-900">{campaigns.length}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2.5 bg-green-50 text-green-600 rounded-xl">
            <Play className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">Actives</p>
            <p className="text-lg font-black text-green-600">{activeCampaigns}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
            <Pause className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">En Pause</p>
            <p className="text-lg font-black text-amber-600">{pausedCampaigns}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2.5 bg-gray-50 text-gray-600 rounded-xl">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">Capacité</p>
            <p className="text-lg font-black text-gray-900">{activeCampaigns}/10</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {([['all', 'Tout'], ['ACTIVE', 'Actives'], ['PAUSED', 'En pause'], ['ENDED', 'Terminées']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveFilter(key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeFilter === key
                ? 'bg-influencer-50 text-influencer-700 ring-1 ring-influencer-200'
                : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Campaign Grid */}
      {filteredCampaigns.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCampaigns.map((campaign) => (
            <div key={campaign.id} className="card p-5 hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    campaign.status === 'ACTIVE' ? 'bg-green-500' :
                    campaign.status === 'PAUSED' ? 'bg-amber-500' :
                    'bg-gray-400'
                  }`} />
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                    campaign.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                    campaign.status === 'PAUSED' ? 'bg-amber-100 text-amber-700' :
                    campaign.status === 'ENDED' ? 'bg-gray-100 text-gray-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {campaign.status === 'ACTIVE' ? 'Active' :
                     campaign.status === 'PAUSED' ? 'En pause' :
                     campaign.status === 'ENDED' ? 'Terminée' : 'Brouillon'}
                  </span>
                </div>
                <button className="p-1 rounded-lg text-gray-400 hover:text-influencer-600 hover:bg-influencer-50 opacity-0 group-hover:opacity-100 transition-all">
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>

              <h3 className="text-base font-bold text-gray-900 mb-1">{campaign.name}</h3>
              <p className="text-sm text-gray-500 line-clamp-2 mb-4">{campaign.description || 'Pas de description'}</p>

              <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                <span className="flex items-center gap-1">
                  <Target className="w-3.5 h-3.5" />
                  {campaign.productIds?.length || 0} produits
                </span>
                <span className="flex items-center gap-1">
                  <BarChart3 className="w-3.5 h-3.5" />
                  {campaign.commission}% comm.
                </span>
              </div>

              {campaign.startDate && (
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(campaign.startDate).toLocaleDateString()}
                  {campaign.endDate && ` — ${new Date(campaign.endDate).toLocaleDateString()}`}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Zap className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Aucune campagne trouvée</p>
          <p className="text-gray-400 text-sm mt-1">Créez votre première campagne pour commencer à promouvoir des produits!</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-influencer-500 text-white rounded-xl text-sm font-bold hover:bg-influencer-600 transition-all"
          >
            <Plus className="w-4 h-4" />
            Créer une Campagne
          </button>
        </div>
      )}

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-900/75 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
              <h2 className="text-xl font-extrabold text-gray-900 mb-1">Nouvelle Campagne</h2>
              <p className="text-sm text-gray-500 mb-6">Créez une campagne pour promouvoir des produits sélectionnés.</p>

              <div className="space-y-4">
                <div>
                  <label className="label">Nom de la Campagne</label>
                  <input type="text" className="input" placeholder="Ma campagne été 2026" />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea className="input min-h-[80px]" placeholder="Décrivez l'objectif de cette campagne..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Date de début</label>
                    <input type="date" className="input" />
                  </div>
                  <div>
                    <label className="label">Date de fin</label>
                    <input type="date" className="input" />
                  </div>
                </div>
                <div>
                  <label className="label">Objectif</label>
                  <select className="input">
                    <option value="clicks">Clics</option>
                    <option value="sales">Ventes</option>
                  </select>
                </div>
                <div>
                  <label className="label">Plateformes Cibles</label>
                  <div className="flex gap-2">
                    {['Instagram', 'TikTok', 'Facebook'].map(p => (
                      <button key={p} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 hover:border-influencer-300 hover:bg-influencer-50 hover:text-influencer-700 transition-all">
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={() => { setShowCreateModal(false); toast.success('Campagne créée avec succès!'); }}
                  className="flex-1 px-4 py-2.5 bg-influencer-500 text-white rounded-xl text-sm font-bold hover:bg-influencer-600 transition-all"
                >
                  Créer la Campagne
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

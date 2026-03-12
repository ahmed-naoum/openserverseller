import { useState, useEffect } from 'react';
import { adminApi, marketplaceApi } from '../../lib/api';
import { InfluencerCampaign, Product } from '../../types';
import {
  Zap, Plus, Play, Pause, Target,
  Calendar, BarChart3, Edit3, Trash2,
  Search, Filter, PlusCircle, Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AdminCampaigns() {
  const [campaigns, setCampaigns] = useState<InfluencerCampaign[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<InfluencerCampaign | null>(null);
  
  // Form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    commission: '5',
    status: 'ACTIVE',
    productIds: [] as (number | string)[],
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [campRes, prodRes] = await Promise.all([
        adminApi.getCampaigns(),
        marketplaceApi.products()
      ]);
      setCampaigns(campRes.data.data);
      setProducts(prodRes.data.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCampaign) {
        await adminApi.updateCampaign(editingCampaign.id, form);
        toast.success('Campagne mise à jour');
      } else {
        await adminApi.createCampaign(form);
        toast.success('Campagne créée');
      }
      setShowModal(false);
      setEditingCampaign(null);
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Voulez-vous vraiment supprimer cette campagne ?')) return;
    try {
      await adminApi.deleteCampaign(id);
      toast.success('Campagne supprimée');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const openEdit = (campaign: InfluencerCampaign) => {
    setEditingCampaign(campaign);
    setForm({
      name: campaign.name,
      description: campaign.description || '',
      commission: campaign.commission?.toString() || campaign.commissionRate?.toString() || '5',
      status: campaign.status,
      productIds: campaign.productIds || [],
      startDate: campaign.startDate ? format(new Date(campaign.startDate), 'yyyy-MM-dd') : '',
      endDate: campaign.endDate ? format(new Date(campaign.endDate), 'yyyy-MM-dd') : ''
    });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditingCampaign(null);
    setForm({
      name: '',
      description: '',
      commission: '5',
      status: 'ACTIVE',
      productIds: [],
      startDate: '',
      endDate: ''
    });
    setShowModal(true);
  };

  const toggleProduct = (id: number | string) => {
    setForm(prev => ({
      ...prev,
      productIds: prev.productIds.includes(id)
        ? prev.productIds.filter(pid => pid !== id)
        : [...prev.productIds, id]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Gestion des Campagnes</h1>
          <p className="text-sm text-gray-500 mt-1">Créez et gérez les campagnes destinées aux influenceurs.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Nouvelle Campagne
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          {isLoading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="h-40 bg-white border border-gray-100 rounded-2xl animate-pulse" />
            ))
          ) : campaigns.length > 0 ? (
            campaigns.map((campaign) => (
              <div key={campaign.id} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${
                      campaign.status === 'ACTIVE' ? 'bg-green-50 text-green-600' :
                      campaign.status === 'PAUSED' ? 'bg-amber-50 text-amber-600' :
                      'bg-gray-50 text-gray-600'
                    }`}>
                      <Zap className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-gray-900">{campaign.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                          campaign.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                          campaign.status === 'PAUSED' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {campaign.status}
                        </span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          {campaign.commission}% Commission
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => openEdit(campaign)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Edit3 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(campaign.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <p className="text-sm text-gray-500 mb-6 line-clamp-2">{campaign.description || 'Aucune description fournie.'}</p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-50">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Produits</p>
                    <p className="text-sm font-black text-gray-900">{campaign.productIds?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Début</p>
                    <p className="text-sm font-black text-gray-900">
                      {campaign.startDate ? format(new Date(campaign.startDate), 'dd MMM yyyy', { locale: fr }) : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Fin</p>
                    <p className="text-sm font-black text-gray-900">
                      {campaign.endDate ? format(new Date(campaign.endDate), 'dd MMM yyyy', { locale: fr }) : '-'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Performance</p>
                    <div className="flex items-center justify-end gap-1 text-sm font-black text-blue-600">
                      <BarChart3 className="w-4 h-4" />
                      Détails
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white border-2 border-dashed border-gray-100 rounded-3xl p-12 text-center">
              <Zap className="w-12 h-12 mx-auto text-gray-200 mb-4" />
              <p className="text-gray-500 font-bold text-lg">Aucune campagne</p>
              <p className="text-sm text-gray-400 mt-1 mb-8">Commencez par créer une campagne pour mobiliser les influenceurs.</p>
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-2xl text-sm font-bold hover:bg-gray-800 transition-all shadow-lg"
              >
                <Plus className="w-4 h-4" />
                Créer la première campagne
              </button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl shadow-blue-500/20">
            <h3 className="text-lg font-black mb-1 italic">Statistiques Globales</h3>
            <p className="text-blue-100 text-xs mb-6">Résumé de l'activité d'affiliation</p>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-white/10 rounded-xl">
                <span className="text-xs font-bold text-blue-50">Campagnes Actives</span>
                <span className="text-sm font-black text-white">{campaigns.filter(c => c.status === 'ACTIVE').length}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/10 rounded-xl">
                <span className="text-xs font-bold text-blue-50">Total Produits</span>
                <span className="text-sm font-black text-white">{products.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Campaign Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
              onClick={() => setShowModal(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-gray-50">
                <h2 className="text-2xl font-black text-gray-900">
                  {editingCampaign ? 'Modifier la Campagne' : 'Nouvelle Campagne'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">Configurez les détails et sélectionnez les produits.</p>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5 ml-1">Nom</label>
                      <input
                        type="text"
                        required
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        placeholder="e.g. Offre Exclusive Ramadan"
                        value={form.name}
                        onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5 ml-1">Commission (%)</label>
                      <input
                        type="number"
                        required
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold"
                        value={form.commission}
                        onChange={e => setForm(prev => ({ ...prev, commission: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5 ml-1">Description</label>
                      <textarea
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-h-[100px]"
                        placeholder="Détaillez les conditions de la campagne..."
                        value={form.description}
                        onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5 ml-1">Début</label>
                        <input
                          type="date"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          value={form.startDate}
                          onChange={e => setForm(prev => ({ ...prev, startDate: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5 ml-1">Fin</label>
                        <input
                          type="date"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          value={form.endDate}
                          onChange={e => setForm(prev => ({ ...prev, endDate: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5 ml-1">Statut</label>
                      <select
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:bg-white focus:outline-none"
                        value={form.status}
                        onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
                      >
                        <option value="ACTIVE">ACTIF</option>
                        <option value="PAUSED">EN PAUSE</option>
                        <option value="DRAFT">BROUILLON</option>
                        <option value="ENDED">TERMINÉ</option>
                      </select>
                    </div>

                    <div className="pt-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-2 ml-1">Produits ({form.productIds.length})</label>
                       <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 max-h-[150px] overflow-y-auto space-y-2">
                         {products.map(p => (
                           <label key={p.id} className="flex items-center gap-3 p-2 bg-white rounded-xl border border-gray-50 cursor-pointer hover:border-blue-200 transition-all">
                             <input 
                               type="checkbox" 
                               checked={form.productIds.includes(p.id)}
                               onChange={() => toggleProduct(p.id)}
                               className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                             />
                             <div className="flex items-center gap-2 flex-1 min-w-0">
                               {p.images?.[0]?.imageUrl ? (
                                 <img src={p.images[0].imageUrl} className="w-6 h-6 rounded object-cover" />
                               ) : <Package className="w-4 h-4 text-gray-300" />}
                               <span className="text-xs font-bold text-gray-700 truncate">{p.nameFr}</span>
                             </div>
                             <span className="text-[10px] font-black text-blue-600 whitespace-nowrap">{p.retailPriceMad} MAD</span>
                           </label>
                         ))}
                       </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 rounded-2xl text-sm font-black hover:bg-gray-200 transition-all uppercase tracking-widest"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-2xl text-sm font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/30 uppercase tracking-widest"
                  >
                    Enregistrer
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

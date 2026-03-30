import { useState, useEffect } from 'react';
import { influencerApi } from '../../lib/api';
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  XCircle,
  ExternalLink,
  Search,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export default function InfluencerInventory() {
  const [claims, setClaims] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ClaimStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchClaims();
  }, []);

  const fetchClaims = async () => {
    try {
      setIsLoading(true);
      const res = await influencerApi.getClaims();
      // Handle potential response structure differences
      const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setClaims(data);
    } catch (error) {
      toast.error('Impossible de charger vos produits');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredClaims = claims.filter(claim => {
    const matchesTab = activeTab === 'ALL' || claim.status === activeTab;
    const matchesSearch = claim.product.nameFr.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         claim.product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const stats = {
    pending: claims.filter(c => c.status === 'PENDING').length,
    approved: claims.filter(c => c.status === 'APPROVED').length,
    rejected: claims.filter(c => c.status === 'REJECTED').length,
  };

  const handleGenerateLink = async (productId: number) => {
    try {
      const res = await influencerApi.createLink(productId);
      const newLink = res.data;
      
      // Update the claims state locally to show the new link
      setClaims(prev => prev.map(c => {
        if (c.productId === productId) {
          return { ...c, referralLink: newLink };
        }
        return c;
      }));
      
      toast.success('Lien généré avec succès !');
    } catch (error) {
      toast.error('Erreur lors de la génération du lien');
      console.error(error);
    }
  };

  const handleCopyLink = (code: string) => {
    const link = `${window.location.origin}/r/${code}`;
    navigator.clipboard.writeText(link);
    toast.success('Lien copié dans le presse-papiers !');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-influencer-200 border-t-influencer-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mon Inventaire</h1>
          <p className="text-gray-500 text-sm mt-1">Gérez vos produits réclamés et suivez vos approbations.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text"
              placeholder="Rechercher un produit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-influencer-500 outline-none transition-all w-full md:w-64"
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">En attente</p>
            <p className="text-xl font-black text-gray-900">{stats.pending}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Approuvés</p>
            <p className="text-xl font-black text-gray-900">{stats.approved}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Refusés</p>
            <p className="text-xl font-black text-gray-900">{stats.rejected}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 w-fit">
        {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === tab 
                ? 'bg-influencer-600 text-white shadow-lg shadow-influencer-200' 
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {tab === 'ALL' ? 'Tous' : tab === 'PENDING' ? 'En attente' : tab === 'APPROVED' ? 'Approuvés' : 'Refusés'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredClaims.map((claim) => (
            <motion.div
              key={claim.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col"
            >
              <div className="aspect-square relative overflow-hidden bg-gray-50">
                {claim.product.images?.[0]?.imageUrl ? (
                  <img 
                    src={claim.product.images[0].imageUrl} 
                    alt={claim.product.nameFr}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-12 h-12 text-gray-200" />
                  </div>
                )}
                
                <div className="absolute top-3 right-3">
                  <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5 ${
                    claim.status === 'APPROVED' ? 'bg-green-500 text-white' :
                    claim.status === 'REJECTED' ? 'bg-red-500 text-white' :
                    'bg-amber-500 text-white'
                  }`}>
                    {claim.status === 'APPROVED' && <CheckCircle2 className="w-3 h-3" />}
                    {claim.status === 'REJECTED' && <XCircle className="w-3 h-3" />}
                    {claim.status === 'PENDING' && <Clock className="w-3 h-3" />}
                    {claim.status === 'APPROVED' ? 'Approuvé' : claim.status === 'REJECTED' ? 'Refusé' : 'En attente'}
                  </div>
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-bold text-gray-900 mb-1 line-clamp-1">{claim.product.nameFr}</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-4">SKU: {claim.product.sku}</p>
                
                <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-bold text-gray-400 uppercase leading-none">Prix Influencer</div>
                    <div className="text-influencer-600 font-black text-sm leading-none">
                      {claim.product.influencerPriceMad || claim.product.retailPriceMad} <span className="text-[10px]">MAD</span>
                    </div>
                    <div className="text-[10px] font-bold text-influencer-500">
                      Comm: {`${Math.round((claim.product.influencerPriceMad || claim.product.retailPriceMad || 0) * 0.15 * 100) / 100} MAD`}
                    </div>
                  </div>
                  
                  {claim.status === 'APPROVED' ? (
                    claim.referralLink ? (
                      <button 
                        onClick={() => handleCopyLink(claim.referralLink.code)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-influencer-50 text-influencer-600 rounded-lg hover:bg-influencer-100 transition-colors text-xs font-bold"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Copier
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleGenerateLink(claim.productId)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-influencer-600 text-white rounded-lg hover:bg-influencer-700 transition-colors text-xs font-bold shadow-sm"
                      >
                        <Package className="w-3 h-3" />
                        Générer
                      </button>
                    )
                  ) : (
                    <div className="text-[10px] font-bold text-gray-400 italic">
                      {claim.status === 'REJECTED' ? 'Non éligible' : 'Vérification...'}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredClaims.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-400 bg-white rounded-3xl border-2 border-dashed border-gray-100">
            <Package className="w-16 h-16 mb-4 opacity-20" />
            <p className="font-bold">Aucun produit trouvé</p>
            <p className="text-sm">Essayez de modifier vos filtres ou de réclamer des produits au marché.</p>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { marketplaceApi, influencerApi } from '../../lib/api';
import { 
  Search, 
  Package,
  ArrowRight,
  Link as LinkIcon,
  Copy,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function InfluencerMarketplace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [products, setProducts] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Link Generation State
  const [generatingFor, setGeneratingFor] = useState<number | null>(null);
  const [claimingFor, setClaimingFor] = useState<number | null>(null);
  const [generatedLink, setGeneratedLink] = useState<{ productId: number, url: string } | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchParams(prev => {
        if (search) prev.set('search', search);
        else prev.delete('search');
        prev.set('page', '1');
        return prev;
      });
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchData();
  }, [searchParams.get('search'), page]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [productsRes, claimsRes] = await Promise.all([
        marketplaceApi.products({
          view: 'AFFILIATE',
          search: searchParams.get('search') || '',
          page,
          limit: 12
        }),
        influencerApi.getClaims()
      ]);
      
      setProducts(productsRes.data?.data?.products || []);
      setTotal(productsRes.data?.data?.total || 0);
      setClaims(Array.isArray(claimsRes.data) ? claimsRes.data : (claimsRes.data?.data || []));
    } catch (error) {
      toast.error('Impossible de charger les données');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimProduct = async (productId: number) => {
    try {
      setClaimingFor(productId);
      await influencerApi.claimProduct(productId);
      toast.success('Produit réclamé ! En attente d\'approbation.');
      await fetchData(); // Refresh to show pending status
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la réclamation');
    } finally {
      setClaimingFor(null);
    }
  };

  const handleGenerateLink = async (productId: number) => {
    try {
      setGeneratingFor(productId);
      const res = await influencerApi.createLink(productId);
      
      const baseUrl = window.location.origin;
      const url = `${baseUrl}/r/${res.data.code}`;
      
      setGeneratedLink({ productId, url });
      
      // Auto copy
      navigator.clipboard.writeText(url);
      toast.success('Lien généré et copié !');
      
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la génération du lien');
    } finally {
      setGeneratingFor(null);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Lien copié !');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Marketplace Affiliation</h1>
          <p className="text-sm text-gray-500 mt-1">Découvrez les produits disponibles et générez vos liens de parrainage.</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400 group-focus-within:text-influencer-500 transition-colors" />
        </div>
        <input
          type="text"
          placeholder="Rechercher par nom de produit, SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="block w-full pl-11 pr-4 py-3 bg-white border border-gray-200 shadow-sm rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:border-influencer-500 focus:ring-influencer-500 transition-all font-medium"
        />
      </div>

      {/* Grid */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-[380px] animate-pulse border border-gray-100 shadow-sm" />
            ))}
          </motion.div>
        ) : products.length > 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {products.map((product, i) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                key={product.id}
                className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-influencer-500/5 hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col"
              >
                <div className="block aspect-[4/3] relative overflow-hidden bg-gray-50">
                  {product.images?.[0]?.url ? (
                    <img 
                      src={product.images[0].url} 
                      alt={product.nameFr} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                       <Package className="w-10 h-10" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 flex flex-col gap-2">
                     <span className="px-2.5 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-[10px] font-bold tracking-wide text-gray-900 shadow-sm">
                       {product.category?.nameFr}
                     </span>
                  </div>
                </div>
                
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1 leading-tight line-clamp-2">
                      {product.nameFr}
                    </h3>
                    <p className="text-xs text-gray-400 font-medium mb-3">SKU: {product.sku}</p>
                    
                    <div className="inline-block px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-bold mb-4">
                      Commission: Standard
                    </div>
                  </div>
                  
                  <div className="mt-auto border-t border-gray-50 pt-4 space-y-3">
                     <div className="flex justify-between items-end">
                       <div>
                         <div className="text-[10px] font-bold text-gray-400 uppercase">Prix Public</div>
                         <div className="text-xl font-black text-gray-900 leading-none">{product.retailPriceMad} <span className="text-xs font-bold">MAD</span></div>
                       </div>
                     </div>

                      {/* Claim / Link Logic */}
                      {(() => {
                        const claim = (claims || []).find(c => c.productId === product.id);
                        
                        if (!claim) {
                          return (
                            <button 
                              onClick={() => handleClaimProduct(product.id)}
                              disabled={claimingFor === product.id}
                              className="w-full flex items-center justify-center gap-2 py-2.5 bg-influencer-600 text-white rounded-xl text-sm font-bold hover:bg-influencer-700 transition-colors disabled:opacity-50"
                            >
                              {claimingFor === product.id ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Package className="w-4 h-4" />
                                  Réclamer le produit
                                </>
                              )}
                            </button>
                          );
                        }

                        if (claim.status === 'PENDING') {
                          return (
                            <div className="w-full py-2.5 bg-amber-50 text-amber-600 rounded-xl text-sm font-bold text-center border border-amber-100 italic">
                              En attente d'approbation...
                            </div>
                          );
                        }

                        if (claim.status === 'REJECTED') {
                          return (
                            <div className="w-full py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-bold text-center border border-red-100">
                              Demande refusée
                            </div>
                          );
                        }

                        if (claim.status === 'APPROVED') {
                          if (generatedLink?.productId === product.id) {
                            return (
                              <div className="p-3 bg-influencer-50 border border-influencer-100 rounded-xl space-y-2">
                                <div className="flex items-center gap-1.5 text-influencer-700 text-xs font-bold">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Lien prêt !
                                </div>
                                <div className="flex gap-2">
                                  <input 
                                    type="text" 
                                    readOnly 
                                    value={generatedLink.url} 
                                    className="w-full text-xs py-1.5 px-2 rounded-lg bg-white border border-influencer-200 text-gray-600 focus:outline-none"
                                  />
                                  <button 
                                    onClick={() => copyToClipboard(generatedLink.url)}
                                    className="p-1.5 bg-influencer-100 hover:bg-influencer-200 text-influencer-700 rounded-lg transition-colors flex-shrink-0"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <button 
                              onClick={() => handleGenerateLink(product.id)}
                              disabled={generatingFor === product.id}
                              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-influencer-600 transition-colors disabled:opacity-50"
                            >
                              {generatingFor === product.id ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : (
                                <>
                                  <LinkIcon className="w-4 h-4" />
                                  Générer le lien
                                </>
                              )}
                            </button>
                          );
                        }

                        return null;
                      })()}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white rounded-[2rem] py-20 px-8 text-center border-2 border-dashed border-gray-100"
          >
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-1">Aucun produit Affilié</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">Aucun produit n'est actuellement disponible pour l'affiliation.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pagination */}
      {total > products.length && (
         <div className="mt-8 flex justify-center">
            <button 
              disabled={isLoading}
              onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-2 bg-white border border-gray-200 px-6 py-3 rounded-xl font-bold text-sm text-gray-700 hover:shadow-md hover:border-gray-300 transition-all disabled:opacity-50"
            >
              Charger plus
              <ArrowRight className="w-4 h-4" />
            </button>
         </div>
      )}
    </div>
  );
}

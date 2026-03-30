import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { marketplaceApi, fulfillmentApi, inventoryApi } from '../../lib/api';
import { 
  Search, 
  Package,
  ArrowRight,
  Eye,
  ShoppingCart,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function GrossellerMarketplace() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [products, setProducts] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [purchasedIds, setPurchasedIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [requestingFor, setRequestingFor] = useState<number | null>(null);

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
      const [productsRes, requestsRes, inventoryRes] = await Promise.all([
        marketplaceApi.products({
          view: 'REGULAR',
          search: searchParams.get('search') || '',
          page,
          limit: 12
        }),
        fulfillmentApi.listRequests({ status: 'OPEN' }),
        inventoryApi.purchased()
      ]);
      
      setProducts(productsRes.data?.data?.products || []);
      setTotal(productsRes.data?.data?.total || 0);
      
      const requests = requestsRes.data?.data?.requests || [];
      setPendingRequests(requests);
      
      const inventory = inventoryRes.data?.data?.inventory || [];
      setPurchasedIds(new Set(inventory.map((item: any) => item.productId)));
    } catch (error) {
      toast.error('Impossible de charger les données');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestProduct = async (productId: number, productName: string) => {
    try {
      setRequestingFor(productId);
      await fulfillmentApi.createRequest({
        type: 'DELIVERY_FULFILLMENT',
        subject: `Demande d'achat pour ${productName}`,
        description: `L'utilisateur souhaite acheter le produit.`,
        productId
      });
      toast.success('Demande envoyée ! En attente de traitement.');
      await fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la demande');
    } finally {
      setRequestingFor(null);
    }
  };

  const getProductStatus = (productId: number) => {
    if (purchasedIds.has(productId)) return 'PURCHASED';
    const pending = pendingRequests.find((r: any) => r.productId === productId);
    if (pending) return 'PENDING';
    return 'AVAILABLE';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Marketplace B2B</h1>
          <p className="text-sm text-gray-500 mt-1">Parcourez les produits disponibles et faites vos demandes d'achat.</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400 group-focus-within:text-grosseller-500 transition-colors" />
        </div>
        <input
          type="text"
          placeholder="Rechercher par nom de produit, SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="block w-full pl-11 pr-4 py-3 bg-white border border-gray-200 shadow-sm rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:border-grosseller-500 focus:ring-grosseller-500 transition-all font-medium"
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
            {products.map((product, i) => {
              const status = getProductStatus(product.id);
              
              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={product.id}
                  className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-grosseller-500/5 hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col"
                >
                  <div className="block aspect-[4/3] relative overflow-hidden bg-gray-50">
                    {product.images?.[0]?.imageUrl ? (
                      <img 
                        src={product.images[0].imageUrl} 
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
                       {status === 'PURCHASED' && (
                         <span className="px-2.5 py-1 bg-green-500/90 backdrop-blur-sm rounded-lg text-[10px] font-black uppercase tracking-wider text-white shadow-sm">
                           Acheté
                         </span>
                       )}
                       {status === 'PENDING' && (
                         <span className="px-2.5 py-1 bg-amber-500/90 backdrop-blur-sm rounded-lg text-[10px] font-black uppercase tracking-wider text-white shadow-sm">
                           En attente
                         </span>
                       )}
                    </div>

                    {/* View product detail */}
                    <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
                      <button
                        onClick={(e) => { e.preventDefault(); navigate(`/grosseller/product/${product.id}`); }}
                        className="w-8 h-8 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-lg shadow-sm hover:bg-white hover:shadow-md hover:scale-110 transition-all text-gray-600 hover:text-grosseller-600"
                        title="Voir la page produit"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-1 leading-tight line-clamp-2">
                        {product.nameFr}
                      </h3>
                      <p className="text-xs text-gray-400 font-medium mb-3">SKU: {product.sku}</p>
                    </div>
                    
                    <div className="mt-auto border-t border-gray-50 pt-4 space-y-3">
                       <div className="flex justify-between items-end">
                         <div>
                           <div className="text-[10px] font-bold text-gray-400 uppercase">Prix Public</div>
                           <div className="text-xl font-black text-gray-900 leading-none">
                             {product.retailPriceMad} <span className="text-xs font-bold">MAD</span>
                           </div>
                         </div>
                       </div>

                       {/* Action Button */}
                       {status === 'AVAILABLE' ? (
                         <button 
                           onClick={() => handleRequestProduct(product.id, product.nameFr)}
                           disabled={requestingFor === product.id}
                           className="w-full flex items-center justify-center gap-2 py-2.5 bg-grosseller-600 text-white rounded-xl text-sm font-bold hover:bg-grosseller-700 transition-colors disabled:opacity-50"
                         >
                           {requestingFor === product.id ? (
                             <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                           ) : (
                             <>
                               <ShoppingCart className="w-4 h-4" />
                               Acheter le produit
                             </>
                           )}
                         </button>
                       ) : status === 'PENDING' ? (
                         <div className="w-full py-2.5 bg-amber-50 text-amber-600 rounded-xl text-sm font-bold text-center border border-amber-100 italic flex items-center justify-center gap-2">
                           <Clock className="w-4 h-4" />
                           En attente de traitement...
                         </div>
                       ) : (
                         <Link 
                           to="/grosseller/inventory"
                           className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-50 text-green-700 rounded-xl text-sm font-bold border border-green-100 hover:bg-green-100 transition-colors"
                         >
                           <CheckCircle2 className="w-4 h-4" />
                           Voir dans l'inventaire
                         </Link>
                       )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
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
            <h3 className="text-xl font-bold text-gray-900 mb-1">Aucun produit trouvé</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">Aucun produit ne correspond à votre recherche.</p>
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

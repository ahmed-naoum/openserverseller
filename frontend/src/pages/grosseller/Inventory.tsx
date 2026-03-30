import { useState, useEffect } from 'react';
import { inventoryApi, fulfillmentApi } from '../../lib/api';
import { Link } from 'react-router-dom';
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  ExternalLink,
  Search,
  ShoppingBag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function GrossellerInventory() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [inventoryRes, requestsRes] = await Promise.all([
        inventoryApi.purchased(),
        fulfillmentApi.listRequests({ status: 'OPEN' })
      ]);
      
      setInventory(inventoryRes.data?.data?.inventory || []);
      
      const requests = requestsRes.data?.data?.requests || [];
      // Deduplicate by productId
      const uniqueRequests = requests
        .filter((r: any) => r.type === 'DELIVERY_FULFILLMENT')
        .reduce((acc: any[], current: any) => {
          if (!acc.find((item: any) => item.productId === current.productId)) {
            acc.push(current);
          }
          return acc;
        }, []);
      setPendingRequests(uniqueRequests);
    } catch (error) {
      toast.error('Impossible de charger l\'inventaire');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const allItems = [
    ...pendingRequests.map((r: any) => ({ ...r, _type: 'pending' })),
    ...inventory.map((item: any) => ({ ...item, _type: 'purchased' }))
  ];

  const filteredItems = allItems.filter(item => {
    const name = item._type === 'pending' 
      ? (item.product?.nameFr || item.subject || '')
      : (item.product?.nameFr || '');
    const sku = item._type === 'pending'
      ? (item.product?.sku || '')
      : (item.product?.sku || '');
    return name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           sku.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-grosseller-200 border-t-grosseller-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mon Inventaire</h1>
          <p className="text-gray-500 text-sm mt-1">Gérez vos produits achetés et suivez vos demandes en cours.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text"
              placeholder="Rechercher un produit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-grosseller-500 outline-none transition-all w-full md:w-64"
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">En attente</p>
            <p className="text-xl font-black text-gray-900">{pendingRequests.length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Achetés</p>
            <p className="text-xl font-black text-gray-900">{inventory.length}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredItems.map((item) => (
            <motion.div
              key={item._type === 'pending' ? `pending-${item.id}` : `inv-${item.id}`}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col"
            >
              <div className="aspect-square relative overflow-hidden bg-gray-50">
                {(() => {
                  const imgUrl = item._type === 'pending'
                    ? item.product?.images?.[0]?.imageUrl
                    : (item.product?.images?.[0]?.imageUrl || item.product?.primaryImage);
                  return imgUrl ? (
                    <img 
                      src={imgUrl} 
                      alt={item.product?.nameFr || ''}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-12 h-12 text-gray-200" />
                    </div>
                  );
                })()}
                
                <div className="absolute top-3 right-3">
                  {item._type === 'pending' ? (
                    <div className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5 bg-amber-500 text-white">
                      <Clock className="w-3 h-3" />
                      En attente
                    </div>
                  ) : (
                    <div className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5 bg-green-500 text-white">
                      <CheckCircle2 className="w-3 h-3" />
                      Acheté
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-bold text-gray-900 mb-1 line-clamp-1">
                  {item.product?.nameFr || (item._type === 'pending' ? item.subject : '')}
                </h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-4">
                  SKU: {item.product?.sku || 'N/A'}
                </p>
                
                <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-bold text-gray-400 uppercase leading-none">
                      {item._type === 'pending' ? 'Prix' : 'Prix d\'achat'}
                    </div>
                    <div className="text-grosseller-600 font-black text-sm leading-none">
                      {item.product?.retailPriceMad || 'N/A'} <span className="text-[10px]">MAD</span>
                    </div>
                    {item._type === 'purchased' && (
                      <div className="text-[10px] font-bold text-gray-400">
                        Qté: {item.quantity}
                      </div>
                    )}
                  </div>
                  
                  {item._type === 'purchased' && item.productId && (
                    <Link
                      to={`/grosseller/product/${item.productId}`}
                      className="flex items-center gap-2 px-3 py-1.5 bg-grosseller-50 text-grosseller-600 rounded-lg hover:bg-grosseller-100 transition-colors text-xs font-bold"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Détails
                    </Link>
                  )}

                  {item._type === 'pending' && (
                    <div className="text-[10px] font-bold text-gray-400 italic">
                      Vérification...
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredItems.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-400 bg-white rounded-3xl border-2 border-dashed border-gray-100">
            <ShoppingBag className="w-16 h-16 mb-4 opacity-20" />
            <p className="font-bold">Aucun produit trouvé</p>
            <p className="text-sm">Parcourez le Marketplace pour ajouter des produits à votre inventaire.</p>
            <Link 
              to="/grosseller/marketplace"
              className="mt-4 px-6 py-2 bg-grosseller-600 text-white rounded-xl font-bold text-sm hover:bg-grosseller-700 transition-colors"
            >
              Aller au Marketplace
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

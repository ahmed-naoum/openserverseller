import { useQuery } from '@tanstack/react-query';
import { inventoryApi, fulfillmentApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Package, Clock, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function VendorInventory() {
  const { user } = useAuth();
  const isAffiliate = user?.mode === 'AFFILIATE'; // Use mode instead of role for switching logic

  const { data: inventoryData, isLoading: isLoadingInventory } = useQuery({
    queryKey: ['vendor-inventory', isAffiliate],
    queryFn: () => isAffiliate ? inventoryApi.claimed() : inventoryApi.purchased(),
  });

  const { data: pendingData, isLoading: isLoadingPending } = useQuery({
    queryKey: ['pending-fulfillment', user?.id],
    queryFn: () => fulfillmentApi.listRequests({ status: 'OPEN', userId: user?.id } as any),
  });

  const inventory = inventoryData?.data?.data?.[isAffiliate ? 'claims' : 'inventory'] || [];
  
  // Deduplicate pending requests by productId to avoid UI clutter
  const rawPending = pendingData?.data?.data?.requests?.filter((r: any) => 
    (isAffiliate && r.type === 'PRODUCT_CLAIM') || (!isAffiliate && r.type === 'DELIVERY_FULFILLMENT')
  ) || [];

  const pendingRequests = rawPending.reduce((acc: any[], current: any) => {
    const x = acc.find(item => item.productId === current.productId);
    if (!x) {
      return acc.concat([current]);
    } else {
      return acc;
    }
  }, []);

  const isLoading = isLoadingInventory || isLoadingPending;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            {isAffiliate ? 'Mes Produits Réclamés' : 'Mon Inventaire Produit'}
          </h1>
          <p className="text-gray-500 mt-1">Gérez les produits que vous avez acquis ou réclamés sur le marché.</p>
        </div>
        <Link 
          to="../marketplace" 
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-xl font-semibold hover:bg-primary-100 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Aller au Marché
        </Link>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2rem] border border-dashed border-gray-200">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mb-4"></div>
          <p className="text-gray-500 font-medium">Chargement de votre inventaire...</p>
        </div>
      ) : (inventory.length === 0 && pendingRequests.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2rem] border border-dashed border-gray-300 shadow-sm px-6 text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
            <Package className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Votre inventaire est vide</h3>
          <p className="text-gray-500 max-w-sm mb-8">
            {isAffiliate 
              ? "Vous n'avez pas encore réclamé de produits. Les produits que vous demandez apparaîtront ici." 
              : "Vous n'avez pas encore acheté de produits. Parcourez notre marché public pour commencer votre collection."}
          </p>
          <Link 
             to="../marketplace" 
             className="px-8 py-3 bg-primary-600 text-white rounded-xl font-bold shadow-lg shadow-primary-200 hover:bg-primary-700 transition-all"
           >
             Parcourir le Marché Public
           </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {/* Pending Requests */}
          {pendingRequests.map((request: any) => (
            <div key={`pending-${request.id}`} className="group bg-white rounded-xl border border-amber-100 shadow-sm overflow-hidden flex flex-col opacity-90 relative">
              <div className="absolute top-2 right-2 z-10">
                <span className="flex items-center gap-1 px-2 py-1 bg-amber-100/80 backdrop-blur-sm text-amber-700 rounded-lg text-[10px] font-bold shadow-sm">
                  <Clock className="w-2.5 h-2.5" />
                  EN ATTENTE
                </span>
              </div>
              
              <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
                {request.product?.images?.[0] ? (
                  <img src={request.product.images[0].imageUrl} alt="" className="w-full h-full object-cover grayscale-[0.5]" />
                ) : (
                  <Package className="w-10 h-10 text-gray-200" />
                )}
              </div>
              
              <div className="p-3">
                <h3 className="text-sm font-bold text-gray-900 line-clamp-1">{request.product?.nameFr || request.subject}</h3>
                <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{request.subject}</p>
                <div className="mt-2 pt-2 border-t border-gray-50 flex justify-between items-center text-[9px] text-gray-400">
                  <span>{new Date(request.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}

          {/* Actual Inventory */}
          {inventory.map((item: any) => (
            <div key={item.id} className="group bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col">
              <div className="aspect-square bg-gray-50 relative overflow-hidden">
                {item.product?.primaryImage ? (
                  <img 
                    src={item.product.primaryImage} 
                    alt={item.product.nameFr} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center border-b border-gray-100">
                      <Package className="w-10 h-10 text-gray-200" />
                  </div>
                )}
                <div className="absolute bottom-2 left-2">
                  <span className="px-2 py-1 bg-green-500 text-white rounded-lg text-[10px] font-bold shadow-md">
                    {isAffiliate ? 'ACTIF' : 'ACHETÉ'}
                  </span>
                </div>
              </div>
              
              <div className="p-3">
                <h3 className="text-sm font-bold text-gray-900 line-clamp-1 transition-colors group-hover:text-primary-600">
                  {item.product?.nameFr}
                </h3>
                
                <div className="mt-3 flex items-center justify-between pt-3 border-t border-gray-50">
                  <div>
                    <p className="text-[8px] uppercase font-bold text-gray-400 tracking-wider">Acquis le</p>
                    <p className="text-[10px] font-semibold text-gray-700">
                      {new Date(isAffiliate ? item.claimedAt : item.acquiredAt).toLocaleDateString()}
                    </p>
                  </div>
                  {!isAffiliate && (
                    <div className="text-right">
                       <p className="text-[8px] uppercase font-bold text-gray-400 tracking-wider">Qté</p>
                       <p className="text-[10px] font-bold text-primary-600">{item.quantity}</p>
                    </div>
                  )}
                </div>

                <Link 
                  to={`../product/${item.productId}`}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 bg-gray-50 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors"
                >
                  Détails
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

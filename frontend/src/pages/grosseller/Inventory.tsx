import { useQuery } from '@tanstack/react-query';
import { inventoryApi } from '../../lib/api';

export default function Inventory() {
  const { data: inventoryData, isLoading } = useQuery({
    queryKey: ['grosseller-inventory'],
    queryFn: () => inventoryApi.purchased(),
  });

  const inventory = inventoryData?.data?.data?.inventory || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventaire Acheté</h1>
          <p className="mt-1 text-sm text-gray-500">Stocks que vous avez achetés sur la plateforme.</p>
        </div>
      </div>

      <div className="card p-6 min-h-[400px]">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Chargement de l'inventaire...</div>
        ) : inventory.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {inventory.map((item: any) => (
              <div key={item.id} className="border border-gray-100 rounded-xl p-4 flex gap-4 items-center bg-gray-50 hover:bg-white transition-colors duration-200 shadow-sm hover:shadow">
                <div className="w-20 h-20 bg-white border border-gray-100 rounded-lg flex-shrink-0 p-1">
                  {item.product?.primaryImage ? (
                    <img src={item.product.primaryImage} alt="" className="w-full h-full object-cover rounded" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-300">Image</div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 line-clamp-2 leading-tight mb-1">{item.product?.nameFr}</h3>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500">
                      {item.isPendingRequest ? 'Statut' : 'Quantité'}
                    </span>
                    {item.isPendingRequest ? (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded uppercase tracking-wider">
                        En attente
                      </span>
                    ) : (
                      <span className="text-sm font-bold bg-grosseller-100 text-grosseller-800 px-2 py-0.5 rounded">
                        {item.quantity}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-500">Date</span>
                    <span className="text-xs font-medium text-gray-700">{new Date(item.acquiredAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
               <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Inventaire vide</h3>
            <p className="text-gray-500 text-sm max-w-sm mx-auto">Vous n'avez pas encore acheté de produits. Visitez le Marché Public pour garnir votre inventaire.</p>
          </div>
        )}
      </div>
    </div>
  );
}

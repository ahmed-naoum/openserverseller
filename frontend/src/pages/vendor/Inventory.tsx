import { useQuery } from '@tanstack/react-query';
import { inventoryApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

export default function VendorInventory() {
  const { user } = useAuth();
  const isAffiliate = user?.role === 'AFFILIATE';

  const { data: inventoryData, isLoading } = useQuery({
    queryKey: ['vendor-inventory', isAffiliate],
    queryFn: () => isAffiliate ? inventoryApi.claimed() : inventoryApi.purchased(),
  });

  const inventory = inventoryData?.data?.data?.inventory || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {isAffiliate ? 'Mes Produits Réclamés' : 'Mon Inventaire Acheté'}
        </h1>
      </div>

      <div className="card p-6 min-h-[400px]">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Chargement de l'inventaire...</div>
        ) : inventory.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {inventory.map((item: any) => (
              <div key={item.id} className="border border-gray-100 rounded-xl p-4 flex gap-4 items-center">
                <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0">
                  {item.product?.primaryImage ? (
                    <img src={item.product.primaryImage} alt="" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">Image</div>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{item.product?.nameFr}</h3>
                  {!isAffiliate && <p className="text-sm text-gray-500">Quantité: {item.quantity}</p>}
                  {isAffiliate && <p className="text-sm text-gray-500">Statut: <span className="text-primary-600 font-medium">{item.status}</span></p>}
                  <p className="text-xs text-gray-400 font-medium mt-1">
                    {isAffiliate ? `Réclamé le ${new Date(item.claimedAt).toLocaleDateString()}` : `Acquis le ${new Date(item.acquiredAt).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            {isAffiliate 
              ? "Vous n'avez pas encore réclamé de produits. Parcourez la marketplace pour commencer." 
              : "Vous n'avez pas encore acheté de produits. Parcourez la marketplace pour commencer."}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { inventoryApi, productsApi, payoutsApi } from '../../lib/api';
import AddProductModal from './AddProductModal';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'inventory' | 'selling' | 'payouts'>('inventory');
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);

  const { data: inventoryData, isLoading: isLoadingInventory } = useQuery({
    queryKey: ['grosseller-inventory'],
    queryFn: () => inventoryApi.purchased(),
    enabled: activeTab === 'inventory',
  });

  const { data: productsData, isLoading: isLoadingProducts, refetch: refetchProducts } = useQuery({
    queryKey: ['grosseller-products'],
    queryFn: () => productsApi.list({ myProducts: 'true', status: 'ALL' }),
    enabled: activeTab === 'selling',
  });

  const { data: payoutsData, isLoading: isLoadingPayouts } = useQuery({
    queryKey: ['grosseller-payouts'],
    queryFn: () => payoutsApi.list(),
    enabled: activeTab === 'payouts',
  });

  const inventory = inventoryData?.data?.data?.inventory || [];
  const products = productsData?.data?.data?.products || [];
  const payouts = payoutsData?.data?.data?.payouts || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord Grosseller</h1>
        <button onClick={() => setIsAddProductModalOpen(true)} className="btn-primary">
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Ajouter un Produit
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { id: 'inventory', label: 'Inventaire Acheté' },
          { id: 'selling', label: 'Mes Produits (Vente)' },
          { id: 'payouts', label: 'Paiements' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="card p-6 min-h-[400px]">
        {activeTab === 'inventory' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Mon Inventaire Acheté</h2>
            {isLoadingInventory ? (
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
                      <p className="text-sm text-gray-500">Quantité: {item.quantity}</p>
                      <p className="text-xs text-primary-600 font-medium mt-1">Acquis le {new Date(item.acquiredAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                Vous n'avez pas encore acheté de produits.
              </div>
            )}
          </div>
        )}

        {activeTab === 'selling' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Mes Produits (Proposés & En Vente)</h2>
            {isLoadingProducts ? (
              <div className="text-center py-12 text-gray-500">Chargement de vos produits...</div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product: any) => (
                  <div key={product.id} className="border border-gray-100 rounded-xl p-4 flex gap-4 items-center relative overflow-hidden">
                    <div className="absolute top-2 right-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        product.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 
                        product.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {product.status === 'APPROVED' ? 'Approuvé' : product.status === 'PENDING' ? 'En Attente' : 'Rejeté'}
                      </span>
                    </div>
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0">
                      {product.primaryImage ? (
                        <img src={product.primaryImage} alt="" className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">Image</div>
                      )}
                    </div>
                    <div className="pt-2">
                      <h3 className="font-semibold text-gray-900">{product.nameFr}</h3>
                      <p className="text-sm text-gray-500">{product.category?.nameFr}</p>
                      <p className="text-xs font-medium mt-1">Prix Détail: {product.retailPriceMad} MAD</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                Vous n'avez pas encore proposé de produits.
              </div>
            )}
          </div>
        )}

        {activeTab === 'payouts' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Historique des Paiements</h2>
              <button className="btn-primary py-1 px-3 text-sm">Demander un Paiement</button>
            </div>
            
            {isLoadingPayouts ? (
              <div className="text-center py-12 text-gray-500">Chargement des paiements...</div>
            ) : payouts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="py-2 px-4 text-sm font-medium text-gray-500">Montant</th>
                      <th className="py-2 px-4 text-sm font-medium text-gray-500">Banque & RIB</th>
                      <th className="py-2 px-4 text-sm font-medium text-gray-500">Statut</th>
                      <th className="py-2 px-4 text-sm font-medium text-gray-500">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {payouts.map((payout: any) => (
                      <tr key={payout.id}>
                        <td className="py-3 px-4 font-semibold text-gray-900">{Number(payout.amountMad).toLocaleString()} MAD</td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          <div>{payout.bankName}</div>
                          <div className="text-xs text-gray-400 font-mono">{payout.ribAccount.substring(0, 10)}...</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            payout.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                            payout.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {payout.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {new Date(payout.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                Vous n'avez aucun paiement ou retrait.
              </div>
            )}
          </div>
        )}
      </div>

      <AddProductModal 
        isOpen={isAddProductModalOpen} 
        onClose={() => setIsAddProductModalOpen(false)} 
        onSuccess={() => refetchProducts()} 
      />
    </div>
  );
}

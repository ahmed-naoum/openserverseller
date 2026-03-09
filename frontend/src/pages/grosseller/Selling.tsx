import { useQuery } from '@tanstack/react-query';
import { productsApi } from '../../lib/api';
import { useState } from 'react';

export default function Selling() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['grosseller-products-all'],
    queryFn: () => productsApi.list({ myProducts: 'true', status: 'ALL' }),
  });

  const products = productsData?.data?.data?.products || [];

  const filteredProducts = products.filter((p: any) => 
    p.nameFr.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">En Vente (Tous)</h1>
          <p className="mt-1 text-sm text-gray-500">Gérez l'ensemble de votre catalogue de produits.</p>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="relative w-72">
            <input
              type="text"
              placeholder="Rechercher par nom ou SKU..."
              className="input pl-10 focus:ring-grosseller-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Chargement de votre catalogue...</div>
        ) : filteredProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-y border-gray-200">
                  <th className="py-3 px-4 text-sm font-semibold text-gray-600">Produit</th>
                  <th className="py-3 px-4 text-sm font-semibold text-gray-600">Catégorie</th>
                  <th className="py-3 px-4 text-sm font-semibold text-gray-600">Statut</th>
                  <th className="py-3 px-4 text-sm font-semibold text-gray-600 text-right font-mono">Stock</th>
                  <th className="py-3 px-4 text-sm font-semibold text-gray-600 text-right">Votre Prix B2B</th>
                  <th className="py-3 px-4 text-sm font-semibold text-gray-600 text-right">Prix Suggéré</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((product: any) => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded bg-gray-100 flex-shrink-0">
                          {product.primaryImage ? (
                            <img src={product.primaryImage} alt="" className="w-full h-full object-cover rounded" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{product.nameFr}</p>
                          <p className="text-sm font-arabic text-gray-600" dir="rtl">{product.nameAr}</p>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">{product.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{product.category?.nameFr}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                        product.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 
                        product.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {product.status === 'APPROVED' ? 'Approuvé' : product.status === 'PENDING' ? 'En Attente' : 'Rejeté'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm font-bold text-gray-900 text-right font-mono">
                      <span className={product.stockQuantity < 10 ? 'text-red-600 bg-red-50 px-2 py-0.5 rounded' : ''}>
                        {product.stockQuantity}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm font-semibold text-gray-900 text-right">{product.baseCostMad} MAD</td>
                    <td className="py-3 px-4 text-sm text-gray-600 text-right">{product.retailPriceMad} MAD</td>
                    <td className="py-3 px-4 text-center">
                      <button className="text-grosseller-600 hover:text-grosseller-800 text-sm font-medium">Modifier</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">Aucun produit ne correspond à votre recherche.</p>
          </div>
        )}
      </div>
    </div>
  );
}

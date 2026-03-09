import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productsApi, publicApi, adminApi } from '../../lib/api';
import AddProductModal from '../grosseller/AddProductModal';

export default function AdminProducts() {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => publicApi.categories(),
  });

  const { data: vendorsData } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => adminApi.users({ role: 'VENDOR' }),
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['products', { category: selectedCategory, status: statusFilter }],
    queryFn: () => productsApi.list({ category: selectedCategory || undefined, status: statusFilter }),
  });

  const handleStatusChange = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await productsApi.updateStatus(id, { status });
      refetch();
    } catch (error) {
      console.error('Error updating product status:', error);
    }
  };

  const handleVisibilityChange = async (id: string, visibility: 'REGULAR' | 'AFFILIATE' | 'NONE') => {
    try {
      await productsApi.update(id, { visibility });
      refetch();
    } catch (error) {
      console.error('Error updating product visibility:', error);
    }
  };

  const categories = categoriesData?.data?.data?.categories || [];
  const products = data?.data?.data?.products || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produits</h1>
          <p className="text-gray-500 mt-1">{products.length} produits dans le catalogue</p>
        </div>
        <button onClick={() => setIsAddProductModalOpen(true)} className="btn-primary">+ Ajouter un produit</button>
      </div>

      {/* Filters (Category & Status) */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex bg-gray-100 p-1 rounded-lg self-start">
          {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {status === 'ALL' ? 'Tous' : status === 'PENDING' ? 'En Attente' : status === 'APPROVED' ? 'Approuvés' : 'Rejetés'}
            </button>
          ))}
        </div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedCategory('')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-colors ${
            !selectedCategory ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Tous
        </button>
        {categories.map((cat: any) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.slug)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-colors ${
              selectedCategory === cat.slug ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat.nameFr}
          </button>
        ))}
      </div>
    </div>

      {/* Products Table */}
      {isLoading ? (
        <div className="text-center py-12">Chargement...</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Produit</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">SKU</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Catégorie</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Coût</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Prix</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Statut</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((product: any) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        {product.primaryImage ? (
                          <img src={product.primaryImage} alt="" className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <span className="text-gray-400">📦</span>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{product.nameFr}</div>
                        <div className="text-xs text-gray-400">{product.nameAr}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600 font-mono text-sm">{product.sku}</td>
                  <td className="py-3 px-4 text-gray-600">{product.category?.nameFr}</td>
                  <td className="py-3 px-4 text-gray-600">{Number(product.baseCostMad).toLocaleString()} MAD</td>
                  <td className="py-3 px-4 font-medium text-gray-900">{Number(product.retailPriceMad).toLocaleString()} MAD</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      product.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 
                      product.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {product.status === 'APPROVED' ? 'Approuvé' : product.status === 'PENDING' ? 'En Attente' : 'Rejeté'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {product.status === 'PENDING' && (
                        <>
                          <button 
                            onClick={() => handleStatusChange(product.id, 'APPROVED')}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Approuver"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => handleStatusChange(product.id, 'REJECTED')}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Rejeter"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </>
                      )}
                      
                      {product.status === 'APPROVED' && product.visibility === 'REGULAR' && (
                        <button 
                          onClick={() => handleVisibilityChange(product.id, 'AFFILIATE')}
                          className="text-xs px-2 py-1 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded font-medium"
                          title="Passer en vue Affilié"
                        >
                          Push Affilié
                        </button>
                      )}
                      {product.status === 'APPROVED' && product.visibility === 'AFFILIATE' && (
                        <button 
                          onClick={() => handleVisibilityChange(product.id, 'REGULAR')}
                          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded font-medium"
                          title="Passer en vue Normale"
                        >
                          Rev. Normal
                        </button>
                      )}

                      <button className="text-primary-600 hover:text-primary-700 text-sm font-medium ml-2">Modifier</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddProductModal 
        isOpen={isAddProductModalOpen} 
        onClose={() => setIsAddProductModalOpen(false)} 
        onSuccess={() => refetch()} 
        isAdmin={true} 
        vendors={vendorsData?.data?.data?.users || []}
      />
    </div>
  );
}

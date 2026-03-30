// Product CRUD page - Admin
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productsApi, publicApi, adminApi } from '../../lib/api';
import AddProductModal from '../grosseller/AddProductModal';
import toast from 'react-hot-toast';
import { Trash2, Pencil, Package, ChevronLeft, ChevronRight } from 'lucide-react';

export default function AdminProducts() {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => publicApi.categories(),
  });

  const { data: vendorsData } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => adminApi.users({ role: 'VENDOR' }),
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['products', { category: selectedCategory, status: statusFilter, page }],
    queryFn: () => productsApi.list({ category: selectedCategory || undefined, status: statusFilter, page, limit }),
  });

  const pagination = data?.data?.data?.pagination;

  const handleStatusChange = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await productsApi.updateStatus(id, { status });
      refetch();
    } catch (error) {
      console.error('Error updating product status:', error);
    }
  };

  const handleVisibilityChange = async (id: string, visibility: string[]) => {
    try {
      await productsApi.update(id, { visibility });
      refetch();
    } catch (error) {
      console.error('Error updating product visibility:', error);
    }
  };

  const handleEdit = async (product: any) => {
    try {
      // Fetch full product with images
      const response = await productsApi.get(product.id.toString());
      const fullProduct = response.data.data.product;
      setEditingProduct(fullProduct);
    } catch (error) {
      // Fallback to the product from the list
      setEditingProduct(product);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await productsApi.delete(id);
      toast.success('Produit supprimé avec succès');
      setDeletingProductId(null);
      refetch();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const categories = categoriesData?.data?.data?.categories || [];
  const products = data?.data?.data?.products || [];

  return (
    <div className="space-y-6">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 flex items-center gap-3">
            <Package className="w-8 h-8 text-primary-600 p-1.5 bg-primary-50 rounded-lg" />
            Catalogue Produits
          </h1>
          <p className="text-sm font-medium text-gray-500 mt-2 flex items-center gap-2">
            <span>Gestion de l'inventaire global</span>
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
            <span className="text-primary-600 font-bold bg-primary-50 px-2 py-0.5 rounded-full">
              {pagination?.total || products.length || 0} produits trouvés
            </span>
          </p>
        </div>
        <button 
          onClick={() => setIsAddProductModalOpen(true)} 
          className="btn-primary shadow-lg shadow-primary-500/30 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl hover:scale-[1.02] transition-transform"
        >
          <span className="text-xl leading-none">+</span>
          Ajouter un produit
        </button>
      </div>

      {/* Filters Container */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex flex-col xl:flex-row gap-2 justify-between items-start xl:items-center">
        {/* Status Pills */}
        <div className="flex p-1 bg-gray-50/80 backdrop-blur-sm rounded-xl border border-gray-200/60 overflow-x-auto max-w-full">
          {[
            { id: 'ALL', label: 'Tous', icon: '📦' }, 
            { id: 'PENDING', label: 'En Attente', icon: '⏳' }, 
            { id: 'APPROVED', label: 'Approuvés', icon: '✅' }, 
            { id: 'REJECTED', label: 'Rejetés', icon: '❌' }
          ].map((status) => (
            <button
              key={status.id}
              onClick={() => {
                setStatusFilter(status.id);
                setPage(1);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                statusFilter === status.id
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50 scale-100'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50 scale-95 opacity-80 hover:opacity-100'
              }`}
            >
              <span>{status.icon}</span>
              {status.label}
            </button>
          ))}
        </div>

        {/* Categories Scroller */}
        <div className="flex gap-2 overflow-x-auto w-full xl:w-auto p-1 scrollbar-hide">
          <button
            onClick={() => {
              setSelectedCategory('');
              setPage(1);
            }}
            className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-bold transition-all border ${
              !selectedCategory 
                ? 'bg-primary-600 text-white border-primary-500 shadow-md shadow-primary-500/20' 
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            Toutes les catégories
          </button>
          {categories.map((cat: any) => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.slug);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-bold transition-all border ${
                selectedCategory === cat.slug 
                  ? 'bg-primary-600 text-white border-primary-500 shadow-md shadow-primary-500/20' 
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
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
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Visibilité</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Statut</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((product: any) => (
                <tr key={product.id} className="hover:bg-gray-50/80 transition-colors group">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 relative group-hover:shadow-md transition-shadow">
                        {product.primaryImage ? (
                          <img src={product.primaryImage} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Package size={20} className="text-gray-300" />
                        )}
                        <div className="absolute inset-0 ring-1 ring-inset ring-black/5 rounded-xl"></div>
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 truncate pr-4 text-sm">{product.nameFr}</div>
                        <div className="text-xs font-medium text-gray-500 truncate pr-4 mt-0.5" dir="auto">{product.nameAr}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-gray-100 text-gray-600 border border-gray-200/60">
                      {product.sku}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {product.categories && product.categories.length > 0 ? (
                        product.categories.map((c: any, idx: number) => (
                          <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100/50">
                            {c.nameFr}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400 font-medium italic">Non classé</span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-sm font-bold text-gray-900">{Number(product.baseCostMad).toLocaleString()} <span className="text-[10px] font-bold text-gray-400 uppercase">MAD</span></div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-sm font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded-lg inline-block border border-primary-100/50">
                      {Number(product.retailPriceMad).toLocaleString()} <span className="text-[10px] font-bold uppercase">MAD</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex gap-1 flex-wrap">
                      {product.visibility?.map((vis: string) => (
                        <span key={vis} className={`px-2 py-1 text-xs font-semibold rounded-full shadow-sm border ${vis === 'REGULAR' ? 'bg-blue-50 text-blue-700 border-blue-200' : vis === 'AFFILIATE' ? 'bg-purple-50 text-purple-700 border-purple-200' : vis === 'INFLUENCER' ? 'bg-pink-50 text-pink-700 border-pink-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                          {vis}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                      product.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-200' : 
                      product.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        product.status === 'APPROVED' ? 'bg-green-500' : 
                        product.status === 'PENDING' ? 'bg-amber-500' : 'bg-red-500'
                      }`}></span>
                      {product.status === 'APPROVED' ? 'Approuvé' : product.status === 'PENDING' ? 'En Attente' : 'Rejeté'}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                      {product.status === 'PENDING' && (
                        <>
                          <button 
                            onClick={() => handleStatusChange(product.id, 'APPROVED')}
                            className="p-1.5 text-green-600 bg-green-50 hover:bg-green-100 hover:text-green-700 rounded-lg shadow-sm border border-transparent hover:border-green-200 transition-all"
                            title="Approuver"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => handleStatusChange(product.id, 'REJECTED')}
                            className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 hover:text-red-700 rounded-lg shadow-sm border border-transparent hover:border-red-200 transition-all"
                            title="Rejeter"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                          <div className="w-px h-6 bg-gray-200 mx-1"></div>
                        </>
                      )}
                      

                      <button 
                        onClick={() => handleEdit(product)}
                        className="p-1.5 text-gray-500 bg-gray-50 hover:bg-amber-50 hover:text-amber-600 border border-transparent hover:border-amber-200 rounded-lg transition-all"
                        title="Modifier"
                      >
                        <Pencil size={16} />
                      </button>

                      <button 
                        onClick={() => setDeletingProductId(product.id)}
                        className="p-1.5 text-gray-500 bg-gray-50 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-200 rounded-lg transition-all"
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Pagination Controls */}
          {pagination && pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-white">
              <span className="text-sm text-gray-500">
                Page <span className="font-medium text-gray-900">{pagination.page}</span> sur <span className="font-medium text-gray-900">{pagination.totalPages}</span>
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={pagination.page === 1}
                  className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={pagination.page === pagination.totalPages}
                  className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Product Modal */}
      <AddProductModal 
        isOpen={isAddProductModalOpen || !!editingProduct} 
        onClose={() => {
          setIsAddProductModalOpen(false);
          setEditingProduct(null);
        }} 
        onSuccess={() => refetch()} 
        isAdmin={true} 
        vendors={vendorsData?.data?.data?.users || []}
        editProduct={editingProduct}
      />

      {/* Delete Confirmation Modal */}
      {deletingProductId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeletingProductId(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <Trash2 size={24} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Supprimer ce produit ?</h3>
              <p className="text-sm text-gray-500 mb-6">
                Cette action est irréversible. Le produit et toutes ses images seront définitivement supprimés.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setDeletingProductId(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-gray-600 font-semibold bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleDelete(deletingProductId)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-white font-semibold bg-red-600 hover:bg-red-700 transition-colors"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

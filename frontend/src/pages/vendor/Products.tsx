import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productsApi, publicApi } from '../../lib/api';

export default function VendorProducts() {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [search, setSearch] = useState('');

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => publicApi.categories(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['products', { category: selectedCategory, search }],
    queryFn: () => productsApi.list({ category: selectedCategory, search }),
  });

  const categories = categoriesData?.data?.data?.categories || [];
  const products = data?.data?.data?.products || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catalogue Produits</h1>
          <p className="text-gray-500 mt-1">+200 produits personnalisables</p>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            className="input w-64"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Categories Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
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

      {/* Products Grid */}
      {isLoading ? (
        <div className="text-center py-12">Chargement...</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product: any) => (
            <div key={product.id} className="card-hover overflow-hidden group">
              <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center relative">
                {product.primaryImage ? (
                  <img src={product.primaryImage} alt={product.nameFr} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl opacity-50">📦</span>
                )}
                {product.isCustomizable && (
                  <span className="absolute top-2 right-2 badge-primary">Personnalisable</span>
                )}
              </div>
              <div className="p-4">
                <div className="text-xs text-primary-600 font-medium mb-1">{product.category?.nameFr}</div>
                <h3 className="font-semibold text-gray-900 mb-1">{product.nameFr}</h3>
                <p className="text-xs text-gray-500 mb-2 line-clamp-2">{product.description}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-lg font-bold text-gray-900">{Number(product.retailPriceMad).toLocaleString()} MAD</span>
                    <span className="text-xs text-gray-400 block">Prix de vente suggéré</span>
                  </div>
                  <button className="btn-primary btn-sm">Personnaliser</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { productsApi, marketplaceApi } from '../../lib/api';
import toast from 'react-hot-toast';

export default function PublicMarketplace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = searchParams.get('view') === 'affiliate' ? 'affiliate' : 'regular';
  const [viewMode, setViewMode] = useState<'regular' | 'affiliate'>(initialView);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [viewMode]);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const res = await marketplaceApi.products({ 
        view: viewMode === 'regular' ? 'REGULAR' : 'AFFILIATE',
        limit: 100 
      });
      setProducts(res.data.data.products || []);
    } catch (error: any) {
      toast.error('Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewChange = (view: 'regular' | 'affiliate') => {
    setViewMode(view);
    setSearchParams({ view });
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Marketplace</h1>
            <p className="mt-1 text-gray-500">Découvrez les produits disponibles sur la plateforme.</p>
          </div>

          {/* View Switcher */}
          <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 p-1">
            <button
              onClick={() => handleViewChange('regular')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'regular' 
                  ? 'bg-primary-50 text-primary-700' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Régulier
            </button>
            <button
              onClick={() => handleViewChange('affiliate')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'affiliate' 
                  ? 'bg-primary-50 text-primary-700' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Affiliés
            </button>
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
           {isLoading ? (
             <div className="col-span-full py-20 text-center">
               <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
             </div>
           ) : products.length > 0 ? (
             products.map((product) => (
               <Link to={`/product/${product.id}`} key={product.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition">
                 <div className="aspect-square bg-gray-100 flex-shrink-0">
                   {product.primaryImage ? (
                     <img src={product.primaryImage} alt={product.nameFr} className="w-full h-full object-cover" />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center text-gray-400 font-medium">Pas d'image</div>
                   )}
                 </div>
                 <div className="p-4">
                   <h3 className="font-semibold text-gray-900 truncate">{product.nameFr}</h3>
                   <div className="mt-2 flex items-center justify-between">
                     <span className="text-primary-600 font-bold">{product.retailPriceMad} MAD</span>
                   </div>
                 </div>
               </Link>
             ))
           ) : (
             <div className="col-span-full py-20 text-center">
               <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
               </div>
               <p className="text-gray-500">
                 Aucun produit {viewMode === 'regular' ? 'régulier' : 'affilié'} trouvé.
               </p>
             </div>
           )}
        </div>

      </div>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { productsApi } from '../../lib/api';

export default function Approved() {
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['grosseller-products-approved'],
    queryFn: () => productsApi.list({ myProducts: 'true', status: 'APPROVED' }),
  });

  const products = productsData?.data?.data?.products || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produits Approuvés</h1>
          <p className="mt-1 text-sm text-gray-500">Vos produits actifs et validés actuellement disponibles sur le marché.</p>
        </div>
      </div>

      <div className="card p-6 min-h-[400px]">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Chargement...</div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
             {products.map((product: any) => (
                <div key={product.id} className="group border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-all">
                  <div className="h-48 bg-gray-100 relative overflow-hidden">
                    {product.primaryImage ? (
                      <img src={product.primaryImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 px-2.5 py-1 text-xs font-bold rounded-full bg-green-500 text-white shadow-sm">
                      Actif
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-gray-900 line-clamp-1 group-hover:text-grosseller-600 transition-colors">{product.nameFr}</h3>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.description}</p>
                    
                    <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-sm">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500">Coût B2B</span>
                        <span className="font-bold text-gray-900">{product.baseCostMad} MAD</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-xs text-gray-500">Prix Détail</span>
                        <span className="font-bold text-grosseller-600">{product.retailPriceMad} MAD</span>
                      </div>
                    </div>
                  </div>
                </div>
             ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="mx-auto w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Aucun produit approuvé</h3>
            <p className="text-gray-500">Ajoutez des produits pour qu'ils soient validés par l'administration.</p>
          </div>
        )}
      </div>
    </div>
  );
}

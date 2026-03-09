import { useQuery } from '@tanstack/react-query';
import { productsApi } from '../../lib/api';

export default function Pending() {
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['grosseller-products-pending'],
    queryFn: () => productsApi.list({ myProducts: 'true', status: 'PENDING' }),
  });

  const products = productsData?.data?.data?.products || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">En Attente d'Approbation</h1>
          <p className="mt-1 text-sm text-gray-500">Produits ajoutés qui attendent l'examen de l'administration.</p>
        </div>
      </div>

      <div className="card p-6 min-h-[400px]">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Chargement...</div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {products.map((product: any) => (
                <div key={product.id} className="border border-yellow-200 rounded-xl overflow-hidden shadow-sm hover:shadow transition-shadow bg-yellow-50/30">
                  <div className="h-40 bg-gray-100 relative">
                    {product.primaryImage ? (
                      <img src={product.primaryImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 px-2.5 py-1 text-xs font-bold rounded-full bg-yellow-100 text-yellow-800 shadow-sm border border-yellow-200">
                      En Attente
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex justify-between items-start gap-2">
                       <h3 className="font-bold text-gray-900 line-clamp-1 flex-1">{product.nameFr}</h3>
                       <h3 className="font-bold text-gray-900 line-clamp-1 flex-1 text-right font-arabic" dir="rtl">{product.nameAr}</h3>
                    </div>
                    <p className="text-xs text-gray-500 font-mono mt-1">{product.sku}</p>
                    <div className="mt-1 pb-2">
                       <span className="text-[10px] font-bold text-grosseller-600 bg-grosseller-50 px-2 py-0.5 rounded uppercase tracking-wider uppercase">
                         {product.category?.nameFr || 'SANS CATÉGORIE'}
                       </span>
                    </div>
                    
                    <div className="mt-4 flex justify-between items-center text-sm">
                      <span className="text-gray-500">Prix B2B</span>
                      <span className="font-bold text-gray-900">{product.baseCostMad} MAD</span>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-yellow-200/50 flex gap-2">
                       <div className="flex-1 text-center py-2 text-xs font-medium text-yellow-700 bg-yellow-100/50 rounded flex items-center justify-center gap-2">
                         <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                         Analyse par l'équipe
                       </div>
                    </div>
                  </div>
                </div>
             ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Aucun produit en attente</h3>
            <p className="text-gray-500">Super ! Tous vos produits ont été traités.</p>
          </div>
        )}
      </div>
    </div>
  );
}

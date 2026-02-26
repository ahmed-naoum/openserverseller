import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi, brandsApi } from '../../lib/api';
import BrandDesigner from '../../components/brand/BrandDesigner';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../utils';

export default function ProductCustomizePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [showDesigner, setShowDesigner] = useState(false);
  const [designData, setDesignData] = useState<any>(null);

  const { data: productData, isLoading: productLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productsApi.get(id!),
    enabled: !!id,
  });

  const { data: brandsData } = useQuery({
    queryKey: ['brands'],
    queryFn: () => brandsApi.list(),
  });

  const product = productData?.data?.data?.product;
  const brands = brandsData?.data?.data?.brands || [];

  const customizeMutation = useMutation({
    mutationFn: (data: any) => productsApi.customize(id!, data),
    onSuccess: () => {
      toast.success('Personnalisation sauvegardée!');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate('/dashboard/products');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur');
    },
  });

  const handleSaveDesign = (data: any) => {
    setDesignData(data);
    setShowDesigner(false);
  };

  const handleSave = () => {
    if (!selectedBrandId) {
      toast.error('Veuillez sélectionner une marque');
      return;
    }

    customizeMutation.mutate({
      brandId: selectedBrandId,
      customPriceMad: customPrice ? parseFloat(customPrice) : null,
      designData,
    });
  };

  if (productLoading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  if (!product) {
    return <div className="text-center py-12 text-gray-500">Produit non trouvé</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{product.nameFr}</h1>
          <p className="text-gray-500 mt-1">{product.category?.nameFr}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(product.retailPriceMad)}</div>
          <div className="text-sm text-gray-500">Prix de vente suggéré</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Product Info */}
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
              {product.images?.[0]?.imageUrl ? (
                <img src={product.images[0].imageUrl} alt={product.nameFr} className="w-full h-full object-cover" />
              ) : (
                <span className="text-6xl opacity-50">📦</span>
              )}
            </div>
            <div className="p-5">
              <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
              <p className="text-gray-600 text-sm">{product.description || 'Aucune description'}</p>
              
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                <div>
                  <div className="text-xs text-gray-500">Coût de base</div>
                  <div className="font-semibold text-gray-900">{formatCurrency(product.baseCostMad)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Délai de production</div>
                  <div className="font-semibold text-gray-900">{product.minProductionDays} jours</div>
                </div>
              </div>
            </div>
          </div>

          {/* Variants */}
          {product.variants?.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Variantes disponibles</h3>
              <div className="space-y-2">
                {product.variants.map((variant: any) => (
                  <div key={variant.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <span className="text-gray-700">{variant.variantName}</span>
                    <div className="text-right">
                      <span className="text-gray-500 text-sm">Stock: {variant.stockQuantity}</span>
                      {Number(variant.priceAdjustmentMad) > 0 && (
                        <span className="text-orange-600 text-sm ml-2">
                          +{formatCurrency(variant.priceAdjustmentMad)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Customization */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Personnalisation</h3>
            
            <div className="space-y-4">
              {/* Brand Selection */}
              <div>
                <label className="label">Sélectionner votre marque</label>
                <select
                  className="input"
                  value={selectedBrandId}
                  onChange={(e) => setSelectedBrandId(e.target.value)}
                >
                  <option value="">Choisir une marque</option>
                  {brands.map((brand: any) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Price */}
              <div>
                <label className="label">Prix de vente personnalisé (MAD)</label>
                <input
                  type="number"
                  className="input"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder={product.retailPriceMad.toString()}
                  min={Number(product.baseCostMad)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Laissez vide pour utiliser le prix suggéré de {formatCurrency(product.retailPriceMad)}
                </p>
              </div>

              {/* Packaging Design */}
              {product.isCustomizable && (
                <div>
                  <label className="label">Design du packaging</label>
                  {designData ? (
                    <div className="border border-gray-200 rounded-lg p-4">
                      <img
                        src={designData.previewImage}
                        alt="Design preview"
                        className="w-32 h-32 object-contain mx-auto mb-3"
                      />
                      <button
                        onClick={() => setShowDesigner(true)}
                        className="btn-secondary w-full btn-sm"
                      >
                        Modifier le design
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowDesigner(true)}
                      className="btn-outline w-full h-32 flex flex-col items-center justify-center gap-2"
                    >
                      <span className="text-2xl">🎨</span>
                      <span>Créer un design</span>
                    </button>
                  )}
                </div>
              )}

              {/* Profit Calculator */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-800 mb-2">Estimation des gains</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-700">Prix de vente:</span>
                    <span className="font-semibold text-green-800">
                      {formatCurrency(customPrice || product.retailPriceMad)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Coût:</span>
                    <span className="text-green-600">-{formatCurrency(product.baseCostMad)}</span>
                  </div>
                  <div className="flex justify-between border-t border-green-200 pt-2">
                    <span className="text-green-800 font-semibold">Marge estimée:</span>
                    <span className="font-bold text-green-800">
                      {formatCurrency(
                        Number(customPrice || product.retailPriceMad) - Number(product.baseCostMad)
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSave}
                className="btn-primary w-full"
                disabled={!selectedBrandId || customizeMutation.isPending}
              >
                {customizeMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder la personnalisation'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Brand Designer Modal */}
      {showDesigner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-4xl w-full my-8">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Designer de Packaging</h2>
              <button
                onClick={() => setShowDesigner(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <BrandDesigner
                onSave={handleSaveDesign}
                primaryColor={brands.find((b: any) => b.id === selectedBrandId)?.primaryColor}
                logoUrl={brands.find((b: any) => b.id === selectedBrandId)?.logoUrl}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

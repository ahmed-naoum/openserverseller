import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { productsApi, publicApi, uploadApi } from '../../lib/api';
import toast from 'react-hot-toast';

export default function AddProduct() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    sku: '',
    nameFr: '',
    nameAr: '',
    description: '',
    categoryId: '',
    baseCostMad: '',
    retailPriceMad: '',
    stockQuantity: '',
    minProductionDays: '3',
    visibility: ['REGULAR'] as string[],
    videoUrlsInput: '',
    landingPageUrlsInput: '',
  });

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => publicApi.categories(),
  });

  const categories = categoriesData?.data?.data?.categories || [];

  const handleNext = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      let imageUrl = null;
      if (imageFile) {
        const uploadData = new FormData();
        uploadData.append('file', imageFile);
        const uploadRes = await uploadApi.image(uploadData);
        imageUrl = uploadRes.data.data.url;
      }

      await productsApi.create({
        ...formData,
        categoryIds: [Number(formData.categoryId)],
        baseCostMad: Number(formData.baseCostMad),
        retailPriceMad: Number(formData.retailPriceMad),
        stockQuantity: Number(formData.stockQuantity),
        minProductionDays: Number(formData.minProductionDays),
        imageUrl: imageUrl,
        videoUrls: formData.videoUrlsInput.split('\n').map(u => u.trim()).filter(Boolean),
        landingPageUrls: formData.landingPageUrlsInput.split('\n').map(u => u.trim()).filter(Boolean),
      });

      toast.success('Produit ajouté avec succès. En attente d\'approbation.');
      navigate('/grosseller/pending');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la création du produit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Ajouter un produit</h1>
        <button onClick={() => navigate('/grosseller')} className="text-gray-500 hover:text-gray-700 font-medium text-sm">
          Fermer
        </button>
      </div>

      <div className="card p-8">
        {/* Progress Tracker */}
        <div className="flex items-center justify-between mb-8 relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-100 rounded-full z-0"></div>
          <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-grosseller-500 transition-all duration-300 z-0"
            style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
          ></div>
          
          {[
            { step: 1, label: 'Informations' },
            { step: 2, label: 'Prix & Stock' },
            { step: 3, label: 'Images' }
          ].map(({ step, label }) => (
            <div key={step} className="relative z-10 flex flex-col items-center gap-2 bg-white px-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                currentStep >= step ? 'bg-grosseller-500 text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {step}
              </div>
              <span className={`text-xs font-medium ${currentStep >= step ? 'text-gray-900' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Step 1: Base Info */}
        {currentStep === 1 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-lg font-bold text-gray-900">Informations de base</h2>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="label">Nom (Français) *</label>
                <input
                  type="text"
                  required
                  className="input focus:ring-grosseller-500 focus:border-grosseller-500"
                  value={formData.nameFr}
                  onChange={(e) => setFormData({ ...formData, nameFr: e.target.value })}
                  placeholder="Ex: T-shirt en coton"
                />
              </div>
              <div>
                <label className="label">Nom (Arabe) *</label>
                <input
                  type="text"
                  required
                  dir="rtl"
                  className="input focus:ring-grosseller-500 focus:border-grosseller-500"
                  value={formData.nameAr}
                  onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                  placeholder="Ex: قميص قطني"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="label">Référence SKU *</label>
                <input
                  type="text"
                  required
                  className="input focus:ring-grosseller-500 focus:border-grosseller-500"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="Ex: TSHIRT-WHT-M"
                />
              </div>
              <div>
                <label className="label">Catégorie *</label>
                <select
                  required
                  className="input focus:ring-grosseller-500 focus:border-grosseller-500"
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                >
                  <option value="" disabled>Sélectionner une catégorie</option>
                  {!categoriesLoading && categories.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>{cat.nameFr}</option>
                  ))}
                </select>
                {!categoriesLoading && categories.length === 0 && (
                  <p className="text-xs text-amber-500 mt-1">Aucune catégorie disponible.</p>
                )}
              </div>
            </div>

            <div>
              <label className="label">Description du produit *</label>
              <textarea
                required
                rows={4}
                className="input focus:ring-grosseller-500 focus:border-grosseller-500"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Détaillez les caractéristiques, la matière..."
              ></textarea>
            </div>
          </div>
        )}

        {/* Step 2: Pricing & Stock */}
        {currentStep === 2 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-lg font-bold text-gray-900 border-b pb-2">Tarification B2B</h2>
            
            <div className="grid grid-cols-2 gap-5 bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div>
                <label className="label">Votre Coût de Base (MAD) *</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="1"
                    className="input pl-12 focus:ring-grosseller-500 focus:border-grosseller-500"
                    value={formData.baseCostMad}
                    onChange={(e) => setFormData({ ...formData, baseCostMad: e.target.value })}
                    placeholder="Ex: 50"
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">MAD</div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Le prix que le vendeur paie pour acheter votre stock.</p>
              </div>
              <div>
                <label className="label">Prix de Détail Suggéré (MAD) *</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="1"
                    className="input pl-12 focus:ring-grosseller-500 focus:border-grosseller-500"
                    value={formData.retailPriceMad}
                    onChange={(e) => setFormData({ ...formData, retailPriceMad: e.target.value })}
                    placeholder="Ex: 150"
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">MAD</div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Le prix conseillé pour le client final.</p>
              </div>
            </div>

            <h2 className="text-lg font-bold text-gray-900 border-b pb-2 pt-4">Stock & Logistique</h2>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="label">Quantité Initiale en Stock *</label>
                <input
                  type="number"
                  required
                  min="0"
                  className="input focus:ring-grosseller-500 focus:border-grosseller-500"
                  value={formData.stockQuantity}
                  onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                  placeholder="Ex: 500"
                />
              </div>
              <div>
                <label className="label">Jours de production min.</label>
                <input
                  type="number"
                  min="1"
                  className="input focus:ring-grosseller-500 focus:border-grosseller-500"
                  value={formData.minProductionDays}
                  onChange={(e) => setFormData({ ...formData, minProductionDays: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Images & Media */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-lg font-bold text-gray-900 border-b pb-2">Images & Médias</h2>
            
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 hover:bg-gray-50 transition-colors">
              {imagePreview ? (
                <div className="relative w-48 h-48 mb-4">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded-lg shadow-sm" />
                  <button 
                    onClick={() => { setImageFile(null); setImagePreview(null); }}
                    className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ) : (
                <>
                  <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <label className="bg-grosseller-50 text-grosseller-700 font-medium px-4 py-2 rounded-lg cursor-pointer hover:bg-grosseller-100 transition-colors">
                    Sélectionner une image
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                  </label>
                  <p className="mt-2 text-xs text-gray-500">PNG, JPG ou WEBP. Max 5MB.</p>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-5 mt-6">
              <div>
                <label className="label">Liens Vidéos (Un par ligne)</label>
                <textarea
                  rows={3}
                  className="input focus:ring-grosseller-500 focus:border-grosseller-500"
                  value={formData.videoUrlsInput}
                  onChange={(e) => setFormData({ ...formData, videoUrlsInput: e.target.value })}
                  placeholder="https://youtube.com/watch?v=...&#10;https://vimeo.com/..."
                ></textarea>
                <p className="text-xs text-gray-500 mt-1">Ajoutez des liens YouTube, Vimeo ou mp4.</p>
              </div>
              <div>
                <label className="label">Pages de Vente (Un par ligne)</label>
                <textarea
                  rows={3}
                  className="input focus:ring-grosseller-500 focus:border-grosseller-500"
                  value={formData.landingPageUrlsInput}
                  onChange={(e) => setFormData({ ...formData, landingPageUrlsInput: e.target.value })}
                  placeholder="https://monsite.com/produit&#10;https://monlandingpage.com"
                ></textarea>
                <p className="text-xs text-gray-500 mt-1">Ajoutez des liens vers vos pages de vente externes.</p>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3 mt-6">
              <svg className="w-5 h-5 text-yellow-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div>
                <h4 className="font-medium text-yellow-800 text-sm">Prêt à soumettre</h4>
                <p className="text-yellow-700 text-xs mt-1">Une fois soumis, ce produit sera en attente d'approbation par les administrateurs avant d'être visible sur le Marché Public.</p>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-between items-center mt-10 pt-6 border-t border-gray-100">
          <button
            onClick={handlePrev}
            disabled={currentStep === 1 || loading}
            className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 disabled:opacity-0 transition-all"
          >
            Précédent
          </button>
          
          {currentStep < 3 ? (
            <button
              onClick={handleNext}
              className="px-5 py-2.5 rounded-lg bg-grosseller-600 text-white font-medium hover:bg-grosseller-700 transition-colors"
            >
              Étape Suivante
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading || !formData.nameFr || !formData.categoryId || !formData.baseCostMad}
              className="px-6 py-2.5 rounded-lg bg-grosseller-600 text-white font-bold hover:bg-grosseller-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Traitement...
                </>
              ) : (
                'Soumettre pour Approbation'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

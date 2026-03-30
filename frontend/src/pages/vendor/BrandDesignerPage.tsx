import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { brandsApi } from '../../lib/api';
import BrandDesigner from '../../components/brand/BrandDesigner';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';

export default function BrandDesignerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    slogan: '',
    description: '',
    primaryColor: '#2c2f74',
    secondaryColor: '#f26342',
    logoUrl: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [step, setStep] = useState(1);
  const [designData, setDesignData] = useState<any>(null);

  const { data: existingBrand } = useQuery({
    queryKey: ['brand', id],
    queryFn: () => brandsApi.get(id!),
    enabled: !!id,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => brandsApi.create(data),
    onSuccess: (response) => {
      toast.success('Marque créée!');
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      navigate('/dashboard/brands');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur');
    },
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('L\'image doit faire moins de 5MB');
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setFormData({ ...formData, logoUrl: event.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleDesignSave = (data: any) => {
    setDesignData(data);
    setStep(3);
  };

  const handleSubmit = () => {
    createMutation.mutate({
      ...formData,
      designSettings: designData,
    });
  };

  const colorPresets = [
    { primary: '#2c2f74', secondary: '#f26342', name: 'SILACOD' },
    { primary: '#3b82f6', secondary: '#2563eb', name: 'Bleu' },
    { primary: '#8b5cf6', secondary: '#7c3aed', name: 'Violet' },
    { primary: '#ef4444', secondary: '#dc2626', name: 'Rouge' },
    { primary: '#f59e0b', secondary: '#d97706', name: 'Orange' },
    { primary: '#ec4899', secondary: '#db2777', name: 'Rose' },
    { primary: '#06b6d4', secondary: '#0891b2', name: 'Cyan' },
    { primary: '#1f2937', secondary: '#111827', name: 'Noir' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                step >= s ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}
            >
              {s}
            </div>
            {s < 3 && (
              <div
                className={`w-24 h-1 ${step > s ? 'bg-primary-500' : 'bg-gray-200'}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <div className="card p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Informations de base</h2>
          <div className="space-y-5">
            <div>
              <label className="label">Nom de la marque *</label>
              <input
                type="text"
                className="input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: BeautyCare Ma"
                maxLength={50}
              />
            </div>

            <div>
              <label className="label">Logo</label>
              <div className="flex items-center gap-4">
                <div
                  className="w-20 h-20 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 overflow-hidden"
                  style={{ backgroundColor: formData.primaryColor }}
                >
                  {formData.logoUrl ? (
                    <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-white text-2xl font-bold">
                      {formData.name.charAt(0) || '?'}
                    </span>
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    id="logo-upload"
                  />
                  <label htmlFor="logo-upload" className="btn-secondary cursor-pointer">
                    Uploader un logo
                  </label>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG, max 5MB</p>
                </div>
              </div>
            </div>

            <div>
              <label className="label">Slogan</label>
              <input
                type="text"
                className="input"
                value={formData.slogan}
                onChange={(e) => setFormData({ ...formData, slogan: e.target.value })}
                placeholder="Ex: Votre beauté, notre priorité"
                maxLength={100}
              />
            </div>

            <div>
              <label className="label">Description</label>
              <textarea
                className="input"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Décrivez votre marque..."
                maxLength={500}
              />
            </div>

            <div>
              <label className="label">Couleurs de la marque</label>
              <div className="grid grid-cols-4 gap-3 mb-3">
                {colorPresets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        primaryColor: preset.primary,
                        secondaryColor: preset.secondary,
                      });
                    }}
                    className={`p-2 rounded-lg border-2 transition-colors ${
                      formData.primaryColor === preset.primary
                        ? 'border-gray-900'
                        : 'border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full"
                        style={{ backgroundColor: preset.primary }}
                      />
                      <span className="text-sm text-gray-600">{preset.name}</span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-500">Primaire</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      className="input flex-1"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500">Secondaire</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.secondaryColor}
                      onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      className="input flex-1"
                      value={formData.secondaryColor}
                      onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={() => setStep(2)}
                className="btn-primary"
                disabled={!formData.name}
              >
                Continuer vers le Designer →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Brand Designer */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setStep(1)} className="btn-ghost">
              ← Retour
            </button>
            <h2 className="text-xl font-bold text-gray-900">Designer de Packaging</h2>
            <div />
          </div>
          <BrandDesigner
            onSave={handleDesignSave}
            primaryColor={formData.primaryColor}
            secondaryColor={formData.secondaryColor}
            logoUrl={formData.logoUrl}
          />
        </div>
      )}

      {/* Step 3: Review & Submit */}
      {step === 3 && (
        <div className="card p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Révision & Soumission</h2>
          
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Informations</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Nom:</span>
                  <span className="font-medium">{formData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Slogan:</span>
                  <span className="font-medium">{formData.slogan || '-'}</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Design</h3>
              {designData?.previewImage && (
                <img
                  src={designData.previewImage}
                  alt="Preview"
                  className="w-32 h-32 object-contain rounded-lg border"
                />
              )}
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Votre marque sera soumise pour approbation. 
              Vous pourrez commencer à personnaliser des produits une fois approuvée.
            </p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="btn-secondary flex-1">
              Modifier le Design
            </button>
            <button
              onClick={handleSubmit}
              className="btn-primary flex-1"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Création...' : 'Créer la marque'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

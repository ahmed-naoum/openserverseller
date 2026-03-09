import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productsApi, publicApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, 
  Truck, 
  ShieldCheck, 
  X, 
  Info, 
  DollarSign, 
  Layers,
  Image as ImageIcon,
  User
} from 'lucide-react';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isAdmin?: boolean;
  vendors?: any[];
}

export default function AddProductModal({ isOpen, onClose, onSuccess, isAdmin = false, vendors = [] }: AddProductModalProps) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const initialFormData = {
    sku: '',
    nameFr: '',
    nameAr: '',
    description: '',
    categoryId: '',
    baseCostMad: '',
    retailPriceMad: '',
    visibility: isAdmin ? 'REGULAR' : 'REGULAR',
    ownerId: '',
    imageUrl: '',
    stockQuantity: '0',
    minProductionDays: '3',
  };

  const [formData, setFormData] = useState(initialFormData);

  const resetForm = () => {
    setFormData(initialFormData);
    setStep(1);
  };

  const totalSteps = isAdmin ? 3 : 2;

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => publicApi.categories(),
  });

  const categories = categoriesData?.data?.data?.categories || [];

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < totalSteps) {
      handleNext();
      return;
    }

    try {
      setLoading(true);
      await productsApi.create({
        ...formData,
        categoryId: Number(formData.categoryId),
        baseCostMad: Number(formData.baseCostMad),
        retailPriceMad: Number(formData.retailPriceMad),
        ownerId: formData.ownerId ? Number(formData.ownerId) : undefined,
        stockQuantity: Number(formData.stockQuantity),
        minProductionDays: Number(formData.minProductionDays),
      });
      toast.success('Produit créé avec succès.');
      resetForm();
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la création du produit');
    } finally {
      setLoading(false);
    }
  };

  const handleNumericFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const SectionHeader = ({ icon: Icon, title, isAdminOnly = false, currentStep, maxSteps }: { icon: any, title: string, isAdminOnly?: boolean, currentStep: number, maxSteps: number }) => (
    <div className="space-y-4 mb-8">
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-2 pb-2 border-b ${isAdminOnly ? 'border-primary-100' : 'border-gray-100'}`}>
          <div className={`p-1.5 rounded-lg ${isAdminOnly ? 'bg-primary-50 text-primary-600' : 'bg-gray-50 text-gray-500'}`}>
            <Icon size={18} />
          </div>
          <h3 className={`text-sm font-bold uppercase tracking-wider ${isAdminOnly ? 'text-primary-700' : 'text-gray-600'}`}>
            {title}
          </h3>
        </div>
        <span className="text-xs font-bold text-gray-400">Étape {currentStep} / {maxSteps}</span>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col z-10"
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-200">
                    <Package size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-gray-900">Nouveau Produit</h2>
                    <p className="text-xs text-gray-500 font-medium">Configuration du catalogue</p>
                  </div>
                </div>
                <button 
                  onClick={onClose} 
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-xl transition-colors shadow-sm border border-transparent hover:border-gray-100"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Progress Bar */}
              <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(step / totalSteps) * 100}%` }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="h-full bg-primary-600"
                />
              </div>
            </div>

            <form id="addProductForm" onSubmit={handleSubmit} className="flex flex-col h-full">
              <div className="p-8 min-h-[420px] overflow-y-auto">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-6"
                  >
                    <SectionHeader icon={Info} title="Informations Générales" currentStep={1} maxSteps={totalSteps} />
                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="label">Nom (Français)</label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: Huile d'Argan Bio"
                          className="input"
                          value={formData.nameFr}
                          onChange={(e) => setFormData({ ...formData, nameFr: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5 text-right">
                        <label className="label">الاسم (بالعربية)</label>
                        <input
                          type="text"
                          dir="rtl"
                          required
                          placeholder="أرغان طبيعي"
                          className="input text-right font-arabic"
                          value={formData.nameAr}
                          onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="label">SKU (Référence)</label>
                        <input
                          type="text"
                          required
                          placeholder="REF-001"
                          className="input font-mono uppercase"
                          value={formData.sku}
                          onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="label">Catégorie</label>
                        <select
                          required
                          className="input appearance-none bg-no-repeat bg-[right_1rem_center]"
                          value={formData.categoryId}
                          onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                        >
                          <option value="">Choisir...</option>
                          {categories.map((cat: any) => (
                            <option key={cat.id} value={cat.id}>{cat.nameFr}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="label">Description Détaillée</label>
                      <textarea
                        required
                        rows={3}
                        placeholder="Avantages, ingrédients, mode d'utilisation..."
                        className="input resize-none"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      ></textarea>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-6"
                  >
                    <SectionHeader icon={Truck} title="Logistique & Prix" currentStep={2} maxSteps={totalSteps} />
                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="label flex items-center gap-1.5">
                          <DollarSign size={14} className="text-primary-500" />
                          Coût de base (MAD)
                        </label>
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.01"
                          className="input"
                          autoFocus
                          onFocus={handleNumericFocus}
                          value={formData.baseCostMad}
                          onChange={(e) => setFormData({ ...formData, baseCostMad: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="label flex items-center gap-1.5">
                          <Layers size={14} className="text-secondary-500" />
                          Prix de détail conseillé
                        </label>
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.01"
                          onFocus={handleNumericFocus}
                          className="input bg-secondary-50/20 border-secondary-200"
                          value={formData.retailPriceMad}
                          onChange={(e) => setFormData({ ...formData, retailPriceMad: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="label">Quantité Initiale</label>
                        <input
                          type="number"
                          required
                          min="0"
                          onFocus={handleNumericFocus}
                          className="input"
                          value={formData.stockQuantity}
                          onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="label">Jours de Production</label>
                        <input
                          type="number"
                          required
                          min="0"
                          onFocus={handleNumericFocus}
                          className="input"
                          value={formData.minProductionDays}
                          onChange={(e) => setFormData({ ...formData, minProductionDays: e.target.value })}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 3 && isAdmin && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-6"
                  >
                    <SectionHeader icon={ShieldCheck} title="Paramètres Administrateur" isAdminOnly currentStep={3} maxSteps={totalSteps} />
                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="label text-primary-700">Propriétaire du produit</label>
                        <div className="relative">
                          <User size={16} className="absolute left-3 top-3 text-primary-400" />
                          <select
                            className="input pl-10 border-primary-200 focus:ring-primary-500/20 focus:border-primary-500"
                            autoFocus
                            value={formData.ownerId}
                            onChange={(e) => setFormData({ ...formData, ownerId: e.target.value })}
                          >
                            <option value="">L'administrateur (OpenSeller)</option>
                            {vendors.map((vendor: any) => (
                              <option key={vendor.id} value={vendor.id}>{vendor.fullName}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="label text-primary-700">Niveau de Visibilité</label>
                        <select
                          className="input border-primary-200 focus:ring-primary-500/20 focus:border-primary-500"
                          value={formData.visibility}
                          onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
                        >
                          <option value="REGULAR">Catalog Public (Standard)</option>
                          <option value="AFFILIATE">Exclusif Affiliés</option>
                          <option value="NONE">Privé (Caché)</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="label text-primary-700">URL Image Principale</label>
                      <div className="relative">
                        <ImageIcon size={16} className="absolute left-3 top-3 text-primary-400" />
                        <input
                          type="url"
                          placeholder="https://cdn.openseller.ma/products/IMAGE_ID.jpg"
                          className="input pl-10 border-primary-200 focus:ring-primary-500/20 focus:border-primary-500"
                          value={formData.imageUrl}
                          onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                        />
                      </div>
                      <p className="text-[10px] text-primary-600 font-medium px-1">Lien direct vers l'image. Formats suggérés: .jpg, .webp</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 bg-white flex justify-between items-center">
              <div>
                <AnimatePresence>
                  {step > 1 && (
                    <motion.button
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      type="button"
                      onClick={handleBack}
                      className="px-6 py-2.5 rounded-xl text-gray-600 font-semibold hover:bg-gray-100 transition-colors flex items-center gap-2"
                    >
                      Précédent
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl text-gray-600 font-semibold hover:bg-gray-100 transition-colors"
                  disabled={loading}
                >
                  Annuler
                </button>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-2.5 bg-primary-600 text-white rounded-xl font-bold shadow-lg shadow-primary-200 hover:bg-primary-700 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Création...
                    </>
                  ) : step < totalSteps ? (
                    <>
                      Continuer
                      <Truck size={18} className="translate-x-0 group-hover:translate-x-1 transition-transform" />
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      Valider et Créer
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);
}

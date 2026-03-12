import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productsApi, publicApi, uploadApi } from '../../lib/api';
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
  User,
  Plus,
  Trash2,
  Star,
  Upload,
  CheckCircle2,
  AlertCircle,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

interface UploadedImage {
  url: string;
  uploading?: boolean;
  progress?: number;
  error?: boolean;
  name?: string;
}

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isAdmin?: boolean;
  vendors?: any[];
  editProduct?: any;
}

export default function AddProductModal({ isOpen, onClose, onSuccess, isAdmin = false, vendors = [], editProduct }: AddProductModalProps) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const getInitialFormData = useCallback(() => ({
    sku: editProduct?.sku || '',
    nameFr: editProduct?.nameFr || '',
    nameAr: editProduct?.nameAr || '',
    description: editProduct?.description || '',
    categoryId: editProduct?.categories?.[0]?.id?.toString() || editProduct?.categoryId?.toString() || editProduct?.category?.id?.toString() || '',
    baseCostMad: editProduct?.baseCostMad?.toString() || '',
    retailPriceMad: editProduct?.retailPriceMad?.toString() || '',
    visibility: editProduct?.visibility || 'REGULAR',
    ownerId: editProduct?.ownerId?.toString() || '',
    stockQuantity: editProduct?.stockQuantity?.toString() || '0',
    minProductionDays: editProduct?.minProductionDays?.toString() || '3',
    videoUrlsInput: editProduct?.videoUrls?.join('\n') || '',
    landingPageUrlsInput: editProduct?.landingPageUrls?.join('\n') || '',
  }), [editProduct]);

  const [formData, setFormData] = useState(getInitialFormData());
  const [images, setImages] = useState<UploadedImage[]>([]);

  useEffect(() => {
    if (isOpen) {
      setFormData(getInitialFormData());
      setStep(1);
      // Pre-populate images if editing
      if (editProduct?.images?.length > 0) {
        setImages(editProduct.images.map((img: any) => ({
          url: img.imageUrl,
          name: img.imageUrl.split('/').pop(),
        })));
      } else if (editProduct?.primaryImage) {
        setImages([{ url: editProduct.primaryImage, name: 'primary.webp' }]);
      } else {
        setImages([]);
      }
    }
  }, [isOpen, editProduct, getInitialFormData]);

  const totalSteps = isAdmin ? 3 : 2;
  const isEditMode = !!editProduct;

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

  const handleFileUpload = async (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(f => 
      ['image/jpeg', 'image/png', 'image/jpg'].includes(f.type)
    );

    if (validFiles.length === 0) {
      toast.error('Seuls les formats PNG, JPG et JPEG sont acceptés');
      return;
    }

    // Add placeholder entries for uploading files
    const placeholders: UploadedImage[] = validFiles.map(f => ({
      url: '',
      uploading: true,
      progress: 0,
      name: f.name,
    }));
    
    const startIndex = images.length;
    setImages(prev => [...prev, ...placeholders]);

    const formDataUpload = new FormData();
    validFiles.forEach(f => formDataUpload.append('images', f));

    try {
      const response = await uploadApi.productImages(formDataUpload, (progress) => {
        setImages(prev => prev.map((img, i) => 
          i >= startIndex ? { ...img, progress } : img
        ));
      });

      const uploadedImages: { url: string; filename: string }[] = response.data.data.images;
      
      setImages(prev => {
        const updated = [...prev];
        uploadedImages.forEach((uploaded, i) => {
          const targetIndex = startIndex + i;
          if (targetIndex < updated.length) {
            updated[targetIndex] = {
              url: uploaded.url,
              uploading: false,
              progress: 100,
              name: uploaded.filename,
            };
          }
        });
        return updated;
      });

      toast.success(`${uploadedImages.length} image(s) convertie(s) en WebP`);
    } catch (error: any) {
      setImages(prev => prev.map((img, i) => 
        i >= startIndex ? { ...img, uploading: false, error: true, progress: 0 } : img
      ));
      toast.error(error.response?.data?.message || 'Erreur lors de l\'upload');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const setPrimaryImage = (index: number) => {
    setImages(prev => {
      const updated = [...prev];
      const [selected] = updated.splice(index, 1);
      updated.unshift(selected);
      return updated;
    });
  };

  const swapImages = (indexA: number, indexB: number) => {
    setImages(prev => {
      const updated = [...prev];
      [updated[indexA], updated[indexB]] = [updated[indexB], updated[indexA]];
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < totalSteps) {
      handleNext();
      return;
    }

    const imageUrls = images.filter(img => img.url && !img.error).map(img => img.url);

    try {
      setLoading(true);
      const payload = {
        ...formData,
        categoryIds: formData.categoryId ? [Number(formData.categoryId)] : [],
        baseCostMad: Number(formData.baseCostMad),
        retailPriceMad: Number(formData.retailPriceMad),
        ownerId: formData.ownerId ? Number(formData.ownerId) : undefined,
        stockQuantity: Number(formData.stockQuantity),
        minProductionDays: Number(formData.minProductionDays),
        imageUrls,
        videoUrls: formData.videoUrlsInput.split('\n').map((u: string) => u.trim()).filter(Boolean),
        landingPageUrls: formData.landingPageUrlsInput.split('\n').map((u: string) => u.trim()).filter(Boolean),
      };

      if (isEditMode) {
        await productsApi.update(editProduct.id.toString(), payload);
        toast.success('Produit mis à jour avec succès.');
      } else {
        await productsApi.create(payload);
        toast.success('Produit créé avec succès.');
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la sauvegarde');
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
                  <div className={`w-10 h-10 ${isEditMode ? 'bg-amber-500' : 'bg-primary-500'} rounded-xl flex items-center justify-center text-white shadow-lg ${isEditMode ? 'shadow-amber-200' : 'shadow-primary-200'}`}>
                    <Package size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-gray-900">
                      {isEditMode ? 'Modifier le Produit' : 'Nouveau Produit'}
                    </h2>
                    <p className="text-xs text-gray-500 font-medium">
                      {isEditMode ? `SKU: ${editProduct?.sku}` : 'Configuration du catalogue'}
                    </p>
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
                  className={`h-full ${isEditMode ? 'bg-amber-500' : 'bg-primary-600'}`}
                />
              </div>
            </div>

            <form id="addProductForm" onSubmit={handleSubmit} className="flex flex-col h-full">
              <div className="p-8 min-h-[420px] max-h-[60vh] overflow-y-auto">
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
                          disabled={isEditMode}
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
                            <option value="">L'administrateur (SILACOD)</option>
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

                    {/* Image Upload Area */}
                    <div className="space-y-3">
                      <label className="label text-primary-700 flex items-center gap-2">
                        <ImageIcon size={14} /> Images du Produit
                      </label>
                      
                      {/* Drag & Drop Zone */}
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`relative cursor-pointer border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-200 ${
                          isDragging
                            ? 'border-primary-500 bg-primary-50/50 scale-[1.01]'
                            : 'border-gray-200 bg-gray-50/50 hover:border-primary-300 hover:bg-primary-50/30'
                        }`}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept=".png,.jpg,.jpeg"
                          className="hidden"
                          onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                        />
                        <div className="flex flex-col items-center gap-2">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                            isDragging ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'
                          }`}>
                            <Upload size={24} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-700">
                              Glisser-déposer ou <span className="text-primary-600">parcourir</span>
                            </p>
                            <p className="text-[11px] text-gray-400 mt-1">PNG, JPG, JPEG — converties automatiquement en WebP</p>
                          </div>
                        </div>
                      </div>

                      {/* Image Previews */}
                      {images.length > 0 && (
                        <div className="space-y-2">
                          {images.map((img, index) => (
                            <div key={index} className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-gray-100 shadow-sm group">
                              {/* Thumbnail */}
                              <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                                {img.uploading ? (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <div className="w-5 h-5 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                                  </div>
                                ) : img.error ? (
                                  <div className="w-full h-full flex items-center justify-center bg-red-50">
                                    <AlertCircle size={16} className="text-red-400" />
                                  </div>
                                ) : (
                                  <img
                                    src={img.url}
                                    alt={`Image ${index + 1}`}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                )}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {index === 0 && !img.error && (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                      <Star size={10} className="fill-amber-500" /> Principale
                                    </span>
                                  )}
                                  {index !== 0 && !img.error && !img.uploading && (
                                    <button
                                      type="button"
                                      onClick={() => setPrimaryImage(index)}
                                      className="flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-amber-600 bg-gray-50 hover:bg-amber-50 px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                                      title="Définir comme image principale"
                                    >
                                      <Star size={10} /> Principale
                                    </button>
                                  )}
                                  {img.uploading && (
                                    <span className="text-[10px] font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                                      Upload...
                                    </span>
                                  )}
                                  {!img.uploading && !img.error && (
                                    <CheckCircle2 size={12} className="text-green-500" />
                                  )}
                                  <span className="text-[10px] font-medium text-gray-400">{img.name || `Image ${index + 1}`}</span>
                                </div>
                                
                                {/* Progress bar */}
                                {img.uploading && (
                                  <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${img.progress || 0}%` }}
                                      className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full"
                                      transition={{ duration: 0.3 }}
                                    />
                                  </div>
                                )}
                                
                                {!img.uploading && !img.error && (
                                  <p className="text-[10px] text-gray-400 truncate mt-0.5">{img.url}</p>
                                )}
                              </div>

                              {/* Reorder & Remove */}
                              {!img.uploading && (
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={() => swapImages(index, index - 1)}
                                    disabled={index === 0}
                                    className="p-1 text-gray-300 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors disabled:opacity-0 disabled:cursor-default"
                                    title="Monter"
                                  >
                                    <ChevronUp size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => swapImages(index, index + 1)}
                                    disabled={index === images.length - 1}
                                    className="p-1 text-gray-300 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors disabled:opacity-0 disabled:cursor-default"
                                    title="Descendre"
                                  >
                                    <ChevronDown size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeImage(index)}
                                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Supprimer"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="label text-primary-700">Liens Vidéos (Un par ligne)</label>
                        <textarea
                          rows={2}
                          className="input border-primary-200 focus:ring-primary-500/20 focus:border-primary-500"
                          value={formData.videoUrlsInput}
                          onChange={(e) => setFormData({ ...formData, videoUrlsInput: e.target.value })}
                          placeholder={"https://youtube.com/...\nhttps://vimeo.com/..."}
                        ></textarea>
                      </div>
                      <div className="space-y-1.5">
                        <label className="label text-primary-700">Pages de Vente (Un par ligne)</label>
                        <textarea
                          rows={2}
                          className="input border-primary-200 focus:ring-primary-500/20 focus:border-primary-500"
                          value={formData.landingPageUrlsInput}
                          onChange={(e) => setFormData({ ...formData, landingPageUrlsInput: e.target.value })}
                          placeholder={"https://mysite.com/product\nhttps://landing.com/p"}
                        ></textarea>
                      </div>
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
                  className={`px-8 py-2.5 ${isEditMode ? 'bg-amber-500 shadow-amber-200 hover:bg-amber-600' : 'bg-primary-600 shadow-primary-200 hover:bg-primary-700'} text-white rounded-xl font-bold shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 inline-flex items-center gap-2`}
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {isEditMode ? 'Mise à jour...' : 'Création...'}
                    </>
                  ) : step < totalSteps ? (
                    <>
                      Continuer
                      <Truck size={18} className="translate-x-0 group-hover:translate-x-1 transition-transform" />
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      {isEditMode ? 'Enregistrer' : 'Valider et Créer'}
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

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fulfillmentApi, uploadApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { X, Plus, Trash2, Link as LinkIcon, Image as ImageIcon, Upload, AlertCircle, Star, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface UploadedImage {
  url: string;
  uploading?: boolean;
  progress?: number;
  error?: boolean;
  name?: string;
}

export default function AdminFulfillment() {
  const [statusFilter, setStatusFilter] = useState('');
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [selectedReqForClone, setSelectedReqForClone] = useState<any>(null);
  
  // Clone Form State
  const [cloneName, setCloneName] = useState('');
  const [cloneDescription, setCloneDescription] = useState('');
  const [clonePrice, setClonePrice] = useState(0);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['fulfillment-requests', { status: statusFilter }],
    queryFn: () => fulfillmentApi.adminListRequests({ status: statusFilter || undefined }),
  });

  const requests = data?.data?.data?.requests || [];

  const fulfillMutation = useMutation({
    mutationFn: ({ id, actionType, quantity, cloneName, cloneDescription, clonePrice, cloneImageUrls }: { 
      id: string, actionType: string, quantity?: number, 
      cloneName?: string, cloneDescription?: string, clonePrice?: number, cloneImageUrls?: string[] 
    }) => 
      fulfillmentApi.fulfillRequest(id, { actionType, quantity, cloneName, cloneDescription, clonePrice, cloneImageUrls }),
    onSuccess: () => {
      toast.success('Demande traitée avec succès !');
      queryClient.invalidateQueries({ queryKey: ['fulfillment-requests'] });
    },
    onError: () => {
      toast.error('Erreur lors du traitement de la demande.');
    }
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => fulfillmentApi.rejectRequest(id),
    onSuccess: () => {
      toast.success('Demande rejetée / Droits révoqués !');
      queryClient.invalidateQueries({ queryKey: ['fulfillment-requests'] });
    },
    onError: () => {
      toast.error('Erreur lors du rejet.');
    }
  });

  const handleAction = (req: any, actionType: string) => {
    let quantity = undefined;
    if (actionType === 'GRANT_INVENTORY') {
       const qty = prompt("Combien d'unités souhaitez-vous accorder ?", "10");
       if (!qty) return;
       quantity = parseInt(qty, 10);
    }
    
    if (confirm(`Êtes-vous sûr de vouloir exécuter l'action: ${actionType} ?`)) {
      fulfillMutation.mutate({ id: req.id.toString(), actionType, quantity });
    }
  };

  const handleReject = (req: any) => {
    const label = req.status === 'RESOLVED' 
      ? 'Révoquer les droits accordés et fermer cette demande' 
      : 'Rejeter cette demande';
    if (confirm(`${label} ?`)) {
      rejectMutation.mutate(req.id.toString());
    }
  };

  const openCloneModal = (req: any) => {
    setSelectedReqForClone(req);
    setCloneName(req.product?.nameFr || '');
    setCloneDescription(req.product?.description || '');
    setClonePrice(req.product?.retailPriceMad || 0);
    if (req.product?.images?.length > 0) {
      setImages(req.product.images.map((img: any) => ({
        url: img.imageUrl,
        name: img.imageUrl.split('/').pop(),
      })));
    } else {
      setImages([]);
    }
    setIsCloneModalOpen(true);
  };

  const handleCloneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReqForClone) return;

    const imageUrls = images.filter(img => img.url && !img.error).map(img => img.url);

    fulfillMutation.mutate({
      id: selectedReqForClone.id.toString(),
      actionType: 'CLONE_PRODUCT',
      cloneName,
      cloneDescription,
      clonePrice,
      cloneImageUrls: imageUrls,
    }, {
      onSuccess: () => {
        setIsCloneModalOpen(false);
        setSelectedReqForClone(null);
      }
    });
  };

  const handleFileUpload = async (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(f => 
      ['image/jpeg', 'image/png', 'image/jpg'].includes(f.type)
    );

    if (validFiles.length === 0) {
      toast.error('Seuls les formats PNG, JPG et JPEG sont acceptés');
      return;
    }

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Demandes de Fulfillment & Support</h1>
          <p className="text-gray-500 mt-1">{requests.length} requêtes</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {['', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-colors ${
              statusFilter === status ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {status || 'Tous'}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12">Chargement...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Aucune demande trouvée.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">ID</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Utilisateur</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Type / Sujet</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Statut</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map((req: any) => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">#{req.id}</td>
                  <td className="py-3 px-4 text-sm">
                     <span className="font-semibold text-gray-900">{req.user?.profile?.fullName || req.user?.email || 'Inconnu'}</span>
                     <br/><span className="text-gray-500 text-xs px-1.5 py-0.5 bg-gray-100 rounded mt-1 inline-block">{req.user?.role}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {req.product && (
                        <div className="w-10 h-10 rounded border border-gray-200 bg-gray-50 flex-shrink-0 overflow-hidden">
                          {req.product.images?.[0] ? (
                            <img src={req.product.images[0].imageUrl} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">📦</div>
                          )}
                        </div>
                      )}
                      <div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          req.type === 'PRODUCT_CLAIM' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {req.type}
                        </span>
                        <p className="text-sm font-bold text-gray-800 mt-1">
                          {req.product?.nameFr || req.subject}
                        </p>
                        {req.productId && (
                          <p className="text-[10px] text-primary-600 font-medium">ID Produit: {req.productId}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      req.status === 'OPEN' ? 'bg-amber-100 text-amber-700' : 
                      req.status === 'CLOSED' ? 'bg-red-100 text-red-700' : 
                      req.status === 'RESOLVED' ? 'bg-green-100 text-green-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-500">
                    {new Date(req.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2 flex-wrap">
                      {/* Approve buttons — available on practically all except RESOLVED */}
                      {req.status !== 'RESOLVED' && (
                        <>
                          {req.type === 'DELIVERY_FULFILLMENT' && (
                            <>
                              <button
                                onClick={() => handleAction(req, 'GRANT_INVENTORY')}
                                className="text-xs bg-primary-600 text-white hover:bg-primary-700 font-bold py-1.5 px-3 rounded-lg transition-colors shadow-sm"
                              >
                                Accorder
                              </button>
                              {req.productId && (
                                <button
                                  onClick={() => openCloneModal(req)}
                                  className="text-xs bg-amber-600 text-white hover:bg-amber-700 font-bold py-1.5 px-3 rounded-lg transition-colors shadow-sm"
                                >
                                  🔀 Cloner & Accorder
                                </button>
                              )}
                            </>
                          )}
                          {req.type === 'PRODUCT_CLAIM' && (
                            <>
                              <button
                                onClick={() => handleAction(req, 'GRANT_CLAIM')}
                                className="text-xs bg-purple-600 text-white hover:bg-purple-700 font-bold py-1.5 px-3 rounded-lg transition-colors shadow-sm"
                              >
                                Accorder
                              </button>
                              {req.productId && (
                                <button
                                  onClick={() => openCloneModal(req)}
                                  className="text-xs bg-amber-600 text-white hover:bg-amber-700 font-bold py-1.5 px-3 rounded-lg transition-colors shadow-sm"
                                >
                                  🔀 Cloner & Accorder
                                </button>
                              )}
                            </>
                          )}
                        </>
                      )}

                      {/* Reject / Revoke — available on ALL statuses except CLOSED */}
                      {req.status !== 'CLOSED' && (
                        <button
                          onClick={() => handleReject(req)}
                          disabled={rejectMutation.isPending}
                          className={`text-xs font-bold py-1.5 px-3 rounded-lg transition-colors ${
                            req.status === 'RESOLVED'
                              ? 'bg-red-600 text-white hover:bg-red-700 shadow-sm'
                              : 'text-red-600 hover:bg-red-50 border border-red-200'
                          }`}
                        >
                          {req.status === 'RESOLVED' ? '🔄 Révoquer' : 'Rejeter'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Clone Product Modal */}
      {isCloneModalOpen && selectedReqForClone && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-bold">Personnaliser le Produit Clôné</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Pour l'utilisateur: {selectedReqForClone.user?.profile?.fullName || selectedReqForClone.user?.email}
                </p>
              </div>
              <button 
                onClick={() => setIsCloneModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCloneSubmit} className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="font-bold border-b pb-2">Informations Générales</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom du produit
                  </label>
                  <input
                    type="text"
                    required
                    value={cloneName}
                    onChange={(e) => setCloneName(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prix de vente (MAD)
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={clonePrice}
                    onChange={(e) => setClonePrice(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={cloneDescription}
                    onChange={(e) => setCloneDescription(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* Images */}
              <div className="space-y-4">
                <h3 className="font-bold border-b pb-2">Images du Produit</h3>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative cursor-pointer border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-200 ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
                      : 'border-gray-200 bg-gray-50/50 hover:border-blue-300 hover:bg-blue-50/30'
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
                      isDragging ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <Upload size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700">
                        Glisser-déposer ou <span className="text-blue-600">parcourir</span>
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">PNG, JPG, JPEG — converties automatiquement en WebP</p>
                    </div>
                  </div>
                </div>

                {images.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {images.map((img, index) => (
                      <div key={index} className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-gray-100 shadow-sm group">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                          {img.uploading ? (
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
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
                                onClick={(e) => { e.stopPropagation(); setPrimaryImage(index); }}
                                className="flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-amber-600 bg-gray-50 hover:bg-amber-50 px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                                title="Définir comme image principale"
                              >
                                <Star size={10} /> Principale
                              </button>
                            )}
                            {img.uploading && (
                              <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                Upload...
                              </span>
                            )}
                            {!img.uploading && !img.error && (
                              <CheckCircle2 size={12} className="text-green-500" />
                            )}
                            <span className="text-[10px] font-medium text-gray-400 truncate">{img.name || `Image ${index + 1}`}</span>
                          </div>
                          
                          {img.uploading && (
                            <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${img.progress || 0}%` }}
                                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                                transition={{ duration: 0.3 }}
                              />
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-white border-t border-gray-100 mt-6 -mx-6 -mb-6 p-6">
                <button
                  type="button"
                  onClick={() => setIsCloneModalOpen(false)}
                  className="px-6 py-2 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={fulfillMutation.isPending}
                  className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-colors shadow-sm shadow-amber-200 disabled:opacity-50"
                >
                  {fulfillMutation.isPending ? 'Clonage en cours...' : '🔀 Cloner & Accorder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

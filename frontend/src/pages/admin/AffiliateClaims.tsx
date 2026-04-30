import { useState, useEffect, useRef } from 'react';
import { adminApi, uploadApi } from '../../lib/api';
import { 
  CheckCircle2, 
  XCircle, 
  Search, 
  ExternalLink,
  Package,
  User as UserIcon,
  Calendar,
  Clock,
  Filter,
  Link as LinkIcon,
  Trash2,
  Upload,
  AlertCircle,
  Star,
  Image as ImageIcon,
  MessageSquare
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface UploadedImage {
  url: string;
  uploading?: boolean;
  progress?: number;
  error?: boolean;
  name?: string;
}

export default function AdminAffiliateClaims() {
  const navigate = useNavigate();
  const [claims, setClaims] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [search, setSearch] = useState('');

  // Clone Modal State
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [selectedClaimForClone, setSelectedClaimForClone] = useState<any>(null);
  const [cloneName, setCloneName] = useState('');
  const [cloneDescription, setCloneDescription] = useState('');
  const [clonePrice, setClonePrice] = useState(0);
  const [cloneQuantity, setCloneQuantity] = useState(1);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isCloning, setIsCloning] = useState(false);

  useEffect(() => {
    fetchClaims();
  }, [statusFilter]);

  const fetchClaims = async () => {
    try {
      setIsLoading(true);
      const res = await adminApi.getAffiliateClaims({ status: statusFilter });
      setClaims(res.data.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des demandes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (
    id: number, 
    data: { status: string; actionType?: string; cloneName?: string; cloneDescription?: string; clonePrice?: number; cloneImageUrls?: string[] }
  ) => {
    try {
      if (data.actionType === 'CLONE_PRODUCT') setIsCloning(true);
      await adminApi.updateAffiliateClaim(id, data);
      toast.success(
        data.actionType === 'CLONE_PRODUCT' ? 'Produit clôné et demande approuvée' : 
        `Demande ${data.status === 'APPROVED' ? 'approuvée' : data.status === 'REJECTED' ? 'refusée' : 'mise à jour'} avec succès`
      );
      if (data.actionType === 'CLONE_PRODUCT') {
        setIsCloneModalOpen(false);
        setSelectedClaimForClone(null);
      }
      fetchClaims();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour de la demande');
    } finally {
      if (data.actionType === 'CLONE_PRODUCT') setIsCloning(false);
    }
  };

  const openCloneModal = (claim: any) => {
    setSelectedClaimForClone(claim);
    setCloneName(claim.product?.nameFr || '');
    setCloneDescription(claim.product?.description || '');
    setClonePrice(claim.product?.retailPriceMad || 0);
    setCloneQuantity(claim.requestedQty || 1);
    if (claim.product?.images?.length > 0) {
      setImages(claim.product.images.map((img: any) => ({
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
    if (!selectedClaimForClone) return;
    
    const imageUrls = images.filter(img => img.url && !img.error).map(img => img.url);

    handleUpdateStatus(selectedClaimForClone.id, {
      status: 'APPROVED',
      actionType: 'CLONE_PRODUCT',
      cloneName,
      cloneDescription,
      clonePrice,
      cloneQuantity,
      cloneImageUrls: imageUrls,
    });
  };

  const handleFileUpload = async (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(f => 
      ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(f.type)
    );

    if (validFiles.length === 0) {
      toast.error('Seuls les formats PNG, JPG, JPEG et WEBP sont acceptés');
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

  const filteredClaims = claims.filter(claim => 
    claim.user?.profile?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    claim.product?.nameFr?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Demandes d'Affiliation & Stock</h1>
          <p className="text-sm text-gray-500 mt-1">Approuvez ou refusez les demandes des partenaires pour promouvoir ou stocker des produits.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par influenceur ou produit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-200">
          {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === status 
                  ? 'bg-gray-900 text-white shadow-md' 
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {status === 'ALL' ? 'Tous' : status === 'PENDING' ? 'En attente' : status === 'APPROVED' ? 'Approuvés' : 'Refusés'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Utilisateur</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Produit</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Détails Demande</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Branding</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <AnimatePresence mode="popLayout">
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="px-6 py-4"><div className="h-12 bg-gray-50 rounded-xl" /></td>
                    </tr>
                  ))
                ) : filteredClaims.length > 0 ? (
                  filteredClaims.map((claim) => {
                    const userRole = claim.user?.role?.name;
                    const userMode = claim.user?.mode;
                    const getRoleBadge = () => {
                      if (userRole === 'INFLUENCER') return { label: 'Influenceur', color: 'bg-pink-100 text-pink-700 border-pink-200' };
                      if (userMode === 'AFFILIATE') return { label: 'Affilié', color: 'bg-purple-100 text-purple-700 border-purple-200' };
                      if (userRole === 'VENDOR') return { label: 'Vendeur', color: 'bg-blue-100 text-blue-700 border-blue-200' };
                      return { label: userRole || 'Utilisateur', color: 'bg-gray-100 text-gray-600 border-gray-200' };
                    };
                    const badge = getRoleBadge();

                    return (
                    <motion.tr
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={claim.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      {/* User Column */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold overflow-hidden border border-blue-100 flex-shrink-0">
                            {claim.user?.profile?.avatarUrl ? (
                              <img src={claim.user.profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon className="w-5 h-5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-gray-900 truncate">{claim.user?.profile?.fullName || 'Utilisateur'}</div>
                            <div className="text-xs text-gray-500 truncate">{claim.user?.phone || claim.user?.email}</div>
                            <span className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${badge.color}`}>
                              {badge.label}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Product Column */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 overflow-hidden border border-gray-200 flex-shrink-0">
                            {claim.product?.images?.[0]?.imageUrl ? (
                              <img src={claim.product.images[0].imageUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-5 h-5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-gray-900 line-clamp-1">{claim.product?.nameFr}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-semibold text-gray-400">SKU: {claim.product?.sku}</span>
                              <span className="text-gray-200">·</span>
                              <span className="text-[10px] font-bold text-gray-900">{claim.product?.retailPriceMad} MAD</span>
                            </div>
                            {claim.product?.categories?.[0] && (
                              <span className="mt-0.5 inline-flex text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                {claim.product.categories[0].nameFr}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Détails Demande Column (Date + Brand + Qty) */}
                      <td className="px-6 py-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                            {format(new Date(claim.claimedAt), 'dd MMM yyyy', { locale: fr })}
                            <span className="text-gray-300 ml-1">
                              <Clock className="w-3 h-3 inline" /> {format(new Date(claim.claimedAt), 'HH:mm')}
                            </span>
                          </div>
                          {claim.brandName && (
                            <div className="text-[10px] font-semibold text-gray-700 bg-gray-50 px-2 py-1 rounded-md inline-flex items-center gap-1">
                              🏷️ {claim.brandName}
                            </div>
                          )}
                          {claim.requestedQty && (
                            <div className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md inline-flex items-center gap-1 ml-1">
                              📦 Qté: {claim.requestedQty}
                            </div>
                          )}
                          {claim.requestedLandingPageUrl && (
                            <div className="mt-1">
                              <a 
                                href={claim.requestedLandingPageUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 underline underline-offset-2"
                              >
                                <LinkIcon className="w-3 h-3" /> Landing Page
                              </a>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Branding Column */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {claim.brandingLabelMockupUrl ? (
                            <a 
                              href={claim.brandingLabelMockupUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                              title="Maquette Logo"
                            >
                              <ImageIcon size={16} />
                            </a>
                          ) : (
                            <span className="w-8 h-8 rounded-lg bg-gray-50 border border-dashed border-gray-200" />
                          )}
                          {claim.brandingLabelPrintUrl ? (
                            <a 
                              href={claim.brandingLabelPrintUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-1.5 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors"
                              title="PDF Impression"
                            >
                              <ExternalLink size={16} />
                            </a>
                          ) : (
                            <span className="w-8 h-8 rounded-lg bg-gray-50 border border-dashed border-gray-200" />
                          )}
                          {claim.conversationId ? (
                            <Link
                              to={`/admin/chat?convId=${claim.conversationId}`}
                              className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                              title="Ouvrir le chat"
                            >
                              <MessageSquare size={16} />
                            </Link>
                          ) : (
                            <span className="w-8 h-8 rounded-lg bg-gray-50 border border-dashed border-gray-100 flex items-center justify-center">
                              <MessageSquare size={14} className="text-gray-200" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Statut Column */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          claim.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                          claim.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                          claim.status === 'REVOKED' ? 'bg-gray-100 text-gray-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {claim.status === 'PENDING' ? 'En attente' : 
                           claim.status === 'APPROVED' ? 'Approuvé' : 
                           claim.status === 'REJECTED' ? 'Refusé' : claim.status}
                        </span>
                      </td>

                      {/* Actions Column */}
                      <td className="px-6 py-4 text-right">
                        {claim.status !== 'APPROVED' && claim.status !== 'REVOKED' && claim.status !== 'RESOLVED' && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleUpdateStatus(claim.id, { status: 'REJECTED' })}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors group relative"
                              title="Refuser"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(claim.id, { status: 'APPROVED' })}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors group relative"
                              title="Approuver"
                            >
                              <CheckCircle2 className="w-5 h-5" />
                            </button>
                            {claim.user?.mode !== 'AFFILIATE' && (
                              <button
                                onClick={() => openCloneModal(claim)}
                                className="text-[10px] bg-amber-600 text-white hover:bg-amber-700 font-bold py-1.5 px-3 rounded-lg transition-colors shadow-sm whitespace-nowrap"
                              >
                                🔀 Cloner & Approuver
                              </button>
                            )}
                          </div>
                        )}
                        {claim.status === 'APPROVED' && (
                           <button
                             onClick={() => handleUpdateStatus(claim.id, { status: 'REVOKED' })}
                             className="text-[10px] font-bold text-gray-400 hover:text-red-500 transition-colors uppercase"
                           >
                             Révoquer
                           </button>
                        )}
                      </td>
                    </motion.tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Filter className="w-6 h-6 text-gray-300" />
                      </div>
                      <p className="font-bold">Aucune demande trouvée</p>
                      <p className="text-xs">Les demandes d'affiliation des partenaires s'afficheront ici.</p>
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Clone Product Modal */}
      {isCloneModalOpen && selectedClaimForClone && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-bold">Personnaliser le Produit Clôné</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Pour l'utilisateur: {selectedClaimForClone.user?.profile?.fullName || selectedClaimForClone.user?.email}
                </p>
              </div>
              <button 
                onClick={() => setIsCloneModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                disabled={isCloning}
              >
                <XCircle className="w-5 h-5 text-gray-400" />
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
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantité (Stock)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={cloneQuantity}
                    onChange={(e) => setCloneQuantity(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
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
                    accept=".png,.jpg,.jpeg,.webp"
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
                      <p className="text-[11px] text-gray-400 mt-1">PNG, JPG, JPEG, WEBP — converties automatiquement en WebP</p>
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
                  disabled={isCloning}
                  className="px-6 py-2 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isCloning}
                  className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-colors shadow-sm shadow-amber-200 disabled:opacity-50"
                >
                  {isCloning ? 'Clonage...' : '🔀 Cloner & Approuver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

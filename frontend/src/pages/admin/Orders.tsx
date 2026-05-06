import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '../../lib/api';
import { 
  Search, 
  Package, 
  User as UserIcon, 
  Calendar, 
  Clock, 
  MessageSquare,
  Filter,
  Eye,
  CreditCard,
  MapPin,
  ChevronRight,
  MoreVertical,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Upload,
  Star,
  Trash2,
  AlertCircle,
  Image as ImageIcon
} from 'lucide-react';
import { useRef } from 'react';
import { uploadApi } from '../../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

export default function AdminOrders() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clone Modal State
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [selectedOrderForClone, setSelectedOrderForClone] = useState<any>(null);
  const [cloneName, setCloneName] = useState('');
  const [cloneDescription, setCloneDescription] = useState('');
  const [clonePrice, setClonePrice] = useState(0);
  const [cloneQuantity, setCloneQuantity] = useState(0);
  const [images, setImages] = useState<any[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isCloning, setIsCloning] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-orders', { status: statusFilter }],
    queryFn: () => ordersApi.list({ 
      status: statusFilter === 'ALL' ? undefined : statusFilter 
    }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      ordersApi.updateStatus(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Commande mise à jour avec succès');
      setIsCloneModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur lors de la mise à jour');
    }
  });

  const handleUpdateStatus = (id: string, status: string, additionalData: any = {}) => {
    updateStatusMutation.mutate({ 
      id, 
      data: { status, ...additionalData } 
    });
  };

  const openCloneModal = (order: any) => {
    const firstItem = order.items?.[0];
    setSelectedOrderForClone(order);
    setCloneName(firstItem?.productName || '');
    setCloneDescription(firstItem?.productDescription || '');
    setClonePrice(firstItem?.unitPriceMad || 0);
    setCloneQuantity(firstItem?.quantity || 1);
    
    if (firstItem?.productImages && firstItem.productImages.length > 0) {
      setImages(firstItem.productImages.map((url: string) => ({
        url,
        name: url.split('/').pop(),
      })));
    } else if (firstItem?.productImage) {
      setImages([{
        url: firstItem.productImage,
        name: firstItem.productImage.split('/').pop(),
      }]);
    } else {
      setImages([]);
    }
    setIsCloneModalOpen(true);
  };

  const handleCloneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForClone) return;

    const imageUrls = images.filter(img => img.url && !img.error).map(img => img.url);

    handleUpdateStatus(selectedOrderForClone.id, 'CONFIRMED', {
      actionType: 'CLONE_PRODUCT',
      cloneName,
      cloneDescription,
      clonePrice,
      cloneQuantity,
      cloneImageUrls: imageUrls
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

    const placeholders = validFiles.map(f => ({
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

      const uploadedImages = response.data.data.images;
      
      setImages(prev => {
        const updated = [...prev];
        uploadedImages.forEach((uploaded: any, i: number) => {
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

      toast.success(`${uploadedImages.length} image(s) convertie(s)`);
    } catch (error: any) {
      setImages(prev => prev.map((img, i) => 
        i >= startIndex ? { ...img, uploading: false, error: true, progress: 0 } : img
      ));
      toast.error('Erreur lors de l\'upload');
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

  const orders = data?.data?.data?.orders || [];

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

  const filteredOrders = orders.filter((order: any) => 
    order.customerName?.toLowerCase().includes(search.toLowerCase()) ||
    order.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
    order.items?.some((item: any) => item.productName?.toLowerCase().includes(search.toLowerCase()))
  );

  const stats = [
    { label: 'Commandes Totales', value: orders.length, icon: Package, color: 'blue' },
    { label: 'Nouveaux Colis', value: orders.filter((o: any) => o.status === 'NEW_PARCEL').length, icon: Clock, color: 'amber' },
    { label: 'En Transit', value: orders.filter((o: any) => ['PICKED_UP', 'SENT', 'RECEIVED', 'DISTRIBUTION'].includes(o.status)).length, icon: TrendingUp, color: 'indigo' },
    { label: 'Livrées', value: orders.filter((o: any) => o.status === 'DELIVERED').length, icon: CheckCircle2, color: 'emerald' },
  ];

  const getStatusStyle = (status: string) => {
    switch (status) {
      // Stock & Préparation
      case 'NEW_PARCEL': return 'bg-slate-50 text-slate-600 border-slate-100';
      case 'WAITING_PICKUP': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'WAITING_PREPARATION': return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'PREPARED': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'ENCORE_PREPARED': return 'bg-blue-50 text-blue-600 border-blue-100';
      
      // En transit
      case 'PICKED_UP': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'SENT': return 'bg-violet-50 text-violet-600 border-violet-100';
      case 'RECEIVED': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'DISTRIBUTION': return 'bg-cyan-50 text-cyan-600 border-cyan-100';
      case 'PROGRAMMER_AUTO': return 'bg-purple-50 text-purple-600 border-purple-100';
      case 'POSTPONED': return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'NOANSWER': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'ERR': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'PROGRAMMER': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'INCORRECT_ADDRESS': return 'bg-rose-50 text-rose-600 border-rose-100';

      // Livraison terminée
      case 'DELIVERED': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'RETURNED': return 'bg-orange-50 text-orange-600 border-orange-100';

      // Annulations
      case 'CANCELED_BY_SELLER': return 'bg-red-50 text-red-600 border-red-100';
      case 'CANCELED_BY_SYSTEM': return 'bg-red-50 text-red-600 border-red-100';
      case 'CANCELED': return 'bg-red-50 text-red-600 border-red-100';
      case 'REFUSE': return 'bg-red-50 text-red-600 border-red-100';

      // Compatibility
      case 'PENDING': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'CONFIRMED': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'SHIPPED': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'CANCELLED': return 'bg-red-50 text-red-600 border-red-100';
      default: return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Gestion des Commandes</h1>
          <p className="text-sm text-gray-500 mt-1">Gérez le cycle de vie des commandes, de la confirmation à la livraison.</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={stat.label}
            className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4"
          >
            <div className={`w-12 h-12 rounded-xl bg-${stat.color}-50 text-${stat.color}-600 flex items-center justify-center`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{stat.label}</p>
              <p className="text-xl font-black text-gray-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par client, produit ou N° de commande..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all font-medium"
          />
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-200 overflow-x-auto no-scrollbar">
          {['ALL', 'NEW_PARCEL', 'PICKED_UP', 'SENT', 'DELIVERED', 'RETURNED', 'CANCELED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                statusFilter === status 
                  ? 'bg-gray-900 text-white shadow-md' 
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {status === 'ALL' ? 'Toutes' : 
               status === 'NEW_PARCEL' ? 'Nouveau' : 
               status === 'PICKED_UP' ? 'Collectés' : 
               status === 'SENT' ? 'Expédiés' : 
               status === 'DELIVERED' ? 'Livrées' : 
               status === 'RETURNED' ? 'Retournés' : 'Annulés'}
            </button>
          ))}
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center w-16">#</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Client / Order</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Produits</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">Total</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">Statut</th>
                <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <AnimatePresence mode="popLayout">
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="px-6 py-8"><div className="h-10 bg-gray-50 rounded-xl w-full" /></td>
                    </tr>
                  ))
                ) : filteredOrders.length > 0 ? (
                  filteredOrders.map((order: any, idx: number) => (
                    <motion.tr
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={order.id}
                      className="hover:bg-gray-50/50 transition-all group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-black text-gray-300">{(idx + 1).toString().padStart(2, '0')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-violet-50 flex items-center justify-center text-violet-600 font-bold border border-violet-100 flex-shrink-0">
                            <UserIcon size={18} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-gray-900 group-hover:text-violet-600 transition-colors truncate">
                              {order.customerName}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded leading-none flex items-center gap-1 uppercase">
                                <Package size={10} /> {order.orderNumber}
                              </span>
                              <span className="text-gray-300">·</span>
                              <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                <Calendar size={10} /> {format(new Date(order.createdAt), 'dd/MM/yy')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex -space-x-3 overflow-hidden">
                            {order.items?.map((item: any, i: number) => (
                              <div key={item.id} className="h-10 w-10 rounded-lg bg-gray-100 border-2 border-white ring-1 ring-gray-200 overflow-hidden flex-shrink-0">
                                {item.productImage ? (
                                  <img src={item.productImage} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                                    <Package size={14} />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-gray-800 truncate max-w-[150px]">
                              {order.items?.length > 1 
                                ? `${order.items[0].productName} (+${order.items.length - 1} autres)`
                                : order.items?.[0]?.productName || 'Sans produit'}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                {order.items?.reduce((sum: number, i: any) => sum + i.quantity, 0)} unités
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <div className="text-sm font-black text-gray-900 tracking-tight">
                            {order.totalAmountMad} <span className="text-[10px]">MAD</span>
                          </div>
                          <div className="flex items-center gap-1 text-[9px] font-bold text-gray-400 mt-1 uppercase">
                            <CreditCard size={10} /> {order.paymentMethod || 'COD'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getStatusStyle(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                           <Link
                             to={`/admin/chat?orderNum=${order.orderNumber}`}
                             className="p-2 text-violet-600 hover:bg-violet-50 rounded-lg transition-all hover:scale-110 group relative"
                             title="Ouvrir le chat"
                           >
                             <div className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse shadow-sm shadow-rose-500/50" />
                             <MessageSquare size={18} strokeWidth={2.5} />
                           </Link>
                           
                           <div className="relative group/menu">
                              <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-all">
                                <MoreVertical size={18} />
                              </button>
                              
                              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-100 rounded-xl shadow-xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-20 overflow-hidden">
                                {['NEW_PARCEL', 'SENT', 'DELIVERED', 'RETURNED', 'CANCELED'].map((s) => (
                                  <button
                                    key={s}
                                    disabled={order.status === s}
                                    onClick={() => handleUpdateStatus(order.id, s)}
                                    className={`w-full text-left px-4 py-2 text-xs font-bold transition-colors flex items-center gap-2 ${
                                      order.status === s ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'hover:bg-gray-50 text-gray-700'
                                    }`}
                                  >
                                    <div className={`w-1.5 h-1.5 rounded-full ${getStatusStyle(s).split(' ')[0]}`} />
                                    {s === 'NEW_PARCEL' ? 'Mettre En Nouveau' : 
                                     s === 'SENT' ? 'Expédier' : 
                                     s === 'DELIVERED' ? 'Marquer Livrée' : 
                                     s === 'RETURNED' ? 'Marquer Retourné' :
                                     'Annuler'}
                                  </button>
                                ))}
                              </div>
                           </div>
                           
                           {order.status === 'PENDING' && (
                             <button
                               onClick={() => openCloneModal(order)}
                               className="text-[10px] bg-amber-600 text-white hover:bg-amber-700 font-bold py-1.5 px-3 rounded-lg transition-all shadow-sm whitespace-nowrap hover:scale-105 active:scale-95"
                             >
                               🔀 Cloner & Approuver
                             </button>
                           )}
                        </div>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center text-gray-500">
                      <div className="w-16 h-16 bg-gray-50 rounded-[2rem] flex items-center justify-center mx-auto mb-4">
                        <Package className="w-8 h-8 text-gray-300" />
                      </div>
                      <h3 className="text-lg font-black text-gray-900 mb-1">Aucune commande</h3>
                      <p className="text-sm text-gray-500">Les commandes de vos partenaires apparaîtront ici.</p>
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
      {/* Clone Product Modal */}
      {isCloneModalOpen && selectedOrderForClone && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-bold">Personnaliser le Produit Clôné</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Pour l'utilisateur: {selectedOrderForClone.customerName} (Commande {selectedOrderForClone.orderNumber})
                </p>
              </div>
              <button 
                onClick={() => setIsCloneModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                disabled={updateStatusMutation.isPending}
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
                    Unités (Qté)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={cloneQuantity}
                    onChange={(e) => setCloneQuantity(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold"
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
                            <div className="absolute inset-0 flex items-center justify-center bg-red-50">
                              <AlertCircle size={16} className="text-red-400" />
                            </div>
                          ) : (
                            <img
                              src={img.url}
                              alt=""
                              className="w-full h-full object-cover"
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
                          <Trash2 size={14} />
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
                  disabled={updateStatusMutation.isPending}
                  className="px-6 py-2 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={updateStatusMutation.isPending}
                  className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-colors shadow-sm shadow-amber-200 disabled:opacity-50"
                >
                  {updateStatusMutation.isPending ? 'Clonage...' : '🔀 Cloner & Approuver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

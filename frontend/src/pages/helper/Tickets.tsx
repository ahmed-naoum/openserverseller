import { useState, useEffect } from 'react';
import { 
  Search, 
  Package, 
  FileText, 
  Download, 
  ChevronRight, 
  ChevronDown, 
  ShoppingBag,
  User,
  Phone,
  MapPin,
  Clock,
  ArrowRight,
  AlertCircle,
  Truck,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react';
import { ordersApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import PageLoader from '../../components/PageLoader';

interface PendingParcel {
  id: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerCity: string;
  coliatyPackageCode: string;
  coliatyPickupRef?: string;
  totalAmountMad: number;
  createdAt: string;
}

interface ProductGroup {
  id: number;
  name: string;
  sku: string;
  image?: string;
  pendingParcels: PendingParcel[];
}

export default function HelperTickets() {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'created'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  const [downloadingCode, setDownloadingCode] = useState<string | null>(null);
  const [bulkDownloading, setBulkDownloading] = useState<number | null>(null);
  
  // Automated Pickup State
  const [productPickups, setProductPickups] = useState<Record<number, string>>({});
  const [processingPickups, setProcessingPickups] = useState<number[]>([]);
  const [generatingLabelsFor, setGeneratingLabelsFor] = useState<string | null>(null);
  const [selectedParcels, setSelectedParcels] = useState<Record<number, string[]>>({});
  
  // Bon Detail State (live from Coliaty)
  const [expandedBonRef, setExpandedBonRef] = useState<string | null>(null);
  const [bonDetails, setBonDetails] = useState<Record<string, any>>({});
  const [loadingBonDetail, setLoadingBonDetail] = useState<string | null>(null);
  const [removingParcel, setRemovingParcel] = useState<string | null>(null);

  const toggleParcelSelection = (productId: number, code: string) => {
    setSelectedParcels(prev => {
      const current = prev[productId] || [];
      const updated = current.includes(code)
        ? current.filter(c => c !== code)
        : [...current, code];
      return { ...prev, [productId]: updated };
    });
  };

  const toggleAllProductParcels = (product: ProductGroup) => {
    const allCodes = product.pendingParcels.map(p => p.coliatyPackageCode);
    setSelectedParcels(prev => {
      const current = prev[product.id] || [];
      const updated = current.length === allCodes.length ? [] : allCodes;
      return { ...prev, [product.id]: updated };
    });
  };

  // Grouping logic for the two tabs
  const pendingProducts = products.map(p => ({
    ...p,
    pendingParcels: p.pendingParcels.filter(parcel => !parcel.coliatyPickupRef)
  })).filter(p => p.pendingParcels.length > 0);

  // Group by Pickup Note Reference
  const createdBons: { ref: string; count: number; date: string; products: { name: string; image?: string; sku: string }[] }[] = [];
  const bonMap: Record<string, any> = {};

  products.forEach(p => {
    p.pendingParcels.forEach(parcel => {
      if (parcel.coliatyPickupRef) {
        if (!bonMap[parcel.coliatyPickupRef]) {
          bonMap[parcel.coliatyPickupRef] = {
            ref: parcel.coliatyPickupRef,
            count: 0,
            date: parcel.createdAt,
            products: new Map() // Use Map to unique by SKU
          };
          createdBons.push(bonMap[parcel.coliatyPickupRef]);
        }
        bonMap[parcel.coliatyPickupRef].count++;
        bonMap[parcel.coliatyPickupRef].products.set(p.sku, {
          name: p.name,
          image: p.image,
          sku: p.sku
        });
      }
    });
  });

  // Convert Maps to Arrays for display
  createdBons.forEach(b => {
    b.products = Array.from((b as any).products.values());
  });
  
  // Sort by date descending
  createdBons.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (user?.role === 'HELPER' && !user?.canManageTickets) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-10 h-10 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Accès Non Autorisé</h2>
        <p className="text-gray-500 text-sm max-w-md">
          Vous n'avez pas la permission d'accéder à cette page. Contactez votre administrateur pour obtenir l'accès aux tickets.
        </p>
      </div>
    );
  }

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await ordersApi.getProductsWithParcels();
      const data = res.data?.data || [];
      setProducts(data);
      
      // Populate existing pickups from data
      const existingPickups: Record<number, string> = {};
      data.forEach((prod: ProductGroup) => {
        // If any parcel has a pickup ref, assume the group belongs to it
        const ref = prod.pendingParcels.find(p => p.coliatyPickupRef)?.coliatyPickupRef;
        if (ref) existingPickups[prod.id] = ref;
      });
      setProductPickups(existingPickups);
    } catch (err: any) {
      toast.error('Erreur lors de la récupération des tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoPickup = async (product: ProductGroup) => {
    if (processingPickups.includes(product.id)) return;
    
    const selected = selectedParcels[product.id] || [];
    const codes = selected.length > 0 ? selected : product.pendingParcels.map(p => p.coliatyPackageCode);
    
    if (codes.length === 0) {
      toast.error('Aucun colis à inclure dans le bon');
      return;
    }

    setProcessingPickups(prev => [...prev, product.id]);
    const toastId = toast.loading(`Création du bon pour ${codes.length} colis...`);

    try {
      // 1. Create Pickup Note
      const createRes = await ordersApi.createPickupNote();
      const ref = createRes.data?.data?.reference;
      
      if (!ref) throw new Error('Impossible de créer la référence du bon');

      // 2. Add Parcels
      toast.loading(`Ajout de ${codes.length} colis au bon ${ref}...`, { id: toastId });
      const addRes = await ordersApi.addParcelsToPickup({
        pickup_note_reference: ref,
        parcel_codes: codes
      });

      const successCount = Array.isArray(addRes.data?.data?.success_parcels) 
        ? addRes.data?.data?.success_parcels.length 
        : Object.keys(addRes.data?.data?.success_parcels || {}).length;
        
      const errorParcels = addRes.data?.data?.error_parcels || {};
      const errorCodes = Object.keys(errorParcels);
      const isAlreadyInPickup = errorCodes.some(code => errorParcels[code]?.message?.includes('déjà dans un bon'));

      if (successCount === 0) {
        if (isAlreadyInPickup) {
          toast.success('Colis déjà synchronisés avec un bon existant.', { id: toastId });
          // Small delay to ensure DB commit is visible to next query
          await new Promise(resolve => setTimeout(resolve, 500));
          await fetchData();
          return;
        }

        let errorDetail = "";
        if (errorCodes.length > 0) {
          const firstErr = errorParcels[errorCodes[0]];
          errorDetail = firstErr?.message ? `: ${firstErr.message}` : ` (${errorCodes.length} erreurs)`;
        }
        throw new Error(`Aucun colis ajouté${errorDetail}`);
      }

      // 3. Update State & Refresh
      setProductPickups(prev => ({ ...prev, [product.id]: ref }));
      toast.success(`Bon ${ref} créé avec ${successCount} colis !`, { id: toastId });
      
      // Refresh to pick up any self-healed references for other parcels
      await fetchData();
    } catch (err: any) {
      console.error('Auto Pickup Error:', err);
      const msg = err.response?.data?.message || err.message || 'Erreur lors de la création du bon automatisé';
      toast.error(msg, { id: toastId });
    } finally {
      setProcessingPickups(prev => prev.filter(id => id !== product.id));
    }
  };

  const handleDownloadPickupLabels = async (reference: string) => {
    setGeneratingLabelsFor(reference);
    try {
      const res = await ordersApi.generatePickupLabels(reference);
      // Coliaty might return { pdf: "..." } or the base64 string directly in data
      const base64 = res.data?.data?.pdf || (typeof res.data?.data === 'string' ? res.data?.data : null);
      
      if (!base64) {
        console.error('PDF Data Missing. Response:', res.data);
        throw new Error('Données PDF manquantes dans la réponse');
      }

      const byteArray = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bon-ramassage-${reference}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Bon de ramassage téléchargé !');
    } catch (err: any) {
      console.error('PDF Generation Error:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Erreur lors de la génération du PDF';
      toast.error(errorMsg);
    } finally {
      setGeneratingLabelsFor(null);
    }
  };

  const handleDownloadLabel = async (code: string) => {
    setDownloadingCode(code);
    try {
      const res = await ordersApi.getParcelLabel(code);
      const base64 = res.data?.data?.pdf;
      if (!base64) throw new Error('PDF data missing');

      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ticket-${code}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Étiquette téléchargée !');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors du téléchargement');
    } finally {
      setDownloadingCode(null);
    }
  };

  const handleDownloadAll = async (group: ProductGroup) => {
    setBulkDownloading(group.id);
    const toastId = toast.loading(`Préparation de ${group.pendingParcels.length} tickets...`);
    
    try {
      const { PDFDocument } = await import('pdf-lib');
      const mergedPdf = await PDFDocument.create();
      let successCount = 0;

      for (let i = 0; i < group.pendingParcels.length; i++) {
        const parcel = group.pendingParcels[i];
        toast.loading(`Récupération ${i + 1}/${group.pendingParcels.length}...`, { id: toastId });
        
        try {
          const res = await ordersApi.getParcelLabel(parcel.coliatyPackageCode);
          const base64 = res.data?.data?.pdf;
          if (!base64) continue;

          const pdfBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
          const pdfDoc = await PDFDocument.load(pdfBytes);
          const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
          pages.forEach(page => mergedPdf.addPage(page));
          successCount++;
        } catch (err) {
          console.error(`Failed to fetch label for ${parcel.coliatyPackageCode}:`, err);
        }
      }

      if (successCount === 0) {
        toast.error('Aucune étiquette n\'a pu être récupérée.', { id: toastId });
        return;
      }

      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([mergedBytes as any], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tickets-${group.name.replace(/\s+/g, '_')}-${successCount}pcs.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`${successCount} tickets fusionnés en un seul PDF !`, { id: toastId });
    } catch (err) {
      console.error('Bulk download error:', err);
      toast.error('Erreur lors de la fusion des tickets', { id: toastId });
    } finally {
      setBulkDownloading(null);
    }
  };

  const fetchBonDetail = async (ref: string) => {
    setLoadingBonDetail(ref);
    try {
      const res = await ordersApi.getPickupNoteDetail(ref);
      const detail = res.data?.data || res.data;
      setBonDetails(prev => ({ ...prev, [ref]: detail }));
    } catch (err: any) {
      console.error('Fetch bon detail error:', err);
      toast.error(err.response?.data?.message || 'Erreur lors de la récupération du détail');
    } finally {
      setLoadingBonDetail(null);
    }
  };

  const handleToggleBon = (ref: string) => {
    if (expandedBonRef === ref) {
      setExpandedBonRef(null);
    } else {
      setExpandedBonRef(ref);
      if (!bonDetails[ref]) {
        fetchBonDetail(ref);
      }
    }
  };

  const handleRemoveParcel = async (bonRef: string, parcelCode: string) => {
    setRemovingParcel(parcelCode);
    try {
      await ordersApi.removeParcelsFromPickup({
        pickup_note_reference: bonRef,
        parcel_codes: [parcelCode]
      });
      toast.success(`Colis ${parcelCode} retiré du bon`);
      // Refresh bon detail
      await fetchBonDetail(bonRef);
      // Refresh main data
      await fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors du retrait');
    } finally {
      setRemovingParcel(null);
    }
  };

  const getParcelStatusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      'NEW_PARCEL': { label: 'Nouveau', color: 'bg-slate-100 text-slate-600' },
      'WAITING_PICKUP': { label: 'Attente Collecte', color: 'bg-amber-50 text-amber-600 border-amber-100' },
      'PICKED_UP': { label: 'Collecté', color: 'bg-blue-50 text-blue-600 border-blue-100' },
      'SENT': { label: 'Expédié', color: 'bg-violet-50 text-violet-600 border-violet-100' },
      'RECEIVED': { label: 'Reçu', color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
      'DISTRIBUTION': { label: 'En livraison', color: 'bg-cyan-50 text-cyan-600 border-cyan-100' },
      'DELIVERED': { label: 'Livré', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
      'RETURNED': { label: 'Retourné', color: 'bg-orange-50 text-orange-600 border-orange-100' },
      'CANCELED': { label: 'Annulé', color: 'bg-red-50 text-red-600 border-red-100' },
    };
    return map[status] || { label: status, color: 'bg-slate-50 text-slate-500' };
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <PageLoader />;

  // Tab Content Components
  const filteredPending = pendingProducts.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingContent = filteredPending.length > 0 ? (
    filteredPending.map((product) => (
      <div 
        key={product.id}
        className={`bg-white rounded-[2.5rem] border transition-all duration-500 ${
          expandedProductId === product.id 
            ? 'border-primary-200 shadow-[0_30px_60px_rgba(0,0,0,0.08)] ring-1 ring-primary-100' 
            : 'border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)] hover:border-slate-200'
        }`}
      >
        {/* Product Row */}
        <div 
          className="p-6 flex flex-col sm:flex-row items-center gap-6 cursor-pointer"
          onClick={() => setExpandedProductId(expandedProductId === product.id ? null : product.id)}
        >
          {/* Image */}
          <div className="w-20 h-20 bg-slate-50 rounded-3xl overflow-hidden border border-slate-100 flex-shrink-0 relative group/img shadow-sm">
            {product.image ? (
              <img src={product.image} alt={product.name} className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <Package size={32} />
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/5 transition-colors" />
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-xl font-black text-slate-900 mb-1">{product.name}</h3>
            <div className="flex items-center justify-center sm:justify-start gap-3">
              <span className="inline-flex items-center px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-xs font-black uppercase tracking-wider border border-orange-100">
                {product.pendingParcels.length} Colis en attente
              </span>
              <span className="text-slate-400 text-xs font-bold">ID: {product.id}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {/* Automated Pickup Button - Always show create in Pending tab */}
            <button
              onClick={() => handleAutoPickup(product)}
              disabled={processingPickups.includes(product.id) || !(selectedParcels[product.id]?.length > 0)}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-sm font-black hover:bg-black transition-all shadow-lg shadow-slate-200 active:scale-95 disabled:opacity-50 disabled:bg-slate-400 disabled:shadow-none"
            >
              {processingPickups.includes(product.id) ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Truck size={16} />
              )}
              Créer Bon de Ramassage {(selectedParcels[product.id]?.length > 0) && `(${selectedParcels[product.id].length})`}
            </button>

            <button
              onClick={() => handleDownloadAll(product)}
              disabled={bulkDownloading === product.id}
              className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-2xl text-sm font-black hover:bg-primary-700 transition-all shadow-lg shadow-primary-200 active:scale-95 disabled:opacity-50"
            >
              <Download className={`w-4 h-4 ${bulkDownloading === product.id ? 'animate-bounce' : ''}`} />
              {bulkDownloading === product.id ? 'Téléchargement...' : 'Tout télécharger'}
            </button>
            <button
              onClick={() => setExpandedProductId(expandedProductId === product.id ? null : product.id)}
              className={`p-3 rounded-2xl transition-all ${
                expandedProductId === product.id ? 'bg-primary-50 text-primary-600 rotate-180' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
              }`}
            >
              <ChevronDown size={24} />
            </button>
          </div>
        </div>

        {/* Expanded Parcels View */}
        {expandedProductId === product.id && (
          <div className="px-6 pb-8 animate-in slide-in-from-top-4 duration-500">
            <div className="h-px bg-slate-100 mb-8 mx-6" />
            
            <div className="flex items-center justify-between mb-6 px-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-50 rounded-xl text-primary-600">
                  <FileText size={18} />
                </div>
                <h4 className="font-black text-slate-800 uppercase tracking-tighter">Liste des Colis</h4>
              </div>
              
              <button 
                onClick={() => toggleAllProductParcels(product)}
                className="text-xs font-black uppercase tracking-wider text-primary-600 hover:text-primary-700 bg-white px-4 py-2 rounded-xl border border-primary-100 shadow-sm transition-all active:scale-95"
              >
                {(selectedParcels[product.id] || []).length === product.pendingParcels.length ? 'Désélectionner tout' : 'Tout sélectionner'}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {product.pendingParcels.map((parcel) => (
                <div 
                  key={parcel.id}
                  className={`rounded-[2rem] p-6 border-2 transition-all group/card relative overflow-hidden cursor-pointer ${
                    (selectedParcels[product.id] || []).includes(parcel.coliatyPackageCode)
                      ? 'border-primary-500 bg-white shadow-xl shadow-primary-500/10'
                      : 'bg-slate-50/50 border-slate-100/80 hover:border-primary-200 hover:bg-white hover:shadow-xl hover:shadow-primary-50/20'
                  }`}
                  onClick={() => toggleParcelSelection(product.id, parcel.coliatyPackageCode)}
                >
                  <div className="absolute top-0 right-0 p-3 flex items-center gap-2">
                     <div className="px-3 py-1 bg-white rounded-full text-[10px] font-black text-slate-400 border border-slate-100 shadow-sm uppercase tracking-tighter">
                       #{parcel.orderNumber}
                     </div>
                     <input 
                        type="checkbox"
                        checked={(selectedParcels[product.id] || []).includes(parcel.coliatyPackageCode)}
                        onChange={() => {}} // Handled by parent div
                        className="w-5 h-5 rounded-lg border-2 border-slate-200 text-primary-600 focus:ring-primary-500 transition-all cursor-pointer"
                      />
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl shadow-sm flex items-center justify-center transition-colors ${
                        (selectedParcels[product.id] || []).includes(parcel.coliatyPackageCode)
                          ? 'bg-primary-500 text-white'
                          : 'bg-white text-primary-500'
                      }`}>
                        <User size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 leading-none mb-1">{parcel.customerName}</p>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Phone size={12} />
                          <span className="text-[11px] font-bold tracking-tight">{parcel.customerPhone}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-slate-500">
                      <MapPin size={14} className="text-slate-300" />
                      <span className="text-xs font-bold">{parcel.customerCity}</span>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Code Coliaty</p>
                        <p className={`text-sm font-mono font-bold px-3 py-1.5 rounded-xl border transition-all ${
                          (selectedParcels[product.id] || []).includes(parcel.coliatyPackageCode)
                            ? 'bg-primary-50 text-primary-700 border-primary-100'
                            : 'text-slate-700 bg-white border-slate-100'
                        }`}>{parcel.coliatyPackageCode}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownloadLabel(parcel.coliatyPackageCode); }}
                        disabled={downloadingCode === parcel.coliatyPackageCode}
                        className="w-12 h-12 flex items-center justify-center bg-white text-primary-600 rounded-2xl border border-slate-100 hover:border-primary-200 hover:bg-primary-50 transition-all shadow-sm active:scale-90 disabled:opacity-50"
                        title="Télécharger le ticket"
                      >
                        <Download className={`w-5 h-5 ${downloadingCode === parcel.coliatyPackageCode ? 'animate-bounce' : ''}`} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    ))
  ) : (
    <div className="bg-white rounded-[3rem] p-20 text-center border-2 border-dashed border-slate-200 w-full">
      <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
        <Package size={48} />
      </div>
      <h2 className="text-2xl font-black text-slate-900 mb-2">Aucun colis en attente</h2>
      <p className="text-slate-400 max-w-md mx-auto">Tous vos colis ont été ramassés ou sont en cours de livraison.</p>
    </div>
  );

  const filteredCreated = createdBons.filter(bon => 
    bon.ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bon.products.some(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const createdContent = filteredCreated.length > 0 ? (
    <div className="space-y-6">
      {filteredCreated.map((bon) => {
        const detail = bonDetails[bon.ref];
        const pickupNote = detail?.pickup_note;
        const parcels = detail?.parcels || [];
        const isExpanded = expandedBonRef === bon.ref;
        const isLoading = loadingBonDetail === bon.ref;

        return (
          <div key={bon.ref} className={`bg-white rounded-[2.5rem] border transition-all duration-500 ${
            isExpanded 
              ? 'border-emerald-200 shadow-[0_30px_60px_rgba(0,0,0,0.08)] ring-1 ring-emerald-100' 
              : 'border-slate-100 shadow-sm hover:shadow-xl hover:border-emerald-100'
          }`}>
            {/* Bon Header */}
            <div 
              className="p-6 flex flex-col sm:flex-row items-center gap-6 cursor-pointer"
              onClick={() => handleToggleBon(bon.ref)}
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm transition-all ${
                pickupNote?.is_complete 
                  ? 'bg-emerald-500 text-white' 
                  : pickupNote?.is_closed 
                    ? 'bg-slate-400 text-white' 
                    : 'bg-emerald-50 text-emerald-600'
              }`}>
                <FileText size={28} />
              </div>

              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-lg font-mono font-black text-slate-900 mb-1">{bon.ref}</h3>
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-100">
                    {pickupNote ? `${pickupNote.total_parcels} Colis` : `${bon.count} Colis`}
                  </span>
                  {pickupNote && (
                    <>
                      <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-wider border border-blue-100">
                        {pickupNote.picked_up_parcels}/{pickupNote.total_parcels} Collectés
                      </span>
                      {pickupNote.total_amount > 0 && (
                        <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-wider border border-amber-100">
                          {pickupNote.total_amount} MAD
                        </span>
                      )}
                      {pickupNote.is_complete && (
                        <span className="px-3 py-1 bg-emerald-500 text-white rounded-full text-[10px] font-black uppercase tracking-wider">
                          ✓ Complet
                        </span>
                      )}
                      {pickupNote.is_closed && !pickupNote.is_complete && (
                        <span className="px-3 py-1 bg-slate-500 text-white rounded-full text-[10px] font-black uppercase tracking-wider">
                          Fermé
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => fetchBonDetail(bon.ref)}
                  disabled={isLoading}
                  className="p-3 bg-white text-slate-400 rounded-2xl border border-slate-100 shadow-sm hover:text-emerald-600 hover:border-emerald-100 transition-all active:scale-90 disabled:opacity-50"
                  title="Rafraîchir"
                >
                  <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={() => handleDownloadPickupLabels(bon.ref)}
                  disabled={generatingLabelsFor === bon.ref}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-sm font-black hover:bg-emerald-600 transition-all shadow-lg shadow-slate-200 hover:shadow-emerald-200 active:scale-95 disabled:opacity-50"
                >
                  <Download className={`w-4 h-4 ${generatingLabelsFor === bon.ref ? 'animate-bounce' : ''}`} />
                  {generatingLabelsFor === bon.ref ? 'Génération...' : 'Télécharger'}
                </button>
                <button
                  onClick={() => handleToggleBon(bon.ref)}
                  className={`p-3 rounded-2xl transition-all ${
                    isExpanded ? 'bg-emerald-50 text-emerald-600 rotate-180' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  <ChevronDown size={24} />
                </button>
              </div>
            </div>

            {/* Expanded Detail */}
            {isExpanded && (
              <div className="px-6 pb-8 animate-in slide-in-from-top-4 duration-500">
                <div className="h-px bg-slate-100 mb-6 mx-6" />

                {isLoading && !detail ? (
                  <div className="flex items-center justify-center py-12 gap-3">
                    <Loader2 className="animate-spin text-emerald-500" size={24} />
                    <span className="text-sm font-bold text-slate-400">Chargement depuis Coliaty...</span>
                  </div>
                ) : parcels.length > 0 ? (
                  <>
                    {/* Progress Bar */}
                    {pickupNote && pickupNote.total_parcels > 0 && (
                      <div className="mx-6 mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progression Collecte</span>
                          <span className="text-xs font-black text-slate-700">
                            {pickupNote.picked_up_parcels}/{pickupNote.total_parcels}
                          </span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                            style={{ width: `${(pickupNote.picked_up_parcels / pickupNote.total_parcels) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Parcels Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 px-6">
                      {parcels.map((parcel: any) => {
                        const badge = getParcelStatusBadge(parcel.parcel_status);
                        return (
                          <div key={parcel.parcel_code} className="rounded-2xl p-5 border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-lg hover:border-emerald-100 transition-all group/card">
                            <div className="flex items-start justify-between mb-3">
                              <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${badge.color}`}>
                                {badge.label}
                              </span>
                              <button
                                onClick={() => handleRemoveParcel(bon.ref, parcel.parcel_code)}
                                disabled={removingParcel === parcel.parcel_code}
                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover/card:opacity-100 disabled:opacity-50"
                                title="Retirer du bon"
                              >
                                {removingParcel === parcel.parcel_code ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <Trash2 size={14} />
                                )}
                              </button>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-500 border border-slate-100">
                                  <User size={18} />
                                </div>
                                <div>
                                  <p className="text-sm font-black text-slate-900 leading-none">{parcel.receiver}</p>
                                  <div className="flex items-center gap-1.5 text-slate-400 mt-0.5">
                                    <Phone size={10} />
                                    <span className="text-[10px] font-bold">{parcel.phone}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 text-slate-500">
                                <MapPin size={12} className="text-slate-300" />
                                <span className="text-[11px] font-bold">{parcel.city_name}</span>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                <div>
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Code</p>
                                  <p className="text-xs font-mono font-bold text-slate-700">{parcel.parcel_code}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Prix</p>
                                  <p className="text-sm font-black text-emerald-600">{parcel.price} MAD</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-300">
                    <Package size={40} className="mb-3 opacity-30" />
                    <p className="text-sm font-bold">Aucun colis dans ce bon</p>
                    <p className="text-xs text-slate-400 mt-1">Les données détaillées ne sont pas disponibles depuis Coliaty.</p>
                  </div>
                )}

                {/* Local products info fallback when no Coliaty detail */}
                {!detail && !isLoading && (
                  <div className="px-6 pt-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Produits inclus (données locales)</p>
                    <div className="flex gap-3 flex-wrap">
                      {bon.products.map((p: any) => (
                        <div key={p.sku} className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                          {p.image ? (
                            <img src={p.image} alt={p.name} className="w-8 h-8 rounded-lg object-cover" />
                          ) : (
                            <Package size={16} className="text-slate-300" />
                          )}
                          <span className="text-xs font-bold text-slate-700">{p.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  ) : (
    <div className="bg-white rounded-[3rem] p-20 text-center border-2 border-dashed border-slate-200 w-full">
      <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
        <CheckCircle size={48} />
      </div>
      <h2 className="text-2xl font-black text-slate-900 mb-2">Aucun bon trouvé</h2>
      <p className="text-slate-400 max-w-md mx-auto">
        {searchQuery 
          ? `Aucun bon ne contient de produit correspondant à "${searchQuery}".` 
          : "Vous n'avez pas encore généré de bons de ramassage pour cette session."}
      </p>
    </div>
  );

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700">
      {/* Header & Tabs */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full -mr-32 -mt-32 blur-3xl transition-all duration-700 group-hover:bg-primary-500/10" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-primary-600 rounded-2xl shadow-xl shadow-primary-200">
                <FileText className="text-white w-6 h-6" />
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Packaging Tickets</h1>
            </div>
            <p className="text-slate-500 font-medium">Gérez vos colis en attente et vos bons de ramassage.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64 group/search">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-primary-500 transition-colors" size={18} />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-primary-500 outline-none transition-all font-bold text-sm text-slate-700 placeholder:text-slate-400"
                />
              </div>
              <button
                onClick={fetchData}
                disabled={loading}
                className="p-3 bg-white text-slate-500 rounded-2xl border border-slate-100 shadow-sm hover:text-primary-600 hover:border-primary-100 transition-all active:scale-90 disabled:opacity-50"
                title="Actualiser"
              >
                <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="flex bg-slate-50 p-1.5 rounded-[1.5rem]">
              <button
                onClick={() => setActiveTab('pending')}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-black transition-all ${
                  activeTab === 'pending' 
                    ? 'bg-white text-primary-600 shadow-md' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Package size={18} />
                En attente ({pendingProducts.length})
              </button>
              <button
                onClick={() => setActiveTab('created')}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-black transition-all ${
                  activeTab === 'created' 
                    ? 'bg-white text-emerald-600 shadow-md' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <CheckCircle size={18} />
                Bons créés ({createdBons.length})
              </button>
            </div>
          </div>
        </div>
      </div>

       {/* Main Content */}
      <div className="grid grid-cols-1 gap-6">
        {activeTab === 'pending' ? pendingContent : createdContent}
      </div>

      {/* Stats/Info Footer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 flex items-center gap-6 shadow-sm">
          <div className="w-16 h-16 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-500 flex-shrink-0">
            <ShoppingBag size={28} />
          </div>
          <div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Produits actifs</p>
            <p className="text-2xl font-black text-slate-900">{products.length}</p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 flex items-center gap-6 shadow-sm">
          <div className="w-16 h-16 bg-orange-50 rounded-3xl flex items-center justify-center text-orange-500 flex-shrink-0">
            <Clock size={28} />
          </div>
          <div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Colis restants</p>
            <p className="text-2xl font-black text-slate-900">
              {pendingProducts.reduce((acc, p) => acc + p.pendingParcels.length, 0)}
            </p>
          </div>
        </div>

        <div className="bg-primary-900 p-8 rounded-[2.5rem] flex items-center gap-6 shadow-2xl shadow-primary-200 overflow-hidden relative group">
          <div className="absolute inset-0 bg-noise opacity-20" />
          <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
          
          <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center text-white flex-shrink-0 relative z-10 backdrop-blur-md">
            <CheckCircle size={28} />
          </div>
          <div className="relative z-10">
            <p className="text-[11px] font-black text-primary-300 uppercase tracking-widest mb-1">Bons terminés</p>
            <p className="text-sm font-bold text-white leading-tight">
              {createdBons.length} bons de ramassage générés avec succès.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

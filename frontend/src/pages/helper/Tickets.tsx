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
  AlertCircle
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
  totalAmountMad: number;
  createdAt: string;
}

interface ProductGroup {
  id: number;
  name: string;
  image?: string;
  pendingParcels: PendingParcel[];
}

export default function HelperTickets() {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  const [downloadingCode, setDownloadingCode] = useState<string | null>(null);
  const [bulkDownloading, setBulkDownloading] = useState<number | null>(null);

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
      setProducts(res.data?.data || []);
    } catch (err: any) {
      toast.error('Erreur lors de la récupération des tickets');
    } finally {
      setLoading(false);
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
      const blob = new Blob([mergedBytes], { type: 'application/pdf' });
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

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <PageLoader />;

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full -mr-32 -mt-32 blur-3xl transition-all duration-700 group-hover:bg-primary-500/10" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-primary-600 rounded-2xl shadow-xl shadow-primary-200">
              <FileText className="text-white w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Gestion des Tickets</h1>
          </div>
          <p className="text-slate-500 font-medium">Téléchargez les étiquettes Coliaty groupées par produit pour vos colis en attente.</p>
        </div>

        <div className="relative z-10 w-full md:w-96 group/search">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-primary-500 transition-colors" size={20} />
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-[1.5rem] focus:bg-white focus:border-primary-500 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Product List */}
      <div className="grid grid-cols-1 gap-6">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((product) => (
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
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {product.pendingParcels.map((parcel) => (
                      <div 
                        key={parcel.id}
                        className="bg-slate-50/50 rounded-[2rem] p-6 border border-slate-100/80 hover:border-primary-200 hover:bg-white hover:shadow-xl hover:shadow-primary-50/20 transition-all group/card relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 p-3">
                           <div className="px-3 py-1 bg-white rounded-full text-[10px] font-black text-slate-400 border border-slate-100 shadow-sm uppercase tracking-tighter">
                             #{parcel.orderNumber}
                           </div>
                        </div>

                        <div className="space-y-4 pt-2">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-primary-500">
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

                          <div className="flex items-center justify-between items-end pt-2">
                            <div className="space-y-1">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Code Coliaty</p>
                              <p className="text-sm font-mono font-bold text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-slate-100 inline-block">{parcel.coliatyPackageCode}</p>
                            </div>
                            <button
                              onClick={() => handleDownloadLabel(parcel.coliatyPackageCode)}
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
          <div className="bg-white rounded-[3rem] p-20 text-center border-2 border-dashed border-slate-200">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
              <Package size={48} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Aucun ticket en attente</h2>
            <p className="text-slate-400 max-w-md mx-auto">
              {searchQuery 
                ? `Aucun produit ne correspond à "${searchQuery}" avec des colis en attente.` 
                : "Tous vos colis ont été ramassés ou sont en cours de livraison."}
            </p>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="mt-6 text-primary-600 font-bold hover:underline"
              >
                Effacer la recherche
              </button>
            )}
          </div>
        )}
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
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Colis en attente</p>
            <p className="text-2xl font-black text-slate-900">
              {products.reduce((acc, p) => acc + p.pendingParcels.length, 0)}
            </p>
          </div>
        </div>

        <div className="bg-primary-900 p-8 rounded-[2.5rem] flex items-center gap-6 shadow-2xl shadow-primary-200 overflow-hidden relative group">
          <div className="absolute inset-0 bg-noise opacity-20" />
          <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
          
          <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center text-white flex-shrink-0 relative z-10 backdrop-blur-md">
            <AlertCircle size={28} />
          </div>
          <div className="relative z-10">
            <p className="text-[11px] font-black text-primary-300 uppercase tracking-widest mb-1">Conseil Pro</p>
            <p className="text-sm font-bold text-white leading-tight">
              Téléchargez vos tickets par lot pour gagner du temps lors de la préparation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

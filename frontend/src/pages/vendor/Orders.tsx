import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ordersApi, leadsApi } from '../../lib/api';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { Package, UploadCloud, Plus, UserPlus, MapPin, Search } from 'lucide-react';

interface MyProduct {
  id: number;
  sku: string;
  name: string;
  image: string | null;
  retailPrice: number;
  source: string;
}

export default function VendorOrders() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [products, setProducts] = useState<MyProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Single lead form state
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Import state
  const [importProductId, setImportProductId] = useState<number | ''>('');
  const [importedLeads, setImportedLeads] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', { status: statusFilter }],
    queryFn: () => ordersApi.list({ status: statusFilter || undefined }),
  });

  const orders = data?.data?.data?.orders || [];

  const statusColors: Record<string, string> = {
    PENDING: 'warning',
    CONFIRMED: 'primary',
    IN_PRODUCTION: 'purple',
    READY_FOR_SHIPPING: 'indigo',
    SHIPPED: 'cyan',
    DELIVERED: 'success',
    CANCELLED: 'danger',
    RETURNED: 'orange',
    REFUNDED: 'gray',
  };

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await leadsApi.getMyProducts();
      setProducts(res.data.data.products);
    } catch {
      toast.error('Erreur lors du chargement des produits');
    } finally {
      setLoadingProducts(false);
    }
  };

  const openAddModal = (order?: any) => {
    fetchProducts();
    setShowAddModal(true);
    setSelectedProductId('');
    
    if (order) {
      setFullName(order.customerName || '');
      setPhone(order.customerPhone || '');
      setCity(order.customerCity || '');
      setAddress(order.shippingAddress || '');
    } else {
      setFullName('');
      setPhone('');
      setCity('');
      setAddress('');
    }
  };

  const openImportModal = () => {
    fetchProducts();
    setShowImportModal(true);
    setImportProductId('');
    setImportedLeads([]);
  };

  const handleAddLead = async () => {
    if (!selectedProductId || !fullName || !phone) {
      toast.error('Veuillez remplir les champs obligatoires');
      return;
    }
    setSubmitting(true);
    try {
      await leadsApi.create({
        fullName,
        phone,
        city,
        address,
        productId: selectedProductId,
      });
      toast.success('Lead sauvegardé avec succès !');
      setShowAddModal(false);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nom Complet', 'Téléphone', 'WhatsApp', 'Ville', 'Adresse', 'SKU Produit'],
      ['Ahmed Benali', '0612345678', '0612345678', 'Casablanca', '123 Rue Mohammed V', 'SKU-001'],
      ['Fatima Zahra', '0698765432', '0698765432', 'Rabat', '45 Avenue Hassan II', 'SKU-001'],
    ]);

    // Set column widths
    ws['!cols'] = [
      { wch: 22 }, // Nom Complet
      { wch: 16 }, // Téléphone
      { wch: 16 }, // WhatsApp
      { wch: 16 }, // Ville
      { wch: 30 }, // Adresse
      { wch: 14 }, // SKU
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    XLSX.writeFile(wb, 'template_import_leads.xlsx');
    toast.success('Template téléchargé !');
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Use object output instead of arrays for better robustness
        const jsonData = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });

        const leads = jsonData
          .map(row => {
             // Try to find the name in various possible column names
             const nameKey = Object.keys(row).find(k => k.toLowerCase().includes('nom')) || Object.keys(row)[0];
             // Try to find the phone in various possible column names
             const phoneKey = Object.keys(row).find(k => k.toLowerCase().includes('tél') || k.toLowerCase().includes('tel') || k.toLowerCase().includes('phone')) || Object.keys(row)[1];
             const cityKey = Object.keys(row).find(k => k.toLowerCase().includes('ville') || k.toLowerCase().includes('city'));
             const addressKey = Object.keys(row).find(k => k.toLowerCase().includes('adresse') || k.toLowerCase().includes('address'));
             
             return {
                fullName: String(row[nameKey] || '').trim(),
                phone: String(row[phoneKey] || '').trim(),
                city: cityKey ? String(row[cityKey]).trim() : undefined,
                address: addressKey ? String(row[addressKey]).trim() : undefined,
             };
          })
          .filter(lead => lead.fullName && lead.phone); // Require name and phone

        if (leads.length === 0) {
          toast.error('Aucun lead valide trouvé. Vérifiez les colonnes Nom et Téléphone.');
          return;
        }

        setImportedLeads(leads);
        toast.success(`${leads.length} Leads détectés`);
      } catch (error) {
        console.error("Erreur de lecture du fichier:", error);
        toast.error('Le fichier est invalide ou corrompu.');
      } finally {
        // Reset the file input so the same file can be uploaded again if needed
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleImportLeads = async () => {
    if (!importProductId) {
      toast.error('Veuillez sélectionner un produit');
      return;
    }
    if (importedLeads.length === 0) {
      toast.error('Aucun prospect à importer');
      return;
    }
    setImporting(true);
    try {
      const res = await leadsApi.importWithProduct({
        productId: Number(importProductId),
        leads: importedLeads,
      });
      const stats = res.data.data.batch;
      toast.success(`${stats.validRows} prospects importés, ${stats.duplicateRows} doublons ignorés`);
      setShowImportModal(false);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erreur lors de l\'import');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 pt-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Commandes</h1>
          <p className="text-slate-500 mt-2 font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {orders.length} transactions au total
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => openAddModal()}
            className="btn-premium px-6 py-3 bg-[#2c2f74] text-white flex items-center gap-2 rounded-[1.5rem] text-[10px] sm:text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:-translate-y-1 transition-transform"
          >
            <Plus size={16} /> Ajouter un Lead
          </button>
          <button
            onClick={openImportModal}
            className="px-6 py-3 bg-white text-slate-800 border border-slate-200 flex items-center gap-2 rounded-[1.5rem] text-[10px] sm:text-xs font-black uppercase tracking-widest shadow-sm hover:bg-slate-50 hover:-translate-y-1 transition-transform"
          >
            <UploadCloud size={16} /> Importer Excel
          </button>
        </div>
      </div>

      {/* Filters (Bento Glass Style) */}
      <div className="bento-card border-none bg-white p-4 shadow-sm flex gap-2 overflow-x-auto scrollbar-hide">
        {['', 'PENDING', 'CONFIRMED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-5 py-3 rounded-2xl whitespace-nowrap text-xs font-black uppercase tracking-widest transition-all duration-300 ${
              statusFilter === status 
                ? 'bg-[#2c2f74] text-white shadow-lg shadow-indigo-900/20 scale-105' 
                : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 border border-transparent hover:border-slate-200'
            }`}
          >
            {status || 'Toutes les Commandes'}
          </button>
        ))}
      </div>

      {/* Orders */}
      {isLoading ? (
        <div className="text-center py-20 flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-primary-500 rounded-full animate-spin mb-4" />
          <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Chargement des commandes...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bento-card border-none bg-white p-12 text-center shadow-sm">
          <div className="w-24 h-24 bg-gradient-to-br from-amber-50 to-orange-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-amber-100">
            <Package size={40} className="text-amber-500" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-3">Aucune commande</h3>
          <p className="text-slate-500 font-medium mb-8 max-w-sm mx-auto">Vous n'avez pas encore de commandes. Créez manuellement vos premiers leads ou importez-les.</p>
          <div className="flex justify-center gap-4">
            <button onClick={() => openAddModal()} className="btn-premium px-8 py-4 bg-[#2c2f74] text-white flex items-center gap-2 rounded-[1.5rem] text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:-translate-y-1 transition-transform">
              <Plus size={16} /> Ajouter un Lead
            </button>
            <button onClick={openImportModal} className="px-8 py-4 bg-white text-slate-800 border border-slate-200 flex items-center gap-2 rounded-[1.5rem] text-xs font-black uppercase tracking-widest shadow-sm hover:bg-slate-50 hover:text-slate-900 hover:-translate-y-1 transition-transform">
              <UploadCloud size={16} /> Importer Excel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order: any) => (
            <div key={order.id} className="bento-card border-none bg-white p-6 shadow-sm hover:shadow-lg transition-all duration-300">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-[1.2rem] flex items-center justify-center border border-slate-100 shrink-0">
                    <Package className="w-8 h-8 text-primary-500 opacity-80" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-black text-slate-900 tracking-tight">{order.orderNumber}</span>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] uppercase font-black tracking-widest badge-${statusColors[order.status] || 'gray'}`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="text-sm text-slate-500 font-medium flex items-center gap-2">
                      <span className="text-slate-700 font-bold">{order.customerName}</span> 
                      <span className="w-1 h-1 rounded-full bg-slate-200"></span> 
                      {order.customerCity}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-6 justify-between lg:justify-end">
                  <div className="text-right">
                    <div className="font-black text-xl text-slate-900 leading-none mb-1 text-center xl:text-right">{Number(order.totalAmountMad).toLocaleString()} <span className="text-xs uppercase text-slate-400">MAD</span></div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500 text-center xl:text-right">+{Number(order.vendorEarningMad).toLocaleString()} MAD Brut</div>
                  </div>
                  
                  {/* SAVE AS LEAD BUTTON */}
                  <button
                     onClick={() => openAddModal(order)}
                     className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                  >
                     <UserPlus size={16} /> Sauvegarder comme Lead
                  </button>
                </div>
              </div>

              {/* Items */}
              <div className="mt-6 pt-6 border-t border-slate-50">
                <div className="flex flex-wrap gap-2">
                  {order.items?.map((item: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5">
                      <span className="text-sm font-bold text-slate-700">{item.productName}</span>
                      <span className="px-2 py-0.5 bg-white rounded truncate text-[10px] font-black text-primary-600 border border-slate-200">X{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-50">
              <div className="flex items-center justify-between">
                <div>
                   <h2 className="text-2xl font-black text-slate-900 tracking-tight">Ajouter un Lead</h2>
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">Convertissez vers votre CRM</p>
                </div>
                <button onClick={() => setShowAddModal(false)} className="w-10 h-10 bg-slate-50 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full flex items-center justify-center transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-8 space-y-6">
              {/* Product Selector */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Produit d'intérêt *</label>
                {loadingProducts ? (
                  <div className="p-4 bg-slate-50 rounded-xl text-xs font-bold text-slate-400 animate-pulse">Recherche des produits autorisés...</div>
                ) : products.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-amber-600">
                    Aucun produit actif dans votre inventaire. Veuillez sourcer avant d'ajouter.
                  </div>
                ) : (
                  <select
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all shadow-sm"
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(Number(e.target.value))}
                  >
                    <option value="">Sélectionner un produit cible</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.sku}] {p.name} — {p.retailPrice} MAD
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Nom du Client *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                     <UserPlus className="w-4 h-4 text-slate-300" />
                  </div>
                  <input
                    type="text"
                    className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all shadow-sm"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ahmed Benali"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Contact (Tel) *</label>
                <input
                  type="text"
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all shadow-sm"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: 0612345678"
                />
                {!phone && <p className="text-[10px] font-bold text-amber-500 mt-2 ml-1">Le téléphone est requis pour valider le Lead.</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Ville</label>
                  <input
                    type="text"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all shadow-sm"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Casablanca"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Adresse / Note</label>
                  <input
                    type="text"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all shadow-sm"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Informations utiles"
                  />
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-slate-50 flex justify-end gap-4 bg-slate-50/50">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-6 py-4 bg-white text-slate-700 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm flex-1"
              >
                Annuler
              </button>
              <button
                onClick={handleAddLead}
                disabled={submitting || !selectedProductId || !fullName || !phone}
                className="px-6 py-4 bg-gradient-to-r from-[#2c2f74] to-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:-translate-y-1 transition-transform shadow-xl shadow-indigo-500/20 flex-1 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {submitting ? 'Validation...' : 'Créer et Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Excel Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Importer des Leads via Excel</h2>
                <button onClick={() => setShowImportModal(false)} className="w-10 h-10 bg-slate-50 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full flex items-center justify-center transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Step 1: Select product */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-primary-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
                  <label className="text-sm font-bold text-gray-700">Sélectionnez un produit</label>
                </div>
                {loadingProducts ? (
                  <div className="text-sm text-gray-400">Chargement...</div>
                ) : (
                  <select
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    value={importProductId}
                    onChange={(e) => setImportProductId(Number(e.target.value))}
                  >
                    <option value="">Sélectionner un produit</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.sku}] {p.name} — {p.retailPrice} MAD
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Step 2: Download template */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-primary-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
                  <label className="text-sm font-bold text-gray-700">Téléchargez le template</label>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-50 border-2 border-dashed border-green-300 text-green-700 rounded-xl text-sm font-bold hover:bg-green-100 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Télécharger template_import_prospects.xlsx
                </button>
              </div>

              {/* Step 3: Upload file */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-primary-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
                  <label className="text-sm font-bold text-gray-700">Uploadez votre fichier rempli</label>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full flex-col cursor-pointer flex items-center justify-center gap-3 px-4 py-8 border-2 border-dashed rounded-xl transition-all ${
                    isDragging 
                      ? 'border-primary-500 bg-primary-50/50 scale-[1.02]' 
                      : 'border-gray-300 bg-gray-50 text-gray-400 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50/30'
                  }`}
                >
                  <UploadCloud size={32} className={isDragging ? 'text-primary-500 scale-110 transition-transform' : ''} />
                  <div className="text-center">
                    <p className={`text-sm font-bold ${isDragging ? 'text-primary-700' : 'text-gray-600'}`}>
                      Cliquez ou glissez-déposez pour uploader un fichier Excel
                    </p>
                    <p className="text-xs text-gray-400 mt-1">.xlsx, .xls, .csv autorisés</p>
                  </div>
                </div>
              </div>

              {/* Preview */}
              {importedLeads.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-gray-700">Aperçu ({importedLeads.length} prospects)</span>
                    <button
                      onClick={() => { setImportedLeads([]); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Supprimer
                    </button>
                  </div>
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 font-bold text-gray-400 text-xs">Nom</th>
                          <th className="px-3 py-2 font-bold text-gray-400 text-xs">Tél</th>
                          <th className="px-3 py-2 font-bold text-gray-400 text-xs">Ville</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {importedLeads.slice(0, 20).map((lead, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 text-gray-900">{lead.fullName}</td>
                            <td className="px-3 py-2 text-gray-600">{lead.phone}</td>
                            <td className="px-3 py-2 text-gray-600">{lead.city || '—'}</td>
                          </tr>
                        ))}
                        {importedLeads.length > 20 && (
                          <tr>
                            <td colSpan={3} className="px-3 py-2 text-center text-gray-400 text-xs">
                              ... et {importedLeads.length - 20} de plus
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-8 border-t border-slate-50 flex justify-end gap-4 bg-slate-50/50">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-6 py-4 bg-white text-slate-700 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm flex-1"
              >
                Annuler
              </button>
              <button
                onClick={handleImportLeads}
                disabled={importing || !importProductId || importedLeads.length === 0}
                className="px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:-translate-y-1 transition-transform shadow-xl shadow-indigo-500/20 flex-1 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {importing ? 'Import en cours...' : `Importer ${importedLeads.length} leads`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

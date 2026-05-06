import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ordersApi, leadsApi } from '../../lib/api';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { Package, UploadCloud, Plus, UserPlus, MapPin, Search, Phone, Trash2, Edit, CheckSquare, Square, CheckCircle2, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

interface MyProduct {
  id: number;
  sku: string;
  name: string;
  image: string | null;
  retailPrice: number;
  source: string;
}

// Unified row type to display both leads (pre-order) and orders
interface UnifiedRow {
  id: number;
  type: 'lead' | 'order';
  name: string;
  phone: string;
  city: string;
  address?: string;
  status: string;
  amount: number;
  vendorEarning?: number;
  productName?: string;
  productImage?: string;
  orderNumber?: string;
  items?: { productName: string; quantity: number }[];
  createdAt: string;
  leadId?: number; // original lead id for actions
  paymentMethod?: string;
}

export default function VendorOrders() {
  const [searchParams] = useSearchParams();
  const currentMode = searchParams.get('mode') || 'SELLER';
  
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

  // Selection state
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set());
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [duplicateCheck, setDuplicateCheck] = useState<{
    isOpen: boolean;
    ids: number[];
    groups: Record<string, UnifiedRow[]>;
  }>({
    isOpen: false,
    ids: [],
    groups: {},
  });

  // Edit state
  const [editingLead, setEditingLead] = useState<UnifiedRow | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Import state
  const [importProductId, setImportProductId] = useState<number | ''>('');
  const [importedLeads, setImportedLeads] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch orders
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', { status: statusFilter }],
    queryFn: () => ordersApi.list({ status: (statusFilter && statusFilter !== 'NEW' && statusFilter !== 'AVAILABLE') ? statusFilter : undefined }),
  });

  // Fetch leads (pre-orders that haven't been converted yet)
  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ['vendor-leads', { status: statusFilter, mode: currentMode }],
    queryFn: () => leadsApi.list({ 
      status: statusFilter || undefined, 
      limit: 100,
      mode: currentMode,
    }),
  });

  const rawOrders = ordersData?.data?.data?.orders || [];
  const rawLeads = leadsData?.data?.data?.leads || [];

  // Build lead list (filter out converted orders)
  const buildUnifiedRows = (): UnifiedRow[] => {
    const rows: UnifiedRow[] = [];

    for (const order of rawOrders) {
      rows.push({
        id: order.id,
        type: 'order',
        name: order.customerName,
        phone: order.customerPhone,
        city: order.customerCity || '-',
        address: order.customerAddress,
        status: order.status,
        amount: order.totalAmountMad,
        vendorEarning: order.vendorEarningMad,
        productName: order.items?.[0]?.product?.nameFr || 'Produit Wholesale',
        productImage: order.items?.[0]?.product?.images?.[0]?.imageUrl || undefined,
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        paymentMethod: order.paymentMethod,
      });
    }

    for (const lead of rawLeads) {
      // ONLY show leads with NEW status on this staging page
      if (lead.status !== 'NEW') continue;
      // Skip leads that already have an order
      if (lead.order) continue;

      rows.push({
        id: lead.id,
        type: 'lead',
        name: lead.fullName,
        phone: lead.phone,
        city: lead.city || '-',
        address: lead.address,
        status: lead.status,
        amount: lead.productPrice || 0,
        productName: lead.product?.nameFr || undefined,
        productImage: lead.product?.images?.[0]?.imageUrl || undefined,
        createdAt: lead.createdAt,
        leadId: lead.id,
      });
    }

    // Sort by newest first
    rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return rows;
  };

  const allRows = buildUnifiedRows();

  // Apply status filter for display
  const filteredRows = statusFilter
    ? allRows.filter(r => r.status === statusFilter)
    : allRows;

  // Cleanup selection if rows disappear due to filter
  useEffect(() => {
    const validIds = new Set(filteredRows.map(r => r.id));
    setSelectedLeads(prev => {
      const next = new Set([...prev].filter(id => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [statusFilter, leadsData]);

  const statusColors: Record<string, string> = {
    // Lead Statuses
    NEW: 'primary',
    AVAILABLE: 'warning',
    ASSIGNED: 'purple',
    CONTACTED: 'amber',
    INTERESTED: 'success',
    NOT_INTERESTED: 'rose',
    CALLBACK_REQUESTED: 'orange',
    CALL_LATER: 'orange',
    ORDERED: 'emerald',
    UNREACHABLE: 'gray',
    INVALID: 'rose',
    NO_REPLY: 'rose',
    WRONG_ORDER: 'rose',
    CANCEL_REASON_PRICE: 'rose',
    CANCEL_ORDER: 'rose',
    PUSHED_TO_DELIVERY: 'indigo',

    // Delivery Statuses (Coliaty 21)
    'NEW_PARCEL': 'primary',
    'WAITING_PICKUP': 'warning',
    'WAITING_PREPARATION': 'warning',
    'PREPARED': 'success',
    'ENCORE_PREPARED': 'primary',
    'PICKED_UP': 'primary',
    'SENT': 'indigo',
    'RECEIVED': 'indigo',
    'DISTRIBUTION': 'cyan',
    'PROGRAMMER_AUTO': 'purple',
    'POSTPONED': 'orange',
    'NOANSWER': 'rose',
    'ERR': 'rose',
    'PROGRAMMER': 'primary',
    'INCORRECT_ADDRESS': 'rose',
    'DELIVERED': 'success',
    'RETURNED': 'orange',
    'CANCELED_BY_SELLER': 'rose',
    'CANCELED_BY_SYSTEM': 'rose',
    'CANCELED': 'rose',
    'REFUSE': 'rose',

    // Compatibility
    PENDING: 'warning',
    CONFIRMED: 'primary',
    SHIPPED: 'indigo',
    CANCELLED: 'rose',
  };

  const statusLabels: Record<string, string> = {
    // Lead Statuses
    NEW: 'Nouveau',
    AVAILABLE: 'Disponible',
    ASSIGNED: 'Assigné',
    CONTACTED: 'Contacté',
    INTERESTED: 'Intéressé',
    NOT_INTERESTED: 'Pas intéressé',
    CALLBACK_REQUESTED: 'Rappel',
    CALL_LATER: 'Rappel',
    ORDERED: 'Commandé',
    UNREACHABLE: 'Injoignable',
    INVALID: 'Invalide',
    NO_REPLY: 'Pas de réponse',
    WRONG_ORDER: 'Fausse Commande',
    CANCEL_REASON_PRICE: 'Prix trop cher',
    CANCEL_ORDER: 'Annulé',
    PUSHED_TO_DELIVERY: 'En Livraison',

    // Delivery Statuses (Coliaty 21)
    'NEW_PARCEL': 'Nouveau Colis',
    'WAITING_PICKUP': 'Attente Collecte',
    'WAITING_PREPARATION': 'Attente Préparation',
    'PREPARED': 'Préparé',
    'ENCORE_PREPARED': 'En préparation',
    'PICKED_UP': 'Collecté',
    'SENT': 'Expédié',
    'RECEIVED': 'Reçu (Dest.)',
    'DISTRIBUTION': 'En livraison',
    'PROGRAMMER_AUTO': 'Livraison Auto',
    'POSTPONED': 'Reporté',
    'NOANSWER': 'Pas de réponse',
    'ERR': 'Tél Erroné',
    'PROGRAMMER': 'Programmé',
    'INCORRECT_ADDRESS': 'Adresse Erronée',
    'DELIVERED': 'Livré',
    'RETURNED': 'Retourné',
    'CANCELED_BY_SELLER': 'Annulé (Vendeur)',
    'CANCELED_BY_SYSTEM': 'Annulé (Système)',
    'CANCELED': 'Annulé (Livreur)',
    'REFUSE': 'Refusé',

    // Compatibility
    PENDING: 'En attente',
    CONFIRMED: 'Confirmé',
    SHIPPED: 'Expédié',
    CANCELLED: 'Annulé',
  };

  // Count per status for filter tabs
  const statusCounts: Record<string, number> = {};
  allRows.forEach(r => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  });

  const isLoading = ordersLoading || leadsLoading;

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await leadsApi.getMyProducts({ mode: currentMode });
      setProducts(res.data.data.products);
    } catch {
      toast.error('Erreur lors du chargement des produits');
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    if (showAddModal || showImportModal) {
      fetchProducts();
    }
  }, [showAddModal, showImportModal, currentMode]);

  const openEditModal = (lead: UnifiedRow) => {
    setEditingLead(lead);
    setFullName(lead.name);
    setPhone(lead.phone);
    setCity(lead.city !== '-' ? lead.city : '');
    setAddress(lead.address || '');
    setShowEditModal(true);
  };

  const openAddModal = () => {
    fetchProducts();
    setShowAddModal(true);
    setSelectedProductId('');
    setFullName('');
    setPhone('');
    setCity('');
    setAddress('');
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
        sourceMode: currentMode,
      });
      toast.success('Lead sauvegardé avec succès !');
      setShowAddModal(false);
      queryClient.invalidateQueries({ queryKey: ['vendor-leads'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateLead = async () => {
    if (!editingLead || !fullName || !phone) {
      toast.error('Veuillez remplir les champs obligatoires');
      return;
    }
    setSubmitting(true);
    try {
      await leadsApi.update(String(editingLead.id), {
        fullName,
        phone,
        city,
        address,
      });
      toast.success('Lead mis à jour avec succès !');
      setShowEditModal(false);
      queryClient.invalidateQueries({ queryKey: ['vendor-leads'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erreur lors de la mise à jour');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === filteredRows.length && filteredRows.length > 0) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredRows.map(r => r.id)));
    }
  };

  const toggleLeadSelection = (id: number) => {
    setSelectedLeads(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkSendToCallCenter = async (idsToPush?: number[]) => {
    const ids = idsToPush || Array.from(selectedLeads);
    if (ids.length === 0) return;

    // Find full lead objects for these ids
    const allRows = buildUnifiedRows();
    const leadsToProcess = allRows.filter(r => ids.includes(r.id) && r.type === 'lead');

    // Group by phone
    const groups: Record<string, UnifiedRow[]> = {};
    leadsToProcess.forEach(r => {
      const phone = r.phone || 'no-phone';
      if (!groups[phone]) groups[phone] = [];
      groups[phone].push(r);
    });

    const duplicateGroups = Object.values(groups).filter(g => g.length > 1);

    if (duplicateGroups.length > 0) {
      // Create a set of IDs to keep: for each group, only keep the first one
      const idsToKeep = new Set<number>();
      Object.values(groups).forEach(group => {
        if (group.length > 0) {
          idsToKeep.add(group[0].id);
        }
      });

      setDuplicateCheck({
        isOpen: true,
        ids: Array.from(idsToKeep),
        groups: groups
      });
    } else {
      proceedWithBulkSend(ids);
    }
  };

  const proceedWithBulkSend = async (ids: number[]) => {
    setIsBulkSubmitting(true);
    try {
      await leadsApi.bulkUpdateStatus({
        ids: ids,
        status: 'AVAILABLE'
      });
      toast.success(`${ids.length} leads envoyés au Call Center !`);
      setSelectedLeads(new Set());
      queryClient.invalidateQueries({ queryKey: ['vendor-leads'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erreur lors de l\'envoi groupé');
    } finally {
      setIsBulkSubmitting(false);
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
        
        // Force all cells to be read as strings to preserve leading zeros
        const jsonData = XLSX.utils.sheet_to_json<any>(sheet, { defval: '', raw: false });

        console.log('[Excel Import] Raw rows:', jsonData.length, 'Columns:', jsonData[0] ? Object.keys(jsonData[0]) : 'none');
        if (jsonData[0]) console.log('[Excel Import] First row:', jsonData[0]);

        const leads = jsonData
          .map(row => {
             // Try to find the name in various possible column names
             const nameKey = Object.keys(row).find(k => k.toLowerCase().includes('nom')) || Object.keys(row)[0];
             // Try to find the phone in various possible column names
             const phoneKey = Object.keys(row).find(k => k.toLowerCase().includes('tél') || k.toLowerCase().includes('tel') || k.toLowerCase().includes('phone')) || Object.keys(row)[1];
             const cityKey = Object.keys(row).find(k => k.toLowerCase().includes('ville') || k.toLowerCase().includes('city'));
             const addressKey = Object.keys(row).find(k => k.toLowerCase().includes('adresse') || k.toLowerCase().includes('address'));
             
             // Normalize phone: Excel often strips leading 0 from numbers
             let rawPhone = String(row[phoneKey] || '').trim();
             // Remove spaces, dashes, dots, parentheses
             rawPhone = rawPhone.replace(/[\s\-\.\(\)]/g, '');
             // If it's a 9-digit number (Excel stripped the leading 0), prepend 0
             if (/^\d{9}$/.test(rawPhone) && !rawPhone.startsWith('0')) {
               rawPhone = '0' + rawPhone;
             }
             // If it starts with +212, convert to 0-prefix for consistency
             if (rawPhone.startsWith('+212')) {
               rawPhone = '0' + rawPhone.slice(4);
             }
             if (rawPhone.startsWith('00212')) {
               rawPhone = '0' + rawPhone.slice(5);
             }

             return {
                fullName: String(row[nameKey] || '').trim(),
                phone: rawPhone,
                city: cityKey ? String(row[cityKey]).trim() : undefined,
                address: addressKey ? String(row[addressKey]).trim() : undefined,
             };
          })
          .filter(lead => lead.fullName && lead.phone && lead.phone.length >= 10); // Require name and valid phone

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
        sourceMode: currentMode,
      });
      const stats = res.data.data.batch;
      toast.success(`${stats.validRows} prospects importés, ${stats.duplicateRows} doublons ignorés`);
      setShowImportModal(false);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-leads'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur lors de l'import");
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteLead = async (leadId: number) => {
    if (!confirm('Supprimer ce lead ?')) return;
    try {
      await leadsApi.delete(String(leadId));
      toast.success('Lead supprimé');
      queryClient.invalidateQueries({ queryKey: ['vendor-leads'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erreur');
    }
  };

  // Pick display tabs – show lead statuses first, then order statuses
  const tabStatuses = [
    '', // All
    ...(['NEW', 'ASSIGNED', 'CONTACTED', 'INTERESTED', 'ORDERED'].filter(s => statusCounts[s])),
    ...(['NEW_PARCEL', 'PICKED_UP', 'SENT', 'DISTRIBUTION', 'DELIVERED', 'RETURNED', 'CANCELED'].filter(s => statusCounts[s])),
    ...(['PENDING', 'CONFIRMED', 'SHIPPED', 'CANCELLED'].filter(s => statusCounts[s])),
  ];

  return (
    <div className="space-y-6 pt-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
            Capture Leads <span className="text-primary-600">({currentMode === 'AFFILIATE' ? 'Affilié' : 'Vendeur'})</span>
          </h1>
          <p className="text-slate-500 font-medium">Gérez et préparez vos leads avant l'envoi au call center.</p>
          <p className="text-slate-500 mt-2 font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            {filteredRows.length} prospects à préparer
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

      {/* Selection Control */}
      {filteredRows.length > 0 && (
        <div className="flex items-center gap-4 bg-white/50 backdrop-blur-sm p-2 rounded-2xl border border-white/50 shadow-sm w-fit">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-white transition-all text-xs font-black uppercase tracking-widest text-slate-600"
          >
            {selectedLeads.size === filteredRows.length && filteredRows.length > 0 ? (
              <CheckSquare className="text-primary-600" size={18} />
            ) : (
              <Square className="text-slate-300" size={18} />
            )}
            {selectedLeads.size === filteredRows.length && filteredRows.length > 0 ? 'Tout Désélectionner' : 'Tout Sélectionner'}
          </button>
          
          {selectedLeads.size > 0 && (
            <div className="h-6 w-px bg-slate-200" />
          )}
          
          {selectedLeads.size > 0 && (
            <span className="text-[10px] font-black uppercase tracking-widest text-primary-600 px-2 animate-pulse">
              {selectedLeads.size} sélectionné(s)
            </span>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bento-card border-none bg-white p-4 shadow-sm flex gap-2 overflow-x-auto scrollbar-hide">
        {['', 'NEW', 'AVAILABLE', 'ASSIGNED', 'CONTACTED', 'INTERESTED', 'INVALID'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-5 py-3 rounded-2xl whitespace-nowrap text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 ${
              statusFilter === status 
                ? 'bg-[#2c2f74] text-white shadow-lg shadow-indigo-900/20 scale-105' 
                : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 border border-transparent hover:border-slate-200'
            }`}
          >
            {status ? (statusLabels[status] || status) : 'Tout'}
            {status && statusCounts[status] ? (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                statusFilter === status ? 'bg-white/20' : 'bg-slate-200 text-slate-500'
              }`}>
                {statusCounts[status]}
              </span>
            ) : !status ? (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                statusFilter === '' ? 'bg-white/20' : 'bg-slate-200 text-slate-500'
              }`}>
                {allRows.length}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-20 flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-primary-500 rounded-full animate-spin mb-4" />
          <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Chargement...</p>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="bento-card border-none bg-white p-12 text-center shadow-sm">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-blue-100">
            <Plus size={40} className="text-blue-500" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-3">Aucun prospect</h3>
          <p className="text-slate-500 font-medium mb-8 max-w-sm mx-auto">Importez vos fichiers Excel ou ajoutez manuellement vos prospects pour commencer le traitement.</p>
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
          {filteredRows.map((row) => (
            <div 
              key={`${row.type}-${row.id}`} 
              className={`bento-card border-none p-6 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col gap-4 ${
                selectedLeads.has(row.id) ? 'bg-primary-50 ring-2 ring-primary-500' : 'bg-white'
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Checkbox */}
                <button 
                  onClick={() => toggleLeadSelection(row.id)}
                  className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                    selectedLeads.has(row.id) ? 'bg-primary-500 text-white' : 'bg-slate-50 text-slate-300 hover:text-slate-400'
                  }`}
                >
                  {selectedLeads.has(row.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                </button>

                <div className="flex-1 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-[1.2rem] flex items-center justify-center border shrink-0 bg-blue-50 border-blue-100">
                      {row.productImage ? (
                        <img src={row.productImage} alt="" className="w-full h-full rounded-[1.2rem] object-cover" />
                      ) : (
                        <Package className="w-8 h-8 text-blue-500 opacity-80" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className="font-black text-slate-900 tracking-tight">{row.name}</span>
                        <span className={`badge badge-${statusColors[row.status] || 'gray'}`}>
                          {statusLabels[row.status] || row.status}
                        </span>
                      </div>
                      <div className="text-sm text-slate-500 font-medium flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {row.phone}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {row.city}
                        </span>
                        {row.productName && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                            <span className="text-primary-600 font-bold">{row.productName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 justify-between lg:justify-end">
                    {row.amount > 0 && (
                      <div className="text-right">
                        <div className="font-black text-xl text-slate-900 leading-none mb-1 text-center xl:text-right">
                          {row.amount.toLocaleString()} <span className="text-xs uppercase text-slate-400">MAD</span>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                       {row.paymentMethod === 'WHOLESALE_CREDIT' && (
                        <Link
                          to={`/dashboard/chat?orderNum=${row.orderNumber}`}
                          className="p-2.5 text-violet-600 hover:bg-violet-50 rounded-xl transition-colors"
                          title="Voir la discussion"
                        >
                          <MessageSquare size={16} />
                        </Link>
                      )}
                       <button
                        onClick={() => openEditModal(row)}
                        className="p-2.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-colors"
                        title="Modifier ce lead"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteLead(row.id)}
                        className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        title="Supprimer ce lead"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {row.items && row.items.length > 0 && (
                <div className="mt-2 pt-4 border-t border-slate-50">
                  <div className="flex flex-wrap gap-2">
                    {row.items.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2">
                        <span className="text-sm font-bold text-slate-700">{item.productName}</span>
                        <span className="px-2 py-0.5 bg-white rounded truncate text-[10px] font-black text-primary-600 border border-slate-200">
                          X{item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Bulk Action Bar */}
      {selectedLeads.size > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-bottom-10 duration-500">
          <div className="bg-[#2c2f74] text-white px-8 py-5 rounded-[2.5rem] shadow-2xl shadow-indigo-900/40 flex items-center gap-8 border border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center font-black text-lg">
                {selectedLeads.size}
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest leading-none">Sélectionnés</p>
                <p className="text-[10px] font-medium text-indigo-200 mt-1">Actions groupées</p>
              </div>
            </div>
            
            <div className="h-10 w-px bg-white/10" />
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleBulkSendToCallCenter}
                disabled={isBulkSubmitting}
                className="px-6 py-3 bg-white text-[#2c2f74] rounded-2xl text-[11px] font-black uppercase tracking-widest hover:scale-105 transition-transform flex items-center gap-2 shadow-lg disabled:opacity-50"
              >
                {isBulkSubmitting ? (
                   <div className="w-4 h-4 border-2 border-[#2c2f74] border-t-transparent rounded-full animate-spin" />
                ) : <CheckCircle2 size={16} />}
                Envoyer au Call Center
              </button>
              
              <button
                onClick={() => setSelectedLeads(new Set())}
                className="px-6 py-3 bg-white/10 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white/20 transition-all border border-white/10"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Duplicate Check Modal */}
      {duplicateCheck.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[150] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-white/20 animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                      <Plus className="w-6 h-6 text-amber-500" />
                    </div>
                    Vérification des Doublons
                  </h2>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-2">
                    {Object.values(duplicateCheck.groups).filter(g => g.length > 1).length} groupes de numéros identiques trouvés
                  </p>
                </div>
                <button
                  onClick={() => setDuplicateCheck(prev => ({ ...prev, isOpen: false }))}
                  className="p-3 rounded-2xl bg-gray-50 text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-4">
                <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <p className="text-sm font-black text-amber-900 uppercase tracking-tight">Optimisation de l'envoi</p>
                  <p className="text-xs text-amber-700/70 font-medium mt-1 leading-relaxed">
                    Nous avons détecté des prospects avec le même numéro de téléphone. Veuillez sélectionner uniquement ceux que vous souhaitez envoyer au Call Center.
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {Object.entries(duplicateCheck.groups)
                  .filter(([_, group]) => group.length > 1)
                  .map(([phone, group], groupIdx) => (
                    <div key={phone} className="bg-slate-50/50 border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm transition-all hover:shadow-md">
                      <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                            <Phone className="w-4 h-4 text-slate-400" />
                          </div>
                          <span className="text-sm font-black text-slate-700 tracking-tight">{phone}</span>
                        </div>
                        <span className="px-3 py-1 bg-white rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-100">
                          {group.length} Doublons
                        </span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {group.map((row) => {
                          const isSelected = duplicateCheck.ids.includes(row.id);
                          return (
                            <div 
                              key={row.id} 
                              onClick={() => {
                                setDuplicateCheck(prev => {
                                  const newIds = prev.ids.includes(row.id) 
                                    ? prev.ids.filter(id => id !== row.id)
                                    : [...prev.ids, row.id];
                                  return { ...prev, ids: newIds };
                                });
                              }}
                              className={`p-6 flex items-center gap-4 cursor-pointer transition-all ${
                                isSelected ? 'bg-white' : 'opacity-60 grayscale-[0.5]'
                              }`}
                            >
                              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                isSelected 
                                  ? 'bg-primary-500 border-primary-500 text-white shadow-lg shadow-primary-500/20' 
                                  : 'border-slate-200'
                              }`}>
                                {isSelected && <CheckCircle2 size={14} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-black text-slate-900 truncate tracking-tight">{row.name}</p>
                                <div className="flex items-center gap-3 mt-1.5">
                                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                                    <MapPin size={10} /> {row.city || '—'}
                                  </span>
                                  <span className="w-1 h-1 rounded-full bg-slate-200" />
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                                    {row.productName || 'Produit inconnu'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="p-8 bg-slate-50/50 border-t border-gray-100 flex gap-4">
              <button
                onClick={() => setDuplicateCheck(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 px-8 py-4 bg-white text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-slate-200 hover:bg-gray-50 transition-all"
              >
                Annuler
              </button>
              {(() => {
                const hasDuplicateSelections = Object.entries(duplicateCheck.groups).some(([phone, group]) => {
                  const selectedCountInGroup = group.filter(row => duplicateCheck.ids.includes(row.id)).length;
                  return selectedCountInGroup > 1;
                });

                return (
                  <button
                    onClick={() => {
                      setDuplicateCheck(prev => ({ ...prev, isOpen: false }));
                      proceedWithBulkSend(duplicateCheck.ids);
                    }}
                    disabled={hasDuplicateSelections || duplicateCheck.ids.length === 0}
                    className={`flex-[2] px-8 py-4 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2 ${
                      hasDuplicateSelections || duplicateCheck.ids.length === 0
                        ? 'bg-gray-300 cursor-not-allowed shadow-none'
                        : 'bg-[#2c2f74] hover:scale-105 shadow-indigo-900/20'
                    }`}
                  >
                    <CheckCircle2 size={16} />
                    {hasDuplicateSelections ? 'Doublons sélectionnés' : `Confirmer l'envoi (${duplicateCheck.ids.length})`}
                  </button>
                );
              })()}
            </div>
          </div>
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

      {/* Edit Lead Modal */}
      {showEditModal && editingLead && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-50">
              <div className="flex items-center justify-between">
                <div>
                   <h2 className="text-2xl font-black text-slate-900 tracking-tight">Modifier le Lead</h2>
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">Mise à jour des informations</p>
                </div>
                <button onClick={() => setShowEditModal(false)} className="w-10 h-10 bg-slate-50 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full flex items-center justify-center transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Nom du Client *</label>
                <input
                  type="text"
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all shadow-sm"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nom complet"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Contact (Tel) *</label>
                <input
                  type="text"
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all shadow-sm"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Téléphone"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Ville</label>
                  <input
                    type="text"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all shadow-sm"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ville"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Adresse / Note</label>
                  <input
                    type="text"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all shadow-sm"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Adresse"
                  />
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-slate-50 flex justify-end gap-4 bg-slate-50/50">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-6 py-4 bg-white text-slate-700 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm flex-1"
              >
                Annuler
              </button>
              <button
                onClick={handleUpdateLead}
                disabled={submitting || !fullName || !phone}
                className="px-6 py-4 bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:-translate-y-1 transition-transform shadow-xl shadow-indigo-500/20 flex-1 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {submitting ? 'Mise à jour...' : 'Sauvegarder'}
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

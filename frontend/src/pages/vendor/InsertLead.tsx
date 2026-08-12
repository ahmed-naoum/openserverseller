import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { leadsApi } from '../../lib/api';
import toast from 'react-hot-toast';
import {
  User, 
  Phone, 
  MapPin, 
  ArrowLeft,
  Eye,
  ShieldAlert,
  Info,
  Package,
  Trash2,
  Truck,
  Pencil,
  FileSpreadsheet,
  HelpCircle,
  X
} from 'lucide-react';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { CitySelect } from '../../components/ui/CitySelect';
import { currentBasePath } from '../../lib/dashboardBase';

/**
 * `xlsx` is ~1.4 MB unminified and this screen is the only vendor page that
 * touches it — for the template download and the bulk import, both behind a
 * click. Imported statically it landed in the bundle every page preloads, so it
 * was paid for by every visitor including one who never logs in.
 */
const loadXlsx = () => import('xlsx');

export default function VendorInsertLead() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Use mode from URL, fallback to user context, or default to SELLER
  const currentMode = searchParams.get('mode') || user?.mode || 'SELLER';

  // Data states
  const [products, setProducts] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  
  // Loading states
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingCities, setLoadingCities] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [packageReplacement, setPackageReplacement] = useState(false);
  const [packageOldTracking, setPackageOldTracking] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [packName, setPackName] = useState('');
  const [qte, setQte] = useState<number>(1);
  const [source, setSource] = useState<'MANUAL' | 'WHATSAPP'>('MANUAL');
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // --- NOUVEAUX ÉTATS POUR LA LISTE D'ATTENTE ---
  const [allDrafts, setAllDrafts] = useState<Record<string, any[]>>(() => {
    const sellerSaved = localStorage.getItem('draftLeads_SELLER');
    const affiliateSaved = localStorage.getItem('draftLeads_AFFILIATE');
    return {
      SELLER: sellerSaved ? JSON.parse(sellerSaved) : [],
      AFFILIATE: affiliateSaved ? JSON.parse(affiliateSaved) : [],
    };
  });
  const [isInsertingAll, setIsInsertingAll] = useState(false);

  const draftLeads = allDrafts[currentMode] || [];

  const updateDraftLeads = (newValOrFn: any[] | ((prev: any[]) => any[])) => {
    setAllDrafts(prev => {
      const currentDrafts = prev[currentMode] || [];
      const updated = typeof newValOrFn === 'function' ? (newValOrFn as Function)(currentDrafts) : newValOrFn;
      localStorage.setItem(`draftLeads_${currentMode}`, JSON.stringify(updated));
      return {
        ...prev,
        [currentMode]: updated
      };
    });
  };

  // History states
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyData, setHistoryData] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load cities on mount
  useEffect(() => {
    const loadCities = async () => {
      try {
        const citiesRes = await leadsApi.getColiatyCities();
        if (citiesRes.data?.data) {
          setCities(citiesRes.data.data);
        } else {
          setCities(citiesRes.data);
        }
      } catch (err) {
        console.error('Failed to load cities:', err);
      } finally {
        setLoadingCities(false);
      }
    };
    loadCities();
  }, []);

  // Fetch products dynamically for the vendor this session sells for. For a
  // sub-account that is the parent vendor, not the logged-in user, so `vendorId`
  // is what the API expects — `user.id` would come back empty.
  const sellingVendorId = user?.vendorId ?? user?.id;

  useEffect(() => {
    if (!sellingVendorId) return;

    const loadProducts = async () => {
      setLoadingProducts(true);
      try {
        const res = await leadsApi.getProductsByVendor(sellingVendorId);
        let allProducts = [];
        if (res.data?.status === 'success') {
          allProducts = res.data.data;
        } else {
          allProducts = res.data;
        }

        // Filter products based on current mode
        const filteredProducts = allProducts.filter((p: any) => {
          const isOwned = Number(p.ownerId) === Number(sellingVendorId);
          if (currentMode === 'SELLER') {
            // Sell owned products or products imported in inventory
            return isOwned || p.hasInventory === true;
          } else {
            // Affiliate mode: only claimed products that are NOT owned by the vendor
            return !isOwned && (p.isClaimed === true || p.isClaimed === undefined);
          }
        });

        setProducts(filteredProducts);
      } catch (err) {
        console.error('Failed to load products:', err);
        toast.error('Impossible de charger vos produits');
      } finally {
        setLoadingProducts(false);
      }
    };
    loadProducts();
  }, [sellingVendorId, currentMode]);

  // Auto-fetch history when phone number is complete
  useEffect(() => {
    const cleaned = phone.replace(/\s+/g, '');
    const isComplete = cleaned.length === 10 || (cleaned.startsWith('+212') && cleaned.length >= 13);
    
    if (isComplete) {
      const timer = setTimeout(() => {
        handleViewHistory(true);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setHistoryData(null);
    }
  }, [phone]);

  // Reset form when switching mode
  useEffect(() => {
    setFullName('');
    setPhone('');
    setCity('');
    setAddress('');
    setNotes('');
    setPackageReplacement(false);
    setPackageOldTracking('');
    setCustomPrice('');
    setPackName('');
    setQte(1);
    setSource('MANUAL');
    setFormErrors({});
  }, [currentMode]);

  const handlePhoneChange = (val: string) => {
    setPhone(val);
  };

  const handleViewHistory = async (silent = false) => {
    const cleaned = phone.replace(/\s+/g, '');
    const isComplete = cleaned.length === 10 || (cleaned.startsWith('+212') && cleaned.length >= 13);
    
    if (!isComplete) {
      if (!silent) toast.error('Veuillez entrer un numéro complet (10 chiffres ou +212...)');
      return;
    }
    setLoadingHistory(true);
    if (!silent) setShowHistoryModal(true);
    try {
      const res = await leadsApi.getHistoryByPhone(phone);
      setHistoryData(res.data?.data || res.data);
    } catch (err: any) {
      if (!silent) toast.error('Impossible de récupérer l\'historique');
      if (!silent) setShowHistoryModal(false);
    } finally {
      setLoadingHistory(false);
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!selectedProductId) errors.product = 'Veuillez sélectionner un produit';
    if (!fullName.trim() || fullName.trim().length < 3) errors.fullName = 'Le nom complet doit contenir au moins 3 caractères';
    
    const phoneDigits = phone.replace(/\D/g, '');
    const isMoroccan = /^(\+212|0)[0-9]{9}$/.test(phone);
    if (!phone || !isMoroccan) {
      errors.phone = 'Le numéro de téléphone doit être valide au Maroc (ex: 0612345678)';
    }

    if (!city) errors.city = 'Veuillez choisir une ville';
    if (!address.trim() || address.trim().length < 8) errors.address = "L'adresse doit être plus détaillée (min. 8 caractères)";

    if (packageReplacement && !packageOldTracking.trim()) {
      errors.packageOldTracking = "Le numéro de suivi du colis à remplacer est requis.";
    }

    if (customPrice && (isNaN(Number(customPrice)) || Number(customPrice) < 0)) {
      errors.customPrice = "Le prix personnalisé doit être un nombre positif.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCancelEdit = () => {
    setEditingDraftId(null);
    setSelectedProductId('');
    setFullName('');
    setPhone('');
    setCity('');
    setAddress('');
    setNotes('');
    setPackageReplacement(false);
    setPackageOldTracking('');
    setCustomPrice('');
    setPackName('');
    setQte(1);
    setSource('MANUAL');
    setFormErrors({});
  };

  const handleEditDraft = (draft: any) => {
    setEditingDraftId(draft.id);
    setSelectedProductId(draft.productId);
    setFullName(draft.fullName);
    setPhone(draft.phone);
    setCity(draft.city);
    setAddress(draft.address);
    setNotes(draft.notes || '');
    setPackageReplacement(draft.package_replacement || false);
    setPackageOldTracking(draft.package_old_tracking || '');
    setCustomPrice(draft.customPrice !== undefined ? String(draft.customPrice) : '');
    setPackName(draft.packName || '');
    setQte(draft.qte || 1);
    setSource(draft.source || 'MANUAL');
    setFormErrors({});
  };

  const downloadTemplate = async () => {
    const templateData = [
      {
        "Nom Complet": "Ali Mansour",
        "Téléphone": "0600000000",
        "Ville": "Casablanca",
        "Adresse": "Anfa, Boulevard d'Anfa, Résidence 4",
        "SKU/Produit": products[0]?.sku || "SKU-EXEMPLE",
        "Nom du Pack": "Pack Gold",
        "Quantité": 1,
        "Prix": 199,
        "Notes": "Appeler le client avant midi"
      }
    ];

    // The first click pays for the chunk, so the button says so rather than
    // sitting silent for the fetch.
    const toastId = toast.loading('Préparation du modèle...');
    try {
      const XLSX = await loadXlsx();
      const worksheet = XLSX.utils.json_to_sheet(templateData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Template Leads");
      XLSX.writeFile(workbook, "modele_import_leads.xlsx");
      toast.dismiss(toastId);
    } catch {
      toast.error("Impossible de charger le module Excel.", { id: toastId });
    }
  };

  const normalizeStr = (str: string) => {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ');
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const XLSX = await loadXlsx();
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];

        if (!jsonData || jsonData.length === 0) {
          toast.error("Le fichier Excel est vide");
          return;
        }

        const newDrafts: any[] = [];
        let importedCount = 0;
        let missingProductCount = 0;
        let missingNamePhoneCount = 0;

        for (const row of jsonData) {
          const findVal = (keys: string[]) => {
            const normalizedKeys = keys.map(k => normalizeStr(k));
            const foundKey = Object.keys(row).find(k => 
              normalizedKeys.includes(normalizeStr(k))
            );
            return foundKey ? row[foundKey] : undefined;
          };

          const rowName = findVal(['nom complet', 'nom', 'client', 'name', 'full name', 'fullname']);
          const rowPhone = findVal(['telephone', 'téléphone', 'phone', 'contact', 'n°', 'mobile', 'tel', 'numero', 'num']);
          const rowCity = findVal(['ville', 'city']);
          const rowAddress = findVal(['adresse', 'address']);
          const rowProduct = findVal(['produit', 'product', 'sku', 'code', 'sku/produit', 'sku/product', 'sku produit', 'sku product']);
          const rowPackName = findVal(['pack', 'pack name', 'nom du pack', 'variant', 'variante']);
          const rowQte = findVal(['quantite', 'quantité', 'qte', 'qty', 'quantity']);
          const rowPrice = findVal(['prix', 'price', 'custom price', 'prix custom', 'montant']);
          const rowNotes = findVal(['note', 'notes', 'commentaire']);

          if (!rowName || !rowPhone || !rowCity || !rowAddress || !rowProduct) {
            missingNamePhoneCount++;
            continue;
          }

          let matchedProduct = null;
          if (rowProduct) {
            const cleanProd = String(rowProduct).toLowerCase().trim();
            matchedProduct = products.find(p => 
              p.id === Number(rowProduct) ||
              p.sku.toLowerCase().trim() === cleanProd ||
              p.name.toLowerCase().trim().includes(cleanProd)
            );
          }

          const finalProduct = matchedProduct || products.find(p => p.id === selectedProductId);
          if (!finalProduct) {
            missingProductCount++;
            continue;
          }

          let cleanPhone = String(rowPhone).trim();
          if (!cleanPhone.startsWith('+') && !cleanPhone.startsWith('0')) {
            cleanPhone = '0' + cleanPhone;
          }

          let finalCity = '';
          if (rowCity) {
            const cleanCity = String(rowCity).toLowerCase().trim();
            const matchedCity = cities.find(c => c.city_name.toLowerCase().trim() === cleanCity);
            finalCity = matchedCity ? matchedCity.city_name : String(rowCity);
          } else {
            finalCity = city || 'Casablanca';
          }

          const draft = {
            id: `${Date.now()}-${Math.random()}`,
            fullName: String(rowName).trim(),
            phone: cleanPhone,
            whatsapp: cleanPhone,
            city: finalCity,
            address: rowAddress ? String(rowAddress).trim() : address || finalCity,
            productId: finalProduct.id,
            vendorId: user?.id,
            notes: rowNotes ? String(rowNotes).trim() : notes,
            sourceMode: currentMode,
            source: 'MANUAL' as const,
            package_replacement: false,
            package_old_tracking: '',
            package_note: rowNotes ? String(rowNotes).trim() : notes,
            customPrice: rowPrice ? Number(rowPrice) : (customPrice !== '' ? Number(customPrice) : undefined),
            packName: rowPackName ? String(rowPackName).trim() : (packName || undefined),
            qte: rowQte ? Math.max(1, Number(rowQte) || 1) : qte,
            skipColiaty: true,
            _productName: finalProduct.name,
            _productImage: finalProduct.image || '',
          };

          newDrafts.push(draft);
          importedCount++;
        }

        if (newDrafts.length > 0) {
          updateDraftLeads(prev => [...prev, ...newDrafts]);
          let msg = `${importedCount} lead(s) importé(s) avec succès !`;
          if (missingProductCount > 0 || missingNamePhoneCount > 0) {
            const reasons = [];
            if (missingProductCount > 0) reasons.push(`${missingProductCount} produit introuvable`);
            if (missingNamePhoneCount > 0) reasons.push(`${missingNamePhoneCount} champs requis manquants`);
            msg += ` (${reasons.join(', ')} ignoré(s))`;
          }
          toast.success(msg);
        } else {
          if (missingProductCount > 0) {
            toast.error("Aucun lead importé. Cause : Produit introuvable (sélectionnez d'abord un produit à gauche ou spécifiez un SKU correct).");
          } else {
            toast.error("Aucun lead valide trouvé. Assurez-vous que les colonnes 'Nom Complet', 'Téléphone', 'Ville', 'Adresse' et 'SKU/Produit' sont bien présentes.");
          }
        }
      } catch (err) {
        console.error(err);
        toast.error("Impossible de lire le fichier Excel");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleAddToDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Veuillez corriger les erreurs du formulaire');
      return;
    }

    const draftData = {
      fullName,
      phone,
      whatsapp: phone,
      city,
      address,
      productId: Number(selectedProductId),
      vendorId: user?.id,
      notes,
      sourceMode: currentMode,
      source,
      package_replacement: packageReplacement,
      package_old_tracking: packageReplacement ? packageOldTracking : '',
      package_note: notes,
      customPrice: customPrice !== '' ? Number(customPrice) : undefined,
      packName: packName || undefined,
      qte: Number(qte),
      skipColiaty: true,
      // Info pour l'affichage (ne sera pas envoyé à l'API)
      _productName: products.find(p => p.id === selectedProductId)?.name || '',
      _productImage: products.find(p => p.id === selectedProductId)?.image || '',
    };

    if (editingDraftId) {
      updateDraftLeads(prev => prev.map(lead => lead.id === editingDraftId ? { ...lead, ...draftData } : lead));
      toast.success('Lead mis à jour dans la liste d\'attente !');
      setEditingDraftId(null);
    } else {
      updateDraftLeads(prev => [...prev, { id: Date.now().toString(), ...draftData }]);
      toast.success('Lead ajouté à la liste d\'attente !');
    }
    
    // Reset form
    setFullName('');
    setPhone('');
    setCity('');
    setAddress('');
    setNotes('');
    setPackageReplacement(false);
    setPackageOldTracking('');
    setCustomPrice('');
    setPackName('');
    setQte(1);
    setSource('MANUAL');
    setFormErrors({});
  };

  const removeDraft = (id: string) => {
    if (editingDraftId === id) {
      handleCancelEdit();
    }
    updateDraftLeads(prev => prev.filter(lead => lead.id !== id));
  };

  const handleInsertAll = async () => {
    if (draftLeads.length === 0) return;
    
    setIsInsertingAll(true);
    let successCount = 0;
    let errorCount = 0;

    for (const draft of draftLeads) {
      try {
        const { id, _productName, _productImage, ...apiData } = draft;
        await leadsApi.create(apiData);
        successCount++;
      } catch (err: any) {
        console.error('Failed to create lead:', err);
        toast.error(`Erreur pour ${draft.fullName}: ${err.response?.data?.message || 'Erreur inconnue'}`);
        errorCount++;
      }
    }

    setIsInsertingAll(false);
    
    // Empty the draft list completely
    updateDraftLeads([]);

    if (successCount > 0) {
      toast.success(`${successCount} lead(s) inséré(s) avec succès !`);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4">
      {/* Header card */}
      <div className={`rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden transition-all duration-500 ${
        currentMode === 'SELLER' 
          ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600'
          : 'bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-600'
      }`}>
        <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]"></div>
        
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(`${currentBasePath(user?.role)}/leads?mode=${currentMode}`)}
              className="bg-white/20 hover:bg-white/30 p-2.5 rounded-full transition-all shadow-md active:scale-95 flex items-center justify-center text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 rounded-full text-xs font-black uppercase tracking-wider mb-2">
                {currentMode === 'SELLER' ? (t('lead_mode_seller', 'dashboard') || 'Mode Vendeur') : (t('lead_mode_affiliate', 'dashboard') || 'Mode Affilié')}
              </div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2">
                {t('lead_insert_new', 'dashboard') || 'Insérer un Nouveau Lead'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="bg-white/20 hover:bg-white/30 text-white p-2.5 rounded-2xl transition-all shadow-md active:scale-95 flex items-center justify-center"
              title={t('lead_import_template_title', 'dashboard') || "Voir le modèle d'importation Excel"}
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            
            <label className="bg-white/20 hover:bg-white/30 text-white px-4 py-2.5 rounded-2xl transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer text-xs font-black uppercase tracking-wider">
              <FileSpreadsheet className="w-4 h-4" />
              {t('lead_import_excel', 'dashboard') || 'Importer Excel'}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileImport}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column: Form Card */}
        <div className="xl:col-span-5 w-full">
          <form onSubmit={handleAddToDraft} className="bg-white rounded-3xl border border-gray-100 shadow-xl p-5 sm:p-6 relative">
            <div className="space-y-8">
              
              {/* Section 1: Product Info */}
              <div className="space-y-4">
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-gray-100 pb-2">
                  <Package className={`w-4 h-4 ${currentMode === 'SELLER' ? 'text-emerald-500' : 'text-indigo-500'}`} />
                  {t('lead_section_product', 'dashboard') || '1. Sélection du Produit'}
                </h2>
                
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase mb-1">{t('lead_associate_product', 'dashboard') || 'Associer un Produit'}</label>
                    {loadingProducts ? (
                      <div className="h-11 bg-gray-50 border border-gray-100 rounded-xl animate-pulse"></div>
                    ) : (
                      <SearchableSelect
                        options={products.map(p => ({
                          value: p.id,
                          label: `${p.name} - SKU: ${p.sku} (${Number(p.retailPriceMad).toFixed(2)} MAD)`
                        }))}
                        value={selectedProductId}
                        onChange={(val) => setSelectedProductId(val as number)}
                        placeholder={products.length === 0 ? (t('lead_no_product_avail', 'dashboard') || "Aucun produit disponible") : (t('lead_choose_product', 'dashboard') || "Choisissez le produit...")}
                        searchPlaceholder={t('lead_search_product', 'dashboard') || "Rechercher un produit ou SKU..."}
                        error={!!formErrors.product}
                      />
                    )}
                    {formErrors.product && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.product}</p>}
                  </div>
                </div>

                {/* Selected Product Details card */}
                {selectedProductId && products.find(p => p.id === selectedProductId) && (() => {
                  const p = products.find(prod => prod.id === selectedProductId);
                  return (
                    <div className={`p-4 rounded-2xl border flex items-center gap-4 transition-all duration-300 ${
                      currentMode === 'SELLER' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-indigo-50/50 border-indigo-100'
                    }`}>
                      {p.image ? (
                        <img src={p.image} alt="" className="w-12 h-12 rounded-xl object-cover border border-gray-100 bg-white" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-xs font-black text-gray-400 border border-gray-200">
                          IMG
                        </div>
                      )}
                      <div>
                        <h3 className="text-sm font-black text-gray-800">{p.name}</h3>
                        <p className="text-[10px] text-gray-400 font-bold">SKU: {p.sku}</p>
                        <p className={`text-xs font-black mt-1 ${currentMode === 'SELLER' ? 'text-emerald-600' : 'text-indigo-600'}`}>
                          Prix: {Number(p.retailPriceMad).toFixed(2)} MAD
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Custom pricing, pack name and quantity configuration */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase mb-1">{t('lead_pack_name', 'dashboard') || 'Nom du Pack'}</label>
                    <input
                      type="text"
                      disabled={!selectedProductId}
                      value={packName}
                      onChange={(e) => setPackName(e.target.value)}
                      placeholder={selectedProductId ? (t('lead_pack_placeholder', 'dashboard') || "Ex: Pack 2 + 1 Gratuit...") : (t('lead_select_product_first', 'dashboard') || "Sélectionnez un produit d'abord")}
                      className={`w-full h-11 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 outline-none text-sm font-semibold shadow-sm ${
                        !selectedProductId ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''
                      } ${currentMode === 'SELLER' ? 'focus:ring-emerald-400' : 'focus:ring-indigo-400'}`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase mb-1">{t('lead_quantity', 'dashboard') || 'Quantité'}</label>
                    <input
                      type="number"
                      min="1"
                      required
                      disabled={!selectedProductId}
                      value={qte}
                      onChange={(e) => setQte(Math.max(1, parseInt(e.target.value) || 1))}
                      placeholder={t('lead_quantity', 'dashboard') || "Quantité"}
                      className={`w-full h-11 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 outline-none text-sm font-semibold shadow-sm ${
                        !selectedProductId ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''
                      } ${currentMode === 'SELLER' ? 'focus:ring-emerald-400' : 'focus:ring-indigo-400'}`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase mb-1">{t('lead_price_mad', 'dashboard') || 'Prix (MAD)'}</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={!selectedProductId}
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      placeholder={
                        selectedProductId 
                          ? `${t('lead_price_standard', 'dashboard') || 'Standard'}: ${Number((products.find(p => p.id === selectedProductId)?.retailPriceMad || 0) * qte).toFixed(2)} MAD` 
                          : (t('lead_select_product_first', 'dashboard') || "Sélectionnez un produit d'abord")
                      }
                      className={`w-full h-11 px-4 py-2.5 border rounded-xl focus:ring-2 outline-none text-sm font-semibold shadow-sm ${
                        !selectedProductId ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''
                      } ${formErrors.customPrice ? 'border-red-300 bg-red-50 focus:ring-red-400' : 'border-gray-200'} ${
                        currentMode === 'SELLER' ? 'focus:ring-emerald-400' : 'focus:ring-indigo-400'
                      }`}
                    />
                    {formErrors.customPrice && (
                      <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.customPrice}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 2: Customer Details */}
              <div className="space-y-4">
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-gray-100 pb-2">
                  <Phone className={`w-4 h-4 ${currentMode === 'SELLER' ? 'text-emerald-500' : 'text-indigo-500'}`} />
                  {t('lead_section_customer', 'dashboard') || '2. Informations du Client'}
                </h2>
                
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase mb-1">{t('lead_customer_name', 'dashboard') || 'Nom complet du client'}</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <User className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={t('lead_customer_name_placeholder', 'dashboard') || "Ex: Ahmed Naoum"}
                        className={`w-full pl-9 pr-4 h-11 py-2.5 border rounded-xl focus:ring-2 outline-none text-sm font-semibold shadow-sm ${
                          formErrors.fullName ? 'border-red-300 bg-red-50 focus:ring-red-400' : 'border-gray-200'
                        } ${currentMode === 'SELLER' ? 'focus:ring-emerald-400' : 'focus:ring-indigo-400'}`}
                      />
                    </div>
                    {formErrors.fullName && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.fullName}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase mb-1">{t('lead_phone', 'dashboard') || 'N° de Téléphone'}</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            <Phone className="w-4 h-4" />
                          </span>
                          <input
                            type="tel"
                            required
                            value={phone}
                            onChange={(e) => handlePhoneChange(e.target.value)}
                            placeholder={t('lead_phone_placeholder', 'dashboard') || "Ex: 0612345678"}
                            className={`w-full pl-9 pr-4 h-11 py-2.5 border rounded-xl focus:ring-2 outline-none text-sm font-semibold shadow-sm ${
                              formErrors.phone ? 'border-red-300 bg-red-50 focus:ring-red-400' : 'border-gray-200'
                            } ${currentMode === 'SELLER' ? 'focus:ring-emerald-400' : 'focus:ring-indigo-400'}`}
                          />
                        </div>
                      </div>
                    {formErrors.phone && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.phone}</p>}
                    
                    {/* Inline Trust Score */}
                    <div className="mt-3">
                      {historyData && !loadingHistory && (() => {
                        if (!historyData.rawHistory?.leads?.length && !historyData.rawHistory?.orders?.length) {
                          return (
                            <div className="p-3 rounded-xl border bg-gray-50 border-gray-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                              <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center shadow-sm bg-gray-200 text-gray-500">
                                <Info className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="font-black text-gray-900 text-xs">{t('lead_new_client', 'dashboard') || 'Nouveau Client'}</h4>
                                <p className="text-[10px] text-gray-500 mt-0.5 font-medium leading-tight">
                                  {t('lead_new_client_desc', 'dashboard') || 'Ce numéro n\'a aucun historique de commande.'}
                                </p>
                              </div>
                            </div>
                          );
                        }

                        const delivered = historyData.summary.orderStats['DELIVERED'] || 0;
                        const cancelled = historyData.summary.leadStats['CANCEL_ORDER'] || 0;
                        const returns = historyData.summary.orderStats['RETURNED'] || 0;
                        
                        let score = 50;
                        if (delivered > 0) score += (delivered * 20);
                        if (cancelled > 0) score -= (cancelled * 15);
                        if (returns > 0) score -= (returns * 25);
                        score = Math.max(0, Math.min(100, score));

                        return (
                          <div className={`p-3 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-1 ${
                            score >= 70 ? 'bg-emerald-50 border-emerald-100' :
                            score < 40 ? 'bg-rose-50 border-rose-100' :
                            'bg-amber-50 border-amber-100'
                          }`}>
                            <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center shadow-sm ${
                              score >= 70 ? 'bg-emerald-500 text-white' :
                              score < 40 ? 'bg-rose-500 text-white' :
                              'bg-amber-500 text-white'
                            }`}>
                              <ShieldAlert className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="font-black text-gray-900 text-xs">{t('lead_trust_score', 'dashboard') || 'Score de Confiance:'} {score}%</h4>
                              <p className="text-[10px] text-gray-500 mt-0.5 font-medium leading-tight">
                                {score >= 70 ? (t('lead_trust_high', 'dashboard') || 'Client très fiable. Priorité haute.') :
                                 score < 40 ? (t('lead_trust_low', 'dashboard') || 'Attention : Historique problématique.') :
                                 (t('lead_trust_med', 'dashboard') || 'Client avec un historique modéré.')}
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                      {loadingHistory && !showHistoryModal && (() => {
                        const cleaned = phone.replace(/\s+/g, '');
                        const isComplete = cleaned.length === 10 || (cleaned.startsWith('+212') && cleaned.length >= 13);
                        return isComplete ? (
                          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 animate-pulse h-[66px] px-3">
                            <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin"></div>
                            {t('lead_analyzing_history', 'dashboard') || 'Analyse de l\'historique...'}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase mb-1">{t('lead_city_label', 'dashboard') || 'Ville (Sélection Coliaty)'}</label>
                    <div className="relative">
                      {loadingCities ? (
                        <div className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl animate-pulse text-xs font-bold text-gray-400">
                          {t('lead_city_loading', 'dashboard') || 'Chargement des villes...'}
                        </div>
                      ) : (
                        <CitySelect
                          deliverableOnly
                          value={city}
                          onChange={(name) => setCity(name)}
                          placeholder={t('lead_city_placeholder', 'dashboard') || "Sélectionner une ville..."}
                          searchPlaceholder={t('lead_city_search', 'dashboard') || "Rechercher une ville..."}
                          error={!!formErrors.city}
                        />
                      )}
                    </div>
                    {formErrors.city && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.city}</p>}
                  </div>
                  
                  {/* Colis de Remplacement UI */}
                  <div className="flex flex-col justify-start">
                    <label className="block text-xs font-black text-gray-500 uppercase mb-1">{t('lead_shipping_options', 'dashboard') || 'Options d\'expédition'}</label>
                    <div className={`rounded-xl border transition-all ${packageReplacement ? 'border-gray-200 bg-gray-50' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'}`}>
                      <label className="flex items-center gap-3 cursor-pointer p-3 select-none">
                        <input
                          type="checkbox"
                          checked={packageReplacement}
                          onChange={(e) => {
                            setPackageReplacement(e.target.checked);
                            if (!e.target.checked) setPackageOldTracking('');
                          }}
                          className={`w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 ${
                            currentMode === 'SELLER' ? 'text-emerald-600 focus:ring-emerald-500' : ''
                          }`}
                        />
                        <div>
                          <span className="text-xs font-black text-gray-700 block">{t('lead_package_replacement', 'dashboard') || 'Colis de remplacement ?'}</span>
                        </div>
                      </label>
                      
                      {packageReplacement && (
                        <div className="px-3 pb-3 animate-fadeIn">
                          <input
                            type="text"
                            value={packageOldTracking}
                            onChange={(e) => setPackageOldTracking(e.target.value)}
                            placeholder={t('lead_package_replacement_placeholder', 'dashboard') || "N° suivi à remplacer (ex: CO123456789)"}
                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 outline-none text-xs font-semibold shadow-sm ${
                              formErrors.packageOldTracking ? 'border-red-300 bg-red-50 focus:ring-red-400' : 'border-gray-200 bg-white'
                            } ${currentMode === 'SELLER' ? 'focus:ring-emerald-400' : 'focus:ring-indigo-400'}`}
                          />
                          {formErrors.packageOldTracking && (
                            <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.packageOldTracking}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase mb-1">{t('lead_address_detailed', 'dashboard') || 'Adresse détaillée'}</label>
                  <textarea
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={t('lead_address_placeholder', 'dashboard') || "Indiquez le quartier, rue, n° de porte, etc. (Min. 8 caractères)"}
                    className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 outline-none text-xs font-semibold shadow-sm resize-none ${
                      formErrors.address ? 'border-red-300 bg-red-50 focus:ring-red-400' : 'border-gray-200'
                    } ${currentMode === 'SELLER' ? 'focus:ring-emerald-400' : 'focus:ring-indigo-400'}`}
                  />
                  {formErrors.address && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.address}</p>}
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase mb-1">{t('lead_notes_label', 'dashboard') || 'Notes (Internes & Livraison)'}</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('lead_notes_placeholder', 'dashboard') || "Ex: Ne pas ouvrir avant de payer, livrer après 18h..."}
                    className={`w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 outline-none text-sm font-semibold shadow-sm resize-none ${
                      currentMode === 'SELLER' ? 'focus:ring-emerald-400' : 'focus:ring-indigo-400'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Submit Section */}
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  if (editingDraftId) {
                    handleCancelEdit();
                  } else {
                    navigate(`${currentBasePath(user?.role)}/leads?mode=${currentMode}`);
                  }
                }}
                className="flex-1 py-3 px-4 border border-gray-200 text-gray-500 hover:bg-gray-50 active:scale-95 transition-all text-xs font-black tracking-widest rounded-2xl"
              >
                {editingDraftId ? (t('lead_btn_cancel_edit', 'dashboard') || 'ANNULER MODIF') : (t('lead_btn_cancel', 'dashboard') || 'ANNULER')}
              </button>
              
              <button
                type="submit"
                className={`flex-[2] py-3 px-4 text-sm font-black tracking-widest transition-all rounded-2xl flex items-center justify-center gap-1.5 ${
                    currentMode === 'SELLER'
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                }`}
              >
                {editingDraftId ? (t('lead_btn_update', 'dashboard') || 'METTRE À JOUR LE LEAD') : (t('lead_btn_add_draft', 'dashboard') || 'AJOUTER À LA LISTE D\'ATTENTE')}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Waiting List Section */}
        <div className="xl:col-span-7 w-full">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl p-5 sm:p-6 relative flex flex-col min-h-[600px] h-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-black text-gray-900 tracking-tight flex items-center gap-2">
                <Truck className={`w-5 h-5 ${currentMode === 'SELLER' ? 'text-emerald-500' : 'text-indigo-500'}`} />
                {t('lead_waiting_list', 'dashboard') || 'Liste d\'attente'}
              </h2>
              <div className="flex items-center gap-3">
                 <span className={`px-3 py-1 rounded-full text-xs font-black ${
                    currentMode === 'SELLER' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'
                 }`}>
                   {draftLeads.length} {t('lead_waiting_count', 'dashboard') || 'en attente'}
                 </span>

                 {draftLeads.length > 0 && (
                   <button
                      onClick={() => updateDraftLeads([])}
                      className="text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors uppercase tracking-widest"
                   >
                     {t('lead_empty_all', 'dashboard') || 'Tout vider'}
                   </button>
                 )}
              </div>
            </div>

            <div className="flex-1 overflow-auto rounded-2xl border border-gray-100 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/80 sticky top-0 backdrop-blur-sm z-10">
                  <tr>
                    <th className="py-3 px-4 font-black text-gray-400 uppercase tracking-widest text-[10px]">{t('lead_table_client', 'dashboard') || 'Client'}</th>
                    <th className="py-3 px-4 font-black text-gray-400 uppercase tracking-widest text-[10px]">{t('lead_table_contact', 'dashboard') || 'Contact'}</th>
                    <th className="py-3 px-4 font-black text-gray-400 uppercase tracking-widest text-[10px]">{t('lead_table_product', 'dashboard') || 'Produit & Vendeur'}</th>
                    <th className="py-3 px-4 font-black text-gray-400 uppercase tracking-widest text-[10px]">{t('lead_table_price', 'dashboard') || 'Prix'}</th>
                    <th className="py-3 px-4 font-black text-gray-400 uppercase tracking-widest text-[10px] text-right">{t('lead_table_actions', 'dashboard') || 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {draftLeads.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-400 font-medium text-xs">
                        {t('lead_no_waiting', 'dashboard') || 'Aucun lead en attente d\'expédition.'}
                      </td>
                    </tr>
                  ) : (
                    draftLeads.map((draft) => (
                      <tr key={draft.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-black text-gray-900">{draft.fullName}</p>
                          <p className="text-[10px] text-gray-500 font-bold mt-0.5">{draft.city}</p>
                          {draft.address && (
                            <p className="text-[9px] text-gray-400 font-medium mt-0.5 truncate max-w-[160px]" title={draft.address}>
                              {draft.address}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-gray-600">{draft.phone}</p>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                             {draft._productImage && (
                               <img src={draft._productImage} alt="" className="w-8 h-8 rounded-lg object-cover border border-gray-100" />
                             )}
                              <div>
                                <p className="font-black text-gray-800 text-[11px] truncate max-w-[120px]">{draft._productName}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] text-gray-400 font-bold">x{draft.qte}</span>
                                  {draft.packName && (
                                    <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-black uppercase tracking-wider truncate max-w-[80px]" title={draft.packName}>
                                      {draft.packName}
                                    </span>
                                  )}
                                </div>
                              </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-black text-gray-900">
                             {draft.customPrice ? `${draft.customPrice} MAD` : 'Standard'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditDraft(draft)}
                              className={`p-1.5 rounded-lg transition-all inline-flex ${
                                editingDraftId === draft.id
                                  ? currentMode === 'SELLER'
                                    ? 'text-emerald-600 bg-emerald-50'
                                    : 'text-indigo-600 bg-indigo-50'
                                  : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'
                              }`}
                              title={t('lead_edit_tooltip', 'dashboard') || "Modifier ce lead"}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeDraft(draft.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all inline-flex"
                              title={t('lead_delete_tooltip', 'dashboard') || "Supprimer ce lead"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <button
                onClick={handleInsertAll}
                disabled={draftLeads.length === 0 || isInsertingAll}
                className={`w-full py-4 px-4 text-white text-sm font-black tracking-widest transition-all shadow-xl rounded-2xl flex items-center justify-center gap-2 ${
                  draftLeads.length === 0 || isInsertingAll
                    ? 'opacity-50 cursor-not-allowed bg-gray-400 shadow-none'
                    : currentMode === 'SELLER'
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:opacity-95 shadow-emerald-200 active:scale-95'
                    : 'bg-gradient-to-r from-indigo-500 to-indigo-600 hover:opacity-95 shadow-indigo-200 active:scale-95'
                }`}
              >
                {isInsertingAll ? (
                  <>{t('lead_inserting', 'dashboard') || '⏳ INSERTION EN COURS...'}</>
                ) : (
                  <>
                    {t('lead_confirm_insert', 'dashboard') || 'CONFIRMER ET INSÉRER'} {draftLeads.length > 0 ? `(${draftLeads.length})` : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showImportModal && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/65 backdrop-blur-md z-[999999] flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-200"
          onClick={() => setShowImportModal(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-2xl w-full p-6 relative overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className={`w-5 h-5 ${currentMode === 'SELLER' ? 'text-emerald-500' : 'text-indigo-500'}`} />
                <h3 className="text-lg font-black text-gray-900">{t('lead_import_modal_title', 'dashboard') || 'Structure du fichier d\'importation'}</h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto py-6 space-y-4 text-sm text-gray-600 leading-relaxed">
              <p>
                {t('lead_import_modal_desc', 'dashboard') || 'Pour importer vos leads avec succès, assurez-vous que votre fichier Excel (.xlsx, .xls) ou CSV contient les colonnes suivantes :'}
              </p>
              
              <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4">Nom de la colonne</th>
                      <th className="py-2.5 px-4">Statut</th>
                      <th className="py-2.5 px-4">Description</th>
                      <th className="py-2.5 px-4">Exemple</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-semibold text-gray-700">
                    <tr>
                      <td className="py-2.5 px-4 font-mono text-indigo-600">Nom Complet</td>
                      <td className="py-2.5 px-4 text-red-500">Obligatoire</td>
                      <td className="py-2.5 px-4 text-gray-500">Nom et prénom du client</td>
                      <td className="py-2.5 px-4">Ali Mansour</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-mono text-indigo-600">Téléphone</td>
                      <td className="py-2.5 px-4 text-red-500">Obligatoire</td>
                      <td className="py-2.5 px-4 text-gray-500">Numéro de téléphone marocain</td>
                      <td className="py-2.5 px-4">0600000000</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-mono text-indigo-600">Ville</td>
                      <td className="py-2.5 px-4 text-red-500">Obligatoire</td>
                      <td className="py-2.5 px-4 text-gray-500">Ville du client</td>
                      <td className="py-2.5 px-4">Casablanca</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-mono text-indigo-600">Adresse</td>
                      <td className="py-2.5 px-4 text-red-500">Obligatoire</td>
                      <td className="py-2.5 px-4 text-gray-500">Adresse de livraison détaillée</td>
                      <td className="py-2.5 px-4">Anfa, Rue 5, Apt 10</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-mono text-indigo-600">SKU/Produit</td>
                      <td className="py-2.5 px-4 text-red-500">Obligatoire</td>
                      <td className="py-2.5 px-4 text-gray-500">SKU ou ID produit</td>
                      <td className="py-2.5 px-4">PROD-123</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-mono text-indigo-600">Nom du Pack</td>
                      <td className="py-2.5 px-4 text-orange-500">Optionnel</td>
                      <td className="py-2.5 px-4 text-gray-500">Nom ou variante du pack</td>
                      <td className="py-2.5 px-4">Pack Gold</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-mono text-indigo-600">Quantité</td>
                      <td className="py-2.5 px-4 text-orange-500">Optionnel</td>
                      <td className="py-2.5 px-4 text-gray-500">Quantité achetée (défaut: 1)</td>
                      <td className="py-2.5 px-4">1</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-mono text-indigo-600">Prix</td>
                      <td className="py-2.5 px-4 text-orange-500">Optionnel</td>
                      <td className="py-2.5 px-4 text-gray-500">Prix personnalisé en MAD</td>
                      <td className="py-2.5 px-4">199</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-mono text-indigo-600">Notes</td>
                      <td className="py-2.5 px-4 text-orange-500">Optionnel</td>
                      <td className="py-2.5 px-4 text-gray-500">Commentaire pour le livreur</td>
                      <td className="py-2.5 px-4">Appeler avant</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-700 flex items-start gap-2.5 mt-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">{t('lead_import_hint_title', 'dashboard') || 'Astuce de flexibilité :'}</p>
                  <p className="mt-0.5">
                    {t('lead_import_hint_desc', 'dashboard') || 'L\'importateur accepte les variations courantes pour les en-têtes (ex: "Nom Complet" ou "Nom" ou "Name", "Téléphone" ou "Phone" ou "Contact").'}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={downloadTemplate}
                className={`flex-1 py-3 px-4 text-white text-xs font-black tracking-widest transition-all rounded-2xl flex items-center justify-center gap-2 shadow-lg ${
                  currentMode === 'SELLER'
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-emerald-200 hover:opacity-95'
                    : 'bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-indigo-200 hover:opacity-95'
                }`}
              >
                {t('lead_import_download', 'dashboard') || '📥 TÉLÉCHARGER LE MODÈLE EXCEL'}
              </button>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="py-3 px-6 border border-gray-200 text-gray-500 hover:bg-gray-50 transition-all text-xs font-black tracking-widest rounded-2xl"
              >
                {t('lead_import_close', 'dashboard') || 'FERMER'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}

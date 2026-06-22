import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi, ordersApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { 
  Sparkles, 
  User, 
  Phone, 
  MessageSquare, 
  MapPin, 
  FileText, 
  Tag, 
  Plus, 
  Check, 
  AlertCircle, 
  Heart, 
  ArrowLeft,
  Eye,
  History,
  X,
  ShieldAlert,
  Clock,
  Store,
  Package,
  Info,
  Truck,
  Search,
  Loader2,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { SearchableSelect } from '../../components/ui/SearchableSelect';

export default function InsertLead() {
  const [theme, setTheme] = useState<'classic' | 'girly' | 'princess'>(() => {
    return (localStorage.getItem('agent-theme') as 'classic' | 'girly' | 'princess') || 'girly';
  });

  useEffect(() => {
    const syncTheme = () => {
      const current = (localStorage.getItem('agent-theme') as 'classic' | 'girly' | 'princess') || 'girly';
      setTheme(current);
    };
    window.addEventListener('agent-theme-change', syncTheme);
    return () => window.removeEventListener('agent-theme-change', syncTheme);
  }, []);

  const navigate = useNavigate();

  // Data states
  const [vendors, setVendors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  
  // Loading states
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingCities, setLoadingCities] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [selectedVendorId, setSelectedVendorId] = useState<number | ''>('');
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
  const [source, setSource] = useState<'MANUAL' | 'WHATSAPP'>('WHATSAPP');
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // History states
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyData, setHistoryData] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Dispatch States & Query/Mutation Hooks
  const queryClient = useQueryClient();
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [search, setSearch] = useState('');

  // Fetch pending dispatch leads (ORDERED status) - Force refetch on mount with staleTime: 0
  const { data: leadsData, isLoading: loadingDispatch, refetch: refetchDispatch, isFetching: isFetchingDispatch } = useQuery({
    queryKey: ['agent-pending-dispatch', search],
    queryFn: () => leadsApi.list({ status: 'ORDERED', search, limit: 100 }),
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const leads = leadsData?.data?.data?.leads || [];

  const dispatchMutation = useMutation({
    mutationFn: async (leadIds: number[]) => {
      return ordersApi.bulkDispatch({ leadIds });
    },
    onSuccess: (res) => {
      toast.success(res.data.message || 'Expédition réussie');
      setSelectedLeadIds([]);
      queryClient.invalidateQueries({ queryKey: ['agent-pending-dispatch'] });
      
      const results = res.data.data.results;
      const successes = results.filter((r: any) => r.status === 'success').length;
      const errors = results.filter((r: any) => r.status === 'error').length;
      
      if (errors > 0) {
        toast.error(`${errors} expédition(s) ont échoué. Vérifiez les détails.`);
      } else {
        toast.success(`${successes} expédition(s) réussie(s).`);
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'expédition en lot');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (leadId: number) => {
      return leadsApi.delete(leadId.toString());
    },
    onSuccess: () => {
      toast.success("Lead supprimé de la liste d'attente");
      queryClient.invalidateQueries({ queryKey: ['agent-pending-dispatch'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Erreur lors de la suppression';
      toast.error(msg);
    }
  });

  const handleDelete = (leadId: number) => {
    if (window.confirm("Voulez-vous vraiment supprimer ce lead de la liste d'attente Coliaty ? Cela supprimera également la commande associée.")) {
      deleteMutation.mutate(leadId);
    }
  };

  const toggleSelectAll = () => {
    if (selectedLeadIds.length === leads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(leads.map((l: any) => l.id));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedLeadIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleDispatch = () => {
    if (selectedLeadIds.length === 0) return;
    dispatchMutation.mutate(selectedLeadIds);
  };

  // Load vendors and cities on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [vendorsRes, citiesRes] = await Promise.all([
          leadsApi.getVendors(),
          leadsApi.getColiatyCities()
        ]);
        
        if (vendorsRes.data?.status === 'success') {
          setVendors(vendorsRes.data.data);
        } else {
          setVendors(vendorsRes.data);
        }

        if (citiesRes.data?.data) {
          setCities(citiesRes.data.data);
        } else {
          setCities(citiesRes.data);
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
        toast.error('Erreur lors du chargement des données initiales');
      } finally {
        setLoadingVendors(false);
        setLoadingCities(false);
      }
    };
    loadInitialData();
  }, []);

  // Fetch products dynamically when vendor is changed
  useEffect(() => {
    if (!selectedVendorId) {
      setProducts([]);
      setSelectedProductId('');
      return;
    }

    const loadProducts = async () => {
      setLoadingProducts(true);
      try {
        const res = await leadsApi.getProductsByVendor(Number(selectedVendorId));
        if (res.data?.status === 'success') {
          setProducts(res.data.data);
        } else {
          setProducts(res.data);
        }
      } catch (err) {
        console.error('Failed to load products:', err);
        toast.error('Impossible de charger les produits pour ce vendeur');
      } finally {
        setLoadingProducts(false);
      }
    };
    loadProducts();
  }, [selectedVendorId]);

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
    if (!selectedVendorId) errors.vendor = 'Veuillez sélectionner un compte vendeur';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Veuillez corriger les erreurs du formulaire');
      return;
    }

    setSubmitting(true);
    try {
      await leadsApi.create({
        fullName,
        phone,
        whatsapp: phone,
        city,
        address,
        productId: Number(selectedProductId),
        vendorId: Number(selectedVendorId),
        notes,
        sourceMode: 'VENDOR',
        source,
        package_replacement: packageReplacement,
        package_old_tracking: packageReplacement ? packageOldTracking : '',
        package_note: notes,
        customPrice: customPrice !== '' ? Number(customPrice) : undefined,
        packName: packName || undefined,
        qte: Number(qte),
        skipColiaty: true
      });

      toast.success(
        theme === 'girly' 
          ? 'Nouveau lead ajouté à la liste d\'attente ! 🌸' 
          : theme === 'princess' 
          ? 'Le lead royal a été ajouté à la file ! 👑✨' 
          : 'Lead ajouté en liste d\'attente avec succès !'
      );
      
      setFullName('');
      setPhone('');
      setCity('');
      setAddress('');
      setNotes('');
      setSelectedProductId('');
      setPackageReplacement(false);
      setPackageOldTracking('');
      setCustomPrice('');
      setPackName('');
      setQte(1);
      setSource('WHATSAPP');
      setFormErrors({});
      
      // Invalidate query to refresh the dispatch list automatically
      queryClient.invalidateQueries({ queryKey: ['agent-pending-dispatch'] });
    } catch (err: any) {
      console.error('Failed to create lead:', err);
      toast.error(err.response?.data?.message || 'Erreur lors de la création et de l\'envoi du lead');
    } finally {
      setSubmitting(false);
    }
  };

  const isPrincess = theme === 'princess';
  const isGirly = theme === 'girly';

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4">
      {/* Header card */}
      <div className={`rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden transition-all duration-500 ${
        isPrincess
          ? 'bg-gradient-to-r from-amber-500 via-pink-500 to-rose-600'
          : isGirly 
          ? 'bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-500' 
          : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700'
      }`}>
        <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]"></div>
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
        
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="bg-white/20 hover:bg-white/30 p-2.5 rounded-full transition-all shadow-md active:scale-95 flex items-center justify-center text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 rounded-full text-xs font-black uppercase tracking-wider mb-2">
                {isPrincess ? '👑 Lead Royal' : isGirly ? '🌸 Lead Doux' : '💬 Lead WhatsApp'}
              </div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2">
                {isPrincess ? 'Nouveau Lead WhatsApp Royal 👑✨' : isGirly ? 'Nouveau Lead WhatsApp 🌸' : 'Nouveau Lead WhatsApp'}
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column: Form Card */}
        <div className="xl:col-span-6 w-full">
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-gray-100 shadow-xl p-5 sm:p-6 md:p-8 relative">
        {/* Top colored accent bar */}
        <div className={`absolute top-0 left-0 right-0 h-2 ${
          isPrincess 
            ? 'bg-gradient-to-r from-amber-400 via-pink-400 to-rose-500' 
            : isGirly 
            ? 'bg-gradient-to-r from-pink-400 via-rose-400 to-fuchsia-400' 
            : 'bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-600'
        }`}></div>

        <div className="space-y-6">
          
          {/* Section 1: Account / Vendor Info */}
          <div className="space-y-4">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <User className={`w-4 h-4 ${isPrincess ? 'text-amber-500' : isGirly ? 'text-pink-500' : 'text-indigo-500'}`} />
              1. Attribution du Lead (Compte Vendeur)
            </h2>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-1">Sélectionner le vendeur</label>
                {loadingVendors ? (
                  <div className="h-10 bg-gray-50 border border-gray-100 rounded-xl animate-pulse"></div>
                ) : (
                  <SearchableSelect
                    theme={theme}
                    options={vendors.map(v => ({
                      value: v.id,
                      label: `${v.fullName} (${v.email})`
                    }))}
                    value={selectedVendorId}
                    onChange={(val) => setSelectedVendorId(val as number)}
                    placeholder="Choisissez le compte vendeur..."
                    searchPlaceholder="Rechercher un vendeur..."
                    error={!!formErrors.vendor}
                  />
                )}
                {formErrors.vendor && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.vendor}</p>}
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-1">Associer un Produit</label>
                {loadingProducts ? (
                  <div className="h-10 bg-gray-50 border border-gray-100 rounded-xl animate-pulse"></div>
                ) : (
                  <SearchableSelect
                    theme={theme}
                    options={products.map(p => ({
                      value: p.id,
                      label: `${p.name} - SKU: ${p.sku} (${Number(p.retailPriceMad).toFixed(2)} MAD)`
                    }))}
                    value={selectedProductId}
                    onChange={(val) => setSelectedProductId(val as number)}
                    placeholder={!selectedVendorId 
                      ? 'Sélectionnez un vendeur d\'abord' 
                      : products.length === 0 
                      ? 'Aucun produit disponible' 
                      : 'Choisissez le produit...'}
                    searchPlaceholder="Rechercher un produit ou SKU..."
                    disabled={!selectedVendorId}
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
                  isPrincess ? 'bg-amber-50/20 border-amber-100' : isGirly ? 'bg-pink-50/20 border-pink-100' : 'bg-indigo-50/20 border-indigo-100'
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
                    <p className={`text-xs font-black mt-1 ${isPrincess ? 'text-amber-600' : isGirly ? 'text-pink-600' : 'text-indigo-600'}`}>
                      Prix: {Number(p.retailPriceMad).toFixed(2)} MAD
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Custom pricing, pack name and quantity configuration */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-1">Nom du Pack</label>
                <input
                  type="text"
                  disabled={!selectedProductId}
                  value={packName}
                  onChange={(e) => setPackName(e.target.value)}
                  placeholder={selectedProductId ? "Ex: Pack 2 + 1 Gratuit..." : "Sélectionnez un produit d'abord"}
                  className={`w-full h-11 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 outline-none text-sm font-semibold shadow-sm ${
                    !selectedProductId ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''
                  } ${isGirly ? 'focus:ring-pink-400' : 'focus:ring-indigo-400'}`}
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-1">Quantité</label>
                <input
                  type="number"
                  min="1"
                  required
                  disabled={!selectedProductId}
                  value={qte}
                  onChange={(e) => setQte(Math.max(1, parseInt(e.target.value) || 1))}
                  placeholder="Quantité"
                  className={`w-full h-11 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 outline-none text-sm font-semibold shadow-sm ${
                    !selectedProductId ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''
                  } ${isGirly ? 'focus:ring-pink-400' : 'focus:ring-indigo-400'}`}
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-1">Prix (MAD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={!selectedProductId}
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder={
                    selectedProductId 
                      ? `Standard: ${Number((products.find(p => p.id === selectedProductId)?.retailPriceMad || 0) * qte).toFixed(2)} MAD` 
                      : "Sélectionnez un produit d'abord"
                  }
                  className={`w-full h-11 px-4 py-2.5 border rounded-xl focus:ring-2 outline-none text-sm font-semibold shadow-sm ${
                    !selectedProductId ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''
                  } ${formErrors.customPrice ? 'border-red-300 bg-red-50 focus:ring-red-400' : 'border-gray-200'} ${
                    isGirly ? 'focus:ring-pink-400' : 'focus:ring-indigo-400'
                  }`}
                />
                {formErrors.customPrice && (
                  <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.customPrice}</p>
                )}
              </div>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Section 2: Customer Details */}
          <div className="space-y-4">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Phone className={`w-4 h-4 ${isPrincess ? 'text-amber-500' : isGirly ? 'text-pink-500' : 'text-indigo-500'}`} />
              2. Informations du Client / Commanditaire
            </h2>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-1">Nom complet du client</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex: Ahmed Naoum"
                    className={`w-full pl-9 pr-4 h-11 py-2.5 border rounded-xl focus:ring-2 outline-none text-sm font-semibold shadow-sm ${
                      formErrors.fullName ? 'border-red-300 bg-red-50 focus:ring-red-400' : 'border-gray-200'
                    } ${isGirly ? 'focus:ring-pink-400' : 'focus:ring-indigo-400'}`}
                  />
                </div>
                {formErrors.fullName && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.fullName}</p>}
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-1">N° de Téléphone</label>
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
                        placeholder="Ex: 0612345678"
                        className={`w-full pl-9 pr-4 h-11 py-2.5 border rounded-xl focus:ring-2 outline-none text-sm font-semibold shadow-sm ${
                          formErrors.phone ? 'border-red-300 bg-red-50 focus:ring-red-400' : 'border-gray-200'
                        } ${isGirly ? 'focus:ring-pink-400' : 'focus:ring-indigo-400'}`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleViewHistory(false)}
                      className={`h-11 px-3 rounded-xl transition-all border shadow-sm flex items-center justify-center shrink-0 ${
                        isPrincess
                          ? 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100'
                          : isGirly 
                          ? 'bg-pink-50 text-pink-600 border-pink-100 hover:bg-pink-100' 
                          : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100'
                      }`}
                      title="Voir l'historique détaillé du client"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </div>
                {formErrors.phone && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.phone}</p>}
                
                {/* Inline Trust Score - Moved under phone */}
                <div className="mt-3">
                  {historyData && !loadingHistory && (() => {
                    if (!historyData.rawHistory?.leads?.length && !historyData.rawHistory?.orders?.length) {
                      return (
                        <div className="p-3 rounded-xl border bg-gray-50 border-gray-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                          <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center shadow-sm bg-gray-200 text-gray-500">
                            <Info className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-black text-gray-900 text-xs">Nouveau Client</h4>
                            <p className="text-[10px] text-gray-500 mt-0.5 font-medium leading-tight">
                              Ce numéro n'a aucun historique de commande.
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
                          <h4 className="font-black text-gray-900 text-xs">Score de Confiance: {score}%</h4>
                          <p className="text-[10px] text-gray-500 mt-0.5 font-medium leading-tight">
                            {score >= 70 ? 'Client très fiable. Priorité haute.' :
                             score < 40 ? 'Attention : Historique problématique.' :
                             'Client avec un historique modéré.'}
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
                        Analyse de l'historique...
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-1">Ville (Sélection Coliaty)</label>
                <div className="relative">
                  {loadingCities ? (
                    <div className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl animate-pulse text-xs font-bold text-gray-400">
                      Chargement des villes...
                    </div>
                  ) : (
                    <SearchableSelect
                      theme={theme}
                      icon={<MapPin className="w-4 h-4" />}
                      options={Array.from(new Set(cities.map(c => c.city_name))).map(name => ({
                        value: name,
                        label: name
                      }))}
                      value={city}
                      onChange={(val) => setCity(val as string)}
                      placeholder="Sélectionner une ville..."
                      searchPlaceholder="Rechercher une ville..."
                      error={!!formErrors.city}
                    />
                  )}
                </div>
                {formErrors.city && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.city}</p>}
              </div>
              
              {/* Colis de Remplacement UI moved here */}
              <div className="flex flex-col justify-start">
                <label className="block text-xs font-black text-gray-500 uppercase mb-1">Options d'expédition</label>
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
                        isGirly ? 'text-pink-600 focus:ring-pink-500' : ''
                      }`}
                    />
                    <div>
                      <span className="text-xs font-black text-gray-700 block">Colis de remplacement ?</span>
                    </div>
                  </label>
                  
                  {/* Tracking input nested seamlessly INSIDE the card */}
                  {packageReplacement && (
                    <div className="px-3 pb-3 animate-fadeIn">
                      <input
                        type="text"
                        value={packageOldTracking}
                        onChange={(e) => setPackageOldTracking(e.target.value)}
                        placeholder="N° suivi à remplacer (ex: CO123456789)"
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 outline-none text-xs font-semibold shadow-sm ${
                          formErrors.packageOldTracking ? 'border-red-300 bg-red-50 focus:ring-red-400' : 'border-gray-200 bg-white'
                        } ${isGirly ? 'focus:ring-pink-400' : 'focus:ring-indigo-400'}`}
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
              <label className="block text-xs font-black text-gray-500 uppercase mb-1">Adresse détaillée</label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Indiquez le quartier, rue, n° de porte, etc. (Min. 8 caractères)"
                className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 outline-none text-xs font-semibold shadow-sm resize-none ${
                  formErrors.address ? 'border-red-300 bg-red-50 focus:ring-red-400' : 'border-gray-200'
                } ${isGirly ? 'focus:ring-pink-400' : 'focus:ring-indigo-400'}`}
              />
              {formErrors.address && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.address}</p>}
            </div>

            <div>
              <label className="block text-xs font-black text-gray-500 uppercase mb-1">Notes (Internes & Livraison Coliaty)</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Ne pas ouvrir avant de payer, livrer après 18h..."
                className={`w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 outline-none text-sm font-semibold shadow-sm resize-none ${
                  isGirly ? 'focus:ring-pink-400' : 'focus:ring-indigo-400'
                }`}
              />
            </div>


          </div>



        </div>

        {/* Submit Section */}
        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/agent/leads')}
            className="flex-1 py-3 px-4 border border-gray-200 text-gray-500 hover:bg-gray-50 active:scale-95 transition-all text-xs font-black tracking-widest rounded-2xl"
          >
            ANNULER
          </button>
          
          <button
            type="submit"
            disabled={submitting}
            className={`flex-[2] py-3 px-4 text-white text-xs font-black tracking-widest transition-all shadow-lg active:scale-95 rounded-2xl flex items-center justify-center gap-1.5 ${
              submitting
                ? 'opacity-80 cursor-wait bg-gray-400'
                : isPrincess
                ? 'bg-gradient-to-r from-amber-500 via-pink-500 to-rose-500 hover:opacity-95 shadow-amber-200'
                : isGirly 
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 hover:opacity-95 shadow-pink-200' 
                : 'bg-gradient-to-r from-indigo-500 to-indigo-600 hover:opacity-95 shadow-indigo-200'
            }`}
          >
            {submitting ? (
              <>⏳ AJOUT EN COURS...</>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                {isPrincess ? '👑 AJOUTER LEAD WHATSAPP 👑' : isGirly ? '🌸 AJOUTER LEAD WHATSAPP ✨' : '💬 AJOUTER LEAD WHATSAPP'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>

    {/* Right Column: Coliaty Dispatch Waiting List */}
    <div className="xl:col-span-6 w-full space-y-6">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden relative">
        {/* Accent top bar */}
        <div className={`absolute top-0 left-0 right-0 h-2 ${
          isPrincess 
            ? 'bg-gradient-to-r from-amber-400 via-pink-400 to-rose-500' 
            : isGirly 
            ? 'bg-gradient-to-r from-pink-400 via-rose-400 to-fuchsia-400' 
            : 'bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-600'
        }`}></div>

        {/* Header controls inside card */}
        <div className="p-6 border-b border-gray-100 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-black text-gray-800 flex items-center gap-2">
              <Truck className={`w-5 h-5 ${
                isPrincess ? 'text-amber-500' : isGirly ? 'text-pink-500' : 'text-indigo-500'
              }`} />
              Liste d'attente Coliaty
            </h2>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold ${
                isPrincess ? 'bg-amber-50 text-amber-700' : isGirly ? 'bg-pink-50 text-pink-700' : 'bg-indigo-50 text-indigo-700'
              }`}>
                {leads.length} en attente
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-400 font-medium leading-relaxed">
            Sélectionnez les leads que vous souhaitez expédier chez Coliaty en lot. Des frais de saisie seront facturés aux vendeurs respectifs.
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher par nom, téléphone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-xs font-medium focus:ring-2 transition-all ${
                    isPrincess ? 'focus:ring-amber-100' : isGirly ? 'focus:ring-pink-100' : 'focus:ring-indigo-100'
                  }`}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  refetchDispatch();
                  toast.success('Données actualisées');
                }}
                disabled={loadingDispatch || isFetchingDispatch}
                className="p-2.5 bg-gray-50 text-gray-500 rounded-xl hover:bg-gray-100 transition-all border-none focus:outline-none flex items-center justify-center shrink-0 active:scale-95 disabled:opacity-50"
                title="Actualiser la liste"
              >
                <RotateCcw className={`w-4 h-4 ${loadingDispatch || isFetchingDispatch ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3">
              <span className="text-xs font-bold text-gray-500">
                {selectedLeadIds.length} sélectionné(s)
              </span>
              <button
                type="button"
                onClick={handleDispatch}
                disabled={selectedLeadIds.length === 0 || dispatchMutation.isPending}
                className={`px-5 py-2 rounded-xl font-black text-xs transition-all shadow-md flex items-center gap-1.5 ${
                  selectedLeadIds.length === 0 || dispatchMutation.isPending
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                    : isPrincess
                    ? 'bg-gradient-to-r from-amber-500 via-pink-500 to-rose-500 text-white hover:opacity-95 shadow-amber-100 active:scale-95'
                    : isGirly
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:opacity-95 shadow-pink-100 active:scale-95'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-200 active:scale-95'
                }`}
              >
                {dispatchMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Truck className="w-3.5 h-3.5" />
                )}
                EXPÉDIER ({selectedLeadIds.length})
              </button>
            </div>
          </div>
        </div>

        {/* Table wrapper */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    className={`w-4 h-4 rounded border-gray-300 ${
                      isPrincess 
                        ? 'text-amber-500 focus:ring-amber-500' 
                        : isGirly 
                        ? 'text-pink-500 focus:ring-pink-500' 
                        : 'text-indigo-600 focus:ring-indigo-500'
                    }`}
                    checked={leads.length > 0 && selectedLeadIds.length === leads.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="p-3 font-black text-gray-400 uppercase text-[9px] tracking-widest">Client</th>
                <th className="p-3 font-black text-gray-400 uppercase text-[9px] tracking-widest">Contact</th>
                <th className="p-3 font-black text-gray-400 uppercase text-[9px] tracking-widest">Produit & Vendeur</th>
                <th className="p-3 font-black text-gray-400 uppercase text-[9px] tracking-widest text-right">Prix</th>
                <th className="p-3 font-black text-gray-400 uppercase text-[9px] tracking-widest text-center w-12">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingDispatch ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <Loader2 className={`w-5 h-5 animate-spin mx-auto ${
                      isPrincess ? 'text-amber-500' : isGirly ? 'text-pink-500' : 'text-indigo-500'
                    }`} />
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400 font-medium italic">
                    Aucun lead en attente d'expédition.
                  </td>
                </tr>
              ) : (
                leads.map((lead: any) => {
                  const isSelected = selectedLeadIds.includes(lead.id);
                  return (
                    <tr 
                      key={lead.id} 
                      className={`hover:bg-gray-50/30 transition-colors ${
                        isSelected 
                          ? isPrincess 
                            ? 'bg-amber-50/20' 
                            : isGirly 
                            ? 'bg-pink-50/20' 
                            : 'bg-indigo-50/30' 
                          : ''
                      }`}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          className={`w-4 h-4 rounded border-gray-300 ${
                            isPrincess 
                              ? 'text-amber-500 focus:ring-amber-500' 
                              : isGirly 
                              ? 'text-pink-500 focus:ring-pink-500' 
                              : 'text-indigo-600 focus:ring-indigo-500'
                          }`}
                          checked={isSelected}
                          onChange={() => toggleSelect(lead.id)}
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-gray-800">{lead.fullName}</span>
                          {lead.source === 'WHATSAPP' && (
                            <span 
                              className="inline-flex items-center justify-center p-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100" 
                              title="Lead WhatsApp"
                            >
                              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                              </svg>
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{lead.city}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-gray-800">{lead.phone}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Saisi le {format(new Date(lead.createdAt), 'dd/MM')}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-gray-800 line-clamp-1">
                          {lead.product?.name || 'Produit inconnu'}
                          {lead.productVariant && (
                            <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-black inline-flex items-center gap-0.5 ${
                              isPrincess ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                              isGirly ? 'bg-pink-50 text-pink-600 border border-pink-100' :
                              'bg-indigo-50 text-indigo-700 border border-indigo-100'
                            }`}>
                              📦 {lead.productVariant}
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] font-bold text-gray-400 uppercase flex items-center gap-1 mt-1">
                          <Store className="w-2.5 h-2.5 opacity-50" />
                          {lead.vendor?.fullName}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className={`font-black ${
                          isPrincess ? 'text-amber-600' : isGirly ? 'text-pink-600' : 'text-indigo-600'
                        }`}>{lead.productPrice} MAD</div>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDelete(lead.id)}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors inline-flex items-center justify-center disabled:opacity-50"
                          title="Supprimer de la liste d'attente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className={`p-6 text-white shrink-0 relative overflow-hidden ${
              isPrincess 
                ? 'bg-gradient-to-r from-amber-500 via-pink-500 to-rose-600'
                : isGirly 
                ? 'bg-gradient-to-r from-pink-500 to-rose-500' 
                : 'bg-indigo-600'
            }`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                    <History className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">Historique Client</h3>
                    <p className="text-indigo-100 text-xs font-medium flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {phone}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowHistoryModal(false)}
                  className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {loadingHistory ? (
              <div className="p-20 flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="text-sm font-bold text-gray-400 animate-pulse uppercase tracking-widest">Analyse en cours...</p>
              </div>
            ) : historyData ? (
              (!historyData.rawHistory?.leads?.length && !historyData.rawHistory?.orders?.length) ? (
                <div className="p-20 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-gray-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border-2 border-gray-100 shadow-sm">
                    <Info className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mb-2">Nouveau Client</h3>
                  <p className="text-gray-500 font-medium max-w-sm mx-auto">
                    Ce numéro de téléphone n'a aucun historique ni ancienne commande enregistrée dans le système.
                  </p>
                </div>
              ) : (
                <div className="overflow-y-auto p-6 space-y-8">
                {/* Score Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-center">
                    <span className="text-[10px] font-black text-gray-400 uppercase block mb-1">Total Leads</span>
                    <span className="text-xl font-black text-gray-900">{historyData.summary.totalLeads}</span>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-center">
                    <span className="text-[10px] font-black text-emerald-500 uppercase block mb-1">Total Livrés</span>
                    <span className="text-xl font-black text-emerald-700">{historyData.summary.orderStats['DELIVERED'] || 0}</span>
                  </div>
                  <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-center">
                    <span className="text-[10px] font-black text-red-500 uppercase block mb-1">Annulés</span>
                    <span className="text-xl font-black text-red-700">{historyData.summary.leadStats['CANCEL_ORDER'] || 0}</span>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 text-center">
                    <span className="text-[10px] font-black text-amber-500 uppercase block mb-1">Retours</span>
                    <span className="text-xl font-black text-amber-700">{historyData.summary.orderStats['RETURNED'] || 0}</span>
                  </div>
                </div>

                {/* Trust Score indicator */}
                {(() => {
                  const delivered = historyData.summary.orderStats['DELIVERED'] || 0;
                  const cancelled = historyData.summary.leadStats['CANCEL_ORDER'] || 0;
                  const returns = historyData.summary.orderStats['RETURNED'] || 0;
                  
                  let score = 50;
                  if (delivered > 0) score += (delivered * 20);
                  if (cancelled > 0) score -= (cancelled * 15);
                  if (returns > 0) score -= (returns * 25);
                  score = Math.max(0, Math.min(100, score));

                  return (
                    <div className={`p-4 rounded-2xl border flex items-center gap-4 ${
                      score >= 70 ? 'bg-emerald-50 border-emerald-100' :
                      score < 40 ? 'bg-rose-50 border-rose-100' :
                      'bg-amber-50 border-amber-100'
                    }`}>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm ${
                        score >= 70 ? 'bg-emerald-500 text-white' :
                        score < 40 ? 'bg-rose-500 text-white' :
                        'bg-amber-500 text-white'
                      }`}>
                        <ShieldAlert className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-black text-gray-900">Score de Confiance: {score}%</h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {score >= 70 ? 'Client très fiable. Priorité haute.' :
                           score < 40 ? 'Attention : Historique d\'annulations ou de retours élevé.' :
                           'Client avec un historique modéré.'}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Detailed History Sections */}
                <div className="space-y-6">
                  {/* Leads History */}
                  <div>
                    <h4 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-500" />
                      Détails des Leads Passés
                    </h4>
                    <div className="space-y-2">
                      {!historyData.rawHistory?.leads || historyData.rawHistory.leads.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Aucun autre lead trouvé.</p>
                      ) : (
                        historyData.rawHistory.leads.map((h: any, i: number) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                h.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' :
                                h.status === 'CANCEL_ORDER' ? 'bg-rose-100 text-rose-700' :
                                'bg-gray-200 text-gray-600'
                              }`}>
                                {h.status}
                              </span>
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-700 flex items-center gap-1">
                                  <Store className="w-2.5 h-2.5 opacity-50" /> {h.vendorName}
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] text-gray-400 font-medium">
                              {format(new Date(h.createdAt), 'dd/MM/yyyy')}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Orders History */}
                  <div>
                    <h4 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4 text-emerald-500" />
                      Détails des Expéditions
                    </h4>
                    <div className="space-y-2">
                      {!historyData.rawHistory?.orders || historyData.rawHistory.orders.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Aucune expédition trouvée.</p>
                      ) : (
                        historyData.rawHistory.orders.map((h: any, i: number) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                h.status === 'DELIVERED' ? 'bg-emerald-500 text-white' :
                                h.status === 'RETURNED' ? 'bg-rose-500 text-white' :
                                'bg-blue-500 text-white'
                              }`}>
                                {h.status}
                              </span>
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-700 flex items-center gap-1">
                                  <Store className="w-2.5 h-2.5 opacity-50" /> {h.vendorName}
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] text-gray-400 font-medium">
                              {format(new Date(h.createdAt), 'dd/MM/yyyy')}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
              )
            ) : (
              <div className="p-20 text-center">
                <Info className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-400 font-medium">Erreur lors du chargement des données.</p>
              </div>
            )}

            {/* Modal Footer */}
            <div className="p-6 bg-gray-50 border-t border-gray-100 shrink-0">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-full py-4 bg-white border border-gray-200 text-gray-700 rounded-2xl font-black text-sm hover:bg-gray-50 transition-all shadow-sm"
              >
                FERMER
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

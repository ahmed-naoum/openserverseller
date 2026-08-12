import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi, ordersApi } from '../../lib/api';
import toast from 'react-hot-toast';
import {
  User,
  Phone,
  MapPin,
  Plus,
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
import { CitySelect } from '../../components/ui/CitySelect';

type ThemeKey = 'classic' | 'girly' | 'princess';

/** Full class strings — Tailwind can't resolve interpolated utilities. */
const THEME: Record<ThemeKey, {
  tag: string; accentBar: string; icon: string; ring: string;
  soft: string; softIcon: string; cta: string; ctaRing: string; step: string;
}> = {
  classic: {
    tag: '💬 Lead WhatsApp',
    accentBar: 'bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-600',
    icon: 'text-indigo-500',
    ring: 'focus:ring-indigo-400',
    soft: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    softIcon: 'bg-indigo-100 text-indigo-600',
    cta: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200',
    ctaRing: 'focus-visible:ring-indigo-400',
    step: 'bg-indigo-600 text-white',
  },
  girly: {
    tag: '🌸 Lead Doux',
    accentBar: 'bg-gradient-to-r from-pink-400 via-rose-400 to-fuchsia-400',
    icon: 'text-pink-500',
    ring: 'focus:ring-pink-400',
    soft: 'bg-pink-50 text-pink-700 border-pink-100',
    softIcon: 'bg-pink-100 text-pink-600',
    cta: 'bg-gradient-to-r from-pink-500 to-rose-500 hover:opacity-95 shadow-pink-200',
    ctaRing: 'focus-visible:ring-pink-400',
    step: 'bg-gradient-to-r from-pink-500 to-rose-500 text-white',
  },
  princess: {
    tag: '👑 Lead Royal',
    accentBar: 'bg-gradient-to-r from-amber-400 via-pink-400 to-rose-500',
    icon: 'text-amber-500',
    ring: 'focus:ring-amber-400',
    soft: 'bg-amber-50 text-amber-800 border-amber-100',
    softIcon: 'bg-amber-100 text-amber-600',
    cta: 'bg-gradient-to-r from-amber-500 via-pink-500 to-rose-500 hover:opacity-95 shadow-amber-200',
    ctaRing: 'focus-visible:ring-amber-400',
    step: 'bg-gradient-to-r from-amber-500 to-rose-500 text-white',
  },
};

const money = (n: number) => `${Number(n || 0).toFixed(2)} MAD`;

/**
 * Coliaty reports a rejected parcel as a field→message map, which the backend
 * forwards verbatim as JSON. Unwrap it into the sentence the agent needs, and
 * fall back to the raw text for our own pre-flight messages, which are already
 * plain French.
 */
function humanizeDispatchError(raw: string): string {
  if (!raw) return 'Erreur inconnue.';
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const messages = (Object.values(parsed) as any[])
        .flat()
        .filter(v => typeof v === 'string' && v.trim())
        .join(' · ');
      if (messages) return messages;
    }
  } catch {
    // Not JSON — the backend's own rejection messages come through as prose.
  }
  return raw;
}

export default function InsertLead() {
  const [theme, setTheme] = useState<ThemeKey>(() => {
    return (localStorage.getItem('agent-theme') as ThemeKey) || 'girly';
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
  // Coliaty's own "ne pas ouvrir" flag. Agents used to write the instruction
  // into the free-text note, where the courier flow never acts on it.
  const [packageNoOpen, setPackageNoOpen] = useState(false);
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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [dispatchErrors, setDispatchErrors] = useState<
    { leadId: number; name: string; phone: string; reason: string }[]
  >([]);

  // Don't refire the query on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Queued leads sit at status ORDERED with an order attached — that's the same
  // contract /orders/bulk-dispatch selects on.
  const { data: leadsData, isLoading: loadingDispatch, refetch: refetchDispatch, isFetching: isFetchingDispatch } = useQuery({
    queryKey: ['agent-pending-dispatch', debouncedSearch],
    queryFn: () => leadsApi.list({ status: 'ORDERED', search: debouncedSearch, limit: 5000 }),
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const leads = leadsData?.data?.data?.leads || [];

  // Drop selections whose row is gone (dispatched, deleted, filtered out by a
  // search) — otherwise the button offers to ship rows that aren't on screen.
  useEffect(() => {
    if (!leads.length) {
      if (selectedLeadIds.length) setSelectedLeadIds([]);
      return;
    }
    const visible = new Set(leads.map((l: any) => l.id));
    setSelectedLeadIds(prev => {
      const next = prev.filter(id => visible.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [leads]);

  const dispatchMutation = useMutation({
    mutationFn: async (leadIds: number[]) => {
      return ordersApi.bulkDispatch({ leadIds });
    },
    onMutate: () => setDispatchErrors([]),
    onSuccess: (res) => {
      setSelectedLeadIds([]);
      queryClient.invalidateQueries({ queryKey: ['agent-pending-dispatch'] });

      // One toast that states the real outcome. It used to fire an unconditional
      // "Expédition réussie" first, so a batch where every parcel failed still
      // flashed green before the error appeared.
      const results = res.data?.data?.results || [];
      const successes = results.filter((r: any) => r.status === 'success').length;
      const failed = results.filter((r: any) => r.status === 'error');

      if (successes > 0) toast.success(`${successes} expédition(s) réussie(s).`);
      if (failed.length > 0) toast.error(`${failed.length} expédition(s) ont échoué.`);
      if (!successes && !failed.length) toast.success(res.data?.message || 'Expédition traitée');

      // A counter alone left the agent with no idea which lead was refused nor
      // why, while the reason (bad number, city, price…) was already in the
      // payload. The failed leads stay in the queue, so they can be fixed.
      const byId = new Map(leads.map((l: any) => [l.id, l]));
      setDispatchErrors(
        failed.map((r: any) => ({
          leadId: r.leadId,
          name: (byId.get(r.leadId) as any)?.fullName || `Lead #${r.leadId}`,
          phone: (byId.get(r.leadId) as any)?.phone || '',
          reason: humanizeDispatchError(r.error),
        }))
      );
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
      setConfirmDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['agent-pending-dispatch'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Erreur lors de la suppression';
      toast.error(msg);
      setConfirmDeleteId(null);
    }
  });

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
    
    // Coliaty only accepts mobiles: 06 or 07 followed by 8 digits. The old rule
    // here was (+212|0) + any 9 digits, so a 05… landline passed validation,
    // queued fine, and only blew up hours later inside a dispatch batch.
    const dialled = phone.replace(/[\s.-]/g, '');
    if (!dialled || !/^(?:\+?212|0)[67][0-9]{8}$/.test(dialled)) {
      errors.phone = 'Numéro invalide : Coliaty exige un mobile 06… ou 07… (ex: 0612345678)';
    }

    if (!city) errors.city = 'Veuillez choisir une ville';
    if (!address.trim() || address.trim().length < 8) errors.address = "L'adresse doit être plus détaillée (min. 8 caractères)";

    if (packageReplacement && !packageOldTracking.trim()) {
      errors.packageOldTracking = "Le numéro de suivi du colis à remplacer est requis.";
    }

    // Coliaty: "un nombre positif avec maximum 2 décimales".
    if (customPrice && !/^\d+([.,]\d{1,2})?$/.test(customPrice.trim())) {
      errors.customPrice = "Le prix doit être positif avec 2 décimales maximum (ex: 149.50).";
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
        package_no_open: packageNoOpen,
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
      setPackageNoOpen(false);
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

  const t = THEME[theme];
  const selectedProduct = products.find(p => p.id === selectedProductId);
  const unitPrice = Number(selectedProduct?.retailPriceMad || 0);
  const standardTotal = unitPrice * qte;
  const effectiveTotal = customPrice !== '' ? Number(customPrice) || 0 : standardTotal;
  const hasVendors = vendors.length > 0;
  const allSelected = leads.length > 0 && selectedLeadIds.length === leads.length;

  return (
    <div className="max-w-[1600px] mx-auto px-2 sm:px-4 pb-10 space-y-5">
      {/* ------------------------------------------------------------ Header */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:border-gray-300 transition-all shadow-sm active:scale-95"
          title="Retour"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-gray-900">
              Nouveau Lead WhatsApp
            </h1>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${t.soft}`}>
              {t.tag}
            </span>
          </div>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Saisissez la commande, puis expédiez la file en lot vers Coliaty.
          </p>
        </div>

        {/* Queue summary lives in the header so it's reachable without scrolling */}
        <div className="ml-auto flex items-center gap-2">
          <a
            href="#file-attente"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 bg-white shadow-sm hover:border-gray-300 transition-all"
          >
            <Truck className={`w-4 h-4 ${t.icon}`} />
            <span className="text-lg font-black text-gray-900 tabular-nums leading-none">{leads.length}</span>
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 leading-none">
              en attente
            </span>
          </a>
          <button
            type="button"
            onClick={handleDispatch}
            disabled={selectedLeadIds.length === 0 || dispatchMutation.isPending}
            className={`px-4 py-2.5 rounded-xl font-black text-xs text-white transition-all shadow-md flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${t.ctaRing} ${
              selectedLeadIds.length === 0 || dispatchMutation.isPending
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                : `${t.cta} active:scale-95`
            }`}
          >
            {dispatchMutation.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Truck className="w-3.5 h-3.5" />}
            EXPÉDIER ({selectedLeadIds.length})
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------- Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden"
      >
        <div className={`absolute top-0 left-0 right-0 h-1.5 ${t.accentBar}`} />

        <div className="p-5 sm:p-6 pt-7 space-y-6">
          {/* --- Section 1 ------------------------------------------------ */}
          <section className="space-y-3">
            <SectionTitle step="1" theme={t} icon={<Store className="w-3.5 h-3.5" />}>
              Attribution &amp; produit
            </SectionTitle>

            {!hasVendors && !loadingVendors ? (
              <div className="flex items-start gap-2.5 p-3.5 rounded-2xl border border-amber-100 bg-amber-50/60">
                <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] font-bold text-amber-800 leading-snug">
                  Aucun compte vendeur ne vous est assigné.
                  <span className="block font-medium text-amber-700/80 mt-0.5">
                    Demandez à un administrateur de vous attribuer un vendeur ou un influenceur pour pouvoir saisir des leads.
                  </span>
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <Field label="Compte vendeur" htmlFor="vendor" required error={formErrors.vendor}>
                  {loadingVendors ? (
                    <FieldSkeleton />
                  ) : (
                    <SearchableSelect
                      theme={theme}
                      options={vendors.map(v => ({ value: v.id, label: `${v.fullName} (${v.email})` }))}
                      value={selectedVendorId}
                      onChange={val => setSelectedVendorId(val as number)}
                      placeholder="Choisissez le vendeur..."
                      searchPlaceholder="Rechercher un vendeur..."
                      error={!!formErrors.vendor}
                    />
                  )}
                </Field>

                <Field
                  label="Produit"
                  htmlFor="product"
                  required
                  error={formErrors.product}
                  hint={!selectedVendorId ? 'Choisissez un vendeur en premier' : undefined}
                >
                  {loadingProducts ? (
                    <FieldSkeleton />
                  ) : (
                    <SearchableSelect
                      theme={theme}
                      options={products.map(p => ({
                        value: p.id,
                        label: `${p.name} — ${p.sku} (${Number(p.retailPriceMad).toFixed(2)} MAD)`,
                      }))}
                      value={selectedProductId}
                      onChange={val => setSelectedProductId(val as number)}
                      placeholder={
                        !selectedVendorId
                          ? 'Sélectionnez un vendeur d\'abord'
                          : products.length === 0
                            ? 'Aucun produit disponible'
                            : 'Choisissez le produit...'
                      }
                      searchPlaceholder="Rechercher un produit ou SKU..."
                      disabled={!selectedVendorId}
                      error={!!formErrors.product}
                    />
                  )}
                </Field>

                <Field label="Nom du pack" htmlFor="packName" hint="Optionnel">
                  <input
                    id="packName"
                    type="text"
                    disabled={!selectedProductId}
                    value={packName}
                    onChange={e => setPackName(e.target.value)}
                    placeholder="Ex: Pack 2 + 1 Gratuit"
                    className={inputCls(t, false, !selectedProductId)}
                  />
                </Field>

                <Field label="Quantité" htmlFor="qte" required>
                  <input
                    id="qte"
                    type="number"
                    min="1"
                    disabled={!selectedProductId}
                    value={qte}
                    onChange={e => setQte(Math.max(1, parseInt(e.target.value) || 1))}
                    className={inputCls(t, false, !selectedProductId)}
                  />
                </Field>
              </div>
            )}

            {/* Live recap of what the customer will be charged */}
            {selectedProduct && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-2xl border border-gray-100 bg-gray-50/70">
                {selectedProduct.image ? (
                  <img src={selectedProduct.image} alt="" className="w-11 h-11 rounded-xl object-cover border border-gray-200 bg-white shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5 text-gray-300" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-gray-900 truncate">{selectedProduct.name}</p>
                  <p className="text-[10px] font-bold text-gray-400">
                    SKU {selectedProduct.sku} · {money(unitPrice)} × {qte}
                  </p>
                </div>

                <div className="sm:w-44 shrink-0">
                  <label htmlFor="customPrice" className="block text-[9px] font-black text-gray-500 uppercase tracking-wider mb-1">
                    Prix total à encaisser
                  </label>
                  <input
                    id="customPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={customPrice}
                    onChange={e => setCustomPrice(e.target.value)}
                    placeholder={standardTotal.toFixed(2)}
                    className={inputCls(t, !!formErrors.customPrice)}
                  />
                </div>

                <div className="text-right shrink-0">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Total</p>
                  <p className={`text-lg font-black tabular-nums ${customPrice !== '' ? t.icon : 'text-gray-900'}`}>
                    {money(effectiveTotal)}
                  </p>
                  {customPrice !== '' && (
                    <p className="text-[9px] font-bold text-gray-400">au lieu de {money(standardTotal)}</p>
                  )}
                </div>
              </div>
            )}
            {formErrors.customPrice && (
              <p className="text-[10px] text-red-500 font-bold">{formErrors.customPrice}</p>
            )}
          </section>

          <hr className="border-gray-100" />

          {/* --- Section 2 ------------------------------------------------ */}
          <section className="space-y-3">
            <SectionTitle step="2" theme={t} icon={<User className="w-3.5 h-3.5" />}>
              Client &amp; livraison
            </SectionTitle>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <Field label="Nom complet" htmlFor="fullName" required error={formErrors.fullName}>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Ex: Ahmed Naoum"
                    className={inputCls(t, !!formErrors.fullName) + ' pl-9'}
                  />
                </div>
              </Field>

              <Field label="Téléphone" htmlFor="phone" required error={formErrors.phone}>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={e => handlePhoneChange(e.target.value)}
                      placeholder="0612345678"
                      className={inputCls(t, !!formErrors.phone) + ' pl-9'}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleViewHistory(false)}
                    className={`h-11 px-3 rounded-xl border transition-all shadow-sm flex items-center justify-center shrink-0 ${t.soft}`}
                    title="Voir l'historique détaillé du client"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </Field>

              <Field label="Ville" htmlFor="city" required error={formErrors.city}>
                {loadingCities ? (
                  <FieldSkeleton />
                ) : (
                  <CitySelect
                    theme={theme}
                    deliverableOnly
                    value={city}
                    onChange={name => setCity(name)}
                    placeholder="Sélectionner une ville..."
                    error={!!formErrors.city}
                  />
                )}
              </Field>

              {/* Both map to real Coliaty parcel flags (package_replacement,
                  package_no_open) — not to the note field. */}
              <Field label="Options d'expédition" htmlFor="replacement">
                <div className={`h-11 flex items-center gap-3 rounded-xl border px-3 transition-all ${
                  packageReplacement || packageNoOpen ? t.soft : 'border-gray-200 bg-gray-50/60'
                }`}>
                  <label htmlFor="replacement" className="flex items-center gap-2 cursor-pointer select-none" title="Colis de remplacement — exige le n° de suivi remplacé">
                    <input
                      id="replacement"
                      type="checkbox"
                      checked={packageReplacement}
                      onChange={e => {
                        setPackageReplacement(e.target.checked);
                        if (!e.target.checked) setPackageOldTracking('');
                      }}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-xs font-bold text-gray-700 whitespace-nowrap">Remplacement</span>
                  </label>

                  <span className="h-4 w-px bg-black/10 shrink-0" />

                  <label htmlFor="noOpen" className="flex items-center gap-2 cursor-pointer select-none" title="Le client ne peut pas ouvrir le colis avant de payer">
                    <input
                      id="noOpen"
                      type="checkbox"
                      checked={packageNoOpen}
                      onChange={e => setPackageNoOpen(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-xs font-bold text-gray-700 whitespace-nowrap">Ne pas ouvrir</span>
                  </label>
                </div>
              </Field>
            </div>

            {/* Only takes space once the box above is ticked */}
            {packageReplacement && (
              <div className="max-w-md">
                <Field label="N° de suivi à remplacer" htmlFor="oldTracking" required error={formErrors.packageOldTracking}>
                  <input
                    id="oldTracking"
                    type="text"
                    value={packageOldTracking}
                    onChange={e => setPackageOldTracking(e.target.value)}
                    placeholder="Ex: CO123456789"
                    className={inputCls(t, !!formErrors.packageOldTracking)}
                  />
                </Field>
              </div>
            )}

            {/* Trust score — a single compact strip instead of a stacked block */}
            <TrustStrip
              historyData={historyData}
              loading={loadingHistory && !showHistoryModal}
              phone={phone}
              onOpen={() => handleViewHistory(false)}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Field label="Adresse détaillée" htmlFor="address" required error={formErrors.address}>
                <textarea
                  id="address"
                  rows={3}
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Quartier, rue, n° de porte… (min. 8 caractères)"
                  className={inputCls(t, !!formErrors.address) + ' h-auto py-2.5 resize-none'}
                />
              </Field>

              <Field label="Notes (internes & livraison Coliaty)" htmlFor="notes" hint="Optionnel">
                <textarea
                  id="notes"
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Ex: Livrer après 18h, appeler avant d'arriver…"
                  className={inputCls(t, false) + ' h-auto py-2.5 resize-none'}
                />
              </Field>
            </div>
          </section>
        </div>

        {/* Submit bar — recap on the left so it's obvious what is about to be created */}
        <div className="border-t border-gray-100 bg-gray-50/70 px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="min-w-0 flex-1 text-[11px] font-bold text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-1">
            {(() => {
              // Build the parts first, then interleave separators — rendering a
              // separator per optional field left a stray "·" when the earlier
              // field was still empty.
              const parts = [
                fullName && <span key="n" className="text-gray-900">{fullName}</span>,
                selectedProduct && <span key="p" className="truncate max-w-[220px]">{selectedProduct.name}</span>,
                city && <span key="c">{city}</span>,
                selectedProduct && <span key="t" className="text-gray-900">{money(effectiveTotal)}</span>,
              ].filter(Boolean);

              if (parts.length === 0) {
                return (
                  <span className="text-gray-400 font-medium">
                    Le lead sera ajouté à la file d'attente, pas expédié immédiatement.
                  </span>
                );
              }
              return parts.map((part, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 && <span className="text-gray-300" aria-hidden="true">·</span>}
                  {part}
                </span>
              ));
            })()}
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/agent/leads')}
              className="px-4 py-2.5 border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all text-xs font-black tracking-wider rounded-xl"
            >
              ANNULER
            </button>
            <button
              type="submit"
              disabled={submitting || !hasVendors}
              className={`px-5 py-2.5 text-white text-xs font-black tracking-wider transition-all shadow-md rounded-xl flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${t.ctaRing} ${
                submitting || !hasVendors ? 'opacity-60 cursor-not-allowed bg-gray-400 shadow-none' : `${t.cta} active:scale-95`
              }`}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {submitting ? 'AJOUT…' : 'AJOUTER À LA FILE'}
            </button>
          </div>
        </div>
      </form>

      {/* ------------------------------------------------------- Waiting list */}
      <div id="file-attente" className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden relative scroll-mt-4">
        <div className={`absolute top-0 left-0 right-0 h-1.5 ${t.accentBar}`} />

        <div className="p-5 sm:p-6 pt-7 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
              <Truck className={`w-4 h-4 ${t.icon}`} />
              Liste d'attente Coliaty
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${t.soft}`}>
                {leads.length}
              </span>
            </h2>
            <p className="text-[11px] text-gray-400 font-medium mt-1">
              Cochez les leads à expédier en lot. Des frais de saisie sont facturés aux vendeurs respectifs.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="relative flex-1 lg:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <label htmlFor="queueSearch" className="sr-only">Rechercher dans la file</label>
              <input
                id="queueSearch"
                type="text"
                placeholder="Nom, téléphone, ville…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={`w-full h-10 pl-9 pr-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:bg-white transition-all ${t.ring}`}
              />
            </div>
            <button
              type="button"
              onClick={() => { refetchDispatch(); toast.success('Données actualisées'); }}
              disabled={loadingDispatch || isFetchingDispatch}
              className="h-10 w-10 bg-gray-50 text-gray-500 rounded-xl hover:bg-gray-100 transition-all flex items-center justify-center shrink-0 active:scale-95 disabled:opacity-50"
              title="Actualiser la liste"
            >
              <RotateCcw className={`w-4 h-4 ${loadingDispatch || isFetchingDispatch ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Refused parcels, with Coliaty's own reason. These leads are still in
            the queue below — fix the field it names, then re-send. */}
        {dispatchErrors.length > 0 && (
          <div className="px-5 sm:px-6 py-3 border-b border-rose-100 bg-rose-50/70">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
              <span className="text-xs font-black text-rose-700">
                {dispatchErrors.length} colis refusé(s) par Coliaty
              </span>
              <button
                type="button"
                onClick={() => setDispatchErrors([])}
                className="ml-auto px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider text-rose-600 hover:bg-rose-100 transition-colors"
              >
                Masquer
              </button>
            </div>
            <ul className="mt-2 space-y-1">
              {dispatchErrors.map(e => (
                <li key={e.leadId} className="flex flex-wrap items-baseline gap-x-2 text-[11px]">
                  <span className="font-black text-gray-800">{e.name}</span>
                  {e.phone && <span className="font-medium text-gray-400 tabular-nums">{e.phone}</span>}
                  <span className="text-rose-400" aria-hidden="true">→</span>
                  <span className="font-medium text-rose-700">{e.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Selection bar only appears when it has something to say */}
        {selectedLeadIds.length > 0 && (
          <div className={`px-5 sm:px-6 py-2.5 flex items-center justify-between gap-3 border-b ${t.soft}`}>
            <span className="text-xs font-black">
              {selectedLeadIds.length} lead(s) sélectionné(s)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedLeadIds([])}
                className="px-3 py-1.5 rounded-lg bg-white/70 text-[10px] font-black uppercase tracking-wider hover:bg-white transition-colors"
              >
                Tout désélectionner
              </button>
              <button
                type="button"
                onClick={handleDispatch}
                disabled={dispatchMutation.isPending}
                className={`px-4 py-1.5 rounded-lg text-white text-[10px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-60 ${t.cta}`}
              >
                {dispatchMutation.isPending
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Truck className="w-3 h-3" />}
                Expédier
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/70">
              <tr>
                <th scope="col" className="p-3 w-10">
                  <label htmlFor="selectAll" className="sr-only">Tout sélectionner</label>
                  <input
                    id="selectAll"
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    disabled={leads.length === 0}
                  />
                </th>
                <th scope="col" className="p-3 font-black text-gray-400 uppercase text-[9px] tracking-widest">Client</th>
                <th scope="col" className="p-3 font-black text-gray-400 uppercase text-[9px] tracking-widest">Contact</th>
                <th scope="col" className="p-3 font-black text-gray-400 uppercase text-[9px] tracking-widest">Produit</th>
                <th scope="col" className="p-3 font-black text-gray-400 uppercase text-[9px] tracking-widest">Vendeur</th>
                <th scope="col" className="p-3 font-black text-gray-400 uppercase text-[9px] tracking-widest text-right">Prix</th>
                <th scope="col" className="p-3 font-black text-gray-400 uppercase text-[9px] tracking-widest text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingDispatch ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <Loader2 className={`w-5 h-5 animate-spin mx-auto ${t.icon}`} />
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-3">
                        <Truck className="w-6 h-6 text-gray-300" />
                      </div>
                      <p className="font-black text-gray-700 text-sm">
                        {debouncedSearch ? 'Aucun résultat' : 'La file est vide'}
                      </p>
                      <p className="text-[11px] text-gray-400 font-medium mt-1 max-w-xs">
                        {debouncedSearch
                          ? `Aucun lead ne correspond à « ${debouncedSearch} ».`
                          : 'Saisissez un lead ci-dessus — il apparaîtra ici, prêt à être expédié en lot.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                leads.map((lead: any) => {
                  const isSelected = selectedLeadIds.includes(lead.id);
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => toggleSelect(lead.id)}
                      className={`cursor-pointer transition-colors ${isSelected ? t.soft.replace(/text-\S+|border-\S+/g, '') : 'hover:bg-gray-50/60'}`}
                    >
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <label htmlFor={`sel-${lead.id}`} className="sr-only">Sélectionner {lead.fullName}</label>
                        <input
                          id={`sel-${lead.id}`}
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                          checked={isSelected}
                          onChange={() => toggleSelect(lead.id)}
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-800">{lead.fullName}</span>
                          {lead.source === 'WHATSAPP' && (
                            <span className="inline-flex items-center justify-center p-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100" title="Lead WhatsApp">
                              <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                              </svg>
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{lead.city}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-gray-800 tabular-nums">{lead.phone}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Saisi le {format(new Date(lead.createdAt), 'dd/MM')}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-gray-800 line-clamp-1">{lead.product?.name || 'Produit inconnu'}</div>
                        {lead.productVariant && (
                          <span className={`mt-0.5 inline-block px-1.5 py-0.5 rounded text-[9px] font-black border ${t.soft}`}>
                            📦 {lead.productVariant}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="text-[10px] font-bold text-gray-500 flex items-center gap-1">
                          <Store className="w-2.5 h-2.5 opacity-50 shrink-0" />
                          <span className="truncate">{lead.vendor?.fullName || '—'}</span>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="font-black text-gray-900 tabular-nums">{lead.productPrice} MAD</div>
                      </td>
                      <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                        {/* Inline confirm rather than window.confirm(): strict
                            browser settings silently drop the native dialog,
                            which made the delete look like it did nothing. */}
                        {confirmDeleteId === lead.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => deleteMutation.mutate(lead.id)}
                              disabled={deleteMutation.isPending}
                              className="px-2 py-1 bg-rose-500 text-white rounded-lg text-[9px] font-black hover:bg-rose-600 transition-colors disabled:opacity-50"
                              title="Confirmer — le lead et sa commande seront supprimés"
                            >
                              {deleteMutation.isPending ? '…' : 'OUI'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 bg-gray-100 text-gray-500 rounded-lg text-[9px] font-black hover:bg-gray-200 transition-colors"
                            >
                              NON
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(lead.id)}
                            disabled={deleteMutation.isPending}
                            className="p-1.5 text-gray-300 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors inline-flex items-center justify-center disabled:opacity-50"
                            title="Supprimer de la liste d'attente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className={`p-6 text-white shrink-0 relative overflow-hidden ${t.accentBar}`}>
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

type ThemeTokens = (typeof THEME)[ThemeKey];

/** One consistent input shape everywhere, so fields stop drifting apart. */
function inputCls(t: ThemeTokens, hasError: boolean, disabled = false) {
  return [
    'w-full h-11 px-3.5 border rounded-xl text-sm font-semibold shadow-sm outline-none transition-all',
    'focus:ring-2 focus:border-transparent',
    t.ring,
    hasError ? 'border-red-300 bg-red-50 focus:ring-red-400' : 'border-gray-200 bg-white',
    disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : '',
  ].join(' ');
}

function SectionTitle({ step, theme, icon, children }: {
  step: string; theme: ThemeTokens; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black shadow-sm shrink-0 ${theme.step}`}>
        {step}
      </span>
      <h2 className="text-sm font-black text-gray-900 flex items-center gap-1.5">
        <span className={theme.icon}>{icon}</span>
        {children}
      </h2>
      <span className="flex-1 h-px bg-gray-100" />
    </div>
  );
}

/**
 * Every label is tied to its control with htmlFor/id — clicking the label now
 * focuses the field, and screen readers announce it. 11 of the 12 labels on
 * this page previously had no association at all.
 */
function Field({ label, htmlFor, required, error, hint, children }: {
  label: string; htmlFor: string; required?: boolean;
  error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="flex items-center gap-1 text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5">
        {label}
        {required && <span className="text-rose-400" aria-hidden="true">*</span>}
        {hint && <span className="ml-auto font-bold text-gray-300 normal-case tracking-normal">{hint}</span>}
      </label>
      {children}
      {error && <p className="text-[10px] text-red-500 font-bold mt-1">{error}</p>}
    </div>
  );
}

function FieldSkeleton() {
  return <div className="h-11 bg-gray-50 border border-gray-100 rounded-xl animate-pulse" />;
}

/** Compact trust indicator: one row, not the old 66px stacked block. */
function TrustStrip({ historyData, loading, phone, onOpen }: {
  historyData: any; loading: boolean; phone: string; onOpen: () => void;
}) {
  const cleaned = phone.replace(/\s+/g, '');
  const isComplete = cleaned.length === 10 || (cleaned.startsWith('+212') && cleaned.length >= 13);

  if (loading && isComplete) {
    return (
      <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-gray-100 bg-gray-50/60 text-[11px] font-bold text-gray-400">
        <div className="w-3.5 h-3.5 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
        Analyse de l'historique du client…
      </div>
    );
  }

  if (!historyData) return null;

  const isNew = !historyData.rawHistory?.leads?.length && !historyData.rawHistory?.orders?.length;
  if (isNew) {
    return (
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-gray-100 bg-gray-50/60">
        <Info className="w-4 h-4 text-gray-400 shrink-0" />
        <span className="text-[11px] font-bold text-gray-600">Nouveau client</span>
        <span className="text-[11px] font-medium text-gray-400">— aucun historique de commande.</span>
      </div>
    );
  }

  const delivered = historyData.summary.orderStats['DELIVERED'] || 0;
  const cancelled = historyData.summary.leadStats['CANCEL_ORDER'] || 0;
  const returns = historyData.summary.orderStats['RETURNED'] || 0;

  let score = 50 + delivered * 20 - cancelled * 15 - returns * 25;
  score = Math.max(0, Math.min(100, score));

  const tone = score >= 70
    ? { wrap: 'bg-emerald-50 border-emerald-100', dot: 'bg-emerald-500', text: 'text-emerald-700', msg: 'Client très fiable.' }
    : score < 40
      ? { wrap: 'bg-rose-50 border-rose-100', dot: 'bg-rose-500', text: 'text-rose-700', msg: 'Historique problématique.' }
      : { wrap: 'bg-amber-50 border-amber-100', dot: 'bg-amber-500', text: 'text-amber-700', msg: 'Historique modéré.' };

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5 rounded-xl border ${tone.wrap}`}>
      <span className="flex items-center gap-2 shrink-0">
        <ShieldAlert className={`w-4 h-4 ${tone.text}`} />
        <span className={`text-[11px] font-black ${tone.text}`}>Confiance {score}%</span>
      </span>
      <span className="h-3 w-px bg-black/10" />
      <span className="flex items-center gap-3 text-[10px] font-bold text-gray-500">
        <span>✅ {delivered} livré(s)</span>
        <span>❌ {cancelled} annulé(s)</span>
        <span>↩️ {returns} retour(s)</span>
      </span>
      <span className="text-[10px] font-medium text-gray-400">{tone.msg}</span>
      <button
        type="button"
        onClick={onOpen}
        className="ml-auto text-[10px] font-black uppercase tracking-wider text-gray-500 hover:text-gray-900 transition-colors shrink-0"
      >
        Détails →
      </button>
    </div>
  );
}

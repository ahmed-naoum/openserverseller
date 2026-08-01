import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { influencerApi } from '../../lib/api';
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  XCircle,
  ExternalLink,
  Search,
  RefreshCw,
  AlertCircle,
  Plus,
  Power,
  Eye,
  MousePointerClick,
  Zap,
  Target,
  DollarSign,
  Copy,
  QrCode,
  Wand2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { buildReferralUrl } from '../../utils/referral';
import { containsBlockedWord } from '../../utils/blockedWords';

type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'BUILDING';

export default function VendorInventory() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [claims, setClaims] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ClaimStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Link Creation Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedProductName, setSelectedProductName] = useState('');
  const [customName, setCustomName] = useState('');
  const [customNameError, setCustomNameError] = useState('');
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [isCreatingLink, setIsCreatingLink] = useState(false);

  // Links List Modal States
  const [isLinksModalOpen, setIsLinksModalOpen] = useState(false);
  const [selectedProductForLinks, setSelectedProductForLinks] = useState<{ id: number; name: string } | null>(null);
  const [modalLinks, setModalLinks] = useState<any[]>([]);
  const [isModalLinksLoading, setIsModalLinksLoading] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedLinkForQr, setSelectedLinkForQr] = useState<any | null>(null);

  // Builder Selection Modal States
  const [isBuilderSelectOpen, setIsBuilderSelectOpen] = useState(false);
  const [builderSelectLinks, setBuilderSelectLinks] = useState<any[]>([]);
  const [builderSelectProductName, setBuilderSelectProductName] = useState('');

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    icon: React.ReactNode;
    confirmText: string;
    variant: 'primary' | 'danger';
    isLoading?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    icon: <RefreshCw size={24} />,
    confirmText: 'Confirmer',
    variant: 'primary',
    isLoading: false
  });


  useEffect(() => {
    fetchClaims();
  }, [user?.mode, user?.id]);

  const fetchClaims = async () => {
    try {
      setIsLoading(true);
      const res = await influencerApi.getClaims();
      // Handle potential response structure differences
      const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      const currentMode = user?.mode || 'SELLER';

      const activeClaims = data.filter((c: any) => {
        const isVendorProduct = Boolean(user?.id && c.product?.ownerId === user.id);

        if (currentMode === 'SELLER') {
          // Mode Vendeur: Show ONLY vendor's owned products
          return isVendorProduct;
        } else {
          // Mode Affilié: Show ONLY products claimed from marketplace (owned by other vendors/admins)
          return !isVendorProduct;
        }
      });
      setClaims(activeClaims);
    } catch (error) {
      toast.error(t('error_loading', 'inventory', 'Impossible de charger vos produits'));
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredClaims = claims.filter(claim => {
    let matchesTab = false;
    if (activeTab === 'ALL') {
      matchesTab = true;
    } else if (activeTab === 'BUILDING') {
      matchesTab = claim.status === 'APPROVED' && claim.referralLink?.status === 'BUILDING';
    } else if (activeTab === 'APPROVED') {
      matchesTab = claim.status === 'APPROVED' && claim.referralLink?.status !== 'BUILDING';
    } else {
      matchesTab = claim.status === activeTab;
    }
    const matchesSearch = (claim.product?.nameFr || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (claim.product?.sku || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const stats = {
    pending: claims.filter(c => c.status === 'PENDING').length,
    building: claims.filter(c => c.status === 'APPROVED' && c.referralLink?.status === 'BUILDING').length,
    approved: claims.filter(c => c.status === 'APPROVED' && c.referralLink?.status !== 'BUILDING').length,
  };

  const handleNameChange = (val: string) => {
    let clean = val.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '');
    setCustomName(clean);

    if (!clean) {
      setCustomNameError('');
      return;
    }
    if (clean.length < 3) {
      setCustomNameError(t('err_name_short', 'links', 'Le nom doit faire au moins 3 caractères'));
      return;
    }
    if (clean.length > 20) {
      setCustomNameError(t('err_name_long', 'links', 'Le nom ne doit pas dépasser 20 caractères'));
      return;
    }
    const regex = /^[a-zA-Z0-9-_]+$/;
    if (!regex.test(clean)) {
      setCustomNameError(t('err_name_invalid_chars', 'links', 'Caractères non autorisés (lettres, chiffres, tirets)'));
      return;
    }
    const blocked = containsBlockedWord(clean);
    if (blocked) {
      setCustomNameError(t('err_name_blocked', 'links', 'Ce nom contient un mot interdit.'));
      return;
    }
    setCustomNameError('');
  };

  useEffect(() => {
    if (!customName || customName.length < 3 || customName.length > 20 || !/^[a-zA-Z0-9-_]+$/.test(customName)) {
      return;
    }
    if (containsBlockedWord(customName)) {
      return;
    }
    const timer = setTimeout(async () => {
      setIsCheckingName(true);
      try {
        const res = await influencerApi.checkLinkNameUnique(customName);
        if (!res.data.unique) {
          setCustomNameError(t('err_name_taken', 'links', 'Ce nom de lien est déjà utilisé'));
        } else {
          setCustomNameError('');
        }
      } catch (err) {
        console.error('Error checking name uniqueness', err);
      } finally {
        setIsCheckingName(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [customName]);

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !customName || customNameError) return;

    setIsCreatingLink(true);
    try {
      const res = await influencerApi.createLink(selectedProductId, customName);
      const newLink = res.data;
      
      // Update the claims state locally to show the new link
      setClaims(prev => prev.map(c => {
        if (c.productId === selectedProductId) {
          return { ...c, referralLink: newLink };
        }
        return c;
      }));
      
      toast.success(t('link_success', 'inventory', 'Lien généré avec succès !'));
      setShowCreateModal(false);
      setCustomName('');
      setSelectedProductId(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('link_error', 'inventory', 'Erreur lors de la génération du lien'));
      console.error(error);
    } finally {
      setIsCreatingLink(false);
    }
  };

  const handleCopyLink = (code: string) => {
    const link = buildReferralUrl(code, user?.subdomain, user?.customDomain, user?.customDomainStatus);
    navigator.clipboard.writeText(link);
    toast.success(t('copied_success', 'inventory', 'Lien copié dans le presse-papiers !'));
  };

  const handleOpenLinksModal = async (productId: number, productName: string) => {
    setSelectedProductForLinks({ id: productId, name: productName });
    setIsLinksModalOpen(true);
    setIsModalLinksLoading(true);
    try {
      const res = await influencerApi.getLinks();
      const allLinks = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setModalLinks(allLinks.filter((l: any) => l.productId === productId));
    } catch (err) {
      toast.error(t('error_loading_links', 'inventory', 'Impossible de charger les liens'));
      console.error(err);
    } finally {
      setIsModalLinksLoading(false);
    }
  };

  const handleOpenBuilderSelection = async (productId: number, productName: string) => {
    const loadingToast = toast.loading(t('loading_links', 'inventory', 'Chargement des liens...'));
    try {
      const res = await influencerApi.getLinks();
      const allLinks = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      const productLinks = allLinks.filter((l: any) => l.productId === productId);
      
      toast.dismiss(loadingToast);
      
      if (productLinks.length === 0) {
        toast.error(t('no_links_exist', 'inventory', 'Veuillez d\'abord générer un lien pour ce produit.'));
        return;
      }
      
      if (productLinks.length === 1) {
        const link = productLinks[0];
        const role = user?.roleName || user?.role;
        const targetPath = role === 'VENDOR' 
          ? `/dashboard/links/${link.id}/builder` 
          : role === 'INFLUENCER' 
            ? `/influencer/links/${link.id}/builder` 
            : `/helper/links/${link.id}/builder`;
        navigate(targetPath);
        return;
      }
      
      setBuilderSelectLinks(productLinks);
      setBuilderSelectProductName(productName);
      setIsBuilderSelectOpen(true);
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error(t('error_loading_links', 'inventory', 'Impossible de charger les liens'));
      console.error(err);
    }
  };

  const handleToggleStatus = (link: any) => {
    setConfirmModal({
      isOpen: true,
      title: link.isActive ? t('confirm_deactivate_title', 'links', "Désactiver le lien ?") : t('confirm_activate_title', 'links', "Activer le lien ?"),
      message: link.isActive 
        ? t('confirm_deactivate_message', 'links', "Êtes-vous sûr de vouloir désactiver ce lien ? Les visiteurs cliquant sur ce lien ne pourront plus accéder à l'offre et verront le message 'Offre indisponible'.")
        : t('confirm_activate_message', 'links', "Êtes-vous sûr de vouloir réactiver ce lien de parrainage ?"),
      icon: <Power size={32} className={link.isActive ? "text-red-500 animate-pulse" : "text-emerald-500"} />,
      confirmText: link.isActive ? t('btn_deactivate', 'links', "Oui, désactiver") : t('btn_activate', 'links', "Oui, activer"),
      variant: link.isActive ? 'danger' : 'primary',
      isLoading: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        try {
          const res = await influencerApi.updateLinkStatus(link.id, !link.isActive);
          
          // Update in modal links list
          setModalLinks(prev => prev.map(l => l.id === link.id ? { ...l, isActive: res.data.isActive } : l));
          
          // Also update the main claims state if this link matches the referralLink
          setClaims(prev => prev.map(c => {
            if (c.productId === link.productId && c.referralLink?.id === link.id) {
              return { ...c, referralLink: { ...c.referralLink, isActive: res.data.isActive } };
            }
            return c;
          }));
          
          toast.success(link.isActive ? t('toast_deactivated', 'links', 'Lien désactivé') : t('toast_activated', 'links', 'Lien activé'));
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          toast.error(t('toast_status_error', 'links', 'Erreur lors du changement de statut'));
        } finally {
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-influencer-200 border-t-influencer-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('title', 'inventory', 'Mes Produits Réclamés')}
            {user?.mode === 'SELLER' && <span className="ml-2 text-emerald-600">(Vendeur)</span>}
            {user?.mode === 'AFFILIATE' && <span className="ml-2 text-indigo-600">(Affilié)</span>}
          </h1>
          <p className="text-gray-500 text-sm mt-1">{t('subtitle', 'inventory', 'Gérez vos produits réclamés et suivez vos approbations.')}</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchClaims}
            className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-influencer-600 hover:border-influencer-200 hover:bg-influencer-50 transition-all shadow-sm group"
            title={t('refresh', 'inventory', 'Actualiser')}
          >
            <RefreshCw className="w-4 h-4 group-active:animate-spin" />
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text"
              placeholder={t('search_placeholder', 'inventory', 'Rechercher un produit...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-influencer-500 outline-none transition-all w-full md:w-64"
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('pending', 'inventory', 'En attente')}</p>
            <p className="text-xl font-black text-gray-900">{stats.pending}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('building', 'inventory', 'En construction')}</p>
            <p className="text-xl font-black text-gray-900">{stats.building}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('approved', 'inventory', 'Approuvés')}</p>
            <p className="text-xl font-black text-gray-900">{stats.approved}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 w-fit">
        {(['ALL', 'PENDING', 'BUILDING', 'APPROVED'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === tab 
                ? 'bg-influencer-600 text-white shadow-lg shadow-influencer-200' 
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {tab === 'ALL' ? t('all', 'inventory', 'Tous') : tab === 'PENDING' ? t('pending', 'inventory', 'En attente') : tab === 'BUILDING' ? t('building', 'inventory', 'En construction') : t('approved', 'inventory', 'Approuvés')}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredClaims.map((claim) => (
            <motion.div
              key={claim.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col"
            >
              <div className="aspect-square relative overflow-hidden bg-gray-50">
                {claim.product.images?.[0]?.imageUrl ? (
                  <img 
                    src={claim.product.images[0].imageUrl} 
                    alt={claim.product.nameFr}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-12 h-12 text-gray-200" />
                  </div>
                )}
                
                <div className="absolute top-3 right-3">
                  <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5 ${
                    claim.status === 'APPROVED' ? 'bg-green-500 text-white' :
                    claim.status === 'REJECTED' ? 'bg-red-500 text-white' :
                    'bg-amber-500 text-white'
                  }`}>
                    {claim.status === 'APPROVED' && <CheckCircle2 className="w-3 h-3" />}
                    {claim.status === 'REJECTED' && <XCircle className="w-3 h-3" />}
                    {claim.status === 'PENDING' && <Clock className="w-3 h-3" />}
                    {claim.status === 'APPROVED' ? t('approved_single', 'inventory', 'Approuvé') : claim.status === 'REJECTED' ? t('rejected_single', 'inventory', 'Refusé') : t('pending', 'inventory', 'En attente')}
                  </div>
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-bold text-gray-900 mb-1 line-clamp-1">{claim.product.nameFr}</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-4">SKU: {claim.product.sku}</p>
                
                <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="text-sm font-black text-slate-800">
                      {t('qty', 'inventory', 'Qte')}: {claim.product.stockQuantity || 0}
                    </div>
                  </div>
                  
                  {claim.status === 'APPROVED' ? (
                    claim.referralLink ? (
                      claim.referralLink.status === 'BUILDING' ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            {t('building', 'inventory', 'En construction')}
                          </span>
                          <span className="text-[8px] text-gray-400 italic text-right max-w-[120px]">
                            {t('link_preparation', 'inventory', "Lien en préparation par l'équipe...")}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleOpenBuilderSelection(claim.productId, claim.product.nameFr)}
                            className="p-2 bg-purple-50 text-purple-600 hover:text-white hover:bg-purple-600 border border-purple-100 hover:border-purple-600 rounded-lg transition-all shadow-sm flex items-center justify-center animate-pulse"
                            title={t('tooltip_builder', 'links') || "Constructeur de Page"}
                          >
                            <Wand2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleOpenLinksModal(claim.productId, claim.product.nameFr)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-100 hover:bg-slate-100 rounded-lg transition-colors text-xs font-black uppercase tracking-wider shadow-sm"
                          >
                            <ExternalLink className="w-3 h-3 text-slate-500" />
                            {t('manage_links', 'inventory', 'Gérer les liens')}
                          </button>
                        </div>
                      )
                    ) : (
                      <button 
                        onClick={() => {
                          setSelectedProductId(claim.productId);
                          setSelectedProductName(claim.product.nameFr);
                          setCustomName('');
                          setCustomNameError('');
                          setShowCreateModal(true);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-influencer-600 text-white rounded-lg hover:bg-influencer-700 transition-colors text-xs font-bold shadow-sm"
                      >
                        <Package className="w-3 h-3" />
                        {t('generate', 'inventory', 'Générer')}
                      </button>
                    )
                  ) : (
                    <div className="text-[10px] font-bold text-gray-400 italic">
                      {claim.status === 'REJECTED' ? t('not_eligible', 'inventory', 'Non éligible') : t('verifying', 'inventory', 'Vérification...')}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredClaims.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-400 bg-white rounded-2xl border-2 border-dashed border-gray-100">
            <Package className="w-16 h-16 mb-4 opacity-20" />
            <p className="font-bold">{t('no_product_found', 'inventory', 'Aucun produit trouvé')}</p>
            <p className="text-sm">{t('no_product_desc', 'inventory', 'Essayez de modifier vos filtres ou de réclamer des produits au marché.')}</p>
          </div>
        )}
      </div>

      {/* Create Link Modal */}
      {showCreateModal && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/65 backdrop-blur-md flex items-center justify-center z-[999999] p-4 animate-in fade-in duration-300 cursor-pointer"
          onClick={() => {
            setShowCreateModal(false);
            setCustomName('');
            setCustomNameError('');
            setSelectedProductId(null);
          }}
        >
          <div 
            className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t('create_modal_title', 'links', 'Créer un Nouveau Lien')}</h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{t('create_modal_subtitle', 'links', 'PERSONNALISEZ VOTRE PARRAINAGE')}</p>
                </div>
                <button 
                  onClick={() => {
                    setShowCreateModal(false);
                    setCustomName('');
                    setCustomNameError('');
                    setSelectedProductId(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors text-sm font-black p-2 hover:bg-slate-50 rounded-xl"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateLink} className="space-y-6">
                {/* Product Name Display */}
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{t('label_select_product', 'links', 'PRODUIT SÉLECTIONNÉ')}</label>
                  <div className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700">
                    {selectedProductName}
                  </div>
                </div>

                {/* Custom Name input */}
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{t('label_custom_name', 'links', 'NOM DU LIEN PERSONNALISÉ')}</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={t('custom_name_placeholder', 'links', 'mon-super-lien')}
                      value={customName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className={`w-full px-4 py-3 bg-slate-50 border rounded-2xl text-sm font-mono font-bold text-slate-700 focus:outline-none transition-all ${
                        customNameError 
                          ? 'border-red-300 focus:border-red-500' 
                          : customName && !isCheckingName 
                            ? 'border-emerald-300 focus:border-emerald-500' 
                            : 'border-slate-100 focus:border-slate-900'
                      }`}
                      required
                      minLength={3}
                      maxLength={20}
                    />
                    {isCheckingName && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <RefreshCw size={14} className="animate-spin text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[70%]">
                      {t('final_url_prefix', 'links', 'URL FINALE')}: {buildReferralUrl(customName || t('name_placeholder', 'links', 'NOM'), user?.subdomain, user?.customDomain, user?.customDomainStatus)}
                    </span>
                    <span className={`text-[10px] font-black uppercase ${customName.length >= 3 && customName.length <= 20 ? 'text-slate-400' : 'text-amber-500'}`}>
                      {customName.length}/20 chars
                    </span>
                  </div>
                  {customNameError && (
                    <p className="text-xs font-bold text-red-500 flex items-center gap-1.5 mt-1">
                      <AlertCircle size={12} /> {customNameError}
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setCustomName('');
                      setCustomNameError('');
                      setSelectedProductId(null);
                    }}
                    className="flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all"
                  >
                    {t('btn_cancel', 'links', 'ANNULER')}
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingLink || !selectedProductId || !customName || !!customNameError || isCheckingName}
                    className="flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-white bg-slate-900 hover:bg-slate-800 rounded-2xl shadow-lg shadow-slate-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isCreatingLink && (
                      <RefreshCw size={14} className="animate-spin" />
                    )}
                    {t('btn_generate', 'links', 'GÉNÉRER')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Links List Modal */}
      {isLinksModalOpen && selectedProductForLinks && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/65 backdrop-blur-md flex items-center justify-center z-[999999] p-4 animate-in fade-in duration-300 cursor-pointer"
          onClick={() => {
            setIsLinksModalOpen(false);
            setSelectedProductForLinks(null);
            setModalLinks([]);
          }}
        >
          <div 
            className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t('product_links_title', 'inventory', 'Liens de Parrainage')}</h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                    {t('selected_product', 'inventory', 'Produit')}: {selectedProductForLinks.name}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setIsLinksModalOpen(false);
                    setSelectedProductForLinks(null);
                    setModalLinks([]);
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors text-sm font-black p-2 hover:bg-slate-50 rounded-xl"
                >
                  ✕
                </button>
              </div>

              {isModalLinksLoading ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Links List Container */}
                  <div className="max-h-[350px] overflow-y-auto space-y-4 pr-1">
                    {modalLinks.map((link) => {
                      const ctr = link.clicks > 0 ? ((link.conversions / link.clicks) * 100).toFixed(1) : '0.0';
                      return (
                        <div key={link.id} className="bg-slate-50/50 border border-slate-100/70 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-3">
                              <span className="px-3 py-1 bg-white border border-slate-100 text-slate-700 rounded-xl text-xs font-mono font-bold shadow-sm">
                                {link.code}
                              </span>
                              
                              {/* Status Badge Toggle */}
                              <button
                                onClick={() => handleToggleStatus(link)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                                  link.isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/50' : 'bg-slate-100 text-slate-400 border border-slate-200/50'
                                }`}
                              >
                                <Power className={`w-2.5 h-2.5 ${link.isActive ? 'text-emerald-500' : 'text-slate-400'}`} />
                                {link.isActive ? t('status_active', 'links', 'Actif') : t('status_paused', 'links', 'Suspendu')}
                              </button>
                            </div>
                            
                            <p className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[280px]">
                              URL: {buildReferralUrl(link.code, user?.subdomain, user?.customDomain, user?.customDomainStatus)}
                            </p>

                            {/* Mini Performance Grid */}
                            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100/50">
                              <div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{t('views', 'links', 'Vues')}</p>
                                <p className="text-xs font-black text-slate-800">{(link.rawClicks || link.clicks).toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{t('visitors', 'links', 'Visiteurs')}</p>
                                <p className="text-xs font-black text-slate-800">{link.clicks.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{t('sales', 'links', 'Ventes')}</p>
                                <p className="text-xs font-black text-slate-800">{link.conversions.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{t('ctr', 'links', 'Taux')}</p>
                                <p className="text-xs font-black text-indigo-600">{ctr}%</p>
                              </div>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <button
                              onClick={() => {
                                const fullUrl = buildReferralUrl(link.code, user?.subdomain, user?.customDomain, user?.customDomainStatus);
                                navigator.clipboard.writeText(fullUrl);
                                toast.success(t('copied_success', 'inventory', 'Lien copié dans le presse-papiers !'));
                              }}
                              className="p-2.5 bg-white text-slate-400 hover:text-slate-900 border border-slate-100 rounded-xl transition-all shadow-sm"
                              title={t('btn_copy', 'links', 'Copier le lien')}
                            >
                              <Copy size={14} />
                            </button>
                            <button
                              onClick={() => navigate(`/dashboard/links/${link.id}/builder`)}
                              className="p-2.5 bg-white text-slate-400 hover:text-purple-600 border border-slate-100 rounded-xl transition-all shadow-sm"
                              title={t('tooltip_builder', 'links') || "Constructeur de Page"}
                            >
                              <Wand2 size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedLinkForQr(link);
                                setShowQrModal(true);
                              }}
                              className="p-2.5 bg-white text-slate-400 hover:text-purple-600 border border-slate-100 rounded-xl transition-all shadow-sm"
                              title={t('btn_qr', 'links', 'Code QR')}
                            >
                              <QrCode size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {modalLinks.length === 0 && (
                      <div className="p-10 text-center bg-slate-50 border border-dashed border-slate-100 rounded-2xl">
                        <Package className="w-12 h-12 mx-auto text-slate-300 mb-2 opacity-55" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
                          {t('no_links_created', 'inventory', 'Aucun lien généré pour le moment')}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Add New Link Button */}
                  <div className="pt-4 border-t border-slate-100/80 flex justify-between items-center gap-4">
                    <button
                      onClick={() => {
                        setIsLinksModalOpen(false);
                        setSelectedProductId(selectedProductForLinks.id);
                        setSelectedProductName(selectedProductForLinks.name);
                        setCustomName('');
                        setCustomNameError('');
                        setShowCreateModal(true);
                      }}
                      disabled={modalLinks.length >= 5}
                      className="flex-1 py-3.5 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> {t('btn_create_another_link', 'inventory', 'Créer un autre lien')} ({modalLinks.length}/5)
                    </button>
                    <button
                      onClick={() => {
                        setIsLinksModalOpen(false);
                        setSelectedProductForLinks(null);
                        setModalLinks([]);
                      }}
                      className="px-6 py-3.5 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                    >
                      {t('btn_close', 'links', 'Fermer')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* QR Code Modal */}
      {showQrModal && selectedLinkForQr && createPortal(
        <div 
          className="fixed inset-0 z-[999999] bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setShowQrModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-10 text-center animate-in zoom-in-95 duration-300 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-black text-slate-900 mb-2">{t('qr_title', 'links', 'Code QR du lien')}</h2>
            <p className="text-sm text-slate-400 font-medium mb-8">{t('qr_subtitle', 'links', 'Scannez ou téléchargez le code QR')}</p>
            <div className="bg-white p-6 rounded-2xl border-4 border-dashed border-slate-100 inline-block mb-8">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(buildReferralUrl(selectedLinkForQr?.code, user?.subdomain, user?.customDomain, user?.customDomainStatus))}`}
                alt="QR Code"
                className="w-48 h-48 mx-auto"
              />
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(buildReferralUrl(selectedLinkForQr?.code, user?.subdomain, user?.customDomain, user?.customDomainStatus))}`;
                  link.download = `qr-link-${selectedLinkForQr?.code}.png`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  toast.success(t('toast_qr_ready', 'links', 'Téléchargement lancé !'));
                }}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl"
              >
                {t('btn_download_hd', 'links', 'Télécharger HD')}
              </button>
              <button onClick={() => setShowQrModal(false)} className="w-full py-4 bg-slate-50 text-slate-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all">
                {t('btn_close', 'links', 'Fermer')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/65 backdrop-blur-md flex items-center justify-center z-[999999] p-4 animate-in fade-in duration-300 cursor-pointer"
          onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-white/20 animate-in zoom-in-95 duration-200 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8 text-center">
              <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center bg-slate-50">
                {confirmModal.icon}
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-3">
                {confirmModal.title}
              </h2>
              <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">
                {confirmModal.message}
              </p>
            </div>
            <div className="p-8 bg-slate-50/50 flex gap-4">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                disabled={confirmModal.isLoading}
                className="flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 bg-white border border-slate-100 rounded-2xl transition-all disabled:opacity-50"
              >
                {t('btn_cancel', 'links', 'Annuler')}
              </button>
              <button
                onClick={confirmModal.onConfirm}
                disabled={confirmModal.isLoading}
                className={`flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-white rounded-2xl shadow-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                  confirmModal.variant === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                {confirmModal.isLoading && (
                  <RefreshCw size={14} className="animate-spin" />
                )}
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Builder Link Selection Modal */}
      {isBuilderSelectOpen && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/65 backdrop-blur-md flex items-center justify-center z-[999999] p-4 animate-in fade-in duration-300 cursor-pointer"
          onClick={() => {
            setIsBuilderSelectOpen(false);
            setBuilderSelectLinks([]);
          }}
        >
          <div 
            className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t('select_landing_title', 'inventory', 'Sélectionner une landing')}</h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                    {t('product_for', 'inventory', 'Produit')}: {builderSelectProductName}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setIsBuilderSelectOpen(false);
                    setBuilderSelectLinks([]);
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors text-sm font-black p-2 hover:bg-slate-50 rounded-xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                {builderSelectLinks.map((link) => (
                  <div 
                    key={link.id}
                    className="bg-slate-50/50 border border-slate-100/70 p-4 rounded-2xl flex items-center justify-between gap-4 hover:bg-slate-100/30 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 bg-white border border-slate-100 text-slate-700 rounded-lg text-xs font-mono font-bold shadow-sm">
                          {link.code}
                        </span>
                        {!link.isActive && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded-md text-[9px] font-black uppercase tracking-wider">
                            {t('status_paused', 'links', 'Suspendu')}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase truncate">
                        URL: {buildReferralUrl(link.code, user?.subdomain, user?.customDomain, user?.customDomainStatus)}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        const role = user?.roleName || user?.role;
                        const targetPath = role === 'VENDOR' 
                          ? `/dashboard/links/${link.id}/builder` 
                          : role === 'INFLUENCER' 
                            ? `/influencer/links/${link.id}/builder` 
                            : `/helper/links/${link.id}/builder`;
                        navigate(targetPath);
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors text-xs font-bold shadow-md shadow-purple-100"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      {t('open_builder', 'inventory', 'Modifier')}
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-6 mt-6 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => {
                    setIsBuilderSelectOpen(false);
                    setBuilderSelectLinks([]);
                  }}
                  className="px-6 py-3 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                >
                  {t('btn_close', 'links', 'Fermer')}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}

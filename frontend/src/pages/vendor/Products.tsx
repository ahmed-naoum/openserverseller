import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productsApi, publicApi, influencerApi } from '../../lib/api';
import { Package, ExternalLink, RefreshCw, Power, AlertCircle, Copy, QrCode, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { buildReferralUrl } from '../../utils/referral';
import { containsBlockedWord } from '../../utils/blockedWords';
import { useAuth } from '../../contexts/AuthContext';

export default function VendorProducts() {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [search, setSearch] = useState('');
  const { t } = useLanguage();
  const { user } = useAuth();
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


  

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => publicApi.categories(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['products', { category: selectedCategory, search }],
    queryFn: () => productsApi.list({ category: selectedCategory, search }),
  });

  const categories = categoriesData?.data?.data?.categories || [];
  const products = data?.data?.data?.products || [];
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
      // setClaims disabled for products view
      /*
        if (c.productId === selectedProductId) {
*/
      
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
          // setClaims disabled for products view
          /*
            if (c.productId === link.productId && c.referralLink?.id === link.id) {
*/
          
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

  

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catalogue Produits</h1>
          <p className="text-gray-500 mt-1">+200 produits personnalisables</p>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            className="input w-64"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Categories Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => setSelectedCategory('')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-colors ${
            !selectedCategory ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Tous
        </button>
        {categories.map((cat: any) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.slug)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-colors ${
              selectedCategory === cat.slug ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat.nameFr}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="text-center py-12">Chargement...</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product: any) => (
            <div key={product.id} className="card-hover overflow-hidden group">
              <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center relative">
                {product.primaryImage ? (
                  <img src={product.primaryImage} alt={product.nameFr} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl opacity-50">📦</span>
                )}
                {product.isCustomizable && (
                  <span className="absolute top-2 right-2 badge-primary">Personnalisable</span>
                )}
              </div>
              <div className="p-4">
                <div className="text-xs text-primary-600 font-medium mb-1">{product.category?.nameFr}</div>
                <h3 className="font-semibold text-gray-900 mb-1">{product.nameFr}</h3>
                <p className="text-xs text-gray-500 mb-2 line-clamp-2">{product.description}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-lg font-bold text-gray-900">{Number(product.retailPriceMad).toLocaleString()} MAD</span>
                    <span className="text-xs text-gray-400 block">Prix de vente suggéré</span>
                  </div>
                  <button className="btn-primary btn-sm">Personnaliser</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

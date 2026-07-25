import { useState, useEffect } from 'react';
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
import LinksManagerModal, { LinksManagerConfig } from '../../components/modals/LinksManagerModal';

type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'BUILDING';

export default function InfluencerInventory() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [claims, setClaims] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ClaimStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [linksConfig, setLinksConfig] = useState<LinksManagerConfig | null>(null);

  // Builder Selection Modal States
  const [isBuilderSelectOpen, setIsBuilderSelectOpen] = useState(false);
  const [builderSelectLinks, setBuilderSelectLinks] = useState<any[]>([]);
  const [builderSelectProductName, setBuilderSelectProductName] = useState('');


  useEffect(() => {
    fetchClaims();
  }, [user?.mode]);

  const fetchClaims = async () => {
    try {
      setIsLoading(true);
      const res = await influencerApi.getClaims();
      // Handle potential response structure differences
      const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      // Filter out rejected claims
      const isInfluencerUser = user?.roleName === 'INFLUENCER' || user?.role === 'INFLUENCER' || user?.isInfluencer;
      const currentMode = user?.mode || 'AFFILIATE';
      const activeClaims = data.filter((c: any) => 
        c.status !== 'REJECTED' && 
        (isInfluencerUser ? (c.userMode === 'AFFILIATE' || c.userMode === 'INFLUENCER') : c.userMode === currentMode)
      );
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
    const matchesSearch = claim.product.nameFr.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         claim.product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const stats = {
    pending: claims.filter(c => c.status === 'PENDING').length,
    building: claims.filter(c => c.status === 'APPROVED' && c.referralLink?.status === 'BUILDING').length,
    approved: claims.filter(c => c.status === 'APPROVED' && c.referralLink?.status !== 'BUILDING').length,
  };

  const handleLinkCreated = (productId: number, newLink: any) => {
    setClaims(prev => prev.map(c => {
      if (c.productId === productId) {
        return { ...c, referralLink: newLink };
      }
      return c;
    }));
  };

  const handleLinkStatusChanged = (productId: number, linkId: number, isActive: boolean) => {
    setClaims(prev => prev.map(c => {
      if (c.productId === productId && c.referralLink?.id === linkId) {
        return { ...c, referralLink: { ...c.referralLink, isActive } };
      }
      return c;
    }));
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
          <h1 className="text-2xl font-bold text-gray-900">{t('title', 'inventory', 'Mes Produits')}</h1>
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
                            onClick={() => setLinksConfig({
                              isOpen: true,
                              mode: 'manage',
                              productId: claim.productId,
                              productName: claim.product.nameFr
                            })}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-100 hover:bg-slate-100 rounded-lg transition-colors text-xs font-black uppercase tracking-wider shadow-sm"
                          >
                            <ExternalLink className="w-3 h-3 text-slate-500" />
                            {t('manage_links', 'inventory', 'Gérer les liens')}
                          </button>
                        </div>
                      )
                    ) : (
                      <button 
                        onClick={() => setLinksConfig({
                          isOpen: true,
                          mode: 'create',
                          productId: claim.productId,
                          productName: claim.product.nameFr
                        })}
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

      <LinksManagerModal
        config={linksConfig}
        onClose={() => setLinksConfig(null)}
        onLinkCreated={handleLinkCreated}
        onLinkStatusChanged={handleLinkStatusChanged}
      />

      {/* Builder Link Selection Modal */}
      {isBuilderSelectOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[130] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
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
        </div>
      )}
    </div>
  );
}

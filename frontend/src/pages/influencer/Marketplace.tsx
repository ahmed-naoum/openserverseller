import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { marketplaceApi, influencerApi, publicApi, customProductsApi } from '../../lib/api';
import {
  Search, Package, Link as LinkIcon, Copy, CheckCircle2, Eye,
  ChevronLeft, ChevronRight, Sparkles, TrendingUp, Zap, SlidersHorizontal,
  Upload, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { buildReferralUrl } from '../../utils/referral';
import MarketplaceSidebar from '../../components/marketplace/MarketplaceSidebar';
import LinksManagerModal, { LinksManagerConfig } from '../../components/modals/LinksManagerModal';

const HoverMarquee = ({ text, className = "" }: { text: string, className?: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useLayoutEffect(() => {
    if (containerRef.current && textRef.current) {
      setIsOverflowing(textRef.current.scrollWidth > containerRef.current.clientWidth);
    }
  }, [text]);

  if (isOverflowing) {
    return (
      <div className="w-full overflow-hidden whitespace-nowrap relative group/text" dir="ltr">
        <h3 className={`${className} block overflow-hidden text-ellipsis whitespace-nowrap group-hover:hidden text-left`} dir="ltr">
          {text}
        </h3>
        <div className="hidden group-hover:flex w-max animate-marquee-loop items-center">
          <h3 className={`${className} pr-12`}>{text}</h3>
          <h3 className={`${className} pr-12`}>{text}</h3>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full overflow-hidden text-left" dir="ltr">
      <h3 ref={textRef} className={`${className} whitespace-nowrap`}>
        {text}
      </h3>
    </div>
  );
};

export default function InfluencerMarketplace() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const basePath = user?.role === 'INFLUENCER' ? '/influencer' : user?.role === 'GROSSELLER' ? '/grosseller' : '/dashboard';
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [products, setProducts] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [total, setTotal] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('newest');
  const [linksConfig, setLinksConfig] = useState<LinksManagerConfig | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Custom Product Requests Modal State
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [customProductLink, setCustomProductLink] = useState('');
  const [customQty, setCustomQty] = useState(1);
  const [customDescription, setCustomDescription] = useState('');
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null);
  const [isUploadingCustomImage, setIsUploadingCustomImage] = useState(false);
  const [uploadProgressCustomImage, setUploadProgressCustomImage] = useState(0);
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false);
  const fileInputRefCustom = useRef<HTMLInputElement>(null);

  const handleCustomFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) {
      toast.error('Seuls les formats PNG, JPG, JPEG et WEBP sont acceptés');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('L\'image est trop volumineuse (max 5 Mo)');
      return;
    }

    setIsUploadingCustomImage(true);
    setUploadProgressCustomImage(10);

    try {
      setUploadProgressCustomImage(30);
      const res = await customProductsApi.uploadImage(file);
      setUploadProgressCustomImage(80);
      setCustomImageUrl(res.data.data.url);
      setUploadProgressCustomImage(100);
      toast.success('Image importée avec succès');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'importation de l\'image');
    } finally {
      setIsUploadingCustomImage(false);
      setUploadProgressCustomImage(0);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customCategory.trim() || !customDescription.trim() || customQty <= 0) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      setIsSubmittingCustom(true);
      await customProductsApi.createRequest({
        name: customName.trim(),
        category: customCategory.trim(),
        productLink: customProductLink.trim() || null,
        quantity: customQty,
        description: customDescription.trim(),
        imageUrl: customImageUrl || undefined
      });

      toast.success('Votre demande de production personnalisée a été soumise avec succès');
      
      setCustomName('');
      setCustomCategory('');
      setCustomProductLink('');
      setCustomQty(1);
      setCustomDescription('');
      setCustomImageUrl(null);
      setIsCustomModalOpen(false);
    } catch (error) {
      toast.error('Erreur lors de la soumission de la demande');
    } finally {
      setIsSubmittingCustom(false);
    }
  };

  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [limit, setLimit] = useState(10);
  const totalPages = Math.ceil(total / limit);

  const roleTitle = user?.role === 'INFLUENCER' 
    ? t('hero_influencer', 'marketplace') 
    : user?.role === 'GROSSELLER'
      ? (language === 'ar' ? 'لتجار الجملة' : 'Grossiste')
      : user?.mode === 'AFFILIATE' 
        ? (language === 'ar' ? 'للمسوقين بالعمولة' : 'Affilié') 
        : (language === 'ar' ? 'للبائعين' : 'Vendeur');

  const priceLabel = user?.role === 'INFLUENCER' 
    ? t('influencer_price', 'marketplace') 
    : user?.role === 'GROSSELLER'
      ? (language === 'ar' ? 'سعر الجملة' : 'Prix de Gros')
      : user?.mode === 'AFFILIATE' 
        ? (language === 'ar' ? 'سعر المسوق بالعمولة' : 'Prix Affilié') 
        : (language === 'ar' ? 'سعر البيع' : 'Prix de Vente');

  useEffect(() => {
    const currentSearchQuery = searchParams.get('search') || '';
    if (search === currentSearchQuery) return;
    const timer = setTimeout(() => {
      setSearchParams(prev => { if (search) prev.set('search', search); else prev.delete('search'); prev.set('page', '1'); return prev; });
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search, searchParams, setSearchParams]);

  useEffect(() => { fetchData(); }, [page, limit, JSON.stringify(selectedCategories), sortBy, searchParams.get('search'), priceMin, priceMax, statusFilter, user?.mode, user?.role]);

  useEffect(() => {
    publicApi.categories().then(r => setCategories(r.data?.data?.categories || [])).catch(() => {});
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [productsRes, claimsRes] = await Promise.all([
        marketplaceApi.products({
          view: user?.role === 'INFLUENCER' ? 'INFLUENCER' : user?.mode === 'AFFILIATE' ? 'AFFILIATE' : 'REGULAR',
          search: searchParams.get('search') || '',
          category: selectedCategories.join(','),
          page,
          limit
        }),
        influencerApi.getClaims()
      ]);
      let items = productsRes.data?.data?.products || [];
      const claimsDataRaw = Array.isArray(claimsRes.data) ? claimsRes.data : (claimsRes.data?.data || []);
      const currentMode = user?.mode || 'AFFILIATE';
      const claimsData = claimsDataRaw.filter((c: any) => c.userMode === currentMode);

      if (selectedCategories.length > 0) items = items.filter((p: any) => p.categories?.some((c: any) => selectedCategories.includes(c.slug)));

      // Price filter
      if (priceMin) items = items.filter((p: any) => Number(p.influencerPriceMad || p.retailPriceMad) >= Number(priceMin));
      if (priceMax) items = items.filter((p: any) => Number(p.influencerPriceMad || p.retailPriceMad) <= Number(priceMax));

      // Status filter
      if (statusFilter !== 'all') {
        items = items.filter((p: any) => {
          const claim = claimsData.find((c: any) => c.productId === p.id);
          if (statusFilter === 'available') return !claim;
          if (statusFilter === 'claimed') return claim?.status === 'APPROVED';
          if (statusFilter === 'pending') return claim?.status === 'PENDING';
          return true;
        });
      }

      if (sortBy === 'price_asc') items.sort((a: any, b: any) => Number(a.retailPriceMad) - Number(b.retailPriceMad));
      else if (sortBy === 'price_desc') items.sort((a: any, b: any) => Number(b.retailPriceMad) - Number(a.retailPriceMad));

      setProducts(items);
      setTotal(productsRes.data?.data?.total || 0);
      setClaims(claimsData);
    } catch { toast.error(t('error_load_data', 'marketplace')); } finally { setIsLoading(false); }
  };

  const goToPage = (p: number) => { setPage(p); setSearchParams(prev => { prev.set('page', String(p)); return prev; }); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const resetFilters = () => {
    setSelectedCategories([]); setSortBy('newest'); setPriceMin(''); setPriceMax(''); setStatusFilter('all'); setPage(1);
  };

  const getClaimStatus = (product: any) => {
    const claim = (claims || []).find((c: any) => c.productId === product.id);
    if (!claim) return 'available';
    if (claim.status === 'PENDING') return 'pending';
    if (claim.status === 'REJECTED') return 'rejected';
    if (claim.status === 'APPROVED') return 'claimed';
    return 'available';
  };

  const renderClaimAction = (product: any) => {
    const claim = (claims || []).find((c: any) => c.productId === product.id);
    if (!claim) return (
      <button onClick={(e) => { e.stopPropagation(); navigate(`${basePath}/product/${product.id}`); }} className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#232863] text-white rounded-xl text-xs font-black hover:bg-[#1a1f2c] hover:shadow-lg hover:-translate-y-0.5 transition-all active:scale-95">
        <Eye className="w-3.5 h-3.5" /> {t('view_details', 'marketplace')}
      </button>
    );
    if (claim.status === 'PENDING') return <div className="w-full py-2.5 bg-amber-50 text-amber-600 rounded-xl text-xs font-black text-center border border-amber-200/50">{t('pending_approval', 'marketplace')}</div>;
    if (claim.status === 'REJECTED') return <div className="w-full py-2.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-black text-center border border-rose-200/50">{t('request_rejected', 'marketplace')}</div>;
    if (claim.status === 'APPROVED') {
      return (
        <button onClick={(e) => { 
          e.stopPropagation(); 
          setLinksConfig({
            isOpen: true,
            mode: 'manage',
            productId: product.id,
            productName: product.nameFr || product.nameEn
          });
        }} className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#FF6B4A] text-white rounded-xl text-xs font-black hover:bg-[#e55a3a] transition-all hover:shadow-lg hover:shadow-orange-500/20">
          <LinkIcon className="w-3.5 h-3.5" /> {t('manage_links', 'inventory')}
        </button>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#F4F6FB]">
      {/* Cool Premium Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-[2rem] bg-[#232863] p-8 md:p-12 shadow-2xl shadow-slate-900/10 mb-8 border border-white/10"
      >
        {/* Dynamic Abstract Background Elements */}
        <div className="absolute top-0 right-0 w-full h-full pointer-events-none overflow-hidden">
          {/* Main glowing orb */}
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 0.9, 1.1, 1], 
              opacity: [0.3, 0.5, 0.4, 0.6, 0.3],
              x: [0, 40, -30, 20, 0],
              y: [0, -30, 50, -20, 0]
            }} 
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-40 -right-40 w-96 h-96 bg-[#FF6B4A] rounded-full mix-blend-screen blur-[100px] opacity-40" 
          />
          {/* Secondary glowing orb */}
          <motion.div 
            animate={{ 
              scale: [1, 1.3, 1.1, 1.4, 1], 
              opacity: [0.2, 0.4, 0.3, 0.5, 0.2],
              x: [0, -50, 40, -20, 0],
              y: [0, 60, -40, 30, 0]
            }} 
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute bottom-[-10%] right-[20%] w-80 h-80 bg-purple-500 rounded-full mix-blend-screen blur-[100px] opacity-30" 
          />
          {/* Third glowing orb */}
          <motion.div 
            animate={{ 
              scale: [0.9, 1.2, 1.1, 0.9], 
              opacity: [0.1, 0.3, 0.2, 0.1],
              x: [0, 30, -40, 0],
              y: [0, -40, 30, 0]
            }} 
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute top-[20%] left-[-10%] w-72 h-72 bg-blue-500 rounded-full mix-blend-screen blur-[80px] opacity-20" 
          />
          {/* Subtle grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          
          {/* Left Content */}
          <div className={`max-w-xl ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            <motion.div initial={{ opacity: 0, x: language === 'ar' ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 backdrop-blur-md border border-white/10 rounded-full mb-6 shadow-inner">
                <Sparkles className="w-3.5 h-3.5 text-[#FF6B4A]" />
                <span className="text-[10px] font-black text-white/90 uppercase tracking-[0.2em]">{t('hero_tagline', 'marketplace')}</span>
              </div>
            </motion.div>
            
            <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4 leading-tight md:whitespace-nowrap"
            >
              {t('title', 'marketplace')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B4A] to-orange-300">{roleTitle}</span>
            </motion.h1>
            
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="text-slate-300 text-sm md:text-base font-medium leading-relaxed max-w-md"
            >
              {t('hero_desc', 'marketplace')}
            </motion.p>
          </div>

          {/* Right Stats (Glassmorphism Cards) */}
          <div className="flex items-center gap-4">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, type: 'spring' }}
              className="flex flex-col items-center justify-center min-w-[120px] p-5 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.12)] relative overflow-hidden group hover:bg-white/10 transition-colors"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-10 h-10 rounded-xl bg-[#232863]/50 border border-white/10 flex items-center justify-center mb-3 shadow-inner">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-black text-white mb-1">{total}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">{t('hero_stat_products', 'marketplace')}</span>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6, type: 'spring' }}
              className="flex flex-col items-center justify-center min-w-[120px] p-5 rounded-2xl bg-gradient-to-b from-[#FF6B4A]/20 to-[#FF6B4A]/5 backdrop-blur-xl border border-[#FF6B4A]/30 shadow-[0_8px_32px_rgba(255,107,74,0.15)] relative overflow-hidden group hover:from-[#FF6B4A]/30 transition-colors"
            >
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+')] opacity-20" />
              <div className="w-10 h-10 rounded-xl bg-[#FF6B4A]/20 border border-[#FF6B4A]/30 flex items-center justify-center mb-3 shadow-inner relative z-10">
                <Zap className="w-5 h-5 text-[#FF6B4A]" />
              </div>
              <span className="text-2xl font-black text-white mb-1 relative z-10">{claims.length}</span>
              <span className="text-[10px] font-bold text-[#FF6B4A] uppercase tracking-wider relative z-10 text-center">{t('hero_stat_claims', 'marketplace')}</span>
            </motion.div>
          </div>
          
        </div>
      </motion.div>

      {/* Sourcing announcement banner */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.5, delay: 0.3 }}
        className="relative overflow-hidden bg-[#0A0A0A] rounded-[2rem] p-6 border border-white/10 shadow-xl mb-8 group animate-pulse-subtle"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-10 group-hover:opacity-25 transition-opacity duration-700 blur-2xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <div className={`space-y-1.5 max-w-2xl ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            <h3 className="text-sm font-black text-white flex items-center gap-2 justify-start">
              <Sparkles className="text-amber-400 w-4 h-4" />
              {language === 'ar' ? 'منتج مخصص' : language === 'en' ? 'Custom Product' : 'Produit Personnalisé'}
            </h3>
            <p className="text-xs font-medium text-slate-400 leading-relaxed">
              {language === 'ar' 
                ? 'استكشف، اختر وحقق الأرباح. كل منتج هو فرصة. إذا كان لديك منتج مخصص وتريد منا إنتاجه لك، قم بتقديم تفاصيله هنا.' 
                : language === 'en'
                ? 'Explore, select and monetize. Every product is an opportunity. If you have a custom product and you want us to produce it for you, submit its details here.'
                : 'Explorez, sélectionnez et monétisez. Chaque produit est une opportunité. Si vous avez un produit personnalisé et que vous souhaitez que nous le produisions pour vous, soumettez ses détails ici.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCustomModalOpen(true)}
            className="flex-shrink-0 px-6 py-3.5 bg-white text-black hover:bg-slate-100 hover:scale-105 transition-all text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-white/5 active:scale-95 whitespace-nowrap"
          >
            {language === 'ar' ? 'طلب إنتاج' : language === 'en' ? 'Request Production' : 'Demander Production'}
          </button>
        </div>
      </motion.div>

      {/* Main layout */}
      <div className="flex gap-6 items-start">
        {/* Sidebar */}
        <MarketplaceSidebar
          categories={categories} selectedCategories={selectedCategories} setSelectedCategories={setSelectedCategories}
          sortBy={sortBy} setSortBy={setSortBy}
          priceMin={priceMin} setPriceMin={setPriceMin} priceMax={priceMax} setPriceMax={setPriceMax}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          onReset={resetFilters} onPageReset={() => setPage(1)} t={t}
        />
        {/* Mobile sidebar */}
        <MarketplaceSidebar
          categories={categories} selectedCategories={selectedCategories} setSelectedCategories={setSelectedCategories}
          sortBy={sortBy} setSortBy={setSortBy}
          priceMin={priceMin} setPriceMin={setPriceMin} priceMax={priceMax} setPriceMax={setPriceMax}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          onReset={resetFilters} onPageReset={() => setPage(1)} t={t}
          isMobile isOpen={mobileFiltersOpen} onClose={() => setMobileFiltersOpen(false)}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Search bar */}
          <div className="flex gap-3 mb-6">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#FF6B4A] transition-colors" />
              <input type="text" placeholder={t('search_placeholder', 'marketplace')} value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-[#FF6B4A]/10 focus:border-[#FF6B4A]/30 outline-none transition-all shadow-sm"
              />
            </div>
            <button onClick={() => setMobileFiltersOpen(true)} className="lg:hidden px-4 py-3.5 rounded-2xl bg-white border border-slate-100 shadow-sm text-slate-600 hover:text-[#FF6B4A] transition-colors">
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Results count */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-slate-400">{products.length} {t('results_count', 'marketplace')}</p>
          </div>

          {/* Product Grid */}
          <div className="min-h-[800px]">
            {isLoading ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {[...Array(12)].map((_, i) => <div key={i} className="bg-white rounded-2xl h-[380px] animate-pulse border border-slate-100 shadow-sm" />)}
              </motion.div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {products.map((product: any, i: number) => {
                  const status = getClaimStatus(product);
                  return (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.4 }}
                      whileHover={{ y: -4, boxShadow: '0 16px 48px rgba(0,0,0,0.08)' }}
                      onClick={() => navigate(`${basePath}/product/${product.id}`)}
                      className="group bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col cursor-pointer"
                    >
                      <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-slate-50 to-white">
                        {product.images?.[0]?.imageUrl ? (
                          <img src={product.images[0].imageUrl} alt={product.nameFr} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Package className="w-12 h-12 text-slate-200" /></div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        {/* Category badge */}
                        {product.categories?.[0] && (
                          <span className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 backdrop-blur-md rounded-lg text-[9px] font-black tracking-wider text-slate-700 shadow-sm border border-white/50">
                            {language === 'ar' ? product.categories[0].nameAr || product.categories[0].nameFr :
                             language === 'en' ? product.categories[0].nameEn || product.categories[0].nameFr :
                             product.categories[0].nameFr}
                          </span>
                        )}

                        {/* Status dot */}
                        <div className="absolute top-3 right-3">
                          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black backdrop-blur-md shadow-sm border border-white/50 ${
                            status === 'claimed' ? 'bg-blue-500/90 text-white' :
                            status === 'pending' ? 'bg-amber-400/90 text-white' :
                            status === 'rejected' ? 'bg-rose-500/90 text-white' :
                            'bg-[#21c55d]/90 text-white'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
                            {status === 'claimed' ? t('status_claimed', 'marketplace') :
                             status === 'pending' ? t('status_pending', 'marketplace') :
                             status === 'rejected' ? t('request_rejected', 'marketplace') :
                             t('status_available', 'marketplace')}
                          </span>
                        </div>

                        {/* Quick view */}
                        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                          <button onClick={(e) => { e.stopPropagation(); navigate(`${basePath}/product/${product.id}`); }} className="w-9 h-9 flex items-center justify-center bg-white/90 backdrop-blur-md rounded-xl shadow-lg hover:scale-110 transition-all text-slate-600 hover:text-[#FF6B4A] border border-white/50" title={t('view_product_page', 'marketplace')}>
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="p-4 flex-1 flex flex-col">
                        <div className="flex-1">
                          <HoverMarquee 
                            text={product.nameAr ? `${product.nameAr} / ${product.nameFr}` : product.nameFr} 
                            className="text-sm font-black text-[#232863] mb-0.5 leading-tight group-hover:text-[#FF6B4A] transition-colors"
                          />
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">SKU: {product.sku}</p>
                        </div>
                        <div className="mt-auto pt-3 border-t border-slate-50 space-y-2.5">
                          <div className="flex justify-between items-center w-full">
                            <div className="text-[8px] font-black text-[#FF6B4A] uppercase tracking-[0.15em]">
                              {priceLabel}
                            </div>
                            <div className="text-xl font-black text-[#232863] leading-none">
                              {user?.role === 'INFLUENCER' 
                                ? (product.influencerPriceMad || product.retailPriceMad)
                                : user?.mode === 'AFFILIATE'
                                  ? (product.affiliatePriceMad || product.retailPriceMad)
                                  : product.retailPriceMad} <span className="text-[10px] font-bold text-slate-400">{language === 'ar' ? 'درهم' : 'MAD'}</span>
                            </div>
                          </div>
                          {renderClaimAction(product)}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl py-20 px-8 text-center border border-slate-100 shadow-sm">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-5"><Package className="w-8 h-8 text-slate-300" /></div>
                <h3 className="text-xl font-black text-[#232863] mb-2">{t('no_products', 'marketplace')}</h3>
                <p className="text-sm text-slate-500 max-w-sm mx-auto">{t('no_products_desc', 'marketplace')}</p>
              </motion.div>
            )}
          </div>

          {/* Pagination */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8">
            {/* Per-page selector */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('per_page', 'marketplace')}</span>
              <div className="flex gap-1">
                {[10, 20, 50, 100].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => { setLimit(n); setPage(1); }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${
                      limit === n
                        ? 'bg-[#232863] text-white shadow-md'
                        : 'bg-white border border-slate-100 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Page navigation */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => goToPage(Math.max(1, page - 1))} disabled={page === 1} className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-100 rounded-xl text-xs font-black text-slate-600 disabled:opacity-30 hover:bg-[#232863] hover:text-white hover:border-[#232863] transition-all shadow-sm">
                  <ChevronLeft className="w-4 h-4" /> {t('prev', 'marketplace')}
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let p: number;
                    if (totalPages <= 7) p = i + 1;
                    else if (page <= 4) p = i + 1;
                    else if (page >= totalPages - 3) p = totalPages - 6 + i;
                    else p = page - 3 + i;
                    return (
                      <button key={p} type="button" onClick={() => goToPage(p)} className={`w-9 h-9 rounded-xl text-xs font-black transition-all ${page === p ? 'bg-[#FF6B4A] text-white shadow-lg shadow-orange-200' : 'bg-white border border-slate-100 text-slate-500 hover:bg-slate-50'}`}>{p}</button>
                    );
                  })}
                </div>
                <button type="button" onClick={() => goToPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-100 rounded-xl text-xs font-black text-slate-600 disabled:opacity-30 hover:bg-[#232863] hover:text-white hover:border-[#232863] transition-all shadow-sm">
                  {t('next', 'marketplace')} <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      <LinksManagerModal
        config={linksConfig}
        onClose={() => setLinksConfig(null)}
      />

      <AnimatePresence>
        {isCustomModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isUploadingCustomImage && !isSubmittingCustom) {
                  setIsCustomModalOpen(false);
                }
              }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]"
            />
            {/* Modal Wrapper for Centering */}
            <div className="fixed inset-0 flex items-center justify-center z-[80] p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col overflow-hidden pointer-events-auto"
              >
                <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 p-6 text-white flex items-center justify-between flex-shrink-0 z-10" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                  <div>
                    <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                      <Sparkles className="text-amber-400 w-5 h-5 animate-pulse" /> Sourcing Elite
                    </h3>
                    <p className="text-[10px] text-white/70 font-semibold uppercase tracking-wider mt-1">
                      {language === 'ar' ? 'طلب إنتاج مخصص' : language === 'en' ? 'Custom Production Request' : 'Demande de Production Personnalisée'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCustomModalOpen(false)}
                    disabled={isUploadingCustomImage || isSubmittingCustom}
                    className="p-2 hover:bg-white/10 rounded-full transition-all disabled:opacity-50"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCustomSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0 custom-scrollbar" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                {/* Product Name */}
                <div>
                  <label className={`block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {language === 'ar' ? 'اسم المنتج *' : language === 'en' ? 'Product Name *' : 'Nom du produit *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={language === 'ar' ? 'مثال: قميص قطني عضوي مطبوع' : language === 'en' ? 'e.g. Printed organic cotton t-shirt' : 'Ex: T-shirt en coton bio imprimé'}
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    disabled={isSubmittingCustom}
                    className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all disabled:opacity-50 ${language === 'ar' ? 'text-right' : 'text-left'}`}
                  />
                </div>

                {/* Category Name */}
                <div>
                  <label className={`block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {language === 'ar' ? 'فئة المنتج *' : language === 'en' ? 'Product Category *' : 'Catégorie du produit *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={language === 'ar' ? 'مثال: ملابس، إلكترونيات، تجميل...' : language === 'en' ? 'e.g. Clothing, Electronics, Beauty...' : 'Ex: Vêtements, Électronique, Beauté...'}
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    disabled={isSubmittingCustom}
                    className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all disabled:opacity-50 ${language === 'ar' ? 'text-right' : 'text-left'}`}
                  />
                </div>

                {/* Product Source Link */}
                <div>
                  <label className={`block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {language === 'ar' ? 'رابط مصدر المنتج' : language === 'en' ? 'Product source link' : 'Lien source du produit'} <span className="text-slate-400 font-medium">({language === 'ar' ? 'اختياري' : language === 'en' ? 'Optional' : 'Optionnel'})</span>
                  </label>
                  <input
                    type="url"
                    placeholder="Ex: https://alibaba.com/product-detail/..."
                    value={customProductLink}
                    onChange={(e) => setCustomProductLink(e.target.value)}
                    disabled={isSubmittingCustom}
                    className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all disabled:opacity-50 ${language === 'ar' ? 'text-left' : 'text-left'}`}
                  />
                </div>

                {/* Quantity */}
                <div>
                  <label className={`block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {language === 'ar' ? 'الكمية المطلوبة *' : language === 'en' ? 'Desired Quantity *' : 'Quantité souhaitée *'}
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={customQty}
                    onChange={(e) => setCustomQty(Math.max(1, parseInt(e.target.value) || 1))}
                    disabled={isSubmittingCustom}
                    className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all disabled:opacity-50 ${language === 'ar' ? 'text-right' : 'text-left'}`}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className={`block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {language === 'ar' ? 'الوصف والمواصفات *' : language === 'en' ? 'Description & Specifications *' : 'Description & Spécifications *'}
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder={language === 'ar' ? 'صف المواد، الأبعاد، الألوان، التعبئة والتغليف أو أي تعليمات هامة أخرى...' : language === 'en' ? 'Describe the materials, dimensions, colors, packaging, or any other important instructions...' : 'Décrivez les matériaux, dimensions, couleurs, emballage ou toute autre consigne importante...'}
                    value={customDescription}
                    onChange={(e) => setCustomDescription(e.target.value)}
                    disabled={isSubmittingCustom}
                    className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all disabled:opacity-50 resize-none ${language === 'ar' ? 'text-right' : 'text-left'}`}
                  />
                </div>

                {/* Image Upload */}
                <div>
                  <label className={`block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {language === 'ar' ? 'صورة مرجعية / نموذج' : language === 'en' ? 'Reference Image / Mockup' : 'Image de référence / Maquette'}
                  </label>
                  
                  {!customImageUrl ? (
                    <div
                      onClick={() => !isUploadingCustomImage && fileInputRefCustom.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
                        isUploadingCustomImage
                          ? 'border-indigo-400 bg-indigo-50/20'
                          : 'border-slate-200 bg-slate-50/50 hover:border-indigo-300 hover:bg-indigo-50/10'
                      }`}
                    >
                      <input
                        ref={fileInputRefCustom}
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp"
                        className="hidden"
                        onChange={handleCustomFileUpload}
                        disabled={isUploadingCustomImage || isSubmittingCustom}
                      />
                      <div className="flex flex-col items-center gap-2">
                        {isUploadingCustomImage ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs text-indigo-600 font-bold">
                              {language === 'ar' ? `جاري الرفع... ${uploadProgressCustomImage}%` : language === 'en' ? `Uploading... ${uploadProgressCustomImage}%` : `Importation en cours... ${uploadProgressCustomImage}%`}
                            </p>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-slate-400" />
                            <p className="text-xs font-bold text-slate-600">
                              {language === 'ar' ? 'اسحب وأسقط أو انقر للاستيراد' : language === 'en' ? 'Drag and drop or click to upload' : 'Glisser-déposer ou cliquer pour importer'}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium">PNG, JPG, JPEG, WEBP</p>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="relative border border-slate-200 rounded-2xl p-3 bg-slate-50 flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 rounded-xl bg-white border overflow-hidden flex-shrink-0 flex items-center justify-center">
                          <img
                            src={customImageUrl}
                            alt="Custom Product Reference"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 text-left">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {language === 'ar' ? 'الصورة المرجعية' : language === 'en' ? 'Reference Image' : 'Image de référence'}
                          </p>
                          <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
                            {language === 'ar' ? '✓ تم الاستيراد بنجاح' : language === 'en' ? '✓ Successfully Uploaded' : '✓ Importé avec succès'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCustomImageUrl(null)}
                        disabled={isSubmittingCustom}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 flex-shrink-0" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                  <button
                    type="button"
                    onClick={() => setIsCustomModalOpen(false)}
                    disabled={isSubmittingCustom || isUploadingCustomImage}
                    className="px-5 py-2.5 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
                  >
                    {language === 'ar' ? 'إلغاء' : language === 'en' ? 'Cancel' : 'Annuler'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingCustom || isUploadingCustomImage}
                    className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSubmittingCustom ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {language === 'ar' ? 'جاري الإرسال...' : language === 'en' ? 'Submitting...' : 'Soumission...'}
                      </>
                    ) : (
                      language === 'ar' ? 'إرسال الطلب' : language === 'en' ? 'Submit Request' : 'Soumettre la demande'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

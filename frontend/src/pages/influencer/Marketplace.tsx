import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { marketplaceApi, influencerApi, publicApi } from '../../lib/api';
import {
  Search, Package, Link as LinkIcon, Copy, CheckCircle2, Eye,
  ChevronLeft, ChevronRight, Sparkles, TrendingUp, Zap, SlidersHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { buildReferralUrl } from '../../utils/referral';
import MarketplaceSidebar from '../../components/marketplace/MarketplaceSidebar';

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
  const [generatingFor, setGeneratingFor] = useState<number | null>(null);
  const [generatedLink, setGeneratedLink] = useState<{ productId: number; url: string } | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
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
      const claimsData = Array.isArray(claimsRes.data) ? claimsRes.data : (claimsRes.data?.data || []);

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

  const handleGenerateLink = async (productId: number) => {
    try {
      setGeneratingFor(productId);
      const res = await influencerApi.createLink(productId);
      const url = buildReferralUrl(res.data.code, user?.subdomain);
      setGeneratedLink({ productId, url });
      navigator.clipboard.writeText(url);
      toast.success(t('success_link_generated', 'marketplace'));
    } catch (error: any) { toast.error(error.response?.data?.message || t('error_link_generated', 'marketplace')); } finally { setGeneratingFor(null); }
  };

  const copyToClipboard = (url: string) => { navigator.clipboard.writeText(url); toast.success(t('success_copied', 'marketplace')); };

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
      if (generatedLink && generatedLink.productId === product.id) return (
        <div onClick={(e) => e.stopPropagation()} className="p-2.5 bg-emerald-50 border border-emerald-200/50 rounded-xl space-y-2">
          <div className="flex items-center gap-1.5 text-emerald-700 text-[10px] font-black"><CheckCircle2 className="w-3 h-3" /> {t('link_ready', 'marketplace')}</div>
          <div className="flex gap-1.5">
            <input type="text" readOnly value={generatedLink.url} className="w-full text-[10px] py-1.5 px-2 rounded-lg bg-white border border-emerald-200 text-slate-600 focus:outline-none font-mono" />
            <button onClick={(e) => { e.stopPropagation(); copyToClipboard(generatedLink.url); }} className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition-colors flex-shrink-0"><Copy className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      );
      return (
        <button onClick={(e) => { e.stopPropagation(); handleGenerateLink(product.id); }} disabled={generatingFor === product.id} className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#FF6B4A] text-white rounded-xl text-xs font-black hover:bg-[#e55a3a] transition-all disabled:opacity-50 hover:shadow-lg hover:shadow-orange-500/20">
          {generatingFor === product.id ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><LinkIcon className="w-3.5 h-3.5" /> {t('generate_link', 'marketplace')}</>}
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
    </div>
  );
}

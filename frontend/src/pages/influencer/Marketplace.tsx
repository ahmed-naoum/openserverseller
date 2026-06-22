import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { marketplaceApi, influencerApi, publicApi } from '../../lib/api';
import { getVerificationStatus } from '../common/ProfileVerification';
import {
  Search, Package, Link as LinkIcon, Copy, CheckCircle2, Eye,
  ChevronLeft, ChevronRight, SlidersHorizontal, Sparkles,
  Wind, TrendingUp, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';

const windIn = {
  hidden: { opacity: 0, x: 60, rotate: 2 },
  visible: { opacity: 1, x: 0, rotate: 0 },
  exit: { opacity: 0, x: -40, rotate: -1, transition: { duration: 0.3 } }
};
const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } } };
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

export default function InfluencerMarketplace() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [products, setProducts] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [total, setTotal] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [generatingFor, setGeneratingFor] = useState<number | null>(null);
  const [generatedLink, setGeneratedLink] = useState<{ productId: number; url: string } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const limit = 12;
  const totalPages = Math.ceil(total / limit);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchParams(prev => { if (search) prev.set('search', search); else prev.delete('search'); prev.set('page', '1'); return prev; });
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { fetchData(); }, [page, selectedCategory, sortBy, searchParams.get('search')]);

  useEffect(() => {
    publicApi.categories().then(r => setCategories(r.data?.data?.categories || [])).catch(() => {});
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [productsRes, claimsRes] = await Promise.all([
        marketplaceApi.products({ view: 'INFLUENCER', search: searchParams.get('search') || '', page, limit }),
        influencerApi.getClaims()
      ]);
      let items = productsRes.data?.data?.products || [];
      if (selectedCategory) items = items.filter((p: any) => p.categories?.some((c: any) => c.slug === selectedCategory));
      if (sortBy === 'price_asc') items.sort((a: any, b: any) => Number(a.retailPriceMad) - Number(b.retailPriceMad));
      else if (sortBy === 'price_desc') items.sort((a: any, b: any) => Number(b.retailPriceMad) - Number(a.retailPriceMad));
      setProducts(items);
      setTotal(productsRes.data?.data?.total || 0);
      setClaims(Array.isArray(claimsRes.data) ? claimsRes.data : (claimsRes.data?.data || []));
    } catch { toast.error(t('error_load_data', 'marketplace')); } finally { setIsLoading(false); }
  };

  const handleGenerateLink = async (productId: number) => {
    try {
      setGeneratingFor(productId);
      const res = await influencerApi.createLink(productId);
      const url = `${window.location.origin}/r/${res.data.code}`;
      setGeneratedLink({ productId, url });
      navigator.clipboard.writeText(url);
      toast.success(t('success_link_generated', 'marketplace'));
    } catch (error: any) { toast.error(error.response?.data?.message || t('error_link_generated', 'marketplace')); } finally { setGeneratingFor(null); }
  };

  const copyToClipboard = (url: string) => { navigator.clipboard.writeText(url); toast.success(t('success_copied', 'marketplace')); };

  const goToPage = (p: number) => { setPage(p); setSearchParams(prev => { prev.set('page', String(p)); return prev; }); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const colors = ['#7c3aed', '#a78bfa', '#d4a853', '#f59e0b']; // violet, violet-light, gold, amber
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div');
      const size = Math.floor(Math.random() * 4) + 3; // 3px to 6px
      const color = colors[Math.floor(Math.random() * colors.length)];
      p.style.position = 'fixed';
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      p.style.borderRadius = '50%';
      p.style.background = color;
      p.style.pointerEvents = 'none';
      p.style.zIndex = '9999';
      p.style.opacity = '0';
      p.style.left = `${rect.left + Math.random() * rect.width}px`;
      p.style.top = `${rect.top + Math.random() * rect.height}px`;
      document.body.appendChild(p);

      const dx = (Math.random() - 0.5) * 120;
      const dy = -40 - Math.random() * 60;

      p.animate([
        { opacity: 0.8, transform: 'translate(0,0) scale(1)' },
        { opacity: 0,   transform: `translate(${dx}px,${dy}px) scale(0)` }
      ], { duration: 600 + Math.random() * 500, easing: 'ease-out' }).onfinish = () => p.remove();
    }
  };

  const renderClaimAction = (product: any) => {
    const claim = (claims || []).find((c: any) => c.productId === product.id);
    if (!claim) return (
      <button onClick={() => navigate(`/influencer/product/${product.id}`)} className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-influencer-600 to-influencer-500 text-white rounded-2xl text-sm font-black hover:shadow-xl hover:shadow-influencer-500/20 hover:-translate-y-0.5 transition-all active:scale-95">
        <Eye className="w-4 h-4" /> {t('view_details', 'marketplace')}
      </button>
    );
    if (claim.status === 'PENDING') return <div className="w-full py-3 bg-amber-50 text-amber-600 rounded-2xl text-sm font-black text-center border border-amber-200/50 animate-pulse">{t('pending_approval', 'marketplace')}</div>;
    if (claim.status === 'REJECTED') return <div className="w-full py-3 bg-rose-50 text-rose-600 rounded-2xl text-sm font-black text-center border border-rose-200/50">{t('request_rejected', 'marketplace')}</div>;
    if (claim.status === 'APPROVED') {
      if (generatedLink && generatedLink.productId === product.id) return (
        <div className="p-3 bg-influencer-50 border border-influencer-200/50 rounded-2xl space-y-2">
          <div className="flex items-center gap-1.5 text-influencer-700 text-xs font-black"><CheckCircle2 className="w-3.5 h-3.5" /> {t('link_ready', 'marketplace')}</div>
          <div className="flex gap-2">
            <input type="text" readOnly value={generatedLink.url} className="w-full text-xs py-2 px-3 rounded-xl bg-white border border-influencer-200 text-slate-600 focus:outline-none font-mono" />
            <button onClick={() => copyToClipboard(generatedLink.url)} className="p-2 bg-influencer-100 hover:bg-influencer-200 text-influencer-700 rounded-xl transition-colors flex-shrink-0"><Copy className="w-4 h-4" /></button>
          </div>
        </div>
      );
      return (
        <button onClick={() => handleGenerateLink(product.id)} disabled={generatingFor === product.id} className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-2xl text-sm font-black hover:bg-influencer-600 transition-all disabled:opacity-50 hover:shadow-xl hover:shadow-slate-900/10">
          {generatingFor === product.id ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><LinkIcon className="w-4 h-4" /> {t('generate_link', 'marketplace')}</>}
        </button>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Hero */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-influencer-600 via-influencer-500 to-fuchsia-400 p-8 md:p-12 shadow-2xl shadow-influencer-500/20">
        <div className="absolute inset-0 opacity-10">
          {[...Array(5)].map((_, i) => <motion.div key={i} className="absolute rounded-full bg-white" style={{ width: 200 + i * 80, height: 200 + i * 80, top: -50 + i * 30, right: -100 + i * 60 }} animate={{ x: [0, 20, 0], y: [0, -10, 0], scale: [1, 1.05, 1] }} transition={{ duration: 6 + i, repeat: Infinity, ease: 'easeInOut' }} />)}
        </div>
        <motion.div animate={{ x: [0, 15, 0] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} className="absolute top-6 right-8 text-white/20"><Wind className="w-16 h-16" /></motion.div>
        <div className="relative z-10">
          <motion.div variants={fadeUp} className="flex items-center gap-2 mb-4">
            <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> {t('hero_tagline', 'marketplace')}</span>
          </motion.div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">{t('title', 'marketplace')}</h1>
          <p className="text-white/80 text-sm md:text-base max-w-lg font-medium">{t('hero_desc', 'marketplace')}</p>
          <div className="flex items-center gap-4 mt-6">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-xl"><TrendingUp className="w-4 h-4 text-white" /><span className="text-white text-sm font-black">{total} {t('products_count', 'marketplace')}</span></div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-xl"><Zap className="w-4 h-4 text-yellow-300" /><span className="text-white text-sm font-black">{claims.length} Claims</span></div>
          </div>
        </div>
      </motion.div>


      {/* Search + Filters */}
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-influencer-500 transition-colors" />
            <input type="text" placeholder={t('search_placeholder', 'marketplace')} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 placeholder:text-slate-400 focus:ring-4 focus:ring-influencer-500/10 focus:border-influencer-500 outline-none transition-all shadow-lg shadow-slate-100" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`px-5 py-4 rounded-2xl border font-black text-sm flex items-center gap-2 transition-all ${showFilters ? 'bg-influencer-50 border-influencer-200 text-influencer-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'} shadow-lg shadow-slate-100`}>
            <SlidersHorizontal className="w-4 h-4" /> Filtres
          </button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-lg shadow-slate-100 space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Catégories</label>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => { setSelectedCategory(''); setPage(1); }} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${!selectedCategory ? 'bg-influencer-500 text-white shadow-lg shadow-influencer-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{t('filter_all', 'marketplace')}</button>
                    {categories.map((cat: any) => (
                      <button key={cat.id} onClick={() => { setSelectedCategory(cat.slug); setPage(1); }} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${selectedCategory === cat.slug ? 'bg-influencer-500 text-white shadow-lg shadow-influencer-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{cat.nameFr}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Trier par</label>
                  <div className="flex gap-2">
                    {[{ id: 'newest', label: t('sort_newest', 'marketplace') }, { id: 'price_asc', label: t('sort_price_asc', 'marketplace') }, { id: 'price_desc', label: t('sort_price_desc', 'marketplace') }].map(s => (
                      <button key={s.id} onClick={() => setSortBy(s.id)} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${sortBy === s.id ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{s.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Products Grid */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => <div key={i} className="bg-white rounded-[1.5rem] h-[420px] animate-pulse border border-slate-100 shadow-sm" />)}
          </motion.div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product: any, i: number) => (
              <motion.div
                key={product.id}
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={windIn}
                transition={{ delay: i * 0.05, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                whileHover={{
                  y: -6,
                  rotate: 0.5,
                  boxShadow: '0 20px 60px rgba(0,0,0,0.1), 0 0 0 1px rgba(124,58,237,0.1)'
                }}
                onMouseEnter={handleMouseEnter}
                className="group bg-white rounded-[1.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col cursor-pointer"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
                  {product.images?.[0]?.imageUrl ? (
                    <img src={product.images[0].imageUrl} alt={product.nameFr} className="w-full h-full object-cover group-hover:scale-[1.07] group-hover:-rotate-1 transition-transform duration-700 ease-out" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Package className="w-12 h-12 text-slate-200" /></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  {product.categories?.[0] && <span className="absolute top-3 left-3 px-3 py-1.5 bg-white/90 backdrop-blur-md rounded-xl text-[10px] font-black tracking-wider text-slate-700 shadow-sm border border-white/50">{product.categories[0].nameFr}</span>}
                  <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                    <button onClick={() => navigate(`/influencer/product/${product.id}`)} className="w-9 h-9 flex items-center justify-center bg-white/90 backdrop-blur-md rounded-xl shadow-lg hover:scale-110 transition-all text-slate-600 hover:text-influencer-600 border border-white/50" title={t('view_product_page', 'marketplace')}><Eye className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex-1">
                    <h3 className="text-base font-black text-slate-900 mb-1 leading-tight line-clamp-2 group-hover:text-influencer-700 transition-colors">{product.nameFr}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">SKU: {product.sku}</p>
                  </div>
                  <div className="mt-auto pt-4 border-t border-slate-50 space-y-3">
                    <div className="flex justify-between items-end">
                      <div>
                        <div className="text-[9px] font-black text-influencer-400 uppercase tracking-[0.15em]">{t('influencer_price', 'marketplace')}</div>
                        <div className="text-2xl font-black text-slate-900 leading-none">{product.influencerPriceMad || product.retailPriceMad} <span className="text-xs font-bold text-slate-400">MAD</span></div>
                      </div>
                    </div>
                    {renderClaimAction(product)}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-[2rem] py-24 px-8 text-center border-2 border-dashed border-slate-200">
            <div className="w-20 h-20 bg-influencer-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6"><Package className="w-10 h-10 text-influencer-300" /></div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">{t('no_products', 'marketplace')}</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">{t('no_products_desc', 'marketplace')}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center gap-2 pt-4">
          <button onClick={() => goToPage(Math.max(1, page - 1))} disabled={page === 1} className="flex items-center gap-1.5 px-5 py-3 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-600 disabled:opacity-30 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm"><ChevronLeft className="w-4 h-4" /> {t('prev', 'marketplace')}</button>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let p: number;
              if (totalPages <= 7) p = i + 1;
              else if (page <= 4) p = i + 1;
              else if (page >= totalPages - 3) p = totalPages - 6 + i;
              else p = page - 3 + i;
              return (
                <button key={p} onClick={() => goToPage(p)} className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${page === p ? 'bg-influencer-500 text-white shadow-lg shadow-influencer-200' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>{p}</button>
              );
            })}
          </div>
          <button onClick={() => goToPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="flex items-center gap-1.5 px-5 py-3 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-600 disabled:opacity-30 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm">{t('next', 'marketplace')} <ChevronRight className="w-4 h-4" /></button>
        </motion.div>
      )}
    </div>
  );
}

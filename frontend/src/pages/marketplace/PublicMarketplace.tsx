import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { marketplaceApi, publicApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Search, 
  Filter, 
  Grid, 
  List, 
  ChevronRight,
  ChevronLeft,
  ShoppingBag, 
  Sparkles, 
  ArrowRight,
  Package,
  Clock,
  LayoutGrid,
  Menu,
  X,
  Store
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

function ProductCardCarousel({ images, alt }: { images: { imageUrl: string }[]; alt: string }) {
  const [current, setCurrent] = useState(0);
  const [hovered, setHovered] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const count = images.length;

  // Auto-rotate every 4s, pause on hover
  useEffect(() => {
    if (count <= 1) return;
    if (hovered) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setCurrent(prev => (prev + 1) % count);
    }, 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [count, hovered]);

  const goTo = (dir: -1 | 1, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrent(prev => (prev + dir + count) % count);
  };

  if (count === 0) return null;
  if (count === 1) {
    return (
      <img 
        src={images[0].imageUrl} 
        alt={alt} 
        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
      />
    );
  }

  return (
    <div 
      className="relative w-full h-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {images.map((img, i) => (
        <img
          key={i}
          src={img.imageUrl}
          alt={`${alt} ${i + 1}`}
          className="absolute inset-0 w-full h-full object-cover transition-all duration-500"
          style={{
            opacity: i === current ? 1 : 0,
            transform: i === current ? 'scale(1)' : 'scale(1.05)',
          }}
        />
      ))}

      {/* Left/Right arrows */}
      <button
        onClick={(e) => goTo(-1, e)}
        className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm shadow-md flex items-center justify-center text-gray-700 hover:bg-white hover:scale-110 transition-all opacity-0 group-hover:opacity-100 z-10"
      >
        <ChevronLeft size={16} />
      </button>
      <button
        onClick={(e) => goTo(1, e)}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm shadow-md flex items-center justify-center text-gray-700 hover:bg-white hover:scale-110 transition-all opacity-0 group-hover:opacity-100 z-10"
      >
        <ChevronRight size={16} />
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrent(i); }}
            className={`rounded-full transition-all duration-300 ${
              i === current 
                ? 'w-4 h-1.5 bg-white shadow-sm' 
                : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default function PublicMarketplace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();

  // Determine the default view based on user role/mode
  const getDefaultView = (): 'REGULAR' | 'AFFILIATE' | 'INFLUENCER' => {
    if (!isAuthenticated || !user) return 'REGULAR'; // Public default
    const role = user.role || user.roleName || '';
    if (role === 'SUPER_ADMIN' || role === 'FINANCE_ADMIN') return 'REGULAR'; // Admin sees all, default to REGULAR
    if (role === 'INFLUENCER') return 'INFLUENCER';
    if (role === 'VENDOR') return user.mode === 'AFFILIATE' ? 'AFFILIATE' : 'REGULAR';
    if (role === 'GROSSELLER') return 'REGULAR';
    return 'REGULAR';
  };

  // Can the user toggle between views?
  const canToggle = (): boolean => {
    if (!isAuthenticated || !user) return true; // Public can toggle
    const role = user.role || user.roleName || '';
    if (role === 'SUPER_ADMIN' || role === 'FINANCE_ADMIN') return true; // Admin can toggle
    return false; // Everyone else is locked
  };

  const [viewMode, setViewMode] = useState<'REGULAR' | 'AFFILIATE' | 'INFLUENCER'>(
    (searchParams.get('view') as any) || getDefaultView()
  );
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Sync view mode when user mode changes (e.g. mode switch)
  useEffect(() => {
    if (isAuthenticated && user) {
      const newDefault = getDefaultView();
      if (!canToggle()) {
        setViewMode(newDefault);
      }
    }
  }, [user?.mode, user?.role]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchParams(prev => {
        if (search) prev.set('search', search);
        else prev.delete('search');
        prev.set('page', '1');
        return prev;
      });
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [viewMode, selectedCategory, searchParams.get('search'), page]);

  const fetchCategories = async () => {
    try {
      const res = await publicApi.categories();
      setCategories(res.data.data.categories);
    } catch (error) {
      console.error('Failed to load categories');
    }
  };

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const res = await marketplaceApi.products({
        view: viewMode,
        category: selectedCategory,
        search: searchParams.get('search') || '',
        page,
        limit: 12
      });
      setProducts(res.data.data.products);
      setTotal(res.data.data.total);
    } catch (error) {
      toast.error('Impossible de charger les produits');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategorySelect = (slug: string) => {
    const newCategory = selectedCategory === slug ? '' : slug;
    setSelectedCategory(newCategory);
    setSearchParams(prev => {
      if (newCategory) prev.set('category', newCategory);
      else prev.delete('category');
      prev.set('page', '1');
      return prev;
    });
    setPage(1);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const handleViewChange = (newView: 'REGULAR' | 'AFFILIATE' | 'INFLUENCER') => {
    setViewMode(newView);
    setSearchParams(prev => {
      prev.set('view', newView);
      prev.set('page', '1');
      return prev;
    });
    setPage(1);
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#F9FAFB] selection:bg-primary-100 animate-in fade-in slide-in-from-bottom-2 duration-1000 ease-out">
      
      {/* Ultimate Marketplace Hero Header */}
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 pt-8">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#1a1c4b] via-[#2c2f74] to-[#4b3e8c] p-8 lg:p-10 text-white shadow-[0_20px_60px_-15px_rgba(44,47,116,0.6)] border border-white/10">
          <div className="relative z-20 flex flex-col lg:flex-row lg:items-center justify-between gap-12">
            <div className="max-w-2xl">
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/5 backdrop-blur-xl text-white border border-white/20 text-[9px] font-black uppercase tracking-widest mb-4 shadow-2xl"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Sourcing Premium Actif
              </motion.div>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tighter mb-4 leading-[1.1]">
                Marketplace <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Elite</span>
              </h1>
              <p className="text-primary-100/80 font-medium text-base sm:text-lg leading-relaxed max-w-xl">
                L'écosystème de produits le plus exclusif. Sourcez, affiliez, et scalez avec des marges garanties.
              </p>
            </div>
            
            {/* Premium App-like View Toggle */}
            {canToggle() && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 20 }}
              className="flex items-center p-2.5 bg-black/20 backdrop-blur-2xl rounded-[2rem] w-fit mx-auto lg:mx-0 shadow-inner border border-white/10"
            >
              <button
                onClick={() => handleViewChange('REGULAR')}
                className={`flex items-center gap-3 px-8 py-5 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all duration-500 ease-out ${
                  viewMode === 'REGULAR' 
                    ? 'bg-white text-[#1a1c4b] shadow-[0_10px_40px_-10px_rgba(255,255,255,0.5)] scale-105 transform' 
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                <Store className="w-5 h-5 flex-shrink-0" /> <span className="hidden sm:block">Vendeurs</span>
              </button>
              <button
                onClick={() => handleViewChange('AFFILIATE')}
                className={`flex items-center gap-3 px-8 py-5 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all duration-500 ease-out ${
                  viewMode === 'AFFILIATE' 
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-[0_10px_40px_-10px_rgba(244,63,94,0.5)] scale-105 transform' 
                    : 'text-white/60 hover:text-pink-300 hover:bg-white/10'
                }`}
              >
                <Megaphone className="w-5 h-5 flex-shrink-0" /> <span className="hidden sm:block">Affiliés</span>
              </button>
              <button
                onClick={() => handleViewChange('INFLUENCER')}
                className={`flex items-center gap-3 px-8 py-5 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all duration-500 ease-out ${
                  viewMode === 'INFLUENCER' 
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-[0_10px_40px_-10px_rgba(139,92,246,0.5)] scale-105 transform' 
                    : 'text-white/60 hover:text-purple-300 hover:bg-white/10'
                }`}
              >
                <Sparkles className="w-5 h-5 flex-shrink-0" /> <span className="hidden sm:block">Influenceurs</span>
              </button>
            </motion.div>
            )}
          </div>
          
          {/* Deep Cinematic Background Elements */}
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/20 via-purple-500/5 to-transparent rounded-full blur-3xl -mr-[400px] -mt-[400px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-pink-500/10 via-rose-500/5 to-transparent rounded-full blur-3xl -ml-[300px] -mb-[300px] pointer-events-none" />
          
          {/* Subtle Grid Pattern Overlay */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none"></div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-12">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 relative">
          
          {/* Mobile Sidebar Toggle */}
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden flex items-center justify-center gap-2 w-full bento-card py-4 text-xs font-black uppercase tracking-widest text-slate-600 shadow-sm"
          >
            <Filter className="w-4 h-4" /> Filtrer le Catalogue
          </button>

          <aside className="hidden lg:block w-72 flex-shrink-0">
            <div className="sticky top-28 bento-card border border-white/60 bg-white/70 backdrop-blur-2xl p-8 space-y-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] rounded-[2.5rem]">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                 <LayoutGrid size={14} /> Rayons Privés
               </h3>
               <nav className="flex flex-col gap-3">
                 <button
                   onClick={() => handleCategorySelect('')}
                   className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                     selectedCategory === '' 
                       ? 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white shadow-xl shadow-primary-500/30 scale-105' 
                       : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 hover:scale-[1.02] border border-slate-100 shadow-sm'
                   }`}
                 >
                   <span>Global</span>
                   <ChevronRight className={`w-3 h-3 transition-transform duration-300 ${selectedCategory === '' ? 'rotate-90 text-white/70' : ''}`} />
                 </button>
                 {categories.map((cat) => (
                   <button
                     key={cat.id}
                     onClick={() => handleCategorySelect(cat.slug)}
                     className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all duration-300 group ${
                       selectedCategory === cat.slug
                         ? 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white shadow-xl shadow-primary-500/30 scale-105' 
                         : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 hover:scale-[1.02] border border-slate-100 shadow-sm'
                     }`}
                   >
                     <span className="truncate">{cat.nameFr}</span>
                     <div className="flex items-center gap-2">
                       <span className={`text-[9px] px-2 py-1 rounded-lg border transition-colors ${
                         selectedCategory === cat.slug 
                           ? 'bg-white/20 border-white/20 text-white backdrop-blur-md' 
                           : 'bg-slate-50 border-slate-200 text-slate-400 group-hover:bg-primary-50 group-hover:text-primary-600 group-hover:border-primary-100'
                       }`}>
                         {cat._count.products}
                       </span>
                     </div>
                   </button>
                 ))}
               </nav>

               <div className="mt-8 pt-8 border-t border-slate-200">
                  <div className="relative overflow-hidden bg-[#0A0A0A] rounded-3xl p-6 border border-white/10 shadow-2xl group">
                     {/* Animated Gradient Border Effect internally represented by absolute divs */}
                     <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-20 group-hover:opacity-40 transition-opacity duration-500 blur-xl"></div>
                     <div className="relative z-10">
                       <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><Sparkles size={12} className="text-amber-400"/> Conciergerie</p>
                       <p className="text-sm font-black text-white leading-snug tracking-tight mb-5">
                         Vous cherchez la perle rare hors catalogue ?
                       </p>
                       <button className="w-full bg-white text-black py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 hover:scale-105 transition-all shadow-xl shadow-white/10">Sourcing Elite</button>
                     </div>
                  </div>
               </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {/* Elite Search Bar */}
            <div className="relative mb-12 group/search">
              <div className="absolute inset-y-0 left-0 pl-8 flex items-center pointer-events-none">
                <Search className="h-6 w-6 text-slate-300 group-focus-within/search:text-primary-500 transition-colors duration-300" />
              </div>
              <input
                type="text"
                placeholder="Rechercher l'article parfait..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="block w-full pl-20 pr-8 py-6 bg-white/70 backdrop-blur-3xl border border-white/60 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] focus:shadow-[0_20px_60px_-15px_rgba(var(--color-primary-500),0.2)] focus:bg-white rounded-[2.5rem] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 transition-all text-xl font-black tracking-tight"
              />
              {/* Optional: Command K visual prompt */}
              <div className="absolute inset-y-0 right-0 pr-8 flex items-center pointer-events-none">
                 <div className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-200 text-xs font-black text-slate-400 tracking-widest uppercase shadow-inner">
                   Ctrl K
                 </div>
              </div>
            </div>

            {/* Grid */}
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-8"
                >
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-white rounded-3xl h-[400px] animate-pulse border border-gray-100 shadow-sm" />
                  ))}
                </motion.div>
              ) : products.length > 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-8"
                >
                  {products.map((product, i) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.95, y: 30 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: i * 0.05, type: 'spring', damping: 25, stiffness: 200 }}
                      key={product.id}
                      className="bento-card p-0 flex flex-col group/item border border-white/60 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_30px_60px_-20px_rgba(var(--color-primary-500),0.2)] bg-white/70 backdrop-blur-xl relative"
                    >
                        <Link 
                          to={`../product/${product.id}`}
                          className="block aspect-square relative overflow-hidden bg-slate-100 rounded-t-[2.5rem]"
                        >
                        {product.images?.length > 0 ? (
                           <div className="w-full h-full transform transition-transform duration-700 ease-out group-hover/item:scale-110">
                             <ProductCardCarousel images={product.images} alt={product.nameFr} />
                           </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-200 transform transition-transform duration-700 ease-out group-hover/item:scale-110">
                             <Package className="w-16 h-16 opacity-50" />
                          </div>
                        )}
                        
                        {/* Dramatic Lighting Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-black/10 opacity-0 group-hover/item:opacity-100 transition-opacity duration-500 pointer-events-none" />

                        <div className="absolute top-5 left-5 right-5 flex items-start justify-between z-10">
                           <span className="px-4 py-2 bg-white/90 backdrop-blur-2xl rounded-2xl border border-white/50 text-[9px] font-black uppercase tracking-widest text-slate-800 shadow-xl shadow-black/5 transform transition-transform group-hover/item:-translate-y-1">
                             {product.category?.nameFr}
                           </span>

                           {/* Status Indicators */}
                           <div className="flex flex-col gap-2 items-end">
                             {product.userStatus?.isBought && (
                                <span className="px-3 py-1.5 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.4)] border border-emerald-400">
                                  En stock
                                </span>
                              )}
                              {product.userStatus?.isClaimed && (
                                <span className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(139,92,246,0.4)] border border-purple-400">
                                  Partenaire
                                </span>
                              )}
                             {product.userStatus?.isPending && (
                               <span className="px-3 py-1.5 bg-amber-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(245,158,11,0.4)] border border-amber-400 animate-pulse">
                                  Examen
                               </span>
                             )}
                           </div>
                        </div>

                        {/* Floating Action Button */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 scale-50 group-hover/item:scale-100 transition-all duration-500 ease-out z-20">
                          <div className="w-16 h-16 bg-white/95 backdrop-blur-3xl rounded-full flex items-center justify-center text-primary-600 shadow-2xl shadow-black/20 border border-white/50">
                            <ArrowRight strokeWidth={3} className="w-6 h-6 -rotate-45" />
                          </div>
                        </div>
                      </Link>
                      
                      <div className="p-8 flex-1 flex flex-col bg-white rounded-b-[2.5rem] z-10 transform transition-transform duration-500 group-hover/item:-translate-y-2">
                        <div className="flex-1 text-center">
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-3 flex items-center justify-center gap-1.5 opacity-70">
                            <Package size={12} /> {product.sku}
                          </p>
                          <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none group-hover/item:text-primary-600 transition-colors mb-2">
                            <Link to={`../product/${product.id}`}>{product.nameFr}</Link>
                          </h3>
                        </div>
                        
                        <div className="mt-8">
                           <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100 group-hover/item:bg-white group-hover/item:border-primary-100 transition-colors">
                             {viewMode === 'AFFILIATE' && (
                               <>
                                 <div className="text-center flex-1 border-r border-slate-200/60">
                                   <div className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1.5">Impact / Com.</div>
                                   <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500 tracking-tight leading-none">
                                     {product.commissionMad > 0 ? product.commissionMad : Math.round((product.retailPriceMad || 0) * 0.1 * 100) / 100} <span className="text-[10px] uppercase font-black text-indigo-400/50">MAD</span>
                                   </div>
                                 </div>
                                 <div className="text-center flex-1">
                                   <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Valeur Retail</div>
                                   <div className="text-lg font-black text-slate-800 tracking-tight leading-none">
                                     {product.affiliatePriceMad || product.retailPriceMad} <span className="text-[9px] uppercase font-black text-slate-400">MAD</span>
                                   </div>
                                 </div>
                               </>
                             )}

                             {viewMode === 'INFLUENCER' && (
                               <>
                                 <div className="text-center flex-1 border-r border-slate-200/60">
                                   <div className="text-[9px] font-black text-purple-500 uppercase tracking-widest mb-1.5">Rémunération</div>
                                   <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500 tracking-tight leading-none">
                                     {Math.round((product.influencerPriceMad || product.retailPriceMad || 0) * 0.15 * 100) / 100} <span className="text-[10px] uppercase font-black text-purple-400/50">MAD</span>
                                   </div>
                                 </div>
                                 <div className="text-center flex-1">
                                   <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Valeur Retail</div>
                                   <div className="text-lg font-black text-slate-800 tracking-tight leading-none">
                                     {product.influencerPriceMad || product.retailPriceMad} <span className="text-[9px] uppercase font-black text-slate-400">MAD</span>
                                   </div>
                                 </div>
                               </>
                             )}

                             {viewMode === 'REGULAR' && (
                               <div className="text-center w-full">
                                 <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5">Valeur Marché</div>
                                 <div className="text-3xl font-black text-slate-900 tracking-tight leading-none">
                                   {product.retailPriceMad} <span className="text-[10px] uppercase font-black text-slate-400">MAD</span>
                                 </div>
                               </div>
                             )}
                           </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-[3rem] py-24 px-8 text-center border-2 border-dashed border-gray-200"
                >
                  <div className="w-20 h-20 bg-slate-50 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6">
                    <ShoppingBag className="w-10 h-10 text-slate-300" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Aucun produit trouvé</h3>
                  <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">Nous n'avons trouvé aucun produit correspondant à vos filtres actuels. Essayez de réinitialiser la recherche.</p>
                  <button 
                    onClick={() => {
                      setSearch('');
                      setSelectedCategory('');
                    }}
                    className="mt-8 text-xs font-black uppercase tracking-widest text-primary-600 hover:text-primary-700 transition-colors"
                  >
                    Réinitialiser les filtres
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Pagination (Simplified UX) */}
            {total > products.length && (
               <div className="mt-12 flex justify-center">
                  <button 
                    disabled={isLoading}
                    onClick={() => setPage(p => p + 1)}
                    className="group flex items-center gap-3 bg-white border border-gray-200 px-8 py-4 rounded-2xl font-bold text-gray-700 hover:shadow-xl hover:shadow-primary-500/5 hover:border-primary-200 transition-all disabled:opacity-50"
                  >
                    <Package className="w-5 h-5 text-primary-500" />
                    Charger plus de produits
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
               </div>
            )}
          </main>
        </div>
      </div>

      {/* Mobile Category Sidebar (Slide-in Overlay) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[60]" 
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed inset-y-0 right-0 w-80 bg-white z-[70] p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-black text-xl text-gray-900">Catégories</h3>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <nav className="space-y-2">
                 <button
                   onClick={() => handleCategorySelect('')}
                   className={`w-full text-left px-5 py-4 rounded-2xl text-lg font-bold transition-all ${
                     selectedCategory === '' ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-600'
                   }`}
                 >Toutes les catégories</button>
                 {categories.map((cat) => (
                   <button
                     key={cat.id}
                     onClick={() => handleCategorySelect(cat.slug)}
                     className={`w-full text-left px-5 py-4 rounded-2xl text-lg font-bold transition-all ${
                       selectedCategory === cat.slug ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-600'
                     }`}
                   >{cat.nameFr}</button>
                 ))}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}

// Added icons used in view switcher
const Megaphone = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
  </svg>
);

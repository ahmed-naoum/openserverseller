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
  const getDefaultView = (): 'REGULAR' | 'AFFILIATE' => {
    if (!isAuthenticated || !user) return 'REGULAR'; // Public default
    const role = user.role || user.roleName || '';
    if (role === 'SUPER_ADMIN' || role === 'FINANCE_ADMIN') return 'REGULAR'; // Admin sees all, default to REGULAR
    if (role === 'INFLUENCER') return 'AFFILIATE';
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

  const [viewMode, setViewMode] = useState<'REGULAR' | 'AFFILIATE'>(
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

  const handleViewChange = (newView: 'REGULAR' | 'AFFILIATE') => {
    setViewMode(newView);
    setSearchParams(prev => {
      prev.set('view', newView);
      prev.set('page', '1');
      return prev;
    });
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] selection:bg-primary-100">
      
      {/* Marketplace Hero Header */}
      <div className="bg-white border-b border-gray-200 overflow-hidden relative">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-primary-50 rounded-full blur-3xl opacity-60"></div>
        <div className="max-w-7xl mx-auto  relative z-10 text-center lg:text-left">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="max-w-2xl">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-sm font-semibold mb-4 border border-primary-100"
              >
                <Sparkles className="w-4 h-4" />
                Catalogue Public SILACOD
              </motion.div>
              <motion.h1 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight mb-4"
              >
                Marketplace <span className="text-primary-600">B2B</span>
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-lg text-gray-600 max-w-xl"
              >
              </motion.p>
            </div>
            
            {/* Simple View Toggle - only shown if user can toggle */}
            {canToggle() && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="flex items-center p-1.5 bg-gray-100 rounded-2xl border border-gray-200 w-fit mx-auto lg:mx-0 shadow-inner"
            >
              <button
                onClick={() => handleViewChange('REGULAR')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                  viewMode === 'REGULAR' 
                    ? 'bg-white text-primary-700 shadow-md ring-1 ring-gray-200' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Store className="w-4 h-4" /> Vendeurs (B2B)
              </button>
              <button
                onClick={() => handleViewChange('AFFILIATE')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                  viewMode === 'AFFILIATE' 
                    ? 'bg-white text-pink-600 shadow-md ring-1 ring-gray-200' 
                    : 'text-gray-500 hover:text-pink-600'
                }`}
              >
                <Megaphone className="w-4 h-4" /> Influenceurs
              </button>
            </motion.div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Mobile Sidebar Toggle */}
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden flex items-center justify-center gap-2 w-full bg-white border border-gray-200 py-4 rounded-xl font-bold text-gray-700 shadow-sm"
          >
            <Filter opacity-60 className="w-5 h-5" /> Filtrer par Catégorie
          </button>

          {/* Sidebar (Desktop) */}
          <aside className="hidden lg:block w-72 flex-shrink-0">
            <div className="sticky top-28 bg-white rounded-3xl border border-gray-200 p-6 shadow-sm overflow-hidden">
               <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
                 <LayoutGrid className="w-4 h-4" /> Catégories
               </h3>
               <nav className="space-y-1">
                 <button
                   onClick={() => handleCategorySelect('')}
                   className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                     selectedCategory === '' 
                       ? 'bg-primary-50 text-primary-700' 
                       : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                   }`}
                 >
                   <span>Toutes les catégories</span>
                   <ChevronRight className={`w-4 h-4 transition-transform ${selectedCategory === '' ? 'rotate-90' : ''}`} />
                 </button>
                 {categories.map((cat) => (
                   <button
                     key={cat.id}
                     onClick={() => handleCategorySelect(cat.slug)}
                     className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                       selectedCategory === cat.slug
                         ? 'bg-primary-50 text-primary-700' 
                         : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                     }`}
                   >
                     <span className="truncate">{cat.nameFr}</span>
                     <div className="flex items-center gap-2">
                       <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-black ${selectedCategory === cat.slug ? 'bg-primary-200' : 'bg-gray-100 text-gray-400'}`}>
                         {cat._count.products}
                       </span>
                       <ChevronRight className={`w-4 h-4 transition-transform ${selectedCategory === cat.slug ? 'rotate-90' : ''}`} />
                     </div>
                   </button>
                 ))}
               </nav>

               <div className="mt-8 pt-6 border-t border-gray-100">
                  <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white text-center">
                     <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">Besoin d'aide?</p>
                     <p className="text-sm mb-4">Contactez notre service client pour un devis sur mesure.</p>
                     <button className="w-full bg-white text-indigo-600 py-2.5 rounded-xl text-sm font-bold hover:bg-opacity-90 transition-all">Support WhatsApp</button>
                  </div>
               </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {/* Search Bar */}
            <div className="relative mb-8 group">
              <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Rechercher par nom de produit, SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="block w-full pl-14 pr-6 py-4.5 bg-white border-2 border-transparent shadow-sm rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0 focus:border-primary-500 group-focus-within:shadow-xl group-focus-within:shadow-primary-500/5 transition-all text-lg font-medium"
              />
            </div>

            {/* Grid */}
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6"
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
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6"
                >
                  {products.map((product, i) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      key={product.id}
                      className="group bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-2xl hover:shadow-primary-500/10 hover:-translate-y-2 transition-all duration-500 overflow-hidden flex flex-col"
                    >
                        <Link 
                          to={`../product/${product.id}`}
                          className="block aspect-square relative group overflow-hidden bg-gray-50"
                        >
                        {product.images?.length > 0 ? (
                          <ProductCardCarousel images={product.images} alt={product.nameFr} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                             <Package className="w-12 h-12" />
                          </div>
                        )}
                        <div className="absolute top-4 left-4 flex flex-col gap-2">
                           <span className="px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-[10px] font-black uppercase tracking-widest text-gray-900 shadow-sm w-fit">
                             {product.category?.nameFr}
                           </span>
                           {product.userStatus?.isBought && (
                              <span className="px-3 py-1 bg-green-500/90 backdrop-blur-sm rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-sm w-fit">
                                Déjà acheté
                              </span>
                            )}
                            {product.userStatus?.isClaimed && (
                              <span className="px-3 py-1 bg-purple-500/90 backdrop-blur-sm rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-sm w-fit">
                                Déjà claimé
                              </span>
                            )}
                           {product.userStatus?.isPending && (
                             <span className="px-3 py-1 bg-amber-500/90 backdrop-blur-sm rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-sm w-fit">
                               En attente
                             </span>
                           )}
                        </div>
                      </Link>
                      
                      <div className="p-6 flex-1 flex flex-col">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-gray-900 mb-1 leading-tight line-clamp-2 hover:text-primary-600 transition-colors">
                            <Link to={`../product/${product.id}`}>{product.nameFr}</Link>
                          </h3>
                          <p className="text-sm text-gray-400 font-medium mb-4">SKU: {product.sku}</p>
                        </div>
                        
                        <div className="mt-auto border-t border-gray-50 pt-4 flex items-center justify-between">
                           <div>
                             <div className="text-[10px] font-bold text-gray-400 uppercase">Prix Public</div>
                             <div className="text-2xl font-black text-gray-900 leading-none">{product.retailPriceMad} <span className="text-sm font-bold">MAD</span></div>
                           </div>
                           
                           {(product.userStatus?.isBought || product.userStatus?.isClaimed) ? (
                             <Link to="../inventory" className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-xl font-bold text-xs hover:bg-green-600 hover:text-white transition-all">
                               <Package className="w-4 h-4" />
                               Inventaire
                             </Link>
                           ) : product.userStatus?.isPending ? (
                             <div className="px-4 py-2 bg-amber-100 text-amber-700 rounded-xl font-bold text-xs">
                               En attente
                             </div>
                           ) : (
                             <Link to={`../product/${product.id}`} className="w-12 h-12 bg-primary-100 text-primary-600 rounded-2xl flex items-center justify-center group-hover:bg-primary-600 group-hover:text-white transition-all duration-300">
                                <ArrowRight className="w-6 h-6" />
                             </Link>
                           )}
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
                  <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <ShoppingBag className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Aucun produit trouvé</h3>
                  <p className="text-gray-500 max-w-sm mx-auto">Nous n'avons trouvé aucun produit correspondant à vos filtres actuels. Essayez de réinitialiser la recherche.</p>
                  <button 
                    onClick={() => {
                      setSearch('');
                      setSelectedCategory('');
                    }}
                    className="mt-8 text-primary-600 font-bold hover:underline"
                  >
                    Réinitialiser tous les filtres
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

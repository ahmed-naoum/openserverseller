import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useScroll } from 'framer-motion';
import {
  ShoppingBag, Truck, Palette, TrendingUp, Sparkles, ArrowRight,
  Camera, Package, Star, Users, Banknote,
  Crown, Zap, Shield, Globe, ChevronDown, Play, Menu, X,
  Instagram, Youtube, BarChart3, Wallet, Gift, Award, Heart,
  MousePointerClick, Lock, Phone, Box, Check, RefreshCw, CheckCircle2
} from 'lucide-react';
import LiveTicker from '../components/home/LiveTicker';
import ProfitSimulator from '../components/home/ProfitSimulator';
import SuccessStories from '../components/home/SuccessStories';
import FAQ from '../components/home/FAQ';

/* ─── Animated Counter ─── */
function Counter({ to, suffix = '', duration = 2000 }: { to: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const steps = 60;
        const step = duration / steps;
        let i = 0;
        const timer = setInterval(() => {
          i++;
          setCount(Math.floor((to / steps) * i));
          if (i >= steps) { clearInterval(timer); setCount(to); }
        }, step);
      }
    }, { threshold: 0.2 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [to, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeRole, setActiveRole] = useState<'vendor' | 'influencer' | 'affiliate'>('vendor');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [customLogoSelected, setCustomLogoSelected] = useState(false);
  const [uploadedLogo, setUploadedLogo] = useState<string | null>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setUploadedLogo(event.target.result as string);
          setCustomLogoSelected(true);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  // Live platform data states
  const [liveUsers, setLiveUsers] = useState(2481);
  const [liveLog, setLiveLog] = useState<Array<{ id: number; text: string; time: string; city: string }>>([
    { id: 1, text: "📦 Commande de 'Sérum Peeling AHA' expédiée !", time: "À l'instant", city: "Casablanca" },
    { id: 2, text: "📞 Commande de 'Salma B.' confirmée par le Call Center !", time: "Il y a 1 min", city: "Rabat" },
    { id: 3, text: "💰 Commission créditée sur le Wallet (+150 MAD) !", time: "Il y a 2 min", city: "Marrakech" },
  ]);

  const { scrollYProgress } = useScroll();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);

    // Dynamic active users fluctuation
    const usersInterval = setInterval(() => {
      setLiveUsers(prev => prev + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 4 + 1));
    }, 4000);

    // Dynamic live dispatches feed
    const dispatchInterval = setInterval(() => {
      const cities = ["Casablanca", "Rabat", "Marrakech", "Tanger", "Fès", "Agadir", "Oujda"];
      const buyers = ["Ayoub M.", "Yasmine T.", "Karim B.", "Salma L.", "Nadia R."];
      const products = ["Huile d'Argan Gold", "Masque Volcanique Atlas", "Élixir Botanique Rose", "Sérum Glow & Co"];
      const operations = [
        `📦 Commande de '${products[Math.floor(Math.random() * products.length)]}' expédiée !`,
        `📞 Commande de '${buyers[Math.floor(Math.random() * buyers.length)]}' confirmée par le Call Center !`,
        `💰 Commission créditée sur le Wallet (+${Math.floor(Math.random() * 3 + 1) * 120} MAD) !`
      ];

      const newLog = {
        id: Date.now(),
        text: operations[Math.floor(Math.random() * operations.length)],
        time: "À l'instant",
        city: cities[Math.floor(Math.random() * cities.length)]
      };

      setLiveLog(prev => [newLog, ...prev.slice(0, 2)]);
    }, 5000);

    return () => {
      window.removeEventListener('scroll', onScroll);
      clearInterval(usersInterval);
      clearInterval(dispatchInterval);
    };
  }, []);

  const steps = [
    { n: '01', icon: <ShoppingBag className="w-6 h-6" />, title: 'Sélectionnez', desc: 'Parcourez notre catalogue et sélectionnez votre produit cosmétique de luxe vierge.' },
    { n: '02', icon: <Palette className="w-6 h-6" />, title: 'Brandisez', desc: 'Uploadez votre logo. Notre équipe conçoit vos étiquettes et emballages personnalisés sous 48h.' },
    { n: '03', icon: <TrendingUp className="w-6 h-6" />, title: 'Vendez', desc: 'Faites la promotion de vos liens d\'affiliation ou vendez en direct sur vos pages de publicité.' },
    { n: '04', icon: <Phone className="w-6 h-6" />, title: 'Confirmation', desc: 'Notre Call Center dédié contacte chaque client en moins de 30 min pour confirmer l\'achat.' },
    { n: '05', icon: <Truck className="w-6 h-6" />, title: 'Livraison COD', desc: 'Expédition express en Cash On Delivery dans tout le Maroc. Nous gérons l\'encaissement.' },
    { n: '06', icon: <Wallet className="w-6 h-6" />, title: 'Encaissez', desc: 'Chaque commande livrée crédite instantanément votre Wallet. Retirez vos gains à tout moment.' },
  ];

  const moroccoCities = [
    { name: "Casablanca", x: "42%", y: "30%", success: "94%", count: "4,820", pulseDelay: "0s" },
    { name: "Rabat", x: "45%", y: "24%", success: "96%", count: "3,120", pulseDelay: "0.5s" },
    { name: "Marrakech", x: "32%", y: "52%", success: "92%", count: "2,980", pulseDelay: "1s" },
    { name: "Tanger", x: "48%", y: "10%", success: "95%", count: "1,850", pulseDelay: "1.5s" },
    { name: "Fès", x: "55%", y: "32%", success: "93%", count: "2,150", pulseDelay: "2s" },
    { name: "Agadir", x: "22%", y: "68%", success: "91%", count: "1,450", pulseDelay: "2.5s" }
  ];

  // AI-Generated Real Life Cosmetic Showcase Images (Copied & Verified)
  const cosmeticShowcase = [
    { name: "Huile d'Argan Impériale", type: "Sérum Glow Premium", rating: 5.0, price: "249 MAD", profit: "150 MAD", image: "/images/moroccan_argan_gold.png", tag: "Meilleure Vente 👑" },
    { name: "Masque Volcanique Atlas", type: "Soin Détox Élite", rating: 4.9, price: "199 MAD", profit: "115 MAD", image: "/images/cosmetic_face_cream.png", tag: "Tendance 🔥" },
    { name: "Élixir Botanique Rose", type: "Brume Hydratante VIP", rating: 5.0, price: "189 MAD", profit: "110 MAD", image: "/images/cosmetic_serum_gold.png", tag: "Nouveau ✨" }
  ];

  // Auto slide effect
  useEffect(() => {
    const sliderTimer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % cosmeticShowcase.length);
    }, 7000);
    return () => clearInterval(sliderTimer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50/50 selection:bg-primary-100 font-['Inter',_sans-serif] overflow-x-hidden relative">

      {/* ── Progress Bar ── */}
      <motion.div className="fixed top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary-500 to-accent-500 z-[100] origin-left" style={{ scaleX: scrollYProgress }} />

      {/* ── Navbar ── */}
      <motion.nav
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-xl shadow-lg shadow-gray-100/50 border-b border-gray-100' : 'bg-transparent'}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <Link to="/" className="flex items-center gap-3 group">
              <motion.img whileHover={{ rotateY: 15, scale: 1.05 }} src="/new logo/logo filess-25.svg" alt="SILACOD" className="w-11 h-11 origin-center object-contain" />
              <img src="/new logo/logo filess-24.svg" alt="SILACOD" className="h-9 hidden sm:block object-contain" />
            </Link>

            <div className="hidden lg:flex items-center gap-8 text-sm font-semibold text-gray-600">
              <a href="#concept" className="hover:text-primary-600 transition-colors">Le Concept</a>
              <a href="#how-it-works" className="hover:text-primary-600 transition-colors">Comment ça marche</a>
              <a href="#marketplace-preview" className="hover:text-primary-600 transition-colors flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-primary-500" /> Catalogue 3D
              </a>
              <a href="#morocco-map" className="hover:text-primary-600 transition-colors flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-indigo-500" /> Livraison COD
              </a>
            </div>

            <div className="hidden lg:flex items-center gap-3">
              <Link to="/login" className="text-sm font-semibold text-gray-700 hover:text-primary-600 transition-colors px-4 py-2">
                Connexion
              </Link>
              <Link to="/register" className="group relative overflow-hidden rounded-xl bg-primary-600 hover:bg-primary-700 transition-colors px-6 py-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-primary-600/25">
                <Sparkles size={14} className="animate-pulse" />
                <span>Démarrer gratuitement</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 rounded-xl text-gray-700 hover:bg-gray-100 transition-colors">
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden bg-white border-t border-gray-100 shadow-xl"
            >
              <div className="px-4 py-6 space-y-4">
                <a href="#concept" onClick={() => setMobileMenuOpen(false)} className="block font-semibold text-gray-700 py-2">Le Concept</a>
                <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block font-semibold text-gray-700 py-2">Comment ça marche</a>
                <a href="#marketplace-preview" onClick={() => setMobileMenuOpen(false)} className="block font-semibold text-gray-700 py-2">Catalogue 3D</a>
                <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block font-semibold text-gray-700 py-2">Connexion</Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="block w-full text-center bg-primary-600 text-white font-bold py-3.5 rounded-xl">
                  Démarrer gratuitement
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      <LiveTicker />

      {/* ══════════════════════════════════════════
          SECTION 1 — HERO ULTRA PREMIUM & DYNAMIC
      ══════════════════════════════════════════ */}
      <section className="relative pt-28 pb-20 lg:pt-36 lg:pb-32 px-4 sm:px-6 lg:px-8 overflow-hidden min-h-[92vh] flex items-center bg-white">
        
        {/* Ambient meshes */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-primary-50/20 pointer-events-none" />
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-primary-300/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-accent-300/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10 w-full">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* Left Side: Premium Headlines */}
            <div className="lg:col-span-6 space-y-8 text-left">
              
              {/* Live operations badge */}
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white border border-slate-100 shadow-md shadow-slate-100/50 text-xs font-bold text-slate-800">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span>🇲🇦 La Plateforme #1 du Dropshipping White-Label au Maroc</span>
              </div>

              {/* Majestic title */}
              <h1 className="text-4xl sm:text-6xl lg:text-[4.6rem] font-black leading-[1.05] tracking-tight text-slate-900">
                Votre Marque.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 via-primary-500 to-accent-500">
                  Votre Empire.
                </span><br />
                Zéro Stock.
              </h1>

              {/* Subtext */}
              <p className="text-sm sm:text-base text-slate-500 leading-relaxed max-w-xl">
                Devenez propriétaire d'une marque de cosmétique haut de gamme ou d'arômes sous 48h. Nous nous chargeons de la fabrication, du packaging et de la livraison express en Cash On Delivery (COD) dans tout le Maroc.
              </p>

              {/* Dynamic counters bar */}
              <div className="flex flex-wrap items-center gap-6 pt-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary-50 text-primary-600 rounded-xl"><Users size={16} /></div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Actifs en direct</div>
                    <div className="text-xs font-black text-slate-900 font-mono">{liveUsers}</div>
                  </div>
                </div>
                <div className="w-[1px] h-8 bg-slate-100 hidden sm:block" />
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><CheckCircle2 size={16} /></div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Livrées aujourd'hui</div>
                    <div className="text-xs font-black text-slate-900 font-mono">1,482+</div>
                  </div>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <Link to="/register" className="group relative overflow-hidden rounded-2xl bg-primary-600 hover:bg-primary-700 transition-all shadow-xl shadow-primary-500/20 px-8 py-4.5 flex items-center justify-center gap-2.5 text-xs font-bold uppercase tracking-wider text-white">
                  <Sparkles size={14} className="animate-pulse" />
                  <span>Démarrer Gratuitement</span>
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <a href="#marketplace-preview" className="rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all px-8 py-4.5 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <ShoppingBag size={14} className="text-primary-500" />
                  <span>Catalogue 3D</span>
                </a>
              </div>

            </div>

            {/* Right Side: Interactive 3D perspective layers & Live Operations console */}
            <div className="lg:col-span-6 relative w-full h-[540px] flex items-center justify-center">
              
              <div className="w-full h-full relative" style={{ perspective: '1000px' }}>
                
                {/* 3D Dashboard Mock (Primary Interactive Layer) */}
                <motion.div
                  whileHover={{ rotateY: -3, rotateX: 3, y: -5 }}
                  transition={{ duration: 0.5, type: 'spring' }}
                  className="absolute inset-0 w-full h-full bg-white/80 backdrop-blur-2xl border border-slate-100 rounded-[2.5rem] p-6 shadow-2xl flex flex-col justify-between overflow-hidden"
                  style={{ transformStyle: 'preserve-3d', boxShadow: '0 30px 60px -15px rgba(99, 102, 241, 0.08)' }}
                >
                  
                  {/* Browser Bar Simulator */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-400" /><div className="w-2.5 h-2.5 rounded-full bg-yellow-400" /><div className="w-2.5 h-2.5 rounded-full bg-green-400" /></div>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">app.silacod.com/operations</span>
                    </div>
                    <span className="px-2.5 py-1 bg-primary-50 border border-primary-100 rounded-lg text-[9px] font-black text-primary-600 uppercase tracking-widest">
                      Live Platform
                    </span>
                  </div>

                  {/* Financial simulator preview inside 3D card */}
                  <div className="grid grid-cols-2 gap-4 py-4" style={{ transform: 'translateZ(25px)' }}>
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Solde du Wallet</p>
                      <p className="text-xl font-black text-slate-900 font-mono">45,290 MAD</p>
                    </div>
                    <div className="p-4 bg-primary-50/30 border border-primary-100/30 rounded-2xl">
                      <p className="text-[9px] font-bold text-primary-600 uppercase tracking-wider mb-1">Moyenne de Marge</p>
                      <p className="text-xl font-black text-emerald-600 font-mono">+160 MAD / U</p>
                    </div>
                  </div>

                  {/* Live Activity logs stream simulation */}
                  <div className="space-y-2.5 py-3 flex-1 overflow-hidden" style={{ transform: 'translateZ(10px)' }}>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                      <RefreshCw size={10} className="animate-spin text-primary-500" /> Opérations Nationales en Direct
                    </div>
                    
                    <AnimatePresence>
                      {liveLog.map((log) => (
                        <motion.div
                          key={log.id}
                          initial={{ opacity: 0, x: -15, y: 5 }}
                          animate={{ opacity: 1, x: 0, y: 0 }}
                          exit={{ opacity: 0, x: 15, y: -5 }}
                          transition={{ duration: 0.4 }}
                          className="bg-slate-50/50 border border-slate-100 rounded-xl px-3 py-2.5 flex items-center justify-between gap-3 text-xs text-left"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping flex-shrink-0" />
                            <span className="font-semibold text-slate-700 truncate max-w-[240px]">{log.text}</span>
                          </div>
                          <span className="text-[9px] font-black uppercase text-slate-400 font-mono tracking-wider flex-shrink-0">{log.city}</span>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* Footer status bar */}
                  <div className="border-t border-slate-100 pt-4 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Réseau Expéditions Actif</div>
                    <div>Morocco Time</div>
                  </div>

                </motion.div>

              </div>

            </div>

          </div>
        </div>
      </section>

      {/* ── 6 STEPS DYNAMIC FLOWCHART ── */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 border-y border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto text-center space-y-16">
          <div className="space-y-4">
            <span className="text-primary-600 font-bold tracking-widest uppercase text-xs bg-primary-50 px-4 py-2 rounded-full border border-primary-100">
              Fonctionnement
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 leading-tight">
              De la commande à l'encaissement. En 6 étapes.
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm sm:text-base">
              Découvrez la synergie logistique et financière complète mise à votre disposition sans frais initiaux.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {steps.map((step, idx) => (
              <motion.div
                key={idx}
                whileHover={{ y: -8, rotateX: 4, rotateY: -2 }}
                className="bg-slate-50/50 hover:bg-white border border-slate-100 hover:border-primary-150 rounded-[2rem] p-8 text-left transition-all duration-300 relative group flex flex-col justify-between h-64"
                style={{ 
                  perspective: '1000px', 
                  transformStyle: 'preserve-3d',
                  boxShadow: '0 15px 30px -10px rgba(0,0,0,0.02)'
                }}
              >
                {/* 3D Border Light */}
                <div className="absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-primary-500/20 to-transparent group-hover:via-primary-500 transition-all" />

                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-slate-100 group-hover:bg-primary-600 group-hover:text-white transition-all duration-300 text-primary-600">
                    {step.icon}
                  </div>
                  <span className="text-3xl font-black text-slate-100 font-mono group-hover:text-primary-100 transition-colors">{step.n}</span>
                </div>

                <div className="space-y-2 mt-4" style={{ transform: 'translateZ(15px)' }}>
                  <h3 className="text-lg font-black text-slate-900 tracking-wide">{step.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION: PREMIUM 3D PRODUCTS SLIDER ── */}
      <section id="marketplace-preview" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-50/30">
        <div className="max-w-7xl mx-auto space-y-16">
          
          <div className="text-center space-y-4">
            <span className="text-primary-600 font-bold tracking-widest uppercase text-xs bg-primary-50 px-4 py-2 rounded-full border border-primary-100">
              Catalogue Produits 3D
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 leading-tight">
              Nos Best-Sellers White-Label en situation réelle.
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm sm:text-base">
              Formules prestigieuses prêtes à porter votre logo. Les images ci-dessous sont issues de nos lignes de production réelles.
            </p>
          </div>

          {/* Magnificent Auto-Playing 3D Product Slider */}
          <div className="relative max-w-5xl mx-auto min-h-[500px] flex items-center justify-center">
            
            <div className="w-full grid lg:grid-cols-12 gap-12 items-center bg-white border border-slate-100 rounded-[3.5rem] p-8 sm:p-12 shadow-2xl relative overflow-hidden">
              
              {/* Product Specifications (Left) */}
              <div className="lg:col-span-6 space-y-6 text-left relative z-10">
                <span className="px-3 py-1 bg-primary-50 border border-primary-100 rounded-lg text-[9px] font-black text-primary-600 uppercase tracking-widest">
                  {cosmeticShowcase[currentSlide].tag}
                </span>

                <h3 className="text-2xl sm:text-4xl font-black text-slate-900 leading-none">
                  {cosmeticShowcase[currentSlide].name}
                </h3>
                <p className="text-xs sm:text-sm font-semibold uppercase text-slate-400 tracking-wider">
                  {cosmeticShowcase[currentSlide].type}
                </p>

                <div className="flex gap-1 py-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
                  ))}
                  <span className="text-xs font-bold text-slate-400 ml-2">({cosmeticShowcase[currentSlide].rating.toFixed(1)})</span>
                </div>

                <div className="grid grid-cols-2 gap-4 py-4 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Prix de vente conseillé</span>
                    <p className="text-xl font-black text-slate-900 font-mono">{cosmeticShowcase[currentSlide].price}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Votre bénéfice net estimé</span>
                    <p className="text-xl font-black text-emerald-600 font-mono">+{cosmeticShowcase[currentSlide].profit}</p>
                  </div>
                </div>

                {/* Upload Simulator Input Info */}
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between gap-4">
                  <div className="text-xs text-slate-500 leading-relaxed">
                    {customLogoSelected && uploadedLogo ? (
                      <span className="text-emerald-600 font-bold">✓ Votre marque a été étiquetée avec succès sur le flacon !</span>
                    ) : (
                      <span>Uploadez votre logo ci-dessous pour voir le flacon se brander instantanément.</span>
                    )}
                  </div>
                </div>

                {/* Dots indicator */}
                <div className="flex items-center gap-3">
                  {cosmeticShowcase.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentSlide(i)}
                      className={`h-2.5 rounded-full transition-all duration-300 ${
                        currentSlide === i ? 'w-8 bg-primary-600' : 'w-2.5 bg-slate-200'
                      }`}
                    />
                  ))}
                </div>

              </div>

              {/* 3D Product Glass Pedestal Render (Right) */}
              <div className="lg:col-span-6 flex justify-center items-center relative min-h-[380px]" style={{ perspective: '1000px' }}>
                
                <motion.div
                  key={currentSlide}
                  initial={{ rotateY: -15, opacity: 0, scale: 0.95 }}
                  animate={{ rotateY: 5, opacity: 1, scale: 1 }}
                  exit={{ rotateY: 15, opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.5, type: 'spring' }}
                  className="relative rounded-3xl overflow-hidden aspect-[4/5] w-full max-w-[280px] bg-slate-100 border border-slate-200 shadow-2xl group cursor-pointer"
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  <img src={cosmeticShowcase[currentSlide].image} alt={cosmeticShowcase[currentSlide].name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  
                  {/* Dynamic brand logo hot stamp simulator */}
                  {customLogoSelected && uploadedLogo && (
                    <div className="absolute inset-x-0 bottom-[30%] flex justify-center items-center pointer-events-none" style={{ transform: 'translateZ(30px)' }}>
                      <div className="bg-white/90 backdrop-blur-md border border-slate-200 px-3.5 py-2.5 rounded-xl text-center shadow-2xl max-w-[140px] animate-pulse">
                        <img src={uploadedLogo} alt="Logo" className="h-5 mx-auto object-contain brightness-0" />
                        <span className="text-[8px] font-bold text-slate-800 uppercase tracking-widest mt-1 block">Your Brand</span>
                      </div>
                    </div>
                  )}

                  {/* Gradient shadow */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent pointer-events-none" />

                </motion.div>

              </div>

            </div>

          </div>

          {/* Interactive branding form widget */}
          <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl shadow-slate-100/50">
            <div className="text-left space-y-2">
              <h4 className="text-xl font-black text-slate-950">Visualisez votre future marque beauté</h4>
              <p className="text-xs text-slate-500 leading-relaxed max-w-lg">
                Importez votre logo (au format PNG transparent de préférence). Notre moteur de rendu l'appliquera directement sur le modèle 3D ci-dessus.
              </p>
            </div>

            <div className="flex-shrink-0 flex items-center gap-4">
              <input
                type="file"
                id="logo-slider-upload"
                className="hidden"
                accept="image/*"
                onChange={handleLogoUpload}
              />
              <label
                htmlFor="logo-slider-upload"
                className="cursor-pointer px-6 py-3.5 bg-primary-600 hover:bg-primary-700 transition-all rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-primary-500/10 active:scale-95"
              >
                {customLogoSelected ? "Changer de Logo" : "Uploader Mon Logo (.png)"}
              </label>
              {customLogoSelected && (
                <button
                  onClick={() => { setUploadedLogo(null); setCustomLogoSelected(false); }}
                  className="px-4 py-3.5 border border-slate-200 hover:bg-slate-50 transition-all rounded-xl text-xs font-bold uppercase tracking-wider text-slate-500"
                >
                  Effacer
                </button>
              )}
            </div>
          </div>

        </div>
      </section>

      {/* ── SECTION: MOROCCO MAP DISTRIBUTION NETWORK ── */}
      <section id="morocco-map" className="py-24 border-y border-slate-100 bg-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            
            {/* Map Text Side */}
            <div className="lg:col-span-5 text-left space-y-6">
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[10px] font-bold uppercase tracking-widest">
                <Truck size={12} /> Logistique & COD
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-slate-900 leading-tight">
                Une flotte logistique nationale COD ultra-rapide.
              </h2>
              <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
                Notre réseau logistique couvre tout le territoire marocain. Dès qu'une commande est enregistrée, nos hubs régionaux préparent, étiquettent et expédient vos produits sous 24 à 48 heures maximum.
              </p>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  <h4 className="text-2xl font-black text-slate-900 font-mono">24h - 48h</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Délai moyen de livraison</p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  <h4 className="text-2xl font-black text-emerald-600 font-mono">94.8%</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Taux de confirmation global</p>
                </div>
              </div>
            </div>

            {/* Map Graphical Side */}
            <div className="lg:col-span-7 relative flex justify-center items-center">
              
              {/* Virtual Morocco Vector Container */}
              <div className="relative bg-slate-50 border border-slate-150 rounded-[2.5rem] w-full max-w-xl h-[450px] p-6 overflow-hidden flex items-center justify-center shadow-lg shadow-slate-100/50">
                
                {/* Glow Background */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary-100/30 rounded-full blur-[80px] pointer-events-none" />

                {/* Stylized vector map SVG */}
                <svg className="w-full h-full opacity-40 stroke-primary-500/20 fill-primary-500/5 stroke-2" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
                  <path d="M 120 30 C 140 30, 160 50, 180 40 C 200 30, 220 50, 240 60 C 260 70, 270 90, 280 110 C 290 130, 270 150, 280 170 C 290 190, 310 200, 320 220 C 330 240, 310 260, 300 280 C 290 300, 280 320, 260 330 C 240 340, 220 350, 200 360 C 180 370, 160 380, 140 390 C 120 390, 100 370, 90 350 C 80 330, 60 310, 50 290 C 40 270, 50 250, 60 230 C 70 210, 80 190, 90 170 C 100 150, 110 130, 110 110 C 110 90, 90 70, 100 50 Z" />
                </svg>

                {/* Animated Pulsing Cities */}
                {moroccoCities.map((city, idx) => (
                  <div
                    key={idx}
                    className="absolute group cursor-pointer"
                    style={{ left: city.x, top: city.y }}
                  >
                    {/* Ring ping */}
                    <span className="absolute -left-2 -top-2 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" style={{ animationDelay: city.pulseDelay }} />
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-primary-500 opacity-40" />
                    </span>
                    {/* Core Point */}
                    <div className="w-1.5 h-1.5 bg-primary-500 rounded-full border border-white relative z-10" />

                    {/* Tooltip */}
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-5 bg-white border border-slate-100 rounded-xl px-3 py-2 w-36 text-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-20 pointer-events-none shadow-2xl">
                      <div className="text-[10px] font-black text-slate-800">{city.name}</div>
                      <div className="text-[9px] font-bold text-primary-600 mt-0.5">{city.success} livraisons</div>
                      <div className="text-[8px] font-bold text-slate-400 mt-0.5">{city.count} commandes/mois</div>
                    </div>
                  </div>
                ))}

                {/* Bottom Left Legend */}
                <div className="absolute bottom-4 left-4 bg-white/80 backdrop-blur-md border border-slate-100 rounded-xl p-3 text-[10px] font-bold space-y-1 shadow-md">
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary-500" /> Hubs Opérationnels Actifs</div>
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary-500/30 animate-pulse" /> Flux Logistique COD</div>
                </div>

              </div>

            </div>

          </div>
        </div>
      </section>

      {/* ── Simulator ── */}
      <ProfitSimulator />

      {/* ── Success Stories ── */}
      <SuccessStories />

      {/* ── Section: Pricing Masterpiece Call To Action ── */}
      <section className="py-28 px-4 sm:px-6 lg:px-8 bg-white relative">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gradient-to-br from-slate-900 via-primary-950 to-slate-950 border border-slate-800 rounded-[3rem] p-8 sm:p-16 text-center space-y-8 relative overflow-hidden shadow-2xl">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-primary-500/10 rounded-full blur-[100px] pointer-events-none" />
            
            <div className="relative z-10 space-y-6">
              <span className="text-5xl block animate-bounce duration-3000">🎁</span>
              <h2 className="text-3xl sm:text-5xl lg:text-7xl font-black text-white leading-none">
                Zéro Abonnement.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-400">
                  Zéro Risque.
                </span>
              </h2>
              <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto">
                L'inscription est entièrement gratuite. Nous prélevons une commission transparente uniquement sur chaque commande livrée avec succès. Notre succès est aligné sur le vôtre.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
                <Link
                  to="/register"
                  className="px-10 py-5 bg-white text-slate-950 rounded-2xl text-xs font-black uppercase tracking-wider shadow-xl hover:bg-slate-100 active:scale-95 transition-all"
                >
                  Créer Mon Compte Gratuit
                </Link>
                <a
                  href="#marketplace-preview"
                  className="px-10 py-5 border border-slate-700 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-black uppercase tracking-wider text-slate-300"
                >
                  Voir Le Catalogue 3D
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <FAQ />

      {/* ── Footer ── */}
      <footer className="bg-slate-900 border-t border-slate-800 pt-20 pb-10 px-4 sm:px-6 lg:px-8 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16 text-left">
            {/* Brand details */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <img src="/new logo/logo filess-25.svg" alt="SILACOD" className="w-10 h-10 object-contain" />
                <img src="/new logo/logo filess-24.svg" alt="SILACOD" className="h-9 brightness-200 object-contain" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                La plateforme n°1 de Dropshipping et de solutions White-Label de cosmétiques au Maroc. Vendez, nous gérons la fabrication, la logistique et la livraison.
              </p>
            </div>

            {/* Platform links */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Plateforme</h4>
              <div className="space-y-2 text-xs text-slate-400">
                <Link to="/register" className="block hover:text-white transition-colors">Vendeurs White-Label</Link>
                <Link to="/influencer/register" className="block hover:text-white transition-colors">Programme Influenceur VIP</Link>
                <a href="#marketplace-preview" className="block hover:text-white transition-colors">Catalogue Produits</a>
                <Link to="/login" className="block hover:text-white transition-colors">Portail de Connexion</Link>
              </div>
            </div>

            {/* Resource links */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Ressources</h4>
              <div className="space-y-2 text-xs text-slate-400">
                <a href="#how-it-works" className="block hover:text-white transition-colors">Comment ça marche</a>
                <a href="#morocco-map" className="block hover:text-white transition-colors">Zones de Livraison</a>
                <a href="#faq" className="block hover:text-white transition-colors">Questions fréquentes (FAQ)</a>
              </div>
            </div>

            {/* Legal terms */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Légal</h4>
              <div className="space-y-2 text-xs text-slate-400">
                <a href="#" className="block hover:text-white transition-colors">Conditions Générales de Vente</a>
                <a href="#" className="block hover:text-white transition-colors">Politique de Confidentialité</a>
                <a href="#" className="block hover:text-white transition-colors">Mentions Légales</a>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              © 2026 SILACOD Platform. Tous droits réservés. 🇲🇦 Fait avec ❤️ pour les entrepreneurs marocains.
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Tous les systèmes opérationnels
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}

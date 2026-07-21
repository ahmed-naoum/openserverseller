import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, Truck, Palette, TrendingUp, Sparkles, ArrowLeft,
  Package, Star, Users, Banknote,
  Crown, Zap, Shield, Globe, ChevronDown, Play, Menu, X,
  Instagram, Youtube, BarChart3, Wallet, Gift, Award, Heart,
  MousePointerClick, Phone, Box, Check, RefreshCw, CheckCircle2,
  ChevronLeft, ChevronRight, MessageCircle, HelpCircle, LogIn
} from 'lucide-react';
import LiveTicker from '../components/home/LiveTicker';
import ProfitSimulator from '../components/home/ProfitSimulator';
import SuccessStories from '../components/home/SuccessStories';
import FAQ from '../components/home/FAQ';
import { publicApi, BACKEND_URL } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { LanguageSwitcherWidget } from '../components/common';

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
  const { isAuthenticated, user } = useAuth();
  const { language, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState<'confirmation' | 'tracking' | 'products' | 'profits' | 'orders'>('confirmation');
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
    { id: 1, text: "📦 تم شحن طلب 'ساعة ذكية' للزبون في طنجة!", time: "للأن", city: "طنجة" },
    { id: 2, text: "📞 تم تأكيد طلب من 'سمية خ.' بواسطة خدمة العملاء!", time: "منذ دقيقة", city: "الرباط" },
    { id: 3, text: "💰 تم إيداع عمولة بقيمة +120 درهم في المحفظة!", time: "منذ دقيقتين", city: "مراكش" },
  ]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);

    // Dynamic active users fluctuation
    const usersInterval = setInterval(() => {
      setLiveUsers(prev => prev + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 4 + 1));
    }, 4000);

    // Dynamic live dispatches feed
    const dispatchInterval = setInterval(() => {
      const cities = ["الدار البيضاء", "الرباط", "مراكش", "طنجة", "فاس", "أكادير", "وجدة"];
      const buyers = ["أيوب م.", "ياسمين ت.", "كريم ب.", "سلمى ل.", "نادية ر."];
      const products = ["ساعة ذكية الترا", "سماعات بلوتوث برو", "شاحن سريع ذكي", "ساعة رياضية متطورة"];
      const operations = [
        `📦 تم شحن طلب '${products[Math.floor(Math.random() * products.length)]}' للزبون!`,
        `📞 تم تأكيد طلب العميل '${buyers[Math.floor(Math.random() * buyers.length)]}' بنجاح!`,
        `💰 تم تحويل أرباح بقيمة +${Math.floor(Math.random() * 3 + 1) * 120} درهم للمسوق!`
      ];

      const newLog = {
        id: Date.now(),
        text: operations[Math.floor(Math.random() * operations.length)],
        time: "للأن",
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
    {
      n: '01',
      title: 'اختر منتجات قابلة لبناء براند',
      desc: 'ابدأ باختيار منتجات جاهزة للبيع من داخل Marketplace الخاص بالمنصة. يمكنك بيع المنتجات بعلامتك الخاصة وبهوية تناسب جمهورك.'
    },
    {
      n: '02',
      title: 'ابدأ التسويق واستقبل الطلبات بسهولة',
      desc: 'استقبال الطلبات تلقائياً وبدون تعقيد تقني. شارك رابط المنتج مباشرة على TikTok أو Instagram وابدأ باستقبال الطلبات في لوحة تحكمك.'
    },
    {
      n: '03',
      title: 'اترك العمليات التشغيلية لـ SILACOD',
      desc: 'بعد وصول الطلبات، نتكفل بجميع العمليات التشغيلية واللوجستية: تأكيد الطلبات هاتفياً مع الزبناء، تجهيز وتغليف المنتج، والتوصيل السريع مع تحصيل أموالك.'
    }
  ];

  const moroccoCities = [
    { name: "الدار البيضاء", x: "42%", y: "30%", success: "96%", count: "4,820", pulseDelay: "0s" },
    { name: "الرباط", x: "45%", y: "24%", success: "98%", count: "3,120", pulseDelay: "0.5s" },
    { name: "مراكش", x: "32%", y: "52%", success: "94%", count: "2,980", pulseDelay: "1s" },
    { name: "طنجة", x: "48%", y: "10%", success: "95%", count: "1,850", pulseDelay: "1.5s" },
    { name: "فاس", x: "55%", y: "32%", success: "93%", count: "2,150", pulseDelay: "2s" },
    { name: "أكادير", x: "22%", y: "68%", success: "92%", count: "1,450", pulseDelay: "2.5s" }
  ];

  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);

  useEffect(() => {
    publicApi.featuredProducts()
      .then(res => {
        if (res.data?.status === 'success') {
          setProducts(res.data.data.products || []);
        }
      })
      .catch(err => console.error("Error loading featured products:", err))
      .finally(() => setLoadingProducts(false));
  }, []);

  // Auto scroll effect
  useEffect(() => {
    if (!isAutoScrolling || products.length === 0) return;
    
    const interval = setInterval(() => {
      if (sliderRef.current) {
        const slider = sliderRef.current;
        // Check if we are near the end of scroll
        // Browsers handle RTL scrollLeft differently (some use negative, some reverse positive).
        // A safer way is checking scrollWidth vs clientWidth + Math.abs(scrollLeft)
        if (Math.abs(slider.scrollLeft) >= slider.scrollWidth - slider.clientWidth - 10) {
           slider.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
           slider.scrollBy({ left: -340, behavior: 'smooth' });
        }
      }
    }, 3500);
    
    return () => clearInterval(interval);
  }, [isAutoScrolling, products]);

  const scrollSlider = (direction: 'left' | 'right') => {
    if (sliderRef.current) {
      const scrollAmount = direction === 'left' ? -340 : 340;
      sliderRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className={`min-h-screen bg-[#fafafc] selection:bg-primary-100 font-['29LT_Kaff',_Cairo,_Inter,_sans-serif] overflow-x-hidden relative ${language === 'ar' ? 'text-right' : 'text-left'}`}>
      
      {/* ── Navbar ── */}
      <motion.nav
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="fixed top-0 left-0 right-0 z-50 flex flex-col"
      >
        <LiveTicker />
        <div className={`transition-all duration-300 ${scrolled || mobileMenuOpen ? 'bg-white/95 backdrop-blur-xl shadow-lg shadow-slate-100/50 border-b border-slate-100/80' : 'bg-transparent'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[90px] relative">
            
            {/* Logo */}
            <div className="flex items-center relative z-10">
              <Link to="/" dir="ltr" className="flex items-center gap-2.5 group">
                <motion.img whileHover={{ rotateY: 15, scale: 1.05 }} src="/new logo/logo filess-25.svg" alt="SILACOD" className="w-8 h-8 sm:w-10 sm:h-[3rem] origin-center object-contain mt-[-0.5rem]" />
                <img src="/new logo/logo filess-24.svg" alt="SILACOD" className="h-[20px] sm:h-[26px] object-contain" />
              </Link>
            </div>

            {/* Center Navigation Links */}
            <div className="hidden lg:flex items-center gap-4 xl:gap-6 text-[14px] xl:text-[15px] font-black text-[#2e315e] mx-auto z-10">
              <Link to="/contact" className="hover:text-[#ff5722] transition-colors">{t('contact_us')}</Link>
              <a href="#marketplace" className="hover:text-[#ff5722] transition-colors">{t('products_label')}</a>
              <Link to="/influencer/register" className="hover:text-[#ff5722] transition-colors">{t('influencers_label')}</Link>
            </div>

            {/* Left side actions (Login, Register / Dashboard) */}
            <div className="hidden lg:flex items-center gap-2.5 xl:gap-3 relative z-10">
              <LanguageSwitcherWidget />
              {isAuthenticated ? (
                <Link to={
                  user?.role === 'SUPER_ADMIN' || user?.role === 'FINANCE_ADMIN' || user?.role === 'SYSTEM_SUPPORT' ? '/admin' :
                  user?.role === 'CALL_CENTER_AGENT' ? '/agent' :
                  user?.role === 'FULFILLMENT_OPERATOR' ? '/warehouse' :
                  user?.role === 'COURIER_PARTNER' ? '/courier' :
                  user?.role === 'GROSSELLER' ? '/grosseller' :
                  user?.role === 'INFLUENCER' ? '/influencer' :
                  user?.role === 'CONFIRMATION_AGENT' ? '/confirmation' :
                  user?.role === 'HELPER' ? '/helper' :
                  user?.role === 'UNCONFIRMED' ? '/verify' : '/dashboard'
                } className="rounded-[10px] bg-[#2e315e] hover:bg-[#1e2142] px-6 py-2.5 flex items-center justify-center text-[15px] font-bold text-white transition-all shadow-md">
                  <span className="translate-y-[4px]">{t('go_to_dashboard')}</span>
                </Link>
              ) : (
                <>
                  {/* Login Button (Dark Blue Square Icon Wrapper) */}
                  <Link to="/login" className="w-[42px] h-[42px] bg-[#2e315e] hover:bg-[#1e2142] text-white rounded-[10px] flex items-center justify-center transition-colors">
                    <LogIn className="w-[20px] h-[20px]" />
                  </Link>

                  {/* Solid Orange/Coral Register Button */}
                  <Link to="/register" className="rounded-[10px] bg-[#ff5722] hover:bg-[#e64a19] px-6 py-2.5 flex items-center justify-center text-[15px] font-bold text-white transition-all shadow-sm">
                    <span className="translate-y-[4px]">{t('get_started_free')}</span>
                  </Link>
                </>
              )}
            </div>

            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors">
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="lg:hidden absolute top-[90px] left-0 right-0 bg-white border-b border-slate-100 shadow-xl z-40"
            >
              <div className="px-4 py-6 space-y-4 text-right flex flex-col items-end">
                <LanguageSwitcherWidget />
                <Link to="/influencer/register" onClick={() => setMobileMenuOpen(false)} className="block font-bold text-[#2e315e] py-2">{t('influencers_label')}</Link>
                <a href="#marketplace" onClick={() => setMobileMenuOpen(false)} className="block font-bold text-[#2e315e] py-2">{t('products_label')}</a>
                <Link to="/contact" onClick={() => setMobileMenuOpen(false)} className="block font-bold text-[#2e315e] py-2">{t('contact_us')}</Link>
                {isAuthenticated ? (
                  <Link to={
                    user?.role === 'SUPER_ADMIN' || user?.role === 'FINANCE_ADMIN' || user?.role === 'SYSTEM_SUPPORT' ? '/admin' :
                    user?.role === 'CALL_CENTER_AGENT' ? '/agent' :
                    user?.role === 'FULFILLMENT_OPERATOR' ? '/warehouse' :
                    user?.role === 'COURIER_PARTNER' ? '/courier' :
                    user?.role === 'GROSSELLER' ? '/grosseller' :
                    user?.role === 'INFLUENCER' ? '/influencer' :
                    user?.role === 'CONFIRMATION_AGENT' ? '/confirmation' :
                    user?.role === 'HELPER' ? '/helper' :
                    user?.role === 'UNCONFIRMED' ? '/verify' : '/dashboard'
                  } onClick={() => setMobileMenuOpen(false)} className="block w-full text-center bg-[#2e315e] text-white font-bold py-3.5 rounded-xl">
                    <span className="block -translate-y-[1px]">{t('go_to_dashboard')}</span>
                  </Link>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block font-bold text-[#2e315e] py-2">{t('login_label')}</Link>
                    <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="block w-full text-center bg-[#ff5722] text-white font-bold py-3.5 rounded-xl">
                      <span className="block -translate-y-[1px]">{t('get_started_free')}</span>
                    </Link>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </motion.nav>

      {/* Main content padding to account for fixed ticker + navbar */}
      <div className="pt-[135px]"></div>

      {/* ── HERO SECTION ── */}
      <section className="relative pt-12 pb-20 lg:pt-16 lg:pb-32 px-4 sm:px-6 lg:px-8 overflow-hidden min-h-[85vh] flex items-center">
        
        <div className="max-w-[1400px] mx-auto relative z-10 w-full pl-0 pr-4 lg:pr-12">
          <div className="grid lg:grid-cols-12 gap-8 items-center">
            
            {/* Right Side: Arabic Title and Text */}
            <div className={`order-last lg:order-first lg:col-span-6 space-y-7 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
              
              {/* Title */}
              <h1 className="text-3xl sm:text-5xl lg:text-[3.25rem] font-black leading-[1.25] tracking-tight text-[#2e315e] font-['29LT_Kaff',Cairo,sans-serif]">
                {t('welcome')}
              </h1>

              {/* Subtext */}
              <p className="text-slate-600 text-[17px] font-bold leading-[1.8] max-w-[90%]">
                {t('tagline')}
              </p>

              {/* Subtitle checklist features with custom blue checkmarks */}
              <div className="space-y-4 pt-3">
                <div className="flex flex-col sm:flex-row gap-6 justify-start">
                  {/* First item (visually right in RTL) */}
                  <div className="flex items-center gap-2.5 text-[#2e315e] font-black text-[17px]">
                    <CheckCircle2 strokeWidth={2.5} className="w-[22px] h-[22px] shrink-0" />
                    <span>{t('ready_products')}</span>
                  </div>
                  {/* Second item (visually left in RTL) */}
                  <div className="flex items-center gap-2.5 text-[#2e315e] font-black text-[17px]">
                    <CheckCircle2 strokeWidth={2.5} className="w-[22px] h-[22px] shrink-0" />
                    <span>{t('cod_system')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 text-[#2e315e] font-black text-[17px] justify-start">
                  <CheckCircle2 strokeWidth={2.5} className="w-[22px] h-[22px] shrink-0" />
                  <span>{t('coverage_all_cities')}</span>
                </div>
              </div>

              {/* CTA Buttons - Aligned to the left under text block */}
              <div className="flex flex-col sm:flex-row gap-4 pt-8 justify-end w-full sm:w-[90%]">
                {isAuthenticated ? (
                  <Link to={
                    user?.role === 'SUPER_ADMIN' || user?.role === 'FINANCE_ADMIN' || user?.role === 'SYSTEM_SUPPORT' ? '/admin' :
                    user?.role === 'CALL_CENTER_AGENT' ? '/agent' :
                    user?.role === 'FULFILLMENT_OPERATOR' ? '/warehouse' :
                    user?.role === 'COURIER_PARTNER' ? '/courier' :
                    user?.role === 'GROSSELLER' ? '/grosseller' :
                    user?.role === 'INFLUENCER' ? '/influencer' :
                    user?.role === 'CONFIRMATION_AGENT' ? '/confirmation' :
                    user?.role === 'HELPER' ? '/helper' :
                    user?.role === 'UNCONFIRMED' ? '/verify' : '/dashboard'
                  } className="w-full sm:w-auto rounded-[12px] bg-[#ff5722] hover:bg-[#e64a19] transition-all px-8 py-[14px] flex items-center justify-center gap-3 text-[16px] font-black text-white shadow-xl shadow-[#ff5722]/20">
                    <span>{t('go_to_dashboard')}</span>
                    <ArrowLeft size={18} />
                  </Link>
                ) : (
                  <Link to="/register" className="w-full sm:w-auto rounded-[12px] bg-[#ff5722] hover:bg-[#e64a19] transition-all px-8 py-[14px] flex items-center justify-center gap-3 text-[16px] font-black text-white shadow-xl shadow-[#ff5722]/20">
                    <span>{t('start_now_free')}</span>
                    <ArrowLeft size={18} />
                  </Link>
                )}
              </div>

            </div>

            {/* Left Side: Static Hero Image Block matching screenshot */}
            <div className="order-first lg:order-last lg:col-span-6 relative w-full flex items-center justify-center lg:justify-start mb-8 lg:mb-0">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                className="relative w-full aspect-[4/3] flex items-center justify-center"
              >
                <img
                  src="/home page silacod copy/images/hero.webp"
                  alt="SILACOD Dashboard Preview"
                  className="w-full h-auto object-contain origin-left scale-100 lg:scale-[1.15] lg:-translate-x-[5%]"
                  width="800"
                  height="600"
                  loading="eager"
                  // @ts-ignore
                  fetchpriority="high"
                  decoding="async"
                />
              </motion.div>
            </div>

          </div>
        </div>
      </section>

      {/* ── DYNAMIC COUNTER STATISTICS SECTION ── */}
      <section className="py-16 bg-white text-slate-900 relative overflow-hidden font-['29LT_Kaff',Cairo,sans-serif]">
        
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-[#2e315e]">{t('stats_title')}</h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-[16px] font-bold">
              {t('stats_desc')}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-right pt-4">
            
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 bg-[#2e315e] rounded-[14px] flex items-center justify-center shrink-0 shadow-lg shadow-[#2e315e]/20">
                <Globe className="w-7 h-7 text-white" />
              </div>
              <div className="text-center">
                <div className="text-2xl font-black text-[#2e315e] font-mono">100%</div>
                <p className="text-[13px] font-bold text-slate-500 mt-1">{t('morocco_coverage')}</p>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 bg-[#2e315e] rounded-[14px] flex items-center justify-center shrink-0 shadow-lg shadow-[#2e315e]/20">
                <RefreshCw className="w-7 h-7 text-white" />
              </div>
              <div className="text-center">
                <div className="text-2xl font-black text-[#2e315e] font-mono">
                  <Counter to={68000} suffix="+" />
                </div>
                <p className="text-[13px] font-bold text-slate-500 mt-1">{t('shipped_monthly')}</p>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 bg-[#2e315e] rounded-[14px] flex items-center justify-center shrink-0 shadow-lg shadow-[#2e315e]/20">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div className="text-center">
                <div className="text-2xl font-black text-[#2e315e] font-mono">
                  <Counter to={3000} suffix="+" />
                </div>
                <p className="text-[13px] font-bold text-slate-500 mt-1">{t('active_sellers')}</p>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 bg-[#2e315e] rounded-[14px] flex items-center justify-center shrink-0 shadow-lg shadow-[#2e315e]/20">
                <Package className="w-7 h-7 text-white" />
              </div>
              <div className="text-center">
                <div className="text-2xl font-black text-[#2e315e] font-mono">
                  <Counter to={500} suffix="+" />
                </div>
                <p className="text-[13px] font-bold text-slate-500 mt-1">{t('ready_to_sell_products')}</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── ALONE VS SILACOD (لماذا يفشل أغلب الناس؟) ── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white relative font-['29LT_Kaff',Cairo,sans-serif]">
        <div className="max-w-6xl mx-auto text-center space-y-16">
          
          <div className="space-y-4">
            <h2 className="text-3xl sm:text-5xl font-black text-[#2e315e] leading-tight">
              {t('why_fail_title')}
            </h2>
            <p className="text-[#2e315e] max-w-xl mx-auto text-sm sm:text-base font-bold">
              {t('why_fail_subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-start max-w-4xl mx-auto">
            
            {/* With Silacod (العمل مع SILACOD) */}
            <motion.div
              whileHover={{ y: -5 }}
              className="flex flex-col items-center text-center space-y-8"
            >
              <div className="w-full max-w-[320px] mx-auto bg-white relative">
                {/* Background Grid Pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-70" />
                <img src="/home page silacod copy/images/After.webp" alt="Success with Silacod" className="w-full h-auto object-cover max-h-[260px] relative z-10 p-6" />
              </div>

              <h3 className="text-2xl sm:text-3xl font-black text-[#ff5722]">{t('work_with_silacod')}</h3>

              <div className="inline-block text-right">
                <ul className="space-y-4 text-[#2e315e] text-sm font-bold">
                  <li className="flex items-center justify-start gap-3">
                    <span className="w-4 h-4 rounded-full border-[1.5px] border-[#2e315e] text-[#2e315e] flex items-center justify-center text-[9px] font-black shrink-0">✓</span>
                    <span>{t('silacod_benefit1')}</span>
                  </li>
                  <li className="flex items-center justify-start gap-3">
                    <span className="w-4 h-4 rounded-full border-[1.5px] border-[#2e315e] text-[#2e315e] flex items-center justify-center text-[9px] font-black shrink-0">✓</span>
                    <span>{t('silacod_benefit2')}</span>
                  </li>
                  <li className="flex items-center justify-start gap-3">
                    <span className="w-4 h-4 rounded-full border-[1.5px] border-[#2e315e] text-[#2e315e] flex items-center justify-center text-[9px] font-black shrink-0">✓</span>
                    <span>{t('silacod_benefit3')}</span>
                  </li>
                  <li className="flex items-center justify-start gap-3">
                    <span className="w-4 h-4 rounded-full border-[1.5px] border-[#2e315e] text-[#2e315e] flex items-center justify-center text-[9px] font-black shrink-0">✓</span>
                    <span>{t('silacod_benefit4')}</span>
                  </li>
                  <li className="flex items-center justify-start gap-3">
                    <span className="w-4 h-4 rounded-full border-[1.5px] border-[#2e315e] text-[#2e315e] flex items-center justify-center text-[9px] font-black shrink-0">✓</span>
                    <span>{t('silacod_benefit5')}</span>
                  </li>
                  <li className="flex items-center justify-start gap-3">
                    <span className="w-4 h-4 rounded-full border-[1.5px] border-[#2e315e] text-[#2e315e] flex items-center justify-center text-[9px] font-black shrink-0">✓</span>
                    <span>{t('silacod_benefit6')}</span>
                  </li>
                </ul>
              </div>
            </motion.div>

            {/* Alone (العمل لوحدك) */}
            <motion.div
              whileHover={{ y: -5 }}
              className="flex flex-col items-center text-center space-y-8"
            >
              <div className="w-full max-w-[320px] mx-auto bg-white relative">
                {/* Background Grid Pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-70" />
                <img src="/home page silacod copy/images/Before.webp" alt="Struggle Working Alone" className="w-full h-auto object-cover max-h-[260px] relative z-10 p-6" />
              </div>

              <h3 className="text-2xl sm:text-3xl font-black text-slate-500">{t('work_alone')}</h3>

              <div className="inline-block text-right">
                <ul className="space-y-4 text-slate-500 text-sm font-bold">
                  <li className="flex items-center justify-start gap-3">
                    <span className="w-4 h-4 rounded-full border-[1.5px] border-slate-500 text-slate-500 flex items-center justify-center text-[9px] font-black shrink-0">✗</span>
                    <span>{t('alone_drawback1')}</span>
                  </li>
                  <li className="flex items-center justify-start gap-3">
                    <span className="w-4 h-4 rounded-full border-[1.5px] border-slate-500 text-slate-500 flex items-center justify-center text-[9px] font-black shrink-0">✗</span>
                    <span>{t('alone_drawback2')}</span>
                  </li>
                  <li className="flex items-center justify-start gap-3">
                    <span className="w-4 h-4 rounded-full border-[1.5px] border-slate-500 text-slate-500 flex items-center justify-center text-[9px] font-black shrink-0">✗</span>
                    <span>{t('alone_drawback3')}</span>
                  </li>
                  <li className="flex items-center justify-start gap-3">
                    <span className="w-4 h-4 rounded-full border-[1.5px] border-slate-500 text-slate-500 flex items-center justify-center text-[9px] font-black shrink-0">✗</span>
                    <span>{t('alone_drawback4')}</span>
                  </li>
                  <li className="flex items-center justify-start gap-3">
                    <span className="w-4 h-4 rounded-full border-[1.5px] border-slate-500 text-slate-500 flex items-center justify-center text-[9px] font-black shrink-0">✗</span>
                    <span>{t('alone_drawback5')}</span>
                  </li>
                  <li className="flex items-center justify-start gap-3">
                    <span className="w-4 h-4 rounded-full border-[1.5px] border-slate-500 text-slate-500 flex items-center justify-center text-[9px] font-black shrink-0">✗</span>
                    <span>{t('alone_drawback6')}</span>
                  </li>
                </ul>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ── ALL IN ONE SYSTEM (كل ما تحتاجه في نظام واحد) ── */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-50/50 border-y border-slate-100/80">
        <div className="max-w-6xl mx-auto space-y-16">
          
          <div className="text-center space-y-4">
            <h2 className="text-3xl sm:text-5xl font-black text-[#2e315e] leading-tight font-['29LT_Kaff',Cairo,sans-serif]">
              {t('all_in_one_title')}
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm sm:text-base font-bold">
              {t('all_in_one_subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 md:gap-12">
            
            {/* Card 1 */}
            <motion.div whileHover={{ y: -5 }} className="bg-white rounded-[2rem] overflow-hidden border border-slate-100 shadow-sm flex flex-col items-center pt-10 px-6 gap-8 text-center">
              <div className="space-y-3 w-full">
                <span className="inline-block text-[#ff5722] font-black text-xs bg-[#ff5722]/10 px-3 py-1 rounded-full mb-2">{t('conf_badge')}</span>
                <h3 className="text-2xl font-black text-[#2e315e]">{t('conf_badge')}</h3>
                <p className="text-slate-500 text-sm font-bold leading-relaxed max-w-sm mx-auto">
                  {t('conf_desc')}
                </p>
              </div>
              <img src="/home page silacod copy/images/call-center-customer-service.webp" alt="Call Center" className="w-[85%] max-w-[400px] h-auto object-cover rounded-t-[1.5rem] mt-auto" />
            </motion.div>

            {/* Card 2 */}
            <motion.div whileHover={{ y: -5 }} className="bg-white rounded-[2rem] overflow-hidden border border-slate-100 shadow-sm flex flex-col items-center pt-10 px-6 gap-8 text-center">
              <div className="space-y-3 w-full">
                <span className="inline-block text-[#ff5722] font-black text-xs bg-[#ff5722]/10 px-3 py-1 rounded-full mb-2">{t('variety_badge')}</span>
                <h3 className="text-2xl font-black text-[#2e315e]">{t('ready_products')}</h3>
                <p className="text-slate-500 text-sm font-bold leading-relaxed max-w-sm mx-auto">
                  {t('variety_desc')}
                </p>
              </div>
              <img src="/home page silacod copy/images/cards-4-1.webp" alt="Products" className="w-[85%] max-w-[400px] h-auto object-contain mt-auto" />
            </motion.div>

            {/* Card 3 */}
            <motion.div whileHover={{ y: -5 }} className="bg-white rounded-[2rem] overflow-hidden border border-slate-100 shadow-sm flex flex-col items-center pt-10 px-6 gap-8 text-center">
              <div className="space-y-3 w-full">
                <span className="inline-block text-[#ff5722] font-black text-xs bg-[#ff5722]/10 px-3 py-1 rounded-full mb-2">{t('mgmt_badge')}</span>
                <h3 className="text-2xl font-black text-[#2e315e]">{t('mgmt_badge')}</h3>
                <p className="text-slate-500 text-sm font-bold leading-relaxed max-w-sm mx-auto">
                  {t('mgmt_desc')}
                </p>
              </div>
              <img src="/home page silacod copy/images/cards-3.webp" alt="Orders" className="w-[85%] max-w-[400px] h-auto object-contain mt-auto" />
            </motion.div>

            {/* Card 4 */}
            <motion.div whileHover={{ y: -5 }} className="bg-white rounded-[2rem] overflow-hidden border border-slate-100 shadow-sm flex flex-col items-center pt-10 px-6 gap-8 text-center">
              <div className="space-y-3 w-full">
                <span className="inline-block text-[#ff5722] font-black text-xs bg-[#ff5722]/10 px-3 py-1 rounded-full mb-2">{t('profits_badge')}</span>
                <h3 className="text-2xl font-black text-[#2e315e]">{t('profits_badge')}</h3>
                <p className="text-slate-500 text-sm font-bold leading-relaxed max-w-sm mx-auto">
                  {t('profits_desc')}
                </p>
              </div>
              <img src="/home page silacod copy/images/s2.webp" alt="Profits" className="w-[85%] max-w-[400px] h-auto object-contain mt-auto" />
            </motion.div>

          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS (ابدأ تجارتك في 3 خطوات بسيطة) ── */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto space-y-16">
          
          <div className="text-center space-y-4">
            <h2 className="text-3xl sm:text-5xl font-black text-[#2e315e] leading-tight font-['29LT_Kaff',Cairo,sans-serif]">
              {t('three_steps_title')}
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm sm:text-base font-bold">
              {t('three_steps_subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Step 1 */}
            <motion.div whileHover={{ y: -5 }} className="bg-[#fafafc] rounded-[2rem] p-6 text-center shadow-sm border border-slate-100 flex flex-col items-center">
              <div className="w-10 h-10 bg-[#ff5722] text-white rounded-full flex items-center justify-center font-black text-lg mb-4 shadow-md">1</div>
              <h3 className="text-xl font-black text-[#2e315e] mb-3">{t('step1_title')}</h3>
              <p className="text-slate-500 text-sm font-bold leading-relaxed mb-6">
                {t('step1_desc')}
              </p>
              <img src="/home page silacod copy/images/branddd.webp" alt="Select Products" className="w-full h-auto object-contain max-h-[180px] mt-auto rounded-xl" />
            </motion.div>

            {/* Step 2 */}
            <motion.div whileHover={{ y: -5 }} className="bg-[#fafafc] rounded-[2rem] p-6 text-center shadow-sm border border-slate-100 flex flex-col items-center">
              <div className="w-10 h-10 bg-[#ff5722] text-white rounded-full flex items-center justify-center font-black text-lg mb-4 shadow-md">2</div>
              <h3 className="text-xl font-black text-[#2e315e] mb-3">{t('step2_title')}</h3>
              <p className="text-slate-500 text-sm font-bold leading-relaxed mb-6">
                {t('step2_desc')}
              </p>
              <img src="/home page silacod copy/images/www.webp" alt="Marketing" className="w-full h-auto object-contain max-h-[180px] mt-auto rounded-xl" />
            </motion.div>

            {/* Step 3 */}
            <motion.div whileHover={{ y: -5 }} className="bg-[#fafafc] rounded-[2rem] p-6 text-center shadow-sm border border-slate-100 flex flex-col items-center">
              <div className="w-10 h-10 bg-[#ff5722] text-white rounded-full flex items-center justify-center font-black text-lg mb-4 shadow-md">3</div>
              <h3 className="text-xl font-black text-[#2e315e] mb-3">{t('step3_title')}</h3>
              <p className="text-slate-500 text-sm font-bold leading-relaxed mb-6">
                {t('step3_desc')}
              </p>
              <img src="/home page silacod copy/images/Untitled-2.webp" alt="Fulfillment" className="w-full h-auto object-contain max-h-[180px] mt-auto rounded-xl" />
            </motion.div>

          </div>
        </div>
      </section>

      {/* ── TARGET AUDIENCE (لمن هذه المنصة؟) ── */}
      <section className="py-24 bg-white border-b border-slate-100 overflow-hidden">
        <div className="max-w-6xl mx-auto space-y-16 px-4 sm:px-6 lg:px-8">
          
          <div className="text-center space-y-4">
            <h2 className="text-3xl sm:text-5xl font-black text-[#2e315e] leading-tight font-['29LT_Kaff',Cairo,sans-serif]">
              {t('audience_title')}
            </h2>
          </div>

          <div className="space-y-12 pt-8">
            
            {/* Row 1: Sellers */}
            <motion.div whileHover={{ scale: 1.01 }} className="flex flex-col md:flex-row items-center gap-8 bg-[#fff] rounded-[2rem] overflow-hidden border border-slate-100 shadow-sm">
              <div className="flex-1 p-8 md:p-12 text-right">
                <span className="inline-block text-[#ff5722] font-black text-xs bg-[#ff5722]/10 px-3 py-1 rounded-full mb-4">{t('merchants_badge')}</span>
                <h3 className="text-3xl font-black text-[#2e315e] mb-4">{t('sellers_title')}</h3>
                <p className="text-slate-500 font-bold leading-relaxed mb-6">
                  {t('sellers_desc')}
                </p>
                <Link to="/register" className="inline-block py-3 px-8 bg-[#ff5722] hover:bg-[#e64a19] text-white rounded-[12px] text-sm font-black transition-colors shadow-md shadow-[#ff5722]/20">
                  {t('start_business_now')}
                </Link>
              </div>
              <div className="w-full md:w-[45%] h-64 md:h-auto self-stretch">
                <img src="/home page silacod copy/images/Untitled-221.webp" alt="Sellers" className="w-full h-full object-cover" />
              </div>
            </motion.div>

            {/* Row 2: Influencers (Dark Theme, Alternating Layout) */}
            <motion.div whileHover={{ scale: 1.01 }} className="flex flex-col md:flex-row-reverse items-center gap-8 bg-[#1e2142] text-white rounded-[2rem] overflow-hidden shadow-xl shadow-[#1e2142]/10">
              <div className="flex-1 p-8 md:p-12 text-right">
                <span className="inline-block text-[#ff5722] font-black text-xs bg-[#ff5722]/10 px-3 py-1 rounded-full mb-4">{t('creators_badge')}</span>
                <h3 className="text-3xl font-black mb-4">{t('influencers_title')}</h3>
                <p className="text-slate-300 font-bold leading-relaxed mb-6">
                  {t('influencers_desc')}
                </p>
                <Link to="/influencer/register" className="inline-block py-3 px-8 bg-[#ff5722] hover:bg-[#e64a19] text-white rounded-[12px] text-sm font-black transition-colors shadow-lg shadow-[#ff5722]/20">
                  {t('start_influencer')}
                </Link>
              </div>
              <div className="w-full md:w-[45%] h-64 md:h-auto self-stretch relative">
                <div className="absolute inset-0 bg-gradient-to-l from-[#1e2142]/80 to-transparent md:hidden" />
                <img src="/home page silacod copy/images/photo-1622151834677-70f982c9adef.webp" alt="Influencers" className="w-full h-full object-cover object-left" />
              </div>
            </motion.div>

            {/* Row 3: Affiliates */}
            <motion.div whileHover={{ scale: 1.01 }} className="flex flex-col md:flex-row items-center gap-8 bg-[#fafafc] rounded-[2rem] overflow-hidden border border-slate-100 shadow-sm">
              <div className="flex-1 p-8 md:p-12 text-right">
                <span className="inline-block text-[#ff5722] font-black text-xs bg-[#ff5722]/10 px-3 py-1 rounded-full mb-4">{t('affiliate_badge')}</span>
                <h3 className="text-3xl font-black text-[#2e315e] mb-4">{t('affiliates_title')}</h3>
                <p className="text-slate-500 font-bold leading-relaxed mb-6">
                  {t('affiliates_desc')}
                </p>
                <Link to="/register" className="inline-block py-3 px-8 bg-[#ff5722] hover:bg-[#e64a19] text-white rounded-[12px] text-sm font-black transition-colors shadow-md shadow-[#ff5722]/20">
                  {t('start_affiliate')}
                </Link>
              </div>
              <div className="w-full md:w-[45%] h-64 md:h-auto self-stretch">
                <img src="/home page silacod copy/images/handsome-stylish-bearded-guy-posing-against-white-wall.webp" alt="Affiliates" className="w-full h-full object-cover" />
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ── MARKETPLACE SMARTWATCH SHOWCASE (اكتشف منتجات جاهزة للبيع والربح) ── */}
      <section id="marketplace" className="py-24 px-4 sm:px-6 lg:px-8 bg-white relative">
        <div className="max-w-7xl mx-auto space-y-16">
          
          <div className="text-center space-y-4">
            <span className="text-primary-600 font-bold tracking-widest uppercase text-xs bg-primary-50 px-4 py-2 rounded-full border border-primary-100">
              {t('catalog_badge')}
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 leading-tight">
              {t('discover_products_title')}
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm sm:text-base">
              {t('discover_products_desc')}
            </p>
          </div>

          {/* Carousel Showcase Slider */}
          <div 
            className="relative group"
            onMouseEnter={() => setIsAutoScrolling(false)}
            onMouseLeave={() => setIsAutoScrolling(true)}
          >
            {/* Arrows */}
            {!loadingProducts && products.length > 0 && (
              <>
                <button 
                  onClick={() => scrollSlider('right')}
                  className="hidden md:flex absolute top-1/2 -right-4 md:-right-6 z-10 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-slate-100 items-center justify-center text-slate-700 hover:text-[#ff5722] hover:scale-110 transition-all active:scale-95 opacity-0 group-hover:opacity-100"
                >
                  <ChevronRight size={24} />
                </button>
                <button 
                  onClick={() => scrollSlider('left')}
                  className="hidden md:flex absolute top-1/2 -left-4 md:-left-6 z-10 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-slate-100 items-center justify-center text-slate-700 hover:text-[#ff5722] hover:scale-110 transition-all active:scale-95 opacity-0 group-hover:opacity-100"
                >
                  <ChevronLeft size={24} />
                </button>
              </>
            )}

            <div 
              ref={sliderRef}
              className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-8 pt-4 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4 sm:mx-0 sm:px-0"
            >
            {loadingProducts ? (
              <div className="w-full flex flex-col items-center justify-center py-16 space-y-4">
                <RefreshCw className="animate-spin text-[#ff5722]" size={36} />
                <p className="text-slate-400 text-sm font-semibold">{t('loading_products')}</p>
              </div>
            ) : products.length === 0 ? (
              <div className="w-full text-center py-16">
                <p className="text-slate-400 text-sm font-semibold">{t('no_products_found')}</p>
              </div>
            ) : (
              products.map((prod, idx) => {
                const profit = prod.retailPriceMad - prod.baseCostMad;
                const productImage = prod.images && prod.images.length > 0
                  ? (prod.images[0].imageUrl.startsWith('http') ? prod.images[0].imageUrl : `${BACKEND_URL}${prod.images[0].imageUrl}`)
                  : "/placeholder.png";
                
                const categoryName = prod.categories?.[0]?.nameAr || prod.categories?.[0]?.nameFr || "منتج عام";
                const rating = 4.8 + (prod.id % 3) * 0.1; // stable attractive mock rating
                
                const tag = prod.visibility?.includes('AFFILIATE') 
                  ? t('best_seller_fire') 
                  : prod.visibility?.includes('INFLUENCER') 
                  ? t('best_seller_fire') 
                  : t('best_seller_fire');

                return (
                  <motion.div
                    key={prod.id || idx}
                    whileHover={{ y: -6 }}
                    className="shrink-0 w-[85vw] sm:w-[320px] snap-center bg-slate-50 border border-slate-100 hover:border-slate-200 rounded-[2.5rem] p-6 text-right flex flex-col justify-between shadow-sm relative overflow-hidden transition-all duration-300"
                  >
                    <div className="absolute top-4 left-4 z-10">
                      <span className="px-3 py-1.5 bg-[#2e315e] text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-md">
                        {tag}
                      </span>
                    </div>

                    <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center">
                      <img src={productImage} alt={prod.nameAr || prod.nameFr} className="object-cover w-full h-full hover:scale-105 transition-transform duration-300" />
                    </div>

                    <div className="space-y-4 mt-6">
                      <div>
                        <h3 className="text-base font-black text-slate-950 mt-1 leading-tight" dir="auto">
                          {prod.nameAr || prod.nameFr}
                        </h3>
                        {prod.nameFr && prod.nameAr && prod.nameFr !== prod.nameAr && (
                          <p className="text-[10px] text-slate-500 font-bold mt-1 tracking-wide" dir="auto">
                            {prod.nameFr}
                          </p>
                        )}
                        {prod.description && (
                          <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed" dir="auto">
                            {prod.description}
                          </p>
                        )}
                      </div>

                      <div className="py-4 border-t border-slate-150/60 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('retail_price')}</span>
                        <span className="font-mono text-slate-900 font-black text-2xl">{prod.retailPriceMad} Dh</span>
                      </div>
                    </div>

                    <Link to="/register" className="mt-5 block text-center py-3 bg-[#ff5722] hover:bg-[#e04a1b] text-white rounded-xl text-xs font-bold active:scale-[0.98] transition-all">
                      {t('order_now')}
                    </Link>
                  </motion.div>
                );
              })
            )}
          </div>
          </div>



        </div>
      </section>

      {/* ── FOR SUPPLIERS (للموردين: حوّل مخزونك إلى مبيعات مستمرة) ── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-100 font-['29LT_Kaff',Cairo,sans-serif]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12 text-right">
          
          {/* Visual (Left) */}
          <div className="w-full md:w-1/2 overflow-hidden rounded-[2.5rem]">
            <img src="/home page silacod copy/images/iStock-173258309.webp" alt="Supplier Logistics Warehousing" className="w-full h-auto object-cover" />
          </div>

          {/* Text details (Right) */}
          <div className="w-full md:w-1/2 space-y-6">
            <span className="inline-block text-[#ff5722] font-black text-xs bg-[#ff5722]/10 px-3 py-1 rounded-full mb-2">{t('local_suppliers_badge')}</span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#2e315e] leading-tight">{t('suppliers_title')}</h2>
            <p className="text-slate-500 font-bold text-sm sm:text-base leading-relaxed max-w-lg">
              {t('suppliers_desc')}
            </p>
            
            <ul className="space-y-3 text-sm font-bold text-slate-700 py-4">
              <li className="flex items-center gap-2 text-[#2e315e]">✓ {t('supplier_benefit1')}</li>
              <li className="flex items-center gap-2 text-[#2e315e]">✓ {t('supplier_benefit2')}</li>
              <li className="flex items-center gap-2 text-[#2e315e]">✓ {t('supplier_benefit3')}</li>
            </ul>

            <a href="mailto:contact@silacod.com" className="inline-block py-3 px-8 bg-[#ff5722] hover:bg-[#e64a19] text-white rounded-[12px] text-sm font-black transition-colors shadow-md shadow-[#ff5722]/20">
              {t('supplier_benefit_cta')}
            </a>
          </div>

        </div>
      </section>

      {/* ── SUCCESS STORIES ── */}
      <SuccessStories />

      {/* ── FAQ SECTION ── */}
      <FAQ />

      {/* ── FOOTER ── */}
      <footer className="bg-white pt-10">
        <div className="w-full bg-gradient-to-br from-[#1a1c3d] to-[#141530] text-white rounded-t-[3rem] shadow-2xl">
          <div className="max-w-7xl mx-auto px-6 py-12 sm:p-16 font-['29LT_Kaff',Cairo,sans-serif]">
            <div className={`grid grid-cols-1 md:grid-cols-5 gap-8 mb-12 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            
            {/* Brand details column */}
            <div className="md:col-span-2 space-y-6">
              <div dir="ltr" className={`flex items-center gap-3 ${language === 'ar' ? 'justify-end' : 'justify-start'}`}>
                <img src="/new logo/logo filess-25.svg" alt="SILACOD" className="w-12 h-12 object-contain brightness-0 invert mt-[-0.5rem]" />
                <img src="/new logo/logo filess-24.svg" alt="SILACOD" className="h-7 object-contain brightness-0 invert" />
              </div>
              <p className={`text-xs sm:text-[13px] text-slate-300 font-bold leading-relaxed max-w-sm ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {t('footer_about_desc')}
              </p>
              
              <div className={`flex flex-wrap items-center gap-3 pt-2 ${language === 'ar' ? 'justify-end' : 'justify-start'}`}>
                <LanguageSwitcherWidget variant="footer" />
                <Link to="/login" className="h-12 px-6 bg-[#2a2d5c] hover:bg-[#343875] text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2 shadow-lg">
                  <LogIn size={18} />
                  {t('login_label')}
                </Link>
                <Link to="/register" className="h-12 px-6 bg-[#ff5722] hover:bg-[#e64a19] text-white rounded-xl text-sm font-bold transition-colors flex items-center shadow-lg shadow-[#ff5722]/20">
                  {t('get_started_free')}
                </Link>
              </div>

              {/* Social Icons Row */}
              <div className={`flex items-center gap-4 pt-2 ${language === 'ar' ? 'justify-end' : 'justify-start'}`}>
                <a href="#" className="w-11 h-11 bg-white text-[#ff5722] rounded-xl flex items-center justify-center hover:scale-110 transition-transform shadow-lg"><Instagram size={22} /></a>
                <a href="#" className="w-11 h-11 bg-white text-[#ff5722] rounded-xl flex items-center justify-center hover:scale-110 transition-transform shadow-lg">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4l11.733 16h4.267l-11.733 -16z" /><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" /></svg>
                </a>
                <a href="#" className="w-11 h-11 bg-white text-[#ff5722] rounded-xl flex items-center justify-center hover:scale-110 transition-transform shadow-lg"><MessageCircle size={22} /></a>
                <a href="#" className="w-11 h-11 bg-white text-[#ff5722] rounded-xl flex items-center justify-center hover:scale-110 transition-transform shadow-lg">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
                </a>
              </div>
            </div>

            {/* Links 1: Platform */}
            <div className="space-y-6">
              <h4 className="text-lg font-black text-white whitespace-nowrap">{t('footer_platform_header')}</h4>
              <div className="space-y-4 text-sm text-slate-300 font-bold">
                <Link to="/" className="block hover:text-[#ff5722] transition-colors">{t('home_label')}</Link>
                <a href="#how-it-works" className="block hover:text-[#ff5722] transition-colors">{t('how_it_works_label')}</a>
                <a href="#marketplace" className="flex items-center justify-start gap-2 hover:text-[#ff5722] transition-colors">
                  {t('products_label')}
                  <span className="bg-[#ff5722] text-white text-[9px] px-2 py-0.5 rounded-full">{t('new_badge')}</span>
                </a>
                <Link to="/pricing" className="block hover:text-[#ff5722] transition-colors">{t('pricing_label')}</Link>
                <a href="#success-stories" className="block hover:text-[#ff5722] transition-colors">{t('success_stories_label')}</a>
              </div>
            </div>

            {/* Links 2: Start Now */}
            <div className="space-y-6">
              <h4 className="text-lg font-black text-white whitespace-nowrap">{t('start_now')}</h4>
              <div className="space-y-4 text-sm text-slate-300 font-bold">
                <Link to="/register" className="block hover:text-[#ff5722] transition-colors">{t('sellers_label')}</Link>
                <Link to="/influencer/register" className="flex items-center justify-start gap-2 hover:text-[#ff5722] transition-colors">
                  {t('influencers_label')}
                  <span className="bg-[#ff5722] text-white text-[9px] px-2 py-0.5 rounded-full">{t('new_badge')}</span>
                </Link>
                <Link to="/register" className="block hover:text-[#ff5722] transition-colors">{t('affiliates_label')}</Link>
                <Link to="/register" className="block hover:text-[#ff5722] transition-colors">{t('create_account_label')}</Link>
              </div>
            </div>

            {/* Links 3: About SILACOD */}
            <div className="space-y-6">
              <h4 className="text-lg font-black text-white whitespace-nowrap">{t('about_silacod_header')}</h4>
              <div className="space-y-4 text-sm text-slate-300 font-bold">
                <Link to="/about" className="block hover:text-[#ff5722] transition-colors whitespace-nowrap">{t('who_we_are_label')}</Link>
                <Link to="/contact" className="block hover:text-[#ff5722] transition-colors whitespace-nowrap">{t('contact_us_label')}</Link>
                <Link to="/blog" className="block hover:text-[#ff5722] transition-colors">{t('blog_label')}</Link>
                <Link to="/careers" className="block hover:text-[#ff5722] transition-colors">{t('careers_label')}</Link>
              </div>
            </div>
            
          </div>

          <div className="pt-8 border-t border-slate-700/50 flex flex-col lg:flex-row items-center justify-between gap-6 text-sm text-slate-300 font-bold">
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 lg:gap-4 order-3 lg:order-1 whitespace-nowrap">
              <span className="whitespace-nowrap">{t('contact_us_label')}</span>
              <a href="mailto:contact@silacod.com" className="hover:text-white transition-colors whitespace-nowrap">contact@silacod.com</a>
              <a href="tel:+212660517679" className="hover:text-white transition-colors ml-2 whitespace-nowrap" dir="ltr">+212660517679</a>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 order-2">
              <Link to="/privacy" className="hover:text-white transition-colors whitespace-nowrap">{t('privacy_policy_label')}</Link>
              <Link to="/faq" className="hover:text-white transition-colors whitespace-nowrap">{t('faqs_label')}</Link>
              <Link to="/shipping" className="hover:text-white transition-colors whitespace-nowrap">{t('payment_delivery_policy_label')}</Link>
            </div>
            <div className="order-1 lg:order-3 whitespace-nowrap">
              {t('all_rights_reserved')}
            </div>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}

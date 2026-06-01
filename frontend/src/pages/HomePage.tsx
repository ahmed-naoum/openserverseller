import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, Truck, Palette, TrendingUp, Sparkles, ArrowLeft,
  Package, Star, Users, Banknote,
  Crown, Zap, Shield, Globe, ChevronDown, Play, Menu, X,
  Instagram, Youtube, BarChart3, Wallet, Gift, Award, Heart,
  MousePointerClick, Lock, Phone, Box, Check, RefreshCw, CheckCircle2,
  ChevronLeft, ChevronRight, MessageCircle, HelpCircle, LogIn
} from 'lucide-react';
import LiveTicker from '../components/home/LiveTicker';
import ProfitSimulator from '../components/home/ProfitSimulator';
import SuccessStories from '../components/home/SuccessStories';
import FAQ from '../components/home/FAQ';
import { publicApi, BACKEND_URL } from '../lib/api';

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
    <div dir="rtl" className="min-h-screen bg-[#fafafc] selection:bg-primary-100 font-['29LT_Kaff',_Cairo,_Inter,_sans-serif] overflow-x-hidden relative text-right">
      
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
            
            {/* Left side actions (Login, Register) */}
            <div className="hidden lg:flex items-center gap-3 relative z-10">
              {/* Login Button (Dark Blue Square Icon Wrapper) */}
              <Link to="/login" className="w-[42px] h-[42px] bg-[#2e315e] hover:bg-[#1e2142] text-white rounded-[10px] flex items-center justify-center transition-colors">
                <LogIn className="w-[20px] h-[20px]" />
              </Link>

              {/* Solid Orange/Coral Register Button */}
              <Link to="/register" className="rounded-[10px] bg-[#ff5722] hover:bg-[#e64a19] px-6 py-2.5 flex items-center justify-center text-[15px] font-bold text-white transition-all shadow-sm">
                <span className="translate-y-[4px]">إبدأ الآن مجاناً</span>
              </Link>
            </div>

            {/* Center Navigation Links (Absolutely Centered) */}
            <div className="hidden lg:flex absolute inset-0 items-center justify-center pointer-events-none">
              <div className="flex items-center gap-6 text-[15px] font-black text-[#2e315e] pointer-events-auto">
                <a href="#morocco-network" className="hover:text-[#ff5722] transition-colors">تواصل معنا</a>
                <a href="#marketplace" className="hover:text-[#ff5722] transition-colors">متجر المنتجات</a>
                <Link to="/influencer/register" className="hover:text-[#ff5722] transition-colors">المؤثرين</Link>
              </div>
            </div>

            {/* Right side Logo */}
            <div className="flex items-center relative z-10">
              <Link to="/" className="flex items-center gap-2.5 group">
                <img src="/new logo/logo filess-24.svg" alt="SILACOD" className="h-[20px] sm:h-[26px] object-contain" />
                <motion.img whileHover={{ rotateY: 15, scale: 1.05 }} src="/new logo/logo filess-25.svg" alt="SILACOD" className="w-8 h-8 sm:w-10 sm:h-[3rem] origin-center object-contain mt-[-0.5rem]" />
              </Link>
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
              <div className="px-4 py-6 space-y-4 text-right">
                <Link to="/influencer/register" onClick={() => setMobileMenuOpen(false)} className="block font-bold text-[#2e315e] py-2">المؤثرين</Link>
                <a href="#marketplace" onClick={() => setMobileMenuOpen(false)} className="block font-bold text-[#2e315e] py-2">متجر المنتجات</a>
                <a href="#morocco-network" onClick={() => setMobileMenuOpen(false)} className="block font-bold text-[#2e315e] py-2">تواصل معنا</a>
                <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block font-bold text-[#2e315e] py-2">تسجيل الدخول</Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="block w-full text-center bg-[#ff5722] text-white font-bold py-3.5 rounded-xl">
                  <span className="block -translate-y-[1px]">إبدأ الآن مجاناً</span>
                </Link>
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
            <div className="order-last lg:order-first lg:col-span-6 space-y-7 text-right">
              
              {/* Title */}
              <h1 className="text-3xl sm:text-5xl lg:text-[3.25rem] font-black leading-[1.25] tracking-tight text-[#2e315e] font-['29LT_Kaff',Cairo,sans-serif]">
                ابدأ تجارتك الإلكترونية بدون تعقيد...<br />
                ونحن ندير الباقي
              </h1>

              {/* Subtext */}
              <p className="text-slate-600 text-[17px] font-bold leading-[1.8] max-w-[90%]">
                SILACOD تربطك بالمنتجات، التخزين، التأكيد، التغليف، التوصيل، التتبع، والتحصيل داخل نظام واحد – لتتفرغ أنت للبيع وتحقيق الأرباح.
              </p>

              {/* Subtitle checklist features with custom blue checkmarks */}
              <div className="space-y-4 pt-3">
                <div className="flex flex-col sm:flex-row gap-6 justify-start">
                  {/* First item (visually right in RTL) */}
                  <div className="flex items-center gap-2.5 text-[#2e315e] font-black text-[17px]">
                    <CheckCircle2 strokeWidth={2.5} className="w-[22px] h-[22px] shrink-0" />
                    <span>منتجات جاهزة للبيع</span>
                  </div>
                  {/* Second item (visually left in RTL) */}
                  <div className="flex items-center gap-2.5 text-[#2e315e] font-black text-[17px]">
                    <CheckCircle2 strokeWidth={2.5} className="w-[22px] h-[22px] shrink-0" />
                    <span>نظام COD وتحويل أرباحك بسهولة</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 text-[#2e315e] font-black text-[17px] justify-start">
                  <CheckCircle2 strokeWidth={2.5} className="w-[22px] h-[22px] shrink-0" />
                  <span>تأكيد وتوصيل في جميع مدن المغرب</span>
                </div>
              </div>

              {/* CTA Buttons - Aligned to the left under text block */}
              <div className="flex flex-col sm:flex-row gap-4 pt-8 justify-end w-full sm:w-[90%]">
                {/* Left button: hollow outline button with dark/blue border */}
                <Link to="/influencer/register" className="w-full sm:w-auto rounded-[12px] border-[1.5px] border-[#2e315e] hover:bg-slate-100 transition-all px-8 py-[14px] flex items-center justify-center gap-2 text-[16px] font-black text-[#2e315e]">
                  <span>إبدأ الآن كمؤثر</span>
                </Link>
                {/* Right button: solid orange/coral color with a white arrow pointing left inside it */}
                <Link to="/register" className="w-full sm:w-auto rounded-[12px] bg-[#ff5722] hover:bg-[#e64a19] transition-all px-8 py-[14px] flex items-center justify-center gap-3 text-[16px] font-black text-white">
                  <span>إبدأ البيع الآن</span>
                  <ArrowLeft size={18} />
                </Link>
              </div>

            </div>

            {/* Left Side: Static Hero Image Block matching screenshot */}
            <div className="order-first lg:order-last lg:col-span-6 relative w-full flex items-center justify-center lg:justify-start mb-8 lg:mb-0">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                className="relative w-full"
              >
                <img
                  src="/home page silacod copy/images/hero.webp"
                  alt="SILACOD Dashboard Preview"
                  className="w-full h-auto object-contain origin-left scale-100 lg:scale-[1.15] lg:-translate-x-[5%]"
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
            <h2 className="text-3xl sm:text-4xl font-black text-[#2e315e]">أرقام تعكس قوة المنصة وثقة المستخدمين</h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-[16px] font-bold">
              آلاف الطلبات، مئات المنتجات، وشبكة متنامية من البائعين والمسوقين يعملون يومياً عبر SILACOD لبناء تجارة إلكترونية أكثر سهولة واحترافية.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-right pt-4">
            
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 bg-[#2e315e] rounded-[14px] flex items-center justify-center shrink-0 shadow-lg shadow-[#2e315e]/20">
                <Globe className="w-7 h-7 text-white" />
              </div>
              <div className="text-center">
                <div className="text-2xl font-black text-[#2e315e] font-mono">100%</div>
                <p className="text-[13px] font-bold text-slate-500 mt-1">تغطية لكافة مدن المغرب</p>
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
                <p className="text-[13px] font-bold text-slate-500 mt-1">طلب يتم شحنه شهرياً</p>
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
                <p className="text-[13px] font-bold text-slate-500 mt-1">بائع نشط بالمنصة</p>
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
                <p className="text-[13px] font-bold text-slate-500 mt-1">منتج جاهز للبيع</p>
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
              لماذا يفشل أغلب الناس في التجارة الإلكترونية؟
            </h2>
            <p className="text-[#2e315e] max-w-xl mx-auto text-sm sm:text-base font-bold">
              بدل تضييع الوقت في إدارة التفاصيل، ركّز على النمو — واترك العمليات علينا
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

              <h3 className="text-2xl sm:text-3xl font-black text-[#ff5722]">العمل مع SILACOD</h3>

              <div className="inline-block text-right">
                <ul className="space-y-4 text-[#2e315e] text-sm font-bold">
                  <li className="flex items-center justify-start gap-3">
                    <span className="w-4 h-4 rounded-full border-[1.5px] border-[#2e315e] text-[#2e315e] flex items-center justify-center text-[9px] font-black shrink-0">✓</span>
                    <span>منتجات جاهزة للبيع داخل المنصة</span>
                  </li>
                  <li className="flex items-center justify-start gap-3">
                    <span className="w-4 h-4 rounded-full border-[1.5px] border-[#2e315e] text-[#2e315e] flex items-center justify-center text-[9px] font-black shrink-0">✓</span>
                    <span>صفحات هبوط جاهزة للبيع فوراً</span>
                  </li>
                  <li className="flex items-center justify-start gap-3">
                    <span className="w-4 h-4 rounded-full border-[1.5px] border-[#2e315e] text-[#2e315e] flex items-center justify-center text-[9px] font-black shrink-0">✓</span>
                    <span>فريق متخصص لتأكيد الطلبات</span>
                  </li>
                  <li className="flex items-center justify-start gap-3">
                    <span className="w-4 h-4 rounded-full border-[1.5px] border-[#2e315e] text-[#2e315e] flex items-center justify-center text-[9px] font-black shrink-0">✓</span>
                    <span>توصيل وتحصيل في جميع المدن</span>
                  </li>
                  <li className="flex items-center justify-start gap-3">
                    <span className="w-4 h-4 rounded-full border-[1.5px] border-[#2e315e] text-[#2e315e] flex items-center justify-center text-[9px] font-black shrink-0">✓</span>
                    <span>لوحة تحكم واضحة لتتبع أرباحك</span>
                  </li>
                  <li className="flex items-center justify-start gap-3">
                    <span className="w-4 h-4 rounded-full border-[1.5px] border-[#2e315e] text-[#2e315e] flex items-center justify-center text-[9px] font-black shrink-0">✓</span>
                    <span>تركز فقط على التسويق وتنمية تجارتك</span>
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

              <h3 className="text-2xl sm:text-3xl font-black text-slate-500">العمل لوحدك</h3>

              <div className="inline-block text-right">
                <ul className="space-y-4 text-slate-500 text-sm font-bold">
                  <li className="flex items-center justify-start gap-3">
                    <span className="w-4 h-4 rounded-full border-[1.5px] border-slate-500 text-slate-500 flex items-center justify-center text-[9px] font-black shrink-0">✗</span>
                    <span>تبحث عن منتج بنفسك بدون ضمان النجاح</span>
                  </li>
                  <li className="flex items-center justify-start gap-3">
                    <span className="w-4 h-4 rounded-full border-[1.5px] border-slate-500 text-slate-500 flex items-center justify-center text-[9px] font-black shrink-0">✗</span>
                    <span>تحتاج إنشاء موقع أو صفحة بيع من الصفر</span>
                  </li>
                  <li className="flex items-center justify-start gap-3">
                    <span className="w-4 h-4 rounded-full border-[1.5px] border-slate-500 text-slate-500 flex items-center justify-center text-[9px] font-black shrink-0">✗</span>
                    <span>مشاكل مع شركات التوصيل والإرجاع</span>
                  </li>
                  <li className="flex items-center justify-start gap-3">
                    <span className="w-4 h-4 rounded-full border-[1.5px] border-slate-500 text-slate-500 flex items-center justify-center text-[9px] font-black shrink-0">✗</span>
                    <span>تتعامل مع الزبائن وتأكيد الطلبات</span>
                  </li>
                  <li className="flex items-center justify-start gap-3">
                    <span className="w-4 h-4 rounded-full border-[1.5px] border-slate-500 text-slate-500 flex items-center justify-center text-[9px] font-black shrink-0">✗</span>
                    <span>صعوبة في تتبع الأرباح بدقة</span>
                  </li>
                  <li className="flex items-center justify-start gap-3">
                    <span className="w-4 h-4 rounded-full border-[1.5px] border-slate-500 text-slate-500 flex items-center justify-center text-[9px] font-black shrink-0">✗</span>
                    <span>تضيع وقتك في العمليات بدل التركيز على البيع</span>
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
              كل ما تحتاجه لإدارة تجارتك في نظام واحد
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm sm:text-base font-bold">
              تحكّم في كل تفاصيل تجارتك من مكان واحد، بدون تعقيد أو الحاجة لاستعمال أدوات متعددة.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 md:gap-12">
            
            {/* Card 1 */}
            <motion.div whileHover={{ y: -5 }} className="bg-white rounded-[2rem] overflow-hidden border border-slate-100 shadow-sm flex flex-col items-center pt-10 px-6 gap-8 text-center">
              <div className="space-y-3 w-full">
                <span className="inline-block text-[#ff5722] font-black text-xs bg-[#ff5722]/10 px-3 py-1 rounded-full mb-2">تأكيد الطلبات</span>
                <h3 className="text-2xl font-black text-[#2e315e]">تأكيد احترافي للطلبات</h3>
                <p className="text-slate-500 text-sm font-bold leading-relaxed max-w-sm mx-auto">
                  فريق متكامل لرفع نسب التوصيل وتقليل الإلغاءات. تواصل مباشر مع الزبائن لتأكيد طلباتك بدقة فائقة.
                </p>
              </div>
              <img src="/home page silacod copy/images/call-center-customer-service.webp" alt="Call Center" className="w-[85%] max-w-[400px] h-auto object-cover rounded-t-[1.5rem] mt-auto" />
            </motion.div>

            {/* Card 2 */}
            <motion.div whileHover={{ y: -5 }} className="bg-white rounded-[2rem] overflow-hidden border border-slate-100 shadow-sm flex flex-col items-center pt-10 px-6 gap-8 text-center">
              <div className="space-y-3 w-full">
                <span className="inline-block text-[#ff5722] font-black text-xs bg-[#ff5722]/10 px-3 py-1 rounded-full mb-2">تنوع المنتجات</span>
                <h3 className="text-2xl font-black text-[#2e315e]">منتجات جاهزة للبيع</h3>
                <p className="text-slate-500 text-sm font-bold leading-relaxed max-w-sm mx-auto">
                  تصفح واختر من بين تشكيلة واسعة من المنتجات الرائجة والمختارة بعناية فائقة. ابدأ البيع فوراً بنقرة واحدة.
                </p>
              </div>
              <img src="/home page silacod copy/images/cards-4-1.webp" alt="Products" className="w-[85%] max-w-[400px] h-auto object-contain mt-auto" />
            </motion.div>

            {/* Card 3 */}
            <motion.div whileHover={{ y: -5 }} className="bg-white rounded-[2rem] overflow-hidden border border-slate-100 shadow-sm flex flex-col items-center pt-10 px-6 gap-8 text-center">
              <div className="space-y-3 w-full">
                <span className="inline-block text-[#ff5722] font-black text-xs bg-[#ff5722]/10 px-3 py-1 rounded-full mb-2">إدارة متكاملة</span>
                <h3 className="text-2xl font-black text-[#2e315e]">إدارة ذكية للطلبات</h3>
                <p className="text-slate-500 text-sm font-bold leading-relaxed max-w-sm mx-auto">
                  راقب مسار وحالة شحن طلباتك لحظة بلحظة وبكل سهولة. تحديث فوري وآلي للحالات لتوفير الوقت.
                </p>
              </div>
              <img src="/home page silacod copy/images/cards-3.webp" alt="Orders" className="w-[85%] max-w-[400px] h-auto object-contain mt-auto" />
            </motion.div>

            {/* Card 4 */}
            <motion.div whileHover={{ y: -5 }} className="bg-white rounded-[2rem] overflow-hidden border border-slate-100 shadow-sm flex flex-col items-center pt-10 px-6 gap-8 text-center">
              <div className="space-y-3 w-full">
                <span className="inline-block text-[#ff5722] font-black text-xs bg-[#ff5722]/10 px-3 py-1 rounded-full mb-2">أرباح فورية</span>
                <h3 className="text-2xl font-black text-[#2e315e]">شفافية كاملة للأرباح</h3>
                <p className="text-slate-500 text-sm font-bold leading-relaxed max-w-sm mx-auto">
                  لوحة تحكم ذكية واضحة لعرض أرباحك الصافية الحقيقية وسحب أموالك بكل أمان وسهولة من المنصة.
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
              ابدأ تجارتك في 3 خطوات بسيطة
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm sm:text-base font-bold">
              من اختيار المنتج المناسب إلى توصيل الطلبات واستلام الأرباح نقداً — نوفر لك نظاماً متكاملاً يجعل البيع أسهل.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Step 1 */}
            <motion.div whileHover={{ y: -5 }} className="bg-[#fafafc] rounded-[2rem] p-6 text-center shadow-sm border border-slate-100 flex flex-col items-center">
              <div className="w-10 h-10 bg-[#ff5722] text-white rounded-full flex items-center justify-center font-black text-lg mb-4 shadow-md">1</div>
              <h3 className="text-xl font-black text-[#2e315e] mb-3">اختر منتجات قابلة لبناء براند</h3>
              <p className="text-slate-500 text-sm font-bold leading-relaxed mb-6">
                تصفح الكتالوج واختر من بين منتجات مدروسة ومضمونة الجودة لتسويقها لزبائنك.
              </p>
              <img src="/home page silacod copy/images/branddd.webp" alt="Select Products" className="w-full h-auto object-contain max-h-[180px] mt-auto rounded-xl" />
            </motion.div>

            {/* Step 2 */}
            <motion.div whileHover={{ y: -5 }} className="bg-[#fafafc] rounded-[2rem] p-6 text-center shadow-sm border border-slate-100 flex flex-col items-center">
              <div className="w-10 h-10 bg-[#ff5722] text-white rounded-full flex items-center justify-center font-black text-lg mb-4 shadow-md">2</div>
              <h3 className="text-xl font-black text-[#2e315e] mb-3">ابدأ التسويق واستقبل الطلبات بسهولة</h3>
              <p className="text-slate-500 text-sm font-bold leading-relaxed mb-6">
                سوّق لمنتجاتك عبر منصات السوشيال ميديا وحقق مبيعات سريعة فورية بدون حدود.
              </p>
              <img src="/home page silacod copy/images/www.webp" alt="Marketing" className="w-full h-auto object-contain max-h-[180px] mt-auto rounded-xl" />
            </motion.div>

            {/* Step 3 */}
            <motion.div whileHover={{ y: -5 }} className="bg-[#fafafc] rounded-[2rem] p-6 text-center shadow-sm border border-slate-100 flex flex-col items-center">
              <div className="w-10 h-10 bg-[#ff5722] text-white rounded-full flex items-center justify-center font-black text-lg mb-4 shadow-md">3</div>
              <h3 className="text-xl font-black text-[#2e315e] mb-3">اترك العمليات التشغيلية لـ SILACOD</h3>
              <p className="text-slate-500 text-sm font-bold leading-relaxed mb-6">
                نحن نتكفل بالتأكيد والتغليف والشحن إلى العميل، لنضيف أرباحك الصافية لمحفظتك مباشرة.
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
              لمن هذه المنصة؟
            </h2>
          </div>

          <div className="space-y-12 pt-8">
            
            {/* Row 1: Sellers */}
            <motion.div whileHover={{ scale: 1.01 }} className="flex flex-col md:flex-row items-center gap-8 bg-[#fff] rounded-[2rem] overflow-hidden border border-slate-100 shadow-sm">
              <div className="flex-1 p-8 md:p-12 text-right">
                <span className="inline-block text-[#ff5722] font-black text-xs bg-[#ff5722]/10 px-3 py-1 rounded-full mb-4">التجار والشركات</span>
                <h3 className="text-3xl font-black text-[#2e315e] mb-4">للبائعين والتجار</h3>
                <p className="text-slate-500 font-bold leading-relaxed mb-6">
                  نوفر لك بنية تحتية متكاملة لرقمنة مبيعاتك وتوسيع نطاق تجارتك بدون تكاليف ثابتة أو تعقيدات تشغيلية.
                </p>
                <Link to="/register" className="inline-block py-3 px-8 bg-[#ff5722] hover:bg-[#e64a19] text-white rounded-[12px] text-sm font-black transition-colors shadow-md shadow-[#ff5722]/20">
                  إبدأ تجارتك الآن
                </Link>
              </div>
              <div className="w-full md:w-[45%] h-64 md:h-auto self-stretch">
                <img src="/home page silacod copy/images/Untitled-221.webp" alt="Sellers" className="w-full h-full object-cover" />
              </div>
            </motion.div>

            {/* Row 2: Influencers (Dark Theme, Alternating Layout) */}
            <motion.div whileHover={{ scale: 1.01 }} className="flex flex-col md:flex-row-reverse items-center gap-8 bg-[#1e2142] text-white rounded-[2rem] overflow-hidden shadow-xl shadow-[#1e2142]/10">
              <div className="flex-1 p-8 md:p-12 text-right">
                <span className="inline-block text-[#ff5722] font-black text-xs bg-[#ff5722]/10 px-3 py-1 rounded-full mb-4">صناع المحتوى</span>
                <h3 className="text-3xl font-black mb-4">للمؤثرين وصناع المحتوى</h3>
                <p className="text-slate-300 font-bold leading-relaxed mb-6">
                  حوّل متابعيك إلى أرباح حقيقية. أطلق منتجات خاصة بك أو قم بترويج منتجات جاهزة واحصل على أعلى عمولات في السوق.
                </p>
                <Link to="/influencer/register" className="inline-block py-3 px-8 bg-[#ff5722] hover:bg-[#e64a19] text-white rounded-[12px] text-sm font-black transition-colors shadow-lg shadow-[#ff5722]/20">
                  إبدأ الآن كمؤثر
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
                <span className="inline-block text-[#ff5722] font-black text-xs bg-[#ff5722]/10 px-3 py-1 rounded-full mb-4">التسويق بالعمولة</span>
                <h3 className="text-3xl font-black text-[#2e315e] mb-4">للمسوقين بالعمولة</h3>
                <p className="text-slate-500 font-bold leading-relaxed mb-6">
                  استثمر مهاراتك في التسويق الإلكتروني. اختر من آلاف المنتجات المربحة وسوق لها بأمان مع ضمان تحصيل أرباحك الصافية.
                </p>
                <Link to="/register" className="inline-block py-3 px-8 bg-[#ff5722] hover:bg-[#e64a19] text-white rounded-[12px] text-sm font-black transition-colors shadow-md shadow-[#ff5722]/20">
                  إبدأ كمسوق
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
              كتالوج المنتجات الأكثر مبيعاً
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 leading-tight">
              اكتشف منتجات جاهزة للبيع والربح الفوري
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm sm:text-base">
              منتجات تكنولوجية منتقاة بعناية شديدة ومجربة بالكامل بالسوق المغربي، مع توفير هوامش أرباح ممتازة وصافية.
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
                <p className="text-slate-400 text-sm font-semibold">جاري تحميل المنتجات...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="w-full text-center py-16">
                <p className="text-slate-400 text-sm font-semibold">لم يتم العثور على أي منتجات في الكتالوج حالياً.</p>
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
                  ? 'عمولة ممتازة 💸' 
                  : prod.visibility?.includes('INFLUENCER') 
                  ? 'خاص بالمؤثرين 👑' 
                  : 'الأكثر مبيعا 🔥';

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
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">سعر الجملة</span>
                        <span className="font-mono text-slate-900 font-black text-2xl">{prod.baseCostMad} Dh</span>
                      </div>
                    </div>

                    <Link to="/register" className="mt-5 block text-center py-3 bg-[#ff5722] hover:bg-[#e04a1b] text-white rounded-xl text-xs font-bold active:scale-[0.98] transition-all">
                      أطلب كميتك وابدأ البيع الآن
                    </Link>
                  </motion.div>
                );
              })
            )}
          </div>
          </div>

          {/* Interactive branding engine preview */}
          <div className="bg-gradient-to-br from-slate-900 via-primary-950 to-slate-950 border border-slate-800 rounded-[3rem] p-8 sm:p-12 max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl relative overflow-hidden text-white mt-12">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-primary-500/10 rounded-full blur-[90px] pointer-events-none" />
            
            <div className="text-right space-y-3 relative z-10">
              <span className="px-3 py-1 bg-primary-500/20 border border-primary-500/30 rounded-lg text-[9px] font-black text-primary-400 uppercase tracking-widest">محاكاة علامتك الخاصة</span>
              <h4 className="text-2xl font-black">شاهد علامتك التجارية على المنتجات فوراً!</h4>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-lg">
                قم برفع شعار ماركتك أو اسمك (بصيغة PNG شفافة)، وسيقوم نظامنا بتجربة لصقه وطبعه افتراضياً على علب وزجاجات التجميل والإكسسوارات لتراها فوراً بلمسة احترافية!
              </p>
            </div>

            <div className="flex-shrink-0 flex flex-col sm:flex-row items-center gap-4 relative z-10 w-full sm:w-auto">
              <input
                type="file"
                id="brand-logo-upload"
                className="hidden"
                accept="image/*"
                onChange={handleLogoUpload}
              />
              <label
                htmlFor="brand-logo-upload"
                className="cursor-pointer w-full sm:w-auto text-center px-6 py-4 bg-white text-slate-950 hover:bg-slate-100 transition-all rounded-xl text-xs font-black uppercase tracking-wider shadow-lg active:scale-95"
              >
                {customLogoSelected ? "تغيير الشعار المرفوع" : "ارفع شعارك الافتراضي (.png)"}
              </label>
              {customLogoSelected && (
                <button
                  onClick={() => { setUploadedLogo(null); setCustomLogoSelected(false); }}
                  className="w-full sm:w-auto px-4 py-4 border border-slate-700 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-slate-300"
                >
                  إلغاء
                </button>
              )}
            </div>
          </div>

          {/* Real-time rendering output */}
          {customLogoSelected && uploadedLogo && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-8 bg-white border border-slate-150 rounded-[2.5rem] max-w-lg mx-auto text-center shadow-xl space-y-4"
            >
              <span className="text-xs font-bold text-emerald-600">✓ تم تطبيق الشعار بنجاح على التشكيلة النموذجية!</span>
              <div className="relative aspect-video max-w-xs mx-auto rounded-xl overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center p-4">
                <img src="/home page silacod copy/images/branddd.webp" alt="Cosmetic Base" className="object-cover h-full opacity-90" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-white/90 backdrop-blur-sm border border-slate-200 p-2.5 rounded-lg shadow-xl text-center max-w-[120px] transform -rotate-3 animate-pulse">
                    <img src={uploadedLogo} alt="Custom Logo" className="h-6 mx-auto object-contain brightness-0" />
                    <span className="text-[7px] font-black uppercase text-slate-800 tracking-wider block mt-1">BRANDED BY SILACOD</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

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
            <span className="inline-block text-[#ff5722] font-black text-xs bg-[#ff5722]/10 px-3 py-1 rounded-full mb-2">للموردين المحليين</span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#2e315e] leading-tight">للموردين: حوّل مخزونك الساكن إلى مبيعات مستمرة</h2>
            <p className="text-slate-500 font-bold text-sm sm:text-base leading-relaxed max-w-lg">
              هل أنت مورد ولديك سلع أو مخزون بالمغرب؟ اعرض منتجاتك الآن داخل منصة SILACOD وامنح لآلاف البائعين والمسوقين النشطين إمكانية بيع وتصريف بضاعتك فوراً وبدون تكاليف تسويقية.
            </p>
            
            <ul className="space-y-3 text-sm font-bold text-slate-700 py-4">
              <li className="flex items-center gap-2 text-[#2e315e]">✓ عرض منتجاتك بماركت بليس ضخم</li>
              <li className="flex items-center gap-2 text-[#2e315e]">✓ تصريف فوري وأسرع للمخازن</li>
              <li className="flex items-center gap-2 text-[#2e315e]">✓ ضمان التوصيل وتوفير الطلب النهائي</li>
            </ul>

            <a href="mailto:contact@silacod.com" className="inline-block py-3 px-8 bg-[#ff5722] hover:bg-[#e64a19] text-white rounded-[12px] text-sm font-black transition-colors shadow-md shadow-[#ff5722]/20">
              تواصل معنا الآن للإنضمام كمورد
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
            <div className="grid grid-cols-1 md:grid-cols-5 gap-12 mb-12 text-right">
            
            {/* Right side: Brand details & CTA */}
            <div className="md:col-span-2 space-y-8">
              <div className="flex items-center justify-start gap-3">
                <img src="/new logo/logo filess-24.svg" alt="SILACOD" className="h-7 object-contain brightness-0 invert" />
                <img src="/new logo/logo filess-25.svg" alt="SILACOD" className="w-12 h-12 object-contain brightness-0 invert mt-[-0.5rem]" />
              </div>
              <p className="text-xs sm:text-[13px] text-slate-300 font-bold leading-relaxed max-w-sm">
                SILACOD هي منصة متكاملة للتجارة الإلكترونية واللوجستيك في المغرب، تربط بين البائعين، المؤثرين، والمسوقين بالعمولة داخل نظام واحد.
                نوفر لك كل ما تحتاجه لبدء وتنمية تجارتك: منتجات جاهزة، إدارة الطلبات، تأكيد احترافي، توصيل، وتحصيل — لتتفرغ أنت للبيع وتحقيق الأرباح.
              </p>
              
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button className="h-12 px-4 rounded-xl bg-white text-slate-900 flex items-center justify-center hover:bg-slate-100 transition-colors gap-2 font-black text-sm">
                  <Globe size={18} />
                  <span>ع</span>
                </button>
                <Link to="/login" className="h-12 px-6 bg-[#2a2d5c] hover:bg-[#343875] text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2 shadow-lg">
                  <LogIn size={18} />
                  تسجيل الدخول
                </Link>
                <Link to="/register" className="h-12 px-6 bg-[#ff5722] hover:bg-[#e64a19] text-white rounded-xl text-sm font-bold transition-colors flex items-center shadow-lg shadow-[#ff5722]/20">
                  إبدأ الآن مجانا
                </Link>
              </div>
            </div>

            {/* Links 1: المنصة */}
            <div className="space-y-6">
              <h4 className="text-lg font-black text-white">المنصة</h4>
              <div className="space-y-4 text-sm text-slate-300 font-bold">
                <Link to="/" className="block hover:text-[#ff5722] transition-colors">الرئيسية</Link>
                <a href="#how-it-works" className="block hover:text-[#ff5722] transition-colors">كيف تعمل</a>
                <a href="#marketplace" className="flex items-center justify-start gap-2 hover:text-[#ff5722] transition-colors">
                  المنتجات
                  <span className="bg-[#ff5722] text-white text-[9px] px-2 py-0.5 rounded-full">جديد</span>
                </a>
                <Link to="/pricing" className="block hover:text-[#ff5722] transition-colors">الأسعار</Link>
                <Link to="/success-stories" className="block hover:text-[#ff5722] transition-colors">قصص النجاح</Link>
              </div>
            </div>

            {/* Links 2: ابدأ الآن */}
            <div className="space-y-6">
              <h4 className="text-lg font-black text-white">ابدأ الآن</h4>
              <div className="space-y-4 text-sm text-slate-300 font-bold">
                <Link to="/register" className="block hover:text-[#ff5722] transition-colors">للبائعين</Link>
                <Link to="/influencer/register" className="flex items-center justify-start gap-2 hover:text-[#ff5722] transition-colors">
                  للمؤثرين
                  <span className="bg-[#ff5722] text-white text-[9px] px-2 py-0.5 rounded-full">جديد</span>
                </Link>
                <Link to="/register" className="block hover:text-[#ff5722] transition-colors">للمسوقين بالعمولة</Link>
                <Link to="/register" className="block hover:text-[#ff5722] transition-colors">إنشاء حساب</Link>
              </div>
            </div>

            {/* Links 3: عن SILACOD & Social */}
            <div className="flex flex-col sm:flex-row justify-between gap-6 sm:pr-4">
              <div className="space-y-6">
                <h4 className="text-lg font-black text-white">عن SILACOD</h4>
                <div className="space-y-4 text-sm text-slate-300 font-bold">
                  <Link to="/about" className="block hover:text-[#ff5722] transition-colors">من نحن</Link>
                  <a href="mailto:contact@silacod.com" className="block hover:text-[#ff5722] transition-colors">تواصل معنا</a>
                  <Link to="/blog" className="block hover:text-[#ff5722] transition-colors">المدونة</Link>
                  <Link to="/careers" className="block hover:text-[#ff5722] transition-colors">الوظائف</Link>
                </div>
              </div>
              
              {/* Social Icons Stack */}
              <div className="flex sm:flex-col items-center justify-start gap-4 pt-2">
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
            
          </div>

          <div className="pt-8 border-t border-slate-700/50 flex flex-col lg:flex-row items-center justify-between gap-6 text-sm text-slate-300 font-bold">
            <div className="flex items-center gap-2 order-3 lg:order-1">
              <span>تواصل معنا</span>
              <a href="mailto:contact@silacod.com" className="hover:text-white transition-colors">contact@silacod.com</a>
              <span dir="ltr" className="ml-2">+212 XXX XXX XXX</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 order-2">
              <Link to="/privacy" className="hover:text-white transition-colors">سياسة الخصوصية</Link>
              <Link to="/faq" className="hover:text-white transition-colors">الأسئلة الشائعة</Link>
              <Link to="/shipping" className="hover:text-white transition-colors">سياسة الدفع والتوصيل</Link>
            </div>
            <div className="order-1 lg:order-3">
              © 2026 SILACOD — جميع الحقوق محفوظة
            </div>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}

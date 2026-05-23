import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, Truck, Palette, TrendingUp, Sparkles, ArrowLeft,
  Package, Star, Users, Banknote,
  Crown, Zap, Shield, Globe, ChevronDown, Play, Menu, X,
  Instagram, Youtube, BarChart3, Wallet, Gift, Award, Heart,
  MousePointerClick, Lock, Phone, Box, Check, RefreshCw, CheckCircle2,
  ChevronLeft, ChevronRight, MessageCircle, HelpCircle
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

  const smartwatchProducts = [
    {
      name: "ساعة ذكية الترا - فضي",
      category: "أكسيسوارات تقنية",
      rating: 5.0,
      costPrice: "129 Dh",
      sellPrice: "349 Dh",
      profit: "120 Dh",
      image: "/home page silacod copy/images/Untitled-221.png",
      tag: "ربح مرتفع 🔥"
    },
    {
      name: "ساعة ذكية رياضية - أسود",
      category: "أكسيسوارات تقنية",
      rating: 4.9,
      costPrice: "129 Dh",
      sellPrice: "349 Dh",
      profit: "120 Dh",
      image: "/home page silacod copy/images/Untitled-3.png",
      tag: "جديد ✨"
    },
    {
      name: "ساعة ذكية فخمة - ذهبي",
      category: "أكسيسوارات تقنية",
      rating: 5.0,
      costPrice: "129 Dh",
      sellPrice: "349 Dh",
      profit: "120 Dh",
      image: "/home page silacod copy/images/Untitled-5000.png",
      tag: "الأكثر مبيعاً 👑"
    },
    {
      name: "ساعة ذكية الترا بلوس - رمادي",
      category: "أكسيسوارات تقنية",
      rating: 4.8,
      costPrice: "129 Dh",
      sellPrice: "349 Dh",
      profit: "120 Dh",
      image: "/home page silacod copy/images/Untitled-5111.png",
      tag: "موصى به 👍"
    }
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50/30 selection:bg-primary-100 font-['29LT_Kaff',_Cairo,_Inter,_sans-serif] overflow-x-hidden relative text-right">
      
      {/* ── Navbar ── */}
      <motion.nav
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-xl shadow-lg shadow-slate-100/50 border-b border-slate-100/80' : 'bg-transparent'}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <Link to="/" className="flex items-center gap-3 group">
              <motion.img whileHover={{ rotateY: 15, scale: 1.05 }} src="/new logo/logo filess-25.svg" alt="SILACOD" className="w-11 h-11 origin-center object-contain" />
              <img src="/new logo/logo filess-24.svg" alt="SILACOD" className="h-9 hidden sm:block object-contain" />
            </Link>

            <div className="hidden lg:flex items-center gap-8 text-sm font-bold text-slate-600">
              <a href="#how-it-works" className="hover:text-primary-600 transition-colors">كيف نعمل؟</a>
              <a href="#features" className="hover:text-primary-600 transition-colors">كل الميزات</a>
              <a href="#marketplace" className="hover:text-primary-600 transition-colors flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-primary-500" /> متجر المنتجات
              </a>
              <a href="#morocco-network" className="hover:text-primary-600 transition-colors flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-emerald-500" /> التوصيل والتحصيل
              </a>
              <a href="#faq" className="hover:text-primary-600 transition-colors">الأسئلة الشائعة</a>
            </div>

            <div className="hidden lg:flex items-center gap-4">
              <Link to="/login" className="text-sm font-bold text-slate-700 hover:text-primary-600 transition-colors px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50">
                تسجيل الدخول
              </Link>
              <Link to="/register" className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 px-6 py-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-primary-600/20 active:scale-[0.98] transition-all">
                <Sparkles size={14} className="animate-pulse text-amber-300" />
                <span>إبدأ الآن مجاناً</span>
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
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
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden bg-white border-t border-slate-100 shadow-xl"
            >
              <div className="px-4 py-6 space-y-4">
                <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block font-bold text-slate-700 py-2">كيف نعمل؟</a>
                <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block font-bold text-slate-700 py-2">كل الميزات</a>
                <a href="#marketplace" onClick={() => setMobileMenuOpen(false)} className="block font-bold text-slate-700 py-2">متجر المنتجات</a>
                <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block font-bold text-slate-700 py-2">تسجيل الدخول</Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="block w-full text-center bg-primary-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary-600/10">
                  إبدأ الآن مجاناً
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      <LiveTicker />

      {/* ── HERO SECTION (ابدأ تجارتك الإلكترونية بدون تعقيد) ── */}
      <section className="relative pt-28 pb-20 lg:pt-36 lg:pb-32 px-4 sm:px-6 lg:px-8 overflow-hidden min-h-[92vh] flex items-center bg-white">
        
        {/* Glowing backgrounds */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-primary-50/10 pointer-events-none" />
        <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-primary-300/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-accent-300/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10 w-full">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* Right Side: Arabic Title and Text */}
            <div className="lg:col-span-6 space-y-8 text-right">
              
              {/* Badge */}
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-50 border border-slate-150 shadow-sm text-xs font-black text-slate-800">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span>🇲🇦 المنصة رقم 1 للتجارة الإلكترونية واللوجستيك في المغرب</span>
              </div>

              {/* Title */}
              <h1 className="text-4xl sm:text-5xl lg:text-[3.8rem] font-black leading-[1.15] tracking-tight text-slate-900 font-['29LT_Kaff',Cairo,sans-serif]">
                ابدأ تجارتك الإلكترونية <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 via-primary-500 to-accent-500">
                  بدون تعقيد وبأقل مخاطرة
                </span> <br />
                ركّز على البيع… ونحن ندير الباقي
              </h1>

              {/* Subtext */}
              <p className="text-slate-500 text-base sm:text-lg leading-relaxed max-w-xl">
                SILACOD تربطك بالمنتجات، التخزين، التأكيد، التغليف، التوصيل، التتبع، والتحصيل داخل نظام واحد — لتتفرغ أنت للبيع وتحقيق الأرباح.
              </p>

              {/* Statistics & Features List */}
              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">منتجات جاهزة للبيع</div>
                  <div className="text-lg font-black text-primary-600 font-mono">500+ منتج</div>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">تأكيد وتوصيل</div>
                  <div className="text-lg font-black text-emerald-600">كل مدن المغرب</div>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">نظام COD آمن</div>
                  <div className="text-lg font-black text-slate-800">تحصيل أرباحك</div>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link to="/register" className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 transition-all shadow-xl shadow-primary-500/20 px-8 py-4.5 flex items-center justify-center gap-2.5 text-sm font-bold text-white">
                  <Sparkles size={14} className="animate-pulse text-amber-300" />
                  <span>إبدأ البيع الآن</span>
                  <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                </Link>
                <Link to="/influencer/register" className="rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100 transition-all px-8 py-4.5 flex items-center justify-center gap-2 text-sm font-bold text-slate-700">
                  <Crown size={14} className="text-amber-500 animate-bounce" />
                  <span>إبدأ الآن كمؤثر</span>
                </Link>
              </div>

            </div>

            {/* Left Side: Animated Hero Image Block */}
            <div className="lg:col-span-6 relative w-full flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                className="relative w-full max-w-lg"
              >
                {/* Floating graphic container */}
                <div className="bg-slate-100/40 backdrop-blur-md border border-white/80 rounded-[3rem] p-4 shadow-2xl relative overflow-hidden">
                  <img
                    src="/home page silacod copy/images/hero.png"
                    alt="SILACOD Dashboard Preview"
                    className="w-full h-auto rounded-[2.5rem] object-cover shadow-inner hover:scale-[1.02] transition-all duration-500"
                  />
                  
                  {/* Glowing tag overlay */}
                  <div className="absolute top-8 left-8 bg-slate-900/90 text-white px-4 py-2 rounded-xl text-[10px] font-bold tracking-wider uppercase shadow-xl flex items-center gap-1.5 border border-slate-800">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                    <span>مزامنة مباشرة</span>
                  </div>
                </div>

                {/* Ambient glow underneath */}
                <div className="absolute -bottom-6 -left-6 w-72 h-72 bg-primary-400/10 rounded-full blur-[70px] pointer-events-none z-[-1]" />
              </motion.div>
            </div>

          </div>
        </div>
      </section>

      {/* ── DYNAMIC COUNTER STATISTICS SECTION ── */}
      <section className="py-16 bg-slate-900 text-white relative overflow-hidden font-['29LT_Kaff',Cairo,sans-serif]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.08),transparent)] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-2xl sm:text-4xl font-black">أرقام تعكس قوة المنصة وثقة المستخدمين</h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base">
              آلاف الطلبات، مئات المنتجات، وشبكة متنامية من البائعين والمسوقين يعملون يومياً عبر SILACOD لبناء تجارة إلكترونية أكثر سهولة واحترافية.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center pt-4">
            <div className="space-y-2">
              <div className="text-4xl lg:text-5xl font-black text-primary-400 font-mono">
                <Counter to={500} suffix="+" />
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wide">منتج جاهز للبيع</p>
            </div>
            <div className="space-y-2">
              <div className="text-4xl lg:text-5xl font-black text-emerald-400 font-mono">
                <Counter to={3000} suffix="+" />
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wide">بائع نشط بالمنصة</p>
            </div>
            <div className="space-y-2">
              <div className="text-4xl lg:text-5xl font-black text-amber-400 font-mono">
                <Counter to={68000} suffix="+" />
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wide">طلب يتم شحنه شهرياً</p>
            </div>
            <div className="space-y-2">
              <div className="text-4xl lg:text-5xl font-black text-rose-400">
                100%
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wide">تغطية لكافة مدن المغرب</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── ALONE VS SILACOD (لماذا يفشل أغلب الناس؟) ── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white relative">
        <div className="max-w-7xl mx-auto text-center space-y-16">
          
          <div className="space-y-4">
            <span className="text-primary-600 font-bold tracking-widest uppercase text-xs bg-primary-50 px-4 py-2 rounded-full border border-primary-100">
              المقارنة الذكية
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 leading-tight">
              لماذا يفشل أغلب الناس في التجارة الإلكترونية؟
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm sm:text-base">
              بدل تضييع الوقت في إدارة التفاصيل التشغيلية الصعبة، ركّز فقط على النمو والتسويق — واترك العمليات بالكامل علينا.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-stretch max-w-5xl mx-auto">
            
            {/* Alone card (العمل لوحدك) */}
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-rose-50/30 border border-rose-100 rounded-[2.5rem] p-8 sm:p-10 flex flex-col justify-between text-right relative overflow-hidden"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-rose-100/50 pb-6">
                  <div>
                    <h3 className="text-2xl font-black text-rose-700">العمل لوحدك</h3>
                    <p className="text-xs text-rose-500/80 mt-1">تحديات يومية مستمرة ومعقدة</p>
                  </div>
                  <div className="p-3.5 bg-rose-100/50 text-rose-600 rounded-2xl"><X size={20} /></div>
                </div>

                <div className="my-4 rounded-2xl overflow-hidden shadow-md">
                  <img src="/home page silacod copy/images/Before.png" alt="Struggle Working Alone" className="w-full h-auto object-cover max-h-[180px]" />
                </div>

                <ul className="space-y-3.5 text-slate-600 text-sm">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">✗</span>
                    <span>تبحث عن منتج بنفسك بدون أي ضمان للنجاح في السوق</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">✗</span>
                    <span>تحتاج إنشاء موقع كامل أو صفحة هبوط معقدة من الصفر</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">✗</span>
                    <span>مشاكل لا تنتهي مع شركات التوصيل ونسب إرجاع مرتفعة جداً</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">✗</span>
                    <span>تتعامل مع تأكيد طلبات الزبناء بنفسك عبر الهاتف وتضيع وقتك</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">✗</span>
                    <span>صعوبة بالغة في تتبع وحساب أرباحك الصافية بدقة وبدون أخطاء</span>
                  </li>
                </ul>
              </div>

              <div className="pt-8 text-center text-xs font-bold text-rose-600">تضييع كبير للوقت والجهد والميزانية</div>
            </motion.div>

            {/* With Silacod card (العمل مع SILACOD) */}
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-emerald-50/20 border-2 border-emerald-500/30 rounded-[2.5rem] p-8 sm:p-10 flex flex-col justify-between text-right relative overflow-hidden shadow-xl shadow-emerald-500/5"
            >
              <div className="absolute top-0 right-12 left-12 h-[3px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
              
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-emerald-100/50 pb-6">
                  <div>
                    <h3 className="text-2xl font-black text-emerald-700 flex items-center gap-1.5">
                      العمل مع SILACOD
                      <Sparkles size={16} className="text-amber-500 animate-pulse" />
                    </h3>
                    <p className="text-xs text-emerald-600 font-bold mt-1">نظام متكامل يضمن لك النجاح والحرية</p>
                  </div>
                  <div className="p-3.5 bg-emerald-100/50 text-emerald-600 rounded-2xl"><Check size={20} /></div>
                </div>

                <div className="my-4 rounded-2xl overflow-hidden shadow-md">
                  <img src="/home page silacod copy/images/After.png" alt="Success with Silacod" className="w-full h-auto object-cover max-h-[180px]" />
                </div>

                <ul className="space-y-3.5 text-slate-700 text-sm">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">✓</span>
                    <span className="font-bold text-slate-800">منتجات جاهزة للبيع بنقرة واحدة داخل المنصة</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">✓</span>
                    <span className="font-bold text-slate-800">صفحات هبوط احترافية وجاهزة للبيع الفوري</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">✓</span>
                    <span className="font-bold text-slate-800">فريق مركز اتصال متخصص ومحترف لتأكيد كل طلباتك</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">✓</span>
                    <span className="font-bold text-slate-800">توصيل سريع وتحصيل أموال في جميع مدن المغرب</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">✓</span>
                    <span className="font-bold text-slate-800">لوحة تحكم ذكية وواضحة جداً لتتبع نمو أرباحك</span>
                  </li>
                </ul>
              </div>

              <div className="pt-8 text-center text-xs font-bold text-emerald-600">تتفرغ بالكامل للتسويق وتحقيق الأرباح الصافية</div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ── ALL IN ONE SYSTEM (كل ما تحتاجه في نظام واحد) ── */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-50/50 border-y border-slate-100/80">
        <div className="max-w-7xl mx-auto space-y-16">
          
          <div className="text-center space-y-4">
            <span className="text-primary-600 font-bold tracking-widest uppercase text-xs bg-primary-50 px-4 py-2 rounded-full border border-primary-100">
              ميزات النظام
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 leading-tight">
              كل ما تحتاجه لإدارة تجارتك في نظام واحد
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm sm:text-base">
              تحكّم في كل تفاصيل تجارتك من مكان واحد، بدون تعقيد أو الحاجة لاستعمال أدوات متعددة.
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-12 items-center">
            
            {/* Tabs List (Right Side) */}
            <div className="lg:col-span-4 space-y-3">
              {[
                { id: 'confirmation', title: 'تأكيد احترافي للطلبات', subtitle: 'فريق يرفع نسبة نجاح طلبياتك', icon: <Phone size={18} /> },
                { id: 'tracking', title: 'تتبع الشحن المستمر', subtitle: 'راقب حالة الشحن في كل مرحلة', icon: <RefreshCw size={18} /> },
                { id: 'products', title: 'منتجات جاهزة للبيع', subtitle: 'تصفح واختر منتجك بنقرة واحدة', icon: <Package size={18} /> },
                { id: 'profits', title: 'شفافية كاملة للأرباح', subtitle: 'أرباحك واضحة ومحدثة فوراً', icon: <Wallet size={18} /> },
                { id: 'orders', title: 'إدارة ذكية للطلبات', subtitle: 'تحكم في مسار طلباتك بنظام ذكي', icon: <CheckCircle2 size={18} /> }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full text-right p-5 rounded-2xl border transition-all duration-300 flex items-center gap-4 ${
                    activeTab === tab.id
                      ? 'bg-white border-primary-500 shadow-md shadow-slate-100'
                      : 'bg-transparent border-transparent hover:bg-slate-100/50'
                  }`}
                >
                  <div className={`p-3 rounded-xl ${activeTab === tab.id ? 'bg-primary-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {tab.icon}
                  </div>
                  <div>
                    <h4 className={`text-base font-black ${activeTab === tab.id ? 'text-slate-900' : 'text-slate-700'}`}>{tab.title}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{tab.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Tab Graphic View (Left Side) */}
            <div className="lg:col-span-8 bg-white border border-slate-100 rounded-[3rem] p-8 sm:p-10 shadow-2xl relative min-h-[440px] flex flex-col justify-between">
              
              <AnimatePresence mode="wait">
                {activeTab === 'confirmation' && (
                  <motion.div
                    key="confirmation"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6 flex flex-col md:flex-row gap-8 items-center h-full"
                  >
                    <div className="flex-1 space-y-4">
                      <span className="px-3 py-1 bg-primary-50 border border-primary-100 rounded-lg text-[9px] font-black text-primary-600 uppercase tracking-widest">تأكيد الاتصال هاتفياً</span>
                      <h3 className="text-2xl font-black text-slate-950">فريق متكامل لرفع نسب التوصيل وتقليل الإلغاءات</h3>
                      <p className="text-slate-500 text-sm leading-relaxed">
                        يتولى مركز الاتصال المتخصص لدينا التواصل المباشر والسريع مع الزبائن فور إدخال الطلب لتأكيد العنوان والمعلومات، مما يضمن رفع نسب تسليم طلباتك إلى أقصى حد وتفادي المرتجعات.
                      </p>
                    </div>
                    <div className="w-full md:w-72 overflow-hidden rounded-2xl shadow-lg border border-slate-100 shrink-0">
                      <img src="/home page silacod copy/images/Untitled-2.png" alt="Call Center Operations" className="w-full h-auto object-cover max-h-[220px]" />
                    </div>
                  </motion.div>
                )}

                {activeTab === 'tracking' && (
                  <motion.div
                    key="tracking"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6 flex flex-col md:flex-row gap-8 items-center h-full"
                  >
                    <div className="flex-1 space-y-4">
                      <span className="px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-lg text-[9px] font-black text-emerald-600 uppercase tracking-widest">متابعة دقيقة</span>
                      <h3 className="text-2xl font-black text-slate-950">راقب مسار وحالة شحن طلباتك لحظة بلحظة</h3>
                      <p className="text-slate-500 text-sm leading-relaxed">
                        راقب حالة شحن طلباتك في كل مرحلة: قيد المعالجة، مع الموزع، أو تم التوصيل بنجاح. كل التفاصيل والبيانات محدثة ومتاحة فوراً بلوحة التحكم بدون الحاجة للتواصل اليدوي المرهق مع شركات الشحن.
                      </p>
                    </div>
                    <div className="w-full md:w-72 overflow-hidden rounded-2xl shadow-lg border border-slate-100 shrink-0">
                      <img src="/home page silacod copy/images/DM_Macbook Pro Mockup 4.png" alt="Tracking Portal" className="w-full h-auto object-cover max-h-[220px]" />
                    </div>
                  </motion.div>
                )}

                {activeTab === 'products' && (
                  <motion.div
                    key="products"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6 flex flex-col md:flex-row gap-8 items-center h-full"
                  >
                    <div className="flex-1 space-y-4">
                      <span className="px-3 py-1 bg-amber-50 border border-amber-100 rounded-lg text-[9px] font-black text-amber-600 uppercase tracking-widest">تنوع المنتجات</span>
                      <h3 className="text-2xl font-black text-slate-950">كتالوج منتجات واسع مجرب ومربح</h3>
                      <p className="text-slate-500 text-sm leading-relaxed">
                        تصفح واختر من بين تشكيلة واسعة من المنتجات الرائجة والمختارة بعناية فائقة من السوق المحلي المغربي. اعرف سعر المورد وهامش الربح المقترح، وأضف المنتج فوراً لمتجرك وابدأ بيعه مباشرة.
                      </p>
                    </div>
                    <div className="w-full md:w-72 overflow-hidden rounded-2xl shadow-lg border border-slate-100 shrink-0">
                      <img src="/home page silacod copy/images/cards-4-1.png" alt="Marketplace Catalog" className="w-full h-auto object-cover max-h-[220px]" />
                    </div>
                  </motion.div>
                )}

                {activeTab === 'profits' && (
                  <motion.div
                    key="profits"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6 flex flex-col md:flex-row gap-8 items-center h-full"
                  >
                    <div className="flex-1 space-y-4">
                      <span className="px-3 py-1 bg-rose-50 border border-rose-100 rounded-lg text-[9px] font-black text-rose-600 uppercase tracking-widest">أرباح فورية</span>
                      <h3 className="text-2xl font-black text-slate-950">إدارة مالية شفافة جداً لحظة بلحظة</h3>
                      <p className="text-slate-500 text-sm leading-relaxed">
                        اطّلع على رصيد محفظتك، المصاريف اللوجستية، والأرباح الصافية الحقيقية لكل عملية بيع ناجحة. لا وجود لرسوم خفية أو اقتطاعات غير واضحة — كل البيانات تظهر فوراً مع إمكانية سحب سريعة.
                      </p>
                    </div>
                    <div className="w-full md:w-72 overflow-hidden rounded-2xl shadow-lg border border-slate-100 shrink-0">
                      <img src="/home page silacod copy/images/s2.png" alt="Profits Dashboard" className="w-full h-auto object-cover max-h-[220px]" />
                    </div>
                  </motion.div>
                )}

                {activeTab === 'orders' && (
                  <motion.div
                    key="orders"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6 flex flex-col md:flex-row gap-8 items-center h-full"
                  >
                    <div className="flex-1 space-y-4">
                      <span className="px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-[9px] font-black text-indigo-600 uppercase tracking-widest">إدارة متكاملة</span>
                      <h3 className="text-2xl font-black text-slate-950">تحكم كامل في مسار طلبياتك</h3>
                      <p className="text-slate-500 text-sm leading-relaxed">
                        تابع حالة كل طلبية من لحظة إدخالها إلى غاية تسليمها واستلام قيمتها نقداً من العميل. تحكم في تعديل البيانات، إضافة الشروحات للموزع، والتواصل الفوري مع الدعم الفني لحل أي عائق لوجستي.
                      </p>
                    </div>
                    <div className="w-full md:w-72 overflow-hidden rounded-2xl shadow-lg border border-slate-100 shrink-0">
                      <img src="/home page silacod copy/images/hero.png" alt="Orders Portal" className="w-full h-auto object-cover max-h-[220px]" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Status bar */}
              <div className="border-t border-slate-100 pt-4 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase mt-6">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>تحديث البيانات فوري وآمن 100%</span>
                </div>
                <span>SILACOD SYSTEMS</span>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* ── HOW IT WORKS (ابدأ تجارتك في 3 خطوات بسيطة) ── */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto space-y-16">
          
          <div className="text-center space-y-4">
            <span className="text-primary-600 font-bold tracking-widest uppercase text-xs bg-primary-50 px-4 py-2 rounded-full border border-primary-100">
              خطوات العمل
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 leading-tight">
              ابدأ تجارتك في 3 خطوات بسيطة
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm sm:text-base">
              من اختيار المنتج المناسب إلى توصيل الطلبات واستلام الأرباح نقداً — نوفر لك نظاماً متكاملاً يجعل البيع أسهل وأكثر احترافية.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {steps.map((step) => (
              <motion.div
                key={step.n}
                whileHover={{ y: -8 }}
                className="bg-slate-50 border border-slate-100 rounded-[2rem] p-8 text-right flex flex-col justify-between min-h-[260px] shadow-sm hover:shadow-md transition-all duration-300"
              >
                <div className="flex items-center justify-between">
                  <span className="text-4xl font-black text-primary-200 font-mono">{step.n}</span>
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-slate-100 shadow-sm">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary-500" />
                  </div>
                </div>

                <div className="space-y-2.5 mt-6">
                  <h3 className="text-lg font-black text-slate-950">{step.title}</h3>
                  <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Delivery Man Visual Callout */}
          <div className="bg-slate-900 rounded-[3rem] p-8 sm:p-12 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl relative overflow-hidden mt-8">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,rgba(16,185,129,0.1),transparent)] pointer-events-none" />
            
            <div className="space-y-6 flex-1 text-right">
              <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-[9px] font-black text-emerald-400 uppercase tracking-widest">تغطية تشغيلية كاملة</span>
              <h3 className="text-2xl sm:text-3xl font-black">شحن وتوصيل احترافي لجميع مدن المغرب</h3>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-xl">
                بمجرد تأكيد طلب العميل، يتولى فريقنا اللوجستي تجهيز وتغليف المنتج الخاص بك وإرساله فوراً مع شبكة موزعِينا المحترفين بكافة ربوع المغرب، ليتم استلام قيمته نقداً وتحديث أرباحك الصافية فوراً.
              </p>
            </div>
            <div className="w-48 sm:w-56 overflow-hidden rounded-[2rem] border border-white/10 shrink-0">
              <img src="/home page silacod copy/images/delivery_man_smiling.webp" alt="Delivery Hero" className="w-full h-auto object-cover" />
            </div>
          </div>

        </div>
      </section>

      {/* ── TARGET AUDIENCE (لمن هذه المنصة؟) ── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-50/50">
        <div className="max-w-7xl mx-auto space-y-16">
          
          <div className="text-center space-y-4">
            <span className="text-primary-600 font-bold tracking-widest uppercase text-xs bg-primary-50 px-4 py-2 rounded-full border border-primary-100">
              الجمهور المستهدف
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 leading-tight">
              لمن هذه المنصة؟
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm sm:text-base">
              سواء كنت تاجراً محترفاً، صانع محتوى، أو مسوقاً بالعمولة مبتدئاً — SILACOD توفر لك كل الأدوات الممكنة لتحقيق النجاح.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Vendors (للبائعين) */}
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-white border border-slate-100 rounded-[2.5rem] p-8 flex flex-col justify-between min-h-[420px] shadow-sm hover:shadow-md transition-all text-right"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <h3 className="text-xl font-black text-slate-900">للبائعين والتجار</h3>
                  <div className="p-3 bg-primary-50 text-primary-600 rounded-xl"><Package size={18} /></div>
                </div>
                <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
                  ابدأ تجارتك الإلكترونية الخاصة بأقل تكلفة ومخاطرة ممكنة. اختر المنتجات المجربة، حدد الكميات المناسبة، وركّز فقط على الإعلانات والتسويق بينما تتولى المنصة التوصيل وتأكيد الطلبات.
                </p>
                <ul className="space-y-2 text-xs font-bold text-slate-700">
                  <li className="flex items-center gap-2">✓ منتجات محلية رابحة ومضمونة الجودة</li>
                  <li className="flex items-center gap-2">✓ إمكانية البدء برأس مال صغير للغاية</li>
                  <li className="flex items-center gap-2">✓ توصيل وتحصيل سريع لكل الأقاليم</li>
                </ul>
              </div>
              <Link to="/register" className="mt-8 block text-center py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold">إبدأ مجاناً الآن</Link>
            </motion.div>

            {/* Influencers (المؤثرين) */}
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-slate-900 text-white border border-slate-800 rounded-[2.5rem] p-8 flex flex-col justify-between min-h-[420px] shadow-xl text-right relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-cover bg-center opacity-10 pointer-events-none" style={{ backgroundImage: `url('/home page silacod copy/images/handsome-stylish-bearded-guy-posing-against-white-wall.png')` }} />
              
              <div className="space-y-6 relative z-10">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <h3 className="text-xl font-black text-primary-400">للمؤثرين وصناع المحتوى</h3>
                  <div className="p-3 bg-primary-500/20 text-primary-400 rounded-xl"><Crown size={18} /></div>
                </div>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                  حوّل قوة تأثيرك ومتابعيك إلى مصدر دخل ممتاز ومستقر. أنشئ علامتك التجارية الخاصة بسهولة تامة (White Label)، أضف شعارك الخاص على منتجات التجميل أو الإكسسوارات، وقم بالبيع مباشرة لجمهورك.
                </p>
                
                <div className="my-2 rounded-xl overflow-hidden border border-white/10">
                  <img src="/home page silacod copy/images/branddd.png" alt="White Label Branding Simulator" className="w-full h-auto object-cover max-h-[100px]" />
                </div>

                <ul className="space-y-2 text-xs font-bold text-slate-200">
                  <li className="flex items-center gap-2">✓ إنشاء هوية تجارية وعلامة خاصة بك</li>
                  <li className="flex items-center gap-2">✓ صفحات هبوط مصممة خصيصاً لجمهورك</li>
                  <li className="flex items-center gap-2">✓ ركّز على الفيديوهات ونحن نشحن الباقي</li>
                </ul>
              </div>
              <Link to="/influencer/register" className="mt-8 block text-center py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl text-xs font-bold relative z-10">إبدأ كمؤثر VIP</Link>
            </motion.div>

            {/* Affiliates (للمسوقين بالعمولة) */}
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-white border border-slate-100 rounded-[2.5rem] p-8 flex flex-col justify-between min-h-[420px] shadow-sm hover:shadow-md transition-all text-right"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <h3 className="text-xl font-black text-slate-900">للمسوقين بالعمولة</h3>
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><TrendingUp size={18} /></div>
                </div>
                <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
                  اربح مبالغ مالية بدون الحاجة لشراء أو تخزين أي منتجات. اختر من بين قائمة عريضة من منتجات المنصة، روّج لروابط الإحالة الخاصة بك على تيك توك وإنستغرام، واحصل على عمولات نقدية واضحة وممتازة بعد كل توصيل ناجح للزبون.
                </p>
                <ul className="space-y-2 text-xs font-bold text-slate-700">
                  <li className="flex items-center gap-2">✓ صفر درهم استثمار في مخازن أو شراء سلع</li>
                  <li className="flex items-center gap-2">✓ عمولات مرتفعة تُدفع مباشرة لمحفظتك</li>
                  <li className="flex items-center gap-2">✓ روابط تتبع ذكية ودقيقة بنسبة 100%</li>
                </ul>
              </div>
              <Link to="/register" className="mt-8 block text-center py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold">إبدأ التسويق بالعمولة</Link>
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

          {/* Carousel Showcase Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {smartwatchProducts.map((prod, idx) => (
              <motion.div
                key={idx}
                whileHover={{ y: -6 }}
                className="bg-slate-50 border border-slate-100 hover:border-slate-200 rounded-[2.5rem] p-6 text-right flex flex-col justify-between shadow-sm relative overflow-hidden transition-all duration-300"
              >
                <div className="absolute top-4 left-4 z-10">
                  <span className="px-3 py-1 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-wider">
                    {prod.tag}
                  </span>
                </div>

                <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-white border border-slate-100 flex items-center justify-center p-4">
                  <img src={prod.image} alt={prod.name} className="object-contain max-h-[160px] max-w-full hover:scale-105 transition-transform duration-300" />
                </div>

                <div className="space-y-4 mt-6">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{prod.category}</span>
                    <h3 className="text-base font-black text-slate-950 mt-1 leading-tight">{prod.name}</h3>
                  </div>

                  <div className="flex gap-1 items-center justify-start text-xs font-bold text-amber-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={12} className="fill-current" />
                    ))}
                    <span className="text-slate-400 text-[10px] mr-1">({prod.rating.toFixed(1)})</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 py-3 border-t border-slate-150/60 text-xs">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">سعر المورد</span>
                      <span className="font-mono text-slate-700 font-bold">{prod.costPrice}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">البيع الموصى به</span>
                      <span className="font-mono text-slate-900 font-bold">{prod.sellPrice}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-800">
                    <span>ربحك الصافي المتوقع:</span>
                    <span className="font-mono text-base font-black">{prod.profit}</span>
                  </div>
                </div>

                <Link to="/register" className="mt-5 block text-center py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold active:scale-[0.98] transition-all">
                  أطلب كميتك وابدأ البيع الآن
                </Link>
              </motion.div>
            ))}
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

            <div className="flex-shrink-0 flex items-center gap-4 relative z-10">
              <input
                type="file"
                id="brand-logo-upload"
                className="hidden"
                accept="image/*"
                onChange={handleLogoUpload}
              />
              <label
                htmlFor="brand-logo-upload"
                className="cursor-pointer px-6 py-4 bg-white text-slate-950 hover:bg-slate-100 transition-all rounded-xl text-xs font-black uppercase tracking-wider shadow-lg active:scale-95"
              >
                {customLogoSelected ? "تغيير الشعار المرفوع" : "ارفع شعارك الافتراضي (.png)"}
              </label>
              {customLogoSelected && (
                <button
                  onClick={() => { setUploadedLogo(null); setCustomLogoSelected(false); }}
                  className="px-4 py-4 border border-slate-700 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-slate-300"
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
                <img src="/home page silacod copy/images/branddd.png" alt="Cosmetic Base" className="object-cover h-full opacity-90" />
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
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-50/50 border-t border-slate-150/60 font-['29LT_Kaff',Cairo,sans-serif]">
        <div className="max-w-6xl mx-auto bg-white border border-slate-100 rounded-[3.5rem] p-8 sm:p-14 shadow-2xl relative overflow-hidden">
          
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary-100/30 rounded-full blur-[80px] pointer-events-none" />
          
          <div className="grid lg:grid-cols-12 gap-12 items-center relative z-10 text-right">
            
            {/* Text details (Right) */}
            <div className="lg:col-span-7 space-y-6">
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-primary-50 text-primary-600 border border-primary-100 rounded-full text-[10px] font-bold uppercase tracking-widest">
                <Users size={12} /> للموردين المحليين
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-950">للموردين: حوّل مخزونك الساكن إلى مبيعات مستمرة</h2>
              <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
                هل أنت مورد ولديك سلع أو مخزون بالمغرب؟ اعرض منتجاتك الآن داخل منصة SILACOD وامنح لآلاف البائعين والمسوقين النشطين إمكانية بيع وتصريف بضاعتك فوراً. نحن نربطك بطلب حقيقي ونهائي من السوق بدون حاجتك لبناء فريق تسويق أو صرف ميزانيات على الإعلانات.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs font-bold text-slate-700">
                <div className="flex items-center gap-2">✓ عرض منتجاتك بماركت بليس ضخم</div>
                <div className="flex items-center gap-2">✓ تصريف فوري وأسرع للمخازن</div>
                <div className="flex items-center gap-2">✓ نحن نضمن توفير الطلب النهائي</div>
              </div>

              <div className="pt-4">
                <a href="mailto:contact@silacod.com" className="inline-flex items-center gap-2 px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold active:scale-[0.98] transition-all">
                  <MessageCircle size={14} />
                  <span>تواصل معنا الآن للإنضمام كمورد</span>
                </a>
              </div>
            </div>

            {/* Visual (Left) */}
            <div className="lg:col-span-5 overflow-hidden rounded-[2.5rem] border border-slate-100 shadow-xl max-h-[300px]">
              <img src="/home page silacod copy/images/iStock-173258309.jpg" alt="Supplier Logistics Warehousing" className="w-full h-auto object-cover" />
            </div>

          </div>

        </div>
      </section>

      {/* ── SIMULATOR SECTION ── */}
      <ProfitSimulator />

      {/* ── SUCCESS STORIES SECTION ── */}
      <SuccessStories />

      {/* ── ZERO RISK CALL TO ACTION ── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white relative">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-primary-950 border border-slate-800 rounded-[3rem] p-8 sm:p-16 text-center space-y-8 relative overflow-hidden shadow-2xl">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-primary-500/10 rounded-full blur-[110px] pointer-events-none" />
            
            <div className="relative z-10 space-y-6">
              <span className="text-5xl block animate-bounce duration-3000">🇲🇦</span>
              <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white leading-none">
                بدون اشتراكات شهرية. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-400">
                  وبدون أي مخاطرة مالية.
                </span>
              </h2>
              <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
                التسجيل والبدء مجاني بالكامل 100%. نقتطع فقط رسوماً تشغيلية شفافة وبسيطة للغاية عن كل طلبية يتم تسليمها وقبض ثمنها بنجاح. نجاحنا مرتبط بنجاحك ونمو تجارتك!
              </p>
              
              <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
                <Link
                  to="/register"
                  className="px-10 py-5 bg-white text-slate-950 rounded-2xl text-xs font-black uppercase tracking-wider shadow-xl hover:bg-slate-100 active:scale-95 transition-all"
                >
                  أنشئ حسابك المجاني فوراً
                </Link>
                <a
                  href="#marketplace"
                  className="px-10 py-5 border border-slate-700 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-black uppercase tracking-wider text-slate-300"
                >
                  تصفح المنتجات المتوفرة
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ SECTION ── */}
      <FAQ />

      {/* ── FOOTER ── */}
      <footer className="bg-slate-950 border-t border-slate-900 pt-20 pb-10 px-4 sm:px-6 lg:px-8 text-white font-['29LT_Kaff',Cairo,sans-serif]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16 text-right">
            
            {/* Brand details */}
            <div className="space-y-6">
              <div className="flex items-center justify-start gap-3">
                <img src="/new logo/logo filess-25.svg" alt="SILACOD" className="w-10 h-10 object-contain" />
                <img src="/new logo/logo filess-24.svg" alt="SILACOD" className="h-9 brightness-200 object-contain" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                SILACOD هي منصة متكاملة للتجارة الإلكترونية واللوجستيك في المغرب، تربط بين البائعين، المؤثرين، والمسوقين بالعمولة داخل نظام واحد ليسهل العمل ويتحقق العائد الممتاز.
              </p>
            </div>

            {/* Platform links */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">المنصة</h4>
              <div className="space-y-2.5 text-xs text-slate-400 font-bold">
                <Link to="/register" className="block hover:text-white transition-colors">بوابة التجار والبائعين</Link>
                <Link to="/influencer/register" className="block hover:text-white transition-colors">برنامج المؤثرين VIP</Link>
                <a href="#marketplace" className="block hover:text-white transition-colors">متجر المنتجات</a>
                <Link to="/login" className="block hover:text-white transition-colors">تسجيل الدخول للنظام</Link>
              </div>
            </div>

            {/* Resource links */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">المعلومات</h4>
              <div className="space-y-2.5 text-xs text-slate-400 font-bold">
                <a href="#how-it-works" className="block hover:text-white transition-colors">كيف نعمل بالتفصيل</a>
                <a href="#marketplace" className="block hover:text-white transition-colors">المنتجات الأكثر طلباً</a>
                <a href="#faq" className="block hover:text-white transition-colors">الأسئلة الشائعة والتحصيل</a>
              </div>
            </div>

            {/* Contact details */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">تواصل معنا</h4>
              <div className="space-y-2.5 text-xs text-slate-400 font-bold">
                <a href="mailto:contact@silacod.com" className="block hover:text-white transition-colors">contact@silacod.com</a>
                <div className="text-[10px] text-slate-500 mt-1">الدعم متوفر على مدار 24/7 للإجابة عن استفساراتكم.</div>
              </div>
            </div>

          </div>

          <div className="pt-8 border-t border-slate-900 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              © 2026 SILACOD — جميع الحقوق محفوظة للمنصة. صنع بكل شغف لمساندة رواد الأعمال المغاربة.
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span>كافة الأنظمة والخدمات اللوجستية نشطة الآن</span>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}

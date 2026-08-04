import { Link } from 'react-router-dom';
import { DollarSign, ArrowLeft, Truck, Percent, Globe, MessageSquare, RotateCcw, Sliders } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Seo } from '../components/Seo';
import { FooterMeta } from '../components/common/FooterMeta';
import LanguageSwitcherWidget from '../components/common/LanguageSwitcherWidget';

const translations = {
  ar: {
    login: "تسجيل الدخول",
    backToHome: "العودة إلى الرئيسية",
    title: "رسوم الخدمات والعمولات",
    subtitle: "أسعارنا وعمولات الخدمة — وضوح ومرونة وتوافق مع حجم أعمالك",
    bannerTitle: "جميع هذه الرسوم قابلة للتعديل والاتفاق المباشر!",
    bannerDesc: "يمكن للتاجر بالتنسيق مع إدارة المنصة تعديل وتخصيص كافة العمولات ورسوم الشحن لتناسب حجم مبيعاتك.",
    bannerNote: "* ملاحظة هامة: جميع العمولات والرسوم المدرجة أدناه قابلة للتخصيص والتعديل بالكامل بالتنسيق مع إدارة المنصة.",
    termsOfUse: "شروط الاستخدام",
    privacyPolicy: "سياسة الخصوصية",
    footerText: "© 2026 SILACOD. جميع الحقوق محفوظة.",
    fees: [
      {
        title: 'رسوم الشحن والتوصيل',
        value: '57 درهم',
        desc: 'الرسوم المطبقة افتراضياً لكل طلب يتم تسليمه بنجاح إلى العميل.',
        icon: Truck,
        color: 'from-blue-500 to-indigo-600 shadow-blue-500/20',
      },
      {
        title: 'عمولة المنصة',
        value: '13%',
        desc: 'نسبة عمولة المنصة الافتراضية المحتسبة من الأرباح الصافية لكل طلب ناجح.',
        icon: Percent,
        color: 'from-[#ff5722] to-rose-600 shadow-[#ff5722]/20',
      },
      {
        title: 'رسوم معالجة Landing Page',
        value: '2 درهم',
        desc: 'رسوم إرسال ومعالجة الطلبات الواردة من صفحات الهبوط إلى مركز الاتصال (Call Center).',
        icon: Globe,
        color: 'from-emerald-500 to-teal-600 shadow-emerald-500/20',
      },
      {
        title: 'رسوم معالجة WhatsApp',
        value: '8 درهم',
        desc: 'رسوم التحقق والتأكيد والمسك اليدوي لطلبات WhatsApp من طرف وكيل مركز الاتصال.',
        icon: MessageSquare,
        color: 'from-amber-500 to-orange-600 shadow-amber-500/20',
      },
      {
        title: 'رسوم إرجاع الطرود',
        value: '3 درهم',
        desc: 'رسوم معالجة وإرجاع الطرود غير المسلمة (المرتجعة) إلى المستودع وإعادة إدراج المخزون.',
        icon: RotateCcw,
        color: 'from-purple-500 to-violet-600 shadow-purple-500/20',
      }
    ]
  },
  fr: {
    login: "Connexion",
    backToHome: "Retour à l'accueil",
    title: "Tarifs et Commissions",
    subtitle: "Nos Tarifs et Commissions de Service — Clarté, flexibilité et adaptabilité à votre volume",
    bannerTitle: "Tous ces tarifs sont négociables et personnalisables !",
    bannerDesc: "En coordination avec l'administration de la plateforme, le vendeur peut ajuster et personnaliser toutes les commissions et frais de livraison pour s'adapter à son volume de ventes.",
    bannerNote: "* Note importante : Toutes les commissions et frais listés ci-dessous sont entièrement personnalisables et modifiables par le vendeur en coordination avec l'administration de la plateforme.",
    termsOfUse: "Conditions d'utilisation",
    privacyPolicy: "Politique de confidentialité",
    footerText: "© 2026 SILACOD. Tous droits réservés.",
    fees: [
      {
        title: 'Frais de Livraison',
        value: '57 DH',
        desc: 'Frais de livraison standard appliqués uniquement sur les colis livrés avec succès.',
        icon: Truck,
        color: 'from-blue-500 to-indigo-600 shadow-blue-500/20',
      },
      {
        title: 'Commission de la Plateforme',
        value: '13%',
        desc: 'Commission standard de la plateforme calculée sur les bénéfices nets par commande.',
        icon: Percent,
        color: 'from-[#ff5722] to-rose-600 shadow-[#ff5722]/20',
      },
      {
        title: 'Leads de Landing Page',
        value: '2 DH',
        desc: 'Frais d\'envoi et de traitement des leads provenant des landing pages vers le Call Center.',
        icon: Globe,
        color: 'from-emerald-500 to-teal-600 shadow-emerald-500/20',
      },
      {
        title: 'Leads de WhatsApp (Saisie)',
        value: '8 DH',
        desc: 'Frais de saisie, de traitement et de confirmation manuelle des leads WhatsApp par un agent.',
        icon: MessageSquare,
        color: 'from-amber-500 to-orange-600 shadow-amber-500/20',
      },
      {
        title: 'Frais de Retour Colis',
        value: '3 DH',
        desc: 'Frais de traitement pour chaque colis retourné (non livré) et réintégration en stock.',
        icon: RotateCcw,
        color: 'from-purple-500 to-violet-600 shadow-purple-500/20',
      }
    ]
  },
  en: {
    login: "Login",
    backToHome: "Back to Home",
    title: "Pricing & Commissions",
    subtitle: "Our Service Fees and Commissions — Clarity, flexibility, and adaptability to your volume",
    bannerTitle: "All these fees are negotiable and customizable!",
    bannerDesc: "In coordination with the platform administration, the seller can adjust and customize all commissions and shipping fees to fit their sales volume.",
    bannerNote: "* Important Note: All commissions and fees listed below are fully customizable and negotiable by the seller in coordination with the platform administration.",
    termsOfUse: "Terms of Use",
    privacyPolicy: "Privacy Policy",
    footerText: "© 2026 SILACOD. All rights reserved.",
    fees: [
      {
        title: 'Delivery Fees',
        value: '57 MAD',
        desc: 'Standard shipping fees applied only to successfully delivered packages.',
        icon: Truck,
        color: 'from-blue-500 to-indigo-600 shadow-blue-500/20',
      },
      {
        title: 'Platform Commission',
        value: '13%',
        desc: 'Standard platform commission calculated on net profits per order.',
        icon: Percent,
        color: 'from-[#ff5722] to-rose-600 shadow-[#ff5722]/20',
      },
      {
        title: 'Landing Page Leads',
        value: '2 MAD',
        desc: 'Fees for sending and processing leads from landing pages to the Call Center.',
        icon: Globe,
        color: 'from-emerald-500 to-teal-600 shadow-emerald-500/20',
      },
      {
        title: 'WhatsApp Leads (Data Entry)',
        value: '8 MAD',
        desc: 'Fees for manual entry, processing, and confirmation of WhatsApp leads by an agent.',
        icon: MessageSquare,
        color: 'from-amber-500 to-orange-600 shadow-amber-500/20',
      },
      {
        title: 'Returned Package Fees',
        value: '3 MAD',
        desc: 'Processing fees for each returned (undelivered) package and restock integration.',
        icon: RotateCcw,
        color: 'from-purple-500 to-violet-600 shadow-purple-500/20',
      }
    ]
  }
};

export default function PricingPage() {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.en;
  const isRtl = language === 'ar';
  const textAlign = isRtl ? 'text-right' : 'text-left';
  const flexAlign = isRtl ? 'flex-row-reverse' : 'flex-row';

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-['29LT_Kaff',_Cairo,_Inter,_sans-serif] text-slate-700 relative overflow-x-hidden selection:bg-[#ff5722]/10 selection:text-[#ff5722]">
      <Seo page="pricing" />
      {/* Dynamic Animated Background Glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[600px] bg-gradient-to-br from-[#ff5722]/8 to-transparent blur-[140px] rounded-full pointer-events-none animate-pulse duration-[8s]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[600px] bg-gradient-to-tr from-[#2e315e]/6 to-transparent blur-[140px] rounded-full pointer-events-none animate-pulse duration-[10s]" />
      <div className="absolute top-[30%] left-[20%] w-[300px] h-[300px] bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />

      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-100 px-6 py-4 transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" dir="ltr" className="flex items-center gap-2 group">
            <img src="/new logo/logo filess-25.svg" alt="SILACOD" className="w-9 h-9 object-contain group-hover:rotate-6 transition-transform duration-300" />
            <img src="/new logo/logo filess-24.svg" alt="SILACOD" className="h-6 object-contain" />
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcherWidget />
            <Link
              to="/login"
              className="bg-gradient-to-r from-[#2e315e] to-indigo-950 hover:from-[#ff5722] hover:to-[#e64a19] text-white font-extrabold px-6 py-2.5 rounded-xl text-sm transition-all duration-300 shadow-md shadow-[#2e315e]/10 hover:shadow-lg hover:shadow-[#ff5722]/20 transform hover:-translate-y-0.5"
            >
              {t.login}
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12 relative z-10">
        {/* Back Link */}
        <div className={`mb-10 flex ${isRtl ? 'justify-end' : 'justify-start'}`}>
          <Link
            to="/"
            className={`inline-flex items-center gap-2 text-sm font-extrabold text-slate-500 hover:text-[#ff5722] transition-colors group ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <ArrowLeft size={16} className={`transition-transform duration-300 ${isRtl ? 'rotate-180 group-hover:translate-x-1' : 'group-hover:-translate-x-1'}`} />
            {t.backToHome}
          </Link>
        </div>

        {/* Page Title Hero */}
        <div className={`space-y-4 mb-16 text-center lg:${textAlign}`} dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#ff5722] to-[#e64a19] text-white mb-2 shadow-lg shadow-[#ff5722]/20 opacity-0">
            <DollarSign size={26} className="animate-bounce" />
          </div>
          <h1 className="pt-1 text-4xl sm:text-5xl font-black text-[#2e315e] tracking-tight leading-none bg-gradient-to-r from-[#2e315e] via-[#2e315e] to-[#ff5722] bg-clip-text text-transparent inline-block">
            {t.title}
          </h1>
          <p className="text-slate-500 font-extrabold tracking-wider text-xs sm:text-sm uppercase opacity-90">
            {t.subtitle}
          </p>
        </div>

        {/* Customizable Banner Notification */}
        <div className={`mb-12 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white rounded-[2.5rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden border border-white/5 ${textAlign}`} dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="absolute top-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-[#ff5722]/10 rounded-full blur-[60px] pointer-events-none" />
          
          <div className={`relative z-10 flex flex-col md:${flexAlign} md:items-center justify-between gap-8`}>
            <div className={`flex gap-5 items-start ${isRtl ? 'flex-row-reverse text-right' : 'flex-row text-left'}`}>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#ff5722] to-[#e64a19] flex items-center justify-center text-white shrink-0 shadow-lg shadow-[#ff5722]/20">
                <Sliders size={24}/>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-extrabold tracking-tight">{t.bannerTitle}</h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
                  {t.bannerDesc}
                </p>
              </div>
            </div>
            <div className={`text-xs text-slate-400 font-semibold max-w-md border-slate-800/80 ${isRtl ? 'text-right border-r pr-6' : 'text-left border-l pl-6'}`}>
              {t.bannerNote}
            </div>
          </div>
        </div>

        {/* Grid of Fees */}
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 ${textAlign}`} dir={isRtl ? 'rtl' : 'ltr'}>
          {t.fees.map((fee, idx) => {
            const IconComponent = fee.icon;
            return (
              <div
                key={idx}
                className="bg-white/70 backdrop-blur-md rounded-[2.5rem] p-8 border border-slate-100 shadow-[0_10px_35px_rgba(0,0,0,0.015)] hover:shadow-[0_20px_50px_rgba(255,87,34,0.06)] hover:border-[#ff5722]/20 transition-all duration-300 flex flex-col justify-between group transform hover:-translate-y-1"
              >
                <div>
                  {/* Header / Value */}
                  <div className={`flex items-center justify-between gap-4 mb-8 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${fee.color} text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <IconComponent size={24} />
                    </div>
                    <div className="text-4xl font-black bg-gradient-to-r from-[#2e315e] to-indigo-900 bg-clip-text text-transparent group-hover:text-[#ff5722] transition-colors duration-300">
                      {fee.value}
                    </div>
                  </div>

                  {/* Title & Desc */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-black text-[#2e315e] group-hover:text-[#ff5722] transition-colors duration-300 leading-snug">
                      {fee.title}
                    </h3>
                    <p className="text-[13px] text-slate-500 font-medium leading-relaxed">
                      {fee.desc}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-10 text-center text-xs text-slate-400 font-semibold mt-16">
        <div className="max-w-7xl mx-auto px-6 space-y-3">
          <p className="text-slate-500 font-bold">{t.footerText}</p>
          <div className="flex justify-center gap-4 text-[13px]">
            <Link to="/terms" className="hover:text-[#ff5722] transition-colors">
              {t.termsOfUse}
            </Link>
            <span className="text-slate-300">•</span>
            <Link to="/privacy" className="hover:text-[#ff5722] transition-colors">
              {t.privacyPolicy}
            </Link>
          </div>
          <FooterMeta />
        </div>
      </footer>
    </div>
  );
}

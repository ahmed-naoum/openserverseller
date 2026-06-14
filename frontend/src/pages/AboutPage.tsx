import { Link } from 'react-router-dom';
import { Users, Target, Heart, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSwitcherWidget from '../components/common/LanguageSwitcherWidget';

const translations = {
  ar: {
    login: "تسجيل الدخول",
    backToHome: "العودة إلى الرئيسية",
    title: "من نحن",
    subtitle: "عن SILACOD — شريكك الموثوق في التجارة الإلكترونية",
    introTitle: "ثورة في الخدمات اللوجستية والتجارة الإلكترونية",
    introP1: "تأسست منصة سيلاكود (SILACOD) برؤية واضحة لتبسيط عمليات التجارة الإلكترونية في المغرب وإفريقيا. نحن نؤمن بأن التجارة الإلكترونية لا يجب أن تكون معقدة، ولهذا قمنا ببناء نظام متكامل يربط بين التجار، الموردين، المؤثرين، والمسوقين في بيئة عمل واحدة وسلسة.",
    introP2: "من خلال توفير المنتجات، والتخزين الآمن، والتأكيد الهاتفي الاحترافي للطلبات، والشحن السريع مع تحصيل الأموال نقداً (COD)، نحن نتحمل كل الأعباء التشغيلية لنتيح لك التركيز بالكامل على ما تتقنه: التسويق والبيع وتحقيق الأرباح.",
    missionTitle: "رسالتنا",
    missionDesc: "تمكين الشباب والتجار الطموحين من إطلاق وتوسيع مشاريعهم في التجارة الإلكترونية بأقل التكاليف وبدون مخاطر تشغيلية.",
    valuesTitle: "قيمنا",
    valuesDesc: "الشفافية المطلقة، السرعة والدقة في التنفيذ، والالتزام بتقديم أفضل العمولات والأرباح الصافية لشركائنا.",
    communityTitle: "مجتمعنا",
    communityDesc: "نحن لا نوفر منصة فحسب، بل نبني مجتمعاً متكاملاً يدعم التعلم والنمو المستمر وتبادل الخبرات بين الأعضاء.",
    termsOfUse: "شروط الاستخدام",
    privacyPolicy: "سياسة الخصوصية",
    footerText: "© 2026 SILACOD. جميع الحقوق محفوظة."
  },
  fr: {
    login: "Connexion",
    backToHome: "Retour à l'accueil",
    title: "À Propos de Nous",
    subtitle: "À propos de SILACOD — Votre partenaire de confiance en E-commerce",
    introTitle: "Une révolution logistique et e-commerce",
    introP1: "La plateforme SILACOD a été fondée avec une vision claire : simplifier les opérations de commerce électronique au Maroc et en Afrique. Nous pensons que le e-commerce ne devrait pas être complexe. C'est pourquoi nous avons développé un écosystème intégré reliant vendeurs, fournisseurs, influenceurs et spécialistes du marketing dans un environnement collaboratif fluide.",
    introP2: "En prenant en charge l'approvisionnement des produits, le stockage sécurisé, la confirmation téléphonique professionnelle des commandes et la livraison rapide en paiement à la livraison (COD), nous éliminons vos obstacles opérationnels afin que vous puissiez vous concentrer à 100% sur le marketing et la vente.",
    missionTitle: "Notre Mission",
    missionDesc: "Permettre aux jeunes entrepreneurs et commerçants de lancer et développer leurs projets de commerce électronique avec des coûts minimaux et sans risques logistiques.",
    valuesTitle: "Nos Valeurs",
    valuesDesc: "Transparence totale, rapidité, rigueur d'exécution, et engagement à maximiser les profits nets de nos partenaires.",
    communityTitle: "Notre Communauté",
    communityDesc: "Plus qu'une simple plateforme technique, nous bâtissons un écosystème d'entraide favorisant l'apprentissage, la croissance et le partage d'expérience.",
    termsOfUse: "Conditions d'utilisation",
    privacyPolicy: "Politique de confidentialité",
    footerText: "© 2026 SILACOD. Tous droits réservés."
  },
  en: {
    login: "Login",
    backToHome: "Back to Home",
    title: "About Us",
    subtitle: "About SILACOD — Your Trusted E-commerce Partner",
    introTitle: "A Revolution in Logistics and E-commerce",
    introP1: "SILACOD was founded with a clear vision: to simplify e-commerce operations in Morocco and Africa. We believe that e-commerce does not need to be complex, which is why we built an integrated ecosystem connecting sellers, suppliers, influencers, and marketers in a single, fluid workspace.",
    introP2: "By providing product sourcing, secure storage, professional phone confirmation, and fast shipping with Cash on Delivery (COD), we handle all operational burdens so you can focus entirely on what you do best: marketing, selling, and generating profit.",
    missionTitle: "Our Mission",
    missionDesc: "Empowering young entrepreneurs and ambitious merchants to launch and scale their e-commerce businesses with minimal costs and zero logistics risk.",
    valuesTitle: "Our Values",
    valuesDesc: "Absolute transparency, execution speed, precision, and dedication to delivering the best net margins for our partners.",
    communityTitle: "Our Community",
    communityDesc: "We do not just provide a system; we build an integrated community that supports learning, growth, and knowledge exchange among members.",
    termsOfUse: "Terms of Use",
    privacyPolicy: "Privacy Policy",
    footerText: "© 2026 SILACOD. All rights reserved."
  }
};

export default function AboutPage() {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.en;
  const isRtl = language === 'ar';
  const textAlign = isRtl ? 'text-right' : 'text-left';
  const flexAlign = isRtl ? 'flex-row-reverse' : 'flex-row';

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-['29LT_Kaff',_Cairo,_Inter,_sans-serif] text-slate-700 relative overflow-x-hidden selection:bg-[#ff5722]/10 selection:text-[#ff5722]">
      {/* Decorative background glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[500px] bg-gradient-to-br from-[#ff5722]/8 to-transparent blur-[140px] rounded-full pointer-events-none animate-pulse duration-[8s]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[500px] bg-gradient-to-tr from-[#2e315e]/6 to-transparent blur-[140px] rounded-full pointer-events-none animate-pulse duration-[10s]" />

      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-100 px-6 py-4">
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
      <main className="max-w-5xl mx-auto px-6 py-12 relative z-10">
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
            <Users size={26} className="animate-pulse" />
          </div>
          <h1 className="pt-1 text-4xl sm:text-5xl font-black text-[#2e315e] tracking-tight leading-none bg-gradient-to-r from-[#2e315e] via-[#2e315e] to-[#ff5722] bg-clip-text text-transparent inline-block">
            {t.title}
          </h1>
          <p className="text-slate-500 font-extrabold tracking-wider text-xs sm:text-sm uppercase opacity-90">
            {t.subtitle}
          </p>
        </div>

        {/* Intro Section */}
        <div className={`bg-white/80 backdrop-blur-md rounded-[2.5rem] p-8 sm:p-12 shadow-[0_10px_35px_rgba(0,0,0,0.015)] border border-slate-100 space-y-12 ${textAlign}`} dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="space-y-6">
            <h2 className="text-3xl font-black text-[#2e315e] leading-snug tracking-tight bg-gradient-to-r from-[#2e315e] to-[#ff5722] bg-clip-text text-transparent inline-block">
              {t.introTitle}
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-semibold">
              {t.introP1}
            </p>
            <p className="text-sm sm:text-base text-slate-500 leading-relaxed font-medium">
              {t.introP2}
            </p>
          </div>

          {/* Grid of Values */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6">
            {/* Value 1: Mission */}
            <div className="bg-slate-50/50 backdrop-blur-sm rounded-[2rem] p-8 space-y-5 border border-slate-100 hover:border-blue-500/20 hover:shadow-lg hover:shadow-slate-200/40 transition-all duration-300 transform hover:-translate-y-0.5 group">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-650 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform duration-300`}>
                <Target size={22} />
              </div>
              <h3 className="text-xl font-extrabold text-[#2e315e] group-hover:text-blue-600 transition-colors">{t.missionTitle}</h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-medium">
                {t.missionDesc}
              </p>
            </div>

            {/* Value 2: Values */}
            <div className="bg-slate-50/50 backdrop-blur-sm rounded-[2rem] p-8 space-y-5 border border-slate-100 hover:border-[#ff5722]/20 hover:shadow-lg hover:shadow-slate-200/40 transition-all duration-300 transform hover:-translate-y-0.5 group">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-[#ff5722] to-rose-600 text-white flex items-center justify-center shadow-lg shadow-[#ff5722]/20 group-hover:scale-110 transition-transform duration-300`}>
                <Heart size={22} />
              </div>
              <h3 className="text-xl font-extrabold text-[#2e315e] group-hover:text-[#ff5722] transition-colors">{t.valuesTitle}</h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-medium">
                {t.valuesDesc}
              </p>
            </div>

            {/* Value 3: Community */}
            <div className="bg-slate-50/50 backdrop-blur-sm rounded-[2rem] p-8 space-y-5 border border-slate-100 hover:border-emerald-500/20 hover:shadow-lg hover:shadow-slate-200/40 transition-all duration-300 transform hover:-translate-y-0.5 group">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform duration-300`}>
                <Users size={22} />
              </div>
              <h3 className="text-xl font-extrabold text-[#2e315e] group-hover:text-emerald-600 transition-colors">{t.communityTitle}</h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-medium">
                {t.communityDesc}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-10 text-center text-xs text-slate-400 font-semibold mt-16">
        <div className="max-w-7xl mx-auto px-6 space-y-3">
          <p className="text-slate-500 font-bold">{t.footerText}</p>
          <div className="flex justify-center gap-4 text-[13px]">
            <Link to="/terms" className="hover:text-[#ff5722] transition-colors">{t.termsOfUse}</Link>
            <span className="text-slate-300">•</span>
            <Link to="/privacy" className="hover:text-[#ff5722] transition-colors">{t.privacyPolicy}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { BookOpen, Calendar, Clock, ArrowLeft, ArrowRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSwitcherWidget from '../components/common/LanguageSwitcherWidget';

const translations = {
  ar: {
    login: "تسجيل الدخول",
    backToHome: "العودة إلى الرئيسية",
    title: "المدونة",
    subtitle: "مدونة SILACOD — نصائح، استراتيجيات وأحدث توجهات التجارة الإلكترونية",
    readMore: "اقرأ المزيد",
    termsOfUse: "شروط الاستخدام",
    privacyPolicy: "سياسة الخصوصية",
    footerText: "© 2026 SILACOD. جميع الحقوق محفوظة.",
    articles: [
      {
        title: 'كيف تبدأ التجارة الإلكترونية بنظام COD في المغرب للمبتدئين',
        date: '05 يونيو 2026',
        readTime: '5 دقائق',
        desc: 'دليل شامل يوضح لك خطوات اختيار المنتجات الرائجة، وبناء صفحات الهبوط، والتعاون مع سيلاكود لإدارة الشحن والتأكيد دون رأس مال كبير.',
        tag: 'دليل المبتدئين',
        tagColor: 'bg-blue-50 text-blue-600 border-blue-100'
      },
      {
        title: 'أفضل الاستراتيجيات للمؤثرين لزيادة مبيعات روابط الإحالة',
        date: '02 يونيو 2026',
        readTime: '4 دقائق',
        desc: 'تعلم كيف تحول تفاعل متابعيك على Instagram و TikTok إلى أرباح حقيقية عن طريق تقديم محتوى تسويقي مقنع واستخدام الروابط الذكية.',
        tag: 'تسويق بالعمولة',
        tagColor: 'bg-[#ff5722]/5 text-[#ff5722] border-[#ff5722]/10'
      },
      {
        title: 'أهم 5 منتجات تكنولوجية من المتوقع تصدرها للمبيعات هذا الصيف',
        date: '28 مايو 2026',
        readTime: '3 دقائق',
        desc: 'نستعرض معكم المنتجات الأكثر طلباً والأعلى ربحية في كتالوج سيلاكود والتي يمكنك البدء في تسويقها وتحقيق أرباح ممتازة فوراً.',
        tag: 'منتجات رائجة',
        tagColor: 'bg-emerald-50 text-emerald-600 border-emerald-100'
      }
    ]
  },
  fr: {
    login: "Connexion",
    backToHome: "Retour à l'accueil",
    title: "Le Blog",
    subtitle: "Le Blog SILACOD — Conseils, Astuces et Tendances E-commerce",
    readMore: "Lire la suite",
    termsOfUse: "Conditions d'utilisation",
    privacyPolicy: "Politique de confidentialité",
    footerText: "© 2026 SILACOD. Tous droits réservés.",
    articles: [
      {
        title: 'Comment lancer votre e-commerce en COD au Maroc pour les débutants',
        date: '05 Juin 2026',
        readTime: '5 min',
        desc: 'Un guide complet qui explique comment choisir des produits tendance, créer des landing pages et collaborer avec SILACOD pour gérer l\'expédition et la confirmation sans grand capital.',
        tag: 'Guide Débutant',
        tagColor: 'bg-blue-50 text-blue-600 border-blue-100'
      },
      {
        title: 'Les meilleures stratégies pour les influenceurs afin d\'augmenter les ventes de liens d\'affiliation',
        date: '02 Juin 2026',
        readTime: '4 min',
        desc: 'Apprenez à convertir l\'engagement de vos abonnés sur Instagram et TikTok en réels profits en créant du contenu marketing convaincant et en utilisant des liens intelligents.',
        tag: 'Affiliation',
        tagColor: 'bg-[#ff5722]/5 text-[#ff5722] border-[#ff5722]/10'
      },
      {
        title: 'Top 5 des produits technologiques qui devraient dominer les ventes cet été',
        date: '28 Mai 2026',
        readTime: '3 min',
        desc: 'Découvrez les produits les plus demandés et les plus rentables du catalogue de SILACOD que vous pouvez commencer à promouvoir et vendre immédiatement.',
        tag: 'Produits Tendances',
        tagColor: 'bg-emerald-50 text-emerald-600 border-emerald-100'
      }
    ]
  },
  en: {
    login: "Login",
    backToHome: "Back to Home",
    title: "Blog",
    subtitle: "The SILACOD Blog — Tips, Strategies, and E-commerce Trends",
    readMore: "Read More",
    termsOfUse: "Terms of Use",
    privacyPolicy: "Privacy Policy",
    footerText: "© 2026 SILACOD. All rights reserved.",
    articles: [
      {
        title: 'How to Start COD E-commerce in Morocco for Beginners',
        date: 'June 05, 2026',
        readTime: '5 min read',
        desc: 'A comprehensive guide showing the steps to select winning products, build landing pages, and partner with SILACOD to manage shipping and confirmation without huge upfront capital.',
        tag: 'Beginners Guide',
        tagColor: 'bg-blue-50 text-blue-600 border-blue-100'
      },
      {
        title: 'Best Strategies for Influencers to Boost Affiliate Link Sales',
        date: 'June 02, 2026',
        readTime: '4 min read',
        desc: 'Learn how to turn your Instagram and TikTok follower engagement into real profits by presenting compelling marketing content and using smart links.',
        tag: 'Affiliate Marketing',
        tagColor: 'bg-[#ff5722]/5 text-[#ff5722] border-[#ff5722]/10'
      },
      {
        title: 'Top 5 Tech Products Expected to Peak in Sales This Summer',
        date: 'May 28, 2026',
        readTime: '3 min read',
        desc: 'We review the most requested and highly profitable products in the SILACOD catalog that you can start marketing and earn excellent commissions immediately.',
        tag: 'Trending Products',
        tagColor: 'bg-emerald-50 text-emerald-600 border-emerald-100'
      }
    ]
  }
};

export default function BlogPage() {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.en;
  const isRtl = language === 'ar';
  const textAlign = isRtl ? 'text-right' : 'text-left';
  const flexAlign = isRtl ? 'flex-row-reverse' : 'flex-row';

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-['29LT_Kaff',_Cairo,_Inter,_sans-serif] text-slate-700 relative overflow-x-hidden selection:bg-[#ff5722]/10 selection:text-[#ff5722]">
      {/* Decorative Background Glows */}
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
            <BookOpen size={26} className="animate-pulse" />
          </div>
          <h1 className="pt-1 text-4xl sm:text-5xl font-black text-[#2e315e] tracking-tight leading-none bg-gradient-to-r from-[#2e315e] via-[#2e315e] to-[#ff5722] bg-clip-text text-transparent inline-block">
            {t.title}
          </h1>
          <p className="text-slate-500 font-extrabold tracking-wider text-xs sm:text-sm uppercase opacity-90">
            {t.subtitle}
          </p>
        </div>

        {/* Articles Grid */}
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-8 ${textAlign}`} dir={isRtl ? 'rtl' : 'ltr'}>
          {t.articles.map((article, idx) => (
            <div
              key={idx}
              className="bg-white/80 backdrop-blur-md rounded-3xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.015)] border border-slate-100 hover:border-[#ff5722]/20 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 flex flex-col h-full group transform hover:-translate-y-1"
            >
              <div className="p-6 sm:p-8 flex flex-col flex-1 space-y-4">
                <div className={`flex justify-between items-center text-[11px] font-extrabold text-slate-400 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                  <span className={`flex items-center gap-1.5 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                    <Calendar size={13} className="text-[#ff5722]" /> 
                    {article.date}
                  </span>
                  <span className={`flex items-center gap-1.5 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                    <Clock size={13} className="text-[#ff5722]" /> 
                    {article.readTime}
                  </span>
                </div>

                {/* Article Badge tag */}
                <div className={`w-fit px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${article.tagColor}`}>
                  {article.tag}
                </div>

                <h3 className="text-lg font-black text-[#2e315e] group-hover:text-[#ff5722] transition-colors leading-snug">
                  {article.title}
                </h3>
                
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-medium flex-1">
                  {article.desc}
                </p>
                
                <div className="pt-4 border-t border-slate-50">
                  <span className={`text-xs font-black text-[#ff5722] hover:text-[#e64a19] transition-colors inline-flex items-center gap-1.5 group/btn ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                    {t.readMore}
                    <ArrowRight size={13} className={`transition-transform duration-300 ${isRtl ? 'rotate-180 group-hover/btn:-translate-x-1' : 'group-hover/btn:translate-x-1'}`} />
                  </span>
                </div>
              </div>
            </div>
          ))}
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

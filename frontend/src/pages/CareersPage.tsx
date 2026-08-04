import { Link } from 'react-router-dom';
import { Briefcase, MapPin, Clock, ArrowLeft, ArrowRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Seo } from '../components/Seo';
import { FooterMeta } from '../components/common/FooterMeta';
import LanguageSwitcherWidget from '../components/common/LanguageSwitcherWidget';

const translations = {
  ar: {
    login: "تسجيل الدخول",
    backToHome: "العودة إلى الرئيسية",
    title: "الوظائف المتاحة",
    subtitle: "انضم إلى فريق SILACOD — لنبنِ مستقبل التجارة الإلكترونية معاً",
    locationLabel: "الدار البيضاء / عن بعد",
    spontaneousTitle: "لم تجد وظيفتك المناسبة؟",
    spontaneousDesc: "يسعدنا دائماً انضمام الكفاءات والمواهب المتميزة لفريقنا. أرسل سيرتك الذاتية وتخصصك، وسنتواصل معك فور توفر فرصة مناسبة.",
    spontaneousBtn: "أرسل سيرتك الذاتية (jobs@silacod.com)",
    hiringBadge: "توظيف مفتوح",
    termsOfUse: "شروط الاستخدام",
    privacyPolicy: "سياسة الخصوصية",
    footerText: "© 2026 SILACOD. جميع الحقوق محفوظة.",
    jobs: [
      {
        title: 'ممثلو خدمة العملاء وتأكيد الطلبات (Call Center Agents)',
        type: 'دوام كامل (Casablanca)',
        desc: 'نبحث عن ممثلي خدمة عملاء ذوي مهارات تواصل ممتازة باللغة الدارجة المغربية لتأكيد ومتابعة طلبات المشترين عبر الهاتف.',
        color: 'border-blue-500 bg-blue-500/5'
      },
      {
        title: 'مطور واجهات أمامية (React / TypeScript Developer)',
        type: 'عن بعد / Full-time Remote',
        desc: 'نبحث عن مطور ويب ذو خبرة في React و TailwindCSS للمساهمة في بناء وتطوير لوحة تحكم سيلاكود وتحسين تجربة البائعين.',
        color: 'border-[#ff5722] bg-[#ff5722]/5'
      },
      {
        title: 'مسؤول العمليات والخدمات اللوجستية (Logistics Coordinator)',
        type: 'دوام كامل (Agadir Warehouse)',
        desc: 'الإشراف على عمليات استلام وتخزين المنتجات، تجهيز الطلبيات بالتنسيق مع شركات التوصيل المعتمدة لدينا.',
        color: 'border-emerald-500 bg-emerald-500/5'
      }
    ]
  },
  fr: {
    login: "Connexion",
    backToHome: "Retour à l'accueil",
    title: "Postes Ouverts",
    subtitle: "Rejoignez l'équipe SILACOD — Construisons l'avenir du E-commerce ensemble",
    locationLabel: "Agadir / Remote",
    spontaneousTitle: "Pas de poste correspondant ?",
    spontaneousDesc: "Nous sommes toujours à la recherche de talents exceptionnels. Envoyez-nous votre candidature spontanée et nous vous contacterons dès qu'une opportunité se présentera.",
    spontaneousBtn: "Envoyer votre CV (jobs@silacod.com)",
    hiringBadge: "Recrutement en cours",
    termsOfUse: "Conditions d'utilisation",
    privacyPolicy: "Politique de confidentialité",
    footerText: "© 2026 SILACOD. Tous droits réservés.",
    jobs: [
      {
        title: 'Chargés de Clientèle / Confirmation (Call Center Agents)',
        type: 'Temps plein (Casablanca)',
        desc: 'Nous recherchons des agents de centre d\'appels avec d\'excellentes compétences en communication en Darija marocaine pour confirmer et suivre les commandes par téléphone.',
        color: 'border-blue-500 bg-blue-500/5'
      },
      {
        title: 'Développeur Front-End (React / TypeScript)',
        type: 'Temps plein / À distance',
        desc: 'Nous recherchons un développeur web expérimenté en React et TailwindCSS pour participer au développement du tableau de bord de SILACOD.',
        color: 'border-[#ff5722] bg-[#ff5722]/5'
      },
      {
        title: 'Coordinateur Logistique et Opérations',
        type: 'Temps plein (Entrepôt Casablanca)',
        desc: 'Supervision de la réception et du stockage des produits, préparation des commandes en coordination avec nos transporteurs partenaires.',
        color: 'border-emerald-500 bg-emerald-500/5'
      }
    ]
  },
  en: {
    login: "Login",
    backToHome: "Back to Home",
    title: "Careers / Open Positions",
    subtitle: "Join the SILACOD Team — Let's build the future of E-commerce together",
    locationLabel: "Agadir / Remote",
    spontaneousTitle: "Didn't find a matching role?",
    spontaneousDesc: "We are always looking for exceptional talents. Send us a spontaneous application and we will get back to you as soon as a suitable opportunity opens.",
    spontaneousBtn: "Send your CV (jobs@silacod.com)",
    hiringBadge: "Hiring Now",
    termsOfUse: "Terms of Use",
    privacyPolicy: "Privacy Policy",
    footerText: "© 2026 SILACOD. All rights reserved.",
    jobs: [
      {
        title: 'Call Center & Order Confirmation Agents',
        type: 'Full-time (Casablanca)',
        desc: 'We are looking for call center agents with excellent communication skills in Moroccan Darija to confirm and follow up buyer orders over the phone.',
        color: 'border-blue-500 bg-blue-500/5'
      },
      {
        title: 'Front-End Developer (React / TypeScript)',
        type: 'Full-time Remote',
        desc: 'We are looking for a web developer experienced in React and TailwindCSS to contribute to building the SILACOD dashboard and optimizing seller experience.',
        color: 'border-[#ff5722] bg-[#ff5722]/5'
      },
      {
        title: 'Logistics & Operations Coordinator',
        type: 'Full-time (Agadir Warehouse)',
        desc: 'Supervising receipt and storage of products, preparing orders in coordination with our approved delivery companies.',
        color: 'border-emerald-500 bg-emerald-500/5'
      }
    ]
  }
};

export default function CareersPage() {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.en;
  const isRtl = language === 'ar';
  const textAlign = isRtl ? 'text-right' : 'text-left';
  const flexAlign = isRtl ? 'flex-row-reverse' : 'flex-row';
  const borderBar = isRtl ? 'border-r-4' : 'border-l-4';

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-['29LT_Kaff',_Cairo,_Inter,_sans-serif] text-slate-700 relative overflow-x-hidden selection:bg-[#ff5722]/10 selection:text-[#ff5722]">
      <Seo page="careers" />
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
      <main className="max-w-4xl mx-auto px-6 py-12 relative z-10">
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
            <Briefcase size={26} className="animate-pulse" />
          </div>
          <h1 className="pt-1 text-4xl sm:text-5xl font-black text-[#2e315e] tracking-tight leading-none bg-gradient-to-r from-[#2e315e] via-[#2e315e] to-[#ff5722] bg-clip-text text-transparent inline-block">
            {t.title}
          </h1>
          <p className="text-slate-500 font-extrabold tracking-wider text-xs sm:text-sm uppercase opacity-90">
            {t.subtitle}
          </p>
        </div>

        {/* Jobs List */}
        <div className={`space-y-6 ${textAlign}`} dir={isRtl ? 'rtl' : 'ltr'}>
          {t.jobs.map((job, idx) => (
            <div
              key={idx}
              className={`bg-white/80 backdrop-blur-md rounded-2xl p-6 sm:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.015)] border border-slate-100/80 hover:border-[#ff5722]/25 hover:shadow-md transition-all duration-300 space-y-4 ${borderBar} ${job.color.split(' ')[0]} transform hover:-translate-y-0.5`}
            >
              <div className={`flex flex-col sm:${flexAlign} sm:justify-between sm:items-center gap-3`}>
                <h3 className="text-xl font-extrabold text-[#2e315e] hover:text-[#ff5722] transition-colors">{job.title}</h3>
                
                <div className={`flex items-center gap-4 text-xs font-semibold`}>
                  {/* Status Indicator */}
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${isRtl ? 'flex-row-reverse' : 'flex-row'} bg-rose-50 text-rose-600 border border-rose-100`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                    <span>{t.hiringBadge}</span>
                  </span>

                  <span className={`flex items-center gap-1.5 text-slate-500 bg-slate-100 px-3 py-1 rounded-full ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                    <Clock size={13} />
                    <span>{job.type}</span>
                  </span>
                </div>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed font-medium">{job.desc}</p>
              
              <div className={`flex gap-4 text-xs font-bold text-slate-400 pt-2 ${flexAlign}`}>
                <span className={`flex items-center gap-1.5 ${flexAlign} bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg`}>
                  <MapPin size={14} className="text-[#ff5722]" /> 
                  {t.locationLabel}
                </span>
              </div>
            </div>
          ))}

          {/* Submission Spontaneous Application Banner */}
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white rounded-[2.5rem] p-8 sm:p-12 text-center space-y-6 mt-16 shadow-2xl relative overflow-hidden border border-white/5">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="relative z-10 space-y-6">
              <h3 className="text-3xl font-black tracking-tight">{t.spontaneousTitle}</h3>
              <p className="text-sm text-slate-300 max-w-lg mx-auto leading-relaxed font-medium">
                {t.spontaneousDesc}
              </p>
              <a
                href="mailto:jobs@silacod.com"
                className="inline-flex items-center gap-2 bg-[#ff5722] hover:bg-[#e64a19] text-white font-extrabold px-8 py-3.5 rounded-xl text-sm transition-all duration-300 shadow-md shadow-[#ff5722]/20 hover:shadow-lg hover:shadow-[#ff5722]/45 transform hover:-translate-y-0.5"
              >
                {t.spontaneousBtn}
                <ArrowRight size={16} className={`transition-transform duration-300 ${isRtl ? 'rotate-180' : ''}`} />
              </a>
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
          <FooterMeta />
        </div>
      </footer>
    </div>
  );
}

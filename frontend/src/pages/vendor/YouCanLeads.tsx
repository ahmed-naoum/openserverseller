import { Globe, Clock } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export default function YouCanLeads() {
  const { language } = useLanguage();

  const content = {
    fr: {
      title: "Flux YouCan",
      subtitle: "Prospects synchronisés automatiquement de votre boutique YouCan.",
      badge: "Bientôt disponible",
      heading: "Suivi des Leads YouCan en temps réel",
      description: "Dès que l'intégration avec YouCan sera activée, vous pourrez visualiser, affecter et suivre le statut de vos leads YouCan directement depuis cette interface centralisée."
    },
    ar: {
      title: "مجرى YouCan",
      subtitle: "العملاء المحتملون المتزامنون تلقائيًا من متجر YouCan الخاص بك.",
      badge: "قريباً جداً",
      heading: "تتبع عملاء YouCan في الوقت الفعلي",
      description: "بمجرد تفعيل الربط مع YouCan، ستتمكن من عرض وتعيين وتتبع حالة عملائك المحتملين مباشرة من خلال هذه الواجهة المركزية."
    },
    en: {
      title: "YouCan Feed",
      subtitle: "Leads automatically synchronized from your YouCan store.",
      badge: "Coming Soon",
      heading: "Real-time YouCan Lead Tracking",
      description: "As soon as the YouCan integration is enabled, you will be able to view, assign, and track the status of your YouCan leads directly from this centralized interface."
    }
  };

  const currentLang = (language === 'ar' || language === 'fr' || language === 'en') ? language : 'fr';
  const t = content[currentLang];

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="space-y-6 pt-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-200 ring-4 ring-white">
            <Globe className="text-white animate-pulse" size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">{t.title}</h1>
            <p className="text-slate-500 mt-2 font-medium">
              {t.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Coming Soon Card */}
      <div className="relative overflow-hidden bg-white rounded-[2rem] p-12 text-center shadow-sm border border-slate-100/80 flex flex-col items-center justify-center min-h-[400px]">
        {/* Glow Effects */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-[#ff5722]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6 max-w-xl mx-auto">
          {/* Badge */}
          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Clock size={12} className="animate-spin" style={{ animationDuration: '3s' }} /> {t.badge}
          </span>

          <h3 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight pt-2">
            {t.heading}
          </h3>

          <p className="text-slate-500 text-sm md:text-base leading-relaxed font-medium">
            {t.description}
          </p>
        </div>
      </div>
    </div>
  );
}

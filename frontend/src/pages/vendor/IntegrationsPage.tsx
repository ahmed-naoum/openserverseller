import { Link2, Clock } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export default function IntegrationsPage() {
  const { language } = useLanguage();

  const content = {
    fr: {
      title: "Intégrations & APIs",
      subtitle: "Connectez vos boutiques externes et synchronisez vos données automatiquement.",
      badge: "Bientôt disponible",
      heading: "Une synchronisation omnicanale en préparation",
      description: "Nous travaillons sur des intégrations natives et sécurisées avec YouCan, Shopify, WooCommerce et d'autres plateformes pour automatiser entièrement la gestion de vos leads et de vos commandes.",
    },
    ar: {
      title: "الربط البرمجي وواجهات التطبيقات (APIs)",
      subtitle: "ربط متجرك الخارجي ومزامنة بياناتك تلقائيًا.",
      badge: "قريباً جداً",
      heading: "مزامنة متعددة القنوات قيد التطوير",
      description: "نحن نعمل على تطوير ربط مباشر وآمن مع منصات YouCan و Shopify و WooCommerce وغيرها لتسهيل إدارة طلباتك وعملائك بشكل تلقائي بالكامل.",
    },
    en: {
      title: "Integrations & APIs",
      subtitle: "Connect your external stores and sync your data automatically.",
      badge: "Coming Soon",
      heading: "Omnichannel Sync is Under Development",
      description: "We are building native, secure integrations with YouCan, Shopify, WooCommerce, and other platforms to fully automate your lead and order management.",
    }
  };

  const currentLang = (language === 'ar' || language === 'fr' || language === 'en') ? language : 'fr';
  const t = content[currentLang];

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="max-w-4xl mx-auto pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="mb-8 p-8 border-b border-gray-100 bg-white rounded-3xl shadow-sm">
        <h2 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
          <Link2 className="text-indigo-600 animate-pulse" size={36} />
          {t.title}
        </h2>
        <p className="text-gray-500 mt-2 text-lg">
          {t.subtitle}
        </p>
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

          <div className="pt-6 flex justify-center gap-4">
            <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm font-bold text-xs text-slate-400">YC</div>
            <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm font-bold text-xs text-slate-400">WC</div>
            <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm font-bold text-xs text-slate-400">SF</div>
          </div>
        </div>
      </div>
    </div>
  );
}
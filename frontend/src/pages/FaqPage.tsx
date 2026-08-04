import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  HelpCircle, 
  Search, 
  ChevronDown, 
  ArrowLeft, 
  ShoppingBag, 
  Truck, 
  Wallet, 
  Share2, 
  Layers, 
  MessageCircle, 
  Mail,
  ShieldCheck
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Seo } from '../components/Seo';
import { FooterMeta } from '../components/common/FooterMeta';
import LanguageSwitcherWidget from '../components/common/LanguageSwitcherWidget';

const translations = {
  ar: {
    backToHome: "العودة إلى الرئيسية",
    login: "تسجيل الدخول",
    title: "الأسئلة الشائعة (FAQ)",
    subtitle: "كل ما تحتاج معرفته لبدء وتكبير تجارتك الإلكترونية معنا — آخر تحديث: يونيو 2026",
    searchPlaceholder: "ابحث عن سؤالك هنا (مثلاً: توصيل، أرباح، يوكان)...",
    footerText: "© 2026 SILACOD. جميع الحقوق محفوظة.",
    privacyPolicy: "سياسة الخصوصية",
    termsOfUse: "شروط الاستخدام",
    contactUs: "اتصل بنا",
    stillHaveQuestions: "هل لديك سؤال آخر؟",
    supportSubtitle: "فريق الدعم الفني متواجد لمساعدتك والإجابة على كافة استفساراتك على مدار الساعة.",
    noResultsTitle: "لم نجد أي سؤال يطابق بحثك",
    noResultsDesc: "جرّب تغيير كلمات البحث أو تواصل مباشرة مع فريق الدعم الفني.",
    categories: [
      { id: 'all', label: 'الكل', icon: HelpCircle },
      { id: 'general', label: 'عام', icon: Layers },
      { id: 'sellers', label: 'البائعون والتخزين', icon: ShoppingBag },
      { id: 'affiliates', label: 'التسويق بالعمولة', icon: Share2 },
      { id: 'logistics', label: 'التوصيل والعمولات', icon: Truck },
      { id: 'integrations', label: 'ربط YouCan والمتاجر', icon: Wallet },
    ],
    faqs: [
      {
        cat: 'general',
        q: 'ما هي منصة SILACOD وكيف تعمل؟',
        a: 'منصة SILACOD هي المنصة الأولى في المغرب المتخصصة في التجارة الإلكترونية، التسويق بالعمولة، والشحن مع الدفع عند الاستلام (COD). نربط بين البائعين والمؤثرين والموردين، مع توفير خدمات التخزين، التغليف، التأكيد عبر الهاتف، والطباعة على المنتجات (Branding).'
      },
      {
        cat: 'sellers',
        q: 'هل أحتاج إلى رأس مال لشراء المخزون قبل البدء بالبيع؟',
        a: 'لا، لا تحتاج إلى رأس مال لشراء المخزون. تتيح لك المنصة تصفح الكاتالوج واختيار المنتجات التي ترغب في بيعها. عند استلام أي طلبية، نتولى نحن الشحن والتوصيل واقتطاع سعر الجملة، وتحويل صافي أرباحك مباشرة إلى محفظتك.'
      },
      {
        cat: 'affiliates',
        q: 'كيف يعمل نظام التسويق بالعمولة (Affiliate) على المنصة؟',
        a: 'يمكن للمسوقين والمؤثرين اختيار المنتجات وحجز رابط إحالة خاص بهم (Affiliate Link). عند قيام الزبون بالشراء من خلال رابطك، يقوم فريقنا بتأكيد الطلب وتوصيله وتحصيل المبلغ، وتضاف عمولتك الصافية فوراً إلى محفظتك.'
      },
      {
        cat: 'integrations',
        q: 'كيف أقوم بربط متجري YouCan مع منصة SILACOD؟',
        a: 'انتقل إلى لوحة التحكم > Intégrations & APIs، واضغط على زر "Connecter YouCan". سيتم توجيهك للموافقة على الصلاحيات عبر YouCan OAuth، وسيتم استيراد ومزامنة طلبيات متجرك تلقائياً وبشكل آمن.'
      },
      {
        cat: 'logistics',
        q: 'متى وكيف يمكنني طلب سحب الأرباح والمستحقات المالية؟',
        a: 'بمجرد تحصيل مبلغ الطلبية من الزبون عند الاستلام، تتاح الأرباح فوراً في محفظتك الإلكترونية. يمكنك تقديم طلب سحب في أي وقت عبر حسابك البنكي المغربي (RIB) وتتم معالجته بسرعة ودون رسوم خفية.'
      },
      {
        cat: 'sellers',
        q: 'ما هو خيار طباعة العلامة التجارية الخاصة (Branding / Private Label)؟',
        a: 'نوفر للبائعين إمكانية إضافة شعارهم الخاص والتصاميم على المنتجات والأغلفة. تتيح لك هذه الخدمة بناء علامتك التجارية (Private Label) وتعزيز ثقة الزبناء وتكرار الشراء.'
      },
      {
        cat: 'general',
        q: 'هل يمكنني التنقل بين وضع البائع (SELLER) ووضع المسوق (AFFILIATE)؟',
        a: 'نعم، يمكنك التنقل بسهولة بين وضع البائع ووضع المسوق بالعمولة مباشرة من شريط المود العلوي في لوحة التحكم في أي وقت وبدون أي قيود.'
      }
    ]
  },
  fr: {
    backToHome: "Retour à l'accueil",
    login: "Connexion",
    title: "Foire Aux Questions (FAQ)",
    subtitle: "Toutes les réponses pour démarrer et développer votre e-commerce en toute sérénité — Dernière mise à jour : Juin 2026",
    searchPlaceholder: "Rechercher une question (ex: livraison, YouCan, paiements)...",
    footerText: "© 2026 SILACOD. Tous droits réservés.",
    privacyPolicy: "Politique de confidentialité",
    termsOfUse: "Conditions d'utilisation",
    contactUs: "Nous contacter",
    stillHaveQuestions: "Vous avez d'autres questions ?",
    supportSubtitle: "Notre équipe de support technique est à votre disposition 24/7 pour vous accompagner.",
    noResultsTitle: "Aucune question ne correspond à votre recherche",
    noResultsDesc: "Essayez de modifier vos termes de recherche ou contactez directement notre support.",
    categories: [
      { id: 'all', label: 'Tous', icon: HelpCircle },
      { id: 'general', label: 'Général', icon: Layers },
      { id: 'sellers', label: 'Vendeurs & Stock', icon: ShoppingBag },
      { id: 'affiliates', label: 'Affiliation', icon: Share2 },
      { id: 'logistics', label: 'Livraisons & Gain', icon: Truck },
      { id: 'integrations', label: 'YouCan & Intégrations', icon: Wallet },
    ],
    faqs: [
      {
        cat: 'general',
        q: 'Qu\'est-ce que la plateforme SILACOD et comment fonctionne-t-elle ?',
        a: 'SILACOD est la plateforme tout-en-un leader au Maroc pour le Dropshipping, l\'Affiliation et le Paiement à la livraison (COD). Nous connectons vendeurs, influenceurs et fournisseurs tout en gérant le stockage, la confirmation téléphonique, le packaging et la livraison.'
      },
      {
        cat: 'sellers',
        q: 'Ai-je besoin d\'un capital pour acheter du stock avant de commencer à vendre ?',
        a: 'Non, aucun capital initial n\'est requis pour le stock. Vous choisissez les produits gagnants dans notre catalogue et les publiez sur votre boutique. Dès qu\'une commande est livrée et encaissée, vos bénéfices nets sont crédités directement sur votre portefeuille.'
      },
      {
        cat: 'affiliates',
        q: 'Comment fonctionne le système d\'Affiliation sur SILACOD ?',
        a: 'Les spécialistes du marketing et influenceurs sélectionnent des produits et génèrent leur lien d\'affiliation personnalisé. Lorsqu\'un client commande via votre lien, notre équipe confirme et livre la commande, puis verse votre commission sur votre compte.'
      },
      {
        cat: 'integrations',
        q: 'Comment connecter ma boutique YouCan à la plateforme SILACOD ?',
        a: 'Rendez-vous dans Tableau de bord > Intégrations & APIs, puis cliquez sur "Connecter YouCan". Suivez l\'autorisation YouCan OAuth sécurisée pour que vos commandes soient synchronisées automatiquement.'
      },
      {
        cat: 'logistics',
        q: 'Quand et comment puis-je retirer mes bénéfices ?',
        a: 'Dès que le paiement est encaissé à la livraison par le livreur, vos gains sont crédités sur votre portefeuille SILACOD. Vous pouvez demander un virement bancaire sur votre RIB marocain à tout moment.'
      },
      {
        cat: 'sellers',
        q: 'En quoi consiste le service de Branding et Marque Privée ?',
        a: 'Nous offrons aux vendeurs la possibilité d\'imprimer leur propre logo et emballage personnalisé sur les produits (Marque Blanche / Private Label), améliorant ainsi l\'image de marque et la fidélisation des clients.'
      },
      {
        cat: 'general',
        q: 'Puis-je basculer entre le mode Vendeur (SELLER) et le mode Affilié (AFFILIATE) ?',
        a: 'Oui, vous pouvez basculer instantanément entre le mode Vendeur et le mode Affilié depuis le sélecteur situé en haut de votre tableau de bord sans aucune restriction.'
      }
    ]
  },
  en: {
    backToHome: "Back to Home",
    login: "Login",
    title: "Frequently Asked Questions (FAQ)",
    subtitle: "Everything you need to know to launch and scale your e-commerce business — Last updated: June 2026",
    searchPlaceholder: "Search any question (e.g. shipping, YouCan, payout)...",
    footerText: "© 2026 SILACOD. All rights reserved.",
    privacyPolicy: "Privacy Policy",
    termsOfUse: "Terms of Use",
    contactUs: "Contact Us",
    stillHaveQuestions: "Still have questions?",
    supportSubtitle: "Our technical support team is available 24/7 to assist you with any inquiries.",
    noResultsTitle: "No questions match your search",
    noResultsDesc: "Try adjusting your search terms or contact our support team directly.",
    categories: [
      { id: 'all', label: 'All', icon: HelpCircle },
      { id: 'general', label: 'General', icon: Layers },
      { id: 'sellers', label: 'Sellers & Stock', icon: ShoppingBag },
      { id: 'affiliates', label: 'Affiliates', icon: Share2 },
      { id: 'logistics', label: 'Logistics & Payouts', icon: Truck },
      { id: 'integrations', label: 'YouCan & APIs', icon: Wallet },
    ],
    faqs: [
      {
        cat: 'general',
        q: 'What is SILACOD and how does it work?',
        a: 'SILACOD is Morocco\'s leading all-in-one platform for E-commerce, Dropshipping, Affiliate Marketing, and Cash on Delivery (COD). We handle product sourcing, warehousing, packaging, call-center confirmation, custom branding, and shipping.'
      },
      {
        cat: 'sellers',
        q: 'Do I need capital to purchase inventory before selling?',
        a: 'No upfront capital is needed for stock. You choose winning products from our catalog and push them to your store. Upon successful COD delivery, wholesale costs are deducted and your net profits hit your wallet.'
      },
      {
        cat: 'affiliates',
        q: 'How does the Affiliate Marketing system work?',
        a: 'Marketers and influencers select products and generate their unique referral link. When a customer orders through your link, we fulfill and deliver the order, depositing your net commission into your balance.'
      },
      {
        cat: 'integrations',
        q: 'How do I connect my YouCan store to SILACOD?',
        a: 'Go to Dashboard > Integrations & APIs, and click "Connect YouCan". Authorize the app via YouCan OAuth, and your store orders will sync automatically.'
      },
      {
        cat: 'logistics',
        q: 'When and how can I withdraw my profits?',
        a: 'Once cash is collected upon delivery, funds become available in your wallet. You can request a payout to your Moroccan bank account (RIB) at any time.'
      },
      {
        cat: 'sellers',
        q: 'What is the Custom Branding & Private Label service?',
        a: 'We allow sellers to print custom logos, stickers, and branded packaging on products to build a professional Private Label brand and foster customer loyalty.'
      },
      {
        cat: 'general',
        q: 'Can I switch between Seller and Affiliate modes?',
        a: 'Yes, you can seamlessly switch between Seller Mode and Affiliate Mode directly from the top header toggle inside your user dashboard.'
      }
    ]
  }
};

export default function FaqPage() {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.fr;
  const isRtl = language === 'ar';
  const textAlign = isRtl ? 'text-right' : 'text-left';
  const flexAlign = isRtl ? 'justify-start flex-row-reverse' : 'justify-start flex-row';

  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const filteredFaqs = t.faqs.filter(faq => {
    const matchesCategory = activeCategory === 'all' || faq.cat === activeCategory;
    const matchesSearch = faq.q.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          faq.a.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-['29LT_Kaff',_Cairo,_Inter,_sans-serif] text-slate-700 relative overflow-x-hidden selection:bg-[#ff5722]/10 selection:text-[#ff5722]">
      <Seo page="faq" />
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

        {/* Page Title Hero (Centered) */}
        <div className="space-y-4 mb-12 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#ff5722] to-[#e64a19] text-white mx-auto mb-1 shadow-lg shadow-[#ff5722]/20">
            <HelpCircle size={26} className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-4xl sm:text-5xl font-black text-[#2e315e] tracking-tight leading-none bg-gradient-to-r from-[#2e315e] via-[#2e315e] to-[#ff5722] bg-clip-text text-transparent inline-block">
              {t.title}
            </h1>
          </div>
          <p className="text-slate-500 font-extrabold tracking-wider text-xs sm:text-sm uppercase opacity-90 max-w-2xl mx-auto">
            {t.subtitle}
          </p>

          {/* Instant Search Bar (Centered & Full-width Alignment) */}
          <div className="pt-4 max-w-2xl mx-auto">
            <div className="relative">
              <Search className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5`} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t.searchPlaceholder}
                className={`w-full bg-white/90 border border-slate-200 text-slate-800 rounded-2xl ${isRtl ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-4 font-bold text-sm focus:outline-none focus:border-[#ff5722] focus:ring-4 focus:ring-[#ff5722]/10 transition-all shadow-sm`}
              />
            </div>
          </div>
        </div>

        {/* Category Tabs (Flex-wrap layout - clean presentation with zero scrollbar) */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mb-10 px-1" dir={isRtl ? 'rtl' : 'ltr'}>
          {t.categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-wider whitespace-nowrap shrink-0 transition-all border ${
                  isActive 
                    ? 'bg-gradient-to-r from-[#ff5722] to-[#e64a19] text-white border-[#ff5722] shadow-md shadow-[#ff5722]/20 scale-[1.02]' 
                    : 'bg-white/80 text-slate-500 border-slate-200/80 hover:bg-white hover:text-[#2e315e]'
                }`}
              >
                <Icon size={14} />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* FAQ Accordion List Card */}
        <div className={`bg-white/80 backdrop-blur-md rounded-[2.5rem] p-6 sm:p-10 shadow-[0_10px_35px_rgba(0,0,0,0.015)] border border-slate-100/80 space-y-4 ${textAlign}`} dir={isRtl ? 'rtl' : 'ltr'}>
          {filteredFaqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div 
                key={idx}
                className="border border-slate-100 rounded-2xl overflow-hidden transition-all bg-slate-50/50 hover:bg-slate-50"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className={`w-full p-5 sm:p-6 flex items-center justify-between gap-4 transition-colors ${flexAlign}`}
                >
                  <h3 className="text-base sm:text-lg font-black text-[#2e315e] flex-1 leading-snug">
                    {faq.q}
                  </h3>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all ${isOpen ? 'bg-[#ff5722] text-white rotate-180 shadow-md shadow-[#ff5722]/20' : 'bg-white text-slate-400 border border-slate-200'}`}>
                    <ChevronDown size={18} />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 sm:px-6 pb-6 pt-1 text-slate-600 text-sm sm:text-base font-semibold leading-relaxed border-t border-slate-200/60 animate-in fade-in duration-200">
                    <p className="bg-white p-4 rounded-xl border border-slate-100 text-slate-600">
                      {faq.a}
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {filteredFaqs.length === 0 && (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <HelpCircle className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-60" />
              <h4 className="text-base font-extrabold text-[#2e315e] mb-1">{t.noResultsTitle}</h4>
              <p className="text-slate-500 text-xs font-semibold">{t.noResultsDesc}</p>
            </div>
          )}

          {/* Security & Support Box */}
          <div className="border-t border-slate-100 pt-8 mt-10">
            <div className={`bg-gradient-to-br from-[#ff5722]/5 to-[#2e315e]/5 border border-[#ff5722]/15 rounded-[2rem] p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 ${isRtl ? 'md:flex-row-reverse text-right' : 'md:flex-row text-left'}`}>
              <div className={`flex items-start gap-4 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className="bg-gradient-to-br from-[#ff5722] to-[#e64a19] text-white w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#ff5722]/20">
                  <ShieldCheck size={22} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-extrabold text-[#2e315e]">{t.stillHaveQuestions}</h4>
                  <p className="text-xs sm:text-sm text-slate-500 font-semibold leading-relaxed">
                    {t.supportSubtitle}
                  </p>
                </div>
              </div>

              {/* Action Buttons with Single-Line Guarantee */}
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
                <a
                  href="mailto:support@silacod.com"
                  className="w-full sm:w-auto px-5 py-3.5 bg-gradient-to-r from-[#2e315e] to-indigo-950 hover:from-[#ff5722] hover:to-[#e64a19] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                >
                  <Mail size={15} />
                  support@silacod.com
                </a>
                <Link
                  to="/contact"
                  className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-slate-100 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 shadow-sm"
                >
                  <MessageCircle size={15} />
                  {t.contactUs}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-10 text-center text-xs text-slate-400 font-semibold mt-16">
        <div className="max-w-7xl mx-auto px-6 space-y-3">
          <p className="text-slate-500 font-bold">{t.footerText}</p>
          <div className="flex justify-center gap-4 text-[13px]">
            <Link to="/privacy" className="hover:text-[#ff5722] transition-colors">{t.privacyPolicy}</Link>
            <span className="text-slate-300">•</span>
            <Link to="/terms" className="hover:text-[#ff5722] transition-colors">{t.termsOfUse}</Link>
            <span className="text-slate-300">•</span>
            <Link to="/contact" className="hover:text-[#ff5722] transition-colors">{t.contactUs}</Link>
          </div>
          <FooterMeta />
        </div>
      </footer>
    </div>
  );
}

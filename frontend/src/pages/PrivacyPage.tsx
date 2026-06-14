import { Link } from 'react-router-dom';
import { Shield, Eye, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSwitcherWidget from '../components/common/LanguageSwitcherWidget';

const translations = {
  ar: {
    backToHome: "العودة إلى الرئيسية",
    login: "تسجيل الدخول",
    title: "سياسة الخصوصية",
    subtitle: "سياسة الخصوصية — آخر تحديث: يونيو 2026",
    commitmentTitle: "التزامنا بحماية معطياتكم الشخصية",
    commitmentDesc: "خصوصيتكم وأمن بياناتكم هي أولويتنا القصوى في SILACOD. نلتزم بحماية كافة معطياتكم الشخصية ومعالجتها بشفافية ومسؤولية كاملة وفقاً للتشريعات والمقتضيات القانونية المعمول بها بالمملكة المغربية.",
    footerText: "© 2026 SILACOD. جميع الحقوق محفوظة.",
    termsOfUse: "شروط الاستخدام",
    contactUs: "اتصل بنا",
    sections: [
      {
        title: "1. جمع البيانات الشخصية (Collecte des Données)",
        text: "نقوم بجمع فئات مختلفة من البيانات لتقديم خدماتنا وتحسينها: \n- معطيات الهوية والاتصال: الاسم الكامل، البريد الإلكتروني، ورقم الهاتف عند التسجيل.\n- المعطيات المهنية والتجارية: وثائق الهوية (CIN) والسجل التجاري (RC) أو بطاقة المقاول الذاتي للبائعين.\n- المعطيات المالية: الحساب البنكي ومعلومات الـ RIB لضمان صرف وتحويل عمولاتك وأرباحك.\n- معطيات التواصل الاجتماعي: أسماء المستخدمين وإحصائيات الحسابات للمؤثرين.\n- البيانات التقنية: عنوان الـ IP، نوع المتصفح، تفاصيل الجهاز، وسجلات الدخول لتأمين حسابك."
      },
      {
        title: "2. كيفية استخدام ومعالجة بياناتك (Utilisation des Données)",
        text: "تُستخدم البيانات التي يتم جمعها لأغراض محددة وشرعية:\n- إدارة وتفعيل حسابك الشخصي وتقديم الدعم الفني اللازم.\n- معالجة وتتبع الشحنات وتنسيق التوصيل والدفع عند الاستلام (COD) مع شركات النقل الشريكة بالمغرب.\n- احتساب الأرباح والعمولات بدقة تامة وتسهيل عملية تحويل المستحقات والفوترة.\n- تأمين المنصة ومراقبة العمليات لمنع الأنشطة الاحتيالية أو الحسابات الوهمية.\n- تحسين تجربة الاستخدام من خلال تحليل الأداء وإرسال إشعارات وتحديثات هامة حول الخدمة."
      },
      {
        title: "3. مشاركة البيانات مع أطراف ثالثة (Partage avec des Tiers)",
        text: "نحن لا نبيع، ولا نؤجر، ولا نتاجر بمعطياتك الشخصية مع أي طرف ثالث لأغراض تسويقية. تتم مشاركة البيانات فقط مع:\n- شركات الخدمات اللوجستية والشحن الشريكة (لتسهيل توصيل الطلبيات وإدارتها).\n- بوابات الدفع الإلكتروني المعتمدة لمعالجة المعاملات المالية بشكل آمن.\n- مزودي خدمات الرسائل النصية (SMS) لإرسال إشعارات تأكيد وتتبع الطلبيات.\n- السلطات القضائية أو الحكومية المختصة عند وجود التزام قانوني يقتضي ذلك."
      },
      {
        title: "4. أمن وتشفير البيانات (Sécurité et Cryptage)",
        text: "نطبق معايير أمان فنية وتدابير تنظيمية صارمة لحماية معطياتك الشخصية من الضياع، السرقة، أو الوصول غير المصرح به:\n- استخدام بروتوكولات التشفير الآمنة (SSL/TLS) لحماية البيانات أثناء نقلها.\n- تشفير كلمات المرور الخاصة بالمستخدمين في قواعد البيانات بطرق غير قابلة للاسترجاع (Hashed Passwords).\n- تقييد الوصول إلى البيانات الشخصية للموظفين والمطورين إلا للضرورة القصوى المتعلقة بالعمل وبصلاحيات محددة.\n- مراجعة وتحديث جدران الحماية الأمنية والأنظمة بشكل دوري لمواجهة التهديدات السيبرانية."
      },
      {
        title: "5. مدة الاحتفاظ بالبيانات (Conservation des Données)",
        text: "نحتفظ بمعطياتك الشخصية طوال فترة نشاط حسابك على منصة SILACOD. كما قد نحتفظ ببعض البيانات لفترات أطول بعد إغلاق الحساب تماشياً مع القوانين التجارية والمالية المغربية (مثل الالتزامات المحاسبية، الفوترة، والالتزامات الضريبية التي تفرض الاحتفاظ بالسجلات لمدد قانونية محددة)."
      },
      {
        title: "6. ملفات تعريف الارتباط وتتبع العمولات (Cookies & Tracking)",
        text: "تستخدم المنصة ملفات تعريف الارتباط (Cookies) لتحسين تجربة التصفح وحفظ جلسات تسجيل الدخول. بالنسبة للمؤثرين، نستخدم ملفات تعريف خاصة لتتبع روابط الإحالة وحساب العمولات بدقة عند إتمام أي عملية بيع من خلال روابطهم. يمكنك إدارة وتعديل إعدادات ملفات تعريف الارتباط من خلال إعدادات متصفحك."
      },
      {
        title: "7. الحقوق القانونية للمستخدمين - القانون رقم 09-08 (Vos Droits)",
        text: "امتثالاً لمقتضيات القانون المغربي رقم 09-08 المتعلق بحماية الأشخاص الذاتيين تجاه معالجة المعطيات ذات الطابع الشخصي، فإنك تتمتع بالحقوق التالية:\n- الحق في الوصول إلى معطياتك ومعرفة كيفية معالجتها.\n- الحق في طلب تصحيح أو تحديث المعطيات غير الدقيقة أو غير المكتملة.\n- الحق في طلب حذف معطياتك الشخصية عند انتهاء الغرض من معالجتها.\n- الحق في الاعتراض على معالجة معطياتك لأسباب مشروعة.\nيمكنك ممارسة هذه الحقوق في أي وقت عن طريق تعديل إعدادات حسابك أو بالتواصل مع مسؤول حماية المعطيات لدينا مباشرة."
      }
    ]
  },
  fr: {
    backToHome: "Retour à l'accueil",
    login: "Connexion",
    title: "Politique de Confidentialité",
    subtitle: "Politique de Confidentialité — Dernière mise à jour : Juin 2026",
    commitmentTitle: "Notre commitment envers la protection de vos données",
    commitmentDesc: "Votre vie privée est notre priorité absolue chez SILACOD. Nous nous engageons à protéger vos données personnelles et à les traiter en toute transparence et responsabilité, conformément aux réglementations applicables au Maroc.",
    footerText: "© 2026 SILACOD. Tous droits réservés.",
    termsOfUse: "Conditions d'utilisation",
    contactUs: "Contactez-nous",
    sections: [
      {
        title: "1. Collecte des Données Personnelles",
        text: "Nous collectons différentes catégories de données afin de vous fournir et d'améliorer nos services :\n- Données d'identité et de contact : Nom complet, adresse e-mail et numéro de téléphone lors de votre inscription.\n- Données professionnelles : Pièce d'identité (CIN), Registre de Commerce (RC), ou carte d'auto-entrepreneur pour les vendeurs.\n- Données financières : Coordonnées bancaires et RIB pour assurer le transfert sécurisé de vos gains et commissions.\n- Données de réseaux sociaux : Noms d'utilisateur et statistiques d'engagement pour les influenceurs.\n- Données techniques : Adresse IP, type de navigateur, informations système et journaux d'accès pour assurer la sécurité de votre compte."
      },
      {
        title: "2. Utilisation et Traitement des Données",
        text: "Vos données personnelles sont traitées pour des finalités spécifiques, légitimes et limitées :\n- Gestion et activation de votre compte utilisateur et fourniture du support technique.\n- Traitement, suivi des expéditions et livraison des colis en paiement à la livraison (COD) via nos transporteurs partenaires au Maroc.\n- Calcul précis des commissions et gains d'affiliation, facturation et exécution des virements financiers.\n- Sécurisation de la plateforme, détection et prévention de la fraude ou des faux profils/commandes.\n- Amélioration de l'expérience utilisateur et envoi d'annonces ou de notifications système importantes."
      },
      {
        title: "3. Partage des Données avec des Tiers",
        text: "Nous ne vendons, ne louons et ne commercialisons pas vos données personnelles. Le partage est strictement limité aux prestataires essentiels suivants :\n- Entreprises logistiques et transporteurs partenaires (pour la livraison effective des colis).\n- Passerelles de paiement sécurisées pour la gestion des transactions financières.\n- Prestataires d'envoi de SMS (pour la confirmation OTP et le suivi des commandes par les clients).\n- Autorités judiciaires ou étatiques compétentes lorsqu'une obligation légale l'exige."
      },
      {
        title: "4. Sécurité et Chiffrement des Données",
        text: "Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles rigoureuses pour protéger vos données contre la perte, le vol ou l'accès non autorisé :\n- Utilisation de protocoles de communication sécurisés (SSL/TLS) pour le transfert des données.\n- Hachage sécurisé et non réversible des mots de passe des utilisateurs dans nos bases de données.\n- Restriction stricte des accès aux données personnelles aux seuls employés autorisés pour les besoins de leur travail.\n- Audits réguliers, mise à jour des pare-feux et protection contre les menaces et vulnérabilités cybernétiques."
      },
      {
        title: "5. Durée de Conservation des Données",
        text: "Nous conservons vos données personnelles tant que votre compte SILACOD reste actif. Après la fermeture du compte, certaines données peuvent être conservées plus longtemps conformément aux lois commerciales et fiscales marocaines (conservation des factures, pièces comptables et justificatifs de paiement pendant les durées légales)."
      },
      {
        title: "6. Cookies et Suivi de l'Affiliation",
        text: "Notre plateforme utilise des cookies pour optimiser votre navigation et maintenir vos sessions ouvertes. Pour les influenceurs, nous utilisons des technologies de suivi des liens de parrainage (tracking cookies) pour attribuer et enregistrer fidèlement chaque commission générée par leurs ventes. Vous pouvez configurer et refuser les cookies dans les paramètres de votre navigateur."
      },
      {
        title: "7. Vos Droits Légaux - Loi n° 09-08",
        text: "Conformément à la loi marocaine n° 09-08 relative à la protection des personnes physiques à l'égard du traitement des données à caractère personnel, vous disposez des droits suivants :\n- Droit d'accès : Obtenir la confirmation que des données vous concernant sont traitées et en recevoir copie.\n- Droit de rectification : Demander la correction ou la mise à jour de données inexactes ou incomplètes.\n- Droit de suppression : Demander l'effacement de vos données personnelles sous certaines conditions.\n- Droit d'opposition : Vous opposer pour des motifs légitimes au traitement de vos données.\nVous pouvez exercer ces droits à tout moment en modifiant votre profil ou en contactant notre Délégué à la Protection des Données (DPO)."
      }
    ]
  },
  en: {
    backToHome: "Back to Home",
    login: "Login",
    title: "Privacy Policy",
    subtitle: "Privacy Policy — Last updated: June 2026",
    commitmentTitle: "Our Commitment to Personal Data Protection",
    commitmentDesc: "Your privacy and data security are our top priorities at SILACOD. We are committed to protecting your personal data and processing it transparently and responsibly in compliance with the applicable legislation in Morocco.",
    footerText: "© 2026 SILACOD. All rights reserved.",
    termsOfUse: "Terms of Use",
    contactUs: "Contact Us",
    sections: [
      {
        title: "1. Personal Data Collection",
        text: "We collect various categories of data to provide and continuously improve our services:\n- Identity and Contact Data: Full name, email address, and phone number provided during registration.\n- Professional and Commercial Data: ID document (CIN), Commercial Register (RC), or self-entrepreneur certificate for vendors.\n- Financial Details: Bank account numbers and RIB to securely transfer your earnings and affiliate commissions.\n- Social Media Info: Usernames and account reach statistics for influencers.\n- Technical Data: IP address, browser type, system info, and access logs to secure your account."
      },
      {
        title: "2. How We Use and Process Your Data",
        text: "Your personal data is processed for specific, legitimate, and limited purposes:\n- Operating and activating your user account, as well as providing customer support.\n- Processing, dispatching, and managing cash-on-delivery (COD) shipping through our partner carriers in Morocco.\n- Calculating affiliate commissions and earnings accurately, handling billing and processing bank transfers.\n- Securing the platform by detecting and preventing fraudulent profiles, accounts, or fake orders.\n- Improving user experience, analyzing platform performance, and sending important service notifications."
      },
      {
        title: "3. Data Sharing with Third Parties",
        text: "We do not sell, rent, or trade your personal data for commercial purposes. Data is shared strictly with the following necessary service providers:\n- Partner shipping and logistics companies (to facilitate package delivery and tracking).\n- Secured payment gateways to process financial transactions.\n- SMS gateway providers (to send OTP verification and order tracking notifications to clients).\n- Competent legal or governmental authorities if required by law."
      },
      {
        title: "4. Data Security and Encryption",
        text: "We implement advanced technical and organizational security measures to protect your personal data from loss, theft, or unauthorized access:\n- Secure transmission protocols (SSL/TLS) to encrypt all data in transit.\n- Non-reversible hashing of user passwords in databases to prevent compromise.\n- Restricting personal data access strictly to authorized personnel who require it for operational purposes.\n- Routine security updates, firewall deployments, and threat monitoring to defend against cyberattacks."
      },
      {
        title: "5. Data Retention Period",
        text: "We retain your personal data as long as your SILACOD account is active. Upon account deletion, we may retain specific records longer as mandated by Moroccan commercial and tax regulations (such as keeping financial invoices and payout records for required compliance periods)."
      },
      {
        title: "6. Cookies and Affiliate Tracking",
        text: "The platform uses cookies to improve navigation and manage active user sessions. For influencers, tracking cookies are used to trace referral link clicks and accurately attribute generated sales to their corresponding commissions. You can manage or disable cookie settings in your browser."
      },
      {
        title: "7. Your Legal Rights - Law No. 09-08",
        text: "Under Moroccan Law No. 09-08 on the protection of individuals with regard to the processing of personal data, you have the following rights:\n- Right to Access: Confirm if your personal data is processed and obtain a copy of it.\n- Right to Rectification: Request the correction or update of inaccurate or incomplete information.\n- Right to Erasure: Request the deletion of your personal data under certain conditions.\n- Right to Object: Object to the processing of your data on legitimate grounds.\nYou can exercise these rights at any time by editing your account settings or by contacting our Data Protection Officer (DPO)."
      }
    ]
  }
};

export default function PrivacyPage() {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.en;
  const isRtl = language === 'ar';
  const textAlign = isRtl ? 'text-right' : 'text-left';
  const flexAlign = isRtl ? 'justify-start flex-row-reverse' : 'justify-start flex-row';

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
            <Eye size={26} className="animate-pulse" />
          </div>
          <h1 className="pt-1 text-4xl sm:text-5xl font-black text-[#2e315e] tracking-tight leading-none bg-gradient-to-r from-[#2e315e] via-[#2e315e] to-[#ff5722] bg-clip-text text-transparent inline-block">
            {t.title}
          </h1>
          <p className="text-slate-500 font-extrabold tracking-wider text-xs sm:text-sm uppercase opacity-90">
            {t.subtitle}
          </p>
        </div>

        {/* Legal Text Card */}
        <div className={`bg-white/80 backdrop-blur-md rounded-[2.5rem] p-8 sm:p-12 shadow-[0_10px_35px_rgba(0,0,0,0.015)] border border-slate-100/80 space-y-10 ${textAlign}`} dir={isRtl ? 'rtl' : 'ltr'}>
          {t.sections.map((section, idx) => (
            <section key={idx} className="space-y-4">
              <h2 className={`text-xl font-black text-[#2e315e] flex items-center gap-3 ${flexAlign}`}>
                <span className="w-2.5 h-6 bg-gradient-to-b from-[#ff5722] to-[#e64a19] rounded-full shrink-0" />
                {section.title}
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-semibold whitespace-pre-line">
                {section.text}
              </p>
            </section>
          ))}

          {/* Divider */}
          <div className="border-t border-slate-100 my-8" />

          {/* Security Alert Box */}
          <div className={`bg-gradient-to-br from-[#ff5722]/5 to-[#2e315e]/5 border border-[#ff5722]/15 rounded-[2rem] p-6 sm:p-8 flex gap-6 items-start ${isRtl ? 'flex-row-reverse text-right' : 'flex-row text-left'}`}>
            <div className="bg-gradient-to-br from-[#ff5722] to-[#e64a19] text-white w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#ff5722]/20">
              <Shield size={24} className="animate-pulse" />
            </div>
            <div className="space-y-2 flex-1">
              <h4 className="text-lg font-extrabold text-[#2e315e]">{t.commitmentTitle}</h4>
              <p className="text-sm text-slate-500 leading-relaxed font-semibold">
                {t.commitmentDesc}
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
            <Link to="/contact" className="hover:text-[#ff5722] transition-colors">{t.contactUs}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

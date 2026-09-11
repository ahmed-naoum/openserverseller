import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowDownToLine, ArrowUpRight, Banknote, BarChart3, Bell, Boxes, Check, ChevronDown, CircleHelp, Clock, Eye, Globe, LayoutDashboard, LifeBuoy, Link2, ListOrdered, MessageCircle, Package, Phone, Plus, QrCode, Search, ShieldAlert, ShoppingCart, Smartphone, TrendingUp, Truck, User, Users, Wallet } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { APK_RELEASE } from './mobileAppRelease';
import './MobileAppDownload.css';

const content = {
  fr: {
    label: 'SILACOD, VERSION MOBILE', badge: 'Disponible sur Android',
    title: 'Votre business.', accent: 'Toujours avec vous.',
    intro: 'Un œil sur vos commandes. Vos chiffres à portée de main. Vos liens prêts à partager. Retrouvez votre espace SILACOD, où que vous soyez.',
    download: 'Télécharger pour Android', scan: 'Scanner avec mon téléphone', qr: 'Scannez ce code avec votre appareil photo pour ouvrir cette page sur votre téléphone.',
    preview: 'Version découverte', free: 'Téléchargement gratuit', compatible: 'Android 7+ · ARM 64 bits',
    iphone: 'Sur iPhone ?', web: 'Utiliser la version web',
    tabs: ['Commandes', 'Statistiques', 'Liens'],
    descriptions: ['Gardez vos commandes à portée de main.', 'Retrouvez vos indicateurs dans un seul espace.', 'Retrouvez et partagez vos liens de vente.'],
    illustration: 'Aperçu illustratif · données de démonstration', greeting: 'Votre activité, en un regard.',
    today: 'Vue d’ensemble', orders: 'Mes commandes', revenue: 'Chiffre d’affaires', rank: 'Évolution de votre rang', beginner: 'Débutant', next: 'Prochain palier : Silver',
    products: ['Collection Essentiels', 'Sélection Maison', 'Collection du moment'], statuses: ['Confirmée', 'En cours', 'Nouvelle'],
    active: 'Lien actif', links: 'Mes liens', copied: 'Prêts à partager', clicks: 'Visiteurs', sales: 'Commandes',
    screen: {
      balance: 'Solde disponible', withdraw: 'Retirer', earned: 'Gagné sur la période', withdrawn: 'Total retiré',
      quick: ['Nouvelle commande', 'Commandes', 'Produits', 'Support'],
      periods: ['7 jours', '30 jours', '90 jours'],
      tiles: ['Commandes', 'Confirmées', 'Taux confirm.', 'Livrées', 'En livraison', 'Retours'],
      caTitle: 'Chiffre d’affaires livré', parcels: 'colis livrés', inOrders: 'en commandes', rateLabel: 'taux de livraison',
      ordersTitle: 'Mes commandes', search: 'Nom, téléphone, ville, n° colis…',
      orderStats: ['Leads', 'Confirm.', 'Livraison', 'CA livré'],
      linksTitle: 'Mes liens', linkTiles: ['Vues de page', 'Visiteurs uniques', 'Clics WhatsApp', 'Leads', 'Taux de conv.', 'Gains'],
      linkRow: ['Vues', 'Uniques', 'WhatsApp', 'Leads'],
      nav: ['Accueil', 'Commandes', 'Produits', 'Portefeuille', 'Profil'], currency: 'DH',
      leadNames: ['Youssef B.', 'Salma E.', 'Mehdi A.'], leadCities: ['Casablanca', 'Marrakech', 'Agadir'],
      leadAgo: ['il y a 5 min', 'il y a 22 min', 'il y a 1 h'],
      fraud: 'Numéro à 2 noms',
    },
    install: 'Première installation ? On vous guide.', steps: [
      ['Téléchargez le fichier', 'Ouvrez cette page sur votre téléphone Android et appuyez sur le bouton de téléchargement.'],
      ['Installez SILACOD', 'Ouvrez le fichier APK téléchargé. Si Android le demande, autorisez l’installation depuis votre navigateur. Vous pouvez retirer cette autorisation ensuite.'],
      ['Retrouvez votre espace', 'Ouvrez SILACOD et connectez-vous avec votre compte habituel. Votre activité vous attend.'],
    ],
    help: 'Besoin d’un coup de main ?', contact: 'Contacter notre équipe',
    direct: 'Installation directe par APK. Ce fichier est destiné aux téléphones Android compatibles ; il ne s’installe pas sur iPhone.',
  },
  en: {
    label: 'SILACOD GOES MOBILE', badge: 'Available for Android',
    title: 'Your business.', accent: 'Always with you.',
    intro: 'Your orders in view. Your numbers at your fingertips. Your links ready to share. Take your SILACOD workspace wherever your day takes you.',
    download: 'Download for Android', scan: 'Scan with my phone', qr: 'Scan this code with your camera to open this page on your phone.',
    preview: 'Preview release', free: 'Free download', compatible: 'Android 7+ · ARM 64-bit',
    iphone: 'On iPhone?', web: 'Use the web version',
    tabs: ['Orders', 'Statistics', 'Links'],
    descriptions: ['Keep your orders close at hand.', 'See your key numbers in one place.', 'Find and share your sales links.'],
    illustration: 'Illustrative preview · demo data', greeting: 'Your business at a glance.',
    today: 'Overview', orders: 'My orders', revenue: 'Revenue', rank: 'Rank progression', beginner: 'Beginner', next: 'Next rank: Silver',
    products: ['Essentials Collection', 'Home Selection', 'Featured Collection'], statuses: ['Confirmed', 'In progress', 'New'],
    active: 'Active link', links: 'My links', copied: 'Ready to share', clicks: 'Visitors', sales: 'Orders',
    screen: {
      balance: 'Available balance', withdraw: 'Withdraw', earned: 'Earned this period', withdrawn: 'Total withdrawn',
      quick: ['New order', 'Orders', 'Products', 'Support'],
      periods: ['7 days', '30 days', '90 days'],
      tiles: ['Orders', 'Confirmed', 'Confirm. rate', 'Delivered', 'In transit', 'Returns'],
      caTitle: 'Delivered revenue', parcels: 'parcels delivered', inOrders: 'in orders', rateLabel: 'delivery rate',
      ordersTitle: 'My orders', search: 'Name, phone, city, parcel no.…',
      orderStats: ['Leads', 'Confirm.', 'Delivery', 'Revenue'],
      linksTitle: 'My links', linkTiles: ['Page views', 'Unique visitors', 'WhatsApp clicks', 'Leads', 'Conv. rate', 'Earnings'],
      linkRow: ['Views', 'Unique', 'WhatsApp', 'Leads'],
      nav: ['Home', 'Orders', 'Products', 'Wallet', 'Profile'], currency: 'DH',
      leadNames: ['Youssef B.', 'Salma E.', 'Mehdi A.'], leadCities: ['Casablanca', 'Marrakech', 'Agadir'],
      leadAgo: ['5 min ago', '22 min ago', '1 h ago'],
      fraud: 'One number, 2 names',
    },
    install: 'First installation? Let’s walk through it.', steps: [
      ['Download the file', 'Open this page on your Android phone and tap the download button.'],
      ['Install SILACOD', 'Open the downloaded APK. If Android asks, allow installation from your browser. You can remove this permission afterwards.'],
      ['Make yourself at home', 'Open SILACOD and sign in with your usual account. Your workspace is ready for you.'],
    ],
    help: 'Need a hand?', contact: 'Contact our team',
    direct: 'Direct APK installation. This file is for compatible Android phones; it cannot be installed on iPhone.',
  },
  ar: {
    label: 'SILACOD على هاتفك', badge: 'متوفر على Android',
    title: 'تجارتك بين يديك.', accent: 'أينما كنت.',
    intro: 'طلباتك أمامك، أرقامك قريبة منك، وروابطك جاهزة للمشاركة. خذ معك مساحة عملك على SILACOD، أينما يأخذك يومك.',
    download: 'تحميل تطبيق Android', scan: 'امسح الرمز بهاتفك', qr: 'امسح هذا الرمز بكاميرا هاتفك لفتح هذه الصفحة على هاتفك.',
    preview: 'نسخة تجريبية', free: 'تحميل مجاني', compatible: 'Android 7+ · ARM 64-bit',
    iphone: 'تستعمل iPhone؟', web: 'استخدم نسخة الويب',
    tabs: ['الطلبات', 'الإحصائيات', 'الروابط'],
    descriptions: ['طلباتك قريبة منك في كل وقت.', 'مؤشرات نشاطك في مكان واحد.', 'اعثر على روابط البيع وشاركها بسهولة.'],
    illustration: 'معاينة توضيحية · بيانات تجريبية', greeting: 'نظرة واحدة على نشاطك.',
    today: 'نظرة عامة', orders: 'طلباتي', revenue: 'رقم المعاملات', rank: 'تطور رتبتك', beginner: 'مبتدئ', next: 'المستوى التالي: فضي',
    products: ['مجموعة الأساسيات', 'تشكيلة المنزل', 'مجموعة الموسم'], statuses: ['مؤكدة', 'قيد المعالجة', 'جديدة'],
    active: 'رابط نشط', links: 'روابطي', copied: 'جاهزة للمشاركة', clicks: 'الزوار', sales: 'الطلبات',
    screen: {
      balance: 'الرصيد المتاح', withdraw: 'سحب', earned: 'أرباح الفترة', withdrawn: 'إجمالي المسحوب',
      quick: ['طلب جديد', 'الطلبات', 'المنتجات', 'الدعم'],
      periods: ['7 أيام', '30 يوم', '90 يوم'],
      tiles: ['الطلبات', 'مؤكدة', 'نسبة التأكيد', 'مُسلّمة', 'قيد التوصيل', 'مرتجعة'],
      caTitle: 'رقم المعاملات المُسلّم', parcels: 'طرد مُسلّم', inOrders: 'في الطلبات', rateLabel: 'نسبة التوصيل',
      ordersTitle: 'طلباتي', search: 'الاسم، الهاتف، المدينة، رقم الطرد…',
      orderStats: ['العملاء', 'مؤكدة', 'التوصيل', 'المبيعات'],
      linksTitle: 'روابطي', linkTiles: ['مشاهدات الصفحة', 'زوار فريدون', 'نقرات واتساب', 'العملاء', 'نسبة التحويل', 'الأرباح'],
      linkRow: ['مشاهدات', 'فريدون', 'واتساب', 'عملاء'],
      nav: ['الرئيسية', 'الطلبات', 'المنتجات', 'المحفظة', 'الملف'], currency: 'د.م.',
      leadNames: ['يوسف ب.', 'سلمى إ.', 'مهدي أ.'], leadCities: ['الدار البيضاء', 'مراكش', 'أكادير'],
      leadAgo: ['قبل 5 د', 'قبل 22 د', 'قبل ساعة'],
      fraud: 'رقم باسمين',
    },
    install: 'أول تثبيت؟ نرافقك خطوة بخطوة.', steps: [
      ['حمّل الملف', 'افتح هذه الصفحة على هاتف Android واضغط على زر التحميل.'],
      ['ثبّت SILACOD', 'افتح ملف APK الذي حمّلته. إذا طلب Android ذلك، اسمح بالتثبيت من متصفحك. يمكنك إلغاء هذا الإذن بعد التثبيت.'],
      ['ادخل إلى مساحة عملك', 'افتح SILACOD وسجّل الدخول بحسابك المعتاد. نشاطك في انتظارك.'],
    ],
    help: 'تحتاج مساعدة؟', contact: 'تواصل مع فريقنا',
    direct: 'تثبيت مباشر عبر APK. هذا الملف مخصص لهواتف Android المتوافقة، ولا يمكن تثبيته على iPhone.',
  },
};
const icons = [Package, BarChart3, Link2];
/** The app's real bottom bar: Accueil, Commandes, Produits, Portefeuille, Profil. */
const navIcons = [LayoutDashboard, ShoppingCart, Boxes, Wallet, User];
/** Which real tab each showcase screen lives under (Liens sits under Produits). */
const navForFeature = [1, 0, 2];
/** Demo figures. Deliberately not anyone's real numbers - this is a public page. */
const demo = {
  balance: '12 480,00', earned: '48 200', withdrawn: '35 720',
  stats: ['320', '196', '61%', '142', '24', '30'],
  revenue: '38 400', parcels: '142', ordersValue: '52 800', rate: '72%',
  orderStats: ['320', '196', '24', '38 400'],
  linkStats: ['4 820', '3 106', '742', '196', '6,3%', '9 240'],
  linkRows: [['246', '184', '42', '16'], ['128', '97', '23', '8']],
  // Sequential digits so the numbers read as placeholders and cannot reach a real subscriber.
  leadPhones: ['06 12 34 56 78', '06 23 45 67 89', '06 34 56 78 90'],
  leadPrices: ['349', '289', '420'],
};

export default function MobileAppDownload() {
  const { language } = useLanguage();
  const copy = content[language as keyof typeof content] || content.fr;
  const reduced = useReducedMotion();
  const [feature, setFeature] = useState(0);
  const sc = copy.screen;
  const size = (APK_RELEASE.bytes / 1_000_000).toLocaleString(language === 'ar' ? 'fr' : language, { maximumFractionDigits: 1 });

  return (
    <section id="application" className="sila-app" aria-labelledby="sila-app-title" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="sila-app__shell">
        <div className="sila-app__main">
          <div className="sila-app__copy">
            <p className="sila-app__eyebrow"><Smartphone size={16} aria-hidden="true" />{copy.label}</p>
            <h2 id="sila-app-title">{copy.title}<br /><span>{copy.accent}</span></h2>
            <p className="sila-app__intro">{copy.intro}</p>
            <div className="sila-app__release"><span className="sila-app__status-dot" />{copy.badge}<span className="sila-app__preview-badge">{copy.preview}</span></div>
            <a className="sila-app__download" href={APK_RELEASE.url} download={APK_RELEASE.filename} aria-describedby="sila-app-compatibility">
              <span className="sila-app__download-icon"><ArrowDownToLine size={23} aria-hidden="true" /></span>
              <span><strong>{copy.download}</strong><small dir="ltr">APK · v{APK_RELEASE.version} · {size} {language === 'en' ? 'MB' : 'Mo'}</small></span>
              <ArrowUpRight size={20} className="sila-app__cta-arrow" aria-hidden="true" />
            </a>
            <p id="sila-app-compatibility" className="sila-app__compatibility"><Check size={14} aria-hidden="true" />{copy.free}<span aria-hidden="true">·</span><bdi>{copy.compatible}</bdi></p>
            <details className="sila-app__qr">
              <summary><QrCode size={17} aria-hidden="true" />{copy.scan}<ChevronDown size={15} aria-hidden="true" /></summary>
              <div className="sila-app__qr-panel"><img src="/images/mobile-app/download-qr.png" width="120" height="120" loading="lazy" alt="QR code — silacod.com/#application" /><p>{copy.qr}</p></div>
            </details>
            <p className="sila-app__iphone">{copy.iphone} <Link to="/login">{copy.web}<ArrowUpRight size={13} aria-hidden="true" /></Link></p>
          </div>

          <div className="sila-app__showcase">
            <img className="sila-app__art" src="/images/mobile-app/commerce-orbit.webp" width="1000" height="1000" loading="lazy" decoding="async" alt="" />
            <div className="sila-app__phone" aria-label={copy.illustration}>
              <div className="sila-app__phone-camera" />
              <div className="sila-app__phone-brand" dir="ltr"><img src="/new logo/logo filess-25.svg" alt="" width="25" height="25" /><span className="sila-app__wordmark">Sila<em>cod</em></span><span className="sila-app__phone-bell"><Bell size={13} aria-hidden="true" /><i>9+</i></span></div>
              <p className="sila-app__phone-greeting">{copy.greeting}</p>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={feature} className="sila-app__screen" initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: reduced ? 1 : 0 }} transition={{ duration: reduced ? 0 : 0.18 }}>
                  {feature === 0 && <>
                    <div className="sila-app__sheet-head"><strong>{sc.ordersTitle}</strong><span dir="ltr">{demo.orderStats[0]}</span></div>
                    <div className="sila-app__search"><Search size={11} aria-hidden="true" /><span>{sc.search}</span></div>
                    <div className="sila-app__statbar">
                      {sc.orderStats.map((label, i) => <span className={`sila-app__statbox sila-app__statbox--${i}`} key={label}>
                        <b dir="ltr">{demo.orderStats[i]}</b><small>{label}</small>
                      </span>)}
                    </div>
                    {copy.products.map((name, i) => <div className="sila-app__lead" key={name}>
                      <div className="sila-app__lead-top">
                        <span className={`sila-app__product sila-app__product--${i}`}><Package size={14} aria-hidden="true" /></span>
                        <div className="sila-app__lead-id">
                          <b>{sc.leadNames[i]}</b>
                          <small><Phone size={7} aria-hidden="true" /><span dir="ltr">{demo.leadPhones[i]}</span> · {sc.leadCities[i]}</small>
                        </div>
                        <span className="sila-app__lead-price" dir="ltr">{demo.leadPrices[i]} {sc.currency}</span>
                      </div>
                      <p className="sila-app__lead-product">{name}</p>
                      {i === 2 && <span className="sila-app__fraud"><ShieldAlert size={8} aria-hidden="true" />{sc.fraud} · 2</span>}
                      <div className="sila-app__lead-foot">
                        <span className={`sila-app__order-status sila-app__order-status--${i}`}>{copy.statuses[i]}</span>
                        <small><Clock size={7} aria-hidden="true" />{sc.leadAgo[i]}</small>
                      </div>
                    </div>)}
                  </>}
                  {feature === 1 && <>
                    <div className="sila-app__wallet">
                      <div className="sila-app__wallet-top">
                        <div><span>{sc.balance}</span><strong dir="ltr">{demo.balance} <small>{sc.currency}</small></strong></div>
                        <span className="sila-app__withdraw"><Wallet size={12} aria-hidden="true" />{sc.withdraw}</span>
                      </div>
                      <div className="sila-app__wallet-split">
                        <div><small>{sc.earned}</small><b dir="ltr">{demo.earned} {sc.currency}</b></div>
                        <div><small>{sc.withdrawn}</small><b dir="ltr">{demo.withdrawn} {sc.currency}</b></div>
                      </div>
                    </div>
                    <div className="sila-app__quick">
                      {[Plus, ShoppingCart, Boxes, LifeBuoy].map((Icon, i) => <span key={i} className={i === 0 ? 'is-primary' : ''}>
                        <i><Icon size={15} aria-hidden="true" /></i><small>{sc.quick[i]}</small>
                      </span>)}
                    </div>
                    <div className="sila-app__chips">{sc.periods.map((label, i) => <span key={label} className={i === 2 ? 'is-active' : ''}>{label}</span>)}</div>
                    <div className="sila-app__tiles">
                      {sc.tiles.map((label, i) => <span className={`sila-app__tile sila-app__tile--${i}`} key={label}>
                        <b dir="ltr">{demo.stats[i]}</b><small>{label}</small>
                      </span>)}
                    </div>
                    <div className="sila-app__ca">
                      <div>
                        <small>{sc.caTitle}</small>
                        <b dir="ltr">{demo.revenue} {sc.currency}</b>
                        <p dir="auto">{demo.parcels} {sc.parcels} · {demo.ordersValue} {sc.currency} {sc.inOrders}</p>
                      </div>
                      <span className="sila-app__rate"><TrendingUp size={12} aria-hidden="true" /><b dir="ltr">{demo.rate}</b><small>{sc.rateLabel}</small></span>
                    </div>
                  </>}
                  {feature === 2 && <>
                    <div className="sila-app__sheet-head"><strong>{sc.linksTitle}</strong><span dir="ltr">03</span></div>
                    <div className="sila-app__tiles sila-app__tiles--links">
                      {sc.linkTiles.map((label, i) => <span className={`sila-app__tile sila-app__tile--l${i}`} key={label}>
                        <i>{[<Eye size={11} />, <Users size={11} />, <MessageCircle size={11} />, <ListOrdered size={11} />, <TrendingUp size={11} />, <Banknote size={11} />][i]}</i>
                        <b dir="ltr">{demo.linkStats[i]}</b><small>{label}</small>
                      </span>)}
                    </div>
                    {copy.products.slice(0, 2).map((name, i) => <div className="sila-app__linkcard" key={name}>
                      <div><b>{name}</b><Link2 size={13} aria-hidden="true" /></div>
                      <small>{copy.active}</small>
                      <p>{sc.linkRow.map((label, j) => <span key={label}>{label}<b dir="ltr">{demo.linkRows[i][j]}</b></span>)}</p>
                    </div>)}
                  </>}
                </motion.div>
              </AnimatePresence>
              <div className="sila-app__phone-nav" aria-hidden="true">{navIcons.map((Icon, i) => <span className={navForFeature[feature] === i ? 'is-active' : ''} key={i}><Icon size={16} /><small>{sc.nav[i]}</small></span>)}</div>
            </div>
            <div className="sila-app__float-label" aria-hidden="true"><span><Check size={15} /></span>{copy.descriptions[feature]}</div>
            <p className="sila-app__illustration">{copy.illustration}</p>
          </div>
        </div>

        <div className="sila-app__features" role="group" aria-label={copy.today}>
          {icons.map((Icon, i) => <button type="button" className={`sila-app__feature ${feature === i ? 'is-active' : ''}`} aria-pressed={feature === i} key={i} onClick={() => setFeature(i)}><span className="sila-app__feature-icon"><Icon size={21} aria-hidden="true" /></span><span><strong>{copy.tabs[i]}</strong><small>{copy.descriptions[i]}</small></span><ArrowUpRight size={17} aria-hidden="true" /></button>)}
        </div>
      </div>

      <details className="sila-app__install">
        <summary><span><CircleHelp size={20} aria-hidden="true" />{copy.install}</span><ChevronDown size={19} aria-hidden="true" /></summary>
        <ol>{copy.steps.map(([title, description], i) => <li key={title}><span className="sila-app__step-number">0{i + 1}</span><h3>{title}</h3><p>{description}</p></li>)}</ol>
        <div className="sila-app__install-footer"><p>{copy.direct}</p><Link to="/contact">{copy.help} {copy.contact}<ArrowUpRight size={14} aria-hidden="true" /></Link></div>
      </details>
    </section>
  );
}

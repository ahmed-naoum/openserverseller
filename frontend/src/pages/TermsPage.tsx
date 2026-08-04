import { Link } from 'react-router-dom';
import { Shield, FileText, ArrowLeft, Scale, Users, Package, Phone, Banknote, AlertTriangle, Lock, Cloud, Gavel, RefreshCw } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Seo } from '../components/Seo';
import { FooterMeta } from '../components/common/FooterMeta';
import LanguageSwitcherWidget from '../components/common/LanguageSwitcherWidget';

const translations = {
  ar: {
    login: "تسجيل الدخول",
    backToHome: "العودة إلى الرئيسية",
    title: "الشروط العامة للاستخدام والخدمات (CGU)",
    subtitle: "المنصة الرقمية: SILACOD",
    lastUpdated: "آخر تحديث: يونيو 2026",
    introP1: "سيلاتود (SILACOD) هي منصة رقمية مغربية رائدة، تملكها وتديرها شركة خاضعة للقانون المغربي SILACOD SARL. وهي متخصصة في تقديم الحلول التكنولوجية واللوجستية والخدمات المتكاملة للتجارة الإلكترونية (الماركت بليس، تأكيد الطلبيات، التغليف النهائي، والربط مع شركات الشحن لإدارة الدفع عند الاستلام - COD).",
    introP2: "يشير مصطلح «المنصة» إلى الموقع الإلكتروني والتطبيقات التابعة لـ SILACOD. ويشير مصطلح «المستخدم» (أو المؤثر/البائع) إلى أي شخص طبيعي أو اعتباري يستخدم خدمات المنصة. إن الوصول إلى المنصة أو استخدام أي من خدماتها يمثل قبولاً صريحاً ونهائياً وغير قابل للإلغاء لشروط الاستخدام العامة الحالية.",
    alertTitle: "الحماية والأمان",
    alertDesc: "إذا كانت لديك أي أسئلة بخصوص شروط الاستخدام العامة هذه، يمكنك الاتصال بفريق الدعم لدينا في أي وقت عبر صفحة الاتصال.",
    footerText: "© 2026 SILACOD SARL. جميع الحقوق محفوظة.",
    privacyPolicy: "سياسة الخصوصية",
    contactUs: "اتصل بنا",
    sections: [
      {
        number: 1,
        title: "الأهلية وإنشاء الحساب",
        icon: Users,
        color: 'indigo',
        items: [
          "يجب أن يكون المستخدم قد بلغ سن الرشد القانوني (18 سنة كاملة) ويتمتع بالأهلية القانونية الكاملة للتعاقد، وفقاً لظهير الالتزامات والعقود المغربي.",
          "في حالة التسجيل باسم شركة أو كيان تجاري، يقر المستخدم ويضمن صراحةً أنه يمتلك الصلاحيات والتفويضات القانونية اللازمة لالتزام الكيان المذكور.",
          "يتعهد المستخدم بتقديم معلومات دقيقة وصحيحة ومحدثة باستمرار. الحساب شخصي تماماً، وهو غير قابل للتنازل أو الانتقال للغير.",
          "يظل المستخدم المسؤول الوحيد عن الحفاظ على سرية بيانات تسجيل الدخول الخاصة به. وتعتبر كل عملية تتم من خلال الحساب صادرة عن المستخدم وتلزمه قانوناً."
        ],
      },
      {
        number: 2,
        title: "طبيعة الخدمات ودور SILACOD (وسيط تكنولوجي ولوجستي)",
        icon: Scale,
        color: 'blue',
        items: [
          { label: "توفير الكتالوج", text: "تتيح المنصة للمستخدم الوصول إلى كتالوج المنتجات (Marketplace) التي توفرها مختبرات ومصانع معتمدة أصولاً." },
          { label: "الوساطة", text: "لا تملك SILACOD صفة البائع ولا المصنع ولا المالك للمنتجات. يقتصر دور الشركة حصرياً على توفير البنية التحتية التكنولوجية التي تربط المستخدم بالمصنعين، بالإضافة إلى تقديم خدمات التعبئة وتأكيد الطلبيات والربط مع ناقلي الشحن. وتلتزم SILACOD ببذل قصارى جهدها لضمان أعلى مستوى من الجودة للمنتجات المقدمة." },
          { label: "الملكية", text: "تظل المنتجات التي يتم تسويقها تحت العلامة التجارية للمستخدم تحت مسؤوليته الحصرية. ولا تعتبر SILACOD بأي حال من الأحوال طرفاً في عقد البيع المبرم بين المستخدم والزبون النهائي." }
        ],
      },
      {
        number: 3,
        title: "التزامات ومسؤوليات المستخدم (البائع / المؤثر)",
        icon: AlertTriangle,
        color: 'amber',
        items: [
          { label: "التمويل المسبق", text: "يلتزم المستخدم بالتمويل المسبق لكمية المنتجات التي يختارها من الكتالوج، وذلك قبل البدء في تسويقها." },
          { label: "المسؤولية القانونية", text: "يتحمل المستخدم المسؤولية القانونية والمدنية والتجارية الكاملة والحصرية عن جودة المنتجات وطبيعتها وسلامتها للمستهلك، وكذلك الادعاءات التسويقية المرتبطة بها. ويخلي المستخدم طرف SILACOD تماماً ودون قيد أو شرط من أي ملاحقة قضائية أو تفتيش رقابي يتعلق بالمنتجات." },
          { label: "الملكية الفكرية", text: "يضمن المستخدم أنه يمتلك الملكية أو الحقوق القانونية لاستخدام الأسماء التجارية والملصقات (Labels) التي يقدمها عبر حسابه، ويتحمل وحده عواقب أي نزاع يتعلق بحقوق الملكية الفكرية. (يُشار إلى أن طباعة الملصقات ووضعها على المنتجات تقع على عاتق المختبر وليس SILACOD)." }
        ],
      },
      {
        number: 4,
        title: "التخزين والتعبئة وتسليم الكبسولات للناقلين",
        icon: Package,
        color: 'emerald',
        items: [
          { label: "استلام وتخزين المنتجات", text: "تحتفظ SILACOD بالحق في استلام المنتجات مباشرة من البائع أو وكيله بغرض التخزين والتحضير في مستودعاتها الخاصة. وتحتفظ الشركة بالحق التقديري في رفض استلام أو تخزين أي منتج يخالف القوانين السارية أو لا يستوفي معايير السلامة المطلوبة." },
          { label: "التغليف وشحن الطرود", text: "تتولى SILACOD التغليف النهائي والاحترافي للمنتجات. وبالنسبة للطرود الجاهزة للشحن، لا تؤمن SILACOD نقلها المباشر؛ بل يقتصر دورها على تسليمها لشركات الشحن الشريكة التي تتولى استلاف الطرود ونقلها وتوصيلها للزبون النهائي." },
          { label: "إخلاء المسؤولية عن التوصيل", text: "تخلي SILACOD مسؤوليتها عن أي تأخير في التوصيل ناتج عن شركات الشحن، وكذلك عن أخطاء العنوان المقدمة من الزبون، أو غيابه أو رفضه لاستلام الطلبية." }
        ],
      },
      {
        number: 5,
        title: "تأكيد الطلبيات (مركز الاتصال وواتساب)",
        icon: Phone,
        color: 'violet',
        items: [
          { label: "المعالجة والاتصالات", text: "تدير SILACOD تأكيد الطلبيات من خلال مركز الاتصال المخصص لها. وتلتزم الشركة بإجراء 6 محاولات اتصال على الأقل مع الزبون، مدعومة برسائل واتساب عند الاقتضاء، لتحسين معدل تأكيد الطلبيات." },
          { label: "خدمة واتساب الحصرية", text: "كبديل، يمكن للمؤثر اختيار تأكيد الطلبيات حصرياً عبر واتساب. ولهذا الغرض، سيتم تزويده برقم هاتف مخصص تابع لأحد شركائنا العاملين مع SILACOD. ويتعين على المؤثر توجيه زبنائه إلى رقم واتساب المذكور والمخصص لفريق التأكيد." }
        ],
      },
      {
        number: 6,
        title: "السياسة المالية، الدفع عند الاستلام (COD) والمرتجع",
        icon: Banknote,
        color: 'teal',
        items: [
          { label: "التحصيل والاقتطاعات", text: "تقوم شركات الشحن الشريكة بتحصيل الأموال (COD) من الزبائن النهائيين. وتضاف هذه الأموال إلى المحفظة الرقمية للمستخدم. ويفوض المستخدم صراحةً SILACOD باقتطاع كافة الرسوم المستحقة (رسوم التأكيد، الشحن، المرتجع ورسوم استخدام المنصة) من أرباحه." },
          { label: "تعويض الزبائن", text: "في حالة إرجاع مبلغ الطلبية للزبون لأي سبب كان، يتحمل البائع (المؤثر) التكلفة الكاملة لهذا التعويض. ويتم خصم هذا المبلغ مباشرة من محفظته الرقمية أو فواتيره أو مستحقاته المالية المستقبلية." }
        ],
      },
      {
        number: 7,
        title: "الاستخدام المقبول ومكافحة الاحتيال",
        icon: Shield,
        color: 'rose',
        items: [
          "يُحظر تماماً استخدام المنصة لأغراض غير قانونية، أو التلاعب بالنظام، أو إنشاء طلبيات وهمية (Fake Orders) بهدف التأثير المصطنع على معدلات التأكيد.",
          "تحتفظ SILACOD بالحق المطلق في تعليق أو إغلاق حساب أي مستخدم بأثر فوري، وتجميد مستحقاته المالية مؤقتاً في حال الكشف عن أي نشاط احتيالي، مع الاحتفاظ بالحق في اتخاذ الإجراءات القانونية والمدنية والجنائية المناسبة."
        ],
      },
      {
        number: 8,
        title: "السرية وحماية البيانات الشخصية",
        icon: Lock,
        color: 'cyan',
        items: [
          "تلتزم المنصة بدقة بأحكام القانون المغربي رقم 09-08 المتعلق بحماية الأشخاص الذاتيين تجاه معالجة المعطيات ذات الطابع الشخصي.",
          "يلتزم الطرفان بالسرية المطلقة لجميع المعلومات والبيانات والتقارير وجداول الأسعار المتبادلة بموجب هذه الشروط. ولا يحق لأي من الطرفين الكشف عن أي معلومات لأطراف ثالثة دون موافقة كتابية مسبقة من الطرف الآخر."
        ],
      },
      {
        number: 9,
        title: "القوة القاهرة",
        icon: Cloud,
        color: 'sky',
        items: [
          "لا يتحمل أي من الطرفين المسؤولية القانونية عن عدم تنفيذ أو التأخر في تنفيذ التزاماته التعاقدية إذا كان ذلك ناتجاً عن ظروف أو حالة قوة قاهرة خارجة عن إرادته المعقولة. ويشمل ذلك على سبيل المثال لا الحصر: الإضرابات العمالية، الكوارث الطبيعية، الأوبئة، القرارات الحكومية الملزمة أو الأحداث غير المتوقعة والمستحيلة الدفع."
        ],
      },
      {
        number: 10,
        title: "تسوية النزاعات والاختصاص القضائي",
        icon: Gavel,
        color: 'orange',
        items: [
          "في حال نشوء أي نزاع أو خلاف يتعلق بتفسير أو تنفيذ أو استخدام خدمات المنصة، يسعى الطرفان أولاً للتوصل إلى تسوية ودية بحسن نية.",
          "وفي حال عدم التوصل إلى اتفاق ودي في غضون ثلاثين (30) يوماً، يتم إسناد الاختصاص الحصري والمطلق للمحكمة التجارية بأكادير للنظر والبت في النزاع المذكور."
        ],
      },
      {
        number: 11,
        title: "التعديلات والقبول الإلكتروني",
        icon: RefreshCw,
        color: 'purple',
        items: [
          "تحتفظ SILACOD بالحق في تعديل وتحديث هذه الشروط العامة للاستخدام في أي وقت. وتدخل هذه التعديلات حيز التنفيذ فور نشرها على المنصة. ويعتبر استمرار المستخدم في استخدام المنصة قبولاً ضمنياً بهذه التحديثات.",
          "وفقاً للتشريع الجاري به العمل المتعلق بالتبادل الإلكتروني للمعطيات القانونية، فإن التسجيل في المنصة أو استخدام خدماتها يعادل قبولاً إلكترونياً صريحاً. ولهذا الإجراء نفس القوة الثبوتية والإلزامية للتوقيع المكتوب والمصادق عليه أصولاً."
        ],
      },
    ]
  },
  fr: {
    login: "Connexion",
    backToHome: "Retour à l'accueil",
    title: "Conditions Générales d'Utilisation (CGU)",
    subtitle: "Plateforme Digitale : SILACOD",
    lastUpdated: "Dernière mise à jour : Juin 2026",
    introP1: "SILACOD est une plateforme digitale marocaine de premier plan, détenue et exploitée par la société de droit marocain SILACOD SARL. Elle est spécialisée dans la fourniture de solutions technologiques, logistiques et de services intégrés de commerce électronique (Marketplace, confirmation des commandes, emballage final et interfaçage avec les transporteurs pour la gestion du paiement à la livraison — COD).",
    introP2: "Le terme « Plateforme » désigne le site web et les applications affiliés à SILACOD. Le terme « Utilisateur » (ou Influenceur/Vendeur) désigne toute personne physique ou morale utilisant les services de la Plateforme. L'accès à la Plateforme ou l'utilisation de l'un de ses services emporte une acceptation expresse, définitive et irrévocable des présentes Conditions Générales d'Utilisation.",
    alertTitle: "Protection et Sécurité",
    alertDesc: "Si vous avez des questions concernant ces conditions générales d'utilisation, vous pouvez contacter notre équipe de support à tout moment via la page de contact.",
    footerText: "© 2026 SILACOD SARL. Tous droits réservés.",
    privacyPolicy: "Politique de confidentialité",
    contactUs: "Contactez-nous",
    sections: [
      {
        number: 1,
        title: "Éligibilité et Création de Compte",
        icon: Users,
        color: 'indigo',
        items: [
          "L'Utilisateur doit avoir atteint l'âge de la majorité légale (18 ans révolus) et jouir de la pleine capacité juridique de contracter, conformément au Dahir des Obligations et des Contrats (DOC) marocain.",
          "En cas d'inscription au nom d'une société ou d'une entité commerciale, l'Utilisateur déclare et garantit expressément disposer des mandats et pouvoirs légaux requis pour engager ladite entité.",
          "L'Utilisateur s'engage à fournir des informations exactes, véridiques et dûment actualisées. Le compte revêt un caractère strictement personnel ; il s'avère incessible et intransmissible à tout tiers.",
          "L'Utilisateur demeure le seul et unique responsable de la préservation de la confidentialité de ses identifiants de connexion. Toute opération effectuée via le compte est réputée émaner de l'Utilisateur et l'engage juridiquement.",
        ],
      },
      {
        number: 2,
        title: "Nature des Services et Rôle de SILACOD (Intermédiaire Technologique et Logistique)",
        icon: Scale,
        color: 'blue',
        items: [
          { label: "Mise à disposition du Catalogue", text: "La Plateforme offre à l'Utilisateur l'accès à un catalogue de produits (Marketplace) approvisionné par des laboratoires et des fabricants dûment agréés." },
          { label: "Médiation", text: "SILACOD n'arbore ni la qualité de vendeur, ni celle de fabricant, ni celle de propriétaire des produits. Le rôle de la société se cantonne exclusivement à la mise à disposition de l'infrastructure technologique reliant l'Utilisateur aux fabricants, ainsi qu'à la prestation de services d'emballage, de confirmation des commandes et d'interfaçage avec les prestataires de transport. SILACOD s'engage à déployer tous les efforts nécessaires pour garantir le plus haut niveau de qualité des produits fournis par les fabricants aux clients finaux." },
          { label: "Propriété", text: "Les produits commercialisés sous la marque de l'Utilisateur demeurent sous sa responsabilité exclusive. SILACOD n'est, en aucun cas, partie au contrat de vente conclu entre l'Utilisateur et le client final." },
        ],
      },
      {
        number: 3,
        title: "Obligations et Responsabilités de l'Utilisateur (Vendeur / Influenceur)",
        icon: AlertTriangle,
        color: 'amber',
        items: [
          { label: "Préfinancement", text: "L'Utilisateur s'oblige à préfinancer la quantité de produits qu'il sélectionne au sein du catalogue, et ce, préalablement au lancement de leur commercialisation." },
          { label: "Responsabilité Juridique", text: "L'Utilisateur assume une responsabilité juridique, civile et commerciale absolue et exclusive quant à la qualité des produits, leur nature, leur innocuité pour le consommateur, ainsi que les allégations marketing qui y sont associées. L'Utilisateur décharge SILACOD, de manière totale et inconditionnelle, de toute poursuite judiciaire ou inspection réglementaire ayant trait aux produits." },
          { label: "Propriété Intellectuelle", text: "L'Utilisateur garantit qu'il détient la propriété ou les droits légaux d'exploitation des dénominations commerciales et des étiquettes (Labels) qu'il soumet via son compte, et assume seul les conséquences de tout litige relatif aux droits de propriété intellectuelle. (Il est à préciser que l'impression et l'apposition des étiquettes sur les produits incombent au laboratoire, et non à SILACOD)." },
        ],
      },
      {
        number: 4,
        title: "Stockage, Emballage et Remise des Colis aux Transporteurs",
        icon: Package,
        color: 'emerald',
        items: [
          { label: "Réception et Stockage des Produits", text: "SILACOD se réserve le droit de réceptionner les « Produits » (Products) directement auprès du vendeur ou de son mandataire aux fins de stockage et de préparation dans ses propres entrepôts. La société se réserve le droit discrétionnaire de refuser la réception ou le stockage de tout produit contrevenant aux lois en vigueur ou ne satisfaisant pas aux normes de sécurité exigées." },
          { label: "Emballage et Expédition des Colis", text: "SILACOD prend en charge l'emballage final et professionnel des produits. S'agissant des « Colis » (Parcels) prêts à l'expédition, SILACOD n'assure pas leur transport direct ; sa mission se limite à leur remise aux sociétés de messagerie partenaires, lesquelles prennent en charge la réception des colis, leur acheminement et leur livraison au client final." },
          { label: "Exonération de Responsabilité de Livraison", text: "SILACOD décline toute responsabilité quant aux retards de livraison imputables aux sociétés de transport, ainsi que pour les erreurs d'adressage fournies par le client, son absence ou son refus de réceptionner la commande." },
        ],
      },
      {
        number: 5,
        title: "Confirmation des Commandes (Centre d'appels et WhatsApp)",
        icon: Phone,
        color: 'violet',
        items: [
          { label: "Confirmation Téléphonique", text: "SILACOD gère la confirmation des commandes par le biais de son centre d'appels dédié. La société s'engage à effectuer un minimum de 6 tentatives d'appel auprès du client, complétées par des communications via WhatsApp le cas échéant, afin d'optimiser le taux de confirmation des commandes." },
          { label: "Service WhatsApp Exclusif", text: "À titre d'alternative, l'Influenceur peut opter pour la confirmation des commandes exclusivement via WhatsApp. À cet effet, un numéro de téléphone appartenant à l'un de nos prestataires opérant en collaboration avec SILACOD lui sera communiqué. L'Influenceur devra alors rediriger ses clients vers ce numéro WhatsApp dédié à l'équipe de confirmation." },
        ],
      },
      {
        number: 6,
        title: "Politique Financière, Paiement à la Livraison (COD) et Retours",
        icon: Banknote,
        color: 'teal',
        items: [
          { label: "Recouvrement et Prélèvements", text: "Les sociétés de transport partenaires procèdent au recouvrement des fonds (COD) auprès des clients finaux. Ces fonds sont crédités sur le portefeuille numérique (Wallet) de l'Utilisateur. L'Utilisateur autorise expressément SILACOD à déduire de ses bénéfices l'intégralité des frais exigibles (frais de confirmation, de livraison, de retour et frais d'utilisation de la plateforme)." },
          { label: "Remboursement des Clients", text: "En cas de restitution du montant d'une commande au client, pour quelque motif que ce soit, le Vendeur (Influenceur) supporte l'intégralité du coût de ce remboursement. Ledit montant sera directement déduit de son portefeuille numérique, de ses factures ou de ses créances financières futures." },
        ],
      },
      {
        number: 7,
        title: "Utilisation Acceptable et Lutte Contre la Fraude",
        icon: Shield,
        color: 'rose',
        items: [
          "Il est rigoureusement interdit d'utiliser la Plateforme à des fins illégales, de manipuler le système, ou de générer des commandes fictives (Fake Orders) dans le but d'altérer artificiellement les taux de confirmation.",
          "SILACOD se réserve le droit absolu de suspendre ou de clôturer avec effet immédiat le compte de tout Utilisateur, et de geler temporairement ses avoirs financiers en cas de détection d'une quelconque activité frauduleuse, tout en se réservant le droit d'engager des poursuites judiciaires pécuniaires et pénales.",
        ],
      },
      {
        number: 8,
        title: "Confidentialité et Protection des Données",
        icon: Lock,
        color: 'cyan',
        items: [
          "La Plateforme est en stricte conformité avec les dispositions de la Loi marocaine n° 09-08 relative à la protection des personnes physiques à l'égard du traitement des données à caractère personnel.",
          "Les deux Parties s'engagent à préserver la confidentialité absolue de l'ensemble des informations, données, rapports et grilles tarifaires échangés en vertu des présentes. Aucune des Parties n'est autorisée à divulguer des informations à des tiers sans le consentement écrit et préalable de l'autre Partie.",
        ],
      },
      {
        number: 9,
        title: "Force Majeure",
        icon: Cloud,
        color: 'sky',
        items: [
          "Aucune des Parties ne saurait être tenue pour juridique responsable de l'inexécution ou du retard dans l'exécution de ses obligations contractuelles si cela résulte de circonstances ou d'un cas de force majeure échappant à son contrôle raisonnable. Ceci inclut, de façon non limitative : les grèves syndicales, les catastrophes naturelles, les pandémies, les décisions gouvernementales impératives ou les événements imprévisibles et insurmontables.",
        ],
      },
      {
        number: 10,
        title: "Règlement des Litiges et Juridiction Compétente",
        icon: Gavel,
        color: 'orange',
        items: [
          "En cas de litige ou de différend découlant de l'interprétation, de l'exécution ou de l'utilisation des services de la Plateforme, les Parties s'efforceront en premier lieu de trouver une solution amiable de bonne foi.",
          "À défaut de parvenir à un accord amiable dans un délai de trente (30) jours, compétence exclusive et absolue est attribuée au Tribunal de Commerce d'Agadir pour connaître et statuer sur ledit litige.",
        ],
      },
      {
        number: 11,
        title: "Modifications et Acceptation Électronique",
        icon: RefreshCw,
        color: 'purple',
        items: [
          "SILACOD se réserve le droit d'amender et de mettre à jour les présentes CGU à tout moment. Ces modifications entrent en vigueur dès leur publication sur la Plateforme. L'utilisation continue de la Plateforme par l'Utilisateur vaut acceptation tacite de ces mises à jour.",
          "Conformément à la législation en vigueur relative à l'échange électronique de données juridiques, l'inscription sur la Plateforme ou l'utilisation de ses services vaut acceptation électronique expresse. Cette démarche possède la même force probante et contraignante qu'une signature manuscrite dûment légalisée.",
        ],
      },
    ]
  },
  en: {
    login: "Login",
    backToHome: "Back to Home",
    title: "General Terms of Use and Services (CGU)",
    subtitle: "Digital Platform: SILACOD",
    lastUpdated: "Last updated: June 2026",
    introP1: "SILACOD is a leading Moroccan digital platform, owned and operated by the Moroccan company SILACOD SARL. It specializes in providing integrated technology, logistics, and e-commerce solutions (Marketplace catalog, order confirmation, final packaging, and courier interfacing for Cash on Delivery - COD management).",
    introP2: "The term \"Platform\" refers to the website and applications affiliated with SILACOD. The term \"User\" (or Influencer/Seller) refers to any physical or legal person using the services of the Platform. Accessing the Platform or using any of its services constitutes express, final, and irrevocable acceptance of these General Terms of Use.",
    alertTitle: "Protection and Security",
    alertDesc: "If you have any questions regarding these general terms of use, you can contact our support team at any time via the contact page.",
    footerText: "© 2026 SILACOD SARL. All rights reserved.",
    privacyPolicy: "Privacy policy",
    contactUs: "Contact us",
    sections: [
      {
        number: 1,
        title: "Eligibility and Account Creation",
        icon: Users,
        color: 'indigo',
        items: [
          "The User must have reached the legal age of majority (18 years old) and enjoy full legal capacity to contract, in accordance with the Moroccan Dahir of Obligations and Contracts (DOC).",
          "When registering on behalf of a company or commercial entity, the User expressly declares and warrants having the legal authorization and powers required to bind said entity.",
          "The User agrees to provide accurate, true, and updated information. The account is strictly personal; it is non-transferable to any third party.",
          "The User remains solely responsible for maintaining the confidentiality of their login credentials. Any operation carried out via the account is deemed to originate from the User and binds them legally.",
        ],
      },
      {
        number: 2,
        title: "Nature of Services and Role of SILACOD (Technology & Logistics Intermediary)",
        icon: Scale,
        color: 'blue',
        items: [
          { label: "Catalog Provision", text: "The Platform provides the User with access to a product catalog (Marketplace) supplied by duly approved laboratories and manufacturers." },
          { label: "Mediation", text: "SILACOD does not act as a seller, manufacturer, or owner of the products. The company's role is strictly confined to providing the technological infrastructure connecting the User to manufacturers, as well as packaging, order confirmation, and carrier interfacing services. SILACOD commits to deploying best efforts to ensure high quality of products supplied." },
          { label: "Ownership", text: "Products sold under the User's brand remain under their exclusive responsibility. SILACOD is not a party to the sales contract concluded between the User and the final customer." },
        ],
      },
      {
        number: 3,
        title: "User Obligations and Responsibilities (Seller / Influencer)",
        icon: AlertTriangle,
        color: 'amber',
        items: [
          { label: "Pre-funding", text: "The User agrees to pre-fund the quantity of products they select from the catalog prior to starting their commercialization." },
          { label: "Legal Responsibility", text: "The User assumes absolute and exclusive legal, civil, and commercial responsibility for the quality, nature, and safety of products for consumers, as well as associated marketing claims. The User releases SILACOD, fully and unconditionally, from any lawsuit or regulatory inspection related to products." },
          { label: "Intellectual Property", text: "The User warrants that they own or hold the legal rights to use the trade names and labels submitted via their account, and assumes all consequences of intellectual property disputes. (Label printing and placement are handled by the laboratory, not SILACOD)." },
        ],
      },
      {
        number: 4,
        title: "Storage, Packaging, and Package Handover to Carriers",
        icon: Package,
        color: 'emerald',
        items: [
          { label: "Product Reception & Storage", text: "SILACOD reserves the right to receive products directly from the seller or their agent for storage and preparation in its own warehouses. The company reserves the right to refuse products violating laws or safety norms." },
          { label: "Packaging & Shipping", text: "SILACOD handles final professional packaging of products. For parcels ready for shipping, SILACOD does not directly transport them; its mission is limited to handing them over to partner shipping companies who perform delivery." },
          { label: "Delivery Liability Waiver", text: "SILACOD disclaims all liability for delivery delays caused by transport companies, as well as addressing errors provided by the client, client absence, or refusal of delivery." },
        ],
      },
      {
        number: 5,
        title: "Order Confirmation (Call Center & WhatsApp)",
        icon: Phone,
        color: 'violet',
        items: [
          { label: "Order Confirmation", text: "SILACOD manages order confirmation via its dedicated call center. The company commits to making a minimum of 6 call attempts per client, supplemented by WhatsApp messages when appropriate, to maximize confirmation rates." },
          { label: "Exclusive WhatsApp Service", text: "Alternatively, the Influencer can choose confirmation exclusively via WhatsApp. A dedicated phone number from one of our partners will be provided, and the Influencer must direct clients to this number." },
        ],
      },
      {
        number: 6,
        title: "Financial Policy, Cash on Delivery (COD), and Returns",
        icon: Banknote,
        color: 'teal',
        items: [
          { label: "Collection & Deductions", text: "Partner transport companies collect funds (COD) from final clients. These funds are credited to the User's Wallet. The User authorizes SILACOD to deduct all applicable fees (confirmation, shipping, return, and platform fees) from their earnings." },
          { label: "Client Refunds", text: "In case of refunding a client for any reason, the Seller (Influencer) supports the full cost. The refund amount will be deducted from their Wallet or future financial receivables." },
        ],
      },
      {
        number: 7,
        title: "Acceptable Use and Anti-Fraud Policy",
        icon: Shield,
        color: 'rose',
        items: [
          "It is strictly forbidden to use the Platform for illegal purposes, manipulate the system, or generate fake orders to artificially boost confirmation rates.",
          "SILACOD reserves the absolute right to suspend or close any User account immediately and temporarily freeze assets upon detecting fraudulent activity, reserving the right to pursue civil and criminal litigation."
        ],
      },
      {
        number: 8,
        title: "Confidentiality and Data Protection",
        icon: Lock,
        color: 'cyan',
        items: [
          "The Platform strictly complies with Moroccan Law No. 09-08 on the protection of individuals with regard to the processing of personal data.",
          "Both Parties commit to preserving absolute confidentiality of all information, data, reports, and price lists exchanged. No Party is authorized to disclose information to third parties without prior written consent."
        ],
      },
      {
        number: 9,
        title: "Force Majeure",
        icon: Cloud,
        color: 'sky',
        items: [
          "Neither Party shall be held legally responsible for non-performance or delay in performing its contractual obligations if it results from force majeure circumstances beyond its reasonable control, including strikes, natural disasters, pandemics, or government orders."
        ],
      },
      {
        number: 10,
        title: "Dispute Resolution and Competent Jurisdiction",
        icon: Gavel,
        color: 'orange',
        items: [
          "In case of any dispute arising from the interpretation, execution, or use of Platform services, the Parties will first try to reach an amicable solution in good faith.",
          "Failing amicable agreement within thirty (30) days, exclusive jurisdiction is assigned to the Commercial Court of Agadir to decide on the dispute."
        ],
      },
      {
        number: 11,
        title: "Modifications and Electronic Acceptance",
        icon: RefreshCw,
        color: 'purple',
        items: [
          "SILACOD reserves the right to amend and update these CGU at any time. Changes take effect upon publication on the Platform. Continued use constitutes acceptance.",
          "In accordance with legislation on electronic exchange of legal data, registration or use of platform services constitutes express electronic acceptance, carrying the same legal force as a signed and legalized written signature."
        ],
      },
    ]
  }
};

const colorMap: Record<string, { bg: string; text: string; border: string; accent: string; light: string }> = {
  indigo:  { bg: 'bg-indigo-50/50',  text: 'text-indigo-600',  border: 'border-indigo-100',  accent: 'bg-indigo-600',  light: 'bg-indigo-100' },
  blue:    { bg: 'bg-blue-50/50',    text: 'text-blue-600',    border: 'border-blue-100',    accent: 'bg-blue-600',    light: 'bg-blue-100' },
  amber:   { bg: 'bg-amber-50/50',   text: 'text-amber-600',   border: 'border-amber-100',   accent: 'bg-amber-600',   light: 'bg-amber-100' },
  emerald: { bg: 'bg-emerald-50/50', text: 'text-emerald-600', border: 'border-emerald-100', accent: 'bg-emerald-600', light: 'bg-emerald-100' },
  violet:  { bg: 'bg-violet-50/50',  text: 'text-violet-600',  border: 'border-violet-100',  accent: 'bg-violet-600',  light: 'bg-violet-100' },
  teal:    { bg: 'bg-teal-50/50',    text: 'text-teal-600',    border: 'border-teal-100',    accent: 'bg-teal-600',    light: 'bg-teal-100' },
  rose:    { bg: 'bg-rose-50/50',    text: 'text-rose-600',    border: 'border-rose-100',    accent: 'bg-rose-600',    light: 'bg-rose-100' },
  cyan:    { bg: 'bg-cyan-50/50',    text: 'text-cyan-600',    border: 'border-cyan-100',    accent: 'bg-cyan-600',    light: 'bg-cyan-100' },
  sky:     { bg: 'bg-sky-50/50',     text: 'text-sky-600',     border: 'border-sky-100',     accent: 'bg-sky-600',     light: 'bg-sky-100' },
  orange:  { bg: 'bg-orange-50/50',  text: 'text-orange-600',  border: 'border-orange-100',  accent: 'bg-orange-600',  light: 'bg-orange-100' },
  purple:  { bg: 'bg-purple-50/50',  text: 'text-purple-600',  border: 'border-purple-100',  accent: 'bg-purple-600',  light: 'bg-purple-100' },
};

export default function TermsPage() {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.fr;
  const isRtl = language === 'ar';
  const textAlign = isRtl ? 'text-right' : 'text-left';
  const flexAlign = isRtl ? 'flex-row-reverse' : 'flex-row';

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-['29LT_Kaff',_Cairo,_Inter,_sans-serif] text-slate-700 relative overflow-x-hidden selection:bg-[#ff5722]/10 selection:text-[#ff5722]">
      <Seo page="terms" />
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
            <FileText size={26} className="animate-pulse" />
          </div>
          <h1 className="pt-1 text-4xl sm:text-5xl font-black text-[#2e315e] tracking-tight leading-none bg-gradient-to-r from-[#2e315e] via-[#2e315e] to-[#ff5722] bg-clip-text text-transparent inline-block">
            {t.title}
          </h1>
          <p className="text-[#ff5722] font-black text-sm tracking-wider uppercase opacity-95">
            {t.subtitle}
          </p>
          <div className={`flex justify-center lg:${isRtl ? 'justify-start' : 'justify-end'} pt-2`}>
            <span className="bg-slate-100 text-slate-500 font-extrabold tracking-wide text-[10px] sm:text-xs uppercase px-3.5 py-1.5 rounded-full border border-slate-200">
              {t.lastUpdated}
            </span>
          </div>
        </div>

        {/* Intro Card */}
        <div className={`bg-white/80 backdrop-blur-md rounded-[2.5rem] p-8 sm:p-10 shadow-[0_10px_35px_rgba(0,0,0,0.015)] border border-slate-100 mb-10 ${textAlign}`} dir={isRtl ? 'rtl' : 'ltr'}>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-semibold">
            {t.introP1}
          </p>
          <div className="mt-6 p-5 bg-slate-50/50 rounded-2xl border border-slate-100">
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-medium">
              {t.introP2}
            </p>
          </div>
        </div>

        {/* Legal Sections */}
        <div className={`space-y-8 ${textAlign}`} dir={isRtl ? 'rtl' : 'ltr'}>
          {t.sections.map((section) => {
            const colors = colorMap[section.color] || colorMap.indigo;
            const Icon = section.icon;
            return (
              <div
                key={section.number}
                className="bg-white/80 backdrop-blur-md rounded-[2.5rem] p-8 sm:p-10 shadow-[0_10px_35px_rgba(0,0,0,0.015)] border border-slate-100 transition-all duration-300 hover:shadow-lg hover:shadow-slate-200/50"
              >
                {/* Section Header */}
                <div className={`flex items-start gap-4 mb-8 ${flexAlign}`}>
                  <div className={`w-14 h-14 rounded-2xl ${colors.bg} ${colors.text} flex items-center justify-center flex-shrink-0 shadow-md`}>
                    <Icon size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`flex items-center gap-3 mb-1.5 ${flexAlign}`}>
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-xl ${colors.accent} text-white text-xs font-black shrink-0 shadow-sm`}>
                        {section.number}
                      </span>
                      <h2 className="text-xl font-black text-[#2e315e] tracking-tight leading-snug">
                        {section.title}
                      </h2>
                    </div>
                  </div>
                </div>

                {/* Section Items */}
                <div className={`space-y-4 ${isRtl ? 'pr-2' : 'pl-2'}`}>
                  {section.items.map((item, idx) => {
                    if (typeof item === 'string') {
                      return (
                        <div key={idx} className={`flex items-start gap-3.5 ${flexAlign}`}>
                          <div className={`w-2 h-2 rounded-full ${colors.accent} mt-2 flex-shrink-0`} />
                          <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-medium flex-1">{item}</p>
                        </div>
                      );
                    }
                    return (
                      <div key={idx} className={`p-6 rounded-[2rem] ${colors.bg} border ${colors.border} hover:border-[#ff5722]/10 transition-colors`}>
                        <h4 className={`text-xs font-black uppercase tracking-widest ${colors.text} mb-2`}>
                          {item.label}
                        </h4>
                        <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-medium">{item.text}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Security Alert Box */}
        <div className={`mt-12 bg-gradient-to-br from-[#ff5722]/5 to-[#2e315e]/5 border border-[#ff5722]/15 rounded-[2.5rem] p-8 sm:p-10 flex gap-6 items-start ${isRtl ? 'flex-row-reverse text-right' : 'flex-row text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-gradient-to-br from-[#ff5722] to-[#e64a19] text-white w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#ff5722]/20">
            <Shield size={24} className="animate-pulse" />
          </div>
          <div className="space-y-2 flex-1">
            <h4 className="text-lg font-extrabold text-[#2e315e]">{t.alertTitle}</h4>
            <p className="text-sm text-slate-500 leading-relaxed font-medium">
              {t.alertDesc.split('contact')[0]}
              <Link to="/contact" className="text-[#ff5722] font-black hover:underline">
                {isRtl ? 'الاتصال' : 'contact'}
              </Link>
              {t.alertDesc.split('contact')[1] || ''}
            </p>
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
            <Link to="/contact" className="hover:text-[#ff5722] transition-colors">{t.contactUs}</Link>
          </div>
          <FooterMeta />
        </div>
      </footer>
    </div>
  );
}

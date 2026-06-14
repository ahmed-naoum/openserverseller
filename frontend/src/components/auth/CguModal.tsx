import React from 'react';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';

interface CguModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: string;
}

interface CguSection {
  num: string;
  title: string;
  points: string[];
}

const introText: Record<string, string> = {
  fr: "SILACOD est une plateforme digitale marocaine de premier plan, détenue et exploitée par la société de droit marocain SILACOD SARL. Elle est spécialisée dans la fourniture de solutions technologiques, logistiques et de services intégrés de commerce électronique (Marketplace, confirmation des commandes, emballage final et interfaçage avec les transporteurs pour la gestion du paiement à la livraison - COD).\n\nLe terme « Plateforme » désigne le site web et les applications affiliés à SILACOD. Le terme « Utilisateur » (ou Influenceur/Vendeur) désigne toute personne physique ou morale utilisant les services de la Plateforme. L'accès à la Plateforme ou l'utilisation de l'un de ses services emporte une acceptation expresse, définitive et irrévocable des présentes Conditions Générales d'Utilisation.",
  en: "SILACOD is a leading Moroccan digital platform, owned and operated by the company under Moroccan law SILACOD SARL. It specializes in the provision of technological solutions, logistics, and integrated e-commerce services (Marketplace, order confirmation, final packaging, and interfacing with carriers for cash on delivery management - COD).\n\nThe term 'Platform' refers to the website and applications affiliated with SILACOD. The term 'User' (or Influencer/Seller) refers to any natural or legal person using the services of the Platform. Accessing the Platform or using any of its services implies an express, definitive, and irrevocable acceptance of these General Conditions of Use.",
  ar: "SILACOD هي منصة رقمية مغربية رائدة، تملكها وتديرها شركة SILACOD SARL الخاضعة للقانون المغربي. وهي متخصصة في تقديم الحلول التكنولوجية واللوجستية وخدمات التجارة الإلكترونية المتكاملة (المنصة، تأكيد الطلبات، التعبئة والتغليف النهائي، والربط مع شركات النقل لإدارة الدفع عند الاستلام - COD).\n\nيُقصد بمصطلح «المنصة» الموقع الإلكتروني والتطبيقات التابعة لـ SILACOD. ويُقصد بمصطلح «المستخدم» (أو المؤثر/البائع) أي شخص طبيعي أو اعتباري يستخدم خدمات المنصة. إن الولوج إلى المنصة أو استخدام أي من خدماتها ينطوي على قبول صريح ونهائي ولا رجعة فيه لهذه الشروط العامة للاستخدام."
};

const sections: Record<string, CguSection[]> = {
  fr: [
    {
      num: "1",
      title: "Éligibilité et Création de Compte",
      points: [
        "L'Utilisateur doit avoir atteint l'âge de la majorité légale (18 ans révolus) et jouir de la pleine capacité juridique de contracter, conformément au Dahir des Obligations et des Contrats (DOC) marocain.",
        "En cas d'inscription au nom d'une société ou d'une entité commerciale, l'Utilisateur déclare et garantit expressément disposer des mandats et pouvoirs légaux requis pour engager ladite entité.",
        "L'Utilisateur s'engage à fournir des informations exactes, véridiques et dûment actualisées. Le compte revêt un caractère strictement personnel ; il s'avère incessible et intransmissible à tout tiers.",
        "L'Utilisateur demeure le seul et unique responsable de la préservation de la confidentialité de ses identifiants de connexion. Toute opération effectuée via le compte est réputée émaner de l'Utilisateur et l'engage juridiquement."
      ]
    },
    {
      num: "2",
      title: "Nature des Services et Rôle de SILACOD (Intermédiaire Technologique et Logistique)",
      points: [
        "Mise à disposition du Catalogue : La Plateforme offre à l'Utilisateur l'accès à un catalogue de produits (Marketplace) approvisionné par des laboratoires et des fabricants dûment agréés.",
        "Médiation : SILACOD n'arbore ni la qualité de vendeur, ni celle de fabricant, ni celle de propriétaire des produits. Le rôle de la société se cantonne exclusivement à la mise à disposition de l'infrastructure technologique reliant l'Utilisateur aux fabricants, ainsi qu'à la prestation de services d'emballage, de confirmation des commandes et d'interfaçage avec les prestataires de transport. SILACOD s'engage à déployer tous les efforts nécessaires pour garantir le plus haut niveau de qualité des produits fournis par les fabricants aux clients finaux.",
        "Propriété : Les produits commercialisés sous la marque de l'Utilisateur demeurent sous sa responsabilité exclusive. SILACOD n'est, en aucun cas, partie au contrat de vente conclu entre l'Utilisateur et le client final."
      ]
    },
    {
      num: "3",
      title: "Obligations et Responsabilités de l'Utilisateur (Vendeur / Influenceur)",
      points: [
        "Préfinancement : L'Utilisateur s'oblige à préfinancer la quantité de produits qu'il sélectionne au sein du catalogue, et ce, préalablement au lancement de leur commercialisation.",
        "Responsabilité Juridique : L'Utilisateur assume une responsabilité juridique, civile et commerciale absolue et exclusive quant à la qualité des produits, leur nature, leur innocuité pour le consommateur, ainsi que les allégations marketing qui y sont associées. L'Utilisateur décharge SILACOD, de manière totale et inconditionnelle, de toute poursuite judiciaire ou inspection réglementaire ayant trait aux produits.",
        "Propriété Intellectuelle : L'Utilisateur garante qu'il détient la propriété ou les droits légaux d'exploitation des dénominations commerciales et des étiquettes (Labels) qu'il soumet via son compte, et assume seul les conséquences de tout litige relatif aux droits de propriété intellectuelle. (Il est à préciser que l'impression et l'apposition des étiquettes sur les produits incombent au laboratoire, et non à SILACOD)."
      ]
    },
    {
      num: "4",
      title: "Stockage, Emballage et Remise des Colis aux Transporteurs",
      points: [
        "Réception et Stockage des Produits : SILACOD se réserve le droit de réceptionner les « Produits » directement auprès du vendeur ou de son mandataire aux fins de stockage et de préparation dans ses propres entrepôts. La société se réserve le droit discrétionnaire de refuser la réception ou le stockage de tout produit contrevenant aux lois en vigueur ou ne satisfaisant pas aux normes de sécurité exigées.",
        "Emballage et Expédition des Colis : SILACOD prend en charge l'emballage final et professionnel des produits. S'agissant des « Colis » prêts à l'expédition, SILACOD n'assure pas leur transport direct ; sa mission se limite à leur remise aux sociétés de messagerie partenaires, lesquelles prennent en charge la réception des colis, leur acheminement et leur livraison au client final.",
        "Exonération de Responsabilité de Livraison : SILACOD décline toute responsabilité quant aux retards de livraison imputables aux sociétés de transport, ainsi que pour les erreurs d'adressage fournies par le client, son absence ou son refus de réceptionner la commande."
      ]
    },
    {
      num: "5",
      title: "Confirmation des Commandes (Centre d'appels et WhatsApp)",
      points: [
        "Traitement et Appels : SILACOD gère la confirmation des commandes par le biais de son centre d'appels dédié. La société s'engage à effectuer un minimum de 6 tentatives d'appel auprès du client, complétées par des communications via WhatsApp le cas échéant, afin d'optimiser le taux de confirmation des commandes.",
        "Service WhatsApp Exclusif : À titre d'alternative, l'Influenceur peut opter pour la confirmation des commandes exclusivement via WhatsApp. À cet effet, un numéro de téléphone appartenant à l'un de nos prestataires opérant en collaboration avec SILACOD lui sera communiqué. L'Influenceur devra alors rediriger ses clients vers ce numéro WhatsApp dédié à l'équipe de confirmation."
      ]
    },
    {
      num: "6",
      title: "Politique Financière, Paiement à la Livraison (COD) et Retours",
      points: [
        "Recouvrement et Prélèvements : Les sociétés de transport partenaires procèdent au recouvrement des fonds (COD) auprès des clients finaux. Ces fonds sont crédités sur le portefeuille numérique (Wallet) de l'Utilisateur. L'Utilisateur autorise expressément SILACOD à déduire de ses bénéfices l'intégralité des frais exigibles (frais de confirmation, de livraison, de retour et frais d'utilisation de la plateforme).",
        "Remboursement des Clients : En cas de restitution du montant d'une commande au client, pour quelque motif que ce soit, le Vendeur (Influenceur) supporte l'intégralité du coût de ce remboursement. Ledit montant sera directement déduit de son portefeuille numérique, de ses factures ou de ses créances financières futures."
      ]
    },
    {
      num: "7",
      title: "Utilisation Acceptable et Lutte Contre la Fraude",
      points: [
        "Il est rigoureusement interdit d'utiliser la Plateforme à des fins illégales, de manipuler le système, ou de générer des commandes fictives (Fake Orders) dans le but d'altérer artificiellement les taux de confirmation.",
        "SILACOD se réserve le droit absolu de suspendre ou de clôturer avec effet immédiat le compte de tout Utilisateur, et de geler temporairement ses avoirs financiers en cas de détection d'une quelconque activité frauduleuse, tout en se réservant le droit d'engager des poursuites judiciaires pécuniaires et pénales."
      ]
    },
    {
      num: "8",
      title: "Confidentialité et Protection des Données",
      points: [
        "La Plateforme est en stricte conformité avec les dispositions de la Loi marocaine n° 09-08 relative à la protection des personnes physiques à l'égard du traitement des données à caractère personnel.",
        "Les deux Parties s'engagent à préserver la confidentialité absolue de l'ensemble des informations, données, rapports et grilles tarifaires échangés en vertu des présentes. Aucune des Parties n'est autorisée à divulguer des informations à des tiers sans le consentement écrit et préalable de l'autre Partie."
      ]
    },
    {
      num: "9",
      title: "Force Majeure",
      points: [
        "Aucune des Parties ne saurait être tenue pour juridiquement responsable de l'inexécution ou du retard dans l'exécution de ses obligations contractuelles si cela résulte de circonstances ou d'un cas de force majeure échappant à son contrôle raisonnable. Ceci inclut, de façon non limitative : les grèves syndicales, les catastrophes naturelles, les pandémies, les décisions gouvernementales impératives ou les événements imprévisibles et insurmontables."
      ]
    },
    {
      num: "10",
      title: "Règlement des Litiges et Juridiction Compétente",
      points: [
        "En cas de litige ou de différend découlant de l'interprétation, de l'exécution ou de l'utilisation des services de la Plateforme, les Parties s'efforceront en premier lieu de trouver une solution amiable de bonne foi.",
        "À défaut de parvenir à un accord amiable dans un délai de trente (30) jours, compétence exclusive et absolue est attribuée au Tribunal de Commerce d'Agadir pour connaître et statuer sur ledit litige."
      ]
    },
    {
      num: "11",
      title: "Modifications et Acceptation Électronique",
      points: [
        "SILACOD se réserve le droit d'amender et de mettre à jour les présentes CGU à tout moment. Ces modifications entrent en vigueur dès leur publication sur la Plateforme. L'utilisation continue de la Plateforme par l'Utilisateur vaut acceptation tacite de ces mises à jour.",
        "Conformément à la législation en vigueur relative à l'échange électronique de données juridiques, l'inscription sur la Plateforme ou l'utilisation de ses services vaut acceptation électronique expresse. Cette démarche possède la même force probante et contraignante qu'une signature manuscrite dûment légalisée."
      ]
    }
  ],
  en: [
    {
      num: "1",
      title: "Eligibility and Account Creation",
      points: [
        "The User must have reached the legal age of majority (full 18 years) and enjoy full legal capacity to contract, in accordance with the Moroccan Dahir of Obligations and Contracts (DOC).",
        "In case of registration on behalf of a company or commercial entity, the User expressly represents and warrants having the required legal powers and mandates to bind the said entity.",
        "The User agrees to provide accurate, true, and updated information. The account is strictly personal; it is non-transferable to any third party.",
        "The User remains solely and uniquely responsible for maintaining the confidentiality of their login credentials. Any operation carried out via the account is deemed to originate from the User and binds them legally."
      ]
    },
    {
      num: "2",
      title: "Nature of Services and Role of SILACOD (Technological and Logistics Intermediary)",
      points: [
        "Catalog Provision: The Platform offers the User access to a product catalog (Marketplace) supplied by duly approved laboratories and manufacturers.",
        "Mediation: SILACOD is neither the seller, manufacturer, nor owner of the products. The company's role is exclusively limited to providing the technological infrastructure connecting the User to the manufacturers, as well as providing packaging, order confirmation, and interfacing services with shipping providers. SILACOD is committed to deploying all necessary efforts to guarantee the highest level of quality of the products provided by manufacturers to final clients.",
        "Ownership: Products marketed under the User's brand remain under their exclusive responsibility. SILACOD is, under no circumstances, a party to the sales contract concluded between the User and the final customer."
      ]
    },
    {
      num: "3",
      title: "Obligations and Responsibilities of the User (Seller / Influencer)",
      points: [
        "Prefinancing: The User obligates themselves to prefinance the quantity of products they select from the catalog, prior to launching their marketing.",
        "Legal Responsibility: The User assumes absolute and exclusive legal, civil, and commercial responsibility for the quality of the products, their nature, their safety for the consumer, as well as the marketing claims associated with them. The User totally and unconditionally releases SILACOD from any legal prosecution or regulatory inspection relating to the products.",
        "Intellectual Property: The User guarantees that they hold the ownership or legal exploitation rights of the commercial names and labels they submit via their account, and assumes alone the consequences of any dispute relating to intellectual property rights. (It is specified that the printing and affixing of labels on products are the responsibility of the laboratory, and not SILACOD)."
      ]
    },
    {
      num: "4",
      title: "Storage, Packaging, and Delivery of Parcels to Carriers",
      points: [
        "Product Reception and Storage: SILACOD reserves the right to receive \"Products\" directly from the seller or their agent for storage and preparation in its own warehouses. The company reserves the discretionary right to refuse reception or storage of any product violating active laws or not satisfying the required safety standards.",
        "Packaging and Shipment: SILACOD takes charge of the final and professional packaging of products. For \"Parcels\" ready for shipment, SILACOD does not provide direct transport; its mission is limited to handing them over to partner shipping companies, which handle parcel pickup, transit, and delivery to the final customer.",
        "Exoneration of Delivery Responsibility: SILACOD declines all responsibility for delivery delays attributable to shipping companies, as well as for routing errors provided by the customer, their absence, or their refusal to receive the order."
      ]
    },
    {
      num: "5",
      title: "Order Confirmation (Call Center and WhatsApp)",
      points: [
        "Processing and Calls: SILACOD manages order confirmation through its dedicated call center. The company commits to making a minimum of 6 call attempts to the customer, completed by WhatsApp communications if necessary, to optimize the order confirmation rate.",
        "Exclusive WhatsApp Service: Alternatively, the Influencer can opt for order confirmation exclusively via WhatsApp. For this purpose, a phone number belonging to one of our providers working with SILACOD will be communicated. The Influencer must then redirect their customers to this dedicated WhatsApp number for the confirmation team."
      ]
    },
    {
      num: "6",
      title: "Financial Policy, Cash on Delivery (COD) and Returns",
      points: [
        "Recovery and Deductions: Partner transport companies collect funds (COD) from final customers. These funds are credited to the User's digital wallet (Wallet). The User expressly authorizes SILACOD to deduct from their profits all due fees (confirmation, delivery, return, and platform usage fees).",
        "Customer Refunds: In the event of refunding the amount of an order to the customer, for any reason, the Seller (Influencer) bears the full cost of this refund. The said amount will be directly deducted from their digital wallet, invoices, or future financial claims."
      ]
    },
    {
      num: "7",
      title: "Acceptable Use and Anti-Fraud Policy",
      points: [
        "It is strictly forbidden to use the Platform for illegal purposes, to manipulate the system, or to generate fake orders in order to artificially alter confirmation rates.",
        "SILACOD reserves the absolute right to suspend or terminate the account of any User immediately, and to temporarily freeze their financial assets in case of detecting any fraudulent activity, while reserving the right to initiate legal, pecuniary, and criminal proceedings."
      ]
    },
    {
      num: "8",
      title: "Confidentiality and Data Protection",
      points: [
        "The Platform strictly complies with the provisions of Moroccan Law No. 09-08 on the protection of individuals with regard to the processing of personal data.",
        "Both Parties commit to preserving absolute confidentiality of all information, data, reports, and pricing grids exchanged under these terms. Neither Party is authorized to disclose information to third parties without prior written consent from the other Party."
      ]
    },
    {
      num: "9",
      title: "Force Majeure",
      points: [
        "Neither Party shall be held legally responsible for non-performance or delay in performing its contractual obligations if this results from circumstances or an event of force majeure beyond its reasonable control. This includes, without limitation: labor strikes, natural disasters, pandemics, binding government decisions, or unpredictable and insurmountable events."
      ]
    },
    {
      num: "10",
      title: "Dispute Resolution and Jurisdiction",
      points: [
        "In the event of a dispute or disagreement arising from the interpretation, execution, or use of the Platform's services, the Parties shall first endeavor to find an amicable solution in good faith.",
        "If an amicable settlement is not reached within thirty (30) days, exclusive and absolute jurisdiction is assigned to the Commercial Court of Agadir to hear and rule on the said dispute."
      ]
    },
    {
      num: "11",
      title: "Modifications and Electronic Acceptance",
      points: [
        "SILACOD reserves the right to amend and update these General Conditions of Use at any time. These modifications take effect upon their publication on the Platform. Continuous use of the Platform by the User constitutes tacit acceptance of these updates.",
        "In accordance with legislation in force concerning electronic exchange of legal data, registration on the Platform or use of its services constitutes express electronic acceptance. This action possesses the same probative and binding force as a duly legalized handwritten signature."
      ]
    }
  ],
  ar: [
    {
      num: "١",
      title: "الأهلية وإنشاء الحساب",
      points: [
        "يجب أن يكون المستخدم قد بلغ سن الرشد القانوني (18 سنة كاملة) ويتمتع بالأهلية القانونية الكاملة للتعاقد، وفقًا لظهير الالتزامات والعقود المغربي.",
        "في حالة التسجيل باسم شركة أو كيان تجاري، يقر المستخدم ويضمن صراحةً امتلاكه للتفويضات والسلطات القانونية اللازمة لإلزام الكيان المذكور.",
        "يتعهد المستخدم بتقديم معلومات دقيقة وصحيحة ومحدثة. الحساب شخصي تمامًا؛ ولا يجوز التنازل عنه أو نقله إلى أي طرف ثالث.",
        "يظل المستخدم المسؤول الوحيد عن الحفاظ على سرية بيانات اعتماده لتسجيل الدخول. وتعتبر أي عملية تتم عبر الحساب صادرة عن المستخدم وتلزمه قانونًا."
      ]
    },
    {
      num: "٢",
      title: "طبيعة الخدمات ودور SILACOD (وسيط تكنولوجي ولوجستي)",
      points: [
        "توفير الكتالوج: توفر المنصة للمستخدم إمكانية الوصول إلى كتالوج المنتجات (Marketplace) المزود من قبل مختبرات ومصنعين معتمدين.",
        "الوساطة: لا تتمتع SILACOD بصفة البائع أو المصنع أو مالك المنتجات. يقتصر دور الشركة حصريًا على توفير البنية التحتية التكنولوجية التي تربط المستخدم بالمصنعين، فضلاً عن تقديم خدمات التعبئة والتغليف وتأكيد الطلبات والربط مع مقدمي خدمات النقل. وتلتزم SILACOD ببذل قصارى جهدها لضمان أعلى مستوى من الجودة للمنتجات المقدمة من المصنعين للعملاء النهائيين.",
        "الملكية: تظل المنتجات التي يتم تسويقها تحت العلامة التجارية للمستخدم تحت مسؤوليته الحصرية. ولا تعتبر SILACOD بأي حال من الأحوال طرفًا في عقد البيع المبرم بين المستخدم والعميل النهائي."
      ]
    },
    {
      num: "٣",
      title: "التزامات ومسؤوليات المستخدم (البائع / المؤثر)",
      points: [
        "التمويل المسبق: يلتزم المستخدم بالتمويل المسبق لكمية المنتجات التي يختارها من الكتالوج، وذلك قبل البدء في تسويقها.",
        "المسؤولية القانونية: يتحمل المستخدم المسؤولية القانونية والمدنية والتجارية المطلقة والحصرية عن جودة المنتجات وطبيعتها وسلامتها للمستهلك، وكذلك الادعاءات التسويقية المرتبطة بها. ويعفي المستخدم شركة SILACOD تمامًا وبدون شروط من أي ملاحقة قضائية أو تفتيش رقابي يتعلق بالمنتجات.",
        "الملكية الفكرية: يضمن المستخدم أنه يمتلك الملكية أو الحقوق القانونية لاستغلال الأسماء التجارية والملصقات (Labels) التي يقدمها عبر حسابه، ويتحمل وحده عواقب أي نزاع يتعلق بحقوق الملكية الفكرية. (تجدر الإشارة إلى أن طباعة الملصقات ووضعها على المنتجات تقع على عاتق المختبر وليس على SILACOD)."
      ]
    },
    {
      num: "٤",
      title: "التخزين والتعبئة وتسليم الطرود إلى الناقلين",
      points: [
        "استلام وتخزين المنتجات: تحتفظ SILACOD بالحق في استلام \"المنتجات\" مباشرة من البائع أو من ينوب عنه لأغراض التخزين والتحضير في مستودعاتها الخاصة. وتحتفظ الشركة بالحق التقديري في رفض استلام أو تخزين أي منتج يخالف القوانين السارية أو لا يستوفي معايير السلامة المطلوبة.",
        "تعبئة وشحن الطرود: تتولى SILACOD التعبئة النهائية والاحترافية للمنتجات. بالنسبة لـ \"الطرود\" الجاهزة للشحن، لا تقوم SILACOD بنقلها مباشرة؛ بل تقتصر مهمتها على تسليمها إلى شركات الشحن الشريكة، والتي تتولى استلام الطرود ونقلها وتوصيلها للعميل النهائي.",
        "الإعفاء من مسؤولية التوصيل: تخلي SILACOD مسؤوليتها عن أي تأخير في التوصيل ناتج عن شركات النقل، وكذلك عن أخطاء العناوين المقدمة من العميل، أو غيابه أو رفضه استلام الطلب."
      ]
    },
    {
      num: "٥",
      title: "تأكيد الطلبات (مركز الاتصال والواتساب)",
      points: [
        "المعالجة والاتصالات: تدير SILACOD تأكيد الطلبات من خلال مركز الاتصال المخصص لها. وتلتزم الشركة بإجراء 6 محاولات اتصال كحد أدنى بالعميل، تليها مراسلات عبر الواتساب عند الاقتضاء، لتحسين معدل تأكيد الطلبات.",
        "خدمة الواتساب الحصرية: كبديل، يمكن للمؤثر اختيار تأكيد الطلبات حصريًا عبر الواتساب. ولهذا الغرض، سيتم تزويده برقم هاتف تابع أحد مقدمي الخدمات الشركاء مع SILACOD، ويتعين على المؤثر توجيه عملائه إلى رقم الواتساب هذا المخصص لفريق التأكيد."
      ]
    },
    {
      num: "٦",
      title: "السياسة المالية، الدفع عند الاستلام (COD) والمرتجعات",
      points: [
        "التحصيل والاقتطاعات: تقوم شركات النقل الشريكة بتحصيل الأموال (COD) من العملاء النهائيين. ويتم تقييد هذه المبالغ في المحفظة الرقمية (Wallet) للمستخدم. ويفوض المستخدم صراحةً شركة SILACOD باقتطاع كافة الرسوم المستحقة (رسوم التأكيد، التوصيل، المرتجعات ورسوم استخدام المنصة) من أرباحه.",
        "استرداد أموال العملاء: في حالة إرجاع مبلغ الطلب للعميل لأي سبب كان، يتحمل البائع (المؤثر) التكلفة الكاملة لهذا الاسترداد. ويتم خصم المبلغ المذكور مباشرة من محفظته الرقمية، أو فواتيره، أو مستحقاته المالية المستقبلية."
      ]
    },
    {
      num: "٧",
      title: "الاستخدام المقبول ومكافحة الاحتيال",
      points: [
        "يُحظر تمامًا استخدام المنصة لأغراض غير قانونية، أو التلاعب بالنظام، أو إنشاء طلبات وهمية (Fake Orders) بهدف زيادة معدلات التأكيد اصطنيعًا.",
        "تحتفظ SILACOD بالحق المطلق في تعليق أو إغلاق حساب أي مستخدم فورًا، وتجميد أصوله المالية مؤقتًا في حال الكشف عن أي نشاط احتيالي، مع الاحتفاظ بالحق في اتخاذ الإجراءات القانونية والمالية والجنائية."
      ]
    },
    {
      num: "٨",
      title: "السرية وحماية البيانات",
      points: [
        "تتوافق المنصة تمامًا مع أحكام القانون المغربي رقم 09-08 المتعلق بحماية الأشخاص الذاتيين تجاه معالجة المعطيات ذات الطابع الشخصي.",
        "يلتزم الطرفان بالسرية المطلقة لجميع المعلومات والبيانات والتقارير وقوائم الأسعار المتبادلة بموجب هذه الشروط. ولا يحق لأي من الطرفين الكشف عن أي معلومات لأطراف ثالثة دون موافقة كتابية مسبقة من الطرف الآخر."
      ]
    },
    {
      num: "٩",
      title: "القوة القاهرة",
      points: [
        "لا يتحمل أي من الطرفين المسؤولية القانونية عن عدم تنفيذ أو التأخر في تنفيذ التزاماته التعاقدية إذا كان ذلك ناتجًا عن ظروف أو حالة قوة قاهرة خارجة عن إرادته المعقولة. ويشمل ذلك على سبيل المثال لا الحصر: الإضرابات العمالية، الكوارث الطبيعية، الأوبئة، القرارات الحكومية الملزمة، أو الأحداث غير المتوقعة والمستعصية."
      ]
    },
    {
      num: "١٠",
      title: "تسوية النزاعات والاختصاص القضائي",
      points: [
        "في حالة حدوث أي نزاع أو خلاف ينشأ عن تفسير أو تنفيذ أو استخدام خدمات المنصة، يسعى الطرفان أولاً إلى إيجاد حل ودي بحسن نية.",
        "في حال عدم التوصل إلى تسوية ودية خلال ثلاثين (30) يومًا، يمنح الاختصاص الحصري والمطلق لـ المحكمة التجارية بأكادير للنظر والبت في النزاع المذكور."
      ]
    },
    {
      num: "١١",
      title: "التعديلات والقبول الإلكتروني",
      points: [
        "تحتفظ SILACOD بالحق في تعديل وتحديث هذه الشروط والأحكام في أي وقت. وتسري هذه التعديلات فور نشرها على المنصة. ويعتبر استمرار المستخدم في استخدام المنصة قبولاً ضمنيًا بهذه التحديثات.",
        "وفقًا للتشريعات المعمول بها بشأن التبادل الإلكتروني للمعطيات القانونية، فإن التسجيل في المنصة أو استخدام خدماتها يعادل قبولاً إلكترونيًا صريحًا. وتتمتع هذه الخطوة بنفس القوة الثبوتية والإلزامية للتوقيع اليدوي المصادق عليه قانونًا."
      ]
    }
  ]
};

export default function CguModal({ isOpen, onClose, language }: CguModalProps) {
  if (!isOpen) return null;

  const titleText = {
    fr: "Conditions Générales d'Utilisation (CGU)",
    en: "General Conditions of Use (CGU)",
    ar: "شروط الاستخدام العامة (CGU)"
  }[language] || "Conditions Générales d'Utilisation (CGU)";

  const subtitleText = {
    fr: "Plateforme Digitale : SILACOD",
    en: "Digital Platform: SILACOD",
    ar: "المنصة الرقمية: SILACOD"
  }[language] || "Plateforme Digitale : SILACOD";

  const closeText = {
    fr: "Fermer",
    en: "Close",
    ar: "إغلاق"
  }[language] || "Fermer";

  const currentIntro = introText[language] || introText.fr;
  const currentSections = sections[language] || sections.fr;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-[#2e315e]/40 backdrop-blur-sm transition-opacity duration-300"
      />

      {/* Dialog container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10 border border-slate-100"
      >
        {/* Header */}
        <div className={`p-6 border-b border-slate-100 flex items-center justify-between ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className={language === 'ar' ? 'text-right' : 'text-left'}>
            <h3 className="text-[18px] font-extrabold text-[#2e315e] tracking-tight">{titleText}</h3>
            <p className="text-xs font-semibold text-[#ff5722] mt-0.5">{subtitleText}</p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-50 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div 
          className="p-6 overflow-y-auto space-y-6 text-slate-600 text-[13px] leading-relaxed"
          style={{ direction: language === 'ar' ? 'rtl' : 'ltr' }}
        >
          {/* Introduction paragraph */}
          <div className="whitespace-pre-line font-medium text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            {currentIntro}
          </div>

          {/* Core sections */}
          <div className="space-y-6">
            {currentSections.map((sec: CguSection, index: number) => (
              <div key={index} className="space-y-2.5">
                <h4 className="font-extrabold text-slate-800 text-[14px] flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-[#ff5722]/10 text-[#ff5722] flex items-center justify-center text-xs font-black">
                    {sec.num}
                  </span>
                  {sec.title}
                </h4>
                <ul className={`space-y-1.5 list-disc ${language === 'ar' ? 'pr-5' : 'pl-5'}`}>
                  {sec.points.map((pt: string, ptIndex: number) => (
                    <li key={ptIndex} className="text-slate-600 font-medium">
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className={`p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end`}>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-[#ff5722] hover:bg-[#e64a19] text-white font-bold rounded-xl transition-all text-xs shadow-md"
          >
            {closeText}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

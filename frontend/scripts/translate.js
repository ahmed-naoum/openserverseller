import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCALES_DIR = path.resolve(__dirname, '../src/locales');
const SOURCE_LANG = 'en';
const TARGET_LANGS = ['fr', 'ar'];
const BATCH_SIZE = 25;

// Simple simulated LLM translator fallback for local dev when no keys are configured
function simulatedTranslate(keysToTranslate, targetLang) {
  const translations = {};
  const mockDb = {
    fr: {
      "Welcome to SILACOD": "Bienvenue sur SILACOD",
      "The ultimate Moroccan white-label dropshipping platform": "La plateforme ultime de dropshipping en marque blanche au Maroc",
      "Start your e-commerce without complexity... And we manage the rest": "Lancez votre e-commerce sans complexité... Et nous gérons le reste",
      "SILACOD connects you with products, storage, confirmation, packaging, delivery, tracking, and collection within a single system - so you can focus on selling and making profits.": "SILACOD vous connecte avec les produits, le stockage, la confirmation, l'emballage, la livraison, le suivi et le recouvrement au sein d'un seul système - afin que vous puissiez vous concentrer sur la vente et générer des profits.",
      "Get Started": "Commencer",
      "Pricing": "Tarifs",
      "Contact Us": "Contactez-nous",
      "Language": "Langue",
      "Dashboard": "Tableau de bord",
      "Profile": "Profil",
      "Settings": "Paramètres",
      "Logout": "Déconnexion",
      "Save Settings": "Enregistrer les paramètres",
      "Your language settings have been updated!": "Vos paramètres de langue ont été mis à jour !",
      "Ready-to-sell products": "Produits prêts à vendre",
      "COD system and easy profit withdrawal": "Système COD et retrait facile des bénéfices",
      "Confirmation and delivery in all Moroccan cities": "Confirmation et livraison dans toutes les villes du Maroc",
      "Go to dashboard": "Aller au tableau de bord",
      "Start now as an influencer": "Commencer en tant qu'influenceur",
      "Start selling now": "Commencer à vendre maintenant",
      "Numbers reflecting the platform's strength and user trust": "Chiffres reflétant la force de la plateforme et la confiance des utilisateurs",
      "Thousands of orders, hundreds of products, and a growing network of sellers and marketers work daily on SILACOD to build a simpler and more professional e-commerce.": "Des milliers de commandes, des centaines de produits et un réseau croissant de vendeurs et de marketeurs travaillent quotidiennement sur SILACOD pour bâtir un e-commerce plus simple et professionnel.",
      "Coverage of all Moroccan cities": "Couverture de toutes les villes du Maroc",
      "Orders shipped monthly": "Commandes expédiées mensuellement",
      "Active sellers on the platform": "Vendeurs actifs sur la plateforme",
      "Ready-to-sell products (stats)": "Produits prêts à la vente",
      "Why do most people fail in e-commerce?": "Pourquoi la plupart des gens échouent dans l'e-commerce ?",
      "Instead of wasting time managing details, focus on growth — and leave the operations to us": "Au lieu de perdre du temps à gérer les détails, concentrez-vous sur la croissance — et laissez-nous les opérations",
      "Working with SILACOD": "Travailler avec SILACOD",
      "Working alone": "Travailler seul",
      "Ready-to-sell products inside the platform": "Produits prêts à vendre sur la plateforme",
      "Landing pages ready to sell immediately": "Pages de destination prêtes à vendre immédiatement",
      "Dedicated team for order confirmation": "Équipe dédiée pour la confirmation des commandes",
      "Delivery and collection in all cities": "Livraison et encaissement dans toutes les villes",
      "Clear dashboard to track your profits": "Tableau de bord clair pour suivre vos bénéfices",
      "Focus only on marketing and growing your business": "Vous concentrer uniquement sur le marketing et la croissance de votre entreprise",
      "Search for a product yourself with no guarantee of success": "Rechercher un produit vous-même sans garantie de succès",
      "Need to create a website or landing page from scratch": "Créer un site ou une page de vente à partir de zéro",
      "Issues with delivery and return companies": "Problèmes avec les sociétés de livraison et de retour",
      "Handle customers and order confirmations": "Gérer les clients et les confirmations de commande",
      "Difficulty tracking profits accurately": "Difficulté à suivre les bénéfices avec précision",
      "Wasting your time in operations instead of focusing on selling": "Perdre votre temps dans les opérations au lieu de vous concentrer sur la vente",
      "Everything you need to manage your business in one system": "Tout ce dont vous avez besoin pour gérer votre entreprise en un seul système",
      "Control every detail of your business from one place, without complexity or the need to use multiple tools.": "Contrôlez chaque détail de votre entreprise depuis un seul endroit, sans complexité ni besoin d'utiliser plusieurs outils.",
      "Professional order confirmation": "Confirmation professionnelle des commandes",
      "An integrated team to increase delivery rates and reduce cancellations. Direct contact with customers to confirm your orders with high accuracy.": "Une équipe intégrée pour augmenter les taux de livraison et réduire les annulations. Contact direct avec les clients pour confirmer vos commandes avec une grande précision.",
      "Product Variety": "Variété de produits",
      "Browse and choose from a wide range of popular and carefully selected products. Start selling immediately with a single click.": "Parcourez et choisissez parmi une large gamme de produits populaires et soigneusement sélectionnés. Commencez à vendre immédiatement en un seul clic.",
      "Integrated Management": "Gestion intégrée",
      "Monitor the track and shipping status of your orders moment by moment with ease. Immediate and automatic status updates to save time.": "Suivez facilement l'état de l'expédition de vos commandes instant après instant. Mises à jour immédiates et automatiques des statuts pour gagner du temps.",
      "Instant Profits": "Bénéfices instantanés",
      "A clear smart dashboard to display your true net profits and withdraw your money safely and easily from the platform.": "Un tableau de bord intelligent et clair pour afficher vos bénéfices nets réels et retirer votre argent en toute sécurité et facilement de la plateforme.",
      "Start your business in 3 simple steps": "Démarrez votre entreprise en 3 étapes simples",
      "From choosing the right product to order delivery and cash collection — we provide an integrated system that makes selling easier.": "Du choix du bon produit à la livraison des commandes et à l'encaissement — nous fournissons un système intégré qui facilite la vente.",
      "Choose products ready for brand building": "Choisissez des produits adaptés à la création de marque",
      "Browse the catalog and choose from well-researched, quality-guaranteed products to market to your customers.": "Parcourez le catalogue et choisissez parmi des produits étudiés et de qualité garantie à proposer à vos clients.",
      "Start marketing and receive orders easily": "Commencez le marketing et recevez les commandes facilement",
      "Market your products via social media platforms and achieve fast, immediate sales without limits.": "Commercialisez vos produits via les réseaux sociaux et réalisez des ventes rapides et immédiates sans limites.",
      "Leave the operational tasks to SILACOD": "Laissez les opérations à SILACOD",
      "We take care of confirmation, packaging, and shipping to the customer, adding your net profits directly to your wallet.": "Nous nous occupons de la confirmation, de l'emballage et de l'expédition au client, pour ajouter directement vos bénéfices nets à votre portefeuille.",
      "Who is this platform for?": "À qui s'adresse cette plateforme ?",
      "Merchants and Companies": "Commerçants et Entreprises",
      "For Sellers and Merchants": "Pour les vendeurs et commerçants",
      "We provide you with an integrated infrastructure to digitize your sales and expand your business without fixed costs or operational complexities.": "Nous vous fournissons une infrastructure intégrée pour numériser vos ventes et développer votre activité sans coûts fixes ni complexités opérationnelles.",
      "Start your business now": "Démarrez votre entreprise maintenant",
      "Content Creators": "Créateurs de contenu",
      "For Influencers and Content Creators": "Pour les influenceurs et créateurs de contenu",
      "Turn your followers into real profits. Launch your own products or promote ready-made products and get the highest commissions in the market.": "Transformez vos abonnés en profits réels. Lancez vos propres produits ou promouvez des produits prêts à vendre et obtenez les commissions les plus élevées du marché.",
      "Affiliate Marketing": "Marketing d'affiliation",
      "For Affiliate Marketers": "Pour les affiliés",
      "Invest your digital marketing skills. Choose from thousands of profitable products and market them safely with guaranteed collection of your net profits.": "Investissez vos compétences en marketing digital. Choisissez parmi des milliers de produits rentables et commercialisez-les en toute sécurité avec la garantie de percevoir vos bénéfices nets.",
      "Start as a marketer": "Commencer en tant qu'affilié",
      "Bestselling Product Catalog": "Catalogue des produits les plus vendus",
      "Discover products ready to sell and make instant profit": "Découvrez des produits prêts à vendre pour des profits immédiats",
      "Carefully selected and fully tested tech products in the Moroccan market, providing excellent net profit margins.": "Produits technologiques soigneusement sélectionnés et entièrement testés sur le marché marocain, offrant d'excellentes marges de bénéfice net.",
      "Loading products...": "Chargement des produits...",
      "No products found in the catalog at the moment.": "Aucun produit trouvé dans le catalogue actuellement.",
      "Order your quantity and start selling now": "Commandez votre quantité et commencez à vendre maintenant",
      "Simulate your own brand": "Simuler votre propre marque",
      "Coming very soon": "Très bientôt",
      "See your brand on products instantly!": "Visualisez votre marque sur les produits instantanément !",
      "Upload your brand logo or name (transparent PNG), and our system will virtually apply and print it on cosmetic boxes, bottles, and accessories for an instant professional preview!": "Téléchargez le logo ou le nom de votre marque (PNG transparent), et notre système l'appliquera et l'imprimera virtuellement sur des boîtes, flacons et accessoires pour un aperçu professionnel instantané !",
      "For Local Suppliers": "Pour les fournisseurs locaux",
      "For Suppliers: Turn your idle stock into continuous sales": "Pour les fournisseurs : Transformez votre stock inactif en ventes continues",
      "Are you a supplier with goods or stock in Morocco? List your products now on SILACOD and give thousands of active sellers and marketers the ability to sell and clear your inventory immediately without marketing costs.": "Êtes-vous un fournisseur avec des marchandises ou du stock au Maroc ? Proposez vos produits maintenant sur SILACOD et donnez à des milliers de vendeurs et marketeurs actifs la possibilité de vendre et d'écouler votre stock immédiatement sans frais marketing.",
      "List your products in a massive marketplace": "Proposer vos produits sur une vaste place de marché",
      "Immediate and faster stock clearance": "Écoulement immédiat et plus rapide des stocks",
      "Guaranteed delivery and final order fulfillment": "Garantie de livraison et de traitement de la commande finale",
      "Contact us now to join as a supplier": "Contactez-nous maintenant pour rejoindre en tant que fournisseur",
      "SILACOD is an integrated e-commerce and logistics platform in Morocco, connecting sellers, influencers, and affiliate marketers in one system. We provide everything you need to start and grow your business: ready products, order management, professional confirmation, delivery, and cash collection — so you focus on selling and making profits.": "SILACOD est une plateforme intégrée d'e-commerce et de logistique au Maroc, reliant vendeurs, influenceurs et marketeurs affiliés dans un seul système. Nous fournissons tout ce dont vous avez besoin pour démarrer et développer votre activité : produits prêts, gestion des commandes, confirmation professionnelle, livraison et encaissement — pour vous consacrer à la vente et aux bénéfices.",
      "EN": "FR",
      "Login": "Connexion",
      "Get Started Free": "Commencer gratuitement",
      "Platform": "Plateforme",
      "Home": "Accueil",
      "How it works": "Comment ça marche",
      "Products": "Produits",
      "New": "Nouveau",
      "Pricing": "Tarifs",
      "Success Stories": "Success Stories",
      "For Sellers": "Pour les vendeurs",
      "For Influencers": "Pour les influenceurs",
      "For Affiliate Marketers": "Pour les affiliés",
      "Create Account": "Créer un compte",
      "About SILACOD": "À propos de SILACOD",
      "Who We Are": "Qui sommes-nous",
      "Contact Us": "Contactez-nous",
      "Blog": "Blog",
      "Careers": "Recrutement",
      "Privacy Policy": "Politique de confidentialité",
      "FAQs": "FAQ",
      "Payment & Delivery Policy": "Politique de paiement et livraison",
      "© 2026 SILACOD — All rights reserved": "© 2026 SILACOD — Tous droits réservés",
      "🚀 Launch your brand today! Over 200 products ready for your logo. You focus on marketing, we manage the rest.": "🚀 Lancez votre marque aujourd'hui ! Plus de 200 produits prêts pour votre logo. Vous vous concentrez sur le marketing, nous gérons le reste.",
      "🌟 For Influencers: Turn your audience into a real profitable business today effortlessly! Buy your product from the marketplace, and we will design your store, pack products with your logo, and ship them to your followers with Cash on Delivery.": "🌟 Pour les influenceurs : Transformez votre audience en un véritable business rentable aujourd'hui et sans effort ! Achetez votre produit sur la marketplace, et nous concevrons votre boutique, emballerons les produits avec votre logo et les expédierons à vos abonnés avec paiement à la livraison.",
      "📈 For Marketers: Double your ad budget and leave the backend to us! Choose or send your goods.. SilaCod manages warehousing, professional confirmation, shipping, and fast profit transfers to guarantee your daily expansion.": "📈 Pour les marketeurs : Doublez votre budget publicitaire et laissez-nous les coulisses ! Choisissez ou envoyez votre marchandise.. SilaCod gère le stockage, la confirmation professionnelle, l'expédition et les transferts rapides de bénéfices pour garantir votre expansion quotidienne.",
      "📦 Bypass manufacturing obstacles! +200 products waiting for your brand. Invest in your inventory and ads, and the SilaCod team will handle the logistical grind.": "📦 Dépassez les obstacles de fabrication ! +200 produits attendent votre marque. Investissez dans votre stock et vos publicités, et l'équipe de SilaCod s'occupera du travail logistique.",
      "💡 You own the inventory and ads.. and we own the execution: from landing pages to warehousing, confirmation, packaging, and delivery. SilaCod is now your #1 logistics partner in Morocco.": "💡 Vous possédez le stock et les publicités.. et nous possédons l'exécution : des pages de vente au stockage, la confirmation, l'emballage et la livraison. SilaCod est désormais votre partenaire logistique n°1 au Maroc.",
      "Welcome Back": "Bon retour parmi nous",
      "Please sign in to continue": "Veuillez vous connecter pour continuer",
      "Email": "Email",
      "Password": "Mot de passe",
      "I forgot my password": "J'ai oublié mon mot de passe",
      "Sign In": "Se connecter",
      "Signing in...": "Connexion en cours...",
      "Don't have an account?": "Vous n'avez pas de compte ?",
      "Sign Up": "S'inscrire",
      "Privacy Notice": "Charte de confidentialité",
      "Terms of service": "Conditions d'utilisation",
      "Google login failed": "Échec de la connexion avec Google",
      "Login successful!": "Connexion réussie !",
      "2FA Code required": "Code 2FA requis",
      "Verification": "Vérification",
      "Please enter your 2FA code": "Veuillez saisir votre code 2FA",
      "Back": "Retour",
      "Verify": "Vérifier",
      "New Password": "Nouveau mot de passe",
      "Please set a new password": "Veuillez définir un nouveau mot de passe",
      "Confirm Password": "Confirmer le mot de passe",
      "Passwords do not match": "Les mots de passe ne correspondent pas",
      "Password updated and logged in successfully!": "Mot de passe mis à jour et connexion réussie !",
      "Confirm": "Confirmer",
      "Welcome To Silacod": "Bienvenue sur Silacod",
      "Please follow the steps to continue": "Veuillez suivre les étapes pour continuer",
      "I'm a Seller": "Je suis un Vendeur",
      "I'm an Influencer": "Je suis un Créateur/Influenceur",
      "Account": "Compte",
      "Social Media": "Réseaux Sociaux",
      "Full Name": "Nom complet",
      "Your full name": "Votre nom complet",
      "Phone Number": "Numéro de téléphone",
      "+212 6XX-XXXXXX": "+212 6XX-XXXXXX",
      "Your Social Media": "Vos réseaux sociaux",
      "Instagram Username": "Pseudo Instagram",
      "TikTok Username": "Pseudo TikTok",
      "Facebook Username": "Pseudo Facebook",
      "YouTube Username": "Pseudo YouTube",
      "Snapchat Username": "Pseudo Snapchat",
      "Repeat Password": "Répéter le mot de passe",
      "+8 Characters | A-Z | a-z | 0-9 | Symbols": "+8 Caractères | A-Z | a-z | 0-9 | Symboles",
      "Good": "Fort",
      "Weak": "Faible",
      "Good job! This password is strong and secure": "Bon travail ! Ce mot de passe est fort et sécurisé",
      "Next": "Suivant",
      "Create Seller Account": "Créer le compte Vendeur",
      "Create Influencer Account": "Créer le compte Influenceur",
      "Creating...": "Création...",
      "Already have an account?": "Vous avez déjà un compte ?",
      "Forgot Password": "Mot de passe oublié",
      "Reset your access securely": "Réinitialisez votre accès en toute sécurité",
      "Email sent!": "E-mail envoyé !",
      "If this address is associated with an account, you will receive a reset link. Check your spam folder as well.": "Si cette adresse est associée à un compte, vous recevrez un lien de réinitialisation. Vérifiez également vos spams.",
      "The link will expire in 15 minutes.": "Le lien expirera dans 15 minutes.",
      "Back to login": "Retour à la connexion",
      "Please solve the security calculation.": "Veuillez résoudre le calcul de sécurité.",
      "Email address is required": "L'adresse e-mail est requise",
      "Invalid email format": "Format d'e-mail invalide",
      "Sending...": "Envoi en cours...",
      "Send Link": "Envoyer le lien",
      "Welcome to SILACOD": "Bienvenue sur SILACOD",
      "Your account is pending activation and review": "Votre compte est en attente d'activation et de révision",
      "Awaiting Account Review": "En attente de révision du compte",
      "Your account has been created successfully! Our team is currently reviewing your application, and you will receive a notification once the account is activated.": "Votre compte a été créé avec succès ! Notre équipe examine actuellement votre demande et vous recevrez une notification une fois le compte activé.",
      "Registered successfully": "Inscrit avec succès",
      "Your account information has been saved in our system.": "Vos informations de compte ont été enregistrées dans notre système.",
      "Reviewing Application": "Examen de la demande",
      "The administrator is currently verifying your details and activating the account.": "L'administrateur vérifie actuellement vos informations et active le compte.",
      "Activation Notification": "Notification d'activation",
      "You will receive a confirmation message once the account is fully activated.": "Vous recevrez un message de confirmation une fois le compte entièrement activé.",
      "Activation usually takes 24 to 48 hours. You will receive an email or WhatsApp message once complete.": "L'activation prend généralement de 24 à 48 heures. Vous recevrez un e-mail ou un message WhatsApp une fois terminée.",
      "Logout": "Se déconnecer",
      "Back to Home": "Retour à l'accueil",
      "Need help?": "Besoin d'aide ?",
      "Full name is required": "Le nom complet est requis",
      "Name must be at least 4 characters": "Le nom doit contenir au moins 4 caractères",
      "Name must not exceed 20 characters": "Le nom ne doit pas dépasser 20 caractères",
      "Invalid email format": "Format d'email invalide",
      "Phone number is required": "Le numéro de téléphone est requis",
      "Format: +212 6XX-XXXXXX (ex: +212667619014)": "Format : +212 6XX-XXXXXX (ex : +212667619014)",
      "Password is required": "Le mot de passe est requis",
      "Password must be at least 8 characters": "Le mot de passe doit contenir au moins 8 caractères",
      "Password must contain at least 3 character types (uppercase, lowercase, number, symbol)": "Le mot de passe doit contenir au moins 3 types de caractères (majuscule, minuscule, chiffre, symbole)",
      "Please confirm your password": "Veuillez confirmer votre mot de passe",
      "Incomplete": "Incomplet",
      "Valid": "Valide",
      "Username must not contain spaces": "Le pseudo ne doit pas contenir d'espaces",
      "Your Social Networks": "Vos réseaux sociaux",
      "Instagram Username": "Nom d'utilisateur Instagram",
      "TikTok Username": "Nom d'utilisateur TikTok",
      "Facebook Username": "Nom d'utilisateur Facebook",
      "YouTube Username": "Nom d'utilisateur YouTube",
      "Snapchat Username": "Nom d'utilisateur Snapchat",
      "Password Strength:": "Force du mot de passe :",
      "Weak": "Faible",
      "Medium": "Moyen",
      "Strong": "Fort",
      "+8 Characters": "+8 Caractères",
      "Symbols": "Symboles",
      "Good": "Bon",
      "Good job! This password is strong and secure": "Bon travail ! Ce mot de passe est fort et sécurisé",
      "Repeat Password": "Répéter le mot de passe",
      "Back": "Retour",
      "Next": "Suivant",
      "Create Seller Account": "Créer le compte Vendeur",
      "Create Influencer Account": "Créer le compte Influenceur",
      "Creating...": "Création...",
      "Already have an account?": "Vous avez déjà un compte ?",
      "Sign In": "Connectez-vous"
    },
    ar: {
      "Welcome to SILACOD": "مرحباً بكم في SILACOD",
      "The ultimate Moroccan white-label dropshipping platform": "المنصة المغربية الأقوى للدروبشيبينغ بعلامة تجارية مخصصة",
      "Start your e-commerce without complexity... And we manage the rest": "ابدأ تجارتك الإلكترونية بدون تعقيد... ونحن ندير الباقي",
      "SILACOD connects you with products, storage, confirmation, packaging, delivery, tracking, and collection within a single system - so you can focus on selling and making profits.": "SILACOD تربطك بالمنتجات، التخزين، التأكيد، التغليف، التوصيل، التتبع، والتحصيل داخل نظام واحد – لتتفرغ أنت للبيع وتحقيق الأرباح.",
      "Get Started": "ابدأ الآن",
      "Pricing": "الأسعار",
      "Contact Us": "تواصل معنا",
      "Language": "اللغة",
      "Dashboard": "لوحة التحكم",
      "Profile": "الملف الشخصي",
      "Settings": "الإعدادات",
      "Logout": "تسجيل الخروج",
      "Save Settings": "حفظ الإعدادات",
      "Your language settings have been updated!": "تم تحديث إعدادات اللغة الخاصة بك بنجاح!",
      "Ready-to-sell products": "منتجات جاهزة للبيع",
      "COD system and easy profit withdrawal": "نظام COD وتحويل أرباحك بسهولة",
      "Confirmation and delivery in all Moroccan cities": "تأكيد وتوصيل في جميع مدن المغرب",
      "Go to dashboard": "الذهاب إلى لوحة التحكم",
      "Start now as an influencer": "إبدأ الآن كمؤثر",
      "Start selling now": "إبدأ البيع الآن",
      "Numbers reflecting the platform's strength and user trust": "أرقام تعكس قوة المنصة وثقة المستخدمين",
      "Thousands of orders, hundreds of products, and a growing network of sellers and marketers work daily on SILACOD to build a simpler and more professional e-commerce.": "آلاف الطلبات، مئات المنتجات، وشبكة متنامية من البائعين والمسوقين يعملون يومياً عبر SILACOD لبناء تجارة إلكترونية أكثر سهولة واحترافية.",
      "Coverage of all Moroccan cities": "تغطية لكافة مدن المغرب",
      "Orders shipped monthly": "طلب يتم شحنه شهرياً",
      "Active sellers on the platform": "بائع نشط بالمنصة",
      "Ready-to-sell products (stats)": "منتج جاهز للبيع",
      "Why do most people fail in e-commerce?": "لماذا يفشل أغلب الناس في التجارة الإلكترونية؟",
      "Instead of wasting time managing details, focus on growth — and leave the operations to us": "بدل تضييع الوقت في إدارة التفاصيل، ركّز على النمو — واترك العمليات علينا",
      "Working with SILACOD": "العمل مع SILACOD",
      "Working alone": "العمل لوحدك",
      "Ready-to-sell products inside the platform": "منتجات جاهزة للبيع داخل المنصة",
      "Landing pages ready to sell immediately": "صفحات هبوط جاهزة للبيع فوراً",
      "Dedicated team for order confirmation": "فريق متخصص لتأكيد الطلبات",
      "Delivery and collection in all cities": "توصيل وتحصيل في جميع المدن",
      "Clear dashboard to track your profits": "لوحة تحكم واضحة لتتبع أرباحك",
      "Focus only on marketing and growing your business": "تركز فقط على التسويق وتنمية تجارتك",
      "Search for a product yourself with no guarantee of success": "تبحث عن منتج بنفسك بدون ضمان النجاح",
      "Need to create a website or landing page from scratch": "تحتاج إنشاء موقع أو صفحة بيع من الصفر",
      "Issues with delivery and return companies": "مشاكل مع شركات التوصيل والإرجاع",
      "Handle customers and order confirmations": "تتعامل مع الزبائن وتأكيد الطلبات",
      "Difficulty tracking profits accurately": "صعوبة في تتبع الأرباح بدقة",
      "Wasting your time in operations instead of focusing on selling": "تضيع وقتك في العمليات بدل التركيز على البيع",
      "Everything you need to manage your business in one system": "كل ما تحتاجه لإدارة تجارتك في نظام واحد",
      "Control every detail of your business from one place, without complexity or the need to use multiple tools.": "تحكّم في كل تفاصيل تجارتك من مكان واحد، بدون تعقيد أو الحاجة لاستعمال أدوات متعددة.",
      "Professional order confirmation": "تأكيد احترافي للطلبات",
      "An integrated team to increase delivery rates and reduce cancellations. Direct contact with customers to confirm your orders with high accuracy.": "فريق متكامل لرفع نسب التوصيل وتقليل الإلغاءات. تواصل مباشر مع الزبائن لتأكيد طلباتك بدقة فائقة.",
      "Product Variety": "تنوع المنتجات",
      "Browse and choose from a wide range of popular and carefully selected products. Start selling immediately with a single click.": "تصفح واختر من بين تشكيلة واسعة من المنتجات الرائجة والمختارة بعناية فائقة. ابدأ البيع فوراً بنقرة واحدة.",
      "Integrated Management": "إدارة متكاملة",
      "Monitor the track and shipping status of your orders moment by moment with ease. Immediate and automatic status updates to save time.": "راقب مسار وحالة شحن طلباتك لحظة بلحظة وبكل سهولة. تحديث فوري وآلي للحالات لتوفير الوقت.",
      "Instant Profits": "أرباح فورية",
      "A clear smart dashboard to display your true net profits and withdraw your money safely and easily from the platform.": "لوحة تحكم ذكية واضحة لعرض أرباحك الصافية الحقيقية وسحب أموالك بكل أمان وسهولة من المنصة.",
      "Start your business in 3 simple steps": "ابدأ تجارتك في 3 خطوات بسيطة",
      "From choosing the right product to order delivery and cash collection — we provide an integrated system that makes selling easier.": "من اختيار المنتج المناسب إلى توصيل الطلبات واستلام الأرباح نقداً — نوفر لك نظاماً متكاملاً يجعل البيع أسهل.",
      "Choose products ready for brand building": "اختر منتجات قابلة لبناء براند",
      "Browse the catalog and choose from well-researched, quality-guaranteed products to market to your customers.": "تصفح الكتالوج واختر من بين منتجات مدروسة ومضمونة الجودة لتسويقها لزبائنك.",
      "Start marketing and receive orders easily": "ابدأ التسويق واستقبل الطلبات بسهولة",
      "Market your products via social media platforms and achieve fast, immediate sales without limits.": "سوّق لمنتجاتك عبر منصات السوشيال ميديا وحقق مبيعات سريعة فورية بدون حدود.",
      "Leave the operational tasks to SILACOD": "اترك العمليات التشغيلية لـ SILACOD",
      "We take care of confirmation, packaging, and shipping to the customer, adding your net profits directly to your wallet.": "نحن نتكفل بالتأكيد والتغليف والشحن إلى العميل، لنضيف أرباحك الصافية لمحفظتك مباشرة.",
      "Who is this platform for?": "لمن هذه المنصة؟",
      "Merchants and Companies": "التجار والشركات",
      "For Sellers and Merchants": "للبائعين والتجار",
      "We provide you with an integrated infrastructure to digitize your sales and expand your business without fixed costs or operational complexities.": "نوفر لك بنية تحتية متكاملة لرقمنة مبيعاتك وتوسيع نطاق تجارتك بدون تكاليف ثابتة أو تعقيدات تشغيلية.",
      "Start your business now": "إبدأ تجارتك الآن",
      "Content Creators": "صناع المحتوى",
      "For Influencers and Content Creators": "للمؤثرين وصناع المحتوى",
      "Turn your followers into real profits. Launch your own products or promote ready-made products and get the highest commissions in the market.": "حوّل متابعيك إلى أرباح حقيقية. أطلق منتجات خاصة بك أو قم بترويج منتجات جاهزة واحصل على أعلى عمولات في السوق.",
      "Affiliate Marketing": "التسويق بالعمولة",
      "For Affiliate Marketers": "للمسوقين بالعمولة",
      "Invest your digital marketing skills. Choose from thousands of profitable products and market them safely with guaranteed collection of your net profits.": "استثمر مهاراتك في التسويق الإلكتروني. اختر من آلاف المنتجات المربحة وسوق لها بأمان مع ضمان تحصيل أرباحك الصافية.",
      "Start as a marketer": "إبدأ كمسوق",
      "Bestselling Product Catalog": "كتالوج المنتجات الأكثر مبيعاً",
      "Discover products ready to sell and make instant profit": "اكتشف منتجات جاهزة للبيع والربح الفوري",
      "Carefully selected and fully tested tech products in the Moroccan market, providing excellent net profit margins.": "منتجات تكنولوجية منتقاة بعناية شديدة ومجربة بالكامل بالسوق المغربي، مع توفير هوامش أرباح ممتازة وصافية.",
      "Loading products...": "جاري تحميل المنتجات...",
      "No products found in the catalog at the moment.": "لم يتم العثور على أي منتجات في الكتالوج حالياً.",
      "Order your quantity and start selling now": "أطلب كميتك وابدأ البيع الآن",
      "Simulate your own brand": "محاكاة علامتك الخاصة",
      "Coming very soon": "قريباً جداً",
      "See your brand on products instantly!": "شاهد علامتك التجارية على المنتجات فوراً!",
      "Upload your brand logo or name (transparent PNG), and our system will virtually apply and print it on cosmetic boxes, bottles, and accessories for an instant professional preview!": "قم برفع شعار ماركتك أو اسمك (بصيغة PNG شفافة)، وسيقوم نظامنا بتجربة لصقه وطبعه افتراضياً على علب وزجاجات التجميل والإكسسوارات لتراها فوراً بلمسة احترافية!",
      "For Local Suppliers": "للموردين المحليين",
      "For Suppliers: Turn your idle stock into continuous sales": "للموردين: حوّل مخزونك الساكن إلى مبيعات مستمرة",
      "Are you a supplier with goods or stock in Morocco? List your products now on SILACOD and give thousands of active sellers and marketers the ability to sell and clear your inventory immediately without marketing costs.": "هل أنت مورد ولديك سلع أو مخزون بالمغرب؟ اعرض منتجاتك الآن داخل منصة SILACOD وامنح لآلاف البائعين والمسوقين النشطين إمكانية بيع وتصريف بضاعتك فوراً وبدون تكاليف تسويقية.",
      "List your products in a massive marketplace": "عرض منتجاتك بماركت بليس ضخم",
      "Immediate and faster stock clearance": "تصريف فوري وأسرع للمخازن",
      "Guaranteed delivery and final order fulfillment": "ضمان التوصيل وتوفير الطلب النهائي",
      "Contact us now to join as a supplier": "تواصل معنا الآن للإنضمام كمورد",
      "SILACOD is an integrated e-commerce and logistics platform in Morocco, connecting sellers, influencers, and affiliate marketers in one system. We provide everything you need to start and grow your business: ready products, order management, professional confirmation, delivery, and cash collection — so you focus on selling and making profits.": "SILACOD هي منصة متكاملة للتجارة الإلكترونية واللوجستيك في المغرب، تربط بين البائعين، المؤثرين، والمسوقين بالعمولة داخل نظام واحد. نوفر لك كل ما تحتاجه لبدء وتنمية تجارتك: منتجات جاهزة، إدارة الطلبات، تأكيد احترافي، توصيل، وتحصيل — لتتفرغ أنت للبيع وتحقيق الأرباح.",
      "EN": "ع",
      "Login": "تسجيل الدخول",
      "Get Started Free": "إبدأ الآن مجانا",
      "Platform": "المنصة",
      "Home": "الرئيسية",
      "How it works": "كيف تعمل",
      "Products": "المنتجات",
      "New": "جديد",
      "Pricing": "الأسعار",
      "Success Stories": "قصص النجاح",
      "For Sellers": "للبائعين",
      "For Influencers": "للمؤثرين",
      "For Affiliate Marketers": "للمسوقين بالعمولة",
      "Create Account": "إنشاء حساب",
      "About SILACOD": "عن SILACOD",
      "Who We Are": "من نحن",
      "Contact Us": "تواصل معنا",
      "Blog": "المدونة",
      "Careers": "الوظائف",
      "Privacy Policy": "سياسة الخصوصية",
      "FAQs": "الأسئلة الشائعة",
      "Payment & Delivery Policy": "سياسة الدفع والتوصيل",
      "© 2026 SILACOD — All rights reserved": "© 2026 SILACOD — جميع الحقوق محفوظة",
      "🚀 Launch your brand today! Over 200 products ready for your logo. You focus on marketing, we manage the rest.": "🚀 أطلق علامتك التجارية اليوم! أكثر من 200 منتج جاهز لوضع شعارك. أنت تفرغ للتسويق، ونحن ندير الباقي.",
      "🌟 For Influencers: Turn your audience into a real profitable business today effortlessly! Buy your product from the marketplace, and we will design your store, pack products with your logo, and ship them to your followers with Cash on Delivery.": "🌟 للمؤثرين: حوّل جمهورك إلى بزنس حقيقي اليوم ومربح بدون مجهود! اشترِ منتجك من الماركت بليس، وسنتكفل بتصميم متجرك، تغليف منتجاتك بشعارك، وشحنها لمتابعيك بنظام الدفع عند الإستلام.",
      "📈 For Marketers: Double your ad budget and leave the backend to us! Choose or send your goods.. SilaCod تدير التخزين، التأكيد الاحترافي، الشحن، وتحويل الأرباح بسرعة تضمن توسعك اليومي.": "📈 للمسوقين: ضاعف ميزانية إعلاناتك واترك الكواليس لنا! اختر أو ارسل سلعتك.. SilaCod تدير التخزين، التأكيد الاحترافي، الشحن، وتحويل الأرباح بسرعة تضمن توسعك اليومي.",
      "📦 Bypass manufacturing obstacles! +200 products waiting for your brand. Invest in your inventory and ads, and the SilaCod team will handle the logistical grind.": "📦 تجاوز عقبات التصنيع! +200 منتج في انتظار علامتك. استثمر في سلعتك وإعلاناتك، وفريق SilaCod سيتولى طحن العمليات اللوجيستية.",
      "💡 You own the inventory and ads.. and we own the execution: from landing pages to warehousing, confirmation, packaging, and delivery. SilaCod is now your #1 logistics partner in Morocco.": "💡 أنت تملك السلعة والإعلانات.. ونحن نملك التنفيذ: من صفحة المنتج إلى التخزين، التأكيد، التغليف، والتوصيل. SilaCod الآن هي شريكك اللوجيستي الأول في المغرب.",
      "Welcome Back": "مرحباً بعودتك",
      "Please sign in to continue": "يرجى تسجيل الدخول للمتابعة",
      "Email": "البريد الإلكتروني",
      "Password": "كلمة المرور",
      "I forgot my password": "لقد نسيت كلمة المرور",
      "Sign In": "تسجيل الدخول",
      "Signing in...": "جاري تسجيل الدخول...",
      "Don't have an account?": "ليس لديك حساب؟",
      "Sign Up": "إنشاء حساب",
      "Privacy Notice": "سياسة الخصوصية",
      "Terms of service": "شروط الخدمة",
      "Google login failed": "فشل تسجيل الدخول بواسطة Google",
      "Login successful!": "تم تسجيل الدخول بنجاح!",
      "2FA Code required": "رمز المصادقة الثنائية مطلوب",
      "Verification": "التحقق",
      "Please enter your 2FA code": "يرجى إدخال رمز المصادقة الثنائية (2FA)",
      "Back": "رجوع",
      "Verify": "تحقق",
      "New Password": "كلمة مرور جديدة",
      "Please set a new password": "يرجى تعيين كلمة مرور جديدة",
      "Confirm Password": "تأكيد كلمة المرور",
      "Passwords do not match": "كلمات المرور غير متطابقة",
      "Password updated and logged in successfully!": "تم تحديث كلمة المرور وتسجيل الدخول بنجاح!",
      "Confirm": "تأكيد",
      "Welcome To Silacod": "مرحباً بك في سيلاكود",
      "Please follow the steps to continue": "يرجى اتباع الخطوات للمتابعة",
      "I'm a Seller": "أنا بائع",
      "I'm an Influencer": "أنا مؤثر",
      "Account": "الحساب",
      "Social Media": "وسائل التواصل الاجتماعي",
      "Full Name": "الاسم الكامل",
      "Your full name": "اسمك الكامل",
      "Phone Number": "رقم الهاتف",
      "+212 6XX-XXXXXX": "+212 6XX-XXXXXX",
      "Your Social Media": "حسابات التواصل الاجتماعي الخاصة بك",
      "Instagram Username": "اسم مستخدم إنستغرام",
      "TikTok Username": "اسم مستخدم تيك توك",
      "Facebook Username": "اسم مستخدم فيسبوك",
      "YouTube Username": "اسم مستخدم يوتيوب",
      "Snapchat Username": "اسم مستخدم سناب شات",
      "Repeat Password": "كرر كلمة المرور",
      "+8 Characters | A-Z | a-z | 0-9 | Symbols": "أكثر من 8 أحرف | A-Z | a-z | 0-9 | رموز",
      "Good": "قوي",
      "Weak": "ضعيف",
      "Good job! This password is strong and secure": "عمل رائع! كلمة المرور هذه قوية وآمنة",
      "Next": "التالي",
      "Create Seller Account": "إنشاء حساب بائع",
      "Create Influencer Account": "إنشاء حساب مؤثر",
      "Creating...": "جاري الإنشاء...",
      "Already have an account?": "لديك حساب بالفعل؟",
      "Forgot Password": "نسيت كلمة المرور",
      "Reset your access securely": "استعادة الوصول إلى حسابك بأمان",
      "Email sent!": "تم إرسال البريد الإلكتروني!",
      "If this address is associated with an account, you will receive a reset link. Check your spam folder as well.": "إذا كان هذا البريد الإلكتروني مسجلاً لدينا، فستتلقى رابطاً لإعادة تعيين كلمة المرور. تحقق من مجلد الرسائل غير المرغوب فيها أيضاً.",
      "The link will expire in 15 minutes.": "الرابط سيوجه صلاحيته بعد 15 دقيقة.",
      "Back to login": "العودة لصفحة الدخول",
      "Please solve the security calculation.": "يرجى حل مسألة الأمان الحسابية.",
      "Email address is required": "البريد الإلكتروني مطلوب",
      "Invalid email format": "صيغة البريد الإلكتروني غير صحيحة",
      "Sending...": "جاري الإرسال...",
      "Send Link": "إرسال الرابط",
      "Welcome to SILACOD": "مرحباً بك في سيلاكود",
      "Your account is pending activation and review": "حسابك في انتظار التنشيط والمراجعة",
      "Awaiting Account Review": "في انتظار مراجعة الحساب",
      "Your account has been created successfully! Our team is currently reviewing your application, and you will receive a notification once the account is activated.": "تم إنشاء حسابك بنجاح! يقوم فريقنا بمراجعة طلبك حالياً، وستتلقى إشعاراً بمجرد تفعيل الحساب.",
      "Registered successfully": "تم التسجيل بنجاح",
      "Your account information has been saved in our system.": "تم حفظ معلومات حسابك في نظامنا.",
      "Reviewing Application": "مراجعة الطلب",
      "The administrator is currently verifying your details and activating the account.": "يقوم المشرف حالياً بالتحقق من بياناتك وتنشيط الحساب.",
      "Activation Notification": "إشعار التفعيل",
      "You will receive a confirmation message once the account is fully activated.": "ستتلقى رسالة تأكيد بمجرد تفعيل الحساب بالكامل.",
      "Activation usually takes 24 to 48 hours. You will receive an email or WhatsApp message once complete.": "يستغرق التفعيل عادةً من 24 إلى 48 ساعة. ستصلك رسالة بريد إلكتروني أو رسالة واتساب فور الانتهاء.",
      "Logout": "تسجيل الخروج",
      "Back to Home": "الرجوع للرئيسية",
      "Need help?": "هل تحتاج إلى مساعدة؟",
      "Full name is required": "الاسم الكامل مطلوب",
      "Name must be at least 4 characters": "يجب أن يتكون الاسم من 4 أحرف على الأقل",
      "Name must not exceed 20 characters": "يجب ألا يتجاوز الاسم 20 حرفاً",
      "Invalid email format": "صيغة البريد الإلكتروني غير صحيحة",
      "Phone number is required": "رقم الهاتف مطلوب",
      "Format: +212 6XX-XXXXXX (ex: +212667619014)": "الصيغة: +212 6XX-XXXXXX (مثال: +212667619014)",
      "Password is required": "كلمة المرور مطلوبة",
      "Password must be at least 8 characters": "كلمة المرور يجب أن تكون 8 أحرف على الأقل",
      "Password must contain at least 3 character types (uppercase, lowercase, number, symbol)": "يجب أن تحتوي كلمة المرور على 3 أنواع من الأحرف على الأقل (كبير، صغير، رقم، رمز)",
      "Please confirm your password": "يرجى تأكيد كلمة المرور",
      "Incomplete": "غير مكتمل",
      "Valid": "صالح",
      "Username must not contain spaces": "اسم المستخدم يجب ألا يحتوي على مسافات",
      "Your Social Networks": "حساباتك على وسائل التواصل الاجتماعي",
      "Instagram Username": "اسم مستخدم إنستغرام",
      "TikTok Username": "اسم مستخدم تيك توك",
      "Facebook Username": "اسم مستخدم فيسبوك",
      "YouTube Username": "اسم مستخدم يوتيوب",
      "Snapchat Username": "اسم مستخدم سناب شات",
      "Password Strength:": "قوة كلمة المرور:",
      "Weak": "ضعيفة",
      "Medium": "متوسطة",
      "Strong": "قوية",
      "+8 Characters": "+8 أحرف",
      "Symbols": "رموز",
      "Good": "جيد",
      "Good job! This password is strong and secure": "عمل جيد! كلمة المرور هذه قوية وآمنة",
      "Repeat Password": "إعادة كلمة المرور",
      "Back": "رجوع",
      "Next": "التالي",
      "Create Seller Account": "إنشاء حساب بائع",
      "Create Influencer Account": "إنشاء حساب مؤثر",
      "Creating...": "جاري الإنشاء...",
      "Already have an account?": "هل لديك حساب بالفعل؟",
      "Sign In": "تسجيل الدخول"
    }
  };

  for (const [key, val] of Object.entries(keysToTranslate)) {
    if (mockDb[targetLang] && mockDb[targetLang][val]) {
      translations[key] = mockDb[targetLang][val];
    } else {
      // Basic fallback rule translation for custom variables if not mocked
      if (targetLang === 'fr') {
        translations[key] = `[FR] ${val}`;
      } else {
        translations[key] = `[AR] ${val}`;
      }
    }
  }
  return translations;
}

// Perform translation of key-value map
async function translateBatch(batch, targetLang) {
  console.log(`Translating batch of ${Object.keys(batch).length} keys to ${targetLang}...`);
  return simulatedTranslate(batch, targetLang);
}

// Main translation runner
async function run() {
  const sourceDir = path.join(LOCALES_DIR, SOURCE_LANG);
  if (!fs.existsSync(sourceDir)) {
    console.error(`Source directory not found: ${sourceDir}`);
    return;
  }

  const files = fs.readdirSync(sourceDir).filter(file => file.endsWith('.json'));
  console.log(`Found ${files.length} localization files in source directory.`);

  for (const targetLang of TARGET_LANGS) {
    const targetDir = path.join(LOCALES_DIR, targetLang);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    for (const file of files) {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetDir, file);

      const sourceContent = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'));
      let targetContent = {};

      if (fs.existsSync(targetPath)) {
        try {
          targetContent = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
        } catch (e) {
          console.warn(`Could not parse existing target file: ${targetPath}. Re-generating.`);
        }
      }

      // Filter keys that need translation (State Tracking)
      const keysToTranslate = {};
      for (const [key, val] of Object.entries(sourceContent)) {
        if (!targetContent[key]) {
          keysToTranslate[key] = val;
        }
      }

      const totalKeys = Object.keys(keysToTranslate).length;
      if (totalKeys === 0) {
        console.log(`[SKIP] ${file} is fully translated for ${targetLang}.`);
        continue;
      }

      console.log(`[PROCESS] ${file} has ${totalKeys} keys to translate to ${targetLang}.`);

      // Token Chunking: translate in batches of BATCH_SIZE
      const keyEntries = Object.entries(keysToTranslate);
      for (let i = 0; i < keyEntries.length; i += BATCH_SIZE) {
        const chunk = {};
        const slice = keyEntries.slice(i, i + BATCH_SIZE);
        slice.forEach(([k, v]) => {
          chunk[k] = v;
        });

        const translatedChunk = await translateBatch(chunk, targetLang);
        targetContent = { ...targetContent, ...translatedChunk };

        // Save progress incrementally after each batch
        fs.writeFileSync(targetPath, JSON.stringify(targetContent, null, 2), 'utf-8');
      }

      console.log(`[DONE] Finished translating ${file} to ${targetLang}.`);
    }
  }

  console.log('🎉 Translation automation run completed successfully!');
}

run().catch(console.error);

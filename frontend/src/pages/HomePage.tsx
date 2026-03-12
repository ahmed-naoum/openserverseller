import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { publicApi } from '../lib/api';
import { 
  ShoppingBag, 
  Truck, 
  CircleDollarSign,
  Palette,
  TrendingUp,
  Globe,
  Sparkles,
  ArrowRight,
  MonitorSmartphone,
  CheckCircle2,
  Megaphone,
  Camera,
  Package
} from 'lucide-react';

export default function HomePage() {
  const [isVisible, setIsVisible] = useState(false);
  const { scrollYProgress } = useScroll();
  const yPos = useTransform(scrollYProgress, [0, 1], [0, -100]);
  
  // Dummy stats simulating real-time activity
  const [stats, setStats] = useState({ vendors: 843, products: 215, orders: 12450 });
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);

  useEffect(() => {
    setIsVisible(true);
    // Animate stats up
    const duration = 2000;
    const steps = 50;
    const stepTime = duration / steps;
    let currentStep = 0;

    const targetStats = { vendors: 843, products: 215, orders: 12450 };

    const interval = setInterval(() => {
      currentStep++;
      setStats({
        vendors: Math.floor((targetStats.vendors / steps) * currentStep),
        products: Math.floor((targetStats.products / steps) * currentStep),
        orders: Math.floor((targetStats.orders / steps) * currentStep)
      });

      if (currentStep >= steps) {
        clearInterval(interval);
        setStats(targetStats);
      }
    }, stepTime);

    return () => clearInterval(interval);
  }, []);

  // Fetch featured products
  useEffect(() => {
    publicApi.featuredProducts().then(res => {
      setFeaturedProducts(res.data?.data?.products || []);
    }).catch(() => {});
  }, []);

  const features = [
    {
      icon: <Palette className="w-8 h-8 text-primary-500" />,
      title: 'Votre Propre Marque',
      desc: 'Logo, couleurs, et packaging. Nous créons votre identité visuelle sur-mesure.',
      colSpan: 'col-span-1 md:col-span-2',
      bgClass: 'bg-gradient-to-br from-primary-50 to-white'
    },
    {
      icon: <ShoppingBag className="w-8 h-8 text-emerald-500" />,
      title: '+200 Produits Prêts',
      desc: 'Cosmétiques de haute qualité formulés et certifiés.',
      colSpan: 'col-span-1 md:col-span-1',
      bgClass: 'bg-white'
    },
    {
      icon: <Truck className="w-8 h-8 text-blue-500" />,
      title: 'Livraison COD',
      desc: 'Nous gérons la confirmation et la livraison au Maroc.',
      colSpan: 'col-span-1 md:col-span-1',
      bgClass: 'bg-white'
    },
    {
      icon: <MonitorSmartphone className="w-8 h-8 text-indigo-500" />,
      title: 'Dashboard Temps Réel',
      desc: 'Suivez vos commandes, vos marges et gérez votre wallet.',
      colSpan: 'col-span-1 md:col-span-2',
      bgClass: 'bg-indigo-50'
    }
  ];

  return (
    <div className="min-h-screen bg-white selection:bg-primary-100 font-inter overflow-x-hidden">
      
      {/* Dynamic Navbar */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-gray-100 z-50 transition-all duration-300"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20 group-hover:scale-105 transition-transform">
                <span className="text-white font-bold text-2xl tracking-tighter">OS</span>
              </div>
              <span className="font-extrabold text-2xl bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-700">
                SILACOD
              </span>
            </Link>
            
            <div className="hidden lg:flex items-center gap-8 font-medium text-gray-600">
              <a href="#features" className="hover:text-primary-600 transition-colors">Concept</a>
              <Link to="/marketplace" className="hover:text-primary-600 transition-colors flex items-center gap-1">
                <ShoppingBag className="w-4 h-4" /> Marketplace
              </Link>
              <a href="#influencers" className="hover:text-pink-500 transition-colors flex items-center gap-1">
                <Sparkles className="w-4 h-4" /> Programme Influenceurs
              </a>
              <a href="#pricing" className="hover:text-primary-600 transition-colors">Tarifs</a>
            </div>

            <div className="flex items-center gap-4">
              <Link to="/login" className="font-semibold text-gray-700 hover:text-primary-600 transition-colors">
                Me Connecter
              </Link>
              <Link to="/register" className="btn-primary shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 hover:-translate-y-0.5 transition-all">
                Démarrer
              </Link>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 right-0 -mr-40 -mt-40 w-[800px] h-[800px] bg-primary-100/50 rounded-full blur-3xl opacity-50 mix-blend-multiply"></div>
        <div className="absolute bottom-0 left-0 -ml-40 -mb-40 w-[600px] h-[600px] bg-emerald-100/50 rounded-full blur-3xl opacity-50 mix-blend-multiply"></div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-50 text-primary-700 font-semibold text-sm mb-8 ring-1 ring-primary-100">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
                </span>
                La Plateforme Dropshipping White-Label #1 au Maroc
              </span>
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-gray-900 tracking-tight mb-8 leading-[1.1]"
            >
              Votre Marque de Cosmétiques, <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-emerald-500">
                Sans Aucun Stock.
              </span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed"
            >
              Vous vendez, nous fabriquons, confirmons et livrons vos clients en Cash-On-Delivery. Encaissez vos marges instantanément.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link to="/register" className="btn-primary btn-lg w-full sm:w-auto text-lg h-14 px-8 shadow-xl shadow-primary-500/20 hover:scale-105 transition-transform flex items-center justify-center gap-2">
                Je Crée Ma Marque <ArrowRight className="w-5 h-5" />
              </Link>
              <Link to="/influencer/register" className="w-full sm:w-auto text-lg h-14 px-8 rounded-xl font-semibold text-gray-700 bg-white border-2 border-gray-200 hover:border-pink-300 hover:text-pink-600 hover:bg-pink-50 transition-all flex items-center justify-center gap-2">
                <Camera className="w-5 h-5" /> Je suis un Influenceur
              </Link>
            </motion.div>
          </div>

          {/* Animated Stats Bar */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-20 max-w-4xl mx-auto bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 divide-y md:divide-y-0 md:divide-x divide-gray-100 text-center">
              <div className="pt-4 md:pt-0">
                <div className="text-5xl font-extrabold text-gray-900 mb-2">{stats.vendors.toLocaleString()}+</div>
                <div className="text-gray-500 font-medium">Vendeurs Partenaires</div>
              </div>
              <div className="pt-4 md:pt-0">
                <div className="text-5xl font-extrabold text-primary-600 mb-2">{stats.products.toLocaleString()}</div>
                <div className="text-gray-500 font-medium">Produits en Catalogue</div>
              </div>
              <div className="pt-4 md:pt-0">
                <div className="text-5xl font-extrabold text-gray-900 mb-2">{stats.orders.toLocaleString()}</div>
                <div className="text-gray-500 font-medium">Commandes Livrées</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Featured Products Section */}
      {featuredProducts.length > 0 && (
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-12">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Nos Produits Phares</h2>
                <p className="text-gray-500 mt-2">Découvrez notre gamme de produits cosmétiques prêts à vendre.</p>
              </div>
              <Link 
                to="/marketplace" 
                className="hidden sm:flex items-center gap-2 px-6 py-3 bg-primary-50 text-primary-700 rounded-xl font-bold hover:bg-primary-100 transition-colors"
              >
                Voir tout <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredProducts.slice(0, 8).map((product: any, i: number) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                >
                  <Link to={`/product/${product.id}`} className="block">
                    <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
                      {product.images?.[0]?.imageUrl ? (
                        <img 
                          src={product.images[0].imageUrl} 
                          alt={product.nameFr} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                        />
                      ) : (
                        <Package className="w-12 h-12 text-gray-300" />
                      )}
                    </div>
                    <div className="p-4">
                      <p className="text-xs text-primary-600 font-semibold mb-1">{product.category?.nameFr}</p>
                      <h3 className="font-bold text-gray-900 line-clamp-1">{product.nameFr}</h3>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-lg font-black text-gray-900">{product.retailPriceMad} <span className="text-xs font-bold text-gray-400">MAD</span></span>
                        <span className="w-8 h-8 bg-primary-100 text-primary-600 rounded-lg flex items-center justify-center group-hover:bg-primary-600 group-hover:text-white transition-all">
                          <ArrowRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>

            <div className="mt-8 text-center sm:hidden">
              <Link 
                to="/marketplace" 
                className="inline-flex items-center gap-2 px-8 py-4 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-200"
              >
                Voir tout le Marketplace <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Influencer Specific Section (Requested by User) */}
      <section id="influencers" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-900 text-white relative overflow-hidden">
        {/* Abstract shapes */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-pink-500 rounded-full blur-[100px] opacity-20 transform translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500 rounded-full blur-[100px] opacity-20 transform -translate-x-1/2 translate-y-1/2"></div>

        <div className="max-w-7xl mx-auto relative z-10 grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-500/10 text-pink-400 font-semibold mb-6 border border-pink-500/20">
              <Megaphone className="w-4 h-4" /> Programme Influenceurs (VIP)
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6 leading-tight">
              Monétisez votre audience, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
                nous gérons le reste.
              </span>
            </h2>
            <p className="text-xl text-gray-400 mb-8 leading-relaxed">
              Vous avez plus de 5,000 abonnés sur Instagram ? Rejoignez notre réseau exclusif. Recommandez des produits de haute qualité à votre audience et percevez des commissions instantanées sur chaque vente générée.
            </p>
            
            <ul className="space-y-4 mb-10">
              {['Commissions parmi les plus hautes du marché', 'Tracking des ventes en temps réel', 'Plus de 200 produits cosmétiques à promouvoir', 'Paiements rapides et transparents'].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-gray-300">
                  <CheckCircle2 className="w-6 h-6 text-pink-500 flex-shrink-0" />
                  <span className="text-lg">{item}</span>
                </li>
              ))}
            </ul>

            <Link to="/influencer/register" className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-pink-500/25 transition-all hover:scale-105">
              Rejoindre en tant qu'Influenceur <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="aspect-[4/5] bg-gradient-to-tr from-gray-800 to-gray-700 rounded-3xl overflow-hidden border border-gray-600 shadow-2xl relative">
               {/* Mockup UI representation inside the card */}
               <div className="absolute inset-0 p-8 flex flex-col justify-between">
                  <div>
                    <div className="w-16 h-16 bg-gradient-to-br from-pink-400 to-purple-500 rounded-2xl mb-6 shadow-lg"></div>
                    <div className="w-3/4 h-8 bg-gray-600 rounded-lg mb-4 opacity-50"></div>
                    <div className="w-1/2 h-4 bg-gray-600 rounded-lg opacity-50"></div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="bg-gray-800 p-4 rounded-xl border border-gray-600 flex justify-between items-center">
                       <div>
                         <div className="text-sm text-gray-400">Gains ce mois</div>
                         <div className="text-2xl font-bold text-white">12,450 MAD</div>
                       </div>
                       <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                          <TrendingUp className="w-6 h-6" />
                       </div>
                    </div>
                    <div className="w-full h-12 bg-pink-500 rounded-xl opacity-80 backdrop-blur-sm"></div>
                  </div>
               </div>
            </div>
            {/* Floating badge */}
            <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-2xl shadow-xl border border-gray-100 hidden md:block animate-bounce-slow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">💰</span>
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">Nouvelle Commission!</div>
                  <div className="text-green-600 font-semibold">+150.00 MAD</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Bento Grid Features */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">Un écosystème conçu pour les Marques</h2>
            <p className="text-xl text-gray-600">Tout ce dont vous avez besoin pour lancer et scaler votre business E-commerce, réuni au même endroit.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className={`${feature.colSpan} ${feature.bgClass} rounded-3xl p-8 border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 group cursor-default overflow-hidden relative`}
              >
                <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 transform translate-x-4 -translate-y-4 transition-all duration-500">
                  {feature.icon}
                </div>
                <div className="mb-6 bg-white w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 text-lg">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing CTA */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-gray-900 rounded-[3rem] p-12 lg:p-20 shadow-2xl relative overflow-hidden"
          >
            {/* Glow effect */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary-500/20 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="relative z-10 text-white">
              <h2 className="text-4xl lg:text-6xl font-extrabold mb-6">Tarification ultra-simple.</h2>
              <p className="text-xl lg:text-2xl text-gray-300 mb-12 max-w-2xl mx-auto">
                Pas d'abonnement. Pas de frais cachés. Nous réussissons quand vous réussissez.
              </p>
              
              <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 lg:p-12 border border-white/20 max-w-3xl mx-auto mb-12">
                <div className="text-gray-300 font-semibold mb-2 uppercase tracking-wider">Vous Vendez, Vous Gagnez</div>
                <div className="flex items-baseline justify-center gap-2 mb-4">
                  <span className="text-7xl lg:text-8xl font-black text-white">85%</span>
                  <span className="text-2xl text-gray-400">/ de marge</span>
                </div>
                <p className="text-lg text-gray-400">Nous ne prenons que 15% pour couvrir la fabrication, le packaging, la confirmation, et la livraison COD.</p>
              </div>

              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link to="/register" className="btn-primary btn-lg h-16 px-10 text-lg rounded-2xl shadow-xl shadow-primary-500/25 hover:scale-105 transition-transform">
                  Créer ma marque maintenant
                </Link>
                <a href="#how-it-works" className="btn-lg h-16 px-10 text-lg rounded-2xl bg-gray-800 text-white hover:bg-gray-700 transition-colors flex items-center justify-center border border-gray-700">
                  Calculer mes profils
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer (Simplified & Modernized) */}
      <footer className="bg-white border-t border-gray-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">O</span>
            </div>
            <span className="font-bold text-gray-900 text-xl">SILACOD</span>
          </div>
          <div className="flex items-center gap-6 text-sm font-medium text-gray-500">
            <Link to="/register" className="hover:text-gray-900">Vendeurs</Link>
            <Link to="/influencer/register" className="hover:text-gray-900">Influenceurs</Link>
            <a href="#" className="hover:text-gray-900">Contact</a>
            <a href="#" className="hover:text-gray-900">Conditions</a>
          </div>
          <div className="text-sm text-gray-400">
            © 2026 SILACOD. Tous droits réservés.
          </div>
        </div>
      </footer>
      
    </div>
  );
}

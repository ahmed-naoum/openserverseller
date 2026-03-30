import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { publicApi } from '../lib/api';
import { 
  ShoppingBag, 
  Truck, 
  Palette,
  TrendingUp,
  Sparkles,
  ArrowRight,
  MonitorSmartphone,
  CheckCircle2,
  Megaphone,
  Camera,
  Package,
  Star,
  Users,
  Banknote,
  Crown
} from 'lucide-react';
import LiveTicker from '../components/home/LiveTicker';
import ProfitSimulator from '../components/home/ProfitSimulator';
import SuccessStories from '../components/home/SuccessStories';
import FAQ from '../components/home/FAQ';

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

  return (
    <div className="min-h-screen bg-white selection:bg-primary-100 font-inter overflow-x-hidden">
      
      {/* 3D Dynamic Navbar */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="fixed top-0 left-0 right-0 bg-white/70 backdrop-blur-xl border-b border-white/20 z-50 transition-all duration-300 shadow-sm"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          {/* Subtle top glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-primary-500/50 to-transparent"></div>
          
          <div className="flex items-center justify-between h-20">
            <Link to="/" className="flex items-center gap-3 group relative perspective-1000">
              <motion.img 
                whileHover={{ rotateY: 15, scale: 1.05 }}
                src="/logo-icon.svg" 
                alt="SILACOD" 
                className="w-10 h-10 origin-center filter drop-shadow-md" 
              />
              <img src="/logo-full.svg" alt="SILACOD" className="h-8 hidden sm:block" />
            </Link>
            
            <div className="hidden lg:flex items-center gap-8 font-medium text-gray-600">
              <a href="#concept" className="hover:text-primary-600 transition-colors">Le Concept</a>
              <Link to="/marketplace" className="hover:text-primary-600 transition-colors flex items-center gap-1 group">
                <ShoppingBag className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" /> Marketplace
              </Link>
              <a href="#influencers" className="hover:text-accent-500 transition-colors flex items-center gap-1 group">
                <Crown className="w-4 h-4 group-hover:rotate-12 transition-transform text-accent-500" /> Espace VIP
              </a>
            </div>

            <div className="flex items-center gap-4">
              <Link to="/login" className="font-semibold text-gray-700 hover:text-primary-600 transition-colors">
                Connexion
              </Link>
              <Link to="/register" className="relative group overflow-hidden rounded-xl">
                <div className="absolute inset-0 bg-gradient-to-r from-primary-600 to-accent-500 opacity-90 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative px-6 py-2.5 flex items-center gap-2 text-white font-semibold">
                  <span>Démarrer</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </div>
          </div>
        </div>
      </motion.nav>

      <LiveTicker />

      {/* Hero Section (3D & Glassmorphic) */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-4 sm:px-6 lg:px-8 overflow-hidden min-h-[90vh] flex items-center">
        {/* Animated 3D Background Orbs */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 100, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] right-[-5%] w-[800px] h-[800px] bg-primary-200/40 rounded-full blur-[120px] mix-blend-multiply pointer-events-none" 
        />
        <motion.div 
          animate={{ rotate: -360 }}
          transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-accent-200/40 rounded-full blur-[120px] mix-blend-multiply pointer-events-none" 
        />

        <div className="max-w-7xl mx-auto relative z-10 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            
            {/* Left Content */}
            <div className="text-left">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-md text-primary-700 font-bold text-sm mb-8 ring-1 ring-primary-500/20 shadow-xl shadow-primary-500/10"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-500"></span>
                </span>
                La Plateforme #1 au Maroc : Dropshipping & White-Label
              </motion.div>

              <motion.h1 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-gray-900 tracking-tight mb-6 leading-[1.1] perspective-1000"
              >
                Créez votre <br/>
                <span className="relative inline-block text-transparent bg-clip-text bg-gradient-to-r from-primary-600 via-primary-500 to-accent-500">
                  Marque E-commerce
                  <div className="absolute -bottom-2 left-0 w-full h-3 bg-accent-100 -z-10 transform -rotate-2"></div>
                </span> <br/>
                Sans aucun stock.
              </motion.h1>

              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-xl text-gray-600 mb-10 max-w-lg leading-relaxed"
              >
                Fournisseurs, Influenceurs et Affiliés : Le "Triangle d'Or" réuni sur une seule plateforme. Vous vendez, on fabrique, on confirme, et on livre en COD.
              </motion.p>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-col sm:flex-row items-center gap-4"
              >
                <Link to="/register" className="relative group w-full sm:w-auto overflow-hidden rounded-2xl">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-600 to-primary-700 transition-opacity"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-accent-500 to-primary-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative h-16 px-8 flex items-center justify-center gap-3 text-white font-bold text-lg shadow-2xl shadow-primary-500/30">
                    <RocketIcon /> Lancer ma Marque
                  </div>
                </Link>
                <Link to="/influencer/register" className="w-full sm:w-auto text-lg h-16 px-8 rounded-2xl font-bold border-2 border-gray-200 hover:border-accent-500 hover:text-accent-600 hover:bg-accent-50 transition-all flex items-center justify-center gap-2 group">
                  <Camera className="w-5 h-5 group-hover:scale-110 transition-transform" /> Je suis Influenceur
                </Link>
              </motion.div>
            </div>

            {/* Right Content - 3D Glass Mockup Composition */}
            <motion.div 
              initial={{ opacity: 0, x: 50, rotateY: -15 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ duration: 0.8, type: "spring" }}
              className="relative hidden lg:block perspective-1000"
            >
              {/* Floating Main Glass Card */}
              <motion.div 
                whileHover={{ rotateY: -5, rotateX: 5 }}
                className="relative z-20 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] p-8 shadow-2xl shadow-primary-500/20 transform preserve-3d"
              >
                <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-200/50">
                   <div className="flex items-center gap-4">
                     <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl shadow-inner flex items-center justify-center text-white">
                        <ShoppingBag className="w-7 h-7" />
                     </div>
                     <div>
                       <div className="text-sm font-bold text-gray-500 uppercase tracking-wide">Wallet Balance</div>
                       <div className="text-3xl font-black text-gray-900">45,290 <span className="text-lg text-primary-600">MAD</span></div>
                     </div>
                   </div>
                </div>
                
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white/60 rounded-2xl p-4 flex items-center justify-between border border-white/40 shadow-sm hover:scale-[1.02] transition-transform cursor-default">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-xs ring-4 ring-white">COD</div>
                        <div>
                          <div className="font-bold text-gray-900">Commande COD #{8430 + i}</div>
                          <div className="text-xs text-gray-500">Livrée à Casablanca</div>
                        </div>
                      </div>
                      <div className="font-extrabold text-green-600">+450 MAD</div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Floating 3D Orbs/Blobs */}
              <motion.div 
                animate={{ y: [0, -20, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-tr from-accent-400 to-accent-300 rounded-full blur-[2px] shadow-2xl shadow-accent-500/50 -z-10"
              />
              <motion.div 
                animate={{ y: [0, 20, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute -bottom-10 -left-10 w-40 h-40 bg-gradient-to-bl from-primary-600 to-primary-400 rounded-full blur-[2px] shadow-2xl shadow-primary-500/50 z-30 opacity-90 backdrop-blur-3xl flex items-center justify-center"
              >
                  <Sparkles className="w-16 h-16 text-white/50" />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* The Power Trio (Bento Grid) */}
      <section id="concept" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <span className="text-primary-600 font-bold tracking-wider uppercase text-sm mb-4 block">Un Écosystème Connecté</span>
            <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 mb-6">Le Triangle Parfait de l'E-commerce</h2>
            <p className="text-xl text-gray-600">Peu importe votre profil, notre infrastructure vous permet d'exploser vos résultats sans gérer la complexité opérationnelle.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[400px]">
            
            {/* Vendor Bento Card */}
            <motion.div 
              whileHover={{ y: -10 }}
              className="md:col-span-2 relative rounded-[2rem] bg-white border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary-50 to-white opacity-50"></div>
              <div className="relative p-10 h-full flex flex-col">
                <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-2xl flex items-center justify-center mb-6">
                  <Palette className="w-8 h-8" />
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-4">Créateurs & Vendeurs</h3>
                <p className="text-gray-600 text-lg mb-8 max-w-md">Récupérez nos produits cosmétiques vierges. Envoyez-nous votre Logo. Nous créons votre marque de A à Z. Focus sur les pubs, on gère le stock et le COD.</p>
                <div className="mt-auto flex gap-4">
                  <Link to="/register" className="font-bold text-primary-600 flex items-center gap-2 hover:gap-4 transition-all uppercase tracking-wide">
                    Lancer votre marque <ArrowRight className="w-5 h-5" />
                  </Link>
                </div>
              </div>
              <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-primary-500/5 rounded-full blur-3xl group-hover:bg-primary-500/20 transition-colors duration-700"></div>
            </motion.div>

            {/* Affiliate Bento Card */}
            <motion.div 
              whileHover={{ y: -10 }}
              className="md:col-span-1 relative rounded-[2rem] bg-gradient-to-b from-gray-900 to-gray-800 border border-gray-700 shadow-xl overflow-hidden group"
            >
              <div className="relative p-10 h-full flex flex-col text-white">
                <div className="w-16 h-16 bg-white/10 text-accent-400 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md">
                  <Banknote className="w-8 h-8" />
                </div>
                <h3 className="text-3xl font-bold mb-4">Affiliés</h3>
                <p className="text-gray-400 text-lg mb-8">Pas de capital ? Vendez nos produits catalogue génériques avec des liens d'affiliation uniques. Commissions hyper compétitives.</p>
                <div className="mt-auto">
                  <Link to="/register" className="font-bold text-accent-400 flex items-center gap-2 hover:gap-4 transition-all uppercase tracking-wide">
                    Générer des liens <ArrowRight className="w-5 h-5" />
                  </Link>
                </div>
              </div>
            </motion.div>

            {/* Reality Show Segment (Influencers) */}
            <motion.div 
              whileHover={{ y: -10 }}
              className="md:col-span-3 relative rounded-[2rem] bg-gradient-to-r from-accent-500 to-pink-500 overflow-hidden text-white shadow-2xl shadow-accent-500/20 group"
            >
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay"></div>
              
              <div className="relative p-10 md:p-12 h-full flex flex-col md:flex-row items-center justify-between gap-10">
                <div className="max-w-xl">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-md text-white font-bold text-sm mb-6 border border-white/30">
                    <Megaphone className="w-4 h-4" /> Le Challenge : Zéro à Brand
                  </div>
                  <h3 className="text-4xl lg:text-5xl font-black mb-6 leading-tight">
                    Influenceurs (+5k) :<br/> 
                    Filmez votre succès.
                  </h3>
                  <p className="text-xl text-white/90 mb-8 font-medium">
                    « Créer sa propre marque n'a jamais été aussi simple. » Participez à notre Reality Challenge, créez votre produit cosmétique White-label avec nous en live, et vendez-le à votre communauté avec SILACOD qui s'occupe de la livraison.
                  </p>
                  <Link to="/influencer/register" className="inline-flex items-center justify-center gap-2 bg-white text-accent-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-50 transition-colors">
                    Rejoindre le casting <Camera className="w-5 h-5" />
                  </Link>
                </div>

                <div className="relative w-full max-w-sm aspect-video bg-black/40 rounded-2xl border border-white/20 backdrop-blur-md flex items-center justify-center shadow-inner overflow-hidden group-hover:scale-[1.02] transition-transform duration-500">
                   <div className="absolute inset-0 flex items-center justify-center">
                     <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md border border-white/40 cursor-pointer hover:bg-white/30 transition-colors">
                        <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-white border-b-[12px] border-b-transparent ml-2"></div>
                     </div>
                   </div>
                   {/* Fake live chat UI overlay */}
                   <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-2 opacity-70">
                      <div className="bg-black/50 rounded-full px-3 py-1.5 text-xs text-white max-w-fit backdrop-blur-md">🚀 "Trop stylé le packaging !"</div>
                      <div className="bg-black/50 rounded-full px-3 py-1.5 text-xs text-white max-w-fit backdrop-blur-md">🔥 "Je l'achète direct quand il sort"</div>
                   </div>
                   <div className="absolute top-4 left-4 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md animate-pulse">LIVE</div>
                   <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md text-white text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1"><Users className="w-3 h-3"/> 24.5k</div>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* Workflow Steps / Timeline */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white overflow-hidden">
         <div className="max-w-7xl mx-auto">
           <div className="text-center mb-20 max-w-3xl mx-auto">
            <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 mb-6">Un Processus Automatisé</h2>
            <p className="text-xl text-gray-600">Le Dropshipping et le Private Label fusionnés dans une machine logistique parfaite.</p>
          </div>

          <div className="relative">
            {/* Connecting line */}
            <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-gray-100 via-primary-200 to-gray-100 -translate-y-1/2 z-0"></div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 relative z-10">
              {[
                { number: "01", title: "Choisissez", desc: "Parcourez notre catalogue vierge de centaines de produits testés et certifiés.", icon: <ShoppingBag/> },
                { number: "02", title: "Customisez", desc: "Envoyez-nous votre Logo via la plateforme. Nous créons votre identité visuelle.", icon: <Palette/> },
                { number: "03", title: "Vendez", desc: "Lancez vos campagnes Facebook/TikTok Ads vers vos pages de vente.", icon: <Megaphone/> },
                { number: "04", title: "Encaissez", desc: "On confirme au tel, on livre en COD, et votre Wallet est crédité !", icon: <Banknote/> }
              ].map((step, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.15 }}
                  className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/40 border border-gray-100 text-center relative group hover:-translate-y-2 transition-transform duration-300"
                >
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex flex-col items-center justify-center mx-auto mb-6 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors duration-300 text-gray-400">
                     {step.icon}
                  </div>
                  <div className="absolute -top-4 -left-4 w-12 h-12 bg-accent-500 text-white font-black text-xl flex items-center justify-center rounded-xl shadow-lg transform rotate-[-10deg] group-hover:rotate-0 transition-transform">
                    {step.number}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">{step.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
         </div>
      </section>

      <SuccessStories />
      <ProfitSimulator />

      {/* Pricing CTA */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-gray-900 to-primary-950 rounded-[3rem] p-12 lg:p-20 shadow-2xl relative overflow-hidden text-center"
          >
            {/* Glow effect */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent-500/20 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="relative z-10 text-white">
              <h2 className="text-5xl lg:text-6xl font-extrabold mb-6">Aucun Abonnement.</h2>
              <p className="text-xl lg:text-2xl text-gray-300 mb-12 max-w-2xl mx-auto">
                L'inscription est gratuite. Nous réussissons uniquement si vous générez des ventes.
              </p>
              
              <div className="flex flex-col sm:flex-row justify-center gap-6">
                <Link to="/register" className="relative group overflow-hidden rounded-2xl w-full sm:w-auto">
                  <div className="absolute inset-0 bg-white/10 group-hover:bg-white/20 transition-colors backdrop-blur-md"></div>
                  <div className="relative btn-lg h-16 px-10 text-lg flex items-center justify-center gap-2 font-bold text-white border border-white/30 shadow-2xl">
                    Créer mon compte Gratuit
                  </div>
                </Link>
                <Link to="/marketplace" className="btn-primary btn-lg h-16 px-10 text-lg rounded-2xl shadow-xl shadow-primary-500/25 transition-transform flex items-center justify-center w-full sm:w-auto">
                  Voir le Catalogue
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <FAQ />

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 pt-16 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12">
            <div className="flexitems-center gap-3">
              <img src="/logo-icon.svg" alt="SILACOD" className="w-10 h-10" />
              <img src="/logo-full.svg" alt="SILACOD" className="h-8 mt-4" />
              <p className="text-gray-500 mt-4 max-w-sm">La première plateforme de Dropshipping White-Label au Maroc orchestrant Vendeurs, Influenceurs et Affiliés en complète symbiose.</p>
            </div>
            <div className="flex flex-wrap items-center gap-8 font-semibold text-gray-600">
              <Link to="/register" className="hover:text-primary-600 transition-colors">Vendeurs</Link>
              <Link to="/influencer/register" className="hover:text-accent-500 transition-colors">Programme VIP</Link>
              <Link to="/marketplace" className="hover:text-primary-600 transition-colors">Marketplace</Link>
              <a href="#" className="hover:text-primary-600 transition-colors">Contact</a>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400 font-medium">
            <div>© 2026 SILACOD Platform. Tous droits réservés.</div>
            <div className="flex gap-4">
               <a href="#" className="hover:text-gray-600">Conditions</a>
               <a href="#" className="hover:text-gray-600">Confidentialité</a>
            </div>
          </div>
        </div>
      </footer>
      
    </div>
  );
}

// Helper icon component
function RocketIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>
  );
}

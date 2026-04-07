import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, Truck, Palette, TrendingUp, Sparkles, ArrowRight,
  CheckCircle2, Megaphone, Camera, Package, Star, Users, Banknote,
  Crown, Zap, Shield, Globe, ChevronDown, Play, Menu, X,
  Instagram, Youtube, BarChart3, Wallet, Gift, Award, Heart,
  MousePointerClick, Lock, Phone, Box
} from 'lucide-react';
import LiveTicker from '../components/home/LiveTicker';
import ProfitSimulator from '../components/home/ProfitSimulator';
import SuccessStories from '../components/home/SuccessStories';
import FAQ from '../components/home/FAQ';

/* ─── Animated Counter ─── */
function Counter({ to, suffix = '', duration = 2000 }: { to: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const steps = 60;
        const step = duration / steps;
        let i = 0;
        const timer = setInterval(() => {
          i++;
          setCount(Math.floor((to / steps) * i));
          if (i >= steps) { clearInterval(timer); setCount(to); }
        }, step);
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [to, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

/* ─── Rocket Icon ─── */
function RocketIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
    </svg>
  );
}

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const { scrollYProgress } = useScroll();
  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setActiveFeature(p => (p + 1) % 3), 4000);
    return () => clearInterval(timer);
  }, []);

  const features = [
    { icon: <Palette className="w-6 h-6" />, label: 'Branding Instantané', desc: 'Uploader votre logo, on produit votre marque de beauté.' },
    { icon: <Truck className="w-6 h-6" />, label: 'Livraison COD Nationale', desc: 'Notre flotte confirme et livre partout au Maroc.' },
    { icon: <Banknote className="w-6 h-6" />, label: 'Wallet Temps Réel', desc: 'Chaque livraison = crédit immédiat sur votre Dashboard.' },
  ];

  const trilogyCards = [
    {
      tag: 'Vendeurs & Marques',
      title: 'Votre label de beauté en 48h.',
      desc: 'Sélectionnez un produit vierge de notre catalogue exclusif. Envoyez-nous votre logo. Nous créons votre packaging, votre branding et nous livrons vos commandes. Vous, vous gérez les pubs et regardez votre Wallet gonfler.',
      cta: 'Lancer ma marque',
      href: '/register',
      accentClass: 'from-primary-500 to-primary-700',
      bgClass: 'bg-white',
      textClass: 'text-primary-600',
      highlight: ['Zéro stock', 'Zéro logistique', 'Full Brandé'],
      icon: <Palette className="w-8 h-8" />,
      dark: false,
    },
    {
      tag: 'Influenceurs VIP',
      title: 'Vous créez du contenu. On génère vos revenus.',
      desc: 'Plus de 5k abonnés ? Rejoignez notre programme élite. Générez des liens uniques pour vos produits, filmez-in your daily content, et gagnez une commission sur chaque vente — sans avoir à stocker quoi que ce soit.',
      cta: 'Rejoindre le programme',
      href: '/influencer/register',
      accentClass: 'from-accent-500 to-pink-600',
      bgClass: 'bg-gray-950',
      textClass: 'text-accent-400',
      highlight: ['+12% commission', 'Reality Challenge', 'KYC protégé'],
      icon: <Camera className="w-8 h-8" />,
      dark: true,
    },
    {
      tag: 'Affiliés',
      title: 'Zéro capital. Commissions infinies.',
      desc: 'Pas de budget marketing ? Pas de problème. Partagez nos liens de produits sur vos réseaux sociaux, groupes WhatsApp ou TikTok. Chaque vente confirmée vous rapporte une commission. Pas de risque, uniquement du gain.',
      cta: 'Gagner sans stock',
      href: '/register',
      accentClass: 'from-emerald-500 to-teal-600',
      bgClass: 'bg-white',
      textClass: 'text-emerald-600',
      highlight: ['Lien unique', 'Tracking live', 'Paiement rapide'],
      icon: <TrendingUp className="w-8 h-8" />,
      dark: false,
    },
  ];

  const steps = [
    { n: '01', icon: <ShoppingBag className="w-7 h-7" />, title: 'Choisissez', desc: 'Parcourez notre catalogue de produits et sélectionnez votre produit cosmétique vierge parmi des centaines de références testées.' },
    { n: '02', icon: <Palette className="w-7 h-7" />, title: 'Brandisez', desc: 'Uploadez votre logo depuis votre Dashboard. Notre équipe créative le produit en 48h avec packaging et étiquettes personnalisés.' },
    { n: '03', icon: <Megaphone className="w-7 h-7" />, title: 'Vendez', desc: 'Lancez vos campagnes Facebook, Instagram ou TikTok Ads vers votre page produit et regardez les commandes affluer.' },
    { n: '04', icon: <Phone className="w-7 h-7" />, title: 'On Confirme', desc: 'Notre call center contacte chaque client pour confirmer la commande — taux de confirmation parmi les meilleurs du marché.' },
    { n: '05', icon: <Truck className="w-7 h-7" />, title: 'On Livre', desc: 'Expédition COD partout au Maroc. Notre flotte logistique gère retours, refus, et relances. Vous ne sortez pas un dirham.' },
    { n: '06', icon: <Wallet className="w-7 h-7" />, title: 'Encaissez', desc: 'Chaque livraison atterrit dans votre Wallet en temps réel. Demandez un virement à tout moment. Simple, transparent, rapide.' },
  ];

  const platformStats = [
    { value: 843, suffix: '+', label: 'Marques Actives', icon: <Award className="w-5 h-5" /> },
    { value: 12450, suffix: '+', label: 'Commandes Livrées', icon: <Box className="w-5 h-5" /> },
    { value: 98, suffix: '%', label: 'Taux de Satisfaction', icon: <Heart className="w-5 h-5" /> },
    { value: 48, suffix: 'h', label: 'Délai de Branding', icon: <Zap className="w-5 h-5" /> },
  ];

  const socialProof = [
    { name: 'Salma B.', role: 'Vendeuse White-Label', location: 'Casablanca', avatar: 'SB', revenue: '24,500 MAD', text: '« En 3 semaines j\'avais déjà ma propre marque de sérum. SILACOD s\'est occupé de tout. Mes clientes ne savent même pas que c\'est du dropshipping ! »', rating: 5, color: 'bg-pink-100 text-pink-700' },
    { name: 'Khalid M.', role: 'Influenceur TikTok', location: 'Marrakech', avatar: 'KM', revenue: '38,200 MAD', text: '« J\'ai rejoint le programme VIP avec 12k followers. En 1 mois j\'avais déjà gagné plus qu\'avec ma chaîne YouTube. La plateforme est incroyable. »', rating: 5, color: 'bg-violet-100 text-violet-700' },
    { name: 'Nadia R.', role: 'Affiliée Casual', location: 'Rabat', avatar: 'NR', revenue: '6,800 MAD', text: '« Je partage juste des liens dans des groupes WhatsApp. Zéro investissement, zéro prise de tête. Mon premier paiement est arrivé au bout de 5 jours. »', rating: 5, color: 'bg-emerald-100 text-emerald-700' },
    { name: 'Amine T.', role: 'Revendeur Multi-Marques', location: 'Fès', avatar: 'AT', revenue: '67,100 MAD', text: '« J\'ai lancé 3 marques différentes en parallèle depuis un seul Dashboard. Performance, logistique, paiement — tout est dans la même app. »', rating: 5, color: 'bg-orange-100 text-orange-700' },
  ];

  const platformFeatures = [
    { icon: <BarChart3 className="w-6 h-6" />, title: 'Analytics en Temps Réel', desc: 'Suivez vos clics, conversions et chiffre d\'affaires à la seconde près.' },
    { icon: <Globe className="w-6 h-6" />, title: 'Marketplace Catalogue', desc: 'Centaines de produits beauté vierges prêts à être brandés.' },
    { icon: <Shield className="w-6 h-6" />, title: 'Paiements 100% Sécurisés', desc: 'Wallet crypté. Virements instantanés vers votre compte bancaire.' },
    { icon: <Gift className="w-6 h-6" />, title: 'Programme de Fidélité', desc: 'Grimpez de Tier Silver à Diamond et déverrouillez des commissions exclusives.' },
    { icon: <MousePointerClick className="w-6 h-6" />, title: 'Liens de Tracking Avancés', desc: 'Chaque lien tracke vos conversions, la source du trafic et le ROI.' },
    { icon: <Lock className="w-6 h-6" />, title: 'KYC & Conformité', desc: 'Vérification identitaire sécurisée pour protéger tous les partenaires.' },
  ];

  return (
    <div className="min-h-screen bg-white selection:bg-primary-100 font-['Inter'] overflow-x-hidden">

      {/* ── Progress Bar ── */}
      <motion.div className="fixed top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary-500 to-accent-500 z-[100] origin-left" style={{ scaleX: scrollYProgress }} />

      {/* ── Navbar ── */}
      <motion.nav
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-xl shadow-lg shadow-gray-100/50 border-b border-gray-100' : 'bg-transparent'}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <Link to="/" className="flex items-center gap-3 group">
              <motion.img whileHover={{ rotateY: 15, scale: 1.05 }} src="/logo-icon.svg" alt="SILACOD" className="w-11 h-11 origin-center" />
              <img src="/logo-full.svg" alt="SILACOD" className="h-5 hidden sm:block" />
            </Link>

            <div className="hidden lg:flex items-center gap-8 text-sm font-semibold text-gray-600">
              <a href="#concept" className="hover:text-primary-600 transition-colors">Le Concept</a>
              <a href="#how-it-works" className="hover:text-primary-600 transition-colors">Comment ça marche</a>
              <Link to="/marketplace" className="hover:text-primary-600 transition-colors flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4" /> Marketplace
              </Link>
              <a href="#influencers" className="hover:text-accent-500 transition-colors flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-accent-500" /> Programme VIP
              </a>
            </div>

            <div className="hidden lg:flex items-center gap-3">
              <Link to="/login" className="text-sm font-semibold text-gray-700 hover:text-primary-600 transition-colors px-4 py-2">
                Connexion
              </Link>
              <Link to="/register" className="group relative overflow-hidden rounded-xl bg-primary-600 hover:bg-primary-700 transition-colors px-6 py-2.5 flex items-center gap-2 text-sm font-bold text-white shadow-lg shadow-primary-600/25">
                <RocketIcon />
                <span>Démarrer gratuitement</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 rounded-xl text-gray-700 hover:bg-gray-100 transition-colors">
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden bg-white border-t border-gray-100 shadow-xl"
            >
              <div className="px-4 py-6 space-y-4">
                <a href="#concept" onClick={() => setMobileMenuOpen(false)} className="block font-semibold text-gray-700 py-2">Le Concept</a>
                <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block font-semibold text-gray-700 py-2">Comment ça marche</a>
                <Link to="/marketplace" onClick={() => setMobileMenuOpen(false)} className="block font-semibold text-gray-700 py-2">Marketplace</Link>
                <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block font-semibold text-gray-700 py-2">Connexion</Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="block w-full text-center bg-primary-600 text-white font-bold py-3 rounded-xl">
                  Démarrer gratuitement
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      <LiveTicker />

      {/* ══════════════════════════════════════════
          SECTION 1 — HERO
      ══════════════════════════════════════════ */}
      <section className="relative pt-28 pb-20 lg:pt-44 lg:pb-32 px-4 sm:px-6 lg:px-8 overflow-hidden min-h-screen flex items-center">
        {/* Background elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-primary-50/30 pointer-events-none" />
        <motion.div animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 8, repeat: Infinity }} className="absolute top-[-15%] right-[-5%] w-[700px] h-[700px] bg-primary-300/20 rounded-full blur-[100px] pointer-events-none" />
        <motion.div animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.4, 0.2] }} transition={{ duration: 10, repeat: Infinity, delay: 2 }} className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-accent-300/20 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10 w-full">
          <div className="text-center max-w-5xl mx-auto">

            {/* Badge */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-primary-100 shadow-lg shadow-primary-100/50 text-primary-700 font-bold text-sm mb-10"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-500" />
              </span>
              🇲🇦 La Plateforme #1 du Dropshipping White-Label au Maroc
            </motion.div>

            {/* Headline */}
            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl sm:text-6xl lg:text-8xl font-extrabold text-gray-900 tracking-tight mb-8 leading-[1.05]"
            >
              Votre Marque.<br/>
              <span className="relative inline-block">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 via-primary-500 to-accent-500">
                  Votre Empire.
                </span>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.8, delay: 0.8 }}
                  className="absolute -bottom-2 left-0 h-2 bg-accent-200/60 rounded-full -z-10"
                />
              </span><br/>
              Zéro Stock.
            </motion.h1>

            {/* Subtitle */}
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
              className="text-xl text-gray-500 mb-14 max-w-2xl mx-auto leading-relaxed"
            >
              Vendeurs, Influenceurs, Affiliés — SILACOD connecte les trois mondes du e-commerce marocain en une seule infrastructure ultra-puissante. Vous vendez, nous fabriquons, nous livrons.
            </motion.p>

            {/* CTAs */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            >
              <Link to="/register"
                className="group relative w-full sm:w-auto overflow-hidden rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 transition-all shadow-2xl shadow-primary-500/30 hover:shadow-primary-500/50 hover:-translate-y-1"
              >
                <div className="h-16 px-10 flex items-center justify-center gap-3 text-white font-bold text-lg">
                  <RocketIcon /> Lancer ma Marque — Gratuitement
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
              <Link to="/influencer/register"
                className="group w-full sm:w-auto h-16 px-8 rounded-2xl border-2 border-gray-200 hover:border-accent-400 hover:bg-accent-50/50 hover:text-accent-600 transition-all font-bold text-gray-700 flex items-center justify-center gap-2"
              >
                <Camera className="w-5 h-5" /> Je suis Influenceur VIP
              </Link>
            </motion.div>

            {/* Mini trust badges */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
              className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500 font-medium"
            >
              {['✅ Inscription 100% gratuite', '✅ Aucun stock requis', '✅ Paiements garantis', '✅ Support 7j/7'].map((t, i) => (
                <span key={i}>{t}</span>
              ))}
            </motion.div>
          </div>

          {/* Hero Visual — Dashboard mock */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, type: 'spring' }}
            className="mt-20 relative"
          >
            {/* Glow */}
            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10 pointer-events-none h-full rounded-3xl" />
            <div className="relative mx-auto max-w-4xl bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-gray-300/40 border border-gray-100 p-6 overflow-hidden">
              {/* Fake Browser Bar */}
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-100">
                <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-400" /><div className="w-3 h-3 rounded-full bg-yellow-400" /><div className="w-3 h-3 rounded-full bg-green-400" /></div>
                <div className="flex-1 bg-gray-50 rounded-lg px-4 py-1.5 text-xs text-gray-400 font-mono">app.silacod.com/dashboard</div>
              </div>
              {/* Fake Dashboard Content */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: 'Wallet', value: '45,290 MAD', up: '+8.2%', color: 'text-primary-600', bg: 'bg-primary-50' },
                  { label: 'Commandes Aujourd\'hui', value: '27', up: '+3 ce matin', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Commission VIP', value: '3,840 MAD', up: '+12%', color: 'text-accent-600', bg: 'bg-accent-50' },
                ].map((card, i) => (
                  <div key={i} className={`${card.bg} rounded-2xl p-4 border border-white`}>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{card.label}</p>
                    <p className={`text-2xl font-black ${card.color}`}>{card.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{card.up}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {['Sérum Glow — Commande #8942 livré à Tanger', 'Crème Argan Brand — Commande #8941 livré à Casablanca', 'Eye Lift Pro — Commande #8940 livré à Rabat'].map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-black">COD</div>
                      <span className="text-sm font-medium text-gray-700">{item}</span>
                    </div>
                    <span className="text-sm font-black text-green-600">+{(i + 3) * 150} MAD</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 2 — STATS TRUST BAR
      ══════════════════════════════════════════ */}
      <section className="py-16 bg-gray-950 border-y border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {platformStats.map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary-500/10 text-primary-400 mb-4 mx-auto">
                  {stat.icon}
                </div>
                <div className="text-4xl font-black text-white mb-1">
                  <Counter to={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-sm font-medium text-gray-400">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 3 — THE TRILOGY (Concept Cards)
      ══════════════════════════════════════════ */}
      <section id="concept" className="py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <motion.span initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="inline-block text-primary-600 font-bold tracking-widest uppercase text-xs mb-4 bg-primary-50 px-4 py-2 rounded-full border border-primary-100">
              Un Écosystème Complet
            </motion.span>
            <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-4xl lg:text-6xl font-extrabold text-gray-900 mt-4 mb-6">
              Qui êtes-vous <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-accent-500">sur SILACOD ?</span>
            </motion.h2>
            <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-xl text-gray-500 max-w-2xl mx-auto">
              Peu importe votre point de départ — vendeur, créateur ou simple partageur — SILACOD a une place de choix pour vous.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {trilogyCards.map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                whileHover={{ y: -8 }}
                className={`relative rounded-[2rem] p-8 border flex flex-col overflow-hidden group ${card.dark ? 'bg-gray-950 border-gray-800 text-white' : 'bg-white border-gray-100 shadow-xl shadow-gray-100/80'}`}
              >
                {/* Top gradient line */}
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${card.accentClass}`} />

                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-gradient-to-br ${card.accentClass} text-white shadow-lg`}>
                  {card.icon}
                </div>

                <div className={`inline-block text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full mb-4 ${card.dark ? 'bg-white/10 text-gray-300' : 'bg-gray-100 text-gray-500'}`}>
                  {card.tag}
                </div>

                <h3 className={`text-2xl font-extrabold mb-4 leading-tight ${card.dark ? 'text-white' : 'text-gray-900'}`}>{card.title}</h3>
                <p className={`text-sm leading-relaxed mb-8 flex-1 ${card.dark ? 'text-gray-400' : 'text-gray-500'}`}>{card.desc}</p>

                <div className="flex flex-wrap gap-2 mb-8">
                  {card.highlight.map((h, j) => (
                    <span key={j} className={`text-xs font-bold px-3 py-1.5 rounded-full ${card.dark ? 'bg-white/10 text-gray-200' : 'bg-gray-50 text-gray-600 border border-gray-200'}`}>
                      ✓ {h}
                    </span>
                  ))}
                </div>

                <Link to={card.href}
                  className={`group/btn flex items-center gap-2 font-bold text-sm uppercase tracking-wide transition-all ${card.textClass} hover:gap-4`}
                >
                  {card.cta} <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 4 — HOW IT WORKS (6 Steps)
      ══════════════════════════════════════════ */}
      <section id="how-it-works" className="py-28 px-4 sm:px-6 lg:px-8 bg-gray-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary-900/30 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <motion.span initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="inline-block text-primary-400 font-bold tracking-widest uppercase text-xs mb-4 bg-primary-500/10 px-4 py-2 rounded-full border border-primary-500/20">
              La Machine est Simple
            </motion.span>
            <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-4xl lg:text-6xl font-extrabold text-white mt-4 mb-6">
              6 étapes. De zéro <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-400">à l'empire.</span>
            </motion.h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary-500/40 rounded-2xl p-7 transition-all group"
              >
                <div className="flex items-start gap-5">
                  <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white shadow-lg shadow-primary-500/20 group-hover:scale-110 transition-transform">
                    {step.icon}
                  </div>
                  <div>
                    <div className="text-xs font-black text-primary-400 uppercase tracking-widest mb-1">{`Étape ${step.n}`}</div>
                    <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 text-primary-500/40 z-10">→</div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 5 — PLATFORM FEATURES
      ══════════════════════════════════════════ */}
      <section className="py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <span className="inline-block text-primary-600 font-bold tracking-widest uppercase text-xs mb-4 bg-primary-50 px-4 py-2 rounded-full border border-primary-100">
                La Plateforme
              </span>
              <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 mt-4 mb-6 leading-tight">
                Un Dashboard qui <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-accent-500">travaille pour vous</span> — même pendant votre sommeil.
              </h2>
              <p className="text-lg text-gray-500 mb-10">
                Toute votre opération e-commerce centralisée en un seul endroit. Commandes, stock, finances, analytics, liens — une vue à 360°.
              </p>
              <Link to="/register" className="inline-flex items-center gap-2 bg-primary-600 text-white font-bold px-8 py-4 rounded-2xl hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/25 group">
                Voir le Dashboard <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>

            <div className="grid grid-cols-2 gap-4">
              {platformFeatures.map((feat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="group bg-gray-50 hover:bg-white hover:shadow-xl hover:shadow-gray-100 border border-gray-100 hover:border-primary-100 rounded-2xl p-6 transition-all cursor-default"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center mb-4 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                    {feat.icon}
                  </div>
                  <h4 className="font-bold text-gray-900 mb-1 text-sm">{feat.title}</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">{feat.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 6 — INFLUENCER / REALITY SHOW
      ══════════════════════════════════════════ */}
      <section id="influencers" className="py-28 px-4 sm:px-6 lg:px-8 bg-gray-950 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-accent-500/5 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Content */}
            <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-accent-500/10 border border-accent-500/20 text-accent-400 font-bold text-sm mb-8">
                <Megaphone className="w-4 h-4" /> Réservé aux Créateurs avec +5k Followers
              </div>
              <h2 className="text-4xl lg:text-5xl font-extrabold text-white mb-6 leading-tight">
                Le "Reality Challenge" :<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-400 to-pink-400">Filmez votre ascension.</span>
              </h2>
              <p className="text-lg text-gray-400 mb-10 leading-relaxed">
                Rejoignez notre programme privé. Sélectionnez un produit cosmétique, lancez votre propre marque en live devant votre audience, et vendez-le immédiatement avec notre infrastructure. Votre communauté assiste à la naissance de votre empire.
              </p>
              <div className="space-y-3 mb-10">
                {[
                  { icon: <Star className="w-4 h-4 text-yellow-400" />, text: 'Commissions jusqu\'à 18% — parmi les plus élevées du marché marocain' },
                  { icon: <Shield className="w-4 h-4 text-green-400" />, text: 'Vérification KYC protégée — votre identité et vos gains sont sécurisés' },
                  { icon: <Zap className="w-4 h-4 text-accent-400" />, text: 'Dashboard influenceur dédié avec analytics de liens en temps réel' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-gray-300 text-sm">
                    <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">{item.icon}</div>
                    {item.text}
                  </div>
                ))}
              </div>
              <Link to="/influencer/register"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-accent-500 to-pink-500 hover:from-accent-600 hover:to-pink-600 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-2xl shadow-accent-500/25 hover:-translate-y-1 group"
              >
                <Camera className="w-5 h-5" /> Rejoindre le Casting VIP
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>

            {/* Fake Live Video */}
            <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div className="relative rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl shadow-accent-500/10 bg-gray-900 aspect-[4/3]">
                {/* Blurred gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-pink-900/50 via-gray-900 to-violet-900/50" />
                {/* Center content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
                  <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}
                    className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md border border-white/30 cursor-pointer hover:bg-white/30 transition-colors"
                  >
                    <Play className="w-8 h-8 text-white ml-1" fill="white" />
                  </motion.div>
                  <p className="text-white/60 text-sm font-medium">Aperçu du Reality Challenge</p>
                </div>
                {/* LIVE badge */}
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500 text-white text-xs font-black px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" /> LIVE
                </div>
                {/* Viewers */}
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> 24.5k spectateurs
                </div>
                {/* Comments */}
                <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-2">
                  {['🔥 "La crème est trop bien !"', '🚀 "Je commande direct !"', '💜 "La livraison est rapide ?"'].map((c, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: 4, repeat: Infinity, delay: i * 1.5 }}
                      className="bg-black/60 backdrop-blur-md rounded-full px-3 py-1.5 text-xs text-white w-fit max-w-[80%]"
                    >{c}</motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 7 — SOCIAL PROOF / TESTIMONIALS
      ══════════════════════════════════════════ */}
      <section className="py-28 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <motion.span initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="inline-block text-primary-600 font-bold tracking-widest uppercase text-xs mb-4 bg-primary-50 px-4 py-2 rounded-full border border-primary-100">
              Ils ont osé. Ils ont gagné.
            </motion.span>
            <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-4xl lg:text-5xl font-extrabold text-gray-900 mt-4 mb-4">
              Des résultats réels.<br />Des vraies personnes.
            </motion.h2>
            <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-xl text-gray-500">
              Des centaines de Marocains génèrent déjà des revenus sur SILACOD chaque mois.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {socialProof.map((review, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-[1.5rem] p-6 border border-gray-100 shadow-lg shadow-gray-100/50 hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col"
              >
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm ${review.color}`}>
                      {review.avatar}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{review.name}</div>
                      <div className="text-xs text-gray-400">{review.role} · {review.location}</div>
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    {Array.from({ length: review.rating }).map((_, j) => (
                      <Star key={j} className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed flex-1 mb-5">{review.text}</p>
                <div className="pt-4 border-t border-gray-50">
                  <div className="text-xs text-gray-400 mb-1">Revenus générés</div>
                  <div className="text-lg font-extrabold text-primary-600">{review.revenue}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <SuccessStories />
      <ProfitSimulator />

      {/* ══════════════════════════════════════════
          SECTION 8 — PRICING / ZERO ABONNEMENT
      ══════════════════════════════════════════ */}
      <section id="pricing" className="py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative bg-gradient-to-br from-gray-950 via-primary-950 to-gray-950 rounded-[3rem] p-12 lg:p-20 shadow-2xl overflow-hidden text-center"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-accent-500/10 rounded-full blur-[80px] pointer-events-none" />

            <div className="relative z-10">
              <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 4, repeat: Infinity }} className="inline-block text-5xl mb-6">🎁</motion.div>
              <h2 className="text-5xl lg:text-7xl font-extrabold text-white mb-6">
                Zéro Abonnement.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-400">Zéro Risque.</span>
              </h2>
              <p className="text-xl text-gray-300 mb-4 max-w-2xl mx-auto">
                L'inscription est <strong className="text-white">100% gratuite</strong>. On gagne uniquement quand vous vendez. Notre succès dépend de votre réussite.
              </p>
              <p className="text-base text-gray-400 mb-14 max-w-xl mx-auto">
                Pas de frais cachés. Pas de mensualités. Pas de surprise. Juste une commission transparente sur chaque vente confirmée.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link to="/register"
                  className="group relative overflow-hidden rounded-2xl w-full sm:w-auto bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 transition-all shadow-2xl shadow-primary-500/30 hover:-translate-y-1"
                >
                  <div className="h-16 px-10 flex items-center justify-center gap-2 text-white font-bold text-lg">
                    <RocketIcon /> Créer mon compte Gratuit
                  </div>
                </Link>
                <Link to="/marketplace"
                  className="w-full sm:w-auto h-16 px-10 rounded-2xl border-2 border-white/20 hover:border-white/40 hover:bg-white/5 transition-all font-bold text-white flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-5 h-5" /> Voir le Catalogue
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <FAQ />

      {/* ══════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════ */}
      <footer className="bg-gray-950 border-t border-gray-800 pt-20 pb-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-3 mb-6">
                <img src="/logo-icon.svg" alt="SILACOD" className="w-10 h-10" />
                <img src="/logo-full.svg" alt="SILACOD" className="h-5 brightness-200 " />
              </div>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                La première plateforme de Dropshipping White-Label au Maroc. Vendeurs, Influenceurs et Affiliés réunis en une seule infrastructure.
              </p>
              <div className="flex gap-3">
                {[
                  { icon: <Instagram className="w-4 h-4" />, label: 'Instagram' },
                  { icon: <Youtube className="w-4 h-4" />, label: 'YouTube' },
                ].map((s, i) => (
                  <a key={i} href="#" className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors" title={s.label}>
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-bold text-white mb-6 text-sm uppercase tracking-wider">Plateforme</h4>
              <div className="space-y-3">
                {[['Vendeurs White-Label', '/register'], ['Programme Influenceurs', '/influencer/register'], ['Marketplace Catalogue', '/marketplace'], ['Connexion', '/login']].map(([label, href], i) => (
                  <Link key={i} to={href} className="block text-sm text-gray-400 hover:text-white transition-colors">{label}</Link>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-bold text-white mb-6 text-sm uppercase tracking-wider">Ressources</h4>
              <div className="space-y-3">
                {[['Comment ça marche', '#how-it-works'], ['FAQ', '#faq'], ['Success Stories', '#stories'], ['Contact Support', '#']].map(([label, href], i) => (
                  <a key={i} href={href} className="block text-sm text-gray-400 hover:text-white transition-colors">{label}</a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-bold text-white mb-6 text-sm uppercase tracking-wider">Légal</h4>
              <div className="space-y-3">
                {[['Conditions Générales', '#'], ['Politique de Confidentialité', '#'], ['Mentions Légales', '#'], ['Cookies', '#']].map(([label, href], i) => (
                  <a key={i} href={href} className="block text-sm text-gray-400 hover:text-white transition-colors">{label}</a>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-8 border-t border-gray-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-500">© 2026 SILACOD Platform. Tous droits réservés. 🇲🇦 Fait avec ❤️ pour les entrepreneurs marocains.</div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Tous les systèmes opérationnels
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}

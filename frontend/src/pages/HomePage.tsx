import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { publicApi } from '../lib/api';

export default function HomePage() {
  const [stats, setStats] = useState({ vendors: 0, products: 0, orders: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    publicApi.stats().then((res) => {
      setStats(res.data.data.stats);
    }).catch(() => {});
  }, []);

  const features = [
    {
      icon: '🎨',
      title: 'Votre Marque',
      titleAr: 'علامتك التجارية',
      description: 'Créez votre marque avec votre logo, couleurs et packaging personnalisé',
    },
    {
      icon: '📦',
      title: '+200 Produits',
      titleAr: '+200 منتج',
      description: 'Catalogue de cosmétiques et compléments alimentaires prêts à vendre',
    },
    {
      icon: '🚚',
      title: 'Livraison COD',
      titleAr: 'الدفع عند الاستلام',
      description: 'Livraison partout au Maroc avec encaissement à la livraison',
    },
    {
      icon: '💰',
      title: 'Revenus Instantanés',
      titleAr: 'أرباح فورية',
      description: 'Gagnez jusqu\'à 85% de marge sur chaque vente',
    },
  ];

  const steps = [
    {
      number: '01',
      title: 'Créez votre marque',
      titleAr: 'أنشئ علامتك التجارية',
      description: 'Uploadez votre logo, choisissez vos couleurs et créez votre identité visuelle unique.',
    },
    {
      number: '02',
      title: 'Importez vos prospects',
      titleAr: 'استورد عملاءك المحتملين',
      description: 'Uploadez votre liste de contacts CSV ou connectez votre boutique en ligne.',
    },
    {
      number: '03',
      title: 'Générez des ventes',
      titleAr: 'حقق المبيعات',
      description: 'Nos agents call-center transforment vos prospects en commandes COD.',
    },
  ];

  const products = [
    { name: 'Crème Hydratante', nameAr: 'كريم ترطيب', price: '120 MAD', category: 'Soins Visage' },
    { name: 'Sérum Vitamine C', nameAr: 'سيروم فيتامين سي', price: '180 MAD', category: 'Anti-Âge' },
    { name: 'Huile d\'Argan Pure', nameAr: 'زيت الأركان الأصلي', price: '220 MAD', category: 'Huiles' },
    { name: 'Shampoing Argan', nameAr: 'شامبو الأركان', price: '110 MAD', category: 'Cheveux' },
    { name: 'Gélules Collagène', nameAr: 'كبسولات الكولاجين', price: '250 MAD', category: 'Compléments' },
    { name: 'Parfum Rose', nameAr: 'عطر الورد', price: '350 MAD', category: 'Parfums' },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">O</span>
              </div>
              <span className="font-bold text-xl text-gray-900">OpenSeller.ma</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900">Fonctionnalités</a>
              <a href="#how-it-works" className="text-gray-600 hover:text-gray-900">Comment ça marche</a>
              <a href="#products" className="text-gray-600 hover:text-gray-900">Produits</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900">Tarifs</a>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/login" className="btn-ghost">Connexion</Link>
              <Link to="/register" className="btn-primary">Commencer</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary-50 via-white to-emerald-50">
        <div className="max-w-7xl mx-auto">
          <div className={`text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <span className="inline-flex items-center px-4 py-1.5 bg-primary-100 text-primary-700 rounded-full text-sm font-medium mb-6">
              🚀 La première plateforme de dropshipping white-label au Maroc
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Lancez votre marque de<br />
              <span className="text-gradient">Cosmétiques & Compléments</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Créez votre propre marque, personnalisez plus de 200 produits, 
              et générez des revenus sans stock ni logistique.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/register" className="btn-primary btn-lg">
                Créer mon compte gratuit
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <a href="#how-it-works" className="btn-outline btn-lg">
                Comment ça marche ?
              </a>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 mt-16 max-w-3xl mx-auto">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-gray-900">{stats.vendors}+</div>
              <div className="text-gray-500 mt-1">Vendeurs actifs</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-gray-900">{stats.products}+</div>
              <div className="text-gray-500 mt-1">Produits</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-gray-900">{stats.orders}+</div>
              <div className="text-gray-500 mt-1">Commandes</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Tout ce dont vous avez besoin pour réussir
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Une plateforme complète pour lancer et développer votre business de dropshipping
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="card-hover p-6">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Comment ça marche ?
            </h2>
            <p className="text-lg text-gray-600">3 étapes simples pour démarrer</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className="text-8xl font-bold text-primary-100 absolute -top-4 left-0">{step.number}</div>
                <div className="relative z-10 pt-8">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{step.title}</h3>
                  <p className="text-gray-600">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section id="products" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Notre Catalogue Produits
            </h2>
            <p className="text-lg text-gray-600">Plus de 200 produits personnalisables</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {products.map((product, index) => (
              <div key={index} className="card-hover overflow-hidden group">
                <div className="aspect-square bg-gradient-to-br from-primary-100 to-emerald-100 flex items-center justify-center">
                  <span className="text-4xl group-hover:scale-110 transition-transform">✨</span>
                </div>
                <div className="p-3">
                  <div className="text-xs text-primary-600 font-medium">{product.category}</div>
                  <div className="font-medium text-gray-900 text-sm">{product.name}</div>
                  <div className="text-sm font-bold text-gray-900 mt-1">{product.price}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link to="/register" className="btn-primary">
              Voir tout le catalogue
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Tarification simple et transparente
            </h2>
            <p className="text-lg text-gray-600">Pas de frais cachés. Payez uniquement quand vous vendez.</p>
          </div>
          <div className="card p-8 text-center">
            <div className="text-6xl font-bold text-gray-900 mb-2">15%</div>
            <div className="text-gray-600 mb-8">Commission sur chaque vente (vous gardez 85%)</div>
            <div className="grid md:grid-cols-3 gap-6 text-left">
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="font-semibold text-green-700 mb-2">✓ Inclus</div>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Marque illimitée</li>
                  <li>• Catalogue complet</li>
                  <li>• Designer de packaging</li>
                </ul>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="font-semibold text-blue-700 mb-2">✓ Support</div>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Agents call-center</li>
                  <li>• Livraison COD</li>
                  <li>• Support WhatsApp</li>
                </ul>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="font-semibold text-purple-700 mb-2">✓ Paiements</div>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Wallet instantané</li>
                  <li>• Retraits RIB/ICE</li>
                  <li>• Rapports détaillés</li>
                </ul>
              </div>
            </div>
            <Link to="/register" className="btn-primary btn-lg mt-8">
              Commencer gratuitement
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary-500">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Prêt à lancer votre marque ?
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Rejoignez des centaines de vendeurs qui génèrent des revenus avec OpenSeller.ma
          </p>
          <Link to="/register" className="inline-flex items-center gap-2 bg-white text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors">
            Créer mon compte gratuit
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">O</span>
                </div>
                <span className="font-bold text-white">OpenSeller.ma</span>
              </div>
              <p className="text-sm">La plateforme de dropshipping white-label #1 au Maroc</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Produit</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Fonctionnalités</a></li>
                <li><a href="#" className="hover:text-white">Tarifs</a></li>
                <li><a href="#" className="hover:text-white">Catalogue</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Ressources</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Blog</a></li>
                <li><a href="#" className="hover:text-white">Formation</a></li>
                <li><a href="#" className="hover:text-white">Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Contact</h4>
              <ul className="space-y-2 text-sm">
                <li>contact@openseller.ma</li>
                <li>+212 5XX-XXXXXX</li>
                <li>Casablanca, Maroc</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-sm">
            © 2025 OpenSeller.ma. Tous droits réservés.
          </div>
        </div>
      </footer>

      {/* WhatsApp Float */}
      <a
        href="https://wa.me/212600000000"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 w-14 h-14 bg-green-500 rounded-full flex items-center justify-center shadow-lg hover:bg-green-600 transition-colors z-50"
      >
        <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>
    </div>
  );
}

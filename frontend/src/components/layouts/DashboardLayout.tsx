import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardApi } from '../../lib/api';
import toast from 'react-hot-toast';

const navigation = {
  vendor: [
    { name: 'Tableau de bord', href: '/dashboard', icon: 'home' },
    { name: 'Inventaire', href: '/dashboard/inventory', icon: 'package' },
    { name: 'Mes Marques', href: '/dashboard/brands', icon: 'tag' },
    { name: 'Prospects', href: '/dashboard/leads', icon: 'users' },
    { name: 'Commandes', href: '/dashboard/orders', icon: 'shopping-cart' },
    { name: 'Portefeuille', href: '/dashboard/wallet', icon: 'credit-card' },
    { name: 'Marché Public', href: '/dashboard/marketplace', icon: 'shopping-cart' },
    { name: 'Messages', href: '/dashboard/chat', icon: 'chat' },
  ],
  grosseller: [
    { name: 'Vue d\'ensemble', href: '/grosseller', icon: 'home' },
    { name: 'Mon Profil', href: '/grosseller/profile', icon: 'users' },
    { name: 'Inventaire Acheté', href: '/grosseller/inventory', icon: 'package' },
    { name: 'Ajouter un Produit', href: '/grosseller/add-product', icon: 'tag' },
    { name: 'En Vente', href: '/grosseller/selling', icon: 'shopping-cart' },
    { name: 'En Attente', href: '/grosseller/pending', icon: 'clock' },
    { name: 'Approuvés', href: '/grosseller/approved', icon: 'package' },
    { name: 'Paiements', href: '/grosseller/payouts', icon: 'dollar-sign' },
    { name: 'Commandes', href: '/grosseller/orders', icon: 'shopping-cart' },
    { name: 'Analytique', href: '/grosseller/analytics', icon: 'credit-card' },
    { name: 'Support', href: '/grosseller/support', icon: 'chat' },
    { name: 'Marché Public', href: '/grosseller/marketplace', icon: 'shopping-cart' },
    { name: 'Messages', href: '/grosseller/chat', icon: 'chat' },
  ],
  influencer: [
    { name: 'Accueil', href: '/influencer', icon: 'home' },
    { name: 'Mon Profil', href: '/influencer/profile', icon: 'users' },
    { name: 'Mon Inventaire', href: '/influencer/inventory', icon: 'package' },
    { name: 'Mes Liens', href: '/influencer/links', icon: 'tag' },

    { name: 'Portefeuille', href: '/influencer/wallet', icon: 'dollar-sign' },
    { name: 'Analytics', href: '/influencer/analytics', icon: 'credit-card' },
    { name: 'Leads', href: '/influencer/leads', icon: 'users' },
    { name: 'Notifications', href: '/influencer/notifications', icon: 'chat' },
    { name: 'Marché Public', href: '/influencer/marketplace', icon: 'shopping-cart' },
    { name: 'Messages', href: '/influencer/chat', icon: 'chat' },
  ],
  agent: [
    { name: 'Tableau de bord', href: '/agent', icon: 'home' },
    { name: '⚡ Réclamer des Leads', href: '/agent/leads', icon: 'users' },
    { name: '📋 Tous les Prospects', href: '/agent/my-leads', icon: 'users' },
    { name: 'Commandes', href: '/agent/orders', icon: 'shopping-cart' },
    { name: 'Marché Public', href: '/agent/marketplace', icon: 'shopping-cart' },
    { name: 'Messages', href: '/agent/chat', icon: 'chat' },
  ],
  admin: [
    { name: 'Tableau de bord', href: '/admin', icon: 'home' },
    { name: 'Utilisateurs', href: '/admin/users', icon: 'users' },
    { name: 'Clients', href: '/admin/customers', icon: 'users' },
    { name: 'Marques', href: '/admin/brands', icon: 'tag' },
    { name: 'Catégories', href: '/admin/categories', icon: 'tag' },
    { name: 'Produits', href: '/admin/products', icon: 'package' },
    { name: 'Demandes Affiliation', href: '/admin/affiliate-claims', icon: 'user-check' },
    { name: 'Gestion Campagnes', href: '/admin/campaigns', icon: 'zap' },
    { name: 'Commandes', href: '/admin/orders', icon: 'shopping-cart' },
    { name: 'Finance', href: '/admin/finance', icon: 'dollar-sign' },
    { name: 'Fulfillment', href: '/admin/fulfillment', icon: 'clock' },
    { name: 'Marché Public', href: '/admin/marketplace', icon: 'shopping-cart' },
    { name: 'Messages', href: '/admin/chat', icon: 'chat' },
  ],
};

const icons: Record<string, JSX.Element> = {
  home: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  tag: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  package: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  users: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  'shopping-cart': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  'credit-card': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  'dollar-sign': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  chat: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
    </svg>
  ),
  zap: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  'user-check': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export default function DashboardLayout() {
  const { user, logout, refreshUser } = useAuth();
  const location = useLocation();

  const getNavItems = () => {
    if (location.pathname.startsWith('/admin')) return navigation.admin;
    if (location.pathname.startsWith('/agent')) return navigation.agent;
    if (location.pathname.startsWith('/grosseller')) return navigation.grosseller;
    if (location.pathname.startsWith('/influencer')) return navigation.influencer;
    return navigation.vendor;
  };

  const navItems = getNavItems();
  const isVendorDashboard = !location.pathname.startsWith('/admin') && !location.pathname.startsWith('/agent') && !location.pathname.startsWith('/grosseller') && !location.pathname.startsWith('/influencer');
  const currentMode = user?.mode || 'SELLER';

  const handleSwitchMode = async () => {
    try {
      const newMode = currentMode === 'SELLER' ? 'AFFILIATE' : 'SELLER';
      await dashboardApi.switchMode(newMode);
      await refreshUser();
      toast.success(newMode === 'SELLER' ? 'Mode Vendeur activé' : 'Mode Affilié activé');
    } catch {
      toast.error('Erreur lors du changement de mode');
    }
  };

  const getRoleLabel = () => {
    if (isVendorDashboard) {
      return currentMode === 'AFFILIATE' ? 'Affilié' : 'VENDOR';
    }
    return user?.role || '';
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-30">
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <Link to="/" className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              location.pathname.startsWith('/grosseller') ? 'bg-grosseller-500' : location.pathname.startsWith('/influencer') ? 'bg-influencer-500' : 'bg-primary-500'
            }`}>
              <span className="text-white font-bold text-lg">O</span>
            </div>
            <span className="font-bold text-xl text-gray-900">SILACOD</span>
          </Link>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            const isGrosseller = location.pathname.startsWith('/grosseller');
            const isInfluencer = location.pathname.startsWith('/influencer');
            
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? (isGrosseller ? 'bg-grosseller-50 text-grosseller-700' : isInfluencer ? 'bg-influencer-50 text-influencer-700' : 'bg-primary-50 text-primary-700')
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {icons[item.icon]}
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Mode Switcher for Vendors */}
        {isVendorDashboard && (
          <div className="absolute bottom-4 left-4 right-4">
            <button
              onClick={handleSwitchMode}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-all group"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold transition-colors ${
                currentMode === 'AFFILIATE' ? 'bg-pink-500' : 'bg-primary-500'
              }`}>
                {currentMode === 'AFFILIATE' ? 'A' : 'V'}
              </div>
              <div className="text-left flex-1">
                <p className="text-xs font-bold text-gray-900">
                  {currentMode === 'AFFILIATE' ? 'Mode Affilié' : 'Mode Vendeur'}
                </p>
                <p className="text-[10px] text-gray-400">Cliquez pour basculer</p>
              </div>
              <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="pl-64">
        {/* Header */}
        <header className="sticky top-0 h-16 bg-white border-b border-gray-200 z-20">
          <div className="flex items-center justify-between h-full px-6">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold text-gray-900">
                {navItems.find((item) => item.href === location.pathname)?.name || 'Tableau de bord'}
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.fullName}</p>
                <p className={`text-xs font-semibold ${
                  isVendorDashboard && currentMode === 'AFFILIATE' ? 'text-pink-500' : 'text-gray-500'
                }`}>{getRoleLabel()}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6"><Outlet /></main>
      </div>
    </div>
  );
}

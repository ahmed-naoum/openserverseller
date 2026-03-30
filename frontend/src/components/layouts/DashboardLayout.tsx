import { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardApi } from '../../lib/api';
import toast from 'react-hot-toast';
import AnnouncementBanner from '../common/AnnouncementBanner';
import { 
  Home, 
  Package, 
  Tag, 
  Users, 
  ShoppingCart, 
  CreditCard, 
  DollarSign, 
  Clock, 
  MessageSquare, 
  Zap, 
  UserCheck, 
  Shield, 
  Settings, 
  Eye,
  LogOut,
  ChevronDown,
  User,
  ShieldAlert,
  Bell
} from 'lucide-react';

const navigation = {
  vendor: [
    { name: 'Tableau de bord', href: '/dashboard', icon: Home },
    { name: 'Inventaire', href: '/dashboard/inventory', icon: Package },
    { name: 'Mes Marques', href: '/dashboard/brands', icon: Tag },
    { name: 'Prospects', href: '/dashboard/leads', icon: Users },
    { name: 'Commandes', href: '/dashboard/orders', icon: ShoppingCart },
    { name: 'Portefeuille', href: '/dashboard/wallet', icon: CreditCard },
    { name: 'Marché Public', href: '/dashboard/marketplace', icon: ShoppingCart },
    { name: 'Messages', href: '/dashboard/chat', icon: MessageSquare },
    { name: 'Paramètres', href: '/dashboard/settings', icon: Settings },
  ],
  grosseller: [
    { name: 'Vue d\'ensemble', href: '/grosseller', icon: Home },
    { name: 'Mon Profil', href: '/grosseller/profile', icon: Users },
    { name: 'Inventaire Acheté', href: '/grosseller/inventory', icon: Package },
    { name: 'Ajouter un Produit', href: '/grosseller/add-product', icon: Tag },
    { name: 'En Vente', href: '/grosseller/selling', icon: ShoppingCart },
    { name: 'En Attente', href: '/grosseller/pending', icon: Clock },
    { name: 'Approuvés', href: '/grosseller/approved', icon: Package },
    { name: 'Paiements', href: '/grosseller/payouts', icon: DollarSign },
    { name: 'Commandes', href: '/grosseller/orders', icon: ShoppingCart },
    { name: 'Analytique', href: '/grosseller/analytics', icon: CreditCard },
    { name: 'Support', href: '/grosseller/support', icon: MessageSquare },
    { name: 'Marché Public', href: '/grosseller/marketplace', icon: ShoppingCart },
    { name: 'Messages', href: '/grosseller/chat', icon: MessageSquare },
    { name: 'Paramètres', href: '/grosseller/settings', icon: Settings },
  ],
  influencer: [
    { name: 'Accueil', href: '/influencer', icon: Home },
    { name: 'Mon Profil', href: '/influencer/profile', icon: Users },
    { name: 'Mon Inventaire', href: '/influencer/inventory', icon: Package },
    { name: 'Mes Liens', href: '/influencer/links', icon: Tag },
    { name: 'Portefeuille', href: '/influencer/wallet', icon: DollarSign },
    { name: 'Analytics', href: '/influencer/analytics', icon: CreditCard },
    { name: 'Leads', href: '/influencer/leads', icon: Users },
    { name: 'Notifications', href: '/influencer/notifications', icon: Bell },
    { name: 'Marché Public', href: '/influencer/marketplace', icon: ShoppingCart },
    { name: 'Messages', href: '/influencer/chat', icon: MessageSquare },
    { name: 'Paramètres', href: '/influencer/settings', icon: Settings },
  ],
  agent: [
    { name: 'Tableau de bord', href: '/agent', icon: Home },
    { name: 'Réclamer Leads', href: '/agent/leads', icon: Zap },
    { name: 'Mes Prospects', href: '/agent/my-leads', icon: Users },
    { name: 'Commandes', href: '/agent/orders', icon: ShoppingCart },
    { name: 'Marché Public', href: '/agent/marketplace', icon: ShoppingCart },
    { name: 'Messages', href: '/agent/chat', icon: MessageSquare },
    { name: 'Paramètres', href: '/agent/settings', icon: Settings },
  ],
  admin: [
    { name: 'Tableau de bord', href: '/admin', icon: Home },
    { name: 'Utilisateurs', href: '/admin/users', icon: Users },
    { name: 'Clients', href: '/admin/customers', icon: Users },
    { name: 'Marques', href: '/admin/brands', icon: Tag },
    { name: 'Catégories', href: '/admin/categories', icon: Tag },
    { name: 'Produits', href: '/admin/products', icon: Package },
    { name: 'Demandes Affiliation', href: '/admin/affiliate-claims', icon: UserCheck },
    { name: 'Annonces', href: '/admin/announcements', icon: Bell },
    { name: 'Gestion Campagnes', href: '/admin/campaigns', icon: Zap },
    { name: 'Commandes', href: '/admin/orders', icon: ShoppingCart },
    { name: 'Finance', href: '/admin/finance', icon: DollarSign },
    { name: 'Fulfillment', href: '/admin/fulfillment', icon: Clock },
    { name: 'Historique Leads', href: '/admin/lead-history', icon: Eye },
    { name: 'Marché Public', href: '/admin/marketplace', icon: ShoppingCart },
    { name: 'Messages', href: '/admin/chat', icon: MessageSquare },
    { name: 'Paramètres', href: '/admin/settings', icon: Settings },
  ],
  confirmation: [
    { name: 'Vérification KYC', href: '/confirmation', icon: Shield },
    { name: 'Marché Public', href: '/confirmation/marketplace', icon: ShoppingCart },
    { name: 'Messages', href: '/confirmation/chat', icon: MessageSquare },
    { name: 'Paramètres', href: '/confirmation/settings', icon: Settings },
  ],
};

export default function DashboardLayout() {
  const { user, logout, refreshUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const getNavItems = () => {
    if (location.pathname.startsWith('/admin')) return navigation.admin;
    if (location.pathname.startsWith('/agent')) return navigation.agent;
    if (location.pathname.startsWith('/grosseller')) return navigation.grosseller;
    if (location.pathname.startsWith('/influencer')) return navigation.influencer;
    if (location.pathname.startsWith('/confirmation')) return navigation.confirmation;
    return navigation.vendor;
  };

  const navItems = getNavItems();
  const isVendorDashboard = !location.pathname.startsWith('/admin') && !location.pathname.startsWith('/agent') && !location.pathname.startsWith('/grosseller') && !location.pathname.startsWith('/influencer') && !location.pathname.startsWith('/confirmation');
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
    <div className="min-h-screen bg-[#F8FAFC] font-['Inter']">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 glass-sidebar z-30 transition-all duration-300">
        <div className="flex items-center gap-3 h-20 px-8 border-b border-slate-200/50">
          <div className="w-10 h-10 bg-white rounded-xl shadow-lg shadow-slate-200/50 flex items-center justify-center overflow-hidden">
             <img src="/logo-icon.svg" alt="SILACOD" className="w-6 h-6" />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-[#2c2f74]">SILACOD</span>
        </div>

        <nav className="p-6 space-y-1.5 overflow-y-auto max-h-[calc(100vh-160px)] scrollbar-hide">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            const isGrosseller = location.pathname.startsWith('/grosseller');
            const isInfluencer = location.pathname.startsWith('/influencer');
            const isConfirmation = location.pathname.startsWith('/confirmation');
            
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-[13px] font-black tracking-wide transition-all duration-300 group ${
                  isActive
                    ? (isGrosseller ? 'bg-grosseller-50 text-grosseller-700 shadow-sm' : isInfluencer ? 'bg-influencer-50 text-influencer-700 shadow-sm' : isConfirmation ? 'bg-teal-50 text-teal-700 shadow-sm' : 'bg-primary-50 text-primary-700 shadow-sm border border-primary-100/50')
                    : 'text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-xl hover:shadow-slate-200/50'
                }`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${isActive ? 'bg-white shadow-sm' : 'group-hover:bg-slate-50'}`}>
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Mode Switcher for Vendors */}
        {isVendorDashboard && (
          <div className="absolute bottom-6 left-6 right-6">
            <button
              onClick={handleSwitchMode}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-[1.5rem] bg-white border border-slate-100 shadow-xl shadow-slate-200/50 hover:bg-slate-50 transition-all group group/btn"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black transition-all group-hover/btn:scale-110 shadow-lg ${
                currentMode === 'AFFILIATE' ? 'bg-accent-500 shadow-accent-200' : 'bg-primary-500 shadow-primary-200'
              }`}>
                {currentMode === 'AFFILIATE' ? 'A' : 'V'}
              </div>
              <div className="text-left flex-1">
                <p className="text-[11px] font-black text-slate-900 uppercase tracking-tighter">
                  {currentMode === 'AFFILIATE' ? 'Mode Affilié' : 'Mode Vendeur'}
                </p>
                <p className="text-[9px] font-bold text-slate-400">Changer de mode</p>
              </div>
              <Zap size={14} className="text-slate-300 group-hover:text-primary-500 transition-colors" />
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="pl-64 min-h-screen">
        {/* Header */}
        <header className="sticky top-0 h-20 bg-[#F8FAFC]/80 backdrop-blur-xl border-b border-slate-200/50 z-20">
          <div className="flex items-center justify-between h-full px-8">
            <div className="flex items-center gap-4">
               {/* Search or Breadcrumbs can go here */}
               <div className="h-10 px-4 bg-white rounded-xl border border-slate-100 flex items-center gap-3 shadow-sm">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-xs font-black text-slate-600 uppercase tracking-widest leading-none pt-0.5">
                    {navItems.find((item) => item.href === location.pathname)?.name || 'Tableau de bord'}
                  </span>
               </div>
            </div>

            <div className="flex items-center gap-6">
              {/* Notifications */}
              <button className="relative p-2.5 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-primary-600 transition-all shadow-sm hover:shadow-md active:scale-95">
                <Bell size={20} />
                <span className="absolute top-2 right-2 w-2 h-2 bg-accent-500 border-2 border-white rounded-full" />
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-4 hover:bg-white border border-transparent hover:border-slate-100 rounded-2xl p-1.5 pr-4 transition-all duration-300 group"
                >
                  <div className="w-11 h-11 bg-gradient-to-tr from-primary-600 to-indigo-400 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-primary-200/50 group-hover:rotate-6 transition-transform">
                    {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-[13px] font-black text-slate-900 leading-tight tracking-tight">{user?.fullName}</p>
                    <p className={`text-[10px] font-black uppercase tracking-[0.1em] ${
                      isVendorDashboard && currentMode === 'AFFILIATE' ? 'text-accent-500' : 'text-primary-500'
                    }`}>{getRoleLabel()}</p>
                  </div>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform duration-500 ${showProfileMenu ? 'rotate-180' : ''}`} />
                </button>

                {showProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)}></div>
                    <div className="absolute right-0 mt-4 w-72 bg-white rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.12)] border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                      <div className="px-6 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-primary-600 font-black text-xl border border-slate-100">
                          {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900">{user?.fullName}</p>
                          <p className="text-xs font-bold text-slate-400">{user?.email}</p>
                        </div>
                      </div>
                      <div className="p-3">
                        {[
                          { name: 'Mon Profil', tab: '', icon: User },
                          { name: 'Sécurité & 2FA', tab: 'security', icon: Shield },
                          { name: 'Mot de passe', tab: 'password', icon: ShieldAlert },
                        ].map((item) => (
                          <button
                            key={item.name}
                            onClick={() => {
                              setShowProfileMenu(false);
                              const base = location.pathname.startsWith('/admin') ? '/admin'
                                : location.pathname.startsWith('/agent') ? '/agent'
                                : location.pathname.startsWith('/grosseller') ? '/grosseller'
                                : location.pathname.startsWith('/influencer') ? '/influencer'
                                : location.pathname.startsWith('/confirmation') ? '/confirmation'
                                : '/dashboard';
                              navigate(`${base}/settings${item.tab ? `?tab=${item.tab}` : ''}`);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-bold text-slate-600 hover:bg-slate-50 rounded-2xl transition-all group"
                          >
                            <item.icon size={18} className="text-slate-300 group-hover:text-primary-500 transition-colors" />
                            {item.name}
                          </button>
                        ))}
                      </div>
                      <div className="border-t border-slate-50 p-3 bg-slate-50/20">
                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            handleLogout();
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-black text-rose-500 hover:bg-rose-50 rounded-2xl transition-all group"
                        >
                          <LogOut size={18} className="group-hover:translate-x-1 transition-transform" />
                          Se déconnecter
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto relative px-8 py-10 min-h-[calc(100vh-80px)]">
          {/* Background Mesh for content area */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-400/5 rounded-full blur-[100px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-accent-400/5 rounded-full blur-[120px]" />
          </div>

          <div className="relative z-10 max-w-[1600px] mx-auto">
            <AnnouncementBanner position="TOP" />
            <Outlet />
            <AnnouncementBanner position="BOTTOM" />
          </div>
        </div>
      </div>
    </div>
  );
}

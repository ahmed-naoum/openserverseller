import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardApi } from '../../lib/api';
import toast from 'react-hot-toast';
import AnnouncementBanner from '../common/AnnouncementBanner';
import ProfileProgressBanner from '../common/ProfileProgressBanner';
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
  ShieldCheck,
  Settings, 
  Eye,
  LogOut,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  User,
  ShieldAlert,
  Bell,
  Search,
  Menu,
  X,
  Maximize,
  Minimize,
  Sun,
  Moon,
  HelpCircle,
  ExternalLink,
  Command,
  PanelLeftClose,
  PanelLeftOpen,
  Truck,
  Webhook,
  Globe,
  Plus
} from 'lucide-react';

const navigation = {
  vendor: [
    
    { name: 'Tableau de bord', href: '/dashboard', icon: Home },
    { name: 'Intégrations', href: '/dashboard/integrations', icon: Webhook },
    { name: 'Inventaire', href: '/dashboard/inventory', icon: Package },
    { 
      name: 'Gestion Vendeur', 
      icon: Users,
      children: [
        { name: 'Mes Commandes', href: '/dashboard/leads?mode=SELLER', icon: ShoppingCart },
        { name: 'Nouveau Leads', href: '/dashboard/orders?mode=SELLER', icon: Plus },
      ]
    },
    { 
      name: 'Gestion Affilié', 
      icon: Users,
      children: [
        { name: 'Mes Commandes', href: '/dashboard/leads?mode=AFFILIATE', icon: ShoppingCart },
        { name: 'Nouveau Leads', href: '/dashboard/orders?mode=AFFILIATE', icon: Plus },
      ]
    },
    { name: 'Leads YouCan', href: '/dashboard/youcan-leads', icon: Globe },
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
    { name: 'Support', href: '/influencer/support', icon: HelpCircle },
    { name: 'Paramètres', href: '/influencer/settings', icon: Settings },
  ],
  agent: [
    { name: 'Tableau de bord', href: '/agent', icon: Home },
    { name: 'Réclamer Leads', href: '/agent/leads', icon: Zap },
    { name: 'Mes Prospects', href: '/agent/my-leads', icon: Users },
    { name: 'Livraison', href: '/agent/livraison', icon: Truck },
    { name: 'Commandes', href: '/agent/orders', icon: ShoppingCart },
    { name: 'Marché Public', href: '/agent/marketplace', icon: ShoppingCart },
    { name: 'Messages', href: '/agent/chat', icon: MessageSquare },
    { name: 'Paramètres', href: '/agent/settings', icon: Settings },
  ],
  admin: [
    { name: 'Tableau de bord', href: '/admin', icon: Home },
    { name: 'Vérifications', href: '/admin/verifications', icon: ShieldCheck },
    { name: 'Utilisateurs', href: '/admin/users', icon: Users },
    { name: 'Clients', href: '/admin/customers', icon: Users },
    { name: 'Catégories', href: '/admin/categories', icon: Tag },
    { name: 'Produits', href: '/admin/products', icon: Package },
    { name: 'Demandes Affiliation', href: '/admin/affiliate-claims', icon: UserCheck },
    { name: 'Annonces', href: '/admin/announcements', icon: Bell },
    { name: 'Gestion Campagnes', href: '/admin/campaigns', icon: Zap },
    { name: 'Commandes', href: '/admin/orders', icon: ShoppingCart },
    { name: 'Finance', href: '/admin/finance', icon: DollarSign },
    { name: 'Support & Tickets', href: '/admin/support', icon: MessageSquare },
    { name: 'Historique Leads', href: '/admin/lead-history', icon: Eye },
    { name: 'Marché Public', href: '/admin/marketplace', icon: ShoppingCart },
    { name: 'Messages', href: '/admin/chat', icon: MessageSquare },
    { name: 'Paramètres Plateforme', href: '/admin/platform-settings', icon: Shield },
    { name: 'Sécurité & Firewall', href: '/admin/security', icon: ShieldAlert },
    { name: 'Webhooks Coliaty', href: '/admin/webhook-logs', icon: Webhook },
    { name: 'Paramètres', href: '/admin/settings', icon: Settings },
  ],
  system_support: [
    { name: 'Tableau de bord', href: '/admin', icon: Home },
    { name: 'Support & Tickets', href: '/admin/support', icon: MessageSquare },
    { name: 'Messages', href: '/admin/chat', icon: MessageSquare },
    { name: 'Paramètres', href: '/admin/settings', icon: Settings },
  ],
  confirmation: [
    { name: 'Centre de Vérification', href: '/confirmation', icon: Shield },
    { name: 'Marché Public', href: '/confirmation/marketplace', icon: ShoppingCart },
    { name: 'Messages', href: '/confirmation/chat', icon: MessageSquare },
    { name: 'Paramètres', href: '/confirmation/settings', icon: Settings },
  ],
  helper: [
    { name: 'Tableau de bord', href: '/helper', icon: Home },
    { name: 'Utilisateurs', href: '/helper/users', icon: Users },
    { name: 'Tous les Leads', href: '/helper/leads', icon: Users },
    { name: 'Colis', href: '/helper/colis', icon: Package },
    { name: 'Paramètres', href: '/helper/settings', icon: Settings },
  ],
};

export default function DashboardLayout() {
  const { user, logout, refreshUser, revertImpersonation } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true'; } catch { return false; }
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-expand if child is active
  useEffect(() => {
    const activeParent = navItems.find(item => 
      item.children?.some(child => location.pathname === child.href)
    );
    if (activeParent && !expandedGroups.includes(activeParent.name)) {
      setExpandedGroups(prev => [...prev, activeParent.name]);
    }
  }, [location.pathname]);

  const toggleGroup = (name: string) => {
    setExpandedGroups(prev => 
      prev.includes(name) ? prev.filter(g => g !== name) : [...prev, name]
    );
  };

  const getNavItems = () => {
    if (location.pathname.startsWith('/admin')) {
      if (user?.role === 'SYSTEM_SUPPORT') return navigation.system_support;
      return navigation.admin;
    }
    if (location.pathname.startsWith('/agent')) return navigation.agent;
    if (location.pathname.startsWith('/grosseller')) return navigation.grosseller;
    if (location.pathname.startsWith('/influencer')) return navigation.influencer;
    if (location.pathname.startsWith('/confirmation')) return navigation.confirmation;
    if (location.pathname.startsWith('/helper')) return navigation.helper;
    return navigation.vendor;
  };

  const isVendorDashboard = !location.pathname.startsWith('/admin') && !location.pathname.startsWith('/agent') && !location.pathname.startsWith('/grosseller') && !location.pathname.startsWith('/influencer') && !location.pathname.startsWith('/confirmation') && !location.pathname.startsWith('/helper');
  const currentMode = user?.mode || 'SELLER';

  const navItems = getNavItems().filter(item => {
    if (user?.role === 'HELPER' && item.href === '/helper/users') {
      return user?.canImpersonate;
    }
    // Filter by mode for vendor dashboard
    if (isVendorDashboard) {
      if (item.name === 'Gestion Vendeur') return currentMode === 'SELLER';
      if (item.name === 'Gestion Affilié') return currentMode === 'AFFILIATE';
    }
    return true;
  });

  // Get current page name for breadcrumb
  const currentPage = navItems.find((item) => item.href === location.pathname);
  const getCurrentSection = () => {
    if (location.pathname.startsWith('/admin')) return { label: 'Admin', color: 'text-rose-600 bg-rose-50' };
    if (location.pathname.startsWith('/agent')) return { label: 'Agent', color: 'text-blue-600 bg-blue-50' };
    if (location.pathname.startsWith('/grosseller')) return { label: 'Grossiste', color: 'text-emerald-600 bg-emerald-50' };
    if (location.pathname.startsWith('/influencer')) return { label: 'Influenceur', color: 'text-purple-600 bg-purple-50' };
    if (location.pathname.startsWith('/confirmation')) return { label: 'Confirmation', color: 'text-teal-600 bg-teal-50' };
    if (location.pathname.startsWith('/helper')) return { label: 'Helper', color: 'text-orange-600 bg-orange-50' };
    return { label: currentMode === 'AFFILIATE' ? 'Affilié' : 'Vendeur', color: 'text-primary-600 bg-primary-50' };
  };
  const section = getCurrentSection();

  // Search results
  const filteredNavItems = searchQuery
    ? navItems.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Persist sidebar collapsed state
  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('sidebar-collapsed', String(next)); } catch {}
      return next;
    });
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen change
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleSwitchMode = async () => {
    try {
      const newMode = currentMode === 'SELLER' ? 'AFFILIATE' : 'SELLER';
      await dashboardApi.switchMode(newMode);
      await refreshUser();
      
      // Update URL if it contains a mode parameter
      const params = new URLSearchParams(location.search);
      if (params.has('mode')) {
        params.set('mode', newMode);
        navigate(`${location.pathname}?${params.toString()}`);
      }
      
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

  const handleSearchNav = (href: string) => {
    navigate(href);
    setSearchOpen(false);
    setSearchQuery('');
  };

  const isImpersonating = !!localStorage.getItem('originalToken');

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-['Inter']">
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="bg-red-500 text-white text-center py-2 px-4 shadow-md sticky top-0 z-[100] flex items-center justify-center gap-4">
          <span className="font-bold text-sm">
            ⚠️ Mode Assistance: Vous êtes connecté en tant que {user?.fullName || user?.email || 'un utilisateur'}.
          </span>
          <button
            onClick={revertImpersonation}
            className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-md text-sm font-semibold transition-colors"
          >
            Retourner à mon compte Helper
          </button>
        </div>
      )}
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 glass-sidebar z-50 transition-all duration-300 ease-in-out
        ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'}
        w-64 lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Sidebar Header */}
        <div className={`flex items-center h-20 transition-all duration-300 relative z-20 ${
          sidebarCollapsed ? 'lg:justify-center lg:px-0 px-8 justify-between' : 'px-8 justify-between'
        }`}>
          <div className={`flex items-center gap-3 transition-all duration-300 ${
            sidebarCollapsed ? 'lg:gap-0' : ''
          }`}>
            <div className="w-10 h-10 bg-white rounded-2xl shadow-xl shadow-slate-200/50 flex items-center justify-center overflow-hidden flex-shrink-0 border border-slate-100">
               <img src="/logo-icon.svg" alt="SILACOD" className="w-6 h-6" />
            </div>
            <span className={`font-black text-xl tracking-tighter text-slate-900 transition-all duration-300 whitespace-nowrap ${
              sidebarCollapsed ? 'lg:hidden' : ''
            }`}>SILACOD</span>
          </div>
          {/* Mobile close button */}
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Separator with Gradient */}
        <div className="px-6 mb-4">
          <div className="h-px bg-gradient-to-r from-transparent via-slate-200/50 to-transparent" />
        </div>

        {/* Grain Overlay for Sidebar */}
        <div className="bg-noise absolute inset-0 mix-blend-overlay opacity-[0.15] pointer-events-none z-10" />

        {/* Nav Items */}
        <nav className={`space-y-1.5 overflow-y-auto max-h-[calc(100vh-160px)] scrollbar-hide transition-all duration-300 ${
          sidebarCollapsed ? 'lg:p-3 p-6' : 'p-6'
        }`}>
          {navItems.map((item) => {
            // Render either as a Link (if no children) or a Button (if it has children)
            const it = item as any;
            const hasChildren = it.children && it.children.length > 0;
            const isExpanded = expandedGroups.includes(it.name);
            const isActive = (it.href && location.pathname === it.href) || (it.children && it.children.some((c: any) => location.pathname === c.href));
            const Icon = it.icon;
            
            const isGrosseller = location.pathname.startsWith('/grosseller');
            const isInfluencer = location.pathname.startsWith('/influencer');

            const navClass = `w-full flex items-center gap-3 rounded-2xl text-[13px] font-black tracking-wide transition-all duration-500 group relative z-20 ${
              sidebarCollapsed ? 'lg:justify-center lg:px-0 lg:py-3 px-4 py-3' : 'px-4 py-3'
            } ${
              isActive
                ? (isGrosseller ? 'bg-grosseller-50 text-grosseller-700 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]' : isInfluencer ? 'bg-influencer-50 text-influencer-700 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]' : 'bg-primary-50 text-primary-900 border border-primary-100/50 shadow-[0_8px_20px_rgba(0,0,0,0.04)]')
                : 'text-slate-500 hover:bg-white/60 hover:text-slate-900 hover:shadow-xl hover:shadow-slate-200/40'
            }`;

            const commonContent = (
              <>
                <div className={`p-1.5 rounded-xl transition-all duration-500 flex-shrink-0 ${isActive ? 'bg-white shadow-sm scale-110' : 'group-hover:bg-white group-hover:scale-105 group-hover:shadow-md group-hover:shadow-slate-200/50'}`}>
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-inherit' : 'text-slate-400 group-hover:text-slate-900'} />
                </div>
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className={`transition-all duration-300 whitespace-nowrap overflow-hidden text-ellipsis ${
                    sidebarCollapsed ? 'lg:hidden' : ''
                  }`}>{item.name}</span>
                  
                  {hasChildren && !sidebarCollapsed && (
                    <ChevronDown size={14} className={`transition-transform duration-500 flex-shrink-0 ${isExpanded ? 'rotate-180 text-slate-900' : 'text-slate-400 group-hover:text-slate-900'}`} />
                  )}
                </div>
                
                {sidebarCollapsed && (
                  <span className="hidden lg:block absolute left-full ml-3 px-4 py-2 bg-slate-900 text-white text-[10px] uppercase font-black tracking-widest rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap z-[100] shadow-2xl">
                    {item.name}
                  </span>
                )}
              </>
            );

            return (
              <div key={item.name} className="space-y-1">
                {hasChildren ? (
                  <button
                    onClick={() => toggleGroup(item.name)}
                    type="button"
                    className={navClass}
                    title={sidebarCollapsed ? item.name : undefined}
                  >
                    {commonContent}
                  </button>
                ) : (
                  <Link
                    to={item.href || '#'}
                    className={navClass}
                    title={sidebarCollapsed ? item.name : undefined}
                  >
                    {commonContent}
                  </Link>
                )}

                {/* Professional Sub-navigation with Connection Line */}
                {hasChildren && isExpanded && !sidebarCollapsed && (
                  <div className="relative ml-6 pl-4 space-y-1 mt-1 animate-in slide-in-from-top-2 fade-in duration-300">
                    {/* Connection Line */}
                    <div className="absolute left-0 top-0 bottom-4 w-px bg-gradient-to-b from-primary-200 via-primary-100 to-transparent" />
                    
                    {it.children.map((child: any) => {
                      const isChildActive = location.pathname === child.href;
                      const ChildIcon = child.icon;
                      return (
                        <Link
                          key={child.name}
                          to={child.href}
                          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-[12px] font-bold transition-all relative group/item ${
                            isChildActive 
                              ? 'text-primary-600 bg-primary-50/30' 
                              : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50/50'
                          }`}
                        >
                          {/* Indicator dot */}
                          <div className={`absolute left-[-16.5px] w-1 h-1 rounded-full transition-all ${
                            isChildActive ? 'bg-primary-500 scale-125' : 'bg-slate-200 group-hover/item:bg-slate-400'
                          }`} />
                          
                          <div className={`p-1 rounded-lg transition-colors ${isChildActive ? 'bg-white shadow-sm' : 'group-hover:bg-white'}`}>
                            <ChildIcon size={13} className={isChildActive ? 'text-primary-600' : 'text-slate-400 group-hover/item:text-slate-600'} />
                          </div>
                          <span className="tracking-tight">{child.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Collapse toggle button (desktop only) */}
        <button
          onClick={toggleSidebarCollapsed}
          className={`hidden lg:flex absolute bottom-20 bg-white border border-slate-200 rounded-full p-1.5 shadow-lg hover:shadow-xl hover:bg-slate-50 text-slate-400 hover:text-primary-600 transition-all duration-300 z-[60] ${
            sidebarCollapsed ? 'right-[-14px]' : 'right-[-14px]'
          }`}
          title={sidebarCollapsed ? 'Développer le menu' : 'Réduire le menu'}
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {/* Mode Switcher for Vendors: Bento Element */}
        {isVendorDashboard && (
          <div className={`absolute bottom-6 transition-all duration-300 z-20 ${
            sidebarCollapsed ? 'lg:left-3 lg:right-3 left-6 right-6' : 'left-6 right-6'
          }`}>
            <button
              onClick={handleSwitchMode}
              title={sidebarCollapsed ? (currentMode === 'AFFILIATE' ? 'Mode Affilié' : 'Mode Vendeur') : undefined}
              className={`w-full flex items-center gap-3 rounded-[2rem] glass-panel border border-white/50 shadow-2xl shadow-slate-200/50 hover:bg-white hover:scale-[1.02] transition-all group group/btn p-3`}
            >
              <div className={`w-10 h-10 rounded-[1.25rem] flex items-center justify-center text-white text-sm font-black transition-all group-hover/btn:rotate-12 shadow-lg flex-shrink-0 ${
                currentMode === 'AFFILIATE' ? 'bg-gradient-to-tr from-accent-500 to-orange-400 shadow-accent-200' : 'bg-gradient-to-tr from-primary-600 to-influencer-500 shadow-primary-200'
              }`}>
                {currentMode === 'AFFILIATE' ? 'A' : 'V'}
              </div>
              <div className={`text-left flex-1 transition-all duration-300 ${
                sidebarCollapsed ? 'lg:hidden' : ''
              }`}>
                <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight leading-none">
                  {currentMode === 'AFFILIATE' ? 'Affilié' : 'Vendeur'}
                </p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1">PRO SWITCH</p>
              </div>
              <div className={`p-1.5 bg-slate-50 rounded-xl group-hover:bg-primary-50 transition-colors ${
                sidebarCollapsed ? 'lg:hidden' : ''
              }`}>
                <Zap size={12} className="text-slate-400 group-hover:text-primary-500 transition-colors" />
              </div>
            </button>
          </div>
        )}
      </aside>

      {/* Search Modal / Command Palette */}
      {searchOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]" onClick={() => { setSearchOpen(false); setSearchQuery(''); }} />
          <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg z-[70] px-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                <Search size={20} className="text-slate-400 flex-shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Rechercher une page..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm font-medium text-slate-800 placeholder-slate-400"
                  autoFocus
                />
                <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-bold text-slate-400 border border-slate-200">
                  ESC
                </kbd>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {searchQuery ? (
                  filteredNavItems.length > 0 ? (
                    filteredNavItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.href}
                          onClick={() => item.href && handleSearchNav(item.href)}
                          className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-slate-50 transition-colors group"
                        >
                          <div className="p-2 rounded-xl bg-slate-100 group-hover:bg-primary-50 group-hover:text-primary-600 text-slate-400 transition-colors">
                            <Icon size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-700">{item.name}</p>
                            <p className="text-[11px] text-slate-400">{item.href}</p>
                          </div>
                          <ChevronRight size={14} className="ml-auto text-slate-300" />
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-5 py-8 text-center">
                      <Search size={32} className="mx-auto text-slate-200 mb-3" />
                      <p className="text-sm text-slate-400 font-medium">Aucun résultat pour "{searchQuery}"</p>
                    </div>
                  )
                ) : (
                  <div className="px-5 py-6">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Navigation rapide</p>
                    {(() => {
                      switch (user?.role) {
                        case 'VENDOR':
                          return navigation.vendor;
                        case 'GROSSELLER':
                          return navigation.grosseller;
                        case 'SUPER_ADMIN':
                        case 'FINANCE_ADMIN':
                          return navigation.admin;
                        case 'SYSTEM_SUPPORT':
                          return navigation.system_support;
                        case 'CALL_CENTER_AGENT':
                          return navigation.agent;
                        default:
                          return navItems;
                      }
                    })().slice(0, 5).map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.href}
                          onClick={() => item.href && handleSearchNav(item.href)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 rounded-xl transition-colors group"
                        >
                          <Icon size={16} className="text-slate-400 group-hover:text-primary-500 transition-colors" />
                          <span className="text-sm font-medium text-slate-600">{item.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main content */}
      <div className={`min-h-screen transition-all duration-300 ease-in-out ${
        sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
      }`}>
        {/* Header */}
        <header className="sticky top-0 h-20 bg-[#F8FAFC]/80 backdrop-blur-xl border-b border-slate-200/50 z-20">
          <div className="flex items-center justify-between h-full px-4 sm:px-6 lg:px-8">
            {/* Left section */}
            <div className="flex items-center gap-3">
              {/* Hamburger: mobile = open drawer, desktop = collapse/expand */}
              <button
                onClick={() => {
                  // On mobile (<1024px) toggle the mobile drawer
                  if (window.innerWidth < 1024) {
                    setSidebarOpen(true);
                  } else {
                    // On desktop toggle collapse
                    toggleSidebarCollapsed();
                  }
                }}
                className="p-2.5 bg-white rounded-xl border border-slate-100 text-slate-500 hover:text-primary-600 hover:border-primary-200 transition-all shadow-sm active:scale-95"
                id="sidebar-toggle"
                title={sidebarCollapsed ? 'Développer le menu' : 'Réduire le menu'}
              >
                {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
              </button>

              {/* Breadcrumb navigation */}
              <div className="hidden sm:flex items-center gap-2">
                <div className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${section.color}`}>
                  {section.label}
                </div>
                {currentPage && (
                  <>
                    <ChevronRight size={14} className="text-slate-300" />
                    <div className="h-10 px-4 bg-white rounded-xl border border-slate-100 flex items-center gap-3 shadow-sm">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-xs font-black text-slate-600 uppercase tracking-widest leading-none pt-0.5">
                        {currentPage.name}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Mobile: page name only */}
              <div className="sm:hidden">
                <span className="text-sm font-bold text-slate-700">
                  {currentPage?.name || 'Tableau de bord'}
                </span>
              </div>
            </div>

            {/* Right section */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Search button */}
              <button
                onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 100); }}
                className="relative p-2.5 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-primary-600 hover:border-primary-200 transition-all shadow-sm hover:shadow-md active:scale-95 group"
                id="search-toggle"
              >
                <Search size={20} />
                <span className="hidden lg:inline-flex absolute -bottom-1 -right-1 items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-100 text-[9px] font-bold text-slate-400 border border-slate-200 group-hover:bg-primary-50 group-hover:text-primary-500 group-hover:border-primary-200 transition-colors">
                  <Command size={9} />K
                </span>
              </button>

              {/* Fullscreen toggle */}
              <button
                onClick={toggleFullscreen}
                className="hidden sm:flex relative p-2.5 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-primary-600 hover:border-primary-200 transition-all shadow-sm hover:shadow-md active:scale-95"
                title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
                id="fullscreen-toggle"
              >
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>

              {/* Help button */}
              <button
                onClick={() => window.open('https://silacod.com', '_blank')}
                className="hidden md:flex relative p-2.5 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-primary-600 hover:border-primary-200 transition-all shadow-sm hover:shadow-md active:scale-95"
                title="Centre d'aide"
                id="help-button"
              >
                <HelpCircle size={20} />
              </button>

              {/* Notifications */}
              <button 
                className="relative p-2.5 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-primary-600 hover:border-primary-200 transition-all shadow-sm hover:shadow-md active:scale-95"
                id="notifications-toggle"
              >
                <Bell size={20} />
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-gradient-to-r from-accent-500 to-rose-500 border-2 border-[#F8FAFC] rounded-full flex items-center justify-center">
                  <span className="text-[9px] font-black text-white leading-none">3</span>
                </span>
              </button>

              {/* Divider */}
              <div className="hidden sm:block w-px h-8 bg-slate-200/80 mx-1" />

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-3 hover:bg-white border border-transparent hover:border-slate-100 rounded-2xl p-1.5 pr-3 sm:pr-4 transition-all duration-300 group"
                  id="profile-menu-toggle"
                >
                  <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-tr from-primary-600 to-indigo-400 rounded-xl flex items-center justify-center text-white font-black text-base sm:text-lg shadow-lg shadow-primary-200/50 group-hover:rotate-6 transition-transform">
                    {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-[13px] font-black text-slate-900 leading-tight tracking-tight">{user?.fullName}</p>
                    <p className={`text-[10px] font-black uppercase tracking-[0.1em] ${
                      isVendorDashboard && currentMode === 'AFFILIATE' ? 'text-accent-500' : 'text-primary-500'
                    }`}>{getRoleLabel()}</p>
                  </div>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform duration-500 hidden sm:block ${showProfileMenu ? 'rotate-180' : ''}`} />
                </button>

                {showProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)}></div>
                    <div className="absolute right-0 mt-4 w-72 bg-white rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.12)] border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                      <div className="px-6 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-primary-600 font-black text-xl border border-slate-100">
                          {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-slate-900 truncate">{user?.fullName}</p>
                          <p className="text-xs font-bold text-slate-400 truncate">{user?.email}</p>
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
                                : location.pathname.startsWith('/helper') ? '/helper'
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
                      {/* Quick Links Section */}
                      <div className="border-t border-slate-50 p-3">
                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            window.open('/', '_blank');
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-bold text-slate-600 hover:bg-slate-50 rounded-2xl transition-all group"
                        >
                          <ExternalLink size={18} className="text-slate-300 group-hover:text-primary-500 transition-colors" />
                          Voir le site
                          <ExternalLink size={12} className="ml-auto text-slate-300" />
                        </button>
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
        <div className="flex-1 overflow-y-auto relative px-4 sm:px-6 lg:px-8 py-6 sm:py-10 min-h-[calc(100vh-80px)]">
          {/* Background Mesh for content area */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-400/5 rounded-full blur-[100px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-accent-400/5 rounded-full blur-[120px]" />
          </div>

          <div className="relative z-10 max-w-[1600px] mx-auto">
            <AnnouncementBanner position="TOP" />
            <ProfileProgressBanner />
            <Outlet />
            <AnnouncementBanner position="BOTTOM" />
          </div>
        </div>
      </div>
    </div>
  );
}

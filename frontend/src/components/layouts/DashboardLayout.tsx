import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { translateNotification } from '../../utils/notificationTranslator';
import { dashboardApi, chatApi, notificationsApi, adminApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { useSocket } from '../../contexts/SocketContext';
import AnnouncementBanner from '../common/AnnouncementBanner';
import ProfileProgressBanner from '../common/ProfileProgressBanner';
import LanguageSwitcherWidget from '../common/LanguageSwitcherWidget';
import ConfirmationModal from '../ui/ConfirmationModal';
import { 
  Home, 
  Package, 
  Tag, 
  Users, 
  ShoppingCart, 
  ShoppingBag,
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
  FileText,
  Webhook,
  Globe,
  Plus,
  Database,
  History,
  RotateCcw,
  ScanLine,
  Headphones,
  Trash,
  Check,
  Crown,
  Link2,
  Mail,
  Target,
  Music,
  Ghost
} from 'lucide-react';

const navigation = {
  vendor: [
    { name: 'nav_dashboard', href: '/dashboard', icon: Home },
    { 
      name: 'nav_youcan_integration', 
      icon: Webhook,
      children: [
        { name: 'nav_youcan_connect', href: '/dashboard/integrations', icon: Link2 },
        { name: 'nav_youcan_leads', href: '/dashboard/youcan-leads', icon: Globe },
        { name: 'nav_shopify_leads', href: '/dashboard/shopify-leads', icon: ShoppingBag },
        { name: 'nav_woocommerce_leads', href: '/dashboard/woocommerce-leads', icon: ShoppingBag },
      ]
    },
    { name: 'nav_inventory', href: '/dashboard/inventory', icon: Package },
    { 
      name: 'nav_seller_management', 
      icon: Users,
      children: [
        { name: 'nav_my_orders', href: '/dashboard/leads?mode=SELLER', icon: ShoppingCart },
        { name: 'nav_insert_lead', href: '/dashboard/leads/new?mode=SELLER', icon: Plus },
        { name: 'nav_my_links', href: '/dashboard/links', icon: Link2 },
      ]
    },
    { 
      name: 'nav_affiliate_management', 
      icon: Users,
      children: [
        { name: 'nav_my_orders', href: '/dashboard/leads?mode=AFFILIATE', icon: ShoppingCart },
        { name: 'nav_insert_lead', href: '/dashboard/leads/new?mode=AFFILIATE', icon: Plus },
        { name: 'nav_my_links', href: '/dashboard/links', icon: Link2 },
      ]
    },
    { name: 'nav_domains', href: '/dashboard/domains', icon: Globe },
    { name: 'nav_wallet', href: '/dashboard/wallet', icon: CreditCard },
    { name: 'nav_invoices', href: '/dashboard/invoices', icon: FileText },
    { name: 'nav_public_market', href: '/dashboard/marketplace', icon: ShoppingCart },
    { 
      name: 'nav_support_messages', 
      icon: MessageSquare,
      children: [
        { name: 'nav_support_tickets', href: '/dashboard/support', icon: MessageSquare },
        { name: 'nav_messages', href: '/dashboard/chat', icon: MessageSquare },
      ]
    },
    { 
      name: 'nav_pixels', 
      icon: Target,
      children: [
        { name: 'nav_meta_pixels', href: '/dashboard/pixels/meta', icon: Target },
        { name: 'nav_google_pixels', href: '/dashboard/pixels/google', icon: Globe },
        { name: 'nav_tiktok_pixels', href: '/dashboard/pixels/tiktok', icon: Music },
        { name: 'nav_snapchat_pixels', href: '/dashboard/pixels/snapchat', icon: Ghost },
      ]
    },
    { name: 'nav_settings', href: '/dashboard/settings', icon: Settings },
  ],
  grosseller: [
    { name: 'Vue d\'ensemble', href: '/grosseller', icon: Home },
    { name: 'Mon Profil', href: '/grosseller/profile', icon: Users },
    { 
      name: 'Catalogue & Inventaire',
      icon: Package,
      children: [
        { name: 'Inventaire Acheté', href: '/grosseller/inventory', icon: Package },
        { name: 'Ajouter un Produit', href: '/grosseller/add-product', icon: Tag },
        { name: 'Mes Liens', href: '/grosseller/links', icon: Link2 },
        { name: 'En Vente', href: '/grosseller/selling', icon: ShoppingCart },
        { name: 'En Attente', href: '/grosseller/pending', icon: Clock },
        { name: 'Approuvés', href: '/grosseller/approved', icon: Package },
      ]
    },
    { name: 'Commandes', href: '/grosseller/orders', icon: ShoppingCart },
    { 
      name: 'Finance & Analytique', 
      icon: CreditCard,
      children: [
        { name: 'Portefeuille', href: '/grosseller/wallet', icon: CreditCard },
        { name: 'Factures', href: '/grosseller/invoices', icon: FileText },
        { name: 'Analytique', href: '/grosseller/analytics', icon: CreditCard },
      ]
    },
    { name: 'Marché Public', href: '/grosseller/marketplace', icon: ShoppingCart },
    { 
      name: 'Support & Messages', 
      icon: MessageSquare,
      children: [
        { name: 'Support & Tickets', href: '/grosseller/support', icon: MessageSquare },
        { name: 'Messages', href: '/grosseller/chat', icon: MessageSquare },
      ]
    },
    { 
      name: 'Pixels', 
      icon: Target,
      children: [
        { name: 'Meta Pixels', href: '/grosseller/pixels/meta', icon: Target },
        { name: 'Google Pixels', href: '/grosseller/pixels/google', icon: Globe },
        { name: 'Tiktok Pixels', href: '/grosseller/pixels/tiktok', icon: Music },
        { name: 'Snapchat Pixels', href: '/grosseller/pixels/snapchat', icon: Ghost },
      ]
    },
    { name: 'Paramètres', href: '/grosseller/settings', icon: Settings },
  ],
  influencer: [
    { name: 'nav_home', href: '/influencer', icon: Home },
    { 
      name: 'nav_my_catalog',
      icon: Package,
      children: [
        { name: 'nav_my_products', href: '/influencer/inventory', icon: Package },
        { name: 'nav_my_links', href: '/influencer/links', icon: Tag },
      ]
    },
    { name: 'nav_leads', href: '/influencer/leads', icon: Users },
    { 
      name: 'nav_finance_payments', 
      icon: DollarSign,
      children: [
        { name: 'nav_wallet', href: '/influencer/wallet', icon: DollarSign },
        { name: 'nav_invoices', href: '/influencer/invoices', icon: FileText },
      ]
    },
    { name: 'nav_public_market', href: '/influencer/marketplace', icon: ShoppingCart },
    { 
      name: 'nav_support_messages', 
      icon: MessageSquare,
      children: [
        { name: 'nav_support_tickets', href: '/influencer/support', icon: MessageSquare },
        { name: 'nav_messages', href: '/influencer/chat', icon: MessageSquare },
      ]
    },
    { name: 'nav_settings', href: '/influencer/settings', icon: Settings },
  ],
  agent: [
    { name: 'Tableau de bord', href: '/agent', icon: Home },
    { name: 'Réclamer Leads', href: '/agent/leads', icon: Zap },
    { name: 'WhatsApp Leads', href: '/agent/insert-lead', icon: Plus },
    { name: 'Livraison', href: '/agent/livraison', icon: Truck },
    { name: 'Paramètres', href: '/agent/settings', icon: Settings },
  ],
  admin: [
    { name: 'Tableau de bord', href: '/admin', icon: Home },
    { name: 'Tous les Leads', href: '/admin/leads', icon: Users },
    { name: 'Masterclass Invitations', href: '/admin/event-registrations', icon: Users },
    { name: 'Gestion des Liens', href: '/admin/links', icon: Link2 },
    { 
      name: 'Gestion Utilisateurs', 
      icon: Users,
      children: [
        { name: 'Utilisateurs', href: '/admin/users', icon: Users },
        { name: 'Vérifications', href: '/admin/verifications', icon: ShieldCheck },
        { name: 'Inspect Call Center', href: '/admin/call-center-inspector', icon: Headphones },
        { name: 'Inspecteur Comptes', href: '/admin/influencer-inspector', icon: Crown },
        { name: 'Inspecteur Support', href: '/admin/support-inspector', icon: MessageSquare },
      ]
    },
    { 
      name: 'Catalogue Produits', 
      icon: Package,
      children: [
        { name: 'Produits', href: '/admin/products', icon: Package },
        { name: 'Catégories', href: '/admin/categories', icon: Tag },
        { name: 'Demande Produit', href: '/admin/affiliate-claims', icon: UserCheck },
      ]
    },
    { 
      name: 'Finance & Paiements', 
      icon: DollarSign,
      children: [
        { name: 'Finance', href: '/admin/finance', icon: DollarSign },
        { name: 'Suivi Paiements', href: '/admin/payment-monitoring', icon: CreditCard },
        { name: 'Factures', href: '/admin/invoices', icon: FileText },
      ]
    },
    { name: 'Marché Public', href: '/admin/marketplace', icon: ShoppingCart },
    { 
      name: 'Support & Messages', 
      icon: MessageSquare,
      children: [
        { name: 'Support & Tickets', href: '/admin/support', icon: MessageSquare },
        { name: 'Messages', href: '/admin/chat', icon: MessageSquare },
        { name: 'Messages de Contact', href: '/admin/contact-messages', icon: Mail },
      ]
    },
    { 
      name: 'Outils & Système',
      icon: Shield,
      children: [
        { name: 'Annonces', href: '/admin/announcements', icon: Bell },
        { name: 'Emails Professionnels', href: '/admin/professional-emails', icon: Mail },
        { name: 'Scanner Retour', href: '/admin/scanner', icon: ScanLine },
        { name: 'Webhooks Coliaty', href: '/admin/webhook-logs', icon: Webhook },
        { name: 'Journaux d\'Activité', href: '/admin/activity-logs', icon: History },
        { name: 'Sauvegardes DB', href: '/admin/backups', icon: Database },
      ]
    },
    { 
      name: 'Sécurité', 
      icon: ShieldAlert,
      children: [
        { name: 'Paramètres Plateforme', href: '/admin/platform-settings', icon: Shield },
        { name: 'Sécurité & Firewall', href: '/admin/security', icon: ShieldAlert },
      ]
    },
    { name: 'Paramètres', href: '/admin/settings', icon: Settings },
  ],
  system_support: [
    { name: 'Tableau de bord', href: '/admin', icon: Home },
    { 
      name: 'Support & Messages', 
      icon: MessageSquare,
      children: [
        { name: 'Support & Tickets', href: '/admin/support', icon: MessageSquare },
        { name: 'Messages', href: '/admin/chat', icon: MessageSquare },
      ]
    },
    { name: 'Paramètres', href: '/admin/settings', icon: Settings },
  ],
  confirmation: [
    { name: 'Vérifications', href: '/confirmation', icon: ShieldCheck },
    { name: 'Paramètres', href: '/confirmation/settings', icon: Settings },
  ],
  helper: [
    { name: 'Tableau de bord', href: '/helper', icon: Home },
    { 
      name: 'Gestion & Leads', 
      icon: Users,
      children: [
        { name: 'Utilisateurs', href: '/helper/users', icon: Users },
        { name: 'Tous les Leads', href: '/helper/leads', icon: Users },
      ]
    },
    { 
      name: 'Logistique & Colis', 
      icon: Package,
      children: [
        { name: 'Colis', href: '/helper/colis', icon: Package },
        { name: 'Colis Retournés', href: '/helper/retours', icon: RotateCcw },
        { name: 'Scanner Retour', href: '/helper/scanner', icon: ScanLine },
        { name: 'Tickets & Ramassage', href: '/helper/tickets', icon: FileText },
      ]
    },
    { 
      name: 'Catalogue', 
      icon: Tag,
      children: [
        { name: 'Produits', href: '/helper/products', icon: Tag },
        { name: 'Marketplace', href: '/helper/marketplace', icon: ShoppingCart },
        { name: 'Liens de Parrainage', href: '/helper/links', icon: Tag },
      ]
    },
    { name: 'Paramètres', href: '/helper/settings', icon: Settings },
  ],
};

export default function DashboardLayout() {
  const { user, logout, refreshUser, revertImpersonation } = useAuth();
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
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
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const [toasts, setToasts] = useState<any[]>([]);

  // Confirmation Modal states
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState({
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Synthesize crystal double synth bell chime sound
  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.exponentialRampToValueAtTime(1046.50, now + 0.15); // C6
      
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.6);
      
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc2.frequency.exponentialRampToValueAtTime(1318.51, now + 0.25); // E6
      
      gain2.gain.setValueAtTime(0.1, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.8);
    } catch (err) {
      console.warn('WebAudio chime failed:', err);
    }
  };

  // Play custom high-quality money MP3 sound provided in the public directory
  const playMoneySound = () => {
    try {
      const audio = new Audio('/soundes/Money_sound.mp3');
      audio.play().catch(err => {
        console.warn('Playback blocked by browser audio policy or file missing:', err);
      });
    } catch (err) {
      console.warn('Failed to play custom MP3 sound:', err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await notificationsApi.list({ page: 1, limit: 20 });
      setNotifications(res.data.data.notifications || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
    }
  }, [user?.id]);

  const getRolePrefix = () => {
    if (!user) return '';
    const role = user.role;
    if (['SUPER_ADMIN', 'FINANCE_ADMIN', 'SYSTEM_SUPPORT'].includes(role)) {
      return '/admin';
    }
    if (role === 'VENDOR') {
      return '/dashboard';
    }
    if (role === 'INFLUENCER') {
      return '/influencer';
    }
    if (role === 'CALL_CENTER_AGENT') {
      return '/agent';
    }
    if (role === 'CONFIRMATION_AGENT') {
      return '/confirmation';
    }
    if (role === 'HELPER') {
      return '/helper';
    }
    if (role === 'GROSSELLER') {
      return '/grosseller';
    }
    return '';
  };

  const getNotificationRedirect = (type: string) => {
    const prefix = getRolePrefix();
    switch (type) {
      case 'PRODUCT_CLAIM_STATUS':
        return `${prefix}/inventory`;
      case 'REFERRAL_LINK_STATUS':
      case 'REFERRAL_LINK_CLICKS':
        return `${prefix}/links`;
      case 'PAYOUT_REQUEST_STATUS':
        return `${prefix}/wallet`;
      case 'NEW_LEAD':
      case 'LEAD_STATUS_CHANGED':
        return `${prefix}/leads`;
      default:
        return `${prefix}/notifications`;
    }
  };

  const handleNotificationClick = async (notif: any) => {
    try {
      if (!notif.isRead) {
        await notificationsApi.markRead(notif.id);
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
      }
      setShowNotificationsMenu(false);
      navigate(getNotificationRedirect(notif.type));
    } catch (err) {
      console.error('Failed to handle notification click:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      toast.success('Toutes les notifications ont été marquées comme lues.');
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleDeleteNotification = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationsApi.delete(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success('Notification supprimée.');
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const handleDeleteAllNotifications = () => {
    setConfirmData({
      title: "Supprimer toutes les notifications",
      message: "Voulez-vous vraiment supprimer définitivement toutes vos notifications ? Cette action est irréversible.",
      onConfirm: async () => {
        try {
          await notificationsApi.deleteAll();
          setNotifications([]);
          toast.success('Toutes les notifications ont été supprimées.');
        } catch (err) {
          toast.error('Erreur lors de la suppression');
          console.error(err);
        }
      }
    });
    setIsConfirmOpen(true);
  };

  const [totalUnread, setTotalUnread] = useState(0);
  const [queueCount, setQueueCount] = useState(0);
  const [pendingClaimsCount, setPendingClaimsCount] = useState(0);

  // Request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          console.log('Notification permission status:', permission);
        }).catch(err => {
          console.warn('Failed to request notification permission:', err);
        });
      }
    }
  }, []);

  // Fetch initial counts
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const isAgent = ['SUPER_ADMIN', 'SYSTEM_SUPPORT'].includes(user?.role || '');
        const isAdmin = ['SUPER_ADMIN'].includes(user?.role || '');
        const [convRes, queueRes, claimsRes] = await Promise.all([
          chatApi.conversations(),
          isAgent ? chatApi.getQueue() : Promise.resolve({ data: { data: { queue: [] } } }),
          isAdmin ? adminApi.getAffiliateClaims({ status: 'PENDING' }) : Promise.resolve({ data: { data: [] } })
        ]);
        setTotalUnread(convRes.data.data.totalUnreadCount || 0);
        setQueueCount(queueRes.data.data.queue?.length || 0);
        setPendingClaimsCount(claimsRes.data.data?.length || 0);
      } catch (err) {
        console.error('Failed to fetch counts:', err);
      }
    };
    fetchCounts();
  }, [user?.id, user?.role]);

  // Real-time unread count updates
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: { message: any; conversationId: number }) => {
      const params = new URLSearchParams(location.search);
      const activeConvId = params.get('convId');
      const isMyMessage = data.message.sender.id === user?.id;
      const isViewingThisConv = activeConvId === String(data.conversationId);
      const isBackground = document.hidden || !document.hasFocus();
      
      if (!isMyMessage) {
        if (!isViewingThisConv) {
          setTotalUnread(prev => prev + 1);
        }

        // Play chime sound for any new message from someone else
        playChime();

        // Show browser system notification if the tab is hidden or not actively viewing this conversation
        if (isBackground || !isViewingThisConv) {
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(`💬 Nouveau message de ${data.message.sender.fullName || 'Client'}`, {
                body: data.message.content || 'Nouveau message reçu',
                icon: '/new logo/logo filess-25.svg',
              });
            } catch (err) {
              console.warn('Failed to show system notification:', err);
            }
          }
        }
      }
    };

    const handleNewTicket = () => {
      setQueueCount(prev => prev + 1);
    };

    const handleClaimed = (data: { participant: any }) => {
      setQueueCount(prev => Math.max(0, prev - 1));
    };

    const handleNewNotification = (notification: any) => {
      setNotifications(prev => [notification, ...prev]);
      
      // Play sound based on notification type
      if (['NEW_LEAD', 'LEAD_STATUS_CHANGED'].includes(notification.type)) {
        playMoneySound();
      } else {
        playChime();
      }

      // Show browser system notification
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('🔔 Nouvelle Notification - Silacod', {
            body: notification.message || 'Vous avez reçu une nouvelle notification',
            icon: '/new logo/logo filess-25.svg',
          });
        } catch (err) {
          console.warn('Failed to show system notification:', err);
        }
      }

      const toastId = Date.now();
      setToasts(prev => [...prev, { ...notification, toastId }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.toastId !== toastId));
      }, 6000);
    };

    socket.on('new-message', handleNewMessage);
    socket.on('new-support-ticket', handleNewTicket);
    socket.on('conversation-claimed', handleClaimed);
    socket.on('new-notification', handleNewNotification);

    // Join support queue room if agent
    const isAgent = ['SUPER_ADMIN', 'SYSTEM_SUPPORT'].includes(user?.role || '');
    if (isAgent) {
      socket.emit('join-room', 'support-queue');
    }

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('new-support-ticket', handleNewTicket);
      socket.off('conversation-claimed', handleClaimed);
      socket.off('new-notification', handleNewNotification);
      if (isAgent) {
        socket.emit('leave-room', 'support-queue');
      }
    };
  }, [socket, user?.id, user?.role, location.search]);

  // Listen for internal "chat:read" events to sync totalUnread immediately
  useEffect(() => {
    const handleChatRead = (e: any) => {
      const { count = 1 } = e.detail || {};
      setTotalUnread(prev => Math.max(0, prev - count));
    };
    window.addEventListener('chat:read', handleChatRead);
    return () => window.removeEventListener('chat:read', handleChatRead);
  }, []);

  useEffect(() => {
    if (location.pathname.includes('/chat')) {
      const fetchCounts = async () => {
        try {
          const isAgent = ['SUPER_ADMIN', 'SYSTEM_SUPPORT'].includes(user?.role || '');
          const isAdmin = ['SUPER_ADMIN'].includes(user?.role || '');
          const [convRes, queueRes, claimsRes] = await Promise.all([
            chatApi.conversations(),
            isAgent ? chatApi.getQueue() : Promise.resolve({ data: { data: { queue: [] } } }),
            isAdmin ? adminApi.getAffiliateClaims({ status: 'PENDING' }) : Promise.resolve({ data: { data: [] } })
          ]);
          setTotalUnread(convRes.data.data.totalUnreadCount || 0);
          setQueueCount(queueRes.data.data.queue?.length || 0);
          setPendingClaimsCount(claimsRes.data.data?.length || 0);
        } catch {}
      };
      fetchCounts();
    }
  }, [location.pathname, location.search, user?.id, user?.role]);

  // Auto-expand if child is active
  useEffect(() => {
    const activeParent = navItems.find((item: any) => 
      item.children?.some((child: any) => location.pathname === child.href)
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

  const unreadNotifications = notifications.filter(n => !n.isRead);
  const inventoryUnreadCount = unreadNotifications.filter(n => n.type === 'PRODUCT_CLAIM_STATUS').length;
  const linksUnreadCount = unreadNotifications.filter(n => ['REFERRAL_LINK_STATUS', 'REFERRAL_LINK_CLICKS'].includes(n.type)).length;
  const walletUnreadCount = unreadNotifications.filter(n => n.type === 'PAYOUT_REQUEST_STATUS').length;
  const leadsUnreadCount = unreadNotifications.filter(n => ['NEW_LEAD', 'LEAD_STATUS_CHANGED'].includes(n.type)).length;

  const isVendorDashboard = !location.pathname.startsWith('/admin') && !location.pathname.startsWith('/agent') && !location.pathname.startsWith('/grosseller') && !location.pathname.startsWith('/influencer') && !location.pathname.startsWith('/confirmation') && !location.pathname.startsWith('/helper');
  const currentMode = user?.mode || 'SELLER';

  // Permission check for individual helper nav items (works on both top-level and children)
  const isHelperItemAllowed = (item: any): boolean => {
    if (user?.role !== 'HELPER') return true;
    if (item.href === '/helper/users') return !!user?.canImpersonate;
    if (item.href === '/helper/leads') return !!user?.canManageLeads;
    if (item.href === '/helper/products') return !!user?.canManageProducts;
    if (item.href === '/helper/colis') return !!user?.canManageOrders;
    if (item.href === '/helper/retours') return !!user?.canScanReturns;
    if (item.href === '/helper/scanner') return !!user?.canScanReturns;
    if (item.href === '/helper/tickets') return !!user?.canManageTickets;
    if (item.href === '/helper/links') return !!user?.canManageInfluencerLinks;
    return true;
  };

  const navItems = (getNavItems() as any[])
    .map((item: any) => {
      // For groups with children, filter the children first
      if (item.children) {
        const filteredChildren = item.children.filter((child: any) => isHelperItemAllowed(child));
        if (user?.role === 'HELPER' && filteredChildren.length === 0) return null;
        return { ...item, children: filteredChildren };
      }
      // For flat items, check directly
      if (!isHelperItemAllowed(item)) return null;
      return item;
    })
    .filter((item: any) => item !== null)
    .filter((item: any) => {
      if (item.href === '/admin/backups' && user?.role !== 'SUPER_ADMIN') return false;
      // Filter by mode for vendor dashboard
      if (isVendorDashboard) {
        if (item.name === 'nav_seller_management') return currentMode === 'SELLER';
        if (item.name === 'nav_affiliate_management') return currentMode === 'AFFILIATE';
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
  const originalUserRole = localStorage.getItem('originalUserRole');
  const revertButtonLabel = originalUserRole === 'SUPER_ADMIN' || originalUserRole === 'FINANCE_ADMIN' || originalUserRole === 'SYSTEM_SUPPORT'
    ? 'Retourner à mon compte Admin'
    : originalUserRole === 'HELPER'
    ? 'Retourner à mon compte Helper'
    : 'Retourner à mon compte';

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-['29LT_Kaff',_Cairo,_Inter,_sans-serif]">
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="bg-gradient-to-r from-red-600 to-amber-600 text-white text-center py-2 px-4 shadow-md sticky top-0 z-[100] flex items-center justify-center gap-4 animate-pulse">
          <span className="font-bold text-sm">
            ⚠️ Mode Assistance (Lecture Seule) : Vous êtes connecté en tant que {user?.fullName || user?.email || 'un utilisateur'}. Aucune action n'est autorisée.
          </span>
          <button
            onClick={revertImpersonation}
            className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-md text-sm font-semibold transition-colors"
          >
            {revertButtonLabel}
          </button>
        </div>
      )}
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          data-sidebar-overlay
          className="fixed inset-0 bg-black/25 z-[9990] lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 ${isRtl ? 'right-0 border-l border-slate-200/80' : 'left-0 border-r border-slate-200/80'} bg-white z-[9999] shadow-2xl transition-all duration-300 ease-in-out
        ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-56'}
        w-64 sm:w-72 lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : (isRtl ? 'translate-x-full' : '-translate-x-full')}
      `}>
        {/* Sidebar Header */}
        <div className={`flex items-center h-14 transition-all duration-300 relative z-20 ${
          sidebarCollapsed ? 'lg:justify-center lg:px-0 px-5 justify-between' : 'px-5 justify-between'
        }`}>
          <div dir="ltr" className={`flex items-center gap-2.5 transition-all duration-300 ${
            sidebarCollapsed ? 'lg:gap-0' : ''
          }`}>
            <div className="w-9 h-9 bg-white rounded-xl shadow-lg shadow-slate-200/50 flex items-center justify-center overflow-hidden flex-shrink-0 border border-slate-100">
               <img src="/new logo/logo filess-25.svg" alt="SILACOD" className="w-6 h-6 object-contain" />
            </div>
            <img 
              src="/new logo/logo filess-24.svg" 
              alt="SILACOD" 
              className={`h-3.5 transition-all duration-300 ${
                sidebarCollapsed ? 'lg:hidden' : ''
              }`} 
            />
          </div>
          {/* Mobile close button */}
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Separator with Gradient */}
        <div className="px-4 mb-2">
          <div className="h-px bg-gradient-to-r from-transparent via-slate-200/50 to-transparent" />
        </div>

        {/* Grain Overlay for Sidebar */}
        <div className="bg-noise absolute inset-0 mix-blend-overlay opacity-[0.15] pointer-events-none z-10" />

        {/* Nav Items */}
        <nav className={`space-y-0.5 scrollbar-hide transition-all duration-300 ${
          sidebarCollapsed ? 'overflow-visible lg:p-2 p-3' : 'overflow-y-auto max-h-[calc(100vh-120px)] p-3'
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

            const navClass = `w-full flex items-center gap-2.5 rounded-xl text-[11px] font-black tracking-wide transition-all duration-500 group relative z-20 ${
              sidebarCollapsed ? 'lg:justify-center lg:px-0 lg:py-2 px-3 py-2' : 'px-3 py-2'
            } ${
              isActive
                ? (isGrosseller ? 'bg-grosseller-50 text-grosseller-700 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]' : isInfluencer ? 'bg-influencer-50 text-influencer-700 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]' : 'bg-primary-50 text-primary-900 border border-primary-100/50 shadow-[0_8px_20px_rgba(0,0,0,0.04)]')
                : 'text-slate-500 hover:bg-white/60 hover:text-slate-900 hover:shadow-xl hover:shadow-slate-200/40'
            }`;

            const commonContent = (
              <>
                <div className={`p-1 rounded-lg transition-all duration-500 flex-shrink-0 ${isActive ? 'bg-white shadow-sm scale-110' : 'group-hover:bg-white group-hover:scale-105 group-hover:shadow-md group-hover:shadow-slate-200/50'}`}>
                  <Icon size={15} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-inherit' : 'text-slate-400 group-hover:text-slate-900'} />
                </div>
                
                {(!sidebarCollapsed || sidebarOpen) && (
                  <div className="flex-1 flex items-center justify-between min-w-0 animate-in fade-in duration-300">
                    <span className="transition-all duration-300 whitespace-nowrap overflow-hidden text-ellipsis">{t(item.name, 'dashboard')}</span>
                    
                    {/* Notification Badge */}
                    {(item.href?.includes('/chat') || item.children?.some((c: any) => c.href?.includes('/chat'))) && totalUnread > 0 && (
                      <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[1.25rem] flex items-center justify-center shadow-sm shadow-rose-200 animate-in zoom-in duration-300">
                        {totalUnread}
                      </span>
                    )}
                    {(item.href?.includes('/support') || item.children?.some((c: any) => c.href?.includes('/support'))) && queueCount > 0 && (
                      <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[1.25rem] flex items-center justify-center shadow-sm shadow-amber-200 animate-in zoom-in duration-300">
                        {queueCount}
                      </span>
                    )}

                    {/* Influencer Specific Badges */}
                    {isInfluencer && item.href === '/influencer/inventory' && inventoryUnreadCount > 0 && (
                      <span className="bg-purple-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[1.25rem] flex items-center justify-center shadow-sm shadow-purple-200 animate-in zoom-in duration-300">
                        {inventoryUnreadCount}
                      </span>
                    )}
                    {isInfluencer && item.href === '/influencer/links' && linksUnreadCount > 0 && (
                      <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[1.25rem] flex items-center justify-center shadow-sm shadow-rose-200 animate-in zoom-in duration-300">
                        {linksUnreadCount}
                      </span>
                    )}
                    {isInfluencer && item.href === '/influencer/wallet' && walletUnreadCount > 0 && (
                      <span className="bg-emerald-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[1.25rem] flex items-center justify-center shadow-sm shadow-emerald-200 animate-in zoom-in duration-300">
                        {walletUnreadCount}
                      </span>
                    )}
                    {isInfluencer && item.href === '/influencer/leads' && leadsUnreadCount > 0 && (
                      <span className="bg-blue-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[1.25rem] flex items-center justify-center shadow-sm shadow-blue-200 animate-in zoom-in duration-300">
                        {leadsUnreadCount}
                      </span>
                    )}

                    {hasChildren && (
                      <ChevronDown size={14} className={`transition-transform duration-500 flex-shrink-0 ${isExpanded ? 'rotate-180 text-slate-900' : 'text-slate-400 group-hover:text-slate-900'}`} />
                    )}
                  </div>
                )}
                
                {sidebarCollapsed && !sidebarOpen && !hasChildren && (
                  <div className={`hidden lg:block absolute ${isRtl ? 'right-full mr-3 translate-x-[10px]' : 'left-full ml-3 translate-x-[-10px]'} px-4 py-2 bg-slate-900 text-white text-[10px] uppercase font-black tracking-widest rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 group-hover:translate-x-0 whitespace-nowrap z-[100] shadow-2xl`}>
                    {t(item.name, 'dashboard')}
                    {(item.href?.includes('/chat') || item.children?.some((c: any) => c.href?.includes('/chat'))) && totalUnread > 0 && (
                      <span className="ml-2 bg-rose-500 text-white px-1.5 py-0.5 rounded-full text-[9px]">
                        {totalUnread}
                      </span>
                    )}
                    {(item.href?.includes('/support') || item.children?.some((c: any) => c.href?.includes('/support'))) && queueCount > 0 && (
                      <span className="ml-2 bg-amber-500 text-white px-1.5 py-0.5 rounded-full text-[9px]">
                        {queueCount}
                      </span>
                    )}
                    {isInfluencer && item.href === '/influencer/inventory' && inventoryUnreadCount > 0 && (
                      <span className="ml-2 bg-purple-500 text-white px-1.5 py-0.5 rounded-full text-[9px]">
                        {inventoryUnreadCount}
                      </span>
                    )}
                    {isInfluencer && item.href === '/influencer/links' && linksUnreadCount > 0 && (
                      <span className="ml-2 bg-rose-500 text-white px-1.5 py-0.5 rounded-full text-[9px]">
                        {linksUnreadCount}
                      </span>
                    )}
                    {isInfluencer && item.href === '/influencer/wallet' && walletUnreadCount > 0 && (
                      <span className="ml-2 bg-emerald-500 text-white px-1.5 py-0.5 rounded-full text-[9px]">
                        {walletUnreadCount}
                      </span>
                    )}
                    {isInfluencer && item.href === '/influencer/leads' && leadsUnreadCount > 0 && (
                      <span className="ml-2 bg-blue-500 text-white px-1.5 py-0.5 rounded-full text-[9px]">
                        {leadsUnreadCount}
                      </span>
                    )}
                  </div>
                )}
              </>
            );

            return (
              <div key={item.name} className="space-y-1 relative">
                {hasChildren ? (
                  <button
                    onClick={() => toggleGroup(item.name)}
                    type="button"
                    className={`${navClass} peer`}
                    title={sidebarCollapsed ? t(item.name, 'dashboard') : undefined}
                  >
                    {commonContent}
                  </button>
                ) : (
                  <Link
                    to={item.href || '#'}
                    className={navClass}
                    title={sidebarCollapsed ? t(item.name, 'dashboard') : undefined}
                  >
                    {commonContent}
                  </Link>
                )}

                {/* Professional Sub-navigation */}
                {hasChildren && isExpanded && (!sidebarCollapsed || sidebarOpen) && (
                  <div className={`relative ${isRtl ? 'mr-5 pr-3 pl-0' : 'ml-5 pl-3 pr-0'} space-y-0.5 mt-0.5 animate-in slide-in-from-top-2 fade-in duration-300`}>
                    {it.children.map((child: any) => {
                      const isChildActive = location.pathname === child.href;
                      const ChildIcon = child.icon;
                      return (
                        <Link
                          key={child.name}
                          to={child.href}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all relative group/item ${
                            isChildActive 
                              ? 'text-primary-600 bg-primary-50/30' 
                              : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50/50'
                          }`}
                        >
                          {/* Indicator dot */}
                          <div className={`absolute ${isRtl ? 'right-[-16.5px]' : 'left-[-16.5px]'} w-1 h-1 rounded-full transition-all ${
                            isChildActive ? 'bg-primary-500 scale-125' : 'bg-slate-200 group-hover/item:bg-slate-400'
                          }`} />
                          
                          <div className={`p-0.5 rounded transition-colors ${isChildActive ? 'bg-white shadow-sm' : 'group-hover:bg-white'}`}>
                            <ChildIcon size={12} className={isChildActive ? 'text-primary-600' : 'text-slate-400 group-hover/item:text-slate-600'} />
                          </div>
                          <span className="tracking-tight">{t(child.name, 'dashboard')}</span>
                          {child.href?.includes('/support') && queueCount > 0 && (
                            <span className="ml-auto bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[1.25rem] flex items-center justify-center shadow-sm shadow-amber-200">
                              {queueCount}
                            </span>
                          )}
                          {child.href?.includes('/affiliate-claims') && pendingClaimsCount > 0 && (
                            <span className="ml-auto bg-violet-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[1.25rem] flex items-center justify-center shadow-sm shadow-violet-200">
                              {pendingClaimsCount}
                            </span>
                          )}
                          {child.href?.includes('/chat') && totalUnread > 0 && (
                            <span className="ml-auto bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[1.25rem] flex items-center justify-center shadow-sm shadow-rose-200">
                              {totalUnread}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}

                {/* Floating Sub-navigation for Collapsed Sidebar */}
                {hasChildren && sidebarCollapsed && !sidebarOpen && (
                  <div className={`absolute ${isRtl ? 'right-full pr-2 mr-0 pl-0' : 'left-full pl-2 ml-0 pr-0'} top-0 hidden peer-hover:block hover:block z-[100]`}>
                    <div className={`w-48 bg-white rounded-xl shadow-xl border border-slate-100 p-2 animate-in fade-in ${isRtl ? 'slide-in-from-right-2' : 'slide-in-from-left-2'} duration-200`}>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 pb-2 mb-1 border-b border-slate-50">
                        {t(item.name, 'dashboard')}
                      </div>
                    <div className="space-y-0.5">
                      {it.children.map((child: any) => {
                        const isChildActive = location.pathname === child.href;
                        const ChildIcon = child.icon;
                        return (
                          <Link
                            key={child.name}
                            to={child.href}
                            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                              isChildActive 
                                ? 'text-primary-600 bg-primary-50' 
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <ChildIcon size={14} className={isChildActive ? 'text-primary-600' : 'text-slate-400'} />
                              {t(child.name, 'dashboard')}
                            </div>
                            {child.href?.includes('/support') && queueCount > 0 && (
                              <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[1.25rem] flex items-center justify-center shadow-sm shadow-amber-200 animate-in zoom-in duration-300">
                                {queueCount}
                              </span>
                            )}
                            {child.href?.includes('/affiliate-claims') && pendingClaimsCount > 0 && (
                              <span className="bg-violet-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[1.25rem] flex items-center justify-center shadow-sm shadow-violet-200 animate-in zoom-in duration-300">
                                {pendingClaimsCount}
                              </span>
                            )}
                            {child.href?.includes('/chat') && totalUnread > 0 && (
                              <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[1.25rem] flex items-center justify-center shadow-sm shadow-rose-200 animate-in zoom-in duration-300">
                                {totalUnread}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Collapse toggle button (desktop only) */}
        <button
          onClick={toggleSidebarCollapsed}
          className={`hidden lg:flex absolute bottom-16 bg-white border border-slate-200 rounded-full p-1.5 shadow-lg hover:shadow-xl hover:bg-slate-50 text-slate-400 hover:text-primary-600 transition-all duration-300 z-[60] ${
            isRtl ? 'left-[-14px] right-auto' : 'right-[-14px] left-auto'
          }`}
          title={sidebarCollapsed ? 'Développer le menu' : 'Réduire le menu'}
        >
          {sidebarCollapsed ? (isRtl ? <ChevronLeft size={16} /> : <ChevronRight size={16} />) : (isRtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />)}
        </button>

        {/* Mode Switcher for Vendors: Bento Element */}
        {isVendorDashboard && (
          <div className={`absolute bottom-6 transition-all duration-300 z-20 ${
            sidebarCollapsed ? 'lg:left-3 lg:right-3 left-6 right-6' : 'left-6 right-6'
          }`}>
            <button
              onClick={handleSwitchMode}
              title={sidebarCollapsed ? (currentMode === 'AFFILIATE' ? 'Mode Affilié' : 'Mode Vendeur') : undefined}
              className={`w-full flex items-center ${
                sidebarCollapsed ? 'lg:justify-center lg:gap-0' : 'gap-2'
              } rounded-xl glass-panel border border-white/50 shadow-2xl shadow-slate-200/50 hover:bg-white hover:scale-[1.02] transition-all group group/btn p-2`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black transition-all group-hover/btn:rotate-12 shadow-lg flex-shrink-0 ${
                currentMode === 'AFFILIATE' ? 'bg-gradient-to-tr from-accent-500 to-orange-400 shadow-accent-200' : 'bg-gradient-to-tr from-primary-600 to-influencer-500 shadow-primary-200'
              }`}>
                {currentMode === 'AFFILIATE' ? 'A' : 'V'}
              </div>
              <div className={`text-left flex-1 transition-all duration-300 ${
                (sidebarCollapsed && !sidebarOpen) ? 'lg:hidden' : ''
              }`}>
                <p className="text-[9px] font-black text-slate-900 uppercase tracking-tight leading-none">
                  {currentMode === 'AFFILIATE' ? 'Affilié' : 'Vendeur'}
                </p>
                <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">PRO SWITCH</p>
              </div>
              <div className={`p-1.5 bg-slate-50 rounded-xl group-hover:bg-primary-50 transition-colors ${
                (sidebarCollapsed && !sidebarOpen) ? 'lg:hidden' : ''
              }`}>
                <Zap size={12} className="text-slate-400 group-hover:text-primary-500 transition-colors" />
              </div>
            </button>
          </div>
        )}
      </aside>

      {/* Search Modal / Command Palette */}
      {searchOpen && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/65 backdrop-blur-md z-[999999] flex items-start justify-center pt-20 sm:pt-28 px-4 cursor-pointer animate-in fade-in duration-200"
          onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
        >
          <div 
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden cursor-default animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <Search size={20} className="text-primary-500 flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={t('search_placeholder', 'dashboard', 'Rechercher une page...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm font-semibold text-slate-800 placeholder-slate-400"
                autoFocus
              />
              <button
                type="button"
                onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition-colors flex items-center gap-1.5"
              >
                <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white text-[10px] font-bold text-slate-400 border border-slate-200 shadow-sm">
                  ESC
                </kbd>
                <X size={18} />
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
              {searchQuery ? (
                filteredNavItems.length > 0 ? (
                  filteredNavItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.href}
                        onClick={() => item.href && handleSearchNav(item.href)}
                        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors group"
                      >
                        <div className="p-2 rounded-xl bg-slate-100 group-hover:bg-primary-50 group-hover:text-primary-600 text-slate-400 transition-colors">
                          <Icon size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{item.name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{item.href}</p>
                        </div>
                        <ChevronRight size={14} className="ml-auto text-slate-300 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all" />
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
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-3">Navigation rapide</p>
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
                        <span className="text-sm font-semibold text-slate-700">{item.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}


      {/* Main content */}
      <div className={`min-h-screen transition-all duration-300 ease-in-out ${
        isRtl 
          ? (sidebarCollapsed ? 'lg:pr-20 pl-0' : 'lg:pr-56 pl-0') 
          : (sidebarCollapsed ? 'lg:pl-20 pr-0' : 'lg:pl-56 pr-0')
      }`}>
        {/* Header */}
        <header className="sticky top-0 h-14 bg-[#F8FAFC] border-b border-slate-200/50 z-[500]">
          <div className="flex items-center justify-between h-full px-3 sm:px-4 lg:px-6">
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
                className="p-2 bg-white rounded-lg border border-slate-100 text-slate-500 hover:text-primary-600 hover:border-primary-200 transition-all shadow-sm active:scale-95"
                id="sidebar-toggle"
                title={sidebarCollapsed ? 'Développer le menu' : 'Réduire le menu'}
              >
                {sidebarCollapsed 
                  ? (isRtl ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />) 
                  : (isRtl ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />)
                }
              </button>

              {/* Breadcrumb navigation */}
              <div className="hidden sm:flex items-center gap-2">
                <div className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${section.color}`}>
                  {section.label}
                </div>
                {currentPage && (
                  <>
                    {isRtl ? <ChevronLeft size={12} className="text-slate-300" /> : <ChevronRight size={12} className="text-slate-300" />}
                    <div className="h-7 px-3 bg-white rounded-lg border border-slate-100 flex items-center gap-2 shadow-sm">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none">
                        {t(currentPage.name, 'dashboard')}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Mobile: page name only */}
              <div className="sm:hidden">
                <span className="text-sm font-bold text-slate-700">
                  {currentPage?.name ? t(currentPage.name, 'dashboard') : t('dashboard', 'dashboard')}
                </span>
              </div>
            </div>

            {/* Right section */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Search button */}
              <button
                onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 100); }}
                className="relative p-2 bg-white rounded-lg border border-slate-100 text-slate-400 hover:text-primary-600 hover:border-primary-200 transition-all shadow-sm hover:shadow-md active:scale-95 group"
                id="search-toggle"
              >
                <Search size={16} />
                <span className="hidden lg:inline-flex absolute -bottom-1 -right-1 items-center gap-0.5 px-1 py-0.5 rounded bg-slate-100 text-[8px] font-bold text-slate-400 border border-slate-200 group-hover:bg-primary-50 group-hover:text-primary-500 group-hover:border-primary-200 transition-colors">
                  <Command size={8} />K
                </span>
              </button>

              {/* Fullscreen toggle */}
              <button
                onClick={toggleFullscreen}
                className="hidden sm:flex relative p-2 bg-white rounded-lg border border-slate-100 text-slate-400 hover:text-primary-600 hover:border-primary-200 transition-all shadow-sm hover:shadow-md active:scale-95"
                title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
                id="fullscreen-toggle"
              >
                {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
              </button>

              {/* Language Switcher */}
              <LanguageSwitcherWidget variant="dashboard-header" />

              {/* Notifications */}
              <div className="relative">
                <button 
                  onClick={() => setShowNotificationsMenu(!showNotificationsMenu)}
                  className={`relative p-2 bg-white rounded-lg border text-slate-400 transition-all shadow-sm hover:shadow-md active:scale-95 ${
                    showNotificationsMenu ? 'border-primary-200 text-primary-600' : 'border-slate-100 hover:text-primary-600 hover:border-primary-200'
                  }`}
                  id="notifications-toggle"
                >
                  <Bell size={16} />
                  {unreadNotifications.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] bg-gradient-to-r from-accent-500 to-rose-500 border-2 border-[#F8FAFC] rounded-full flex items-center justify-center animate-pulse">
                      <span className="text-[8px] font-black text-white leading-none">
                        {unreadNotifications.length}
                      </span>
                    </span>
                  )}
                </button>

                {showNotificationsMenu && (
                  <>
                    <div className="fixed inset-0 z-[990]" onClick={() => setShowNotificationsMenu(false)}></div>
                    <div className={`absolute ${language === 'ar' ? 'left-0 origin-top-left' : 'right-0 origin-top-right'} mt-3 w-80 sm:w-[420px] bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.12)] border border-slate-100 z-[1000] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300`}>
                      {/* Tray Header */}
                      <div className="px-5 py-4 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-black text-slate-900 uppercase tracking-wider">{t('title', 'notifications', 'Notifications')}</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                            {unreadNotifications.length} {t('unread_suffix', 'notifications', 'non lues')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {notifications.length > 0 && (
                            <>
                              <button 
                                onClick={handleMarkAllRead}
                                className="text-[9px] font-black text-primary-600 hover:text-primary-700 bg-primary-50 px-2 py-1.5 rounded-md transition-colors"
                              >
                                {t('btn_read_all_short', 'notifications', 'Tout lire')}
                              </button>
                              <button 
                                onClick={handleDeleteAllNotifications}
                                className="text-[9px] font-black text-rose-600 hover:text-rose-700 bg-rose-50 px-2 py-1.5 rounded-md transition-colors"
                              >
                                {t('btn_clear_all_short', 'notifications', 'Tout effacer')}
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Tray List */}
                      <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-50">
                        {notifications.length === 0 ? (
                          <div className="py-12 px-6 text-center">
                            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto text-slate-400 mb-3">
                              <Bell size={20} className="animate-bounce" />
                            </div>
                            <p className="text-xs font-black text-slate-800">{t('no_notifications_menu', 'notifications', 'Aucune notification')}</p>
                            <p className="text-[10px] text-slate-400 font-bold mt-1">
                              {t('no_notifications_menu_desc', 'notifications', 'Vous serez notifié en temps réel lors de vos ventes et de vos demandes.')}
                            </p>
                          </div>
                        ) : (
                          notifications.slice(0, 5).map((notif) => {
                            // Custom icon mapping
                            let iconBg = 'bg-slate-50 text-slate-500';
                            let IconComponent = Bell;
                            if (notif.type === 'PRODUCT_CLAIM_STATUS') {
                              iconBg = 'bg-purple-50 text-purple-600';
                              IconComponent = Package;
                            } else if (['REFERRAL_LINK_STATUS', 'REFERRAL_LINK_CLICKS'].includes(notif.type)) {
                              iconBg = 'bg-rose-50 text-rose-600';
                              IconComponent = Tag;
                            } else if (notif.type === 'PAYOUT_REQUEST_STATUS') {
                              iconBg = 'bg-emerald-50 text-emerald-600';
                              IconComponent = CreditCard;
                            } else if (['NEW_LEAD', 'LEAD_STATUS_CHANGED'].includes(notif.type)) {
                              iconBg = 'bg-blue-50 text-blue-600';
                              IconComponent = Users;
                            }

                            const translated = translateNotification(notif, (k, ns, fb) => t(k, ns || 'notifications', fb));

                            return (
                              <div
                                key={notif.id}
                                onClick={() => handleNotificationClick(notif)}
                                className={`flex items-start gap-3 p-4 hover:bg-slate-50/80 cursor-pointer transition-all duration-300 group relative ${
                                  !notif.isRead ? 'bg-primary-50/20' : ''
                                }`}
                              >
                                {/* Active Indicator Dot */}
                                {!notif.isRead && (
                                  <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-primary-500 rounded-full animate-pulse" />
                                )}

                                {/* Icon */}
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${iconBg}`}>
                                  <IconComponent size={14} />
                                </div>

                                {/* Texts */}
                                <div className={`flex-1 min-w-0 ${language === 'ar' ? 'pl-6' : 'pr-6'}`}>
                                  <div className="flex items-center justify-between gap-2">
                                    <p className={`text-[11px] font-black text-slate-900 truncate ${language === 'ar' ? 'pl-4' : 'pr-4'}`}>
                                      {translated.title}
                                    </p>
                                    <span className="text-[8px] font-bold text-slate-400 whitespace-nowrap">
                                      {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <p className="text-[10px] font-medium text-slate-500 leading-relaxed mt-1">
                                    {translated.body}
                                  </p>
                                </div>

                                {/* Individual Delete button */}
                                <button
                                  onClick={(e) => handleDeleteNotification(notif.id, e)}
                                  className={`absolute ${language === 'ar' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 p-1.5 bg-white border border-slate-100 rounded-lg text-slate-400 hover:text-rose-600 hover:border-rose-200 transition-all opacity-0 group-hover:opacity-100 shadow-sm active:scale-95`}
                                  title={t('confirm_delete_all_btn', 'notifications', 'Supprimer')}
                                >
                                  <Trash size={10} />
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Tray Footer */}
                      {notifications.length > 0 && (
                        <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-50 text-center">
                          <Link
                            to={`${getRolePrefix()}/notifications`}
                            onClick={() => setShowNotificationsMenu(false)}
                            className="inline-flex items-center gap-1.5 text-[10px] font-black text-slate-600 hover:text-primary-600 transition-colors uppercase tracking-wider"
                          >
                            <span>{t('view_all_history', 'notifications', "Voir tout l'historique")}</span>
                            <ChevronRight size={10} />
                          </Link>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Divider */}
              <div className="hidden sm:block w-px h-6 bg-slate-200/80 mx-0.5" />

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 hover:bg-white border border-transparent hover:border-slate-100 rounded-xl p-1 pr-2 sm:pr-3 transition-all duration-300 group"
                  id="profile-menu-toggle"
                >
                  <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-tr from-primary-600 to-indigo-400 rounded-full flex items-center justify-center text-white font-black text-sm shadow-lg shadow-primary-200/50 group-hover:rotate-6 transition-transform overflow-hidden">
                    {user?.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.fullName || 'User'} className="w-full h-full object-cover" />
                    ) : (
                      user?.fullName?.charAt(0)?.toUpperCase() || 'U'
                    )}
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-[11px] font-black text-slate-900 leading-tight tracking-tight">{user?.fullName}</p>
                    <p className={`text-[9px] font-black uppercase tracking-[0.1em] ${
                      isVendorDashboard && currentMode === 'AFFILIATE' ? 'text-accent-500' : 'text-primary-500'
                    }`}>{getRoleLabel()}</p>
                  </div>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform duration-500 hidden sm:block ${showProfileMenu ? 'rotate-180' : ''}`} />
                </button>

                {showProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-[990]" onClick={() => setShowProfileMenu(false)}></div>
                    <div className={`absolute ${language === 'ar' ? 'left-0 origin-top-left' : 'right-0 origin-top-right'} mt-3 w-64 bg-white rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.12)] border border-slate-100 z-[1000] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300`}>
                      <div className="px-6 py-6 border-b border-slate-50 bg-slate-50/50 flex items-center">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-slate-900 truncate">{user?.fullName}</p>
                          <p className="text-xs font-bold text-slate-400 truncate">{user?.email}</p>
                        </div>
                      </div>
                      <div className="p-3">
                        {[
                          { name: t('menu_my_profile', 'dashboard'), tab: '', icon: User },
                          { name: t('menu_payment', 'dashboard'), tab: 'payment', icon: CreditCard },
                          { name: t('menu_security_2fa', 'dashboard'), tab: 'password', icon: Shield },
                        ].map((item) => (
                          <button
                            key={item.tab}
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

                      <div className="border-t border-slate-50 p-3 bg-slate-50/20">
                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            handleLogout();
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-black text-rose-500 hover:bg-rose-50 rounded-2xl transition-all group"
                        >
                          <LogOut size={18} className="group-hover:translate-x-1 transition-transform" />
                          {t('menu_logout', 'dashboard')}
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
        <div className="flex-1 px-3 sm:px-4 lg:px-6 py-3 sm:py-4 min-h-[calc(100vh-56px)]">
          {/* Background Mesh for content area */}
          <div className="relative pointer-events-none">
            <div className="absolute inset-0 overflow-hidden opacity-40">
              <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-400/5 rounded-full blur-[100px]" />
              <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-accent-400/5 rounded-full blur-[120px]" />
            </div>
          </div>

          <div className="relative max-w-[1600px] mx-auto">
            <AnnouncementBanner position="TOP" />
            <ProfileProgressBanner />
            <Outlet />
            <AnnouncementBanner position="BOTTOM" />
          </div>
        </div>
      </div>

      {/* Dynamic Slide-Up Toasts alert popup from bottom right */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
        {toasts.map((t) => {
          let iconBg = 'bg-slate-50 text-slate-500';
          let IconComponent = Bell;
          if (t.type === 'PRODUCT_CLAIM_STATUS') {
            iconBg = 'bg-purple-500 text-white';
            IconComponent = Package;
          } else if (['REFERRAL_LINK_STATUS', 'REFERRAL_LINK_CLICKS'].includes(t.type)) {
            iconBg = 'bg-rose-500 text-white';
            IconComponent = Tag;
          } else if (t.type === 'PAYOUT_REQUEST_STATUS') {
            iconBg = 'bg-emerald-500 text-white';
            IconComponent = CreditCard;
          } else if (['NEW_LEAD', 'LEAD_STATUS_CHANGED'].includes(t.type)) {
            iconBg = 'bg-blue-500 text-white';
            IconComponent = Users;
          }

          return (
            <div
              key={t.toastId}
              onClick={() => handleNotificationClick(t)}
              className="pointer-events-auto flex items-start gap-3 p-4 bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.12)] border border-slate-100 hover:border-primary-100 cursor-pointer animate-in slide-in-from-bottom-5 fade-in duration-500 w-full relative group overflow-hidden"
            >
              {/* Premium Top Line Accent */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary-500 to-indigo-500" />
              
              {/* Icon */}
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md ${iconBg}`}>
                <IconComponent size={16} />
              </div>

              {/* Text info */}
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-[11px] font-black text-slate-900 leading-tight">
                  {t.title}
                </p>
                <p className="text-[10px] font-semibold text-slate-500 leading-normal mt-1">
                  {t.body}
                </p>
              </div>

              {/* Close Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setToasts(prev => prev.filter(toastItem => toastItem.toastId !== t.toastId));
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmData.onConfirm}
        title={confirmData.title}
        message={confirmData.message}
        type="danger"
        confirmText="Supprimer"
      />
    </div>
  );
}

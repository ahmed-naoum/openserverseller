import { useState, useEffect, useRef, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { translateNotification } from '../../utils/notificationTranslator';
import { dashboardApi, chatApi, notificationsApi, adminApi, youcanApi, shopifyApi, wooCommerceApi } from '../../lib/api';
import { waAgentApi } from '../../lib/waAgentApi';
import { VENDOR_HELPER_BASE, basePathFor, dashboardRootOf, isVendorTree } from '../../lib/dashboardBase';
import { accountIdOf, isReadOnlySubAccount, requiredPermissionForPage, subCan } from '../../lib/subAccountPermissions';
import toast from 'react-hot-toast';
import { useSocket } from '../../contexts/SocketContext';
import AnnouncementBanner from '../common/AnnouncementBanner';
import ProfileProgressBanner from '../common/ProfileProgressBanner';
import LanguageSwitcherWidget from '../common/LanguageSwitcherWidget';
import SheetCreditsIndicator from '../SheetCreditsIndicator';
import ConfirmationModal from '../ui/ConfirmationModal';
import { 
  Home, 
  Rocket, 
  Package, 
  FolderTree,
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
  KeyRound,
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
  Radio,
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
  Award,
  Mail,
  Network,
  Target,
  Music,
  Ghost,
  FileSpreadsheet,
  UserCog,
  ScrollText,
  BarChart3,
  Bot,
  Brain,
  Inbox,
  ClipboardList,
  Store,
  ArrowLeftRight,
  ArrowRight,
  ArrowLeft,
  CornerDownLeft,
  Sparkles,
  Palette,
  Layers
} from 'lucide-react';

/**
 * The vendor's own sidebar. A vendor sub-account renders the very same tree at
 * a different prefix (see `vendorHelperNav` below), so add new pages here once
 * and both dashboards pick them up.
 */
/**
 * `section` is a heading printed above the item whenever it differs from the
 * previous *rendered* item's section, so a heading survives any of its items
 * being permission- or entitlement-filtered away. Items without one belong to
 * no group (the dashboard link at the top).
 */
const vendorNav = [
    { name: 'nav_dashboard', href: '/dashboard', icon: Home },
    // ── Ventes ──
    {
      name: 'nav_seller_management',
      section: 'nav_section_sales',
      icon: ShoppingCart,
      children: [
        { name: 'nav_my_orders', href: '/dashboard/leads?mode=SELLER', icon: ShoppingCart },
        { name: 'nav_insert_lead', href: '/dashboard/leads/new?mode=SELLER', icon: Plus },
        { name: 'nav_my_links', href: '/dashboard/links', icon: Link2 },
      ]
    },
    {
      name: 'nav_affiliate_management',
      section: 'nav_section_sales',
      icon: ShoppingCart,
      children: [
        { name: 'nav_my_orders', href: '/dashboard/leads?mode=AFFILIATE', icon: ShoppingCart },
        { name: 'nav_insert_lead', href: '/dashboard/leads/new?mode=AFFILIATE', icon: Plus },
        { name: 'nav_my_links', href: '/dashboard/links', icon: Link2 },
      ]
    },
    // Literal label rather than an i18n key, matching 'Sous-comptes' below:
    // the nav renders the key verbatim when no translation exists.
    { name: 'Paniers abandonnés', section: 'nav_section_sales', href: '/dashboard/abandoned-carts', icon: ShoppingBag },
    { name: 'nav_inventory', section: 'nav_section_sales', href: '/dashboard/inventory', icon: Package },
    { name: 'nav_public_market', section: 'nav_section_sales', href: '/dashboard/marketplace', icon: Store },
    // ── Canaux ──
    {
      name: 'nav_youcan_integration',
      section: 'nav_section_channels',
      icon: Webhook,
      children: [
        { name: 'nav_youcan_connect', href: '/dashboard/integrations', icon: Link2 },
        { name: 'nav_youcan_leads', href: '/dashboard/youcan-leads', icon: Globe, integrationKey: 'youcan' },
        { name: 'nav_shopify_leads', href: '/dashboard/shopify-leads', icon: ShoppingBag, integrationKey: 'shopify' },
        { name: 'nav_woocommerce_leads', href: '/dashboard/woocommerce-leads', icon: ShoppingBag, integrationKey: 'woocommerce' },
        { name: 'nav_google_sheets_leads', href: '/dashboard/google-sheets-leads', icon: FileSpreadsheet, integrationKey: 'googleSheets' },
      ]
    },
    /* Hidden unless the account owns the entitlement — see `waAgent` below.
       Not an `integrationKey`: that flag reports whether a store is connected
       and only knows the three storefronts, so it would leave this group
       permanently visible. */
    {
      name: 'nav_whatsapp_agent',
      section: 'nav_section_channels',
      icon: Bot,
      children: [
        { name: 'nav_whatsapp_agent_config', href: '/dashboard/whatsapp-agent', icon: Bot },
        { name: 'nav_whatsapp_inbox', href: '/dashboard/whatsapp-inbox', icon: Inbox },
        { name: 'nav_whatsapp_leads', href: '/dashboard/whatsapp-leads', icon: ClipboardList },
      ]
    },
    {
      name: 'Ma Boutique',
      section: 'nav_section_channels',
      icon: Store,
      children: [
        { name: 'Aperçu & Lien', href: '/dashboard/store', icon: Globe },
        { name: 'Produits', href: '/dashboard/store/products', icon: Package },
        { name: 'Catégories', href: '/dashboard/store/categories', icon: FolderTree },
        { name: 'Identité & Contact', href: '/dashboard/store/settings', icon: Settings },
        { name: 'Thème & Couleurs', href: '/dashboard/store/theme', icon: Palette },
        { name: 'Collections', href: '/dashboard/store/collections', icon: Layers },
        { name: 'Pages & Politiques', href: '/dashboard/store/pages', icon: FileText },
      ]
    },
    { name: 'nav_domains', section: 'nav_section_channels', href: '/dashboard/domains', icon: Globe },
    {
      name: 'nav_pixels',
      section: 'nav_section_channels',
      icon: Target,
      children: [
        { name: 'nav_meta_pixels', href: '/dashboard/pixels/meta', icon: Target },
        { name: 'nav_google_pixels', href: '/dashboard/pixels/google', icon: Globe },
        { name: 'nav_tiktok_pixels', href: '/dashboard/pixels/tiktok', icon: Music },
        { name: 'nav_snapchat_pixels', href: '/dashboard/pixels/snapchat', icon: Ghost },
      ]
    },
    // ── Finances ──
    { name: 'nav_wallet', section: 'nav_section_finance', href: '/dashboard/wallet', icon: CreditCard },
    { name: 'nav_invoices', section: 'nav_section_finance', href: '/dashboard/invoices', icon: FileText },
    // ── Compte ──
    {
      name: 'nav_support_messages',
      section: 'nav_section_account',
      icon: MessageSquare,
      children: [
        { name: 'nav_support_tickets', href: '/dashboard/support', icon: MessageSquare },
        { name: 'nav_messages', href: '/dashboard/chat', icon: MessageSquare },
      ]
    },
    { name: 'Sous-comptes', section: 'nav_section_account', href: '/dashboard/sub-accounts', icon: UserCog },
    { name: 'nav_settings', section: 'nav_section_account', href: '/dashboard/settings', icon: Settings },
];

/**
 * Re-point a nav tree at another mount prefix. The sub-account dashboard is the
 * vendor dashboard served from `/vendor-agent-helper-dashboard`, and every href
 * in `vendorNav` is a literal, so they have to be rewritten rather than shared.
 */
const rebaseNav = (items: any[], base: string): any[] =>
  items.map((item) => ({
    ...item,
    ...(item.href ? { href: item.href.replace(/^\/dashboard/, base) } : {}),
    ...(item.children ? { children: rebaseNav(item.children, base) } : {}),
  }));

/**
 * A sub-account gets everything the vendor has except sub-account management —
 * only the account owner hands out permissions — and the WhatsApp agent, which
 * is mounted under /dashboard and /influencer only, so a rebased href would
 * point at a route that does not exist.
 */
const vendorHelperNav = rebaseNav(
  vendorNav.filter(
    (item) => item.href !== '/dashboard/sub-accounts' && item.name !== 'nav_whatsapp_agent',
  ),
  VENDOR_HELPER_BASE,
);

const navigation = {
  vendor: vendorNav,
  vendor_helper: vendorHelperNav,
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
    /* The influencer sidebar is its own array — nothing is mirrored from
       `vendorNav` — so the agent has to be repeated here, pointed at the
       /influencer mount of the same two pages. Entitlement-gated identically. */
    {
      name: 'nav_whatsapp_agent',
      icon: Bot,
      children: [
        { name: 'nav_whatsapp_agent_config', href: '/influencer/whatsapp-agent', icon: Bot },
        { name: 'nav_whatsapp_inbox', href: '/influencer/whatsapp-inbox', icon: Inbox },
        { name: 'nav_whatsapp_leads', href: '/influencer/whatsapp-leads', icon: ClipboardList },
      ]
    },
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
    { name: 'Mes Statistiques', href: '/agent/statistics', icon: BarChart3 },
    { name: 'Réclamer Leads', href: '/agent/leads', icon: Zap },
    { name: 'Leads Assignés', href: '/agent/assigned-leads', icon: Users },
    { name: 'WhatsApp Leads', href: '/agent/insert-lead', icon: Plus },
    { name: 'Paniers Abandonnés', href: '/agent/live-stream-paniers', icon: ShoppingCart },
    { name: 'Livraison', href: '/agent/livraison', icon: Truck },
    { name: 'Facturation', href: '/agent/facturation', icon: FileText },
    { name: 'Paramètres', href: '/agent/settings', icon: Settings },
  ],
  admin: [
    { name: 'Tableau de bord', href: '/admin', icon: Home },
    { name: 'Tous les Leads', section: 'Opérations', href: '/admin/leads', icon: Users },
    { name: 'Masterclass Invitations', section: 'Opérations', href: '/admin/event-registrations', icon: Users },
    { name: 'Gestion des Liens', section: 'Opérations', href: '/admin/links', icon: Link2 },
    {
      name: 'Gestion Utilisateurs',
      section: 'Gestion',
      icon: Users,
      children: [
        { name: 'Utilisateurs', href: '/admin/users', icon: Users },
        { name: 'Affiliation Helpers', href: '/admin/helpers-affiliate', icon: Award },
        { name: 'Vérifications', href: '/admin/verifications', icon: ShieldCheck },
        { name: 'Inspect Call Center', href: '/admin/call-center-inspector', icon: Headphones },
        { name: 'Analytics Call Center', href: '/admin/call-center-analytics', icon: BarChart3 },
        { name: 'Inspecteur Comptes', href: '/admin/influencer-inspector', icon: Crown },
        { name: 'Inspecteur Support', href: '/admin/support-inspector', icon: MessageSquare },
      ]
    },
    {
      name: 'Catalogue Produits',
      section: 'Gestion',
      icon: Package,
      children: [
        { name: 'Produits', href: '/admin/products', icon: Package },
        { name: 'Catégories', href: '/admin/categories', icon: Tag },
        { name: 'Demande Produit', href: '/admin/affiliate-claims', icon: UserCheck },
      ]
    },
    {
      name: 'Finance & Paiements',
      section: 'Gestion',
      icon: DollarSign,
      children: [
        { name: 'Finance', href: '/admin/finance', icon: DollarSign },
        { name: 'Suivi Paiements', href: '/admin/payment-monitoring', icon: CreditCard },
        { name: 'Factures', href: '/admin/invoices', icon: FileText },
        { name: 'nav_sheet_pushes', href: '/admin/sheet-pushes', icon: FileSpreadsheet },
      ]
    },
    /* SUPER_ADMIN-only, like Secrets and Déploiement: the two pages behind it
       are refused for the other admin roles, so the links are hidden for them
       further down rather than left to lead into a RoleGuard. */
    {
      name: 'nav_whatsapp_agent_admin',
      section: 'Gestion',
      icon: Bot,
      children: [
        { name: 'nav_ai_models', href: '/admin/ai-models', icon: Brain },
        { name: 'nav_agent_accounts', href: '/admin/agent-accounts', icon: UserCog },
        { name: 'nav_agent_logs', href: '/admin/agent-logs', icon: ScrollText },
      ]
    },
    { name: 'Marché Public', section: 'Gestion', href: '/admin/marketplace', icon: Store },
    {
      name: 'Support & Messages',
      section: 'Support',
      icon: MessageSquare,
      children: [
        { name: 'Support & Tickets', href: '/admin/support', icon: MessageSquare },
        { name: 'Messages', href: '/admin/chat', icon: MessageSquare },
        { name: 'Messages de Contact', href: '/admin/contact-messages', icon: Mail },
      ]
    },
    {
      name: 'Outils & Système',
      section: 'Système',
      icon: Shield,
      children: [
        { name: 'Annonces', href: '/admin/announcements', icon: Bell },
        { name: 'Emails Professionnels', href: '/admin/professional-emails', icon: Mail },
        { name: 'Scanner Retour', href: '/admin/scanner', icon: ScanLine },
        { name: 'Webhooks Coliaty', href: '/admin/webhook-logs', icon: Webhook },
        { name: 'Journaux d\'Activité', href: '/admin/activity-logs', icon: History },
        { name: 'Architecture Plateforme', href: '/admin/architecture', icon: Network },
        { name: '🔴 Streaming Direct', href: '/admin/live-stream', icon: Radio },
        { name: 'Sauvegardes DB', href: '/admin/backups', icon: Database },
      ]
    },
    {
      name: 'Sécurité',
      section: 'Système',
      icon: ShieldAlert,
      children: [
        { name: 'Paramètres Plateforme', href: '/admin/platform-settings', icon: Shield },
        { name: 'Variables & Secrets', href: '/admin/secrets', icon: KeyRound },
        { name: 'Déploiement', href: '/admin/deployments', icon: Rocket },
        { name: 'Sécurité & Firewall', href: '/admin/security', icon: ShieldAlert },
      ]
    },
    { name: 'Paramètres', section: 'Système', href: '/admin/settings', icon: Settings },
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
        { name: 'Système d\'Affiliation', href: '/helper/affiliate', icon: Link2 },
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
  // "Collapsed" is the icon dock, and it is the default: only an explicit
  // expand (stored as 'false') opens the labelled panel.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') !== 'false'; } catch { return true; }
  });
  /* The dock's pop-out panel for a group: which group, and where along the
     dock it sits (offset from the dock's top, so the panel can be positioned
     as a sibling of the scrolling list rather than inside it, where the
     scroller would clip it). Closed with a short grace period so the pointer
     can cross the gap between the icon and the panel. */
  const [dockPanel, setDockPanel] = useState<{ name: string; top: number } | null>(null);
  const dockCloseTimer = useRef<number | null>(null);
  const asideRef = useRef<HTMLElement>(null);
  const cancelDockClose = () => {
    if (dockCloseTimer.current) { window.clearTimeout(dockCloseTimer.current); dockCloseTimer.current = null; }
  };
  const openDock = (name: string, el: HTMLElement) => {
    cancelDockClose();
    const a = asideRef.current?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const asideH = a?.height ?? window.innerHeight;
    // Keep the panel inside the dock's own height; 340px is a generous panel.
    const top = Math.max(8, Math.min(r.top - (a?.top ?? 0), asideH - 340));
    setDockPanel({ name, top });
  };
  const scheduleDockClose = () => {
    cancelDockClose();
    dockCloseTimer.current = window.setTimeout(() => setDockPanel(null), 180);
  };
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const [toasts, setToasts] = useState<any[]>([]);

  // Integration Connection Statuses for Dynamic Subnav
  const [integrationsStatus, setIntegrationsStatus] = useState({
    youcan: false,
    shopify: false,
    woocommerce: false,
  });

  useEffect(() => {
    if (user?.role === 'VENDOR' || user?.role === 'VENDOR_HELPER') {
      Promise.all([
        youcanApi.getStatus().catch(() => null),
        shopifyApi.getStatus().catch(() => null),
        wooCommerceApi.getStatus().catch(() => null),
      ]).then(([youcanRes, shopifyRes, wooRes]) => {
        const ycConnected = !!(youcanRes?.data?.data?.isConnected ?? youcanRes?.data?.isConnected);
        const sfConnected = !!(shopifyRes?.data?.data?.isConnected ?? shopifyRes?.data?.isConnected);
        const wcConnected = !!(wooRes?.data?.data?.isConnected ?? wooRes?.data?.isConnected);
        setIntegrationsStatus({
          youcan: ycConnected,
          shopify: sfConnected,
          woocommerce: wcConnected,
        });
      });
    }
  }, [user?.role, location.pathname]);

  /* WhatsApp AI agent entitlement.
     A separate concern from `integrationsStatus`: that asks whether a store is
     connected, this asks whether the account may see the feature at all. The
     endpoint never 403s — an account without the entitlement is answered
     `{ enabled: false }` — so a failed request simply leaves the default and
     the menu group stays hidden. */
  const [waAgent, setWaAgent] = useState<{ enabled: boolean; unread: number }>({
    enabled: false,
    unread: 0,
  });

  useEffect(() => {
    if (user?.role !== 'VENDOR' && user?.role !== 'INFLUENCER') return;
    let cancelled = false;
    waAgentApi
      .status()
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data ?? {};
        setWaAgent({ enabled: !!data.enabled, unread: Number(data.unread) || 0 });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.role, location.pathname]);

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

  const playBellDingSound = () => {
    try {
      const audio = new Audio('/soundes/bell-ding.mp3');
      audio.volume = 0.85;
      audio.play().catch(err => {
        console.warn('Playback blocked:', err);
      });
    } catch (err) {}
  };

  const playCorrectConfirmationSound = () => {
    try {
      const audio = new Audio('/soundes/correct-confirmation.mp3');
      audio.volume = 0.85;
      audio.play().catch(err => {
        console.warn('Playback blocked:', err);
      });
    } catch (err) {}
  };

  const playErrorSound = () => {
    try {
      const audio = new Audio('/soundes/error.mp3');
      audio.volume = 0.85;
      audio.play().catch(err => {
        console.warn('Playback blocked:', err);
      });
    } catch (err) {}
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
    // Trust the tree the user is actually browsing before the role: a vendor and
    // its sub-account share every page, and only the URL tells the two apart.
    const fromUrl = dashboardRootOf(location.pathname);
    if (fromUrl) return fromUrl;
    const role = user.role;
    if (['SUPER_ADMIN', 'FINANCE_ADMIN', 'SYSTEM_SUPPORT'].includes(role)) {
      return '/admin';
    }
    if (role === 'VENDOR_HELPER') {
      return VENDOR_HELPER_BASE;
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
      // Chat is served as the parent vendor, so a sub-account's own sends come
      // back under the vendor id — comparing to user.id would make the helper
      // notify itself for its own messages.
      const isMyMessage = data.message.sender.id === accountIdOf(user);
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
      
      const titleLower = (notification.title || '').toLowerCase();
      const msgLower = (notification.message || '').toLowerCase();

      const isRefusedOrCancelled = titleLower.includes('refusé') ||
                                  titleLower.includes('refusée') ||
                                  titleLower.includes('rejeté') ||
                                  titleLower.includes('rejetée') ||
                                  titleLower.includes('annulé') ||
                                  titleLower.includes('annulée') ||
                                  msgLower.includes('refusé') ||
                                  msgLower.includes('refusée') ||
                                  msgLower.includes('rejeté') ||
                                  msgLower.includes('rejetée') ||
                                  msgLower.includes('annulé') ||
                                  msgLower.includes('annulée');

      const isNewSaleForVendor = notification.title?.includes('Nouvelle vente') ||
                                msgLower.includes('vous avez reçu un nouveau lead') ||
                                notification.type === 'NEW_LEAD';

      const isConfirmed = msgLower.includes('confirmé') ||
                          msgLower.includes('confirmed') ||
                          titleLower.includes('confirmé');

      const isAvailableLeadDrop = msgLower.includes('nouveau lead disponible') ||
                                  titleLower.includes('nouveau lead disponible');

      // Play sound based on notification type
      if (isRefusedOrCancelled) {
        playErrorSound();
      } else if (isNewSaleForVendor) {
        playMoneySound();
      } else if (isConfirmed) {
        playCorrectConfirmationSound();
      } else if (isAvailableLeadDrop) {
        playBellDingSound();
      } else {
        playChime();
      }

      // Show browser system notification
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(notification.title || (isConfirmed ? '📈 Statut du lead mis à jour : CONFIRMÉ' : '🔔 Notification - Silacod'), {
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

    // The backend emits this after a push charge and after an admin grant. The
    // 60s poll in SheetCreditsIndicator is only the floor — this is what makes
    // the "$" chip move the instant a credit is spent or sold.
    const handleSheetCredits = () => {
      queryClient.invalidateQueries({ queryKey: ['sheet-credits'] });
    };

    socket.on('new-message', handleNewMessage);
    socket.on('new-support-ticket', handleNewTicket);
    socket.on('conversation-claimed', handleClaimed);
    socket.on('new-notification', handleNewNotification);
    socket.on('sheet-credits', handleSheetCredits);

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
      socket.off('sheet-credits', handleSheetCredits);
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

  /**
   * Whether a nav href is the page being viewed. Several vendor links carry a
   * query string (`/dashboard/leads?mode=SELLER`) and a bare pathname compare
   * never matched them, so "Mes commandes" was never highlighted. The path has
   * to match exactly; every query key the href names has to match too, keys
   * the href does not name are ignored.
   */
  const isHrefActive = (href?: string): boolean => {
    if (!href) return false;
    const [path, query] = href.split('?');
    if (path !== location.pathname) return false;
    if (!query) return true;
    const have = new URLSearchParams(location.search);
    return Array.from(new URLSearchParams(query).entries()).every(([k, v]) => have.get(k) === v);
  };

  // Auto-expand if child is active
  useEffect(() => {
    const activeParent = navItems.find((item: any) =>
      item.children?.some((child: any) => isHrefActive(child.href))
    );
    if (activeParent && !expandedGroups.includes(activeParent.name)) {
      setExpandedGroups(prev => [...prev, activeParent.name]);
    }
  }, [location.pathname, location.search]);

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
    if (location.pathname.startsWith(VENDOR_HELPER_BASE)) return navigation.vendor_helper;
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

  // True in both vendor trees — the vendor's own and a sub-account's — because
  // they share the Vendeur/Affilié mode switching and the same page set.
  const isVendorHelperDashboard = location.pathname.startsWith(VENDOR_HELPER_BASE);
  const isVendorDashboard = isVendorTree(location.pathname);
  const currentMode = user?.mode || 'SELLER';

  // Permission check for individual nav items (works on both top-level and children)
  const isHelperItemAllowed = (item: any): boolean => {
    // Vendor sub-accounts: each page is a grant the vendor turns on. The map
    // lives in lib/subAccountPermissions so the sidebar and SubAccountGuard
    // (which blocks the URL) can never disagree about what a page needs.
    if (user?.role === 'VENDOR_HELPER') {
      if (!item.href) return true;
      const page = item.href.replace(VENDOR_HELPER_BASE, '').split('?')[0] || '/';
      const needed = requiredPermissionForPage(page);
      return !needed || subCan(user, needed);
    }
    if (user?.role !== 'HELPER') return true;
    if (item.href === '/helper/users') return !!user?.canImpersonate;
    if (item.href === '/helper/affiliate') return !!user?.canManageAffiliateInvites;
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
        const filteredChildren = item.children
          .filter((child: any) => isHelperItemAllowed(child))
          .filter((child: any) => {
            if (child.integrationKey === 'youcan') return integrationsStatus.youcan;
            if (child.integrationKey === 'shopify') return integrationsStatus.shopify;
            if (child.integrationKey === 'woocommerce') return integrationsStatus.woocommerce;
            return true;
          });
        // A group whose children were all permission-filtered away would render
        // as an empty, unclickable accordion header.
        if (['HELPER', 'VENDOR_HELPER'].includes(user?.role || '') && filteredChildren.length === 0) return null;
        return { ...item, children: filteredChildren };
      }
      // For flat items, check directly
      if (!isHelperItemAllowed(item)) return null;
      return item;
    })
    .filter((item: any) => item !== null)
    .map((item: any) => {
      // Secrets and deployment management are SUPER_ADMIN-only; hide the links
      // rather than let them lead to a page the RoleGuard will refuse.
      if (!item?.children) return item;
      if (user?.role === 'SUPER_ADMIN') return item;
      return {
        ...item,
        children: item.children.filter(
          (child: any) =>
            child?.href !== '/admin/secrets' && child?.href !== '/admin/deployments',
        ),
      };
    })
    .filter((item: any) => {
      if (item.href === '/admin/backups' && user?.role !== 'SUPER_ADMIN') return false;
      // The admin AI console is SUPER_ADMIN-only; drop the whole group rather
      // than leave an accordion whose children have all been filtered away.
      if (item.name === 'nav_whatsapp_agent_admin' && user?.role !== 'SUPER_ADMIN') return false;
      // Hidden, not disabled: an account without the entitlement never sees the
      // agent at all.
      if (item.name === 'nav_whatsapp_agent' && !waAgent.enabled) return false;
      // Filter by mode for vendor dashboard
      if (isVendorDashboard) {
        if (item.name === 'nav_seller_management') return currentMode === 'SELLER';
        if (item.name === 'nav_affiliate_management') return currentMode === 'AFFILIATE';
      }
      return true;
    });

  // Current page for the breadcrumb: a top-level link, or a group child (in
  // which case the group name is the middle crumb).
  const activeTrail = (() => {
    for (const item of navItems as any[]) {
      if (isHrefActive(item.href)) return { page: item, parent: null as any };
      const child = item.children?.find((c: any) => isHrefActive(c.href));
      if (child) return { page: child, parent: item };
    }
    return { page: null as any, parent: null as any };
  })();
  const currentPage = activeTrail.page;

  // Every reachable page as a flat list — groups contribute their children —
  // so the palette can find "Mes commandes" and not only its parent group.
  const flatPages = (navItems as any[]).flatMap((item: any) =>
    item.children
      ? item.children.map((c: any) => ({ ...c, parentName: item.name }))
      : item.href
      ? [item]
      : [],
  );
  // `dot` is the workspace colour as a small disc — used in the breadcrumb and
  // the sidebar's workspace card, which sits on a dark ground where a tinted
  // chip would not read.
  const getCurrentSection = () => {
    if (location.pathname.startsWith('/admin')) return { label: 'Admin', dot: 'bg-rose-500' };
    if (location.pathname.startsWith('/agent')) return { label: 'Agent', dot: 'bg-blue-500' };
    if (location.pathname.startsWith('/grosseller')) return { label: 'Grossiste', dot: 'bg-emerald-500' };
    if (location.pathname.startsWith('/influencer')) return { label: 'Influenceur', dot: 'bg-purple-500' };
    if (location.pathname.startsWith('/confirmation')) return { label: 'Confirmation', dot: 'bg-teal-500' };
    if (location.pathname.startsWith('/helper')) return { label: 'Helper', dot: 'bg-orange-500' };
    if (isVendorHelperDashboard) {
      return {
        label: currentMode === 'AFFILIATE' ? 'Affilié · Assistant' : 'Vendeur · Assistant',
        dot: 'bg-amber-500',
      };
    }
    return {
      label: currentMode === 'AFFILIATE' ? 'Affilié' : 'Vendeur',
      dot: currentMode === 'AFFILIATE' ? 'bg-accent-500' : 'bg-primary-400',
    };
  };
  const section = getCurrentSection();

  // Search results: matched on the translated label as well as the key, since
  // the seller types what they see on screen, not `nav_my_orders`.
  const filteredNavItems = searchQuery
    ? flatPages.filter((item: any) => {
        const q = searchQuery.toLowerCase();
        const label = t(item.name, 'dashboard').toLowerCase();
        const parent = item.parentName ? t(item.parentName, 'dashboard').toLowerCase() : '';
        return label.includes(q) || item.name.toLowerCase().includes(q) || parent.includes(q);
      })
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

  // Close the mobile drawer and any dock panel on route change
  useEffect(() => {
    setSidebarOpen(false);
    setDockPanel(null);
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
    if (isVendorHelperDashboard) {
      return currentMode === 'AFFILIATE' ? 'Affilié (Assistant)' : 'Vendeur (Assistant)';
    }
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
    : originalUserRole === 'VENDOR_HELPER'
    ? 'Retourner à mon compte Assistant'
    : 'Retourner à mon compte';

  /* ───────────────────────── Presentation helpers ───────────────────────── */

  // Labels are hidden only in the desktop icon dock; the mobile drawer is
  // always the full labelled panel.
  const showLabels = !sidebarCollapsed || sidebarOpen;
  const isDock = sidebarCollapsed && !sidebarOpen;
  const isInfluencer = location.pathname.startsWith('/influencer');
  const homeHref = getRolePrefix() || '/';

  /**
   * Every unread counter that belongs on a nav entry, whether the entry is a
   * page or the group holding it. One place, so the dock, the pop-out panel
   * and the tooltip can never disagree about what a badge means.
   */
  const badgesFor = (item: any): { count: number; tone: string }[] => {
    const hrefs: string[] = [item.href, ...(item.children?.map((c: any) => c.href) || [])].filter(Boolean);
    const has = (s: string) => hrefs.some((h) => h.includes(s));
    const out: { count: number; tone: string }[] = [];
    if (has('/chat') && totalUnread > 0) out.push({ count: totalUnread, tone: 'bg-rose-500' });
    if (has('/support') && queueCount > 0) out.push({ count: queueCount, tone: 'bg-amber-500' });
    if (has('/affiliate-claims') && pendingClaimsCount > 0) out.push({ count: pendingClaimsCount, tone: 'bg-violet-500' });
    if (has('/whatsapp-inbox') && waAgent.unread > 0) out.push({ count: waAgent.unread, tone: 'bg-emerald-500' });
    if (isInfluencer) {
      if (item.href === '/influencer/inventory' && inventoryUnreadCount > 0) out.push({ count: inventoryUnreadCount, tone: 'bg-purple-500' });
      if (item.href === '/influencer/links' && linksUnreadCount > 0) out.push({ count: linksUnreadCount, tone: 'bg-rose-500' });
      if (item.href === '/influencer/wallet' && walletUnreadCount > 0) out.push({ count: walletUnreadCount, tone: 'bg-emerald-500' });
      if (item.href === '/influencer/leads' && leadsUnreadCount > 0) out.push({ count: leadsUnreadCount, tone: 'bg-blue-500' });
    }
    return out;
  };

  const badge = (b: { count: number; tone: string }, key: number) => (
    <span key={key} className={`${b.tone} text-white text-[10px] font-semibold leading-none min-w-[18px] h-[18px] px-1.5 rounded-full inline-flex items-center justify-center tabular-nums shadow-sm`}>
      {b.count > 99 ? '99+' : b.count}
    </span>
  );

  const notifIcon = (type: string) => {
    if (type === 'PRODUCT_CLAIM_STATUS') return { bg: 'bg-purple-100 text-purple-600', Icon: Package };
    if (['REFERRAL_LINK_STATUS', 'REFERRAL_LINK_CLICKS'].includes(type)) return { bg: 'bg-rose-100 text-rose-600', Icon: Tag };
    if (type === 'PAYOUT_REQUEST_STATUS') return { bg: 'bg-emerald-100 text-emerald-600', Icon: CreditCard };
    if (['NEW_LEAD', 'LEAD_STATUS_CHANGED'].includes(type)) return { bg: 'bg-blue-100 text-blue-600', Icon: Users };
    return { bg: 'bg-slate-100 text-slate-500', Icon: Bell };
  };

  const Crumb = isRtl ? ChevronLeft : ChevronRight;
  const iconBtn =
    'h-9 w-9 inline-flex items-center justify-center rounded-xl border border-transparent bg-slate-100/70 text-slate-500 hover:bg-white hover:border-slate-200 hover:text-primary-700 hover:shadow-sm transition-all';
  const glass =
    'bg-white/75 backdrop-blur-xl border border-white/70 shadow-[0_10px_40px_-14px_rgba(17,19,68,0.28)]';
  /**
   * The nav's accent, as a bare RGB triple for `rgb(... / <alpha>)`.
   * It matches the colour of the active mode's pill in the switch above —
   * coral in Affilié, brand navy in Vendeur — so hovering or selecting a
   * page reads as the same workspace the seller is standing in. Every
   * other dashboard tree has no mode, so it takes the navy.
   * See `.sc-nav-item` in styles/dashboard-skin.css.
   */
  const navAccent =
    isVendorDashboard && currentMode === 'AFFILIATE' ? '242 99 66' : '37 40 104';

  /**
   * Where each item's running border starts its lap.
   *
   * The animation is driven by a conic gradient, which always begins at 12
   * o'clock, so every item would light up from the same spot. Feeding the
   * two animations a NEGATIVE delay starts them part-way through a cycle,
   * which puts the head at an arbitrary point on the rim.
   *
   * The phase is hashed from the item's name plus a salt fixed for this
   * page load: stable across re-renders (a fresh `Math.random()` each
   * render would make the light jump), different for every item, and
   * different again the next time the app is opened.
   */
  const phaseSalt = useRef(Math.random().toString(36).slice(2)).current;
  const navPhase = (name: string) => {
    let h = 2166136261;
    const key = name + phaseSalt;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const a = ((h >>> 0) % 1000) / 1000;
    const b = ((h >>> 9) % 1000) / 1000;
    return {
      ['--sc-delay' as any]: `-${(a * 4.3).toFixed(2)}s`,
      ['--sc-delay-2' as any]: `-${(b * 2.9).toFixed(2)}s`,
    };
  };

  // The group whose pop-out panel is open on the dock, resolved to its item.
  const dockGroup = dockPanel ? (navItems as any[]).find((i: any) => i.name === dockPanel.name) : null;

  // Track the previous rendered section so a heading prints once per run,
  // even when the item that "owns" it was filtered out.
  let lastSection: string | null = null;

  const childRow = (child: any, compact = false) => {
    const on = isHrefActive(child.href);
    const cb = badgesFor(child);
    const CIcon = child.icon;
    return (
      <Link
        key={child.name}
        to={child.href}
        data-active={on}
        className={`sc-nav-child flex items-center gap-2.5 ${compact ? 'h-9 px-2.5' : 'h-9 px-3'} rounded-xl text-[13px] ${
          on ? '' : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        {/* No colour class when active: the icon inherits the accent. */}
        <CIcon size={15} className={on ? '' : 'text-slate-400'} />
        <span className="truncate flex-1">{t(child.name, 'dashboard')}</span>
        {cb.map(badge)}
      </Link>
    );
  };

  return (
    <div
      className="min-h-screen bg-[#F4F5FA] font-['29LT_Kaff',_Cairo,_Inter,_sans-serif] text-slate-900"
      style={{
        backgroundImage:
          'radial-gradient(55% 45% at 0% 0%, rgba(44,47,116,0.10), transparent 62%), radial-gradient(45% 40% at 100% 100%, rgba(242,99,66,0.12), transparent 60%), radial-gradient(35% 35% at 85% 10%, rgba(217,70,239,0.06), transparent 60%)',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="bg-rose-600 text-white text-center py-2 px-4 sticky top-0 z-[100] flex items-center justify-center gap-4">
          <span className="font-semibold text-sm">
            Mode Assistance (Lecture Seule) : connecté en tant que {user?.fullName || user?.email || 'un utilisateur'}. Aucune action n'est autorisée.
          </span>
          <button
            onClick={revertImpersonation}
            className="bg-white/15 hover:bg-white/25 px-3 py-1 rounded-md text-sm font-semibold transition-colors"
          >
            {revertButtonLabel}
          </button>
        </div>
      )}
      {/* Read-only sub-account: say so up front, rather than letting every
          action fail with a 403 the user has to interpret. */}
      {isReadOnlySubAccount(user) && (
        <div className="bg-sky-600 text-white text-center py-2 px-4 sticky top-0 z-[99] flex items-center justify-center gap-2">
          <Eye size={16} />
          <span className="font-semibold text-sm">
            Mode lecture seule : vous pouvez tout consulter, mais aucune modification n'est autorisée.
          </span>
        </div>
      )}

      {/* Mobile drawer overlay */}
      {sidebarOpen && (
        <div
          data-sidebar-overlay
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[9990] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ─────────────────── Floating dock / panel ─────────────────── */}
      <aside
        ref={asideRef}
        style={{ ['--nav-accent' as any]: navAccent }}
        className={`fixed z-[9999] flex flex-col transition-all duration-300 ease-out
          ${isRtl ? 'right-0 lg:right-3' : 'left-0 lg:left-3'} top-0 bottom-0 lg:top-3 lg:bottom-3
          ${sidebarCollapsed ? 'lg:w-[68px]' : 'lg:w-[252px]'} w-[280px]
          bg-white lg:bg-white/80 lg:backdrop-blur-md lg:rounded-[22px] border border-white/70 shadow-[0_10px_40px_-14px_rgba(17,19,68,0.35)]
          lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : (isRtl ? 'translate-x-full' : '-translate-x-full')}
        `}
        onMouseLeave={scheduleDockClose}
      >
        {/* Brand. The wordmark alone, centred — the icon tile beside it was
            saying the same thing twice. The collapsed dock is the exception:
            at 68px wide there is no room for a wordmark, so it falls back to
            the mark on its own. */}
        <div className={`shrink-0 relative flex items-center justify-center px-4 pt-4 ${isDock ? 'lg:px-0' : ''}`}>
          <Link to={homeHref} dir="ltr" className="flex items-center justify-center group/brand" aria-label="SILACOD">
            {isDock ? (
              <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-800 via-primary-600 to-primary-500 flex items-center justify-center shadow-lg shadow-primary-600/30 transition-transform group-hover/brand:scale-105">
                <img src="/new logo/logo filess-25.svg" alt="" className="w-6 h-6 object-contain brightness-0 invert" />
              </span>
            ) : (
              <img
                src="/new logo/logo filess-24.svg"
                alt="SILACOD"
                className="h-5 w-auto transition-transform group-hover/brand:scale-[1.03]"
              />
            )}
          </Link>
          {/* Absolutely placed so it cannot pull the wordmark off centre. */}
          <button
            onClick={() => setSidebarOpen(false)}
            className={`lg:hidden absolute top-4 ${isRtl ? 'left-3' : 'right-3'} h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors`}
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Workspace: the Vendeur / Affilié switch for vendor trees, a plain
            label everywhere else. Icon dock: a single orb that toggles. */}
        <div className={`shrink-0 ${isDock ? 'lg:px-3 lg:pt-3 px-4 pt-4' : 'px-4 pt-4'}`}>
          {isVendorDashboard ? (
            showLabels ? (
              <div className="grid grid-cols-2 gap-0.5 p-1 rounded-2xl bg-slate-100/80">
                <button
                  type="button"
                  onClick={currentMode === 'SELLER' ? undefined : handleSwitchMode}
                  /* Flat blue for Vendeur, flat coral for Affilié. Solid
                     fills, not gradients: at pill size a gradient just reads
                     as an unevenly lit block. */
                  className={`h-8 rounded-xl text-xs font-semibold transition-all ${
                    currentMode === 'SELLER'
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {t('nav_mode_seller', 'dashboard', 'Vendeur')}
                </button>
                <button
                  type="button"
                  onClick={currentMode === 'AFFILIATE' ? undefined : handleSwitchMode}
                  className={`h-8 rounded-xl text-xs font-semibold transition-all ${
                    currentMode === 'AFFILIATE' ? 'bg-accent-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {t('nav_mode_affiliate', 'dashboard', 'Affilié')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSwitchMode}
                title={currentMode === 'AFFILIATE' ? t('nav_mode_affiliate', 'dashboard', 'Affilié') : t('nav_mode_seller', 'dashboard', 'Vendeur')}
                className={`group/mode relative mx-auto flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-bold transition-all hover:scale-105 ${
                  currentMode === 'AFFILIATE'
                    ? 'bg-accent-500 text-white shadow-md shadow-accent-500/25'
                    : 'bg-primary-600 text-white shadow-md shadow-primary-600/25'
                }`}
              >
                {currentMode === 'AFFILIATE' ? 'A' : 'V'}
                <span className={`absolute ${isRtl ? 'right-full mr-3' : 'left-full ml-3'} top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover/mode:opacity-100 pointer-events-none transition-opacity shadow-lg`}>
                  {currentMode === 'AFFILIATE' ? t('nav_mode_affiliate', 'dashboard', 'Affilié') : t('nav_mode_seller', 'dashboard', 'Vendeur')}
                  <ArrowLeftRight size={11} className="inline ml-1.5 -mt-0.5 opacity-70" />
                </span>
              </button>
            )
          ) : showLabels ? (
            <div className="flex items-center gap-2.5 rounded-2xl bg-slate-100/80 px-3 py-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${section.dot}`} />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-slate-400 leading-none">{t('nav_workspace', 'dashboard', 'Espace de travail')}</p>
                <p className="text-xs font-semibold text-slate-900 truncate mt-1">{section.label}</p>
              </div>
            </div>
          ) : (
            <div className="mx-auto h-1.5 w-8 rounded-full bg-slate-200/80" title={section.label}>
              <div className={`h-full w-1/2 rounded-full ${section.dot}`} />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className={`flex-1 min-h-0 overflow-y-auto scrollbar-hide ${isDock ? 'lg:px-3 lg:py-3 px-3 py-3' : 'px-3 py-3'}`}>
          {navItems.map((item) => {
            const it = item as any;
            const hasChildren = it.children && it.children.length > 0;
            const isExpanded = expandedGroups.includes(it.name);
            const childActive = hasChildren && it.children.some((c: any) => isHrefActive(c.href));
            const isActive = isHrefActive(it.href) || childActive;
            const Icon = it.icon;
            const badges = badgesFor(it);
            const label = t(it.name, 'dashboard');
            const panelOpen = dockPanel?.name === it.name;

            const sec: string | null = it.section || null;
            const showSection = !!sec && sec !== lastSection;
            lastSection = sec;

            /* Dock tile: a square, icon only; hover reveals a label tooltip
               for a page and the pop-out panel for a group. */
            const tileClass = `sc-nav-item group relative flex items-center justify-center h-11 w-11 mx-auto rounded-2xl ${
              isActive ? '' : panelOpen ? 'text-primary-700' : 'text-slate-500 hover:text-primary-700'
            }`;

            /* Panel row: icon + label, full width. */
            const rowClass = `sc-nav-item group relative w-full flex items-center gap-3 h-10 px-3 rounded-xl text-[13px] font-medium ${
              isActive ? '' : 'text-slate-600 hover:text-slate-900'
            }`;

            const dockTile = (
              <>
                <Icon size={19} strokeWidth={isActive ? 2.2 : 1.9} />
                {badges.length > 0 && (
                  <span className={`absolute -top-1 ${isRtl ? '-left-1' : '-right-1'} min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-r from-accent-500 to-rose-500 text-white text-[10px] font-semibold leading-none flex items-center justify-center ring-2 ring-white tabular-nums`}>
                    {badges.reduce((s, b) => s + b.count, 0)}
                  </span>
                )}
                {!hasChildren && (
                  <span className={`absolute ${isRtl ? 'right-full mr-3' : 'left-full ml-3'} top-1/2 -translate-y-1/2 flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[100] shadow-lg`}>
                    {label}
                    {badges.map(badge)}
                  </span>
                )}
              </>
            );

            const panelRow = (
              <>
                <Icon size={18} strokeWidth={isActive ? 2.2 : 1.9} className={isActive ? '' : 'text-slate-400 group-hover:text-primary-600 transition-colors'} />
                <span className="flex-1 flex items-center justify-between gap-2 min-w-0">
                  <span className="truncate">{label}</span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {badges.map(badge)}
                    {hasChildren && (
                      <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} ${isActive ? 'opacity-80' : 'text-slate-400'}`} />
                    )}
                  </span>
                </span>
              </>
            );

            return (
              <div key={it.name} className="relative">
                {showSection && (
                  showLabels ? (
                    <p className="px-3 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 select-none">
                      {t(sec as string, 'dashboard')}
                    </p>
                  ) : (
                    <div className="mx-3 my-2 h-px bg-slate-200/80" />
                  )
                )}

                {/* Desktop icon dock */}
                {isDock && (
                  <div
                    className="hidden lg:block py-0.5"
                    onMouseEnter={(e) => hasChildren ? openDock(it.name, e.currentTarget) : cancelDockClose()}
                    onMouseLeave={hasChildren ? scheduleDockClose : undefined}
                  >
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={(e) => (panelOpen ? setDockPanel(null) : openDock(it.name, e.currentTarget))}
                        className={tileClass}
                        data-active={isActive}
                        style={navPhase(it.name)}
                        aria-label={label}
                      >
                        {dockTile}
                      </button>
                    ) : (
                      <Link to={it.href || '#'} className={tileClass} data-active={isActive} style={navPhase(it.name)} aria-label={label}>
                        {dockTile}
                      </Link>
                    )}
                  </div>
                )}

                {/* Labelled panel (desktop expanded, and the mobile drawer) */}
                <div className={isDock ? 'lg:hidden' : ''}>
                  {hasChildren ? (
                    <button onClick={() => toggleGroup(it.name)} type="button" className={rowClass} data-active={isActive} style={navPhase(it.name)}>
                      {panelRow}
                    </button>
                  ) : (
                    <Link to={it.href || '#'} className={rowClass} data-active={isActive} style={navPhase(it.name)}>
                      {panelRow}
                    </Link>
                  )}
                  {hasChildren && isExpanded && (
                    <div className={`${isRtl ? 'mr-4 pr-2 border-r' : 'ml-4 pl-2 border-l'} border-slate-200 mt-1 mb-1 space-y-0.5`}>
                      {it.children.map((child: any) => childRow(child))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Dock pop-out panel for a group. A sibling of the scrolling list on
            purpose: inside it, the scroller would clip it. */}
        {isDock && dockGroup && dockPanel && (
          <div
            className={`hidden lg:block absolute ${isRtl ? 'right-full pr-3' : 'left-full pl-3'} z-[100]`}
            style={{ top: dockPanel.top }}
            onMouseEnter={cancelDockClose}
            onMouseLeave={scheduleDockClose}
          >
            <div className={`w-64 rounded-2xl p-2 ${glass}`}>
              <div className="flex items-center gap-2.5 px-2.5 pt-1.5 pb-2.5">
                <span className={`w-8 h-8 rounded-xl inline-flex items-center justify-center ${
                  dockGroup.children.some((c: any) => isHrefActive(c.href)) ? 'sc-nav-chip' : 'bg-slate-100 text-slate-600'
                }`}>
                  <dockGroup.icon size={16} />
                </span>
                <p className="text-[13px] font-semibold text-slate-900">{t(dockGroup.name, 'dashboard')}</p>
              </div>
              <div className="space-y-0.5">
                {dockGroup.children.map((child: any) => childRow(child, true))}
              </div>
            </div>
          </div>
        )}

        {/* Footer: account + expand */}
        <div className={`shrink-0 border-t border-slate-200/70 ${isDock ? 'lg:p-2.5 p-3' : 'p-3'}`}>
          <div className={`flex items-center gap-2.5 ${isDock ? 'lg:justify-center' : ''}`}>
            <Link
              to={`${basePathFor(user?.role, location.pathname)}/settings`}
              title={user?.fullName || ''}
              className="w-9 h-9 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 text-white text-xs font-bold flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-white shadow-md"
            >
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.fullName || 'User'} className="w-full h-full object-cover" />
              ) : (
                user?.fullName?.charAt(0)?.toUpperCase() || 'U'
              )}
            </Link>
            {showLabels && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-900 truncate">{user?.fullName}</p>
                  <p className="text-[11px] text-slate-500 truncate">{getRoleLabel()}</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  title={t('menu_logout', 'dashboard')}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <LogOut size={15} />
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            className={`hidden lg:flex mt-2 w-full h-8 items-center rounded-xl text-[11px] font-medium text-slate-400 hover:text-slate-900 hover:bg-white transition-all ${
              isDock ? 'justify-center' : 'justify-between px-2.5'
            }`}
            title={sidebarCollapsed ? t('nav_expand', 'dashboard', 'Développer le menu') : t('nav_collapse', 'dashboard', 'Réduire le menu')}
          >
            {!isDock && <span>{t('nav_collapse', 'dashboard', 'Réduire le menu')}</span>}
            {sidebarCollapsed
              ? (isRtl ? <ChevronLeft size={15} /> : <ChevronRight size={15} />)
              : (isRtl ? <ChevronRight size={15} /> : <ChevronLeft size={15} />)}
          </button>
        </div>
      </aside>

      {/* ───────────────────── Command palette (⌘K) ───────────────────── */}
      {searchOpen && createPortal(
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-[999999] flex items-start justify-center pt-[12vh] px-4"
          onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
        >
          <div
            className="relative w-full max-w-xl bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-slate-900/20 border border-white/70 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 bg-gradient-to-r from-primary-600 via-influencer-500 to-accent-500" />
            <div className="flex items-center gap-3 px-5 h-14 border-b border-slate-100">
              <Sparkles size={18} className="text-primary-500 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={t('search_placeholder', 'dashboard', 'Rechercher une page...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredNavItems[0]?.href) handleSearchNav(filteredNavItems[0].href);
                }}
                className="flex-1 bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
                autoFocus
              />
              <kbd className="hidden sm:inline-flex h-6 px-1.5 items-center rounded-md border border-slate-200 bg-slate-50 text-[10px] font-medium text-slate-500">
                ESC
              </kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {searchQuery ? (
                filteredNavItems.length > 0 ? (
                  filteredNavItems.map((item: any, idx: number) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={`${item.href}-${idx}`}
                        onClick={() => item.href && handleSearchNav(item.href)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-2xl hover:bg-slate-50 transition-colors group"
                      >
                        <span className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 group-hover:bg-primary-50 group-hover:text-primary-600 inline-flex items-center justify-center shrink-0 transition-colors">
                          <Icon size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-semibold text-slate-800 truncate">{t(item.name, 'dashboard')}</span>
                          {item.parentName && (
                            <span className="block text-[11px] text-slate-400 truncate">{t(item.parentName, 'dashboard')}</span>
                          )}
                        </span>
                        {idx === 0 && (
                          <kbd className="hidden sm:inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400">
                            <CornerDownLeft size={11} />
                          </kbd>
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-5 py-10 text-center">
                    <p className="text-sm text-slate-500">Aucun résultat pour « {searchQuery} »</p>
                  </div>
                )
              ) : (
                <div>
                  <p className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Navigation rapide</p>
                  <div className="grid grid-cols-2 gap-1">
                    {flatPages.slice(0, 8).map((item: any, idx: number) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={`${item.href}-${idx}`}
                          onClick={() => item.href && handleSearchNav(item.href)}
                          className="flex items-center gap-2.5 px-3 h-10 text-left hover:bg-slate-50 rounded-xl transition-colors group min-w-0"
                        >
                          <Icon size={15} className="text-slate-400 group-hover:text-primary-600 transition-colors shrink-0" />
                          <span className="text-[13px] text-slate-700 truncate">{t(item.name, 'dashboard')}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─────────────────────────── Main ─────────────────────────── */}
      <div className={`min-h-screen transition-[padding] duration-300 ease-out ${
        isRtl
          ? (sidebarCollapsed ? 'lg:pr-[92px]' : 'lg:pr-[276px]')
          : (sidebarCollapsed ? 'lg:pl-[92px]' : 'lg:pl-[276px]')
      }`}>
        {/* Floating header */}
        <header className="sticky top-0 lg:top-3 z-[500] px-0 lg:px-4 pt-0 lg:pt-0">
          <div className={`h-14 flex items-center gap-2 px-2.5 sm:px-3 ${glass} lg:rounded-2xl`}>
            {/* Menu: mobile opens the drawer, desktop toggles dock / panel */}
            <button
              onClick={() => {
                if (window.innerWidth < 1024) setSidebarOpen(true);
                else toggleSidebarCollapsed();
              }}
              className={iconBtn}
              id="sidebar-toggle"
              title={sidebarCollapsed ? t('nav_expand', 'dashboard', 'Développer le menu') : t('nav_collapse', 'dashboard', 'Réduire le menu')}
            >
              <Menu size={18} className="lg:hidden" />
              {sidebarCollapsed
                ? (isRtl ? <PanelLeftClose size={17} className="hidden lg:block" /> : <PanelLeftOpen size={17} className="hidden lg:block" />)
                : (isRtl ? <PanelLeftOpen size={17} className="hidden lg:block" /> : <PanelLeftClose size={17} className="hidden lg:block" />)}
            </button>

            {/* Breadcrumb */}
            <nav className="hidden sm:flex items-center gap-1.5 min-w-0 text-[13px] ml-1" aria-label="Fil d'Ariane">
              <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-gradient-to-r from-primary-700 to-primary-500 text-white text-[11px] font-semibold shrink-0 shadow-sm shadow-primary-600/20">
                <span className={`w-1.5 h-1.5 rounded-full ${currentMode === 'AFFILIATE' && isVendorDashboard ? 'bg-accent-400' : 'bg-white/80'}`} />
                {section.label}
              </span>
              {activeTrail.parent && (
                <>
                  <Crumb size={14} className="text-slate-300 shrink-0" />
                  <span className="text-slate-500 truncate">{t(activeTrail.parent.name, 'dashboard')}</span>
                </>
              )}
              {currentPage && (
                <>
                  <Crumb size={14} className="text-slate-300 shrink-0" />
                  <span className="text-slate-900 font-semibold truncate">{t(currentPage.name, 'dashboard')}</span>
                </>
              )}
            </nav>
            <span className="sm:hidden text-sm font-semibold text-slate-900 truncate">
              {currentPage?.name ? t(currentPage.name, 'dashboard') : t('dashboard', 'dashboard')}
            </span>

            <div className="flex-1" />

            {/* Command search */}
            <button
              onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 100); }}
              className="hidden md:flex items-center gap-2.5 h-9 w-56 lg:w-72 px-3.5 rounded-full border border-transparent bg-slate-100/70 text-slate-500 hover:bg-white hover:border-slate-200 hover:shadow-sm transition-all text-[13px] group"
              id="search-toggle"
            >
              <Sparkles size={15} className="shrink-0 text-primary-500 group-hover:rotate-12 transition-transform" />
              <span className="flex-1 text-left truncate">{t('nav_search', 'dashboard', 'Rechercher…')}</span>
              <kbd className="hidden lg:inline-flex h-5 px-1.5 items-center gap-0.5 rounded-md border border-slate-200 bg-white text-[10px] font-medium text-slate-500">
                <Command size={9} />K
              </kbd>
            </button>
            <button
              onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 100); }}
              className={`md:hidden ${iconBtn}`}
              aria-label={t('nav_search', 'dashboard', 'Rechercher…')}
            >
              <Search size={17} />
            </button>

            {/* Google Sheets push credits — renders nothing unless the account
                actually has the feature enabled. */}
            <SheetCreditsIndicator />

            <LanguageSwitcherWidget variant="dashboard-header" />

            <button
              onClick={toggleFullscreen}
              className={`hidden lg:inline-flex ${iconBtn}`}
              title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
              id="fullscreen-toggle"
            >
              {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotificationsMenu(!showNotificationsMenu)}
                className={`relative ${iconBtn} ${showNotificationsMenu ? 'bg-white border-slate-200 text-primary-700 shadow-sm' : ''}`}
                id="notifications-toggle"
                aria-label="Notifications"
              >
                <Bell size={17} />
                {unreadNotifications.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-r from-accent-500 to-rose-500 text-white text-[10px] font-semibold leading-none flex items-center justify-center ring-2 ring-white tabular-nums">
                    {unreadNotifications.length > 99 ? '99+' : unreadNotifications.length}
                  </span>
                )}
              </button>

              {showNotificationsMenu && (
                <>
                  <div data-dropdown-backdrop className="fixed inset-0 z-[99]" onClick={() => setShowNotificationsMenu(false)}></div>
                  <div className={`absolute ${isRtl ? 'left-0' : 'right-0'} mt-3 w-[380px] max-w-[calc(100vw-1.5rem)] rounded-3xl z-[100] overflow-hidden ${glass} bg-white/95`}>
                    <div className="px-5 py-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{t('title', 'notifications', 'Notifications')}</p>
                        <p className="text-xs text-slate-500">
                          {unreadNotifications.length} {t('unread_suffix', 'notifications', 'non lues')}
                        </p>
                      </div>
                      {notifications.length > 0 && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={handleMarkAllRead}
                            className="h-7 px-2.5 rounded-full text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors"
                          >
                            {t('btn_read_all_short', 'notifications', 'Tout lire')}
                          </button>
                          <button
                            onClick={handleDeleteAllNotifications}
                            className="h-7 px-2.5 rounded-full text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors"
                          >
                            {t('btn_clear_all_short', 'notifications', 'Tout effacer')}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="max-h-[380px] overflow-y-auto px-2 pb-2 space-y-0.5">
                      {notifications.length === 0 ? (
                        <div className="py-12 px-6 text-center">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-50 to-accent-50 text-primary-500 flex items-center justify-center mx-auto mb-3">
                            <Bell size={20} />
                          </div>
                          <p className="text-sm font-medium text-slate-800">{t('no_notifications_menu', 'notifications', 'Aucune notification')}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {t('no_notifications_menu_desc', 'notifications', 'Vous serez notifié en temps réel lors de vos ventes et de vos demandes.')}
                          </p>
                        </div>
                      ) : (
                        notifications.slice(0, 6).map((notif) => {
                          const { bg, Icon: NIcon } = notifIcon(notif.type);
                          const translated = translateNotification(notif, (k, ns, fb) => t(k, ns || 'notifications', fb));
                          return (
                            <div
                              key={notif.id}
                              onClick={() => handleNotificationClick(notif)}
                              className={`relative flex items-start gap-3 px-3 py-3 rounded-2xl cursor-pointer transition-colors group hover:bg-slate-50 ${!notif.isRead ? 'bg-primary-50/50' : ''}`}
                            >
                              <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
                                <NIcon size={15} />
                              </span>
                              <div className="flex-1 min-w-0 pr-6">
                                <div className="flex items-baseline justify-between gap-2">
                                  <p className={`text-[13px] truncate ${!notif.isRead ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                                    {translated.title}
                                  </p>
                                  <span className="text-[11px] text-slate-400 whitespace-nowrap tabular-nums">
                                    {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 leading-snug mt-0.5 line-clamp-2">{translated.body}</p>
                              </div>
                              <button
                                onClick={(e) => handleDeleteNotification(notif.id, e)}
                                className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all`}
                                title={t('confirm_delete_all_btn', 'notifications', 'Supprimer')}
                              >
                                <Trash size={13} />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {notifications.length > 0 && (
                      <div className="px-4 py-3 border-t border-slate-100 text-center">
                        <Link
                          to={`${getRolePrefix()}/notifications`}
                          onClick={() => setShowNotificationsMenu(false)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-primary-700 transition-colors"
                        >
                          <span>{t('view_all_history', 'notifications', "Voir tout l'historique")}</span>
                          {isRtl ? <ArrowLeft size={12} /> : <ArrowRight size={12} />}
                        </Link>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Profile */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className={`flex items-center gap-2 h-10 pl-1 pr-1.5 sm:pr-2.5 rounded-full border border-transparent hover:bg-white hover:border-slate-200 hover:shadow-sm transition-all ${showProfileMenu ? 'bg-white border-slate-200 shadow-sm' : ''}`}
                id="profile-menu-toggle"
              >
                <span className="relative w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 text-white text-xs font-bold flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-white shadow">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.fullName || 'User'} className="w-full h-full object-cover" />
                  ) : (
                    user?.fullName?.charAt(0)?.toUpperCase() || 'U'
                  )}
                </span>
                <span className="hidden lg:block text-left leading-tight max-w-[140px]">
                  <span className="block text-[13px] font-semibold text-slate-900 truncate">{user?.fullName}</span>
                  <span className={`block text-[11px] truncate ${isVendorDashboard && currentMode === 'AFFILIATE' ? 'text-accent-600' : 'text-slate-500'}`}>
                    {getRoleLabel()}
                  </span>
                </span>
                <ChevronDown size={14} className={`hidden sm:block text-slate-400 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} />
              </button>

              {showProfileMenu && (
                <>
                  <div data-dropdown-backdrop className="fixed inset-0 z-[99]" onClick={() => setShowProfileMenu(false)}></div>
                  <div className={`absolute ${isRtl ? 'left-0' : 'right-0'} mt-3 w-64 rounded-3xl z-[100] overflow-hidden ${glass} bg-white/95`}>
                    <div className="px-4 pt-4 pb-3 flex items-center gap-3">
                      <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 text-white text-sm font-bold flex items-center justify-center overflow-hidden shrink-0">
                        {user?.avatarUrl ? (
                          <img src={user.avatarUrl} alt={user.fullName || 'User'} className="w-full h-full object-cover" />
                        ) : (
                          user?.fullName?.charAt(0)?.toUpperCase() || 'U'
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{user?.fullName}</p>
                        <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                      </div>
                    </div>
                    <div className="px-2 pb-2">
                      {[
                        { name: t('menu_my_profile', 'dashboard'), tab: '', icon: User },
                        { name: t('menu_payment', 'dashboard'), tab: 'payment', icon: CreditCard },
                        { name: t('menu_security_2fa', 'dashboard'), tab: 'password', icon: Shield },
                      ].map((item) => (
                        <button
                          key={item.tab}
                          onClick={() => {
                            setShowProfileMenu(false);
                            const base = basePathFor(user?.role, location.pathname);
                            navigate(`${base}/settings${item.tab ? `?tab=${item.tab}` : ''}`);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 h-10 rounded-xl text-[13px] text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors group"
                        >
                          <item.icon size={16} className="text-slate-400 group-hover:text-primary-600 transition-colors" />
                          {item.name}
                        </button>
                      ))}
                      {isVendorDashboard && (
                        <button
                          onClick={() => { setShowProfileMenu(false); handleSwitchMode(); }}
                          className="w-full flex items-center gap-2.5 px-3 h-10 rounded-xl text-[13px] text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors group"
                        >
                          <ArrowLeftRight size={16} className="text-slate-400 group-hover:text-primary-600 transition-colors" />
                          {currentMode === 'SELLER'
                            ? t('nav_mode_affiliate', 'dashboard', 'Affilié')
                            : t('nav_mode_seller', 'dashboard', 'Vendeur')}
                        </button>
                      )}
                    </div>
                    <div className="border-t border-slate-100 p-2">
                      <button
                        onClick={() => { setShowProfileMenu(false); handleLogout(); }}
                        className="w-full flex items-center gap-2.5 px-3 h-10 rounded-xl text-[13px] font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <LogOut size={16} />
                        {t('menu_logout', 'dashboard')}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        {/* `overflow-x-clip` (not `hidden`) is deliberate: it contains a
            stray wide child without turning this into a scroll container,
            so sticky headers and dropdowns inside pages still escape
            vertically. Without it one over-wide element scrolls the whole
            document sideways on mobile, which drags the sticky header off
            screen and strands `position: fixed` modals out of view.

            It lives on THIS padded element, not on the inner canvas: a clip
            drawn at the canvas edge sliced every card's shadow off at the
            sides, leaving only the part underneath — a dark bar. Here the
            clip edge sits in the padding, 12–24px clear of the cards. */}
        <div className="flex-1 px-3 sm:px-4 lg:px-6 pt-6 sm:pt-7 lg:pt-8 pb-10 sm:pb-12 lg:pb-16 min-h-[calc(100vh-68px)] overflow-x-clip">
          {/* `sc-canvas` scopes styles/dashboard-skin.css to the pages. */}
          <div className="sc-canvas relative max-w-[1600px] mx-auto min-w-0">
            <AnnouncementBanner position="TOP" />
            <ProfileProgressBanner />
            {/* Some pages behind this outlet are `lazy()` (product detail, the
                marketplace). Without a boundary here React 18 treats a click
                that lands on a not-yet-downloaded chunk as suspending on
                synchronous input and throws, and since nothing in the app
                catches it the whole root unmounts — a blank screen that only a
                reload fixes. One boundary covers every dashboard tree. */}
            <Suspense fallback={
              <div className="min-h-[400px] flex items-center justify-center p-8">
                <div className="w-8 h-8 border-[3px] border-primary-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            }>
              <Outlet />
            </Suspense>
            <AnnouncementBanner position="BOTTOM" />
          </div>
        </div>
      </div>

      {/* Live notification toasts, bottom corner */}
      <div className={`fixed bottom-5 ${isRtl ? 'left-5' : 'right-5'} z-[100] flex flex-col gap-2.5 w-full max-w-sm pointer-events-none`}>
        {toasts.map((tst) => {
          const { bg, Icon: TIcon } = notifIcon(tst.type);
          return (
            <div
              key={tst.toastId}
              onClick={() => handleNotificationClick(tst)}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl cursor-pointer w-full relative group ${glass} bg-white/95`}
            >
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
                <TIcon size={16} />
              </span>
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-[13px] font-semibold text-slate-900 leading-tight">{tst.title}</p>
                <p className="text-xs text-slate-500 leading-snug mt-0.5">{tst.body}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setToasts(prev => prev.filter(toastItem => toastItem.toastId !== tst.toastId));
                }}
                className="h-7 w-7 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
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

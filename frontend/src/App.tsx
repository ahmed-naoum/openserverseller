import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import MaintenanceGuard from './components/MaintenanceGuard';
import PageLoader from './components/PageLoader';
import toast, { Toaster } from 'react-hot-toast';

// Pages
const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
// 1900 lines of dashboard chrome — nav, sidebar, account menus — reachable only
// behind a login, but statically imported it sat in the entry chunk that every
// public offer page downloads. Used purely as a route element, so it resolves
// inside the router's existing Suspense boundary.
const DashboardLayout = lazy(() => import('./components/layouts/DashboardLayout'));
const VendorDashboard = lazy(() => import('./pages/vendor/Dashboard'));
const VendorProducts = lazy(() => import('./pages/vendor/Products'));
const VendorLeads = lazy(() => import('./pages/vendor/Leads'));

const VendorInventory = lazy(() => import('./pages/vendor/Inventory'));
const AgentDashboard = lazy(() => import('./pages/agent/Dashboard'));
const AgentLeads = lazy(() => import('./pages/agent/Leads'));
const AgentAssignedLeads = lazy(() => import('./pages/agent/AssignedLeads'));
const AgentMyLeads = lazy(() => import('./pages/agent/MyLeads'));
const AgentLeadDetail = lazy(() => import('./pages/agent/LeadDetail'));
const AgentOrders = lazy(() => import('./pages/agent/Orders'));
const AgentLivraison = lazy(() => import('./pages/agent/Livraison'));
const InsertLead = lazy(() => import('./pages/agent/InsertLead'));
const ColiatyDispatch = lazy(() => import('./pages/agent/ColiatyDispatch'));
const AgentAbandonedCarts = lazy(() => import('./pages/agent/AbandonedCarts'));
const AgentFacturation = lazy(() => import('./pages/agent/Facturation'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminProducts = lazy(() => import('./pages/admin/Products'));
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories'));
const AdminOrders = lazy(() => import('./pages/admin/Orders'));
const AdminFinance = lazy(() => import('./pages/admin/Finance'));
const AdminFulfillment = lazy(() => import('./pages/admin/Fulfillment'));
const AdminAffiliateClaims = lazy(() => import('./pages/admin/AffiliateClaims'));
const AdminCampaigns = lazy(() => import('./pages/admin/Campaigns'));
const AdminCustomers = lazy(() => import('./pages/admin/Customers'));
const AdminAnnouncements = lazy(() => import('./pages/admin/Announcements'));
const AdminVerifications = lazy(() => import('./pages/admin/AdminVerifications'));
const AdminSupport = lazy(() => import('./pages/admin/Support'));
const AdminLeads = lazy(() => import('./pages/admin/Leads'));
const AdminPaymentMonitoring = lazy(() => import('./pages/admin/PaymentMonitoring'));
const AdminInvoices = lazy(() => import('./pages/admin/Invoices'));
const ActivityLogs = lazy(() => import('./pages/admin/ActivityLogs'));
const BackupManager = lazy(() => import('./pages/admin/BackupManager'));
const CallCenterInspector = lazy(() => import('./pages/admin/CallCenterInspector'));
const InfluencerInspector = lazy(() => import('./pages/admin/InfluencerInspector'));
const SupportInspector = lazy(() => import('./pages/admin/SupportInspector'));
const LiveStreamInspector = lazy(() => import('./pages/admin/LiveStreamInspector'));
/**
 * Session replay pulls in rrweb (~256 KB). The tracker itself does nothing for
 * an ordinary visitor — it bails out until the server pushes a record request —
 * but a static import put rrweb in the entry graph, which put it on the
 * `modulepreload` list of every page, including the public offer pages. Loaded
 * lazily it costs those visitors nothing.
 */
const LiveSessionTracker = lazy(() => import('./components/common/LiveSessionTracker'));
const ContactMessages = lazy(() => import('./pages/admin/ContactMessages'));
const AdminLinks = lazy(() => import('./pages/admin/Links'));
const AdminProfessionalEmails = lazy(() => import('./pages/admin/ProfessionalEmails'));
const PlatformArchitecture = lazy(() => import('./pages/admin/PlatformArchitecture'));


const YouCanCallback = lazy(() => import('./pages/vendor/YouCanCallback'));
const ShopifyCallback = lazy(() => import('./pages/vendor/ShopifyCallback'));
const WooCommerceCallback = lazy(() => import('./pages/vendor/WooCommerceCallback'));
const VendorInsertLead = lazy(() => import('./pages/vendor/InsertLead'));
const VendorDomains = lazy(() => import('./pages/vendor/Domains'));
const YouCanLeads = lazy(() => import('./pages/vendor/YouCanLeads'));
const ShopifyLeads = lazy(() => import('./pages/vendor/ShopifyLeads'));
const WooCommerceLeads = lazy(() => import('./pages/vendor/WooCommerceLeads'));
const GoogleSheetsLeads = lazy(() => import('./pages/vendor/GoogleSheetsLeads'));
const IntegrationsPage = lazy(() => import('./pages/vendor/IntegrationsPage'));
const VendorSubAccounts = lazy(() => import('./pages/vendor/SubAccounts'));
import SubAccountGuard from './components/auth/SubAccountGuard';
import { VENDOR_HELPER_BASE } from './lib/dashboardBase';
const PlatformSettings = lazy(() => import('./pages/admin/PlatformSettings'));
const AdminSecrets = lazy(() => import('./pages/admin/AdminSecrets'));
const AdminDeployments = lazy(() => import('./pages/admin/Deployments'));
const SecurityFirewall = lazy(() => import('./pages/admin/SecurityFirewall'));
const AdminEventRegistrations = lazy(() => import('./pages/admin/AdminEventRegistrations'));
const EventMasterclass = lazy(() => import('./pages/public/EventMasterclass'));
const WebhookLogs = lazy(() => import('./pages/admin/WebhookLogs'));
const WebhookTester = lazy(() => import('./pages/admin/WebhookTester'));
const GrossellerDashboard = lazy(() => import('./pages/grosseller/Dashboard'));
const GrossellerProfile = lazy(() => import('./pages/grosseller/Profile'));
const GrossellerInventory = lazy(() => import('./pages/grosseller/Inventory'));
const GrossellerMarketplace = lazy(() => import('./pages/grosseller/Marketplace'));
const GrossellerAddProduct = lazy(() => import('./pages/grosseller/AddProduct'));
const GrossellerSelling = lazy(() => import('./pages/grosseller/Selling'));
const GrossellerPending = lazy(() => import('./pages/grosseller/Pending'));
const GrossellerApproved = lazy(() => import('./pages/grosseller/Approved'));
const GrossellerPayouts = lazy(() => import('./pages/grosseller/Payouts'));
const GrossellerOrders = lazy(() => import('./pages/grosseller/Orders'));
const UserInvoices = lazy(() => import('./pages/common/UserInvoices'));
const GrossellerAnalytics = lazy(() => import('./pages/grosseller/Analytics'));
const GrossellerSupport = lazy(() => import('./pages/grosseller/Support'));
const InfluencerDashboard = lazy(() => import('./pages/influencer/Dashboard'));
const InfluencerProfile = lazy(() => import('./pages/influencer/Profile'));
const InfluencerLinks = lazy(() => import('./pages/influencer/Links'));
const InfluencerCampaigns = lazy(() => import('./pages/influencer/Campaigns'));
const InfluencerLeads = lazy(() => import('./pages/influencer/Leads'));
const InfluencerMarketplace = lazy(() => import('./pages/influencer/Marketplace'));
const InfluencerInventory = lazy(() => import('./pages/influencer/Inventory'));
const Notifications = lazy(() => import('./pages/common/Notifications'));
const ConfirmationDashboard = lazy(() => import('./pages/confirmation/Dashboard'));
const HelperDashboard = lazy(() => import('./pages/helper/Dashboard'));
const HelperLeads = lazy(() => import('./pages/helper/Leads'));
const HelperColis = lazy(() => import('./pages/helper/Colis'));
const HelperRetours = lazy(() => import('./pages/helper/Retours'));
const HelperTickets = lazy(() => import('./pages/helper/Tickets'));
const HelperUsers = lazy(() => import('./pages/helper/Users'));
const HelperLinks = lazy(() => import('./pages/helper/Links'));
const HelperAffiliate = lazy(() => import('./pages/helper/HelperAffiliate'));
const AdminHelpersAffiliate = lazy(() => import('./pages/admin/AdminHelpersAffiliate'));
const SiteBuilder = lazy(() => import('./pages/helper/SiteBuilder'));
const HelperScanner = lazy(() => import('./pages/helper/Scanner'));
const Chat = lazy(() => import('./pages/common/Chat'));
const AccountVerification = lazy(() => import('./pages/verify/AccountVerification'));
const PublicMarketplace = lazy(() => import('./pages/marketplace/PublicMarketplace'));
const ProductDetail = lazy(() => import('./pages/marketplace/ProductDetail'));
const ReferralForm = lazy(() => import('./pages/public/ReferralForm'));
const ThankYouPage = lazy(() => import('./pages/public/ThankYouPage'));
const PendingVerificationPage = lazy(() => import('./pages/auth/PendingVerificationPage'));
const EmailVerificationPage = lazy(() => import('./pages/auth/EmailVerificationPage'));
const CompleteRegisterGoogle = lazy(() => import('./pages/auth/CompleteRegisterGoogle'));
const SettingsPage = lazy(() => import('./pages/common/SettingsPage'));
import NotFoundPage from './pages/common/NotFoundPage';
const ProfileVerification = lazy(() => import('./pages/common/ProfileVerification'));
import MaintenancePage from './pages/common/MaintenancePage';
const SupportTickets = lazy(() => import('./pages/common/SupportTickets'));
const UserWallet = lazy(() => import('./pages/common/UserWallet'));
const UserPixels = lazy(() => import('./pages/common/UserPixels'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const FaqPage = lazy(() => import('./pages/FaqPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const CareersPage = lazy(() => import('./pages/CareersPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
import ScrollToTop from './components/common/ScrollToTop';
import BlockedPage from './pages/common/BlockedPage';

// Context
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider, useSocket } from './contexts/SocketContext';
import { LanguageProvider } from './contexts/LanguageContext';

// Guards
import RoleGuard from './components/auth/RoleGuard';
import UnauthGuard from './components/auth/UnauthGuard';
import { settingsApi } from './lib/api';
import { whenIdle } from './lib/whenIdle';

/**
 * Shown while a route's chunk is in flight.
 *
 * The dashboard sections are code-split, so the first visit to one fetches its
 * chunk. Public marketing pages and the auth flow are deliberately NOT split:
 * they are the latency-sensitive entry points, and the prerenderer captures ten
 * of them, so keeping them in the entry bundle costs a page nothing.
 */
function RouteFallback() {
  return (
    <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center p-4">
      <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

/**
 * A deploy replaces every hash-named chunk and deletes the previous build, so a
 * tab opened before the deploy asks for a file that no longer exists. React
 * surfaces that as a rejected lazy import and renders nothing — a white screen
 * that only a manual refresh clears.
 *
 * Reloading once fixes it, because the fresh index.html points at the new
 * hashes. The sessionStorage mark is what keeps this from becoming a reload
 * loop when the failure is something other than a stale chunk (offline, a
 * genuine 500), in which case the error is left to surface normally.
 */
const CHUNK_RELOAD_MARK = 'chunk_reload_at';

function isStaleChunkError(reason: unknown): boolean {
  const message = String((reason as any)?.message ?? reason ?? '');
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message)
  );
}

function reloadOnceForStaleChunk(reason: unknown): void {
  if (!isStaleChunkError(reason)) return;

  // Two reloads inside a minute means the reload is not fixing it; stop.
  const last = Number(sessionStorage.getItem(CHUNK_RELOAD_MARK) || 0);
  if (last && Date.now() - last < 60_000) return;

  sessionStorage.setItem(CHUNK_RELOAD_MARK, String(Date.now()));
  window.location.reload();
}

window.addEventListener('unhandledrejection', (e) => reloadOnceForStaleChunk(e.reason));
window.addEventListener('error', (e) => reloadOnceForStaleChunk((e as ErrorEvent).error ?? e));

function PageTracker() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if current path is blocked
    const blockedPages = JSON.parse(localStorage.getItem('blocked_pages') || '[]');
    if ((blockedPages.includes('*') || blockedPages.includes(location.pathname)) && location.pathname !== '/blocked') {
      const blockedPath = blockedPages.includes('*') ? 'all pages' : location.pathname;
      navigate(`/blocked?path=${encodeURIComponent(blockedPath)}`, { replace: true });
      return;
    }

    // Registers the page view in the HTTP logs. Nothing renders from it, so it
    // waits for idle rather than joining the queue in front of the page's own
    // data fetch.
    return whenIdle(() => {
      fetch('/api/v1/public/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: location.pathname }),
      }).catch(() => {});
    });
  }, [location.pathname, navigate]);

  return null;
}

function YouCanQueryRedirector() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('code') && (location.pathname === '/' || location.pathname === '')) {
      navigate(`/dashboard/youcan-callback${location.search}`, { replace: true });
    }
  }, [location, navigate]);

  return null;
}

/**
 * Loads rrweb only once a socket exists to send events over.
 *
 * Making the tracker lazy kept rrweb out of the entry chunk, but the component
 * still mounted on every page, and mounting is what triggers the dynamic
 * import — so the ~256 KB chunk was fetched during load anyway, on pages that
 * never record anything. The tracker is a no-op without a socket, and guests
 * connect theirs only once the main thread goes idle (see SocketContext), so
 * gating on it also moves the download clear of the first paint.
 */
function SessionReplayGate() {
  const { socket } = useSocket();
  if (!socket) return null;
  return (
    <Suspense fallback={null}>
      <LiveSessionTracker />
    </Suspense>
  );
}

const SPLASH_SEEN_KEY = 'splash_seen';

/**
 * The brand splash is a first-impression flourish, not a loading indicator — it
 * runs on a fixed 2.5s timer whether or not the page is ready.
 *
 * So it now plays on the homepage only, once per browser session. It used to
 * cover every route: a customer arriving on a vendor's offer page from a paid ad
 * watched a logo animation for two and a half seconds instead of the product,
 * and on a mid-range phone its blur filter and sixteen spark nodes competed with
 * hydration for the main thread — making the real load slower, not just later.
 */
const shouldShowSplash = () => {
  if (typeof window === 'undefined') return false;
  if (window.location.pathname !== '/') return false;
  try {
    return !sessionStorage.getItem(SPLASH_SEEN_KEY);
  } catch {
    // Safari in private mode throws on sessionStorage. Showing the splash is the
    // harmless direction to fail in.
    return true;
  }
};

function App() {
  const [loading, setLoading] = useState(shouldShowSplash);

  // Automatic cache version checking and updating. Deferred to idle: it only
  // ever triggers a reload on a version change, so it has no business competing
  // with the first paint of the page the visitor actually asked for.
  useEffect(() => whenIdle(() => {
    settingsApi.getCacheVersion()
      .then((res) => {
        const serverVersion = res.data?.data?.version;
        if (serverVersion) {
          const localVersion = localStorage.getItem('cache_version');
          if (localVersion && localVersion !== serverVersion) {
            console.log('New update detected. Clearing cache and reloading...');
            
            // Clear Cache Storage
            if ('caches' in window) {
              caches.keys().then((names) => {
                for (const name of names) {
                  caches.delete(name);
                }
              }).catch(err => console.error('Error clearing cache storage:', err));
            }
            
            // Unregister Service Workers
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then((registrations) => {
                for (const r of registrations) {
                  r.unregister();
                }
              }).catch(err => console.error('Error unregistering service workers:', err));
            }

            // Save new version
            localStorage.setItem('cache_version', serverVersion);
            
            // Reload page after a tiny delay
            setTimeout(() => {
              window.location.reload();
            }, 500);
          } else if (!localVersion) {
            localStorage.setItem('cache_version', serverVersion);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to verify app version:', err);
      });
  }), []);

  return (
    <>
      <ScrollToTop />
      <YouCanQueryRedirector />
      <PageTracker />
      {loading && (
        <PageLoader
          onComplete={() => {
            try {
              sessionStorage.setItem(SPLASH_SEEN_KEY, '1');
            } catch {
              // Private mode — the splash simply plays again next navigation.
            }
            setLoading(false);
          }}
        />
      )}
    <AuthProvider>
      <LanguageProvider>
      <SocketProvider>
        <SessionReplayGate />
        <MaintenanceGuard>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/maintenance" element={<MaintenancePage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<UnauthGuard><LoginPage /></UnauthGuard>} />
          <Route path="/register" element={<UnauthGuard><RegisterPage /></UnauthGuard>} />
          <Route path="/register/complete-google" element={<UnauthGuard><CompleteRegisterGoogle /></UnauthGuard>} />
          <Route path="/influencer/register" element={<UnauthGuard><RegisterPage /></UnauthGuard>} />
          <Route path="/verify-email" element={<EmailVerificationPage />} />
          <Route path="/forgot-password" element={<UnauthGuard><ForgotPassword /></UnauthGuard>} />
          <Route path="/reset-password" element={<UnauthGuard><ResetPassword /></UnauthGuard>} />
          <Route path="/marketplace" element={<PublicMarketplace />} />
          <Route path="/marketplace/:view" element={<PublicMarketplace />} />
          <Route path="/product/:id" element={
            <Suspense fallback={
              <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center p-4">
                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            }>
              <ProductDetail />
            </Suspense>
          } />
          <Route path="/r/:code" element={
            /*
              A static skeleton, not a spinner: this fallback covers the chunk
              download only, and the dark slate-900 screen it replaced flashed
              black before ReferralForm's own light grey page. Deliberately not
              animated — nothing here moves, so there is no second animation
              competing with the payload spinner that follows.

              bg-gray-50 matches ReferralForm's own background, so the handoff
              from this to the real page is a fill, not a repaint.
            */
            <Suspense fallback={
              <div className="min-h-screen bg-gray-50 p-4">
                <div className="max-w-md mx-auto">
                  <div className="h-48 bg-gray-200 rounded-2xl" />
                  <div className="h-6 bg-gray-200 rounded mt-4 w-2/3" />
                  <div className="h-6 bg-gray-200 rounded mt-2 w-1/3" />
                </div>
              </div>
            }>
              <ReferralForm />
            </Suspense>
          } />
          <Route path="/thank-you" element={
            <Suspense fallback={
              <div className="min-h-screen bg-white flex items-center justify-center p-4">
                <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            }>
              <ThankYouPage />
            </Suspense>
          } />
          <Route path="/pending-verification" element={<PendingVerificationPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/privacy-policy" element={<PrivacyPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/faqs" element={<FaqPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/careers" element={<CareersPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/masterclass" element={<EventMasterclass />} />
          <Route path="/event" element={<EventMasterclass />} />
          <Route path="/blocked" element={<BlockedPage />} />

        {/* Verification Route */}
        <Route path="/verify" element={
          <RoleGuard allowedRoles={['UNCONFIRMED']}>
            <AccountVerification />
          </RoleGuard>
        } />

        {/* Grosseller Dashboard */}
        <Route path="/grosseller" element={
          <RoleGuard allowedRoles={['GROSSELLER']}>
            <DashboardLayout />
          </RoleGuard>
        }>
          <Route index element={<GrossellerDashboard />} />
          <Route path="profile" element={<GrossellerProfile />} />
          <Route path="inventory" element={<GrossellerInventory />} />
          <Route path="add-product" element={<GrossellerAddProduct />} />
          <Route path="selling" element={<GrossellerSelling />} />
          <Route path="pending" element={<GrossellerPending />} />
          <Route path="approved" element={<GrossellerApproved />} />
          <Route path="wallet" element={<UserWallet />} />
          <Route path="orders" element={<GrossellerOrders />} />
          <Route path="analytics" element={<GrossellerAnalytics />} />
          <Route path="support" element={<SupportTickets />} />
          <Route path="invoices" element={<UserInvoices />} />
          <Route path="marketplace" element={<GrossellerMarketplace />} />
          <Route path="product/:id" element={<ProductDetail />} />
          <Route path="chat" element={<Chat />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="pixels" element={<UserPixels platform="META" />} />
          <Route path="pixels/meta" element={<UserPixels platform="META" />} />
          <Route path="pixels/google" element={<UserPixels platform="GOOGLE" />} />
          <Route path="pixels/tiktok" element={<UserPixels platform="TIKTOK" />} />
          <Route path="pixels/snapchat" element={<UserPixels platform="SNAPCHAT" />} />
          <Route path="links" element={<InfluencerLinks />} />
          <Route path="verification" element={<ProfileVerification />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>

        {/* Influencer Dashboard */}
        <Route path="/influencer" element={
          <RoleGuard allowedRoles={['INFLUENCER']}>
            <DashboardLayout />
          </RoleGuard>
        }>
          <Route index element={<InfluencerDashboard />} />
          <Route path="profile" element={<InfluencerProfile />} />
          <Route path="wallet" element={<UserWallet />} />
          <Route path="links" element={<InfluencerLinks />} />
          <Route path="campaigns" element={<InfluencerCampaigns />} />
          <Route path="leads" element={<InfluencerLeads />} />
          <Route path="inventory" element={<InfluencerInventory />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="marketplace" element={
            <Suspense fallback={<RouteFallback />}>
              <InfluencerMarketplace />
            </Suspense>
          } />
          <Route path="product/:id" element={<ProductDetail />} />
          <Route path="chat" element={<Chat />} />
          <Route path="invoices" element={<UserInvoices />} />
          <Route path="settings" element={<SettingsPage />} />

          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="support" element={<SupportTickets />} />
          <Route path="verification" element={<ProfileVerification />} />
        </Route>

        {/* Confirmation Agent Dashboard */}
        <Route path="/confirmation" element={
          <RoleGuard allowedRoles={['CONFIRMATION_AGENT']}>
            <DashboardLayout />
          </RoleGuard>
        }>
          <Route index element={<AdminVerifications />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="verification" element={<ProfileVerification />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>

        {/* Vendor Dashboard (Seller-Affiliate with mode switching) */}
        <Route path="/dashboard" element={
          <RoleGuard allowedRoles={['VENDOR']}>
            <DashboardLayout />
          </RoleGuard>
        }>
          <Route index element={<VendorDashboard />} />
          <Route path="products" element={<VendorProducts />} />
          <Route path="leads" element={<VendorLeads />} />
          <Route path="leads/new" element={<VendorInsertLead />} />
          <Route path="youcan-leads" element={<YouCanLeads />} />
          <Route path="shopify-leads" element={<ShopifyLeads />} />
          <Route path="woocommerce-leads" element={<WooCommerceLeads />} />
          <Route path="google-sheets-leads" element={<GoogleSheetsLeads />} />
          <Route path="woocommerce-callback" element={<WooCommerceCallback />} />

          <Route path="wallet" element={<UserWallet />} />
          <Route path="inventory" element={<VendorInventory />} />
          <Route path="marketplace" element={
            <Suspense fallback={<RouteFallback />}>
              <InfluencerMarketplace />
            </Suspense>
          } />
          <Route path="product/:id" element={<ProductDetail />} />
          <Route path="chat" element={<Chat />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="pixels" element={<UserPixels platform="META" />} />
          <Route path="pixels/meta" element={<UserPixels platform="META" />} />
          <Route path="pixels/google" element={<UserPixels platform="GOOGLE" />} />
          <Route path="pixels/tiktok" element={<UserPixels platform="TIKTOK" />} />
          <Route path="pixels/snapchat" element={<UserPixels platform="SNAPCHAT" />} />
          <Route path="domains" element={<VendorDomains />} />
          <Route path="links" element={<InfluencerLinks />} />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="youcan-callback" element={<YouCanCallback />} />
          <Route path="shopify-callback" element={<ShopifyCallback />} />
          <Route path="invoices" element={<UserInvoices />} />
          <Route path="support" element={<SupportTickets />} />
          <Route path="sub-accounts" element={<VendorSubAccounts />} />
          <Route path="verification" element={<ProfileVerification />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>

        {/*
          Vendor sub-account dashboard.

          The same page components as /dashboard above, mounted at a second
          prefix for role VENDOR_HELPER. The backend re-points these accounts at
          their parent vendor, so the pages show the vendor's data; which of
          them a given sub-account may open is decided by the permission flags
          its vendor granted (nav filtering in DashboardLayout, enforcement in
          backend/src/lib/vendorSubAccount.ts).

          Note there is deliberately no `sub-accounts` route here: only the
          account owner hands out permissions.
        */}
        <Route path={VENDOR_HELPER_BASE} element={
          <RoleGuard allowedRoles={['VENDOR_HELPER']}>
            <DashboardLayout />
          </RoleGuard>
        }>
          {/* Hiding a nav link is not blocking a URL — SubAccountGuard refuses
              pages this helper was not granted, however it got there. */}
          <Route element={<SubAccountGuard />}>
          <Route index element={<VendorDashboard />} />
          <Route path="products" element={<VendorProducts />} />
          <Route path="leads" element={<VendorLeads />} />
          <Route path="leads/new" element={<VendorInsertLead />} />
          <Route path="youcan-leads" element={<YouCanLeads />} />
          <Route path="shopify-leads" element={<ShopifyLeads />} />
          <Route path="woocommerce-leads" element={<WooCommerceLeads />} />
          <Route path="google-sheets-leads" element={<GoogleSheetsLeads />} />
          <Route path="wallet" element={<UserWallet />} />
          <Route path="inventory" element={<VendorInventory />} />
          <Route path="marketplace" element={
            <Suspense fallback={<RouteFallback />}>
              <InfluencerMarketplace />
            </Suspense>
          } />
          <Route path="product/:id" element={<ProductDetail />} />
          <Route path="chat" element={<Chat />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="pixels" element={<UserPixels platform="META" />} />
          <Route path="pixels/meta" element={<UserPixels platform="META" />} />
          <Route path="pixels/google" element={<UserPixels platform="GOOGLE" />} />
          <Route path="pixels/tiktok" element={<UserPixels platform="TIKTOK" />} />
          <Route path="pixels/snapchat" element={<UserPixels platform="SNAPCHAT" />} />
          <Route path="domains" element={<VendorDomains />} />
          <Route path="links" element={<InfluencerLinks />} />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="invoices" element={<UserInvoices />} />
          <Route path="support" element={<SupportTickets />} />
          <Route path="notifications" element={<Notifications />} />
          </Route>
        </Route>

        {/* Agent Dashboard */}
        <Route path="/agent" element={
          <RoleGuard allowedRoles={['CALL_CENTER_AGENT']}>
            <DashboardLayout />
          </RoleGuard>
        }>
          <Route index element={<AgentDashboard />} />
          <Route path="leads" element={<AgentLeads />} />
          <Route path="assigned-leads" element={<AgentAssignedLeads />} />
          <Route path="insert-lead" element={<InsertLead />} />
          <Route path="dispatch" element={<Navigate to="/agent/insert-lead" replace />} />
          <Route path="my-leads" element={<AgentMyLeads />} />
          <Route path="leads/:id" element={<AgentLeadDetail />} />
          <Route path="orders" element={<AgentOrders />} />
          <Route path="livraison" element={<AgentLivraison />} />
          <Route path="facturation" element={<AgentFacturation />} />
          <Route path="live-stream-paniers" element={<AgentAbandonedCarts />} />
          <Route path="marketplace" element={<PublicMarketplace />} />
          <Route path="product/:id" element={<ProductDetail />} />
          <Route path="chat" element={<Chat />} />
          <Route path="support" element={<SupportTickets />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="verification" element={<ProfileVerification />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>

        <Route path="/helper/links/:id/builder" element={
          <RoleGuard allowedRoles={['SUPER_ADMIN', 'HELPER', 'VENDOR', 'INFLUENCER']}>
            <SiteBuilder />
          </RoleGuard>
        } />

        <Route path="/dashboard/links/:id/builder" element={
          <RoleGuard allowedRoles={['VENDOR']}>
            <SiteBuilder />
          </RoleGuard>
        } />

        <Route path={`${VENDOR_HELPER_BASE}/links/:id/builder`} element={
          <RoleGuard allowedRoles={['VENDOR_HELPER']}>
            <SiteBuilder />
          </RoleGuard>
        } />

        <Route path="/influencer/links/:id/builder" element={
          <RoleGuard allowedRoles={['INFLUENCER']}>
            <SiteBuilder />
          </RoleGuard>
        } />

        <Route path="/admin/links/:id/builder" element={
          <RoleGuard allowedRoles={['SUPER_ADMIN']}>
            <SiteBuilder />
          </RoleGuard>
        } />

        {/* Helper Routes */}
        <Route path="/helper" element={<RoleGuard allowedRoles={['SUPER_ADMIN', 'HELPER']}><DashboardLayout /></RoleGuard>}>
          <Route index element={<HelperDashboard />} />
          <Route path="affiliate" element={<HelperAffiliate />} />
          <Route path="wallet" element={<HelperAffiliate />} />
          <Route path="users" element={<HelperUsers />} />
          <Route path="leads" element={<HelperLeads />} />
          <Route path="links" element={<HelperLinks />} />
          <Route path="colis" element={<HelperColis />} />
          <Route path="retours" element={<HelperRetours />} />
          <Route path="scanner" element={<HelperScanner />} />
          <Route path="tickets" element={<HelperTickets />} />
          <Route path="marketplace" element={<PublicMarketplace />} />
          <Route path="product/:id" element={<ProductDetail />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="verification" element={<ProfileVerification />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>

        {/* Admin Dashboard */}
        <Route path="/admin" element={
          <RoleGuard allowedRoles={['SUPER_ADMIN', 'FINANCE_ADMIN', 'SYSTEM_SUPPORT']}>
            <DashboardLayout />
          </RoleGuard>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="leads" element={<AdminLeads />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="helpers-affiliate" element={<AdminHelpersAffiliate />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="finance" element={<AdminFinance />} />
          <Route path="support" element={<SupportTickets />} />
          <Route path="invoices" element={<AdminInvoices />} />
          <Route path="affiliate-claims" element={<AdminAffiliateClaims />} />
          <Route path="announcements" element={<AdminAnnouncements />} />
          <Route path="campaigns" element={<AdminCampaigns />} />
          <Route path="verifications" element={<AdminVerifications />} />
          <Route path="event-registrations" element={<AdminEventRegistrations />} />
          <Route path="platform-settings" element={<PlatformSettings />} />
          <Route path="secrets" element={
            <RoleGuard allowedRoles={['SUPER_ADMIN']}>
              <AdminSecrets />
            </RoleGuard>
          } />
          <Route path="deployments" element={
            <RoleGuard allowedRoles={['SUPER_ADMIN']}>
              <AdminDeployments />
            </RoleGuard>
          } />
          <Route path="professional-emails" element={
            <RoleGuard allowedRoles={['SUPER_ADMIN']}>
              <AdminProfessionalEmails />
            </RoleGuard>
          } />
          <Route path="security" element={<SecurityFirewall />} />
          <Route path="webhook-logs" element={<WebhookLogs />} />
          <Route path="webhook-tester" element={<WebhookTester />} />
          <Route path="payment-monitoring" element={<AdminPaymentMonitoring />} />
          <Route path="marketplace" element={<PublicMarketplace />} />
          <Route path="product/:id" element={<ProductDetail />} />
          <Route path="chat" element={<Chat />} />
          <Route path="activity-logs" element={<ActivityLogs />} />
          <Route path="backups" element={
            <RoleGuard allowedRoles={['SUPER_ADMIN']}>
              <BackupManager />
            </RoleGuard>
          } />
          <Route path="call-center-inspector" element={<CallCenterInspector />} />
          <Route path="influencer-inspector" element={<InfluencerInspector />} />
          <Route path="support-inspector" element={<SupportInspector />} />
          <Route path="contact-messages" element={<ContactMessages />} />
          <Route path="links" element={<AdminLinks />} />
          <Route path="architecture" element={<PlatformArchitecture />} />
          <Route path="live-stream" element={<LiveStreamInspector />} />
          <Route path="scanner" element={<HelperScanner />} />
          <Route path="settings" element={<SettingsPage />} />

          <Route path="verification" element={<ProfileVerification />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>

          {/* Catch-all 404 Route */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
      </MaintenanceGuard>
      </SocketProvider>


      <Toaster
        position="top-right"
        containerStyle={{ top: 20, right: 20 }}
        gutter={10}
        toastOptions={{
          duration: 4000,
          style: {
            padding: 0,
            background: 'transparent',
            boxShadow: 'none',
          },
        }}
      >
        {(t) => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';
          const isLoading = t.type === 'loading';

          const bgColor = isSuccess
            ? 'rgba(16, 185, 129, 0.95)'
            : isError
            ? 'rgba(239, 68, 68, 0.95)'
            : isLoading
            ? 'rgba(59, 130, 246, 0.95)'
            : 'rgba(30, 30, 30, 0.95)';

          const glowColor = isSuccess
            ? '0 8px 32px rgba(16, 185, 129, 0.3), 0 2px 8px rgba(16, 185, 129, 0.2)'
            : isError
            ? '0 8px 32px rgba(239, 68, 68, 0.3), 0 2px 8px rgba(239, 68, 68, 0.2)'
            : isLoading
            ? '0 8px 32px rgba(59, 130, 246, 0.3), 0 2px 8px rgba(59, 130, 246, 0.2)'
            : '0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.15)';

          return (
            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 18px',
                borderRadius: '14px',
                background: bgColor,
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                boxShadow: glowColor,
                color: '#fff',
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                fontSize: '14px',
                fontWeight: 500,
                lineHeight: 1.4,
                maxWidth: '420px',
                minWidth: '300px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                position: 'relative',
                overflow: 'hidden',
                transform: t.visible ? 'translateX(0)' : 'translateX(120%)',
                opacity: t.visible ? 1 : 0,
                transition: 'all 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              {/* Animated Icon */}
              <div
                style={{
                  flexShrink: 0,
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isSuccess && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" style={{ strokeDasharray: 30, strokeDashoffset: t.visible ? 0 : 30, transition: 'stroke-dashoffset 0.5s ease 0.2s' }} />
                  </svg>
                )}
                {isError && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" style={{ strokeDasharray: 20, strokeDashoffset: t.visible ? 0 : 20, transition: 'stroke-dashoffset 0.4s ease 0.15s' }} />
                    <line x1="6" y1="6" x2="18" y2="18" style={{ strokeDasharray: 20, strokeDashoffset: t.visible ? 0 : 20, transition: 'stroke-dashoffset 0.4s ease 0.3s' }} />
                  </svg>
                )}
                {isLoading && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                )}
                {!isSuccess && !isError && !isLoading && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                )}
              </div>

              {/* Message */}
              <div style={{ flex: 1, letterSpacing: '0.01em' }}>
                {typeof t.message === 'function' ? t.message(t) : t.message}
              </div>

              {/* Close button */}
              {!isLoading && (
                <button
                  onClick={() => toast.dismiss(t.id)}
                  style={{
                    flexShrink: 0,
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    cursor: 'pointer',
                    padding: '4px 6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}

              {/* Auto-dismiss progress bar */}
              {!isLoading && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    height: '3px',
                    background: 'rgba(255, 255, 255, 0.4)',
                    borderRadius: '0 0 14px 14px',
                    width: t.visible ? '0%' : '100%',
                    transition: t.visible ? `width ${(t.duration || 4000) / 1000}s linear` : 'none',
                  }}
                />
              )}
            </div>
          );
        }}
      </Toaster>
      </LanguageProvider>
    </AuthProvider>
    </>
  );
}

export default App;

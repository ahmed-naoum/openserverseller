import { useState, useEffect, lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import MaintenanceGuard from './components/MaintenanceGuard';
import PageLoader from './components/PageLoader';
import { SweetAlertHost } from './components/ui/SweetAlert';
import { ToastStack } from './components/ui/Toast';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import DashboardLayout from './components/layouts/DashboardLayout';
import VendorDashboard from './pages/vendor/Dashboard';
import VendorProducts from './pages/vendor/Products';
import VendorLeads from './pages/vendor/Leads';

import VendorInventory from './pages/vendor/Inventory';
import VendorAbandonedCarts from './pages/vendor/AbandonedCarts';
import VendorSubAccounts from './pages/vendor/SubAccounts';
import AgentDashboard from './pages/agent/Dashboard';
import AgentStatistics from './pages/agent/Statistics';
import AgentLeads from './pages/agent/Leads';
import AgentMyLeads from './pages/agent/MyLeads';
import AgentAssignedLeads from './pages/agent/AssignedLeads';
import AgentLeadDetail from './pages/agent/LeadDetail';
import AgentOrders from './pages/agent/Orders';
import AgentLivraison from './pages/agent/Livraison';
import AgentFacturation from './pages/agent/Facturation';
import InsertLead from './pages/agent/InsertLead';
import ColiatyDispatch from './pages/agent/ColiatyDispatch';
import AgentAbandonedCarts from './pages/agent/AbandonedCarts';
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminProducts from './pages/admin/Products';
import AdminCategories from './pages/admin/AdminCategories';
import AdminOrders from './pages/admin/Orders';
import AdminFinance from './pages/admin/Finance';
import AdminFulfillment from './pages/admin/Fulfillment';
import AdminAffiliateClaims from './pages/admin/AffiliateClaims';
import AdminCampaigns from './pages/admin/Campaigns';
import AdminCustomers from './pages/admin/Customers';
import AdminAnnouncements from './pages/admin/Announcements';
import AdminVerifications from './pages/admin/AdminVerifications';
import AdminSupport from './pages/admin/Support';
import AdminLeads from './pages/admin/Leads';
import AdminPaymentMonitoring from './pages/admin/PaymentMonitoring';
import AdminInvoices from './pages/admin/Invoices';
import ActivityLogs from './pages/admin/ActivityLogs';
import BackupManager from './pages/admin/BackupManager';
import CallCenterInspector from './pages/admin/CallCenterInspector';
import CallCenterAnalytics from './pages/admin/CallCenterAnalytics';
import InfluencerInspector from './pages/admin/InfluencerInspector';
import SupportInspector from './pages/admin/SupportInspector';
import LiveStreamInspector from './pages/admin/LiveStreamInspector';
import LiveSessionTracker from './components/common/LiveSessionTracker';
import ContactMessages from './pages/admin/ContactMessages';
import AdminLinks from './pages/admin/Links';
import AdminProfessionalEmails from './pages/admin/ProfessionalEmails';
import PlatformArchitecture from './pages/admin/PlatformArchitecture';


import YouCanCallback from './pages/vendor/YouCanCallback';
import ShopifyCallback from './pages/vendor/ShopifyCallback';
import WooCommerceCallback from './pages/vendor/WooCommerceCallback';
import VendorInsertLead from './pages/vendor/InsertLead';
import VendorDomains from './pages/vendor/Domains';
import YouCanLeads from './pages/vendor/YouCanLeads';
import ShopifyLeads from './pages/vendor/ShopifyLeads';
import WooCommerceLeads from './pages/vendor/WooCommerceLeads';
import GoogleSheetsLeads from './pages/vendor/GoogleSheetsLeads';
import IntegrationsPage from './pages/vendor/IntegrationsPage';
import PlatformSettings from './pages/admin/PlatformSettings';
import AdminSecrets from './pages/admin/AdminSecrets';
import AdminDeployments from './pages/admin/Deployments';
import SecurityFirewall from './pages/admin/SecurityFirewall';
import AdminEventRegistrations from './pages/admin/AdminEventRegistrations';
import EventMasterclass from './pages/public/EventMasterclass';
import WebhookLogs from './pages/admin/WebhookLogs';
import WebhookTester from './pages/admin/WebhookTester';
import GrossellerDashboard from './pages/grosseller/Dashboard';
import GrossellerProfile from './pages/grosseller/Profile';
import GrossellerInventory from './pages/grosseller/Inventory';
import GrossellerMarketplace from './pages/grosseller/Marketplace';
import GrossellerAddProduct from './pages/grosseller/AddProduct';
import GrossellerSelling from './pages/grosseller/Selling';
import GrossellerPending from './pages/grosseller/Pending';
import GrossellerApproved from './pages/grosseller/Approved';
import GrossellerPayouts from './pages/grosseller/Payouts';
import GrossellerOrders from './pages/grosseller/Orders';
import UserInvoices from './pages/common/UserInvoices';
import GrossellerAnalytics from './pages/grosseller/Analytics';
import GrossellerSupport from './pages/grosseller/Support';
import InfluencerDashboard from './pages/influencer/Dashboard';
import InfluencerProfile from './pages/influencer/Profile';
import InfluencerLinks from './pages/influencer/Links';
import InfluencerCampaigns from './pages/influencer/Campaigns';
import InfluencerLeads from './pages/influencer/Leads';
const InfluencerMarketplace = lazy(() => import('./pages/influencer/Marketplace'));
import InfluencerInventory from './pages/influencer/Inventory';
import Notifications from './pages/common/Notifications';
import ConfirmationDashboard from './pages/confirmation/Dashboard';
import HelperDashboard from './pages/helper/Dashboard';
import HelperLeads from './pages/helper/Leads';
import HelperColis from './pages/helper/Colis';
import HelperRetours from './pages/helper/Retours';
import HelperTickets from './pages/helper/Tickets';
import HelperUsers from './pages/helper/Users';
import HelperLinks from './pages/helper/Links';
import HelperAffiliate from './pages/helper/HelperAffiliate';
import AdminHelpersAffiliate from './pages/admin/AdminHelpersAffiliate';
import SiteBuilder from './pages/helper/SiteBuilder';
import StudioPage from './studio/StudioPage';
import HelperScanner from './pages/helper/Scanner';
import Chat from './pages/common/Chat';
import AccountVerification from './pages/verify/AccountVerification';
import PublicMarketplace from './pages/marketplace/PublicMarketplace';
const ProductDetail = lazy(() => import('./pages/marketplace/ProductDetail'));
const ReferralForm = lazy(() => import('./pages/public/ReferralForm'));
const ThankYouPage = lazy(() => import('./pages/public/ThankYouPage'));
const ReferralThankYouPage = lazy(() => import('./pages/public/ReferralThankYouPage'));
import PendingVerificationPage from './pages/auth/PendingVerificationPage';
import EmailVerificationPage from './pages/auth/EmailVerificationPage';
import CompleteRegisterGoogle from './pages/auth/CompleteRegisterGoogle';
import SettingsPage from './pages/common/SettingsPage';
import NotFoundPage from './pages/common/NotFoundPage';
import ProfileVerification from './pages/common/ProfileVerification';
import MaintenancePage from './pages/common/MaintenancePage';
import SupportTickets from './pages/common/SupportTickets';
import UserWallet from './pages/common/UserWallet';
import UserPixels from './pages/common/UserPixels';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import FaqPage from './pages/FaqPage';
import ContactPage from './pages/ContactPage';
import AboutPage from './pages/AboutPage';
import CareersPage from './pages/CareersPage';
import BlogPage from './pages/BlogPage';
import PricingPage from './pages/PricingPage';
import ScrollToTop from './components/common/ScrollToTop';
import BlockedPage from './pages/common/BlockedPage';

// Context
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { StoreProvider, detectStoreHost, useStore } from './contexts/StoreContext';
import { CartProvider } from './contexts/CartContext';

// Storefront Pages
import StoreLayout from './pages/store/StoreLayout';
import StoreHomePage from './pages/store/StoreHomePage';
import StoreProductsPage from './pages/store/StoreProductsPage';
import StoreCollectionPage from './pages/store/StoreCollectionPage';
import StoreProductDetailPage from './pages/store/StoreProductDetailPage';
import StoreCartPage from './pages/store/StoreCartPage';
import StoreCheckoutPage from './pages/store/StoreCheckoutPage';
import StoreThankYouPage from './pages/store/StoreThankYouPage';
import StoreCustomPage from './pages/store/StoreCustomPage';

// Vendor Store Pages
import StoreOverview from './pages/vendor/store/StoreOverview';
import StoreSettings from './pages/vendor/store/StoreSettings';
import StoreThemeEditor from './pages/vendor/store/StoreThemeEditor';
import StoreThemes from './pages/vendor/store/StoreThemes';
import StoreCollections from './pages/vendor/store/StoreCollections';
import StoreProducts from './pages/vendor/store/StoreProducts';
import StoreCategories from './pages/vendor/store/StoreCategories';
import StorePagesManager from './pages/vendor/store/StorePagesManager';

// Guards
import RoleGuard from './components/auth/RoleGuard';
import UnauthGuard from './components/auth/UnauthGuard';
import SubAccountGuard from './components/auth/SubAccountGuard';
import { VENDOR_HELPER_BASE } from './lib/dashboardBase';
import SheetCreditsHistory from './pages/vendor/SheetCreditsHistory';
import { settingsApi } from './lib/api';

/* WhatsApp AI agent.

   Lazy rather than eager like most of the tree: the agent studio and the
   admin console each pull a heavy editor, and only a fraction of accounts
   ever open them. The vendor pair is mounted twice — once under /dashboard
   and once under /influencer — because a vendor and an influencer see the
   same two screens from their own prefix. */
const AiModelsPage = lazy(() => import('./pages/admin/AiModelsPage'));
const AgentAccountsPage = lazy(() => import('./pages/admin/AgentAccountsPage'));
const AgentLogsPage = lazy(() => import('./pages/admin/AgentLogsPage'));
const SheetPushesPage = lazy(() => import('./pages/admin/SheetPushesPage'));
const WhatsappAgentPage = lazy(() => import('./pages/vendor/WhatsappAgentPage'));
const WhatsappInboxPage = lazy(() => import('./pages/vendor/WhatsappInboxPage'));
const WhatsappLeadsPage = lazy(() => import('./pages/vendor/WhatsappLeadsPage'));

/** The spinner the other lazily-loaded dashboard pages already fall back to. */
const LazyDashboardPage = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="min-h-[400px] flex items-center justify-center p-8">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }
  >
    {children}
  </Suspense>
);

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

    // Fire-and-forget network request to backend to register the page view in the HTTP logs
    fetch('/api/v1/public/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: location.pathname }),
    }).catch(() => {});
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

function shouldShowPublicLogoLoader(pathname: string): boolean {
  // Explicitly exclude /r/ referral/offer landing pages (e.g. /r/4F4B028F)
  if (pathname.startsWith('/r/') || pathname === '/r') {
    return false;
  }

  // Explicitly exclude all protected / dashboard routes
  if (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/agent') ||
    pathname.startsWith('/influencer') ||
    pathname.startsWith('/grosseller') ||
    pathname.startsWith('/helper') ||
    pathname.startsWith('/confirmation')
  ) {
    return false;
  }

  // Public marketing & auth pages
  const publicExactPaths = [
    '/',
    '/login',
    '/register',
    '/register/complete-google',
    '/influencer/register',
    '/forgot-password',
    '/reset-password',
    '/marketplace',
    '/pricing',
    '/about',
    '/faq',
    '/faqs',
    '/contact',
    '/careers',
    '/blog',
    '/terms',
    '/privacy',
    '/privacy-policy',
    '/masterclass',
    '/event',
    '/pending-verification',
    '/maintenance',
    '/verify-email',
    '/blocked',
  ];

  if (publicExactPaths.includes(pathname)) return true;

  if (
    pathname.startsWith('/marketplace/') ||
    pathname.startsWith('/product/')
  ) {
    return true;
  }

  return false;
}

function App() {
  const [loading, setLoading] = useState(() => shouldShowPublicLogoLoader(window.location.pathname));

  useEffect(() => {
    if (!shouldShowPublicLogoLoader(location.pathname)) {
      setLoading(false);
    }
  }, [location.pathname]);

  // Automatic cache version checking and updating
  useEffect(() => {
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
  }, []);

  // A host that MIGHT be a storefront. Whether it actually is one is the
  // server's answer, not this function's — StorefrontGate below waits for it.
  const storeHostCandidate = detectStoreHost().isStore;

  if (storeHostCandidate) {
    return (
      <>
        <ScrollToTop />
        <AuthProvider>
          <StoreProvider>
            <CartProvider>
              <StorefrontGate platform={<PlatformApp loading={loading} setLoading={setLoading} />}>
              <Routes>
                {/* Landing pages own their chrome.

                    These deliberately sit OUTSIDE <StoreLayout>. A page built
                    in the builder carries its own site_header / site_footer
                    blocks, which the compiler renders into the static HTML a
                    visitor actually receives. Wrapping the React storefront
                    header and footer around it here produced a second set of
                    chrome in the SPA fallback that the compiled page does not
                    have — two different pages behind one URL, and the React
                    one paying for the whole app bundle before it could paint. */}
                <Route
                  path="r/:code"
                  element={
                    <Suspense
                      fallback={
                        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                          <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                      }
                    >
                      <ReferralForm />
                    </Suspense>
                  }
                />
                <Route
                  path="r/:code/thank-you"
                  element={
                    <Suspense
                      fallback={
                        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                      }
                    >
                      <ReferralThankYouPage />
                    </Suspense>
                  }
                />
                <Route element={<StoreLayout />}>
                  <Route index element={<StoreHomePage />} />
                  <Route path="products" element={<StoreProductsPage />} />
                  <Route path="collections/:slug" element={<StoreCollectionPage />} />
                  <Route path="p/:slug" element={<StoreProductDetailPage />} />
                  <Route path="products/:slug" element={<StoreProductDetailPage />} />
                  <Route path="product/:slug" element={<StoreProductDetailPage />} />
                  <Route path="cart" element={<StoreCartPage />} />
                  <Route path="checkout" element={<StoreCheckoutPage />} />
                  <Route path="order-confirmed" element={<StoreThankYouPage />} />
                  <Route path="thank-you" element={<StoreThankYouPage />} />
                  <Route path="pages/:slug" element={<StoreCustomPage />} />
                  {/* A real not-found, inside the shop's own chrome. The
                      catch-all used to render the home page, so every mistyped
                      or dead URL on a seller's domain answered 200 with the
                      shop front — invisible to the seller and to search. */}
                  <Route path="*" element={<StoreNotFound />} />
                </Route>
              </Routes>
              </StorefrontGate>
            </CartProvider>
          </StoreProvider>
        </AuthProvider>
      </>
    );
  }

  return <PlatformApp loading={loading} setLoading={setLoading} />;
}

/**
 * Holds the storefront back until the server has confirmed there is a shop on
 * this domain.
 *
 * Three outcomes. Resolved: the storefront renders. Still resolving: a neutral
 * splash, because painting either tree and swapping it is a flash of the wrong
 * site. Unresolved: the platform renders instead — a staging host, a subdomain
 * whose owner has no store, or a domain pointed here by mistake is not a shop,
 * and answering with an empty shop front taught visitors nothing and hid the
 * misconfiguration from the seller.
 *
 * The platform fallback is also what keeps sign-in reachable: a seller who
 * types their own subdomain and has no store still lands on the real site.
 */
function StorefrontGate({ children, platform }: { children: React.ReactNode; platform: React.ReactNode }) {
  const { isStorefront, loading } = useStore();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-3 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

  return <>{isStorefront ? children : platform}</>;
}

/** The shop's own 404, with a way back into the catalogue. */
function StoreNotFound() {
  const { store } = useStore();
  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center space-y-4">
      <p className="text-5xl font-black text-gray-900">404</p>
      <h1 className="text-xl font-bold text-gray-900">Cette page n'existe pas</h1>
      <p className="text-sm text-gray-600">
        Le lien que vous avez suivi est introuvable{store?.name ? ` sur ${store.name}` : ''}.
      </p>
      <a
        href="/products"
        className="inline-block px-5 py-2.5 rounded-xl text-sm font-bold text-white"
        style={{ background: store?.primaryColor || '#f97316' }}
      >
        Voir la boutique
      </a>
    </div>
  );
}

/** The platform: marketing site, sign-in and every dashboard. */
function PlatformApp({ loading, setLoading }: { loading: boolean; setLoading: (v: boolean) => void }) {
  const location = useLocation();

  return (
    <>
      <ScrollToTop />
      <YouCanQueryRedirector />
      <PageTracker />
      {loading && shouldShowPublicLogoLoader(location.pathname) && (
        <PageLoader onComplete={() => setLoading(false)} />
      )}
    <AuthProvider>
      <LanguageProvider>
          <SocketProvider>
            <LiveSessionTracker />
            <MaintenanceGuard>
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
            <Suspense fallback={
              <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            }>
              <ReferralForm />
            </Suspense>
          } />
          {/* Per-link thank-you page. The path keeps the '/thank-you' segment on
              purpose: the analytics lead signal in backend/src/index.ts matches
              on `path.includes('/thank-you')`, and moving off it would silently
              stop counting conversions. */}
          <Route path="/r/:code/thank-you" element={
            <Suspense fallback={
              <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            }>
              <ReferralThankYouPage />
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
            <Suspense fallback={
              <div className="min-h-[400px] flex items-center justify-center p-8">
                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            }>
              <InfluencerMarketplace />
            </Suspense>
          } />
          <Route path="product/:id" element={<ProductDetail />} />
          <Route path="chat" element={<Chat />} />
          <Route path="invoices" element={<UserInvoices />} />
          <Route path="settings" element={<SettingsPage />} />

          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="whatsapp-agent" element={
            <LazyDashboardPage><WhatsappAgentPage /></LazyDashboardPage>
          } />
          <Route path="whatsapp-inbox" element={
            <LazyDashboardPage><WhatsappInboxPage /></LazyDashboardPage>
          } />
          <Route path="whatsapp-leads" element={
            <LazyDashboardPage><WhatsappLeadsPage /></LazyDashboardPage>
          } />
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
          <Route path="sheet-credits" element={<SheetCreditsHistory />} />
          <Route path="woocommerce-callback" element={<WooCommerceCallback />} />

          <Route path="wallet" element={<UserWallet />} />
          <Route path="sub-accounts" element={<VendorSubAccounts />} />
          <Route path="inventory" element={<VendorInventory />} />
          <Route path="abandoned-carts" element={<VendorAbandonedCarts />} />
          <Route path="marketplace" element={
            <Suspense fallback={
              <div className="min-h-[400px] flex items-center justify-center p-8">
                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            }>
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
          {/* Vendor Store Management */}
          <Route path="store" element={<StoreOverview />} />
          <Route path="store/settings" element={<StoreSettings />} />
          <Route path="store/theme" element={<StoreThemeEditor />} />
          <Route path="store/themes" element={<StoreThemes />} />
          {/* The shop catalogue. Separate from "products" above, which is the
              marketplace list referral links and landing pages are built from. */}
          <Route path="store/products" element={<StoreProducts />} />
          <Route path="store/categories" element={<StoreCategories />} />
          <Route path="store/collections" element={<StoreCollections />} />
          <Route path="store/pages" element={<StorePagesManager />} />
          <Route path="links" element={<InfluencerLinks />} />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="whatsapp-agent" element={
            <LazyDashboardPage><WhatsappAgentPage /></LazyDashboardPage>
          } />
          <Route path="whatsapp-inbox" element={
            <LazyDashboardPage><WhatsappInboxPage /></LazyDashboardPage>
          } />
          <Route path="whatsapp-leads" element={
            <LazyDashboardPage><WhatsappLeadsPage /></LazyDashboardPage>
          } />
          <Route path="youcan-callback" element={<YouCanCallback />} />
          <Route path="shopify-callback" element={<ShopifyCallback />} />
          <Route path="invoices" element={<UserInvoices />} />
          <Route path="support" element={<SupportTickets />} />
          <Route path="verification" element={<ProfileVerification />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>

        {/* Vendor Sub-Account Dashboard

            The same page components as `/dashboard`, mounted under their own
            prefix: a sub-account and its vendor share every screen, and only the
            URL says which of the two trees the user is in (see lib/dashboardBase).

            Pages the vendor keeps to itself are absent rather than guarded:
            sub-account management, the integration OAuth callbacks (connecting a
            store stays with the owner) and profile verification (the KYC, bank
            and contract are the vendor's). Everything else is a grant, and
            SubAccountGuard turns an ungranted URL into a clean refusal instead of
            a page shell firing requests the API rejects. */}
        <Route path={VENDOR_HELPER_BASE} element={
          <RoleGuard allowedRoles={['VENDOR_HELPER']}>
            <DashboardLayout />
          </RoleGuard>
        }>
          <Route element={<SubAccountGuard />}>
            <Route index element={<VendorDashboard />} />
            <Route path="products" element={<VendorProducts />} />
            <Route path="leads" element={<VendorLeads />} />
            <Route path="leads/new" element={<VendorInsertLead />} />
            <Route path="youcan-leads" element={<YouCanLeads />} />
            <Route path="shopify-leads" element={<ShopifyLeads />} />
            <Route path="woocommerce-leads" element={<WooCommerceLeads />} />
            <Route path="google-sheets-leads" element={<GoogleSheetsLeads />} />
            <Route path="sheet-credits" element={<SheetCreditsHistory />} />
            <Route path="wallet" element={<UserWallet />} />
            <Route path="inventory" element={<VendorInventory />} />
            <Route path="abandoned-carts" element={<VendorAbandonedCarts />} />
            <Route path="marketplace" element={
              <Suspense fallback={
                <div className="min-h-[400px] flex items-center justify-center p-8">
                  <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              }>
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
          <Route path="statistics" element={<AgentStatistics />} />
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
          <RoleGuard allowedRoles={['SUPER_ADMIN', 'VENDOR', 'HELPER']}>
            <SiteBuilder />
          </RoleGuard>
        } />

        {/* The builder is full-screen, so it sits outside the layout like the
            others. SubAccountGuard still runs: opening a landing page is its own
            grant (`subCanUseLinkBuilder`), separate from seeing the links list. */}
        <Route path={`${VENDOR_HELPER_BASE}/links/:id/builder`} element={
          <RoleGuard allowedRoles={['VENDOR_HELPER']}>
            <SubAccountGuard />
          </RoleGuard>
        }>
          <Route index element={<SiteBuilder />} />
        </Route>

        <Route path="/influencer/links/:id/builder" element={
          <RoleGuard allowedRoles={['SUPER_ADMIN', 'INFLUENCER', 'HELPER', 'VENDOR']}>
            <SiteBuilder />
          </RoleGuard>
        } />

        <Route path="/admin/links/:id/builder" element={
          <RoleGuard allowedRoles={['SUPER_ADMIN', 'HELPER', 'VENDOR']}>
            <SiteBuilder />
          </RoleGuard>
        } />

        {/* Studio: the tree editor, same guards as the flat builder it succeeds.
            One path per dashboard so "back" returns to the right links list. */}
        {['/helper', '/dashboard', '/influencer', '/admin'].map((base) => (
          <Route key={base} path={`${base}/links/:id/studio`} element={
            <RoleGuard allowedRoles={['SUPER_ADMIN', 'HELPER', 'VENDOR', 'INFLUENCER']}>
              <StudioPage />
            </RoleGuard>
          } />
        ))}
        <Route path={`${VENDOR_HELPER_BASE}/links/:id/studio`} element={
          <RoleGuard allowedRoles={['VENDOR_HELPER']}>
            <SubAccountGuard />
          </RoleGuard>
        }>
          <Route index element={<StudioPage />} />
        </Route>

        {/* Studio on the store's own pages: the home page and each custom page. */}
        {['/dashboard/store/studio/home', '/dashboard/store/studio/header', '/dashboard/store/studio/footer', '/dashboard/store/studio/product', '/dashboard/store/studio/catalogue', '/dashboard/store/studio/pages/:pageId'].map((path) => (
          <Route key={path} path={path} element={
            <RoleGuard allowedRoles={['SUPER_ADMIN', 'VENDOR', 'INFLUENCER']}>
              <StudioPage />
            </RoleGuard>
          } />
        ))}
        {[`${VENDOR_HELPER_BASE}/store/studio/home`, `${VENDOR_HELPER_BASE}/store/studio/header`, `${VENDOR_HELPER_BASE}/store/studio/footer`, `${VENDOR_HELPER_BASE}/store/studio/product`, `${VENDOR_HELPER_BASE}/store/studio/catalogue`, `${VENDOR_HELPER_BASE}/store/studio/pages/:pageId`].map((path) => (
          <Route key={path} path={path} element={
            <RoleGuard allowedRoles={['VENDOR_HELPER']}>
              <SubAccountGuard />
            </RoleGuard>
          }>
            <Route index element={<StudioPage />} />
          </Route>
        ))}

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
          <Route path="ai-models" element={
            <RoleGuard allowedRoles={['SUPER_ADMIN']}>
              <LazyDashboardPage><AiModelsPage /></LazyDashboardPage>
            </RoleGuard>
          } />
          <Route path="agent-accounts" element={
            <RoleGuard allowedRoles={['SUPER_ADMIN']}>
              <LazyDashboardPage><AgentAccountsPage /></LazyDashboardPage>
            </RoleGuard>
          } />
          {/* Le journal porte des messages clients, comme la boîte de
              réception : même porte que les deux pages au-dessus. */}
          <Route path="agent-logs" element={
            <RoleGuard allowedRoles={['SUPER_ADMIN']}>
              <LazyDashboardPage><AgentLogsPage /></LazyDashboardPage>
            </RoleGuard>
          } />
          {/* Facturation : FINANCE_ADMIN vend les crédits, comme sur la page Finance. */}
          <Route path="sheet-pushes" element={
            <RoleGuard allowedRoles={['SUPER_ADMIN', 'FINANCE_ADMIN']}>
              <LazyDashboardPage><SheetPushesPage /></LazyDashboardPage>
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
          <Route path="call-center-analytics" element={<CallCenterAnalytics />} />
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
      </MaintenanceGuard>
      </SocketProvider>


      {/* Stacked, grouped notifications - see components/ui/Toast.tsx */}
      <ToastStack />
      {/* One dialog style for every confirm / alert / prompt — see swal in components/ui/SweetAlert. */}
      <SweetAlertHost />
      </LanguageProvider>
    </AuthProvider>
    </>
  );
}

export default App;

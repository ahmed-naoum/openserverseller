import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import MaintenanceGuard from './components/MaintenanceGuard';
import PageLoader from './components/PageLoader';
import toast, { Toaster } from 'react-hot-toast';

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
import AgentDashboard from './pages/agent/Dashboard';
import AgentLeads from './pages/agent/Leads';
import AgentMyLeads from './pages/agent/MyLeads';
import AgentLeadDetail from './pages/agent/LeadDetail';
import AgentOrders from './pages/agent/Orders';
import AgentLivraison from './pages/agent/Livraison';
import InsertLead from './pages/agent/InsertLead';
import ColiatyDispatch from './pages/agent/ColiatyDispatch';
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
import InfluencerInspector from './pages/admin/InfluencerInspector';
import SupportInspector from './pages/admin/SupportInspector';
import ContactMessages from './pages/admin/ContactMessages';
import AdminLinks from './pages/admin/Links';

import YouCanCallback from './pages/vendor/YouCanCallback';
import VendorInsertLead from './pages/vendor/InsertLead';
import VendorDomains from './pages/vendor/Domains';
import YouCanLeads from './pages/vendor/YouCanLeads';
import IntegrationsPage from './pages/vendor/IntegrationsPage';
import PlatformSettings from './pages/admin/PlatformSettings';
import SecurityFirewall from './pages/admin/SecurityFirewall';
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
import SiteBuilder from './pages/helper/SiteBuilder';
import HelperScanner from './pages/helper/Scanner';
import Chat from './pages/common/Chat';
import AccountVerification from './pages/verify/AccountVerification';
import PublicMarketplace from './pages/marketplace/PublicMarketplace';
import ProductDetail from './pages/marketplace/ProductDetail';
import ReferralForm from './pages/public/ReferralForm';
import ThankYouPage from './pages/public/ThankYouPage';
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

// Guards
import RoleGuard from './components/auth/RoleGuard';
import UnauthGuard from './components/auth/UnauthGuard';
import { settingsApi } from './lib/api';

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

function App() {
  const [loading, setLoading] = useState(true);

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

  return (
    <>
      <ScrollToTop />
      <PageTracker />
      {loading && <PageLoader onComplete={() => setLoading(false)} />}
    <AuthProvider>
      <LanguageProvider>
      <SocketProvider>
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
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/r/:code" element={<ReferralForm />} />
          <Route path="/thank-you" element={<ThankYouPage />} />
          <Route path="/pending-verification" element={<PendingVerificationPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/careers" element={<CareersPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/pricing" element={<PricingPage />} />
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
            <Suspense fallback={<PageLoader />}>
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

          <Route path="wallet" element={<UserWallet />} />
          <Route path="inventory" element={<VendorInventory />} />
          <Route path="marketplace" element={
            <Suspense fallback={<PageLoader />}>
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
          <Route path="invoices" element={<UserInvoices />} />
          <Route path="support" element={<SupportTickets />} />
          <Route path="verification" element={<ProfileVerification />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>

        {/* Agent Dashboard */}
        <Route path="/agent" element={
          <RoleGuard allowedRoles={['CALL_CENTER_AGENT']}>
            <DashboardLayout />
          </RoleGuard>
        }>
          <Route index element={<AgentDashboard />} />
          <Route path="leads" element={<AgentLeads />} />
          <Route path="insert-lead" element={<InsertLead />} />
          <Route path="dispatch" element={<Navigate to="/agent/insert-lead" replace />} />
          <Route path="my-leads" element={<AgentMyLeads />} />
          <Route path="leads/:id" element={<AgentLeadDetail />} />
          <Route path="orders" element={<AgentOrders />} />
          <Route path="livraison" element={<AgentLivraison />} />
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
          <Route path="categories" element={<AdminCategories />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="finance" element={<AdminFinance />} />
          <Route path="support" element={<SupportTickets />} />
          <Route path="invoices" element={<AdminInvoices />} />
          <Route path="affiliate-claims" element={<AdminAffiliateClaims />} />
          <Route path="announcements" element={<AdminAnnouncements />} />
          <Route path="campaigns" element={<AdminCampaigns />} />
          <Route path="verifications" element={<AdminVerifications />} />
          <Route path="platform-settings" element={<PlatformSettings />} />
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

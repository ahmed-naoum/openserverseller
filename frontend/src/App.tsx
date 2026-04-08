import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import MaintenanceGuard from './components/MaintenanceGuard';
import PageLoader from './components/PageLoader';
import toast, { Toaster } from 'react-hot-toast';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import InfluencerRegister from './pages/auth/InfluencerRegister';
import DashboardLayout from './components/layouts/DashboardLayout';
import VendorDashboard from './pages/vendor/Dashboard';
import VendorProducts from './pages/vendor/Products';
import VendorLeads from './pages/vendor/Leads';
import VendorOrders from './pages/vendor/Orders';
import VendorWallet from './pages/vendor/Wallet';
import VendorBrands from './pages/vendor/Brands';
import VendorInventory from './pages/vendor/Inventory';
import AgentDashboard from './pages/agent/Dashboard';
import AgentLeads from './pages/agent/Leads';
import AgentMyLeads from './pages/agent/MyLeads';
import AgentLeadDetail from './pages/agent/LeadDetail';
import AgentOrders from './pages/agent/Orders';
import AgentLivraison from './pages/agent/Livraison';
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminBrands from './pages/admin/Brands';
import AdminProducts from './pages/admin/Products';
import AdminCategories from './pages/admin/AdminCategories';
import AdminOrders from './pages/admin/Orders';
import AdminFinance from './pages/admin/Finance';
import AdminFulfillment from './pages/admin/Fulfillment';
import AdminAffiliateClaims from './pages/admin/AffiliateClaims';
import AdminCampaigns from './pages/admin/Campaigns';
import AdminCustomers from './pages/admin/Customers';
import AdminAnnouncements from './pages/admin/Announcements';
import AdminLeadHistory from './pages/admin/LeadHistory';
import ProductCustomizePage from './pages/vendor/ProductCustomizePage';
import YouCanCallback from './pages/vendor/YouCanCallback';
import YouCanLeads from './pages/vendor/YouCanLeads';
import IntegrationsPage from './pages/vendor/IntegrationsPage';
import PlatformSettings from './pages/admin/PlatformSettings';
import SecurityFirewall from './pages/admin/SecurityFirewall';
import WebhookLogs from './pages/admin/WebhookLogs';
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
import GrossellerAnalytics from './pages/grosseller/Analytics';
import GrossellerSupport from './pages/grosseller/Support';
import InfluencerDashboard from './pages/influencer/Dashboard';
import InfluencerProfile from './pages/influencer/Profile';
import InfluencerWallet from './pages/influencer/Wallet';
import InfluencerLinks from './pages/influencer/Links';
import InfluencerCampaigns from './pages/influencer/Campaigns';
import InfluencerAnalytics from './pages/influencer/Analytics';
import InfluencerLeads from './pages/influencer/Leads';
import InfluencerNotifications from './pages/influencer/Notifications';
import InfluencerMarketplace from './pages/influencer/Marketplace';
import InfluencerInventory from './pages/influencer/Inventory';
import ConfirmationDashboard from './pages/confirmation/Dashboard';
import Chat from './pages/common/Chat';
import AccountVerification from './pages/verify/AccountVerification';
import PublicMarketplace from './pages/marketplace/PublicMarketplace';
import ProductDetail from './pages/marketplace/ProductDetail';
import ReferralForm from './pages/public/ReferralForm';
import ThankYouPage from './pages/public/ThankYouPage';
import PendingVerificationPage from './pages/auth/PendingVerificationPage';
import SettingsPage from './pages/common/SettingsPage';
import NotFoundPage from './pages/common/NotFoundPage';
import ProfileVerification from './pages/common/ProfileVerification';
import MaintenancePage from './pages/common/MaintenancePage';

// Context
import { AuthProvider } from './contexts/AuthContext';

// Guards
import RoleGuard from './components/auth/RoleGuard';

function App() {
  const [loading, setLoading] = useState(true);

  return (
    <>
      {loading && <PageLoader onComplete={() => setLoading(false)} />}
    <AuthProvider>
      <MaintenanceGuard>
        <Routes>
          {/* Public Routes */}
          <Route path="/maintenance" element={<MaintenancePage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/influencer/register" element={<InfluencerRegister />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/marketplace" element={<PublicMarketplace />} />
          <Route path="/marketplace/:view" element={<PublicMarketplace />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/r/:code" element={<ReferralForm />} />
          <Route path="/thank-you" element={<ThankYouPage />} />
          <Route path="/pending-verification" element={<PendingVerificationPage />} />

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
          <Route path="payouts" element={<GrossellerPayouts />} />
          <Route path="orders" element={<GrossellerOrders />} />
          <Route path="analytics" element={<GrossellerAnalytics />} />
          <Route path="support" element={<GrossellerSupport />} />
          <Route path="marketplace" element={<GrossellerMarketplace />} />
          <Route path="product/:id" element={<ProductDetail />} />
          <Route path="chat" element={<Chat />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="verification" element={<ProfileVerification />} />
        </Route>

        {/* Influencer Dashboard */}
        <Route path="/influencer" element={
          <RoleGuard allowedRoles={['INFLUENCER']}>
            <DashboardLayout />
          </RoleGuard>
        }>
          <Route index element={<InfluencerDashboard />} />
          <Route path="profile" element={<InfluencerProfile />} />
          <Route path="wallet" element={<InfluencerWallet />} />
          <Route path="links" element={<InfluencerLinks />} />
          <Route path="campaigns" element={<InfluencerCampaigns />} />
          <Route path="analytics" element={<InfluencerAnalytics />} />
          <Route path="leads" element={<InfluencerLeads />} />
          <Route path="youcan-leads" element={<YouCanLeads />} />
          <Route path="notifications" element={<InfluencerNotifications />} />
          <Route path="inventory" element={<InfluencerInventory />} />
          <Route path="marketplace" element={<InfluencerMarketplace />} />
          <Route path="product/:id" element={<ProductDetail />} />
          <Route path="chat" element={<Chat />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="verification" element={<ProfileVerification />} />
        </Route>

        {/* Confirmation Agent Dashboard */}
        <Route path="/confirmation" element={
          <RoleGuard allowedRoles={['CONFIRMATION_AGENT']}>
            <DashboardLayout />
          </RoleGuard>
        }>
          <Route index element={<ConfirmationDashboard />} />
          <Route path="marketplace" element={<PublicMarketplace />} />
          <Route path="product/:id" element={<ProductDetail />} />
          <Route path="chat" element={<Chat />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="verification" element={<ProfileVerification />} />
        </Route>

        {/* Vendor Dashboard (Seller-Affiliate with mode switching) */}
        <Route path="/dashboard" element={
          <RoleGuard allowedRoles={['VENDOR']}>
            <DashboardLayout />
          </RoleGuard>
        }>
          <Route index element={<VendorDashboard />} />
          <Route path="brands" element={<VendorBrands />} />
          <Route path="products" element={<VendorProducts />} />
          <Route path="leads" element={<VendorLeads />} />
          <Route path="youcan-leads" element={<YouCanLeads />} />
          <Route path="orders" element={<VendorOrders />} />
          <Route path="wallet" element={<VendorWallet />} />
          <Route path="inventory" element={<VendorInventory />} />
          <Route path="marketplace" element={<PublicMarketplace />} />
          <Route path="product/:id" element={<ProductDetail />} />
          <Route path="chat" element={<Chat />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="integrations" element={<IntegrationsPage />} />
          <Route path="youcan-callback" element={<YouCanCallback />} />
          <Route path="verification" element={<ProfileVerification />} />
        </Route>

        {/* Agent Dashboard */}
        <Route path="/agent" element={
          <RoleGuard allowedRoles={['CALL_CENTER_AGENT']}>
            <DashboardLayout />
          </RoleGuard>
        }>
          <Route index element={<AgentDashboard />} />
          <Route path="leads" element={<AgentLeads />} />
          <Route path="my-leads" element={<AgentMyLeads />} />
          <Route path="leads/:id" element={<AgentLeadDetail />} />
          <Route path="orders" element={<AgentOrders />} />
          <Route path="livraison" element={<AgentLivraison />} />
          <Route path="marketplace" element={<PublicMarketplace />} />
          <Route path="product/:id" element={<ProductDetail />} />
          <Route path="chat" element={<Chat />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="verification" element={<ProfileVerification />} />
        </Route>

        {/* Admin Dashboard */}
        <Route path="/admin" element={
          <RoleGuard allowedRoles={['SUPER_ADMIN', 'FINANCE_ADMIN']}>
            <DashboardLayout />
          </RoleGuard>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="brands" element={<AdminBrands />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="finance" element={<AdminFinance />} />
          <Route path="fulfillment" element={<AdminFulfillment />} />
          <Route path="affiliate-claims" element={<AdminAffiliateClaims />} />
          <Route path="announcements" element={<AdminAnnouncements />} />
          <Route path="campaigns" element={<AdminCampaigns />} />
          <Route path="lead-history" element={<AdminLeadHistory />} />
          <Route path="platform-settings" element={<PlatformSettings />} />
          <Route path="security" element={<SecurityFirewall />} />
          <Route path="webhook-logs" element={<WebhookLogs />} />
          <Route path="marketplace" element={<PublicMarketplace />} />
          <Route path="product/:id" element={<ProductDetail />} />
          <Route path="chat" element={<Chat />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="verification" element={<ProfileVerification />} />
        </Route>

          {/* Catch-all 404 Route */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MaintenanceGuard>


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
    </AuthProvider>
    </>
  );
}

export default App;

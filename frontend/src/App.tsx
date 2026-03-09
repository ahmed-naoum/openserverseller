import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
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
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminBrands from './pages/admin/Brands';
import AdminProducts from './pages/admin/Products';
import AdminOrders from './pages/admin/Orders';
import AdminFinance from './pages/admin/Finance';
import AdminFulfillment from './pages/admin/Fulfillment';
import AdminAffiliateClaims from './pages/admin/AffiliateClaims';
import AdminCampaigns from './pages/admin/Campaigns';
import AdminCustomers from './pages/admin/Customers';
import GrossellerDashboard from './pages/grosseller/Dashboard';
import GrossellerProfile from './pages/grosseller/Profile';
import GrossellerInventory from './pages/grosseller/Inventory';
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

// Context
import { AuthProvider } from './contexts/AuthContext';

// Guards
import RoleGuard from './components/auth/RoleGuard';

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/influencer/register" element={<InfluencerRegister />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/marketplace" element={<PublicMarketplace />} />
        <Route path="/marketplace/:view" element={<PublicMarketplace />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/r/:code" element={<ReferralForm />} />

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
          <Route path="marketplace" element={<PublicMarketplace />} />
          <Route path="product/:id" element={<ProductDetail />} />
          <Route path="chat" element={<Chat />} />
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
          <Route path="notifications" element={<InfluencerNotifications />} />
          <Route path="inventory" element={<InfluencerInventory />} />
          <Route path="marketplace" element={<InfluencerMarketplace />} />
          <Route path="product/:id" element={<ProductDetail />} />
          <Route path="chat" element={<Chat />} />
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
          <Route path="orders" element={<VendorOrders />} />
          <Route path="wallet" element={<VendorWallet />} />
          <Route path="inventory" element={<VendorInventory />} />
          <Route path="marketplace" element={<PublicMarketplace />} />
          <Route path="product/:id" element={<ProductDetail />} />
          <Route path="chat" element={<Chat />} />
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
          <Route path="marketplace" element={<PublicMarketplace />} />
          <Route path="product/:id" element={<ProductDetail />} />
          <Route path="chat" element={<Chat />} />
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
          <Route path="products" element={<AdminProducts />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="finance" element={<AdminFinance />} />
          <Route path="fulfillment" element={<AdminFulfillment />} />
          <Route path="affiliate-claims" element={<AdminAffiliateClaims />} />
          <Route path="campaigns" element={<AdminCampaigns />} />
          <Route path="marketplace" element={<PublicMarketplace />} />
          <Route path="product/:id" element={<ProductDetail />} />
          <Route path="chat" element={<Chat />} />
        </Route>
      </Routes>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            style: {
              background: '#22c55e',
            },
          },
          error: {
            style: {
              background: '#ef4444',
            },
          },
        }}
      />
    </AuthProvider>
  );
}

export default App;

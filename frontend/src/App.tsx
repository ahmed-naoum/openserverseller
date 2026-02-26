import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
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
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminBrands from './pages/admin/Brands';
import AdminProducts from './pages/admin/Products';
import AdminOrders from './pages/admin/Orders';
import AdminFinance from './pages/admin/Finance';
import AdminFulfillment from './pages/admin/Fulfillment';
import GrossellerDashboard from './pages/grosseller/Dashboard';
import Chat from './pages/common/Chat';
import AccountVerification from './pages/verify/AccountVerification';
import PublicMarketplace from './pages/marketplace/PublicMarketplace';
import ProductDetail from './pages/marketplace/ProductDetail';

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
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/marketplace" element={<PublicMarketplace />} />
        <Route path="/product/:id" element={<ProductDetail />} />

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
          <Route path="chat" element={<Chat />} />
          {/* We will add grosseller subroutes later once confirmed */}
        </Route>

        {/* Vendor Dashboard */}
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
          <Route path="brands" element={<AdminBrands />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="finance" element={<AdminFinance />} />
          <Route path="fulfillment" element={<AdminFulfillment />} />
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

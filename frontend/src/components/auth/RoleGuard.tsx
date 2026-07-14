import { useAuth } from '../../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
  fallbackPath?: string;
}

export default function RoleGuard({ children, allowedRoles, fallbackPath }: RoleGuardProps) {
  const { user, isAuthenticated, isLoading, platformSettings } = useAuth();

  if (isLoading || !platformSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  if (!user.isActive && user.role !== 'UNCONFIRMED') {
    // If the system requires manual approval, redirect to pending-verification.
    // Otherwise, allow the inactive user to access the dashboard so they can complete KYC, Bank, and Contract steps.
    if (user.requiresManualApproval) {
      return <Navigate to="/pending-verification" replace />;
    }
  }

  if (!allowedRoles.includes(user.role)) {
    const defaultPath = getDefaultPath(user.role);
    return <Navigate to={fallbackPath || defaultPath} replace />;
  }

  return <>{children}</>;
}

function getDefaultPath(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'FINANCE_ADMIN':
    case 'SYSTEM_SUPPORT':
      return '/admin';
    case 'CALL_CENTER_AGENT':
      return '/agent';
    case 'FULFILLMENT_OPERATOR':
      return '/warehouse';
    case 'COURIER_PARTNER':
      return '/courier';
    case 'GROSSELLER':
      return '/grosseller';
    case 'INFLUENCER':
      return '/influencer';
    case 'CONFIRMATION_AGENT':
      return '/confirmation';
    case 'HELPER':
      return '/helper';
    case 'UNCONFIRMED':
      return '/verify';
    default:
      return '/dashboard';
  }
}

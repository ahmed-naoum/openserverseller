import { useAuth } from '../../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
  fallbackPath?: string;
}

export default function RoleGuard({ children, allowedRoles, fallbackPath }: RoleGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
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
    case 'UNCONFIRMED':
      return '/verify';
    default:
      return '/dashboard';
  }
}

import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface UnauthGuardProps {
  children: React.ReactNode;
}

export default function UnauthGuard({ children }: UnauthGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (isAuthenticated && user) {
    return <Navigate to={getDefaultPath(user.role)} replace />;
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

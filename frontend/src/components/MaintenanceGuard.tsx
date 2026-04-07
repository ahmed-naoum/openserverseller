import { useEffect, useState, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { settingsApi } from '../lib/api';

interface Props {
  children: ReactNode;
}

export default function MaintenanceGuard({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Skip check if already on the maintenance page
    if (location.pathname === '/maintenance') {
      setChecked(true);
      return;
    }

    const bypassToken = localStorage.getItem('maintenance_bypass');

    settingsApi.getMaintenanceStatus()
      .then((res) => {
        const enabled = res.data?.data?.enabled;
        if (enabled && !bypassToken) {
          navigate('/maintenance', { replace: true });
        } else if (!enabled && bypassToken) {
          // Maintenance was turned off — clean up bypass token
          localStorage.removeItem('maintenance_bypass');
        }
      })
      .catch(() => {
        // If status check fails, don't block the user
      })
      .finally(() => {
        setChecked(true);
      });
  }, [location.pathname]);

  if (!checked && location.pathname !== '/maintenance') {
    // Return null while checking to avoid clashing with App's PageLoader
    return null;
  }

  return <>{children}</>;
}

import { useEffect, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { settingsApi } from '../lib/api';

interface Props {
  children: ReactNode;
}

/**
 * Routes that never wait on the maintenance check.
 *
 * `/r/` is a customer's view of a vendor's offer, reached from a paid ad. It
 * keeps selling while the rest of the platform is down, so there is nothing for
 * it to wait for — and it is the one page where a delay costs an order.
 */
const isExemptPath = (pathname: string) =>
  pathname === '/maintenance' || pathname.startsWith('/r/');

export default function MaintenanceGuard({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isExemptPath(location.pathname)) return;

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
      });
  }, [location.pathname]);

  /**
   * Rendered immediately rather than held back until the check resolves.
   *
   * This used to `return null` until the request finished, which put a network
   * round trip in front of the first paint of every route — and because the
   * route tree was not mounted, it also delayed the lazy chunk fetch and the
   * page's own data fetch behind it. One blocking call was costing three
   * round trips of serialisation.
   *
   * A maintenance window now redirects a moment after paint instead of before
   * it. That is the whole regression: during an actual outage a visitor sees
   * the page briefly before being sent to /maintenance.
   */
  return <>{children}</>;
}

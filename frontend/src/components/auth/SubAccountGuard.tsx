import { Outlet, useLocation, Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { VENDOR_HELPER_BASE } from '../../lib/dashboardBase';
import { requiredPermissionForPage, subCan } from '../../lib/subAccountPermissions';

/**
 * Blocks pages of the sub-account dashboard the vendor did not grant.
 *
 * The sidebar already hides them, but hiding a link is not blocking a URL: a
 * helper who types or bookmarks one would otherwise get the full page shell
 * firing requests the API refuses, which reads as a broken app rather than a
 * boundary. The API is still the thing that actually enforces access — this
 * only makes the refusal legible.
 */
export default function SubAccountGuard() {
  const { user } = useAuth();
  const location = useLocation();

  const page = location.pathname.replace(VENDOR_HELPER_BASE, '') || '/';
  const needed = requiredPermissionForPage(page);

  if (needed && !subCan(user, needed)) {
    return (
      <div className="p-6 sm:p-10 max-w-lg mx-auto">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-5">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black text-gray-900 mb-2">Section non accordée</h2>
          <p className="text-sm text-gray-500 font-medium mb-6">
            Le titulaire du compte vendeur ne vous a pas donné accès à cette page. Demandez-lui de
            l'activer depuis ses sous-comptes.
          </p>
          <Link
            to={VENDOR_HELPER_BASE}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white bg-primary-600 hover:bg-primary-700 transition-colors"
          >
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    );
  }

  return <Outlet />;
}

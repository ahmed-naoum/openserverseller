import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => adminApi.dashboard(),
  });

  const dashboardData = data?.data?.data;
  const stats = dashboardData?.stats;

  if (isLoading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="card p-6">
        <h2 className="text-2xl font-bold text-gray-900">Tableau de bord Admin 🛡️</h2>
        <p className="text-gray-600 mt-1">Vue d'ensemble de la plateforme SILACOD</p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Utilisateurs</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.users?.total || 0}</p>
              <p className="text-xs text-gray-400">{stats?.users?.vendors || 0} vendeurs</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">👥</div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Commandes</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.orders?.total || 0}</p>
              <p className="text-xs text-yellow-500">{stats?.orders?.pending || 0} en attente</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center text-2xl">📦</div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Revenus</p>
              <p className="text-2xl font-bold text-gray-900">{Number(stats?.revenue?.total || 0).toLocaleString()}</p>
              <p className="text-xs text-gray-400">MAD</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-2xl">💰</div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Marques</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.brands?.total || 0}</p>
              <p className="text-xs text-yellow-500">{stats?.brands?.pending || 0} en attente</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-2xl">🏷️</div>
          </div>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Leads</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Total</span>
              <span className="font-medium">{stats?.leads?.total || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Non assignés</span>
              <span className="font-medium text-yellow-600">{stats?.leads?.unassigned || 0}</span>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Paiements</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Total retiré</span>
              <span className="font-medium">{Number(stats?.payouts?.total || 0).toLocaleString()} MAD</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">En attente</span>
              <span className="font-medium text-yellow-600">{stats?.payouts?.pending || 0}</span>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Produits</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Catalogue</span>
              <span className="font-medium">{stats?.products || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Vendors */}
      {dashboardData?.topVendors && dashboardData.topVendors.length > 0 && (
        <div className="card">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Top Vendeurs</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {dashboardData.topVendors.map((vendor: any, index: number) => (
              <div key={vendor.uuid} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-semibold">
                    {index + 1}
                  </div>
                  <span className="font-medium text-gray-900">{vendor.fullName}</span>
                </div>
                <span className="font-semibold text-gray-900">{Number(vendor.totalRevenue).toLocaleString()} MAD</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

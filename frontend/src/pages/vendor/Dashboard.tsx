import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { ordersApi, leadsApi, walletApi, brandsApi, dashboardApi } from '../../lib/api';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function VendorDashboard() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const { data: dashboardData } = useQuery({
    queryKey: ['vendor-dashboard'],
    queryFn: () => dashboardApi.sellerAffiliate(),
  });

  const switchModeMutation = useMutation({
    mutationFn: (mode: 'SELLER' | 'AFFILIATE') => dashboardApi.switchMode(mode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-dashboard'] });
      refreshUser();
      toast.success('Mode switched successfully!');
    },
    onError: () => {
      toast.error('Failed to switch mode');
    },
  });

  const currentMode = dashboardData?.data?.mode || user?.mode || 'SELLER';

  const { data: walletData } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletApi.get(),
  });

  const { data: ordersData } = useQuery({
    queryKey: ['orders', { limit: 5 }],
    queryFn: () => ordersApi.list({ limit: 5 }),
  });

  const { data: leadsData } = useQuery({
    queryKey: ['leads', { limit: 5 }],
    queryFn: () => leadsApi.list({ limit: 5 }),
  });

  const { data: brandsData } = useQuery({
    queryKey: ['brands'],
    queryFn: () => brandsApi.list(),
  });

  const wallet = walletData?.data?.data;
  const orders = ordersData?.data?.data?.orders || [];
  const leads = leadsData?.data?.data?.leads || [];
  const brands = brandsData?.data?.data?.brands || [];

  const stats = [
    { label: 'Solde', value: `${Number(wallet?.balanceMad || 0).toLocaleString()} MAD`, icon: '💰', color: 'green' },
    { label: 'Commandes', value: orders.length, icon: '📦', color: 'blue' },
    { label: 'Prospects', value: leads.length, icon: '📞', color: 'purple' },
    { label: 'Marques', value: brands.length, icon: '🏷️', color: 'orange' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Bienvenue, {user?.fullName || 'Vendeur'}! 👋
            </h2>
            <p className="text-gray-600 mt-1">
              Voici un aperçu de votre activité sur OpenSeller.ma
            </p>
          </div>
          
          {/* Mode Switcher */}
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => switchModeMutation.mutate('SELLER')}
              disabled={currentMode === 'SELLER'}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                currentMode === 'SELLER'
                  ? 'bg-white text-primary-600 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Mode Vendeur
            </button>
            <button
              onClick={() => switchModeMutation.mutate('AFFILIATE')}
              disabled={currentMode === 'AFFILIATE'}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                currentMode === 'AFFILIATE'
                  ? 'bg-white text-primary-600 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Mode Affilié
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${
                stat.color === 'green' ? 'bg-green-100' :
                stat.color === 'blue' ? 'bg-blue-100' :
                stat.color === 'purple' ? 'bg-purple-100' :
                'bg-orange-100'
              }`}>
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4">
        <Link to="/dashboard/brands" className="card-hover p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center text-2xl">🎨</div>
          <div>
            <div className="font-semibold text-gray-900">Créer une marque</div>
            <div className="text-sm text-gray-500">Personnalisez votre identité</div>
          </div>
        </Link>
        <Link to="/dashboard/leads" className="card-hover p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">📤</div>
          <div>
            <div className="font-semibold text-gray-900">Importer des prospects</div>
            <div className="text-sm text-gray-500">CSV ou intégration API</div>
          </div>
        </Link>
        <Link to="/dashboard/wallet" className="card-hover p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-2xl">💸</div>
          <div>
            <div className="font-semibold text-gray-900">Demander un retrait</div>
            <div className="text-sm text-gray-500">Via RIB/ICE</div>
          </div>
        </Link>
      </div>

      {/* Recent Orders */}
      <div className="card">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Commandes récentes</h3>
          <Link to="/dashboard/orders" className="text-sm text-primary-600 hover:text-primary-700">
            Voir tout →
          </Link>
        </div>
        <div className="divide-y divide-gray-100">
          {orders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Aucune commande pour le moment
            </div>
          ) : (
            orders.map((order: any) => (
              <div key={order.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">{order.orderNumber}</div>
                  <div className="text-sm text-gray-500">{order.customerName}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">{Number(order.totalAmountMad).toLocaleString()} MAD</div>
                  <span className={`badge-${order.status === 'DELIVERED' ? 'success' : order.status === 'PENDING' ? 'warning' : 'gray'}`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Leads */}
      <div className="card">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Prospects récents</h3>
          <Link to="/dashboard/leads" className="text-sm text-primary-600 hover:text-primary-700">
            Voir tout →
          </Link>
        </div>
        <div className="divide-y divide-gray-100">
          {leads.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Aucun prospect pour le moment
            </div>
          ) : (
            leads.map((lead: any) => (
              <div key={lead.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">{lead.fullName}</div>
                  <div className="text-sm text-gray-500">{lead.phone}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">{lead.city}</div>
                  <span className={`badge-${lead.status === 'NEW' ? 'primary' : lead.status === 'INTERESTED' ? 'success' : 'gray'}`}>
                    {lead.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

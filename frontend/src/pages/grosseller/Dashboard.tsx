import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../lib/api';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['grosseller-dashboard'],
    queryFn: () => dashboardApi.grosseller(),
  });

  const stats = dashboardData?.data?.data?.stats || {
    totalPurchasedValue: 0,
    recentSalesValue: 0,
    pendingPayoutsAmount: 0,
    lowStockAlerts: 0,
  };
  
  const products = dashboardData?.data?.data?.products || [];
  const pendingProducts = dashboardData?.data?.data?.pendingProducts || [];
  const approvedProducts = dashboardData?.data?.data?.approvedProducts || [];
  const recentOrders = dashboardData?.data?.data?.recentOrders || [];

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-gray-500">Chargement de la vue d'ensemble...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vue d'ensemble Grosseller</h1>
          <p className="mt-1 text-sm text-gray-500">Bienvenue. Voici l'état de votre activité B2B.</p>
        </div>
      </div>

      {/* Top Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Purchased Inventory Value */}
        <div className="card p-5 border-l-4 border-l-grosseller-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Valeur d'Inventaire Acheté</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{Number(stats.totalPurchasedValue).toLocaleString()} MAD</h3>
            </div>
            <div className="p-2 bg-grosseller-50 text-grosseller-600 rounded-lg">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            </div>
          </div>
        </div>

        {/* Recent Sales (30 Days) */}
        <div className="card p-5 border-l-4 border-l-green-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Ventes (30 jours)</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{Number(stats.recentSalesValue).toLocaleString()} MAD</h3>
            </div>
            <div className="p-2 bg-green-50 text-green-600 rounded-lg">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
        </div>

        {/* Pending Payouts */}
        <div className="card p-5 border-l-4 border-l-orange-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Paiements en Attente</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{Number(stats.pendingPayoutsAmount).toLocaleString()} MAD</h3>
            </div>
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            </div>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="card p-5 border-l-4 border-l-red-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Alertes Stock Faible</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{stats.lowStockAlerts}</h3>
            </div>
            <div className="p-2 bg-red-50 text-red-600 rounded-lg">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Stats Group */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Actifs au Marché</p>
            <p className="text-xl font-bold">{approvedProducts.length} Produits</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-yellow-50 text-yellow-600 rounded-lg">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">En Attente d'Approbation</p>
            <p className="text-xl font-bold">{pendingProducts.length} Produits</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total de vos Produits</p>
            <p className="text-xl font-bold">{products.length} Produits</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="card p-6 h-fit">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Actions Rapides</h2>
          <div className="space-y-3">
            <Link to="/grosseller/add-product" className="w-full flex items-center justify-between p-3 rounded-lg bg-grosseller-50 text-grosseller-700 hover:bg-grosseller-100 transition-colors border border-grosseller-100">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-grosseller-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                <span className="font-medium">Ajouter au Marché</span>
              </div>
            </Link>
            <Link to="/grosseller/payouts" className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="font-medium text-gray-700">Demander un Paiement</span>
              </div>
            </Link>
            <Link to="/grosseller/marketplace" className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                <span className="font-medium text-gray-700">Explorer le Marché</span>
              </div>
            </Link>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Activité Récente</h2>
            <Link to="/grosseller/orders" className="text-sm font-medium text-grosseller-600 hover:text-grosseller-700">Voir tout</Link>
          </div>
          
          <div className="space-y-4">
            {recentOrders && recentOrders.length > 0 ? (
              recentOrders.map((order: any) => (
                <div key={order.id} className="flex items-start gap-4 p-3 rounded-lg border border-gray-100 bg-gray-50">
                  <div className="p-2 bg-white rounded-md shadow-sm border border-gray-200 text-grosseller-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 leading-tight">
                      Vente: {order.items?.map((i: any) => i.product?.nameFr).join(', ') || order.orderNumber}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono text-gray-400">#{order.orderNumber}</span>
                      <span className="w-1 h-1 bg-gray-300 rounded-full" />
                      <p className="text-xs text-gray-500">
                        Gains: <span className="font-semibold text-green-600">{order.vendorEarningMad} MAD</span>
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-500 text-sm">Aucune activité récente.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

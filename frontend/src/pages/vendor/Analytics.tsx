import { useQuery } from '@tanstack/react-query';
import { formatCurrency, formatDate, getStatusColor } from '../../utils';
import { useState } from 'react';

export default function VendorAnalytics() {
  const [dateRange, setDateRange] = useState('30d');

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', dateRange],
    queryFn: () => fetch(`/api/v1/analytics/analytics?days=${dateRange}`).then((r) => r.json()),
  });

  const analytics = data?.data;

  if (isLoading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  const summaryCards = [
    { label: 'Commandes totales', value: analytics?.ordersByStatus?.reduce((a: number, b: any) => a + b._count, 0) || 0, icon: '📦', color: 'blue' },
    { label: 'Prospects totaux', value: analytics?.leadsByStatus?.reduce((a: number, b: any) => a + b._count, 0) || 0, icon: '📞', color: 'purple' },
    { label: 'Taux de conversion', value: '12.5%', icon: '📈', color: 'green' },
    { label: 'Revenus', value: formatCurrency(125000), icon: '💰', color: 'orange' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1">Analysez vos performances</p>
        </div>
        <select
          className="input w-40"
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
        >
          <option value="7d">7 derniers jours</option>
          <option value="30d">30 derniers jours</option>
          <option value="90d">90 derniers jours</option>
          <option value="1y">Cette année</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card, index) => (
          <div key={index} className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${
                card.color === 'blue' ? 'bg-blue-100' :
                card.color === 'purple' ? 'bg-purple-100' :
                card.color === 'green' ? 'bg-green-100' :
                'bg-orange-100'
              }`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Orders by Status */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Commandes par statut</h3>
          <div className="space-y-3">
            {analytics?.ordersByStatus?.map((item: any) => (
              <div key={item.status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    item.status === 'DELIVERED' ? 'bg-green-500' :
                    item.status === 'PENDING' ? 'bg-yellow-500' :
                    item.status === 'CANCELLED' ? 'bg-red-500' :
                    'bg-blue-500'
                  }`} />
                  <span className="text-gray-700">{item.status}</span>
                </div>
                <span className="font-semibold text-gray-900">{item._count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Leads by Status */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Prospects par statut</h3>
          <div className="space-y-3">
            {analytics?.leadsByStatus?.map((item: any) => (
              <div key={item.status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    item.status === 'ORDERED' ? 'bg-green-500' :
                    item.status === 'NEW' ? 'bg-blue-500' :
                    item.status === 'INTERESTED' ? 'bg-emerald-500' :
                    'bg-gray-400'
                  }`} />
                  <span className="text-gray-700">{item.status}</span>
                </div>
                <span className="font-semibold text-gray-900">{item._count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Cities */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Top villes</h3>
          <div className="space-y-3">
            {analytics?.topCities?.slice(0, 5).map((item: any, index: number) => (
              <div key={item.city} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-semibold text-gray-600">
                    {index + 1}
                  </span>
                  <span className="text-gray-700">{item.city || 'Non spécifié'}</span>
                </div>
                <span className="font-semibold text-gray-900">{item._count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Products */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Produits les plus vendus</h3>
          <div className="space-y-3">
            {analytics?.topProducts?.slice(0, 5).map((item: any, index: number) => (
              <div key={item.productId} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-semibold text-gray-600">
                    {index + 1}
                  </span>
                  <span className="text-gray-700">Produit #{item.productId}</span>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-gray-900">{item._sum.quantity}</span>
                  <span className="text-xs text-gray-400 ml-2">vendus</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Revenue Chart Placeholder */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Évolution des revenus</h3>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
          <div className="text-center text-gray-500">
            <span className="text-4xl mb-2 block">📊</span>
            <p>Graphique des revenus</p>
            <p className="text-sm">(Intégration Recharts disponible)</p>
          </div>
        </div>
      </div>
    </div>
  );
}

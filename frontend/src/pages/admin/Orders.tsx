import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '../../lib/api';

export default function AdminOrders() {
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['orders', { status: statusFilter }],
    queryFn: () => ordersApi.list({ status: statusFilter || undefined }),
  });

  const orders = data?.data?.data?.orders || [];

  const statusColors: Record<string, string> = {
    PENDING: 'warning',
    CONFIRMED: 'primary',
    IN_PRODUCTION: 'purple',
    READY_FOR_SHIPPING: 'indigo',
    SHIPPED: 'cyan',
    DELIVERED: 'success',
    CANCELLED: 'danger',
    RETURNED: 'orange',
    REFUNDED: 'gray',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commandes</h1>
          <p className="text-gray-500 mt-1">{orders.length} commandes</p>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {['', 'PENDING', 'CONFIRMED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-colors ${
              statusFilter === status ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {status || 'Toutes'}
          </button>
        ))}
      </div>

      {/* Orders */}
      {isLoading ? (
        <div className="text-center py-12">Chargement...</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Commande</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Client</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Marque</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Montant</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Statut</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order: any) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <span className="font-medium text-gray-900">{order.orderNumber}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-gray-900">{order.customerName}</div>
                    <div className="text-xs text-gray-400">{order.customerPhone}</div>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{order.brand?.name}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-900">{Number(order.totalAmountMad).toLocaleString()} MAD</div>
                    <div className="text-xs text-gray-400">Fee: {Number(order.platformFeeMad).toLocaleString()} MAD</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`badge-${statusColors[order.status] || 'gray'}`}>{order.status}</span>
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-sm">
                    {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

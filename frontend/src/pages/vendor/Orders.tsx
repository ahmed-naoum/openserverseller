import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '../../lib/api';

export default function VendorOrders() {
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commandes</h1>
          <p className="text-gray-500 mt-1">{orders.length} commandes au total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {['', 'PENDING', 'CONFIRMED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED'].map((status) => (
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
      ) : orders.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📦</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune commande</h3>
          <p className="text-gray-500">Les commandes apparaîtront ici</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order: any) => (
            <div key={order.id} className="card p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                    <span className="text-xl">📦</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{order.orderNumber}</span>
                      <span className={`badge-${statusColors[order.status] || 'gray'}`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {order.customerName} • {order.customerCity}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">{Number(order.totalAmountMad).toLocaleString()} MAD</div>
                  <div className="text-sm text-green-600">+{Number(order.vendorEarningMad).toLocaleString()} MAD (votre gain)</div>
                </div>
              </div>

              {/* Items */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex flex-wrap gap-2">
                  {order.items?.map((item: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-sm text-gray-700">{item.productName}</span>
                      <span className="text-sm text-gray-400">x{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shipment Info */}
              {order.shipment && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-500">
                  <span>🚚 {order.shipment.courier}</span>
                  {order.shipment.trackingNumber && (
                    <span>• Tracking: {order.shipment.trackingNumber}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

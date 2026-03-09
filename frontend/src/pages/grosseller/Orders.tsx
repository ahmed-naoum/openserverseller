import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '../../lib/api';

export default function Orders() {
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['grosseller-orders'],
    queryFn: () => ordersApi.list(),
  });

  const orders = ordersData?.data?.data?.orders || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suivi des Commandes</h1>
          <p className="mt-1 text-sm text-gray-500">Commandes générées via vos produits sur le Marché Public.</p>
        </div>
      </div>

      <div className="card p-6 min-h-[400px]">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Chargement...</div>
        ) : orders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-y border-gray-200">
                  <th className="py-3 px-4 text-sm font-semibold text-gray-600">N° Commande</th>
                  <th className="py-3 px-4 text-sm font-semibold text-gray-600">Client</th>
                  <th className="py-3 px-4 text-sm font-semibold text-gray-600">Produits</th>
                  <th className="py-3 px-4 text-sm font-semibold text-gray-600">Vos Gains</th>
                  <th className="py-3 px-4 text-sm font-semibold text-gray-600">Date</th>
                  <th className="py-3 px-4 text-sm font-semibold text-gray-600">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order: any) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-sm font-bold text-gray-900 font-mono">{order.orderNumber}</td>
                    <td className="py-3 px-4">
                      <div className="text-sm font-medium text-gray-900">{order.customerName}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{order.customerCity}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{order.items?.length || 0}</span>
                        <span className="text-sm text-gray-600">Articles</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm font-bold text-green-600">+{order.vendorEarningMad} MAD</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                        order.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                        order.status === 'CANCELLED' || order.status === 'RETURNED' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
               <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Aucune commande</h3>
             <p className="text-gray-500 text-sm max-w-sm mx-auto">Vos ventes génériques apparaîtront ici lorsqu'un affilié ou vendeur vendra vos produits.</p>
          </div>
        )}
      </div>
    </div>
  );
}

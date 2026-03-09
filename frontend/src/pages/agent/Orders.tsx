import { useState, useEffect } from 'react';
import { ordersApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function AgentOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [reverting, setReverting] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await ordersApi.list({ limit: 100 });
      setOrders(res.data?.data?.orders || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors du chargement des commandes');
    } finally {
      setLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    CONFIRMED: 'bg-blue-100 text-blue-800',
    SHIPPED: 'bg-indigo-100 text-indigo-800',
    DELIVERED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
    RETURNED: 'bg-orange-100 text-orange-800',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commandes Pushées</h1>
          <p className="text-gray-500 mt-1">
            Gérez et suivez les commandes que vous avez envoyées à la livraison
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Aucune commande trouvée</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-sm font-medium text-gray-500">
                  <th className="p-4 rounded-tl-xl">N° Commande</th>
                  <th className="p-4">Client & Contact</th>
                  <th className="p-4">Produits</th>
                  <th className="p-4">Date & Paiement</th>
                  <th className="p-4">Montant</th>
                  <th className="p-4">Statut</th>
                  <th className="p-4 rounded-tr-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4">
                      <span className="font-semibold text-gray-900">{order.orderNumber}</span>
                    </td>
                    <td className="p-4">
                      <p className="font-semibold text-gray-900">{order.customerName}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        📞 <a href={`tel:${order.customerPhone}`} className="hover:text-primary-600">{order.customerPhone}</a>
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">📍 {order.customerCity}</p>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        {order.items?.map((item: any) => (
                          <div key={item.id} className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                            {item.productImage ? (
                              <img src={item.productImage} alt={item.productName} className="w-8 h-8 rounded-md object-cover bg-white" />
                            ) : (
                              <div className="w-8 h-8 rounded-md bg-gray-200 flex items-center justify-center text-[10px]">📦</div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-800 truncate">{item.productName}</p>
                              <p className="text-[10px] text-gray-500">{item.quantity} x {item.unitPriceMad} MAD</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-gray-600 text-sm mb-1">
                        {format(new Date(order.createdAt), 'dd MMM yyyy HH:mm')}
                      </p>
                      <span className="inline-block px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded">
                        💳 {order.paymentMethod || 'COD'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">{order.totalAmountMad} MAD</span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                          statusColors[order.status] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <button 
                        onClick={() => setSelectedOrder(order)}
                        className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" 
                        title="Voir les détails"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Details & Actions Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Détails de la commande</h2>
                <p className="text-sm text-gray-500 mt-1">N° {selectedOrder.orderNumber}</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span>👤</span> Client
                  </h3>
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="font-semibold text-gray-900 mb-1">{selectedOrder.customerName}</p>
                    <p className="text-sm text-gray-600 flex items-center gap-2 mb-1">
                      <span>📞</span> <a href={`tel:${selectedOrder.customerPhone}`} className="hover:text-primary-600">{selectedOrder.customerPhone}</a>
                    </p>
                    <p className="text-sm text-gray-600 flex gap-2">
                      <span>📍</span> {selectedOrder.customerCity}
                    </p>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span>💰</span> Informations
                  </h3>
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Statut</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${statusColors[selectedOrder.status] || 'bg-gray-100 text-gray-800'}`}>
                        {selectedOrder.status}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Date</span>
                      <span className="text-sm font-medium text-gray-900">{format(new Date(selectedOrder.createdAt), 'dd/MM/yyyy HH:mm')}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Paiement</span>
                      <span className="text-sm font-bold text-gray-900">{selectedOrder.paymentMethod || 'COD'}</span>
                    </div>
                    <div className="pt-2 mt-2 border-t border-gray-200 flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-900">Total</span>
                      <span className="text-base font-bold text-emerald-600">{selectedOrder.totalAmountMad} MAD</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span>🛍️</span> Produits ({selectedOrder.items?.length || 0})
                </h3>
                <div className="space-y-3">
                  {selectedOrder.items?.map((item: any) => (
                    <div key={item.id} className="flex gap-4 p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                      {item.productImage ? (
                        <img src={item.productImage} alt={item.productName} className="w-16 h-16 rounded-lg object-cover bg-gray-50 border border-gray-100" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-xl">📦</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 truncate">{item.productName}</h4>
                        <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                          <span>Qté: <strong className="text-gray-900">{item.quantity}</strong></span>
                          <span>Prix: <strong className="text-gray-900">{item.unitPriceMad} MAD</strong></span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{item.totalPriceMad} MAD</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Fermer
              </button>
              
              {selectedOrder.status === 'PENDING' && (
                <button
                  onClick={async () => {
                    if (window.confirm("Êtes-vous sûr de vouloir annuler cette commande et la renvoyer dans la liste des prospects (Leads) ?")) {
                      try {
                        setReverting(true);
                        await ordersApi.revertToLead(selectedOrder.id);
                        toast.success('Commande annulée et replacée dans les leads avec succès');
                        setSelectedOrder(null);
                        fetchOrders();
                      } catch (err: any) {
                        toast.error(err.response?.data?.message || 'Erreur lors de l’annulation');
                      } finally {
                        setReverting(false);
                      }
                    }
                  }}
                  disabled={reverting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                >
                  {reverting ? 'Annulation...' : '🔄 Renverser en Prospect (Annuler)'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

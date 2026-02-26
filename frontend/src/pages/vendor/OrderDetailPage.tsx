import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '../../lib/api';
import { formatCurrency, formatDate, getStatusColor } from '../../utils';

export default function OrderDetailPage() {
  const { id } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersApi.get(id!),
    enabled: !!id,
  });

  const order = data?.data?.data?.order;

  if (isLoading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Commande non trouvée</p>
      </div>
    );
  }

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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
          <p className="text-gray-500 mt-1">Commande du {formatDate(order.createdAt)}</p>
        </div>
        <span className={`badge-${statusColors[order.status] || 'gray'} text-sm px-3 py-1`}>
          {order.status}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Customer Info */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Informations client</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <span>👤</span>
              </div>
              <div>
                <div className="text-xs text-gray-500">Nom</div>
                <div className="font-medium text-gray-900">{order.customerName}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <span>📞</span>
              </div>
              <div>
                <div className="text-xs text-gray-500">Téléphone</div>
                <a href={`tel:${order.customerPhone}`} className="font-medium text-gray-900 hover:text-primary-600">
                  {order.customerPhone}
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <span>📍</span>
              </div>
              <div>
                <div className="text-xs text-gray-500">Adresse</div>
                <div className="font-medium text-gray-900">
                  {order.customerCity}
                  {order.customerAddress && <><br />{order.customerAddress}</>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Info */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Informations financières</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-500">Total</span>
              <span className="font-bold text-gray-900">{formatCurrency(order.totalAmountMad)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-500">Votre gain (85%)</span>
              <span className="font-bold text-green-600">{formatCurrency(order.vendorEarningMad)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-500">Commission plateforme</span>
              <span className="text-gray-600">{formatCurrency(order.platformFeeMad)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-500">Mode de paiement</span>
              <span className="font-medium text-gray-900">{order.paymentMethod}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div className="card">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Articles commandés</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {order.items?.map((item: any, index: number) => (
            <div key={index} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  {item.productImage ? (
                    <img src={item.productImage} alt="" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <span className="text-gray-400">📦</span>
                  )}
                </div>
                <div>
                  <div className="font-medium text-gray-900">{item.productName}</div>
                  <div className="text-sm text-gray-500">Quantité: {item.quantity}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-gray-900">{formatCurrency(item.totalPriceMad)}</div>
                <div className="text-xs text-gray-400">{formatCurrency(item.unitPriceMad)} / unité</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Shipment Tracking */}
      {order.shipment && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Suivi de livraison</h3>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center">
              <span>🚚</span>
            </div>
            <div>
              <div className="font-medium text-gray-900">{order.shipment.courier}</div>
              {order.shipment.trackingNumber && (
                <div className="text-sm text-gray-500">Tracking: {order.shipment.trackingNumber}</div>
              )}
            </div>
            <span className={`badge-${statusColors[order.shipment.status] || 'gray'} ml-auto`}>
              {order.shipment.status}
            </span>
          </div>
          {order.shipment.trackingEvents?.length > 0 && (
            <div className="border-l-2 border-gray-200 pl-4 space-y-3">
              {order.shipment.trackingEvents.map((event: any, index: number) => (
                <div key={index} className="relative">
                  <div className="absolute -left-6 w-4 h-4 bg-gray-200 rounded-full" />
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">{event.status}</div>
                    <div className="text-gray-500">{event.location} • {formatDate(event.eventTime)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fulfillmentApi } from '../../lib/api';
import toast from 'react-hot-toast';

export default function AdminFulfillment() {
  const [statusFilter, setStatusFilter] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['fulfillment-requests', { status: statusFilter }],
    queryFn: () => fulfillmentApi.adminListRequests({ status: statusFilter || undefined }),
  });

  const requests = data?.data?.data?.requests || [];

  const fulfillMutation = useMutation({
    mutationFn: ({ id, actionType, quantity }: { id: string, actionType: string, quantity?: number }) => 
      fulfillmentApi.fulfillRequest(id, { actionType, quantity }),
    onSuccess: () => {
      toast.success('Demande traitée avec succès !');
      queryClient.invalidateQueries({ queryKey: ['fulfillment-requests'] });
    },
    onError: () => {
      toast.error('Erreur lors du traitement de la demande.');
    }
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => fulfillmentApi.rejectRequest(id),
    onSuccess: () => {
      toast.success('Demande rejetée / Droits révoqués !');
      queryClient.invalidateQueries({ queryKey: ['fulfillment-requests'] });
    },
    onError: () => {
      toast.error('Erreur lors du rejet.');
    }
  });

  const handleAction = (req: any, actionType: string) => {
    let quantity = undefined;
    if (actionType === 'GRANT_INVENTORY') {
       const qty = prompt("Combien d'unités souhaitez-vous accorder ?", "10");
       if (!qty) return;
       quantity = parseInt(qty, 10);
    }
    
    if (confirm(`Êtes-vous sûr de vouloir exécuter l'action: ${actionType} ?`)) {
      fulfillMutation.mutate({ id: req.id.toString(), actionType, quantity });
    }
  };

  const handleReject = (req: any) => {
    const label = req.status === 'RESOLVED' 
      ? 'Révoquer les droits accordés et fermer cette demande' 
      : 'Rejeter cette demande';
    if (confirm(`${label} ?`)) {
      rejectMutation.mutate(req.id.toString());
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Demandes de Fulfillment & Support</h1>
          <p className="text-gray-500 mt-1">{requests.length} requêtes</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {['', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-colors ${
              statusFilter === status ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {status || 'Tous'}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12">Chargement...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Aucune demande trouvée.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">ID</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Utilisateur</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Type / Sujet</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Statut</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map((req: any) => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">#{req.id}</td>
                  <td className="py-3 px-4 text-sm">
                     <span className="font-semibold text-gray-900">{req.user?.profile?.fullName || req.user?.email || 'Inconnu'}</span>
                     <br/><span className="text-gray-500 text-xs px-1.5 py-0.5 bg-gray-100 rounded mt-1 inline-block">{req.user?.role}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {req.product && (
                        <div className="w-10 h-10 rounded border border-gray-200 bg-gray-50 flex-shrink-0 overflow-hidden">
                          {req.product.images?.[0] ? (
                            <img src={req.product.images[0].imageUrl} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">📦</div>
                          )}
                        </div>
                      )}
                      <div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          req.type === 'PRODUCT_CLAIM' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {req.type}
                        </span>
                        <p className="text-sm font-bold text-gray-800 mt-1">
                          {req.product?.nameFr || req.subject}
                        </p>
                        {req.productId && (
                          <p className="text-[10px] text-primary-600 font-medium">ID Produit: {req.productId}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      req.status === 'OPEN' ? 'bg-amber-100 text-amber-700' : 
                      req.status === 'CLOSED' ? 'bg-red-100 text-red-700' : 
                      req.status === 'RESOLVED' ? 'bg-green-100 text-green-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-500">
                    {new Date(req.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2 flex-wrap">
                      {/* Approve buttons — only for OPEN / IN_PROGRESS */}
                      {req.status !== 'CLOSED' && req.status !== 'RESOLVED' && (
                        <>
                          {req.type === 'DELIVERY_FULFILLMENT' && (
                            <button
                              onClick={() => handleAction(req, 'GRANT_INVENTORY')}
                              className="text-xs bg-primary-600 text-white hover:bg-primary-700 font-bold py-1.5 px-3 rounded-lg transition-colors shadow-sm"
                            >
                              Accorder
                            </button>
                          )}
                          {req.type === 'PRODUCT_CLAIM' && (
                            <button
                              onClick={() => handleAction(req, 'GRANT_CLAIM')}
                              className="text-xs bg-purple-600 text-white hover:bg-purple-700 font-bold py-1.5 px-3 rounded-lg transition-colors shadow-sm"
                            >
                              Accorder
                            </button>
                          )}
                        </>
                      )}

                      {/* Reject / Revoke — available on ALL statuses except CLOSED */}
                      {req.status !== 'CLOSED' && (
                        <button
                          onClick={() => handleReject(req)}
                          disabled={rejectMutation.isPending}
                          className={`text-xs font-bold py-1.5 px-3 rounded-lg transition-colors ${
                            req.status === 'RESOLVED'
                              ? 'bg-red-600 text-white hover:bg-red-700 shadow-sm'
                              : 'text-red-600 hover:bg-red-50 border border-red-200'
                          }`}
                        >
                          {req.status === 'RESOLVED' ? '🔄 Révoquer' : 'Rejeter'}
                        </button>
                      )}
                    </div>
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

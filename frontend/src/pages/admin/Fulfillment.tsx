import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fulfillmentApi } from '../../lib/api';
import toast from 'react-hot-toast';

export default function AdminFulfillment() {
  const [statusFilter, setStatusFilter] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['fulfillment-requests', { status: statusFilter }],
    queryFn: () => fulfillmentApi.listRequests({ status: statusFilter || undefined }),
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

  const handleAction = (req: any, actionType: string) => {
    let quantity = undefined;
    if (actionType === 'GRANT_INVENTORY') {
       const qty = prompt("Combien d'unités souhaitez-vous accorder ?", "10");
       if (!qty) return;
       quantity = parseInt(qty, 10);
    }
    
    // Only GRANT_INVENTORY for DELIVERY_FULFILLMENT.
    // GRANT_CLAIM for PRODUCT_CLAIM.
    // CLOSE to just reject/close.
    
    if (confirm(`Êtes-vous sûr de vouloir exécuter l'action: ${actionType} ?`)) {
      fulfillMutation.mutate({ id: req.id.toString(), actionType, quantity });
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
                     <span className="font-semibold text-gray-900">{req.user?.fullName}</span>
                     <br/><span className="text-gray-500 text-xs">{req.user?.role}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="badge-gray mb-1">{req.type}</span>
                    <p className="text-sm font-medium">{req.subject}</p>
                    <p className="text-xs text-gray-500 max-w-xs truncate">{req.description}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`badge-${req.status === 'OPEN' ? 'warning' : req.status === 'CLOSED' ? 'danger' : 'success'}`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-500">
                    {new Date(req.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    {req.status !== 'CLOSED' && req.status !== 'RESOLVED' && (
                      <div className="flex flex-col gap-2">
                        {req.type === 'DELIVERY_FULFILLMENT' && (
                          <button
                            onClick={() => handleAction(req, 'GRANT_INVENTORY')}
                            className="text-xs bg-primary-100 text-primary-700 hover:bg-primary-200 font-medium py-1 px-2 rounded"
                          >
                            Accorder Inventaire
                          </button>
                        )}
                        {req.type === 'PRODUCT_CLAIM' && (
                          <button
                            onClick={() => handleAction(req, 'GRANT_CLAIM')}
                            className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 font-medium py-1 px-2 rounded"
                          >
                            Accorder Réclamation
                          </button>
                        )}
                        <button
                          onClick={() => handleAction(req, 'CLOSE')}
                          className="text-xs text-red-600 hover:text-red-700 font-medium py-1 px-2 rounded border border-transparent hover:border-red-200"
                        >
                          Fermer
                        </button>
                      </div>
                    )}
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

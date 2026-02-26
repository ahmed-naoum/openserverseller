import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, walletApi, payoutsApi } from '../../lib/api';
import toast from 'react-hot-toast';

export default function AdminFinance() {
  const queryClient = useQueryClient();

  const { data: walletData } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletApi.get(),
  });

  const { data: payoutsData, isLoading } = useQuery({
    queryKey: ['admin-payouts'],
    queryFn: () => payoutsApi.list(),
  });

  const payouts = payoutsData?.data?.data?.payouts || [];

  const approveMutation = useMutation({
    mutationFn: (id: string) => adminApi.approvePayout(id),
    onSuccess: () => {
      toast.success('Paiement approuvé!');
      queryClient.invalidateQueries({ queryKey: ['payouts'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => adminApi.rejectPayout(id),
    onSuccess: () => {
      toast.success('Paiement rejeté');
      queryClient.invalidateQueries({ queryKey: ['payouts'] });
    },
  });

  const pendingPayouts = payouts.filter((p: any) => p.status === 'PENDING');
  const completedPayouts = payouts.filter((p: any) => p.status === 'COMPLETED');

  const statusColors: Record<string, string> = {
    PENDING: 'warning',
    APPROVED: 'primary',
    PROCESSING: 'purple',
    COMPLETED: 'success',
    REJECTED: 'danger',
    CANCELLED: 'gray',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
        <p className="text-gray-500 mt-1">Gestion des paiements et retraits</p>
      </div>

      {/* Pending Payouts */}
      {pendingPayouts.length > 0 && (
        <div className="card border-yellow-200 bg-yellow-50">
          <div className="p-5 border-b border-yellow-200">
            <h3 className="font-semibold text-yellow-800">
              ⏳ Demandes de retrait en attente ({pendingPayouts.length})
            </h3>
          </div>
          <div className="divide-y divide-yellow-200">
            {pendingPayouts.map((payout: any) => (
              <div key={payout.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-900">
                    {Number(payout.amountMad).toLocaleString()} MAD
                  </div>
                  <div className="text-sm text-gray-500">
                    {payout.bankName} • RIB: ...{payout.ribAccount.slice(-4)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => rejectMutation.mutate(payout.id)}
                    className="btn-danger btn-sm"
                    disabled={rejectMutation.isPending}
                  >
                    Rejeter
                  </button>
                  <button
                    onClick={() => approveMutation.mutate(payout.id)}
                    className="btn-primary btn-sm"
                    disabled={approveMutation.isPending}
                  >
                    Approuver
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Payouts */}
      {isLoading ? (
        <div className="text-center py-12">Chargement...</div>
      ) : (
        <div className="card">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Tous les retraits</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Montant</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Banque</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">RIB</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Statut</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payouts.map((payout: any) => (
                  <tr key={payout.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-semibold text-gray-900">
                      {Number(payout.amountMad).toLocaleString()} MAD
                    </td>
                    <td className="py-3 px-4 text-gray-600">{payout.bankName}</td>
                    <td className="py-3 px-4 text-gray-600 font-mono text-sm">
                      ...{payout.ribAccount.slice(-8)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge-${statusColors[payout.status] || 'gray'}`}>
                        {payout.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-sm">
                      {new Date(payout.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { walletApi, payoutsApi } from '../../lib/api';
import toast from 'react-hot-toast';

const TX_PAGE_SIZE = 20;

export default function VendorWallet() {
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutForm, setPayoutForm] = useState({
    amountMad: '',
    bankName: '',
    ribAccount: '',
    iceNumber: '',
  });
  const queryClient = useQueryClient();

  const { data: walletData, isLoading: walletLoading } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletApi.get(),
  });

  // The list used to call this with no params, so it took the server default of
  // 20 rows and offered no way to reach the rest — an account with four thousand
  // transactions showed twenty and said nothing about the others.
  const [txPage, setTxPage] = useState(1);
  const { data: transactionsData, isFetching: txFetching } = useQuery({
    queryKey: ['transactions', txPage],
    queryFn: () => walletApi.transactions({ page: txPage, limit: TX_PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const { data: payoutsData } = useQuery({
    queryKey: ['payouts'],
    queryFn: () => payoutsApi.list(),
  });

  const wallet = walletData?.data?.data;
  const transactions = transactionsData?.data?.data?.transactions || [];
  const txPagination = transactionsData?.data?.data?.pagination;
  const txTotal = txPagination?.total ?? transactions.length;
  const txTotalPages = txPagination?.totalPages ?? 1;
  const payouts = payoutsData?.data?.data?.payouts || [];

  const payoutMutation = useMutation({
    mutationFn: (data: any) => payoutsApi.create(data),
    onSuccess: () => {
      toast.success('Demande de retrait soumise!');
      setShowPayoutModal(false);
      setPayoutForm({ amountMad: '', bankName: '', ribAccount: '', iceNumber: '' });
      queryClient.invalidateQueries({ queryKey: ['payouts'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur');
    },
  });

  const transactionTypeColors: Record<string, string> = {
    CREDIT: 'success',
    DEBIT: 'danger',
    PAYOUT: 'warning',
    REFUND: 'primary',
    COMMISSION: 'gray',
  };

  const payoutStatusColors: Record<string, string> = {
    PENDING: 'warning',
    APPROVED: 'primary',
    PROCESSING: 'purple',
    COMPLETED: 'success',
    REJECTED: 'danger',
    CANCELLED: 'gray',
  };

  const moroccanBanks = [
    'CIH Bank', 'Banque Populaire', 'Attijariwafa Bank', 'BMCE Bank',
    'BMCI', 'Crédit du Maroc', 'Société Générale Maroc', 'Caisse d\'Épargne'
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Portefeuille</h1>
          <p className="text-gray-500 mt-1">Gérez vos revenus et retraits</p>
        </div>
        <button onClick={() => setShowPayoutModal(true)} className="btn-primary">
          💸 Demander un retrait
        </button>
      </div>

      {walletLoading ? (
        <div className="text-center py-12">Chargement...</div>
      ) : (
        <>
          {/* Balance Cards */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="card p-6">
              <div className="text-sm text-gray-500 mb-1">Solde disponible</div>
              <div className="text-3xl font-bold text-primary-600">
                {Number(wallet?.balanceMad || 0).toLocaleString()} MAD
              </div>
            </div>
            <div className="card p-6">
              <div className="text-sm text-gray-500 mb-1">Total gagné</div>
              <div className="text-3xl font-bold text-gray-900">
                {Number(wallet?.totalEarnedMad || 0).toLocaleString()} MAD
              </div>
            </div>
            <div className="card p-6">
              <div className="text-sm text-gray-500 mb-1">Total retiré</div>
              <div className="text-3xl font-bold text-gray-900">
                {Number(wallet?.totalWithdrawnMad || 0).toLocaleString()} MAD
              </div>
            </div>
          </div>

          {/* Payout Requests */}
          {payouts.length > 0 && (
            <div className="card">
              <div className="p-5 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Demandes de retrait</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {payouts.map((payout: any) => (
                  <div key={payout.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">
                        {Number(payout.amountMad).toLocaleString()} MAD
                      </div>
                      <div className="text-sm text-gray-500">{payout.bankName} • {payout.ribAccount.slice(-4)}</div>
                    </div>
                    <div className="text-right">
                      <span className={`badge-${payoutStatusColors[payout.status] || 'gray'}`}>
                        {payout.status}
                      </span>
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(payout.createdAt).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transactions */}
          <div className="card">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-3">
              <h3 className="font-semibold text-gray-900">Historique des transactions</h3>
              {txTotal > 0 && (
                <span className="text-xs text-gray-500 font-medium">
                  {txTotal.toLocaleString('fr-FR')} au total
                </span>
              )}
            </div>
            <div className="divide-y divide-gray-100">
              {transactions.length === 0 ? (
                <div className="p-8 text-center text-gray-500">Aucune transaction</div>
              ) : (
                transactions.map((tx: any) => (
                  <div key={tx.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        tx.type === 'CREDIT' ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {tx.type === 'CREDIT' ? '↗️' : tx.type === 'PAYOUT' ? '💸' : '↘️'}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{tx.description || tx.type}</div>
                        {tx.order && (
                          <div className="text-sm text-gray-500">{tx.order.orderNumber}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold ${tx.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.type === 'CREDIT' ? '+' : '-'}{Number(tx.amountMad).toLocaleString()} MAD
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(tx.createdAt).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {txTotalPages > 1 && (
              <div className="p-4 border-t border-gray-100 flex items-center justify-between gap-3">
                <span className="text-xs text-gray-500 font-medium">
                  Page {txPage} sur {txTotalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                    disabled={txPage <= 1 || txFetching}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Précédent
                  </button>
                  <button
                    onClick={() => setTxPage((p) => Math.min(txTotalPages, p + 1))}
                    disabled={txPage >= txTotalPages || txFetching}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Payout Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Demander un retrait</h2>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                payoutMutation.mutate({
                  ...payoutForm,
                  amountMad: parseFloat(payoutForm.amountMad),
                });
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="label">Montant (MAD) *</label>
                <input
                  type="number"
                  className="input"
                  placeholder="200"
                  value={payoutForm.amountMad}
                  onChange={(e) => setPayoutForm({ ...payoutForm, amountMad: e.target.value })}
                  min={200}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Minimum: 200 MAD</p>
              </div>
              <div>
                <label className="label">Banque *</label>
                <select
                  className="input"
                  value={payoutForm.bankName}
                  onChange={(e) => setPayoutForm({ ...payoutForm, bankName: e.target.value })}
                  required
                >
                  <option value="">Sélectionner</option>
                  {moroccanBanks.map((bank) => (
                    <option key={bank} value={bank}>{bank}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">RIB (24 chiffres) *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="011780000012345678901234"
                  value={payoutForm.ribAccount}
                  onChange={(e) => setPayoutForm({ ...payoutForm, ribAccount: e.target.value })}
                  maxLength={24}
                  required
                />
              </div>
              <div>
                <label className="label">ICE (optionnel)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="001234567"
                  value={payoutForm.iceNumber}
                  onChange={(e) => setPayoutForm({ ...payoutForm, iceNumber: e.target.value })}
                  maxLength={15}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowPayoutModal(false)} className="btn-secondary flex-1">
                  Annuler
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={payoutMutation.isPending}>
                  {payoutMutation.isPending ? 'Envoi...' : 'Soumettre'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

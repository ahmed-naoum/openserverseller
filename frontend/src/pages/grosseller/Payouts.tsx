import { useQuery } from '@tanstack/react-query';
import { payoutsApi } from '../../lib/api';

export default function Payouts() {
  const { data: payoutsData, isLoading } = useQuery({
    queryKey: ['grosseller-payouts'],
    queryFn: () => payoutsApi.list(),
  });

  const payouts = payoutsData?.data?.data?.payouts || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paiements</h1>
          <p className="mt-1 text-sm text-gray-500">Historique et suivi de vos retraits.</p>
        </div>
        <button className="btn bg-grosseller-600 hover:bg-grosseller-700 text-white shadow-sm flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          Demander un Retrait
        </button>
      </div>

      <div className="card p-6 min-h-[400px]">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Chargement...</div>
        ) : payouts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-y border-gray-200">
                  <th className="py-3 px-4 text-sm font-semibold text-gray-600">ID</th>
                  <th className="py-3 px-4 text-sm font-semibold text-gray-600">Montant</th>
                  <th className="py-3 px-4 text-sm font-semibold text-gray-600">Compte Bancaire</th>
                  <th className="py-3 px-4 text-sm font-semibold text-gray-600">Date</th>
                  <th className="py-3 px-4 text-sm font-semibold text-gray-600">Statut</th>
                  <th className="py-3 px-4 text-sm font-semibold text-gray-600">Information</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payouts.map((payout: any) => (
                  <tr key={payout.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-sm text-gray-500 font-mono">#{payout.id}</td>
                    <td className="py-3 px-4 text-sm font-bold text-gray-900">{Number(payout.amountMad).toLocaleString()} MAD</td>
                    <td className="py-3 px-4">
                      <div className="text-sm font-medium text-gray-900">{payout.bankName}</div>
                      <div className="text-xs text-gray-500 font-mono mt-0.5">{payout.ribAccount}</div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{new Date(payout.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full inline-flex items-center gap-1.5 ${
                        payout.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                        payout.status === 'PENDING' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {payout.status === 'PENDING' && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>}
                        {payout.status === 'COMPLETED' ? 'Payé' : payout.status === 'PENDING' ? 'En Attente' : 'Rejeté'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {payout.receiptUrl ? (
                        <a href={payout.receiptUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-grosseller-600 hover:text-grosseller-800 hover:underline">Voir Reçu</a>
                      ) : (
                        <span className="text-xs text-gray-400">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
               <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Aucune demande de retrait</h3>
            <p className="text-gray-500 text-sm">Vos futures demandes de paiement apparaîtront ici.</p>
          </div>
        )}
      </div>
    </div>
  );
}

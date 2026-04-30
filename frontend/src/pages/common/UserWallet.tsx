import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { walletApi, payoutsApi } from '../../lib/api';
import { Wallet, ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, XCircle, Building2, Banknote, CreditCard, ChevronRight, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function UserWallet() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  
  const [withdrawForm, setWithdrawForm] = useState({
    amountMad: '',
    bankName: '',
    ribAccount: '',
    iceNumber: ''
  });

  // Filtering state
  const [filterDay, setFilterDay] = useState<string>('ALL');
  const [filterMonth, setFilterMonth] = useState<string>('ALL');
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());

  const months = [
    { value: '0', label: 'Janvier' }, { value: '1', label: 'Février' }, { value: '2', label: 'Mars' },
    { value: '3', label: 'Avril' }, { value: '4', label: 'Mai' }, { value: '5', label: 'Juin' },
    { value: '6', label: 'Juillet' }, { value: '7', label: 'Août' }, { value: '8', label: 'Septembre' },
    { value: '9', label: 'Octobre' }, { value: '10', label: 'Novembre' }, { value: '11', label: 'Décembre' }
  ];

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());
  const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString());

  const { data: walletData, isLoading: isLoadingWallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletApi.get()
  });

  const { data: transactionsData, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['wallet-transactions'],
    queryFn: () => walletApi.transactions({ limit: 50 })
  });

  const { data: payoutsData } = useQuery({
    queryKey: ['payouts'],
    queryFn: () => payoutsApi.list({ limit: 20 })
  });

  const wallet = walletData?.data?.data?.wallet;
  const allTransactions = transactionsData?.data?.data?.transactions || [];
  const payouts = payoutsData?.data?.data?.payouts || [];

  // Filtered transactions
  const transactions = allTransactions.filter((tx: any) => {
    const date = new Date(tx.createdAt);
    const dayMatch = filterDay === 'ALL' || date.getDate().toString() === filterDay;
    const monthMatch = filterMonth === 'ALL' || date.getMonth().toString() === filterMonth;
    const yearMatch = filterYear === 'ALL' || date.getFullYear().toString() === filterYear;
    return dayMatch && monthMatch && yearMatch;
  });

  const withdrawMutation = useMutation({
    mutationFn: (data: any) => payoutsApi.create(data),
    onSuccess: () => {
      toast.success('Demande de retrait soumise avec succès');
      setIsWithdrawModalOpen(false);
      setWithdrawForm({ amountMad: '', bankName: '', ribAccount: '', iceNumber: '' });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['payouts'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur lors de la demande');
    }
  });

  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet || wallet.balanceMad < Number(withdrawForm.amountMad)) {
      toast.error('Solde insuffisant');
      return;
    }
    if (Number(withdrawForm.amountMad) < 10) {
      toast.error('Le montant minimum est de 10 MAD');
      return;
    }
    withdrawMutation.mutate({
      ...withdrawForm,
      amountMad: Number(withdrawForm.amountMad)
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-yellow-50 text-yellow-700 border border-yellow-100"><Clock size={12}/> En attente</span>;
      case 'COMPLETED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-green-50 text-green-700 border border-green-100"><CheckCircle2 size={12}/> Complété</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-red-50 text-red-700 border border-red-100"><XCircle size={12}/> Rejeté</span>;
      default:
        return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">{status}</span>;
    }
  };

  if (isLoadingWallet) {
    return <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Mon Portefeuille</h1>
          <p className="text-sm text-gray-500 font-medium">Gérez vos gains et effectuez des retraits</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['wallet'] });
              queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
              queryClient.invalidateQueries({ queryKey: ['payouts'] });
              toast.success('Données actualisées');
            }}
            className="p-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl hover:text-violet-600 hover:border-violet-100 transition-all shadow-sm"
            title="Actualiser"
          >
            <RotateCcw size={18} />
          </button>
          <button 
            onClick={() => {
              const defaultBank = user?.bankAccounts?.find((b: any) => b.isDefault && b.status === 'APPROVED');
              if (defaultBank) {
                setSelectedBankId(defaultBank.id.toString());
                setWithdrawForm({ 
                  ...withdrawForm, 
                  bankName: defaultBank.bankName, 
                  ribAccount: defaultBank.ribAccount, 
                  iceNumber: defaultBank.iceNumber || '' 
                });
              } else {
                setSelectedBankId('');
                setWithdrawForm({ amountMad: '', bankName: '', ribAccount: '', iceNumber: '' });
              }
              setIsWithdrawModalOpen(true);
            }}
            disabled={!wallet || wallet.balanceMad < 10}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            <Banknote size={18} /> Demander un retrait
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Wallet size={120} className="-mr-8 -mt-8" />
          </div>
          <div className="relative z-10">
            <p className="text-violet-100 text-sm font-medium mb-1">Solde Disponible</p>
            <h3 className="text-4xl font-black tracking-tight">{wallet?.balanceMad?.toLocaleString() || 0} <span className="text-lg text-violet-200">MAD</span></h3>
            <p className="text-[10px] text-violet-200 mt-2 font-medium opacity-80">Uniquement alimenté par les commandes facturées.</p>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
              <ArrowDownRight size={20} />
            </div>
            <p className="text-gray-500 text-sm font-medium">Gains (Factures)</p>
          </div>
          <h3 className="text-2xl font-black text-gray-900 ml-13 pl-1">{wallet?.totalEarnedMad?.toLocaleString() || 0} <span className="text-sm text-gray-400">MAD</span></h3>
        </div>

        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
              <ArrowUpRight size={20} />
            </div>
            <p className="text-gray-500 text-sm font-medium">Total Retiré</p>
          </div>
          <h3 className="text-2xl font-black text-gray-900 ml-13 pl-1">{wallet?.totalWithdrawnMad?.toLocaleString() || 0} <span className="text-sm text-gray-400">MAD</span></h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transactions List */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-50 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Historique (Factures, Retraits & Frais)</h2>
              <div className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded-md">
                {transactions.length} Transactions
              </div>
            </div>
            
            {/* Filters Row */}
            <div className="flex flex-wrap gap-2">
              <select 
                value={filterDay} 
                onChange={(e) => setFilterDay(e.target.value)}
                className="text-xs font-bold border-gray-200 rounded-lg focus:ring-violet-500 focus:border-violet-500 bg-gray-50/50"
              >
                <option value="ALL">Tous les jours</option>
                {days.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              
              <select 
                value={filterMonth} 
                onChange={(e) => setFilterMonth(e.target.value)}
                className="text-xs font-bold border-gray-200 rounded-lg focus:ring-violet-500 focus:border-violet-500 bg-gray-50/50"
              >
                <option value="ALL">Tous les mois</option>
                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              
              <select 
                value={filterYear} 
                onChange={(e) => setFilterYear(e.target.value)}
                className="text-xs font-bold border-gray-200 rounded-lg focus:ring-violet-500 focus:border-violet-500 bg-gray-50/50"
              >
                <option value="ALL">Toutes les années</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>

              {(filterDay !== 'ALL' || filterMonth !== 'ALL') && (
                <button 
                  onClick={() => { setFilterDay('ALL'); setFilterMonth('ALL'); }}
                  className="text-[10px] font-black uppercase text-gray-400 hover:text-red-500"
                >
                  Réinitialiser
                </button>
              )}
            </div>
          </div>
          <div className="p-4 flex-1 overflow-y-auto max-h-[500px]">
            {isLoadingTransactions ? (
               <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin"></div></div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500 font-medium">Aucune transaction trouvée.</div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        tx.amountMad > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                      }`}>
                        {tx.amountMad > 0 ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{tx.description || tx.type}</p>
                        <p className="text-xs text-gray-500 font-medium">{format(new Date(tx.createdAt), 'dd MMM yyyy HH:mm', { locale: fr })}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-black ${tx.amountMad > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                        {tx.amountMad > 0 ? '+' : ''}{Number(tx.amountMad).toLocaleString()} MAD
                      </p>
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5 uppercase">Solde: {Number(tx.balanceAfterMad).toLocaleString()} MAD</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Payouts List */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Mes retraits</h2>
          </div>
          <div className="p-4 flex-1 overflow-y-auto max-h-[500px]">
            {payouts.length === 0 ? (
              <div className="text-center py-8 text-gray-500 font-medium">Aucune demande de retrait.</div>
            ) : (
              <div className="space-y-3">
                {payouts.map((payout: any) => (
                  <div key={payout.id} className="flex flex-col p-4 rounded-2xl bg-gray-50 border border-transparent hover:border-gray-100 transition-colors gap-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                          <Building2 size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{payout.bankName}</p>
                          <p className="text-xs text-gray-500 font-medium mt-0.5">RIB: {'•'.repeat(20)}{payout.ribAccount.slice(-4)}</p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <p className="text-sm font-black text-gray-900">{Number(payout.amountMad).toLocaleString()} MAD</p>
                        <div className="mt-1">{getStatusBadge(payout.status)}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-400 font-medium">Demandé le {format(new Date(payout.createdAt), 'dd MMM yyyy', { locale: fr })}</p>
                      {payout.processedAt && (
                        <p className="text-xs text-gray-400 font-medium">Traité le {format(new Date(payout.processedAt), 'dd MMM yyyy', { locale: fr })}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Withdraw Modal */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight">Demander un retrait</h3>
                <p className="text-sm text-gray-500 font-medium mt-1">Solde dispo: <span className="font-bold text-gray-900">{wallet?.balanceMad?.toLocaleString()} MAD</span></p>
              </div>
              <button onClick={() => setIsWithdrawModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors">
                <XCircle size={24} />
              </button>
            </div>
            <form onSubmit={handleWithdrawSubmit} className="p-6 space-y-4">
              {user?.bankAccounts && user.bankAccounts.filter((b: any) => b.status === 'APPROVED').length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Choisir un compte existant</label>
                  <select
                    value={selectedBankId}
                    onChange={e => {
                      const val = e.target.value;
                      setSelectedBankId(val);
                      if (val) {
                        const bank = user.bankAccounts.find((b: any) => b.id === Number(val));
                        if (bank) {
                          setWithdrawForm({ ...withdrawForm, bankName: bank.bankName, ribAccount: bank.ribAccount, iceNumber: bank.iceNumber || '' });
                        }
                      } else {
                        setWithdrawForm({ ...withdrawForm, bankName: '', ribAccount: '', iceNumber: '' });
                      }
                    }}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none"
                  >
                    <option value="">-- Nouveau compte bancaire --</option>
                    {user.bankAccounts.filter((b: any) => b.status === 'APPROVED').map((b: any) => (
                      <option key={b.id} value={b.id}>{b.bankName} - {b.ribAccount.slice(0, 8)}...{b.ribAccount.slice(-4)} {b.isDefault ? '(Par défaut)' : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Montant (MAD)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Banknote size={16} className="text-gray-400" />
                  </div>
                  <input
                    type="number"
                    required
                    min="10"
                    max={wallet?.balanceMad}
                    value={withdrawForm.amountMad}
                    onChange={e => setWithdrawForm({...withdrawForm, amountMad: e.target.value})}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none"
                    placeholder="Min. 10 MAD"
                  />
                </div>
              </div>
              {!selectedBankId && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Nom de la Banque</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Building2 size={16} className="text-gray-400" />
                      </div>
                      <input
                        type="text"
                        required={!selectedBankId}
                        value={withdrawForm.bankName}
                        onChange={e => setWithdrawForm({...withdrawForm, bankName: e.target.value})}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none"
                        placeholder="ex: CIH, Attijariwafa"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">RIB (24 chiffres)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <CreditCard size={16} className="text-gray-400" />
                      </div>
                      <input
                        type="text"
                        required={!selectedBankId}
                        pattern="[0-9]{24}"
                        value={withdrawForm.ribAccount}
                        onChange={e => setWithdrawForm({...withdrawForm, ribAccount: e.target.value})}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all outline-none"
                        placeholder="24 chiffres"
                      />
                    </div>
                  </div>
                </>
              )}
              <div className="pt-4 border-t border-gray-50">
                <button
                  type="submit"
                  disabled={withdrawMutation.isPending}
                  className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 disabled:opacity-50 transition-all shadow-md"
                >
                  {withdrawMutation.isPending ? 'Traitement...' : 'Confirmer le retrait'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, walletApi, payoutsApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { 
  Copy, 
  Download, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Building2, 
  Search, 
  Filter,
  MoreVertical,
  ChevronDown,
  ArrowUpRight,
  Wallet,
  CheckCircle,
  RotateCcw
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AdminFinance() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const { data: payoutsData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-payouts'],
    queryFn: () => payoutsApi.list({ limit: 100 }),
  });

  const payouts = payoutsData?.data?.data?.payouts || [];

  const approveMutation = useMutation({
    mutationFn: (id: string) => adminApi.approvePayout(id),
    onSuccess: () => {
      toast.success('Paiement approuvé!');
      queryClient.invalidateQueries({ queryKey: ['admin-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur');
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: (ids: number[]) => adminApi.bulkApprovePayouts(ids),
    onSuccess: (res) => {
      toast.success(res.data.message);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['admin-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'approbation en masse');
    }
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => adminApi.rejectPayout(id),
    onSuccess: () => {
      toast.success('Paiement rejeté');
      queryClient.invalidateQueries({ queryKey: ['admin-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
  });

  const filteredPayouts = payouts.filter((p: any) => {
    const matchesSearch = 
      p.bankName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.vendor?.profile?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.ribAccount.includes(searchTerm);
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingPayouts = payouts.filter((p: any) => p.status === 'PENDING');
  const totalPendingAmount = pendingPayouts.reduce((sum: number, p: any) => sum + Number(p.amountMad), 0);
  const totalCompletedAmount = payouts.filter((p: any) => p.status === 'COMPLETED').reduce((sum: number, p: any) => sum + Number(p.amountMad), 0);

  const handleExport = () => {
    const pending = payouts.filter((p: any) => p.status === 'PENDING');
    if (pending.length === 0) {
      toast.error('Aucune demande en attente à exporter');
      return;
    }

    const csvContent = [
      ['ID', 'Date', 'Vendeur', 'Email', 'Banque', 'RIB', 'Montant (MAD)'],
      ...pending.map((p: any) => [
        p.id,
        format(new Date(p.createdAt), 'yyyy-MM-dd'),
        p.vendor?.profile?.fullName || 'N/A',
        p.vendor?.email || 'N/A',
        p.bankName,
        p.ribAccount,
        p.amountMad
      ])
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `payouts_pending_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredPayouts.filter((p: any) => p.status === 'PENDING').length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPayouts.filter((p: any) => p.status === 'PENDING').map((p: any) => p.id));
    }
  };

  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const statusColors: Record<string, any> = {
    PENDING: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', icon: <Clock size={14}/> },
    COMPLETED: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', icon: <CheckCircle2 size={14}/> },
    REJECTED: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-100', icon: <XCircle size={14}/> },
  };

  return (
    <div className="space-y-8 p-6">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Finance Dashboard</h1>
          <p className="text-gray-500 font-medium mt-1">Supervisez et validez les flux financiers de la plateforme.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              refetch();
              toast.success('Données actualisées');
            }}
            disabled={isLoading || isRefetching}
            className={`p-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl hover:text-violet-600 hover:border-violet-100 transition-all shadow-sm ${isRefetching ? 'animate-spin' : ''}`}
            title="Actualiser"
          >
            <RotateCcw size={18} />
          </button>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all shadow-sm"
          >
            <Download size={18} />
            Exporter CSV
          </button>
          {selectedIds.length > 0 && (
            <button 
              onClick={() => bulkApproveMutation.mutate(selectedIds)}
              disabled={bulkApproveMutation.isPending}
              className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl font-bold text-sm hover:bg-violet-700 transition-all shadow-md animate-in fade-in slide-in-from-right-4"
            >
              <CheckCircle size={18} />
              Approuver ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
            <Clock size={80} className="text-amber-600" />
          </div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">En attente</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900">{totalPendingAmount.toLocaleString()}</span>
            <span className="text-lg font-bold text-gray-400 uppercase">MAD</span>
          </div>
          <div className="mt-4 flex items-center gap-2 text-amber-600 font-bold text-xs bg-amber-50 w-fit px-2 py-1 rounded-lg border border-amber-100">
            <Clock size={12} />
            {pendingPayouts.length} demandes
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
            <CheckCircle2 size={80} className="text-emerald-600" />
          </div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Total Payé</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900">{totalCompletedAmount.toLocaleString()}</span>
            <span className="text-lg font-bold text-gray-400 uppercase">MAD</span>
          </div>
          <div className="mt-4 flex items-center gap-2 text-emerald-600 font-bold text-xs bg-emerald-50 w-fit px-2 py-1 rounded-lg border border-emerald-100">
            <CheckCircle2 size={12} />
            Validé
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
            <Wallet size={80} className="text-violet-600" />
          </div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Moyenne Retrait</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900">
              {payouts.length > 0 ? Math.round(totalCompletedAmount / payouts.length).toLocaleString() : 0}
            </span>
            <span className="text-lg font-bold text-gray-400 uppercase">MAD</span>
          </div>
          <div className="mt-4 flex items-center gap-2 text-violet-600 font-bold text-xs bg-violet-50 w-fit px-2 py-1 rounded-lg border border-violet-100">
            <ArrowUpRight size={12} />
            Par transaction
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text"
                placeholder="Rechercher par vendeur, RIB or banque..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-transparent focus:bg-white focus:border-violet-500 rounded-2xl text-sm font-medium transition-all outline-none"
              />
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-2xl border border-transparent">
              <Filter size={16} className="text-gray-400" />
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="PENDING">En attente</option>
                <option value="COMPLETED">Payé</option>
                <option value="REJECTED">Rejeté</option>
              </select>
            </div>
          </div>
          <div className="text-sm text-gray-500 font-medium">
            Affichage de <span className="text-gray-900 font-bold">{filteredPayouts.length}</span> résultats
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="p-4 text-left w-12">
                  <div 
                    onClick={toggleSelectAll}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all ${
                      selectedIds.length > 0 && selectedIds.length === filteredPayouts.filter((p: any) => p.status === 'PENDING').length
                        ? 'bg-violet-600 border-violet-600'
                        : 'bg-white border-gray-300'
                    }`}
                  >
                    {selectedIds.length > 0 && <CheckCircle size={14} className="text-white" />}
                  </div>
                </th>
                <th className="py-4 px-6 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Vendeur</th>
                <th className="py-4 px-6 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Détails Bancaires</th>
                <th className="py-4 px-6 text-left text-xs font-black text-gray-400 uppercase tracking-widest text-center">Montant</th>
                <th className="py-4 px-6 text-left text-xs font-black text-gray-400 uppercase tracking-widest text-center">Statut</th>
                <th className="py-4 px-6 text-left text-xs font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="p-8 text-center bg-gray-50/20">Chargement...</td>
                  </tr>
                ))
              ) : filteredPayouts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-gray-400 font-medium">Aucune donnée trouvée.</td>
                </tr>
              ) : (
                filteredPayouts.map((payout: any) => (
                  <tr key={payout.id} className="group hover:bg-violet-50/30 transition-colors">
                    <td className="p-4">
                      {payout.status === 'PENDING' && (
                        <div 
                          onClick={() => toggleSelect(payout.id)}
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all ${
                            selectedIds.includes(payout.id)
                              ? 'bg-violet-600 border-violet-600'
                              : 'bg-white border-gray-300 group-hover:border-violet-400'
                          }`}
                        >
                          {selectedIds.includes(payout.id) && <CheckCircle size={14} className="text-white" />}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-black text-xs border-2 border-white shadow-sm">
                          {(payout.vendor?.profile?.fullName || 'U').split(' ').map((n:any) => n[0]).join('').toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{payout.vendor?.profile?.fullName || 'Vendeur inconnu'}</p>
                          <p className="text-[11px] text-gray-400 font-medium">{payout.vendor?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                          <Building2 size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-700">{payout.bankName}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10px] font-mono text-gray-400">{payout.ribAccount}</span>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(payout.ribAccount);
                                toast.success('RIB copié !');
                              }}
                              className="p-1 hover:bg-white rounded-md text-gray-300 hover:text-violet-600 transition-all"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <p className="text-sm font-black text-gray-900">{Number(payout.amountMad).toLocaleString()} MAD</p>
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5 uppercase">{format(new Date(payout.createdAt), 'dd MMM yyyy', { locale: fr })}</p>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${statusColors[payout.status]?.bg} ${statusColors[payout.status]?.text} border ${statusColors[payout.status]?.border}`}>
                        {statusColors[payout.status]?.icon}
                        {payout.status}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {payout.status === 'PENDING' ? (
                          <>
                            <button 
                              onClick={() => rejectMutation.mutate(payout.id)}
                              className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                              title="Rejeter"
                            >
                              <XCircle size={18} />
                            </button>
                            <button 
                              onClick={() => approveMutation.mutate(payout.id)}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                              title="Approuver"
                            >
                              <CheckCircle2 size={18} />
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] font-bold text-gray-300 uppercase">Verrouillé</span>
                        )}
                        <button className="p-2 text-gray-400 hover:bg-white rounded-xl transition-all">
                          <MoreVertical size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

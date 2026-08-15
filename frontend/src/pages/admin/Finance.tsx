import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  RotateCcw,
  Eye,
  History,
  TrendingDown,
  TrendingUp,
  X,
  FileText,
  ArrowRight,
  Banknote,
  PlusCircle,
  MinusCircle,
  UserPlus
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AdminFinance() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Manual Adjustment State
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustTargetUser, setAdjustTargetUser] = useState<any>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [adjustDescription, setAdjustDescription] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<'PAYOUTS' | 'ADJUSTMENTS'>('PAYOUTS');

  const { data: financeUsersData } = useQuery({
    queryKey: ['admin-finance-users'],
    queryFn: () => adminApi.getFinanceUsers(),
  });

  const financeUsers = financeUsersData?.data?.data || [];

  const filteredFinanceUsers = useMemo(() => {
    if (!userSearchTerm) return [];
    return financeUsers.filter((u: any) => 
      u.fullName?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearchTerm.toLowerCase())
    ).slice(0, 8);
  }, [financeUsers, userSearchTerm]);

  const { data: payoutsData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-payouts'],
    queryFn: () => payoutsApi.list({ limit: 100 }),
  });

  const adjustMutation = useMutation({
    mutationFn: (data: any) => adminApi.adjustWallet(data),
    onSuccess: (res) => {
      toast.success(res.data.message);
      setAdjustModalOpen(false);
      setAdjustAmount('');
      setAdjustDescription('');
      setAdjustTargetUser(null);
      queryClient.invalidateQueries({ queryKey: ['admin-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'ajustement');
    }
  });

  // ... rest of the logic

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedPayoutForStatus, setSelectedPayoutForStatus] = useState<any>(null);

  const handleViewHistory = async (payout: any) => {
    setSelectedPayout(payout);
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const res = await payoutsApi.getHistory(payout.id);
      setHistoryData(res.data.data);
    } catch (error) {
      console.error('History fetch error:', error);
      toast.error('Erreur lors du chargement de l\'historique');
      setHistoryModalOpen(false);
    } finally {
      setHistoryLoading(false);
    }
  };

  const exportHistoryToCSV = () => {
    if (!historyData?.history) return;
    
    const headers = ['Date', 'Type', 'Description', 'Montant (MAD)', 'Solde Apres (MAD)'];
    const rows = historyData.history.map((item: any) => {
      let amount = 0;
      if (item.historyType === 'INVOICE') amount = item.totalAmountMad;
      else if (item.historyType === 'PAYOUT') amount = -item.amountMad;
      else amount = item.amountMad;

      return [
        format(new Date(item.createdAt), 'dd/MM/yyyy HH:mm'),
        item.historyType,
        item.description || item.invoiceNumber || item.type,
        amount,
        item.balanceAfter || ''
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `audit-retrait-${selectedPayout.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

  const bulkUpdateStatusMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: number[]; status: string }) => adminApi.bulkUpdatePayoutStatus(ids, status),
    onSuccess: (res) => {
      toast.success(res.data.message);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['admin-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur lors de la mise à jour en masse');
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

  const updateInvoiceMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => adminApi.updateInvoiceStatus(id, status),
    onSuccess: () => {
      toast.success('Statut mis à jour');
      queryClient.invalidateQueries({ queryKey: ['payout-history'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur');
    }
  });

  const updatePayoutStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => payoutsApi.updateStatus(id, status),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Statut mis à jour');
      setStatusModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur lors du changement de statut');
    }
  });

  const filteredPayouts = payouts.filter((p: any) => {
    const roleName = (p.vendor?.role?.name || p.vendor?.role || '').toUpperCase();
    const matchesSearch = 
      p.bankName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.vendor?.profile?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.vendor?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.ribAccount.includes(searchTerm);
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;

    let matchesRole = true;
    if (roleFilter !== 'ALL') {
      if (roleFilter === 'VENDOR') {
        matchesRole = ['VENDOR', 'SELLER'].includes(roleName);
      } else {
        matchesRole = roleName === roleFilter;
      }
    }

    return matchesSearch && matchesStatus && matchesRole;
  });

  const pendingPayouts = payouts.filter((p: any) => p.status === 'PENDING');
  const completedPayouts = payouts.filter((p: any) => p.status === 'COMPLETED');
  const rejectedPayouts = payouts.filter((p: any) => p.status === 'REJECTED');
  
  const totalPendingAmount = pendingPayouts.reduce((sum: number, p: any) => sum + Number(p.amountMad), 0);
  const totalCompletedAmount = completedPayouts.reduce((sum: number, p: any) => sum + Number(p.amountMad), 0);
  const totalRejectedAmount = rejectedPayouts.reduce((sum: number, p: any) => sum + Number(p.amountMad), 0);

  const handleExport = () => {
    const received = payouts.filter((p: any) => p.status === 'RECEIVED');
    if (received.length === 0) {
      toast.error('Aucune demande reçue à exporter');
      return;
    }

    const csvContent = [
      ['ID', 'Date', 'Vendeur', 'Email', 'Banque', 'RIB', 'Montant (MAD)', 'Statut'],
      ...received.map((p: any) => [
        p.id,
        format(new Date(p.createdAt), 'yyyy-MM-dd'),
        p.vendor?.profile?.fullName || 'N/A',
        p.vendor?.email || 'N/A',
        p.bankName,
        p.ribAccount,
        p.amountMad,
        p.status
      ])
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `payouts_received_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredPayouts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPayouts.map((p: any) => p.id));
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
    RECEIVED: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-100', icon: <CheckCircle2 size={14}/> },
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
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-gray-100">
        <button 
          onClick={() => setActiveTab('PAYOUTS')}
          className={`pb-4 px-2 text-sm font-black transition-all relative ${activeTab === 'PAYOUTS' ? 'text-violet-600 border-b-2 border-violet-600' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Demandes de Retrait
        </button>
        <button 
          onClick={() => setActiveTab('ADJUSTMENTS')}
          className={`pb-4 px-2 text-sm font-black transition-all relative ${activeTab === 'ADJUSTMENTS' ? 'text-violet-600 border-b-2 border-violet-600' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Ajustements Manuels
        </button>
      </div>

      {activeTab === 'ADJUSTMENTS' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Manual Adjustment Card (Quick Access) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-12 lg:col-span-12">
          <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-[32px] p-8 text-white shadow-xl shadow-violet-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Wallet size={120} />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="max-w-md">
                <h2 className="text-2xl font-black tracking-tight">Ajustement de Solde</h2>
                <p className="text-violet-100 font-medium mt-2">Donnez des bonus (donations) ou appliquez des frais manuels aux utilisateurs en toute sécurité.</p>
                <div className="mt-6 flex items-center gap-4">
                  <div className="flex -space-x-3">
                    {payouts.slice(0, 5).map((p: any, i: number) => (
                      <div key={i} className="w-10 h-10 rounded-full border-4 border-violet-600 bg-violet-100 text-violet-700 flex items-center justify-center text-[10px] font-black">
                        {p.vendor?.profile?.fullName?.[0] || 'U'}
                      </div>
                    ))}
                    <div className="w-10 h-10 rounded-full border-4 border-violet-600 bg-violet-500 flex items-center justify-center text-[10px] font-black">
                      +{payouts.length}
                    </div>
                  </div>
                  <p className="text-xs font-bold text-violet-200 uppercase tracking-widest">Utilisateurs actifs</p>
                </div>
              </div>
              
              <div className="flex-1 w-full max-w-lg bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <button 
                    onClick={() => setAdjustType('CREDIT')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs transition-all ${adjustType === 'CREDIT' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-white/5 text-violet-100 hover:bg-white/10'}`}
                  >
                    <PlusCircle size={16} />
                    CRÉDIT (+)
                  </button>
                  <button 
                    onClick={() => setAdjustType('DEBIT')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs transition-all ${adjustType === 'DEBIT' ? 'bg-rose-500 text-white shadow-lg' : 'bg-white/5 text-violet-100 hover:bg-white/10'}`}
                  >
                    <MinusCircle size={16} />
                    DÉBIT (-)
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="relative">
                    <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-300" size={18} />
                    <input 
                      type="text"
                      placeholder={adjustTargetUser ? (adjustTargetUser.fullName || adjustTargetUser.email) : "Chercher un utilisateur..."}
                      value={userSearchTerm}
                      onFocus={() => setShowUserDropdown(true)}
                      onChange={(e) => {
                        setUserSearchTerm(e.target.value);
                        setShowUserDropdown(true);
                      }}
                      className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-white placeholder-violet-300 focus:bg-white/10 focus:border-white/30 outline-none transition-all"
                    />
                    
                    {showUserDropdown && filteredFinanceUsers.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-violet-800 border border-violet-700 rounded-xl shadow-2xl overflow-hidden z-[100] animate-in slide-in-from-top-2">
                        {filteredFinanceUsers.map((u: any) => (
                            <button
                              key={u.id}
                              onClick={() => {
                                setAdjustTargetUser(u);
                                setUserSearchTerm('');
                                setShowUserDropdown(false);
                              }}
                              className="w-full flex items-center justify-between px-4 py-3 hover:bg-violet-700 transition-colors text-left border-b border-violet-700/50 last:border-0"
                            >
                              <div>
                                <p className="text-xs font-black text-white">{u.fullName}</p>
                                <p className="text-[10px] text-violet-300">{u.email}</p>
                              </div>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded text-white uppercase tracking-tighter ${
                                u.role === 'VENDOR' ? 'bg-blue-500' : 
                                u.role === 'GROSSELLER' ? 'bg-amber-500' : 
                                u.role === 'INFLUENCER' ? 'bg-pink-500' : 'bg-violet-600'
                              }`}>
                                {u.role === 'VENDOR' ? 'Vendeur' : 
                                 u.role === 'GROSSELLER' ? 'Grossiste' : 
                                 u.role === 'INFLUENCER' ? 'Influenceur' : u.role}
                              </span>
                            </button>
                        ))}
                      </div>
                    )}

                    {adjustTargetUser && !userSearchTerm && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded uppercase border border-emerald-500/30">
                          {adjustTargetUser.role === 'VENDOR' ? 'Vendeur' : 
                           adjustTargetUser.role === 'GROSSELLER' ? 'Grossiste' : 
                           adjustTargetUser.role === 'INFLUENCER' ? 'Influenceur' : adjustTargetUser.role}
                        </span>
                        <button 
                          onClick={() => setAdjustTargetUser(null)}
                          className="text-violet-300 hover:text-white"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-300" size={18} />
                      <input 
                        type="number"
                        placeholder="Montant (MAD)"
                        value={adjustAmount}
                        onChange={(e) => setAdjustAmount(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-white placeholder-violet-300 focus:bg-white/10 focus:border-white/30 outline-none transition-all"
                      />
                    </div>
                    <input 
                      type="text"
                      placeholder="Description (ex: Donation)"
                      value={adjustDescription}
                      onChange={(e) => setAdjustDescription(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-white placeholder-violet-300 focus:bg-white/10 focus:border-white/30 outline-none transition-all"
                    />
                  </div>

                  <button 
                    onClick={() => {
                      if (!adjustTargetUser || !adjustAmount) {
                        toast.error('Veuillez remplir tous les champs');
                        return;
                      }
                      adjustMutation.mutate({
                        userId: adjustTargetUser.id,
                        amount: Number(adjustAmount),
                        type: adjustType,
                        description: adjustDescription
                      });
                    }}
                    disabled={adjustMutation.isPending}
                    className="w-full py-4 bg-white text-violet-700 rounded-xl font-black text-sm hover:bg-violet-50 transition-all shadow-xl disabled:opacity-50"
                  >
                    {adjustMutation.isPending ? 'Traitement...' : 'Appliquer l\'ajustement'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
      )}

      {activeTab === 'PAYOUTS' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            {completedPayouts.length} validées
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
            <XCircle size={80} className="text-rose-600" />
          </div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Total Rejeté</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900">{totalRejectedAmount.toLocaleString()}</span>
            <span className="text-lg font-bold text-gray-400 uppercase">MAD</span>
          </div>
          <div className="mt-4 flex items-center gap-2 text-rose-600 font-bold text-xs bg-rose-50 w-fit px-2 py-1 rounded-lg border border-rose-100">
            <XCircle size={12} />
            {rejectedPayouts.length} refusées
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
            <Wallet size={80} className="text-violet-600" />
          </div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Total Reçu</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900">
              {payouts.filter((p: any) => p.status === 'RECEIVED').reduce((sum: number, p: any) => sum + Number(p.amountMad), 0).toLocaleString()}
            </span>
            <span className="text-lg font-bold text-gray-400 uppercase">MAD</span>
          </div>
          <div className="mt-4 flex items-center gap-2 text-violet-600 font-bold text-xs bg-violet-50 w-fit px-2 py-1 rounded-lg border border-violet-100">
            <FileText size={12} />
            {payouts.filter((p: any) => p.status === 'RECEIVED').length} confirmés
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text"
                placeholder="Rechercher par vendeur, RIB ou banque..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-transparent focus:bg-white focus:border-violet-500 rounded-2xl text-sm font-medium transition-all outline-none"
              />
            </div>

            {/* Account Type Filter */}
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-400" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold rounded-2xl px-3 py-2 focus:outline-none focus:border-violet-500 cursor-pointer"
              >
                <option value="ALL">Tous les types de compte</option>
                <option value="CALL_CENTER_AGENT">🎧 Agent Call Center</option>
                <option value="HELPER">✨ Helper / Affilié</option>
                <option value="VENDOR">👤 Vendeur</option>
                <option value="GROSSELLER">📦 Grossiste</option>
                <option value="INFLUENCER">⭐ Influenceur</option>
              </select>
            </div>

            <div className="flex items-center gap-1 p-1 bg-gray-100/50 rounded-2xl border border-gray-100">
              {[
                { id: 'ALL', label: 'Tous', icon: <History size={14}/> },
                { id: 'PENDING', label: 'En attente', icon: <Clock size={14}/> },
                { id: 'COMPLETED', label: 'Payé', icon: <CheckCircle2 size={14}/> },
                { id: 'REJECTED', label: 'Rejeté', icon: <XCircle size={14}/> },
                { id: 'RECEIVED', label: 'Réçu', icon: <FileText size={14}/> },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    statusFilter === tab.id 
                      ? 'bg-white text-violet-600 shadow-sm' 
                      : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
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
                      selectedIds.length > 0 && selectedIds.length === filteredPayouts.length
                        ? 'bg-violet-600 border-violet-600'
                        : 'bg-white border-gray-300'
                    }`}
                  >
                    {selectedIds.length > 0 && <CheckCircle size={14} className="text-white" />}
                  </div>
                </th>
                <th className="py-4 px-6 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Utilisateur</th>
                <th className="py-4 px-6 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Type</th>
                <th className="py-4 px-6 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Détails Bancaires</th>
                <th className="py-4 px-6 text-left text-xs font-black text-gray-400 uppercase tracking-widest text-center">Montant</th>
                <th className="py-4 px-6 text-left text-xs font-black text-gray-400 uppercase tracking-widest text-center">Solde</th>
                <th className="py-4 px-6 text-left text-xs font-black text-gray-400 uppercase tracking-widest text-center">Statut</th>
                <th className="py-4 px-6 text-left text-xs font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={8} className="p-8 text-center bg-gray-50/20">Chargement...</td>
                  </tr>
                ))
              ) : filteredPayouts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-gray-400 font-medium">Aucune donnée trouvée.</td>
                </tr>
              ) : (
                filteredPayouts.map((payout: any) => (
                  <tr key={payout.id} className="group hover:bg-violet-50/30 transition-colors">
                    <td className="p-4">
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
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-black text-xs border-2 border-white shadow-sm">
                          {(payout.vendor?.profile?.fullName || 'U').split(' ').map((n:any) => n[0]).join('').toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{payout.vendor?.profile?.fullName || 'Utilisateur inconnu'}</p>
                          <p className="text-[11px] text-gray-400 font-medium">{payout.vendor?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {(() => {
                        const role = (payout.vendor?.role?.name || payout.vendor?.role || 'VENDOR').toUpperCase();
                        if (role === 'CALL_CENTER_AGENT') {
                          return (
                            <span className="whitespace-nowrap inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
                              🎧 Agent Call Center
                            </span>
                          );
                        }
                        if (role === 'HELPER') {
                          return (
                            <span className="whitespace-nowrap inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ✨ Helper
                            </span>
                          );
                        }
                        if (role === 'GROSSELLER') {
                          return (
                            <span className="whitespace-nowrap inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                              📦 Grossiste
                            </span>
                          );
                        }
                        if (role === 'INFLUENCER') {
                          return (
                            <span className="whitespace-nowrap inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-pink-50 text-pink-700 border border-pink-200">
                              ⭐ Influenceur
                            </span>
                          );
                        }
                        return (
                          <span className="whitespace-nowrap inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                            👤 Vendeur
                          </span>
                        );
                      })()}
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
                      <div className="inline-flex flex-col items-center">
                        <p className="text-sm font-black text-violet-600">
                          {payout.vendor?.wallet 
                            ? Number(payout.vendor.wallet.balanceMad).toLocaleString() 
                            : '---'} MAD
                        </p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Solde actuel</p>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${statusColors[payout.status]?.bg} ${statusColors[payout.status]?.text} border ${statusColors[payout.status]?.border}`}>
                        {statusColors[payout.status]?.icon}
                        {payout.status}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setSelectedPayoutForStatus(payout);
                            setStatusModalOpen(true);
                          }}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                          title="Gérer le statut"
                        >
                          <Banknote size={18} />
                        </button>
                        <button 
                          onClick={() => handleViewHistory(payout)}
                          className="p-2 text-violet-600 hover:bg-violet-50 rounded-xl transition-all"
                          title="Voir l'historique"
                        >
                          <Eye size={18} />
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
      )}

      {/* History Modal */}
      {historyModalOpen && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
            onClick={() => setHistoryModalOpen(false)}
          />
          <div 
            className="relative z-10 bg-white rounded-[32px] shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 overflow-hidden cursor-default"
            style={{ backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-violet-600 text-white rounded-2xl shadow-lg shadow-violet-200">
                  <History size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900 tracking-tight">Historique de la Période</h2>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                    {selectedPayout?.vendor?.profile?.fullName || 'Vendeur'} • Retrait #{selectedPayout?.id}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!historyLoading && historyData && (
                  <button 
                    onClick={exportHistoryToCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl font-bold text-xs hover:bg-emerald-100 transition-all"
                  >
                    <Download size={14} />
                    Exporter Audit
                  </button>
                )}
                <button 
                  onClick={() => setHistoryModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-400 hover:text-gray-900"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {historyLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="w-12 h-12 border-4 border-violet-100 border-t-violet-600 rounded-full animate-spin" />
                  <p className="text-sm font-bold text-gray-400 animate-pulse">Calcul de la période en cours...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Period Summary Info */}
                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-violet-600 shadow-sm border border-gray-100">
                        <Clock size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Période d'audit</p>
                        <p className="text-xs font-bold text-gray-700">
                          {historyData?.period?.isFirstPayout ? 'Depuis la création' : `Du ${format(new Date(historyData?.period?.start), 'dd MMM yyyy HH:mm', { locale: fr })}`} 
                          <span className="mx-2 text-gray-300">→</span> 
                          Au {format(new Date(historyData?.period?.end), 'dd MMM yyyy HH:mm', { locale: fr })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Period Stats Overview */}
                  {historyData?.history && (
                    <div className="grid grid-cols-3 gap-3">
                      {(() => {
                        const stats = historyData.history.reduce((acc: any, item: any) => {
                          if (item.historyType === 'INVOICE') acc.invoices += item.totalAmountMad;
                          else if (item.historyType === 'PAYOUT') acc.payouts += Math.abs(item.amountMad);
                          else if (item.historyType === 'TRANSACTION') {
                            const isFee = item.type === 'FEE' || item.description?.toLowerCase().includes('frais');
                            if (isFee) acc.fees += Math.abs(item.amountMad);
                          }
                          return acc;
                        }, { invoices: 0, payouts: 0, fees: 0 });

                        return (
                          <>
                            <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-3 flex flex-col justify-center">
                              <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Total Gains</p>
                              <p className="text-sm font-black text-emerald-700">+{stats.invoices.toLocaleString()} <span className="text-[10px] opacity-70">MAD</span></p>
                            </div>
                            <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-3 flex flex-col justify-center">
                              <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest mb-1">Total Retraits</p>
                              <p className="text-sm font-black text-rose-700">-{stats.payouts.toLocaleString()} <span className="text-[10px] opacity-70">MAD</span></p>
                            </div>
                            <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-3 flex flex-col justify-center">
                              <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Total Frais</p>
                              <p className="text-sm font-black text-amber-700">-{stats.fees.toLocaleString()} <span className="text-[10px] opacity-70">MAD</span></p>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* History List */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      Détail des flux
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px]">{historyData?.history?.length || 0}</span>
                    </h3>

                    {historyData?.history?.length === 0 ? (
                      <div className="py-12 text-center text-gray-400 font-medium bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-100">
                        Aucun mouvement détecté sur cette période.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {historyData?.history?.map((item: any, idx: number) => {
                          const isInvoice = item.historyType === 'INVOICE';
                          const isPayout = item.historyType === 'PAYOUT';
                          const isTransaction = item.historyType === 'TRANSACTION';

                          let icon = <FileText size={16} />;
                          let title = '';
                          let amount = 0;
                          let typeLabel = '';
                          let color = 'gray';

                          if (isInvoice) {
                            icon = <TrendingUp size={16} />;
                            title = `Facture ${item.invoiceNumber}`;
                            amount = item.totalAmountMad;
                            typeLabel = 'Gains (Leads)';
                            color = 'emerald';
                          } else if (isPayout) {
                            icon = <TrendingDown size={16} />;
                            title = `Retrait #${item.id}`;
                            amount = -item.amountMad;
                            typeLabel = 'Retrait';
                            color = 'rose';
                          } else if (isTransaction) {
                            const isFee = item.type === 'FEE' || item.description?.toLowerCase().includes('frais');
                            icon = isFee ? <TrendingDown size={16} /> : <TrendingDown size={16} />;
                            title = item.description || item.type;
                            amount = item.amountMad;
                            typeLabel = isFee ? 'Frais' : 'Mouvement';
                            color = amount < 0 ? 'rose' : 'emerald';
                          }

                          const colorClasses: Record<string, string> = {
                            emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
                            rose: 'bg-rose-50 text-rose-600 border-rose-100',
                            gray: 'bg-gray-50 text-gray-600 border-gray-100',
                            violet: 'bg-violet-50 text-violet-600 border-violet-100',
                          };

                          return (
                            <div key={`${item.historyType}-${item.id || idx}`} className="group/item">
                              <div className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:border-violet-200 hover:shadow-sm transition-all">
                                <div className="flex items-center gap-4">
                                  <div className={`p-2.5 rounded-xl border ${colorClasses[color]}`}>
                                    {icon}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-bold text-gray-900">{title}</p>
                                      {isInvoice && (
                                        <div className="flex items-center gap-1.5">
                                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter border ${
                                            item.status === 'PAID' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                          }`}>
                                            {item.status}
                                          </span>
                                          <button 
                                            onClick={() => setEditingInvoiceId(editingInvoiceId === item.id ? null : item.id)}
                                            className="p-1 hover:bg-emerald-50 rounded-md text-emerald-600 transition-all"
                                            title="Changer le statut"
                                          >
                                            <Banknote size={14} />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{typeLabel}</span>
                                      <span className="text-[10px] text-gray-300">•</span>
                                      <span className="text-[10px] font-medium text-gray-400">{format(new Date(item.createdAt), 'dd MMM yyyy HH:mm', { locale: fr })}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className={`text-sm font-black ${amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    {amount > 0 ? '+' : ''}{amount.toLocaleString()} MAD
                                  </p>
                                  {item.balanceAfter !== undefined && (
                                    <div className="flex flex-col items-end mt-1">
                                      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-50 border border-gray-100 rounded-lg">
                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Solde</span>
                                        <div className="flex items-center gap-1">
                                          <span className="text-[10px] font-medium text-gray-400">{(item.balanceAfter - amount).toLocaleString()}</span>
                                          <ArrowRight size={8} className="text-gray-300" />
                                          <span className="text-[10px] font-bold text-violet-600">{item.balanceAfter.toLocaleString()}</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Status Switcher for Invoice */}
                              {isInvoice && editingInvoiceId === item.id && (
                                <div className="mt-2 ml-14 flex items-center gap-2 p-2 bg-violet-50/50 rounded-2xl border border-violet-100 animate-in slide-in-from-top-2 duration-300">
                                  <span className="text-[9px] font-black text-violet-400 uppercase ml-2 mr-1 tracking-tighter">Statut Facture:</span>
                                  {['PAID', 'UNPAID', 'PENDING', 'CANCELLED'].map((s) => (
                                    <button
                                      key={s}
                                      onClick={() => {
                                        updateInvoiceMutation.mutate({ id: item.id, status: s });
                                        setEditingInvoiceId(null);
                                      }}
                                      className={`px-3 py-1 rounded-xl text-[9px] font-black transition-all ${
                                        item.status === s 
                                          ? 'bg-violet-600 text-white shadow-md scale-105' 
                                          : 'bg-white text-gray-400 hover:text-violet-600 border border-gray-100'
                                      }`}
                                    >
                                      {s}
                                    </button>
                                  ))}
                                  <button 
                                    onClick={() => setEditingInvoiceId(null)}
                                    className="ml-auto p-1.5 hover:bg-white rounded-lg text-gray-400"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {!historyLoading && (
              <div className="p-6 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Montant du retrait actuel</p>
                  <p className="text-lg font-black text-gray-900">{Number(selectedPayout?.amountMad).toLocaleString()} MAD</p>
                </div>
                <button 
                  onClick={() => setHistoryModalOpen(false)}
                  className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all shadow-sm"
                >
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Status Change Modal */}
      {statusModalOpen && selectedPayoutForStatus && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
            onClick={() => setStatusModalOpen(false)}
          />
          <div 
            className="relative z-10 bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 cursor-default"
            style={{ backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
          >
            <div className="p-6 border-b border-gray-50 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-gray-900">Gérer le statut</h2>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                  Retrait #{selectedPayoutForStatus.id} • {Number(selectedPayoutForStatus.amountMad).toLocaleString()} MAD
                </p>
              </div>
              <button 
                onClick={() => setStatusModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-400"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-3">
              {[
                { id: 'PENDING', label: 'En attente', icon: <Clock size={18}/>, color: 'amber', desc: 'Le retrait est en cours de vérification.' },
                { id: 'COMPLETED', label: 'Payé', icon: <CheckCircle2 size={18}/>, color: 'emerald', desc: 'Le virement a été effectué avec succès.' },
                { id: 'REJECTED', label: 'Rejeté', icon: <XCircle size={18}/>, color: 'rose', desc: 'Le retrait est refusé et l\'argent est rendu au vendeur.' },
                { id: 'RECEIVED', label: 'Réçu', icon: <FileText size={18}/>, color: 'violet', desc: 'Le vendeur a confirmé la réception des fonds.' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    updatePayoutStatusMutation.mutate({ id: selectedPayoutForStatus.id, status: s.id });
                  }}
                  disabled={updatePayoutStatusMutation.isPending || selectedPayoutForStatus.status === s.id}
                  className={`w-full flex items-start gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                    selectedPayoutForStatus.status === s.id
                      ? `border-${s.color}-200 bg-${s.color}-50/50 ring-2 ring-${s.color}-100`
                      : 'border-transparent bg-gray-50 hover:bg-white hover:border-gray-200'
                  } ${updatePayoutStatusMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className={`p-2 rounded-xl bg-white shadow-sm border border-gray-100 text-${s.color}-600`}>
                    {s.icon}
                  </div>
                  <div>
                    <p className={`text-sm font-black ${selectedPayoutForStatus.status === s.id ? `text-${s.color}-700` : 'text-gray-900'}`}>
                      {s.label}
                      {selectedPayoutForStatus.status === s.id && <span className="ml-2 text-[10px] uppercase tracking-tighter opacity-50">(Actuel)</span>}
                    </p>
                    <p className="text-[11px] font-medium text-gray-400 leading-tight mt-0.5">{s.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setStatusModalOpen(false)}
                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all shadow-sm"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

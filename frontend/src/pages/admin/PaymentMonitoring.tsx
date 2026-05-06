import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import { 
  CreditCard, 
  User as UserIcon, 
  ChevronRight, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Search,
  ArrowLeft,
  Filter,
  CheckSquare,
  Square,
  FileText,
  Clock,
  Package,
  RefreshCw,
  TrendingUp,
  Truck,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function PaymentMonitoring() {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [viewingUserLeads, setViewingUserLeads] = useState(false);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [leadSearchTerm, setLeadSearchTerm] = useState('');

  // 1. Fetch Users Summary
  const { data: summaryData, isLoading: isLoadingSummary } = useQuery({
    queryKey: ['admin-payment-summary'],
    queryFn: () => adminApi.getPaymentMonitoring(),
  });

  // 2. Fetch Specific User Leads
  const { data: userLeadsData, isLoading: isLoadingUserLeads } = useQuery({
    queryKey: ['admin-user-paid-leads', selectedUser?.id],
    queryFn: () => adminApi.getUserPaymentMonitoring(selectedUser.id),
    enabled: !!selectedUser,
  });

  const users = summaryData?.data?.data || [];
  const userLeads = userLeadsData?.data?.data || [];

  // 3. Bulk Update Mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: (situation: string) => 
      adminApi.bulkUpdatePaymentSituation({ 
        leadIds: selectedLeadIds, 
        situation 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-paid-leads'] });
      queryClient.invalidateQueries({ queryKey: ['admin-payment-summary'] });
      toast.success('Statut mis à jour avec succès');
      setSelectedLeadIds([]);
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  });

  const filteredUsers = users.filter((u: any) => {
    const matchesSearch = u.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const overallStats = filteredUsers.reduce((acc: any, u: any) => {
    acc.totalColis += u.paidCount || 0;
    acc.totalMoney += u.totalPaidAmount || 0;
    
    // Admin Profit calculation:
    // The summary provides the Net Amount (after 57 MAD delivery and 13% platform fee).
    // Formula to recover the fee: (Net Amount / 0.87) * 0.13
    const userAdminProfit = (u.totalPaidAmount / 0.87) * 0.13;
    acc.totalAdminProfit += userAdminProfit;
    
    acc.totalDeliveryCost += (u.paidCount || 0) * 57;
    acc.totalAdminNetProfit = acc.totalAdminProfit + acc.totalDeliveryCost;
    
    return acc;
  }, { totalColis: 0, totalMoney: 0, totalAdminProfit: 0, totalDeliveryCost: 0, totalAdminNetProfit: 0 });

  const filteredUserLeads = userLeads.filter((l: any) => 
    l.fullName?.toLowerCase().includes(leadSearchTerm.toLowerCase()) ||
    l.phone?.toLowerCase().includes(leadSearchTerm.toLowerCase()) ||
    (l.referralLink?.product?.nameFr || l.order?.items?.[0]?.product?.nameFr || l.productVariant || '').toLowerCase().includes(leadSearchTerm.toLowerCase())
  );

  const handleSelectLead = (id: number) => {
    setSelectedLeadIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedLeadIds.length === filteredUserLeads.length && filteredUserLeads.length > 0) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredUserLeads.map((l: any) => l.id));
    }
  };

  if (viewingUserLeads && selectedUser) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { setViewingUserLeads(false); setSelectedUser(null); setSelectedLeadIds([]); setLeadSearchTerm(''); }}
              className="p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">Colis de {selectedUser.fullName}</h1>
              <p className="text-sm text-gray-500 font-medium">Gestion des leads marqués comme 💳 Payé</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Rechercher dans les leads..."
                value={leadSearchTerm}
                onChange={(e) => setLeadSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all shadow-sm"
              />
            </div>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-user-paid-leads', selectedUser?.id] })}
              disabled={isLoadingUserLeads}
              className="p-2.5 bg-white border border-gray-100 rounded-2xl text-gray-500 hover:text-violet-600 hover:bg-violet-50 hover:border-violet-100 transition-all shadow-sm disabled:opacity-50 flex-shrink-0"
              title="Actualiser"
            >
              <RefreshCw className={`w-5 h-5 ${isLoadingUserLeads ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* User Stats Card */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-100">
              <UserIcon size={28} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{selectedUser.role}</p>
              <h2 className="text-xl font-black text-gray-900">{selectedUser.fullName}</h2>
              <p className="text-xs text-gray-400 font-medium">{selectedUser.email}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Payé</p>
            <p className="text-2xl font-black text-green-600">{selectedUser.totalPaidAmount.toLocaleString()} <span className="text-sm">MAD</span></p>
          </div>
        </div>

        {/* Leads Table */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-2">
              <button 
                onClick={handleSelectAll}
                className="p-1 hover:bg-gray-200 rounded transition-all"
              >
                {selectedLeadIds.length === filteredUserLeads.length && filteredUserLeads.length > 0 ? <CheckSquare className="w-5 h-5 text-violet-600" /> : <Square className="w-5 h-5 text-gray-400" />}
              </button>
              <span className="text-sm font-bold text-gray-700">
                {selectedLeadIds.length > 0 ? `${selectedLeadIds.length} sélectionnés` : `${filteredUserLeads.length} leads trouvés`}
              </span>
            </div>
            {selectedLeadIds.length > 0 && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => bulkUpdateMutation.mutate('FACTURED')}
                  disabled={bulkUpdateMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
                >
                  <FileText size={14} /> Marquer comme Facturé
                </button>
                <button 
                  onClick={() => bulkUpdateMutation.mutate('NOT_PAID')}
                  disabled={bulkUpdateMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-bold hover:bg-red-100 transition-all"
                >
                  <AlertCircle size={14} /> Annuler Paiement
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                  <th className="px-6 py-4 w-10"></th>
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">Produit</th>
                  <th className="px-6 py-4 text-center">Montant</th>
                  <th className="px-6 py-4 text-center">Statut</th>
                  <th className="px-6 py-4 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoadingUserLeads ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="px-6 py-8"><div className="h-10 bg-gray-50 rounded-xl" /></td>
                    </tr>
                  ))
                ) : filteredUserLeads.map((lead: any) => (
                  <tr key={lead.id} className={`group hover:bg-gray-50/80 transition-all ${selectedLeadIds.includes(lead.id) ? 'bg-violet-50/50' : ''}`}>
                    <td className="px-6 py-4">
                      <button onClick={() => handleSelectLead(lead.id)}>
                        {selectedLeadIds.includes(lead.id) ? <CheckSquare className="w-5 h-5 text-violet-600" /> : <Square className="w-5 h-5 text-gray-300 group-hover:text-gray-400" />}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{lead.fullName}</div>
                      <div className="text-[10px] text-gray-400 font-medium">{lead.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Package size={14} className="text-gray-400" />
                        </div>
                        <div className="text-xs font-bold text-gray-700 truncate max-w-[150px]">
                          {lead.referralLink?.product?.nameFr || lead.order?.items?.[0]?.product?.nameFr || lead.productVariant || 'Produit inconnu'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {(() => {
                        const grossAmount = Number(lead.order?.totalAmountMad) || 0;
                        const deliveryCost = 57;
                        const profit = grossAmount - deliveryCost;
                        const platformFee = profit > 0 ? profit * 0.13 : 0;
                        const netAmount = grossAmount - deliveryCost - platformFee;
                        return (
                          <div className="flex flex-col items-center">
                            <div className="text-sm font-black text-gray-900" title="Montant Brut">{grossAmount} MAD</div>
                            <div className="text-[10px] text-red-500 font-medium mt-0.5">
                              -57 DH <span className="text-gray-400 font-normal">(Liv.)</span>
                            </div>
                            <div className="text-[10px] text-red-500 font-medium">
                              -{platformFee.toFixed(2)} MAD <span className="text-gray-400 font-normal">(13%)</span>
                            </div>
                            <div className="text-xs font-bold text-green-600 mt-1 bg-green-50 px-2 py-0.5 rounded-md border border-green-100">
                              Net: {netAmount.toFixed(2)} MAD
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-black uppercase tracking-widest">
                        Payé
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-[10px] font-bold text-gray-400 flex items-center justify-end gap-1">
                        <Calendar size={10} /> {format(new Date(lead.createdAt), 'dd/MM/yyyy')}
                      </div>
                      <div className="text-[10px] font-medium text-gray-300 mt-0.5">
                        <Clock size={10} className="inline mr-1" /> {format(new Date(lead.createdAt), 'HH:mm')}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Suivi des Paiements</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">Surveillez les colis marqués comme 💳 Payé par les partenaires</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Rechercher un partenaire..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/10 focus:border-violet-500 transition-all shadow-sm"
            />
          </div>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-payment-summary'] })}
            disabled={isLoadingSummary}
            className="p-2.5 bg-white border border-gray-100 rounded-2xl text-gray-500 hover:text-violet-600 hover:bg-violet-50 hover:border-violet-100 transition-all shadow-sm disabled:opacity-50 flex-shrink-0"
            title="Actualiser"
          >
            <RefreshCw className={`w-5 h-5 ${isLoadingSummary ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
  
      {/* Overall Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 animate-fadeIn">
        <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-100">
            <UserIcon size={18} />
          </div>
          <div>
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Partenaires</p>
            <p className="text-base font-black text-gray-900 leading-none">{filteredUsers.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center border border-green-100">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Colis Payés</p>
            <p className="text-base font-black text-gray-900 leading-none">{overallStats.totalColis}</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <Truck size={18} />
          </div>
          <div>
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Frais de livraison</p>
            <p className="text-base font-black text-indigo-600 leading-none">+{overallStats.totalDeliveryCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">COD Fee (13%)</p>
            <p className="text-base font-black text-blue-600 leading-none">+{overallStats.totalAdminProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex items-center gap-3 ring-2 ring-emerald-500/10 shadow-lg shadow-emerald-500/5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <Activity size={18} />
          </div>
          <div>
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Admin Profite</p>
            <p className="text-base font-black text-emerald-600 leading-none">+{overallStats.totalAdminNetProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[8px]">MAD</span></p>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <CreditCard size={18} />
          </div>
          <div>
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Total Money</p>
            <p className="text-base font-black text-gray-900 leading-none">{overallStats.totalMoney.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[8px]">MAD</span></p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {['ALL', 'INFLUENCER', 'VENDOR'].map((role) => (
          <button
            key={role}
            onClick={() => setRoleFilter(role)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              roleFilter === role
                ? 'bg-violet-600 text-white border-violet-600 shadow-lg shadow-violet-200'
                : 'bg-white text-gray-600 border-gray-100 hover:bg-gray-50'
            }`}
          >
            {role === 'ALL' ? 'Tous les Rôles' : role}
          </button>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoadingSummary ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="h-40 bg-white rounded-3xl animate-pulse border border-gray-100 shadow-sm" />
          ))
        ) : filteredUsers.length > 0 ? (
          filteredUsers.map((user: any) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              key={user.id}
              onClick={() => { setSelectedUser(user); setViewingUserLeads(true); }}
              className="group cursor-pointer bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-violet-500/5 hover:-translate-y-1 transition-all relative overflow-hidden"
            >
              {/* Background Accent */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500" />
              
              <div className="flex items-start justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-400 group-hover:bg-violet-600 group-hover:text-white flex items-center justify-center border border-gray-100 transition-colors duration-300">
                  <UserIcon size={24} />
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    user.role === 'INFLUENCER' ? 'bg-pink-100 text-pink-600' : 'bg-cyan-100 text-cyan-600'
                  }`}>
                    {user.role}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-black text-gray-900 group-hover:text-violet-600 transition-colors truncate">
                  {user.fullName || 'Sans nom'}
                </h3>
                <p className="text-xs text-gray-400 font-medium truncate mb-4">{user.email}</p>
                
                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Colis Payés</p>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-green-500" />
                      <span className="text-sm font-black text-gray-900">{user.paidCount}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total</p>
                    <p className="text-sm font-black text-gray-900">{user.totalPaidAmount.toLocaleString()} <span className="text-[10px]">MAD</span></p>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                <ChevronRight className="w-5 h-5 text-violet-600" />
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={32} className="text-gray-300" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">Aucun colis payé trouvé</h3>
            <p className="text-gray-500 text-sm max-w-sm mx-auto font-medium">Les partenaires apparaîtront ici dès qu'ils marqueront des leads comme payés.</p>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { 
  Users, 
  Link2, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Percent, 
  DollarSign, 
  RefreshCw, 
  Award, 
  Edit3, 
  TrendingUp, 
  ShieldCheck, 
  ShieldAlert,
  Copy,
  ExternalLink,
  ChevronRight,
  UserCheck
} from 'lucide-react';

export default function AdminHelpersAffiliate() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingHelper, setEditingHelper] = useState<any>(null);
  const [newCommission, setNewCommission] = useState<number>(5);
  const [newPermission, setNewPermission] = useState<boolean>(true);

  // Fetch helper affiliate stats
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['admin-helpers-affiliate-stats'],
    queryFn: () => adminApi.getHelperAffiliateStats(),
  });

  const helpers = data?.data?.data || [];

  // Mutation to update helper affiliate config
  const updateConfigMutation = useMutation({
    mutationFn: ({ id, canManageAffiliateInvites, helperCommissionPerDeliveredLead }: { 
      id: number; 
      canManageAffiliateInvites?: boolean; 
      helperCommissionPerDeliveredLead?: number 
    }) => adminApi.updateHelperAffiliateConfig(id, { canManageAffiliateInvites, helperCommissionPerDeliveredLead }),
    onSuccess: () => {
      toast.success('Configuration affiliate mise à jour');
      queryClient.invalidateQueries({ queryKey: ['admin-helpers-affiliate-stats'] });
      setEditingHelper(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Erreur lors de la mise à jour');
    }
  });

  const handleTogglePermission = (helper: any) => {
    updateConfigMutation.mutate({
      id: helper.id,
      canManageAffiliateInvites: !helper.canManageAffiliateInvites,
    });
  };

  const handleSaveCommission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHelper) return;
    updateConfigMutation.mutate({
      id: editingHelper.id,
      canManageAffiliateInvites: newPermission,
      helperCommissionPerDeliveredLead: newCommission,
    });
  };

  // Filtered helpers
  const filteredHelpers = helpers.filter((h: any) => {
    const search = searchTerm.toLowerCase();
    return (
      (h.fullName && h.fullName.toLowerCase().includes(search)) ||
      (h.email && h.email.toLowerCase().includes(search)) ||
      (h.phone && h.phone.toLowerCase().includes(search)) ||
      (h.referralCode && h.referralCode.toLowerCase().includes(search))
    );
  });

  // Calculate totals
  const totalHelpers = helpers.length;
  const activeAffiliateHelpers = helpers.filter((h: any) => h.canManageAffiliateInvites).length;
  const totalInvitedUsers = helpers.reduce((sum: number, h: any) => sum + (h.totalInvitedUsers || 0), 0);
  const totalDeliveredLeads = helpers.reduce((sum: number, h: any) => sum + (h.deliveredLeads || 0), 0);
  const totalEarningsGenerated = helpers.reduce((sum: number, h: any) => sum + (h.totalEarnings || 0), 0);

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-[1600px] mx-auto animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-amber-600 via-orange-600 to-indigo-700 p-8 md:p-12 text-white shadow-2xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-black uppercase tracking-widest text-amber-100 border border-white/20">
              <Award size={14} className="text-amber-300 animate-pulse" />
              Gestion Système Affiliation Helpers
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight drop-shadow-sm">
              Programme Parrainage Helpers
            </h1>
            <p className="text-sm md:text-base text-amber-100 font-medium leading-relaxed">
              Supervisez les parrainages créés par les Helpers, gérez les commissions par lead livré et activez/désactivez l'accès individuel.
            </p>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="self-start md:self-auto flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-black text-xs uppercase tracking-widest transition-all border border-white/20 active:scale-95 shadow-lg"
          >
            <RefreshCw size={16} className={isRefetching ? 'animate-spin' : ''} />
            {isRefetching ? 'Actualisation...' : 'Actualiser'}
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl shadow-slate-100/50 hover:shadow-2xl transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
              <Users size={24} />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
              {activeAffiliateHelpers} / {totalHelpers} Actifs
            </span>
          </div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Total Helpers</p>
          <h3 className="text-3xl font-black text-slate-800 tracking-tight mt-1">{totalHelpers}</h3>
          <p className="text-[10px] font-bold text-slate-400 mt-2">
            {activeAffiliateHelpers} avec permission d'affiliation
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl shadow-slate-100/50 hover:shadow-2xl transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
              <UserCheck size={24} />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">
              Inscriptions
            </span>
          </div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Utilisateurs Invités</p>
          <h3 className="text-3xl font-black text-slate-800 tracking-tight mt-1">{totalInvitedUsers}</h3>
          <p className="text-[10px] font-bold text-slate-400 mt-2">
            Comptes vendeurs & influenceurs référés
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl shadow-slate-100/50 hover:shadow-2xl transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
              <TrendingUp size={24} />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
              Succès
            </span>
          </div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Leads Livrés Référés</p>
          <h3 className="text-3xl font-black text-slate-800 tracking-tight mt-1">{totalDeliveredLeads}</h3>
          <p className="text-[10px] font-bold text-slate-400 mt-2">
            Commandes livrées par des invités
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl shadow-slate-100/50 hover:shadow-2xl transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 group-hover:scale-110 transition-transform">
              <DollarSign size={24} />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
              DH
            </span>
          </div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Commissions Calculées</p>
          <h3 className="text-3xl font-black text-slate-800 tracking-tight mt-1">
            {totalEarningsGenerated.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} <span className="text-sm font-bold text-rose-500">DH</span>
          </h3>
          <p className="text-[10px] font-bold text-slate-400 mt-2">
            Montants total dû aux Helpers
          </p>
        </div>
      </div>

      {/* Main Table Section */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <Award className="text-amber-500" size={22} />
              Liste des Helpers & Commissions
            </h2>
            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
              Configuration de la commission et des droits d'invitation
            </p>
          </div>

          <div className="relative max-w-md w-full">
            <input
              type="text"
              placeholder="Rechercher par nom, email, téléphone ou code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-xs font-bold text-slate-800 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all"
            />
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {/* Table Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Chargement des données Helpers...</p>
          </div>
        ) : filteredHelpers.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Users size={32} />
            </div>
            <h3 className="text-base font-black text-slate-700 uppercase tracking-wider">Aucun Helper trouvé</h3>
            <p className="text-xs font-bold text-slate-400 mt-1">
              {searchTerm ? 'Essayez de modifier votre terme de recherche' : 'Aucun utilisateur avec le rôle HELPER n\'a été créé.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="py-4 px-6">Helper</th>
                  <th className="py-4 px-6">Code & Lien Referral</th>
                  <th className="py-4 px-6 text-center">Statut Affiliation</th>
                  <th className="py-4 px-6 text-center">Taux Commission</th>
                  <th className="py-4 px-6 text-center">Invités</th>
                  <th className="py-4 px-6 text-center">Leads Livrés</th>
                  <th className="py-4 px-6 text-right">Gains DH</th>
                  <th className="py-4 px-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                {filteredHelpers.map((h: any) => {
                  const regLink = `${window.location.origin}/register?ref=${h.referralCode || h.id}`;

                  return (
                    <tr key={h.id} className="hover:bg-amber-50/20 transition-colors group">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-amber-100/80 text-amber-700 flex items-center justify-center font-black text-sm uppercase">
                            {h.fullName?.charAt(0) || 'H'}
                          </div>
                          <div>
                            <p className="font-black text-slate-800 tracking-tight text-sm">{h.fullName}</p>
                            <p className="text-[10px] font-bold text-slate-400">{h.email} • {h.phone || 'Sans tel'}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          <span className="inline-block px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-mono text-[10px] font-black">
                            ref={h.referralCode || h.id}
                          </span>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(regLink);
                                toast.success('Lien copié dans le presse-papier !');
                              }}
                              className="hover:text-amber-600 flex items-center gap-1 font-bold transition-colors"
                              title="Copier le lien"
                            >
                              <Copy size={12} /> Copier
                            </button>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => handleTogglePermission(h)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                            h.canManageAffiliateInvites
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          {h.canManageAffiliateInvites ? (
                            <>
                              <CheckCircle2 size={14} className="text-emerald-600" /> Autorisé
                            </>
                          ) : (
                            <>
                              <XCircle size={14} className="text-rose-600" /> Désactivé
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-4 px-6 text-center">
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-2xl bg-amber-50 text-amber-800 border border-amber-200 font-black text-xs">
                          <Percent size={13} className="text-amber-600" />
                          {h.helperCommissionPerDeliveredLead} DH / lead
                        </span>
                      </td>

                      <td className="py-4 px-6 text-center font-black text-slate-800 text-sm">
                        {h.totalInvitedUsers}
                      </td>

                      <td className="py-4 px-6 text-center font-black text-emerald-700 text-sm">
                        {h.deliveredLeads} <span className="text-[10px] font-bold text-slate-400">/ {h.totalLeads} total</span>
                      </td>

                      <td className="py-4 px-6 text-right font-black text-slate-900 text-sm">
                        {h.totalEarnings?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} <span className="text-[10px] text-slate-400">DH</span>
                      </td>

                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => {
                            setEditingHelper(h);
                            setNewCommission(h.helperCommissionPerDeliveredLead || 5);
                            setNewPermission(!!h.canManageAffiliateInvites);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-amber-500 hover:text-white text-slate-600 text-[10px] font-black uppercase tracking-wider transition-all inline-flex items-center gap-1.5"
                        >
                          <Edit3 size={13} /> Configurer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingHelper && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md cursor-pointer"
            onClick={() => setEditingHelper(null)}
          />
          <div className="relative z-10 bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl border border-white/20 cursor-default animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                  <Award size={22} className="text-amber-600" />
                  Configuration Affiliation Helper
                </h3>
                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
                  Helper: <span className="text-amber-600">{editingHelper.fullName}</span>
                </p>
              </div>
              <button
                onClick={() => setEditingHelper(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-white transition-all"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCommission} className="p-8 space-y-6">
              {/* Toggle Permission */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">Accès Programme Affiliation</h4>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">Autoriser la génération de liens et l'invitation d'utilisateurs</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewPermission(!newPermission)}
                  className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 relative ${
                    newPermission ? 'bg-amber-500' : 'bg-slate-300'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 ${
                    newPermission ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Commission Rate Input */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Percent size={14} className="text-amber-600" />
                  Montant Commission par Lead Livré (DH)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    value={newCommission}
                    onChange={(e) => setNewCommission(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-black text-slate-800 outline-none focus:border-amber-500 focus:bg-white transition-all"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-xs text-slate-400 uppercase">
                    DH / Lead
                  </span>
                </div>
                <p className="text-[10px] font-medium text-slate-400 mt-2">
                  Ce montant sera multiplié par le nombre de leads livrés par les utilisateurs parrainés par ce Helper.
                </p>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 flex gap-4">
                <button
                  type="button"
                  onClick={() => setEditingHelper(null)}
                  className="flex-1 py-3.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 bg-slate-50 rounded-2xl transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={updateConfigMutation.isPending}
                  className="flex-[2] py-3.5 text-xs font-black uppercase tracking-widest text-white bg-amber-500 hover:bg-amber-600 rounded-2xl shadow-xl shadow-amber-500/20 transition-all"
                >
                  {updateConfigMutation.isPending ? 'Sauvegarde...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

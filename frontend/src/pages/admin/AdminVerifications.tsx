import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { 
  ShieldCheck, 
  Mail, 
  CreditCard, 
  ExternalLink,
  CheckCircle2,
  XCircle,
  Eye,
  Search,
  Users,
  Phone,
  MapPin,
  FileText,
  ChevronDown,
  ChevronUp,
  Clock,
  Building2,
  Hash,
  AlertCircle,
  Landmark
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AdminVerifications() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'PENDING' | 'ALL'>('PENDING');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-verifications', activeTab],
    queryFn: () => adminApi.getVerifications(activeTab === 'PENDING' ? 'pending' : 'all'),
  });

  const verifications = data?.data?.data || [];

  const verifyEmailMutation = useMutation({
    mutationFn: (uuid: string) => adminApi.verifyEmail(uuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-verifications'] });
      toast.success('E-mail vérifié avec succès');
    },
    onError: () => toast.error('Erreur lors de la vérification'),
  });

  const verifyKycMutation = useMutation({
    mutationFn: ({ uuid, status }: { uuid: string; status: 'APPROVED' | 'REJECTED' }) => 
      adminApi.verifyKyc(uuid, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-verifications'] });
      toast.success('Statut KYC mis à jour');
    },
    onError: () => toast.error('Erreur lors de la mise à jour KYC'),
  });

  const verifyBankMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'APPROVED' | 'REJECTED' }) => 
      adminApi.verifyBank(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-verifications'] });
      toast.success('Statut du compte bancaire mis à jour');
    },
    onError: () => toast.error('Erreur lors de la mise à jour bancaire'),
  });

  const filteredVerifications = verifications.filter((user: any) => {
    if (!searchQuery) return true;
    return (
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.profile?.fullName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'REJECTED': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'PENDING': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'UNDER_REVIEW': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'Approuvé';
      case 'REJECTED': return 'Rejeté';
      case 'PENDING': return 'En attente';
      case 'UNDER_REVIEW': return 'En cours';
      default: return status;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Chargement des vérifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* Header */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-[#2c2f74] p-10 text-white shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-4xl font-black tracking-tight flex items-center gap-4">
              Centre de Vérification <ShieldCheck className="text-primary-400" size={36} />
            </h2>
            <p className="text-primary-100/70 font-medium text-lg max-w-xl">
              Gérez les étapes de validation pour vos utilisateurs et sécurisez votre plateforme.
            </p>
          </div>
          
          <div className="flex bg-white/10 p-1.5 rounded-2xl backdrop-blur-md border border-white/10">
            <button
              onClick={() => setActiveTab('PENDING')}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === 'PENDING' ? 'bg-white text-[#2c2f74] shadow-lg' : 'text-white hover:bg-white/10'
              }`}
            >
              En attente
            </button>
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === 'ALL' ? 'bg-white text-[#2c2f74] shadow-lg' : 'text-white hover:bg-white/10'
              }`}
            >
              Tous
            </button>
          </div>
        </div>
        
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-400/10 rounded-full blur-3xl -mr-20 -mt-20" />
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
          <input
            type="text"
            placeholder="Rechercher par nom, email ou téléphone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-3xl bg-white border border-slate-200 outline-none focus:ring-4 focus:ring-primary-50 focus:border-primary-400 transition-all font-medium text-slate-800"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <div className="px-5 py-3 rounded-2xl bg-white border border-slate-200 flex items-center gap-3 shadow-sm">
            <Users size={18} className="text-slate-400" />
            <span className="text-sm font-black text-slate-700 uppercase tracking-widest">{filteredVerifications.length} Résultats</span>
          </div>
        </div>
      </div>

      {/* User Cards */}
      <div className="space-y-6">
        {filteredVerifications.map((user: any) => {
          const isExpanded = expandedUser === user.uuid;
          const hasPendingBank = user.bankAccounts?.some((ba: any) => ba.status === 'PENDING');
          const hasApprovedBank = user.bankAccounts?.some((ba: any) => ba.status === 'APPROVED');
          
          return (
            <div key={user.uuid} className="bento-card bg-white overflow-hidden border border-slate-100 hover:border-primary-100 transition-all duration-500 hover:shadow-2xl">
              {/* Main Row */}
              <div className="p-8">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* User Info */}
                  <div className="flex items-center gap-5 min-w-0">
                    <div className="w-16 h-16 bg-gradient-to-tr from-primary-600 to-indigo-400 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-primary-200/50 flex-shrink-0">
                      {user.profile?.fullName?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-black text-slate-800 text-xl truncate">{user.profile?.fullName || 'Utilisateur'}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest border border-slate-200">{user.role?.name}</span>
                        {user.email && (
                          <span className="text-xs font-medium text-slate-400 flex items-center gap-1 truncate">
                            <Mail size={12} /> {user.email}
                          </span>
                        )}
                        {user.phone && (
                          <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                            <Phone size={12} /> {user.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Verification Status Badges */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Email */}
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-xs font-black uppercase tracking-widest ${
                      user.emailVerifiedAt ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'
                    }`}>
                      <Mail size={14} />
                      {user.emailVerifiedAt ? 'Email ✓' : 'Email ✗'}
                    </div>
                    {/* KYC */}
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-xs font-black uppercase tracking-widest ${getStatusColor(user.kycStatus)}`}>
                      <ShieldCheck size={14} />
                      KYC: {getStatusLabel(user.kycStatus)}
                    </div>
                    {/* Bank */}
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-xs font-black uppercase tracking-widest ${
                      hasApprovedBank ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                      : hasPendingBank ? 'bg-amber-50 text-amber-600 border-amber-200'
                      : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}>
                      <CreditCard size={14} />
                      {hasApprovedBank ? 'Banque ✓' : hasPendingBank ? 'Banque ⏳' : 'Pas de RIB'}
                    </div>

                    {/* Expand Button */}
                    <button
                      onClick={() => setExpandedUser(isExpanded ? null : user.uuid)}
                      className="p-3 rounded-2xl bg-slate-100 hover:bg-primary-50 text-slate-400 hover:text-primary-600 transition-all active:scale-95"
                    >
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Detail Panel */}
              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50/30 animate-in slide-in-from-top-2 fade-in duration-300">
                  <div className="p-8 space-y-8">
                    {/* Info Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-2">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Clock size={14} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Inscrit le</span>
                        </div>
                        <p className="text-sm font-bold text-slate-800">
                          {format(new Date(user.createdAt), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
                        </p>
                      </div>
                      <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-2">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Mail size={14} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Email</span>
                        </div>
                        <p className="text-sm font-bold text-slate-800 break-all">{user.email || '—'}</p>
                      </div>
                      <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-2">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Phone size={14} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Téléphone</span>
                        </div>
                        <p className="text-sm font-bold text-slate-800">{user.phone || '—'}</p>
                      </div>
                      <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-2">
                        <div className="flex items-center gap-2 text-slate-400">
                          <MapPin size={14} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Ville</span>
                        </div>
                        <p className="text-sm font-bold text-slate-800">{user.profile?.city || user.detectedCity || '—'}</p>
                      </div>
                    </div>

                    {/* Action Sections */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      
                      {/* Email Verification */}
                      <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${user.emailVerifiedAt ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                              <Mail size={18} />
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">Vérification Email</h4>
                              <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                                {user.emailVerifiedAt 
                                  ? `Vérifié le ${format(new Date(user.emailVerifiedAt), 'dd/MM/yyyy', { locale: fr })}`
                                  : 'Non vérifié'
                                }
                              </p>
                            </div>
                          </div>
                        </div>
                        {user.emailVerifiedAt ? (
                          <div className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                            <CheckCircle2 size={16} className="text-emerald-600" />
                            <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">Vérifié</span>
                          </div>
                        ) : (
                          <button 
                            onClick={() => verifyEmailMutation.mutate(user.uuid)}
                            disabled={verifyEmailMutation.isPending}
                            className="w-full py-3 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-200 active:scale-95 disabled:opacity-50"
                          >
                            {verifyEmailMutation.isPending ? 'Vérification...' : 'Vérifier manuellement'}
                          </button>
                        )}
                      </div>

                      {/* KYC Verification */}
                      <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl ${user.kycStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                            <ShieldCheck size={18} />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">Vérification KYC</h4>
                            <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                              Statut: <span className={`font-bold ${user.kycStatus === 'APPROVED' ? 'text-emerald-600' : 'text-amber-600'}`}>{getStatusLabel(user.kycStatus)}</span>
                            </p>
                          </div>
                        </div>
                        
                        {/* KYC Documents */}
                        {user.kycDocuments?.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Documents soumis</p>
                            {user.kycDocuments.map((doc: any) => (
                              <a
                                key={doc.id}
                                href={doc.documentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-primary-50 hover:border-primary-200 transition-all group"
                              >
                                <div className="flex items-center gap-2">
                                  <FileText size={14} className="text-slate-400 group-hover:text-primary-500" />
                                  <span className="text-xs font-bold text-slate-600 group-hover:text-primary-700">{doc.documentType}</span>
                                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${getStatusColor(doc.status)}`}>{getStatusLabel(doc.status)}</span>
                                </div>
                                <Eye size={14} className="text-slate-300 group-hover:text-primary-500" />
                              </a>
                            ))}
                          </div>
                        )}

                        {user.kycDocuments?.length === 0 && (
                          <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                            <AlertCircle size={14} className="text-slate-400" />
                            <span className="text-xs font-medium text-slate-400">Aucun document soumis</span>
                          </div>
                        )}

                        {user.kycStatus !== 'APPROVED' && (
                          <div className="flex gap-3">
                            <button 
                              onClick={() => verifyKycMutation.mutate({ uuid: user.uuid, status: 'APPROVED' })}
                              disabled={verifyKycMutation.isPending}
                              className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-200 active:scale-95 disabled:opacity-50"
                            >
                              Approuver
                            </button>
                            <button 
                              onClick={() => verifyKycMutation.mutate({ uuid: user.uuid, status: 'REJECTED' })}
                              disabled={verifyKycMutation.isPending}
                              className="flex-1 py-3 bg-slate-200 hover:bg-rose-500 hover:text-white text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                            >
                              Rejeter
                            </button>
                          </div>
                        )}
                        {user.kycStatus === 'APPROVED' && (
                          <div className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                            <CheckCircle2 size={16} className="text-emerald-600" />
                            <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">Approuvé</span>
                          </div>
                        )}
                      </div>

                      {/* Bank Account Verification */}
                      <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl ${hasApprovedBank ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                            <Landmark size={18} />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">Comptes Bancaires</h4>
                            <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                              {user.bankAccounts?.length || 0} compte(s) enregistré(s)
                            </p>
                          </div>
                        </div>

                        {user.bankAccounts?.length > 0 ? (
                          <div className="space-y-3">
                            {user.bankAccounts.map((ba: any) => (
                              <div key={ba.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Building2 size={14} className="text-slate-400" />
                                    <span className="text-sm font-black text-slate-800">{ba.bankName}</span>
                                  </div>
                                  <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${getStatusColor(ba.status)}`}>
                                    {getStatusLabel(ba.status)}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                  <div className="flex items-center gap-2">
                                    <Hash size={12} className="text-slate-300" />
                                    <span className="text-[11px] font-medium text-slate-500">RIB:</span>
                                    <span className="text-[11px] font-bold text-slate-700 font-mono">{ba.ribAccount}</span>
                                  </div>
                                  {ba.iceNumber && (
                                    <div className="flex items-center gap-2">
                                      <Hash size={12} className="text-slate-300" />
                                      <span className="text-[11px] font-medium text-slate-500">ICE:</span>
                                      <span className="text-[11px] font-bold text-slate-700 font-mono">{ba.iceNumber}</span>
                                    </div>
                                  )}
                                </div>
                                {ba.status === 'PENDING' && (
                                  <div className="flex gap-2 pt-1">
                                    <button
                                      onClick={() => verifyBankMutation.mutate({ id: ba.id, status: 'APPROVED' })}
                                      disabled={verifyBankMutation.isPending}
                                      className="flex-1 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 disabled:opacity-50"
                                    >
                                      Valider
                                    </button>
                                    <button
                                      onClick={() => verifyBankMutation.mutate({ id: ba.id, status: 'REJECTED' })}
                                      disabled={verifyBankMutation.isPending}
                                      className="p-2.5 bg-slate-200 hover:bg-rose-500 hover:text-white text-slate-500 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                                    >
                                      <XCircle size={16} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                            <AlertCircle size={14} className="text-slate-400" />
                            <span className="text-xs font-medium text-slate-400">Aucun compte bancaire enregistré</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Extra Info Row */}
                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-slate-100 text-xs font-medium text-slate-500">
                        <span className="font-black text-slate-400">UUID:</span>
                        <code className="text-[11px] font-mono text-slate-600">{user.uuid}</code>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-slate-100 text-xs font-medium text-slate-500">
                        <span className="font-black text-slate-400">ID:</span>
                        <code className="text-[11px] font-mono text-slate-600">{user.id}</code>
                      </div>
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-xs font-black uppercase tracking-widest ${user.isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                        {user.isActive ? 'Actif' : 'Inactif'}
                      </div>
                      {user.contractAccepted && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-blue-50 border border-blue-200 text-xs font-black uppercase tracking-widest text-blue-600">
                          Contrat signé
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredVerifications.length === 0 && (
          <div className="py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-6">
              <ShieldCheck size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-800">Aucune vérification en attente</h3>
            <p className="text-slate-400 font-medium max-w-sm mt-2">Tous vos utilisateurs sont actuellement en règle ou aucun ne correspond à votre recherche.</p>
          </div>
        )}
      </div>
    </div>
  );
}

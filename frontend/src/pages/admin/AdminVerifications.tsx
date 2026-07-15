import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, BACKEND_URL } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
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
  Landmark,
  Shield,
  Sparkles,
  X,
  ZoomIn,
  Globe,
  Navigation,
  RefreshCw
} from 'lucide-react';
import { FaInstagram, FaTiktok, FaFacebook, FaYoutube, FaSnapchat } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function parseSocialInput(val: string, platform: 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'x' | 'snapchat') {
  if (!val) return { username: '', url: '' };
  
  const trimmed = val.trim();
  
  // If it's already a full URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    let url = trimmed;
    let username = trimmed;
    try {
      const urlObj = new URL(trimmed);
      let path = urlObj.pathname;
      if (path.startsWith('/')) path = path.slice(1);
      if (path.endsWith('/')) path = path.slice(0, -1);
      if (path.startsWith('@')) path = path.slice(1);
      
      const segments = path.split('/');
      if (segments[0]) {
        username = segments[0];
      }
    } catch (e) {
      const parts = trimmed.split('/');
      const lastPart = parts[parts.length - 1] || parts[parts.length - 2];
      if (lastPart) {
        username = lastPart.split('?')[0].replace('@', '');
      }
    }
    
    return { username, url };
  }
  
  const cleanUsername = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  
  let baseUrl = '';
  switch (platform) {
    case 'instagram': baseUrl = 'https://instagram.com/'; break;
    case 'tiktok': baseUrl = 'https://tiktok.com/@'; break;
    case 'facebook': baseUrl = 'https://facebook.com/'; break;
    case 'youtube': baseUrl = 'https://youtube.com/@'; break;
    case 'x': baseUrl = 'https://x.com/'; break;
    case 'snapchat': baseUrl = 'https://snapchat.com/add/'; break;
  }
  
  return {
    username: cleanUsername,
    url: `${baseUrl}${cleanUsername}`
  };
}

export function resolveSocialPlatform(
  usernameVal: string | null | undefined,
  metadataUrlVal: string | null | undefined,
  platform: 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'x' | 'snapchat'
) {
  if (!usernameVal && !metadataUrlVal) return null;
  
  let parsedFromUsername = parseSocialInput(usernameVal || '', platform);
  let parsedFromMeta = parseSocialInput(metadataUrlVal || '', platform);
  
  let username = parsedFromUsername.username || parsedFromMeta.username || '';
  let url = parsedFromMeta.url || parsedFromUsername.url || '';
  
  let hasBoth = !!(usernameVal && metadataUrlVal && usernameVal !== metadataUrlVal);
  
  return {
    username,
    url,
    originalUsername: usernameVal || '',
    originalUrl: metadataUrlVal || '',
    hasBoth
  };
}

export default function AdminVerifications() {
  const queryClient = useQueryClient();
  const { platformSettings } = useAuth();
  const showIdentity = platformSettings?.showIdentityVerification !== false;
  const showBank = platformSettings?.showBankVerification !== false;
  const showContract = platformSettings?.showContractVerification !== false;
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'PENDING_EMAIL' | 'PENDING_KYC' | 'PENDING_BANK' | 'PENDING_CONTRACT'>('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'VENDOR' | 'INFLUENCER'>('ALL');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [imageModal, setImageModal] = useState<{ url: string; title: string } | null>(null);
  const [editingSubdomainUuid, setEditingSubdomainUuid] = useState<string | null>(null);
  const [subdomainInput, setSubdomainInput] = useState('');

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, activeTab, roleFilter]);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-verifications', activeTab, roleFilter, searchQuery, page, limit],
    queryFn: () => adminApi.getVerifications({
      filter: activeTab === 'ALL' ? 'all' : activeTab,
      role: roleFilter,
      search: searchQuery,
      page,
      limit
    }),
  });

  const verifications = data?.data?.data || [];
  const meta = data?.data?.meta || { total: 0, page: 1, limit: 10, totalPages: 1, stats: { total: 0, pending: 0, pendingEmail: 0, pendingKyc: 0, pendingBank: 0, pendingContract: 0 } };

  const verifyEmailMutation = useMutation({
    mutationFn: ({ uuid, verified }: { uuid: string; verified?: boolean }) => adminApi.verifyEmail(uuid, verified),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-verifications'] });
      toast.success(variables.verified === false ? 'Vérification e-mail annulée' : 'E-mail vérifié avec succès');
    },
    onError: () => toast.error('Erreur lors de la mise à jour de l\'e-mail'),
  });

  const verifyContractMutation = useMutation({
    mutationFn: ({ uuid, accepted }: { uuid: string; accepted?: boolean }) => adminApi.verifyContract(uuid, accepted),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-verifications'] });
      toast.success(variables.accepted === false ? 'Signature du contrat réinitialisée' : 'Contrat validé et signé manuellement');
    },
    onError: () => toast.error('Erreur lors de la validation du contrat'),
  });

  const verifyKycMutation = useMutation({
    mutationFn: ({ uuid, status }: { uuid: string; status: 'APPROVED' | 'REJECTED' | 'PENDING' }) => 
      adminApi.verifyKyc(uuid, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-verifications'] });
      toast.success('Statut KYC mis à jour');
    },
    onError: () => toast.error('Erreur lors de la mise à jour KYC'),
  });

  const verifyBankMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'APPROVED' | 'REJECTED' | 'PENDING' }) => 
      adminApi.verifyBank(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-verifications'] });
      toast.success('Statut du compte bancaire mis à jour');
    },
    onError: () => toast.error('Erreur lors de la mise à jour bancaire'),
  });

  const verifyBankManuallyMutation = useMutation({
    mutationFn: ({ uuid, approved }: { uuid: string; approved?: boolean }) => 
      adminApi.verifyBankManually(uuid, approved),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-verifications'] });
      toast.success(variables.approved === false ? 'Vérification bancaire annulée' : 'Compte bancaire validé manuellement');
    },
    onError: () => toast.error('Erreur lors de la validation du compte bancaire'),
  });

  const verifyUserMutation = useMutation({
    mutationFn: ({ uuid, isActive }: { uuid: string; isActive: boolean }) => 
      adminApi.verifyUser(uuid, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-verifications'] });
      toast.success('Statut utilisateur mis à jour');
    },
    onError: () => toast.error('Erreur lors de la mise à jour du statut utilisateur'),
  });

  const updateSubdomainMutation = useMutation({
    mutationFn: ({ uuid, subdomain }: { uuid: string; subdomain: string }) =>
      adminApi.updateUserSubdomain(uuid, subdomain),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-verifications'] });
      toast.success('Sous-domaine mis à jour avec succès');
      setEditingSubdomainUuid(null);
      setSubdomainInput('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Erreur lors de la mise à jour du sous-domaine'),
  });

  const clearSubdomainMutation = useMutation({
    mutationFn: (uuid: string) => adminApi.clearUserSubdomain(uuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-verifications'] });
      toast.success('Sous-domaine supprimé avec succès');
    },
    onError: () => toast.error('Erreur lors de la suppression du sous-domaine'),
  });

  const stats = meta.stats || { total: 0, pending: 0, pendingEmail: 0, pendingKyc: 0, pendingBank: 0, pendingContract: 0 };

  const handleExportCSV = () => {
    const headers = ['Nom Complet', 'Role', 'E-mail', 'Telephone', 'Verif. Email', 'Verif. KYC', 'Verif. Banque', 'Contrat Signe', 'Compte Actif', 'Date Inscription'];
    const rows = verifications.map((u: any) => [
      u.profile?.fullName || '—',
      u.role?.name || '—',
      u.email || '—',
      u.phone || '—',
      u.emailVerifiedAt ? 'Verifie' : 'Non verifie',
      u.kycStatus,
      u.bankAccounts?.some((ba: any) => ba.status === 'APPROVED') ? 'Approuve' : (u.bankAccounts?.some((ba: any) => ba.status === 'PENDING') ? 'En attente' : 'Aucun'),
      u.contractAccepted ? 'Signe' : 'Non signe',
      u.isActive ? 'Actif' : 'Inactif',
      u.createdAt ? format(new Date(u.createdAt), 'dd/MM/yyyy') : '—'
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map((e: string[]) => e.map((val: string) => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `verifications_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Fichier CSV téléchargé avec succès');
  };

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
      {/* Image Modal */}
      {imageModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setImageModal(null)}>
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setImageModal(null)}
              className="absolute -top-4 -right-4 z-10 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-2xl hover:bg-rose-50 transition-colors"
            >
              <X size={20} className="text-slate-700" />
            </button>
            <div className="bg-white rounded-3xl p-3 shadow-2xl">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest px-3 pb-2">{imageModal.title}</p>
              <img
                src={imageModal.url}
                alt={imageModal.title}
                className="max-w-[85vw] max-h-[80vh] object-contain rounded-2xl"
              />
            </div>
          </div>
        </div>
      )}
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
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-400/10 rounded-full blur-3xl -mr-20 -mt-20" />
      </div>

      {/* Stats Dashboard & Tab Filters */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { key: 'ALL', label: 'Tous', count: stats.total, color: 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100', icon: Users },
          { key: 'PENDING', label: 'À Traiter', count: stats.pending, color: 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100/70', icon: Shield },
          { key: 'PENDING_EMAIL', label: 'Emails', count: stats.pendingEmail, color: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100/70', icon: Mail },
          ...(showIdentity ? [{ key: 'PENDING_KYC', label: 'KYC', count: stats.pendingKyc, color: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100/70', icon: ShieldCheck }] : []),
          ...(showBank ? [{ key: 'PENDING_BANK', label: 'RIB Banque', count: stats.pendingBank, color: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100/70', icon: Landmark }] : []),
          ...(showContract ? [{ key: 'PENDING_CONTRACT', label: 'Contrats', count: stats.pendingContract, color: 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100/70', icon: FileText }] : []),
        ].map((item) => {
          const Icon = item.icon;
          const isSelected = activeTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key as any)}
              className={`flex flex-col items-center justify-center p-4 rounded-3xl border transition-all hover:scale-[1.02] text-center shadow-sm ${item.color} ${
                isSelected ? 'ring-4 ring-[#2c2f74]/20 border-[#2c2f74] font-extrabold shadow-md bg-white' : 'font-semibold'
              }`}
            >
              <div className="p-2 rounded-xl bg-white border border-slate-100 shadow-sm mb-2">
                <Icon size={16} />
              </div>
              <span className="text-[10px] uppercase tracking-wider block opacity-80">{item.label}</span>
              <span className="text-xl font-black mt-1">{item.count}</span>
            </button>
          );
        })}
      </div>

      {/* Filters & Search Row */}
      <div className="flex flex-col xl:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto items-center">
          <div className="relative w-full sm:w-80 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Rechercher par nom, email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white border border-slate-200 outline-none focus:ring-4 focus:ring-primary-50 focus:border-[#2c2f74] transition-all font-medium text-slate-800 text-sm"
            />
          </div>

          {/* Role Filter */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/50 w-full sm:w-auto justify-around">
            {[
              { key: 'ALL', label: 'Tous' },
              { key: 'VENDOR', label: 'Sellers' },
              { key: 'INFLUENCER', label: 'Influencers' },
            ].map((role) => (
              <button
                key={role.key}
                onClick={() => setRoleFilter(role.key as any)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                  roleFilter === role.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full xl:w-auto justify-end">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-5 py-3.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-sm active:scale-95"
          >
            <Globe size={14} className="text-slate-400" />
            Exporter CSV
          </button>
          <div className="px-5 py-3.5 rounded-2xl bg-slate-900 text-white flex items-center gap-3 shadow-md">
            <Users size={16} className="text-slate-400" />
            <span className="text-xs font-black uppercase tracking-widest">{meta.total} Résultats</span>
          </div>
        </div>
      </div>

      {/* User Cards */}
      <div className="space-y-6">
        {verifications.map((user: any) => {
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
                    {showIdentity && (
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-xs font-black uppercase tracking-widest ${getStatusColor(user.kycStatus)}`}>
                      <ShieldCheck size={14} />
                      KYC: {getStatusLabel(user.kycStatus)}
                    </div>
                    )}
                    {/* Bank */}
                    {showBank && (
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-xs font-black uppercase tracking-widest ${
                      hasApprovedBank ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                      : hasPendingBank ? 'bg-amber-50 text-amber-600 border-amber-200'
                      : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}>
                      <CreditCard size={14} />
                      {hasApprovedBank ? 'Banque ✓' : hasPendingBank ? 'Banque ⏳' : 'Pas de RIB'}
                    </div>
                    )}
                    {/* Subdomain */}
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-xs font-black uppercase tracking-widest ${
                      user.subdomain ? 'bg-primary-50 text-primary-600 border-primary-200' : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}>
                      <Globe size={14} />
                      {user.subdomain ? `${user.subdomain}` : 'Pas de domaine'}
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
                    {/* Progress Checklist/Timeline */}
                    <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-4">
                      <div className="flex items-center gap-2 text-slate-400">
                        <ShieldCheck size={14} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Séquence de Vérification</span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {[
                          { label: 'Compte Créé', desc: format(new Date(user.createdAt), 'dd/MM/yyyy'), done: true, pending: false },
                          { label: 'Email Vérifié', desc: user.emailVerifiedAt ? format(new Date(user.emailVerifiedAt), 'dd/MM/yyyy') : 'En attente', done: !!user.emailVerifiedAt, pending: !user.emailVerifiedAt },
                          ...(showIdentity ? [{ label: 'KYC Approuvé', desc: user.kycStatus === 'APPROVED' ? 'Approuvé' : (user.kycStatus === 'UNDER_REVIEW' ? 'En cours de revue' : 'Non approuvé'), done: user.kycStatus === 'APPROVED', pending: ['PENDING', 'UNDER_REVIEW'].includes(user.kycStatus) }] : []),
                          ...(showBank ? [{ label: 'Banque Approuvée', desc: hasApprovedBank ? 'RIB Validé' : (hasPendingBank ? 'RIB En attente' : 'Non configuré'), done: hasApprovedBank, pending: hasPendingBank }] : []),
                          ...(showContract ? [{ label: 'Contrat Signé', desc: user.contractAccepted ? 'Signé ✓' : 'En attente', done: user.contractAccepted, pending: !user.contractAccepted && hasApprovedBank && user.kycStatus === 'APPROVED' }] : []),
                        ].map((step, idx) => {
                          return (
                            <div key={idx} className={`flex flex-col p-4 rounded-2xl border transition-all ${
                              step.done ? 'bg-emerald-50/40 border-emerald-100 text-emerald-800' 
                              : step.pending ? 'bg-amber-50/40 border-amber-100 text-amber-800' 
                              : 'bg-slate-50 border-slate-100 text-slate-400'
                            }`}>
                              <span className="text-[9px] uppercase font-black tracking-widest opacity-60">Étape {idx + 1}</span>
                              <span className="text-xs font-black mt-1">{step.label}</span>
                              <span className="text-[10px] font-semibold mt-0.5">{step.desc}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

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
                          <span className="text-[10px] font-black uppercase tracking-widest">Ville & Adresse</span>
                        </div>
                        {user.detectedCity && (
                          <div className="flex items-center gap-1.5">
                            <Navigation size={11} className="text-blue-400" />
                            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">IP:</span>
                            <span className="text-sm font-bold text-slate-800">{user.detectedCity}</span>
                          </div>
                        )}
                        {user.profile?.city && (
                          <div className="flex items-center gap-1.5">
                            <MapPin size={11} className="text-emerald-400" />
                            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Déclaré:</span>
                            <span className="text-sm font-bold text-slate-800">{user.profile.city}</span>
                          </div>
                        )}
                        {user.profile?.address && <p className="text-[10px] font-medium text-slate-400 mt-1">{user.profile.address}</p>}
                        {!user.detectedCity && !user.profile?.city && <p className="text-sm font-bold text-slate-300">—</p>}
                      </div>
                    </div>

                    {/* Social Media Accounts */}
                    {(user.profile?.instagramUsername || user.profile?.tiktokUsername || user.profile?.facebookUsername || user.profile?.youtubeUsername || user.profile?.xUsername || user.profile?.snapchatUsername || user.profile?.metadata) && (() => {
                      const meta = user.profile?.metadata || {};
                      
                      const instagram = resolveSocialPlatform(user.profile?.instagramUsername, meta.instagramUrl, 'instagram');
                      const tiktok = resolveSocialPlatform(user.profile?.tiktokUsername, meta.tiktokUrl, 'tiktok');
                      const facebook = resolveSocialPlatform(user.profile?.facebookUsername, meta.facebookUrl, 'facebook');
                      const youtube = resolveSocialPlatform(user.profile?.youtubeUsername, meta.youtubeUrl, 'youtube');
                      const x = resolveSocialPlatform(user.profile?.xUsername, meta.xUrl, 'x');
                      const snapchat = resolveSocialPlatform(user.profile?.snapchatUsername, meta.snapchatUrl, 'snapchat');
                      
                      if (!instagram && !tiktok && !facebook && !youtube && !x && !snapchat) return null;
                      
                      return (
                        <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-4">
                          <div className="flex items-center gap-2 text-slate-400">
                            <Globe size={14} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Réseaux Sociaux</span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Instagram */}
                            {instagram && (
                              <div className="flex flex-col gap-2 p-3 bg-gradient-to-r from-pink-50/30 to-purple-50/20 border border-pink-100/50 rounded-2xl">
                                <div className="flex items-center justify-between">
                                  <a href={instagram.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-pink-700 hover:text-pink-900 transition-all font-bold text-xs group">
                                    <FaInstagram className="text-pink-500" size={16} />
                                    <span>@{instagram.username}</span>
                                    <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </a>
                                  {user.profile?.instagramFollowers && (
                                    <span className="text-[9px] font-black text-pink-500 bg-pink-100/50 px-2 py-0.5 rounded-full">
                                      {user.profile.instagramFollowers?.toLocaleString()} abonnés
                                    </span>
                                  )}
                                </div>
                                {instagram.hasBoth && (
                                  <div className="text-[9px] font-bold text-slate-400 break-all select-all flex items-center gap-1 bg-white/60 p-1.5 rounded-lg border border-pink-50">
                                    <span className="text-pink-400">Lien:</span> {instagram.originalUrl}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* TikTok */}
                            {tiktok && (
                              <div className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200/50 rounded-2xl">
                                <div className="flex items-center justify-between">
                                  <a href={tiktok.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-slate-700 hover:text-slate-900 transition-all font-bold text-xs group">
                                    <FaTiktok className="text-slate-800" size={14} />
                                    <span>@{tiktok.username}</span>
                                    <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </a>
                                </div>
                                {tiktok.hasBoth && (
                                  <div className="text-[9px] font-bold text-slate-400 break-all select-all flex items-center gap-1 bg-white/60 p-1.5 rounded-lg border border-slate-100">
                                    <span className="text-slate-500">Lien:</span> {tiktok.originalUrl}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Facebook */}
                            {facebook && (
                              <div className="flex flex-col gap-2 p-3 bg-blue-50/30 border border-blue-100/50 rounded-2xl">
                                <div className="flex items-center justify-between">
                                  <a href={facebook.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-700 hover:text-blue-900 transition-all font-bold text-xs group">
                                    <FaFacebook className="text-blue-600" size={15} />
                                    <span>{facebook.username}</span>
                                    <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </a>
                                </div>
                                {facebook.hasBoth && (
                                  <div className="text-[9px] font-bold text-slate-400 break-all select-all flex items-center gap-1 bg-white/60 p-1.5 rounded-lg border border-blue-100">
                                    <span className="text-blue-500">Lien:</span> {facebook.originalUrl}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* YouTube */}
                            {youtube && (
                              <div className="flex flex-col gap-2 p-3 bg-red-50/30 border border-red-100/50 rounded-2xl">
                                <div className="flex items-center justify-between">
                                  <a href={youtube.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-red-700 hover:text-red-900 transition-all font-bold text-xs group">
                                    <FaYoutube className="text-red-600" size={16} />
                                    <span>@{youtube.username}</span>
                                    <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </a>
                                </div>
                                {youtube.hasBoth && (
                                  <div className="text-[9px] font-bold text-slate-400 break-all select-all flex items-center gap-1 bg-white/60 p-1.5 rounded-lg border border-red-100">
                                    <span className="text-red-500">Lien:</span> {youtube.originalUrl}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* X / Twitter */}
                            {x && (
                              <div className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200/50 rounded-2xl">
                                <div className="flex items-center justify-between">
                                  <a href={x.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-slate-700 hover:text-slate-900 transition-all font-bold text-xs group">
                                    <FaXTwitter className="text-slate-800" size={14} />
                                    <span>@{x.username}</span>
                                    <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </a>
                                </div>
                                {x.hasBoth && (
                                  <div className="text-[9px] font-bold text-slate-400 break-all select-all flex items-center gap-1 bg-white/60 p-1.5 rounded-lg border border-slate-100">
                                    <span className="text-slate-500">Lien:</span> {x.originalUrl}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Snapchat */}
                            {snapchat && (
                              <div className="flex flex-col gap-2 p-3 bg-yellow-50/30 border border-yellow-100/50 rounded-2xl">
                                <div className="flex items-center justify-between">
                                  <a href={snapchat.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-yellow-700 hover:text-yellow-900 transition-all font-bold text-xs group">
                                    <FaSnapchat className="text-yellow-500" size={15} />
                                    <span>@{snapchat.username}</span>
                                    <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </a>
                                </div>
                                {snapchat.hasBoth && (
                                  <div className="text-[9px] font-bold text-slate-400 break-all select-all flex items-center gap-1 bg-white/60 p-1.5 rounded-lg border border-yellow-100">
                                    <span className="text-yellow-500">Lien:</span> {snapchat.originalUrl}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Action Sections */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                      
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
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                              <CheckCircle2 size={16} className="text-emerald-600" />
                              <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">Vérifié</span>
                            </div>
                            <button
                              onClick={() => verifyEmailMutation.mutate({ uuid: user.uuid, verified: false })}
                              disabled={verifyEmailMutation.isPending}
                              className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 border border-rose-100 disabled:opacity-50"
                            >
                              Annuler / Réinitialiser
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => verifyEmailMutation.mutate({ uuid: user.uuid, verified: true })}
                            disabled={verifyEmailMutation.isPending}
                            className="w-full py-3 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-200 active:scale-95 disabled:opacity-50"
                          >
                            {verifyEmailMutation.isPending ? 'Vérification...' : 'Vérifier manuellement'}
                          </button>
                        )}
                      </div>

                      {/* KYC Verification */}
                      {showIdentity && (
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
                            {user.kycDocuments.map((doc: any) => {
                              const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(doc.documentUrl || '');
                              return (
                                <div key={doc.id} className="space-y-2">
                                  <button
                                    onClick={() => {
                                      if (isImage) {
                                        setImageModal({ url: doc.documentUrl, title: doc.documentType });
                                      } else {
                                        window.open(doc.documentUrl, '_blank');
                                      }
                                    }}
                                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-primary-50 hover:border-primary-200 transition-all group text-left"
                                  >
                                    <div className="flex items-center gap-2">
                                      <FileText size={14} className="text-slate-400 group-hover:text-primary-500" />
                                      <span className="text-xs font-bold text-slate-600 group-hover:text-primary-700">{doc.documentType}</span>
                                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${getStatusColor(doc.status)}`}>{getStatusLabel(doc.status)}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-slate-300 group-hover:text-primary-500">
                                      {isImage ? <ZoomIn size={14} /> : <ExternalLink size={14} />}
                                    </div>
                                  </button>
                                  {/* Thumbnail preview for images */}
                                  {isImage && (
                                    <button
                                      onClick={() => setImageModal({ url: doc.documentUrl, title: doc.documentType })}
                                      className="relative w-full h-32 rounded-2xl overflow-hidden border border-slate-100 hover:border-primary-300 transition-all group/img cursor-pointer"
                                    >
                                      <img src={doc.documentUrl} alt={doc.documentType} className="w-full h-full object-cover" />
                                      <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-all flex items-center justify-center">
                                        <ZoomIn size={24} className="text-white opacity-0 group-hover/img:opacity-100 transition-opacity" />
                                      </div>
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Identity Details Comparison */}
                        {user.profile?.cinNumber && (
                          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <Shield size={12} /> Informations Déclarées
                            </p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                              <div className="col-span-2">
                                <span className="block text-[9px] text-slate-400 uppercase font-black tracking-tighter">Nom Complet</span>
                                <span className="font-bold text-slate-700">{user.profile.fullName || '—'}</span>
                              </div>
                              <div>
                                <span className="block text-[9px] text-slate-400 uppercase font-black tracking-tighter">N° CIN</span>
                                <span className="font-bold text-slate-700">{user.profile.cinNumber}</span>
                              </div>
                              <div>
                                <span className="block text-[9px] text-slate-400 uppercase font-black tracking-tighter">Date Naissance</span>
                                <span className="font-bold text-slate-700">
                                  {user.profile.birthDate ? format(new Date(user.profile.birthDate), 'dd/MM/yyyy') : '—'}
                                </span>
                              </div>
                              <div className="col-span-2">
                                <span className="block text-[9px] text-slate-400 uppercase font-black tracking-tighter">Adresse Complète</span>
                                <span className="font-bold text-slate-700">{user.profile.address || '—'}, {user.profile.city || '—'}</span>
                              </div>
                            </div>
                            
                            {/* OCR Data if available */}
                            {user.kycDocuments?.find((d: any) => d.metadata)?.metadata && (
                              <div className="mt-2 pt-3 border-t border-slate-200">
                                <p className="text-[10px] font-black text-primary-500 uppercase tracking-widest flex items-center gap-1.5">
                                  <Sparkles size={12} className="animate-pulse" /> Extrait Automatiquement (OCR)
                                </p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] mt-2 bg-white/50 p-2 rounded-xl border border-primary-50">
                                  {user.kycDocuments.find((d: any) => d.metadata).metadata.cinNumber && (
                                    <div>
                                      <span className="block text-[9px] text-primary-400 uppercase font-black tracking-tighter">CIN OCR</span>
                                      <span className={`font-black ${user.kycDocuments.find((d: any) => d.metadata).metadata.cinNumber === user.profile.cinNumber ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {user.kycDocuments.find((d: any) => d.metadata).metadata.cinNumber}
                                      </span>
                                    </div>
                                  )}
                                  {user.kycDocuments.find((d: any) => d.metadata).metadata.birthDate && (
                                    <div>
                                      <span className="block text-[9px] text-primary-400 uppercase font-black tracking-tighter">Date OCR</span>
                                      <span className="font-black text-primary-700">
                                        {user.kycDocuments.find((d: any) => d.metadata).metadata.birthDate}
                                      </span>
                                    </div>
                                  )}
                                  {user.kycDocuments.find((d: any) => d.metadata).metadata.expiryDate && (
                                    <div className="col-span-2 mt-1 pt-1 border-t border-primary-50 flex items-center justify-between">
                                      <div>
                                        <span className="text-[9px] text-primary-400 uppercase font-black tracking-tighter">Valable jusqu'au: </span>
                                        <span className="text-[11px] font-bold text-primary-700">{user.kycDocuments.find((d: any) => d.metadata).metadata.expiryDate}</span>
                                      </div>
                                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                                        user.kycDocuments.find((d: any) => d.metadata).metadata.isExpired 
                                          ? 'bg-rose-50 text-rose-600 border-rose-200' 
                                          : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                      }`}>
                                        {user.kycDocuments.find((d: any) => d.metadata).metadata.isExpired ? 'Expirée' : 'Valide'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
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
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                              <CheckCircle2 size={16} className="text-emerald-600" />
                              <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">Approuvé</span>
                            </div>
                            <button
                              onClick={() => verifyKycMutation.mutate({ uuid: user.uuid, status: 'PENDING' })}
                              disabled={verifyKycMutation.isPending}
                              className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 border border-rose-100 disabled:opacity-50"
                            >
                              Annuler / Réinitialiser
                            </button>
                          </div>
                        )}
                      </div>
                      )}

                      {/* Bank Account Verification */}
                      {showBank && (
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
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${getStatusColor(ba.status)}`}>
                                      {getStatusLabel(ba.status)}
                                    </span>
                                    {ba.status !== 'PENDING' && (
                                      <button
                                        onClick={() => verifyBankMutation.mutate({ id: ba.id, status: 'PENDING' })}
                                        disabled={verifyBankMutation.isPending}
                                        title="Remettre en attente"
                                        className="p-1 bg-white hover:bg-rose-50 border border-slate-100 hover:border-rose-200 text-slate-400 hover:text-rose-600 rounded-lg transition-all active:scale-90"
                                      >
                                        <RefreshCw size={10} />
                                      </button>
                                    )}
                                  </div>
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
                                      Valider manuellement
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
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                              <AlertCircle size={14} className="text-slate-400" />
                              <span className="text-xs font-medium text-slate-400">Aucun compte bancaire enregistré</span>
                            </div>
                            <button
                              onClick={() => verifyBankManuallyMutation.mutate({ uuid: user.uuid, approved: true })}
                              disabled={verifyBankManuallyMutation.isPending}
                              className="w-full py-3 bg-gradient-to-r from-primary-500 to-indigo-600 hover:from-primary-600 hover:to-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95 disabled:opacity-50"
                            >
                              {verifyBankManuallyMutation.isPending ? 'Validation...' : 'Valider manuellement'}
                            </button>
                          </div>
                        )}
                      </div>
                      )}

                      {/* Contract & Engagement */}
                      {showContract && (
                      <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${user.contractAccepted ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                              <FileText size={18} />
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">Contrat & Engagement</h4>
                              <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                                {user.contractAccepted 
                                  ? `Signé le ${user.contractSignedAt ? format(new Date(user.contractSignedAt), 'dd/MM/yyyy', { locale: fr }) : '—'}`
                                  : 'Non signé'
                                }
                              </p>
                            </div>
                          </div>

                          {user.contractAccepted ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 p-3 rounded-2xl bg-blue-50 border border-blue-100">
                                <CheckCircle2 size={16} className="text-blue-600" />
                                <span className="text-xs font-black text-blue-700 uppercase tracking-widest">Signé via DamaneSign</span>
                              </div>
                              {user.damanesignSignedFileUrl && (
                                <a
                                  href={user.damanesignSignedFileUrl.startsWith('http') ? user.damanesignSignedFileUrl : `${BACKEND_URL}${user.damanesignSignedFileUrl}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-200 active:scale-95 group"
                                >
                                  <FileText size={14} className="group-hover:scale-110 transition-transform" />
                                  Voir le Contrat PDF
                                </a>
                              )}
                              <button
                                onClick={() => verifyContractMutation.mutate({ uuid: user.uuid, accepted: false })}
                                disabled={verifyContractMutation.isPending}
                                className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 border border-rose-100 disabled:opacity-50"
                              >
                                Annuler / Réinitialiser
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                <AlertCircle size={14} className="text-slate-400" />
                                <span className="text-xs font-medium text-slate-400">En attente de signature</span>
                              </div>
                              <button
                                onClick={() => verifyContractMutation.mutate({ uuid: user.uuid, accepted: true })}
                                disabled={verifyContractMutation.isPending}
                                className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-blue-200 active:scale-95 disabled:opacity-50"
                              >
                                {verifyContractMutation.isPending ? 'Validation...' : 'Valider manuellement'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      )}
                    </div>

                    {/* Subdomain Management */}
                    <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${user.subdomain ? 'bg-primary-100 text-primary-600' : 'bg-slate-100 text-slate-400'}`}>
                          <Globe size={18} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">Sous-domaine</h4>
                          <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                            {user.subdomain ? (
                              <span className="font-mono font-bold text-primary-600">{user.subdomain}<span className="text-slate-400">.{window.location.host}</span></span>
                            ) : 'Non configuré'}
                          </p>
                        </div>
                      </div>

                      {editingSubdomainUuid === user.uuid ? (
                        <div className="space-y-3">
                          <div className="flex rounded-2xl shadow-sm border border-slate-200 overflow-hidden bg-white focus-within:ring-4 focus-within:ring-primary-50 focus-within:border-primary-500 transition-all">
                            <input
                              type="text"
                              placeholder="mon-boutique"
                              className="flex-1 min-w-0 border-0 px-4 py-3 bg-transparent text-slate-900 font-mono font-bold focus:ring-0 placeholder:text-slate-300 text-sm"
                              value={subdomainInput}
                              onChange={(e) => setSubdomainInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                            />
                            <span className="inline-flex items-center px-3 border-l border-slate-200 bg-slate-50 text-slate-400 text-[11px] font-semibold select-none font-mono">
                              .{window.location.host}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                if (!subdomainInput || subdomainInput.length < 3) return toast.error('Minimum 3 caractères');
                                updateSubdomainMutation.mutate({ uuid: user.uuid, subdomain: subdomainInput });
                              }}
                              disabled={updateSubdomainMutation.isPending || subdomainInput.length < 3}
                              className="flex-1 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 disabled:opacity-50"
                            >
                              {updateSubdomainMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                            </button>
                            <button
                              onClick={() => { setEditingSubdomainUuid(null); setSubdomainInput(''); }}
                              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <button
                            onClick={() => { setEditingSubdomainUuid(user.uuid); setSubdomainInput(user.subdomain || ''); }}
                            className="w-full py-3 bg-gradient-to-r from-primary-500 to-indigo-600 hover:from-primary-600 hover:to-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95"
                          >
                            {user.subdomain ? 'Modifier le sous-domaine' : 'Définir un sous-domaine'}
                          </button>
                          {user.subdomain && (
                            <button
                              onClick={() => clearSubdomainMutation.mutate(user.uuid)}
                              disabled={clearSubdomainMutation.isPending}
                              className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 border border-rose-100 disabled:opacity-50"
                            >
                              {clearSubdomainMutation.isPending ? 'Suppression...' : 'Annuler / Réinitialiser'}
                            </button>
                          )}
                        </div>
                      )}
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
                      
                      {!user.isActive && (
                        <button
                          onClick={() => verifyUserMutation.mutate({ uuid: user.uuid, isActive: true })}
                          disabled={verifyUserMutation.isPending}
                          className="px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-200 hover:from-emerald-600 hover:to-emerald-700 transition-all active:scale-95 disabled:opacity-50"
                        >
                          {verifyUserMutation.isPending ? 'Activation...' : 'Activer le Compte'}
                        </button>
                      )}
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

        {verifications.length === 0 && (
          <div className="py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-6">
              <ShieldCheck size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-800">Aucune vérification en attente</h3>
            <p className="text-slate-400 font-medium max-w-sm mt-2">Tous vos utilisateurs sont actuellement en règle ou aucun ne correspond à votre recherche.</p>
          </div>
        )}
        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Par page</span>
              <div className="flex gap-1">
                {[10, 20, 50].map(n => (
                  <button
                    key={n}
                    onClick={() => { setLimit(n); setPage(1); }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${
                      limit === n
                        ? 'bg-[#2c2f74] text-white shadow-md'
                        : 'bg-white border border-slate-100 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setPage(Math.max(1, page - 1))} 
                disabled={page === 1} 
                className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-100 rounded-xl text-xs font-black text-slate-600 disabled:opacity-30 hover:bg-[#2c2f74] hover:text-white hover:border-[#2c2f74] transition-all shadow-sm"
              >
                Précédent
              </button>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(meta.totalPages, 7) }, (_, i) => {
                  let p: number;
                  if (meta.totalPages <= 7) p = i + 1;
                  else if (page <= 4) p = i + 1;
                  else if (page >= meta.totalPages - 3) p = meta.totalPages - 6 + i;
                  else p = page - 3 + i;
                  return (
                    <button 
                      key={p} 
                      onClick={() => setPage(p)} 
                      className={`w-9 h-9 rounded-xl text-xs font-black transition-all ${page === p ? 'bg-primary-500 text-white shadow-lg shadow-primary-200' : 'bg-white border border-slate-100 text-slate-500 hover:bg-slate-50'}`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              <button 
                onClick={() => setPage(Math.min(meta.totalPages, page + 1))} 
                disabled={page === meta.totalPages} 
                className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-100 rounded-xl text-xs font-black text-slate-600 disabled:opacity-30 hover:bg-[#2c2f74] hover:text-white hover:border-[#2c2f74] transition-all shadow-sm"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

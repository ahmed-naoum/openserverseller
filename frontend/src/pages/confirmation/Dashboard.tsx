import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { dashboardApi, adminApi, BACKEND_URL } from '../../lib/api';
import { 
  Shield, CheckCircle, XCircle, Clock, FileText, Check, X, Eye, 
  X as CloseIcon, MapPin, Globe, CreditCard, ChevronRight, Activity, Search, Mail
} from 'lucide-react';
import { 
  FaInstagram, FaTiktok, FaFacebook, FaYoutube, FaSnapchatGhost 
} from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

// Helper to get correct file URL
const getFileUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  // Ensure we use the backend host for /uploads
  const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
  return `${BACKEND_URL}${normalizedUrl}`;
};

interface KycDocument {
  id: number;
  documentType: string;
  documentUrl: string;
  status: string;
}

interface PendingUser {
  id: number;
  uuid: string;
  email: string | null;
  phone: string | null;
  role: { name: string };
  profile: { 
    fullName: string; 
    city?: string; 
    address?: string;
    instagramUsername?: string;
    tiktokUsername?: string;
    facebookUsername?: string;
    xUsername?: string;
    youtubeUsername?: string;
    snapchatUsername?: string;
    instagramFollowers?: number;
  } | null;
  kycDocuments: KycDocument[];
  brands?: {
    id: number;
    companyName: string;
    bankAccounts: {
      bankName: string;
      ribAccount: string;
      iceNumber?: string;
    }[];
  }[];
  emailVerifiedAt?: string | null;
  contractAccepted?: boolean;
  contractSignedAt?: string | null;
  createdAt: string;
  kycStatus: string;
  registrationIp?: string;
  detectedCity?: string;
}

export default function ConfirmationDashboard() {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [pendingVerifications, setPendingVerifications] = useState<PendingUser[]>([]);
  const [recentVerifications, setRecentVerifications] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const response = await dashboardApi.confirmation();
      setPendingVerifications(response.data.pendingVerifications || []);
      setRecentVerifications(response.data.recentVerifications || []);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      toast.error('Erreur lors du chargement des données.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (uuid: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      setIsUpdating(true);
      await adminApi.updateKycStatus(uuid, status);
      
      toast.success(status === 'APPROVED' ? 'Dossier approuvé avec succès !' : 'Dossier rejeté !', {
        icon: status === 'APPROVED' ? '✅' : '❌',
        duration: 4000,
      });
      
      if (selectedUser?.uuid === uuid) setSelectedUser(null);
      await loadDashboard();
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Erreur lors de la mise à jour du statut.');
    } finally {
      setIsUpdating(false);
    }
  };

  const pending = pendingVerifications;
  const approved = recentVerifications.filter(v => v.kycStatus === 'APPROVED');
  const rejected = recentVerifications.filter(v => v.kycStatus === 'REJECTED');

  let displayedUsers = activeTab === 'pending' ? pending : activeTab === 'approved' ? approved : rejected;
  
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    displayedUsers = displayedUsers.filter(u => 
      u.profile?.fullName?.toLowerCase().includes(term) || 
      u.email?.toLowerCase().includes(term) ||
      u.phone?.includes(term) ||
      u.uuid.includes(term)
    );
  }

  const StatCard = ({ title, count, icon: Icon, colorClass, bgClass, progress }: any) => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-3xl p-6 border ${borderClassFor(colorClass)} ${bgClass} shadow-sm transition-all hover:shadow-md`}
    >
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl font-black text-gray-900">{count}</h3>
            {progress !== undefined && (
              <span className={`text-sm font-bold ${progress > 0 ? 'text-green-500' : 'text-gray-400'}`}>
                {progress > 0 && '+'}{progress}% auj.
              </span>
            )}
          </div>
        </div>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${colorClass} bg-opacity-10 backdrop-blur-sm`}>
          <Icon className={`w-7 h-7 ${colorClass.replace('bg-', 'text-')}`} />
        </div>
      </div>
      {/* Decorative background blob */}
      <div className={`absolute -right-8 -bottom-8 w-32 h-32 rounded-full blur-2xl opacity-20 ${colorClass}`} />
    </motion.div>
  );

  const borderClassFor = (color: string) => {
    if (color.includes('amber')) return 'border-amber-100';
    if (color.includes('green')) return 'border-green-100';
    if (color.includes('red')) return 'border-red-100';
    return 'border-teal-100';
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 font-inter">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-100 text-teal-700 text-xs font-bold mb-4">
            <Activity className="w-4 h-4 animate-pulse" /> Espace Sécurisé
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight leading-none mb-2">Centre de Vérification</h1>
          <p className="text-lg text-gray-500 font-medium">Sécurisez l'écosystème en validant l'identité de nos partenaires.</p>
        </div>
        <div className="relative z-10 hidden lg:flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
           <div className="text-right">
             <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Taux d'approbation</p>
             <p className="text-xl font-black text-gray-900">{recentVerifications.length > 0 ? Math.round((approved.length / recentVerifications.length) * 100) : 0}%</p>
           </div>
           <div className="w-12 h-12 rounded-full border-4 border-teal-500 border-t-teal-100" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="En Attente" count={pending.length} icon={Clock} colorClass="bg-amber-500" bgClass="bg-white" />
        <StatCard title="Approuvés" count={approved.length} icon={CheckCircle} colorClass="bg-green-500" bgClass="bg-white" />
        <StatCard title="Rejetés" count={rejected.length} icon={XCircle} colorClass="bg-red-500" bgClass="bg-white" />
        <StatCard title="Total Traité" count={approved.length + rejected.length} icon={Shield} colorClass="bg-teal-500" bgClass="bg-gradient-to-br from-teal-50/50 to-white" />
      </div>

      {/* Main Workspace */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col h-[600px] overflow-hidden">
        
        {/* Toolbar */}
        <div className="border-b border-gray-100 p-4 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/50">
          
          {/* Segmented Control Tabs */}
          <div className="flex items-center p-1 bg-gray-100/80 rounded-2xl w-full sm:w-auto">
            {[
              { id: 'pending', label: 'En attente', count: pending.length, icon: Clock, color: 'amber' },
              { id: 'approved', label: 'Approuvés', count: approved.length, icon: CheckCircle, color: 'green' },
              { id: 'rejected', label: 'Rejetés', count: rejected.length, icon: XCircle, color: 'red' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex-1 sm:flex-none justify-center ${
                  activeTab === tab.id ? 'text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {activeTab === tab.id && (
                  <motion.div layoutId="activeTab" className="absolute inset-0 bg-white rounded-xl" transition={{ type: "spring", stiffness: 300, damping: 30 }} />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? `text-${tab.color}-500` : ''}`} />
                  <span className="hidden md:inline">{tab.label}</span>
                  <span className={`px-2 py-0.5 rounded-lg text-xs ${activeTab === tab.id ? `bg-${tab.color}-100 text-${tab.color}-700` : 'bg-gray-200 text-gray-500'}`}>
                    {tab.count}
                  </span>
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Rechercher..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border-gray-200 bg-white text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent font-medium shadow-sm transition-shadow"
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="flex-1 overflow-auto bg-white relative">
          {loading ? (
             <div className="absolute inset-0 flex items-center justify-center">
               <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-100 border-t-teal-500"></div>
             </div>
          ) : displayedUsers.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
              <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 border border-gray-100">
                <Shield className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Aucun dossier trouvé</h3>
              <p className="text-gray-500 max-w-sm">La file d'attente est vide pour cette catégorie ou votre recherche n'a donné aucun résultat.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-white sticky top-0 z-10 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                <tr>
                  <th className="px-6 py-4 text-xs font-extrabold text-gray-400 uppercase tracking-wider">Demandeur</th>
                  <th className="px-6 py-4 text-xs font-extrabold text-gray-400 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-4 text-xs font-extrabold text-gray-400 uppercase tracking-wider">Demande</th>
                  <th className="px-6 py-4 text-right text-xs font-extrabold text-gray-400 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <AnimatePresence>
                  {displayedUsers.map((item, i) => (
                    <motion.tr 
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.05 }}
                      className="hover:bg-teal-50/30 transition-colors group"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 ${
                            item.kycStatus === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                            item.kycStatus === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {item.profile?.fullName?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-base">{item.profile?.fullName || 'Non renseigné'}</p>
                            <p className="text-xs text-gray-400 font-mono mt-0.5">#{item.uuid.split('-')[0]}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">{item.email}</p>
                          <p className="text-gray-500 mt-0.5">{item.phone}</p>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col items-start gap-1.5">
                          <span className={`px-3 py-1 text-xs font-bold rounded-lg ${
                            item.role?.name === 'VENDOR' ? 'bg-purple-100 text-purple-700' :
                            item.role?.name === 'INFLUENCER' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {item.role?.name}
                          </span>
                          <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {new Date(item.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button 
                          onClick={() => setSelectedUser(item)}
                          className={`inline-flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
                            activeTab === 'pending' 
                              ? 'bg-teal-50 text-teal-600 hover:bg-teal-500 hover:text-white hover:shadow-lg hover:shadow-teal-500/30'
                              : 'bg-gray-50 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Split-Screen Document Examiner Modal */}
      {createPortal(
        <AnimatePresence>
          {selectedUser && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6" aria-labelledby="modal-title" role="dialog" aria-modal="true">
              {/* Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" 
                onClick={() => setSelectedUser(null)} 
              />
              
              {/* Modal Container */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className={`relative w-full ${selectedUser.kycDocuments?.length > 0 ? 'max-w-[1400px] md:flex-row' : 'max-w-[500px]'} h-[90vh] bg-gray-50 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-gray-200`}
              >
                
                {/* Modal Layout Grid */}
                <div className="flex h-full overflow-hidden">
                  
                  {/* Left Side: Document Viewer (60%) */}
                  {selectedUser.kycDocuments && selectedUser.kycDocuments.length > 0 && (
                    <div className="flex-[3] bg-gray-900 flex flex-col relative">
                        <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar space-y-8">
                           {selectedUser.kycDocuments.map((doc, idx) => (
                             <div key={idx} className="bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border border-gray-700">
                                <div className="bg-gray-900 px-4 py-3 border-b border-gray-700 flex justify-between items-center">
                                   <div className="flex items-center gap-2">
                                     <span className="w-6 h-6 rounded-md bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400">{idx + 1}</span>
                                     <span className="text-sm font-bold text-gray-200 uppercase">{doc.documentType.replace('_', ' ')}</span>
                                   </div>
                                   <a href={getFileUrl(doc.documentUrl)} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1 font-medium bg-teal-500/10 px-3 py-1.5 rounded-lg transition-colors">
                                     <Eye className="w-3 h-3" /> Ouvrir en grand
                                   </a>
                                </div>
                                <div className="bg-[#0f1115] p-2 flex items-center justify-center min-h-[400px]">
                                   <img 
                                     src={getFileUrl(doc.documentUrl)} 
                                     alt={doc.documentType}
                                     className="max-w-full h-auto max-h-[800px] object-contain rounded-xl hover:scale-105 transition-transform duration-300"
                                     onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                        (e.target as HTMLImageElement).nextElementSibling!.classList.remove('hidden');
                                     }}
                                   />
                                   <div className="hidden flex-col items-center justify-center text-gray-500 gap-4 mt-10 mb-10">
                                      <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center">
                                        <FileText className="w-8 h-8 text-gray-400" />
                                      </div>
                                      <span className="font-medium text-sm">Le format du fichier nécessite une ouverture externe</span>
                                   </div>
                                </div>
                             </div>
                           ))}
                        </div>
                    </div>
                  )}

                  {/* Right Side: Info & Actions (40%) */}
                  <div className={`flex-[2] bg-white flex flex-col h-full ${selectedUser.kycDocuments?.length > 0 ? 'border-l' : ''} border-gray-200`}>
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
                        <h2 className="text-xl font-black text-gray-900">Dossier #{(selectedUser?.id).toString().padStart(4, '0')}</h2>
                        <button onClick={() => setSelectedUser(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 transition-colors">
                          <CloseIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Scrollable Content (Étapes de Vérification) */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 font-inter bg-slate-50/50">
                        
                        {/* Etape 1: Profile & Email */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
                          <h4 className="text-sm font-black text-gray-900 flex items-center gap-2 mb-3">
                             <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center text-xs">1</span>
                             Informations & Email
                          </h4>
                          
                          <div className="pl-8 space-y-3">
                             <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gray-100 flex flex-col items-center justify-center font-black text-gray-400">
                                  {selectedUser.profile?.fullName?.charAt(0).toUpperCase() || '?'}
                                </div>
                                <div>
                                   <p className="font-black text-gray-900">{selectedUser.profile?.fullName || 'Non renseigné'}</p>
                                   <p className="text-xs text-gray-500">{selectedUser.role.name} • {selectedUser.phone || 'Pas de téléphone'}</p>
                                </div>
                             </div>
                             
                             <div className="flex justify-between items-center py-2 border-t border-gray-50">
                               <div className="flex items-center gap-2">
                                 <Mail className="w-4 h-4 text-gray-400" />
                                 <span className="text-sm text-gray-600 font-medium">{selectedUser.email || 'Email manquant'}</span>
                               </div>
                               {selectedUser.emailVerifiedAt ? (
                                  <span className="text-emerald-600 text-xs font-bold flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md"><CheckCircle className="w-3 h-3"/> Vérifié</span>
                               ) : (
                                  <span className="text-amber-600 text-xs font-bold flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-md"><Clock className="w-3 h-3"/> Non vérifié</span>
                               )}
                             </div>

                             <div className="flex justify-between items-center py-2 border-t border-gray-50">
                               <div className="flex items-center gap-2">
                                 <MapPin className="w-4 h-4 text-gray-400" />
                                 <span className="text-sm text-gray-600 font-medium">Ville déclarée</span>
                               </div>
                               <span className="text-sm text-gray-900 font-bold">{selectedUser.profile?.city || '-'}</span>
                             </div>
                          </div>
                        </div>

                        {/* Etape 2: Vérification d'Identité */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3">
                          <h4 className="text-sm font-black text-gray-900 flex items-center gap-2">
                             <span className="w-6 h-6 rounded-md bg-purple-100 text-purple-600 flex items-center justify-center text-xs">2</span>
                             Vérification d'Identité
                          </h4>
                          <div className="pl-8">
                             {selectedUser.kycDocuments && selectedUser.kycDocuments.length > 0 ? (
                               <div className="flex items-start gap-3">
                                 <Shield className="w-5 h-5 text-purple-500 mt-0.5" />
                                 <div>
                                   <p className="text-sm font-bold text-gray-900">{selectedUser.kycDocuments.length} Documents soumis</p>
                                   <p className="text-xs text-gray-500">Examinez les fichiers sur la partie gauche de l'écran.</p>
                                 </div>
                               </div>
                             ) : (
                               <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold flex items-center gap-2 border border-red-100">
                                 <XCircle className="w-4 h-4" /> Aucun document KYC fourni
                               </div>
                             )}
                          </div>
                        </div>

                        {/* Etape 3: Méthode de Paiement Bancaire */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3">
                          <h4 className="text-sm font-black text-gray-900 flex items-center gap-2 mb-3">
                             <span className="w-6 h-6 rounded-md bg-amber-100 text-amber-600 flex items-center justify-center text-xs">3</span>
                             Paiement Bancaire
                          </h4>
                          <div className="pl-8">
                             {selectedUser.brands && selectedUser.brands.length > 0 && selectedUser.brands[0].bankAccounts && selectedUser.brands[0].bankAccounts.length > 0 ? (
                               <div className="space-y-3">
                                 {selectedUser.brands[0].bankAccounts.map((bank: any, idx: number) => (
                                   <div key={idx} className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                                     <div className="flex items-center gap-2 mb-2">
                                       <CreditCard className="w-4 h-4 text-amber-500" />
                                       <span className="text-sm font-black text-gray-900">{bank.bankName}</span>
                                     </div>
                                     <p className="text-xs text-gray-500 font-mono bg-white p-2 border border-gray-100 rounded-lg">RIB: {bank.ribAccount}</p>
                                     {bank.iceNumber && (
                                       <p className="text-xs text-gray-500 mt-1">ICE: {bank.iceNumber}</p>
                                     )}
                                   </div>
                                 ))}
                               </div>
                             ) : (
                               <div className="text-sm text-gray-500 italic bg-gray-50 p-3 rounded-xl border border-gray-100">
                                 Aucun compte bancaire renseigné pour ce profil.
                               </div>
                             )}
                          </div>
                        </div>

                        {/* Etape 4: Contrat & Engagement */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3">
                          <h4 className="text-sm font-black text-gray-900 flex items-center gap-2 mb-3">
                             <span className="w-6 h-6 rounded-md bg-slate-900 text-white flex items-center justify-center text-xs">4</span>
                             Contrat & Engagement
                          </h4>
                          <div className="pl-8">
                             {selectedUser.contractAccepted ? (
                               <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-3 rounded-xl border border-emerald-100 font-bold text-sm">
                                 <CheckCircle className="w-5 h-5" />
                                 <div>
                                   <p>Engagement signé numériquement</p>
                                   <p className="text-[10px] opacity-80 mt-0.5">Le {new Date(selectedUser.contractSignedAt!).toLocaleString('fr-FR')}</p>
                                 </div>
                               </div>
                             ) : (
                               <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-100 font-bold text-sm">
                                 <Clock className="w-5 h-5" />
                                 En attente de signature
                               </div>
                             )}
                          </div>
                        </div>

                        {/* Social Networks (If Influencer) */}
                        {selectedUser.role?.name === 'INFLUENCER' && (
                          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                            <h4 className="text-sm font-black text-gray-900 mb-4 flex items-center gap-2 uppercase tracking-wider">
                              <Globe className="w-4 h-4 text-pink-500" /> Réseaux Sociaux
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                              {selectedUser.profile?.instagramUsername && (
                                <a href={`https://instagram.com/${selectedUser.profile.instagramUsername}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded-xl bg-pink-50 border border-pink-100 text-pink-700 hover:bg-pink-100 transition-colors">
                                  <FaInstagram className="text-lg flex-shrink-0" /> <span className="font-bold text-sm truncate">@{selectedUser.profile.instagramUsername}</span>
                                </a>
                              )}
                              {selectedUser.profile?.tiktokUsername && (
                                <a href={`https://tiktok.com/@${selectedUser.profile.tiktokUsername}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded-xl bg-gray-100 border border-gray-200 text-gray-900 hover:bg-gray-200 transition-colors">
                                  <FaTiktok className="text-lg flex-shrink-0" /> <span className="font-bold text-sm truncate">@{selectedUser.profile.tiktokUsername}</span>
                                </a>
                              )}
                              {selectedUser.profile?.facebookUsername && (
                                <a href={`https://facebook.com/${selectedUser.profile.facebookUsername}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 hover:bg-blue-100 transition-colors">
                                  <FaFacebook className="text-lg flex-shrink-0" /> <span className="font-bold text-sm truncate">@{selectedUser.profile.facebookUsername}</span>
                                </a>
                              )}
                              {selectedUser.profile?.xUsername && (
                                <a href={`https://x.com/${selectedUser.profile.xUsername}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded-xl bg-gray-900 border border-gray-800 text-white hover:bg-gray-800 transition-colors">
                                  <FaXTwitter className="text-lg flex-shrink-0" /> <span className="font-bold text-sm truncate">@{selectedUser.profile.xUsername}</span>
                                </a>
                              )}
                              {selectedUser.profile?.youtubeUsername && (
                                <a href={`https://youtube.com/@${selectedUser.profile.youtubeUsername}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 hover:bg-red-100 transition-colors">
                                  <FaYoutube className="text-lg flex-shrink-0" /> <span className="font-bold text-sm truncate">@{selectedUser.profile.youtubeUsername}</span>
                                </a>
                              )}
                              {selectedUser.profile?.snapchatUsername && (
                                <a href={`https://snapchat.com/add/${selectedUser.profile.snapchatUsername}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-700 hover:bg-yellow-100 transition-colors">
                                  <FaSnapchatGhost className="text-lg flex-shrink-0" /> <span className="font-bold text-sm truncate">@{selectedUser.profile.snapchatUsername}</span>
                                </a>
                              )}
                              {!selectedUser.profile?.instagramUsername && !selectedUser.profile?.tiktokUsername && !selectedUser.profile?.facebookUsername && !selectedUser.profile?.xUsername && !selectedUser.profile?.youtubeUsername && !selectedUser.profile?.snapchatUsername && (
                                <p className="col-span-2 text-sm text-gray-400 italic text-center py-2">Aucun réseau social renseigné</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Security & Address Info */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                            <h4 className="text-sm font-black text-gray-900 mb-4 flex items-center gap-2 uppercase tracking-wider">
                              <MapPin className="w-4 h-4 text-gray-400" /> Sécurité & Adresse
                            </h4>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                                <span className="text-sm text-gray-500 font-medium">Détection IP</span>
                                <span className="text-sm font-bold text-gray-900">{selectedUser.detectedCity || '-'}</span>
                              </div>
                              <div className="flex flex-col gap-1 py-2">
                                <span className="text-sm text-gray-500 font-medium">Adresse Postale</span>
                                <span className="text-sm font-medium text-gray-900 bg-gray-50 p-3 rounded-lg border border-gray-100">{selectedUser.profile?.address || 'Non renseignée'}</span>
                              </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Footer (Sticky) */}
                    <div className="p-6 border-t border-gray-100 bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
                         {['PENDING', 'UNDER_REVIEW'].includes(selectedUser.kycStatus) ? (() => {
                           const emailOk = !!selectedUser.emailVerifiedAt;
                           const kycOk = (selectedUser.kycDocuments?.length ?? 0) > 0;
                           const bankOk = (selectedUser.brands?.[0]?.bankAccounts?.length ?? 0) > 0;
                           const contractOk = !!selectedUser.contractAccepted;
                           const canApprove = emailOk && kycOk && bankOk && contractOk;
                           return (
                           <div className="flex flex-col gap-3">
                             {/* Detailed Checklist */}
                             <div className="space-y-1.5 p-3 bg-gray-50 rounded-xl border border-gray-100">
                               <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">Checklist de validation</p>
                               {([
                                 { label: 'Email vérifié', done: emailOk },
                                 { label: 'Documents KYC soumis', done: kycOk },
                                 { label: 'Compte bancaire (RIB)', done: bankOk },
                                 { label: 'Contrat signé', done: contractOk },
                               ] as { label: string; done: boolean }[]).map((item, i) => (
                                 <div key={i} className="flex items-center justify-between">
                                   <span className={`text-xs font-semibold ${item.done ? 'text-gray-700' : 'text-gray-400'}`}>{item.label}</span>
                                   <span className={`text-xs font-bold flex items-center gap-1 px-2 py-0.5 rounded-md ${
                                     item.done ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-400'
                                   }`}>
                                     {item.done ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                     {item.done ? 'OK' : 'Manquant'}
                                   </span>
                                 </div>
                               ))}
                             </div>

                             <button
                               onClick={() => handleUpdateStatus(selectedUser.uuid, 'APPROVED')}
                               disabled={isUpdating || !canApprove}
                               className="w-full relative group overflow-hidden flex items-center justify-center gap-2 py-4 bg-teal-500 text-white rounded-2xl font-black text-lg transition-all hover:bg-teal-400 hover:shadow-xl hover:shadow-teal-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                             >
                               <div className="absolute inset-0 w-full h-full bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                               <CheckCircle className="w-6 h-6 relative z-10" />
                               <span className="relative z-10">
                                 {canApprove ? 'Valider et Activer Compte' : 'Étapes manquantes...'}
                               </span>
                             </button>
                             <button
                               onClick={() => {
                                 if(window.confirm("Êtes-vous sûr de vouloir rejeter ce dossier ? Cette action est définitive.")) {
                                   handleUpdateStatus(selectedUser.uuid, 'REJECTED');
                                 }
                               }}
                               disabled={isUpdating}
                               className="w-full flex items-center justify-center gap-2 py-3 bg-white text-red-500 border-2 border-red-100 rounded-2xl font-bold transition-all hover:bg-red-50 disabled:opacity-50"
                             >
                               <XCircle className="w-5 h-5" /> Rejeter le dossier
                             </button>
                           </div>
                           );
                         })() : (
                           <div className={`flex items-center justify-center gap-3 p-5 rounded-2xl border-2 ${
                             selectedUser.kycStatus === 'APPROVED' ? 'bg-green-50 border-green-200 text-green-700' :
                             selectedUser.kycStatus === 'REJECTED' ? 'bg-red-50 border-red-200 text-red-700' :
                             'bg-blue-50 border-blue-200 text-blue-700'
                           }`}>
                             {selectedUser.kycStatus === 'APPROVED' ? <CheckCircle className="w-8 h-8" /> :
                              selectedUser.kycStatus === 'REJECTED' ? <XCircle className="w-8 h-8" /> :
                              <Clock className="w-8 h-8" />}
                             <div>
                                 <p className="font-black text-lg leading-tight">
                                   {selectedUser.kycStatus === 'APPROVED' ? 'Dossier Approuvé' :
                                    selectedUser.kycStatus === 'REJECTED' ? 'Dossier Rejeté' :
                                    "En cours d'examen"}
                                 </p>
                                 <p className="text-sm font-medium opacity-80">
                                   {selectedUser.kycStatus === 'APPROVED' || selectedUser.kycStatus === 'REJECTED'
                                     ? 'Traitements clos pour cet utilisateur.'
                                     : "Cet utilisateur attend votre décision."}
                                 </p>
                             </div>
                           </div>
                         )}
                    </div>
                  </div> {/* End Right Side */}
                </div> {/* End Grid Layout */}

              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { dashboardApi, adminApi } from '../../lib/api';
import { Shield, CheckCircle, XCircle, Clock, Users, FileText, Check, X, Eye, X as CloseIcon } from 'lucide-react';
import { 
  FaInstagram, 
  FaTiktok, 
  FaFacebook, 
  FaYoutube, 
  FaSnapchatGhost 
} from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import toast from 'react-hot-toast';

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
      // The backend returns users in kycStatus PENDING and then others in recent.
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
      
      toast.success(status === 'APPROVED' ? 'Dossier approuvé !' : 'Dossier rejeté !');
      
      // Close modal if open
      if (selectedUser?.uuid === uuid) {
        setSelectedUser(null);
      }
      
      // Reload dashboard data
      await loadDashboard();
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Erreur lors de la mise à jour du statut.');
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading && pendingVerifications.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const pending = pendingVerifications;
  const approved = recentVerifications.filter(v => v.kycStatus === 'APPROVED');
  const rejected = recentVerifications.filter(v => v.kycStatus === 'REJECTED');

  const displayedUsers = activeTab === 'pending' ? pending : activeTab === 'approved' ? approved : rejected;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Vérification KYC</h1>
        <p className="text-gray-500 mt-1">Examinez et validez les documents d'identité des utilisateurs.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">En attente</p>
            <p className="text-3xl font-black text-amber-500">{pending.length}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
             <Clock className="h-6 w-6 text-amber-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Approuvés</p>
            <p className="text-3xl font-black text-green-500">{approved.length}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
             <CheckCircle className="h-6 w-6 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Rejetés</p>
            <p className="text-3xl font-black text-red-500">{rejected.length}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
             <XCircle className="h-6 w-6 text-red-500" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Total</p>
            <p className="text-3xl font-black text-blue-500">{approved.length + rejected.length}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
             <Shield className="h-6 w-6 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl p-1 shadow-sm border border-gray-100 inline-flex mb-6 w-full sm:w-auto overflow-x-auto">
        {[
          { key: 'pending', label: 'En attente', count: pending.length, icon: Clock },
          { key: 'approved', label: 'Approuvés', count: approved.length, icon: CheckCircle },
          { key: 'rejected', label: 'Rejetés', count: rejected.length, icon: XCircle }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 sm:flex-none flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-primary-50 text-primary-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            <span className={`px-2 py-0.5 rounded-md text-xs ${activeTab === tab.key ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 text-gray-600'}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
           <div className="p-12 text-center text-gray-500">Chargement...</div>
        ) : displayedUsers.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">Aucune demande trouvée dans cette catégorie.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Utilisateur</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Rôle</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Documents</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {displayedUsers.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold">
                          {item.profile?.fullName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-bold text-gray-900">{item.profile?.fullName || 'Utilisateur inconnu'}</p>
                          <p className="text-xs text-gray-500 font-mono">ID: {item.uuid.split('-')[0]}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900">{item.email}</p>
                      <p className="text-sm text-gray-500">{item.phone}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-blue-100 text-blue-800">
                        {item.role?.name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">
                          {item.kycDocuments?.length || 0} doc(s)
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => setSelectedUser(item)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors font-bold text-xs"
                      >
                        <Eye className="w-4 h-4" />
                        Examiner
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Document Viewer Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div className="fixed inset-0 bg-gray-900/75 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={() => setSelectedUser(null)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl w-full">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold">
                    {selectedUser.profile?.fullName?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h3 className="text-lg leading-6 font-bold text-gray-900" id="modal-title">
                      {selectedUser.profile?.fullName || 'Examen KYC'}
                    </h3>
                    <p className="text-sm text-gray-500">{selectedUser.email} • {selectedUser.phone}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="bg-white rounded-full p-2 hover:bg-gray-100 text-gray-400 hover:text-gray-500 transition-colors focus:outline-none"
                >
                  <CloseIcon className="h-5 w-5" />
                </button>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Documents Column */}
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-gray-400" />
                        Documents Soumis ({selectedUser.kycDocuments?.length || 0})
                      </h4>
                      {selectedUser.kycDocuments && selectedUser.kycDocuments.length > 0 ? (
                        <div className="space-y-4">
                          {selectedUser.kycDocuments.map((doc) => (
                            <div key={doc.id} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                               <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex justify-between items-center">
                                 <span className="text-xs font-bold text-gray-600 uppercase">{doc.documentType.replace('_', ' ')}</span>
                                 <a href={doc.documentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline font-medium">Ouvrir</a>
                               </div>
                               <div className="p-2 bg-gray-100 flex items-center justify-center min-h-[200px]">
                                 <img 
                                   src={doc.documentUrl} 
                                   alt={doc.documentType}
                                   className="max-h-64 object-contain rounded drop-shadow-sm" 
                                   onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                      (e.target as HTMLImageElement).nextElementSibling!.classList.remove('hidden');
                                   }}
                                 />
                                 <div className="hidden text-sm text-gray-500 flex-col items-center gap-2">
                                    <FileText className="w-8 h-8 text-gray-300" />
                                    <span>Fichier non supporté en aperçu</span>
                                 </div>
                               </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 bg-amber-50 rounded-xl border border-amber-100 text-amber-800 text-center">
                          <p className="text-sm">Aucun document n'a été fourni par cet utilisateur.</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Information & Actions Column */}
                  <div>
                    <h4 className="font-bold text-gray-900 mb-4">Détails de l'utilisateur</h4>
                    <dl className="bg-gray-50 rounded-2xl p-6 border border-gray-100 space-y-4 text-sm mb-6">
                       <div>
                         <dt className="text-gray-500 font-medium">Nom Complet</dt>
                         <dd className="font-bold text-gray-900">{selectedUser.profile?.fullName || '-'}</dd>
                       </div>
                       <div>
                         <dt className="text-gray-500 font-medium">Rôle demandé</dt>
                         <dd className="font-bold text-gray-900">{selectedUser.role?.name}</dd>
                       </div>
                       
                        {selectedUser.role?.name === 'INFLUENCER' && (
                          <div className="border-t border-gray-200 pt-4 space-y-4">
                            <h5 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Plateformes Sociales</h5>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {/* Instagram */}
                              <div className="flex flex-col gap-1">
                                <dt className="text-gray-500 font-medium flex items-center gap-2">
                                  <FaInstagram className="text-pink-600" /> Instagram
                                </dt>
                                <dd className="font-bold text-gray-900">
                                  {selectedUser.profile?.instagramUsername ? (
                                    <a href={`https://instagram.com/${selectedUser.profile.instagramUsername}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                                      @{selectedUser.profile.instagramUsername}
                                    </a>
                                  ) : '-'}
                                </dd>
                              </div>

                              {/* TikTok */}
                              <div className="flex flex-col gap-1">
                                <dt className="text-gray-500 font-medium flex items-center gap-2">
                                  <FaTiktok className="text-black" /> TikTok
                                </dt>
                                <dd className="font-bold text-gray-900">
                                  {selectedUser.profile?.tiktokUsername ? (
                                    <a href={`https://tiktok.com/@${selectedUser.profile.tiktokUsername}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                                      @{selectedUser.profile.tiktokUsername}
                                    </a>
                                  ) : '-'}
                                </dd>
                              </div>

                              {/* Facebook */}
                              <div className="flex flex-col gap-1">
                                <dt className="text-gray-500 font-medium flex items-center gap-2">
                                  <FaFacebook className="text-blue-600" /> Facebook
                                </dt>
                                <dd className="font-bold text-gray-900">
                                  {selectedUser.profile?.facebookUsername ? (
                                    <a href={`https://facebook.com/${selectedUser.profile.facebookUsername}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                                      @{selectedUser.profile.facebookUsername}
                                    </a>
                                  ) : '-'}
                                </dd>
                              </div>

                              {/* X (Twitter) */}
                              <div className="flex flex-col gap-1">
                                <dt className="text-gray-500 font-medium flex items-center gap-2">
                                  <FaXTwitter className="text-black" /> X (Twitter)
                                </dt>
                                <dd className="font-bold text-gray-900">
                                  {selectedUser.profile?.xUsername ? (
                                    <a href={`https://x.com/${selectedUser.profile.xUsername}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                                      @{selectedUser.profile.xUsername}
                                    </a>
                                  ) : '-'}
                                </dd>
                              </div>

                              {/* YouTube */}
                              <div className="flex flex-col gap-1">
                                <dt className="text-gray-500 font-medium flex items-center gap-2">
                                  <FaYoutube className="text-red-600" /> YouTube
                                </dt>
                                <dd className="font-bold text-gray-900">
                                  {selectedUser.profile?.youtubeUsername ? (
                                    <a href={`https://youtube.com/@${selectedUser.profile.youtubeUsername}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                                      @{selectedUser.profile.youtubeUsername}
                                    </a>
                                  ) : '-'}
                                </dd>
                              </div>

                              {/* Snapchat */}
                              <div className="flex flex-col gap-1">
                                <dt className="text-gray-500 font-medium flex items-center gap-2">
                                  <FaSnapchatGhost className="text-yellow-500" /> Snapchat
                                </dt>
                                <dd className="font-bold text-gray-900">
                                  {selectedUser.profile?.snapchatUsername ? (
                                    <a href={`https://snapchat.com/add/${selectedUser.profile.snapchatUsername}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                                      @{selectedUser.profile.snapchatUsername}
                                    </a>
                                  ) : '-'}
                                </dd>
                              </div>
                            </div>
                          </div>
                        )}

                       <div className="border-t border-gray-200 pt-4 space-y-4">
                         <h5 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Localisation & Tracking</h5>
                         
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           <div className="flex flex-col gap-1">
                             <dt className="text-gray-500 font-medium">Ville (Déclarée)</dt>
                             <dd className="font-bold text-gray-900">{selectedUser.profile?.city || '-'}</dd>
                           </div>
                           <div className="flex flex-col gap-1">
                             <dt className="text-gray-500 font-medium">Ville (Détectée par IP)</dt>
                             <dd className="font-bold text-gray-900">{selectedUser.detectedCity || '-'}</dd>
                           </div>
                           <div className="flex flex-col gap-1">
                             <dt className="text-gray-500 font-medium">Adresse</dt>
                             <dd className="font-bold text-gray-900">{selectedUser.profile?.address || '-'}</dd>
                           </div>
                           <div className="flex flex-col gap-1">
                             <dt className="text-gray-500 font-medium">Adresse IP</dt>
                             <dd className="font-bold text-gray-900 font-mono text-xs">{selectedUser.registrationIp || '-'}</dd>
                           </div>
                         </div>
                       </div>
                    </dl>

                    {selectedUser.kycStatus === 'PENDING' ? (
                      <div>
                        <h4 className="font-bold text-gray-900 mb-4">Décision</h4>
                        <div className="flex flex-col gap-3">
                          <button
                            onClick={() => handleUpdateStatus(selectedUser.uuid, 'APPROVED')}
                            disabled={isUpdating}
                            className="w-full flex justify-center items-center gap-2 px-6 py-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            <Check className="w-5 h-5" />
                            Approuver le Dossier
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(selectedUser.uuid, 'REJECTED')}
                            disabled={isUpdating}
                            className="w-full flex justify-center items-center gap-2 px-6 py-3 border-2 border-red-100 rounded-xl text-sm font-bold text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-colors"
                          >
                            <X className="w-5 h-5" />
                            Rejeter le Dossier
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={`p-4 rounded-xl border flex items-center gap-3 ${selectedUser.kycStatus === 'APPROVED' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                         {selectedUser.kycStatus === 'APPROVED' ? <CheckCircle className="w-6 h-6 text-green-500" /> : <XCircle className="w-6 h-6 text-red-500" />}
                         <div>
                            <p className="font-bold text-sm">Dossier Traité</p>
                            <p className="text-xs">Statut actuel: {selectedUser.kycStatus}</p>
                         </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

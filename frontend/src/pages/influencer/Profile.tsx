import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { influencerApi, uploadApi, api } from '../../lib/api';
import {
  User, Camera, Shield, Key, Globe,
  CheckCircle, AlertTriangle, ExternalLink, RefreshCw, Save,
  Pencil, Check, Lock, ShieldCheck
} from 'lucide-react';
import { 
  FaInstagram, 
  FaTiktok, 
  FaFacebook, 
  FaYoutube, 
  FaSnapchatGhost 
} from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import toast from 'react-hot-toast';

export default function InfluencerProfile() {
  const { user, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPlatform, setSavingPlatform] = useState<string | null>(null);
  const [editingPlatform, setEditingPlatform] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    instagramUsername: user?.instagramUsername || '',
    tiktokUsername: user?.tiktokUsername || '',
    facebookUsername: user?.facebookUsername || '',
    xUsername: user?.xUsername || '',
    youtubeUsername: user?.youtubeUsername || '',
    snapchatUsername: user?.snapchatUsername || '',
  });

  useEffect(() => {
    if (user) {
      setForm({
        fullName: user.fullName || '',
        instagramUsername: user.instagramUsername || '',
        tiktokUsername: user.tiktokUsername || '',
        facebookUsername: user.facebookUsername || '',
        xUsername: user.xUsername || '',
        youtubeUsername: user.youtubeUsername || '',
        snapchatUsername: user.snapchatUsername || '',
      });
    }
  }, [user]);

  const socialPlatforms = [
    {
      id: 'instagramUsername',
      name: 'Instagram',
      icon: FaInstagram,
      connected: !!user?.instagramUsername,
      username: form.instagramUsername,
      color: 'from-pink-500 to-purple-600',
      bgColor: 'bg-pink-50',
      textColor: 'text-pink-600',
    },
    {
      id: 'tiktokUsername',
      name: 'TikTok',
      icon: FaTiktok,
      connected: !!user?.tiktokUsername,
      username: form.tiktokUsername,
      color: 'from-gray-800 to-gray-900',
      bgColor: 'bg-gray-50',
      textColor: 'text-gray-600',
    },
    {
      id: 'facebookUsername',
      name: 'Facebook',
      icon: FaFacebook,
      connected: !!user?.facebookUsername,
      username: form.facebookUsername,
      color: 'from-blue-600 to-blue-700',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      id: 'xUsername',
      name: 'X (Twitter)',
      icon: FaXTwitter,
      connected: !!user?.xUsername,
      username: form.xUsername,
      color: 'from-gray-700 to-gray-900',
      bgColor: 'bg-gray-50',
      textColor: 'text-gray-900',
    },
    {
      id: 'youtubeUsername',
      name: 'YouTube',
      icon: FaYoutube,
      connected: !!user?.youtubeUsername,
      username: form.youtubeUsername,
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-50',
      textColor: 'text-red-500',
    },
    {
      id: 'snapchatUsername',
      name: 'Snapchat',
      icon: FaSnapchatGhost,
      connected: !!user?.snapchatUsername,
      username: form.snapchatUsername,
      color: 'from-yellow-400 to-yellow-500',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-600',
    },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/users/${user?.uuid}`, form);
      await refreshUser();
      toast.success('Profil mis à jour avec succès!');
      setEditing(false);
    } catch (error) {
      toast.error('Erreur lors de la mise à jour du profil');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePlatform = async (platformId: string) => {
    setSavingPlatform(platformId);
    try {
      const value = (form as any)[platformId];
      await api.patch(`/users/${user?.uuid}`, { [platformId]: value });
      await refreshUser();
      toast.success('Lien mis à jour!');
      setEditingPlatform(null);
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSavingPlatform(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="card overflow-hidden">
        <div className="h-32 bg-gradient-to-br from-influencer-500 via-influencer-400 to-purple-500" />
        <div className="px-6 pb-6">
          <div className="flex items-end gap-4 -mt-12">
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl bg-white border-4 border-white shadow-lg flex items-center justify-center overflow-hidden">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-black text-influencer-600">
                    {(user?.fullName || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <button className="absolute bottom-0 right-0 p-1.5 bg-influencer-500 text-white rounded-lg shadow-sm hover:bg-influencer-600 transition-colors">
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 pb-1">
              <h1 className="text-xl font-extrabold text-gray-900">{user?.fullName}</h1>
              <p className="text-sm text-gray-500">{user?.email} • {user?.phone}</p>
            </div>
            <button
              onClick={() => editing ? handleSave() : setEditing(true)}
              disabled={saving}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                editing
                  ? 'bg-influencer-500 text-white hover:bg-influencer-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {editing ? <Save className="w-4 h-4" /> : <User className="w-4 h-4" />}
              {editing ? 'Sauvegarder' : 'Modifier'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="grid grid-cols-1 gap-6">
        {/* Social Platforms */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
              <Globe className="w-6 h-6 text-influencer-500" />
              Plateformes Connectées
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {socialPlatforms.map((platform) => {
              const isEditingThis = editingPlatform === platform.id;
              const isSavingThis = savingPlatform === platform.id;

              return (
                <div key={platform.name} className={`flex flex-col gap-4 p-6 rounded-3xl border transition-all duration-300 ${
                  isEditingThis ? 'border-influencer-200 bg-white ring-4 ring-influencer-500/5 shadow-xl' : 'border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-200 hover:shadow-lg'
                }`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${platform.color} flex items-center justify-center text-white shadow-lg transform transition-transform group-hover:scale-110`}>
                      <platform.icon className="w-7 h-7" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black text-slate-900 uppercase tracking-wider">{platform.name}</p>
                        {platform.connected && !isEditingThis && (
                          <span className="flex items-center gap-0.5 text-[9px] font-black text-green-600 bg-green-100 px-2 py-0.5 rounded-full uppercase tracking-widest">
                            <CheckCircle className="w-2.5 h-2.5" />
                            Vérifié
                          </span>
                        )}
                      </div>
                      {!isEditingThis && (
                        <p className="text-sm font-bold text-slate-500 truncate max-w-[150px]">
                          {platform.username || 'Non configuré'}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {isEditingThis ? (
                        <button
                          onClick={() => handleSavePlatform(platform.id)}
                          disabled={isSavingThis}
                          className="p-2.5 bg-green-500 text-white rounded-xl shadow-lg shadow-green-500/20 hover:bg-green-600 transition-all disabled:opacity-50"
                        >
                          {isSavingThis ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => setEditingPlatform(platform.id)}
                          className="p-2.5 bg-white text-slate-400 border border-slate-200 rounded-xl hover:text-influencer-500 hover:border-influencer-200 hover:shadow-md transition-all"
                        >
                          <Pencil className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {isEditingThis && (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                      <input
                        type="text"
                        autoFocus
                        className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-influencer-500 focus:ring-0 transition-all text-sm font-bold placeholder:text-slate-300"
                        placeholder={`@username ou URL ${platform.name}`}
                        value={platform.username}
                        onChange={(e) => setForm({ ...form, [platform.id]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSavePlatform(platform.id);
                          if (e.key === 'Escape') setEditingPlatform(null);
                        }}
                      />
                      <div className="flex justify-between items-center mt-2 px-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Appuyez sur Entrée pour valider</p>
                        <button 
                          onClick={() => setEditingPlatform(null)}
                          className="text-[10px] text-slate-400 hover:text-red-500 font-bold uppercase tracking-widest transition-colors"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 mt-8 font-bold italic opacity-60">
            * Tout changement de plateforme nécessite une nouvelle vérification manuelle par nos administrateurs.
          </p>
        </div>
      </div>
      </div>

      {/* KYC & Security */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card p-8 border border-slate-100 shadow-sm hover:shadow-md transition-all group">
          <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3 uppercase tracking-tight">
            <Shield className="w-6 h-6 text-influencer-500" />
            Statut KYC
          </h2>
          <div className={`flex flex-col gap-4 p-6 rounded-3xl border transition-all ${
            user?.kycStatus === 'APPROVED'
              ? 'bg-emerald-50/50 border-emerald-100 text-emerald-900 shadow-inner'
              : user?.kycStatus === 'REJECTED'
              ? 'bg-rose-50/50 border-rose-100 text-rose-900 shadow-inner'
              : 'bg-amber-50/50 border-amber-100 text-amber-900 shadow-inner'
          }`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                user?.kycStatus === 'APPROVED' ? 'bg-emerald-500' : 'bg-amber-500'
              } text-white`}>
                {user?.kycStatus === 'APPROVED' ? (
                  <CheckCircle className="w-7 h-7" />
                ) : (
                  <AlertTriangle className="w-7 h-7" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-lg font-black uppercase tracking-tight">
                  {user?.kycStatus === 'APPROVED' ? 'Vérification Validée' :
                   user?.kycStatus === 'REJECTED' ? 'Vérification Refusée' : 'Vérification en cours'}
                </p>
                <p className="text-xs font-bold opacity-60 uppercase tracking-widest mt-0.5">Identité Silacod</p>
              </div>
            </div>
            <div className="pt-4 border-t border-black/5">
              <p className="text-sm font-semibold opacity-75 leading-relaxed">
                {user?.kycStatus === 'APPROVED' 
                  ? 'Votre profil est entièrement certifié. Vous pouvez maintenant retirer vos gains sans restriction.'
                  : 'Veuillez soumettre vos documents officiels pour débloquer toutes les fonctionnalités de votre compte.'
                }
              </p>
            </div>
          </div>
        </div>

        <div className="card p-8 border border-slate-100 shadow-sm hover:shadow-md transition-all">
          <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3 uppercase tracking-tight">
            <Lock className="w-6 h-6 text-influencer-500" />
            Sécurité du Compte
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-5 rounded-3xl border border-slate-100 bg-slate-50/30 hover:bg-white hover:shadow-md transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 transition-transform group-hover:scale-110">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900 uppercase tracking-wider">Authentification 2FA</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Obligatoire après retrait</p>
                </div>
              </div>
              <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-3 py-1.5 rounded-full uppercase tracking-widest shadow-sm">Optionnel</span>
            </div>

            <div className="flex items-center justify-between p-5 rounded-3xl border border-slate-100 bg-slate-50/30 hover:bg-white hover:shadow-md transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 transition-transform group-hover:scale-110">
                  <Key className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900 uppercase tracking-wider">Mot de passe</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Actif depuis la création</p>
                </div>
              </div>
              <button className="flex items-center gap-1.5 text-xs font-black text-influencer-600 hover:text-influencer-700 bg-influencer-50 px-4 py-2 rounded-xl transition-all hover:scale-105 active:scale-95">
                <Pencil className="w-3.5 h-3.5" />
                Changer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

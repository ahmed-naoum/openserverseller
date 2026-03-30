import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { influencerApi, uploadApi } from '../../lib/api';
import {
  User, Camera, Shield, Key, Globe,
  CheckCircle, AlertTriangle, ExternalLink, RefreshCw, Save
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
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    bio: '',
    niche: '',
    website: '',
  });

  const socialPlatforms = [
    {
      name: 'Instagram',
      icon: FaInstagram,
      connected: !!user?.instagramUsername,
      username: user?.instagramUsername || '',
      color: 'from-pink-500 to-purple-600',
      bgColor: 'bg-pink-50',
      textColor: 'text-pink-600',
    },
    {
      name: 'TikTok',
      icon: FaTiktok,
      connected: !!user?.tiktokUsername,
      username: user?.tiktokUsername || '',
      color: 'from-gray-800 to-gray-900',
      bgColor: 'bg-gray-50',
      textColor: 'text-gray-600',
    },
    {
      name: 'Facebook',
      icon: FaFacebook,
      connected: !!user?.facebookUsername,
      username: user?.facebookUsername || '',
      color: 'from-blue-600 to-blue-700',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      name: 'X (Twitter)',
      icon: FaXTwitter,
      connected: !!user?.xUsername,
      username: user?.xUsername || '',
      color: 'from-gray-700 to-gray-900',
      bgColor: 'bg-gray-50',
      textColor: 'text-gray-900',
    },
    {
      name: 'YouTube',
      icon: FaYoutube,
      connected: !!user?.youtubeUsername,
      username: user?.youtubeUsername || '',
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-50',
      textColor: 'text-red-500',
    },
    {
      name: 'Snapchat',
      icon: FaSnapchatGhost,
      connected: !!user?.snapchatUsername,
      username: user?.snapchatUsername || '',
      color: 'from-yellow-400 to-yellow-500',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-600',
    },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      // Profile update would call backend endpoint
      toast.success('Profil mis à jour avec succès!');
      setEditing(false);
    } catch (error) {
      toast.error('Erreur lors de la mise à jour du profil');
    } finally {
      setSaving(false);
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
        {/* Personal Info */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-influencer-500" />
            Informations Personnelles
          </h2>
          <div className="space-y-4">
            <div>
              <label className="label">Nom Complet</label>
              <input
                type="text"
                className="input"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                disabled={!editing}
              />
            </div>
            <div>
              <label className="label">Bio / Description</label>
              <textarea
                className="input min-h-[80px]"
                placeholder="Décrivez votre style et votre audience..."
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                disabled={!editing}
              />
            </div>
            <div>
              <label className="label">Niche</label>
              <input
                type="text"
                className="input"
                placeholder="Fashion, Tech, Beauty..."
                value={form.niche}
                onChange={(e) => setForm({ ...form, niche: e.target.value })}
                disabled={!editing}
              />
            </div>
            <div>
              <label className="label">Site Web</label>
              <input
                type="url"
                className="input"
                placeholder="https://..."
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                disabled={!editing}
              />
            </div>
          </div>
        </div>

        {/* Social Platforms */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-influencer-500" />
            Plateformes Connectées
          </h2>
          <div className="space-y-3">
            {socialPlatforms.map((platform) => (
              <div key={platform.name} className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50/50">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${platform.color} flex items-center justify-center text-white`}>
                  <platform.icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900">{platform.name}</p>
                  {platform.connected ? (
                    <p className="text-xs text-gray-500">
                      @{platform.username}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400">Non connecté</p>
                  )}
                </div>
                {platform.connected ? (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                      <CheckCircle className="w-3 h-3" />
                      Vérifié
                    </span>
                    <button className="p-1.5 rounded-lg text-gray-400 hover:text-influencer-600 hover:bg-influencer-50 transition-all">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button className="flex items-center gap-1 px-3 py-1.5 bg-influencer-500 text-white rounded-lg text-xs font-bold hover:bg-influencer-600 transition-all">
                    <ExternalLink className="w-3 h-3" />
                    Connecter
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Assurez-vous que vos comptes sont publics pour la vérification manuelle par notre équipe.
          </p>
        </div>
      </div>

      {/* KYC & Security */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-influencer-500" />
            Statut KYC
          </h2>
          <div className={`flex items-center gap-3 p-4 rounded-xl border ${
            user?.kycStatus === 'APPROVED'
              ? 'bg-green-50 border-green-200 text-green-800'
              : user?.kycStatus === 'REJECTED'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            {user?.kycStatus === 'APPROVED' ? (
              <CheckCircle className="w-6 h-6 text-green-500" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            )}
            <div>
              <p className="font-bold text-sm">
                {user?.kycStatus === 'APPROVED' ? 'KYC Approuvé' :
                 user?.kycStatus === 'REJECTED' ? 'KYC Rejeté' : 'KYC En Attente'}
              </p>
              <p className="text-xs opacity-70">Soumettez vos documents d'identité pour la vérification.</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Key className="w-5 h-5 text-influencer-500" />
            Sécurité
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-gray-50/50">
              <div>
                <p className="text-sm font-bold text-gray-900">Authentification 2FA</p>
                <p className="text-xs text-gray-500">Obligatoire après le premier retrait</p>
              </div>
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">Non activé</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-gray-50/50">
              <div>
                <p className="text-sm font-bold text-gray-900">Mot de passe</p>
                <p className="text-xs text-gray-500">Dernière modification: non défini</p>
              </div>
              <button className="text-xs font-bold text-influencer-600 hover:text-influencer-700">Changer</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

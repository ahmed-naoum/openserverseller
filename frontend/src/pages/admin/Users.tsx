import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { 
  X, 
  KeyIcon, 
  ShieldOff, 
  UserPlus, 
  Search, 
  Users, 
  CheckCircle2, 
  Clock, 
  MoreVertical, 
  Edit2, 
  Power,
  ShieldAlert,
  Mail,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Filter,
  Eye,
  EyeOff,
  Package,
  Shield,
  Box,
  Tag,
  FileText,
  Landmark,
  CreditCard,
  User,
  Globe,
  MapPin,
  Camera,
  Calendar,
  Link,
  Percent,
  ScanLine,
  LogIn,
  Trash2,
  LayoutTemplate,
  LayoutDashboard,
  Loader2,
  Store,
  Sparkles
} from 'lucide-react';

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

function AssignInfluencersModal({ isOpen, onClose, agent }: { isOpen: boolean; onClose: () => void; agent: any }) {
  const queryClient = useQueryClient();
  const [selectedInfluencers, setSelectedInfluencers] = useState<number[]>([]);
  const [autoAssign, setAutoAssign] = useState(agent?.autoAssignInfluencers || false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [influencers, setInfluencers] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen || !agent) return;
    setLoading(true);

    Promise.all([
      adminApi.getInfluencers(),
      adminApi.getAgentInfluencerAssignments(agent.id),
    ]).then(([infRes, assignRes]) => {
      setInfluencers(infRes.data?.data || []);
      const currentIds = (assignRes.data?.data || []).map((a: any) => a.influencerId);
      setSelectedInfluencers(currentIds);
      // Sync autoAssign state from agent data
      setAutoAssign(agent.autoAssignInfluencers || false);
    }).catch(() => {
      toast.error('Erreur lors du chargement');
    }).finally(() => setLoading(false));
  }, [isOpen, agent]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminApi.setAgentInfluencerAssignments(agent.id, selectedInfluencers, autoAssign);
      toast.success(
        autoAssign 
          ? `Auto-assignation activée pour ${agent.fullName || 'cet agent'}`
          : `${selectedInfluencers.length} influenceur(s) assigné(s) à ${agent.fullName || 'cet agent'}`
      );
      // Invalidate users query to refresh the list with new autoAssign status
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const toggleInfluencer = (id: number) => {
    setSelectedInfluencers(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedInfluencers.length === influencers.length) {
      setSelectedInfluencers([]);
    } else {
      setSelectedInfluencers(influencers.map(inf => inf.id));
    }
  };

  if (!isOpen || !agent) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md cursor-pointer"
        onClick={onClose}
      />
      <div 
        className="relative z-10 bg-white rounded-[2rem] w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-white/20 scale-in-center transition-transform duration-500 cursor-default"
        style={{ backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
      >
        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-gradient-to-br from-primary-50/50 to-indigo-50/30">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <Users size={24} className="text-primary-600" />
              Assigner Influenceurs & Vendeurs
            </h2>
            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
              Agent: <span className="text-primary-600">{agent.fullName || agent.email}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2.5 text-slate-400 hover:text-slate-600 rounded-2xl hover:bg-white transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 overflow-y-auto flex-1 bg-white/50">
          {/* Auto-assign toggle */}
          <div className={`mb-6 p-4 rounded-3xl border-2 transition-all duration-300 ${
            autoAssign 
              ? 'border-indigo-500 bg-indigo-50/50 shadow-lg shadow-indigo-100' 
              : 'border-slate-100 bg-slate-50/50'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${
                  autoAssign ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 border border-slate-100'
                }`}>
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-800 tracking-tight">Auto-assignation globale</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Tous les influenceurs & vendeurs (présents & futurs)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAutoAssign(!autoAssign)}
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${
                  autoAssign ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 transform ${
                  autoAssign ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>
            {autoAssign && (
              <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-3 animate-pulse">
                ✨ Mode Agent Global Activé
              </p>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Récupération des données...</p>
            </div>
          ) : influencers.length === 0 ? (
            <div className="text-center py-12 opacity-50">
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Aucun utilisateur trouvé</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {selectedInfluencers.length} d'entre eux sélectionnés
                </p>
                <div className="h-px flex-1 mx-4 bg-slate-100" />
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-[10px] font-black text-primary-600 uppercase tracking-widest hover:text-primary-800 transition-colors"
                >
                  {selectedInfluencers.length === influencers.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
              </div>
              {influencers.map((inf: any) => (
                <label
                  key={inf.id}
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 group cursor-pointer ${
                    selectedInfluencers.includes(inf.id)
                      ? 'border-primary-500 bg-primary-50 text-primary-900'
                      : 'border-slate-100 bg-white hover:border-primary-200'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                    selectedInfluencers.includes(inf.id)
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'border-slate-200 group-hover:border-primary-300'
                  }`}>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={selectedInfluencers.includes(inf.id)}
                      onChange={() => toggleInfluencer(inf.id)}
                    />
                    {selectedInfluencers.includes(inf.id) && <CheckCircle2 size={14} className="stroke-[3px]" />}
                  </div>
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400 group-hover:bg-primary-100 group-hover:text-primary-600 transition-colors">
                    {inf.fullName?.charAt(0) || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black tracking-tight">{inf.fullName}</p>
                      <span className={`px-1.5 py-0.5 text-[8px] font-black uppercase rounded border ${
                        inf.role === 'VENDOR' 
                          ? 'bg-amber-50 text-amber-600 border-amber-200' 
                          : 'bg-indigo-50 text-indigo-600 border-indigo-200'
                      }`}>
                        {inf.role === 'VENDOR' ? 'Vendeur' : 'Influenceur'}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">{inf.email || inf.phone}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="p-8 border-t border-slate-50 flex gap-4 bg-white">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex-[2] btn-primary rounded-2xl shadow-xl shadow-primary-200/50"
          >
            {saving ? 'Sauvegarde...' : `Confirmer (${selectedInfluencers.length})`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function AssignHelperUsersModal({ isOpen, onClose, helper }: { isOpen: boolean; onClose: () => void; helper: any }) {
  const queryClient = useQueryClient();
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [autoAssign, setAutoAssign] = useState(helper?.autoAssignHelperUsers || false);
  const [autoAssignVendors, setAutoAssignVendors] = useState(helper?.autoAssignHelperVendors || false);
  const [autoAssignInfluencers, setAutoAssignInfluencers] = useState(helper?.autoAssignHelperInfluencers || false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'VENDOR' | 'INFLUENCER'>('ALL');

  useEffect(() => {
    if (!isOpen || !helper) return;
    setLoading(true);

    Promise.all([
      adminApi.users({ limit: 1000 }), 
      adminApi.getHelperUserAssignments(helper.id),
    ]).then(([usersRes, assignRes]) => {
      const list = (usersRes.data?.data?.users || []).filter(
        (u: any) => u.id !== helper.id && u.role !== 'SUPER_ADMIN'
      );
      setAllUsers(list);
      const currentIds = (assignRes.data?.data || []).map((a: any) => a.targetUserId);
      setSelectedUsers(currentIds);
      setAutoAssign(helper.autoAssignHelperUsers || false);
      setAutoAssignVendors(helper.autoAssignHelperVendors || false);
      setAutoAssignInfluencers(helper.autoAssignHelperInfluencers || false);
    }).catch(() => {
      toast.error('Erreur lors du chargement');
    }).finally(() => setLoading(false));
  }, [isOpen, helper]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminApi.setHelperUserAssignments(
        helper.id, 
        selectedUsers, 
        autoAssign, 
        autoAssignVendors, 
        autoAssignInfluencers
      );
      toast.success('Assignations mises à jour avec succès');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const toggleUser = (id: number) => {
    setSelectedUsers(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const filteredUsers = allUsers.filter(u => {
    if (roleFilter === 'ALL') return true;
    return u.role === roleFilter;
  });

  const visibleIds = filteredUsers.map(u => u.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedUsers.includes(id));

  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelectedUsers(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedUsers(prev => {
        const next = [...prev];
        visibleIds.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  if (!isOpen || !helper) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md cursor-pointer"
        onClick={onClose}
      />
      <div 
        className="relative z-10 bg-white rounded-[2rem] w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-white/20 scale-in-center transition-transform duration-500 cursor-default"
        style={{ backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
      >
        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-gradient-to-br from-primary-50/50 to-indigo-50/30">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <Users size={24} className="text-primary-600" />
              Assigner Utilisateurs
            </h2>
            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
              Helper: <span className="text-primary-600">{helper.fullName || helper.email}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2.5 text-slate-400 hover:text-slate-600 rounded-2xl hover:bg-white transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 overflow-y-auto flex-1 bg-white/50">
          {/* Toggles Container */}
          <div className="space-y-3 mb-6">
            {/* Global Auto-assign Toggle */}
            <div className={`p-4 rounded-3xl border-2 transition-all duration-300 ${
              autoAssign 
                ? 'border-indigo-500 bg-indigo-50/50 shadow-lg shadow-indigo-100' 
                : 'border-slate-100 bg-slate-50/50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${
                    autoAssign ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 border border-slate-100'
                  }`}>
                    <ShieldAlert size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800 tracking-tight">Auto-assignation globale</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Tous les utilisateurs (présents & futurs)</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoAssign(!autoAssign)}
                  className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${
                    autoAssign ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 transform ${
                    autoAssign ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>
              {autoAssign && (
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-3 animate-pulse">
                  ✨ Mode Helper Global Activé
                </p>
              )}
            </div>

            {/* Vendor Auto-assign Toggle */}
            <div className={`p-4 rounded-3xl border-2 transition-all duration-300 ${
              autoAssignVendors && !autoAssign
                ? 'border-emerald-500 bg-emerald-50/30 shadow-lg shadow-emerald-100' 
                : autoAssign
                ? 'border-slate-100 bg-slate-50/30 opacity-60'
                : 'border-slate-100 bg-slate-50/50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${
                    autoAssignVendors || autoAssign ? 'bg-emerald-600 text-white' : 'bg-white text-slate-400 border border-slate-100'
                  }`}>
                    <Store size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800 tracking-tight">Auto-assignation VENDOR</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Tous les vendeurs (présents & futurs)</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={autoAssign}
                  onClick={() => setAutoAssignVendors(!autoAssignVendors)}
                  className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${
                    autoAssignVendors || autoAssign ? 'bg-emerald-600' : 'bg-slate-200'
                  } ${autoAssign ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 transform ${
                    autoAssignVendors || autoAssign ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>
              {(autoAssignVendors || autoAssign) && (
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-3 animate-pulse">
                  ✨ Auto-assignation Vendeurs Active
                </p>
              )}
            </div>

            {/* Influencer Auto-assign Toggle */}
            <div className={`p-4 rounded-3xl border-2 transition-all duration-300 ${
              autoAssignInfluencers && !autoAssign
                ? 'border-purple-500 bg-purple-50/30 shadow-lg shadow-purple-100' 
                : autoAssign
                ? 'border-slate-100 bg-slate-50/30 opacity-60'
                : 'border-slate-100 bg-slate-50/50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${
                    autoAssignInfluencers || autoAssign ? 'bg-purple-600 text-white' : 'bg-white text-slate-400 border border-slate-100'
                  }`}>
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800 tracking-tight">Auto-assignation INFLUENCER</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Tous les influenceurs (présents & futurs)</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={autoAssign}
                  onClick={() => setAutoAssignInfluencers(!autoAssignInfluencers)}
                  className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${
                    autoAssignInfluencers || autoAssign ? 'bg-purple-600' : 'bg-slate-200'
                  } ${autoAssign ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 transform ${
                    autoAssignInfluencers || autoAssign ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>
              {(autoAssignInfluencers || autoAssign) && (
                <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest mt-3 animate-pulse">
                  ✨ Auto-assignation Influenceurs Active
                </p>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Récupération des données...</p>
            </div>
          ) : allUsers.length === 0 ? (
            <div className="text-center py-12 opacity-50">
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Aucun utilisateur trouvé</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Role filter tabbed selector */}
              <div className="flex items-center gap-2 mb-6 bg-slate-100/80 p-1.5 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setRoleFilter('ALL')}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                    roleFilter === 'ALL'
                      ? 'bg-white text-slate-800 shadow-sm shadow-slate-200/50'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Tous
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('VENDOR')}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                    roleFilter === 'VENDOR'
                      ? 'bg-white text-slate-800 shadow-sm shadow-slate-200/50'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Vendeurs
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('INFLUENCER')}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                    roleFilter === 'INFLUENCER'
                      ? 'bg-white text-slate-800 shadow-sm shadow-slate-200/50'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Influenceurs
                </button>
              </div>

              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {filteredUsers.filter(u => selectedUsers.includes(u.id)).length} sur {filteredUsers.length} sélectionnés
                </p>
                <div className="h-px flex-1 mx-4 bg-slate-100" />
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-[10px] font-black text-primary-600 uppercase tracking-widest hover:text-primary-800 transition-colors"
                >
                  {allVisibleSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
              </div>

              {filteredUsers.map((u) => (
                <label
                  key={u.id}
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 group cursor-pointer ${
                    selectedUsers.includes(u.id)
                      ? 'border-primary-500 bg-primary-50 text-primary-900'
                      : 'border-slate-100 bg-white hover:border-primary-200'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                    selectedUsers.includes(u.id)
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'border-slate-200 group-hover:border-primary-300'
                  }`}>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={selectedUsers.includes(u.id)}
                      onChange={() => toggleUser(u.id)}
                    />
                    {selectedUsers.includes(u.id) && <CheckCircle2 size={14} className="stroke-[3px]" />}
                  </div>
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400 group-hover:bg-primary-100 group-hover:text-primary-600 transition-colors">
                    {u.fullName?.charAt(0) || u.email?.charAt(0) || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black tracking-tight underline">{u.fullName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                        u.role === 'VENDOR' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {u.role}
                      </span>
                      <span className="text-[10px] font-bold opacity-60 tracking-tight">{u.email}</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="p-8 border-t border-slate-50 flex gap-4 bg-white">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all"
          >
            Fermer
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex-[2] btn-primary rounded-2xl shadow-xl shadow-primary-200/50"
          >
            {saving ? 'Sauvegarde...' : `Confirmer (${selectedUsers.length})`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}


function AddUserModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    role: 'VENDOR',
  });
  const [showPassword, setShowPassword] = useState(false);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: adminApi.createUser,
    onSuccess: () => {
      toast.success('Utilisateur créé avec succès');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['userRoleCounts'] });
      onClose();
      setFormData({ fullName: '', email: '', phone: '', password: '', role: 'VENDOR' });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur lors de la création');
    }
  });

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md cursor-pointer"
        onClick={onClose}
      />
      <div 
        className="relative z-10 bg-white rounded-[2.5rem] w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl border border-white/20 flex flex-col cursor-default"
        style={{ backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
      >
        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-gradient-to-br from-primary-50/50 to-indigo-50/30 shrink-0">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <UserPlus size={28} className="text-primary-600" />
              Nouvel Utilisateur
            </h2>
            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Enregistrement SILACOD</p>
          </div>
          <button onClick={onClose} className="p-3 text-slate-400 hover:text-slate-600 rounded-2xl hover:bg-white transition-all">
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nom Complet</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Jean Dupont"
                  className="input pl-11"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                />
                <Users size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
              </div>
            </div>
            
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Email</label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="admin@example.com"
                  className="input pl-11"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Téléphone</label>
              <div className="relative">
                <input
                  type="tel"
                  placeholder="+212 ..."
                  className="input pl-11"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
                <Smartphone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Mot de Passe</label>
              <div className="relative group">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="input pl-11 pr-12 group-focus-within:border-primary-400 transition-all"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <ShieldAlert size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Assignation Rôle</label>
              <select
                required
                className="input cursor-pointer"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              >
                <option value="VENDOR">Vendeur</option>
                <option value="INFLUENCER">Influenceur</option>
                <option value="GROSSELLER">Grossiste</option>
                <option value="HELPER">Helper</option>
                <option value="CALL_CENTER_AGENT">Agent Call Center</option>
                <option value="CONFIRMATION_AGENT">Agent de Confirmation</option>
                <option value="SYSTEM_SUPPORT">Agent de Support</option>
                <option value="FINANCE_ADMIN">Admin Finance</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>
          </div>
        </div>
          
          <div className="p-8 pt-4 border-t border-slate-50 flex gap-4 shrink-0 bg-slate-50/50">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 bg-white border border-slate-100 rounded-2xl transition-all shadow-sm"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-[2] px-6 py-3.5 text-xs font-black uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-lg shadow-indigo-200/50 transition-all disabled:opacity-50"
            >
              {createMutation.isPending ? 'Sync...' : 'Créer Compte'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function EditUserModal({ isOpen, onClose, user }: { isOpen: boolean; onClose: () => void; user: any }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'access' | 'personal' | 'bank' | 'social' | 'questionnaire'>('access');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'VENDOR',
    isActive: true,
    kycStatus: 'PENDING',
    canImpersonate: false,
    canManageProducts: false,
    canManageLeads: false,
    canManageOrders: false,
    canManageInfluencerLinks: false,
    canManageTickets: false,
    canScanReturns: false,
    canManageAffiliateInvites: false,
    helperCommissionPerDeliveredLead: 5,
    canDisplayOnDashboard: true,
    city: '',
    address: '',
    cinNumber: '',
    birthDate: '',
    language: 'fr',
    avatarUrl: '',
    instagramUsername: '',
    tiktokUsername: '',
    facebookUsername: '',
    xUsername: '',
    youtubeUsername: '',
    snapchatUsername: '',
    instagramUrl: '',
    tiktokUrl: '',
    facebookUrl: '',
    youtubeUrl: '',
    snapchatUrl: '',
    ribAccount: '',
    bankName: '',
    iceNumber: '',
    bankStatus: 'PENDING',
    platformFeeRate: 0.13,
    saisieFeeMad: 8.0,
  });

  const { data: fullUserData, isLoading: isUserLoading } = useQuery({
    queryKey: ['admin-user-detail', user?.uuid],
    queryFn: () => adminApi.getUser(user.uuid),
    enabled: !!user?.uuid && isOpen,
  });

  const fullUser = fullUserData?.data?.data?.user;

  useEffect(() => {
    if (fullUser) {
      setFormData({
        fullName: fullUser.fullName || '',
        email: fullUser.email || '',
        phone: fullUser.phone || '',
        role: fullUser.role || 'VENDOR',
        isActive: fullUser.isActive ?? true,
        kycStatus: fullUser.kycStatus || 'PENDING',
        canImpersonate: fullUser.canImpersonate || false,
        canManageProducts: fullUser.canManageProducts || false,
        canManageLeads: fullUser.canManageLeads || false,
        canManageOrders: fullUser.canManageOrders || false,
        canManageInfluencerLinks: fullUser.canManageInfluencerLinks || false,
        canManageTickets: fullUser.canManageTickets || false,
        canScanReturns: fullUser.canScanReturns || false,
        canManageAffiliateInvites: fullUser.canManageAffiliateInvites || false,
        helperCommissionPerDeliveredLead: fullUser.helperCommissionPerDeliveredLead ?? 5,
        canDisplayOnDashboard: fullUser.canDisplayOnDashboard ?? true,
        city: fullUser.city || '',
        address: fullUser.address || '',
        cinNumber: fullUser.cinNumber || '',
        birthDate: fullUser.birthDate ? fullUser.birthDate.split('T')[0] : '',
        language: fullUser.language || 'fr',
        avatarUrl: fullUser.avatarUrl || '',
        instagramUsername: fullUser.instagramUsername || '',
        tiktokUsername: fullUser.tiktokUsername || '',
        facebookUsername: fullUser.facebookUsername || '',
        xUsername: fullUser.xUsername || '',
        youtubeUsername: fullUser.youtubeUsername || '',
        snapchatUsername: fullUser.snapchatUsername || '',
        instagramUrl: fullUser.metadata?.instagramUrl || '',
        tiktokUrl: fullUser.metadata?.tiktokUrl || '',
        facebookUrl: fullUser.metadata?.facebookUrl || '',
        youtubeUrl: fullUser.metadata?.youtubeUrl || '',
        snapchatUrl: fullUser.metadata?.snapchatUrl || '',
        ribAccount: fullUser.bankAccounts?.[0]?.ribAccount || '',
        bankName: fullUser.bankAccounts?.[0]?.bankName || '',
        iceNumber: fullUser.bankAccounts?.[0]?.iceNumber || '',
        bankStatus: fullUser.bankAccounts?.[0]?.status || 'PENDING',
        platformFeeRate: fullUser.platformFeeRate ?? 0.13,
        saisieFeeMad: fullUser.saisieFeeMad ?? 8.0,
      });
    }
  }, [fullUser]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => adminApi.updateUser(user.uuid, data),
    onSuccess: () => {
      toast.success('Utilisateur mis à jour avec succès');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['userRoleCounts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', user.uuid] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur lors de la mise à jour');
    }
  });

  if (!isOpen || !user) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md cursor-pointer"
        onClick={onClose}
      />
      <div 
        className="relative z-10 bg-white rounded-[2.5rem] w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl border border-white/20 flex flex-col scale-in-center transition-transform duration-500 cursor-default"
        style={{ backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
      >
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-br from-indigo-50/50 to-purple-50/30 shrink-0">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <Edit2 size={22} className="text-indigo-600" />
              Modification Complète de l'Utilisateur
            </h2>
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
              Nom: <span className="text-indigo-600 font-extrabold">{formData.fullName || user.fullName || user.email}</span> • ID: {user.uuid.split('-')[0]}
            </p>
          </div>
          <button onClick={onClose} className="p-2.5 text-slate-400 hover:text-slate-600 rounded-2xl hover:bg-white transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-50 p-1.5 gap-1 border-b border-slate-100 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('access')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-wider rounded-2xl transition-all duration-300 ${
              activeTab === 'access'
                ? 'bg-white text-indigo-600 shadow-md shadow-indigo-100/50'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
            }`}
          >
            <Shield size={16} />
            Accès & Privilèges
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('personal')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-wider rounded-2xl transition-all duration-300 ${
              activeTab === 'personal'
                ? 'bg-white text-indigo-600 shadow-md shadow-indigo-100/50'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
            }`}
          >
            <User size={16} />
            Infos Personnelles
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bank')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-wider rounded-2xl transition-all duration-300 ${
              activeTab === 'bank'
                ? 'bg-white text-indigo-600 shadow-md shadow-indigo-100/50'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
            }`}
          >
            <CreditCard size={16} />
            RIB & Finance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('social')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-wider rounded-2xl transition-all duration-300 ${
              activeTab === 'social'
                ? 'bg-white text-indigo-600 shadow-md shadow-indigo-100/50'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
            }`}
          >
            <Globe size={16} />
            Réseaux Sociaux
          </button>
          {formData.role === 'VENDOR' && fullUser?.questionnaire && (
            <button
              type="button"
              onClick={() => setActiveTab('questionnaire')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-wider rounded-2xl transition-all duration-300 ${
                activeTab === 'questionnaire'
                  ? 'bg-white text-indigo-600 shadow-md shadow-indigo-100/50'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
              }`}
            >
              <FileText size={16} />
              Questionnaire
            </button>
          )}
        </div>

        {/* Content & Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate(formData);
          }}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
            {isUserLoading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Récupération complète des données de l'utilisateur...</p>
              </div>
            ) : (
              <>
                {/* 1. Tab: ACCESS & PRIVILEGES */}
                {activeTab === 'access' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Statut de Connexion (Compte)</label>
                        <select
                          className={`input font-bold ${formData.isActive ? 'text-green-600 bg-green-50/20' : 'text-rose-600 bg-rose-50/20'}`}
                          value={formData.isActive ? 'true' : 'false'}
                          onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'true' })}
                        >
                          <option value="true" className="text-green-600 font-bold">🟢 Actif (Accès autorisé)</option>
                          <option value="false" className="text-rose-600 font-bold">🔴 Suspendu (Accès bloqué)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Statut KYC (Vérification d'Identité)</label>
                        <select
                          className="input font-bold"
                          value={formData.kycStatus}
                          onChange={(e) => setFormData({ ...formData, kycStatus: e.target.value })}
                        >
                          <option value="PENDING">⏳ En attente (Non soumis)</option>
                          <option value="UNDER_REVIEW">🔍 En cours de révision</option>
                          <option value="APPROVED">✅ Approuvé</option>
                          <option value="REJECTED">❌ Rejeté</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Email Professionnel</label>
                        <input
                          type="email"
                          required
                          className="input"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Numéro de Téléphone</label>
                        <input
                          type="tel"
                          required
                          className="input"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Niveau de Privilège (Rôle)</label>
                        <select
                          required
                          className="input font-bold text-slate-800"
                          value={formData.role}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        >
                          <option value="VENDOR">Vendeur</option>
                          <option value="INFLUENCER">Influenceur</option>
                          <option value="GROSSELLER">Grossiste</option>
                          <option value="HELPER">Helper</option>
                          <option value="CALL_CENTER_AGENT">Agent Call Center</option>
                          <option value="CONFIRMATION_AGENT">Agent de Confirmation</option>
                          <option value="SYSTEM_SUPPORT">Agent de Support</option>
                          <option value="FINANCE_ADMIN">Admin Finance</option>
                          <option value="SUPER_ADMIN">Super Admin</option>
                        </select>
                      </div>
                    </div>

                    {/* Influencer Permissions */}
                    {formData.role === 'INFLUENCER' && (
                      <div className="mt-6 border-t border-slate-100 pt-6 space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Droits de l'Influenceur</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center justify-between p-3 bg-purple-50/50 rounded-2xl border border-purple-100/50">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-white rounded-xl text-purple-600 shadow-sm">
                                <LayoutTemplate size={16} />
                              </div>
                              <div>
                                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-tight">Constructeur de Page</h4>
                                <p className="text-[8px] font-bold text-purple-400 uppercase tracking-tighter">Autoriser la modification des landing pages</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, canManageInfluencerLinks: !formData.canManageInfluencerLinks })}
                              className={`w-10 h-5 rounded-full transition-all relative ${formData.canManageInfluencerLinks ? 'bg-purple-500' : 'bg-slate-200'}`}
                            >
                              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${formData.canManageInfluencerLinks ? 'left-[22px]' : 'left-0.5'}`} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Helper & Admin Impersonation Permissions */}
                    {formData.role === 'HELPER' && (
                      <div className="mt-6 border-t border-slate-100 pt-6 space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Droits de gestion du Helper</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center justify-between p-3 bg-orange-50/50 rounded-2xl border border-orange-100/50">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-white rounded-xl text-orange-600 shadow-sm">
                                <Package size={16} />
                              </div>
                              <div>
                                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-tight">Produits</h4>
                                <p className="text-[8px] font-bold text-orange-400 uppercase tracking-tighter">Accès catalogue</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, canManageProducts: !formData.canManageProducts })}
                              className={`w-10 h-5 rounded-full transition-all relative ${formData.canManageProducts ? 'bg-orange-500' : 'bg-slate-200'}`}
                            >
                              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${formData.canManageProducts ? 'left-[22px]' : 'left-0.5'}`} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-white rounded-xl text-blue-600 shadow-sm">
                                <Users size={16} />
                              </div>
                              <div>
                                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-tight">Leads</h4>
                                <p className="text-[8px] font-bold text-blue-400 uppercase tracking-tighter">Accès tous les leads</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, canManageLeads: !formData.canManageLeads })}
                              className={`w-10 h-5 rounded-full transition-all relative ${formData.canManageLeads ? 'bg-blue-500' : 'bg-slate-200'}`}
                            >
                              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${formData.canManageLeads ? 'left-[22px]' : 'left-0.5'}`} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-green-50/50 rounded-2xl border border-green-100/50">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-white rounded-xl text-green-600 shadow-sm">
                                <Box size={16} />
                              </div>
                              <div>
                                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-tight">Colis</h4>
                                <p className="text-[8px] font-bold text-green-400 uppercase tracking-tighter">Accès expéditions</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, canManageOrders: !formData.canManageOrders })}
                              className={`w-10 h-5 rounded-full transition-all relative ${formData.canManageOrders ? 'bg-green-500' : 'bg-slate-200'}`}
                            >
                              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${formData.canManageOrders ? 'left-[22px]' : 'left-0.5'}`} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-purple-50/50 rounded-2xl border border-purple-100/50">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-white rounded-xl text-purple-600 shadow-sm">
                                <Tag size={16} />
                              </div>
                              <div>
                                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-tight">Parrainages</h4>
                                <p className="text-[8px] font-bold text-purple-400 uppercase tracking-tighter">Gérer les liens influenceurs</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, canManageInfluencerLinks: !formData.canManageInfluencerLinks })}
                              className={`w-10 h-5 rounded-full transition-all relative ${formData.canManageInfluencerLinks ? 'bg-purple-500' : 'bg-slate-200'}`}
                            >
                              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${formData.canManageInfluencerLinks ? 'left-[22px]' : 'left-0.5'}`} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-teal-50/50 rounded-2xl border border-teal-100/50">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-white rounded-xl text-teal-600 shadow-sm">
                                <FileText size={16} />
                              </div>
                              <div>
                                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-tight">Tickets</h4>
                                <p className="text-[8px] font-bold text-teal-400 uppercase tracking-tighter">Support & Étiquettes</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, canManageTickets: !formData.canManageTickets })}
                              className={`w-10 h-5 rounded-full transition-all relative ${formData.canManageTickets ? 'bg-teal-500' : 'bg-slate-200'}`}
                            >
                              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${formData.canManageTickets ? 'left-[22px]' : 'left-0.5'}`} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-white rounded-xl text-indigo-600 shadow-sm">
                                <ScanLine size={16} />
                              </div>
                              <div>
                                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-tight">Scanner Retour</h4>
                                <p className="text-[8px] font-bold text-indigo-400 uppercase tracking-tighter">Scanner les colis retournés</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, canScanReturns: !formData.canScanReturns })}
                              className={`w-10 h-5 rounded-full transition-all relative ${formData.canScanReturns ? 'bg-indigo-500' : 'bg-slate-200'}`}
                            >
                              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${formData.canScanReturns ? 'left-[22px]' : 'left-0.5'}`} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-rose-50/50 rounded-2xl border border-rose-100/50">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-white rounded-xl text-rose-600 shadow-sm">
                                <LayoutDashboard size={16} />
                              </div>
                              <div>
                                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-tight">Tableau de bord</h4>
                                <p className="text-[8px] font-bold text-rose-400 uppercase tracking-tighter">Afficher sur le Tableau de bord</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, canDisplayOnDashboard: !formData.canDisplayOnDashboard })}
                              className={`w-10 h-5 rounded-full transition-all relative ${formData.canDisplayOnDashboard ? 'bg-rose-500' : 'bg-slate-200'}`}
                            >
                              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${formData.canDisplayOnDashboard ? 'left-[22px]' : 'left-0.5'}`} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-amber-50/50 rounded-2xl border border-amber-100/50">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-white rounded-xl text-amber-600 shadow-sm">
                                <Link size={16} />
                              </div>
                              <div>
                                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-tight">Accès Affiliation</h4>
                                <p className="text-[8px] font-bold text-amber-500 uppercase tracking-tighter">Générer lien & parrainer</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, canManageAffiliateInvites: !formData.canManageAffiliateInvites })}
                              className={`w-10 h-5 rounded-full transition-all relative ${formData.canManageAffiliateInvites ? 'bg-amber-500' : 'bg-slate-200'}`}
                            >
                              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${formData.canManageAffiliateInvites ? 'left-[22px]' : 'left-0.5'}`} />
                            </button>
                          </div>

                          <div className="col-span-2 p-4 bg-amber-50 rounded-2xl border border-amber-200/60 mt-2">
                            <label className="block text-[10px] font-black text-amber-800 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                              <Percent size={14} className="text-amber-600" />
                              Commission Helper par Lead Livré (DH)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={formData.helperCommissionPerDeliveredLead}
                              onChange={(e) => setFormData({ ...formData, helperCommissionPerDeliveredLead: parseFloat(e.target.value) || 0 })}
                              className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                              placeholder="Ex: 5"
                            />
                            <p className="text-[9px] font-medium text-amber-700 mt-1">
                              Montant en DH attribué au Helper pour chaque lead livré généré par ses comptes parrainés.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {(formData.role === 'HELPER' || formData.role === 'SUPER_ADMIN') && (
                      <div className="mt-4 flex items-center justify-between p-3 bg-rose-50/50 rounded-2xl border border-rose-100/50">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-white rounded-xl text-rose-600 shadow-sm">
                            <Shield size={16} />
                          </div>
                          <div>
                            <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-tight">Assistance Spéciale</h4>
                            <p className="text-[8px] font-bold text-rose-400 uppercase tracking-tighter">Autoriser la connexion sous l'identité d'autres utilisateurs (Impersonation)</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, canImpersonate: !formData.canImpersonate })}
                          className={`w-10 h-5 rounded-full transition-all relative ${formData.canImpersonate ? 'bg-rose-500' : 'bg-slate-200'}`}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${formData.canImpersonate ? 'left-[22px]' : 'left-0.5'}`} />
                        </button>
                      </div>
                    )}

                    {formData.role === 'CALL_CENTER_AGENT' && (
                      <div className="mt-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                        <label className="block text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                          <CreditCard size={14} />
                          Frais de Saisie par Lead (MAD)
                        </label>
                        <p className="text-[10px] text-indigo-400 font-bold mb-3">Ce montant sera facturé au vendeur à chaque fois que cet agent saisit un de ses leads.</p>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          required
                          className="input border-indigo-200 focus:border-indigo-400 bg-white"
                          value={formData.saisieFeeMad}
                          onChange={(e) => setFormData({ ...formData, saisieFeeMad: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Tab: PERSONAL INFO */}
                {activeTab === 'personal' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nom Complet</label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            className="input pl-11"
                            value={formData.fullName}
                            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                          />
                          <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">CIN (N° Carte d'Identité)</label>
                        <div className="relative">
                          <input
                            type="text"
                            className="input pl-11"
                            placeholder="Ex: AB123456"
                            value={formData.cinNumber}
                            onChange={(e) => setFormData({ ...formData, cinNumber: e.target.value })}
                          />
                          <CreditCard size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Date de Naissance</label>
                        <div className="relative">
                          <input
                            type="date"
                            className="input pl-11"
                            value={formData.birthDate}
                            onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                          />
                          <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ville</label>
                        <div className="relative">
                          <input
                            type="text"
                            className="input pl-11"
                            placeholder="Ex: Casablanca"
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          />
                          <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Langue Préférée</label>
                        <div className="relative">
                          <select
                            className="input pl-11 font-bold text-slate-800"
                            value={formData.language}
                            onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                          >
                            <option value="fr">Français (FR)</option>
                            <option value="ar">العربية (AR)</option>
                            <option value="en">English (EN)</option>
                          </select>
                          <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        </div>
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Adresse Complète</label>
                        <div className="relative">
                          <textarea
                            rows={2}
                            className="input pl-11 pt-3 resize-none"
                            placeholder="Ex: 12 Rue de la Liberté, Appt 5..."
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          />
                          <MapPin size={18} className="absolute left-4 top-4 text-slate-300" />
                        </div>
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">URL Avatar (Image de Profil)</label>
                        <div className="relative">
                          <input
                            type="text"
                            className="input pl-11"
                            placeholder="Ex: https://..."
                            value={formData.avatarUrl}
                            onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                          />
                          <Camera size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        </div>
                      </div>
                    </div>

                    {/* KYC Documents Panel inside Edit Modal */}
                    {fullUser?.kycDocuments && fullUser.kycDocuments.length > 0 && (
                      <div className="mt-6 border-t border-slate-100 pt-6">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Documents d'Identité Chargés (KYC)</h4>
                        <div className="grid grid-cols-2 gap-4">
                          {fullUser.kycDocuments.map((doc: any) => {
                            const isImage = /\.(jpg|jpeg|png|webp)$/i.test(doc.documentUrl);
                            return (
                              <div key={doc.id} className="p-4 bg-slate-50 border border-slate-100 rounded-3xl flex flex-col gap-3 group relative overflow-hidden">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-[10px] font-black text-slate-700 tracking-tight uppercase">{doc.documentType}</p>
                                    <p className="text-[8px] font-bold text-slate-400 tracking-widest uppercase mt-0.5">Statut: {doc.status}</p>
                                  </div>
                                  <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${
                                    doc.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {doc.status}
                                  </span>
                                </div>
                                {isImage ? (
                                  <div className="relative w-full h-32 bg-slate-200 rounded-2xl overflow-hidden cursor-pointer" onClick={() => setPreviewImage(doc.documentUrl)}>
                                    <img src={doc.documentUrl} alt={doc.documentType} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" />
                                    <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-slate-900/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                                      <p className="text-[10px] font-black text-white uppercase tracking-wider bg-slate-900/60 px-3 py-1.5 rounded-xl backdrop-blur-sm">Agrandir 🔍</p>
                                    </div>
                                  </div>
                                ) : (
                                  <a
                                    href={doc.documentUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="h-32 bg-white border border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-2 text-primary-600 hover:text-primary-800 transition-colors"
                                  >
                                    <FileText size={32} />
                                    <span className="text-[10px] font-black tracking-wider uppercase">Ouvrir le Document</span>
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Tab: BANK & FINANCE */}
                {activeTab === 'bank' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">RIB (Relevé d'Identité Bancaire - 24 Chiffres)</label>
                        <div className="relative">
                          <input
                            type="text"
                            maxLength={24}
                            className="input pl-11 tracking-wider font-mono font-bold"
                            placeholder="Ex: 011780000012345678901234"
                            value={formData.ribAccount}
                            onChange={(e) => setFormData({ ...formData, ribAccount: e.target.value.replace(/\s/g, '') })}
                          />
                          <CreditCard size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nom de la Banque</label>
                        <div className="relative">
                          <input
                            type="text"
                            className="input pl-11 font-bold text-slate-800"
                            placeholder="Ex: Attijariwafa Bank"
                            value={formData.bankName}
                            onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                          />
                          <Landmark size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Statut du Compte Bancaire</label>
                        <div className="relative">
                          <select
                            className="input pl-11 font-bold text-slate-800"
                            value={formData.bankStatus}
                            onChange={(e) => setFormData({ ...formData, bankStatus: e.target.value })}
                          >
                            <option value="PENDING">⏳ En Attente d'Approbation</option>
                            <option value="APPROVED">✅ Approuvé</option>
                            <option value="REJECTED">❌ Rejeté</option>
                          </select>
                          <ShieldAlert size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        </div>
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">N° ICE (Identifiant Commun de l'Entreprise)</label>
                        <div className="relative">
                          <input
                            type="text"
                            className="input pl-11 font-bold text-slate-800"
                            placeholder="Ex: 001567894000089"
                            value={formData.iceNumber}
                            onChange={(e) => setFormData({ ...formData, iceNumber: e.target.value })}
                          />
                          <FileText size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        </div>
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Frais de Plateforme (%)</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            className="input pl-11 font-bold text-slate-800"
                            placeholder="Par défaut: 13%"
                            value={formData.platformFeeRate !== undefined ? Math.round(formData.platformFeeRate * 1000) / 10 : ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setFormData({ ...formData, platformFeeRate: isNaN(val) ? 0.13 : val / 100 });
                            }}
                          />
                          <Percent size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Tab: SOCIAL MEDIA USERNAMES */}
                {activeTab === 'social' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Comptes sur les Réseaux Sociaux (Généralement pour les Influenceurs)</p>
                    
                    <div className="space-y-6">
                      {/* Instagram */}
                      <div className="p-4 rounded-3xl bg-pink-50/20 border border-pink-100/50 space-y-4">
                        <div className="flex items-center gap-2 text-pink-600 font-extrabold text-xs">
                          <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                          Instagram
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Nom d'utilisateur / @</label>
                            <div className="relative">
                              <input
                                type="text"
                                className="input pl-11 border-pink-100 focus:border-pink-400 font-bold"
                                placeholder="velora_maison1"
                                value={formData.instagramUsername}
                                onChange={(e) => setFormData({ ...formData, instagramUsername: e.target.value })}
                              />
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-400 font-black text-sm">@</span>
                            </div>
                            {formData.instagramUsername && (formData.instagramUsername.startsWith('http://') || formData.instagramUsername.startsWith('https://')) && (
                              <div className="mt-1.5 text-[9px] text-pink-600 font-black bg-white/80 p-1.5 rounded-lg border border-pink-100 flex flex-col gap-0.5">
                                <span>⚠️ Lien détecté au lieu du username !</span>
                                <span>Username extrait: <strong className="font-extrabold text-pink-700">@{parseSocialInput(formData.instagramUsername, 'instagram').username}</strong></span>
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Lien Direct / URL (Optionnel)</label>
                            <div className="relative">
                              <input
                                type="url"
                                className="input pl-11 border-pink-100 focus:border-pink-400 text-xs font-semibold"
                                placeholder="https://instagram.com/velora_maison1"
                                value={formData.instagramUrl}
                                onChange={(e) => setFormData({ ...formData, instagramUrl: e.target.value })}
                              />
                              <Link size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-300" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* TikTok */}
                      <div className="p-4 rounded-3xl bg-slate-50 border border-slate-200/60 space-y-4">
                        <div className="flex items-center gap-2 text-slate-800 font-extrabold text-xs">
                          <span className="w-2 h-2 rounded-full bg-slate-800 animate-pulse" />
                          TikTok
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Nom d'utilisateur / @</label>
                            <div className="relative">
                              <input
                                type="text"
                                className="input pl-11 border-slate-200 focus:border-slate-800 font-bold"
                                placeholder="username"
                                value={formData.tiktokUsername}
                                onChange={(e) => setFormData({ ...formData, tiktokUsername: e.target.value })}
                              />
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">@</span>
                            </div>
                            {formData.tiktokUsername && (formData.tiktokUsername.startsWith('http://') || formData.tiktokUsername.startsWith('https://')) && (
                              <div className="mt-1.5 text-[9px] text-slate-600 font-black bg-white/80 p-1.5 rounded-lg border border-slate-200 flex flex-col gap-0.5">
                                <span>⚠️ Lien détecté au lieu du username !</span>
                                <span>Username extrait: <strong className="font-extrabold text-slate-800">@{parseSocialInput(formData.tiktokUsername, 'tiktok').username}</strong></span>
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Lien Direct / URL (Optionnel)</label>
                            <div className="relative">
                              <input
                                type="url"
                                className="input pl-11 border-slate-200 focus:border-slate-800 text-xs font-semibold"
                                placeholder="https://tiktok.com/@username"
                                value={formData.tiktokUrl}
                                onChange={(e) => setFormData({ ...formData, tiktokUrl: e.target.value })}
                              />
                              <Link size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Facebook */}
                      <div className="p-4 rounded-3xl bg-blue-50/20 border border-blue-100/50 space-y-4">
                        <div className="flex items-center gap-2 text-blue-600 font-extrabold text-xs">
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                          Facebook
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Nom d'utilisateur / Page</label>
                            <div className="relative">
                              <input
                                type="text"
                                className="input pl-11 border-blue-100 focus:border-blue-500 font-bold"
                                placeholder="page_name"
                                value={formData.facebookUsername}
                                onChange={(e) => setFormData({ ...formData, facebookUsername: e.target.value })}
                              />
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 font-black text-sm">f</span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Lien Direct / URL (Optionnel)</label>
                            <div className="relative">
                              <input
                                type="url"
                                className="input pl-11 border-blue-100 focus:border-blue-500 text-xs font-semibold"
                                placeholder="https://facebook.com/username"
                                value={formData.facebookUrl}
                                onChange={(e) => setFormData({ ...formData, facebookUrl: e.target.value })}
                              />
                              <Link size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* YouTube */}
                      <div className="p-4 rounded-3xl bg-rose-50/20 border border-rose-100/50 space-y-4">
                        <div className="flex items-center gap-2 text-rose-600 font-extrabold text-xs">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                          YouTube
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Nom d'utilisateur / Chaîne</label>
                            <div className="relative">
                              <input
                                type="text"
                                className="input pl-11 border-rose-100 focus:border-rose-400 font-bold"
                                placeholder="@channel"
                                value={formData.youtubeUsername}
                                onChange={(e) => setFormData({ ...formData, youtubeUsername: e.target.value })}
                              />
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-400 font-black text-sm">@</span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Lien Direct / URL (Optionnel)</label>
                            <div className="relative">
                              <input
                                type="url"
                                className="input pl-11 border-rose-100 focus:border-rose-400 text-xs font-semibold"
                                placeholder="https://youtube.com/@channel"
                                value={formData.youtubeUrl}
                                onChange={(e) => setFormData({ ...formData, youtubeUrl: e.target.value })}
                              />
                              <Link size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-300" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Snapchat */}
                      <div className="p-4 rounded-3xl bg-yellow-50/20 border border-yellow-100/50 space-y-4">
                        <div className="flex items-center gap-2 text-yellow-600 font-extrabold text-xs">
                          <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                          Snapchat
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Nom d'utilisateur</label>
                            <div className="relative">
                              <input
                                type="text"
                                className="input pl-11 border-yellow-100 focus:border-yellow-400 font-bold"
                                placeholder="username"
                                value={formData.snapchatUsername}
                                onChange={(e) => setFormData({ ...formData, snapchatUsername: e.target.value })}
                              />
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-500 font-black text-sm">👻</span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Lien Direct / URL (Optionnel)</label>
                            <div className="relative">
                              <input
                                type="url"
                                className="input pl-11 border-yellow-100 focus:border-yellow-400 text-xs font-semibold"
                                placeholder="https://snapchat.com/add/username"
                                value={formData.snapchatUrl}
                                onChange={(e) => setFormData({ ...formData, snapchatUrl: e.target.value })}
                              />
                              <Link size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-300" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. Tab: QUESTIONNAIRE */}
                {activeTab === 'questionnaire' && fullUser?.questionnaire && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-indigo-50/30 border border-indigo-100 rounded-3xl p-5 mb-4">
                      <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider mb-1 flex items-center gap-2">
                        <FileText size={18} className="text-indigo-600" />
                        Réponses de l'Onboarding Vendeur
                      </h4>
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                        Soumis lors de l'inscription pour évaluer l'activité du e-commerçant.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Q1: sellingOnline */}
                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col justify-between">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">1. Vente en ligne active ?</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${
                            fullUser.questionnaire.sellingOnline === 'YES'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}>
                            {fullUser.questionnaire.sellingOnline === 'YES' ? 'Oui' : 'Non'}
                          </span>
                        </div>
                      </div>

                      {/* Q2: budget */}
                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col justify-between">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">2. Budget sourcing mensuel</span>
                        <span className="text-xs font-bold text-slate-800">{fullUser.questionnaire.budget || 'Non spécifié'}</span>
                      </div>

                      {/* Q3: ordersPerDay */}
                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col justify-between">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">3. Commandes par jour</span>
                        <span className="text-xs font-bold text-slate-800">{fullUser.questionnaire.ordersPerDay || 'Non spécifié'}</span>
                      </div>

                      {/* Q4: experienceYears */}
                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col justify-between">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">4. Années d'expérience</span>
                        <span className="text-xs font-bold text-slate-800">{fullUser.questionnaire.experienceYears || 'Non spécifié'}</span>
                      </div>

                      {/* Q5: markets */}
                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col justify-between col-span-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">5. Marchés cibles</span>
                        <div className="flex flex-wrap gap-1.5">
                          {Array.isArray(fullUser.questionnaire.markets) && fullUser.questionnaire.markets.length > 0 ? (
                            fullUser.questionnaire.markets.map((m: string) => (
                              <span key={m} className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg">
                                {m}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400">Aucun marché spécifié</span>
                          )}
                        </div>
                      </div>

                      {/* Q6: totalSpend */}
                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col justify-between">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">6. Dépenses publicitaires totales</span>
                        <span className="text-xs font-bold text-slate-800">{fullUser.questionnaire.totalSpend || 'Non spécifié'}</span>
                      </div>

                      {/* Q7: niches */}
                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col justify-between col-span-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">7. Niches d'intérêt</span>
                        <div className="flex flex-wrap gap-1.5">
                          {Array.isArray(fullUser.questionnaire.niches) && fullUser.questionnaire.niches.length > 0 ? (
                            fullUser.questionnaire.niches.map((n: string) => (
                              <span key={n} className="text-[10px] font-bold px-2 py-0.5 bg-purple-50 border border-purple-100 text-purple-700 rounded-lg">
                                {n}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400">Aucune niche spécifiée</span>
                          )}
                        </div>
                      </div>

                      {/* Q8: biggestAchievement */}
                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl col-span-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">8. Plus grande réussite</span>
                        <p className="text-xs text-slate-700 font-medium whitespace-pre-line bg-white p-3 rounded-xl border border-slate-100">
                          {fullUser.questionnaire.biggestAchievement || 'Non spécifié'}
                        </p>
                      </div>

                      {/* Q9: biggestChallenge */}
                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl col-span-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">9. Plus grand défi actuel</span>
                        <p className="text-xs text-slate-700 font-medium whitespace-pre-line bg-white p-3 rounded-xl border border-slate-100">
                          {fullUser.questionnaire.biggestChallenge || 'Non spécifié'}
                        </p>
                      </div>

                      {/* Q10: partnerPriorities */}
                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col justify-between col-span-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">10. Priorités chez un partenaire</span>
                        <div className="flex flex-wrap gap-1.5">
                          {Array.isArray(fullUser.questionnaire.partnerPriorities) && fullUser.questionnaire.partnerPriorities.length > 0 ? (
                            fullUser.questionnaire.partnerPriorities.map((p: string) => (
                              <span key={p} className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 border border-amber-100 text-amber-700 rounded-lg">
                                {p}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400">Aucune priorité spécifiée</span>
                          )}
                        </div>
                      </div>

                      {/* Q11: interviewAvailability */}
                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col justify-between">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">11. Disponibilité appel court</span>
                        <span className="text-xs font-bold text-slate-800">{fullUser.questionnaire.interviewAvailability || 'Non spécifié'}</span>
                      </div>

                      {/* Q12: additionalNotes */}
                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl col-span-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">12. Remarques additionnelles</span>
                        <p className="text-xs text-slate-700 font-medium whitespace-pre-line bg-white p-3 rounded-xl border border-slate-100">
                          {fullUser.questionnaire.additionalNotes || 'Aucune remarque'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="p-6 border-t border-slate-100 flex gap-4 shrink-0 bg-slate-50/50">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 bg-white border border-slate-100 rounded-2xl transition-all shadow-sm"
            >
              Fermer
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending || isUserLoading}
              className="flex-[2] px-6 py-3.5 text-xs font-black uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-lg shadow-indigo-200/50 transition-all disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Mise à jour en cours...' : 'Sauvegarder les Modifications'}
            </button>
          </div>
        </form>
      </div>

      {/* KYC Document Fullscreen Zoom Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-4xl max-h-[85vh] overflow-hidden rounded-[2rem] bg-white border border-white/20 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button className="absolute right-4 top-4 p-2 bg-slate-900/60 text-white rounded-full hover:bg-slate-900 transition-colors z-10" onClick={() => setPreviewImage(null)}>
              <X size={20} />
            </button>
            <img src={previewImage} alt="Document KYC Agrandissement" className="w-full h-full object-contain max-h-[85vh] rounded-[2rem]" />
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

export default function AdminUsers() {
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const day = date.getDate();
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${month}/${day}/${year} à ${hours}:${minutes}`;
    } catch (e) {
      return dateString;
    }
  };

  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [assigningAgent, setAssigningAgent] = useState<any>(null);
  const [assigningHelper, setAssigningHelper] = useState<any>(null);
  const [tempUserForReset, setTempUserForReset] = useState<any>(null);
  const [confirmResetPasswordUser, setConfirmResetPasswordUser] = useState<any>(null);
  const [generatedPasswordData, setGeneratedPasswordData] = useState<{password: string, user: any} | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<any>(null);
  const queryClient = useQueryClient();
  const { impersonate } = useAuth();
  const [impersonatingId, setImpersonatingId] = useState<number | null>(null);

  const handleImpersonate = async (userId: number, roleName: string) => {
    if (roleName === 'SUPER_ADMIN') {
      toast.error("Vous ne pouvez pas vous connecter en tant que Super Admin.");
      return;
    }
    
    setImpersonatingId(userId);
    try {
      await impersonate(userId);
      toast.success("Connexion réussie en mode assistance.");
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la connexion');
      setImpersonatingId(null);
    }
  };

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [roleFilter, search]);

  const { data, isLoading } = useQuery({
    queryKey: ['users', { role: roleFilter, search, page, limit }],
    queryFn: () => adminApi.users({ 
      role: roleFilter || undefined, 
      search: search || undefined,
      page,
      limit
    }),
  });

  const users = data?.data?.data?.users || [];
  const pagination = data?.data?.data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const { data: countsData } = useQuery({
    queryKey: ['userRoleCounts'],
    queryFn: () => adminApi.getRoleCounts(),
  });

  const roleCounts = countsData?.data?.data || {};

  const activateMutation = useMutation({
    mutationFn: (uuid: string) => adminApi.activateUser(uuid),
    onSuccess: () => {
      toast.success('Utilisateur activé!');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['userRoleCounts'] });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (uuid: string) => adminApi.deactivateUser(uuid),
    onSuccess: () => {
      toast.success('Utilisateur désactivé!');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['userRoleCounts'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (uuid: string) => adminApi.deleteUser(uuid),
    onSuccess: () => {
      toast.success('Compte supprimé avec succès!');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['userRoleCounts'] });
      setConfirmDeleteUser(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Erreur lors de la suppression');
      setConfirmDeleteUser(null);
    }
  });

  const reset2FAMutation = useMutation({
    mutationFn: (uuid: string) => adminApi.reset2FA(uuid),
    onSuccess: (res) => {
      toast.success(res.data?.message || '2FA réinitialisée avec succès!');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['userRoleCounts'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Erreur lors de la réinitialisation de la 2FA');
    }
  });

  const sendPwResetMutation = useMutation({
    mutationFn: (uuid: string) => adminApi.sendPasswordResetLink(uuid),
    onSuccess: (res) => {
      if (res.data?.data?.tempPassword && tempUserForReset) {
        setGeneratedPasswordData({ password: res.data.data.tempPassword, user: tempUserForReset });
        setTempUserForReset(null);
      } else {
        toast.success(res.data?.message || 'Mot de passe généré !');
      }
    },
    onError: (err: any) => {
      setTempUserForReset(null);
      toast.error(err.response?.data?.message || 'Erreur lors de la génération');
    }
  });

  const kycColors: Record<string, string> = {
    PENDING: 'amber',
    UNDER_REVIEW: 'indigo',
    APPROVED: 'emerald',
    REJECTED: 'rose',
  };

  return (
    <div className="space-y-4 sm:space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-1000 ease-out overflow-x-hidden">
      {/* Premium Header Banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-[2.5rem] bg-[#2c2f74] p-5 sm:p-10 text-white shadow-2xl shadow-primary-200/50">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 sm:gap-8">
          <div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight">Gestion des Profils <span className="text-primary-400">🛡️</span></h1>
            <p className="text-primary-100/70 font-medium text-sm sm:text-lg mt-2 max-w-xl">
              Supervisez les accès, gérez les permissions et assurez la sécurité de l'écosystème SILACOD. Connectez-vous à n'importe quel compte pour l'assister.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3 sm:gap-4">
            <div className="px-4 sm:px-6 py-3 sm:py-4 bg-white/10 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-white/10 flex flex-col items-center">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest opacity-60">Total</span>
              <span className="text-xl sm:text-2xl font-black">{pagination.total}</span>
            </div>
            <div className="px-4 sm:px-6 py-3 sm:py-4 bg-emerald-500/20 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-emerald-500/20 flex flex-col items-center">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-emerald-300">Actifs</span>
              <span className="text-xl sm:text-2xl font-black text-emerald-400">{users.filter((u: any) => u.isActive).length}</span>
            </div>
            <button
               onClick={() => setIsAddModalOpen(true)}
               className="bg-white text-primary-900 group py-3 sm:py-4 px-5 sm:px-8 rounded-2xl sm:rounded-3xl font-black text-xs sm:text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/20 flex items-center justify-center gap-2 sm:gap-3 whitespace-nowrap"
            >
              <UserPlus size={18} className="group-hover:rotate-12 transition-transform" />
              Ajouter
            </button>
          </div>
        </div>
        
        {/* Background Particles Decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-400/10 rounded-full blur-3xl -mr-20 -mt-20" />
      </div>

      <div className="space-y-8">
        {/* Top Demandes Alert banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-5 bg-[#2c2f74]/5 border border-[#2c2f74]/10 rounded-2xl sm:rounded-[2rem] gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#2c2f74]/10 text-[#2c2f74] flex items-center justify-center shrink-0">
              <Clock size={24} className="text-[#2c2f74]" />
            </div>
            <div>
              <h4 className="text-xs font-black text-[#2c2f74] uppercase tracking-widest">Statistiques & Alertes</h4>
              <p className="text-sm font-bold text-slate-600 mt-0.5 leading-relaxed">
                Des demandes de KYC sont actuellement en attente de vérification par un administrateur.
              </p>
            </div>
          </div>
          <button
            onClick={() => setRoleFilter('')}
            className="text-xs font-black text-[#2c2f74] uppercase tracking-widest hover:underline px-5 py-3 bg-[#2c2f74]/5 hover:bg-[#2c2f74]/10 rounded-2xl transition-all whitespace-nowrap"
          >
            Voir les demandes
          </button>
        </div>

        {/* Main Content Area: Sidebar + Table */}
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 lg:items-start">
          
          {/* Left Sidebar Filter Panel */}
          <div className="w-full lg:w-72 xl:w-80 flex-shrink-0">
            <div className="bento-card border-none bg-white p-4 sm:p-6 space-y-6 lg:space-y-8 shadow-sm lg:sticky lg:top-8">
              
              {/* Search */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Search size={14} />
                  Filtre de recherche
                </h3>
                <div className="relative group">
                  <input
                    type="text"
                    className="input pl-11 h-12 bg-slate-50 border-slate-100 group-focus-within:bg-white transition-all shadow-inner w-full text-sm"
                    placeholder="Nom, Email, ID, Rôle..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#2c2f74] transition-colors" />
                </div>
              </div>

              {/* Elements Per Page */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Affichage</h3>
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 shadow-inner">
                  <span className="text-xs font-black text-[#2c2f74] uppercase tracking-widest">AFFICHER :</span>
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                    className="bg-transparent text-sm font-black text-[#2c2f74] focus:outline-none cursor-pointer flex-1 text-right pr-4"
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              {/* Roles Category */}
              <div className="space-y-3 pt-6 border-t border-slate-100">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-4">
                  <Filter size={14} />
                  Rôles d'utilisateurs
                </h3>
                <div className="flex flex-row overflow-x-auto lg:overflow-visible lg:flex-col gap-2 pb-4 lg:pb-0 snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {[
                    { key: '', label: 'TOUS LES ACCÈS', countKey: 'TOTAL' },
                    { key: 'VENDOR', label: 'Vendeur', countKey: 'VENDOR' },
                    { key: 'CALL_CENTER_AGENT', label: 'Call Center', countKey: 'CALL_CENTER_AGENT' },
                    { key: 'CONFIRMATION_AGENT', label: 'Confirmation', countKey: 'CONFIRMATION_AGENT' },
                    { key: 'INFLUENCER', label: 'Influenceur', countKey: 'INFLUENCER' },
                    { key: 'HELPER', label: 'Helper', countKey: 'HELPER' },
                    { key: 'SYSTEM_SUPPORT', label: 'Support', countKey: 'SYSTEM_SUPPORT' },
                    { key: 'SUPER_ADMIN', label: 'Admin', countKey: 'SUPER_ADMIN' },
                  ].map((role) => {
                    const count = roleCounts[role.countKey] || 0;
                    return (
                      <button
                        key={role.key}
                        onClick={() => setRoleFilter(role.key)}
                        className={`flex-shrink-0 snap-start lg:w-full px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-4 justify-between border ${
                          roleFilter === role.key 
                            ? 'bg-[#2c2f74] text-white border-[#2c2f74] shadow-md shadow-[#2c2f74]/25 scale-[1.02] z-10' 
                            : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                        }`}
                      >
                        <span className="truncate whitespace-nowrap">{role.label}</span>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-tight shrink-0 ${
                          roleFilter === role.key
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>

        {/* Users Table Area */}
        <div className="w-full lg:flex-1 min-w-0 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-40">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin" />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Initialisation de la base...</p>
                </div>
            </div>
          ) : (
            <div className="bg-white w-full rounded-2xl sm:rounded-3xl border-none shadow-xl overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 14rem)' }}>
              <div className="overflow-auto flex-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-slate-50 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                
                {/* ── Mobile Card View ── */}
                <div className="block lg:hidden divide-y divide-slate-100">
                  {users.map((user: any) => (
                    <div key={user.uuid} className="p-4 space-y-3 hover:bg-slate-50/50 transition-colors">
                      {/* Top: Avatar + Name + Status */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <span className="text-slate-500 font-black text-sm uppercase">{user.fullName?.charAt(0) || '?'}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-black text-slate-900 text-sm tracking-tight uppercase truncate">{user.fullName || 'N/A'}</p>
                              {user.autoAssignInfluencers && (
                                <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 text-[7px] font-black uppercase rounded-full border border-indigo-200 shrink-0">✨</span>
                              )}
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 truncate">{user.email || 'Pas d\'email'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className={`w-2 h-2 rounded-full ${
                            user.isActive 
                              ? 'bg-emerald-500' 
                              : (user.kycStatus === 'PENDING' || user.kycStatus === 'UNDER_REVIEW' ? 'bg-amber-400' : 'bg-rose-400')
                          }`} />
                          <span className={`text-[10px] font-black uppercase ${
                            user.isActive 
                              ? 'text-emerald-600' 
                              : (user.kycStatus === 'PENDING' || user.kycStatus === 'UNDER_REVIEW' ? 'text-amber-500' : 'text-rose-500')
                          }`}>
                            {user.isActive 
                              ? 'Actif' 
                              : (user.kycStatus === 'PENDING' || user.kycStatus === 'UNDER_REVIEW' ? 'En attente' : 'Off')}
                          </span>
                        </div>
                      </div>
                      
                      {/* Domains */}
                      {(user.subdomain || user.customDomain) && (
                        <div className="bg-slate-50 rounded-xl p-2.5 space-y-1.5 text-[11px] border border-slate-100/50">
                          {user.subdomain && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-400 uppercase tracking-widest text-[8px]">Sous-domaine:</span>
                              <a 
                                href={`https://${user.subdomain}.silacod.com`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="font-semibold text-indigo-600 hover:underline"
                              >
                                {user.subdomain}.silacod.com
                              </a>
                            </div>
                          )}
                          {user.customDomain && (
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="font-bold text-slate-400 uppercase tracking-widest text-[8px]">Domaine Perso:</span>
                              <div className="flex items-center gap-1.5">
                                <a 
                                  href={`https://${user.customDomain}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="font-mono font-bold text-slate-800 hover:underline"
                                >
                                  {user.customDomain}
                                </a>
                                <span className={`px-1 py-0.5 rounded text-[8px] font-black uppercase ${
                                  user.customDomainStatus === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                                  user.customDomainStatus === 'FAILED' ? 'bg-rose-100 text-rose-700' :
                                  'bg-amber-100 text-amber-700'
                                }`}>
                                  {user.customDomainStatus === 'ACTIVE' ? 'Vérifié' :
                                   user.customDomainStatus === 'FAILED' ? 'Échoué' :
                                   'Attente'}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Middle: Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase border ${
                          user.kycStatus === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                          user.kycStatus === 'PENDING' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                          user.kycStatus === 'REJECTED' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                          'bg-indigo-50 text-indigo-600 border-indigo-100'
                        }`}>
                          {user.kycStatus}
                        </span>
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase border ${
                          user.cguAccepted ? 'bg-green-50 text-green-600 border-green-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                        }`}>
                          CGU: {user.cguAccepted ? 'ACCEPTÉ' : 'NON'}
                        </span>
                        <span className="px-3 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase border bg-slate-50 text-slate-500 border-slate-100/80">
                          Inscrit le: {formatDate(user.createdAt)}
                        </span>
                        {user.phone && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                            <Smartphone size={10} /> {user.phone}
                          </span>
                        )}
                      </div>

                      {/* Bottom: Actions */}
                      <div className="flex flex-col gap-2 pt-2 border-t border-slate-100/50 mt-2">
                        {/* Primary actions: Edit & Impersonate */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingUser(user)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-500 hover:text-primary-600 hover:bg-primary-50 text-[10px] font-black uppercase tracking-wider transition-all"
                          >
                            <Edit2 size={13} /> Modifier
                          </button>
                          {user.role !== 'SUPER_ADMIN' && (
                            <button
                              onClick={() => handleImpersonate(user.id, user.role)}
                              disabled={impersonatingId === user.id}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white text-[10px] font-black uppercase tracking-wider transition-all"
                              title="Se connecter"
                            >
                              {impersonatingId === user.id ? <Loader2 size={13} className="animate-spin" /> : <LogIn size={13} />}
                              Assister
                            </button>
                          )}
                        </div>

                        {/* Secondary actions: Power toggle, Assign, and security buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => user.isActive ? deactivateMutation.mutate(user.uuid) : activateMutation.mutate(user.uuid)}
                            className={`flex-1 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                              user.isActive 
                                ? 'bg-rose-50 border-rose-100 text-rose-500 hover:bg-rose-100/50' 
                                : 'bg-emerald-50 border-emerald-100 text-emerald-500 hover:bg-emerald-100/50'
                            }`}
                          >
                            <Power size={13} /> {user.isActive ? 'Suspendre' : 'Activer'}
                          </button>
                          {user.role === 'CALL_CENTER_AGENT' && (
                            <button 
                              onClick={() => setAssigningAgent(user)} 
                              className="py-2 px-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-all flex items-center justify-center shrink-0" 
                              title="Assigner Influenceurs & Vendeurs"
                            >
                              <Users size={13} />
                            </button>
                          )}
                          {user.role === 'HELPER' && (
                            <button 
                              onClick={() => setAssigningHelper(user)} 
                              className="py-2 px-3 rounded-xl bg-orange-50 border border-orange-100 text-orange-500 hover:bg-orange-600 hover:text-white transition-all flex items-center justify-center shrink-0" 
                              title="Assigner"
                            >
                              <Users size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => { if (window.confirm('Réinitialiser la 2FA ?')) reset2FAMutation.mutate(user.uuid); }}
                            className="py-2 px-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-100 transition-all flex items-center justify-center shrink-0"
                            title="Reset 2FA"
                          >
                            <ShieldOff size={13} />
                          </button>
                          <button
                            onClick={() => setConfirmResetPasswordUser(user)}
                            className="py-2 px-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100 transition-all flex items-center justify-center shrink-0"
                            title="Reset password"
                          >
                            <KeyIcon size={13} />
                          </button>
                          {user.role !== 'SUPER_ADMIN' && (
                            <button
                              onClick={() => setConfirmDeleteUser(user)}
                              className="py-2 px-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-400 hover:text-white hover:bg-rose-600 hover:border-rose-600 transition-all flex items-center justify-center shrink-0"
                              title="Supprimer le compte"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── Desktop Table View ── */}
                <table className="w-full hidden lg:table">
                  <thead className="bg-slate-50/95 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-10">
                    <tr>
                      <th className="text-left py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Identité</th>
                      <th className="text-left py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact</th>
                      <th className="text-left py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Domaines</th>
                      <th className="text-left py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Privilèges</th>
                      <th className="text-left py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Confiance</th>
                      <th className="text-left py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                      <th className="text-left py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Inscrit le</th>
                      <th className="text-right py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contrôle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((user: any) => (
                      <tr key={user.uuid} className="group hover:bg-slate-50/50 transition-all duration-300">
                        <td className="py-6 px-8">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-slate-100 rounded-[1.25rem] flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:bg-primary-100 transition-all duration-500">
                              <span className="text-slate-400 group-hover:text-primary-600 font-black text-lg uppercase">{user.fullName?.charAt(0) || '?'}</span>
                            </div>
                            <div className="min-w-0">
                               <div className="flex items-center gap-2">
                                 <p className="font-black text-slate-900 text-base tracking-tight group-hover:text-primary-600 transition-colors uppercase">{user.fullName || 'N/A'}</p>
                                 {user.autoAssignInfluencers && (
                                   <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[8px] font-black uppercase tracking-widest rounded-full border border-indigo-200 animate-pulse">
                                     ✨ Global
                                   </span>
                                 )}
                               </div>
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ChevronRight size={10} /> UUID: {user.uuid.split('-')[0]}
                               </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-6 px-8 min-w-[200px]">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                               <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                                  <Mail size={12} />
                               </div>
                               <span className="text-sm font-bold text-slate-600">{user.email || 'Pas d\'email'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                               <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                                  <Smartphone size={12} />
                               </div>
                               <span className="text-xs font-bold text-slate-400">{user.phone || 'N/A'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-6 px-8">
                          <div className="space-y-1 max-w-[220px]">
                            {user.subdomain && (
                              <div className="flex flex-col">
                                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Sous-domaine</span>
                                <a 
                                  href={`https://${user.subdomain}.silacod.com`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs font-bold text-indigo-600 hover:underline truncate"
                                >
                                  {user.subdomain}.silacod.com
                                </a>
                              </div>
                            )}
                            {user.customDomain && (
                              <div className="flex flex-col pt-1 border-t border-slate-50">
                                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Perso</span>
                                <div className="flex items-center gap-1.5">
                                  <a 
                                    href={`https://${user.customDomain}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs font-mono font-bold text-slate-800 hover:underline truncate"
                                  >
                                    {user.customDomain}
                                  </a>
                                  <span className={`px-1 rounded text-[8px] font-black uppercase ${
                                    user.customDomainStatus === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                                    user.customDomainStatus === 'FAILED' ? 'bg-rose-100 text-rose-700' :
                                    'bg-amber-100 text-amber-700'
                                  }`}>
                                    {user.customDomainStatus === 'ACTIVE' ? 'V' :
                                     user.customDomainStatus === 'FAILED' ? 'X' :
                                     'P'}
                                  </span>
                                </div>
                              </div>
                            )}
                            {!user.subdomain && !user.customDomain && (
                              <span className="text-xs font-semibold text-slate-300 italic">Aucun</span>
                            )}
                          </div>
                        </td>
                        <td className="py-6 px-8">
                          <span className="inline-block px-4 py-1.5 rounded-xl bg-slate-100 text-slate-500 text-[10px] font-black tracking-[0.1em] uppercase">
                            {user.role?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-6 px-8">
                          <div className="flex flex-col gap-1.5">
                            <span className={`inline-block text-center px-3 py-1.5 rounded-xl text-[10px] font-black tracking-[0.1em] uppercase border ${
                              user.kycStatus === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                              user.kycStatus === 'PENDING' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                              user.kycStatus === 'REJECTED' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                              'bg-indigo-50 text-indigo-600 border-indigo-100'
                            }`}>
                              KYC: {user.kycStatus}
                            </span>
                            <span className={`inline-block text-center px-3 py-1.5 rounded-xl text-[10px] font-black tracking-[0.1em] uppercase border ${
                              user.cguAccepted ? 'bg-green-50 text-green-700 border-green-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                            }`}>
                              CGU: {user.cguAccepted ? 'ACCEPTÉ' : 'NON'}
                            </span>
                          </div>
                        </td>
                        <td className="py-6 px-8">
                          <div className="flex items-center gap-2">
                             <div className={`w-2 h-2 rounded-full animate-pulse ${
                               user.isActive 
                                 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' 
                                 : (user.kycStatus === 'PENDING' || user.kycStatus === 'UNDER_REVIEW' ? 'bg-amber-400' : 'bg-rose-400')
                             }`} />
                             <span className={`text-[11px] font-black uppercase tracking-widest ${
                               user.isActive 
                                 ? 'text-emerald-600' 
                                 : (user.kycStatus === 'PENDING' || user.kycStatus === 'UNDER_REVIEW' ? 'text-amber-500' : 'text-rose-500')
                             }`}>
                                {user.isActive 
                                  ? 'Opérationnel' 
                                  : (user.kycStatus === 'PENDING' || user.kycStatus === 'UNDER_REVIEW' ? 'En attente' : 'Suspendu')}
                             </span>
                          </div>
                        </td>
                        <td className="py-6 px-8 whitespace-nowrap">
                          <span className="text-xs font-bold text-slate-600">
                            {formatDate(user.createdAt)}
                          </span>
                        </td>
                        <td className="py-6 px-8 text-right">
                          <div className="flex gap-2 justify-end items-center">
                            <button
                              onClick={() => setEditingUser(user)}
                              className="w-10 h-10 rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-primary-600 hover:border-primary-100 hover:bg-primary-50 transition-all flex items-center justify-center"
                              title="Modifier"
                            >
                              <Edit2 size={18} />
                            </button>

                            {user.role !== 'SUPER_ADMIN' && (
                              <button
                                onClick={() => handleImpersonate(user.id, user.role)}
                                disabled={impersonatingId === user.id}
                                className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-500 hover:bg-indigo-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                                title="Se connecter"
                              >
                                {impersonatingId === user.id ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
                              </button>
                            )}
                            
                            {user.role === 'CALL_CENTER_AGENT' && (
                              <button
                                onClick={() => setAssigningAgent(user)}
                                className="w-10 h-10 rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-primary-600 hover:border-primary-100 hover:bg-primary-50 transition-all flex items-center justify-center"
                                title="Assigner Influenceurs & Vendeurs"
                              >
                                <Users size={18} />
                              </button>
                            )}

                            {user.role === 'HELPER' && (
                              <button
                                onClick={() => setAssigningHelper(user)}
                                className="w-10 h-10 rounded-xl bg-orange-600 border border-orange-500 text-white hover:bg-orange-700 shadow-lg shadow-orange-200 transition-all flex items-center justify-center"
                                title="Assigner Utilisateurs"
                              >
                                <Users size={18} />
                              </button>
                            )}

                            <button
                              onClick={() => user.isActive ? deactivateMutation.mutate(user.uuid) : activateMutation.mutate(user.uuid)}
                              className={`w-10 h-10 rounded-xl border transition-all flex items-center justify-center ${
                                user.isActive 
                                  ? 'bg-rose-50 border-rose-100 text-rose-500 hover:bg-rose-100' 
                                  : 'bg-emerald-50 border-emerald-100 text-emerald-500 hover:bg-emerald-100'
                              }`}
                              title={user.isActive ? 'Désactiver' : 'Réactiver'}
                            >
                              <Power size={18} />
                            </button>

                            <div className="w-px h-8 bg-slate-100 mx-2" />

                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  if (window.confirm('Voulez-vous vraiment désactiver la 2FA pour cet utilisateur ?')) {
                                    reset2FAMutation.mutate(user.uuid);
                                  }
                                }}
                                className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-100 transition-all flex items-center justify-center"
                                title="Réinitialiser 2FA"
                              >
                                <ShieldOff size={18} />
                              </button>
                              <button
                                onClick={() => setConfirmResetPasswordUser(user)}
                                className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100 transition-all flex items-center justify-center"
                                title="Générer mot de passe temporaire"
                              >
                                <KeyIcon size={18} />
                              </button>
                              {user.role !== 'SUPER_ADMIN' && (
                                <button
                                  onClick={() => setConfirmDeleteUser(user)}
                                  className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 text-rose-400 hover:text-white hover:bg-rose-600 hover:border-rose-600 transition-all flex items-center justify-center"
                                  title="Supprimer le compte"
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.total > 0 && (
                <div className="p-4 sm:p-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider text-center sm:text-left">
                      Affichage de <span className="font-extrabold text-slate-800">{users.length}</span> sur <span className="font-extrabold text-slate-800">{pagination.total}</span> utilisateur(s)
                    </p>
                    <div className="hidden sm:block h-4 w-px bg-slate-200" />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Afficher :</span>
                      <select
                        value={limit}
                        onChange={(e) => {
                          setLimit(Number(e.target.value));
                          setPage(1);
                        }}
                        className="bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
                      >
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                    <button
                      disabled={page === 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className="px-2 sm:px-4 py-2 sm:py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 bg-white border border-slate-100 rounded-xl transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 flex items-center justify-center gap-1"
                    >
                      <ChevronLeft size={16} />
                      <span className="hidden sm:inline">Précédent</span>
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => {
                        const isFirst = p === 1;
                        const isLast = p === pagination.totalPages;
                        const isNear = Math.abs(p - page) <= 1;

                        if (pagination.totalPages > 6 && !isFirst && !isLast && !isNear) {
                          if (p === 2 || p === pagination.totalPages - 1) {
                            return <span key={p} className="text-slate-400 font-bold px-1">...</span>;
                          }
                          return null;
                        }

                        return (
                          <button
                            key={p}
                            onClick={() => setPage(p)}
                            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-xs font-black transition-all flex items-center justify-center ${
                              page === p
                                ? 'bg-[#2c2f74] text-white shadow-md shadow-primary-200 scale-105'
                                : 'bg-white border border-slate-100 text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      disabled={page === pagination.totalPages}
                      onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                      className="px-2 sm:px-4 py-2 sm:py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 bg-white border border-slate-100 rounded-xl transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 flex items-center justify-center gap-1"
                    >
                      <span className="hidden sm:inline">Suivant</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {/* End of Main Content Area */}
        </div>

      </div>

      <AddUserModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />

      {editingUser && (
        <EditUserModal
          isOpen={!!editingUser}
          onClose={() => setEditingUser(null)}
          user={editingUser}
        />
      )}

      {assigningAgent && (
        <AssignInfluencersModal
          isOpen={!!assigningAgent}
          onClose={() => setAssigningAgent(null)}
          agent={assigningAgent}
        />
      )}

      {assigningHelper && (
        <AssignHelperUsersModal
          isOpen={!!assigningHelper}
          onClose={() => setAssigningHelper(null)}
          helper={assigningHelper}
        />
      )}

      {generatedPasswordData && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md cursor-pointer"
            onClick={() => setGeneratedPasswordData(null)}
          />
          <div 
            className="relative z-10 bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl border border-white/20 flex flex-col scale-in-center transition-transform duration-500 cursor-default"
            style={{ backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
          >
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-gradient-to-br from-indigo-50/50 to-purple-50/30">
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                  <KeyIcon size={24} className="text-indigo-600" />
                  Mot de passe généré
                </h2>
                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{generatedPasswordData.user.fullName || generatedPasswordData.user.email}</p>
              </div>
            </div>
            
            <div className="p-8 space-y-6 text-center">
              <p className="text-sm font-bold text-slate-600">
                Veuillez communiquer ce mot de passe temporaire à l'utilisateur. Il sera forcé de le modifier lors de sa prochaine connexion.
              </p>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 relative group">
                <p className="text-3xl font-mono font-black text-indigo-600 tracking-wider">
                  {generatedPasswordData.password}
                </p>
              </div>
            </div>

            <div className="p-8 pt-0 flex gap-4">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedPasswordData.password);
                  toast.success('Mot de passe copié !');
                }}
                className="flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-lg shadow-indigo-200/50 transition-all"
              >
                Copier
              </button>
              <button
                onClick={() => setGeneratedPasswordData(null)}
                className="flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {confirmResetPasswordUser && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md cursor-pointer"
            onClick={() => setConfirmResetPasswordUser(null)}
          />
          <div 
            className="relative z-10 bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl border border-white/20 flex flex-col scale-in-center transition-transform duration-500 cursor-default"
            style={{ backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
          >
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-gradient-to-br from-indigo-50/50 to-purple-50/30">
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                  <KeyIcon size={24} className="text-indigo-600" />
                  Réinitialiser le mot de passe
                </h2>
                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
                  {confirmResetPasswordUser.fullName || confirmResetPasswordUser.email}
                </p>
              </div>
            </div>
            
            <div className="p-8 space-y-4">
              <p className="text-sm font-bold text-slate-600 leading-relaxed text-left">
                Voulez-vous vraiment générer un nouveau mot de passe temporaire pour cet utilisateur ?
              </p>
              <p className="text-xs text-rose-500 font-semibold bg-rose-50 p-3.5 rounded-2xl border border-rose-100/50 text-left">
                ⚠️ Cette action désactivera le mot de passe actuel de l'utilisateur. Il devra utiliser le nouveau mot de passe temporaire pour se connecter et sera invité à le changer immédiatement.
              </p>
            </div>

            <div className="p-8 pt-0 flex gap-4">
              <button
                onClick={() => setConfirmResetPasswordUser(null)}
                className="flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  setTempUserForReset(confirmResetPasswordUser);
                  sendPwResetMutation.mutate(confirmResetPasswordUser.uuid);
                  setConfirmResetPasswordUser(null);
                }}
                disabled={sendPwResetMutation.isPending}
                className="flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-lg shadow-indigo-200/50 transition-all disabled:opacity-50"
              >
                {sendPwResetMutation.isPending ? 'Génération...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {confirmDeleteUser && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md cursor-pointer"
            onClick={() => setConfirmDeleteUser(null)}
          />
          <div 
            className="relative z-10 bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl border border-white/20 flex flex-col scale-in-center transition-transform duration-500 cursor-default"
            style={{ backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
          >
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-gradient-to-br from-rose-50/50 to-red-50/30">
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                  <Trash2 size={24} className="text-rose-600" />
                  Supprimer le compte
                </h2>
                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
                  {confirmDeleteUser.fullName || confirmDeleteUser.email}
                </p>
              </div>
            </div>
            
            <div className="p-8 space-y-4">
              <p className="text-sm font-bold text-slate-600 leading-relaxed text-left">
                Voulez-vous vraiment supprimer définitivement ce compte utilisateur ?
              </p>
              <p className="text-xs text-rose-500 font-semibold bg-rose-50 p-3.5 rounded-2xl border border-rose-100/50 text-left">
                ⚠️ Cette action est <strong>irréversible</strong>. Toutes les données associées à cet utilisateur seront supprimées : profil, portefeuille, commandes, leads, liens de parrainage, documents KYC, etc.
              </p>
            </div>

            <div className="p-8 pt-0 flex gap-4">
              <button
                onClick={() => setConfirmDeleteUser(null)}
                className="flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all"
              >
                Annuler
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirmDeleteUser.uuid)}
                disabled={deleteMutation.isPending}
                className="flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-white bg-rose-600 hover:bg-rose-700 rounded-2xl shadow-lg shadow-rose-200/50 transition-all disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}


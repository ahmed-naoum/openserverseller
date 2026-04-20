import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import toast from 'react-hot-toast';
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
  ChevronRight,
  Filter,
  Eye,
  EyeOff
} from 'lucide-react';

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

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2rem] w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-white/20 scale-in-center transition-transform duration-500">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-gradient-to-br from-primary-50/50 to-indigo-50/30">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <Users size={24} className="text-primary-600" />
              Assigner Influenceurs
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
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Tous les influenceurs (présents & futurs)</p>
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
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Aucun influenceur trouvé</p>
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
                    <p className="text-sm font-black tracking-tight">{inf.fullName}</p>
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
    </div>
  );
}

function AssignHelperUsersModal({ isOpen, onClose, helper }: { isOpen: boolean; onClose: () => void; helper: any }) {
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);

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
    }).catch(() => {
      toast.error('Erreur lors du chargement');
    }).finally(() => setLoading(false));
  }, [isOpen, helper]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminApi.setHelperUserAssignments(helper.id, selectedUsers);
      toast.success(`${selectedUsers.length} utilisateur(s) assigné(s) à ${helper.fullName || 'ce helper'}`);
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

  if (!isOpen || !helper) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2rem] w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-white/20 scale-in-center transition-transform duration-500">
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
              <div className="flex items-center justify-between mb-4">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {selectedUsers.length} sélectionnés
                </p>
              </div>
              {allUsers.map((u) => (
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
                    <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">{u.role} - {u.email}</p>
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
    </div>
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
      onClose();
      setFormData({ fullName: '', email: '', phone: '', password: '', role: 'VENDOR' });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur lors de la création');
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl border border-white/20">
        <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-gradient-to-br from-primary-50/50 to-indigo-50/30">
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
        
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="p-10 space-y-6">
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
          
          <div className="pt-4 flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-[2] btn-primary rounded-2xl shadow-xl shadow-primary-200/50"
            >
              {createMutation.isPending ? 'Lancement...' : 'Créer Compte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditUserModal({ isOpen, onClose, user }: { isOpen: boolean; onClose: () => void; user: any }) {
  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    role: user?.role || 'VENDOR',
    canImpersonate: user?.canImpersonate || false,
  });
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data: any) => adminApi.updateUser(user.uuid, data),
    onSuccess: () => {
      toast.success('Utilisateur mis à jour avec succès');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erreur lors de la mise à jour');
    }
  });

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl border border-white/20">
        <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-gradient-to-br from-indigo-50/50 to-purple-50/30">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <Edit2 size={24} className="text-indigo-600" />
              Éditer l'Accès
            </h2>
            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">ID: {user.uuid.split('-')[0]}</p>
          </div>
          <button onClick={onClose} className="p-3 text-slate-400 hover:text-slate-600 rounded-2xl hover:bg-white transition-all">
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(formData); }} className="p-10 space-y-6">
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Identification Nom</label>
              <input
                type="text"
                required
                className="input"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Contact Professionnel (Email)</label>
              <input
                type="email"
                className="input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Coordonnées (Phone)</label>
              <input
                type="tel"
                className="input"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Niveau de Privilège (Rôle)</label>
              <select
                required
                className="input"
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

            {formData.role === 'HELPER' && (
              <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-orange-900">Accès Mode Assistance</p>
                  <p className="text-[10px] text-orange-700 font-medium">Permet de se connecter aux autres comptes.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, canImpersonate: !formData.canImpersonate })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    formData.canImpersonate ? 'bg-orange-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.canImpersonate ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            )}
          </div>
          
          <div className="pt-4 flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all"
            >
              Fermer
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex-[2] btn-primary rounded-2xl shadow-xl shadow-indigo-200/50 bg-indigo-600 hover:bg-indigo-700"
            >
              {updateMutation.isPending ? 'Sync...' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [assigningAgent, setAssigningAgent] = useState<any>(null);
  const [assigningHelper, setAssigningHelper] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['users', { role: roleFilter, search }],
    queryFn: () => adminApi.users({ role: roleFilter || undefined, search: search || undefined }),
  });

  const users = data?.data?.data?.users || [];

  const activateMutation = useMutation({
    mutationFn: (uuid: string) => adminApi.activateUser(uuid),
    onSuccess: () => {
      toast.success('Utilisateur activé!');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (uuid: string) => adminApi.deactivateUser(uuid),
    onSuccess: () => {
      toast.success('Utilisateur désactivé!');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const reset2FAMutation = useMutation({
    mutationFn: (uuid: string) => adminApi.reset2FA(uuid),
    onSuccess: (res) => {
      toast.success(res.data?.message || '2FA réinitialisée avec succès!');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Erreur lors de la réinitialisation de la 2FA');
    }
  });

  const sendPwResetMutation = useMutation({
    mutationFn: (uuid: string) => adminApi.sendPasswordResetLink(uuid),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Lien de réinitialisation envoyé!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'envoi du lien');
    }
  });

  const kycColors: Record<string, string> = {
    PENDING: 'amber',
    UNDER_REVIEW: 'indigo',
    APPROVED: 'emerald',
    REJECTED: 'rose',
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-1000 ease-out">
      {/* Premium Header Banner */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-[#2c2f74] p-10 text-white shadow-2xl shadow-primary-200/50">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div>
            <h1 className="text-4xl font-black tracking-tight">Gestion des Profils <span className="text-primary-400">🛡️</span></h1>
            <p className="text-primary-100/70 font-medium text-lg mt-2 max-w-xl">
              Supervisez les accès, gérez les permissions et assurez la sécurité de l'écosystème SILACOD.
            </p>
          </div>
          
          <div className="flex gap-4">
            <div className="px-6 py-4 bg-white/10 backdrop-blur-md rounded-3xl border border-white/10 flex flex-col items-center">
              <span className="text-xs font-black uppercase tracking-widest opacity-60">Total</span>
              <span className="text-2xl font-black">{users.length}</span>
            </div>
            <div className="px-6 py-4 bg-emerald-500/20 backdrop-blur-md rounded-3xl border border-emerald-500/20 flex flex-col items-center">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-300">Actifs</span>
              <span className="text-2xl font-black text-emerald-400">{users.filter((u: any) => u.isActive).length}</span>
            </div>
            <button
               onClick={() => setIsAddModalOpen(true)}
               className="bg-white text-primary-900 group py-4 px-8 rounded-3xl font-black text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/20 flex items-center justify-center gap-3 whitespace-nowrap"
            >
              <UserPlus size={20} className="group-hover:rotate-12 transition-transform" />
              Ajouter Agent
            </button>
          </div>
        </div>
        
        {/* Background Particles Decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-400/10 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl -ml-10 -mb-10" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Advanced Filters Sidebar */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bento-card border-none bg-white p-8 space-y-8">
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Search size={14} />
                Filtre de recherche
              </h3>
              <div className="relative group">
                <input
                  type="text"
                  className="input pl-11 h-14 bg-slate-50 border-slate-100 group-focus-within:bg-white transition-all shadow-inner"
                  placeholder="Nom, Email, ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary-500 transition-colors" />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Filter size={14} />
                Filtrer par rôle
              </h3>
              <div className="flex flex-wrap gap-2">
                {['', 'VENDOR', 'CALL_CENTER_AGENT', 'CONFIRMATION_AGENT', 'INFLUENCER', 'HELPER', 'SYSTEM_SUPPORT', 'FINANCE_ADMIN', 'SUPER_ADMIN'].map((role) => (
                  <button
                    key={role}
                    onClick={() => setRoleFilter(role)}
                    className={`px-3 py-2.5 rounded-[1rem] text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap flex-grow text-center ${
                      roleFilter === role 
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-200/50 scale-105 z-10' 
                        : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                    }`}
                  >
                    {role ? role.replace(/_/g, ' ') : 'TOUS LES ACCÈS'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bento-card bg-primary-50 border-primary-100 p-8">
             <div className="flex items-center gap-3 mb-4">
                <Clock size={24} className="text-primary-600" />
                <h4 className="font-black text-primary-900 uppercase tracking-widest text-[10px]">Statistiques</h4>
             </div>
             <p className="text-sm font-bold text-primary-900/70 leading-relaxed">
               <span className="text-primary-600 underline">8 demandes de KYC</span> sont actuellement en attente de vérification par un administrateur.
             </p>
          </div>
        </div>

        {/* Users Table Area */}
        <div className="xl:col-span-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-40">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin" />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Initialisation de la base...</p>
                </div>
            </div>
          ) : (
            <div className="bento-card bg-white overflow-hidden p-0 border-none shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50/80 backdrop-blur-sm border-b border-slate-100">
                    <tr>
                      <th className="text-left py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Identité</th>
                      <th className="text-left py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact</th>
                      <th className="text-left py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Privilèges</th>
                      <th className="text-left py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Confiance</th>
                      <th className="text-left py-6 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
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
                          <span className="inline-block px-4 py-1.5 rounded-xl bg-slate-100 text-slate-500 text-[10px] font-black tracking-[0.1em] uppercase">
                            {user.role?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-6 px-8">
                          <span className={`inline-block px-4 py-1.5 rounded-xl text-[10px] font-black tracking-[0.1em] uppercase border ${
                            user.kycStatus === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                            user.kycStatus === 'PENDING' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                            user.kycStatus === 'REJECTED' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                            'bg-indigo-50 text-indigo-600 border-indigo-100'
                          }`}>
                            {user.kycStatus}
                          </span>
                        </td>
                        <td className="py-6 px-8">
                          <div className="flex items-center gap-2">
                             <div className={`w-2 h-2 rounded-full animate-pulse ${user.isActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-rose-400'}`} />
                             <span className={`text-[11px] font-black uppercase tracking-widest ${user.isActive ? 'text-emerald-600' : 'text-rose-500'}`}>
                                {user.isActive ? 'Opérationnel' : 'Suspendu'}
                             </span>
                          </div>
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
                            
                            {user.role === 'CALL_CENTER_AGENT' && (
                              <button
                                onClick={() => setAssigningAgent(user)}
                                className="w-10 h-10 rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-primary-600 hover:border-primary-100 hover:bg-primary-50 transition-all flex items-center justify-center"
                                title="Assigner Influenceurs"
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
                                onClick={() => {
                                  if (window.confirm('Envoyer un lien de réinitialisation de mot de passe ?')) {
                                    sendPwResetMutation.mutate(user.uuid);
                                  }
                                }}
                                className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100 transition-all flex items-center justify-center"
                                title="Envoyer Reset Password"
                              >
                                <KeyIcon size={18} />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
    </div>
  );
}


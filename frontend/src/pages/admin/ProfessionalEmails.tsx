import { useState, useEffect } from 'react';
import { adminApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { 
  Mail, 
  Key, 
  Trash2, 
  Plus, 
  Info, 
  Search, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Loader2, 
  RefreshCw,
  Copy,
  Check,
  Lock,
  Server
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProfessionalEmail {
  id: number;
  username: string;
  email: string;
  createdAt: string;
}

export default function ProfessionalEmails() {
  const [emails, setEmails] = useState<ProfessionalEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<ProfessionalEmail | null>(null);

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Clipboard copy feedback
  const [copiedSetting, setCopiedSetting] = useState<string | null>(null);

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getProfessionalEmails();
      setEmails(res.data?.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors du chargement des emails.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('Veuillez remplir tous les champs.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await adminApi.createProfessionalEmail({
        username: username.toLowerCase().trim(),
        password
      });
      toast.success(res.data?.message || 'Email créé avec succès !');
      setShowCreateModal(false);
      setUsername('');
      setPassword('');
      fetchEmails();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur de création.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmail || !newPassword.trim()) return;

    try {
      setSubmitting(true);
      const res = await adminApi.changeProfessionalEmailPassword({
        username: selectedEmail.username,
        password: newPassword
      });
      toast.success(res.data?.message || 'Mot de passe mis à jour !');
      setShowChangePasswordModal(false);
      setNewPassword('');
      setSelectedEmail(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur de modification.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (usernameToDelete: string) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer l'adresse email ${usernameToDelete}@silacod.com ? Cette action supprimera définitivement toutes les données de ce compte.`)) {
      return;
    }

    try {
      const res = await adminApi.deleteProfessionalEmail(usernameToDelete);
      toast.success(res.data?.message || 'Email supprimé avec succès.');
      fetchEmails();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de la suppression.');
    }
  };

  const generateRandomPassword = (isNew: boolean) => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~';
    let pass = '';
    for (let i = 0; i < 14; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (isNew) {
      setNewPassword(pass);
    } else {
      setPassword(pass);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSetting(key);
    toast.success('Copié dans le presse-papiers');
    setTimeout(() => setCopiedSetting(null), 2000);
  };

  const filteredEmails = emails.filter(email => 
    email.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Mail className="w-8 h-8 text-primary-500" />
            Emails Professionnels
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gérez les boîtes de réception professionnelles pour le domaine <span className="font-bold text-slate-800">silacod.com</span>
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
             onClick={fetchEmails}
             className="p-3 text-slate-400 hover:text-primary-500 hover:bg-slate-50 rounded-2xl transition-all border border-slate-100 bg-white"
             title="Rafraîchir"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-slate-950 hover:bg-primary-600 text-white font-bold rounded-2xl transition-all shadow-xl shadow-slate-950/10 active:scale-95 text-sm"
          >
            <Plus size={18} />
            Créer un Email
          </button>
        </div>
      </div>

      {/* Grid of Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left/Middle Column: List of accounts */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl shadow-slate-200/40">
            {/* Search */}
            <div className="relative mb-6">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <Search size={18} />
              </div>
              <input
                type="text"
                placeholder="Rechercher une adresse email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none transition-all text-sm font-semibold text-slate-700"
              />
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
                <p className="text-sm text-slate-400 font-medium">Chargement des comptes mail...</p>
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="text-center py-16 space-y-4">
                <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                  <Mail size={32} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-700">Aucun email trouvé</h3>
                  <p className="text-xs text-slate-400 mt-1">Créez votre première boîte de réception professionnelle pour silacod.com</p>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-100">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-400 text-xs font-black uppercase tracking-wider">
                        <th className="px-6 py-4">Adresse Email</th>
                        <th className="px-6 py-4">Date de Création</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredEmails.map((email) => (
                        <tr key={email.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4 font-bold text-slate-700 text-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-primary-600 font-bold uppercase">
                                {email.username[0]}
                              </div>
                              <div>
                                <p className="leading-none">{email.email}</p>
                                <p className="text-[10px] text-slate-400 mt-1 font-semibold uppercase tracking-wider">Linux Sys User: {email.username}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-400 font-semibold">
                            {new Date(email.createdAt).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setSelectedEmail(email);
                                  setShowChangePasswordModal(true);
                                }}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                title="Modifier le mot de passe"
                              >
                                <Key size={16} />
                              </button>
                              <button
                                onClick={() => handleDelete(email.username)}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                title="Supprimer"
                              >
                                <Trash2 size={16} />
                              </button>
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

        {/* Right Column: Mail Client configuration guidelines */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <Server size={120} />
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-primary-50 text-primary-600 rounded-xl">
                <Server size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 leading-none">Configuration Client Mail</h3>
                <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest leading-none">Settings guide</p>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              Pour configurer ces adresses de messagerie sur Outlook, Thunderbird, Gmail, Mail Apple ou d'autres applications :
            </p>

            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Serveur Entrant IMAP</p>
                    <p className="text-sm font-black text-slate-700 mt-1.5">mail.silacod.com</p>
                    <p className="text-[11px] text-slate-500 mt-1">Port <span className="font-bold">993</span> (SSL/TLS) ou <span className="font-bold">143</span> (STARTTLS)</p>
                  </div>
                  <button 
                    onClick={() => handleCopy('mail.silacod.com', 'incoming')}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-all"
                  >
                    {copiedSetting === 'incoming' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Serveur Sortant SMTP</p>
                    <p className="text-sm font-black text-slate-700 mt-1.5">mail.silacod.com</p>
                    <p className="text-[11px] text-slate-500 mt-1">Port <span className="font-bold">587</span> (STARTTLS)</p>
                  </div>
                  <button 
                    onClick={() => handleCopy('mail.silacod.com', 'outgoing')}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-all"
                  >
                    {copiedSetting === 'outgoing' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Identifiant (Nom d'utilisateur)</p>
                    <p className="text-sm font-black text-slate-700 mt-1.5">Votre adresse e-mail complète</p>
                    <p className="text-[11px] text-slate-500 mt-1">Exemple: <span className="font-semibold text-slate-600">mail@silacod.com</span></p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-start gap-2.5 p-3.5 bg-blue-50 border border-blue-100 rounded-2xl text-blue-800">
              <Info size={16} className="flex-shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed font-medium">
                Important : Le nom d'utilisateur requis par votre client de messagerie est l'adresse mail complète et non le nom d'utilisateur système Linux.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CREATE MODAL */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 border border-slate-100 shadow-2xl max-w-md w-full space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary-500" />
                  Créer un compte email
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                >
                  Fermer
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                {/* Username */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Adresse mail</label>
                  <div className="flex items-center bg-slate-50 border-2 border-transparent focus-within:border-primary-500 rounded-2xl px-4 py-3 outline-none transition-all">
                    <input
                      type="text"
                      placeholder="nom.prenom"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                      className="bg-transparent flex-1 outline-none text-sm font-semibold text-slate-700 w-full"
                      required
                    />
                    <span className="text-sm font-bold text-slate-400 pl-2 border-l border-slate-200">@silacod.com</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium leading-normal px-2">
                    Lettres minuscules, chiffres, points, tirets et underscores uniquement.
                  </p>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mot de passe</label>
                    <button
                      type="button"
                      onClick={() => generateRandomPassword(false)}
                      className="text-xs text-primary-600 hover:text-primary-700 font-black flex items-center gap-1"
                    >
                      Générer
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <Lock size={16} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mot de passe fort"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-3.5 bg-slate-50 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none transition-all text-sm font-semibold text-slate-700"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-2 border-t border-slate-50">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-5 py-3 text-slate-500 hover:text-slate-700 font-bold rounded-2xl transition-all text-sm"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-6 py-3 bg-slate-950 hover:bg-primary-600 text-white font-bold rounded-2xl transition-all shadow-xl shadow-slate-950/10 active:scale-95 text-sm"
                  >
                    {submitting && <Loader2 size={16} className="animate-spin" />}
                    Créer le compte
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CHANGE PASSWORD MODAL */}
      <AnimatePresence>
        {showChangePasswordModal && selectedEmail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 border border-slate-100 shadow-2xl max-w-md w-full space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Modifier le mot de passe
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 font-semibold">{selectedEmail.email}</p>
                </div>
                <button
                  onClick={() => {
                    setShowChangePasswordModal(false);
                    setSelectedEmail(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                >
                  Fermer
                </button>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                {/* New Password */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nouveau mot de passe</label>
                    <button
                      type="button"
                      onClick={() => generateRandomPassword(true)}
                      className="text-xs text-primary-600 hover:text-primary-700 font-black flex items-center gap-1"
                    >
                      Générer
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <Lock size={16} />
                    </div>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="Saisissez un mot de passe sécurisé"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-3.5 bg-slate-50 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none transition-all text-sm font-semibold text-slate-700"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-2 border-t border-slate-50">
                  <button
                    type="button"
                    onClick={() => {
                      setShowChangePasswordModal(false);
                      setSelectedEmail(null);
                    }}
                    className="px-5 py-3 text-slate-500 hover:text-slate-700 font-bold rounded-2xl transition-all text-sm"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-6 py-3 bg-slate-950 hover:bg-primary-600 text-white font-bold rounded-2xl transition-all shadow-xl shadow-slate-950/10 active:scale-95 text-sm"
                  >
                    {submitting && <Loader2 size={16} className="animate-spin" />}
                    Mettre à jour
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

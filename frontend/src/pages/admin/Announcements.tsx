import { useState, useEffect } from 'react';
import { adminApi, announcementApi } from '../../lib/api';
import { 
  Megaphone, 
  Plus, 
  Trash2, 
  Users, 
  Globe, 
  User,
  Power,
  RefreshCw,
  Edit2,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null);

  // Form State
  const [type, setType] = useState('GLOBAL');
  const [severity, setSeverity] = useState('INFO');
  const [priority, setPriority] = useState(1);
  const [placement, setPlacement] = useState('TOP');
  const [targetRole, setTargetRole] = useState('VENDOR');
  const [targetUserId, setTargetUserId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  // Users for specific targeting
  const [users, setUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  useEffect(() => {
    if (type === 'USER' && users.length === 0) {
      fetchUsers();
    }
  }, [type]);

  const fetchAnnouncements = async () => {
    try {
      setIsLoading(true);
      const res = await announcementApi.getAdminAnnouncements();
      setAnnouncements(res.data.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des annonces');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const res = await adminApi.users({ limit: 1000 });
      setUsers(res.data.data.users);
    } catch (error) {
      toast.error('Erreur lors du chargement des utilisateurs');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) {
      toast.error('Veuillez remplir le titre et le contenu');
      return;
    }

    try {
      setIsSubmitting(true);
      const data = {
        type,
        severity,
        priority: Number(priority),
        placement,
        targetRole: type === 'ROLE' ? targetRole : undefined,
        targetUserId: type === 'USER' ? targetUserId : undefined,
        title,
        content
      };

      if (editingAnnouncement) {
        await announcementApi.updateAnnouncement(editingAnnouncement.id, data);
        toast.success('Annonce mise à jour');
      } else {
        await announcementApi.createAnnouncement(data);
        toast.success('Annonce créée avec succès');
      }
      
      setIsModalOpen(false);
      resetForm();
      fetchAnnouncements();
    } catch (error) {
      toast.error(editingAnnouncement ? 'Erreur lors de la modification' : 'Erreur lors de la création');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (id: number, currentStatus: boolean) => {
    try {
      await announcementApi.toggleAnnouncement(id, !currentStatus);
      toast.success('Statut mis à jour');
      fetchAnnouncements();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour du statut');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette annonce ?')) return;
    try {
      await announcementApi.deleteAnnouncement(id);
      toast.success('Annonce supprimée');
      fetchAnnouncements();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleEdit = (announcement: any) => {
    setEditingAnnouncement(announcement);
    setType(announcement.type);
    setSeverity(announcement.severity);
    setPriority(announcement.priority || 1);
    setPlacement(announcement.placement || 'TOP');
    setTargetRole(announcement.targetRole || 'VENDOR');
    setTargetUserId(announcement.targetUserId?.toString() || '');
    setTitle(announcement.title);
    setContent(announcement.content);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingAnnouncement(null);
    setType('GLOBAL');
    setSeverity('INFO');
    setPriority(1);
    setPlacement('TOP');
    setTargetRole('VENDOR');
    setTargetUserId('');
    setTitle('');
    setContent('');
  };

  const getSeverityLabel = (sev: string) => {
    switch (sev) {
      case 'INFO':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Info</span>;
      case 'WARNING':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Attention</span>;
      case 'IMPORTANT':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Important</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">{sev}</span>;
    }
  };

  const getPlacementLabel = (pos: string) => {
    return pos === 'TOP' 
      ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">Haut</span>
      : <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-600 text-white">Bas</span>;
  };

  const getPriorityBadge = (p: number) => {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200"># {p}</span>;
  };

  const getTargetLabel = (announcement: any) => {
    switch (announcement.type) {
      case 'GLOBAL':
        return <span className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg"><Globe className="w-3 h-3" /> Globale</span>;
      case 'ROLE':
        return <span className="flex items-center gap-1 text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg"><Users className="w-3 h-3" /> Rôle: {announcement.targetRole}</span>;
      case 'USER':
        return <span className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-lg"><User className="w-3 h-3" /> Utilisateur: {announcement.targetUser?.profile?.fullName || announcement.targetUser?.email || announcement.targetUserId}</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Megaphone className="w-8 h-8 text-primary-500" />
            Annonces Globales
          </h1>
          <p className="text-sm text-gray-500 mt-1">Gérez et diffusez des messages importants à vos utilisateurs.</p>
        </div>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-bold shadow-sm shadow-primary-600/20 hover:bg-primary-700 transition-all hover:scale-105 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Nouvelle Annonce
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <RefreshCw className="w-8 h-8 text-primary-500 animate-spin" />
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Megaphone className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Aucune annonce</h3>
            <p className="text-sm text-gray-500 mt-1">Vous n'avez pas encore créé d'annonce.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Ordre</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Titre & Contenu</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Cible</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Priorité</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Position</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {announcements.map((announcement) => (
                  <tr key={announcement.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      {getPriorityBadge(announcement.priority)}
                    </td>
                    <td className="px-6 py-4 max-w-sm">
                      <div className="font-bold text-gray-900">{announcement.title}</div>
                      <div className="text-sm text-gray-500 truncate mt-1">{announcement.content}</div>
                    </td>
                    <td className="px-6 py-4">
                      {getTargetLabel(announcement)}
                    </td>
                    <td className="px-6 py-4">
                      {getSeverityLabel(announcement.severity)}
                    </td>
                    <td className="px-6 py-4">
                      {getPlacementLabel(announcement.placement)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(announcement.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        announcement.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {announcement.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggle(announcement.id, announcement.isActive)}
                          className={`p-2 rounded-lg transition-colors ${
                            announcement.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'
                          }`}
                          title={announcement.isActive ? 'Désactiver' : 'Activer'}
                        >
                          <Power className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleEdit(announcement)}
                          className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(announcement.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => { setIsModalOpen(false); resetForm(); }}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-xl font-extrabold text-gray-900">
                {editingAnnouncement ? "Modifier l'annonce" : "Nouvelle Annonce"}
              </h2>
              <button 
                onClick={() => { setIsModalOpen(false); resetForm(); }} 
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Type d'annonce</label>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { id: 'GLOBAL', icon: Globe, label: 'Globale' },
                    { id: 'ROLE', icon: Users, label: 'Par Rôle' },
                    { id: 'USER', icon: User, label: 'Utilisateur' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setType(t.id)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        type === t.id 
                          ? 'border-primary-500 bg-primary-50 text-primary-700' 
                          : 'border-gray-200 hover:border-gray-300 text-gray-500'
                      }`}
                    >
                      <t.icon className="w-6 h-6" />
                      <span className="font-bold text-sm">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Priorité d'importance</label>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { id: 'INFO', color: 'blue', label: 'Info' },
                    { id: 'WARNING', color: 'amber', label: 'Attention' },
                    { id: 'IMPORTANT', color: 'red', label: 'Important' }
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSeverity(s.id)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        severity === s.id 
                          ? s.id === 'INFO' ? 'border-blue-500 bg-blue-50 text-blue-700' :
                            s.id === 'WARNING' ? 'border-amber-500 bg-amber-50 text-amber-700' :
                            'border-red-500 bg-red-50 text-red-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-500'
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full ${
                        s.id === 'INFO' ? 'bg-blue-500' :
                        s.id === 'WARNING' ? 'bg-amber-500' :
                        'bg-red-500'
                      }`} />
                      <span className="font-bold text-xs">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Ordre de priorité (1 est le premier)</label>
                <input
                  type="number"
                  min="1"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-bold"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                />
                <p className="text-[10px] text-gray-400 mt-1 italic">L'annonce avec le chiffre le plus bas apparaîtra en premier.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Position de l'annonce</label>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'TOP', label: 'Haut de page' },
                    { id: 'BOTTOM', label: 'Bas de page' }
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlacement(p.id)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        placement === p.id 
                          ? 'border-primary-500 bg-primary-50 text-primary-700' 
                          : 'border-gray-200 hover:border-gray-300 text-gray-500'
                      }`}
                    >
                      <span className="font-bold text-xs">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {type === 'ROLE' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Rôle Cible</label>
                  <select 
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                  >
                    <option value="VENDOR">Vendeurs</option>
                    <option value="INFLUENCER">Influenceurs</option>
                    <option value="CALL_CENTER_AGENT">Agents de confirmation</option>
                    <option value="CONFIRMATION_AGENT">Agents de vérification</option>
                    <option value="GROSSELLER">Grossistes</option>
                  </select>
                </div>
              )}

              {type === 'USER' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Utilisateur Cible</label>
                  <select
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    required
                  >
                    <option value="">Sélectionnez un utilisateur...</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.profile?.fullName || u.email} ({u.role?.name})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Titre</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                  placeholder="Titre de l'annonce..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Message</label>
                <textarea
                  required
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                  placeholder="Contenu de votre annonce..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); resetForm(); }}
                  className="px-6 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : editingAnnouncement ? (
                    <Edit2 className="w-5 h-5" />
                  ) : (
                    <Megaphone className="w-5 h-5" />
                  )}
                  {editingAnnouncement ? 'Enregistrer' : 'Publier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

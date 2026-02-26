import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';

function AddUserModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    role: 'VENDOR',
  });
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Ajouter un Utilisateur</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
            <input
              type="text"
              required
              className="input w-full"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              className="input w-full"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
            <input
              type="tel"
              className="input w-full"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
            <input
              type="password"
              required
              minLength={6}
              className="input w-full"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
            <select
              required
              className="input w-full"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              <option value="VENDOR">Vendeur</option>
              <option value="GROSELLER">Grossiste</option>
              <option value="CALL_CENTER_AGENT">Agent Call Center</option>
              <option value="FINANCE_ADMIN">Admin Finance</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>
          
          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 btn-primary"
            >
              {createMutation.isPending ? 'Création...' : 'Créer l\'utilisateur'}
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Éditer l'Utilisateur</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(formData); }} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
            <input
              type="text"
              required
              className="input w-full"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              className="input w-full"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
            <input
              type="tel"
              className="input w-full"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
            <select
              required
              className="input w-full"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              <option value="VENDOR">Vendeur</option>
              <option value="GROSELLER">Grossiste</option>
              <option value="CALL_CENTER_AGENT">Agent Call Center</option>
              <option value="FINANCE_ADMIN">Admin Finance</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>
          
          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex-1 btn-primary"
            >
              {updateMutation.isPending ? 'Mise à jour...' : 'Mettre à jour'}
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
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['users', { role: roleFilter, search }],
    queryFn: () => adminApi.users({ role: roleFilter || undefined }),
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

  const kycColors: Record<string, string> = {
    PENDING: 'warning',
    UNDER_REVIEW: 'purple',
    APPROVED: 'success',
    REJECTED: 'danger',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Utilisateurs</h1>
          <p className="text-gray-500 mt-1">{users.length} utilisateurs</p>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            className="input w-48"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary"
          >
            Ajouter
          </button>
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

      {/* Role Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {['', 'VENDOR', 'CALL_CENTER_AGENT', 'FINANCE_ADMIN', 'SUPER_ADMIN'].map((role) => (
          <button
            key={role}
            onClick={() => setRoleFilter(role)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-colors ${
              roleFilter === role ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {role || 'Tous'}
          </button>
        ))}
      </div>

      {/* Users Table */}
      {isLoading ? (
        <div className="text-center py-12">Chargement...</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Utilisateur</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Contact</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Rôle</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">KYC</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Statut</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user: any) => (
                <tr key={user.uuid} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-primary-700 font-semibold text-sm">{user.fullName?.charAt(0) || '?'}</span>
                      </div>
                      <span className="font-medium text-gray-900">{user.fullName || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600 text-sm">
                    <div>{user.email}</div>
                    <div className="text-gray-400">{user.phone}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="badge-gray">{user.role}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`badge-${kycColors[user.kycStatus] || 'gray'}`}>{user.kycStatus}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`badge-${user.isActive ? 'success' : 'danger'}`}>
                      {user.isActive ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => setEditingUser(user)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Éditer
                      </button>
                      {user.isActive ? (
                        <button
                          onClick={() => deactivateMutation.mutate(user.uuid)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Désactiver
                        </button>
                      ) : (
                        <button
                          onClick={() => activateMutation.mutate(user.uuid)}
                          className="text-green-600 hover:text-green-700 text-sm font-medium"
                        >
                          Activer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

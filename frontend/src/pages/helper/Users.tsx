import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Users as UsersIcon, LogIn, Search, Loader2 } from 'lucide-react';

export default function HelperUsers() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { impersonate } = useAuth();
  const [impersonatingId, setImpersonatingId] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['helper-users', page, search],
    queryFn: () => adminApi.users({ page, limit: 50, search }),
  });

  const body = data?.data;
  const users = body?.data?.users || [];
  const pagination = body?.data?.pagination;

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

  if (error) {
    return <div className="p-8 text-red-500">Erreur de chargement des utilisateurs.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <UsersIcon className="text-primary-600" />
            Utilisateurs
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Connectez-vous à n'importe quel compte pour l'assister.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Rechercher par nom, email..."
            className="input pl-10"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center items-center">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-slate-400">Aucun utilisateur trouvé.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">
                  <th className="px-6 py-4 text-left">Utilisateur</th>
                  <th className="px-6 py-4 text-left">Rôle</th>
                  <th className="px-6 py-4 text-left">Contact</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map((u: any) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center font-black text-lg">
                          {(u.fullName || u.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{u.fullName || 'Non défini'}</p>
                          <p className="text-xs text-slate-400 font-mono">ID: {u.uuid.split('-')[0]}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                        u.role === 'SUPER_ADMIN' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                        u.role === 'VENDOR' ? 'bg-primary-50 text-primary-600 border-primary-200' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-slate-600">{u.email}</p>
                      {u.phone && <p className="text-xs text-slate-400 mt-0.5">{u.phone}</p>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleImpersonate(u.id, u.role)}
                        disabled={u.role === 'SUPER_ADMIN' || impersonatingId === u.id}
                        className={`inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-xl text-xs font-bold transition-all shadow-sm group/btn disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {impersonatingId === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                        Se connecter
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-xl disabled:opacity-50"
          >
            Précédent
          </button>
          <span className="text-sm font-bold text-slate-400">
            Page {page} sur {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages}
            className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-xl disabled:opacity-50"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}

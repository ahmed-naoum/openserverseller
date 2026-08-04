import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import toast from 'react-hot-toast';
import { 
  Key, Eye, EyeOff, Plus, Trash2, Edit2, Check, X, 
  Search, ShieldAlert, Loader2, Database
} from 'lucide-react';

const CARD_STYLE = 'bg-slate-900 rounded-2xl border border-slate-800 p-5';
const INPUT_STYLE = 'w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-yellow-500/50 transition-all font-mono';

interface SecretItem {
  key: string;
  value: string;
  description?: string;
  isEncrypted: boolean;
  updatedAt: string;
}

export default function ModSecrets() {
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({});
  const [revealingKey, setRevealingKey] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [formKey, setFormKey] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const loadSecrets = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/secrets');
      setSecrets(res.data.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors du chargement des secrets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSecrets();
  }, []);

  const handleToggleReveal = async (key: string) => {
    if (revealedKeys[key]) {
      const newRevealed = { ...revealedKeys };
      delete newRevealed[key];
      setRevealedKeys(newRevealed);
      return;
    }

    try {
      setRevealingKey(key);
      const res = await api.get(`/admin/secrets/reveal/${key}`);
      setRevealedKeys(prev => ({ ...prev, [key]: res.data.data.value }));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors du décryptage');
    } finally {
      setRevealingKey(null);
    }
  };

  const handleDelete = async (key: string) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer le secret "${key}" ?`)) return;
    try {
      await api.delete(`/admin/secrets/${key}`);
      toast.success('Secret supprimé');
      loadSecrets();
      if (revealedKeys[key]) {
        const newRevealed = { ...revealedKeys };
        delete newRevealed[key];
        setRevealedKeys(newRevealed);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const openModal = (mode: 'add' | 'edit', secret?: SecretItem) => {
    setModalMode(mode);
    if (mode === 'edit' && secret) {
      setFormKey(secret.key);
      setFormValue(revealedKeys[secret.key] || '');
      setFormDesc(secret.description || '');
    } else {
      setFormKey('');
      setFormValue('');
      setFormDesc('');
    }
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKey.trim() || formValue.trim() === '') {
      toast.error('La clé et la valeur sont requises.');
      return;
    }
    try {
      setSaving(true);
      await api.post('/admin/secrets', {
        key: formKey.trim(),
        value: formValue.trim(),
        description: formDesc.trim() || undefined
      });
      toast.success(modalMode === 'add' ? 'Secret créé avec succès' : 'Secret mis à jour');
      setModalOpen(false);
      loadSecrets();
      setRevealedKeys(prev => ({ ...prev, [formKey.trim()]: formValue.trim() }));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const filteredSecrets = secrets.filter(s => 
    s.key.toLowerCase().includes(search.toLowerCase()) || 
    (s.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-500/30"
            placeholder="Rechercher un secret par clé ou description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => openModal('add')}
          className="flex items-center gap-1.5 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-lg shadow-yellow-500/10 active:scale-95 shrink-0"
        >
          <Plus size={14} className="stroke-[3]" />
          Ajouter un secret
        </button>
      </div>

      <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-2xl p-4 flex gap-3">
        <ShieldAlert className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-black text-white uppercase tracking-widest">Base de données de secrets sécurisée</h4>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            Ces variables d'environnement sont persistées dans la base de données PostgreSQL sous forme cryptée (AES-256-CBC) à l'aide de la clé principale du serveur. Les modifications apportées ici sont chargées de manière dynamique et prennent effet immédiatement. Les variables d'initialisation sensibles (comme la clé de déchiffrement ou le token JWT) sont lues uniquement depuis <code>.env</code> et ne peuvent pas être écrites dans la base de données.
          </p>
        </div>
      </div>

      <div className={CARD_STYLE + ' p-0 overflow-hidden'}>
        <div className="p-5 border-b border-slate-850 flex items-center justify-between">
          <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
            <Database size={14} className="text-yellow-400" /> Registre des Secrets ({filteredSecrets.length})
          </h3>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
            <span className="text-xs font-semibold">Décryptage et chargement des clés...</span>
          </div>
        ) : filteredSecrets.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs">
            Aucun secret trouvé
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-850 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <th className="py-3 px-5">Variable / Clé</th>
                  <th className="py-3 px-5">Description</th>
                  <th className="py-3 px-5">Valeur</th>
                  <th className="py-3 px-5">Mise à jour</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/40 text-xs font-medium">
                {filteredSecrets.map(s => {
                  const revealedVal = revealedKeys[s.key];
                  const isRevealing = revealingKey === s.key;
                  return (
                    <tr key={s.key} className="hover:bg-slate-850/20 group">
                      <td className="py-3.5 px-5 font-mono text-yellow-400 font-bold">{s.key}</td>
                      <td className="py-3.5 px-5 text-slate-400 max-w-xs truncate">{s.description || '-'}</td>
                      <td className="py-3.5 px-5 font-mono">
                        {revealedVal ? (
                          <span className="text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded text-[11px] block w-fit truncate max-w-sm">
                            {revealedVal}
                          </span>
                        ) : (
                          <span className="text-slate-600 tracking-widest text-[10px]">••••••••</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-slate-500 font-mono text-[10px]">
                        {new Date(s.updatedAt).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleToggleReveal(s.key)}
                            disabled={isRevealing}
                            className={`p-1.5 rounded-lg border transition-all ${
                              revealedVal 
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-750'
                            }`}
                            title={revealedVal ? 'Masquer' : 'Révéler'}
                          >
                            {isRevealing ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : revealedVal ? (
                              <EyeOff size={13} />
                            ) : (
                              <Eye size={13} />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              if (!revealedVal) {
                                handleToggleReveal(s.key).then(() => {
                                  openModal('edit', s);
                                });
                              } else {
                                openModal('edit', s);
                              }
                            }}
                            className="p-1.5 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-750 rounded-lg transition-all"
                            title="Modifier"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(s.key)}
                            className="p-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                            title="Supprimer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-fadeIn p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            <div className="p-5 border-b border-slate-850 flex items-center justify-between">
              <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Key size={14} className="text-yellow-400" />
                {modalMode === 'add' ? 'Ajouter un nouveau secret' : 'Modifier le secret'}
              </h3>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  Clé / Variable d'environnement
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: SMTP_USER"
                  disabled={modalMode === 'edit'}
                  className={INPUT_STYLE + ' disabled:opacity-50 disabled:cursor-not-allowed'}
                  value={formKey}
                  onChange={e => setFormKey(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  Valeur du secret
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Collez la valeur ici..."
                  className={INPUT_STYLE + ' py-2.5 resize-none'}
                  value={formValue}
                  onChange={e => setFormValue(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  Description / Note
                </label>
                <input
                  type="text"
                  placeholder="Ex: Clé API privée pour la production"
                  className={INPUT_STYLE}
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-slate-950 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Check size={13} className="stroke-[3]" />
                  )}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Check,
  Database,
  Eye,
  KeyRound,
  Loader2,
  Lock,
  RotateCcw,
  Save,
  Search,
  Server,
  X,
} from 'lucide-react';
import { api } from '../../lib/api';

type SecretSource = 'database' | 'env' | 'unset';

interface SecretItem {
  key: string;
  label: string;
  category: string;
  categoryLabel: string;
  secret: boolean;
  bootstrap: boolean;
  /** Needs a textarea: the value contains real newlines (e.g. a PEM key). */
  multiline?: boolean;
  description: string | null;
  source: SecretSource;
  /** Masked for secrets, full value for non-secrets, null when unset. */
  preview: string | null;
  updatedAt: string | null;
  updatedByEmail: string | null;
}

const SOURCE_BADGE: Record<SecretSource, { label: string; className: string; Icon: typeof Database }> = {
  database: {
    label: 'Base de données',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    Icon: Database,
  },
  env: {
    label: 'Fichier .env',
    className: 'bg-slate-100 text-slate-600 ring-slate-500/20',
    Icon: Server,
  },
  unset: {
    label: 'Non défini',
    className: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    Icon: AlertTriangle,
  },
};

export default function AdminSecrets() {
  const [items, setItems] = useState<SecretItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [encryptionKeyConfigured, setEncryptionKeyConfigured] = useState(true);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // key -> value being typed. Absent means the row is not in edit mode.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    try {
      const { data } = await api.get('/admin/secrets');
      setItems(data.data.items);
      setEncryptionKeyConfigured(data.data.encryptionKeyConfigured);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Échec du chargement de la configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    items.forEach((i) => seen.set(i.category, i.categoryLabel));
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (activeCategory !== 'all' && i.category !== activeCategory) return false;
      if (!q) return true;
      return i.key.toLowerCase().includes(q) || i.label.toLowerCase().includes(q);
    });
  }, [items, query, activeCategory]);

  const grouped = useMemo(() => {
    const map = new Map<string, SecretItem[]>();
    filtered.forEach((i) => {
      const list = map.get(i.categoryLabel) ?? [];
      list.push(i);
      map.set(i.categoryLabel, list);
    });
    return Array.from(map, ([label, rows]) => ({ label, rows }));
  }, [filtered]);

  const unsetCount = items.filter((i) => i.source === 'unset' && !i.bootstrap).length;

  const handleSave = async (item: SecretItem) => {
    const value = drafts[item.key];
    if (!value || !value.trim()) {
      toast.error('Veuillez saisir une valeur.');
      return;
    }
    setSaving(item.key);
    try {
      await api.put(`/admin/secrets/${item.key}`, { value });
      toast.success(`${item.label} mis à jour.`);
      setDrafts((d) => {
        const next = { ...d };
        delete next[item.key];
        return next;
      });
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Échec de la mise à jour.');
    } finally {
      setSaving(null);
    }
  };

  const handleReset = async (item: SecretItem) => {
    if (
      !window.confirm(
        `Réinitialiser ${item.label} ?\n\nLa valeur enregistrée sera supprimée et l'application utilisera de nouveau la valeur du fichier .env.`
      )
    ) {
      return;
    }
    setSaving(item.key);
    try {
      await api.delete(`/admin/secrets/${item.key}`);
      toast.success(`${item.label} réinitialisé.`);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Échec de la réinitialisation.');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <KeyRound className="h-6 w-6 text-indigo-600" />
          Variables & Secrets
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Configurez les clés API et les paramètres de la plateforme sans redéploiement. Les valeurs
          sont chiffrées avant d'être enregistrées en base de données.
        </p>
      </header>

      {!encryptionKeyConfigured && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div className="text-sm text-red-800">
            <p className="font-semibold">ENCRYPTION_KEY n'est pas configurée correctement.</p>
            <p className="mt-1">
              La clé doit faire exactement 32 caractères dans <code>backend/.env</code>.
              L'enregistrement est désactivé : sans clé stable, les valeurs deviendraient illisibles
              au prochain redémarrage.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
        <div className="text-sm text-slate-600">
          Les valeurs secrètes ne sont jamais renvoyées en clair : seuls les 4 derniers caractères
          sont affichés. Trois valeurs de démarrage (<code>DATABASE_URL</code>,{' '}
          <code>ENCRYPTION_KEY</code>, <code>JWT_SECRET</code>) restent en lecture seule — elles sont
          nécessaires avant même de pouvoir lire cette page.
          {unsetCount > 0 && (
            <span className="mt-1 block font-medium text-amber-700">
              {unsetCount} variable(s) ne sont définies ni en base ni dans .env.
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une variable…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <select
          value={activeCategory}
          onChange={(e) => setActiveCategory(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="all">Toutes les catégories</option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {grouped.length === 0 && (
        <p className="py-12 text-center text-sm text-slate-500">Aucune variable ne correspond.</p>
      )}

      {grouped.map((group) => (
        <section key={group.label} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700">
            {group.label}
          </h2>
          <ul className="divide-y divide-slate-100">
            {group.rows.map((item) => {
              const badge = SOURCE_BADGE[item.source];
              const isEditing = item.key in drafts;
              const isBusy = saving === item.key;

              return (
                <li key={item.key} className="px-4 py-3.5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900">{item.label}</span>
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                          {item.key}
                        </code>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${badge.className}`}
                        >
                          <badge.Icon className="h-3 w-3" />
                          {badge.label}
                        </span>
                        {item.bootstrap && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/20">
                            <Lock className="h-3 w-3" />
                            Lecture seule
                          </span>
                        )}
                      </div>

                      {item.description && (
                        <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                      )}

                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                        <Eye className="h-3 w-3 shrink-0" />
                        {item.preview ? (
                          <code className="truncate font-mono">{item.preview}</code>
                        ) : (
                          <span className="italic text-amber-700">non définie</span>
                        )}
                      </div>

                      {item.updatedAt && (
                        <p className="mt-1 text-xs text-slate-400">
                          Modifié le {new Date(item.updatedAt).toLocaleString('fr-FR')}
                          {item.updatedByEmail ? ` par ${item.updatedByEmail}` : ''}
                        </p>
                      )}
                    </div>

                    {!item.bootstrap && (
                      <div className="flex shrink-0 items-center gap-2 lg:w-[420px]">
                        {isEditing ? (
                          <>
                            {/* A multi-line value pasted into an <input> loses its
                                newlines, which turns a PEM into something OpenSSL
                                rejects with an opaque DECODER error long after the
                                save appeared to succeed. Those keys get a textarea. */}
                            {item.multiline ? (
                              <textarea
                                autoFocus
                                rows={6}
                                value={drafts[item.key]}
                                onChange={(e) =>
                                  setDrafts((d) => ({ ...d, [item.key]: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  // Enter inserts a newline here; only Escape is a shortcut.
                                  if (e.key === 'Escape') {
                                    setDrafts((d) => {
                                      const next = { ...d };
                                      delete next[item.key];
                                      return next;
                                    });
                                  }
                                }}
                                placeholder={"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"}
                                spellCheck={false}
                                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            ) : (
                              <input
                                autoFocus
                                type={item.secret ? 'password' : 'text'}
                                value={drafts[item.key]}
                                onChange={(e) =>
                                  setDrafts((d) => ({ ...d, [item.key]: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSave(item);
                                  if (e.key === 'Escape') {
                                    setDrafts((d) => {
                                      const next = { ...d };
                                      delete next[item.key];
                                      return next;
                                    });
                                  }
                                }}
                                placeholder="Nouvelle valeur"
                                autoComplete="new-password"
                                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            )}
                            <button
                              onClick={() => handleSave(item)}
                              disabled={isBusy || !encryptionKeyConfigured}
                              title={
                                encryptionKeyConfigured
                                  ? 'Enregistrer'
                                  : 'ENCRYPTION_KEY non configurée'
                              }
                              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isBusy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={() =>
                                setDrafts((d) => {
                                  const next = { ...d };
                                  delete next[item.key];
                                  return next;
                                })
                              }
                              className="rounded-lg border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-50"
                              title="Annuler"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setDrafts((d) => ({ ...d, [item.key]: '' }))}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <Save className="h-4 w-4" />
                              {item.source === 'database' ? 'Modifier' : 'Définir'}
                            </button>
                            {item.source === 'database' && (
                              <button
                                onClick={() => handleReset(item)}
                                disabled={isBusy}
                                title="Supprimer la valeur enregistrée et revenir au fichier .env"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                              >
                                {isBusy ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-4 w-4" />
                                )}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

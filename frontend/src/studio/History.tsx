import React, { useState } from 'react';
import { RotateCcw, Trash2, CloudUpload, Clock } from 'lucide-react';
import { useStudio } from './store';

/**
 * Versions and the draft. A version is what was live at a moment; restoring
 * one makes it the draft, which the seller then publishes — nothing here
 * touches the live page directly, so every action is one publish away from
 * being undone.
 */

function when(value: string | Date): string {
  const d = new Date(value);
  return d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const SOURCE_LABEL: Record<string, string> = {
  publish: 'Publication',
  restore: 'Restauration',
  'theme-install': 'Modèle installé',
  agent: 'Assistant',
};

export default function History() {
  const versions = useStudio((s) => s.versions);
  const hasDraft = useStudio((s) => s.hasDraft);
  const pending = useStudio((s) => s.pending);
  const publish = useStudio((s) => s.publish);
  const discard = useStudio((s) => s.discard);
  const restore = useStudio((s) => s.restore);
  const publishing = useStudio((s) => s.publishing);
  const [label, setLabel] = useState('');

  return (
    <div className="p-3 space-y-4">
      <div className="rounded-xl border border-slate-200 p-3 space-y-2 bg-slate-50/60">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Brouillon</p>
        {hasDraft || pending.length ? (
          <>
            <p className="text-xs text-slate-700">
              {pending.length ? `${pending.length} modification${pending.length > 1 ? 's' : ''} non enregistrée${pending.length > 1 ? 's' : ''}. ` : ''}
              {hasDraft ? 'Des changements attendent la publication.' : ''}
            </p>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Nom de cette version (optionnel)"
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={publishing}
                onClick={() => void publish(label.trim() || undefined).then((ok) => ok && setLabel(''))}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
              >
                <CloudUpload className="w-3.5 h-3.5" /> {publishing ? 'Publication…' : 'Publier'}
              </button>
              <button
                type="button"
                onClick={() => { if (window.confirm('Abandonner le brouillon et revenir à la version publiée ?')) void discard(); }}
                className="px-3 py-2 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:text-rose-600"
                title="Abandonner le brouillon"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-500">Aucun brouillon : la page affichée est celle que vos visiteurs voient.</p>
        )}
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Versions publiées</p>
        {!versions.length && <p className="text-xs text-slate-400">Aucune version pour l’instant. La première publication en créera une.</p>}
        <ul className="space-y-1.5">
          {versions.map((v, i) => (
            <li key={v.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 bg-white">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{v.label || (i === 0 ? 'Version actuelle' : `Version ${versions.length - i}`)}</p>
                <p className="text-[10px] text-slate-400">{when(v.createdAt)} · {SOURCE_LABEL[v.source] || v.source}</p>
              </div>
              <button
                type="button"
                onClick={() => { if (window.confirm('Restaurer cette version dans le brouillon ? Vous pourrez la publier ensuite.')) void restore(v.id); }}
                className="p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                title="Restaurer dans le brouillon"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

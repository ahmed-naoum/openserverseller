import React, { useState } from 'react';
import type { AnyNode, NodeStyle } from '@shared/document/index.js';
import { getBlock } from '@shared/blocks/index.js';
import { useStudio } from './store';
import { fieldKind, fieldLabel } from './fields';
import { TOKEN_NAMES, isToken } from '@shared/document/theme.js';

/**
 * The inspector, generated. Content comes from the block's registry schema and
 * inspector groups; Style is the shared set every node has; Advanced is the
 * node's own flags. Nothing here knows any block by name.
 */

type Tab = 'content' | 'style' | 'advanced';

export function Field({
  label,
  kind,
  value,
  onChange,
}: {
  label: string;
  kind: ReturnType<typeof fieldKind>;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const base = 'w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300';

  if (kind.kind === 'boolean') {
    return (
      <label className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-700 py-1">
        <span>{label}</span>
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="accent-indigo-600 w-4 h-4" />
      </label>
    );
  }

  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span>
      {kind.kind === 'textarea' ? (
        <textarea rows={3} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className={`${base} resize-y`} />
      ) : kind.kind === 'number' ? (
        <input type="number" value={value === undefined || value === null ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} className={base} />
      ) : kind.kind === 'color' ? (
        <div className="flex items-center gap-2">
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(String(value ?? '')) ? String(value) : '#000000'} onChange={(e) => onChange(e.target.value)} className="w-8 h-8 rounded border border-slate-200 p-0" />
          <input value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} placeholder="#rrggbb, rgba() ou $primary" className={base} />
          <select value={isToken(value) ? String(value) : ''} onChange={(e) => onChange(e.target.value || undefined)} className="text-[11px] rounded-lg border border-slate-200 bg-white px-1.5 py-1.5" title="Suivre une couleur du thème">
            <option value="">Thème…</option>
            {TOKEN_NAMES.filter((t) => t !== 'font').map((t) => <option key={t} value={`$${t}`}>${t}</option>)}
          </select>
        </div>
      ) : kind.kind === 'select' ? (
        <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value || undefined)} className={base}>
          <option value="">—</option>
          {kind.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : kind.kind === 'json' ? (
        <JsonField value={value} onChange={onChange} className={base} />
      ) : (
        <input value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className={base} />
      )}
    </label>
  );
}

/** Lists and objects edit as JSON until they get their own editors; a bad edit never lands. */
function JsonField({ value, onChange, className }: { value: unknown; onChange: (v: unknown) => void; className: string }) {
  const [text, setText] = useState(() => JSON.stringify(value ?? null, null, 2));
  const [bad, setBad] = useState(false);
  return (
    <>
      <textarea
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          try {
            const parsed = JSON.parse(text);
            setBad(false);
            onChange(parsed);
          } catch {
            setBad(true);
          }
        }}
        className={`${className} font-mono text-[11px] ${bad ? 'border-rose-400' : ''}`}
      />
      {bad && <span className="text-[10px] text-rose-500">JSON invalide — non enregistré.</span>}
    </>
  );
}

const STYLE_FIELDS: { key: keyof NodeStyle; label: string; kind: ReturnType<typeof fieldKind> }[] = [
  { key: 'paddingTop', label: 'Padding haut', kind: { kind: 'number' } },
  { key: 'paddingBottom', label: 'Padding bas', kind: { kind: 'number' } },
  { key: 'paddingLeft', label: 'Padding gauche', kind: { kind: 'number' } },
  { key: 'paddingRight', label: 'Padding droite', kind: { kind: 'number' } },
  { key: 'marginTop', label: 'Marge haut', kind: { kind: 'number' } },
  { key: 'marginBottom', label: 'Marge bas', kind: { kind: 'number' } },
  { key: 'background', label: 'Fond', kind: { kind: 'color' } },
  { key: 'borderRadius', label: 'Arrondi', kind: { kind: 'number' } },
  { key: 'borderWidth', label: 'Bordure (px)', kind: { kind: 'number' } },
  { key: 'borderColor', label: 'Couleur bordure', kind: { kind: 'color' } },
  { key: 'shadow', label: 'Ombre', kind: { kind: 'select', options: ['none', 'sm', 'md', 'lg', 'xl'] } },
  { key: 'align', label: 'Alignement', kind: { kind: 'select', options: ['start', 'center', 'end'] } },
];

export default function Inspector() {
  const doc = useStudio((s) => s.doc);
  const selectedId = useStudio((s) => s.selectedId);
  const setField = useStudio((s) => s.setField);
  const dispatch = useStudio((s) => s.dispatch);
  const [tab, setTab] = useState<Tab>('content');

  const node: AnyNode | null = useStudio((s) => s.selectedNode)();
  if (!doc) return null;

  if (!node) {
    return (
      <div className="p-4 text-xs text-slate-500">
        <p className="font-bold text-slate-700 mb-1">Paramètres de page</p>
        <Field label="Largeur max (px)" kind={{ kind: 'number' }} value={(doc.settings as any).maxWidth} onChange={(v) => dispatch([{ op: 'setPage', path: 'settings.maxWidth', value: v }])} />
        <div className="h-2" />
        <Field label="Fond de page" kind={{ kind: 'color' }} value={(doc.settings as any).pageBgColor} onChange={(v) => dispatch([{ op: 'setPage', path: 'settings.pageBgColor', value: v }])} />
        <p className="mt-4 text-slate-400">Sélectionnez un bloc, une rangée ou une section pour l’éditer.</p>
      </div>
    );
  }

  const def = node.type === 'block' ? getBlock(node.block) : undefined;
  const tabs: { key: Tab; label: string }[] = [
    { key: 'content', label: node.type === 'block' ? 'Contenu' : 'Disposition' },
    { key: 'style', label: 'Style' },
    { key: 'advanced', label: 'Avancé' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-3 pb-2 border-b border-slate-100">
        <p className="text-[10px] font-black uppercase tracking-wider text-indigo-600">{node.type === 'block' ? def?.meta.label.fr ?? node.block : node.type === 'layout' ? 'Rangée' : 'Section'}</p>
        <p className="text-xs text-slate-400 font-mono">#{node.id}</p>
        <div className="flex gap-1 mt-2">
          {tabs.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${tab === t.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === 'content' && node.type === 'block' && def && def.inspector.groups.map((group) => (
          <div key={group.title} className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">{group.title}</p>
            {group.fields.map((key) => (
              <Field
                key={key}
                label={fieldLabel(key)}
                kind={fieldKind(node.block, key)}
                value={(node.props as any)?.[key]}
                onChange={(v) => setField(node.id, `props.${key}`, v)}
              />
            ))}
          </div>
        ))}

        {tab === 'content' && node.type === 'layout' && (
          <div className="space-y-3">
            <Field label="Colonnes (douzièmes, ex. 7,5)" kind={{ kind: 'text' }} value={node.columns?.join(',') ?? ''} onChange={(v) => {
              const cols = String(v ?? '').split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n) && n > 0);
              setField(node.id, 'columns', cols.length ? cols : undefined);
            }} />
            <Field label="Espace entre colonnes" kind={{ kind: 'number' }} value={node.gap} onChange={(v) => setField(node.id, 'gap', v)} />
            <Field label="Colonnes sur mobile (vide = empilées)" kind={{ kind: 'text' }} value={node.responsive?.sm?.columns?.join(',') ?? ''} onChange={(v) => {
              const cols = String(v ?? '').split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n) && n > 0);
              setField(node.id, 'responsive.sm.columns', cols.length ? cols : undefined);
            }} />
          </div>
        )}

        {tab === 'content' && node.type === 'section' && (
          <div className="space-y-3">
            <Field label="Largeur du contenu (px)" kind={{ kind: 'number' }} value={node.style?.maxWidth} onChange={(v) => setField(node.id, 'style.maxWidth', v)} />
            <p className="text-[11px] text-slate-400">Une section est une bande pleine largeur. Son fond et ses marges sont dans l’onglet Style.</p>
          </div>
        )}

        {tab === 'style' && STYLE_FIELDS.map((f) => (
          <Field key={f.key} label={f.label} kind={f.kind} value={node.style?.[f.key]} onChange={(v) => setField(node.id, `style.${f.key}`, v)} />
        ))}

        {tab === 'advanced' && (
          <div className="space-y-3">
            <Field label="Nom (calques & IA)" kind={{ kind: 'text' }} value={node.label ?? ''} onChange={(v) => dispatch([{ op: 'rename', nodeId: node.id, label: String(v || '') || null }])} />
            <Field label="Masqué" kind={{ kind: 'boolean' }} value={node.hidden} onChange={(v) => setField(node.id, 'hidden', v ? true : undefined)} />
            <Field label="Masqué sur tablette et mobile" kind={{ kind: 'boolean' }} value={node.responsive?.md?.hidden} onChange={(v) => setField(node.id, 'responsive.md.hidden', v ? true : undefined)} />
            <Field label="Masqué sur mobile" kind={{ kind: 'boolean' }} value={node.responsive?.sm?.hidden} onChange={(v) => setField(node.id, 'responsive.sm.hidden', v ? true : undefined)} />
            <Field label="Verrouillé" kind={{ kind: 'boolean' }} value={node.locked} onChange={(v) => setField(node.id, 'locked', v ? true : undefined)} />
            {def?.presets && Object.keys(def.presets).length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Préréglages</span>
                <div className="flex flex-wrap gap-1">
                  {Object.keys(def.presets).map((p) => (
                    <button key={p} type="button" onClick={() => dispatch([{ op: 'applyPreset', nodeId: node.id, preset: p }])} className="px-2 py-1 rounded-md text-[11px] font-bold bg-slate-100 hover:bg-indigo-100 text-slate-700">{p}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

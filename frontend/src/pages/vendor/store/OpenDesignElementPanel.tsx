import React, { useMemo, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Crosshair, MousePointerClick } from 'lucide-react';
import { getBlock } from '@shared/blocks/index.js';
import type { AnyNode, BlockNode, PageDocument } from '@shared/document/index.js';
import type { GeneratedDesign } from '@shared/templates/opendesign.js';
import { fieldKind, fieldLabel, looksLikeColor } from '../../../studio/fields';
import { Field } from '../../../studio/Inspector';

/**
 * The element panel of OpenDesign Studio: what a click in the preview opens.
 *
 * The preview compiles the five documents into one page, the header's ids
 * prefixed `h_` and the footer's `f_` (storeCompiler/composeStorePage). A
 * click reports that composed id; `locateNode` maps it back to the document
 * and node it came from, and the panel edits that node's props through the
 * same generated fields Studio's inspector uses. Nothing here knows a block
 * by name.
 */

export type DesignPages = GeneratedDesign['pages'];
export type PageKey = keyof DesignPages;

export interface NodeRef {
  page: PageKey;
  id: string;
}

const PAGE_LABELS: Record<PageKey, string> = {
  home: 'Accueil',
  header: 'En-tête',
  footer: 'Pied de page',
  product: 'Fiche produit',
  catalogue: 'Catalogue',
};

function findIn(doc: PageDocument | undefined, id: string): BlockNode | null {
  if (!doc || !Array.isArray(doc.root)) return null;
  const visit = (node: AnyNode): BlockNode | null => {
    if (node.type === 'block') return node.id === id ? node : null;
    for (const child of node.children ?? []) {
      const hit = visit(child);
      if (hit) return hit;
    }
    return null;
  };
  for (const section of doc.root) {
    const hit = visit(section);
    if (hit) return hit;
  }
  return null;
}

/** The document and node behind a composed preview id. */
export function locateNode(pages: DesignPages, previewId: string, current: PageKey): NodeRef | null {
  const candidates: NodeRef[] = [];
  if (previewId.startsWith('h_')) candidates.push({ page: 'header', id: previewId.slice(2) });
  if (previewId.startsWith('f_')) candidates.push({ page: 'footer', id: previewId.slice(2) });
  candidates.push({ page: current, id: previewId });
  for (const page of Object.keys(pages) as PageKey[]) candidates.push({ page, id: previewId });
  for (const c of candidates) {
    if (findIn(pages[c.page], c.id)) return c;
  }
  return null;
}

export function getNode(pages: DesignPages, ref: NodeRef): BlockNode | null {
  return findIn(pages[ref.page], ref.id);
}

/** A copy of the pages with `mutate` applied to one node. The originals are never touched. */
export function updateNode(pages: DesignPages, ref: NodeRef, mutate: (node: BlockNode) => void): DesignPages {
  const next = JSON.parse(JSON.stringify(pages)) as DesignPages;
  const node = findIn(next[ref.page], ref.id);
  if (node) mutate(node);
  return next;
}

const norm = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();

/**
 * Replace the first prop whose text is `from` with `to`, anywhere in the
 * props tree — a headline, a slide's title, a link's label. Returns false
 * when nothing matched, which happens when the clicked element mixed several
 * props into one line; the panel's fields are the fallback for that.
 */
export function replaceText(props: Record<string, unknown>, from: string, to: string): boolean {
  const want = norm(from);
  if (!want) return false;
  const visit = (obj: any): boolean => {
    if (!obj || typeof obj !== 'object') return false;
    for (const key of Object.keys(obj)) {
      const v = obj[key];
      if (typeof v === 'string') {
        if (norm(v) === want) {
          obj[key] = to;
          return true;
        }
      } else if (v && typeof v === 'object' && visit(v)) return true;
    }
    return false;
  };
  return visit(props);
}

interface Props {
  pages: DesignPages;
  target: NodeRef;
  onChange: (pages: DesignPages) => void;
  onBack: () => void;
  /** Scroll the preview to the block again. */
  onLocate: () => void;
}

const LONG = /text|description|subtitle|paragraph|about|message|note|quote|answer/i;
/** Images, videos and links stay as the template made them: the panel never shows these. */
const MEDIA = /url|image|img|logo|src|video|poster|href|icon|avatar|photo|background(Image)?$/i;

function itemKind(key: string, value: unknown): ReturnType<typeof fieldKind> | null {
  if (MEDIA.test(key) && !looksLikeColor(key)) return null;
  if (typeof value === 'string') {
    if (looksLikeColor(key)) return { kind: 'color' };
    return LONG.test(key) || value.length > 80 ? { kind: 'textarea' } : { kind: 'text' };
  }
  if (typeof value === 'number') return { kind: 'number' };
  if (typeof value === 'boolean') return { kind: 'boolean' };
  return null;
}

export default function OpenDesignElementPanel({ pages, target, onChange, onBack, onLocate }: Props) {
  const node = useMemo(() => getNode(pages, target), [pages, target]);
  const [showAll, setShowAll] = useState(false);
  const def = node ? getBlock(node.block) : undefined;

  if (!node) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-3.5 h-3.5" /> Retour
        </button>
        <p className="text-xs text-slate-500">Ce bloc n’existe plus dans le design.</p>
      </div>
    );
  }

  const set = (mutate: (n: BlockNode) => void) => onChange(updateNode(pages, target, mutate));
  const setProp = (key: string, value: unknown) =>
    set((n) => {
      n.props = n.props ?? {};
      if (value === undefined || value === '') delete n.props[key];
      else n.props[key] = value;
    });
  const setItemProp = (key: string, index: number, itemKey: string, value: unknown) =>
    set((n) => {
      const list = n.props?.[key];
      if (!Array.isArray(list) || !list[index] || typeof list[index] !== 'object') return;
      (list[index] as Record<string, unknown>)[itemKey] = value;
    });

  const groups = def?.inspector.groups ?? [{ title: 'Contenu', fields: Object.keys(node.props ?? {}) }];
  const seen = new Set<string>();
  const label = def?.meta.label.fr ?? node.block;
  const sectionLabel = 'text-[11px] font-black uppercase tracking-wider text-slate-500';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-3.5 h-3.5" /> Retour
        </button>
        <button type="button" onClick={onLocate} title="Retrouver ce bloc dans l’aperçu" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900">
          <Crosshair className="w-3.5 h-3.5" /> Voir dans l’aperçu
        </button>
      </div>

      <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-wider text-indigo-600">{PAGE_LABELS[target.page]}</div>
            <h4 className="text-sm font-bold text-slate-900 truncate">{label}</h4>
            {def?.meta.description.fr && <p className="text-[11px] text-slate-600 leading-snug mt-0.5">{def.meta.description.fr}</p>}
          </div>
          <button
            type="button"
            onClick={() => set((n) => { n.hidden = !n.hidden; })}
            title={node.hidden ? 'Afficher ce bloc' : 'Masquer ce bloc'}
            className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
              node.hidden ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {node.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {node.hidden ? 'Masqué' : 'Visible'}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-500 leading-snug flex items-start gap-1.5">
          <MousePointerClick className="w-3.5 h-3.5 shrink-0 mt-px text-indigo-500" />
          Cliquez un texte dans l’aperçu pour l’écrire directement, ou modifiez les champs ci-dessous. Chaque changement recompile l’aperçu.
        </p>
      </div>

      {groups.map((group) => {
        const fields = group.fields.filter((key) => {
          if (seen.has(key)) return false;
          seen.add(key);
          if (MEDIA.test(key) && !looksLikeColor(key)) return false;
          const value = node.props?.[key];
          if (showAll) return true;
          if (Array.isArray(value)) return value.length > 0;
          return value !== undefined && value !== null && value !== '';
        });
        if (!fields.length) return null;
        return (
          <div key={group.title} className="space-y-2">
            <label className={sectionLabel}>{group.title}</label>
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
              {fields.map((key) => {
                const value = node.props?.[key];
                const kind = fieldKind(node.block, key);
                if (kind.kind === 'json') {
                  if (!Array.isArray(value)) return null;
                  const items = value.filter((it) => it && typeof it === 'object') as Record<string, unknown>[];
                  if (!items.length) return null;
                  return (
                    <div key={key} className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{fieldLabel(key)}</span>
                      {items.map((item, index) => {
                        const editable = Object.keys(item).filter((k) => itemKind(k, item[k]));
                        if (!editable.length) return null;
                        const title = norm(item.label ?? item.title ?? item.name ?? item.question ?? '') || `Élément ${index + 1}`;
                        return (
                          <div key={index} className="rounded-lg border border-slate-100 bg-slate-50/70 p-2 space-y-1.5">
                            <div className="text-[11px] font-bold text-slate-700 truncate">{index + 1}. {title}</div>
                            {editable.map((k) => (
                              <Field
                                key={k}
                                label={fieldLabel(k)}
                                kind={itemKind(k, item[k])!}
                                value={item[k]}
                                onChange={(v) => setItemProp(key, index, k, v)}
                              />
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  );
                }
                return <Field key={key} label={fieldLabel(key)} kind={kind} value={value} onChange={(v) => setProp(key, v)} />;
              })}
            </div>
          </div>
        );
      })}

      <div className="space-y-2">
        <label className={sectionLabel}>Fond du bloc</label>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <Field
            label="Couleur de fond"
            kind={{ kind: 'color' }}
            value={node.style?.background}
            onChange={(v) =>
              set((n) => {
                n.style = { ...(n.style ?? {}) };
                if (v === undefined || v === '') delete n.style.background;
                else n.style.background = String(v);
              })
            }
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowAll((s) => !s)}
        className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
      >
        {showAll ? 'Masquer les champs vides' : 'Afficher tous les champs du bloc'}
      </button>
    </div>
  );
}

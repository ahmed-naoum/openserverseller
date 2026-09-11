import React, { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Undo2, Redo2, Save, Monitor, Tablet, Smartphone, ExternalLink, Layers as LayersIcon, LayoutGrid, CloudUpload, History as HistoryIcon, Bot } from 'lucide-react';
import { useStudio } from './store';
import Canvas from './Canvas';
import Layers from './Layers';
import Library from './Library';
import Inspector from './Inspector';
import History from './History';
import AgentPanel from './AgentPanel';
import { buildReferralUrl, buildStoreUrl } from '../utils/referral';
import type { StudioTarget } from './api';
import { useAuth } from '../contexts/AuthContext';

/**
 * Studio: the page editor. Library or layers on the left, the canvas in the
 * middle, the generated inspector on the right, and a top bar for the things
 * that act on the page as a whole.
 */
export default function StudioPage() {
  const { id, pageId } = useParams<{ id: string; pageId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // What this URL edits. Store targets live under .../store/studio/...; a
  // referral link's landing page under .../links/:id/studio.
  const target: StudioTarget | null = location.pathname.includes('/store/studio/home')
    ? { kind: 'store-home' }
    : location.pathname.includes('/store/studio/header')
    ? { kind: 'store-header' }
    : location.pathname.includes('/store/studio/footer')
    ? { kind: 'store-footer' }
    : location.pathname.includes('/store/studio/product')
    ? { kind: 'store-product' }
    : location.pathname.includes('/store/studio/catalogue')
    ? { kind: 'store-catalogue' }
    : location.pathname.includes('/store/studio/pages/')
    ? Number.isInteger(parseInt(String(pageId), 10)) ? { kind: 'store-page', id: parseInt(String(pageId), 10) } : null
    : Number.isInteger(parseInt(String(id), 10)) ? { kind: 'landing', id: parseInt(String(id), 10) } : null;
  const { user } = useAuth() as any;

  const load = useStudio((s) => s.load);
  const loading = useStudio((s) => s.loading);
  const error = useStudio((s) => s.error);
  const doc = useStudio((s) => s.doc);
  const link = useStudio((s) => s.link);
  const pending = useStudio((s) => s.pending);
  const saving = useStudio((s) => s.saving);
  const save = useStudio((s) => s.save);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const undoStack = useStudio((s) => s.undoStack);
  const redoStack = useStudio((s) => s.redoStack);
  const viewport = useStudio((s) => s.viewport);
  const setViewport = useStudio((s) => s.setViewport);
  const leftTab = useStudio((s) => s.leftTab);
  const setLeftTab = useStudio((s) => s.setLeftTab);
  const removeNode = useStudio((s) => s.removeNode);
  const duplicateNode = useStudio((s) => s.duplicateNode);

  const meta = useStudio((s) => s.meta);
  const hasDraft = useStudio((s) => s.hasDraft);
  const publish = useStudio((s) => s.publish);
  const publishing = useStudio((s) => s.publishing);

  useEffect(() => {
    if (target) load(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.kind, (target as any)?.id, load]);

  // Keyboard: undo, redo, save, delete, duplicate.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); void save(); return; }
      if (typing) return;
      const selected = useStudio.getState().selectedId;
      if (!selected) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeNode(selected); }
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateNode(selected); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, save, removeNode, duplicateNode]);

  // Leaving with unsaved work asks first.
  useEffect(() => {
    if (!pending.length) return;
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [pending.length]);

  if (loading || (!doc && !error)) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-100"><div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (error) {
    return <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-100 text-sm text-slate-600"><p>{error}</p><button onClick={() => navigate(-1)} className="text-indigo-600 font-bold">Retour</button></div>;
  }

  const previewUrl = link
    ? buildReferralUrl(link.code, user?.subdomain, user?.customDomain, user?.customDomainStatus)
    : meta
    ? buildStoreUrl(meta.previewPath, user?.subdomain, user?.customDomain, user?.customDomainStatus)
    : null;

  return (
    <div className="h-screen flex flex-col bg-slate-100 text-slate-900">
      <header className="h-12 flex items-center gap-2 px-3 bg-white border-b border-slate-200 shadow-sm shrink-0">
        <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100" title="Retour"><ArrowLeft className="w-4 h-4" /></button>
        <div className="min-w-0">
          <p className="text-xs font-black leading-tight truncate">{meta?.label || link?.productName || 'Page'} <span className="text-slate-400 font-mono font-normal">{meta?.previewPath}</span></p>
          <p className="text-[10px] leading-tight">
            <span className="text-slate-400">Studio · </span>
            {pending.length ? (
              <span className="text-amber-600 font-bold">{pending.length} modification{pending.length > 1 ? 's' : ''} non enregistrée{pending.length > 1 ? 's' : ''}</span>
            ) : hasDraft ? (
              <span className="text-indigo-600 font-bold">Brouillon — non publié</span>
            ) : (
              <span className="text-emerald-600 font-bold">Publié</span>
            )}
          </p>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
          {([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([v, Icon]) => (
            <button key={v} type="button" onClick={() => setViewport(v)} className={`p-1.5 rounded-md ${viewport === v ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`} title={v}><Icon className="w-4 h-4" /></button>
          ))}
        </div>

        <div className="flex items-center gap-0.5">
          <button type="button" onClick={undo} disabled={!undoStack.length} className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30" title="Annuler (Ctrl+Z)"><Undo2 className="w-4 h-4" /></button>
          <button type="button" onClick={redo} disabled={!redoStack.length} className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30" title="Rétablir (Ctrl+Y)"><Redo2 className="w-4 h-4" /></button>
        </div>

        {previewUrl && (
          <a href={previewUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100" title="Ouvrir la page compilée"><ExternalLink className="w-3.5 h-3.5" /> Aperçu</a>
        )}
        <button type="button" onClick={() => void save()} disabled={saving || !pending.length} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40" title="Enregistrer le brouillon (Ctrl+S)">
          <Save className="w-3.5 h-3.5" /> {saving ? 'Enregistrement…' : 'Brouillon'}
        </button>
        <button type="button" onClick={() => void publish()} disabled={publishing || (!hasDraft && !pending.length)} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black text-white bg-slate-900 hover:bg-indigo-600 disabled:opacity-40" title="Mettre en ligne">
          <CloudUpload className="w-3.5 h-3.5" /> {publishing ? 'Publication…' : 'Publier'}
        </button>
      </header>

      <div className="flex-1 flex min-h-0">
        <aside className={`${leftTab === 'agent' ? 'w-96' : 'w-72'} bg-white border-r border-slate-200 flex flex-col shrink-0 transition-[width]`}>
          <div className="flex border-b border-slate-100">
            {([['library', 'Blocs', LayoutGrid], ['layers', 'Calques', LayersIcon], ['history', 'Versions', HistoryIcon], ['agent', 'IA', Bot]] as const).map(([key, label, Icon]) => (
              <button key={key} type="button" onClick={() => setLeftTab(key)} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold border-b-2 ${leftTab === key ? (key === 'agent' ? 'border-violet-600 text-violet-700' : 'border-indigo-600 text-indigo-600') : 'border-transparent text-slate-500'}`}><Icon className="w-3.5 h-3.5" /> {label}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">{leftTab === 'library' ? <Library /> : leftTab === 'layers' ? <Layers /> : leftTab === 'history' ? <History /> : <AgentPanel />}</div>
        </aside>

        <main className="flex-1 flex min-w-0"><Canvas /></main>

        <aside className="w-80 bg-white border-l border-slate-200 shrink-0 overflow-hidden"><Inspector /></aside>
      </div>
    </div>
  );
}

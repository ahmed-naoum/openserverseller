import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Bot, Sparkles, Loader2, CheckCircle2, XCircle, AlertTriangle, CloudUpload, FileEdit, History as HistoryIcon, ChevronDown, ChevronRight, Send } from 'lucide-react';
import { useStudio } from './store';
import { studioApi, type AgentRunResult, type AgentStatus, type StudioTarget } from './api';

/**
 * The "IA" tab: the seller tells the agent what to change, in a sentence,
 * and the agent edits the store through the same operations the editor
 * uses. Pages it touches get a draft; the seller looks and publishes.
 *
 * Local unsaved edits are saved to the draft first, so the agent works on
 * what the seller sees. After a run the current page is reloaded from the
 * server, since the agent's changes are already in its draft.
 */

const EXAMPLES = [
  'Change le titre de l’accroche en « Livraison gratuite dès 300 DH » et mets le bouton en rouge',
  'Ajoute une section avis clients et une FAQ sous les produits',
  'Ajoute un bandeau d’annonce « -20 % ce week-end » dans l’en-tête',
  'Mets le numéro WhatsApp 06 12 34 56 78 partout et ajoute Instagram',
  'Crée une page « Livraison & retours » avec les étapes de commande et la FAQ',
  'Refais entièrement la boutique : cosmétiques bio au safran, fond rose poudré, avec photos',
];

function focusOf(target: StudioTarget | null): string | null {
  if (!target) return null;
  switch (target.kind) {
    case 'store-home':
      return 'home';
    case 'store-header':
      return 'header';
    case 'store-footer':
      return 'footer';
    case 'store-product':
      return 'product';
    case 'store-catalogue':
      return 'catalogue';
    case 'store-page':
      return `page:${target.id}`;
    default:
      return null;
  }
}

export default function AgentPanel() {
  const location = useLocation();
  const target = useStudio((s) => s.target);
  const load = useStudio((s) => s.load);
  const pending = useStudio((s) => s.pending);
  const save = useStudio((s) => s.save);

  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [instruction, setInstruction] = useState('');
  const [provider, setProvider] = useState<'claude' | 'openai'>('claude');
  const [publish, setPublish] = useState(false);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [showRuns, setShowRuns] = useState(false);

  const focus = focusOf(target);
  const base = location.pathname.includes('/store/studio') ? location.pathname.slice(0, location.pathname.indexOf('/store/studio')) : '/dashboard';

  const refresh = useCallback(async () => {
    try {
      const res = await studioApi.agentStatus();
      const d = res.data.data;
      setStatus(d);
      setStatusError(null);
      if (!d.providers.claude.available && d.providers.openai.available) setProvider('openai');
    } catch (err: any) {
      setStatusError(err?.response?.data?.message || 'Impossible de joindre l’agent.');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!running) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const bothBrains = Boolean(status?.providers.claude.available && status?.providers.openai.available);
  const brainLabel = provider === 'openai' ? status?.providers.openai.model ?? 'GPT' : status?.providers.claude.model ?? 'Claude';

  const run = async () => {
    const text = instruction.trim();
    if (!text) {
      toast.error('Dites à l’agent ce que vous voulez changer.');
      return;
    }
    if (!focus) {
      toast.error('L’agent gère la boutique : ouvrez une page de la boutique (accueil, en-tête, fiche produit…).');
      return;
    }
    if (pending.length && !(await save())) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await studioApi.agentRun({ instruction: text, provider, focus, publish: publish && Boolean(status?.allowPublish) });
      const data = res.data.data;
      setResult(data);
      if (data.error) toast.error(data.error, { duration: 8000 });
      else if (data.actions.every((a) => a.ok)) toast.success('L’agent a terminé');
      else toast('L’agent a terminé avec des réserves : lisez le détail.', { icon: '⚠️' });
      if (target) await load(target);
      await refresh();
    } catch (err: any) {
      const message = err?.response?.data?.message || (err?.code === 'ECONNABORTED' ? 'Délai dépassé : l’agent a mis trop de temps.' : 'L’agent a échoué.');
      toast.error(message, { duration: 8000 });
      setResult({ id: null, summary: '', model: null, provider, actions: [], drafts: [], published: [], durationMs: 0, usage: { input: 0, output: 0 }, error: message });
    } finally {
      setRunning(false);
    }
  };

  const okCount = useMemo(() => result?.actions.filter((a) => a.ok).length ?? 0, [result]);

  if (statusError) {
    return <div className="p-4 text-xs text-rose-600">{statusError}</div>;
  }
  if (!status) {
    return (
      <div className="p-4 flex items-center gap-2 text-xs text-slate-500">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Chargement de l’agent…
      </div>
    );
  }
  if (!status.enabled) {
    return (
      <div className="p-4 space-y-2 text-xs text-slate-600">
        <p className="flex items-center gap-1.5 font-bold text-slate-800"><Bot className="w-4 h-4 text-indigo-500" /> Agent IA indisponible</p>
        <p>L’administrateur n’a pas activé l’agent, ou aucun modèle IA n’est configuré pour le constructeur.</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3 text-xs">
      <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 p-3 space-y-1">
        <p className="flex items-center gap-1.5 font-black text-slate-900 text-sm"><Bot className="w-4 h-4 text-indigo-600" /> Agent IA de la boutique</p>
        <p className="text-[11px] text-slate-600 leading-snug">
          Dites ce que vous voulez changer : textes, sections, couleurs, photos, pages, réglages. L’agent modifie la boutique dans les brouillons ; vous vérifiez, puis vous publiez.
        </p>
      </div>

      {!focus && (
        <p className="flex items-start gap-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> Ouvrez une page de la boutique pour utiliser l’agent.
        </p>
      )}

      <textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void run();
        }}
        rows={4}
        maxLength={2000}
        disabled={running}
        placeholder="Ex. : ajoute une section avis clients sous les produits et mets le bouton principal en rouge"
        className="w-full rounded-xl bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none text-xs text-slate-900 placeholder-slate-400 p-2.5 leading-relaxed resize-none disabled:opacity-60"
      />

      <div className="flex flex-wrap gap-1">
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" disabled={running} onClick={() => setInstruction(ex)} className="px-2 py-1 rounded-md bg-white border border-slate-200 text-[10px] font-semibold text-slate-600 hover:border-indigo-400 hover:text-indigo-700 text-left disabled:opacity-50">
            {ex.length > 52 ? ex.slice(0, 52) + '…' : ex}
          </button>
        ))}
      </div>

      {bothBrains && (
        <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
          {(['claude', 'openai'] as const).map((p) => (
            <button key={p} type="button" disabled={running} onClick={() => setProvider(p)} className={`flex-1 py-1 rounded-md text-[11px] font-bold transition-colors ${provider === p ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500'}`}>
              {p === 'claude' ? 'Claude' : 'GPT'}
            </button>
          ))}
        </div>
      )}

      {status.allowPublish && (
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" checked={publish} disabled={running} onChange={(e) => setPublish(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-indigo-600" />
          <span className="text-[11px] text-slate-600 leading-snug"><span className="font-bold text-slate-800">Publier directement</span> les pages modifiées, sans passer par le brouillon.</span>
        </label>
      )}

      <button
        type="button"
        disabled={running || !focus}
        onClick={() => void run()}
        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 shadow-sm"
      >
        {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        {running ? `${brainLabel} travaille… ${elapsed}s` : `Demander à ${brainLabel}`}
      </button>
      {running && <p className="text-[11px] text-slate-500 leading-snug">Une lecture de la boutique, un plan, puis chaque étape. Comptez 30 à 90 s, plus si des photos sont dessinées.</p>}

      {result && (
        <div className="space-y-2">
          {result.error && (
            <p className="flex items-start gap-1.5 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800"><XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {result.error}</p>
          )}
          {result.summary && (
            <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1">
              <p className="flex items-center gap-1.5 font-bold text-slate-800"><Sparkles className="w-3.5 h-3.5 text-violet-500" /> {result.model ?? 'IA'} · {Math.round(result.durationMs / 1000)} s</p>
              <p className="text-slate-700 leading-snug">{result.summary}</p>
            </div>
          )}
          {result.actions.length > 0 && (
            <div className="space-y-1">
              <p className="font-bold text-slate-700">{okCount}/{result.actions.length} étape{result.actions.length > 1 ? 's' : ''} réussie{okCount > 1 ? 's' : ''}</p>
              <ul className="space-y-1">
                {result.actions.map((a) => (
                  <li key={`${a.round}-${a.index}`} className={`flex gap-1.5 p-2 rounded-lg border ${a.ok ? 'bg-emerald-50/60 border-emerald-100' : 'bg-amber-50 border-amber-200'}`}>
                    {a.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />}
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-800">{a.note || a.type}{a.target ? ` · ${a.target}` : ''}{a.round > 1 ? ' · réparation' : ''}</span>
                      <span className="block text-[11px] text-slate-600 break-words">{a.detail}</span>
                      {a.refused && a.refused.length > 0 && (
                        <span className="block text-[10px] text-amber-700 break-words">{a.refused.slice(0, 3).map((r) => r.reason).join(' · ')}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.drafts.length > 0 && (
            <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-100 space-y-1">
              <p className="flex items-center gap-1.5 font-bold text-indigo-900"><FileEdit className="w-3.5 h-3.5" /> Brouillons à vérifier puis publier</p>
              <ul className="space-y-0.5">
                {result.drafts.map((d) => (
                  <li key={d.key}>
                    {d.key === focus ? (
                      <span className="text-indigo-800">{d.label} — cette page (bouton Publier en haut)</span>
                    ) : (
                      <Link to={`${base}${d.studioPath}`} className="text-indigo-700 font-semibold hover:underline">{d.label} →</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.published.length > 0 && (
            <p className="flex items-center gap-1.5 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold"><CloudUpload className="w-3.5 h-3.5" /> Publié : {result.published.map((p) => p.label).join(', ')}</p>
          )}
        </div>
      )}

      {status.runs.length > 0 && (
        <div className="pt-2 border-t border-slate-200">
          <button type="button" onClick={() => setShowRuns((v) => !v)} className="w-full flex items-center gap-1.5 text-[11px] font-bold text-slate-600 hover:text-slate-900">
            {showRuns ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />} <HistoryIcon className="w-3.5 h-3.5" /> Dernières demandes ({status.runs.length})
          </button>
          {showRuns && (
            <ul className="mt-2 space-y-1.5">
              {status.runs.map((r) => (
                <li key={r.id} className="p-2 rounded-lg bg-white border border-slate-200 space-y-0.5">
                  <p className="text-[10px] text-slate-400">{new Date(r.createdAt).toLocaleString('fr-FR')} · {r.model ?? r.provider} · {r.status === 'done' ? 'terminé' : r.status === 'partial' ? 'partiel' : 'échec'}</p>
                  <p className="text-slate-800 font-semibold break-words">{r.instruction}</p>
                  {r.summary && <p className="text-[11px] text-slate-600 break-words">{r.summary}</p>}
                  <button type="button" onClick={() => setInstruction(r.instruction)} className="text-[10px] font-bold text-indigo-600 hover:underline">Reprendre</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

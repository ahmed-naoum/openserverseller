import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Sparkles,
  Wand2,
  Check,
  Palette,
  Layers,
  RefreshCw,
  Monitor,
  Tablet,
  Smartphone,
  Sun,
  Moon,
  SunMoon,
  Lightbulb,
  Type,
  Plus,
  Bot,
  Cpu,
  Search,
  CheckCircle2,
  SlidersHorizontal,
  Terminal,
  Clock,
  Zap,
  AlertCircle,
  Loader2,
  ShoppingBag,
  ChevronRight,
  MousePointerClick,
  Image as ImageIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { studioApi, generateDesignStream, type DesignProviders, type GenerateEvent } from '../../../studio/api';
import { EXAMPLE_BRIEFS, type GeneratedDesign } from '@shared/templates/opendesign.js';
import { SECTIONS_CATALOG, type SectionCategory, type SectionDefinition } from '@shared/templates/sections.js';
import CompiledPreview, { type PreviewPage, type PreviewViewport, type PreviewMessage } from './CompiledPreview';
import OpenDesignElementPanel, { locateNode, updateNode, replaceText, type NodeRef, type DesignPages } from './OpenDesignElementPanel';

interface OpenDesignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Mode = 'auto' | 'light' | 'dark';

interface Engine {
  ai: boolean;
  model?: string | null;
  note?: string | null;
}

/** Which brain reads the brief: the local Claude CLI, GPT (when the admin set an OpenAI key), or the built-in reader. */
type GenerationMode = 'ai' | 'gpt' | 'instant';

const MODE_LABEL: Record<GenerationMode, string> = { ai: 'Claude CLI', gpt: 'GPT', instant: 'Mode Rapide' };

/** The selector's look per engine: a long label when two are offered, a short one when three must fit. */
const MODE_UI: Record<GenerationMode, { long: string; short: string; icon: React.ComponentType<{ className?: string }>; iconClass: string; active: string }> = {
  ai: { long: 'Mode IA Claude CLI', short: 'IA Claude', icon: Sparkles, iconClass: 'text-violet-600', active: 'bg-white text-violet-700 shadow-xs border border-violet-200' },
  gpt: { long: 'Mode IA GPT', short: 'IA GPT', icon: Bot, iconClass: 'text-emerald-600', active: 'bg-white text-emerald-700 shadow-xs border border-emerald-200' },
  instant: { long: 'Mode Rapide (< 1s)', short: 'Rapide', icon: Zap, iconClass: 'text-amber-500', active: 'bg-white text-amber-700 shadow-xs border border-amber-200' },
};

const API_MODE: Record<'claude' | 'gpt' | 'instant', GenerationMode> = { claude: 'ai', gpt: 'gpt', instant: 'instant' };

/** What the building screen shows: the real events of the generation in progress. */
interface LivePhoto { status: 'start' | 'done' | 'fail'; engine?: string; url?: string; error?: string; ms?: number }
interface LiveLog { t: number; prefix: string; text: string; tone: 'info' | 'ok' | 'warn' | 'model' }
export interface LiveState {
  startedAt: number;
  stage: 'read' | 'compose' | 'photos' | 'validate' | null;
  skipAi: boolean;
  model: string | null;
  thinkingTokens: number;
  /** The model's answer as it is written: the JSON of the spec, token by token. */
  brainText: string;
  spec: any | null;
  engine: (Engine & { ms?: number }) | null;
  photos: Record<string, LivePhoto>;
  sections: { index: number; label: string; total: number; variant?: string | null }[];
  pages: Record<string, { blocks: number; sections: number }>;
  log: LiveLog[];
}

const emptyLive = (): LiveState => ({ startedAt: Date.now(), stage: null, skipAi: false, model: null, thinkingTokens: 0, brainText: '', spec: null, engine: null, photos: {}, sections: [], pages: {}, log: [] });

const PHOTO_LABEL: Record<string, string> = { hero: 'accroche', story: 'histoire', promo: 'promotion' };

function reduceLive(s: LiveState, e: GenerateEvent): LiveState {
  const t = Math.round((Date.now() - s.startedAt) / 1000);
  const log = (prefix: string, text: string, tone: LiveLog['tone'] = 'info') => [...s.log, { t, prefix, text, tone }].slice(-120);
  const d = e.data ?? {};
  switch (e.event) {
    case 'stage':
      return { ...s, stage: d.id, skipAi: Boolean(d.skipAi), log: log('ÉTAPE', d.label) };
    case 'brain':
      if (d.type === 'model') return { ...s, model: d.model, log: log('MODÈLE', `${d.model} connecté, lecture du brief…`, 'model') };
      if (d.type === 'thinking') return { ...s, thinkingTokens: Math.max(s.thinkingTokens, Number(d.tokens) || 0) };
      if (d.type === 'delta') return { ...s, brainText: s.brainText + String(d.text ?? '') };
      return s;
    case 'engine':
      return { ...s, engine: d, log: log(d.ai ? 'LU' : 'SECOURS', d.ai ? `Brief lu par ${d.model} en ${Math.round((d.ms ?? 0) / 1000)} s` : String(d.note ?? 'Lecture intégrée'), d.ai ? 'ok' : 'warn') };
    case 'spec':
      return { ...s, spec: d, log: log('COMPRIS', d.summary ?? `Niche ${d.niche}, ambiance ${d.mood}`, 'ok') };
    case 'photo': {
      const photos = { ...s.photos, [d.key]: { status: d.status, engine: d.engine, url: d.url, error: d.error, ms: d.ms } };
      const label = PHOTO_LABEL[d.key] ?? d.key;
      const text = d.status === 'start' ? `Photo « ${label} » : ${d.engine} dessine…` : d.status === 'done' ? `Photo « ${label} » prête (${d.engine}${d.ms ? `, ${Math.round(d.ms / 1000)} s` : ''})` : `Photo « ${label} » : ${d.error}`;
      return { ...s, photos, log: log('PHOTO', text, d.status === 'done' ? 'ok' : d.status === 'fail' ? 'warn' : 'info') };
    }
    case 'section':
      return { ...s, sections: [...s.sections, d], log: log('SECTION', `${d.index + 1}/${d.total} · ${d.label}${d.variant ? ` (${d.variant})` : ''}`, 'ok') };
    case 'page':
      return { ...s, pages: { ...s.pages, [d.key]: { blocks: d.blocks, sections: d.sections } } };
    case 'done':
      return { ...s, stage: null, log: log('FIN', 'Boutique composée et validée', 'ok') };
    default:
      return s;
  }
}

function modesOf(p: DesignProviders): GenerationMode[] {
  const list: GenerationMode[] = [];
  if (p.claude?.available) list.push('ai');
  if (p.openai?.available) list.push('gpt');
  if (p.instant?.available !== false) list.push('instant');
  return list.length ? list : ['instant'];
}

const FONTS = ['Manrope', 'Plus Jakarta Sans', 'Space Grotesk', 'Playfair Display', 'Cairo', 'Inter', 'Poppins', 'DM Sans', 'Lora', 'Montserrat'];

const TOKENS: { key: keyof GeneratedDesign['palette']; label: string }[] = [
  { key: 'primary', label: 'Principale (boutons, prix)' },
  { key: 'secondary', label: 'Secondaire (bandeaux, pied de page)' },
  { key: 'bg', label: 'Fond de page' },
  { key: 'text', label: 'Texte' },
  { key: 'muted', label: 'Texte atténué' },
  { key: 'accent', label: 'Accent' },
];

const PAGES: { id: PreviewPage; label: string }[] = [
  { id: 'home', label: 'Accueil' },
  { id: 'product', label: 'Fiche produit' },
  { id: 'catalogue', label: 'Catalogue' },
];

const SECTION_CATEGORIES: { key: SectionCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'Toutes (60)' },
  { key: 'hero', label: 'Accroches (6)' },
  { key: 'trust', label: 'Garanties (7)' },
  { key: 'product', label: 'Produits (7)' },
  { key: 'bundles', label: 'Packs & Offres (6)' },
  { key: 'social_proof', label: 'Avis Clients (7)' },
  { key: 'how_to', label: 'Commander (5)' },
  { key: 'urgency', label: 'Vente Flash (6)' },
  { key: 'story', label: 'Histoire (5)' },
  { key: 'faq', label: 'FAQ (5)' },
  { key: 'cta', label: 'Appels à l\'action (6)' },
];

const QUICK_ADDS: { label: string; phrase: string }[] = [
  { label: 'Bouton dans l’accroche', phrase: 'ajoute un bouton « Commander maintenant » dans l’accroche' },
  { label: 'Packs dégressifs', phrase: 'avec des packs dégressifs quantité' },
  { label: '1 Acheté = 1 Offert', phrase: 'avec offre 1 acheté 1 offert' },
  { label: 'Compte à rebours', phrase: 'avec un compte à rebours' },
  { label: 'Promotion', phrase: 'avec une promotion' },
  { label: 'Avis clients', phrase: 'avec des avis clients' },
  { label: 'FAQ', phrase: 'avec une FAQ' },
  { label: 'Chiffres clés', phrase: 'avec des chiffres clés' },
  { label: 'Notre histoire', phrase: 'avec notre histoire' },
  { label: 'Étapes de commande', phrase: 'avec les étapes de commande' },
  { label: 'Comparatif qualité', phrase: 'avec un comparatif avant après' },
  { label: 'Alerte stock', phrase: 'avec alerte stock limité' },
  { label: 'Bandeau défilant', phrase: 'avec un bandeau défilant' },
  { label: 'Carrousel produits', phrase: 'catalogue en carrousel' },
  { label: 'Fond noir', phrase: 'fond noir' },
  { label: 'Sans FAQ', phrase: 'sans FAQ' },
];

export default function OpenDesignModal({ isOpen, onClose, onSuccess }: OpenDesignModalProps) {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<Mode>('auto');
  const [seed, setSeed] = useState(0);
  const [design, setDesign] = useState<GeneratedDesign | null>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [overrides, setOverrides] = useState<Partial<Record<string, string>>>({});
  const [fontOverride, setFontOverride] = useState<string>('');
  const [extraSectionIds, setExtraSectionIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [generationMode, setGenerationMode] = useState<GenerationMode>('ai');
  const [providers, setProviders] = useState<DesignProviders | null>(null);
  // Photos drawn by GPT for the brief. Kept with the brief they were drawn
  // for: a new arrangement of the same brief reuses them (no new billing), a
  // changed brief starts without.
  const [withImages, setWithImages] = useState(false);
  const [images, setImages] = useState<{ map: Record<string, string>; prompt: string } | null>(null);
  /** The generation in progress, as the server reports it. */
  const [live, setLive] = useState<LiveState>(emptyLive);
  /** The next preview after a generation reveals its sections one by one. */
  const revealRef = useRef(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  /** Set when an AI mode was asked for but the built-in reader answered: the seller must see it, not guess it. */
  const [aiFallback, setAiFallback] = useState<{ mode: GenerationMode; note: string } | null>(null);
  /** The last photo run's outcome, kept on screen until the next generation. */
  const [photos, setPhotos] = useState<{ model: string; generated: number; sources?: Record<string, string>; errors: string[]; durationMs: number } | null>(null);
  const [applying, setApplying] = useState(false);
  const [page, setPage] = useState<PreviewPage>('home');
  const [viewport, setViewport] = useState<PreviewViewport>('desktop');
  const [panel, setPanel] = useState<'brief' | 'sections' | 'tokens' | 'element'>('brief');
  const [version, setVersion] = useState(0);
  // Click-to-edit: the preview reports the block under a click; the panel
  // edits it. Direct edits live in `design.pages`, so installing keeps them.
  const [inspect, setInspect] = useState(true);
  const [selected, setSelected] = useState<NodeRef | null>(null);
  const [locateTick, setLocateTick] = useState(0);
  const edited = useRef(false);
  const refreshTimer = useRef<number | null>(null);

  // Section catalog search and filter
  const [sectionCategory, setSectionCategory] = useState<SectionCategory | 'all'>('all');
  const [sectionSearch, setSectionSearch] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setPage('home');
    void studioApi.designExamples().then((res) => {
      const e = (res.data.data as any)?.engine;
      if (e) setEngine((prev) => prev ?? e);
      const p = res.data.data?.providers;
      if (p) {
        setProviders(p);
        // The admin's pre-selected engine, or the first one offered.
        const offered = modesOf(p);
        const wanted = API_MODE[p.default] ?? offered[0];
        setGenerationMode(offered.includes(wanted) ? wanted : offered[0]);
      }
    }).catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!generating) {
      setElapsedSec(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [generating]);

  const generate = useCallback(
    async (opts: { prompt?: string; seed?: number; palette?: Record<string, string>; fontFamily?: string; mode?: Mode; extraSectionIds?: string[]; skipAi?: boolean; withImages?: boolean } = {}) => {
      const text = (opts.prompt ?? prompt).trim();
      if (!text) {
        toast.error('Décrivez votre boutique en une phrase : ce que vous vendez, l’ambiance, une couleur.');
        return;
      }
      if (edited.current && !window.confirm('Régénérer remplace les modifications faites directement dans l’aperçu. Continuer ?')) return;
      setGenerating(true);
      setGenerationError(null);
      try {
        const sectionsToSend = opts.extraSectionIds ?? extraSectionIds;
        const skipAi = opts.skipAi ?? (generationMode === 'instant');
        const provider = generationMode === 'gpt' ? 'openai' : 'claude';
        const kept = images && images.prompt === text ? images.map : undefined;
        const drawImages = opts.withImages ?? (withImages && Boolean(providers?.openai?.images) && !kept);
        setLive(emptyLive());
        const data = await generateDesignStream(
          {
            prompt: text,
            seed: opts.seed ?? seed,
            mode: opts.mode ?? mode,
            palette: opts.palette ?? (Object.keys(overrides).length ? (overrides as Record<string, string>) : undefined),
            fontFamily: opts.fontFamily ?? (fontOverride || undefined),
            extraSectionIds: sectionsToSend.length > 0 ? sectionsToSend : undefined,
            skipAi,
            provider,
            images: kept,
            withImages: drawImages,
          },
          (e) => setLive((prev) => reduceLive(prev, e)),
        );
        revealRef.current = true;
        setDesign(data.design);
        setEngine(data.engine ?? null);
        setAiFallback(!skipAi && !data.engine?.ai ? { mode: generationMode, note: data.engine?.note ?? 'Aucune réponse du modèle.' } : null);
        setPhotos(drawImages ? (data.photos ?? null) : null);
        if (data.images && Object.keys(data.images).length) setImages({ map: data.images, prompt: text });
        if (data.photos) {
          if (data.photos.generated) toast.success(`${data.photos.generated} photo${data.photos.generated > 1 ? 's' : ''} dessinée${data.photos.generated > 1 ? 's' : ''} par ${data.photos.model} en ${Math.round(data.photos.durationMs / 1000)} s`);
          for (const e of data.photos.errors ?? []) toast.error(e, { duration: 8000 });
        }
        setVersion((v) => v + 1);
        setPage('home');
        setSelected(null);
        edited.current = false;
        setPanel((p) => (p === 'element' ? 'brief' : p));
      } catch (err: any) {
        const errMsg = err?.response?.data?.message || (err?.code === 'ECONNABORTED' ? 'Le délai de génération a été dépassé.' : err?.message || 'La génération a échoué. Réessayez dans un instant.');
        setGenerationError(errMsg);
        toast.error(errMsg);
      } finally {
        setGenerating(false);
      }
    },
    [prompt, seed, mode, overrides, fontOverride, extraSectionIds, generationMode, images, withImages, providers]
  );

  const useExample = (text: string) => {
    setPrompt(text);
    setSeed(0);
    setOverrides({});
    setFontOverride('');
    setExtraSectionIds([]);
    void generate({ prompt: text, seed: 0, palette: undefined, fontFamily: undefined, extraSectionIds: [] });
  };

  const quickAdd = (phrase: string) => {
    setPrompt((p) => {
      const base = p.trim();
      if (base.toLowerCase().includes(phrase.toLowerCase())) return base;
      return base ? `${base.replace(/[.,;]\s*$/, '')}, ${phrase}` : phrase;
    });
  };

  const anotherVariant = () => {
    const next = seed + 1;
    setSeed(next);
    void generate({ seed: next });
  };

  const changeMode = (m: Mode) => {
    setMode(m);
    if (design) void generate({ mode: m });
  };

  const toggleSection = (secId: string) => {
    let next: string[];
    if (extraSectionIds.includes(secId)) {
      next = extraSectionIds.filter((id) => id !== secId);
      toast.success('Section retirée');
    } else {
      next = [...extraSectionIds, secId];
      toast.success('Section ajoutée à l\'accueil');
    }
    setExtraSectionIds(next);
    if (design) {
      void generate({ extraSectionIds: next });
    }
  };

  /** The engines the admin offers, in selector order. Before the API answers, the historical pair. */
  const modes = useMemo(() => (providers ? modesOf(providers) : (['ai', 'instant'] as GenerationMode[])), [providers]);
  const instantOffered = modes.includes('instant');
  const imagesReady = Boolean(images && images.prompt === prompt.trim() && Object.keys(images.map).length);
  /** What the building screen calls the brain at work. */
  const hudLabel = generationMode === 'gpt'
    ? (providers?.openai?.model ?? 'GPT (OpenAI)')
    : (providers?.claude?.model ?? engine?.model ?? 'Claude CLI');

  const paletteShown = useMemo(() => {
    if (!design) return null;
    return { ...design.palette, ...overrides };
  }, [design, overrides]);

  const loader = useCallback(
    async (p: PreviewPage) => {
      if (!design) return { html: '', placeholder: true, products: 0 };
      const reveal = revealRef.current;
      revealRef.current = false;
      const res = await studioApi.previewDesign({
        pages: design.pages,
        palette: paletteShown,
        fontFamily: fontOverride || design.fontFamily,
        page: p,
        inspect,
        reveal,
      });
      return res.data.data;
    },
    [design, paletteShown, fontOverride, inspect]
  );

  /** Recompile the preview once the seller pauses — a colour picker fires on every pixel of a drag. */
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null;
      setVersion((v) => v + 1);
    }, 400);
  }, []);

  const setPages = useCallback(
    (pages: DesignPages) => {
      edited.current = true;
      setDesign((d) => (d ? { ...d, pages } : d));
      scheduleRefresh();
    },
    [scheduleRefresh]
  );

  const onPreviewMessage = useCallback(
    (msg: PreviewMessage) => {
      if (!design || !msg.nodeId) return;
      const ref = locateNode(design.pages, msg.nodeId, page);
      if (!ref) return;
      if (msg.type === 'select') {
        setSelected(ref);
        setPanel('element');
        return;
      }
      if (msg.type === 'text' && typeof msg.from === 'string' && typeof msg.to === 'string') {
        let matched = false;
        const next = updateNode(design.pages, ref, (n) => {
          matched = replaceText((n.props ?? {}) as Record<string, unknown>, msg.from!, msg.to!);
        });
        setSelected(ref);
        setPanel('element');
        if (matched) {
          edited.current = true;
          setDesign({ ...design, pages: next });
          setVersion((v) => v + 1);
          toast.success('Texte modifié');
        } else {
          toast('Ce texte combine plusieurs champs : modifiez-le dans le panneau Élément.', { icon: '✏️' });
        }
      }
    },
    [design, page]
  );

  const highlightId = selected ? (selected.page === 'header' ? `h_${selected.id}` : selected.page === 'footer' ? `f_${selected.id}` : selected.id) : null;

  const apply = async () => {
    if (!design) return;
    setApplying(true);
    try {
      await studioApi.installCustomTheme({
        label: design.label,
        palette: paletteShown,
        fontFamily: fontOverride || design.fontFamily,
        pages: design.pages,
      });
      toast.success(`Modèle « ${design.label} » appliqué à votre boutique`);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'L’installation a échoué');
    } finally {
      setApplying(false);
    }
  };

  const filteredCatalog = useMemo(() => {
    const q = sectionSearch.trim().toLowerCase();
    return SECTIONS_CATALOG.filter((s) => {
      const matchCat = sectionCategory === 'all' || s.category === sectionCategory;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.categoryLabel.toLowerCase().includes(q)
      );
    });
  }, [sectionCategory, sectionSearch]);

  if (!isOpen) return null;

  const sectionLabel = 'text-[11px] font-black uppercase tracking-wider text-slate-500';

  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-[1400px] h-[94vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-slate-900"
        role="dialog"
        aria-modal="true"
        aria-label="OpenDesign Studio"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">OpenDesign Studio</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Alternative Claude Design
                </span>
                <span className="hidden sm:inline px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  +60 Sections E-Commerce
                </span>
              </div>
              <p className="text-[12px] text-slate-500">Décrivez ce que vous vendez : le moteur compose vos 5 pages, la palette et choisit les sections de conversion.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 rounded-xl p-0.5">
              <button type="button" onClick={() => setViewport('desktop')} className={`p-1.5 rounded-lg transition-colors ${viewport === 'desktop' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`} title="Bureau (100%)">
                <Monitor className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setViewport('tablet')} className={`p-1.5 rounded-lg transition-colors ${viewport === 'tablet' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`} title="Tablette (768px)">
                <Tablet className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setViewport('mobile')} className={`p-1.5 rounded-lg transition-colors ${viewport === 'mobile' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`} title="Mobile (390px)">
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
            <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors" aria-label="Fermer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex min-h-0">
          {/* Left panel */}
          <aside className="w-[410px] shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col min-h-0">
            {/* 3 Tabs: Description, Sections (+60), Couleurs */}
            <div className="flex items-center gap-1 p-2 border-b border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setPanel('brief')}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-bold transition-colors ${
                  panel === 'brief' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Wand2 className="w-3.5 h-3.5" /> Description
              </button>
              <button
                type="button"
                onClick={() => setPanel('sections')}
                className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-bold transition-colors ${
                  panel === 'sections' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> Sections (+60)
                {extraSectionIds.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-indigo-500 text-white text-[10px] font-black">
                    +{extraSectionIds.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                disabled={!design}
                onClick={() => setPanel('tokens')}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-40 ${
                  panel === 'tokens' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Palette className="w-3.5 h-3.5" /> Couleurs
              </button>
              {selected && design && (
                <button
                  type="button"
                  onClick={() => setPanel('element')}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-bold transition-colors ${
                    panel === 'element' ? 'bg-indigo-600 text-white' : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100'
                  }`}
                >
                  <MousePointerClick className="w-3.5 h-3.5" /> Élément
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* ─── TAB 0: SELECTED ELEMENT (click-to-edit) ─── */}
              {panel === 'element' && design && selected && (
                <OpenDesignElementPanel
                  pages={design.pages}
                  target={selected}
                  onChange={setPages}
                  onBack={() => setPanel('brief')}
                  onLocate={() => setLocateTick((t) => t + 1)}
                />
              )}

              {/* ─── TAB 1: BRIEF DESCRIPTION ─── */}
              {panel === 'brief' && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className={sectionLabel}>Votre boutique, en une phrase</label>
                      {engine?.ai && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-100">
                          <Sparkles className="w-3 h-3 text-violet-500" /> {engine.model ?? 'Claude CLI'}
                        </span>
                      )}
                    </div>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void generate({});
                      }}
                      rows={4}
                      maxLength={600}
                      placeholder="Ex. : boutique de cosmétiques bio au safran, fond rose poudré, avec packs dégressifs, compte à rebours, avis clients et FAQ"
                      className="w-full rounded-xl bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none text-sm text-slate-900 placeholder-slate-400 p-3 leading-relaxed resize-none"
                    />
                    <p className="text-[12px] text-slate-500 leading-relaxed">
                      Français ou anglais. Compris : ce que vous vendez, l’ambiance, les couleurs, et les sections à ajouter ou à retirer.
                    </p>

                    {/* Mode Selector: the engines the admin offers (Builder AI panel), one button each; hidden when only one is on */}
                    {modes.length > 1 && (
                      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
                        {modes.map((m) => {
                          const ui = MODE_UI[m];
                          const Icon = ui.icon;
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setGenerationMode(m)}
                              title={m === 'gpt' ? providers?.openai?.model ?? 'GPT (OpenAI)' : m === 'ai' ? providers?.claude?.model ?? 'Claude CLI' : 'Lecture intégrée, sans appel'}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                                generationMode === m ? ui.active : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <Icon className={`w-3.5 h-3.5 ${ui.iconClass}`} /> {modes.length > 2 ? ui.short : ui.long}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* GPT photos: three paid image calls, drawn for what the seller sells */}
                    {providers?.openai?.images && (
                      <div className={`rounded-xl border p-2.5 space-y-1.5 transition-colors ${withImages ? 'bg-emerald-50/70 border-emerald-200' : 'bg-white border-slate-200'}`}>
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={withImages}
                            onChange={(e) => setWithImages(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                              <ImageIcon className="w-3.5 h-3.5 text-emerald-600" /> Photos IA (avec Claude ou GPT)
                            </span>
                            <span className="block text-[11px] text-slate-500 leading-snug">
                              Accroche, histoire et promotion dessinées pour ce que vous vendez. Moteurs, dans l’ordre : {(providers.openai.imageEngines ?? [providers.openai.imageModel ?? 'gpt-image-1']).join(' → ')}.{' '}
                              {providers.openai.imageEngines?.[0] === 'Codex CLI' ? 'Comptez 2 à 3 min de plus avec Codex.' : 'Comptez 20 à 60 s de plus.'}
                            </span>
                          </span>
                        </label>
                        {imagesReady && (
                          <div className="flex items-center justify-between gap-2 pl-6 text-[11px]">
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" /> {Object.keys(images!.map).length} photo{Object.keys(images!.map).length > 1 ? 's' : ''} prête{Object.keys(images!.map).length > 1 ? 's' : ''} pour cette description
                            </span>
                            <button
                              type="button"
                              disabled={generating}
                              onClick={() => void generate({ withImages: true })}
                              className="font-bold text-emerald-700 hover:underline disabled:opacity-50"
                            >
                              Redessiner
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {aiFallback && !generating && (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-2.5 animate-in fade-in">
                      <div className="flex items-start gap-2 text-xs leading-relaxed">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-amber-950">L’IA n’a pas répondu : cette version est la lecture intégrée.</p>
                          <p className="text-amber-800 text-[11px] mt-0.5">{aiFallback.note}</p>
                          <p className="text-amber-800 text-[11px] mt-1">Textes standard de la niche, couleurs lues par mots-clés. Rien n’a été rédigé pour votre boutique.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void generate({})}
                        className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Réessayer avec {MODE_LABEL[generationMode]}
                      </button>
                    </div>
                  )}

                  {photos && !generating && (photos.errors.length > 0 || photos.generated > 0) && (
                    <div className={`p-3 rounded-xl border text-xs space-y-1.5 animate-in fade-in ${photos.generated ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-300 text-amber-900'}`}>
                      <p className="font-bold flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5" />
                        {photos.generated
                          ? `${photos.generated} photo${photos.generated > 1 ? 's' : ''} dessinée${photos.generated > 1 ? 's' : ''} par ${photos.model} en ${Math.round(photos.durationMs / 1000)} s`
                          : 'Aucune photo générée : les photos affichées sont celles de la banque de la niche.'}
                      </p>
                      {photos.errors.length > 0 && (
                        <ul className="space-y-1 text-[11px] leading-snug">
                          {photos.errors.map((e, i) => (
                            <li key={i} className="flex gap-1.5"><span>•</span><span className="break-words">{e}</span></li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {generationError && (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2.5 animate-in fade-in">
                      <div className="flex items-start gap-2 text-xs leading-relaxed">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-amber-950">Un contretemps est survenu :</p>
                          <p className="text-amber-800 text-[11px] mt-0.5">{generationError}</p>
                        </div>
                      </div>
                      {instantOffered && (
                        <button
                          type="button"
                          onClick={() => void generate({ skipAi: true })}
                          className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                        >
                          <Zap className="w-3.5 h-3.5" /> Réessayer immédiatement en Mode Rapide (&lt; 1s)
                        </button>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className={sectionLabel}>Ajouter d’un clic</label>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_ADDS.map((q) => (
                        <button
                          key={q.label}
                          type="button"
                          onClick={() => quickAdd(q.phrase)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold bg-white border border-slate-200 text-slate-700 hover:border-indigo-400 hover:text-indigo-700 transition-colors"
                        >
                          <Plus className="w-3 h-3" /> {q.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={sectionLabel}>Ambiance</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'auto' as const, label: 'Auto', icon: SunMoon },
                        { id: 'light' as const, label: 'Claire', icon: Sun },
                        { id: 'dark' as const, label: 'Sombre', icon: Moon },
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => changeMode(m.id)}
                          className={`inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                            mode === m.id
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                          }`}
                        >
                          <m.icon className="w-4 h-4" /> {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={generating}
                    onClick={() => void generate({})}
                    className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white shadow-sm transition-colors disabled:opacity-50 ${
                      generationMode === 'ai' ? 'bg-violet-600 hover:bg-violet-500' : generationMode === 'gpt' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500'
                    }`}
                  >
                    {generating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Conception en cours ({elapsedSec}s)...</span>
                      </>
                    ) : (
                      <>
                        {generationMode === 'instant' ? <Zap className="w-4 h-4" /> : generationMode === 'gpt' ? <Bot className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                        <span>
                          {design
                            ? `Régénérer avec ${generationMode === 'instant' ? 'le mode rapide' : MODE_LABEL[generationMode]}`
                            : `Générer ma boutique (${MODE_LABEL[generationMode]})`}
                        </span>
                      </>
                    )}
                  </button>

                  <div className="space-y-2">
                    <label className={sectionLabel}>Ou partez d’un exemple</label>
                    <div className="flex flex-wrap gap-1.5">
                      {EXAMPLE_BRIEFS.map((ex) => (
                        <button
                          key={ex.title}
                          type="button"
                          disabled={generating}
                          onClick={() => useExample(ex.prompt)}
                          className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold bg-white border border-slate-200 text-slate-700 hover:border-indigo-400 hover:text-indigo-700 transition-colors disabled:opacity-50"
                        >
                          {ex.title}
                        </button>
                      ))}
                    </div>
                  </div>

                  {design && (
                    <>
                      <div className="space-y-2 pt-4 border-t border-slate-200">
                        <div className={`flex items-center gap-1.5 ${sectionLabel}`}>
                          <Lightbulb className="w-4 h-4 text-amber-500" /> Ce qui a été compris
                        </div>
                        <ul className="space-y-1.5">
                          {design.rationale.map((line, i) => (
                            <li key={i} className="flex gap-2 text-[13px] text-slate-700 leading-relaxed">
                              <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                              <span>{line}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className={`flex items-center gap-1.5 ${sectionLabel}`}>
                            <Layers className="w-4 h-4 text-indigo-500" /> {design.sections.length} sections sur l’accueil
                          </div>
                          <button
                            type="button"
                            onClick={() => setPanel('sections')}
                            className="text-xs font-bold text-indigo-600 hover:underline"
                          >
                            Gérer (+60)
                          </button>
                        </div>
                        <ol className="space-y-1">
                          {design.sections.map((s, i) => (
                            <li key={i} className="flex items-center gap-2 text-[13px] text-slate-700">
                              <span className="w-5 h-5 rounded-md bg-white border border-slate-200 text-[11px] font-bold text-slate-500 flex items-center justify-center">
                                {i + 1}
                              </span>
                              {s}
                            </li>
                          ))}
                        </ol>

                        <button
                          type="button"
                          onClick={() => setPanel('sections')}
                          className="w-full mt-2 py-2 px-3 rounded-xl border border-indigo-200 bg-indigo-50/80 text-indigo-700 text-xs font-bold hover:bg-indigo-100 flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" /> Personnaliser ou ajouter parmi +60 sections
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ─── TAB 2: 60+ SECTIONS CATALOG ─── */}
              {panel === 'sections' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <label className={sectionLabel}>Catalogue des 60+ Sections E-Commerce</label>
                      <span className="text-[11px] font-bold text-indigo-600">
                        {extraSectionIds.length} sélectionnée(s)
                      </span>
                    </div>
                    <p className="text-[12px] text-slate-500 mt-1 leading-snug">
                      Cochez les sections spécialisées pour les ajouter immédiatement à la page d'accueil de votre boutique.
                    </p>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      value={sectionSearch}
                      onChange={(e) => setSectionSearch(e.target.value)}
                      placeholder="Rechercher une section (pack, avis, vidéo…)"
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>

                  {/* Category Filter Chips */}
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pb-1 scrollbar-thin">
                    {SECTION_CATEGORIES.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setSectionCategory(c.key)}
                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
                          sectionCategory === c.key
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>

                  {/* Section list */}
                  <div className="space-y-2">
                    {filteredCatalog.map((s) => {
                      const isSelected = extraSectionIds.includes(s.id);
                      return (
                        <div
                          key={s.id}
                          className={`p-2.5 rounded-xl border transition-all text-left flex flex-col gap-1.5 ${
                            isSelected
                              ? 'bg-indigo-50/60 border-indigo-400 ring-1 ring-indigo-400 shadow-2xs'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                {s.categoryLabel}
                              </span>
                              <h4 className="text-xs font-bold text-slate-900 mt-0.5">
                                {s.name}
                              </h4>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleSection(s.id)}
                              className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                                isSelected
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              {isSelected ? '✓ Activée' : '+ Ajouter'}
                            </button>
                          </div>

                          <p className="text-[11px] text-slate-500 leading-snug">
                            {s.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ─── TAB 3: DESIGN TOKENS & FONTS ─── */}
              {panel === 'tokens' && design && paletteShown && (
                <>
                  <div className="space-y-2">
                    <label className={sectionLabel}>Palette de Couleurs</label>
                    <p className="text-[12px] text-slate-500">Chaque couleur recolore toute la boutique, ici et plus tard dans Studio.</p>
                    <div className="space-y-1.5">
                      {TOKENS.map((t) => (
                        <label key={t.key} className="flex items-center gap-3 p-2 rounded-lg bg-white border border-slate-200">
                          <input
                            type="color"
                            value={paletteShown[t.key] || '#000000'}
                            onChange={(e) => {
                              setOverrides((o) => ({ ...o, [t.key]: e.target.value }));
                              scheduleRefresh();
                            }}
                            className="w-9 h-9 rounded-md border border-slate-200 bg-transparent cursor-pointer p-0.5"
                          />
                          <span className="flex-1 text-[13px] font-semibold text-slate-800">{t.label}</span>
                          <span className="font-mono text-[12px] text-slate-500">{paletteShown[t.key]}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={`flex items-center gap-1.5 ${sectionLabel}`}>
                      <Type className="w-4 h-4" /> Police
                    </label>
                    <select
                      value={fontOverride || design.fontFamily}
                      onChange={(e) => {
                        setFontOverride(e.target.value);
                        scheduleRefresh();
                      }}
                      className="w-full rounded-lg bg-white border border-slate-300 text-sm text-slate-900 p-2.5 focus:outline-none focus:border-indigo-500"
                    >
                      {FONTS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    disabled={generating}
                    onClick={() => void generate({})}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50"
                  >
                    {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Palette className="w-4 h-4" />}{' '}
                    Régénérer le design avec ces couleurs
                  </button>
                  <p className="text-[11px] text-slate-500 -mt-3">L’aperçu suit déjà vos couleurs. Régénérer recompose aussi les sections autour d’elles.</p>

                  <button
                    type="button"
                    onClick={() => {
                      setOverrides({});
                      setFontOverride('');
                      void generate({ palette: undefined, fontFamily: undefined });
                    }}
                    className="w-full px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                  >
                    Revenir aux couleurs proposées
                  </button>
                </>
              )}
            </div>

            {/* Apply footer */}
            <div className="p-4 border-t border-slate-200 bg-white space-y-2">
              <button
                type="button"
                disabled={!design || applying || generating}
                onClick={() => void apply()}
                className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
              >
                {applying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Appliquer à ma boutique ({design ? design.sections.length : 0} sections)
              </button>
              <p className="text-[12px] text-slate-500 text-center">Vos pages actuelles restent dans l’historique de Studio.</p>
            </div>
          </aside>

          {/* Preview Area */}
          <div className="flex-1 flex flex-col min-w-0 bg-slate-200/70">
            {design ? (
              <>
                <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-slate-200 bg-white flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                      {PAGES.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPage(p.id)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                            page === p.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <span className="text-sm text-slate-600 truncate hidden sm:inline">
                      <strong className="text-slate-900">{design.label}</strong> · {design.mood === 'dark' ? 'sombre' : 'claire'} ·{' '}
                      {design.fontFamily}
                    </span>
                    <span className="hidden lg:inline-flex items-center gap-1">
                      {TOKENS.slice(0, 4).map((t) => (
                        <span
                          key={t.key}
                          title={`${t.label} ${design.palette[t.key]}`}
                          className="w-4 h-4 rounded-full ring-1 ring-slate-900/10"
                          style={{ background: design.palette[t.key] }}
                        />
                      ))}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setInspect((v) => !v)}
                      title="Cliquez un texte ou un bloc dans l’aperçu pour le modifier"
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                        inspect ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-500' : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-400 hover:text-indigo-700'
                      }`}
                    >
                      <MousePointerClick className="w-4 h-4" /> Édition directe{inspect ? ' : ON' : ''}
                    </button>
                    <button
                      type="button"
                      disabled={generating}
                      onClick={anotherVariant}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:border-indigo-400 hover:text-indigo-700 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} /> Autre variante ({seed + 1})
                    </button>
                  </div>
                </div>
                {aiFallback && (
                  <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-[12px] text-amber-900 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="min-w-0 truncate"><strong>Version de secours (lecture intégrée)</strong> — l’IA n’a pas répondu : {aiFallback.note}</span>
                    <button type="button" onClick={() => void generate({})} className="ml-auto shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white">
                      Réessayer
                    </button>
                  </div>
                )}
                {inspect && !selected && (
                  <div className="px-4 py-1.5 bg-indigo-50 border-b border-indigo-100 text-[12px] text-indigo-800 flex items-center gap-1.5">
                    <MousePointerClick className="w-3.5 h-3.5" />
                    Cliquez un texte de l’aperçu pour le réécrire, ou un bloc pour changer ses couleurs et ses champs.
                  </div>
                )}
                <div className="flex-1 min-h-0 p-3 sm:p-5 flex justify-center items-stretch">
                  <CompiledPreview
                    loader={loader}
                    page={page}
                    viewport={viewport}
                    version={`${version}:${inspect ? 'e' : 'v'}`}
                    host="ma-boutique.ma"
                    onMessage={onPreviewMessage}
                    highlightNodeId={inspect ? highlightId : null}
                    scrollKey={locateTick}
                  />
                </div>
              </>
            ) : generating ? (
              <LiveBuildingHUD
                prompt={prompt}
                elapsedSec={elapsedSec}
                generationMode={generationMode}
                engineLabel={hudLabel}
                withImages={generationMode !== 'instant' && withImages && !imagesReady && Boolean(providers?.openai?.images)}
                live={live}
                onInstantFallback={instantOffered ? () => void generate({ skipAi: true }) : null}
              />
            ) : generationError ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 sm:p-10 animate-in fade-in">
                <div className="max-w-md bg-white rounded-2xl border border-amber-200 shadow-sm p-6 sm:p-8 space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900">La génération a rencontré un contretemps</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {generationError}
                  </p>
                  <button
                    type="button"
                    onClick={() => void generate(instantOffered ? { skipAi: true } : {})}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 shadow-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    {instantOffered ? <Zap className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />} {instantOffered ? 'Générer immédiatement en Mode Rapide (< 1s)' : 'Réessayer'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
                <div className="max-w-lg bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                    <Sparkles className="w-7 h-7 text-indigo-600" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-900">Votre boutique complète avec +60 sections</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Dites ce que vous vendez, l’ambiance et vos souhaits. Le moteur compose votre boutique avec les meilleures sections e-commerce & dropshipping : packs dégressifs, urgence flash, avant/après, avis clients marocains, formulaire COD direct, et bien plus.
                  </p>
                  <p className="text-[13px] text-slate-500">
                    Plus de 60 sections spécialisées disponibles et personnalisables en direct.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

interface LiveBuildingHUDProps {
  prompt: string;
  elapsedSec: number;
  generationMode: GenerationMode;
  /** The brain's name for the header badge (e.g. "Claude CLI (sonnet)", "GPT (gpt-5-mini)"). */
  engineLabel: string;
  /** Whether photos are being drawn during this run. */
  withImages: boolean;
  /** Null when the admin does not offer the instant reader: no "abandon the AI" escape hatch then. */
  onInstantFallback: (() => void) | null;
  /** The real events of the run, as the server sends them. */
  live: LiveState;
}

const TONE_CLASS: Record<LiveLog['tone'], string> = {
  info: 'bg-indigo-500/20 text-indigo-300',
  ok: 'bg-emerald-500/20 text-emerald-300',
  warn: 'bg-amber-500/20 text-amber-300',
  model: 'bg-purple-500/20 text-purple-300',
};

const PAGE_CARDS: { key: string; name: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { key: 'home', name: 'Accueil', icon: Sparkles, desc: 'Hero, packs, avis clients, FAQ' },
  { key: 'product', name: 'Fiche produit', icon: ShoppingBag, desc: 'Formulaire COD, variantes, urgence' },
  { key: 'catalogue', name: 'Catalogue', icon: Search, desc: 'Collections, badges promo, filtres' },
  { key: 'header', name: 'En-tête', icon: Monitor, desc: 'Bandeau d’annonce, navigation, panier' },
  { key: 'footer', name: 'Pied de page', icon: CheckCircle2, desc: 'Réassurance, WhatsApp, liens légaux' },
];

/**
 * The building screen. Nothing here is simulated: the log is the server's
 * events, the text pane is the model's answer as it is being written, the
 * photos and sections appear when the server reports them, and the progress
 * bar is computed from what has actually happened.
 */
function LiveBuildingHUD({ prompt, elapsedSec, generationMode, engineLabel, withImages, onInstantFallback, live }: LiveBuildingHUDProps) {
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const brainEndRef = useRef<HTMLDivElement>(null);
  const instant = generationMode === 'instant' || live.skipAi;

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [live.log.length]);
  useEffect(() => {
    brainEndRef.current?.scrollIntoView({ block: 'end' });
  }, [live.brainText.length]);

  const photoList = useMemo(() => (['hero', 'story', 'promo'] as const).map((k) => ({ key: k, label: PHOTO_LABEL[k], ...(live.photos[k] ?? { status: 'pending' as const }) })), [live.photos]);
  const photosDone = photoList.filter((p) => p.status === 'done' || p.status === 'fail').length;

  // Phase and progress, from what has happened — not from the clock.
  const currentPhase = useMemo(() => {
    if (instant) return live.sections.length ? 3 : 2;
    if (live.stage === 'validate' || live.sections.length) return 3;
    if (live.engine) return 2;
    if (live.brainText) return 1;
    return 0;
  }, [instant, live]);

  const progressPercent = useMemo(() => {
    if (instant) return live.sections.length ? 96 : 40;
    let p = 4;
    if (live.stage === 'read') p = 10;
    if (live.model) p = 16;
    if (live.thinkingTokens) p = Math.max(p, 18);
    if (live.brainText) p = 20 + Math.min(40, Math.round((live.brainText.length / 2600) * 40));
    if (live.engine) p = 62;
    if (withImages && live.engine) p = 62 + Math.round((photosDone / 3) * 20);
    if (live.sections.length) p = Math.max(p, 84 + Math.round((live.sections.length / Math.max(1, live.sections[0]?.total ?? 8)) * 10));
    if (live.stage === 'validate') p = 96;
    return Math.min(97, p);
  }, [instant, live, withImages, photosDone]);

  const phases = [
    { title: 'Lecture du brief', desc: instant ? 'Lecture intégrée' : `Par ${live.model ?? engineLabel}` },
    { title: 'Rédaction', desc: live.brainText ? `${live.brainText.length} caractères écrits` : 'Textes & décisions' },
    { title: withImages ? 'Photos & composition' : 'Composition', desc: withImages ? `${photosDone}/3 photos` : `${live.sections.length || 5} pages & sections` },
    { title: 'Validation', desc: 'Contrôle des 5 pages' },
  ];

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const brainTail = live.brainText.length > 2400 ? '…' + live.brainText.slice(-2400) : live.brainText;
  const spec = live.spec;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-900 text-slate-100 p-4 sm:p-6 overflow-y-auto space-y-5">
      {/* Header */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
              <Bot className="w-5 h-5 animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white tracking-tight">
                  {instant ? 'Moteur natif en cours de génération' : generationMode === 'gpt' ? 'Agent GPT en cours de génération' : 'Agent Claude en cours de génération'}
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {instant ? 'Ultra-rapide' : live.model ?? engineLabel}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {live.stage === 'read' && !live.brainText && !instant ? 'Le modèle lit votre brief et réfléchit…' : live.stage === 'read' ? 'Le modèle écrit sa lecture de votre brief' : live.stage === 'photos' ? 'Les photos sont dessinées pour vos produits' : live.stage === 'compose' ? 'Le compositeur assemble les 5 pages' : live.stage === 'validate' ? 'Chaque page passe le contrôle du Studio' : 'Connexion au serveur…'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-300 font-mono text-xs shadow-inner">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>{formatTimer(elapsedSec)}</span>
            </div>

            {!instant && elapsedSec >= 40 && onInstantFallback && (
              <button
                type="button"
                onClick={onInstantFallback}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all shadow-xs"
                title="Abandonner l’IA : textes standard de la niche, sans rédaction pour votre boutique"
              >
                <Zap className="w-3.5 h-3.5" /> Abandonner l’IA (lecture intégrée)
              </button>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Progression réelle</span>
            <span className="font-mono font-bold text-indigo-300">{progressPercent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-700/60 overflow-hidden p-0.5">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-700 shadow-sm" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-700/50">
          {phases.map((p, idx) => {
            const isDone = currentPhase > idx;
            const isCurrent = currentPhase === idx;
            return (
              <div key={p.title} className={`flex items-start gap-2.5 p-2 rounded-xl transition-all ${isCurrent ? 'bg-indigo-500/10 border border-indigo-500/30 text-white' : isDone ? 'bg-emerald-500/5 border border-emerald-500/20 text-slate-300' : 'bg-slate-800/40 border border-transparent text-slate-500'}`}>
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold transition-all ${isDone ? 'bg-emerald-500 text-slate-900' : isCurrent ? 'bg-indigo-500 text-white animate-pulse' : 'bg-slate-700 text-slate-400'}`}>
                  {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : idx + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold leading-tight truncate">{p.title}</p>
                  <p className="text-[10px] opacity-70 leading-tight truncate">{p.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* The model, writing */}
        <div className="lg:col-span-7 flex flex-col gap-4 min-h-0">
          <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-lg overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-slate-800">
              <span className="flex items-center gap-2 text-[11px] font-mono text-slate-400"><Cpu className="w-3.5 h-3.5 text-purple-400" /> {instant ? 'lecture intégrée' : `${live.model ?? engineLabel} · réponse en direct`}</span>
              {!instant && !live.engine && (
                <span className="text-[10px] font-mono text-purple-300">
                  {live.brainText ? `${live.brainText.length} caractères` : live.thinkingTokens ? `réfléchit… ~${live.thinkingTokens} tokens` : live.model ? 'réfléchit…' : 'connexion…'}
                </span>
              )}
            </div>
            <div className="p-4 font-mono text-[11px] leading-relaxed text-slate-200 h-52 overflow-y-auto whitespace-pre-wrap break-words">
              {instant ? (
                <span className="text-slate-400 italic">Le brief est lu par des règles intégrées : niche, couleurs et sections par mots-clés. Aucun modèle n’est appelé.</span>
              ) : brainTail ? (
                <>
                  {brainTail}
                  {!live.engine && <span className="inline-block w-1.5 h-3 bg-purple-400 animate-pulse align-middle ml-0.5" />}
                </>
              ) : (
                <span className="text-slate-500 italic flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {live.model ? 'Le modèle réfléchit avant d’écrire…' : 'En attente du modèle…'}</span>
              )}
              <div ref={brainEndRef} />
            </div>
          </div>

          {spec && (
            <div className="bg-slate-800/60 rounded-2xl border border-slate-700/70 p-4 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5" /> Ce que le modèle a compris</p>
              {spec.summary && <p className="text-xs text-slate-200 leading-relaxed">{spec.summary}</p>}
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                <span className="px-2 py-0.5 rounded-md bg-slate-700 text-slate-200">niche : {spec.niche}</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-700 text-slate-200">ambiance : {spec.mood}</span>
                {spec.font && <span className="px-2 py-0.5 rounded-md bg-slate-700 text-slate-200">police : {spec.font}</span>}
                {spec.colours && Object.entries(spec.colours as Record<string, string>).map(([k, v]) => v ? (
                  <span key={k} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-700 text-slate-200"><span className="w-2.5 h-2.5 rounded-full ring-1 ring-white/20" style={{ background: v }} /> {k} {v}</span>
                ) : null)}
                {(spec.wants ?? []).map((w: string) => <span key={`w-${w}`} className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-200">+ {w}</span>)}
                {(spec.drops ?? []).map((w: string) => <span key={`d-${w}`} className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-200">− {w}</span>)}
              </div>
              {spec.headline && <p className="text-xs text-slate-300"><span className="text-slate-500">Accroche :</span> « {spec.headline} »</p>}
              {spec.photoSubject && <p className="text-xs text-slate-300"><span className="text-slate-500">Sujet des photos :</span> {spec.photoSubject}</p>}
            </div>
          )}

          {/* The server's log */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-lg overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 border-b border-slate-800">
              <div className="flex gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" /><span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" /><span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" /></div>
              <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5"><Terminal className="w-3 h-3" /> journal du serveur</span>
              <span className="ml-auto text-[10px] font-mono text-emerald-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE</span>
            </div>
            <div className="p-4 font-mono text-[11px] leading-relaxed h-48 overflow-y-auto space-y-1.5">
              {live.log.length === 0 && (
                <div className="flex items-start gap-2 text-slate-400"><span className="text-slate-500 shrink-0">[00s]</span><span className="px-1.5 rounded bg-indigo-500/20 text-indigo-300 shrink-0">INIT</span><span>Requête envoyée : « {prompt.slice(0, 70)}{prompt.length > 70 ? '…' : ''} »</span></div>
              )}
              {live.log.map((l, i) => (
                <div key={i} className="flex items-start gap-2 animate-in fade-in slide-in-from-left-1">
                  <span className="text-slate-500 shrink-0">[{String(l.t).padStart(2, '0')}s]</span>
                  <span className={`px-1.5 rounded shrink-0 ${TONE_CLASS[l.tone]}`}>{l.prefix}</span>
                  <span className="text-slate-200 break-words">{l.text}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 text-indigo-400 pt-1 select-none">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-slate-400 italic text-[11px]">{live.stage === 'validate' ? 'Validation finale…' : live.stage === 'photos' ? 'Photos en cours…' : live.stage === 'compose' ? 'Composition en cours…' : live.brainText ? 'Le modèle écrit…' : 'En attente…'}</span>
                <span className="inline-block w-1.5 h-3 bg-indigo-400 animate-pulse" />
              </div>
              <div ref={terminalEndRef} />
            </div>
          </div>
        </div>

        {/* Pages and photos, as they land */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">5 pages</h4>
              <span className="text-[11px] text-indigo-400 font-medium">{live.sections.length ? `${live.sections.length} sections sur l’accueil` : '+60 sections cataloguées'}</span>
            </div>
            {PAGE_CARDS.map((p) => {
              const built = live.pages[p.key];
              const status = built ? `${built.blocks} blocs · ${built.sections} section${built.sections > 1 ? 's' : ''}` : live.engine || instant ? 'Composition…' : 'En attente de la lecture';
              return (
                <div key={p.key} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${built ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-slate-800/60 border-slate-700/60'}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${built ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}><p.icon className="w-4 h-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white leading-tight">{p.name}</p>
                    <p className="text-[10px] text-slate-400 leading-tight truncate">{p.desc}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${built ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>{built ? <span className="inline-flex items-center gap-1"><Check className="w-3 h-3" /> {status}</span> : status}</span>
                </div>
              );
            })}
          </div>

          {live.sections.length > 0 && (
            <div className="bg-slate-800/60 rounded-2xl border border-slate-700/70 p-3 space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Sections de l’accueil, dans l’ordre</p>
              <ol className="space-y-1">
                {live.sections.map((sec) => (
                  <li key={sec.index} className="flex items-center gap-2 text-xs text-slate-200 animate-in fade-in slide-in-from-bottom-1">
                    <span className="w-5 h-5 rounded-md bg-slate-700 text-[10px] font-bold text-slate-300 flex items-center justify-center shrink-0">{sec.index + 1}</span>
                    <span className="truncate">{sec.label}</span>
                    {sec.variant && <span className="ml-auto text-[10px] text-slate-500 font-mono shrink-0">{sec.variant}</span>}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {withImages && (
            <div className="bg-slate-800/60 rounded-2xl border border-slate-700/70 p-3 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" /> Photos</p>
              {photoList.map((p) => (
                <div key={p.key} className="flex items-center gap-3">
                  <div className="w-14 h-10 rounded-lg bg-slate-900 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                    {p.status === 'done' && p.url ? <img src={p.url} alt="" className="w-full h-full object-cover animate-in fade-in" /> : p.status === 'start' ? <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" /> : p.status === 'fail' ? <AlertCircle className="w-4 h-4 text-amber-400" /> : <ImageIcon className="w-4 h-4 text-slate-600" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white capitalize">{p.label}</p>
                    <p className={`text-[10px] truncate ${p.status === 'fail' ? 'text-amber-300' : 'text-slate-400'}`}>{p.status === 'done' ? `${p.engine}${p.ms ? ` · ${Math.round(p.ms / 1000)} s` : ''}` : p.status === 'start' ? `${p.engine} dessine…` : p.status === 'fail' ? p.error : 'en attente'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/70 text-[11px] text-slate-400 leading-relaxed">
            <span className="text-amber-400 font-semibold inline-flex items-center gap-1 mr-1"><Sparkles className="w-3 h-3" /> Optimisation COD :</span>
            {instant ? 'Le moteur natif' : generationMode === 'gpt' ? 'GPT' : 'Claude'} structure votre boutique avec des leviers de conversion adaptés au marché marocain : réassurance paiement à la livraison, livraison express 24/48h, et formulaires de commande directe sans friction.
          </div>
        </div>
      </div>
    </div>
  );
}

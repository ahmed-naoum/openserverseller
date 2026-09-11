import React, { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Monitor, Tablet, Smartphone, Check, LayoutTemplate, ArrowRight, Layers, Star } from 'lucide-react';
import type { StoreTheme } from '@shared/templates/themes.js';
import { studioApi } from '../../../studio/api';
import CompiledPreview, { type PreviewPage, type PreviewViewport } from './CompiledPreview';

interface ThemePreviewModalProps {
  theme: StoreTheme | null;
  onClose: () => void;
  onInstall: (id: string, label: string) => void;
  isInstalling: boolean;
  isInstalled: boolean;
  onOpenStudio: () => void;
}

const PAGES: { id: PreviewPage; label: string }[] = [
  { id: 'home', label: 'Accueil' },
  { id: 'product', label: 'Fiche produit' },
  { id: 'catalogue', label: 'Catalogue' },
];

const VIEWPORTS: { id: PreviewViewport; label: string; icon: React.ComponentType<{ className?: string }>; title: string }[] = [
  { id: 'desktop', label: 'Bureau', icon: Monitor, title: 'Aperçu ordinateur' },
  { id: 'tablet', label: 'Tablette', icon: Tablet, title: 'Aperçu tablette (768px)' },
  { id: 'mobile', label: 'Mobile', icon: Smartphone, title: 'Aperçu mobile (390px)' },
];

/**
 * The gallery's preview: the theme's pages compiled by the storefront's own
 * compiler, with the seller's products bound in, shown in a frame at three
 * widths. Not a mock — the same bytes installing would serve.
 *
 * Light chrome, like the rest of the dashboard: the page being previewed is
 * the thing with colours, and it should be the only thing.
 */
export default function ThemePreviewModal({ theme, onClose, onInstall, isInstalling, isInstalled, onOpenStudio }: ThemePreviewModalProps) {
  const [viewport, setViewport] = useState<PreviewViewport>('desktop');
  const [page, setPage] = useState<PreviewPage>('home');

  const themeId = theme?.id ?? '';
  const loader = useCallback(
    async (which: PreviewPage) => {
      const res = await studioApi.previewTheme(themeId, which);
      return res.data.data;
    },
    [themeId]
  );

  if (!theme) return null;

  const installButton = (large: boolean) =>
    isInstalled ? (
      <button type="button" onClick={onOpenStudio} className={`inline-flex items-center gap-2 ${large ? 'px-5 py-2.5' : 'px-4 py-2'} rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm transition-colors`}>
        <LayoutTemplate className="w-4 h-4" /> Personnaliser dans Studio
      </button>
    ) : (
      <button
        type="button"
        disabled={isInstalling}
        onClick={() => onInstall(theme.id, theme.label.fr)}
        className={`inline-flex items-center gap-2 ${large ? 'px-5 py-2.5' : 'px-4 py-2'} rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm transition-colors disabled:opacity-50`}
      >
        {isInstalling ? 'Installation en cours…' : (<><Check className="w-4 h-4" /> Installer ce modèle</>)}
        {large && !isInstalling && <ArrowRight className="w-4 h-4" />}
      </button>
    );

  // Through a portal: the dashboard's sidebar and header sit at z-index 9999
  // and 500, and a modal rendered inside the page column would fall under them.
  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="relative w-full max-w-[1400px] h-[96vh] bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/10 flex flex-col overflow-hidden text-slate-900"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Aperçu du modèle ${theme.label.fr}`}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-slate-200 bg-white flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-base shrink-0" style={{ background: theme.palette.primary, color: '#fff' }}>
              {theme.label.fr.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold tracking-tight">{theme.label.fr}</h3>
                {theme.badge && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">{theme.badge}</span>
                )}
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber-600"><Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" /> {theme.rating || 4.9}</span>
              </div>
              <p className="text-sm text-slate-500 truncate">Pour : {theme.audience.fr}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-0.5">
              {VIEWPORTS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setViewport(v.id)}
                  title={v.title}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${viewport === v.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  <v.icon className="w-4 h-4" />
                  <span className="hidden md:inline">{v.label}</span>
                </button>
              ))}
            </div>
            {installButton(false)}
            <button type="button" onClick={onClose} className="p-2 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors" aria-label="Fermer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Pages, font, palette, sections */}
        <div className="flex items-center justify-between gap-4 px-5 py-2.5 border-b border-slate-200 bg-slate-50 flex-wrap">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
            {PAGES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPage(p.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${page === p.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-600 min-w-0">
            <span className="inline-flex items-center gap-1.5"><Layers className="w-4 h-4 text-indigo-500" /> <strong className="text-slate-900">{theme.sections.length}</strong> sections</span>
            <span className="hidden sm:inline-flex items-center gap-1.5">Police <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-mono text-[12px] text-slate-800">{theme.fontFamily}</span></span>
            <span className="inline-flex items-center gap-1.5">
              {[theme.palette.primary, theme.palette.secondary, theme.palette.bg, theme.palette.text].map((c, i) => (
                <span key={i} title={c} className="w-4 h-4 rounded-full ring-1 ring-slate-900/10" style={{ background: c }} />
              ))}
            </span>
          </div>
        </div>

        {/* The page */}
        <div className="flex-1 min-h-0 p-3 sm:p-5 flex justify-center items-stretch bg-slate-200/70">
          <CompiledPreview loader={loader} page={page} viewport={viewport} version={theme.id} />
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between gap-4 px-5 py-3 border-t border-slate-200 bg-white flex-wrap">
          <div className="text-sm text-slate-600 truncate">
            <span className="font-semibold text-slate-900">{theme.sections.length} sections :</span> {theme.sections.join(' · ')}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">Fermer</button>
            {installButton(true)}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

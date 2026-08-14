import React from 'react';
import { 
  ChevronLeft, LayoutTemplate, Undo2, Redo2, Monitor, Tablet, Smartphone, 
  Eye, EyeOff, Save, Loader2, ExternalLink, QrCode, Sliders, ZoomIn, ZoomOut, CheckCircle2
} from 'lucide-react';
import { ViewportMode } from './types';

interface BuilderNavbarProps {
  onBack: () => void;
  viewport: ViewportMode;
  setViewport: (mode: ViewportMode) => void;
  zoom: number;
  setZoom: (zoom: number | ((prev: number) => number)) => void;
  isPreviewMode: boolean;
  setIsPreviewMode: (preview: boolean) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  saving: boolean;
  hasUnsavedChanges: boolean;
  onOpenSettings: () => void;
  onOpenQrCode: () => void;
  onPreviewLive: () => void;
  referralCode?: string | null;
  builderVersion?: 'v1' | 'v2';
  onSwitchVersion?: (v: 'v1' | 'v2') => void;
}

export default function BuilderNavbar({
  onBack,
  viewport,
  setViewport,
  zoom,
  setZoom,
  isPreviewMode,
  setIsPreviewMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  saving,
  hasUnsavedChanges,
  onOpenSettings,
  onOpenQrCode,
  onPreviewLive,
  referralCode,
  builderVersion = 'v2',
  onSwitchVersion,
}: BuilderNavbarProps) {
  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3 sm:px-4 shrink-0 z-30 select-none text-slate-200">
      {/* Left: Back & Title */}
      <div className="flex items-center gap-3">
        <button 
          onClick={onBack}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
          title="Retour aux liens"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="h-5 w-px bg-slate-800 hidden sm:block" />

        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center">
            <LayoutTemplate className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-white tracking-tight">Studio Builder</span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-orange-500 text-white uppercase tracking-wider">V2</span>
            </div>
          </div>
        </div>

        {/* Builder Version Switcher */}
        {onSwitchVersion && (
          <div className="flex items-center bg-slate-950/90 p-1 rounded-xl border border-slate-800 shadow-inner gap-1 ml-1">
            <button
              type="button"
              onClick={() => onSwitchVersion('v1')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                builderVersion === 'v1'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🛠️ V1 (Classique)</span>
            </button>
            <button
              type="button"
              onClick={() => onSwitchVersion('v2')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                builderVersion === 'v2'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>⚡ V2 (Studio)</span>
            </button>
          </div>
        )}

        {/* Live Status indicator */}
        <div className="hidden xl:flex items-center gap-1.5 ml-1 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px]">
          {hasUnsavedChanges ? (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-amber-300 font-medium">Modifié</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-slate-300 font-medium">Enregistré</span>
            </>
          )}
        </div>
      </div>

      {/* Center: Device Viewport & Zoom Controls */}
      <div className="flex items-center gap-2">
        {/* Device Switcher */}
        <div className="flex items-center bg-slate-950/80 border border-slate-800/90 rounded-xl p-1 shadow-inner">
          <button
            onClick={() => setViewport('desktop')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewport === 'desktop'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Vue Ordinateur (100%)"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Bureau</span>
          </button>

          <button
            onClick={() => setViewport('tablet')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewport === 'tablet'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Vue Tablette (768px)"
          >
            <Tablet className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Tablette</span>
          </button>

          <button
            onClick={() => setViewport('mobile')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewport === 'mobile'
                ? 'bg-slate-800 text-orange-400 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Vue Mobile (390px)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Mobile</span>
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="hidden xl:flex items-center bg-slate-950/80 border border-slate-800/90 rounded-xl px-1.5 py-1">
          <button
            onClick={() => setZoom(prev => Math.max(50, prev - 15))}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-all"
            title="Dézoomer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono font-bold text-slate-300 px-2 min-w-[42px] text-center">
            {zoom}%
          </span>
          <button
            onClick={() => setZoom(prev => Math.min(130, prev + 15))}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-all"
            title="Zoomer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center bg-slate-950/80 border border-slate-800/90 rounded-xl p-0.5">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            title="Annuler (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            title="Rétablir (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Right: Actions & Save */}
      <div className="flex items-center gap-2">
        {/* Toggle Live Interactive Preview */}
        <button
          onClick={() => setIsPreviewMode(!isPreviewMode)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
            isPreviewMode
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
          }`}
          title="Aperçu interactif direct"
        >
          {isPreviewMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{isPreviewMode ? 'Éditer' : 'Aperçu'}</span>
        </button>

        {/* QR Code */}
        <button
          onClick={onOpenQrCode}
          className="p-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all"
          title="Scanner le QR code sur mobile"
        >
          <QrCode className="w-4 h-4" />
        </button>

        {/* Global Page Settings & Cloaking */}
        <button
          onClick={onOpenSettings}
          className="p-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all"
          title="Paramètres globaux & Cloaking"
        >
          <Sliders className="w-4 h-4" />
        </button>

        {/* Preview in new tab */}
        {referralCode && (
          <button
            onClick={onPreviewLive}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl hover:bg-slate-700 hover:text-white transition-all shadow-xs"
            title="Ouvrir la page publique dans un nouvel onglet"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Tester en direct</span>
          </button>
        )}

        {/* Save Button */}
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-orange-600 hover:bg-orange-500 active:scale-95 text-white font-black text-xs rounded-xl shadow-md shadow-orange-950/40 transition-all"
          title="Sauvegarder les modifications (Ctrl+S)"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? 'Enregistrement...' : 'Sauvegarder'}</span>
        </button>
      </div>
    </header>
  );
}

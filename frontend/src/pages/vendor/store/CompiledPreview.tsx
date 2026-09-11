import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

/**
 * A store page as the storefront compiles it, in an iframe.
 *
 * The gallery used to show a drawing of a theme — a hand-written mock with
 * three grey boxes for products. It showed the palette and nothing else, and
 * what installing gave never matched it. This component asks the API for the
 * page compiled by the same compiler the storefront uses, with the seller's
 * own products bound in, and shows that. What you see is what you install.
 */

export type PreviewPage = 'home' | 'product' | 'catalogue';
export type PreviewViewport = 'desktop' | 'tablet' | 'mobile';

export interface PreviewResult {
  html: string;
  /** True when the store had no products and the preview used examples. */
  placeholder?: boolean;
  products?: number;
}

/** What the click-to-edit runtime inside the frame reports. */
export interface PreviewMessage {
  type: 'ready' | 'select' | 'text';
  nodeId: string | null;
  block: string | null;
  /** select: the text under the click, when there was some. */
  text?: string | null;
  /** text: the text before and after an in-place edit. */
  from?: string;
  to?: string;
}

interface Props {
  /** Fetches the compiled page. Called again whenever `version` or `page` changes. */
  loader: (page: PreviewPage) => Promise<PreviewResult>;
  page: PreviewPage;
  viewport: PreviewViewport;
  /** Anything that changes the output — a seed, a palette edit — bumps this to refetch. */
  version: string | number;
  /** Shown in the frame's address bar. */
  host?: string;
  className?: string;
  /** Receives what the frame's editing runtime reports, when the page was compiled with one. */
  onMessage?: (msg: PreviewMessage) => void;
  /** Node to outline inside the frame; re-sent after every reload so the selection survives a recompile. */
  highlightNodeId?: string | null;
  /** Bump to scroll the frame to the highlighted node. */
  scrollKey?: number;
}

export const VIEWPORT_WIDTH: Record<PreviewViewport, string> = {
  desktop: 'w-full',
  tablet: 'w-[768px] max-w-full',
  mobile: 'w-[390px] max-w-full',
};

export default function CompiledPreview({ loader, page, viewport, version, host = 'votre-boutique.ma', className = '', onMessage, highlightNodeId = null, scrollKey = 0 }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [placeholder, setPlaceholder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const cache = useRef(new Map<string, PreviewResult>());
  const seq = useRef(0);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const highlightRef = useRef(highlightNodeId);
  highlightRef.current = highlightNodeId;

  const highlight = (scroll: boolean) => {
    const win = frame.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage({ source: 'opendesign', type: 'highlight', nodeId: highlightRef.current, scroll }, '*');
    } catch {
      /* frame not ready */
    }
  };

  // Only messages from our own frame count; anything else on the window is not ours.
  useEffect(() => {
    const onWindowMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== 'opendesign' || !frame.current || event.source !== frame.current.contentWindow) return;
      if (data.type === 'ready') {
        // A fresh document: restore the outline and bring the block back into view.
        highlight(true);
      }
      onMessageRef.current?.(data as PreviewMessage);
    };
    window.addEventListener('message', onWindowMessage);
    return () => window.removeEventListener('message', onWindowMessage);
  }, []);

  useEffect(() => {
    highlight(false);
  }, [highlightNodeId]);

  useEffect(() => {
    if (scrollKey) highlight(true);
  }, [scrollKey]);

  useEffect(() => {
    const key = `${version}:${page}`;
    const hit = cache.current.get(key);
    if (hit) {
      setHtml(hit.html);
      setPlaceholder(Boolean(hit.placeholder));
      setLoading(false);
      setError(null);
      return;
    }
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    loader(page)
      .then((result) => {
        if (mine !== seq.current) return;
        cache.current.set(key, result);
        setHtml(result.html);
        setPlaceholder(Boolean(result.placeholder));
      })
      .catch((err: any) => {
        if (mine !== seq.current) return;
        setError(err?.response?.data?.message || err?.message || 'Impossible de générer l’aperçu');
      })
      .finally(() => {
        if (mine === seq.current) setLoading(false);
      });
  }, [loader, page, version, attempt]);

  const path = page === 'home' ? '/' : page === 'product' ? '/p/votre-produit' : '/products';

  return (
    <div className={`transition-all duration-300 rounded-2xl shadow-2xl overflow-hidden border border-gray-800/80 bg-white flex flex-col h-full ${VIEWPORT_WIDTH[viewport]} ${className}`}>
      {/* Browser chrome */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-100 border-b border-gray-200 text-gray-500 text-[11px] shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
        </div>
        <div className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-md border border-gray-200 text-gray-600 font-mono text-[10px] w-64 max-w-[60%] justify-center shadow-xs truncate">
          <span className="truncate">https://{host}{path}</span>
        </div>
        <div className="text-[10px] font-bold text-gray-400 flex items-center gap-2">
          {placeholder && !loading && <span className="hidden sm:inline text-amber-600">produits d’exemple</span>}
          {viewport === 'desktop' ? '1440 × 900' : viewport === 'tablet' ? '768 × 1024' : '390 × 844'}
        </div>
      </div>

      {/* The page */}
      <div className="relative flex-1 min-h-0 bg-white">
        {html && (
          <iframe
            ref={frame}
            title={`Aperçu ${page}`}
            srcDoc={html}
            sandbox="allow-scripts allow-same-origin"
            className="absolute inset-0 w-full h-full block border-0"
          />
        )}
        {loading && !html && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/80 backdrop-blur-sm">
            <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
            <p className="text-xs font-bold text-gray-600">Compilation de la page avec vos produits…</p>
          </div>
        )}
        {loading && html && (
          // A recompile after an edit: the old page stays visible, a badge says
          // the new one is coming. A full curtain would flash on every keystroke.
          <div className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gray-900/85 text-white text-[11px] font-bold shadow-lg">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Mise à jour…
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center bg-white">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
            <p className="text-sm font-bold text-gray-900">L’aperçu n’a pas pu être généré</p>
            <p className="text-xs text-gray-500 max-w-sm">{error}</p>
            <button
              type="button"
              onClick={() => setAttempt((a) => a + 1)}
              className="mt-2 px-4 py-2 rounded-xl text-xs font-bold bg-gray-900 text-white hover:bg-indigo-600"
            >
              Réessayer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

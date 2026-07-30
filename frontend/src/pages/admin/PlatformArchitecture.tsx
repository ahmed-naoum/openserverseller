import { useState, useRef } from 'react';
import { Network, RefreshCw, ExternalLink, Maximize2, Minimize2 } from 'lucide-react';

export default function PlatformArchitecture() {
  const [iframeKey, setIframeKey] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleRefresh = () => {
    setIframeKey((prev) => prev + 1);
  };

  const handleOpenExternal = () => {
    window.open('/architecture_diagram.html', '_blank');
  };

  const toggleFullScreen = () => {
    if (!containerRef.current) return;
    if (!isFullScreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullScreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-[calc(100vh-100px)] bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl transition-all ${
        isFullScreen ? 'fixed inset-0 z-50 rounded-none h-screen w-screen' : ''
      }`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <Network size={20} className="text-orange-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
              Architecture & Navigation Map
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                SYSTEM SPEC
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Interactive route map, role-based dashboards, and cloaking redirection logic
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-slate-300 transition-all hover:text-white"
            title="Reload Diagram"
          >
            <RefreshCw size={14} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleOpenExternal}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-slate-300 transition-all hover:text-white"
            title="Open in new window"
          >
            <ExternalLink size={14} />
            <span className="hidden sm:inline">Open Fullscreen Page</span>
          </button>

          <button
            onClick={toggleFullScreen}
            className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-all"
            title={isFullScreen ? 'Exit Full Screen' : 'Full Screen Mode'}
          >
            {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Embedded Architecture Diagram iFrame */}
      <div className="flex-1 bg-slate-900/40 relative">
        <iframe
          key={iframeKey}
          src={`/architecture_diagram.html?v=${Date.now()}_${iframeKey}`}
          title="Silacod Platform Architecture Diagram"
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}

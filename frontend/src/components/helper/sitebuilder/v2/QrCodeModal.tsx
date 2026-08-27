import React, { useState } from 'react';
import { X, Copy, Check, ExternalLink, Smartphone, Sparkles, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  linkCode?: string | null;
}

export default function QrCodeModal({ isOpen, onClose, url, linkCode }: QrCodeModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(url)}&margin=10&color=0f172a&bgcolor=ffffff`;

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Lien copié dans le presse-papier !');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    // Above the canvas content: the checkout preview carries z-[10001]
    // (BlockRenderer.tsx) and would otherwise paint over a z-50 overlay.
    <div className="fixed inset-0 z-[10010] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">Tester sur votre Smartphone</h3>
              <p className="text-[11px] text-slate-500">Scannez pour tester le rendu mobile en direct</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center text-center space-y-4">
          {/* QR Container */}
          <div className="relative p-3 bg-white rounded-2xl border border-slate-200 shadow-md shadow-slate-100 group">
            <img 
              src={qrImageUrl} 
              alt="QR Code" 
              className="w-56 h-56 object-contain rounded-xl"
              loading="eager"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/0 group-hover:bg-slate-950/5 rounded-2xl transition-all pointer-events-none" />
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Smartphone className="w-4 h-4 text-orange-500" />
            <span>Ouvrez l'appareil photo de votre téléphone et pointez le QR</span>
          </div>

          {/* URL Bar */}
          <div className="w-full flex items-center gap-1.5 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/80">
            <div className="flex-1 px-3 py-1.5 text-left text-xs font-mono text-slate-700 truncate select-all">
              {url}
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-800 text-xs font-bold rounded-xl border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all shadow-2xs shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
              <span>{copied ? 'Copié !' : 'Copier'}</span>
            </button>
            <button
              onClick={() => window.open(url, '_blank')}
              className="p-1.5 text-slate-600 hover:text-orange-600 hover:bg-white rounded-xl transition-all shrink-0"
              title="Ouvrir dans un nouvel onglet"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <span>Code : <strong className="font-mono text-slate-700">{linkCode || 'Direct'}</strong></span>
          <button 
            onClick={onClose}
            className="text-xs font-bold text-slate-700 hover:text-slate-900"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

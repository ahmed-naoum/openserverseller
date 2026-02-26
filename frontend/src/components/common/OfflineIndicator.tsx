import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNetworkStatus } from '../../hooks/usePWA';

export default function OfflineIndicator() {
  const { isOnline } = useNetworkStatus();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setShowBanner(true);
    } else {
      const timer = setTimeout(() => setShowBanner(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  if (!showBanner) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 p-4 z-50 transition-transform ${
        isOnline ? 'bg-green-500' : 'bg-red-500'
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Connexion rétablie</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
              </svg>
              <span>Vous êtes hors ligne</span>
            </>
          )}
        </div>
        <button onClick={() => setShowBanner(false)} className="text-white/80 hover:text-white">
          ✕
        </button>
      </div>
    </div>
  );
}

export function PWAPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    if (!dismissed && !isStandalone) {
      const timer = setTimeout(() => setShowPrompt(true), 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('pwa-prompt-dismissed', 'true');
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white rounded-xl shadow-lg border border-gray-200 p-4 z-40">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-2xl">📱</span>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">Installer l'application</h3>
          <p className="text-sm text-gray-500 mt-1">
            Ajoutez OpenSeller à votre écran d'accueil pour un accès rapide.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleDismiss}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Plus tard
            </button>
            <button
              onClick={handleDismiss}
              className="btn-primary btn-sm"
            >
              Installer
            </button>
          </div>
        </div>
        <button onClick={handleDismiss} className="text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>
    </div>
  );
}

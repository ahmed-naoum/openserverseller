import React, { useState } from 'react';
import { 
  X, ShieldAlert, Code, Palette, Globe, Smartphone, Bot, 
  Copy, Download, Check, ShieldCheck, RefreshCw, Layers
} from 'lucide-react';
import { PageSettings, EditorBlock } from './types';
import { DEFAULT_BLOCKED_USER_AGENTS, DEFAULT_BLOCKED_DNS, DEFAULT_ALLOWED_COUNTRIES } from '../../../../pages/helper/SiteBuilder';
import toast from 'react-hot-toast';

interface PageSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageSettings: PageSettings;
  setPageSettings: React.Dispatch<React.SetStateAction<PageSettings>>;
  blocks: EditorBlock[];
  setBlocks: React.Dispatch<React.SetStateAction<EditorBlock[]>>;
}

export default function PageSettingsModal({
  isOpen,
  onClose,
  pageSettings,
  setPageSettings,
  blocks,
  setBlocks
}: PageSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'style' | 'cloaking' | 'json'>('style');
  const [jsonInput, setJsonInput] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyJSON = () => {
    try {
      const layoutData = {
        blocks,
        settings: pageSettings
      };
      navigator.clipboard.writeText(JSON.stringify(layoutData, null, 2));
      setCopied(true);
      toast.success('Layout JSON copié dans le presse-papier !');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Impossible de copier le JSON.');
    }
  };

  const handleDownloadJSON = () => {
    try {
      const layoutData = {
        blocks,
        settings: pageSettings,
        exportedAt: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(layoutData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `landing-page-layout-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Fichier JSON téléchargé !');
    } catch (err) {
      toast.error('Erreur lors du téléchargement.');
    }
  };

  const handleImportJSON = () => {
    if (!jsonInput.trim()) {
      toast.error('Le champ JSON est vide');
      return;
    }
    try {
      const parsed = JSON.parse(jsonInput);
      if (parsed.blocks && Array.isArray(parsed.blocks)) {
        setBlocks(parsed.blocks);
        if (parsed.settings) {
          setPageSettings(parsed.settings);
        }
        toast.success('Layout importé avec succès !');
        onClose();
      } else if (Array.isArray(parsed)) {
        setBlocks(parsed);
        toast.success('Blocs importés avec succès !');
        onClose();
      } else {
        toast.error('Format de layout JSON invalide.');
      }
    } catch (err) {
      toast.error('JSON invalide. Veuillez vérifier le code.');
    }
  };

  const cloaking = pageSettings.cloaking || {};
  const updateCloaking = (key: string, value: any) => {
    setPageSettings((prev: any) => ({
      ...prev,
      cloaking: {
        ...(prev.cloaking || {}),
        [key]: value
      }
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl h-[85vh] bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">Paramètres Globaux & Sécurité</h2>
              <p className="text-xs text-slate-500">Configurez le style global, les filtres anti-espionnage et le JSON</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 pb-2 border-b border-slate-100 bg-slate-50/30">
          <button
            onClick={() => setActiveTab('style')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'style'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-orange-500" />
            <span>Style & Apparence</span>
          </button>

          <button
            onClick={() => setActiveTab('cloaking')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'cloaking'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            <span>Cloaking & Anti-Spy</span>
            {cloaking.enabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('json')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'json'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <Code className="w-3.5 h-3.5 text-purple-500" />
            <span>Layout JSON (Export / Import)</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: STYLE */}
          {activeTab === 'style' && (
            <div className="space-y-6 max-w-xl">
              <div className="p-4 bg-orange-50/60 border border-orange-100 rounded-2xl">
                <h4 className="text-xs font-bold text-orange-900 mb-1">Fond de la page</h4>
                <p className="text-xs text-orange-700/80">
                  Définit la couleur d'arrière-plan globale visible derrière les sections transparentes.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Couleur de fond globale</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={pageSettings.backgroundColor || '#ffffff'}
                    onChange={(e) => setPageSettings(prev => ({ ...prev, backgroundColor: e.target.value }))}
                    className="w-12 h-12 rounded-2xl border border-slate-200 p-1 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={pageSettings.backgroundColor || '#ffffff'}
                    onChange={(e) => setPageSettings(prev => ({ ...prev, backgroundColor: e.target.value }))}
                    className="w-32 px-3 py-2 text-xs font-mono font-bold uppercase rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:border-orange-500"
                  />
                  <div className="flex gap-1.5">
                    {['#ffffff', '#f8fafc', '#f1f5f9', '#fffafb', '#0f172a'].map(c => (
                      <button
                        key={c}
                        onClick={() => setPageSettings(prev => ({ ...prev, backgroundColor: c }))}
                        className="w-7 h-7 rounded-lg border border-slate-200 hover:scale-110 transition-transform shadow-2xs"
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CLOAKING */}
          {activeTab === 'cloaking' && (
            <div className="space-y-6">
              {/* Master Switch */}
              <div className="flex items-center justify-between p-4 bg-slate-900 text-white rounded-2xl shadow-md">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${cloaking.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">Activer le Cloaking & Pare-feu Anti-Spy</h4>
                    <p className="text-xs text-slate-400">Filtre et redirige les robots, espions publicitaires et visiteurs indésirables</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => updateCloaking('enabled', !cloaking.enabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    cloaking.enabled ? 'bg-orange-500' : 'bg-slate-700'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200 ease-in-out ${
                    cloaking.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {cloaking.enabled && (
                <div className="space-y-4">
                  {/* 1. Device Redirect */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-orange-500" />
                        <span className="text-xs font-bold text-slate-800">Mobile Uniquement (Rediriger ordinateurs PC)</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={cloaking.redirectDesktop ?? false}
                        onChange={(e) => updateCloaking('redirectDesktop', e.target.checked)}
                        className="w-4 h-4 rounded text-orange-500 accent-orange-500 cursor-pointer"
                      />
                    </div>
                    {cloaking.redirectDesktop && (
                      <input
                        type="text"
                        placeholder="URL de redirection PC (ex: https://google.com)"
                        value={cloaking.desktopRedirectUrl || ''}
                        onChange={(e) => updateCloaking('desktopRedirectUrl', e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-orange-500"
                      />
                    )}
                  </div>

                  {/* 2. Bot/Crawler Filter */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-bold text-slate-800">Filtrer Bots Publicitaires & Inspecteurs</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={cloaking.filterBots ?? false}
                        onChange={(e) => updateCloaking('filterBots', e.target.checked)}
                        className="w-4 h-4 rounded text-orange-500 accent-orange-500 cursor-pointer"
                      />
                    </div>
                    {cloaking.filterBots && (
                      <input
                        type="text"
                        placeholder="URL page neutre pour les bots (ex: https://wikipedia.org)"
                        value={cloaking.botRedirectUrl || ''}
                        onChange={(e) => updateCloaking('botRedirectUrl', e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-orange-500"
                      />
                    )}
                  </div>

                  {/* 3. Direct Visit Filter */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-bold text-slate-800">Rediriger Visites Directes (Sans lien publicitaire TikTok/FB)</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={cloaking.filterDirect ?? false}
                        onChange={(e) => updateCloaking('filterDirect', e.target.checked)}
                        className="w-4 h-4 rounded text-orange-500 accent-orange-500 cursor-pointer"
                      />
                    </div>
                    {cloaking.filterDirect && (
                      <input
                        type="text"
                        placeholder="URL de redirection pour visites directes (ex: https://google.com)"
                        value={cloaking.directRedirectUrl || ''}
                        onChange={(e) => updateCloaking('directRedirectUrl', e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-orange-500"
                      />
                    )}
                  </div>

                  {/* 4. VPN / Proxy Filter */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-500" />
                        <span className="text-xs font-bold text-slate-800">Bloquer Trafic VPN, Proxy & Extensions Chrome</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={cloaking.filterVpn ?? false}
                        onChange={(e) => updateCloaking('filterVpn', e.target.checked)}
                        className="w-4 h-4 rounded text-orange-500 accent-orange-500 cursor-pointer"
                      />
                    </div>
                    {cloaking.filterVpn && (
                      <input
                        type="text"
                        placeholder="URL de redirection VPN/Proxy"
                        value={cloaking.vpnRedirectUrl || ''}
                        onChange={(e) => updateCloaking('vpnRedirectUrl', e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-orange-500"
                      />
                    )}
                  </div>

                  {/* 5. Country Filter */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-bold text-slate-800">Restreindre par Pays (Cloaking Geo-IP)</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={cloaking.filterCountry ?? false}
                        onChange={(e) => updateCloaking('filterCountry', e.target.checked)}
                        className="w-4 h-4 rounded text-orange-500 accent-orange-500 cursor-pointer"
                      />
                    </div>
                    {cloaking.filterCountry && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Codes Pays ISO autorisés (ex: MA, FR, DZ, TN)"
                          value={cloaking.allowedCountries || ''}
                          onChange={(e) => updateCloaking('allowedCountries', e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-orange-500 font-mono"
                        />
                        <input
                          type="text"
                          placeholder="URL de redirection pour les pays non-autorisés"
                          value={cloaking.countryRedirectUrl || ''}
                          onChange={(e) => updateCloaking('countryRedirectUrl', e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: JSON STUDIO */}
          {activeTab === 'json' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Éditeur & Exportateur de Schéma JSON</h4>
                  <p className="text-xs text-slate-400">Sauvegardez ou restaurez l'intégralité du design sous forme de code</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyJSON}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copié' : 'Copier JSON'}</span>
                  </button>
                  <button
                    onClick={handleDownloadJSON}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl border border-purple-100 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Télécharger</span>
                  </button>
                </div>
              </div>

              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder="Collez ici votre code JSON de layout pour l'importer..."
                className="w-full h-72 p-4 font-mono text-xs text-slate-700 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none shadow-inner"
              />

              <button
                onClick={handleImportJSON}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-200 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Appliquer et remplacer le layout actuel</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-xs"
          >
            Terminé
          </button>
        </div>
      </div>
    </div>
  );
}

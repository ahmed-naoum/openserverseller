import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Sparkles, Loader2, FlaskConical, CheckCircle2, AlertTriangle, Save, Power, KeyRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { waAdminApi } from '../../lib/waAgentApi';

/**
 * SUPER_ADMIN — le cerveau du constructeur de boutique (OpenDesign).
 *
 * Quel modèle lit les descriptions que les vendeurs tapent dans « Créer avec
 * OpenDesign », s'il rédige aussi les textes, et comment il s'en sort. Éteint,
 * le constructeur utilise sa lecture intégrée (expressions régulières) et
 * n'appelle personne. Les appels sont facturés sur la clé Anthropic de la
 * plateforme, pas sur les crédits du vendeur.
 */

type StudioMode = 'claude' | 'gpt' | 'instant';

interface BuilderSettings {
  enabled: boolean;
  modelId: number | null;
  cliModel: 'sonnet' | 'opus' | 'haiku' | null;
  gptModelId: number | null;
  writeCopy: boolean;
  maxOutputTokens: number;
  instructions: string;
  /** Which engines sellers may pick in the Studio. */
  sellerModes: Record<StudioMode, boolean>;
  sellerDefault: StudioMode;
  gptImages: boolean;
  agent: { enabled: boolean; allowPublish: boolean };
}

interface BuilderStats {
  calls: number;
  failures: number;
  lastModel: string | null;
  lastAt: string | null;
  lastError: string | null;
  lastDurationMs: number | null;
  inputTokens: number;
  outputTokens: number;
}

interface ModelOption {
  id: number;
  label: string;
  modelId: string;
  role: string;
  isDefault: boolean;
  adminOnly: boolean;
  provider?: string;
}

interface GptModelLike {
  id: number | null;
  modelId: string;
  label: string;
  source: 'catalogue' | 'secret';
}

interface OpenAiStatus {
  configured: boolean;
  model: string;
  imageModel: string;
  imageQuality: string;
}

interface TestResult {
  engine: { ai: boolean; model: string | null; note: string | null };
  spec: any;
  ms: number;
  design: { label: string; niche: string; mood: string; palette: Record<string, string>; fontFamily: string; sections: string[]; rationale: string[] };
}

const DEFAULT_TEST_BRIEF = 'Boutique de chaussures de sport, fond noir, boutons rouges, avec avis clients, sans FAQ';

export default function BuilderAiPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState<BuilderSettings | null>(null);
  const [savedSettings, setSavedSettings] = useState('');
  const [stats, setStats] = useState<BuilderStats | null>(null);
  const [resolved, setResolved] = useState<{ id: number; label: string; modelId: string; role: string; provider?: string } | null>(null);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [cliDetected, setCliDetected] = useState(false);
  const [cliPath, setCliPath] = useState<string | null>(null);
  const [openai, setOpenai] = useState<OpenAiStatus | null>(null);
  const [imageEngines, setImageEngines] = useState<string[]>([]);
  const [codexPath, setCodexPath] = useState<string | null>(null);
  const [openaiModels, setOpenaiModels] = useState<ModelOption[]>([]);
  const [resolvedGpt, setResolvedGpt] = useState<GptModelLike | null>(null);
  const [testProvider, setTestProvider] = useState<'claude' | 'openai'>('claude');
  const [brief, setBrief] = useState(DEFAULT_TEST_BRIEF);
  const [result, setResult] = useState<TestResult | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await waAdminApi.builder();
      const d = res.data.data;
      setSettings(d.settings);
      setSavedSettings(JSON.stringify(d.settings));
      setStats(d.stats);
      setResolved(d.resolved);
      setModels(d.models);
      setCliDetected(Boolean(d.cliDetected));
      setCliPath(d.cliPath ?? null);
      setOpenai(d.openai ?? null);
      setImageEngines(d.imageEngines ?? []);
      setCodexPath(d.codexPath ?? null);
      setOpenaiModels(d.openaiModels ?? []);
      setResolvedGpt(d.resolvedGpt ?? null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Impossible de charger les réglages du constructeur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (patch: Partial<BuilderSettings>) => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await waAdminApi.updateBuilder({ ...settings, ...patch });
      setSettings(res.data.data.settings);
      setSavedSettings(JSON.stringify(res.data.data.settings));
      toast.success('Réglages du constructeur enregistrés');
      const fresh = await waAdminApi.builder();
      setResolved(fresh.data.data.resolved);
      setResolvedGpt(fresh.data.data.resolvedGpt ?? null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await waAdminApi.testBuilder(brief, testProvider);
      setResult(res.data.data);
      setStats(res.data.data.stats);
      if (!res.data.data.engine.ai) toast.error(res.data.data.engine.note || 'Le modèle n’a pas répondu ; lecture intégrée utilisée');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Le test a échoué');
    } finally {
      setTesting(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="rounded-2xl border border-violet-100 bg-white p-6 flex items-center gap-3 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement du constructeur…
      </div>
    );
  }

  const dirty = JSON.stringify(settings) !== savedSettings;

  return (
    <div className="rounded-2xl border border-violet-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 bg-violet-50/70 border-b border-violet-100">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center"><Sparkles className="h-5 w-5" /></span>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Constructeur de boutique — OpenDesign</h3>
            <p className="text-xs text-gray-600">Le modèle qui lit les descriptions des vendeurs et rédige les textes de leur boutique. Éteint, la lecture intégrée prend le relais, sans appel.</p>
          </div>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save({ enabled: !settings.enabled })}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 ${settings.enabled ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          <Power className="h-4 w-4" /> {settings.enabled ? 'Activé' : 'Désactivé'}
        </button>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-2">
        {/* Réglages */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700">Modèle Claude — derrière le mode « IA Claude »</label>
            <select
              value={settings.cliModel ? 'cli:' + settings.cliModel : settings.modelId ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                setSettings({ ...settings, cliModel: value.startsWith('cli:') ? value.slice(4) as BuilderSettings['cliModel'] : null, modelId: value && !value.startsWith('cli:') ? Number(value) : null });
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-violet-500 focus:outline-none"
            >
              <option value="">Automatique — défaut du rôle Constructeur, sinon Claude CLI ou défaut du Cerveau</option>
              <optgroup label="Claude CLI — connexion du serveur">
                <option value="cli:sonnet" disabled={!cliDetected}>Claude CLI · Sonnet</option>
                <option value="cli:opus" disabled={!cliDetected}>Claude CLI · Opus</option>
                <option value="cli:haiku" disabled={!cliDetected}>Claude CLI · Haiku</option>
              </optgroup>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} · {m.modelId} ({m.provider === 'claude-cli' ? 'Claude CLI' : 'Anthropic API'}{m.isDefault ? ', défaut' : ''})
                </option>
              ))}
            </select>
            <div className="text-xs text-gray-500 space-y-1">
              <p>
                Modèles Anthropic et Claude CLI. En ce moment :{' '}
                {resolved ? <span className="font-semibold text-gray-800">{resolved.label} · {resolved.modelId}</span> : <span className="font-semibold text-amber-700">aucun modèle activé</span>}.
              </p>
              {cliDetected && (
                <p className="flex items-center gap-1.5 text-emerald-600 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Claude CLI installé sur le serveur · connexion à vérifier avec le test
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 space-y-2">
            <h4 className="text-sm font-semibold text-violet-900">Construire avec Claude CLI</h4>
            <p className="text-sm leading-6 text-gray-700">Claude prépare la structure, les textes et les sujets des images. Sélectionnez un modèle CLI ci-dessus, choisissez « IA Claude » comme mode pré-sélectionné, puis enregistrez.</p>
            <p className="text-xs leading-5 text-gray-600">Le CLI utilise la connexion Claude du serveur ou CLAUDE_CODE_OAUTH_TOKEN. La présence du programme ne garantit pas une connexion active. Les limites du compte Claude s’appliquent.</p>
            <p className="text-xs leading-5 text-gray-600">Les photos sont produites séparément par le service d’images : OpenAI, puis Pollinations en secours. Claude CLI ne génère pas lui-même les photos et ne remplace pas les crédits OpenAI.</p>
            {!cliDetected && <p className="text-xs font-medium text-amber-800">Claude CLI introuvable. Installez Claude Code sur le serveur ou configurez CLAUDE_CLI_PATH dans Variables &amp; Secrets.</p>}
            {cliPath && <details className="text-xs text-gray-500"><summary className="cursor-pointer">Emplacement du CLI</summary><p className="mt-1 break-all">{cliPath}</p></details>}
          </div>

          {/* GPT: the key lives in Variables & Secrets; the model is a catalogue row (provider openai) or the secret's default */}
          <div className={`rounded-lg border p-3 space-y-2 ${openai?.configured ? 'border-emerald-200 bg-emerald-50/60' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-gray-700">Modèle GPT — derrière le mode « IA GPT »</label>
              <Link to="/admin/secrets" className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 hover:underline">
                <KeyRound className="w-3.5 h-3.5" /> Variables & Secrets
              </Link>
            </div>
            <select
              value={settings.gptModelId ?? ''}
              onChange={(e) => setSettings({ ...settings, gptModelId: e.target.value ? Number(e.target.value) : null })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-violet-500 focus:outline-none"
            >
              <option value="">Automatique — OPENAI_BUILDER_MODEL dans Variables & Secrets ({openai?.model ?? 'gpt-5-mini'})</option>
              {openaiModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} · {m.modelId} (OpenAI{m.isDefault ? ', défaut' : ''})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">
              Modèles du catalogue avec le fournisseur <span className="font-mono">openai</span> et le rôle Constructeur ou Cerveau (bouton « Ajouter un modèle » ci-dessus). En ce moment :{' '}
              {resolvedGpt ? <span className="font-semibold text-gray-800">{resolvedGpt.label} · {resolvedGpt.modelId}</span> : <span className="font-semibold text-gray-800">{openai?.model ?? 'gpt-5-mini'}</span>}
              {resolvedGpt?.source === 'secret' ? ' (valeur du secret)' : ''}.
            </p>
            {openai?.configured ? (
              <p className="flex items-start gap-1.5 text-xs text-emerald-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Clé OpenAI configurée : les vendeurs voient « IA GPT » et « Photos IA (avec Claude ou GPT) » dans le Studio. Photos : <span className="font-semibold">{openai.imageModel}</span> ({openai.imageQuality}).
                </span>
              </p>
            ) : (
              <p className="flex items-start gap-1.5 text-xs text-amber-700 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Clé OpenAI absente : renseignez <span className="font-mono">OPENAI_API_KEY</span> dans Variables & Secrets, sinon le mode GPT reste invisible pour les vendeurs quel que soit le modèle choisi ici.
                </span>
              </p>
            )}
          </div>

          {/* What sellers get to choose from in the Studio */}
          <div className="rounded-lg border border-gray-200 p-3 space-y-2">
            <div>
              <span className="block text-sm font-semibold text-gray-900">Modes proposés aux vendeurs</span>
              <span className="block text-xs text-gray-500">Les moteurs affichés dans OpenDesign Studio. Un moteur coché n’apparaît que s’il est réellement configuré (modèle Claude activé, clé OpenAI). Un seul coché : le sélecteur disparaît.</span>
            </div>
            {(
              [
                { id: 'claude' as const, label: 'IA Claude', hint: resolved ? `${resolved.label} · ${resolved.modelId}` : 'aucun modèle Claude activé', ready: Boolean(resolved) },
                { id: 'gpt' as const, label: 'IA GPT', hint: openai?.configured ? `${resolvedGpt?.label ?? openai.model} · ${resolvedGpt?.modelId ?? openai.model}` : 'clé OpenAI absente', ready: Boolean(openai?.configured) },
                { id: 'instant' as const, label: 'Mode Rapide (< 1 s)', hint: 'lecture intégrée, sans appel ni coût ; sert aussi de secours si un modèle échoue', ready: true },
              ]
            ).map((m) => (
              <label key={m.id} className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.sellerModes[m.id]}
                  onChange={(e) => setSettings({ ...settings, sellerModes: { ...settings.sellerModes, [m.id]: e.target.checked } })}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-violet-600"
                />
                <span className="min-w-0">
                  <span className="block text-sm text-gray-900">{m.label}</span>
                  <span className={`block text-xs ${settings.sellerModes[m.id] && !m.ready ? 'text-amber-700' : 'text-gray-500'}`}>{m.hint}</span>
                </span>
              </label>
            ))}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Mode pré-sélectionné</label>
                <select
                  value={settings.sellerDefault}
                  onChange={(e) => setSettings({ ...settings, sellerDefault: e.target.value as StudioMode })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-violet-500 focus:outline-none"
                >
                  <option value="claude" disabled={!settings.sellerModes.claude}>IA Claude</option>
                  <option value="gpt" disabled={!settings.sellerModes.gpt}>IA GPT</option>
                  <option value="instant" disabled={!settings.sellerModes.instant}>Mode Rapide</option>
                </select>
              </div>
              <label className="flex items-start gap-3 cursor-pointer sm:pt-5">
                <input
                  type="checkbox"
                  checked={settings.gptImages}
                  disabled={!imageEngines.length}
                  onChange={(e) => setSettings({ ...settings, gptImages: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-violet-600 disabled:opacity-50"
                />
                <span>
                  <span className="block text-sm text-gray-900">Photos IA (avec Claude ou GPT)</span>
                  <span className="block text-xs text-gray-500">
                    {imageEngines.length ? `Moteurs, dans l’ordre : ${imageEngines.join(' → ')} (IMAGE_ENGINE_ORDER dans Variables & Secrets).` : 'Aucun moteur disponible.'}
                    {codexPath ? '' : ' Codex CLI non détecté : installez-le et lancez `codex login` sur le serveur pour des photos sans crédits API.'}
                  </span>
                </span>
              </label>
            </div>
          </div>

          {/* The store agent: the Studio's "IA" tab */}
          <div className="rounded-lg border border-gray-200 p-3 space-y-2">
            <div>
              <span className="block text-sm font-semibold text-gray-900">Agent IA de la boutique (onglet « IA » du Studio)</span>
              <span className="block text-xs text-gray-500">Le vendeur décrit un changement ; le modèle modifie textes, sections, couleurs, photos, pages et réglages. Les pages passent par les brouillons. Utilise le même modèle que le constructeur (Claude ou GPT).</span>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={settings.agent.enabled} onChange={(e) => setSettings({ ...settings, agent: { ...settings.agent, enabled: e.target.checked } })} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-violet-600" />
              <span className="text-sm text-gray-900">Activer l’agent pour les vendeurs</span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={settings.agent.allowPublish} disabled={!settings.agent.enabled} onChange={(e) => setSettings({ ...settings, agent: { ...settings.agent, allowPublish: e.target.checked } })} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-violet-600 disabled:opacity-50" />
              <span>
                <span className="block text-sm text-gray-900">Autoriser « Publier directement »</span>
                <span className="block text-xs text-gray-500">Décoché (recommandé) : l’agent ne peut que remplir les brouillons, le vendeur publie lui-même.</span>
              </span>
            </label>
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer">
            <input type="checkbox" checked={settings.writeCopy} onChange={(e) => setSettings({ ...settings, writeCopy: e.target.checked })} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-violet-600" />
            <span>
              <span className="block text-sm font-semibold text-gray-900">Rédiger les textes</span>
              <span className="block text-xs text-gray-500">Accroche, garanties, avis, FAQ, promotion, histoire : écrits pour la boutique décrite, dans la langue de la description. Décoché, le modèle ne fait que lire (niche, couleurs, éléments) et les textes standard de la niche sont utilisés.</span>
            </span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Tokens de sortie max</label>
              <input type="number" min={600} max={8000} step={100} value={settings.maxOutputTokens} onChange={(e) => setSettings({ ...settings, maxOutputTokens: Number(e.target.value) })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700">Consignes supplémentaires (optionnel)</label>
            <textarea
              rows={3}
              value={settings.instructions}
              onChange={(e) => setSettings({ ...settings, instructions: e.target.value })}
              placeholder="Ex. : ton tutoiement chaleureux ; jamais de promesse de résultat médical ; toujours mentionner la livraison gratuite dès 300 DH."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:border-violet-500 focus:outline-none"
            />
          </div>

          <button type="button" disabled={saving} onClick={() => void save({})} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-500 transition-colors disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
          </button>
        </div>

        {/* Statistiques + test */}
        <div className="space-y-4">
          {stats && (
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Appels" value={String(stats.calls)} />
              <Stat label="Échecs" value={String(stats.failures)} tone={stats.failures ? 'text-rose-600' : undefined} />
              <Stat label="Tokens" value={`${(stats.inputTokens + stats.outputTokens).toLocaleString('fr-FR')}`} />
              <div className="col-span-3 text-xs text-gray-500">
                {stats.lastAt ? <>Dernier appel : {new Date(stats.lastAt).toLocaleString('fr-FR')} · {stats.lastModel} · {stats.lastDurationMs ? `${(stats.lastDurationMs / 1000).toFixed(1)} s` : ''}</> : 'Aucun appel encore.'}
                {stats.lastError && <span className="block text-rose-600 mt-1">Dernière erreur : {stats.lastError}</span>}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 p-3 space-y-2 bg-gray-50">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5"><FlaskConical className="h-4 w-4 text-violet-500" /> Tester avec une description</label>
            <textarea rows={2} value={brief} onChange={(e) => setBrief(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none bg-white focus:border-violet-500 focus:outline-none" />
            <div className="flex flex-wrap items-center gap-2">
              {openai?.configured && (
                <select
                  value={testProvider}
                  onChange={(e) => setTestProvider(e.target.value as 'claude' | 'openai')}
                  className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 focus:border-violet-500 focus:outline-none"
                >
                  <option value="claude">Claude (modèle ci-dessus)</option>
                  <option value="openai">GPT ({resolvedGpt?.modelId ?? openai.model})</option>
                </select>
              )}
              <button type="button" disabled={testing || saving || dirty} onClick={() => void test()} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-violet-700 bg-white border border-violet-200 hover:bg-violet-50 transition-colors disabled:opacity-50">
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />} Tester le modèle enregistré
              </button>
            </div>
            {dirty && <p className="text-xs text-amber-700">Enregistrez vos modifications avant de tester le modèle sélectionné.</p>}
            <p className="text-xs text-gray-500">Ce test lit la description sans créer de boutique ni générer de photos. Il utilise le compte Claude pour le CLI ou les crédits API pour les autres modèles.</p>
            {result && (
              <div className="space-y-2 pt-2 border-t border-gray-200">
                <div className={`flex items-center gap-2 text-xs font-semibold ${result.engine.ai ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {result.engine.ai ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  {result.engine.ai ? `Lu par ${result.engine.model} en ${(result.ms / 1000).toFixed(1)} s` : result.engine.note}
                </div>
                <div className="text-xs text-gray-700">
                  <span className="font-semibold">{result.design.niche}</span> · {result.design.mood === 'dark' ? 'sombre' : 'claire'} · {result.design.fontFamily} ·{' '}
                  {['primary', 'secondary', 'bg', 'text'].map((k) => (
                    <span key={k} className="inline-block w-3.5 h-3.5 rounded-full align-middle ring-1 ring-black/10 mr-1" style={{ background: result.design.palette[k] }} title={`${k} ${result.design.palette[k]}`} />
                  ))}
                </div>
                <ul className="text-xs text-gray-600 space-y-1">
                  {result.design.rationale.map((line, i) => (
                    <li key={i}>• {line}</li>
                  ))}
                </ul>
                <p className="text-xs text-gray-500">Sections : {result.design.sections.join(' › ')}</p>
                {result.spec?.copy?.headline && <p className="text-xs text-gray-800"><span className="font-semibold">Accroche rédigée :</span> {result.spec.copy.headline}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-lg font-black ${tone ?? 'text-gray-900'}`}>{value}</div>
    </div>
  );
}

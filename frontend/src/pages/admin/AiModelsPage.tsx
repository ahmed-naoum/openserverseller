/**
 * SUPER_ADMIN — catalogue IA de la plateforme.
 *
 * Trois onglets : les chiffres globaux, le catalogue de modèles (avec les
 * drapeaux de capacité, qui décident des paramètres envoyés au fournisseur) et
 * le catalogue de voix.
 *
 * Les CLÉS API ne sont pas ici : elles vivent dans « Variables & Secrets »,
 * chiffrées en base. Une session admin compromise sur cet écran ne doit pas
 * pouvoir lire une clé.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Bot,
  Brain,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Coins,
  Eye,
  FlaskConical,
  Gauge,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  MessageSquare,
  Mic,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Repeat,
  Smartphone,
  Sparkles,
  Star,
  Trash2,
  UserCog,
  Users,
  Volume2,
  X,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getFileUrl } from '../../lib/api';
import { waAdminApi, formatWaMoney } from '../../lib/waAgentApi';
import type { AiModel, AiVoice, ModelRole, ModelTestResult } from '../../lib/waAgentApi';

/* ------------------------------------------------------------------ */
/* types & constantes                                                  */
/* ------------------------------------------------------------------ */

interface AiOverview {
  entitledAccounts: number;
  connectedSessions: number;
  conversations: number;
  last30Days: {
    turns: number;
    inputTokens: number;
    outputTokens: number;
    /** Ce que la plateforme a réellement payé aux fournisseurs. Cents entiers. */
    modelCostCents: number;
  };
  enabledModels: number;
  /** Tarif facturé au compte pour une réponse de l'agent. Cents entiers. */
  priceCents: number;
}

type CapabilityKey =
  | 'supportsThinking'
  | 'supportsEffort'
  | 'supportsVision'
  | 'supportsMidSystem'
  | 'supportsFallbacks';

const ROLE_ORDER: ModelRole[] = ['BRAIN', 'STT', 'TTS'];

const ROLE_META: Record<ModelRole, { label: string; icon: LucideIcon; tone: string }> = {
  BRAIN: { label: 'Cerveau (rédige les réponses)', icon: Brain, tone: 'bg-indigo-50 text-indigo-600' },
  STT: { label: 'Transcription (notes vocales)', icon: Mic, tone: 'bg-emerald-50 text-emerald-600' },
  TTS: { label: 'Voix (réponses vocales)', icon: Volume2, tone: 'bg-amber-50 text-amber-600' },
};

/**
 * Un modèle vocal « Live » (`*-live`, `*-native-audio`) ne lit pas un texte :
 * il tient une conversation sur un WebSocket. C'est ce qui le rend naturel, et
 * c'est aussi ce qui le rend risqué — d'où le badge, et la même détection que
 * côté serveur (wa/speech.ts).
 */
const LIVE_MODEL_RE = /live|native-audio/i;

const LIVE_MODEL_HELP =
  "Modèle Live : il parle de façon conversationnelle via un WebSocket, ce qui donne la voix la plus naturelle. Revers : il peut RÉPONDRE au texte au lieu de le lire, donc chaque prise est retranscrite et comparée au texte avant d'être envoyée au client.";

/**
 * Un modèle « admin uniquement » (le moteur CLI, adossé à UN abonnement Claude)
 * n'apparaît pas dans le sélecteur d'un compte et ne peut pas être le défaut
 * d'un rôle : la résolution le saute, le badge mentirait. La seule porte est
 * l'assignation compte par compte depuis « Comptes agent ».
 */
const ADMIN_ONLY_HELP =
  "Réservé à la plateforme : un seul abonnement partagé, aucun coût attribuable. Invisible dans le sélecteur d'un compte, et refusé comme défaut de rôle — assignez-le compte par compte depuis « Comptes agent ».";

/** L'ordre de la chaîne de repli semée par défaut sur chaque compte. */
const DEFAULT_TTS_CHAIN_NOTE =
  'Chaîne de repli par défaut, essayée dans cet ordre : audio natif (Live) → Gemini 3.1 Flash TTS → Gemini 2.5 Flash TTS → Gemini 2.5 Pro TTS ; désactiver un modèle le retire des chaînes de tous les comptes.';

/**
 * Chaque drapeau garde un paramètre de requête qui est un HTTP 400 sur un
 * modèle qui ne l'accepte pas. Ce ne sont pas des étiquettes décoratives :
 * c'est ce qui empêche l'agent d'échouer en production sur un modèle mal décrit.
 */
const CAPABILITIES: { key: CapabilityKey; short: string; help: string; icon: LucideIcon }[] = [
  {
    key: 'supportsThinking',
    short: 'Réflexion',
    help: 'Réflexion adaptative (thinking: adaptive)',
    icon: Sparkles,
  },
  {
    key: 'supportsEffort',
    short: 'Effort',
    help: "Niveau d'effort (low → max)",
    icon: Gauge,
  },
  {
    key: 'supportsVision',
    short: 'Vision',
    // C'est le SEUL mécanisme de vision du produit : il n'existe pas de modèle
    // « vision » séparé. Les photos du client sont jointes à la requête de ce
    // modèle-ci, plafonnées par « images par tour » du compte.
    help:
      'Peut lire les photos du client. Elles sont jointes directement à la requête de ce modèle — il n’y a pas de modèle de vision séparé.',
    icon: Eye,
  },
  {
    key: 'supportsMidSystem',
    short: 'Système en cours',
    help: 'Accepte un message système en cours de conversation — garde le contexte client hors du cache',
    icon: Layers,
  },
  {
    key: 'supportsFallbacks',
    short: 'Bascule',
    help: 'Bascule automatique si le modèle refuse une réponse',
    icon: Repeat,
  },
];

/**
 * Ce que « Tester » envoie vraiment, par rôle.
 *
 * Affiché en infobulle parce que le bouton dépense : un admin doit savoir ce
 * qu'il achète avant de cliquer, et surtout que le test contourne la chaîne de
 * repli — un moteur mort ne peut donc pas être sauvé par le maillon suivant et
 * rapporté comme sain.
 */
const TEST_HELP: Record<string, string> = {
  BRAIN:
    'Envoie un vrai tour de conversation (une question de prix) et vérifie que le modèle répond, en texte, avec le seul prix autorisé. Facturé par le fournisseur.',
  STT:
    'Rejoue une note vocale de test en darija et compare la transcription à ce qui a été dit. Sans repli : seul CE moteur est jugé. Facturé par le fournisseur.',
  TTS:
    'Fait lire une phrase par ce moteur, sans repli ni relance, et rend le fichier audio à écouter. Facturé par le fournisseur.',
  VISION:
    'Montre une image de couleur unie au modèle et vérifie qu’il la décrit correctement. Facturé par le fournisseur.',
};

const VOICE_PROVIDER_LABEL: Record<string, string> = {
  edge: 'Edge (Microsoft)',
  gemini: 'Gemini (Google)',
};

const API_KEY_NAMES = [
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'MUNSIT_API_KEY',
  'ELEVENLABS_API_KEY',
  'OPENAI_API_KEY',
];

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function apiMessage(err: unknown, fallback: string): string {
  const shaped = err as { response?: { data?: { message?: string } } };
  return shaped?.response?.data?.message || fallback;
}

const formatCount = (n: number) => (Number(n) || 0).toLocaleString('fr-FR');

/** `500` -> `"$5.00 / MTok"`. Les coûts sont des cents PAR MILLION de tokens. */
const formatPerMTok = (cents: number) => `${formatWaMoney(cents)} / MTok`;

/**
 * PUT /admin/ai/models/:id réécrit toutes les colonnes à partir du corps reçu :
 * un corps partiel remettrait silencieusement les drapeaux de capacité à faux.
 * Toute modification renvoie donc le modèle entier.
 */
const modelPayload = (m: AiModel): Partial<AiModel> => ({
  provider: m.provider,
  modelId: m.modelId,
  role: m.role,
  label: m.label,
  isEnabled: m.isEnabled,
  supportsEffort: m.supportsEffort,
  supportsVision: m.supportsVision,
  supportsThinking: m.supportsThinking,
  supportsMidSystem: m.supportsMidSystem,
  supportsFallbacks: m.supportsFallbacks,
  // Renvoyé tel quel : cet écran bascule un modèle en réécrivant toute la
  // ligne, et le drapeau « admin uniquement » ne doit pas se perdre en route.
  adminOnly: m.adminOnly,
  inputCostPerMTokCents: m.inputCostPerMTokCents,
  outputCostPerMTokCents: m.outputCostPerMTokCents,
  maxOutputTokens: m.maxOutputTokens,
  notes: m.notes,
  sortOrder: m.sortOrder,
});

/* ------------------------------------------------------------------ */
/* primitives locales                                                  */
/* ------------------------------------------------------------------ */

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onChange}
      className={`w-12 h-6 shrink-0 rounded-full p-1 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-emerald-500' : 'bg-slate-300'
      }`}
    >
      <div
        className={`w-4 h-4 bg-white rounded-full shadow transition-transform duration-300 ${
          checked ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${tone}`}>
          <Icon size={18} />
        </div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
      </div>
      <p className="mt-4 text-3xl font-black text-gray-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs font-medium text-gray-400">{hint}</p>}
    </div>
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
      {helper && <p className="mt-1 text-xs text-gray-500">{helper}</p>}
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  title,
  help,
  icon: Icon,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  title: string;
  help: string;
  icon: LucideIcon;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 cursor-pointer hover:bg-gray-50 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-primary-500 focus:ring-primary-500/30"
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <Icon size={14} className="text-gray-400" />
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-gray-500">{help}</span>
      </span>
    </label>
  );
}

/**
 * Le résultat d'un test, sous la ligne du modèle.
 *
 * Le verdict N'EST PAS un simple vert/rouge : un moteur qui répond mais
 * transcrit de travers, et un moteur qui ne répond pas du tout, se réparent à
 * deux endroits différents. Chaque contrôle est donc listé, et ce que le modèle
 * a réellement produit est montré tel quel — c'est la seule preuve qui vaille.
 */
function TestPanel({ result }: { result: ModelTestResult }) {
  const tone = result.ok
    ? 'border-emerald-200 bg-emerald-50/70'
    : 'border-rose-200 bg-rose-50/70';

  return (
    <div className={`mt-3 rounded-xl border p-3 ${tone}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider ${
            result.ok ? 'text-emerald-700' : 'text-rose-700'
          }`}
        >
          {result.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          {result.ok ? 'Fonctionne' : 'En échec'}
        </span>
        <span className="text-xs tabular-nums text-gray-500">
          {(result.ms / 1000).toFixed(1)} s
        </span>
        {result.usage && (
          <span className="text-xs tabular-nums text-gray-500">
            {formatCount(result.usage.inputTokens)} entrée / {formatCount(result.usage.outputTokens)} sortie
          </span>
        )}
        {result.costCents !== null && result.costCents !== undefined && (
          <span className="text-xs tabular-nums text-gray-500">
            coût annoncé {formatWaMoney(result.costCents)}
          </span>
        )}
      </div>

      <p className="mt-1.5 text-xs text-gray-700">{result.summary}</p>

      {result.checks.length > 0 && (
        <ul className="mt-2 space-y-1">
          {result.checks.map((c, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs">
              {c.ok ? (
                <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-600" />
              ) : (
                <XCircle size={12} className="mt-0.5 shrink-0 text-rose-600" />
              )}
              <span className={c.ok ? 'text-gray-600' : 'font-semibold text-rose-700'}>
                {c.label}
                {c.detail && <span className="font-normal text-gray-500"> — {c.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      {result.sample && (
        // dir="auto" : une transcription en darija s'affiche de droite à gauche,
        // et lue à l'envers elle est illisible — donc invérifiable.
        <p
          dir="auto"
          className="mt-2 rounded-lg bg-white/80 px-2.5 py-2 text-xs italic text-gray-700 ring-1 ring-inset ring-black/5"
        >
          « {result.sample} »
        </p>
      )}

      {result.audioUrl && (
        <div className="mt-2 flex items-center gap-2">
          <Volume2 size={14} className="shrink-0 text-gray-400" />
          <audio controls src={getFileUrl(result.audioUrl)} className="h-9 w-full max-w-xs" />
        </div>
      )}
    </div>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-100 bg-white">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-gray-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* brouillons de formulaire                                            */
/* ------------------------------------------------------------------ */

interface ModelDraft {
  provider: string;
  modelId: string;
  label: string;
  role: ModelRole;
  isEnabled: boolean;
  supportsThinking: boolean;
  supportsEffort: boolean;
  supportsVision: boolean;
  supportsMidSystem: boolean;
  supportsFallbacks: boolean;
  /** Non modifiable dans le formulaire : transporté pour ne pas l'effacer. */
  adminOnly: boolean;
  /** Saisis en cents par million de tokens — le backend les prend tels quels. */
  inputCostPerMTokCents: string;
  outputCostPerMTokCents: string;
  maxOutputTokens: string;
  sortOrder: string;
  notes: string;
}

const emptyModelDraft = (role: ModelRole): ModelDraft => ({
  provider: '',
  modelId: '',
  label: '',
  role,
  isEnabled: true,
  supportsThinking: false,
  supportsEffort: false,
  supportsVision: false,
  supportsMidSystem: false,
  supportsFallbacks: false,
  adminOnly: false,
  inputCostPerMTokCents: '0',
  outputCostPerMTokCents: '0',
  maxOutputTokens: '4096',
  sortOrder: '0',
  notes: '',
});

const modelToDraft = (m: AiModel): ModelDraft => ({
  provider: m.provider,
  modelId: m.modelId,
  label: m.label,
  role: m.role,
  isEnabled: m.isEnabled,
  supportsThinking: m.supportsThinking,
  supportsEffort: m.supportsEffort,
  supportsVision: m.supportsVision,
  supportsMidSystem: m.supportsMidSystem,
  supportsFallbacks: m.supportsFallbacks,
  adminOnly: m.adminOnly,
  inputCostPerMTokCents: String(m.inputCostPerMTokCents),
  outputCostPerMTokCents: String(m.outputCostPerMTokCents),
  maxOutputTokens: String(m.maxOutputTokens),
  sortOrder: String(m.sortOrder),
  notes: m.notes ?? '',
});

interface VoiceDraft {
  provider: string;
  voiceId: string;
  label: string;
  locale: string;
  gender: string;
  isEnabled: boolean;
  supportsProsody: boolean;
  supportsStyle: boolean;
  /** Saisis séparés par des virgules. */
  styles: string;
  sortOrder: string;
}

const emptyVoiceDraft = (provider: string): VoiceDraft => ({
  provider,
  voiceId: '',
  label: '',
  locale: '',
  gender: '',
  isEnabled: true,
  supportsProsody: provider === 'edge',
  supportsStyle: false,
  styles: '',
  sortOrder: '0',
});

const voiceToDraft = (v: AiVoice): VoiceDraft => ({
  provider: v.provider,
  voiceId: v.voiceId,
  label: v.label,
  locale: v.locale ?? '',
  gender: v.gender ?? '',
  isEnabled: v.isEnabled,
  supportsProsody: v.supportsProsody,
  supportsStyle: v.supportsStyle,
  styles: v.styles.join(', '),
  sortOrder: String(v.sortOrder),
});

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

type Tab = 'OVERVIEW' | 'MODELS' | 'VOICES';

export default function AiModelsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('OVERVIEW');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [overview, setOverview] = useState<AiOverview | null>(null);
  const [models, setModels] = useState<AiModel[]>([]);
  const [roles, setRoles] = useState<ModelRole[]>(ROLE_ORDER);
  const [voices, setVoices] = useState<AiVoice[]>([]);

  // id du modèle / de la voix en cours d'écriture — désactive sa ligne.
  const [busyModelId, setBusyModelId] = useState<number | null>(null);
  const [reorderingRole, setReorderingRole] = useState<ModelRole | null>(null);
  const [busyVoiceId, setBusyVoiceId] = useState<number | null>(null);

  const [editingModel, setEditingModel] = useState<AiModel | null>(null);
  const [modelDraft, setModelDraft] = useState<ModelDraft | null>(null);
  const [deletingModel, setDeletingModel] = useState<AiModel | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  /**
   * Le dernier résultat de test par modèle, gardé en mémoire seulement.
   *
   * Pas persisté exprès : « ça marchait il y a une heure » est précisément
   * l'affirmation qui trompe. Un résultat ne survit donc pas au rechargement,
   * et ce qui est à l'écran a toujours été obtenu maintenant.
   */
  const [testResults, setTestResults] = useState<Record<number, ModelTestResult>>({});
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testingRole, setTestingRole] = useState<ModelRole | null>(null);
  const [testProgress, setTestProgress] = useState({ done: 0, total: 0 });

  const [editingVoice, setEditingVoice] = useState<AiVoice | null>(null);
  const [voiceDraft, setVoiceDraft] = useState<VoiceDraft | null>(null);

  const [saving, setSaving] = useState(false);

  const load = async (silent = false) => {
    if (silent) setRefreshing(true);
    try {
      const [overviewRes, modelsRes, voicesRes] = await Promise.all([
        waAdminApi.overview(),
        waAdminApi.models(),
        waAdminApi.voices(),
      ]);
      setOverview(overviewRes.data.data as AiOverview);
      const catalogue = modelsRes.data.data as { models: AiModel[]; roles: ModelRole[] };
      setModels(catalogue.models || []);
      setRoles(catalogue.roles?.length ? catalogue.roles : ROLE_ORDER);
      setVoices((voicesRes.data.data as AiVoice[]) || []);
    } catch (err) {
      toast.error(apiMessage(err, 'Erreur lors du chargement du catalogue IA'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* ---------------- modèles ---------------- */

  const modelsByRole = useMemo(() => {
    const map = new Map<ModelRole, AiModel[]>();
    roles.forEach((r) => map.set(r, []));
    models.forEach((m) => {
      const list = map.get(m.role);
      if (list) list.push(m);
      else map.set(m.role, [m]);
    });
    return map;
  }, [models, roles]);

  const toggleModel = async (m: AiModel) => {
    setBusyModelId(m.id);
    try {
      await waAdminApi.updateModel(m.id, { ...modelPayload(m), isEnabled: !m.isEnabled });
      toast.success(m.isEnabled ? `${m.label} désactivé` : `${m.label} activé`);
      await load(true);
    } catch (err) {
      toast.error(apiMessage(err, 'Erreur lors de la mise à jour du modèle'));
    } finally {
      setBusyModelId(null);
    }
  };

  const makeDefault = async (m: AiModel) => {
    setBusyModelId(m.id);
    try {
      await waAdminApi.setDefaultModel(m.id);
      toast.success(`${m.label} est le modèle par défaut pour ce rôle`);
      await load(true);
    } catch (err) {
      toast.error(apiMessage(err, 'Erreur lors de la définition du modèle par défaut'));
    } finally {
      setBusyModelId(null);
    }
  };

  /**
   * Monte ou descend un modèle dans son rôle.
   *
   * Le rang compte pour de vrai : resolveModel() retombe sur le modèle activé
   * qui trie en premier quand un compte n'a pas choisi le sien. Ce bouton
   * décide donc « qui répond par défaut », pas seulement l'ordre d'affichage.
   *
   * L'écran bouge AVANT le serveur, puis se resynchronise sur ce qu'il renvoie :
   * une flèche qui ne répond qu'après un aller-retour donne l'impression d'un
   * clic perdu, et on reclique — ce qui, sur un classement, annule le geste.
   */
  const moveModel = async (role: ModelRole, index: number, delta: number) => {
    const rows = modelsByRole.get(role) ?? [];
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;

    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];

    const ids = next.map((m) => m.id);
    setModels((current) => {
      const rank = new Map(ids.map((id, i) => [id, i]));
      return [...current].sort((a, b) => {
        if (a.role !== b.role) return 0;
        const ra = rank.get(a.id);
        const rb = rank.get(b.id);
        if (ra === undefined || rb === undefined) return 0;
        return ra - rb;
      });
    });

    setReorderingRole(role);
    try {
      await waAdminApi.reorderModels(role, ids);
      await load(true);
    } catch (err) {
      toast.error(apiMessage(err, 'Erreur lors du classement des modèles'));
      // Le serveur a refusé : on reprend son état plutôt que de laisser
      // l'écran afficher un ordre qui n'existe nulle part.
      await load(true);
    } finally {
      setReorderingRole(null);
    }
  };

  const openModelForm = (m: AiModel | null, role: ModelRole = 'BRAIN') => {
    setEditingModel(m);
    setModelDraft(m ? modelToDraft(m) : emptyModelDraft(role));
  };

  const closeModelForm = () => {
    setEditingModel(null);
    setModelDraft(null);
  };

  const submitModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelDraft) return;

    const payload: Partial<AiModel> = {
      provider: modelDraft.provider.trim().toLowerCase(),
      modelId: modelDraft.modelId.trim(),
      role: modelDraft.role,
      label: modelDraft.label.trim() || modelDraft.modelId.trim(),
      isEnabled: modelDraft.isEnabled,
      supportsThinking: modelDraft.supportsThinking,
      supportsEffort: modelDraft.supportsEffort,
      supportsVision: modelDraft.supportsVision,
      supportsMidSystem: modelDraft.supportsMidSystem,
      supportsFallbacks: modelDraft.supportsFallbacks,
      adminOnly: modelDraft.adminOnly,
      inputCostPerMTokCents: Math.max(0, Math.trunc(Number(modelDraft.inputCostPerMTokCents) || 0)),
      outputCostPerMTokCents: Math.max(0, Math.trunc(Number(modelDraft.outputCostPerMTokCents) || 0)),
      maxOutputTokens: Math.max(1, Math.trunc(Number(modelDraft.maxOutputTokens) || 4096)),
      sortOrder: Math.max(0, Math.trunc(Number(modelDraft.sortOrder) || 0)),
      notes: modelDraft.notes.trim() || null,
    };

    setSaving(true);
    try {
      if (editingModel) {
        await waAdminApi.updateModel(editingModel.id, payload);
        toast.success('Modèle mis à jour');
      } else {
        await waAdminApi.createModel(payload);
        toast.success('Modèle ajouté au catalogue');
      }
      closeModelForm();
      await load(true);
    } catch (err) {
      toast.error(apiMessage(err, "Erreur lors de l'enregistrement du modèle"));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Le nombre de comptes rattachés n'est connu qu'au retour de la suppression :
   * le backend le compte au moment où il supprime. La confirmation avertit donc
   * du mécanisme, et le résultat annonce le nombre réel.
   */
  const confirmDeleteModel = async () => {
    if (!deletingModel) return;
    setDeletingBusy(true);
    try {
      const res = await waAdminApi.deleteModel(deletingModel.id);
      const detached = Number((res.data.data as { detachedAccounts?: number })?.detachedAccounts ?? 0);
      toast.success(
        detached > 0
          ? `${deletingModel.label} supprimé — ${detached} compte(s) rattaché(s) au modèle par défaut de son rôle.`
          : `${deletingModel.label} supprimé. Aucun compte ne l'utilisait.`
      );
      setDeletingModel(null);
      await load(true);
    } catch (err) {
      toast.error(apiMessage(err, 'Erreur lors de la suppression du modèle'));
    } finally {
      setDeletingBusy(false);
    }
  };

  /* ---------------- tests ---------------- */

  /**
   * Un seul test à la fois dans tout l'écran.
   *
   * Deux tests lancés en même temps partagent la clé du fournisseur : le second
   * se prend la limite de débit du premier et rapporte « en panne » un modèle
   * qui va très bien.
   */
  const testsBusy = testingId !== null || testingRole !== null;

  /**
   * Un vrai appel au fournisseur, sur une ligne du catalogue.
   *
   * Le serveur rend 200 même quand le modèle est en panne — l'échec est la
   * réponse, pas une erreur de transport — donc le catch ici ne couvre que
   * l'aller-retour lui-même (réseau coupé, session expirée, dépassement du
   * délai). Les deux cas doivent se lire différemment à l'écran : « le modèle
   * ne marche pas » et « le test n'a pas pu être fait » ne se corrigent pas au
   * même endroit.
   */
  const runTest = async (m: AiModel): Promise<ModelTestResult | null> => {
    setTestingId(m.id);
    try {
      const res = await waAdminApi.testModel(m.id);
      const result = res.data.data as ModelTestResult;
      setTestResults((current) => ({ ...current, [m.id]: result }));
      if (result.ok) toast.success(`${m.label} répond`);
      else toast.error(`${m.label} : ${result.summary}`);
      return result;
    } catch (err) {
      const message = apiMessage(err, 'Le test n’a pas pu être exécuté.');
      setTestResults((current) => ({
        ...current,
        [m.id]: {
          ok: false,
          role: m.role,
          provider: m.provider,
          modelId: m.modelId,
          label: m.label,
          ms: 0,
          summary: message,
          sample: null,
          audioUrl: null,
          checks: [{ label: 'Le test a pu être lancé', ok: false, detail: message }],
          error: message,
          usage: null,
          costCents: null,
        },
      }));
      toast.error(`${m.label} : ${message}`);
      return null;
    } finally {
      setTestingId(null);
    }
  };

  /**
   * Tout un rôle, UN MODÈLE À LA FOIS.
   *
   * Séquentiel et non parallèle : ces moteurs partagent une clé par
   * fournisseur, et six appels simultanés se limitent mutuellement en débit —
   * on rapporterait « en panne » sur des modèles que seul le test aurait mis en
   * défaut.
   */
  const runRoleTests = async (role: ModelRole) => {
    const rows = modelsByRole.get(role) ?? [];
    if (!rows.length) return;

    setTestingRole(role);
    setTestProgress({ done: 0, total: rows.length });
    let failures = 0;
    try {
      for (const [index, m] of rows.entries()) {
        const result = await runTest(m);
        if (!result?.ok) failures++;
        setTestProgress({ done: index + 1, total: rows.length });
      }
      toast[failures ? 'error' : 'success'](
        failures
          ? `${failures} modèle(s) sur ${rows.length} en échec pour ${role}.`
          : `Les ${rows.length} modèles ${role} répondent.`
      );
    } finally {
      setTestingRole(null);
      setTestProgress({ done: 0, total: 0 });
    }
  };

  /* ---------------- voix ---------------- */

  const voicesByProvider = useMemo(() => {
    const map = new Map<string, AiVoice[]>();
    voices.forEach((v) => {
      const list = map.get(v.provider) ?? [];
      list.push(v);
      map.set(v.provider, list);
    });
    return Array.from(map, ([provider, rows]) => ({ provider, rows }));
  }, [voices]);

  const toggleVoice = async (v: AiVoice) => {
    setBusyVoiceId(v.id);
    try {
      await waAdminApi.updateVoice(v.id, { isEnabled: !v.isEnabled });
      toast.success(v.isEnabled ? `${v.label} désactivée` : `${v.label} activée`);
      await load(true);
    } catch (err) {
      toast.error(apiMessage(err, 'Erreur lors de la mise à jour de la voix'));
    } finally {
      setBusyVoiceId(null);
    }
  };

  const openVoiceForm = (v: AiVoice | null, provider = 'edge') => {
    setEditingVoice(v);
    setVoiceDraft(v ? voiceToDraft(v) : emptyVoiceDraft(provider));
  };

  const closeVoiceForm = () => {
    setEditingVoice(null);
    setVoiceDraft(null);
  };

  const submitVoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voiceDraft) return;

    const styles = voiceDraft.styles
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: Partial<AiVoice> = {
      label: voiceDraft.label.trim() || voiceDraft.voiceId.trim(),
      locale: voiceDraft.locale.trim() || null,
      gender: voiceDraft.gender.trim() || null,
      isEnabled: voiceDraft.isEnabled,
      supportsProsody: voiceDraft.supportsProsody,
      supportsStyle: voiceDraft.supportsStyle,
      styles,
      sortOrder: Math.max(0, Math.trunc(Number(voiceDraft.sortOrder) || 0)),
    };

    setSaving(true);
    try {
      if (editingVoice) {
        await waAdminApi.updateVoice(editingVoice.id, payload);
        toast.success('Voix mise à jour');
      } else {
        await waAdminApi.createVoice({
          ...payload,
          provider: voiceDraft.provider.trim().toLowerCase(),
          voiceId: voiceDraft.voiceId.trim(),
        });
        toast.success('Voix ajoutée au catalogue');
      }
      closeVoiceForm();
      await load(true);
    } catch (err) {
      toast.error(apiMessage(err, "Erreur lors de l'enregistrement de la voix"));
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- rendu ---------------- */

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  const billedCents = overview ? overview.last30Days.turns * overview.priceCents : 0;

  return (
    <div className="space-y-6 p-1">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900 tracking-tight">
            <Bot className="h-6 w-6 text-primary-500" />
            Catalogue IA
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Les modèles et les voix que les comptes peuvent choisir pour leur agent WhatsApp.
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          title="Actualiser"
          className="p-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl hover:text-primary-600 hover:border-primary-100 transition-all shadow-sm disabled:opacity-50 w-fit"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Onglets */}
      <div className="flex items-center gap-4 border-b border-gray-100 overflow-x-auto">
        {([
          ['OVERVIEW', "Vue d'ensemble"],
          ['MODELS', 'Modèles'],
          ['VOICES', 'Voix'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`pb-4 px-2 text-sm font-black whitespace-nowrap transition-all ${
              activeTab === key
                ? 'text-primary-600 border-b-2 border-primary-500'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ============================ VUE D'ENSEMBLE ============================ */}
      {activeTab === 'OVERVIEW' && overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            <StatCard
              icon={Users}
              label="Comptes activés"
              value={formatCount(overview.entitledAccounts)}
              hint="Vendeurs et influenceurs qui ont l'agent"
              tone="bg-indigo-50 text-indigo-600"
            />
            <StatCard
              icon={Smartphone}
              label="Sessions connectées"
              value={formatCount(overview.connectedSessions)}
              hint="WhatsApp actuellement en ligne"
              tone="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              icon={MessageSquare}
              label="Conversations"
              value={formatCount(overview.conversations)}
              hint="Contacts suivis, tous comptes confondus"
              tone="bg-sky-50 text-sky-600"
            />
            <StatCard
              icon={Sparkles}
              label="Modèles activés"
              value={formatCount(overview.enabledModels)}
              hint={`Tarif facturé : ${formatWaMoney(overview.priceCents)} / réponse`}
              tone="bg-amber-50 text-amber-600"
            />
          </div>

          {/* Bloc 30 jours */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/60">
              <div className="p-2 rounded-xl bg-primary-50 text-primary-600">
                <Coins size={18} />
              </div>
              <div>
                <h2 className="text-sm font-black text-gray-900">Consommation — 30 derniers jours</h2>
                <p className="text-xs text-gray-500">Agrégé sur tous les comptes de la plateforme.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 divide-y divide-gray-100 lg:divide-y-0 lg:divide-x lg:rtl:divide-x-reverse">
              <div className="p-6">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Réponses</p>
                <p className="mt-2 text-2xl font-black text-gray-900 tabular-nums">
                  {formatCount(overview.last30Days.turns)}
                </p>
              </div>
              <div className="p-6">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tokens entrée</p>
                <p className="mt-2 text-2xl font-black text-gray-900 tabular-nums">
                  {formatCount(overview.last30Days.inputTokens)}
                </p>
              </div>
              <div className="p-6">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tokens sortie</p>
                <p className="mt-2 text-2xl font-black text-gray-900 tabular-nums">
                  {formatCount(overview.last30Days.outputTokens)}
                </p>
              </div>
              <div className="p-6 bg-amber-50/40">
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Coût modèle</p>
                <p className="mt-2 text-2xl font-black text-amber-700 tabular-nums">
                  {formatWaMoney(overview.last30Days.modelCostCents)}
                </p>
                <p className="mt-1 text-[11px] font-medium text-amber-600/80">Payé aux fournisseurs</p>
              </div>
            </div>

            {/* Le point de la page : coût réel contre tarif facturé. */}
            <div className="flex items-start gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/60">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-xs text-gray-600 leading-relaxed">
                Sur la même période, les comptes ont été facturés{' '}
                <span className="font-bold text-gray-900">{formatWaMoney(billedCents)}</span> (
                {formatCount(overview.last30Days.turns)} réponses ×{' '}
                {formatWaMoney(overview.priceCents)}), pour un coût modèle réel de{' '}
                <span className="font-bold text-gray-900">
                  {formatWaMoney(overview.last30Days.modelCostCents)}
                </span>
                . Quand le coût modèle s'écarte durablement de ce qui est facturé, c'est le{' '}
                <span className="font-semibold">tarif par réponse</span> qu'il faut changer — le
                catalogue ci-contre ne fait que décrire ce que la plateforme paie.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ================================ MODÈLES ================================ */}
      {activeTab === 'MODELS' && (
        <div className="space-y-6">
          {/* Les clés API ne sont pas ici. */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
            <KeyRound className="h-5 w-5 shrink-0 text-indigo-500" />
            <div className="text-sm text-indigo-900 flex-1">
              <p className="font-semibold">Les clés API ne se configurent pas ici.</p>
              <p className="mt-1 text-xs text-indigo-800/80">
                Ce catalogue décrit quels modèles existent et ce qu'ils coûtent. Les identifiants
                des fournisseurs ({API_KEY_NAMES.join(', ')}) vivent dans l'écran{' '}
                <span className="font-semibold">Variables &amp; Secrets</span>, chiffrés en base.
              </p>
            </div>
            <Link
              to="/admin/secrets"
              className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-white border border-indigo-200 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50 transition-colors w-fit"
            >
              <KeyRound size={14} />
              Variables &amp; Secrets
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              Un compte ne peut choisir que parmi les modèles activés. Le modèle{' '}
              <span className="font-semibold text-gray-700">Défaut</span> de chaque rôle sert de
              repli quand un compte n'a rien choisi.
              <br />
              <span className="text-xs">
                <span className="font-semibold text-gray-700">Tester</span> envoie un vrai appel au
                fournisseur, sans chaîne de repli : c'est facturé, et c'est la seule façon de
                distinguer un modèle activé d'un modèle qui répond. Chaque essai laisse sa ligne
                dans le <Link to="/admin/agent-logs" className="font-semibold text-primary-600 hover:underline">Journal</Link>.
              </span>
            </p>
            <button onClick={() => openModelForm(null)} className="btn-primary w-fit">
              <Plus size={16} />
              Ajouter un modèle
            </button>
          </div>

          {roles.map((role) => {
            const meta = ROLE_META[role] ?? {
              label: role,
              icon: Sparkles,
              tone: 'bg-gray-100 text-gray-600',
            };
            const RoleIcon = meta.icon;
            const rows = modelsByRole.get(role) ?? [];

            return (
              <section
                key={role}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${meta.tone}`}>
                      <RoleIcon size={16} />
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-gray-900">{meta.label}</h2>
                      <p className="text-[11px] font-mono text-gray-400">{role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void runRoleTests(role)}
                      disabled={testsBusy || rows.length === 0}
                      title={`${TEST_HELP[role] || ''} Chaque modèle du rôle est testé l'un après l'autre.`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-white hover:text-primary-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {testingRole === role ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <FlaskConical size={14} />
                      )}
                      {testingRole === role
                        ? `Test ${testProgress.done}/${testProgress.total}`
                        : 'Tout tester'}
                    </button>
                    <button
                      onClick={() => openModelForm(null, role)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-white hover:text-primary-600 transition-colors"
                    >
                      <Plus size={14} />
                      Ajouter
                    </button>
                  </div>
                </div>

                <p className="px-5 pt-3 text-xs leading-relaxed text-gray-500">
                  L&apos;ordre ci-dessous est un <span className="font-semibold">classement de
                  préférence</span> : quand un compte n&apos;a pas choisi de modèle, c&apos;est le
                  premier activé de cette liste qui répond (le badge « Défaut » passe devant).
                  Les modèles « admin uniquement » ne sont jamais choisis automatiquement.
                </p>

                {/* La chaîne de repli n'existe que pour la voix : on l'explique là où elle se règle. */}
                {role === 'TTS' && (
                  <p className="px-5 pt-3 pb-1 text-xs leading-relaxed text-gray-500">
                    {DEFAULT_TTS_CHAIN_NOTE}
                  </p>
                )}

                {rows.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-gray-400">
                    Aucun modèle pour ce rôle.
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {rows.map((m, index) => {
                      const isBusy = busyModelId === m.id || reorderingRole === role;
                      const test = testResults[m.id];
                      return (
                        <li key={m.id} className="px-5 py-4">
                          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            {/* Le classement. Le rang est affiché parce qu'un
                                ordre qu'on ne peut pas lire ne se vérifie pas. */}
                            <div className="flex shrink-0 items-center gap-1 pt-0.5">
                              <span className="w-5 text-center text-[11px] font-black tabular-nums text-gray-300">
                                {index + 1}
                              </span>
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  onClick={() => void moveModel(role, index, -1)}
                                  disabled={index === 0 || isBusy}
                                  title="Monter dans le classement"
                                  className="rounded p-0.5 text-gray-300 hover:text-primary-600 disabled:opacity-30 disabled:hover:text-gray-300"
                                >
                                  <ChevronUp size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void moveModel(role, index, 1)}
                                  disabled={index === rows.length - 1 || isBusy}
                                  title="Descendre dans le classement"
                                  className="rounded p-0.5 text-gray-300 hover:text-primary-600 disabled:opacity-30 disabled:hover:text-gray-300"
                                >
                                  <ChevronDown size={14} />
                                </button>
                              </div>
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`font-bold ${
                                    m.isEnabled ? 'text-gray-900' : 'text-gray-400'
                                  }`}
                                >
                                  {m.label}
                                </span>
                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-gray-500">
                                  {m.provider}
                                </span>
                                {m.isDefault && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary-600">
                                    <Star size={10} className="fill-current" />
                                    Défaut
                                  </span>
                                )}
                                {!m.isEnabled && (
                                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-600">
                                    Désactivé
                                  </span>
                                )}
                                {m.adminOnly && (
                                  <span
                                    title={ADMIN_ONLY_HELP}
                                    className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-600"
                                  >
                                    <Lock size={10} />
                                    Admin uniquement
                                  </span>
                                )}
                                {m.role === 'TTS' && LIVE_MODEL_RE.test(m.modelId) && (
                                  <span
                                    title={LIVE_MODEL_HELP}
                                    className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-violet-600"
                                  >
                                    <Radio size={10} />
                                    Live
                                  </span>
                                )}
                              </div>

                              <code className="mt-1 block truncate font-mono text-xs text-gray-500">
                                {m.modelId}
                              </code>

                              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                                <span>
                                  Entrée{' '}
                                  <span className="font-bold text-gray-700 tabular-nums">
                                    {formatPerMTok(m.inputCostPerMTokCents)}
                                  </span>
                                </span>
                                <span>
                                  Sortie{' '}
                                  <span className="font-bold text-gray-700 tabular-nums">
                                    {formatPerMTok(m.outputCostPerMTokCents)}
                                  </span>
                                </span>
                                <span>
                                  Sortie max{' '}
                                  <span className="font-bold text-gray-700 tabular-nums">
                                    {formatCount(m.maxOutputTokens)} tokens
                                  </span>
                                </span>
                              </div>

                              {/* Les cinq drapeaux : chacun garde un paramètre de requête. */}
                              <div className="mt-2.5 flex flex-wrap gap-1.5">
                                {CAPABILITIES.map((cap) => {
                                  const on = m[cap.key];
                                  const CapIcon = cap.icon;
                                  return (
                                    <span
                                      key={cap.key}
                                      title={cap.help}
                                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold ${
                                        on
                                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
                                          : 'bg-gray-50 text-gray-400 ring-1 ring-inset ring-gray-200'
                                      }`}
                                    >
                                      <CapIcon size={11} />
                                      {cap.short}
                                    </span>
                                  );
                                })}
                              </div>

                              {m.notes && (
                                <p className="mt-2 text-xs italic text-gray-400">{m.notes}</p>
                              )}

                              {test && <TestPanel result={test} />}
                            </div>

                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                              <Toggle
                                checked={m.isEnabled}
                                disabled={isBusy}
                                onChange={() => toggleModel(m)}
                                label={m.isEnabled ? 'Désactiver le modèle' : 'Activer le modèle'}
                              />

                              {/*
                                Pas de bouton « Définir par défaut » sur un
                                modèle admin uniquement : le serveur le refuse
                                (aucun compte ne le résoudrait). On envoie là
                                où l'assignation existe vraiment.
                              */}
                              {m.adminOnly ? (
                                <Link
                                  to="/admin/agent-accounts"
                                  title={ADMIN_ONLY_HELP}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 transition-colors"
                                >
                                  <UserCog size={14} />
                                  Assigner par compte
                                </Link>
                              ) : m.isDefault ? (
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-2 text-xs font-bold text-primary-600">
                                  <Star size={14} className="fill-current" />
                                  Défaut
                                </span>
                              ) : (
                                <button
                                  onClick={() => makeDefault(m)}
                                  disabled={isBusy || !m.isEnabled}
                                  title={
                                    m.isEnabled
                                      ? 'Faire de ce modèle le défaut du rôle'
                                      : 'Activez le modèle avant d’en faire le défaut'
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 hover:text-primary-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <Star size={14} />
                                  Définir par défaut
                                </button>
                              )}

                              {/*
                                Le seul bouton de cet écran qui dépense de
                                l'argent — un appel facturé au fournisseur — d'où
                                l'infobulle qui dit exactement ce qui part.
                              */}
                              <button
                                onClick={() => void runTest(m)}
                                disabled={testsBusy}
                                title={TEST_HELP[m.role] || 'Envoie un vrai appel au fournisseur.'}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 hover:text-primary-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {testingId === m.id ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <FlaskConical size={14} />
                                )}
                                {testingId === m.id ? 'Test…' : 'Tester'}
                              </button>

                              <button
                                onClick={() => openModelForm(m)}
                                className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                title="Modifier"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => setDeletingModel(m)}
                                className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* ================================= VOIX ================================= */}
      {activeTab === 'VOICES' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-gray-500 max-w-3xl">
              Les voix <span className="font-semibold text-gray-700">Edge</span> acceptent une
              vitesse, une hauteur et un volume numériques réels (SSML) — c'est{' '}
              <span className="font-semibold">Prosodie</span> ; les voix{' '}
              <span className="font-semibold text-gray-700">Gemini</span> ne se règlent pas ainsi,
              on les dirige avec une consigne écrite — c'est{' '}
              <span className="font-semibold">Style</span>.
            </p>
            <button onClick={() => openVoiceForm(null)} className="btn-primary w-fit">
              <Plus size={16} />
              Ajouter une voix
            </button>
          </div>

          {voicesByProvider.length === 0 && (
            <p className="py-12 text-center text-sm text-gray-400">
              Aucune voix dans le catalogue.
            </p>
          )}

          {voicesByProvider.map(({ provider, rows }) => (
            <section
              key={provider}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-fuchsia-50 text-fuchsia-600">
                    <Volume2 size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-gray-900">
                      {VOICE_PROVIDER_LABEL[provider] ?? provider}
                    </h2>
                    <p className="text-[11px] text-gray-400">
                      {rows.length} voix ·{' '}
                      {provider === 'gemini'
                        ? 'dirigée par une consigne écrite'
                        : 'vitesse / hauteur / volume réels'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => openVoiceForm(null, provider)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-white hover:text-primary-600 transition-colors"
                >
                  <Plus size={14} />
                  Ajouter
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50/40">
                    <tr>
                      {['Voix', 'Identifiant', 'Langue', 'Genre', 'Activée', 'Prosodie', 'Style', 'Styles', ''].map(
                        (h, i) => (
                          <th
                            key={i}
                            className="px-4 py-3 text-start text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap"
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((v) => (
                      <tr key={v.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-bold ${
                                v.isEnabled ? 'text-gray-900' : 'text-gray-400'
                              }`}
                            >
                              {v.label}
                            </span>
                            {v.isDefault && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-primary-600">
                                <Star size={9} className="fill-current" />
                                Défaut
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <code className="font-mono text-xs text-gray-500">{v.voiceId}</code>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                          {v.locale || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                          {v.gender || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <Toggle
                            checked={v.isEnabled}
                            disabled={busyVoiceId === v.id}
                            onChange={() => toggleVoice(v)}
                            label={v.isEnabled ? 'Désactiver la voix' : 'Activer la voix'}
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            title="Vitesse, hauteur et volume numériques (SSML)"
                            className={`inline-flex rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
                              v.supportsProsody
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-gray-50 text-gray-400'
                            }`}
                          >
                            {v.supportsProsody ? 'Oui' : 'Non'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            title="Émotion nommée, ou consigne de livraison écrite (Gemini)"
                            className={`inline-flex rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
                              v.supportsStyle
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-gray-50 text-gray-400'
                            }`}
                          >
                            {v.supportsStyle ? 'Oui' : 'Non'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {v.styles.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {v.styles.map((s) => (
                                <span
                                  key={s}
                                  className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-end whitespace-nowrap">
                          <button
                            onClick={() => openVoiceForm(v)}
                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Pencil size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ============================ MODALE MODÈLE ============================ */}
      {modelDraft && (
        <Modal
          title={editingModel ? 'Modifier le modèle' : 'Ajouter un modèle'}
          subtitle="Les drapeaux de capacité décident des paramètres envoyés au fournisseur."
          onClose={closeModelForm}
        >
          <form onSubmit={submitModel} className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Rôle *">
                <select
                  value={modelDraft.role}
                  onChange={(e) =>
                    setModelDraft({ ...modelDraft, role: e.target.value as ModelRole })
                  }
                  className="input"
                >
                  {ROLE_ORDER.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_META[r].label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Fournisseur *" helper="anthropic, google, munsit, elevenlabs, openai…">
                <input
                  type="text"
                  required
                  value={modelDraft.provider}
                  onChange={(e) => setModelDraft({ ...modelDraft, provider: e.target.value })}
                  className="input font-mono text-sm"
                  placeholder="anthropic"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Identifiant du modèle *" helper="Exactement l'identifiant attendu par l'API.">
                <input
                  type="text"
                  required
                  value={modelDraft.modelId}
                  onChange={(e) => setModelDraft({ ...modelDraft, modelId: e.target.value })}
                  className="input font-mono text-sm"
                  placeholder="claude-sonnet-4-5"
                />
              </Field>
              <Field label="Libellé" helper="Ce que le compte voit dans son studio.">
                <input
                  type="text"
                  value={modelDraft.label}
                  onChange={(e) => setModelDraft({ ...modelDraft, label: e.target.value })}
                  className="input"
                  placeholder="Claude Sonnet 4.5"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field
                label="Coût entrée"
                helper={`${formatPerMTok(Number(modelDraft.inputCostPerMTokCents) || 0)} — en cents par million de tokens.`}
              >
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={modelDraft.inputCostPerMTokCents}
                  onChange={(e) =>
                    setModelDraft({ ...modelDraft, inputCostPerMTokCents: e.target.value })
                  }
                  className="input tabular-nums"
                />
              </Field>
              <Field
                label="Coût sortie"
                helper={`${formatPerMTok(Number(modelDraft.outputCostPerMTokCents) || 0)} — en cents par million de tokens.`}
              >
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={modelDraft.outputCostPerMTokCents}
                  onChange={(e) =>
                    setModelDraft({ ...modelDraft, outputCostPerMTokCents: e.target.value })
                  }
                  className="input tabular-nums"
                />
              </Field>
              <Field label="Tokens de sortie max">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={modelDraft.maxOutputTokens}
                  onChange={(e) =>
                    setModelDraft({ ...modelDraft, maxOutputTokens: e.target.value })
                  }
                  className="input tabular-nums"
                />
              </Field>
            </div>

            <div>
              <p className="text-sm font-bold text-gray-900">Capacités</p>
              <p className="mt-0.5 mb-3 text-xs text-gray-500">
                Chaque case autorise un paramètre de requête. Cocher une capacité que le modèle
                n'a pas fait échouer l'appel en HTTP 400 au premier message d'un client.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {CAPABILITIES.map((cap) => (
                  <CheckRow
                    key={cap.key}
                    checked={modelDraft[cap.key]}
                    onChange={(next) => setModelDraft({ ...modelDraft, [cap.key]: next })}
                    title={cap.short}
                    help={cap.help}
                    icon={cap.icon}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Ordre d'affichage">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={modelDraft.sortOrder}
                  onChange={(e) => setModelDraft({ ...modelDraft, sortOrder: e.target.value })}
                  className="input tabular-nums"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Notes internes">
                  <input
                    type="text"
                    value={modelDraft.notes}
                    onChange={(e) => setModelDraft({ ...modelDraft, notes: e.target.value })}
                    className="input"
                    placeholder="Contexte 200k, latence élevée…"
                  />
                </Field>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 p-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Activé</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Un modèle désactivé disparaît des choix offerts aux comptes.
                </p>
              </div>
              <Toggle
                checked={modelDraft.isEnabled}
                onChange={() => setModelDraft({ ...modelDraft, isEnabled: !modelDraft.isEnabled })}
                label="Activer le modèle"
              />
            </div>

            <p className="flex items-start gap-2 text-xs text-gray-500">
              <KeyRound size={14} className="mt-0.5 shrink-0 text-gray-400" />
              Aucune clé API ne se saisit ici — elles restent dans Variables &amp; Secrets.
            </p>

            <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModelForm}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ============================= MODALE VOIX ============================= */}
      {voiceDraft && (
        <Modal
          title={editingVoice ? 'Modifier la voix' : 'Ajouter une voix'}
          subtitle="Prosodie : réglages numériques (SSML). Style : consigne écrite ou émotion nommée."
          onClose={closeVoiceForm}
        >
          <form onSubmit={submitVoice} className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Fournisseur *"
                helper={editingVoice ? 'Non modifiable après création.' : 'edge ou gemini'}
              >
                {editingVoice ? (
                  <input
                    type="text"
                    value={voiceDraft.provider}
                    disabled
                    className="input font-mono text-sm"
                  />
                ) : (
                  <select
                    value={voiceDraft.provider}
                    onChange={(e) =>
                      setVoiceDraft({
                        ...voiceDraft,
                        provider: e.target.value,
                        // Edge est le seul à accepter des réglages numériques réels.
                        supportsProsody: e.target.value === 'edge',
                      })
                    }
                    className="input"
                  >
                    <option value="edge">Edge (Microsoft)</option>
                    <option value="gemini">Gemini (Google)</option>
                  </select>
                )}
              </Field>
              <Field
                label="Identifiant de la voix *"
                helper={editingVoice ? 'Non modifiable après création.' : "Tel qu'attendu par le fournisseur."}
              >
                <input
                  type="text"
                  required
                  disabled={!!editingVoice}
                  value={voiceDraft.voiceId}
                  onChange={(e) => setVoiceDraft({ ...voiceDraft, voiceId: e.target.value })}
                  className="input font-mono text-sm"
                  placeholder="fr-FR-DeniseNeural"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Libellé">
                <input
                  type="text"
                  value={voiceDraft.label}
                  onChange={(e) => setVoiceDraft({ ...voiceDraft, label: e.target.value })}
                  className="input"
                  placeholder="Denise (France)"
                />
              </Field>
              <Field label="Langue">
                <input
                  type="text"
                  value={voiceDraft.locale}
                  onChange={(e) => setVoiceDraft({ ...voiceDraft, locale: e.target.value })}
                  className="input font-mono text-sm"
                  placeholder="fr-FR"
                />
              </Field>
              <Field label="Genre">
                <input
                  type="text"
                  value={voiceDraft.gender}
                  onChange={(e) => setVoiceDraft({ ...voiceDraft, gender: e.target.value })}
                  className="input"
                  placeholder="Female"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <CheckRow
                checked={voiceDraft.supportsProsody}
                onChange={(next) => setVoiceDraft({ ...voiceDraft, supportsProsody: next })}
                title="Prosodie"
                help="Vitesse, hauteur et volume numériques réels (SSML) — les voix Edge."
                icon={Gauge}
              />
              <CheckRow
                checked={voiceDraft.supportsStyle}
                onChange={(next) => setVoiceDraft({ ...voiceDraft, supportsStyle: next })}
                title="Style"
                help="Émotion nommée, ou consigne de livraison écrite — c'est ainsi qu'on dirige une voix Gemini."
                icon={Sparkles}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <Field label="Styles disponibles" helper="Séparés par des virgules. Laisser vide si aucun.">
                  <input
                    type="text"
                    value={voiceDraft.styles}
                    onChange={(e) => setVoiceDraft({ ...voiceDraft, styles: e.target.value })}
                    className="input"
                    placeholder="cheerful, calm, empathetic"
                  />
                </Field>
              </div>
              <Field label="Ordre d'affichage">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={voiceDraft.sortOrder}
                  onChange={(e) => setVoiceDraft({ ...voiceDraft, sortOrder: e.target.value })}
                  className="input tabular-nums"
                />
              </Field>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 p-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Activée</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Une voix désactivée n'apparaît plus dans le studio des comptes.
                </p>
              </div>
              <Toggle
                checked={voiceDraft.isEnabled}
                onChange={() => setVoiceDraft({ ...voiceDraft, isEnabled: !voiceDraft.isEnabled })}
                label="Activer la voix"
              />
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeVoiceForm}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================= CONFIRMATION SUPPRESSION ========================= */}
      {deletingModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={() => setDeletingModel(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-black text-gray-900">
                  Supprimer « {deletingModel.label} » ?
                </h3>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                  Les comptes qui ont explicitement choisi ce modèle en seront détachés et
                  repartiront sur le modèle par défaut du rôle{' '}
                  <span className="font-semibold text-gray-700">
                    {ROLE_META[deletingModel.role]?.label ?? deletingModel.role}
                  </span>
                  . Leur agent continue de répondre, mais avec un autre modèle. Le nombre exact de
                  comptes détachés sera affiché après la suppression.
                </p>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => setDeletingModel(null)}
                disabled={deletingBusy}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={confirmDeleteModel}
                disabled={deletingBusy}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                {deletingBusy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

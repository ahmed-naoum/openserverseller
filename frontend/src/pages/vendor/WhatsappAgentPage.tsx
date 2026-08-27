import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  AudioLines,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  ListChecks,
  LogOut,
  Minus,
  Package,
  Play,
  Plus,
  PlugZap,
  Loader2,
  MessageSquare,
  PowerOff,
  QrCode,
  RefreshCw,
  Repeat,
  Save,
  Send,
  Settings,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import {
  formatWaMoney,
  waAgentApi,
  type AgentConfig,
  type AgentProduct,
  type AgentStatus,
  type AiModel,
  type AiVoice,
  type KnowledgeBase,
  type ProductProfile,
  type SandboxState,
  type SandboxTurn,
  type SessionStatus,
  type VoicePreset,
} from '../../lib/waAgentApi';
import { getFileUrl } from '../../lib/api';
import ConfirmationModal from '../../components/ui/ConfirmationModal';

/**
 * The account's agent studio.
 *
 * One component serves both dashboards — a vendor reaches it at
 * `/dashboard/whatsapp-agent` and an influencer at `/influencer/whatsapp-agent`
 * — so nothing here builds a URL or reads a role. Everything it needs comes
 * from `waAgentApi`, which is scoped to the signed-in account server-side.
 */

/* ------------------------------------------------------------------ */
/* plumbing                                                            */
/* ------------------------------------------------------------------ */

/** Every endpoint answers `{ status: 'success', data }`. */
function unwrap<T>(res: unknown): T {
  return (res as { data?: { data?: T } })?.data?.data as T;
}

function errMsg(e: unknown, fallback: string): string {
  const data = (e as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
  return data?.message || data?.error || fallback;
}

const EMPTY_KB: KnowledgeBase = {
  business: {
    name: '',
    what_we_sell: '',
    languages: '',
    country: '',
    currency: '',
    delivery: '',
    payment: '',
    returns: '',
    hours: '',
    website: '',
  },
  playbook: '',
  offers: [],
  faq: [],
  objections: [],
  examples: [],
  tone: { persona: '', style: '', emoji: 'parfois', rules: [] },
  goal: { objective: '', required_fields: [], confirmation_script: '' },
};

/** The server may answer a half-filled KB (or none at all) — never crash on it. */
function normalizeKb(raw: Partial<KnowledgeBase> | null | undefined): KnowledgeBase {
  return {
    business: { ...EMPTY_KB.business, ...(raw?.business || {}) },
    playbook: raw?.playbook || '',
    offers: Array.isArray(raw?.offers) ? raw.offers : [],
    faq: Array.isArray(raw?.faq) ? raw.faq : [],
    objections: Array.isArray(raw?.objections) ? raw.objections : [],
    examples: Array.isArray(raw?.examples) ? raw.examples : [],
    tone: { ...EMPTY_KB.tone, ...(raw?.tone || {}), rules: Array.isArray(raw?.tone?.rules) ? raw.tone.rules : [] },
    goal: {
      ...EMPTY_KB.goal,
      ...(raw?.goal || {}),
      required_fields: Array.isArray(raw?.goal?.required_fields) ? raw.goal.required_fields : [],
    },
  };
}

type BadgeTone = 'success' | 'warning' | 'danger' | 'gray' | 'orange';

const SESSION_META: Record<SessionStatus, { label: string; tone: BadgeTone; hint: string }> = {
  DISCONNECTED: {
    label: 'Déconnecté',
    tone: 'gray',
    hint: "L'agent ne reçoit aucun message. Lancez la connexion pour lier un téléphone.",
  },
  QR: {
    label: 'En attente du scan',
    tone: 'warning',
    hint: 'Scannez le QR code ci-dessous depuis WhatsApp sur le téléphone concerné.',
  },
  CONNECTING: {
    label: 'Connexion en cours',
    tone: 'warning',
    hint: 'La liaison est en train de s’établir, cela prend quelques secondes.',
  },
  CONNECTED: {
    label: 'Connecté',
    tone: 'success',
    hint: 'WhatsApp est lié. L’agent peut recevoir et envoyer des messages.',
  },
  LOGGED_OUT: {
    label: 'Session fermée',
    tone: 'orange',
    hint: 'La session a été fermée depuis le téléphone. Un nouveau QR code est nécessaire.',
  },
  BANNED: {
    label: 'Numéro bloqué par WhatsApp',
    tone: 'danger',
    hint: 'WhatsApp a restreint ce numéro. Utilisez un autre numéro professionnel.',
  },
};

const TONE_CLASS: Record<BadgeTone, string> = {
  success: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  warning: 'bg-amber-50 text-amber-600 border-amber-100',
  danger: 'bg-rose-50 text-rose-600 border-rose-100',
  gray: 'bg-slate-50 text-slate-500 border-slate-100',
  orange: 'bg-orange-50 text-orange-600 border-orange-100',
};

const TABS = [
  { key: 'connexion', label: 'Connexion', icon: Smartphone },
  { key: 'connaissances', label: 'Connaissances', icon: BookOpen },
  { key: 'produits', label: 'Produits', icon: Package },
  { key: 'voix', label: 'Voix', icon: AudioLines },
  { key: 'banc', label: "Banc d'essai", icon: MessageSquare },
  { key: 'reglages', label: 'Réglages', icon: Settings },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const REQUIRED_FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: 'full_name', label: 'Nom complet' },
  { value: 'phone', label: 'Téléphone' },
  { value: 'city', label: 'Ville' },
  { value: 'address', label: 'Adresse' },
  { value: 'product', label: 'Produit' },
  { value: 'variant', label: 'Variante' },
  { value: 'quantity', label: 'Quantité' },
  { value: 'price', label: 'Prix' },
];

const EMOJI_OPTIONS = [
  { value: 'jamais', label: 'Jamais' },
  { value: 'parfois', label: 'Parfois (recommandé)' },
  { value: 'souvent', label: 'Souvent' },
];

const EFFORT_OPTIONS = [
  { value: 'low', label: 'Rapide — réponses courtes, coût minimal' },
  { value: 'medium', label: 'Équilibré — recommandé' },
  { value: 'high', label: 'Approfondi — plus lent et plus cher' },
];

const TTS_MODE_OPTIONS = [
  { value: 'never', label: 'Jamais — toujours par écrit' },
  { value: 'mirror', label: 'Miroir — vocal si le client envoie un vocal' },
  { value: 'always', label: 'Toujours — chaque réponse est aussi vocale' },
];

const TTS_VERIFY_OPTIONS = [
  { value: 'never', label: 'Jamais' },
  { value: 'live_only', label: 'Modèles Live uniquement (recommandé)' },
  { value: 'always', label: 'Toujours' },
];

/** Le pourquoi change complètement d’une valeur à l’autre : on l’affiche sous le choix retenu. */
const TTS_VERIFY_HELP: Record<string, string> = {
  never: 'Ce qui sort du moteur part tel quel au client, sans aucun contrôle.',
  live_only:
    'Retranscrit l’audio produit et vérifie qu’il dit bien la réponse. Coûte un appel de plus, mais empêche d’envoyer une note vocale où le modèle répond au texte au lieu de le lire.',
  always:
    'Chaque prise est retranscrite et comparée au texte, y compris sur les moteurs qui se contentent de lire. Le plus sûr, et le plus coûteux.',
};

const TTS_FAILURE_OPTIONS = [
  { value: 'text_only', label: 'Envoyer seulement le texte (recommandé)' },
  { value: 'fallback_edge', label: 'Basculer sur la voix Edge marocaine' },
];

const TTS_FAILURE_HELP: Record<string, string> = {
  text_only:
    'Aucune note vocale. Changer de voix en cours de conversation est pire que ne pas en envoyer : le client entendait une personne et en entend soudain une autre.',
  fallback_edge:
    'Une voix marocaine toujours disponible, mais audiblement différente de la voix habituelle de votre agent.',
};

/** Les moteurs Live parlent au lieu de lire — le backend les reconnaît de la même façon. */
const LIVE_MODEL_RE = /live|native-audio/i;

const PREREQUISITES: { key: keyof NonNullable<AgentStatus['prerequisites']>; label: string; hint: string }[] = [
  { key: 'brainModel', label: 'Modèle configuré', hint: 'Onglet Réglages — choisissez le cerveau de l’agent.' },
  { key: 'whatsappConnected', label: 'WhatsApp connecté', hint: 'Onglet Connexion — scannez le QR code.' },
  { key: 'hasProducts', label: 'Au moins un produit', hint: 'Onglet Produits — activez un produit de votre catalogue.' },
  { key: 'hasCredits', label: 'Crédits disponibles', hint: 'Contactez la plateforme pour recharger vos crédits IA.' },
];

/** Keeps an unexpected stored value selectable instead of silently rewriting it. */
function optionsWith(options: { value: string; label: string }[], current: string | null | undefined) {
  if (!current || options.some((o) => o.value === current)) return options;
  return [{ value: current, label: current }, ...options];
}

const INPUT_CLS =
  'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-900 text-start placeholder:text-gray-300 transition-all focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/10 disabled:opacity-50';

/* ------------------------------------------------------------------ */
/* small building blocks                                               */
/* ------------------------------------------------------------------ */

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="w-full">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-[11px] font-medium leading-relaxed text-gray-400">{hint}</span> : null}
    </div>
  );
}

function TextField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type={type}
        className={INPUT_CLS}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

function AreaField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <Field label={label} hint={hint}>
      <textarea
        rows={rows}
        className={clsx(INPUT_CLS, 'leading-relaxed')}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

function NumberField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="number"
        className={clsx(INPUT_CLS, 'tabular-nums')}
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      />
    </Field>
  );
}

function SelectField({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Field label={label} hint={hint}>
      <select className={INPUT_CLS} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  display,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  display?: string;
  hint?: string;
}) {
  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</span>
        <span className="text-[11px] font-black tabular-nums text-gray-700">{display ?? value}</span>
      </div>
      <input
        type="range"
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-primary-500"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint ? <span className="mt-1.5 block text-[11px] font-medium leading-relaxed text-gray-400">{hint}</span> : null}
    </div>
  );
}

function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200',
        checked ? 'bg-emerald-500' : 'bg-gray-200',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <span
        className={clsx(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200',
          checked ? 'start-[22px]' : 'start-0.5'
        )}
      />
    </button>
  );
}

function SwitchRow({
  label,
  description,
  checked,
  onChange,
  disabled,
  danger,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={clsx(
        'flex items-start justify-between gap-4 rounded-2xl border p-4',
        danger ? 'border-amber-100 bg-amber-50/40' : 'border-gray-100 bg-gray-50/50'
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-black text-gray-900">{label}</p>
        {description ? (
          <p className="mt-1 text-[11px] font-medium leading-relaxed text-gray-500">{description}</p>
        ) : null}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function SectionCard({
  title,
  description,
  icon,
  children,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-gray-50 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? <div className="mt-0.5 flex-shrink-0 text-primary-500">{icon}</div> : null}
          <div className="min-w-0">
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-900">{title}</h2>
            {description ? (
              <p className="mt-1 text-[11px] font-medium leading-relaxed text-gray-500">{description}</p>
            ) : null}
          </div>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

interface RepeatableProps<T> {
  items: T[];
  onChange: (next: T[]) => void;
  blank: () => T;
  addLabel: string;
  emptyLabel: string;
  children: (item: T, update: (patch: Partial<T>) => void, index: number) => ReactNode;
}

function Repeatable<T>({ items, onChange, blank, addLabel, emptyLabel, children }: RepeatableProps<T>) {
  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-5 text-center text-[11px] font-bold text-gray-400">
          {emptyLabel}
        </p>
      ) : null}

      {items.map((item, index) => (
        <div key={index} className="relative rounded-2xl border border-gray-100 bg-gray-50/50 p-4 pe-12">
          {children(
            item,
            (patch) => onChange(items.map((it, j) => (j === index ? ({ ...it, ...patch } as T) : it))),
            index
          )}
          <button
            type="button"
            title="Supprimer"
            onClick={() => onChange(items.filter((_, j) => j !== index))}
            className="absolute end-3 top-3 rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...items, blank()])}
        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-gray-500 transition-all hover:border-primary-200 hover:bg-primary-50 hover:text-primary-600"
      >
        <Plus className="h-3.5 w-3.5" /> {addLabel}
      </button>
    </div>
  );
}

function StringList({
  items,
  onChange,
  placeholder,
  addLabel,
  emptyLabel,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  addLabel: string;
  emptyLabel: string;
}) {
  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-4 text-center text-[11px] font-bold text-gray-400">
          {emptyLabel}
        </p>
      ) : null}

      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            className={INPUT_CLS}
            value={item}
            placeholder={placeholder}
            onChange={(e) => onChange(items.map((it, j) => (j === index ? e.target.value : it)))}
          />
          <button
            type="button"
            title="Supprimer"
            onClick={() => onChange(items.filter((_, j) => j !== index))}
            className="flex-shrink-0 rounded-lg p-2 text-gray-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...items, ''])}
        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-gray-500 transition-all hover:border-primary-200 hover:bg-primary-50 hover:text-primary-600"
      >
        <Plus className="h-3.5 w-3.5" /> {addLabel}
      </button>
    </div>
  );
}

function SaveBar({ onSave, saving, label = 'Enregistrer' }: { onSave: () => void; saving: boolean; label?: string }) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-sm transition-all hover:bg-primary-700 disabled:opacity-50"
      >
        {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        {label}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* local drafts                                                        */
/* ------------------------------------------------------------------ */

interface ProductDraft {
  enabled: boolean;
  agentPriceMad: string;
  oldPriceMad: string;
  sellingCopy: string;
  benefits: string;
  variants: string;
  stockNote: string;
  objections: { objection: string; response: string }[];
  mediaUrls: string;
  notes: string;
}

function productDraftFrom(profile: ProductProfile | null): ProductDraft {
  return {
    enabled: profile?.enabled ?? false,
    agentPriceMad: profile?.agentPriceMad == null ? '' : String(profile.agentPriceMad),
    oldPriceMad: profile?.oldPriceMad == null ? '' : String(profile.oldPriceMad),
    sellingCopy: profile?.sellingCopy || '',
    benefits: profile?.benefits || '',
    variants: profile?.variants || '',
    stockNote: profile?.stockNote || '',
    objections: Array.isArray(profile?.objections) ? profile.objections : [],
    mediaUrls: Array.isArray(profile?.mediaUrls) ? profile.mediaUrls.join('\n') : '',
    notes: profile?.notes || '',
  };
}

interface VoiceDraft {
  id: number | null;
  name: string;
  voiceRef: number | null;
  provider: string;
  voiceId: string;
  rate: number;
  pitch: number;
  volume: number;
  style: string;
  styleDegree: number;
  stylePrompt: string;
  isSystem: boolean;
}

function voiceDraftFrom(preset: VoicePreset | null): VoiceDraft {
  return {
    id: preset?.id ?? null,
    name: preset?.name || '',
    voiceRef: preset?.voiceRef ?? null,
    provider: preset?.provider || '',
    voiceId: preset?.voiceId || '',
    rate: preset?.rate ?? 0,
    pitch: preset?.pitch ?? 0,
    volume: preset?.volume ?? 0,
    style: preset?.style || '',
    styleDegree: preset?.styleDegree ?? 1,
    stylePrompt: preset?.stylePrompt || '',
    isSystem: preset?.isSystem ?? false,
  };
}

/**
 * Ce que l'aperçu vocal rapporte en plus de l'URL : le moteur qui a réellement
 * parlé. Un compte qui entend un extrait produit par le troisième maillon a
 * appris quelque chose d'utile sur son réglage — le cacher lui ferait valider
 * une voix qu'il n'entendra presque jamais.
 */
interface PreviewInfo {
  provider: string;
  model: string | null;
  fellBackFrom: string | null;
  retried: number;
  attempts: string[];
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function WhatsappAgentPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('connexion');
  const [busy, setBusy] = useState<string | null>(null);

  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [draft, setDraft] = useState<AgentConfig | null>(null);
  const [kb, setKb] = useState<KnowledgeBase>(EMPTY_KB);
  const [products, setProducts] = useState<AgentProduct[]>([]);
  const [voices, setVoices] = useState<{ catalogue: AiVoice[]; presets: VoicePreset[] }>({
    catalogue: [],
    presets: [],
  });
  const [models, setModels] = useState<{ brain: AiModel[]; stt: AiModel[]; tts: AiModel[] }>({
    brain: [],
    stt: [],
    tts: [],
  });

  // Connexion
  const [qr, setQr] = useState<string | null>(null);
  const [qrGaveUp, setQrGaveUp] = useState(false);
  const [pollNonce, setPollNonce] = useState(0);

  // Connaissances
  const [promptOpen, setPromptOpen] = useState(false);
  const [compiledPrompt, setCompiledPrompt] = useState<string | null>(null);

  // Produits
  const [editingProduct, setEditingProduct] = useState<number | null>(null);
  const [productDraft, setProductDraft] = useState<ProductDraft>(productDraftFrom(null));

  // Voix
  const [voiceDraft, setVoiceDraft] = useState<VoiceDraft | null>(null);
  const [sampleText, setSampleText] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewInfo, setPreviewInfo] = useState<PreviewInfo | null>(null);

  // Confirmations
  const [confirmBox, setConfirmBox] = useState<{ title: string; message: string; run: () => void } | null>(null);

  /* ---------------------------------------------------------------- */
  /* loading                                                           */
  /* ---------------------------------------------------------------- */

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const s = unwrap<AgentStatus>(await waAgentApi.status());
      setStatus(s || { enabled: false });
      if (!s?.enabled) return;

      const [cfg, prod, vox, mdl] = await Promise.all([
        waAgentApi
          .getConfig()
          .then((r) => unwrap<AgentConfig | null>(r))
          .catch(() => null),
        waAgentApi
          .products()
          .then((r) => unwrap<AgentProduct[] | null>(r))
          .catch(() => null),
        waAgentApi
          .voices()
          .then((r) => unwrap<{ catalogue: AiVoice[]; presets: VoicePreset[] } | null>(r))
          .catch(() => null),
        waAgentApi
          .models()
          .then((r) => unwrap<{ brain: AiModel[]; stt: AiModel[]; tts: AiModel[] } | null>(r))
          .catch(() => null),
      ]);

      if (cfg) {
        setConfig(cfg);
        setDraft(cfg);
        setKb(normalizeKb(cfg.kb));
      }
      if (Array.isArray(prod)) setProducts(prod);
      if (vox) {
        setVoices({
          catalogue: Array.isArray(vox.catalogue) ? vox.catalogue : [],
          presets: Array.isArray(vox.presets) ? vox.presets : [],
        });
      }
      if (mdl) {
        setModels({
          brain: Array.isArray(mdl.brain) ? mdl.brain : [],
          stt: Array.isArray(mdl.stt) ? mdl.stt : [],
          tts: Array.isArray(mdl.tts) ? mdl.tts : [],
        });
      }
    } catch (e) {
      setLoadError(errMsg(e, "Impossible de charger l'agent pour le moment."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const refreshStatus = useCallback(async () => {
    try {
      const s = unwrap<AgentStatus>(await waAgentApi.status());
      if (s) setStatus(s);
    } catch {
      /* transient — keep the last known state on screen */
    }
  }, []);

  const refreshProducts = useCallback(async () => {
    try {
      const prod = unwrap<AgentProduct[]>(await waAgentApi.products());
      if (Array.isArray(prod)) setProducts(prod);
    } catch {
      /* the row keeps its optimistic value until the next full load */
    }
  }, []);

  const refreshVoices = useCallback(async () => {
    try {
      const vox = unwrap<{ catalogue: AiVoice[]; presets: VoicePreset[] }>(await waAgentApi.voices());
      if (vox) {
        setVoices({
          catalogue: Array.isArray(vox.catalogue) ? vox.catalogue : [],
          presets: Array.isArray(vox.presets) ? vox.presets : [],
        });
      }
    } catch {
      /* keep what is on screen */
    }
  }, []);

  const session = status?.session;
  const sessionStatus: SessionStatus = session?.status || 'DISCONNECTED';
  const sessionMeta = SESSION_META[sessionStatus] || SESSION_META.DISCONNECTED;
  const credits = status?.credits;
  const agentEnabled = draft?.enabled ?? config?.enabled ?? status?.agentEnabled ?? false;

  /* ---------------------------------------------------------------- */
  /* QR polling                                                        */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (tab !== 'connexion') return;
    if (sessionStatus !== 'QR' && sessionStatus !== 'CONNECTING') {
      setQr(null);
      return;
    }

    let cancelled = false;
    let timer: number | null = null;
    const startedAt = Date.now();
    setQrGaveUp(false);

    const stop = () => {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };

    const tick = async () => {
      if (cancelled) return;
      // The QR rotates every ~20s and a screen left open forever keeps a poll
      // running for nothing — give up after about two minutes.
      if (Date.now() - startedAt > 120_000) {
        stop();
        if (!cancelled) setQrGaveUp(true);
        return;
      }
      try {
        const d = unwrap<{ qr: string | null }>(await waAgentApi.qr());
        if (!cancelled) setQr(d?.qr ?? null);
      } catch {
        /* transient */
      }
      try {
        const s = unwrap<AgentStatus>(await waAgentApi.status());
        if (!cancelled && s) setStatus(s);
      } catch {
        /* transient */
      }
    };

    timer = window.setInterval(() => void tick(), 3000);
    void tick();

    return () => {
      cancelled = true;
      stop();
    };
  }, [tab, sessionStatus, pollNonce]);

  /* ---------------------------------------------------------------- */
  /* actions                                                           */
  /* ---------------------------------------------------------------- */

  const saveConfig = useCallback(
    async (patch: Partial<AgentConfig>, key: string, message = 'Réglages enregistrés.') => {
      setBusy(key);
      try {
        const returned = unwrap<AgentConfig | null>(await waAgentApi.updateConfig(patch));
        const base = config || draft;
        const next: AgentConfig | null =
          returned && typeof returned.id === 'number' ? returned : base ? { ...base, ...patch } : null;
        if (next) {
          setConfig(next);
          setDraft(next);
        }
        toast.success(message);
        void refreshStatus();
        return true;
      } catch (e) {
        toast.error(errMsg(e, "L'enregistrement a échoué."));
        return false;
      } finally {
        setBusy(null);
      }
    },
    [config, draft, refreshStatus]
  );

  const patchDraft = (patch: Partial<AgentConfig>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const handleConnect = async () => {
    setBusy('connect');
    try {
      await waAgentApi.connect();
      setQrGaveUp(false);
      setPollNonce((n) => n + 1);
      toast.success('Connexion lancée. Le QR code va apparaître.');
      await refreshStatus();
    } catch (e) {
      toast.error(errMsg(e, 'Impossible de lancer la connexion.'));
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnect = async () => {
    setBusy('disconnect');
    try {
      await waAgentApi.disconnect();
      setQr(null);
      toast.success('Agent déconnecté. La session reste liée à votre numéro.');
      await refreshStatus();
    } catch (e) {
      toast.error(errMsg(e, 'La déconnexion a échoué.'));
    } finally {
      setBusy(null);
    }
  };

  const handleLogout = () => {
    setConfirmBox({
      title: 'Délier WhatsApp de cet agent ?',
      message:
        'La session sera entièrement supprimée du serveur. Pour remettre l’agent en service, il faudra rescanner un nouveau QR code depuis le téléphone. Les conversations déjà enregistrées ne sont pas effacées.',
      run: async () => {
        setBusy('logout');
        try {
          await waAgentApi.logout();
          setQr(null);
          toast.success('WhatsApp a été délié.');
          await refreshStatus();
        } catch (e) {
          toast.error(errMsg(e, 'Impossible de délier WhatsApp.'));
        } finally {
          setBusy(null);
        }
      },
    });
  };

  const handleSaveKb = async () => {
    setBusy('kb');
    try {
      await waAgentApi.saveKb(kb);
      toast.success('Base de connaissances enregistrée.');
      if (config) setConfig({ ...config, kb });
    } catch (e) {
      toast.error(errMsg(e, "L'enregistrement de la base de connaissances a échoué."));
    } finally {
      setBusy(null);
    }
  };

  const handleShowPrompt = async () => {
    setBusy('prompt');
    setCompiledPrompt(null);
    setPromptOpen(true);
    try {
      const d = unwrap<{ compiledPrompt: string }>(await waAgentApi.getPrompt());
      setCompiledPrompt(d?.compiledPrompt || '');
    } catch (e) {
      setPromptOpen(false);
      toast.error(errMsg(e, 'Impossible de générer le prompt.'));
    } finally {
      setBusy(null);
    }
  };

  const openProductEditor = (product: AgentProduct) => {
    setEditingProduct(product.id);
    setProductDraft(productDraftFrom(product.profile));
  };

  const handleToggleProduct = async (product: AgentProduct, next: boolean) => {
    setBusy(`product-toggle-${product.id}`);
    try {
      await waAgentApi.saveProduct(product.id, { enabled: next });
      toast.success(next ? 'Produit activé pour l’agent.' : 'Produit désactivé.');
      await refreshProducts();
      void refreshStatus();
    } catch (e) {
      toast.error(errMsg(e, 'La mise à jour du produit a échoué.'));
    } finally {
      setBusy(null);
    }
  };

  const handleSaveProduct = async (product: AgentProduct) => {
    const price = productDraft.agentPriceMad.trim();
    const oldPrice = productDraft.oldPriceMad.trim();
    if (price !== '' && !Number.isFinite(Number(price))) {
      toast.error('Le prix agent doit être un nombre.');
      return;
    }
    if (oldPrice !== '' && !Number.isFinite(Number(oldPrice))) {
      toast.error('Le prix barré doit être un nombre.');
      return;
    }

    setBusy(`product-save-${product.id}`);
    try {
      await waAgentApi.saveProduct(product.id, {
        enabled: productDraft.enabled,
        agentPriceMad: price === '' ? null : Number(price),
        oldPriceMad: oldPrice === '' ? null : Number(oldPrice),
        sellingCopy: productDraft.sellingCopy.trim() || null,
        benefits: productDraft.benefits.trim() || null,
        variants: productDraft.variants.trim() || null,
        stockNote: productDraft.stockNote.trim() || null,
        objections: productDraft.objections.filter((o) => o.objection.trim() || o.response.trim()),
        mediaUrls: productDraft.mediaUrls
          .split('\n')
          .map((u) => u.trim())
          .filter(Boolean),
        notes: productDraft.notes.trim() || null,
      });
      toast.success('Fiche produit enregistrée.');
      setEditingProduct(null);
      await refreshProducts();
      void refreshStatus();
    } catch (e) {
      toast.error(errMsg(e, "L'enregistrement de la fiche produit a échoué."));
    } finally {
      setBusy(null);
    }
  };

  const handleRemoveProduct = (product: AgentProduct) => {
    setConfirmBox({
      title: 'Retirer ce produit de l’agent ?',
      message: `« ${product.nameFr} » ne sera plus proposé par l’agent et sa fiche de vente sera supprimée. Le produit reste dans votre catalogue.`,
      run: async () => {
        setBusy(`product-remove-${product.id}`);
        try {
          await waAgentApi.removeProduct(product.id);
          toast.success('Produit retiré de l’agent.');
          if (editingProduct === product.id) setEditingProduct(null);
          await refreshProducts();
          void refreshStatus();
        } catch (e) {
          toast.error(errMsg(e, 'Impossible de retirer ce produit.'));
        } finally {
          setBusy(null);
        }
      },
    });
  };

  const selectedCatalogueVoice = useMemo<AiVoice | null>(() => {
    if (!voiceDraft) return null;
    return (
      voices.catalogue.find((v) => v.id === voiceDraft.voiceRef) ||
      voices.catalogue.find((v) => v.provider === voiceDraft.provider && v.voiceId === voiceDraft.voiceId) ||
      null
    );
  }, [voiceDraft, voices.catalogue]);

  const voicesByProvider = useMemo(() => {
    const map = new Map<string, AiVoice[]>();
    voices.catalogue.forEach((v) => {
      const list = map.get(v.provider) || [];
      list.push(v);
      map.set(v.provider, list);
    });
    return Array.from(map.entries());
  }, [voices.catalogue]);

  const voicePayload = (d: VoiceDraft, voice: AiVoice | null): Partial<VoicePreset> => {
    const namedStyles = !!voice?.supportsStyle && (voice?.styles?.length || 0) > 0;
    const freeStyle = !!voice?.supportsStyle && (voice?.styles?.length || 0) === 0;
    return {
      name: d.name.trim(),
      voiceRef: d.voiceRef,
      provider: voice?.provider || d.provider,
      voiceId: voice?.voiceId || d.voiceId,
      rate: voice?.supportsProsody ? d.rate : 0,
      pitch: voice?.supportsProsody ? d.pitch : 0,
      volume: voice?.supportsProsody ? d.volume : 0,
      style: namedStyles ? d.style || null : null,
      styleDegree: namedStyles ? d.styleDegree : null,
      stylePrompt: freeStyle ? d.stylePrompt.trim() || null : null,
    };
  };

  const handleSaveVoice = async () => {
    if (!voiceDraft) return;
    if (!voiceDraft.name.trim()) {
      toast.error('Donnez un nom à ce profil de voix.');
      return;
    }
    if (!selectedCatalogueVoice && !voiceDraft.voiceId) {
      toast.error('Choisissez une voix dans le catalogue.');
      return;
    }

    setBusy('voice-save');
    try {
      const payload = voicePayload(voiceDraft, selectedCatalogueVoice);
      if (voiceDraft.id) {
        await waAgentApi.updateVoice(voiceDraft.id, payload);
      } else {
        await waAgentApi.createVoice(payload);
      }
      toast.success('Profil de voix enregistré.');
      setVoiceDraft(null);
      await refreshVoices();
    } catch (e) {
      toast.error(errMsg(e, "L'enregistrement de la voix a échoué."));
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteVoice = (preset: VoicePreset) => {
    setConfirmBox({
      title: 'Supprimer ce profil de voix ?',
      message: `« ${preset.name} » sera définitivement supprimé. Si c’est la voix active de l’agent, pensez à en choisir une autre.`,
      run: async () => {
        setBusy(`voice-delete-${preset.id}`);
        try {
          await waAgentApi.deleteVoice(preset.id);
          toast.success('Profil de voix supprimé.');
          if (voiceDraft?.id === preset.id) setVoiceDraft(null);
          await refreshVoices();
        } catch (e) {
          toast.error(errMsg(e, 'Impossible de supprimer ce profil.'));
        } finally {
          setBusy(null);
        }
      },
    });
  };

  const handlePreviewVoice = async (payload: Partial<VoicePreset>, key: string) => {
    setBusy(key);
    setPreviewUrl(null);
    setPreviewInfo(null);
    try {
      const d = unwrap<{
        url: string;
        provider?: string;
        model?: string | null;
        fellBackFrom?: string | null;
        retried?: number;
        attempts?: string[];
      }>(await waAgentApi.previewVoice({ ...payload, text: sampleText.trim() || undefined }));
      const url = d?.url || '';
      if (!url) {
        toast.error('Aucun extrait audio reçu.');
        return;
      }
      setPreviewUrl(url.startsWith('data:') ? url : getFileUrl(url));
      // Quel moteur a réellement parlé — la chaîne de repli rend la réponse
      // beaucoup moins prévisible que « le moteur que j'ai choisi ».
      setPreviewInfo({
        provider: d?.provider || '',
        model: d?.model ?? null,
        fellBackFrom: d?.fellBackFrom ?? null,
        retried: Number(d?.retried) || 0,
        attempts: Array.isArray(d?.attempts) ? d.attempts : [],
      });
    } catch (e) {
      toast.error(errMsg(e, "L'aperçu vocal a échoué."));
    } finally {
      setBusy(null);
    }
  };

  const handleUseVoice = async (preset: VoicePreset) => {
    await saveConfig({ activeVoiceId: preset.id }, `voice-use-${preset.id}`, `« ${preset.name} » est maintenant la voix de l’agent.`);
  };

  /* ---------------------------------------------------------------- */
  /* chaîne de repli vocale                                            */
  /* ---------------------------------------------------------------- */

  /** Les maillons voyagent en « provider:modelId » — c'est aussi la clé de recherche. */
  const ttsModelByKey = useMemo(() => {
    const map = new Map<string, AiModel>();
    models.tts.forEach((m) => map.set(`${m.provider}:${m.modelId}`, m));
    return map;
  }, [models.tts]);

  const ttsChain = draft?.ttsChain ?? [];

  /**
   * Le serveur refuse TOUT l'enregistrement (400) si un maillon désigne un
   * modèle vocal désactivé — on ne propose donc jamais autre chose que la liste
   * des modèles TTS activés.
   */
  const chainCandidates = useMemo(
    () => models.tts.filter((m) => m.isEnabled !== false && !ttsChain.includes(`${m.provider}:${m.modelId}`)),
    [models.tts, ttsChain]
  );

  const setTtsChain = (next: string[]) => patchDraft({ ttsChain: next });

  const moveChainLink = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= ttsChain.length) return;
    const next = [...ttsChain];
    [next[index], next[target]] = [next[target], next[index]];
    setTtsChain(next);
  };

  const handleSaveTtsChain = async () => {
    if (!draft) return;
    await saveConfig(
      {
        ttsChain: draft.ttsChain,
        ttsRetries: Math.min(5, Math.max(0, Math.round(draft.ttsRetries || 0))),
        ttsVerify: draft.ttsVerify,
        ttsOnFailure: draft.ttsOnFailure,
        // Le champ est en secondes à l'écran, la config est en millisecondes.
        ttsTimeoutMs: Math.min(180_000, Math.max(10_000, Math.round(draft.ttsTimeoutMs || 0))),
      },
      'tts-chain',
      'Chaîne de repli enregistrée.'
    );
  };

  /** Le moteur que le compte a choisi dans Réglages — la référence de l'aperçu. */
  const selectedTtsModel = useMemo<AiModel | null>(
    () => models.tts.find((m) => m.id === draft?.ttsModelId) || models.tts.find((m) => m.isDefault) || null,
    [models.tts, draft?.ttsModelId]
  );

  /**
   * Les deux moteurs vocaux, en lecture seule.
   *
   * Le compte ne les choisit plus — la plateforme les impose — mais l'onglet
   * Réglages continue de dire lequel travaille pour lui.
   */
  const sttModelLabel = useMemo(
    () => models.stt.find((m) => m.id === draft?.sttModelId)?.label ?? null,
    [models.stt, draft?.sttModelId]
  );

  const ttsModelLabel = useMemo(
    () => models.tts.find((m) => m.id === draft?.ttsModelId)?.label ?? null,
    [models.tts, draft?.ttsModelId]
  );

  const previewEngineLabel = useMemo(() => {
    if (!previewInfo) return '';
    const found = ttsModelByKey.get(`${previewInfo.provider}:${previewInfo.model || ''}`);
    if (found) return found.label;
    return previewInfo.model ? `${previewInfo.provider} · ${previewInfo.model}` : previewInfo.provider || 'un moteur inconnu';
  }, [previewInfo, ttsModelByKey]);

  const previewFellBack =
    !!previewInfo &&
    (!!previewInfo.fellBackFrom ||
      previewInfo.retried > 0 ||
      (!!selectedTtsModel &&
        (previewInfo.provider !== selectedTtsModel.provider || (previewInfo.model || '') !== selectedTtsModel.modelId)));

  const handleSaveSettings = async () => {
    if (!draft) return;
    await saveConfig(
      {
        displayName: draft.displayName,
        // Omitted entirely when the platform manages the brain. The API rejects
        // the field in that case, so sending it would fail every save on this
        // tab — including saves that never touched the model.
        ...(config?.brainLocked ? {} : { brainModelId: draft.brainModelId }),
        effort: draft.effort,
        maxOutputTokens: draft.maxOutputTokens,
        // historyMessages, sttModelId, ttsModelId, typingDelayMs, replyDelayMs
        // et handoffKeywords sont réglés par la plateforme, pas par le compte.
        // L'API les refuse ici : les envoyer ferait échouer TOUS les
        // enregistrements de cet onglet, y compris ceux qui n'y touchent pas.
        sttEnabled: draft.sttEnabled,
        sttPrompt: draft.sttPrompt,
        replyTo: draft.replyTo,
        adKeywords: draft.adKeywords,
        workingHoursEnabled: draft.workingHoursEnabled,
        workingHoursStart: draft.workingHoursStart,
        workingHoursEnd: draft.workingHoursEnd,
        afterHoursMessage: draft.afterHoursMessage,
        afterConfirmed: draft.afterConfirmed,
        maxRepliesPerContact: draft.maxRepliesPerContact,
        maxRepliesPerDay: draft.maxRepliesPerDay,
        minSecondsBetweenReplies: draft.minSecondsBetweenReplies,
        maxInputChars: draft.maxInputChars,
        readImages: draft.readImages,
        readVideos: draft.readVideos,
        videoFrames: draft.videoFrames,
        maxMediaMb: draft.maxMediaMb,
        maxMediaPerTurn: draft.maxMediaPerTurn,
        sendCatalogueMedia: draft.sendCatalogueMedia,
        autoCreateLead: draft.autoCreateLead,
      },
      'settings'
    );
  };

  /**
   * The brain actually in use — which is NOT always one of `models.brain`.
   *
   * A platform-managed model is deliberately absent from that list, so looking
   * it up there returns null and every capability-gated control (the effort
   * select) disappears as though the model supported nothing. The config
   * response carries the real row, so fall back to it.
   */
  const chosenBrain = useMemo<AiModel | null>(
    () =>
      models.brain.find((m) => m.id === draft?.brainModelId) ||
      (config?.brainLocked ? (config.brainModel as AiModel | null) ?? null : null),
    [models.brain, draft?.brainModelId, config?.brainLocked, config?.brainModel]
  );

  /* ---------------------------------------------------------------- */
  /* early states                                                      */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="py-24 text-center">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-primary-500" />
          <p className="mt-4 text-[11px] font-bold text-gray-400">Chargement de votre agent…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-lg rounded-3xl border border-gray-100 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
            <RefreshCw className="h-6 w-6" />
          </div>
          <h2 className="text-base font-black text-gray-900">Impossible d’afficher l’agent</h2>
          <p className="mx-auto mt-2 max-w-sm text-xs font-medium leading-relaxed text-gray-500">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadAll()}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-primary-700"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!status?.enabled) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-xl rounded-3xl border border-gray-100 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary-50 text-primary-500">
            <Bot className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-gray-900">Agent WhatsApp IA — non activé</h1>
          <p className="mx-auto mt-3 max-w-md text-xs font-medium leading-relaxed text-gray-500">
            Cette fonctionnalité n’est pas encore ouverte sur votre compte. L’agent répond automatiquement à vos
            clients sur WhatsApp, présente vos produits et collecte les commandes à votre place.
          </p>
          <p className="mx-auto mt-4 max-w-md text-xs font-bold leading-relaxed text-gray-600">
            Contactez l’équipe de la plateforme pour demander son activation.
          </p>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* render                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex-shrink-0 rounded-2xl bg-primary-50 p-3 text-primary-600">
            <Bot size={26} />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tight text-gray-900">Agent WhatsApp IA</h1>
            <p className="mt-1 text-xs font-medium text-gray-500">
              Votre vendeur automatique : il répond à vos clients sur WhatsApp, présente vos produits et collecte les
              commandes.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-stretch gap-3">
          {/* Solde de crédits — visible sur tous les onglets. */}
          <div className="min-w-[190px] rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <Wallet className="h-3 w-3" /> Crédits IA
            </p>
            <div className="mt-1 text-xl font-black tabular-nums text-gray-900">
              {formatWaMoney(credits?.balance ?? 0)}
            </div>
            <p className="mt-0.5 text-[10px] font-black uppercase tracking-widest tabular-nums text-emerald-600">
              ≈ {credits?.affordable ?? 0} réponses restantes
            </p>
          </div>

          {/* Interrupteur maître — jamais enterré dans un onglet. */}
          <div className="flex min-w-[190px] items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Agent</p>
              <p className={clsx('mt-1 text-sm font-black', agentEnabled ? 'text-emerald-600' : 'text-gray-400')}>
                {agentEnabled ? 'Actif' : 'En pause'}
              </p>
              <p className="mt-0.5 text-[10px] font-medium text-gray-400">
                {agentEnabled ? 'Il répond aux clients' : 'Aucune réponse envoyée'}
              </p>
            </div>
            <Switch
              checked={agentEnabled}
              disabled={busy === 'enabled'}
              onChange={(next) =>
                void saveConfig(
                  { enabled: next },
                  'enabled',
                  next ? 'Agent activé.' : 'Agent mis en pause.'
                )
              }
            />
          </div>
        </div>
      </div>

      {/* ── Onglets ───────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
        <div className="flex overflow-x-auto border-b border-gray-100">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={clsx(
                  'relative flex flex-shrink-0 items-center gap-2 px-5 py-4 text-xs font-black uppercase tracking-widest transition-colors',
                  active ? 'bg-primary-50/50 text-primary-600' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                )}
              >
                <Icon size={16} />
                {item.label}
                {active ? <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary-600" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TAB 1 — CONNEXION ─────────────────────────────────────── */}
      {tab === 'connexion' ? (
        <div className="space-y-6">
          <SectionCard
            title="Session WhatsApp"
            description="L’état de la liaison entre votre numéro WhatsApp et l’agent."
            icon={<Smartphone size={18} />}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <span
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest',
                    TONE_CLASS[sessionMeta.tone]
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {sessionMeta.label}
                </span>
                <p className="mt-2 text-sm font-black tabular-nums text-gray-900">
                  {session?.phoneNumber || 'Aucun numéro lié'}
                </p>
                {session?.pushName ? (
                  <p className="text-[11px] font-bold text-gray-400">{session.pushName}</p>
                ) : null}
                <p className="mt-1 text-[11px] font-medium leading-relaxed text-gray-500">{sessionMeta.hint}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleConnect()}
                  disabled={busy === 'connect' || sessionStatus === 'CONNECTED'}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-white transition-all hover:bg-primary-700 disabled:opacity-50"
                >
                  {busy === 'connect' ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <PlugZap className="h-3.5 w-3.5" />
                  )}
                  Connecter
                </button>
                <button
                  type="button"
                  onClick={() => void handleDisconnect()}
                  disabled={busy === 'disconnect' || sessionStatus === 'DISCONNECTED'}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-gray-500 transition-all hover:bg-gray-50 disabled:opacity-50"
                >
                  <PowerOff className="h-3.5 w-3.5" />
                  Déconnecter
                </button>
                {/*
                  Only offered when there is genuinely a number to unlink.
                  Unlinking wipes the pairing credentials AND the pending QR, so
                  showing it next to "Connecter" while nothing is linked invites
                  a click that destroys the code the seller is waiting for — and
                  leaves them staring at "Aucun numéro lié" with no way forward.
                */}
                {session?.phoneNumber || sessionStatus === 'CONNECTED' ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={busy === 'logout'}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-rose-600 transition-all hover:bg-rose-100 disabled:opacity-50"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Délier WhatsApp
                  </button>
                ) : null}
              </div>
            </div>

            {session?.lastError ? (
              <div className="mt-4 flex items-start gap-2 rounded-2xl border border-rose-100 bg-rose-50/50 p-3">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-rose-500" />
                <p className="text-[11px] font-bold leading-relaxed text-rose-600">{session.lastError}</p>
              </div>
            ) : null}
          </SectionCard>

          {/* Avertissement — délibérément au-dessus du QR, jamais replié. */}
          <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-5">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-amber-700">
                  À lire avant de connecter un numéro
                </h3>
                <ul className="mt-2 space-y-1.5 text-[11px] font-medium leading-relaxed text-amber-800">
                  <li>
                    • La connexion passe par une liaison <b>WhatsApp Web non officielle</b> : elle n’est ni fournie ni
                    approuvée par WhatsApp.
                  </li>
                  <li>
                    • WhatsApp peut à tout moment <b>limiter, suspendre ou bannir définitivement</b> un numéro utilisé
                    pour de la messagerie automatisée.
                  </li>
                  <li>
                    • Utilisez un <b>numéro professionnel dédié que vous pouvez vous permettre de perdre</b> — jamais
                    votre numéro personnel, ni le numéro principal de votre entreprise.
                  </li>
                </ul>
                <p className="mt-2 text-[11px] font-black text-amber-800">
                  En scannant le QR code, vous acceptez ce risque.
                </p>
              </div>
            </div>
          </div>

          {sessionStatus === 'QR' || sessionStatus === 'CONNECTING' ? (
            <SectionCard
              title="Scanner le QR code"
              description="Le code change environ toutes les minutes, il se rafraîchit tout seul."
              icon={<QrCode size={18} />}
            >
              <div className="grid gap-6 md:grid-cols-2">
                <div className="flex items-center justify-center rounded-2xl border border-gray-100 bg-gray-50/50 p-6">
                  {qrGaveUp ? (
                    <div className="text-center">
                      <p className="text-[11px] font-bold leading-relaxed text-gray-500">
                        La génération du code a été interrompue après deux minutes d’inactivité.
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleConnect()}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-white transition-all hover:bg-primary-700"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Générer un nouveau code
                      </button>
                    </div>
                  ) : qr ? (
                    <img
                      src={qr}
                      alt="QR code de connexion WhatsApp"
                      className="h-56 w-56 rounded-xl bg-white object-contain p-2 shadow-sm"
                    />
                  ) : sessionStatus === 'QR' ? (
                    <div className="text-center">
                      <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-primary-500" />
                      <p className="mt-3 text-[11px] font-bold text-gray-400">Code expiré, régénération…</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-primary-500" />
                      <p className="mt-3 text-[11px] font-bold text-gray-400">Connexion en cours…</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Comment faire</p>
                  <ol className="mt-3 space-y-3">
                    {[
                      'Ouvrez WhatsApp sur le téléphone du numéro professionnel.',
                      'Appuyez sur Paramètres (ou le menu ⋮ en haut à droite sur Android).',
                      'Choisissez Appareils liés.',
                      'Appuyez sur Lier un appareil, puis scannez le code affiché ici.',
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary-50 text-[10px] font-black text-primary-600">
                          {i + 1}
                        </span>
                        <span className="text-[11px] font-medium leading-relaxed text-gray-600">{step}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-4 text-[11px] font-medium leading-relaxed text-gray-400">
                    Gardez le téléphone allumé et connecté à Internet : la liaison s’interrompt s’il reste hors ligne
                    trop longtemps.
                  </p>
                </div>
              </div>
            </SectionCard>
          ) : null}

          <SectionCard
            title="Ce qu’il reste à faire"
            description="L’agent ne peut vendre que lorsque ces quatre points sont verts."
            icon={<ListChecks size={18} />}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {PREREQUISITES.map((item) => {
                const ok = status?.prerequisites?.[item.key] ?? false;
                return (
                  <div
                    key={item.key}
                    className={clsx(
                      'flex items-start gap-3 rounded-2xl border p-4',
                      ok ? 'border-emerald-100 bg-emerald-50/40' : 'border-gray-100 bg-gray-50/50'
                    )}
                  >
                    <span
                      className={clsx(
                        'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full',
                        ok ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'
                      )}
                    >
                      {ok ? <Check className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    </span>
                    <div className="min-w-0">
                      <p className={clsx('text-xs font-black', ok ? 'text-emerald-700' : 'text-gray-600')}>
                        {item.label}
                      </p>
                      {!ok ? (
                        <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-gray-500">{item.hint}</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      ) : null}

      {/* ── TAB 2 — CONNAISSANCES ─────────────────────────────────── */}
      {tab === 'connaissances' ? (
        <div className="space-y-6">
          <div className="flex flex-col justify-between gap-3 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
            <p className="text-[11px] font-medium leading-relaxed text-gray-500">
              Tout ce que vous écrivez ici est envoyé au modèle avant chaque réponse. Plus c’est concret, mieux l’agent
              vend.
            </p>
            <button
              type="button"
              onClick={() => void handleShowPrompt()}
              disabled={busy === 'prompt'}
              className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-gray-600 transition-all hover:border-primary-200 hover:bg-primary-50 hover:text-primary-600 disabled:opacity-50"
            >
              <Eye className="h-3.5 w-3.5" /> Voir le prompt généré
            </button>
          </div>

          <SectionCard title="Entreprise" description="Les faits que l’agent doit connaître par cœur." icon={<Sparkles size={18} />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Nom de l’entreprise"
                value={kb.business.name}
                onChange={(v) => setKb({ ...kb, business: { ...kb.business, name: v } })}
                placeholder="Ex : Vegas Store"
              />
              <TextField
                label="Ce que vous vendez"
                value={kb.business.what_we_sell}
                onChange={(v) => setKb({ ...kb, business: { ...kb.business, what_we_sell: v } })}
                placeholder="Ex : cosmétiques naturels et accessoires"
              />
              <TextField
                label="Langues"
                value={kb.business.languages}
                onChange={(v) => setKb({ ...kb, business: { ...kb.business, languages: v } })}
                placeholder="Ex : darija, français"
                hint="L’agent répondra dans la langue du client, en priorité parmi celles-ci."
              />
              <TextField
                label="Pays"
                value={kb.business.country}
                onChange={(v) => setKb({ ...kb, business: { ...kb.business, country: v } })}
                placeholder="Ex : Maroc"
              />
              <TextField
                label="Devise"
                value={kb.business.currency}
                onChange={(v) => setKb({ ...kb, business: { ...kb.business, currency: v } })}
                placeholder="Ex : MAD (dirham)"
              />
              <TextField
                label="Horaires"
                value={kb.business.hours}
                onChange={(v) => setKb({ ...kb, business: { ...kb.business, hours: v } })}
                placeholder="Ex : 9h–19h, du lundi au samedi"
              />
              <TextField
                label="Site web"
                value={kb.business.website}
                onChange={(v) => setKb({ ...kb, business: { ...kb.business, website: v } })}
                placeholder="Ex : https://…"
              />
              <TextField
                label="Paiement"
                value={kb.business.payment}
                onChange={(v) => setKb({ ...kb, business: { ...kb.business, payment: v } })}
                placeholder="Ex : paiement à la livraison"
              />
              <div className="sm:col-span-2">
                <AreaField
                  label="Livraison"
                  rows={3}
                  value={kb.business.delivery}
                  onChange={(v) => setKb({ ...kb, business: { ...kb.business, delivery: v } })}
                  placeholder="Délais, villes couvertes, frais de livraison, livraison gratuite à partir de…"
                />
              </div>
              <div className="sm:col-span-2">
                <AreaField
                  label="Retours et garantie"
                  rows={3}
                  value={kb.business.returns}
                  onChange={(v) => setKb({ ...kb, business: { ...kb.business, returns: v } })}
                  placeholder="Ex : échange sous 48h si le produit est intact, remboursement en cas de défaut…"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Playbook"
            description="Vos instructions de vente. Elles remplacent les consignes génériques de la plateforme : ce que vous écrivez ici fait autorité."
            icon={<BookOpen size={18} />}
          >
            <AreaField
              label="Comment l’agent doit mener la conversation"
              rows={10}
              value={kb.playbook}
              onChange={(v) => setKb({ ...kb, playbook: v })}
              placeholder={
                'Ex :\n1. Saluer, demander le prénom.\n2. Poser une question sur le besoin avant de citer un prix.\n3. Ne jamais donner plus de deux options à la fois.\n4. Toujours proposer le pack 2 pièces avant de conclure.\n5. Terminer par un récapitulatif complet de la commande.'
              }
              hint="Écrivez comme vous formeriez un nouveau vendeur : des règles courtes, numérotées, sans ambiguïté."
            />
          </SectionCard>

          <SectionCard title="Offres" description="Promotions et packs en cours." icon={<Sparkles size={18} />}>
            <Repeatable
              items={kb.offers}
              onChange={(offers) => setKb({ ...kb, offers })}
              blank={() => ({ name: '', details: '', valid_until: '' })}
              addLabel="Ajouter une offre"
              emptyLabel="Aucune offre pour le moment."
            >
              {(offer, update) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField label="Nom de l’offre" value={offer.name} onChange={(v) => update({ name: v })} placeholder="Ex : Pack 2 pièces" />
                  <TextField
                    label="Valable jusqu’au"
                    value={offer.valid_until || ''}
                    onChange={(v) => update({ valid_until: v })}
                    placeholder="Ex : 31/12 — ou laissez vide"
                  />
                  <div className="sm:col-span-2">
                    <AreaField
                      label="Détails"
                      rows={2}
                      value={offer.details}
                      onChange={(v) => update({ details: v })}
                      placeholder="Ex : 2 pièces à 299 MAD au lieu de 398 MAD, livraison offerte."
                    />
                  </div>
                </div>
              )}
            </Repeatable>
          </SectionCard>

          <SectionCard title="FAQ" description="Les questions que vos clients posent tout le temps." icon={<BookOpen size={18} />}>
            <Repeatable
              items={kb.faq}
              onChange={(faq) => setKb({ ...kb, faq })}
              blank={() => ({ q: '', a: '' })}
              addLabel="Ajouter une question"
              emptyLabel="Aucune question enregistrée."
            >
              {(item, update) => (
                <div className="space-y-3">
                  <TextField label="Question" value={item.q} onChange={(v) => update({ q: v })} placeholder="Ex : Combien de temps pour la livraison ?" />
                  <AreaField label="Réponse" rows={2} value={item.a} onChange={(v) => update({ a: v })} placeholder="Ex : 24 à 48h dans les grandes villes." />
                </div>
              )}
            </Repeatable>
          </SectionCard>

          <SectionCard
            title="Objections"
            description="La section la plus rentable de cette page : c’est ici que se gagnent les ventes. Notez chaque phrase qui fait hésiter vos clients, et la réponse qui a déjà fonctionné."
            icon={<ShieldAlert size={18} />}
          >
            <Repeatable
              items={kb.objections}
              onChange={(objections) => setKb({ ...kb, objections })}
              blank={() => ({ objection: '', response: '' })}
              addLabel="Ajouter une objection"
              emptyLabel="Aucune objection enregistrée — commencez par les trois plus fréquentes."
            >
              {(item, update) => (
                <div className="space-y-3">
                  <TextField
                    label="Ce que dit le client"
                    value={item.objection}
                    onChange={(v) => update({ objection: v })}
                    placeholder="Ex : C’est trop cher"
                  />
                  <AreaField
                    label="Ce que l’agent répond"
                    rows={3}
                    value={item.response}
                    onChange={(v) => update({ response: v })}
                    placeholder="Ex : Je comprends. Le flacon dure deux mois, ça revient à moins de 5 MAD par jour — et vous ne payez qu’à la réception."
                  />
                </div>
              )}
            </Repeatable>
          </SectionCard>

          <SectionCard
            title="Exemples de réponses"
            description="Des exemples réels servent de modèle direct au style de l’agent. Collez 3 à 5 échanges que vous avez vraiment eus, dans le dialecte de vos clients — c’est ce qui change le plus le résultat."
            icon={<Sparkles size={18} />}
          >
            <Repeatable
              items={kb.examples}
              onChange={(examples) => setKb({ ...kb, examples })}
              blank={() => ({ customer: '', agent: '' })}
              addLabel="Ajouter un exemple"
              emptyLabel="Aucun exemple — collez ici de vraies réponses de votre équipe."
            >
              {(item, update) => (
                <div className="space-y-3">
                  <AreaField
                    label="Message du client"
                    rows={2}
                    value={item.customer}
                    onChange={(v) => update({ customer: v })}
                    placeholder="Ex : chhal taman dyalo ?"
                  />
                  <AreaField
                    label="Réponse de votre vendeur"
                    rows={3}
                    value={item.agent}
                    onChange={(v) => update({ agent: v })}
                    placeholder="Ex : Taman dyalo 249 dh a khoya, o li9ra3 kayweslek l dar o katkhalles men3ndek 🙏"
                  />
                </div>
              )}
            </Repeatable>
          </SectionCard>

          <SectionCard title="Ton" description="La personnalité que prend l’agent." icon={<Bot size={18} />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Persona"
                value={kb.tone.persona}
                onChange={(v) => setKb({ ...kb, tone: { ...kb.tone, persona: v } })}
                placeholder="Ex : Salma, conseillère de la boutique"
              />
              <TextField
                label="Style"
                value={kb.tone.style}
                onChange={(v) => setKb({ ...kb, tone: { ...kb.tone, style: v } })}
                placeholder="Ex : chaleureux, direct, phrases courtes"
              />
              <SelectField
                label="Emoji"
                value={kb.tone.emoji}
                onChange={(v) => setKb({ ...kb, tone: { ...kb.tone, emoji: v } })}
                options={optionsWith(EMOJI_OPTIONS, kb.tone.emoji)}
              />
              <div className="sm:col-span-2">
                <Field
                  label="Règles de ton"
                  hint="Une règle par ligne. Ex : ne jamais tutoyer, ne jamais promettre une date exacte de livraison."
                >
                  <StringList
                    items={kb.tone.rules}
                    onChange={(rules) => setKb({ ...kb, tone: { ...kb.tone, rules } })}
                    placeholder="Ex : ne jamais écrire en majuscules"
                    addLabel="Ajouter une règle"
                    emptyLabel="Aucune règle de ton."
                  />
                </Field>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Objectif" description="Ce que l’agent doit obtenir avant de conclure." icon={<ListChecks size={18} />}>
            <div className="space-y-4">
              <AreaField
                label="Objectif de la conversation"
                rows={2}
                value={kb.goal.objective}
                onChange={(v) => setKb({ ...kb, goal: { ...kb.goal, objective: v } })}
                placeholder="Ex : obtenir une commande confirmée avec adresse complète, en paiement à la livraison."
              />

              <Field
                label="Informations à collecter obligatoirement"
                hint="L’agent ne confirmera pas une commande tant que ces champs ne sont pas remplis."
              >
                <div className="flex flex-wrap gap-2">
                  {REQUIRED_FIELD_OPTIONS.map((opt) => {
                    const active = kb.goal.required_fields.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setKb({
                            ...kb,
                            goal: {
                              ...kb.goal,
                              required_fields: active
                                ? kb.goal.required_fields.filter((f) => f !== opt.value)
                                : [...kb.goal.required_fields, opt.value],
                            },
                          })
                        }
                        className={clsx(
                          'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-black transition-all',
                          active
                            ? 'border-primary-200 bg-primary-50 text-primary-600'
                            : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                        )}
                      >
                        {active ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <AreaField
                label="Script de confirmation"
                rows={4}
                value={kb.goal.confirmation_script}
                onChange={(v) => setKb({ ...kb, goal: { ...kb.goal, confirmation_script: v } })}
                placeholder="Ex : Je récapitule : {produit}, {quantité}, {prix} MAD, livraison à {adresse}, {ville}. Vous payez à la réception. Je valide ?"
                hint="Le message exact que l’agent envoie avant de considérer la commande comme confirmée."
              />
            </div>
          </SectionCard>

          <SaveBar onSave={() => void handleSaveKb()} saving={busy === 'kb'} label="Enregistrer les connaissances" />
        </div>
      ) : null}

      {/* ── TAB 3 — PRODUITS ──────────────────────────────────────── */}
      {tab === 'produits' ? (
        <div className="space-y-4">
          <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-medium leading-relaxed text-gray-500">
              L’agent ne peut vendre que les produits de votre catalogue que vous activez ici. Chaque fiche remplacée ou
              complétée ci-dessous est ce qu’il utilisera pour argumenter, pas la description publique du produit.
            </p>
          </div>

          {products.length === 0 ? (
            <div className="rounded-3xl border border-gray-100 bg-white p-12 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-gray-300">
                <Package className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-black text-gray-900">Aucun produit disponible</h3>
              <p className="mx-auto mt-2 max-w-md text-[11px] font-medium leading-relaxed text-gray-500">
                L’agent ne peut vendre que des produits qui existent déjà dans votre catalogue. Ajoutez d’abord un
                produit à votre catalogue, il apparaîtra automatiquement dans cette liste.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {products.map((product) => {
                const image = product.images?.find((i) => i.isPrimary)?.imageUrl || product.images?.[0]?.imageUrl;
                const enabled = product.profile?.enabled ?? false;
                const open = editingProduct === product.id;
                return (
                  <div key={product.id} className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
                    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-4">
                        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
                          {image ? (
                            <img src={getFileUrl(image)} alt={product.nameFr} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-gray-300">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-gray-900">{product.nameFr}</p>
                          <p className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-gray-400">
                            {product.sku} · {product.retailPriceMad} MAD · {product.stockStatus}
                          </p>
                          {product.profile?.agentPriceMad != null ? (
                            <p className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                              Prix agent : {product.profile.agentPriceMad} MAD
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                            Activé pour l’agent
                          </span>
                          <Switch
                            checked={enabled}
                            disabled={busy === `product-toggle-${product.id}`}
                            onChange={(next) => void handleToggleProduct(product, next)}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => (open ? setEditingProduct(null) : openProductEditor(product))}
                          className="rounded-xl border border-gray-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500 transition-all hover:border-primary-200 hover:bg-primary-50 hover:text-primary-600"
                        >
                          {open ? 'Fermer' : 'Modifier la fiche'}
                        </button>
                        {product.profile ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveProduct(product)}
                            disabled={busy === `product-remove-${product.id}`}
                            title="Retirer de l’agent"
                            className="rounded-xl p-2 text-gray-300 transition-colors hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {open ? (
                      <div className="space-y-4 border-t border-gray-50 bg-gray-50/40 p-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <TextField
                            label="Prix agent (MAD)"
                            value={productDraft.agentPriceMad}
                            onChange={(v) => setProductDraft({ ...productDraft, agentPriceMad: v })}
                            placeholder={String(product.retailPriceMad)}
                            hint={`Laissez vide pour utiliser le prix du catalogue (${product.retailPriceMad} MAD).`}
                          />
                          <TextField
                            label="Prix barré (MAD)"
                            value={productDraft.oldPriceMad}
                            onChange={(v) => setProductDraft({ ...productDraft, oldPriceMad: v })}
                            placeholder="Ex : 399"
                            hint="Le prix « avant remise » que l’agent cite pour ancrer la valeur. Ne l’inventez pas."
                          />
                        </div>

                        <AreaField
                          label="Argumentaire"
                          rows={4}
                          value={productDraft.sellingCopy}
                          onChange={(v) => setProductDraft({ ...productDraft, sellingCopy: v })}
                          placeholder="Comment vous présenteriez ce produit à un client qui ne le connaît pas."
                        />

                        <AreaField
                          label="Bénéfices"
                          rows={3}
                          value={productDraft.benefits}
                          onChange={(v) => setProductDraft({ ...productDraft, benefits: v })}
                          placeholder="Un bénéfice concret par ligne. Ex : résultat visible en 2 semaines."
                        />

                        <div className="grid gap-4 sm:grid-cols-2">
                          <AreaField
                            label="Variantes"
                            rows={3}
                            value={productDraft.variants}
                            onChange={(v) => setProductDraft({ ...productDraft, variants: v })}
                            placeholder="Ex : Taille S / M / L — Couleur noir, beige"
                          />
                          <AreaField
                            label="Note de stock"
                            rows={3}
                            value={productDraft.stockNote}
                            onChange={(v) => setProductDraft({ ...productDraft, stockNote: v })}
                            placeholder="Ex : la taille L est en rupture jusqu’à vendredi"
                          />
                        </div>

                        <Field label="Objections propres à ce produit">
                          <Repeatable
                            items={productDraft.objections}
                            onChange={(objections) => setProductDraft({ ...productDraft, objections })}
                            blank={() => ({ objection: '', response: '' })}
                            addLabel="Ajouter une objection"
                            emptyLabel="Aucune objection propre à ce produit."
                          >
                            {(item, update) => (
                              <div className="space-y-3">
                                <TextField
                                  label="Ce que dit le client"
                                  value={item.objection}
                                  onChange={(v) => update({ objection: v })}
                                  placeholder="Ex : est-ce que ça convient aux peaux sensibles ?"
                                />
                                <AreaField
                                  label="Ce que l’agent répond"
                                  rows={2}
                                  value={item.response}
                                  onChange={(v) => update({ response: v })}
                                  placeholder="Ex : oui, la formule est sans parfum et testée dermatologiquement."
                                />
                              </div>
                            )}
                          </Repeatable>
                        </Field>

                        <AreaField
                          label="Médias autorisés"
                          rows={4}
                          value={productDraft.mediaUrls}
                          onChange={(v) => setProductDraft({ ...productDraft, mediaUrls: v })}
                          placeholder={'https://…/photo-1.jpg\nhttps://…/video.mp4'}
                          hint="Une URL par ligne. L’agent ne peut envoyer QUE les fichiers listés ici — rien d’autre."
                        />

                        <AreaField
                          label="Notes internes"
                          rows={3}
                          value={productDraft.notes}
                          onChange={(v) => setProductDraft({ ...productDraft, notes: v })}
                          placeholder="Informations utiles à l’agent mais jamais dites telles quelles au client."
                        />

                        <SwitchRow
                          label="Activé pour l’agent"
                          description="Un produit désactivé n’est jamais proposé, même s’il reste dans votre catalogue."
                          checked={productDraft.enabled}
                          onChange={(next) => setProductDraft({ ...productDraft, enabled: next })}
                        />

                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingProduct(null)}
                            className="rounded-xl px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-gray-400 transition-all hover:bg-gray-100"
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleSaveProduct(product)}
                            disabled={busy === `product-save-${product.id}`}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-white transition-all hover:bg-primary-700 disabled:opacity-50"
                          >
                            {busy === `product-save-${product.id}` ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                            Enregistrer la fiche
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* ── TAB 4 — VOIX ──────────────────────────────────────────── */}
      {tab === 'voix' ? (
        <div className="space-y-6">
          <SectionCard
            title="Messages vocaux"
            description="Quand l’agent doit répondre en vocal plutôt qu’en texte."
            icon={<AudioLines size={18} />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Mode vocal"
                value={draft?.ttsMode || 'never'}
                onChange={(v) => patchDraft({ ttsMode: v as AgentConfig['ttsMode'] })}
                options={optionsWith(TTS_MODE_OPTIONS, draft?.ttsMode)}
                hint="Miroir = répond en vocal seulement si le client a envoyé un vocal. C’est le réglage le plus naturel."
              />
              <NumberField
                label="Longueur maximale d’un vocal (caractères)"
                value={draft?.ttsMaxChars ?? 0}
                min={0}
                step={50}
                onChange={(v) => patchDraft({ ttsMaxChars: v })}
                hint="Au-delà, la réponse part en texte. Un vocal trop long fatigue le client et coûte plus cher."
              />
            </div>
            <div className="mt-4">
              <SaveBar
                onSave={() =>
                  void saveConfig(
                    { ttsMode: draft?.ttsMode, ttsMaxChars: draft?.ttsMaxChars },
                    'tts',
                    'Réglages vocaux enregistrés.'
                  )
                }
                saving={busy === 'tts'}
                label="Enregistrer le mode vocal"
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Profils de voix"
            description="Chaque profil est une voix du catalogue plus vos réglages de jeu."
            icon={<AudioLines size={18} />}
            action={
              <button
                type="button"
                onClick={() => {
                  setVoiceDraft(voiceDraftFrom(null));
                  setPreviewUrl(null);
                  setPreviewInfo(null);
                }}
                className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500 transition-all hover:border-primary-200 hover:bg-primary-50 hover:text-primary-600"
              >
                <Plus className="h-3.5 w-3.5" /> Nouveau profil
              </button>
            }
          >
            {voices.presets.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-[11px] font-bold text-gray-400">
                Aucun profil de voix. Créez-en un pour donner une voix à votre agent.
              </p>
            ) : (
              <div className="space-y-3">
                {voices.presets.map((preset) => {
                  const active = config?.activeVoiceId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      className={clsx(
                        'flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between',
                        active ? 'border-emerald-100 bg-emerald-50/40' : 'border-gray-100 bg-gray-50/50'
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-black text-gray-900">{preset.name}</p>
                          {preset.isSystem ? (
                            <span className="rounded-lg border border-slate-100 bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
                              Système
                            </span>
                          ) : null}
                          {active ? (
                            <span className="rounded-lg border border-emerald-100 bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-600">
                              Voix active
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                          {preset.provider} · {preset.voiceId}
                          {preset.style ? ` · ${preset.style}` : ''}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void handlePreviewVoice(
                              {
                                provider: preset.provider,
                                voiceId: preset.voiceId,
                                voiceRef: preset.voiceRef,
                                rate: preset.rate,
                                pitch: preset.pitch,
                                volume: preset.volume,
                                style: preset.style,
                                styleDegree: preset.styleDegree,
                                stylePrompt: preset.stylePrompt,
                              },
                              `voice-preview-${preset.id}`
                            )
                          }
                          disabled={busy === `voice-preview-${preset.id}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500 transition-all hover:border-primary-200 hover:text-primary-600 disabled:opacity-50"
                        >
                          {busy === `voice-preview-${preset.id}` ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                          Écouter
                        </button>
                        {!active ? (
                          <button
                            type="button"
                            onClick={() => void handleUseVoice(preset)}
                            disabled={busy === `voice-use-${preset.id}`}
                            className="rounded-xl bg-primary-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-primary-700 disabled:opacity-50"
                          >
                            Utiliser cette voix
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            setVoiceDraft(voiceDraftFrom(preset));
                            setPreviewUrl(null);
                            setPreviewInfo(null);
                          }}
                          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500 transition-all hover:border-primary-200 hover:text-primary-600"
                        >
                          Modifier
                        </button>
                        {/* Un preset système est modifiable mais jamais supprimable. */}
                        {!preset.isSystem ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteVoice(preset)}
                            disabled={busy === `voice-delete-${preset.id}`}
                            title="Supprimer"
                            className="rounded-xl p-2 text-gray-300 transition-colors hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {previewUrl ? (
              <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Aperçu</p>
                <audio key={previewUrl} src={previewUrl} controls autoPlay className="w-full" />

                {/* Ce que le compte vient d'entendre n'est pas forcément le moteur qu'il a choisi. */}
                {previewInfo ? (
                  previewFellBack ? (
                    <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-amber-800">
                            Cet extrait a été produit par {previewEngineLabel}.
                          </p>
                          <p className="mt-1 text-[11px] font-medium leading-relaxed text-amber-700">
                            {previewInfo.fellBackFrom ? `Cause : ${previewInfo.fellBackFrom}. ` : ''}
                            {previewInfo.retried > 0
                              ? `${previewInfo.retried} tentative${previewInfo.retried > 1 ? 's' : ''} ont échoué avant celle-ci. `
                              : ''}
                            C’est la voix que vos clients entendront tant que les maillons précédents restent
                            indisponibles.
                          </p>
                          {previewInfo.attempts.length > 0 ? (
                            <details className="mt-2.5">
                              <summary className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-amber-600">
                                Voir les {previewInfo.attempts.length} tentative
                                {previewInfo.attempts.length > 1 ? 's' : ''} échouée
                                {previewInfo.attempts.length > 1 ? 's' : ''}
                              </summary>
                              <ul className="mt-2 space-y-1">
                                {previewInfo.attempts.map((attempt, i) => (
                                  <li
                                    key={i}
                                    className="break-words rounded-lg bg-white/70 px-2.5 py-1.5 text-start font-mono text-[10px] leading-relaxed text-amber-700"
                                  >
                                    {attempt}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
                      <Check className="h-3.5 w-3.5" />
                      Produit du premier coup par {previewEngineLabel}.
                    </p>
                  )
                ) : null}
              </div>
            ) : null}
          </SectionCard>

          {voiceDraft ? (
            <SectionCard
              title={voiceDraft.id ? 'Modifier le profil' : 'Nouveau profil de voix'}
              description={
                voiceDraft.isSystem
                  ? 'Ce profil est fourni par la plateforme. Vous pouvez l’ajuster, mais pas le supprimer.'
                  : 'Choisissez une voix, réglez le jeu, écoutez, enregistrez.'
              }
              icon={<AudioLines size={18} />}
              action={
                <button
                  type="button"
                  onClick={() => setVoiceDraft(null)}
                  className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-gray-50 hover:text-gray-500"
                >
                  <X className="h-4 w-4" />
                </button>
              }
            >
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="Nom du profil"
                    value={voiceDraft.name}
                    onChange={(v) => setVoiceDraft({ ...voiceDraft, name: v })}
                    placeholder="Ex : Salma — chaleureuse"
                  />
                  <Field label="Voix du catalogue">
                    <select
                      className={INPUT_CLS}
                      value={voiceDraft.voiceRef != null ? String(voiceDraft.voiceRef) : ''}
                      onChange={(e) => {
                        const picked = voices.catalogue.find((v) => String(v.id) === e.target.value);
                        if (!picked) {
                          setVoiceDraft({ ...voiceDraft, voiceRef: null });
                          return;
                        }
                        setVoiceDraft({
                          ...voiceDraft,
                          voiceRef: picked.id,
                          provider: picked.provider,
                          voiceId: picked.voiceId,
                          // Une émotion d'une autre voix n'a aucun sens ici.
                          style: picked.styles.includes(voiceDraft.style) ? voiceDraft.style : '',
                        });
                      }}
                    >
                      <option value="">— Choisir une voix —</option>
                      {voicesByProvider.map(([provider, list]) => (
                        <optgroup key={provider} label={provider}>
                          {list.map((v) => (
                            <option key={v.id} value={String(v.id)}>
                              {v.label}
                              {v.locale ? ` · ${v.locale}` : ''}
                              {v.gender ? ` · ${v.gender}` : ''}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </Field>
                </div>

                {/* Les contrôles disponibles dépendent entièrement du moteur choisi. */}
                {selectedCatalogueVoice?.supportsProsody ? (
                  <div className="grid gap-5 rounded-2xl border border-gray-100 bg-gray-50/50 p-4 sm:grid-cols-3">
                    <SliderField
                      label="Vitesse"
                      value={voiceDraft.rate}
                      min={-50}
                      max={100}
                      step={5}
                      display={`${voiceDraft.rate > 0 ? '+' : ''}${voiceDraft.rate} %`}
                      onChange={(v) => setVoiceDraft({ ...voiceDraft, rate: v })}
                    />
                    <SliderField
                      label="Hauteur"
                      value={voiceDraft.pitch}
                      min={-50}
                      max={50}
                      step={5}
                      display={`${voiceDraft.pitch > 0 ? '+' : ''}${voiceDraft.pitch}`}
                      onChange={(v) => setVoiceDraft({ ...voiceDraft, pitch: v })}
                    />
                    <SliderField
                      label="Volume"
                      value={voiceDraft.volume}
                      min={-50}
                      max={50}
                      step={5}
                      display={`${voiceDraft.volume > 0 ? '+' : ''}${voiceDraft.volume}`}
                      onChange={(v) => setVoiceDraft({ ...voiceDraft, volume: v })}
                    />
                  </div>
                ) : null}

                {selectedCatalogueVoice?.supportsStyle && selectedCatalogueVoice.styles.length > 0 ? (
                  <div className="grid gap-4 rounded-2xl border border-gray-100 bg-gray-50/50 p-4 sm:grid-cols-2">
                    <SelectField
                      label="Émotion"
                      value={voiceDraft.style}
                      onChange={(v) => setVoiceDraft({ ...voiceDraft, style: v })}
                      options={[
                        { value: '', label: '— Neutre —' },
                        ...selectedCatalogueVoice.styles.map((s) => ({ value: s, label: s })),
                      ]}
                    />
                    <SliderField
                      label="Intensité de l’émotion"
                      value={voiceDraft.styleDegree}
                      min={0.01}
                      max={2}
                      step={0.01}
                      display={voiceDraft.styleDegree.toFixed(2)}
                      onChange={(v) => setVoiceDraft({ ...voiceDraft, styleDegree: v })}
                      hint="1,00 = intensité normale. Au-delà de 1,5 le rendu devient souvent caricatural."
                    />
                  </div>
                ) : null}

                {/*
                  Sur ce moteur, l'instruction de jeu N'EST PAS un détail de
                  finition : c'est le seul réglage qui existe. Il n'y a ni
                  vitesse, ni hauteur, ni accent à cocher — tout passe par ces
                  quelques lignes, d'où le traitement visuel appuyé.
                */}
                {selectedCatalogueVoice?.supportsStyle && selectedCatalogueVoice.styles.length === 0 ? (
                  <div className="rounded-2xl border-2 border-primary-100 bg-primary-50/40 p-4">
                    <div className="mb-3 flex items-start gap-2.5">
                      <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-500" />
                      <div className="min-w-0">
                        <p className="text-xs font-black text-gray-900">Le seul réglage de ce moteur</p>
                        <p className="mt-1 text-[11px] font-medium leading-relaxed text-gray-600">
                          Cette voix n’a ni curseur de vitesse, ni réglage d’accent : l’accent, le débit et l’émotion se
                          décrivent ici, en toutes lettres.
                        </p>
                      </div>
                    </div>
                    <AreaField
                      label="Instruction de jeu"
                      rows={5}
                      value={voiceDraft.stylePrompt}
                      onChange={(v) => setVoiceDraft({ ...voiceDraft, stylePrompt: v })}
                      placeholder={
                        'Ex : parle en darija marocaine de Casablanca, chaleureuse et posée, comme une vendeuse au téléphone.\n' +
                        'Pas égyptien, pas du Golfe, pas d’arabe standard.'
                      }
                      hint="Écrivez la direction d’acteur que vous donneriez à une vraie personne — et dites aussi ce qu’il ne faut PAS entendre : « pas égyptien, pas du Golfe, pas d’arabe standard ». Sans ces interdits, le modèle glisse vers un arabe passe-partout et perd la darija marocaine."
                    />
                  </div>
                ) : null}

                <AreaField
                  label="Texte d’essai (facultatif)"
                  rows={2}
                  value={sampleText}
                  onChange={setSampleText}
                  placeholder="Laissez vide pour utiliser la phrase par défaut."
                />

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void handlePreviewVoice(voicePayload(voiceDraft, selectedCatalogueVoice), 'voice-preview-draft')}
                    disabled={busy === 'voice-preview-draft'}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-gray-600 transition-all hover:border-primary-200 hover:bg-primary-50 hover:text-primary-600 disabled:opacity-50"
                  >
                    {busy === 'voice-preview-draft' ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    Écouter
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveVoice()}
                    disabled={busy === 'voice-save'}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-white transition-all hover:bg-primary-700 disabled:opacity-50"
                  >
                    {busy === 'voice-save' ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    Enregistrer le profil
                  </button>
                </div>
              </div>
            </SectionCard>
          ) : null}

          {/* ── Chaîne de repli ──────────────────────────────────── */}
          {draft ? (
            <SectionCard
              title="Chaîne de repli"
              description="Les moteurs essayés l’un après l’autre quand le premier refuse de parler."
              icon={<Repeat size={18} />}
            >
              <div className="space-y-5">
                <p className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 text-[11px] font-medium leading-relaxed text-amber-800">
                  Le moteur qui sonne le mieux — <span className="font-black">Gemini Live, audio natif</span> — parle
                  comme une personne au lieu de lire un texte à voix haute. Il est aussi en aperçu chez Google et
                  échoue régulièrement. Les moteurs ci-dessous sont donc essayés dans l’ordre : en cas d’échec, votre
                  client reçoit une voix un peu moins naturelle plutôt qu’aucun vocal du tout.
                </p>

                <div>
                  <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Ordre des moteurs
                  </span>

                  {ttsChain.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-5 text-center text-[11px] font-bold text-gray-400">
                      Aucun repli. Si le moteur choisi échoue, aucune note vocale ne partira.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {ttsChain.map((link, index) => {
                        const model = ttsModelByKey.get(link);
                        return (
                          <div
                            key={`${index}-${link}`}
                            className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-gray-50/50 p-3"
                          >
                            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-white text-[10px] font-black tabular-nums text-gray-400">
                              {index + 1}
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="truncate text-xs font-black text-gray-900">{model?.label || link}</p>
                                {LIVE_MODEL_RE.test(link) ? (
                                  <span
                                    title="Moteur conversationnel : chaque prise est retranscrite et vérifiée avant envoi."
                                    className="rounded-lg border border-violet-100 bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-violet-600"
                                  >
                                    Live
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-0.5 truncate text-[10px] font-black uppercase tracking-widest text-gray-400">
                                {link}
                              </p>
                            </div>

                            <div className="flex flex-shrink-0 items-center gap-1">
                              <button
                                type="button"
                                title="Monter"
                                disabled={index === 0}
                                onClick={() => moveChainLink(index, -1)}
                                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white hover:text-primary-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Descendre"
                                disabled={index === ttsChain.length - 1}
                                onClick={() => moveChainLink(index, 1)}
                                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white hover:text-primary-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Retirer de la chaîne"
                                onClick={() => setTtsChain(ttsChain.filter((_, j) => j !== index))}
                                className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Field
                  label="Ajouter un maillon"
                  hint="Seuls les moteurs vocaux activés par la plateforme peuvent servir de repli : un maillon inconnu ferait refuser tout l’enregistrement."
                >
                  <select
                    className={INPUT_CLS}
                    value=""
                    disabled={chainCandidates.length === 0}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      setTtsChain([...ttsChain, e.target.value]);
                    }}
                  >
                    <option value="">
                      {chainCandidates.length === 0
                        ? '— Tous les moteurs disponibles sont déjà dans la chaîne —'
                        : '— Ajouter un maillon —'}
                    </option>
                    {chainCandidates.map((m) => (
                      <option key={m.id} value={`${m.provider}:${m.modelId}`}>
                        {m.label} · {m.provider}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberField
                    label="Tentatives par maillon"
                    value={draft.ttsRetries ?? 0}
                    min={0}
                    max={5}
                    step={1}
                    onChange={(v) => patchDraft({ ttsRetries: v })}
                    hint="Combien de fois chaque moteur est réessayé avant de passer au suivant. 0 à 5."
                  />

                  <NumberField
                    label="Délai maximum (secondes)"
                    value={Math.round((draft.ttsTimeoutMs ?? 0) / 1000)}
                    min={10}
                    max={180}
                    step={5}
                    onChange={(v) => patchDraft({ ttsTimeoutMs: Math.round(v * 1000) })}
                    hint="Au-delà, la tentative est abandonnée et le maillon suivant prend la main. Entre 10 et 180 secondes."
                  />

                  <SelectField
                    label="Vérification"
                    value={draft.ttsVerify || 'live_only'}
                    onChange={(v) => patchDraft({ ttsVerify: v as AgentConfig['ttsVerify'] })}
                    options={optionsWith(TTS_VERIFY_OPTIONS, draft.ttsVerify)}
                    hint={TTS_VERIFY_HELP[draft.ttsVerify] || TTS_VERIFY_HELP.live_only}
                  />

                  <SelectField
                    label="Si tout échoue"
                    value={draft.ttsOnFailure || 'text_only'}
                    onChange={(v) => patchDraft({ ttsOnFailure: v as AgentConfig['ttsOnFailure'] })}
                    options={optionsWith(TTS_FAILURE_OPTIONS, draft.ttsOnFailure)}
                    hint={TTS_FAILURE_HELP[draft.ttsOnFailure] || TTS_FAILURE_HELP.text_only}
                  />
                </div>

                <SaveBar
                  onSave={() => void handleSaveTtsChain()}
                  saving={busy === 'tts-chain'}
                  label="Enregistrer la chaîne"
                />
              </div>
            </SectionCard>
          ) : null}
        </div>
      ) : null}

      {/* ── TAB 5 — RÉGLAGES ──────────────────────────────────────── */}
      {tab === 'banc' ? <SandboxChat /> : null}

      {tab === 'reglages' && draft ? (
        <div className="space-y-6">
          <SectionCard title="Modèles" description="Les moteurs qui font parler, lire et écouter votre agent." icon={<Settings size={18} />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Nom affiché de l’agent"
                value={draft.displayName || ''}
                onChange={(v) => patchDraft({ displayName: v })}
                placeholder="Ex : Salma"
                hint="Le prénom sous lequel l’agent se présente aux clients."
              />

              {/*
                A platform-managed brain cannot be rendered as a select: the
                model is deliberately absent from `models.brain`, so the control
                would show SOME OTHER model as if it were the current one, and
                saving the form would silently move the account off the engine
                an admin put it on. The API refuses that write; this makes the
                page tell the same truth instead of lying and then erroring.
              */}
              {config?.brainLocked ? (
                <div className="rounded-2xl border border-primary-100 bg-primary-50/40 p-4">
                  <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                    Cerveau (modèle de réponse)
                  </p>
                  <p className="mt-1 text-sm font-bold text-gray-900">
                    {config.brainModel?.label || 'Modèle géré par la plateforme'}
                  </p>
                  <p className="mt-1 text-[11px] font-medium leading-relaxed text-gray-500">
                    Ce modèle est géré par la plateforme et ne peut pas être changé ici.
                  </p>
                </div>
              ) : (
                <SelectField
                  label="Cerveau (modèle de réponse)"
                  value={draft.brainModelId != null ? String(draft.brainModelId) : ''}
                  onChange={(v) => patchDraft({ brainModelId: v === '' ? null : Number(v) })}
                  options={[
                    { value: '', label: '— Choisir un modèle —' },
                    ...models.brain.map((m) => ({ value: String(m.id), label: `${m.label} · ${m.provider}` })),
                  ]}
                />
              )}

              {/* L'effort n'existe pas sur tous les modèles : on le cache plutôt que de l'afficher inerte. */}
              {chosenBrain?.supportsEffort ? (
                <SelectField
                  label="Effort de réflexion"
                  value={draft.effort || 'medium'}
                  onChange={(v) => patchDraft({ effort: v })}
                  options={optionsWith(EFFORT_OPTIONS, draft.effort)}
                  hint="Plus l’effort est élevé, plus la réponse est réfléchie — et plus elle consomme de crédits."
                />
              ) : null}

              <NumberField
                label="Longueur maximale d’une réponse (tokens)"
                value={draft.maxOutputTokens}
                min={64}
                step={64}
                onChange={(v) => patchDraft({ maxOutputTokens: v })}
                hint="Sur WhatsApp, court vaut mieux que long. 300 à 500 suffisent presque toujours."
              />

              {/*
                Les moteurs vocaux sont un réglage de plateforme : le compte ne
                peut plus les changer, mais savoir lequel travaille pour lui
                reste utile — surtout pour comprendre un aperçu vocal.
              */}
              {sttModelLabel || ttsModelLabel ? (
                <p className="text-[11px] font-medium leading-relaxed text-gray-400 sm:col-span-2">
                  Transcription : {sttModelLabel ?? '—'} · Voix : {ttsModelLabel ?? '—'} — gérés par la
                  plateforme.
                </p>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard title="Écoute des vocaux" description="Ce que l’agent fait des messages audio reçus." icon={<AudioLines size={18} />}>
            <div className="space-y-4">
              <SwitchRow
                label="Transcrire les messages vocaux des clients"
                description="Sans cela, l’agent ignore complètement les vocaux entrants."
                checked={draft.sttEnabled}
                onChange={(next) => patchDraft({ sttEnabled: next })}
              />
              <AreaField
                label="Indice de transcription"
                rows={2}
                value={draft.sttPrompt || ''}
                onChange={(v) => patchDraft({ sttPrompt: v })}
                placeholder="Ex : darija marocaine, noms de produits : Argan Gold, Serum Vita C"
                hint="Donnez les mots que la transcription rate souvent (noms de marques, villes, dialecte)."
              />
            </div>
          </SectionCard>

          <SectionCard title="Comportement" description="À qui l’agent répond, et de quelle manière." icon={<Bot size={18} />}>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Répondre à"
                  value={draft.replyTo}
                  onChange={(v) => patchDraft({ replyTo: v as AgentConfig['replyTo'] })}
                  options={[
                    { value: 'all', label: 'Tous les messages entrants' },
                    { value: 'ads_only', label: 'Uniquement les clients venus d’une publicité' },
                  ]}
                  hint="« Publicité » = conversations ouvertes depuis un clic sur une annonce vers WhatsApp."
                />

                {draft.replyTo === 'ads_only' ? (
                  <TextField
                    label="Mots-clés des publicités"
                    value={draft.adKeywords || ''}
                    onChange={(v) => patchDraft({ adKeywords: v })}
                    placeholder="Ex : promo, annonce, campagne"
                    hint="Séparés par des virgules. Utilisés pour reconnaître un message venu d’une annonce."
                  />
                ) : null}
              </div>

              <SelectField
                label="Après une commande confirmée"
                value={draft.afterConfirmed}
                onChange={(v) => patchDraft({ afterConfirmed: v as AgentConfig['afterConfirmed'] })}
                options={[
                  { value: 'support', label: 'Continuer — assurer le suivi après-vente' },
                  { value: 'stop', label: 'S’arrêter — laisser la main à votre équipe' },
                ]}
                hint={
                  draft.afterConfirmed === 'support'
                    ? 'L’agent reste disponible pour les questions de livraison ou de modification.'
                    : 'L’agent ne répond plus du tout sur cette conversation une fois la commande confirmée.'
                }
              />
            </div>
          </SectionCard>

          <SectionCard title="Horaires de travail" description="En dehors de ces heures, l’agent ne vend pas." icon={<Settings size={18} />}>
            <div className="space-y-4">
              <SwitchRow
                label="Limiter l’agent à des horaires"
                description="Désactivé, l’agent répond 24h/24."
                checked={draft.workingHoursEnabled}
                onChange={(next) => patchDraft({ workingHoursEnabled: next })}
              />
              {draft.workingHoursEnabled ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="Début"
                    type="time"
                    value={draft.workingHoursStart || ''}
                    onChange={(v) => patchDraft({ workingHoursStart: v })}
                  />
                  <TextField
                    label="Fin"
                    type="time"
                    value={draft.workingHoursEnd || ''}
                    onChange={(v) => patchDraft({ workingHoursEnd: v })}
                  />
                  <div className="sm:col-span-2">
                    <AreaField
                      label="Message hors horaires"
                      rows={2}
                      value={draft.afterHoursMessage || ''}
                      onChange={(v) => patchDraft({ afterHoursMessage: v })}
                      placeholder="Ex : Merci pour votre message ! Notre équipe vous répond dès 9h. 🌙"
                      hint="Laissez vide pour ne rien envoyer du tout en dehors des horaires."
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            title="Garde-fous"
            description="Les limites qui empêchent une boucle de réponses de vider vos crédits."
            icon={<ShieldAlert size={18} />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="Réponses maximum par contact"
                value={draft.maxRepliesPerContact}
                min={1}
                onChange={(v) => patchDraft({ maxRepliesPerContact: v })}
                hint="Au-delà, l’agent se tait sur cette conversation."
              />
              <NumberField
                label="Réponses maximum par jour"
                value={draft.maxRepliesPerDay}
                min={1}
                onChange={(v) => patchDraft({ maxRepliesPerDay: v })}
                hint="Tous contacts confondus."
              />
              <NumberField
                label="Délai minimum entre deux réponses (secondes)"
                value={draft.minSecondsBetweenReplies}
                min={0}
                onChange={(v) => patchDraft({ minSecondsBetweenReplies: v })}
                hint="Protège contre un client qui envoie dix messages d’affilée."
              />
              <NumberField
                label="Longueur maximale d’un message entrant (caractères)"
                value={draft.maxInputChars}
                min={100}
                step={100}
                onChange={(v) => patchDraft({ maxInputChars: v })}
                hint="Un message plus long est tronqué avant d’être envoyé au modèle."
              />
            </div>
          </SectionCard>

          <SectionCard title="Médias" description="Ce que l’agent peut lire et envoyer." icon={<Package size={18} />}>
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <SwitchRow
                  label="Lire les images reçues"
                  description="L’agent regarde les photos envoyées par le client (capture d’écran, produit, adresse)."
                  checked={draft.readImages}
                  onChange={(next) => patchDraft({ readImages: next })}
                />
                <SwitchRow
                  label="Lire les vidéos reçues"
                  description="Plus lent et plus coûteux que les images."
                  checked={draft.readVideos}
                  onChange={(next) => patchDraft({ readVideos: next })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <NumberField
                  label="Images extraites par vidéo"
                  value={draft.videoFrames}
                  min={1}
                  max={20}
                  onChange={(v) => patchDraft({ videoFrames: v })}
                  hint="Chaque image extraite est facturée comme une image."
                />
                <NumberField
                  label="Poids maximum d’un fichier (Mo)"
                  value={draft.maxMediaMb}
                  min={1}
                  onChange={(v) => patchDraft({ maxMediaMb: v })}
                />
                <NumberField
                  label="Fichiers lus par message"
                  value={draft.maxMediaPerTurn}
                  min={1}
                  onChange={(v) => patchDraft({ maxMediaPerTurn: v })}
                />
              </div>

              <SwitchRow
                label="Envoyer les médias du catalogue"
                description="L’agent peut envoyer les photos et vidéos listées dans la fiche produit — et uniquement celles-là."
                checked={draft.sendCatalogueMedia}
                onChange={(next) => patchDraft({ sendCatalogueMedia: next })}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Création automatique de leads"
            description="Ce que l’agent fait d’une commande confirmée."
            icon={<AlertTriangle size={18} />}
          >
            <SwitchRow
              danger
              label="Créer automatiquement un lead à chaque commande confirmée"
              description="Attention : un lead créé est un lead réel. Il est facturé, il réserve un crédit Google Sheets, et il peut être transmis automatiquement au centre d’appel. Laissez cette option désactivée tant que vous n’avez pas relu vous-même plusieurs conversations et vérifié que l’agent ne confirme que de vraies commandes."
              checked={draft.autoCreateLead}
              onChange={(next) => patchDraft({ autoCreateLead: next })}
            />
          </SectionCard>

          <SaveBar onSave={() => void handleSaveSettings()} saving={busy === 'settings'} label="Enregistrer les réglages" />
        </div>
      ) : null}

      {tab === 'reglages' && !draft ? (
        <div className="rounded-3xl border border-gray-100 bg-white p-10 text-center shadow-sm">
          <p className="text-[11px] font-bold text-gray-400">
            Les réglages de l’agent n’ont pas pu être chargés. Rechargez la page pour réessayer.
          </p>
        </div>
      ) : null}

      {/* ── Modale du prompt compilé ──────────────────────────────── */}
      {promptOpen ? (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setPromptOpen(false)} />
          <div className="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
              <div>
                <h3 className="text-sm font-black text-gray-900">Prompt généré</h3>
                <p className="mt-1 text-[11px] font-medium text-gray-500">
                  Exactement ce que le modèle reçoit avant chaque réponse. Lecture seule.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPromptOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-slate-50/50 p-5">
              {compiledPrompt === null ? (
                <div className="py-12 text-center">
                  <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-primary-500" />
                </div>
              ) : (
                <pre className="whitespace-pre-wrap break-words text-start font-mono text-[11px] leading-relaxed text-slate-700">
                  {compiledPrompt || '(Le prompt est vide — remplissez la base de connaissances.)'}
                </pre>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmationModal
        isOpen={!!confirmBox}
        title={confirmBox?.title || ''}
        message={confirmBox?.message || ''}
        type="danger"
        confirmText="Confirmer"
        cancelText="Annuler"
        onClose={() => setConfirmBox(null)}
        onConfirm={() => confirmBox?.run()}
      />
    </div>
  );
}


/* ------------------------------------------------------------------ */
/* banc d'essai                                                        */
/* ------------------------------------------------------------------ */

/**
 * Discuter avec son propre agent, sans WhatsApp et sans deuxieme telephone.
 *
 * POURQUOI CET ONGLET EXISTE. WhatsApp interdit a un numero de s'ecrire a
 * lui-meme : tant qu'il n'y avait que la vraie messagerie, tester une
 * modification de la base de connaissances demandait d'emprunter le portable de
 * quelqu'un d'autre - donc personne ne testait, et les clients decouvraient les
 * changements en premier.
 *
 * CE QUE CE N'EST PAS : une simulation. Le message part dans les memes tables
 * qu'un message client, et le worker le traite avec le meme code - garde-fous,
 * horaires, credits, modele, outils, voix. Une difference entre une reponse du
 * banc et une vraie reponse est un defaut du banc, pas une caracteristique.
 *
 * DEUX DIFFERENCES ASSUMEES, toutes deux imposees cote serveur : la reponse ne
 * part jamais sur WhatsApp, et une commande confirmee ici ne devient jamais un
 * lead facture.
 *
 * Le tour CONSOMME des credits : c'est un vrai appel au modele, que la
 * plateforme paie.
 */
function SandboxChat() {
  const [state, setState] = useState<SandboxState | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const bottom = useRef<HTMLDivElement | null>(null);

  /**
   * Le nombre de messages au moment de l'envoi.
   *
   * Une ref et pas un state : le sondage la lit a chaque tick et, en state,
   * elle serait figee sur la valeur capturee au premier rendu.
   */
  const awaited = useRef<number | null>(null);

  const load = async (silent = false): Promise<SandboxState | null> => {
    if (!silent) setLoading(true);
    try {
      const res = await waAgentApi.sandbox();
      const next = res.data.data as SandboxState;
      setState(next);
      setError(null);
      return next;
    } catch (err: any) {
      setError(err?.response?.data?.message || "Le banc d'essai n'a pas pu etre charge.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state?.messages.length]);

  /**
   * Sondage court, et seulement en attente d'une reponse.
   *
   * Le worker draine toutes les deux secondes ; on interroge a la meme cadence
   * et on s'arrete des que la reponse est la, ou que le tour s'est termine sans
   * reponse. Un sondage permanent sur un onglet laisse ouvert toute la journee
   * n'a aucune raison d'exister.
   */
  useEffect(() => {
    if (awaited.current === null) return;

    let cancelled = false;
    let ticks = 0;

    const timer = setInterval(() => {
      void (async () => {
        ticks += 1;
        const next = await load(true);
        if (cancelled || !next) return;

        const arrived = next.messages.length > (awaited.current ?? 0);
        const turn = next.turns[0];
        const settled = !!turn && turn.status !== 'PENDING' && turn.status !== 'CLAIMED';

        // 60 ticks = deux minutes. Au-dela ce n'est plus de la latence : le
        // worker ne tourne pas, et continuer a interroger ne le demarrera pas.
        if (arrived || settled || ticks > 60) {
          awaited.current = null;
          clearInterval(timer);
        }
      })();
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [state?.messages.length, sending]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;

    setSending(true);
    try {
      awaited.current = state?.messages.length ?? 0;
      await waAgentApi.sandboxSend(body);
      setText('');
      await load(true);
    } catch (err: any) {
      awaited.current = null;
      toast.error(err?.response?.data?.message || "Le message n'a pas pu etre envoye au banc d'essai.");
    } finally {
      setSending(false);
    }
  };

  const reset = async () => {
    try {
      await waAgentApi.sandboxReset();
      awaited.current = null;
      await load();
      toast.success("Banc d'essai reinitialise.");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'La reinitialisation a echoue.');
    }
  };

  const lastTurn: SandboxTurn | undefined = state?.turns[0];
  const waiting = awaited.current !== null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      {/* la conversation */}
      <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-black text-gray-900">
              <MessageSquare size={15} className="text-primary-500" />
              Banc d&apos;essai
            </h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Ecrivez comme un client. C&apos;est le vrai agent qui repond, avec vos credits.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void reset()}
            title="Repartir d'une conversation neuve"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50"
          >
            <Trash2 size={13} />
            Reinitialiser
          </button>
        </div>

        <div className="flex-1 min-h-[26rem] max-h-[34rem] overflow-y-auto px-5 py-4 space-y-3 bg-gray-50/40">
          {loading ? (
            <p className="text-center text-sm text-gray-400 py-10">Chargement...</p>
          ) : error ? (
            <p className="text-center text-sm text-rose-600 py-10">{error}</p>
          ) : !state?.messages.length ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 bg-white border border-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-3 text-gray-300">
                <MessageSquare size={26} />
              </div>
              <p className="text-sm font-bold text-gray-700">Personne n&apos;a encore ecrit</p>
              <p className="mt-1 text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
                Envoyez le premier message comme le ferait un client, puis regardez ce que
                l&apos;agent repond vraiment.
              </p>
            </div>
          ) : (
            state.messages.map((m) => {
              const mine = m.direction === 'IN';
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      mine
                        ? 'bg-primary-600 text-white rounded-br-sm'
                        : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                    }`}
                  >
                    {m.body || m.transcript || (m.hasMedia ? '[media]' : '...')}
                    <span className={`block mt-1 text-[10px] ${mine ? 'text-white/60' : 'text-gray-400'}`}>
                      {new Date(m.createdAt).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {!mine && (m.fromAgent ? ' - agent' : ' - vous (manuel)')}
                      {m.kind === 'AUDIO' && ' - note vocale'}
                    </span>
                  </div>
                </div>
              );
            })
          )}

          {waiting && (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-sm bg-white border border-gray-200 px-3.5 py-2.5 text-xs text-gray-400">
                <Loader2 size={13} className="animate-spin" />
                L&apos;agent reflechit...
              </div>
            </div>
          )}

          <div ref={bottom} />
        </div>

        <form onSubmit={send} className="flex items-end gap-2 border-t border-gray-100 p-3">
          <textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Entree envoie, Maj+Entree passe a la ligne - comme WhatsApp.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(e as unknown as React.FormEvent);
              }
            }}
            placeholder="Ecrivez comme un client..."
            className="input flex-1 leading-relaxed resize-none"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-xl hover:bg-primary-700 disabled:opacity-40"
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Envoyer
          </button>
        </form>
      </div>

      {/* ce que l'agent a compris */}
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Ce que l&apos;agent a retenu
          </p>
          {state?.contact.draft && Object.keys(state.contact.draft).length ? (
            <dl className="mt-3 space-y-1.5">
              {Object.entries(state.contact.draft).map(([key, value]) => (
                <div key={key} className="flex items-start justify-between gap-3 text-xs">
                  <dt className="text-gray-400 font-mono">{key}</dt>
                  <dd className="text-gray-800 font-semibold text-end break-words">{String(value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-2 text-xs text-gray-400">
              Rien encore. Les champs apparaissent au fur et a mesure que l&apos;agent les collecte.
            </p>
          )}

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-400">Etat</span>
            <span className="font-black text-gray-700">{state?.contact.status ?? '-'}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span className="text-gray-400">Reponses</span>
            <span className="font-black text-gray-700 tabular-nums">{state?.contact.aiReplyCount ?? 0}</span>
          </div>
        </div>

        {/* Le tour : la raison d'une reponse absente est ici, et nulle part ailleurs. */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Dernier tour</p>
          {!lastTurn ? (
            <p className="mt-2 text-xs text-gray-400">Aucun tour pour l&apos;instant.</p>
          ) : (
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Statut</span>
                <span
                  className={`font-black ${
                    lastTurn.status === 'DONE'
                      ? 'text-emerald-600'
                      : lastTurn.status === 'PENDING' || lastTurn.status === 'CLAIMED'
                        ? 'text-amber-600'
                        : 'text-rose-600'
                  }`}
                >
                  {lastTurn.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Jetons</span>
                <span className="font-semibold text-gray-700 tabular-nums">
                  {lastTurn.inputTokens} / {lastTurn.outputTokens}
                </span>
              </div>
              {(lastTurn.skipReason || lastTurn.lastError) && (
                <p className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2 text-amber-800 leading-relaxed">
                  {lastTurn.skipReason || lastTurn.lastError}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-center gap-1.5 text-[10px] font-black text-amber-700 uppercase tracking-widest">
            <AlertTriangle size={12} />A savoir
          </p>
          <ul className="mt-2 space-y-1.5 text-xs text-amber-900 leading-relaxed">
            <li>Chaque reponse consomme un credit, comme une vraie reponse.</li>
            <li>Rien n&apos;est envoye sur WhatsApp : la conversation reste ici.</li>
            <li>Une commande confirmee sur le banc ne cree aucun lead facture.</li>
            <li>Si le worker est arrete, le message reste en attente et rien ne repond.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

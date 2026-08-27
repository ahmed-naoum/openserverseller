import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  MessageSquare,
  Megaphone,
  PauseCircle,
  Phone,
  RefreshCw,
  Search,
  Send,
  FlaskConical,
  Sparkles,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react';
import { api } from '../../lib/api';
import {
  formatWaMoney,
  waAgentApi,
  type AgentStatus,
  type SessionStatus,
  type WaConversation,
  type WaMessage,
} from '../../lib/waAgentApi';
import { useDebounce } from '../../hooks/utils';

/**
 * The live WhatsApp inbox.
 *
 * One component serves both dashboards (`/dashboard/whatsapp-inbox` and
 * `/influencer/whatsapp-inbox`), so nothing here builds a URL from a hardcoded
 * prefix — every action is an API call against the conversation id.
 *
 * The thread is polled rather than pushed: the agent replies out of a worker
 * queue, so a message the account just sent only exists once the worker drains
 * it. Five seconds is short enough to read as live and long enough that an open
 * inbox is not a load problem.
 *
 * The whole thread is read in `dir=rtl` as often as not — the agent speaks
 * Darija — so bubble alignment uses logical utilities (`ms-auto`/`me-auto`,
 * `text-start`/`text-end`) and never left/right.
 */

/* ------------------------------------------------------------------ */
/* constants                                                           */
/* ------------------------------------------------------------------ */

const POLL_MS = 5000;
const LIST_POLL_MS = 15000;
const PAGE_SIZE = 30;

type StatusValue = WaConversation['status'];
type StatusFilter = 'all' | StatusValue;
type SourceFilter = 'all' | 'AD' | 'ORGANIC';

const STATUS_META: Record<StatusValue, { label: string; chip: string }> = {
  NEW: { label: 'Nouvelle', chip: 'bg-blue-50 text-blue-600 border-blue-100' },
  QUALIFIED: { label: 'En cours', chip: 'bg-amber-50 text-amber-600 border-amber-100' },
  CONFIRMED: { label: 'Confirmée', chip: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  REJECTED: { label: 'Refusée', chip: 'bg-rose-50 text-rose-600 border-rose-100' },
  HUMAN: { label: 'Humain', chip: 'bg-violet-50 text-violet-600 border-violet-100' },
};

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'NEW', label: 'Nouvelles' },
  { value: 'QUALIFIED', label: 'En cours' },
  { value: 'CONFIRMED', label: 'Confirmées' },
  { value: 'REJECTED', label: 'Refusées' },
  { value: 'HUMAN', label: 'Humain' },
];

const SOURCE_CHIPS: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: 'Toutes sources' },
  { value: 'AD', label: 'Publicité' },
  { value: 'ORGANIC', label: 'Organique' },
];

const SESSION_LABEL: Record<SessionStatus, string> = {
  DISCONNECTED: 'Session déconnectée',
  QR: 'En attente du QR code',
  CONNECTING: 'Connexion en cours',
  CONNECTED: 'Session connectée',
  LOGGED_OUT: 'Session fermée depuis le téléphone',
  BANNED: 'Numéro bloqué par WhatsApp',
};

/** Kinds that carry a file behind the authenticated media endpoint. */
const MEDIA_KINDS: WaMessage['kind'][] = ['IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT', 'STICKER'];

/** The lead fields the agent collects, in the order the account reads them. */
const DRAFT_FIELDS = [
  { key: 'full_name', label: 'Nom complet', kind: 'text' },
  { key: 'phone', label: 'Téléphone', kind: 'text' },
  { key: 'city', label: 'Ville', kind: 'text' },
  { key: 'address', label: 'Adresse', kind: 'textarea' },
  { key: 'product', label: 'Produit', kind: 'text' },
  { key: 'variant', label: 'Variante', kind: 'text' },
  { key: 'quantity', label: 'Quantité', kind: 'number' },
  { key: 'price', label: 'Prix (MAD)', kind: 'number' },
  { key: 'notes', label: 'Notes', kind: 'textarea' },
] as const;

type DraftKey = (typeof DRAFT_FIELDS)[number]['key'];
type DraftForm = Record<DraftKey, string>;

const EMPTY_DRAFT: DraftForm = {
  full_name: '',
  phone: '',
  city: '',
  address: '',
  product: '',
  variant: '',
  quantity: '',
  price: '',
  notes: '',
};

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/** The platform answers `{ status, message }` on failure; fall back when it doesn't. */
const errorMessage = (err: unknown, fallback: string): string => {
  const data = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
  return data?.message || data?.error || fallback;
};

const draftToForm = (draft: WaConversation['draft']): DraftForm => {
  const next: DraftForm = { ...EMPTY_DRAFT };
  DRAFT_FIELDS.forEach((field) => {
    const value = draft ? draft[field.key] : undefined;
    next[field.key] = value === null || value === undefined ? '' : String(value);
  });
  return next;
};

/**
 * Empty fields are dropped rather than written as `""`: the promotion code reads
 * the draft with `draft.city ? ... : null`, and a blank string would be stored
 * on the lead as an empty city instead of no city at all.
 */
const formToDraft = (form: DraftForm): Record<string, string | number> => {
  const out: Record<string, string | number> = {};
  DRAFT_FIELDS.forEach((field) => {
    const raw = form[field.key].trim();
    if (!raw) return;
    if (field.kind === 'number') {
      const parsed = Number(raw.replace(',', '.'));
      out[field.key] = Number.isFinite(parsed) ? parsed : raw;
    } else {
      out[field.key] = raw;
    }
  });
  return out;
};

const hasDraftContent = (draft: WaConversation['draft']): boolean =>
  !!draft && Object.values(draft).some((v) => v !== null && v !== undefined && String(v).trim() !== '');

const contactLabel = (contact: WaConversation): string =>
  (contact.pushName || '').trim() || contact.phone || 'Contact WhatsApp';

/**
 * What to show where a phone number goes.
 *
 * WhatsApp masks the number on a privacy (@lid) contact, so there genuinely is
 * not one yet. Printing the opaque identifier instead — which is what happened
 * before — put a plausible-looking 15-digit number in front of the seller that
 * nobody can call.
 */
const phoneLabel = (phone: string | null): string => phone || 'Numéro non communiqué';

/**
 * La conversation du banc d'essai.
 *
 * Elle vit dans la même table que les vraies, et c'est voulu — le banc doit
 * exercer exactement le même code. Mais elle se comporte à l'envers sur deux
 * points, et l'écran doit le dire : écrire ici parle AU NOM DU CLIENT au lieu
 * de reprendre la main, et aucun lead facturé ne peut en sortir.
 */
const isBenchJid = (jid: string | null | undefined): boolean =>
  String(jid || '').endsWith('@sandbox');

const listStamp = (iso: string | null): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return isToday(date) ? format(date, 'HH:mm') : format(date, 'd MMM', { locale: fr });
};

/* ------------------------------------------------------------------ */
/* media cache                                                         */
/* ------------------------------------------------------------------ */

/**
 * The media endpoint requires the Authorization header, so a bare `<img src>`
 * would 401. Each attachment is pulled through the api client as a blob and
 * rendered from an object URL; every URL created here is revoked again, either
 * when its thread is closed or when the page unmounts.
 */
type MediaEntry =
  | { state: 'loading' }
  | { state: 'ready'; url: string }
  | { state: 'error' };

/* ------------------------------------------------------------------ */
/* component                                                           */
/* ------------------------------------------------------------------ */

export default function WhatsappInboxPage() {
  /* -- entitlement / session ------------------------------------- */
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);

  /* -- conversation list ----------------------------------------- */
  const [conversations, setConversations] = useState<WaConversation[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  /* -- thread ----------------------------------------------------- */
  const [activeId, setActiveId] = useState<number | null>(null);

  /**
   * `?conversation=<id>` opens that chat directly.
   *
   * The Leads page links here per row. Without this the link lands on the inbox
   * with whatever chat happened to be selected, which reads as the click having
   * done nothing.
   */
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const requested = Number(searchParams.get('conversation'));
    if (!Number.isFinite(requested) || requested <= 0) return;

    setActiveId(requested);
    // Consumed once. Left in place it would drag the user back to this chat
    // every time they clicked another one.
    searchParams.delete('conversation');
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams]);
  const [contact, setContact] = useState<WaConversation | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const activeIdRef = useRef<number | null>(null);

  /* -- composer --------------------------------------------------- */
  const [outgoing, setOutgoing] = useState('');
  const [sending, setSending] = useState(false);
  const [justPaused, setJustPaused] = useState(false);

  /* -- draft panel ------------------------------------------------ */
  const [draftOpen, setDraftOpen] = useState(false);

  const [draftForm, setDraftForm] = useState<DraftForm>(EMPTY_DRAFT);

  /**
   * What the collapsed header shows instead of the whole form.
   *
   * Read from the form the account is editing, not from `contact.draft`, so an
   * unsaved correction shows immediately rather than a stale count.
   */
  const draftFilledCount = useMemo(
    () => Object.values(draftForm).filter((v) => String(v ?? '').trim() !== '').length,
    [draftForm]
  );

  /** The two fields worth reading at a glance, when there are any. */
  const draftSummary = useMemo(() => {
    const bits = [draftForm.product, draftForm.city].map((v) => String(v ?? '').trim()).filter(Boolean);
    return bits.length ? `· ${bits.join(' · ')}` : '';
  }, [draftForm.product, draftForm.city]);
  const [savingDraft, setSavingDraft] = useState(false);

  /* -- header actions --------------------------------------------- */
  const [savingContact, setSavingContact] = useState(false);
  const [promoting, setPromoting] = useState(false);

  /* -- attachments ------------------------------------------------ */
  const [media, setMedia] = useState<Record<number, MediaEntry>>({});
  const mediaRef = useRef<Record<number, MediaEntry>>({});
  const visibleMediaRef = useRef<Set<number>>(new Set());

  /* -- scrolling -------------------------------------------------- */
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  const enabled = agentStatus?.enabled === true;
  const sessionStatus: SessionStatus = agentStatus?.session?.status || 'DISCONNECTED';
  const sessionConnected = sessionStatus === 'CONNECTED';

  /* ---------------------------------------------------------------- */
  /* status                                                            */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await waAgentApi.status();
        if (!alive) return;
        setAgentStatus((res.data?.data ?? { enabled: false }) as AgentStatus);
      } catch {
        // `status` never 403s, so a failure here is the network, not the gate.
        if (alive) setAgentStatus({ enabled: false });
      } finally {
        if (alive) setStatusLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* ---------------------------------------------------------------- */
  /* conversation list                                                 */
  /* ---------------------------------------------------------------- */

  const loadConversations = useCallback(
    async (silent: boolean) => {
      if (!silent) setListLoading(true);
      try {
        const res = await waAgentApi.conversations({
          status: statusFilter,
          source: sourceFilter,
          q: debouncedSearch.trim() || undefined,
          page,
          limit: PAGE_SIZE,
        });
        const payload = res.data?.data as {
          conversations?: WaConversation[];
          pagination?: { total?: number; totalPages?: number };
        };
        setConversations(Array.isArray(payload?.conversations) ? payload.conversations : []);
        setTotal(Number(payload?.pagination?.total) || 0);
        setTotalPages(Math.max(1, Number(payload?.pagination?.totalPages) || 1));
      } catch (err) {
        if (!silent) toast.error(errorMessage(err, 'Impossible de charger les conversations.'));
      } finally {
        if (!silent) setListLoading(false);
      }
    },
    [statusFilter, sourceFilter, debouncedSearch, page]
  );

  /* ---------------------------------------------------------------- */
  /* manual reconnect                                                  */
  /* ---------------------------------------------------------------- */

  /**
   * Rebuild the WhatsApp socket by hand, and pull in whatever was missed.
   *
   * Exists because "Session connectée" is not proof that anything is arriving.
   * A socket can stay open, keep sending, keep this badge green, and silently
   * stop delivering inbound messages — from this screen that is
   * indistinguishable from a quiet afternoon, and until now the only recovery
   * was someone with database access.
   *
   * Deliberately enabled while the badge reads connected, because connected is
   * precisely the state it is here to fix. Disabling it on a green badge would
   * hide the button exactly when it is needed.
   */
  const handleReconnect = useCallback(async () => {
    setReconnecting(true);
    try {
      await waAgentApi.reconnect();
      toast.success('Reconnexion demandée — WhatsApp revient dans quelques secondes.');

      // The worker drops the socket and builds a new one on its own tick, so
      // nothing is up to date the instant this call returns. Re-read once the
      // rebuild has had time to land: a stale badge here is what makes a seller
      // press the button again and assume it does nothing.
      window.setTimeout(async () => {
        try {
          const res = await waAgentApi.status();
          setAgentStatus((res.data?.data ?? { enabled: false }) as AgentStatus);
        } catch {
          /* the status poll catches up on its own; not worth a second toast */
        }
        await loadConversations(true);
        setReconnecting(false);
      }, 6000);
    } catch (err) {
      toast.error(errorMessage(err, 'La reconnexion a échoué.'));
      setReconnecting(false);
    }
  }, [loadConversations]);

  // Narrowing always restarts at the first page — page 3 of the old result set
  // is meaningless against the new one. Reset alongside the filter rather than
  // in an effect, so the list is fetched once and not twice.
  const applyStatusFilter = (value: StatusFilter) => {
    setStatusFilter(value);
    setPage(1);
  };

  const applySourceFilter = (value: SourceFilter) => {
    setSourceFilter(value);
    setPage(1);
  };

  const applySearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  useEffect(() => {
    if (!enabled) return;
    loadConversations(false);
  }, [enabled, loadConversations]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => loadConversations(true), LIST_POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, loadConversations]);

  /* ---------------------------------------------------------------- */
  /* thread                                                            */
  /* ---------------------------------------------------------------- */

  const mergeContact = useCallback((updated: WaConversation) => {
    setContact((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
    setConversations((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
  }, []);

  const loadThread = useCallback(async (id: number, initial: boolean) => {
    try {
      const res = await waAgentApi.messages(id);
      const payload = res.data?.data as { contact: WaConversation; messages: WaMessage[] };
      // The account may have opened another chat while this was in flight.
      if (activeIdRef.current !== id) return;

      setContact(payload.contact);
      setMessages(Array.isArray(payload.messages) ? payload.messages : []);

      // The draft form is only seeded on open: re-seeding on every poll would
      // wipe what the account is typing into it right now.
      if (initial) {
        setDraftForm(draftToForm(payload.contact?.draft));
        // Always collapsed on open.
        //
        // This used to expand whenever the draft held anything, which meant it
        // was open on every conversation the agent had actually worked — the
        // ones you most want to read — squeezing the thread into a strip. The
        // collapsed header carries a count instead, so nothing is hidden.
        setDraftOpen(false);
      }

      // Opening the thread clears the badge server-side; mirror it in the list
      // instead of waiting for the next list poll.
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...payload.contact, unreadCount: 0 } : c))
      );
    } catch (err) {
      if (activeIdRef.current !== id) return;
      if (initial) toast.error(errorMessage(err, 'Impossible de charger la conversation.'));
    } finally {
      if (initial && activeIdRef.current === id) setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    activeIdRef.current = activeId;
    setJustPaused(false);
    setOutgoing('');
    stickToBottomRef.current = true;

    if (activeId == null) {
      setContact(null);
      setMessages([]);
      setDraftForm(EMPTY_DRAFT);
      return;
    }

    setThreadLoading(true);
    setContact(null);
    setMessages([]);
    loadThread(activeId, true);

    const timer = setInterval(() => loadThread(activeId, false), POLL_MS);
    return () => clearInterval(timer);
  }, [activeId, loadThread]);

  // Follow the conversation down as it grows, unless the account has scrolled up
  // to read history — in which case yanking them back is the bug, not the fix.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, threadLoading]);

  const handleThreadScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  /* ---------------------------------------------------------------- */
  /* attachments                                                       */
  /* ---------------------------------------------------------------- */

  const writeMedia = useCallback((next: Record<number, MediaEntry>) => {
    mediaRef.current = next;
    setMedia(next);
  }, []);

  useEffect(() => {
    const wanted = messages.filter((m) => MEDIA_KINDS.includes(m.kind));
    const wantedIds = new Set(wanted.map((m) => m.id));
    visibleMediaRef.current = wantedIds;

    // Drop the previous thread's blobs. Entries still in flight are left alone;
    // their own handler discards them once it sees they are no longer visible.
    const pruned = { ...mediaRef.current };
    let didPrune = false;
    Object.keys(pruned).forEach((key) => {
      const id = Number(key);
      if (wantedIds.has(id)) return;
      const entry = pruned[id];
      if (entry.state === 'loading') return;
      if (entry.state === 'ready') URL.revokeObjectURL(entry.url);
      delete pruned[id];
      didPrune = true;
    });
    if (didPrune) writeMedia(pruned);

    wanted.forEach((message) => {
      if (mediaRef.current[message.id]) return;
      writeMedia({ ...mediaRef.current, [message.id]: { state: 'loading' } });

      api
        .get(waAgentApi.mediaUrl(message.id), { responseType: 'blob' })
        .then((res) => {
          const url = URL.createObjectURL(res.data as Blob);
          if (!visibleMediaRef.current.has(message.id)) {
            URL.revokeObjectURL(url);
            const without = { ...mediaRef.current };
            delete without[message.id];
            writeMedia(without);
            return;
          }
          writeMedia({ ...mediaRef.current, [message.id]: { state: 'ready', url } });
        })
        .catch(() => {
          writeMedia({ ...mediaRef.current, [message.id]: { state: 'error' } });
        });
    });
  }, [messages, writeMedia]);

  // Nothing else revokes what is still on screen when the page goes away.
  useEffect(
    () => () => {
      Object.values(mediaRef.current).forEach((entry) => {
        if (entry.state === 'ready') URL.revokeObjectURL(entry.url);
      });
      mediaRef.current = {};
    },
    []
  );

  /* ---------------------------------------------------------------- */
  /* actions                                                           */
  /* ---------------------------------------------------------------- */

  const patchContact = useCallback(
    async (data: { aiEnabled?: boolean; status?: string; draft?: Record<string, unknown> }, successText: string) => {
      if (!contact) return false;
      setSavingContact(true);
      try {
        const res = await waAgentApi.updateConversation(contact.id, data);
        const updated = res.data?.data as WaConversation;
        if (updated) mergeContact(updated);
        toast.success(successText);
        return true;
      } catch (err) {
        toast.error(errorMessage(err, 'La modification a échoué.'));
        return false;
      } finally {
        setSavingContact(false);
      }
    },
    [contact, mergeContact]
  );

  const handleToggleAi = async (next: boolean) => {
    const ok = await patchContact(
      { aiEnabled: next },
      next ? "L'agent IA répond à nouveau sur cette conversation." : "L'agent IA est en pause sur cette conversation."
    );
    if (ok && next) setJustPaused(false);
  };

  const handleStatusChange = async (next: string) => {
    await patchContact({ status: next }, 'Statut mis à jour.');
  };

  const handleSaveDraft = async () => {
    if (!contact) return;
    setSavingDraft(true);
    try {
      const res = await waAgentApi.updateConversation(contact.id, { draft: formToDraft(draftForm) });
      const updated = res.data?.data as WaConversation;
      if (updated) {
        mergeContact(updated);
        setDraftForm(draftToForm(updated.draft));
      }
      toast.success('Fiche enregistrée.');
    } catch (err) {
      toast.error(errorMessage(err, "L'enregistrement de la fiche a échoué."));
    } finally {
      setSavingDraft(false);
    }
  };

  const handlePromote = async () => {
    if (!contact) return;
    const confirmed = window.confirm(
      'Créer un lead à partir de cette conversation ?\n\n' +
        "Attention : la création d'un lead est facturée, elle réserve un crédit Google Sheets " +
        'et le lead peut être transmis automatiquement au call center.\n\n' +
        'Vérifiez la fiche client avant de continuer — elle ne sera plus modifiable ici.'
    );
    if (!confirmed) return;

    setPromoting(true);
    try {
      const res = await waAgentApi.promote(contact.id);
      const payload = res.data?.data as { lead?: { id: number }; alreadyPromoted?: boolean };
      const leadId = payload?.lead?.id;
      toast.success(
        payload?.alreadyPromoted
          ? `Cette conversation est déjà rattachée au lead #${leadId ?? ''}.`
          : `Lead #${leadId ?? ''} créé.`
      );
      await loadThread(contact.id, false);
      loadConversations(true);
    } catch (err) {
      toast.error(errorMessage(err, 'La création du lead a échoué.'));
    } finally {
      setPromoting(false);
    }
  };

  const handleSend = async () => {
    if (!contact) return;
    const text = outgoing.trim();
    if (!text) return;
    if (!sessionConnected) {
      toast.error("La session WhatsApp n'est pas connectée.");
      return;
    }

    setSending(true);
    try {
      await waAgentApi.send(contact.id, text);
      setOutgoing('');
      // The API pauses the agent on any manual send, so the customer never gets
      // two answers at once. Say so rather than letting the switch flip silently.
      setJustPaused(true);
      setContact((prev) => (prev ? { ...prev, aiEnabled: false } : prev));
      setConversations((prev) =>
        prev.map((c) => (c.id === contact.id ? { ...c, aiEnabled: false } : c))
      );
      stickToBottomRef.current = true;
      // The worker sends it; the message only appears once the queue drains.
      await loadThread(contact.id, false);
    } catch (err) {
      toast.error(errorMessage(err, "L'envoi du message a échoué."));
    } finally {
      setSending(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /* derived                                                           */
  /* ---------------------------------------------------------------- */

  const canPromote = !!contact && contact.leadId === null && hasDraftContent(contact.draft);
  const composerBlockReason = useMemo(() => {
    if (!contact) return null;
    if (!sessionConnected) {
      return `${SESSION_LABEL[sessionStatus]} — reconnectez WhatsApp depuis le studio de l'agent pour pouvoir écrire au client.`;
    }
    return null;
  }, [contact, sessionConnected, sessionStatus]);

  /* ---------------------------------------------------------------- */
  /* render — gates                                                    */
  /* ---------------------------------------------------------------- */

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="max-w-xl mx-auto py-10">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-5">
            <MessageSquare className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">
            Messagerie WhatsApp non activée
          </h1>
          <p className="mt-3 text-sm font-medium text-gray-500 leading-relaxed">
            L&apos;agent WhatsApp n&apos;est pas activé sur votre compte. Une fois l&apos;option
            ouverte par l&apos;équipe Vegas, toutes vos conversations clients arriveront ici : vous
            pourrez suivre les échanges de l&apos;agent, reprendre la main à tout moment et
            transformer une discussion en lead.
          </p>
          <p className="mt-4 text-xs font-bold text-gray-400">
            Contactez le support pour demander l&apos;activation.
          </p>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* render — inbox                                                    */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Messagerie WhatsApp</h1>
          <p className="text-xs font-medium text-gray-500 mt-1">
            Les conversations de votre agent, en direct. Reprenez la main quand vous le souhaitez.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:ms-auto">
          <span
            className={clsx(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest',
              sessionConnected
                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                : 'bg-rose-50 text-rose-600 border-rose-100'
            )}
          >
            <span
              className={clsx(
                'w-1.5 h-1.5 rounded-full',
                sessionConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              )}
            />
            {SESSION_LABEL[sessionStatus]}
          </span>

          <button
            type="button"
            onClick={handleReconnect}
            disabled={reconnecting}
            title="Reconstruit la connexion WhatsApp et recharge les conversations. À utiliser si des messages n'arrivent plus, même quand la session est affichée comme connectée."
            className={clsx(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition',
              reconnecting
                ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            {reconnecting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            {reconnecting ? 'Reconnexion…' : 'Reconnecter'}
          </button>

          {agentStatus?.credits ? (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-[10px] font-black uppercase tracking-widest text-gray-500 tabular-nums"
              title={`${agentStatus.credits.affordable} réponse(s) d'agent encore financée(s)`}
            >
              <Wallet className="w-3 h-3" />
              {/* Balances travel as integer cents; formatWaMoney owns the divide. */}
              {formatWaMoney(agentStatus.credits.balance)}
            </span>
          ) : null}
        </div>
      </div>

      {/* ── Two panes ────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-11rem)] min-h-[520px]">
        {/* ── LEFT : conversation list ─────────────────────────── */}
        <aside
          className={clsx(
            'w-full lg:w-[340px] xl:w-[380px] lg:flex-shrink-0 bg-white rounded-3xl border border-gray-100 shadow-sm flex-col overflow-hidden',
            activeId == null ? 'flex' : 'hidden lg:flex'
          )}
        >
          <div className="p-4 border-b border-gray-50 space-y-3">
            <div className="relative">
              <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => applySearch(e.target.value)}
                placeholder="Rechercher un nom ou un numéro…"
                className="w-full ps-10 pe-9 py-2.5 bg-gray-50 border-none rounded-xl text-sm font-medium text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => applySearch('')}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Effacer la recherche"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {STATUS_CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => applyStatusFilter(chip.value)}
                  className={clsx(
                    'px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all',
                    statusFilter === chip.value
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'
                  )}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {SOURCE_CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => applySourceFilter(chip.value)}
                  className={clsx(
                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all',
                    sourceFilter === chip.value
                      ? 'bg-accent-500 text-white border-accent-500'
                      : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'
                  )}
                >
                  {chip.value === 'AD' ? <Megaphone className="w-3 h-3" /> : null}
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {listLoading ? (
              <div className="py-16 text-center">
                <Loader2 className="w-5 h-5 text-primary-500 animate-spin mx-auto" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="py-16 px-6 text-center">
                <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                <p className="text-[11px] font-bold text-gray-400">
                  {debouncedSearch.trim() || statusFilter !== 'all' || sourceFilter !== 'all'
                    ? 'Aucune conversation ne correspond à ces filtres.'
                    : 'Aucune conversation pour le moment.'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {conversations.map((conv) => {
                  const meta = STATUS_META[conv.status];
                  const isActive = conv.id === activeId;
                  return (
                    <li key={conv.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(conv.id)}
                        className={clsx(
                          'w-full text-start px-4 py-3 transition-colors',
                          isActive ? 'bg-primary-50/60' : 'hover:bg-gray-50/70'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-bold text-gray-900 truncate">
                            {contactLabel(conv)}
                          </span>
                          {conv.source === 'AD' ? (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-accent-50 text-accent-600 border border-accent-100 text-[9px] font-black uppercase tracking-wider flex-shrink-0"
                              title={conv.adHeadline || 'Conversation issue d’une publicité'}
                            >
                              <Megaphone className="w-2.5 h-2.5" />
                              AD
                            </span>
                          ) : null}
                          <span className="ms-auto flex items-center gap-1.5 flex-shrink-0">
                            {conv.unreadCount > 0 ? (
                              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center tabular-nums">
                                {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                              </span>
                            ) : null}
                            <span className="text-[10px] font-bold text-gray-400 tabular-nums">
                              {listStamp(conv.lastMessageAt)}
                            </span>
                          </span>
                        </div>

                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-medium text-gray-400 tabular-nums truncate">
                            {phoneLabel(conv.phone)}
                          </span>
                          <span
                            className={clsx(
                              'px-1.5 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider',
                              meta.chip
                            )}
                          >
                            {meta.label}
                          </span>
                          {!conv.aiEnabled ? (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                              <PauseCircle className="w-2.5 h-2.5" />
                              IA en pause
                            </span>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-gray-50 bg-gray-50/50">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest tabular-nums">
                {total} conversation{total > 1 ? 's' : ''} · page {page}/{totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white hover:text-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  aria-label="Page précédente"
                >
                  <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-180" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white hover:text-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  aria-label="Page suivante"
                >
                  <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                </button>
              </div>
            </div>
          ) : null}
        </aside>

        {/* ── RIGHT : thread ───────────────────────────────────── */}
        <section
          className={clsx(
            'flex-1 min-w-0 bg-white rounded-3xl border border-gray-100 shadow-sm flex-col overflow-hidden',
            activeId == null ? 'hidden lg:flex' : 'flex'
          )}
        >
          {!contact ? (
            threadLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 text-gray-300 flex items-center justify-center mb-4">
                  <MessageSquare className="w-7 h-7" />
                </div>
                <p className="text-sm font-bold text-gray-500">Sélectionnez une conversation</p>
                <p className="mt-1.5 text-xs font-medium text-gray-400 max-w-xs">
                  Choisissez un client dans la liste pour lire l&apos;échange et répondre.
                </p>
              </div>
            )
          ) : (
            <>
              {/* ── Thread header ──────────────────────────────── */}
              <div className="border-b border-gray-50">
                <div className="p-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveId(null)}
                    className="lg:hidden p-2 -ms-1 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
                    aria-label="Retour à la liste"
                  >
                    <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-black text-gray-900 truncate">
                        {contactLabel(contact)}
                      </h2>
                      <span
                        className={clsx(
                          'px-1.5 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider flex-shrink-0',
                          STATUS_META[contact.status].chip
                        )}
                      >
                        {STATUS_META[contact.status].label}
                      </span>
                      {contact.source === 'AD' ? (
                        <span
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-accent-50 text-accent-600 border border-accent-100 text-[9px] font-black uppercase tracking-wider flex-shrink-0"
                          title={contact.adHeadline || 'Conversation issue d’une publicité'}
                        >
                          <Megaphone className="w-2.5 h-2.5" />
                          AD
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium text-gray-400 tabular-nums">
                      <Phone className="w-3 h-3" />
                      {phoneLabel(contact.phone)}
                      {contact.lastMessageAt ? (
                        <span className="text-gray-300">
                          ·{' '}
                          {formatDistanceToNow(new Date(contact.lastMessageAt), {
                            addSuffix: true,
                            locale: fr,
                          })}
                        </span>
                      ) : null}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 ms-auto">
                    {/* IA activée / en pause */}
                    <button
                      type="button"
                      onClick={() => handleToggleAi(!contact.aiEnabled)}
                      disabled={savingContact}
                      className={clsx(
                        'inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed',
                        contact.aiEnabled
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                      )}
                      title={
                        contact.aiEnabled
                          ? "Mettre l'agent IA en pause sur cette conversation"
                          : "Laisser l'agent IA répondre à nouveau"
                      }
                    >
                      {contact.aiEnabled ? (
                        <Bot className="w-3.5 h-3.5" />
                      ) : (
                        <PauseCircle className="w-3.5 h-3.5" />
                      )}
                      {contact.aiEnabled ? 'IA activée' : 'IA en pause'}
                      {/* Flex alignment rather than a transform: `justify-end`
                          follows the reading direction, `translate-x` does not. */}
                      <span
                        className={clsx(
                          'w-8 h-4 rounded-full p-0.5 flex items-center transition-colors',
                          contact.aiEnabled ? 'bg-emerald-500 justify-end' : 'bg-gray-300 justify-start'
                        )}
                      >
                        <span className="w-3 h-3 rounded-full bg-white shadow-sm" />
                      </span>
                    </button>

                    <select
                      value={contact.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      disabled={savingContact}
                      className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-[11px] font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all disabled:opacity-50"
                      aria-label="Statut de la conversation"
                    >
                      {(Object.keys(STATUS_META) as StatusValue[]).map((value) => (
                        <option key={value} value={value}>
                          {STATUS_META[value].label}
                        </option>
                      ))}
                    </select>

                    {isBenchJid(contact.jid) ? (
                      <span
                        title="Le banc d'essai ne crée jamais de lead facturé : testez la prise de commande ici, puis vérifiez la création sur une vraie conversation."
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black uppercase tracking-wider"
                      >
                        <FlaskConical className="w-3.5 h-3.5" />
                        Banc d&apos;essai
                      </span>
                    ) : contact.leadId !== null ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-black uppercase tracking-wider tabular-nums">
                        <Sparkles className="w-3.5 h-3.5" />
                        Lead #{contact.leadId} créé
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handlePromote}
                        disabled={!canPromote || promoting}
                        title={
                          canPromote
                            ? 'Créer un lead facturé à partir de cette fiche'
                            : "La fiche client est vide : complétez-la avant de créer le lead."
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-500 text-white text-[10px] font-black uppercase tracking-wider hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        {promoting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <UserPlus className="w-3.5 h-3.5" />
                        )}
                        Créer le lead
                      </button>
                    )}
                  </div>
                </div>

                {contact.source === 'AD' && contact.adHeadline ? (
                  <div className="px-4 pb-3 -mt-1">
                    <p className="text-[10px] font-medium text-gray-400 truncate">
                      <span className="font-black uppercase tracking-wider text-accent-500">
                        Publicité :
                      </span>{' '}
                      {contact.adHeadline}
                    </p>
                  </div>
                ) : null}

                {/* ── Draft panel ──────────────────────────────── */}
                <div className="border-t border-gray-50 bg-gray-50/40">
                  <button
                    type="button"
                    onClick={() => setDraftOpen((v) => !v)}
                    className="w-full px-4 py-2.5 flex items-center gap-2 text-start"
                  >
                    <FileText className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                      Fiche client
                    </span>

                    {/* The count is what makes collapsing safe: the account can
                        see at a glance that the agent has collected something,
                        without the panel having to stay open to prove it. */}
                    {draftFilledCount > 0 ? (
                      <span className="px-1.5 py-0.5 rounded-md bg-primary-100 text-primary-700 text-[9px] font-black tabular-nums">
                        {draftFilledCount}
                      </span>
                    ) : null}

                    <span className="text-[10px] font-medium text-gray-400 truncate hidden sm:inline">
                      {draftOpen
                        ? '· ce que l’agent a collecté, et ce qui deviendra le lead'
                        : draftSummary || '· rien de collecté pour le moment'}
                    </span>
                    <ChevronDown
                      className={clsx(
                        'w-4 h-4 text-gray-400 ms-auto transition-transform',
                        draftOpen && 'rotate-180'
                      )}
                    />
                  </button>

                  {draftOpen ? (
                    <div className="px-4 pb-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {DRAFT_FIELDS.map((field) => (
                          <div
                            key={field.key}
                            className={clsx(field.kind === 'textarea' && 'sm:col-span-2 lg:col-span-3')}
                          >
                            <label
                              htmlFor={`wa-draft-${field.key}`}
                              className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1"
                            >
                              {field.label}
                            </label>
                            {field.kind === 'textarea' ? (
                              <textarea
                                id={`wa-draft-${field.key}`}
                                rows={2}
                                value={draftForm[field.key]}
                                onChange={(e) =>
                                  setDraftForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                                }
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all resize-y"
                              />
                            ) : (
                              <input
                                id={`wa-draft-${field.key}`}
                                type={field.kind === 'number' ? 'number' : 'text'}
                                inputMode={field.kind === 'number' ? 'decimal' : undefined}
                                value={draftForm[field.key]}
                                onChange={(e) =>
                                  setDraftForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                                }
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all"
                              />
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={handleSaveDraft}
                          disabled={savingDraft || contact.leadId !== null}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 text-white text-[10px] font-black uppercase tracking-wider hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          {savingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                          Enregistrer la fiche
                        </button>
                        <p className="text-[10px] font-medium text-gray-400">
                          {contact.leadId !== null
                            ? 'Le lead est déjà créé : modifiez-le depuis la page Leads.'
                            : 'Corrigez ce que l’agent a mal compris avant de créer le lead.'}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* ── Messages ───────────────────────────────────── */}
              <div
                ref={scrollRef}
                onScroll={handleThreadScroll}
                className="flex-1 overflow-y-auto px-4 py-5 space-y-3 bg-gray-50/40"
              >
                {threadLoading ? (
                  <div className="py-12 text-center">
                    <Loader2 className="w-5 h-5 text-primary-500 animate-spin mx-auto" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-12 text-center">
                    <MessageSquare className="w-7 h-7 text-gray-200 mx-auto mb-2" />
                    <p className="text-[11px] font-bold text-gray-400">
                      Aucun message dans cette conversation.
                    </p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <MessageBubble key={message.id} message={message} media={media[message.id]} />
                  ))
                )}
              </div>

              {/* ── Composer ───────────────────────────────────── */}
              <div className="border-t border-gray-50 p-4 space-y-3">
                {justPaused && !contact.aiEnabled ? (
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
                    <PauseCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    <p className="text-[11px] font-bold text-amber-700">
                      L&apos;agent IA a été mis en pause sur cette conversation — c&apos;est vous qui
                      répondez maintenant.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleToggleAi(true)}
                      disabled={savingContact}
                      className="ms-auto px-2.5 py-1 rounded-lg bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider hover:bg-amber-600 disabled:opacity-50 transition-all"
                    >
                      Réactiver l&apos;IA
                    </button>
                  </div>
                ) : null}

                {composerBlockReason ? (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-rose-50 border border-rose-100">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] font-bold text-rose-600">{composerBlockReason}</p>
                  </div>
                ) : null}

                <div className="flex items-end gap-2">
                  <textarea
                    rows={2}
                    value={outgoing}
                    onChange={(e) => setOutgoing(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    disabled={!sessionConnected || sending}
                    maxLength={4000}
                    placeholder={
                      sessionConnected
                        ? 'Écrivez votre message… (Entrée pour envoyer, Maj+Entrée pour un retour à la ligne)'
                        : 'Envoi indisponible : la session WhatsApp est déconnectée.'
                    }
                    className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-medium text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!sessionConnected || sending || !outgoing.trim()}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-primary-500 text-white text-xs font-black uppercase tracking-wider hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 rtl:rotate-180" />
                    )}
                    <span className="hidden sm:inline">Envoyer</span>
                  </button>
                </div>

                {isBenchJid(contact.jid) ? (
                  <p className="text-[10px] font-medium text-amber-600">
                    Banc d&apos;essai : ce que vous écrivez ici arrive à l&apos;agent COMME UN
                    MESSAGE CLIENT, et il y répond. Rien ne part sur WhatsApp, et chaque réponse
                    consomme un crédit comme une vraie.
                  </p>
                ) : (
                  <p className="text-[10px] font-medium text-gray-400">
                    Envoyer un message met automatiquement l&apos;agent IA en pause sur cette
                    conversation, pour éviter deux réponses en même temps.
                  </p>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* message bubble                                                      */
/* ------------------------------------------------------------------ */

function MessageBubble({ message, media }: { message: WaMessage; media?: MediaEntry }) {
  const isOut = message.direction === 'OUT';
  const date = new Date(message.createdAt);
  const validDate = !Number.isNaN(date.getTime());

  return (
    <div
      className={clsx(
        'flex flex-col gap-1 max-w-[85%] sm:max-w-[72%]',
        isOut ? 'ms-auto items-end text-end' : 'me-auto items-start text-start'
      )}
    >
      <div
        className={clsx(
          'rounded-2xl px-3.5 py-2.5 border shadow-sm w-fit max-w-full',
          isOut
            ? 'bg-primary-500 text-white border-primary-500'
            : 'bg-white text-gray-800 border-gray-100'
        )}
      >
        <Attachment message={message} media={media} isOut={isOut} />

        {message.body ? (
          <p className="text-[13px] font-medium leading-relaxed whitespace-pre-wrap break-words">
            {message.body}
          </p>
        ) : null}

        {!message.body && message.kind === 'TEXT' ? (
          <p className={clsx('text-[12px] font-medium italic', isOut ? 'text-white/60' : 'text-gray-400')}>
            Message vide
          </p>
        ) : null}

        {/* An INBOUND voice note the STT model has read — the transcript is the
            only way the account can see what the customer said.

            Never shown when it merely repeats the bubble's own text. An
            outbound note's words are the source we spoke, already rendered
            above, and showing them again under a TRANSCRIT label made every
            spoken reply appear twice. */}
        {message.kind === 'AUDIO' &&
        message.transcribed &&
        message.transcript &&
        message.transcript.trim() !== (message.body || '').trim() ? (
          <div
            className={clsx(
              'mt-2 pt-2 border-t',
              isOut ? 'border-white/20' : 'border-gray-100'
            )}
          >
            <span
              className={clsx(
                'inline-block px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider mb-1',
                isOut ? 'bg-white/15 text-white/80' : 'bg-gray-100 text-gray-500'
              )}
            >
              transcrit
            </span>
            <p
              className={clsx(
                'text-[12px] font-medium leading-relaxed whitespace-pre-wrap break-words',
                isOut ? 'text-white/85' : 'text-gray-600'
              )}
            >
              {message.transcript}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 px-1">
        {isOut ? (
          <span
            className={clsx(
              'px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider',
              message.fromAgent
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-primary-50 text-primary-600'
            )}
          >
            {message.fromAgent ? 'Agent' : 'Vous'}
          </span>
        ) : null}
        <span
          className="text-[9px] font-bold text-gray-400 tabular-nums"
          title={validDate ? format(date, "d MMMM yyyy 'à' HH:mm", { locale: fr }) : undefined}
        >
          {validDate ? format(date, 'HH:mm') : ''}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* attachment                                                          */
/* ------------------------------------------------------------------ */

function Attachment({
  message,
  media,
  isOut,
}: {
  message: WaMessage;
  media?: MediaEntry;
  isOut: boolean;
}) {
  if (message.kind === 'TEXT') return null;

  const shellClass = clsx(
    'flex items-center gap-2 px-3 py-4 rounded-xl mb-2 text-[11px] font-bold',
    isOut ? 'bg-white/10 text-white/70' : 'bg-gray-50 text-gray-400'
  );

  if (!media || media.state === 'loading') {
    return (
      <div className={shellClass}>
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Chargement de la pièce jointe…
      </div>
    );
  }

  if (media.state === 'error') {
    return (
      <div className={shellClass}>
        <AlertTriangle className="w-3.5 h-3.5" />
        Pièce jointe indisponible
      </div>
    );
  }

  if (message.kind === 'IMAGE' || message.kind === 'STICKER') {
    return (
      <img
        src={media.url}
        alt="Pièce jointe"
        className={clsx(
          'rounded-xl mb-2 max-w-full h-auto',
          message.kind === 'STICKER' ? 'max-h-32 w-auto' : 'max-h-72'
        )}
      />
    );
  }

  if (message.kind === 'VIDEO') {
    return <video src={media.url} controls className="rounded-xl mb-2 max-w-full max-h-72" />;
  }

  if (message.kind === 'AUDIO') {
    return <audio src={media.url} controls className="mb-2 w-full min-w-[220px] max-w-[280px]" />;
  }

  return (
    <a
      href={media.url}
      target="_blank"
      rel="noreferrer"
      className={clsx(
        'inline-flex items-center gap-2 px-3 py-2 rounded-xl mb-2 text-[11px] font-bold transition-colors',
        isOut
          ? 'bg-white/10 text-white hover:bg-white/20'
          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
      )}
    >
      <FileText className="w-3.5 h-3.5" />
      Ouvrir le document
    </a>
  );
}

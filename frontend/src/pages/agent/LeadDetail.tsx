import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { leadsApi } from '../../lib/api';
import { useSocket } from '../../contexts/SocketContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { buildReferralUrl } from '../../utils/referral';
import {
  checkMoroccanPhone,
  formatMoroccanPhone,
  checkFullName,
  checkAddress,
} from '../../utils/leadValidation';
import {
  Eye, History, AlertTriangle, CheckCircle, XCircle,
  Package, ShieldAlert, Clock, Info, Phone, X,
  TrendingUp, TrendingDown, User, Store, Check, MessageSquare, Copy, Pencil
} from 'lucide-react';
import { normalizeSearch } from '../../utils/search';

const DEFAULT_UNASSIGN_MESSAGE = "Ce lead ne vous est plus assigné.";

/** Why the lead left this agent — mirrors LeadUnassignReason on the server. */
const UNASSIGN_MESSAGES: Record<string, string> = {
  FORCE_CLAIMED: "Ce lead vient d'être réclamé par un autre agent.",
  REASSIGNED: "Ce lead a été réassigné à un autre agent.",
  TIMEOUT_IDLE: "Temps écoulé : le lead a été libéré automatiquement pour inactivité.",
  TIMEOUT_STATUS: "Délai expiré : le lead a été libéré automatiquement.",
  EXPIRED: "Ce lead a expiré et a été remis dans le pool.",
};

/** Customer-card fields an agent can correct in place while on the call. */
type EditableFieldKey = 'fullName' | 'phone' | 'city' | 'address';

/**
 * Coliaty only accepts a local 10-digit number (06…/05…/07…), so the delivery
 * form normalises as the agent types instead of rejecting on submit.
 */
const toColiatyPhone = (input: string): string => {
  let cleaned = (input || '').trim().replace(/\s+/g, '');
  if (cleaned.startsWith('+212')) cleaned = '0' + cleaned.slice(4);
  else if (cleaned.startsWith('212')) cleaned = '0' + cleaned.slice(3);
  else if (cleaned.length > 0 && !cleaned.startsWith('0')) cleaned = '0' + cleaned;
  return cleaned.replace(/\D/g, '').slice(0, 10);
};

/**
 * Price of the pack the customer picked on the landing page, or null when the
 * lead has no variant or the landing page carries no pack pricing. The courier
 * must collect the pack price, not the product's retail price.
 */
const resolveVariantPrice = (lead: any): number | null => {
  if (!lead?.productVariant || !lead?.referralLink?.landingPage?.customStructure) return null;
  try {
    const structure = typeof lead.referralLink.landingPage.customStructure === 'string'
      ? JSON.parse(lead.referralLink.landingPage.customStructure)
      : lead.referralLink.landingPage.customStructure;
    const checkoutBlock = (structure.blocks || []).find((b: any) => b.type === 'express_checkout');
    if (!checkoutBlock) return null;
    const selected = (checkoutBlock.content?.options || []).find((o: any) => o.name === lead.productVariant);
    return selected?.price ?? null;
  } catch (e) {
    return null;
  }
};

/**
 * Maps a free-text city onto its official Coliaty spelling, or '' when there is
 * no match — a parcel cannot be created for a city Coliaty does not know.
 */
const resolveColiatyCity = (rawCity: string, cities: any[]): string => {
  const value = (rawCity || '').trim().toLowerCase();
  if (!value || cities.length === 0) return '';
  const exact = cities.find((c) => (c.city_name || '').trim().toLowerCase() === value);
  return exact ? exact.city_name : '';
};

const STATUS_LABELS: Record<string, { label: string, icon: string, color: string, ring: string }> = {
  NEW: { label: 'Nouveau', icon: '🆕', color: 'bg-blue-100 text-blue-800', ring: 'bg-blue-500' },
  AVAILABLE: { label: 'Disponible', icon: '🟢', color: 'bg-emerald-100 text-emerald-800', ring: 'bg-emerald-500' },
  ASSIGNED: { label: 'Assigné', icon: '👤', color: 'bg-amber-100 text-amber-800', ring: 'bg-amber-500' },
  CALL_LATER: { label: 'Rappel demandé', icon: '📞', color: 'bg-blue-100 text-blue-800', ring: 'bg-blue-500' },
  NO_REPLY: { label: 'Pas de réponse', icon: '📵', color: 'bg-gray-100 text-gray-800', ring: 'bg-gray-500' },
  CONFIRMED: { label: 'Confirmé', icon: '✅', color: 'bg-green-100 text-green-800', ring: 'bg-green-500' },
  WRONG_ORDER: { label: 'Mauvaise commande', icon: '⚠️', color: 'bg-amber-100 text-amber-800', ring: 'bg-amber-500' },
  CANCEL_REASON_PRICE: { label: 'Annulé (Prix)', icon: '💰', color: 'bg-gray-100 text-gray-800', ring: 'bg-gray-500' },
  CANCEL_ORDER: { label: 'Annulé', icon: '❌', color: 'bg-red-100 text-red-800', ring: 'bg-red-500' },
  CONTACTED: { label: 'Contacté', icon: '📞', color: 'bg-blue-100 text-blue-800', ring: 'bg-blue-500' },
  INTERESTED: { label: 'Intéressé', icon: '✅', color: 'bg-green-100 text-green-800', ring: 'bg-green-500' },
  ORDERED: { label: 'Commandé', icon: '🛒', color: 'bg-emerald-100 text-emerald-800', ring: 'bg-emerald-600' },
  INVALID: { label: 'Invalide', icon: '🚫', color: 'bg-red-100 text-red-800', ring: 'bg-red-600' },
  PRICE_CONFIRMED: { label: 'price CONFIRMED', icon: '💰', color: 'bg-blue-100 text-blue-800', ring: 'bg-blue-500' },
  PRICE_REJECTED: { label: 'price rejected', icon: '💰', color: 'bg-red-100 text-red-800', ring: 'bg-red-500' },
};

export default function AgentLeadDetail() {
  const [theme, setTheme] = useState<'classic' | 'girly' | 'princess'>(() => {
    return (localStorage.getItem('agent-theme') as 'classic' | 'girly' | 'princess') || 'girly';
  });

  const changeTheme = (next: 'classic' | 'girly' | 'princess') => {
    setTheme(next);
    localStorage.setItem('agent-theme', next);
    window.dispatchEvent(new Event('agent-theme-change'));
  };

  useEffect(() => {
    const syncTheme = () => {
      const current = (localStorage.getItem('agent-theme') as 'classic' | 'girly' | 'princess') || 'girly';
      setTheme(current);
    };
    window.addEventListener('agent-theme-change', syncTheme);
    return () => window.removeEventListener('agent-theme-change', syncTheme);
  }, []);

  const isClassic = theme === 'classic';
  const isGirly = theme === 'girly';
  const isPrincess = theme === 'princess';

  /** Focus-ring colour for inline editors, matching the active agent theme. */
  const accentRing = isPrincess ? 'focus:ring-amber-400' : isGirly ? 'focus:ring-pink-400' : 'focus:ring-indigo-500';
  /** Highlight for the currently selected row in the city dropdown. */
  const citySelectedClass = isPrincess
    ? 'bg-amber-50 text-amber-700 font-bold'
    : isGirly
    ? 'bg-pink-50 text-pink-700 font-bold'
    : 'bg-indigo-50 text-indigo-700 font-bold';

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { socket } = useSocket();
  // Latches once the page has evicted itself, so the socket event and the
  // focus re-check can't both fire a toast + navigation for the same event.
  const hasLeftRef = useRef(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState('');
  const [editedAddress, setEditedAddress] = useState('');
  const [editedCity, setEditedCity] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressSavedAt, setAddressSavedAt] = useState<number | null>(null);
  // Last values known to be persisted — used to skip redundant auto-saves.
  const savedAddressRef = useRef<{ address: string; city: string }>({ address: '', city: '' });
  // Serialises auto-saves so a city pick and an address blur can never race.
  const addressQueueRef = useRef<Promise<any>>(Promise.resolve());
  const [coliatyCities, setColiatyCities] = useState<any[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [citySearch, setCitySearch] = useState('');

  // ── Inline editing of the customer card ──────────────────────────────────
  const [editingField, setEditingField] = useState<EditableFieldKey | null>(null);
  const [fieldDraft, setFieldDraft] = useState('');
  const [savingField, setSavingField] = useState<EditableFieldKey | null>(null);
  const [savedField, setSavedField] = useState<EditableFieldKey | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  // Set by Escape so the input's blur handler does not save what was cancelled.
  const cancelEditRef = useRef(false);

  const [clickedWaLeads, setClickedWaLeads] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem('agent_clicked_wa_leads');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (e) {
      return new Set();
    }
  });

  // Persist the contact attempt server-side (localStorage stays for instant UI feedback)
  const recordContactClick = (leadId: number, channel: 'WHATSAPP' | 'CALL') => {
    leadsApi.recordContactClick(leadId, channel).catch(console.error);
  };

  const handleWaClick = (leadId: number) => {
    recordContactClick(leadId, 'WHATSAPP');
    setClickedWaLeads((prev) => {
      const next = new Set(prev);
      next.add(leadId);
      try {
        localStorage.setItem('agent_clicked_wa_leads', JSON.stringify(Array.from(next)));
      } catch (e) {
        console.error(e);
      }
      return next;
    });

    try {
      if (data?.lead && data?.lead?.status === 'ASSIGNED') {
        leadsApi.updateStatus(String(leadId), { status: 'CONTACTED' }).then(() => {
          loadDetail();
        }).catch(console.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Click-outside now lives inside CityPicker, so each instance closes itself.

  const fetchColiatyCities = async (): Promise<any[]> => {
    setLoadingCities(true);
    try {
      const res = await leadsApi.getColiatyCities();
      const list = res.data?.data || [];
      setColiatyCities(list);
      return list;
    } catch (err) {
      console.error('Failed to load Coliaty cities');
      return [];
    } finally {
      setLoadingCities(false);
    }
  };
  const [callbackDate, setCallbackDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [callbackHour, setCallbackHour] = useState<string>(format(new Date(), 'HH'));
  const [callbackMinute, setCallbackMinute] = useState<string>(format(new Date(), 'mm'));
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyData, setHistoryData] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [requestedPriceInput, setRequestedPriceInput] = useState('');
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [globalCooldown, setGlobalCooldown] = useState<number>(0);

  // ── Coliaty confirmation ─────────────────────────────────────────────────
  // CONFIRMED goes through this form so the delivery details are locked in on
  // the call. It only saves and confirms — the parcel is created afterwards from
  // "Mes Leads Assignés".
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [savingConfirmation, setSavingConfirmation] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({
    name: '',
    phone: '',
    city: '',
    address: '',
    price: 0,
    productVariant: '',
    note: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const isAssigned = data?.lead?.status === 'ASSIGNED';
    const isWrongOrder = data?.lead?.status === 'WRONG_ORDER';
    const isCancelOrder = data?.lead?.status === 'CANCEL_ORDER';

    if (isAssigned || isWrongOrder || isCancelOrder) {
      const storageKey = `lead_cooldown_${data.lead.id}`;
      let savedStart = sessionStorage.getItem(storageKey);
      
      const leadUpdatedAt = data?.lead?.updatedAt ? new Date(data.lead.updatedAt).getTime() : 0;
      const isShortTimeout = isWrongOrder || isCancelOrder;
      const totalCooldownSeconds = isShortTimeout ? 120 : 420; // 2 minutes for short timeouts, 7 minutes for ASSIGNED
      
      // Check if sessionStorage is stale or NaN:
      if (savedStart) {
        const parsedStart = parseInt(savedStart, 10);
        if (isNaN(parsedStart)) {
          sessionStorage.removeItem(storageKey);
          savedStart = null;
        } else if (isShortTimeout && (!isNaN(leadUpdatedAt) && leadUpdatedAt - parsedStart > 5000)) {
           sessionStorage.removeItem(storageKey);
           savedStart = null;
        } else if (Date.now() - parsedStart > totalCooldownSeconds * 1000 || (!isNaN(leadUpdatedAt) && parsedStart < leadUpdatedAt - 5000)) {
          sessionStorage.removeItem(storageKey);
          savedStart = null;
        }
      }

      let parsedStartVal = savedStart ? parseInt(savedStart, 10) : NaN;
      const startTime = !isNaN(parsedStartVal) ? parsedStartVal : Date.now();
      
      if (isNaN(parsedStartVal)) {
        sessionStorage.setItem(storageKey, startTime.toString());
      }

      const calculateRemaining = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        return isNaN(elapsed) ? 0 : Math.max(0, 30 - elapsed);
      };

      const calculateGlobal = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        return isNaN(elapsed) ? 0 : Math.max(0, totalCooldownSeconds - elapsed);
      };

      setCooldownRemaining(calculateRemaining());
      setGlobalCooldown(calculateGlobal());

      const interval = setInterval(() => {
        const remaining = calculateRemaining();
        const globalRemaining = calculateGlobal();
        
        setCooldownRemaining(remaining);
        setGlobalCooldown(globalRemaining);
        
        if (globalRemaining <= 0) {
          clearInterval(interval);
          // This countdown only *predicts* the server's auto-unassign cron; the
          // two drift, so it used to evict agents who still held the lead. Now
          // it asks the server, and the socket handles the real event anyway —
          // this is just the backstop for a dropped connection.
          void (async () => {
            if (hasLeftRef.current || await stillOwnsLead()) return;
            leaveLead(
              isWrongOrder ? "Délai expiré : Le lead erroné a été libéré automatiquement."
                : isCancelOrder ? "Délai expiré : Le lead annulé a été libéré automatiquement."
                  : "Temps écoulé : Le lead a été réassigné automatiquement."
            );
          })();
        }
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setCooldownRemaining(0);
      setGlobalCooldown(0);
      if (data?.lead?.id) {
        sessionStorage.removeItem(`lead_cooldown_${data.lead.id}`);
      }
    }
  }, [data?.lead?.status, data?.lead?.id]);

  useEffect(() => {
    loadDetail();
    fetchColiatyCities();
  }, [id]);

  useEffect(() => {
    if (!addressSavedAt) return;
    const timer = setTimeout(() => setAddressSavedAt(null), 2500);
    return () => clearTimeout(timer);
  }, [addressSavedAt]);

  const loadDetail = async () => {
    try {
      const res = await leadsApi.detail(Number(id));
      const d = res.data?.data || res.data;
      setData(d);
      setNotes(d?.lead?.notes || '');
      setEditedAddress(d?.lead?.address || '');
      setEditedCity(d?.lead?.city || '');
      setCitySearch(d?.lead?.city || '');
      savedAddressRef.current = {
        address: (d?.lead?.address || '').trim(),
        city: (d?.lead?.city || '').trim()
      };
    } catch (err: any) {
      toast.error('Lead introuvable');
      navigate('/agent/leads');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Close the page and go back to the list.
   *
   * Guarded by a ref because the socket event and the focus re-check can both
   * fire for the same unassignment — without it the agent gets two toasts and
   * two navigations.
   */
  const leaveLead = useCallback((message: string) => {
    if (hasLeftRef.current) return;
    hasLeftRef.current = true;
    if (id) sessionStorage.removeItem(`lead_cooldown_${id}`);
    toast.error(message, { id: 'lead-unassigned', duration: 6000 });
    navigate('/agent/leads', { replace: true });
  }, [id, navigate]);

  /**
   * Is this lead still ours? The detail endpoint answers with 403 for an agent
   * the moment `assignedAgentId` stops matching, so a bare re-fetch is the
   * cheapest authoritative check available.
   */
  const stillOwnsLead = useCallback(async (): Promise<boolean> => {
    try {
      await leadsApi.detail(Number(id));
      return true;
    } catch (err: any) {
      const status = err?.response?.status;
      // Only 403/404 mean "not yours" — a network blip must not evict the agent.
      return !(status === 403 || status === 404);
    }
  }, [id]);

  /**
   * Live eviction. A lead can leave an agent's hands at any moment: another
   * agent force-claims it, an admin reassigns it, or the auto-unassign cron
   * reclaims it. This page would otherwise keep showing a customer the agent is
   * no longer allowed to call, until some later action failed with a 403.
   */
  useEffect(() => {
    if (!socket || !id) return;

    const onUnassigned = (payload: { leadId: number | string; reason?: string; byAgent?: string }) => {
      if (Number(payload.leadId) !== Number(id)) return;
      leaveLead(UNASSIGN_MESSAGES[payload.reason || ''] || DEFAULT_UNASSIGN_MESSAGE);
    };

    socket.on('lead-unassigned', onUnassigned);
    return () => { socket.off('lead-unassigned', onUnassigned); };
  }, [socket, id, leaveLead]);

  /**
   * Fallback for a socket that was down when the event fired — rooms don't
   * buffer, so a disconnected client simply never hears it. Re-checking when the
   * tab regains focus catches those without polling.
   */
  useEffect(() => {
    if (!id) return;

    const verify = async () => {
      if (hasLeftRef.current || document.visibilityState !== 'visible') return;
      if (!(await stillOwnsLead())) leaveLead(DEFAULT_UNASSIGN_MESSAGE);
    };

    window.addEventListener('focus', verify);
    document.addEventListener('visibilitychange', verify);
    return () => {
      window.removeEventListener('focus', verify);
      document.removeEventListener('visibilitychange', verify);
    };
  }, [id, leaveLead, stillOwnsLead]);

  /**
   * Persists the address/city silently. Called on city pick, on address blur, and
   * flushed once more right before any status change so nothing typed is ever lost.
   * No-ops when the values already match what is stored.
   */
  const persistAddressCity = (nextAddress: string, nextCity: string) => {
    const leadId = data?.lead?.id;
    if (!leadId) return Promise.resolve();

    const address = (nextAddress || '').trim();
    const city = (nextCity || '').trim();

    const run = (async () => {
      // Wait for any save already in flight so the newest value always wins.
      await addressQueueRef.current;

      if (address === savedAddressRef.current.address && city === savedAddressRef.current.city) {
        return;
      }

      setSavingAddress(true);
      try {
        await leadsApi.update(String(leadId), { address, city });
        savedAddressRef.current = { address, city };
        setData((prev: any) => (prev ? { ...prev, lead: { ...prev.lead, address, city } } : prev));
        setAddressSavedAt(Date.now());
      } catch (err: any) {
        toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement de l'adresse");
        throw err;
      } finally {
        setSavingAddress(false);
      }
    })();

    addressQueueRef.current = run.catch(() => {});
    return run;
  };

  /**
   * Saves a single customer field (name / phone) inline.
   *
   * Queued behind addressQueueRef so it can never interleave with an address
   * auto-save on the same lead. The server's returned lead is preferred over the
   * submitted patch because the API normalises phone numbers (0… -> +212…), and
   * echoing the raw input would show a value the database does not hold.
   */
  const persistLeadField = async (patch: Record<string, string | number | null>) => {
    const leadId = data?.lead?.id;
    if (!leadId) return;

    const run = (async () => {
      await addressQueueRef.current;
      const res = await leadsApi.update(String(leadId), patch);
      const updated = res?.data?.data?.lead;
      setData((prev: any) =>
        prev ? { ...prev, lead: { ...prev.lead, ...(updated ?? patch) } } : prev
      );
    })();

    addressQueueRef.current = run.catch(() => {});
    return run;
  };

  const startFieldEdit = (key: EditableFieldKey, current: string) => {
    cancelEditRef.current = false;
    setFieldError(null);
    setEditingField(key);
    // Phones are stored as +212… but agents read and dictate 06… form.
    setFieldDraft(key === 'phone' ? formatMoroccanPhone(current) : (current ?? ''));
  };

  const cancelFieldEdit = () => {
    cancelEditRef.current = true;
    setFieldError(null);
    setEditingField(null);
  };

  /** Returns an error message, or null when the value is acceptable. */
  const validateField = (key: EditableFieldKey, value: string): string | null => {
    if (key === 'fullName') return checkFullName(value).reason ?? null;
    if (key === 'phone') return checkMoroccanPhone(value).reason ?? null;
    if (key === 'address') return checkAddress(value).reason ?? null;
    if (key === 'city' && !value.trim()) return 'La ville est obligatoire pour la livraison.';
    return null;
  };

  /**
   * @param explicitValue bypasses `fieldDraft` for a dropdown pick, whose click
   * handler runs before the state update it triggers has been applied.
   */
  const commitFieldEdit = async (key: EditableFieldKey, explicitValue?: string) => {
    // Escape already closed the editor; the trailing blur must not save.
    if (cancelEditRef.current) {
      cancelEditRef.current = false;
      return;
    }

    const next = (explicitValue ?? fieldDraft).trim();
    const current = (
      key === 'fullName' ? data?.lead?.fullName
      : key === 'phone' ? data?.lead?.phone
      : key === 'city' ? editedCity
      : editedAddress
    ) ?? '';

    // Compare phones in canonical form so "0612345678" is recognised as equal to
    // the stored "+212612345678" and does not trigger a pointless write.
    const unchanged =
      key === 'phone'
        ? (checkMoroccanPhone(next).e164 ?? next) === (current ?? '').trim()
        : next === (current ?? '').trim();

    if (unchanged) {
      setFieldError(null);
      setEditingField(null);
      return;
    }

    const error = validateField(key, next);
    if (error) {
      // Keep the editor open so the agent can fix the value in place rather than
      // losing it and having to retype from the customer's dictation.
      setFieldError(error);
      setEditingField(key);
      return;
    }

    setFieldError(null);
    setEditingField(null);

    setSavingField(key);
    try {
      if (key === 'city') {
        setEditedCity(next);
        setCitySearch(next);
        await persistAddressCity(editedAddress, next);
      } else if (key === 'address') {
        setEditedAddress(next);
        await persistAddressCity(next, editedCity);
      } else if (key === 'phone') {
        // Send the canonical form; the API's own 0->+212 rewrite only handles
        // one of the several shapes an agent may type.
        await persistLeadField({ phone: checkMoroccanPhone(next).e164! });
      } else {
        await persistLeadField({ [key]: next });
      }
      setSavedField(key);
      setTimeout(() => setSavedField((k) => (k === key ? null : k)), 2000);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur lors de l'enregistrement");
    } finally {
      setSavingField((k) => (k === key ? null : k));
    }
  };

  /**
   * Whether the typed city matches an official Coliaty city.
   *
   * 'unknown' is deliberate: when the Coliaty list failed to load or is still
   * loading, `coliatyCities` is empty, and calling every city "unrecognised"
   * would be a false alarm on what is really a network problem.
   */
  const cityMatch: 'empty' | 'unknown' | 'matched' | 'unmatched' = useMemo(() => {
    const value = (editedCity || '').trim().toLowerCase();
    if (!value) return 'empty';
    if (loadingCities || coliatyCities.length === 0) return 'unknown';
    return coliatyCities.some((c) => (c.city_name || '').trim().toLowerCase() === value)
      ? 'matched'
      : 'unmatched';
  }, [editedCity, coliatyCities, loadingCities]);

  /**
   * The listed price of the pack currently typed in the form — what the customer
   * would pay without negotiation. The agent can overwrite the amount to collect;
   * this is only the reference shown next to it.
   */
  const packPrice = useMemo(
    () => Number(
      resolveVariantPrice({ ...data?.lead, productVariant: deliveryForm.productVariant })
        ?? data?.product?.retailPrice
        ?? 0
    ),
    [data?.lead, data?.product, deliveryForm.productVariant]
  );

  /**
   * Free text in the modal's city box. Kept apart from `deliveryForm.city`,
   * which only ever holds an official Coliaty city — what is typed is a search,
   * what is stored is a validated choice.
   */
  const [modalCitySearch, setModalCitySearch] = useState('');

  /** Same four states as the address card, evaluated on the modal's input. */
  const modalCityMatch: 'empty' | 'unknown' | 'matched' | 'unmatched' = useMemo(() => {
    const value = (modalCitySearch || '').trim();
    if (!value) return 'empty';
    if (loadingCities || coliatyCities.length === 0) return 'unknown';
    return resolveColiatyCity(value, coliatyCities) ? 'matched' : 'unmatched';
  }, [modalCitySearch, coliatyCities, loadingCities]);

  /** ✅ CONFIRMED opens the delivery form pre-filled from the (possibly edited) lead. */
  const openDeliveryModal = async () => {
    const current = data?.lead;
    if (!current) return;
    const rawCity = editedCity || current.city;
    setFormErrors({});
    // Show what the lead actually holds, so an unrecognised city is visible and
    // correctable rather than silently blank.
    setModalCitySearch(rawCity || '');
    setDeliveryForm({
      name: current.fullName || '',
      phone: toColiatyPhone(current.phone || ''),
      city: resolveColiatyCity(rawCity, coliatyCities),
      address: editedAddress || current.address || '',
      // A price already agreed on a previous call wins over the pack's listed one.
      price: Number(current.confirmedPriceMad ?? packPrice ?? 0),
      productVariant: current.productVariant || '',
      // The agent's call notes are what the courier actually needs on the parcel.
      note: notes || current.notes || '',
    });
    setShowDeliveryModal(true);

    // The list is fetched on mount; retry here so a load that failed then does not
    // leave the agent facing an empty city picker with no way to confirm.
    if (coliatyCities.length === 0 && !loadingCities) {
      const cities = await fetchColiatyCities();
      const resolved = resolveColiatyCity(rawCity, cities);
      if (resolved) {
        setModalCitySearch(resolved);
        setDeliveryForm((prev) => ({ ...prev, city: resolved }));
      }
    }
  };

  const validateDeliveryForm = () => {
    const errors: Record<string, string> = {};

    if (!deliveryForm.name || deliveryForm.name.trim().length < 3) {
      errors.name = 'Le nom doit contenir au moins 3 caractères.';
    }

    const phoneDigits = deliveryForm.phone.replace(/\D/g, '');
    if (!phoneDigits.startsWith('0') || phoneDigits.length !== 10) {
      errors.phone = 'Le téléphone doit être au format 0612345678 (10 chiffres).';
    }

    if (!deliveryForm.city) {
      errors.city = 'La ville est obligatoire.';
    }

    if (!deliveryForm.address || deliveryForm.address.trim().length < 10) {
      errors.address = "L'adresse doit être détaillée (min. 10 caractères).";
    }

    if (!Number.isFinite(deliveryForm.price) || deliveryForm.price < 0) {
      errors.price = 'Le prix doit être supérieur ou égal à 0.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Confirms the lead — it does NOT create the parcel.
   *
   * The form is where the agent locks in what the courier will need (recipient,
   * an official Coliaty city, a full address, the pack, the note). Those are
   * written onto the lead first, then the status goes to CONFIRMED. The parcel
   * itself is created later from "Mes Leads Assignés", one lead or the whole
   * selection at a time, using exactly what was saved here.
   */
  const handleConfirmDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.lead) return;

    if (!validateDeliveryForm()) {
      toast.error('Veuillez corriger les erreurs dans le formulaire.');
      return;
    }

    setSavingConfirmation(true);
    try {
      // Mirror the modal values into the inline editors, so the card and the
      // saved lead cannot disagree if the confirmation then fails.
      setEditedAddress(deliveryForm.address);
      setEditedCity(deliveryForm.city);
      setCitySearch(deliveryForm.city);
      try {
        await persistAddressCity(deliveryForm.address, deliveryForm.city);
        await persistLeadField({
          fullName: deliveryForm.name.trim(),
          phone: deliveryForm.phone,
          productVariant: deliveryForm.productVariant.trim(),
          confirmedPriceMad: deliveryForm.price,
        });
      } catch (err: any) {
        toast.error(
          err?.response?.data?.message ||
            "Lead non confirmé : les informations de livraison n'ont pas pu être enregistrées."
        );
        return;
      }

      // The note typed here is what the courier reads, so it becomes the lead's
      // notes — which is also what the push sends to Coliaty.
      setNotes(deliveryForm.note);
      await leadsApi.updateStatus(String(id), { status: 'CONFIRMED', notes: deliveryForm.note });

      try {
        const audio = new Audio('/soundes/correct-confirmation.mp3');
        audio.volume = 0.85;
        audio.play().catch(() => {});
      } catch (e) {}

      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('📈 Statut du lead mis à jour : CONFIRMÉ', {
            body: `Le lead de ${data.lead.fullName || 'Client'} est confirmé et prêt à être envoyé à la livraison.`,
            icon: '/new logo/logo filess-25.svg',
          });
        } catch (e) {}
      }

      toast.success(isGirly ? 'Lead confirmé ! Prêt pour la livraison 🎀' : 'Lead confirmé ! Prêt pour la livraison.');
      setShowDeliveryModal(false);
      sessionStorage.removeItem(`lead_cooldown_${id}`);
      navigate('/agent/leads');
    } catch (err: any) {
      console.error('[Lead confirm error]', err.response?.data);
      toast.error(err.response?.data?.message || 'Erreur lors de la confirmation du lead');
    } finally {
      setSavingConfirmation(false);
    }
  };

  const handleUpdateStatus = async (status: string, extra?: any) => {
    setUpdating(true);
    try {
      // Flush any pending address/city edit first — the agent often types the
      // corrected address and clicks a result button without leaving the field.
      try {
        await persistAddressCity(editedAddress, editedCity);
      } catch (err) {
        // persistAddressCity already surfaced the reason.
        toast.error("Statut non modifié : l'adresse n'a pas pu être enregistrée.");
        return;
      }

      await leadsApi.updateStatus(String(id), { status, notes, ...extra });

      if (['CONFIRMED', 'PRICE_CONFIRMED'].includes(status)) {
        try {
          const audio = new Audio('/soundes/correct-confirmation.mp3');
          audio.volume = 0.85;
          audio.play().catch(() => {});
        } catch (e) {}

        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('📈 Statut du lead mis à jour : CONFIRMÉ', {
              body: `Le lead de ${lead?.fullName || 'Client'} pour le produit "${product?.nameFr || product?.nameAr || 'Produit'}" est maintenant CONFIRMÉ.`,
              icon: '/new logo/logo filess-25.svg',
            });
          } catch (e) {}
        }
      }

      if (['CANCEL_ORDER', 'CANCEL_REASON_PRICE', 'INVALID', 'PRICE_REJECTED'].includes(status)) {
        try {
          const audio = new Audio('/soundes/error.mp3');
          audio.volume = 0.85;
          audio.play().catch(() => {});
        } catch (e) {}
      }

      toast.success(`Statut mis à jour: ${status}`);
      
      // Only clear timer if we're navigating away immediately (so the new status isn't tracked)
      if (id && ['CALL_LATER', 'NO_REPLY', 'CONFIRMED', 'CANCEL_REASON_PRICE', 'INVALID', 'CANCEL_ORDER', 'WRONG_ORDER'].includes(status)) {
        sessionStorage.removeItem(`lead_cooldown_${id}`);
      }

      if (['CALL_LATER', 'NO_REPLY', 'CONFIRMED', 'CANCEL_REASON_PRICE', 'INVALID', 'CANCEL_ORDER', 'WRONG_ORDER'].includes(status)) {
        navigate('/agent/leads');
      } else {
        loadDetail();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la mise à jour du statut');
      if (err.response?.status === 404) {
        navigate('/agent/leads');
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleViewHistory = async () => {
    if (!lead?.phone) return;
    setLoadingHistory(true);
    setShowHistoryModal(true);
    try {
      const res = await leadsApi.getHistoryByPhone(lead.phone);
      setHistoryData(res.data?.data || res.data);
    } catch (err: any) {
      toast.error('Impossible de récupérer l\'historique');
      setShowHistoryModal(false);
    } finally {
      setLoadingHistory(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 rounded-3xl ${
        isPrincess ? 'bg-amber-50/10' : isGirly ? 'bg-rose-50/10' : ''
      }`}>
        <div className={`animate-spin rounded-full h-12 w-12 border-4 ${
          isPrincess ? 'border-amber-200 border-t-amber-500' : isGirly ? 'border-pink-200 border-t-pink-500' : 'border-indigo-200 border-t-indigo-500'
        }`}></div>
      </div>
    );
  }

  if (!data) return null;

  const { lead, influencer, product, vendor } = data;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/agent/leads')}
            className={`text-sm mb-2 flex items-center gap-1 font-bold ${
              isPrincess ? 'text-amber-500 hover:text-amber-700' : isGirly ? 'text-pink-400 hover:text-pink-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            ← Retour aux leads
          </button>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            {isPrincess ? 'Espace Princesse Royale 👑' : isGirly ? 'Confirmation du Lead 🌸' : 'Confirmation du Lead 📋'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Appelez le client et mettez à jour le statut.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Theme Dropdown Select */}
          <div className="relative inline-block">
            <select
              value={theme}
              onChange={(e) => changeTheme(e.target.value as any)}
              className={`pl-3 pr-8 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-300 shadow-sm border outline-none appearance-none cursor-pointer ${
                isPrincess 
                  ? 'bg-gradient-to-r from-amber-500 via-pink-500 to-rose-500 text-white border-amber-600 shadow-md shadow-amber-500/20'
                  : isGirly 
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white border-pink-600 shadow-md shadow-pink-500/20' 
                  : 'bg-indigo-600 text-white border-indigo-700'
              }`}
            >
              <option value="classic" className="text-gray-900 bg-white font-bold">🕶️ Classique</option>
              <option value="girly" className="text-gray-900 bg-white font-bold">🌸 Thème Girly ✨</option>
              <option value="princess" className="text-gray-900 bg-white font-bold">💅 Princess Pink 👑</option>
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-white font-black text-[8px]">
              ▼
            </div>
          </div>

          {(lead.status === 'ASSIGNED' || lead.status === 'WRONG_ORDER' || lead.status === 'CANCEL_ORDER') && globalCooldown > 0 && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold animate-pulse border ${
              isPrincess ? 'bg-amber-50 border-amber-200 text-amber-600' : isGirly ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-red-50 border-red-200 text-red-600'
            }`}>
              <Clock className="w-3.5 h-3.5" />
              {Math.floor(globalCooldown / 60)}:{(Math.floor(globalCooldown % 60)).toString().padStart(2, '0')}
            </div>
          )}
          <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase ${
            lead.status === 'ASSIGNED' 
              ? (isPrincess ? 'bg-amber-100 text-amber-800 animate-pulse' : isGirly ? 'bg-pink-100 text-pink-800 animate-pulse' : 'bg-amber-100 text-amber-800 animate-pulse') 
              : (isPrincess ? 'bg-amber-50 text-amber-700' : isGirly ? 'bg-pink-50 text-pink-700' : 'bg-blue-100 text-blue-800')
          }`}>
            {lead.status}
          </span>
        </div>
      </div>

      {/* Customer Info */}
      <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
        isPrincess ? 'border-amber-100/50' : isGirly ? 'border-pink-100/50' : 'border-gray-100'
      }`}>
        <div className={`px-6 py-4 ${
          isPrincess ? 'bg-gradient-to-r from-amber-500 via-pink-500 to-rose-500' : isGirly ? 'bg-gradient-to-r from-pink-500 to-rose-500' : 'bg-gradient-to-r from-indigo-500 to-indigo-600'
        }`}>
          <h2 className="text-white font-bold flex items-center gap-2">👤 Client</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <FieldLabel label="Nom complet" fieldKey="fullName" savingField={savingField} savedField={savedField} />
              {editingField === 'fullName' ? (
                <InlineInput
                  value={fieldDraft}
                  onChange={setFieldDraft}
                  onCommit={() => commitFieldEdit('fullName')}
                  onCancel={cancelFieldEdit}
                  error={fieldError}
                  accent={accentRing}
                  placeholder="Nom complet du client"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold text-gray-900">{lead.fullName}</p>
                  <EditPencil onClick={() => startFieldEdit('fullName', lead.fullName || '')} label="Modifier le nom" />
                </div>
              )}
            </div>
            <div>
              <FieldLabel label="Téléphone" fieldKey="phone" savingField={savingField} savedField={savedField} />
              {editingField === 'phone' ? (
                <InlineInput
                  value={fieldDraft}
                  onChange={setFieldDraft}
                  onCommit={() => commitFieldEdit('phone')}
                  onCancel={cancelFieldEdit}
                  error={fieldError}
                  accent={accentRing}
                  type="tel"
                  placeholder="06XXXXXXXX"
                  hint="Enregistré au format +212"
                />
              ) : (
              <div className="flex items-center gap-2">
                <a
                  href={`tel:${lead.phone}`}
                  onClick={() => recordContactClick(lead.id, 'CALL')}
                  className={`text-lg font-bold hover:underline flex items-center gap-2 ${
                    isPrincess ? 'text-amber-600' : isGirly ? 'text-pink-600' : 'text-indigo-600'
                  }`}
                >
                  <Phone className="w-4 h-4" /> {lead.phone}
                </a>
                <button
                  onClick={handleViewHistory}
                  className={`p-1.5 rounded-lg transition-all border shadow-sm ${
                    isPrincess
                      ? 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100'
                      : isGirly 
                      ? 'bg-pink-50 text-pink-600 border-pink-100 hover:bg-pink-100' 
                      : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100'
                  }`}
                  title="Voir l'historique du client"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <EditPencil onClick={() => startFieldEdit('phone', lead.phone || '')} label="Modifier le téléphone" />
              </div>
              )}
            </div>
            <div>
              <FieldLabel label="Ville" fieldKey="city" savingField={savingField} savedField={savedField} />
              {editingField === 'city' ? (
                <div className="space-y-1">
                  <CityPicker
                    autoFocus
                    value={fieldDraft}
                    onChange={setFieldDraft}
                    onSelect={(name) => {
                      setFieldDraft(name);
                      commitFieldEdit('city', name);
                    }}
                    onCommit={() => commitFieldEdit('city')}
                    cities={coliatyCities}
                    loading={loadingCities}
                    accentRing={accentRing}
                    selectedClass={citySelectedClass}
                  />
                  {fieldError ? (
                    <p className="text-[11px] text-red-600 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" /> {fieldError}
                    </p>
                  ) : (
                    <p className="text-[10px] text-gray-400 font-medium">
                      Choisissez une ville officielle Coliaty • Entrée pour enregistrer
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-gray-700 font-medium">{lead.city || '-'}</p>
                  <EditPencil onClick={() => startFieldEdit('city', lead.city || '')} label="Modifier la ville" />
                </div>
              )}
            </div>
            <div>
              <FieldLabel label="Adresse" fieldKey="address" savingField={savingField} savedField={savedField} />
              {editingField === 'address' ? (
                <InlineInput
                  value={fieldDraft}
                  onChange={setFieldDraft}
                  onCommit={() => commitFieldEdit('address')}
                  onCancel={cancelFieldEdit}
                  error={fieldError}
                  accent={accentRing}
                  placeholder="Adresse complète de livraison"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-gray-700 font-medium">{lead.address || '-'}</p>
                  <EditPencil onClick={() => startFieldEdit('address', lead.address || '')} label="Modifier l'adresse" />
                </div>
              )}
            </div>
            {lead.whatsapp && (
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase mb-1">WhatsApp</p>
                <a
                  href={`https://wa.me/${lead.whatsapp.replace('+', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleWaClick(lead.id)}
                  className={`text-xs font-bold transition-all flex items-center gap-1.5 px-3 py-1.5 rounded-xl border w-fit ${
                    clickedWaLeads.has(lead.id)
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm font-black'
                      : 'text-green-700 hover:bg-green-100 bg-green-50 border-green-200'
                  }`}
                >
                  {clickedWaLeads.has(lead.id) ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white stroke-[3]" /> WhatsApp ({lead.whatsapp}) - Cliqué
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-3.5 h-3.5 text-green-600" /> {lead.whatsapp}
                    </>
                  )}
                </a>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase mb-1">Reçu le</p>
              <p className="text-gray-700 font-medium">{format(new Date(lead.createdAt), 'dd MMM yyyy à HH:mm')}</p>
            </div>
            {lead.referralLink?.code && (() => {
              const linkUser = lead.referralLink.influencer || influencer || vendor;
              const refUrl = buildReferralUrl(
                lead.referralLink.code,
                linkUser?.subdomain,
                linkUser?.customDomain,
                linkUser?.customDomainStatus
              );
              return (
                <div className="col-span-1 md:col-span-2">
                  <p className="text-xs text-gray-400 font-medium uppercase mb-1">Lien de parrainage</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <a 
                      href={refUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-800 rounded-xl font-mono text-xs font-bold border border-gray-200 hover:bg-gray-200 transition-all shadow-xs break-all max-w-full ${
                        isPrincess ? 'hover:text-amber-600' : isGirly ? 'hover:text-pink-600' : 'hover:text-indigo-600'
                      }`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-70 shrink-0">
                        <line x1="7" y1="17" x2="17" y2="7"></line>
                        <polyline points="7 7 17 7 17 17"></polyline>
                      </svg>
                      {refUrl}
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(refUrl);
                        toast.success('Lien de parrainage copié !');
                      }}
                      className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-bold transition-all border border-gray-200 flex items-center gap-1.5 shrink-0"
                      title="Copier le lien"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copier
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Lead Info Paragraph */}
          <div className="mt-6 p-4 bg-gray-50 border border-gray-100 rounded-xl">
            <p className="text-sm text-gray-500 font-medium leading-relaxed">
              Informations de contact du prospect pour la confirmation et le suivi.
            </p>
          </div>
        </div>
      </div>

      {/* Product Info */}
      {product && (
        <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
          isPrincess ? 'border-amber-100/50' : isGirly ? 'border-pink-100/50' : 'border-gray-100'
        }`}>
          <div className={`px-6 py-4 ${
            isPrincess 
              ? 'bg-gradient-to-r from-amber-500 via-pink-500 to-rose-500'
              : isGirly 
              ? 'bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-500' 
              : 'bg-gradient-to-r from-purple-500 to-purple-600'
          }`}>
            <h2 className="text-white font-bold flex items-center gap-2">📦 Produit</h2>
          </div>
          <div className="p-6">
            <div className="flex items-start gap-4">
              {product.image && (
                <img src={product.image} alt="" className="w-20 h-20 rounded-xl object-cover border border-gray-100" />
              )}
              <div className="flex-1">
                <p className="text-lg font-bold text-gray-900">{product.name}</p>
                <p className="text-sm text-gray-400 mt-0.5">SKU: {product.sku}</p>
                
                {(() => {
                  const variantPrice = resolveVariantPrice(lead);
                  // What the courier will collect: the price agreed on the call
                  // beats the pack's listed price, which beats retail.
                  const agreedPrice = lead.confirmedPriceMad ?? null;
                  const displayPrice =
                    agreedPrice !== null ? agreedPrice : variantPrice !== null ? variantPrice : product.retailPrice;

                  return (
                    <div className="mt-2">
                      <div className="flex items-baseline gap-2">
                        <p className={`text-xl font-black ${isPrincess ? 'text-rose-600' : isGirly ? 'text-pink-600' : 'text-indigo-600'}`}>
                          {Number(displayPrice).toFixed(2)} MAD
                        </p>
                        {agreedPrice !== null ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border bg-emerald-50 text-emerald-700 border-emerald-100">
                            Prix convenu
                          </span>
                        ) : variantPrice !== null && (
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border ${
                            isPrincess
                              ? 'bg-amber-50 text-amber-700 border-amber-100'
                              : isGirly
                              ? 'bg-pink-50 text-pink-600 border-pink-100'
                              : 'bg-purple-50 text-purple-600 border-purple-100'
                          }`}>
                            Prix du Pack
                          </span>
                        )}
                      </div>
                      {lead.productVariant && (
                        <p className="text-xs font-bold text-gray-500 mt-1 flex items-center gap-1">
                          <span className={`font-black ${isPrincess ? 'text-amber-500' : isGirly ? 'text-pink-400' : 'text-purple-400'}`}>↳</span> Sélection: {lead.productVariant}
                        </p>
                      )}
                    </div>
                  );
                })()}

                {product.description && (
                  <p className="text-sm text-gray-500 mt-2 line-clamp-2">{product.description}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Adresse & Ville Modification Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            📍 Adresse & Ville de livraison
          </h2>
          {savingAddress ? (
            <span className="flex items-center gap-1.5 text-xs font-bold text-gray-400 animate-pulse">
              <span className="w-3 h-3 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
              Enregistrement...
            </span>
          ) : addressSavedAt ? (
            <span className={`flex items-center gap-1 text-xs font-bold ${
              isPrincess ? 'text-amber-600' : isGirly ? 'text-pink-600' : 'text-emerald-600'
            }`}>
              <Check className="w-3.5 h-3.5" /> Enregistré
            </span>
          ) : (
            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">
              Sauvegarde auto
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1 space-y-1 relative">
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Ville</label>
              {/* Whether the typed city is an official Coliaty city. A parcel cannot
                  be pushed to delivery for an unrecognised city, so the agent needs
                  to see the mismatch before confirming the order. */}
              {cityMatch === 'matched' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wide">
                  <Check className="w-3 h-3 stroke-[3]" /> Ville reconnue
                </span>
              )}
              {cityMatch === 'unmatched' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[10px] font-black uppercase tracking-wide">
                  <XCircle className="w-3 h-3 stroke-[3]" /> Non reconnue
                </span>
              )}
              {cityMatch === 'empty' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black uppercase tracking-wide">
                  <AlertTriangle className="w-3 h-3 stroke-[3]" /> Ville manquante
                </span>
              )}
              {cityMatch === 'unknown' && (
                <span
                  title={loadingCities ? 'Chargement de la liste Coliaty…' : 'Liste Coliaty indisponible — vérification impossible'}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 text-gray-400 border border-gray-200 text-[10px] font-black uppercase tracking-wide"
                >
                  <Info className="w-3 h-3" /> Non vérifiée
                </span>
              )}
            </div>
            <CityPicker
              value={citySearch}
              onChange={(v) => {
                setCitySearch(v);
                setEditedCity(v);
              }}
              onSelect={(name) => {
                setEditedCity(name);
                setCitySearch(name);
                persistAddressCity(editedAddress, name);
              }}
              onCommit={() => persistAddressCity(editedAddress, editedCity)}
              cities={coliatyCities}
              loading={loadingCities}
              accentRing={accentRing}
              selectedClass={citySelectedClass}
            />
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Adresse complète</label>
            <input
              type="text"
              value={editedAddress}
              onChange={(e) => setEditedAddress(e.target.value)}
              onBlur={() => persistAddressCity(editedAddress, editedCity)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="Saisissez l'adresse complète de livraison..."
              className={`w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:border-transparent outline-none transition-all ${
                isPrincess ? 'focus:ring-amber-400' : isGirly ? 'focus:ring-pink-400' : 'focus:ring-indigo-500'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-bold text-gray-900 mb-3 block">📝 Notes</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={`w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:border-transparent outline-none transition-all ${
            isPrincess ? 'focus:ring-amber-400' : isGirly ? 'focus:ring-pink-400' : 'focus:ring-indigo-500'
          }`}
          rows={3}
          placeholder="Ajoutez des notes sur l'appel..."
        />
      </div>

      {/* Status Actions */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
          <h2 className="font-bold text-gray-900">✅ Résultat de la confirmation</h2>
          {cooldownRemaining > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs font-bold animate-pulse whitespace-nowrap">
              <Clock className="w-4 h-4" />
              Patientez {Math.ceil(cooldownRemaining)}s avant d'agir
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="relative group">
            {lead.callbackAt && (
              <div className={`absolute -top-2 -right-1 z-10 px-2 py-0.5 text-white text-[9px] font-black rounded-full shadow-lg border animate-bounce ${
                isPrincess ? 'bg-rose-600 border-rose-400' : isGirly ? 'bg-pink-600 border-pink-400' : 'bg-blue-600 border-blue-400'
              }`}>
                ⏰ {format(new Date(lead.callbackAt), 'dd/MM HH:mm')}
              </div>
            )}
            <button
              onClick={() => setShowScheduleModal(true)}
              disabled={updating || cooldownRemaining > 0}
              className={`w-full py-3 px-4 rounded-xl text-sm font-bold transition-all border flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                isPrincess
                  ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 shadow-sm'
                  : isGirly 
                  ? 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100' 
                  : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
              }`}
            >
              📞 CALL LATER
            </button>
          </div>
          <button
            onClick={() => handleUpdateStatus('NO_REPLY')}
            disabled={updating || cooldownRemaining > 0}
            className="py-3 px-4 bg-gray-50 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-100 transition-all border border-gray-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📵 NO REPLY
          </button>
          <button
            onClick={openDeliveryModal}
            disabled={updating || savingConfirmation || cooldownRemaining > 0}
            className="py-3 px-4 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-all border border-emerald-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ✅ CONFIRMED
          </button>
          <button
            onClick={() => handleUpdateStatus('WRONG_ORDER')}
            disabled={updating || cooldownRemaining > 0}
            className="py-3 px-4 bg-amber-50 text-amber-700 rounded-xl text-sm font-bold hover:bg-amber-100 transition-all border border-amber-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ⚠️ WRONG ORDER
          </button>
          <div className="relative group">
            {lead.requestedPriceMad && (
              <div className={`absolute -top-2 -right-1 z-10 px-2 py-0.5 text-white text-[9px] font-black rounded-full shadow-lg border ${
                isPrincess ? 'bg-rose-600 border-rose-400 animate-pulse' : isGirly ? 'bg-rose-600 border-rose-400' : 'bg-gray-600 border-gray-400'
              }`}>
                💰 {lead.requestedPriceMad} MAD 
                {lead.requestedPriceStatus === 'PENDING' ? ' (En attente)' : 
                 lead.requestedPriceStatus === 'APPROVED' ? ' (Approuvé)' : 
                 lead.requestedPriceStatus === 'REJECTED' ? ' (Rejeté)' : ''}
              </div>
            )}
            <button
              onClick={() => setShowPriceModal(true)}
              disabled={updating || cooldownRemaining > 0}
              className={`w-full py-3 px-4 rounded-xl text-sm font-bold transition-all border flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                isPrincess
                  ? 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200 shadow-sm'
                  : isGirly 
                  ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' 
                  : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
              }`}
            >
              💰 CANCEL REASON PRICE
            </button>
          </div>
          <button
            onClick={() => handleUpdateStatus('CANCEL_ORDER')}
            disabled={updating || cooldownRemaining > 0}
            className="py-3 px-4 bg-red-50 text-red-700 rounded-xl text-sm font-bold hover:bg-red-100 transition-all border border-red-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ❌ CANCEL ORDER
          </button>
        </div>
        {updating && (
          <p className="text-sm text-gray-400 text-center mt-3 animate-pulse">Mise à jour en cours...</p>
        )}
      </div>

      {/* Coliaty confirmation — saves the delivery details and sets CONFIRMED */}
      {showDeliveryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 z-[105] overflow-y-auto">
          {/* No overflow-hidden: it would clip the city dropdown, which is
              absolutely positioned inside this card. The top bar keeps the
              rounded corners itself instead. */}
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 border border-gray-100 my-8">
            <div className={`absolute top-0 left-0 right-0 h-1.5 rounded-t-3xl ${
              isPrincess
                ? 'bg-gradient-to-r from-amber-400 via-pink-400 to-rose-500'
                : isGirly
                ? 'bg-gradient-to-r from-pink-400 via-rose-400 to-fuchsia-400'
                : 'bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-600'
            }`}></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                📦 Confirmation Coliaty
              </h3>
              <button
                onClick={() => setShowDeliveryModal(false)}
                disabled={savingConfirmation}
                className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 p-2 rounded-full transition-all disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmDelivery} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-1">Nom Complet du Destinataire</label>
                <input
                  type="text"
                  required
                  value={deliveryForm.name}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, name: e.target.value })}
                  className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 outline-none text-sm font-semibold ${
                    formErrors.name ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  } ${accentRing}`}
                />
                {formErrors.name && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-1">Téléphone</label>
                <input
                  type="tel"
                  required
                  value={deliveryForm.phone}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, phone: toColiatyPhone(e.target.value) })}
                  className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 outline-none text-sm font-semibold ${
                    formErrors.phone ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  } ${accentRing}`}
                  placeholder="Ex: 0612345678"
                />
                {formErrors.phone && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.phone}</p>}
              </div>

              {/* Same picker and badges as the "Adresse & Ville de livraison"
                  card — one way to choose a city everywhere on this page. */}
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <label className="text-xs font-black text-gray-500 uppercase">Ville (Sélection Coliaty)</label>
                  {modalCityMatch === 'matched' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wide">
                      <Check className="w-3 h-3 stroke-[3]" /> Ville reconnue
                    </span>
                  )}
                  {modalCityMatch === 'unmatched' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[10px] font-black uppercase tracking-wide">
                      <XCircle className="w-3 h-3 stroke-[3]" /> Non reconnue
                    </span>
                  )}
                  {modalCityMatch === 'empty' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black uppercase tracking-wide">
                      <AlertTriangle className="w-3 h-3 stroke-[3]" /> Ville manquante
                    </span>
                  )}
                  {modalCityMatch === 'unknown' && (
                    <span
                      title={loadingCities ? 'Chargement de la liste Coliaty…' : 'Liste Coliaty indisponible — vérification impossible'}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 text-gray-400 border border-gray-200 text-[10px] font-black uppercase tracking-wide"
                    >
                      <Info className="w-3 h-3" /> Non vérifiée
                    </span>
                  )}
                </div>
                <CityPicker
                  value={modalCitySearch}
                  onChange={(v) => {
                    setModalCitySearch(v);
                    // Free text is only a search: the form keeps an official city
                    // or nothing at all, so a half-typed name can never be sent.
                    setDeliveryForm((prev) => ({ ...prev, city: resolveColiatyCity(v, coliatyCities) }));
                  }}
                  onSelect={(name) => {
                    setModalCitySearch(name);
                    setDeliveryForm((prev) => ({ ...prev, city: name }));
                  }}
                  onCommit={() => {}}
                  cities={coliatyCities}
                  loading={loadingCities}
                  accentRing={accentRing}
                  selectedClass={citySelectedClass}
                />
                {formErrors.city && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.city}</p>}
                {modalCityMatch === 'unmatched' && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    « {modalCitySearch} » n'est pas une ville Coliaty. Choisissez-en une dans la liste.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-1">Adresse Détaillée</label>
                <textarea
                  required
                  rows={2}
                  value={deliveryForm.address}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, address: e.target.value })}
                  className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 outline-none text-xs font-semibold resize-none ${
                    formErrors.address ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  } ${accentRing}`}
                />
                {formErrors.address && <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.address}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase mb-1">Prix Encaisser (MAD)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={deliveryForm.price || ''}
                    onChange={(e) => setDeliveryForm({ ...deliveryForm, price: Number(e.target.value) })}
                    className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 outline-none text-sm font-bold ${
                      formErrors.price ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    } ${accentRing}`}
                  />
                  {formErrors.price ? (
                    <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.price}</p>
                  ) : packPrice > 0 && Number(deliveryForm.price) !== packPrice ? (
                    <button
                      type="button"
                      onClick={() => setDeliveryForm({ ...deliveryForm, price: packPrice })}
                      className="text-[10px] font-bold text-amber-600 hover:text-amber-700 mt-1 underline decoration-dotted underline-offset-2"
                    >
                      Prix du pack : {packPrice.toFixed(2)} MAD — appliquer
                    </button>
                  ) : (
                    <p className="text-[10px] text-gray-400 font-medium mt-1">Montant encaissé par le livreur</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase mb-1">Pack / Variante</label>
                  <input
                    type="text"
                    value={deliveryForm.productVariant}
                    onChange={(e) => setDeliveryForm({ ...deliveryForm, productVariant: e.target.value })}
                    className={`w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 outline-none text-sm font-semibold ${accentRing}`}
                    placeholder="Ex: Pack 2 + 1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-1">
                  Note pour le livreur
                </label>
                <textarea
                  rows={2}
                  maxLength={255}
                  value={deliveryForm.note}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, note: e.target.value })}
                  className={`w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 outline-none text-xs font-semibold resize-none ${accentRing}`}
                  placeholder="Ex: Appeler avant la livraison, disponible après 18h..."
                />
                <p className="text-[10px] text-gray-400 font-medium mt-1">
                  Reprise des notes de l'appel • {deliveryForm.note.length}/255 • envoyée à Coliaty
                </p>
              </div>

              <div className="flex gap-2.5 p-3 bg-emerald-50 border border-emerald-100 rounded-2xl">
                <span className="text-base leading-none">📋</span>
                <p className="text-[11px] font-semibold text-emerald-800 leading-relaxed">
                  Le lead passe en <span className="font-black">CONFIRMÉ</span> avec ces informations. Le colis
                  Coliaty sera créé depuis « Mes Leads Assignés », individuellement ou en lot.
                </p>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeliveryModal(false)}
                  className="flex-1 py-3 bg-gray-50 border border-gray-100 text-gray-700 font-black rounded-xl hover:bg-gray-100 transition-all text-xs"
                  disabled={savingConfirmation}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingConfirmation || !deliveryForm.city}
                  className={`flex-1 flex justify-center items-center gap-2 py-3 text-white font-black rounded-xl hover:opacity-95 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs ${
                    isPrincess
                      ? 'bg-gradient-to-r from-amber-500 via-pink-500 to-rose-500'
                      : isGirly
                      ? 'bg-gradient-to-r from-pink-500 to-rose-500'
                      : 'bg-gradient-to-r from-indigo-500 to-indigo-600'
                  }`}
                >
                  {savingConfirmation ? 'Confirmation...' : 'Confirmer le lead'} ✅
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className={`p-6 text-white shrink-0 relative overflow-hidden ${
              isPrincess 
                ? 'bg-gradient-to-r from-amber-500 via-pink-500 to-rose-600'
                : isGirly 
                ? 'bg-gradient-to-r from-pink-500 to-rose-500' 
                : 'bg-indigo-600'
            }`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                    <History className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">Historique Client</h3>
                    <p className="text-indigo-100 text-xs font-medium flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {lead.phone}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowHistoryModal(false)}
                  className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {loadingHistory ? (
              <div className="p-20 flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="text-sm font-bold text-gray-400 animate-pulse uppercase tracking-widest">Analyse en cours...</p>
              </div>
            ) : historyData ? (
              (!historyData.rawHistory?.leads?.length && !historyData.rawHistory?.orders?.length) ? (
                <div className="p-20 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-gray-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border-2 border-gray-100 shadow-sm">
                    <Info className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mb-2">Nouveau Client</h3>
                  <p className="text-gray-500 font-medium max-w-sm mx-auto">
                    Ce numéro de téléphone n'a aucun historique ni ancienne commande enregistrée dans le système.
                  </p>
                </div>
              ) : (
                <div className="overflow-y-auto p-6 space-y-8">
                  {/* Score Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-center">
                      <span className="text-[10px] font-black text-gray-400 uppercase block mb-1">Total Leads</span>
                      <span className="text-xl font-black text-gray-900">{historyData.summary.totalLeads}</span>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-center">
                      <span className="text-[10px] font-black text-emerald-500 uppercase block mb-1">Total Livrés</span>
                      <span className="text-xl font-black text-emerald-700">{historyData.summary.orderStats['DELIVERED'] || 0}</span>
                    </div>
                    <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-center">
                      <span className="text-[10px] font-black text-red-500 uppercase block mb-1">Annulés</span>
                      <span className="text-xl font-black text-red-700">{historyData.summary.leadStats['CANCEL_ORDER'] || 0}</span>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 text-center">
                      <span className="text-[10px] font-black text-amber-500 uppercase block mb-1">Retours</span>
                      <span className="text-xl font-black text-amber-700">{historyData.summary.orderStats['RETURNED'] || 0}</span>
                    </div>
                  </div>

                  {/* Trust Score indicator */}
                  {(() => {
                    const delivered = historyData.summary.orderStats['DELIVERED'] || 0;
                    const cancelled = historyData.summary.leadStats['CANCEL_ORDER'] || 0;
                    const returns = historyData.summary.orderStats['RETURNED'] || 0;
                    
                    let score = 50;
                    if (delivered > 0) score += (delivered * 20);
                    if (cancelled > 0) score -= (cancelled * 15);
                    if (returns > 0) score -= (returns * 25);
                    score = Math.max(0, Math.min(100, score));

                    return (
                      <div className={`p-4 rounded-2xl border flex items-center gap-4 ${
                        score > 70 ? 'bg-emerald-50 border-emerald-100' :
                        score < 40 ? 'bg-rose-50 border-rose-100' :
                        'bg-amber-50 border-amber-100'
                      }`}>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm ${
                          score > 70 ? 'bg-emerald-500 text-white' :
                          score < 40 ? 'bg-rose-500 text-white' :
                          'bg-amber-500 text-white'
                        }`}>
                          <ShieldAlert className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-black text-gray-900">Score de Confiance: {score}%</h4>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {score > 70 ? 'Client très fiable. Priorité haute.' :
                             score < 40 ? 'Attention : Historique d\'annulations ou de retours élevé.' :
                             'Client avec un historique modéré.'}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Detailed History Sections */}
                  <div className="space-y-6">
                    {/* Leads History */}
                    <div>
                      <h4 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-indigo-500" />
                        Détails des Leads Passés
                      </h4>
                      <div className="space-y-2">
                        {historyData.rawHistory.leads.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">Aucun autre lead trouvé.</p>
                        ) : (
                          historyData.rawHistory.leads.map((h: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                              <div className="flex items-center gap-3">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                  h.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' :
                                  h.status === 'CANCEL_ORDER' ? 'bg-rose-100 text-rose-700' :
                                  'bg-gray-200 text-gray-600'
                                }`}>
                                  {h.status}
                                </span>
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold text-gray-700 flex items-center gap-1">
                                    <Store className="w-2.5 h-2.5 opacity-50" /> {h.vendorName}
                                  </span>
                                </div>
                              </div>
                              <span className="text-[10px] text-gray-400 font-medium">
                                {format(new Date(h.createdAt), 'dd/MM/yyyy')}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Orders History */}
                    <div>
                      <h4 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
                        <Package className="w-4 h-4 text-emerald-500" />
                        Détails des Expéditions
                      </h4>
                      <div className="space-y-2">
                        {historyData.rawHistory.orders.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">Aucune expédition trouvée.</p>
                        ) : (
                          historyData.rawHistory.orders.map((h: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                              <div className="flex items-center gap-3">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                  h.status === 'DELIVERED' ? 'bg-emerald-500 text-white' :
                                  h.status === 'RETURNED' ? 'bg-rose-500 text-white' :
                                  'bg-blue-500 text-white'
                                }`}>
                                  {h.status}
                                </span>
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold text-gray-700 flex items-center gap-1">
                                    <Store className="w-2.5 h-2.5 opacity-50" /> {h.vendorName}
                                  </span>
                                </div>
                              </div>
                              <span className="text-[10px] text-gray-400 font-medium">
                                {format(new Date(h.createdAt), 'dd/MM/yyyy')}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="p-20 text-center">
                <Info className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-400 font-medium">Erreur lors du chargement des données.</p>
              </div>
            )}

            {/* Modal Footer */}
            <div className="p-6 bg-gray-50 border-t border-gray-100 shrink-0">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-full py-4 bg-white border border-gray-200 text-gray-700 rounded-2xl font-black text-sm hover:bg-gray-50 transition-all shadow-sm"
              >
                FERMER
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={`p-6 text-center text-white ${
              isPrincess 
                ? 'bg-gradient-to-r from-amber-500 via-pink-500 to-rose-600'
                : isGirly 
                ? 'bg-gradient-to-r from-pink-500 to-rose-500' 
                : 'bg-gradient-to-br from-blue-600 to-blue-700'
            }`}>
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                <span className="text-3xl">⏰</span>
              </div>
              <h3 className="text-xl font-black">Programmer le rappel</h3>
              <p className="text-blue-100 text-sm mt-1">À quel moment souhaitez-vous rappeler {lead.fullName} ?</p>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</label>
                  <input
                    type="date"
                    min={format(new Date(), 'yyyy-MM-dd')}
                    className={`w-full pl-4 pr-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-gray-900 font-bold text-base focus:bg-white focus:ring-0 transition-all outline-none ${
                      isPrincess ? 'focus:border-amber-400' : isGirly ? 'focus:border-pink-400' : 'focus:border-blue-500'
                    }`}
                    value={callbackDate}
                    onChange={(e) => setCallbackDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Heure (24h)</label>
                  <div className="flex gap-2">
                    <select
                      className={`flex-1 px-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-gray-900 font-bold text-base focus:bg-white focus:ring-0 transition-all outline-none appearance-none text-center ${
                        isPrincess ? 'focus:border-amber-400' : isGirly ? 'focus:border-pink-400' : 'focus:border-blue-500'
                      }`}
                      value={callbackHour}
                      onChange={(e) => setCallbackHour(e.target.value)}
                    >
                      {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <span className="flex items-center font-bold text-gray-400">:</span>
                    <select
                      className={`flex-1 px-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-gray-900 font-bold text-base focus:bg-white focus:ring-0 transition-all outline-none appearance-none text-center ${
                        isPrincess ? 'focus:border-amber-400' : isGirly ? 'focus:border-pink-400' : 'focus:border-blue-500'
                      }`}
                      value={callbackMinute}
                      onChange={(e) => setCallbackMinute(e.target.value)}
                    >
                      {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    if (!callbackDate || !callbackHour || !callbackMinute) return toast.error('Veuillez choisir une date et une heure');
                    
                    const selected = new Date(`${callbackDate}T${callbackHour}:${callbackMinute}:00`);
                    if (selected <= new Date()) {
                      return toast.error('La date de rappel doit être dans le futur');
                    }

                    handleUpdateStatus('CALL_LATER', { callbackAt: selected.toISOString() });
                    setShowScheduleModal(false);
                  }}
                  disabled={updating}
                  className={`flex-1 py-4 text-white rounded-2xl font-bold transition-all disabled:opacity-50 ${
                    isPrincess 
                      ? 'bg-gradient-to-r from-amber-500 to-rose-500 shadow-lg shadow-amber-500/20' 
                      : isGirly 
                      ? 'bg-gradient-to-r from-pink-500 to-rose-500 shadow-lg shadow-pink-500/20' 
                      : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20'
                  }`}
                >
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Price Modal */}
      {showPriceModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={`p-6 text-center text-white ${
              isPrincess 
                ? 'bg-gradient-to-r from-amber-500 via-pink-500 to-rose-600'
                : isGirly 
                ? 'bg-gradient-to-r from-pink-500 to-rose-500' 
                : 'bg-gradient-to-br from-gray-600 to-gray-700'
            }`}>
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                <span className="text-3xl">💰</span>
              </div>
              <h3 className="text-xl font-black">Négociation de Prix</h3>
              <p className="text-gray-100 text-sm mt-1">Quel prix le client a-t-il demandé pour ce produit ?</p>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Prix demandé (MAD)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    placeholder="Ex: 199"
                    className={`w-full pl-4 pr-12 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-gray-900 font-bold text-base focus:bg-white focus:ring-0 transition-all outline-none ${
                      isPrincess ? 'focus:border-amber-400' : isGirly ? 'focus:border-pink-400' : 'focus:border-gray-500'
                    }`}
                    value={requestedPriceInput}
                    onChange={(e) => setRequestedPriceInput(e.target.value)}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">MAD</div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowPriceModal(false)}
                  className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    const parsed = parseFloat(requestedPriceInput);
                    if (isNaN(parsed) || parsed <= 0) {
                      return toast.error('Veuillez entrer un prix valide');
                    }
                    handleUpdateStatus('CANCEL_REASON_PRICE', { requestedPriceMad: parsed });
                    setShowPriceModal(false);
                  }}
                  disabled={updating}
                  className={`flex-1 py-4 text-white rounded-2xl font-bold transition-all disabled:opacity-50 ${
                    isPrincess 
                      ? 'bg-gradient-to-r from-amber-500 to-rose-500 shadow-lg shadow-amber-500/20' 
                      : isGirly 
                      ? 'bg-gradient-to-r from-pink-500 to-rose-500 shadow-lg shadow-pink-500/20' 
                      : 'bg-gray-800 hover:bg-gray-900 shadow-lg shadow-gray-800/20'
                  }`}
                >
                  Soumettre
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Field label with inline save feedback, so the agent gets confirmation on the
 * field they just edited rather than somewhere else on the page.
 */
function FieldLabel({
  label,
  fieldKey,
  savingField,
  savedField,
}: {
  label: string;
  fieldKey: EditableFieldKey;
  savingField: EditableFieldKey | null;
  savedField: EditableFieldKey | null;
}) {
  return (
    <p className="text-xs text-gray-400 font-medium uppercase mb-1 flex items-center gap-1.5">
      {label}
      {savingField === fieldKey && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-400 normal-case animate-pulse">
          <span className="w-2.5 h-2.5 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
          Enregistrement…
        </span>
      )}
      {savedField === fieldKey && savingField !== fieldKey && (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 normal-case">
          <Check className="w-3 h-3" /> Enregistré
        </span>
      )}
    </p>
  );
}

/** Small pencil affordance shown next to an editable value. */
function EditPencil({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="p-1 rounded-lg text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shrink-0"
    >
      <Pencil className="w-3.5 h-3.5" />
    </button>
  );
}

/**
 * Auto-saving inline editor: commits on blur and on Enter, abandons on Escape.
 *
 * Escape closes the editor via onCancel, which also arms the parent's
 * cancel flag — otherwise the blur that immediately follows would save the very
 * edit the agent just discarded.
 */
function InlineInput({
  value,
  onChange,
  onCommit,
  onCancel,
  accent,
  type = 'text',
  placeholder,
  hint,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  accent: string;
  type?: string;
  placeholder?: string;
  hint?: string;
  error?: string | null;
}) {
  return (
    <div className="space-y-1">
      <input
        autoFocus
        type={type}
        value={value}
        placeholder={placeholder}
        aria-invalid={!!error}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        className={`w-full px-3 py-2 bg-white border rounded-xl text-sm font-semibold focus:ring-2 focus:border-transparent outline-none transition-all ${
          error ? 'border-red-300 ring-1 ring-red-200 focus:ring-red-400' : `border-gray-200 ${accent}`
        }`}
      />
      {error ? (
        <p className="text-[11px] text-red-600 font-bold flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 shrink-0" /> {error}
        </p>
      ) : (
        <p className="text-[10px] text-gray-400 font-medium">
          {hint ? `${hint} • ` : ''}Entrée pour enregistrer, Échap pour annuler
        </p>
      )}
    </div>
  );
}

/**
 * Searchable Coliaty city picker.
 *
 * Extracted so the customer card and the delivery card cannot drift: a free-text
 * city that is not in Coliaty's list cannot be pushed to delivery, so both places
 * an agent can change the city must offer the same official list.
 *
 * Owns its open state and click-outside handling, so two instances on the page
 * never fight over a shared ref.
 */
function CityPicker({
  value,
  onChange,
  onSelect,
  onCommit,
  cities,
  loading,
  accentRing,
  selectedClass,
  autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (cityName: string) => void;
  onCommit: () => void;
  cities: any[];
  loading: boolean;
  accentRing: string;
  selectedClass: string;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Accent- and punctuation-insensitive, prefix matches first: agents type
  // "temara" for "Témara" and "eljadida" for "El Jadida".
  const filtered = useMemo(() => {
    const query = normalizeSearch(value).replace(/ /g, '');
    if (!query) return cities;
    return cities
      .map((c, index) => {
        const name = normalizeSearch(c.city_name || '').replace(/ /g, '');
        const rank = name.startsWith(query) ? 0 : name.includes(query) ? 1 : -1;
        return { c, rank, index };
      })
      .filter((entry) => entry.rank >= 0)
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .map((entry) => entry.c);
  }, [cities, value]);

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <input
          type="text"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={onCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              setOpen(false);
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Rechercher une ville..."
          className={`w-full pl-3 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:bg-white focus:ring-2 focus:border-transparent outline-none transition-all ${accentRing}`}
        />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors text-xs"
        >
          {open ? '▲' : '▼'}
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-100 rounded-xl shadow-2xl z-50 p-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
          {loading ? (
            <div className="text-xs text-gray-400 text-center py-3 animate-pulse">
              Chargement des villes de Coliaty...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-3">
              Aucune ville officielle trouvée. Conserver "{value}"
            </div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.city_id}
                type="button"
                // Keep focus on the input so its onBlur auto-save doesn't fire
                // with the half-typed search text before this click lands.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  onSelect(c.city_name);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between ${
                  value === c.city_name ? selectedClass : 'hover:bg-gray-50 text-gray-700 font-medium'
                }`}
              >
                <span>{c.city_name}</span>
                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md font-mono font-bold">
                  {c.hub_name}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

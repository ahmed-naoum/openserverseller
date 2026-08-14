import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { leadsApi } from '../../lib/api';
import { useSocket } from '../../contexts/SocketContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Sparkles, Phone, MessageSquare, Zap, Package, Heart, Filter, ChevronRight, Activity, Check, X } from 'lucide-react';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { findColiatyCity } from '../../hooks/useCities';
import { ReleaseCountdown } from '../../components/leads/ReleaseCountdown';

const AssignedTimer =({ lead, onTimeout, isGirly, isPrincess }: { lead: any; onTimeout?: () => void; isGirly: boolean; isPrincess: boolean }) => {
  const [globalCooldown, setGlobalCooldown] = useState<number>(0);

  useEffect(() => {
    const isAssigned = lead.status === 'ASSIGNED';
    const isWrongOrder = lead.status === 'WRONG_ORDER';
    const isCancelOrder = lead.status === 'CANCEL_ORDER';

    if (!isAssigned && !isWrongOrder && !isCancelOrder) return;

    const storageKey = `lead_cooldown_${lead.id}`;
    let savedStart = sessionStorage.getItem(storageKey);
    let parsedStartVal = savedStart ? parseInt(savedStart, 10) : NaN;
    
    // If it's NaN, delete it from storage
    if (savedStart && isNaN(parsedStartVal)) {
      sessionStorage.removeItem(storageKey);
      savedStart = null;
      parsedStartVal = NaN;
    }

    const leadUpdatedTime = lead.updatedAt ? new Date(lead.updatedAt).getTime() : Date.now();
    const startTime = !isNaN(parsedStartVal) 
      ? parsedStartVal 
      : (!isNaN(leadUpdatedTime) ? leadUpdatedTime : Date.now());

    const isShortTimeout = isWrongOrder || isCancelOrder;
    const totalCooldownSeconds = isShortTimeout ? 120 : 420; // 2 mins for short timeouts, 7 mins for ASSIGNED

    const calculateGlobal = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const val = Math.max(0, totalCooldownSeconds - elapsed);
      return isNaN(val) ? 0 : val;
    };

    setGlobalCooldown(calculateGlobal());

    const interval = setInterval(() => {
      const remaining = calculateGlobal();
      setGlobalCooldown(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        if (onTimeout) onTimeout();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lead.status, lead.id, lead.updatedAt, onTimeout]);

  const isAssigned = lead.status === 'ASSIGNED';
  const isWrongOrder = lead.status === 'WRONG_ORDER';
  const isCancelOrder = lead.status === 'CANCEL_ORDER';
  if ((!isAssigned && !isWrongOrder && !isCancelOrder) || isNaN(globalCooldown) || globalCooldown <= 0) return null;

  const isShortTimeout = isWrongOrder || isCancelOrder;

  return (
    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border flex items-center gap-1 animate-pulse ${
      isShortTimeout
        ? 'text-amber-800 bg-amber-50 border-amber-200'
        : isPrincess
        ? 'text-amber-800 bg-amber-50 border-amber-200'
        : isGirly 
        ? 'text-rose-600 bg-rose-50 border-rose-100' 
        : 'text-indigo-600 bg-indigo-50 border-indigo-100'
    }`}>
      ⏱️ {Math.floor(globalCooldown / 60)}:{(Math.floor(globalCooldown % 60)).toString().padStart(2, '0')}
    </span>
  );
};

export default function AgentLeads() {
  // Authenticated, app-wide socket. It is the only one the server puts in the
  // `user:<id>` room that the call-center emitters target.
  const { socket } = useSocket();

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

  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(timer);
  }, []);

  const isNewLead = (lead: any) => {
    if (!lead) return false;
    const timeVal = lead.updatedAt || lead.createdAt;
    if (!timeVal) return false;
    const leadTime = new Date(timeVal).getTime();
    const now = new Date().getTime();
    const diffInMinutes = (now - leadTime) / (1000 * 60);
    return diffInMinutes >= 0 && diffInMinutes <= 5;
  };

  const [availableLeads, setAvailableLeads] = useState<any[]>([]);
  const [totalAvailableCount, setTotalAvailableCount] = useState<number>(0);
  // 20 by default. The badge next to the heading always shows the real pool
  // size, so a short page no longer reads as "there are only 20 leads".
  const [availableLimit, setAvailableLimit] = useState<number | 'max'>(20);
  // Product is the only filter over the available pool: an agent picks what to
  // work by product, not by searching a pool whose phone numbers they cannot
  // see yet. Free-text search, city and the arrival window were removed.
  const [availableProductId, setAvailableProductId] = useState<number | ''>('');
  // Number lookup over the pool — the one text filter that survived, because it
  // needs a number the agent already has rather than one they are fishing for.
  // Debounced apart from the input's own value so typing does not fire a
  // request per keystroke on top of the 8s poll.
  const [availablePhone, setAvailablePhone] = useState('');
  const [debouncedPhone, setDebouncedPhone] = useState('');
  const [totalScopeCount, setTotalScopeCount] = useState(0);
  const [availableFilterOptions, setAvailableFilterOptions] = useState<{
    cities: string[];
    products: { id: number; name: string }[];
  }>({ cities: [], products: [] });
  const [myLeads, setMyLeads] = useState<any[]>([]);
  const [hasActiveLead, setHasActiveLead] = useState(false);
  const [activeLeadId, setActiveLeadId] = useState<number | null>(null);
  const [assignedInfluencers, setAssignedInfluencers] = useState<any[]>([]);
  const [selectedInfluencerId, setSelectedInfluencerId] = useState<number | ''>('');
  // Mirrored into a ref because the realtime effect below is mount-once: reading
  // the state directly there would capture the value from first render forever.
  const selectedInfluencerIdRef = useRef<number | ''>('');
  useEffect(() => {
    selectedInfluencerIdRef.current = selectedInfluencerId;
  }, [selectedInfluencerId]);
  // ?status=CONFIRMED lands here pre-filtered (the agent dashboard links in)
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>(() => searchParams.get('status') || '');

  const applyStatusFilter = (next: string) => {
    setStatusFilter(next);
    const params = new URLSearchParams(searchParams);
    if (next) params.set('status', next);
    else params.delete('status');
    // A history drill-down and a current-status filter answer different
    // questions; picking one from the toolbar drops the other.
    params.delete('historyStatus');
    setSearchParams(params, { replace: true });
  };

  // ?historyStatus=NO_REPLY&dateFrom=…&dateTo=… — the agent dashboard tiles link
  // in here. Filters on what this agent recorded rather than on where the lead
  // stands now, so the leads the cron already handed back to the pool are the
  // ones the tile counted, not a shorter list.
  const historyStatus = searchParams.get('historyStatus') || '';
  const historyRange = {
    dateFrom: searchParams.get('dateFrom') || undefined,
    dateTo: searchParams.get('dateTo') || undefined,
    dateField: (searchParams.get('dateField') as 'createdAt' | 'updatedAt') || undefined,
  };

  const clearHistoryFilter = () => {
    const params = new URLSearchParams(searchParams);
    ['historyStatus', 'dateFrom', 'dateTo', 'dateField'].forEach(k => params.delete(k));
    setSearchParams(params, { replace: true });
  };

  const [claiming, setClaiming] = useState<number | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [clickedWaLeads, setClickedWaLeads] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem('agent_clicked_wa_leads');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (e) {
      return new Set();
    }
  });

  // Persist the contact attempt server-side so it is visible to admins and
  // survives a browser change (localStorage is kept for instant UI feedback).
  const recordContactClick = (leadId: number, channel: 'WHATSAPP' | 'CALL') => {
    leadsApi.recordContactClick(leadId, channel).catch(console.error);
  };

  const handleCallClick = (leadId: number) => {
    recordContactClick(leadId, 'CALL');
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
      const targetLead = myLeads.find((l: any) => l.id === leadId);
      if (targetLead && targetLead.status === 'ASSIGNED') {
        leadsApi.updateStatus(leadId.toString(), { status: 'CONTACTED' }).then(() => {
          loadData();
        }).catch(console.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Push to delivery. The parcel form now runs on the lead detail page, as part
  // of ✅ CONFIRMED — from here a lead goes straight through with the data
  // already on its card, one at a time or for the whole selection.
  const [coliatyCities, setColiatyCities] = useState<any[]>([]);
  const [pushingIds, setPushingIds] = useState<Set<number>>(new Set());
  const [bulkPushing, setBulkPushing] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<number>>(new Set());

  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    try {
      const [availRes, myRes] = await Promise.all([
        leadsApi.available({
          influencerId: selectedInfluencerId ? Number(selectedInfluencerId) : undefined,
          limit: availableLimit,
          productId: availableProductId || undefined,
          phone: debouncedPhone || undefined,
        }),
        // Without an explicit limit this falls back to the server's 50/page and
        // silently drops the rest of the agent's leads.
        leadsApi.list({
          status: statusFilter,
          limit: 5000,
          ...(historyStatus ? { historyStatus, ...historyRange } : {}),
        })
      ]);
      const availData = availRes.data?.data || availRes.data;
      setAvailableLeads(availData?.leads || []);
      setTotalAvailableCount(availData?.totalAvailable ?? (availData?.leads?.length || 0));
      setTotalScopeCount(availData?.totalScope ?? 0);
      setAvailableFilterOptions(availData?.filterOptions || { cities: [], products: [] });
      setHasActiveLead(availData?.hasActiveLead || false);
      setActiveLeadId(availData?.activeLeadId || null);
      setAssignedInfluencers(availData?.assignedInfluencers || []);

      const myData = myRes.data?.data || myRes.data;
      const allMyLeads = myData?.leads || [];
      // The default plate: statuses the agent can still act on. CANCEL_ORDER is
      // deliberately absent — it is terminal, the lead drops back to the pool
      // within two minutes, and a card for it is nothing but noise between the
      // leads that do need a call. It stays counted on the dashboard and stays
      // reachable from the dropdown below.
      const plateStatuses = ['ASSIGNED', 'CALL_LATER', 'NO_REPLY', 'CONFIRMED', 'WRONG_ORDER', 'CANCEL_REASON_PRICE', 'CANCEL_ORDER', 'INVALID', 'CONTACTED', 'PRICE_CONFIRMED'];
      // Both an explicit status pick and a history drill-down are the agent
      // asking for something specific — the whitelist steps aside for either,
      // otherwise picking "Annulé" would filter the list down to nothing.
      setMyLeads(
        historyStatus || statusFilter
          ? allMyLeads
          : allMyLeads.filter((l: any) => plateStatuses.includes(l.status))
      );
    } catch (error) {
      console.error('Failed to load leads:', error);
    }
  }, [
    selectedInfluencerId, availableLimit, statusFilter, availableProductId, debouncedPhone,
    historyStatus, historyRange.dateFrom, historyRange.dateTo, historyRange.dateField,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPhone(availablePhone.replace(/\D/g, '')), 350);
    return () => clearTimeout(timer);
  }, [availablePhone]);

  // Real-time call center events for sound & notifications.
  //
  // This must use the AUTHENTICATED socket from SocketContext. The page used to
  // listen on the singleton in lib/socket.ts, which is created without an auth
  // token — so the server never set socket.userUuid and the connection handler
  // never joined it to `user:<id>`. Every targeted emit
  // (io.to(`user:${agentId}`) in influencer.routes.ts and public.routes.ts) was
  // therefore invisible to this page, which is why no toast and no sound ever
  // fired. Its connectToCallCenter() joined a `callcenter` room that nothing in
  // the backend ever emits to.
  useEffect(() => {
    if (!socket) return;

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const handleNewAvailableLead = (lead: any) => {
      // Respect an active influencer filter, as the old duplicate handler did.
      const filterId = selectedInfluencerIdRef.current;
      if (filterId && lead.influencer?.id !== filterId) return;

      setAvailableLeads((prev) => {
        if (prev.some((l) => l.id === lead.id)) return prev;
        // Appended rather than prepended: the pool is ordered most-claimed
        // first, and a lead arriving now has never been claimed, so the bottom
        // is where it belongs — and where the next poll would put it anyway.
        return [...prev, lead];
      });
      setTotalAvailableCount((prev) => prev + 1);

      try {
        const audio = new Audio('/soundes/bell-ding.mp3');
        audio.volume = 0.85;
        audio.play().catch(() => {});
      } catch (e) {}

      toast.success('⚡ Nouveau lead disponible !', { icon: '🔔', duration: 4000 });

      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('⚡ Nouveau lead disponible !', {
            body: `Le lead de ${lead.fullName || 'Client'} est disponible à réclamer.`,
            icon: '/new logo/logo filess-25.svg',
          });
        } catch (e) {}
      }
    };

    const handleLeadClaimed = ({ leadId }: { leadId: number }) => {
      setAvailableLeads((prev) => prev.filter((l) => l.id !== leadId));
    };

    socket.on('new-available-lead', handleNewAvailableLead);
    socket.on('lead-claimed', handleLeadClaimed);

    return () => {
      socket.off('new-available-lead', handleNewAvailableLead);
      socket.off('lead-claimed', handleLeadClaimed);
      // Never disconnect here: the context socket is shared app-wide, and tearing
      // it down would kill chat and notifications everywhere else.
    };
  }, [socket]);

  const loadCities = async (): Promise<any[]> => {
    if (coliatyCities.length > 0) return coliatyCities;
    try {
      const res = await leadsApi.getColiatyCities();
      const list = res.data?.data || [];
      setColiatyCities(list);
      return list;
    } catch (err: any) {
      // Not fatal: the push falls back to the city stored on the lead and lets
      // the server (and Coliaty) have the final say.
      console.error('[Coliaty] Failed to load city list', err);
      return [];
    }
  };

  /**
   * Maps a free-text lead city onto its official Coliaty spelling.
   *
   * A lead stored as "agadir" has to be sent as the exact "AGADIR" Coliaty
   * publishes. Returns '' when there is no match — which is what blocks the push
   * before a parcel is attempted for a city Coliaty does not know.
   */
  const resolveColiatyCity = (rawCity: string, cities: any[]): string =>
    findColiatyCity(rawCity, cities)?.city_name || '';

  /** A lead can only be shipped once, and only after the confirmation call. */
  const canPushToDelivery = (lead: any) =>
    ['ORDERED', 'CONFIRMED'].includes(lead.status) && !lead.order?.coliatyPackageCode;

  const deliverableLeads = useMemo(() => myLeads.filter(canPushToDelivery), [myLeads]);

  /**
   * The single freshest card in the pool, for the "LEAD RÉCENT 🔥" badge.
   *
   * Read off the timestamps rather than off a position: the pool is ordered by
   * claim count now, so the newest arrival is no longer simply the last card
   * (it is only last among the never-claimed band, and a full page of claimed
   * leads can push it off the list entirely).
   */
  const newestAvailableId = useMemo(() => {
    let newestId: number | null = null;
    let newestTime = -Infinity;
    for (const lead of availableLeads) {
      const time = new Date(lead.updatedAt || lead.createdAt).getTime();
      if (!isNaN(time) && time > newestTime) {
        newestTime = time;
        newestId = lead.id;
      }
    }
    return newestId;
  }, [availableLeads]);

  // Leads leave this list as they ship (or when a filter changes), so drop any
  // id that is no longer selectable rather than pushing a stale selection.
  useEffect(() => {
    setSelectedLeadIds((prev) => {
      if (prev.size === 0) return prev;
      const allowed = new Set(deliverableLeads.map((l: any) => l.id));
      const next = new Set(Array.from(prev).filter((id) => allowed.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [deliverableLeads]);

  const toggleLeadSelection = (leadId: number) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  const allDeliverableSelected =
    deliverableLeads.length > 0 && deliverableLeads.every((l: any) => selectedLeadIds.has(l.id));

  const toggleSelectAll = () => {
    setSelectedLeadIds(allDeliverableSelected ? new Set() : new Set(deliverableLeads.map((l: any) => l.id)));
  };

  /**
   * Ships one lead with what is already on its card. The server falls back to the
   * lead's own name/phone/address/notes for anything omitted, so only the values
   * that need normalising (the city) or that the server cannot infer are sent.
   * The price is left out when the card has none, so the server bills the pack or
   * retail price instead of a 0 MAD COD.
   */
  const pushLeadToDelivery = async (lead: any, cities: any[]) => {
    const resolvedCity = resolveColiatyCity(lead.city, cities);
    if (!resolvedCity && cities.length > 0) {
      throw new Error(`Ville « ${lead.city || 'non renseignée'} » inconnue de Coliaty — corrigez-la dans la fiche du lead.`);
    }

    const payload: Parameters<typeof leadsApi.pushToDelivery>[1] = {
      productId: lead.product?.id || 0,
    };
    if (resolvedCity) payload.package_city = resolvedCity;
    if (Number(lead.productPrice) > 0) payload.package_price = Number(lead.productPrice);
    if (lead.productVariant) payload.productVariant = lead.productVariant;

    await leadsApi.pushToDelivery(lead.id, payload);
  };

  const playDeliverySound = () => {
    try {
      const audio = new Audio('/soundes/correct-confirmation.mp3');
      audio.volume = 0.85;
      audio.play().catch(() => {});
    } catch (e) {}
  };

  const handlePushToDelivery = async (lead: any) => {
    if (pushingIds.has(lead.id) || bulkPushing) return;
    setPushingIds((prev) => new Set(prev).add(lead.id));
    try {
      const cities = await loadCities();
      await pushLeadToDelivery(lead, cities);
      playDeliverySound();
      toast.success(theme === 'girly' ? 'Lead poussé à la livraison sur Coliaty! 🎀' : 'Lead envoyé à la livraison!');
      setSelectedLeadIds((prev) => {
        const next = new Set(prev);
        next.delete(lead.id);
        return next;
      });
      loadData();
    } catch (err: any) {
      console.error('[Coliaty Push Error]', err.response?.data);
      toast.error(err.response?.data?.message || err.message || 'Erreur lors de la création de la commande');
    } finally {
      setPushingIds((prev) => {
        const next = new Set(prev);
        next.delete(lead.id);
        return next;
      });
    }
  };

  /**
   * Ships the whole selection, one parcel at a time so a single rejected lead
   * (unknown city, stock shortage) never takes the rest of the batch with it.
   */
  const handleBulkPushToDelivery = async () => {
    const targets = deliverableLeads.filter((l: any) => selectedLeadIds.has(l.id));
    if (targets.length === 0 || bulkPushing) return;

    const confirmed = window.confirm(
      `Envoyer ${targets.length} lead${targets.length > 1 ? 's' : ''} à la livraison ?\n\nUn colis Coliaty sera créé pour chacun — cette action est irréversible.`
    );
    if (!confirmed) return;

    setBulkPushing(true);
    const toastId = toast.loading(`Envoi 0/${targets.length}...`);
    const cities = await loadCities();
    const failures: string[] = [];
    let sent = 0;

    for (const lead of targets) {
      try {
        await pushLeadToDelivery(lead, cities);
        sent++;
        setSelectedLeadIds((prev) => {
          const next = new Set(prev);
          next.delete(lead.id);
          return next;
        });
      } catch (err: any) {
        console.error('[Coliaty Bulk Push Error]', lead.id, err.response?.data);
        failures.push(`${lead.fullName}: ${err.response?.data?.message || err.message || 'erreur inconnue'}`);
      }
      toast.loading(`Envoi ${sent + failures.length}/${targets.length}...`, { id: toastId });
    }

    toast.dismiss(toastId);
    if (sent > 0) {
      playDeliverySound();
      toast.success(
        `${sent} lead${sent > 1 ? 's' : ''} envoyé${sent > 1 ? 's' : ''} à la livraison${theme === 'girly' ? ' 🎀' : ''}`
      );
    }
    if (failures.length > 0) {
      toast.error(
        `${failures.length} échec${failures.length > 1 ? 's' : ''} — ${failures.slice(0, 3).join(' • ')}` +
          (failures.length > 3 ? ` • … et ${failures.length - 3} autre${failures.length - 3 > 1 ? 's' : ''}.` : ''),
        { duration: 10000 }
      );
    }

    setBulkPushing(false);
    loadData();
  };

  useEffect(() => {
    loadData();

    // Real-time listeners live in the mount-once effect above, which is the only
    // place that plays the sound and raises the desktop notification. This effect
    // re-runs whenever a filter changes (loadData is rebuilt from the filter
    // state), and it previously registered a second 'new-available-lead' handler
    // whose cleanup called socket.off('new-available-lead') with no handler
    // argument — which removes EVERY listener for the event, including the one
    // that plays the sound. After the agent touched any filter, the sound was
    // gone for the rest of the session.

    // Poll every 8s as fallback
    const interval = setInterval(loadData, 8000);

    return () => {
      clearInterval(interval);
    };
  }, [loadData, selectedInfluencerId, theme]);

  const handleCall = async (phone: string, leadId: number) => {
    recordContactClick(leadId, 'CALL');
    window.location.href = `tel:${phone}`;
    try {
      if (myLeads.find(l => l.id === leadId)?.status === 'ASSIGNED') {
         await leadsApi.updateStatus(leadId.toString(), { status: 'CONTACTED' });
         loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClaim = async (leadId: number) => {
    if (hasActiveLead) {
      toast.error(theme === 'girly' ? 'Terminez votre lead en cours avant d\'en réclamer un autre. 💕' : 'Vous avez déjà un lead en cours.');
      if (activeLeadId) navigate(`/agent/leads/${activeLeadId}`);
      return;
    }
    setClaiming(leadId);
    try {
      await leadsApi.claim(leadId);
      toast.success(theme === 'girly' ? 'Lead réclamé avec succès! ✨' : 'Lead réclamé avec succès.');
      navigate(`/agent/leads/${leadId}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Ce lead a déjà été pris!');
      loadData();
    } finally {
      setClaiming(null);
    }
  };

  const isClassic = theme === 'classic';
  const isGirly = theme === 'girly';
  const isPrincess = theme === 'princess';

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-1 sm:px-4">
      {/* Sparkly Header */}
      <div className={`rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden transition-all duration-500 ${
        isPrincess
          ? 'bg-gradient-to-r from-amber-500 via-pink-500 to-rose-600'
          : isGirly 
          ? 'bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-500' 
          : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700'
      }`}>
        <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]"></div>
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2.5">
              {isPrincess ? (
                <div className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 rounded-full text-xs font-black uppercase tracking-wider">
                  <Heart className="w-3.5 h-3.5 fill-current animate-pulse text-white" /> Espace Princess Royal 👑
                </div>
              ) : isGirly ? (
                <div className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 rounded-full text-xs font-black uppercase tracking-wider">
                  <Heart className="w-3.5 h-3.5 fill-current animate-pulse text-white" /> Espace Leads Féminin
                </div>
              ) : (
                <div className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 rounded-full text-xs font-black uppercase tracking-wider">
                  <Activity className="w-3.5 h-3.5 text-white animate-pulse" /> Espace Leads Classique
                </div>
              )}
              
              {/* Theme Dropdown Select */}
              <div className="relative inline-block">
                <select
                  value={theme}
                  onChange={(e) => changeTheme(e.target.value as any)}
                  className={`pl-3 pr-8 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-300 shadow-sm border outline-none appearance-none cursor-pointer ${
                    isPrincess 
                      ? 'bg-white text-rose-600 border-white hover:bg-rose-50'
                      : isGirly 
                      ? 'bg-white text-pink-600 border-pink-200/50 hover:bg-pink-50' 
                      : 'bg-white text-indigo-700 border-white hover:bg-indigo-50'
                  }`}
                >
                  <option value="classic" className="text-gray-900 bg-white font-bold">🕶️ Classique</option>
                  <option value="girly" className="text-gray-900 bg-white font-bold">🌸 Thème Girly ✨</option>
                  <option value="princess" className="text-gray-900 bg-white font-bold">💅 Princess Pink 👑</option>
                </select>
                <div className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none font-black text-[8px] ${
                  isPrincess ? 'text-rose-600' : isGirly ? 'text-pink-600' : 'text-indigo-700'
                }`}>
                  ▼
                </div>
              </div>
            </div>

            <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-2 flex items-center gap-2">
              {isPrincess ? 'Gestion Royale des Leads 👑✨' : isGirly ? 'Gestion des Leads 🌸' : 'Gestion des Leads 📋'}
            </h1>
            <p className="text-white/90 text-xs sm:text-sm font-medium">Réclamez des leads et contactez-les avec douceur et efficacité !</p>
          </div>
          {hasActiveLead && activeLeadId && (
            <button
              onClick={() => navigate(`/agent/leads/${activeLeadId}`)}
              className={`px-6 py-3 rounded-2xl text-xs font-black transition-all duration-300 shadow-lg flex items-center gap-2 animate-bounce self-start md:self-auto ${
                isPrincess ? 'bg-white text-rose-600 hover:bg-rose-50' : isGirly ? 'bg-white text-pink-600 hover:bg-pink-50' : 'bg-white text-indigo-700 hover:bg-indigo-50'
              }`}
            >
              {isPrincess || isGirly ? (
                <Sparkles className={`w-4 h-4 animate-pulse ${isPrincess ? 'text-amber-500' : 'text-pink-500'}`} />
              ) : (
                <Activity className="w-4 h-4 text-indigo-500 animate-pulse" />
              )}
              Continuer mon lead en cours
            </button>
          )}
        </div>
      </div>

      {/* Available Leads Pool */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex items-center gap-2">
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                {isPrincess ? (
                  <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                ) : isGirly ? (
                  <Sparkles className="w-5 h-5 text-pink-500 animate-pulse" />
                ) : (
                  <Zap className="w-5 h-5 text-indigo-500 animate-pulse" />
                )}
                Leads Disponibles
              </h2>
              {availableLeads.length > 0 && (
                <span className={`text-white text-[10px] font-black rounded-full px-2 py-0.5 shadow-md ${
                  isPrincess ? 'bg-amber-500 shadow-amber-200' : isGirly ? 'bg-pink-500 shadow-pink-200' : 'bg-indigo-500 shadow-indigo-200'
                }`}>
                  {availableLeads.length} {totalAvailableCount > availableLeads.length ? `/ ${totalAvailableCount}` : ''}
                </span>
              )}
            </div>

            {/* Limit Selector */}
            <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-xl">
              <span className="text-[10px] font-black text-gray-400 uppercase px-1.5">Afficher:</span>
              {([6, 20, 50, 100, 200, 'max'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setAvailableLimit(opt)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-black transition-all ${
                    availableLimit === opt
                      ? isPrincess
                        ? 'bg-amber-500 text-white shadow-xs'
                        : isGirly
                        ? 'bg-pink-500 text-white shadow-xs'
                        : 'bg-indigo-600 text-white shadow-xs'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  {opt === 'max' ? 'Tout' : opt}
                </button>
              ))}
            </div>
          </div>
          
          {assignedInfluencers.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 relative w-full sm:w-auto" ref={dropdownRef}>
              <Filter className={`w-4 h-4 shrink-0 ${isPrincess ? 'text-amber-400' : isGirly ? 'text-pink-400' : 'text-indigo-400'}`} />
              <span className="text-xs font-black text-gray-500 uppercase">Vendeur/Influenceur:</span>

              <div className="relative w-full sm:w-auto sm:min-w-[240px]">
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(!isDropdownOpen);
                    setDropdownSearch('');
                  }}
                  className={`w-full flex items-center justify-between py-1.5 px-3 border rounded-xl bg-white text-xs font-bold text-gray-700 outline-none shadow-sm text-left hover:bg-gray-50 transition-all ${
                    isPrincess ? 'border-amber-100' : isGirly ? 'border-pink-100' : 'border-indigo-100'
                  }`}
                >
                  <span className="truncate min-w-0">
                    {selectedInfluencerId
                      ? assignedInfluencers.find(inf => inf.id === selectedInfluencerId)?.fullName || `Tous mes influenceurs/vendeurs ${isPrincess ? '👑' : isGirly ? '🌸' : '📋'}`
                      : `Tous mes influenceurs/vendeurs ${isPrincess ? '👑' : isGirly ? '🌸' : '📋'}`
                    }
                  </span>
                  <span className="text-gray-400 shrink-0 ml-2">▼</span>
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-full sm:w-72 bg-white rounded-2xl border border-gray-100 shadow-xl z-50 p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="relative">
                      <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">🔍</span>
                      <input
                        type="text"
                        autoFocus
                        value={dropdownSearch}
                        onChange={(e) => setDropdownSearch(e.target.value)}
                        placeholder="Rechercher par nom ou email..."
                        className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedInfluencerId('');
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-colors flex flex-col gap-0.5 ${
                          selectedInfluencerId === ''
                            ? 'bg-indigo-50 text-indigo-600'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span>Tous mes influenceurs/vendeurs {isPrincess ? '👑' : isGirly ? '🌸' : '📋'}</span>
                      </button>

                      {assignedInfluencers
                        .filter(inf => 
                          (inf.fullName || '').toLowerCase().includes(dropdownSearch.toLowerCase()) ||
                          (inf.email || '').toLowerCase().includes(dropdownSearch.toLowerCase())
                        )
                        .map(inf => (
                          <button
                            key={inf.id}
                            type="button"
                            onClick={() => {
                              setSelectedInfluencerId(inf.id);
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-colors flex flex-col gap-0.5 mt-1 ${
                              selectedInfluencerId === inf.id
                                ? 'bg-indigo-50 text-indigo-600'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <span className="font-extrabold">{inf.fullName}</span>
                            {inf.email && (
                              <span className="text-[10px] text-gray-400 font-medium normal-case">{inf.email}</span>
                            )}
                          </button>
                        ))
                      }

                      {assignedInfluencers.filter(inf => 
                        (inf.fullName || '').toLowerCase().includes(dropdownSearch.toLowerCase()) ||
                        (inf.email || '').toLowerCase().includes(dropdownSearch.toLowerCase())
                      ).length === 0 && (
                        <p className="text-center text-[10px] text-gray-400 py-3 font-semibold">Aucun partenaire trouvé</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Search & filters over the available pool.
            Matching happens server-side (phone included) — the number itself is
            never rendered on a card, since the agent only gets it after claiming. */}
        <div className={`bg-white rounded-2xl border p-3 shadow-sm ${
          isPrincess ? 'border-amber-100' : isGirly ? 'border-pink-100' : 'border-indigo-100'
        }`}>
          <div className="flex flex-col lg:flex-row gap-2.5">
            <div className="w-full lg:w-[260px] flex-shrink-0">
              <SearchableSelect
                theme={theme}
                value={availableProductId}
                onChange={v => setAvailableProductId(v === '' ? '' : Number(v))}
                placeholder="Tous les produits"
                searchPlaceholder="Chercher un produit..."
                icon={<Package className="w-4 h-4" />}
                options={[
                  { value: '', label: 'Tous les produits' },
                  ...availableFilterOptions.products.map(p => ({ value: p.id, label: p.name })),
                ]}
              />
            </div>

            {/* Number lookup. Non-digits are stripped before the request, so a
                number pasted as +212 6 67 … or 0667-… searches the same. */}
            <div className="relative flex-1 min-w-0">
              <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="tel"
                inputMode="tel"
                value={availablePhone}
                onChange={(e) => setAvailablePhone(e.target.value)}
                placeholder="Chercher par numéro (0667…, +212667…)"
                className={`w-full pl-9 ${availablePhone ? 'pr-9' : 'pr-4'} py-2.5 border border-gray-200 bg-white rounded-xl outline-none text-sm font-bold shadow-sm transition-all placeholder:font-semibold placeholder:text-gray-400 hover:border-gray-300 focus:ring-2 ${
                  isPrincess ? 'focus:ring-amber-400' : isGirly ? 'focus:ring-pink-400' : 'focus:ring-indigo-400'
                }`}
              />
              {availablePhone && (
                <button
                  type="button"
                  onClick={() => setAvailablePhone('')}
                  title="Effacer la recherche"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {(availableProductId !== '' || debouncedPhone !== '') && (
            <div className="flex items-center gap-2 flex-wrap mt-2.5 pt-2.5 border-t border-gray-50">
              <span className="text-[11px] font-black text-gray-500">
                {totalAvailableCount} résultat{totalAvailableCount > 1 ? 's' : ''}
                {totalScopeCount > totalAvailableCount && (
                  <span className="text-gray-300 font-bold"> sur {totalScopeCount} disponibles</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => {
                  setAvailableProductId('');
                  setAvailablePhone('');
                }}
                className="ml-auto px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                Réinitialiser
              </button>
            </div>
          )}
        </div>

        {availableLeads.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableLeads.map((lead) => {
              const isNew = isNewLead(lead);
              const isTopNewest = isNew && lead.id === newestAvailableId;

              return (
                <div
                  key={lead.id}
                  className={`relative bg-white rounded-3xl border-2 border-dashed p-5 hover:shadow-xl transition-all duration-300 group hover:-translate-y-1 ${
                    isNew
                      ? isPrincess
                        ? 'border-amber-400 ring-2 ring-amber-400/50 shadow-lg shadow-amber-100/80'
                        : isGirly
                        ? 'border-pink-400 ring-2 ring-pink-400/50 shadow-lg shadow-pink-100/80'
                        : 'border-indigo-400 ring-2 ring-indigo-400/50 shadow-lg shadow-indigo-100/80'
                      : isPrincess
                      ? 'border-amber-200 hover:border-amber-500 hover:shadow-amber-50/55'
                      : isGirly 
                      ? 'border-pink-200 hover:border-pink-500 hover:shadow-pink-50/55' 
                      : 'border-indigo-200 hover:border-indigo-500 hover:shadow-indigo-50/55'
                  }`}
                >
                  {/* 5-Minute NOUVEAU Badge */}
                  {isNew && (
                    <div className="absolute -top-3.5 left-4 z-10">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-lg border border-white animate-bounce ${
                        isTopNewest
                          ? 'bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 shadow-rose-500/40'
                          : isPrincess
                          ? 'bg-gradient-to-r from-amber-500 via-pink-500 to-rose-500 shadow-amber-500/30'
                          : isGirly
                          ? 'bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 shadow-pink-500/30'
                          : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-indigo-500/30'
                      }`}>
                        <Sparkles className="w-3 h-3 text-yellow-300 fill-yellow-300 animate-spin" />
                        {isTopNewest ? 'LEAD RÉCENT 🔥' : 'NOUVEAU ✨'}
                      </span>
                    </div>
                  )}

                  <div className="absolute top-4 right-4">
                    <span className="relative flex h-3 w-3">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        isPrincess ? 'bg-amber-400' : isGirly ? 'bg-pink-400' : 'bg-indigo-400'
                      }`}></span>
                      <span className={`relative inline-flex rounded-full h-3 w-3 ${
                        isPrincess ? 'bg-amber-500' : isGirly ? 'bg-pink-500' : 'bg-indigo-500'
                      }`}></span>
                    </span>
                  </div>

                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black shadow-inner border border-white ${
                    isPrincess ? 'bg-amber-100 text-amber-600' : isGirly ? 'bg-pink-100 text-pink-600' : 'bg-indigo-100 text-indigo-600'
                  }`}>
                    {lead.fullName?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className={`font-bold text-gray-900 transition-colors ${
                      isPrincess ? 'group-hover:text-amber-600' : isGirly ? 'group-hover:text-pink-600' : 'group-hover:text-indigo-600'
                    }`}>{lead.fullName}</p>
                    <p className="text-xs text-gray-400 font-medium">📍 {lead.city || 'Ville inconnue'}</p>
                  </div>
                </div>

                {/* No claim-count badge on the card, on purpose. `claimCount`
                    is still computed and still sent — it is what orders the
                    pool (most-claimed at the head, never-claimed at the foot,
                    and the row limit cutting from the top) — the agent just
                    does not get told how many hands a lead has been through. */}

                {lead.product && (
                  <div className={`flex items-center gap-3 mb-4 p-2.5 rounded-2xl border ${
                    isPrincess ? 'bg-amber-50/30 border-amber-100/20' : isGirly ? 'bg-pink-50/30 border-pink-100/20' : 'bg-indigo-50/30 border-indigo-100/20'
                  }`}>
                    {lead.product.image && (
                      <img src={lead.product.image} alt="" className={`w-10 h-10 rounded-xl object-cover border ${
                        isPrincess ? 'border-amber-100' : isGirly ? 'border-pink-100' : 'border-indigo-100'
                      }`} />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-700 truncate">{lead.product.name}</p>
                      <p className="text-[10px] text-gray-400 font-medium">SKU: {lead.product.sku}</p>
                      {lead.productVariant && (
                        <p className={`text-[9px] font-black truncate mt-1 px-2 py-0.5 bg-white rounded-full w-fit border ${
                          isPrincess ? 'text-amber-600 border-amber-100/50' : isGirly ? 'text-pink-600 border-pink-100/50' : 'text-indigo-600 border-indigo-100/50'
                        }`}>
                          📦 {lead.productVariant}
                        </p>
                      )}
                    </div>
                    {lead.productPrice > 0 && (
                      <span className={`text-xs font-black bg-white border px-2 py-1 rounded-xl whitespace-nowrap shadow-sm ${
                        isPrincess ? 'text-amber-600 border-amber-100' : isGirly ? 'text-pink-600 border-pink-100' : 'text-indigo-600 border-indigo-100'
                      }`}>
                        {Number(lead.productPrice).toFixed(2)} MAD
                      </span>
                    )}
                  </div>
                )}

                {lead.influencer && (
                  <div className="flex items-center text-[10px] text-gray-400 font-medium mb-4">
                    <span>Par: <span className="text-gray-600 font-bold">{lead.influencer.fullName}</span></span>
                  </div>
                )}

                <button
                  onClick={() => handleClaim(lead.id)}
                  disabled={claiming === lead.id || hasActiveLead}
                  className={`w-full py-3 rounded-2xl text-xs font-black tracking-widest transition-all duration-300 ${
                    hasActiveLead
                      ? 'bg-gray-50 text-gray-400 border border-gray-100 cursor-not-allowed'
                      : claiming === lead.id
                        ? (isPrincess ? 'bg-amber-300 text-white cursor-wait' : isGirly ? 'bg-pink-300 text-white cursor-wait' : 'bg-indigo-300 text-white cursor-wait')
                        : (isPrincess
                            ? 'bg-gradient-to-r from-amber-500 via-pink-500 to-rose-500 text-white hover:opacity-95 shadow-lg shadow-amber-100 hover:shadow-xl active:scale-95'
                            : isGirly 
                            ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:opacity-95 shadow-lg shadow-pink-100 hover:shadow-xl active:scale-95' 
                            : 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:opacity-95 shadow-lg shadow-indigo-100 hover:shadow-xl active:scale-95')
                  }`}
                >
                  {claiming === lead.id ? '⏳ RÉCLAMATION...' : hasActiveLead ? '🔒 DÉJÀ UN LEAD EN COURS' : (isPrincess ? '👑 RÉCLAMER CE LEAD' : isGirly ? '💖 RÉCLAMER CE LEAD' : '⚡ RÉCLAMER CE LEAD')}
                </button>
              </div>
            );
          })}
          </div>
        ) : (
          <div className={`bg-white rounded-3xl border p-12 text-center shadow-sm ${isPrincess ? 'border-amber-100/50' : isGirly ? 'border-pink-100/50' : 'border-indigo-100/50'}`}>
            {isPrincess ? (
              <Heart className="w-12 h-12 text-amber-300 mx-auto mb-4 fill-current animate-pulse" />
            ) : isGirly ? (
              <Heart className="w-12 h-12 text-pink-300 mx-auto mb-4 fill-current animate-pulse" />
            ) : (
              <Zap className="w-12 h-12 text-indigo-300 mx-auto mb-4 animate-pulse" />
            )}
            {debouncedPhone !== '' ? (
              <>
                <p className="text-gray-900 font-black text-sm">Aucun lead avec ce numéro.</p>
                <p className="text-gray-400 text-xs mt-1 font-medium">
                  Le numéro « {availablePhone} » n'est dans aucun lead disponible
                  {availableProductId !== '' ? ' pour ce produit' : ''}. Il est peut-être déjà
                  réclamé par un autre agent.
                </p>
                <button
                  type="button"
                  onClick={() => setAvailablePhone('')}
                  className={`mt-5 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider text-white transition-all active:scale-95 ${
                    isPrincess ? 'bg-amber-500 hover:bg-amber-600' : isGirly ? 'bg-pink-500 hover:bg-pink-600' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  Effacer la recherche
                </button>
              </>
            ) : availableProductId !== '' ? (
              <>
                <p className="text-gray-900 font-black text-sm">Aucun lead pour ce produit.</p>
                <p className="text-gray-400 text-xs mt-1 font-medium">
                  {totalScopeCount > 0
                    ? `${totalScopeCount} lead${totalScopeCount > 1 ? 's' : ''} disponible${totalScopeCount > 1 ? 's' : ''} sans filtre.`
                    : 'Aucun lead disponible pour le moment.'}
                </p>
                <button
                  type="button"
                  onClick={() => setAvailableProductId('')}
                  className={`mt-5 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider text-white transition-all active:scale-95 ${
                    isPrincess ? 'bg-amber-500 hover:bg-amber-600' : isGirly ? 'bg-pink-500 hover:bg-pink-600' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  Voir tous les produits
                </button>
              </>
            ) : (
              <>
                <p className="text-gray-900 font-black text-sm">{isPrincess || isGirly ? 'Tout est tranquille pour l\'instant ! ✨' : 'Aucun lead disponible.'}</p>
                <p className="text-gray-400 text-xs mt-1 font-medium">Les nouveaux leads apparaîtront ici dès qu'ils arrivent.</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* My Claimed Leads */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
            📋 Mes Leads Assignés ({myLeads.length})
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black text-gray-400 uppercase">Statut:</span>
            <select
              value={statusFilter}
              onChange={(e) => applyStatusFilter(e.target.value)}
              className={`py-1.5 px-3 border rounded-xl bg-white text-xs font-bold text-gray-700 focus:ring-2 outline-none cursor-pointer shadow-sm ${
                isPrincess ? 'border-amber-100 focus:ring-amber-400' : isGirly ? 'border-pink-100 focus:ring-pink-400' : 'border-indigo-100 focus:ring-indigo-400'
              }`}
            >
              <option value="">Tous les statuts {isPrincess ? '👑' : isGirly ? '🌸' : '📋'}</option>
              <option value="ASSIGNED">Assigné</option>
              <option value="CALL_LATER">Rappel</option>
              <option value="NO_REPLY">Pas de réponse</option>
              <option value="CONFIRMED">Confirmé</option>
              <option value="WRONG_ORDER">Mauvaise commande</option>
              <option value="CANCEL_REASON_PRICE">Annulé - Prix</option>
              <option value="CANCEL_ORDER">Annulé</option>
              <option value="PRICE_CONFIRMED">Price CONFIRMED</option>
              <option value="INVALID">Invalide</option>
            </select>
          </div>
        </div>

        {/* Arrived from a dashboard tile. Says so plainly, because this is the
            one view that lists leads no longer assigned to the agent — without
            the banner they read as a bug rather than as history. */}
        {historyStatus && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-2.5">
            <p className="text-xs font-bold text-indigo-800">
              🕘 Historique : les leads que vous avez marqués{' '}
              <span className="font-black">{historyStatus.replace(/_/g, ' ')}</span>
              {historyRange.dateFrom || historyRange.dateTo ? ' sur la période choisie' : ''} — y compris
              ceux déjà repartis dans le pool.
            </p>
            <button
              type="button"
              onClick={clearHistoryFilter}
              className="shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-100 transition-colors"
            >
              Effacer le filtre
            </button>
          </div>
        )}

        {/* Bulk delivery bar — only leads past the confirmation call and without a
            parcel yet can be shipped, so the selection is limited to those. */}
        {deliverableLeads.length > 0 && (
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl border p-3 shadow-sm ${
            isPrincess ? 'border-amber-100' : isGirly ? 'border-pink-100' : 'border-indigo-100'
          }`}>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allDeliverableSelected}
                onChange={toggleSelectAll}
                disabled={bulkPushing}
                className={`w-4 h-4 rounded border-gray-300 cursor-pointer disabled:cursor-not-allowed ${
                  isPrincess ? 'text-amber-500 focus:ring-amber-400' : isGirly ? 'text-pink-500 focus:ring-pink-400' : 'text-indigo-600 focus:ring-indigo-400'
                }`}
              />
              <span className="text-xs font-black text-gray-700 uppercase tracking-wider">
                Tout sélectionner
              </span>
              <span className="text-[11px] font-bold text-gray-400">
                {selectedLeadIds.size} / {deliverableLeads.length} prêt{deliverableLeads.length > 1 ? 's' : ''} à expédier
              </span>
            </label>

            <div className="flex items-center gap-2">
              {selectedLeadIds.size > 0 && !bulkPushing && (
                <button
                  type="button"
                  onClick={() => setSelectedLeadIds(new Set())}
                  className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Effacer
                </button>
              )}
              <button
                type="button"
                onClick={handleBulkPushToDelivery}
                disabled={selectedLeadIds.size === 0 || bulkPushing}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-1.5 ${
                  selectedLeadIds.size === 0 || bulkPushing
                    ? 'bg-gray-50 text-gray-400 border border-gray-100 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:opacity-95 active:scale-95'
                }`}
              >
                {bulkPushing
                  ? '⏳ Envoi en cours...'
                  : `🚚 Envoyer tout à la livraison${selectedLeadIds.size > 0 ? ` (${selectedLeadIds.size})` : ''}`}
              </button>
            </div>
          </div>
        )}

        {myLeads.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myLeads.map((lead: any) => {
              const isDeliverable = canPushToDelivery(lead);
              const isSelected = selectedLeadIds.has(lead.id);
              const isPushing = pushingIds.has(lead.id);

              return (
              <div
                key={lead.id}
                className={`bg-white rounded-3xl border shadow-sm hover:shadow-md transition-all duration-300 p-5 relative overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? isPrincess
                      ? 'border-amber-300 ring-2 ring-amber-200'
                      : isGirly
                      ? 'border-pink-300 ring-2 ring-pink-200'
                      : 'border-indigo-300 ring-2 ring-indigo-200'
                    : 'border-gray-100'
                }`}
              >
                <div className={`absolute top-0 left-0 w-1.5 h-full ${isPrincess ? 'bg-amber-400' : isGirly ? 'bg-pink-400' : 'bg-indigo-400'}`}></div>
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {isDeliverable && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleLeadSelection(lead.id)}
                          disabled={bulkPushing || isPushing}
                          title="Sélectionner pour l'envoi groupé"
                          className={`w-4 h-4 shrink-0 rounded border-gray-300 cursor-pointer disabled:cursor-not-allowed ${
                            isPrincess ? 'text-amber-500 focus:ring-amber-400' : isGirly ? 'text-pink-500 focus:ring-pink-400' : 'text-indigo-600 focus:ring-indigo-400'
                          }`}
                        />
                      )}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black shadow-inner border border-white ${
                        isPrincess ? 'bg-amber-100 text-amber-600' : isGirly ? 'bg-pink-100 text-pink-600' : 'bg-indigo-100 text-indigo-600'
                      }`}>
                        {lead.fullName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 truncate">{lead.fullName}</p>
                        <p className="text-xs text-gray-400 font-medium truncate">📍 {lead.city || 'Ville inconnue'}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        lead.status === 'ASSIGNED' ? 'bg-purple-100 text-purple-700' :
                        lead.status === 'CALL_LATER' ? 'bg-orange-100 text-orange-700' :
                        lead.status === 'NO_REPLY' ? 'bg-rose-100 text-rose-700' :
                        lead.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' :
                        lead.status === 'WRONG_ORDER' ? 'bg-amber-100 text-amber-700' :
                        lead.status === 'CANCEL_REASON_PRICE' ? 'bg-red-100 text-red-700' :
                        lead.status === 'CANCEL_ORDER' ? 'bg-red-100 text-red-700' :
                        lead.status === 'PRICE_CONFIRMED' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {lead.status === 'PRICE_CONFIRMED' ? 'PRIX CONFIRMÉ' : lead.status}
                      </span>
                      <AssignedTimer lead={lead} onTimeout={loadData} isGirly={isGirly} isPrincess={isPrincess} />
                      <ReleaseCountdown lead={lead} onExpire={loadData} />
                      {lead.callbackAt && lead.status === 'CALL_LATER' && (
                        <span className={`text-[9px] font-black bg-white px-2 py-0.5 rounded border flex items-center gap-1 animate-pulse ${
                          isPrincess ? 'text-amber-600 border-amber-100' : isGirly ? 'text-pink-600 border-pink-100' : 'text-indigo-600 border-indigo-100'
                        }`}>
                          ⏰ {format(new Date(lead.callbackAt), 'dd/MM à HH:mm')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 mb-4">
                    <a
                      href={`tel:${lead.phone}`}
                      onClick={() => handleCallClick(lead.id)}
                      className={`text-xs font-black flex items-center gap-1 px-2.5 py-1.5 rounded-xl border ${
                        isPrincess
                          ? 'text-amber-600 hover:text-amber-700 bg-amber-50 border-amber-100'
                          : isGirly
                          ? 'text-pink-500 hover:text-pink-600 bg-pink-50 border-pink-100' 
                          : 'text-indigo-500 hover:text-indigo-600 bg-indigo-50 border-indigo-100'
                      }`}
                    >
                      📞 {lead.phone}
                    </a>
                    <a
                      href={`https://wa.me/212${(lead.whatsapp || lead.phone || '').replace(/[^0-9]/g, '').replace(/^(212|0)/, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleWaClick(lead.id)}
                      className={`text-xs font-bold transition-all flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border ${
                        clickedWaLeads.has(lead.id)
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm font-black'
                          : 'text-green-700 hover:bg-green-100 bg-green-50 border-green-200'
                      }`}
                    >
                      {clickedWaLeads.has(lead.id) ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-white stroke-[3]" /> WhatsApp (Cliqué)
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-3.5 h-3.5 text-green-600" /> WhatsApp
                        </>
                      )}
                    </a>
                  </div>

                  {lead.product && (
                    <div className="flex items-center gap-2 mb-4 p-2 bg-gray-50 rounded-2xl border border-gray-100">
                      {lead.product.image && (
                        <img src={lead.product.image} alt="" className="w-8 h-8 rounded-lg object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-gray-700 truncate">{lead.product.name}</p>
                        {lead.productVariant && (
                          <p className={`text-[9px] font-bold truncate mt-0.5 ${
                            isPrincess ? 'text-amber-600' : isGirly ? 'text-pink-600' : 'text-indigo-600'
                          }`}>
                            📦 {lead.productVariant}
                          </p>
                        )}
                      </div>
                      {lead.productPrice > 0 && (
                        <span className="text-[10px] font-black text-gray-900 bg-white border px-1.5 py-0.5 rounded-md">
                          {Number(lead.productPrice).toFixed(2)} MAD
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2 mt-auto">
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/agent/leads/${lead.id}`)}
                      className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                        lead.status === 'ASSIGNED' 
                          ? (isPrincess
                              ? 'bg-gradient-to-r from-amber-500 via-pink-500 to-rose-500 text-white hover:opacity-95 shadow-sm shadow-amber-500/10'
                              : isGirly 
                              ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:opacity-95 shadow-sm' 
                              : 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:opacity-95 shadow-sm')
                          : 'bg-gray-900 text-white hover:bg-black'
                      }`}
                    >
                      {lead.status === 'ASSIGNED' ? '▶ Traiter' : '👁️ Détails'}
                    </button>
                    <a
                      href={`tel:${lead.phone}`}
                      onClick={() => handleCall(lead.phone, lead.id)}
                      className={`flex-1 py-2 rounded-xl text-xs font-black transition-all text-center flex justify-center items-center gap-1 border ${
                        isPrincess
                          ? 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100'
                          : isGirly 
                          ? 'bg-pink-50 text-pink-600 border-pink-100 hover:bg-pink-100' 
                          : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100'
                      }`}
                    >
                      📞 Appeler
                    </a>
                  </div>
                  
                  {isDeliverable && (
                    <button
                      onClick={() => handlePushToDelivery(lead)}
                      disabled={isPushing || bulkPushing}
                      className={`w-full py-2 rounded-xl text-xs font-black transition-all shadow-md flex justify-center items-center gap-1.5 ${
                        isPushing || bulkPushing
                          ? 'bg-gray-50 text-gray-400 border border-gray-100 cursor-not-allowed shadow-none'
                          : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:opacity-95'
                      }`}
                    >
                      {isPushing ? '⏳ Envoi en cours...' : '🚚 Envoyer à la livraison'}
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-100 p-8 text-center shadow-sm">
            <p className="text-gray-400 font-medium text-xs">Réclamez des leads pour commencer your journée !</p>
          </div>
        )}
      </div>
    </div>
  );
}

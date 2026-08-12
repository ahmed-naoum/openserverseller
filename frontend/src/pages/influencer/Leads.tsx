import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { influencerApi, leadsApi } from '../../lib/api';
import { ReferralLink, InfluencerCommission, CustomerLinkMeta } from '../../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { DELIVERY_STATUSES, isConfirmedStatus, isConfirmedRow, isDeliveredRow, getDisplayStatus, getLeadDate } from '../../lib/leadStatus';
import {
  Users, MousePointerClick, UserCheck, ShoppingCart,
  Filter, Search, Calendar,
  MapPin, Phone, Package, Clock, Trash2, Headphones, RefreshCw,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Truck, CheckCircle, CheckCircle2, XCircle, Box, AlertCircle, X, BarChart3, Activity, PieChart as PieIcon, Zap, TrendingUp, History, MessageSquare
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

const ALL_STATUS_BADGES: Record<string, { label: string; color: string; icon: React.ComponentType<any> }> = {
  // --- Cycle de vie / Stock ---
  'NEW_PARCEL': { label: 'Nouveau Colis', color: 'bg-slate-50 text-slate-600 border border-slate-100', icon: Box },
  'WAITING_PICKUP': { label: 'Attente Collecte', color: 'bg-amber-50 text-amber-600 border border-amber-100', icon: Clock },
  'WAITING_PREPARATION': { label: 'Attente Préparation', color: 'bg-orange-50 text-orange-600 border border-orange-100', icon: Clock },
  'PREPARED': { label: 'Préparé', color: 'bg-emerald-50 text-emerald-600 border border-emerald-100', icon: CheckCircle2 },
  'ENCORE_PREPARED': { label: 'En préparation', color: 'bg-blue-50 text-blue-600 border border-blue-100', icon: RefreshCw },
  'PICKED_UP': { label: 'Collecté', color: 'bg-blue-50 text-blue-600 border border-blue-100', icon: Package },

  // --- En transit ---
  'SENT': { label: 'Expédié (Transporteur)', color: 'bg-violet-50 text-violet-600 border border-violet-100', icon: Truck },
  'RECEIVED': { label: 'Reçu (Destination)', color: 'bg-indigo-50 text-indigo-600 border border-indigo-100', icon: MapPin },
  'DISTRIBUTION': { label: 'En Distribution', color: 'bg-cyan-50 text-cyan-600 border border-cyan-100', icon: Truck },
  'PROGRAMMER_AUTO': { label: 'Livraison Auto', color: 'bg-purple-50 text-purple-600 border border-purple-100', icon: Calendar },
  'POSTPONED': { label: 'Reporté', color: 'bg-orange-50 text-orange-600 border border-orange-100', icon: Calendar },
  'NOANSWER': { label: 'Pas de réponse', color: 'bg-rose-50 text-rose-600 border border-rose-100', icon: Phone },
  'ERR': { label: 'Tél Erroné', color: 'bg-rose-50 text-rose-600 border border-rose-100', icon: Phone },
  'PROGRAMMER': { label: 'Programmé', color: 'bg-blue-50 text-blue-600 border border-blue-100', icon: Calendar },
  'INCORRECT_ADDRESS': { label: 'Adresse Erronée', color: 'bg-rose-50 text-rose-600 border border-rose-100', icon: MapPin },

  // --- Livraison terminée ---
  'DELIVERED': { label: 'Livré', color: 'bg-emerald-50 text-emerald-600 border border-emerald-100', icon: CheckCircle2 },
  'RETURNED': { label: 'Retourné', color: 'bg-orange-50 text-orange-600 border border-orange-100', icon: Box },

  // --- Annulations ---
  'CANCELED_BY_SELLER': { label: 'Annulé (Vendeur)', color: 'bg-red-50 text-red-600 border border-red-100', icon: X },
  'CANCELED_BY_SYSTEM': { label: 'Annulé (Système)', color: 'bg-red-50 text-red-600 border border-red-100', icon: AlertCircle },
  'CANCELED': { label: 'Annulé (Livreur)', color: 'bg-red-50 text-red-600 border border-red-100', icon: Trash2 },
  'REFUSE': { label: 'Refusé', color: 'bg-red-50 text-red-600 border border-red-100', icon: X },

  'PUSHED_TO_DELIVERY': { label: 'En livraison', color: 'bg-indigo-50 text-indigo-600 border border-indigo-100', icon: Truck },
  'CALL_LATER': { label: 'Rappel', color: 'bg-orange-50 text-orange-600 border border-orange-100', icon: Clock },

  // --- Legacy ---
  'LEAD': { label: 'Prospect', color: 'bg-indigo-50 text-indigo-600 border border-indigo-100', icon: Users },
  'AVAILABLE': { label: 'En attente (CC)', color: 'bg-yellow-50 text-yellow-600 border border-yellow-100', icon: Clock },
  'ASSIGNED': { label: 'Au Call Center', color: 'bg-cyan-50 text-cyan-600 border border-cyan-100', icon: Headphones },
  'PENDING': { label: 'En attente', color: 'bg-amber-50 text-amber-600 border border-amber-100', icon: Clock },
  'CONFIRMED': { label: 'Confirmé', color: 'bg-blue-50 text-blue-600 border border-blue-100', icon: CheckCircle2 },
  'SHIPPED': { label: 'Expédié', color: 'bg-violet-50 text-violet-600 border border-violet-100', icon: Truck },
  'CANCELLED': { label: 'Annulé', color: 'bg-red-50 text-red-600 border border-red-100', icon: AlertCircle },
  'PRICE_CONFIRMED': { label: 'Prix Confirmé', color: 'bg-blue-50 text-blue-600 border border-blue-100', icon: CheckCircle2 },
  'PRICE_REJECTED': { label: 'Prix Refusé', color: 'bg-rose-50 text-rose-600 border border-rose-100', icon: X },

  // --- Statuses that were reaching the UI without a badge and rendering as raw codes ---
  'CONFIRMED_DELIVERY': { label: 'Confirmé (Livraison)', color: 'bg-blue-50 text-blue-600 border border-blue-100', icon: Truck },
  'CALLBACK_REQUESTED': { label: 'Rappel Demandé', color: 'bg-orange-50 text-orange-600 border border-orange-100', icon: Clock },
  'ORDERED': { label: 'Commandé', color: 'bg-blue-50 text-blue-600 border border-blue-100', icon: ShoppingCart },
  'IN_PRODUCTION': { label: 'En Production', color: 'bg-amber-50 text-amber-600 border border-amber-100', icon: RefreshCw },
  'READY_FOR_SHIPPING': { label: 'Prêt à Expédier', color: 'bg-emerald-50 text-emerald-600 border border-emerald-100', icon: Package },
  'REFUNDED': { label: 'Remboursé', color: 'bg-teal-50 text-teal-600 border border-teal-100', icon: RefreshCw },
  'NO_REPLY': { label: 'Sans Réponse', color: 'bg-rose-50 text-rose-600 border border-rose-100', icon: Phone },
  'UNREACHABLE': { label: 'Injoignable', color: 'bg-slate-50 text-slate-600 border border-slate-100', icon: Phone },
  'INVALID': { label: 'Invalide', color: 'bg-slate-50 text-slate-600 border border-slate-100', icon: AlertCircle },
  'CONTACTED': { label: 'Contacté', color: 'bg-green-50 text-green-600 border border-green-100', icon: Phone },
  'INTERESTED': { label: 'Intéressé', color: 'bg-green-50 text-green-600 border border-green-100', icon: CheckCircle },
  'NOT_INTERESTED': { label: 'Pas Intéressé', color: 'bg-red-50 text-red-600 border border-red-100', icon: X },
  'CANCEL_REASON_PRICE': { label: 'Annulé (Prix)', color: 'bg-red-50 text-red-600 border border-red-100', icon: X },
  'WRONG_ORDER': { label: 'Commande Erronée', color: 'bg-amber-50 text-amber-600 border border-amber-100', icon: AlertCircle },
  'CANCEL_ORDER': { label: 'Commande Annulée', color: 'bg-red-50 text-red-600 border border-red-100', icon: X },
  'UNKNOWN': { label: 'Inconnu', color: 'bg-gray-50 text-gray-600 border border-gray-100', icon: AlertCircle },
};

const STATUS_COLORS: Record<string, string> = {
  // --- Cycle de vie / Stock ---
  'NEW_PARCEL': '#64748b',         // Slate/Gray
  'WAITING_PICKUP': '#f59e0b',     // Amber
  'WAITING_PREPARATION': '#b45309',// Dark Amber/Brown
  'PREPARED': '#10b981',           // Emerald
  'ENCORE_PREPARED': '#3b82f6',    // Blue
  'PICKED_UP': '#0284c7',          // Sky Blue

  // --- En transit ---
  'SENT': '#8b5cf6',               // Violet
  'RECEIVED': '#6366f1',           // Indigo
  'DISTRIBUTION': '#06b6d4',       // Cyan
  'PROGRAMMER_AUTO': '#a855f7',    // Purple
  'POSTPONED': '#f97316',          // Orange
  'NOANSWER': '#f43f5e',           // Rose/Soft Red
  'ERR': '#e11d48',                // Crimson Red
  'PROGRAMMER': '#4f46e5',         // Royal Blue
  'INCORRECT_ADDRESS': '#ec4899',  // Pink

  // --- Livraison terminée ---
  'DELIVERED': '#059669',          // Green
  'RETURNED': '#ea580c',           // Dark Orange
  'REFUNDED': '#14b8a6',           // Teal

  // --- Annulations ---
  'CANCELED_BY_SELLER': '#dc2626', // Red
  'CANCELED_BY_SYSTEM': '#991b1b', // Dark Red
  'CANCELED': '#b91c1c',           // Medium Red
  'REFUSE': '#ef4444',             // Bright Red

  'PUSHED_TO_DELIVERY': '#0ea5e9', // Light Blue
  'CALL_LATER': '#d97706',         // Gold/Dark Yellow

  // --- Legacy / Confirmation ---
  'LEAD': '#475569',               // Cool Gray
  'AVAILABLE': '#eab308',          // Yellow
  'ASSIGNED': '#0891b2',           // Cyan-Blue
  'PENDING': '#f59e0b',            // Amber
  'CONFIRMED': '#2563eb',          // Cobalt Blue
  'CONFIRMED_DELIVERY': '#1d4ed8', // Dark Blue
  'SHIPPED': '#7c3aed',            // Deep Violet
  'CANCELLED': '#ef4444',          // Red
  'PRICE_CONFIRMED': '#3b82f6',    // Blue
  'PRICE_REJECTED': '#f43f5e',     // Rose
  'NO_REPLY': '#fda4af',           // Light Rose
  'UNREACHABLE': '#cbd5e1',        // Light Slate
  'INVALID': '#94a3b8',            // Medium Slate
  'CONTACTED': '#86efac',          // Light Green
  'INTERESTED': '#22c55e',         // Bright Green
  'NOT_INTERESTED': '#fca5a5',     // Light Red
  'CANCEL_REASON_PRICE': '#7f1d1d',// Maroon
  'WRONG_ORDER': '#f87171',        // Light Orange-Red
  'CANCEL_ORDER': '#ef4444',       // Red
};

const PAYMENT_SITUATION_BADGES: Record<string, { label: string; color: string }> = {
  PAID: { label: 'Payé', color: 'bg-emerald-50 text-emerald-600 border border-emerald-100' },
  'Payé': { label: 'Payé', color: 'bg-emerald-50 text-emerald-600 border border-emerald-100' },
  NOT_PAID: { label: 'Non Payé', color: 'bg-rose-50 text-rose-600 border border-rose-100' },
  'no Payé': { label: 'Non Payé', color: 'bg-rose-50 text-rose-600 border border-rose-100' },
  FACTURED: { label: 'Facturé', color: 'bg-blue-50 text-blue-600 border border-blue-100' },
};

export default function InfluencerLeads() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const getStatusLabel = (status: string) => {
    return t(`all_status_badges.${status}`, 'leads', ALL_STATUS_BADGES[status]?.label || status);
  };

  const getPaymentLabel = (situation: string) => {
    return t(`payment_situation_badges.${situation}`, 'leads', PAYMENT_SITUATION_BADGES[situation]?.label || situation);
  };

  const [links, setLinks] = useState<ReferralLink[]>([]);
  const [linkMeta, setLinkMeta] = useState<Record<string, CustomerLinkMeta>>({});
  const [commissions, setCommissions] = useState<InfluencerCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showStats, setShowStats] = useState(true);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isPushingBulk, setIsPushingBulk] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [tableDateRange, setTableDateRange] = useState<'TOUS' | 'AUJOURD_HUI' | '7J' | '15J' | '30J' | '90J' | 'CUSTOM'>('TOUS');
  const [tableSelectedProductId, setTableSelectedProductId] = useState<string>('ALL');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'primary' | 'danger';
    isLoading?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'primary',
  });
  const [duplicateCheck, setDuplicateCheck] = useState<{
    isOpen: boolean;
    ids: number[];
    deleteIds: number[];
    groups: Record<string, InfluencerCommission[]>;
  }>({
    isOpen: false,
    ids: [],
    deleteIds: [],
    groups: {},
  });
  const [historyModal, setHistoryModal] = useState<{
    isOpen: boolean;
    customerName: string;
    leadNotes?: string;
    history: Array<{ id: number; oldStatus: string; newStatus: string; notes?: string; createdAt: string; changer?: { profile?: { fullName?: string } } }>;
  }>({
    isOpen: false,
    customerName: '',
    leadNotes: '',
    history: [],
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    // tableDateRange/tableSelectedProductId shrink the result set too — without them
    // the table stays on a page that no longer exists and renders blank.
  }, [statusFilter, searchTerm, startDate, endDate, itemsPerPage, tableDateRange, tableSelectedProductId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [linksRes, commissionsRes] = await Promise.all([
        influencerApi.getLinks(),
        // `all: true` — every stat, chart and the pagination on this page are computed
        // client-side, so a truncated page would make all of them wrong.
        // `summary: true` — the slim row shape: history arrays reduced to
        // statusChangedAt/hasHistory (the modal lazy-loads full entries) and the
        // per-row product/landing JSON replaced by the linkMeta map.
        influencerApi.getCustomers({ all: true, summary: true })
      ]);
      setLinks(linksRes.data);
      // API returns { status, data: { commissions, linkMeta, pagination } }
      const commissionsData = commissionsRes.data?.data?.commissions || commissionsRes.data?.commissions || [];
      setCommissions(commissionsData);
      setLinkMeta(commissionsRes.data?.data?.linkMeta || {});
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };
 
  // Filter commissions by date and product for ALL calculations
  const dateFilteredCommissions = commissions.filter(c => {
    // Product filter
    if (tableSelectedProductId !== 'ALL' && String(c.referralLinkId) !== tableSelectedProductId) {
      return false;
    }

    const leadDate = getLeadDate(c);

    // Date filter
    if (tableDateRange === 'TOUS') return true;
    
    const now = new Date();
    if (tableDateRange === 'AUJOURD_HUI') {
      return leadDate.toDateString() === now.toDateString();
    }
    
    if (tableDateRange === 'CUSTOM') {
      if (!startDate && !endDate) return true;
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (leadDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (leadDate > end) return false;
      }
      return true;
    }

    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (tableDateRange === '7J') d.setDate(now.getDate() - 7);
    else if (tableDateRange === '15J') d.setDate(now.getDate() - 15);
    else if (tableDateRange === '30J') d.setDate(now.getDate() - 30);
    else if (tableDateRange === '90J') d.setDate(now.getDate() - 90);
    
    return leadDate >= d;
  });

  const totalClicks = links.reduce((sum, l) => sum + l.clicks, 0);
  const converted = links.reduce((sum, l) => sum + l.conversions, 0);
  
  const totalLeads = dateFilteredCommissions.length;

  const confirmedLeads = dateFilteredCommissions.filter(isConfirmedRow).length;

  const deliveredLeads = dateFilteredCommissions.filter(isDeliveredRow).length;

  const confirmationRate = totalLeads > 0 ? (confirmedLeads / totalLeads) * 100 : 0;
  const deliveryRate = confirmedLeads > 0 ? (deliveredLeads / confirmedLeads) * 100 : 0;

  // Payment situation totals
  const paidLeads = dateFilteredCommissions.filter(c => {
    const sit = (c.order as any)?.lead?.paymentSituation;
    return sit === 'PAID' || sit === 'Payé';
  }).length;
  
  const nonPaidLeads = dateFilteredCommissions.filter(c => {
    const sit = (c.order as any)?.lead?.paymentSituation;
    return sit === 'NOT_PAID' || sit === 'no Payé' || !sit;
  }).length;
  
  const facturedLeads = dateFilteredCommissions.filter(c => {
    const sit = (c.order as any)?.lead?.paymentSituation;
    return sit === 'FACTURED';
  }).length;

  // Build status counts for filter chips
  const statusCounts: Record<string, number> = {};
  dateFilteredCommissions.forEach(c => {
    const s = getDisplayStatus(c);
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  // Predefine all statuses we want to show in the filter
  const activeStatuses = [
    'LEAD', 'AVAILABLE', 'ASSIGNED', 'PENDING', 'CALL_LATER', 
    'CONFIRMED', 'CONFIRMED_DELIVERY', 'PUSHED_TO_DELIVERY', 'SHIPPED', 'DELIVERED', 
    'CANCELLED', 'NO_REPLY', 'UNREACHABLE', 'INVALID', 
    'CONTACTED', 'INTERESTED', 'NOT_INTERESTED',
    'CANCEL_REASON_PRICE', 'WRONG_ORDER', 
    'CANCEL_ORDER', 'RETURNED', 'REFUNDED',
    'NEW_PARCEL', 'WAITING_PICKUP', 'PICKED_UP', 'SENT', 'RECEIVED', 'DISTRIBUTION', 'PROGRAMMER_AUTO', 'POSTPONED',
    'WAITING_PREPARATION', 'PREPARED', 'ENCORE_PREPARED', 'CANCELED_BY_SELLER', 'CANCELED_BY_SYSTEM', 'REFUSE',
    'NOANSWER', 'CANCELED', 'ERR', 'PROGRAMMER', 'INCORRECT_ADDRESS'
  ];
  // Add any statuses not in our predefined list that actually have count > 0
  Object.keys(statusCounts).forEach(s => {
    if (!activeStatuses.includes(s) && statusCounts[s] > 0) activeStatuses.push(s);
  });

  const filteredCommissions = dateFilteredCommissions.filter(c => {
    // Status filter
    if (statusFilter !== 'ALL') {
      if (getDisplayStatus(c) !== statusFilter.toUpperCase()) return false;
    }
    // Search filter
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (c.order?.customerName?.toLowerCase().includes(term)) ||
      (c.order?.customerPhone?.includes(searchTerm)) ||
      (c.order?.customerCity?.toLowerCase().includes(term))
    );
  });

  // Sort by date descending (newest first) — same date field the filters use
  const sortedCommissions = [...filteredCommissions].sort((a, b) => {
    return getLeadDate(b).getTime() - getLeadDate(a).getTime();
  });

  const totalPages = Math.ceil(sortedCommissions.length / itemsPerPage);
  const paginatedCommissions = sortedCommissions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusColorHex = (status: string) => {
    const upper = status.toUpperCase();
    if (STATUS_COLORS[upper]) return STATUS_COLORS[upper];

    const colorClass = ALL_STATUS_BADGES[upper]?.color || '';
    if (colorClass.includes('emerald')) return '#10b981';
    if (colorClass.includes('blue')) return '#3b82f6';
    if (colorClass.includes('amber')) return '#f59e0b';
    if (colorClass.includes('violet')) return '#8b5cf6';
    if (colorClass.includes('indigo')) return '#6366f1';
    if (colorClass.includes('cyan')) return '#06b6d4';
    if (colorClass.includes('red')) return '#ef4444';
    if (colorClass.includes('orange')) return '#f97316';
    if (colorClass.includes('yellow')) return '#eab308';
    return '#94a3b8';
  };

  // Data for Confirmation Analytics
  const totalConfirmed = Object.entries(statusCounts)
    .filter(([status]) => isConfirmedStatus(status.toUpperCase()))
    .reduce((sum, [, count]) => sum + count, 0);

  // Complement of confirmed, not an allow-list — an allow-list silently dropped any
  // status nobody remembered to add, so the donut total never matched TOTAL LEADS.
  const confirmationDistData = Object.entries(statusCounts)
    .filter(([status]) => !isConfirmedStatus(status.toUpperCase()))
    .map(([status, count]) => ({
      name: getStatusLabel(status.toUpperCase()),
      value: count,
      color: getStatusColorHex(status.toUpperCase())
    }));

  if (totalConfirmed > 0) {
    confirmationDistData.push({
      name: getStatusLabel('CONFIRMED'),
      value: totalConfirmed,
      color: getStatusColorHex('CONFIRMED')
    });
  }

  confirmationDistData.sort((a, b) => b.value - a.value);

  const deliveryDistData = Object.entries(statusCounts)
    .filter(([status]) => DELIVERY_STATUSES.includes(status.toUpperCase()))
    .map(([status, count]) => ({
      name: getStatusLabel(status.toUpperCase()),
      value: count,
      color: getStatusColorHex(status.toUpperCase())
    })).sort((a, b) => b.value - a.value);

  // Data for Volume Trend (Performance) - Now uses global filters
  const performanceData = (() => {
    const groupedMap = new Map();
    dateFilteredCommissions.forEach(comm => {
      const dateKey = format(getLeadDate(comm), 'yyyy-MM-dd');
      groupedMap.set(dateKey, (groupedMap.get(dateKey) || 0) + 1);
    });

    return Array.from(groupedMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({
        date: format(new Date(date), 'dd MMM'),
        Leads: count
      }));
  })();

  // Data for City Distribution (Count leads that have a tracking number).
  // Must honour the GLOBAL FILTERS like every other card on this page.
  const pushedLeadsForCity = dateFilteredCommissions.filter(c =>
    c.order?.coliatyPackageCode || (c.order as any)?.trackingNumber
  );
  const totalPushedLeads = pushedLeadsForCity.length;

  const cityCounts: Record<string, number> = {};
  pushedLeadsForCity.forEach(c => {
    let city = (c.order?.customerCity || 'Inconnue').trim();
    // Normalize: lowercase then capitalize first letter of each word
    city = city.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    
    cityCounts[city] = (cityCounts[city] || 0) + 1;
  });

  const cityDistData = Object.entries(cityCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
    .map((item, i) => ({
      ...item,
      color: ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#f43f5e', '#84cc16', '#6366f1', '#ec4899'][i]
    }));

  const pushableLeads = sortedCommissions.filter(c => (c.order?.status || 'PENDING') === 'LEAD');

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const ids = pushableLeads.map(c => Number(String(c.id).replace('lead-', '')));
      setSelectedIds(ids);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkPush = (idsToPush?: number[]) => {
    const ids = idsToPush || selectedIds;
    if (ids.length === 0) return;

    // Find full lead objects for the base selection
    const baseLeads = commissions.filter(c => {
      const numericId = Number(String(c.id).replace('lead-', ''));
      return ids.includes(numericId);
    });

    // Extract unique phone numbers from these leads
    const phones = new Set(baseLeads.map(l => l.order?.customerPhone).filter(Boolean));

    // Find ALL leads in the system with these phone numbers that are still in 'LEAD' status
    const allRelatedLeads = commissions.filter(c => 
      c.order?.status === 'LEAD' && phones.has(c.order?.customerPhone)
    );

    // Group by phone
    const groups: Record<string, InfluencerCommission[]> = {};
    allRelatedLeads.forEach(c => {
      const phone = c.order?.customerPhone || 'no-phone';
      if (!groups[phone]) groups[phone] = [];
      groups[phone].push(c);
    });

    const duplicateGroups = Object.values(groups).filter(g => g.length > 1);

    if (duplicateGroups.length > 0) {
      const idsToKeep = new Set<number>();
      const idsToDelete = new Set<number>();
      
      Object.values(groups).forEach(group => {
        if (group.length > 0) {
          // Check if any lead in this group was in the original selection
          const selectedInGroup = group.find(l => ids.includes(Number(String(l.id).replace('lead-', ''))));
          const keepId = selectedInGroup 
            ? Number(String(selectedInGroup.id).replace('lead-', ''))
            : Number(String(group[0].id).replace('lead-', ''));
            
          idsToKeep.add(keepId);
          
          // Mark others in this group as 'Delete' by default
          group.forEach(lead => {
            const leadId = Number(String(lead.id).replace('lead-', ''));
            if (leadId !== keepId) idsToDelete.add(leadId);
          });
        }
      });

      setDuplicateCheck({
        isOpen: true,
        ids: Array.from(idsToKeep),
        deleteIds: Array.from(idsToDelete),
        groups: groups
      });
    } else {
      proceedWithBulkPush(ids);
    }
  };

  const proceedWithBulkPush = (ids: number[]) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirmation d\'envoi',
      message: `Envoyer ${ids.length} leads au Call Center ?`,
      variant: 'primary',
      onConfirm: async () => {
        try {
          setIsPushingBulk(true);
          await influencerApi.pushLeadsToCallCenterBulk(ids);
          toast.success(`${ids.length} leads envoyés au Call Center!`);
          setSelectedIds([]);
          loadData();
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          toast.error(err?.response?.data?.message || 'Erreur lors de l\'envoi groupé');
        } finally {
          setIsPushingBulk(false);
        }
      }
    });
  };

  // Merge the two histories the way the modal has always shown them: one
  // timeline, order entries' changedByUser normalised to `changer`, consecutive
  // repeats of the same status collapsed.
  const mergeHistories = (leadHistory: any[], orderHistory: any[]) =>
    [
      ...leadHistory.map((h: any) => ({ ...h, type: 'LEAD' })),
      ...orderHistory.map((h: any) => ({ ...h, type: 'ORDER', changer: h.changedByUser })),
    ]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .filter((entry, i, arr) => {
        if (i === 0) return true;
        return entry.newStatus !== arr[i - 1].newStatus;
      });

  const openHistoryModal = async (commission: InfluencerCommission) => {
    const customerName = commission.order?.customerName || '-';
    const leadNotes = (commission.order as any)?.lead?.notes || '';
    const localLead = (commission.order as any)?.lead?.statusHistory || (commission as any)?.statusHistory || [];
    const localOrder = (commission.order as any)?.statusHistory || [];
    // Full-fat rows carry their entries; slim rows only say the entries exist
    // (hasHistory) and the list is fetched for the one lead being opened.
    if (localLead.length + localOrder.length > 0) {
      setHistoryModal({ isOpen: true, customerName, leadNotes, history: mergeHistories(localLead, localOrder) });
      return;
    }
    // A commission row on an order that was never a lead has no lead id — it is
    // fetched by its order instead, so the button never dead-clicks.
    const leadId = String(commission.id).startsWith('lead-')
      ? Number(String(commission.id).replace('lead-', ''))
      : (commission.order as any)?.lead?.id;
    const orderId = (commission as any).orderId ?? (commission.order as any)?.id;
    if (!leadId && !orderId) {
      toast.error(t('history_unavailable', 'leads', 'Historique indisponible'));
      return;
    }
    try {
      const res = await influencerApi.getCustomerHistory({
        ...(leadId ? { leadId: Number(leadId) } : {}),
        ...(orderId ? { orderId: Number(orderId) } : {}),
      });
      const data = res.data?.data || {};
      setHistoryModal({
        isOpen: true,
        customerName,
        leadNotes: leadNotes || data.notes || '',
        history: mergeHistories(data.leadHistory || [], data.orderHistory || []),
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('error_generic', 'leads', 'Erreur'));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    
    setConfirmModal({
      isOpen: true,
      title: 'Confirmation de suppression',
      message: `Êtes-vous sûr de vouloir supprimer ${selectedIds.length} leads ? Cette action est irréversible.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          setIsPushingBulk(true); // Reusing this loading state or could add a new one
          await influencerApi.deleteLeadsBulk(selectedIds);
          toast.success(`${selectedIds.length} leads supprimés!`);
          setSelectedIds([]);
          loadData();
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          toast.error(err?.response?.data?.message || 'Erreur lors de la suppression');
        } finally {
          setIsPushingBulk(false);
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-influencer-200 border-t-influencer-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            {t('title', 'leads', 'Mes Leads & Parrainages')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t('subtitle', 'leads', 'Suivez tous vos leads, conversions et livraisons en un seul endroit.')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:text-influencer-600 hover:border-influencer-100 hover:bg-influencer-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {t('refresh', 'leads', 'Actualiser')}
          </button>
          <button
            onClick={() => setShowStats(!showStats)}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all"
          >
            {showStats ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {t('stats', 'leads', 'Statistiques')}
          </button>

        </div>
      </div>

      {/* Collapsible Stats & Analytics */}
      {showStats && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Global Stats Filter */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col xl:flex-row items-start xl:items-center gap-4 justify-between">
            <div className="flex items-center gap-2 mb-2 xl:mb-0">
              <Filter className="w-4 h-4 text-influencer-500" />
              <span className="text-xs font-black text-gray-900 uppercase tracking-widest">{t('filters_global', 'leads', 'Filtres Globaux')}</span>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
              {/* Product Filter */}
              <select 
                value={tableSelectedProductId}
                onChange={(e) => setTableSelectedProductId(e.target.value)}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-influencer-500 transition-all text-gray-600"
              >
                <option value="ALL">{t('all_products', 'leads', 'Tous les produits')}</option>
                {links.map(link => (
                  <option key={link.id} value={link.id}>
                    {link.product?.nameFr || link.code} {link.product?.sku ? `(${link.product.sku})` : ''}
                  </option>
                ))}
              </select>

              {/* Date Range Pills */}
              <div className="flex flex-wrap items-center bg-gray-50 p-1 rounded-xl border border-gray-100 w-full sm:w-auto">
                {['TOUS', 'AUJOURD_HUI', '7J', '15J', '30J', '90J', 'CUSTOM'].map((r) => {
                  let label = r;
                  if (r === 'TOUS') label = t('range_all', 'leads', 'Tous');
                  else if (r === 'AUJOURD_HUI') label = t('range_today', 'leads', "Aujourd'hui");
                  else if (r === 'CUSTOM') label = t('range_custom', 'leads', 'Personnalisé');
                  else if (r.endsWith('J')) {
                    const count = r.replace('J', '');
                    label = t('range_days', 'leads', '{count}j').replace('{count}', count);
                  }
                  return (
                    <button
                      key={r}
                      onClick={() => setTableDateRange(r as any)}
                      className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all flex-1 sm:flex-none text-center ${
                        tableDateRange === r 
                          ? 'bg-white text-gray-900 shadow-sm' 
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {tableDateRange === 'CUSTOM' && (
                <div className="flex items-center gap-2 animate-fadeIn w-full sm:w-auto">
                   <input 
                     type="date"
                     value={startDate}
                     onChange={(e) => setStartDate(e.target.value)}
                     className="flex-1 sm:flex-none text-[10px] font-bold bg-white border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-influencer-500/20"
                   />
                   <span className="text-[10px] text-gray-400 font-bold uppercase">{t('date_separator', 'leads', 'au')}</span>
                   <input 
                     type="date"
                     value={endDate}
                     onChange={(e) => setEndDate(e.target.value)}
                     className="flex-1 sm:flex-none text-[10px] font-bold bg-white border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-influencer-500/20"
                   />
                </div>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-center">
              <Zap className="w-5 h-5 mx-auto mb-2 text-green-500" />
              <h3 className="text-xl font-black text-gray-900">{totalLeads.toLocaleString()}</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">{t('total_leads', 'leads', 'Total Leads')}</p>
            </div>
            <div className="relative bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-center border-b-4 border-b-amber-400 pb-8">
              <CheckCircle2 className="w-5 h-5 mx-auto mb-2 text-amber-600" />
              <h3 className="text-xl font-black text-amber-600">{confirmationRate.toFixed(1)}%</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">{t('confirmation_rate', 'leads', 'Taux de Confirmation')}</p>
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[13px] font-black px-5 py-2 rounded-full shadow-lg border-2 border-white whitespace-nowrap uppercase tracking-widest">
                {t('leads_confirmed', 'leads', '{count} LEADS CONFIRMÉS').replace('{count}', String(confirmedLeads))}
              </div>
            </div>
            <div className="relative bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-center border-b-4 border-b-emerald-400 pb-8">
              <Truck className="w-5 h-5 mx-auto mb-2 text-emerald-600" />
              <h3 className="text-xl font-black text-emerald-600">{deliveryRate.toFixed(1)}%</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">{t('delivery_rate', 'leads', 'Taux de Livraison')}</p>
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[13px] font-black px-5 py-2 rounded-full shadow-lg border-2 border-white whitespace-nowrap uppercase tracking-widest">
                {t('leads_delivered', 'leads', '{count} LEADS LIVRÉS').replace('{count}', String(deliveredLeads))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-influencer-500" />
                  {t('performance', 'leads', 'Performance')}
                </h3>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                    <RechartsTooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                    <Line 
                      type="monotone" 
                      dataKey="Leads" 
                      name={t('total_leads', 'leads', 'Total Leads')}
                      stroke="#8b5cf6" 
                      strokeWidth={4}
                      dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
               <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2 mb-6">
                  <MapPin className="w-4 h-4 text-orange-500" />
                  {t('top_cities', 'leads', 'Top Villes Performance')}
                </h3>
                <div className="flex-1 min-h-[200px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={cityDistData}
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {cityDistData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip wrapperStyle={{ zIndex: 100 }} content={<CustomPieTooltip total={totalPushedLeads} />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-black text-gray-900">{cityDistData.length}</span>
                    <span className="text-[8px] font-bold text-gray-400 uppercase">{t('cities_top', 'leads', 'Villes Top')}</span>
                  </div>
                </div>
                <div className="mt-4 space-y-1">
                  {cityDistData.map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{backgroundColor: item.color}} />
                        <span className="text-[10px] font-bold text-gray-500 truncate max-w-[100px]">{item.name}</span>
                      </div>
                      <span className="text-[10px] font-black text-gray-900">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {/* Confirmation Analytics */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2 mb-6">
                <PieIcon className="w-4 h-4 text-blue-500" />
                {t('confirmation_analysis', 'leads', 'Analyse de Confirmation')}
              </h3>
              {confirmationDistData.length > 0 ? (
                <>
                  <div className="flex-1 min-h-[220px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={confirmationDistData}
                          innerRadius={60}
                          outerRadius={85}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {confirmationDistData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip wrapperStyle={{ zIndex: 100 }} content={<CustomPieTooltip total={confirmationDistData.reduce((acc: number, curr: any) => acc + curr.value, 0)} />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-2xl font-black text-gray-900">
                        {confirmationDistData.reduce((acc, curr) => acc + curr.value, 0)}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('total', 'leads', 'Total')}</span>
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-2">
                    {confirmationDistData.map((item, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-xl">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{backgroundColor: item.color}} />
                          <span className="text-[10px] font-bold text-gray-600 truncate max-w-[80px]">{item.name}</span>
                        </div>
                        <span className="text-xs font-black text-gray-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 min-h-[200px]">
                  <PieIcon className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm font-medium">{t('no_data', 'leads', 'Aucune donnée disponible')}</p>
                </div>
              )}
            </div>

            {/* Delivery Analytics */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2 mb-6">
                <Truck className="w-4 h-4 text-emerald-500" />
                {t('delivery_analysis', 'leads', 'Analyse de Livraison')}
              </h3>

              {deliveryDistData.length > 0 ? (
                <>
                  <div className="flex-1 min-h-[220px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={deliveryDistData}
                          innerRadius={60}
                          outerRadius={85}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {deliveryDistData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip wrapperStyle={{ zIndex: 100 }} content={<CustomPieTooltip total={deliveryDistData.reduce((acc: number, curr: any) => acc + curr.value, 0)} />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-2xl font-black text-gray-900">
                        {deliveryDistData.reduce((acc, curr) => acc + curr.value, 0)}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('total', 'leads', 'Total')}</span>
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-2">
                    {deliveryDistData.map((item, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-xl">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{backgroundColor: item.color}} />
                          <span className="text-[10px] font-bold text-gray-600 truncate max-w-[80px]">{item.name}</span>
                        </div>
                        <span className="text-xs font-black text-gray-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 min-h-[200px]">
                  <Truck className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm font-medium">{t('no_delivery', 'leads', 'Aucune livraison en cours')}</p>
                </div>
              )}
        </div>
      </div>
    </div>
  )}

  {/* Search + Filters Bar */}
    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
          {/* Status Filter */}
          <div className="relative min-w-[220px]">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <Filter className="w-4 h-4 text-gray-400" />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 text-xs font-bold text-gray-700 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-influencer-500 transition-all appearance-none cursor-pointer hover:bg-gray-100/50"
            >
              <option value="ALL">{t('all_status', 'leads', 'Tous les statuts ({count})').replace('{count}', String(dateFilteredCommissions.length))}</option>
              {(() => {
                // De-duplicate on the status CODE, not the label. Two codes sharing a
                // label (SENT/SHIPPED, DISTRIBUTION/PUSHED_TO_DELIVERY) used to make one
                // of them unselectable and hid its count entirely.
                const renderedStatuses = new Set<string>();
                return activeStatuses
                  .map(status => {
                    const code = status.toUpperCase();
                    return { status: code, label: getStatusLabel(code), count: statusCounts[code] || 0 };
                  })
                  .filter(item => {
                    if (renderedStatuses.has(item.status)) return false;
                    renderedStatuses.add(item.status);
                    return true;
                  })
                  .map(item => (
                    <option key={item.status} value={item.status}>
                      {item.label} ({item.count})
                    </option>
                  ));
              })()}
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </div>

          {/* Search Bar Only */}
          <div className="flex flex-col xl:flex-row items-start xl:items-center gap-4 w-full">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={t('search_placeholder', 'leads', 'Rechercher par nom, téléphone ou ville...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-influencer-500 transition-all font-medium placeholder:text-gray-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Unified Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <Filter className="w-4 h-4 text-influencer-500" />
            {statusFilter === 'ALL' ? t('all_leads_title', 'leads', 'Tous les Leads') : getStatusLabel(statusFilter)}
            <span className="text-gray-400 font-medium">({sortedCommissions.length})</span>
          </h2>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase">{t('per_page', 'leads', 'Par page:')}</span>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="text-[10px] font-black bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-influencer-500 transition-all cursor-pointer"
              >
                {[10, 20, 30, 50, 100].map(val => (
                  <option key={val} value={val}>{val}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              {selectedIds.length > 0 && (
                <button
                  onClick={() => handleBulkPush()}
                  disabled={isPushingBulk}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-influencer-100 text-influencer-700 rounded-lg text-[10px] font-bold hover:bg-influencer-200 transition-all"
                >
                  <Headphones className="w-3.5 h-3.5" />
                  {t('push_selected', 'leads', 'Pousser la sélection ({count})').replace('{count}', String(selectedIds.length))}
                </button>
              )}
              {selectedIds.length > 0 && (
                <button
                  onClick={handleBulkDelete}
                  disabled={isPushingBulk}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-[10px] font-bold hover:bg-red-200 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t('delete_selected', 'leads', 'Supprimer ({count})').replace('{count}', String(selectedIds.length))}
                </button>
              )}
            </div>
          </div>
        </div>

        {sortedCommissions.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-5 py-3 text-left">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-influencer-600 border-gray-300 rounded focus:ring-influencer-500"
                        checked={pushableLeads.length > 0 && selectedIds.length === pushableLeads.length}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('th_tracking', 'leads', 'Tracking Number')}</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('th_client', 'leads', 'Client')}</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('th_product', 'leads', 'Produit')}</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('th_pack_option', 'leads', 'Pack/Option')}</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('th_amount', 'leads', 'Montant')}</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('th_status', 'leads', 'Status')}</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('th_date', 'leads', 'Date')}</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('th_situation', 'leads', 'Situation')}</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('th_comments', 'leads', 'Commentaires')}</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('th_actions', 'leads', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {paginatedCommissions.map((commission) => {
                    const status = ((commission.order?.status || 'PENDING') as string).trim().toUpperCase();
                    let badge = ALL_STATUS_BADGES[status] || { label: status, color: 'bg-gray-100 text-gray-800', icon: Package };
                    
                    const priceStatus = (commission.order as any)?.lead?.requestedPriceStatus;
                    
                    // Special case: If confirmed but has a tracking code, it's a delivery-stage lead
                    if ((status === 'CONFIRMED' || status === 'PRICE_CONFIRMED') && commission.order?.coliatyPackageCode) {
                      badge = {
                        ...ALL_STATUS_BADGES['PUSHED_TO_DELIVERY'],
                        label: status === 'PRICE_CONFIRMED' ? 'price CONFIRMED (Livraison)' : 'Confirmé (Livraison)'
                      };
                    }
                    
                    const StatusIcon = badge.icon || Package;
                    // Slim rows carry only referralLinkId; the product cell and
                    // pack price resolve through the linkMeta map the response
                    // ships once. The embedded referralLink reads stay as a
                    // fallback for full-fat rows.
                    const rowLink = linkMeta[String(commission.referralLinkId)];
                    const embeddedProduct = commission.referralLink?.product;
                    const productImage = rowLink?.product?.imageUrl ?? embeddedProduct?.images?.[0]?.imageUrl;
                    const productName = rowLink?.product?.nameFr ?? embeddedProduct?.nameFr;
                    const productSku = rowLink?.product?.sku ?? embeddedProduct?.sku;
                    const productRetailPriceMad = rowLink?.product?.retailPriceMad ?? embeddedProduct?.retailPriceMad;

                    let packPriceMad: number | null = null;
                    const productVariant = commission.order?.productVariant || (commission as any).order?.productVariant;
                    if (productVariant) {
                      const option = rowLink?.packOptions?.find(o => o.name === productVariant);
                      if (option && option.price) {
                        packPriceMad = Number(option.price);
                      } else if (commission.referralLink?.landingPage?.customStructure) {
                        try {
                          const structure = commission.referralLink.landingPage.customStructure;
                          const blocks = Array.isArray(structure) ? structure : (structure.blocks || []);
                          const checkoutBlock = blocks.find((b: any) => b.type === 'express_checkout');
                          if (checkoutBlock?.content?.options) {
                            const opt = checkoutBlock.content.options.find((o: any) => o.name === productVariant);
                            if (opt && opt.price) {
                              packPriceMad = Number(opt.price);
                            }
                          }
                        } catch (e) {
                          // fallback
                        }
                      }
                    }

                    return (
                      <tr key={commission.id} className={`hover:bg-gray-50/50 transition-colors group ${selectedIds.includes(Number(String(commission.id).replace('lead-', ''))) ? 'bg-influencer-50/30' : ''}`}>
                        {/* Checkbox */}
                        <td className="px-5 py-4">
                          {status === 'LEAD' && (
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-influencer-600 border-gray-300 rounded focus:ring-influencer-500"
                              checked={selectedIds.includes(Number(String(commission.id).replace('lead-', '')))}
                              onChange={() => handleSelectOne(Number(String(commission.id).replace('lead-', '')))}
                            />
                          )}
                        </td>

                        {/* Tracking Number */}
                        <td className="px-5 py-4">
                          {commission.order?.coliatyPackageCode && (
                            <div className="flex flex-col items-start">
                              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded border border-violet-100 text-[9px] font-black">
                                <Truck className="w-2.5 h-2.5" />
                                <span>{commission.order.coliatyPackageCode}</span>
                              </div>
                              {commission.order.coliatyPackageId && (
                                <span className="text-[8px] font-bold text-gray-400 mt-0.5">ID: #{commission.order.coliatyPackageId}</span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Client */}
                        <td className="px-5 py-4">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-gray-900">{commission.order?.customerName || '-'}</span>
                              {((commission as any).source === 'WHATSAPP' || (commission.order as any)?.lead?.source === 'WHATSAPP' || (commission.order as any)?.order?.lead?.source === 'WHATSAPP') && (
                                <span className="inline-flex items-center justify-center p-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 hover:scale-110 transition-transform" title="Lead WhatsApp">
                                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                  </svg>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                              <span className="flex items-center gap-1"><Phone className="w-2.5 h-2.5" /> {commission.order?.customerPhone}</span>
                              <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {commission.order?.customerCity || '-'}</span>
                            </div>
                            {commission.order?.customerAddress && (
                              <span className="text-[10px] text-gray-400 mt-1 truncate max-w-[200px]">📍 {commission.order.customerAddress}</span>
                            )}
                          </div>
                        </td>

                        {/* Produit */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            {productImage ? (
                              <img src={productImage} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <Package className="w-4 h-4 text-gray-400" />
                              </div>
                            )}
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-gray-900">{productName || '-'}</span>
                              <span className="text-[10px] text-gray-400 font-mono mt-0.5 uppercase">
                                SKU: {productSku || '-'} | QTE: {commission.order?.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 1}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Option */}
                        <td className="px-5 py-4">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-0.5">{t('selection', 'leads', 'Sélection')}</span>
                            <span className="text-xs font-black text-influencer-600 truncate max-w-[100px]">
                              {(commission.order as any)?.productVariant || (commission as any).order?.productVariant || '-'}
                            </span>
                          </div>
                        </td>

                        {/* Montant */}
                        <td className="px-5 py-4">
                          <span className="text-sm font-bold text-gray-900">
                            {Number(commission.order?.totalAmountMad) > 0
                              ? `${Number(commission.order!.totalAmountMad).toFixed(2)} MAD`
                              : packPriceMad !== null
                                ? `${packPriceMad.toFixed(2)} MAD`
                                : productRetailPriceMad
                                  ? `${Number(productRetailPriceMad).toFixed(2)} MAD`
                                  : '-'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <div className="flex flex-col items-start gap-1">
                            {status === 'CANCEL_REASON_PRICE' && (commission.order as any)?.lead?.requestedPriceMad && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-600 text-white rounded border border-gray-400 text-[9px] font-black shadow-sm mb-1">
                                💰 {(commission.order as any).lead.requestedPriceMad} MAD 
                                {(commission.order as any).lead.requestedPriceStatus === 'PENDING' ? t('status_pending_parenthesis', 'leads', ' (En attente)') : 
                                 (commission.order as any).lead.requestedPriceStatus === 'APPROVED' ? t('status_approved_parenthesis', 'leads', ' (Approuvé)') : 
                                 (commission.order as any).lead.requestedPriceStatus === 'REJECTED' ? t('status_rejected_parenthesis', 'leads', ' (Rejeté)') : ''}
                              </span>
                            )}
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${badge.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {((status === 'CONFIRMED' || status === 'PRICE_CONFIRMED') && commission.order?.coliatyPackageCode) ? badge.label : getStatusLabel(status)}
                            </span>
                            {status === 'CALL_LATER' && (commission.order as any)?.lead?.callbackDate && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded border border-orange-100 text-[8px] font-black uppercase shadow-sm animate-pulse">
                                <Calendar className="w-2 h-2" />
                                {format(new Date((commission.order as any).lead.callbackDate), 'dd MMM HH:mm')}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Date */}
                        <td className="px-5 py-4">
                          {(() => {
                            const createdAt = getLeadDate(commission as any);
                            const hasCreated = !Number.isNaN(createdAt.getTime());
                            return (
                              <div className="flex flex-col text-xs text-gray-500 font-medium whitespace-nowrap">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" /> 
                                  {hasCreated ? format(createdAt, 'dd MMM yyyy') : '-'}
                                </span>
                                <span className="flex items-center gap-1 mt-0.5 opacity-60">
                                  <Clock className="w-3 h-3" /> 
                                  {hasCreated ? format(createdAt, 'HH:mm') : '-'}
                                </span>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Situation */}
                        <td className="px-5 py-4">
                          {(() => {
                            const sit = (commission.order as any)?.lead?.paymentSituation || 'NOT_PAID';
                            const badge = PAYMENT_SITUATION_BADGES[sit] || PAYMENT_SITUATION_BADGES.NOT_PAID;
                            return (
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${badge.color}`}>
                                {getPaymentLabel(sit)}
                              </span>
                            );
                          })()}
                        </td>
                        
                        {/* Commentaires */}
                        <td className="px-5 py-4">
                          {(commission.order as any)?.lead?.notes ? (
                            <div className="max-w-[200px]">
                              <p className="text-[10px] text-gray-600 font-medium line-clamp-2 italic" title={(commission.order as any).lead.notes}>
                                "{(commission.order as any).lead.notes}"
                              </p>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-300 italic">{t('no_comment', 'leads', 'Aucun commentaire')}</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1">
                            {commission.order?.status === 'LEAD' && (
                              <>
                                <button
                                  onClick={() => {
                                    const realId = String(commission.id).replace('lead-', '');
                                    handleBulkPush([Number(realId)]);
                                  }}
                                  className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-all" title={t('send_to_call_center', 'leads', 'Envoyer au Call Center')}
                                >
                                  <Headphones className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    const realId = String(commission.id).replace('lead-', '');
                                    setConfirmModal({
                                      isOpen: true,
                                      title: t('confirm_single_delete_title', 'leads', 'Supprimer ce lead ?'),
                                      message: t('confirm_single_delete_msg', 'leads', 'Cette action est irréversible. Voulez-vous vraiment continuer ?'),
                                      variant: 'danger',
                                      onConfirm: async () => {
                                        try {
                                          await influencerApi.deleteLead(Number(realId));
                                          toast.success(t('delete_success_single', 'leads', 'Lead supprimé'));
                                          loadData();
                                          setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                        } catch (err: any) {
                                          toast.error(err?.response?.data?.message || t('error_generic', 'leads', 'Erreur'));
                                        }
                                      }
                                    });
                                  }}
                                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-all" title={t('delete', 'leads', 'Supprimer')}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {(commission.order?.status === 'ASSIGNED' || status === 'CANCEL_REASON_PRICE') && (
                              <span className="text-[10px] text-cyan-600 font-bold bg-cyan-50 px-2 py-1 rounded-lg">{t('to_call_center', 'leads', 'Au Call Center')}</span>
                            )}
                            {status === 'CANCEL_REASON_PRICE' && (commission.order as any)?.lead?.requestedPriceStatus === 'PENDING' && (
                              <div className="flex gap-1">
                                <button
                                  onClick={async () => {
                                    try {
                                      await leadsApi.respondPriceRequest(Number(String(commission.id).replace('lead-', '')), 'APPROVE');
                                      toast.success(t('price_approved', 'leads', 'Demande de prix approuvée'));
                                      loadData();
                                    } catch (err: any) {
                                      toast.error(err?.response?.data?.message || t('error_generic', 'leads', 'Erreur'));
                                    }
                                  }}
                                  className="p-2 rounded-xl text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-all text-[11px] font-black uppercase shadow-sm border border-emerald-100 flex flex-col items-center gap-1 min-w-[50px]" title={t('accept', 'leads', 'Accepter')}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  {t('yes', 'leads', 'OUI')}
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      await leadsApi.respondPriceRequest(Number(String(commission.id).replace('lead-', '')), 'REJECT');
                                      toast.success(t('price_rejected', 'leads', 'Demande de prix rejetée'));
                                      loadData();
                                    } catch (err: any) {
                                      toast.error(err?.response?.data?.message || t('error_generic', 'leads', 'Erreur'));
                                    }
                                  }}
                                  className="p-2 rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 transition-all text-[11px] font-black uppercase shadow-sm border border-rose-100 flex flex-col items-center gap-1 min-w-[50px]" title={t('refuse_btn', 'leads', 'Refuser')}
                                >
                                  <XCircle className="w-4 h-4" />
                                  {t('no', 'leads', 'NON')}
                                </button>
                              </div>
                            )}
                            {/* History button always visible */}
                            {(() => {
                              // Slim rows say whether entries exist without
                              // carrying them; full-fat rows still carry the
                              // arrays and open instantly.
                              const leadHistory = (commission.order as any)?.lead?.statusHistory || (commission as any)?.statusHistory || [];
                              const orderHistory = (commission.order as any)?.statusHistory || [];
                              const rowHasHistory = (commission as any).hasHistory ?? (leadHistory.length + orderHistory.length > 0);

                              return rowHasHistory ? (
                                <button
                                  onClick={() => openHistoryModal(commission)}
                                  className="p-1.5 rounded-lg text-violet-500 hover:bg-violet-50 transition-all" title={t('view_history', 'leads', 'Voir l\'historique')}
                                >
                                  <History className="w-4 h-4" />
                                </button>
                              ) : null;
                            })()}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {t('showing_leads', 'leads', 'Affichage de {start} à {end} sur {total} leads')
                      .replace('{start}', String(Math.min(sortedCommissions.length, (currentPage - 1) * itemsPerPage + 1)))
                      .replace('{end}', String(Math.min(sortedCommissions.length, currentPage * itemsPerPage)))
                      .replace('{total}', String(sortedCommissions.length))}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">{t('per_page', 'leads', 'Par page:')}</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => setItemsPerPage(Number(e.target.value))}
                      className="text-[10px] font-black bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-influencer-500 transition-all"
                    >
                      {[10, 20, 30, 50, 100].map(val => (
                        <option key={val} value={val}>{val}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-2 border border-gray-100 rounded-xl hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {(() => {
                      const pages = [];
                      for (let i = 1; i <= totalPages; i++) {
                        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                          pages.push(
                            <button
                              key={i}
                              onClick={() => setCurrentPage(i)}
                              className={`w-8 h-8 rounded-xl text-xs font-black transition-all ${
                                currentPage === i
                                  ? 'bg-influencer-600 text-white shadow-lg shadow-influencer-200 scale-110'
                                  : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                              }`}
                            >
                              {i}
                            </button>
                          );
                        } else if (i === currentPage - 2 || i === currentPage + 2) {
                          pages.push(<span key={i} className="px-1 text-gray-300">...</span>);
                        }
                      }
                      return pages;
                    })()}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 border border-gray-100 rounded-xl hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 mx-auto text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">{t('no_lead_found', 'leads', 'Aucun lead trouvé')}</p>
            <p className="text-gray-400 text-sm mt-1">
              {statusFilter !== 'ALL'
                ? t('no_lead_status_desc', 'leads', 'Aucun lead avec le statut "{status}".').replace('{status}', getStatusLabel(statusFilter))
                : t('no_lead_desc', 'leads', 'Vos leads apparaîtront ici dès qu\'un client commande via vos liens.')}
            </p>
          </div>
        )}
      </div>

      {/* History Modal */}
      {historyModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-white/20 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <div className="flex-1">
                <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <History className="w-5 h-5 text-violet-500" />
                  {t('history_title', 'leads', 'Historique des statuts')}
                </h2>
                <div className="flex flex-col gap-1 mt-1">
                  <p className="text-xs text-gray-400 font-medium">{historyModal.customerName}</p>
                  {historyModal.leadNotes && (
                    <div className="bg-amber-50 border border-amber-100/50 rounded-xl px-3 py-2 mt-2">
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                        <MessageSquare className="w-3 h-3" /> {t('lead_comment', 'leads', 'Commentaire du Lead')}
                      </p>
                      <p className="text-xs text-amber-900/80 font-medium italic">
                        "{historyModal.leadNotes}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setHistoryModal(prev => ({ ...prev, isOpen: false }))}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all self-start"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Timeline */}
            <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
              {historyModal.history.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <History className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm font-medium">{t('no_history_available', 'leads', 'Aucun historique disponible')}</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-100" />

                  <div className="space-y-5">
                    {historyModal.history.map((entry, i) => {
                      const oldBadge = ALL_STATUS_BADGES[entry.oldStatus?.toUpperCase()] || { label: entry.oldStatus, color: 'bg-gray-100 text-gray-600', icon: Package };
                      const newBadge = ALL_STATUS_BADGES[entry.newStatus?.toUpperCase()] || { label: entry.newStatus, color: 'bg-gray-100 text-gray-600', icon: Package };
                      const NewIcon = newBadge.icon;
                      const isLast = i === historyModal.history.length - 1;
                      return (
                        <div key={entry.id} className="relative flex gap-4 pl-10">
                          {/* Circle on timeline */}
                          <div className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-sm z-10 ${
                            isLast ? 'bg-violet-500' : 'bg-gray-200'
                          }`}>
                            <NewIcon className={`w-4 h-4 ${isLast ? 'text-white' : 'text-gray-500'}`} />
                          </div>

                          <div className="flex-1 bg-gray-50 rounded-2xl px-4 py-3">
                            <div className="flex items-center flex-wrap gap-2 mb-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${oldBadge.color}`}>
                                {getStatusLabel(entry.oldStatus)}
                              </span>
                              <span className="text-gray-400 text-xs">→</span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${newBadge.color}`}>
                                {getStatusLabel(entry.newStatus)}
                              </span>
                            </div>
                            {entry.notes && (
                              <p className="text-[10px] text-gray-500 italic mt-1">💬 {entry.notes}</p>
                            )}
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                                {entry.changer?.profile?.fullName || t('system', 'leads', 'Système')}
                              </span>
                              <span className="text-[9px] text-gray-400">
                                {entry.createdAt ? format(new Date(entry.createdAt), 'dd MMM yyyy HH:mm') : '-'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 pb-6 pt-2">
              <button
                onClick={() => setHistoryModal(prev => ({ ...prev, isOpen: false }))}
                className="w-full px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all"
              >
                {t('close', 'leads', 'Fermer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Check Modal */}
      {duplicateCheck.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[150] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-white/20 animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                      <AlertCircle className="w-6 h-6 text-amber-500" />
                    </div>
                    {t('dup_verification', 'leads', 'Vérification des Doublons')}
                  </h2>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-2">
                    {t('dup_groups_found', 'leads', '{count} groupes de numéros identiques trouvés').replace('{count}', String(Object.values(duplicateCheck.groups).filter(g => g.length > 1).length))}
                  </p>
                </div>
                <button
                  onClick={() => setDuplicateCheck(prev => ({ ...prev, isOpen: false }))}
                  className="p-3 rounded-2xl bg-gray-50 text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-4">
                <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
                  <Headphones size={20} />
                </div>
                <div>
                  <p className="text-sm font-black text-amber-900 uppercase tracking-tight">{t('optimization_title', 'leads', "Optimisation de l'envoi")}</p>
                  <p className="text-xs text-amber-700/70 font-medium mt-1 leading-relaxed">
                    {t('optimization_desc', 'leads', 'Nous avons détecté des prospects avec le même numéro de téléphone. Veuillez sélectionner uniquement ceux que vous souhaitez envoyer au Call Center.')}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {Object.entries(duplicateCheck.groups)
                  .filter(([_, group]) => group.length > 1)
                  .map(([phone, group], groupIdx) => (
                    <div key={phone} className="bg-slate-50/50 border border-slate-100 rounded-2xl overflow-hidden shadow-sm transition-all hover:shadow-md">
                      <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                            <Phone className="w-4 h-4 text-slate-400" />
                          </div>
                          <span className="text-sm font-black text-slate-700 tracking-tight">{phone}</span>
                        </div>
                        <span className="px-3 py-1 bg-white rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-100">
                          {t('dup_count', 'leads', '{count} Doublons').replace('{count}', String(group.length))}
                        </span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {group.map((lead) => {
                          const leadId = Number(String(lead.id).replace('lead-', ''));
                          const isSelected = duplicateCheck.ids.includes(leadId);
                          return (
                            <div 
                              key={lead.id} 
                              className={`p-6 flex items-center justify-between transition-all ${
                                isSelected ? 'bg-influencer-50/10' : duplicateCheck.deleteIds.includes(leadId) ? 'bg-red-50/10' : 'bg-white'
                              }`}
                            >
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className="flex-1 min-w-0">
                                  <p className="font-black text-slate-900 truncate tracking-tight">{lead.order?.customerName}</p>
                                  <div className="flex items-center gap-3 mt-1.5">
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                                      <MapPin size={10} /> {lead.order?.customerCity || '—'}
                                    </span>
                                    <span className="w-1 h-1 rounded-full bg-slate-200" />
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                                      {format(new Date(lead.createdAt), 'dd MMM yyyy')}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-6 shrink-0">
                                {/* Option 1: PUSH */}
                                <button
                                  onClick={() => {
                                    setDuplicateCheck(prev => {
                                      const isAlreadyPushing = prev.ids.includes(leadId);
                                      let newIds = isAlreadyPushing ? prev.ids.filter(id => id !== leadId) : [...prev.ids, leadId];
                                      // If pushing, cannot be deleting
                                      let newDeleteIds = prev.deleteIds.filter(id => id !== leadId);
                                      return { ...prev, ids: newIds, deleteIds: newDeleteIds };
                                    });
                                  }}
                                  className="flex flex-col items-center gap-1.5"
                                >
                                  <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all ${
                                    isSelected 
                                      ? 'bg-influencer-500 border-influencer-500 text-white shadow-lg shadow-influencer-500/20' 
                                      : 'border-slate-200 bg-white hover:border-influencer-300'
                                  }`}>
                                    <Headphones size={18} />
                                  </div>
                                  <span className={`text-[9px] font-black uppercase tracking-widest ${isSelected ? 'text-influencer-600' : 'text-slate-400'}`}>{t('send', 'leads', 'Envoyer')}</span>
                                </button>

                                {/* Option 2: DELETE */}
                                <button
                                  onClick={() => {
                                    setDuplicateCheck(prev => {
                                      const isAlreadyDeleting = prev.deleteIds.includes(leadId);
                                      let newDeleteIds = isAlreadyDeleting ? prev.deleteIds.filter(id => id !== leadId) : [...prev.deleteIds, leadId];
                                      // If deleting, cannot be pushing
                                      let newIds = prev.ids.filter(id => id !== leadId);
                                      return { ...prev, ids: newIds, deleteIds: newDeleteIds };
                                    });
                                  }}
                                  className="flex flex-col items-center gap-1.5"
                                >
                                  <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all ${
                                    duplicateCheck.deleteIds.includes(leadId) 
                                      ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/20' 
                                      : 'border-slate-200 bg-white hover:border-red-300'
                                  }`}>
                                    <Trash2 size={18} />
                                  </div>
                                  <span className={`text-[9px] font-black uppercase tracking-widest ${duplicateCheck.deleteIds.includes(leadId) ? 'text-red-600' : 'text-slate-400'}`}>{t('delete', 'leads', 'Supprimer')}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="p-8 bg-slate-50/50 border-t border-gray-100 flex gap-4">
              <button
                onClick={() => setDuplicateCheck(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 px-8 py-4 bg-white text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-slate-200 hover:bg-gray-50 transition-all"
              >
                {t('cancel', 'leads', 'Annuler')}
              </button>
              {(() => {
                const hasDuplicateSelections = Object.entries(duplicateCheck.groups).some(([phone, group]) => {
                  const selectedCountInGroup = group.filter(lead => {
                    const leadId = Number(String(lead.id).replace('lead-', ''));
                    return duplicateCheck.ids.includes(leadId);
                  }).length;
                  return selectedCountInGroup > 1;
                });

                return (
                  <button
                    onClick={() => {
                      setDuplicateCheck(prev => ({ ...prev, isOpen: false }));

                      if (duplicateCheck.deleteIds.length > 0) {
                        setConfirmModal({
                          isOpen: true,
                          title: t('dup_confirm_title', 'leads', 'Nettoyage des doublons'),
                          message: t('dup_confirm_msg', 'leads', 'Vous allez envoyer {idsCount} leads. Les {deleteCount} doublons sélectionnés seront définitivement supprimés pour nettoyer votre liste. Confirmer ?')
                            .replace('{idsCount}', String(duplicateCheck.ids.length))
                            .replace('{deleteCount}', String(duplicateCheck.deleteIds.length)),
                          variant: 'danger',
                          onConfirm: async () => {
                            try {
                              setIsPushingBulk(true);
                              
                              // Proceed with pushing FIRST to trigger any validation errors
                              if (duplicateCheck.ids.length > 0) {
                                await influencerApi.pushLeadsToCallCenterBulk(duplicateCheck.ids);
                              }

                              // Proceed with deletion ONLY if push was successful
                              if (duplicateCheck.deleteIds.length > 0) {
                                try {
                                  await influencerApi.deleteLeadsBulk(duplicateCheck.deleteIds);
                                } catch (e: any) {
                                  // If 404, they might have already been deleted, we can proceed
                                  if (e.response?.status !== 404) throw e;
                                }
                              }

                              toast.success(t('dup_process_success', 'leads', '{pushCount} envoyés et {deleteCount} supprimés')
                                .replace('{pushCount}', String(duplicateCheck.ids.length))
                                .replace('{deleteCount}', String(duplicateCheck.deleteIds.length)));
                              setSelectedIds([]);
                              setConfirmModal(prev => ({ ...prev, isOpen: false }));
                            } catch (err: any) {
                              toast.error(err.response?.data?.message || t('error_process', 'leads', 'Erreur lors du traitement'));
                            } finally {
                              loadData();
                              setIsPushingBulk(false);
                            }
                          }
                        });
                      } else {
                        proceedWithBulkPush(duplicateCheck.ids);
                      }
                    }}
                    disabled={hasDuplicateSelections || (duplicateCheck.ids.length === 0 && duplicateCheck.deleteIds.length === 0)}
                    className={`flex-[2] px-8 py-4 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2 ${
                      hasDuplicateSelections || (duplicateCheck.ids.length === 0 && duplicateCheck.deleteIds.length === 0)
                        ? 'bg-gray-300 cursor-not-allowed shadow-none'
                        : 'bg-gray-900 hover:bg-black shadow-gray-900/20'
                    }`}
                  >
                    <Headphones size={16} />
                    {hasDuplicateSelections ? t('dup_has_selections', 'leads', 'Doublons sélectionnés') : t('confirm_count', 'leads', 'Confirmer ({count})').replace('{count}', String(duplicateCheck.ids.length + duplicateCheck.deleteIds.length))}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-white/20 animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${confirmModal.variant === 'danger' ? 'bg-red-50 text-red-500' : 'bg-influencer-50 text-influencer-600'}`}>
                {confirmModal.variant === 'danger' ? <AlertCircle size={32} /> : <Headphones size={32} />}
              </div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight mb-2">
                {confirmModal.title}
              </h2>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">
                {confirmModal.message}
              </p>
            </div>
            
            <div className="p-6 bg-slate-50/50 flex gap-3">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 bg-white border border-slate-100 rounded-2xl transition-all shadow-sm"
              >
                {t('cancel', 'leads', 'Annuler')}
              </button>
              <button
                onClick={confirmModal.onConfirm}
                disabled={isPushingBulk}
                className={`flex-1 px-6 py-3 text-xs font-black uppercase tracking-widest text-white rounded-2xl shadow-lg transition-all ${
                  confirmModal.variant === 'danger' 
                    ? 'bg-red-500 hover:bg-red-600 shadow-red-200' 
                    : 'bg-influencer-600 hover:bg-influencer-700 shadow-influencer-200'
                }`}
              >
                {isPushingBulk ? t('loading_generic', 'leads', 'En cours...') : t('confirm_btn', 'leads', 'Confirmer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomPieTooltip({ active, payload, total }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const percent = total > 0 ? ((data.value / total) * 100).toFixed(1) : 0;
    return (
      <div className="bg-white p-3 rounded-2xl shadow-xl border border-gray-100 flex flex-col gap-1 z-50 relative outline-none">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: data.color || data.fill || '#cbd5e1' }} />
          <span className="text-[10px] font-bold text-gray-500 uppercase">{data.name}</span>
        </div>
        <div className="flex items-baseline gap-1.5 pl-4">
          <span className="text-sm font-black text-gray-900">{percent}%</span>
        </div>
      </div>
    );
  }
  return null;
}

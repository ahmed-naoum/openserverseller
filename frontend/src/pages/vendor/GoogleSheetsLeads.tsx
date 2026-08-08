import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  ShoppingBag, 
  Search, 
  RefreshCw, 
  Copy, 
  Check, 
  Eye, 
  EyeOff,
  DollarSign, 
  Truck, 
  Clock, 
  X,
  Phone,
  User,
  MapPin,
  Package,
  ChevronLeft,
  ChevronRight,
  Send,
  Loader2,
  CheckSquare,
  Square,
  Headphones,
  FileSpreadsheet,
  Zap,
  Key,
  ShieldAlert,
  Play,
  CheckCircle2,
  AlertTriangle,
  Code2,
  Table as TableIcon,
  Mail
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { googleSheetsApi, leadsApi } from '../../lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr, ar } from 'date-fns/locale';
import googleSheetsLogo from '../../assets/google-sheets-logo.svg';
import { currentBasePath } from '../../lib/dashboardBase';

interface GoogleSheetsOrder {
  id: string | number;
  name?: string;
  order_number?: string | number;
  created_at: string;
  customer?: {
    id?: number;
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
  };
  phone?: string;
  address?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    address1?: string;
    city?: string;
    country?: string;
  };
  fulfillment_status?: string | null;
  financial_status?: string;
  total_price?: number | string;
  currency?: string;
  line_items?: Array<{
    id?: string | number;
    name?: string;
    title?: string;
    quantity?: number;
    price?: number | string;
  }>;
}

export const extractOrderTotal = (order: any): number => {
  if (!order) return 0;
  const possibleFields = [
    order.total,
    order.total_price,
    order.price,
    order.grand_total,
    order.total_amount,
  ];

  for (const field of possibleFields) {
    const num = Number(field);
    if (!isNaN(num) && num > 0) return num;
  }
  return 0;
};

export default function GoogleSheetsLeads() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentMode = (searchParams.get('mode')?.toUpperCase() || user?.mode || 'SELLER') === 'AFFILIATE' ? 'AFFILIATE' : 'SELLER';

  // Tabs: 'LEADS' or 'SETUP'
  const [activeTab, setActiveTab] = useState<'LEADS' | 'SETUP'>('LEADS');

  const [orders, setOrders] = useState<GoogleSheetsOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | number | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<GoogleSheetsOrder | null>(null);

  // Status & Webhook Token state
  const [connectionStatus, setConnectionStatus] = useState<any>(null);
  const [isRotatingToken, setIsRotatingToken] = useState(false);
  const [showWebhookToken, setShowWebhookToken] = useState(false);

  // Checkbox multi-select state
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string | number>>(new Set());

  // Push to Call Center Modal state
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [isPushing, setIsPushing] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('ALL');

  // Quick URL connect state
  const [quickUrl, setQuickUrl] = useState('');
  const [isConnectingQuick, setIsConnectingQuick] = useState(false);

  const handleQuickConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickUrl.trim()) return;
    setIsConnectingQuick(true);
    try {
      const res = await googleSheetsApi.connect(quickUrl.trim());
      if (res.data && res.data.success) {
        toast.success('Google Sheet connecté et synchronisé avec succès !');
        await fetchOrders();
        await fetchStatus();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la connexion du Google Sheet');
    } finally {
      setIsConnectingQuick(false);
    }
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    fetchOrders();
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await googleSheetsApi.getStatus();
      if (res.data && res.data.success) {
        setConnectionStatus(res.data.data);
        if (res.data.data?.sheetUrl) {
          setQuickUrl(res.data.data.sheetUrl);
        }
      }
    } catch (err) {
      console.error('Error fetching google sheets status:', err);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await googleSheetsApi.getOrders();
      if (response.data && response.data.success) {
        setOrders(response.data.data || []);
      }
    } catch (error: any) {
      console.error('Error fetching Google Sheets orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRotateToken = async () => {
    if (!window.confirm('Voulez-vous vraiment régénérer votre Token Webhook ? Vous devrez mettre à jour la variable TOKEN dans votre Google Apps Script.')) {
      return;
    }
    setIsRotatingToken(true);
    try {
      const res = await googleSheetsApi.rotateToken();
      if (res.data && res.data.success) {
        toast.success('Token Webhook régénéré avec succès !');
        fetchStatus();
      } else {
        toast.error('Échec de la régénération du token');
      }
    } catch (err) {
      console.error('Rotate token error:', err);
      toast.error('Erreur lors de la régénération du token');
    } finally {
      setIsRotatingToken(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      if (quickUrl) {
        const res = await googleSheetsApi.connect(quickUrl);
        if (res.data && res.data.success) {
          toast.success(res.data.message || 'Mise à jour & Synchronisation réussie !');
          fetchOrders();
          fetchStatus();
          return;
        }
      }
      const response = await googleSheetsApi.syncNow();
      if (response.data && response.data.success) {
        toast.success(response.data.message || 'Mise à jour & Synchronisation réussie !');
        fetchOrders();
        fetchStatus();
      } else {
        toast.error('Échec de la synchronisation');
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error('Erreur lors de la synchronisation avec Google Sheets');
    } finally {
      setIsSyncing(false);
    }
  };

  const copyToClipboard = (text: string, type: 'phone' | 'token' | 'script', id?: string | number) => {
    navigator.clipboard.writeText(text);
    if (type === 'phone' && id) {
      setCopiedPhoneId(id);
      setTimeout(() => setCopiedPhoneId(null), 2000);
    } else if (type === 'token') {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } else if (type === 'script') {
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    }
    toast.success('Copié dans le presse-papier !');
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(paginatedOrders.map(o => o.id));
      setSelectedOrderIds(allIds);
    } else {
      setSelectedOrderIds(new Set());
    }
  };

  const handleToggleSelectOrder = (id: string | number) => {
    const next = new Set(selectedOrderIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedOrderIds(next);
  };

  const openPushModal = async () => {
    if (selectedOrderIds.size === 0) {
      toast.error('Veuillez sélectionner au moins une commande à pousser vers le Call Center');
      return;
    }

    setIsPushModalOpen(true);
    setLoadingProducts(true);
    try {
      const res = await leadsApi.getMyProducts({ mode: currentMode });
      const prods = res.data?.data || res.data || [];
      setProducts(prods);
      if (prods.length > 0) {
        setSelectedProductId(prods[0].id);
      }
    } catch (err) {
      console.error('Error fetching user products:', err);
      toast.error('Impossible de charger vos produits');
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleConfirmPush = async () => {
    if (!selectedProductId) {
      toast.error('Veuillez sélectionner un produit du catalogue');
      return;
    }

    const selectedOrdersList = orders.filter(o => selectedOrderIds.has(o.id));
    if (selectedOrdersList.length === 0) return;

    setIsPushing(true);
    try {
      const payload = {
        source: 'GOOGLE_SHEETS',
        mode: currentMode,
        productId: selectedProductId,
        orders: selectedOrdersList.map(order => {
          const totalVal = extractOrderTotal(order);
          const custPhone = order.phone || order.customer?.phone || order.address?.phone || '';

          return {
            sourceId: String(order.id),
            orderNumber: String(order.order_number || order.name || order.id),
            customerName: [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(' ') || order.address?.first_name || 'Prospect Google Sheets',
            customerPhone: custPhone,
            customerCity: order.address?.city || 'Non spécifiée',
            customerAddress: order.address?.address1 || '',
            totalAmountMad: totalVal,
            notes: `Commande importée depuis Google Sheets. Ref: ${order.order_number || order.id}`,
            items: order.line_items?.map((item: any) => ({
              productName: item.name || item.title || 'Produit',
              quantity: item.quantity || 1,
              price: item.price || 0,
            })) || []
          };
        })
      };

      const res = await leadsApi.pushIntegrationLeads(payload);
      if (res.data && res.data.success) {
        toast.success(`Succès ! ${res.data.data?.createdCount || selectedOrdersList.length} commande(s) envoyée(s) au Call Center.`);
        setIsPushModalOpen(false);
        setSelectedOrderIds(new Set());
        navigate(`${currentBasePath(user?.role)}/leads?mode=${currentMode}`);
      } else {
        toast.error(res.data?.message || 'Échec de l\'envoi vers le Call Center');
      }
    } catch (err: any) {
      console.error('Push integration leads error:', err);
      toast.error(err.response?.data?.message || 'Erreur lors de l\'envoi vers le Call Center');
    } finally {
      setIsPushing(false);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const custName = [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(' ') || order.address?.first_name || '';
    const phone = order.phone || order.customer?.phone || order.address?.phone || '';
    const orderNum = String(order.order_number || order.name || order.id);

    const matchesSearch = 
      orderNum.toLowerCase().includes(searchTerm.toLowerCase()) ||
      custName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      phone.includes(searchTerm);

    const matchesFulfillment = fulfillmentFilter === 'ALL' || order.fulfillment_status === fulfillmentFilter;

    return matchesSearch && matchesFulfillment;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const filteredProducts = products.filter(p => {
    const title = p.nameFr || p.nameAr || p.name || '';
    return title.toLowerCase().includes(productSearch.toLowerCase()) || p.sku?.toLowerCase().includes(productSearch.toLowerCase());
  });

  const currentToken = connectionStatus?.webhookToken || 'CHARGEMENT...';
  const apiEndpointUrl = `${window.location.origin}/api/v1/google-sheets/webhook`;

  const generatedAppsScript = `var TOKEN = '${currentToken}';
var API_URL = '${apiEndpointUrl}';

var SHEET_NAME = 'Leads';
var LOG_SHEET_NAME = 'Sync Log';
var DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

var HEADERS = [
  '👤 Customer',
  '📞 Phone',
  '🏙️ City',
  '📍 Address',
  '💰 Price (MAD)',
  '🔢 Qty',
  '🏷️ SKU',
  '📝 Note',
  '📊 SILACOD Status'
];

var LOG_HEADERS = [
  'Phone',
  'SKU',
  'Duplicate Key',
  'Order No.',
  'API Order No.',
  'Synced At',
  'Source Row'
];

function onOpen() {
  getOrCreateSheet();
  getOrCreateLogSheet();
  SpreadsheetApp.getUi()
    .createMenu('🟢 SILACOD')
    .addItem('📤 Send All Leads Now', 'sendLeads')
    .addItem('🎨 Apply SILACOD Theme & UI', 'setup')
    .addToUi();
}

function setup() {
  getOrCreateSheet(true);
  getOrCreateLogSheet();
  
  // Clean old triggers & install Live onEdit Trigger
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    var handler = trigger.getHandlerFunction();
    if (handler === 'syncEditedLead' || handler === 'syncLeads') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('syncEditedLead')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();

  SpreadsheetApp.getUi().alert(
    '🎨 SILACOD Theme Applied Successfully!\\n\\n⚡ Real-Time Auto-Sync is now active.'
  );
}

function getOrCreateSheet(forceFormat) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) { sheet = ss.insertSheet(SHEET_NAME); }

  if (sheet.getMaxColumns() < HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), HEADERS.length - sheet.getMaxColumns());
  }

  // Row 1: SILACOD Brand Banner (Dark Blue Navy)
  var bannerRange = sheet.getRange('A1:I1');
  bannerRange.merge()
    .setValue('⚡ SILACOD LEADS MANAGER — Real-Time Direct Sync')
    .setFontWeight('bold')
    .setFontSize(13)
    .setFontColor('#ffffff')
    .setBackground('#0f172a') // SILACOD Dark Navy Blue
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 42);

  // Row 2: Table Column Headers (Vibrant Orange)
  var headerRange = sheet.getRange(2, 1, 1, HEADERS.length);
  headerRange.setValues([HEADERS])
    .setFontWeight('bold')
    .setFontSize(11)
    .setFontColor('#ffffff')
    .setBackground('#ea580c') // SILACOD Vibrant Orange
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(2, 36);

  sheet.setFrozenRows(2);

  // SILACOD Column Widths
  sheet.setColumnWidth(1, 190);
  sheet.setColumnWidth(2, 150);
  sheet.setColumnWidth(3, 160);
  sheet.setColumnWidth(4, 280);
  sheet.setColumnWidth(5, 120);
  sheet.setColumnWidth(6, 80);
  sheet.setColumnWidth(7, 180);
  sheet.setColumnWidth(8, 250);
  sheet.setColumnWidth(9, 260);

  var availableRows = Math.max(sheet.getMaxRows() - 2, 1);
  sheet.getRange(3, 2, availableRows, 1).setNumberFormat('@');
  sheet.getRange(3, 5, availableRows, 1).setNumberFormat('#,##0.00 "DH"');
  sheet.getRange(3, 6, availableRows, 1).setNumberFormat('0');

  return sheet;
}

function syncEditedLead(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAME || e.range.getRow() < 3) return;

  var rowNumber = e.range.getRow();
  var fullRow = sheet.getRange(rowNumber, 1, 1, HEADERS.length).getDisplayValues()[0];
  var data = fullRow.slice(0, 8);
  var status = cleanValue(fullRow[8]);

  if (e.range.getColumn() === 2) {
    var cleanP = normalizePhoneForSheet(e.range.getValue());
    sheet.getRange(rowNumber, 2).setNumberFormat('@').setValue(cleanP);
    data[1] = cleanP;
  }

  if (isCompletelyBlank(data)) {
    clearGeneratedData(sheet, rowNumber);
    return;
  }

  if (isSuccessfulStatus(status)) return;

  var logSheet = getOrCreateLogSheet();
  var recentOrdersMap = buildRecentOrdersMap(logSheet);
  processLeadRow(sheet, logSheet, rowNumber, data, recentOrdersMap);
}

function sendLeads() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) { SpreadsheetApp.getUi().alert('❌ Sheet Leads non trouvée.'); return; }
  getOrCreateSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 3) { SpreadsheetApp.getUi().alert('ℹ️ Aucun prospect trouvé.'); return; }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) { SpreadsheetApp.getUi().alert('🔒 Un autre processus est en cours.'); return; }

  try {
    var logSheet = getOrCreateLogSheet();
    var recentOrdersMap = buildRecentOrdersMap(logSheet);
    var rows = sheet.getRange(3, 1, lastRow - 2, HEADERS.length).getDisplayValues();
    var sentCount = 0, errorCount = 0, duplicateCount = 0, alreadySentCount = 0;

    for (var index = 0; index < rows.length; index++) {
      var rowNumber = index + 3;
      var fullRow = rows[index];
      var data = fullRow.slice(0, 8);
      var status = cleanValue(fullRow[8]);

      if (isCompletelyBlank(data)) { clearGeneratedData(sheet, rowNumber); continue; }
      if (isSuccessfulStatus(status)) { alreadySentCount++; continue; }

      var result = processLeadRow(sheet, logSheet, rowNumber, data, recentOrdersMap);
      if (result === 'sent') sentCount++;
      else if (result === 'duplicate') duplicateCount++;
      else if (result === 'error') errorCount++;
    }

    SpreadsheetApp.getUi().alert(
      '📦 Envoi vers SILACOD terminé !\\n\\n' +
      '✅ Envoyés : ' + sentCount + '\\n' +
      '❌ Erreurs : ' + errorCount + '\\n' +
      '🔁 Doublons : ' + duplicateCount + '\\n' +
      '⏭️ Déjà envoyés : ' + alreadySentCount
    );
  } finally {
    lock.releaseLock();
  }
}

function processLeadRow(sheet, logSheet, rowNumber, data, recentOrdersMap) {
  var lead = {
    customer: cleanValue(data[0]),
    phone:    normalizePhone(data[1]),
    city:     cleanValue(data[2]),
    address:  cleanValue(data[3]),
    price:    cleanValue(data[4]),
    quantity: normalizeQuantityForApi(data[5]),
    sku:      cleanValue(data[6]),
    note:     cleanValue(data[7])
  };

  var validationError = validateLead(lead);
  if (validationError) { setStatus(sheet, rowNumber, '❌ ' + validationError); return 'error'; }

  var duplicateKey = createDuplicateKey(lead.phone, lead.sku);
  var lastSuccessfulTime = recentOrdersMap[duplicateKey];
  if (lastSuccessfulTime) {
    var elapsedMs = Date.now() - lastSuccessfulTime;
    var remainingMs = DUPLICATE_WINDOW_MS - elapsedMs;
    if (remainingMs > 0) {
      setStatus(sheet, rowNumber, '🔁 Doublon • ' + formatRemainingTime(remainingMs));
      return 'duplicate';
    }
    delete recentOrdersMap[duplicateKey];
  }

  var orderNumber = generateOrderNumber();
  var internalId = generateInternalId();

  try {
    setStatus(sheet, rowNumber, '📤 Envoi...');
    SpreadsheetApp.flush();

    var apiRow = [
      internalId,
      orderNumber,
      lead.customer,
      lead.phone,
      normalizePriceForApi(lead.price),
      lead.city,
      lead.address,
      lead.note,
      lead.sku,
      lead.quantity
    ];

    var response = UrlFetchApp.fetch(API_URL, {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      headers: { Accept: 'application/json' },
      payload: JSON.stringify({ token: TOKEN, row: apiRow })
    });

    var responseCode = response.getResponseCode();
    var result = safeJsonParse(response.getContentText());

    if (responseCode >= 200 && responseCode < 300) {
      var apiOrderNumber = result.order_number || result.orderNumber || result.id || '';
      var syncedAt = new Date();
      setStatus(sheet, rowNumber, '✅ Synchronisé • ' + orderNumber);
      addSuccessfulOrderToLog(logSheet, lead.phone, lead.sku, duplicateKey, orderNumber, apiOrderNumber, syncedAt, rowNumber);
      recentOrdersMap[duplicateKey] = syncedAt.getTime();
      return 'sent';
    }

    var apiError = result.error || result.message || 'Erreur serveur ' + responseCode;
    setStatus(sheet, rowNumber, '❌ ' + cleanApiError(apiError));
    return 'error';

  } catch (error) {
    setStatus(sheet, rowNumber, '⚠️ Connexion échouée • Réessayer');
    console.error('Erreur sync ligne ' + rowNumber + ': ' + error.message);
    return 'error';
  }
}

function getOrCreateLogSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!logSheet) { logSheet = ss.insertSheet(LOG_SHEET_NAME); }
  if (logSheet.getMaxColumns() < LOG_HEADERS.length) {
    logSheet.insertColumnsAfter(logSheet.getMaxColumns(), LOG_HEADERS.length - logSheet.getMaxColumns());
  }
  logSheet.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS])
    .setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
  logSheet.setFrozenRows(1);
  if (!logSheet.isSheetHidden()) logSheet.hideSheet();
  return logSheet;
}

function setStatus(sheet, rowNumber, statusText) {
  var cell = sheet.getRange(rowNumber, 9);
  cell.setValue(statusText).setFontWeight('bold').setVerticalAlignment('middle').setHorizontalAlignment('center');
  if (statusText.indexOf('✅') === 0)      { cell.setBackground('#d1fae5').setFontColor('#065f46'); }
  else if (statusText.indexOf('📤') === 0) { cell.setBackground('#dbeafe').setFontColor('#1e40af'); }
  else if (statusText.indexOf('🔁') === 0) { cell.setBackground('#fef3c7').setFontColor('#92400e'); }
  else if (statusText.indexOf('⚠️') === 0) { cell.setBackground('#ffedd5').setFontColor('#9a3412'); }
  else if (statusText.indexOf('❌') === 0) { cell.setBackground('#fee2e2').setFontColor('#991b1b'); }
}

function generateOrderNumber() {
  var timezone = Session.getScriptTimeZone() || 'Africa/Casablanca';
  var today = Utilities.formatDate(new Date(), timezone, 'yyMMdd');
  var props = PropertiesService.getScriptProperties();
  var savedDate = props.getProperty('ORDER_DATE');
  var sequence = parseInt(props.getProperty('ORDER_SEQUENCE') || '0', 10);
  if (savedDate !== today) { sequence = 0; props.setProperty('ORDER_DATE', today); }
  sequence++;
  props.setProperty('ORDER_SEQUENCE', String(sequence));
  return 'SIL-' + today + String(sequence).padStart(3, '0');
}

function generateInternalId() {
  return 'LD-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
}

function addSuccessfulOrderToLog(logSheet, phone, sku, duplicateKey, orderNumber, apiOrderNumber, syncedAt, sourceRow) {
  logSheet.appendRow([phone, sku, duplicateKey, orderNumber, apiOrderNumber, syncedAt, sourceRow]);
  logSheet.getRange(logSheet.getLastRow(), 6).setNumberFormat('yyyy-MM-dd HH:mm:ss');
}

function buildRecentOrdersMap(logSheet) {
  var map = {};
  var lastRow = logSheet.getLastRow();
  if (lastRow < 2) return map;
  var logRows = logSheet.getRange(2, 1, lastRow - 1, LOG_HEADERS.length).getValues();
  for (var i = 0; i < logRows.length; i++) {
    var phone = normalizePhone(logRows[i][0]);
    var sku = cleanValue(logRows[i][1]);
    var savedKey = cleanValue(logRows[i][2]);
    var duplicateKey = savedKey || createDuplicateKey(phone, sku);
    var syncedAt = logRows[i][5];
    if (!isValidDateValue(syncedAt) && isValidDateValue(logRows[i][4])) syncedAt = logRows[i][4];
    if (!duplicateKey || !isValidDateValue(syncedAt)) continue;
    var syncedTime = new Date(syncedAt).getTime();
    if (!map[duplicateKey] || syncedTime > map[duplicateKey]) map[duplicateKey] = syncedTime;
  }
  return map;
}

function validateLead(lead) {
  if (!lead.customer) return 'Client manquant';
  if (!lead.phone) return 'Téléphone manquant';
  if (!isValidMoroccanPhone(lead.phone)) return 'Téléphone invalide';
  if (!lead.city) return 'Ville manquante';
  if (!lead.address) return 'Adresse manquante';
  if (!lead.price) return 'Prix manquant';
  if (!lead.sku) return 'SKU manquant';
  return '';
}

function isValidMoroccanPhone(phone) { return /^0[67]\\d{8}$/.test(phone); }

function normalizePhone(value) {
  var phone = String(value || '').trim().replace(/\\s+/g, '').replace(/[-().]/g, '');
  if (phone.indexOf('+212') === 0) phone = '0' + phone.substring(4);
  else if (phone.indexOf('212') === 0) phone = '0' + phone.substring(3);
  return phone;
}

function normalizePhoneForSheet(value) { return normalizePhone(value); }

function isValidPrice(price) {
  var n = Number(normalizePriceForApi(price));
  return !isNaN(n) && n > 0;
}

function normalizePriceForApi(price) {
  return String(price || '').replace(/\\s/g, '').replace(',', '.').replace(/[^\\d.]/g, '');
}

function normalizeQuantityForApi(quantity) {
  var cleaned = String(quantity || '').trim().replace(/[^\\d]/g, '');
  if (!cleaned) return 1;
  var n = parseInt(cleaned, 10);
  return (isNaN(n) || n < 1) ? 1 : n;
}

function createDuplicateKey(phone, sku) { return normalizePhone(phone) + '||' + normalizeSku(sku); }

function normalizeSku(value) {
  return String(value || '').trim().toLowerCase().replace(/\\s+/g, '').replace(/[-_/\\\\.,،؛:()[\\]{}]/g, '');
}

function isSuccessfulStatus(status) {
  status = cleanValue(status);
  return status.indexOf('✅') === 0 || status.indexOf('✓') === 0;
}

function clearGeneratedData(sheet, rowNumber) {
  var cell = sheet.getRange(rowNumber, 9);
  cell.clearContent().setBackground(null);
}

function formatRemainingTime(ms) {
  var totalMinutes = Math.ceil(ms / 60000);
  var hours = Math.floor(totalMinutes / 60);
  var minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return hours + 'h ' + minutes + 'm';
  if (hours > 0) return hours + 'h';
  return minutes + 'm';
}

function cleanApiError(errorText) {
  var cleaned = String(errorText || 'Erreur inconnue').replace(/forcelog/gi, 'Livraison').replace(/silacod/gi, 'Serveur').trim();
  if (cleaned.length > 140) cleaned = cleaned.substring(0, 140) + '...';
  return cleaned;
}

function cleanValue(value) { return String(value || '').trim(); }

function isCompletelyBlank(data) {
  for (var i = 0; i < data.length; i++) { if (cleanValue(data[i]) !== '') return false; }
  return true;
}

function isValidDateValue(value) {
  if (!value) return false;
  return !isNaN(new Date(value).getTime());
}

function safeJsonParse(text) {
  if (!text) return {};
  try { return JSON.parse(text); } catch (e) { return { message: String(text).substring(0, 200) }; }
}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Navigation / Tabs Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl p-2.5 bg-emerald-500/10 flex items-center justify-center shadow-lg shadow-emerald-500/10 border border-emerald-500/20 shrink-0">
            <img src={googleSheetsLogo} alt="Google Sheets" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">
                Google Sheets Auto-Sync
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {connectionStatus?.isConnected ? 'Connecté' : 'Actif'}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Synchronisez automatiquement chaque prospect ajouté à votre Google Sheet via Google Apps Script.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/60 shrink-0">
          <button
            onClick={() => setActiveTab('LEADS')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
              activeTab === 'LEADS'
                ? 'bg-white text-slate-900 shadow-md shadow-slate-200/50'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <TableIcon size={16} className={activeTab === 'LEADS' ? 'text-emerald-600' : ''} />
            <span>Commandes & Prospects</span>
          </button>

          <button
            onClick={() => setActiveTab('SETUP')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
              activeTab === 'SETUP'
                ? 'bg-white text-slate-900 shadow-md shadow-slate-200/50'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Zap size={16} className={activeTab === 'SETUP' ? 'text-amber-500' : ''} />
            <span>Guide & Apps Script</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: LEADS MANAGEMENT & PUSH TO CALL CENTER */}
      {/* ========================================================================= */}
      {activeTab === 'LEADS' && (
        <div className="space-y-6">
          {/* Quick Sheet Connection Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-5 rounded-2xl border border-slate-800 shadow-lg text-white space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-black flex items-center gap-2">
                  <FileSpreadsheet className="text-emerald-400 w-4 h-4" />
                  <span>Connecter votre Google Sheet (Direct Sync sans Script)</span>
                </h4>
                <p className="text-xs text-slate-300 font-medium">
                  Collez l'URL de votre document Google Sheet pour importer automatiquement vos prospects en direct.
                </p>
              </div>
              {connectionStatus?.sheetUrl && (
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-mono font-bold truncate max-w-xs self-start sm:self-auto">
                  Connected: {connectionStatus.sheetUrl}
                </span>
              )}
            </div>

            <form onSubmit={handleQuickConnect} className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                required
                placeholder="https://docs.google.com/spreadsheets/d/1ewepu1fc5ecq5tvoGTEKQk3gHLmVQIEJgF22x9pkB2Q/edit"
                value={quickUrl}
                onChange={(e) => setQuickUrl(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={isConnectingQuick}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
              >
                {isConnectingQuick ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span>{connectionStatus?.isConnected ? 'Mettre à jour & Synchroniser' : 'Connecter & Synchroniser'}</span>
              </button>
            </form>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm font-bold text-slate-700">
              Liste des prospects synchronisés ({filteredOrders.length})
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {selectedOrderIds.size > 0 && (
                <button
                  onClick={openPushModal}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 rounded-xl font-black text-sm shadow-lg shadow-emerald-500/25 transition-all transform active:scale-95"
                >
                  <Headphones className="w-4 h-4" />
                  <span>Envoyer au Call Center ({selectedOrderIds.size})</span>
                </button>
              )}
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher par nom, téléphone, réf..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <select
                value={fulfillmentFilter}
                onChange={(e) => {
                  setFulfillmentFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="NEW">Nouveaux prospects</option>
                <option value="CONFIRMED">Confirmés</option>
                <option value="DELIVERED">Livrés</option>
              </select>
            </div>
          </div>

          {/* Main Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
                <p className="text-slate-500 font-medium text-sm">Chargement des prospects Google Sheets...</p>
              </div>
            ) : paginatedOrders.length === 0 ? (
              <div className="p-12 text-center">
                <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-800 mb-1">Aucune commande trouvée</h3>
                <p className="text-slate-500 text-sm max-w-md mx-auto mb-4">
                  {searchTerm ? 'Aucun résultat ne correspond à vos filtres de recherche.' : 'Ajoutez une ligne dans votre Google Sheet et cliquez sur Send Leads dans le menu Silacod pour voir vos prospects ici.'}
                </p>
                <button
                  onClick={() => setActiveTab('SETUP')}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-md shadow-emerald-500/20 inline-flex items-center gap-2"
                >
                  <Code2 size={16} />
                  <span>Voir le Script & Guide d'installation</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                      <th className="p-4 w-10">
                        <input
                          type="checkbox"
                          checked={paginatedOrders.length > 0 && paginatedOrders.every(o => selectedOrderIds.has(o.id))}
                          onChange={handleSelectAll}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                        />
                      </th>
                      <th className="p-4">Réf / Date</th>
                      <th className="p-4">Prospect</th>
                      <th className="p-4">Téléphone</th>
                      <th className="p-4">Ville</th>
                      <th className="p-4">Montant</th>
                      <th className="p-4">Statut</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                    {paginatedOrders.map((order) => {
                      const isSelected = selectedOrderIds.has(order.id);
                      const phone = order.phone || order.customer?.phone || order.address?.phone || '';
                      const total = extractOrderTotal(order);
                      const custName = [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(' ') || order.address?.first_name || 'Prospect GS';

                      return (
                        <tr 
                          key={order.id} 
                          className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-emerald-50/30' : ''}`}
                        >
                          <td className="p-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectOrder(order.id)}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                            />
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-slate-900">{order.order_number || order.id}</div>
                            <div className="text-xs text-slate-400">
                              {order.created_at ? format(new Date(order.created_at), 'dd MMM yyyy, HH:mm', { locale: isRtl ? ar : fr }) : 'N/A'}
                            </div>
                          </td>
                          <td className="p-4 font-semibold text-slate-800">{custName}</td>
                          <td className="p-4">
                            {phone ? (
                              <button
                                onClick={() => copyToClipboard(phone, 'phone', order.id)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all"
                              >
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{phone}</span>
                                {copiedPhoneId === order.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400" />}
                              </button>
                            ) : (
                              <span className="text-slate-400 italic text-xs">Non fourni</span>
                            )}
                          </td>
                          <td className="p-4 text-slate-600">{order.address?.city || 'Non spécifiée'}</td>
                          <td className="p-4 font-black text-slate-900">
                            {total > 0 ? `${total.toLocaleString()} DH` : 'N/A'}
                          </td>
                          <td className="p-4">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                              Google Sheets
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => setSelectedOrder(order)}
                              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                              title="Voir les détails"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Footer */}
            {!loading && totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                <span className="text-xs text-slate-500 font-medium">
                  Affichage de {((currentPage - 1) * itemsPerPage) + 1} à {Math.min(currentPage * itemsPerPage, filteredOrders.length)} sur {filteredOrders.length} prospects
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-slate-600 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-slate-700">
                    Page {currentPage} sur {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-slate-600 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SETUP GUIDE, WEBHOOK TOKEN & GOOGLE APPS SCRIPT GENERATOR */}
      {/* ========================================================================= */}
      {activeTab === 'SETUP' && (
        <div className="space-y-8">
          {/* Status Sub-Banner */}
          <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-800">
            <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-2 relative z-10">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Connected
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Endpoint: /api/v1/google-sheets/webhook
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
                Every row you add to your Google Sheet will automatically appear as a new lead in <strong className="text-emerald-400 font-black">SILACOD</strong>. Uses a lightweight Google Apps Script — no Google account linking required.
              </p>
            </div>

            <div className="shrink-0 relative z-10">
              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                className="px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/25 flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                <span>Test Connection</span>
              </button>
            </div>
          </div>

          {/* Direct Sync Google Sheet Card */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl space-y-4 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  <span>Connecter votre Google Sheet (Direct Sync sans Script)</span>
                </h3>
                <p className="text-xs text-slate-300 font-medium mt-1">
                  Collez l'URL de votre document Google Sheet pour importer automatiquement vos prospects en direct.
                </p>
              </div>

              {connectionStatus?.sheetUrl && (
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-mono font-bold truncate max-w-xs self-start sm:self-auto">
                  Connected: {connectionStatus.sheetUrl}
                </span>
              )}
            </div>

            <form onSubmit={handleQuickConnect} className="flex flex-col sm:flex-row gap-3">
              <input
                type="url"
                required
                placeholder="https://docs.google.com/spreadsheets/d/1ewepu1fc5ecq5tvoGTEKQk3gHLmVQIEJgF22x9pkB2Q/edit?gid=1614203144#gid=1614203144"
                value={quickUrl}
                onChange={(e) => setQuickUrl(e.target.value)}
                className="flex-1 px-4 py-3 bg-slate-800/90 border border-slate-700 rounded-2xl text-xs sm:text-sm font-mono text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={isConnectingQuick}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
              >
                {isConnectingQuick ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span>{connectionStatus?.isConnected ? 'Mettre à jour & Synchroniser' : 'Connecter & Synchroniser'}</span>
              </button>
            </form>
          </div>

          {/* Webhook Token Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Key className="w-5 h-5 text-amber-500" />
                  <span>Your Webhook Token</span>
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Private token used to authenticate Google Sheet submissions for your account
                </p>
              </div>

              <button
                onClick={handleRotateToken}
                disabled={isRotatingToken}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 self-start sm:self-auto disabled:opacity-50"
              >
                <RefreshCw size={12} className={isRotatingToken ? 'animate-spin' : ''} />
                <span>Rotate token</span>
              </button>
            </div>

            {/* Token Display Box */}
            <div className="flex items-center gap-3">
              <div className="flex-1 p-3.5 bg-slate-900 text-emerald-400 font-mono text-xs sm:text-sm rounded-2xl overflow-x-auto select-all border border-slate-800 flex items-center justify-between gap-3">
                <span className="truncate">
                  {showWebhookToken ? currentToken : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowWebhookToken(!showWebhookToken)}
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 rounded-lg transition-all shrink-0 flex items-center justify-center"
                  title={showWebhookToken ? 'Masquer le token' : 'Afficher le token'}
                >
                  {showWebhookToken ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button
                onClick={() => copyToClipboard(currentToken, 'token')}
                className="px-4 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold text-xs transition-all flex items-center gap-2 shrink-0 shadow-md shadow-emerald-500/20"
              >
                {copiedToken ? <Check size={16} /> : <Copy size={16} />}
                <span>{copiedToken ? 'Copied!' : 'Copy Token'}</span>
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-amber-800">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Keep this token private.</strong> Anyone with it can create leads in your account. Rotate it immediately if you suspect it was leaked.
              </span>
            </div>
          </div>

          {/* Setup Instructions 4 Steps */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-6">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              Setup Instructions
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Step 1 */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-emerald-600/20">
                  1
                </div>
                <h4 className="text-sm font-bold text-slate-900">Open Apps Script</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  In Google Sheets, click <strong>Extensions</strong> → <strong>Apps Script</strong>. Paste the script below into the editor and click Save (<kbd className="px-1 py-0.5 bg-slate-200 rounded text-[10px]">Ctrl+S</kbd>).
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-emerald-600/20">
                  2
                </div>
                <h4 className="text-sm font-bold text-slate-900">Run setup() once</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  In the Apps Script editor, select the <code className="bg-slate-200 px-1 rounded text-emerald-800">setup</code> function from the dropdown and click <strong>Run</strong>. This creates the "Leads" sheet with column headers.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-emerald-600/20">
                  3
                </div>
                <h4 className="text-sm font-bold text-slate-900">Authorize the script</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Google will ask permission to read your sheet. Click <strong>Advanced</strong> → <strong>Go to project</strong> → <strong>Allow</strong>. This is your own private script.
                </p>
              </div>

              {/* Step 4 */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-emerald-600/20">
                  4
                </div>
                <h4 className="text-sm font-bold text-slate-900">Send leads</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Open the "Leads" tab, fill rows, then click <strong className="text-emerald-700">Silacod → 📤 Send Leads</strong> in your sheet menu. Column I will update with <span className="text-emerald-600 font-bold">✅</span> on success.
                </p>
              </div>
            </div>
          </div>

          {/* Code Block with 1-Click Copy */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-emerald-600" />
                  <span>Google Apps Script</span>
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Your token is already embedded below. Copy and paste this script directly into Apps Script.
                </p>
              </div>

              <button
                onClick={() => copyToClipboard(generatedAppsScript, 'script')}
                className="px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/25 flex items-center gap-2 self-start sm:self-auto"
              >
                {copiedScript ? <Check size={16} /> : <Copy size={16} />}
                <span>{copiedScript ? 'Script Copied!' : 'Copy Script'}</span>
              </button>
            </div>

            <div className="relative rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden">
              <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Code.gs</span>
                <span className="text-emerald-400 font-bold">SILACOD Apps Script v2.0</span>
              </div>
              <pre className="p-4 sm:p-6 text-xs text-slate-300 font-mono leading-relaxed max-h-96 overflow-y-auto select-all">
                {generatedAppsScript}
              </pre>
            </div>
          </div>

          {/* Column Mapping Table */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-4">
            <div>
              <h3 className="text-xl font-black text-slate-900">Column Mapping</h3>
              <p className="text-xs text-slate-400 font-medium">Row 1 must be headers. Data starts from row 2.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="p-3">Col</th>
                    <th className="p-3">Header</th>
                    <th className="p-3">Requirement</th>
                    <th className="p-3">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  <tr>
                    <td className="p-3 font-bold text-emerald-700 font-mono">A</td>
                    <td className="p-3 font-bold">👤 Customer</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold">Required</span></td>
                    <td className="p-3">Customer full name</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-emerald-700 font-mono">B</td>
                    <td className="p-3 font-bold">📞 Phone</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold">Required</span></td>
                    <td className="p-3">Moroccan phone number (06/07XXXXXXXX)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-emerald-700 font-mono">C</td>
                    <td className="p-3 font-bold">🏙️ City</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold">Required</span></td>
                    <td className="p-3">Delivery city name</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-emerald-700 font-mono">D</td>
                    <td className="p-3 font-bold">📍 Address</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold">Required</span></td>
                    <td className="p-3">Full street / neighborhood address</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-emerald-700 font-mono">E</td>
                    <td className="p-3 font-bold">💰 Price</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold">Required</span></td>
                    <td className="p-3">Selling price in DH (numerical)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-emerald-700 font-mono">F</td>
                    <td className="p-3 font-bold">🔢 Qty</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">Optional</span></td>
                    <td className="p-3">Order quantity (defaults to 1)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-emerald-700 font-mono">G</td>
                    <td className="p-3 font-bold">🏷️ SKU</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold">Required</span></td>
                    <td className="p-3">Product SKU code or variant identifier</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-emerald-700 font-mono">H</td>
                    <td className="p-3 font-bold">📝 Note</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">Optional</span></td>
                    <td className="p-3">Delivery instructions or internal notes</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-emerald-700 font-mono">I</td>
                    <td className="p-3 font-bold">📊 Status</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">System</span></td>
                    <td className="p-3">Written back by script (✅ Imported • SIL-xxxx or ❌ Error)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Push to Call Center Portal Modal */}
      {isPushModalOpen && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-100 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2 flex items-center justify-center">
                  <Headphones className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Envoyer au Call Center</h3>
                  <p className="text-xs text-slate-500 font-medium">Associer {selectedOrderIds.size} prospect(s) à un produit</p>
                </div>
              </div>
              <button
                onClick={() => setIsPushModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  1. Rechercher un produit
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filtrer par nom de produit..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  2. Sélectionner le produit cible
                </label>

                {loadingProducts ? (
                  <div className="p-6 text-center">
                    <Loader2 className="w-6 h-6 text-emerald-600 animate-spin mx-auto mb-2" />
                    <p className="text-xs text-slate-500">Chargement de vos produits...</p>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-slate-200 rounded-2xl">
                    <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-600">Aucun produit disponible</p>
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {filteredProducts.map((p) => {
                      const isSelected = selectedProductId === p.id;
                      const title = p.nameFr || p.nameAr || p.name || 'Produit sans nom';

                      return (
                        <div
                          key={p.id}
                          onClick={() => setSelectedProductId(p.id)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200">
                              {p.images?.[0]?.imageUrl || p.imageUrl ? (
                                <img src={p.images?.[0]?.imageUrl || p.imageUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Package className="w-5 h-5 text-slate-400 m-2.5" />
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-slate-900 line-clamp-1">{title}</div>
                              <div className="text-xs text-slate-400">SKU: {p.sku || 'N/A'}</div>
                            </div>
                          </div>

                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'}`}>
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setIsPushModalOpen(false)}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmPush}
                disabled={isPushing || !selectedProductId}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/25 hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50"
              >
                {isPushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Confirmer l'envoi ({selectedOrderIds.size})</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Details Modal */}
      {selectedOrder && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 border border-slate-100 shadow-2xl space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2 flex items-center justify-center">
                  <img src={googleSheetsLogo} alt="" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Prospect #{selectedOrder.order_number || selectedOrder.id}</h3>
                  <p className="text-xs text-slate-400">Reçu le {selectedOrder.created_at ? format(new Date(selectedOrder.created_at), 'dd MMMM yyyy à HH:mm', { locale: isRtl ? ar : fr }) : 'N/A'}</p>
                </div>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl space-y-2 border border-slate-100">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Informations Client</div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">Nom complet:</span>
                  <span className="font-bold text-slate-900">{[selectedOrder.customer?.first_name, selectedOrder.customer?.last_name].filter(Boolean).join(' ') || selectedOrder.address?.first_name || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">Téléphone:</span>
                  <span className="font-bold text-emerald-600">{selectedOrder.phone || selectedOrder.customer?.phone || selectedOrder.address?.phone || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">Ville:</span>
                  <span className="font-bold text-slate-900">{selectedOrder.address?.city || 'Non spécifiée'}</span>
                </div>
                {selectedOrder.address?.address1 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Adresse:</span>
                    <span className="font-medium text-slate-700 text-right">{selectedOrder.address.address1}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2.5 bg-slate-900 text-white font-bold text-sm rounded-xl hover:bg-slate-800 transition-all"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

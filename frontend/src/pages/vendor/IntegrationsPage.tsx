import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Link2, 
  CheckCircle2, 
  RefreshCw, 
  Copy, 
  ExternalLink, 
  ShieldCheck, 
  Zap, 
  Sparkles, 
  Sliders, 
  Eye, 
  EyeOff,
  Activity,
  Lock,
  Trash2,
  Unlink,
  Check,
  X,
  AlertTriangle,
  FileSpreadsheet,
  Mail,
  Code2,
  Table as TableIcon,
  Download
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { youcanApi, shopifyApi, wooCommerceApi, googleSheetsApi } from '../../lib/api';
import toast from 'react-hot-toast';
import wooCommerceLogo from '../../assets/woocommerce-logo.svg';
import shopifyLogo from '../../assets/shopify-logo.svg';
import googleSheetsLogo from '../../assets/google-sheets-logo.svg';

export default function IntegrationsPage() {
  const { language } = useLanguage();

  // YouCan Status State
  const [youcanStatus, setYoucanStatus] = useState<{
    isConnected: boolean;
    autoSyncActive: boolean;
    storeDomain: string | null;
  }>({
    isConnected: false,
    autoSyncActive: true,
    storeDomain: null,
  });
  const [loadingYouCanStatus, setLoadingYouCanStatus] = useState(true);
  const [isSyncingYouCan, setIsSyncingYouCan] = useState(false);
  const [isTogglingYouCanSync, setIsTogglingYouCanSync] = useState(false);

  // WooCommerce Configuration State
  const [wooConfig, setWooConfig] = useState({
    storeUrl: localStorage.getItem('silacod_woo_store_url') || '',
    consumerKey: localStorage.getItem('silacod_woo_consumer_key') || '',
    consumerSecret: localStorage.getItem('silacod_woo_consumer_secret') || '',
    isConnected: !!localStorage.getItem('silacod_woo_store_url'),
    autoSyncActive: true,
  });
  const [isTogglingWooSync, setIsTogglingWooSync] = useState(false);

  // Shopify Status State
  const [shopifyStatus, setShopifyStatus] = useState<{
    isConnected: boolean;
    autoSyncActive: boolean;
    storeDomain: string | null;
  }>({
    isConnected: false,
    autoSyncActive: true,
    storeDomain: null,
  });
  const [loadingShopifyStatus, setLoadingShopifyStatus] = useState(true);
  const [isSyncingShopify, setIsSyncingShopify] = useState(false);
  const [isTogglingShopifySync, setIsTogglingShopifySync] = useState(false);

  // Google Sheets Status State
  const [googleSheetsStatus, setGoogleSheetsStatus] = useState<{
    isConnected: boolean;
    autoSyncActive: boolean;
    sheetUrl: string | null;
    sheetId: string | null;
    webhookToken: string;
  }>({
    isConnected: false,
    autoSyncActive: true,
    sheetUrl: null,
    sheetId: null,
    webhookToken: '',
  });
  const [loadingGoogleSheetsStatus, setLoadingGoogleSheetsStatus] = useState(true);
  const [isSyncingGoogleSheets, setIsSyncingGoogleSheets] = useState(false);
  const [isTogglingGoogleSheetsSync, setIsTogglingGoogleSheetsSync] = useState(false);
  const [googleSheetsDraftUrl, setGoogleSheetsDraftUrl] = useState('');
  const [isConnectingGoogleSheets, setIsConnectingGoogleSheets] = useState(false);

  const downloadSampleExcel = () => {
    const csvRows = [
      ['👤 Customer', '📞 Phone', '🏙️ City', '📍 Address', '💰 Price', '🔢 Qty', '🏷️ SKU', '📝 Note', '📊 Status'],
      ['Ahmed Naoum', '0661234567', 'Casablanca', 'Bd Zerktouni', '299', '1', 'PROD-001', 'Livraison express', ''],
      ['Fatima Zahra', '0770987654', 'Rabat', 'Agdal Rue 12', '450', '2', 'PROD-002', 'Appeler avant livraison', ''],
    ];
    const csvContent = csvRows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Exemple_Leads_Manager_SILACOD.csv';
    link.click();
    toast.success('Modèle téléchargé avec succès !');
  };

  const getAppsScriptCode = (token: string) => {
    const currentToken = token || 'TOKEN_VOTRE_COMPTE';
    const apiEndpointUrl = `${window.location.origin}/api/v1/google-sheets/webhook`;
    return `var TOKEN = '${currentToken}';
var API_URL = '${apiEndpointUrl}';

var SHEET_NAME = 'Leads';
var LOG_SHEET_NAME = 'Sync Log';

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

function onOpen() {
  getOrCreateSheet();
  SpreadsheetApp.getUi()
    .createMenu('🟢 SILACOD')
    .addItem('📤 Send All Leads Now', 'sendLeads')
    .addToUi();
}

function sendLeads() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.getActiveSheet();
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return;

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var customer = row[0], phone = row[1], city = row[2], address = row[3], price = row[4], qty = row[5] || 1, sku = row[6], note = row[7];
    if (!customer || !phone) continue;

    var payload = {
      token: TOKEN,
      customerName: customer,
      phone: String(phone),
      city: city,
      address: address,
      priceMad: price,
      quantity: qty,
      sku: sku,
      notes: note
    };

    try {
      var response = UrlFetchApp.fetch(API_URL, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      if (response.getResponseCode() === 200) {
        sheet.getRange(i + 1, 9).setValue('✅ Imported').setBackground('#d1fae5');
      } else {
        sheet.getRange(i + 1, 9).setValue('❌ Error').setBackground('#fee2e2');
      }
    } catch(e) {
      sheet.getRange(i + 1, 9).setValue('❌ Error').setBackground('#fee2e2');
    }
  }
}`;
  };

  // Modal Open States
  const [activeModal, setActiveModal] = useState<'YOUCAN' | 'WOOCOMMERCE' | 'SHOPIFY' | 'GOOGLESHEETS' | null>(null);
  const [confirmDisconnectModal, setConfirmDisconnectModal] = useState<'YOUCAN' | 'WOOCOMMERCE' | 'SHOPIFY' | 'GOOGLESHEETS' | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Form Draft States
  const [wooDraft, setWooDraft] = useState({ storeUrl: '', consumerKey: '', consumerSecret: '' });
  const [shopifyDraft, setShopifyDraft] = useState({ storeDomain: '', accessToken: '' });
  const [showWooConsumerKey, setShowWooConsumerKey] = useState(false);
  const [showWooConsumerSecret, setShowWooConsumerSecret] = useState(false);

  // Webhook URLs
  const apiBaseUrl = (import.meta.env as any).VITE_API_URL || 'https://api.silacod.com/api/v1';
  const wooWebhookUrl = `${apiBaseUrl}/woocommerce/webhook`;

  // Fetch status on mount
  useEffect(() => {
    fetchYouCanStatus();
    fetchShopifyStatus();
    fetchWooCommerceStatus();
    fetchGoogleSheetsStatus();
  }, []);

  const fetchGoogleSheetsStatus = async () => {
    setLoadingGoogleSheetsStatus(true);
    try {
      const res = await googleSheetsApi.getStatus();
      const statusData = res.data?.data || res.data;
      if (statusData) {
        setGoogleSheetsStatus({
          isConnected: !!statusData.isConnected,
          autoSyncActive: statusData.autoSyncActive ?? true,
          sheetUrl: statusData.sheetUrl || null,
          sheetId: statusData.sheetId || null,
          webhookToken: statusData.webhookToken || '',
        });
      }
    } catch (err) {
      console.error("Error fetching Google Sheets status:", err);
    } finally {
      setLoadingGoogleSheetsStatus(false);
    }
  };

  const fetchWooCommerceStatus = async () => {
    try {
      const res = await wooCommerceApi.getStatus();
      const statusData = res.data?.data || res.data;
      if (statusData) {
        setWooConfig(prev => ({
          ...prev,
          isConnected: !!statusData.isConnected,
          storeUrl: statusData.storeUrl || prev.storeUrl,
          autoSyncActive: statusData.autoSyncActive ?? true,
        }));
      }
    } catch (err) {
      console.error("Error fetching WooCommerce status:", err);
    }
  };

  const fetchShopifyStatus = async () => {
    setLoadingShopifyStatus(true);
    try {
      const res = await shopifyApi.getStatus();
      const statusData = res.data?.data || res.data;
      if (statusData) {
        setShopifyStatus({
          isConnected: !!statusData.isConnected,
          autoSyncActive: statusData.autoSyncActive ?? true,
          storeDomain: statusData.storeDomain || null,
        });
      }
    } catch (err) {
      console.error("Error fetching Shopify status:", err);
    } finally {
      setLoadingShopifyStatus(false);
    }
  };

  const fetchYouCanStatus = async () => {
    setLoadingYouCanStatus(true);
    try {
      const res = await youcanApi.getStatus();
      const statusData = res.data?.data || res.data;
      if (statusData) {
        setYoucanStatus({
          isConnected: !!statusData.isConnected,
          autoSyncActive: statusData.autoSyncActive ?? true,
          storeDomain: statusData.storeDomain || null,
        });
      }
    } catch (err) {
      console.error("Error fetching YouCan status:", err);
    } finally {
      setLoadingYouCanStatus(false);
    }
  };

  const handleSyncYouCan = async () => {
    setIsSyncingYouCan(true);
    try {
      const res = await youcanApi.syncNow();
      toast.success(res.data?.message || (language === 'ar' ? 'تمت مزامنة الطلبيات من YouCan بنجاح !' : 'Mise à jour YouCan effectuée avec succès !'));
    } catch (err: any) {
      toast.error(err.response?.data?.message || (language === 'ar' ? 'فشلت المزامنة المباشرة مع YouCan' : 'Erreur lors de la synchronisation YouCan'));
    } finally {
      setIsSyncingYouCan(false);
    }
  };

  const handleToggleYouCanSync = async () => {
    setIsTogglingYouCanSync(true);
    try {
      const nextState = !youcanStatus.autoSyncActive;
      await youcanApi.toggleSync(nextState);
      setYoucanStatus(prev => ({ ...prev, autoSyncActive: nextState }));
      toast.success(nextState 
        ? (language === 'ar' ? 'تم تفعيل المزامنة التلقائية لـ YouCan' : 'Mise à jour automatique YouCan activée !')
        : (language === 'ar' ? 'تم إيقاف المزامنة التلقائية لـ YouCan' : 'Mise à jour automatique YouCan désactivée')
      );
    } catch (err) {
      toast.error(language === 'ar' ? 'تعذر تغيير حالة المزامنة' : 'Impossible de modifier le statut de synchronisation');
    } finally {
      setIsTogglingYouCanSync(false);
    }
  };

  const executeDisconnectYouCan = async () => {
    setIsDisconnecting(true);
    try {
      await youcanApi.disconnect();
      setYoucanStatus({ isConnected: false, autoSyncActive: false, storeDomain: null });
      setConfirmDisconnectModal(null);
      setActiveModal(null);
      toast.success(language === 'ar' ? 'تم إلغاء ربط متجر YouCan بنجاح' : 'Boutique YouCan déconnectée avec succès');
    } catch (err) {
      toast.error(language === 'ar' ? 'حدث خطأ أثناء إلغاء الربط' : 'Erreur lors de la déconnexion');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSaveWooCommerce = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wooDraft.storeUrl) return;

    if (!wooDraft.consumerKey || !wooDraft.consumerSecret) {
      try {
        const res = await wooCommerceApi.getAuthorizeUrl(wooDraft.storeUrl);
        const authUrl = res.data?.data?.authUrl || res.data?.authUrl;
        if (authUrl) {
          window.location.href = authUrl;
          return;
        }
      } catch (err: any) {
        toast.error(err.response?.data?.message || (language === 'ar' ? 'فشل إنشاء رابط ربط WooCommerce' : 'Échec de la génération du lien WooCommerce'));
        return;
      }
    }

    try {
      await wooCommerceApi.saveKeys({
        storeUrl: wooDraft.storeUrl,
        consumerKey: wooDraft.consumerKey,
        consumerSecret: wooDraft.consumerSecret,
      });
      setWooConfig(prev => ({
        ...prev,
        storeUrl: wooDraft.storeUrl,
        consumerKey: wooDraft.consumerKey,
        consumerSecret: wooDraft.consumerSecret,
        isConnected: true
      }));
      setActiveModal(null);
      toast.success(language === 'ar' ? 'تم حفظ ربط WooCommerce بنجاح !' : 'Intégration WooCommerce enregistrée avec succès !');
    } catch (err: any) {
      toast.error(err.response?.data?.message || (language === 'ar' ? 'فشل حفظ إعدادات WooCommerce' : 'Échec de l\'enregistrement WooCommerce'));
    }
  };

  const handleToggleWooCommerceSync = async () => {
    setIsTogglingWooSync(true);
    try {
      const nextState = !wooConfig.autoSyncActive;
      await wooCommerceApi.toggleSync(nextState);
      setWooConfig(prev => ({ ...prev, autoSyncActive: nextState }));
      toast.success(nextState 
        ? (language === 'ar' ? 'تم تفعيل المزامنة التلقائية لـ WooCommerce' : 'Mise à jour automatique WooCommerce activée !')
        : (language === 'ar' ? 'تم إيقاف المزامنة التلقائية لـ WooCommerce' : 'Mise à jour automatique WooCommerce désactivée')
      );
    } catch (err) {
      toast.error(language === 'ar' ? 'تعذر تغيير حالة المزامنة' : 'Impossible de modifier le statut de synchronisation');
    } finally {
      setIsTogglingWooSync(false);
    }
  };

  const executeDisconnectWooCommerce = async () => {
    setIsDisconnecting(true);
    try {
      await wooCommerceApi.disconnect();
      localStorage.removeItem('silacod_woo_store_url');
      localStorage.removeItem('silacod_woo_consumer_key');
      localStorage.removeItem('silacod_woo_consumer_secret');
      setWooConfig({ storeUrl: '', consumerKey: '', consumerSecret: '', isConnected: false, autoSyncActive: false });
      setConfirmDisconnectModal(null);
      setActiveModal(null);
      toast.success(language === 'ar' ? 'تم إلغاء ربط متجر WooCommerce بنجاح' : 'Boutique WooCommerce déconnectée avec succès');
    } catch (err) {
      toast.error(language === 'ar' ? 'حدث خطأ أثناء إلغاء الربط' : 'Erreur lors de la déconnexion');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSyncShopify = async () => {
    setIsSyncingShopify(true);
    try {
      const res = await shopifyApi.getOrders();
      toast.success(res.data?.message || (language === 'ar' ? 'تمت مزامنة الطلبيات من Shopify بنجاح !' : 'Mise à jour Shopify effectuée avec succès !'));
    } catch (err: any) {
      toast.error(err.response?.data?.message || (language === 'ar' ? 'فشلت المزامنة المباشرة مع Shopify' : 'Erreur lors de la synchronisation Shopify'));
    } finally {
      setIsSyncingShopify(false);
    }
  };

  const handleToggleShopifySync = async () => {
    setIsTogglingShopifySync(true);
    try {
      const nextState = !shopifyStatus.autoSyncActive;
      await shopifyApi.toggleSync(nextState);
      setShopifyStatus(prev => ({ ...prev, autoSyncActive: nextState }));
      toast.success(nextState 
        ? (language === 'ar' ? 'تم تفعيل المزامنة التلقائية لـ Shopify' : 'Mise à jour automatique Shopify activée !')
        : (language === 'ar' ? 'تم إيقاف المزامنة التلقائية لـ Shopify' : 'Mise à jour automatique Shopify désactivée')
      );
    } catch (err) {
      toast.error(language === 'ar' ? 'تعذر تغيير حالة المزامنة' : 'Impossible de modifier le statut de synchronisation');
    } finally {
      setIsTogglingShopifySync(false);
    }
  };

  const executeDisconnectShopify = async () => {
    setIsDisconnecting(true);
    try {
      await shopifyApi.disconnect();
      localStorage.removeItem('silacod_shopify_store_domain');
      setShopifyStatus({ isConnected: false, autoSyncActive: false, storeDomain: null });
      setConfirmDisconnectModal(null);
      setActiveModal(null);
      toast.success(language === 'ar' ? 'تم إلغاء ربط متجر Shopify بنجاح' : 'Boutique Shopify déconnectée avec succès');
    } catch (err) {
      toast.error(language === 'ar' ? 'حدث خطأ أثناء إلغاء الربط' : 'Erreur lors de la déconnexion');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSaveShopify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopifyDraft.storeDomain) return;
    
    let cleanDomain = shopifyDraft.storeDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!cleanDomain.includes('.')) {
      cleanDomain += '.myshopify.com';
    }
    const shopifyClientId = import.meta.env.VITE_SHOPIFY_CLIENT_ID || import.meta.env.VITE_SHOPIFY_API_KEY || '18e0087f1fa3f03cdcbd5744f556443a';

    if (shopifyClientId && !shopifyDraft.accessToken) {
      const redirectUri = encodeURIComponent(`${window.location.origin}/dashboard/shopify-callback`);
      const scopes = 'read_customers,read_orders,write_orders,read_products';
      window.location.href = `https://${cleanDomain}/admin/oauth/authorize?client_id=${shopifyClientId}&scope=${scopes}&redirect_uri=${redirectUri}`;
      return;
    }

    try {
      await shopifyApi.saveToken({ storeDomain: cleanDomain, accessToken: shopifyDraft.accessToken });
      localStorage.setItem('silacod_shopify_store_domain', cleanDomain);
      setShopifyStatus({
        isConnected: true,
        autoSyncActive: true,
        storeDomain: cleanDomain,
      });
      setActiveModal(null);
      toast.success(language === 'ar' ? 'تم حفظ ربط Shopify بنجاح !' : 'Boutique Shopify connectée avec succès !');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la connexion Shopify');
    }
  };

  const handleConnectGoogleSheets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleSheetsDraftUrl.trim()) return;

    setIsConnectingGoogleSheets(true);
    try {
      const res = await googleSheetsApi.connect(googleSheetsDraftUrl.trim());
      const data = res.data?.data || res.data;
      setGoogleSheetsStatus(prev => ({
        ...prev,
        isConnected: true,
        autoSyncActive: true,
        sheetUrl: data?.sheetUrl || googleSheetsDraftUrl,
        sheetId: data?.sheetId || null,
        webhookToken: data?.webhookToken || prev.webhookToken,
      }));
      setActiveModal(null);
      toast.success(language === 'ar' ? 'تم ربط Google Sheets بنجاح !' : 'Google Sheets connecté avec succès !');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la connexion Google Sheets');
    } finally {
      setIsConnectingGoogleSheets(false);
    }
  };

  const handleSyncGoogleSheets = async () => {
    setIsSyncingGoogleSheets(true);
    try {
      const res = await googleSheetsApi.syncNow();
      toast.success(res.data?.message || 'Mise à jour Google Sheets effectuée !');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur de synchronisation Google Sheets');
    } finally {
      setIsSyncingGoogleSheets(false);
    }
  };

  const handleToggleGoogleSheetsSync = async () => {
    setIsTogglingGoogleSheetsSync(true);
    try {
      const nextState = !googleSheetsStatus.autoSyncActive;
      await googleSheetsApi.toggleSync(nextState);
      setGoogleSheetsStatus(prev => ({ ...prev, autoSyncActive: nextState }));
      toast.success(nextState ? 'Mise à jour auto activée' : 'Mise à jour auto désactivée');
    } catch (err) {
      toast.error('Erreur lors de la modification de la synchronisation');
    } finally {
      setIsTogglingGoogleSheetsSync(false);
    }
  };

  const handleDisconnectGoogleSheets = async () => {
    setIsDisconnecting(true);
    try {
      await googleSheetsApi.disconnect();
      setGoogleSheetsStatus({
        isConnected: false,
        autoSyncActive: false,
        sheetUrl: null,
        sheetId: null,
        webhookToken: '',
      });
      setConfirmDisconnectModal(null);
      toast.success(language === 'ar' ? 'تم إلغاء ربط Google Sheets' : 'Google Sheets déconnecté');
    } catch (err) {
      toast.error('Erreur lors de la déconnexion');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} ${language === 'ar' ? 'تم النسخ بنجاح !' : 'copié dans le presse-papiers !'}`);
  };

  const isRtl = language === 'ar';
  const connectedCount = (youcanStatus.isConnected ? 1 : 0) + (wooConfig.isConnected ? 1 : 0) + (shopifyStatus.isConnected ? 1 : 0) + (googleSheetsStatus.isConnected ? 1 : 0);

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="max-w-7xl mx-auto space-y-8 pb-16 animate-in fade-in duration-500 font-sans">
      
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-[#131738] to-slate-950 rounded-[2.5rem] p-8 sm:p-12 text-white shadow-2xl border border-slate-800">
        {/* Ambient Glow Spheres */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#FF6B4A]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-black uppercase tracking-widest text-[#FF8E6E]">
              <Sparkles size={14} className="animate-pulse" />
              {isRtl ? 'ربط وإدارة المتاجر الإلكترونية' : 'E-Commerce Platform Integrations'}
            </div>
            
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
              {isRtl ? 'ربط المتاجر والمنصات' : 'Intégrations E-commerce'}
            </h1>
            
            <p className="text-slate-300 text-sm sm:text-base font-medium leading-relaxed">
              {isRtl 
                ? 'ربط متجرك المباشر على YouCan و WooCommerce و Shopify واستقبال الطلبيات تلقائيًا في الوقت الفعلي مع تحديث حالة التوصيل والمخزون.'
                : 'Connectez vos boutiques e-commerce sur YouCan, WooCommerce et Shopify pour importer et synchroniser vos commandes et leads en temps réel.'
              }
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex flex-wrap sm:flex-nowrap gap-4 bg-white/5 backdrop-blur-xl p-4 sm:p-6 rounded-3xl border border-white/10 shrink-0 shadow-inner">
            <div className="px-4 py-2 border-r border-white/10 rtl:border-r-0 rtl:border-l">
              <p className="text-2xl font-black text-[#FF8E6E]">3</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{isRtl ? 'منصات تدعم الربط' : 'Plateformes'}</p>
            </div>
            <div className="px-4 py-2 border-r border-white/10 rtl:border-r-0 rtl:border-l">
              <p className="text-2xl font-black text-emerald-400">{connectedCount} / 3</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{isRtl ? 'متاجر متصلة حالياً' : 'Actifs'}</p>
            </div>
            <div className="px-4 py-2">
              <p className="text-2xl font-black text-indigo-400">100%</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{isRtl ? 'مزامنة آمنة' : 'Sécurisé'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main 3-Column Integration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* ========================================================================= */}
        {/* CARD 1: YOUCAN.SHOP */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 to-rose-500" />
          
          <div className="space-y-6">
            {/* Logo & Status Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-lg shadow-rose-500/20 border border-rose-100/30 flex items-center justify-center bg-[#e6005c] shrink-0">
                  <img 
                    src="https://avatars.githubusercontent.com/u/118484439?s=200&v=4" 
                    alt="YouCan" 
                    className="w-full h-full object-cover" 
                  />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">YouCan.shop</h3>
                  <p className="text-xs font-bold text-slate-400">youcan.shop</p>
                </div>
              </div>

              {loadingYouCanStatus ? (
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              ) : youcanStatus.isConnected ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {isRtl ? 'متصل' : 'Connecté'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
                  {isRtl ? 'غير متصل' : 'Non connecté'}
                </span>
              )}
            </div>

            <p className="text-slate-600 text-xs sm:text-sm font-medium leading-relaxed">
              {isRtl 
                ? 'ربط مباشر وآمن مع متجر YouCan الخاص بك لاستيراد الطلبيات والعملاء المحتملين وتحديث حالة الشحن تلقائيًا.'
                : 'Intégration directe et sécurisée avec votre boutique YouCan.shop pour importer automatiquement vos leads et commandes.'
              }
            </p>

            {/* Feature Checklist */}
            <div className="space-y-2.5 pt-2 border-t border-slate-50">
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>{isRtl ? 'مزامنة فورية عبر Webhooks' : 'Webhooks en temps réel'}</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>{isRtl ? 'استيراد طلبات المتجر تلقائيًا' : 'Importation automatique des commandes'}</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>{isRtl ? 'تحديث حالة الشحن ورقم التتبع' : 'Mise à jour des statuts & suivis'}</span>
              </div>
            </div>

            {/* Store Domain info if connected */}
            {youcanStatus.isConnected && youcanStatus.storeDomain && (
              <div className="p-3 bg-amber-50/50 rounded-2xl border border-amber-100 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500">{isRtl ? 'المتجر المرتبط:' : 'Boutique liée:'}</span>
                <span className="font-black text-amber-700 font-mono">{youcanStatus.storeDomain}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-6 space-y-2.5">
            {youcanStatus.isConnected ? (
              <div className="flex gap-2">
                <button
                  onClick={handleSyncYouCan}
                  disabled={isSyncingYouCan}
                  className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isSyncingYouCan ? 'animate-spin' : ''} />
                  {isRtl ? 'مزامنة الآن' : 'Sync Maintenant'}
                </button>
                <button
                  onClick={() => setActiveModal('YOUCAN')}
                  className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-all"
                  title={isRtl ? 'إعدادات YouCan' : 'Réglages YouCan'}
                >
                  <Sliders size={16} />
                </button>
                <button
                  onClick={() => setConfirmDisconnectModal('YOUCAN')}
                  className="p-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl transition-all border border-rose-100"
                  title={isRtl ? 'إلغاء الربط' : 'Déconnecter'}
                >
                  <Unlink size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setActiveModal('YOUCAN')}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2"
              >
                <Link2 size={16} />
                {isRtl ? 'ربط متجر YouCan' : 'Connecter Boutique YouCan'}
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CARD 2: WOOCOMMERCE */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-purple-600 to-indigo-600" />

          <div className="space-y-6">
            {/* Logo & Status Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-lg shadow-purple-500/20 border border-purple-300/30 flex items-center justify-center bg-[#873eff] p-2.5 shrink-0">
                  <img 
                    src={wooCommerceLogo} 
                    alt="WooCommerce" 
                    className="w-full h-full object-contain" 
                  />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">WooCommerce</h3>
                  <p className="text-xs font-bold text-slate-400">woocommerce.com</p>
                </div>
              </div>

              {wooConfig.isConnected ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {isRtl ? 'مُفعل' : 'Actif'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-600 border border-purple-100">
                  {isRtl ? 'جاهز للربط' : 'Prêt'}
                </span>
              )}
            </div>

            <p className="text-slate-600 text-xs sm:text-sm font-medium leading-relaxed">
              {isRtl 
                ? 'ربط متجر وردبريس WooCommerce عبر مفاتيح REST API و Webhook لتمرير الطلبيات ومتابعتها تلقائيًا.'
                : 'Connectez votre site WordPress WooCommerce via REST API & Webhooks pour synchroniser automatiquement vos commandes.'
              }
            </p>

            {/* Feature Checklist */}
            <div className="space-y-2.5 pt-2 border-t border-slate-50">
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                <CheckCircle2 size={14} className="text-purple-500 shrink-0" />
                <span>{isRtl ? 'مفاتيح Consumer Key & Secret' : 'Clés REST API Consumer Key'}</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                <CheckCircle2 size={14} className="text-purple-500 shrink-0" />
                <span>{isRtl ? 'مزامنة طلبات الشراء تلقائيًا' : 'Importation automatique des paniers'}</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                <CheckCircle2 size={14} className="text-purple-500 shrink-0" />
                <span>{isRtl ? 'عنوان Webhook مخصص للمتجر' : 'Endpoint Webhook dédié WooCommerce'}</span>
              </div>
            </div>

            {wooConfig.isConnected && wooConfig.storeUrl && (
              <div className="p-3 bg-purple-50/50 rounded-2xl border border-purple-100 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500">{isRtl ? 'الموقع المرتبط:' : 'Site WooCommerce:'}</span>
                <span className="font-black text-purple-700 font-mono truncate max-w-[150px]">{wooConfig.storeUrl}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-6 space-y-2.5">
            {wooConfig.isConnected ? (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setWooDraft({
                      storeUrl: wooConfig.storeUrl,
                      consumerKey: wooConfig.consumerKey,
                      consumerSecret: wooConfig.consumerSecret
                    });
                    setActiveModal('WOOCOMMERCE');
                  }}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <Sliders size={16} />
                  {isRtl ? 'إعدادات WooCommerce' : 'Gérer WooCommerce'}
                </button>
                <button
                  onClick={() => setConfirmDisconnectModal('WOOCOMMERCE')}
                  className="p-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl transition-all border border-rose-100"
                  title={isRtl ? 'إلغاء الربط' : 'Déconnecter'}
                >
                  <Unlink size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setWooDraft({
                    storeUrl: wooConfig.storeUrl,
                    consumerKey: wooConfig.consumerKey,
                    consumerSecret: wooConfig.consumerSecret
                  });
                  setActiveModal('WOOCOMMERCE');
                }}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2"
              >
                <Link2 size={16} />
                {isRtl ? 'تهيئة ربط WooCommerce' : 'Configurer WooCommerce'}
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CARD 3: SHOPIFY */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-600" />

          <div className="space-y-6">
            {/* Logo & Status Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl p-2.5 bg-[#95BF47]/15 flex items-center justify-center shadow-lg shadow-emerald-500/20 border border-[#95BF47]/30 shrink-0">
                  <img 
                    src={shopifyLogo} 
                    alt="Shopify" 
                    className="w-full h-full object-contain" 
                  />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Shopify</h3>
                  <p className="text-xs font-bold text-slate-400">myshopify.com</p>
                </div>
              </div>

              {loadingShopifyStatus ? (
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              ) : shopifyStatus.isConnected ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {isRtl ? 'متصل' : 'Connecté'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
                  {isRtl ? 'غير متصل' : 'Non connecté'}
                </span>
              )}
            </div>

            <p className="text-slate-600 text-xs sm:text-sm font-medium leading-relaxed">
              {isRtl 
                ? 'ربط بنقرة واحدة مع متجر Shopify لاستيراد طلبات العملاء وتحديث التوصيل والمخزون تلقائيًا.'
                : 'Connexion en un clic avec votre boutique Shopify pour importer automatiquement vos commandes et gérer vos livraisons.'
              }
            </p>

            {/* Feature Checklist */}
            <div className="space-y-2.5 pt-2 border-t border-slate-50">
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>{isRtl ? 'ربط بنقرة واحدة OAuth 2.0' : 'Connexion OAuth 2.0 en 1 clic'}</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>{isRtl ? 'استيراد طلبات Shopify تلقائيًا' : 'Importation automatique des commandes'}</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>{isRtl ? 'تحديث حالة الشحن والطلبات' : 'Mise à jour en temps réel'}</span>
              </div>
            </div>

            {shopifyStatus.isConnected && shopifyStatus.storeDomain && (
              <div className="p-3 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500">{isRtl ? 'المتجر المرتبط:' : 'Boutique Shopify:'}</span>
                <span className="font-black text-emerald-700 font-mono truncate max-w-[170px]">{shopifyStatus.storeDomain}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-6 space-y-2.5">
            {shopifyStatus.isConnected ? (
              <div className="flex gap-2">
                <button
                  onClick={handleSyncShopify}
                  disabled={isSyncingShopify}
                  className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isSyncingShopify ? 'animate-spin' : ''} />
                  {isRtl ? 'مزامنة الآن' : 'Sync Maintenant'}
                </button>
                <button
                  onClick={() => {
                    setShopifyDraft({
                      storeDomain: shopifyStatus.storeDomain || '',
                      accessToken: ''
                    });
                    setActiveModal('SHOPIFY');
                  }}
                  className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-all"
                  title={isRtl ? 'إعدادات Shopify' : 'Réglages Shopify'}
                >
                  <Sliders size={16} />
                </button>
                <button
                  onClick={() => setConfirmDisconnectModal('SHOPIFY')}
                  className="p-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl transition-all border border-rose-100"
                  title={isRtl ? 'إلغاء الربط' : 'Déconnecter'}
                >
                  <Unlink size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setShopifyDraft({
                    storeDomain: shopifyStatus.storeDomain || '',
                    accessToken: ''
                  });
                  setActiveModal('SHOPIFY');
                }}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
              >
                <Link2 size={16} />
                {isRtl ? 'ربط متجر Shopify' : 'Connecter Boutique Shopify'}
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CARD 4: GOOGLE SHEETS */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 to-green-600" />

          <div className="space-y-6">
            {/* Logo & Status Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl p-2.5 bg-emerald-500/10 flex items-center justify-center shadow-lg shadow-emerald-500/10 border border-emerald-500/20 shrink-0">
                  <img 
                    src={googleSheetsLogo} 
                    alt="Google Sheets" 
                    className="w-full h-full object-contain" 
                  />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Google Sheets</h3>
                  <p className="text-xs font-bold text-slate-400">docs.google.com</p>
                </div>
              </div>

              {loadingGoogleSheetsStatus ? (
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              ) : googleSheetsStatus.isConnected ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {isRtl ? 'متصل' : 'Connecté'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
                  {isRtl ? 'غير متصل' : 'Non connecté'}
                </span>
              )}
            </div>

            <p className="text-slate-600 text-xs sm:text-sm font-medium leading-relaxed">
              {isRtl 
                ? 'ربط مباشر لجداول Google Sheets لاستيراد الرواد والطلبيات تلقائيًا عبر Apps Script أو رابط المستند.'
                : 'Intégration avec Google Sheets pour synchroniser vos prospects et commandes via Webhook Apps Script ou CSV.'
              }
            </p>

            {/* Feature Checklist */}
            <div className="space-y-2.5 pt-2 border-t border-slate-50">
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>{isRtl ? 'مزامنة فورية عبر Apps Script Webhook' : 'Webhook Apps Script en temps réel'}</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>{isRtl ? 'تحويل الطلبات مباشرة لمراكز الاتصال' : 'Transfert direct des leads au Call Center'}</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>{isRtl ? 'استيراد CSV وتحديث مجدول' : 'Importation CSV & mises à jour'}</span>
              </div>
            </div>

            {googleSheetsStatus.isConnected && googleSheetsStatus.sheetUrl && (
              <div className="p-3 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500">{isRtl ? 'المستند المرتبط:' : 'Document Sheet:'}</span>
                <a
                  href={googleSheetsStatus.sheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-black text-emerald-700 font-mono truncate max-w-[170px] hover:underline flex items-center gap-1"
                >
                  <span>{googleSheetsStatus.sheetId || 'Google Sheet'}</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-6 space-y-2.5">
            {googleSheetsStatus.isConnected ? (
              <div className="flex gap-2">
                <button
                  onClick={handleSyncGoogleSheets}
                  disabled={isSyncingGoogleSheets}
                  className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isSyncingGoogleSheets ? 'animate-spin' : ''} />
                  {isRtl ? 'مزامنة الآن' : 'Sync Maintenant'}
                </button>
                <button
                  onClick={() => {
                    setGoogleSheetsDraftUrl(googleSheetsStatus.sheetUrl || '');
                    setActiveModal('GOOGLESHEETS');
                  }}
                  className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-all"
                  title={isRtl ? 'إعدادات Google Sheets' : 'Réglages Google Sheets'}
                >
                  <Sliders size={16} />
                </button>
                <button
                  onClick={() => setConfirmDisconnectModal('GOOGLESHEETS')}
                  className="p-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl transition-all border border-rose-100"
                  title={isRtl ? 'إلغاء الربط' : 'Déconnecter'}
                >
                  <Unlink size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setGoogleSheetsDraftUrl(googleSheetsStatus.sheetUrl || '');
                  setActiveModal('GOOGLESHEETS');
                }}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
              >
                <Link2 size={16} />
                {isRtl ? 'ربط Google Sheets' : 'Connecter Google Sheets'}
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Pro Security & Automation Features Banner */}
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">
              {isRtl ? 'مميزات الأمان والمزامنة التلقائية' : 'Fonctionnalités de Sécurité & Automatisation'}
            </h3>
            <p className="text-xs font-semibold text-slate-400">
              {isRtl ? 'كل ما تحتاج لمعرفته حول المزامنة والتشفير المباشر' : 'Tout ce que vous devez savoir sur la synchronisation'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
            <div className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-wider">
              <Zap size={16} />
              <span>{isRtl ? 'مزامنة الطلبيات 24/7' : 'Sync 24/7'}</span>
            </div>
            <p className="text-xs font-medium text-slate-600 leading-relaxed">
              {isRtl 
                ? 'يتم جلب طلبات العملاء من متجرك مباشرة وتوجيهها إلى لوحة التحكم فور تأكيدها من قبل العميل.'
                : 'Les commandes de vos clients sont importées instantanément dans votre tableau de bord dès leur validation.'}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
            <div className="flex items-center gap-2 text-emerald-600 font-black text-xs uppercase tracking-wider">
              <Lock size={16} />
              <span>{isRtl ? 'تشفير وحماية البيانات' : 'Sécurité & Chiffrement'}</span>
            </div>
            <p className="text-xs font-medium text-slate-600 leading-relaxed">
              {isRtl 
                ? 'يتم تخزين مفاتيح الربط وتصاريح OAuth باستخدام أعلى معايير التشفير الآمن لحماية حساباتكم.'
                : 'Vos clés et accès OAuth sont chiffrés selon les normes de sécurité les plus élevées.'}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
            <div className="flex items-center gap-2 text-[#FF6B4A] font-black text-xs uppercase tracking-wider">
              <Activity size={16} />
              <span>{isRtl ? 'تحديث تلقائي لحالة التوصيل' : 'Mises à jour des statuts'}</span>
            </div>
            <p className="text-xs font-medium text-slate-600 leading-relaxed">
              {isRtl 
                ? 'يتم تحديث حالات الشحن والتأكيد تلقائيًا بين منصتنا ومتجرك الإلكتروني بدون أي تدخل يدوي.'
                : 'Les statuts de livraison sont mis à jour automatiquement entre la plateforme et votre boutique.'}
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: YOUCAN CONNECT MODAL */}
      {/* ========================================================================= */}
      {activeModal === 'YOUCAN' && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/65 backdrop-blur-md flex items-center justify-center z-[999999] p-4 animate-in fade-in duration-300 cursor-pointer"
          onClick={() => setActiveModal(null)}
        >
          <div 
            className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-amber-500 to-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center bg-white/20 shrink-0">
                  <img 
                    src="https://avatars.githubusercontent.com/u/118484439?s=200&v=4" 
                    alt="YouCan" 
                    className="w-full h-full object-cover" 
                  />
                </div>
                <div>
                  <h3 className="text-xl font-black">{isRtl ? 'إعدادات ربط YouCan.shop' : 'Connexion YouCan.shop'}</h3>
                  <p className="text-xs text-white/80 font-medium">OAuth 2.0 & Webhooks</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/20 rounded-xl text-white">✕</button>
            </div>

            <div className="p-6 space-y-6 text-slate-700">
              {/* Status and Auto Sync */}
              <div className="p-4 bg-slate-50 rounded-2xl space-y-3 border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">{isRtl ? 'حالة الربط المباشر:' : 'Statut de connexion:'}</span>
                  <span className={`text-xs font-black ${youcanStatus.isConnected ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {youcanStatus.isConnected ? (isRtl ? 'متصل بنجاح' : 'Connecté') : (isRtl ? 'غير متصل' : 'Non connecté')}
                  </span>
                </div>

                {youcanStatus.isConnected && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="text-xs font-bold text-slate-700">{isRtl ? 'المزامنة التلقائية:' : 'Maintien Auto-Sync:'}</span>
                    <button
                      type="button"
                      onClick={handleToggleYouCanSync}
                      disabled={isTogglingYouCanSync}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
                        youcanStatus.autoSyncActive 
                          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-600' 
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      {isTogglingYouCanSync ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : youcanStatus.autoSyncActive ? (
                        <>
                          <Check size={14} />
                          <span>{isRtl ? 'مُفعلة' : 'Activé'}</span>
                        </>
                      ) : (
                        <>
                          <X size={14} />
                          <span>{isRtl ? 'معطلة' : 'Désactivé'}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Connect & Disconnect Buttons */}
              <div className="pt-2 space-y-3">
                <a
                  href={`https://seller-area.youcan.shop/admin/oauth/authorize?client_id=${import.meta.env.VITE_YOUCAN_CLIENT_ID || 'silacod'}&response_type=code&scope=store_read+orders_read&redirect_uri=${encodeURIComponent(`${window.location.origin}/dashboard/youcan-callback`)}`}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <ExternalLink size={16} />
                  {youcanStatus.isConnected 
                    ? (isRtl ? 'إعادة تسجيل الدخول إلى YouCan' : 'Reconnecter mon compte YouCan')
                    : (isRtl ? 'تسجيل الدخول وربط متجر YouCan' : 'Se connecter avec YouCan.shop')
                  }
                </a>

                {youcanStatus.isConnected && (
                  <button
                    type="button"
                    onClick={() => setConfirmDisconnectModal('YOUCAN')}
                    className="w-full py-3.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} />
                    {isRtl ? 'إلغاء ربط المتجر (حذف الربط)' : 'Déconnecter et Supprimer l\'intégration'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest"
                >
                  {isRtl ? 'إغلاق' : 'Fermer'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: WOOCOMMERCE SETUP MODAL */}
      {/* ========================================================================= */}
      {activeModal === 'WOOCOMMERCE' && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/65 backdrop-blur-md flex items-center justify-center z-[999999] p-4 animate-in fade-in duration-300 cursor-pointer"
          onClick={() => setActiveModal(null)}
        >
          <div 
            className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center bg-[#873eff] p-1.5 shrink-0 shadow-sm border border-white/20">
                  <img 
                    src={wooCommerceLogo} 
                    alt="WooCommerce" 
                    className="w-full h-full object-contain" 
                  />
                </div>
                <div>
                  <h3 className="text-xl font-black">{isRtl ? 'إعدادات ربط WooCommerce' : 'Configuration WooCommerce'}</h3>
                  <p className="text-xs text-white/80 font-medium">REST API Keys & Webhooks</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/20 rounded-xl text-white">✕</button>
            </div>

            <form onSubmit={handleSaveWooCommerce} className="p-6 space-y-4 text-slate-700">
              {/* Status and Auto Sync */}
              {wooConfig.isConnected && (
                <div className="p-4 bg-purple-50/50 rounded-2xl space-y-3 border border-purple-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">{isRtl ? 'حالة الربط المباشر:' : 'Statut de connexion:'}</span>
                    <span className="text-xs font-black text-emerald-600">
                      {isRtl ? 'متصل بنجاح' : 'Connecté'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-purple-100">
                    <span className="text-xs font-bold text-slate-700">{isRtl ? 'المزامنة التلقائية:' : 'Maintien Auto-Sync:'}</span>
                    <button
                      type="button"
                      onClick={handleToggleWooCommerceSync}
                      disabled={isTogglingWooSync}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
                        wooConfig.autoSyncActive 
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20 hover:bg-purple-700' 
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      {isTogglingWooSync ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : wooConfig.autoSyncActive ? (
                        <>
                          <Check size={14} />
                          <span>{isRtl ? 'مُفعلة' : 'Activé'}</span>
                        </>
                      ) : (
                        <>
                          <X size={14} />
                          <span>{isRtl ? 'معطلة' : 'Désactivé'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">{isRtl ? 'رابط الموقع (Store URL)' : 'URL de la boutique WooCommerce'}</label>
                <input
                  type="url"
                  placeholder="https://mon-site-woocommerce.com"
                  value={wooDraft.storeUrl}
                  onChange={(e) => setWooDraft(prev => ({ ...prev, storeUrl: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-600"
                  required
                />
              </div>

              <div className="p-3 bg-purple-50 rounded-2xl border border-purple-100 text-xs text-purple-900 font-medium space-y-1">
                <p>
                  {isRtl 
                    ? '💡 يمكنك الربط بنقرة واحدة بمجرد إدخال رابط متجرك والضغط على زر "الربط بنقرة واحدة"، أو إدخال المفاتيح يدوياً.'
                    : '💡 Entrez simplement l\'URL de votre boutique puis cliquez sur le bouton pour vous connecter en 1 Clic via WooCommerce !'}
                </p>
                <p className="text-[11px] text-purple-700 font-semibold pt-1 border-t border-purple-100/60">
                  {isRtl 
                    ? '🔑 للحصول على المفاتيح: WooCommerce 👈 إعدادات (Settings) 👈 إعدادات متقدمة (Advanced) 👈 REST API 👈 إضافة مفتاح بصلاحية (قراءة/كتابة Read/Write).'
                    : '🔑 Pour générer les clés : WooCommerce 👈 Réglages 👈 Avancé 👈 API REST 👈 Ajouter une clé (Droits: Lecture/Écriture).'}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Consumer Key (ck_...) <span className="text-slate-400 font-normal">({isRtl ? 'اختياري' : 'Optionnel'})</span></label>
                <div className="relative">
                  <input
                    type={showWooConsumerKey ? "text" : "password"}
                    placeholder="ck_1234567890abcdef..."
                    value={wooDraft.consumerKey}
                    onChange={(e) => setWooDraft(prev => ({ ...prev, consumerKey: e.target.value }))}
                    className="w-full pl-4 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-purple-600 rtl:pr-4 rtl:pl-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWooConsumerKey(!showWooConsumerKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 transition-colors rtl:left-3 rtl:right-auto"
                    title={showWooConsumerKey ? "Masquer" : "Afficher"}
                  >
                    {showWooConsumerKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Consumer Secret (cs_...) <span className="text-slate-400 font-normal">({isRtl ? 'اختياري' : 'Optionnel'})</span></label>
                <div className="relative">
                  <input
                    type={showWooConsumerSecret ? "text" : "password"}
                    placeholder="cs_1234567890abcdef..."
                    value={wooDraft.consumerSecret}
                    onChange={(e) => setWooDraft(prev => ({ ...prev, consumerSecret: e.target.value }))}
                    className="w-full pl-4 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-purple-600 rtl:pr-4 rtl:pl-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWooConsumerSecret(!showWooConsumerSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 transition-colors rtl:left-3 rtl:right-auto"
                    title={showWooConsumerSecret ? "Masquer" : "Afficher"}
                  >
                    {showWooConsumerSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Webhook Endpoint Display */}
              <div className="space-y-1.5 pt-2">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">
                  {isRtl ? 'رابط Webhook المخصص لموقعك:' : 'URL Webhook WooCommerce Delivery:'}
                </label>
                <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-2xl flex items-center justify-between font-mono text-xs">
                  <span className="truncate pr-2 font-bold text-purple-900">{wooWebhookUrl}</span>
                  <button 
                    type="button"
                    onClick={() => copyToClipboard(wooWebhookUrl, 'WooCommerce Webhook')}
                    className="p-2 bg-white hover:bg-purple-50 border border-purple-200 rounded-xl text-purple-700 shrink-0"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>

              {wooConfig.isConnected && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDisconnectModal('WOOCOMMERCE')}
                    className="w-full py-3.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} />
                    {isRtl ? 'إلغاء ربط المتجر (حذف الربط)' : 'Déconnecter et Supprimer l\'intégration'}
                  </button>
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest"
                >
                  {isRtl ? 'إلغاء' : 'Annuler'}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg hover:from-purple-700 hover:to-indigo-700"
                >
                  {isRtl ? '⚡ الربط بنقرة واحدة (WooCommerce)' : '⚡ Se connecter avec WooCommerce'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: SHOPIFY SETUP MODAL */}
      {/* ========================================================================= */}
      {activeModal === 'SHOPIFY' && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/65 backdrop-blur-md flex items-center justify-center z-[999999] p-4 animate-in fade-in duration-300 cursor-pointer"
          onClick={() => setActiveModal(null)}
        >
          <div 
            className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl p-1.5 bg-white/20 flex items-center justify-center shrink-0">
                  <img 
                    src={shopifyLogo} 
                    alt="Shopify" 
                    className="w-full h-full object-contain" 
                  />
                </div>
                <div>
                  <h3 className="text-xl font-black">{isRtl ? 'ربط متجر Shopify' : 'Connexion Shopify.com'}</h3>
                  <p className="text-xs text-white/80 font-medium">OAuth 2.0 App Connection</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/20 rounded-xl text-white">✕</button>
            </div>

            <form onSubmit={handleSaveShopify} className="p-6 space-y-5 text-slate-700">
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
                  {isRtl ? 'نطاق المتجر (Store Domain)' : 'Domaine de votre boutique Shopify'}
                </label>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus-within:border-emerald-600 transition-all">
                  <input
                    type="text"
                    placeholder="ma-boutique.myshopify.com"
                    value={shopifyDraft.storeDomain}
                    onChange={(e) => setShopifyDraft(prev => ({ ...prev, storeDomain: e.target.value }))}
                    className="w-full bg-transparent text-xs font-bold text-slate-800 outline-none"
                    required
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-medium px-1">
                  Ex: mon-magasin.myshopify.com
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
                  {isRtl ? 'رمز الوصول (Admin Access Token - اختياري)' : 'Admin API Access Token (shpat_...) (Optionnel)'}
                </label>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus-within:border-emerald-600 transition-all">
                  <input
                    type="password"
                    placeholder="shpat_1234567890abcdef..."
                    value={shopifyDraft.accessToken}
                    onChange={(e) => setShopifyDraft(prev => ({ ...prev, accessToken: e.target.value }))}
                    className="w-full bg-transparent text-xs font-mono font-bold text-slate-800 outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-medium px-1">
                  {isRtl ? 'أدخل Token الخاص بتطبيقك الخاص أو اتركه فارغاً للربط المباشر' : 'Entrez votre token si vous utilisez une App Privée, ou laissez vide pour la connexion OAuth.'}
                </p>
              </div>

              {/* Status and Auto Sync */}
              <div className="p-4 bg-slate-50 rounded-2xl space-y-3 border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">{isRtl ? 'حالة الربط المباشر:' : 'Statut de connexion:'}</span>
                  <span className={`text-xs font-black ${shopifyStatus.isConnected ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {shopifyStatus.isConnected ? (isRtl ? 'متصل بنجاح' : 'Connecté') : (isRtl ? 'غير متصل' : 'Non connecté')}
                  </span>
                </div>

                {shopifyStatus.isConnected && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="text-xs font-bold text-slate-700">{isRtl ? 'المزامنة التلقائية:' : 'Maintien Auto-Sync:'}</span>
                    <button
                      type="button"
                      onClick={handleToggleShopifySync}
                      disabled={isTogglingShopifySync}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
                        shopifyStatus.autoSyncActive 
                          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-600' 
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      {isTogglingShopifySync ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : shopifyStatus.autoSyncActive ? (
                        <>
                          <Check size={14} />
                          <span>{isRtl ? 'مُفعلة' : 'Activé'}</span>
                        </>
                      ) : (
                        <>
                          <X size={14} />
                          <span>{isRtl ? 'معطلة' : 'Désactivé'}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Single Button Connection & Disconnect */}
              <div className="pt-2 space-y-3">
                <button
                  type="submit"
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
                >
                  <ExternalLink size={16} />
                  {shopifyStatus.isConnected 
                    ? (isRtl ? 'إعادة تسجيل الدخول إلى Shopify' : 'Reconnecter mon compte Shopify')
                    : (isRtl ? 'تسجيل الدخول وربط متجر Shopify' : 'Se connecter avec Shopify.com')
                  }
                </button>

                {shopifyStatus.isConnected && (
                  <button
                    type="button"
                    onClick={() => setConfirmDisconnectModal('SHOPIFY')}
                    className="w-full py-3.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} />
                    {isRtl ? 'إلغاء ربط المتجر (حذف الربط)' : 'Déconnecter et Supprimer l\'intégration'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest"
                >
                  {isRtl ? 'إغلاق' : 'Fermer'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* GOOGLE SHEETS CONFIGURATION MODAL */}
      {/* ========================================================================= */}
      {activeModal === 'GOOGLESHEETS' && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[9999999] p-4 animate-in fade-in duration-200"
          onClick={() => setActiveModal(null)}
        >
          <div 
            className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl p-1.5 bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
                  <img src={googleSheetsLogo} alt="Google Sheets" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {isRtl ? 'إعدادات ربط Google Sheets' : 'Configuration Google Sheets'}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {isRtl ? 'ربط المستند ومزامنة الطلبيات تلقائيًا' : 'Connecter votre spreadsheet et synchroniser vos prospects'}
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleConnectGoogleSheets} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                    {isRtl ? 'رابط أو معرف Google Sheet' : 'URL ou ID de la feuille Google Sheet'} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                    value={googleSheetsDraftUrl}
                    onChange={(e) => setGoogleSheetsDraftUrl(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    {isRtl ? 'قم بلصق رابط المستند الكامل من متصفحك' : 'Collez le lien complet de votre Google Sheet depuis la barre d\'adresse'}
                  </p>
                </div>

                {/* Direct Connection Note */}
                <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl space-y-2 text-xs text-emerald-900 font-medium">
                  <div className="flex items-center gap-2 font-bold text-emerald-950">
                    <FileSpreadsheet size={16} className="text-emerald-600" />
                    <span>{isRtl ? 'ربط مباشر بدون تعقيدات' : 'Connexion Directe (Direct Sync sans Script)'}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    {isRtl 
                      ? 'أدخل رابط مستند Google Sheet الخاص بك وسيتم استيراد ومزامنة الطلبيات تلقائياً.' 
                      : 'Collez simplement l\'URL de votre Google Sheet ci-dessus pour connecter et synchroniser vos prospects en direct.'}
                  </p>
                </div>

                {/* Example Template Section */}
                <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl flex items-center justify-between gap-3 text-xs text-emerald-900 font-medium">
                  <div className="flex items-center gap-2.5">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-bold text-emerald-950">Exemple de modèle Google Sheet / Excel</div>
                      <div className="text-[11px] text-emerald-700 font-mono font-semibold">Exemple_Leads_Manager_SILACOD.xlsx</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadSampleExcel()}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold transition-all shadow-md shadow-emerald-600/20 shrink-0 flex items-center gap-1.5"
                  >
                    <Download size={14} />
                    <span>Télécharger l'exemple</span>
                  </button>
                </div>

                {/* Auto Sync Toggle */}
                {googleSheetsStatus.isConnected && (
                  <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-900">
                        {isRtl ? 'المزامنة التلقائية للطلبات' : 'Synchronisation automatique'}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {isRtl ? 'تفعيل أو تعطيل التحديث التلقائي للطلبات' : 'Activer ou désactiver l\'import automatique des prospects'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleToggleGoogleSheetsSync}
                      disabled={isTogglingGoogleSheetsSync}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        googleSheetsStatus.autoSyncActive ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        googleSheetsStatus.autoSyncActive ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                )}

                {/* Webhook Apps Script Integration Section */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Zap size={14} className="text-amber-500" />
                      {isRtl ? 'رابط Webhook الفوري (Apps Script)' : 'Endpoint Webhook Apps Script'}
                    </h4>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(`${apiBaseUrl}/google-sheets/webhook`, 'Webhook URL')}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1"
                    >
                      <Copy size={12} />
                      <span>{isRtl ? 'نسخ' : 'Copier'}</span>
                    </button>
                  </div>
                  <div className="p-2.5 bg-slate-900 text-emerald-400 font-mono text-[10px] rounded-xl overflow-x-auto select-all">
                    {apiBaseUrl}/google-sheets/webhook
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {isRtl
                      ? 'يمكنك إضافة كود Google Apps Script لتسليم كل طلب جديد فورًا عبر POST Webhook إلى منصتنا.'
                      : 'Utilisez cet URL dans Google Apps Script pour pousser instantanément chaque nouveau prospect soumis dans votre feuille.'
                    }
                  </p>
                </div>

                {/* Google Apps Script Code Section */}
                <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <Code2 className="w-4 h-4 text-emerald-600" />
                        <span>Google Apps Script</span>
                      </h4>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Your token is already embedded below. Copy and paste this script directly into Apps Script.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(getAppsScriptCode(googleSheetsStatus.webhookToken), 'Google Apps Script')}
                      className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2 shrink-0 self-start sm:self-auto"
                    >
                      <Copy size={14} />
                      <span>Copy Script</span>
                    </button>
                  </div>

                  <div className="relative rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden">
                    <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
                      <span>Code.gs</span>
                      <span className="text-emerald-400 font-bold">SILACOD Apps Script v2.0</span>
                    </div>
                    <pre className="p-4 text-[11px] text-slate-300 font-mono leading-relaxed max-h-64 overflow-y-auto select-all">
                      {getAppsScriptCode(googleSheetsStatus.webhookToken)}
                    </pre>
                  </div>
                </div>

                {/* Column Mapping Table */}
                <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                  <div>
                    <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <TableIcon className="w-4 h-4 text-emerald-600" />
                      <span>Column Mapping</span>
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Row 1 must be headers. Data starts from row 2.</p>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-100">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
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
                          <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px]">Required</span></td>
                          <td className="p-3">Customer full name</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold text-emerald-700 font-mono">B</td>
                          <td className="p-3 font-bold">📞 Phone</td>
                          <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px]">Required</span></td>
                          <td className="p-3">Moroccan phone number (06/07XXXXXXXX)</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold text-emerald-700 font-mono">C</td>
                          <td className="p-3 font-bold">🏙️ City</td>
                          <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px]">Required</span></td>
                          <td className="p-3">Delivery city name</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold text-emerald-700 font-mono">D</td>
                          <td className="p-3 font-bold">📍 Address</td>
                          <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px]">Required</span></td>
                          <td className="p-3">Full street / neighborhood address</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold text-emerald-700 font-mono">E</td>
                          <td className="p-3 font-bold">💰 Price</td>
                          <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px]">Required</span></td>
                          <td className="p-3">Selling price in DH (numerical)</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold text-emerald-700 font-mono">F</td>
                          <td className="p-3 font-bold">🔢 Qty</td>
                          <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px]">Optional</span></td>
                          <td className="p-3">Order quantity (defaults to 1)</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold text-emerald-700 font-mono">G</td>
                          <td className="p-3 font-bold">🏷️ SKU</td>
                          <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px]">Required</span></td>
                          <td className="p-3">Product SKU code or variant identifier</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold text-emerald-700 font-mono">H</td>
                          <td className="p-3 font-bold">📝 Note</td>
                          <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px]">Optional</span></td>
                          <td className="p-3">Delivery instructions or internal notes</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold text-emerald-700 font-mono">I</td>
                          <td className="p-3 font-bold">📊 Status</td>
                          <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">System</span></td>
                          <td className="p-3">Written back by script (✅ Imported • SIL-xxxx or ❌ Error)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 space-y-3">
                <button
                  type="submit"
                  disabled={isConnectingGoogleSheets || !googleSheetsDraftUrl}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isConnectingGoogleSheets ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check size={16} />
                      <span>{isRtl ? 'حفظ وتفعيل Google Sheets' : 'Enregistrer & Connecter'}</span>
                    </>
                  )}
                </button>

                {googleSheetsStatus.isConnected && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal(null);
                      setConfirmDisconnectModal('GOOGLESHEETS');
                    }}
                    className="w-full py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-rose-100"
                  >
                    <Trash2 size={16} />
                    {isRtl ? 'إلغاء ربط المستند' : 'Déconnecter Google Sheets'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest"
                >
                  {isRtl ? 'إغلاق' : 'Fermer'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* DISCONNECT CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {confirmDisconnectModal && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center z-[9999999] p-4 animate-in fade-in duration-200"
          onClick={() => setConfirmDisconnectModal(null)}
        >
          <div 
            className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 p-6 space-y-6 text-center animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-3xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle size={32} />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900">
                {confirmDisconnectModal === 'YOUCAN' && (isRtl ? 'إلغاء ربط متجر YouCan' : 'Déconnecter YouCan')}
                {confirmDisconnectModal === 'WOOCOMMERCE' && (isRtl ? 'إلغاء ربط متجر WooCommerce' : 'Déconnecter WooCommerce')}
                {confirmDisconnectModal === 'SHOPIFY' && (isRtl ? 'إلغاء ربط متجر Shopify' : 'Déconnecter Shopify')}
                {confirmDisconnectModal === 'GOOGLESHEETS' && (isRtl ? 'إلغاء ربط Google Sheets' : 'Déconnecter Google Sheets')}
              </h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed px-2">
                {isRtl 
                  ? 'هل أنت تأكد من رغبتك في إلغاء ربط هذا المتجر؟ لن يتم استيراد أو مزامنة أي طلبات جديدة تلقائيًا بعد إلغاء الربط.'
                  : 'Êtes-vous sûr de vouloir déconnecter cette intégration ? Les nouveaux prospects ne seront plus synchronisés automatiquement.'
                }
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDisconnectModal(null)}
                className="flex-1 py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-black uppercase tracking-wider transition-all"
              >
                {isRtl ? 'إلغاء' : 'Annuler'}
              </button>
              <button
                type="button"
                disabled={isDisconnecting}
                onClick={() => {
                  if (confirmDisconnectModal === 'YOUCAN') executeDisconnectYouCan();
                  else if (confirmDisconnectModal === 'WOOCOMMERCE') executeDisconnectWooCommerce();
                  else if (confirmDisconnectModal === 'SHOPIFY') executeDisconnectShopify();
                  else if (confirmDisconnectModal === 'GOOGLESHEETS') handleDisconnectGoogleSheets();
                }}
                className="flex-1 py-3.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-rose-500/25 transition-all flex items-center justify-center gap-2"
              >
                {isDisconnecting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>{isRtl ? 'تأكيد إلغاء الربط' : 'Confirmer la déconnexion'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
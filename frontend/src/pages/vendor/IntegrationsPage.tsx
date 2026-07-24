import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Link2, 
  Globe, 
  ShoppingBag, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  Copy, 
  ExternalLink, 
  ShieldCheck, 
  Zap, 
  Code, 
  Webhook, 
  Sparkles, 
  Sliders, 
  ChevronRight, 
  Check, 
  AlertCircle,
  Key,
  Server,
  FileText
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { youcanApi, shopifyApi, wooCommerceApi } from '../../lib/api';
import toast from 'react-hot-toast';

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
  const [isTogglingSync, setIsTogglingSync] = useState(false);

  // WooCommerce Configuration State
  const [wooConfig, setWooConfig] = useState({
    storeUrl: localStorage.getItem('silacod_woo_store_url') || '',
    consumerKey: localStorage.getItem('silacod_woo_consumer_key') || '',
    consumerSecret: localStorage.getItem('silacod_woo_consumer_secret') || '',
    isConnected: !!localStorage.getItem('silacod_woo_store_url'),
  });

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

  // API Key State
  const [apiKey, setApiKey] = useState(localStorage.getItem('silacod_api_key') || '');

  // Modal Open States
  const [activeModal, setActiveModal] = useState<'YOUCAN' | 'WOOCOMMERCE' | 'SHOPIFY' | 'API' | null>(null);

  // Form Draft States
  const [wooDraft, setWooDraft] = useState({ storeUrl: '', consumerKey: '', consumerSecret: '' });
  const [shopifyDraft, setShopifyDraft] = useState({ storeDomain: '', accessToken: '' });

  // Webhook URLs
  const apiBaseUrl = (import.meta.env as any).VITE_API_URL || 'https://api.silacod.com/api/v1';
  const youcanWebhookUrl = `${apiBaseUrl}/youcan/webhook`;
  const wooWebhookUrl = `${apiBaseUrl}/integrations/woocommerce/webhook`;
  const shopifyWebhookUrl = `${apiBaseUrl}/integrations/shopify/webhook`;

  // Fetch status on mount
  useEffect(() => {
    fetchYouCanStatus();
    fetchShopifyStatus();
    fetchWooCommerceStatus();
  }, []);

  const fetchWooCommerceStatus = async () => {
    try {
      const res = await wooCommerceApi.getStatus();
      const statusData = res.data?.data || res.data;
      if (statusData) {
        setWooConfig(prev => ({
          ...prev,
          isConnected: !!statusData.isConnected,
          storeUrl: statusData.storeUrl || prev.storeUrl,
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
    setIsTogglingSync(true);
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
      setIsTogglingSync(false);
    }
  };

  const handleSaveWooCommerce = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wooDraft.storeUrl) return;

    // 1-Click WooCommerce OAuth Approval flow if keys are not provided manually
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
      setWooConfig({
        storeUrl: wooDraft.storeUrl,
        consumerKey: wooDraft.consumerKey,
        consumerSecret: wooDraft.consumerSecret,
        isConnected: true
      });
      setActiveModal(null);
      toast.success(language === 'ar' ? 'تم حفظ ربط WooCommerce بنجاح !' : 'Intégration WooCommerce enregistrée avec succès !');
    } catch (err: any) {
      toast.error(err.response?.data?.message || (language === 'ar' ? 'فشل حفظ إعدادات WooCommerce' : 'Échec de l\'enregistrement WooCommerce'));
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

  const handleSaveShopify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopifyDraft.storeDomain) return;
    
    let cleanDomain = shopifyDraft.storeDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!cleanDomain.includes('.')) {
      cleanDomain += '.myshopify.com';
    }
    const shopifyClientId = import.meta.env.VITE_SHOPIFY_CLIENT_ID || import.meta.env.VITE_SHOPIFY_API_KEY || '18e0087f1fa3f03cdcbd5744f556443a';

    // Direct OAuth authorize URL redirect if Client ID is configured
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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} ${language === 'ar' ? 'تم النسخ بنجاح !' : 'copié dans le presse-papiers !'}`);
  };

  const generateNewApiKey = () => {
    const newKey = `sk_live_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('silacod_api_key', newKey);
    setApiKey(newKey);
    toast.success(language === 'ar' ? 'تم إنشاء مفتاح API جديد بنجاح !' : 'Nouvelle clé API générée avec succès !');
  };

  const isRtl = language === 'ar';

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="max-w-7xl mx-auto space-y-8 pb-16 animate-in fade-in duration-500">
      
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-[2.5rem] p-8 sm:p-12 text-white shadow-2xl border border-slate-800">
        {/* Glow Spheres */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-black uppercase tracking-widest text-amber-300">
              <Sparkles size={14} className="animate-pulse" />
              {isRtl ? 'مزامنة متعددة القنوات 100% تلقائية' : 'Synchronisation Omnicanale Automatique'}
            </div>
            
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
              {isRtl ? 'الربط البرمجي وواجهات التطبيقات (APIs)' : 'Intégrations & APIs E-commerce'}
            </h1>
            
            <p className="text-slate-300 text-sm sm:text-base font-medium leading-relaxed">
              {isRtl 
                ? 'ربط متجرك المباشر على YouCan و WooCommerce و Shopify واستقبال الطلبيات تلقائيًا في الوقت الفعلي مع تحديث حالة التوصيل والمخزون.'
                : 'Connectez vos boutiques e-commerce sur YouCan, WooCommerce et Shopify pour importer et synchroniser vos commandes et leads en temps réel.'
              }
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex flex-wrap sm:flex-nowrap gap-4 bg-white/5 backdrop-blur-xl p-4 sm:p-6 rounded-3xl border border-white/10 shrink-0">
            <div className="px-4 py-2 border-r border-white/10 rtl:border-r-0 rtl:border-l">
              <p className="text-2xl font-black text-amber-400">3+</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{isRtl ? 'منصات مدعومة' : 'Plateformes'}</p>
            </div>
            <div className="px-4 py-2 border-r border-white/10 rtl:border-r-0 rtl:border-l">
              <p className="text-2xl font-black text-emerald-400">REST & Webhooks</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{isRtl ? 'تحديث فوري' : 'Temps Réel'}</p>
            </div>
            <div className="px-4 py-2">
              <p className="text-2xl font-black text-indigo-400">100%</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{isRtl ? 'آمن وموثوق' : 'Sécurisé'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid of Integrations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* ========================================================================= */}
        {/* CARD 1: YOUCAN.SHOP */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
          {/* Top Accent Line */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 to-rose-500" />
          
          <div className="space-y-6">
            {/* Logo & Status Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-rose-500/20">
                  YC
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
                <span>{isRtl ? 'تحديث حالة الشحن ورقم التتبع' : 'Mise à jour des statuts & suvis'}</span>
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
          {/* Top Accent Line */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-purple-600 to-indigo-600" />

          <div className="space-y-6">
            {/* Logo & Status Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-purple-500/20">
                  WC
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
          <div className="pt-6">
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
              <Sliders size={16} />
              {wooConfig.isConnected 
                ? (isRtl ? 'تعديل ربط WooCommerce' : 'Gérer WooCommerce')
                : (isRtl ? 'تهيئة ربط WooCommerce' : 'Configurer WooCommerce')
              }
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CARD 3: SHOPIFY */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
          {/* Top Accent Line */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-600" />

          <div className="space-y-6">
            {/* Logo & Status Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-500/20">
                  SF
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
        {/* CARD 4: CUSTOM REST API & WEBHOOKS */}
        {/* ========================================================================= */}
        <div className="bg-slate-900 rounded-3xl p-8 text-white border border-slate-800 shadow-xl flex flex-col justify-between md:col-span-2 lg:col-span-3 group relative overflow-hidden">
          {/* Subtle Glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="space-y-6 relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
                  <Webhook size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-black tracking-tight">{isRtl ? 'مفاتيح REST API & Webhooks المخصصة' : 'REST API Direct & Webhooks Météo'}</h3>
                  <p className="text-xs font-bold text-slate-400">{isRtl ? 'للمطورين والمواقع الخاصة المخصصة' : 'Pour développeurs, landing pages & sites sur-mesure'}</p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Code size={14} /> Developer Edition
              </span>
            </div>

            <p className="text-slate-300 text-sm font-medium leading-relaxed max-w-3xl">
              {isRtl
                ? 'يمكنك ربط أي موقع مخصص أو صفحة هبوط عبر إرسال الطلبيات مباشرة بطلبات HTTP POST مفتاح API الخاص بك واستقبال التحديثات فورًا عبر Webhooks.'
                : 'Envoyez vos leads et commandes directement via notre API REST sécurisée en HTTP POST ou configurez vos Webhooks personnalisés.'
              }
            </p>

            {/* API Secret Key Box */}
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
              <div className="flex items-center gap-3 overflow-hidden">
                <Key className="text-amber-400 shrink-0" size={16} />
                <span className="text-slate-400 font-bold">{isRtl ? 'مفتاح API الخاص بك:' : 'Votre Clé API:'}</span>
                <span className="text-amber-300 font-black truncate">{apiKey}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => copyToClipboard(apiKey, isRtl ? 'مفتاح API' : 'Clé API')}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-sans text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5"
                >
                  <Copy size={12} /> {isRtl ? 'نسخ' : 'Copier'}
                </button>
                <button
                  onClick={generateNewApiKey}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-sans text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5"
                >
                  <RefreshCw size={12} /> {isRtl ? 'توليد مفتاح جديد' : 'Générer'}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-6 relative z-10 flex flex-wrap gap-4">
            <button
              onClick={() => setActiveModal('API')}
              className="py-3 px-6 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2"
            >
              <FileText size={16} />
              {isRtl ? 'أكواد وأدلة التوثيق API Documentation' : 'Documentation & Code Snippets'}
            </button>
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
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-black">YC</div>
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
                      onClick={handleToggleYouCanSync}
                      disabled={isTogglingSync}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all ${
                        youcanStatus.autoSyncActive ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {youcanStatus.autoSyncActive ? (isRtl ? 'مُفعلة' : 'Activé') : (isRtl ? 'معطلة' : 'Désactivé')}
                    </button>
                  </div>
                )}
              </div>

              {/* Connect Button */}
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
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-black">WC</div>
                <div>
                  <h3 className="text-xl font-black">{isRtl ? 'إعدادات ربط WooCommerce' : 'Configuration WooCommerce'}</h3>
                  <p className="text-xs text-white/80 font-medium">REST API Keys & Webhooks</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/20 rounded-xl text-white">✕</button>
            </div>

            <form onSubmit={handleSaveWooCommerce} className="p-6 space-y-4 text-slate-700">
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

              <div className="p-3 bg-purple-50 rounded-2xl border border-purple-100 text-xs text-purple-900 font-medium">
                {isRtl 
                  ? '💡 يمكنك الربط بنقرة واحدة بمجرد إدخال رابط متجرك والضغط على زر "الربط بنقرة واحدة"، أو إدخال المفاتيح يدوياً.'
                  : '💡 Entrez simplement l\'URL de votre boutique puis cliquez sur le bouton pour vous connecter en 1 Clic via WooCommerce !'}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Consumer Key (ck_...) <span className="text-slate-400 font-normal">({isRtl ? 'اختياري' : 'Optionnel'})</span></label>
                <input
                  type="text"
                  placeholder="ck_1234567890abcdef..."
                  value={wooDraft.consumerKey}
                  onChange={(e) => setWooDraft(prev => ({ ...prev, consumerKey: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-purple-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Consumer Secret (cs_...) <span className="text-slate-400 font-normal">({isRtl ? 'اختياري' : 'Optionnel'})</span></label>
                <input
                  type="password"
                  placeholder="cs_1234567890abcdef..."
                  value={wooDraft.consumerSecret}
                  onChange={(e) => setWooDraft(prev => ({ ...prev, consumerSecret: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-purple-600"
                />
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
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-black">SF</div>
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
                  {isRtl ? 'رمز الوصول (Admin Access Token - اختيارى)' : 'Admin API Access Token (shpat_...) (Optionnel)'}
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
                      className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all ${
                        shopifyStatus.autoSyncActive ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {shopifyStatus.autoSyncActive ? (isRtl ? 'مُفعلة' : 'Activé') : (isRtl ? 'معطلة' : 'Désactivé')}
                    </button>
                  </div>
                )}
              </div>

              {/* Single Button Connection */}
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
      {/* MODAL 4: API CODE DOCUMENTATION */}
      {/* ========================================================================= */}
      {activeModal === 'API' && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/65 backdrop-blur-md flex items-center justify-center z-[999999] p-4 animate-in fade-in duration-300 cursor-pointer"
          onClick={() => setActiveModal(null)}
        >
          <div 
            className="bg-slate-900 text-white rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-slate-800 animate-in zoom-in-95 duration-200 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-3">
                <Code className="text-amber-400" size={24} />
                <div>
                  <h3 className="text-lg font-black">{isRtl ? 'دليل الربط عبر REST API' : 'Documentation REST API'}</h3>
                  <p className="text-xs text-slate-400 font-mono">POST {apiBaseUrl}/leads</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">✕</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs font-mono">
              <div className="space-y-2">
                <p className="text-slate-300 font-sans font-bold text-sm">cURL Command Example:</p>
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 overflow-x-auto text-amber-300">
                  <pre>{`curl -X POST "${apiBaseUrl}/leads" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customerName": "Kamal Mansouri",
    "customerPhone": "0661234567",
    "city": "Casablanca",
    "address": "Bd Zerktouni",
    "notes": "Commande directe Web"
  }'`}</pre>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-slate-300 font-sans font-bold text-sm">JavaScript / Fetch Example:</p>
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 overflow-x-auto text-emerald-400">
                  <pre>{`await fetch("${apiBaseUrl}/leads", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${apiKey}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    customerName: "Siham Bennani",
    customerPhone: "0669876543",
    city: "Rabat"
  })
});`}</pre>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="px-6 py-2.5 bg-white hover:bg-slate-200 text-slate-900 font-sans font-black text-xs uppercase rounded-xl tracking-wider"
              >
                {isRtl ? 'إغلاق' : 'Fermer'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
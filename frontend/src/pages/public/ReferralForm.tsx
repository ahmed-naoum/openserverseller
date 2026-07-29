import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { publicApi } from '../../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, ShieldCheck, Truck, Clock, CheckCircle2, UserCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import BlockRenderer from '../../components/helper/sitebuilder/BlockRenderer';
import WhatsAppWidget from '../../components/public/WhatsAppWidget';

const getNoScriptUrl = (pixel: any) => {
  const platform = (pixel.platform || 'META').toUpperCase();
  if (platform === 'META') {
    return `https://www.facebook.com/tr?id=${pixel.pixelId}&ev=PageView&noscript=1`;
  }
  if (platform === 'SNAPCHAT') {
    return `https://tr.snapchat.com/cm/i?id=${pixel.pixelId}&ev=PAGE_VIEW&noscript=1`;
  }
  if (platform === 'TIKTOK') {
    return `https://analytics.tiktok.com/api/v2/pixel?id=${pixel.pixelId}&ev=PageView&noscript=1`;
  }
  if (platform === 'GOOGLE') {
    return `https://www.googletagmanager.com/ns.html?id=${pixel.pixelId}`;
  }
  return '';
};

export default function ReferralForm() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);
  
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    city: '',
    address: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedOption, setSelectedOption] = useState<any>(null);
  const [selectedProductFromBlock, setSelectedProductFromBlock] = useState<any>(null);

  useEffect(() => {
    const handleSelectProduct = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.product) {
        setSelectedProductFromBlock(customEvent.detail.product);
      }
    };
    window.addEventListener('select-product', handleSelectProduct);
    return () => window.removeEventListener('select-product', handleSelectProduct);
  }, []);

  useEffect(() => {
    if (code) {
      fetchData();
    }
  }, [code]);

  const findCheckoutBlock = (structure: any) => {
    if (!structure || !structure.blocks) return null;
    return structure.blocks.find((b: any) => b.type === 'express_checkout');
  };

  useEffect(() => {
    if (data?.landingPage?.customStructure) {
      const checkoutBlock = findCheckoutBlock(data.landingPage.customStructure);
      if (checkoutBlock?.content?.options?.length > 0 && !selectedOption) {
        setSelectedOption(checkoutBlock.content.options[0]);
      }
    }
  }, [data]);

  // Client-side Cloaking & Redirect Filters
  useEffect(() => {
    if (data?.landingPage?.customStructure) {
      const structure = data.landingPage.customStructure;
      const settings = Array.isArray(structure) ? null : structure?.settings;
      if (settings?.cloaking?.enabled) {
        const c = settings.cloaking;

        // 1. Bot & Crawler Filtering
        if (c.filterBots) {
          const botPattern = /bot|crawler|spider|crawling|scraper|snippet|curl|wget|python|postman|axios|node-fetch|httpclient|headless|puppeteer|phantomjs|selenium|cypress|facebookexternalhit|facebookplatform|facebookcatalog|facebookbot|googlebot|bingbot|slurp|yahoo|adbot|lighthouse|duckduckbot|baiduspider|yandexbot|sogou|exabot|facebot|ia_archiver|linkedinbot|twitterbot|slackbot|telegrambot|applebot|whatsapp|skypeuripreview|ahrefsbot|semrushbot|mj12bot|dotbot|rogerbot|moz|majestics12|seznambot|pingdom|archive\.org_bot|discordbot|pinterest|vkshare|redditbot|tumblr|flipboardproxy|feedfetcher|amazonbot|bytespider|ccbot|chatgpt-user|claudebot|coccocbot|dataminr|go-http-client|grapeshot|java|libwww|lwp-trivial|mail\.ru|megaindex|petalsearch|qwantify|screaming\sfrog|soso|tencenttraveler|zite|zoominfo|ahrefs|alexa|appinsights|archive|ask\sjeeves|bubing|catchpoint|cloudflare|criteo|datadog|duckduckgo|fastly|feedburner|flipboard|hubspot|incapsula|instagram|linkedin|majestic|monitor|msn|naver|nuzzel|outbrain|pagespeed|quora|reddit|semrush|skype|slack|snapchat|statuscake|telegram|updown|uptimerobot|vkontakte|yelp|youtube|zillow|zmeu/i;
          if (botPattern.test(navigator.userAgent)) {
            window.location.replace(c.botRedirectUrl || 'https://wikipedia.org');
            return;
          }
        }

        // 2. Direct Visits Filtering (No referrer)
        if (c.filterDirect) {
          if (!document.referrer) {
            window.location.replace(c.directRedirectUrl || 'https://google.com');
            return;
          }
        }

        // 3. Desktop redirection (Mobile only mode)
        if (c.redirectDesktop) {
          const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
          if (!isMobile) {
            window.location.replace(c.desktopRedirectUrl || 'https://www.silacod.com');
            return;
          }
        }

        // 4. Browser Language Filtering
        if (c.filterLanguage && c.allowedLanguages) {
          const userLang = (navigator.language || (navigator as any).userLanguage || '').toLowerCase();
          const allowedList = c.allowedLanguages.split(',').map((l: string) => l.trim().toLowerCase());
          const isAllowed = allowedList.some((lang: string) => userLang.includes(lang));
          if (!isAllowed) {
            window.location.replace(c.languageRedirectUrl || 'https://google.com');
            return;
          }
        }
      }
    }
  }, [data]);

  const activePixels = useMemo(() => {
    if (!data?.pixels || !Array.isArray(data.pixels)) return [];
    
    const matchingSinglePixels = data.pixels.filter((p: any) => p.type === 'SINGLE' && p.targetIds?.includes(code));
    
    if (matchingSinglePixels.length > 0) {
      return matchingSinglePixels;
    }
    
    return data.pixels.filter((p: any) => p.type === 'GLOBAL');
  }, [data, code]);

  // Multi-platform Pixel Injection
  useEffect(() => {
    if (activePixels.length > 0) {
      activePixels.forEach((pixel: any) => {
        if (typeof window === 'undefined') return;

        const platform = (pixel.platform || 'META').toUpperCase();

        if (platform === 'META') {
          // @ts-ignore
          !function(f,b,e,v,n,t,s)
          // @ts-ignore
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          // @ts-ignore
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          // @ts-ignore
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          // @ts-ignore
          n.queue=[];t=b.createElement(e);t.async=!0;
          // @ts-ignore
          t.src=v;b.head.appendChild(t)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');

          (window as any).fbq('init', pixel.pixelId);
          (window as any).fbq('track', 'PageView');

        } else if (platform === 'GOOGLE') {
          const script = document.createElement('script');
          script.async = true;
          script.src = `https://www.googletagmanager.com/gtag/js?id=${pixel.pixelId}`;
          document.head.appendChild(script);

          (window as any).dataLayer = (window as any).dataLayer || [];
          function gtag(){ (window as any).dataLayer.push(arguments); }
          (window as any).gtag = gtag;
          // @ts-ignore
          gtag('js', new Date());
          // @ts-ignore
          gtag('config', pixel.pixelId);

        } else if (platform === 'TIKTOK') {
          // @ts-ignore
          !function (w, d, t) {
            // @ts-ignore
            w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(n,a)};
            ttq.load(pixel.pixelId);
            ttq.page();
          }(window, document, 'ttq');

        } else if (platform === 'SNAPCHAT') {
          // @ts-ignore
          !function(e,t,n){if(e.snaptr)return;var r=e.snaptr=function(){r.handleRequest?r.handleRequest.apply(r,arguments):r.queue.push(arguments)};r.queue=[];var a=t.createElement(n);a.async=!0;a.src="https://sc-static.net/scevent.min.js";var s=t.getElementsByTagName(n)[0];s.parentNode.insertBefore(a,s)}(window,document,"script");
          // @ts-ignore
          snaptr('init', pixel.pixelId);
          // @ts-ignore
          snaptr('track', 'PAGE_VIEW');
        }
      });
    }
  }, [activePixels]);

  const fetchData = async () => {
    try {
      const res = await publicApi.getReferralLinkData(code!);
      // Handle standardized response wrapper
      const responseData = res.data.status === 'success' ? res.data.data : res.data;
      setData(responseData);
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.phone || !form.city) {
      toast.error('Veuillez remplir les champs obligatoires');
      return;
    }

    try {
      setIsSubmitting(true);
      await publicApi.submitReferralLead({
        referralCode: code!,
        ...form,
        productVariant: selectedProductFromBlock 
          ? `${selectedProductFromBlock.nameFr || selectedProductFromBlock.nameEn || selectedProductFromBlock.nameAr} (${selectedOption?.name || 'Standard'})`
          : selectedOption?.name
      });
      
      // Track Conversion
      if (activePixels.length > 0) {
        activePixels.forEach((pixel: any) => {
          if (typeof window === 'undefined') return;
          const platform = (pixel.platform || 'META').toUpperCase();
          const eventName = pixel.conversionEvent || 'Lead';

          if (platform === 'META' && (window as any).fbq) {
            (window as any).fbq('track', eventName);
          } else if (platform === 'GOOGLE' && (window as any).gtag) {
            (window as any).gtag('event', eventName, { 'event_category': 'conversion' });
          } else if (platform === 'TIKTOK' && (window as any).ttq) {
            const ttEvent = eventName === 'Purchase' ? 'CompletePayment' : 'CompleteRegistration';
            (window as any).ttq.track(ttEvent);
          } else if (platform === 'SNAPCHAT' && (window as any).snaptr) {
            const snapEvent = eventName === 'Purchase' ? 'PURCHASE' : 'SIGN_UP';
            (window as any).snaptr('track', snapEvent);
          }
        });
      }

      navigate('/thank-you', { replace: true });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div 
          className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 mb-4"
          style={{ borderTopColor: data?.landingPage?.themeColor || '#f97316' }}
        ></div>
        <p className="text-gray-500 font-medium animate-pulse">Chargement de l'offre...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-gray-100">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Offre indisponible</h2>
          <p className="text-gray-500 mb-8">Ce lien de parrainage est invalide ou l'offre a expiré.</p>
        </div>
      </div>
    );
  }

  const { product, influencerName, influencerAvatar, landingPage } = data;

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-gray-100">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Produit introuvable</h2>
          <p className="text-gray-500 mb-8">Les informations du produit n'ont pas pu être chargées.</p>
        </div>
      </div>
    );
  }

  const renderCheckoutForm = (blockContent: any = {}) => (
    <div 
      className="p-6 sm:p-7 relative"
      style={{
        backgroundColor: blockContent.formBgColor || '#ffffff',
        border: `${blockContent.borderWidth ?? 1}px solid ${blockContent.borderColor ?? '#f3f4f6'}`,
        borderRadius: `${blockContent.borderRadiusTL ?? 32}px ${blockContent.borderRadiusTR ?? 32}px ${blockContent.borderRadiusBR ?? 32}px ${blockContent.borderRadiusBL ?? 32}px`
      }}
    >
      <AnimatePresence mode="wait">
        {isSuccess ? (
          <motion.div 
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12"
          >
            <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-3">Félicitations !</h3>
            <p className="text-gray-500 text-lg mb-8 max-w-xs mx-auto">
              Votre demande a été bien reçue. Un agent va vous contacter très prochainement pour confirmer la commande.
            </p>
            <button 
              onClick={() => {
                setIsSuccess(false);
                setForm({ fullName: '', phone: '', city: '', address: '' });
              }}
              className="font-bold hover:underline"
              style={{ color: blockContent.themeColor || landingPage?.themeColor || '#f97316' }}
            >
              Passer une autre commande
            </button>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-black text-gray-900 mb-1">
                {blockContent.title || 'Commander Maintenant'}
              </h2>
              {blockContent.showPrice !== false && (
                <div className="flex items-center justify-center gap-3 mb-2">
                  {blockContent.showOldPrice && (
                    <span 
                      className="font-bold line-through opacity-60"
                      style={{ 
                        color: blockContent.oldPriceColor || '#9ca3af',
                        fontSize: `${blockContent.oldPriceSize || (blockContent.priceSize || 30) * 0.7}px`
                      }}
                    >
                      {blockContent.oldPriceValue || (product?.retailPriceMad ? Number(product.retailPriceMad) + 50 : 150)} <span className="text-sm uppercase ml-0.5">MAD</span>
                    </span>
                  )}
                  <div 
                    className="font-black"
                    style={{ 
                      color: blockContent.priceColor || '#f64444', 
                      fontSize: `${blockContent.priceSize || 30}px` 
                    }}
                  >
                    {selectedOption?.price || selectedProductFromBlock?.retailPriceMad || selectedProductFromBlock?.priceMad || product?.retailPriceMad} <span className="text-lg uppercase ml-1 opacity-60">MAD</span>
                  </div>
                </div>
              )}
              <p className="text-sm text-gray-500 font-medium">
                {blockContent.subtitle || 'Remplissez le formulaire ci-dessous pour réserver votre produit. Le paiement se fera à la livraison.'}
              </p>
            </div>

            {blockContent.options && blockContent.options.length > 0 && (
              <div className="mb-8 space-y-2">
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-3 tracking-widest">Sélectionnez votre offre</label>
                <div className="grid grid-cols-1 gap-0">
                  {blockContent.options.map((opt: any, i: number) => {
                    const isSelected = selectedOption?.id === opt.id || (!selectedOption && i === 0);
                    const accentColor = opt.color || blockContent.packColor || '#f97316';
                    
                    return (
                      <div 
                        key={opt.id || i} 
                        onClick={() => setSelectedOption(opt)}
                        className={`py-4 px-3 transition-all cursor-pointer flex justify-between items-center group relative outline-none ${
                          isSelected ? '' : 'border-b border-gray-100'
                        }`}
                        style={isSelected ? { 
                          borderColor: accentColor, 
                          borderWidth: `${blockContent.packBorderWidth ?? 2}px`,
                          borderRadius: `${blockContent.packBorderRadius ?? 16}px`,
                          backgroundColor: `${accentColor}08`
                        } : {}}
                      >
                        {isSelected && (
                           <div 
                            className="absolute -top-1 -right-2 py-0.5 px-2 text-[7px] font-black text-white uppercase tracking-tighter rounded-full shadow-sm"
                            style={{ backgroundColor: accentColor }}
                           >
                            Sélectionné
                           </div>
                        )}
                        <div>
                          <div 
                            className="font-black text-lg transition-colors"
                            style={{ color: isSelected ? accentColor : '#111827' }}
                          >
                            {opt.name || `Pack ${i + 1}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {opt.oldPrice && (
                            <>
                              <span 
                                className="font-bold line-through opacity-50"
                                style={{ 
                                  color: opt.oldPriceColor || blockContent.oldPriceColor || '#9ca3af',
                                  fontSize: opt.oldPriceSize ? `${opt.oldPriceSize}px` : (blockContent.oldPriceSize ? `${blockContent.oldPriceSize}px` : '24px')
                                }}
                              >
                                {opt.oldPrice}
                              </span>
                              <span className="text-gray-300 font-bold text-xl mx-0.5">/</span>
                            </>
                          )}
                          <div 
                            className="font-black transition-colors"
                            style={{ 
                              color: opt.priceColor || (isSelected ? accentColor : '#111827'),
                              fontSize: opt.priceSize ? `${opt.priceSize}px` : (blockContent.priceSize ? `${blockContent.priceSize}px` : '24px')
                            }}
                          >
                            {opt.price} <span className="text-[11px] opacity-60 uppercase ml-1">MAD</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">{blockContent.nameLabel || 'Nom complet *'}</label>
                <input
                  type="text"
                  required
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="w-full px-4 py-3.5 bg-gray-50 rounded-xl focus:bg-white focus:outline-none focus:ring-2 transition-all font-medium"
                  style={{ 
                    '--tw-ring-color': `${blockContent.themeColor || landingPage?.themeColor || '#f97316'}33`,
                    '--tw-focus-border-color': blockContent.themeColor || landingPage?.themeColor || '#f97316'
                  } as any}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = blockContent.themeColor || landingPage?.themeColor || '#f97316';
                    e.currentTarget.style.boxShadow = `0 0 0 2px ${blockContent.themeColor || landingPage?.themeColor || '#f97316'}33`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  placeholder={blockContent.namePlaceholder || "Ex: Youssef Benjelloun"}
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">{blockContent.phoneLabel || 'Numéro de téléphone *'}</label>
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-4 py-3.5 bg-gray-50 rounded-xl focus:bg-white focus:outline-none focus:ring-2 transition-all font-medium"
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = blockContent.themeColor || landingPage?.themeColor || '#f97316';
                    e.currentTarget.style.boxShadow = `0 0 0 2px ${blockContent.themeColor || landingPage?.themeColor || '#f97316'}33`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  placeholder={blockContent.phonePlaceholder || "06 XX XX XX XX"}
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">{blockContent.cityLabel || 'Ville *'}</label>
                <input
                  type="text"
                  required
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full px-4 py-3.5 bg-gray-50 rounded-xl focus:bg-white focus:outline-none focus:ring-2 transition-all font-medium"
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = blockContent.themeColor || landingPage?.themeColor || '#f97316';
                    e.currentTarget.style.boxShadow = `0 0 0 2px ${blockContent.themeColor || landingPage?.themeColor || '#f97316'}33`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  placeholder={blockContent.cityPlaceholder || "Ex: Casablanca"}
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">{blockContent.addressLabel || 'Adresse (Optionnel)'}</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3.5 bg-gray-50 rounded-xl focus:bg-white focus:outline-none focus:ring-2 transition-all font-medium resize-none"
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = blockContent.themeColor || landingPage?.themeColor || '#f97316';
                    e.currentTarget.style.boxShadow = `0 0 0 2px ${blockContent.themeColor || landingPage?.themeColor || '#f97316'}33`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  placeholder={blockContent.addressPlaceholder || "Votre adresse complète pour faciliter la livraison"}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full font-black p-4 shadow-lg transition-all disabled:opacity-50 mt-6"
                style={{ 
                  backgroundColor: blockContent.themeColor || landingPage?.themeColor || '#f97316',
                  color: blockContent.buttonTextColor || '#ffffff',
                  fontSize: blockContent.buttonSize ? `${blockContent.buttonSize}px` : '18px',
                  border: blockContent.buttonBorderWidth !== undefined && blockContent.buttonBorderWidth !== '' ? `${blockContent.buttonBorderWidth}px solid ${blockContent.buttonBorderColor || blockContent.themeColor || landingPage?.themeColor || '#f97316'}` : 'none',
                  borderRadius: blockContent.buttonBorderRadius !== undefined && blockContent.buttonBorderRadius !== '' ? `${blockContent.buttonBorderRadius}px` : '12px',
                }}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Traitement...
                  </span>
                ) : (
                  blockContent.buttonText || landingPage?.buttonText || 'Confirmer ma commande'
                )}
              </button>
              
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-gray-400 mt-4">
                <ShieldCheck className="w-4 h-4" />
                Vos informations sont sécurisées
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const structure = landingPage?.customStructure;
  const blocks = Array.isArray(structure) ? structure : (structure?.blocks || []);
  const pageSettings = Array.isArray(structure) ? { backgroundColor: '#f9fafb' } : (structure?.settings || { backgroundColor: '#f9fafb' });
  const whatsappBlock = blocks.find((b: any) => b.type === 'whatsapp');
  const whatsappSettings = whatsappBlock && whatsappBlock.content.enableWidget !== false ? {
    enabled: true,
    nickname: influencerName || 'Nitso',
    profileImage: influencerAvatar || '',
    ...whatsappBlock.content
  } : (pageSettings?.whatsappWidget?.enabled ? {
    nickname: influencerName || 'Nitso',
    profileImage: influencerAvatar || '',
    ...pageSettings.whatsappWidget
  } : undefined);

  if (blocks.length > 0) {
    return (
      <div 
        className="w-full min-h-screen font-sans pb-20 transition-colors duration-300"
        style={{ backgroundColor: pageSettings.backgroundColor }}
      >
        <BlockRenderer blocks={blocks} renderCheckout={renderCheckoutForm} />
        {whatsappSettings?.enabled && (
          <WhatsAppWidget settings={whatsappSettings} />
        )}
        {activePixels.map((p: any) => {
          const url = getNoScriptUrl(p);
          if (!url) return null;
          return (
            <noscript key={p.id}>
              {p.platform === 'GOOGLE' ? (
                <iframe src={url} height="0" width="0" style={{ display: 'none', visibility: 'hidden' }} />
              ) : (
                <img height="1" width="1" style={{ display: 'none' }} src={url} />
              )}
            </noscript>
          );
        })}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col items-center py-12 px-4">
      
      {/* Influencer Header (Trust Badge) */}

      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        
        {/* Product Details Columns */}
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="space-y-6 lg:space-y-8"
        >
          <div className="bg-white rounded-[2rem] p-4 shadow-xl shadow-gray-200/40 border border-gray-100">
            <div className="aspect-[4/3] rounded-3xl overflow-hidden bg-gray-50 mb-6 relative">
              {product.images?.[0]?.imageUrl ? (
                <img 
                  src={product.images[0].imageUrl} 
                  alt={product.nameFr} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                  <Package className="w-16 h-16" />
                </div>
              )}
            </div>
            
            <div className="px-2 pb-2">
            <div 
              className="inline-block px-3 py-1 font-bold text-xs rounded-lg mb-3"
              style={{ 
                backgroundColor: `${landingPage?.themeColor || '#f97316'}15`,
                color: landingPage?.themeColor || '#f97316'
              }}
            >
              {product.category?.nameFr}
            </div>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight mb-2">
                {landingPage?.title || product.nameFr}
              </h1>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                {landingPage?.description || product.description}
              </p>
              
              <div className="flex items-end gap-2 mb-6">
                <div 
                  className="text-4xl font-black leading-none"
                  style={{ color: landingPage?.themeColor || '#f97316' }}
                >
                  {product.retailPriceMad}
                </div>
                <div 
                  className="text-lg font-bold pb-1"
                  style={{ color: `${landingPage?.themeColor || '#f97316'}99` }}
                >
                  MAD
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-xs font-bold text-gray-700">
                  <Truck className="w-4 h-4" style={{ color: landingPage?.themeColor || '#f97316' }} />
                  Livraison partout au Maroc
                </div>
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-xs font-bold text-gray-700">
                  <ShieldCheck className="w-4 h-4" style={{ color: landingPage?.themeColor || '#f97316' }} />
                  Paiement à la livraison
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Lead Capture Form Column */}
        <motion.div 
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="sticky top-8"
        >
          {renderCheckoutForm()}
        </motion.div>
      </div>
      {whatsappSettings?.enabled && (
        <WhatsAppWidget settings={whatsappSettings} />
      )}
      {activePixels.map((p: any) => {
        const url = getNoScriptUrl(p);
        if (!url) return null;
        return (
          <noscript key={p.id}>
            {p.platform === 'GOOGLE' ? (
              <iframe src={url} height="0" width="0" style={{ display: 'none', visibility: 'hidden' }} />
            ) : (
              <img height="1" width="1" style={{ display: 'none' }} src={url} />
            )}
          </noscript>
        );
      })}
    </div>
  );
}

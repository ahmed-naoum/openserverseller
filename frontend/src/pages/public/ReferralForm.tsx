import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { publicApi } from '../../lib/api';
import { useSocket } from '../../contexts/SocketContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, ShieldCheck, Truck, Clock, CheckCircle2, UserCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import BlockRenderer from '../../components/helper/sitebuilder/BlockRenderer';
import WhatsAppWidget from '../../components/public/WhatsAppWidget';
import { getCloakingConfig, needsGeoLookup, resolveGeoCloakRedirect, resolveInstantCloakRedirect } from '../../utils/cloaking';

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

/**
 * Field limits for the express checkout, kept in step with the compiled version
 * of the same form (backend/src/services/landingCompiler/blocks/checkout.ts).
 * A visitor sees one renderer or the other depending on whether the page
 * compiled, and the two refusing different values would be impossible to debug
 * from a screenshot.
 *
 * The floors are the ones this form already had. Only the ceilings are new, and
 * they sit far above any real Moroccan name, city or address.
 */
const FIELD_LIMITS = {
  nameMin: 2,
  nameMax: 60,
  cityMin: 2,
  cityMax: 40,
  phoneMax: 20,
  addressMin: 5,
  addressMax: 200,
};

/**
 * Letters, not characters: the digit strippers on the name and city fields
 * already remove numbers, so punctuation is the only thing that can satisfy a
 * bare length check. Covers Arabic and accented Latin.
 */
const countLetters = (s: string) =>
  (s.match(/[A-Za-z؀-ۿݐ-ݿࢠ-ࣿÀ-ɏ]/g) || []).length;

export default function ReferralForm() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { socket } = useSocket();

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

  // Abandoned-checkout capture: stream what the visitor types (debounced) so an
  // admin can see partially-filled orders that were never submitted.
  useEffect(() => {
    if (!socket) return;
    const hasData = form.fullName || form.phone || form.city || form.address;
    if (!hasData) return;
    const t = setTimeout(() => {
      socket.emit('checkout:progress', {
        code,
        productName: data?.product?.nameFr || data?.product?.nameAr || undefined,
        fields: form,
      });
    }, 700);
    return () => clearTimeout(t);
  }, [form, socket, code, data]);

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

  // GeoIP-based cloaking. The instant rules already ran in fetchData before the page
  // was allowed to render; these need a third-party IP lookup, so they run after so
  // legitimate visitors are not held behind a network round-trip.
  useEffect(() => {
    const cloaking = getCloakingConfig(data?.landingPage?.customStructure);
    if (!cloaking || !needsGeoLookup(cloaking)) return;

    let cancelled = false;
    resolveGeoCloakRedirect(cloaking).then((redirectUrl) => {
      if (!cancelled && redirectUrl) window.location.replace(redirectUrl);
    });

    return () => { cancelled = true; };
  }, [data]);

  // Anti-Vol / Right-Click & Inspect Protection
  useEffect(() => {
    const cloaking = getCloakingConfig(data?.landingPage?.customStructure);
    if (!cloaking?.disableRightClick) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // F12 Key
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+Shift+I (Inspector), Ctrl+Shift+J (Console), Ctrl+Shift+C (Inspect Element)
      if (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+U (View Source), Ctrl+S (Save Web Page)
      if (e.ctrlKey && ['u', 's'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
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
          if (!(window as any).fbq) {
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
          }

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

  /**
   * Claims the request index.html started while the HTML was still parsing.
   *
   * The code in the URL is the only thing trusted for the match, so a
   * client-side navigation to a different link falls through to a normal
   * request instead of rendering the previous offer. It is claimed once — a
   * remount must read fresh data rather than replay a stale body.
   */
  const takePreloadedBody = async (): Promise<any | null> => {
    const preload = (window as any).__REFERRAL_PRELOAD__;
    if (!preload || preload.code !== code) return null;
    delete (window as any).__REFERRAL_PRELOAD__;
    try {
      return await preload.body;
    } catch {
      return null;
    }
  };

  const fetchData = async () => {
    try {
      // Absent, stale or failed preload falls straight through to the normal
      // request, so the handoff can save time but never break the page.
      const body =
        (await takePreloadedBody()) ??
        (await publicApi.getReferralLinkData(code!)).data;

      // Handle standardized response wrapper
      const responseData = body?.status === 'success' ? body.data : body;

      // Cloaking is decided here, before any state that would render the page.
      // A blocked visitor keeps the loading spinner and never sees the content.
      const cloaking = getCloakingConfig(responseData?.landingPage?.customStructure);
      if (cloaking) {
        const redirectUrl = resolveInstantCloakRedirect(cloaking);
        if (redirectUrl) {
          window.location.replace(redirectUrl);
          return; // stay on the spinner while the browser navigates away
        }
      }

      setData(responseData);
    } catch (err) {
      setError(true);
      setLoading(false);
      return;
    }
    setLoading(false);
  };

  const [errors, setErrors] = useState<{ fullName?: string; phone?: string; city?: string; address?: string }>({});

  const handleNameChange = (val: string) => {
    // Strip numbers (0-9 and Eastern Arabic numerals ٠-٩)
    const sanitized = val.replace(/[0-9٠-٩]/g, '');
    setForm(prev => ({ ...prev, fullName: sanitized }));
    if (errors.fullName) setErrors(prev => ({ ...prev, fullName: undefined }));
  };

  const handleCityChange = (val: string) => {
    // Strip numbers (0-9 and Eastern Arabic numerals ٠-٩)
    const sanitized = val.replace(/[0-9٠-٩]/g, '');
    setForm(prev => ({ ...prev, city: sanitized }));
    if (errors.city) setErrors(prev => ({ ...prev, city: undefined }));
  };

  const handlePhoneChange = (val: string) => {
    // Convert Eastern Arabic digits ٠-٩ to standard digits 0-9
    let sanitized = val;
    const arabicDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
    for (let i = 0; i < 10; i++) {
      sanitized = sanitized.replace(new RegExp(arabicDigits[i], 'g'), i.toString());
    }
    // Allow only digits, +, space, -
    sanitized = sanitized.replace(/[^0-9+\s-]/g, '');
    setForm(prev => ({ ...prev, phone: sanitized }));
    if (errors.phone) setErrors(prev => ({ ...prev, phone: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { fullName?: string; phone?: string; city?: string; address?: string } = {};

    const trimmedName = form.fullName.trim();
    if (!trimmedName) {
      newErrors.fullName = 'الاسم الكامل مطلوب *';
    } else if (/[0-9٠-٩]/.test(trimmedName)) {
      newErrors.fullName = 'الاسم الكامل يجب ألا يحتوي على أرقام';
    } else if (trimmedName.length < FIELD_LIMITS.nameMin) {
      newErrors.fullName = 'يرجى كتابة الاسم الكامل بشكل صحيح';
    } else if (countLetters(trimmedName) < 2) {
      newErrors.fullName = 'يرجى كتابة الاسم بالحروف';
    } else if (trimmedName.length > FIELD_LIMITS.nameMax) {
      newErrors.fullName = 'الاسم طويل جدا';
    }

    const trimmedCity = form.city.trim();
    if (!trimmedCity) {
      newErrors.city = 'اسم المدينة مطلوب *';
    } else if (/[0-9٠-٩]/.test(trimmedCity)) {
      newErrors.city = 'اسم المدينة يجب ألا يحتوي على أرقام';
    } else if (trimmedCity.length < FIELD_LIMITS.cityMin) {
      newErrors.city = 'يرجى كتابة اسم المدينة بشكل صحيح';
    } else if (countLetters(trimmedCity) < 2) {
      newErrors.city = 'يرجى كتابة اسم المدينة بالحروف';
    } else if (trimmedCity.length > FIELD_LIMITS.cityMax) {
      newErrors.city = 'اسم المدينة طويل جدا';
    }

    // The address stays optional — only a filled-in one is held to a shape.
    // Call-centre agents collect it on the confirmation call, so requiring it
    // would reject orders both this form and POST /public/leads accept.
    const trimmedAddress = form.address.trim();
    if (trimmedAddress && trimmedAddress.length < FIELD_LIMITS.addressMin) {
      newErrors.address = 'العنوان قصير جدا، يرجى كتابته كاملا';
    } else if (trimmedAddress.length > FIELD_LIMITS.addressMax) {
      newErrors.address = 'العنوان طويل جدا';
    }

    const cleanPhone = form.phone.replace(/\s+|-/g, '');
    const digitsOnly = form.phone.replace(/\D/g, '');
    const isMoroccanValid = /^(\+?212|0)[5-7]\d{8}$/.test(cleanPhone);
    const isGeneralValid = digitsOnly.length >= 9 && digitsOnly.length <= 14;

    if (!form.phone.trim()) {
      newErrors.phone = 'رقم الهاتف مطلوب *';
    } else if (!isMoroccanValid && !isGeneralValid) {
      newErrors.phone = 'رقم هاتف غير صحيح (مثال: 0612345678)';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstError = Object.values(newErrors)[0];
      toast.error(firstError);
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

      // Mark the abandoned-checkout attempt as converted.
      socket?.emit('checkout:complete', { code });

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

  const renderCheckoutForm = (blockContent: any = {}) => {
    const isRtl = /[\u0600-\u06FF]/.test(
      (blockContent.nameLabel || '') +
      (blockContent.title || '') +
      (blockContent.subtitle || '') +
      (blockContent.buttonText || '') +
      'الاسم الكامل'
    );

    return (
      <div 
        dir={isRtl ? "rtl" : "ltr"}
        className={`p-6 sm:p-7 relative ${isRtl ? 'text-right' : 'text-left'}`}
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
                  {blockContent.title || 'اطلب الآن'}
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
                  {blockContent.subtitle || 'املأ النموذج أدناه لحجز منتجك. الدفع عند الاستلام.'}
                </p>
              </div>

              {blockContent.options && blockContent.options.length > 0 && (
                <div className="mb-8 space-y-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-3 tracking-widest">
                    {isRtl ? 'اختر العرض المناسب' : 'Sélectionnez votre offre'}
                  </label>
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
                              className={`absolute -top-1 ${isRtl ? '-left-2' : '-right-2'} py-0.5 px-2 text-[7px] font-black text-white uppercase tracking-tighter rounded-full shadow-sm`}
                              style={{ backgroundColor: accentColor }}
                             >
                              {isRtl ? 'محدد' : 'Sélectionné'}
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
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">{blockContent.nameLabel || 'الاسم الكامل *'}</label>
                  <input
                    type="text"
                    required
                    maxLength={FIELD_LIMITS.nameMax}
                    autoComplete="name"
                    dir={isRtl ? "rtl" : "ltr"}
                    value={form.fullName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className={`w-full px-4 py-3.5 bg-gray-50 rounded-xl focus:bg-white focus:outline-none focus:ring-2 transition-all font-medium ${isRtl ? 'text-right' : 'text-left'} ${errors.fullName ? 'border-2 border-red-500 bg-red-50/20' : ''}`}
                    style={{ 
                      '--tw-ring-color': `${blockContent.themeColor || landingPage?.themeColor || '#f97316'}33`,
                      '--tw-focus-border-color': blockContent.themeColor || landingPage?.themeColor || '#f97316'
                    } as any}
                    onFocus={(e) => {
                      if (!errors.fullName) {
                        e.currentTarget.style.borderColor = blockContent.themeColor || landingPage?.themeColor || '#f97316';
                        e.currentTarget.style.boxShadow = `0 0 0 2px ${blockContent.themeColor || landingPage?.themeColor || '#f97316'}33`;
                      }
                    }}
                    onBlur={(e) => {
                      if (!errors.fullName) {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                    placeholder={blockContent.namePlaceholder || "مثال: يوسف بن جلون"}
                  />
                  {errors.fullName && <p className="text-xs text-red-500 font-bold mt-1.5">{errors.fullName}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">{blockContent.phoneLabel || 'رقم الهاتف *'}</label>
                  <input
                    type="tel"
                    required
                    maxLength={FIELD_LIMITS.phoneMax}
                    inputMode="tel"
                    autoComplete="tel"
                    dir="ltr"
                    value={form.phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className={`w-full px-4 py-3.5 bg-gray-50 rounded-xl focus:bg-white focus:outline-none focus:ring-2 transition-all font-medium ${isRtl ? 'text-right' : 'text-left'} ${errors.phone ? 'border-2 border-red-500 bg-red-50/20' : ''}`}
                    onFocus={(e) => {
                      if (!errors.phone) {
                        e.currentTarget.style.borderColor = blockContent.themeColor || landingPage?.themeColor || '#f97316';
                        e.currentTarget.style.boxShadow = `0 0 0 2px ${blockContent.themeColor || landingPage?.themeColor || '#f97316'}33`;
                      }
                    }}
                    onBlur={(e) => {
                      if (!errors.phone) {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                    placeholder={blockContent.phonePlaceholder || "06 XX XX XX XX"}
                  />
                  {errors.phone && <p className="text-xs text-red-500 font-bold mt-1.5">{errors.phone}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">{blockContent.cityLabel || 'المدينة *'}</label>
                  <input
                    type="text"
                    required
                    maxLength={FIELD_LIMITS.cityMax}
                    autoComplete="address-level2"
                    dir={isRtl ? "rtl" : "ltr"}
                    value={form.city}
                    onChange={(e) => handleCityChange(e.target.value)}
                    className={`w-full px-4 py-3.5 bg-gray-50 rounded-xl focus:bg-white focus:outline-none focus:ring-2 transition-all font-medium ${isRtl ? 'text-right' : 'text-left'} ${errors.city ? 'border-2 border-red-500 bg-red-50/20' : ''}`}
                    onFocus={(e) => {
                      if (!errors.city) {
                        e.currentTarget.style.borderColor = blockContent.themeColor || landingPage?.themeColor || '#f97316';
                        e.currentTarget.style.boxShadow = `0 0 0 2px ${blockContent.themeColor || landingPage?.themeColor || '#f97316'}33`;
                      }
                    }}
                    onBlur={(e) => {
                      if (!errors.city) {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                    placeholder={blockContent.cityPlaceholder || "مثال: الدار البيضاء"}
                  />
                  {errors.city && <p className="text-xs text-red-500 font-bold mt-1.5">{errors.city}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">{blockContent.addressLabel || 'العنوان (اختياري)'}</label>
                  <textarea
                    dir={isRtl ? "rtl" : "ltr"}
                    maxLength={FIELD_LIMITS.addressMax}
                    autoComplete="street-address"
                    value={form.address}
                    onChange={(e) => {
                      setForm({ ...form, address: e.target.value });
                      if (errors.address) setErrors(prev => ({ ...prev, address: undefined }));
                    }}
                    rows={2}
                    className={`w-full px-4 py-3.5 bg-gray-50 rounded-xl focus:bg-white focus:outline-none focus:ring-2 transition-all font-medium resize-none ${isRtl ? 'text-right' : 'text-left'}`}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = blockContent.themeColor || landingPage?.themeColor || '#f97316';
                      e.currentTarget.style.boxShadow = `0 0 0 2px ${blockContent.themeColor || landingPage?.themeColor || '#f97316'}33`;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    placeholder={blockContent.addressPlaceholder || "عنوانك الكامل لترهين التوصيل"}
                  />
                  {errors.address && <p className="text-xs text-red-500 font-bold mt-1.5">{errors.address}</p>}
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
                    جاري المعالجة...
                  </span>
                ) : (
                  blockContent.buttonText || landingPage?.buttonText || 'تأكيد الطلب'
                )}
              </button>
              
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-gray-400 mt-4">
                <ShieldCheck className="w-4 h-4" />
                معلوماتك آمنة ومحمية
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

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

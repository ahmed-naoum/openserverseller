import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BACKEND_URL, publicApi } from '../../../lib/api';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type BlockType = 'header' | 'hero' | 'image' | 'text' | 'button' | 'express_checkout' | 'spacer' | 'countdown' | 'whatsapp' | 'slider' | 'products' | 'audio' | 'video';

export interface EditorBlock {
  id: string;
  type: BlockType;
  content: any;
}

interface BlockRendererProps {
  blocks: EditorBlock[];
  renderCheckout?: (content: any) => React.ReactNode;
  isEditor?: boolean;
}

export default function BlockRenderer({ blocks, renderCheckout, isEditor = false }: BlockRendererProps) {
  const [isCheckoutInView, setIsCheckoutInView] = useState(false);

  useEffect(() => {
    if (isEditor) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsCheckoutInView(entry.isIntersecting);
      },
      { threshold: 0.01, rootMargin: '0px 0px -50px 0px' }
    );

    const checkout = document.getElementById('express-checkout-block');
    if (checkout) {
      observer.observe(checkout);
    }

    return () => observer.disconnect();
  }, [isEditor, blocks]);

  const resolveUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return `${BACKEND_URL}${url}`;
  };

  return (
    <div className="w-full flex flex-col">
      {blocks.map((block) => {
        const { id, type, content } = block;

        switch (type) {
          case 'header':
            return (
              <header 
                key={id} 
                className="w-full shadow-sm" 
                style={{ 
                  backgroundColor: content.bgColor || '#ffffff',
                  paddingTop: `${content.paddingTop ?? 16}px`,
                  paddingBottom: `${content.paddingBottom ?? 16}px`,
                  marginTop: `${content.marginTop ?? 0}px`,
                  marginBottom: `${content.marginBottom ?? 4}px`,
                }}
              >
                <div className="max-w-4xl mx-auto flex items-center justify-between px-6">
                  <h1 className="text-xl font-black" style={{ color: content.color || '#111827' }}>
                    {content.text || 'My Brand'}
                  </h1>
                </div>
              </header>
            );

          case 'hero':
            return (
              <div 
                key={id} 
                className="w-full px-6 text-center" 
                style={{ 
                  backgroundColor: content.bgColor || '#f9fafb',
                  paddingTop: `${content.paddingTop ?? 48}px`,
                  paddingBottom: `${content.paddingBottom ?? 48}px`,
                  marginTop: `${content.marginTop ?? 0}px`,
                  marginBottom: `${content.marginBottom ?? 24}px`,
                }}
              >
                <h2 className="text-4xl md:text-5xl font-black mb-4 leading-tight" style={{ color: content.titleColor || '#111827' }}>
                  {content.title || 'Headline goes here'}
                </h2>
                <p className="text-lg md:text-xl max-w-2xl mx-auto" style={{ color: content.subtitleColor || '#4b5563' }}>
                  {content.subtitle || 'Subheadline goes here to explain the offer.'}
                </p>
              </div>
            );

          case 'text':
            return (
              <div 
                key={id} 
                className="w-full max-w-4xl mx-auto px-6 flex flex-col" 
                style={{ 
                  textAlign: content.align || 'left',
                  justifyContent: 
                    (content.verticalAlign || 'center') === 'center' ? 'center' :
                    content.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start',
                  minHeight: (content.verticalAlign || 'center') !== 'top' ? '80px' : 'auto',
                  paddingTop: `${content.paddingTop ?? 16}px`,
                  paddingBottom: `${content.paddingBottom ?? 16}px`,
                  marginTop: `${content.marginTop ?? 0}px`,
                  marginBottom: `${content.marginBottom ?? 0}px`,
                }}
              >
                {content.isHeading ? (
                  <h3 className="text-2xl font-bold mb-2" style={{ color: content.color || '#111827' }}>{content.text || 'Section Heading'}</h3>
                ) : (
                  <p className="text-base leading-relaxed" style={{ color: content.color || '#374151', textAlign: content.align || 'left' }}>
                    {content.text || 'Add some descriptive text here to explain the product details and benefits.'}
                  </p>
                )}
              </div>
            );

          case 'image':
            return (
              <div 
                key={id} 
                className="w-full max-w-4xl mx-auto flex justify-center"
                style={{ 
                  paddingTop: `${content.paddingTop ?? 0}px`,
                  paddingBottom: `${content.paddingBottom ?? 0}px`,
                  marginTop: `${content.marginTop ?? 0}px`,
                  marginBottom: `${content.marginBottom ?? 0}px`,
                }}
              >
                {content.url ? (
                  <img 
                    src={resolveUrl(content.url)} 
                    alt="Block Content" 
                    className="h-auto w-full object-contain"
                    loading="eager"
                    // @ts-ignore
                    fetchpriority="high"
                    decoding="async"
                    style={{ 
                      width: content.width ? `${content.width}%` : '100%',
                      maxHeight: content.maxHeight ? `${content.maxHeight}px` : 'none',
                      minHeight: '200px' // Reduce CLS for images without strict heights
                    }}
                  />
                ) : (
                  <div className="w-full h-64 bg-gray-100 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200">
                    Image (Placeholder)
                  </div>
                )}
              </div>
            );

          case 'video':
            return (
              <div 
                key={id} 
                className="w-full max-w-4xl mx-auto flex justify-center"
                style={{ 
                  paddingTop: `${content.paddingTop ?? 16}px`,
                  paddingBottom: `${content.paddingBottom ?? 16}px`,
                  marginTop: `${content.marginTop ?? 0}px`,
                  marginBottom: `${content.marginBottom ?? 0}px`,
                }}
              >
                {content.url ? (
                  <VideoBlockComponent content={content} resolveUrl={resolveUrl} />
                ) : (
                  <div className="w-full h-64 bg-gray-100 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200">
                    <span className="text-3xl mb-2">🎬</span>
                    <span className="font-bold">Vidéo (Placeholder)</span>
                    <span className="text-xs mt-1">Téléchargez une vidéo dans les propriétés</span>
                  </div>
                )}
              </div>
            );

          case 'button':
            return <ButtonBlockComponent key={id} content={content} isEditor={isEditor} isCheckoutInView={isCheckoutInView} />;

          case 'whatsapp':
            if (isEditor) {
              return (
                <div key={id} className="w-full max-w-4xl mx-auto px-6 py-4">
                  <div className="bg-emerald-50 hover:bg-emerald-100/80 border-2 border-dashed border-emerald-300 rounded-3xl p-6 transition-all duration-300 flex items-center justify-between shadow-sm group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-200">
                        <svg className="w-7 h-7 fill-current text-white" viewBox="0 0 24 24">
                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.45L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.852.002-2.63-1.023-5.101-2.883-6.963C16.593 1.928 14.122.904 11.492.904 6.056.904 1.63 5.324 1.626 10.757c-.001 1.701.446 3.362 1.3 4.8l-.949 3.466 3.549-.931.131.078zm11.233-5.267c-.27-.135-1.597-.788-1.846-.878-.249-.09-.43-.135-.61.135-.18.27-.697.878-.854 1.058-.158.18-.316.202-.586.067-.27-.135-1.14-.42-2.172-1.341-.803-.715-1.344-1.602-1.502-1.872-.158-.27-.017-.417.118-.552.122-.122.27-.316.405-.473.135-.158.18-.27.27-.45.09-.18.045-.338-.022-.473-.068-.135-.61-1.472-.836-2.015-.22-.53-.442-.458-.61-.466-.157-.008-.338-.009-.52-.009-.18 0-.473.067-.72.338-.248.27-.947.923-.947 2.25s.968 2.613 1.103 2.793c.135.18 1.905 2.909 4.614 4.081.645.278 1.148.444 1.54.568.647.206 1.237.177 1.703.107.519-.078 1.597-.653 1.823-1.283.226-.63.226-1.17.158-1.283-.068-.112-.248-.18-.518-.315z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-extrabold text-emerald-950 text-sm flex items-center gap-1.5">
                          Widget Chat WhatsApp
                          <span className="text-[9px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Flottant</span>
                        </h4>
                        <p className="text-xs text-emerald-700/80 font-medium mt-0.5">
                          {content.phoneNumber ? `Destinataire : ${content.phoneNumber}` : "Aucun numéro configuré"}
                        </p>
                      </div>
                    </div>
                    <div className="text-[10px] text-emerald-600 font-bold bg-white px-3 py-1.5 rounded-xl border border-emerald-100 group-hover:border-emerald-300 transition-all select-none">
                      Paramètres dans la barre latérale droite
                    </div>
                  </div>
                </div>
              );
            }
            return null;

          case 'countdown':
            return (
              <div 
                key={id} 
                className="w-full flex justify-center"
                style={{ 
                  paddingTop: `${content.paddingTop ?? 24}px`,
                  paddingBottom: `${content.paddingBottom ?? 24}px`,
                  marginTop: `${content.marginTop ?? 0}px`,
                  marginBottom: `${content.marginBottom ?? 0}px`,
                }}
              >
                <div className="inline-flex items-center gap-3 bg-red-50 text-red-600 px-6 py-3 rounded-2xl border border-red-100 shadow-sm font-black text-xl">
                  <span>⏳</span>
                  <span>{content.text || "L'offre expire dans : 00:15:00"}</span>
                </div>
              </div>
            );

          case 'spacer':
            return (
              <div key={id} style={{ height: `${content.height || 32}px`, width: '100%' }} />
            );

          case 'products':
            return (
              <ProductsBlock key={id} content={content} resolveUrl={resolveUrl} />
            );

          case 'slider':
            return (
              <SliderBlock key={id} id={id} content={content} isEditor={isEditor} resolveUrl={resolveUrl} />
            );

          case 'audio':
            const audios = content.audios || [
              { id: 'default', title: content.title || '', url: content.url || '' }
            ];

            return (
              <div 
                key={id} 
                className="w-full max-w-6xl mx-auto px-6 flex flex-col items-center" 
                style={{ 
                  paddingTop: `${content.paddingTop ?? 16}px`,
                  paddingBottom: `${content.paddingBottom ?? 16}px`,
                  marginTop: `${content.marginTop ?? 0}px`,
                  marginBottom: `${content.marginBottom ?? 0}px`,
                }}
              >
                <div 
                  className={`grid grid-cols-1 gap-6 w-full ${
                    audios.length === 1 
                      ? 'max-w-md mx-auto grid-cols-1' 
                      : audios.length === 2 
                        ? 'max-w-3xl mx-auto md:grid-cols-2' 
                        : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                  }`}
                >
                  {audios.map((audio: any, idx: number) => (
                    <div 
                      key={audio.id || idx}
                      className="w-full bg-white rounded-2xl border border-gray-100 shadow-md p-5 flex flex-col gap-3 transition-all hover:shadow-lg"
                      style={{
                        backgroundColor: content.bgColor || '#ffffff',
                        borderColor: content.borderColor || '#f3f4f6',
                      }}
                    >
                      {audio.title ? (
                        <div className="text-xs font-black text-gray-500 uppercase tracking-widest text-center mb-1 truncate">
                          {audio.title}
                        </div>
                      ) : (
                        <div className="text-xs font-black text-gray-400 uppercase tracking-widest text-center mb-1 italic">
                          Audio {idx + 1}
                        </div>
                      )}
                      {audio.url ? (
                        <audio 
                          src={resolveUrl(audio.url)}
                          controls={content.controls !== false}
                          controlsList="nodownload"
                          autoPlay={!!content.autoplay && idx === 0}
                          loop={!!content.loop}
                          className="w-full accent-orange-500"
                        />
                      ) : (
                        <div className="w-full py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 gap-2">
                          <span className="text-2xl">🎵</span>
                          <span className="text-xs font-bold text-gray-500">Lecteur Audio — Aucun fichier</span>
                          <span className="text-[10px] text-gray-400">Téléchargez un audio dans les propriétés</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );

          case 'express_checkout':
            return (
              <div 
                key={id} 
                id="express-checkout-block"
                className="w-full max-w-2xl mx-auto relative z-[10001]"
                data-block-type="express_checkout"
                style={{ 
                  paddingTop: `${content.paddingTop ?? 32}px`,
                  paddingBottom: `${content.paddingBottom ?? 32}px`,
                  marginTop: `${content.marginTop ?? 0}px`,
                  marginBottom: `${content.marginBottom ?? 0}px`,
                  paddingLeft: `${content.paddingLeft ?? 16}px`,
                  paddingRight: `${content.paddingRight ?? 16}px`,
                  minHeight: '650px', // FIX: Reserve space for checkout to prevent massive Cumulative Layout Shift (CLS)
                }}
              >
                {renderCheckout ? (
                  renderCheckout(content)
                ) : (
                  <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-xl opacity-80 pointer-events-none h-full">
                    <h2 className="text-2xl font-black text-center mb-6">Commander Maintenant (Aperçu)</h2>
                    <div className="space-y-4">
                      <div className="h-12 bg-gray-50 rounded-xl border border-gray-200" />
                      <div className="h-12 bg-gray-50 rounded-xl border border-gray-200" />
                      <div className="h-12 bg-gray-50 rounded-xl border border-gray-200" />
                      <div className="h-14 bg-orange-500 rounded-xl mt-6" />
                    </div>
                  </div>
                )}
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}

// --------------- Products Block Component ---------------
interface ProductsBlockProps {
  content: any;
  resolveUrl: (url?: string) => string;
}

function ProductsBlock({ content, resolveUrl }: ProductsBlockProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const accountIds = content.accountIds || [];
  const layoutType = content.layoutType || 'grid'; // 'grid' | 'slider'
  const selectedProducts = content.selectedProducts || [];
  const gridCols = content.gridCols || 3;
  
  const cardBg = content.cardBg || '#ffffff';
  const cardRadius = content.cardRadius ?? 16;
  const cardShadow = content.cardShadow || 'md';
  const titleColor = content.titleColor || '#111827';
  const descColor = content.descColor || '#4b5563';
  const priceColor = content.priceColor || '#f97316';
  const btnBg = content.btnBg || '#f97316';
  const btnColor = content.btnColor || '#ffffff';
  
  const paddingTop = content.paddingTop ?? 32;
  const paddingBottom = content.paddingBottom ?? 32;
  const marginTop = content.marginTop ?? 0;
  const marginBottom = content.marginBottom ?? 0;

  useEffect(() => {
    if (accountIds.length === 0) {
      setProducts([]);
      return;
    }

    const fetchProducts = async () => {
      setLoading(true);
      try {
        const res = await publicApi.getProductsByAccounts(accountIds.join(','));
        const data = res.data.status === 'success' ? res.data.data.products : res.data.products || [];
        setProducts(data);
      } catch (err) {
        console.error('Failed to load products for ProductsBlock:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [JSON.stringify(accountIds)]);

  // Filter and sort products based on selectedProducts content config
  const displayedProducts = selectedProducts.length > 0
    ? products
        .filter(p => selectedProducts.some((sp: any) => sp.productId === p.id))
        .sort((a, b) => {
          const indexA = selectedProducts.findIndex((sp: any) => sp.productId === a.id);
          const indexB = selectedProducts.findIndex((sp: any) => sp.productId === b.id);
          return indexA - indexB;
        })
    : products;

  // Responsive cards per view for slider/carousel
  const [cardsPerView, setCardsPerView] = useState(3);
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setCardsPerView(1);
      } else if (window.innerWidth < 1024) {
        setCardsPerView(2);
      } else {
        setCardsPerView(Math.min(gridCols, 3));
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [gridCols]);

   const [currentIndex, setCurrentIndex] = useState(0);
  const maxIndex = Math.max(0, displayedProducts.length - cardsPerView);
  const [isHovered, setIsHovered] = useState(false);
  
  const slideStep = content.slideStep || 1;
  
  const next = () => setCurrentIndex(prev => {
    if (prev >= maxIndex) return 0;
    return Math.min(maxIndex, prev + slideStep);
  });
  
  const prev = () => setCurrentIndex(prev => {
    if (prev <= 0) return maxIndex;
    return Math.max(0, prev - slideStep);
  });

  // Autoplay auto scroll animation
  useEffect(() => {
    if (layoutType !== 'slider' || content.autoPlay === false || isHovered) return;
    const speed = content.autoPlaySpeed || 3500;
    const interval = setInterval(() => {
      setCurrentIndex(prev => {
        if (prev >= maxIndex) return 0;
        return Math.min(maxIndex, prev + slideStep);
      });
    }, speed);
    return () => clearInterval(interval);
  }, [layoutType, maxIndex, content.autoPlay, content.autoPlaySpeed, isHovered, slideStep]);

  const shadowClass = 
    cardShadow === 'sm' ? 'shadow-sm' :
    cardShadow === 'md' ? 'shadow-md' :
    cardShadow === 'lg' ? 'shadow-lg' :
    cardShadow === 'xl' ? 'shadow-xl' : 'shadow-none';

  const gridClass = 
    gridCols === 1 ? 'grid-cols-1' :
    gridCols === 2 ? 'grid-cols-1 sm:grid-cols-2' :
    gridCols === 3 ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3' :
    'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

  const handleButtonClick = (linkUrl: string, product: any) => {
    if (!linkUrl) return;
    if (linkUrl.startsWith('#')) {
      const targetId = linkUrl.replace('#', '');
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
      // Premium feature: Dispatch select-product custom event to auto-select option in checkout
      const event = new CustomEvent('select-product', { detail: { product } });
      window.dispatchEvent(event);
    } else {
      window.open(linkUrl, '_blank');
    }
  };

  const renderCardContent = (product: any) => {
    const primaryImage = product.images?.[0]?.imageUrl || '';
    const categoryName = product.categories?.[0]?.nameFr || product.categories?.[0]?.nameAr || '';
    
    // Find card button config
    const spConfig = selectedProducts.find((sp: any) => sp.productId === product.id);
    const btnLink = spConfig?.link || '#express-checkout-block';
    const btnText = spConfig?.buttonText || 'Commander';
    const cardBtnBg = spConfig?.btnBg || btnBg;
    const cardBtnColor = spConfig?.btnColor || btnColor;

    return (
      <div 
        className={`flex flex-col border border-gray-100 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg h-full ${shadowClass}`}
        style={{ 
          backgroundColor: cardBg,
          borderRadius: `${cardRadius}px`
        }}
      >
        <div className="relative h-48 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
          {primaryImage ? (
            <img 
              src={resolveUrl(primaryImage)} 
              alt={product.nameFr || product.nameEn} 
              className="w-full h-full object-contain p-2 transition-transform duration-500 hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="text-gray-300">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          {categoryName && (
            <span className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
              {categoryName}
            </span>
          )}
        </div>

        <div className="p-4 flex flex-col flex-1 justify-between">
          <div className="space-y-1">
            <h4 
              className="text-base font-black line-clamp-1"
              style={{ color: titleColor }}
            >
              {product.nameFr || product.nameEn || product.nameAr}
            </h4>
            <p 
              className="text-xs line-clamp-2 leading-relaxed"
              style={{ color: descColor }}
            >
              {product.description || "Aucune description disponible."}
            </p>
          </div>
          
          <div className="mt-4 pt-3 border-t border-gray-50">
            {content.showPrice !== false && (
              <div className="flex items-center justify-between">
                <span 
                  className="text-lg font-black"
                  style={{ color: priceColor }}
                >
                  {product.retailPriceMad || product.priceMad || 0} MAD
                </span>
              </div>
            )}
            
            <button
              onClick={() => handleButtonClick(btnLink, product)}
              className="w-full py-2.5 px-4 rounded-xl font-black text-xs text-center shadow transition-all mt-3 active:scale-98 cursor-pointer"
              style={{
                backgroundColor: cardBtnBg,
                color: cardBtnColor
              }}
            >
              {btnText}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      className="w-full max-w-6xl mx-auto px-4"
      style={{
        paddingTop: `${paddingTop}px`,
        paddingBottom: `${paddingBottom}px`,
        marginTop: `${marginTop}px`,
        marginBottom: `${marginBottom}px`
      }}
    >
      {loading ? (
        <div className={`grid ${layoutType === 'slider' ? 'grid-cols-3' : gridClass} gap-6`}>
          {Array.from({ length: layoutType === 'slider' ? cardsPerView : (gridCols * 2 || 6) }).map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-100 rounded-2xl overflow-hidden border border-gray-200" style={{ height: '380px' }}>
              <div className="bg-gray-200 h-48 w-full" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/4" />
                <div className="h-6 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-5/6" />
                <div className="h-10 bg-gray-200 rounded w-full mt-4" />
              </div>
            </div>
          ))}
        </div>
      ) : displayedProducts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <p className="text-sm text-gray-500 font-bold">Aucun produit disponible ou sélectionné.</p>
        </div>
      ) : layoutType === 'slider' ? (
        <div className="relative w-full" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
          {content.animationType === 'continuous' ? (
            <>
              <style>{`
                @keyframes sitebuilderMarquee {
                  0% { transform: translate3d(0, 0, 0); }
                  100% { transform: translate3d(-50%, 0, 0); }
                }
              `}</style>
              <div className="overflow-hidden w-full relative">
                <div 
                  className="flex py-2" 
                  style={{
                    gap: '16px',
                    width: 'max-content',
                    animation: `sitebuilderMarquee ${content.autoPlaySpeed || 15000}ms linear infinite`,
                    animationPlayState: isHovered ? 'paused' : 'running'
                  }}
                >
                  {[...displayedProducts, ...displayedProducts].map((product, idx) => (
                    <div 
                      key={`${product.id}-${idx}`} 
                      style={{
                        width: '280px',
                        flexShrink: 0,
                        minWidth: 0
                      }}
                    >
                      {renderCardContent(product)}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="overflow-hidden w-full relative">
                <div 
                  className="flex py-2" 
                  style={{
                    gap: '16px',
                    transform: `translate3d(calc(-${currentIndex} * (100% + 16px) / ${cardsPerView}), 0, 0)`,
                    transition: content.animationType === 'smooth'
                      ? 'transform 1000ms cubic-bezier(0.25, 1, 0.5, 1)'
                      : content.animationType === 'bounce'
                      ? 'transform 800ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                      : 'transform 500ms ease-in-out'
                  }}
                >
                  {displayedProducts.map((product) => (
                    <div 
                      key={product.id} 
                      style={{
                        flex: `0 0 calc(100% / ${cardsPerView} - ${(16 * (cardsPerView - 1)) / cardsPerView}px)`,
                        minWidth: 0
                      }}
                    >
                      {renderCardContent(product)}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Navigation controls */}
              {displayedProducts.length > cardsPerView && (
                <>
                  <button 
                    onClick={prev}
                    className="absolute left-[-16px] top-1/2 -translate-y-1/2 w-9 h-9 bg-white shadow-md border border-gray-100 rounded-full flex items-center justify-center text-gray-600 hover:scale-105 active:scale-95 transition-all z-10"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={next}
                    className="absolute right-[-16px] top-1/2 -translate-y-1/2 w-9 h-9 bg-white shadow-md border border-gray-100 rounded-full flex items-center justify-center text-gray-600 hover:scale-105 active:scale-95 transition-all z-10"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  
                  {/* Pagination Dots */}
                  <div className="flex items-center justify-center gap-1.5 mt-5">
                    {Array.from({ length: maxIndex + 1 }).map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentIndex(idx)}
                        className={`rounded-full transition-all duration-300 ${
                          idx === currentIndex
                            ? 'w-6 h-2 bg-orange-500'
                            : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'
                        }`}
                        style={idx === currentIndex ? { backgroundColor: btnBg } : {}}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      ) : (
        <div className={`grid ${gridClass} gap-6`}>
          {displayedProducts.map((product) => (
            <div key={product.id}>
              {renderCardContent(product)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// --------------- Slider Block Component ---------------
interface SliderBlockProps {
  id: string;
  content: any;
  isEditor: boolean;
  resolveUrl: (url?: string) => string;
}

function SliderBlock({ id, content, isEditor, resolveUrl }: SliderBlockProps) {
  const slides: any[] = content.slides || [];
  const total = slides.length;

  const autoPlay = content.autoPlay !== false;
  const autoPlaySpeed = content.autoPlaySpeed || 4000;
  const showArrows = content.showArrows !== false;
  const showDots = content.showDots !== false;
  const cardBg = content.cardBg || '#ffffff';
  const cardRadius = content.cardRadius ?? 20;
  const cardsPerView = content.cardsPerView || 1;
  const cardGap = content.cardGap ?? 16;
  const cardBorderWidth = content.cardBorderWidth ?? 0;
  const cardBorderColor = content.cardBorderColor || '#e5e7eb';
  const cardShadow = content.cardShadow ?? 'md';
  const textAlign = content.textAlign || 'left';
  const mediaHeight100 = content.mediaHeight100 === true;
  const mediaHeightStyle = mediaHeight100 ? '100%' : `${content.mediaHeight || 280}px`;

  // New features
  const autoplayMode = content.autoplayMode || 'slide'; // 'slide' | 'marquee'
  const slideBy = content.slideBy || 'card'; // 'card' | 'page'
  const marqueeSpeed = content.marqueeSpeed ?? 20; // seconds for full cycle
  const pauseOnHover = content.pauseOnHover !== false;

  // Premium Animations
  const hoverEffect = content.hoverEffect || 'none'; // 'lift' | 'scale' | 'glow' | 'grayscale' | 'none'
  const entranceAnimation = content.entranceAnimation || 'none'; // 'fade-up' | 'fade-in' | 'zoom-in' | 'none'
  const transitionEffect = content.transitionEffect || 'slide'; // 'slide' | 'fade' | 'zoom'

  const containerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (isEditor) {
      setIsInView(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        observer.disconnect();
      }
    }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isEditor]);

  // Compute pagination and start indices
  const startIndices: number[] = [];
  if (slideBy === 'page') {
    for (let i = 0; i < total; i += cardsPerView) {
      const idx = Math.min(i, Math.max(0, total - cardsPerView));
      if (!startIndices.includes(idx)) {
        startIndices.push(idx);
      }
    }
  } else {
    for (let i = 0; i <= total - cardsPerView; i++) {
      startIndices.push(i);
    }
  }

  if (startIndices.length === 0) {
    startIndices.push(0);
  }

  const [currentIndex, setCurrentIndex] = useState(0);
  const current = startIndices[currentIndex] ?? 0;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback((idx: number) => {
    setCurrentIndex(((idx % startIndices.length) + startIndices.length) % startIndices.length);
  }, [startIndices.length]);

  const next = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);
  const prev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);

  // Autoplay handler for standard sliding
  useEffect(() => {
    if (!autoPlay || autoplayMode !== 'slide' || startIndices.length <= 1 || isEditor) return;
    intervalRef.current = setInterval(next, autoPlaySpeed);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoPlay, autoplayMode, autoPlaySpeed, startIndices.length, next, isEditor]);


  if (total === 0) {
    return (
      <div
        key={id}
        className="w-full max-w-4xl mx-auto px-6 py-12"
        style={{
          paddingTop: `${content.paddingTop ?? 24}px`,
          paddingBottom: `${content.paddingBottom ?? 24}px`,
          marginTop: `${content.marginTop ?? 0}px`,
          marginBottom: `${content.marginBottom ?? 0}px`,
        }}
      >
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-12 flex flex-col items-center justify-center text-gray-400">
          <svg className="w-10 h-10 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
          </svg>
          <p className="font-bold text-sm">Slider — Aucune carte</p>
          <p className="text-xs mt-1">Ajoutez des cartes dans les propriétés</p>
        </div>
      </div>
    );
  }

  const renderMedia = (slide: any) => {
    const url = resolveUrl(slide.mediaUrl);
    if (!url) return null;

    const isVideo = /\.(mp4|webm|ogg)$/i.test(url);
    const fitClass = content.mediaFit === 'contain' ? 'object-contain' : 'object-cover';

    if (isVideo) {
      return (
        <video
          src={url}
          autoPlay
          loop
          muted
          playsInline
          className={`w-full h-full ${fitClass}`}
        />
      );
    }

    return (
      <img
        src={url}
        alt={slide.title || ''}
        className={`w-full h-full ${fitClass}`}
      />
    );
  };

  const shadowClass = cardShadow === 'none' ? '' : cardShadow === 'sm' ? 'shadow-sm' : cardShadow === 'lg' ? 'shadow-xl' : cardShadow === 'xl' ? 'shadow-2xl' : 'shadow-lg';

  const cardStyle = {
    backgroundColor: cardBg,
    borderRadius: `${cardRadius}px`,
    border: cardBorderWidth > 0 ? `${cardBorderWidth}px solid ${cardBorderColor}` : 'none',
  };

  const hoverClass = hoverEffect === 'lift' 
    ? 'hover-lift' 
    : hoverEffect === 'scale' 
      ? 'hover-scale' 
      : hoverEffect === 'glow' 
        ? 'hover-glow' 
        : hoverEffect === 'grayscale' 
          ? 'hover-grayscale' 
          : '';

  const animateClass = entranceAnimation !== 'none' ? `card-animate-${id}` : '';
  const isFadeMode = transitionEffect === 'fade' && cardsPerView === 1;

  // ---------------- Render Option A: Infinite Continuous Marquee ----------------
  if (autoplayMode === 'marquee') {
    // Duplicate slides 3 times for a seamless infinite loop scrolling experience
    const duplicatedSlides = [...slides, ...slides, ...slides];

    return (
      <div
        key={id}
        ref={containerRef}
        className={`w-full relative select-none overflow-hidden slider-container-${id} ${isInView ? 'in-view' : ''}`}
        style={{
          paddingTop: `${content.paddingTop ?? 24}px`,
          paddingBottom: `${content.paddingBottom ?? 24}px`,
          marginTop: `${content.marginTop ?? 0}px`,
          marginBottom: `${content.marginBottom ?? 0}px`,
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes marquee-${id} {
            0% { transform: translate3d(0, 0, 0); }
            100% { transform: translate3d(-33.3333%, 0, 0); }
          }
          .marquee-track-${id} {
            display: flex;
            width: max-content;
            gap: ${cardGap}px;
            animation: marquee-${id} ${marqueeSpeed}s linear infinite;
          }
          .marquee-track-${id}:hover {
            animation-play-state: ${pauseOnHover ? 'paused' : 'running'};
          }

          /* Entrance animations */
          @keyframes fadeUp-${id} {
            from { opacity: 0; transform: translate3d(0, 35px, 0); }
            to { opacity: 1; transform: translate3d(0, 0, 0); }
          }
          @keyframes fadeIn-${id} {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes zoomIn-${id} {
            from { opacity: 0; transform: scale3d(0.94, 0.94, 0.94); }
            to { opacity: 1; transform: scale3d(1, 1, 1); }
          }
          
          .card-animate-${id} {
            opacity: 1;
          }
          
          ${entranceAnimation !== 'none' ? `
            .slider-container-${id} .card-animate-${id} {
              opacity: 0;
            }
            .slider-container-${id}.in-view .card-animate-${id} {
              animation-name: ${entranceAnimation === 'fade-up' ? `fadeUp-${id}` : entranceAnimation === 'fade-in' ? `fadeIn-${id}` : `zoomIn-${id}`};
              animation-duration: 0.75s;
              animation-fill-mode: forwards;
              animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
            }
          ` : ''}

          /* Hover effect styles */
          .slider-card-${id} {
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .slider-card-${id}.hover-lift:hover {
            transform: translateY(-8px) translateZ(0);
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.05) !important;
          }
          .slider-card-${id}.hover-scale:hover {
            transform: scale(1.03) translateZ(0);
          }
          .slider-card-${id}.hover-glow:hover {
            box-shadow: 0 0 25px 3px ${content.dotColor || '#f97316'}66 !important;
          }
          .slider-card-${id}.hover-grayscale {
            filter: grayscale(85%);
          }
          .slider-card-${id}.hover-grayscale:hover {
            filter: grayscale(0%);
          }
        `}} />

        <div className="w-full px-4 sm:px-6 overflow-hidden">
          <div className={`marquee-track-${id}`}>
            {duplicatedSlides.map((slide, idx) => (
              <div
                key={idx}
                style={{
                  width: `calc((100vw - 32px) / ${cardsPerView} - ${(cardGap * (cardsPerView - 1)) / cardsPerView}px)`,
                  maxWidth: `calc(900px / ${cardsPerView} - ${(cardGap * (cardsPerView - 1)) / cardsPerView}px)`,
                  flexShrink: 0,
                }}
              >
                <div 
                  className={`slider-card-${id} ${hoverClass} ${animateClass} overflow-hidden ${shadowClass} h-full flex flex-col`} 
                  style={{
                    ...cardStyle,
                    animationDelay: entranceAnimation !== 'none' ? `${idx * 0.1}s` : undefined
                  }}
                >
                  {/* Media */}
                  {slide.mediaUrl && (
                    <div
                      className={`w-full bg-gray-100 overflow-hidden relative ${mediaHeight100 ? 'flex-1' : 'flex-shrink-0'}`}
                      style={{ height: mediaHeightStyle }}
                    >
                      {renderMedia(slide)}
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-5 flex-1 flex flex-col justify-center" style={{ textAlign: textAlign as any }}>
                    {slide.title && (
                      <h3
                        className={`font-black mb-1.5 leading-tight ${cardsPerView > 2 ? 'text-sm' : 'text-lg'}`}
                        style={{ color: content.titleColor || '#111827' }}
                      >
                        {slide.title}
                      </h3>
                    )}
                    {slide.description && (
                      <p
                        className={`leading-relaxed ${cardsPerView > 2 ? 'text-[11px]' : 'text-xs'}`}
                        style={{ color: content.descColor || '#6b7280' }}
                      >
                        {slide.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------------- Render Option B: Standard Sliding Page / Card Step ----------------
  return (
    <div
      key={id}
      ref={containerRef}
      className={`w-full max-w-4xl mx-auto relative select-none slider-container-${id} ${isInView ? 'in-view' : ''}`}
      style={{
        paddingTop: `${content.paddingTop ?? 24}px`,
        paddingBottom: `${content.paddingBottom ?? 24}px`,
        marginTop: `${content.marginTop ?? 0}px`,
        marginBottom: `${content.marginBottom ?? 0}px`,
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        /* Entrance animations */
        @keyframes fadeUp-${id} {
          from { opacity: 0; transform: translate3d(0, 35px, 0); }
          to { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        @keyframes fadeIn-${id} {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes zoomIn-${id} {
          from { opacity: 0; transform: scale3d(0.94, 0.94, 0.94); }
          to { opacity: 1; transform: scale3d(1, 1, 1); }
        }
        
        .card-animate-${id} {
          opacity: 1;
        }
        
        ${entranceAnimation !== 'none' ? `
          .slider-container-${id} .card-animate-${id} {
            opacity: 0;
          }
          .slider-container-${id}.in-view .card-animate-${id} {
            animation-name: ${entranceAnimation === 'fade-up' ? `fadeUp-${id}` : entranceAnimation === 'fade-in' ? `fadeIn-${id}` : `zoomIn-${id}`};
            animation-duration: 0.75s;
            animation-fill-mode: forwards;
            animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
          }
        ` : ''}

        /* Hover effect styles */
        .slider-card-${id} {
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .slider-card-${id}.hover-lift:hover {
          transform: translateY(-8px) translateZ(0);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.05) !important;
        }
        .slider-card-${id}.hover-scale:hover {
          transform: scale(1.03) translateZ(0);
        }
        .slider-card-${id}.hover-glow:hover {
          box-shadow: 0 0 25px 3px ${content.dotColor || '#f97316'}66 !important;
        }
        .slider-card-${id}.hover-grayscale {
          filter: grayscale(85%);
        }
        .slider-card-${id}.hover-grayscale:hover {
          filter: grayscale(0%);
        }
      `}} />

      {/* Slides Container */}
      <div className="overflow-hidden px-4 sm:px-6">
        <div
          className={isFadeMode ? "relative w-full" : "flex transition-transform duration-500 ease-in-out"}
          style={isFadeMode ? {
            position: 'relative',
            width: '100%',
          } : {
            gap: `${cardGap}px`,
            transform: `translate3d(calc(-${current} * (100% + ${cardGap}px) / ${cardsPerView}), 0, 0)`,
          }}
        >
          {slides.map((slide: any, idx: number) => {
            const isVisible = idx >= current && idx < current + cardsPerView;
            
            const itemStyle = isFadeMode ? {
              position: idx === current ? ('relative' as const) : ('absolute' as const),
              top: 0,
              left: 0,
              width: '100%',
              opacity: idx === current ? 1 : 0,
              transition: 'opacity 0.6s ease-in-out',
              pointerEvents: idx === current ? ('auto' as const) : ('none' as const),
              zIndex: idx === current ? 1 : 0,
              flexShrink: 0,
            } : {
              flex: `0 0 calc(100% / ${cardsPerView} - ${(cardGap * (cardsPerView - 1)) / cardsPerView}px)`,
              minWidth: 0,
              transform: transitionEffect === 'zoom' ? (isVisible ? 'scale(1)' : 'scale(0.93)') : undefined,
              opacity: transitionEffect === 'zoom' ? (isVisible ? 1 : 0.5) : undefined,
              transition: transitionEffect === 'zoom' ? 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)' : undefined,
            };

            return (
              <div key={idx} style={itemStyle}>
                <div 
                  className={`slider-card-${id} ${hoverClass} ${animateClass} overflow-hidden ${shadowClass} flex flex-col h-full`}
                  style={{
                    ...cardStyle,
                    animationDelay: entranceAnimation !== 'none' ? `${idx * 0.12}s` : undefined
                  }}
                >
                  {/* Media */}
                  {slide.mediaUrl && (
                    <div
                      className={`w-full bg-gray-100 overflow-hidden relative ${mediaHeight100 ? 'flex-1' : 'flex-shrink-0'}`}
                      style={{ height: mediaHeightStyle }}
                    >
                      {renderMedia(slide)}
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-5 sm:p-6 flex-1 flex flex-col justify-center" style={{ textAlign: textAlign as any }}>
                    {slide.title && (
                      <h3
                        className={`font-black mb-2 leading-tight ${cardsPerView > 2 ? 'text-base' : 'text-xl'}`}
                        style={{ color: content.titleColor || '#111827' }}
                      >
                        {slide.title}
                      </h3>
                    )}
                    {slide.description && (
                      <p
                        className={`leading-relaxed ${cardsPerView > 2 ? 'text-xs' : 'text-sm'}`}
                        style={{ color: content.descColor || '#6b7280' }}
                      >
                        {slide.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>


      {/* Navigation Arrows */}
      {showArrows && startIndices.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:bg-white hover:scale-110 transition-all z-10"
            style={{ pointerEvents: isEditor ? 'none' : 'auto' }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:bg-white hover:scale-110 transition-all z-10"
            style={{ pointerEvents: isEditor ? 'none' : 'auto' }}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Dot Indicators */}
      {showDots && startIndices.length > 1 && (
        <div className="flex items-center justify-center gap-2 mt-5">
          {startIndices.map((_: any, idx: number) => (
            <button
              key={idx}
              onClick={(e) => { e.stopPropagation(); goTo(idx); }}
              className={`rounded-full transition-all duration-300 ${
                idx === currentIndex
                  ? 'w-7 h-2.5'
                  : 'w-2.5 h-2.5 opacity-40 hover:opacity-70'
              }`}
              style={{
                backgroundColor: content.dotColor || '#f97316',
                pointerEvents: isEditor ? 'none' : 'auto',
              }}
            />
          ))}
        </div>
      )}

      {/* Page Counter */}
      {startIndices.length > 1 && (
        <div className="text-center mt-2">
          <span className="text-[10px] font-bold text-gray-400">{currentIndex + 1} / {startIndices.length}</span>
        </div>
      )}
    </div>
  );
}

// --------------- Video Block Component with custom play button in center ---------------
interface VideoBlockComponentProps {
  content: any;
  resolveUrl: (url?: string) => string;
}

function VideoBlockComponent({ content, resolveUrl }: VideoBlockComponentProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Browsers enforce muted for autoplay.
  // If autoplay is true, we force muted to true initially, otherwise fallback to content.muted
  const [isMuted, setIsMuted] = useState(!!content.autoplay || !!content.muted);
  
  // We show the unmute overlay only if autoplay is active and we are currently muted
  const [showUnmuteOverlay, setShowUnmuteOverlay] = useState(!!content.autoplay);

  useEffect(() => {
    setIsMuted(!!content.autoplay || !!content.muted);
    setShowUnmuteOverlay(!!content.autoplay);
  }, [content.autoplay, content.muted]);

  const handlePlayToggle = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(err => console.log("Play failed:", err));
    } else {
      videoRef.current.pause();
    }
  };

  const handleUnmute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = false;
      setIsMuted(false);
      setShowUnmuteOverlay(false);
      
      if (content.restartOnUnmute) {
        videoRef.current.currentTime = 0;
      }
      
      // Ensure it continues playing after user interaction
      videoRef.current.play().catch(err => console.log("Play failed after unmute:", err));
    }
  };

  return (
    <div 
      className="relative group overflow-hidden w-full flex justify-center" 
      style={{ 
        width: content.width ? `${content.width}%` : '100%',
        maxHeight: content.maxHeight ? `${content.maxHeight}px` : 'none',
      }}
    >
      <video 
        ref={videoRef}
        src={resolveUrl(content.url)} 
        controls={content.controls !== false && !showUnmuteOverlay}
        autoPlay={!!content.autoplay}
        loop={!!content.loop}
        muted={isMuted}
        playsInline
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onVolumeChange={(e) => {
          if (!e.currentTarget.muted) {
            setIsMuted(false);
            setShowUnmuteOverlay(false);
          }
        }}
        onTimeUpdate={(e) => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('video-time-update', { 
              detail: { currentTime: e.currentTarget.currentTime } 
            }));
          }
        }}
        className="h-auto w-full object-contain"
        style={{ 
          maxHeight: content.maxHeight ? `${content.maxHeight}px` : 'none',
        }}
      />

      {/* Unmute Overlay for Autoplay Videos */}
      {showUnmuteOverlay && isPlaying && (
        <div 
          onClick={handleUnmute}
          className="absolute inset-0 flex items-center justify-center bg-transparent cursor-pointer z-10"
        >
          <div 
            className="backdrop-blur-sm px-5 py-3 rounded-xl flex items-center justify-center gap-3 shadow-2xl transform hover:scale-105 transition-all"
            style={{
              backgroundColor: content.unmuteBtnColor || 'rgba(239, 68, 68, 0.95)',
              color: content.unmuteTextColor || '#ffffff'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <line x1="23" y1="9" x2="17" y2="15"></line>
              <line x1="17" y1="9" x2="23" y2="15"></line>
            </svg>
            <span 
              className="font-black" 
              dir="rtl"
              style={{ fontSize: content.unmuteTextSize ? `${content.unmuteTextSize}px` : '20px' }}
            >
              {content.unmuteText ?? 'برك باش تسمع الصوت'}
            </span>
          </div>
        </div>
      )}

      {/* Play button overlay when paused */}
      {!isPlaying && !showUnmuteOverlay && (
        <div 
          onClick={handlePlayToggle}
          className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer transition-opacity duration-300 hover:bg-black/35"
        >
          <div 
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center shadow-2xl transform transition-all duration-300 hover:scale-110 active:scale-95"
            style={{
              backgroundColor: 'rgba(249, 115, 22, 0.95)',
              border: '4px solid rgba(255, 255, 255, 0.8)',
            }}
          >
            <svg 
              className="w-8 h-8 sm:w-10 sm:h-10 text-white ml-1 fill-current" 
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

// --------------- Button Block Component ---------------
function ButtonBlockComponent({ content, isEditor, isCheckoutInView }: { content: any, isEditor: boolean, isCheckoutInView: boolean }) {
  const isStickyMobile = !!content.stickyMobile;
  const isStickyDesktop = !!content.stickyDesktop;

  const [isVisible, setIsVisible] = useState(() => {
    if (isEditor || !content.showAfterVideoSeconds || content.showAfterVideoSeconds <= 0) return true;
    return false;
  });

  useEffect(() => {
    if (isEditor || !content.showAfterVideoSeconds || content.showAfterVideoSeconds <= 0) {
      setIsVisible(true);
      return;
    }
    
    setIsVisible(false);

    const handleVideoTime = (e: any) => {
      if (e.detail.currentTime >= content.showAfterVideoSeconds) {
        setIsVisible(true);
      }
    };

    window.addEventListener('video-time-update', handleVideoTime);
    return () => window.removeEventListener('video-time-update', handleVideoTime);
  }, [isEditor, content.showAfterVideoSeconds]);

  const handleClick = () => {
    if (content.behavior === 'checkout') {
      const checkout = document.getElementById('express-checkout-block');
      if (checkout) {
        checkout.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (content.link) {
      window.open(content.link, '_blank');
    }
  };

  const animationProps = (() => {
    const timing = content.animationTiming || 'ease-in-out';
    switch (content.animationLayout) {
      case 'bounceHorizontal': return { animate: { x: [0, 12, 0] }, transition: { duration: 1.5, repeat: Infinity, ease: timing } };
      case 'bounceVertical': return { animate: { y: [0, -12, 0] }, transition: { duration: 1.5, repeat: Infinity, ease: timing } };
      case 'rotate': return { animate: { rotate: [0, 5, -5, 0] }, transition: { duration: 2, repeat: Infinity, ease: timing } };
      case 'scale': return { animate: { scale: [1, 1.05, 1] }, transition: { duration: 1.5, repeat: Infinity, ease: timing } };
      case 'fade': return { animate: { opacity: [0.6, 1, 0.6] }, transition: { duration: 2, repeat: Infinity, ease: timing } };
      case 'appear': return { initial: { opacity: 0, scale: 0.85 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.5, ease: timing } };
      default: return {};
    }
  })();

  if (!isVisible && !isEditor) return null;

  return (
    <div 
      className={`w-full flex justify-center transition-opacity duration-300 ${
        !isEditor && isStickyMobile 
          ? 'fixed bottom-4 left-0 right-0 px-4 z-[9999]' 
          : 'relative'
      } ${
        !isEditor && isStickyDesktop 
          ? 'md:!fixed md:!bottom-8 md:!right-8 md:!left-auto md:!w-auto md:!px-0' 
          : 'md:!relative md:!bottom-0'
      }`}
      style={{ 
        paddingTop: `${content.paddingTop ?? 24}px`,
        paddingBottom: `${content.paddingBottom ?? 24}px`,
        marginTop: `${content.marginTop ?? 0}px`,
        marginBottom: `${content.marginBottom ?? 0}px`,
        opacity: !isEditor && (isStickyMobile || isStickyDesktop) && isCheckoutInView ? 0 : 1,
        visibility: !isEditor && (isStickyMobile || isStickyDesktop) && isCheckoutInView ? 'hidden' : 'visible',
        pointerEvents: !isEditor && (isStickyMobile || isStickyDesktop) && isCheckoutInView ? 'none' : 'auto',
      }}
    >
      <motion.button 
        {...animationProps}
        className={`inline-flex items-center justify-center font-black shadow-xl transition-all cursor-pointer ${
          !isEditor && isStickyMobile ? 'w-full md:w-auto' : 'w-auto'
        }`}
        style={{ 
          backgroundColor: content.bgColor || '#f97316',
          color: content.textColor || '#ffffff',
          boxShadow: `0 10px 30px ${content.bgColor || '#f97316'}44`,
          fontSize: content.textSize ? `${content.textSize}px` : '20px',
          paddingTop: content.buttonPaddingY !== undefined && content.buttonPaddingY !== '' ? `${content.buttonPaddingY}px` : '16px',
          paddingBottom: content.buttonPaddingY !== undefined && content.buttonPaddingY !== '' ? `${content.buttonPaddingY}px` : '16px',
          paddingLeft: content.buttonPaddingX !== undefined && content.buttonPaddingX !== '' ? `${content.buttonPaddingX}px` : '40px',
          paddingRight: content.buttonPaddingX !== undefined && content.buttonPaddingX !== '' ? `${content.buttonPaddingX}px` : '40px',
          border: content.buttonBorderWidth !== undefined && content.buttonBorderWidth !== '' ? `${content.buttonBorderWidth}px solid ${content.buttonBorderColor || '#f97316'}` : 'none',
          borderRadius: content.buttonBorderRadius !== undefined && content.buttonBorderRadius !== '' ? `${content.buttonBorderRadius}px` : '16px',
        }}
        onClick={handleClick}
      >
        {content.text || 'Commander Maintenant'}
      </motion.button>
    </div>
  );
}



import React, { useState, useEffect } from 'react';
import { BACKEND_URL } from '../../../lib/api';
import { motion } from 'framer-motion';

export type BlockType = 'header' | 'hero' | 'image' | 'text' | 'button' | 'express_checkout' | 'spacer' | 'countdown' | 'whatsapp';

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
                    className="h-auto"
                    style={{ 
                      width: content.width ? `${content.width}%` : '100%',
                      maxHeight: content.maxHeight ? `${content.maxHeight}px` : 'none'
                    }}
                  />
                ) : (
                  <div className="w-full h-64 bg-gray-100 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200">
                    Image (Placeholder)
                  </div>
                )}
              </div>
            );

          case 'button':
            const isStickyMobile = !!content.stickyMobile;
            const isStickyDesktop = !!content.stickyDesktop;

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

            return (
              <div 
                key={id} 
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
                  className={`inline-flex items-center justify-center px-10 py-4 text-white font-black text-xl rounded-2xl shadow-xl transition-all cursor-pointer ${
                    !isEditor && isStickyMobile ? 'w-full md:w-auto' : 'w-auto'
                  }`}
                  style={{ 
                    backgroundColor: content.bgColor || '#f97316',
                    boxShadow: `0 10px 30px ${content.bgColor || '#f97316'}44`,
                  }}
                  onClick={handleClick}
                >
                  {content.text || 'Commander Maintenant'}
                </motion.button>
              </div>
            );

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
                }}
              >
                {renderCheckout ? (
                  renderCheckout(content)
                ) : (
                  <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-xl opacity-80 pointer-events-none">
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

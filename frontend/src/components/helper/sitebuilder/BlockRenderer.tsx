import React, { useState, useEffect } from 'react';
import { BACKEND_URL } from '../../../lib/api';
import { motion } from 'framer-motion';

export type BlockType = 'header' | 'hero' | 'image' | 'text' | 'button' | 'express_checkout' | 'spacer' | 'countdown';

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

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Send, X, MessageCircle, MessageSquare, Headset, Bot } from 'lucide-react';
import { publicApi } from '../../lib/api';

export interface WhatsAppWidgetSettings {
  enabled?: boolean;
  phoneNumber?: string;
  showOnDesktop?: boolean;
  showOnMobile?: boolean;
  iconColor?: string;
  iconStyle?: 'bubble' | 'pill';
  iconType?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  offsetX?: number;
  offsetY?: number;
  animation?: 'none' | 'pulse' | 'bounce' | 'shake' | 'rubberBand';
  badgeCount?: number;
  badgeMessage?: string;
  hoverText?: string;
  preSetMessage?: string;
  useWhatsappWebOnDesktop?: boolean;
  welcomeMessage?: string;
  openOnLoad?: boolean;
  headline?: string;
  subHeadline?: string;
  headerBg?: string;
  nickname?: string;
  profileImage?: string;
}

interface WhatsAppWidgetProps {
  settings?: WhatsAppWidgetSettings;
  isEditorPreview?: boolean;
}
export const IconRenderer = ({ type, className }: { type: string, className?: string }) => {
  switch (type) {
    case 'message-circle': return <MessageCircle className={className} />;
    case 'message-square': return <MessageSquare className={className} />;
    case 'headset': return <Headset className={className} />;
    case 'bot': return <Bot className={className} />;
    case 'whatsapp':
    default:
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      );
  }
};

export default function WhatsAppWidget({ settings, isEditorPreview = false }: WhatsAppWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [currentTime, setCurrentTime] = useState('12:00');
  const [dismissedBubble, setDismissedBubble] = useState(false);
  const { code } = useParams<{ code: string }>();

  const {
    enabled = false,
    phoneNumber = '',
    showOnDesktop = true,
    showOnMobile = true,
    iconColor = '#25D366',
    iconStyle = 'bubble',
    iconType = 'whatsapp',
    position = 'bottom-right',
    offsetX = 24,
    offsetY = 24,
    animation = 'none',
    badgeCount = 0,
    badgeMessage = '',
    hoverText = 'WhatsApp',
    preSetMessage = '',
    useWhatsappWebOnDesktop = true,
    welcomeMessage = 'How can I help you? 😊',
    openOnLoad = false,
    headline = "Let's chat on WhatsApp",
    subHeadline = "Répond généralement instantanément",
    headerBg = '#25D366',
    nickname = 'Nitso',
    profileImage = ''
  } = settings || {};

  // Don't render anything if disabled (and we aren't in editor preview mode)
  if (!enabled && !isEditorPreview) return null;

  // Track page load trigger to auto open
  useEffect(() => {
    if (openOnLoad && !isEditorPreview) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1500); // Open after 1.5 seconds
      return () => clearTimeout(timer);
    }
  }, [openOnLoad, isEditorPreview]);

  // Set the current time in HH:MM format for the message timestamp
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateTime();
  }, []);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phoneNumber?.replace(/\D/g, '');
    if (!cleanPhone) return;

    if (code) {
      publicApi.trackWhatsappClick(code).catch(err => console.error('Failed to track WhatsApp click:', err));
    }

    // Combine custom message with pre-set template
    const fullText = [preSetMessage, messageText].filter(Boolean).join('\n');
    const encodedText = encodeURIComponent(fullText);

    const isDesktop = typeof window !== 'undefined' && window.innerWidth > 768;
    const baseUrl = (isDesktop && useWhatsappWebOnDesktop)
      ? 'https://web.whatsapp.com/send'
      : 'https://wa.me';

    const url = `${baseUrl}/${cleanPhone}?text=${encodedText}`;
    window.open(url, '_blank');
    setMessageText('');
  };

  // Visibility and position classes based on settings
  const visibilityClass = isEditorPreview
    ? ''
    : `${showOnDesktop ? 'md:flex' : 'md:hidden'} ${showOnMobile ? 'flex' : 'hidden'}`;

  const isLeft = position === 'bottom-left' || position === 'top-left';
  const isTop = position === 'top-right' || position === 'top-left';

  const positionType = isEditorPreview ? 'absolute' : 'fixed';
  const zIndex = isEditorPreview ? 40 : 99999;

  const positionStyle: React.CSSProperties = {
    position: positionType as any,
    zIndex,
    ...(isTop ? { top: `${offsetY}px` } : { bottom: `${offsetY}px` }),
    ...(isLeft ? { left: `${offsetX}px` } : { right: `${offsetX}px` }),
  };

  const alignItems = isLeft ? 'items-start' : 'items-end';
  const panelOrigin = `origin-${isTop ? 'top' : 'bottom'}-${isLeft ? 'left' : 'right'}`;
  const flexDirection = isTop ? 'flex-col-reverse' : 'flex-col';

  return (
    <div style={positionStyle} className={`flex ${flexDirection} ${alignItems} font-sans selection:bg-emerald-100 ${visibilityClass}`}>
      
      {/* 1. Chat Widget Window Panel */}
      {isOpen && (
        <div className={`w-[340px] sm:w-[360px] bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden ${isTop ? 'mt-4' : 'mb-4'} transition-all duration-300 transform scale-100 ${panelOrigin}`}>
          
          {/* Header */}
          <div 
            className="p-4 text-white flex items-center justify-between shadow-md"
            style={{ backgroundColor: headerBg || '#25D366' }}
          >
            <div className="flex items-center gap-3">
              {/* WhatsApp Icon */}
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <IconRenderer type={iconType || 'whatsapp'} className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm leading-tight text-white">{headline}</h3>
                <span className="text-[10px] text-white/80 font-medium">{subHeadline}</span>
              </div>
            </div>
            {/* Collapse Arrow */}
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/10 rounded-full transition-colors text-white"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
              </svg>
            </button>
          </div>

          {/* Conversation Area (Subtle repeating background pattern style) */}
          <div 
            className="p-4 flex-1 min-h-[180px] max-h-[260px] overflow-y-auto space-y-4 relative"
            style={{
              backgroundColor: '#e5ddd5',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cg fill='%23b4a596' fill-opacity='0.15'%3E%3Cpath fill-rule='evenodd' d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm1-61c3.16 0 5.6-2.24 5.6-5.5S38.16 18 35 18s-5.6 2.24-5.6 5.5 2.44 5.5 5.6 5.5z'/%3E%3C/g%3E%3C/svg%3E")`
            }}
          >
            {/* Agent Message Container */}
            <div className="flex gap-2 items-start max-w-[85%]">
              {/* Agent Avatar */}
              {profileImage ? (
                <img 
                  src={profileImage} 
                  alt={nickname} 
                  className="w-8 h-8 rounded-full object-cover shadow-sm bg-white shrink-0 border border-gray-100" 
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-sm shrink-0 uppercase">
                  {nickname.charAt(0)}
                </div>
              )}
              {/* Chat Bubble */}
              <div className="bg-white rounded-2xl rounded-tl-none p-3 shadow-md border border-gray-100/50 flex flex-col relative">
                <span className="text-[10px] font-bold text-emerald-600 mb-0.5">{nickname}</span>
                <p className="text-xs text-gray-800 leading-relaxed break-words whitespace-pre-line pr-4">
                  {welcomeMessage}
                </p>
                <span className="text-[9px] text-gray-400 self-end mt-1">{currentTime}</span>
              </div>
            </div>
          </div>

          {/* Form Input Area */}
          <form onSubmit={handleSend} className="p-3 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
            <input 
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Écrivez votre message..."
              className="flex-1 bg-white border border-gray-200 rounded-full px-4 py-2 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium"
            />
            <button 
              type="submit"
              disabled={!phoneNumber}
              className="w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white flex items-center justify-center transition-all shadow-sm shrink-0 disabled:opacity-40 disabled:pointer-events-none"
              style={{ backgroundColor: iconColor }}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Animation Keyframes */}
      <style>{`
        @keyframes wa-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
        @keyframes wa-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes wa-shake { 0%, 100% { transform: rotate(0); } 20% { transform: rotate(-8deg); } 40% { transform: rotate(8deg); } 60% { transform: rotate(-4deg); } 80% { transform: rotate(4deg); } }
        @keyframes wa-rubber { 0% { transform: scaleX(1) scaleY(1); } 30% { transform: scaleX(1.15) scaleY(0.85); } 40% { transform: scaleX(0.85) scaleY(1.15); } 50% { transform: scaleX(1.05) scaleY(0.95); } 65% { transform: scaleX(0.98) scaleY(1.02); } 75% { transform: scaleX(1.02) scaleY(0.98); } 100% { transform: scaleX(1) scaleY(1); } }
        @keyframes wa-fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Notification Message Bubble */}
      {badgeMessage && !isOpen && !dismissedBubble && (
        <div className={`relative ${isTop ? 'mt-5' : 'mb-5'} flex ${isLeft ? 'justify-start' : 'justify-end'} w-full`}>
          <div 
            className="relative bg-white rounded-[24px] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-gray-100 px-6 py-4 max-w-[280px] cursor-default"
            style={{ animation: 'wa-fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            {/* Close Button (Overlapping Top-Right edge) */}
            <button
              onClick={() => setDismissedBubble(true)}
              className="absolute -top-2.5 -right-2.5 w-7 h-7 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors shadow-sm z-10"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            
            {/* Message Text */}
            <p className="text-[15px] font-bold text-gray-800 leading-snug" dir="auto">{badgeMessage}</p>
            
            {/* Speech Bubble Tail */}
            <div 
              className={`absolute ${isTop ? '-top-2 border-l border-t' : '-bottom-2.5 border-r border-b'} border-gray-100 ${isLeft ? 'left-6' : 'right-8'} w-5 h-5 bg-white rotate-45 transform origin-center shadow-sm z-[-1]`}
            />
          </div>
        </div>
      )}

      {/* 2. Floating Action Button / Pill */}
      {iconStyle === 'pill' && !isOpen ? (
        <div className="relative">
          <button 
            onClick={() => setIsOpen(true)}
            title={hoverText}
            className="flex items-center gap-2 px-5 py-3 text-white rounded-full font-bold text-sm shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-0.5 active:scale-95"
            style={{ 
              backgroundColor: iconColor,
              boxShadow: `0 10px 25px ${iconColor}44`,
              animation: animation !== 'none' ? `wa-${animation === 'rubberBand' ? 'rubber' : animation} ${animation === 'shake' ? '0.6s' : '2s'} ease-in-out infinite` : undefined
            }}
          >
            <IconRenderer type={iconType || 'whatsapp'} className="w-5 h-5 text-white" />
            <span>{hoverText || 'Chat on WhatsApp'}</span>
          </button>
          {!!badgeCount && badgeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 flex items-center justify-center bg-red-500 text-white text-[10px] font-black rounded-full px-1 shadow-lg border-2 border-white">
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          )}
        </div>
      ) : (
        <div className="relative">
          <button 
            onClick={() => setIsOpen(!isOpen)}
            title={hoverText}
            className="w-14 h-14 rounded-full text-white flex items-center justify-center shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-0.5 active:scale-95 shrink-0"
            style={{ 
              backgroundColor: iconColor,
              boxShadow: `0 10px 25px ${iconColor}44`,
              animation: !isOpen && animation !== 'none' ? `wa-${animation === 'rubberBand' ? 'rubber' : animation} ${animation === 'shake' ? '0.6s' : '2s'} ease-in-out infinite` : undefined
            }}
          >
            {isOpen ? (
              <X className="w-7 h-7" />
            ) : (
              <IconRenderer type={iconType || 'whatsapp'} className="w-8 h-8 text-white" />
            )}
          </button>
          {!!badgeCount && badgeCount > 0 && !isOpen && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center bg-red-500 text-white text-[10px] font-black rounded-full px-1 shadow-lg border-2 border-white">
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          )}
        </div>
      )}

    </div>
  );
}

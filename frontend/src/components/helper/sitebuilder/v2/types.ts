import { BlockType, EditorBlock } from '../BlockRenderer';

export type { BlockType, EditorBlock };

export type ViewportMode = 'desktop' | 'tablet' | 'mobile';

export interface PageSettings {
  backgroundColor?: string;
  fontFamily?: string;
  maxWidth?: number;
  whatsappWidget?: {
    enabled?: boolean;
    phoneNumber?: string;
    showOnDesktop?: boolean;
    showOnMobile?: boolean;
    iconColor?: string;
    iconStyle?: 'bubble' | 'pill';
    iconType?: 'whatsapp' | 'message-circle' | 'message-square' | 'headset' | 'bot';
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    offsetX?: number;
    offsetY?: number;
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
    animation?: 'none' | 'pulse' | 'bounce' | 'shake' | 'rubberBand';
    badgeCount?: number;
    badgeMessage?: string;
  };
  cloaking?: {
    enabled?: boolean;
    redirectDesktop?: boolean;
    desktopRedirectUrl?: string;
    filterBots?: boolean;
    botRedirectUrl?: string;
    selectedUserAgents?: string[];
    filterDirect?: boolean;
    directRedirectUrl?: string;
    filterLanguage?: boolean;
    allowedLanguages?: string;
    languageRedirectUrl?: string;
    filterCountry?: boolean;
    countryRedirectUrl?: string;
    selectedCountries?: string[];
    allowedCountries?: string;
    filterVpn?: boolean;
    vpnRedirectUrl?: string;
    detectExtensionVpn?: boolean;
    filterIpv6?: boolean;
    ipv6RedirectUrl?: string;
    filterIpRange?: boolean;
    blockedIpRanges?: string;
    ipRangeRedirectUrl?: string;
    filterDns?: boolean;
    dnsRedirectUrl?: string;
    selectedDns?: string[];
    blockedDns?: string;
  };
}

export interface BuilderTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  badge?: string;
  icon: string;
  previewGradient: string;
  blocks: EditorBlock[];
  settings: PageSettings;
}

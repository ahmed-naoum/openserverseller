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
    desktopMode?: string;
    desktopAlternateCode?: string;
    desktopRedirectUrl?: string;
    filterBots?: boolean;
    botMode?: string;
    botsMode?: string;
    botRedirectUrl?: string;
    botAlternateCode?: string;
    botsAlternateCode?: string;
    selectedUserAgents?: string[];
    filterDirect?: boolean;
    directMode?: string;
    directAlternateCode?: string;
    directRedirectUrl?: string;
    filterSource?: boolean;
    sourceMode?: string;
    sourceAlternateCode?: string;
    sourceRedirectUrl?: string;
    allowedSources?: string;
    allowedSourceDomains?: string;
    sourceMaxUses?: number;
    filterLanguage?: boolean;
    languageMode?: string;
    languageAlternateCode?: string;
    allowedLanguages?: string;
    languageRedirectUrl?: string;
    filterCountry?: boolean;
    countryMode?: string;
    countryAlternateCode?: string;
    countryRedirectUrl?: string;
    selectedCountries?: string[];
    allowedCountries?: string;
    filterVpn?: boolean;
    vpnMode?: string;
    vpnAlternateCode?: string;
    vpnRedirectUrl?: string;
    detectExtensionVpn?: boolean;
    filterIpv6?: boolean;
    ipv6Mode?: string;
    ipv6AlternateCode?: string;
    ipv6RedirectUrl?: string;
    filterIpRange?: boolean;
    ipRangeMode?: string;
    ipRangeAlternateCode?: string;
    blockedIpRanges?: string;
    ipRangeRedirectUrl?: string;
    filterDns?: boolean;
    dnsMode?: string;
    dnsAlternateCode?: string;
    dnsRedirectUrl?: string;
    selectedDns?: string[];
    blockedDns?: string;
    disableRightClick?: boolean;
    /**
     * DevTools redirect trap. Undefined on pages saved before it was split out
     * of disableRightClick, and inherits that flag's value in the renderers so
     * their behaviour does not change.
     */
    blockDevTools?: boolean;
    protectVideos?: boolean;
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

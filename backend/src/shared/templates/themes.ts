import type { PageDocument, SectionNode } from '../document/types.js';
import { asset, assetsOf, type AssetKey } from './assets.js';
import { KITS } from './kits.js';
import {
  lookFor, bakeTokens, pics, headerPage, footerPage, productPage, cataloguePage,
  heroSection, uspSection, productsSection, statsSection, promoSection, stepsSection,
  testimonialsSection, faqSection, storySection, countdownSection, ctaSection, whatsappSection,
  featureSection, quoteSection, chipsSection, gallerySection, dataCardsSection,
  type Look, type Slide, type Quote, type Faq, type PaletteLike,
} from './compose.js';

/**
 * Store themes: twelve complete stores a seller installs in one click.
 *
 * A theme is not a colour scheme. It is the brand values (palette, font)
 * PLUS a page for each of the five surfaces every store has — home, header,
 * footer, the product template, the catalogue template — and each home is a
 * whole store front: an accroche, the trust points, the catalogue, a
 * promotion, how ordering works, the reviews, the questions, a closing call
 * to action, and the WhatsApp bubble. No two themes arrange those the same
 * way, so two stores on two themes are two different sites, not one site
 * painted twice.
 *
 * Every colour a block carries is a token where the brand should show
 * through (`$primary`, `$secondary`, `$bg`, `$text`, `$muted`) and a literal
 * only where the design needs a fixed value. A seller who installs a theme
 * and then changes one brand colour in settings recolours the whole store —
 * which is the point of tokens, and why installing writes the brand values.
 *
 * The arrangements themselves live in compose.ts, shared with the OpenDesign
 * engine, so a generated design and a shipped theme are made of the same
 * parts.
 */

export interface ThemePalette extends PaletteLike {
  accent?: string;
}

export interface StoreTheme {
  id: string;
  label: { fr: string; en: string };
  description: { fr: string; en: string };
  audience: { fr: string; en: string };
  category?: 'all' | 'tech' | 'luxury' | 'energy' | 'food' | 'fashion' | 'beauty' | 'office';
  tags?: string[];
  badge?: string;
  rating?: number;
  downloads?: number;
  previewImage?: string;
  palette: ThemePalette;
  fontFamily: string;
  /** What the home page is made of, for the gallery card. */
  sections: string[];
  /** The photographs this theme ships with, by key. Empty until generated. */
  assets: Partial<Record<AssetKey, string>>;
  /** The style kit: how the theme is drawn (kits.ts). */
  kit: string;
  pages: {
    home: PageDocument;
    header: PageDocument;
    footer: PageDocument;
    product: PageDocument;
    catalogue: PageDocument;
  };
}

// ─────────────────────────────────────────────── shared copy and helpers

/** Copy every store shares, in the register of a Moroccan cash-on-delivery shop. */
export const COD_USP: Slide[] = [
  { title: '🚚 Livraison 24/48h', description: 'Expédié le jour même vers toutes les villes du Royaume.' },
  { title: '💵 Paiement à la réception', description: 'Aucun paiement en ligne : vous payez le livreur, en espèces.' },
  { title: '🔁 Échange sous 7 jours', description: 'Un produit abîmé ou non conforme est repris sans frais.' },
  { title: '💬 Support WhatsApp 7j/7', description: 'Une vraie personne répond à vos questions, tous les jours.' },
];

export const COD_STEPS: Slide[] = [
  { title: '1 · Choisissez', description: 'Parcourez la boutique et ouvrez la fiche du produit qui vous plaît.' },
  { title: '2 · Commandez', description: 'Nom, téléphone, ville : trente secondes suffisent, sans compte.' },
  { title: '3 · Confirmez', description: 'Notre équipe vous appelle pour valider l’adresse et l’heure.' },
  { title: '4 · Recevez', description: 'Le livreur passe sous 24 à 48h. Vous payez à la réception.' },
];

export const COD_FAQ: Faq[] = [
  { q: 'Comment payer ma commande ?', a: 'À la livraison, en espèces, directement au livreur. Aucun paiement en ligne n’est demandé.' },
  { q: 'Combien coûte la livraison ?', a: 'Elle est offerte sur la plupart de nos produits. Le montant exact s’affiche avant de confirmer.' },
  { q: 'Quels sont les délais ?', a: '24h pour Casablanca et Rabat, 48h pour les autres villes, un peu plus pour les zones rurales.' },
  { q: 'Puis-je échanger un article ?', a: 'Oui, sous 7 jours, s’il est abîmé ou non conforme. Écrivez-nous sur WhatsApp avec votre numéro de commande.' },
];

const homePage = (p: ThemePalette, root: (SectionNode | null)[]): PageDocument => ({
  version: 3, kind: 'home', settings: { maxWidth: 1600, backgroundColor: p.bg }, root: root.filter((x): x is SectionNode => Boolean(x)),
});

/** The same document with the page ground set, so a dark theme is dark to the edges. */
const grounded = (doc: PageDocument, p: ThemePalette): PageDocument => ({
  ...doc, settings: { ...doc.settings, backgroundColor: p.bg },
});

interface AfterOptions {
  usp: Slide[];
  quotes: Quote[];
  faqs: Faq[];
  related?: string;
  countdown?: string;
  uspVariant?: 'cards' | 'marquee' | 'plain';
  testimonialVariant?: 'carousel' | 'grid';
  band?: string;
  cta?: { title: string; subtitle: string; cta: string; ctaBg?: string; ctaColor?: string; background?: string; titleColor?: string };
  relatedCols?: number;
  cardBg?: string;
  btnColor?: string;
}

/** The sections a product page gets under the detail block, in the order that sells. */
export function productAfter(look: Look, o: AfterOptions): SectionNode[] {
  const out: SectionNode[] = [];
  if (o.countdown) out.push(countdownSection('p-cd', o.countdown));
  out.push(uspSection('p-usp', look, o.usp, { variant: o.uspVariant ?? 'cards', background: o.band }));
  out.push(productsSection('p-rel', look, { title: o.related ?? 'Vous aimerez aussi', layout: 'slider', cols: o.relatedCols ?? 3, bind: '$catalogue', cardBg: o.cardBg, btnColor: o.btnColor }));
  out.push(testimonialsSection('p-rev', look, o.quotes, { title: 'Ils l’ont commandé', variant: o.testimonialVariant ?? 'carousel', background: o.band }));
  out.push(faqSection('p-faq', look, o.faqs, { title: 'Avant de commander' }));
  if (o.cta) out.push(ctaSection('p-cta', look, { title: o.cta.title, subtitle: o.cta.subtitle, cta: o.cta.cta, ctaBg: o.cta.ctaBg, ctaColor: o.cta.ctaColor, background: o.cta.background, titleColor: o.cta.titleColor }));
  return out;
}

export function catalogueAfter(look: Look, o: { usp: Slide[]; variant?: 'cards' | 'marquee' | 'plain'; band?: string; cta?: AfterOptions['cta'] }): SectionNode[] {
  const out: SectionNode[] = [uspSection('c-usp', look, o.usp, { variant: o.variant ?? 'marquee', background: o.band })];
  if (o.cta) out.push(ctaSection('c-cta', look, { title: o.cta.title, subtitle: o.cta.subtitle, cta: o.cta.cta, ctaLink: '/', ctaBg: o.cta.ctaBg, ctaColor: o.cta.ctaColor, background: o.cta.background, titleColor: o.cta.titleColor }));
  return out;
}

const sectionLabels = (home: PageDocument): string[] =>
  home.root.map((s) => s.label ?? s.id).filter((l) => l !== 'WhatsApp');

/** The three highlight pictures of a theme, in card order. */
const trio = (id: string) => [asset(id, 'h1'), asset(id, 'h2'), asset(id, 'h3')];

function theme(spec: Omit<StoreTheme, 'sections' | 'assets'>): StoreTheme {
  const p = spec.palette;
  return {
    ...spec,
    sections: sectionLabels(spec.pages.home),
    assets: assetsOf(spec.id),
    pages: {
      home: bakeTokens(spec.pages.home, p),
      header: bakeTokens(spec.pages.header, p),
      footer: bakeTokens(spec.pages.footer, p),
      product: bakeTokens(grounded(spec.pages.product, p), p),
      catalogue: bakeTokens(grounded(spec.pages.catalogue, p), p),
    },
  };
}

// ═══════════════════════════════════════════════════════════════ 1. NovaTrade Cyber — dark tech

const novaPalette: ThemePalette = { primary: '#06b6d4', secondary: '#090d16', bg: '#060910', text: '#f8fafc', muted: '#94a3b8', accent: '#a855f7' };
const nova = lookFor(novaPalette, { kit: KITS.tech, card: '#0e1422', cardBorder: 'rgba(6,182,212,0.18)', band: '#090d16', radius: 12, shadow: 'none' });
const novaUsp: Slide[] = [
  { title: '⚡ Expédition sous 24h', description: 'Stock réel à Casablanca. Commande avant 15h, colis parti le jour même.' },
  { title: '🛡️ Garantie 12 mois', description: 'Chaque appareil est testé avant envoi et couvert un an, pièces incluses.' },
  { title: '💵 Paiement à la réception', description: 'Vérifiez le produit devant le livreur avant de payer.' },
  { title: '🎧 Support technique', description: 'Installation, configuration, mise à jour : on vous guide sur WhatsApp.' },
];
const novaQuotes: Quote[] = [
  { name: 'Yassine B.', city: 'Casablanca', text: 'Commandé un mardi soir, reçu le mercredi midi. Le casque est authentique, scellé, avec la garantie.' },
  { name: 'Salma E.', city: 'Rabat', text: 'Le support m’a aidée à configurer ma montre connectée en dix minutes sur WhatsApp. Sérieux.' },
  { name: 'Omar T.', city: 'Marrakech', text: 'Prix plus bas qu’en magasin et livraison gratuite. J’ai payé à la réception, sans stress.' },
];
const novaFaq: Faq[] = [
  { q: 'Les produits sont-ils authentiques ?', a: 'Oui. Nous achetons auprès de distributeurs officiels et chaque appareil garde son scellé d’origine.' },
  { q: 'Que couvre la garantie ?', a: 'Tout défaut de fabrication pendant 12 mois : échange ou réparation, frais de transport inclus.' },
  COD_FAQ[0],
  COD_FAQ[2],
];

const NOVATRADE = theme({
  id: 'novatrade',
  label: { fr: 'Nova Électro', en: 'Nova Electro' },
  description: { fr: 'Futuriste et haute précision : fond nuit, néon cyan et violet, chiffres clés, catalogue 4 colonnes, vente flash et FAQ technique.', en: 'Futuristic and precise: night ground, cyan and violet neon, key figures, four-column catalogue, flash sale and technical FAQ.' },
  audience: { fr: 'Gadgets high-tech, électronique, montres connectées, accessoires gaming', en: 'High-tech gadgets, electronics, smartwatches, gaming accessories' },
  category: 'tech',
  tags: ['Dark Mode', 'Futuriste', 'Néon', 'Vente flash'],
  badge: 'Tendance',
  rating: 4.96,
  downloads: 1420,
  previewImage: '/images/themes/theme_novatrade.jpg',
  palette: novaPalette,
  fontFamily: 'Space Grotesk',
  kit: 'tech',
  pages: {
    header: headerPage(nova, { announcement: '⚡ Nouveautés Tech 2026 — Expédition sous 24h & paiement à la réception', announcementColor: '#081325', bg: '$secondary', border: 'rgba(255,255,255,0.08)', cartBg: '#0e1422', cta: 'Commander', ctaColor: '#081325', ctaRadius: 999, secondary: 'Suivre ma commande', secondaryUrl: '/pages/suivi' }),
    footer: footerPage(nova, { bg: '#030509', text: '$text', border: 'rgba(255,255,255,0.06)', about: 'Le matériel le plus avancé, testé et garanti, livré partout au Maroc. Vous payez à la réception.', badges: ['Produits authentiques', 'Garantie 12 mois', 'Paiement à la livraison'] }),
    home: homePage(novaPalette, [
      heroSection('hero', nova, {
        variant: 'stacked', align: 'center', size: '2xl', uppercase: true, kicker: 'NOUVELLE GÉNÉRATION 2026', kickerStyle: 'pill',
        title: 'Élevez votre expérience tech', highlight: 'expérience tech',
        subtitle: 'Écouteurs, montres, drones, accessoires gaming : le meilleur de la tech, expédié sous 24h et payé à la réception.',
        cta: 'EXPLORER LA GAMME', secondaryCta: 'Voir les promotions', ctaColor: '#04101e', ctaRadius: 999,
        highlights: pics([
          { title: '⚡ Stock en direct', description: 'Ce que vous voyez est en stock à Casablanca, expédié le jour même.' },
          { title: '📈 Garantie 12 mois', description: 'Chaque appareil est testé, scellé et couvert un an.' },
          { title: '🛒 Commander en 30 s', description: 'Nom, téléphone, ville. Vous payez à la réception.' },
        ], trio('novatrade')),
        image: asset('novatrade', 'hero'),
        background: 'linear-gradient(180deg,#0b1224 0%,#060910 55%,#0a0f1e 100%)', paddingTop: 88, paddingBottom: 64, maxWidth: 1200,
      }),
      dataCardsSection('data', nova, [
        { badge: 'Stock en direct', title: 'Ce que vous voyez est en stock', rows: [{ label: 'Casablanca', value: 'le jour même' }, { label: 'Autres villes', value: '24 à 48h' }] },
        { badge: 'Garantie', title: '12 mois, pièces incluses', rows: [{ label: 'Défaut', value: 'échange' }, { label: 'Transport', value: 'offert' }], progress: { label: 'Satisfaction', value: '4.9 / 5', pct: 96 } },
        { badge: 'Commander', title: 'En 30 secondes', subtitle: 'Nom, téléphone, ville. Vous payez à la réception.', cta: 'COMMANDER' },
      ], { background: '#0b1020', dark: true }),
      statsSection('stats', nova, [{ value: '+15 000', label: 'commandes livrées' }, { value: '24h', label: 'délai moyen d’expédition' }, { value: '4.9/5', label: 'note moyenne de nos clients' }], { background: '$bg' }),
      uspSection('usp', nova, novaUsp, { variant: 'marquee', background: '$bg' }),
      productsSection('catalogue', nova, { title: 'Dispositifs & matériel de pointe', subtitle: 'Le stock du moment. Tout est authentique, scellé et garanti.', big: true, cols: 4, btnColor: '#061322', ctaText: 'VOIR TOUT LE CATALOGUE' }),
      promoSection('promo', nova, { image: asset('novatrade', 'promo'), variant: 'split', title: 'Vente flash : jusqu’à -40 % sur les écouteurs', subtitle: 'Stock limité, prix bloqués jusqu’à ce soir minuit.', countdown: '⚡ L’offre expire dans quelques heures', cta: 'J’EN PROFITE', ctaColor: '#04101e', background: '#0b1526', titleColor: '$text', subtitleColor: '$muted', radius: 24 }),
      stepsSection('steps', nova, COD_STEPS, { title: 'Commander prend trente secondes', subtitle: 'Pas de compte, pas de carte bancaire.' }),
      testimonialsSection('reviews', nova, novaQuotes, { title: 'Ce que disent nos clients', variant: 'grid', background: '#090d16' }),
      faqSection('faq', nova, novaFaq, { title: 'Questions fréquentes' }),
      ctaSection('cta', nova, { title: 'Prêt à passer au niveau supérieur ?', subtitle: 'Commandez maintenant, recevez sous 24h, payez à la réception.', cta: 'COMMANDER MAINTENANT', ctaBg: '$primary', ctaColor: '#04101e', background: '#0b1526', titleColor: '$text', subtitleColor: '$muted' }),
      whatsappSection('wa', { headline: 'Support expert 24/7', nickname: 'Nova Électro' }),
    ]),
    product: productPage(nova, { buyNowText: 'Commander — paiement à la réception', buttonColor: '#061322' }, productAfter(nova, { usp: novaUsp, quotes: novaQuotes, faqs: novaFaq, countdown: '⚡ Plus que quelques exemplaires en stock pour votre ville', related: 'Compléter votre équipement', testimonialVariant: 'grid', band: '#090d16', btnColor: '#061322' })),
    catalogue: cataloguePage(nova, { title: 'Matériel high-tech', subtitle: 'Authentique, scellé, garanti 12 mois. Livraison offerte dès 500 DH.', cols: 4, btnColor: '#061322' }, catalogueAfter(nova, { usp: novaUsp, band: '#090d16' })),
  },
});

// ═══════════════════════════════════════════════════════════════ 2. Estateo Prestige — light luxury

const estateoPalette: ThemePalette = { primary: '#d97706', secondary: '#0f172a', bg: '#ffffff', text: '#0f172a', muted: '#64748b', accent: '#f59e0b' };
const estateo = lookFor(estateoPalette, { kit: KITS.editorial, band: '#f8fafc', cardBorder: '#e2e8f0', radius: 6, shadow: 'sm' });
const estateoUsp: Slide[] = [
  { title: 'Pièces certifiées', description: 'Chaque meuble et chaque objet est expertisé et photographié avant d’entrer au catalogue.' },
  { title: 'Conseil sur WhatsApp', description: 'Dimensions, matières, accord avec votre intérieur : un conseiller répond avant que vous commandiez.' },
  { title: 'Livraison blanche', description: 'Livré, déballé et installé chez vous, emballage retiré, dans tout le Royaume.' },
  { title: 'Paiement à la réception', description: 'Vous réglez lorsque la pièce est chez vous, et seulement alors.' },
];
const estateoQuotes: Quote[] = [
  { name: 'Kenza A.', city: 'Rabat', text: 'Un service digne d’une galerie. La console est arrivée protégée, installée, exactement comme sur les photos.' },
  { name: 'Mehdi R.', city: 'Casablanca', text: 'Conseil précis, sans pression. J’ai payé à la livraison, ce qui m’a rassuré pour un achat de ce montant.' },
  { name: 'Lina S.', city: 'Marrakech', text: 'Les finitions sont irréprochables. Deuxième commande pour le riad.' },
];
const estateoFaq: Faq[] = [
  { q: 'Les pièces sont-elles uniques ?', a: 'La plupart le sont. Une pièce marquée « unique » n’est proposée qu’à un seul acheteur : la première commande validée l’emporte.' },
  { q: 'Comment se passe la livraison ?', a: 'Livraison blanche : nos équipes installent la pièce chez vous et repartent avec l’emballage, sous 7 jours.' },
  { q: 'Puis-je voir la pièce avant de payer ?', a: 'Oui. Vous la découvrez installée, vous la vérifiez, puis vous réglez le livreur. Un défaut ? Elle repart avec lui.' },
  COD_FAQ[0],
];

const ESTATEO = theme({
  id: 'estateo',
  label: { fr: 'Maison Prestige', en: 'Maison Prestige' },
  description: { fr: 'Élégance architecturale : blanc, encre et or, typographie serif, pièce signature en carte, sélection en grille, récit de maison et offre collection.', en: 'Architectural elegance: white, ink and gold, serif type, a signature piece card, a grid selection, a house story and a collection offer.' },
  audience: { fr: 'Mobilier design, luminaires, décoration d’exception, objets d’art', en: 'Designer furniture, lighting, fine decor, art objects' },
  category: 'luxury',
  tags: ['Luxe', 'Serif', 'Blanc & Or', 'Récit'],
  badge: 'Populaire',
  rating: 4.98,
  downloads: 1890,
  previewImage: '/images/themes/theme_estateo.jpg',
  palette: estateoPalette,
  fontFamily: 'Playfair Display',
  kit: 'editorial',
  pages: {
    header: headerPage(estateo, { icons: true, bg: '$bg', border: '#f1f5f9', cta: 'Commander', ctaBg: '$secondary', ctaColor: '#ffffff', ctaRadius: 4, linkCase: 'upper' }),
    footer: footerPage(estateo, { about: 'Une sélection rare de mobilier, de luminaires et d’objets de haute facture, livrés et installés chez vous, payés à la réception.', badges: ['Pièces certifiées', 'Livraison blanche', 'Paiement à la livraison'] }),
    home: homePage(estateoPalette, [
      heroSection('hero', estateo, {
        variant: 'center', align: 'left', size: '2xl', serif: true, uppercase: true, kicker: 'COLLECTION SIGNATURE · 2026', kickerStyle: 'line',
        title: 'Des créations d’exception', subtitle: 'Mobilier, luminaires et objets de haute facture, choisis un à un, livrés et installés chez vous. Vous payez à la réception.',
        cta: 'VOIR LA COLLECTION', ctaBg: '#f8f1e4', ctaColor: '#0f172a', ctaRadius: 4, secondaryCta: 'Nouveautés',
        titleColor: '#ffffff', subtitleColor: 'rgba(255,255,255,0.82)',
        bgImage: asset('estateo', 'hero'), overlay: 'rgba(10,14,28,0.45)',
        background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 52%,#9a3412 100%)', paddingTop: 96, paddingBottom: 88, maxWidth: 1280, minHeight: 520,
        card: { badge: 'Pièce signature', title: 'Console Atlas', subtitle: 'Noyer massif & laiton brossé', rows: [{ label: 'Dimensions', value: '160 × 40 × 82 cm' }, { label: 'Origine', value: 'Atelier de Rabat' }, { label: 'Livraison blanche', value: '7 jours' }], figure: '12 900 DH', figureCaption: 'payée à la livraison', cta: 'COMMANDER', dark: true },
      }),
      uspSection('usp', estateo, estateoUsp, { variant: 'plain', background: '$bg', paddingTop: 0, paddingBottom: 24 }),
      productsSection('selection', estateo, { title: 'Sélection d’exception', subtitle: 'Les pièces disponibles ce mois-ci.', big: true, cols: 3, background: '#f8fafc', btnBg: '$secondary', btnColor: '#ffffff', ctaText: 'VOIR TOUTE LA COLLECTION' }),
      storySection('story', estateo, {
        image: asset('estateo', 'story'),
        title: 'La maison',
        paragraphs: [
          'Depuis 2014, nous sélectionnons des meubles et des objets pour leur dessin, leur matière et leur histoire. Rien n’entre au catalogue sans avoir été vu, touché et expertisé.',
          'Chaque commande est accompagnée : un conseiller unique, une livraison blanche, et la garantie de payer seulement lorsque la pièce est chez vous.',
        ],
        highlights: pics([{ title: 'Expertise', description: 'Provenance, matériaux et état documentés pour chaque pièce.' }], trio('estateo')),
        cta: 'Voir la collection', background: '$bg',
      }),
      promoSection('promo', estateo, { image: asset('estateo', 'promo'), variant: 'split', title: 'Collection Atlas : livraison blanche offerte', subtitle: 'Pour toute pièce de la collection commandée ce mois-ci, la livraison, l’installation et le retrait de l’emballage sont offerts.', cta: 'DÉCOUVRIR LA COLLECTION', secondaryCta: 'Un conseil ? WhatsApp', secondaryLink: '/pages/contact', maxWidth: 1400 }),
      testimonialsSection('reviews', estateo, estateoQuotes, { title: 'Ils nous ont fait confiance', variant: 'carousel', background: '#f8fafc' }),
      statsSection('stats', estateo, [{ value: '12 ans', label: 'de sélection' }, { value: '+800', label: 'pièces livrées' }, { value: '100 %', label: 'expertisées avant mise en vente' }], { background: '$bg' }),
      faqSection('faq', estateo, estateoFaq, { title: 'Questions fréquentes', background: '#f8fafc' }),
      ctaSection('cta', estateo, { title: 'Une pièce vous a retenu ?', subtitle: 'Commandez-la maintenant : livraison blanche sous 7 jours, paiement à la réception.', cta: 'COMMANDER', secondaryCta: 'Voir la collection' }),
      whatsappSection('wa', { headline: 'Conseiller privé', nickname: 'Maison Prestige', headerBg: '$secondary' }),
    ]),
    product: productPage(estateo, { buyNowText: 'Commander — paiement à la livraison', buttonBg: '$secondary', buttonColor: '#ffffff' }, productAfter(estateo, { usp: estateoUsp, uspVariant: 'plain', quotes: estateoQuotes, faqs: estateoFaq, related: 'Dans le même esprit', band: '#f8fafc', cta: { title: 'Un doute sur les dimensions ?', subtitle: 'Un conseiller vous répond sur WhatsApp avant que vous commandiez.', cta: 'VOIR TOUTE LA COLLECTION' } })),
    catalogue: cataloguePage(estateo, { title: 'La collection', subtitle: 'Mobilier, luminaires et objets, expertisés avant d’être mis en vente.', cols: 3, btnBg: '$secondary', btnColor: '#ffffff' }, catalogueAfter(estateo, { usp: estateoUsp, variant: 'plain', band: '#f8fafc' })),
  },
});

// ═══════════════════════════════════════════════════════════════ 3. Aura Green Energy — light, technical

const auraPalette: ThemePalette = { primary: '#15803d', secondary: '#052e16', bg: '#f8fafc', text: '#0f172a', muted: '#475569', accent: '#84cc16' };
const aura = lookFor(auraPalette, { kit: KITS.clean, band: '#eef4ee', cardBorder: '#dbe5dc', radius: 14, shadow: 'sm' });
const auraUsp: Slide[] = [
  { title: '☀️ Matériel certifié', description: 'Panneaux, onduleurs et batteries de marques garanties 10 ans par le constructeur.' },
  { title: '🔌 Prêt à brancher', description: 'Chaque kit arrive complet, avec câbles, fixations et un guide de montage en français.' },
  { title: '📉 Facture divisée', description: 'Jusqu’à -70 % sur votre facture d’électricité dès le premier mois.' },
  { title: '💵 Paiement à la réception', description: 'Vous payez lorsque le matériel est livré et vérifié.' },
];
const auraQuotes: Quote[] = [
  { name: 'Rachid M.', city: 'Agadir', text: 'Kit 3 kW reçu en trois jours, monté en une après-midi avec le guide. Facture passée de 900 à 210 DH.' },
  { name: 'Fatima Z.', city: 'Fès', text: 'Matériel de marque, carton complet, rien ne manquait. J’ai payé à la livraison comme promis.' },
  { name: 'Coopérative Al Amal', city: 'Taroudant', text: 'Pompe solaire pour nos parcelles : opérationnelle depuis 8 mois sans une panne.' },
];
const auraFaq: Faq[] = [
  { q: 'Quel kit me faut-il ?', a: 'Envoyez-nous votre dernière facture sur WhatsApp : nous vous indiquons gratuitement le kit adapté avant de commander.' },
  { q: 'Puis-je l’installer moi-même ?', a: 'Oui : chaque kit est livré prêt à brancher avec son guide. Un installateur partenaire peut aussi intervenir, en option.' },
  { q: 'Que couvre la garantie ?', a: '10 ans constructeur sur les panneaux et l’onduleur, 5 ans sur les batteries.' },
  COD_FAQ[0],
];

const AURA = theme({
  id: 'cleanenergy',
  label: { fr: 'Aura Solaire', en: 'Aura Solar' },
  description: { fr: 'Énergie durable : accroche en deux colonnes avec le kit vedette en carte, compteurs, catalogue en grille, commande en 4 étapes et pack promo.', en: 'Sustainable energy: two-column hero with the featured kit card, counters, a grid catalogue, four ordering steps and a bundle offer.' },
  audience: { fr: 'Kits solaires, batteries, stations d’énergie, éclairage LED, équipement éco', en: 'Solar kits, batteries, power stations, LED lighting, eco gear' },
  category: 'energy',
  tags: ['Éco-Tech', 'Solaire', 'Étapes', 'Chiffres'],
  badge: 'Nouveau',
  rating: 4.93,
  downloads: 980,
  previewImage: '/images/themes/theme_cleanenergy.jpg',
  palette: auraPalette,
  fontFamily: 'Plus Jakarta Sans',
  kit: 'clean',
  pages: {
    header: headerPage(aura, { announcement: '🌱 Kits solaires livrés complets dans tout le Maroc — paiement à la réception', bg: '#ffffff', border: '#e2e8f0', cta: 'Commander', ctaRadius: 10 }),
    footer: footerPage(aura, { about: 'Kits solaires, batteries et stations d’énergie de marques garanties, livrés complets partout au Maroc et payés à la réception.', badges: ['Énergie 100 % renouvelable', 'Garantie constructeur 10 ans', 'Paiement à la livraison'] }),
    home: homePage(auraPalette, [
      heroSection('hero', aura, {
        variant: 'center', align: 'left', size: '2xl', kicker: 'TRANSITION ÉNERGÉTIQUE 2026', kickerStyle: 'line',
        title: 'Votre kit solaire, livré complet.', highlight: 'kit solaire',
        subtitle: 'Kits solaires, batteries et stations d’énergie : livrés complets et prêts à brancher sous 72h, payés à la réception.',
        cta: 'DÉCOUVRIR LES KITS', ctaRadius: 12, secondaryCta: 'Voir les batteries',
        titleColor: '$secondary',
        bgImage: asset('cleanenergy', 'hero'), overlay: 'rgba(255,255,255,0.35)',
        background: 'linear-gradient(135deg,#fef3c7 0%,#f8fafc 45%,#dcfce7 100%)', paddingTop: 80, paddingBottom: 80, maxWidth: 1280, minHeight: 520,
        card: { badge: 'Kit vedette', title: 'Kit solaire 3 kW', subtitle: 'Villa ou appartement, 4 à 6 personnes', rows: [{ label: 'Panneaux', value: '6 × 550 W' }, { label: 'Onduleur', value: 'Hybride 3 kW' }, { label: 'Garantie', value: '10 ans' }], figure: '18 900 DH', figureCaption: 'payés à la livraison', cta: 'COMMANDER', dark: false },
      }),
      statsSection('stats', aura, [{ value: '-70 %', label: 'sur la facture d’électricité' }, { value: '+1 200', label: 'kits livrés' }, { value: '10 ans', label: 'de garantie constructeur' }, { value: '72h', label: 'entre commande et livraison' }], { background: '$secondary', valueColor: '#86efac', labelColor: 'rgba(255,255,255,0.75)' }),
      productsSection('catalogue', aura, { title: 'Kits solaires & équipements', subtitle: 'Chaque kit est livré complet : panneaux, onduleur, structure et câblage.', big: true, cols: 3, ctaText: 'VOIR TOUS LES ÉQUIPEMENTS' }),
      stepsSection('steps', aura, [
        { title: '1 · Choisissez', description: 'Un doute sur la puissance ? Envoyez votre facture sur WhatsApp, on vous indique le bon kit.' },
        { title: '2 · Commandez', description: 'Nom, téléphone, ville : trente secondes, sans compte ni carte bancaire.' },
        { title: '3 · Recevez', description: 'Le kit complet arrive sous 72h. Vous vérifiez le carton, puis vous payez le livreur.' },
        { title: '4 · Branchez', description: 'Guide de montage en français et support WhatsApp jusqu’au premier kilowatt.' },
      ], { title: 'De la commande au premier kilowatt, en 4 étapes', background: '#eef4ee' }),
      uspSection('usp', aura, auraUsp, { title: 'Pourquoi nos clients nous choisissent', background: '$bg' }),
      promoSection('promo', aura, { image: asset('cleanenergy', 'promo'), title: 'Pack autonomie : kit + batterie à -20 %', subtitle: 'Ajoutez une batterie lithium à votre kit et gardez la lumière pendant les coupures. Offre valable jusqu’à dimanche.', countdown: '🌱 Le pack repasse au prix normal dimanche soir', cta: 'VOIR LE PACK', ctaBg: '#86efac', ctaColor: '#052e16', background: '$primary', titleColor: '#ffffff', subtitleColor: 'rgba(255,255,255,0.85)', radius: 24 }),
      testimonialsSection('reviews', aura, auraQuotes, { title: 'Ils produisent déjà leur énergie', variant: 'carousel', background: '#eef4ee' }),
      faqSection('faq', aura, auraFaq, { title: 'Questions fréquentes' }),
      ctaSection('cta', aura, { title: 'Passez au solaire cette semaine', subtitle: 'Commandez votre kit : livraison sous 72h, garantie 10 ans, paiement à la réception.', cta: 'COMMANDER MON KIT', ctaBg: '$secondary', ctaColor: '#ffffff' }),
      whatsappSection('wa', { headline: 'Un technicien vous répond', nickname: 'Aura Énergie' }),
    ]),
    product: productPage(aura, { buyNowText: 'Commander — paiement à la réception' }, productAfter(aura, { usp: auraUsp, quotes: auraQuotes, faqs: auraFaq, related: 'Compléter votre installation', band: '#eef4ee', cta: { title: 'Pas sûr de la puissance ?', subtitle: 'Envoyez votre facture sur WhatsApp, on vous indique le bon kit dans la journée.', cta: 'VOIR TOUS LES KITS', ctaBg: '$secondary', ctaColor: '#ffffff' } })),
    catalogue: cataloguePage(aura, { title: 'Équipements & systèmes solaires', subtitle: 'Kits complets, batteries, stations d’énergie et accessoires, garantis 10 ans.', cols: 3 }, catalogueAfter(aura, { usp: auraUsp, variant: 'cards', band: '#eef4ee' })),
  },
});

// ═══════════════════════════════════════════════════════════════ 4. Matcha Botanics — organic, serif

const matchaPalette: ThemePalette = { primary: '#4d602b', secondary: '#242e12', bg: '#fbfcf8', text: '#1b230d', muted: '#6a784d', accent: '#849b4c' };
const matcha = lookFor(matchaPalette, { kit: KITS.soft, band: '#f1f4e8', cardBorder: '#e2e8d2', radius: 20, shadow: 'sm' });
const matchaUsp: Slide[] = [
  { title: '🍃 Bio certifié', description: 'Cultivé sans pesticide, moulu à la pierre, récolte de l’année.' },
  { title: '📦 Fraîcheur scellée', description: 'Conditionné sous azote et expédié sous 48h de nos entrepôts.' },
  { title: '💵 Paiement à la réception', description: 'Goûtez d’abord, payez le livreur ensuite.' },
];
const matchaQuotes: Quote[] = [
  { name: 'Imane L.', city: 'Casablanca', text: 'Un matcha doux, sans amertume, la couleur est superbe. Livré en deux jours avec le fouet en bambou.' },
  { name: 'Hamza D.', city: 'Rabat', text: 'J’ai remplacé mon café du matin. Énergie stable toute la journée, et le service client est adorable.' },
  { name: 'Sara B.', city: 'Tanger', text: 'Le coffret cadeau est magnifique. Ma sœur a adoré.' },
];
const matchaFaq: Faq[] = [
  { q: 'Cérémonial ou culinaire ?', a: 'Cérémonial pour boire pur, à l’eau ; culinaire pour les lattes, pâtisseries et smoothies.' },
  { q: 'Comment le conserver ?', a: 'Au frais, à l’abri de la lumière, dans sa boîte fermée. Il garde ses arômes 3 mois après ouverture.' },
  { q: 'Contient-il de la caféine ?', a: 'Oui, environ un tiers d’un espresso, libérée lentement grâce à la L-théanine.' },
  COD_FAQ[0],
];

const MATCHA = theme({
  id: 'matcha',
  label: { fr: 'Matcha Botanics', en: 'Matcha Botanics' },
  description: { fr: 'Esprit zen et gourmand : vert olive, typographie serif, carrousel de thés, rituel en trois gestes, coffret cadeau et avis en douceur.', en: 'Zen and delicious: olive green, serif type, a tea carousel, a three-step ritual, a gift box offer and gentle reviews.' },
  audience: { fr: 'Thés matcha bio, super-aliments, boissons saines, épicerie bien-être', en: 'Matcha tea, superfoods, organic healthy beverages' },
  category: 'food',
  tags: ['Bio', 'Serif', 'Carrousel', 'Rituel'],
  badge: 'Coup de Cœur',
  rating: 4.95,
  downloads: 1120,
  previewImage: '/images/themes/theme_matcha.jpg',
  palette: matchaPalette,
  fontFamily: 'Playfair Display',
  kit: 'soft',
  pages: {
    header: headerPage(matcha, { icons: true, overlay: true, bg: 'transparent', text: '#ffffff', border: 'transparent', cartBg: 'rgba(255,255,255,0.12)', cta: 'Commander', ctaBg: '#849b4c', ctaColor: '#ffffff', ctaRadius: 4, linkCase: 'upper' }),
    footer: footerPage(matcha, { about: 'Des thés et super-aliments biologiques, choisis à la source et livrés frais partout au Maroc.', badges: ['Bio certifié', 'Fraîcheur scellée', 'Paiement à la livraison'], bg: '$secondary' }),
    home: homePage(matchaPalette, [
      heroSection('hero', matcha, {
        variant: 'split', align: 'left', size: '2xl', serif: true, uppercase: true, kicker: 'RÉCOLTE DE PRINTEMPS',
        title: 'Choisissez votre matcha', subtitle: 'Matcha cérémonial bio, moulu à la pierre, pour une énergie stable et un rituel apaisant. Livré sous 48h.',
        cta: 'COMMANDER', ctaBg: '#849b4c', ctaColor: '#ffffff', ctaRadius: 4, secondaryCta: 'Explorer nos thés',
        titleColor: '#ffffff', subtitleColor: 'rgba(255,255,255,0.85)',
        image: asset('matcha', 'hero'),
        highlights: pics([
          { title: 'Cérémonial', description: 'À boire pur, doux et umami.' },
          { title: 'Latte', description: 'Crémeux au lait végétal.' },
          { title: 'Culinaire', description: 'Pour pâtisser et cuisiner.' },
        ], trio('matcha')),
        background: 'linear-gradient(120deg,#242e12 0%,#4d602b 100%)', paddingTop: 150, paddingBottom: 72, maxWidth: 1280,
      }),
      uspSection('usp', matcha, matchaUsp, { variant: 'plain', background: '$bg', paddingTop: 8, paddingBottom: 8 }),
      productsSection('teas', matcha, { title: 'Produits vedettes', subtitle: 'Matcha bio, emballages recyclables, expédiés sous 48h.', big: true, layout: 'grid', cols: 3, ctaText: 'VOIR TOUTE LA BOUTIQUE' }),
      quoteSection('quote', matcha, matchaQuotes[0], { background: '$secondary', kicker: 'Ils en parlent', size: 'xl', serif: true }),
      stepsSection('ritual', matcha, [
        { title: '1 · Tamisez', description: 'Une cuillère de matcha, tamisée pour éviter les grumeaux.' },
        { title: '2 · Fouettez', description: 'Un peu d’eau à 80 °C, un fouet en bambou, un mouvement en W.' },
        { title: '3 · Savourez', description: 'Pur, ou allongé de lait végétal pour un latte crémeux.' },
      ], { title: 'Le rituel, en trois gestes', variant: 'columns', background: '#f1f4e8' }),
      storySection('story', matcha, {
        image: asset('matcha', 'story'),
        title: 'De la feuille à la tasse',
        paragraphs: [
          'Nos matchas viennent de petites fermes ombragées d’Uji et de Kagoshima. Les feuilles sont cueillies à la main, séchées, puis moulues à la pierre, lentement, pour garder leur douceur.',
          'Nous importons en petites quantités, plusieurs fois par an, pour que chaque boîte vous arrive avec la fraîcheur de sa récolte.',
        ],
        highlights: pics([{ title: 'Récolte 2026', description: 'Première cueillette, la plus douce de l’année.' }], trio('matcha')),
        background: '$bg',
      }),
      testimonialsSection('reviews', matcha, matchaQuotes, { title: 'Ils ont adopté le rituel', variant: 'carousel', background: '#f1f4e8' }),
      promoSection('gift', matcha, { image: asset('matcha', 'promo'), title: 'Le coffret découverte', subtitle: 'Un matcha cérémonial, un fouet en bambou, une cuillère et le guide de préparation, dans une boîte à offrir.', cta: 'OFFRIR LE COFFRET', maxWidth: 1400 }),
      faqSection('faq', matcha, matchaFaq, { title: 'Vos questions' }),
      ctaSection('cta', matcha, { title: 'Commencez demain matin', subtitle: 'Commandez ce soir, recevez sous 48h, payez à la réception.', cta: 'COMMANDER MON MATCHA' }),
      whatsappSection('wa', { headline: 'Un conseil de préparation ?', nickname: 'Matcha Botanics' }),
    ]),
    product: productPage(matcha, { buyNowText: 'Commander — paiement à la réception' }, productAfter(matcha, { usp: matchaUsp, uspVariant: 'plain', quotes: matchaQuotes, faqs: matchaFaq, related: 'À déguster avec', band: '#f1f4e8' })),
    catalogue: cataloguePage(matcha, { title: 'Thés, lattes & super-aliments', subtitle: 'Tout est biologique, frais et livré sous 48h.', cols: 3 }, catalogueAfter(matcha, { usp: matchaUsp, variant: 'plain', band: '#f1f4e8' })),
  },
});

// ═══════════════════════════════════════════════════════════════ 5. Grow+ Streetwear — dark, loud

const growPalette: ThemePalette = { primary: '#ea580c', secondary: '#09090b', bg: '#09090b', text: '#fafafa', muted: '#a1a1aa', accent: '#f97316' };
const grow = lookFor(growPalette, { kit: KITS.street, card: '#141417', cardBorder: 'rgba(255,255,255,0.10)', band: '#111114', radius: 8, shadow: 'none' });
const growUsp: Slide[] = [
  { title: '🔥 DROPS HEBDO', description: 'Nouvelles pièces chaque vendredi, en quantité limitée.' },
  { title: '👟 100 % AUTHENTIQUE', description: 'Sneakers et textile vérifiés, étiquettes et boîtes d’origine.' },
  { title: '🚚 LIVRÉ EN 24/48H', description: 'Partout au Maroc, payé à la réception.' },
  { title: '🔁 ÉCHANGE DE TAILLE', description: 'Pas la bonne pointure ? On échange sous 7 jours.' },
];
const growQuotes: Quote[] = [
  { name: 'Ayoub K.', city: 'Casablanca', text: 'Paire authentique, boîte d’origine, livrée en un jour. Le drop du vendredi est devenu mon rendez-vous.' },
  { name: 'Ghita M.', city: 'Rabat', text: 'Le hoodie taille parfaitement, la matière est lourde comme il faut. Échange de taille facile la première fois.' },
  { name: 'Ilyas T.', city: 'Agadir', text: 'Prix corrects, stock réel, réponse WhatsApp en cinq minutes. Rien à redire.' },
];
const growFaq: Faq[] = [
  { q: 'Comment choisir ma taille ?', a: 'Un guide des tailles est sur chaque fiche. Un doute ? Envoyez vos mesures sur WhatsApp, on vous conseille.' },
  { q: 'Les sneakers sont-elles authentiques ?', a: 'Oui, toutes. Chaque paire est vérifiée et livrée dans sa boîte d’origine avec ses étiquettes.' },
  { q: 'Que se passe-t-il si la taille ne va pas ?', a: 'Échange gratuit sous 7 jours, article non porté, dans son emballage.' },
  COD_FAQ[0],
];

const GROWPLUS = theme({
  id: 'growplus',
  label: { fr: 'Grow+ Streetwear & Sport', en: 'Grow+ Athletic' },
  description: { fr: 'Énergie urbaine : fond noir, orange vif, accroche avec les drops en cartes, ticker de garanties, grille 4 colonnes et compte à rebours.', en: 'Urban energy: black ground, vivid orange, a hero with drop cards, a guarantees ticker, a four-column grid and a countdown.' },
  audience: { fr: 'Sneakers, streetwear, vêtements de sport, fitness & athlètes', en: 'Sneakers, streetwear, sportswear, fitness' },
  category: 'fashion',
  tags: ['Dark Mode', 'Drops', 'Ticker', 'Urgence'],
  badge: 'Top Ventes',
  rating: 4.91,
  downloads: 2210,
  previewImage: '/images/themes/theme_growplus.jpg',
  palette: growPalette,
  fontFamily: 'Space Grotesk',
  kit: 'street',
  pages: {
    header: headerPage(grow, { announcement: '🔥 NOUVEAU DROP CE VENDREDI — ÉDITION LIMITÉE — LIVRAISON 24H', bg: '$secondary', border: 'rgba(255,255,255,0.08)', cartBg: '#141417', cta: 'SHOP', ctaRadius: 6, linkCase: 'upper' }),
    footer: footerPage(grow, { bg: '#000000', text: '$text', border: 'rgba(255,255,255,0.08)', about: 'Sneakers, streetwear et équipement sport, 100 % authentiques, livrés en 24/48h partout au Maroc.', badges: ['100 % authentique', 'Échange de taille', 'Paiement à la livraison'] }),
    home: homePage(growPalette, [
      heroSection('hero', grow, {
        variant: 'center', align: 'left', size: '2xl', uppercase: true, kicker: 'DROP #24 · ÉDITION LIMITÉE', kickerStyle: 'pill',
        title: 'Maximisez votre performance', highlight: 'performance',
        subtitle: 'Vitesse, style et innovation sans compromis pour l’athlète moderne. Sneakers et textile authentiques, livrés en 24h.',
        cta: 'VOIR LES NOUVEAUTÉS', ctaRadius: 6, secondaryCta: 'Tout le shop',
        titleColor: '#fafafa', subtitleColor: '#a1a1aa',
        bgImage: asset('growplus', 'hero'), overlay: 'rgba(9,9,11,0.55)',
        background: 'linear-gradient(135deg,#09090b 0%,#1c1917 58%,#431407 100%)', paddingTop: 80, paddingBottom: 80, maxWidth: 1280, minHeight: 560,
        card: { badge: 'Drop de la semaine', title: '« Runner Pro » Néon', subtitle: 'Orange néon / Noir / Blanc', rows: [{ label: 'Tige', value: 'Mesh Dynamic Fit' }, { label: 'Semelle', value: 'MaxCushion' }, { label: 'Tailles', value: '39 → 46' }], figure: '1 450 DH', figureCaption: 'payé à la livraison', cta: 'AJOUTER AU PANIER', dark: false },
      }),
      uspSection('ticker', grow, growUsp, { variant: 'marquee', background: '$primary', titleColor: '#ffffff', subtitleColor: 'rgba(255,255,255,0.85)', cardBg: 'rgba(0,0,0,0.18)', cardBorder: 'rgba(255,255,255,0.15)', paddingTop: 12, paddingBottom: 12 }),
      productsSection('drop', grow, { title: 'LE DROP DE LA SEMAINE', subtitle: 'Quantités limitées. Le stock affiché est le stock réel.', big: true, cols: 4, radius: 8, ctaText: 'TOUT LE SHOP' }),
      gallerySection('styles', grow, [
        { url: asset('growplus', 'h1'), alt: 'Look 1', rows: 2 }, { url: asset('growplus', 'h2'), alt: 'Look 2' }, { url: asset('growplus', 'h3'), alt: 'Look 3' },
        { url: asset('growplus', 'story'), alt: 'Look 4', span: 2 }, { url: asset('growplus', 'promo'), alt: 'Look 5' },
      ], { title: 'STYLES VEDETTES', align: 'left', columns: 4 }),
      featureSection('innov', grow, {
        kicker: 'DESIGN', title: 'INNOVATION DESIGN', uppercase: true,
        text: 'Vitesse, style et innovation sans compromis pour l’athlète moderne. Voici ce qui change sur ce drop.',
        items: [
          { title: 'Matières techniques', text: 'Mesh respirant, coutures thermosoudées, réflecteurs.' },
          { title: 'Amorti MaxCushion', text: 'Retour d’énergie mesuré à chaque foulée.' },
          { title: 'Pointures 39 → 46', text: 'Échange de taille gratuit sous 7 jours.' },
        ],
        marker: 'number', image: asset('growplus', 'story'), imageSide: 'left', cta: 'VOIR LE DROP',
      }),
      promoSection('sale', grow, { image: asset('growplus', 'promo'), variant: 'split', title: 'DERNIÈRES TAILLES : -30 %', subtitle: 'Prix cassés sur les fins de série, jusqu’à ce soir minuit.', countdown: '🔥 Fin de la promo dans quelques heures', cta: 'J’EN PROFITE', background: '#141417', titleColor: '$text', subtitleColor: '$muted', radius: 16 }),
      testimonialsSection('reviews', grow, growQuotes, { title: 'LA COMMUNAUTÉ', variant: 'grid', background: '#111114' }),
      stepsSection('steps', grow, COD_STEPS.slice(0, 3).concat([{ title: '4 · Portez', description: 'Le livreur passe sous 24 à 48h. Vous payez à la réception.' }]), { title: 'COMMANDER EN 30 SECONDES' }),
      faqSection('faq', grow, growFaq, { title: 'FAQ', variant: 'cards', background: '#111114' }),
      ctaSection('cta', grow, { title: 'NE RATE PAS LE PROCHAIN DROP', subtitle: 'Commande maintenant, reçois demain, paie à la réception.', cta: 'SHOP NOW', ctaBg: '#ffffff', ctaColor: '#09090b' }),
      whatsappSection('wa', { headline: 'Un conseil taille ?', nickname: 'Grow+ Team' }),
    ]),
    product: productPage(grow, { buyNowText: 'COMMANDER — PAIEMENT À LA LIVRAISON' }, productAfter(grow, { usp: growUsp, uspVariant: 'marquee', quotes: growQuotes, faqs: growFaq, countdown: '🔥 Dernières tailles disponibles — stock réel', related: 'COMPLÈTE LE FIT', relatedCols: 4, testimonialVariant: 'grid', band: '#111114' })),
    catalogue: cataloguePage(grow, { title: 'TOUT LE SHOP', subtitle: 'Sneakers, textile, équipement. Authentique, livré en 24/48h.', cols: 4, radius: 8 }, catalogueAfter(grow, { usp: growUsp, band: '#111114' })),
  },
});

// ═══════════════════════════════════════════════════════════════ 6. ChronoTask Bureau & Tech — light, playful

const chronoPalette: ThemePalette = { primary: '#2563eb', secondary: '#1e293b', bg: '#f8fafc', text: '#0f172a', muted: '#64748b', accent: '#3b82f6' };
const chrono = lookFor(chronoPalette, { kit: KITS.playful, band: '#eef2ff', cardBorder: '#e2e8f0', radius: 16, shadow: 'md' });
const chronoFeatures: Slide[] = [
  { title: '⚡ Expédié sous 24h', description: 'Commandé avant 15h, votre colis part le jour même de notre stock de Casablanca.' },
  { title: '🔐 Produits garantis', description: 'Chaque accessoire est testé avant envoi et couvert 12 mois, facture incluse.' },
  { title: '🎓 Guide inclus', description: 'Un guide de prise en main en français dans chaque colis, et le support sur WhatsApp.' },
];
const chronoQuotes: Quote[] = [
  { name: 'Agence Nomad', city: 'Casablanca', text: 'Six claviers et six supports d’écran reçus le lendemain, facture propre, tout fonctionnait. On a équipé toute l’équipe.' },
  { name: 'Youssef A.', city: 'Rabat', text: 'La lampe de bureau et le hub USB-C sont exactement ceux des photos. Payé à la livraison, sans frais de carte.' },
  { name: 'Studio Kech', city: 'Marrakech', text: 'Le planner et l’organiseur de câbles ont mis de l’ordre dans le studio. Sérieux et rapides.' },
];
const chronoFaq: Faq[] = [
  { q: 'Les produits sont-ils compatibles avec mon ordinateur ?', a: 'Chaque fiche liste les compatibilités (Windows, macOS, iPad, Android). Un doute ? Envoyez le modèle sur WhatsApp.' },
  { q: 'Que couvre la garantie ?', a: 'Tout défaut de fabrication pendant 12 mois : échange ou remboursement, frais de retour inclus.' },
  { q: 'Puis-je commander pour mon entreprise ?', a: 'Oui, avec facture au nom de l’entreprise. Dès 5 unités, écrivez-nous sur WhatsApp pour un tarif dégressif.' },
  COD_FAQ[0],
];

const CHRONOTASK = theme({
  id: 'chronotask',
  label: { fr: 'Bureau & Tech Store', en: 'Desk & Tech Store' },
  description: { fr: 'Boutique bureau & productivité : accroche à deux boutons, bandeau de chiffres défilant, garanties en cartes, catégories en puces, best-sellers en grille et FAQ en cartes.', en: 'Desk and productivity store: two-button hero, scrolling figures strip, guarantee cards, category chips, a best-sellers grid and a card FAQ.' },
  audience: { fr: 'Accessoires de bureau, périphériques, gadgets de productivité, organisation', en: 'Desk accessories, peripherals, productivity gadgets, organisers' },
  category: 'office',
  tags: ['Bureau', 'Productivité', 'Best-sellers', 'Bleu'],
  badge: 'Best-sellers',
  rating: 4.9,
  downloads: 760,
  previewImage: '/images/themes/theme_chronotask.jpg',
  palette: chronoPalette,
  fontFamily: 'Manrope',
  kit: 'playful',
  pages: {
    header: headerPage(chrono, { announcement: '🚀 Livraison offerte dès 300 DH — expédition sous 24h — paiement à la réception', bg: '#ffffff', border: '#e2e8f0', cta: 'Commander', ctaRadius: 999, secondary: 'Suivre ma commande', secondaryUrl: '/pages/suivi' }),
    footer: footerPage(chrono, { about: 'Accessoires de bureau et gadgets de productivité pour ceux qui veulent avancer plus vite. Testés, garantis 12 mois, livrés partout au Maroc.', badges: ['Garantie 12 mois', 'Expédition sous 24h', 'Paiement à la livraison'] }),
    home: homePage(chronoPalette, [
      heroSection('hero', chrono, {
        variant: 'stacked', align: 'center', size: '2xl', kicker: 'BUREAU · PÉRIPHÉRIQUES · ORGANISATION', kickerStyle: 'pill',
        title: 'Tout pour un bureau qui avance.', highlight: 'avance',
        subtitle: 'Claviers, supports, lampes, hubs et planners choisis pour travailler mieux, expédiés sous 24h et payés à la réception.',
        cta: 'Voir les best-sellers', ctaRadius: 999, secondaryCta: 'Tout le catalogue', secondaryStyle: 'link',
        highlights: pics([
          { title: '⚡ Expédié sous 24h', description: 'Votre colis part le jour même.' },
          { title: '🔐 Garantie 12 mois', description: 'Testé avant envoi, avec facture.' },
          { title: '🎓 Guide inclus', description: 'Prise en main en français dans chaque colis.' },
        ], trio('chronotask')),
        image: asset('chronotask', 'hero'),
        background: 'linear-gradient(180deg,#eef2ff 0%,#ffffff 70%)', paddingTop: 88, paddingBottom: 56, maxWidth: 1100,
      }),
      uspSection('logos', chrono, [
        { title: '+2 000 équipes', description: 'équipées au Maroc' },
        { title: '48 marques', description: 'distribuées officiellement' },
        { title: '24h', description: 'délai moyen d’expédition' },
        { title: '4.9/5', description: 'satisfaction client' },
        { title: 'Facture', description: 'fournie avec chaque commande' },
      ], { variant: 'marquee', background: '$bg', paddingTop: 16, paddingBottom: 16 }),
      uspSection('features', chrono, chronoFeatures, { title: 'Tout ce qu’il faut pour bien s’équiper', subtitle: 'Pas seulement un colis : une garantie et un guide.', background: '#ffffff' }),
      chipsSection('tags', chrono, [{ label: 'Claviers & souris', url: '/products' }, { label: 'Supports & bras', url: '/products' }, { label: 'Lampes', url: '/products' }, { label: 'Hubs & câbles', url: '/products' }, { label: 'Planners', url: '/products' }], { style: 'outline', paddingTop: 0, paddingBottom: 24, background: '#ffffff' }),
      productsSection('plans', chrono, { title: 'Nos best-sellers', subtitle: 'Les accessoires les plus commandés ce mois-ci. Le prix affiché est le prix payé.', big: true, cols: 3, background: '#eef2ff', ctaText: 'TOUT LE CATALOGUE' }),
      statsSection('stats', chrono, [{ value: '24h', label: 'pour expédier' }, { value: '-35 %', label: 'vs. prix boutique' }, { value: '100 %', label: 'de produits garantis' }], { background: '#ffffff' }),
      testimonialsSection('reviews', chrono, chronoQuotes, { title: 'Des équipes qui avancent', variant: 'grid', background: '$bg' }),
      faqSection('faq', chrono, chronoFaq, { title: 'Questions fréquentes', variant: 'cards', background: '#ffffff' }),
      ctaSection('cta', chrono, { title: 'Prêt à mieux travailler ?', subtitle: 'Commandez aujourd’hui, recevez demain, payez à la réception.', cta: 'COMMANDER MAINTENANT', secondaryCta: 'Voir les best-sellers' }),
      whatsappSection('wa', { headline: 'Un conseiller vous répond', nickname: 'Bureau & Tech' }),
    ]),
    product: productPage(chrono, { buyNowText: 'Commander — paiement à la livraison' }, productAfter(chrono, { usp: chronoFeatures, quotes: chronoQuotes, faqs: chronoFaq, related: 'Compléter votre bureau', testimonialVariant: 'grid', band: '#eef2ff' })),
    catalogue: cataloguePage(chrono, { title: 'Tout le catalogue', subtitle: 'Claviers, supports, lampes, hubs et planners, garantis 12 mois.', cols: 3 }, catalogueAfter(chrono, { usp: chronoFeatures, variant: 'cards', band: '#eef2ff' })),
  },
});

// ═══════════════════════════════════════════════════════════════ 7. Nature Hideaways — dark, warm

const hidePalette: ThemePalette = { primary: '#d97706', secondary: '#18181b', bg: '#09090b', text: '#f4f4f5', muted: '#a1a1aa', accent: '#f59e0b' };
const hide = lookFor(hidePalette, { kit: KITS.boutique, card: '#18181b', cardBorder: 'rgba(217,119,6,0.22)', band: '#111113', radius: 20, shadow: 'none' });
const hideUsp: Slide[] = [
  { title: '🌲 Bois massif', description: 'Chêne, noyer et cèdre de l’Atlas, huilés à la main, sans vernis.' },
  { title: '🛠️ Fabriqué au Maroc', description: 'Chaque pièce sort de notre atelier d’Ifrane, numérotée et signée.' },
  { title: '🚚 Livraison installée', description: 'Livré, monté et mis en place chez vous, partout au Royaume.' },
  { title: '💵 Paiement à la réception', description: 'Vous payez lorsque la pièce est installée et vérifiée.' },
];
const hideQuotes: Quote[] = [
  { name: 'Nour E.', city: 'Ifrane', text: 'La table en cèdre sent encore la forêt. Livrée et montée par deux artisans adorables.' },
  { name: 'Karim & Leïla', city: 'Casablanca', text: 'Notre chalet est devenu un refuge. Les finitions sont d’une douceur incroyable.' },
  { name: 'Riad Dar Zitoun', city: 'Marrakech', text: 'Douze chaises pour la salle du petit-déjeuner, toutes parfaites. Paiement à la livraison respecté.' },
];
const hideFaq: Faq[] = [
  { q: 'Le bois est-il traité ?', a: 'Huilé naturellement, sans vernis ni solvant. Un entretien à l’huile une fois par an suffit.' },
  { q: 'Le montage est-il compris ?', a: 'Oui. Nos livreurs montent la pièce chez vous, la mettent en place et repartent avec l’emballage.' },
  { q: 'Quel est le délai de livraison ?', a: '5 à 10 jours pour les pièces en stock, partout au Maroc. Vous payez une fois la pièce installée.' },
  COD_FAQ[0],
];

const HIDEAWAY = theme({
  id: 'hideaway',
  label: { fr: 'Atelier Bois Massif', en: 'Solid Wood Workshop' },
  description: { fr: 'Refuge chaleureux : nuit et ambre, accroche en deux colonnes avec les collections, catégories en puces, catalogue en carrousel, récit d’atelier et offre collection.', en: 'A warm refuge: night and amber, a two-column hero with the collections, category chips, a catalogue carousel, a workshop story and a collection offer.' },
  audience: { fr: 'Mobilier en bois massif, décoration scandinave, objets en bois, luminaires', en: 'Solid wood furniture, Scandinavian decor, wooden objects, lighting' },
  category: 'luxury',
  tags: ['Dark Mode', 'Ambre', 'Atelier', 'Sur-mesure'],
  badge: 'Édition Spéciale',
  rating: 4.94,
  downloads: 640,
  previewImage: '/images/themes/theme_hideaway.jpg',
  palette: hidePalette,
  fontFamily: 'Manrope',
  kit: 'boutique',
  pages: {
    header: headerPage(hide, { overlay: true, bg: 'transparent', text: '#ffffff', border: 'transparent', cartBg: 'rgba(255,255,255,0.12)', cta: 'Commander', ctaBg: '#ffffff', ctaColor: '#111827', ctaRadius: 999 }),
    footer: footerPage(hide, { bg: '#000000', text: '$text', border: 'rgba(255,255,255,0.08)', about: 'Mobilier en bois massif, dessiné et fabriqué dans notre atelier d’Ifrane, livré et installé partout au Maroc.', badges: ['Fabriqué au Maroc', 'Bois massif huilé', 'Paiement à la livraison'] }),
    home: homePage(hidePalette, [
      heroSection('hero', hide, {
        variant: 'split', align: 'left', size: '2xl', kicker: 'ATELIER D’IFRANE · DEPUIS 2016',
        title: 'Du bois massif, fait pour durer.', subtitle: 'Mobilier en bois massif, huilé à la main, numéroté et signé. Livré, monté et installé chez vous.',
        cta: 'Trouver ma pièce  →', ctaBg: '#ffffff', ctaColor: '#111827', ctaRadius: 999,
        titleColor: '#f4f4f5', subtitleColor: 'rgba(244,244,245,0.8)',
        image: asset('hideaway', 'hero'),
        highlights: pics([
          { title: '🌲 Collection Atlas', description: 'Cèdre et noyer : tables, bancs et consoles aux lignes pleines.' },
          { title: '🛖 Chalet', description: 'Lits, chevets et étagères pour les refuges de montagne.' },
          { title: '🕯️ Petits objets', description: 'Planches, bougeoirs, plateaux : le bois au quotidien.' },
        ], trio('hideaway')),
        background: 'linear-gradient(160deg,#0b1a1f 0%,#1c2a2e 50%,#3b2f1e 100%)', paddingTop: 150, paddingBottom: 80, maxWidth: 1280,
      }),
      chipsSection('social', hide, [{ label: 'Tables', url: '/products' }, { label: 'Chaises & bancs', url: '/products' }, { label: 'Lits & chevets', url: '/products' }, { label: 'Étagères', url: '/products' }, { label: 'Petits objets', url: '/products' }], { prefix: 'Collections', style: 'text', align: 'left', paddingTop: 12, paddingBottom: 12, maxWidth: 1280 }),
      productsSection('catalogue', hide, { title: 'Pièces disponibles', subtitle: 'En stock à l’atelier, livrées sous 10 jours.', big: true, layout: 'slider', cols: 3, ctaText: 'TOUT LE CATALOGUE' }),
      uspSection('usp', hide, hideUsp, { title: 'Ce qui fait une pièce de l’atelier', background: '#111113' }),
      storySection('story', hide, {
        image: asset('hideaway', 'story'),
        title: 'L’atelier',
        paragraphs: [
          'Nous travaillons le bois comme on l’a toujours fait à Ifrane : lentement. Chaque planche est choisie, séchée deux ans, puis assemblée sans vis apparente.',
          'Aucune pièce ne quitte l’atelier sans avoir été huilée à la main, numérotée et signée par celui qui l’a faite.',
        ],
        highlights: [{ title: 'Pièce n° 0412', description: 'Table Atlas, cèdre, 240 cm. Quatre semaines de travail.' }],
        cta: 'Visiter l’atelier', ctaLink: '/pages/a-propos', background: '$bg',
      }),
      statsSection('stats', hide, [{ value: '2 ans', label: 'de séchage du bois' }, { value: '+900', label: 'pièces numérotées' }, { value: '0', label: 'vernis, seulement de l’huile' }], { background: '#111113' }),
      testimonialsSection('reviews', hide, hideQuotes, { title: 'Chez eux', variant: 'carousel', background: '$bg' }),
      promoSection('custom', hide, { image: asset('hideaway', 'promo'), variant: 'split', title: 'Collection Atlas : -15 % sur les tables', subtitle: 'Cèdre et noyer, quatre tailles, montage et installation compris. Offre valable sur les pièces en stock jusqu’à la fin du mois.', countdown: '🌲 Dernières tables de la série en stock', cta: 'VOIR LES TABLES', background: '#18181b', titleColor: '$text', subtitleColor: '$muted', radius: 24 }),
      faqSection('faq', hide, hideFaq, { title: 'Questions fréquentes' }),
      ctaSection('cta', hide, { title: 'Faites entrer la forêt chez vous', subtitle: 'Commandez une pièce : livraison, montage et installation sont inclus.', cta: 'COMMANDER', ctaBg: '#09090b', ctaColor: '#ffffff' }),
      whatsappSection('wa', { headline: 'Parlez à l’atelier', nickname: 'Atelier Bois' }),
    ]),
    product: productPage(hide, { buyNowText: 'Commander — livrée et installée' }, productAfter(hide, { usp: hideUsp, quotes: hideQuotes, faqs: hideFaq, related: 'Dans la même essence', band: '#111113', cta: { title: 'Une autre taille, une autre essence ?', subtitle: 'La plupart des pièces existent en plusieurs dimensions et en chêne, noyer ou cèdre.', cta: 'VOIR TOUTE LA COLLECTION', ctaBg: '#09090b', ctaColor: '#ffffff' } })),
    catalogue: cataloguePage(hide, { title: 'Toutes les pièces', subtitle: 'Bois massif, fabriqué à Ifrane, livré et installé.', cols: 3 }, catalogueAfter(hide, { usp: hideUsp, variant: 'cards', band: '#111113' })),
  },
});

// ═══════════════════════════════════════════════════════════════ 8. FinPay Digital — light, trust

const finPalette: ThemePalette = { primary: '#0d9488', secondary: '#0f172a', bg: '#f0fdfa', text: '#134e4a', muted: '#3f6f6a', accent: '#06b6d4' };
const fin = lookFor(finPalette, { kit: KITS.bold, band: '#e6f7f4', cardBorder: '#cfe9e4', radius: 14, shadow: 'sm' });
const finUsp: Slide[] = [
  { title: '🔒 Codes vérifiés', description: 'Chaque carte et chaque code est testé avant d’être remis.' },
  { title: '⚡ Remise en main propre', description: 'Un coursier vous apporte le code sous 24h, vous payez à la réception.' },
  { title: '🧾 Facture incluse', description: 'Une facture nominative avec chaque commande, pour vous ou votre entreprise.' },
  { title: '💬 Aide à l’activation', description: 'Un conseiller vous guide sur WhatsApp jusqu’au crédit du compte.' },
];
const finQuotes: Quote[] = [
  { name: 'Anas B.', city: 'Casablanca', text: 'Carte cadeau reçue en main propre le lendemain, code activé du premier coup. Bien plus simple qu’une carte bancaire.' },
  { name: 'Hind L.', city: 'Rabat', text: 'J’ai payé mon abonnement annuel à la livraison, avec facture. Exactement ce qu’il me fallait.' },
  { name: 'Walid F.', city: 'Oujda', text: 'Livré à Oujda en 48h, support réactif pour l’activation. Je recommande.' },
];
const finFaq: Faq[] = [
  { q: 'Comment reçois-je mon code ?', a: 'Un coursier vous remet la carte ou le code imprimé, avec la facture. Vous payez à ce moment-là.' },
  { q: 'Les codes fonctionnent-ils au Maroc ?', a: 'Oui : chaque produit précise la région d’activation. En cas de doute, demandez-nous avant de commander.' },
  { q: 'Puis-je commander pour mon entreprise ?', a: 'Oui, avec facture au nom de l’entreprise et tarifs dégressifs à partir de 10 unités.' },
  COD_FAQ[2],
];

const FINPAY = theme({
  id: 'finpay',
  label: { fr: 'Cartes & Recharges', en: 'Gift Cards & Top-ups' },
  description: { fr: 'Confiance et clarté : menthe et sarcelle, produit vedette en carte, chiffres en tête, catégories en puces, catalogue en grille, remise en main propre en 4 étapes.', en: 'Trust and clarity: mint and teal, a featured product card, figures first, category chips, a grid catalogue and four-step hand delivery.' },
  audience: { fr: 'Cartes cadeaux, abonnements streaming & gaming, recharges, crédits digitaux', en: 'Gift cards, streaming and gaming subscriptions, top-ups, digital credits' },
  category: 'tech',
  tags: ['Confiance', 'Sarcelle', 'Étapes', 'Facture'],
  badge: 'Nouveau',
  rating: 4.92,
  downloads: 530,
  previewImage: '/images/themes/theme_finpay.jpg',
  palette: finPalette,
  fontFamily: 'Plus Jakarta Sans',
  kit: 'bold',
  pages: {
    header: headerPage(fin, { overlay: true, bg: 'transparent', text: '#ffffff', border: 'transparent', cartBg: 'rgba(255,255,255,0.12)', cta: 'Commander', ctaBg: '#5eead4', ctaColor: '#134e4a', ctaRadius: 999, secondary: 'Suivre ma commande', secondaryUrl: '/pages/suivi' }),
    footer: footerPage(fin, { about: 'Cartes cadeaux, abonnements et services digitaux, vérifiés et remis en main propre partout au Maroc, avec facture.', badges: ['Codes vérifiés', 'Facture incluse', 'Paiement à la livraison'] }),
    home: homePage(finPalette, [
      heroSection('hero', fin, {
        variant: 'center', align: 'left', size: 'xl', kicker: 'CARTES · ABONNEMENTS · SERVICES',
        title: 'Votre carte cadeau, livrée demain.', highlight: 'livrée demain',
        subtitle: 'Cartes cadeaux, abonnements et crédits vérifiés, apportés chez vous par coursier et payés à la réception. Sans carte bancaire.',
        cta: 'COMMANDER', ctaBg: '#5eead4', ctaColor: '#134e4a', ctaRadius: 999, secondaryCta: 'Voir le catalogue', secondaryStyle: 'link',
        titleColor: '#ffffff', subtitleColor: 'rgba(255,255,255,0.82)',
        bgImage: asset('finpay', 'hero'), overlay: 'rgba(15,118,110,0.7)',
        background: 'linear-gradient(135deg,#0f766e 0%,#134e4a 100%)', paddingTop: 140, paddingBottom: 88, maxWidth: 1280,
        card: { badge: 'Votre commande', title: 'Carte cadeau 500 DH', subtitle: 'Remise en main propre', rows: [{ label: 'Remise du code', value: 'sous 24h' }, { label: 'Facture', value: 'incluse' }, { label: 'Paiement', value: 'à la réception' }], figure: '0 DH', figureCaption: 'de frais de service', cta: 'Commander', dark: false },
      }),
      statsSection('stats', fin, [{ value: '+40 000', label: 'codes remis' }, { value: '24h', label: 'délai moyen de remise' }, { value: '100 %', label: 'de codes vérifiés' }, { value: '0', label: 'carte bancaire nécessaire' }], { background: '$primary', valueColor: '#ffffff', labelColor: 'rgba(255,255,255,0.8)' }),
      chipsSection('tags', fin, [{ label: 'Cartes cadeaux', url: '/products' }, { label: 'Abonnements', url: '/products' }, { label: 'Gaming', url: '/products' }, { label: 'Recharges', url: '/products' }], { style: 'outline', paddingTop: 16, paddingBottom: 8, background: '$bg' }),
      productsSection('catalogue', fin, { title: 'Cartes & abonnements disponibles', subtitle: 'Le prix affiché est le prix payé au coursier.', big: true, cols: 3, background: '$bg', ctaText: 'TOUT LE CATALOGUE' }),
      stepsSection('steps', fin, [
        { title: '1 · Choisissez', description: 'La carte, le montant ou la durée d’abonnement qu’il vous faut.' },
        { title: '2 · Commandez', description: 'Nom, téléphone, ville. Sans compte, sans carte bancaire.' },
        { title: '3 · Recevez', description: 'Un coursier vous remet le code et la facture sous 24h.' },
        { title: '4 · Activez', description: 'Vous payez à la remise, puis on vous guide jusqu’au crédit.' },
      ], { title: 'Remise en main propre, en 4 étapes', background: '#ffffff' }),
      uspSection('usp', fin, finUsp, { variant: 'marquee', background: '#e6f7f4' }),
      testimonialsSection('reviews', fin, finQuotes, { title: 'Ils ont choisi la simplicité', variant: 'carousel', background: '#ffffff' }),
      faqSection('faq', fin, finFaq, { title: 'Questions fréquentes', background: '$bg' }),
      ctaSection('cta', fin, { title: 'Votre code, demain, chez vous', subtitle: 'Commandez maintenant : remise sous 24h, paiement à la réception, facture incluse.', cta: 'COMMANDER', ctaBg: '$secondary', ctaColor: '#ffffff' }),
      whatsappSection('wa', { headline: 'Aide à l’activation', nickname: 'Cartes & Recharges' }),
    ]),
    product: productPage(fin, { buyNowText: 'Commander — remise en main propre' }, productAfter(fin, { usp: finUsp, quotes: finQuotes, faqs: finFaq, related: 'Souvent commandé avec', band: '#e6f7f4' })),
    catalogue: cataloguePage(fin, { title: 'Cartes, abonnements & services', subtitle: 'Vérifiés, remis en main propre, avec facture.', cols: 3 }, catalogueAfter(fin, { usp: finUsp, band: '#e6f7f4' })),
  },
});

// ═══════════════════════════════════════════════════════════════ 9. Casablanca Prestige — dark gold, serif

const casaPalette: ThemePalette = { primary: '#d4af37', secondary: '#09111e', bg: '#0b1322', text: '#ffffff', muted: '#94a3b8', accent: '#facc15' };
const casa = lookFor(casaPalette, { kit: KITS.luxe, card: '#101a2e', cardBorder: 'rgba(212,175,55,0.28)', band: '#09111e', radius: 4, shadow: 'none' });
const casaUsp: Slide[] = [
  { title: 'Authenticité garantie', description: 'Montres, parfums et bijoux accompagnés de leur certificat et de leur écrin d’origine.' },
  { title: 'Écrin & message', description: 'Chaque commande est présentée dans un écrin, avec une carte manuscrite si vous le souhaitez.' },
  { title: 'Livraison discrète', description: 'Remise en main propre, colis neutre, partout au Royaume, sous 48h.' },
  { title: 'Paiement à la réception', description: 'Ouvrez, vérifiez, puis réglez le livreur.' },
];
const casaQuotes: Quote[] = [
  { name: 'Reda H.', city: 'Casablanca', text: 'L’oud est exactement celui de la maison, scellé. L’écrin a fait de la commande un cadeau.' },
  { name: 'Amal T.', city: 'Rabat', text: 'La montre est arrivée avec son certificat et sa boîte. Service discret, livreur ponctuel.' },
  { name: 'Ismaël D.', city: 'Fès', text: 'Un cadeau de fiançailles commandé la veille, livré le lendemain matin. Merci.' },
];
const casaFaq: Faq[] = [
  { q: 'Les parfums sont-ils des originaux ?', a: 'Oui, scellés, avec le code-barres du lot. Nous n’avons ni testeur ni décanté.' },
  { q: 'Puis-je faire livrer un cadeau à une autre personne ?', a: 'Oui. Indiquez son adresse et votre message : nous livrons dans un écrin, sans facture visible.' },
  { q: 'Que se passe-t-il en cas de défaut ?', a: 'Reprise immédiate sous 7 jours, produit non ouvert, avec échange ou avoir.' },
  COD_FAQ[0],
];

const CASABLANCA = theme({
  id: 'casablanca',
  label: { fr: 'Casablanca Prestige', en: 'Casablanca Prestige' },
  description: { fr: 'Nuit et or : typographie serif, sélection en grille, récit de maison, garanties épurées, offre écrin cadeau et avis en douceur.', en: 'Night and gold: serif type, a grid selection, a house story, refined guarantees, a gift-box offer and gentle reviews.' },
  audience: { fr: 'Horlogerie de luxe, parfumerie fine, oud, bijoux précieux, cadeaux VIP', en: 'Luxury watches, fine perfumes, oud, fine jewelry' },
  category: 'luxury',
  tags: ['Dark Mode', 'Or', 'Serif', 'Cadeau'],
  badge: 'Premium',
  rating: 4.97,
  downloads: 890,
  previewImage: '/images/themes/theme_casablanca.jpg',
  palette: casaPalette,
  fontFamily: 'Playfair Display',
  kit: 'luxe',
  pages: {
    header: headerPage(casa, { icons: true, overlay: true, bg: 'transparent', text: '#d4af37', border: 'transparent', cartBg: 'rgba(212,175,55,0.12)', cta: 'Commander', ctaColor: '#09111e', ctaRadius: 2, linkCase: 'upper' }),
    footer: footerPage(casa, { bg: '#050a14', text: '$text', border: 'rgba(212,175,55,0.2)', about: 'Montres, parfums et bijoux authentiques, présentés dans leur écrin et livrés avec discrétion partout au Maroc.', badges: ['Authenticité certifiée', 'Écrin offert', 'Paiement à la livraison'] }),
    home: homePage(casaPalette, [
      heroSection('hero', casa, {
        variant: 'split', align: 'left', size: '2xl', serif: true, uppercase: true, kicker: 'Un héritage royal du temps et du parfum', kickerStyle: 'line',
        title: 'Prestige & élégance', subtitle: 'Montres, parfums d’exception et bijoux authentiques, présentés dans leur écrin. Livrés sous 48h, réglés à la réception.',
        cta: 'EXPLORER LA COLLECTION', ctaBg: 'transparent', ctaColor: '#d4af37', ctaRadius: 2, secondaryCta: 'Voir l’oud', secondaryStyle: 'link',
        titleColor: '#d4af37', subtitleColor: '#e2e8f0',
        image: asset('casablanca', 'hero'),
        highlights: pics([
          { title: 'Horlogerie', description: 'Pièces certifiées, écrin d’origine.' },
          { title: 'Oud & parfums', description: 'Flacons scellés, lots tracés.' },
          { title: 'Bijoux', description: 'Or, argent et pierres, avec certificat.' },
        ], trio('casablanca')),
        background: 'linear-gradient(135deg,#050a14 0%,#0b1322 55%,#151a2e 100%)', paddingTop: 150, paddingBottom: 80, maxWidth: 1280,
      }),
      productsSection('selection', casa, { title: 'La sélection', subtitle: 'Pièces disponibles immédiatement.', big: true, cols: 3, btnColor: '#09111e', ctaText: 'TOUTE LA COLLECTION' }),
      storySection('story', casa, {
        image: asset('casablanca', 'story'),
        title: 'La maison',
        paragraphs: [
          'Casablanca Prestige est née d’une boutique de la rue d’Alger, où l’on venait chercher un parfum introuvable ailleurs ou une montre pour marquer un jour.',
          'Nous n’avons gardé que cela : des pièces authentiques, choisies une à une, présentées comme un cadeau, livrées avec discrétion.',
        ],
        highlights: pics([{ title: 'Le service écrin', description: 'Un coffret, un ruban, une carte manuscrite. Offert pour chaque commande.' }], trio('casablanca')),
        background: '#09111e',
      }),
      uspSection('usp', casa, casaUsp, { variant: 'plain', background: '$bg', titleColor: '$primary' }),
      testimonialsSection('reviews', casa, casaQuotes, { title: 'Paroles de clients', variant: 'carousel', background: '#09111e' }),
      promoSection('gift', casa, { image: asset('casablanca', 'promo'), variant: 'split', title: 'Offrir, sans se déplacer', subtitle: 'Indiquez l’adresse de la personne et votre message : nous livrons le cadeau dans son écrin, sans facture visible.', cta: 'COMMANDER UN CADEAU', ctaColor: '#09111e', background: '#101a2e', titleColor: '$text', subtitleColor: '$muted', radius: 8 }),
      faqSection('faq', casa, casaFaq, { title: 'Questions fréquentes' }),
      ctaSection('cta', casa, { title: 'Une pièce vous attend', subtitle: 'Commandez ce soir, recevez-la demain dans son écrin, réglez à la réception.', cta: 'COMMANDER', ctaBg: '#09111e', ctaColor: '#ffffff', titleColor: '#09111e', subtitleColor: 'rgba(9,17,30,0.75)' }),
      whatsappSection('wa', { headline: 'Un conseiller de la maison', nickname: 'Casablanca Prestige' }),
    ]),
    product: productPage(casa, { buyNowText: 'Commander — paiement à la réception', buttonColor: '#09111e' }, productAfter(casa, { usp: casaUsp, uspVariant: 'plain', quotes: casaQuotes, faqs: casaFaq, related: 'De la même maison', band: '#09111e', btnColor: '#09111e' })),
    catalogue: cataloguePage(casa, { title: 'La collection', subtitle: 'Montres, parfums, oud et bijoux authentiques.', cols: 3, btnColor: '#09111e' }, catalogueAfter(casa, { usp: casaUsp, variant: 'plain', band: '#09111e' })),
  },
});

// ═══════════════════════════════════════════════════════════════ 10. Jasmine Glow — light beauty

const jasPalette: ThemePalette = { primary: '#c026d3', secondary: '#701a75', bg: '#fdf4f5', text: '#4a044e', muted: '#86198f', accent: '#e879f9' };
const jas = lookFor(jasPalette, { kit: KITS.magazine, band: '#fbe8f1', cardBorder: '#f5d0e6', radius: 24, shadow: 'sm' });
const jasUsp: Slide[] = [
  { title: '🌸 Formules naturelles', description: 'Safran, argan et rose de Kelaat M’Gouna, sans paraben ni silicone.' },
  { title: '🧪 Testés dermatologiquement', description: 'Chaque soin est testé sur peaux sensibles, sous contrôle dermatologique.' },
  { title: '🎁 Échantillons offerts', description: 'Deux échantillons glissés dans chaque commande pour découvrir la gamme.' },
];
const jasQuotes: Quote[] = [
  { name: 'Sofia M.', city: 'Casablanca', text: 'Le sérum au safran a unifié mon teint en trois semaines. Texture légère, parfum délicat.' },
  { name: 'Meryem O.', city: 'Rabat', text: 'Commandé lundi, reçu mardi, avec deux échantillons. Payé à la livraison, sans souci.' },
  { name: 'Houda A.', city: 'Kénitra', text: 'Enfin des soins naturels qui tiennent leurs promesses. Ma peau est plus douce et plus lumineuse.' },
];
const jasFaq: Faq[] = [
  { q: 'Pour quel type de peau ?', a: 'Nos formules conviennent à toutes les peaux, y compris sensibles. La fiche de chaque soin précise les cas particuliers.' },
  { q: 'Au bout de combien de temps voit-on des résultats ?', a: 'Une peau plus douce dès la première semaine, un teint visiblement unifié après 3 à 4 semaines.' },
  { q: 'Les soins sont-ils testés sur les animaux ?', a: 'Non, jamais. Nos formules sont végétales et non testées sur les animaux.' },
  COD_FAQ[3],
];

const JASMINE = theme({
  id: 'jasmine',
  label: { fr: 'Jasmine Glow Botanicals', en: 'Jasmine Glow' },
  description: { fr: 'Douceur et éclat : rose poudré, accroche en deux colonnes avec les rituels, gamme en grille, rituel du soir en trois gestes, offre découverte à durée limitée.', en: 'Softness and glow: powder pink, a two-column hero with the rituals, a grid range, a three-step evening ritual and a limited discovery offer.' },
  audience: { fr: 'Cosmétiques, sérums anti-âge, huiles précieuses, soins spa & beauté', en: 'Cosmetics, anti-aging serums, botanical skincare' },
  category: 'beauty',
  tags: ['Beauté', 'Rose', 'Rituel', 'Offre'],
  badge: 'Top Beauté',
  rating: 4.95,
  downloads: 1740,
  previewImage: '/images/themes/theme_jasmine.jpg',
  palette: jasPalette,
  fontFamily: 'Plus Jakarta Sans',
  kit: 'magazine',
  pages: {
    header: headerPage(jas, { icons: true, bg: 'transparent', text: '#4a044e', border: 'transparent', overlay: true, brandAlign: 'center', linkCase: 'upper', cta: '', cartBg: 'transparent' }),
    footer: footerPage(jas, { about: 'Des soins botaniques formulés au Maroc, testés dermatologiquement et livrés partout, avec paiement à la réception.', badges: ['Formules naturelles', 'Testé dermatologiquement', 'Paiement à la livraison'] }),
    home: homePage(jasPalette, [
      heroSection('hero', jas, {
        variant: 'split', align: 'left', size: '2xl', serif: true, kicker: 'JASMINE GLOW',
        title: 'L’éclat pur des botaniques marocaines', subtitle: 'Illuminez votre peau de la radiance de la nature. Un mélange luxueux au safran, à l’argan et à la rose, pour une beauté sans âge.',
        cta: 'COMMANDER', secondaryCta: 'DÉCOUVRIR L’HUILE ÉCLAT  →', secondaryStyle: 'outline', ctaRadius: 999,
        titleColor: '#4a044e', subtitleColor: '#6b214f',
        image: asset('jasmine', 'hero'),
        highlights: pics([
          { title: '✨ Rituel Éclat', description: 'Sérum au safran + crème de jour : un teint unifié en 3 semaines.' },
          { title: '🌙 Rituel Nuit', description: 'Huile d’argan et rose pour une peau régénérée au réveil.' },
          { title: '💧 Rituel Hydratation', description: 'Brume et gel pour les peaux qui tirent.' },
        ], trio('jasmine')),
        background: 'linear-gradient(135deg,#f6dfe6 0%,#fdf4f5 45%,#efe0d2 100%)', paddingTop: 88, paddingBottom: 72, maxWidth: 1280,
      }),
      uspSection('usp', jas, jasUsp, { background: '$bg', paddingTop: 24, paddingBottom: 24 }),
      productsSection('range', jas, { title: 'La gamme', subtitle: 'Des formules courtes, des résultats visibles.', big: true, cols: 3, background: '#ffffff', ctaText: 'VOIR TOUTE LA GAMME' }),
      stepsSection('ritual', jas, [
        { title: '1 · Nettoyez', description: 'Le gel nettoyant à la rose, matin et soir, sur peau humide.' },
        { title: '2 · Traitez', description: 'Trois gouttes de sérum au safran, tapotées sur le visage et le cou.' },
        { title: '3 · Protégez', description: 'La crème de jour ou l’huile de nuit, selon l’heure.' },
      ], { title: 'Le rituel en trois gestes', variant: 'columns', background: '#fbe8f1' }),
      testimonialsSection('reviews', jas, jasQuotes, { title: 'Avant / après, par elles', variant: 'grid', background: '#ffffff' }),
      promoSection('offer', jas, { image: asset('jasmine', 'promo'), title: 'Coffret découverte : -25 % cette semaine', subtitle: 'Sérum, crème et huile en format voyage, pour tester le rituel complet.', countdown: '🌸 Offre valable jusqu’à dimanche soir', cta: 'J’EN PROFITE', background: '$primary', titleColor: '#ffffff', subtitleColor: 'rgba(255,255,255,0.85)', ctaBg: '#ffffff', ctaColor: '#701a75', radius: 28 }),
      faqSection('faq', jas, jasFaq, { title: 'Vos questions', variant: 'cards', background: '$bg' }),
      ctaSection('cta', jas, { title: 'Votre peau mérite mieux que d’attendre', subtitle: 'Commandez ce soir, recevez sous 48h, payez à la réception.', cta: 'COMMANDER MON RITUEL' }),
      whatsappSection('wa', { headline: 'Un conseil beauté ?', nickname: 'Jasmine Glow' }),
    ]),
    product: productPage(jas, { buyNowText: 'Commander — paiement à la réception' }, productAfter(jas, { usp: jasUsp, quotes: jasQuotes, faqs: jasFaq, countdown: '🌸 Deux échantillons offerts avec ce soin, cette semaine', related: 'Compléter le rituel', testimonialVariant: 'grid', band: '#fbe8f1' })),
    catalogue: cataloguePage(jas, { title: 'Tous les soins', subtitle: 'Sérums, huiles, crèmes et rituels complets.', cols: 3 }, catalogueAfter(jas, { usp: jasUsp, variant: 'cards', band: '#fbe8f1' })),
  },
});

// ═══════════════════════════════════════════════════════════════ 11. Souk Artisanal — warm, heritage

const soukPalette: ThemePalette = { primary: '#b45309', secondary: '#451a03', bg: '#fef3c7', text: '#292524', muted: '#78716c', accent: '#d97706' };
const souk = lookFor(soukPalette, { kit: KITS.brutal, band: '#fde9b4', card: '#fffbeb', cardBorder: '#f3d99b', radius: 12, shadow: 'sm' });
const soukUsp: Slide[] = [
  { title: '🤲 Fait main', description: 'Chaque pièce est façonnée par un artisan ou une coopérative que nous connaissons par son nom.' },
  { title: '🌿 Argan pur', description: 'Pressé à froid par les coopératives d’Essaouira, sans mélange ni additif.' },
  { title: '📦 Emballé avec soin', description: 'Poteries calées, huiles scellées : rien n’arrive cassé.' },
  { title: '💵 Paiement à la réception', description: 'Vous payez le livreur, en espèces, une fois le colis vérifié.' },
];
const soukQuotes: Quote[] = [
  { name: 'Claire D.', city: 'Casablanca', text: 'Le tajine de Safi est superbe, arrivé sans une rayure. L’huile d’argan est la meilleure que j’aie goûtée.' },
  { name: 'Khadija R.', city: 'Rabat', text: 'J’ai commandé des épices pour la Aïd : fraîches, parfumées, livrées en deux jours.' },
  { name: 'Mounir S.', city: 'Tanger', text: 'Un cadeau pour mes parents en Europe préparé ici, emballé à la perfection. Merci pour le petit mot.' },
];
const soukFaq: Faq[] = [
  { q: 'D’où viennent les produits ?', a: 'De coopératives et d’ateliers du Souss, de Fès, de Safi et du Haut Atlas, que nous visitons chaque saison.' },
  { q: 'L’huile d’argan est-elle cosmétique ou alimentaire ?', a: 'Les deux existent : la fiche de chaque huile le précise. L’alimentaire est torréfiée, la cosmétique ne l’est pas.' },
  { q: 'Les poteries vont-elles au four ?', a: 'Les tajines de Safi oui, à feu doux. Les pièces décoratives vernissées non.' },
  COD_FAQ[0],
];

const SOUK = theme({
  id: 'souk',
  label: { fr: 'Souk Artisanal Terroir', en: 'Souk Heritage' },
  description: { fr: 'Chaleur du terroir : ocre et cannelle, ticker des régions, sélection en grille, récit des coopératives, garanties et coffret cadeau.', en: 'Warmth of the land: ochre and cinnamon, a regions ticker, a grid selection, the cooperatives story, guarantees and a gift box.' },
  audience: { fr: 'Argan cosmétique & culinaire, poterie de Fès, épices, coopératives féminines', en: 'Argan, handmade ceramics, spices, heritage crafts' },
  category: 'food',
  tags: ['Artisanat', 'Ocre', 'Terroir', 'Coopératives'],
  badge: 'Patrimoine',
  rating: 4.96,
  downloads: 1310,
  previewImage: '/images/themes/theme_souk.jpg',
  palette: soukPalette,
  fontFamily: 'Cairo',
  kit: 'brutal',
  pages: {
    header: headerPage(souk, { icons: true, announcement: '🌿 Nouvelle récolte d’argan — livraison offerte dès 250 DH', bg: '$bg', border: '#f3d99b', cartBg: '#fde9b4', cta: 'Commander', ctaRadius: 6 }),
    footer: footerPage(souk, { about: 'Argan, épices, poteries et tissages, choisis chez les artisans et les coopératives du Maroc, livrés partout au Royaume.', badges: ['Fait main', 'Coopératives partenaires', 'Paiement à la livraison'] }),
    home: homePage(soukPalette, [
      heroSection('hero', souk, {
        variant: 'center', align: 'center', size: '2xl', serif: true, kicker: 'Artisanat marocain | Boutique en ligne', kickerStyle: 'plain',
        title: 'Le goût du terroir marocain', subtitle: 'Huile d’argan, safran de Taliouine, poteries de Safi et tissages de l’Atlas : achetés aux artisans, livrés chez vous.',
        cta: 'Explorer la collection', ctaBg: '#fde68a', ctaColor: '#451a03', ctaRadius: 6, secondaryCta: 'Notre histoire', secondaryLink: '/pages/a-propos',
        titleColor: '#fffbeb', subtitleColor: 'rgba(255,251,235,0.88)',
        bgImage: asset('souk', 'hero'), overlay: 'rgba(69,26,3,0.45)',
        background: 'linear-gradient(160deg,#7c2d12 0%,#b45309 60%,#d97706 100%)', paddingTop: 110, paddingBottom: 96, maxWidth: 1000, minHeight: 480,
      }),
      uspSection('regions', souk, [
        { title: 'Essaouira', description: 'Huile d’argan des coopératives' },
        { title: 'Taliouine', description: 'Safran de montagne' },
        { title: 'Safi', description: 'Poteries et tajines' },
        { title: 'Fès', description: 'Zellige et céramique' },
        { title: 'Haut Atlas', description: 'Tapis et tissages berbères' },
        { title: 'Marrakech', description: 'Cuir et vannerie' },
      ], { variant: 'marquee', background: '$secondary', titleColor: '#fde68a', subtitleColor: 'rgba(255,255,255,0.75)', cardBg: 'rgba(255,255,255,0.06)', cardBorder: 'rgba(255,255,255,0.12)', paddingTop: 16, paddingBottom: 16 }),
      productsSection('selection', souk, { title: 'La sélection de la saison', subtitle: 'Ce que les artisans ont de meilleur en ce moment.', big: true, cols: 3, ctaText: 'TOUT LE SOUK' }),
      storySection('story', souk, {
        image: asset('souk', 'story'),
        title: 'Nos coopératives',
        paragraphs: [
          'Nous achetons directement aux coopératives féminines d’Essaouira, aux potiers de Safi et aux tisserandes de l’Atlas, au prix qu’ils fixent.',
          'Chaque produit porte le nom de l’atelier qui l’a fait. Quand vous commandez, vous savez qui vous remerciez.',
        ],
        highlights: pics([{ title: 'Coopérative Tafyoucht', description: 'Trente-deux femmes, un pressoir à froid, la meilleure huile du Souss.' }], trio('souk')),
        cta: 'Rencontrer les artisans', ctaLink: '/pages/a-propos', background: '#fde9b4',
      }),
      uspSection('usp', souk, soukUsp, { title: 'Pourquoi commander chez nous', background: '$bg' }),
      quoteSection('quote', souk, soukQuotes[0], { background: '$secondary', kicker: 'Ils ont goûté, touché, offert', size: 'xl', serif: true }),
      promoSection('gift', souk, { image: asset('souk', 'promo'), title: 'Le coffret du terroir', subtitle: 'Argan, safran, miel de thym et un bol de Safi, dans une boîte en bois d’arganier. Un cadeau qui raconte le Maroc.', cta: 'OFFRIR LE COFFRET', ctaBg: '#fde68a', ctaColor: '#451a03' }),
      faqSection('faq', souk, soukFaq, { title: 'Questions fréquentes' }),
      ctaSection('cta', souk, { title: 'Faites entrer le souk chez vous', subtitle: 'Commandez aujourd’hui, recevez sous 48h, payez à la réception.', cta: 'COMMANDER' }),
      whatsappSection('wa', { headline: 'Marhba ! Une question ?', nickname: 'Souk Terroir' }),
    ]),
    product: productPage(souk, { buyNowText: 'Commander — paiement à la réception' }, productAfter(souk, { usp: soukUsp, quotes: soukQuotes, faqs: soukFaq, related: 'Du même atelier', band: '#fde9b4' })),
    catalogue: cataloguePage(souk, { title: 'Tout le souk', subtitle: 'Argan, épices, poteries, tissages : fait main, livré partout.', cols: 3 }, catalogueAfter(souk, { usp: soukUsp, variant: 'cards', band: '#fde9b4' })),
  },
});

// ═══════════════════════════════════════════════════════════════ 12. Atlas Noir & Blanc — minimal

const atlasPalette: ThemePalette = { primary: '#111827', secondary: '#111827', bg: '#ffffff', text: '#111827', muted: '#6b7280' };
const atlas = lookFor(atlasPalette, { kit: KITS.minimal, band: '#f5f5f4', cardBorder: '#e5e7eb', radius: 0, shadow: 'none' });
const atlasUsp: Slide[] = [
  { title: 'Matières nobles', description: 'Coton peigné, laine mérinos, cuir pleine fleur. Rien de synthétique.' },
  { title: 'Coupes intemporelles', description: 'Des pièces dessinées pour durer dix ans, pas une saison.' },
  { title: 'Livraison 24/48h', description: 'Partout au Maroc, payée à la réception.' },
  { title: 'Échange sous 7 jours', description: 'Taille ou coloris : on échange, sans discussion.' },
];
const atlasQuotes: Quote[] = [
  { name: 'Yasmine C.', city: 'Casablanca', text: 'La chemise en coton peigné est parfaite : coupe nette, matière qui tient. Livrée en un jour.' },
  { name: 'Adam L.', city: 'Rabat', text: 'Un site sobre, des vêtements sobres, un service précis. Exactement ce que je cherchais.' },
  { name: 'Ines B.', city: 'Marrakech', text: 'Échange de taille en trois jours, sans frais. Le manteau en laine est magnifique.' },
];
const atlasFaq: Faq[] = [
  { q: 'Comment choisir ma taille ?', a: 'Chaque fiche indique les mesures à plat. En cas de doute, prenez la taille au-dessus : l’échange est gratuit.' },
  { q: 'Comment entretenir les pièces ?', a: 'Lavage à 30 °C pour le coton, à sec pour la laine. Une étiquette détaillée est cousue dans chaque pièce.' },
  COD_FAQ[0],
  COD_FAQ[2],
];

const ATLAS = theme({
  id: 'atlas',
  label: { fr: 'Atlas Noir & Blanc', en: 'Atlas Minimal' },
  description: { fr: 'Minimalisme absolu : noir, blanc, angles droits, beaucoup d’air. Grille 4 colonnes, nouveautés en carrousel, garanties en texte, avis et FAQ sobres.', en: 'Pure minimalism: black, white, sharp corners and air. A four-column grid, a novelties carousel, plain-text guarantees, quiet reviews and FAQ.' },
  audience: { fr: 'Mode intemporelle, accessoires créateurs, décoration minimaliste', en: 'Timeless fashion, designer accessories, minimalist decor' },
  category: 'fashion',
  tags: ['Minimal', 'Noir & Blanc', 'Angles droits', 'Épuré'],
  badge: 'Classique',
  rating: 4.9,
  downloads: 1050,
  previewImage: '/images/themes/theme_atlas.jpg',
  palette: atlasPalette,
  fontFamily: 'Manrope',
  kit: 'minimal',
  pages: {
    header: headerPage(atlas, { icons: true, announcement: 'Livraison offerte dès 400 DH — paiement à la réception', bg: '$bg', border: '#e5e7eb', cartBg: '#f5f5f4', cta: 'Commander', ctaRadius: 0, align: 'center', linkCase: 'upper' }),
    footer: footerPage(atlas, { about: 'Des vêtements et des objets dessinés pour durer. Livrés partout au Maroc, payés à la réception.', badges: ['Matières nobles', 'Échange sous 7 jours', 'Paiement à la livraison'], bg: '#111827' }),
    home: homePage(atlasPalette, [
      heroSection('hero', atlas, {
        variant: 'center', align: 'center', size: '2xl',
        title: 'Moins, mais mieux.', subtitle: 'Des pièces intemporelles en matières nobles. Livrées en 24/48h, payées à la réception.',
        cta: 'VOIR LA COLLECTION', ctaRadius: 0, image: asset('atlas', 'hero'), paddingTop: 128, paddingBottom: 88, maxWidth: 820,
      }),
      productsSection('collection', atlas, { title: 'La collection', cols: 4, radius: 0, shadow: 'none', big: false, align: 'left', ctaText: 'TOUT VOIR' }),
      uspSection('usp', atlas, atlasUsp, { variant: 'plain', background: '#f5f5f4', paddingTop: 32, paddingBottom: 32 }),
      storySection('story', atlas, {
        image: asset('atlas', 'story'),
        title: 'Notre approche',
        paragraphs: [
          'Une pièce doit se porter dix ans. Nous choisissons la matière d’abord, la coupe ensuite, et rien d’autre.',
          'Pas de logo, pas de saison. Une collection courte, disponible toute l’année.',
        ],
        background: '$bg', paddingTop: 56, paddingBottom: 56, maxWidth: 800,
      }),
      productsSection('new', atlas, { title: 'Nouveautés', layout: 'slider', cols: 4, radius: 0, shadow: 'none', align: 'left' }),
      testimonialsSection('reviews', atlas, atlasQuotes, { title: 'Ils portent Atlas', variant: 'grid', background: '#f5f5f4' }),
      faqSection('faq', atlas, atlasFaq, { title: 'Questions' }),
      ctaSection('cta', atlas, { title: 'Une garde-robe qui dure.', subtitle: 'Commandez maintenant. Livraison 24/48h, paiement à la réception.', cta: 'COMMANDER', ctaBg: '#ffffff', ctaColor: '#111827', background: '#111827', titleColor: '#ffffff', subtitleColor: 'rgba(255,255,255,0.7)' }),
      whatsappSection('wa', { headline: 'Une question ?', nickname: 'Atlas', headerBg: '#111827' }),
    ]),
    product: productPage(atlas, { buyNowText: 'Commander — paiement à la réception' }, productAfter(atlas, { usp: atlasUsp, uspVariant: 'plain', quotes: atlasQuotes, faqs: atlasFaq, related: 'À porter avec', relatedCols: 4, testimonialVariant: 'grid', band: '#f5f5f4' })),
    catalogue: cataloguePage(atlas, { title: 'Collection', subtitle: 'Toutes les pièces.', cols: 4, radius: 0, shadow: 'none' }, catalogueAfter(atlas, { usp: atlasUsp, variant: 'plain', band: '#f5f5f4' })),
  },
});

// ─────────────────────────────────────────────── the catalogue

export const THEMES: StoreTheme[] = [
  NOVATRADE, ESTATEO, AURA, MATCHA, GROWPLUS, CHRONOTASK, HIDEAWAY, FINPAY, CASABLANCA, JASMINE, SOUK, ATLAS,
];

export function getTheme(id: string): StoreTheme | undefined {
  return THEMES.find((t) => t.id === id);
}

/** Everything but the page documents, for the gallery. */
export function themeSummaries(): Omit<StoreTheme, 'pages'>[] {
  return THEMES.map(({ pages: _pages, ...rest }) => rest);
}

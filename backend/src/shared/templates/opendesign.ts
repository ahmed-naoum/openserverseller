import type { PageDocument, SectionNode } from '../document/types.js';
import {
  lookFor, mix, isDark, luminance, bakeTokens, headerPage, footerPage, productPage, cataloguePage,
  heroSection, uspSection, productsSection, statsSection, promoSection, stepsSection,
  testimonialsSection, faqSection, storySection, countdownSection, ctaSection, whatsappSection,
  featureSection, quoteSection, chipsSection,
  type Look, type Slide, type Quote, type Faq, type Stat, type PaletteLike,
} from './compose.js';
import { COD_USP, COD_STEPS, COD_FAQ } from './themes.js';
import { asset } from './assets.js';
import { KITS, KIT_IDS } from './kits.js';
import { pics } from './compose.js';
import type { BriefSpec, SpecCopy } from './briefSpec.js';
import { findSection, SECTIONS_CATALOG } from './sections.js';

/**
 * OpenDesign: a store design from a sentence.
 *
 * A seller writes what they sell and how it should feel — "boutique de
 * cosmétiques au safran, rose poudré, élégante" — and gets back a complete
 * store: palette, font, and the five pages, composed from the same parts the
 * shipped themes are made of (compose.ts). The engine reads the sentence for
 * the niche, the mood, any colour it names, and any section it asks for, and
 * then chooses a composition for it. The same sentence always gives the same
 * design; a different seed gives a different composition of the same brief,
 * which is what "generate another variant" does.
 *
 * Deterministic on purpose. There is no model behind this today: the output
 * is a function of the words, and every design it can produce compiles and
 * validates, because it is made only of parts that do. A model can be put in
 * front of it later to write the brief's copy; the composition stays here.
 *
 * Pure TypeScript, shared with the frontend through the `@shared` alias.
 */

export interface DesignBrief {
  prompt: string;
  /** The store's name, for the copy and the label. */
  storeName?: string;
  /** Which composition of this brief. 0 is the first; each increment is a new arrangement. */
  seed?: number;
  /** Force a light or dark page; `auto` reads the prompt, then the niche. */
  mode?: 'auto' | 'light' | 'dark';
  /** Brand values the seller set by hand in the token panel; they win over the prompt. */
  palette?: Partial<PaletteLike>;
  fontFamily?: string;
  /** Extra section IDs selected from the 60+ sections catalog */
  extraSectionIds?: string[];
  /**
   * Photos drawn for this brief (designImages.service), by slot. A slot that
   * is missing keeps the niche's stock photo; the composition is otherwise
   * unchanged, so a seller can add photos to a design they already like.
   */
  images?: Partial<Record<'hero' | 'story' | 'promo' | 'h1' | 'h2' | 'h3', string>>;
}

export interface GeneratedDesign {
  label: string;
  niche: string;
  nicheLabel: string;
  mood: 'light' | 'dark';
  palette: PaletteLike & { accent: string };
  fontFamily: string;
  seed: number;
  /** Which arrangement each part took. */
  variant: Record<string, string>;
  /** The home page's sections, in order, for the panel. */
  sections: string[];
  /** The decisions, in French, one line each. */
  rationale: string[];
  pages: { home: PageDocument; header: PageDocument; footer: PageDocument; product: PageDocument; catalogue: PageDocument };
}

// ─────────────────────────────────────────────── niches

interface Niche {
  id: string;
  label: string;
  keywords: string[];
  light: PaletteLike & { accent: string };
  dark: PaletteLike & { accent: string };
  /** Which ground the niche prefers when the prompt says nothing. */
  mood: 'light' | 'dark';
  font: string;
  kicker: string;
  headlines: string[];
  subhead: string;
  cta: string;
  announcement: string;
  usp: Slide[];
  highlights: Slide[];
  stats: Stat[];
  story: { title: string; paragraphs: string[]; highlight: Slide };
  promo: { title: string; subtitle: string; cta: string; countdown: string };
  quotes: Quote[];
  faqs: Faq[];
  related: string;
  catalogueTitle: string;
  catalogueSubtitle: string;
  nickname: string;
  about: string;
  badges: string[];
}

const N = (n: Niche) => n;

const NICHES: Niche[] = [
  N({
    id: 'beauty', label: 'Beauté & soins',
    keywords: ['beaut', 'cosm', 'soin', 'peau', 'sérum', 'serum', 'parfum', 'maquillage', 'cheveu', 'huile', 'crème', 'creme', 'spa', 'skincare', 'visage', 'anti-âge', 'anti-age'],
    light: { primary: '#c026d3', secondary: '#701a75', bg: '#fdf4f5', text: '#4a044e', muted: '#86198f', accent: '#e879f9' },
    dark: { primary: '#f0abfc', secondary: '#1a0b1d', bg: '#140a17', text: '#fdf4ff', muted: '#d8b4e2', accent: '#e879f9' },
    mood: 'light', font: 'Plus Jakarta Sans',
    kicker: 'SOINS · FORMULÉS AVEC SOIN',
    headlines: ['Révélez l’éclat de votre peau', 'Votre rituel beauté, livré chez vous', 'La beauté, sans compromis'],
    subhead: 'Des soins efficaces, testés dermatologiquement, livrés sous 48h et payés à la réception.',
    cta: 'DÉCOUVRIR LES SOINS', announcement: '🌸 Deux échantillons offerts dans chaque commande — livraison 24/48h',
    usp: [
      { title: '🌸 Formules naturelles', description: 'Actifs botaniques, sans paraben ni silicone.' },
      { title: '🧪 Testé dermatologiquement', description: 'Chaque soin est testé sur peaux sensibles.' },
      { title: '🎁 Échantillons offerts', description: 'Deux miniatures glissées dans chaque commande.' },
      { title: '💵 Paiement à la réception', description: 'Vous payez le livreur, une fois le colis vérifié.' },
    ],
    highlights: [
      { title: '✨ Rituel Éclat', description: 'Sérum et crème de jour pour un teint unifié en 3 semaines.' },
      { title: '🌙 Rituel Nuit', description: 'Huile et baume pour une peau régénérée au réveil.' },
      { title: '💧 Hydratation', description: 'Brume et gel pour les peaux qui tirent.' },
    ],
    stats: [{ value: '+8 000', label: 'clientes satisfaites' }, { value: '3 sem.', label: 'pour un résultat visible' }, { value: '0', label: 'paraben, silicone ou test animal' }],
    story: { title: 'Notre laboratoire', paragraphs: ['Nous formulons des soins courts : peu d’ingrédients, tous utiles, tous tracés.', 'Chaque lot est testé sous contrôle dermatologique avant d’être mis en flacon.'], highlight: { title: 'Formules courtes', description: 'Moins de douze ingrédients par soin, tous listés sur l’étiquette.' } },
    promo: { title: 'Coffret découverte : -25 % cette semaine', subtitle: 'Sérum, crème et huile en format voyage pour tester le rituel complet.', cta: 'J’EN PROFITE', countdown: '🌸 Offre valable jusqu’à dimanche soir' },
    quotes: [
      { name: 'Sofia M.', city: 'Casablanca', text: 'Le sérum a unifié mon teint en trois semaines. Texture légère, parfum délicat.' },
      { name: 'Meryem O.', city: 'Rabat', text: 'Commandé lundi, reçu mardi, avec deux échantillons. Payé à la livraison, sans souci.' },
      { name: 'Houda A.', city: 'Kénitra', text: 'Des soins naturels qui tiennent leurs promesses. Ma peau est plus douce.' },
    ],
    faqs: [
      { q: 'Pour quel type de peau ?', a: 'Toutes, y compris sensibles. La fiche de chaque soin précise les cas particuliers.' },
      { q: 'Quand voit-on des résultats ?', a: 'Une peau plus douce dès la première semaine, un teint unifié après 3 à 4 semaines.' },
      COD_FAQ[0], COD_FAQ[3],
    ],
    related: 'Compléter le rituel', catalogueTitle: 'Tous les soins', catalogueSubtitle: 'Sérums, huiles, crèmes et rituels complets.',
    nickname: 'Conseil beauté', about: 'Des soins formulés avec soin, testés dermatologiquement et livrés partout au Maroc, avec paiement à la réception.',
    badges: ['Formules naturelles', 'Testé dermatologiquement', 'Paiement à la livraison'],
  }),
  N({
    id: 'fashion', label: 'Mode & accessoires',
    keywords: ['mode', 'vêtement', 'vetement', 'streetwear', 'sneaker', 'chaussure', 'sac', 'caftan', 'djellaba', 'abaya', 'hijab', 'textile', 'robe', 'jean', 'hoodie', 't-shirt', 'tshirt', 'fashion', 'lunettes', 'montre'],
    light: { primary: '#111827', secondary: '#111827', bg: '#ffffff', text: '#111827', muted: '#6b7280', accent: '#ea580c' },
    dark: { primary: '#ea580c', secondary: '#09090b', bg: '#09090b', text: '#fafafa', muted: '#a1a1aa', accent: '#f97316' },
    mood: 'light', font: 'Manrope',
    kicker: 'NOUVELLE COLLECTION',
    headlines: ['Porte ce que la rue portera demain', 'Moins, mais mieux.', 'La collection que vous attendiez'],
    subhead: 'Des pièces choisies, en vraies matières, livrées en 24/48h partout au Maroc et payées à la réception.',
    cta: 'VOIR LA COLLECTION', announcement: '🔥 Nouveautés chaque semaine — livraison 24/48h — échange de taille gratuit',
    usp: [
      { title: '👟 100 % authentique', description: 'Pièces vérifiées, étiquettes et emballages d’origine.' },
      { title: '🔁 Échange de taille', description: 'Pas la bonne taille ? On échange sous 7 jours, gratuitement.' },
      { title: '🚚 Livré en 24/48h', description: 'Partout au Maroc, payé à la réception.' },
      { title: '💬 Conseil taille', description: 'Envoyez vos mesures sur WhatsApp, on vous guide.' },
    ],
    highlights: [
      { title: '🔥 Le drop', description: 'Nouvelles pièces chaque vendredi, en quantité limitée.' },
      { title: '⭐ Best-sellers', description: 'Les pièces que tout le monde commande.' },
      { title: '💥 Fins de série', description: 'Les dernières tailles à prix cassé.' },
    ],
    stats: [{ value: '+12 000', label: 'commandes livrées' }, { value: '24h', label: 'délai moyen' }, { value: '7 jours', label: 'pour échanger' }],
    story: { title: 'La marque', paragraphs: ['Nous dessinons des pièces pour durer plus d’une saison, dans des matières qui tiennent.', 'Chaque collection est produite en petite série, ce qui explique les drops et les ruptures.'], highlight: { title: 'Petites séries', description: 'Quand une taille est partie, elle ne revient pas avant le prochain drop.' } },
    promo: { title: 'Dernières tailles : -30 %', subtitle: 'Prix cassés sur les fins de série, jusqu’à ce soir minuit.', cta: 'J’EN PROFITE', countdown: '🔥 Fin de la promo dans quelques heures' },
    quotes: [
      { name: 'Ayoub K.', city: 'Casablanca', text: 'Pièce authentique, emballage d’origine, livrée en un jour.' },
      { name: 'Ghita M.', city: 'Rabat', text: 'Taille parfaite, matière lourde comme il faut. Échange facile la première fois.' },
      { name: 'Ilyas T.', city: 'Agadir', text: 'Prix corrects, stock réel, réponse WhatsApp en cinq minutes.' },
    ],
    faqs: [
      { q: 'Comment choisir ma taille ?', a: 'Un guide des tailles est sur chaque fiche. Un doute ? Envoyez vos mesures sur WhatsApp.' },
      { q: 'Que se passe-t-il si la taille ne va pas ?', a: 'Échange gratuit sous 7 jours, article non porté, dans son emballage.' },
      COD_FAQ[0], COD_FAQ[2],
    ],
    related: 'Compléter la tenue', catalogueTitle: 'Toute la collection', catalogueSubtitle: 'Vêtements, chaussures et accessoires, livrés en 24/48h.',
    nickname: 'Conseil taille', about: 'Des pièces choisies, en vraies matières, livrées partout au Maroc avec paiement à la réception.',
    badges: ['100 % authentique', 'Échange de taille', 'Paiement à la livraison'],
  }),
  N({
    id: 'tech', label: 'High-tech & électronique',
    keywords: ['tech', 'électro', 'electro', 'gadget', 'crypto', 'informatique', 'téléphone', 'telephone', 'smartphone', 'ordinateur', 'pc', 'gaming', 'casque', 'écouteur', 'ecouteur', 'connect', 'drone', 'caméra', 'camera', 'trading', 'accessoire tech'],
    light: { primary: '#2563eb', secondary: '#0f172a', bg: '#f8fafc', text: '#0f172a', muted: '#64748b', accent: '#06b6d4' },
    dark: { primary: '#06b6d4', secondary: '#090d16', bg: '#060910', text: '#f8fafc', muted: '#94a3b8', accent: '#a855f7' },
    mood: 'dark', font: 'Space Grotesk',
    kicker: 'NOUVELLE GÉNÉRATION',
    headlines: ['La technologie de demain, livrée demain', 'Le meilleur de la tech, au bon prix', 'Équipez-vous, sans attendre'],
    subhead: 'Appareils authentiques, testés et garantis 12 mois, expédiés sous 24h et payés à la réception.',
    cta: 'EXPLORER LA GAMME', announcement: '⚡ Nouveautés tech — expédition sous 24h & paiement à la réception',
    usp: [
      { title: '⚡ Expédition sous 24h', description: 'Stock réel. Commande avant 15h, colis parti le jour même.' },
      { title: '🛡️ Garantie 12 mois', description: 'Chaque appareil est testé avant envoi et couvert un an.' },
      { title: '💵 Paiement à la réception', description: 'Vérifiez le produit devant le livreur avant de payer.' },
      { title: '🎧 Support technique', description: 'Installation et configuration guidées sur WhatsApp.' },
    ],
    highlights: [
      { title: '🎧 Audio', description: 'Écouteurs et casques des grandes marques, scellés.' },
      { title: '⌚ Connecté', description: 'Montres et bracelets, configurés avec vous.' },
      { title: '🎮 Gaming', description: 'Manettes, claviers et accessoires pour jouer sérieusement.' },
    ],
    stats: [{ value: '+15 000', label: 'commandes livrées' }, { value: '24h', label: 'délai d’expédition' }, { value: '12 mois', label: 'de garantie' }],
    story: { title: 'Pourquoi nous', paragraphs: ['Nous achetons auprès de distributeurs officiels et testons chaque appareil avant de l’expédier.', 'La garantie est la nôtre : un défaut, un échange, sans discussion.'], highlight: { title: 'Testé avant envoi', description: 'Chaque appareil est allumé, vérifié et rescellé.' } },
    promo: { title: 'Vente flash : jusqu’à -40 %', subtitle: 'Stock limité, prix bloqués jusqu’à ce soir minuit.', cta: 'J’EN PROFITE', countdown: '⚡ L’offre expire dans quelques heures' },
    quotes: [
      { name: 'Yassine B.', city: 'Casablanca', text: 'Commandé le soir, reçu le lendemain midi. Produit authentique, scellé, avec la garantie.' },
      { name: 'Salma E.', city: 'Rabat', text: 'Le support m’a aidée à configurer mon appareil en dix minutes sur WhatsApp.' },
      { name: 'Omar T.', city: 'Marrakech', text: 'Prix plus bas qu’en magasin. J’ai payé à la réception, sans stress.' },
    ],
    faqs: [
      { q: 'Les produits sont-ils authentiques ?', a: 'Oui. Distributeurs officiels, scellés d’origine, facture fournie.' },
      { q: 'Que couvre la garantie ?', a: 'Tout défaut de fabrication pendant 12 mois : échange ou réparation, transport inclus.' },
      COD_FAQ[0], COD_FAQ[2],
    ],
    related: 'Compléter votre équipement', catalogueTitle: 'Tout le matériel', catalogueSubtitle: 'Authentique, testé, garanti 12 mois.',
    nickname: 'Support technique', about: 'Du matériel authentique, testé et garanti, livré partout au Maroc. Vous payez à la réception.',
    badges: ['Produits authentiques', 'Garantie 12 mois', 'Paiement à la livraison'],
  }),
  N({
    id: 'food', label: 'Épicerie & bien-être',
    keywords: ['aliment', 'thé', 'café', 'cafe', 'miel', 'épice', 'epice', 'bio', 'chocolat', 'datte', 'gourmand', 'cuisine', 'boisson', 'matcha', 'complément', 'complement', 'vitamine', 'nutrition', 'minceur', 'santé', 'sante', 'huile d’olive', 'huile d\'olive'],
    light: { primary: '#4d602b', secondary: '#242e12', bg: '#fbfcf8', text: '#1b230d', muted: '#6a784d', accent: '#849b4c' },
    dark: { primary: '#a3c460', secondary: '#141a0c', bg: '#0f140a', text: '#f4f7ec', muted: '#b8c79b', accent: '#84cc16' },
    mood: 'light', font: 'Playfair Display',
    kicker: 'RÉCOLTE DE LA SAISON',
    headlines: ['Le goût du vrai, livré chez vous', 'Bien manger commence ici', 'Des produits qui font du bien'],
    subhead: 'Des produits naturels, choisis à la source, conditionnés frais et livrés sous 48h, payés à la réception.',
    cta: 'DÉCOUVRIR LA SÉLECTION', announcement: '🌿 Nouvelle récolte disponible — livraison offerte dès 300 DH',
    usp: [
      { title: '🍃 Naturel', description: 'Sans additif, sans conservateur, récolte de l’année.' },
      { title: '📦 Fraîcheur scellée', description: 'Conditionné et expédié sous 48h de nos entrepôts.' },
      { title: '💵 Paiement à la réception', description: 'Goûtez d’abord, payez le livreur ensuite.' },
      { title: '💬 Conseil 7j/7', description: 'Préparation, conservation, dosage : on répond sur WhatsApp.' },
    ],
    highlights: [
      { title: '🍯 Les incontournables', description: 'Les produits que nos clients recommandent.' },
      { title: '🎁 Coffrets', description: 'À offrir ou à s’offrir, prêts à être emballés.' },
      { title: '🆕 Nouveautés', description: 'Les arrivages de la saison.' },
    ],
    stats: [{ value: '+6 000', label: 'commandes livrées' }, { value: '48h', label: 'délai de livraison' }, { value: '100 %', label: 'naturel' }],
    story: { title: 'De la source à votre table', paragraphs: ['Nous travaillons avec de petits producteurs que nous connaissons par leur nom.', 'Chaque produit est conditionné en petite quantité pour arriver frais.'], highlight: { title: 'Récolte 2026', description: 'Première cueillette, la plus fine de l’année.' } },
    promo: { title: 'Le coffret découverte', subtitle: 'Une sélection de nos meilleurs produits, dans une boîte à offrir.', cta: 'OFFRIR LE COFFRET', countdown: '🌿 Offre de lancement jusqu’à dimanche' },
    quotes: [
      { name: 'Imane L.', city: 'Casablanca', text: 'Livré en deux jours, parfaitement emballé. Le goût est incomparable.' },
      { name: 'Hamza D.', city: 'Rabat', text: 'Un service client adorable et des produits qui tiennent leurs promesses.' },
      { name: 'Sara B.', city: 'Tanger', text: 'Le coffret cadeau est magnifique. Ma sœur a adoré.' },
    ],
    faqs: [
      { q: 'Comment conserver les produits ?', a: 'Au frais, à l’abri de la lumière. Chaque fiche indique la durée de conservation.' },
      { q: 'Les produits sont-ils certifiés ?', a: 'Oui, nos fournisseurs sont certifiés et chaque lot est tracé.' },
      COD_FAQ[0], COD_FAQ[1],
    ],
    related: 'À déguster avec', catalogueTitle: 'Toute la sélection', catalogueSubtitle: 'Naturel, frais, livré sous 48h.',
    nickname: 'Conseil & préparation', about: 'Des produits naturels choisis à la source et livrés frais partout au Maroc.',
    badges: ['100 % naturel', 'Fraîcheur scellée', 'Paiement à la livraison'],
  }),
  N({
    id: 'home', label: 'Maison & décoration',
    keywords: ['maison', 'déco', 'deco', 'meuble', 'mobilier', 'literie', 'tapis', 'luminaire', 'jardin', 'cuisine', 'salon', 'électroménager', 'electromenager', 'ustensile', 'rangement', 'bois'],
    light: { primary: '#b45309', secondary: '#292524', bg: '#fafaf9', text: '#1c1917', muted: '#78716c', accent: '#d97706' },
    dark: { primary: '#d97706', secondary: '#18181b', bg: '#09090b', text: '#f4f4f5', muted: '#a1a1aa', accent: '#f59e0b' },
    mood: 'light', font: 'Manrope',
    kicker: 'POUR LA MAISON',
    headlines: ['Une maison qui vous ressemble', 'Des pièces qui durent', 'Le confort, livré et installé'],
    subhead: 'Meubles, décoration et équipement choisis pour durer, livrés partout au Maroc et payés à la réception.',
    cta: 'VOIR LES COLLECTIONS', announcement: '🏡 Livraison et installation incluses — paiement à la réception',
    usp: [
      { title: '🛠️ Livré et installé', description: 'Montage et mise en place chez vous, emballage retiré.' },
      { title: '🌲 Matières durables', description: 'Bois massif, métal, textiles épais : des pièces qui tiennent.' },
      { title: '💵 Paiement à la réception', description: 'Vous payez lorsque la pièce est installée et vérifiée.' },
      { title: '🔁 Échange sous 7 jours', description: 'Une pièce abîmée ou non conforme est reprise sans frais.' },
    ],
    highlights: [
      { title: '🛋️ Salon', description: 'Canapés, tables basses et luminaires.' },
      { title: '🛏️ Chambre', description: 'Lits, literie et rangements.' },
      { title: '🍽️ Cuisine', description: 'Tables, chaises et ustensiles.' },
    ],
    stats: [{ value: '+3 000', label: 'intérieurs équipés' }, { value: '7 jours', label: 'pour livrer et installer' }, { value: '2 ans', label: 'de garantie' }],
    story: { title: 'Notre atelier', paragraphs: ['Nous choisissons et fabriquons des pièces simples, solides, faciles à vivre.', 'Chaque commande est livrée, montée et installée par nos équipes.'], highlight: { title: 'Fabriqué au Maroc', description: 'La plupart de nos pièces sortent d’ateliers marocains.' } },
    promo: { title: 'Une pièce à vos mesures', subtitle: 'Envoyez vos dimensions : nous vous proposons un dessin et un délai.', cta: 'DEMANDER UN DEVIS', countdown: '🏡 Livraison offerte cette semaine' },
    quotes: [
      { name: 'Nour E.', city: 'Casablanca', text: 'Livrée et montée par deux artisans adorables. Les finitions sont impeccables.' },
      { name: 'Karim & Leïla', city: 'Rabat', text: 'Notre salon est transformé. Paiement à la livraison respecté.' },
      { name: 'Riad Dar Zitoun', city: 'Marrakech', text: 'Douze chaises, toutes parfaites, livrées en une semaine.' },
    ],
    faqs: [
      { q: 'L’installation est-elle comprise ?', a: 'Oui pour les meubles : nos équipes montent et installent chez vous.' },
      { q: 'Existe-t-il d’autres tailles ou coloris ?', a: 'Souvent, oui : chaque fiche liste les variantes en stock. Un doute ? Demandez-nous sur WhatsApp.' },
      COD_FAQ[0], COD_FAQ[3],
    ],
    related: 'Dans le même esprit', catalogueTitle: 'Toutes les pièces', catalogueSubtitle: 'Livrées et installées partout au Maroc.',
    nickname: 'Conseil déco', about: 'Des meubles et objets choisis pour durer, livrés et installés partout au Maroc.',
    badges: ['Livré et installé', 'Matières durables', 'Paiement à la livraison'],
  }),
  N({
    id: 'kids', label: 'Bébé & enfants',
    keywords: ['bébé', 'bebe', 'enfant', 'jouet', 'puériculture', 'puericulture', 'poussette', 'maman', 'naissance', 'école', 'ecole', 'kids'],
    light: { primary: '#0ea5e9', secondary: '#0c4a6e', bg: '#f0f9ff', text: '#0c4a6e', muted: '#4b7a95', accent: '#f472b6' },
    dark: { primary: '#38bdf8', secondary: '#0b1c2a', bg: '#08141f', text: '#f0f9ff', muted: '#9fc3d8', accent: '#f472b6' },
    mood: 'light', font: 'Plus Jakarta Sans',
    kicker: 'POUR LES PETITS',
    headlines: ['Tout pour bébé, livré à la maison', 'Grandir bien équipé', 'Des jouets qui font grandir'],
    subhead: 'Des produits sûrs, testés et conformes aux normes, livrés sous 48h et payés à la réception.',
    cta: 'DÉCOUVRIR', announcement: '🧸 Livraison offerte dès 300 DH — paiement à la réception',
    usp: [
      { title: '🛡️ Normes CE', description: 'Chaque produit est conforme aux normes de sécurité européennes.' },
      { title: '🚚 Livraison 24/48h', description: 'Partout au Maroc, quand vous en avez besoin.' },
      { title: '💵 Paiement à la réception', description: 'Vérifiez le colis, puis payez le livreur.' },
      { title: '💬 Conseil de maman', description: 'Une équipe de parents répond sur WhatsApp.' },
    ],
    highlights: [
      { title: '🍼 Naissance', description: 'Tout pour les premiers mois.' },
      { title: '🧸 Jouets', description: 'Éveil, motricité, imagination, par âge.' },
      { title: '🎒 École', description: 'Cartables, gourdes et fournitures.' },
    ],
    stats: [{ value: '+9 000', label: 'familles servies' }, { value: '48h', label: 'délai de livraison' }, { value: '100 %', label: 'conforme aux normes' }],
    story: { title: 'Par des parents, pour des parents', paragraphs: ['Nous choisissons ce que nous achèterions pour nos enfants, et rien d’autre.', 'Chaque produit est testé chez nous avant d’entrer au catalogue.'], highlight: { title: 'Testé à la maison', description: 'Par nos propres enfants, qui ne sont pas tendres.' } },
    promo: { title: 'Le pack naissance : -20 %', subtitle: 'Tout l’essentiel des premiers mois, en une commande.', cta: 'VOIR LE PACK', countdown: '🧸 Offre valable jusqu’à dimanche' },
    quotes: [
      { name: 'Salma R.', city: 'Casablanca', text: 'La poussette est arrivée montée, en 24h. Service au top.' },
      { name: 'Youssef M.', city: 'Fès', text: 'Des jouets solides, bien choisis par âge. Mes enfants adorent.' },
      { name: 'Amina T.', city: 'Rabat', text: 'Conseil précieux sur WhatsApp pour choisir le siège auto.' },
    ],
    faqs: [
      { q: 'Les jouets sont-ils sûrs ?', a: 'Oui, tous conformes aux normes CE, avec l’âge recommandé sur chaque fiche.' },
      { q: 'Puis-je échanger une taille ?', a: 'Oui, sous 7 jours, article non porté.' },
      COD_FAQ[0], COD_FAQ[2],
    ],
    related: 'Souvent commandé avec', catalogueTitle: 'Tout pour les enfants', catalogueSubtitle: 'Sûr, testé, livré sous 48h.',
    nickname: 'Conseil parents', about: 'Des produits sûrs pour les bébés et les enfants, choisis par des parents et livrés partout au Maroc.',
    badges: ['Normes CE', 'Livraison 24/48h', 'Paiement à la livraison'],
  }),
  N({
    id: 'sport', label: 'Sport & fitness',
    keywords: ['sport', 'fitness', 'muscu', 'vélo', 'velo', 'yoga', 'running', 'gym', 'football', 'entraînement', 'entrainement', 'haltère', 'haltere', 'protéine', 'proteine'],
    light: { primary: '#dc2626', secondary: '#0f172a', bg: '#ffffff', text: '#0f172a', muted: '#64748b', accent: '#f97316' },
    dark: { primary: '#ef4444', secondary: '#0a0a0a', bg: '#0a0a0a', text: '#fafafa', muted: '#a3a3a3', accent: '#f97316' },
    mood: 'dark', font: 'Space Grotesk',
    kicker: 'ÉQUIPEMENT · PERFORMANCE',
    headlines: ['Entraînez-vous comme un pro', 'Votre salle, chez vous', 'Le matériel qui vous suit'],
    subhead: 'Équipement de sport et nutrition, livrés en 24/48h partout au Maroc, payés à la réception.',
    cta: 'VOIR L’ÉQUIPEMENT', announcement: '💪 Livraison offerte dès 500 DH — paiement à la réception',
    usp: [
      { title: '🏋️ Matériel pro', description: 'Le même équipement que dans les salles, garanti 2 ans.' },
      { title: '🚚 Livré en 24/48h', description: 'Partout au Maroc, même les charges lourdes.' },
      { title: '💵 Paiement à la réception', description: 'Vérifiez le matériel, puis payez le livreur.' },
      { title: '📋 Programmes offerts', description: 'Un programme d’entraînement avec chaque commande.' },
    ],
    highlights: [
      { title: '🏠 Home gym', description: 'Haltères, bancs et racks pour s’entraîner chez soi.' },
      { title: '🏃 Cardio', description: 'Vélos, tapis et cordes.' },
      { title: '🥤 Nutrition', description: 'Protéines et compléments authentiques.' },
    ],
    stats: [{ value: '+7 000', label: 'athlètes équipés' }, { value: '24h', label: 'délai d’expédition' }, { value: '2 ans', label: 'de garantie' }],
    story: { title: 'Notre équipe', paragraphs: ['Nous sommes des sportifs qui en avaient assez du matériel qui casse.', 'Tout ce que nous vendons, nous l’utilisons.'], highlight: { title: 'Testé en salle', description: 'Chaque référence passe trois mois dans notre salle avant le catalogue.' } },
    promo: { title: 'Pack home gym : -25 %', subtitle: 'Banc, haltères réglables et tapis, pour commencer sérieusement.', cta: 'VOIR LE PACK', countdown: '💪 Offre valable jusqu’à dimanche' },
    quotes: [
      { name: 'Mehdi K.', city: 'Casablanca', text: 'Banc solide, livré en 24h, monté en dix minutes.' },
      { name: 'Rania S.', city: 'Rabat', text: 'Le programme offert m’a vraiment aidée à démarrer.' },
      { name: 'Anas B.', city: 'Tanger', text: 'Matériel de qualité pro, prix correct, payé à la réception.' },
    ],
    faqs: [
      { q: 'Le matériel est-il garanti ?', a: 'Oui, 2 ans sur tout l’équipement, hors usure normale.' },
      { q: 'Livrez-vous les charges lourdes ?', a: 'Oui, partout au Maroc. Le livreur monte jusqu’à votre porte.' },
      COD_FAQ[0], COD_FAQ[2],
    ],
    related: 'Compléter votre équipement', catalogueTitle: 'Tout l’équipement', catalogueSubtitle: 'Matériel pro, garanti, livré en 24/48h.',
    nickname: 'Coach', about: 'Équipement de sport et nutrition de qualité pro, livrés partout au Maroc avec paiement à la réception.',
    badges: ['Matériel pro', 'Garantie 2 ans', 'Paiement à la livraison'],
  }),
  N({
    id: 'jewelry', label: 'Bijoux & luxe',
    keywords: ['bijou', 'argent', 'luxe', 'prestige', 'diamant', 'oud', 'horloger', 'joaill', 'précieux', 'precieux', 'cadeau', 'haut de gamme'],
    light: { primary: '#d97706', secondary: '#0f172a', bg: '#ffffff', text: '#0f172a', muted: '#64748b', accent: '#f59e0b' },
    dark: { primary: '#d4af37', secondary: '#09111e', bg: '#0b1322', text: '#ffffff', muted: '#94a3b8', accent: '#facc15' },
    mood: 'dark', font: 'Playfair Display',
    kicker: 'COLLECTION SIGNATURE',
    headlines: ['L’élégance se livre en main propre', 'Des pièces d’exception', 'Offrir, sans se déplacer'],
    subhead: 'Bijoux, montres et parfums authentiques, présentés dans leur écrin, livrés sous 48h et réglés à la réception.',
    cta: 'DÉCOUVRIR LA COLLECTION', announcement: '✦ Écrin offert pour toute commande — livraison discrète sous 48h',
    usp: [
      { title: 'Authenticité garantie', description: 'Certificat et écrin d’origine avec chaque pièce.' },
      { title: 'Écrin & message', description: 'Un coffret, un ruban, une carte manuscrite si vous le souhaitez.' },
      { title: 'Livraison discrète', description: 'Colis neutre, remis en main propre, sous 48h.' },
      { title: 'Paiement à la réception', description: 'Ouvrez, vérifiez, puis réglez le livreur.' },
    ],
    highlights: [
      { title: '💍 Bagues', description: 'Or, argent et pierres, toutes tailles.' },
      { title: '⌚ Montres', description: 'Authentiques, avec certificat.' },
      { title: '🎁 Cadeaux', description: 'Livrés dans leur écrin, à l’adresse de votre choix.' },
    ],
    stats: [{ value: '12 ans', label: 'de maison' }, { value: '+4 000', label: 'écrins livrés' }, { value: '100 %', label: 'authentique' }],
    story: { title: 'La maison', paragraphs: ['Nous sélectionnons chaque pièce une à une, pour son dessin et sa provenance.', 'Chaque commande est présentée comme un cadeau et livrée avec discrétion.'], highlight: { title: 'Le service écrin', description: 'Offert pour chaque commande.' } },
    promo: { title: 'Offrir, sans se déplacer', subtitle: 'Indiquez l’adresse et votre message : nous livrons le cadeau dans son écrin, sans facture visible.', cta: 'COMMANDER UN CADEAU', countdown: '✦ Gravure offerte cette semaine' },
    quotes: [
      { name: 'Reda H.', city: 'Casablanca', text: 'L’écrin a fait de la commande un cadeau. Livreur ponctuel et discret.' },
      { name: 'Amal T.', city: 'Rabat', text: 'Arrivée avec son certificat et sa boîte. Service irréprochable.' },
      { name: 'Ismaël D.', city: 'Fès', text: 'Commandé la veille, livré le lendemain matin pour des fiançailles.' },
    ],
    faqs: [
      { q: 'Les pièces sont-elles authentiques ?', a: 'Oui, avec certificat et écrin d’origine. Nous ne vendons aucune copie.' },
      { q: 'Puis-je faire livrer un cadeau ?', a: 'Oui, à l’adresse de votre choix, sans facture visible, avec votre message.' },
      COD_FAQ[0], COD_FAQ[3],
    ],
    related: 'De la même maison', catalogueTitle: 'La collection', catalogueSubtitle: 'Bijoux, montres et parfums authentiques.',
    nickname: 'Conseiller de la maison', about: 'Des pièces authentiques, présentées dans leur écrin et livrées avec discrétion partout au Maroc.',
    badges: ['Authenticité certifiée', 'Écrin offert', 'Paiement à la livraison'],
  }),
  N({
    id: 'saas', label: 'Digital & formations',
    keywords: ['logiciel', 'saas', 'formation', 'cours', 'abonnement', 'digital', 'ebook', 'licence', 'application', 'outil', 'coaching', 'service'],
    light: { primary: '#2563eb', secondary: '#1e293b', bg: '#f8fafc', text: '#0f172a', muted: '#64748b', accent: '#3b82f6' },
    dark: { primary: '#60a5fa', secondary: '#0b1220', bg: '#070b14', text: '#f1f5f9', muted: '#94a3b8', accent: '#22d3ee' },
    mood: 'light', font: 'Manrope',
    kicker: 'OUTILS · LICENCES · FORMATIONS',
    headlines: ['Les bons outils, activés aujourd’hui', 'Apprenez, avancez, livrés chez vous', 'Le digital, payé en espèces'],
    subhead: 'Licences, abonnements et formations livrés avec facture et prise en main, payés à la réception.',
    cta: 'VOIR LES FORMULES', announcement: '🚀 Activation sous 10 minutes — facture incluse — paiement à la réception',
    usp: [
      { title: '⚡ Activation immédiate', description: 'Votre accès arrive par WhatsApp et e-mail dès la validation.' },
      { title: '🔐 Licences officielles', description: 'Clés authentiques, avec facture.' },
      { title: '🎓 Prise en main incluse', description: 'Un guide pas-à-pas pour chaque outil.' },
      { title: '💵 Paiement à la réception', description: 'Un coursier vous remet le code, vous payez à ce moment-là.' },
    ],
    highlights: [
      { title: '🧰 Outils', description: 'Les logiciels dont votre équipe a besoin.' },
      { title: '🎓 Formations', description: 'Des parcours concrets, en français.' },
      { title: '🏢 Équipes', description: 'Tarifs dégressifs dès 5 postes.' },
    ],
    stats: [{ value: '10 min', label: 'pour être activé' }, { value: '-35 %', label: 'vs. tarif éditeur' }, { value: '100 %', label: 'de licences officielles' }],
    story: { title: 'Pourquoi nous', paragraphs: ['Nous distribuons officiellement les outils que nous utilisons nous-mêmes.', 'Chaque commande arrive avec une facture et une session de prise en main.'], highlight: { title: 'Facture incluse', description: 'Nominative, pour vous ou votre entreprise.' } },
    promo: { title: 'Formules annuelles à -20 %', subtitle: 'Douze mois pour le prix de dix, facture incluse, code remis en main propre.', cta: 'VOIR LES FORMULES', countdown: '🚀 -20 % sur les formules annuelles cette semaine' },
    quotes: [
      { name: 'Agence Nomad', city: 'Casablanca', text: 'Licences reçues en dix minutes, facture propre, support qui connaît les outils.' },
      { name: 'Youssef A.', city: 'Rabat', text: 'Abonnement annuel moins cher qu’en direct, payé à la livraison.' },
      { name: 'Studio Kech', city: 'Marrakech', text: 'La prise en main nous a fait gagner une semaine.' },
    ],
    faqs: [
      { q: 'Comment reçois-je ma licence ?', a: 'Par WhatsApp et e-mail, avec le guide d’activation, dès la validation.' },
      { q: 'Puis-je payer à la livraison un produit digital ?', a: 'Oui : un coursier vous remet le code et la facture, vous réglez à la réception.' },
      { q: 'Puis-je commander plusieurs licences ?', a: 'Oui. Dès 5 unités, écrivez-nous sur WhatsApp pour un tarif dégressif et une facture au nom de l’entreprise.' },
      COD_FAQ[2],
    ],
    related: 'Formules complémentaires', catalogueTitle: 'Toutes les formules', catalogueSubtitle: 'Licences, abonnements et formations, avec facture.',
    nickname: 'Conseiller', about: 'Licences, abonnements et formations pour ceux qui veulent avancer plus vite. Facture et activation garanties.',
    badges: ['Licences officielles', 'Activation immédiate', 'Paiement à la livraison'],
  }),
  N({
    id: 'energy', label: 'Énergie & écologie',
    keywords: ['solaire', 'énergie', 'energie', 'écolog', 'ecolog', 'panneau', 'batterie', 'électrique', 'electrique', 'vert', 'durable', 'pompage'],
    light: { primary: '#15803d', secondary: '#052e16', bg: '#f8fafc', text: '#0f172a', muted: '#475569', accent: '#84cc16' },
    dark: { primary: '#4ade80', secondary: '#04140a', bg: '#030d06', text: '#f0fdf4', muted: '#9fd3ad', accent: '#84cc16' },
    mood: 'light', font: 'Plus Jakarta Sans',
    kicker: 'TRANSITION ÉNERGÉTIQUE',
    headlines: ['Une nouvelle énergie pour votre foyer', 'Produisez votre électricité', 'Le solaire, installé chez vous'],
    subhead: 'Kits solaires, batteries et stations d’énergie livrés complets, prêts à brancher, payés à la réception.',
    cta: 'DÉCOUVRIR LES KITS', announcement: '🌱 Kits solaires livrés complets dans tout le Maroc — paiement à la réception',
    usp: [
      { title: '☀️ Matériel certifié', description: 'Marques garanties 10 ans par le constructeur.' },
      { title: '🔌 Prêt à brancher', description: 'Câbles, fixations et guide de montage dans chaque kit.' },
      { title: '📉 Facture divisée', description: 'Jusqu’à -70 % dès le premier mois.' },
      { title: '💵 Paiement à la réception', description: 'Vous payez lorsque le matériel est livré et vérifié.' },
    ],
    highlights: [
      { title: '☀️ Kits résidentiels', description: 'De 1 à 10 kW, pour villas et appartements.' },
      { title: '💧 Pompes solaires', description: 'Irrigation autonome, sans gasoil.' },
      { title: '🔋 Batteries', description: 'Stockage lithium contre les coupures.' },
    ],
    stats: [{ value: '-70 %', label: 'sur la facture' }, { value: '+1 200', label: 'kits livrés' }, { value: '10 ans', label: 'de garantie' }],
    story: { title: 'Notre approche', paragraphs: ['Nous ne vendons que du matériel que nous avons testé et que nous utilisons nous-mêmes.', 'Chaque kit arrive complet, avec son guide : rien à acheter en plus.'], highlight: { title: 'Le bon kit', description: 'Envoyez votre facture sur WhatsApp, on vous indique la puissance qu’il vous faut.' } },
    promo: { title: 'Pack kit + batterie à -20 %', subtitle: 'Ajoutez une batterie lithium à votre kit et gardez la lumière pendant les coupures.', cta: 'VOIR LE PACK', countdown: '🌱 Le pack repasse au prix normal dimanche soir' },
    quotes: [
      { name: 'Rachid M.', city: 'Agadir', text: 'Kit monté en une après-midi avec le guide. Facture passée de 900 à 210 DH.' },
      { name: 'Fatima Z.', city: 'Fès', text: 'Matériel de marque, carton complet, payé à la livraison.' },
      { name: 'Coopérative Al Amal', city: 'Taroudant', text: 'Pompe solaire opérationnelle depuis 8 mois sans une panne.' },
    ],
    faqs: [
      { q: 'Quel kit me faut-il ?', a: 'Envoyez votre dernière facture sur WhatsApp : nous vous indiquons gratuitement le kit adapté.' },
      { q: 'Puis-je l’installer moi-même ?', a: 'Oui : chaque kit est livré prêt à brancher avec son guide. Un installateur partenaire peut intervenir en option.' },
      { q: 'Que couvre la garantie ?', a: '10 ans constructeur sur les panneaux et l’onduleur, 5 ans sur les batteries.' },
      COD_FAQ[0],
    ],
    related: 'Compléter votre installation', catalogueTitle: 'Équipements & systèmes', catalogueSubtitle: 'Kits complets, batteries, pompes et accessoires, garantis 10 ans.',
    nickname: 'Technicien', about: 'Kits solaires, batteries et stations d’énergie de marques garanties, livrés complets partout au Maroc.',
    badges: ['Énergie renouvelable', 'Garantie 10 ans', 'Paiement à la livraison'],
  }),
  N({
    id: 'artisan', label: 'Artisanat & terroir',
    keywords: ['artisan', 'terroir', 'coopérative', 'cooperative', 'poterie', 'souk', 'tradition', 'argan', 'safran', 'tissage', 'zellige', 'cuir', 'berbère', 'berbere', 'fait main'],
    light: { primary: '#b45309', secondary: '#451a03', bg: '#fef3c7', text: '#292524', muted: '#78716c', accent: '#d97706' },
    dark: { primary: '#f59e0b', secondary: '#1c1108', bg: '#130c05', text: '#fef3c7', muted: '#d6b98c', accent: '#d97706' },
    mood: 'light', font: 'Cairo',
    kicker: 'FAIT MAIN AU MAROC',
    headlines: ['Le goût du terroir marocain', 'Fait main, livré chez vous', 'Le souk, à votre porte'],
    subhead: 'Des pièces façonnées par des artisans et des coopératives que nous connaissons par leur nom, livrées partout au Royaume.',
    cta: 'EXPLORER LE SOUK', announcement: '🌿 Nouvelle récolte — livraison offerte dès 250 DH',
    usp: [
      { title: '🤲 Fait main', description: 'Chaque pièce est façonnée par un artisan que nous connaissons.' },
      { title: '🌿 Pur et tracé', description: 'Sans mélange ni additif, avec le nom de l’atelier.' },
      { title: '📦 Emballé avec soin', description: 'Poteries calées, huiles scellées : rien n’arrive cassé.' },
      { title: '💵 Paiement à la réception', description: 'Vous payez le livreur, une fois le colis vérifié.' },
    ],
    highlights: [
      { title: 'Essaouira', description: 'Huile d’argan des coopératives' },
      { title: 'Safi', description: 'Poteries et tajines' },
      { title: 'Haut Atlas', description: 'Tapis et tissages berbères' },
    ],
    stats: [{ value: '28', label: 'ateliers partenaires' }, { value: '48h', label: 'délai de livraison' }, { value: '100 %', label: 'fait main' }],
    story: { title: 'Nos coopératives', paragraphs: ['Nous achetons directement aux coopératives et aux ateliers, au prix qu’ils fixent.', 'Chaque produit porte le nom de l’atelier qui l’a fait.'], highlight: { title: 'Coopérative Tafyoucht', description: 'Trente-deux femmes, un pressoir à froid.' } },
    promo: { title: 'Le coffret du terroir', subtitle: 'Argan, safran, miel et un bol de Safi, dans une boîte en bois. Un cadeau qui raconte le Maroc.', cta: 'OFFRIR LE COFFRET', countdown: '🌿 Livraison offerte cette semaine' },
    quotes: [
      { name: 'Claire D.', city: 'Casablanca', text: 'Arrivé sans une rayure. L’huile d’argan est la meilleure que j’aie goûtée.' },
      { name: 'Khadija R.', city: 'Rabat', text: 'Épices fraîches, parfumées, livrées en deux jours.' },
      { name: 'Mounir S.', city: 'Tanger', text: 'Un cadeau emballé à la perfection. Merci pour le petit mot.' },
    ],
    faqs: [
      { q: 'D’où viennent les produits ?', a: 'De coopératives et d’ateliers que nous visitons chaque saison.' },
      { q: 'Les poteries vont-elles au four ?', a: 'Les tajines de Safi oui, à feu doux. Les pièces vernissées non.' },
      COD_FAQ[0], COD_FAQ[1],
    ],
    related: 'Du même atelier', catalogueTitle: 'Tout le souk', catalogueSubtitle: 'Fait main, livré partout.',
    nickname: 'Souk', about: 'Argan, épices, poteries et tissages, choisis chez les artisans du Maroc et livrés partout au Royaume.',
    badges: ['Fait main', 'Coopératives partenaires', 'Paiement à la livraison'],
  }),
  N({
    id: 'general', label: 'Boutique généraliste',
    keywords: [],
    light: { primary: '#ea580c', secondary: '#1e293b', bg: '#ffffff', text: '#0f172a', muted: '#64748b', accent: '#f97316' },
    dark: { primary: '#fb923c', secondary: '#0f172a', bg: '#0b1120', text: '#f8fafc', muted: '#94a3b8', accent: '#f97316' },
    mood: 'light', font: 'Manrope',
    kicker: 'BIENVENUE',
    headlines: ['Des produits choisis, livrés chez vous', 'La qualité, payée à la réception', 'Commandez en 30 secondes'],
    subhead: 'Une sélection de produits utiles, livrés en 24/48h partout au Maroc et payés à la réception.',
    cta: 'VOIR LES PRODUITS', announcement: '🚚 Livraison 24/48h partout au Maroc — paiement à la réception',
    usp: COD_USP,
    highlights: [
      { title: '⭐ Best-sellers', description: 'Les produits que nos clients recommandent.' },
      { title: '🆕 Nouveautés', description: 'Les arrivages de la semaine.' },
      { title: '💥 Promotions', description: 'Les bonnes affaires du moment.' },
    ],
    stats: [{ value: '+10 000', label: 'commandes livrées' }, { value: '24h', label: 'délai moyen' }, { value: '4.9/5', label: 'satisfaction' }],
    story: { title: 'Notre boutique', paragraphs: ['Nous choisissons des produits utiles, testés, au bon prix.', 'Chaque commande est vérifiée avant l’expédition.'], highlight: { title: 'Vérifié avant envoi', description: 'Chaque colis est contrôlé par notre équipe.' } },
    promo: { title: 'Offre de la semaine', subtitle: 'Des prix bloqués jusqu’à dimanche soir sur une sélection.', cta: 'J’EN PROFITE', countdown: '🔥 Fin de l’offre dimanche soir' },
    quotes: [
      { name: 'Karim L.', city: 'Casablanca', text: 'Livré le lendemain, conforme à la photo. Payé à la réception.' },
      { name: 'Sanae B.', city: 'Rabat', text: 'Service client réactif sur WhatsApp. Je recommande.' },
      { name: 'Hicham M.', city: 'Agadir', text: 'Deuxième commande, toujours aussi rapide.' },
    ],
    faqs: COD_FAQ,
    related: 'Vous aimerez aussi', catalogueTitle: 'Tous les produits', catalogueSubtitle: 'Livrés en 24/48h, payés à la réception.',
    nickname: 'Service client', about: 'Des produits sélectionnés avec soin, livrés partout au Maroc. Vous payez à la réception.',
    badges: ['Livraison 24/48h', 'Paiement à la livraison', 'Support 7j/7'],
  }),
];

export const NICHE_LABELS: { id: string; label: string }[] = NICHES.map((n) => ({ id: n.id, label: n.label }));

// ─────────────────────────────────────────────── reading the brief

const COLOURS: [RegExp, string, string][] = [
  [/\b(bleus?|blue)\b/, '#2563eb', 'bleu'],
  [/\b(verts?|vertes?|green)\b/, '#15803d', 'vert'],
  [/\b(rouges?|red)\b/, '#dc2626', 'rouge'],
  [/\b(roses?|pink)\b/, '#db2777', 'rose'],
  [/\b(violets?|violettes?|purple|mauve)\b/, '#7c3aed', 'violet'],
  [/\b(oranges?)\b/, '#ea580c', 'orange'],
  [/\b(jaunes?|yellow)\b/, '#ca8a04', 'jaune'],
  [/\b(or|dores?|dorees?|gold|golden)\b/, '#d4af37', 'or'],
  [/\b(turquoise|teal|sarcelle)\b/, '#0d9488', 'turquoise'],
  [/\b(menthe|mint)\b/, '#10b981', 'menthe'],
  [/\b(cyan)\b/, '#06b6d4', 'cyan'],
  [/\b(indigo)\b/, '#4f46e5', 'indigo'],
  [/\b(corail|coral)\b/, '#f97316', 'corail'],
  [/\b(bordeaux|burgundy)\b/, '#7f1d1d', 'bordeaux'],
  [/\b(marron|bruns?|brunes?|brown|chocolat)\b/, '#92400e', 'marron'],
  [/\b(beige|sable|sand)\b/, '#a16207', 'beige'],
  [/\b(gris|grise|grey|gray)\b/, '#4b5563', 'gris'],
  [/\b(noirs?|noires?|black)\b/, '#111827', 'noir'],
  [/\b(blancs?|blanches?|white)\b/, '#ffffff', 'blanc'],
];

/** A small, fast, seedable generator. Same brief and seed, same numbers. */
function rng(seedText: string, seed: number): () => number {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < seedText.length; i++) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = (h >>> 0) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 10000) / 10000;
  };
}

function pick<T>(r: () => number, items: T[]): T {
  return items[Math.floor(r() * items.length) % items.length];
}

/** Lower-case, accents stripped, so "élégante" and "elegante" read the same and `\b` behaves. */
function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, "'");
}

/**
 * English and misspelt words a Moroccan seller types as readily as the French
 * ones the niches list. Kept apart so the niche tables stay readable.
 */
const EXTRA_KEYWORDS: Record<string, string[]> = {
  beauty: ['beauty', 'cosmetic', 'skincare', 'skin', 'makeup', 'make-up', 'perfume', 'fragrance', 'hair', 'cream', 'lotion', 'lipstick', 'nail'],
  fashion: ['shoe', 'shoes', 'shose', 'shoos', 'sneakers', 'cloth', 'clothes', 'clothing', 'dress', 'jeans', 'bag', 'bags', 'jacket', 'shirt', 'wear', 'apparel', 'boots', 'sandal', 'watches', 'glasses', 'sunglasses', 'chaussures', 'chausure', 'vetements', 'vêtements'],
  tech: ['electronic', 'electronics', 'phone', 'phones', 'iphone', 'laptop', 'computer', 'headphone', 'headphones', 'earbuds', 'speaker', 'charger', 'cable', 'gadgets', 'accessories tech', 'smart watch', 'smartwatch', 'tablet', 'console'],
  food: ['food', 'honey', 'tea', 'coffee', 'spice', 'spices', 'organic', 'snack', 'chocolate', 'dates', 'olive oil', 'grocery', 'supplement', 'vitamin', 'protein', 'healthy', 'diet', 'juice', 'tisane', 'infusion'],
  home: ['furniture', 'home', 'decor', 'decoration', 'sofa', 'bed', 'kitchen', 'lamp', 'rug', 'carpet', 'curtain', 'garden', 'appliance', 'appliances', 'table', 'chair'],
  kids: ['baby', 'babies', 'kid', 'kids', 'child', 'children', 'toy', 'toys', 'stroller', 'school', 'newborn', 'mom', 'mother'],
  sport: ['sports', 'gym', 'fitness', 'workout', 'training', 'bike', 'bicycle', 'football', 'dumbbell', 'dumbbells', 'yoga', 'running'],
  jewelry: ['jewelry', 'jewellery', 'jewel', 'gold', 'silver', 'diamond', 'ring', 'necklace', 'bracelet', 'luxury', 'watch', 'gift', 'gifts', 'premium'],
  saas: ['software', 'app', 'apps', 'course', 'courses', 'training', 'ebook', 'license', 'subscription', 'digital', 'tool', 'tools', 'coaching', 'agency', 'service', 'services'],
  energy: ['solar', 'energy', 'panel', 'panels', 'battery', 'batteries', 'electric', 'green', 'eco', 'sustainable', 'pump'],
  artisan: ['handmade', 'craft', 'crafts', 'artisanal', 'pottery', 'ceramic', 'ceramics', 'leather', 'rug', 'berber', 'traditional', 'heritage', 'cooperative'],
};

/** A keyword matches at the start of a word; a short one must be the whole word. */
function hasKeyword(text: string, keyword: string): boolean {
  const k = fold(keyword).trim();
  if (!k) return false;
  const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(k.length <= 3 ? `\\b${escaped}\\b` : `\\b${escaped}`).test(text);
}

function detectNiche(text: string): Niche {
  let best: Niche = NICHES[NICHES.length - 1];
  let bestScore = 0;
  for (const n of NICHES) {
    let score = 0;
    for (const k of [...n.keywords, ...(EXTRA_KEYWORDS[n.id] ?? [])]) if (hasKeyword(text, k)) score += k.length;
    if (score > bestScore) {
      best = n;
      bestScore = score;
    }
  }
  return best;
}

interface ColourHit {
  hex: string;
  name: string;
}

interface Reading {
  niche: Niche;
  mood: 'light' | 'dark';
  moodFrom: 'prompt' | 'niche' | 'brief';
  /** The brand colour, when the brief names one. */
  colour: ColourHit | null;
  /** Colours the brief assigned to a role: "background black", "fond blanc", "texte gris". */
  roles: { bg?: ColourHit; secondary?: ColourHit; text?: ColourHit };
  font: string;
  fontFrom: 'prompt' | 'niche' | 'brief';
  /** Sections and elements the brief asks for. */
  wants: Set<string>;
  /** Sections the brief asks to leave out. */
  drops: Set<string>;
  /** The label of an extra button asked for in the accroche, if any. */
  buttonLabel: string | null;
  minimal: boolean;
}

/** Everything the brief can ask for, and the words that ask for it. */
const ELEMENTS: [string, RegExp][] = [
  ['button', /\b(bouton|button|btn|cta|call to action|appel a l'action)/],
  ['countdown', /\b(compte a rebours|countdown|timer|minuteur|urgence|urgency|flash|solde|sale|offre limitee|limited offer)/],
  ['promo', /\b(promo|promotion|offre|offer|discount|remise|reduction)/],
  ['reviews', /\b(temoignage|testimonial|avis|review|reviews|clients satisfaits)/],
  ['faq', /\b(faq|question|questions)/],
  ['story', /\b(histoire|a propos|story|about us|about|atelier|notre marque|our brand)/],
  ['steps', /\b(etape|etapes|steps|comment ca marche|how it works|comment commander|how to order|process)/],
  ['stats', /\b(chiffre|chiffres|stat|stats|statistic|numbers|compteur|counter)/],
  ['whatsapp', /\b(whatsapp|wa button)/],
  ['ticker', /\b(ticker|bandeau defilant|marquee|defilant|scrolling banner)/],
  ['slider', /\b(carrousel|carousel|slider|slide)/],
  ['grid', /\b(grille|grid)\b/],
  ['photos', /\b(photo|photos|image|images|picture|pictures|visuel|visuels)/],
];

const DROP_PREFIX = /\b(sans|without|no|pas de|remove|enleve|enlever|supprime|supprimer|retire|retirer|hide|masquer|delete)\s+(?:the |la |le |les |l'|de |des |du |a |an |un |une )?/g;
const ADD_PREFIX = /\b(add|ajoute|ajouter|ajoutez|avec|with|include|inclure|mettre|mets|met|put|insert|insere)\s+(?:the |la |le |les |l'|de |des |du |a |an |un |une |one |some |plus |more )?/g;

/** What the words around a colour say it is for, if anything. */
function colourRole(before: string): 'bg' | 'secondary' | 'text' | 'primary' | null {
  if (/\b(background|fond|arriere-plan|arriere plan|bg|page background)\W*$/.test(before)) return 'bg';
  if (/\b(texte|text|ecriture|writing)\W*$/.test(before)) return 'text';
  if (/\b(secondaire|secondary|header|en-tete|footer|pied de page|menu)\W*$/.test(before)) return 'secondary';
  if (/\b(bouton|button|buttons|boutons|accent|principal|primary|main|brand|marque)\W*$/.test(before)) return 'primary';
  return null;
}

function read(brief: DesignBrief, spec?: BriefSpec | null): Reading {
  const text = ` ${fold(brief.prompt)} `;
  const detected = detectNiche(text);
  // A model's niche wins unless it gave up ("general") where the words did not.
  const niche = spec && (spec.niche !== 'general' || detected.id === 'general') ? (NICHES.find((n) => n.id === spec.niche) ?? detected) : detected;

  // ── colours, each with the role the sentence gives it ─────────────
  const hits: { hit: ColourHit; role: ReturnType<typeof colourRole>; index: number }[] = [];
  const seen = new Set<string>();
  const consider = (index: number, hit: ColourHit) => {
    const before = text.slice(Math.max(0, index - 28), index);
    const roleBefore = colourRole(before);
    // "page rouge et fond noir": the colour can also be named before its role
    // ("rouge fond"), which is rare; the words after are only read for "background".
    const after = text.slice(index, index + 30);
    const role = roleBefore ?? (/^\S+\s+(background|en fond|de fond|as background)/.test(after) ? 'bg' : null);
    const key = `${hit.hex}:${role ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push({ hit, role, index });
  };
  for (const m of text.matchAll(/#([0-9a-f]{6})\b/g)) consider(m.index ?? 0, { hex: `#${m[1]}`, name: `#${m[1]}` });
  for (const [re, value, name] of COLOURS) {
    const g = new RegExp(re.source, 'g');
    for (const m of text.matchAll(g)) consider(m.index ?? 0, { hex: value, name });
  }
  hits.sort((a, b) => a.index - b.index);

  const roles: Reading['roles'] = {};
  let colour: ColourHit | null = null;
  const free: ColourHit[] = [];
  for (const h of hits) {
    if (h.role === 'bg' && !roles.bg) roles.bg = h.hit;
    else if (h.role === 'text' && !roles.text) roles.text = h.hit;
    else if (h.role === 'secondary' && !roles.secondary) roles.secondary = h.hit;
    else if (h.role === 'primary' && !colour) colour = h.hit;
    else free.push(h.hit);
  }
  // A colour with no role is the brand colour; a second one is the secondary.
  // "noir" alone reads as a mood, not a brand colour, unless it is the only one.
  const freeBrand = free.filter((c) => c.hex !== '#111827' && c.hex !== '#ffffff');
  if (!colour) colour = freeBrand[0] ?? free[0] ?? null;
  if (!roles.secondary) {
    const second = freeBrand.find((c) => c !== colour);
    if (second) roles.secondary = second;
  }

  // ── mood ───────────────────────────────────────────────────────────
  let mood: 'light' | 'dark' = niche.mood;
  let moodFrom: Reading['moodFrom'] = 'niche';
  if (brief.mode === 'light' || brief.mode === 'dark') {
    mood = brief.mode;
    moodFrom = 'brief';
  } else if (roles.bg) {
    mood = isDark(roles.bg.hex) ? 'dark' : 'light';
    moodFrom = 'prompt';
  } else if (/\b(sombre|dark|nuit|neon|noir|black)\b/.test(text)) {
    mood = 'dark';
    moodFrom = 'prompt';
  } else if (/\b(clair|light|blanc|white|lumineux|bright|epure|minimal|pastel)/.test(text)) {
    mood = 'light';
    moodFrom = 'prompt';
  }

  // ── font ───────────────────────────────────────────────────────────
  let font = niche.font;
  let fontFrom: Reading['fontFrom'] = 'niche';
  if (brief.fontFamily) {
    font = brief.fontFamily;
    fontFrom = 'brief';
  } else if (/\b(serif|elegant|luxe|luxury|prestige|raffine|chic|classy)/.test(text)) {
    font = 'Playfair Display';
    fontFrom = 'prompt';
  } else if (/\b(futuriste|futuristic|tech|moderne|modern|gaming|neon)/.test(text)) {
    font = 'Space Grotesk';
    fontFrom = 'prompt';
  } else if (/\b(arabe|arabic|traditionnel|traditional|terroir|souk|oriental)/.test(text)) {
    font = 'Cairo';
    fontFrom = 'prompt';
  } else if (/\b(doux|douce|soft|rond|arrondi|rounded|friendly|convivial)/.test(text)) {
    font = 'Plus Jakarta Sans';
    fontFrom = 'prompt';
  }

  // ── elements: asked for, or asked away ─────────────────────────────
  const wants = new Set<string>();
  const drops = new Set<string>();
  // Anything right after "sans / without / remove" is a drop; everything else
  // that names an element is a want.
  const dropped = text.replace(DROP_PREFIX, (m) => `${m}⟂`);
  for (const [id, re] of ELEMENTS) {
    const g = new RegExp(re.source, 'g');
    for (const m of dropped.matchAll(g)) {
      const idx = m.index ?? 0;
      if (dropped.slice(Math.max(0, idx - 2), idx).includes('⟂')) drops.add(id);
      else wants.add(id);
    }
  }
  for (const id of drops) wants.delete(id);

  // The extra button's label: a quoted phrase, else the thing being sold.
  let buttonLabel: string | null = null;
  if (wants.has('button')) {
    const quoted = /["«“]([^"»”]{2,40})["»”]/.exec(brief.prompt);
    if (quoted) buttonLabel = quoted[1].trim();
    else {
      const sell = /\b(?:for selling|to sell|selling|sell|pour vendre|vendre|to buy|acheter|commander)\s+(?:the |my |our |des |les |nos |mes |de |du |la |le |some )?([a-z][a-z' -]{2,24}?)(?=[.,;!]|\s+(?:and|et|with|avec|in|en|on|sur)\b|$)/.exec(text.trim());
      buttonLabel = sell ? `Commander : ${sell[1].trim()}` : 'Commander maintenant';
    }
  }

  let minimal = /\b(minimal|minimalist|epure|sobre|simple|clean|sans fioriture)/.test(text) && !wants.has('stats') && !wants.has('story');

  // ── what a model read, over what the words said ───────────────────
  if (spec) {
    if (spec.mood === 'light' || spec.mood === 'dark') {
      if (moodFrom !== 'brief') {
        mood = spec.mood;
        moodFrom = 'prompt';
      }
    }
    if (spec.colours?.primary) colour = { hex: spec.colours.primary, name: spec.colours.primary };
    if (spec.colours?.bg) {
      roles.bg = { hex: spec.colours.bg, name: spec.colours.bg };
      if (moodFrom !== 'brief') {
        mood = isDark(spec.colours.bg) ? 'dark' : 'light';
        moodFrom = 'prompt';
      }
    }
    if (spec.colours?.secondary) roles.secondary = { hex: spec.colours.secondary, name: spec.colours.secondary };
    if (spec.colours?.text) roles.text = { hex: spec.colours.text, name: spec.colours.text };
    if (spec.font && fontFrom !== 'brief') {
      font = spec.font;
      fontFrom = 'prompt';
    }
    for (const w of spec.wants ?? []) wants.add(w);
    for (const d of spec.drops ?? []) {
      drops.add(d);
      wants.delete(d);
    }
    if (spec.buttonLabel) {
      wants.add('button');
      buttonLabel = spec.buttonLabel;
    } else if (wants.has('button') && !buttonLabel) buttonLabel = 'Commander maintenant';
    if (typeof spec.minimal === 'boolean') minimal = spec.minimal;
  }

  return { niche, mood, moodFrom, colour, roles, font, fontFrom, wants, drops, buttonLabel, minimal };
}

/** The niche's stock copy with a model's lines written over it where it wrote any. */
function withCopy(n: Niche, copy: SpecCopy | undefined): Niche {
  if (!copy) return n;
  const out: Niche = { ...n };
  if (copy.kicker) out.kicker = copy.kicker;
  if (copy.headline) out.headlines = [copy.headline];
  if (copy.subhead) out.subhead = copy.subhead;
  if (copy.cta) out.cta = copy.cta.toUpperCase();
  if (copy.announcement) out.announcement = copy.announcement;
  if (copy.usp?.length) out.usp = copy.usp.map((u) => ({ title: u.title, description: u.description }));
  if (copy.highlights?.length) out.highlights = copy.highlights.map((h) => ({ title: h.title, description: h.description }));
  if (copy.stats?.length) out.stats = copy.stats.map((x) => ({ value: x.value, label: x.label }));
  if (copy.promo) out.promo = { title: copy.promo.title, subtitle: copy.promo.subtitle, cta: copy.promo.cta.toUpperCase(), countdown: copy.promo.countdown ?? n.promo.countdown };
  if (copy.story) out.story = { title: copy.story.title, paragraphs: copy.story.paragraphs, highlight: n.story.highlight };
  if (copy.quotes?.length) out.quotes = copy.quotes.map((q) => ({ name: q.name, city: q.city, text: q.text }));
  if (copy.faqs?.length) out.faqs = copy.faqs.map((f) => ({ q: f.q, a: f.a }));
  if (copy.catalogueTitle) out.catalogueTitle = copy.catalogueTitle;
  if (copy.catalogueSubtitle) out.catalogueSubtitle = copy.catalogueSubtitle;
  if (copy.about) out.about = copy.about;
  return out;
}

// ─────────────────────────────────────────────── the palette

function paletteFor(r: Reading, brief: DesignBrief): PaletteLike & { accent: string } {
  const base = { ...(r.mood === 'dark' ? r.niche.dark : r.niche.light) };
  if (r.roles.bg) {
    // A background named in the brief sets the ground and the ink that reads on it.
    const dark = isDark(r.roles.bg.hex);
    base.bg = r.roles.bg.hex;
    base.text = dark ? '#f8fafc' : '#0f172a';
    base.muted = dark ? mix(r.roles.bg.hex, '#ffffff', 0.55) : mix(r.roles.bg.hex, '#000000', 0.55);
    base.secondary = dark ? mix(r.roles.bg.hex, '#ffffff', 0.07) : mix(r.roles.bg.hex, '#000000', 0.85);
  }
  if (r.colour) {
    base.primary = r.colour.hex;
    // A dark page with a dark brand colour would lose its buttons; lighten it.
    if (r.mood === 'dark' && luminance(r.colour.hex) < 0.06) base.primary = mix(r.colour.hex, '#ffffff', 0.45);
    base.accent = mix(base.primary, r.mood === 'dark' ? '#ffffff' : '#000000', 0.2);
  }
  if (r.roles.secondary) base.secondary = r.roles.secondary.hex;
  if (r.roles.text) base.text = r.roles.text.hex;
  const overrides = brief.palette ?? {};
  for (const key of ['primary', 'secondary', 'bg', 'text', 'muted', 'accent'] as const) {
    const v = overrides[key];
    if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) (base as any)[key] = v;
  }
  return base;
}

// ─────────────────────────────────────────────── the composition

export function generateDesign(brief: DesignBrief, spec?: BriefSpec | null): GeneratedDesign {
  const prompt = String(brief.prompt ?? '').trim();
  const seed = Math.max(0, Math.floor(Number(brief.seed) || 0));
  const r = read({ ...brief, prompt }, spec);
  const n = withCopy(r.niche, spec?.copy);
  const palette = paletteFor(r, brief);
  const dark = isDark(palette.bg);
  // The style kit: the niche narrows the field, the seed picks. A brief that
  // says "minimal" or names a style word decides it outright.
  const flavours: Record<string, string[]> = {
    beauty: ['soft', 'magazine', 'boutique', 'clean'], fashion: ['street', 'minimal', 'editorial', 'magazine', 'brutal'],
    tech: ['tech', 'bold', 'brutal', 'clean'], food: ['soft', 'boutique', 'editorial', 'playful'], home: ['boutique', 'editorial', 'minimal', 'luxe'],
    kids: ['playful', 'soft', 'bold'], sport: ['bold', 'street', 'brutal'], jewelry: ['luxe', 'editorial', 'magazine'],
    saas: ['tech', 'clean', 'playful', 'bold'], energy: ['clean', 'tech', 'bold'], artisan: ['boutique', 'editorial', 'brutal', 'soft'], general: KIT_IDS,
  };
  const styleWord = /\b(editorial|magazine|minimal|epure|brut|brutal|luxe|luxury|street|playful|ludique|soft|douce|doux|bold|impact|tech|boutique)/.exec(fold(prompt))?.[1];
  const wordKit: Record<string, string> = { editorial: 'editorial', magazine: 'magazine', minimal: 'minimal', epure: 'minimal', brut: 'brutal', brutal: 'brutal', luxe: 'luxe', luxury: 'luxe', street: 'street', playful: 'playful', ludique: 'playful', soft: 'soft', douce: 'soft', doux: 'soft', bold: 'bold', impact: 'bold', tech: 'tech', boutique: 'boutique' };
  const kitId = (styleWord && wordKit[styleWord]) || (r.minimal ? 'minimal' : pick(rng(prompt + ':kit', seed), flavours[n.id] ?? KIT_IDS));
  const kit = KITS[kitId] ?? KITS.clean;
  const look: Look = lookFor(palette, {
    kit,
    radius: kit.card.radius,
    shadow: dark ? 'none' : kit.card.shadow,
  });
  const random = rng(prompt, seed);
  const storeName = String(brief.storeName ?? '').trim();

  // ── choices ────────────────────────────────────────────────────────
  const heroVariant = r.minimal ? 'center' : pick(random, ['center', 'split', 'stacked', 'card', 'card'] as const);
  // The opening band: a gradient of the palette (a photograph when the niche
  // has one), giant type, a highlighted word — what the reference designs do.
  const heroGradient = dark
    ? `linear-gradient(135deg,${mix(palette.secondary, '#000000', 0.25)} 0%,${palette.bg} 55%,${mix(palette.primary, '#000000', 0.7)} 100%)`
    : `linear-gradient(135deg,${mix(palette.primary, '#ffffff', 0.9)} 0%,${palette.bg} 50%,${mix(palette.secondary, '#ffffff', 0.9)} 100%)`;
  const heroSerif = r.font === 'Playfair Display' || r.font === 'Lora';
  const heroUpper = !heroSerif && ['fashion', 'sport', 'tech'].includes(n.id) && random() < 0.7;
  const uspVariant = r.wants.has('ticker') ? 'marquee' : r.drops.has('ticker') ? 'cards' : r.minimal ? 'plain' : pick(random, ['cards', 'marquee', 'plain'] as const);
  const productsVariant = r.wants.has('slider') ? 'slider' : r.wants.has('grid') ? 'grid4' : pick(random, ['grid3', 'grid4', 'slider'] as const);
  const reviewsVariant = pick(random, ['carousel', 'grid', 'band'] as const);
  const storyVariant = pick(random, ['story', 'checklist'] as const);
  const withTags = !r.minimal && random() < 0.5;
  const faqVariant = pick(random, ['columns', 'cards'] as const);
  const stepsVariant = pick(random, ['cards', 'columns'] as const);
  const withCountdown = !r.drops.has('countdown') && (r.wants.has('countdown') || (!r.minimal && random() < 0.5));
  const promoVariant = pick(random, ['center', 'split'] as const);

  // Which optional sections appear, and in which order. The catalogue,
  // reviews, FAQ and closing call always do; the rest is the brief's and the
  // seed's business. A minimal brief drops the extras.
  const extras: string[] = [];
  const maybe = (key: string, p: number) => {
    if (r.drops.has(key)) return;
    if (r.wants.has(key) || (!r.minimal && random() < p)) extras.push(key);
  };
  maybe('stats', 0.55);
  maybe('story', 0.45);
  maybe('steps', 0.7);
  if (!r.drops.has('promo') && (r.wants.has('promo') || r.wants.has('countdown') || !r.minimal)) extras.push('promo');

  const headline = pick(random, n.headlines);
  const own = brief.images ?? {};
  const photo = (key: 'hero' | 'story' | 'promo') => own[key] || asset(`niche-${n.id}`, key);
  const highlights = pics(n.highlights, [own.h1 || asset(`niche-${n.id}`, 'h1'), own.h2 || asset(`niche-${n.id}`, 'h2'), own.h3 || asset(`niche-${n.id}`, 'h3')]);
  const ownCount = (['hero', 'story', 'promo'] as const).filter((k) => own[k]).length;
  const title = storeName && random() < 0.35 ? `${storeName} — ${headline.charAt(0).toLowerCase()}${headline.slice(1)}` : headline;
  const band = look.band;
  const alt = dark ? mix(palette.bg, '#ffffff', 0.05) : '#ffffff';
  const onPrimary = look.onPrimary;

  // ── the home ───────────────────────────────────────────────────────
  const home: SectionNode[] = [];
  const heroWords = title.split(' ');
  const heroHighlight = heroWords.length > 3 && random() < 0.6 ? heroWords.slice(-2).join(' ') : undefined;
  const heroCard = heroVariant === 'card'
    ? {
        badge: n.stats[0]?.label ? 'En chiffres' : undefined,
        title: n.highlights[0]?.title.replace(/^[^\p{L}\p{N}]+/u, '') ?? n.label,
        subtitle: n.highlights[0]?.description,
        rows: n.stats.slice(0, 3).map((x) => ({ label: x.label, value: x.value })),
        progress: { label: 'Satisfaction client', value: '4.9 / 5', pct: 96 },
        cta: n.cta.charAt(0) + n.cta.slice(1).toLowerCase(),
      }
    : undefined;
  home.push(heroSection('hero', look, {
    variant: heroVariant === 'card' ? 'center' : heroVariant,
    card: heroCard,
    bgImage: heroVariant === 'card' ? photo('hero') : undefined,
    align: heroVariant === 'card' || heroVariant === 'split' ? 'left' : 'center',
    size: r.minimal ? 'xl' : heroVariant === 'card' || heroVariant === 'center' ? '2xl' : 'xl',
    serif: heroSerif, uppercase: heroUpper, highlight: heroHighlight, kickerStyle: heroVariant === 'center' ? 'pill' : 'line',
    ctaRadius: look.radius >= 16 ? 999 : look.radius,
    kicker: r.minimal ? undefined : n.kicker, title, subtitle: n.subhead, cta: n.cta,
    // An extra button asked for in the brief goes beside the main one, to the catalogue.
    secondaryCta: r.buttonLabel ?? (r.minimal ? undefined : 'En savoir plus'), secondaryLink: r.buttonLabel ? '/products' : '/pages/a-propos',
    highlights: heroVariant === 'card' ? undefined : highlights, image: heroVariant === 'card' ? undefined : photo('hero'),
    background: r.minimal ? '$bg' : heroGradient,
    paddingTop: r.minimal ? 104 : heroVariant === 'card' ? 88 : 80, paddingBottom: r.minimal ? 72 : heroVariant === 'card' ? 88 : 64,
    maxWidth: heroVariant === 'center' ? 1000 : 1280, minHeight: heroVariant === 'card' ? 520 : undefined,
  }));

  if (extras.includes('stats') && random() < 0.5) home.push(statsSection('stats', look, n.stats, { background: dark ? band : '$primary', valueColor: dark ? '$primary' : onPrimary, labelColor: dark ? '$muted' : (isDark(palette.primary) ? 'rgba(255,255,255,0.8)' : 'rgba(15,23,42,0.75)') }));

  home.push(uspSection('usp', look, n.usp, { variant: uspVariant, background: uspVariant === 'marquee' ? band : '$bg', paddingTop: uspVariant === 'plain' ? 16 : undefined, paddingBottom: uspVariant === 'plain' ? 16 : undefined }));

  home.push(productsSection('catalogue', look, {
    title: r.minimal ? 'La collection' : 'Nos meilleures ventes', subtitle: r.minimal ? undefined : 'Le prix affiché est le prix payé au livreur.',
    big: !r.minimal, layout: productsVariant === 'slider' ? 'slider' : 'grid', cols: productsVariant === 'grid4' ? 4 : 3,
    background: alt, ctaText: 'VOIR TOUT LE CATALOGUE', align: r.minimal ? 'left' : 'center',
  }));

  if (extras.includes('stats') && !home.some((s) => s.id === 'stats')) home.push(statsSection('stats', look, n.stats, { background: band }));
  if (withTags) home.push(chipsSection('tags', look, n.highlights.map((h) => ({ label: h.title.replace(/^[^\p{L}\p{N}]+/u, ''), url: '/products' })), { style: dark ? 'pill' : 'outline', paddingTop: 8, paddingBottom: 16 }));
  if (extras.includes('story')) {
    if (storyVariant === 'checklist') home.push(featureSection('story', look, { kicker: n.kicker, title: n.story.title, text: n.story.paragraphs[0], items: n.usp.map((u) => ({ title: u.title.replace(/^[^\p{L}\p{N}]+/u, ''), text: u.description })), marker: 'check', image: photo('story') || undefined, cta: 'En savoir plus', ctaLink: '/pages/a-propos', background: '$bg' }));
    else home.push(storySection('story', look, { title: n.story.title, paragraphs: n.story.paragraphs, highlights: [n.story.highlight], image: photo('story'), cta: 'En savoir plus', ctaLink: '/pages/a-propos', background: '$bg' }));
  }
  if (extras.includes('promo')) home.push(promoSection('promo', look, {
    variant: promoVariant, title: n.promo.title, subtitle: n.promo.subtitle, cta: n.promo.cta, countdown: withCountdown ? n.promo.countdown : undefined, image: photo('promo'),
    background: dark ? alt : '$secondary', titleColor: dark ? '$text' : undefined, subtitleColor: dark ? '$muted' : undefined, radius: look.radius > 8 ? 24 : 0,
  }));
  if (extras.includes('steps')) home.push(stepsSection('steps', look, COD_STEPS, { title: 'Commander prend trente secondes', subtitle: 'Pas de compte, pas de carte bancaire.', variant: stepsVariant, background: band }));
  if (!r.drops.has('reviews')) {
    if (reviewsVariant === 'band') home.push(quoteSection('reviews', look, n.quotes[0], { background: '$secondary', kicker: 'Ils nous ont fait confiance', size: 'xl' }));
    else home.push(testimonialsSection('reviews', look, n.quotes, { title: 'Ils nous ont fait confiance', variant: reviewsVariant, background: extras.includes('steps') ? '$bg' : band }));
  }
  if (!r.drops.has('faq')) home.push(faqSection('faq', look, n.faqs, { title: 'Questions fréquentes', variant: faqVariant, background: alt }));

  // ── Extra sections selected from the 60+ catalog or triggered by prompt ──
  if (brief.extraSectionIds && brief.extraSectionIds.length) {
    for (const secId of brief.extraSectionIds) {
      const secDef = findSection(secId);
      if (secDef && !home.some((s) => s.id === secId || s.id.startsWith(secId))) {
        home.push(secDef.build('od'));
      }
    }
  }

  const promptLower = prompt.toLowerCase();
  if ((promptLower.includes('pack') || promptLower.includes('bundle') || promptLower.includes('degres')) && !home.some((s) => s.id.includes('bnd'))) {
    const sec = findSection('bundle-tiered-pricing');
    if (sec) home.push(sec.build('od'));
  }
  if ((promptLower.includes('bogo') || promptLower.includes('1 achete') || promptLower.includes('1 offert')) && !home.some((s) => s.id.includes('bogo'))) {
    const sec = findSection('bundle-bogo-free');
    if (sec) home.push(sec.build('od'));
  }
  if ((promptLower.includes('compar') || promptLower.includes('vs')) && !home.some((s) => s.id.includes('cmp'))) {
    const sec = findSection('trust-comparison-table');
    if (sec) home.push(sec.build('od'));
  }
  if ((promptLower.includes('avant apres') || promptLower.includes('resultat')) && !home.some((s) => s.id.includes('baf'))) {
    const sec = findSection('how-before-after');
    if (sec) home.push(sec.build('od'));
  }
  if ((promptLower.includes('stock') || promptLower.includes('rupture')) && !home.some((s) => s.id.includes('stk'))) {
    const sec = findSection('urgency-stock-alert');
    if (sec) home.push(sec.build('od'));
  }

  home.push(ctaSection('cta', look, { title: r.minimal ? 'Commandez.' : 'Prêt à commander ?', subtitle: 'Livraison 24/48h partout au Maroc, paiement à la réception.', cta: 'COMMANDER MAINTENANT', ctaBg: dark ? palette.bg : '$secondary', ctaColor: dark ? '$text' : look.onSecondary }));
  if (!r.drops.has('whatsapp')) home.push(whatsappSection('wa', { headline: 'Une question ? Écrivez-nous', nickname: storeName || n.nickname }));

  const pages: GeneratedDesign['pages'] = {
    home: { version: 3, kind: 'home', settings: { maxWidth: 1600, backgroundColor: palette.bg }, root: home },
    header: headerPage(look, {
      announcement: r.minimal ? undefined : n.announcement, bg: dark ? '$secondary' : alt, border: look.cardBorder, cartBg: band,
      cta: 'Commander', align: r.minimal ? 'center' : 'left',
    }),
    footer: footerPage(look, { about: n.about, badges: n.badges, bg: dark ? mix(palette.bg, '#000000', 0.4) : '$secondary', text: dark ? '$text' : undefined, border: 'rgba(255,255,255,0.1)', copyright: `© 2026 ${storeName || 'Ma boutique'}. Tous droits réservés.` }),
    product: productPage(look, { buyNowText: 'Commander maintenant — paiement à la livraison' }, [
      ...(withCountdown ? [countdownSection('p-cd', '⏳ Offre valable aujourd’hui — stock limité')] : []),
      uspSection('p-usp', look, n.usp, { variant: uspVariant === 'marquee' ? 'marquee' : 'cards', background: band }),
      productsSection('p-rel', look, { title: n.related, layout: 'slider', cols: 3, bind: '$catalogue', background: '$bg' }),
      testimonialsSection('p-rev', look, n.quotes, { title: 'Ils l’ont commandé', variant: reviewsVariant === 'band' ? 'carousel' : reviewsVariant, background: band }),
      faqSection('p-faq', look, n.faqs, { title: 'Avant de commander', variant: faqVariant }),
    ]),
    catalogue: cataloguePage(look, { title: n.catalogueTitle, subtitle: n.catalogueSubtitle, cols: productsVariant === 'grid4' ? 4 : 3 }, [
      uspSection('c-usp', look, n.usp, { variant: uspVariant === 'plain' ? 'plain' : 'marquee', background: band }),
    ]),
  };
  pages.product = { ...pages.product, settings: { ...pages.product.settings, backgroundColor: palette.bg } };
  pages.catalogue = { ...pages.catalogue, settings: { ...pages.catalogue.settings, backgroundColor: palette.bg } };
  for (const key of Object.keys(pages) as (keyof typeof pages)[]) pages[key] = bakeTokens(pages[key], palette);

  // ── the account of it ──────────────────────────────────────────────
  const rationale: string[] = [];
  if (spec?.summary) rationale.push(spec.summary);
  if (spec?.copy) rationale.push('Textes rédigés pour votre boutique par le modèle ; relisez-les dans Studio avant de publier.');
  if (ownCount) rationale.push(`${ownCount} photo${ownCount > 1 ? 's' : ''} générée${ownCount > 1 ? 's' : ''} par IA pour ce que vous vendez (accroche, histoire, promotion) ; les autres viennent de la banque de la niche.`);
  rationale.push(`Niche ${spec ? 'retenue' : 'détectée'} : ${n.label}${n.id === 'general' ? ' (précisez ce que vous vendez pour un design plus ciblé)' : ''}.`);
  rationale.push(r.moodFrom === 'niche' ? `Ambiance ${dark ? 'sombre' : 'claire'}, l’habitude de cette niche.` : `Ambiance ${dark ? 'sombre' : 'claire'}, comme demandé.`);
  rationale.push(r.colour ? `Couleur principale ${r.colour.name} (${palette.primary}), lue dans votre description.` : `Palette ${n.label.toLowerCase()} : ${palette.primary} sur ${palette.bg}.`);
  if (r.roles.bg) rationale.push(`Fond ${r.roles.bg.name} (${palette.bg}), comme demandé, avec un texte ${isDark(palette.bg) ? 'clair' : 'foncé'} pour rester lisible.`);
  if (r.roles.secondary) rationale.push(`Couleur secondaire ${r.roles.secondary.name} (${palette.secondary}).`);
  if (r.buttonLabel) rationale.push(`Bouton supplémentaire dans l’accroche : « ${r.buttonLabel} » (vers le catalogue ; modifiez le texte dans Studio).`);
  const wantedLabels: Record<string, string> = { countdown: 'compte à rebours', promo: 'promotion', reviews: 'avis clients', faq: 'FAQ', story: 'notre histoire', steps: 'étapes de commande', stats: 'chiffres clés', ticker: 'bandeau défilant', slider: 'carrousel de produits', grid: 'grille de produits', whatsapp: 'WhatsApp', photos: 'photos' };
  const added = [...r.wants].filter((w) => w !== 'button' && wantedLabels[w]).map((w) => wantedLabels[w]);
  if (added.length) rationale.push(`Demandé et inclus : ${added.join(', ')}.`);
  const dropped = [...r.drops].filter((w) => wantedLabels[w]).map((w) => wantedLabels[w]);
  if (dropped.length) rationale.push(`Laissé de côté, comme demandé : ${dropped.join(', ')}.`);
  rationale.push(`Police ${r.font}${r.fontFrom === 'niche' ? ', celle qui convient à cette niche' : ''}.`);
  rationale.push(`Style « ${kit.label} » : ${kit.hero.align === 'left' ? 'accroche alignée à gauche' : 'accroche centrée'}${kit.hero.uppercase ? ', titres en capitales' : ''}, boutons ${kit.button.radius >= 999 ? 'arrondis' : kit.button.radius === 0 ? 'carrés' : 'à coins doux'}, produits ${kit.product.cardStyle === 'card' ? 'en cartes' : kit.product.cardStyle === 'flat' ? 'à plat sur la page' : 'épurés'}${kit.hero.band === 'gradient' ? ', bandeaux en dégradé' : ''}.`);
  rationale.push(`Accroche ${heroVariant === 'split' ? 'en deux colonnes, avec vos univers en carrousel' : heroVariant === 'stacked' ? 'centrée, suivie de trois cartes' : heroVariant === 'card' ? 'à gauche, avec une carte de chiffres clés à droite' : 'centrée'}${r.minimal ? '' : ', sur un dégradé de la palette'}${heroHighlight ? `, « ${heroHighlight} » en couleur` : ''}.`);
  rationale.push(`Garanties en ${uspVariant === 'marquee' ? 'bandeau défilant' : uspVariant === 'plain' ? 'texte, sans cartes' : 'cartes'} ; catalogue en ${productsVariant === 'slider' ? 'carrousel' : productsVariant === 'grid4' ? 'grille de 4' : 'grille de 3'}.`);
  const parts: string[] = [];
  if (!r.drops.has('reviews')) parts.push(`avis en ${reviewsVariant === 'grid' ? 'grille' : reviewsVariant === 'band' ? 'grande citation' : 'carrousel'}`);
  if (!r.drops.has('faq')) parts.push(`FAQ en ${faqVariant === 'cards' ? 'cartes' : 'deux colonnes'}`);
  if (extras.includes('promo')) parts.push(withCountdown ? 'promotion avec compte à rebours' : 'promotion sans urgence');
  if (parts.length) rationale.push(`${parts.join(', ')}.`.replace(/^./, (c) => c.toUpperCase()));
  if (r.minimal) rationale.push('Composition minimale : moins de sections, plus d’air.');
  rationale.push(photo('hero') ? 'Photos d’ambiance de la niche incluses ; remplacez-les par les vôtres dans Studio.' : 'Aucune photo d’ambiance pour cette niche encore ; ajoutez les vôtres dans Studio.');

  const label = storeName ? `${storeName} · ${n.label}` : `${n.label} · variante ${seed + 1}`;

  return {
    label, niche: n.id, nicheLabel: n.label, mood: dark ? 'dark' : 'light', palette, fontFamily: r.font, seed,
    variant: { kit: kit.id, hero: heroVariant, usp: uspVariant, products: productsVariant, reviews: reviewsVariant, faq: faqVariant, steps: stepsVariant, promo: extras.includes('promo') ? (withCountdown ? `${promoVariant}+countdown` : promoVariant) : 'none', extras: extras.join(',') },
    sections: home.map((s) => s.label ?? s.id).filter((l) => l !== 'WhatsApp'),
    rationale,
    pages,
  };
}

/** The example briefs the panel offers, one per niche that has a distinct look. */
export const EXAMPLE_BRIEFS: { title: string; prompt: string }[] = [
  { title: 'Cosmétiques au safran', prompt: 'Boutique de soins anti-âge au safran et argan bio, rose poudré, douce et élégante, avec témoignages et offre découverte' },
  { title: 'Sneakers & streetwear', prompt: 'Boutique streetwear et sneakers, sombre, orange vif, drops limités avec compte à rebours et grille de produits' },
  { title: 'Gadgets high-tech', prompt: 'Boutique de gadgets high-tech et écouteurs, ambiance dark futuriste néon cyan, garanties en bandeau défilant' },
  { title: 'Épicerie fine bio', prompt: 'Épicerie fine bio : miel, huile d’olive, thé et coffrets cadeaux, vert olive, chaleureuse, avec l’histoire des producteurs' },
  { title: 'Mobilier en bois', prompt: 'Boutique de mobilier en bois massif fabriqué au Maroc, tons chauds, collections de l’atelier, livré et installé' },
  { title: 'Puériculture', prompt: 'Boutique bébé et puériculture, bleu ciel, rassurante, étapes de commande et FAQ' },
  { title: 'Home gym', prompt: 'Équipement de fitness et musculation pour la maison, rouge et noir, énergique, avec chiffres et promotion' },
  { title: 'Bijoux & montres', prompt: 'Bijouterie de luxe et montres, nuit et or, serif élégant, service écrin cadeau' },
  { title: 'Formations en ligne', prompt: 'Formations et licences logicielles pour freelances, bleu, moderne, formules et FAQ en cartes' },
  { title: 'Minimal noir & blanc', prompt: 'Boutique de mode minimaliste noir et blanc, épurée, grille de 4 produits, sans fioritures' },
];

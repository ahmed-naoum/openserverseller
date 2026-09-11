import type { PageDocument, PageKind, SectionNode, AnyNode } from '../document/types.js';
import { defaultsFor } from '../blocks/index.js';

/**
 * Starting points. A template is a whole document a seller applies in one
 * step; every block in it carries the registry's defaults with a few values
 * overridden, and theme tokens where a colour should follow the store.
 *
 * Applying one is not special: the editor turns it into ordinary operations
 * (remove every section, insert these) through the same command layer that
 * handles a drag, so it is undoable and an agent can apply one too.
 *
 * Copy is real copy for a Moroccan COD store, not lorem ipsum — a seller who
 * applies a template and publishes without touching a word should still have
 * something a customer can read.
 */

export interface Template {
  id: string;
  /** Which page kinds it makes sense for. */
  kinds: PageKind[];
  label: { fr: string; en: string };
  description: { fr: string; en: string };
  document: PageDocument;
}

function block(id: string, type: string, overrides: Record<string, unknown> = {}, bind?: Record<string, string>): AnyNode {
  const node: AnyNode = { id, type: 'block', block: type, props: { ...defaultsFor(type), ...overrides } };
  if (bind) (node as any).bind = bind;
  return node;
}

function section(id: string, children: AnyNode[], style?: Record<string, unknown>, label?: string): SectionNode {
  const s: SectionNode = { id, type: 'section', children: children as SectionNode['children'] };
  if (style) s.style = style as any;
  if (label) s.label = label;
  return s;
}

function doc(kind: PageKind, root: SectionNode[], settings: Record<string, unknown> = {}): PageDocument {
  return { version: 3, kind, settings, root };
}

export const TEMPLATES: Template[] = [
  {
    id: 'landing-classic',
    kinds: ['landing'],
    label: { fr: 'Page produit classique', en: 'Classic product page' },
    description: { fr: 'Titre, photo, bénéfices en carrousel, formulaire de commande, bouton flottant.', en: 'Headline, photo, benefits carousel, order form, sticky button.' },
    document: doc('landing', [
      section('hero', [
        block('h', 'hero', { title: 'Le produit qui change vos matins', subtitle: 'Livraison partout au Maroc — paiement à la réception.', bgColor: '$bg', titleColor: '$text', subtitleColor: '$muted' }),
        block('img', 'image', { url: '', alt: 'Photo du produit', width: 100 }),
      ], undefined, 'Accroche'),
      section('why', [
        block('t', 'text', { text: 'Pourquoi nos clients le recommandent', isHeading: true, align: 'center', color: '$text' }),
        block('sl', 'slider', { slides: [
          { title: 'Qualité garantie', description: 'Testé et approuvé par des centaines de clients.', mediaUrl: '' },
          { title: 'Livraison 24/48h', description: 'Expédié le jour même dans tout le Maroc.', mediaUrl: '' },
          { title: 'Paiement à la livraison', description: 'Vous payez uniquement à la réception.', mediaUrl: '' },
        ], cardsPerView: 1, dotColor: '$primary' }),
      ], undefined, 'Bénéfices'),
      section('order', [
        block('cd', 'countdown', { text: "🔥 Offre limitée — l'offre expire bientôt !" }),
        block('co', 'express_checkout', { themeColor: '$primary', priceColor: '$primary', packColor: '$primary' }),
        block('btn', 'button', { text: 'COMMANDER MAINTENANT', bgColor: '$primary', stickyMobile: true, behavior: 'checkout' }),
      ], undefined, 'Commande'),
    ], { maxWidth: 640 }),
  },
  {
    id: 'store-home-classic',
    kinds: ['home'],
    label: { fr: 'Accueil — boutique classique', en: 'Home — classic store' },
    description: { fr: 'Bandeau de bienvenue, grille de produits, arguments de confiance.', en: 'Welcome band, product grid, trust points.' },
    document: doc('home', [
      section('welcome', [
        block('h', 'hero', { title: 'Bienvenue dans notre boutique', subtitle: 'Des produits sélectionnés, livrés partout au Maroc.', bgColor: '$primary', titleColor: '#ffffff', subtitleColor: 'rgba(255,255,255,0.85)', paddingTop: 56, paddingBottom: 56 }),
      ], undefined, 'Bienvenue'),
      section('catalogue', [
        block('t', 'text', { text: 'Nos produits', isHeading: true, align: 'center', color: '$text' }),
        block('grid', 'products', { layoutType: 'grid', gridCols: 3, showPrice: true, priceColor: '$primary', btnBg: '$primary' }, { items: '$catalogue' }),
      ], { paddingTop: 24, paddingBottom: 24 }, 'Produits'),
      section('trust', [
        block('sl', 'slider', { slides: [
          { title: 'Livraison rapide', description: '24 à 48h dans toutes les villes du Maroc.', mediaUrl: '' },
          { title: 'Paiement à la livraison', description: 'Aucun paiement en ligne. Vous payez à la réception.', mediaUrl: '' },
          { title: 'Service client', description: 'Une équipe disponible sur WhatsApp 7j/7.', mediaUrl: '' },
        ], cardsPerView: 3, showDots: false, showArrows: false, dotColor: '$primary' }),
      ], { background: '#f8fafc', paddingTop: 32, paddingBottom: 32 }, 'Confiance'),
    ], { maxWidth: 1600 }),
  },
  {
    id: 'store-home-hero-split',
    kinds: ['home'],
    label: { fr: 'Accueil — visuel et vedette', en: 'Home — visual and featured' },
    description: { fr: 'Image et texte côte à côte, puis les produits vedettes.', en: 'Image beside text, then featured products.' },
    document: doc('home', [
      section('hero', [
        { id: 'row', type: 'layout', layout: 'row', columns: [6, 6], gap: 32, children: [
          block('img', 'image', { url: '', alt: 'Visuel de la boutique', width: 100 }),
          block('h', 'hero', { title: 'La qualité, livrée chez vous', subtitle: 'Commandez en 30 secondes. Payez à la livraison.', bgColor: 'transparent', titleColor: '$text', subtitleColor: '$muted', paddingTop: 24, paddingBottom: 24 }),
        ] } as AnyNode,
        block('btn', 'button', { text: 'Voir les produits', bgColor: '$primary', behavior: 'link', link: '/products', stickyMobile: false }),
      ], { paddingTop: 32, paddingBottom: 16 }, 'Vedette'),
      section('catalogue', [
        block('grid', 'products', { layoutType: 'slider', gridCols: 3, showPrice: true, priceColor: '$primary', btnBg: '$primary', animationType: 'smooth' }, { items: '$catalogue' }),
      ], { paddingTop: 16, paddingBottom: 40 }, 'Produits'),
    ], { maxWidth: 1600 }),
  },
  {
    id: 'store-info-page',
    kinds: ['page'],
    label: { fr: 'Page d\'information', en: 'Information page' },
    description: { fr: 'Titre et paragraphes : livraison, retours, contact.', en: 'Heading and paragraphs: shipping, returns, contact.' },
    document: doc('page', [
      section('body', [
        block('t1', 'text', { text: 'Livraison et retours', isHeading: true, color: '$text' }),
        block('p1', 'text', { text: 'Nous livrons dans toutes les villes du Maroc sous 24 à 48 heures. Le paiement se fait à la réception du colis.', color: '$muted' }),
        block('t2', 'text', { text: 'Retours', isHeading: true, color: '$text' }),
        block('p2', 'text', { text: 'Un produit abîmé ou non conforme est repris sans frais dans les 7 jours. Contactez-nous sur WhatsApp avec votre numéro de commande.', color: '$muted' }),
      ], { paddingTop: 24, paddingBottom: 40, maxWidth: 800 }, 'Contenu'),
    ], { maxWidth: 1600 }),
  },
  {
    id: 'store-header-standard',
    kinds: ['page'],
    label: { fr: 'En-tête standard', en: 'Standard header' },
    description: { fr: 'Annonce, marque, menu, panier.', en: 'Announcement, brand, menu, cart.' },
    document: doc('page', [
      section('hdr', [block('sh', 'site_header', { ctaText: '' })], undefined, 'En-tête'),
    ]),
  },
  {
    id: 'store-footer-standard',
    kinds: ['page'],
    label: { fr: 'Pied de page standard', en: 'Standard footer' },
    description: { fr: 'Marque, liens, badges de confiance, mentions.', en: 'Brand, links, trust badges, legal line.' },
    document: doc('page', [
      section('ftr', [block('sf', 'site_footer', { bgColor: '$secondary' })], undefined, 'Pied de page'),
    ]),
  },
];

export function templatesFor(kind: PageKind): Template[] {
  return TEMPLATES.filter((t) => t.kinds.includes(kind));
}

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

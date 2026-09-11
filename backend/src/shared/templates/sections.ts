import type { SectionNode, AnyNode } from '../document/types.js';
import { defaultsFor } from '../blocks/index.js';

export type SectionCategory =
  | 'hero'
  | 'trust'
  | 'product'
  | 'bundles'
  | 'social_proof'
  | 'how_to'
  | 'urgency'
  | 'story'
  | 'faq'
  | 'cta'
  | 'features'
  | 'gallery';

export interface SectionDefinition {
  id: string;
  name: string;
  category: SectionCategory;
  categoryLabel: string;
  description: string;
  badge?: string;
  build: (prefix?: string) => SectionNode;
}

function uid(p: string, s: string) {
  return `${p}-${s}-${Math.random().toString(36).slice(2, 6)}`;
}

function block(id: string, type: string, overrides: Record<string, unknown> = {}, bind?: Record<string, string>): AnyNode {
  const node: AnyNode = { id, type: 'block', block: type, props: { ...defaultsFor(type), ...overrides } };
  if (bind) (node as any).bind = bind;
  return node;
}

function row(id: string, columns: number[], children: AnyNode[], gap = 20): AnyNode {
  return { id, type: 'layout', layout: 'row', columns, gap, children } as AnyNode;
}

function section(id: string, children: AnyNode[], style?: Record<string, unknown>, label?: string): SectionNode {
  const s: SectionNode = { id, type: 'section', children: children as SectionNode['children'] };
  if (style) s.style = style as any;
  if (label) s.label = label;
  return s;
}

// ─────────────────────────────────────────────────────────────────────────────
// 60+ SECTIONS FOR E-COMMERCE, DROPSHIPPING, SELLING, COD & PRODUCT MARKETING
// ─────────────────────────────────────────────────────────────────────────────

export const SECTIONS_CATALOG: SectionDefinition[] = [
  // =========================================================================
  // 1. HERO & ACCROCHES (6 SECTIONS)
  // =========================================================================
  {
    id: 'hero-center-impact',
    name: 'Hero Centré Haute Conversion',
    category: 'hero',
    categoryLabel: 'Accroches & Hero',
    description: 'Titre percutant centré, sous-titre explicatif, bouton d\'action massif et badge réassurance.',
    badge: 'Best-Seller',
    build: (p = 'sec') =>
      section(uid(p, 'hero_cnt'), [
        block(uid(p, 'h1'), 'hero', {
          title: 'La Révolution de Votre Quotidien, Livrée Chez Vous',
          subtitle: 'Découvrez notre produit phare sélectionné avec soin. Expédition express 24/48h partout au Maroc — Paiement en espèces à la livraison.',
          bgColor: 'transparent',
          titleColor: '$text',
          subtitleColor: '$muted',
          paddingTop: 80,
          paddingBottom: 24,
        }),
        block(uid(p, 'btn1'), 'button', {
          text: 'COMMANDER MAINTENANT (PAIEMENT À LA LIVRAISON)',
          bgColor: '$primary',
          textColor: '#ffffff',
          buttonBorderRadius: 12,
          buttonPaddingX: 40,
          behavior: 'link',
          link: '/products',
          paddingTop: 0,
          paddingBottom: 40,
        }),
      ], { maxWidth: 1200 }, 'Accroche Centrée'),
  },

  {
    id: 'hero-split-photo',
    name: 'Hero Split Photo & Avantages Clés',
    category: 'hero',
    categoryLabel: 'Accroches & Hero',
    description: 'Image produit haute définition à gauche, texte vendeur avec liste de bénéfices à droite.',
    build: (p = 'sec') =>
      section(uid(p, 'hero_spl'), [
        row(uid(p, 'r1'), [6, 6], [
          block(uid(p, 'img1'), 'image', { url: '', alt: 'Produit vedette', width: 100 }),
          block(uid(p, 'h2'), 'hero', {
            title: 'Qualité Supérieure. Résultats Prouvés.',
            subtitle: 'Conçu avec les meilleurs matériaux pour vous apporter confort et durabilité. Testé et approuvé par des milliers de clients au Maroc.',
            bgColor: 'transparent',
            titleColor: '$text',
            subtitleColor: '$muted',
            paddingTop: 40,
            paddingBottom: 24,
          }),
        ], 32),
        block(uid(p, 'btn2'), 'button', {
          text: 'PROFITER DE L\'OFFRE -50%',
          bgColor: '$primary',
          textColor: '#ffffff',
          buttonBorderRadius: 8,
          buttonPaddingX: 36,
          behavior: 'link',
          link: '/products',
          paddingTop: 0,
          paddingBottom: 48,
        }),
      ], { maxWidth: 1300 }, 'Hero Split Produit'),
  },

  {
    id: 'hero-video-demo',
    name: 'Hero Démonstration Vidéo Produit',
    category: 'hero',
    categoryLabel: 'Accroches & Hero',
    description: 'Titre fort, vidéo explicative / TikTok produit intégrée et bouton de commande immédiate.',
    badge: 'Dropshipping',
    build: (p = 'sec') =>
      section(uid(p, 'hero_vid'), [
        block(uid(p, 't1'), 'text', { text: 'Voyez le produit en action avant de commander', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'v1'), 'video', { videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', autoPlay: false }),
        block(uid(p, 'btn3'), 'button', { text: 'JE VEUX LE MÊME — COMMANDER EN 1 CLIC', bgColor: '$primary', textColor: '#ffffff', buttonBorderRadius: 999, paddingTop: 16, paddingBottom: 40 }),
      ], { maxWidth: 1000 }, 'Hero Démonstration Vidéo'),
  },

  {
    id: 'hero-flash-sale',
    name: 'Hero Vente Flash avec Urgence',
    category: 'hero',
    categoryLabel: 'Accroches & Hero',
    description: 'Compte à rebours bien visible, annonce promotionnelle et accroche orientée liquidation rapide.',
    badge: 'Urgence',
    build: (p = 'sec') =>
      section(uid(p, 'hero_fls'), [
        block(uid(p, 'cd1'), 'countdown', { text: '⚡ VENTE FLASH EXCLUSIVE : -40% VALABLE JUSQU\'À MINUIT' }),
        block(uid(p, 'h3'), 'hero', {
          title: 'Stock Limité : Seulement 15 Pièces Restantes',
          subtitle: 'Ne manquez pas l\'opportunité d\'obtenir ce produit avant rupture de stock complète. Livraison gratuite offerte aujourd\'hui.',
          bgColor: 'transparent',
          titleColor: '$text',
          subtitleColor: '$muted',
          paddingTop: 32,
          paddingBottom: 24,
        }),
        block(uid(p, 'btn4'), 'button', { text: 'RÉSERVER MA PIÈCE AVANT RUPTURE', bgColor: '$primary', textColor: '#ffffff', buttonBorderRadius: 8, paddingTop: 0, paddingBottom: 40 }),
      ], { background: '$bg', maxWidth: 1100 }, 'Hero Vente Flash'),
  },

  {
    id: 'hero-luxury-editorial',
    name: 'Hero Luxe & Écrin Signature',
    category: 'hero',
    categoryLabel: 'Accroches & Hero',
    description: 'Typographie noble, fond sombre ou crème, disposition élégante pour parfums, bijoux ou montres.',
    build: (p = 'sec') =>
      section(uid(p, 'hero_lux'), [
        block(uid(p, 'h4'), 'hero', {
          title: 'L\'Art de Vivre & Le Raffinement Pur',
          subtitle: 'Une création rare, façonnée pour ceux qui n\'acceptent aucun compromis sur l\'excellence et le prestige.',
          bgColor: '$secondary',
          titleColor: '#ffffff',
          subtitleColor: 'rgba(255,255,255,0.8)',
          paddingTop: 96,
          paddingBottom: 40,
        }),
        block(uid(p, 'btn5'), 'button', { text: 'DÉCOUVRIR L\'ÉDITION SIGNATURE', bgColor: '$primary', textColor: '#0f172a', buttonBorderRadius: 2, buttonPaddingX: 44, paddingTop: 0, paddingBottom: 64 }),
      ], { background: '$secondary' }, 'Hero Luxe Signature'),
  },

  {
    id: 'hero-3d-tech',
    name: 'Hero High-Tech & Cyber Neon',
    category: 'hero',
    categoryLabel: 'Accroches & Hero',
    description: 'Esthétique cyberpunk, fond ultra-sombre, badges néon, idéal gadgets, écouteurs ou crypto.',
    build: (p = 'sec') =>
      section(uid(p, 'hero_tch'), [
        block(uid(p, 'h5'), 'hero', {
          title: 'La Puissance Technologique de Demain',
          subtitle: 'Performance extrême, connectivité intelligente et ergonomie sans faille. Découvrez l\'avenir dès maintenant.',
          bgColor: '$secondary',
          titleColor: '#f8fafc',
          subtitleColor: '#94a3b8',
          paddingTop: 80,
          paddingBottom: 24,
        }),
        block(uid(p, 'btn6'), 'button', { text: 'COMMANDER LE PACK TECH', bgColor: '$primary', textColor: '#04101e', buttonBorderRadius: 8, paddingTop: 0, paddingBottom: 48 }),
      ], { background: '$secondary' }, 'Hero Cyber Tech'),
  },

  // =========================================================================
  // 2. GARANTIES, RÉASSURANCE & CONFIANCE COD (7 SECTIONS)
  // =========================================================================
  {
    id: 'trust-cod-maroc-express',
    name: 'Garanties COD Maroc Express (3 Cartes)',
    category: 'trust',
    categoryLabel: 'Garanties & Confiance',
    description: 'Les 3 piliers essentiels pour rassurer les acheteurs marocains : livraison 24/48h, paiement cash, support.',
    badge: 'Essentiel COD',
    build: (p = 'sec') =>
      section(uid(p, 'trust_cod'), [
        block(uid(p, 's1'), 'slider', {
          slides: [
            { title: 'Livraison Rapide 24/48h', description: 'Expédition soignée dans toutes les villes et régions du Maroc.', mediaUrl: '' },
            { title: 'Paiement à la Livraison', description: 'Aucune carte bancaire requise : vous réglez en espèces au livreur.', mediaUrl: '' },
            { title: 'Assistance WhatsApp 7j/7', description: 'Notre équipe vous répond et vous accompagne avant et après votre achat.', mediaUrl: '' },
          ],
          cardsPerView: 3,
          showDots: false,
          cardBg: '#ffffff',
          cardRadius: 16,
          titleColor: '$text',
          descColor: '$muted',
          dotColor: '$primary',
        }),
      ], { background: '#f8fafc', paddingTop: 32, paddingBottom: 32 }, 'Garanties COD Maroc'),
  },

  {
    id: 'trust-marquee-ticker',
    name: 'Bandeau Défilant / Marquee Avantages',
    category: 'trust',
    categoryLabel: 'Garanties & Confiance',
    description: 'Texte d\'arguments défilant en continu : Livraison Gratuite • Satisfait ou Remboursé • 100% Authentique.',
    build: (p = 'sec') =>
      section(uid(p, 'trust_mrq'), [
        block(uid(p, 't2'), 'text', {
          text: '⚡ LIVRAISON 24/48H PARTOUT AU MAROC  ★  PAIEMENT EN ESPÈCES À LA RÉCEPTION  ★  PRODUIT 100% CONFORME OU REMBOURSÉ  ★  SUPPORT WHATSAPP 7J/7',
          align: 'center',
          color: '#ffffff',
        }),
      ], { background: '$primary', paddingTop: 14, paddingBottom: 14 }, 'Bandeau Défilant'),
  },

  {
    id: 'trust-4-badges-security',
    name: '4 Badges de Confiance & Contrôle Qualité',
    category: 'trust',
    categoryLabel: 'Garanties & Confiance',
    description: 'Quatre piliers de réassurance : Contrôle Qualité, Échange 7j, Emballage Sécurisé, Test Avant Achat.',
    build: (p = 'sec') =>
      section(uid(p, 'trust_4b'), [
        block(uid(p, 's2'), 'slider', {
          slides: [
            { title: 'Qualité Contrôlée', description: 'Chaque article est vérifié à la main avant l\'expédition.', mediaUrl: '' },
            { title: 'Échange Facile sous 7 Jours', description: 'Problème de taille ou de modèle ? Nous échangeons sans tracas.', mediaUrl: '' },
            { title: 'Emballage Protecteur Renforcé', description: 'Votre colis arrive en parfait état, prêt à l\'usage.', mediaUrl: '' },
            { title: 'Zéro Risque Pour Vous', description: 'Vous ne payez que lorsque le colis est entre vos mains.', mediaUrl: '' },
          ],
          cardsPerView: 4,
          showDots: false,
          cardBg: '#ffffff',
          titleColor: '$text',
          descColor: '$muted',
        }),
      ], { background: '$bg', paddingTop: 28, paddingBottom: 28 }, '4 Badges Confiance'),
  },

  {
    id: 'trust-guarantee-seal',
    name: 'Garantie Satisfait ou Remboursé (Sceau Officiel)',
    category: 'trust',
    categoryLabel: 'Garanties & Confiance',
    description: 'Section centrée avec engagement fort : satisfait ou remboursé sous 14 jours sans condition.',
    build: (p = 'sec') =>
      section(uid(p, 'trust_seal'), [
        block(uid(p, 't3'), 'text', { text: 'Notre Promesse : 100% de Satisfaction Garantie', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 't4'), 'text', {
          text: 'Si pour une raison quelconque vous n\'êtes pas entièrement comblé par votre commande, contactez simplement notre service client sur WhatsApp sous 14 jours. Nous vous échangeons le produit ou vous remboursons intégralement.',
          align: 'center',
          color: '$muted',
        }),
        block(uid(p, 'btn7'), 'button', { text: 'COMMANDER EN TOUTE TRANQUILLITÉ', bgColor: '$primary', textColor: '#ffffff', buttonBorderRadius: 8, align: 'center', paddingTop: 16 }),
      ], { background: '#f1f5f9', paddingTop: 40, paddingBottom: 48, maxWidth: 880 }, 'Garantie Satisfait ou Remboursé'),
  },

  {
    id: 'trust-comparison-table',
    name: 'Comparatif : Notre Produit vs Autres',
    category: 'trust',
    categoryLabel: 'Garanties & Confiance',
    description: 'Tableau comparatif montrant les atouts majeurs de votre boutique face aux imitations bas de gamme.',
    badge: 'Conversion +32%',
    build: (p = 'sec') =>
      section(uid(p, 'trust_cmp'), [
        block(uid(p, 't5'), 'text', { text: 'Pourquoi Choisir Notre Produit Plutôt Qu\'une Imitation ?', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 's3'), 'slider', {
          slides: [
            { title: '✓ Notre Marque Authentique', description: 'Matériaux nobles durables, finitions précises, garantie 1 an et SAV local au Maroc.', mediaUrl: '' },
            { title: '✗ Copies & Contrefaçons', description: 'Plastique fragile, aucune garantie, panne rapide et service client injoignable.', mediaUrl: '' },
          ],
          cardsPerView: 2,
          showDots: false,
          cardBg: '#ffffff',
          titleColor: '$text',
          descColor: '$muted',
        }),
      ], { background: '$bg', paddingTop: 36, paddingBottom: 48, maxWidth: 1000 }, 'Comparatif Qualité'),
  },

  {
    id: 'trust-traceability-origin',
    name: 'Origine Certifiée & Traçabilité Garantie',
    category: 'trust',
    categoryLabel: 'Garanties & Confiance',
    description: 'Mise en avant du terroir marocain, des coopératives certifiées ou des laboratoires partenaires.',
    build: (p = 'sec') =>
      section(uid(p, 'trust_org'), [
        block(uid(p, 't6'), 'text', { text: 'Origine et Pureté 100% Certifiées', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 't7'), 'text', { text: 'Directement sélectionné auprès des meilleurs producteurs et artisans sans intermédiaire. Nous garantissons la traçabilité complète de chaque lot.', align: 'center', color: '$muted' }),
      ], { background: '#fef3c7', paddingTop: 32, paddingBottom: 32 }, 'Origine Certifiée'),
  },

  {
    id: 'trust-whatsapp-support',
    name: 'Support Client Direct sur WhatsApp',
    category: 'trust',
    categoryLabel: 'Garanties & Confiance',
    description: 'Bannière interactive incitant le client à poser ses questions directement sur WhatsApp.',
    build: (p = 'sec') =>
      section(uid(p, 'trust_wa'), [
        block(uid(p, 'w1'), 'whatsapp', { enableWidget: true, headline: 'Une question sur votre commande ?', nickname: 'Conseiller Client' }),
      ], { background: '$bg', paddingTop: 16, paddingBottom: 16 }, 'Bannière WhatsApp'),
  },

  // =========================================================================
  // 3. PRÉSENTATION PRODUIT & DÉTAILS VENDEURS (7 SECTIONS)
  // =========================================================================
  {
    id: 'prod-grid-3cols',
    name: 'Grille Produits Vedettes (3 Colonnes)',
    category: 'product',
    categoryLabel: 'Produits & Détails',
    description: 'La grille e-commerce standard la plus efficace pour mettre en avant 3 à 6 produits phares.',
    badge: 'Classique',
    build: (p = 'sec') =>
      section(uid(p, 'p_g3'), [
        block(uid(p, 'pt1'), 'text', { text: 'Nos Meilleures Ventes du Moment', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'pg1'), 'products', { layoutType: 'grid', gridCols: 3, showPrice: true, priceColor: '$primary', btnBg: '$primary', cardBg: '#ffffff', cardRadius: 16, titleColor: '$text', descColor: '$muted' }, { items: '$catalogue' }),
      ], { background: '$bg', paddingTop: 36, paddingBottom: 48 }, 'Grille 3 Produits'),
  },

  {
    id: 'prod-grid-4cols',
    name: 'Grille Produits Large (4 Colonnes)',
    category: 'product',
    categoryLabel: 'Produits & Détails',
    description: 'Grille compacte et moderne idéale pour les boutiques ayant de nombreuses variantes ou références.',
    build: (p = 'sec') =>
      section(uid(p, 'p_g4'), [
        block(uid(p, 'pt2'), 'text', { text: 'Découvrez Toute la Gamme', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'pg2'), 'products', { layoutType: 'grid', gridCols: 4, showPrice: true, priceColor: '$primary', btnBg: '$primary', cardRadius: 12 }, { items: '$catalogue' }),
      ], { background: '$bg', paddingTop: 32, paddingBottom: 40 }, 'Grille 4 Produits'),
  },

  {
    id: 'prod-carousel-slider',
    name: 'Carrousel Défilant de Produits',
    category: 'product',
    categoryLabel: 'Produits & Détails',
    description: 'Slider dynamique de produits avec défilement fluide pour inviter le visiteur à parcourir l\'offre.',
    build: (p = 'sec') =>
      section(uid(p, 'p_car'), [
        block(uid(p, 'pt3'), 'text', { text: 'Articles Fréquemment Achetés Ensemble', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'pg3'), 'products', { layoutType: 'slider', gridCols: 3, showPrice: true, priceColor: '$primary', btnBg: '$primary' }, { items: '$catalogue' }),
      ], { background: '#f8fafc', paddingTop: 36, paddingBottom: 48 }, 'Carrousel Produits'),
  },

  {
    id: 'prod-spotlight-single',
    name: 'Spotlight Produit Unique (Monoproduit)',
    category: 'product',
    categoryLabel: 'Produits & Détails',
    description: 'Section dédiée à un produit héro avec fiche complète, sélecteur de pack et bouton COD direct.',
    badge: 'Dropshipping Pro',
    build: (p = 'sec') =>
      section(uid(p, 'p_spt'), [
        block(uid(p, 'pd1'), 'product_detail', {}, { product: '$page.product' }),
      ], { maxWidth: 1200, paddingTop: 32, paddingBottom: 48 }, 'Spotlight Produit Unique'),
  },

  {
    id: 'prod-key-features',
    name: 'Zoom Caractéristiques & Bénéfices',
    category: 'product',
    categoryLabel: 'Produits & Détails',
    description: 'Présentation de 4 atouts majeurs (Autonomie, Résistance, Confort, Facilité) avec icônes claires.',
    build: (p = 'sec') =>
      section(uid(p, 'p_feat'), [
        block(uid(p, 'pt4'), 'text', { text: 'Conçu Dans Les Moindres Détails', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'ps1'), 'slider', {
          slides: [
            { title: '1. Matériaux Ultra-Résistants', description: 'Fabriqué pour résister à l\'usure quotidienne intensive.', mediaUrl: '' },
            { title: '2. Prise en Main Immédiate', description: 'Prêt à l\'emploi dès l\'ouverture de la boîte, sans configuration.', mediaUrl: '' },
            { title: '3. Design Ergonomique', description: 'Léger, élégant et facile à transporter partout avec vous.', mediaUrl: '' },
            { title: '4. Économique & Durable', description: 'Un investissement intelligent qui dure dans le temps.', mediaUrl: '' },
          ],
          cardsPerView: 4,
          showDots: false,
          cardBg: '#ffffff',
          titleColor: '$text',
          descColor: '$muted',
        }),
      ], { background: '#f1f5f9', paddingTop: 40, paddingBottom: 48 }, 'Caractéristiques Clés'),
  },

  {
    id: 'prod-size-guide',
    name: 'Guide des Tailles & Variantes',
    category: 'product',
    categoryLabel: 'Produits & Détails',
    description: 'Instructions claires pour choisir la bonne pointure ou taille pour éviter les retours de colis.',
    build: (p = 'sec') =>
      section(uid(p, 'p_sz'), [
        block(uid(p, 'pt5'), 'text', { text: 'Comment Choisir Votre Taille ?', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'pt6'), 'text', { text: 'Nos modèles taillent normalement. Si vous êtes entre deux tailles, nous vous conseillons de choisir la taille supérieure pour un confort optimal.', align: 'center', color: '$muted' }),
      ], { background: '$bg', paddingTop: 24, paddingBottom: 24, maxWidth: 800 }, 'Guide des Tailles'),
  },

  {
    id: 'prod-unboxing-included',
    name: 'Ce Qui Est Inclus Dans la Boîte',
    category: 'product',
    categoryLabel: 'Produits & Détails',
    description: 'Liste visuelle de l\'ensemble des accessoires et cadeaux livrés avec l\'article principal.',
    build: (p = 'sec') =>
      section(uid(p, 'p_unb'), [
        block(uid(p, 'pt7'), 'text', { text: 'Contenu du Coffret Complet', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'ps2'), 'slider', {
          slides: [
            { title: '1x Appareil Principal', description: 'Série certifiée avec emballage scellé.', mediaUrl: '' },
            { title: '2x Accessoires Offerts', description: 'Fournis gracieusement dans ce pack.', mediaUrl: '' },
            { title: '1x Guide en Français & Arabe', description: 'Instructions simples illustrées pas à pas.', mediaUrl: '' },
          ],
          cardsPerView: 3,
          cardBg: '#ffffff',
        }),
      ], { background: '#f8fafc', paddingTop: 32, paddingBottom: 36 }, 'Contenu Coffret'),
  },

  // =========================================================================
  // 4. PACKS, BUNDLES & OFFRES QUANTITÉ (6 SECTIONS)
  // =========================================================================
  {
    id: 'bundle-tiered-pricing',
    name: 'Offre Spéciale Packs Quantité (1, 2 ou 3)',
    category: 'bundles',
    categoryLabel: 'Packs & Offres',
    description: 'Offre dégressive augmentant le panier moyen : 1x (249 MAD), 2x (399 MAD - Économie), 3x (499 MAD - Meilleure Valeur).',
    badge: 'Panier +45%',
    build: (p = 'sec') =>
      section(uid(p, 'bnd_tier'), [
        block(uid(p, 'bt1'), 'text', { text: 'Commandez Plus, Économisez Plus !', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'bs1'), 'slider', {
          slides: [
            { title: 'Pack Découverte (1 Pièce)', description: '249 MAD — Livraison normale.', mediaUrl: '' },
            { title: '🔥 Pack Duo (2 Pièces) — Recommandé', description: '399 MAD (au lieu de 498 MAD) — Vous économisez 99 MAD !', mediaUrl: '' },
            { title: '👑 Pack Famille (3 Pièces)', description: '499 MAD — 1 Offerte + Livraison Express Gratuite !', mediaUrl: '' },
          ],
          cardsPerView: 3,
          showDots: false,
          cardBg: '#ffffff',
          cardRadius: 16,
          titleColor: '$text',
          descColor: '$muted',
        }),
        block(uid(p, 'b_btn'), 'button', { text: 'CHOISIR MON PACK & COMMANDER', bgColor: '$primary', textColor: '#ffffff', buttonBorderRadius: 10, paddingTop: 16 }),
      ], { background: '#fff7ed', paddingTop: 40, paddingBottom: 48 }, 'Packs Dégressifs'),
  },

  {
    id: 'bundle-bogo-free',
    name: 'Offre 1 Acheté = 1 Offert (BOGO)',
    category: 'bundles',
    categoryLabel: 'Packs & Offres',
    description: 'Bannière promotionnelle percutante pour doubler le volume de vente en un éclair.',
    badge: 'Forte Conversion',
    build: (p = 'sec') =>
      section(uid(p, 'bnd_bogo'), [
        block(uid(p, 'bt2'), 'text', { text: '🎁 OFFRE EXCLUSIVE : 1 ACHETÉ = 1 OFFERT', isHeading: true, align: 'center', color: '#ffffff' }),
        block(uid(p, 'bt3'), 'text', { text: 'Pour chaque commande passée aujourd\'hui, nous ajoutons automatiquement un deuxième exemplaire gratuit dans votre colis.', align: 'center', color: 'rgba(255,255,255,0.9)' }),
        block(uid(p, 'b_btn2'), 'button', { text: 'RÉCUPÉRER MON DEUXIÈME EXEMPLAIRE GRATUIT', bgColor: '#ffffff', textColor: '$primary', buttonBorderRadius: 8, paddingTop: 16 }),
      ], { background: '$primary', paddingTop: 36, paddingBottom: 44 }, 'Offre 1 Acheté = 1 Offert'),
  },

  {
    id: 'bundle-gift-box',
    name: 'Coffret Cadeau & Unboxing Premium',
    category: 'bundles',
    categoryLabel: 'Packs & Offres',
    description: 'Mise en avant d\'un emballage luxueux idéal pour offrir un anniversaire ou une fête.',
    build: (p = 'sec') =>
      section(uid(p, 'bnd_gft'), [
        block(uid(p, 'bt4'), 'text', { text: 'Prêt à Offrir : Coffret Cadeau Signature Inclus', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'bt5'), 'text', { text: 'Chaque commande est emballée dans une élégante boîte rigide avec ruban de soie et carte personnalisée.', align: 'center', color: '$muted' }),
      ], { background: '$bg', paddingTop: 32, paddingBottom: 32, maxWidth: 960 }, 'Coffret Cadeau'),
  },

  {
    id: 'bundle-clearance-flash',
    name: 'Déstockage Massif & Liquidation de Saison',
    category: 'bundles',
    categoryLabel: 'Packs & Offres',
    description: 'Bandeau d\'urgence avec réduction drastique pour écouler les fins de séries.',
    build: (p = 'sec') =>
      section(uid(p, 'bnd_clr'), [
        block(uid(p, 'cd2'), 'countdown', { text: '🚨 DÉSTOCKAGE : -60% JUSQU\'À ÉPUISEMENT DU STOCK' }),
        block(uid(p, 'bt6'), 'text', { text: 'Dernières pièces disponibles avant réapprovisionnement.', align: 'center', color: '$muted' }),
      ], { background: '#fef2f2', paddingTop: 20, paddingBottom: 24 }, 'Bandeau Déstockage'),
  },

  {
    id: 'bundle-vip-access',
    name: 'Accès Club VIP & Remise Privilège',
    category: 'bundles',
    categoryLabel: 'Packs & Offres',
    description: 'Encadré élégant offrant une réduction fidélité sur les commandes suivantes.',
    build: (p = 'sec') =>
      section(uid(p, 'bnd_vip'), [
        block(uid(p, 'bt7'), 'text', { text: 'Rejoignez Notre Cercle Privilège', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'bt8'), 'text', { text: 'Recevez un bon de réduction de 100 MAD sur votre prochaine commande dès validation de votre achat.', align: 'center', color: '$muted' }),
      ], { background: '$bg', paddingTop: 32, paddingBottom: 32 }, 'Club VIP'),
  },

  {
    id: 'bundle-wholesale-dropship',
    name: 'Pack Grossiste / Commande en Gros (Wholesale)',
    category: 'bundles',
    categoryLabel: 'Packs & Offres',
    description: 'Proposition tarifaire pour revendeurs, boutiques physiques ou grossistes.',
    build: (p = 'sec') =>
      section(uid(p, 'bnd_whl'), [
        block(uid(p, 'bt9'), 'text', { text: 'Vous Êtes Commerçant ou Revendeur ?', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'bt10'), 'text', { text: 'Bénéficiez de nos tarifs de gros à partir de 10 pièces. Contactez notre département B2B sur WhatsApp.', align: 'center', color: '$muted' }),
      ], { background: '#f1f5f9', paddingTop: 28, paddingBottom: 28 }, 'Pack Grossiste B2B'),
  },

  // =========================================================================
  // 5. PREUVE SOCIALE & AVIS CLIENTS (7 SECTIONS)
  // =========================================================================
  {
    id: 'social-reviews-carousel',
    name: 'Carrousel d\'Avis Clients avec Étoiles ★★★★★',
    category: 'social_proof',
    categoryLabel: 'Preuve Sociale',
    description: 'Témoignages authentiques de clients marocains avec étoiles, prénoms et villes.',
    badge: 'Preuve Sociale',
    build: (p = 'sec') =>
      section(uid(p, 'soc_rev'), [
        block(uid(p, 'st1'), 'text', { text: 'Ce Que Disent Nos Clients Satisfaits', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'ss1'), 'slider', {
          slides: [
            { title: '★★★★★ Yassine, Casablanca', description: '« Reçu en 24h chrono. La qualité est encore meilleure que sur les photos. Je recommande les yeux fermés ! »', mediaUrl: '' },
            { title: '★★★★★ Salma, Rabat', description: '« Le livreur m\'a appelée avant de passer, paiement facile en espèces. Très satisfaite du produit. »', mediaUrl: '' },
            { title: '★★★★★ Mehdi, Marrakech', description: '« Service client au top sur WhatsApp qui a répondu à toutes mes questions en 2 minutes. Bravo ! »', mediaUrl: '' },
          ],
          cardsPerView: 3,
          showDots: false,
          cardBg: '#ffffff',
          titleColor: '$text',
          descColor: '$muted',
          dotColor: '$primary',
        }),
      ], { background: '#f8fafc', paddingTop: 40, paddingBottom: 48 }, 'Carrousel Avis Clients'),
  },

  {
    id: 'social-reviews-grid',
    name: 'Mur d\'Avis Clients (Grille 3×2)',
    category: 'social_proof',
    categoryLabel: 'Preuve Sociale',
    description: 'Grille d\'avis multiples inspirant une confiance immédiate aux nouveaux acheteurs.',
    build: (p = 'sec') =>
      section(uid(p, 'soc_grd'), [
        block(uid(p, 'st2'), 'text', { text: 'Plus de 4 800 Avis Positifs Partout au Maroc', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'ss2'), 'slider', {
          slides: [
            { title: '★★★★★ Fatima, Tanger', description: '« Emballage impeccable et produit conforme à 100%. »', mediaUrl: '' },
            { title: '★★★★★ Karim, Agadir', description: '« Très bon rapport qualité/prix, rien à redire. »', mediaUrl: '' },
            { title: '★★★★★ Kenza, Fès', description: '« J\'avais peur pour le paiement mais tout s\'est très bien passé. »', mediaUrl: '' },
          ],
          cardsPerView: 3,
          cardBg: '#ffffff',
        }),
      ], { background: '$bg', paddingTop: 36, paddingBottom: 44 }, 'Mur d\'Avis Clients'),
  },

  {
    id: 'social-stats-numbers',
    name: 'Compteurs Chiffrés de Succès (+15 000 Commandes)',
    category: 'social_proof',
    categoryLabel: 'Preuve Sociale',
    description: 'Grands chiffres rassurants : 15 000+ commandes livrées, 99.4% de satisfaction, 58 villes desservies.',
    badge: 'Impact Immédiat',
    build: (p = 'sec') =>
      section(uid(p, 'soc_stat'), [
        block(uid(p, 'ss3'), 'slider', {
          slides: [
            { title: '+15 000', description: 'Commandes Livrées avec Succès', mediaUrl: '' },
            { title: '99.4%', description: 'Taux de Satisfaction Client', mediaUrl: '' },
            { title: '58 Villes', description: 'Desservies Partout au Maroc', mediaUrl: '' },
            { title: '< 24h', description: 'Délai Moyen de Préparation', mediaUrl: '' },
          ],
          cardsPerView: 4,
          showDots: false,
          cardBg: '#ffffff',
          titleColor: '$primary',
          descColor: '$text',
        }),
      ], { background: '#f1f5f9', paddingTop: 32, paddingBottom: 32 }, 'Compteurs Statistiques'),
  },

  {
    id: 'social-ugc-photos',
    name: 'Galerie Photos Déballages Réels (UGC)',
    category: 'social_proof',
    categoryLabel: 'Preuve Sociale',
    description: 'Photos de vrais clients recevant et déballant leur colis pour éliminer tout doute.',
    build: (p = 'sec') =>
      section(uid(p, 'soc_ugc'), [
        block(uid(p, 'st3'), 'text', { text: 'Photos Envoyées Par Nos Acheteurs', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'st4'), 'text', { text: 'Rejoignez la communauté et partagez votre expérience avec le hashtag #SilacodVIP', align: 'center', color: '$muted' }),
      ], { background: '$bg', paddingTop: 32, paddingBottom: 32 }, 'Galerie UGC'),
  },

  {
    id: 'social-expert-endorsement',
    name: 'Recommandation d\'un Expert ou Spécialiste',
    category: 'social_proof',
    categoryLabel: 'Preuve Sociale',
    description: 'Citation valorisante d\'un professionnel ou artisan certifié approuvant la qualité du produit.',
    build: (p = 'sec') =>
      section(uid(p, 'soc_exp'), [
        block(uid(p, 'st5'), 'text', { text: '« La solution la plus aboutie que j\'ai eu l\'occasion de tester cette année. »', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'st6'), 'text', { text: '— Dr. A. Mansouri, Spécialiste & Consultant Indépendant', align: 'center', color: '$muted' }),
      ], { background: '#f8fafc', paddingTop: 36, paddingBottom: 36, maxWidth: 900 }, 'Avis d\'Expert'),
  },

  {
    id: 'social-media-press',
    name: 'Logos Partenaires & Transporteurs Officiels',
    category: 'social_proof',
    categoryLabel: 'Preuve Sociale',
    description: 'Affichage des partenaires logistiques et de confiance (Coliaty, Amana, Voies Express).',
    build: (p = 'sec') =>
      section(uid(p, 'soc_med'), [
        block(uid(p, 'st7'), 'text', { text: 'Expédié Par Les Plus Grands Transporteurs Du Maroc', align: 'center', color: '$muted' }),
      ], { background: '$bg', paddingTop: 20, paddingBottom: 20 }, 'Logos Transporteurs'),
  },

  {
    id: 'social-recent-purchases',
    name: 'Notification Ventes Récentes en Direct',
    category: 'social_proof',
    categoryLabel: 'Preuve Sociale',
    description: 'Texte d\'alerte sociale : « 28 personnes ont commandé cet article au cours des 4 dernières heures ».',
    build: (p = 'sec') =>
      section(uid(p, 'soc_rcn'), [
        block(uid(p, 'st8'), 'text', { text: '🔥 Forte Demande : 34 commandes passées aujourd\'hui à Casablanca, Rabat et Marrakech.', align: 'center', color: '$primary' }),
      ], { background: '#fff1f2', paddingTop: 12, paddingBottom: 12 }, 'Ventes Récentes'),
  },

  // =========================================================================
  // 6. GUIDE, COMMENT COMMANDER & PROCESSUS COD (5 SECTIONS)
  // =========================================================================
  {
    id: 'how-order-3steps',
    name: 'Comment Commander en 3 Étapes Faciles (COD)',
    category: 'how_to',
    categoryLabel: 'Comment Commander',
    description: 'Le processus COD expliqué simplement pour éliminer toute barrière technique chez l\'acheteur.',
    badge: 'Essentiel E-Com',
    build: (p = 'sec') =>
      section(uid(p, 'how_3st'), [
        block(uid(p, 'ht1'), 'text', { text: 'Commander Ne Prend Que 30 Secondes', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'hs1'), 'slider', {
          slides: [
            { title: 'Étape 1 : Remplissez le formulaire', description: 'Indiquez simplement votre nom, téléphone et ville ci-dessous.', mediaUrl: '' },
            { title: 'Étape 2 : Confirmation WhatsApp', description: 'Notre équipe vous contacte pour valider l\'adresse de livraison.', mediaUrl: '' },
            { title: 'Étape 3 : Payez à la réception', description: 'Le livreur vous remet votre colis chez vous et vous réglez en espèces.', mediaUrl: '' },
          ],
          cardsPerView: 3,
          showDots: false,
          cardBg: '#ffffff',
          titleColor: '$text',
          descColor: '$muted',
        }),
      ], { background: '#f8fafc', paddingTop: 40, paddingBottom: 48 }, 'Comment Commander (3 Étapes)'),
  },

  {
    id: 'how-delivery-timeline',
    name: 'Timeline Suivi de Livraison Pas-à-Pas',
    category: 'how_to',
    categoryLabel: 'Comment Commander',
    description: 'Frise chronologique rassurant sur le parcours du colis de l\'entrepôt au domicile.',
    build: (p = 'sec') =>
      section(uid(p, 'how_tml'), [
        block(uid(p, 'ht2'), 'text', { text: 'Votre Colis, De Notre Entrepôt À Votre Porte', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'hs2'), 'slider', {
          slides: [
            { title: 'Jour 1 : Préparation & Emballage', description: 'Vérification minutieuse et scellé de sécurité.', mediaUrl: '' },
            { title: 'Jour 2 : Acheminement Express', description: 'Transfert sécurisé vers le centre de distribution de votre ville.', mediaUrl: '' },
            { title: 'Jour 2/3 : Appel & Remise en Mains Propres', description: 'Le livreur vous appelle pour convenir de l\'heure exacte de passage.', mediaUrl: '' },
          ],
          cardsPerView: 3,
          cardBg: '#ffffff',
        }),
      ], { background: '$bg', paddingTop: 36, paddingBottom: 44 }, 'Timeline Livraison'),
  },

  {
    id: 'how-usage-guide',
    name: 'Guide d\'Utilisation & Mode d\'Emploi',
    category: 'how_to',
    categoryLabel: 'Comment Commander',
    description: 'Guide clair montrant à l\'acheteur comment utiliser le produit dès sa réception.',
    build: (p = 'sec') =>
      section(uid(p, 'how_usg'), [
        block(uid(p, 'ht3'), 'text', { text: 'Mode d\'Emploi & Conseils d\'Usage', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'ht4'), 'text', { text: 'Suivez nos 3 conseils simples pour tirer le maximum de bénéfices de votre article au quotidien.', align: 'center', color: '$muted' }),
      ], { background: '#f1f5f9', paddingTop: 32, paddingBottom: 32, maxWidth: 960 }, 'Mode d\'Emploi'),
  },

  {
    id: 'how-before-after',
    name: 'Preuve Visuelle : Avant / Après (Résultats en 14 Jours)',
    category: 'how_to',
    categoryLabel: 'Comment Commander',
    description: 'Démonstration comparative sans équivoque montrant l\'efficacité du produit.',
    badge: 'Taux de Clic +40%',
    build: (p = 'sec') =>
      section(uid(p, 'how_baf'), [
        block(uid(p, 'ht5'), 'text', { text: 'Des Résultats Visibles Dès Les Premières Utilisations', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'hs3'), 'slider', {
          slides: [
            { title: 'Avant Utilisation', description: 'Fatigue, manque de confort et perte de temps quotidienne.', mediaUrl: '' },
            { title: 'Après 14 Jours d\'Usage', description: 'Bien-être retrouvé, résultats spectaculaires et totale sérénité.', mediaUrl: '' },
          ],
          cardsPerView: 2,
          cardBg: '#ffffff',
        }),
      ], { background: '$bg', paddingTop: 36, paddingBottom: 44, maxWidth: 1000 }, 'Avant / Après'),
  },

  {
    id: 'how-faq-returns-guide',
    name: 'Guide Échanges & Retours Sans Stress',
    category: 'how_to',
    categoryLabel: 'Comment Commander',
    description: 'Explication rassurante sur la procédure d\'échange rapide si la taille ne convient pas.',
    build: (p = 'sec') =>
      section(uid(p, 'how_ret'), [
        block(uid(p, 'ht6'), 'text', { text: 'Une Erreur de Taille ? Aucun Problème.', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'ht7'), 'text', { text: 'Envoyez-nous un message WhatsApp sous 7 jours. Un livreur passera échanger l\'article directement chez vous.', align: 'center', color: '$muted' }),
      ], { background: '#f8fafc', paddingTop: 28, paddingBottom: 28, maxWidth: 880 }, 'Guide Retours'),
  },

  // =========================================================================
  // 7. URGENCE, RARETÉ & CONVERSION DROPSHIPPING (6 SECTIONS)
  // =========================================================================
  {
    id: 'urgency-countdown-banner',
    name: 'Bandeau Décompte d\'Urgence Immédiate',
    category: 'urgency',
    categoryLabel: 'Urgence & Conversion',
    description: 'Compte à rebours animé pour provoquer l\'achat impulsif immédiat.',
    badge: 'Urgence Max',
    build: (p = 'sec') =>
      section(uid(p, 'urg_cd'), [
        block(uid(p, 'ucd1'), 'countdown', { text: '⏳ ATTENTION : CETTE OFFRE EXPIRE DANS QUELQUES MINUTES' }),
      ], { background: '$bg', paddingTop: 16, paddingBottom: 16 }, 'Bandeau Décompte'),
  },

  {
    id: 'urgency-stock-alert',
    name: 'Alerte Stock Critique & Forte Affluence',
    category: 'urgency',
    categoryLabel: 'Urgence & Conversion',
    description: 'Alerte dynamique signalant que le produit risque d\'être en rupture dans les minutes qui suivent.',
    build: (p = 'sec') =>
      section(uid(p, 'urg_stk'), [
        block(uid(p, 'ut1'), 'text', { text: '⚠️ Stock Faible : Il ne reste que 7 exemplaires disponibles à la commande.', align: 'center', color: '#b91c1c' }),
      ], { background: '#fef2f2', paddingTop: 12, paddingBottom: 12 }, 'Alerte Stock'),
  },

  {
    id: 'urgency-free-gift',
    name: 'Cadeau Surprise Offert (Pour les 50 Premiers)',
    category: 'urgency',
    categoryLabel: 'Urgence & Conversion',
    description: 'Stimule la décision en offrant un cadeau physique d\'une valeur de 99 MAD aux premières commandes.',
    build: (p = 'sec') =>
      section(uid(p, 'urg_gft'), [
        block(uid(p, 'ut2'), 'text', { text: '🎁 CADEAU BONUS : Un accessoire exclusif offert aux 50 prochaines commandes.', align: 'center', color: '$primary' }),
      ], { background: '#f0fdf4', paddingTop: 14, paddingBottom: 14 }, 'Cadeau Surprise'),
  },

  {
    id: 'urgency-inline-cod-form',
    name: 'Formulaire Commande Express 1-Clic Intégré',
    category: 'urgency',
    categoryLabel: 'Urgence & Conversion',
    description: 'Formulaire de commande direct intégré dans la page sans passer par le panier.',
    badge: 'COD Direct',
    build: (p = 'sec') =>
      section(uid(p, 'urg_frm'), [
        block(uid(p, 'ut3'), 'text', { text: 'Remplissez vos coordonnées pour être livré en 24/48h :', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'co1'), 'express_checkout', { themeColor: '$primary', priceColor: '$primary' }),
      ], { background: '#ffffff', paddingTop: 36, paddingBottom: 48, maxWidth: 640 }, 'Formulaire COD Intégré'),
  },

  {
    id: 'urgency-price-increase',
    name: 'Avertissement Augmentation Prochaine de Tarif',
    category: 'urgency',
    categoryLabel: 'Urgence & Conversion',
    description: 'Annonce que le tarif promotionnel actuel repassera au prix normal dès demain.',
    build: (p = 'sec') =>
      section(uid(p, 'urg_prc'), [
        block(uid(p, 'ut4'), 'text', { text: 'Le prix repassera à 499 MAD dès la fin du compte à rebours. Profitez du tarif de lancement à 299 MAD maintenant.', align: 'center', color: '$text' }),
      ], { background: '#fffbeb', paddingTop: 16, paddingBottom: 16 }, 'Avertissement Tarif'),
  },

  {
    id: 'urgency-original-authenticity',
    name: 'Avertissement Contrefaçons & Sceau Officiel',
    category: 'urgency',
    categoryLabel: 'Urgence & Conversion',
    description: 'Avertit le client contre les fausses copies bon marché circulant sur les réseaux sociaux.',
    build: (p = 'sec') =>
      section(uid(p, 'urg_aut'), [
        block(uid(p, 'ut5'), 'text', { text: 'Attention aux imitations bon marché ! Seul notre site officiel garantit le modèle original certifié.', align: 'center', color: '$muted' }),
      ], { background: '$bg', paddingTop: 14, paddingBottom: 14 }, 'Sceau Authenticité'),
  },

  // =========================================================================
  // 8. HISTOIRE DE MARQUE, À PROPOS & VALEURS (5 SECTIONS)
  // =========================================================================
  {
    id: 'story-brand-mission',
    name: 'Notre Histoire, Passion & Mission',
    category: 'story',
    categoryLabel: 'Histoire & Marque',
    description: 'Texte narratif élégant racontant les origines de la boutique et l\'engagement qualité.',
    build: (p = 'sec') =>
      section(uid(p, 'sty_mis'), [
        block(uid(p, 'stt1'), 'text', { text: 'Notre Histoire : La Passion du Beau et du Vrai', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'stt2'), 'text', {
          text: 'Fondée avec la volonté d\'offrir le meilleur du marché marocain, notre maison sélectionne chaque produit avec une exigence sans compromis. Nous croyons en des créations durables, utiles et respectueuses de nos clients.',
          align: 'center',
          color: '$muted',
        }),
      ], { background: '$bg', paddingTop: 40, paddingBottom: 40, maxWidth: 900 }, 'Histoire & Mission'),
  },

  {
    id: 'story-3-pillars',
    name: 'Les 3 Piliers de Notre Engagement',
    category: 'story',
    categoryLabel: 'Histoire & Marque',
    description: 'Présentation des valeurs fortes de la marque : Authenticité, Transparence, Proximité.',
    build: (p = 'sec') =>
      section(uid(p, 'sty_pil'), [
        block(uid(p, 'stt3'), 'text', { text: 'Ce Qui Guide Chacun de Nos Choix', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'sts1'), 'slider', {
          slides: [
            { title: '1. Authenticité Inflexible', description: 'Des matières pures et des recettes traditionnelles respectées.', mediaUrl: '' },
            { title: '2. Transparence Totale', description: 'Aucun frais caché, prix net payé à la livraison.', mediaUrl: '' },
            { title: '3. Proximité Humaine', description: 'Une équipe marocaine à votre écoute chaque jour.', mediaUrl: '' },
          ],
          cardsPerView: 3,
          cardBg: '#ffffff',
        }),
      ], { background: '#f8fafc', paddingTop: 36, paddingBottom: 44 }, '3 Piliers de Marque'),
  },

  {
    id: 'story-artisan-workshop',
    name: 'Visite de l\'Atelier & Savoir-Faire',
    category: 'story',
    categoryLabel: 'Histoire & Marque',
    description: 'Mise en avant du travail manuel, des artisans locaux et de la confection soignée.',
    build: (p = 'sec') =>
      section(uid(p, 'sty_art'), [
        block(uid(p, 'stt4'), 'text', { text: 'Au Cœur de Nos Ateliers', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'stt5'), 'text', { text: 'Chaque pièce passe entre les mains expertes d\'artisans chevronnés qui perpétuent un savoir-faire d\'exception.', align: 'center', color: '$muted' }),
      ], { background: '$bg', paddingTop: 32, paddingBottom: 32 }, 'Visite Atelier'),
  },

  {
    id: 'story-eco-responsible',
    name: 'Engagement Éco-Responsable & Solidaire',
    category: 'story',
    categoryLabel: 'Histoire & Marque',
    description: 'Emballages recyclables, réduction de l\'empreinte carbone et soutien aux coopératives.',
    build: (p = 'sec') =>
      section(uid(p, 'sty_eco'), [
        block(uid(p, 'stt6'), 'text', { text: 'Pour un Avenir Plus Propre et Plus Solidaire', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'stt7'), 'text', { text: 'Nous réduisons au maximum le plastique dans nos colis et reversons une partie de nos bénéfices aux artisans partenaires.', align: 'center', color: '$muted' }),
      ], { background: '#f0fdf4', paddingTop: 28, paddingBottom: 28 }, 'Engagement Écolo'),
  },

  {
    id: 'story-meet-team',
    name: 'Rencontrez l\'Équipe & Le Service Client',
    category: 'story',
    categoryLabel: 'Histoire & Marque',
    description: 'Photo et message chaleureux de l\'équipe pour humaniser la boutique en ligne.',
    build: (p = 'sec') =>
      section(uid(p, 'sty_tem'), [
        block(uid(p, 'stt8'), 'text', { text: 'Des Personnes Réelles Derrière Votre Boutique', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'stt9'), 'text', { text: 'Notre équipe logistique et service client basée à Casablanca prépare vos commandes avec le plus grand soin chaque jour.', align: 'center', color: '$muted' }),
      ], { background: '$bg', paddingTop: 32, paddingBottom: 32 }, 'L\'Équipe'),
  },

  // =========================================================================
  // 9. FAQ & RÉPONSES AUX OBJECTIONS (5 SECTIONS)
  // =========================================================================
  {
    id: 'faq-ecommerce-cod',
    name: 'FAQ E-Commerce & Livraison COD (Classique)',
    category: 'faq',
    categoryLabel: 'FAQ & Réponses',
    description: 'Les réponses aux 4 questions les plus posées : délais de livraison, frais, paiement cash et suivi.',
    badge: 'Incontournable',
    build: (p = 'sec') =>
      section(uid(p, 'faq_cls'), [
        block(uid(p, 'ft1'), 'text', { text: 'Foire Aux Questions Fréquentes', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'fs1'), 'slider', {
          slides: [
            { title: 'Quand vais-je recevoir ma commande ?', description: 'La livraison prend entre 24h et 48h ouvrables selon votre ville au Maroc.', mediaUrl: '' },
            { title: 'Comment s\'effectue le paiement ?', description: 'Vous payez directement en espèces au livreur lors de la réception de votre colis.', mediaUrl: '' },
            { title: 'Puis-je ouvrir le colis pour vérifier ?', description: 'Oui, vous pouvez vérifier le contenu devant le livreur avant de régler.', mediaUrl: '' },
            { title: 'Comment faire si le produit ne me plaît pas ?', description: 'Contactez-nous sur WhatsApp sous 7 jours pour un échange ou remboursement rapide.', mediaUrl: '' },
          ],
          cardsPerView: 2,
          showDots: false,
          cardBg: '#ffffff',
          titleColor: '$text',
          descColor: '$muted',
        }),
      ], { background: '#f8fafc', paddingTop: 40, paddingBottom: 48, maxWidth: 1000 }, 'FAQ E-Commerce'),
  },

  {
    id: 'faq-cash-payment-details',
    name: 'FAQ Spécifique Paiement en Espèces au Livreur',
    category: 'faq',
    categoryLabel: 'FAQ & Réponses',
    description: 'Détails rassurants : monnaie, préparation du montant exact, reçu de livraison.',
    build: (p = 'sec') =>
      section(uid(p, 'faq_csh'), [
        block(uid(p, 'ft2'), 'text', { text: 'Tout Savoir sur le Paiement à la Livraison', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'ft3'), 'text', { text: 'Le livreur vous contacte avant de se déplacer. Préparez simplement le montant exact en dirhams pour faciliter la transaction.', align: 'center', color: '$muted' }),
      ], { background: '$bg', paddingTop: 28, paddingBottom: 28, maxWidth: 840 }, 'FAQ Paiement Espèces'),
  },

  {
    id: 'faq-warranty-replacements',
    name: 'FAQ Garantie, Échanges & SAV',
    category: 'faq',
    categoryLabel: 'FAQ & Réponses',
    description: 'Procédure simple et transparente en cas d\'article défectueux ou endommagé.',
    build: (p = 'sec') =>
      section(uid(p, 'faq_war'), [
        block(uid(p, 'ft4'), 'text', { text: 'Garantie & Service Après-Vente', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'ft5'), 'text', { text: 'Tous nos articles bénéficient d\'une garantie constructeur. Si un problème survient, notre équipe vous envoie un nouvel exemplaire sans frais supplémentaires.', align: 'center', color: '$muted' }),
      ], { background: '#f1f5f9', paddingTop: 32, paddingBottom: 32, maxWidth: 880 }, 'FAQ Garantie SAV'),
  },

  {
    id: 'faq-usage-maintenance',
    name: 'FAQ Entretien & Conseils d\'Usage',
    category: 'faq',
    categoryLabel: 'FAQ & Réponses',
    description: 'Conseils pour nettoyer, entretenir et conserver le produit en parfait état.',
    build: (p = 'sec') =>
      section(uid(p, 'faq_mnt'), [
        block(uid(p, 'ft6'), 'text', { text: 'Conseils d\'Entretien & Durabilité', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'ft7'), 'text', { text: 'Conservez votre produit à l\'abri de l\'humidité et nettoyez-le simplement avec un chiffon doux légèrement humide.', align: 'center', color: '$muted' }),
      ], { background: '$bg', paddingTop: 24, paddingBottom: 24 }, 'FAQ Entretien'),
  },

  {
    id: 'faq-objection-killer',
    name: 'Tableau Briseur d\'Objections (Lève-Doutes)',
    category: 'faq',
    categoryLabel: 'FAQ & Réponses',
    description: 'Réponses directes et percutantes aux doutes les plus fréquents des clients sceptiques.',
    badge: 'Anti-Hésitation',
    build: (p = 'sec') =>
      section(uid(p, 'faq_obj'), [
        block(uid(p, 'ft8'), 'text', { text: 'Vous Hésitez Encore ? Voici Nos Réponses Sincères.', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'ft9'), 'text', { text: 'Pas de risque, pas de carte bancaire, pas d\'engagement : vous ne payez que si le produit correspond à vos attentes.', align: 'center', color: '$muted' }),
      ], { background: '#fef3c7', paddingTop: 32, paddingBottom: 32, maxWidth: 900 }, 'Briseur d\'Objections'),
  },

  // =========================================================================
  // 10. APPELS À L'ACTION & CLÔTURE (6 SECTIONS)
  // =========================================================================
  {
    id: 'cta-final-reassurance',
    name: 'Appel à l\'Action Final avec Réassurance Massive',
    category: 'cta',
    categoryLabel: 'Appels à l\'Action',
    description: 'Grand bloc final avec bouton de commande proéminent et badges de garantie.',
    badge: 'Conversion Finale',
    build: (p = 'sec') =>
      section(uid(p, 'cta_fin'), [
        block(uid(p, 'ct1'), 'text', { text: 'Prêt à Découvrir la Différence ?', isHeading: true, align: 'center', color: '#ffffff' }),
        block(uid(p, 'ct2'), 'text', { text: 'Commandez aujourd\'hui et bénéficiez de la livraison express offerte ainsi que du paiement à la livraison partout au Maroc.', align: 'center', color: 'rgba(255,255,255,0.85)' }),
        block(uid(p, 'cbtn1'), 'button', { text: 'COMMANDER MAINTENANT — PAIEMENT CASH', bgColor: '$primary', textColor: '#ffffff', buttonBorderRadius: 12, buttonPaddingX: 44, paddingTop: 16 }),
      ], { background: '$secondary', paddingTop: 64, paddingBottom: 64 }, 'CTA Final Réassurance'),
  },

  {
    id: 'cta-sticky-mobile',
    name: 'Bouton Flottant Mobile Toujours Visible',
    category: 'cta',
    categoryLabel: 'Appels à l\'Action',
    description: 'Bouton collant en bas de l\'écran sur smartphone pour commander à tout instant du scroll.',
    badge: 'Mobile First',
    build: (p = 'sec') =>
      section(uid(p, 'cta_stk'), [
        block(uid(p, 'cbtn2'), 'button', { text: 'COMMANDER (PAIEMENT À LA LIVRAISON)', bgColor: '$primary', textColor: '#ffffff', stickyMobile: true, behavior: 'checkout' }),
      ], { background: '$bg', paddingTop: 12, paddingBottom: 12 }, 'Bouton Sticky Mobile'),
  },

  {
    id: 'cta-free-download-guide',
    name: 'Guide Offert / Recettes Gratuites en Cadeau',
    category: 'cta',
    categoryLabel: 'Appels à l\'Action',
    description: 'Offre d\'un livret PDF gratuit ou guide d\'accompagnement pour enrichir la valeur perçue.',
    build: (p = 'sec') =>
      section(uid(p, 'cta_gde'), [
        block(uid(p, 'ct3'), 'text', { text: 'Inclus Gratuitement : Notre Guide Pratique en PDF', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'ct4'), 'text', { text: 'Envoyé immédiatement sur votre WhatsApp après confirmation de votre commande.', align: 'center', color: '$muted' }),
      ], { background: '#f8fafc', paddingTop: 32, paddingBottom: 32 }, 'Guide PDF Offert'),
  },

  {
    id: 'cta-newsletter-discount',
    name: 'Encadré Réduction Immédiate -10% sur Commande',
    category: 'cta',
    categoryLabel: 'Appels à l\'Action',
    description: 'Invitation à renseigner son numéro WhatsApp pour recevoir un code promo immédiat.',
    build: (p = 'sec') =>
      section(uid(p, 'cta_dis'), [
        block(uid(p, 'ct5'), 'text', { text: 'Obtenez -10% Supplémentaires Sur Votre Panier', isHeading: true, align: 'center', color: '$text' }),
        block(uid(p, 'cbtn3'), 'button', { text: 'ACTIVER MON CODE DE RÉDUCTION', bgColor: '$primary', textColor: '#ffffff', buttonBorderRadius: 8, paddingTop: 12 }),
      ], { background: '$bg', paddingTop: 28, paddingBottom: 28 }, 'Réduction Immédiate'),
  },

  {
    id: 'cta-direct-whatsapp-lead',
    name: 'Commander Directement par Message WhatsApp',
    category: 'cta',
    categoryLabel: 'Appels à l\'Action',
    description: 'Permet aux clients préférant le chat d\'envoyer leur adresse directement via WhatsApp.',
    badge: 'WhatsApp COD',
    build: (p = 'sec') =>
      section(uid(p, 'cta_wal'), [
        block(uid(p, 'w2'), 'whatsapp', { enableWidget: true, headline: 'Vous préférez commander sur WhatsApp ?', nickname: 'Commande Express' }),
      ], { background: '#ecfdf5', paddingTop: 24, paddingBottom: 24 }, 'Commande Directe WhatsApp'),
  },

  {
    id: 'cta-full-ecommerce-footer',
    name: 'Pied de Page E-Commerce avec Mentions Légales',
    category: 'cta',
    categoryLabel: 'Appels à l\'Action',
    description: 'Footer complet et soigné avec coordonnées, conditions de vente et logos de réassurance.',
    build: (p = 'sec') =>
      section(uid(p, 'cta_ftr'), [
        block(uid(p, 'sf1'), 'site_footer', {
          bgColor: '$secondary',
          textColor: '#ffffff',
          mutedColor: 'rgba(255,255,255,0.7)',
          badges: ['Livraison 24/48h', 'Paiement à la livraison', 'Service Client 7j/7'],
        }),
      ], { background: '$secondary' }, 'Pied de Page Complet'),
  },
  // =========================================================================
  // 11. CLONÉS DES MAQUETTES : HEROS PHOTO, CARTES, GALERIES, LISTES, CITATIONS
  // =========================================================================
  {
    id: 'hero-photo-metrics-card',
    name: 'Hero Photo + Carte Métriques Flottante',
    category: 'hero',
    categoryLabel: 'Accroches & Hero',
    description: 'Grand titre à gauche sur un fond photo ou dégradé, carte en verre à droite avec lignes chiffrées, barre de progression et bouton (style Vélora / EcoFuture).',
    badge: 'Maquette',
    build: (p = 'sec') =>
      section(uid(p, 'hero_card'), [
        row(uid(p, 'r'), [7, 5], [
          block(uid(p, 'h'), 'hero', {
            kicker: 'COLLECTION SIGNATURE', kickerStyle: 'line', kickerColor: '$primary',
            title: 'Découvrez des pièces d’exception, livrées chez vous', subtitle: 'Une sélection rare, présentée avec soin. Livraison partout au Maroc, paiement à la réception.',
            bgColor: 'transparent', titleColor: '#ffffff', subtitleColor: 'rgba(255,255,255,0.82)', align: 'left', titleSize: '2xl', maxWidth: 640,
            ctaText: 'VOIR LA COLLECTION', ctaUrl: '/products', ctaBg: '$primary', ctaColor: '#ffffff', ctaRadius: 8,
            secondaryText: 'Nouveautés', secondaryUrl: '/products', secondaryStyle: 'outline', secondaryColor: '#ffffff',
            paddingTop: 8, paddingBottom: 8, marginBottom: 0,
          }),
          block(uid(p, 'ic'), 'info_card', {
            badge: 'Pièce signature', badgeColor: '#fde68a', title: 'Console Atlas', subtitle: 'Noyer massif & laiton brossé',
            rows: [{ label: 'Dimensions', value: '160 × 40 × 82 cm' }, { label: 'Origine', value: 'Atelier de Rabat' }, { label: 'Livraison', value: '7 jours' }],
            progressLabel: 'Stock restant', progressValue: '3 pièces', progressPct: 30, progressColor: '$primary',
            figure: '12 900 DH', figureCaption: 'payée à la livraison', figureColor: '$primary',
            ctaText: 'COMMANDER', ctaUrl: '/products', ctaBg: '#ffffff', ctaColor: '#0f172a',
            style: 'glass', bgColor: 'rgba(15,23,42,0.62)', textColor: '#ffffff', mutedColor: 'rgba(255,255,255,0.72)', borderColor: 'rgba(255,255,255,0.18)', radius: 20, maxWidth: 400, align: 'right',
          }),
        ], 32),
      ], { background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 52%,#9a3412 100%)', backgroundImage: '', overlay: 'rgba(10,14,28,0.45)', paddingTop: 96, paddingBottom: 88, maxWidth: 1280 }, 'Hero photo + carte'),
  },

  {
    id: 'hero-giant-highlight',
    name: 'Hero Titre Géant avec Mot en Couleur',
    category: 'hero',
    categoryLabel: 'Accroches & Hero',
    description: 'Titre en capitales très grand, un mot dans la couleur de marque, deux boutons (plein + contour) sur un dégradé sombre (style Nexus Trade).',
    badge: 'Maquette',
    build: (p = 'sec') =>
      section(uid(p, 'hero_giant'), [
        block(uid(p, 'h'), 'hero', {
          kicker: 'NOUVELLE GÉNÉRATION', kickerStyle: 'pill', kickerColor: '$primary',
          title: 'Élevez votre expérience shopping', highlight: 'expérience shopping', highlightColor: '$primary',
          subtitle: 'Le meilleur du catalogue, expédié sous 24h et payé à la réception.',
          bgColor: 'transparent', titleColor: '#ffffff', subtitleColor: 'rgba(255,255,255,0.75)', align: 'center', titleSize: '2xl', uppercase: true,
          ctaText: 'EXPLORER', ctaUrl: '/products', ctaBg: '$primary', ctaColor: '#ffffff', ctaRadius: 999,
          secondaryText: 'Voir les promotions', secondaryUrl: '/products', secondaryStyle: 'outline', secondaryColor: '#ffffff',
          paddingTop: 8, paddingBottom: 8, marginBottom: 0,
        }),
      ], { background: 'linear-gradient(180deg,#0b1224 0%,#060910 60%,#0a0f1e 100%)', paddingTop: 96, paddingBottom: 80, maxWidth: 1100 }, 'Hero titre géant'),
  },

  {
    id: 'hero-split-photo-two-buttons',
    name: 'Hero Photo à Droite, Deux Boutons',
    category: 'hero',
    categoryLabel: 'Accroches & Hero',
    description: 'Titre serif à gauche, photo produit à droite (ajoutez la vôtre), bouton plein et bouton contour (style Matcha / Jasmine).',
    badge: 'Maquette',
    build: (p = 'sec') =>
      section(uid(p, 'hero_split'), [
        row(uid(p, 'r'), [7, 5], [
          block(uid(p, 'h'), 'hero', {
            kicker: 'RÉCOLTE DE PRINTEMPS', kickerStyle: 'plain', kickerColor: '$primary',
            title: 'Choisissez votre produit', subtitle: 'Sélectionné avec soin, livré sous 48h, payé à la réception.',
            bgColor: 'transparent', titleColor: '$text', subtitleColor: '$muted', align: 'left', titleSize: '2xl', titleFont: 'serif', maxWidth: 620,
            ctaText: 'COMMANDER', ctaUrl: '/products', ctaBg: '$primary', ctaColor: '#ffffff', ctaRadius: 6,
            secondaryText: 'Explorer la gamme', secondaryUrl: '/products', secondaryStyle: 'outline',
            paddingTop: 8, paddingBottom: 8, marginBottom: 0,
          }),
          block(uid(p, 'img'), 'image', { url: '', alt: 'Photo du produit', width: 100, maxHeight: 560 }),
        ], 32),
      ], { background: '$bg', paddingTop: 72, paddingBottom: 64, maxWidth: 1280 }, 'Hero photo à droite'),
  },

  {
    id: 'hero-floating-product-card',
    name: 'Hero avec Carte Produit Flottante',
    category: 'hero',
    categoryLabel: 'Accroches & Hero',
    description: 'Titre condensé en capitales à gauche, carte produit à droite avec caractéristiques, prix et « Ajouter au panier » (style GROW+).',
    badge: 'Maquette',
    build: (p = 'sec') =>
      section(uid(p, 'hero_prod'), [
        row(uid(p, 'r'), [7, 5], [
          block(uid(p, 'h'), 'hero', {
            kicker: 'DROP #24 · ÉDITION LIMITÉE', kickerStyle: 'pill', kickerColor: '$primary',
            title: 'Maximisez votre performance', highlight: 'performance', highlightColor: '$primary',
            subtitle: 'Vitesse, style et innovation pour l’athlète moderne. Authentique, livré en 24h.',
            bgColor: 'transparent', titleColor: '#fafafa', subtitleColor: '#a1a1aa', align: 'left', titleSize: '2xl', uppercase: true, maxWidth: 620,
            ctaText: 'VOIR LES NOUVEAUTÉS', ctaUrl: '/products', ctaBg: '$primary', ctaColor: '#ffffff', ctaRadius: 6,
            paddingTop: 8, paddingBottom: 8, marginBottom: 0,
          }),
          block(uid(p, 'ic'), 'info_card', {
            badge: 'Drop de la semaine', badgeColor: '$primary', title: '« Runner Pro » Néon', subtitle: 'Orange néon / Noir / Blanc',
            rows: [{ label: 'Tige', value: 'Mesh Dynamic Fit' }, { label: 'Semelle', value: 'MaxCushion' }, { label: 'Tailles', value: '39 → 46' }],
            figure: '1 450 DH', figureCaption: 'payé à la livraison', figureColor: '$primary',
            ctaText: 'AJOUTER AU PANIER', ctaUrl: '/products', ctaBg: '$primary', ctaColor: '#ffffff',
            style: 'solid', bgColor: '#ffffff', textColor: '#0f172a', mutedColor: '#475569', borderColor: '#e5e7eb', radius: 16, maxWidth: 380, align: 'right',
          }),
        ], 32),
      ], { background: 'linear-gradient(135deg,#09090b 0%,#1c1917 58%,#431407 100%)', paddingTop: 80, paddingBottom: 80, maxWidth: 1280 }, 'Hero carte produit'),
  },

  {
    id: 'trust-data-cards-row',
    name: 'Trois Cartes Chiffrées (Données en Direct)',
    category: 'trust',
    categoryLabel: 'Garanties & Confiance',
    description: 'Trois cartes en verre côte à côte : stock en direct, garantie, commande en 30 secondes — avec lignes de valeurs et boutons (style Nexus Trade).',
    badge: 'Maquette',
    build: (p = 'sec') =>
      section(uid(p, 'data_cards'), [
        row(uid(p, 'r'), [4, 4, 4], [
          block(uid(p, 'c1'), 'info_card', { badge: 'Stock en direct', title: 'Ce que vous voyez est en stock', subtitle: '', rows: [{ label: 'Casablanca', value: 'expédié le jour même' }, { label: 'Autres villes', value: '24 à 48h' }], progressLabel: '', progressPct: -1, ctaText: '', style: 'glass', align: 'center', maxWidth: 420, bgColor: 'rgba(255,255,255,0.9)', textColor: '#0f172a', mutedColor: '#475569', borderColor: 'rgba(0,0,0,0.06)' }),
          block(uid(p, 'c2'), 'info_card', { badge: 'Garantie', title: '12 mois, pièces incluses', subtitle: '', rows: [{ label: 'Défaut', value: 'échange' }, { label: 'Transport', value: 'offert' }], progressLabel: 'Satisfaction', progressValue: '4.9 / 5', progressPct: 96, progressColor: '$primary', ctaText: '', style: 'glass', align: 'center', maxWidth: 420, bgColor: 'rgba(255,255,255,0.9)', textColor: '#0f172a', mutedColor: '#475569', borderColor: 'rgba(0,0,0,0.06)' }),
          block(uid(p, 'c3'), 'info_card', { badge: 'Commander', title: 'En 30 secondes', subtitle: 'Nom, téléphone, ville. Vous payez à la réception.', rows: [], progressLabel: '', progressPct: -1, ctaText: 'COMMANDER', ctaUrl: '/products', ctaBg: '$primary', ctaColor: '#ffffff', style: 'glass', align: 'center', maxWidth: 420, bgColor: 'rgba(255,255,255,0.9)', textColor: '#0f172a', mutedColor: '#475569', borderColor: 'rgba(0,0,0,0.06)' }),
        ], 20),
      ], { background: '$bg', paddingTop: 24, paddingBottom: 40, maxWidth: 1200 }, 'Cartes chiffrées'),
  },

  {
    id: 'trust-stats-icons-row',
    name: 'Chiffres Clés avec Icônes',
    category: 'trust',
    categoryLabel: 'Garanties & Confiance',
    description: 'Trois grands chiffres avec une icône et une légende, sur une bande de couleur (style EcoFuture).',
    build: (p = 'sec') =>
      section(uid(p, 'stats_ic'), [
        row(uid(p, 'r'), [4, 4, 4], [
          block(uid(p, 's1'), 'hero', { kicker: '📦', kickerStyle: 'plain', title: '+12 000', subtitle: 'commandes livrées', bgColor: 'transparent', titleColor: '#ffffff', subtitleColor: 'rgba(255,255,255,0.8)', titleSize: 'xl', paddingTop: 8, paddingBottom: 8, marginBottom: 0 }),
          block(uid(p, 's2'), 'hero', { kicker: '⚡', kickerStyle: 'plain', title: '24h', subtitle: 'délai moyen d’expédition', bgColor: 'transparent', titleColor: '#ffffff', subtitleColor: 'rgba(255,255,255,0.8)', titleSize: 'xl', paddingTop: 8, paddingBottom: 8, marginBottom: 0 }),
          block(uid(p, 's3'), 'hero', { kicker: '⭐', kickerStyle: 'plain', title: '4.9 / 5', subtitle: 'note moyenne de nos clients', bgColor: 'transparent', titleColor: '#ffffff', subtitleColor: 'rgba(255,255,255,0.8)', titleSize: 'xl', paddingTop: 8, paddingBottom: 8, marginBottom: 0 }),
        ], 16),
      ], { background: '$primary', paddingTop: 32, paddingBottom: 32, maxWidth: 1200 }, 'Chiffres avec icônes'),
  },

  {
    id: 'features-checklist-two-columns',
    name: 'Points Forts avec Coches (2 colonnes)',
    category: 'features',
    categoryLabel: 'Avantages & Listes',
    description: 'Titre, paragraphe et six points forts cochés sur deux colonnes, avec un bouton (style « Design innovation »).',
    badge: 'Maquette',
    build: (p = 'sec') =>
      section(uid(p, 'feat_list'), [
        block(uid(p, 'fl'), 'feature_list', {
          kicker: 'POURQUOI NOUS', title: 'Conçu pour durer, pensé pour vous',
          text: 'Chaque produit du catalogue passe par nos mains avant d’être proposé. Voici ce que cela change pour vous.',
          items: [
            { title: 'Matières sélectionnées', text: 'Testées, comparées, retenues pour leur tenue.' },
            { title: 'Livraison 24/48h', text: 'Partout au Maroc, suivi par WhatsApp.' },
            { title: 'Paiement à la réception', text: 'Vous payez le livreur, en espèces.' },
            { title: 'Échange sous 7 jours', text: 'Un article abîmé est repris sans frais.' },
            { title: 'Support 7j/7', text: 'Une vraie personne répond à vos questions.' },
            { title: 'Prix justes', text: 'Le prix affiché est le prix payé.' },
          ],
          columns: 2, marker: 'check', align: 'left', titleSize: 'lg', titleColor: '$text', textColor: '$muted', markerColor: '$primary',
          ctaText: 'VOIR LES PRODUITS', ctaUrl: '/products', ctaBg: '$primary', ctaColor: '#ffffff',
        }),
      ], { background: '$bg', paddingTop: 48, paddingBottom: 56, maxWidth: 1100 }, 'Points forts'),
  },

  {
    id: 'features-list-beside-photo',
    name: 'Liste d’Avantages à Côté d’une Photo',
    category: 'features',
    categoryLabel: 'Avantages & Listes',
    description: 'Une photo à gauche (ajoutez la vôtre), un titre et des points numérotés à droite.',
    build: (p = 'sec') =>
      section(uid(p, 'feat_img'), [
        row(uid(p, 'r'), [6, 6], [
          block(uid(p, 'img'), 'image', { url: '', alt: 'Photo', width: 100, maxHeight: 520 }),
          block(uid(p, 'fl'), 'feature_list', {
            kicker: 'INNOVATION', title: 'Ce qui rend nos produits différents',
            text: 'Des matériaux qui tiennent, des finitions soignées, un service qui suit.',
            items: [
              { title: 'Matériaux résistants', text: 'Choisis pour tenir des années, pas une saison.' },
              { title: 'Finitions contrôlées', text: 'Chaque pièce est vérifiée avant l’expédition.' },
              { title: 'Service après-vente', text: 'Un échange sous 7 jours, sans discussion.' },
            ],
            columns: 1, marker: 'number', align: 'left', titleSize: 'lg', titleColor: '$text', textColor: '$muted', markerColor: '$primary',
          }),
        ], 40),
      ], { background: '$bg', paddingTop: 48, paddingBottom: 56, maxWidth: 1200 }, 'Avantages + photo'),
  },

  {
    id: 'social-proof-quote-band',
    name: 'Grande Citation Client sur Bande Colorée',
    category: 'social_proof',
    categoryLabel: 'Avis & Preuve Sociale',
    description: 'Un seul avis, en grand : étoiles, phrase, prénom et ville, sur la couleur secondaire (style Matcha Harvest).',
    badge: 'Maquette',
    build: (p = 'sec') =>
      section(uid(p, 'quote_band'), [
        block(uid(p, 'q'), 'quote', {
          kicker: 'Ils en parlent', text: 'Absolument délicieux ! Livré en deux jours, emballé avec soin. Je recommande les yeux fermés.', author: 'Imane L.', role: 'Casablanca', stars: 5,
          align: 'center', size: 'xl', serif: true, textColor: '#ffffff', mutedColor: 'rgba(255,255,255,0.75)', starColor: '#fde68a', maxWidth: 860,
        }),
      ], { background: '$secondary', paddingTop: 56, paddingBottom: 56, maxWidth: 1200 }, 'Grande citation'),
  },

  {
    id: 'social-proof-quote-portrait',
    name: 'Citation avec Portrait du Client',
    category: 'social_proof',
    categoryLabel: 'Avis & Preuve Sociale',
    description: 'Une citation alignée à gauche avec le portrait du client (ajoutez la photo) et ses étoiles.',
    build: (p = 'sec') =>
      section(uid(p, 'quote_port'), [
        block(uid(p, 'q'), 'quote', {
          kicker: 'Avis vérifié', text: 'Commandé un mardi soir, reçu le mercredi midi. Produit conforme, emballage soigné.', author: 'Yassine B.', role: 'Rabat · Client depuis 2024', stars: 5, avatarUrl: '',
          align: 'left', size: 'lg', serif: false, textColor: '$text', mutedColor: '$muted', starColor: '#f59e0b', maxWidth: 760,
        }),
      ], { background: '$bg', paddingTop: 40, paddingBottom: 40, maxWidth: 1000 }, 'Citation portrait'),
  },

  {
    id: 'product-category-chips',
    name: 'Pastilles de Catégories Cliquables',
    category: 'product',
    categoryLabel: 'Produits & Catalogue',
    description: 'Une rangée de pastilles (Nouveautés, Best-sellers, Promos, Coffrets) qui mènent au catalogue (style Flow Bank).',
    build: (p = 'sec') =>
      section(uid(p, 'chips_cat'), [
        block(uid(p, 't'), 'text', { text: 'Explorer par univers', isHeading: true, align: 'center', color: '$text', paddingTop: 0, paddingBottom: 4 }),
        block(uid(p, 'ch'), 'chips', {
          items: [{ label: 'Nouveautés', url: '/products' }, { label: 'Best-sellers', url: '/products' }, { label: 'Promotions', url: '/products' }, { label: 'Coffrets cadeaux', url: '/products' }, { label: 'Accessoires', url: '/products' }],
          style: 'outline', align: 'center', size: 'md', textColor: '$text', borderColor: '$primary',
        }),
      ], { background: '$bg', paddingTop: 24, paddingBottom: 24, maxWidth: 1000 }, 'Pastilles catégories'),
  },

  {
    id: 'story-social-links-row',
    name: 'Rangée Réseaux Sociaux (texte)',
    category: 'story',
    categoryLabel: 'Histoire & Marque',
    description: '« Social · Instagram · TikTok · YouTube », en texte discret, comme au bas d’un hero éditorial (style Nixtio).',
    build: (p = 'sec') =>
      section(uid(p, 'social_row'), [
        block(uid(p, 'ch'), 'chips', {
          prefix: 'Social', items: [{ label: 'Instagram', url: '' }, { label: 'TikTok', url: '' }, { label: 'Facebook', url: '' }, { label: 'YouTube', url: '' }],
          style: 'text', align: 'left', size: 'md', textColor: '$text',
        }),
      ], { background: '$bg', paddingTop: 8, paddingBottom: 16, maxWidth: 1280 }, 'Réseaux sociaux'),
  },

  {
    id: 'gallery-mosaic-four',
    name: 'Galerie Mosaïque « Styles Vedettes »',
    category: 'gallery',
    categoryLabel: 'Galeries & Photos',
    description: 'Titre, puis une mosaïque de photos (une grande, des petites). Ajoutez vos photos : la grille s’adapte (style GROW+).',
    badge: 'Maquette',
    build: (p = 'sec') =>
      section(uid(p, 'gallery'), [
        block(uid(p, 't'), 'text', { text: 'Styles vedettes', isHeading: true, align: 'left', color: '$text', paddingTop: 0, paddingBottom: 8 }),
        block(uid(p, 'g'), 'gallery', {
          images: [
            { url: '', alt: 'Look 1', span: 1, rows: 2 },
            { url: '', alt: 'Look 2' },
            { url: '', alt: 'Look 3' },
            { url: '', alt: 'Look 4', span: 2 },
            { url: '', alt: 'Look 5' },
          ],
          columns: 4, gap: 12, radius: 16, rowHeight: 220, hover: 'zoom',
        }),
      ], { background: '$bg', paddingTop: 40, paddingBottom: 48, maxWidth: 1200 }, 'Galerie mosaïque'),
  },
];

export function getSectionsByCategory(cat?: SectionCategory | 'all'): SectionDefinition[] {
  if (!cat || cat === 'all') return SECTIONS_CATALOG;
  return SECTIONS_CATALOG.filter((s) => s.category === cat);
}

export function findSection(id: string): SectionDefinition | undefined {
  return SECTIONS_CATALOG.find((s) => s.id === id);
}

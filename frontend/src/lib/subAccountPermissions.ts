/**
 * What a vendor can hand to one of its sub-accounts.
 *
 * This is the single description of the grants: the management screen renders
 * from it, the sidebar filters from it, and individual buttons ask `subCan()`.
 * It mirrors `SUB_ACCOUNT_PERMISSIONS` in
 * backend/src/lib/vendorSubAccount.ts — that file is what actually enforces
 * them, this one only decides what to show. Adding a permission means touching
 * both, plus the Prisma schema.
 */

export type SubPermission =
  | 'subCanViewDashboard'
  | 'subCanViewLeads'
  | 'subCanCreateLeads'
  | 'subCanEditLeads'
  | 'subCanDeleteLeads'
  | 'subCanPushToCallCenter'
  | 'subCanRespondPriceRequests'
  | 'subCanImportIntegrationLeads'
  | 'subCanViewInventory'
  | 'subCanClaimProducts'
  | 'subCanEditProducts'
  | 'subCanRequestCustomProduct'
  | 'subCanManageLinks'
  | 'subCanCreateLinks'
  | 'subCanUseLinkBuilder'
  | 'subCanRegenerateLinks'
  | 'subCanViewMarketplace'
  | 'subCanViewWallet'
  | 'subCanViewTransactions'
  | 'subCanViewPayouts'
  | 'subCanViewCommissions'
  | 'subCanViewInvoices'
  | 'subCanDownloadInvoices'
  | 'subCanViewIntegrations'
  | 'subCanViewPixels'
  | 'subCanManagePixels'
  | 'subCanManageDomains'
  | 'subCanRefreshDomain'
  | 'subCanManageSupport'
  | 'subCanCreateTickets'
  | 'subCanUseChat'
  | 'subCanSendMessages'
  | 'subCanManageConversations';

export interface PermissionItem {
  key: SubPermission;
  label: string;
  hint: string;
  /** Rendered indented, and auto-cleared when its parent is switched off. */
  requires?: SubPermission;
  /** Flagged in the UI: destructive, spends money, or the customer sees it. */
  sensitive?: boolean;
}

export const SUB_PERMISSION_GROUPS: { group: string; items: PermissionItem[] }[] = [
  {
    group: 'Tableau de bord',
    items: [
      { key: 'subCanViewDashboard', label: "Vue d'ensemble", hint: 'Statistiques, chiffre d\'affaires et graphiques' },
    ],
  },
  {
    group: 'Commandes & Leads',
    items: [
      { key: 'subCanViewLeads', label: 'Voir les commandes', hint: 'Consulter la liste et le détail des leads' },
      { key: 'subCanCreateLeads', label: 'Créer des commandes', hint: 'Saisie manuelle et import de fichier', requires: 'subCanViewLeads' },
      { key: 'subCanEditLeads', label: 'Modifier les commandes', hint: 'Changer les statuts et les informations client', requires: 'subCanViewLeads' },
      { key: 'subCanDeleteLeads', label: 'Supprimer des commandes', hint: 'Suppression simple et en masse — irréversible', requires: 'subCanViewLeads', sensitive: true },
      { key: 'subCanPushToCallCenter', label: 'Envoyer au call center / livraison', hint: 'Déclenche la confirmation et l\'expédition réelle', requires: 'subCanViewLeads', sensitive: true },
      { key: 'subCanRespondPriceRequests', label: 'Répondre aux demandes de prix', hint: 'Fixe le montant que le client va payer', requires: 'subCanViewLeads', sensitive: true },
    ],
  },
  {
    group: 'Catalogue & Produits',
    items: [
      { key: 'subCanViewInventory', label: 'Produits & inventaire', hint: 'Consulter le catalogue et vos produits' },
      { key: 'subCanClaimProducts', label: 'Ajouter des produits', hint: 'Demander un produit pour le vendre', requires: 'subCanViewInventory' },
      { key: 'subCanEditProducts', label: 'Modifier les produits', hint: 'Fiches et branding vus par le client', requires: 'subCanViewInventory', sensitive: true },
      { key: 'subCanRequestCustomProduct', label: 'Demander un produit sur mesure', hint: 'Envoyer une demande de produit personnalisé', requires: 'subCanViewInventory' },
      { key: 'subCanViewMarketplace', label: 'Marché public', hint: 'Afficher le marketplace dans le menu (catalogue déjà public)' },
    ],
  },
  {
    group: 'Liens de vente',
    items: [
      { key: 'subCanManageLinks', label: 'Voir et gérer les liens', hint: 'Liste des liens, activer / désactiver, statistiques' },
      { key: 'subCanCreateLinks', label: 'Créer des liens', hint: 'Générer de nouveaux liens de vente', requires: 'subCanManageLinks' },
      { key: 'subCanUseLinkBuilder', label: 'Builder de landing page', hint: 'Ouvrir et modifier la page de vente du lien', requires: 'subCanManageLinks' },
      { key: 'subCanRegenerateLinks', label: 'Régénérer un code de lien', hint: 'Casse tous les liens déjà partagés', requires: 'subCanManageLinks', sensitive: true },
    ],
  },
  {
    group: 'Intégrations',
    items: [
      { key: 'subCanViewIntegrations', label: 'Voir les commandes importées', hint: 'YouCan, Shopify, WooCommerce, Google Sheets. La connexion reste bloquée.' },
      { key: 'subCanImportIntegrationLeads', label: 'Importer en commandes', hint: 'Transformer les commandes importées en leads', requires: 'subCanViewIntegrations' },
    ],
  },
  {
    group: 'Finance',
    items: [
      { key: 'subCanViewWallet', label: 'Portefeuille — solde', hint: 'Voir le solde disponible du compte' },
      { key: 'subCanViewTransactions', label: 'Historique des transactions', hint: 'Le détail des entrées et sorties', requires: 'subCanViewWallet' },
      { key: 'subCanViewPayouts', label: 'Historique des retraits', hint: 'Suivre les demandes de retrait et leur statut. En demander un reste impossible.' },
      { key: 'subCanViewCommissions', label: 'Commissions par lien', hint: 'Le détail des gains lien par lien' },
      { key: 'subCanViewInvoices', label: 'Factures — liste', hint: 'Voir la liste et les totaux' },
      { key: 'subCanDownloadInvoices', label: 'Ouvrir / télécharger une facture', hint: 'Accéder au document complet', requires: 'subCanViewInvoices' },
    ],
  },
  {
    group: 'Outils',
    items: [
      { key: 'subCanViewPixels', label: 'Pixels — consulter', hint: 'Voir les pixels Meta, Google, TikTok et Snapchat' },
      { key: 'subCanManagePixels', label: 'Pixels — ajouter / supprimer', hint: 'Change le tracking actif sur la boutique en ligne', requires: 'subCanViewPixels', sensitive: true },
      { key: 'subCanManageDomains', label: 'Domaines (lecture)', hint: 'Voir le domaine. Connexion et suppression bloquées.' },
      { key: 'subCanRefreshDomain', label: 'Revérifier le domaine', hint: 'Relancer la vérification DNS', requires: 'subCanManageDomains' },
      { key: 'subCanManageSupport', label: 'Support — consulter', hint: 'Lire les tickets et leur suivi' },
      { key: 'subCanCreateTickets', label: 'Ouvrir un ticket', hint: 'Écrit au support en votre nom', requires: 'subCanManageSupport' },
      { key: 'subCanUseChat', label: 'Messages — lire', hint: 'Consulter la messagerie interne' },
      { key: 'subCanSendMessages', label: 'Envoyer des messages', hint: 'Les messages partent sous votre nom', requires: 'subCanUseChat', sensitive: true },
      { key: 'subCanManageConversations', label: 'Gérer les conversations', hint: 'Prendre en charge, fermer ou rouvrir un fil', requires: 'subCanUseChat' },
    ],
  },
];

export const ALL_SUB_PERMISSIONS: SubPermission[] = SUB_PERMISSION_GROUPS.flatMap((g) =>
  g.items.map((i) => i.key),
);

/** Permissions that depend on `key`, so switching it off can clear them too. */
export const dependentsOf = (key: SubPermission): SubPermission[] =>
  SUB_PERMISSION_GROUPS.flatMap((g) => g.items)
    .filter((i) => i.requires === key)
    .map((i) => i.key);

/**
 * Which grant each page of the sub-account dashboard needs, keyed by the path
 * after the mount prefix. Used both to filter the sidebar and to guard the
 * route itself — hiding a link is not the same as blocking the URL, and a
 * helper who types one should get a clean refusal rather than a shell of a page
 * firing requests the API will reject.
 *
 * `null` means the page needs no particular grant.
 */
const PAGE_PERMISSIONS: Record<string, SubPermission | null> = {
  '/': 'subCanViewDashboard',
  '/leads': 'subCanViewLeads',
  '/leads/new': 'subCanCreateLeads',
  '/inventory': 'subCanViewInventory',
  '/products': 'subCanViewInventory',
  '/links': 'subCanManageLinks',
  '/wallet': 'subCanViewWallet',
  '/invoices': 'subCanViewInvoices',
  '/integrations': 'subCanViewIntegrations',
  '/youcan-leads': 'subCanViewIntegrations',
  '/shopify-leads': 'subCanViewIntegrations',
  '/woocommerce-leads': 'subCanViewIntegrations',
  '/google-sheets-leads': 'subCanViewIntegrations',
  '/marketplace': 'subCanViewMarketplace',
  '/support': 'subCanManageSupport',
  '/chat': 'subCanUseChat',
  '/domains': 'subCanManageDomains',
  // Reachable to everyone: the account's own settings and its notifications.
  '/settings': null,
  '/notifications': null,
};

/** The grant a page needs, or null when it needs none. */
export const requiredPermissionForPage = (page: string): SubPermission | null => {
  const clean = (page.split('?')[0] || '/') || '/';
  if (clean.startsWith('/pixels')) return 'subCanViewPixels';
  // Product detail rides along with the catalogue.
  if (clean.startsWith('/product/')) return 'subCanViewInventory';
  if (clean.startsWith('/links/')) return 'subCanUseLinkBuilder';
  return PAGE_PERMISSIONS[clean] ?? null;
};

/**
 * Whether the signed-in user may do `key`.
 *
 * Only vendor sub-accounts are limited — for a vendor, an admin or anyone else
 * this is always true, so call sites can ask without branching on role first.
 */
export const subCan = (user: any, key: SubPermission): boolean => {
  if (!user) return false;
  if (user.role !== 'VENDOR_HELPER') return true;
  return !!user[key];
};

/**
 * The account id this session's DATA belongs to.
 *
 * For a vendor sub-account the backend serves every data route as the parent
 * vendor, so anything that comes back — conversation participants, message
 * senders, ownerId — carries the VENDOR's id, not the helper's. Comparing those
 * against `user.id` silently answers "no" for a helper: its own messages render
 * as the other party's, its own sends raise its own unread badge. Use this
 * instead of `user.id` whenever the value is being matched against something
 * the API returned.
 *
 * Identical to `user.id` for everyone who is not a sub-account.
 */
export const accountIdOf = (user: any): number | undefined => user?.vendorId ?? user?.id;

/** Sub-accounts put in read-only mode may look at everything but change nothing. */
export const isReadOnlySubAccount = (user: any): boolean =>
  user?.role === 'VENDOR_HELPER' && !!user.subReadOnly;

/**
 * Who gets the "open the landing-page builder" button. Shared by the links,
 * inventory and marketplace screens so the rule can't drift between them.
 */
export const canUseLinkBuilder = (user: any): boolean => {
  const role = user?.roleName || user?.role;
  if (role === 'SUPER_ADMIN' || role === 'HELPER' || role === 'VENDOR') return true;
  if (role === 'VENDOR_HELPER') return subCan(user, 'subCanUseLinkBuilder');
  if (role === 'INFLUENCER') return !!user?.canManageInfluencerLinks;
  return false;
};

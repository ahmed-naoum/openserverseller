/**
 * VENDOR sub-accounts (role VENDOR_HELPER).
 *
 * A vendor can create helper accounts that log in with their own credentials
 * but do the vendor's work. The helper never owns any data: on every request
 * `authenticate()` swaps the request identity over to the parent vendor, so all
 * the existing `req.user!.roleName === 'VENDOR'` / `vendorId: req.user!.id`
 * scoping in the route files keeps working with no changes.
 *
 * That swap is powerful, so access is *deny by default*. A helper request is
 * only served if it matches a rule below, and each rule names the permission
 * the vendor must have granted. Everything account-level has no rule and is
 * therefore refused — a helper must never be able to take the vendor's account
 * away from them. Deliberately unreachable, whatever is granted:
 *
 *   /auth/change-password, /auth/2fa/*   - would lock the vendor out
 *   /auth/bank-accounts/*, /payouts      - would redirect the vendor's money
 *   /auth/kyc, /auth/sign-contract       - legal acts in the vendor's name
 *   /auth/impersonate                    - privilege escalation
 *   /users/:uuid (PATCH)                 - self-promotion
 *   /google-sheets/status                - hands back the raw webhook token
 *   *token, *save-keys, *disconnect      - integration credentials
 *   /domain/connect|disconnect,
 *   /auth/save-subdomain, /auth/subdomain/*  - would move the storefront
 *   /upload/avatar, /upload/kyc          - would rewrite the vendor's identity
 *
 * This file answers "which screens?". A second, orthogonal limit answers "how
 * much of the catalogue?" — see lib/subAccountProductScope.ts. The two compose:
 * passing the matrix here gets a helper onto the inventory screen, and the scope
 * decides which products that screen then holds. Granting a page here does NOT
 * widen the product scope, and narrowing the scope does not grant a page.
 */

/** Permission flags a vendor can grant to one of its sub-accounts. */
export const SUB_ACCOUNT_PERMISSIONS = [
  // Page-level access.
  'subCanViewDashboard',
  'subCanViewLeads',
  'subCanEditLeads',
  'subCanCreateLeads',
  'subCanViewInventory',
  'subCanManageLinks',
  'subCanViewWallet',
  'subCanViewInvoices',
  'subCanViewIntegrations',
  'subCanViewMarketplace',
  'subCanManageSupport',
  'subCanUseChat',
  'subCanManagePixels',
  'subCanManageDomains',
  // Individual actions carved out of the pages above, because each is
  // destructive, spends money, or changes what the customer sees.
  'subCanDeleteLeads',
  'subCanPushToCallCenter',
  'subCanRespondPriceRequests',
  'subCanImportIntegrationLeads',
  'subCanClaimProducts',
  'subCanEditProducts',
  'subCanRequestCustomProduct',
  'subCanCreateLinks',
  'subCanUseLinkBuilder',
  'subCanRegenerateLinks',
  'subCanViewTransactions',
  'subCanViewPayouts',
  'subCanViewCommissions',
  'subCanDownloadInvoices',
  'subCanViewPixels',
  'subCanCreateTickets',
  'subCanSendMessages',
  'subCanManageConversations',
  'subCanRefreshDomain',
] as const;

export type SubAccountPermission = (typeof SUB_ACCOUNT_PERMISSIONS)[number];

/** The flags we need off a sub-account row to make a decision. */
export interface SubAccountFlags extends Partial<Record<SubAccountPermission, boolean>> {
  subAllowedModes?: string;
  /** Look but don't touch: refuses every write against the vendor's data. */
  subReadOnly?: boolean;
  /** Access ends at this moment. Null/undefined means it never does. */
  subAccessExpiresAt?: Date | string | null;
}

export type SubAccountScope =
  /** Serve the request as the parent vendor: identity, role and ownership all swap. */
  | 'vendor'
  /**
   * Keep the helper's own row as the subject (its own mode, its own settings)
   * but present role VENDOR so `authorize('VENDOR')` lets it through.
   */
  | 'self-as-vendor'
  /** Keep everything as the helper: its own id and its real VENDOR_HELPER role. */
  | 'self';

interface AccessRule {
  methods: string[] | '*';
  /** Matched against the path with the /api/v1 prefix and query string removed. */
  test: RegExp;
  /** Permission the vendor must have granted. null = always available. */
  perm: SubAccountPermission | null;
  scope: SubAccountScope;
  /** Any one of these is enough. Used for endpoints shared by several pages. */
  anyPerm?: SubAccountPermission[];
}

const ALL = '*' as const;
const READ = ['GET', 'HEAD'];

/**
 * Ordered — first match wins. Narrow rules must come before the broad rule for
 * the same resource, and reads before writes, so a view-only grant can never
 * fall through onto a write rule.
 */
const ACCESS_RULES: AccessRule[] = [
  // ================================================================= session
  // Must stay 'self': if /auth/me answered with the vendor's row the frontend
  // would render the vendor's own dashboard with none of the helper's limits.
  { methods: READ, test: /^\/auth\/me$/, perm: null, scope: 'self' },
  { methods: ['POST'], test: /^\/auth\/(logout|refresh)$/, perm: null, scope: 'self' },
  // The helper's own account. Every one of these handlers keys off
  // `req.user!.id`, or self-guards on the uuid, so under scope 'self' they can
  // only ever touch the helper's own row — the vendor's password, 2FA and
  // profile stay out of reach. A helper that could not change its own password
  // would have no way to secure the credentials its vendor handed it.
  { methods: ['PUT', 'PATCH'], test: /^\/user\/settings$/, perm: null, scope: 'self' },
  { methods: ['PATCH', 'PUT'], test: /^\/user\/language$/, perm: null, scope: 'self' },
  { methods: ['POST'], test: /^\/auth\/change-password$/, perm: null, scope: 'self' },
  { methods: ['POST'], test: /^\/auth\/2fa\/(setup|verify|disable)$/, perm: null, scope: 'self' },
  { methods: ['PATCH'], test: /^\/users\/[0-9a-f-]{36}$/i, perm: null, scope: 'self' },
  { methods: ['POST'], test: /^\/upload\/avatar$/, perm: null, scope: 'self' },

  // Platform-wide reads every page depends on.
  { methods: READ, test: /^\/settings\/maintenance$/, perm: null, scope: 'self' },
  { methods: READ, test: /^\/public(\/|$)/, perm: null, scope: 'self' },
  { methods: READ, test: /^\/categories$/, perm: null, scope: 'vendor' },
  { methods: READ, test: /^\/announcements(\/|$)/, perm: null, scope: 'vendor' },

  // The vendor's notification inbox. Reading and marking as read need no grant
  // because the app shell polls them on every page, but deleting does not fall
  // out of that: DELETE /notifications wipes the vendor's whole history, and a
  // helper holding nothing at all should not be able to reach it.
  { methods: READ, test: /^\/notifications(\/|$)/, perm: null, scope: 'vendor' },
  { methods: ['PATCH'], test: /^\/notifications\/\d+\/read$/, perm: null, scope: 'vendor' },
  { methods: ['POST'], test: /^\/notifications\/read-all$/, perm: null, scope: 'vendor' },

  // ==================================================================== mode
  // Affilié / Vendeur switching. 'self-as-vendor' so the toggle rewrites the
  // helper's own mode column and never the vendor's. Which modes are permitted
  // is enforced separately, in the route handler.
  {
    methods: ['PATCH', 'POST'],
    test: /^\/dashboard\/seller-affiliate\/switch-mode$/,
    perm: null,
    scope: 'self-as-vendor',
  },

  // =============================================================== dashboard
  { methods: READ, test: /^\/dashboard\/seller-affiliate$/, perm: 'subCanViewDashboard', scope: 'vendor' },
  // The links screen charts per-link performance from /influencer/analytics, so
  // this is reachable from either grant — gating it on the dashboard alone left
  // "Liens de vente" unable to draw its own page.
  {
    methods: READ,
    test: /^\/influencer\/analytics(\/|$)/,
    perm: null,
    anyPerm: ['subCanViewDashboard', 'subCanManageLinks'],
    scope: 'vendor',
  },
  { methods: READ, test: /^\/influencer\/profile(\/|$)/, perm: 'subCanViewDashboard', scope: 'vendor' },

  // =================================================================== leads
  // Reference data the lead screens read before they can show anything.
  { methods: ['GET', 'HEAD', 'POST'], test: /^\/leads\/coliaty\//, perm: 'subCanViewLeads', scope: 'vendor' },
  // The product picker. The integration screens need it to map an imported
  // order onto one of the vendor's products, so it is reachable from either
  // grant — without this, "importer en commandes" has an empty dropdown.
  {
    methods: READ,
    test: /^\/leads\/(my-products|vendors|products-by-vendor\/\d+)$/,
    perm: null,
    anyPerm: ['subCanViewLeads', 'subCanViewIntegrations', 'subCanCreateLeads'],
    scope: 'vendor',
  },
  { methods: READ, test: /^\/leads\/history-by-phone\//, perm: 'subCanViewLeads', scope: 'vendor' },
  // The negative lookahead keeps the call-centre queues out. Those four scope by
  // *agent assignment*, not ownership, and a vendor id has no assignments — one
  // of them then falls open and lists other vendors' leads.
  {
    methods: READ,
    test: /^\/leads(?!\/(available|abandoned-carts|assigned-all|livraison))(\/|$)/,
    perm: 'subCanViewLeads',
    scope: 'vendor',
  },
  { methods: READ, test: /^\/influencer\/customers$/, perm: 'subCanViewLeads', scope: 'vendor' },

  // Creating leads (Insert Lead / import).
  { methods: ['POST'], test: /^\/leads$/, perm: 'subCanCreateLeads', scope: 'vendor' },
  { methods: ['POST'], test: /^\/leads\/import$/, perm: 'subCanCreateLeads', scope: 'vendor' },
  // Turning YouCan / Shopify / Woo / Sheets orders into real leads.
  { methods: ['POST'], test: /^\/leads\/push-integration-leads$/, perm: 'subCanImportIntegrationLeads', scope: 'vendor' },

  // --- individual lead actions, each ahead of the general edit rule ---
  // Answering a customer's price-change request sets what they will be charged.
  { methods: ['POST'], test: /^\/leads\/\d+\/respond-price-request$/, perm: 'subCanRespondPriceRequests', scope: 'vendor' },
  // Handing a lead to the call centre or to the courier starts real fulfilment.
  { methods: ['POST'], test: /^\/leads\/\d+\/push-to-delivery$/, perm: 'subCanPushToCallCenter', scope: 'vendor' },
  {
    methods: ['POST'],
    test: /^\/influencer\/leads\/(push-callcenter\/bulk|\d+\/push-callcenter)$/,
    perm: 'subCanPushToCallCenter',
    scope: 'vendor',
  },
  // Deletion is unrecoverable, so it is its own grant.
  { methods: ['DELETE'], test: /^\/leads\/\d+$/, perm: 'subCanDeleteLeads', scope: 'vendor' },
  { methods: ['DELETE'], test: /^\/influencer\/leads\/\d+$/, perm: 'subCanDeleteLeads', scope: 'vendor' },
  { methods: ['POST'], test: /^\/influencer\/leads\/delete\/bulk$/, perm: 'subCanDeleteLeads', scope: 'vendor' },

  // Everything else about an existing lead: statuses, notes, edits.
  { methods: ['PATCH', 'PUT'], test: /^\/leads(\/|$)/, perm: 'subCanEditLeads', scope: 'vendor' },
  { methods: ['POST'], test: /^\/leads\/\d+\//, perm: 'subCanEditLeads', scope: 'vendor' },
  // Reading an order comes with the leads view; changing one needs the edit grant.
  { methods: READ, test: /^\/orders(\/|$)/, perm: 'subCanViewLeads', scope: 'vendor' },
  { methods: ALL, test: /^\/orders(\/|$)/, perm: 'subCanEditLeads', scope: 'vendor' },

  // ======================================================= products / stock
  { methods: READ, test: /^\/products(\/|$)/, perm: 'subCanViewInventory', scope: 'vendor' },
  { methods: READ, test: /^\/inventory(\/|$)/, perm: 'subCanViewInventory', scope: 'vendor' },
  // Reading the approved claims is how BOTH the inventory screen and the links
  // screen learn which products this account may sell — "Créer un lien" lists
  // them. Claiming a *new* product stays an inventory action.
  {
    methods: READ,
    test: /^\/influencer\/claims(\/|$)/,
    perm: null,
    // The marketplace reads this too, to mark which products are already taken.
    anyPerm: ['subCanViewInventory', 'subCanManageLinks', 'subCanViewMarketplace'],
    scope: 'vendor',
  },
  // Adding a product to what this account sells.
  { methods: ['POST', 'DELETE'], test: /^\/influencer\/claims(\/|$)/, perm: 'subCanClaimProducts', scope: 'vendor' },
  { methods: READ, test: /^\/custom-products(\/|$)/, perm: 'subCanViewInventory', scope: 'vendor' },
  { methods: ['POST', 'PATCH', 'PUT'], test: /^\/custom-products(\/|$)/, perm: 'subCanRequestCustomProduct', scope: 'vendor' },
  // Product details and branding are what the customer sees on the page.
  { methods: ['POST', 'PATCH', 'PUT'], test: /^\/products(\/|$)/, perm: 'subCanEditProducts', scope: 'vendor' },

  // =================================================================== links
  // The landing-page builder.
  { methods: ['GET', 'HEAD', 'PUT', 'POST'], test: /^\/influencer\/links\/\d+\/landing-page$/, perm: 'subCanUseLinkBuilder', scope: 'vendor' },
  // Regenerating a code breaks every copy of the old link already in the wild.
  { methods: ['POST'], test: /^\/influencer\/links\/\d+\/(send-regen-otp|verify-regen-otp)$/, perm: 'subCanRegenerateLinks', scope: 'vendor' },
  // Creating a link, and the name check the create form runs as you type.
  { methods: ['POST'], test: /^\/influencer\/links$/, perm: 'subCanCreateLinks', scope: 'vendor' },
  {
    methods: READ,
    test: /^\/influencer\/links\/check-unique$/,
    perm: null,
    anyPerm: ['subCanCreateLinks', 'subCanManageLinks'],
    scope: 'vendor',
  },
  // Listing links, opening one, activating/deactivating it.
  { methods: ALL, test: /^\/influencer\/links(\/|$)/, perm: 'subCanManageLinks', scope: 'vendor' },

  // ================================================================= finance
  // Read-only throughout. There is deliberately no rule for POST /payouts:
  // that endpoint reads the destination RIB out of the request body rather than
  // from the vendor's registered bank account, so a helper able to reach it
  // could move the balance to any account it liked. Withdrawals stay with the
  // account owner, whatever is granted here.
  { methods: READ, test: /^\/wallet\/transactions(\/|$)/, perm: 'subCanViewTransactions', scope: 'vendor' },
  { methods: READ, test: /^\/wallet(\/|$)/, perm: 'subCanViewWallet', scope: 'vendor' },
  // The withdrawal history and its statuses — useful for reconciliation, and
  // safe because creating one is unreachable.
  { methods: READ, test: /^\/payouts(\/|$)/, perm: 'subCanViewPayouts', scope: 'vendor' },
  // Earnings per link.
  { methods: READ, test: /^\/influencer\/commissions(\/|$)/, perm: 'subCanViewCommissions', scope: 'vendor' },
  // A single invoice is the downloadable document; the list and totals are not.
  { methods: READ, test: /^\/invoices\/\d+$/, perm: 'subCanDownloadInvoices', scope: 'vendor' },
  { methods: READ, test: /^\/invoices(\/|$)/, perm: 'subCanViewInvoices', scope: 'vendor' },

  // ============================================================ integrations
  // Connection state and the imported-order lists. Every credential-bearing
  // endpoint (token, save-token, save-keys, connect, disconnect, rotate-token,
  // toggle-sync) is absent, as is /google-sheets/status, which returns the raw
  // webhook token in its body.
  { methods: READ, test: /^\/(youcan|shopify|woocommerce)\/status$/, perm: 'subCanViewIntegrations', scope: 'vendor' },
  { methods: READ, test: /^\/(youcan|shopify|woocommerce|google-sheets)\/(orders|customers)$/, perm: 'subCanViewIntegrations', scope: 'vendor' },
  { methods: ['POST'], test: /^\/(youcan|shopify|woocommerce|google-sheets)\/sync(-now)?$/, perm: 'subCanViewIntegrations', scope: 'vendor' },

  // ============================================================= marketplace
  // Note this grant is a visibility control, not a security boundary: the
  // marketplace screen reads /public/marketplace/*, which serves the same
  // catalogue to signed-out visitors. Withholding it hides the nav entry; it
  // does not hide data the helper could not otherwise see.
  { methods: READ, test: /^\/marketplace(\/|$)/, perm: 'subCanViewMarketplace', scope: 'vendor' },

  // ================================================================= support
  { methods: READ, test: /^\/support(\/|$)/, perm: 'subCanManageSupport', scope: 'vendor' },
  // Opening a ticket speaks to the platform in the vendor's name.
  { methods: ['POST', 'PATCH', 'PUT'], test: /^\/support(\/|$)/, perm: 'subCanCreateTickets', scope: 'vendor' },

  // ==================================================================== chat
  // Taking, closing or reopening a conversation changes who is answering it.
  {
    methods: ['POST'],
    test: /^\/chat\/conversations\/\d+\/(claim|close|open)$/,
    perm: 'subCanManageConversations',
    scope: 'vendor',
  },
  // Sending goes out under the vendor's name, so it is separate from reading.
  { methods: ['POST'], test: /^\/chat\/conversations\/\d+\/messages$/, perm: 'subCanSendMessages', scope: 'vendor' },
  { methods: ['POST'], test: /^\/chat\/conversations(\/auto-open)?$/, perm: 'subCanSendMessages', scope: 'vendor' },
  // Reading, and marking a thread as read.
  { methods: [...READ, 'PATCH'], test: /^\/chat(\/|$)/, perm: 'subCanUseChat', scope: 'vendor' },

  // ================================================================== pixels
  { methods: READ, test: /^\/user-pixels(\/|$)/, perm: 'subCanViewPixels', scope: 'vendor' },
  // Adding or removing a pixel changes what fires on the live storefront.
  { methods: ALL, test: /^\/user-pixels(\/|$)/, perm: 'subCanManagePixels', scope: 'vendor' },

  // ================================================================= domains
  // Look, don't touch. Connecting or disconnecting a domain moves the vendor's
  // storefront, and claiming a subdomain is an identity change, so neither is
  // reachable no matter what the vendor granted.
  { methods: READ, test: /^\/domain(\/|$)/, perm: 'subCanManageDomains', scope: 'vendor' },
  { methods: READ, test: /^\/auth\/check-subdomain$/, perm: 'subCanManageDomains', scope: 'vendor' },
  // Re-checking DNS status is harmless but still a call out to Cloudflare.
  { methods: ['POST'], test: /^\/domain\/refresh$/, perm: 'subCanRefreshDomain', scope: 'vendor' },

  // ================================================================= uploads
  // Content attachments only. /upload/avatar is handled above at scope 'self'
  // (the helper's own picture); /upload/kyc is absent because identity documents
  // are filed in the vendor's name.
  {
    methods: ['POST'],
    test: /^\/upload\/(image|product-images|video|audio)$/,
    perm: null,
    anyPerm: ['subCanViewInventory', 'subCanManageLinks', 'subCanManageSupport', 'subCanUseChat', 'subCanEditLeads', 'subCanCreateLeads'],
    scope: 'vendor',
  },
];

export interface AccessDecision {
  allowed: boolean;
  scope: SubAccountScope;
  /** Present when denied — surfaced to the client so the UI can explain itself. */
  reason?: string;
}

const DENIED_UNKNOWN =
  "Cette action n'est pas disponible pour un sous-compte. Seul le titulaire du compte vendeur peut l'effectuer.";
const DENIED_PERMISSION =
  "Permission refusée : cette section ne vous a pas été accordée par le vendeur.";
const DENIED_READ_ONLY =
  'Ce sous-compte est en lecture seule : aucune modification n\'est autorisée.';
export const DENIED_EXPIRED =
  "L'accès de ce sous-compte a expiré. Contactez le titulaire du compte vendeur.";

/** Strip the API prefix and query string so rules can be written plainly. */
export const normalizeApiPath = (originalUrl: string): string => {
  const path = (originalUrl || '').split('?')[0];
  const stripped = path.replace(/^\/api\/v\d+/, '');
  const withoutTrailing = stripped.replace(/\/+$/, '');
  return withoutTrailing || '/';
};

const methodMatches = (rule: AccessRule, method: string) =>
  rule.methods === ALL || rule.methods.includes(method);

/**
 * Decide whether a VENDOR_HELPER may make this request, and whose identity it
 * should run under. Deny by default.
 */
export const evaluateVendorHelperAccess = (
  originalUrl: string,
  method: string,
  sub: SubAccountFlags,
): AccessDecision => {
  // Express routes case-insensitively by default, so /leads/Abandoned-Carts and
  // /leads/abandoned-carts reach the same handler. Every rule below is written
  // in lower case, so match against a lower-cased path — otherwise a capital
  // letter slips past the negative lookahead that keeps the call-centre queues
  // out and lands on the permissive read rule instead.
  const path = normalizeApiPath(originalUrl).toLowerCase();
  const verb = (method || 'GET').toUpperCase();

  const rule = ACCESS_RULES.find((r) => methodMatches(r, verb) && r.test.test(path));

  if (!rule) return { allowed: false, scope: 'self', reason: DENIED_UNKNOWN };

  if (rule.anyPerm && !rule.anyPerm.some((p) => sub[p])) {
    return { allowed: false, scope: 'self', reason: DENIED_PERMISSION };
  }

  if (rule.perm && !sub[rule.perm]) {
    return { allowed: false, scope: 'self', reason: DENIED_PERMISSION };
  }

  // The read-only switch overrides every grant, but only for the vendor's data:
  // the helper can still sign out, change its own password and switch its own
  // mode, all of which run at 'self' scope.
  if (sub.subReadOnly && rule.scope === 'vendor' && !READ.includes(verb)) {
    return { allowed: false, scope: 'self', reason: DENIED_READ_ONLY };
  }

  return { allowed: true, scope: rule.scope };
};

/**
 * Why this sub-account cannot be used right now, or null if it can.
 *
 * Same three conditions authenticate() enforces, phrased for someone standing
 * at the login screen. Shared so the two can never disagree about what counts
 * as locked out.
 */
export const describeSubAccountLockout = (
  sub: SubAccountFlags & { isActive?: boolean },
  vendor?: { isActive?: boolean; deletedAt?: Date | null } | null,
): string | null => {
  if (!vendor) return "Ce sous-compte n'est rattaché à aucun compte vendeur actif.";
  if (!vendor.isActive || vendor.deletedAt) {
    return "Le compte vendeur rattaché à ce sous-compte n'est plus actif.";
  }
  if (sub.isActive === false) return 'Ce sous-compte a été suspendu par le vendeur.';
  if (isSubAccountExpired(sub)) return DENIED_EXPIRED;
  return null;
};

/** True once a time-limited sub-account has run out. */
export const isSubAccountExpired = (
  sub: Pick<SubAccountFlags, 'subAccessExpiresAt'>,
  now: Date = new Date(),
): boolean => {
  if (!sub.subAccessExpiresAt) return false;
  const expires = new Date(sub.subAccessExpiresAt);
  if (Number.isNaN(expires.getTime())) return false;
  return expires.getTime() <= now.getTime();
};

/**
 * Whether a helper may sit in a given vendor mode.
 * `subAllowedModes` is 'BOTH' | 'SELLER' | 'AFFILIATE'.
 */
export const isModeAllowedForSubAccount = (sub: SubAccountFlags, mode: string): boolean => {
  const allowed = sub.subAllowedModes || 'BOTH';
  if (allowed === 'BOTH') return mode === 'SELLER' || mode === 'AFFILIATE';
  return allowed === mode;
};

/** The mode a helper should land in, given what its vendor permits. */
export const resolveSubAccountMode = (sub: SubAccountFlags, currentMode: string): string => {
  if (isModeAllowedForSubAccount(sub, currentMode)) return currentMode;
  return sub.subAllowedModes === 'AFFILIATE' ? 'AFFILIATE' : 'SELLER';
};

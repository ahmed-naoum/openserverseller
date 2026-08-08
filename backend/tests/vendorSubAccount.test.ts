import { describe, it, expect } from 'vitest';
import {
  evaluateVendorHelperAccess,
  isModeAllowedForSubAccount,
  isSubAccountExpired,
  normalizeApiPath,
  resolveSubAccountMode,
  SUB_ACCOUNT_PERMISSIONS,
  type SubAccountFlags,
} from '../src/lib/vendorSubAccount.js';

/**
 * The access matrix is the security boundary for vendor sub-accounts: a helper
 * runs under its parent vendor's identity, so anything that slips through here
 * acts with the vendor's full authority. These cases pin the boundary down.
 */

/** A helper with every page granted — the most permissive account possible. */
const allGranted: SubAccountFlags = {
  subAllowedModes: 'BOTH',
  ...Object.fromEntries(SUB_ACCOUNT_PERMISSIONS.map((k) => [k, true])),
};

/** A freshly created helper: nothing granted yet. */
const noneGranted: SubAccountFlags = { subAllowedModes: 'BOTH' };

const can = (url: string, method: string, flags: SubAccountFlags = allGranted) =>
  evaluateVendorHelperAccess(url, method, flags);

describe('normalizeApiPath', () => {
  it('strips the api version prefix, the query string and trailing slashes', () => {
    expect(normalizeApiPath('/api/v1/leads?page=2&limit=50')).toBe('/leads');
    expect(normalizeApiPath('/api/v1/leads/')).toBe('/leads');
    expect(normalizeApiPath('/api/v2/wallet/transactions')).toBe('/wallet/transactions');
    expect(normalizeApiPath('/api/v1')).toBe('/');
  });
});

describe('vendor sub-account access matrix', () => {
  it('denies by default — an unknown route is refused even with every grant', () => {
    expect(can('/api/v1/some/new/endpoint', 'GET').allowed).toBe(false);
    expect(can('/api/v1/admin/users', 'GET').allowed).toBe(false);
  });

  describe('account takeover is impossible regardless of grants', () => {
    const forbidden: [string, string][] = [
      ['POST', '/api/v1/auth/bank-accounts/send-otp'],
      ['POST', '/api/v1/auth/bank-accounts/verify-otp'],
      ['DELETE', '/api/v1/auth/bank-accounts/3'],
      // Requesting a withdrawal, never. Reading the history is grantable —
      // see the finance tests below.
      ['POST', '/api/v1/payouts'],
      ['PATCH', '/api/v1/payouts/4/status'],
      ['POST', '/api/v1/auth/impersonate'],
      ['POST', '/api/v1/auth/kyc'],
      ['POST', '/api/v1/auth/sign-contract'],
      ['POST', '/api/v1/auth/save-subdomain'],
      ['POST', '/api/v1/auth/subdomain/send-otp'],
      ['POST', '/api/v1/domain/connect'],
      ['DELETE', '/api/v1/domain/disconnect'],
      ['POST', '/api/v1/youcan/token'],
      ['POST', '/api/v1/youcan/disconnect'],
      ['POST', '/api/v1/shopify/save-token'],
      ['POST', '/api/v1/woocommerce/save-keys'],
      ['POST', '/api/v1/google-sheets/rotate-token'],
      // Hands back the raw webhook token in its response body.
      ['GET', '/api/v1/google-sheets/status'],
      ['POST', '/api/v1/upload/kyc'],
      // A helper must never mint further helpers or widen its own grants.
      ['GET', '/api/v1/vendor/sub-accounts'],
      ['POST', '/api/v1/vendor/sub-accounts'],
      ['PATCH', '/api/v1/vendor/sub-accounts/abc'],
      // Reading the inbox needs no grant, but wiping it is not part of that.
      ['DELETE', '/api/v1/notifications'],
      ['DELETE', '/api/v1/notifications/12'],
    ];

    it.each(forbidden)('%s %s is refused', (method, url) => {
      expect(can(url, method).allowed).toBe(false);
    });
  });

  describe('page grants', () => {
    it('serves a granted page and refuses the same page without the grant', () => {
      expect(can('/api/v1/leads?page=1', 'GET', { subCanViewLeads: true }).allowed).toBe(true);
      expect(can('/api/v1/leads?page=1', 'GET', noneGranted).allowed).toBe(false);

      expect(can('/api/v1/wallet', 'GET', { subCanViewWallet: true }).allowed).toBe(true);
      expect(can('/api/v1/wallet', 'GET', noneGranted).allowed).toBe(false);
    });

    it('separates reading leads from writing them', () => {
      const readOnly: SubAccountFlags = { subCanViewLeads: true };
      expect(can('/api/v1/leads/42', 'GET', readOnly).allowed).toBe(true);
      expect(can('/api/v1/leads/42', 'PATCH', readOnly).allowed).toBe(false);
      expect(can('/api/v1/leads', 'POST', readOnly).allowed).toBe(false);

      expect(can('/api/v1/leads/42', 'PATCH', { subCanEditLeads: true }).allowed).toBe(true);
      expect(can('/api/v1/leads', 'POST', { subCanCreateLeads: true }).allowed).toBe(true);
    });

    it('makes "Liens de vente" self-sufficient — every call the links screen makes', () => {
      // Regression guard: claims and analytics used to sit behind the inventory
      // and dashboard grants, so a helper with only this permission opened the
      // page to "Impossible de charger les produits affiliés" and no charts.
      const linksOnly: SubAccountFlags = { subCanManageLinks: true };
      const calls: [string, string][] = [
        ['GET', '/api/v1/influencer/links'],
        ['GET', '/api/v1/influencer/links/check-unique?name=abc'],
        ['PATCH', '/api/v1/influencer/links/12/status'],
        // The product list the page groups its links under — this pair is the
        // original regression: gating them elsewhere made the page 403 on load.
        ['GET', '/api/v1/influencer/claims'],
        ['GET', '/api/v1/influencer/analytics/daily'],
      ];
      for (const [method, url] of calls) {
        expect({ method, url, allowed: can(url, method, linksOnly).allowed })
          .toEqual({ method, url, allowed: true });
      }
    });

    it('gives the builder everything it needs from its own grant', () => {
      const builder: SubAccountFlags = { subCanManageLinks: true, subCanUseLinkBuilder: true };
      const calls: [string, string][] = [
        ['GET', '/api/v1/influencer/links/12/landing-page'],
        ['PUT', '/api/v1/influencer/links/12/landing-page'],
        ['GET', '/api/v1/public/products-by-accounts'],
        ['POST', '/api/v1/upload/image'],
        ['POST', '/api/v1/upload/video'],
        ['POST', '/api/v1/upload/audio'],
      ];
      for (const [method, url] of calls) {
        expect({ method, url, allowed: can(url, method, builder).allowed })
          .toEqual({ method, url, allowed: true });
      }
    });

    it('does not let the links grant claim new products or read the dashboard', () => {
      const linksOnly: SubAccountFlags = { subCanManageLinks: true };
      expect(can('/api/v1/influencer/claims', 'POST', linksOnly).allowed).toBe(false);
      expect(can('/api/v1/dashboard/seller-affiliate', 'GET', linksOnly).allowed).toBe(false);
      expect(can('/api/v1/influencer/commissions', 'GET', linksOnly).allowed).toBe(false);
    });

    it('carves the destructive lead actions out of plain editing', () => {
      const editOnly: SubAccountFlags = { subCanViewLeads: true, subCanEditLeads: true };
      // Editing works...
      expect(can('/api/v1/leads/42', 'PATCH', editOnly).allowed).toBe(true);
      expect(can('/api/v1/leads/42/status', 'PATCH', editOnly).allowed).toBe(true);
      // ...but the three sharp edges need their own grant.
      expect(can('/api/v1/leads/42', 'DELETE', editOnly).allowed).toBe(false);
      expect(can('/api/v1/influencer/leads/delete/bulk', 'POST', editOnly).allowed).toBe(false);
      expect(can('/api/v1/leads/42/push-to-delivery', 'POST', editOnly).allowed).toBe(false);
      expect(can('/api/v1/influencer/leads/push-callcenter/bulk', 'POST', editOnly).allowed).toBe(false);
      expect(can('/api/v1/leads/42/respond-price-request', 'POST', editOnly).allowed).toBe(false);

      expect(can('/api/v1/leads/42', 'DELETE', { ...editOnly, subCanDeleteLeads: true }).allowed).toBe(true);
      expect(can('/api/v1/leads/42/push-to-delivery', 'POST', { ...editOnly, subCanPushToCallCenter: true }).allowed).toBe(true);
      expect(can('/api/v1/leads/42/respond-price-request', 'POST', { ...editOnly, subCanRespondPriceRequests: true }).allowed).toBe(true);
    });

    it('separates importing integration orders from creating leads by hand', () => {
      const createOnly: SubAccountFlags = { subCanCreateLeads: true };
      expect(can('/api/v1/leads', 'POST', createOnly).allowed).toBe(true);
      expect(can('/api/v1/leads/push-integration-leads', 'POST', createOnly).allowed).toBe(false);
      expect(can('/api/v1/leads/push-integration-leads', 'POST', { subCanImportIntegrationLeads: true }).allowed).toBe(true);
    });

    it('separates browsing the catalogue from changing it', () => {
      const viewOnly: SubAccountFlags = { subCanViewInventory: true };
      expect(can('/api/v1/products', 'GET', viewOnly).allowed).toBe(true);
      expect(can('/api/v1/influencer/claims', 'GET', viewOnly).allowed).toBe(true);
      expect(can('/api/v1/influencer/claims', 'POST', viewOnly).allowed).toBe(false);
      expect(can('/api/v1/products/9/branding', 'PATCH', viewOnly).allowed).toBe(false);
      expect(can('/api/v1/custom-products', 'POST', viewOnly).allowed).toBe(false);

      expect(can('/api/v1/influencer/claims', 'POST', { subCanClaimProducts: true }).allowed).toBe(true);
      expect(can('/api/v1/products/9/branding', 'PATCH', { subCanEditProducts: true }).allowed).toBe(true);
      expect(can('/api/v1/custom-products', 'POST', { subCanRequestCustomProduct: true }).allowed).toBe(true);
    });

    it('splits the link actions: manage, create, build, regenerate', () => {
      const manageOnly: SubAccountFlags = { subCanManageLinks: true };
      expect(can('/api/v1/influencer/links', 'GET', manageOnly).allowed).toBe(true);
      expect(can('/api/v1/influencer/links/7/status', 'PATCH', manageOnly).allowed).toBe(true);
      expect(can('/api/v1/influencer/links', 'POST', manageOnly).allowed).toBe(false);
      expect(can('/api/v1/influencer/links/7/landing-page', 'GET', manageOnly).allowed).toBe(false);
      expect(can('/api/v1/influencer/links/7/send-regen-otp', 'POST', manageOnly).allowed).toBe(false);

      expect(can('/api/v1/influencer/links', 'POST', { subCanCreateLinks: true }).allowed).toBe(true);
      expect(can('/api/v1/influencer/links/7/landing-page', 'GET', { subCanUseLinkBuilder: true }).allowed).toBe(true);
      expect(can('/api/v1/influencer/links/7/landing-page', 'PUT', { subCanUseLinkBuilder: true }).allowed).toBe(true);
      expect(can('/api/v1/influencer/links/7/verify-regen-otp', 'POST', { subCanRegenerateLinks: true }).allowed).toBe(true);
    });

    it('never opens a path to withdrawing money, whatever finance grants exist', () => {
      // POST /payouts takes the destination RIB from the request body, so no
      // combination of grants may reach it.
      const everyFinanceGrant: SubAccountFlags = {
        subCanViewWallet: true,
        subCanViewTransactions: true,
        subCanViewPayouts: true,
        subCanViewCommissions: true,
        subCanViewInvoices: true,
        subCanDownloadInvoices: true,
      };
      expect(can('/api/v1/payouts', 'POST', everyFinanceGrant).allowed).toBe(false);
      expect(can('/api/v1/payouts', 'POST', allGranted).allowed).toBe(false);
      // Reading the history is fine.
      expect(can('/api/v1/payouts', 'GET', everyFinanceGrant).allowed).toBe(true);
      expect(can('/api/v1/payouts', 'GET', { subCanViewWallet: true }).allowed).toBe(false);
    });

    it('splits the finance reads', () => {
      const balanceOnly: SubAccountFlags = { subCanViewWallet: true };
      expect(can('/api/v1/wallet', 'GET', balanceOnly).allowed).toBe(true);
      expect(can('/api/v1/wallet/transactions', 'GET', balanceOnly).allowed).toBe(false);
      expect(can('/api/v1/wallet/transactions', 'GET', { ...balanceOnly, subCanViewTransactions: true }).allowed).toBe(true);

      const listOnly: SubAccountFlags = { subCanViewInvoices: true };
      expect(can('/api/v1/invoices', 'GET', listOnly).allowed).toBe(true);
      expect(can('/api/v1/invoices/stats', 'GET', listOnly).allowed).toBe(true);
      expect(can('/api/v1/invoices/77', 'GET', listOnly).allowed).toBe(false);
      expect(can('/api/v1/invoices/77', 'GET', { ...listOnly, subCanDownloadInvoices: true }).allowed).toBe(true);

      expect(can('/api/v1/influencer/commissions', 'GET', { subCanViewDashboard: true }).allowed).toBe(false);
      expect(can('/api/v1/influencer/commissions', 'GET', { subCanViewCommissions: true }).allowed).toBe(true);
    });

    it('splits the Outils grants between looking and acting', () => {
      const viewPixels: SubAccountFlags = { subCanViewPixels: true };
      expect(can('/api/v1/user-pixels', 'GET', viewPixels).allowed).toBe(true);
      expect(can('/api/v1/user-pixels', 'POST', viewPixels).allowed).toBe(false);
      expect(can('/api/v1/user-pixels/4', 'DELETE', { ...viewPixels, subCanManagePixels: true }).allowed).toBe(true);

      const readTickets: SubAccountFlags = { subCanManageSupport: true };
      expect(can('/api/v1/support', 'GET', readTickets).allowed).toBe(true);
      expect(can('/api/v1/support', 'POST', readTickets).allowed).toBe(false);
      expect(can('/api/v1/support', 'POST', { ...readTickets, subCanCreateTickets: true }).allowed).toBe(true);

      const readChat: SubAccountFlags = { subCanUseChat: true };
      expect(can('/api/v1/chat/conversations', 'GET', readChat).allowed).toBe(true);
      expect(can('/api/v1/chat/conversations/8/messages', 'GET', readChat).allowed).toBe(true);
      expect(can('/api/v1/chat/conversations/8/read', 'PATCH', readChat).allowed).toBe(true);
      expect(can('/api/v1/chat/conversations/8/messages', 'POST', readChat).allowed).toBe(false);
      expect(can('/api/v1/chat/conversations/8/close', 'POST', readChat).allowed).toBe(false);
      expect(can('/api/v1/chat/conversations/8/messages', 'POST', { ...readChat, subCanSendMessages: true }).allowed).toBe(true);
      expect(can('/api/v1/chat/conversations/8/close', 'POST', { ...readChat, subCanManageConversations: true }).allowed).toBe(true);

      const readDomain: SubAccountFlags = { subCanManageDomains: true };
      expect(can('/api/v1/domain/status', 'GET', readDomain).allowed).toBe(true);
      expect(can('/api/v1/domain/refresh', 'POST', readDomain).allowed).toBe(false);
      expect(can('/api/v1/domain/refresh', 'POST', { ...readDomain, subCanRefreshDomain: true }).allowed).toBe(true);
    });

    it('keeps domains look-but-do-not-touch even when granted', () => {
      const withDomains: SubAccountFlags = { subCanManageDomains: true };
      expect(can('/api/v1/domain/status', 'GET', withDomains).allowed).toBe(true);
      expect(can('/api/v1/domain/connect', 'POST', withDomains).allowed).toBe(false);
      expect(can('/api/v1/domain/disconnect', 'DELETE', withDomains).allowed).toBe(false);
    });

    it('exposes integration orders but never integration credentials', () => {
      const withIntegrations: SubAccountFlags = { subCanViewIntegrations: true };
      expect(can('/api/v1/youcan/orders', 'GET', withIntegrations).allowed).toBe(true);
      expect(can('/api/v1/shopify/status', 'GET', withIntegrations).allowed).toBe(true);
      expect(can('/api/v1/shopify/token', 'POST', withIntegrations).allowed).toBe(false);
      expect(can('/api/v1/google-sheets/status', 'GET', withIntegrations).allowed).toBe(false);
    });

    it('keeps the call-centre queues out of the vendor tree', () => {
      // These scope by agent assignment, not ownership; a vendor id has none.
      const withLeads: SubAccountFlags = { subCanViewLeads: true };
      expect(can('/api/v1/leads/available', 'GET', withLeads).allowed).toBe(false);
      expect(can('/api/v1/leads/abandoned-carts', 'GET', withLeads).allowed).toBe(false);
      expect(can('/api/v1/leads/assigned-all', 'GET', withLeads).allowed).toBe(false);
      expect(can('/api/v1/leads/livraison', 'GET', withLeads).allowed).toBe(false);
      // ...while the ordinary lead routes still work.
      expect(can('/api/v1/leads', 'GET', withLeads).allowed).toBe(true);
      expect(can('/api/v1/leads/99/timeline', 'GET', withLeads).allowed).toBe(true);
    });

    it('is not fooled by casing, since Express routes case-insensitively', () => {
      const withLeads: SubAccountFlags = { subCanViewLeads: true };
      // Express sends all of these to the abandoned-carts handler; the matrix
      // has to exclude them all, not just the exact lower-case spelling.
      expect(can('/api/v1/leads/Abandoned-Carts', 'GET', withLeads).allowed).toBe(false);
      expect(can('/api/v1/leads/ABANDONED-CARTS', 'GET', withLeads).allowed).toBe(false);
      expect(can('/api/v1/Leads/Available', 'GET', withLeads).allowed).toBe(false);
      // And a capitalised deny-listed path stays denied.
      expect(can('/api/v1/PAYOUTS', 'POST', allGranted).allowed).toBe(false);
      expect(can('/api/v1/Google-Sheets/Status', 'GET', allGranted).allowed).toBe(false);
      // Ordinary routes still resolve when capitalised.
      expect(can('/api/v1/Leads', 'GET', withLeads).allowed).toBe(true);
    });
  });

  describe('request scope', () => {
    it('runs data routes as the parent vendor', () => {
      expect(can('/api/v1/leads', 'GET', { subCanViewLeads: true }).scope).toBe('vendor');
      expect(can('/api/v1/notifications', 'GET', noneGranted).scope).toBe('vendor');
    });

    it('lets the app shell work with no grants at all', () => {
      // A helper with nothing ticked must still be able to render the layout.
      expect(can('/api/v1/notifications', 'GET', noneGranted).allowed).toBe(true);
      expect(can('/api/v1/notifications/12/read', 'PATCH', noneGranted).allowed).toBe(true);
      expect(can('/api/v1/notifications/read-all', 'POST', noneGranted).allowed).toBe(true);
      expect(can('/api/v1/settings/maintenance', 'GET', noneGranted).allowed).toBe(true);
      expect(can('/api/v1/announcements', 'GET', noneGranted).allowed).toBe(true);
    });

    it('runs the session and the helper\'s own account as itself', () => {
      expect(can('/api/v1/auth/me', 'GET', noneGranted).scope).toBe('self');
      expect(can('/api/v1/auth/change-password', 'POST', noneGranted).scope).toBe('self');
      expect(can('/api/v1/auth/2fa/setup', 'POST', noneGranted).scope).toBe('self');
      expect(can('/api/v1/upload/avatar', 'POST', noneGranted).scope).toBe('self');
      expect(can('/api/v1/users/3f1c2b4a-5d6e-4f70-8a91-b2c3d4e5f607', 'PATCH', noneGranted).scope).toBe('self');
    });

    it('switches mode on the helper\'s own row, presented as a vendor', () => {
      const decision = can('/api/v1/dashboard/seller-affiliate/switch-mode', 'PATCH', noneGranted);
      expect(decision.allowed).toBe(true);
      // 'self' keeps the update on the helper; the VENDOR role gets it past
      // authorize('VENDOR') on that route.
      expect(decision.scope).toBe('self-as-vendor');
    });
  });

  describe('uploads', () => {
    it('needs at least one page that can carry an attachment', () => {
      expect(can('/api/v1/upload/image', 'POST', noneGranted).allowed).toBe(false);
      expect(can('/api/v1/upload/image', 'POST', { subCanManageSupport: true }).allowed).toBe(true);
      expect(can('/api/v1/upload/product-images', 'POST', { subCanViewInventory: true }).allowed).toBe(true);
    });
  });
});

describe('read-only mode', () => {
  const readOnlyAll: SubAccountFlags = { ...allGranted, subReadOnly: true };

  it('still serves every read it was granted', () => {
    expect(can('/api/v1/leads', 'GET', readOnlyAll).allowed).toBe(true);
    expect(can('/api/v1/wallet', 'GET', readOnlyAll).allowed).toBe(true);
    expect(can('/api/v1/influencer/links/7/landing-page', 'GET', readOnlyAll).allowed).toBe(true);
  });

  it('refuses every write against the vendor, whatever is granted', () => {
    const writes: [string, string][] = [
      ['POST', '/api/v1/leads'],
      ['PATCH', '/api/v1/leads/42'],
      ['DELETE', '/api/v1/leads/42'],
      ['POST', '/api/v1/influencer/links'],
      ['PUT', '/api/v1/influencer/links/7/landing-page'],
      ['POST', '/api/v1/support'],
      ['POST', '/api/v1/user-pixels'],
      ['POST', '/api/v1/upload/image'],
    ];
    for (const [method, url] of writes) {
      expect({ method, url, allowed: can(url, method, readOnlyAll).allowed })
        .toEqual({ method, url, allowed: false });
    }
  });

  it('still lets the helper manage its own session and account', () => {
    // These run at 'self' scope — nothing of the vendor's is touched.
    expect(can('/api/v1/auth/logout', 'POST', readOnlyAll).allowed).toBe(true);
    expect(can('/api/v1/auth/change-password', 'POST', readOnlyAll).allowed).toBe(true);
    expect(can('/api/v1/dashboard/seller-affiliate/switch-mode', 'PATCH', readOnlyAll).allowed).toBe(true);
  });
});

describe('access expiry', () => {
  const at = (iso: string) => new Date(iso);

  it('is inert when no expiry is set', () => {
    expect(isSubAccountExpired({})).toBe(false);
    expect(isSubAccountExpired({ subAccessExpiresAt: null })).toBe(false);
  });

  it('expires once the moment has passed', () => {
    const now = at('2026-08-08T12:00:00Z');
    expect(isSubAccountExpired({ subAccessExpiresAt: '2026-08-09T12:00:00Z' }, now)).toBe(false);
    expect(isSubAccountExpired({ subAccessExpiresAt: '2026-08-07T12:00:00Z' }, now)).toBe(true);
    // Exactly on the boundary counts as over.
    expect(isSubAccountExpired({ subAccessExpiresAt: '2026-08-08T12:00:00Z' }, now)).toBe(true);
  });

  it('ignores an unparseable date rather than locking the account out', () => {
    expect(isSubAccountExpired({ subAccessExpiresAt: 'not-a-date' })).toBe(false);
  });
});

describe('mode restrictions', () => {
  it('BOTH allows either vendor mode and nothing else', () => {
    expect(isModeAllowedForSubAccount({ subAllowedModes: 'BOTH' }, 'SELLER')).toBe(true);
    expect(isModeAllowedForSubAccount({ subAllowedModes: 'BOTH' }, 'AFFILIATE')).toBe(true);
    expect(isModeAllowedForSubAccount({ subAllowedModes: 'BOTH' }, 'ADMIN')).toBe(false);
  });

  it('pins a helper to a single mode when the vendor says so', () => {
    expect(isModeAllowedForSubAccount({ subAllowedModes: 'SELLER' }, 'AFFILIATE')).toBe(false);
    expect(isModeAllowedForSubAccount({ subAllowedModes: 'AFFILIATE' }, 'SELLER')).toBe(false);
  });

  it('falls back to a permitted mode when the current one is no longer allowed', () => {
    expect(resolveSubAccountMode({ subAllowedModes: 'SELLER' }, 'AFFILIATE')).toBe('SELLER');
    expect(resolveSubAccountMode({ subAllowedModes: 'AFFILIATE' }, 'SELLER')).toBe('AFFILIATE');
    expect(resolveSubAccountMode({ subAllowedModes: 'BOTH' }, 'AFFILIATE')).toBe('AFFILIATE');
  });
});

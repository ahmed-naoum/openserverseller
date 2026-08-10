import { Request } from 'express';

/**
 * The request principal.
 *
 * For a VENDOR sub-account (role VENDOR_HELPER) `authenticate()` rewrites the
 * top-level fields to the *parent vendor* so vendor-scoped queries keep working,
 * and records who really made the call in the `actor*` fields. Read `actorId`,
 * never `id`, when you need the human behind the request.
 */
interface RequestUser {
  id: number;
  uuid: string;
  email: string | null;
  phone: string | null;
  roleId: number;
  roleName: string;
  mode: string;
  isInfluencer: boolean;
  canImpersonate: boolean;
  canManageProducts: boolean;
  canManageLeads: boolean;
  canManageOrders: boolean;
  canManageInfluencerLinks: boolean;
  canDisplayOnDashboard: boolean;
  isImpersonated?: boolean;

  // Present only when a vendor sub-account made the request.
  isVendorHelper?: boolean;
  actorId?: number;
  actorUuid?: string;
  actorEmail?: string | null;
  actorRoleName?: string;
  parentVendorId?: number;
  subPermissions?: import('../lib/vendorSubAccount.js').SubAccountFlags;
  /**
   * Product ids this sub-account was narrowed to, or null for the whole
   * catalogue. Read it through `productScopeOf(req)` rather than directly — that
   * helper also answers null for vendors and admins, so a call site can narrow
   * its query without first checking who is asking.
   */
  subProductIds?: import('../lib/subAccountProductScope.js').ProductScope;
}

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: RequestUser;
  }
}

export {};

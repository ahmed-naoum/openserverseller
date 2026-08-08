import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  evaluateVendorHelperAccess,
  isSubAccountExpired,
  DENIED_EXPIRED,
  SUB_ACCOUNT_PERMISSIONS,
  type SubAccountFlags,
} from '../lib/vendorSubAccount.js';

const prisma = new PrismaClient();

export const VENDOR_HELPER_ROLE = 'VENDOR_HELPER';

/** Pull just the flags off a sub-account row that a decision depends on. */
const readSubAccountFlags = (user: any): SubAccountFlags => {
  const flags: SubAccountFlags = {
    subAllowedModes: user.subAllowedModes || 'BOTH',
    subReadOnly: !!user.subReadOnly,
    subAccessExpiresAt: user.subAccessExpiresAt ?? null,
  };
  for (const key of SUB_ACCOUNT_PERMISSIONS) flags[key] = !!user[key];
  return flags;
};

/**
 * Re-point a request made by a VENDOR sub-account at the vendor that owns it.
 *
 * A helper has no data of its own, so the request runs under the parent's
 * identity — that is what lets every existing `roleName === 'VENDOR'` /
 * `vendorId: req.user!.id` query keep working untouched. Because that is a real
 * privilege grant, the route is first checked against the deny-by-default
 * matrix, and the helper's own identity is preserved in the `actor*` fields so
 * audit trails still name the human who acted.
 *
 * `req.user` must already be populated with the helper's own values.
 * Returns a denial to send, or null when the request may proceed. Shared by
 * `authenticate` and `optionalAuth` — a route guarded by the looser one is
 * still a route that reads the vendor's data.
 */
const applyVendorHelperIdentity = (
  req: Request,
  user: any,
  vendor: any,
): { status: number; message: string } | null => {
  if (!vendor || vendor.role?.name !== 'VENDOR') {
    return { status: 403, message: "Ce sous-compte n'est rattaché à aucun compte vendeur actif." };
  }

  // A helper is only ever a window onto its vendor's account, so suspending or
  // deleting the vendor has to close that window too. Without this, an account
  // an admin has just deactivated stays fully reachable through every helper
  // login it handed out.
  if (!vendor.isActive || vendor.deletedAt) {
    return { status: 403, message: "Le compte vendeur rattaché à ce sous-compte n'est plus actif." };
  }

  if (!user.isActive) {
    return { status: 403, message: 'Ce sous-compte a été suspendu par le vendeur.' };
  }

  const flags = readSubAccountFlags(user);

  // A time-limited helper stops working on its own, without the vendor having
  // to remember to come back and suspend it.
  if (isSubAccountExpired(flags)) {
    return { status: 403, message: DENIED_EXPIRED };
  }
  const decision = evaluateVendorHelperAccess(req.originalUrl, req.method, flags);

  if (!decision.allowed) {
    return { status: 403, message: decision.reason || 'Permission refusée.' };
  }

  const actor = {
    actorId: user.id,
    actorUuid: user.uuid,
    actorEmail: user.email,
    actorRoleName: user.role.name,
    isVendorHelper: true as const,
    parentVendorId: vendor.id,
    subPermissions: flags,
  };

  if (decision.scope === 'vendor') {
    req.user = {
      ...req.user!,
      id: vendor.id,
      uuid: vendor.uuid,
      email: vendor.email,
      phone: vendor.phone,
      roleId: vendor.roleId,
      roleName: 'VENDOR',
      // The helper's own mode, not the vendor's: the two browse
      // Vendeur/Affilié independently.
      mode: user.mode,
      isInfluencer: vendor.isInfluencer,
      // Never inherited — impersonation is an account-owner power.
      canImpersonate: false,
      canManageProducts: vendor.canManageProducts,
      canManageLeads: vendor.canManageLeads,
      canManageOrders: vendor.canManageOrders,
      canManageInfluencerLinks: vendor.canManageInfluencerLinks,
      canDisplayOnDashboard: vendor.canDisplayOnDashboard,
      ...actor,
    };
  } else if (decision.scope === 'self-as-vendor') {
    // Own row, vendor role. Used by the mode switch so it rewrites the helper's
    // mode column and leaves the vendor's alone.
    req.user = { ...req.user!, roleName: 'VENDOR', canImpersonate: false, ...actor };
  } else {
    req.user = { ...req.user!, canImpersonate: false, ...actor };
  }

  return null;
};

/**
 * Load a sub-account's parent. Kept as a second query rather than an `include`
 * on the session lookup: authenticate() runs on every API call, and the
 * relation is null for every user who is not a helper.
 */
const loadParentVendor = (parentVendorId: number | null) =>
  parentVendorId
    ? prisma.user.findUnique({ where: { id: parentVendorId }, include: { role: true } })
    : Promise.resolve(null);

const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    list[parts.shift()!.trim()] = decodeURIComponent(parts.join('='));
  });
  return list;
};

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.headers.cookie) {
      const cookies = parseCookies(req.headers.cookie);
      token = cookies.token || '';
    } else if (req.query.token) {
      token = req.query.token as string;
    }

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required. Please log in.',
      });
    }
    const jwt = require('jsonwebtoken');
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      isImpersonated?: boolean;
    };

    const user = await prisma.user.findUnique({
      where: { uuid: decoded.userId },
      include: { role: true },
    });

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'User not found. Please log in again.',
      });
    }

    // Removed global active check to allow unverified users to access dashboard and verification routes.

    req.user = {
      id: user.id,
      uuid: user.uuid,
      email: user.email,
      phone: user.phone,
      roleId: user.roleId,
      roleName: user.role.name,
      mode: user.mode,
      isInfluencer: user.isInfluencer,
      canImpersonate: user.canImpersonate,
      canManageProducts: user.canManageProducts,
      canManageLeads: user.canManageLeads,
      canManageOrders: user.canManageOrders,
      canManageInfluencerLinks: user.canManageInfluencerLinks,
      canDisplayOnDashboard: user.canDisplayOnDashboard,
      isImpersonated: decoded.isImpersonated || false,
    };

    if (user.role.name === VENDOR_HELPER_ROLE) {
      const vendor = await loadParentVendor(user.parentVendorId);
      const denial = applyVendorHelperIdentity(req, user, vendor);
      if (denial) return res.status(denial.status).json({ status: 'error', message: denial.message });
    }

    // If impersonated, block mutating actions (POST, PUT, PATCH, DELETE) except logout
    if (
      req.user.isImpersonated &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase()) &&
      !req.path.includes('/auth/logout')
    ) {
      return res.status(403).json({
        status: 'error',
        message: 'Lecture seule : Les modifications ne sont pas autorisées en mode assistance.',
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({
      status: 'error',
      message: 'Invalid or expired token. Please log in again.',
    });
  }
};

export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.roleName)) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to perform this action.',
      });
    }

    next();
  };
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.headers.cookie) {
      const cookies = parseCookies(req.headers.cookie);
      token = cookies.token || '';
    }
    
    if (!token) {
      return next();
    }

    const jwt = require('jsonwebtoken');
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      isImpersonated?: boolean;
    };

    const user = await prisma.user.findUnique({
      where: { uuid: decoded.userId },
      include: { role: true },
    });

    if (user && user.isActive) {
      req.user = {
        id: user.id,
        uuid: user.uuid,
        email: user.email,
        phone: user.phone,
        roleId: user.roleId,
        roleName: user.role.name,
        mode: user.mode,
        isInfluencer: user.isInfluencer,
        canImpersonate: user.canImpersonate,
        canManageProducts: user.canManageProducts,
        canManageLeads: user.canManageLeads,
        canManageOrders: user.canManageOrders,
        canManageInfluencerLinks: user.canManageInfluencerLinks,
        canDisplayOnDashboard: user.canDisplayOnDashboard,
        isImpersonated: decoded.isImpersonated || false,
      };

      // Routes behind optionalAuth still read owner-scoped data — GET /products
      // filters on `ownerId: req.user.id` for `?myProducts=true`. Without the
      // same swap a sub-account would see an empty catalogue and the access
      // matrix would not apply here at all.
      if (user.role.name === VENDOR_HELPER_ROLE) {
        const vendor = await loadParentVendor(user.parentVendorId);
        const denial = applyVendorHelperIdentity(req, user, vendor);
        // These routes serve anonymous callers too, so a refusal degrades to
        // "not signed in" rather than a 403.
        if (denial) req.user = undefined;
      }
    }

    next();
  } catch {
    next();
  }
};

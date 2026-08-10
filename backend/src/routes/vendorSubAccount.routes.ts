import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { SUB_ACCOUNT_PERMISSIONS } from '../lib/vendorSubAccount.js';
import { setSubAccountProducts, vendorCatalogueWhere } from '../lib/subAccountProductScope.js';

/**
 * Vendor sub-accounts.
 *
 * Everything here is owned by the vendor: it creates its helpers, decides page
 * by page what they may touch, resets their passwords, suspends them and
 * deletes them. `authorize('VENDOR')` plus the ownership check in
 * `loadOwnedSubAccount` means one vendor can never reach another's helpers.
 *
 * Note this router is deliberately absent from the sub-account access matrix in
 * lib/vendorSubAccount.ts, so a helper cannot create further helpers or widen
 * its own permissions.
 */
const router = Router();

/** How many helpers one vendor may have. Keeps a scripted account from farming logins. */
const MAX_SUB_ACCOUNTS_PER_VENDOR = 10;

const ALLOWED_MODES = ['BOTH', 'SELLER', 'AFFILIATE'];

/**
 * `productIds` is the catalogue half of a helper's reach, and an EMPTY array
 * means the whole catalogue — the same "no rows = everything" rule the table
 * itself uses (lib/subAccountProductScope.ts). The screen has to say which of
 * the two it is rather than showing an empty product list, or "no products
 * selected" reads as "sees nothing" when it means the opposite.
 */
const publicShape = (u: any, productIds: number[] = []) => ({
  id: u.id,
  uuid: u.uuid,
  email: u.email,
  phone: u.phone,
  fullName: u.profile?.fullName || null,
  avatarUrl: u.profile?.avatarUrl || null,
  isActive: u.isActive,
  mode: u.mode,
  subAllowedModes: u.subAllowedModes,
  subReadOnly: u.subReadOnly,
  subAccessExpiresAt: u.subAccessExpiresAt,
  lastLoginAt: u.lastLoginAt,
  createdAt: u.createdAt,
  permissions: Object.fromEntries(SUB_ACCOUNT_PERMISSIONS.map((k) => [k, !!u[k]])),
  productIds,
});

/** The product ids assigned to each of `subAccountIds`, keyed by sub-account. */
const loadProductAssignments = async (subAccountIds: number[]) => {
  const map = new Map<number, number[]>();
  if (subAccountIds.length === 0) return map;

  const rows: { subAccountId: number; productId: number }[] = await (
    prisma as any
  ).vendorSubAccountProduct.findMany({
    where: { subAccountId: { in: subAccountIds } },
    select: { subAccountId: true, productId: true },
  });

  for (const row of rows) {
    const list = map.get(row.subAccountId);
    if (list) list.push(row.productId);
    else map.set(row.subAccountId, [row.productId]);
  }
  return map;
};

/**
 * Read the product selection out of a request body.
 *
 * Absent means "leave as is", which is what lets the existing permission-only
 * PATCH from an older client keep working without silently clearing a vendor's
 * product selection. `null` and `[]` both mean "the whole catalogue".
 */
const readProductIds = (body: any): number[] | undefined => {
  if (body?.productIds === undefined) return undefined;
  if (body.productIds === null) return [];
  if (!Array.isArray(body.productIds)) {
    throw new AppException(400, 'productIds doit être une liste d\'identifiants de produits.');
  }
  return body.productIds;
};

/**
 * Read the two account-level switches out of a request body. Both are optional
 * on PATCH, so `undefined` means "leave as is" while `null` clears the expiry.
 */
const readAccountControls = (body: any) => {
  const data: any = {};
  if (typeof body?.subReadOnly === 'boolean') data.subReadOnly = body.subReadOnly;
  if (body?.subAccessExpiresAt !== undefined) {
    if (!body.subAccessExpiresAt) {
      data.subAccessExpiresAt = null;
    } else {
      const when = new Date(body.subAccessExpiresAt);
      if (Number.isNaN(when.getTime())) throw new AppException(400, "Date d'expiration invalide.");
      data.subAccessExpiresAt = when;
    }
  }
  return data;
};

/** Read the permission booleans out of a request body, ignoring anything else. */
const readPermissionPatch = (body: any) => {
  const data: Record<string, boolean> = {};
  const incoming = body?.permissions && typeof body.permissions === 'object' ? body.permissions : body;
  for (const key of SUB_ACCOUNT_PERMISSIONS) {
    if (typeof incoming?.[key] === 'boolean') data[key] = incoming[key];
  }
  return data;
};

/**
 * Fetch a sub-account by uuid *and* confirm the caller owns it. Anything that
 * isn't this vendor's helper is reported as 404 rather than 403 so the endpoint
 * can't be used to probe for other vendors' accounts.
 */
const loadOwnedSubAccount = async (uuid: string, vendorId: number) => {
  const sub = await prisma.user.findFirst({
    where: { uuid, parentVendorId: vendorId, role: { name: 'VENDOR_HELPER' } },
    include: { profile: true, role: true },
  });
  if (!sub) throw new AppException(404, 'Sous-compte introuvable.');
  return sub;
};

// ---------------------------------------------------------------------------
// GET / — the vendor's helpers
// ---------------------------------------------------------------------------
router.get(
  '/',
  authenticate,
  authorize('VENDOR'),
  asyncHandler(async (req: Request, res: Response) => {
    const subs = await prisma.user.findMany({
      where: { parentVendorId: req.user!.id, role: { name: 'VENDOR_HELPER' } },
      include: { profile: true },
      orderBy: { createdAt: 'desc' },
    });

    const assignments = await loadProductAssignments(subs.map((s) => s.id));

    res.json({
      status: 'success',
      data: {
        subAccounts: subs.map((s) => publicShape(s, assignments.get(s.id) || [])),
        maxSubAccounts: MAX_SUB_ACCOUNTS_PER_VENDOR,
        availablePermissions: SUB_ACCOUNT_PERMISSIONS,
      },
    });
  }),
);

// ---------------------------------------------------------------------------
// GET /assignable-products — the catalogue the picker offers
// ---------------------------------------------------------------------------
/**
 * What this vendor may hand to a helper: its own products, the ones it bought,
 * and the ones it has an approved claim on. Same three sources as
 * /leads/my-products, so the picker cannot offer something a helper would then
 * be unable to sell.
 */
router.get(
  '/assignable-products',
  authenticate,
  authorize('VENDOR'),
  asyncHandler(async (req: Request, res: Response) => {
    const products = await prisma.product.findMany({
      where: vendorCatalogueWhere(req.user!.id),
      select: {
        id: true,
        sku: true,
        nameFr: true,
        nameAr: true,
        status: true,
        retailPriceMad: true,
        images: { where: { isPrimary: true }, take: 1, select: { imageUrl: true } },
      },
      orderBy: { nameFr: 'asc' },
    });

    res.json({
      status: 'success',
      data: {
        products: products.map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.nameFr || p.nameAr,
          status: p.status,
          retailPriceMad: p.retailPriceMad,
          imageUrl: p.images[0]?.imageUrl || null,
        })),
      },
    });
  }),
);

// ---------------------------------------------------------------------------
// POST / — create one
// ---------------------------------------------------------------------------
router.post(
  '/',
  authenticate,
  authorize('VENDOR'),
  [
    body('fullName').trim().notEmpty().withMessage('Le nom est requis.'),
    // MUST match the normalizer /auth/login uses, character for character.
    // Bare normalizeEmail() defaults to stripping dots and +tags from Gmail, so
    // a helper created as "john.doe+cc@gmail.com" would be stored as
    // "johndoe@gmail.com" while login looks up the address the vendor actually
    // typed — a permanent lockout that reads as a wrong password.
    body('email')
      .isEmail()
      .normalizeEmail({
        gmail_remove_dots: false,
        gmail_remove_subaddress: false,
        outlookdotcom_remove_subaddress: false,
        yahoo_remove_subaddress: false,
        icloud_remove_subaddress: false,
      })
      .withMessage('Email invalide.'),
    body('password').isLength({ min: 8 }).withMessage('Le mot de passe doit faire au moins 8 caractères.'),
    body('phone').optional({ values: 'falsy' }).isString(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppException(400, 'Validation échouée', errors.array());

    const vendorId = req.user!.id;
    const { fullName, email, password, phone, subAllowedModes } = req.body;
    const productIds = readProductIds(req.body);

    const count = await prisma.user.count({
      where: { parentVendorId: vendorId, role: { name: 'VENDOR_HELPER' } },
    });
    if (count >= MAX_SUB_ACCOUNTS_PER_VENDOR) {
      throw new AppException(400, `Limite atteinte : ${MAX_SUB_ACCOUNTS_PER_VENDOR} sous-comptes maximum.`);
    }

    // email and phone are unique across the whole users table, not per vendor.
    const clash = await prisma.user.findFirst({
      where: { OR: [{ email }, ...(phone ? [{ phone }] : [])] },
      select: { id: true, email: true },
    });
    if (clash) {
      throw new AppException(400, 'Un compte utilise déjà cet email ou ce téléphone.');
    }

    // Create the role row on demand rather than erroring. It ships in both
    // seed.ts and the migration, but this project keeps its schema with
    // `prisma db push`, which runs neither — so on a database built that way
    // the row simply would not be there, and telling the vendor to "run the
    // migrations" would not have helped them.
    const role = await prisma.role.upsert({
      where: { name: 'VENDOR_HELPER' },
      update: {},
      create: { name: 'VENDOR_HELPER', guardName: 'web' },
    });

    const hashed = await bcrypt.hash(password, 10);

    const sub = await prisma.user.create({
      data: {
        email,
        phone: phone || null,
        password: hashed,
        roleId: role.id,
        parentVendorId: vendorId,
        // A helper is not a merchant: it holds no balance and pays no fee.
        platformFeeRate: 0,
        isInfluencer: false,
        // Created by a vendor that has already been vetted, so the helper skips
        // the whole onboarding gate — otherwise RoleGuard would bounce it
        // straight to /verify-email and it could never reach its dashboard.
        isActive: true,
        emailVerifiedAt: new Date(),
        kycStatus: 'APPROVED',
        contractAccepted: true,
        cguAccepted: true,
        mode: subAllowedModes === 'AFFILIATE' ? 'AFFILIATE' : 'SELLER',
        subAllowedModes: ALLOWED_MODES.includes(subAllowedModes) ? subAllowedModes : 'BOTH',
        ...readPermissionPatch(req.body),
        ...readAccountControls(req.body),
        profile: { create: { fullName } },
      },
      include: { profile: true },
    });

    // After the create, not inside it: the ids are filtered against what this
    // vendor actually owns, which needs the sub-account's row to exist first.
    const assigned = productIds?.length ? await setSubAccountProducts(sub.id, vendorId, productIds) : [];

    res.status(201).json({ status: 'success', data: { subAccount: publicShape(sub, assigned) } });
  }),
);

// ---------------------------------------------------------------------------
// PATCH /:uuid — rename, re-scope modes, re-grant permissions
// ---------------------------------------------------------------------------
router.patch(
  '/:uuid',
  authenticate,
  authorize('VENDOR'),
  asyncHandler(async (req: Request, res: Response) => {
    const sub = await loadOwnedSubAccount(String(req.params.uuid), req.user!.id);
    const { fullName, phone, subAllowedModes } = req.body;
    const productIds = readProductIds(req.body);

    if (phone && phone !== sub.phone) {
      const clash = await prisma.user.findFirst({
        where: { phone, NOT: { id: sub.id } },
        select: { id: true },
      });
      if (clash) throw new AppException(400, 'Ce téléphone est déjà utilisé.');
    }

    const data: any = { ...readPermissionPatch(req.body), ...readAccountControls(req.body) };
    if (typeof phone === 'string') data.phone = phone || null;

    if (subAllowedModes !== undefined) {
      if (!ALLOWED_MODES.includes(subAllowedModes)) {
        throw new AppException(400, 'Mode invalide. Attendu : BOTH, SELLER ou AFFILIATE.');
      }
      data.subAllowedModes = subAllowedModes;
      // Pinning a helper to one mode has to move it out of the other one now,
      // or it keeps browsing a mode it is no longer allowed in until it toggles.
      if (subAllowedModes !== 'BOTH') data.mode = subAllowedModes;
    }

    const updated = await prisma.user.update({
      where: { id: sub.id },
      data: {
        ...data,
        ...(typeof fullName === 'string' && fullName.trim()
          ? {
              profile: {
                upsert: {
                  create: { fullName: fullName.trim() },
                  update: { fullName: fullName.trim() },
                },
              },
            }
          : {}),
      },
      include: { profile: true },
    });

    const assigned =
      productIds === undefined
        ? (await loadProductAssignments([sub.id])).get(sub.id) || []
        : await setSubAccountProducts(sub.id, req.user!.id, productIds);

    res.json({ status: 'success', data: { subAccount: publicShape(updated, assigned) } });
  }),
);

// ---------------------------------------------------------------------------
// PATCH /:uuid/status — suspend / reactivate
// ---------------------------------------------------------------------------
router.patch(
  '/:uuid/status',
  authenticate,
  authorize('VENDOR'),
  asyncHandler(async (req: Request, res: Response) => {
    const sub = await loadOwnedSubAccount(String(req.params.uuid), req.user!.id);
    const isActive = !!req.body.isActive;

    const updated = await prisma.user.update({
      where: { id: sub.id },
      data: { isActive },
      include: { profile: true },
    });

    // Carried through untouched: suspending is not the place to quietly widen a
    // helper back to the whole catalogue, and `publicShape`'s default of [] means
    // exactly that.
    const assigned = (await loadProductAssignments([sub.id])).get(sub.id) || [];

    res.json({
      status: 'success',
      message: isActive ? 'Sous-compte réactivé.' : 'Sous-compte suspendu.',
      data: { subAccount: publicShape(updated, assigned) },
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /:uuid/password — set a new password
// ---------------------------------------------------------------------------
router.post(
  '/:uuid/password',
  authenticate,
  authorize('VENDOR'),
  [body('password').isLength({ min: 8 }).withMessage('Le mot de passe doit faire au moins 8 caractères.')],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppException(400, 'Validation échouée', errors.array());

    const sub = await loadOwnedSubAccount(String(req.params.uuid), req.user!.id);
    const hashed = await bcrypt.hash(req.body.password, 10);

    await prisma.user.update({ where: { id: sub.id }, data: { password: hashed } });

    res.json({ status: 'success', message: 'Mot de passe mis à jour.' });
  }),
);

// ---------------------------------------------------------------------------
// DELETE /:uuid
// ---------------------------------------------------------------------------
router.delete(
  '/:uuid',
  authenticate,
  authorize('VENDOR'),
  asyncHandler(async (req: Request, res: Response) => {
    const sub = await loadOwnedSubAccount(String(req.params.uuid), req.user!.id);

    // A hard delete is safe here in a way it would not be for a vendor: helpers
    // own no leads, orders or products — everything they touched belongs to the
    // vendor and stays put.
    await prisma.user.delete({ where: { id: sub.id } });

    res.json({ status: 'success', message: 'Sous-compte supprimé.' });
  }),
);

export default router;

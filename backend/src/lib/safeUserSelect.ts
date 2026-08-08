/**
 * The fields of a User that are safe to embed in someone else's payload.
 *
 * Prisma's `include: { vendor: true }` returns EVERY scalar column on User —
 * which on this model means `password`, `twoFactorSecret`, `emailOtp`,
 * `youcanAccessToken`, `shopifyAccessToken`, `wooCommerceConsumerSecret`,
 * `googleSheetWebhookToken` and the rest. Any endpoint that embeds a related
 * user (a lead's vendor, an order's vendor) therefore hands the caller that
 * account's credentials.
 *
 * Use this `select` instead of an `include` wherever a related user is attached
 * to a response. It carries everything the UI actually renders — name, contact,
 * role, storefront — and nothing that could be used to take the account over.
 */
export const SAFE_USER_SELECT = {
  id: true,
  uuid: true,
  email: true,
  phone: true,
  mode: true,
  isInfluencer: true,
  referralCode: true,
  subdomain: true,
  customDomain: true,
  isActive: true,
  createdAt: true,
  role: { select: { name: true } },
  profile: true,
} as const;

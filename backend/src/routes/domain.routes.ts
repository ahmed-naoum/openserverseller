import { Router, Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { Resolver } from 'dns/promises';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, AppException } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';
import { CloudflareDomainService, CustomHostname } from '../services/cloudflare-domain.service.js';
import { invalidateCustomDomainCache } from '../lib/customDomainOrigins.js';

const router = Router();

/** TXT record label the vendor publishes to prove they control the domain. */
const VERIFY_PREFIX = '_silacod-verify';

/** Sentinel written when the hostname could not be registered with Cloudflare. */
const NO_CF_ID = 'pending_cf_id';

/**
 * Labels: 1-63 chars, alphanumeric or hyphen, never starting or ending with a
 * hyphen. At least two labels, and a TLD of two or more letters — so `myshop.ma`
 * passes while `localhost`, `10.0.0.1` and `myshop.` do not.
 */
const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/**
 * Resolvers we ask directly rather than trusting the container's stub resolver.
 *
 * A vendor adds a TXT record and clicks Verify seconds later. A local cache that
 * has already stored NXDOMAIN for that name would keep answering "missing" for
 * its negative-TTL, which reads to the vendor as "the record I just added does
 * not work". Public resolvers see the change far sooner.
 */
const PUBLIC_RESOLVERS = ['1.1.1.1', '8.8.8.8'];

const DOMAIN_SELECT = {
  customDomainEnabled: true,
  customDomain: true,
  customDomainStatus: true,
  customDomainCfId: true,
  customDomainPending: true,
  customDomainVerifyToken: true,
  customDomainError: true,
} as const;

type DomainFields = {
  customDomainEnabled: boolean;
  customDomain: string | null;
  customDomainStatus: string;
  customDomainCfId: string | null;
  customDomainPending: string | null;
  customDomainVerifyToken: string | null;
  customDomainError: string | null;
};

/** Everything the vendor page needs about the account's domain, in one shape. */
function stateOf(user: DomainFields) {
  const target = process.env.CLOUDFLARE_FALLBACK_ORIGIN || 'custom.silacod.com';
  return {
    enabled: user.customDomainEnabled,
    customDomain: user.customDomain,
    customDomainStatus: user.customDomainStatus,
    // Registered on Cloudflare or not — the page shows a different next step.
    cloudflareLinked: Boolean(user.customDomainCfId && user.customDomainCfId !== NO_CF_ID),
    pendingDomain: user.customDomainPending,
    error: user.customDomainError,
    // The records the vendor has to create, spelled out here rather than left to
    // the frontend to assemble from hardcoded strings.
    verifyRecord:
      user.customDomainPending && user.customDomainVerifyToken
        ? {
            type: 'TXT',
            name: `${VERIFY_PREFIX}.${user.customDomainPending}`,
            value: user.customDomainVerifyToken,
          }
        : null,
    cnameRecord: user.customDomain
      ? { type: 'CNAME', name: user.customDomain, value: target }
      : null,
    cnameTarget: target,
  };
}

/**
 * The revoke gate.
 *
 * Custom domains are open to every account (`customDomainEnabled` defaults to
 * true), so this normally passes. It exists for the one case that matters: an
 * admin has turned the flag off for an account that abused the feature, and the
 * seller must not be able to reconnect by calling the API directly.
 */
const requireEntitlement = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { customDomainEnabled: true },
  });
  if (!user?.customDomainEnabled) {
    throw new AppException(
      403,
      "La connexion de domaines personnalisés a été désactivée sur ce compte. Contactez le support."
    );
  }
  next();
});

/** Normalises what a vendor typed, and refuses what can never work. */
function cleanDomain(raw: unknown): string {
  if (!raw || typeof raw !== 'string') {
    throw new AppException(400, 'Nom de domaine invalide.');
  }

  const domain = raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '') // a pasted https:// prefix
    .split(/[/?#]/)[0] // a pasted path
    .replace(/:\d+$/, '') // a port
    .replace(/^www\./, '') // www is served by the apex record
    .replace(/\.$/, ''); // trailing root dot

  if (domain.length > 253 || !DOMAIN_RE.test(domain)) {
    throw new AppException(
      400,
      'Format de domaine invalide. Saisissez uniquement le domaine, par exemple « myshop.ma ».'
    );
  }

  // Our own zone is served by the subdomain feature. Accepting it here would
  // register a custom hostname that shadows a real seller's subdomain.
  let baseHost = 'silacod.com';
  try {
    baseHost = new URL(process.env.FRONTEND_URL || 'https://silacod.com').host
      .replace(/^www\./, '')
      .toLowerCase();
  } catch {
    // keep the default
  }

  if (domain === baseHost || domain.endsWith(`.${baseHost}`)) {
    throw new AppException(400, `Utilisez l'onglet « Sous-domaine » pour un domaine en ${baseHost}.`);
  }

  return domain;
}

/** Reads TXT records for a name, tolerating "no such record" as an empty list. */
async function readTxt(name: string): Promise<string[]> {
  const resolver = new Resolver();
  resolver.setServers(PUBLIC_RESOLVERS);
  try {
    // Node returns chunks per record; a long value is split across them.
    const records = await resolver.resolveTxt(name);
    return records.map((chunks) => chunks.join('').trim());
  } catch (err: any) {
    if (err?.code === 'ENOTFOUND' || err?.code === 'ENODATA' || err?.code === 'NXDOMAIN') {
      return [];
    }
    throw new AppException(502, "Impossible d'interroger le DNS pour ce domaine. Réessayez dans un instant.");
  }
}

/** Maps a Cloudflare hostname record onto our four-state status column. */
function statusFrom(record: CustomHostname): string {
  if (record.status === 'active' && record.ssl?.status === 'active') return 'ACTIVE';
  if (record.status === 'deleted' || record.status === 'blocked' || record.status === 'moved') return 'FAILED';
  return 'PENDING';
}

/** The first human-readable reason a hostname is not active yet, if any. */
function errorFrom(record: CustomHostname): string | null {
  const sslError = record.ssl?.validation_errors?.[0]?.message;
  if (sslError) return `Certificat SSL : ${sslError}`;
  const verifyError = record.verification_errors?.[0];
  if (verifyError) return `Vérification Cloudflare : ${verifyError}`;
  return null;
}

/** Current state of the account's domain. */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: DOMAIN_SELECT,
    });
    if (!user) throw new AppException(404, 'Compte introuvable.');

    res.json({ status: 'success', data: stateOf(user) });
  })
);

/**
 * Step 1 — ask for a domain and get the ownership record to publish.
 *
 * Nothing is claimed here. `customDomainPending` is not unique on purpose: two
 * accounts may both be asking for the same domain, and only the one that can
 * publish the TXT record gets it. Claiming on request instead would let anyone
 * type a competitor's domain and hold the unique slot indefinitely.
 */
router.post(
  '/request',
  authenticate,
  requireEntitlement,
  asyncHandler(async (req: Request, res: Response) => {
    const domain = cleanDomain(req.body?.domain);

    const current = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { customDomain: true },
    });
    if (current?.customDomain) {
      throw new AppException(
        400,
        "Un domaine est déjà connecté. Déconnectez-le avant d'en ajouter un autre."
      );
    }

    const taken = await prisma.user.findFirst({
      where: { customDomain: domain, id: { not: req.user!.id } },
      select: { id: true },
    });
    if (taken) {
      throw new AppException(400, 'Ce domaine est déjà utilisé par un autre compte.');
    }

    // A fresh token per request, so a record published for an abandoned attempt
    // cannot be reused to verify a later one.
    const token = `silacod-verify=${randomBytes(16).toString('hex')}`;

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        customDomainPending: domain,
        customDomainVerifyToken: token,
        customDomainError: null,
      },
      select: DOMAIN_SELECT,
    });

    res.json({ status: 'success', data: stateOf(updated) });
  })
);

/**
 * Step 2 — check the TXT record, then claim the domain and register it.
 *
 * The uniqueness check is repeated here rather than trusted from `/request`:
 * two accounts can hold the same pending domain, and whoever verifies first wins.
 */
router.post(
  '/verify',
  authenticate,
  requireEntitlement,
  asyncHandler(async (req: Request, res: Response) => {
    const current = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: DOMAIN_SELECT,
    });

    const domain = current?.customDomainPending;
    const token = current?.customDomainVerifyToken;
    if (!domain || !token) {
      throw new AppException(400, "Aucune demande de domaine en cours. Saisissez d'abord votre domaine.");
    }

    const records = await readTxt(`${VERIFY_PREFIX}.${domain}`);
    if (!records.includes(token)) {
      throw new AppException(
        400,
        records.length === 0
          ? `Aucun enregistrement TXT trouvé sur ${VERIFY_PREFIX}.${domain}. Ajoutez-le chez votre registrar puis réessayez — la propagation peut prendre quelques minutes.`
          : `L'enregistrement TXT sur ${VERIFY_PREFIX}.${domain} ne correspond pas à la valeur attendue.`
      );
    }

    const taken = await prisma.user.findFirst({
      where: { customDomain: domain, id: { not: req.user!.id } },
      select: { id: true },
    });
    if (taken) {
      throw new AppException(400, "Ce domaine vient d'être connecté par un autre compte.");
    }

    // Ownership is proven; register the hostname. A failure here is recorded and
    // shown rather than swallowed — a silent failure used to leave the vendor on
    // PENDING with nothing to act on.
    let cfId: string | null = null;
    let cfError: string | null = null;
    try {
      const created = await CloudflareDomainService.addCustomHostname(domain);
      cfId = created.id;
    } catch (err: any) {
      // An orphan from an earlier attempt makes the POST fail as a duplicate.
      const existing = await CloudflareDomainService.findByHostname(domain);
      if (existing) {
        cfId = existing.id;
      } else {
        cfError = err?.message || "Cloudflare a refusé l'enregistrement de ce domaine.";
        console.error('[domain] Cloudflare registration failed for', domain, err);
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        customDomain: domain,
        customDomainStatus: 'PENDING',
        customDomainCfId: cfId || NO_CF_ID,
        customDomainPending: null,
        customDomainVerifyToken: null,
        customDomainError: cfError,
      },
      select: DOMAIN_SELECT,
    });

    invalidateCustomDomainCache();
    res.json({ status: 'success', data: stateOf(updated) });
  })
);

/**
 * Step 3 — poll Cloudflare once the CNAME is in place.
 *
 * Also retries registration when the earlier attempt failed, so an account left
 * on the `pending_cf_id` sentinel can recover without disconnecting first.
 */
router.post(
  '/refresh',
  authenticate,
  requireEntitlement,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: DOMAIN_SELECT,
    });

    if (!user?.customDomain) {
      throw new AppException(400, 'Aucun domaine personnalisé configuré.');
    }

    let cfId = user.customDomainCfId;
    let cfError: string | null = null;

    if (!cfId || cfId === NO_CF_ID) {
      try {
        const existing = await CloudflareDomainService.findByHostname(user.customDomain);
        const record = existing || (await CloudflareDomainService.addCustomHostname(user.customDomain));
        cfId = record.id;
      } catch (err: any) {
        cfError = err?.message || "Cloudflare a refusé l'enregistrement de ce domaine.";
        console.error('[domain] Cloudflare re-registration failed for', user.customDomain, err);
      }
    }

    let newStatus = user.customDomainStatus;
    if (cfId && cfId !== NO_CF_ID) {
      try {
        const record = await CloudflareDomainService.getHostnameStatus(cfId);
        newStatus = statusFrom(record);
        cfError = errorFrom(record);
      } catch (err: any) {
        cfError = err?.message || 'Impossible de lire le statut du domaine sur Cloudflare.';
        console.error('[domain] Cloudflare status check failed for', user.customDomain, err);
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        customDomainStatus: newStatus,
        customDomainCfId: cfId || NO_CF_ID,
        customDomainError: cfError,
      },
      select: DOMAIN_SELECT,
    });

    invalidateCustomDomainCache();
    res.json({ status: 'success', data: stateOf(updated) });
  })
);

/** Release the domain, on Cloudflare and here. */
router.delete(
  '/disconnect',
  authenticate,
  requireEntitlement,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { customDomainCfId: true },
    });

    if (user?.customDomainCfId && user.customDomainCfId !== NO_CF_ID) {
      try {
        await CloudflareDomainService.deleteCustomHostname(user.customDomainCfId);
      } catch (err) {
        // Best effort: the hostname is orphaned on Cloudflare, but the account
        // must still be released so the vendor is not stuck.
        console.error('[domain] Cloudflare hostname deletion failed:', err);
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        customDomain: null,
        customDomainStatus: 'NONE',
        customDomainCfId: null,
        customDomainPending: null,
        customDomainVerifyToken: null,
        customDomainError: null,
      },
      select: DOMAIN_SELECT,
    });

    invalidateCustomDomainCache();
    res.json({
      status: 'success',
      message: 'Domaine déconnecté avec succès.',
      data: stateOf(updated),
    });
  })
);

export default router;

import { Request } from 'express';

export function getRequestHost(req: Request): string | null {
  const originHeader = req.headers.origin as string | undefined;
  const refererHeader = req.headers.referer as string | undefined;
  const hostHeader = req.headers.host as string | undefined;

  let requestHost = '';
  if (originHeader) {
    try {
      requestHost = new URL(originHeader).host;
    } catch (e) {}
  }
  if (!requestHost && refererHeader) {
    try {
      requestHost = new URL(refererHeader).host;
    } catch (e) {}
  }
  if (!requestHost && hostHeader) {
    requestHost = hostHeader;
  }

  if (!requestHost) {
    return null;
  }

  return requestHost.replace(/^www\./i, '').toLowerCase();
}

export function getSubdomainFromRequest(req: Request): string | null {
  const requestHost = getRequestHost(req);
  if (!requestHost) return null;

  const normalizedRequestHost = requestHost;

  // 1. Support local development subdomains on localhost (e.g. seller.localhost:5173)
  if (normalizedRequestHost === 'localhost:5173' || normalizedRequestHost.endsWith('.localhost:5173')) {
    const baseHost = 'localhost:5173';
    if (normalizedRequestHost === baseHost) {
      return null;
    }
    return normalizedRequestHost.slice(0, -(baseHost.length + 1));
  }

  if (normalizedRequestHost === 'localhost:3000' || normalizedRequestHost.endsWith('.localhost:3000')) {
    const baseHost = 'localhost:3000';
    if (normalizedRequestHost === baseHost) {
      return null;
    }
    return normalizedRequestHost.slice(0, -(baseHost.length + 1));
  }

  // 2. Support configured FRONTEND_URL in production
  const frontendUrl = process.env.FRONTEND_URL || 'https://silacod.com';
  let baseHost = 'silacod.com';
  try {
    baseHost = new URL(frontendUrl).host;
  } catch (e) {}

  const normalizedBaseHost = baseHost.replace(/^www\./i, '').toLowerCase();

  if (normalizedRequestHost === normalizedBaseHost) {
    return null;
  }

  if (normalizedRequestHost.endsWith('.' + normalizedBaseHost)) {
    const sub = normalizedRequestHost.slice(0, -(normalizedBaseHost.length + 1));
    if (sub === 'custom') {
      return null;
    }
    return sub;
  }

  return null;
}

export function validateInfluencerSubdomain(
  req: Request, 
  influencerSubdomain: string | null | undefined,
  customDomain?: string | null | undefined
): boolean {
  const requestHost = getRequestHost(req);
  if (!requestHost) {
    return false;
  }

  // 1. Check custom domain exact match
  if (customDomain) {
    const normalizedCustom = customDomain.trim().toLowerCase();
    if (requestHost === normalizedCustom) {
      return true;
    }
  }

  // 2. Fallback to subdomain check
  if (!influencerSubdomain) {
    return false;
  }

  const requestSubdomain = getSubdomainFromRequest(req);
  return requestSubdomain !== null && requestSubdomain.toLowerCase() === influencerSubdomain.toLowerCase();
}

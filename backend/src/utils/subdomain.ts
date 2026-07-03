import { Request } from 'express';

export function getSubdomainFromRequest(req: Request): string | null {
  const originHeader = req.headers.origin as string | undefined;
  const refererHeader = req.headers.referer as string | undefined;

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

  if (!requestHost) {
    return null;
  }

  const normalizedRequestHost = requestHost.replace(/^www\./i, '').toLowerCase();

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
    return normalizedRequestHost.slice(0, -(normalizedBaseHost.length + 1));
  }

  return null;
}

export function validateInfluencerSubdomain(req: Request, influencerSubdomain: string | null | undefined): boolean {
  if (!influencerSubdomain) {
    return false;
  }

  const requestSubdomain = getSubdomainFromRequest(req);
  return requestSubdomain !== null && requestSubdomain.toLowerCase() === influencerSubdomain.toLowerCase();
}

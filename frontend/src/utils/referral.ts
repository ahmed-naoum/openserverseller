/**
 * Builds a referral link URL with the user's custom subdomain.
 * If no subdomain is present, returns the standard root-level link.
 */
export function buildReferralUrl(code: string, subdomain?: string | null, customDomain?: string | null, customDomainStatus?: string | null): string {
  if (customDomain && customDomainStatus === 'ACTIVE') {
    return `https://${customDomain}/r/${code}`;
  }

  const { protocol, host } = window.location;
  
  if (!subdomain) {
    return `${protocol}//${host}/r/${code}`;
  }

  // Normalize subdomain
  const sub = subdomain.trim().toLowerCase();

  // If host already starts with this subdomain, don't duplicate it
  const hostLower = host.toLowerCase();
  if (hostLower.startsWith(sub + '.')) {
    return `${protocol}//${host}/r/${code}`;
  }

  // Clean www. from host
  const cleanHost = host.replace(/^www\./i, '');

  return `${protocol}//${sub}.${cleanHost}/r/${code}`;
}

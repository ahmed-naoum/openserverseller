import { AppException } from '../middleware/errorHandler.js';
import { getSecret } from '../lib/secretStore.js';

const CLOUDFLARE_API_URL = 'https://api.cloudflare.com/client/v4';

interface CloudflareCustomHostnameResponse {
  success: boolean;
  errors: any[];
  messages: any[];
  result: CustomHostname;
}

export interface CustomHostname {
  id: string;
  hostname: string;
  status: string; // "pending", "active", "moved", "deleted", "blocked"
  ssl: {
    status: string; // "pending_validation", "pending_issuance", "active"
    method: string;
    type: string;
    validation_errors?: { message: string }[];
  };
  /** Cloudflare's own proof-of-control record. Present while status is pending. */
  ownership_verification?: { type: string; name: string; value: string };
  verification_errors?: string[];
}

export function getHostnamesForDomain(domain: string): string[] {
  const clean = domain.trim().toLowerCase().replace(/^www\./, '');
  if (!clean) return [];
  return [clean, `www.${clean}`];
}

export function errorFromCustomHostname(record: CustomHostname): string | null {
  const sslError = record.ssl?.validation_errors?.[0]?.message;
  if (sslError) return `Certificat SSL : ${sslError}`;
  const verifyError = record.verification_errors?.[0];
  if (verifyError) return `Vérification Cloudflare : ${verifyError}`;
  return null;
}

export class CloudflareDomainService {
  private static getHeaders() {
    const token = getSecret('CLOUDFLARE_API_TOKEN');
    if (!token) {
      throw new AppException(500, 'CLOUDFLARE_API_TOKEN is not configured');
    }
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private static getZoneId() {
    const zoneId = getSecret('CLOUDFLARE_ZONE_ID');
    if (!zoneId) {
      throw new AppException(500, 'CLOUDFLARE_ZONE_ID is not configured');
    }
    return zoneId;
  }

  /**
   * Add a new custom hostname to Cloudflare
   */
  static async addCustomHostname(hostname: string): Promise<CustomHostname> {
    try {
      const zoneId = this.getZoneId();
      const response = await fetch(`${CLOUDFLARE_API_URL}/zones/${zoneId}/custom_hostnames`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          hostname,
          ssl: {
            method: 'http',
            type: 'dv'
          }
        }),
      });

      const data = (await response.json()) as any;

      if (!response.ok || !data.success) {
        console.error('Cloudflare Error:', data.errors);
        const errorMsg = data.errors?.[0]?.message || 'Failed to add custom hostname to Cloudflare';
        throw new AppException(400, `Erreur Cloudflare: ${errorMsg}`);
      }

      return data.result;
    } catch (error: any) {
      if (error instanceof AppException) throw error;
      console.error('Cloudflare API Error:', error);
      throw new AppException(500, 'Failed to communicate with Cloudflare API');
    }
  }

  /**
   * Check the status of a custom hostname
   */
  static async getHostnameStatus(cfId: string): Promise<CustomHostname> {
    try {
      const zoneId = this.getZoneId();
      const response = await fetch(`${CLOUDFLARE_API_URL}/zones/${zoneId}/custom_hostnames/${cfId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const data = (await response.json()) as any;

      if (!response.ok || !data.success) {
        console.error('Cloudflare Error:', data.errors);
        throw new AppException(400, 'Failed to retrieve custom hostname status');
      }

      return data.result;
    } catch (error: any) {
      if (error instanceof AppException) throw error;
      console.error('Cloudflare API Error:', error);
      throw new AppException(500, 'Failed to communicate with Cloudflare API');
    }
  }

  /**
   * Look up a hostname already registered on the zone.
   *
   * A previous attempt can leave an orphan on Cloudflare while the DB row was
   * rolled back or never written. Re-POSTing the same hostname then fails with
   * a duplicate error and the vendor is stuck with no way forward, so `connect`
   * falls back to adopting the existing record instead.
   */
  static async findByHostname(hostname: string): Promise<CustomHostname | null> {
    try {
      const zoneId = this.getZoneId();
      const response = await fetch(
        `${CLOUDFLARE_API_URL}/zones/${zoneId}/custom_hostnames?hostname=${encodeURIComponent(hostname)}`,
        { method: 'GET', headers: this.getHeaders() }
      );
      const data = (await response.json()) as any;
      if (!response.ok || !data.success) return null;
      const match = (data.result || []).find(
        (entry: CustomHostname) => entry.hostname?.toLowerCase() === hostname.toLowerCase()
      );
      return match || null;
    } catch (error: any) {
      console.error('Cloudflare API Error (findByHostname):', error);
      return null;
    }
  }

  /**
   * Register both the apex domain and the www subdomain with Cloudflare.
   * Adopts existing custom hostnames on Cloudflare if already present.
   */
  static async ensureHostnamesForDomain(domain: string): Promise<{ cfIds: string[]; errors: string[]; hostnames: CustomHostname[] }> {
    const hostnames = getHostnamesForDomain(domain);
    const cfIds: string[] = [];
    const errors: string[] = [];
    const hostnamesResult: CustomHostname[] = [];

    for (const hostname of hostnames) {
      try {
        const created = await this.addCustomHostname(hostname);
        if (created?.id) {
          cfIds.push(created.id);
          hostnamesResult.push(created);
        }
      } catch (err: any) {
        // If registration fails (e.g. duplicate/orphan), try adopting existing custom hostname
        const existing = await this.findByHostname(hostname);
        if (existing?.id) {
          cfIds.push(existing.id);
          hostnamesResult.push(existing);
        } else {
          const msg = err?.message || `Erreur Cloudflare pour ${hostname}`;
          errors.push(msg);
          console.error(`[domain] Cloudflare registration failed for ${hostname}:`, err);
        }
      }
    }

    return { cfIds, errors, hostnames: hostnamesResult };
  }

  /**
   * Check status of one or more custom hostnames (comma-separated IDs).
   * If ANY registered hostname (apex or www) has an active SSL cert and status,
   * the overall status is ACTIVE so sellers who point www via CNAME are immediately live.
   */
  static async getHostnamesStatus(cfId: string): Promise<{
    status: 'ACTIVE' | 'PENDING' | 'FAILED';
    error: string | null;
    records: CustomHostname[];
  }> {
    const ids = cfId.split(',').map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0) {
      return { status: 'PENDING', error: 'Aucun identifiant Cloudflare configuré.', records: [] };
    }

    const records: CustomHostname[] = [];
    const fetchErrors: string[] = [];

    for (const id of ids) {
      try {
        const rec = await this.getHostnameStatus(id);
        records.push(rec);
      } catch (err: any) {
        console.error(`[domain] Cloudflare status check failed for ID ${id}:`, err);
        fetchErrors.push(err?.message || `Impossible de lire le statut de l'hôte ${id}`);
      }
    }

    if (records.length === 0) {
      return {
        status: 'FAILED',
        error: fetchErrors[0] || 'Impossible de contacter Cloudflare pour vérifier le statut.',
        records: [],
      };
    }

    // If ANY of the registered hostnames (e.g. www or apex) is active with SSL active, it is ACTIVE
    const hasActive = records.some(
      (rec) => rec.status === 'active' && rec.ssl?.status === 'active'
    );
    if (hasActive) {
      return { status: 'ACTIVE', error: null, records };
    }

    // If ALL records failed/deleted/blocked/moved
    const allFailed = records.every((rec) =>
      ['deleted', 'blocked', 'moved'].includes(rec.status)
    );
    if (allFailed) {
      const err = records.map((r) => errorFromCustomHostname(r)).find(Boolean) || 'La vérification du domaine a échoué sur Cloudflare.';
      return { status: 'FAILED', error: err, records };
    }

    // Otherwise PENDING (waiting for DNS / SSL propagation)
    const err = records.map((r) => errorFromCustomHostname(r)).find(Boolean) || null;
    return { status: 'PENDING', error: err, records };
  }

  /**
   * Delete custom hostname(s) from Cloudflare.
   * Handles comma-separated IDs if multiple hostnames are linked.
   */
  static async deleteCustomHostname(cfId: string): Promise<boolean> {
    try {
      const ids = cfId.split(',').map((id) => id.trim()).filter(Boolean);
      if (ids.length === 0) return true;
      const zoneId = this.getZoneId();
      let allSuccess = true;
      for (const id of ids) {
        const response = await fetch(`${CLOUDFLARE_API_URL}/zones/${zoneId}/custom_hostnames/${id}`, {
          method: 'DELETE',
          headers: this.getHeaders(),
        });

        const data = (await response.json()) as any;

        if (!response.ok || !data.success) {
          console.error(`Cloudflare Error deleting ${id}:`, data.errors);
          allSuccess = false;
        }
      }
      return allSuccess;
    } catch (error: any) {
      console.error('Cloudflare API Error (deleteCustomHostname):', error);
      return false;
    }
  }
}

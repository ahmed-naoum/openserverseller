import { AppException } from '../middleware/errorHandler.js';

const CLOUDFLARE_API_URL = 'https://api.cloudflare.com/client/v4';

interface CloudflareCustomHostnameResponse {
  success: boolean;
  errors: any[];
  messages: any[];
  result: {
    id: string;
    hostname: string;
    status: string; // "pending", "active", "moved", "deleted", "blocked"
    ssl: {
      status: string; // "pending_validation", "pending_issuance", "active"
      method: string;
      type: string;
    };
  };
}

export class CloudflareDomainService {
  private static getHeaders() {
    const token = process.env.CLOUDFLARE_API_TOKEN;
    if (!token) {
      throw new AppException(500, 'CLOUDFLARE_API_TOKEN is not configured');
    }
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private static getZoneId() {
    const zoneId = process.env.CLOUDFLARE_ZONE_ID;
    if (!zoneId) {
      throw new AppException(500, 'CLOUDFLARE_ZONE_ID is not configured');
    }
    return zoneId;
  }

  /**
   * Add a new custom hostname to Cloudflare
   */
  static async addCustomHostname(hostname: string): Promise<CloudflareCustomHostnameResponse['result']> {
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
  static async getHostnameStatus(cfId: string): Promise<CloudflareCustomHostnameResponse['result']> {
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
   * Delete a custom hostname from Cloudflare
   */
  static async deleteCustomHostname(cfId: string): Promise<boolean> {
    try {
      const zoneId = this.getZoneId();
      const response = await fetch(`${CLOUDFLARE_API_URL}/zones/${zoneId}/custom_hostnames/${cfId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      const data = (await response.json()) as any;

      if (!response.ok || !data.success) {
        console.error('Cloudflare Error:', data.errors);
        return false;
      }

      return true;
    } catch (error: any) {
      console.error('Cloudflare API Error:', error);
      return false;
    }
  }
}

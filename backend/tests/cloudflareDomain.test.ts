import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CloudflareDomainService,
  getHostnamesForDomain,
  errorFromCustomHostname,
  CustomHostname,
} from '../src/services/cloudflare-domain.service.js';

describe('getHostnamesForDomain', () => {
  it('generates both apex and www hostnames from a bare domain', () => {
    expect(getHostnamesForDomain('vegas.ma')).toEqual(['vegas.ma', 'www.vegas.ma']);
    expect(getHostnamesForDomain('myshop.com')).toEqual(['myshop.com', 'www.myshop.com']);
  });

  it('normalizes leading www before generating pair', () => {
    expect(getHostnamesForDomain('www.vegas.ma')).toEqual(['vegas.ma', 'www.vegas.ma']);
    expect(getHostnamesForDomain('WWW.SHOP.MA')).toEqual(['shop.ma', 'www.shop.ma']);
  });

  it('returns empty array for empty domain', () => {
    expect(getHostnamesForDomain('')).toEqual([]);
    expect(getHostnamesForDomain('   ')).toEqual([]);
  });
});

describe('errorFromCustomHostname', () => {
  it('extracts SSL validation errors', () => {
    const record: CustomHostname = {
      id: 'cf_1',
      hostname: 'vegas.ma',
      status: 'pending',
      ssl: {
        status: 'pending_validation',
        method: 'http',
        type: 'dv',
        validation_errors: [{ message: 'CAA record forbids issuance' }],
      },
    };
    expect(errorFromCustomHostname(record)).toBe('Certificat SSL : CAA record forbids issuance');
  });

  it('extracts Cloudflare verification errors', () => {
    const record: CustomHostname = {
      id: 'cf_1',
      hostname: 'vegas.ma',
      status: 'pending',
      ssl: { status: 'pending_validation', method: 'http', type: 'dv' },
      verification_errors: ['zone apex has conflicting CNAME'],
    };
    expect(errorFromCustomHostname(record)).toBe('Vérification Cloudflare : zone apex has conflicting CNAME');
  });

  it('returns null when there are no errors', () => {
    const record: CustomHostname = {
      id: 'cf_1',
      hostname: 'vegas.ma',
      status: 'active',
      ssl: { status: 'active', method: 'http', type: 'dv' },
    };
    expect(errorFromCustomHostname(record)).toBeNull();
  });
});

describe('CloudflareDomainService multi-hostname registration & status', () => {
  beforeEach(() => {
    vi.stubEnv('CLOUDFLARE_API_TOKEN', 'mock-token');
    vi.stubEnv('CLOUDFLARE_ZONE_ID', 'mock-zone');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('ensureHostnamesForDomain registers both apex and www', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          result: {
            id: `id_${body.hostname}`,
            hostname: body.hostname,
            status: 'pending',
            ssl: { status: 'pending_validation', method: 'http', type: 'dv' },
          },
        }),
      });
    });
    global.fetch = fetchMock;

    const result = await CloudflareDomainService.ensureHostnamesForDomain('vegas.ma');
    expect(result.cfIds).toEqual(['id_vegas.ma', 'id_www.vegas.ma']);
    expect(result.errors).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ensureHostnamesForDomain adopts existing hostname if POST fails with duplicate', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(init.body as string);
        if (body.hostname === 'vegas.ma') {
          return Promise.resolve({
            ok: false,
            json: async () => ({
              success: false,
              errors: [{ message: 'custom_hostname.already_exists' }],
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            result: { id: 'id_www_new', hostname: 'www.vegas.ma', status: 'pending', ssl: { status: 'pending_validation' } },
          }),
        });
      }
      if (url.includes('custom_hostnames?hostname=vegas.ma')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            result: [{ id: 'id_apex_existing', hostname: 'vegas.ma', status: 'pending', ssl: { status: 'pending_validation' } }],
          }),
        });
      }
      return Promise.resolve({ ok: false, json: async () => ({ success: false }) });
    });
    global.fetch = fetchMock;

    const result = await CloudflareDomainService.ensureHostnamesForDomain('vegas.ma');
    expect(result.cfIds).toEqual(['id_apex_existing', 'id_www_new']);
    expect(result.errors).toEqual([]);
  });

  it('getHostnamesStatus returns ACTIVE if www is active even if apex is pending', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('id_apex')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            result: {
              id: 'id_apex',
              hostname: 'vegas.ma',
              status: 'pending',
              ssl: { status: 'pending_validation', method: 'http', type: 'dv' },
            },
          }),
        });
      }
      if (url.endsWith('id_www')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            result: {
              id: 'id_www',
              hostname: 'www.vegas.ma',
              status: 'active',
              ssl: { status: 'active', method: 'http', type: 'dv' },
            },
          }),
        });
      }
      return Promise.resolve({ ok: false, json: async () => ({ success: false }) });
    });
    global.fetch = fetchMock;

    const result = await CloudflareDomainService.getHostnamesStatus('id_apex,id_www');
    expect(result.status).toBe('ACTIVE');
    expect(result.error).toBeNull();
    expect(result.records).toHaveLength(2);
  });

  it('deleteCustomHostname deletes all comma-separated IDs', async () => {
    const deletedIds: string[] = [];
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        const id = url.split('/').pop();
        if (id) deletedIds.push(id);
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      }
      return Promise.resolve({ ok: false, json: async () => ({ success: false }) });
    });
    global.fetch = fetchMock;

    const success = await CloudflareDomainService.deleteCustomHostname('id_1,id_2,id_3');
    expect(success).toBe(true);
    expect(deletedIds).toEqual(['id_1', 'id_2', 'id_3']);
  });
});

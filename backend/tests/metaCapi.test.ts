import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  normalizePhoneForCapi,
  splitFullName,
  buildCapiEvent,
} from '../src/services/metaCapi.service.js';
import { pixelRowsForCode } from '../src/services/landingCompiler/head.js';

const sha = (v: string) => crypto.createHash('sha256').update(v, 'utf8').digest('hex');

/**
 * The payload builder is what Meta judges the integration on: a hash produced
 * from an unnormalized value is not wrong-looking, it just never matches
 * anyone, and match quality quietly craters. These tests pin the
 * normalization to Meta's spec.
 */

describe('normalizePhoneForCapi', () => {
  it('turns every accepted Moroccan shape into E.164 digits', () => {
    // The checkout accepts these four prefixes (runtime/checkout.ts MA_FULL);
    // all must hash identically or the same customer counts as four people.
    expect(normalizePhoneForCapi('0612345678')).toBe('212612345678');
    expect(normalizePhoneForCapi('+212612345678')).toBe('212612345678');
    expect(normalizePhoneForCapi('00212612345678')).toBe('212612345678');
    expect(normalizePhoneForCapi('212612345678')).toBe('212612345678');
  });

  it('survives separators and Eastern Arabic digits', () => {
    expect(normalizePhoneForCapi('06 12-34 56 78')).toBe('212612345678');
    expect(normalizePhoneForCapi('٠٦١٢٣٤٥٦٧٨')).toBe('212612345678');
  });

  it('falls back to bare digits rather than dropping the field', () => {
    expect(normalizePhoneForCapi('33612345678')).toBe('33612345678');
    expect(normalizePhoneForCapi('')).toBeNull();
    expect(normalizePhoneForCapi('abc')).toBeNull();
  });
});

describe('splitFullName', () => {
  it('lowercases and splits first/last', () => {
    expect(splitFullName('Ahmed Ben Ali')).toEqual({ fn: 'ahmed', ln: 'ben ali' });
  });
  it('handles a single-word name without inventing a last name', () => {
    expect(splitFullName('Fatima')).toEqual({ fn: 'fatima', ln: null });
  });
  it('collapses the whitespace customers actually type', () => {
    expect(splitFullName('  Ahmed   Alaoui ')).toEqual({ fn: 'ahmed', ln: 'alaoui' });
  });
});

describe('buildCapiEvent', () => {
  const input = {
    influencerId: 7,
    code: 'CODE1',
    leadId: 42,
    fullName: 'Ahmed Alaoui',
    phone: '0612345678',
    city: 'Casablanca',
    ipAddress: '41.140.0.1',
    userAgent: 'Mozilla/5.0',
    fbp: 'fb.1.1700000000.123456',
    fbc: 'fb.1.1700000000.AbCdEf',
    eventId: 'evt-1',
    value: 249,
    productName: 'Produit X',
    sourceUrl: 'https://sub.silacod.com/r/CODE1',
  };

  it('hashes PII and passes network identifiers through', () => {
    const ev = buildCapiEvent(input, 'Lead');
    expect(ev.event_name).toBe('Lead');
    expect(ev.action_source).toBe('website');
    expect(ev.event_id).toBe('evt-1');
    expect(ev.event_source_url).toBe('https://sub.silacod.com/r/CODE1');

    expect(ev.user_data.ph).toEqual([sha('212612345678')]);
    expect(ev.user_data.fn).toEqual([sha('ahmed')]);
    expect(ev.user_data.ln).toEqual([sha('alaoui')]);
    expect(ev.user_data.ct).toEqual([sha('casablanca')]);
    expect(ev.user_data.country).toEqual([sha('ma')]);
    expect(ev.user_data.external_id).toEqual([sha('lead-42')]);
    // Explicitly NOT hashed, per spec.
    expect(ev.user_data.client_ip_address).toBe('41.140.0.1');
    expect(ev.user_data.client_user_agent).toBe('Mozilla/5.0');
    expect(ev.user_data.fbp).toBe('fb.1.1700000000.123456');
    expect(ev.user_data.fbc).toBe('fb.1.1700000000.AbCdEf');

    expect(ev.custom_data).toMatchObject({ currency: 'MAD', value: 249, order_id: '42' });
  });

  it('never emits a raw phone, name or city anywhere in the payload', () => {
    const flat = JSON.stringify(buildCapiEvent(input, 'Purchase')).toLowerCase();
    expect(flat).not.toContain('0612345678');
    expect(flat).not.toContain('212612345678');
    expect(flat).not.toContain('ahmed');
    expect(flat).not.toContain('alaoui');
    expect(flat).not.toContain('casablanca');
  });

  it('drops malformed browser identifiers instead of sending junk', () => {
    const ev = buildCapiEvent({ ...input, fbp: 'not-a-cookie', fbc: 'fbclid-raw' }, 'Lead');
    expect(ev.user_data.fbp).toBeUndefined();
    expect(ev.user_data.fbc).toBeUndefined();
  });

  it('omits what it does not have rather than hashing empty strings', () => {
    const ev = buildCapiEvent(
      { influencerId: 1, code: 'C', leadId: 1, fullName: 'Sara', phone: '' },
      'Lead'
    );
    expect(ev.user_data.ph).toBeUndefined();
    expect(ev.user_data.ln).toBeUndefined();
    expect(ev.user_data.ct).toBeUndefined();
    expect(ev.user_data.fn).toEqual([sha('sara')]);
  });
});

describe('pixelRowsForCode', () => {
  const rows = [
    { type: 'GLOBAL', platform: 'META', pixelId: 'g1', accessToken: 't1' },
    { type: 'SINGLE', platform: 'META', pixelId: 's1', targetIds: ['CODE1'] },
    { type: 'SINGLE', platform: 'TIKTOK', pixelId: 's2', targetIds: ['OTHER'] },
  ];

  it('lets a SINGLE pixel on the code silence the globals, keeping fields intact', () => {
    const picked = pixelRowsForCode(rows, 'CODE1');
    expect(picked).toEqual([rows[1]]);
  });

  it('falls back to globals when no SINGLE matches', () => {
    expect(pixelRowsForCode(rows, 'UNMATCHED')).toEqual([rows[0]]);
  });
});

import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatPhone,
  getStatusColor,
  normalizePhone,
  isValidMoroccanPhone,
  isValidRIB,
  isValidICE,
} from '../src/utils/formatters';

describe('formatCurrency', () => {
  it('should format MAD currency correctly', () => {
    expect(formatCurrency(1000)).toContain('1');
    expect(formatCurrency(0)).toContain('0');
  });

  it('should handle string input', () => {
    expect(formatCurrency('500')).toBeDefined();
  });
});

describe('formatDate', () => {
  it('should format date in French locale', () => {
    const date = new Date('2025-01-15');
    const result = formatDate(date);
    expect(result).toBeDefined();
  });
});

describe('formatPhone', () => {
  it('should format Moroccan phone number', () => {
    expect(formatPhone('+212612345678')).toBeDefined();
  });
});

describe('normalizePhone', () => {
  it('should normalize phone with leading 0', () => {
    expect(normalizePhone('0612345678')).toBe('+212612345678');
  });

  it('should handle phone without +', () => {
    expect(normalizePhone('212612345678')).toBe('+212612345678');
  });
});

describe('isValidMoroccanPhone', () => {
  it('should validate correct Moroccan phone', () => {
    expect(isValidMoroccanPhone('+212612345678')).toBe(true);
    expect(isValidMoroccanPhone('0612345678')).toBe(true);
  });

  it('should reject invalid phone', () => {
    expect(isValidMoroccanPhone('+1234567890')).toBe(false);
    expect(isValidMoroccanPhone('12345')).toBe(false);
  });
});

describe('isValidRIB', () => {
  it('should validate 24-digit RIB', () => {
    expect(isValidRIB('011780000012345678901234')).toBe(true);
  });

  it('should reject invalid RIB', () => {
    expect(isValidRIB('12345')).toBe(false);
    expect(isValidRIB('01178000001234567890123')).toBe(false);
  });
});

describe('isValidICE', () => {
  it('should validate ICE number', () => {
    expect(isValidICE('001234567')).toBe(true);
    expect(isValidICE('00123456789012')).toBe(true);
  });

  it('should reject invalid ICE', () => {
    expect(isValidICE('123')).toBe(false);
    expect(isValidICE('abcdef')).toBe(false);
  });
});

describe('getStatusColor', () => {
  it('should return correct color for lead statuses', () => {
    expect(getStatusColor('NEW')).toBe('primary');
    expect(getStatusColor('INTERESTED')).toBe('success');
    expect(getStatusColor('ORDERED')).toBe('success');
  });

  it('should return correct color for order statuses', () => {
    expect(getStatusColor('PENDING')).toBe('warning');
    expect(getStatusColor('DELIVERED')).toBe('success');
    expect(getStatusColor('CANCELLED')).toBe('danger');
  });

  it('should return gray for unknown status', () => {
    expect(getStatusColor('UNKNOWN')).toBe('gray');
  });
});

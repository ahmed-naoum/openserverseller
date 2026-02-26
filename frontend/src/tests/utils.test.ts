import { describe, it, expect } from 'vitest';
import { cn, formatFileSize, getFileExtension, debounce, throttle, generateUUID } from '../src/utils';

describe('cn utility', () => {
  it('should join class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should filter falsy values', () => {
    expect(cn('foo', false, 'bar', null, undefined)).toBe('foo bar');
  });
});

describe('formatFileSize', () => {
  it('should format bytes', () => {
    expect(formatFileSize(0)).toBe('0 Bytes');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1024 * 1024)).toBe('1 MB');
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
  });
});

describe('getFileExtension', () => {
  it('should extract file extension', () => {
    expect(getFileExtension('document.pdf')).toBe('pdf');
    expect(getFileExtension('image.png')).toBe('png');
    expect(getFileExtension('archive.tar.gz')).toBe('gz');
  });
});

describe('generateUUID', () => {
  it('should generate valid UUID', () => {
    const uuid = generateUUID();
    expect(uuid).toHaveLength(36);
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('should generate unique UUIDs', () => {
    const uuids = new Set();
    for (let i = 0; i < 100; i++) {
      uuids.add(generateUUID());
    }
    expect(uuids.size).toBe(100);
  });
});

describe('debounce', () => {
  it('should debounce function calls', async () => {
    let count = 0;
    const fn = debounce(() => count++, 100);
    
    fn();
    fn();
    fn();
    
    expect(count).toBe(0);
    
    await new Promise(resolve => setTimeout(resolve, 150));
    
    expect(count).toBe(1);
  });
});

describe('throttle', () => {
  it('should throttle function calls', async () => {
    let count = 0;
    const fn = throttle(() => count++, 100);
    
    fn();
    fn();
    fn();
    
    expect(count).toBe(1);
  });
});

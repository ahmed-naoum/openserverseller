import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mode } from '../src/routes/landing.routes';

const original = process.env.SSG_LANDING;

function setFlag(value: string | undefined) {
  if (value === undefined) delete process.env.SSG_LANDING;
  else process.env.SSG_LANDING = value;
}

beforeEach(() => setFlag(undefined));
afterEach(() => setFlag(original));

describe('SSG_LANDING mode — explicit values', () => {
  it('serves compiled HTML only on an explicit "on"', () => {
    setFlag('on');
    expect(mode()).toBe('on');
  });

  it('honours the kill switch', () => {
    setFlag('off');
    expect(mode()).toBe('off');
  });

  it('honours shadow', () => {
    setFlag('shadow');
    expect(mode()).toBe('shadow');
  });

  it('is case- and whitespace-insensitive', () => {
    for (const v of ['ON', ' on ', 'On', '\ton\n']) {
      setFlag(v);
      expect(mode(), `for ${JSON.stringify(v)}`).toBe('on');
    }
    setFlag('  OFF  ');
    expect(mode()).toBe('off');
  });
});

describe('SSG_LANDING mode — fails safe, not open', () => {
  it('defaults to shadow when unset', () => {
    // The regression this guards: a deploy where the variable was never written
    // used to run in full live-serving mode while appearing dormant.
    setFlag(undefined);
    expect(mode()).toBe('shadow');
  });

  it('defaults to shadow when empty or whitespace', () => {
    for (const v of ['', '   ', '\t']) {
      setFlag(v);
      expect(mode(), `for ${JSON.stringify(v)}`).toBe('shadow');
    }
  });

  it('falls back to shadow on a typo rather than serving to visitors', () => {
    for (const v of ['shdow', 'true', '1', 'enabled', 'yes', 'shadow-mode']) {
      setFlag(v);
      expect(mode(), `for ${JSON.stringify(v)}`).toBe('shadow');
    }
  });

  it('never resolves to "on" for any unrecognised value', () => {
    for (const v of ['', ' ', 'onn', 'no', 'off ;', 'ON=1']) {
      setFlag(v);
      expect(mode()).not.toBe('on');
    }
  });
});

describe('SSG_LANDING mode — warning noise', () => {
  it('warns once per distinct bad value, not once per request', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      setFlag('shdow');
      mode();
      mode();
      mode();
      expect(warn).toHaveBeenCalledTimes(1);

      setFlag('alsobad');
      mode();
      expect(warn).toHaveBeenCalledTimes(2);
    } finally {
      warn.mockRestore();
    }
  });

  it('does not warn for unset, which is a legitimate default', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      setFlag(undefined);
      mode();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mode, modeFor } from '../src/routes/landing.routes';

const original = process.env.SSG_LANDING;
const originalCodes = process.env.SSG_LANDING_CODES;

function setFlag(value: string | undefined) {
  if (value === undefined) delete process.env.SSG_LANDING;
  else process.env.SSG_LANDING = value;
}

function setCodes(value: string | undefined) {
  if (value === undefined) delete process.env.SSG_LANDING_CODES;
  else process.env.SSG_LANDING_CODES = value;
}

beforeEach(() => {
  setFlag(undefined);
  setCodes(undefined);
});
afterEach(() => {
  setFlag(original);
  setCodes(originalCodes);
});

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

describe('SSG_LANDING_CODES — per-link rollout', () => {
  it('serves a listed code while everything else stays in shadow', () => {
    setCodes('LIEN-2');
    expect(modeFor('LIEN-2')).toBe('on');
    expect(modeFor('C0F3C82F')).toBe('shadow');
  });

  it('accepts a comma- or whitespace-separated list', () => {
    for (const list of ['LIEN-2,C0F3C82F', 'LIEN-2 C0F3C82F', 'LIEN-2,  C0F3C82F', 'LIEN-2\nC0F3C82F']) {
      setCodes(list);
      expect(modeFor('LIEN-2'), `for ${JSON.stringify(list)}`).toBe('on');
      expect(modeFor('C0F3C82F'), `for ${JSON.stringify(list)}`).toBe('on');
    }
  });

  it('matches case-sensitively', () => {
    // Miel and miel are both live codes on this instance. Folding case would
    // switch on a page nobody named.
    setCodes('Miel');
    expect(modeFor('Miel')).toBe('on');
    expect(modeFor('miel')).toBe('shadow');
  });

  it('cannot override the kill switch', () => {
    // The one guarantee `off` has to make is that nothing is serving compiled
    // HTML. An allow-list that outranked it would be useless in the incident it
    // exists for.
    setFlag('off');
    setCodes('LIEN-2');
    expect(modeFor('LIEN-2')).toBe('off');
  });

  it('does not narrow a global "on"', () => {
    setFlag('on');
    setCodes('LIEN-2');
    expect(modeFor('anything-else')).toBe('on');
  });

  it('ignores an empty or unset list', () => {
    for (const list of [undefined, '', '   ', ',', ' , , ']) {
      setCodes(list);
      expect(modeFor('LIEN-2'), `for ${JSON.stringify(list)}`).toBe('shadow');
    }
  });

  it('picks up a list edited after the first read', () => {
    // The parse is memoised on the raw string, so a stale cache would pin the
    // first value a process ever saw and make a pm2 restart look like a no-op.
    setCodes('LIEN-2');
    expect(modeFor('LIEN-2')).toBe('on');
    setCodes('C0F3C82F');
    expect(modeFor('LIEN-2')).toBe('shadow');
    expect(modeFor('C0F3C82F')).toBe('on');
  });
});

import { describe, it, expect } from 'vitest';
import { BLOCKS, BLOCK_TYPES, getBlock, defaultsFor, compiledTypes } from '../src/shared/blocks/index.js';
import { supportedTypes } from '../src/services/landingCompiler/blocks/index.js';
import { KNOWN_BLOCK_TYPES } from '../src/validations/landingPage.validation.js';

/**
 * The registry is only worth having if nothing can drift from it. These tests
 * are the tripwires: a block whose defaults its own schema rejects, a compiler
 * renderer for a type the registry does not know, a `compiled` flag that lies,
 * a validator list that disagrees. Each of those was a real failure mode when
 * the five copies lived apart.
 */
describe('block registry', () => {
  it('has a unique, non-empty type on every block', () => {
    const types = BLOCKS.map((b) => b.type);
    expect(types.every((t) => /^[a-z][a-z0-9_]*$/.test(t))).toBe(true);
    expect(new Set(types).size).toBe(types.length);
    expect(BLOCK_TYPES).toEqual(types);
  });

  it('validates every block\'s defaults against its own schema', () => {
    for (const block of BLOCKS) {
      const result = block.schema.safeParse(block.defaults);
      expect(result.success, `${block.type}: ${!result.success ? result.error.message : ''}`).toBe(true);
    }
  });

  it('accepts an empty object for every block, since legacy rows carry nothing', () => {
    for (const block of BLOCKS) {
      expect(block.schema.safeParse({}).success, block.type).toBe(true);
    }
  });

  it('passes unknown keys through rather than rejecting a legacy row', () => {
    for (const block of BLOCKS) {
      const parsed = block.schema.safeParse({ ...block.defaults, __legacyKey: 1 });
      expect(parsed.success, block.type).toBe(true);
      expect((parsed.success ? parsed.data : {}).__legacyKey).toBe(1);
    }
  });

  it('only lists inspector fields that exist in the schema', () => {
    for (const block of BLOCKS) {
      const shape = (block.schema as any)._def?.shape?.() ?? (block.schema as any).shape ?? {};
      const known = new Set(Object.keys(shape));
      for (const group of block.inspector.groups) {
        for (const field of group.fields) {
          expect(known.has(field), `${block.type}.${field} is in the inspector but not the schema`).toBe(true);
        }
      }
    }
  });

  it('gives every preset a shape the schema accepts', () => {
    for (const block of BLOCKS) {
      for (const [name, preset] of Object.entries(block.presets ?? {})) {
        const merged = { ...(block.defaults as object), ...(preset as object) };
        expect(block.schema.safeParse(merged).success, `${block.type} preset ${name}`).toBe(true);
      }
    }
  });

  it('returns a fresh copy of defaults on every call', () => {
    const a = defaultsFor('site_header') as any;
    const b = defaultsFor('site_header') as any;
    expect(a).toEqual(b);
    expect(a.links).not.toBe(b.links);
    expect(defaultsFor('no_such_block')).toEqual({});
  });

  it('labels every block in French and English', () => {
    for (const block of BLOCKS) {
      expect(block.meta.label.fr.length, block.type).toBeGreaterThan(0);
      expect(block.meta.label.en.length, block.type).toBeGreaterThan(0);
      expect(block.meta.description.fr.length, block.type).toBeGreaterThan(0);
    }
  });
});

describe('registry versus the compiler', () => {
  it('knows every type the compiler can render', () => {
    for (const type of supportedTypes()) {
      expect(getBlock(type), `compiler renders "${type}" but the registry has no definition`).toBeDefined();
    }
  });

  it('marks a block compiled exactly when the compiler has a renderer for it', () => {
    const compiler = supportedTypes();
    for (const block of BLOCKS) {
      expect(block.compiled, `${block.type}.compiled disagrees with the compiler registry`).toBe(
        compiler.has(block.type)
      );
    }
    expect([...compiledTypes()].sort()).toEqual([...compiler].sort());
  });
});

describe('registry versus the validator', () => {
  it('is the source of the validator\'s type list', () => {
    expect([...KNOWN_BLOCK_TYPES].sort()).toEqual([...BLOCK_TYPES].sort());
  });
});

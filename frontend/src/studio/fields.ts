import { getBlock } from '@shared/blocks/index.js';

/**
 * What kind of control a block prop wants, read off its zod schema.
 *
 * The inspector is generated, not hand-written: the registry says which fields
 * a block has and how they group, and this file says what each one looks
 * like. A new block gets an inspector for free; a new field on an old block
 * appears the moment it is in the schema.
 */

export type FieldKind =
  | { kind: 'text' }
  | { kind: 'textarea' }
  | { kind: 'number' }
  | { kind: 'boolean' }
  | { kind: 'color' }
  | { kind: 'select'; options: string[] }
  | { kind: 'json' };

const LONG_TEXT = new Set([
  'text', 'subtitle', 'description', 'about', 'welcomeMessage', 'preSetMessage',
  'announcementText', 'longDescription', 'note',
]);

function unwrap(schema: any): any {
  let s = schema;
  for (let i = 0; i < 6 && s?._def; i++) {
    const t = s._def.typeName;
    if (t === 'ZodOptional' || t === 'ZodNullable' || t === 'ZodDefault') s = s._def.innerType;
    else break;
  }
  return s;
}

export function looksLikeColor(key: string): boolean {
  return /color$|^color$|bg$|^bg|Bg$|background/i.test(key);
}

export function fieldKind(blockType: string, key: string): FieldKind {
  const def = getBlock(blockType);
  const shape = (def?.schema as any)?._def?.shape?.() ?? (def?.schema as any)?.shape ?? {};
  const schema = unwrap(shape[key]);
  const t = schema?._def?.typeName;

  if (t === 'ZodEnum') return { kind: 'select', options: schema._def.values as string[] };
  if (t === 'ZodBoolean') return { kind: 'boolean' };
  if (t === 'ZodNumber') return { kind: 'number' };
  if (t === 'ZodString') {
    if (looksLikeColor(key)) return { kind: 'color' };
    return LONG_TEXT.has(key) ? { kind: 'textarea' } : { kind: 'text' };
  }
  if (t === 'ZodUnion') {
    // number | string unions (prices) edit as text; everything else as JSON.
    const members = (schema._def.options as any[]).map((o) => unwrap(o)?._def?.typeName);
    if (members.every((m) => m === 'ZodNumber' || m === 'ZodString')) return { kind: 'text' };
  }
  return { kind: 'json' };
}

/** The label the inspector shows for a key, until the registry carries one. */
export function fieldLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

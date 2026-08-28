import { z } from 'zod';

/**
 * Shape checks for the landing-page save route.
 *
 * `PUT /links/:id/landing-page` has always destructured `req.body` and handed it
 * straight to Prisma — no schema, no type check, no size limit beyond the 10 MB
 * body cap. That was survivable while React was the only consumer, because React
 * escapes whatever it renders. Once the compiler turns this JSON into HTML
 * source, unvalidated input becomes the input to a code generator.
 *
 * This is deliberately a *shape* guard, not a sanitiser. Escaping happens at
 * output time in services/landingCompiler/escape.ts, where the destination
 * context is known. Validating here as well is defence in depth: it bounds the
 * work the compiler can be asked to do, and it closes the `block.id` injection
 * that reaches a <style> element in the current React renderer.
 */

/** Every type BlockRenderer knows. Unknown types are rejected outright. */
export const KNOWN_BLOCK_TYPES = [
  'header',
  'hero',
  'image',
  'text',
  'button',
  'express_checkout',
  'spacer',
  'countdown',
  'whatsapp',
  'slider',
  'products',
  'audio',
  'video',
] as const;

const MAX_BLOCKS = 200;
const MAX_SERIALISED_BYTES = 512 * 1024;
const MAX_DEPTH = 8;

/**
 * `block.id` is interpolated into `@keyframes marquee-${id}` by SliderBlock
 * (BlockRenderer.tsx:844) and injected with dangerouslySetInnerHTML. Constraining
 * it to an identifier closes that today, independently of the compiler.
 */
const blockIdPattern = /^[A-Za-z0-9_-]{1,64}$/;

function depthOf(value: unknown, depth = 0): number {
  if (depth > MAX_DEPTH) return depth;
  if (Array.isArray(value)) {
    return value.reduce<number>((max, v) => Math.max(max, depthOf(v, depth + 1)), depth);
  }
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).reduce<number>(
      (max, v) => Math.max(max, depthOf(v, depth + 1)),
      depth
    );
  }
  return depth;
}

const blockSchema = z.object({
  id: z.string().regex(blockIdPattern, 'block id must be letters, digits, dash or underscore'),
  type: z.enum(KNOWN_BLOCK_TYPES),
  content: z.record(z.unknown()).optional(),
});

/** Both shapes are in the wild: a bare array (legacy) and { blocks, settings }. */
const structureSchema = z
  .union([
    z.array(blockSchema),
    z.object({
      blocks: z.array(blockSchema),
      settings: z.record(z.unknown()).optional(),
    }).passthrough(),
  ])
  .superRefine((value, ctx) => {
    const blocks = Array.isArray(value) ? value : value.blocks;

    if (blocks.length > MAX_BLOCKS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `a landing page may not have more than ${MAX_BLOCKS} blocks`,
      });
    }

    const bytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
    if (bytes > MAX_SERIALISED_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `landing page structure is ${Math.round(bytes / 1024)} KB, over the ${
          MAX_SERIALISED_BYTES / 1024
        } KB limit`,
      });
    }

    // Bounds recursion in the compiler and in anything else that walks this JSON.
    if (depthOf(value) > MAX_DEPTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `landing page structure is nested deeper than ${MAX_DEPTH} levels`,
      });
    }

    const seen = new Set<string>();
    for (const block of blocks) {
      if (seen.has(block.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate block id "${block.id}"`,
        });
        break;
      }
      seen.add(block.id);
    }
  });

/**
 * Block types that make no sense after the order is already placed.
 *
 * `express_checkout` would render a second, live order form on the thank-you
 * page. Its absence also matters to two other blocks: a button with
 * `behavior: 'checkout'` and a products card both scroll to the DOM id
 * `#express-checkout-block` (BlockRenderer.tsx:264, :436), so on a page without
 * one they are silent no-ops. Rejecting it at save time is clearer than
 * rendering something broken.
 *
 * `products` is deliberately NOT blocked — an upsell after purchase is a real
 * use case, and its cards link out rather than requiring a local checkout.
 */
const THANKYOU_DISALLOWED_TYPES = new Set(['express_checkout']);

const thankYouStructureSchema = structureSchema.superRefine((value, ctx) => {
  const blocks = Array.isArray(value) ? value : value?.blocks;
  if (!Array.isArray(blocks)) return;
  for (const block of blocks) {
    const type = (block as any)?.type;
    if (typeof type === 'string' && THANKYOU_DISALLOWED_TYPES.has(type)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `a thank-you page cannot contain a "${type}" block`,
      });
    }
  }
});

export const landingPageUpdateSchema = z.object({
  // Constrained because it reaches a <style> block, where there is no attribute
  // boundary to escape. The compiler re-checks with an allow-list at output.
  themeColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{3,8}$/, 'themeColor must be a hex colour')
    .optional(),
  title: z.string().max(300).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  buttonText: z.string().max(120).optional(),
  customStructure: structureSchema.optional().nullable(),
  // Same schema, so the thank-you page gets the identical block guards: the id
  // pattern, the type enum, the block cap, the depth limit and its own 512 KB
  // budget. This is the reason it is a sibling column rather than a key inside
  // customStructure — nested under `settings` it would have inherited
  // `z.record(z.unknown())` and been validated by nothing at all.
  thankYouStructure: thankYouStructureSchema.optional().nullable(),
});

export type LandingPageUpdate = z.infer<typeof landingPageUpdateSchema>;

/**
 * Returns the first human-readable problem, or null.
 *
 * Kept as a plain function rather than middleware so the route can validate
 * after its authorisation checks — a caller who is not allowed to touch the link
 * should get 403, not a schema complaint that confirms the link exists.
 */
export function validateLandingPageUpdate(body: unknown): string | null {
  const result = landingPageUpdateSchema.safeParse(body);
  if (result.success) return null;

  const issue = result.error.issues[0];
  const path = issue.path.length ? `${issue.path.join('.')}: ` : '';
  return `${path}${issue.message}`;
}

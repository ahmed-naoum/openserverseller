import type { AnyNode, PageDocument } from '../../shared/document/types.js';
import { BIND_EXPRESSION } from '../../shared/document/ops.js';

/**
 * Data bindings, resolved at compile time.
 *
 * A block on a store page says what it needs — `{ product: '$page.product' }`,
 * `{ items: '$catalogue' }`, `{ items: '$collection(summer)' }` — and this
 * resolves each expression against the request and writes the result into
 * the block's props, so the renderer sees plain data. The stored document
 * keeps the expression; a product page is one template compiled once per
 * product.
 *
 * The grammar is the one `applyOps` enforces (BIND_EXPRESSION), so anything
 * that reaches here was accepted on save. An expression this file does not
 * know resolves to nothing rather than failing the page.
 */

export interface BindingContext {
  /** The product of a `/p/:slug` page. */
  product?: any | null;
  /** The collection of a `/collections/:slug` page. */
  collection?: { slug: string } | null;
  /** Products for a catalogue expression; the caller decides limits. */
  catalogue: (opts: { collectionSlug?: string; limit?: number }) => Promise<any[]>;
  /** Injected into every bound product so the cart runtime can key storage. */
  storeId: number;
}

/** Product objects in the shape both the products runtime and the detail block read. */
export function normaliseProduct(p: any, storeId: number): any {
  if (!p || typeof p !== 'object') return p;
  const images = Array.isArray(p.images)
    ? p.images.map((i: any) => ({ ...i, url: i?.url ?? i?.imageUrl ?? null, imageUrl: i?.imageUrl ?? i?.url ?? null }))
    : [];
  return { ...p, images, storeId, href: p.ref ? `/p/${encodeURIComponent(p.ref)}` : `/p/${p.id}` };
}

async function evaluate(expression: string, ctx: BindingContext): Promise<unknown> {
  if (!BIND_EXPRESSION.test(expression)) return undefined;
  const m = expression.match(/^\$([a-zA-Z.]+)(?:\(([A-Za-z0-9_-]+)\))?$/);
  if (!m) return undefined;
  const name = m[1];
  const arg = m[2];

  switch (name) {
    case 'page.product':
      return ctx.product ? normaliseProduct(ctx.product, ctx.storeId) : null;
    case 'catalogue':
      return (await ctx.catalogue({ limit: 24 })).map((p) => normaliseProduct(p, ctx.storeId));
    case 'collection': {
      const slug = arg ?? ctx.collection?.slug;
      if (!slug) return [];
      return (await ctx.catalogue({ collectionSlug: slug, limit: 48 })).map((p) => normaliseProduct(p, ctx.storeId));
    }
    case 'page.collection':
      // On /collections/:slug this is that collection; on /products, the
      // page has no collection and the whole catalogue is what it shows.
      return (await ctx.catalogue({ collectionSlug: ctx.collection?.slug, limit: 48 })).map((p) => normaliseProduct(p, ctx.storeId));
    default:
      return undefined;
  }
}

/** A copy of the document with every bound prop filled. */
export async function resolveBindings(doc: PageDocument, ctx: BindingContext): Promise<PageDocument> {
  const visit = async (node: AnyNode): Promise<AnyNode> => {
    if (node.type === 'block') {
      if (!node.bind || !Object.keys(node.bind).length) return { ...node, props: { ...node.props, storeId: ctx.storeId } };
      const props: Record<string, unknown> = { ...node.props, storeId: ctx.storeId };
      for (const [prop, expression] of Object.entries(node.bind)) {
        props[prop] = await evaluate(expression, ctx);
      }
      return { ...node, props };
    }
    const children = await Promise.all(node.children.map(visit));
    return { ...node, children } as AnyNode;
  };
  const root = await Promise.all(doc.root.map(visit));
  return { ...doc, root: root as PageDocument['root'] };
}

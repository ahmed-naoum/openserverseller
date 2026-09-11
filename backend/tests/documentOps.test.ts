import { describe, it, expect } from 'vitest';
import {
  applyOps,
  validateDocument,
  fromLegacy,
  toLegacy,
  roundTrips,
  ensureDocument,
  outlineText,
  outlineTree,
  blocks,
  nodeCount,
  MAX_NODES,
  MAX_DEPTH,
  type Op,
  type PageDocument,
} from '../src/shared/document/index.js';

/**
 * The command layer is the door every editor and every agent goes through, so
 * these tests are about the door: what it lets in, what it refuses, and that
 * every applied op can be undone by the inverse it hands back.
 */

const legacyPage = [
  { id: 'h1', type: 'hero', content: { title: 'Offre Spéciale !', subtitle: 'Découvrez.' } },
  { id: 'i1', type: 'image', content: { url: '/uploads/a.jpg' } },
  { id: 'c1', type: 'express_checkout', content: { title: 'اطلب الآن', options: [{ id: 'p1', name: 'Pack 1', price: 199 }] } },
];

function page(): PageDocument {
  return fromLegacy(legacyPage);
}

function idsOf(doc: PageDocument): string[] {
  return blocks(doc).map((b) => b.node.id);
}

/** Apply, assert it landed, undo through the inverse, assert we are back. */
function roundTrip(doc: PageDocument, ops: Op[]): PageDocument {
  const forward = applyOps(doc, ops);
  expect(forward.refused, JSON.stringify(forward.refused)).toEqual([]);
  expect(forward.applied).toBe(ops.length);
  const back = applyOps(forward.doc, forward.inverse);
  expect(back.refused).toEqual([]);
  expect(back.doc).toEqual(doc);
  return forward.doc;
}

describe('migration between the flat page and the tree', () => {
  it('wraps a bare array in one implicit section, in order', () => {
    const doc = page();
    expect(doc.version).toBe(3);
    expect(doc.root).toHaveLength(1);
    expect(doc.root[0].implicit).toBe(true);
    expect(idsOf(doc)).toEqual(['h1', 'i1', 'c1']);
    expect(blocks(doc)[2].node.block).toBe('express_checkout');
  });

  it('carries { blocks, settings } settings across', () => {
    const doc = fromLegacy({ blocks: legacyPage, settings: { pageBgColor: '#fff', pageMaxWidth: 700 } });
    expect(doc.settings).toEqual({ pageBgColor: '#fff', pageMaxWidth: 700 });
  });

  it('round-trips back to the flat shape with nothing lost', () => {
    const doc = fromLegacy({ blocks: legacyPage, settings: { a: 1 } });
    expect(roundTrips(doc)).toBe(true);
    expect(toLegacy(doc)).toEqual({ blocks: legacyPage, settings: { a: 1 } });
  });

  it('does not share objects with the caller', () => {
    const source = JSON.parse(JSON.stringify(legacyPage));
    const doc = fromLegacy(source);
    (blocks(doc)[0].node.props as any).title = 'changed';
    expect(source[0].content.title).toBe('Offre Spéciale !');
  });

  it('stops round-tripping once the tree has structure the flat shape cannot hold', () => {
    const doc = page();
    const styled = applyOps(doc, [{ op: 'set', nodeId: 'page', path: 'style.paddingTop', value: 24 }]).doc;
    expect(roundTrips(styled)).toBe(false);
    expect(toLegacy(styled)).toBeNull();
    // and the section is no longer implicit: it now has markup to carry the style
    expect(styled.root[0].implicit).toBeUndefined();
  });

  it('accepts either shape through ensureDocument', () => {
    expect(ensureDocument(legacyPage).root[0].implicit).toBe(true);
    const doc = page();
    expect(ensureDocument(doc)).toBe(doc);
    expect(ensureDocument(null).root).toEqual([]);
  });

  it('produces a document that validates', () => {
    expect(validateDocument(page())).toEqual([]);
  });
});

describe('insert', () => {
  it('adds a block with schema-checked props and undoes cleanly', () => {
    const doc = page();
    const next = roundTrip(doc, [
      { op: 'insert', parentId: 'page', index: 1, node: { id: 'b2', type: 'block', block: 'button', props: { text: 'Go' } } },
    ]);
    expect(idsOf(next)).toEqual(['h1', 'b2', 'i1', 'c1']);
  });

  it('refuses an unknown block type', () => {
    const r = applyOps(page(), [
      { op: 'insert', parentId: 'page', index: 0, node: { id: 'x', type: 'block', block: 'raw_html', props: {} } },
    ]);
    expect(r.applied).toBe(0);
    expect(r.refused[0].reason).toMatch(/unknown block type "raw_html"/);
  });

  it('refuses props the block schema rejects', () => {
    const r = applyOps(page(), [
      { op: 'insert', parentId: 'page', index: 0, node: { id: 'x', type: 'block', block: 'hero', props: { paddingTop: 'lots' } } },
    ]);
    expect(r.refused[0].reason).toMatch(/hero "x": paddingTop/);
  });

  it('refuses a section anywhere but the root, and a block at the root', () => {
    const inSection = applyOps(page(), [
      { op: 'insert', parentId: 'page', index: 0, node: { id: 's2', type: 'section', children: [] } },
    ]);
    expect(inSection.refused[0].reason).toMatch(/section cannot sit inside a section/);

    const atRoot = applyOps(page(), [
      { op: 'insert', parentId: null, index: 0, node: { id: 'b9', type: 'block', block: 'spacer', props: {} } },
    ]);
    expect(atRoot.refused[0].reason).toMatch(/only a section can sit at the root/);
  });

  it('refuses duplicate and malformed ids', () => {
    const dup = applyOps(page(), [
      { op: 'insert', parentId: 'page', index: 0, node: { id: 'h1', type: 'block', block: 'spacer', props: {} } },
    ]);
    expect(dup.refused[0].reason).toMatch(/duplicate node id "h1"/);

    const bad = applyOps(page(), [
      { op: 'insert', parentId: 'page', index: 0, node: { id: 'not ok!', type: 'block', block: 'spacer', props: {} } },
    ]);
    expect(bad.refused[0].reason).toMatch(/invalid node id/);
  });

  it('refuses a block as a parent', () => {
    const r = applyOps(page(), [
      { op: 'insert', parentId: 'h1', index: 0, node: { id: 'x', type: 'block', block: 'spacer', props: {} } },
    ]);
    expect(r.refused[0].reason).toMatch(/is a block and cannot hold children/);
  });

  it('validates a whole subtree, not just its root', () => {
    const r = applyOps(page(), [
      {
        op: 'insert',
        parentId: 'page',
        index: 0,
        node: {
          id: 'l1',
          type: 'layout',
          layout: 'row',
          children: [{ id: 'deep', type: 'block', block: 'nope', props: {} }],
        },
      },
    ]);
    expect(r.refused[0].reason).toMatch(/unknown block type "nope"/);
  });

  it('clamps an out-of-range index instead of refusing', () => {
    const next = roundTrip(page(), [
      { op: 'insert', parentId: 'page', index: 99, node: { id: 'end', type: 'block', block: 'spacer', props: {} } },
    ]);
    expect(idsOf(next).at(-1)).toBe('end');
  });
});

describe('move', () => {
  it('uses the index after removal, so the inverse is a move back to the original index', () => {
    const doc = page();
    const next = roundTrip(doc, [{ op: 'move', nodeId: 'h1', parentId: 'page', index: 2 }]);
    expect(idsOf(next)).toEqual(['i1', 'c1', 'h1']);
  });

  it('moves into a layout and back', () => {
    const doc = applyOps(page(), [
      { op: 'insert', parentId: 'page', index: 0, node: { id: 'l1', type: 'layout', layout: 'row', columns: [6, 6], children: [] } },
    ]).doc;
    const next = roundTrip(doc, [{ op: 'move', nodeId: 'i1', parentId: 'l1', index: 0 }]);
    expect(outlineText(next)).toContain('layout#l1 row [6,6]\n    block#i1 image');
  });

  it('refuses moving a node into its own descendant', () => {
    const doc = applyOps(page(), [
      {
        op: 'insert',
        parentId: 'page',
        index: 0,
        node: { id: 'outer', type: 'layout', layout: 'row', children: [{ id: 'inner', type: 'layout', layout: 'row', children: [] }] },
      },
    ]).doc;
    const r = applyOps(doc, [{ op: 'move', nodeId: 'outer', parentId: 'inner', index: 0 }]);
    expect(r.refused[0].reason).toMatch(/into its own descendant/);
  });

  it('refuses a locked node', () => {
    const doc = applyOps(page(), [{ op: 'set', nodeId: 'h1', path: 'locked', value: true }]).doc;
    expect(applyOps(doc, [{ op: 'move', nodeId: 'h1', parentId: 'page', index: 2 }]).refused[0].reason).toMatch(/locked/);
    expect(applyOps(doc, [{ op: 'remove', nodeId: 'h1' }]).refused[0].reason).toMatch(/locked/);
  });
});

describe('remove and duplicate', () => {
  it('removes a subtree and reinserts it at the same place on undo', () => {
    const next = roundTrip(page(), [{ op: 'remove', nodeId: 'i1' }]);
    expect(idsOf(next)).toEqual(['h1', 'c1']);
  });

  it('duplicates beside the original with fresh ids and undoes', () => {
    const next = roundTrip(page(), [{ op: 'duplicate', nodeId: 'h1', idFor: { h1: 'h1-copy' } }]);
    expect(idsOf(next)).toEqual(['h1', 'h1-copy', 'i1', 'c1']);
    expect(blocks(next)[1].node.props).toEqual(blocks(next)[0].node.props);
  });

  it('generates ids when none are given, and they are unique', () => {
    let n = 0;
    const r = applyOps(page(), [{ op: 'duplicate', nodeId: 'h1' }], { newId: () => `gen${++n}` });
    expect(idsOf(r.doc)).toEqual(['h1', 'gen1', 'i1', 'c1']);
    expect(validateDocument(r.doc)).toEqual([]);
  });
});

describe('set', () => {
  it('writes a prop, re-validates the block, and undoes to the previous value', () => {
    const doc = page();
    const next = roundTrip(doc, [{ op: 'set', nodeId: 'h1', path: 'props.title', value: 'Nouveau' }]);
    expect((blocks(next)[0].node.props as any).title).toBe('Nouveau');
  });

  it('refuses a value the schema rejects', () => {
    const r = applyOps(page(), [{ op: 'set', nodeId: 'h1', path: 'props.paddingTop', value: 'big' }]);
    expect(r.refused[0].reason).toMatch(/paddingTop/);
  });

  it('reaches into arrays inside props', () => {
    const next = roundTrip(page(), [{ op: 'set', nodeId: 'c1', path: 'props.options.0.price', value: 249 }]);
    expect(((blocks(next)[2].node.props as any).options[0]).price).toBe(249);
  });

  it('deletes a field when the value is undefined, and restores it on undo', () => {
    const doc = page();
    const r = applyOps(doc, [{ op: 'set', nodeId: 'h1', path: 'props.subtitle', value: undefined }]);
    expect((blocks(r.doc)[0].node.props as any).subtitle).toBeUndefined();
    const back = applyOps(r.doc, r.inverse);
    expect(back.doc).toEqual(doc);
  });

  it('writes shared style and responsive overrides on any node', () => {
    const next = roundTrip(page(), [
      { op: 'set', nodeId: 'i1', path: 'style.marginTop', value: 12 },
      { op: 'set', nodeId: 'i1', path: 'responsive.md.hidden', value: true },
    ]);
    const img = blocks(next)[1].node;
    expect(img.style?.marginTop).toBe(12);
    expect(img.responsive?.md?.hidden).toBe(true);
  });

  it('refuses fields a node type does not have', () => {
    expect(applyOps(page(), [{ op: 'set', nodeId: 'h1', path: 'columns', value: [6, 6] }]).refused[0].reason).toMatch(/not a field of a block/);
    expect(applyOps(page(), [{ op: 'set', nodeId: 'h1', path: 'responsive.xl.hidden', value: true }]).refused[0].reason).toMatch(/"md" or "sm"/);
    expect(applyOps(page(), [{ op: 'set', nodeId: 'h1', path: 'block', value: 'image' }]).refused[0].reason).toMatch(/not a field/);
  });

  it('checks layout columns are whole twelfths', () => {
    const doc = applyOps(page(), [
      { op: 'insert', parentId: 'page', index: 0, node: { id: 'l1', type: 'layout', layout: 'row', children: [] } },
    ]).doc;
    expect(applyOps(doc, [{ op: 'set', nodeId: 'l1', path: 'columns', value: [7, 5] }]).refused).toEqual([]);
    expect(applyOps(doc, [{ op: 'set', nodeId: 'l1', path: 'columns', value: [7.5, 4.5] }]).refused[0].reason).toMatch(/twelfths/);
  });
});

describe('bind', () => {
  it('binds a declared prop to a well-formed expression and undoes', () => {
    const next = roundTrip(page(), [{ op: 'bind', nodeId: 'c1', prop: 'product', expression: '$page.product' }]);
    expect(blocks(next)[2].node.bind).toEqual({ product: '$page.product' });
    expect(outlineText(next)).toContain('⇐ product=$page.product');
  });

  it('refuses a prop the block does not declare, and a malformed expression', () => {
    expect(applyOps(page(), [{ op: 'bind', nodeId: 'c1', prop: 'title', expression: '$page.product' }]).refused[0].reason).toMatch(/no bindable prop "title"/);
    expect(applyOps(page(), [{ op: 'bind', nodeId: 'c1', prop: 'product', expression: 'alert(1)' }]).refused[0].reason).toMatch(/not a valid expression/);
    expect(applyOps(page(), [{ op: 'bind', nodeId: 'h1', prop: 'x', expression: '$a' }]).refused[0].reason).toMatch(/no bindable prop/);
  });
});

describe('wrap', () => {
  it('puts contiguous siblings into a row and undoes back to the flat list', () => {
    const next = roundTrip(page(), [{ op: 'wrap', nodeIds: ['h1', 'i1'], wrapperId: 'row1', layout: 'row', columns: [6, 6] }]);
    expect(outlineText(next)).toBe(
      ['section#page (implicit)', '  layout#row1 row [6,6]', '    block#h1 hero "Offre Spéciale !"', '    block#i1 image "/uploads/a.jpg"', '  block#c1 express_checkout "اطلب الآن"'].join('\n')
    );
  });

  it('refuses non-contiguous or differently parented nodes', () => {
    expect(applyOps(page(), [{ op: 'wrap', nodeIds: ['h1', 'c1'], wrapperId: 'w', layout: 'row' }]).refused[0].reason).toMatch(/contiguous/);
    expect(applyOps(page(), [{ op: 'wrap', nodeIds: ['page'], wrapperId: 'w', layout: 'row' }]).refused[0].reason).toMatch(/cannot be wrapped/);
  });
});

describe('presets, page settings, rename', () => {
  it('expands a preset into sets and undoes them', () => {
    const doc = applyOps(page(), [
      { op: 'insert', parentId: 'page', index: 0, node: { id: 'sh', type: 'block', block: 'site_header', props: { brandText: 'X', showCart: true } } },
    ]).doc;
    const next = roundTrip(doc, [{ op: 'applyPreset', nodeId: 'sh', preset: 'minimal' }]);
    const props = blocks(next)[0].node.props as any;
    expect(props.showCart).toBe(false);
    expect(props.announcementActive).toBe(false);
    expect(applyOps(doc, [{ op: 'applyPreset', nodeId: 'sh', preset: 'nope' }]).refused[0].reason).toMatch(/no preset "nope"/);
  });

  it('sets page settings and kind, refusing unknown kinds', () => {
    const next = roundTrip(page(), [
      { op: 'setPage', path: 'settings.maxWidth', value: 900 },
      { op: 'setPage', path: 'kind', value: 'product' },
    ]);
    expect(next.settings.maxWidth).toBe(900);
    expect(next.kind).toBe('product');
    expect(applyOps(page(), [{ op: 'setPage', path: 'kind', value: 'blog' }]).refused[0].reason).toMatch(/unknown page kind/);
    expect(applyOps(page(), [{ op: 'setPage', path: 'root', value: [] }]).refused[0].reason).toMatch(/not a page field/);
  });

  it('renames a node for the layers panel and the agent, and undoes', () => {
    const next = roundTrip(page(), [{ op: 'rename', nodeId: 'h1', label: 'Hero' }]);
    expect(outlineTree(next)[0].children?.[0].label).toBe('Hero');
  });
});

describe('batches and limits', () => {
  it('is atomic by default: one bad op and nothing lands', () => {
    const doc = page();
    const r = applyOps(doc, [
      { op: 'set', nodeId: 'h1', path: 'props.title', value: 'A' },
      { op: 'set', nodeId: 'zzz', path: 'props.title', value: 'B' },
    ]);
    expect(r.applied).toBe(0);
    expect(r.doc).toBe(doc);
    expect(r.refused).toHaveLength(1);
    expect(r.refused[0].index).toBe(1);
  });

  it('applies what it can when asked to be lenient, and the inverse still restores', () => {
    const doc = page();
    const r = applyOps(
      doc,
      [
        { op: 'set', nodeId: 'h1', path: 'props.title', value: 'A' },
        { op: 'set', nodeId: 'zzz', path: 'props.title', value: 'B' },
        { op: 'remove', nodeId: 'i1' },
      ],
      { atomic: false }
    );
    expect(r.applied).toBe(2);
    expect(r.refused).toHaveLength(1);
    expect(idsOf(r.doc)).toEqual(['h1', 'c1']);
    expect(applyOps(r.doc, r.inverse).doc).toEqual(doc);
  });

  it('refuses a page over the node limit', () => {
    const doc = page();
    const many: Op[] = Array.from({ length: MAX_NODES }, (_, i) => ({
      op: 'insert',
      parentId: 'page',
      index: 0,
      node: { id: `sp${i}`, type: 'block', block: 'spacer', props: {} },
    }));
    const r = applyOps(doc, many);
    expect(r.applied).toBe(0);
    expect(r.refused.at(-1)?.reason).toMatch(/over the 400 limit/);
    // and just under it is fine
    expect(applyOps(doc, many.slice(0, MAX_NODES - nodeCount(doc))).refused).toEqual([]);
  });

  it('refuses nesting past the depth limit', () => {
    let node: any = { id: 'leaf', type: 'block', block: 'spacer', props: {} };
    for (let i = 0; i < MAX_DEPTH; i++) node = { id: `l${i}`, type: 'layout', layout: 'row', children: [node] };
    const r = applyOps(page(), [{ op: 'insert', parentId: 'page', index: 0, node }]);
    expect(r.refused[0].reason).toMatch(/deeper than 5/);
  });

  it('never mutates the input document', () => {
    const doc = page();
    const snapshot = JSON.stringify(doc);
    applyOps(doc, [{ op: 'remove', nodeId: 'h1' }, { op: 'set', nodeId: 'i1', path: 'props.alt', value: 'x' }]);
    expect(JSON.stringify(doc)).toBe(snapshot);
  });

  it('refuses an unknown op without throwing', () => {
    const r = applyOps(page(), [{ op: 'explode' } as any]);
    expect(r.refused[0].reason).toMatch(/unknown op "explode"/);
  });
});

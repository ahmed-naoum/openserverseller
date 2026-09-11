import { describe, it, expect } from 'vitest';
import { renderDocument } from '../src/services/landingCompiler/document.js';
import { validateLandingPageUpdate } from '../src/validations/landingPage.validation.js';
import { fromLegacy, applyOps, flatBlocks, type PageDocument } from '../src/shared/document/index.js';

/**
 * The tree lands underneath every live page on one promise: a page that is
 * still flat underneath compiles to exactly the bytes it compiled to before.
 * These tests hold the compiler to that, and then check that real structure
 * — a styled section, a row of columns, a phone-only override — produces the
 * wrappers and the rules it should.
 */

const legacy = {
  blocks: [
    { id: 'h1', type: 'hero', content: { title: 'Offre', subtitle: 'Sous-titre', bgColor: '#ffffff' } },
    { id: 'i1', type: 'image', content: { url: '/uploads/x.jpg', alt: 'x' } },
    { id: 'c1', type: 'express_checkout', content: { title: 'اطلب', options: [{ id: 'p1', name: 'Pack', price: 199 }] } },
  ],
  settings: { maxWidth: 640 },
};

function baseInput(structure: any, document?: PageDocument) {
  return {
    code: 'CODE1',
    blocks: flatBlocks(structure),
    document,
    settings: structure.settings ?? {},
    landingPage: { themeColor: '#f97316', title: 'T', description: 'D' },
    product: { nameFr: 'P', retailPriceMad: 249, images: [] },
    influencerPixels: [],
    origin: 'https://sub.silacod.com',
  };
}

describe('compiling a tree', () => {
  it('compiles a migrated page to the same bytes as its flat original', async () => {
    const flat = await renderDocument(baseInput(legacy) as any);
    const doc = fromLegacy(legacy);
    const tree = await renderDocument(baseInput(doc, doc) as any);
    expect(flat).not.toBeNull();
    expect(tree!.html).toBe(flat!.html);
    expect(tree!.csp).toBe(flat!.csp);
  });

  it('renders a styled section as a wrapper with its declarations', async () => {
    const doc = applyOps(fromLegacy(legacy), [
      { op: 'set', nodeId: 'page', path: 'style.paddingTop', value: 40 },
      { op: 'set', nodeId: 'page', path: 'style.background', value: '#f8fafc' },
      { op: 'set', nodeId: 'page', path: 'style.maxWidth', value: 960 },
    ]).doc;
    const out = (await renderDocument(baseInput(doc, doc) as any))!;
    expect(out.html).toContain('<section class="sec n-page" style="padding-top:40px;background:#f8fafc">');
    expect(out.html).toContain('<div class="sec-in" style="max-width:960px">');
    expect(out.html).toContain('.sec{width:100%}');
    // The blocks themselves are untouched.
    expect(out.html).toContain('Offre');
  });

  it('renders a row as a grid whose columns stack on phones by default', async () => {
    const doc = applyOps(fromLegacy(legacy), [
      { op: 'wrap', nodeIds: ['h1', 'i1'], wrapperId: 'row1', layout: 'row', columns: [7, 5] },
    ]).doc;
    const out = (await renderDocument(baseInput(doc, doc) as any))!;
    // The track is a class rule, so the phone rule below can override it;
    // an inline style would have beaten the media rule and never stacked.
    expect(out.html).toContain('<div class="lay n-row1">');
    expect(out.html).toContain('.n-row1{grid-template-columns:7fr 5fr}');
    expect(out.html).toMatch(/<div class="col">.*Offre.*<\/div><div class="col">.*<img/s);
    expect(out.html).toContain('@media (max-width:639px){.n-row1{grid-template-columns:1fr}}');
  });

  it('honours a phone column override instead of stacking, and hides on tablet when told', async () => {
    const doc = applyOps(fromLegacy(legacy), [
      { op: 'wrap', nodeIds: ['h1', 'i1'], wrapperId: 'row1', layout: 'row', columns: [6, 6] },
      { op: 'set', nodeId: 'row1', path: 'responsive.sm.columns', value: [6, 6] },
      { op: 'set', nodeId: 'c1', path: 'responsive.md.hidden', value: true },
    ]).doc;
    const out = (await renderDocument(baseInput(doc, doc) as any))!;
    expect(out.html).toContain('@media (max-width:639px){.n-row1{grid-template-columns:6fr 6fr}}');
    expect(out.html).not.toContain('.n-row1{grid-template-columns:1fr}');
    // A hidden BLOCK is dropped from the flow rather than given a rule: blocks
    // have no wrapper of their own to hang a class on.
    expect(out.html).not.toContain('.n-c1{display:none}');
  });

  it('drops a hidden layout entirely and keeps block indices in step', async () => {
    const doc = applyOps(fromLegacy(legacy), [
      { op: 'wrap', nodeIds: ['h1'], wrapperId: 'row1', layout: 'row' },
      { op: 'set', nodeId: 'row1', path: 'hidden', value: true },
    ]).doc;
    const out = (await renderDocument(baseInput(doc, doc) as any))!;
    expect(out.html).not.toContain('Offre');
    expect(out.html).not.toContain('n-row1');
    // The checkout is still the third block and still gets the anchor id.
    expect(out.html).toContain('id="express-checkout-block"');
  });

  it('puts an unsafe node id through the identifier allow-list', async () => {
    const doc = fromLegacy(legacy);
    (doc.root[0] as any).id = 'bad id"><script>';
    (doc.root[0] as any).implicit = false;
    (doc.root[0] as any).style = { paddingTop: 8 };
    const out = (await renderDocument(baseInput(doc, doc) as any))!;
    // The raw id never reaches the markup; only its identifier-safe residue does.
    expect(out.html).not.toContain('bad id');
    expect(out.html).toContain('class="sec n-badidscript"');
  });
});

describe('the landing validator and version 3 documents', () => {
  it('accepts a valid document', () => {
    const doc = applyOps(fromLegacy(legacy), [
      { op: 'wrap', nodeIds: ['h1', 'i1'], wrapperId: 'row1', layout: 'row', columns: [7, 5] },
    ]).doc;
    expect(validateLandingPageUpdate({ customStructure: doc })).toBeNull();
  });

  it('refuses a document carrying an unknown block, with the reason', () => {
    const doc = fromLegacy(legacy);
    (doc.root[0].children[0] as any).block = 'raw_html';
    expect(validateLandingPageUpdate({ customStructure: doc })).toMatch(/unknown block type "raw_html"/);
  });

  it('still accepts both flat shapes', () => {
    expect(validateLandingPageUpdate({ customStructure: legacy })).toBeNull();
    expect(validateLandingPageUpdate({ customStructure: legacy.blocks })).toBeNull();
  });
});

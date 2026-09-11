/**
 * The bounds every document has to stay inside, enforced in exactly one place
 * (`applyOps`) so the editor, the API and an agent are refused identically.
 *
 * Depth counts nodes from the root: section (1) → layout (2) → layout (3) →
 * block (4). Five leaves room for one more level of nesting than any template
 * needs, and no more — deeper trees are where drag and drop stops making sense
 * to the person doing it.
 */
export const MAX_DEPTH = 5;

/** Nodes of any kind, per page. A long-form landing page sits under a hundred. */
export const MAX_NODES = 400;

/** Same budget the landing page validator already applies to the stored JSON. */
export const MAX_BYTES = 512 * 1024;

/**
 * Bound expressions per page. Each one is data the compiler resolves per URL;
 * a page that binds fifty collections is a page that takes fifty queries to
 * render, and nothing a customer looks at needs that.
 */
export const MAX_BINDS = 12;

/** Ids are used in CSS selectors and DOM ids; nothing else is allowed in. */
export const NODE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Labels are for humans and agents; keep them a line. */
export const MAX_LABEL = 80;

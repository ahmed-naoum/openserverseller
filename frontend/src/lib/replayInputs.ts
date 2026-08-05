/**
 * Extracts "what did the visitor actually type, and when" from an rrweb event
 * stream, so a replay can jump straight to the moment typing started instead of
 * making an operator scrub through the whole session.
 *
 * rrweb records every keystroke as an incremental snapshot with source `Input`,
 * carrying only the mirror node id — not the field name. To label those events
 * we first walk the full snapshot (and any nodes added later by mutations) and
 * build an id → field descriptor index.
 */

// rrweb enum values, inlined so this module has no runtime dependency on rrweb.
const EVENT_FULL_SNAPSHOT = 2;
const EVENT_INCREMENTAL = 3;
const SOURCE_MUTATION = 0;
const SOURCE_INPUT = 5;
const NODE_ELEMENT = 2;
const NODE_TEXT = 3;

const TEXT_INPUT_TYPES = new Set([
  '', 'text', 'tel', 'email', 'number', 'search', 'url', 'password', 'date', 'time',
]);

export interface FieldActivity {
  nodeId: number;
  /** Human-readable field name, best effort from label/placeholder/name/id. */
  label: string;
  /** Milliseconds from session start to the first *content-bearing* input. */
  firstOffsetMs: number;
  /** Milliseconds from session start to the last content-bearing input. */
  lastOffsetMs: number;
  /** Last non-empty value. Empty for masked password fields. */
  finalValue: string;
  /** Number of content-bearing input events. */
  edits: number;
  /** True when rrweb masked the content (password fields). */
  masked: boolean;
  /** True when the field was emptied after being filled (form reset, or the
   *  visitor deleting what they wrote). */
  clearedAfter: boolean;
}

export interface InputTimeline {
  /** Fields in the order the visitor first typed into them. */
  fields: FieldActivity[];
  /** Every input event, for drawing markers on the scrub bar. */
  moments: { offsetMs: number; nodeId: number }[];
  /** Offset of the very first keystroke of the session, or null if none. */
  firstWriteOffsetMs: number | null;
  /** Total session length in ms, derived from the event stream. */
  durationMs: number;
}

type SerializedNode = {
  type?: number;
  id?: number;
  tagName?: string;
  attributes?: Record<string, unknown>;
  childNodes?: SerializedNode[];
  textContent?: string;
};

/** Concatenated text of a node's descendants, used to read <label> contents. */
function textOf(node: SerializedNode): string {
  if (node.type === NODE_TEXT) return (node.textContent || '').trim();
  if (!node.childNodes?.length) return '';
  return node.childNodes.map(textOf).filter(Boolean).join(' ').trim();
}

interface FieldMeta {
  label: string;
  masked: boolean;
  /** Toggles report state via isChecked; text fields via a string value. */
  kind: 'text' | 'toggle';
}

/**
 * Walks a serialized node tree collecting form fields plus any <label for="…">
 * text, so an input can borrow its visible label when it has no placeholder.
 */
function indexNodes(
  root: SerializedNode | undefined,
  byNodeId: Map<number, FieldMeta>,
  pendingByHtmlId: Map<string, number[]>,
  labelTextByHtmlFor: Map<string, string>,
) {
  if (!root) return;

  const visit = (node: SerializedNode) => {
    if (node.type === NODE_ELEMENT && node.tagName) {
      const tag = node.tagName.toLowerCase();
      const attrs = (node.attributes || {}) as Record<string, string>;

      if (tag === 'label' && attrs.for) {
        const t = textOf(node);
        if (t) labelTextByHtmlFor.set(attrs.for, t);
      }

      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        const type = (attrs.type || '').toLowerCase();
        // Buttons and hidden fields are not "writing".
        const isWritable =
          tag !== 'input' || TEXT_INPUT_TYPES.has(type) || type === 'checkbox' || type === 'radio';

        if (isWritable && typeof node.id === 'number') {
          const label =
            (attrs['aria-label'] as string) ||
            (attrs.placeholder as string) ||
            (attrs.name as string) ||
            (attrs.id as string) ||
            (tag === 'input' ? `input[${type || 'text'}]` : tag);

          byNodeId.set(node.id, {
            label: label.trim(),
            masked: type === 'password',
            kind: type === 'checkbox' || type === 'radio' ? 'toggle' : 'text',
          });

          // Resolved against labelTextByHtmlFor once the whole tree is walked,
          // since a <label> may appear after the input it describes.
          if (attrs.id) {
            const list = pendingByHtmlId.get(attrs.id) || [];
            list.push(node.id);
            pendingByHtmlId.set(attrs.id, list);
          }
        }
      }
    }
    node.childNodes?.forEach(visit);
  };

  visit(root);
}

export function extractInputTimeline(events: any[]): InputTimeline {
  const empty: InputTimeline = {
    fields: [],
    moments: [],
    firstWriteOffsetMs: null,
    durationMs: 0,
  };
  if (!Array.isArray(events) || events.length === 0) return empty;

  const start = events[0]?.timestamp ?? 0;
  const end = events[events.length - 1]?.timestamp ?? start;

  const byNodeId = new Map<number, FieldMeta>();
  const pendingByHtmlId = new Map<string, number[]>();
  const labelTextByHtmlFor = new Map<string, string>();

  for (const ev of events) {
    if (ev?.type === EVENT_FULL_SNAPSHOT) {
      indexNodes(ev.data?.node, byNodeId, pendingByHtmlId, labelTextByHtmlFor);
    } else if (ev?.type === EVENT_INCREMENTAL && ev.data?.source === SOURCE_MUTATION) {
      // Fields rendered after load (conditional steps, modals) arrive here.
      for (const add of ev.data.adds || []) {
        indexNodes(add?.node, byNodeId, pendingByHtmlId, labelTextByHtmlFor);
      }
    }
  }

  // A visible <label for="…"> beats a placeholder or name attribute.
  for (const [htmlId, nodeIds] of pendingByHtmlId) {
    const labelText = labelTextByHtmlFor.get(htmlId);
    if (!labelText) continue;
    for (const nodeId of nodeIds) {
      const meta = byNodeId.get(nodeId);
      if (meta) meta.label = labelText;
    }
  }

  const activity = new Map<number, FieldActivity>();
  const moments: { offsetMs: number; nodeId: number }[] = [];

  for (const ev of events) {
    if (ev?.type !== EVENT_INCREMENTAL || ev.data?.source !== SOURCE_INPUT) continue;

    const nodeId = ev.data.id;
    if (typeof nodeId !== 'number') continue;

    const offsetMs = Math.max(0, (ev.timestamp ?? start) - start);
    const meta = byNodeId.get(nodeId);
    const text = typeof ev.data.text === 'string' ? ev.data.text : '';
    const isToggle = meta?.kind === 'toggle';

    // A text input reporting "" is a clear, not writing — forms emit exactly that
    // on reset/unmount, and counting it would report typing in sessions where the
    // visitor never touched the form. Toggles are different: for them every event
    // is a deliberate action, checked or not.
    const hasContent = isToggle || text.length > 0;
    const value = isToggle ? (ev.data.isChecked ? 'coché' : 'décoché') : text;

    const existing = activity.get(nodeId);

    if (!hasContent) {
      // Remember that a filled field was later emptied, but never let the clear
      // define when writing started or what was written.
      if (existing) existing.clearedAfter = true;
      continue;
    }

    moments.push({ offsetMs, nodeId });

    if (existing) {
      existing.lastOffsetMs = offsetMs;
      existing.finalValue = value;
      existing.edits += 1;
      existing.clearedAfter = false; // re-filled after the clear
    } else {
      activity.set(nodeId, {
        nodeId,
        label: meta?.label || `champ #${nodeId}`,
        firstOffsetMs: offsetMs,
        lastOffsetMs: offsetMs,
        finalValue: value,
        edits: 1,
        masked: meta?.masked ?? false,
        clearedAfter: false,
      });
    }
  }

  // Masked password fields never carry text, so they would be dropped by the
  // content check above; they are intentionally not reported as writing.
  const fields = Array.from(activity.values()).sort((a, b) => a.firstOffsetMs - b.firstOffsetMs);

  return {
    fields,
    moments,
    firstWriteOffsetMs: fields.length ? fields[0].firstOffsetMs : null,
    durationMs: Math.max(0, end - start),
  };
}

/** "1m 04s" / "12s" — matches the duration format used elsewhere in the admin UI. */
export function fmtOffset(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
}

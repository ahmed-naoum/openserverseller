/**
 * Writes rows INTO a seller's own Google Sheet.
 *
 * This is the OUTBOUND half of the Google Sheets integration and is deliberately
 * separate from `routes/googleSheets.routes.ts`, which is INBOUND: that side reads
 * a sheet and treats it as the source of truth, deleting leads whose row vanished.
 * The two must never point at the same spreadsheet — see the guard in
 * `POST /google-sheets/outbound/connect`.
 *
 * AUTHENTICATION. Google accepts an API key only for *reading* public data; every
 * write requires a real OAuth identity. So one platform service account signs all
 * writes, and each seller lets it in by either
 *   (a) sharing their sheet with GOOGLE_SA_CLIENT_EMAIL as Editor, or
 *   (b) setting link sharing to "anyone with the link can edit".
 * Nothing is stored per seller, and nothing expires: `JWT` self-signs and refreshes.
 */

import { JWT } from 'google-auth-library';
import { getSecret } from '../lib/secretStore.js';
import { getPackPrice } from '../lib/leadPricing.js';

// ─── Tunables (env-overridable so ops can adapt without a redeploy) ──────────

const num = (key: string, fallback: number): number => {
  const raw = process.env[key];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const REQUEST_TIMEOUT_MS = num('SHEET_WRITE_TIMEOUT_MS', 15000);
const MAX_CELL_LENGTH = num('SHEET_MAX_CELL_LENGTH', 500);

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

/** The default tab the connect flow creates when the seller does not name one. */
export const DEFAULT_TAB = 'SILACOD Leads';

/**
 * The outbound column contract. Sellers will build formulas against these, so the
 * order is a breaking change once shipped.
 *
 * APPEND-ONLY. A new column goes at the END, never in the middle: `LEAD_ID_COLUMN`
 * below is derived from a position in this array, and `readSheetLeadIds` reads that
 * one column out of every row a seller's sheet has ever held. Insert anything above
 * it and those historic rows answer text instead of an id, which `reconcileVendorSheet`
 * reads as "the row is gone" — the seller's entire lead history flips to REMOVED.
 * `applyHeaderTemplate` widens an already-connected sheet on the same assumption.
 *
 * It intentionally does NOT match the 9-column inbound layout (Customer, Phone,
 * City, Address, Price (MAD), Qty, SKU, Note, SILACOD Status). If the two matched,
 * an inbound sync pointed at an outbound tab would read our own rows back in as
 * brand-new leads, and then delete them again on the next pass.
 */
export interface OutboundColumn {
  /** Stable identifier stored in the seller's selection; never localised or renamed. */
  key: string;
  /** Header text written to row 1 — the column contract sellers build formulas on. */
  label: string;
  /** A pinned column is always sent and cannot be toggled off (see below). */
  locked?: boolean;
}

/**
 * The canonical column set, in contract order.
 *
 * `date` and `leadId` are LOCKED: a seller may hide any OTHER column, but these two
 * always lead the row, in this order. That is what keeps `Lead ID` at column B for
 * every seller whatever else they hide — the one invariant `readSheetLeadIds` and
 * `LEAD_ID_COLUMN` depend on. Because Lead ID never moves, per-seller column
 * selection needs no data migration and can never strand a seller's lead history.
 *
 * Still APPEND-ONLY for new columns: a new one goes at the END. `LEAD_ID_COLUMN`
 * is derived from a position here, and historic rows are read by that column, so
 * inserting above Lead ID would make those rows answer text instead of an id.
 */
export const OUTBOUND_COLUMN_DEFS: OutboundColumn[] = [
  { key: 'date', label: 'Date', locked: true },
  { key: 'leadId', label: 'Lead ID', locked: true },
  { key: 'client', label: 'Client' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'city', label: 'Ville' },
  { key: 'address', label: 'Adresse' },
  { key: 'product', label: 'Produit' },
  { key: 'quantity', label: 'Quantité' },
  { key: 'price', label: 'Prix (MAD)' },
  { key: 'source', label: 'Source' },
  { key: 'status', label: 'Statut' },
  // The pack the customer picked on the landing page ("2 Pièces + 1 Gratuite"), on
  // its own rather than glued into Produit — see buildLeadRow.
  { key: 'variant', label: 'Variante' },
];

/** The full ordered label list. Back-compat for callers that want every column. */
export const OUTBOUND_COLUMNS = OUTBOUND_COLUMN_DEFS.map((c) => c.label);

/** Column keys that can never be removed from a seller's selection. */
export const LOCKED_OUTBOUND_KEYS = OUTBOUND_COLUMN_DEFS.filter((c) => c.locked).map((c) => c.key);

/**
 * A seller's stored selection, resolved to ordered column defs.
 *
 * `selectedKeys` null/empty means "all columns" — the default and the behaviour
 * before selection existed. Otherwise the result keeps the wanted keys PLUS every
 * locked column (always, whatever the selection says), and always in the canonical
 * order above rather than the order the keys arrived in. The result is therefore a
 * subsequence of OUTBOUND_COLUMN_DEFS that always starts with date + leadId.
 */
export function resolveOutboundColumns(selectedKeys?: string[] | null): OutboundColumn[] {
  if (!Array.isArray(selectedKeys) || selectedKeys.length === 0) return OUTBOUND_COLUMN_DEFS;
  const wanted = new Set(selectedKeys);
  return OUTBOUND_COLUMN_DEFS.filter((c) => c.locked || wanted.has(c.key));
}

/** Parses the stored JSON selection into keys, tolerating null / malformed values. */
export function parseOutboundSelection(raw?: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const keys = parsed
      .map((k) => String(k))
      .filter((k) => OUTBOUND_COLUMN_DEFS.some((c) => c.key === k));
    return keys.length ? keys : null;
  } catch {
    return null;
  }
}

/** Header labels for a resolved column set. */
export function outboundLabels(columns: OutboundColumn[]): string[] {
  return columns.map((c) => c.label);
}

/**
 * A1 column letter for a zero-based index.
 *
 * SINGLE LETTER ONLY: at index 26 this arithmetic yields '[' rather than 'AA', so
 * OUTBOUND_COLUMNS cannot pass 26 entries without teaching this the two-letter form
 * first. Twelve is comfortably inside that ceiling.
 */
const columnLetter = (index: number): string => String.fromCharCode('A'.charCodeAt(0) + index);

/** Widest the contract can ever be — 12 columns → 'L'. Used when clearing stale
 * header cells a shrunk selection left behind, and as the append span. */
const CANONICAL_LAST_COLUMN = columnLetter(OUTBOUND_COLUMN_DEFS.length - 1);

/** Last column letter for a specific (possibly narrowed) label set. */
const lastColumnFor = (labels: string[]): string => columnLetter(Math.max(0, labels.length - 1));

/**
 * Where the lead id lives — derived, never spelled 'B'. Lead ID is a LOCKED column
 * pinned at index 1, so this is 'B' for every seller regardless of what else they
 * hide. That fixed position is exactly why column selection is safe: this reader
 * never has to know a seller's layout.
 */
const LEAD_ID_COLUMN = columnLetter(OUTBOUND_COLUMN_DEFS.findIndex((c) => c.key === 'leadId'));

// ─── Result shape ────────────────────────────────────────────────────────────

export type SheetWriteReason =
  | 'NOT_CONFIGURED' // the platform has no service-account credentials
  | 'BAD_CREDENTIALS' // credentials present but Google rejected them
  | 'NOT_SHARED' // the seller has not given the service account write access
  | 'NOT_FOUND' // wrong id, or the spreadsheet was deleted
  | 'RATE_LIMITED'
  | 'UPSTREAM'
  | null;

export interface SheetWriteResult {
  ok: boolean;
  status: number;
  /** True when the caller should try again later rather than surface an error. */
  retriable: boolean;
  reason: SheetWriteReason;
  /** Human-readable, French — this string reaches the seller's panel verbatim. */
  error?: string;
  updatedRange?: string;
  updatedRows?: number;
  retryAfterMs?: number | null;
  /**
   * `applyHeaderTemplate` only: true when the header row was missing or had drifted
   * and had to be re-inserted, false when only the formatting was refreshed. The
   * route turns it into two different sentences for the seller.
   */
  headerInserted?: boolean;
}

const success = (extra: Partial<SheetWriteResult> = {}): SheetWriteResult => ({
  ok: true,
  status: 200,
  retriable: false,
  reason: null,
  ...extra,
});

// ─── Credentials ─────────────────────────────────────────────────────────────

/**
 * The service-account address a seller must share their sheet with. Deliberately
 * readable by the vendor-facing routes: the whole connect UX depends on being able
 * to show it, which is why it is registered as a non-secret.
 */
export function getServiceAccountEmail(): string | null {
  const email = getSecret('GOOGLE_SA_CLIENT_EMAIL');
  return email && email.trim() ? email.trim() : null;
}

function getPrivateKey(): string | null {
  const raw = getSecret('GOOGLE_SA_PRIVATE_KEY');
  if (!raw || !raw.trim()) return null;
  // A PEM pasted into a form or an .env line arrives with literal backslash-n
  // rather than real newlines; JWT rejects it silently if they are not restored.
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
}

export function isWriterConfigured(): boolean {
  return !!getServiceAccountEmail() && !!getPrivateKey();
}

let cachedClient: JWT | null = null;
let cachedFingerprint = '';

/**
 * Built lazily and cached, but keyed on the credentials themselves so an admin
 * editing them in the Secrets UI takes effect without a restart.
 */
function getWriterClient(): JWT | null {
  const email = getServiceAccountEmail();
  const key = getPrivateKey();
  if (!email || !key) {
    cachedClient = null;
    cachedFingerprint = '';
    return null;
  }

  const fingerprint = `${email}:${key.length}:${key.slice(-24)}`;
  if (cachedClient && fingerprint === cachedFingerprint) return cachedClient;

  cachedClient = new JWT({ email, key, scopes: SCOPES });
  cachedFingerprint = fingerprint;
  return cachedClient;
}

// ─── Error classification ────────────────────────────────────────────────────

const retryAfterMs = (headers: any): number | null => {
  const header = headers?.['retry-after'] ?? headers?.['Retry-After'];
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(String(header));
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
};

const RETRIABLE_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNABORTED',
  'EAI_AGAIN',
  'ENOTFOUND',
  'ECONNREFUSED',
  'EPIPE',
  'ERR_CANCELED',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
]);

const isTransportError = (error: any) => {
  // Anything Google actually answered is classified by its status instead.
  if (error?.response) return false;
  if (RETRIABLE_CODES.has(error?.code)) return true;

  // A request killed by our own REQUEST_TIMEOUT_MS surfaces as an abort carrying
  // no `code` at all. Falling through to the permanent branch would mark a whole
  // batch FAILED — up to BATCH_SIZE leads never written — because one response
  // was slow, so treat it as the transient blip it is.
  const name = String(error?.name || '');
  const message = String(error?.message || '');
  return (
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    /timeout|timed out|aborted|socket hang up|network|ECONNRESET/i.test(message)
  );
};

/**
 * Maps a failed Google call onto something the seller's panel can act on.
 * Retriable failures never reach the seller; permanent ones tell them what to fix.
 */
function classify(error: any, sheetId: string): SheetWriteResult {
  const status: number = error?.response?.status ?? 0;
  const upstream =
    error?.response?.data?.error?.message ??
    error?.response?.data?.error_description ??
    error?.message ??
    'Erreur inconnue';

  if (isTransportError(error)) {
    // `code` is absent on an aborted request, so fall back to the message.
    const detail = error?.code || error?.name || error?.message || 'inconnue';
    return { ok: false, status: 0, retriable: true, reason: 'UPSTREAM', error: `Réseau: ${detail}` };
  }

  if (status === 429 || status === 408 || status === 425 || (status >= 500 && status <= 504)) {
    return {
      ok: false,
      status,
      retriable: true,
      reason: status === 429 ? 'RATE_LIMITED' : 'UPSTREAM',
      error: upstream,
      retryAfterMs: retryAfterMs(error?.response?.headers),
    };
  }

  if (status === 401) {
    // Our own credentials were rejected — a platform misconfiguration, not the
    // seller's fault. Retrying will not help until an admin fixes the secrets.
    return {
      ok: false,
      status,
      retriable: false,
      reason: 'BAD_CREDENTIALS',
      error: "Les identifiants Google de la plateforme ont été refusés. Contactez l'administrateur.",
    };
  }

  if (status === 403) {
    return {
      ok: false,
      status,
      retriable: false,
      reason: 'NOT_SHARED',
      error:
        "Accès refusé à la feuille. Partagez-la avec le compte de service en tant qu'Éditeur, " +
        'ou passez le partage sur « Tous les utilisateurs disposant du lien — Éditeur ».',
    };
  }

  if (status === 404) {
    return {
      ok: false,
      status,
      retriable: false,
      reason: 'NOT_FOUND',
      error: `Feuille introuvable (${sheetId}). Vérifiez le lien.`,
    };
  }

  return { ok: false, status, retriable: false, reason: 'UPSTREAM', error: upstream };
}

// ─── Cell sanitisation ───────────────────────────────────────────────────────

/**
 * Landing-page input is attacker-controlled and lands in a third party's document,
 * so it is scrubbed on the way out.
 *
 * The primary defence is `valueInputOption=RAW` on every write: Google stores RAW
 * values verbatim and never parses them, so `=IMPORTRANGE(...)` stays inert text.
 * This function is the second layer, for the day someone switches that option.
 * A leading `=` is dropped because no real name or address starts with one; `+`
 * and `-` are kept because phone numbers legitimately start with `+`.
 */
export function sanitizeCell(value: unknown, maxLength = MAX_CELL_LENGTH): string {
  if (value === null || value === undefined) return '';
  let cleaned = String(value).trim();

  cleaned = cleaned.replace(/\0/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  cleaned = cleaned.replace(/^[=@\t\r]+/, '');
  cleaned = cleaned
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '');

  return cleaned.slice(0, maxLength).trim();
}

/**
 * One phone format for the whole sheet, chosen rather than inherited: leads carry
 * at least three different shapes depending on which route created them, and a
 * seller pasting a column into a dialler needs them consistent. `+212…` matches
 * what the manual-insert path already normalises to.
 */
export function formatPhone(raw: unknown): string {
  const digits = String(raw ?? '').replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('212')) return `+${digits}`;
  if (digits.startsWith('0')) return `+212${digits.slice(1)}`;
  return digits;
}

// ─── Row building ────────────────────────────────────────────────────────────

/** The lead shape `buildLeadRow` needs. Every relation is optional. */
export interface PushableLead {
  id: number;
  fullName?: string | null;
  phone?: string | null;
  city?: string | null;
  address?: string | null;
  productVariant?: string | null;
  /** The pack label alone. `productVariant` stays the legacy composite string. */
  variantName?: string | null;
  /** Units in the chosen pack. Null on every lead captured before packs had one. */
  packQuantity?: number | null;
  source?: string | null;
  status?: string | null;
  confirmedPriceMad?: number | null;
  createdAt?: Date | string | null;
  referralLink?: {
    product?: {
      sku?: string | null;
      nameFr?: string | null;
      nameAr?: string | null;
      nameEn?: string | null;
      retailPriceMad?: number | null;
    } | null;
    landingPage?: { customStructure?: any } | null;
  } | null;
  order?: {
    totalAmountMad?: number | null;
    productVariant?: string | null;
    packageContent?: string | null;
    items?: {
      quantity: number;
      totalPriceMad: number;
      product?: { nameFr?: string | null; nameAr?: string | null; nameEn?: string | null } | null;
    }[];
  } | null;
}

/**
 * Formats one lead as sheet cells, in order, for the given columns.
 *
 * `columns` defaults to the full set. When a seller has hidden columns, pass their
 * resolved selection (via resolveOutboundColumns) and only those cells are emitted,
 * in canonical order — the same order their header row is written in.
 */
export function buildLeadRow(lead: PushableLead, columns: OutboundColumn[] = OUTBOUND_COLUMN_DEFS): string[] {
  const items = lead.order?.items ?? [];
  // Most specific first, and deliberately WITHOUT a variant step. `order.productVariant`
  // and `productVariant` used to sit in the middle of this chain, which is the whole
  // reason a seller read "Pack 2 Pièces" in the Produit column instead of the product
  // they were selling. The pack label has its own column now (Variante, below) — do
  // not put either of them back here to fill a cell that came out blank.
  //
  // The linkedProduct steps stay: a lead with no order has nothing product-shaped of
  // its own, so it falls back to the product behind the link it came through — SKU
  // first, because that is the value a seller can match against their own catalogue,
  // with the name as a safety net.
  const linkedProduct = lead.referralLink?.product;
  const productName =
    items
      .map((i) => i.product?.nameFr || i.product?.nameAr || i.product?.nameEn)
      .filter(Boolean)
      .join(', ') ||
    lead.order?.packageContent ||
    linkedProduct?.sku ||
    linkedProduct?.nameFr ||
    linkedProduct?.nameAr ||
    linkedProduct?.nameEn ||
    '';
  // This column printed a hardcoded 1 for anything without an order — which is every
  // landing prospect — so it stated the opposite of the truth on every multi-unit pack
  // sold. The order items stay the authority whenever an order exists: that figure has
  // already been reconciled against what will actually ship. Below it sits the pack's
  // own unit count, and 1 only when genuinely nothing knows.
  const packQuantity = Number(lead.packQuantity);
  const quantity = items.length
    ? items.reduce((sum, i) => sum + (i.quantity || 0), 0)
    : Number.isFinite(packQuantity) && packQuantity > 0
    ? packQuantity
    : 1;
  // The SAME resolution the dashboard's Amount column uses. Reading only the order
  // total and the confirmed price — as this did originally — leaves the cell blank
  // for every prospect, because neither exists until a lead is confirmed; the pack
  // and product-list fallbacks are what price the majority of rows.
  // getPackPrice answers 0 both for "this really costs 0" and for "nothing known",
  // so check the two authoritative sources directly: an order total or a confirmed
  // price of 0 is a real 0 and gets printed, while a fall-through stays blank.
  // `variantName` is only ever written when a real pack was chosen, so it needs no
  // vetting. The two legacy strings do: they carry a pack for landing leads, but the
  // marketplace importers write a PRODUCT NAME into productVariant (see the Woo /
  // YouCan create in lead.routes.ts) and the sheet sync writes a SKU. Printing those
  // here would reproduce, one column to the right, exactly the conflation this column
  // exists to end — so a legacy string that merely repeats the product is dropped
  // rather than shown, and the cell stays honestly blank.
  const legacyVariant = lead.order?.productVariant || lead.productVariant || '';
  const productAliases = [linkedProduct?.sku, linkedProduct?.nameFr, linkedProduct?.nameAr, linkedProduct?.nameEn]
    .filter(Boolean)
    .map((alias) => String(alias).trim().toLowerCase());
  const variantLabel =
    lead.variantName ||
    (legacyVariant && !productAliases.includes(String(legacyVariant).trim().toLowerCase())
      ? legacyVariant
      : '');

  const explicitPrice = lead.order?.totalAmountMad ?? lead.confirmedPriceMad ?? null;
  const price = explicitPrice !== null && explicitPrice !== undefined ? Number(explicitPrice) : getPackPrice(lead);
  const priceKnown = (explicitPrice !== null && explicitPrice !== undefined) || price > 0;
  const createdAt = lead.createdAt ? new Date(lead.createdAt) : new Date();

  // One cell per column key. Every value is computed the same way it always was;
  // the only new thing is that the row is projected down to the seller's columns
  // below, so a hidden column simply never contributes its cell.
  const cellByKey: Record<string, string> = {
    // "YYYY-MM-DD HH:mm:ss" rather than toISOString(): sellers read this column and
    // sort on it, and a trailing "Z" is noise in a spreadsheet.
    date: createdAt.toISOString().replace('T', ' ').slice(0, 19),
    leadId: String(lead.id),
    client: sanitizeCell(lead.fullName),
    phone: sanitizeCell(formatPhone(lead.phone)),
    city: sanitizeCell(lead.city),
    address: sanitizeCell(lead.address, 1000),
    product: sanitizeCell(productName),
    quantity: String(quantity),
    price: priceKnown ? String(price) : '',
    source: sanitizeCell(lead.source || 'MANUAL'),
    status: sanitizeCell(lead.status || 'NEW'),
    // The pack label alone, and pointedly NOT the productName chain above: its
    // packageContent and SKU steps are what muddied Produit in the first place, and
    // repeating them here would only move the mess one column right.
    variant: sanitizeCell(variantLabel),
  };

  return columns.map((c) => cellByKey[c.key] ?? '');
}

// ─── Google calls ────────────────────────────────────────────────────────────

/** `'My Tab'!A1` — single quotes doubled, per the A1 notation spec. */
function range(tab: string, cells: string): string {
  return `'${tab.replace(/'/g, "''")}'!${cells}`;
}

/** Sentinel returned instead of throwing when the platform has no credentials. */
const NOT_CONFIGURED_ERROR = { __notConfigured: true };

/**
 * Flat rather than a discriminated union on purpose: this project compiles with
 * `strictNullChecks: false`, under which narrowing a `{ok:true}|{ok:false}` union
 * does not work and every `.error` access is a compile error.
 */
interface CallResult<T> {
  ok: boolean;
  data?: T;
  error?: any;
}

async function call<T = any>(method: 'GET' | 'POST' | 'PUT', url: string, data?: unknown): Promise<CallResult<T>> {
  const client = getWriterClient();
  if (!client) return { ok: false, error: NOT_CONFIGURED_ERROR };
  try {
    const res = await client.request<T>({ url, method, data, timeout: REQUEST_TIMEOUT_MS } as any);
    return { ok: true, data: res.data as T };
  } catch (error: any) {
    return { ok: false, error };
  }
}

const notConfigured: SheetWriteResult = {
  ok: false,
  status: 0,
  retriable: false,
  reason: 'NOT_CONFIGURED',
  error: "L'envoi vers Google Sheets n'est pas configuré sur la plateforme. Contactez l'administrateur.",
};

/**
 * Verifies write access and prepares the tab, in one pass.
 *
 * This doubles as the connect-time probe. A metadata read alone would not do:
 * a sheet shared read-only answers it happily and then rejects every append, so
 * the seller would only discover the problem once leads started silently failing.
 * Creating the tab (or writing the header row) is a real write, so success here
 * means success later.
 */
export async function ensureSheetReady(
  sheetId: string,
  tab: string,
  labels: string[] = OUTBOUND_COLUMNS
): Promise<SheetWriteResult> {
  if (!isWriterConfigured()) return notConfigured;

  const lastCol = lastColumnFor(labels);

  const meta = await call<{ sheets?: { properties?: { title?: string } }[] }>(
    'GET',
    `${SHEETS_API}/${encodeURIComponent(sheetId)}?fields=sheets.properties.title`
  );
  if (!meta.ok) {
    if (meta.error?.__notConfigured) return notConfigured;
    return classify(meta.error, sheetId);
  }

  const titles = (meta.data?.sheets ?? []).map((s) => s.properties?.title).filter(Boolean) as string[];

  if (!titles.includes(tab)) {
    const created = await call('POST', `${SHEETS_API}/${encodeURIComponent(sheetId)}:batchUpdate`, {
      requests: [{ addSheet: { properties: { title: tab } } }],
    });
    if (!created.ok) {
      if (created.error?.__notConfigured) return notConfigured;
      return classify(created.error, sheetId);
    }
  }

  const header = await call<{ values?: string[][] }>(
    'GET',
    `${SHEETS_API}/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range(tab, `A1:${lastCol}1`))}`
  );
  if (!header.ok) {
    if (header.error?.__notConfigured) return notConfigured;
    return classify(header.error, sheetId);
  }

  const existing = header.data?.values?.[0] ?? [];
  if (existing.length === 0) {
    const written = await call(
      'PUT',
      `${SHEETS_API}/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(
        range(tab, `A1:${lastCol}1`)
      )}?valueInputOption=RAW`,
      { values: [labels] }
    );
    if (!written.ok) {
      if (written.error?.__notConfigured) return notConfigured;
      return classify(written.error, sheetId);
    }
  }

  return success();
}

/**
 * Appends rows to the seller's tab.
 *
 * Multiple rows go in ONE call on purpose: a 500-row CSV import would otherwise be
 * 500 requests against a per-user-per-minute write quota. `valueInputOption=RAW` is
 * load-bearing — see `sanitizeCell`.
 */
export async function appendRows(sheetId: string, tab: string, rows: string[][]): Promise<SheetWriteResult> {
  if (!isWriterConfigured()) return notConfigured;
  if (!rows.length) return success({ updatedRows: 0 });

  // Append to the whole column span, NOT a single cell. Given a one-cell range
  // like `A1`, Google has to guess which "table" that cell belongs to, and with
  // insertDataOption=INSERT_ROWS it can insert ABOVE the existing rows — which is
  // how a test row ended up on row 1, pushing the header down to row 2. The full
  // column span is unambiguous: append after the last row that has data.
  // The full canonical span, not the seller's narrowed width: Google only writes
  // the cells each row actually carries, so a narrowed row lands in A..(its width)
  // and the wider range just identifies the table unambiguously.
  const url =
    `${SHEETS_API}/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range(tab, `A:${CANONICAL_LAST_COLUMN}`))}:append` +
    '?valueInputOption=RAW&insertDataOption=INSERT_ROWS';

  const res = await call<{ updates?: { updatedRange?: string; updatedRows?: number } }>('POST', url, { values: rows });
  if (!res.ok) {
    if (res.error?.__notConfigured) return notConfigured;
    return classify(res.error, sheetId);
  }

  return success({
    updatedRange: res.data?.updates?.updatedRange,
    updatedRows: res.data?.updates?.updatedRows ?? rows.length,
  });
}

// ─── Reading back ────────────────────────────────────────────────────────────

/**
 * The lead ids the seller's tab holds right now.
 *
 * This is the only place the outbound side ever READS the sheet, and it exists
 * because a seller can delete rows out of their own document by hand. Nothing
 * else looks at the document again once an append succeeded, so without this the
 * platform keeps insisting those leads are in a sheet they left long ago.
 *
 * Note what this is NOT: it does not read the other columns and does not care what
 * they say. A seller editing a name or a price in their own copy is their business;
 * only presence is the platform's.
 */
export async function readSheetLeadIds(
  sheetId: string,
  tab: string
): Promise<SheetWriteResult & { leadIds?: Set<number> }> {
  if (!isWriterConfigured()) return notConfigured;

  // One column, from row 2 down — the header sits on row 1 and stays there (see
  // applyHeaderTemplate), and pulling every column of a long sheet to look at one
  // of them is read quota spent for nothing. `majorDimension=COLUMNS` makes the
  // answer a single array of cells instead of one array per row.
  //
  // UNFORMATTED_VALUE matters more than it looks: the default renders each cell as
  // the seller SEES it, so a number format on that column turns 1234 into "1 234"
  // and Number() into NaN — every lead would then read as missing.
  const cells = `${LEAD_ID_COLUMN}2:${LEAD_ID_COLUMN}`;
  const res = await call<{ values?: (string | number)[][] }>(
    'GET',
    `${SHEETS_API}/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(
      range(tab, cells)
    )}?majorDimension=COLUMNS&valueRenderOption=UNFORMATTED_VALUE`
  );
  if (!res.ok) {
    if (res.error?.__notConfigured) return notConfigured;
    return classify(res.error, sheetId);
  }

  // Google omits `values` entirely when the range is empty rather than answering
  // an empty array — and a sheet the seller just wiped is exactly that case, so
  // this branch is the normal one here, not a defensive afterthought.
  const column = res.data?.values?.[0] ?? [];

  const leadIds = new Set<number>();
  for (const cell of column) {
    const id = Number(cell);
    // Blanks (Number('') === 0), stray text (NaN) and the test row are all turned
    // away by the same check: the test row carries Lead ID 0 — see /outbound/test —
    // and 0 is not > 0, so it never counts as a lead that is present.
    if (Number.isInteger(id) && id > 0) leadIds.add(id);
  }

  return { ...success(), leadIds };
}

// ─── Header template ─────────────────────────────────────────────────────────

/** The tab metadata `applyHeaderTemplate` needs; `sheetId` here is the numeric tab id. */
interface TabProperties {
  sheetId?: number;
  title?: string;
  gridProperties?: { frozenRowCount?: number };
}

/** The header band: SILACOD green, matching the panel. */
const HEADER_BACKGROUND = { red: 0.06, green: 0.45, blue: 0.34 };

/**
 * Makes the seller's tab look like a real report, and repairs a header that drifted.
 *
 * Every grid-level request below (freeze, colour, filter, resize) addresses the tab
 * by its NUMERIC id, not by title, which is why this starts with a metadata read.
 *
 * The repair exists because `appendRows` used to be able to insert above the
 * existing rows, leaving a stray test row on line 1 and the header on line 2 — see
 * the comment in `appendRows`. Re-inserting the header at the very top puts the
 * sheet back into the shape the append path expects.
 *
 * `labels` is the seller's chosen header (via outboundLabels(resolveOutboundColumns)),
 * defaulting to the full set. It handles three shapes at once: an empty sheet, an
 * older/narrower header to widen, and a header the seller just reshaped by hiding or
 * showing a column — the last of which also clears the stale labels a narrower
 * selection strands to the right. Row 1 is only ever overwritten when it is itself a
 * header (it begins with the locked 'Date' column); a real data row that drifted to
 * line 1 gets a fresh header inserted above it instead, so no data is lost.
 */
export async function applyHeaderTemplate(
  sheetId: string,
  tab: string,
  labels: string[] = OUTBOUND_COLUMNS
): Promise<SheetWriteResult> {
  if (!isWriterConfigured()) return notConfigured;

  const width = labels.length;
  const lastCol = lastColumnFor(labels);
  const metaUrl =
    `${SHEETS_API}/${encodeURIComponent(sheetId)}?fields=sheets.properties(sheetId,title,gridProperties)`;
  const batchUrl = `${SHEETS_API}/${encodeURIComponent(sheetId)}:batchUpdate`;
  // Written at the seller's width; read across the full canonical width so a header
  // that used to be wider is seen in full and its stale tail can be cleared.
  const desiredCells = encodeURIComponent(range(tab, `A1:${lastCol}1`));
  const canonicalCells = encodeURIComponent(range(tab, `A1:${CANONICAL_LAST_COLUMN}1`));

  const findTab = (payload: { sheets?: { properties?: TabProperties }[] } | undefined) =>
    (payload?.sheets ?? []).map((s) => s.properties).find((p) => p?.title === tab);

  // (a) Resolve the numeric tab id, creating the tab if the seller renamed or
  // deleted it since connecting.
  const meta = await call<{ sheets?: { properties?: TabProperties }[] }>('GET', metaUrl);
  if (!meta.ok) {
    if (meta.error?.__notConfigured) return notConfigured;
    return classify(meta.error, sheetId);
  }

  let properties = findTab(meta.data);
  if (!properties) {
    const created = await call('POST', batchUrl, {
      requests: [{ addSheet: { properties: { title: tab } } }],
    });
    if (!created.ok) {
      if (created.error?.__notConfigured) return notConfigured;
      return classify(created.error, sheetId);
    }

    // Re-read rather than trusting the addSheet reply: one code path for the id.
    const refreshed = await call<{ sheets?: { properties?: TabProperties }[] }>('GET', metaUrl);
    if (!refreshed.ok) {
      if (refreshed.error?.__notConfigured) return notConfigured;
      return classify(refreshed.error, sheetId);
    }
    properties = findTab(refreshed.data);
  }

  const gridId = properties?.sheetId;
  if (typeof gridId !== 'number') {
    return {
      ok: false,
      status: 0,
      retriable: false,
      reason: 'UPSTREAM',
      error: `Onglet « ${tab} » introuvable dans le document.`,
    };
  }

  // (b) Row 1 as it stands today, read across the full canonical width so a header
  // that was previously wider is seen in full (its tail is cleared below).
  const header = await call<{ values?: string[][] }>(
    'GET',
    `${SHEETS_API}/${encodeURIComponent(sheetId)}/values/${canonicalCells}`
  );
  if (!header.ok) {
    if (header.error?.__notConfigured) return notConfigured;
    return classify(header.error, sheetId);
  }

  const existing = (header.data?.values?.[0] ?? []).map((cell) => String(cell ?? '').trim());
  const matchesDesired = existing.length === width && labels.every((label, i) => existing[i] === label);
  // A header row always begins with the literal 'Date' — a LOCKED column, so it is
  // present in every selection and always first. A DATA row begins with a timestamp,
  // never the word 'Date'. That one cell is how row 1 is told apart from a stray data
  // row that drifted to the top, which decides overwrite-in-place vs insert-above.
  const row1IsHeader = existing.length > 0 && existing[0] === OUTBOUND_COLUMN_DEFS[0].label;

  let headerInserted = false;

  if (matchesDesired) {
    // Row 1 is already exactly the desired header — nothing to write. Fall through to
    // the formatting pass, which is why the seller can click the chip as often as they
    // like without a new row being pushed into the sheet on every click.
  } else if (existing.length === 0 || row1IsHeader) {
    // Empty sheet, an older/narrower header to widen, or a header the seller just
    // reshaped by hiding/showing a column: writing the desired labels in place covers
    // all three. No row is inserted, so every existing data row stays where it is and
    // the formulas built against this layout do not shift.
    const written = await call(
      'PUT',
      `${SHEETS_API}/${encodeURIComponent(sheetId)}/values/${desiredCells}?valueInputOption=RAW`,
      { values: [labels] }
    );
    if (!written.ok) {
      if (written.error?.__notConfigured) return notConfigured;
      return classify(written.error, sheetId);
    }
    // "Added" only when row 1 held no header at all; reshaping an existing header
    // reads as "refreshed" — the two states the route turns into two sentences.
    headerInserted = existing.length === 0;

    // A narrower selection leaves the previous, wider header's tail labels stranded to
    // the right. Blank them so the sheet does not show ghost columns from a past layout.
    if (existing.length > width) {
      const staleCells = encodeURIComponent(
        range(tab, `${columnLetter(width)}1:${CANONICAL_LAST_COLUMN}1`)
      );
      const cleared = await call(
        'PUT',
        `${SHEETS_API}/${encodeURIComponent(sheetId)}/values/${staleCells}?valueInputOption=RAW`,
        { values: [new Array(OUTBOUND_COLUMN_DEFS.length - width).fill('')] }
      );
      if (!cleared.ok && cleared.error?.__notConfigured) return notConfigured;
    }
  } else {
    // Row 1 is a real data row (drift): insert a fresh row 1 above it and write the
    // header there, so nothing the seller has is overwritten.
    const inserted = await call('POST', batchUrl, {
      requests: [
        {
          insertDimension: {
            range: { sheetId: gridId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
            // Without this the new row copies the format of whatever sat above it.
            inheritFromBefore: false,
          },
        },
      ],
    });
    if (!inserted.ok) {
      if (inserted.error?.__notConfigured) return notConfigured;
      return classify(inserted.error, sheetId);
    }

    // RAW for the same reason every other write uses it — see `sanitizeCell`.
    const written = await call(
      'PUT',
      `${SHEETS_API}/${encodeURIComponent(sheetId)}/values/${desiredCells}?valueInputOption=RAW`,
      { values: [labels] }
    );
    if (!written.ok) {
      if (written.error?.__notConfigured) return notConfigured;
      return classify(written.error, sheetId);
    }

    headerInserted = true;
  }

  // (c) Freeze, colour and size the columns in one round trip, at the seller's width.
  const formatRequests: any[] = [
    {
      updateSheetProperties: {
        properties: { sheetId: gridId, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    },
    {
      repeatCell: {
        range: { sheetId: gridId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: width },
        cell: {
          userEnteredFormat: {
            backgroundColor: HEADER_BACKGROUND,
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            textFormat: {
              foregroundColor: { red: 1, green: 1, blue: 1 },
              bold: true,
              fontSize: 10,
            },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
      },
    },
    {
      // Runs after the header write above, so the widths fit the real titles.
      autoResizeDimensions: {
        dimensions: { sheetId: gridId, dimension: 'COLUMNS', startIndex: 0, endIndex: width },
      },
    },
  ];

  // When the selection shrank, the old green band lingers on the now-empty trailing
  // header cells. Reset just those row-1 cells to a plain format so no ghost header
  // band is left behind. Only row 1 is touched, never the seller's data below it.
  if (existing.length > width) {
    formatRequests.push({
      repeatCell: {
        range: {
          sheetId: gridId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: width,
          endColumnIndex: OUTBOUND_COLUMN_DEFS.length,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 1, green: 1, blue: 1 },
            horizontalAlignment: 'LEFT',
            textFormat: { foregroundColor: { red: 0, green: 0, blue: 0 }, bold: false },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,textFormat)',
      },
    });
  }

  const formatted = await call('POST', batchUrl, { requests: formatRequests });
  if (!formatted.ok) {
    if (formatted.error?.__notConfigured) return notConfigured;
    return classify(formatted.error, sheetId);
  }

  // The sort/filter band goes in its own call, and its failure is deliberately
  // swallowed: a tab that already carries a basic filter rejects setBasicFilter,
  // and losing the filter must not cost the seller the whole formatting pass.
  // clearBasicFilter runs first in the same batch so the common case still works.
  const filtered = await call('POST', batchUrl, {
    requests: [
      { clearBasicFilter: { sheetId: gridId } },
      {
        setBasicFilter: {
          filter: {
            range: {
              sheetId: gridId,
              startRowIndex: 0,
              startColumnIndex: 0,
              endColumnIndex: width,
            },
          },
        },
      },
    ],
  });
  if (!filtered.ok && filtered.error?.__notConfigured) return notConfigured;

  return success({ headerInserted });
}

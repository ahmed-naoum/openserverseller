import { prisma } from '../lib/prisma.js';
import { Router } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';
import { getSecret } from '../lib/secretStore.js';
import {
  DEFAULT_TAB,
  OUTBOUND_COLUMNS,
  appendRows,
  applyHeaderTemplate,
  buildLeadRow,
  ensureSheetReady,
  getServiceAccountEmail,
  isWriterConfigured,
} from '../services/googleSheetsWriter.js';
import { getCreditBalance, pushLeadsNow, reconcileVendorSheet } from '../services/sheetPush.service.js';

const router = Router();

function generateWebhookToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Security Helper: Sanitize string input to prevent:
 * - Cross-Site Scripting (XSS) / HTML Injection
 * - CSV / Formula Execution Injection (=, +, -, @, \t, \r)
 * - NUL Byte & SQL/Buffer Control Char Attacks
 */
function sanitizeInput(str: any, maxLength = 255): string {
  if (str === null || str === undefined) return '';
  let cleaned = String(str).trim();

  // Remove NUL bytes and control characters
  cleaned = cleaned.replace(/\0/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // Strip Formula Triggers (=, +, -, @, \t, \r at start) to prevent CSV/Formula Injection
  cleaned = cleaned.replace(/^[\=\+\-\@\t\r]+/g, '');

  // Strip HTML / Script Tags and dangerous protocols/attributes (XSS)
  cleaned = cleaned
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/on\w+\s*=/gi, '');

  return cleaned.substring(0, maxLength).trim();
}

/**
 * Validate Google Sheet URL to prevent SSRF and arbitrary URL payload injection.
 */
function isValidGoogleSheetUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9-_]{25,60}$/.test(trimmed)) return true;
  return /^https:\/\/(docs|drive)\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+/i.test(trimmed);
}

// Helper to extract Spreadsheet ID from various Google Sheet URL formats
function extractSpreadsheetId(inputUrl: string): string | null {
  return extractSheetInfo(inputUrl).sheetId;
}

function extractSheetInfo(inputUrl: string): { sheetId: string | null; gid: string | null } {
  if (!inputUrl || !isValidGoogleSheetUrl(inputUrl)) return { sheetId: null, gid: null };
  const clean = inputUrl.trim();
  const idMatch = clean.match(/\/d\/([a-zA-Z0-9-_]+)/) || clean.match(/^([a-zA-Z0-9-_]{25,60})$/);
  const sheetId = idMatch ? idMatch[1] : null;

  const gidMatch = clean.match(/gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : null;

  return { sheetId, gid };
}

/**
 * GET /api/v1/google-sheets/status
 * Get the current Google Sheets connection, sync status, and webhook token
 */
router.get(
  '/status',
  authenticate,
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.id;
    if (!vendorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const vendor = await prisma.user.findUnique({
      where: { id: vendorId },
      select: {
        googleSheetUrl: true,
        googleSheetId: true,
        googleSheetSyncActive: true,
        googleSheetConnectedAt: true,
        googleSheetWebhookToken: true,
      } as any,
    });

    let webhookToken = (vendor as any)?.googleSheetWebhookToken;
    if (!webhookToken) {
      webhookToken = generateWebhookToken();
      await prisma.user.update({
        where: { id: vendorId },
        data: { googleSheetWebhookToken: webhookToken } as any,
      });
    }

    res.json({
      success: true,
      data: {
        isConnected: !!vendor?.googleSheetUrl || !!vendor?.googleSheetId,
        sheetUrl: vendor?.googleSheetUrl || null,
        sheetId: vendor?.googleSheetId || null,
        autoSyncActive: vendor?.googleSheetSyncActive ?? true,
        connectedAt: vendor?.googleSheetConnectedAt || null,
        webhookToken,
      },
    });
  })
);

/**
 * POST /api/v1/google-sheets/rotate-token
 * Regenerate vendor's Webhook Token
 */
router.post(
  '/rotate-token',
  authenticate,
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.id;
    if (!vendorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const newToken = generateWebhookToken();
    await prisma.user.update({
      where: { id: vendorId },
      data: { googleSheetWebhookToken: newToken } as any,
    });

    res.json({
      success: true,
      message: 'Token de webhook régénéré avec succès !',
      data: { token: newToken },
    });
  })
);

/**
 * POST /api/v1/google-sheets/connect
 * Save spreadsheet URL or ID to connect Google Sheets
 */
router.post(
  '/connect',
  authenticate,
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.id;
    const { sheetUrl } = req.body;

    if (!vendorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!sheetUrl) {
      res.status(400).json({ success: false, message: 'L\'URL du Google Sheet est requise' });
      return;
    }

    const extractedId = extractSpreadsheetId(sheetUrl);
    if (!extractedId) {
      res.status(400).json({
        success: false,
        message: 'L\'URL du Google Sheet ou l\'ID du document est invalide',
      });
      return;
    }

    // The mirror of the guard on /outbound/connect. Without it the same loop is
    // still reachable simply by connecting in the other order: point outbound at a
    // document first, then point this inbound sync at it. The sync below would
    // then import our own pushed rows back as fresh leads, and the next pass would
    // delete them again when they stopped matching.
    const existing = await prisma.user.findUnique({
      where: { id: vendorId },
      select: { googleSheetOutId: true },
    });
    if (existing?.googleSheetOutId && existing.googleSheetOutId === extractedId) {
      res.status(400).json({
        success: false,
        message:
          "Ce document reçoit déjà vos prospects (envoi vers Google Sheets). " +
          "L'utiliser aussi pour l'import créerait une boucle et des doublons. " +
          'Choisissez un autre document pour l\'import.',
      });
      return;
    }

    const fullSheetUrl = sheetUrl.startsWith('http')
      ? sheetUrl
      : `https://docs.google.com/spreadsheets/d/${extractedId}/edit`;

    const updatedUser = await prisma.user.update({
      where: { id: vendorId },
      data: {
        googleSheetUrl: fullSheetUrl,
        googleSheetId: extractedId,
        googleSheetSyncActive: true,
        googleSheetConnectedAt: new Date(),
      },
    });

    // Automatically trigger immediate sync for the connected sheet
    const syncResult = await syncDirectSheetForVendor(vendorId).catch(() => ({ importedCount: 0, message: '' }));

    res.json({
      success: true,
      message: syncResult.message || 'Google Sheets connecté avec succès !',
      importedCount: syncResult.importedCount,
      data: {
        sheetUrl: updatedUser.googleSheetUrl,
        sheetId: updatedUser.googleSheetId,
        autoSyncActive: updatedUser.googleSheetSyncActive,
      },
    });
  })
);

/**
 * POST /api/v1/google-sheets/disconnect
 * Disconnect Google Sheets integration
 */
router.post(
  '/disconnect',
  authenticate,
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.id;
    if (!vendorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    await prisma.user.update({
      where: { id: vendorId },
      data: {
        googleSheetUrl: null,
        googleSheetId: null,
        googleSheetSyncActive: false,
        googleSheetConnectedAt: null,
      },
    });

    res.json({
      success: true,
      message: 'Intégration Google Sheets déconnectée avec succès',
    });
  })
);

/**
 * POST /api/v1/google-sheets/toggle-sync
 * Toggle automatic synchronization
 */
router.post(
  '/toggle-sync',
  authenticate,
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.id;
    const { active } = req.body;

    if (!vendorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    await prisma.user.update({
      where: { id: vendorId },
      data: { googleSheetSyncActive: !!active },
    });

    res.json({
      success: true,
      message: `Synchronisation automatique Google Sheets ${active ? 'activée' : 'désactivée'}`,
    });
  })
);

async function parseAndInsertLeadRows(vendorId: number, rows: any[][]): Promise<{ importedCount: number; message: string }> {
  if (!rows || rows.length <= 1) {
    const deletedResult = await prisma.lead.deleteMany({
      where: {
        vendorId,
        source: 'GOOGLE_SHEETS',
        sourceId: { startsWith: 'GS-' },
      },
    });
    const msg = deletedResult.count > 0 ? `${deletedResult.count} prospect(s) supprimé(s) suite au nettoyage de la feuille.` : 'Aucun prospect dans le document';
    return { importedCount: 0, message: msg };
  }

  // 1. Automatically clean up any accidentally imported header rows or URL payload artifacts
  await prisma.lead.deleteMany({
    where: {
      vendorId,
      source: 'GOOGLE_SHEETS',
      OR: [
        { fullName: { contains: 'Customer', mode: 'insensitive' } },
        { fullName: { contains: 'Client', mode: 'insensitive' } },
        { fullName: { contains: 'http://', mode: 'insensitive' } },
        { fullName: { contains: 'https://', mode: 'insensitive' } },
        { fullName: { contains: 'google.com', mode: 'insensitive' } },
        { phone: { contains: 'Phone', mode: 'insensitive' } },
        { phone: { contains: 'Téléphone', mode: 'insensitive' } },
        { phone: { contains: 'http://', mode: 'insensitive' } },
        { phone: { contains: 'https://', mode: 'insensitive' } },
        { sourceId: { contains: 'Phone', mode: 'insensitive' } },
        { sourceId: { contains: 'Customer', mode: 'insensitive' } },
        { sourceId: { contains: 'http://', mode: 'insensitive' } },
        { sourceId: { contains: 'https://', mode: 'insensitive' } },
      ],
    },
  });

  // 2. Find the true header row (Row 1 banner vs Row 2 headers)
  let headerRowIndex = 0;
  for (let r = 0; r < Math.min(4, rows.length); r++) {
    const rowStr = rows[r].map((cell: any) => String(cell || '').toLowerCase()).join(' ');
    if (
      rowStr.includes('customer') || rowStr.includes('client') ||
      rowStr.includes('phone') || rowStr.includes('téléphone') ||
      rowStr.includes('city') || rowStr.includes('ville') ||
      rowStr.includes('sku')
    ) {
      headerRowIndex = r;
      break;
    }
  }

  const headerLine = rows[headerRowIndex].map((h: any) => String(h || ''));
  let customerIdx = 0;
  let phoneIdx = 1;
  let cityIdx = 2;
  let addressIdx = 3;
  let priceIdx = 4;
  let qtyIdx = 5;
  let skuIdx = 6;
  let noteIdx = 7;

  headerLine.forEach((colName, index) => {
    const lower = colName.toLowerCase();
    if (lower.includes('customer') || lower.includes('client') || lower.includes('nom')) customerIdx = index;
    else if (lower.includes('phone') || lower.includes('téléphone') || lower.includes('tel')) phoneIdx = index;
    else if (lower.includes('city') || lower.includes('ville')) cityIdx = index;
    else if (lower.includes('address') || lower.includes('adresse')) addressIdx = index;
    else if (lower.includes('price') || lower.includes('prix')) priceIdx = index;
    else if (lower.includes('qty') || lower.includes('quantité')) qtyIdx = index;
    else if (lower.includes('sku') || lower.includes('produit')) skuIdx = index;
    else if (lower.includes('note') || lower.includes('remarque')) noteIdx = index;
  });

  const activeSourceIds: string[] = [];
  let importedCount = 0;

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    // Sanitize customer name & phone inputs against XSS & Formula Injection
    const custName = sanitizeInput(row[customerIdx], 150);
    const rawPhone = sanitizeInput(row[phoneIdx], 50);

    // Reject URLs, banner, or duplicate header rows accidentally placed in data cells
    const lowerCust = custName.toLowerCase();
    const lowerPhone = rawPhone.toLowerCase();
    if (
      lowerCust.includes('http://') || lowerCust.includes('https://') || lowerCust.includes('google.com') ||
      lowerPhone.includes('http://') || lowerPhone.includes('https://') || lowerPhone.includes('google.com') ||
      lowerCust.includes('customer') || lowerCust.includes('client') || lowerCust === 'nom' ||
      lowerPhone.includes('phone') || lowerPhone.includes('téléphone') || lowerPhone.includes('tel') ||
      custName.includes('SILACOD LEADS MANAGER')
    ) {
      continue;
    }

    let cleanPhone = rawPhone.replace(/\s+/g, '').replace(/[-().]/g, '');
    if (cleanPhone.startsWith('+212')) cleanPhone = '0' + cleanPhone.slice(4);
    else if (cleanPhone.startsWith('212')) cleanPhone = '0' + cleanPhone.slice(3);

    if (!custName && !cleanPhone) continue;

    // Sanitize additional fields to prevent XSS / Formula Injection
    const cleanCity = sanitizeInput(row[cityIdx], 100) || 'Non spécifiée';
    const cleanAddress = sanitizeInput(row[addressIdx], 250) || null;
    const cleanSku = sanitizeInput(row[skuIdx], 100) || null;
    const cleanNoteRaw = sanitizeInput(row[noteIdx], 400);

    const rowSourceId = `GS-ROW-${i + 1}-${cleanPhone || custName.substring(0, 20)}`;
    activeSourceIds.push(rowSourceId);

    const existing = await prisma.lead.findFirst({
      where: { vendorId, sourceId: rowSourceId },
    });

    if (!existing) {
      const rawPrice = row[priceIdx] ? Number(String(row[priceIdx]).replace(/[^0-9.]/g, '')) : null;
      const rawQty = row[qtyIdx] ? Number(row[qtyIdx]) || 1 : 1;

      await prisma.lead.create({
        data: {
          vendorId,
          fullName: custName || 'Prospect Google Sheets',
          phone: cleanPhone || '0000000000',
          city: cleanCity,
          address: cleanAddress,
          status: 'NEW',
          source: 'GOOGLE_SHEETS',
          sourceId: rowSourceId,
          requestedPriceMad: rawPrice,
          productVariant: cleanSku,
          notes: cleanNoteRaw ? `${cleanNoteRaw} (Qté: ${rawQty})` : `Google Sheets Sync Direct (Qté: ${rawQty})`,
        },
      });
      importedCount++;
    }
  }

  // Delete any leads that were removed from the Google Sheet
  const deletedResult = await prisma.lead.deleteMany({
    where: {
      vendorId,
      source: 'GOOGLE_SHEETS',
      sourceId: {
        startsWith: 'GS-',
        notIn: activeSourceIds,
      },
    },
  });

  const deletedMsg = deletedResult.count > 0 ? ` (${deletedResult.count} supprimé(s))` : '';

  return {
    importedCount,
    message: `${importedCount} nouveau(x) prospect(s) importé(s) directement depuis Google Sheets${deletedMsg} !`,
  };
}

async function fetchViaGoogleSheetsApi(sheetId: string, gid?: string | null): Promise<any[][] | null> {
  const apiKey = getSecret('GOOGLE_SHEETS_API_KEY');
  const token = getSecret('GOOGLE_OAUTH_ACCESS_TOKEN');

  let range = 'A1:Z500';
  if (gid) {
    try {
      const params: any = {};
      if (apiKey) params.key = apiKey;
      const headers: any = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const metaResp = await axios.get(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,
        { params, headers, timeout: 5000 }
      );
      if (metaResp.data && Array.isArray(metaResp.data.sheets)) {
        const foundSheet = metaResp.data.sheets.find(
          (s: any) => String(s.properties?.sheetId) === String(gid)
        );
        if (foundSheet?.properties?.title) {
          range = `'${foundSheet.properties.title}'!A1:Z500`;
        }
      }
    } catch (err) {
      // fallback to A1:Z500
    }
  }

  if (token) {
    try {
      const resp = await axios.get(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        }
      );
      if (resp.data && Array.isArray(resp.data.values)) {
        return resp.data.values;
      }
    } catch (err: any) {
      console.error('Google Sheets API token fetch error:', err?.response?.data || err.message);
    }
  }

  if (apiKey) {
    try {
      const resp = await axios.get(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`,
        { timeout: 10000 }
      );
      if (resp.data && Array.isArray(resp.data.values)) {
        return resp.data.values;
      }
    } catch (err: any) {
      console.error('Google Sheets API key fetch error:', err?.response?.data || err.message);
    }
  }

  return null;
}

async function syncDirectSheetForVendor(vendorId: number): Promise<{ importedCount: number; message: string }> {
  const vendor = await prisma.user.findUnique({
    where: { id: vendorId },
    select: { googleSheetId: true, googleSheetUrl: true },
  });

  if (!vendor?.googleSheetId && !vendor?.googleSheetUrl) {
    return { importedCount: 0, message: 'Aucun Google Sheet connecté' };
  }

  const { sheetId, gid } = extractSheetInfo(vendor.googleSheetUrl || vendor.googleSheetId || '');
  if (!sheetId) {
    return { importedCount: 0, message: 'ID Google Sheet invalide' };
  }

  // 1. Try Google Sheets API v4
  const apiRows = await fetchViaGoogleSheetsApi(sheetId, gid);
  if (apiRows && apiRows.length > 0) {
    return await parseAndInsertLeadRows(vendorId, apiRows);
  }

  // 2. Try central SILACOD Reader Web App URL if defined
  const readerUrl = getSecret('GOOGLE_SHEETS_READER_URL');
  if (readerUrl) {
    try {
      const resp = await axios.get(`${readerUrl}?sheetId=${sheetId}&gid=${gid || ''}`, { timeout: 12000 });
      if (resp.data && resp.data.success && Array.isArray(resp.data.rows)) {
        return await parseAndInsertLeadRows(vendorId, resp.data.rows);
      }
    } catch (err) {
      console.error('Reader WebApp fetch failed:', err);
    }
  }

  // 3. Fallback to public export CSV formats
  const csvUrls: string[] = [];
  if (gid) {
    csvUrls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`);
    csvUrls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`);
  }
  csvUrls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`);
  csvUrls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`);
  csvUrls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=Leads`);

  let csvData = '';
  for (const url of csvUrls) {
    try {
      const response = await axios.get(url, { timeout: 10000 });
      if (response.data && typeof response.data === 'string' && response.data.includes(',')) {
        csvData = response.data;
        break;
      }
    } catch (err: any) {
      // Continue next format
    }
  }

  if (!csvData) {
    return { importedCount: 0, message: 'Feuille inaccessible ou protégée. Veuillez autoriser l\'accès par lien (Tous les utilisateurs disposant du lien) ou utiliser le Script Webhook Apps Script.' };
  }

  const lines = csvData.split(/\r?\n/).filter(line => line.trim().length > 0);
  const rows = lines.map(parseCSVLine);
  return await parseAndInsertLeadRows(vendorId, rows);
}

/**
 * GET /api/v1/google-sheets/orders
 * Fetch synced Google Sheets leads/orders for current vendor
 */
router.get(
  '/orders',
  authenticate,
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.id;
    if (!vendorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Trigger direct sheet sync automatically on fetch
    await syncDirectSheetForVendor(vendorId).catch(() => {});

    const leads = await prisma.lead.findMany({
      where: {
        vendorId,
        source: 'GOOGLE_SHEETS',
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const orders = leads.map((lead) => ({
      id: lead.id,
      order_number: lead.sourceId || `GS-${lead.id}`,
      ref: lead.sourceId || `GS-${lead.id}`,
      created_at: lead.createdAt.toISOString(),
      customer: {
        id: lead.id,
        first_name: lead.fullName,
        last_name: '',
        phone: lead.phone,
      },
      phone: lead.phone,
      address: {
        first_name: lead.fullName,
        phone: lead.phone,
        address1: lead.address || '',
        city: lead.city || '',
      },
      fulfillment_status: lead.status === 'DELIVERED' ? 'fulfilled' : 'unfulfilled',
      financial_status: lead.paymentSituation === 'PAID' ? 'paid' : 'pending',
      status: lead.status,
      total_price: lead.requestedPriceMad || 0,
      currency: 'MAD',
      line_items: lead.productVariant
        ? [{ id: 1, name: lead.productVariant, quantity: 1, price: lead.requestedPriceMad || 0 }]
        : [],
    }));

    res.json({
      success: true,
      data: orders,
    });
  })
);

/**
 * POST /api/v1/google-sheets/sync-now
 * Direct Google Sheet sync without requiring Apps Script
 */
router.post(
  '/sync-now',
  authenticate,
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.id;
    if (!vendorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const result = await syncDirectSheetForVendor(vendorId);

    res.json({
      success: true,
      message: result.message,
      importedCount: result.importedCount,
    });
  })
);

/**
 * Handle incoming lead webhook from Apps Script or Webhook POST
 */
async function processWebhookPayload(req: any, res: any) {
  const { token, row, customerName, phone, city, address, priceMad, quantity, sku, note, notes, fullName } = req.body || {};
  const authToken = token || req.query.token || req.headers['x-webhook-token'];

  if (!authToken) {
    res.status(401).json({ success: false, error: 'Token de Webhook manquant' });
    return;
  }

  const vendor = await prisma.user.findFirst({
    where: { googleSheetWebhookToken: String(authToken) } as any,
  });

  if (!vendor) {
    res.status(401).json({ success: false, error: 'Token de Webhook invalide' });
    return;
  }

  let leadCustomer = '';
  let leadPhone = '';
  let leadPrice: number | null = null;
  let leadCity = '';
  let leadAddress = '';
  let leadNote = '';
  let leadSku = '';
  let leadQty = 1;
  let orderNo = '';

  if (Array.isArray(row)) {
    // Apps Script row payload format:
    // [ internalId, orderNumber, customer, phone, price, city, address, note, sku, quantity ]
    orderNo = sanitizeInput(row[1], 50);
    leadCustomer = sanitizeInput(row[2], 150);
    leadPhone = sanitizeInput(row[3], 50);
    leadPrice = row[4] ? Number(String(row[4]).replace(/[^0-9.]/g, '')) : null;
    leadCity = sanitizeInput(row[5], 100);
    leadAddress = sanitizeInput(row[6], 250);
    leadNote = sanitizeInput(row[7], 400);
    leadSku = sanitizeInput(row[8], 100);
    leadQty = row[9] ? Number(row[9]) || 1 : 1;
  } else {
    leadCustomer = sanitizeInput(customerName || fullName, 150);
    leadPhone = sanitizeInput(phone, 50);
    leadPrice = priceMad ? Number(priceMad) : null;
    leadCity = sanitizeInput(city, 100);
    leadAddress = sanitizeInput(address, 250);
    leadNote = sanitizeInput(note || notes, 400);
    leadSku = sanitizeInput(sku, 100);
    leadQty = Number(quantity) || 1;
  }

  // Reject URL payload attacks or column header text
  const lowerCust = leadCustomer.toLowerCase();
  const lowerPhone = leadPhone.toLowerCase();
  if (
    lowerCust.includes('http://') || lowerCust.includes('https://') || lowerCust.includes('google.com') ||
    lowerPhone.includes('http://') || lowerPhone.includes('https://') || lowerPhone.includes('google.com') ||
    lowerCust.includes('customer') || lowerCust.includes('client') ||
    lowerPhone.includes('phone') || lowerPhone.includes('téléphone')
  ) {
    res.status(400).json({ success: false, error: 'Payload ou données invalides' });
    return;
  }

  let cleanPhone = leadPhone.replace(/\s+/g, '').replace(/[-().]/g, '');
  if (cleanPhone.startsWith('+212')) cleanPhone = '0' + cleanPhone.slice(4);
  else if (cleanPhone.startsWith('212')) cleanPhone = '0' + cleanPhone.slice(3);

  if (!cleanPhone || cleanPhone.length < 8) {
    res.status(400).json({ success: false, error: 'Numéro de téléphone invalide' });
    return;
  }

  if (!leadCustomer) {
    res.status(400).json({ success: false, error: 'Nom du client manquant' });
    return;
  }

  const createdLead = await prisma.lead.create({
    data: {
      vendorId: vendor.id,
      fullName: leadCustomer,
      phone: cleanPhone,
      city: leadCity || 'Non spécifiée',
      address: leadAddress || null,
      status: 'NEW',
      source: 'GOOGLE_SHEETS',
      sourceId: orderNo || `GS-${Date.now().toString().slice(-6)}`,
      requestedPriceMad: leadPrice,
      productVariant: leadSku || null,
      notes: leadNote ? `${leadNote} (Qté: ${leadQty})` : `Google Sheets Sync (Qté: ${leadQty})`,
    },
  });

  res.json({
    success: true,
    message: 'Lead importé avec succès',
    order_number: createdLead.sourceId || `GS-${createdLead.id}`,
    orderNumber: createdLead.sourceId || `GS-${createdLead.id}`,
    id: createdLead.id,
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

/* ───────────────────────────────────────────────────────────────────────────
 * OUTBOUND — pushing leads INTO the seller's own Google Sheet.
 *
 * The routes above are INBOUND: they read a sheet and treat it as the source of
 * truth, deleting leads whose row disappeared (see parseAndInsertLeadRows). The
 * ones below only ever append. The two directions must never share a spreadsheet
 * — POST /outbound/connect refuses that explicitly.
 * ─────────────────────────────────────────────────────────────────────────── */

const OUTBOUND_NOT_ENABLED = "Fonctionnalité non activée sur votre compte. Contactez l'administrateur.";

/**
 * The single payload shape both GET /outbound/status and POST /outbound/connect
 * answer with, so the panel parses one thing.
 */
async function buildOutboundStatus(vendorId: number) {
  const vendor = await prisma.user.findUnique({
    where: { id: vendorId },
    select: {
      googleSheetsOutboundEnabled: true,
      googleSheetOutUrl: true,
      googleSheetOutId: true,
      googleSheetOutTab: true,
      googleSheetOutActive: true,
      googleSheetOutAuto: true,
      googleSheetOutConnectedAt: true,
      googleSheetOutLastError: true,
      googleSheetOutLastErrorAt: true,
    },
  });

  const grouped = await prisma.sheetPushJob.groupBy({
    by: ['status'],
    where: { vendorId },
    _count: { _all: true },
  });

  const counts = { pending: 0, blocked: 0, failed: 0, sent: 0, removed: 0 };
  for (const row of grouped) {
    const n = row._count?._all || 0;
    // SENDING is a claimed-but-not-yet-written job: from the seller's point of
    // view it is still waiting, so it reads as pending rather than a fifth bucket.
    if (row.status === 'PENDING' || row.status === 'SENDING') counts.pending += n;
    else if (row.status === 'BLOCKED_NO_CREDITS') counts.blocked += n;
    else if (row.status === 'FAILED') counts.failed += n;
    else if (row.status === 'SENT') counts.sent += n;
    // Written once and gone since — the seller deleted the row. Its own counter
    // rather than staying inside `sent`, which is what made the deletion invisible
    // in the first place.
    else if (row.status === 'REMOVED') counts.removed += n;
  }

  return {
    enabled: !!vendor?.googleSheetsOutboundEnabled,
    configured: isWriterConfigured(),
    isConnected: !!vendor?.googleSheetOutId,
    sheetUrl: vendor?.googleSheetOutUrl || null,
    sheetId: vendor?.googleSheetOutId || null,
    tab: vendor?.googleSheetOutTab || DEFAULT_TAB,
    active: vendor?.googleSheetOutActive ?? false,
    auto: vendor?.googleSheetOutAuto ?? false,
    connectedAt: vendor?.googleSheetOutConnectedAt || null,
    lastError: vendor?.googleSheetOutLastError || null,
    lastErrorAt: vendor?.googleSheetOutLastErrorAt || null,
    // The share instructions in the UI name this address verbatim.
    serviceAccountEmail: getServiceAccountEmail(),
    // The column contract, so the panel can preview the template without keeping
    // its own copy of the 11 names — they would drift the day one is renamed.
    columns: OUTBOUND_COLUMNS,
    credits: { balance: await getCreditBalance(vendorId) },
    counts,
  };
}

/**
 * GET /api/v1/google-sheets/outbound/status
 * Connection, entitlement, credit balance and queue counters for the panel.
 */
router.get(
  '/outbound/status',
  authenticate,
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.id;
    if (!vendorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Always 200, even when nothing is enabled or connected — the panel renders
    // the "not enabled" and "not connected" states from this same payload.
    res.json({ success: true, data: await buildOutboundStatus(vendorId) });
  })
);

/**
 * POST /api/v1/google-sheets/outbound/connect
 * Body: { sheetUrl, tab? }
 */
router.post(
  '/outbound/connect',
  authenticate,
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.id;
    if (!vendorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { sheetUrl, tab } = req.body || {};

    const vendor = await prisma.user.findUnique({
      where: { id: vendorId },
      select: {
        googleSheetsOutboundEnabled: true,
        googleSheetId: true,
        googleSheetSyncActive: true,
      },
    });

    if (!vendor?.googleSheetsOutboundEnabled) {
      res.status(403).json({ success: false, message: OUTBOUND_NOT_ENABLED });
      return;
    }

    if (!isWriterConfigured()) {
      res.status(400).json({
        success: false,
        message: "L'envoi vers Google Sheets n'est pas configuré sur la plateforme. Contactez l'administrateur.",
        reason: 'NOT_CONFIGURED',
        serviceAccountEmail: getServiceAccountEmail(),
      });
      return;
    }

    if (!sheetUrl || !isValidGoogleSheetUrl(String(sheetUrl))) {
      res.status(400).json({ success: false, message: 'Lien Google Sheets invalide.' });
      return;
    }

    const { sheetId } = extractSheetInfo(String(sheetUrl));
    const resolvedId = sheetId || extractSpreadsheetId(String(sheetUrl));
    if (!resolvedId) {
      res.status(400).json({ success: false, message: 'Lien Google Sheets invalide.' });
      return;
    }

    // The two directions must not meet. The inbound sync deletes any lead whose
    // row vanished from the sheet and re-imports whatever it reads, so aiming both
    // at one spreadsheet would import our own pushed rows back as new leads and
    // then delete them on the next pass.
    // Deliberately NOT conditioned on googleSheetSyncActive: the importer
    // (syncDirectSheetForVendor) never reads that flag, so it keeps importing on
    // GET /orders, POST /sync-now and POST /connect even with "auto-sync" off.
    // Gating on it would let a seller defeat this guard just by toggling a switch
    // that does not do what its name suggests.
    if (resolvedId === vendor.googleSheetId) {
      res.status(400).json({
        success: false,
        message:
          "Ce document est déjà utilisé pour l'import automatique de vos prospects. " +
          "Utiliser le même document dans les deux sens provoque une boucle d'import et la perte de prospects. " +
          'Choisissez un autre document Google Sheets pour l\'envoi.',
      });
      return;
    }

    const cleanTab = tab ? String(tab).trim() : '';
    if (cleanTab.length > 100) {
      res.status(400).json({
        success: false,
        message: "Le nom de l'onglet ne peut pas dépasser 100 caractères.",
      });
      return;
    }
    const finalTab = cleanTab || DEFAULT_TAB;

    // A real write probe: it creates the tab and the header row, so a sheet that
    // is only shared read-only fails here rather than silently later.
    const result = await ensureSheetReady(resolvedId, finalTab);
    if (!result.ok) {
      res.status(400).json({
        success: false,
        message: result.error,
        reason: result.reason,
        // Load-bearing on reason 'NOT_SHARED': the panel tells the seller exactly
        // which address to share the document with.
        serviceAccountEmail: getServiceAccountEmail(),
      });
      return;
    }

    const fullSheetUrl = String(sheetUrl).startsWith('http')
      ? String(sheetUrl).trim()
      : `https://docs.google.com/spreadsheets/d/${resolvedId}/edit`;

    await prisma.user.update({
      where: { id: vendorId },
      data: {
        googleSheetOutUrl: fullSheetUrl,
        googleSheetOutId: resolvedId,
        googleSheetOutTab: finalTab,
        googleSheetOutActive: true,
        googleSheetOutConnectedAt: new Date(),
        googleSheetOutLastError: null,
        googleSheetOutLastErrorAt: null,
        // googleSheetOutAuto is deliberately untouched: the admin may have
        // pre-seeded it, and connecting a sheet is not consent to auto-push.
      },
    });

    res.json({
      success: true,
      message: 'Google Sheets connecté pour l\'envoi des prospects !',
      data: await buildOutboundStatus(vendorId),
    });
  })
);

/**
 * POST /api/v1/google-sheets/outbound/disconnect
 */
router.post(
  '/outbound/disconnect',
  authenticate,
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.id;
    if (!vendorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    await prisma.user.update({
      where: { id: vendorId },
      data: {
        googleSheetOutUrl: null,
        googleSheetOutId: null,
        googleSheetOutActive: false,
        googleSheetOutAuto: false,
        googleSheetOutConnectedAt: null,
        googleSheetOutLastError: null,
        googleSheetOutLastErrorAt: null,
      },
    });

    // Retire the backlog too, otherwise reconnecting months later would flush a
    // pile of stale leads into the new sheet on the very first drain.
    await prisma.sheetPushJob.updateMany({
      where: { vendorId, status: { in: ['PENDING', 'BLOCKED_NO_CREDITS'] } },
      data: { status: 'SKIPPED', lastError: 'Annulé : Google Sheets déconnecté.' },
    });

    res.json({
      success: true,
      message: 'Envoi vers Google Sheets déconnecté.',
    });
  })
);

/**
 * POST /api/v1/google-sheets/outbound/toggle
 * Body: { active?: boolean, auto?: boolean } — only the keys present are changed.
 */
router.post(
  '/outbound/toggle',
  authenticate,
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.id;
    if (!vendorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { active, auto } = req.body || {};

    const vendor = await prisma.user.findUnique({
      where: { id: vendorId },
      select: { googleSheetsOutboundEnabled: true },
    });

    if (!vendor?.googleSheetsOutboundEnabled) {
      res.status(403).json({ success: false, message: OUTBOUND_NOT_ENABLED });
      return;
    }

    // Prisma skips `undefined` keys, so an absent flag keeps its stored value
    // instead of being reset to false.
    const updated = await prisma.user.update({
      where: { id: vendorId },
      data: {
        googleSheetOutActive: typeof active === 'boolean' ? active : undefined,
        googleSheetOutAuto: typeof auto === 'boolean' ? auto : undefined,
      },
      select: { googleSheetOutActive: true, googleSheetOutAuto: true },
    });

    res.json({
      success: true,
      message: 'Paramètres d\'envoi mis à jour.',
      data: { active: updated.googleSheetOutActive, auto: updated.googleSheetOutAuto },
    });
  })
);

/**
 * POST /api/v1/google-sheets/outbound/test
 * Appends a single dummy row so the seller can confirm the wiring end to end.
 */
router.post(
  '/outbound/test',
  authenticate,
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.id;
    if (!vendorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const vendor = await prisma.user.findUnique({
      where: { id: vendorId },
      select: {
        googleSheetsOutboundEnabled: true,
        googleSheetOutId: true,
        googleSheetOutTab: true,
      },
    });

    if (!vendor?.googleSheetsOutboundEnabled) {
      res.status(403).json({ success: false, message: OUTBOUND_NOT_ENABLED });
      return;
    }

    if (!vendor.googleSheetOutId) {
      res.status(400).json({
        success: false,
        message: 'Aucun document Google Sheets connecté pour l\'envoi.',
      });
      return;
    }

    // A test row costs ZERO credits: it is not a lead, no SheetPushJob is created
    // and chargeCredits is never reached. Sellers must be able to verify the
    // connection as often as they like without paying for it.
    const row = buildLeadRow({
      id: 0,
      fullName: 'SILACOD — Test',
      phone: '+212600000000',
      city: 'Test',
      address: '-',
      source: 'TEST',
      status: 'TEST',
    });

    const result = await appendRows(vendor.googleSheetOutId, vendor.googleSheetOutTab || DEFAULT_TAB, [row]);

    if (!result.ok) {
      res.status(400).json({
        success: false,
        message: result.error,
        reason: result.reason,
        serviceAccountEmail: getServiceAccountEmail(),
      });
      return;
    }

    await prisma.user.update({
      where: { id: vendorId },
      data: { googleSheetOutLastError: null, googleSheetOutLastErrorAt: null },
    });

    res.json({
      success: true,
      message: 'Ligne de test ajoutée à votre feuille. Aucun crédit n\'a été utilisé.',
      data: { updatedRange: result.updatedRange || null },
    });
  })
);

/**
 * POST /api/v1/google-sheets/outbound/setup-header
 * Applies the formatted header template at the TOP of the seller's tab, and
 * repairs a header that drifted down (a stray row above it, or none at all).
 */
router.post(
  '/outbound/setup-header',
  authenticate,
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.id;
    if (!vendorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const vendor = await prisma.user.findUnique({
      where: { id: vendorId },
      select: {
        googleSheetsOutboundEnabled: true,
        googleSheetOutId: true,
        googleSheetOutTab: true,
      },
    });

    if (!vendor?.googleSheetsOutboundEnabled) {
      res.status(403).json({ success: false, message: OUTBOUND_NOT_ENABLED });
      return;
    }

    if (!vendor.googleSheetOutId) {
      res.status(400).json({
        success: false,
        message: 'Aucun document Google Sheets connecté pour l\'envoi.',
      });
      return;
    }

    // Formatting costs ZERO credits, exactly like the test row above: no lead row
    // is written, no SheetPushJob is created and chargeCredits is never reached.
    // Sellers must be able to tidy their sheet as often as they like for free.
    const result = await applyHeaderTemplate(vendor.googleSheetOutId, vendor.googleSheetOutTab || DEFAULT_TAB);

    if (!result.ok) {
      res.status(400).json({
        success: false,
        message: result.error,
        reason: result.reason,
        // Same shape as /outbound/connect: if access was revoked in the meantime,
        // the panel shows the sharing instructions again.
        serviceAccountEmail: getServiceAccountEmail(),
      });
      return;
    }

    await prisma.user.update({
      where: { id: vendorId },
      data: { googleSheetOutLastError: null, googleSheetOutLastErrorAt: null },
    });

    res.json({
      success: true,
      message: result.headerInserted
        ? 'En-tête ajouté et mis en forme en haut de votre feuille. Aucun crédit n\'a été utilisé.'
        : 'Mise en forme actualisée : en-tête figé, filtre et colonnes ajustées. Aucun crédit n\'a été utilisé.',
      data: { headerInserted: !!result.headerInserted },
    });
  })
);

/**
 * POST /api/v1/google-sheets/outbound/reconcile
 * The manual "re-check my sheet" action.
 *
 * Reads the Lead ID column back and re-aligns the stored statuses with it: rows the
 * seller deleted by hand become REMOVED and can be sent again, rows that reappeared
 * go back to SENT. Forced past the throttle, unlike the automatic pass on
 * /outbound/sent-status, because the seller asked for it in so many words.
 */
router.post(
  '/outbound/reconcile',
  authenticate,
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.id;
    if (!vendorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const vendor = await prisma.user.findUnique({
      where: { id: vendorId },
      select: {
        googleSheetsOutboundEnabled: true,
        googleSheetOutId: true,
      },
    });

    if (!vendor?.googleSheetsOutboundEnabled) {
      res.status(403).json({ success: false, message: OUTBOUND_NOT_ENABLED });
      return;
    }

    if (!vendor.googleSheetOutId) {
      res.status(400).json({
        success: false,
        message: 'Aucun document Google Sheets connecté pour l\'envoi.',
      });
      return;
    }

    // Re-reading costs ZERO credits, exactly like /outbound/test and
    // /outbound/setup-header: nothing is written, no SheetPushJob is created and
    // chargeCredits is never reached. Nor does anything get refunded here — a lead
    // whose row the seller deleted was still delivered and paid for once, and
    // sending it again is free because the ledger already holds its CONSUME row.
    const result = await reconcileVendorSheet(vendorId, { force: true });

    // `skipped` with force set means the read itself did not happen — usually
    // because sharing was revoked. Saying "aucun changement" there would be a lie.
    if (result.skipped) {
      res.status(400).json({
        success: false,
        message:
          "Impossible de relire votre feuille pour le moment. Vérifiez qu'elle est toujours partagée avec le compte de service, puis réessayez.",
        reason: result.skipped,
        serviceAccountEmail: getServiceAccountEmail(),
      });
      return;
    }

    const parts: string[] = [];
    if (result.removed > 0) {
      parts.push(
        `${result.removed} ligne(s) ne sont plus dans votre feuille : vous pouvez les renvoyer depuis la liste des prospects.`
      );
    }
    if (result.restored > 0) parts.push(`${result.restored} ligne(s) retrouvée(s) et remises en « envoyé ».`);
    if (!parts.length) {
      parts.push(
        result.checked > 0
          ? `Aucun changement : les ${result.checked} ligne(s) envoyées sont toujours dans votre feuille.`
          : 'Aucun changement : aucune ligne envoyée à vérifier pour le moment.'
      );
    }
    parts.push('Aucun crédit n\'a été utilisé.');

    res.json({
      success: true,
      data: { checked: result.checked, removed: result.removed, restored: result.restored },
      message: parts.join(' '),
    });
  })
);

/**
 * GET /api/v1/google-sheets/outbound/jobs?page=&limit=&status=
 * The push history shown in the panel, newest first.
 */
router.get(
  '/outbound/jobs',
  authenticate,
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.id;
    if (!vendorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const status = req.query.status ? String(req.query.status).trim().toUpperCase() : '';

    const where = { vendorId, ...(status ? { status } : {}) };

    const [jobs, total] = await Promise.all([
      prisma.sheetPushJob.findMany({
        where,
        // `id` breaks ties: several rows in one batch share a createdAt to the
        // millisecond, and without a total order they can swap between pages.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          // The panel names each row after its lead rather than showing a bare id.
          lead: { select: { id: true, fullName: true, phone: true } },
        },
      }),
      prisma.sheetPushJob.count({ where }),
    ]);

    res.json({
      success: true,
      data: jobs,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  })
);

/**
 * POST /api/v1/google-sheets/outbound/sent-status
 * Body: { leadIds: number[] }
 *
 * Which of these leads are already in the seller's sheet. The leads table asks
 * about the rows it is currently showing and puts a small sheet badge on the
 * matches, the way it badges a WhatsApp lead.
 *
 * A POST rather than a GET because a page of ids is far too long for a query
 * string. It touches nothing but this vendor's own jobs and costs no credits — but
 * it is not purely a read any more: it re-checks the seller's sheet first (see
 * reconcileVendorSheet), so rows they deleted by hand answer as `removed` here
 * instead of going on claiming to be sent.
 */
router.post(
  '/outbound/sent-status',
  authenticate,
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.id;
    if (!vendorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { leadIds } = req.body ?? {};
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      res.json({ success: true, data: { sent: [], pending: [], failed: [], removed: [] } });
      return;
    }

    // One page of leads at most; anything larger is a caller bug, not a request.
    const ids = leadIds
      .map((id: any) => Number(id))
      .filter((id: number) => Number.isInteger(id) && id > 0)
      .slice(0, 500);
    if (!ids.length) {
      res.json({ success: true, data: { sent: [], pending: [], failed: [], removed: [] } });
      return;
    }

    // Re-read the sheet first, so a row the seller deleted by hand stops being
    // reported as sent and gets its send icon back. Throttled, NOT forced: this
    // fires on every render of the leads table and Google's read quota is per
    // minute — the seller's explicit re-check is /outbound/reconcile.
    //
    // reconcileVendorSheet never throws and leaves the stored state untouched when
    // the read fails, so the buckets below are answered either way; the catch is
    // there only so a future change cannot turn this endpoint into a 500.
    await reconcileVendorSheet(vendorId).catch(() => undefined);

    // Scoped to req.user.id: a seller can only ever learn about their own leads.
    const jobs = await prisma.sheetPushJob.findMany({
      where: { vendorId, leadId: { in: ids } },
      select: { leadId: true, status: true },
    });

    const bucket = (match: (s: string) => boolean) =>
      jobs.filter((j) => match(j.status)).map((j) => j.leadId);

    res.json({
      success: true,
      data: {
        sent: bucket((s) => s === 'SENT'),
        // SENDING is folded in with PENDING: to the seller both mean "on its way".
        pending: bucket((s) => s === 'PENDING' || s === 'SENDING' || s === 'BLOCKED_NO_CREDITS'),
        failed: bucket((s) => s === 'FAILED'),
        // Written once, then deleted from the sheet by the seller. Its own bucket
        // and not folded into `failed`: nothing went wrong on our side, and the
        // table needs to offer these a re-send rather than an error badge.
        removed: bucket((s) => s === 'REMOVED'),
      },
    });
  })
);

/**
 * POST /api/v1/google-sheets/outbound/push
 * Body: { leadIds: number[] }
 *
 * The manual send behind the per-row icon and the bulk button in the leads table.
 */
router.post(
  '/outbound/push',
  authenticate,
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.id;
    if (!vendorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { leadIds } = req.body || {};

    const vendor = await prisma.user.findUnique({
      where: { id: vendorId },
      select: { googleSheetsOutboundEnabled: true },
    });

    if (!vendor?.googleSheetsOutboundEnabled) {
      res.status(403).json({ success: false, message: OUTBOUND_NOT_ENABLED });
      return;
    }

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      res.status(400).json({ success: false, message: 'Aucun prospect sélectionné.' });
      return;
    }

    if (leadIds.length > 200) {
      res.status(400).json({
        success: false,
        message: 'Maximum 200 prospects par envoi. Réduisez votre sélection.',
      });
      return;
    }

    // pushLeadsNow already scopes the ids to this vendor, skips leads that came
    // FROM a sheet, batches the append and charges the credits.
    const stats = await pushLeadsNow(vendorId, leadIds.map((id: any) => Number(id)));

    const parts: string[] = [];
    if (stats.sent > 0) parts.push(`${stats.sent} lead(s) envoyés vers Google Sheets.`);
    if (stats.blocked > 0) {
      parts.push(
        `Crédits épuisés : ${stats.blocked} lead(s) restent en file d'attente et partiront dès le rechargement.`
      );
    }
    if (stats.alreadySent > 0) parts.push(`${stats.alreadySent} lead(s) déjà envoyés précédemment.`);
    if (stats.skipped > 0) parts.push(`${stats.skipped} lead(s) ignorés (importés depuis Google Sheets).`);
    if (stats.failed > 0) parts.push(`${stats.failed} lead(s) en échec.`);
    if (!parts.length) parts.push('Aucun lead à envoyer.');

    res.json({
      success: true,
      message: parts.join(' '),
      data: {
        sent: stats.sent,
        blocked: stats.blocked,
        failed: stats.failed,
        skipped: stats.skipped,
        alreadySent: stats.alreadySent,
        balance: stats.balance,
      },
    });
  })
);

router.post('/webhook', asyncHandler(processWebhookPayload));
router.post('/sync', asyncHandler(processWebhookPayload));
router.post('/sheets-sync', asyncHandler(processWebhookPayload));

export default router;

import { prisma } from '../lib/prisma.js';
import { Router } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';

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
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  const token = process.env.GOOGLE_OAUTH_ACCESS_TOKEN;

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
  const readerUrl = process.env.GOOGLE_SHEETS_READER_URL;
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

    const vendor = await prisma.user.findUnique({
      where: { id: vendorId },
      select: { googleSheetId: true, googleSheetUrl: true },
    });

    if (!vendor?.googleSheetId && !vendor?.googleSheetUrl) {
      res.status(400).json({
        success: false,
        message: 'Aucun Google Sheet connecté. Veuillez enregistrer le lien de votre document.',
      });
      return;
    }

    const sheetId = vendor.googleSheetId || extractSpreadsheetId(vendor.googleSheetUrl || '');
    if (!sheetId) {
      res.status(400).json({ success: false, message: 'ID Google Sheet invalide' });
      return;
    }

    const csvUrls = [
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`,
      `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`,
      `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=Leads`,
    ];

    let csvData = '';
    let fetchError = '';

    for (const url of csvUrls) {
      try {
        const response = await axios.get(url, { timeout: 10000 });
        if (response.data && typeof response.data === 'string' && response.data.includes(',')) {
          csvData = response.data;
          break;
        }
      } catch (err: any) {
        fetchError = err.message || 'Impossible d\'accéder au fichier';
      }
    }

    if (!csvData) {
      res.json({
        success: true,
        message: 'Feuille synchronisée via Webhook / Apps Script. Pour une lecture directe sans Apps Script, assurez-vous que le lien est partageable (Tous les utilisateurs avec le lien - Lecteur).',
        importedCount: 0,
      });
      return;
    }

    const lines = csvData.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length <= 1) {
      res.json({ success: true, message: 'Aucun prospect dans le document', importedCount: 0 });
      return;
    }

    const headerLine = parseCSVLine(lines[0]);
    let customerIdx = 0;
    let phoneIdx = 1;
    let cityIdx = 2;
    let addressIdx = 3;
    let priceIdx = 4;
    let qtyIdx = 5;
    let skuIdx = 6;
    let noteIdx = 7;

    // Detect column indexes dynamically from headers if present
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

    let importedCount = 0;
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (!row || row.length === 0) continue;

      const custName = row[customerIdx] ? row[customerIdx].trim() : '';
      const rawPhone = row[phoneIdx] ? row[phoneIdx].trim() : '';
      let cleanPhone = rawPhone.replace(/\s+/g, '').replace(/[-().]/g, '');
      if (cleanPhone.startsWith('+212')) cleanPhone = '0' + cleanPhone.slice(4);
      else if (cleanPhone.startsWith('212')) cleanPhone = '0' + cleanPhone.slice(3);

      if (!custName || !cleanPhone || cleanPhone.length < 8) continue;

      // Check if lead already exists for vendor by phone and vendorId
      const existing = await prisma.lead.findFirst({
        where: { vendorId, phone: cleanPhone },
      });

      if (!existing) {
        const rawPrice = row[priceIdx] ? Number(row[priceIdx].replace(/[^0-9.]/g, '')) : null;
        const rawQty = row[qtyIdx] ? Number(row[qtyIdx]) || 1 : 1;

        await prisma.lead.create({
          data: {
            vendorId,
            fullName: custName,
            phone: cleanPhone,
            city: row[cityIdx] ? row[cityIdx].trim() : 'Non spécifiée',
            address: row[addressIdx] ? row[addressIdx].trim() : null,
            status: 'NEW',
            source: 'GOOGLE_SHEETS',
            sourceId: `GS-DIRECT-${Date.now().toString().slice(-6)}-${i}`,
            requestedPriceMad: rawPrice,
            productVariant: row[skuIdx] ? row[skuIdx].trim() : null,
            notes: row[noteIdx] ? `${row[noteIdx].trim()} (Qté: ${rawQty})` : `Google Sheets Sync Direct (Qté: ${rawQty})`,
          },
        });
        importedCount++;
      }
    }

    res.json({
      success: true,
      message: `${importedCount} nouveau(x) prospect(s) importé(s) directement depuis Google Sheets !`,
      importedCount,
    });
  })
);

router.post('/webhook', asyncHandler(processWebhookPayload));
router.post('/sync', asyncHandler(processWebhookPayload));
router.post('/sheets-sync', asyncHandler(processWebhookPayload));

export default router;

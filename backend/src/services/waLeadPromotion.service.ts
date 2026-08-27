/**
 * Promoting a WhatsApp conversation into a real Lead.
 *
 * Lives in services/ rather than in the route file because it has two callers
 * in two different processes: the account clicking "Créer le lead" in the inbox
 * (silacod-api), and the worker's autoCreateLead path (silacod-wa). Keeping it
 * on the router would have made the background worker import the HTTP layer to
 * reach it.
 *
 * It is also the one place the agent's output crosses into the platform's
 * BILLED pipeline, so it has exactly one home. A Lead is charged at
 * User.saisieFeeMad, reserves a Google Sheets credit, can be auto-forwarded to
 * the call center, and enters the auto-release cron — none of which may drift
 * between the manual and automatic paths.
 */

import { prisma } from '../lib/prisma.js';
import { enqueueSheetPush } from './sheetPush.service.js';
import { waLog } from './waLogs.service.js';
import { isSandboxJid } from '../wa/transport.js';

/**
 * Turns a conversation's collected draft into a Lead.
 *
 * `WhatsappContact.leadId` is the idempotency guard: promoting twice returns
 * the lead that already exists instead of creating a second one and billing the
 * account again.
 */
export async function promoteContactToLead(contactId: number) {
  const contact = await prisma.whatsappContact.findUniqueOrThrow({ where: { id: contactId } });

  if (contact.leadId) {
    const existing = await prisma.lead.findUnique({ where: { id: contact.leadId } });
    if (existing) return existing;
  }

  // A bench conversation must never become a real Lead. A Lead is billed at
  // User.saisieFeeMad, reserves a Google Sheets credit, can be auto-forwarded to
  // the call centre and enters the auto-release cron — so an account testing its
  // own agent with autoCreateLead on would otherwise pay for, and dispatch, a
  // customer that does not exist. Refused here rather than at the caller
  // because this function is the single crossing point into the billed
  // pipeline, and both callers reach it.
  if (isSandboxJid(contact.jid)) {
    throw new Error(
      "Conversation de test : aucun lead réel n'est créé depuis le banc d'essai. " +
        'Testez la prise de commande ici, puis vérifiez la création de lead sur une vraie conversation.'
    );
  }

  const draft = (contact.draft || {}) as Record<string, any>;

  // A lead with no dialable number is worthless AND billed: it costs
  // User.saisieFeeMad, reserves a Google Sheets credit, and can be forwarded to
  // the call centre, who cannot ring it. On a @lid chat WhatsApp hides the
  // number, so the agent has to collect it — refuse until it has.
  const phone = String(draft.phone || contact.phone || '').replace(/[^0-9+]/g, '');
  if (!phone) {
    throw new Error(
      "Ce contact n'a pas encore communiqué son numéro (WhatsApp le masque). " +
        "L'agent doit le demander, ou saisissez-le dans la fiche client avant de créer le lead."
    );
  }

  // Refuse the @lid identifier even when it is sitting in the draft.
  //
  // Before the transport learned that @lid digits are not a phone number, the
  // context block told the agent "Customer WhatsApp number: 279671610601709"
  // and the agent dutifully saved it with save_lead. Clearing the contact
  // column did not clear those drafts, so the fake outlived the fix and would
  // still have been billed as a real lead. The jid is the provenance, so the
  // jid is the check.
  const lidDigits = contact.jid.endsWith('@lid') ? contact.jid.split('@')[0] : null;
  if (lidDigits && phone.replace(/^\+/, '') === lidDigits) {
    throw new Error(
      "Le numéro enregistré est l'identifiant interne WhatsApp, pas un numéro joignable. " +
        "Demandez au client son vrai numéro et corrigez la fiche avant de créer le lead."
    );
  }

  const vendor = await prisma.user.findUniqueOrThrow({
    where: { id: contact.userId },
    select: { mode: true },
  });

  const lead = await prisma.lead.create({
    data: {
      vendorId: contact.userId,
      // The agent may never have got a name. The phone is the one thing every
      // WhatsApp conversation always has, so it is the fallback rather than
      // failing a promotion the account explicitly asked for.
      fullName: String(draft.full_name || contact.pushName || phone).slice(0, 200),
      phone,
      whatsapp: contact.phone || phone,
      city: draft.city ? String(draft.city).slice(0, 200) : null,
      address: draft.address ? String(draft.address).slice(0, 500) : null,
      status: 'NEW',
      // Lead.source is an open string set (it already carries ~21 raw Coliaty
      // codes), so this needs no schema change.
      source: 'WHATSAPP',
      sourceMode: vendor.mode === 'AFFILIATE' ? 'AFFILIATE' : 'VENDOR',
      productVariant: draft.variant ? String(draft.variant).slice(0, 200) : null,
      notes:
        [
          draft.product && `Produit : ${draft.product}`,
          draft.quantity && `Quantité : ${draft.quantity}`,
          draft.notes,
        ]
          .filter(Boolean)
          .join(' | ')
          .slice(0, 2000) || null,
      confirmedPriceMad: Number.isFinite(Number(draft.price)) ? Number(draft.price) : null,
    },
  });

  await prisma.whatsappContact.update({
    where: { id: contact.id },
    data: { leadId: lead.id, status: 'CONFIRMED', confirmedAt: contact.confirmedAt || new Date() },
  });

  // The moment the agent's work becomes something the account is BILLED for.
  // Logged at INFO whatever the level, on both the manual and automatic paths,
  // because "where did this lead come from" is a billing question.
  waLog({
    userId: contact.userId,
    contactId: contact.id,
    contactJid: contact.jid,
    contactName: contact.pushName,
    category: 'LEAD',
    event: 'lead.created',
    message: `Conversation promue en lead #${lead.id} (${lead.fullName}).`,
    request: { draft },
    response: { leadId: lead.id, phone: lead.phone, city: lead.city, source: lead.source },
    meta: { leadId: lead.id, sourceMode: lead.sourceMode },
  });

  // The same follow-up every other lead-creating path performs. Wrapped because
  // a Google Sheets problem must never undo a lead that is already committed.
  //
  // Argument order is (leadId, vendorId) and both are `number`, so a swap
  // compiles: this call passed them the wrong way round and every WhatsApp lead
  // silently missed its seller's sheet, because the vendor lookup on a lead id
  // found no user and the enqueue returned false instead of throwing.
  try {
    await enqueueSheetPush(lead.id, contact.userId, 'WHATSAPP');
  } catch (err) {
    waLog({
      userId: contact.userId,
      contactId: contact.id,
      contactJid: contact.jid,
      category: 'LEAD',
      event: 'lead.sheet_push_failed',
      message: `Lead #${lead.id} créé, mais son envoi vers Google Sheets n'a pas pu être mis en file.`,
      meta: { leadId: lead.id },
      error: err,
    });
    console.error('[wa/promote] sheet push enqueue failed:', err);
  }

  return lead;
}

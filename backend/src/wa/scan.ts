/**
 * `wa:scan` — one screen that answers "is any of this actually working?"
 *
 * WHY IT EXISTS. Every question worth asking about this subsystem has, until
 * now, needed someone with database access and twenty minutes: is the socket
 * up, is it a real connection or a dead one still reporting CONNECTED, are
 * customer messages reaching the server at all, is anything queued behind a
 * stuck job. The dashboard shows a green badge, and a green badge is exactly
 * what a broken session looks like.
 *
 * So this reads the four independent signals that together cannot lie:
 *
 *   1. The session row      — what we believe about the connection.
 *   2. The worker's claim   — whether a process is actually alive and holding it.
 *   3. Message flow         — whether anything has arrived, and when.
 *   4. The log stream       — whether Baileys is delivering events at all.
 *
 * A session can be CONNECTED in (1), heartbeating in (2), and still be dead:
 * that is precisely the failure this exists to make visible, and it shows up
 * here as silence in (3) and (4) while the first two look healthy.
 *
 * Run with:  npm run wa:scan
 */

import { prisma } from '../lib/prisma.js';
import { loadSecrets, getSecret } from '../lib/secretStore.js';

const MIN = 60_000;

/** Human-readable age, because raw ISO timestamps hide what matters here. */
function ago(d: Date | null | undefined): string {
  if (!d) return 'jamais';
  const ms = Date.now() - d.getTime();
  if (ms < MIN) return `il y a ${Math.round(ms / 1000)}s`;
  if (ms < 60 * MIN) return `il y a ${Math.round(ms / MIN)} min`;
  const h = ms / (60 * MIN);
  if (h < 48) return `il y a ${h.toFixed(1)} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

const line = (label: string, value: string) => console.log(`  ${label.padEnd(26)} ${value}`);

async function main(): Promise<void> {
  await loadSecrets();

  console.log('\n=============================================================');
  console.log('  SCAN AGENT WHATSAPP        ', new Date().toISOString());
  console.log('=============================================================');

  const sessions = await prisma.whatsappSession.findMany({
    include: { user: { select: { email: true, whatsappAgentEnabled: true } } },
  });

  if (!sessions.length) console.log('\nAucune session WhatsApp enregistrée.');

  for (const s of sessions) {
    console.log(`\n--- Compte ${s.userId} (${s.user?.email || '?'}) ---`);

    /* 1 — what we believe -------------------------------------------- */
    line('Statut', `${s.status}   (souhaité : ${s.desiredState})`);
    line('Numéro', s.phoneNumber || '(non lié)');
    line('Connecté depuis', `${ago(s.lastConnectedAt)}${s.lastConnectedAt ? ` — ${s.lastConnectedAt.toISOString()}` : ''}`);
    if (s.lastError) line('Dernière erreur', s.lastError.slice(0, 90));

    /* 2 — is a worker really holding it? ------------------------------ */
    //
    // The claim is heartbeated every reconcile tick (10s). Stale by more than
    // a minute means no live process owns this session, whatever `status` says
    // — the row is a leftover from a worker that died without releasing it.
    const claimAge = s.claimedAt ? Date.now() - s.claimedAt.getTime() : null;
    const claimHealthy = claimAge !== null && claimAge < MIN;
    line(
      'Worker actif',
      s.claimToken
        ? claimHealthy
          ? `OUI — battement ${ago(s.claimedAt)}`
          : `NON — battement figé ${ago(s.claimedAt)}  <-- personne ne tient cette session`
        : 'NON — aucune revendication'
    );

    /* 3 — is anything arriving? --------------------------------------- */
    const [lastIn, lastOut, totalIn, in24h, in1h] = await Promise.all([
      prisma.whatsappMessage.findFirst({
        where: { userId: s.userId, direction: 'IN' },
        orderBy: { id: 'desc' },
      }),
      prisma.whatsappMessage.findFirst({
        where: { userId: s.userId, direction: 'OUT' },
        orderBy: { id: 'desc' },
      }),
      prisma.whatsappMessage.count({ where: { userId: s.userId, direction: 'IN' } }),
      prisma.whatsappMessage.count({
        where: { userId: s.userId, direction: 'IN', createdAt: { gte: new Date(Date.now() - 24 * 60 * MIN) } },
      }),
      prisma.whatsappMessage.count({
        where: { userId: s.userId, direction: 'IN', createdAt: { gte: new Date(Date.now() - 60 * MIN) } },
      }),
    ]);

    console.log('\n  RÉCEPTION');
    line('Dernier message reçu', lastIn ? `${ago(lastIn.createdAt)} — ${lastIn.kind}` : 'AUCUN');
    line('Reçus (1 h / 24 h / total)', `${in1h} / ${in24h} / ${totalIn}`);
    line('Dernier message envoyé', lastOut ? `${ago(lastOut.createdAt)} — ${lastOut.kind}` : 'AUCUN');

    /* 4 — is Baileys delivering anything at all? ---------------------- */
    //
    // THE DIAGNOSTIC THAT MATTERS. Sending uses the socket we opened; receiving
    // depends on WhatsApp choosing to route to this device. When (1) and (2)
    // look healthy and outbound works while this section is empty, the fault is
    // the device registration, not the code — and re-linking is the fix.
    const since = new Date(Date.now() - 60 * MIN);
    const inboundLogs = await prisma.whatsappAgentLog.findMany({
      where: { userId: s.userId, category: 'INBOUND', createdAt: { gte: since } },
      orderBy: { id: 'desc' },
      take: 200,
    });

    const probes = inboundLogs.filter((l) => l.event.startsWith('probe.') && l.event !== 'probe.selftest');
    const dropped = inboundLogs.filter((l) => l.event.startsWith('inbound.dropped.'));
    const received = inboundLogs.filter((l) => l.event === 'inbound.received');
    const offlineBatches = inboundLogs.filter((l) => l.event === 'inbound.batch_offline');

    // THE LINE THAT ANSWERS "ARE CUSTOMERS REACHING ME".
    //
    // A device can receive plenty of traffic and still be useless: WhatsApp
    // syncs the seller's OWN outgoing messages across their linked devices, and
    // those arrive here as ordinary inbound events with fromMe set. Counting
    // raw events therefore reads as healthy while not one customer has got
    // through. Only fromMe===false is a customer.
    const fromCustomer = dropped.filter((l) => (l.meta as any)?.fromMe === false).length + received.length;
    const fromSeller = dropped.filter((l) => (l.meta as any)?.fromMe === true).length;

    console.log('\n  FLUX BAILEYS (60 dernières minutes)');
    line('Messages ingérés', String(received.length));
    line('  dont clients', String(fromCustomer));
    line('  vos propres envois', `${fromSeller}  (synchro multi-appareils, normal)`);
    line('Messages écartés', String(dropped.length));
    line('Lots hors ligne', String(offlineBatches.length));
    line(
      'Événements Baileys',
      getSecret('WA_LOG_LEVEL') === 'DEBUG'
        ? String(probes.length)
        : `${probes.length}  (sonde inactive — WA_LOG_LEVEL=DEBUG pour l'activer)`
    );

    if (dropped.length) {
      const byReason: Record<string, number> = {};
      for (const d of dropped) byReason[d.event.replace('inbound.dropped.', '')] = (byReason[d.event.replace('inbound.dropped.', '')] || 0) + 1;
      line('  raisons', JSON.stringify(byReason));
    }

    /* the verdict ------------------------------------------------------ */
    console.log('\n  VERDICT');
    if (s.desiredState === 'OFF') {
      line('->', 'Session volontairement éteinte.');
    } else if (!claimHealthy) {
      line('->', "Aucun worker ne tient cette session. Démarrez-le : npm run wa:dev");
    } else if (s.status !== 'CONNECTED') {
      line('->', `Session non connectée (${s.status}). Voir la dernière erreur ci-dessus.`);
    } else if (received.length) {
      line('->', 'Connexion vivante, messages clients reçus et enregistrés. Tout va bien.');
    } else if (fromSeller > 0 && fromCustomer === 0) {
      // The trap this whole file exists to expose: plenty of traffic, none of
      // it from a customer.
      line('->', 'TRAFIC PRÉSENT MAIS AUCUN MESSAGE CLIENT.');
      line('   ', `WhatsApp ne synchronise que vos propres envois (${fromSeller}).`);
      line('   ', "Les messages entrants des clients ne sont pas routés vers cet appareil.");
      line('   ', 'Reliez-le à nouveau : Déconnecter le compte, puis scanner le QR.');
    } else if (lastIn && Date.now() - lastIn.createdAt.getTime() < 30 * MIN) {
      line('->', 'Connecté, rien reçu récemment — probablement juste une heure calme.');
    } else {
      line('->', 'CONNECTÉ MAIS SOURD : rien ne remonte de WhatsApp.');
      line('   ', "L'envoi fonctionne, la réception non. Ce n'est pas le socket :");
      line('   ', 'WhatsApp ne route plus rien vers cet appareil. Reliez-le à nouveau');
      line('   ', '(Déconnecter le compte, puis scanner le QR).');
    }
  }

  /* the queues ------------------------------------------------------- */
  const [pendingOut, failedOut, pendingTurns] = await Promise.all([
    prisma.whatsappOutboundJob.count({ where: { status: 'PENDING' } }),
    prisma.whatsappOutboundJob.count({ where: { status: 'FAILED' } }),
    prisma.whatsappAgentTurn.count({ where: { status: 'PENDING' } }),
  ]);

  console.log('\n--- Files d’attente ---');
  line('Envois en attente', String(pendingOut));
  line('Envois en échec', String(failedOut));
  line('Tours IA en attente', String(pendingTurns));

  console.log('\n--- Journal (60 min, par catégorie) ---');
  const recent = await prisma.whatsappAgentLog.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 60 * MIN) } },
    select: { category: true, level: true },
  });
  const byCat: Record<string, number> = {};
  for (const r of recent) byCat[r.category] = (byCat[r.category] || 0) + 1;
  line('Total', String(recent.length));
  line('Par catégorie', JSON.stringify(byCat));
  line('Erreurs / alertes', String(recent.filter((r) => r.level === 'ERROR' || r.level === 'WARN').length));
  line('Niveau du journal', getSecret('WA_LOG_LEVEL') || 'INFO (défaut)');

  console.log('\n=============================================================\n');
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('scan failed:', err.message);
  await prisma.$disconnect();
  process.exit(1);
});

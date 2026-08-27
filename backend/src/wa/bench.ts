/**
 * Le banc d'essai — parler à son propre agent sans WhatsApp.
 *
 * POURQUOI CE FICHIER EXISTE À PART. Deux écrans y arrivent : l'onglet « Banc
 * d'essai » du studio, et la boîte de réception quand la conversation ouverte
 * est celle du banc. Si chacun écrivait ses propres lignes, l'un des deux
 * finirait par diverger — et un banc qui ne reproduit pas exactement l'arrivée
 * d'un message client ne teste rien.
 *
 * LE PIÈGE QU'IL SUPPRIME. Dans la boîte de réception, envoyer un message veut
 * dire « un humain reprend la main » : le message part VERS le client et l'IA
 * se met en pause. Sur le banc il n'y a pas de client — c'est vous. Le même
 * geste doit donc vouloir dire l'inverse : « le client vient d'écrire ça ».
 * Sans cette distinction, on tape dans le banc, rien ne répond, et rien
 * n'explique pourquoi.
 */

import { prisma } from '../lib/prisma.js';
import { nudgeWorker } from '../lib/waWorkerClient.js';
import { sandboxJid } from './transport.js';

/** La conversation de test du compte, créée à la première utilisation. */
export async function getOrCreateBench(userId: number) {
  return prisma.whatsappContact.upsert({
    where: { userId_jid: { userId, jid: sandboxJid(userId) } },
    update: {},
    create: {
      userId,
      jid: sandboxJid(userId),
      // Pas de téléphone, volontairement : le banc doit exercer le même
      // parcours « demander son numéro au client » qu'une conversation @lid,
      // qui est justement le cas le plus susceptible d'être cassé.
      phone: null,
      pushName: "Banc d'essai",
      source: 'ORGANIC',
      status: 'NEW',
    },
  });
}

/**
 * Écrit un message COMME LE CLIENT et met un tour en file.
 *
 * Reproduit `ingest()` de wa/worker.ts champ par champ. Là où les deux
 * divergent, c'est celui-ci qui a tort.
 */
export async function sendAsBenchCustomer(userId: number, contactId: number, text: string) {
  // Même forme d'identifiant qu'un vrai message, et unique : un double-clic ne
  // peut pas produire deux tours.
  const waId = `bench-in-${contactId}-${Date.now()}`;

  const message = await prisma.whatsappMessage.create({
    data: { userId, contactId, waId, direction: 'IN', kind: 'TEXT', body: text },
  });

  await prisma.whatsappContact.update({
    where: { id: contactId },
    data: {
      lastMessageAt: new Date(),
      // Rallumée à chaque envoi. Un passage par le composeur de la boîte de
      // réception AVANT ce correctif a pu laisser le banc en « reprise
      // humaine » : l'agent y resterait muet pour toujours, sans que rien sur
      // l'écran ne dise pourquoi.
      aiEnabled: true,
    },
  });

  await prisma.whatsappAgentTurn.create({
    data: { userId, contactId, triggerMessageId: waId },
  });

  // Le worker draine de toute façon toutes les deux secondes ; le coup de
  // coude supprime seulement l'attente, et son échec ne coûte que ce délai.
  nudgeWorker('turns', userId).catch(() => undefined);

  return message;
}

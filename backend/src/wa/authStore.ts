/**
 * Baileys authentication state, stored in Postgres instead of on disk.
 *
 * The standalone project used `useMultiFileAuthState('data/wa-session')`. That
 * cannot work here for two reasons: the worker is one process serving many
 * accounts, and a session on the worker's local disk is lost the moment the box
 * is replaced — every seller would have to re-scan a QR after a deploy.
 *
 * ONE ROW PER SIGNAL KEY, not one JSON blob. Baileys reads and writes
 * individual pre-keys and sessions constantly during normal operation; a single
 * column would make every one of those rewrite the whole session, and two
 * concurrent writes would lose each other.
 *
 * EVERY VALUE IS ENCRYPTED with ENCRYPTION_KEY, exactly like AppSecret. These
 * keys are equivalent to being logged into the customer's WhatsApp account — a
 * database dump that exposed them would let the holder read and send messages
 * as the seller.
 */

import { initAuthCreds, BufferJSON, proto } from '@whiskeysockets/baileys';
import type { AuthenticationCreds, AuthenticationState, SignalDataTypeMap } from '@whiskeysockets/baileys';
import { prisma } from '../lib/prisma.js';
import { encrypt, decrypt } from '../utils/crypto.js';

/**
 * Signal ids contain characters that are awkward in a key ('/', ':'), and the
 * type and id together must be unique per account. Normalising here keeps
 * `WhatsappAuthCredential.keyId` a plain, greppable string.
 */
const composeKey = (type: string, id: string) => `${type}-${id}`.replace(/\//g, '__');

export interface PrismaAuthState {
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  /** Wipes every key. Used on a logged-out/banned session. */
  clear: () => Promise<void>;
}

export async function usePrismaAuthState(userId: number): Promise<PrismaAuthState> {
  const writeData = async (keyId: string, value: unknown): Promise<void> => {
    const serialised = encrypt(JSON.stringify(value, BufferJSON.replacer));
    await prisma.whatsappAuthCredential.upsert({
      where: { userId_keyId: { userId, keyId } },
      update: { value: serialised },
      create: { userId, keyId, value: serialised },
    });
  };

  const readData = async (keyId: string): Promise<any> => {
    const row = await prisma.whatsappAuthCredential.findUnique({
      where: { userId_keyId: { userId, keyId } },
      select: { value: true },
    });
    if (!row) return null;

    const plain = decrypt(row.value);
    // decrypt() returns its input unchanged on failure. A value still carrying
    // the ENC: prefix means the current ENCRYPTION_KEY cannot read it — treat it
    // as absent so the account is asked to re-scan, rather than feeding Baileys
    // ciphertext and failing deep inside the protocol with an opaque error.
    if (plain.startsWith('ENC:')) {
      console.error(`[wa/auth] Cannot decrypt "${keyId}" for user ${userId}; treating as missing.`);
      return null;
    }

    try {
      return JSON.parse(plain, BufferJSON.reviver);
    } catch {
      return null;
    }
  };

  const removeData = async (keyId: string): Promise<void> => {
    await prisma.whatsappAuthCredential.deleteMany({ where: { userId, keyId } });
  };

  const creds: AuthenticationCreds = (await readData('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const out: { [id: string]: SignalDataTypeMap[typeof type] } = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(composeKey(type, id));
              // App-state sync keys are protobuf messages, not plain objects.
              // Baileys will not accept the parsed JSON as-is.
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              if (value) out[id] = value;
            })
          );
          return out;
        },

        set: async (data) => {
          const writes: Promise<void>[] = [];
          for (const type in data) {
            for (const id in (data as any)[type]) {
              const value = (data as any)[type][id];
              const keyId = composeKey(type, id);
              writes.push(value ? writeData(keyId, value) : removeData(keyId));
            }
          }
          await Promise.all(writes);
        },
      },
    },

    saveCreds: () => writeData('creds', creds),

    clear: async () => {
      await prisma.whatsappAuthCredential.deleteMany({ where: { userId } });
    },
  };
}

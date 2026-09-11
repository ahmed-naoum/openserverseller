import fs from 'node:fs';
import path from 'node:path';
import { prisma } from './prisma.js';
import {
  ANDROID_CHANNEL_FOR_KIND,
  SOUND_FILE_FOR_KIND,
  classifyNotification,
} from './notificationKinds.js';

/**
 * Firebase Cloud Messaging delivery for the SILACOD mobile app.
 *
 * Socket.io only reaches phones with the app open. A push reaches the phone
 * even when the app is closed or was swiped away, and Google queues it while
 * the phone is offline. Every notification created through
 * `utils/notification.ts` is also pushed here to the user's registered devices.
 *
 * Configuration (either one):
 *   FIREBASE_SERVICE_ACCOUNT_JSON  the service-account JSON, inline
 *   FIREBASE_SERVICE_ACCOUNT_PATH  path to the service-account JSON file
 *                                  (default: ./firebase-service-account.json when it exists)
 * Without configuration push is disabled and everything else keeps working.
 */

type Messaging = import('firebase-admin/messaging').Messaging;

let messaging: Messaging | null | undefined; // undefined = not initialised yet, null = disabled

async function getMessagingClient(): Promise<Messaging | null> {
  if (messaging !== undefined) return messaging;

  try {
    const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
    const configuredPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
    const defaultPath = path.resolve(process.cwd(), 'firebase-service-account.json');

    let credentialJson: string | null = null;
    if (inline) {
      credentialJson = inline;
    } else if (configuredPath && fs.existsSync(configuredPath)) {
      credentialJson = fs.readFileSync(configuredPath, 'utf8');
    } else if (fs.existsSync(defaultPath)) {
      credentialJson = fs.readFileSync(defaultPath, 'utf8');
    }

    if (!credentialJson) {
      console.warn('[Push] Firebase push disabled: no FIREBASE_SERVICE_ACCOUNT_JSON / FIREBASE_SERVICE_ACCOUNT_PATH configured');
      messaging = null;
      return messaging;
    }

    const { cert, getApps, initializeApp } = await import('firebase-admin/app');
    const { getMessaging } = await import('firebase-admin/messaging');

    const serviceAccount = JSON.parse(credentialJson);
    const app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
    messaging = getMessaging(app);
    console.log(`[Push] Firebase push enabled (project ${serviceAccount.project_id || 'unknown'})`);
    return messaging;
  } catch (err) {
    console.error('[Push] Firebase push disabled, initialisation failed:', err);
    messaging = null;
    return messaging;
  }
}

export const isPushConfigured = async (): Promise<boolean> => (await getMessagingClient()) !== null;

export interface PushPayload {
  notificationId?: number;
  type: string;
  title: string;
  body: string;
  /** Extra values for the app (deep-link ids etc.). Sent as strings. */
  data?: Record<string, string | number | boolean | null | undefined>;
}

/** FCM error codes meaning the token is dead and must be forgotten. */
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/**
 * Push one notification to every device registered by `userId`.
 * Never throws: a push failure must not undo the write that triggered it.
 */
export async function sendPushToUser(userId: number, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const result = { sent: 0, failed: 0 };
  try {
    const client = await getMessagingClient();
    if (!client) return result;

    const devices = await prisma.pushToken.findMany({
      where: { userId },
      select: { token: true },
    });
    if (devices.length === 0) return result;

    const kind = classifyNotification(payload.type, payload.title, payload.body);
    const channelId = ANDROID_CHANNEL_FOR_KIND[kind];
    const sound = SOUND_FILE_FOR_KIND[kind];

    const data: Record<string, string> = {
      source: 'push',
      type: payload.type,
      kind,
      channelId,
    };
    if (payload.notificationId !== undefined) data.notificationId = String(payload.notificationId);
    for (const [key, value] of Object.entries(payload.data || {})) {
      if (value !== undefined && value !== null) data[key] = String(value);
    }

    const tokens = devices.map((d) => d.token);
    const response = await client.sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data,
      android: {
        priority: 'high',
        notification: {
          channelId,
          sound: sound.android,
          // Same tag = same notification: a retried push replaces instead of duplicating.
          tag: payload.notificationId !== undefined ? `silacod-notif-${payload.notificationId}` : undefined,
          color: '#232863',
        },
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: { aps: { sound: sound.ios, badge: 1 } },
      },
    });

    result.sent = response.successCount;
    result.failed = response.failureCount;

    const deadTokens: string[] = [];
    response.responses.forEach((r, i) => {
      if (r.success) return;
      if (r.error && DEAD_TOKEN_CODES.has(r.error.code)) {
        deadTokens.push(tokens[i]);
      } else {
        console.warn(`[Push] Delivery failed for user ${userId}: ${r.error?.code} ${r.error?.message}`);
      }
    });

    if (deadTokens.length > 0) {
      await prisma.pushToken.deleteMany({ where: { token: { in: deadTokens } } });
      console.log(`[Push] Removed ${deadTokens.length} dead device token(s) for user ${userId}`);
    }
  } catch (err) {
    console.error('[Push] sendPushToUser failed:', err);
  }
  return result;
}

/** Register (or move to this user) a device token. */
export async function registerPushToken(
  userId: number,
  input: { token: string; platform: string; provider: string }
): Promise<void> {
  await prisma.pushToken.upsert({
    where: { token: input.token },
    update: { userId, platform: input.platform, provider: input.provider, lastSeenAt: new Date() },
    create: { userId, token: input.token, platform: input.platform, provider: input.provider, lastSeenAt: new Date() },
  });
}

/** Forget a device token (logout). Only the owner can remove it. */
export async function unregisterPushToken(userId: number, token: string): Promise<number> {
  const result = await prisma.pushToken.deleteMany({ where: { userId, token } });
  return result.count;
}

/**
 * Retires lapsed Google Sheets packs.
 *
 * Same shape as the other crons in this folder. It is deliberately NOT what makes
 * a pack stop paying: services/sheetPlans.service.ts compares `endsAt` against the
 * clock on every read, so a subscription is inert the moment it lapses whether or
 * not this has run. What this adds is the EXPIRED stamp the admin screens group by
 * and the notification that tells the seller their leads are back on the tariff —
 * which is why hourly is frequent enough, and why a tick that throws is logged
 * rather than retried.
 *
 * It also seeds the plan catalogue once at startup, so a fresh database has the
 * launch packs without a manual step.
 */

import { ensureDefaultPlans, expireDueSubscriptions } from '../services/sheetPlans.service.js';

const num = (key: string, fallback: number): number => {
  const raw = process.env[key];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const STARTUP_DELAY_MS = num('SHEET_PLAN_STARTUP_DELAY_MS', 12_000);
const RUN_INTERVAL_MS = num('SHEET_PLAN_INTERVAL_MS', 60 * 60 * 1000);

let running = false;

const tick = async () => {
  // The re-entrancy guard the notification loop needs: expireDueSubscriptions
  // writes one notification per lapsed account, and two overlapping ticks would
  // send every seller their expiry notice twice.
  if (running) return;
  running = true;
  try {
    const expired = await expireDueSubscriptions();
    if (expired > 0) console.log(`[SheetPlans] ${expired} subscription(s) expired.`);
  } catch (error) {
    console.error('[SheetPlans] expiry tick failed:', error);
  } finally {
    running = false;
  }
};

let started = false;

/** Seeds the catalogue, then expires lapsed packs every hour. */
export const startSheetSubscriptionCron = () => {
  if (started) return;
  started = true;
  console.log('[Cron] Google Sheets subscription job started.');
  setTimeout(() => {
    void ensureDefaultPlans().then(() => tick());
  }, STARTUP_DELAY_MS);
  setInterval(() => void tick(), RUN_INTERVAL_MS);
};

export { expireDueSubscriptions };

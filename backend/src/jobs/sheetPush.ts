/**
 * Drains the outbound Google Sheets outbox.
 *
 * Same shape as the other crons in this folder (leadReassignment, sessionCleanup,
 * logRetention) with one addition they do not need: a re-entrancy guard. Those run
 * every 10 seconds to 6 hours over pure database work; this one waits on Google,
 * so at a short interval a slow drain would otherwise overlap itself and two ticks
 * would race for the same rows.
 */

import { runSheetPushDrain } from '../services/sheetPush.service.js';

const num = (key: string, fallback: number): number => {
  const raw = process.env[key];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// 5s rather than the 15s this shipped with: a seller watching their spreadsheet
// after a lead comes in reads ~2.5s average as "immediate" and 7.5s as "is it
// broken?". An idle tick is three indexed queries (see runSheetPushDrain, which
// returns early when no vendor has work), so the extra frequency is cheap.
const STARTUP_DELAY_MS = num('SHEET_PUSH_STARTUP_DELAY_MS', 8_000);
const RUN_INTERVAL_MS = num('SHEET_PUSH_INTERVAL_MS', 5_000);

let running = false;

const tick = async () => {
  if (running) return;
  running = true;
  try {
    await runSheetPushDrain();
  } catch (error) {
    console.error('[SheetPush] drain tick failed:', error);
  } finally {
    running = false;
  }
};

let started = false;

/** Starts the recurring drain. First pass runs shortly after boot, then every 15s. */
export const startSheetPushCron = () => {
  if (started) return;
  started = true;
  console.log('[Cron] Google Sheets push job started.');
  setTimeout(() => void tick(), STARTUP_DELAY_MS);
  setInterval(() => void tick(), RUN_INTERVAL_MS);
};

export { runSheetPushDrain };

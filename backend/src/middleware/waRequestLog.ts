/**
 * HTTP half of the WhatsApp agent activity log.
 *
 * The worker records what the agent did on its own. This records what a HUMAN
 * asked it to do — connect a number, change the knowledge base, switch the
 * voice, take a conversation over by hand, promote a draft into a lead — with
 * the request that was sent and the answer that came back.
 *
 * Both halves matter, and neither is enough alone: "the agent stopped
 * answering at 14h05" is only a complete story next to "the account turned
 * `enabled` off at 14h04".
 *
 * WHAT IS LOGGED, and what is not:
 *
 *   Every non-GET request — those are the ones that CHANGE something.
 *
 *   Every failed request whatever its method, because a GET that 500s is a
 *   fault, and a GET that 403s is an entitlement problem someone is about to
 *   call support about.
 *
 *   Successful GETs are dropped. The inbox polls, the connect screen polls for
 *   the QR every couple of seconds, and logging that would bury the rows that
 *   mean something under thousands that do not.
 *
 * Bodies are NOT trimmed here. services/waLogs.service redacts credentials and
 * truncates on the way to the column, so a route added later cannot leak a key
 * or write a huge row by forgetting to.
 */

import type { NextFunction, Request, Response } from 'express';
import { waLog, type WaLogLevel } from '../services/waLogs.service.js';

/** Routes whose bodies are large and uninteresting once they have succeeded. */
const BULKY = /\/(knowledge|kb|catalogue|products)\b/i;

export function waRequestLog(req: Request, res: Response, next: NextFunction): void {
  // A polling GET is decided at the end, not here: we only know it succeeded
  // once the status is written.
  const startedAt = Date.now();

  // Capture what the route answered. `res.json` is the single exit for every
  // route in this codebase (asyncHandler + errorHandler both end in it), so
  // wrapping it catches the error envelope too.
  let payload: unknown;
  const json = res.json.bind(res);
  res.json = ((body: unknown) => {
    payload = body;
    return json(body);
  }) as Response['json'];

  res.on('finish', () => {
    try {
      const status = res.statusCode;
      const failed = status >= 400;

      if (req.method === 'GET' && !failed) return;

      const user = (req as any).user;
      // A sub-account acting for a vendor: `actorId` is the person, `user.id`
      // is the account the agent belongs to. The row belongs to the account,
      // the actor goes in meta — otherwise a helper's action reads as the
      // owner's.
      const actorId = (req as any).actorId ?? null;

      const level: WaLogLevel = status >= 500 ? 'ERROR' : failed ? 'WARN' : 'INFO';

      const body = req.method === 'GET' || (BULKY.test(req.path) && !failed) ? undefined : req.body;

      waLog({
        userId: user?.id ?? null,
        level,
        category: 'API',
        event: `api.${req.method.toLowerCase()}`,
        message: `${req.method} ${req.baseUrl || ''}${req.path} → ${status}`,
        request: {
          method: req.method,
          path: `${req.baseUrl || ''}${req.path}`,
          query: Object.keys(req.query || {}).length ? req.query : undefined,
          body,
        },
        // The error envelope is the useful half of a failed response; a
        // successful one is usually the object the caller already has.
        response: failed ? payload : undefined,
        meta: {
          status,
          ip: req.ip,
          actorId,
          role: user?.role?.name || user?.role || null,
          durationMs: Date.now() - startedAt,
        },
        // Fills errorText, which is what the log screen's "erreurs seulement"
        // filter reads. The explicit level above survives it: a 404 is a WARN.
        error: failed ? (payload as any)?.message || `HTTP ${status}` : undefined,
        durationMs: Date.now() - startedAt,
      });
    } catch (err) {
      console.error('[wa/logs] request log failed:', (err as Error).message);
    }
  });

  next();
}

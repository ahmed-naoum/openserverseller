import { useEffect, useRef, useState } from 'react';
import { Hourglass, PhoneOff } from 'lucide-react';

/**
 * Mirrors MAX_NO_REPLY_RELEASES in backend/src/lib/leadRelease.ts — how many
 * times a NO_REPLY lead is recycled into the pool before it retires to
 * DEAD_NO_REPLY. Keep the two in step.
 */
export const MAX_NO_REPLY_RELEASES = 5;

/**
 * "1 h 12 min" over an hour, "12:45" under it. The last minutes are the ones an
 * agent actually watches, so they get second-level precision; an hour out, the
 * seconds are noise on a card that re-renders every tick.
 */
const formatRemaining = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0
    ? `${hours} h ${String(minutes).padStart(2, '0')} min`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
};

interface ReleaseCountdownProps {
  lead: { status?: string; releaseAt?: string | null; noReplyReleases?: number };
  /** Fired once when the countdown reaches zero, so the list can refetch. */
  onExpire?: () => void;
  className?: string;
}

/**
 * Counts down to the auto-release performed by jobs/leadReassignment.
 *
 * The deadline is written server-side per lead — randomised 1–2 h for most
 * statuses, the scheduled callback plus 1 h for CALL_LATER — and read straight
 * off the record rather than recomputed here: the badge must never disagree
 * with the job that actually drops the lead. Renders nothing for a lead that is
 * not on a countdown.
 */
export function ReleaseCountdown({ lead, onExpire, className = '' }: ReleaseCountdownProps) {
  const deadline = lead.releaseAt ? new Date(lead.releaseAt).getTime() : NaN;
  const [remaining, setRemaining] = useState(() => deadline - Date.now());

  // Held in a ref so an inline callback from the parent doesn't restart the
  // interval on every render.
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (Number.isNaN(deadline)) return;

    let fired = false;
    setRemaining(deadline - Date.now());

    const interval = setInterval(() => {
      const next = deadline - Date.now();
      setRemaining(next);
      if (next <= 0 && !fired) {
        fired = true;
        clearInterval(interval);
        onExpireRef.current?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline]);

  if (Number.isNaN(deadline)) return null;

  const isNoReply = lead.status === 'NO_REPLY';
  // CALL_LATER counts down to the reminder the agent picked plus one hour, not
  // to the randomised hold every other status gets — say so, or the badge reads
  // as an unrelated timer sitting next to the callback time.
  const isCallLater = lead.status === 'CALL_LATER';
  // `noReplyReleases` counts releases already spent, so the attempt in progress
  // is the next one up.
  const attempt = (lead.noReplyReleases ?? 0) + 1;
  const isLastAttempt = isNoReply && attempt >= MAX_NO_REPLY_RELEASES;
  const expired = remaining <= 0;

  return (
    <span className={`inline-flex flex-wrap items-center justify-end gap-1 ${className}`}>
      <span
        className={`text-[9px] font-black px-2 py-0.5 rounded-full border flex items-center gap-1 ${
          expired
            ? 'text-slate-500 bg-slate-50 border-slate-200'
            : 'text-slate-700 bg-slate-100 border-slate-200'
        }`}
        title={
          isCallLater
            ? "Délai avant remise automatique dans le pool (1 h après l'heure de rappel prévue)"
            : 'Délai avant remise automatique dans le pool (tiré au hasard entre 1 h et 2 h)'
        }
      >
        <Hourglass className="w-2.5 h-2.5 shrink-0" />
        {expired ? 'Libération imminente' : `Libéré dans ${formatRemaining(remaining)}`}
      </span>

      {isNoReply && (
        <span
          className={`text-[9px] font-black px-2 py-0.5 rounded-full border flex items-center gap-1 ${
            isLastAttempt
              ? 'text-rose-700 bg-rose-50 border-rose-200'
              : 'text-slate-600 bg-white border-slate-200'
          }`}
          title={
            isLastAttempt
              ? `Dernier essai : après celui-ci le lead sort du pool définitivement.`
              : `Tentative ${attempt} sur ${MAX_NO_REPLY_RELEASES} avant retrait définitif du pool.`
          }
        >
          <PhoneOff className="w-2.5 h-2.5 shrink-0" />
          {isLastAttempt
            ? `Dernière tentative (${attempt}/${MAX_NO_REPLY_RELEASES})`
            : `Tentative ${attempt}/${MAX_NO_REPLY_RELEASES}`}
        </span>
      )}
    </span>
  );
}

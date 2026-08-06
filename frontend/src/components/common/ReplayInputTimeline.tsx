import { Pencil, Play, Server } from 'lucide-react';
import { fmtOffset, type InputTimeline } from '../../lib/replayInputs';

/** A field/value pair the server captured, used when the replay has no keystrokes. */
export interface CapturedField {
  label: string;
  value?: string | null;
}

/**
 * "Where the visitor typed" strip under a session replay, shared by the admin
 * inspector and the agent's abandoned-carts page.
 *
 * Values are laid out one per row rather than as fixed-width chips: a Moroccan
 * phone number is 10 digits and a city or address is Arabic RTL text, neither of
 * which survives a 90px truncated cell.
 *
 * Direction is handled at two levels. The rows are pinned `dir="ltr"` so the
 * layout never mirrors — LanguageContext puts `dir="rtl"` on <html> whenever the
 * UI language is Arabic, and that would otherwise flip these rows out from under
 * the operator. Each label and value then carries `dir="auto"` so Arabic text and
 * Latin digits each render the right way round inside their own cell.
 */
export function ReplayInputTimeline({
  timeline,
  captured = [],
  onSeek,
}: {
  timeline: InputTimeline | null;
  captured?: CapturedField[];
  onSeek: (offsetMs: number) => void;
}) {
  if (!timeline) return null;

  const known = captured.filter((c) => (c.value ?? '').toString().trim().length > 0);

  // No keystrokes in the recording. That is common — the replay may be capped,
  // or start after the form was filled — so fall back to what the server stored
  // instead of telling the operator there is nothing.
  if (timeline.fields.length === 0) {
    return (
      <div dir="ltr" className="bg-gray-900 border-t border-gray-800 px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Pencil className="w-3.5 h-3.5 text-gray-600" />
          <span className="text-[11px] font-bold text-gray-500">
            {known.length > 0
              ? 'Aucune frappe dans cet enregistrement — données capturées par le serveur :'
              : "Aucune saisie enregistrée — le visiteur n'a rien écrit dans le formulaire."}
          </span>
        </div>
        {known.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {known.map((c) => (
              <span
                key={c.label}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-800 border border-gray-700 max-w-full"
              >
                <Server className="w-3 h-3 text-gray-500 shrink-0" />
                <span className="text-[10px] font-bold text-gray-400 shrink-0">{c.label}</span>
                <span dir="auto" className="text-[11px] font-mono text-emerald-400 break-words">
                  {c.value}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div dir="ltr" className="bg-gray-900 border-t border-gray-800 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Pencil className="w-3.5 h-3.5 text-orange-400" />
        <span className="text-[11px] font-black uppercase tracking-wide text-gray-400">
          Saisie — {timeline.fields.length} champ{timeline.fields.length > 1 ? 's' : ''}
        </span>
        {timeline.firstWriteOffsetMs !== null && (
          <button
            onClick={() => onSeek(timeline.firstWriteOffsetMs!)}
            className="ml-auto px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold inline-flex items-center gap-1.5 shrink-0"
          >
            <Play className="w-3 h-3 fill-current" />
            Début de saisie · {fmtOffset(timeline.firstWriteOffsetMs)}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5 max-h-[9.5rem] overflow-y-auto pr-1">
        {timeline.fields.map((f, i) => (
          <button
            key={f.nodeId}
            onClick={() => onSeek(f.firstOffsetMs)}
            title={
              `${f.label}${f.masked ? '' : f.finalValue ? ` : ${f.finalValue}` : ''}\n` +
              `Aller à ${fmtOffset(f.firstOffsetMs)} — ${f.edits} saisie(s)` +
              (f.clearedAfter ? ' — champ vidé ensuite' : '')
            }
            className="w-full flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-left"
          >
            <span className="w-4 h-4 mt-px rounded-md bg-orange-500/20 text-orange-400 text-[9px] font-black flex items-center justify-center shrink-0">
              {i + 1}
            </span>
            <span
              dir="auto"
              className="text-[11px] font-bold text-gray-300 shrink-0 max-w-[40%] truncate"
            >
              {f.label}
            </span>
            {f.masked ? (
              <span className="text-[10px] text-gray-500 italic">masqué</span>
            ) : f.finalValue ? (
              <span
                dir="auto"
                className={`flex-1 min-w-0 text-[11px] font-mono break-words ${
                  f.clearedAfter ? 'text-amber-400/80 line-through' : 'text-emerald-400'
                }`}
              >
                {f.finalValue}
              </span>
            ) : (
              <span className="flex-1" />
            )}
            <span className="text-[10px] text-gray-500 font-mono shrink-0">
              {fmtOffset(f.firstOffsetMs)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** One tick per keystroke on a replay scrub bar, so typing bursts are visible. */
export function ReplayInputTicks({ timeline }: { timeline: InputTimeline | null }) {
  if (!timeline || timeline.durationMs <= 0) return null;
  return (
    <>
      {timeline.moments.map((m, i) => (
        <span
          key={i}
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-emerald-400/70 rounded-full pointer-events-none"
          style={{ left: `${Math.min(100, (m.offsetMs / timeline.durationMs) * 100)}%` }}
        />
      ))}
    </>
  );
}

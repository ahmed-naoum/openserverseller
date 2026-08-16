import { CheckCircle2, AlertTriangle, XCircle, Zap, X } from 'lucide-react';

/**
 * What the compiler did with the page that was just saved.
 *
 * Compiling used to happen on the next visitor's request, which meant nobody
 * editing a page ever found out whether it would actually be fast — or that one
 * unsupported block was quietly keeping the whole page on the old renderer.
 * Saving now reports that at the moment it can be acted on.
 */

export interface CompileReport {
  status: 'compiled' | 'declined' | 'error';
  durationMs: number;
  blocks: number;
  supported: string[];
  unsupported: string[];
  rawBytes: number | null;
  brotliBytes: number | null;
  error: string | null;
  servedToVisitors: boolean;
  reason: string;
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} Ko`;

/** French labels for the block types an editor sees in the palette. */
const BLOCK_LABELS: Record<string, string> = {
  express_checkout: 'Formulaire de commande',
  image: 'Image',
  video: 'Vidéo',
  button: 'Bouton',
  whatsapp: 'WhatsApp',
  audio: 'Audio',
  slider: 'Carrousel',
  products: 'Produits',
  countdown: 'Compte à rebours',
  header: 'En-tête',
  hero: 'Bannière',
  text: 'Texte',
  spacer: 'Espacement',
};

const label = (type: string) => BLOCK_LABELS[type] || type;

export default function CompileReportModal({
  report,
  onClose,
}: {
  report: CompileReport;
  onClose: () => void;
}) {
  const ok = report.status === 'compiled';
  const failed = report.status === 'error';

  const tone = ok
    ? { ring: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle2 }
    : failed
      ? { ring: 'border-red-200', bg: 'bg-red-50', text: 'text-red-700', icon: XCircle }
      : { ring: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-800', icon: AlertTriangle };

  const Icon = tone.icon;

  // Only meaningful when the page compiled AND is actually being served; a
  // compiled page nobody receives is not a saving yet.
  const saving =
    ok && report.rawBytes && report.brotliBytes
      ? Math.round((1 - report.brotliBytes / report.rawBytes) * 100)
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Résultat de la compilation"
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-start gap-3 p-5 border-b ${tone.ring} ${tone.bg}`}>
          <Icon className={`w-6 h-6 shrink-0 mt-0.5 ${tone.text}`} />
          <div className="flex-1 min-w-0">
            <h3 className={`font-extrabold text-base leading-tight ${tone.text}`}>
              {ok ? 'Page enregistrée et compilée' : failed ? 'Erreur de compilation' : 'Page enregistrée'}
            </h3>
            <p className="text-sm text-slate-600 mt-1">{report.reason}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-black/5 text-slate-400 shrink-0"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {ok && report.rawBytes !== null && report.brotliBytes !== null && (
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-[11px] uppercase tracking-wide text-slate-400 font-bold">
                  Envoyé au visiteur
                </div>
                <div className="text-2xl font-black text-slate-900">{kb(report.brotliBytes)}</div>
                <div className="text-xs text-slate-500">
                  {kb(report.rawBytes)} avant compression{saving !== null ? ` — ${saving}% en moins` : ''}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wide text-slate-400 font-bold">
                  Compilation
                </div>
                <div className="text-lg font-bold text-slate-700">{report.durationMs} ms</div>
              </div>
            </div>
          )}

          <div className="text-sm">
            <div className="text-[11px] uppercase tracking-wide text-slate-400 font-bold mb-1.5">
              Blocs ({report.blocks})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {report.supported.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-100"
                >
                  {label(t)}
                </span>
              ))}
              {report.unsupported.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-xs font-semibold border border-amber-200"
                >
                  {label(t)} — non pris en charge
                </span>
              ))}
            </div>
          </div>

          {report.unsupported.length > 0 && (
            <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 rounded-lg p-3">
              La page fonctionne normalement, mais elle est servie par l'ancienne version, plus
              lente. Retirez {report.unsupported.length > 1 ? 'ces blocs' : 'ce bloc'} pour
              bénéficier de la version rapide.
            </p>
          )}

          {report.error && (
            <pre className="text-[11px] leading-relaxed bg-red-50 text-red-800 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">
              {report.error}
            </pre>
          )}

          {ok && !report.servedToVisitors && (
            <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 rounded-lg p-3 flex gap-2">
              <Zap className="w-4 h-4 shrink-0 text-slate-400" />
              <span>
                La version rapide est prête mais pas encore activée pour les visiteurs.
                Contactez un administrateur.
              </span>
            </p>
          )}
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

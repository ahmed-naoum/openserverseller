import { createPortal } from 'react-dom';
import { MessageSquareWarning } from 'lucide-react';

/**
 * Final, money-impacting statuses. A helper can never set one of these without
 * writing down why — the reason is stored in the order status history.
 * The same rule is enforced server-side in `PATCH /orders/:id/status`.
 */
export const REASON_REQUIRED_STATUSES: Record<string, string> = {
  DELIVERED: 'Livré',
  RETURNED: 'Retourné',
};

export const MIN_REASON_LENGTH = 10;

export const REASON_PRESETS: Record<string, string[]> = {
  DELIVERED: [
    'Livraison confirmée par le livreur (preuve reçue)',
    'Client a confirmé la réception du colis par téléphone',
    'Montant encaissé et confirmé par Coliaty',
    'Livré en main propre après reprogrammation',
  ],
  RETURNED: [
    'Client injoignable après plusieurs tentatives d\'appel',
    'Client a refusé le colis à la livraison',
    'Adresse erronée / introuvable par le livreur',
    'Colis retourné au hub après expiration du délai',
    'Annulation du client après plusieurs reports',
  ],
};

export function isReasonRequired(status: string) {
  return !!REASON_REQUIRED_STATUSES[status];
}

interface Props {
  status: string;
  parcelLabel: string;
  customerName: string;
  reason: string;
  onReasonChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  submitting?: boolean;
}

export default function StatusReasonModal({
  status,
  parcelLabel,
  customerName,
  reason,
  onReasonChange,
  onCancel,
  onConfirm,
  submitting = false,
}: Props) {
  const label = REASON_REQUIRED_STATUSES[status] || status;
  const isDelivered = status === 'DELIVERED';
  const valid = reason.trim().length >= MIN_REASON_LENGTH;

  return createPortal(
    <div
      className="fixed inset-0 z-[999999] bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={() => !submitting && onCancel()}
    >
      <div
        className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className={`p-6 border-b border-gray-100 ${isDelivered ? 'bg-emerald-50/40' : 'bg-orange-50/40'}`}>
          <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <MessageSquareWarning className={`w-5 h-5 ${isDelivered ? 'text-emerald-500' : 'text-orange-500'}`} />
            Raison obligatoire
          </h3>
          <p className="text-sm text-gray-500 mt-1.5">
            Vous êtes sur le point de passer le colis{' '}
            <strong className="text-gray-800">{parcelLabel}</strong>
            {customerName ? ` (${customerName})` : ''} en{' '}
            <strong className={isDelivered ? 'text-emerald-600' : 'text-orange-600'}>{label}</strong>.
            {' '}Ce statut est définitif : expliquez pourquoi.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            {(REASON_PRESETS[status] || []).map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => onReasonChange(preset)}
                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-[11px] font-bold text-gray-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all text-left"
              >
                {preset}
              </button>
            ))}
          </div>

          <div>
            <textarea
              autoFocus
              value={reason}
              onChange={e => onReasonChange(e.target.value)}
              rows={4}
              placeholder={`Expliquez pourquoi ce colis passe en "${label}"...`}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
            <div className="flex items-center justify-between mt-1.5">
              <p className={`text-[11px] font-bold ${valid ? 'text-emerald-600' : 'text-rose-500'}`}>
                {valid
                  ? '✓ Raison valide'
                  : `Minimum ${MIN_REASON_LENGTH} caractères (${reason.trim().length}/${MIN_REASON_LENGTH})`}
              </p>
              <p className="text-[10px] text-gray-400 font-medium">Enregistrée dans l'historique du colis</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-black rounded-xl text-xs uppercase tracking-wider hover:bg-gray-100 transition-all active:scale-95 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!valid || submitting}
            className={`px-6 py-2.5 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
              isDelivered ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-orange-600 hover:bg-orange-700'
            }`}
          >
            {submitting ? 'Enregistrement...' : `Confirmer « ${label} »`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

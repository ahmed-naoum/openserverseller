import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Copy, Check, RefreshCw, Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { domainApi, DomainDnsRecord, DomainState } from '../../lib/api';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * The custom-domain tab of the Domains page.
 *
 * Three steps, because that is genuinely what connecting a domain takes:
 *
 *   1. type the domain          -> the API hands back a TXT record
 *   2. publish the TXT record   -> the API verifies ownership and registers the
 *                                  hostname with Cloudflare
 *   3. publish the CNAME        -> traffic starts flowing and the certificate
 *                                  issues
 *
 * Nothing is claimed at step 1 on purpose: the domain slot is unique, so
 * claiming on request would let anyone type a competitor's domain and lock the
 * real owner out. See backend/src/routes/domain.routes.ts.
 */

/** react-query key, so the panel and any future summary card share one fetch. */
export const DOMAIN_QUERY_KEY = ['vendor', 'custom-domain'];

/** A DNS row with a copy button — the value is long and hand-typing it fails. */
function RecordRow({ record, tr }: { record: DomainDnsRecord; tr: (k: string, f: string) => string }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      window.setTimeout(() => setCopied((current) => (current === field ? null : current)), 1500);
    } catch {
      // Clipboard is blocked outside a secure context; the value is still on
      // screen and selectable, so this is not worth an error toast.
    }
  };

  const cells: { field: string; head: string; value: string; mono?: boolean }[] = [
    { field: 'type', head: tr('domain_record_type', 'Type'), value: record.type },
    { field: 'name', head: tr('domain_record_name', 'Nom / Host'), value: record.name, mono: true },
    { field: 'value', head: tr('domain_record_value', 'Valeur / Target'), value: record.value, mono: true },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="divide-y divide-gray-100">
        {cells.map((cell) => (
          <div key={cell.field} className="flex items-start gap-3 px-4 py-3">
            <span className="w-28 shrink-0 pt-0.5 text-xs font-bold uppercase tracking-wider text-gray-400">
              {cell.head}
            </span>
            <span
              className={`flex-1 break-all text-sm text-gray-900 ${cell.mono ? 'font-mono' : 'font-semibold'}`}
            >
              {cell.value}
            </span>
            <button
              type="button"
              onClick={() => copy(cell.value, cell.field)}
              className="shrink-0 p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              title={tr('domain_copy', 'Copier')}
            >
              {copied === cell.field ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status, tr }: { status: string; tr: (k: string, f: string) => string }) {
  const map: Record<string, { className: string; label: string; icon: React.ReactNode }> = {
    ACTIVE: {
      className: 'bg-emerald-100 text-emerald-700',
      label: tr('domain_status_active', 'Actif'),
      icon: <CheckCircle2 size={14} />,
    },
    FAILED: {
      className: 'bg-red-100 text-red-700',
      label: tr('domain_status_failed', 'Échec'),
      icon: <AlertCircle size={14} />,
    },
    PENDING: {
      className: 'bg-amber-100 text-amber-700',
      label: tr('domain_status_pending', 'En attente du DNS'),
      icon: <RefreshCw size={14} />,
    },
  };
  const tone = map[status] || map.PENDING;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${tone.className}`}
    >
      {tone.icon} {tone.label}
    </span>
  );
}

/** Numbered circle marking each step of the connection flow. */
function StepBadge({ n, className }: { n: number; className: string }) {
  return (
    <span
      className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-black text-white ${className}`}
    >
      {n}
    </span>
  );
}

export default function CustomDomainPanel() {
  const { t } = useLanguage();
  const tr = (key: string, fallback: string) => t(key, 'dashboard', fallback);
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');

  const { data: state, isLoading } = useQuery<DomainState>({
    queryKey: DOMAIN_QUERY_KEY,
    queryFn: domainApi.get,
  });

  /** Every mutation returns the full new state, so one setter keeps them in sync. */
  const apply = (next: DomainState) => queryClient.setQueryData(DOMAIN_QUERY_KEY, next);

  const fail = (err: any, fallback: string) =>
    toast.error(err?.response?.data?.message || err?.response?.data?.error || fallback);

  const request = useMutation({
    mutationFn: (domain: string) => domainApi.request(domain),
    onSuccess: (next) => {
      apply(next);
      setInput('');
    },
    onError: (err) => fail(err, tr('domain_toast_request_error', "Impossible d'enregistrer ce domaine.")),
  });

  const verify = useMutation({
    mutationFn: () => domainApi.verify(),
    onSuccess: (next) => {
      apply(next);
      toast.success(tr('domain_toast_verified', 'Propriété du domaine vérifiée.'));
    },
    onError: (err) => fail(err, tr('domain_toast_verify_error', 'La vérification a échoué.')),
  });

  const refresh = useMutation({
    mutationFn: () => domainApi.refresh(),
    onSuccess: (next) => {
      apply(next);
      if (next.customDomainStatus === 'ACTIVE') {
        toast.success(tr('domain_toast_active', 'Votre domaine est actif.'));
      } else if (!next.error) {
        toast(tr('domain_toast_not_propagated', 'DNS pas encore propagé. Réessayez dans quelques minutes.'));
      }
    },
    onError: (err) => fail(err, tr('domain_toast_refresh_error', 'Impossible de vérifier le statut.')),
  });

  const disconnect = useMutation({
    mutationFn: () => domainApi.disconnect(),
    onSuccess: (next) => {
      apply(next);
      toast.success(tr('domain_toast_disconnected', 'Domaine déconnecté.'));
    },
    onError: (err) => fail(err, tr('domain_toast_disconnect_error', 'Impossible de déconnecter le domaine.')),
  });

  const busy = request.isPending || verify.isPending || refresh.isPending || disconnect.isPending;

  if (isLoading || !state) {
    return (
      <div className="flex items-center justify-center min-h-[240px] text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-900">
          {tr('domain_custom_title', 'Connecter votre propre domaine')}
        </h3>
        <p className="text-sm text-gray-500">
          {tr(
            'domain_custom_desc',
            'Utilisez votre propre nom de domaine (ex : myshop.ma) pour vos pages de vente et vos liens de parrainage.'
          )}
        </p>
      </div>

      {state.error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span className="break-words">{state.error}</span>
        </div>
      )}

      {/* ── Step 1: nothing requested yet ─────────────────────────────────── */}
      {!state.customDomain && !state.pendingDomain && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) request.mutate(input.trim());
          }}
          className="space-y-3"
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              required
              disabled={busy}
              placeholder="myshop.ma"
              value={input}
              onChange={(e) => setInput(e.target.value.toLowerCase().trim())}
              className="flex-1 rounded-xl border border-gray-300 px-4 py-3 font-mono text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
            />
            <button
              type="submit"
              disabled={busy || !input}
              className="rounded-xl bg-primary-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              {request.isPending ? tr('domain_btn_wait', 'Patientez...') : tr('domain_btn_continue', 'Continuer')}
            </button>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <AlertCircle size={14} />{' '}
            {tr('domain_input_hint', 'Saisissez uniquement le domaine — sans « https:// » ni « www. ».')}
          </p>
        </form>
      )}

      {/* ── Step 2: prove ownership ───────────────────────────────────────── */}
      {state.pendingDomain && state.verifyRecord && (
        <div className="space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">
          <div>
            <h4 className="flex flex-wrap items-center gap-2 text-sm font-bold text-indigo-900">
              <StepBadge n={1} className="bg-indigo-600" />
              {tr('domain_step_own', 'Prouvez que ce domaine vous appartient :')}{' '}
              <span className="font-mono">{state.pendingDomain}</span>
            </h4>
            <p className="mt-1.5 text-sm text-indigo-800">
              {tr(
                'domain_step_own_desc',
                'Ajoutez cet enregistrement TXT chez votre registrar (Namecheap, GoDaddy, Genious, OVH…), puis revenez ici. Vous pourrez le supprimer une fois le domaine actif.'
              )}
            </p>
          </div>

          <RecordRow record={state.verifyRecord} tr={tr} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs italic text-indigo-700">
              {tr('domain_propagation_short', 'La propagation DNS prend généralement quelques minutes.')}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => disconnect.mutate()}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-50"
              >
                {tr('domain_btn_cancel', 'Annuler')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => verify.mutate()}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                {verify.isPending && <Loader2 size={14} className="animate-spin" />}
                {tr('domain_btn_verify_ownership', 'Vérifier la propriété')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: route the traffic ─────────────────────────────────────── */}
      {state.customDomain && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 p-5">
            <div>
              <p className="mb-1 text-sm text-gray-500">{tr('domain_connected_label', 'Domaine connecté')}</p>
              <p className="font-mono text-lg font-bold text-gray-900">{state.customDomain}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={state.customDomainStatus} tr={tr} />
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(tr('domain_disconnect_confirm', 'Déconnecter ce domaine ? Vos liens repasseront sur votre sous-domaine.'))) {
                    disconnect.mutate();
                  }
                }}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                title={tr('domain_btn_disconnect', 'Déconnecter le domaine')}
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>

          {state.customDomainStatus !== 'ACTIVE' && state.cnameRecord && (
            <div className="space-y-4 rounded-2xl border border-blue-100 bg-blue-50/40 p-5">
              <div>
                <h4 className="flex items-center gap-2 text-sm font-bold text-blue-900">
                  <StepBadge n={2} className="bg-blue-600" />
                  {tr('domain_step_route', 'Dirigez le trafic vers nos serveurs')}
                </h4>
                <p className="mt-1.5 text-sm text-blue-800">
                  {tr(
                    'domain_step_route_desc',
                    'Ajoutez cet enregistrement CNAME. Le certificat SSL est émis automatiquement une fois le DNS en place.'
                  )}
                </p>
              </div>

              <RecordRow record={state.cnameRecord} tr={tr} />

              {/* The single most common failure at Moroccan registrars, so it is
                  called out here rather than left to a support ticket. */}
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>
                  <strong>{tr('domain_apex_title', 'Votre registrar refuse un CNAME sur le domaine racine ?')}</strong>{' '}
                  {tr(
                    'domain_apex_desc',
                    "C'est normal : la plupart ne l'autorisent pas. Deux solutions — basculer les serveurs de noms de votre domaine vers Cloudflare (gratuit), ou créer le CNAME sur « www » et rediriger le domaine racine vers « www »."
                  )}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs italic text-blue-700">
                  {tr('domain_propagation_long', 'Les modifications DNS peuvent prendre jusqu\'à 24 h pour se propager.')}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => refresh.mutate()}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={refresh.isPending ? 'animate-spin' : ''} />
                  {tr('domain_btn_check_status', 'Vérifier le statut')}
                </button>
              </div>
            </div>
          )}

          {state.customDomainStatus === 'ACTIVE' && (
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <span>
                {tr('domain_active_note', 'Votre domaine est actif. Vos nouveaux liens de parrainage utilisent désormais :')}{' '}
                <span className="font-mono font-bold">{state.customDomain}</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

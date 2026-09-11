import { ShieldAlert, Phone, User, Globe, Monitor } from 'lucide-react';
import type { FraudSignalCode, LeadFraudCounts } from '../../types';

/**
 * The reasons a lead looks fake, one chip each.
 *
 * Deliberately not a single "fake lead" verdict. Every one of these signals has
 * some innocent reading — a family sharing a phone, an office sharing a
 * connection, a genuinely common name — so the row says WHICH pattern fired and
 * how strong it is, and leaves the judgement to the person about to call the
 * customer. Nothing here hides or removes the order.
 *
 * PHONE_IDENTITY is the only one drawn solid: one number used by two different
 * people is the single pattern with no honest explanation. The rest are tinted,
 * meaning "look before you confirm", not "this is fraud".
 */

// `ns` is `any` rather than `string` on purpose: the app's own `t` types that
// parameter as a union of known namespaces, and a `string` here would make the
// real helper unassignable to this prop.
type Translate = (key: string, ns: any, fallback: string) => string;

const FALLBACK: Translate = (_k, _ns, fallback) => fallback;

interface Props {
  signals?: FraudSignalCode[] | null;
  counts?: LeadFraudCounts | null;
  /** The app's i18n helper where the screen has one; French otherwise. */
  t?: Translate;
  className?: string;
}

const ICONS: Record<FraudSignalCode, typeof Phone> = {
  PHONE_IDENTITY: ShieldAlert,
  PHONE_REPEAT: Phone,
  NAME_REUSED: User,
  IP_BURST: Globe,
  UA_CLUSTER: Monitor,
};

export default function FraudBadges({ signals, counts, t = FALLBACK, className = '' }: Props) {
  if (!signals?.length) return null;

  const c = counts;
  const label: Record<FraudSignalCode, { short: string; title: string }> = {
    PHONE_IDENTITY: {
      short: t('fraud_phone_identity', 'leads', 'Numéro à 2 noms'),
      title: t(
        'fraud_phone_identity_help',
        'leads',
        'Ce numéro a commandé sous {n} noms différents en 90 jours. Le signal le plus fiable : personne n’a deux identités sur une ligne.'
      ).replace('{n}', String(c?.phoneIdentities ?? 2)),
    },
    PHONE_REPEAT: {
      short: t('fraud_phone_repeat', 'leads', 'Numéro répété'),
      title: t(
        'fraud_phone_repeat_help',
        'leads',
        '{n} commandes sur ce numéro en 90 jours. Peut être un vrai client fidèle — vérifiez le nom.'
      ).replace('{n}', String(c?.phoneLeads ?? 0)),
    },
    NAME_REUSED: {
      short: t('fraud_name_reused', 'leads', 'Nom réutilisé'),
      title: t(
        'fraud_name_reused_help',
        'leads',
        'Ce nom apparaît sur {n} numéros différents — une identité recopiée, pas seulement un nom courant.'
      ).replace('{n}', String(c?.namePhones ?? 0)),
    },
    IP_BURST: {
      short: t('fraud_ip_burst', 'leads', 'Même connexion'),
      title: t(
        'fraud_ip_burst_help',
        'leads',
        '{n} commandes depuis la même connexion en 24 h. Attention : un opérateur mobile partage une adresse entre des milliers de vrais clients.'
      ).replace('{n}', String(c?.ipOrders ?? 0)),
    },
    UA_CLUSTER: {
      short: t('fraud_ua_cluster', 'leads', 'Même appareil'),
      title: t(
        'fraud_ua_cluster_help',
        'leads',
        '{n} commandes depuis le même appareil (même connexion et même navigateur) en 24 h.'
      ).replace('{n}', String(c?.uaCluster ?? 0)),
    },
  };

  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      {signals.map((code) => {
        const Icon = ICONS[code] ?? ShieldAlert;
        const strong = code === 'PHONE_IDENTITY';
        return (
          <span
            key={code}
            title={label[code]?.title}
            className={
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider font-sans whitespace-nowrap ' +
              (strong
                ? 'bg-red-600 text-white border border-red-700'
                : 'bg-amber-50 text-amber-700 border border-amber-200')
            }
          >
            <Icon className="w-2.5 h-2.5 flex-shrink-0" />
            {label[code]?.short ?? code}
          </span>
        );
      })}
    </span>
  );
}

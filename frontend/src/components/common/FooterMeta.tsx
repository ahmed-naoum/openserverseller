import { Instagram, MessageCircle, Mail } from 'lucide-react';

/**
 * Social links + legal identity, appended to the footer of every public page.
 *
 * Adds two things the site was missing entirely:
 *
 *  1. Outbound links to SILACOD's own profiles. The site previously contained
 *     no external links at all, so nothing connected the website to the brand's
 *     social presence — for users or for machines resolving the entity.
 *  2. The legal identity line (RC / ICE / capital). Published company
 *     registration is a trust signal journalists and AI systems can verify, and
 *     no Moroccan competitor in this niche publishes it.
 *
 * Deliberately renders no navigation links: each page keeps its own.
 */

/** Live profiles only. Add each as it goes live (task Y8) — never link a 404. */
const SOCIALS = [
  {
    name: 'Instagram',
    href: 'https://www.instagram.com/silacod.ma/',
    Icon: Instagram,
    hoverClass: 'hover:text-[#ff5722] hover:bg-[#ff5722]/5',
    ringClass: 'focus-visible:ring-[#ff5722]/50',
  },
  // Pending creation (task Y8) — uncomment as each profile goes live, and send
  // the URL so it is added to the schema.org sameAs array in lib/seo/schema.ts:
  // Facebook, YouTube, TikTok, LinkedIn.
] as const;

const WHATSAPP_URL = 'https://wa.me/212660517679';
const CONTACT_EMAIL = 'contact@silacod.com';
const ICON = 'w-[18px] h-[18px]';
const BASE_BTN =
  'p-2 rounded-full text-slate-400 transition-colors focus:outline-none focus-visible:ring-2';

export function FooterMeta() {
  return (
    <>
      <div className="flex justify-center items-center gap-2 pt-1">
        {SOCIALS.map(({ name, href, Icon, hoverClass, ringClass }) => (
          <a
            key={name}
            href={href}
            target="_blank"
            rel="noopener noreferrer me"
            aria-label={name}
            title={name}
            className={`${BASE_BTN} ${hoverClass} ${ringClass}`}
          >
            <Icon className={ICON} aria-hidden="true" />
          </a>
        ))}
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp"
          title="WhatsApp +212 660-517679"
          className={`${BASE_BTN} hover:text-[#25D366] hover:bg-[#25D366]/5 focus-visible:ring-[#25D366]/50`}
        >
          <MessageCircle className={ICON} aria-hidden="true" />
        </a>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          aria-label="Email"
          title={CONTACT_EMAIL}
          className={`${BASE_BTN} hover:text-[#ff5722] hover:bg-[#ff5722]/5 focus-visible:ring-[#ff5722]/50`}
        >
          <Mail className={ICON} aria-hidden="true" />
        </a>
      </div>

      <p dir="ltr" className="text-[11px] text-slate-300 font-medium leading-relaxed">
        SILACOD SARL — Capital 100 000 MAD — RC Agadir 68439 — ICE 003942785000074
      </p>
    </>
  );
}

export default FooterMeta;

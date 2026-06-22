/**
 * Blocklist of forbidden words for custom referral link names.
 * Checked case-insensitively against the full name and substrings.
 */
export const BLOCKED_LINK_WORDS = [
  // Impersonation / privilege escalation
  'admin', 'administrator', 'superadmin', 'root', 'moderator', 'support',
  'silacod', 'official', 'staff', 'system', 'helpdesk', 'security',
  // Hacking / technical abuse
  'hacker', 'hack', 'exploit', 'phishing', 'malware', 'virus', 'trojan',
  'keylogger', 'botnet', 'ddos', 'inject', 'xss', 'sqli',
  // Profanity — English
  'fuck', 'shit', 'ass', 'asshole', 'bitch', 'bastard', 'dick', 'pussy',
  'cunt', 'whore', 'slut', 'nigger', 'nigga', 'faggot', 'retard',
  'damn', 'cock', 'penis', 'vagina', 'porn', 'xxx', 'sex',
  // Profanity — French
  'merde', 'putain', 'salope', 'connard', 'connasse', 'enculer', 'encule',
  'batard', 'nique', 'ntm', 'fdp', 'tg', 'pd',
  // Profanity — Arabic (transliterated)
  'khra', 'zebi', 'zab', 'kahba', 'sharmouta', 'sharmota', 'kelb',
  'hmar', 'tboun', 'manyak', 'khanith',
  // Scam / fraud
  'scam', 'fraud', 'fake', 'spam', 'illegal', 'casino', 'gambling',
];

/**
 * Check if a link name contains any blocked word.
 * Returns the first matched blocked word, or null if clean.
 */
export function containsBlockedWord(name: string): string | null {
  const lower = name.toLowerCase();
  for (const word of BLOCKED_LINK_WORDS) {
    if (lower.includes(word)) {
      return word;
    }
  }
  return null;
}

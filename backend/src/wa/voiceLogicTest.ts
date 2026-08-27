/**
 * The two decisions that control whether a reply is spoken.
 *
 * Run with:  npx tsx src/wa/voiceLogicTest.ts
 *
 * Both exist because of failures seen on live traffic:
 *
 *   asksForVoice() — a customer TYPED "can you send audio?" and, because
 *   `mirror` only mirrored actual voice notes, got a text reply. Read as a
 *   refusal by the customer.
 *
 *   The voice-awareness block in buildContext() — the model cannot observe its
 *   own audio (synthesis happens after it writes), so asked whether it could
 *   send a voice note it answered "sorry, I only work in writing here". That
 *   answer was then delivered as an eleven-second voice note.
 */

import { asksForVoice, shouldSpeak } from './speech.js';
import { buildContext } from './brain.js';

let failures = 0;

const check = (label: string, ok: boolean, detail = ''): void => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};

console.log('\nasksForVoice — a typed request counts as asking to be spoken to');
check('darija: asks for audio', asksForVoice('واش تقدر تصيفط ليا أوديو؟'));
check('darija: wants a voice message', asksForVoice('بغيت رسالة صوتية'));
check('darija: asks it to speak', asksForVoice('هضر معايا'));
check('arabizi', asksForVoice('sifet liya audio 3afak'));
check('french', asksForVoice('tu peux envoyer une note vocale ?'));
check('english', asksForVoice('can you send a voice note'));
check('an ordinary price question is NOT a request', !asksForVoice('بشحال هاد الكريم؟'));
check('empty text is not a request', !asksForVoice(''));

console.log('\nshouldSpeak — mirror mode honours both forms of asking');
check('mirror + customer sent voice', shouldSpeak('mirror', 300, 'ok', true, false));
check('mirror + customer typed a request', shouldSpeak('mirror', 300, 'ok', false, true));
check('mirror + plain text stays text', !shouldSpeak('mirror', 300, 'ok', false, false));
check('always speaks regardless', shouldSpeak('always', 300, 'ok', false, false));
check('never stays silent even when asked', !shouldSpeak('never', 300, 'ok', true, true));
check(
  'a reply over ttsMaxChars stays text even when asked',
  !shouldSpeak('mirror', 5, 'a reply longer than the cap', true, true)
);

console.log('\nbuildContext — the model is told it has a voice');
const base = {
  phone: '212600000000',
  pushName: 'Test',
  source: 'ORGANIC',
  draft: {},
  status: 'NEW',
  timezone: 'Africa/Casablanca',
};

const speaking = buildContext({ ...base, voice: { enabled: true, mode: 'mirror', willSpeak: true } });
check('states the reply will be spoken', /WILL be sent to the customer as a WhatsApp voice note/.test(speaking));
check('forbids denying it can send audio', /NEVER tell a customer you cannot send or record audio/.test(speaking));
check('asks for speakable phrasing', /write the way a person talks/i.test(speaking));

const capable = buildContext({ ...base, voice: { enabled: true, mode: 'mirror', willSpeak: false } });
check('still says it HAS a voice when this turn is text', /YOU HAVE A VOICE/.test(capable));
check('explains the mirror rule', /when the customer sends you a voice note, or when they ask/.test(capable));

const mute = buildContext({ ...base, voice: { enabled: false, mode: 'never', willSpeak: false } });
check('says nothing about voice when TTS is off', !/YOU HAVE A VOICE/.test(mute));

const legacy = buildContext(base);
check('omitting the voice field is safe', !/YOU HAVE A VOICE/.test(legacy));

console.log(`\n${failures === 0 ? 'ALL CASES CORRECT' : `${failures} CASE(S) WRONG`}\n`);
process.exit(failures === 0 ? 0 : 1);

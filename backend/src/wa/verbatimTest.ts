/**
 * readVerbatim() against real cases from live traffic.
 *
 * Run with:  npx tsx src/wa/verbatimTest.ts
 *
 * This guard decides whether a synthesised voice note is sent or thrown away,
 * so it has two ways to be wrong and both are expensive:
 *
 *   TOO STRICT — good Darija audio is discarded and the seller concludes voice
 *   replies do not work. This is what actually happened: an exact word-set test
 *   scored a perfectly correct take at 0.5 against a 0.6 threshold, because
 *   Darija attaches pronouns to verbs and a TTS/STT round-trip moves tatweel
 *   and hamza around freely.
 *
 *   TOO LOOSE — a conversational Live model answers the text instead of reading
 *   it, and the customer hears the agent talking to itself.
 */

import { readVerbatim } from './speech.js';

let failures = 0;

function expect(label: string, intended: string, spoken: string, shouldPass: boolean): void {
  const got = readVerbatim(intended, spoken);
  const ok = got === shouldPass;
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok) {
    console.log(`         wanted ${shouldPass ? 'ACCEPT' : 'REJECT'}, got ${got ? 'ACCEPT' : 'REJECT'}`);
    console.log(`         intended: ${intended}`);
    console.log(`         heard   : ${spoken}`);
  }
}

console.log('\nMUST ACCEPT — good audio with normal round-trip variance');

// The exact case that was wrongly rejected on live traffic (turn #76).
expect(
  'real Darija take: tatweel, one STT letter slip, attached pronoun',
  'كريم الثعلبة بـ 38 درهم 🙂 بغيتي نحجزو ليك؟',
  'كريم العلبة ب 38 درهم. بغيتي نحجزوه لك؟',
  true
);

expect('identical text', 'واش بغيتي نأكدو الطلب ديالك', 'واش بغيتي نأكدو الطلب ديالك', true);

expect(
  'hamza and teh-marbuta normalised away',
  'أهلا خويا، الطلبية ديالك تأكدات',
  'اهلا خويا الطلبيه ديالك تاكدات',
  true
);

expect(
  'French with accents stripped by the transcript',
  'Votre commande est confirmée, livraison demain',
  'Votre commande est confirmee livraison demain',
  true
);

expect(
  'emoji and punctuation dropped by the voice',
  'مرحبا بيك 🙂 كيفاش نقدر نعاونك؟',
  'مرحبا بيك كيفاش نقدر نعاونك',
  true
);

console.log('\nMUST REJECT — the model answered instead of reading');

expect(
  'French: conversational answer instead of the line',
  'Votre commande est confirmée, livraison demain',
  'Bonjour ! Merci beaucoup pour votre message, je suis ravi de pouvoir vous aider aujourd hui avec votre demande',
  false
);

expect(
  'Darija: answered the question rather than speaking it',
  'كريم الثعلبة بـ 38 درهم، بغيتي نحجزو ليك؟',
  'أهلا وسهلا بيك أخي الكريم، شكرا على تواصلك معانا، أنا هنا باش نعاونك في أي حاجة بغيتي، تفضل قوليا شنو بغيتي بالضبط ونا غادي نجاوبك',
  false
);

expect(
  'spoke something entirely unrelated',
  'كريم الثعلبة بـ 38 درهم',
  'السلام عليكم ورحمة الله وبركاته',
  false
);

expect(
  'read only a fraction of a long line',
  'Bonjour, votre commande de trois articles est confirmée pour livraison demain matin entre neuf heures et midi à Casablanca',
  'Bonjour',
  false
);

console.log(`\n${failures === 0 ? 'ALL CASES CORRECT' : `${failures} CASE(S) WRONG`}\n`);
process.exit(failures === 0 ? 0 : 1);

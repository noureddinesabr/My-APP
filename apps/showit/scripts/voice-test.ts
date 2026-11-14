// Unit test for the driver's voice commands: node --experimental-strip-types scripts/voice-test.ts
import { numberIn, parseIntent } from '../src/voice/intent.ts';

const cases: [string, string, number?, { awaitingYesNo?: boolean; onJob?: boolean }?][] = [
  ['What offers are there now?', 'list'],
  ['ما هي العروض الموجودة الآن؟', 'list'],
  ['شنو هي العروض اللي كاينة دابا', 'list'],
  ['chno kayn', 'list'],
  ['Quelles sont les offres maintenant ?', 'list'],
  ['next', 'next'],
  ['الموالي', 'next'],
  ['suivant', 'next'],
  ['accept', 'accept'],
  ['نقبل', 'accept'],
  ['أقبل هذا العرض', 'accept'],
  ["j'accepte", 'accept'],
  ['decline', 'decline'],
  ['ما بغيتش', 'decline'],
  ['دوز', 'decline'],
  ['refuser', 'decline'],
  ['add 50', 'more', 50],
  ['زيد 50', 'more', 50],
  ['زيد خمسين', 'more', 50],
  ['زيد مية', 'more', 100],
  ['plus cinquante', 'more', 50],
  ['raise it by twenty', 'more', 20],
  ['نقص عشرين', 'less', 20],
  ['moins 30', 'less', 30],
  ['less', 'less', undefined],
  ['300 dirhams', 'price', 300],
  ['بخمسمية درهم', 'price', 500],
  ['مية و خمسين', 'price', 150],
  ['٤٥٠ درهم', 'price', 450],
  ['trois cents', 'price', 300],
  ['repeat', 'repeat'],
  ['عاود', 'repeat'],
  ['help', 'help'],
  ['اسكت', 'stop'],
  ['واخا', 'yes', undefined, { awaitingYesNo: true }],
  ['لا', 'no', undefined, { awaitingYesNo: true }],
  ['oui', 'yes', undefined, { awaitingYesNo: true }],
  ['وصلت', 'arrived', undefined, { onJob: true }],
  ['راني فالطريق', 'onway', undefined, { onJob: true }],
  ['شحنت', 'loaded', undefined, { onJob: true }],
  ['سلمت الحمولة', 'handed', undefined, { onJob: true }],
  ['je suis arrivé', 'arrived', undefined, { onJob: true }],
  ['I take it', 'take', undefined, { onJob: true }],
  ['آخذها', 'take', undefined, { onJob: true }],
  ['I take it', 'accept'],
  ['go offline', 'offline'],
  ['online', 'online'],
  ['blah blah', 'unknown'],
];
let fail = 0;
for (const [text, kind, n, ctx] of cases) {
  const got = parseIntent(text, ctx);
  const gotN = 'n' in got ? got.n : undefined;
  const ok = got.kind === kind && (n === undefined || gotN === n);
  if (!ok) {
    fail++;
    console.log(`FAIL «${text}» → ${JSON.stringify(got)} (wanted ${kind}${n !== undefined ? ' ' + n : ''})`);
  }
}
console.log(numberIn('ميتين و خمسين'), numberIn('two hundred'));
console.log(fail ? `${fail} failed of ${cases.length}` : `all ${cases.length} passed`);
process.exit(fail ? 1 : 0);

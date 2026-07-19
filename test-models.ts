// test-models.ts — pure-module tests for the bid math, MRR, and follow-up
// bucketing. No expo, no sqlite. Run with: npx tsx test-models.ts

import {
  bucketFollowUps,
  computeBid,
  dayKey,
  formatCents,
  isActivityKind,
  isStage,
  monthlyValueCents,
  mrrCents,
  parseMoneyToCents,
  type Contract,
} from './src/models';

let failures = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    console.log(`FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
    failures++;
  } else console.log(`ok   ${name}`);
};

// ---- money parsing ----
eq('parse plain dollars', parseMoneyToCents('20'), 2000);
eq('parse cents', parseMoneyToCents('20.5'), 2050);
eq('parse full', parseMoneyToCents('1,250.50'), 125050);
eq('parse $ sign', parseMoneyToCents('$1250.50'), 125050);
eq('parse rejects junk', parseMoneyToCents('abc'), null);
eq('parse rejects empty', parseMoneyToCents(''), null);
eq('parse rejects 3 decimals', parseMoneyToCents('12.345'), null);
eq('format', formatCents(131239), '$1312.39');

// ---- bid math: the canonical 10k sqft office ----
// 10,000 sqft @ 3,000 sqft/hr = 3.333 hr/visit; 3x/wk = 13 visits/mo;
// 43.33 hr * $20 = $866.67 labor; +6% supplies; / (1-30%) margin.
const bid = computeBid({
  sqft: 10000,
  visitsPerWeek: 3,
  prodRateSqftHr: 3000,
  laborRateCents: 2000,
  suppliesPct: 6,
  marginPct: 30,
});
eq('bid monthly visits', bid.monthlyVisits, 13);
eq('bid labor cents', bid.laborCents, 86667);
eq('bid supplies cents', bid.suppliesCents, 5200);
eq('bid cost cents', bid.costCents, 91867);
eq('bid price cents', bid.priceCents, 131239);
eq('bid per-visit cents', bid.perVisitCents, 10095);
eq('bid price ~$0.13/sqft/mo sanity', Math.round(bid.priceCents / 10000), 13);

const zero = computeBid({
  sqft: 0, visitsPerWeek: 3, prodRateSqftHr: 3000,
  laborRateCents: 2000, suppliesPct: 6, marginPct: 30,
});
eq('zero sqft -> zero bid', zero.priceCents, 0);
eq('zero prod rate -> zero bid',
  computeBid({ sqft: 100, visitsPerWeek: 1, prodRateSqftHr: 0, laborRateCents: 2000, suppliesPct: 0, marginPct: 0 }).priceCents,
  0);

// margin is clamped to 90 so a wild input can't divide by zero/negative
const clamped = computeBid({
  sqft: 3000, visitsPerWeek: 1, prodRateSqftHr: 3000,
  laborRateCents: 2000, suppliesPct: 0, marginPct: 200,
});
// 1 hr/visit * 52/12 visits = 4.333 hr * $20 = 8667c cost; /(1-0.9) = x10
eq('margin clamped at 90', clamped.priceCents, 86670);

// margin of price, not markup on cost: at 50% margin price is 2x cost
const half = computeBid({
  sqft: 3000, visitsPerWeek: 1, prodRateSqftHr: 3000,
  laborRateCents: 2000, suppliesPct: 0, marginPct: 50,
});
eq('50% margin doubles cost', half.priceCents, half.costCents * 2);

// ---- MRR ----
const c = (patch: Partial<Contract>): Contract => ({
  siteId: 1, visitsPerWeek: 1, ratePeriod: 'monthly', rateCents: 0,
  scope: '', active: true, startMs: 0, ...patch,
});
eq('monthly rate passes through', monthlyValueCents(c({ rateCents: 100000 })), 100000);
eq('per-visit annualizes (exact)',
  monthlyValueCents(c({ ratePeriod: 'visit', rateCents: 15000, visitsPerWeek: 2 })),
  130000);
eq('per-visit annualizes (rounded)',
  monthlyValueCents(c({ ratePeriod: 'visit', rateCents: 10000, visitsPerWeek: 5 })),
  216667);
eq('mrr sums only active contracts',
  mrrCents([
    c({ rateCents: 100000 }),
    c({ rateCents: 50000, active: false }),
    c({ ratePeriod: 'visit', rateCents: 15000, visitsPerWeek: 2 }),
  ]),
  230000);

// ---- follow-up buckets (local calendar days) ----
const noon = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).getTime();
const NOW = noon(2026, 6, 19);
eq('dayKey', dayKey(NOW), 20260719);

const items = [
  { id: 'tomorrow', followUpMs: noon(2026, 6, 20) },
  { id: 'lastweek', followUpMs: noon(2026, 6, 12) },
  { id: 'tonight', followUpMs: noon(2026, 6, 19, 23) },
  { id: 'yesterday', followUpMs: noon(2026, 6, 18) },
  { id: 'nextmonth', followUpMs: noon(2026, 7, 3) },
];
const buckets = bucketFollowUps(items, NOW);
eq('overdue sorted soonest-first', buckets.overdue.map((i) => i.id), ['lastweek', 'yesterday']);
eq('today catches late-evening', buckets.today.map((i) => i.id), ['tonight']);
eq('upcoming sorted', buckets.upcoming.map((i) => i.id), ['tomorrow', 'nextmonth']);

// ---- guards used by db/backup mapping ----
eq('isStage accepts', isStage('walkthrough'), true);
eq('isStage rejects', isStage('negotiation'), false);
eq('isActivityKind accepts', isActivityKind('bid'), true);
eq('isActivityKind rejects', isActivityKind('meeting'), false);

console.log(failures ? `\n${failures} FAILED` : '\nall model tests passed');
process.exit(failures ? 1 : 0);

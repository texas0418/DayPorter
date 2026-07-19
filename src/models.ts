// src/models.ts
// Pure module (no expo imports): DayPorter's domain model plus the two pieces of
// math the app is built around — the janitorial bid calculator and monthly
// recurring revenue. Money is integer cents everywhere; times are epoch ms.
//
// The sales pipeline is deliberately janitorial-shaped: commercial cleaning is
// sold by walking the building, sending a bid, then holding a recurring
// contract — so those are the stages, not generic "qualified/negotiation".

export const STAGES = ['lead', 'walkthrough', 'bid', 'active', 'lost'] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  lead: 'Lead',
  walkthrough: 'Walkthrough',
  bid: 'Bid sent',
  active: 'Active',
  lost: 'Lost',
};

export const isStage = (v: unknown): v is Stage =>
  typeof v === 'string' && (STAGES as readonly string[]).includes(v);

export interface Client {
  id?: number;
  name: string; // company / building owner
  contactName: string;
  phone: string;
  email: string;
  stage: Stage;
  notes: string;
  createdMs: number;
}

export interface Site {
  id?: number;
  clientId: number;
  label: string; // "HQ 3rd floor", "Warehouse B"
  address: string;
  sqft: number; // 0 = unknown
  notes: string;
}

export type RatePeriod = 'monthly' | 'visit';

export interface Contract {
  id?: number;
  siteId: number;
  visitsPerWeek: number;
  ratePeriod: RatePeriod;
  rateCents: number; // per month or per visit, see ratePeriod
  scope: string; // "5x/wk office clean + day porter"
  active: boolean;
  startMs: number;
}

export const ACTIVITY_KINDS = ['note', 'call', 'email', 'walkthrough', 'bid'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  note: 'Note',
  call: 'Call',
  email: 'Email',
  walkthrough: 'Walkthrough',
  bid: 'Bid',
};

export const isActivityKind = (v: unknown): v is ActivityKind =>
  typeof v === 'string' && (ACTIVITY_KINDS as readonly string[]).includes(v);

export interface Activity {
  id?: number;
  clientId: number;
  kind: ActivityKind;
  body: string;
  whenMs: number;
  followUpMs: number | null; // when set and !done, this is an open follow-up
  done: boolean;
}

/** A saved bid keeps its calculator inputs so it can be re-opened and tweaked. */
export interface Bid {
  id?: number;
  clientId: number;
  siteId: number | null;
  sqft: number;
  visitsPerWeek: number;
  prodRateSqftHr: number;
  laborRateCents: number; // loaded hourly cost
  suppliesPct: number;
  marginPct: number;
  priceCents: number; // computed monthly price at save time
  createdMs: number;
}

// ------------------------------------------------------------------ money

export const formatCents = (cents: number): string =>
  `$${(cents / 100).toFixed(2)}`;

/** "$1,250.50" -> 125050. Returns null for anything that isn't a plain
 *  non-negative dollar amount with at most two decimals. */
export function parseMoneyToCents(text: string): number | null {
  const clean = text.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  const [whole, frac = ''] = clean.split('.');
  return Number(whole) * 100 + Number((frac + '00').slice(0, 2));
}

// ------------------------------------------------------------------- bids
//
// Standard janitorial bid math: production rate (sqft cleaned per labor hour)
// turns building size into hours, hours into monthly labor cost at the loaded
// rate, supplies ride on labor as a percentage, and price marks the total cost
// up so margin is a share of PRICE (price = cost / (1 - margin)) — the way
// bidding guides in this industry define margin, not a naive cost markup.

export const AVG_WEEKS_PER_MONTH = 52 / 12;

export interface BidInput {
  sqft: number;
  visitsPerWeek: number;
  prodRateSqftHr: number;
  laborRateCents: number;
  suppliesPct: number;
  marginPct: number; // clamped to 0..90 so the divisor can't blow up
}

export interface BidBreakdown {
  hoursPerVisit: number;
  monthlyVisits: number;
  monthlyHours: number;
  laborCents: number;
  suppliesCents: number;
  costCents: number;
  priceCents: number; // suggested monthly price
  perVisitCents: number;
}

const ZERO_BID: BidBreakdown = {
  hoursPerVisit: 0,
  monthlyVisits: 0,
  monthlyHours: 0,
  laborCents: 0,
  suppliesCents: 0,
  costCents: 0,
  priceCents: 0,
  perVisitCents: 0,
};

export function computeBid(input: BidInput): BidBreakdown {
  const { sqft, visitsPerWeek, prodRateSqftHr, laborRateCents } = input;
  if (sqft <= 0 || visitsPerWeek <= 0 || prodRateSqftHr <= 0) return ZERO_BID;

  const suppliesPct = Math.max(0, input.suppliesPct);
  const marginPct = Math.min(90, Math.max(0, input.marginPct));

  const hoursPerVisit = sqft / prodRateSqftHr;
  const monthlyVisits = visitsPerWeek * AVG_WEEKS_PER_MONTH;
  const monthlyHours = hoursPerVisit * monthlyVisits;
  const laborCents = Math.round(monthlyHours * laborRateCents);
  const suppliesCents = Math.round((laborCents * suppliesPct) / 100);
  const costCents = laborCents + suppliesCents;
  const priceCents = Math.round(costCents / (1 - marginPct / 100));
  const perVisitCents = Math.round(priceCents / monthlyVisits);

  return {
    hoursPerVisit,
    monthlyVisits,
    monthlyHours,
    laborCents,
    suppliesCents,
    costCents,
    priceCents,
    perVisitCents,
  };
}

// -------------------------------------------------------------------- MRR

/** What one contract is worth per month. Per-visit rates annualize through
 *  52 weeks so months are comparable (visits/wk * 52 / 12). */
export function monthlyValueCents(
  c: Pick<Contract, 'visitsPerWeek' | 'ratePeriod' | 'rateCents'>,
): number {
  if (c.ratePeriod === 'monthly') return c.rateCents;
  return Math.round(c.rateCents * c.visitsPerWeek * AVG_WEEKS_PER_MONTH);
}

export function mrrCents(contracts: Contract[]): number {
  return contracts
    .filter((c) => c.active)
    .reduce((sum, c) => sum + monthlyValueCents(c), 0);
}

// ------------------------------------------------------------- follow-ups

/** Local-calendar day key, e.g. 20260719. Comparable with < and >. */
export const dayKey = (ms: number): number => {
  const d = new Date(ms);
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
};

export interface FollowUpBuckets<T> {
  overdue: T[];
  today: T[];
  upcoming: T[];
}

/** Buckets by local calendar day and sorts each bucket soonest-first. */
export function bucketFollowUps<T extends { followUpMs: number }>(
  items: T[],
  nowMs: number,
): FollowUpBuckets<T> {
  const todayKey = dayKey(nowMs);
  const out: FollowUpBuckets<T> = { overdue: [], today: [], upcoming: [] };
  for (const it of items) {
    const k = dayKey(it.followUpMs);
    if (k < todayKey) out.overdue.push(it);
    else if (k === todayKey) out.today.push(it);
    else out.upcoming.push(it);
  }
  const byMs = (a: T, b: T) => a.followUpMs - b.followUpMs;
  out.overdue.sort(byMs);
  out.today.sort(byMs);
  out.upcoming.sort(byMs);
  return out;
}

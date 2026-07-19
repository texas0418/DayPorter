// test-db.ts — runs the real schema/SQL from dbCore.ts against node:sqlite.
// Requires Node 22+ (node:sqlite). Run with: npx tsx test-db.ts
// @ts-expect-error node:sqlite has no types under Expo's tsconfig; tsx runs it fine
import { DatabaseSync } from 'node:sqlite';
import {
  ALL_ACTIVITIES_SQL, ALL_BIDS_SQL, ALL_CLIENTS_SQL, ALL_CONTRACTS_SQL,
  ALL_SITES_SQL, ActivityRow, BidRow, ClientRow, ContractRow,
  COUNT_CLIENTS_SQL, DELETE_ALL_CLIENTS_SQL, DELETE_CLIENT_SQL,
  DELETE_CONTRACT_SQL, DELETE_SITE_SQL, ENABLE_FK_SQL, FollowUpRow,
  GET_CLIENT_SQL, INSERT_ACTIVITY_SQL, INSERT_BID_SQL, INSERT_CLIENT_SQL,
  INSERT_CONTRACT_SQL, INSERT_SITE_SQL, LIST_ACTIVE_CONTRACTS_SQL,
  LIST_ACTIVITIES_SQL, LIST_BIDS_SQL, LIST_CLIENTS_SQL,
  LIST_CONTRACTS_BY_CLIENT_SQL, LIST_OPEN_FOLLOW_UPS_SQL, LIST_SITES_SQL,
  MIGRATIONS, RESTORE_ACTIVITY_SQL, RESTORE_BID_SQL, RESTORE_CLIENT_SQL,
  RESTORE_CONTRACT_SQL, RESTORE_SITE_SQL, SET_ACTIVITY_DONE_SQL,
  SET_CLIENT_STAGE_SQL, SET_CONTRACT_ACTIVE_SQL, SiteRow,
  TARGET_DB_VERSION, UPDATE_CLIENT_SQL, UPDATE_SITE_SQL,
  activityToParams, bidToParams, clientToParams, contractToParams,
  rowToActivity, rowToBid, rowToClient, rowToContract, rowToSite,
  siteToParams,
} from './src/dbCore';
import { parseBackup, serializeBackup } from './src/backupFormat';
import type { Activity, Bid, Client, Contract, Site } from './src/models';

let failures = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    console.log(`FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
    failures++;
  } else console.log(`ok   ${name}`);
};

const db = new DatabaseSync(':memory:');
db.exec(ENABLE_FK_SQL);

function migrate(): void {
  let v = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  while (v < MIGRATIONS.length) {
    for (const sql of MIGRATIONS[v]) db.exec(sql);
    v++;
    db.exec(`PRAGMA user_version = ${v}`);
  }
}

migrate();
eq('migrates to target version',
  (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version,
  TARGET_DB_VERSION);
migrate();
eq('re-migrate is a no-op', true, true);

// ---- client round-trip ----
const T0 = new Date(2026, 6, 19, 9, 0).getTime();
const acme: Client = {
  name: 'Acme Offices', contactName: 'Dana Ruiz', phone: '555-0100',
  email: 'dana@acme.test', stage: 'lead', notes: 'referred by HitchWell',
  createdMs: T0,
};
const clientId = Number(db.prepare(INSERT_CLIENT_SQL).run(...clientToParams(acme)).lastInsertRowid);
eq('client round-trip',
  rowToClient(db.prepare(GET_CLIENT_SQL).get(clientId) as unknown as ClientRow),
  { id: clientId, ...acme });

db.prepare(SET_CLIENT_STAGE_SQL).run('walkthrough', clientId);
eq('stage update',
  rowToClient(db.prepare(GET_CLIENT_SQL).get(clientId) as unknown as ClientRow).stage,
  'walkthrough');

db.prepare(UPDATE_CLIENT_SQL).run(
  ...clientToParams({ ...acme, stage: 'bid', phone: '555-0199' }), clientId,
);
eq('full client update',
  rowToClient(db.prepare(GET_CLIENT_SQL).get(clientId) as unknown as ClientRow).phone,
  '555-0199');

// unknown stage in the row maps safely back to 'lead'
db.exec(`UPDATE clients SET stage = 'negotiation' WHERE id = ${clientId}`);
eq('unknown stage maps to lead',
  rowToClient(db.prepare(GET_CLIENT_SQL).get(clientId) as unknown as ClientRow).stage,
  'lead');
db.prepare(SET_CLIENT_STAGE_SQL).run('active', clientId);

eq('count clients', (db.prepare(COUNT_CLIENTS_SQL).get() as { n: number }).n, 1);

// ---- sites ----
const hq: Site = { clientId, label: 'HQ', address: '12 Main St', sqft: 10000, notes: '' };
const siteId = Number(db.prepare(INSERT_SITE_SQL).run(...siteToParams(hq)).lastInsertRowid);
const warehouse: Site = { clientId, label: 'Warehouse', address: '', sqft: 0, notes: '' };
const whId = Number(db.prepare(INSERT_SITE_SQL).run(...siteToParams(warehouse)).lastInsertRowid);
eq('sites round-trip',
  (db.prepare(LIST_SITES_SQL).all(clientId) as unknown as SiteRow[]).map(rowToSite),
  [{ id: siteId, ...hq }, { id: whId, ...warehouse }]);

db.prepare(UPDATE_SITE_SQL).run('HQ 1-3F', '12 Main St', 12000, 'gate 4411', siteId);
eq('site update',
  (db.prepare(LIST_SITES_SQL).all(clientId) as unknown as SiteRow[]).map(rowToSite)[0].sqft,
  12000);

// ---- contracts (belong to sites, listed by client through the join) ----
const ct: Contract = {
  siteId, visitsPerWeek: 3, ratePeriod: 'monthly', rateCents: 131239,
  scope: '3x office clean', active: true, startMs: T0,
};
const ctId = Number(db.prepare(INSERT_CONTRACT_SQL).run(...contractToParams(ct)).lastInsertRowid);
eq('contract round-trip via client join',
  (db.prepare(LIST_CONTRACTS_BY_CLIENT_SQL).all(clientId) as unknown as ContractRow[]).map(rowToContract),
  [{ id: ctId, ...ct }]);

db.prepare(SET_CONTRACT_ACTIVE_SQL).run(0, ctId);
eq('paused contract leaves active list',
  (db.prepare(LIST_ACTIVE_CONTRACTS_SQL).all() as unknown as ContractRow[]).length, 0);
db.prepare(SET_CONTRACT_ACTIVE_SQL).run(1, ctId);
eq('resumed contract returns',
  (db.prepare(LIST_ACTIVE_CONTRACTS_SQL).all() as unknown as ContractRow[]).map(rowToContract)[0].active,
  true);

// ---- activities and follow-ups ----
const walk: Activity = {
  clientId, kind: 'walkthrough', body: 'Walked all 3 floors', whenMs: T0,
  followUpMs: T0 + 3 * 86400000, done: false,
};
const walkId = Number(db.prepare(INSERT_ACTIVITY_SQL).run(...activityToParams(walk)).lastInsertRowid);
const note: Activity = {
  clientId, kind: 'note', body: 'no follow-up', whenMs: T0 + 1000,
  followUpMs: null, done: false,
};
db.prepare(INSERT_ACTIVITY_SQL).run(...activityToParams(note));

eq('activities newest first',
  (db.prepare(LIST_ACTIVITIES_SQL).all(clientId) as unknown as ActivityRow[]).map(rowToActivity)
    .map((a) => a.kind),
  ['note', 'walkthrough']);

const open = db.prepare(LIST_OPEN_FOLLOW_UPS_SQL).all() as unknown as FollowUpRow[];
eq('open follow-ups joined with client name',
  open.map((r) => [r.id, r.client_name]), [[walkId, 'Acme Offices']]);

db.prepare(SET_ACTIVITY_DONE_SQL).run(1, walkId);
eq('done follow-up leaves the open list',
  (db.prepare(LIST_OPEN_FOLLOW_UPS_SQL).all() as unknown as FollowUpRow[]).length, 0);

// ---- bids ----
const bid: Bid = {
  clientId, siteId, sqft: 12000, visitsPerWeek: 3, prodRateSqftHr: 3000,
  laborRateCents: 2000, suppliesPct: 6, marginPct: 30, priceCents: 157487,
  createdMs: T0 + 2000,
};
const bidId = Number(db.prepare(INSERT_BID_SQL).run(...bidToParams(bid)).lastInsertRowid);
eq('bid round-trip',
  (db.prepare(LIST_BIDS_SQL).all(clientId) as unknown as BidRow[]).map(rowToBid),
  [{ id: bidId, ...bid }]);

// deleting the site nulls the bid's site reference but keeps the bid
db.prepare(DELETE_SITE_SQL).run(whId); // warehouse: no dependents
db.prepare(DELETE_SITE_SQL).run(siteId);
eq('deleting site cascades its contracts',
  (db.prepare(LIST_CONTRACTS_BY_CLIENT_SQL).all(clientId) as unknown as ContractRow[]).length, 0);
eq('deleting site keeps bid, nulls site ref',
  (db.prepare(LIST_BIDS_SQL).all(clientId) as unknown as BidRow[]).map(rowToBid)[0].siteId,
  null);

// ---- client cascade ----
const temp = Number(db.prepare(INSERT_CLIENT_SQL).run(
  ...clientToParams({ name: 'Temp Co', contactName: '', phone: '', email: '', stage: 'lead', notes: '', createdMs: T0 + 5000 }),
).lastInsertRowid);
db.prepare(INSERT_SITE_SQL).run(temp, 'Site X', '', 0, '');
db.prepare(INSERT_ACTIVITY_SQL).run(temp, 'call', 'intro', T0, null, 0);
eq('clients list newest first',
  (db.prepare(LIST_CLIENTS_SQL).all() as unknown as ClientRow[]).map((c) => c.id),
  [temp, clientId]);
db.prepare(DELETE_CLIENT_SQL).run(temp);
eq('deleting client cascades sites',
  (db.prepare(LIST_SITES_SQL).all(temp) as unknown as SiteRow[]).length, 0);
eq('deleting client cascades activities',
  (db.prepare(LIST_ACTIVITIES_SQL).all(temp) as unknown as ActivityRow[]).length, 0);

// ---- backup round-trip through the real SQL ----
// rebuild a site + contract so every table has rows
const s2 = Number(db.prepare(INSERT_SITE_SQL).run(clientId, 'HQ again', '12 Main St', 12000, '').lastInsertRowid);
db.prepare(INSERT_CONTRACT_SQL).run(s2, 5, 'visit', 12500, 'nightly', 1, T0);

const snapshot = () => ({
  clients: (db.prepare(ALL_CLIENTS_SQL).all() as unknown as ClientRow[]).map(rowToClient),
  sites: (db.prepare(ALL_SITES_SQL).all() as unknown as SiteRow[]).map(rowToSite),
  contracts: (db.prepare(ALL_CONTRACTS_SQL).all() as unknown as ContractRow[]).map(rowToContract),
  activities: (db.prepare(ALL_ACTIVITIES_SQL).all() as unknown as ActivityRow[]).map(rowToActivity),
  bids: (db.prepare(ALL_BIDS_SQL).all() as unknown as BidRow[]).map(rowToBid),
});
const before = snapshot();
const json = serializeBackup(
  before.clients, before.sites, before.contracts, before.activities, before.bids, T0,
);
const parsed = parseBackup(json);

db.exec(DELETE_ALL_CLIENTS_SQL);
eq('delete-all leaves nothing', snapshot().clients.length, 0);
for (const c of parsed.clients)
  db.prepare(RESTORE_CLIENT_SQL).run(c.id!, c.name, c.contactName, c.phone, c.email, c.stage, c.notes, c.createdMs);
for (const s of parsed.sites)
  db.prepare(RESTORE_SITE_SQL).run(s.id!, s.clientId, s.label, s.address, s.sqft, s.notes);
for (const c of parsed.contracts)
  db.prepare(RESTORE_CONTRACT_SQL).run(c.id!, c.siteId, c.visitsPerWeek, c.ratePeriod, c.rateCents, c.scope, c.active ? 1 : 0, c.startMs);
for (const a of parsed.activities)
  db.prepare(RESTORE_ACTIVITY_SQL).run(a.id!, a.clientId, a.kind, a.body, a.whenMs, a.followUpMs, a.done ? 1 : 0);
for (const b of parsed.bids)
  db.prepare(RESTORE_BID_SQL).run(b.id!, b.clientId, b.siteId, b.sqft, b.visitsPerWeek, b.prodRateSqftHr, b.laborRateCents, b.suppliesPct, b.marginPct, b.priceCents, b.createdMs);
eq('backup restore round-trips exactly', snapshot(), before);

// ---- backup format guards ----
let threw = '';
try { parseBackup('not json'); } catch (e: any) { threw = e.message; }
eq('parse rejects non-JSON', threw.includes('not JSON'), true);
try { parseBackup('{"format":"other"}'); } catch (e: any) { threw = e.message; }
eq('parse rejects foreign format', threw.includes('Not a DayPorter backup'), true);
const orphan = parseBackup(JSON.stringify({
  format: 'dayporter-backup', version: 1, exportedAtMs: 0,
  clients: [], sites: [{ id: 9, clientId: 99, label: 'X', address: '', sqft: 0, notes: '' }],
  contracts: [], activities: [], bids: [],
}));
eq('orphaned site dropped on parse', orphan.sites.length, 0);
const badStage = parseBackup(JSON.stringify({
  format: 'dayporter-backup', version: 1, exportedAtMs: 0,
  clients: [{ id: 1, name: 'A', createdMs: 5, stage: 'negotiation' }],
  sites: [], contracts: [], activities: [], bids: [],
}));
eq('unknown stage defaults to lead on parse', badStage.clients[0].stage, 'lead');

console.log(failures ? `\n${failures} FAILED` : '\nall db tests passed');
process.exit(failures ? 1 : 0);

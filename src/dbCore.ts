// src/dbCore.ts
// Pure module: SQL schema/migrations and row<->model mapping.
// No expo imports so it can be tested in Node against node:sqlite.

import type { Activity, Bid, Client, Contract, Site } from './models';
import { isActivityKind, isStage } from './models';

/** Each entry is the batch of statements that upgrades user_version N-1 -> N.
 *  MIGRATIONS[0] builds version 1. Append only; never edit shipped entries. */
export const MIGRATIONS: string[][] = [
  [
    `CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      stage TEXT NOT NULL DEFAULT 'lead',
      notes TEXT NOT NULL DEFAULT '',
      created_ms INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      sqft INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT ''
    )`,
    `CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      visits_per_week INTEGER NOT NULL DEFAULT 1,
      rate_period TEXT NOT NULL DEFAULT 'monthly',
      rate_cents INTEGER NOT NULL DEFAULT 0,
      scope TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      start_ms INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'note',
      body TEXT NOT NULL DEFAULT '',
      when_ms INTEGER NOT NULL,
      follow_up_ms INTEGER,
      done INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS bids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
      sqft INTEGER NOT NULL,
      visits_per_week INTEGER NOT NULL,
      prod_rate_sqft_hr INTEGER NOT NULL,
      labor_rate_cents INTEGER NOT NULL,
      supplies_pct INTEGER NOT NULL,
      margin_pct INTEGER NOT NULL,
      price_cents INTEGER NOT NULL,
      created_ms INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sites_client ON sites(client_id)`,
    `CREATE INDEX IF NOT EXISTS idx_contracts_site ON contracts(site_id)`,
    `CREATE INDEX IF NOT EXISTS idx_activities_client ON activities(client_id)`,
    `CREATE INDEX IF NOT EXISTS idx_activities_follow_up ON activities(follow_up_ms)`,
    `CREATE INDEX IF NOT EXISTS idx_bids_client ON bids(client_id)`,
  ],
];

export const TARGET_DB_VERSION = MIGRATIONS.length;

export interface ClientRow {
  id: number;
  name: string;
  contact_name: string;
  phone: string;
  email: string;
  stage: string;
  notes: string;
  created_ms: number;
}
export interface SiteRow {
  id: number;
  client_id: number;
  label: string;
  address: string;
  sqft: number;
  notes: string;
}
export interface ContractRow {
  id: number;
  site_id: number;
  visits_per_week: number;
  rate_period: string;
  rate_cents: number;
  scope: string;
  active: number;
  start_ms: number;
}
export interface ActivityRow {
  id: number;
  client_id: number;
  kind: string;
  body: string;
  when_ms: number;
  follow_up_ms: number | null;
  done: number;
}
export interface BidRow {
  id: number;
  client_id: number;
  site_id: number | null;
  sqft: number;
  visits_per_week: number;
  prod_rate_sqft_hr: number;
  labor_rate_cents: number;
  supplies_pct: number;
  margin_pct: number;
  price_cents: number;
  created_ms: number;
}

export const rowToClient = (r: ClientRow): Client => ({
  id: r.id,
  name: r.name,
  contactName: r.contact_name,
  phone: r.phone,
  email: r.email,
  stage: isStage(r.stage) ? r.stage : 'lead',
  notes: r.notes,
  createdMs: r.created_ms,
});
export const rowToSite = (r: SiteRow): Site => ({
  id: r.id,
  clientId: r.client_id,
  label: r.label,
  address: r.address,
  sqft: r.sqft,
  notes: r.notes,
});
export const rowToContract = (r: ContractRow): Contract => ({
  id: r.id,
  siteId: r.site_id,
  visitsPerWeek: r.visits_per_week,
  ratePeriod: r.rate_period === 'visit' ? 'visit' : 'monthly',
  rateCents: r.rate_cents,
  scope: r.scope,
  active: r.active !== 0,
  startMs: r.start_ms,
});
export const rowToActivity = (r: ActivityRow): Activity => ({
  id: r.id,
  clientId: r.client_id,
  kind: isActivityKind(r.kind) ? r.kind : 'note',
  body: r.body,
  whenMs: r.when_ms,
  followUpMs: r.follow_up_ms,
  done: r.done !== 0,
});
export const rowToBid = (r: BidRow): Bid => ({
  id: r.id,
  clientId: r.client_id,
  siteId: r.site_id,
  sqft: r.sqft,
  visitsPerWeek: r.visits_per_week,
  prodRateSqftHr: r.prod_rate_sqft_hr,
  laborRateCents: r.labor_rate_cents,
  suppliesPct: r.supplies_pct,
  marginPct: r.margin_pct,
  priceCents: r.price_cents,
  createdMs: r.created_ms,
});

export const clientToParams = (
  c: Client,
): [string, string, string, string, string, string, number] => [
  c.name,
  c.contactName,
  c.phone,
  c.email,
  c.stage,
  c.notes,
  c.createdMs,
];
export const siteToParams = (s: Site): [number, string, string, number, string] => [
  s.clientId,
  s.label,
  s.address,
  s.sqft,
  s.notes,
];
export const contractToParams = (
  c: Contract,
): [number, number, string, number, string, number, number] => [
  c.siteId,
  c.visitsPerWeek,
  c.ratePeriod,
  c.rateCents,
  c.scope,
  c.active ? 1 : 0,
  c.startMs,
];
export const activityToParams = (
  a: Activity,
): [number, string, string, number, number | null, number] => [
  a.clientId,
  a.kind,
  a.body,
  a.whenMs,
  a.followUpMs,
  a.done ? 1 : 0,
];
export const bidToParams = (
  b: Bid,
): [number, number | null, number, number, number, number, number, number, number, number] => [
  b.clientId,
  b.siteId,
  b.sqft,
  b.visitsPerWeek,
  b.prodRateSqftHr,
  b.laborRateCents,
  b.suppliesPct,
  b.marginPct,
  b.priceCents,
  b.createdMs,
];

// ----------------------------------------------------------------- clients
export const INSERT_CLIENT_SQL = `INSERT INTO clients (name, contact_name, phone, email, stage, notes, created_ms) VALUES (?, ?, ?, ?, ?, ?, ?)`;
export const UPDATE_CLIENT_SQL = `UPDATE clients SET name = ?, contact_name = ?, phone = ?, email = ?, stage = ?, notes = ?, created_ms = ? WHERE id = ?`;
export const SET_CLIENT_STAGE_SQL = `UPDATE clients SET stage = ? WHERE id = ?`;
export const DELETE_CLIENT_SQL = `DELETE FROM clients WHERE id = ?`;
export const GET_CLIENT_SQL = `SELECT * FROM clients WHERE id = ?`;
export const LIST_CLIENTS_SQL = `SELECT * FROM clients ORDER BY created_ms DESC`;
export const COUNT_CLIENTS_SQL = `SELECT COUNT(*) AS n FROM clients`;

// ------------------------------------------------------------------- sites
export const INSERT_SITE_SQL = `INSERT INTO sites (client_id, label, address, sqft, notes) VALUES (?, ?, ?, ?, ?)`;
export const UPDATE_SITE_SQL = `UPDATE sites SET label = ?, address = ?, sqft = ?, notes = ? WHERE id = ?`;
export const DELETE_SITE_SQL = `DELETE FROM sites WHERE id = ?`;
export const LIST_SITES_SQL = `SELECT * FROM sites WHERE client_id = ? ORDER BY id`;

// --------------------------------------------------------------- contracts
export const INSERT_CONTRACT_SQL = `INSERT INTO contracts (site_id, visits_per_week, rate_period, rate_cents, scope, active, start_ms) VALUES (?, ?, ?, ?, ?, ?, ?)`;
export const SET_CONTRACT_ACTIVE_SQL = `UPDATE contracts SET active = ? WHERE id = ?`;
export const DELETE_CONTRACT_SQL = `DELETE FROM contracts WHERE id = ?`;
export const LIST_CONTRACTS_BY_CLIENT_SQL = `SELECT c.* FROM contracts c
  JOIN sites s ON s.id = c.site_id WHERE s.client_id = ? ORDER BY c.id`;
export const LIST_ACTIVE_CONTRACTS_SQL = `SELECT * FROM contracts WHERE active = 1 ORDER BY id`;

// -------------------------------------------------------------- activities
export const INSERT_ACTIVITY_SQL = `INSERT INTO activities (client_id, kind, body, when_ms, follow_up_ms, done) VALUES (?, ?, ?, ?, ?, ?)`;
export const SET_ACTIVITY_DONE_SQL = `UPDATE activities SET done = ? WHERE id = ?`;
export const DELETE_ACTIVITY_SQL = `DELETE FROM activities WHERE id = ?`;
export const LIST_ACTIVITIES_SQL = `SELECT * FROM activities WHERE client_id = ? ORDER BY when_ms DESC, id DESC`;

/** Open follow-ups across all clients, with the client name for display. */
export const LIST_OPEN_FOLLOW_UPS_SQL = `SELECT a.*, c.name AS client_name FROM activities a
  JOIN clients c ON c.id = a.client_id
  WHERE a.follow_up_ms IS NOT NULL AND a.done = 0
  ORDER BY a.follow_up_ms`;

export interface FollowUpRow extends ActivityRow {
  client_name: string;
}

// -------------------------------------------------------------------- bids
export const INSERT_BID_SQL = `INSERT INTO bids (client_id, site_id, sqft, visits_per_week, prod_rate_sqft_hr, labor_rate_cents, supplies_pct, margin_pct, price_cents, created_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
export const DELETE_BID_SQL = `DELETE FROM bids WHERE id = ?`;
export const LIST_BIDS_SQL = `SELECT * FROM bids WHERE client_id = ? ORDER BY created_ms DESC, id DESC`;

// FK cascades require this pragma per-connection in SQLite.
export const ENABLE_FK_SQL = `PRAGMA foreign_keys = ON`;

// ------------------------------------------------------------------ backup
export const ALL_CLIENTS_SQL = `SELECT * FROM clients ORDER BY id`;
export const ALL_SITES_SQL = `SELECT * FROM sites ORDER BY id`;
export const ALL_CONTRACTS_SQL = `SELECT * FROM contracts ORDER BY id`;
export const ALL_ACTIVITIES_SQL = `SELECT * FROM activities ORDER BY id`;
export const ALL_BIDS_SQL = `SELECT * FROM bids ORDER BY id`;
export const DELETE_ALL_CLIENTS_SQL = `DELETE FROM clients`; // cascades everything

// Restore keeps original ids so cross-table references survive round-trip.
export const RESTORE_CLIENT_SQL = `INSERT INTO clients (id, name, contact_name, phone, email, stage, notes, created_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
export const RESTORE_SITE_SQL = `INSERT INTO sites (id, client_id, label, address, sqft, notes) VALUES (?, ?, ?, ?, ?, ?)`;
export const RESTORE_CONTRACT_SQL = `INSERT INTO contracts (id, site_id, visits_per_week, rate_period, rate_cents, scope, active, start_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
export const RESTORE_ACTIVITY_SQL = `INSERT INTO activities (id, client_id, kind, body, when_ms, follow_up_ms, done) VALUES (?, ?, ?, ?, ?, ?, ?)`;
export const RESTORE_BID_SQL = `INSERT INTO bids (id, client_id, site_id, sqft, visits_per_week, prod_rate_sqft_hr, labor_rate_cents, supplies_pct, margin_pct, price_cents, created_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

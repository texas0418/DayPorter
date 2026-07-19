// src/db.ts
// expo-sqlite wrapper. All SQL and mapping live in dbCore.ts (pure, tested).
// Billowe pattern: lazy singleton, PRAGMA user_version migrations in a
// transaction, integer epoch-ms / integer cents everywhere.

import * as SQLite from 'expo-sqlite';
import type { Activity, Bid, Client, Contract, Site, Stage } from './models';
import type { BackupV1 } from './backupFormat';
import {
  ALL_ACTIVITIES_SQL,
  ALL_BIDS_SQL,
  ALL_CLIENTS_SQL,
  ALL_CONTRACTS_SQL,
  ALL_SITES_SQL,
  ActivityRow,
  BidRow,
  ClientRow,
  ContractRow,
  COUNT_CLIENTS_SQL,
  DELETE_ACTIVITY_SQL,
  DELETE_ALL_CLIENTS_SQL,
  DELETE_BID_SQL,
  DELETE_CLIENT_SQL,
  DELETE_CONTRACT_SQL,
  DELETE_SITE_SQL,
  ENABLE_FK_SQL,
  FollowUpRow,
  GET_CLIENT_SQL,
  INSERT_ACTIVITY_SQL,
  INSERT_BID_SQL,
  INSERT_CLIENT_SQL,
  INSERT_CONTRACT_SQL,
  INSERT_SITE_SQL,
  LIST_ACTIVE_CONTRACTS_SQL,
  LIST_ACTIVITIES_SQL,
  LIST_BIDS_SQL,
  LIST_CLIENTS_SQL,
  LIST_CONTRACTS_BY_CLIENT_SQL,
  LIST_OPEN_FOLLOW_UPS_SQL,
  LIST_SITES_SQL,
  MIGRATIONS,
  RESTORE_ACTIVITY_SQL,
  RESTORE_BID_SQL,
  RESTORE_CLIENT_SQL,
  RESTORE_CONTRACT_SQL,
  RESTORE_SITE_SQL,
  SET_ACTIVITY_DONE_SQL,
  SET_CLIENT_STAGE_SQL,
  SET_CONTRACT_ACTIVE_SQL,
  SiteRow,
  UPDATE_CLIENT_SQL,
  UPDATE_SITE_SQL,
  activityToParams,
  bidToParams,
  clientToParams,
  contractToParams,
  rowToActivity,
  rowToBid,
  rowToClient,
  rowToContract,
  rowToSite,
  siteToParams,
} from './dbCore';

const DB_NAME = 'dayporter.db';

let db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync(DB_NAME);
    db.execSync('PRAGMA journal_mode = WAL');
    db.execSync(ENABLE_FK_SQL);
    runMigrations(db);
  }
  return db;
}

function runMigrations(d: SQLite.SQLiteDatabase): void {
  const row = d.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const batch = MIGRATIONS[version];
    d.withTransactionSync(() => {
      for (const sql of batch) d.execSync(sql);
    });
    version++;
    d.execSync(`PRAGMA user_version = ${version}`);
  }
}

// ----------------------------------------------------------------- clients

export function createClient(c: Client): number {
  const res = getDb().runSync(INSERT_CLIENT_SQL, clientToParams(c));
  return Number(res.lastInsertRowId);
}

export function updateClient(c: Client): void {
  if (c.id == null) throw new Error('updateClient requires id');
  getDb().runSync(UPDATE_CLIENT_SQL, [...clientToParams(c), c.id]);
}

export function setClientStage(id: number, stage: Stage): void {
  getDb().runSync(SET_CLIENT_STAGE_SQL, [stage, id]);
}

export function deleteClient(id: number): void {
  getDb().runSync(DELETE_CLIENT_SQL, [id]);
}

export function getClient(id: number): Client | null {
  const row = getDb().getFirstSync<ClientRow>(GET_CLIENT_SQL, [id]);
  return row ? rowToClient(row) : null;
}

export function listClients(): Client[] {
  return getDb().getAllSync<ClientRow>(LIST_CLIENTS_SQL).map(rowToClient);
}

export function countClients(): number {
  return getDb().getFirstSync<{ n: number }>(COUNT_CLIENTS_SQL)?.n ?? 0;
}

// ------------------------------------------------------------------- sites

export function addSite(s: Site): number {
  const res = getDb().runSync(INSERT_SITE_SQL, siteToParams(s));
  return Number(res.lastInsertRowId);
}

export function updateSite(s: Site): void {
  if (s.id == null) throw new Error('updateSite requires id');
  getDb().runSync(UPDATE_SITE_SQL, [s.label, s.address, s.sqft, s.notes, s.id]);
}

export function deleteSite(id: number): void {
  getDb().runSync(DELETE_SITE_SQL, [id]);
}

export function listSites(clientId: number): Site[] {
  return getDb().getAllSync<SiteRow>(LIST_SITES_SQL, [clientId]).map(rowToSite);
}

// --------------------------------------------------------------- contracts

export function addContract(c: Contract): number {
  const res = getDb().runSync(INSERT_CONTRACT_SQL, contractToParams(c));
  return Number(res.lastInsertRowId);
}

export function setContractActive(id: number, active: boolean): void {
  getDb().runSync(SET_CONTRACT_ACTIVE_SQL, [active ? 1 : 0, id]);
}

export function deleteContract(id: number): void {
  getDb().runSync(DELETE_CONTRACT_SQL, [id]);
}

export function listContractsByClient(clientId: number): Contract[] {
  return getDb()
    .getAllSync<ContractRow>(LIST_CONTRACTS_BY_CLIENT_SQL, [clientId])
    .map(rowToContract);
}

export function listActiveContracts(): Contract[] {
  return getDb().getAllSync<ContractRow>(LIST_ACTIVE_CONTRACTS_SQL).map(rowToContract);
}

// -------------------------------------------------------------- activities

export function addActivity(a: Activity): number {
  const res = getDb().runSync(INSERT_ACTIVITY_SQL, activityToParams(a));
  return Number(res.lastInsertRowId);
}

export function setActivityDone(id: number, done: boolean): void {
  getDb().runSync(SET_ACTIVITY_DONE_SQL, [done ? 1 : 0, id]);
}

export function deleteActivity(id: number): void {
  getDb().runSync(DELETE_ACTIVITY_SQL, [id]);
}

export function listActivities(clientId: number): Activity[] {
  return getDb()
    .getAllSync<ActivityRow>(LIST_ACTIVITIES_SQL, [clientId])
    .map(rowToActivity);
}

export interface OpenFollowUp extends Activity {
  clientName: string;
  followUpMs: number; // narrowed: open follow-ups always have one
}

export function listOpenFollowUps(): OpenFollowUp[] {
  return getDb()
    .getAllSync<FollowUpRow>(LIST_OPEN_FOLLOW_UPS_SQL)
    .map((r) => ({
      ...rowToActivity(r),
      followUpMs: r.follow_up_ms!,
      clientName: r.client_name,
    }));
}

// -------------------------------------------------------------------- bids

export function addBid(b: Bid): number {
  const res = getDb().runSync(INSERT_BID_SQL, bidToParams(b));
  return Number(res.lastInsertRowId);
}

export function deleteBid(id: number): void {
  getDb().runSync(DELETE_BID_SQL, [id]);
}

export function listBids(clientId: number): Bid[] {
  return getDb().getAllSync<BidRow>(LIST_BIDS_SQL, [clientId]).map(rowToBid);
}

// ------------------------------------------------------------------ backup

export function getAllForBackup(): {
  clients: Client[];
  sites: Site[];
  contracts: Contract[];
  activities: Activity[];
  bids: Bid[];
} {
  const d = getDb();
  return {
    clients: d.getAllSync<ClientRow>(ALL_CLIENTS_SQL).map(rowToClient),
    sites: d.getAllSync<SiteRow>(ALL_SITES_SQL).map(rowToSite),
    contracts: d.getAllSync<ContractRow>(ALL_CONTRACTS_SQL).map(rowToContract),
    activities: d.getAllSync<ActivityRow>(ALL_ACTIVITIES_SQL).map(rowToActivity),
    bids: d.getAllSync<BidRow>(ALL_BIDS_SQL).map(rowToBid),
  };
}

/** Restore: replace-all inside one transaction (Billowe backup semantics). */
export function replaceAll(backup: BackupV1): void {
  const d = getDb();
  d.withTransactionSync(() => {
    d.execSync(DELETE_ALL_CLIENTS_SQL); // cascades sites/contracts/activities/bids
    for (const c of backup.clients)
      d.runSync(RESTORE_CLIENT_SQL, [
        c.id!, c.name, c.contactName, c.phone, c.email, c.stage, c.notes, c.createdMs,
      ]);
    for (const s of backup.sites)
      d.runSync(RESTORE_SITE_SQL, [s.id!, s.clientId, s.label, s.address, s.sqft, s.notes]);
    for (const c of backup.contracts)
      d.runSync(RESTORE_CONTRACT_SQL, [
        c.id!, c.siteId, c.visitsPerWeek, c.ratePeriod, c.rateCents, c.scope,
        c.active ? 1 : 0, c.startMs,
      ]);
    for (const a of backup.activities)
      d.runSync(RESTORE_ACTIVITY_SQL, [
        a.id!, a.clientId, a.kind, a.body, a.whenMs, a.followUpMs, a.done ? 1 : 0,
      ]);
    for (const b of backup.bids)
      d.runSync(RESTORE_BID_SQL, [
        b.id!, b.clientId, b.siteId, b.sqft, b.visitsPerWeek, b.prodRateSqftHr,
        b.laborRateCents, b.suppliesPct, b.marginPct, b.priceCents, b.createdMs,
      ]);
  });
}

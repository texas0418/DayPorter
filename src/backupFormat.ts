// src/backupFormat.ts
// Pure module (Node-testable): versioned JSON backup format.
// Version 1: every client with its sites, contracts, activities, and bids,
// ids included (restore is replace-all, so original ids are safe to keep and
// the cross-table references survive the round-trip). Forward rule: parse must
// tolerate missing fields by defaulting, never throw on well-formed older backups.

import type { Activity, Bid, Client, Contract, Site } from './models';
import { isActivityKind, isStage } from './models';

export const BACKUP_FORMAT = 'dayporter-backup';
export const BACKUP_VERSION = 1;

export interface BackupV1 {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAtMs: number;
  clients: Client[];
  sites: Site[];
  contracts: Contract[];
  activities: Activity[];
  bids: Bid[];
}

export function serializeBackup(
  clients: Client[],
  sites: Site[],
  contracts: Contract[],
  activities: Activity[],
  bids: Bid[],
  nowMs: number,
): string {
  const b: BackupV1 = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAtMs: nowMs,
    clients,
    sites,
    contracts,
    activities,
    bids,
  };
  return JSON.stringify(b, null, 1);
}

const num = (v: unknown, d: number): number => (typeof v === 'number' ? v : d);
const str = (v: unknown, d: string): string => (typeof v === 'string' ? v : d);
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);

/** Returns a validated backup or throws Error with a human-readable reason. */
export function parseBackup(json: string): BackupV1 {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Not a valid backup file (not JSON).');
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Not a valid backup file.');
  }
  const o = raw as Record<string, unknown>;
  if (o.format !== BACKUP_FORMAT) {
    throw new Error('Not a DayPorter backup file.');
  }
  if (typeof o.version !== 'number' || o.version > BACKUP_VERSION) {
    throw new Error('Backup was made by a newer version of DayPorter.');
  }

  const clients: Client[] = [];
  for (const r of Array.isArray(o.clients) ? o.clients : []) {
    if (typeof r !== 'object' || r === null) continue;
    const c = r as Record<string, unknown>;
    if (typeof c.id !== 'number' || typeof c.createdMs !== 'number') continue;
    clients.push({
      id: c.id,
      name: str(c.name, ''),
      contactName: str(c.contactName, ''),
      phone: str(c.phone, ''),
      email: str(c.email, ''),
      stage: isStage(c.stage) ? c.stage : 'lead',
      notes: str(c.notes, ''),
      createdMs: c.createdMs,
    });
  }
  const clientIds = new Set(clients.map((c) => c.id!));

  const sites: Site[] = [];
  for (const r of Array.isArray(o.sites) ? o.sites : []) {
    if (typeof r !== 'object' || r === null) continue;
    const s = r as Record<string, unknown>;
    if (typeof s.id !== 'number' || !clientIds.has(s.clientId as number)) continue;
    sites.push({
      id: s.id,
      clientId: s.clientId as number,
      label: str(s.label, ''),
      address: str(s.address, ''),
      sqft: num(s.sqft, 0),
      notes: str(s.notes, ''),
    });
  }
  const siteIds = new Set(sites.map((s) => s.id!));

  const contracts: Contract[] = [];
  for (const r of Array.isArray(o.contracts) ? o.contracts : []) {
    if (typeof r !== 'object' || r === null) continue;
    const c = r as Record<string, unknown>;
    if (typeof c.id !== 'number' || !siteIds.has(c.siteId as number)) continue;
    contracts.push({
      id: c.id,
      siteId: c.siteId as number,
      visitsPerWeek: num(c.visitsPerWeek, 1),
      ratePeriod: c.ratePeriod === 'visit' ? 'visit' : 'monthly',
      rateCents: num(c.rateCents, 0),
      scope: str(c.scope, ''),
      active: bool(c.active, true),
      startMs: num(c.startMs, 0),
    });
  }

  const activities: Activity[] = [];
  for (const r of Array.isArray(o.activities) ? o.activities : []) {
    if (typeof r !== 'object' || r === null) continue;
    const a = r as Record<string, unknown>;
    if (typeof a.id !== 'number' || !clientIds.has(a.clientId as number)) continue;
    if (typeof a.whenMs !== 'number') continue;
    activities.push({
      id: a.id,
      clientId: a.clientId as number,
      kind: isActivityKind(a.kind) ? a.kind : 'note',
      body: str(a.body, ''),
      whenMs: a.whenMs,
      followUpMs: typeof a.followUpMs === 'number' ? a.followUpMs : null,
      done: bool(a.done, false),
    });
  }

  const bids: Bid[] = [];
  for (const r of Array.isArray(o.bids) ? o.bids : []) {
    if (typeof r !== 'object' || r === null) continue;
    const b = r as Record<string, unknown>;
    if (typeof b.id !== 'number' || !clientIds.has(b.clientId as number)) continue;
    bids.push({
      id: b.id,
      clientId: b.clientId as number,
      siteId:
        typeof b.siteId === 'number' && siteIds.has(b.siteId) ? b.siteId : null,
      sqft: num(b.sqft, 0),
      visitsPerWeek: num(b.visitsPerWeek, 0),
      prodRateSqftHr: num(b.prodRateSqftHr, 0),
      laborRateCents: num(b.laborRateCents, 0),
      suppliesPct: num(b.suppliesPct, 0),
      marginPct: num(b.marginPct, 0),
      priceCents: num(b.priceCents, 0),
      createdMs: num(b.createdMs, 0),
    });
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAtMs: num(o.exportedAtMs, 0),
    clients,
    sites,
    contracts,
    activities,
    bids,
  };
}

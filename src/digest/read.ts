import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestNight, DigestRow, JobStatus, ReadNight, StatusCounts } from './types.js';

type RunLine = {
  at: string;
  atMs: number;
  job: string;
  status: JobStatus;
  owner: string | null;
  error: string | null;
};

type JobTotals = {
  row: DigestRow;
  firstAtMs: number;
  lastAtMs: number;
  // When the row's owner was recorded, so a line without one never erases it.
  ownerAtMs: number;
};

// Only YYYY-MM-DD names a night, so no other string reaches the file system.
const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

export const NIGHT_FILE = /^(\d{4}-\d{2}-\d{2})\.jsonl$/;

// The run log writes a full offset on every line, and the styleguide keeps that offset.
const AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function isNight(night: string): boolean {
  return NIGHT.test(night);
}

function isStatus(value: unknown): value is JobStatus {
  return value === 'ok' || value === 'retry' || value === 'fail';
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function parseLine(line: string): RunLine | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const fields = value as Record<string, unknown>;
  const at = fields.at;
  const job = fields.job;
  const status = fields.status;
  const owner = fields.owner;
  const error = fields.error;

  if (typeof at !== 'string' || !AT.test(at)) return null;
  const atMs = Date.parse(at);
  if (Number.isNaN(atMs)) return null;
  if (typeof job !== 'string' || job === '') return null;
  if (!isStatus(status)) return null;
  if (owner !== undefined && owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && error !== null && typeof error !== 'string') return null;

  return { at, atMs, job, status, owner: text(owner), error: text(error) };
}

// A night that cannot be read reads as a night with no file, as lastBeat and nightsOnDisk do.
function readNightFile(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

export const readNight: ReadNight = (runsDir: string, night: string): DigestNight => {
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  if (!isNight(night)) return { night, exists: false, rows: [], unparsed: 0, counts };
  const body = readNightFile(join(runsDir, `${night}.jsonl`));
  if (body === null) return { night, exists: false, rows: [], unparsed: 0, counts };

  const totals = new Map<string, JobTotals>();
  let unparsed = 0;

  for (const raw of body.split('\n')) {
    const trimmed = raw.trim();
    if (trimmed === '') continue;
    const line = parseLine(trimmed);
    if (line === null) {
      unparsed += 1;
      continue;
    }
    counts[line.status] += 1;
    const found = totals.get(line.job);
    if (found === undefined) {
      totals.set(line.job, {
        row: {
          job: line.job,
          owner: line.owner,
          runs: 1,
          retries: line.status === 'retry' ? 1 : 0,
          fails: line.status === 'fail' ? 1 : 0,
          lastStatus: line.status,
          lastError: line.error,
          firstAt: line.at,
          lastAt: line.at,
          marked: false,
        },
        firstAtMs: line.atMs,
        lastAtMs: line.atMs,
        ownerAtMs: line.owner === null ? Number.NEGATIVE_INFINITY : line.atMs,
      });
      continue;
    }
    found.row.runs += 1;
    if (line.status === 'retry') found.row.retries += 1;
    if (line.status === 'fail') found.row.fails += 1;
    if (line.atMs < found.firstAtMs) {
      found.firstAtMs = line.atMs;
      found.row.firstAt = line.at;
    }
    if (line.atMs >= found.lastAtMs) {
      found.lastAtMs = line.atMs;
      found.row.lastAt = line.at;
      found.row.lastStatus = line.status;
      found.row.lastError = line.error;
    }
    if (line.owner !== null && line.atMs >= found.ownerAtMs) {
      found.ownerAtMs = line.atMs;
      found.row.owner = line.owner;
    }
  }

  const rows = [...totals.values()]
    .map((job) => job.row)
    .sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  for (const row of rows) row.marked = row.retries >= 3 || row.fails > 0;

  return { night, exists: true, rows, unparsed, counts };
};

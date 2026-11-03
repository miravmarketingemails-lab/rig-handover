import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestNight, DigestRow, JobStatus, ReadNight, StatusCounts } from './types.js';

type RunLine = {
  at: string;
  job: string;
  status: JobStatus;
  owner: string | null;
  error: string | null;
};

type JobTotals = {
  row: DigestRow;
  firstAtMs: number;
  lastAtMs: number;
};

function isStatus(value: unknown): value is JobStatus {
  return value === 'ok' || value === 'retry' || value === 'fail';
}

function parseLine(text: string): RunLine | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const line = value as Record<string, unknown>;
  const at = line.at;
  const job = line.job;
  const status = line.status;
  const owner = line.owner;
  const error = line.error;

  if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) return null;
  if (typeof job !== 'string' || job === '') return null;
  if (!isStatus(status)) return null;
  if (owner !== undefined && owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && error !== null && typeof error !== 'string') return null;

  return {
    at,
    job,
    status,
    owner: typeof owner === 'string' ? owner : null,
    error: typeof error === 'string' ? error : null,
  };
}

function readText(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return null;
    throw err;
  }
}

export const readNight: ReadNight = (runsDir: string, night: string): DigestNight => {
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  const text = readText(join(runsDir, `${night}.jsonl`));
  if (text === null) return { night, exists: false, rows: [], unparsed: 0, counts };

  const totals = new Map<string, JobTotals>();
  let unparsed = 0;

  for (const raw of text.split('\n')) {
    const trimmed = raw.trim();
    if (trimmed === '') continue;
    const line = parseLine(trimmed);
    if (line === null) {
      unparsed += 1;
      continue;
    }
    const at = Date.parse(line.at);
    const found = totals.get(line.job);
    if (found === undefined) {
      totals.set(line.job, {
        row: {
          job: line.job,
          owner: line.owner,
          runs: 1,
          retries: line.status === 'retry' ? 1 : 0,
          lastStatus: line.status,
          lastError: line.error,
          firstAt: line.at,
          lastAt: line.at,
        },
        firstAtMs: at,
        lastAtMs: at,
      });
      continue;
    }
    found.row.runs += 1;
    if (line.status === 'retry') found.row.retries += 1;
    if (at < found.firstAtMs) {
      found.firstAtMs = at;
      found.row.firstAt = line.at;
    }
    if (at >= found.lastAtMs) {
      found.lastAtMs = at;
      found.row.lastAt = line.at;
      found.row.lastStatus = line.status;
      found.row.lastError = line.error;
      found.row.owner = line.owner;
    }
  }

  const rows = [...totals.values()]
    .map((job) => job.row)
    .sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  for (const row of rows) counts[row.lastStatus] += 1;

  return { night, exists: true, rows, unparsed, counts };
};

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';
import type { DigestRow } from '../src/digest/types.js';

const runsDir = 'runs';

function tempRunsDir(): string {
  return mkdtempSync(join(tmpdir(), 'rig-digest-'));
}

function row(job: string): DigestRow {
  const found = readNight(runsDir, '2026-10-28').rows.find((r) => r.job === job);
  if (found === undefined) throw new Error(`no row for ${job}`);
  return found;
}

describe('readNight on 2026-10-28', () => {
  it('reads 5 jobs and counts 1 bad line', () => {
    const night = readNight(runsDir, '2026-10-28');
    expect(night.exists).toBe(true);
    expect(night.rows).toHaveLength(5);
    expect(night.unparsed).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts the night from each job last status', () => {
    expect(readNight(runsDir, '2026-10-28').counts).toEqual({ ok: 4, retry: 0, fail: 1 });
  });

  it('keeps owner null on digest/render', () => {
    expect(row('digest/render').owner).toBeNull();
  });

  it('reads fixtures/refresh as 4 runs, 3 retries, last status ok', () => {
    expect(row('fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('reads notes/backup as a fail with its error', () => {
    expect(row('notes/backup').lastStatus).toBe('fail');
    expect(row('notes/backup').lastError).toBe('quota exceeded');
  });

  it('counts retries of lane/sync and keeps the offset on both times', () => {
    expect(row('lane/sync').runs).toBe(8);
    expect(row('lane/sync').retries).toBe(1);
    expect(row('lane/sync').firstAt).toBe('2026-10-28T23:00:06+01:00');
    expect(row('lane/sync').lastAt).toBe('2026-10-29T05:00:04+01:00');
  });
});

describe('readNight on 2026-10-27', () => {
  it('reports no bad line on a clean night', () => {
    const night = readNight(runsDir, '2026-10-27');
    expect(night.exists).toBe(true);
    expect(night.unparsed).toBe(0);
    expect(night.rows).toHaveLength(4);
    expect(night.counts).toEqual({ ok: 4, retry: 0, fail: 0 });
  });
});

describe('readNight on a temp runs dir', () => {
  it('reports exists false when the night has no file', () => {
    expect(readNight(tempRunsDir(), '2026-10-26')).toEqual({
      night: '2026-10-26',
      exists: false,
      rows: [],
      unparsed: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('reads an empty night as a night with no rows', () => {
    const dir = tempRunsDir();
    writeFileSync(join(dir, '2026-10-26.jsonl'), '');
    expect(readNight(dir, '2026-10-26')).toEqual({
      night: '2026-10-26',
      exists: true,
      rows: [],
      unparsed: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('takes the last status from the latest time, not the last line', () => {
    const dir = tempRunsDir();
    writeFileSync(
      join(dir, '2026-10-26.jsonl'),
      [
        '{"at":"2026-10-27T02:00:00+01:00","job":"a/b","status":"ok","owner":"rook"}',
        '{"at":"2026-10-27T01:00:00+01:00","job":"a/b","status":"fail","owner":"rook","error":"late write"}',
        '',
      ].join('\r\n'),
    );
    const night = readNight(dir, '2026-10-26');
    expect(night.unparsed).toBe(0);
    expect(night.rows[0].lastStatus).toBe('ok');
    expect(night.rows[0].lastError).toBeNull();
    expect(night.rows[0].firstAt).toBe('2026-10-27T01:00:00+01:00');
    expect(night.rows[0].lastAt).toBe('2026-10-27T02:00:00+01:00');
  });

  it('counts a bad status, a missing job and a broken line as unparsed', () => {
    const dir = tempRunsDir();
    writeFileSync(
      join(dir, '2026-10-26.jsonl'),
      [
        '{"at":"2026-10-27T01:00:00+01:00","job":"a/b","status":"skipped","owner":"rook"}',
        '{"at":"2026-10-27T01:00:00+01:00","status":"ok","owner":"rook"}',
        '{"at":"2026-10-27T01:00:00+01:00","job":"a/b","stat',
        '{"at":"2026-10-27T01:00:00+01:00","job":"a/b","status":"ok","owner":"rook"}',
        '',
      ].join('\r\n'),
    );
    const night = readNight(dir, '2026-10-26');
    expect(night.unparsed).toBe(3);
    expect(night.rows).toHaveLength(1);
    expect(night.counts).toEqual({ ok: 1, retry: 0, fail: 0 });
  });
});

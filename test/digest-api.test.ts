import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/read.js';

const base = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60 };

describe('GET /api/digest/:night', () => {
  it('returns the same jobs in the same order as readNight', async () => {
    const res = await createApp({ ...base, runsDir: 'runs' }).request('/api/digest/2026-10-28');
    const body = await res.json();
    const expected = readNight('runs', '2026-10-28');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(body.rows).toEqual(expected.rows);
    expect(body.rows.map((r: { job: string }) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(body.night).toBe('2026-10-28');
    expect(body.unparsed).toBe(1);
    expect(body.counts).toEqual({ ok: 4, retry: 0, fail: 1 });
  });

  it('answers 404 with a JSON body when the night has no file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-api-'));
    const res = await createApp({ ...base, runsDir: dir }).request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ error: 'not_found', night: '2026-01-01' });
  });

  it('answers 200 with empty rows for an empty night', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-api-'));
    writeFileSync(join(dir, '2026-01-02.jsonl'), '');
    const res = await createApp({ ...base, runsDir: dir }).request('/api/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      night: '2026-01-02',
      rows: [],
      unparsed: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });
});

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/read.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

const made: string[] = [];

function tempRuns(files: Record<string, string>, dirs: string[] = []): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  made.push(dir);
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  for (const name of dirs) mkdirSync(join(dir, name));
  return dir;
}

function tempConfig(files: Record<string, string>, dirs: string[] = []) {
  return { ...config, runsDir: tempRuns(files, dirs) };
}

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function jobsIn(html: string): string[] {
  return [...html.matchAll(/<td>([a-z]+\/[a-z-]+)<\/td>/g)].map((m) => m[1]);
}

describe('readNight on the real nights', () => {
  it('reads 2026-10-28 as 5 jobs and one bad line', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night.exists).toBe(true);
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night.unparsed).toBe(1);
  });

  it('counts the night by line, so a retry that later succeeded still counts', () => {
    expect(readNight('runs', '2026-10-28').counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('keeps the owner null that the log wrote on digest/render', () => {
    const row = readNight('runs', '2026-10-28').rows.find((r) => r.job === 'digest/render');
    expect(row?.owner).toBeNull();
  });

  it('reads fixtures/refresh as 4 runs, 3 retries and a last status of ok', () => {
    const row = readNight('runs', '2026-10-28').rows.find((r) => r.job === 'fixtures/refresh');
    expect(row).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: null, owner: 'rook' });
  });

  it('reads notes/backup as a fail with its error', () => {
    const row = readNight('runs', '2026-10-28').rows.find((r) => r.job === 'notes/backup');
    expect(row).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded', retries: 0 });
  });

  it('keeps the offset the log wrote on the first and the last time', () => {
    const row = readNight('runs', '2026-10-28').rows.find((r) => r.job === 'lane/sync');
    expect(row).toMatchObject({
      runs: 8,
      retries: 1,
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
  });

  it('reports no bad line on the clean night 2026-10-27', () => {
    const night = readNight('runs', '2026-10-27');
    expect(night.unparsed).toBe(0);
    expect(night.rows).toHaveLength(4);
    expect(night.counts).toEqual({ ok: 7, retry: 0, fail: 0 });
  });
});

describe('readNight on a temporary runs dir', () => {
  it('reports exists false when the night has no file', () => {
    expect(readNight(tempRuns({}), '2026-01-01').exists).toBe(false);
  });

  it('reads an empty file as a night that exists with no rows', () => {
    const night = readNight(tempRuns({ '2026-01-01.jsonl': '' }), '2026-01-01');
    expect(night).toMatchObject({ exists: true, rows: [], unparsed: 0 });
  });

  it('takes the last status from the latest time, not the last line in the file', () => {
    const dir = tempRuns({
      '2026-01-01.jsonl': [
        '{"at":"2026-01-01T03:00:00+01:00","job":"a","status":"fail","owner":"rook","error":"late"}',
        '{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"ok","owner":"rook"}',
        '',
      ].join('\r\n'),
    });
    const row = readNight(dir, '2026-01-01').rows[0];
    expect(row).toMatchObject({ lastStatus: 'fail', lastError: 'late', firstAt: '2026-01-01T01:00:00+01:00' });
  });

  it('keeps an owner that an earlier line recorded when the latest line omits it', () => {
    const dir = tempRuns({
      '2026-01-01.jsonl': [
        '{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"ok","owner":"rook"}',
        '{"at":"2026-01-01T02:00:00+01:00","job":"a","status":"ok"}',
      ].join('\n'),
    });
    expect(readNight(dir, '2026-01-01').rows[0]?.owner).toBe('rook');
  });

  it('counts a bad status, a missing job and a broken line as unparsed', () => {
    const dir = tempRuns({
      '2026-01-01.jsonl': [
        '{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"maybe"}',
        '{"at":"2026-01-01T01:00:00+01:00","status":"ok"}',
        '{"at":"2026-01-01T01:00:00+01:00","job":"a"',
      ].join('\n'),
    });
    const night = readNight(dir, '2026-01-01');
    expect(night).toMatchObject({ exists: true, rows: [], unparsed: 3 });
  });
});

describe('a night name that is not a date', () => {
  it('does not reach a real file outside runsDir', () => {
    expect(readNight('runs', '../runs/2026-10-28').exists).toBe(false);
    expect(readNight('runs', '2026-10-28').exists).toBe(true);
  });

  it('reads a name that is not YYYY-MM-DD as a night with no file', () => {
    expect(readNight('runs', 'garbage').exists).toBe(false);
    expect(readNight('runs', '2026-10-2').exists).toBe(false);
  });

  it('answers 404 on both routes', async () => {
    const app = createApp(config);
    expect((await app.request('/digest/..%2Fruns%2F2026-10-28')).status).toBe(404);
    expect((await app.request('/api/digest/..%2Fruns%2F2026-10-28')).status).toBe(404);
  });
});

describe('GET /digest/:night', () => {
  it('renders the real night with the lane banner and a table', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp(config).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('<table>');
  });

  it('marks a fail row and a row with three retries, keeps the offset and shows a dash', async () => {
    const html = await (await createApp(config).request('/digest/2026-10-28')).text();
    expect(html).toMatch(/<tr class="warn"><td>notes\/backup<\/td>/);
    expect(html).toMatch(/<tr class="warn"><td>fixtures\/refresh<\/td>/);
    expect(html).toMatch(/<tr><td>rig\/rotate-logs<\/td>/);
    expect(html).toContain('2026-10-29T04:00:01+01:00');
    expect(html).toContain('<td>—</td>');
  });

  it('answers 404 for a night with no file', async () => {
    const res = await createApp(tempConfig({})).request('/digest/2026-01-01');
    expect(res.status).toBe(404);
  });

  it('renders nothing ran for an empty night', async () => {
    const cfg = tempConfig({ '2026-01-01.jsonl': '' });
    const html = await (await createApp(cfg).request('/digest/2026-01-01')).text();
    expect(html).toContain('nothing ran');
  });

  it('says no line parsed when every line of the night is broken', async () => {
    const cfg = tempConfig({ '2026-01-01.jsonl': 'nonsense\nalso nonsense\n' });
    const html = await (await createApp(cfg).request('/digest/2026-01-01')).text();
    expect(html).toContain('no line in this night parsed');
    expect(html).not.toContain('nothing ran');
    expect(html).toContain('2 lines did not parse');
  });

  it('still renders the jobs of a night that holds one bad line', async () => {
    const cfg = tempConfig({
      '2026-01-01.jsonl': '{"at":"2026-01-01T01:00:00+01:00","job":"a/b","status":"ok","owner":"rook"}\nbroken\n',
    });
    const html = await (await createApp(cfg).request('/digest/2026-01-01')).text();
    expect(html).toContain('<td>a/b</td>');
    expect(html).toContain('1 line did not parse');
  });
});

describe('GET /api/digest/:night', () => {
  it('lists the same jobs in the same order as the page', async () => {
    const app = createApp(config);
    const page = await (await app.request('/digest/2026-10-28')).text();
    const body = (await (await app.request('/api/digest/2026-10-28')).json()) as { rows: { job: string }[] };
    expect(body.rows.map((r) => r.job)).toEqual(jobsIn(page));
  });

  it('reports the night, the unparsed count and the counts', async () => {
    const res = await createApp(config).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toMatchObject({
      night: '2026-10-28',
      unparsed: 1,
      counts: { ok: 10, retry: 4, fail: 1 },
    });
  });

  it('answers 404 with a JSON body for a night with no file', async () => {
    const res = await createApp(tempConfig({})).request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found', night: '2026-01-01' });
  });

  it('answers 200 with no rows for an empty night', async () => {
    const cfg = tempConfig({ '2026-01-01.jsonl': '' });
    const res = await createApp(cfg).request('/api/digest/2026-01-01');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ rows: [], unparsed: 0 });
  });
});

describe('the status board', () => {
  it('links each night to its digest and shows that night counts beside it', async () => {
    const html = await (await createApp(config).request('/')).text();
    expect(html).toMatch(/2026-10-28<\/a> ok 10 · retry 4 · fail 1/);
    expect(html).toMatch(/2026-10-27<\/a> ok 7 · retry 0 · fail 0/);
  });

  it('links a digest that renders', async () => {
    const app = createApp(config);
    const html = await (await app.request('/')).text();
    for (const night of ['2026-10-28', '2026-10-27']) {
      expect(html).toContain(`href="/digest/${night}"`);
      expect((await app.request(`/digest/${night}`)).status).toBe(200);
    }
  });

  it('still lists a night it cannot read, with a dash for its counts', async () => {
    const cfg = tempConfig({ '2026-01-01.jsonl': '' }, ['2026-01-02.jsonl']);
    const res = await createApp(cfg).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toMatch(/2026-01-02<\/a> —/);
    expect(html).toContain('href="/digest/2026-01-01"');
  });
});

import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/read.js';
import { config, tempConfig, tempRuns } from './temp-runs.js';

function line(at: string, job: string, status: string, rest: Record<string, string> = {}): string {
  return JSON.stringify({ at, job, status, ...rest });
}

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

  it('reads fixtures/refresh as 4 runs, 3 retries and a last status of ok, and marks it', () => {
    const row = readNight('runs', '2026-10-28').rows.find((r) => r.job === 'fixtures/refresh');
    expect(row).toMatchObject({ runs: 4, retries: 3, fails: 0, lastStatus: 'ok', lastError: null, owner: 'rook', marked: true });
  });

  it('reads notes/backup as a fail with its error, and marks it', () => {
    const row = readNight('runs', '2026-10-28').rows.find((r) => r.job === 'notes/backup');
    expect(row).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded', fails: 1, retries: 0, marked: true });
  });

  it('leaves a job that only succeeded unmarked', () => {
    const row = readNight('runs', '2026-10-28').rows.find((r) => r.job === 'rig/rotate-logs');
    expect(row).toMatchObject({ runs: 1, retries: 0, fails: 0, marked: false });
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
    expect(night.rows.every((r) => !r.marked)).toBe(true);
  });
});

describe('what readNight marks', () => {
  function rowFor(lines: string[]) {
    const dir = tempRuns({ '2026-01-01.jsonl': lines.join('\n') });
    return readNight(dir, '2026-01-01').rows[0];
  }

  it('marks a job that failed once and then passed, because the plan marks any fail', () => {
    const row = rowFor([
      line('2026-01-01T01:00:00+01:00', 'a', 'ok', { owner: 'rook' }),
      line('2026-01-01T02:00:00+01:00', 'a', 'fail', { owner: 'rook', error: 'disk full' }),
      line('2026-01-01T03:00:00+01:00', 'a', 'ok', { owner: 'rook' }),
    ]);
    expect(row).toMatchObject({ fails: 1, lastStatus: 'ok', marked: true });
  });

  it('leaves a job with two retries unmarked, because the plan marks three', () => {
    const row = rowFor([
      line('2026-01-01T01:00:00+01:00', 'a', 'retry', { owner: 'rook', error: 'busy' }),
      line('2026-01-01T02:00:00+01:00', 'a', 'retry', { owner: 'rook', error: 'busy' }),
      line('2026-01-01T03:00:00+01:00', 'a', 'ok', { owner: 'rook' }),
    ]);
    expect(row).toMatchObject({ retries: 2, fails: 0, marked: false });
  });

  it('marks a job with three retries that then passed', () => {
    const row = rowFor([
      line('2026-01-01T01:00:00+01:00', 'a', 'retry', { owner: 'rook', error: 'busy' }),
      line('2026-01-01T02:00:00+01:00', 'a', 'retry', { owner: 'rook', error: 'busy' }),
      line('2026-01-01T03:00:00+01:00', 'a', 'retry', { owner: 'rook', error: 'busy' }),
      line('2026-01-01T04:00:00+01:00', 'a', 'ok', { owner: 'rook' }),
    ]);
    expect(row).toMatchObject({ retries: 3, marked: true });
  });
});

describe('readNight on a temporary runs dir', () => {
  it('reports exists false when the night has no file', () => {
    expect(readNight(tempRuns({}), '2026-01-01').exists).toBe(false);
  });

  it('reports exists false when the night cannot be read', () => {
    expect(readNight(tempRuns({}, ['2026-01-01.jsonl']), '2026-01-01').exists).toBe(false);
  });

  it('reads an empty file as a night that exists with no rows', () => {
    const night = readNight(tempRuns({ '2026-01-01.jsonl': '' }), '2026-01-01');
    expect(night).toMatchObject({ exists: true, rows: [], unparsed: 0 });
  });

  it('takes the last status from the latest time, not the last line in the file', () => {
    const dir = tempRuns({
      '2026-01-01.jsonl': [
        line('2026-01-01T03:00:00+01:00', 'a', 'fail', { owner: 'rook', error: 'late' }),
        line('2026-01-01T01:00:00+01:00', 'a', 'ok', { owner: 'rook' }),
        '',
      ].join('\r\n'),
    });
    const row = readNight(dir, '2026-01-01').rows[0];
    expect(row).toMatchObject({ lastStatus: 'fail', lastError: 'late', firstAt: '2026-01-01T01:00:00+01:00' });
  });

  it('keeps an owner an earlier line recorded when the latest line omits it', () => {
    const dir = tempRuns({
      '2026-01-01.jsonl': [
        line('2026-01-01T01:00:00+01:00', 'a', 'ok', { owner: 'rook' }),
        line('2026-01-01T02:00:00+01:00', 'a', 'ok'),
      ].join('\n'),
    });
    expect(readNight(dir, '2026-01-01').rows[0]?.owner).toBe('rook');
  });

  it('keeps an owner from a line that is later in time but earlier in the file', () => {
    const dir = tempRuns({
      '2026-01-01.jsonl': [
        line('2026-01-01T02:00:00+01:00', 'a', 'ok', { owner: 'rook' }),
        line('2026-01-01T01:00:00+01:00', 'a', 'ok', { owner: 'someone-else' }),
      ].join('\n'),
    });
    expect(readNight(dir, '2026-01-01').rows[0]?.owner).toBe('rook');
  });

  it('reads an empty owner and an empty error as missing, not as an empty string', () => {
    const dir = tempRuns({
      '2026-01-01.jsonl': line('2026-01-01T01:00:00+01:00', 'a', 'fail', { owner: '', error: '' }),
    });
    expect(readNight(dir, '2026-01-01').rows[0]).toMatchObject({ owner: null, lastError: null });
  });

  it('counts a bad status, a missing job, a loose time and a broken line as unparsed', () => {
    const dir = tempRuns({
      '2026-01-01.jsonl': [
        line('2026-01-01T01:00:00+01:00', 'a', 'maybe'),
        '{"at":"2026-01-01T01:00:00+01:00","status":"ok"}',
        '{"at":"1","job":"a","status":"ok"}',
        '{"at":"2026-01-01","job":"a","status":"ok"}',
        '{"at":"2026-01-01T01:00:00+01:00","job":"a"',
      ].join('\n'),
    });
    const night = readNight(dir, '2026-01-01');
    expect(night).toMatchObject({ exists: true, rows: [], unparsed: 5 });
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

  it('marks the rows the reader marked, keeps the offset and shows a dash', async () => {
    const html = await (await createApp(config).request('/digest/2026-10-28')).text();
    expect(html).toMatch(/<tr class="warn"><td>notes\/backup<\/td>/);
    expect(html).toMatch(/<tr class="warn"><td>fixtures\/refresh<\/td>/);
    expect(html).toMatch(/<tr><td>rig\/rotate-logs<\/td>/);
    expect(html).toContain('2026-10-29T04:00:01+01:00');
    expect(html).toContain('<td>—</td>');
    expect(html).not.toContain('<td></td>');
  });

  it('answers 404 for a night with no file', async () => {
    expect((await createApp(tempConfig({})).request('/digest/2026-01-01')).status).toBe(404);
  });

  it('answers 404 for a night it cannot read', async () => {
    const cfg = tempConfig({}, ['2026-01-01.jsonl']);
    expect((await createApp(cfg).request('/digest/2026-01-01')).status).toBe(404);
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
      '2026-01-01.jsonl': `${line('2026-01-01T01:00:00+01:00', 'a/b', 'ok', { owner: 'rook' })}\nbroken\n`,
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

  it('hands an agent the same mark the page shows', async () => {
    const res = await createApp(config).request('/api/digest/2026-10-28');
    const body = (await res.json()) as { rows: { job: string; marked: boolean }[] };
    expect(body.rows.filter((r) => r.marked).map((r) => r.job)).toEqual(['fixtures/refresh', 'notes/backup']);
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

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const base = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60 };

const dirs: string[] = [];

function tempRuns(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
  dirs.push(dir);
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const good = '{"at":"2026-01-05T01:00:00+01:00","job":"a","status":"ok","owner":"rook"}\n';

describe('digest page route', () => {
  it('answers 200 html for the real night', async () => {
    const res = await createApp({ ...base, runsDir: 'runs' }).request('/digest/2026-10-28');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('<table>');
  });

  it('answers 404 for a night with no file', async () => {
    const app = createApp({ ...base, runsDir: tempRuns({}) });
    const res = await app.request('/digest/2026-01-01');
    expect(res.status).toBe(404);
  });

  it('renders nothing ran for an empty night', async () => {
    const app = createApp({ ...base, runsDir: tempRuns({ '2026-01-02.jsonl': '' }) });
    const res = await app.request('/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('renders the jobs and the unparsed note for a night with a bad line', async () => {
    const app = createApp({ ...base, runsDir: tempRuns({ '2026-01-05.jsonl': `${good}garbage\n` }) });
    const res = await app.request('/digest/2026-01-05');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<table>');
    expect(html).toContain('1 line did not parse');
  });
});

describe('digest json route', () => {
  it('answers 200 json for the real night', async () => {
    const res = await createApp({ ...base, runsDir: 'runs' }).request('/api/digest/2026-10-28');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(body.night).toBe('2026-10-28');
    expect(body.rows.length).toBeGreaterThan(0);
  });

  it('answers 404 json for a night with no file', async () => {
    const app = createApp({ ...base, runsDir: tempRuns({}) });
    const res = await app.request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ error: 'not_found', night: '2026-01-01' });
  });

  it('answers 200 with an empty rows array for an empty night', async () => {
    const app = createApp({ ...base, runsDir: tempRuns({ '2026-01-02.jsonl': '' }) });
    const res = await app.request('/api/digest/2026-01-02');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.rows).toEqual([]);
    expect(body.unparsed).toBe(0);
  });

  it('keeps the parsed jobs and reports the unparsed count', async () => {
    const app = createApp({ ...base, runsDir: tempRuns({ '2026-01-05.jsonl': `${good}garbage\n` }) });
    const res = await app.request('/api/digest/2026-01-05');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].job).toBe('a');
    expect(body.unparsed).toBe(1);
  });
});

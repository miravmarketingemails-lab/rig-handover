import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const base = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60 };

describe('digest page', () => {
  it('renders 2026-10-28 with the banner and a table', async () => {
    const res = await createApp({ ...base, runsDir: 'runs' }).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<table>');
    expect(html).toContain('lane-07');
  });

  it('answers 404 for a night with no file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-'));
    const res = await createApp({ ...base, runsDir: dir }).request('/digest/2026-01-01');
    expect(res.status).toBe(404);
  });

  it('renders nothing ran for an empty file and counts unparsed lines', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-'));
    writeFileSync(join(dir, '2026-01-02.jsonl'), '');
    writeFileSync(join(dir, '2026-01-03.jsonl'), 'garbage\n');
    const app = createApp({ ...base, runsDir: dir });
    const empty = await (await app.request('/digest/2026-01-02')).text();
    expect(empty).toContain('nothing ran');
    expect(empty).not.toContain('<table>');
    const bad = await (await app.request('/digest/2026-01-03')).text();
    expect(bad).toContain('nothing ran');
    expect(bad).toContain('1 line did not parse');
  });

  it('marks warn rows, keeps offsets and shows dashes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-'));
    const lines = [
      { at: '2026-01-04T01:00:00+01:00', job: 'a', status: 'ok' },
      { at: '2026-01-04T02:00:00+01:00', job: 'b', status: 'fail', error: 'boom' },
    ];
    writeFileSync(join(dir, '2026-01-04.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n'));
    const html = await (await createApp({ ...base, runsDir: dir }).request('/digest/2026-01-04')).text();
    expect(html).toContain('2026-01-04T01:00:00+01:00');
    expect(html).toContain('<td>—</td>');
    expect(html).toMatch(/<tr class="warn"><td>b<\/td>/);
    expect(html).toMatch(/<tr><td>a<\/td>/);
  });
});

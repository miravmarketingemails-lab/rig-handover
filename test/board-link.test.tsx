import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const base = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60 };

describe('board links', () => {
  it('links each real night to its digest with its counts', async () => {
    const html = await (await createApp({ ...base, runsDir: 'runs' }).request('/')).text();
    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toContain('href="/digest/2026-10-27"');
    expect(html).toContain('ok 4 · retry 0 · fail 1');
    expect(html).toContain('ok 4 · retry 0 · fail 0');
  });

  it('counts the last status per job, not lines', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-'));
    const line = (job: string, status: string, at: string) => JSON.stringify({ at, job, status });
    writeFileSync(
      join(dir, '2026-01-02.jsonl'),
      [line('a', 'retry', '2026-01-02T01:00:00Z'), line('a', 'ok', '2026-01-02T01:05:00Z'), line('b', 'fail', '2026-01-02T01:00:00Z')].join('\n'),
    );
    const html = await (await createApp({ ...base, runsDir: dir }).request('/')).text();
    expect(html).toContain('ok 1 · retry 0 · fail 1');
  });
});

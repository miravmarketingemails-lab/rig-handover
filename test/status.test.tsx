import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { config, tempConfig } from './temp-runs.js';

describe('status board', () => {
  it('shows the lane banner and the nights on disk', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('2026-10-28');
  });

  it('health answers with the lane id', async () => {
    const res = await createApp(config).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });

  it('links each night to its digest and shows that night lines beside it', async () => {
    const html = await (await createApp(config).request('/')).text();
    expect(html).toMatch(/2026-10-28<\/a> lines ok 10 · retry 4 · fail 1/);
    expect(html).toMatch(/2026-10-27<\/a> lines ok 7 · retry 0 · fail 0/);
  });

  it('links a digest that renders', async () => {
    const app = createApp(config);
    const html = await (await app.request('/')).text();
    for (const night of ['2026-10-28', '2026-10-27']) {
      expect(html).toContain(`href="/digest/${night}"`);
      expect((await app.request(`/digest/${night}`)).status).toBe(200);
    }
  });

  it('still lists a night it cannot read, with a dash, and its digest answers 404', async () => {
    const cfg = tempConfig({ '2026-01-01.jsonl': '' }, ['2026-01-02.jsonl']);
    const app = createApp(cfg);
    const res = await app.request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('href="/digest/2026-01-01"');
    expect(html).toMatch(/2026-01-02<\/a> —/);
    expect((await app.request('/digest/2026-01-02')).status).toBe(404);
  });
});

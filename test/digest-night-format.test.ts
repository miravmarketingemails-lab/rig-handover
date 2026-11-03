import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/read.js';

const config = { adapter: 'shim', installed: 'x', beatEverySeconds: 60, runsDir: 'runs' };

describe('night format', () => {
  it('reads a night that leaves runsDir as a night with no file', () => {
    const night = readNight('runs', '../../pnpm-workspace');
    expect(night.exists).toBe(false);
    expect(night.rows).toEqual([]);
  });

  it('reads a night that is not a date as a night with no file', () => {
    expect(readNight('runs', 'garbage').exists).toBe(false);
    expect(readNight('runs', '2026-10-2').exists).toBe(false);
  });

  it('still reads a real night', () => {
    expect(readNight('runs', '2026-10-28').exists).toBe(true);
  });

  it('answers 404 on both routes for a night that leaves runsDir', async () => {
    const app = createApp(config);
    expect((await app.request('/digest/..%2F..%2Fpnpm-workspace')).status).toBe(404);
    expect((await app.request('/api/digest/..%2F..%2Fpnpm-workspace')).status).toBe(404);
  });
});

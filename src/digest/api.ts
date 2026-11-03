import { Hono } from 'hono';
import type { RigConfig } from '../config.js';
import { readNight } from './read.js';

// Mounted at /api/digest. The § 2b route lands here, so § 2a and § 2b never edit one file.
export function digestApi(config: RigConfig) {
  const routes = new Hono();

  routes.get('/:night', (c) => {
    const night = c.req.param('night');
    const digest = readNight(config.runsDir, night);
    if (!digest.exists) return c.json({ error: 'not_found', night }, 404);
    return c.json({
      night: digest.night,
      rows: digest.rows,
      unparsed: digest.unparsed,
      counts: digest.counts,
    });
  });

  return routes;
}

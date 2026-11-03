import { Hono } from 'hono';
import type { RigConfig } from '../config.js';
import { lane } from '../lane.js';
import { DigestView } from '../views/digest.js';
import { Layout } from '../views/layout.js';
import { readNight } from './read.js';

// Mounted at /digest. The § 2a route lands here, so § 2a and § 2b never edit one file.
export function digestPage(config: RigConfig) {
  const routes = new Hono();

  routes.get('/:night', (c) => {
    const night = c.req.param('night');
    const digest = readNight(config.runsDir, night);
    if (!digest.exists) return c.text('no digest for that night', 404);
    return c.html(
      <Layout title={`digest ${night}`} lane={lane()}>
        <DigestView digest={digest} />
      </Layout>,
    );
  });

  return routes;
}

import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { startBeating } from './heartbeat.js';
import { lane } from './lane.js';

const config = loadConfig();
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '127.0.0.1';

startBeating(lane().id, config.beatEverySeconds);
// Plan morning-digest puts auth out of scope because rig only listens on localhost.
serve({ fetch: createApp(config).fetch, port, hostname: host }, () => {
  console.log(`rig · ${lane().id} · http://${host}:${port}`);
});

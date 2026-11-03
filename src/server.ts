import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { startBeating } from './heartbeat.js';
import { lane } from './lane.js';

const config = loadConfig();
const port = Number(process.env.PORT ?? 8787);

startBeating(lane().id, config.beatEverySeconds);
// plan.md puts auth out of scope because rig serves one lane, so it must not leave this host.
serve({ fetch: createApp(config).fetch, port, hostname: '127.0.0.1' }, () => {
  console.log(`rig · ${lane().id} · http://localhost:${port}`);
});

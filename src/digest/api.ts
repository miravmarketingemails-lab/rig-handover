import { Hono } from 'hono';
import type { RigConfig } from '../config.js';

// Mounted at /api/digest. The § 2b route lands here, so § 2a and § 2b never edit one file.
export function digestApi(config: RigConfig) {
  const routes = new Hono();
  void config;
  return routes;
}

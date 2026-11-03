import { Hono } from 'hono';
import type { RigConfig } from '../config.js';

// Mounted at /digest. The § 2a route lands here, so § 2a and § 2b never edit one file.
export function digestPage(config: RigConfig) {
  const routes = new Hono();
  void config;
  return routes;
}

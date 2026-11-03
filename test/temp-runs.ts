import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach } from 'vitest';

export const config = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: 'runs',
};

const made: string[] = [];

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// runs/ holds real nights and is read-only, so every other case gets a directory of its own.
export function tempRuns(files: Record<string, string>, dirs: string[] = []): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-night-'));
  made.push(dir);
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  for (const name of dirs) mkdirSync(join(dir, name));
  return dir;
}

export function tempConfig(files: Record<string, string>, dirs: string[] = []) {
  return { ...config, runsDir: tempRuns(files, dirs) };
}

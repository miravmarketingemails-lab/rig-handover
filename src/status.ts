import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { NIGHT_FILE, readNight } from './digest/read.js';
import type { StatusCounts } from './digest/types.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightSummary[];
};

// counts is null when the night file cannot be read, so the board still lists the night.
export type NightSummary = { night: string; counts: StatusCounts | null };

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .map((f) => NIGHT_FILE.exec(f)?.[1])
      .filter((night): night is string => night !== undefined)
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

// One unreadable night must not take the whole board down, so this swallows like nightsOnDisk.
function countsOnDisk(runsDir: string, night: string): StatusCounts | null {
  try {
    const read = readNight(runsDir, night);
    return read.exists ? read.counts : null;
  } catch {
    return null;
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((night) => ({
      night,
      counts: countsOnDisk(config.runsDir, night),
    })),
  };
}

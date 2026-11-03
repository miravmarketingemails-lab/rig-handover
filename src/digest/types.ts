export type JobStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: JobStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type StatusCounts = { ok: number; retry: number; fail: number };

export type DigestNight = {
  night: string;
  // False when runs/<night>.jsonl is absent, so the page can tell 404 from "nothing ran".
  exists: boolean;
  rows: DigestRow[];
  unparsed: number;
  counts: StatusCounts;
};

export type ReadNight = (runsDir: string, night: string) => DigestNight;

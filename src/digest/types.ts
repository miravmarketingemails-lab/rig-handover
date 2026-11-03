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

// The night's lines by status, so a retry that later succeeded still counts as a retry.
export type StatusCounts = { ok: number; retry: number; fail: number };

export type DigestNight = {
  night: string;
  // False when runs/<night>.jsonl is absent, so the page can tell 404 from "nothing ran".
  exists: boolean;
  rows: DigestRow[];
  unparsed: number;
  counts: StatusCounts;
};

// plan.md § 1 puts the signature here, so every reader of the type sees the contract.
export type ReadNight = (runsDir: string, night: string) => DigestNight;

export type JobStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  fails: number;
  lastStatus: JobStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
  // Three or more retries, or any fail. The reader decides it, so the page and the JSON agree.
  marked: boolean;
};

// The night's lines by status, so a retry that later succeeded still counts as a retry.
export type StatusCounts = { ok: number; retry: number; fail: number };

export type DigestNight = {
  night: string;
  // False when runs/<night>.jsonl cannot be read, so the page can tell 404 from "nothing ran".
  exists: boolean;
  rows: DigestRow[];
  unparsed: number;
  counts: StatusCounts;
};

// Plan morning-digest puts the signature here, so every reader of the type sees the contract.
export type ReadNight = (runsDir: string, night: string) => DigestNight;

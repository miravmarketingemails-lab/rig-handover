import type { NightSummary, Status } from '../status.js';
import { dash } from './dash.js';

// Lines, not jobs: a job that retried and then passed shows in both counts.
function countsOf(night: NightSummary): string {
  const c = night.counts;
  return c ? `lines ok ${c.ok} · retry ${c.retry} · fail ${c.fail}` : dash;
}

export function StatusBoard({ status }: { status: Status }) {
  return (
    <>
      <h1>status</h1>
      <table>
        <tbody>
          <tr><th>adapter</th><td>{status.adapter}</td></tr>
          <tr><th>installed</th><td>{status.installed}</td></tr>
          <tr>
            <th>last beat</th>
            <td>{status.lastBeat ? `${status.lastBeat.at} · pid ${status.lastBeat.pid}` : <span class="warn">none</span>}</td>
          </tr>
        </tbody>
      </table>
      <h2>nights on disk</h2>
      {status.nights.length === 0 ? (
        <p class="mute">nothing in runs/</p>
      ) : (
        <ul>
          {status.nights.map((n) => (
            <li>
              <a href={`/digest/${n.night}`}>{n.night}</a> {countsOf(n)}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

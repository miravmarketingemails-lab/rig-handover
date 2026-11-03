import type { DigestNight } from '../digest/types.js';
import { dash } from './dash.js';

function unparsedNote(count: number): string {
  return count === 1 ? '1 line did not parse' : `${count} lines did not parse`;
}

export function DigestView({ digest }: { digest: DigestNight }) {
  return (
    <>
      <h1>digest {digest.night}</h1>
      {digest.rows.length === 0 ? (
        <p class="mute">{digest.unparsed > 0 ? 'no line in this night parsed' : 'nothing ran'}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>fails</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {digest.rows.map((row) => (
              <tr class={row.marked ? 'warn' : undefined}>
                <td>{row.job}</td>
                <td>{row.owner ?? dash}</td>
                <td>{row.runs}</td>
                <td>{row.retries}</td>
                <td>{row.fails}</td>
                <td>{row.lastStatus}</td>
                <td>{row.lastError ?? dash}</td>
                <td>{row.firstAt}</td>
                <td>{row.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {digest.unparsed > 0 ? <p class="mute">{unparsedNote(digest.unparsed)}</p> : null}
    </>
  );
}

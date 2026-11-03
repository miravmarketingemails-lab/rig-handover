import type { DigestNight, DigestRow } from '../digest/types.js';

const dash = '—';

function isMarked(row: DigestRow): boolean {
  return row.retries >= 3 || row.lastStatus === 'fail';
}

function unparsedNote(count: number): string {
  return count === 1 ? '1 line did not parse' : `${count} lines did not parse`;
}

export function DigestView(props: { digest: DigestNight }) {
  const { digest } = props;
  return (
    <>
      <h1>digest {digest.night}</h1>
      {digest.rows.length === 0 ? (
        <p>nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {digest.rows.map((row) => (
              <tr class={isMarked(row) ? 'warn' : undefined}>
                <td>{row.job}</td>
                <td>{row.owner ?? dash}</td>
                <td>{row.runs}</td>
                <td>{row.retries}</td>
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

import { session, type Kind, type Prepared } from './session';
import { number, str, type JsonMap } from './control-state';
/** Immutable room/generation for every transfer chunk and cleanup. No action is retried. */
export async function downloadTransfer(action: 'files.download' | 'backup.download', parameters: JsonMap, filename: string, kind: Kind, signal: AbortSignal, progress: (n: number) => void) {
  const prepared = session.prepare(action, parameters, kind);
  const send = (name: string, p: JsonMap) => session.execute({ ...prepared, action: name, parameters: p } as Prepared);
  const start = await session.execute(prepared), id = str(start.data.transferId, ''), expected = str(start.data.sha256, ''), total = number(start.data.bytes);
  if (!id || !/^[a-f0-9]{64}$/.test(expected) || total === null || !Number.isSafeInteger(total) || total < 0 || total > 64 * 1024 * 1024) throw new Error('The service did not supply a valid transfer within the 64 MiB browser limit.');
  const content = new Uint8Array(total);
  let received = 0;
  try {
    for (let sequence = 0; sequence <= 4096; sequence++) {
      if (signal.aborted) throw new Error('Download canceled.');
      const { data } = await send(`${action}.chunk`, { transferId: id, sequence });
      if (data.transferId !== id || data.sequence !== sequence || data.sha256 !== expected || typeof data.data !== 'string') throw new Error('Transfer identity or sequence changed.');
      const binary = atob(data.data);
      if (binary.length > 16384 || received + binary.length > total) throw new Error('Transfer exceeds its declared bounds.');
      content.set(Uint8Array.from(binary, c => c.charCodeAt(0)), received);
      received += binary.length;
      progress(total ? received / total : 1);
      if (data.eof === true) break;
      if (sequence === 4096) throw new Error('Transfer sequence limit exceeded.');
    }
    if (received !== total) throw new Error('Incomplete transfer.');
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', content)), b => b.toString(16).padStart(2, '0')).join('');
    if (hash !== expected || signal.aborted || !session.valid(prepared)) throw new Error('Verification failed or the source changed. No file was saved.');
    const url = URL.createObjectURL(new Blob([content], { type: 'application/octet-stream' }));
    const a = document.createElement('a'); a.href = url; a.download = filename.replaceAll(/[^a-zA-Z0-9_.-]/g, '_'); a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } finally {
    void send(action === 'files.download' ? 'files.transfer.cancel' : 'backup.download.cancel', { transferId: id }).catch(() => {});
  }
}

import { capturedAtMillis } from './telemetry-freshness';

const missing = 'Not supplied';
const seconds = (value: number) => `${value >= 0 ? '+' : '−'}${(Math.abs(value) / 1000).toFixed(1)} s`;
const timestamp = (value: number | null) => value === null ? missing : new Date(value).toISOString();
const receipt = (value?: number) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

/** Only observed clock values. A negative offset cannot distinguish delivery delay from clock drift. */
export function clockDiagnostics({ now, paperCapturedAt, paperReceivedAt, hostCapturedAt, hostReceivedAt }: {
  now: number; paperCapturedAt: unknown; paperReceivedAt?: number; hostCapturedAt: unknown; hostReceivedAt?: number;
}) {
  const paper = capturedAtMillis(paperCapturedAt), host = capturedAtMillis(hostCapturedAt);
  const paperReceipt = receipt(paperReceivedAt), hostReceipt = receipt(hostReceivedAt);
  const paperOffset = paper === null || paperReceipt === null ? null : paper - paperReceipt;
  const hostOffset = host === null || hostReceipt === null ? null : host - hostReceipt;
  const difference = paper === null || host === null ? null : paper - host;
  let interpretation = 'Not enough data.';
  if (paperOffset !== null && hostOffset !== null) {
    if (Math.abs(paperOffset) > 5000 && Math.abs(hostOffset) > 5000 && Math.abs(paperOffset - hostOffset) <= 5000)
      interpretation = `Server clock and this browser disagree by about ${Math.round(Math.abs(paperOffset) / 1000)} s. Check time sync on the server and on this computer.`;
    else if (Math.abs(paperOffset) > 5000 && Math.abs(hostOffset) <= 5000)
      interpretation = "Paper's timestamps disagree with the Host's. This may be a Paper-side timestamp issue.";
    else if (Math.abs(paperOffset) <= 5000 && Math.abs(hostOffset) <= 5000)
      interpretation = 'Clocks agree.';
    else interpretation = 'Paper and Host offsets differ. Compare time sync on the server and on this computer.';
  }
  const rows = [
    ['Browser time now', timestamp(now)], ['Paper captured at', timestamp(paper)],
    ['Paper browser receipt', timestamp(paperReceipt)], ['Paper offset', paperOffset === null ? missing : seconds(paperOffset)],
    ['Host captured at', timestamp(host)], ['Host browser receipt', timestamp(hostReceipt)],
    ['Host offset', hostOffset === null ? missing : seconds(hostOffset)],
    ['Paper − Host capture offset', difference === null ? missing : seconds(difference)],
  ];
  return { rows, interpretation, text: `${rows.map(([label, value]) => `${label}: ${value}`).join('\n')}\n${interpretation}` };
}

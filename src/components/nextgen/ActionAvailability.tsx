export function ActionAvailability({ reason }: { reason: string | undefined }) {
  return reason ? <p className="action-availability">{reason}</p> : null;
}

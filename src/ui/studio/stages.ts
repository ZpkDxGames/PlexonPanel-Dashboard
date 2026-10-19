export type StageBounds = {
  top: number;
  bottom: number;
  plotTop: number;
  plotBottom: number;
};
/** Stage allocations share one time axis; headers and padding never consume a sibling lane. */
export function stageBounds(
  top: number,
  bottom: number,
  weights: number[],
): StageBounds[] {
  const total = weights.reduce((a, b) => a + b, 0);
  let cursor = top;
  return weights.map((weight) => {
    const start = cursor;
    cursor += ((bottom - top) * weight) / total;
    return {
      top: start,
      bottom: cursor,
      plotTop: Math.min(cursor - 8, start + 23),
      plotBottom: cursor - 8,
    };
  });
}
export function adaptiveMsptMax(values: unknown[]): number {
  const observed = values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0,
  );
  return Math.min(60, Math.max(2, Math.ceil(Math.max(0, ...observed) * 1.35)));
}
export function scaleInStage(
  value: number,
  min: number,
  max: number,
  stage: StageBounds,
) {
  return (
    stage.plotBottom -
    ((Math.min(max, Math.max(min, value)) - min) / Math.max(1, max - min)) *
      (stage.plotBottom - stage.plotTop)
  );
}
export function gapLabelPositions(positions: number[]): boolean[] {
  let last = -Infinity;
  return positions.map((x) => {
    if (x - last < 115) return false;
    last = x;
    return true;
  });
}

/** Monotone cubic interpolation. Slope limiting prevents telemetry overshoot. */
export function monotone(points: { x: number; y: number }[]) {
  if (!points.length) return "";
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  const delta = points
    .slice(1)
    .map((p, i) => (p.y - points[i].y) / (p.x - points[i].x || 1));
  const slopes = points.map((_, i) =>
    i === 0
      ? delta[0]
      : i === points.length - 1
        ? delta.at(-1)!
        : delta[i - 1] * delta[i] <= 0
          ? 0
          : 2 / (1 / delta[i - 1] + 1 / delta[i]),
  );
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      dx = (b.x - a.x) / 3;
    d += `C${a.x + dx},${a.y + slopes[i - 1] * dx} ${b.x - dx},${b.y - slopes[i] * dx} ${b.x},${b.y}`;
  }
  return d;
}

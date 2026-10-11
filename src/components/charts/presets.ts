export const tickSeries = [
  { key: "tps", label: "TPS", unit: "TPS", color: "var(--chart-paper)", max: 20 },
  { key: "mspt", label: "Mean MSPT", unit: "ms", color: "var(--chart-warn)", axis: "right" },
] as const;
export const cpuSeries = [
  { key: "processCpu", label: "JVM process", unit: "%", color: "var(--chart-info)" },
  { key: "hostCpu", label: "Host node", unit: "%", color: "var(--chart-violet)" },
] as const;
export const memorySeries = [
  { key: "heap", label: "JVM heap", unit: "bytes", color: "var(--chart-paper)" },
  { key: "memory", label: "Host physical", unit: "bytes", color: "var(--chart-warn)" },
] as const;

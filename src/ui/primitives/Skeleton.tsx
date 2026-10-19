export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-label="Loading"
      className={`pp-well skeleton min-h-6 ${className}`}
    />
  );
}
export function RouteSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-24" />
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((k) => (
          <Skeleton key={k} className="h-44" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}

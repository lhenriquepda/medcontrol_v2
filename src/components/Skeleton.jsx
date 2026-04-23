export function SkeletonCard() {
  return (
    <div className="card p-4 shimmer">
      <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-800 mb-2" />
      <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-800" />
    </div>
  )
}

export function SkeletonList({ count = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  )
}

// Item #104 [P2 UX, post-redesign v0.2.0.0]: skeleton azul/slate legacy →
// Dosy peach palette. Card primitive bg-elevated + bars bg-sunken (warm
// peach inset). Shimmer mantém em .shimmer class (index.css define gradient
// branco translúcido — funciona sobre peach também).
export function SkeletonCard() {
  return (
    <div
      className="shimmer"
      style={{
        background: 'var(--dosy-bg-elevated)',
        border: '1px solid var(--dosy-border)',
        borderRadius: 16,
        padding: 16,
        boxShadow: 'var(--dosy-shadow-xs)',
      }}
    >
      <div
        style={{
          height: 14,
          width: 160,
          borderRadius: 6,
          background: 'var(--dosy-bg-sunken)',
          marginBottom: 8,
        }}
      />
      <div
        style={{
          height: 10,
          width: 96,
          borderRadius: 6,
          background: 'var(--dosy-bg-sunken)',
        }}
      />
    </div>
  )
}

export function SkeletonList({ count = 3 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  )
}

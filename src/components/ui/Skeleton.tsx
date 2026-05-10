/**
 * Skeleton.tsx
 * Loading placeholder with optional multi-line shimmer blocks.
 */

import '@/styles/components/Skeleton.css'

interface SkeletonProps {
  width?: string
  height?: string
  className?: string
  lines?: number
}

const LINE_WIDTHS = ['100%', '92%', '84%', '76%', '88%']

export function Skeleton({
  width = '100%',
  height = '1rem',
  className = '',
  lines,
}: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <div className={['skeleton-group', className].filter(Boolean).join(' ')} aria-hidden="true">
        {Array.from({ length: lines }, (_, index) => (
          <span
            key={`${width}-${height}-${index}`}
            className="skeleton"
            style={{ width: LINE_WIDTHS[index % LINE_WIDTHS.length], height }}
          />
        ))}
      </div>
    )
  }

  return (
    <span
      className={['skeleton', className].filter(Boolean).join(' ')}
      style={{ width, height }}
      aria-hidden="true"
    />
  )
}

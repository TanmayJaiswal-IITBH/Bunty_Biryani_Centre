interface SkeletonProps {
  /** Tailwind size classes, e.g. "h-4 w-32". */
  className?: string;
}

/** A placeholder block. The pulse is switched off under prefers-reduced-motion. */
export function Skeleton({ className = 'h-4 w-full' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-control bg-line motion-safe:animate-pulse ${className}`}
    />
  );
}

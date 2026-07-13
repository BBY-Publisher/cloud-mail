import { cn } from '@/lib/utils';

interface LoadingProps {
  size?: number;
  className?: string;
}

export default function Loading({ size = 30, className }: LoadingProps) {
  return (
    <span
      className={cn('inline-flex items-center justify-center', className)}
      style={{ fontSize: size }}
    >
      <svg
        className="loading-circular"
        viewBox="0 0 20 20"
        style={{ width: size, height: size }}
      >
        <g strokeWidth={0} style={{ stroke: 'none' }}>
          <circle r="3.375" className="loading-dot loading-dot1" />
          <circle r="3.375" className="loading-dot loading-dot2" />
          <circle r="3.375" className="loading-dot loading-dot4" />
          <circle r="3.375" className="loading-dot loading-dot3" />
        </g>
      </svg>
    </span>
  );
}

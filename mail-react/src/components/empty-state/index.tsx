import type { ReactNode } from 'react';
import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  className?: string;
  children?: ReactNode;
}

export function EmptyState({
  icon = 'lucide:inbox',
  title,
  description,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-muted-foreground">
        <Icon icon={icon} width="20" height="20" />
      </span>
      <div className="text-[13px] font-medium text-foreground">{title}</div>
      {description ? (
        <div className="max-w-[320px] text-[12px] text-muted-foreground">{description}</div>
      ) : null}
      {children ? <div className="mt-1">{children}</div> : null}
    </div>
  );
}

export default EmptyState;
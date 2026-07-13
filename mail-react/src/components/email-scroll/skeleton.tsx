import { Icon } from '@iconify/react';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';

interface EmailSkeletonProps {
  rows?: number;
  showStar?: boolean;
  showUserInfo?: boolean;
}

export default function EmailSkeleton({
  rows = 1,
  showStar = true,
  showUserInfo = false,
}: EmailSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-background">
          <div className="flex items-center gap-2 border-b border-border px-3 py-3">
            <Checkbox disabled className="shrink-0" />
            {showStar && (
              <div className="flex w-8 justify-center">
                <Icon
                  className="text-border"
                  icon="solar:star-line-duotone"
                  width="18"
                  height="18"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-[120px]" />
                <Skeleton className="h-4 w-[50px]" />
              </div>
              <div className="mt-2 space-y-1">
                <Skeleton className="h-4 w-[70%]" />
                <Skeleton className="h-4 w-[45%]" />
              </div>
              {showUserInfo && (
                <div className="mt-2 space-y-1">
                  <Skeleton className="h-4 w-[180px]" />
                  <Skeleton className="h-4 w-[180px]" />
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

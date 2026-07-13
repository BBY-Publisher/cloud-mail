import { Outlet, useLocation, useMatches } from 'react-router-dom';
import { useSettingStore } from '@/store/setting';
import { useUiStore } from '@/store/ui';
import { hasPerm } from '@/perm';
import { cn } from '@/lib/utils';
import type { RouteMeta } from '@/router/perms';
import Account from './account';

const STATIC_META: Record<string, RouteMeta> = {
  '/inbox': { title: 'inbox', name: 'email', menu: true },
  '/message': { title: 'details', name: 'content', menu: false },
  '/settings': { title: 'settings', name: 'setting', menu: true },
  '/starred': { title: 'starred', name: 'star', menu: true },
};

/** Resolve the meta (title/name) for the currently matched route. */
export function useMatchedMeta(): RouteMeta | null {
  const matches = useMatches();
  const location = useLocation();
  for (let i = matches.length - 1; i >= 0; i--) {
    const handle = matches[i].handle as { meta?: RouteMeta } | undefined;
    if (handle?.meta) return handle.meta;
  }
  return STATIC_META[location.pathname] ?? null;
}

export default function Main() {
  const settings = useSettingStore((s) => s.settings);
  const accountShow = useUiStore((s) => s.accountShow);
  const setAccountShow = useUiStore((s) => s.setAccountShow);

  const showAccount = accountShow && settings?.manyEmail === 0 && hasPerm('account:query');

  return (
    <div
      className={cn(
        'grid h-[calc(100%-48px)]',
        showAccount ? 'grid-cols-1 md:grid-cols-[260px_1fr]' : 'grid-cols-1',
      )}
    >
      {showAccount && (
        <>
          <div
            className="fixed inset-0 z-10 bg-black/60 transition-all md:hidden"
            onClick={() => setAccountShow(false)}
          />
          <Account className="z-20 max-md:fixed max-md:w-[260px]" />
        </>
      )}
      <div className="overflow-hidden bg-background">
        <Outlet />
      </div>
    </div>
  );
}

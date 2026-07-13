import { useState } from 'react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import Hamburger from '@/components/hamburger';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useUiStore } from '@/store/ui';
import { useUserStore } from '@/store/user';
import { hasPerm } from '@/perm';
import { logout } from '@/request/login';
import { setToken } from '@/request/http';
import { useMatchedMeta } from './main';

function switchDark(nextIsDark: boolean) {
  const root = document.documentElement;
  root.setAttribute('class', nextIsDark ? 'dark' : '');
  const metaTag = document.getElementById('theme-color-meta');
  if (metaTag) {
    metaTag.setAttribute('content', nextIsDark ? 'oklch(0.13 0.005 250)' : 'oklch(0.985 0 0)');
  }
  useUiStore.getState().setDark(nextIsDark);
}

export default function Header() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dark = useUiStore((s) => s.dark);
  const asideShow = useUiStore((s) => s.asideShow);
  const setAsideShow = useUiStore((s) => s.setAsideShow);
  const openWriter = useUiStore((s) => s.openWriter);
  const user = useUserStore((s) => s.user);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const meta = useMatchedMeta();

  const title = meta?.title ?? 'inbox';

  function openDark(e: React.MouseEvent) {
    const nextIsDark = !dark;
    const root = document.documentElement;
    const anyDoc = document as Document & {
      startViewTransition?: (cb: () => void) => { finished: Promise<void> };
    };
    if (!anyDoc.startViewTransition) {
      switchDark(nextIsDark);
      return;
    }
    const x = e.clientX;
    const y = e.clientY;
    const maxX = Math.max(x, window.innerWidth - x);
    const maxY = Math.max(y, window.innerHeight - y);
    const endRadius = Math.hypot(maxX, maxY);
    root.setAttribute('data-theme-to', nextIsDark ? 'dark' : 'light');
    root.style.setProperty('--vt-x', `${x}px`);
    root.style.setProperty('--vt-y', `${y}px`);
    root.style.setProperty('--vt-end-radius', `${endRadius + 10}px`);
    const transition = anyDoc.startViewTransition!(() => switchDark(nextIsDark));
    transition.finished.finally(() => root.removeAttribute('data-theme-to'));
  }

  async function copyEmail(email: string) {
    try {
      await navigator.clipboard.writeText(email);
      toast.success(t('copySuccessMsg'));
    } catch {
      toast.error(t('copyFailMsg'));
    }
  }

  function clickLogout() {
    setLogoutLoading(true);
    logout()
      .then(() => {
        setToken('');
        navigate('/login', { replace: true });
      })
      .finally(() => setLogoutLoading(false));
  }

  function formatName(email?: string) {
    return email?.[0]?.toUpperCase() || '';
  }

  const canSend = hasPerm('email:send');

  return (
    <div className="flex h-full items-center gap-1 px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Hamburger isActive={asideShow} onToggle={() => setAsideShow(!asideShow)} />
        <span className="truncate text-[13px] font-semibold tracking-tight text-foreground">{t(title)}</span>
      </div>

      {canSend && (
        <button
          type="button"
          onClick={() => openWriter()}
          className="ml-2 group inline-flex h-7 items-center gap-1.5 rounded-md bg-foreground px-2.5 text-[12px] font-medium text-background transition-colors duration-120 hover:bg-foreground/85"
        >
          <Icon icon="material-symbols:edit-outline-sharp" width="14" height="14" />
          <span>{t('write')}</span>
        </button>
      )}

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          aria-label={dark ? 'Switch to light' : 'Switch to dark'}
          onClick={openDark}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-120 hover:bg-accent hover:text-foreground"
        >
          {dark ? (
            <Icon icon="mingcute:sun-fill" width="16" height="16" />
          ) : (
            <Icon icon="solar:moon-linear" width="16" height="16" />
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-1 inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[12px] font-medium text-foreground transition-colors duration-120 hover:bg-accent"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary font-mono text-[10px] tabular-nums">
                {formatName(user?.email)}
              </span>
              <Icon icon="mingcute:down-small-fill" width="14" height="14" className="text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[260px] p-0">
            <div className="px-4 pb-3 pt-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-sm">
                  {formatName(user?.email)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-foreground">{user?.name}</div>
                  <div
                    className="cursor-pointer truncate font-mono text-[11px] text-muted-foreground tabular-nums"
                    onClick={() => copyEmail(user?.email ?? '')}
                  >
                    {user?.email}
                  </div>
                </div>
              </div>
              {user?.role?.name && (
                <div className="mt-3">
                  <Badge variant="secondary" className="font-normal">
                    {user.role.name}
                  </Badge>
                </div>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                navigate('/settings');
              }}
              className="cursor-pointer"
            >
              <Icon icon="fluent:settings-24-regular" width="14" height="14" className="mr-2" />
              {t('settings')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                clickLogout();
              }}
              disabled={logoutLoading}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <Icon icon="mingcute:exit-line" width="14" height="14" className="mr-2" />
              {t('logOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
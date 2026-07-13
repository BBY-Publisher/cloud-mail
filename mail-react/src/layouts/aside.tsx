import { Icon } from '@iconify/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSettingStore } from '@/store/setting';
import { useUiStore } from '@/store/ui';
import { hasPerm } from '@/perm';
import { cn } from '@/lib/utils';

interface MenuItem {
  path: string;
  name: string;
  label: string;
  icon: string;
  iconSize?: number;
  perm?: string | string[];
}

const MAIN_MENU: MenuItem[] = [
  { path: '/inbox', name: 'email', label: 'inbox', icon: 'hugeicons:mailbox-01' },
  { path: '/sent', name: 'send', label: 'sent', icon: 'cil:send', perm: 'email:send' },
  { path: '/drafts', name: 'draft', label: 'drafts', icon: 'ep:document', perm: 'email:send' },
  { path: '/starred', name: 'star', label: 'starred', icon: 'solar:star-line-duotone' },
  { path: '/settings', name: 'setting', label: 'settings', icon: 'fluent:settings-48-regular' },
];

const MANAGE_PERMS = [
  'all-email:query',
  'user:query',
  'role:query',
  'setting:query',
  'analysis:query',
  'reg-key:query',
  'signature:query',
];

const MANAGE_MENU: MenuItem[] = [
  { path: '/analysis', name: 'analysis', label: 'analytics', icon: 'fluent:data-pie-20-regular', iconSize: 22, perm: 'analysis:query' },
  { path: '/all-users', name: 'user', label: 'allUsers', icon: 'si:user-alt-2-line', perm: 'user:query' },
  { path: '/all-mail', name: 'all-email', label: 'allMail', icon: 'fluent:mail-list-28-regular', iconSize: 21, perm: 'all-email:query' },
  { path: '/role', name: 'role', label: 'permissions', icon: 'fluent:lock-closed-16-regular', iconSize: 21, perm: 'role:query' },
  { path: '/invite-code', name: 'reg-key', label: 'inviteCode', icon: 'fluent:fingerprint-20-filled', iconSize: 21, perm: 'reg-key:query' },
  { path: '/signatures', name: 'signature', label: 'signature', icon: 'fluent:signature-32-regular', iconSize: 21, perm: 'signature:query' },
  { path: '/system-setting', name: 'sys-setting', label: 'SystemSettings', icon: 'eos-icons:system-ok-outlined', iconSize: 18, perm: 'setting:query' },
];

export default function Aside() {
  const settings = useSettingStore((s) => s.settings);
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1025;
  const setAsideShow = useUiStore((s) => s.setAsideShow);

  function go(path: string) {
    navigate(path);
    if (isMobile) setAsideShow(false);
  }

  function renderItem(item: MenuItem) {
    if (item.perm && !hasPerm(item.perm)) return null;
    const active = location.pathname === item.path;
    return (
      <button
        key={item.path}
        type="button"
        onClick={() => go(item.path)}
        className={cn(
          'group mx-2 my-[1px] flex h-8 w-[calc(100%-1rem)] cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors duration-120 ease-expo',
          'text-muted-foreground hover:bg-accent hover:text-foreground',
          active && 'bg-accent text-foreground font-medium',
        )}
      >
        <Icon
          icon={item.icon}
          width={item.iconSize ?? 18}
          height={item.iconSize ?? 18}
          className={cn('shrink-0 transition-colors duration-120', active ? 'text-foreground' : 'text-muted-foreground/70 group-hover:text-foreground')}
        />
        <span className="select-none truncate">{t(item.label)}</span>
        {active && <span className="ml-auto h-1 w-1 rounded-full bg-brand" aria-hidden />}
      </button>
    );
  }

  return (
    <ScrollArea className="h-full w-[240px] border-r border-border bg-background">
      <div className="flex flex-col gap-1 px-2 pb-4 pt-4">
        <button
          type="button"
          onClick={() => go('/inbox')}
          className="mx-2 mb-3 flex h-9 items-center gap-2 rounded-md px-2 text-left transition-colors duration-120 hover:bg-accent"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-foreground text-background">
            <Icon icon="mdi:email-fast-outline" width="14" height="14" />
          </span>
          <span className="truncate text-[13px] font-semibold tracking-tight text-foreground">
            {settings?.title || 'Cloud Mail'}
          </span>
        </button>

        <nav className="flex flex-col gap-0">
          {MAIN_MENU.map(renderItem)}
        </nav>

        {hasPerm(MANAGE_PERMS) && (
          <>
            <div className="mx-3 mt-4 mb-1 text-eyebrow">{t('manage')}</div>
            <nav className="flex flex-col gap-0">{MANAGE_MENU.map(renderItem)}</nav>
          </>
        )}
      </div>
    </ScrollArea>
  );
}
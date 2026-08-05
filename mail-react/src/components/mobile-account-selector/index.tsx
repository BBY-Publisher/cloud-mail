import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useAccountStore } from '@/store/account';
import { accountList, type AccountListItem, type AccountPerm } from '@/request/account';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 50;

const permLabelKey = (p: AccountPerm | undefined | null): 'mailboxOwner' | 'roleAdmin' | 'roleSender' | 'roleViewer' | null => {
  if (p === 'owner') return 'mailboxOwner';
  if (p === 'admin') return 'roleAdmin';
  if (p === 'sender') return 'roleSender';
  if (p === 'viewer') return 'roleViewer';
  return null;
};

export default function MobileAccountSelector() {
  const { t } = useTranslation();
  const currentAccountId = useAccountStore((s) => s.currentAccountId);
  const currentAccount = useAccountStore((s) => s.currentAccount);
  const setCurrentAccountId = useAccountStore((s) => s.setCurrentAccountId);
  const setCurrentAccount = useAccountStore((s) => s.setCurrentAccount);

  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await accountList(0, PAGE_SIZE);
      setAccounts(list || []);
    } catch {
      toast.error(t('loadMailboxesFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!open) return;
    refresh();
  }, [open, refresh]);

  function switchTo(item: AccountListItem) {
    if (item.accountId === currentAccountId) {
      setOpen(false);
      return;
    }
    setCurrentAccountId(item.accountId);
    setCurrentAccount({
      accountId: item.accountId,
      email: item.email,
      name: item.name,
      allReceive: item.allReceive,
    });
    setOpen(false);
  }

  const currentEmail = currentAccount?.email ?? '';
  const currentName = currentAccount?.name;
  const others = accounts.filter((a) => a.accountId !== currentAccountId);

  return (
    <div className="md:hidden border-b border-border bg-background">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t('switchMailbox')}
            className="group flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-accent active:bg-accent"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background font-mono text-[12px] tabular-nums">
              {(currentEmail[0] || '?').toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-medium text-foreground">
                  {currentName || currentEmail || '—'}
                </span>
              </span>
              <span className="block truncate font-mono text-[11px] text-muted-foreground tabular-nums">
                {currentEmail || t('switchMailboxHint')}
              </span>
            </span>
            <Icon
              icon="mingcute:down-small-fill"
              width="18"
              height="18"
              className={cn(
                'shrink-0 text-muted-foreground transition-transform duration-200',
                open && 'rotate-180',
              )}
            />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className="w-[min(320px,calc(100vw-24px))] max-h-[70vh] overflow-auto p-0"
        >
          <DropdownMenuLabel className="px-3 pt-3 pb-1 text-caption font-normal text-muted-foreground">
            {t('switchMailbox')}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {loading && accounts.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t('loading')}
            </div>
          ) : others.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t('noOtherMailboxes')}
            </div>
          ) : (
            others.map((item) => {
              const roleKey = permLabelKey(item.perm);
              return (
                <DropdownMenuItem
                  key={item.accountId}
                  onSelect={(e) => {
                    e.preventDefault();
                    switchTo(item);
                  }}
                  className="cursor-pointer flex-col items-start gap-0.5 px-3 py-2"
                >
                  <div className="flex w-full items-center gap-1.5">
                    <span className="truncate text-[13px] font-medium text-foreground">
                      {item.name || item.email}
                    </span>
                    {roleKey && (
                      <Badge
                        variant={item.perm === 'owner' ? 'default' : 'secondary'}
                        className="ml-auto shrink-0 px-1.5 py-0 text-[10px]"
                      >
                        {t(roleKey)}
                      </Badge>
                    )}
                  </div>
                  <span className="block w-full truncate font-mono text-[11px] text-muted-foreground tabular-nums">
                    {item.email}
                  </span>
                </DropdownMenuItem>
              );
            })
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

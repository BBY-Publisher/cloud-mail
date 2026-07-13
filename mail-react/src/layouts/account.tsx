import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAccountStore } from '@/store/account';
import { useUserStore } from '@/store/user';
import { hasPerm } from '@/perm';
import {
  accountAdd,
  accountDelete,
  accountList,
  accountSetAllReceive,
  accountSetAsTop,
  accountSetName,
  type AccountListItem,
  type AccountPerm,
} from '@/request/account';
import { cn } from '@/lib/utils';
import AccountMemberDialog from '@/components/account-member-dialog';

const PAGE_SIZE = 30;

interface AccountProps {
  className?: string;
}

export default function Account({ className }: AccountProps) {
  const { t } = useTranslation();
  const user = useUserStore((s) => s.user);
  const currentAccountId = useAccountStore((s) => s.currentAccountId);
  const setCurrentAccountId = useAccountStore((s) => s.setCurrentAccountId);
  const setCurrentAccount = useAccountStore((s) => s.setCurrentAccount);

  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [noMore, setNoMore] = useState(false);
  const lastSortRef = useRef<number | undefined>(undefined);

  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [renameTarget, setRenameTarget] = useState<AccountListItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AccountListItem | null>(null);
  const [memberTarget, setMemberTarget] = useState<AccountListItem | null>(null);

  const permLabel = (perm: AccountPerm | undefined) => {
    if (perm === 'owner') return t('mailboxOwner');
    if (perm === 'admin') return t('roleAdmin');
    if (perm === 'sender') return t('roleSender');
    if (perm === 'viewer') return t('roleViewer');
    return null;
  };

  const canManage = (item: AccountListItem) =>
    item.perm === 'owner' || item.perm === 'admin';
  const canRename = (item: AccountListItem) =>
    item.perm === 'owner' || item.perm === 'admin';

  const loadMore = useCallback(async () => {
    if (loading || noMore) return;
    setLoading(true);
    try {
      const list = await accountList(0, PAGE_SIZE, lastSortRef.current);
      setAccounts((prev) => [...prev, ...list]);
      if (list.length < PAGE_SIZE) setNoMore(true);
      const last = list[list.length - 1];
      if (last) lastSortRef.current = (last as unknown as { sort?: number }).sort;
    } finally {
      setLoading(false);
    }
  }, [loading, noMore]);

  const refresh = useCallback(() => {
    setAccounts([]);
    setNoMore(false);
    lastSortRef.current = undefined;
    // trigger reload on next tick
    setTimeout(() => loadMoreRef.current(), 0);
  }, []);

  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  useEffect(() => {
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeAccount(item: AccountListItem) {
    setCurrentAccountId(item.accountId);
    setCurrentAccount(item);
  }

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 600) loadMore();
  }

  async function copyAccount(email: string) {
    try {
      await navigator.clipboard.writeText(email);
      toast.success(t('copySuccessMsg'));
    } catch {
      toast.error(t('copyFailMsg'));
    }
  }

  async function toggleAllReceive(item: AccountListItem) {
    await accountSetAllReceive(item.accountId);
    setAccounts((prev) =>
      prev.map((a) =>
        a.accountId === item.accountId ? { ...a, allReceive: a.allReceive ? 0 : 1 } : a,
      ),
    );
  }

  async function submitAdd() {
    if (!addEmail) return;
    try {
      await accountAdd(addEmail);
      toast.success(t('addSuccessMsg'));
      setAddOpen(false);
      setAddEmail('');
      refresh();
    } catch {
      /* interceptor toasts */
    }
  }

  async function submitRename() {
    if (!renameTarget) return;
    await accountSetName(renameTarget.accountId, renameValue);
    setAccounts((prev) =>
      prev.map((a) => (a.accountId === renameTarget.accountId ? { ...a, name: renameValue } : a)),
    );
    setRenameTarget(null);
  }

  async function setAsTop(item: AccountListItem) {
    await accountSetAsTop(item.accountId);
    refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await accountDelete(deleteTarget.accountId);
    setAccounts((prev) => prev.filter((a) => a.accountId !== deleteTarget.accountId));
    setDeleteTarget(null);
  }

  const selfAccountId = user?.account?.accountId;

  return (
    <div className={cn('flex h-full flex-col border-r border-border bg-background', className)}>
      <div className="flex items-center justify-end gap-3 border-b border-border p-2">
        {hasPerm('account:add') && (
          <Icon
            className="cursor-pointer text-muted-foreground hover:text-foreground"
            icon="ion:add-outline"
            width="23"
            height="23"
            onClick={() => setAddOpen(true)}
          />
        )}
        <Icon
          className="cursor-pointer text-muted-foreground hover:text-foreground"
          icon="ion:reload"
          width="18"
          height="18"
          onClick={refresh}
        />
      </div>

      <ScrollArea className="flex-1" onScrollCapture={onScroll}>
        <div className="p-2">
          {accounts.map((item) => (
            <Card
              key={item.accountId}
              onClick={() => changeAccount(item)}
              className={cn(
                'mb-2 cursor-pointer p-3 transition-colors hover:bg-accent',
                currentAccountId === item.accountId && 'bg-accent',
              )}
            >
              <div className="mb-1 truncate text-sm">{item.email}</div>
              {item.perm && item.perm !== 'owner' && (
                <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {permLabel(item.perm)}
                </div>
              )}
              <div className="flex items-center justify-between">
                <div onClick={(e) => e.stopPropagation()}>
                  <Icon
                    icon={item.allReceive ? 'flat-color-icons:folder' : 'eva:email-fill'}
                    width="22"
                    height="22"
                    className="cursor-pointer"
                    color={item.allReceive ? '#23c4f1' : '#fccb1a'}
                    onClick={() => toggleAllReceive(item)}
                  />
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Icon
                    icon="fluent-color:clipboard-24"
                    width="22"
                    height="22"
                    className="cursor-pointer"
                    onClick={() => copyAccount(item.email)}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <span className="cursor-pointer">
                        <Icon
                          icon="fluent:settings-24-filled"
                          width="21"
                          height="21"
                          color="#909399"
                        />
                      </span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canRename(item) && (
                        <DropdownMenuItem
                          onClick={() => {
                            setRenameTarget(item);
                            setRenameValue(item.name ?? '');
                          }}
                        >
                          {t('rename')}
                        </DropdownMenuItem>
                      )}
                      {item.accountId !== selfAccountId && (
                        <DropdownMenuItem onClick={() => setAsTop(item)}>
                          {t('pin')}
                        </DropdownMenuItem>
                      )}
                      {canManage(item) && (
                        <DropdownMenuItem onClick={() => setMemberTarget(item)}>
                          {t('memberManagement')}
                        </DropdownMenuItem>
                      )}
                      {item.perm === 'owner' && item.accountId !== selfAccountId && hasPerm('account:delete') && (
                        <DropdownMenuItem onClick={() => setDeleteTarget(item)}>
                          {t('delete')}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </Card>
          ))}
          {loading && (
            <div className="py-4 text-center text-sm text-muted-foreground">{t('loading')}</div>
          )}
        </div>
      </ScrollArea>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addAccount')}</DialogTitle>
          </DialogHeader>
          <Input
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            placeholder={t('email')}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={submitAdd}>{t('confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('rename')}</DialogTitle>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              {t('cancel')}
            </Button>
            <Button onClick={submitRename}>{t('confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete')}</AlertDialogTitle>
            <AlertDialogDescription>{deleteTarget?.email}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>{t('confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {memberTarget && (
        <AccountMemberDialog
          open={!!memberTarget}
          accountId={memberTarget.accountId}
          accountEmail={memberTarget.email}
          canManage={canManage(memberTarget)}
          onClose={() => setMemberTarget(null)}
        />
      )}
    </div>
  );
}

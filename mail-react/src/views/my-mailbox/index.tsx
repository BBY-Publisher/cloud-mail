import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@iconify/react';
import { toast } from 'sonner';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  accountDelete,
  accountList,
  accountSetName,
  type AccountListItem,
  type AccountPerm,
} from '@/request/account';
import { hasPerm } from '@/perm';
import { useAccountStore } from '@/store/account';
import AccountMemberDialog from '@/components/account-member-dialog';

const permLabelKey = (p: AccountPerm | undefined | null): 'mailboxOwner' | 'roleAdmin' | 'roleSender' | 'roleViewer' | null => {
  if (p === 'owner') return 'mailboxOwner';
  if (p === 'admin') return 'roleAdmin';
  if (p === 'sender') return 'roleSender';
  if (p === 'viewer') return 'roleViewer';
  return null;
};

export default function MyMailboxView() {
  const { t } = useTranslation();
  const setCurrentAccount = useAccountStore((s) => s.setCurrentAccount);
  const setCurrentAccountId = useAccountStore((s) => s.setCurrentAccountId);

  const [rows, setRows] = useState<AccountListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [renameTarget, setRenameTarget] = useState<AccountListItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AccountListItem | null>(null);
  const [memberTarget, setMemberTarget] = useState<AccountListItem | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await accountList(0, 30);
      setRows(list || []);
    } catch {
      /* interceptor */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function submitRename() {
    if (!renameTarget) return;
    try {
      await accountSetName(renameTarget.accountId, renameValue);
      toast.success(t('setSuccess'));
      setRenameTarget(null);
      refresh();
    } catch {
      /* interceptor */
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await accountDelete(deleteTarget.accountId);
      toast.success(t('setSuccess'));
      setDeleteTarget(null);
      refresh();
    } catch {
      /* interceptor */
    }
  }

  function switchTo(item: AccountListItem) {
    setCurrentAccount(item);
    setCurrentAccountId(item.accountId);
  }

  const canManage = (item: AccountListItem) =>
    item.perm === 'owner' || item.perm === 'admin';

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t('myMailboxes')}</h1>
      </div>
      <div className="page-body">
        <div className="rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr className="text-left">
                <th className="px-3 py-2 text-caption font-medium">Email</th>
                <th className="px-3 py-2 text-caption font-medium">Name</th>
                <th className="px-3 py-2 text-caption font-medium">{t('mailboxRole')}</th>
                <th className="px-3 py-2 text-caption font-medium">{t('mailboxOwner')}</th>
                <th className="px-3 py-2 text-caption font-medium text-right">{t('memberCount')}</th>
                <th className="px-3 py-2 text-caption font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.accountId} className="border-t">
                  <td className="px-3 py-2 font-mono text-num">{item.email}</td>
                  <td className="px-3 py-2">{item.name || '—'}</td>
                  <td className="px-3 py-2">
                    {permLabelKey(item.perm) ? (
                      <Badge variant={item.perm === 'owner' ? 'default' : 'secondary'}>
                        {t(permLabelKey(item.perm) as 'mailboxOwner')}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-num text-muted-foreground">
                    {item.ownerEmail || '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-num">
                    {item.perm === 'owner' ? (item.memberCount ?? 0) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-2">
                      <Icon
                        icon="ion:swap-horizontal"
                        width="16"
                        height="16"
                        className="cursor-pointer text-muted-foreground hover:text-foreground"
                        onClick={() => switchTo(item)}
                      />
                      {canManage(item) && (
                        <Icon
                          icon="ion:people-outline"
                          width="16"
                          height="16"
                          className="cursor-pointer text-muted-foreground hover:text-foreground"
                          onClick={() => setMemberTarget(item)}
                        />
                      )}
                      {canManage(item) && (
                        <Icon
                          icon="ion:create-outline"
                          width="16"
                          height="16"
                          className="cursor-pointer text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setRenameTarget(item);
                            setRenameValue(item.name ?? '');
                          }}
                        />
                      )}
                      {item.perm === 'owner' && item.accountId !== useAccountStore.getState().currentAccountId && hasPerm('account:delete') && (
                        <Icon
                          icon="ion:trash-outline"
                          width="16"
                          height="16"
                          className="cursor-pointer text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget(item)}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    —
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t('rename')}</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            maxLength={30}
          />
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
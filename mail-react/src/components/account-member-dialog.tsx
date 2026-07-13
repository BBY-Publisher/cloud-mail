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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  accountMemberAdd,
  accountMemberList,
  accountMemberRemove,
  accountMemberSetRole,
  type AccountMember,
} from '@/request/account';

interface AccountMemberDialogProps {
  open: boolean;
  accountId: number;
  accountEmail: string;
  canManage: boolean;
  onClose: () => void;
}

type MemberRole = 'viewer' | 'sender' | 'admin';

const ROLE_OPTIONS: { value: MemberRole }[] = [
  { value: 'viewer' },
  { value: 'sender' },
  { value: 'admin' },
];

const roleKey = (r: MemberRole) =>
  `role${r.charAt(0).toUpperCase()}${r.slice(1)}` as 'roleViewer' | 'roleSender' | 'roleAdmin';

export default function AccountMemberDialog({
  open,
  accountId,
  accountEmail,
  canManage,
  onClose,
}: AccountMemberDialogProps) {
  const { t } = useTranslation();
  const [members, setMembers] = useState<AccountMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState<MemberRole>('sender');
  const [removing, setRemoving] = useState<AccountMember | null>(null);

  const refresh = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const list = await accountMemberList(accountId);
      setMembers(list || []);
    } catch {
      /* interceptor */
    } finally {
      setLoading(false);
    }
  }, [open, accountId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function submitAdd() {
    if (!addEmail) return;
    try {
      await accountMemberAdd(accountId, addEmail, addRole);
      toast.success(t('setSuccess'));
      setAddEmail('');
      refresh();
    } catch {
      /* interceptor */
    }
  }

  async function changeRole(member: AccountMember, role: MemberRole) {
    try {
      await accountMemberSetRole(accountId, member.userId, role);
      toast.success(t('setSuccess'));
      refresh();
    } catch {
      /* interceptor */
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    try {
      await accountMemberRemove(accountId, removing.userId);
      toast.success(t('setSuccess'));
      setRemoving(null);
      refresh();
    } catch {
      /* interceptor */
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-[640px]">
          <DialogHeader>
            <DialogTitle>
              {t('memberManagement')} · <span className="text-muted-foreground">{accountEmail}</span>
            </DialogTitle>
          </DialogHeader>

          {canManage && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  placeholder={t('memberEmail')}
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                />
              </div>
              <div className="w-[140px]">
                <Select value={addRole} onValueChange={(v) => setAddRole(v as MemberRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {t(roleKey(opt.value))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={submitAdd}>{t('addMember')}</Button>
            </div>
          )}

          <div className="max-h-[400px] overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr className="text-left">
                  <th className="px-3 py-2 text-caption font-medium">{t('memberEmail')}</th>
                  <th className="px-3 py-2 text-caption font-medium">{t('memberRole')}</th>
                  <th className="px-3 py-2 text-caption font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.userId} className="border-t">
                    <td className="px-3 py-2 font-mono text-num">{m.email}</td>
                    <td className="px-3 py-2">
                      {canManage ? (
                        <Select
                          value={(m.role || 'viewer') as MemberRole}
                          onValueChange={(v) => changeRole(m, v as MemberRole)}
                        >
                          <SelectTrigger className="h-7 w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {t(roleKey(opt.value))}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary">
                          {t(roleKey((m.role || 'viewer') as MemberRole))}
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Icon
                        icon="ion:trash-outline"
                        width="18"
                        height="18"
                        className={cn(
                          'inline-block cursor-pointer text-muted-foreground hover:text-destructive',
                          !canManage && 'pointer-events-none opacity-30',
                        )}
                        onClick={() => canManage && setRemoving(m)}
                      />
                    </td>
                  </tr>
                ))}
                {!loading && members.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                      —
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              {t('cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('removeMember')}</AlertDialogTitle>
            <AlertDialogDescription>{removing?.email}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>{t('confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Local utility to keep the file standalone
function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(' ');
}
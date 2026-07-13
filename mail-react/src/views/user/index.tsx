import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@iconify/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmAction } from '@/components/confirm-action';
import Loading from '@/components/loading';
import {
  userList,
  userDelete,
  userSetPwd,
  userSetStatus,
  userSetType,
  userAdd,
  userRestSendCount,
  userRestore,
  userDeleteAccount,
  userAllAccount,
  adminAccountAdd,
  adminAccountRename,
} from '@/request/user';
import { roleSelectUse } from '@/request/role';
import { useRoleStore } from '@/store/role';
import { useUserStore } from '@/store/user';
import { useSettingStore } from '@/store/setting';
import { isEmail } from '@/utils/verify-utils';
import { tzDayjs } from '@/utils/day';

interface UserRow extends Record<string, any> {
  userId: number;
  email: string;
  status: number;
  isDel: number;
  type: number;
  username?: string;
  checkedClass?: string;
}

export default function UserView() {
  const { t } = useTranslation();
  const userStore = useUserStore();
  const domainList = useSettingStore((s) => s.domainList);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [roleList, setRoleList] = useState<any[]>([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [first, setFirst] = useState(true);

  const [params, setParams] = useState({
    email: '',
    num: 1,
    size: 15,
    timeSort: 0,
    status: -1,
  });

  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Add dialog
  const [showAdd, setShowAdd] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addForm, setAddForm] = useState({
    email: '',
    suffix: domainList[0] || '',
    password: '',
    type: 0 as number,
  });

  // Pwd dialog
  const [setPwdShow, setSetPwdShow] = useState(false);
  const [userForm, setUserForm] = useState({ userId: 0, password: '', type: 0 });

  // Type dialog
  const [setTypeShow, setSetTypeShow] = useState(false);
  const [settingLoading, setSettingLoading] = useState(false);

  // Account list dialog
  const [accountShow, setAccountShow] = useState(false);
  const [accountList, setAccountList] = useState<any[]>([]);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountParams, setAccountParams] = useState({ num: 1, size: 10, total: 0, userId: 0 });

  // Admin: add mailbox to a target user
  const [adminAddOpen, setAdminAddOpen] = useState(false);
  const [adminAddLoading, setAdminAddLoading] = useState(false);
  const [adminAddForm, setAdminAddForm] = useState({
    email: '',
    suffix: domainList[0] || '',
    name: '',
  });

  // Admin: rename a target account
  const [adminRenameTarget, setAdminRenameTarget] = useState<any>(null);
  const [adminRenameValue, setAdminRenameValue] = useState('');
  const [adminRenameLoading, setAdminRenameLoading] = useState(false);

  // Details dialog
  const [detailsShow, setDetailsShow] = useState(false);
  const [userDetails, setUserDetails] = useState<any>({});

  // Confirm dialogs (one per destructive action — single ConfirmAction component
  // is rendered per pending target, so each dialog tracks its own target).
  const [delUsersOpen, setDelUsersOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<any>(null);
  const [resetSendTarget, setResetSendTarget] = useState<any>(null);
  const [delAccountTarget, setDelAccountTarget] = useState<any>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('user-params');
    if (saved) {
      try {
        const localParams = JSON.parse(saved);
        setParams((p) => ({ ...p, ...localParams }));
      } catch {}
    }
    roleSelectUse().then(setRoleList);
    getUserList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem('user-params', JSON.stringify(params));
  }, [params]);

  useEffect(() => {
    const unsub = useRoleStore.subscribe(() => roleSelectUse().then(setRoleList));
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = useUserStore.subscribe((s: any) => {
      if (s.refreshList > 0) getUserList(false);
    });
    return unsub;
  }, []);

  function getUserList(loading = true) {
    if (loading) setTableLoading(true);
    const newParams: any = { ...params };
    if (newParams.status === -2) {
      delete newParams.status;
      newParams.isDel = 1;
    }
    userList(newParams)
      .then((data: any) => {
        setUsers(data.list.map((item: any) => ({ ...item, checkedClass: '' })));
        setTotal(data.total);
      })
      .finally(() => {
        setTableLoading(false);
        setTimeout(() => setFirst(false), 200);
      });
  }

  function refresh() {
    setParams({ email: '', num: 1, size: 15, timeSort: 0, status: -1 });
    roleSelectUse().then(setRoleList);
  }

  function search() {
    setParams((p) => ({ ...p, num: 1 }));
    getUserList();
  }

  function changeTimeSort() {
    setParams((p) => ({ ...p, num: 1, timeSort: p.timeSort ? 0 : 1 }));
    getUserList();
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(users.filter((u) => u.type !== 0).map((u) => u.userId));
    } else {
      setSelectedIds([]);
    }
  }

  function toggleSelectOne(userId: number, checked: boolean) {
    setSelectedIds((ids) =>
      checked ? Array.from(new Set([...ids, userId])) : ids.filter((id) => id !== userId),
    );
  }

  const allSelected = useMemo(() => {
    const selectable = users.filter((u) => u.type !== 0);
    return selectable.length > 0 && selectable.every((u) => selectedIds.includes(u.userId));
  }, [users, selectedIds]);

  function openAdd() {
    setAddForm({
      email: '',
      suffix: domainList[0] || '',
      password: '',
      type: roleList[0]?.roleId ?? 0,
    });
    setShowAdd(true);
  }

  function submitAdd() {
    if (!addForm.email) {
      toast.error(t('emptyEmailMsg'));
      return;
    }
    if (!isEmail(addForm.email + addForm.suffix)) {
      toast.error(t('notEmailMsg'));
      return;
    }
    if (!addForm.password) {
      toast.error(t('emptyPwdMsg'));
      return;
    }
    if (addForm.password.length < 6) {
      toast.error(t('pwdLengthMsg'));
      return;
    }
    if (!addForm.type) {
      toast.error(t('emptyRole'));
      return;
    }
    setAddLoading(true);
    const form = { ...addForm, email: addForm.email + addForm.suffix };
    userAdd(form)
      .then(() => {
        toast.success(t('addSuccessMsg'));
        setAddForm({
          email: '',
          suffix: domainList[0] || '',
          password: '',
          type: roleList[0]?.roleId ?? 0,
        });
        getUserList(false);
      })
      .finally(() => setAddLoading(false));
  }

  function openSetPwd(user: any) {
    setUserForm({ userId: user.userId, password: '', type: user.type });
    setSetPwdShow(true);
  }

  function updatePwd() {
    if (!userForm.password) {
      toast.error(t('emptyPwdMsg'));
      return;
    }
    if (userForm.password.length < 6) {
      toast.error(t('pwdLengthMsg'));
      return;
    }
    setSettingLoading(true);
    userSetPwd({ userId: userForm.userId, password: userForm.password })
      .then(() => {
        setSetPwdShow(false);
        toast.success(t('saveSuccessMsg'));
      })
      .finally(() => setSettingLoading(false));
  }

  function openSetType(user: any) {
    setUserForm({ userId: user.userId, password: '', type: user.type });
    setSetTypeShow(true);
  }

  function saveType() {
    setSettingLoading(true);
    userSetType({ userId: userForm.userId, type: userForm.type })
      .then(() => {
        setUsers((us) =>
          us.map((u) => (u.userId === userForm.userId ? { ...u, type: userForm.type } : u)),
        );
        setSetTypeShow(false);
        toast.success(t('saveSuccessMsg'));
      })
      .finally(() => setSettingLoading(false));
  }

  function setStatus(user: any) {
    const status = user.status ? 0 : 1;
    userSetStatus({ status, userId: user.userId }).then(() => {
      user.status = status;
      setUsers((us) => [...us]);
      toast.success(t('saveSuccessMsg'));
    });
  }

  function delUser() {
    if (selectedIds.length === 0) return;
    setDelUsersOpen(true);
  }

  async function confirmDelUsers() {
    if (selectedIds.length === 0) return;
    setConfirmLoading(true);
    try {
      await userDelete(selectedIds);
      toast.success(t('delSuccessMsg'));
      setSelectedIds([]);
      getUserList(true);
    } catch {
      // axios already toasted
    } finally {
      setConfirmLoading(false);
      setDelUsersOpen(false);
    }
  }

  function restoreUser(user: any) {
    setRestoreTarget(user);
  }

  async function confirmRestore() {
    if (!restoreTarget) return;
    setConfirmLoading(true);
    try {
      await userRestore(restoreTarget.userId, 'normal');
      restoreTarget.isDel = 0;
      setUsers((us) => [...us]);
      toast.success(t('restoreSuccessMsg'));
    } catch {
      // axios already toasted
    } finally {
      setConfirmLoading(false);
      setRestoreTarget(null);
    }
  }

  function resetSendCount(user: any) {
    setResetSendTarget(user);
  }

  async function confirmResetSend() {
    if (!resetSendTarget) return;
    setConfirmLoading(true);
    try {
      await userRestSendCount(resetSendTarget.userId);
      resetSendTarget.sendCount = 0;
      setUsers((us) => [...us]);
      toast.success(t('reSuccessMsg'));
    } catch {
      // axios already toasted
    } finally {
      setConfirmLoading(false);
      setResetSendTarget(null);
    }
  }

  function openAccountList(userId: number) {
    setAccountParams({ num: 1, size: 10, total: 0, userId });
    setAccountList([]);
    setAccountShow(true);
    getAccountList(true);
  }

  function getAccountList(loading = false) {
    setAccountLoading(loading);
    userAllAccount(accountParams.userId, accountParams.num, accountParams.size)
      .then((data: any) => {
        setAccountList(data.list || []);
        setAccountParams((p) => ({ ...p, total: data.total || 0 }));
      })
      .finally(() => setAccountLoading(false));
  }

  function deleteAccount(account: any) {
    setDelAccountTarget(account);
  }

  async function confirmDelAccount() {
    if (!delAccountTarget) return;
    setConfirmLoading(true);
    try {
      await userDeleteAccount(delAccountTarget.accountId);
      getAccountList();
      toast.success(t('delSuccessMsg'));
    } catch {
      // axios already toasted
    } finally {
      setConfirmLoading(false);
      setDelAccountTarget(null);
    }
  }

  function openDetails(user: any) {
    setUserDetails(user);
    setDetailsShow(true);
  }

  function openAdminAdd() {
    setAdminAddForm({ email: '', suffix: domainList[0] || '', name: '' });
    setAdminAddOpen(true);
  }

  function submitAdminAdd() {
    const full = adminAddForm.email + adminAddForm.suffix;
    if (!adminAddForm.email || !isEmail(full)) {
      toast.error(t('notEmailMsg'));
      return;
    }
    setAdminAddLoading(true);
    adminAccountAdd(accountParams.userId, full, adminAddForm.name || undefined)
      .then(() => {
        toast.success(t('addSuccessMsg'));
        setAdminAddOpen(false);
        getAccountList();
      })
      .finally(() => setAdminAddLoading(false));
  }

  function openAdminRename(account: any) {
    setAdminRenameTarget(account);
    setAdminRenameValue(account.name ?? '');
  }

  function submitAdminRename() {
    if (!adminRenameTarget) return;
    setAdminRenameLoading(true);
    adminAccountRename(adminRenameTarget.accountId, adminRenameValue)
      .then(() => {
        toast.success(t('saveSuccessMsg'));
        setAdminRenameTarget(null);
        getAccountList();
      })
      .finally(() => setAdminRenameLoading(false));
  }

  function toRoleName(type: number) {
    if (type === 0) return t('admin');
    const r = roleList.find((rl) => rl.roleId === type);
    return r?.name ?? '';
  }

  function statusLabel(user: any) {
    if (user.isDel === 1) return t('restore');
    if (user.status === 0) return t('btnBan');
    return t('enable');
  }

  return (
    <div className="user-box">
      <div className="header-actions">
        <Icon
          className="icon"
          icon="ion:add-outline"
          width="23"
          height="23"
          onClick={openAdd}
          style={{ cursor: 'pointer' }}
        />
        <Input
          value={params.email}
          onChange={(e) => setParams((p) => ({ ...p, email: e.target.value }))}
          placeholder={t('searchByEmail')}
          className="search-input max-w-[200px] h-7"
        />
        <Select
          value={String(params.status)}
          onValueChange={(v) => setParams((p) => ({ ...p, status: Number(v) }))}
        >
          <SelectTrigger className="w-[90px] h-7">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="-1">{t('all')}</SelectItem>
            <SelectItem value="0">{t('active')}</SelectItem>
            <SelectItem value="1">{t('banned')}</SelectItem>
            <SelectItem value="-2">{t('deleted')}</SelectItem>
          </SelectContent>
        </Select>
        <Icon
          className="icon"
          icon="iconoir:search"
          width="20"
          height="20"
          style={{ cursor: 'pointer' }}
          onClick={search}
        />
        <Icon
          className="icon"
          icon={
            params.timeSort === 1
              ? 'material-symbols-light:timer-arrow-up-outline'
              : 'material-symbols-light:timer-arrow-down-outline'
          }
          width="28"
          height="28"
          style={{ cursor: 'pointer' }}
          onClick={changeTimeSort}
        />
        <Icon
          className="icon"
          icon="ion:reload"
          width="18"
          height="18"
          style={{ cursor: 'pointer' }}
          onClick={refresh}
        />
        <Icon
          className="icon"
          icon="uiw:delete"
          width="16"
          height="16"
          style={{ cursor: 'pointer' }}
          onClick={delUser}
        />
      </div>
      <div className="scrollbar">
        <div
          className={`loading-overlay ${
            tableLoading ? 'loading-show' : first ? 'loading-transparent' : 'loading-hide'
          }`}
        >
          <Loading />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead style={{ width: 40 }}>
                <Checkbox
                  checked={!!allSelected}
                  indeterminate={!allSelected && selectedIds.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="min-w-[230px]">{t('tabEmailAddress')}</TableHead>
              <TableHead className="w-[100px]">{t('tabReceived')}</TableHead>
              <TableHead className="w-[100px]">{t('tabSent')}</TableHead>
              <TableHead className="w-[100px]">{t('tabMailboxes')}</TableHead>
              <TableHead className="min-w-[160px]">{t('tabRegisteredAt')}</TableHead>
              <TableHead className="w-[80px]">{t('tabStatus')}</TableHead>
              <TableHead className="min-w-[140px]">{t('tabRole')}</TableHead>
              <TableHead className="w-[100px]">{t('tabSetting')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.userId}>
                <TableCell>
                  <Checkbox
                    disabled={u.type === 0}
                    checked={selectedIds.includes(u.userId)}
                    onCheckedChange={(v: boolean) => toggleSelectOne(u.userId, v)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 items-center">
                    <span className="email-row">{u.email}</span>
                    {u.username ? <Badge variant="outline">L</Badge> : null}
                  </div>
                </TableCell>
                <TableCell>{u.receiveEmailCount}</TableCell>
                <TableCell>{u.sendEmailCount}</TableCell>
                <TableCell>{u.accountCount}</TableCell>
                <TableCell>{tzDayjs(u.createTime).format('YYYY-MM-DD HH:mm')}</TableCell>
                <TableCell>
                  {u.isDel === 1 ? (
                    <Badge variant="secondary">{t('deleted')}</Badge>
                  ) : u.status === 0 ? (
                    <Badge>{t('active')}</Badge>
                  ) : (
                    <Badge variant="destructive">{t('banned')}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="type">{toRoleName(u.type)}</div>
                </TableCell>
                <TableCell>
                  {u.type === 0 && userStore.user?.type !== 0 ? (
                    <Button size="sm">{t('action')}</Button>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm">{t('action')}</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => openSetPwd(u)}>
                          {t('chgPwd')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openSetType(u)}>
                          {t('perm')}
                        </DropdownMenuItem>
                        {u.type !== 0 &&
                          (u.isDel !== 1 ? (
                            <DropdownMenuItem onClick={() => setStatus(u)}>
                              {statusLabel(u)}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => restoreUser(u)}>
                              {t('restore')}
                            </DropdownMenuItem>
                          ))}
                        <DropdownMenuItem onClick={() => openAccountList(u.userId)}>
                          {t('account')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openDetails(u)}>
                          {t('details')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {total > 10 && (
          <div className="pagination">
            <div className="flex items-center justify-end gap-2 text-sm">
              <Button
                size="sm"
                variant="outline"
                disabled={params.num === 1}
                onClick={() => {
                  setParams((p) => ({ ...p, num: Math.max(1, p.num - 1) }));
                  getUserList();
                }}
              >
                ‹
              </Button>
              <span>
                {params.num} / {Math.max(1, Math.ceil(total / params.size))}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={params.num >= Math.ceil(total / params.size)}
                onClick={() => {
                  setParams((p) => ({ ...p, num: p.num + 1 }));
                  getUserList();
                }}
              >
                ›
              </Button>
              <Select
                value={String(params.size)}
                onValueChange={(v) => {
                  setParams((p) => ({ ...p, size: Number(v) }));
                  getUserList();
                }}
              >
                <SelectTrigger className="w-[80px] h-7">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 15, 20, 25, 30, 50].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground">{total}</span>
            </div>
          </div>
        )}
      </div>

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addUser')}</DialogTitle>
          </DialogHeader>
          <div className="container">
            <div className="flex">
              <Input
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                type="text"
                placeholder={t('emailAccount')}
                autoComplete="off"
                className="rounded-r-none"
              />
              <Select
                value={addForm.suffix}
                onValueChange={(v) => setAddForm((f) => ({ ...f, suffix: v }))}
              >
                <SelectTrigger className="w-[120px] rounded-l-none border-l-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {domainList.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              type="password"
              value={addForm.password}
              onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
              placeholder={t('password')}
            />
            <Select
              value={String(addForm.type)}
              onValueChange={(v) => setAddForm((f) => ({ ...f, type: Number(v) }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('perm')} />
              </SelectTrigger>
              <SelectContent>
                {roleList.map((r) => (
                  <SelectItem key={r.roleId} value={String(r.roleId)}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={submitAdd} disabled={addLoading}>
              {t('add')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password dialog */}
      <Dialog open={setPwdShow} onOpenChange={setSetPwdShow}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('changePassword')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="password"
              placeholder={t('newPassword')}
              autoComplete="off"
              value={userForm.password}
              onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))}
            />
            <Button onClick={updatePwd} disabled={settingLoading} className="w-full">
              {t('save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Type dialog */}
      <Dialog open={setTypeShow} onOpenChange={setSetTypeShow}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('changePerm')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {userForm.type === 0 ? (
              <Input disabled value={t('admin')} />
            ) : (
              <Select
                value={String(userForm.type)}
                onValueChange={(v) => setUserForm((f) => ({ ...f, type: Number(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleList.map((r) => (
                    <SelectItem key={r.roleId} value={String(r.roleId)}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              onClick={saveType}
              disabled={userForm.type === 0 || settingLoading}
              className="w-full"
            >
              {t('save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Account list dialog */}
      <Dialog open={accountShow} onOpenChange={setAccountShow}>
        <DialogContent className="max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('userAccount')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {accountLoading ? (
              <Loading />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('emailAccount')}</TableHead>
                    <TableHead className="w-[80px]">{t('tabStatus')}</TableHead>
                    <TableHead className="w-[80px]">{t('action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accountList.map((a) => (
                    <TableRow key={a.accountId}>
                      <TableCell>
                        <span className="email-row">{a.email}</span>
                      </TableCell>
                      <TableCell>
                        {a.isDel === 0 ? (
                          <Badge>{t('active')}</Badge>
                        ) : (
                          <Badge variant="secondary">{t('deleted')}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm">{t('action')}</Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => openAdminRename(a)}>
                              {t('rename')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => deleteAccount(a)}>
                              {t('delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="flex items-center justify-between gap-2">
              <Button size="sm" variant="outline" onClick={openAdminAdd}>
                <Icon icon="ion:add-outline" width="14" height="14" className="mr-1" />
                {t('adminAddMailbox')}
              </Button>
              <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={accountParams.num <= 1}
                onClick={() => {
                  setAccountParams((p) => ({ ...p, num: Math.max(1, p.num - 1) }));
                  getAccountList();
                }}
              >
                ‹
              </Button>
              <span className="text-sm leading-8">
                {accountParams.num} / {Math.max(1, Math.ceil(accountParams.total / accountParams.size))}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={accountParams.num >= Math.ceil(accountParams.total / accountParams.size)}
                onClick={() => {
                  setAccountParams((p) => ({ ...p, num: p.num + 1 }));
                  getAccountList();
                }}
              >
                ›
              </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin: add mailbox dialog */}
      <Dialog open={adminAddOpen} onOpenChange={(o) => !adminAddLoading && setAdminAddOpen(o)}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t('adminAddMailbox')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex">
              <Input
                value={adminAddForm.email}
                onChange={(e) => setAdminAddForm((f) => ({ ...f, email: e.target.value }))}
                placeholder={t('emailAccount')}
                autoComplete="off"
                className="rounded-r-none"
              />
              <Select
                value={adminAddForm.suffix}
                onValueChange={(v) => setAdminAddForm((f) => ({ ...f, suffix: v }))}
              >
                <SelectTrigger className="w-[120px] rounded-l-none border-l-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {domainList.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              value={adminAddForm.name}
              onChange={(e) => setAdminAddForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('rename') + ' (' + t('optional') + ')'}
              maxLength={30}
            />
            <Button onClick={submitAdminAdd} disabled={adminAddLoading} className="w-full">
              {adminAddLoading ? t('saving') : t('add')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin: rename mailbox dialog */}
      <Dialog
        open={!!adminRenameTarget}
        onOpenChange={(o) => !adminRenameLoading && !o && setAdminRenameTarget(null)}
      >
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t('adminRenameMailbox')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={adminRenameTarget?.email ?? ''} disabled />
            <Input
              value={adminRenameValue}
              onChange={(e) => setAdminRenameValue(e.target.value)}
              maxLength={30}
              placeholder={t('rename')}
            />
            <Button onClick={submitAdminRename} disabled={adminRenameLoading} className="w-full">
              {adminRenameLoading ? t('saving') : t('save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Details dialog */}
      <Dialog open={detailsShow} onOpenChange={setDetailsShow}>
        <DialogContent className="max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('userDetails')}</DialogTitle>
          </DialogHeader>
          <div className="details space-y-2 text-sm">
            {userDetails.username && (
              <div className="flex items-center gap-2">
                <span className="details-item-title">LinuxDo:</span>
                <span>
                  {t('user')}: {userDetails.username}
                </span>
                <Badge variant="default">{userDetails.trustLevel}</Badge>
              </div>
            )}
            <div>
              <span className="details-item-title">{t('tabSent')}:</span>
              {userDetails.sendEmailCount}
            </div>
            <div>
              <span className="details-item-title">{t('tabMailboxes')}:</span>
              {userDetails.accountCount}
            </div>
            <div>
              <span className="details-item-title">{t('tabRegisteredAt')}:</span>
              {tzDayjs(userDetails.createTime).format('YYYY-MM-DD HH:mm')}
            </div>
            <div>
              <span className="details-item-title">{t('perm')}:</span>
              {toRoleName(userDetails.type)}
            </div>
            <div>
              <span className="details-item-title">{t('tabStatus')}:</span>
              {userDetails.isDel === 1 ? (
                <Badge variant="secondary">{t('deleted')}</Badge>
              ) : userDetails.status === 0 ? (
                <Badge>{t('active')}</Badge>
              ) : (
                <Badge variant="destructive">{t('banned')}</Badge>
              )}
            </div>
            <div>
              <span className="details-item-title">{t('registrationIp')}:</span>
              {userDetails.createIp || t('unknown')}
            </div>
            <div>
              <span className="details-item-title">{t('recentIP')}:</span>
              {userDetails.activeIp || t('unknown')}
            </div>
            <div>
              <span className="details-item-title">{t('recentActivity')}:</span>
              {userDetails.activeTime
                ? tzDayjs(userDetails.activeTime).format('YYYY-MM-DD')
                : t('unknown')}
            </div>
            <div>
              <span className="details-item-title">{t('loginDevice')}:</span>
              {userDetails.device || t('unknown')}
            </div>
            <div>
              <span className="details-item-title">{t('loginSystem')}:</span>
              {userDetails.os || t('unknown')}
            </div>
            <div>
              <span className="details-item-title">{t('browserLogin')}:</span>
              {userDetails.browser || t('unknown')}
            </div>
            <div className="flex items-center gap-2">
              <span className="details-item-title">{t('sendEmail')}:</span>
              <span>
                {userDetails.sendAction?.hasPerm
                  ? userDetails.sendCount +
                    '/' +
                    (userDetails.sendAction?.sendCount || t('unlimited'))
                  : t('unauthorized')}
              </span>
              {userDetails.sendAction?.hasPerm && userDetails.sendAction?.sendCount ? (
                <Button size="sm" onClick={() => resetSendCount(userDetails)}>
                  {t('reset')}
                </Button>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmAction
        open={delUsersOpen}
        onOpenChange={(o) => !confirmLoading && !o && setDelUsersOpen(false)}
        title={t('delUsers')}
        description={t('delUsersConfirm')}
        confirmText={t('delete')}
        cancelText={t('cancel')}
        destructive
        loading={confirmLoading}
        onConfirm={confirmDelUsers}
      />

      <ConfirmAction
        open={!!restoreTarget}
        onOpenChange={(o) => !confirmLoading && !o && setRestoreTarget(null)}
        title={t('restore')}
        description={t('restoreConfirm', { msg: restoreTarget?.email ?? '' })}
        confirmText={t('restore')}
        cancelText={t('cancel')}
        loading={confirmLoading}
        onConfirm={confirmRestore}
      />

      <ConfirmAction
        open={!!resetSendTarget}
        onOpenChange={(o) => !confirmLoading && !o && setResetSendTarget(null)}
        title={t('resetSendCount')}
        description={t('reSendConfirm', { msg: resetSendTarget?.email ?? '' })}
        confirmText={t('reset')}
        cancelText={t('cancel')}
        loading={confirmLoading}
        onConfirm={confirmResetSend}
      />

      <ConfirmAction
        open={!!delAccountTarget}
        onOpenChange={(o) => !confirmLoading && !o && setDelAccountTarget(null)}
        title={t('delAccount')}
        description={t('delConfirm', { msg: delAccountTarget?.email ?? '' })}
        confirmText={t('delete')}
        cancelText={t('cancel')}
        destructive
        loading={confirmLoading}
        onConfirm={confirmDelAccount}
      />
    </div>
  );
}
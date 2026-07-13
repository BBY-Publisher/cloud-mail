import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@iconify/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
  roleAdd,
  roleDelete,
  rolePermTree,
  roleRoleList,
  roleSet,
  roleSetDef,
} from '@/request/role';
import { useRoleStore } from '@/store/role';
import { useUserStore } from '@/store/user';
import { useSettingStore } from '@/store/setting';
import { isDomain, isEmail } from '@/utils/verify-utils';

interface TreeNode {
  permId: number;
  name: string;
  permKey: string;
  children?: TreeNode[];
}

export default function RoleView() {
  const { t } = useTranslation();
  const roleStore = useRoleStore();
  const userStore = useUserStore();
  void useSettingStore((s) => s.domainList);

  const [roles, setRoles] = useState<any[]>([]);
  const [treeList, setTreeList] = useState<TreeNode[]>([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [first, setFirst] = useState(true);
  const [roleFormShow, setRoleFormShow] = useState(false);
  const [permLoading, setPermLoading] = useState(false);
  const [dialogType, setDialogType] = useState<{ title: string; type: 'add' | 'set' }>({
    title: '',
    type: 'add',
  });
  const [expand, setExpand] = useState(false);
  const chooseRole = useRef<any>({});
  const checkedKeys = useRef<Set<number>>(new Set());

  const [delTarget, setDelTarget] = useState<any>(null);
  const [delLoading, setDelLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    banEmail: [] as string[],
    sendType: 'count',
    sendCount: 0,
    accountCount: 0,
    sort: 0,
    isDefault: 0,
    availDomain: [] as string[],
  });

  useEffect(() => {
    void rolePermTree().then(setTreeList);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refresh() {
    setTableLoading(true);
    getRoleList();
  }

  function getRoleList() {
    roleRoleList()
      .then(setRoles)
      .finally(() => {
        setTableLoading(false);
        setTimeout(() => setFirst(false), 200);
      });
  }

  function toggleNode(node: TreeNode, checked: boolean) {
    const allIds = collectIds(node);
    if (checked) {
      allIds.forEach((id) => checkedKeys.current.add(id));
    } else {
      allIds.forEach((id) => checkedKeys.current.delete(id));
    }
    // also remove/add all ancestor ids when descendants checked/unchecked
    if (checked) {
      let cur = findParent(treeList, node.permId);
      while (cur) {
        checkedKeys.current.add(cur.permId);
        cur = findParent(treeList, cur.permId);
      }
    }
    forceRefresh();
  }

  function forceRefresh() {
    setTreeList((prev) => [...prev]);
  }

  function collectIds(node: TreeNode): number[] {
    const ids = [node.permId];
    if (node.children) for (const c of node.children) ids.push(...collectIds(c));
    return ids;
  }

  function findParent(list: TreeNode[], id: number): TreeNode | null {
    for (const n of list) {
      if (n.children?.some((c) => c.permId === id)) return n;
      const f = findParent(n.children || [], id);
      if (f) return f;
    }
    return null;
  }

  function isChecked(id: number): boolean {
    return checkedKeys.current.has(id);
  }

  function setDef(role: any) {
    roleSetDef(role.roleId).then(() => {
      toast.success(t('saveSuccessMsg'));
      getRoleList();
    });
  }

  function delRole(role: any) {
    setDelTarget(role);
  }

  async function confirmDel() {
    if (!delTarget) return;
    setDelLoading(true);
    try {
      await roleDelete(delTarget.roleId);
      toast.success(t('copySuccessMsg'));
      getRoleList();
      userStore.refreshUserList();
      roleStore.refreshSelect();
    } catch {
      // axios already toasted
    } finally {
      setDelLoading(false);
      setDelTarget(null);
    }
  }

  function resetForm() {
    setForm({
      name: '',
      description: '',
      sort: 0,
      sendType: 'count',
      sendCount: 0,
      accountCount: 0,
      banEmail: [],
      availDomain: [],
      isDefault: 0,
    });
    checkedKeys.current.clear();
    forceRefresh();
  }

  function openRoleSet(role: any) {
    chooseRole.current = role;
    setDialogType({ title: t('changeRoleTitle'), type: 'set' });
    setForm({
      name: role.name,
      description: role.description,
      sort: role.sort,
      sendType: role.sendType,
      sendCount: role.sendCount,
      accountCount: role.accountCount,
      banEmail: role.banEmail || [],
      availDomain: role.availDomain || [],
      isDefault: role.isDefault,
    });
    checkedKeys.current = new Set(role.permIds || []);
    forceRefresh();
    setRoleFormShow(true);
  }

  function openAddRole() {
    setDialogType({ title: t('addRoleTitle'), type: 'add' });
    resetForm();
    setRoleFormShow(true);
  }

  function banEmailAddTag(val: string) {
    const items = Array.from(
      new Set(val.split(/[,，]/).map((s) => s.trim()).filter(Boolean)),
    );
    setForm((f) => ({
      ...f,
      banEmail: f.banEmail.slice(0, f.banEmail.length ? f.banEmail.length - 1 : 0),
    }));
    setForm((f) => {
      const next = [...f.banEmail];
      items.forEach((email) => {
        if ((isEmail(email) || isDomain(email) || email === '*') && !next.includes(email)) {
          next.push(email);
        }
      });
      return { ...f, banEmail: next };
    });
  }

  async function roleFormClick() {
    if (dialogType.type === 'add') return addRole();
    return setRole();
  }

  function setRole() {
    if (!form.name) {
      toast.error(t('emptyRoleNameMsg'));
      return;
    }
    const params: any = { ...form, roleId: chooseRole.current.roleId };
    params.permIds = Array.from(checkedKeys.current);
    setPermLoading(true);
    roleSet(params)
      .then(() => {
        toast.success(t('saveSuccessMsg'));
        const names = roles.map((r) => r.name);
        if (!names.includes(params.name)) roleStore.refreshSelect();
        setRoleFormShow(false);
        getRoleList();
      })
      .finally(() => setPermLoading(false));
  }

  function addRole() {
    const params: any = { ...form };
    params.permIds = Array.from(checkedKeys.current);
    setPermLoading(true);
    roleAdd(params)
      .then(() => {
        toast.success(t('addSuccessMsg'));
        setRoleFormShow(false);
        getRoleList();
        roleStore.refreshSelect();
      })
      .finally(() => setPermLoading(false));
  }

  return (
    <div className="perm-box">
      <div className="header-actions">
        <Icon
          className="icon"
          icon="ion:add-outline"
          width="23"
          height="23"
          onClick={openAddRole}
          style={{ cursor: 'pointer' }}
        />
        <Icon
          className="icon"
          icon="ion:reload"
          width="18"
          height="18"
          onClick={refresh}
          style={{ cursor: 'pointer' }}
        />
      </div>
      <div className="perm-scrollbar relative">
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
              <TableHead style={{ width: 10 }} />
              <TableHead className="min-w-[180px]">{t('role')}</TableHead>
              <TableHead className="w-[80px]">{t('order')}</TableHead>
              <TableHead className="min-w-[200px]">{t('description')}</TableHead>
              <TableHead className="w-[100px]">{t('tabSetting')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.length === 0 && !tableLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center">
                  <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                    <Icon icon="lucide:shield" width="20" height="20" />
                    <div className="text-[13px] font-medium text-foreground">
                      {t('noRoleFound')}
                    </div>
                    <div className="text-[12px]">{t('noRoleFoundDesc')}</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : null}
            {roles.map((row) => (
              <TableRow key={row.roleId}>
                <TableCell />
                <TableCell>
                  <div className="role-name flex items-center gap-2">
                    <span>{row.name}</span>
                    {row.isDefault ? (
                      <Badge variant="outline" className="def-tag">
                        {t('default')}
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>{row.sort}</TableCell>
                <TableCell>
                  <div className="description">{row.description}</div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm">{t('action')}</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => openRoleSet(row)}>
                        {t('change')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDef(row)}>
                        {t('default')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => delRole(row)}>
                        {t('delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={roleFormShow} onOpenChange={(o) => (!o ? setRoleFormShow(false) : null)}>
        <DialogContent className="dialog max-w-[460px]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle>{dialogType.title}</DialogTitle>
              <Popover>
                <PopoverTrigger asChild>
                  <Icon
                    className="warning"
                    icon="fe:warning"
                    width="18"
                    height="18"
                    style={{ cursor: 'pointer', color: 'gray' }}
                  />
                </PopoverTrigger>
                <PopoverContent>
                  <div style={{ fontWeight: 'bold', marginBottom: 2 }}>
                    {t('emailInterception')}
                  </div>
                  <div>{t('emailInterceptionDesc')}</div>
                  <div style={{ fontWeight: 'bold', marginTop: 10, marginBottom: 2 }}>
                    {t('availableDomains')}
                  </div>
                  <div>{t('availableDomainsDesc')}</div>
                </PopoverContent>
              </Popover>
            </div>
          </DialogHeader>
          <div className="dialog-box space-y-3">
            <Input
              value={form.name}
              maxLength={12}
              placeholder={t('roleName')}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              value={form.description}
              maxLength={30}
              placeholder={t('description')}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <Input
              placeholder={t('emailInterception')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  banEmailAddTag((e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).value = '';
                }
              }}
              onBlur={(e) => {
                if (e.target.value) {
                  banEmailAddTag(e.target.value);
                  e.target.value = '';
                }
              }}
            />
            {form.banEmail.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {form.banEmail.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1">
                    {email}
                    <Icon
                      icon="material-symbols-light:close-rounded"
                      width="12"
                      height="12"
                      className="cursor-pointer"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          banEmail: f.banEmail.filter((e) => e !== email),
                        }))
                      }
                    />
                  </Badge>
                ))}
              </div>
            )}
            <Select
              value={form.sendType}
              onValueChange={(v) => setForm({ ...form, sendType: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="count">{t('total')}</SelectItem>
                <SelectItem value="day">{t('daily')}</SelectItem>
                <SelectItem value="internal">{t('internal')}</SelectItem>
                <SelectItem value="ban">{t('btnBan')}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder={t('order')}
              value={form.sort}
              onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })}
            />
            <RadioGroup
              value={expand ? 'true' : 'false'}
              onValueChange={(v) => setExpand(v === 'true')}
              className="flex gap-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="true" id="exp" />
                <label htmlFor="exp">{t('expand')}</label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="false" id="col" />
                <label htmlFor="col">{t('collapse')}</label>
              </div>
            </RadioGroup>
            <div className="perm-tree max-h-[280px] overflow-auto rounded-md border p-2">
              {treeList.map((node) => (
                <TreeNodeView
                  key={node.permId}
                  node={node}
                  depth={0}
                  expand={expand}
                  isChecked={isChecked}
                  onToggle={toggleNode}
                  form={form}
                  setForm={setForm}
                  t={t}
                />
              ))}
            </div>
            <Button onClick={roleFormClick} disabled={permLoading} className="w-full">
              {t('save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmAction
        open={!!delTarget}
        onOpenChange={(o) => !delLoading && !o && setDelTarget(null)}
        title={t('delRoleTitle')}
        description={t('delConfirm', { msg: delTarget?.name ?? '' })}
        confirmText={t('delete')}
        cancelText={t('cancel')}
        destructive
        loading={delLoading}
        onConfirm={confirmDel}
      />
    </div>
  );
}

function TreeNodeView({
  node,
  depth,
  expand,
  isChecked,
  onToggle,
  form,
  setForm,
  t,
}: {
  node: TreeNode;
  depth: number;
  expand: boolean;
  isChecked: (id: number) => boolean;
  onToggle: (n: TreeNode, c: boolean) => void;
  form: any;
  setForm: any;
  t: any;
}) {
  const [open, setOpen] = useState(expand);
  useEffect(() => setOpen(expand), [expand]);
  const checked = isChecked(node.permId);
  return (
    <div>
      <div className="flex items-center gap-2 py-1" style={{ paddingLeft: depth * 16 }}>
        {node.children?.length ? (
          <Icon
            icon={open ? 'mdi:chevron-down' : 'mdi:chevron-right'}
            width="14"
            height="14"
            className="cursor-pointer"
            onClick={() => setOpen((o) => !o)}
          />
        ) : (
          <span style={{ width: 14, display: 'inline-block' }} />
        )}
        <Checkbox checked={checked} onCheckedChange={(v) => onToggle(node, !!v)} />
        <span className="text-sm">{node.name}</span>
        {node.permKey === 'email:send' && (
          <span className="ml-auto flex items-center gap-1">
            <Input
              type="number"
              placeholder={t('total')}
              value={form.sendCount}
              onChange={(e) => setForm({ ...form, sendCount: Number(e.target.value) })}
              className="h-7 w-[80px]"
              disabled={form.sendType !== 'day' && form.sendType !== 'count'}
            />
          </span>
        )}
        {node.permKey === 'account:add' && (
          <Input
            type="number"
            placeholder={t('total')}
            value={form.accountCount}
            onChange={(e) => setForm({ ...form, accountCount: Number(e.target.value) })}
            className="ml-auto h-7 w-[80px]"
          />
        )}
      </div>
      {open && node.children?.map((child) => (
        <TreeNodeView
          key={child.permId}
          node={child}
          depth={depth + 1}
          expand={expand}
          isChecked={isChecked}
          onToggle={onToggle}
          form={form}
          setForm={setForm}
          t={t}
        />
      ))}
    </div>
  );
}
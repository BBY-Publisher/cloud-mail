import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@iconify/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import Loading from '@/components/loading';
import { roleSelectUse } from '@/request/role';
import {
  regKeyAdd,
  regKeyList,
  regKeyClearNotUse,
  regKeyDelete,
  regKeyHistory,
} from '@/request/reg-key';
import { useRoleStore } from '@/store/role';
import { useSettingStore } from '@/store/setting';
import { tzDayjs } from '@/utils/day';
import dayjs from 'dayjs';

export default function RegKeyView() {
  const { t } = useTranslation();
  const roleStore = useRoleStore();
  const lang = useSettingStore((s) => s.lang);
  void roleStore;

  const [params, setParams] = useState({ code: '' });
  const [roleList, setRoleList] = useState<any[]>([]);
  const [regKeyData, setRegKeyData] = useState<any[]>([]);
  const [regKeyLoading, setRegKeyLoading] = useState(true);
  const [regKeyFirst, setRegKeyFirst] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addForm, setAddForm] = useState({
    code: '',
    count: 1,
    roleId: 0 as number,
    expireTime: null as any,
  });

  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [delConfirmShow, setDelConfirmShow] = useState(false);
  const [delCode, setDelCode] = useState('');

  const [clearConfirmShow, setClearConfirmShow] = useState(false);

  useEffect(() => {
    roleSelectUse().then(setRoleList);
    getList(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getList(showLoading = false) {
    if (showLoading) setRegKeyLoading(true);
    regKeyList(params)
      .then((data: any) => {
        setRegKeyData(Array.isArray(data) ? data : data.list || []);
      })
      .finally(() => {
        setRegKeyLoading(false);
        setTimeout(() => setRegKeyFirst(false), 200);
      });
  }

  function refresh() {
    setParams({ code: '' });
    getList(true);
  }

  function search() {
    getList(true);
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(t('copySuccessMsg'));
    } catch {
      toast.error('复制失败');
    }
  }

  function genCode() {
    setAddForm((f) => ({ ...f, code: generateRandomCode() }));
  }

  function generateRandomCode(length = 8): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  function openAdd() {
    setAddForm((f) => ({ ...f, code: generateRandomCode(), roleId: roleList[0]?.roleId || 0, expireTime: null, count: 1 }));
    setShowAdd(true);
  }

  function submit() {
    if (!addForm.code) {
      toast.error(t('emptyRegKeyMsg'));
      return;
    }
    if (!addForm.roleId) {
      toast.error(t('emptyRole'));
      return;
    }
    if (!addForm.expireTime) {
      toast.error(t('emptyTimeMsg'));
      return;
    }
    if (!addForm.count) {
      toast.error(t('emptyCountMsg'));
      return;
    }
    setAddLoading(true);
    const submitForm: any = {
      ...addForm,
      expireTime: addForm.expireTime
        ? (typeof addForm.expireTime === 'number'
          ? addForm.expireTime
          : dayjs(addForm.expireTime).valueOf())
        : null,
    };
    regKeyAdd(submitForm)
      .then(() => {
        setShowAdd(false);
        toast.success(t('addSuccessMsg'));
        getList();
      })
      .finally(() => setAddLoading(false));
  }

  function openHistory(regKey: any) {
    setHistoryList([]);
    setHistoryLoading(true);
    setShowHistory(true);
    regKeyHistory(regKey.regKeyId)
      .then(setHistoryList)
      .finally(() => setHistoryLoading(false));
  }

  function formatExpireTime(expireTime: number) {
    const d = tzDayjs(expireTime);
    const currentYear = dayjs().year();
    if (lang === 'en') {
      return d.year() === currentYear ? d.format('MMM D') : d.format('MMM D, YYYY');
    }
    return d.year() === currentYear ? d.format('M月D日') : d.format('YYYY年M月D日');
  }

  function formatCreateTime(regKey: any) {
    const d = tzDayjs(regKey.createTime);
    const currentYear = dayjs().year();
    if (lang === 'en') {
      return d.year() === currentYear ? d.format('MMM D, HH:mm') : d.format('MMM D, YYYY HH:mm');
    }
    return d.year() === currentYear ? d.format('M月D日 HH:mm') : d.format('YYYY年M月D日 HH:mm');
  }

  function deleteRegKey(regKey: any) {
    setDelCode(regKey.code);
    setDelConfirmShow(true);
  }

  function doDelete() {
    if (!delCode) return;
    regKeyDelete([regKeyData.find((r) => r.code === delCode)?.regKeyId].filter(Boolean) as number[])
      .then(() => {
        toast.success(t('delSuccessMsg'));
        getList();
      });
    setDelCode('');
  }

  function clearNotUse() {
    setClearConfirmShow(true);
  }

  function doClear() {
    regKeyClearNotUse().then(() => {
      toast.success(t('clearSuccess'));
      getList();
    });
  }

  return (
    <div className="reg-key">
      <div className="header-actions">
        <Icon
          className="icon"
          icon="ion:add-outline"
          width="23"
          height="23"
          style={{ cursor: 'pointer' }}
          onClick={openAdd}
        />
        <Input
          value={params.code}
          onChange={(e) => setParams({ code: e.target.value })}
          placeholder={t('searchRegKeyDesc')}
          className="search-input max-w-[200px] h-7"
        />
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
          icon="ion:reload"
          width="18"
          height="18"
          style={{ cursor: 'pointer' }}
          onClick={refresh}
        />
        <Icon
          className="icon"
          icon="fluent:broom-sparkle-16-regular"
          width="22"
          height="22"
          style={{ cursor: 'pointer' }}
          onClick={clearNotUse}
        />
      </div>
      <div className="scrollbar relative">
        <div
          className={`loading-overlay ${
            regKeyLoading ? 'loading-show' : regKeyFirst ? 'loading-transparent' : 'loading-hide'
          }`}
        >
          <Loading />
        </div>
        <div className="code-box">
          {regKeyData.length === 0 && !regKeyLoading ? (
            <div className="col-span-full py-8">
              <EmptyState
                icon="lucide:ticket"
                title={t('noRegKeyFound')}
                description={t('noRegKeyFoundDesc')}
              />
            </div>
          ) : null}
          {regKeyData.map((item) => (
            <div className="code-item" key={item.regKeyId}>
              <div className="code-info">
                <div className="info-left">
                  <div className="info-left-item">
                    <span className="code" onClick={() => copyCode(item.code)}>
                      {item.code}
                    </span>
                  </div>
                  <div className="info-left-item">
                    <div>{t('remainingUses')}:</div>
                    {item.count ? (
                      <div>{item.count}</div>
                    ) : (
                      <Badge variant="destructive">{t('exhausted')}</Badge>
                    )}
                  </div>
                  <div className="info-left-item">
                    <div>{t('roleDesc')}:</div>
                    <Badge variant="outline">{item.roleName}</Badge>
                  </div>
                  <div className="info-left-item">
                    <div>{t('validUntil')}:</div>
                    {item.expireTime ? (
                      <div>{formatExpireTime(item.expireTime)}</div>
                    ) : (
                      <Badge variant="destructive">{t('expired')}</Badge>
                    )}
                  </div>
                </div>
                <div className="info-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Icon
                        icon="fluent:settings-24-filled"
                        width="21"
                        height="21"
                        color="#909399"
                        style={{ cursor: 'pointer' }}
                      />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => copyCode(item.code)}>
                        {t('copy')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openHistory(item)}>
                        {t('history')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => deleteRegKey(item)}>
                        {t('delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addRegKey')}</DialogTitle>
          </DialogHeader>
          <div className="container space-y-3">
            <div className="relative">
              <Input
                value={addForm.code}
                onChange={(e) => setAddForm((f) => ({ ...f, code: e.target.value }))}
                placeholder={t('regKey')}
              />
              <Icon
                onClick={genCode}
                icon="bitcoin-icons:refresh-filled"
                width="22"
                height="22"
                style={{ cursor: 'pointer', position: 'absolute', right: 8, top: 8, color: '#606266' }}
              />
            </div>
            <Select
              value={String(addForm.roleId)}
              onValueChange={(v) => setAddForm((f) => ({ ...f, roleId: Number(v) }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('roleDesc')} />
              </SelectTrigger>
              <SelectContent>
                {roleList.map((r) => (
                  <SelectItem key={r.roleId} value={String(r.roleId)}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={
                addForm.expireTime
                  ? dayjs(addForm.expireTime).format('YYYY-MM-DD')
                  : ''
              }
              onChange={(e) => {
                const v = e.target.value;
                setAddForm((f) => ({
                  ...f,
                  expireTime: v ? dayjs(v).valueOf() : null,
                }));
              }}
              placeholder={t('validUntil')}
            />
            <Input
              type="number"
              min={1}
              max={99999}
              value={addForm.count}
              onChange={(e) => setAddForm((f) => ({ ...f, count: Number(e.target.value) }))}
            />
            <Button onClick={submit} disabled={addLoading} className="w-full">
              {t('add')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('useHistory')}</DialogTitle>
          </DialogHeader>
          <div className="relative min-h-[200px]">
            {historyLoading ? (
              <Loading />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">{t('user')}</TableHead>
                    <TableHead className="w-[160px]">{t('date')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyList.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell>{h.email}</TableCell>
                      <TableCell>{formatCreateTime(h)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={delConfirmShow} onOpenChange={setDelConfirmShow}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delConfirm', { msg: delCode })}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDelCode('')}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete}>{t('confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearConfirmShow} onOpenChange={setClearConfirmShow}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('clearRegKey')}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={doClear}>{t('confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
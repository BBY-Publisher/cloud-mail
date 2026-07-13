import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmAction } from '@/components/confirm-action';
import { fromNow } from '@/utils/day';
import { hasPerm } from '@/perm';
import { sleep } from '@/utils/time-utils';
import { useUiStore } from '@/store/ui';
import { useEmailStore } from '@/store/email';
import { cn } from '@/lib/utils';
import { EmailUnreadEnum } from '@/enums/email-enum';
import EmailSkeleton from './skeleton';

type EmailListType = 'email' | 'send' | 'star' | 'draft' | 'all-email';

export interface EmailListResp {
  list: any[];
  total: number;
  latestEmail: any;
}

export interface EmailRowData {
  emailId: number;
  draftId?: number;
  name?: string;
  sendEmail?: string;
  toEmail?: string;
  subject?: string;
  text?: string;
  content?: string;
  code?: string;
  unread?: number;
  status?: number;
  allReceive?: number;
  isStar?: number;
  isDel?: boolean;
  isDelContent?: string;
  type?: number;
  userEmail?: string;
  accountId?: number;
  receiveEmail?: string[];
  attachments?: any[];
  createTime?: number | string;
  formatCreateTime?: string;
  formatText?: string;
  statusIcon?: { icon: string; color: string; content: string };
  rightChecked?: boolean;
  checked: boolean;
  expand?: 'loading' | 'noMoreData';
}

export interface EmailScrollHandle {
  refreshList: () => void;
  deleteEmail: (ids: number[]) => void;
  addItem: (email: any) => boolean;
  emailList: EmailRowData[];
  firstLoad: boolean;
  latestEmail: any;
  noLoading: boolean;
  total: number;
}

export interface EmailScrollProps {
  getEmailList: (emailId: number, size: number) => Promise<EmailListResp>;
  emailDelete: (emailIds: number[]) => Promise<any>;
  emailRead?: (emailIds: number[]) => Promise<any>;
  starAdd?: (emailId: number) => Promise<any>;
  starCancel?: (emailId: number) => Promise<any>;
  cancelSuccess?: (email: EmailRowData) => void;
  starSuccess?: (email: EmailRowData) => void;
  actionLeft?: string;
  timeSort: number;
  showStatus: boolean;
  showAccountIcon: boolean;
  showUserInfo: boolean;
  showStar: boolean;
  allowStar: boolean;
  type?: EmailListType;
  showFirstLoading?: boolean;
  showUnread?: boolean;
  onJump?: (email: EmailRowData) => void;
  onDeleteDraft?: (draftIds: number[]) => void | Promise<void>;
  headerFirstSlot?: React.ReactNode;
  nameSlot?: (email: EmailRowData) => React.ReactNode;
  subjectSlot?: (email: EmailRowData) => React.ReactNode;
}

function cleanSpace(text: string) {
  return text
    .replace(/[​-‏﻿‎‏‪　 ­]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function htmlToText(email: any): string {
  if (email.content) {
    if (typeof document === 'undefined') return email.text ?? '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = String(email.content).replace(
      /<(img|iframe|object|embed|video|audio|source|link)[^>]*>/gi,
      '',
    );
    tempDiv.querySelectorAll('script, style, title').forEach((el) => el.remove());
    const text = tempDiv.textContent || tempDiv.innerText || '';
    return cleanSpace(text);
  }
  if (email.text) return cleanSpace(String(email.text));
  return '';
}

const ITEM_HEIGHT_DESKTOP = 48;
const ITEM_HEIGHT_MOBILE = 83;
const ALL_EMAIL_DESKTOP = 65;
const ALL_EMAIL_MOBILE = 132;
const SIZE = 50;

function statusIconFor(status: number, t: (k: string) => string) {
  const map: Record<number, { icon: string; color: string; content: string }> = {
    0: { icon: 'ic:round-mark-email-read', color: '#51C76B', content: t('received') },
    1: { icon: 'bi:send-arrow-up-fill', color: '#51C76B', content: t('sent') },
    2: { icon: 'bi:send-check-fill', color: '#51C76B', content: t('delivered') },
    3: { icon: 'bi:send-x-fill', color: '#F56C6C', content: t('bounced') },
    8: { icon: 'bi:send-x-fill', color: '#F56C6C', content: t('bounced') },
    4: { icon: 'bi:send-exclamation-fill', color: '#FBBD08', content: t('complained') },
    5: { icon: 'bi:send-arrow-up-fill', color: '#FBBD08', content: t('delayed') },
    7: { icon: 'ic:round-mark-email-read', color: '#FBBD08', content: t('noRecipient') },
  };
  return map[status] ?? { icon: 'mdi:email-outline', color: '#909399', content: '' };
}

const EmailScroll = forwardRef<EmailScrollHandle, EmailScrollProps>(function EmailScroll(
  {
    getEmailList,
    emailDelete,
    emailRead,
    starAdd,
    starCancel,
    cancelSuccess,
    starSuccess,
    actionLeft = '0',
    timeSort = 0,
    showStatus = false,
    showAccountIcon = true,
    showUserInfo = false,
    showStar = true,
    allowStar = true,
    type = 'email',
    showFirstLoading = true,
    showUnread = false,
    onJump,
    onDeleteDraft,
    headerFirstSlot,
    nameSlot,
    subjectSlot,
  },
  ref,
) {
  const { t } = useTranslation();
  const _trigger = useEmailStore((s) => s.deleteIds);

  const [emailList, setEmailList] = useState<EmailRowData[]>([]);
  const [latestEmail, setLatestEmail] = useState<any>(null);
  const [total, setTotal] = useState(0);
  const [firstLoad, setFirstLoad] = useState(true);
  const [loading, setLoading] = useState(false);
  const [noMoreData, setNoMoreData] = useState(false);
  const [checkAll, setCheckAll] = useState(false);
  const [isIndeterminate, setIsIndeterminate] = useState(false);
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const [draftDeleteOpen, setDraftDeleteOpen] = useState(false);
  const [draftDeleteCount, setDraftDeleteCount] = useState(0);
  const [draftDeleteLoading, setDraftDeleteLoading] = useState(false);

  const parentRef = useRef<HTMLDivElement>(null);
  const reqLockRef = useRef(false);
  const isMobileRef = useRef(
    typeof window !== 'undefined' ? window.innerWidth < 1367 : false,
  );

  const itemHeight = useMemo(() => {
    if (type === 'all-email') {
      return isMobileRef.current ? ALL_EMAIL_MOBILE : ALL_EMAIL_DESKTOP;
    }
    return isMobileRef.current ? ITEM_HEIGHT_MOBILE : ITEM_HEIGHT_DESKTOP;
  }, [type]);

  const list = emailList;

  const rowVirtualizer = useVirtualizer({
    count: list.length + (noMoreData ? 1 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan: 15,
  });

  useImperativeHandle(
    ref,
    () => ({
      refreshList: () => loadData(true),
      deleteEmail: (ids: number[]) => deleteFromList(ids),
      addItem: (email: any) => addItem(email),
      emailList,
      firstLoad,
      latestEmail,
      noLoading: noMoreData,
      total,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [emailList, total, noMoreData, firstLoad, latestEmail],
  );

  function decorateRow(email: any): EmailRowData {
    const statusIcon = statusIconFor(email.status, t);
    return {
      ...email,
      formatText: htmlToText(email),
      formatCreateTime: fromNow(email.createTime),
      statusIcon,
      checked: false,
      isDelContent: email.isDel ? t('selectDeleted') : undefined,
    };
  }

  const loadData = useCallback(
    async (refresh = false) => {
      if (reqLockRef.current) return;
      reqLockRef.current = true;
      const lastId = refresh || emailList.length === 0 ? 0 : emailList[emailList.length - 1].emailId;
      if (!refresh && noMoreData) {
        reqLockRef.current = false;
        return;
      }
      setLoading(true);
      try {
        const start = Date.now();
        const data = await getEmailList(lastId, SIZE);
        const elapsed = Date.now() - start;
        if (elapsed < 300 && !lastId) await sleep(300 - elapsed);
        setFirstLoad(false);
        const newRows = data.list.map(decorateRow);
        if (refresh) {
          setEmailList(newRows);
          rowVirtualizer.scrollToOffset(0);
        } else {
          setEmailList((prev) => [...prev, ...newRows]);
        }
        setLatestEmail(data.latestEmail);
        setNoMoreData(data.list.length < SIZE);
        setTotal(data.total);
      } finally {
        setLoading(false);
        reqLockRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [emailList, noMoreData, getEmailList, t, itemHeight],
  );

  // initial fetch
  useEffect(() => {
    loadData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // refresh when type or timeSort changes
  useEffect(() => {
    setEmailList([]);
    setNoMoreData(false);
    setCheckedIds([]);
    setCheckAll(false);
    setIsIndeterminate(false);
    loadData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeSort, type]);

  // listen to external delete events from the store
  useEffect(() => {
    if (_trigger) deleteFromList([_trigger]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_trigger]);

  // listen to external star toggles
  const cancelStarId = useEmailStore((s) => s.cancelStarEmailId);
  const addStarId = useEmailStore((s) => s.addStarEmailId);
  useEffect(() => {
    if (!cancelStarId) return;
    setEmailList((prev) =>
      prev.map((item) => (item.emailId === cancelStarId ? { ...item, isStar: 0 } : item)),
    );
  }, [cancelStarId]);
  useEffect(() => {
    if (!addStarId) return;
    setEmailList((prev) =>
      prev.map((item) => (item.emailId === addStarId ? { ...item, isStar: 1 } : item)),
    );
  }, [addStarId]);

  // recompute checkAll when list changes
  useEffect(() => {
    const c = emailList.filter((e) => e.checked).length;
    setCheckedIds(emailList.filter((e) => e.checked).map((e) => e.emailId));
    setCheckAll(c > 0 && c === emailList.length);
    setIsIndeterminate(c > 0 && c < emailList.length);
  }, [emailList]);

  // mobile resize observer for height switching
  useEffect(() => {
    function onResize() {
      isMobileRef.current = window.innerWidth < 1367;
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // load more on scroll near bottom
  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 1200) {
      loadData(false);
    }
  }

  function rowChecked(idx: number, value: boolean) {
    setEmailList((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, checked: value } : e)),
    );
  }

  function onCheckAll(value: boolean) {
    setCheckAll(value);
    setIsIndeterminate(false);
    setEmailList((prev) => prev.map((e) => ({ ...e, checked: value })));
  }

  async function confirmDraftDelete() {
    const ids = emailList.filter((e) => e.checked).map((e) => e.draftId!);
    setDraftDeleteLoading(true);
    try {
      await onDeleteDraft?.(ids);
      deleteFromList(ids);
    } catch {
      // delegated handler toasts
    } finally {
      setDraftDeleteLoading(false);
      setDraftDeleteOpen(false);
    }
  }

  async function deleteChecked() {
    if (type === 'draft' && onDeleteDraft) {
      const ids = emailList.filter((e) => e.checked).map((e) => e.draftId!);
      if (ids.length === 0) return;
      setDraftDeleteCount(ids.length);
      setDraftDeleteOpen(true);
      return;
    }
    const ids = emailList.filter((e) => e.checked).map((e) => e.emailId);
    if (ids.length === 0) return;
    try {
      await emailDelete(ids);
      toast.success(t('delSuccessMsg'));
      deleteFromList(ids);
    } catch {
      /* axios interceptor toasts */
    }
  }

  function deleteFromList(ids: number[]) {
    setEmailList((prev) => {
      const next = prev.filter((e) => !ids.includes(e.emailId));
      return next;
    });
    // top-up if we've crossed below the page size
    if (emailList.length < SIZE && !noMoreData) {
      loadData(false);
    }
  }

  function addItem(email: any): boolean {
    setEmailList((prev) => {
      if (prev.some((e) => e.emailId === email.emailId)) return prev;
      const decorated = decorateRow(email);
      if (!decorated.formatText) decorated.formatText = htmlToText(email);
      if (latestEmail && email.emailId > latestEmail.emailId) {
        setLatestEmail(email);
      }
      setTotal((n) => n + 1);
      if (timeSort) {
        if (noMoreData) return [...prev, decorated];
        return [decorated, ...prev];
      }
      const idx = prev.findIndex((e) => e.emailId < email.emailId);
      if (idx !== -1) {
        const next = [...prev];
        next.splice(idx, 0, decorated);
        return next;
      }
      return noMoreData ? [...prev, decorated] : prev;
    });
    return true;
  }

  function jumpDetails(email: EmailRowData) {
    if (window.getSelection()?.toString().trim()) return;
    onJump?.(email);
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(t('copySuccessMsg'));
    } catch {
      toast.error(t('copyFailMsg'));
    }
  }

  async function starToggle(email: EmailRowData) {
    if (!email.isStar) {
      if (!allowStar) return;
      email.isStar = 1;
      try {
        await starAdd?.(email.emailId);
        starSuccess?.(email);
      } catch {
        email.isStar = 0;
      }
    } else {
      email.isStar = 0;
      try {
        await starCancel?.(email.emailId);
        cancelSuccess?.(email);
      } catch {
        email.isStar = 1;
      }
    }
  }

  async function markRead(ids: number[]) {
    await emailRead?.(ids);
    setEmailList((prev) =>
      prev.map((e) => (ids.includes(e.emailId) ? { ...e, unread: EmailUnreadEnum.READ, checked: false } : e)),
    );
  }

  function skeletonRowsCount(): number {
    if (emailList.length > 20) return 20;
    return emailList.length === 0 ? 1 : emailList.length;
  }

  const selectedCount = emailList.filter((e) => e.checked).length;

  return (
    <div className="grid h-full grid-rows-[auto_1fr] overflow-hidden text-sm text-foreground">
      <div
        className="flex items-center gap-[15px] border-b border-border px-[15px] py-[3px]"
        style={{ boxShadow: 'inset 0 -1px 0 0 oklch(var(--border))' }}
      >
        <Checkbox
          checked={checkAll}
          indeterminate={isIndeterminate}
          disabled={!emailList.length || loading}
          onCheckedChange={(v) => onCheckAll(v === true)}
        />
        <div className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-2" style={{ paddingLeft: actionLeft }}>
          {headerFirstSlot}
          <Icon
            icon="ion:reload"
            width="18"
            height="18"
            className="cursor-pointer"
            onClick={() => loadData(true)}
          />
          {selectedCount > 0 && hasPerm('email:delete') && (
            <>
              <Icon
                icon="uiw:delete"
                width="16"
                height="16"
                className="cursor-pointer"
                onClick={deleteChecked}
              />
              {showUnread && (
                <Icon
                  icon="fluent:mail-read-20-regular"
                  width="21"
                  height="21"
                  className="cursor-pointer"
                  onClick={() => markRead(checkedIds)}
                />
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!!total && (
            <span className="whitespace-nowrap pt-[6px]">
              {t('emailCount', { total })}
            </span>
          )}
          {showAccountIcon && <AccountToggleIcon />}
        </div>
      </div>

      <div
        ref={parentRef}
        className="will-change-scroll overflow-auto"
        onScroll={onScroll}
      >
        {firstLoad && showFirstLoading && (
          <EmailSkeleton rows={20} showStar={showStar} showUserInfo={showUserInfo} />
        )}
        {loading && (
          <EmailSkeleton rows={skeletonRowsCount()} showStar={showStar} showUserInfo={showUserInfo} />
        )}
        {!loading && emailList.length === 0 && !firstLoad && (
          <div className="flex h-full items-center justify-center">
            <span className="text-muted-foreground">{t('noMessagesFound')}</span>
          </div>
        )}
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((vi) => {
            const item = list[vi.index];
            if (!item) {
              return (
                <div
                  key="no-more"
                  className="flex items-center justify-center pt-[15px] text-muted-foreground"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${vi.start}px)`,
                  }}
                >
                  {t('noMoreData')}
                </div>
              );
            }
            return (
              <EmailRow
                key={item.emailId ?? `expand-${vi.index}`}
                item={item}
                start={vi.start}
                type={type}
                showStar={showStar}
                showStatus={showStatus}
                showUserInfo={showUserInfo}
                showUnread={showUnread}
                nameSlot={nameSlot}
                subjectSlot={subjectSlot}
                onJump={jumpDetails}
                onStar={starToggle}
                onCopyCode={copyCode}
                onCheck={(v) => rowChecked(vi.index, v)}
              />
            );
          })}
        </div>
      </div>

      <ConfirmAction
        open={draftDeleteOpen}
        onOpenChange={(o) => !draftDeleteLoading && !o && setDraftDeleteOpen(false)}
        title={t('delDraftsTitle')}
        description={t('deleteDraftsConfirm', { count: draftDeleteCount })}
        confirmText={t('delete')}
        cancelText={t('cancel')}
        destructive
        loading={draftDeleteLoading}
        onConfirm={confirmDraftDelete}
      />
    </div>
  );
});

export default EmailScroll;

function AccountToggleIcon() {
  const accountShow = useUiStore((s) => s.accountShow);
  const setAccountShow = useUiStore((s) => s.setAccountShow);
  return (
    <Icon
      icon="akar-icons:dot-grid-fill"
      width="16"
      height="16"
      className="ml-[15px] mt-[8px] cursor-pointer"
      onClick={() => setAccountShow(!accountShow)}
    />
  );
}

interface EmailRowProps {
  item: EmailRowData;
  start: number;
  type: EmailListType;
  showStar: boolean;
  showStatus: boolean;
  showUserInfo: boolean;
  showUnread: boolean;
  nameSlot?: (email: EmailRowData) => React.ReactNode;
  subjectSlot?: (email: EmailRowData) => React.ReactNode;
  onJump: (e: EmailRowData) => void;
  onStar: (e: EmailRowData) => void;
  onCopyCode: (code: string) => void;
  onCheck: (v: boolean) => void;
}

function EmailRow(props: EmailRowProps) {
  const {
    item,
    start,
    type,
    showStar,
    showStatus,
    showUserInfo,
    showUnread,
    nameSlot,
    subjectSlot,
    onJump,
    onStar,
    onCopyCode,
    onCheck,
  } = props;

  const { t } = useTranslation();

  const unreadBold =
    showUnread && item.unread === EmailUnreadEnum.UNREAD;

  if (item.expand === 'loading') {
    return (
      <div
        style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${start}px)` }}
      >
        <EmailSkeleton rows={1} showStar={showStar} showUserInfo={showUserInfo} />
      </div>
    );
  }

  return (
    <div
      data-checked={item.checked}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        transform: `translateY(${start}px)`,
      }}
      className={cn(
        'flex cursor-pointer items-center gap-2 border-b border-border px-3 py-2 transition-colors hover:bg-accent',
        type === 'all-email' && 'min-h-[65px]',
        item.rightChecked && 'bg-[#FDF6EC]',
      )}
      onClick={() => onJump(item)}
      onContextMenu={(e) => {
        if (type === 'draft') return;
        e.preventDefault();
      }}
    >
      <div className={cn('flex justify-center', type !== 'all-email' && 'px-2')}>
        <Checkbox
          checked={item.checked}
          onCheckedChange={(v) => onCheck(v === true)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {showStar && (
        <div
          className="hidden w-[40px] md:flex"
          onClick={(e) => {
            e.stopPropagation();
            onStar(item);
          }}
        >
          <Icon
            icon={item.isStar ? 'fluent-color:star-16' : 'solar:star-line-duotone'}
            width={item.isStar ? 20 : 18}
            height={item.isStar ? 20 : 18}
          />
        </div>
      )}
      {!showStar && <div className="hidden w-[40px] md:block" />}

      <div className="grid min-w-0 flex-1 grid-cols-1 gap-1 md:grid-cols-[240px_1fr] md:gap-0">
        <div
          className={cn(
            'grid items-center gap-2 truncate',
            unreadBold && 'font-bold',
            showStatus ? 'grid-cols-[auto_1fr_auto]' : 'grid-cols-[1fr_auto]',
          )}
          style={{ color: 'oklch(var(--foreground))' }}
        >
          {showStatus ? (
            <div className="flex flex-col items-start gap-1 text-[18px]">
              <Icon icon={item.statusIcon?.icon ?? 'mdi:email-outline'} color={item.statusIcon?.color} width={20} height={20} />
              {item.isDel && (
                <Icon icon="mdi:email-remove" width={20} height={20} className="text-muted-foreground" />
              )}
            </div>
          ) : null}
          <span className="flex items-center gap-2 truncate">
            <span className="flex items-center truncate gap-1">
              <span className="md:hidden">
                {showUnread && item.unread === EmailUnreadEnum.UNREAD && (
                  <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </span>
              {nameSlot ? nameSlot(item) : <span className="truncate">{item.name}</span>}
            </span>
            <span className="flex items-center">
              {item.isStar && (
                <Icon icon="fluent-color:star-16" width={18} height={18} />
              )}
            </span>
          </span>
          <span className="md:hidden text-xs font-normal">{item.formatCreateTime}</span>
        </div>

        <div className="grid grid-cols-1 items-center gap-1 md:grid-cols-[minmax(0,1fr)_1fr]">
          <div className="flex items-center gap-1.5 truncate">
            <span
              className={cn(
                'flex min-w-0 items-center gap-1.5 truncate',
                unreadBold && 'font-bold',
              )}
            >
              <span className="hidden md:inline-block">
                {showUnread && item.unread === EmailUnreadEnum.UNREAD && (
                  <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </span>
              {item.code && (
                <span
                  className="max-w-[170px] cursor-pointer truncate"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCopyCode(item.code!);
                  }}
                >
                  [{t('codeLabel')}{item.code}]
                </span>
              )}
              <span className="truncate">
                {subjectSlot ? subjectSlot(item) : (item.subject || '​')}
              </span>
            </span>
            <span className="truncate text-muted-foreground">{item.formatText || '​'}</span>
          </div>
          {showUserInfo && (
            <div className="col-span-2 flex flex-wrap items-center gap-[10px] text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Icon icon="mynaui:user" width={20} height={20} />
                <span>{item.userEmail}</span>
              </div>
              <div className="flex items-center gap-1">
                <Icon icon="mdi-light:email" width={20} height={20} />
                <span>{item.type === 0 ? item.toEmail : item.sendEmail}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="hidden w-[80px] justify-end whitespace-nowrap pr-2 md:flex">
        <span className={cn('text-xs', unreadBold && 'font-bold')}>{item.formatCreateTime}</span>
      </div>
    </div>
  );
}

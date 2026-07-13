import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Icon } from '@iconify/react';
import EmailScroll, { type EmailScrollHandle } from '@/components/email-scroll';
import {
  emailList,
  emailRead,
  emailDelete as emailDeleteFn,
  emailLatest,
} from '@/request/email';
import { starAdd as starAddFn, starCancel as starCancelFn } from '@/request/star';
import { useAccountStore } from '@/store/account';
import { useEmailStore } from '@/store/email';
import { useSettingStore } from '@/store/setting';
import { sleep } from '@/utils/time-utils';

export default function EmailView() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const accountId = useAccountStore((s) => s.currentAccountId);
  const account = useAccountStore();
  const emailStore = useEmailStore();
  const settingStore = useSettingStore();
  const scrollRef = useRef<EmailScrollHandle>(null);
  const [timeSort, setTimeSort] = useState(0);
  const existIdsRef = useRef<Set<number>>(new Set());
  const timeSortRef = useRef(timeSort);
  timeSortRef.current = timeSort;

  useEffect(() => {
    let cancelled = false;
    const onVisibility = () => {
      // resume immediately when the tab becomes visible — the loop's await below
      // wakes up on its own once `document.hidden` flips.
    };

    async function latestLoop() {
      while (!cancelled) {
        const autoRefresh: number = (settingStore.settings as any)?.autoRefresh ?? 0;
        await sleep(autoRefresh > 1 ? autoRefresh * 1000 : 3000);
        if (cancelled) return;
        if (document.hidden) {
          // Tab backgrounded: wait for visibility before burning bandwidth.
          await new Promise<void>((resolve) => {
            const handler = () => {
              if (!document.hidden) {
                document.removeEventListener('visibilitychange', handler);
                resolve();
              }
            };
            document.addEventListener('visibilitychange', handler);
          });
          if (cancelled) return;
        }

        const handle = scrollRef.current;
        if (!handle || handle.firstLoad) continue;
        if (autoRefresh <= 1) continue;

        const latestEmail = handle.latestEmail;
        const latestId = latestEmail?.emailId;
        if (!latestId) continue;

        try {
          const curAccountId = useAccountStore.getState().currentAccountId;
          const allReceive = latestEmail?.allReceive;
          const curTimeSort = timeSortRef.current;
          let list: any[] = [];
          if (curAccountId === latestEmail?.reqAccountId) {
            list = await emailLatest(latestId, curAccountId, allReceive);
          }
          if (cancelled) return;
          if (
            curAccountId === useAccountStore.getState().currentAccountId &&
            timeSortRef.current === curTimeSort &&
            allReceive === useAccountStore.getState().currentAccount?.allReceive
          ) {
            for (const email of list) {
              if (cancelled) return;
              email.reqAccountId = curAccountId;
              email.allReceive = allReceive;
              // existIdsRef is the source of truth: skipping via the ref guards
              // both the first-emit race and any re-emit after a stale response.
              if (existIdsRef.current.has(email.emailId)) continue;
              existIdsRef.current.add(email.emailId);
              handle.addItem(email);
            }
          }
        } catch (e: any) {
          if (e?.code === 401 || e?.code === 403) {
            settingStore.settings.autoRefresh = 0;
          }
        }
      }
    }

    void latestLoop();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!accountId) return;
    existIdsRef.current = new Set();
    scrollRef.current?.refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  function changeTimeSort() {
    setTimeSort((cur) => {
      const next = cur ? 0 : 1;
      scrollRef.current?.refreshList();
      return next;
    });
  }

  function jumpContent(email: any) {
    emailStore.setContentData({
      email,
      delType: 'logic',
      showUnread: true,
      showStar: true,
      showReply: true,
    });
    navigate('/message');
  }

  function addStar(email: any) {
    const starScroll = useEmailStore.getState().starScroll;
    starScroll?.addItem(email);
  }

  function cancelStar(email: any) {
    const starScroll = useEmailStore.getState().starScroll;
    starScroll?.deleteEmail([email.emailId]);
    toast(t('undoRemoveStar'), {
      action: {
        label: t('undo'),
        onClick: () => {
          starScroll?.addItem(email);
        },
      },
      duration: 5000,
    });
  }

  async function getEmailList(emailId: number, size: number) {
    const allReceive = account.currentAccount?.allReceive ?? 0;
    const data = await emailList(accountId, allReceive, emailId, timeSortRef.current, size, 0);
    if (data.latestEmail) {
      data.latestEmail.reqAccountId = accountId;
      data.latestEmail.allReceive = allReceive;
    }
    return data;
  }

  return (
    <EmailScroll
      ref={scrollRef}
      getEmailList={getEmailList}
      emailDelete={emailDeleteFn}
      emailRead={emailRead}
      starAdd={starAddFn}
      starCancel={starCancelFn}
      timeSort={timeSort}
      showUnread
      showStatus={false}
      showAccountIcon
      showUserInfo={false}
      showStar
      allowStar
      actionLeft="4px"
      onJump={jumpContent}
      starSuccess={addStar}
      cancelSuccess={cancelStar}
      headerFirstSlot={
        <Icon
          className="cursor-pointer"
          icon={
            timeSort === 0
              ? 'material-symbols-light:timer-arrow-down-outline'
              : 'material-symbols-light:timer-arrow-up-outline'
          }
          width="28"
          height="28"
          onClick={changeTimeSort}
        />
      }
    />
  );
}

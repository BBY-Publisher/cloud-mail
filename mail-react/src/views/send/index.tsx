import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import EmailScroll, { type EmailScrollHandle } from '@/components/email-scroll';
import {
  emailList,
  emailDelete as emailDeleteFn,
} from '@/request/email';
import { starAdd as starAddFn, starCancel as starCancelFn } from '@/request/star';
import { useAccountStore } from '@/store/account';
import { useEmailStore } from '@/store/email';

export default function SendView() {
  const navigate = useNavigate();
  const accountId = useAccountStore((s) => s.currentAccountId);
  const account = useAccountStore();
  const emailStore = useEmailStore();
  const scrollRef = useRef<EmailScrollHandle>(null);
  const [timeSort, setTimeSort] = useState(0);
  const timeSortRef = useRef(timeSort);
  timeSortRef.current = timeSort;

  useEffect(() => {
    emailStore.setSendScroll(scrollRef.current);
    return () => {
      emailStore.setSendScroll(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!accountId) return;
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
      showStar: true,
      showReply: true,
    });
    navigate('/message');
  }

  function addStar(email: any) {
    useEmailStore.getState().starScroll?.addItem(email);
  }

  function cancelStar(email: any) {
    useEmailStore.getState().starScroll?.deleteEmail([email.emailId]);
  }

  async function getEmailList(emailId: number, size: number) {
    const allReceive = account.currentAccount?.allReceive ?? 0;
    const data = await emailList(accountId, allReceive, emailId, timeSortRef.current, size, 1);
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
      starAdd={starAddFn}
      starCancel={starCancelFn}
      starSuccess={addStar}
      cancelSuccess={cancelStar}
      showStatus
      showAccountIcon
      showUserInfo={false}
      showStar
      allowStar
      actionLeft="4px"
      timeSort={timeSort}
      type="send"
      onJump={jumpContent}
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

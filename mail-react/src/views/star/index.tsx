import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import EmailScroll, { type EmailScrollHandle } from '@/components/email-scroll';
import { emailDelete as emailDeleteFn } from '@/request/email';
import {
  starAdd as starAddFn,
  starCancel as starCancelFn,
  starList,
} from '@/request/star';
import { useEmailStore } from '@/store/email';

export default function StarView() {
  const navigate = useNavigate();
  const emailStore = useEmailStore();
  const scrollRef = useRef<EmailScrollHandle>(null);

  useEffect(() => {
    emailStore.setStarScroll(scrollRef.current);
    return () => {
      emailStore.setStarScroll(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function jumpContent(email: any) {
    emailStore.setContentData({
      email,
      delType: 'logic',
      showStar: true,
      showReply: true,
    });
    navigate('/message');
  }

  function cancelStar(email: any) {
    useEmailStore.setState({ cancelStarEmailId: email.emailId });
    scrollRef.current?.deleteEmail([email.emailId]);
  }

  async function getEmailList(emailId: number, size: number) {
    const data = await starList(emailId, size);
    if (data.latestEmail) {
      data.latestEmail.reqAccountId = useEmailStore.getState().starScroll ? 0 : 0;
    }
    return { list: data.list, total: data.list.length, latestEmail: data.latestEmail };
  }

  return (
    <EmailScroll
      ref={scrollRef}
      allowStar={false}
      cancelSuccess={cancelStar}
      getEmailList={getEmailList}
      emailDelete={emailDeleteFn}
      starAdd={starAddFn}
      starCancel={starCancelFn}
      onJump={jumpContent}
      actionLeft="6px"
      showAccountIcon={false}
      showStatus={false}
      showUserInfo={false}
      showStar
      timeSort={0}
      type="star"
    />
  );
}

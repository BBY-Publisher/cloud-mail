import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import EmailScroll, { type EmailScrollHandle } from '@/components/email-scroll';
import { useEmailStore } from '@/store/email';
import {
  allEmailList,
  allEmailDelete,
} from '@/request/all-email';

export default function AllEmailView() {
  const navigate = useNavigate();
  const emailStore = useEmailStore();
  const scrollRef = useRef<EmailScrollHandle>(null);

  function jumpContent(email: any) {
    emailStore.setContentData({
      email,
      delType: 'real',
      showStar: false,
      showReply: false,
    });
    navigate('/message');
  }

  async function getEmailList(emailId: number, size: number) {
    return allEmailList({ emailId, size });
  }

  async function emailDelete(emailIds: number[]) {
    return allEmailDelete(emailIds);
  }

  return (
    <EmailScroll
      ref={scrollRef}
      getEmailList={getEmailList}
      emailDelete={emailDelete}
      showUserInfo
      showStar={false}
      showStatus
      showAccountIcon={false}
      allowStar={false}
      timeSort={0}
      type="all-email"
      actionLeft="6px"
      onJump={jumpContent}
    />
  );
}

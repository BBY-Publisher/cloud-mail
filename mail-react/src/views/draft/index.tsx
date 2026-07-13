import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import EmailScroll, { type EmailScrollHandle, type EmailRowData } from '@/components/email-scroll';
import { starAdd as starAddFn, starCancel as starCancelFn } from '@/request/star';
import { useDraftStore } from '@/store/draft';
import { useUiStore } from '@/store/ui';
import { getDB, type DraftRecord, type AttRecord } from '@/db/db';

export default function DraftView() {
  const { t } = useTranslation();
  const refreshListCounter = useDraftStore((s) => s.refreshList);
  const openWriter = useUiStore((s) => s.openWriter);
  const scrollRef = useRef<EmailScrollHandle>(null);

  useEffect(() => {
    refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshListCounter]);

  async function refreshList() {
    const handle = scrollRef.current;
    if (!handle) return;
    const db = getDB();
    const drafts = await db.draft.orderBy('createTime').reverse().toArray();
    const list: EmailRowData[] = drafts.map((d) => ({
      emailId: -(d.draftId ?? 0),
      draftId: d.draftId,
      subject: d.subject,
      receiveEmail: d.toEmail.split(',').filter(Boolean),
      formatCreateTime: new Date(d.createTime).toISOString(),
      formatText: '',
      content: d.content,
      checked: false,
      createTime: d.createTime,
      name: '',
      sendEmail: '',
      isStar: 0,
      unread: 1,
    }));
    (handle as any).emailList.splice(0, (handle as any).emailList.length);
    (handle as any).emailList.push(...list);
    (handle as any).firstLoad = false;
  }

  async function deleteDraft(draftIds: number[]) {
    const db = getDB();
    await db.draft.bulkDelete(draftIds);
    useDraftStore.setState((s) => ({ refreshList: s.refreshList + 1 }));
  }

  async function jumpContent(email: EmailRowData) {
    const db = getDB();
    const att: AttRecord | undefined = await db.att.get(email.draftId!);
    openWriter({
      draftId: email.draftId,
      subject: email.subject,
      receiveEmail: email.receiveEmail,
      content: (email as any).content ?? '',
      attachments: att?.atts ?? [],
    });
  }

  async function getEmailList() {
    const db = getDB();
    const drafts: DraftRecord[] = await db.draft.orderBy('createTime').reverse().toArray();
    return { list: drafts, total: drafts.length, latestEmail: null };
  }

  return (
    <EmailScroll
      ref={scrollRef}
      allowStar={false}
      getEmailList={getEmailList as any}
      emailDelete={async () => {}}
      starAdd={starAddFn}
      starCancel={starCancelFn}
      onJump={jumpContent}
      onDeleteDraft={deleteDraft}
      actionLeft="6px"
      showAccountIcon={false}
      showStatus={false}
      showUserInfo={false}
      showStar={false}
      timeSort={0}
      type="draft"
      showFirstLoading={false}
      nameSlot={(email) => (
        <span>
          {email.receiveEmail && email.receiveEmail.length > 0
            ? email.receiveEmail.join(',')
            : `(${t('noRecipient')})`}
        </span>
      )}
      subjectSlot={(email) =>
        email.subject ? <>{email.subject}</> : <>({t('noSubject')})</>
      }
    />
  );
}

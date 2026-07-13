import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '@iconify/react';
import { toast } from 'sonner';
import ShadowHtml from '@/components/shadow-html';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { emailDelete, emailRead } from '@/request/email';
import { allEmailDelete } from '@/request/all-email';
import { starAdd, starCancel } from '@/request/star';
import { useEmailStore } from '@/store/email';
import { useAccountStore } from '@/store/account';
import { useSettingStore } from '@/store/setting';
import { useUiStore } from '@/store/ui';
import { formatDetailDate } from '@/utils/day';
import { formatBytes, getExtName } from '@/utils/file-utils';
import { cvtR2Url, toOssDomain } from '@/utils/convert';
import { getIconByName } from '@/utils/icon-utils';
import { hasPerm } from '@/perm';
import { EmailUnreadEnum } from '@/enums/email-enum';

export default function ContentView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const emailStore = useEmailStore();
  const account = useAccountStore();
  const settings = useSettingStore((s) => s.settings);
  const openWriter = useUiStore((s) => s.openWriter);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const data = emailStore.contentData;
  const email = data?.email;

  useEffect(() => {
    if (data?.showUnread && email && email.unread === EmailUnreadEnum.UNREAD) {
      email.unread = EmailUnreadEnum.READ;
      void emailRead([email.emailId]);
    }
    return () => {
      if (data?.showUnread) {
        useEmailStore.setState({
          contentData: {
            email: email ?? null,
            delType: 'logic',
            showStar: data.showStar,
            showReply: data.showReply,
          },
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!account.currentAccountId) return;
    navigate(-1);
  }, [account.currentAccountId, navigate]);

  if (!email) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          icon="lucide:mail-x"
          title={t('noMessagesFound')}
          description={t('noMessagesFoundDesc')}
          className="py-16"
        >
          <Button variant="outline" size="sm" onClick={() => navigate('/inbox')}>
            <Icon icon="material-symbols-light:arrow-back-ios-new" width="14" height="14" />
            {t('backToInbox')}
          </Button>
        </EmptyState>
      </div>
    );
  }

  function openReply() {
    openWriter({ replyTo: email });
  }

  function openForward() {
    openWriter({ forwardFrom: email });
  }

  async function changeStar() {
    if (email.isStar) {
      email.isStar = 0;
      try {
        await starCancel(email.emailId);
        useEmailStore.setState({ cancelStarEmailId: email.emailId });
        setTimeout(() => useEmailStore.setState({ cancelStarEmailId: 0 }), 0);
        useEmailStore.getState().starScroll?.deleteEmail([email.emailId]);
      } catch {
        email.isStar = 1;
      }
    } else {
      email.isStar = 1;
      try {
        await starAdd(email.emailId);
        useEmailStore.setState({ addStarEmailId: email.emailId });
        setTimeout(() => useEmailStore.setState({ addStarEmailId: 0 }), 0);
        useEmailStore.getState().starScroll?.addItem(email);
      } catch {
        email.isStar = 0;
      }
    }
  }

  async function confirmDelete() {
    try {
      if (data.delType === 'logic') {
        await emailDelete([email.emailId]);
      } else {
        await allEmailDelete([email.emailId]);
      }
      toast.success(t('delSuccessMsg'));
      useEmailStore.setState({ deleteIds: email.emailId });
      navigate(-1);
    } catch {
      /* axios toasts */
    }
  }

  function formatImage(content: string) {
    content = content || '';
    const domain = settings?.r2Domain;
    return content.replace(/{{domain}}/g, toOssDomain(domain as string | undefined) + '/');
  }

  function isImage(filename: string) {
    return ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'jfif'].includes(getExtName(filename));
  }

  function showImage(key: string) {
    if (!isImage(key)) return;
    setLightbox(cvtR2Url(key));
  }

  function formateReceive(recipient: any) {
    try {
      const arr = JSON.parse(recipient);
      return (arr as Array<{ address: string }>).map((i) => i.address).join(', ');
    } catch {
      return recipient;
    }
  }

  function toMessage(message: string) {
    try {
      return JSON.parse(message)?.message ?? '';
    } catch {
      return '';
    }
  }

  return (
    <div className="grid h-full grid-rows-[auto_1fr] overflow-hidden">
      <div className="flex items-center gap-5 border-b border-border px-4 py-2 text-lg">
        <Icon
          icon="material-symbols-light:arrow-back-ios-new"
          width="20"
          height="20"
          className="cursor-pointer"
          onClick={() => navigate(-1)}
        />
        {hasPerm('email:delete') && (
          <Icon
            icon="uiw:delete"
            width="16"
            height="16"
            className="cursor-pointer"
            onClick={() => setDeleteOpen(true)}
          />
        )}
        {data.showStar && (
          <span className="flex min-w-[21px] items-center justify-center">
            <Icon
              icon={email.isStar ? 'fluent-color:star-16' : 'solar:star-line-duotone'}
              width={email.isStar ? 20 : 18}
              height={email.isStar ? 20 : 18}
              className="cursor-pointer"
              onClick={changeStar}
            />
          </span>
        )}
        {data.showReply && hasPerm('email:send') && (
          <>
            <Icon
              icon="la:reply"
              width="21"
              height="21"
              className="cursor-pointer"
              onClick={openReply}
            />
            <Icon
              icon="iconoir:arrow-up-right"
              width="20"
              height="20"
              className="cursor-pointer"
              onClick={openForward}
            />
          </>
        )}
      </div>

      <div className="overflow-auto px-4 pt-2 text-sm">
        <div className="mb-3 text-xl font-bold">{email.subject}</div>
        <div className="flex flex-col gap-2 border-b border-border pb-2 text-foreground">
          {email.status === 3 && (
            <Alert variant="destructive">
              <AlertTitle>{t('delivered')}</AlertTitle>
              <AlertDescription>{toMessage(email.message)}</AlertDescription>
            </Alert>
          )}
          {email.status === 4 && (
            <Alert>
              <AlertTitle>{t('complained')}</AlertTitle>
            </Alert>
          )}
          {email.status === 5 && (
            <Alert>
              <AlertTitle>{t('delayed')}</AlertTitle>
            </Alert>
          )}
          <div className="mb-1.5 flex">
            <span className="whitespace-nowrap pr-2.5 font-bold">{t('from')}</span>
            <div className="flex flex-wrap text-muted-foreground">
              <span className="pr-1.5">{email.name}</span>
              <span>&lt;{email.sendEmail}&gt;</span>
            </div>
          </div>
          <div className="mb-1.5 flex">
            <span className="whitespace-nowrap pr-2.5 font-bold">{t('recipient')}</span>
            <span className="max-w-[700px] break-words text-muted-foreground">
              {formateReceive(email.recipient)}
            </span>
          </div>
          <div className="mb-1.5 text-muted-foreground">{formatDetailDate(email.createTime)}</div>
        </div>

        <div className="mb-7 mt-5">
          {email.content ? (
            <ShadowHtml html={formatImage(email.content)} />
          ) : (
            <pre className="m-0 whitespace-pre-wrap break-words font-sans">{email.text}</pre>
          )}
        </div>

        {email.attList && email.attList.length > 0 && (
          <div className="mb-7 mt-7 w-fit min-w-[410px] max-w-[600px] rounded-md border border-border p-3">
            <div className="mb-2 flex justify-between">
              <span className="font-bold">{t('attachments')}</span>
              <span>{t('attCount', { total: email.attList.length })}</span>
            </div>
            <div className="flex flex-col gap-3">
              {email.attList.map((att: any) => (
                <div
                  key={att.attId}
                  className="grid cursor-pointer grid-cols-[auto_1fr_auto_auto] items-center gap-2 rounded bg-muted px-2 py-1"
                  onClick={() => showImage(att.key)}
                >
                  <div className="flex items-center">
                    <Icon
                      {...(getIconByName(att.filename) as any)}
                      width={22}
                      height={22}
                    />
                  </div>
                  <div className="mx-2 truncate">{att.filename}</div>
                  <div className="whitespace-nowrap text-muted-foreground">
                    {formatBytes(att.size)}
                  </div>
                  <div className="flex items-center gap-2 pl-2.5">
                    {isImage(att.filename) && (
                      <Icon
                        icon="hugeicons:view"
                        width="22"
                        height="22"
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          showImage(att.key);
                        }}
                      />
                    )}
                    <a
                      href={cvtR2Url(att.key)}
                      download
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted-foreground"
                    >
                      <Icon icon="system-uicons:push-down" width="22" height="22" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt=""
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <Button
            variant="ghost"
            className="absolute right-4 top-4"
            onClick={() => setLightbox(null)}
          >
            ✕
          </Button>
        </div>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('delEmailConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>{t('confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import HtmlEditor, { type HtmlEditorHandle } from '@/components/tiptap-editor';
import SendPercent from '@/components/send-percent';
import ShadowHtml from '@/components/shadow-html';
import { useUiStore } from '@/store/ui';
import { useUserStore } from '@/store/user';
import { useAccountStore } from '@/store/account';
import { useEmailStore } from '@/store/email';
import { useDraftStore } from '@/store/draft';
import { useWriterStore } from '@/store/writer';
import { useSignatureStore } from '@/store/signature';
import { useSettingStore } from '@/store/setting';
import { emailSend } from '@/request/email';
import { signatureGet } from '@/request/signature';
import { isEmail } from '@/utils/verify-utils';
import { fileToBase64, formatBytes } from '@/utils/file-utils';
import { getIconByName } from '@/utils/icon-utils';

// Per-file and total attachment caps. Generous enough for typical mail but
// small enough that a single accidental video upload doesn't blow the request.
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25 MB per file
const MAX_TOTAL_ATTACHMENT_SIZE = 50 * 1024 * 1024; // 50 MB across all files
import { formatDetailDate } from '@/utils/day';
import { toOssDomain } from '@/utils/convert';
import { getDB, type DraftRecord } from '@/db/db';
import { hasPerm } from '@/perm';
import { setToken } from '@/request/http';

interface WriteForm {
  sendEmail: string;
  receiveEmail: string[];
  accountId: number;
  name: string;
  subject: string;
  content: string;
  text: string;
  sendType: '' | 'reply' | 'forward';
  includeSignature: boolean;
  emailId: number;
  draftId: number | null;
  attachments: Attachment[];
}

interface Attachment {
  filename: string;
  size: number;
  content: string;
  contentType: string;
}

const initialForm: WriteForm = {
  sendEmail: '',
  receiveEmail: [],
  accountId: -1,
  name: '',
  subject: '',
  content: '',
  text: '',
  sendType: '',
  includeSignature: true,
  emailId: 0,
  draftId: null,
  attachments: [],
};

export default function Writer() {
  const { t } = useTranslation();
  const writerShow = useUiStore((s) => s.writerShow);
  const writerData = useUiStore((s) => s.writerData);
  const closeWriter = useUiStore((s) => s.closeWriter);
  const refreshUserInfo = useUserStore((s) => s.refreshUserInfo);
  const account = useAccountStore();
  const userStore = useUserStore();
  const emailStore = useEmailStore();
  const setDraftInStore = useDraftStore((s) => s.setSetDraft);
  const writerStore = useWriterStore();
  const signatureStore = useSignatureStore();
  const settings = useSettingStore((s) => s.settings);
  const editorRef = useRef<HtmlEditorHandle>(null);
  const [form, setForm] = useState<WriteForm>(initialForm);
  const [confirmClose, setConfirmClose] = useState(false);
  const [percent, setPercent] = useState(0);
  const [recipientInput, setRecipientInput] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSignature, setPreviewSignature] = useState('');
  const recipientInputRef = useRef<HTMLInputElement>(null);
  const previewReqRef = useRef(0);

  // Sync open state with store data
  useEffect(() => {
    if (!writerShow) return;
    if (writerData?.replyTo) {
      openReply(writerData.replyTo);
    } else if (writerData?.forwardFrom) {
      openForward(writerData.forwardFrom);
    } else if (writerData && writerData.draftId) {
      openDraft(writerData);
    } else {
      openNew();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writerShow]);

  function openNew() {
    const currentAccountEmail = account.currentAccount?.email;
    const currentAccountId = account.currentAccountId;
    const user = userStore.user;
    if (!currentAccountEmail && user) {
      setForm({
        ...initialForm,
        sendEmail: user.email,
        accountId: user.account?.accountId ?? -1,
        name: user.name,
      });
    } else if (account.currentAccount) {
      setForm({
        ...initialForm,
        sendEmail: currentAccountEmail ?? '',
        accountId: currentAccountId,
        name: account.currentAccount.name ?? '',
      });
    }
    setTimeout(() => editorRef.current?.focus());
  }

  function openReply(email: any) {
    resetForm();
    const subject =
      email.subject?.startsWith('Re:') ||
      email.subject?.startsWith('Re：') ||
      email.subject?.startsWith('回复：') ||
      email.subject?.startsWith('回复:')
        ? email.subject
        : 'Re: ' + (email.subject || '');
    setForm((f) => ({
      ...f,
      receiveEmail: [email.sendEmail],
      subject,
      sendType: 'reply',
      emailId: email.emailId,
    }));
    const body = `<br><div>${
      formatDetailDate(email.createTime)
    } ${email.name} &lt;${email.sendEmail}&gt; ${t('wrote')}:</div><blockquote style="margin: 0 0 0 0.8ex;border-left: 1px solid #ccc;padding-left: 1ex;">${
      formatImage(email.content) || `<pre style="font-family:inherit;word-break:break-word;white-space:pre-wrap;margin:0">${email.text}</pre>`
    }</blockquote>`;
    setTimeout(() => {
      editorRef.current?.focus();
      setForm((f) => ({ ...f, content: body, text: email.text || '' }));
    }, 0);
  }

  function openForward(email: any) {
    resetForm();
    setForm((f) => ({
      ...f,
      subject: email.subject || '',
      sendType: 'forward',
    }));
    const body =
      formatImage(email.content) ||
      `<pre style="font-family:inherit;word-break:break-word;white-space:pre-wrap;margin:0">${email.text}</pre>`;
    setTimeout(() => {
      editorRef.current?.focus();
      setForm((f) => ({ ...f, content: body, text: email.text || '' }));
    }, 0);
  }

  function openDraft(draft: any) {
    setForm({
      ...initialForm,
      ...draft,
      includeSignature: draft.includeSignature ?? true,
      draftId: draft.draftId,
    });
    setTimeout(() => editorRef.current?.focus());
  }

  function resetForm() {
    setForm({ ...initialForm });
    editorRef.current?.clearEditor();
  }

  function formatImage(content: string) {
    content = content || '';
    const domain = settings?.r2Domain as string | undefined;
    return content.replace(/{{domain}}/g, toOssDomain(domain) + '/');
  }

  function pushRecipient() {
    const raw = recipientInput.trim();
    if (!raw) return;
    raw.split(/[,，]/).map((s) => s.trim()).filter(Boolean).forEach((email) => {
      if (isEmail(email) && !form.receiveEmail.includes(email)) {
        setForm((f) => ({ ...f, receiveEmail: [...f.receiveEmail, email] }));
      }
    });
    setRecipientInput('');
  }

  function removeRecipient(email: string) {
    setForm((f) => ({ ...f, receiveEmail: f.receiveEmail.filter((e) => e !== email) }));
  }

  const filteredSuggestions = recipientInput
    ? writerStore.sendRecipientRecord
        .filter((r) => r.email.startsWith(recipientInput) && !form.receiveEmail.includes(r.email))
        .slice(0, 10)
    : [];

  async function chooseFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.click();
    input.onchange = async (e: any) => {
      const files = e.target.files as FileList;
      if (!files) return;
      const currentTotal = form.attachments.reduce((sum, a) => sum + (a.size || 0), 0);
      let runningTotal = currentTotal;
      let rejected = 0;
      for (const file of Array.from(files)) {
        if (file.size > MAX_ATTACHMENT_SIZE) {
          rejected += 1;
          continue;
        }
        if (runningTotal + file.size > MAX_TOTAL_ATTACHMENT_SIZE) {
          rejected += 1;
          continue;
        }
        const content = await fileToBase64(file);
        runningTotal += file.size;
        setForm((f) => ({
          ...f,
          attachments: [...f.attachments, { filename: file.name, size: file.size, content, contentType: file.type }],
        }));
      }
      if (rejected > 0) {
        toast.warning(t('attachmentTooLarge', { count: rejected }));
      }
    };
  }

  function delAtt(idx: number) {
    setForm((f) => ({ ...f, attachments: f.attachments.filter((_, i) => i !== idx) }));
  }

  async function sendEmail() {
    if (form.receiveEmail.length === 0) {
      toast.error(t('emptyRecipientMsg'));
      return;
    }
    if (!form.subject) {
      toast.error(t('emptySubjectMsg'));
      return;
    }
    const content = editorRef.current?.getContent() || form.content;
    const text = editorRef.current?.getText() || form.text;
    if (!content) {
      toast.error(t('emptyContentMsg'));
      return;
    }

    const fd = new FormData();
    fd.append('sendEmail', form.sendEmail);
    fd.append('receiveEmail', JSON.stringify(form.receiveEmail.map((address) => ({ address, name: '' }))));
    fd.append('accountId', String(form.accountId));
    fd.append('name', form.name);
    fd.append('subject', form.subject);
    fd.append('content', content);
    fd.append('text', text);
    fd.append('sendType', form.sendType);
    fd.append('emailId', String(form.emailId));
    form.attachments.forEach((att, i) => {
      fd.append(`attachments[${i}]`, att.content);
      fd.append(`attachmentFilenames[${i}]`, att.filename);
      fd.append(`attachmentSizes[${i}]`, String(att.size));
      fd.append(`attachmentContentTypes[${i}]`, att.contentType);
    });

    const toastId = toast.loading(<SendPercent value={percent} desc={t('sending')} />, {
      duration: Infinity,
    });

    try {
      const result = (await emailSend(fd, (e) =>
        setPercent(Math.round((e.loaded * 98) / (e.total ?? 1))),
      )) as any[];
      const first = result[0];
      result.forEach((item: any) => {
        emailStore.sendScroll?.addItem(item);
      });
      toast.dismiss(toastId);
      toast.success(first?.subject ?? t('sendSuccessMsg'));

      await refreshUserInfo();
      addRecipientRecord();
      if (form.draftId) {
        const db = getDB();
        await db.draft.delete(form.draftId);
        await db.att.delete(form.draftId);
        useDraftStore.setState((s) => ({ refreshList: s.refreshList + 1 }));
      }
      closeWriter();
      resetForm();
    } catch (e: any) {
      toast.dismiss(toastId);
      toast.error(e?.message || t('sendFailMsg'));
      if (e?.code === 401) {
        setToken('');
        window.location.href = '/login';
      }
    } finally {
      setPercent(0);
    }
  }

  function addRecipientRecord() {
    const oldWithoutCurrent = writerStore.sendRecipientRecord.filter(
      (r) => !form.receiveEmail.includes(r.email),
    );
    const next = [...form.receiveEmail.map((email) => ({ email })), ...oldWithoutCurrent].slice(0, 500);
    writerStore.setSendRecipientRecord(next);
  }

  async function close() {
    const content = editorRef.current?.getContent() ?? form.content;
    if (form.draftId) {
      setDraftInStore({ ...form, content });
      closeWriter();
      resetForm();
      return;
    }
    if (!content && !form.subject && form.receiveEmail.length === 0) {
      closeWriter();
      resetForm();
      return;
    }
    setConfirmClose(true);
  }

  async function saveDraftAndClose() {
    const content = editorRef.current?.getContent() ?? form.content;
    const db = getDB();
    const draftId = await db.draft.add({
      subject: form.subject,
      toEmail: form.receiveEmail.join(','),
      content,
      createTime: Date.now(),
      accountId: form.accountId,
    } as DraftRecord);
    await db.att.put({ draftId, atts: form.attachments as any });
    useDraftStore.setState((s) => ({ refreshList: s.refreshList + 1 }));
    closeWriter();
    resetForm();
  }

  function discardDraft() {
    closeWriter();
    resetForm();
  }

  async function refreshPreviewSignature() {
    const req = ++previewReqRef.current;
    setPreviewSignature('');
    if (form.includeSignature && form.sendEmail) {
      try {
        const signature: any = await signatureGet(form.sendEmail);
        if (req !== previewReqRef.current) return;
        setPreviewSignature(signature.content || '');
      } catch {
        if (req !== previewReqRef.current) return;
        setPreviewSignature('');
      }
    }
  }

  useEffect(() => {
    if (previewOpen) refreshPreviewSignature();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewOpen, form.includeSignature, form.sendEmail, signatureStore.refresh]);

  const previewHtml = () => {
    const sig = form.includeSignature && previewSignature
      ? `<div style="margin-top:16px;">${previewSignature}</div>`
      : '';
    return formatImage(`${editorRef.current?.getContent() || form.content || ''}${sig}`);
  };

  return (
    <>
      <Sheet open={writerShow} onOpenChange={(o) => (o ? null : close())}>
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col gap-3 overflow-y-auto bg-background p-5 sm:max-w-[720px]"
        >
          <SheetHeader className="mb-1 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon icon="hugeicons:quill-write-01" width="28" height="28" />
              <span className="text-sm text-muted-foreground">{t('sender')}:</span>
              <span className="font-bold">{form.name}</span>
              <span className="text-muted-foreground">&lt;{form.sendEmail}&gt;</span>
            </div>
            <Icon
              icon="material-symbols-light:close-rounded"
              width="22"
              height="22"
              className="cursor-pointer"
              onClick={close}
            />
          </SheetHeader>
          <SheetTitle className="hidden">{t('write')}</SheetTitle>

          <div className="flex flex-col gap-3">
            <div className="relative flex flex-wrap items-center gap-1 rounded-md border border-input bg-background p-2">
              <span className="px-2 text-sm text-muted-foreground">{t('recipient')}</span>
              {form.receiveEmail.map((email) => (
                <Badge key={email} variant="secondary" className="gap-1">
                  {email}
                  <Icon
                    icon="material-symbols-light:close-rounded"
                    width="14"
                    height="14"
                    className="cursor-pointer"
                    onClick={() => removeRecipient(email)}
                  />
                </Badge>
              ))}
              <input
                ref={recipientInputRef}
                className="min-w-[120px] flex-1 bg-transparent outline-none"
                value={recipientInput}
                onChange={(e) => {
                  setRecipientInput(e.target.value);
                  setDropdownOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
                    e.preventDefault();
                    pushRecipient();
                  }
                  if (e.key === 'Backspace' && !recipientInput && form.receiveEmail.length > 0) {
                    removeRecipient(form.receiveEmail[form.receiveEmail.length - 1]);
                  }
                }}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
              />
              {dropdownOpen && filteredSuggestions.length > 0 && (
                <div className="absolute left-0 top-full z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow">
                  {filteredSuggestions.map((s, i) => (
                    <div
                      key={`${s.email}-${i}`}
                      className="cursor-pointer px-3 py-1.5 text-sm hover:bg-accent"
                      onClick={() => {
                        setForm((f) => ({ ...f, receiveEmail: [...f.receiveEmail, s.email] }));
                        setRecipientInput('');
                      }}
                    >
                      {s.email}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Input
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              placeholder={t('subject')}
            />
            <HtmlEditor
              ref={editorRef}
              placeholder={t('writeContent')}
              defaultValue={form.content}
              onChange={(content, text) => setForm((f) => ({ ...f, content, text }))}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Icon icon="iconamoon:attachment-fill" width="24" height="24" className="cursor-pointer" onClick={chooseFile} />
              <Icon icon="icon-park-outline:clear-format" width="24" height="24" className="cursor-pointer" onClick={resetForm} />
              <label className="flex items-center gap-2 whitespace-nowrap text-sm">
                <Checkbox
                  checked={form.includeSignature}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, includeSignature: v === true }))}
                />
                {t('includeSignature')}
              </label>
              <div className="flex max-h-28 flex-1 flex-wrap gap-1 overflow-y-auto">
                {form.attachments.map((att, i) => (
                  <div
                    key={i}
                    className="grid h-8 grid-cols-[auto_1fr_auto_auto] items-center gap-1 rounded bg-muted px-1.5 py-1 text-sm"
                  >
                    <Icon {...(getIconByName(att.filename) as any)} width={20} height={20} />
                    <span className="max-w-[140px] truncate">{att.filename}</span>
                    <span className="text-xs text-muted-foreground">{formatBytes(att.size)}</span>
                    <Icon
                      icon="material-symbols-light:close-rounded"
                      width="18"
                      height="18"
                      className="cursor-pointer"
                      onClick={() => delAtt(i)}
                    />
                  </div>
                ))}
              </div>
              <div className="ml-auto flex gap-2 whitespace-nowrap">
                <Button variant="outline" onClick={() => setPreviewOpen(true)}>
                  {t('preview')}
                </Button>
                {hasPerm('email:send') && (
                  <Button onClick={sendEmail}>
                    {form.sendType === 'reply'
                      ? t('reply')
                      : form.sendType === 'forward'
                      ? t('forward')
                      : t('send')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('saveDraftConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('saveDraftConfirmDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={discardDraft}>{t('discard')}</AlertDialogCancel>
            <AlertDialogAction onClick={saveDraftAndClose}>{t('save')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[860px]">
          <SheetHeader>
            <SheetTitle>{t('signaturePreview')}</SheetTitle>
          </SheetHeader>
          <div className="m-3 h-[calc(82vh-120px)] overflow-auto rounded-md border border-border p-3">
            <ShadowHtml html={previewHtml()} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

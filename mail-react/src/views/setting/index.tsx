import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { resetPassword, userDelete } from '@/request/my';
import { accountSetName } from '@/request/account';
import { useUserStore } from '@/store/user';
import { useAccountStore } from '@/store/account';
import { useSettingStore } from '@/store/setting';
import { setToken } from '@/request/http';
import PermGate from '@/perm';

interface PasswordErrors {
  oldPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export default function SettingView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const userStore = useUserStore();
  const accountStore = useAccountStore();
  const settingStore = useSettingStore();
  const [setNameShow, setSetNameShow] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);

  const [pwdShow, setPwdShow] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdForm, setPwdForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [pwdErrors, setPwdErrors] = useState<PasswordErrors>({});
  const [pwdVisible, setPwdVisible] = useState({ old: false, neu: false, con: false });

  const [delConfirmShow, setDelConfirmShow] = useState(false);
  const [delLoading, setDelLoading] = useState(false);

  function showSetName() {
    setAccountName(userStore.user?.name || '');
    setSetNameShow(true);
  }

  function validateName(value: string): string | null {
    const v = value.trim();
    if (!v) return t('emptyUserNameMsg');
    if (v.length > 20) return t('userNameTooLongMsg');
    return null;
  }

  async function setName() {
    const trimmed = accountName.trim();
    const err = validateName(trimmed);
    if (err) {
      toast.error(err);
      return;
    }
    const oldName = userStore.user?.name;
    if (trimmed === oldName) {
      setSetNameShow(false);
      return;
    }
    setNameSaving(true);
    try {
      await accountSetName(userStore.user?.account?.accountId, trimmed);
      // Only mutate the store after the server confirms.
      if (userStore.user) userStore.user.name = trimmed;
      accountStore.setChangeUserAccountName(trimmed);
      toast.success(t('saveSuccessMsg'));
      setSetNameShow(false);
    } catch {
      // axios interceptor already toasts. The store is untouched so the header still shows the old name.
    } finally {
      setNameSaving(false);
    }
  }

  function changeLang(lang: 'en' | 'zh') {
    settingStore.setLang(lang);
    window.location.reload();
  }

  function validatePwd(form: typeof pwdForm): PasswordErrors {
    const errors: PasswordErrors = {};
    if (!form.oldPassword) errors.oldPassword = t('emptyOldPwdMsg');
    if (!form.newPassword) errors.newPassword = t('emptyNewPwdMsg');
    else if (form.newPassword.length < 8) errors.newPassword = t('pwdMinLengthMsg', { n: 8 });
    else if (form.newPassword === form.oldPassword) errors.newPassword = t('pwdSameAsOldMsg');
    if (!form.confirmPassword) errors.confirmPassword = t('emptyConfirmPwdMsg');
    else if (form.confirmPassword !== form.newPassword) errors.confirmPassword = t('confirmPwdFailMsg');
    return errors;
  }

  function openPwdDialog() {
    setPwdForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    setPwdErrors({});
    setPwdVisible({ old: false, neu: false, con: false });
    setPwdShow(true);
  }

  function submitPwd() {
    const errors = validatePwd(pwdForm);
    setPwdErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setPwdLoading(true);
    resetPassword(pwdForm.oldPassword, pwdForm.newPassword)
      .then(() => {
        toast.success(t('pwdChangedMsg'));
        setPwdShow(false);
        setPwdForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
        // Force re-login so the session reflects the new credential.
        setToken('');
        navigate('/login', { replace: true });
      })
      .catch(() => {
        // axios already toasted; clear oldPassword so the user retries with a fresh current password.
        setPwdForm((f) => ({ ...f, oldPassword: '' }));
        setPwdErrors({ oldPassword: t('wrongOldPwdMsg') });
      })
      .finally(() => setPwdLoading(false));
  }

  async function doDelete() {
    setDelLoading(true);
    try {
      await userDelete();
      setToken('');
      navigate('/login', { replace: true });
      toast.success(t('delSuccessMsg'));
    } catch {
      // axios already toasted; keep the user on this page so they can retry.
    } finally {
      setDelLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t('settings')}</h1>
      </div>

      <div className="page-body space-y-6">
        <section className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-5 py-3">
            <div className="text-h3 text-foreground">{t('profile')}</div>
          </div>
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div>
                <div className="text-[13px] font-medium text-foreground">{t('username')}</div>
                <div className="mt-0.5 text-[12px] text-muted-foreground">{t('usernameDesc')}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[13px] tabular-nums text-foreground">
                  {userStore.user?.name || '—'}
                </span>
                <Button variant="outline" size="sm" onClick={showSetName}>
                  {t('change')}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div>
                <div className="text-[13px] font-medium text-foreground">{t('emailAccount')}</div>
                <div className="mt-0.5 text-[12px] text-muted-foreground">{t('emailAccountDesc')}</div>
              </div>
              <span className="font-mono text-[13px] tabular-nums text-foreground">
                {userStore.user?.email || '—'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div>
                <div className="text-[13px] font-medium text-foreground">{t('password')}</div>
                <div className="mt-0.5 text-[12px] text-muted-foreground">{t('passwordDesc')}</div>
              </div>
              <Button variant="outline" size="sm" onClick={openPwdDialog}>
                {t('changePwdBtn')}
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-5 py-3">
            <div className="text-h3 text-foreground">{t('myMailboxes')}</div>
            <div className="mt-0.5 text-[12px] text-muted-foreground">
              {t('sharedWithMe')}
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <Button variant="outline" size="sm" onClick={() => navigate('/settings/my-mailboxes')}>
              {t('myMailboxes')}
            </Button>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-5 py-3">
            <div className="text-h3 text-foreground">{t('language')}</div>
            <div className="mt-0.5 text-[12px] text-muted-foreground">{t('languageDesc')}</div>
          </div>
          <div className="px-5 py-3.5">
            <Select value={settingStore.lang} onValueChange={(v) => changeLang(v as 'en' | 'zh')}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh">中文</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        <PermGate perm="my:delete">
          <section className="rounded-lg border border-destructive/30 bg-card">
            <div className="border-b border-destructive/30 px-5 py-3">
              <div className="text-h3 text-destructive">{t('deleteUser')}</div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">{t('delAccountMsg')}</div>
            </div>
            <div className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div className="text-[12px] text-muted-foreground">{t('delAccountFooter')}</div>
              <Button variant="destructive" size="sm" onClick={() => setDelConfirmShow(true)}>
                {t('deleteUserBtn')}
              </Button>
            </div>
          </section>
        </PermGate>
      </div>

      {/* Username dialog */}
      <Dialog open={setNameShow} onOpenChange={(o) => !nameSaving && setSetNameShow(o)}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t('changeUserName')}</DialogTitle>
            <DialogDescription>{t('changeUserNameDesc')}</DialogDescription>
          </DialogHeader>
          <Input
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            maxLength={20}
            autoComplete="off"
            placeholder={t('username')}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSetNameShow(false)} disabled={nameSaving}>
              {t('cancel')}
            </Button>
            <Button onClick={setName} disabled={nameSaving}>
              {nameSaving ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password change dialog */}
      <Dialog open={pwdShow} onOpenChange={(o) => !pwdLoading && setPwdShow(o)}>
        <DialogContent className="max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{t('changePassword')}</DialogTitle>
            <DialogDescription>{t('changePasswordDesc')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <PasswordField
              id="oldPwd"
              label={t('currentPassword')}
              value={pwdForm.oldPassword}
              visible={pwdVisible.old}
              onToggleVisible={() => setPwdVisible((v) => ({ ...v, old: !v.old }))}
              onChange={(v) => {
                setPwdForm((f) => ({ ...f, oldPassword: v }));
                if (pwdErrors.oldPassword) setPwdErrors((e) => ({ ...e, oldPassword: undefined }));
              }}
              error={pwdErrors.oldPassword}
              autoComplete="current-password"
            />
            <PasswordField
              id="newPwd"
              label={t('newPassword')}
              value={pwdForm.newPassword}
              visible={pwdVisible.neu}
              onToggleVisible={() => setPwdVisible((v) => ({ ...v, neu: !v.neu }))}
              onChange={(v) => {
                setPwdForm((f) => ({ ...f, newPassword: v }));
                if (pwdErrors.newPassword) setPwdErrors((e) => ({ ...e, newPassword: undefined }));
              }}
              error={pwdErrors.newPassword}
              autoComplete="new-password"
            />
            <PasswordField
              id="confirmPwd"
              label={t('confirmNewPassword')}
              value={pwdForm.confirmPassword}
              visible={pwdVisible.con}
              onToggleVisible={() => setPwdVisible((v) => ({ ...v, con: !v.con }))}
              onChange={(v) => {
                setPwdForm((f) => ({ ...f, confirmPassword: v }));
                if (pwdErrors.confirmPassword)
                  setPwdErrors((e) => ({ ...e, confirmPassword: undefined }));
              }}
              error={pwdErrors.confirmPassword}
              autoComplete="new-password"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdShow(false)} disabled={pwdLoading}>
              {t('cancel')}
            </Button>
            <Button onClick={submitPwd} disabled={pwdLoading}>
              {pwdLoading ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account delete confirmation */}
      <AlertDialog open={delConfirmShow} onOpenChange={(o) => !delLoading && setDelConfirmShow(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delAccountConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('delAccountConfirmDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={delLoading}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                doDelete();
              }}
              disabled={delLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {delLoading ? t('deleting') : t('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  visible,
  onToggleVisible,
  onChange,
  error,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  visible: boolean;
  onToggleVisible: () => void;
  onChange: (v: string) => void;
  error?: string;
  autoComplete: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          className={`pr-9 ${error ? 'border-destructive focus-visible:ring-destructive/40' : ''}`}
        />
        <button
          type="button"
          onClick={onToggleVisible}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Icon icon={visible ? 'solar:eye-closed-linear' : 'solar:eye-linear'} width="14" height="14" />
        </button>
      </div>
      {error ? <span className="text-[11px] text-destructive">{error}</span> : null}
    </div>
  );
}
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { login, register } from '@/request/login';
import { websiteConfig } from '@/request/setting';
import { loginUserInfo } from '@/request/my';
import { oauthLinuxDoLogin, oauthBindUser } from '@/request/oauth';
import { setToken } from '@/request/http';
import { useAccountStore } from '@/store/account';
import { useUserStore } from '@/store/user';
import { useSettingStore } from '@/store/setting';
import { useUiStore } from '@/store/ui';
import { permsToRouter } from '@/router/perms';
import { cvtR2Url } from '@/utils/convert';
import { isEmail } from '@/utils/verify-utils';
import { cn } from '@/lib/utils';

type Mode = 'login' | 'register';

export default function LoginView(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const settings = useSettingStore((s) => s.settings);
  const domainList = useSettingStore((s) => s.domainList);
  void domainList;
  const lang = useSettingStore((s) => s.lang);
  const setSettings = useSettingStore((s) => s.setSettings);
  const setDomainList = useSettingStore((s) => s.setDomainList);
  const showNotice = useUiStore((s) => s.showNotice);
  void lang;

  const [mode, setMode] = useState<Mode>('login');
  void mode;
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [, setOauthLoading] = useState(false);
  const [bindLoading, setBindLoading] = useState(false);
  const [showBind, setShowBind] = useState(false);

  const [suffix, setSuffix] = useState('');
  const [form, setForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    code: '',
  });
  const [bindForm, setBindForm] = useState({
    email: '',
    oauthUserId: '',
    code: '',
  });

  const hideLoginDomain = settings?.loginDomain === 1;
  const linuxdoSwitch =
    settings?.linuxdoSwitch === 0 || settings?.linuxdoSwitch === 1
      ? settings.linuxdoSwitch
      : !!settings?.linuxdoClientId;
  const minEmailPrefix = (settings as any)?.minEmailPrefix ?? 0;

  useEffect(() => {
    refreshWebsiteConfig();
    linuxDoGetUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refreshWebsiteConfig() {
    websiteConfig()
      .then((s: any) => {
        setSettings(s);
        setDomainList(s.domainList || []);
        if (!suffix && s.domainList?.length > 0) {
          setSuffix(s.domainList[0]);
        }
        if (s.title) document.title = s.title;
      })
      .catch((e: any) => console.error(e));
  }

  function getFullEmail(email: string) {
    return hideLoginDomain ? email : email + suffix;
  }

  function getEmailName(email: string) {
    return email.split('@')[0];
  }

  async function saveToken(token: string) {
    setToken(token);
    refreshWebsiteConfig();
    const user: any = await loginUserInfo();
    useAccountStore.getState().setCurrentAccountId(user.account?.accountId);
    useAccountStore.getState().setCurrentAccount(user.account);
    useUserStore.setState({ user });
    const permKeys = user.permKeys || [];
    navigate('/inbox');
    showNotice();
    setOauthLoading(false);
    setBindLoading(false);
    setLoginLoading(false);
    setRegisterLoading(false);
    void permsToRouter(permKeys);
  }

  function linuxDoLogin() {
    const clientId = (settings as any)?.linuxdoClientId;
    const redirectUri = encodeURIComponent((settings as any)?.linuxdoCallbackUrl);
    window.location.href =
      `https://connect.linux.do/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid+profile+email`;
  }

  async function linuxDoGetUser() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setOauthLoading(true);
      try {
        const data: any = await oauthLinuxDoLogin(code);
        setBindForm((b) => ({ ...b, oauthUserId: data.userInfo?.oauthUserId || '' }));
        if (!data.token) {
          setShowBind(true);
          setOauthLoading(false);
          toast.warning(t('bindEmailPrompt'));
          return;
        }
        await saveToken(data.token);
      } catch {
        setOauthLoading(false);
      }
    }
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);
  }

  async function submitBind() {
    if (!bindForm.email) {
      toast.error(t('emptyEmailMsg'));
      return;
    }
    if (getEmailName(bindForm.email).length < minEmailPrefix) {
      toast.error(t('minEmailPrefix', { msg: minEmailPrefix }));
      return;
    }
    const email = getFullEmail(bindForm.email);
    if (!isEmail(email)) {
      toast.error(t('notEmailMsg'));
      return;
    }
    if (settings?.regKey === 0 && !bindForm.code) {
      toast.error(t('emptyRegKeyMsg'));
      return;
    }
    setBindLoading(true);
    try {
      const data: any = await oauthBindUser({
        email,
        oauthUserId: bindForm.oauthUserId,
        code: bindForm.code,
      });
      await saveToken(data.token);
    } catch {
      setBindLoading(false);
    }
  }

  async function submit() {
    if (!form.email) {
      toast.error(t('emptyEmailMsg'));
      return;
    }
    const email = getFullEmail(form.email);
    if (!isEmail(email)) {
      toast.error(t('notEmailMsg'));
      return;
    }
    if (!form.password) {
      toast.error(t('emptyPwdMsg'));
      return;
    }
    setLoginLoading(true);
    try {
      const data: any = await login(email, form.password);
      await saveToken(data.token);
    } catch {
      setLoginLoading(false);
    }
  }

  async function submitRegister() {
    if (!registerForm.email) {
      toast.error(t('emptyEmailMsg'));
      return;
    }
    if (getEmailName(registerForm.email).length < minEmailPrefix) {
      toast.error(t('minEmailPrefix', { msg: minEmailPrefix }));
      return;
    }
    const email = getFullEmail(registerForm.email);
    if (!isEmail(email)) {
      toast.error(t('notEmailMsg'));
      return;
    }
    if (!registerForm.password) {
      toast.error(t('emptyPwdMsg'));
      return;
    }
    if (registerForm.password.length < 6) {
      toast.error(t('pwdLengthMsg'));
      return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      toast.error(t('confirmPwdFailMsg'));
      return;
    }
    if (settings?.regKey === 0 && !registerForm.code) {
      toast.error(t('emptyRegKeyMsg'));
      return;
    }
    setRegisterLoading(true);
    try {
      await register({
        email,
        password: registerForm.password,
        code: registerForm.code,
      });
      setMode('login');
      setRegisterForm({ email: '', password: '', confirmPassword: '', code: '' });
      toast.success(t('regSuccessMsg'));
    } catch {
      // handled
    } finally {
      setRegisterLoading(false);
    }
  }

  const loginOpacity = useState(() => {
    const op = (settings as any)?.loginOpacity ?? 1;
    return useUiStore.getState().dark ? `rgba(0, 0, 0, ${op})` : `rgba(255, 255, 255, ${op})`;
  })[0];
  void loginOpacity;

  const backgroundUrl = settings?.background ? cvtR2Url(settings.background) : null;

  return (
    <div className="relative flex min-h-screen w-full bg-background">
      {/* Left visual panel */}
      <div className="relative hidden flex-1 overflow-hidden border-r border-border bg-secondary lg:flex">
        {backgroundUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${backgroundUrl})` }}
          />
        ) : (
          <DefaultBackdrop />
        )}
        <div className="relative z-10 flex w-full flex-col justify-between p-12">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background">
              <Icon icon="mdi:email-fast-outline" width="16" height="16" />
            </span>
            <span className="text-[13px] font-semibold tracking-tight">
              {settings?.title || 'Cloud Mail'}
            </span>
          </div>
          <div className="max-w-md">
            <h1 className="text-display text-foreground">
              {t('loginHeroTitle')}
            </h1>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
              {t('loginHeroSubtitle')}
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums text-muted-foreground">
            <span className="chip-default">{t('loginChipServerless')}</span>
            <span className="chip-default">{t('loginChipInvite')}</span>
            <span className="chip-default">{t('loginChipCustomDomain')}</span>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-10 lg:w-[480px] lg:px-10">
        <div className="w-full max-w-[360px]">
          <div className="mb-8 lg:hidden">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background">
              <Icon icon="mdi:email-fast-outline" width="16" height="16" />
            </span>
          </div>

          <h2 className="text-h2 text-foreground">{settings?.title || 'Cloud Mail'}</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {mode === 'login' ? t('loginTitle') : t('regTitle')}
          </p>

          <form
            className="mt-8 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === 'login') submit();
              else submitRegister();
            }}
          >
            {mode === 'login' ? (
              <>
                <EmailInput
                  email={form.email}
                  onEmail={(v) => setForm({ ...form, email: v })}
                  suffix={suffix}
                  onSuffix={setSuffix}
                  domainList={domainList}
                  hideDomain={hideLoginDomain}
                  placeholder={t('emailAccount')}
                />
                <Input
                  type="password"
                  placeholder={t('password')}
                  autoComplete="off"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="h-9"
                />
                <Button type="submit" disabled={loginLoading} className="mt-2 h-9 w-full">
                  {t('loginBtn')}
                </Button>
              </>
            ) : (
              <>
                <EmailInput
                  email={registerForm.email}
                  onEmail={(v) => setRegisterForm({ ...registerForm, email: v })}
                  suffix={suffix}
                  onSuffix={setSuffix}
                  domainList={domainList}
                  hideDomain={hideLoginDomain}
                  placeholder={t('emailAccount')}
                />
                <Input
                  type="password"
                  placeholder={t('password')}
                  autoComplete="off"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                  className="h-9"
                />
                <Input
                  type="password"
                  placeholder={t('confirmPwd')}
                  autoComplete="off"
                  value={registerForm.confirmPassword}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, confirmPassword: e.target.value })
                  }
                  className="h-9"
                />
                {settings?.regKey !== 1 && (
                  <Input
                    value={(mode === 'register' ? registerForm : bindForm).code}
                    onChange={(e) =>
                      mode === 'register'
                        ? setRegisterForm({ ...registerForm, code: e.target.value })
                        : setBindForm({ ...bindForm, code: e.target.value })
                    }
                    placeholder={settings?.regKey === 0 ? t('regKey') : t('regKeyOptional')}
                    type="text"
                    autoComplete="off"
                    className="h-9"
                  />
                )}
                <Button
                  type="submit"
                  disabled={registerLoading}
                  className="mt-2 h-9 w-full"
                >
                  {t('regBtn')}
                </Button>
              </>
            )}

            {linuxdoSwitch && (
              <Button
                type="button"
                variant="outline"
                onClick={linuxDoLogin}
                className="h-9 w-full"
              >
                <img
                  src="/image/linuxdo.webp"
                  alt=""
                  width={14}
                  height={14}
                  className="mr-2"
                />
                LinuxDo
              </Button>
            )}
          </form>

          {(settings as any)?.register === 0 && (
            <div className="mt-6 text-center text-[12px] text-muted-foreground">
              {mode === 'login' ? t('noAccount') : t('hasAccount')}
              <button
                type="button"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="ml-1 font-medium text-foreground underline-offset-2 hover:underline"
              >
                {mode === 'login' ? t('regSwitch') : t('loginSwitch')}
              </button>
            </div>
          )}

          {(settings as any)?.projectLink && (
            <div className="mt-8 text-center text-[11px] text-muted-foreground/70">
              {t('productEdition')}
            </div>
          )}
        </div>
      </div>

      <Dialog open={showBind} onOpenChange={setShowBind}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t('bindEmailTitle')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-1">
            <EmailInput
              email={bindForm.email}
              onEmail={(v) => setBindForm({ ...bindForm, email: v })}
              suffix={suffix}
              onSuffix={setSuffix}
              domainList={domainList}
              hideDomain={hideLoginDomain}
              placeholder={t('emailAccount')}
            />
            {settings?.regKey !== 1 && (
              <Input
                value={bindForm.code}
                onChange={(e) => setBindForm({ ...bindForm, code: e.target.value })}
                placeholder={settings?.regKey === 0 ? t('regKey') : t('regKeyOptional')}
                type="text"
                autoComplete="off"
                className="h-9"
              />
            )}
            <Button onClick={submitBind} disabled={bindLoading} className="h-9 w-full">
              {t('bind')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmailInput({
  email,
  onEmail,
  suffix,
  onSuffix,
  domainList,
  hideDomain,
  placeholder,
}: {
  email: string;
  onEmail: (v: string) => void;
  suffix: string;
  onSuffix: (v: string) => void;
  domainList: string[];
  hideDomain: boolean;
  placeholder: string;
}) {
  if (hideDomain) {
    return (
      <Input
        value={email}
        onChange={(e) => onEmail(e.target.value)}
        type="text"
        placeholder={placeholder}
        autoComplete="off"
        className="h-9"
      />
    );
  }
  return (
    <div className="flex">
      <Input
        value={email}
        onChange={(e) => onEmail(e.target.value)}
        type="text"
        placeholder={placeholder}
        autoComplete="off"
        className="h-9 rounded-r-none"
      />
      <Select value={suffix} onValueChange={onSuffix}>
        <SelectTrigger className="h-9 w-[120px] rounded-l-none border-l-0 font-mono text-[12px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {domainList.map((d) => (
            <SelectItem key={d} value={d} className="font-mono">
              {d}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DefaultBackdrop() {
  return (
    <div
      aria-hidden
      className={cn(
        'absolute inset-0',
        '[background-image:radial-gradient(oklch(0.85_0.005_250)_1px,transparent_1px)]',
        '[background-size:24px_24px]',
        '[mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]',
        'opacity-60',
      )}
    />
  );
}
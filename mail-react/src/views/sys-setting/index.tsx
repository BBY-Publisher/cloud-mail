import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@iconify/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Loading from '@/components/loading';
import { ConfirmAction } from '@/components/confirm-action';
import {
  deleteBackground,
  setBackground,
  setBlackList,
  settingQuery,
  settingSet,
} from '@/request/setting';
import { useSettingStore } from '@/store/setting';
import { useUiStore } from '@/store/ui';
import { useUserStore } from '@/store/user';
import { useAccountStore } from '@/store/account';
import { cvtR2Url } from '@/utils/convert';
import { isDomain, isEmail } from '@/utils/verify-utils';
import { fileToBase64 } from '@/utils/file-utils';

export default function SysSettingView() {
  const { t } = useTranslation();
  const settingStore = useSettingStore();
  const uiStore = useUiStore();
  const userStore = useUserStore();
  const accountStore = useAccountStore();
  const setting: any = settingStore.settings;

  const [firstLoading, setFirstLoading] = useState(true);
  const [settingLoading, setSettingLoading] = useState(false);
  const [clearS3Loading, setClearS3Loading] = useState(false);
  const [settingReady, setSettingReady] = useState(false);
  const backup = useRef<string>('{}');

  // Edit title
  const [editTitleShow, setEditTitleShow] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  // R2 domain
  const [r2DomainShow, setR2DomainShow] = useState(false);
  const [r2DomainInput, setR2DomainInput] = useState('');

  // Turnstile
  const [turnstileShow, setTurnstileShow] = useState(false);
  const [turnstileForm, setTurnstileForm] = useState({ siteKey: '', secretKey: '' });

  // Background
  const [showSetBackground, setShowSetBackground] = useState(false);
  const [backgroundUrl, setBackgroundUrl] = useState('');
  const [localUpShow, setLocalUpShow] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState('');
  const backgroundFile = useRef<File | null>(null);

  // Resend token
  const [resendTokenFormShow, setResendTokenFormShow] = useState(false);
  const [resendTokenForm, setResendTokenForm] = useState({ domain: '', token: '' });
  const [showResendList, setShowResendList] = useState(false);

  // Blacklist
  const [blackFormShow, setBlackFormShow] = useState(false);
  const [blackListForm, setBlackListForm] = useState<any>({
    blackFrom: [],
    blackSubject: [],
    blackContent: [],
  });

  // Login opacity
  const [loginOpacity, setLoginOpacity] = useState(0);

  // Background delete confirm
  const [delBackgroundOpen, setDelBackgroundOpen] = useState(false);
  const [delBackgroundLoading, setDelBackgroundLoading] = useState(false);

  // Provider override
  const [showProviderOverrideList, setShowProviderOverrideList] = useState(false);
  const [providerOverrideFormShow, setProviderOverrideFormShow] = useState(false);
  const [providerOverrideForm, setProviderOverrideForm] = useState({ domain: '', provider: '' });

  // Brevo webhook
  const [brevoWebhookSecretShow, setBrevoWebhookSecretShow] = useState(false);
  const [brevoWebhookSecretInput, setBrevoWebhookSecretInput] = useState('');

  // Reg verify count
  const [regVerifyCountShow, setRegVerifyCountShow] = useState(false);
  const [addVerifyCountShow, setAddVerifyCountShow] = useState(false);
  const [regVerifyCount, setRegVerifyCount] = useState(1);
  const [addVerifyCount, setAddVerifyCount] = useState(1);

  // S3
  const [addS3Show, setAddS3Show] = useState(false);
  const [s3, setS3] = useState({
    bucket: '',
    endpoint: '',
    region: '',
    s3AccessKey: '',
    s3SecretKey: '',
    forcePathStyle: 1,
  });

  // Email prefix
  const [emailPrefixShow, setEmailPrefixShow] = useState(false);
  const [minEmailPrefix, setMinEmailPrefix] = useState(0);
  const [emailPrefixFilter, setEmailPrefixFilter] = useState<string[]>([]);

  // TG bot
  const [tgSettingShow, setTgSettingShow] = useState(false);
  const [tgBotToken, setTgBotToken] = useState('');
  const [tgChatId, setTgChatId] = useState<string[]>([]);
  const [customDomain, setCustomDomain] = useState('');
  const [tgBotStatus, setTgBotStatus] = useState(0);
  const [tgMsgFrom, setTgMsgFrom] = useState('');
  const [tgMsgTo, setTgMsgTo] = useState('');
  const [tgMsgText, setTgMsgText] = useState('');

  // Third email
  const [thirdEmailShow, setThirdEmailShow] = useState(false);
  const [forwardEmail, setForwardEmail] = useState<string[]>([]);
  const [forwardStatus, setForwardStatus] = useState(0);

  // Forward rules
  const [forwardRulesShow, setForwardRulesShow] = useState(false);
  const [ruleEmail, setRuleEmail] = useState<string[]>([]);
  const [ruleType, setRuleType] = useState(0);

  // Notice popup
  const [noticePopupShow, setNoticePopupShow] = useState(false);
  const [noticeForm, setNoticeForm] = useState<any>({
    notice: 0,
    noticeTitle: '',
    noticeContent: '',
    noticeType: '',
    noticeDuration: '',
    noticePosition: '',
    noticeOffset: 0,
    noticeWidth: 0,
  });

  useEffect(() => {
    getSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getSettings() {
    setSettingReady(false);
    settingQuery()
      .then((s: any) => {
        settingStore.setSettings(s);
        settingStore.setDomainList(s.domainList || []);
        setResendTokenForm((f) => ({ ...f, domain: s.domainList?.[0] || '' }));
        setLoginOpacity(s.loginOpacity ?? 0);
        setMinEmailPrefix(s.minEmailPrefix ?? 0);
        setEmailPrefixFilter(s.emailPrefixFilter || []);
        setFirstLoading(false);
        setBackgroundUrl(s.background?.startsWith('http') ? s.background : '');
        setEditTitle(s.title);
        setR2DomainInput(s.r2Domain || '');
        setAddVerifyCount(s.addVerifyCount || 1);
        setRegVerifyCount(s.regVerifyCount || 1);
        resetNoticeForm();
        resetAddS3Form();
        resetEmailPrefix();
        resetBlackList();
        setTimeout(() => setSettingReady(true), 0);
      });
  }

  function resetNoticeForm() {
    setNoticeForm({
      notice: setting.notice,
      noticeContent: setting.noticeContent,
      noticeDuration: setting.noticeDuration,
      noticeTitle: setting.noticeTitle,
      noticePosition: setting.noticePosition,
      noticeType: setting.noticeType,
      noticeOffset: setting.noticeOffset,
      noticeWidth: setting.noticeWidth,
    });
  }

  function resetAddS3Form() {
    setS3({
      bucket: setting.bucket,
      endpoint: setting.endpoint,
      region: setting.region,
      s3AccessKey: '',
      s3SecretKey: '',
      forcePathStyle: setting.forcePathStyle,
    });
  }

  function resetEmailPrefix() {
    setMinEmailPrefix(setting.minEmailPrefix || 0);
    setEmailPrefixFilter(setting.emailPrefixFilter || []);
  }

  function resetBlackList() {
    setBlackListForm({
      blackFrom: setting.blackFrom ? setting.blackFrom.split(',') : [],
      blackSubject: setting.blackSubject ? setting.blackSubject.split(',') : [],
      blackContent: setting.blackContent ? setting.blackContent.split(',') : [],
    });
  }

  function doOpacityChange() {
    if (!settingReady) return;
    editSetting({ loginOpacity }, true);
  }

  function opacityChange(v: number) {
    setLoginOpacity(v);
    setTimeout(doOpacityChange, 1000);
  }

  const resendList = useMemo(() => {
    const map = setting.resendTokens || {};
    return Object.keys(map).map((key) => ({ key, value: map[key] }));
  }, [setting.resendTokens]);

  const providerOverrideList = useMemo(() => {
    const map = setting.domainProviders || {};
    return Object.entries(map).map(([domain, provider]) => ({ domain, provider }));
  }, [setting.domainProviders]);

  function openNoticePopup() {
    uiStore.showNotice();
  }

  function openNoticePopupSetting() {
    setNoticePopupShow(true);
  }

  function previewNoticePopup() {
    uiStore.previewNotice({ ...noticeForm });
  }

  function saveNoticePopup() {
    editSetting({ ...noticeForm, noticeOffset: noticeForm.noticeOffset || 0, noticeWidth: noticeForm.noticeWidth || 0, noticeDuration: noticeForm.noticeDuration || 0 });
  }

  function openResendList() {
    setShowResendList(true);
  }

  function openResendForm() {
    setResendTokenFormShow(true);
  }

  function saveResendToken() {
    const map = { ...(setting.resendTokens || {}) };
    const domain = (resendTokenForm.domain || '').replace(/^@/, '');
    if (!domain) return;
    map[domain] = resendTokenForm.token;
    editSetting({ resendTokens: map });
  }

  function openProviderOverrideForm() {
    setProviderOverrideForm({ domain: '', provider: '' });
    setProviderOverrideFormShow(true);
  }

  function saveProviderOverride() {
    const domain = providerOverrideForm.domain.replace(/^@/, '');
    const provider = providerOverrideForm.provider;
    if (!domain || !provider) return;
    const map = { ...(setting.domainProviders || {}) };
    map[domain] = provider;
    editSetting({ domainProviders: map });
    setProviderOverrideFormShow(false);
  }

  function removeProviderOverride(domain: string) {
    const map = { ...(setting.domainProviders || {}) };
    map[domain] = 'default';
    editSetting({ domainProviders: map });
  }

  function openBrevoWebhookSecret() {
    setBrevoWebhookSecretInput('');
    setBrevoWebhookSecretShow(true);
  }

  function saveBrevoWebhookSecret() {
    editSetting({ brevoWebhookSecret: brevoWebhookSecretInput.trim() });
  }

  function saveTurnstileKey() {
    editSetting({ siteKey: turnstileForm.siteKey, secretKey: turnstileForm.secretKey });
  }

  function saveTitle() {
    editSetting({ title: editTitle });
  }

  function saveR2domain() {
    editSetting({ r2Domain: r2DomainInput });
  }

  async function saveBackground() {
    let image = '';
    if (localUpShow) {
      if (backgroundFile.current) image = await fileToBase64(backgroundFile.current, true);
    } else {
      if (backgroundUrl && !backgroundUrl.startsWith('http')) {
        toast.error(t('imageLinkErrorMsg'));
        return;
      }
      image = backgroundUrl;
    }
    setSettingLoading(true);
    setBackground(image)
      .then((key: any) => {
        settingStore.setSettings({ ...setting, background: key });
        setShowSetBackground(false);
        toast.success(t('saveSuccessMsg'));
        setLocalUpShow(false);
        setBackgroundImage('');
      })
      .finally(() => setSettingLoading(false));
  }

  function openCut() {
    const doc = document.createElement('input');
    doc.type = 'file';
    doc.accept = 'image/*';
    doc.click();
    doc.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        backgroundFile.current = file;
        setBackgroundImage(URL.createObjectURL(file));
        setLocalUpShow(true);
      }
    };
  }

  function closedSetBackground() {
    setBackgroundImage('');
    setLocalUpShow(false);
    setBackgroundUrl(setting.background?.startsWith('http') ? setting.background : '');
  }
  void closedSetBackground;

  function openBlackListForm() {
    setBlackFormShow(true);
  }

  function openTgSetting() {
    setTgBotStatus(setting.tgBotStatus);
    setTgBotToken('');
    setCustomDomain(setting.customDomain);
    setTgMsgFrom(setting.tgMsgFrom);
    setTgMsgText(setting.tgMsgText);
    setTgMsgTo(setting.tgMsgTo);
    setTgChatId(setting.tgChatId ? setting.tgChatId.split(',') : []);
    setTgSettingShow(true);
  }

  function openThirdEmailSetting() {
    setForwardEmail(setting.forwardEmail ? setting.forwardEmail.split(',') : []);
    setForwardStatus(setting.forwardStatus);
    setThirdEmailShow(true);
  }

  function openForwardRules() {
    setRuleType(setting.ruleType);
    setRuleEmail(setting.ruleEmail ? setting.ruleEmail.split(',') : []);
    setForwardRulesShow(true);
  }

  function tgBotSave() {
    const form: any = {
      customDomain,
      tgBotStatus,
      tgChatId: tgChatId.join(','),
      tgMsgFrom,
      tgMsgText,
      tgMsgTo,
    };
    if (tgBotToken) form.tgBotToken = tgBotToken;
    editSetting(form);
  }

  function forwardEmailSave() {
    editSetting({ forwardStatus, forwardEmail: forwardEmail.join(',') });
  }

  function ruleEmailSave() {
    editSetting({ ruleEmail: ruleEmail.join(','), ruleType });
  }

  function clearS3() {
    setClearS3Loading(true);
    editSetting({
      bucket: '',
      endpoint: '',
      region: '',
      s3AccessKey: '',
      s3SecretKey: '',
      forcePathStyle: 1,
    });
  }

  function saveS3() {
    const form: any = {
      bucket: s3.bucket,
      endpoint: s3.endpoint,
      region: s3.region,
      forcePathStyle: s3.forcePathStyle,
    };
    if (s3.s3AccessKey) form.s3AccessKey = s3.s3AccessKey;
    if (s3.s3SecretKey) form.s3SecretKey = s3.s3SecretKey;
    editSetting(form);
  }

  function saveEmailPrefix() {
    editSetting({ minEmailPrefix, emailPrefixFilter });
  }

  function saveBlackList() {
    setSettingLoading(true);
    setBlackList({
      blackContent: (blackListForm.blackContent || []).join(','),
      blackSubject: (blackListForm.blackSubject || []).join(','),
      blackFrom: (blackListForm.blackFrom || []).join(','),
    })
      .then(() => {
        getSettings();
        toast.success(t('setSuccess'));
        setBlackFormShow(false);
      })
      .finally(() => setSettingLoading(false));
  }

  function delBackground() {
    setDelBackgroundOpen(true);
  }

  async function confirmDelBackground() {
    setDelBackgroundLoading(true);
    try {
      await deleteBackground();
      setBackgroundUrl('');
      settingStore.setSettings({ ...setting, background: null });
      toast.success(t('delSuccessMsg'));
    } catch {
      // axios already toasted
    } finally {
      setDelBackgroundLoading(false);
      setDelBackgroundOpen(false);
    }
  }

  function beforeChange(): boolean {
    if (!settingReady || settingLoading) return false;
    backupSetting();
    return true;
  }

  function backupSetting() {
    const s = { ...setting };
    delete s.resendTokens;
    delete s.domainProviders;
    delete s.siteKey;
    delete s.secretKey;
    delete s.brevoWebhookSecret;
    backup.current = JSON.stringify(setting);
  }

  function change() {
    if (!settingReady) return;
    const form: any = { ...setting };
    delete form.siteKey;
    delete form.secretKey;
    delete form.s3AccessKey;
    delete form.s3SecretKey;
    delete form.tgBotToken;
    delete form.brevoWebhookSecret;
    delete form.resendTokens;
    delete form.domainProviders;
    editSetting(form, false);
  }

  function changeField(key: string, value: any) {
    if (!settingReady) return;
    settingStore.setSettings({ ...setting, [key]: value });
    editSetting({ [key]: value }, false);
  }

  function editSetting(form: Record<string, any>, refreshStatus = true) {
    if (settingLoading) return;
    setSettingLoading(true);
    settingSet(form)
      .then(() => {
        toast.success(t('saveSuccessMsg'));
        if (setting.manyEmail === 1) {
          accountStore.setCurrentAccountId(userStore.user?.account?.accountId || 0);
        }
        if (refreshStatus) getSettings();
        setEditTitleShow(false);
        setR2DomainShow(false);
        setResendTokenFormShow(false);
        setTurnstileShow(false);
        setTgSettingShow(false);
        setThirdEmailShow(false);
        setForwardRulesShow(false);
        setAddVerifyCountShow(false);
        setRegVerifyCountShow(false);
        setNoticePopupShow(false);
        setAddS3Show(false);
        setEmailPrefixShow(false);
        setProviderOverrideFormShow(false);
        setBrevoWebhookSecretShow(false);
      })
      .catch(() => {
        setLoginOpacity(setting.loginOpacity);
        try {
          settingStore.setSettings({ ...setting, ...JSON.parse(backup.current) });
        } catch {}
      })
      .finally(() => {
        setSettingLoading(false);
        setClearS3Loading(false);
      });
  }

  function addChatTag(val: string) {
    const items = Array.from(new Set(val.split(/[,，]/).map((s) => s.trim()).filter(Boolean)));
    setTgChatId((prev) => {
      const next = prev.slice(0, prev.length ? prev.length - 1 : 0);
      items.forEach((id) => {
        if (!isNaN(Number(id)) && !next.includes(id)) next.push(id);
      });
      return next;
    });
  }

  function emailAddTag(val: string) {
    const items = Array.from(new Set(val.split(/[,，]/).map((s) => s.trim()).filter(Boolean)));
    setForwardEmail((prev) => {
      const next = prev.slice(0, prev.length ? prev.length - 1 : 0);
      items.forEach((email) => {
        if (isEmail(email) && !next.includes(email)) next.push(email);
      });
      return next;
    });
  }

  function ruleEmailAddTag(val: string) {
    const items = Array.from(new Set(val.split(/[,，]/).map((s) => s.trim()).filter(Boolean)));
    setRuleEmail((prev) => {
      const next = prev.slice(0, prev.length ? prev.length - 1 : 0);
      items.forEach((email) => {
        if (isEmail(email) && !next.includes(email)) next.push(email);
      });
      return next;
    });
  }

  function banEmailAddTag(val: string) {
    const items = Array.from(new Set(val.split(/[,，]/).map((s) => s.trim()).filter(Boolean)));
    setBlackListForm((prev: any) => {
      const next = prev.blackFrom.slice(0, prev.blackFrom.length ? prev.blackFrom.length - 1 : 0);
      items.forEach((email) => {
        if ((isEmail(email) || isDomain(email)) && !next.includes(email)) next.push(email);
      });
      return { ...prev, blackFrom: next };
    });
  }

  function addTagFilter(val: string) {
    const items = Array.from(new Set(val.split(/[,，]/).map((s) => s.trim()).filter(Boolean)));
    setEmailPrefixFilter((prev) => {
      const next = prev.slice(0, prev.length ? prev.length - 1 : 0);
      items.forEach((s) => {
        if (!next.includes(s)) next.push(s);
      });
      return next;
    });
  }

  function jumpToLoginPage() {
    window.location.reload();
  }
  void jumpToLoginPage;

  if (firstLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  return (
    <div className="settings-container">
      <div className="scroll">
        <div className="scroll-body">
          <div className="card-grid">
            {/* Website */}
            <SettingsCard title={t('websiteSetting')}>
              <SettingItem label={t('websiteReg')}>
                <Switch
                  checked={setting.register === 0}
                  onCheckedChange={(v) => changeField('register', v ? 0 : 1)}
                />
              </SettingItem>
              <SettingItem label={t('loginDomain')}>
                <Switch
                  checked={setting.loginDomain === 1}
                  onCheckedChange={(v) => changeField('loginDomain', v ? 1 : 0)}
                />
              </SettingItem>
              <SettingItem label={t('regKey')}>
                <Select
                  value={String(setting.regKey)}
                  onValueChange={(v) => changeField('regKey', Number(v))}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">{t('enable')}</SelectItem>
                    <SelectItem value="1">{t('disable')}</SelectItem>
                    <SelectItem value="2">{t('optional')}</SelectItem>
                  </SelectContent>
                </Select>
              </SettingItem>
              <SettingItem label={t('addAccount')}>
                <Switch
                  checked={setting.addEmail === 0}
                  onCheckedChange={(v) => changeField('addEmail', v ? 0 : 1)}
                />
              </SettingItem>
              <SettingItem label={t('multipleEmail')}>
                <Switch
                  checked={setting.manyEmail === 0}
                  onCheckedChange={(v) => changeField('manyEmail', v ? 0 : 1)}
                />
              </SettingItem>
              <SettingItem label={t('emailPrefix')}>
                <Button size="sm" variant="outline" onClick={() => setEmailPrefixShow(true)}>
                  <Icon icon="fluent:settings-48-regular" width="18" height="18" />
                </Button>
              </SettingItem>
            </SettingsCard>

            {/* Customization */}
            <SettingsCard title={t('customization')}>
              <SettingItem label={t('websiteTitle')}>
                <div className="flex items-center gap-2">
                  <span>{setting.title}</span>
                  <Button size="sm" variant="outline" onClick={() => setEditTitleShow(true)}>
                    <Icon icon="lsicon:edit-outline" width="16" height="16" />
                  </Button>
                </div>
              </SettingItem>
              <SettingItem label={t('loginBoxOpacity')}>
                <Input
                  type="number"
                  step={0.01}
                  min={0}
                  max={1}
                  value={loginOpacity}
                  onChange={(e) => opacityChange(Number(e.target.value))}
                  className="w-[100px]"
                />
              </SettingItem>
              <SettingItem label={t('loginBackground')} column>
                <div className="flex items-center gap-2 justify-end">
                  <div className="background">
                    {setting.background ? (
                      <img
                        src={cvtR2Url(setting.background)}
                        alt=""
                        className="w-[249px] h-[140px] object-cover rounded"
                      />
                    ) : (
                      <div className="w-[249px] h-[140px] bg-muted flex items-center justify-center rounded">
                        <Icon icon="ph:image" width="24" height="24" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowSetBackground(true)}>
                      <Icon icon="lsicon:edit-outline" width="16" height="16" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={delBackground}>
                      <Icon icon="material-symbols:delete-outline-rounded" width="16" height="16" />
                    </Button>
                  </div>
                </div>
              </SettingItem>
            </SettingsCard>

            {/* Email sending */}
            <SettingsCard title={t('emailSetting')}>
              <SettingItem label={t('receiveEmail')}>
                <Switch
                  checked={setting.receive === 0}
                  onCheckedChange={(v) => changeField('receive', v ? 0 : 1)}
                />
              </SettingItem>
              <SettingItem label={t('autoRefresh')}>
                <Select
                  value={String(setting.autoRefresh)}
                  onValueChange={(v) => changeField('autoRefresh', Number(v))}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">{t('disable')}</SelectItem>
                    <SelectItem value="3">3s</SelectItem>
                    <SelectItem value="5">5s</SelectItem>
                    <SelectItem value="10">10s</SelectItem>
                    <SelectItem value="15">15s</SelectItem>
                    <SelectItem value="20">20s</SelectItem>
                  </SelectContent>
                </Select>
              </SettingItem>
              <SettingItem label={t('sendEmail')}>
                <Switch
                  checked={setting.send === 0}
                  onCheckedChange={(v) => changeField('send', v ? 0 : 1)}
                />
              </SettingItem>
              <SettingItem label={t('noRecipientTitle')}>
                <Switch
                  checked={setting.noRecipient === 0}
                  onCheckedChange={(v) => changeField('noRecipient', v ? 0 : 1)}
                />
              </SettingItem>
              <SettingItem label={t('domainProvider')}>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setShowProviderOverrideList(true)}>
                    <Icon icon="ic:round-list" width="18" height="18" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={openProviderOverrideForm}>
                    <Icon icon="material-symbols:add-rounded" width="16" height="16" />
                  </Button>
                </div>
              </SettingItem>
              <SettingItem label={t('cloudflareEmailSending')}>
                <span>{setting.hasCfEmail ? t('enabled') : t('disabled')}</span>
              </SettingItem>
              <SettingItem label={t('resendToken')}>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={openResendList}>
                    <Icon icon="ic:round-list" width="18" height="18" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={openResendForm}>
                    <Icon icon="material-symbols:add-rounded" width="16" height="16" />
                  </Button>
                </div>
              </SettingItem>
              <SettingItem label={t('brevoSender')}>
                <span>{setting.hasBrevo ? t('enabled') : t('disabled')}</span>
              </SettingItem>
              <SettingItem label={t('brevoWebhookSecret')}>
                <div className="flex items-center gap-2 justify-end">
                  <span className="truncate max-w-[160px]">
                    {setting.hasBrevoWebhookSecret ? t('enabled') : t('disabled')}
                  </span>
                  <Button size="sm" variant="outline" onClick={openBrevoWebhookSecret}>
                    <Icon icon="fluent:settings-48-regular" width="16" height="16" />
                  </Button>
                </div>
              </SettingItem>
              <SettingItem label={t('blackList')}>
                <Button size="sm" variant="outline" onClick={openBlackListForm}>
                  <Icon icon="fluent:settings-48-regular" width="16" height="16" />
                </Button>
              </SettingItem>
            </SettingsCard>

            {/* Object storage */}
            <SettingsCard title={t('oss')}>
              <SettingItem label={t('osDomain')}>
                <div className="flex items-center gap-2 justify-end">
                  <span className="truncate max-w-[160px]">{setting.r2Domain || ''}</span>
                  <Button size="sm" variant="outline" onClick={() => setR2DomainShow(true)}>
                    <Icon icon="lsicon:edit-outline" width="16" height="16" />
                  </Button>
                </div>
              </SettingItem>
              <SettingItem label={t('s3Configuration')}>
                <Button size="sm" variant="outline" onClick={() => setAddS3Show(true)}>
                  <Icon icon="fluent:settings-48-regular" width="18" height="18" />
                </Button>
              </SettingItem>
              <SettingItem label={t('storageType')}>
                <Badge variant="outline">{setting.storageType}</Badge>
              </SettingItem>
            </SettingsCard>

            {/* Email push */}
            <SettingsCard title={t('emailPush')}>
              <SettingItem label={t('tgBot')}>
                <div className="flex items-center gap-2 justify-end">
                  <span>{setting.tgBotStatus === 0 ? t('enabled') : t('disabled')}</span>
                  <Button size="sm" variant="outline" onClick={openTgSetting}>
                    <Icon icon="fluent:settings-48-regular" width="18" height="18" />
                  </Button>
                </div>
              </SettingItem>
              <SettingItem label={t('otherEmail')}>
                <div className="flex items-center gap-2 justify-end">
                  <span>{setting.forwardStatus === 0 ? t('enabled') : t('disabled')}</span>
                  <Button size="sm" variant="outline" onClick={openThirdEmailSetting}>
                    <Icon icon="fluent:settings-48-regular" width="18" height="18" />
                  </Button>
                </div>
              </SettingItem>
              <SettingItem label={t('forwardingRules')}>
                <div className="flex items-center gap-2 justify-end">
                  <span>{setting.ruleType === 0 ? t('forwardAll') : t('rules')}</span>
                  <Button size="sm" variant="outline" onClick={openForwardRules}>
                    <Icon icon="fluent:settings-48-regular" width="18" height="18" />
                  </Button>
                </div>
              </SettingItem>
            </SettingsCard>

            {/* Turnstile */}
            <SettingsCard title={t('turnstileSetting')}>
              <SettingItem label={t('signUpVerification')}>
                <div className="flex items-center gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setRegVerifyCountShow(true)}>
                    <Icon icon="fluent:settings-48-regular" width="18" height="18" />
                  </Button>
                  <Select
                    value={String(setting.registerVerify)}
                    onValueChange={(v) => changeField('registerVerify', Number(v))}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">{t('enable')}</SelectItem>
                      <SelectItem value="1">{t('disable')}</SelectItem>
                      <SelectItem value="2">{t('rulesVerify')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </SettingItem>
              <SettingItem label={t('addEmailVerification')}>
                <div className="flex items-center gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setAddVerifyCountShow(true)}>
                    <Icon icon="fluent:settings-48-regular" width="18" height="18" />
                  </Button>
                  <Select
                    value={String(setting.addEmailVerify)}
                    onValueChange={(v) => changeField('addEmailVerify', Number(v))}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">{t('enable')}</SelectItem>
                      <SelectItem value="1">{t('disable')}</SelectItem>
                      <SelectItem value="2">{t('rulesVerify')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </SettingItem>
              <SettingItem label="Site Key">
                <div className="flex items-center gap-2 justify-end">
                  <span className="truncate max-w-[160px]">{setting.siteKey}</span>
                  <Button size="sm" variant="outline" onClick={() => setTurnstileShow(true)}>
                    <Icon icon="lsicon:edit-outline" width="16" height="16" />
                  </Button>
                </div>
              </SettingItem>
              <SettingItem label="Secret Key">
                <div className="flex items-center gap-2 justify-end">
                  <span className="truncate max-w-[160px]">{setting.secretKey}</span>
                  <Button size="sm" variant="outline" onClick={() => setTurnstileShow(true)}>
                    <Icon icon="lsicon:edit-outline" width="16" height="16" />
                  </Button>
                </div>
              </SettingItem>
            </SettingsCard>

            {/* Notice */}
            <SettingsCard title={t('noticeTitle')}>
              <SettingItem label={t('noticePopup')}>
                <div className="flex items-center gap-2 justify-end">
                  <span>{setting.notice === 0 ? t('enabled') : t('disabled')}</span>
                  <Button size="sm" variant="outline" onClick={openNoticePopupSetting}>
                    <Icon icon="fluent:settings-48-regular" width="18" height="18" />
                  </Button>
                </div>
              </SettingItem>
              <SettingItem label={t('popUp')}>
                <Button size="sm" variant="outline" onClick={openNoticePopup}>
                  <Icon icon="mynaui:click-solid" width="18" height="18" />
                </Button>
              </SettingItem>
            </SettingsCard>

            {/* About */}
            <SettingsCard title={t('about')}>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span>{t('version')}:</span>
                  <span className="font-mono text-[13px] text-foreground">v3.0.0</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{t('productEdition')}</span>
                </div>
              </div>
            </SettingsCard>
          </div>
        </div>
      </div>

      {/* Edit title */}
      <Dialog open={editTitleShow} onOpenChange={setEditTitleShow}>
        <DialogContent className="max-w-[340px]">
          <DialogHeader>
            <DialogTitle>{t('changeTitle')}</DialogTitle>
          </DialogHeader>
          <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder={t('websiteTitle')} />
          <Button onClick={saveTitle} disabled={settingLoading} className="mt-2 w-full">
            {t('save')}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Resend token */}
      <Dialog open={resendTokenFormShow} onOpenChange={setResendTokenFormShow}>
        <DialogContent className="max-w-[340px]">
          <DialogHeader>
            <DialogTitle>{t('resendToken')}</DialogTitle>
          </DialogHeader>
          <Select
            value={resendTokenForm.domain}
            onValueChange={(v) => setResendTokenForm((f) => ({ ...f, domain: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {settingStore.domainList.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={resendTokenForm.token}
            onChange={(e) => setResendTokenForm((f) => ({ ...f, token: e.target.value }))}
            placeholder={t('addResendTokenDesc')}
            className="mt-3"
          />
          <Button onClick={saveResendToken} disabled={settingLoading} className="mt-2 w-full">
            {t('save')}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Brevo webhook secret */}
      <Dialog open={brevoWebhookSecretShow} onOpenChange={setBrevoWebhookSecretShow}>
        <DialogContent className="max-w-[380px]">
          <DialogHeader>
            <DialogTitle>{t('brevoWebhookSecret')}</DialogTitle>
          </DialogHeader>
          <Input
            type="password"
            autoComplete="new-password"
            value={brevoWebhookSecretInput}
            onChange={(e) => setBrevoWebhookSecretInput(e.target.value)}
            placeholder={t('brevoWebhookSecretPlaceholder')}
          />
          <p className="text-sm text-muted-foreground">{t('brevoWebhookSecretDesc')}</p>
          <Button
            onClick={saveBrevoWebhookSecret}
            disabled={settingLoading}
            className="mt-2 w-full"
          >
            {t('save')}
          </Button>
        </DialogContent>
      </Dialog>

      {/* R2 domain */}
      <Dialog open={r2DomainShow} onOpenChange={setR2DomainShow}>
        <DialogContent className="max-w-[340px]">
          <DialogHeader>
            <DialogTitle>{t('addOsDomain')}</DialogTitle>
          </DialogHeader>
          <Input
            value={r2DomainInput}
            onChange={(e) => setR2DomainInput(e.target.value)}
            placeholder={t('domainDesc')}
          />
          <Button onClick={saveR2domain} disabled={settingLoading} className="mt-2 w-full">
            {t('save')}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Turnstile */}
      <Dialog open={turnstileShow} onOpenChange={setTurnstileShow}>
        <DialogContent className="max-w-[340px]">
          <DialogHeader>
            <DialogTitle>{t('addTurnstileSecret')}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Site Key"
            value={turnstileForm.siteKey}
            onChange={(e) => setTurnstileForm((f) => ({ ...f, siteKey: e.target.value }))}
          />
          <Input
            placeholder="Secret Key"
            className="mt-3"
            value={turnstileForm.secretKey}
            onChange={(e) => setTurnstileForm((f) => ({ ...f, secretKey: e.target.value }))}
          />
          <Button onClick={saveTurnstileKey} disabled={settingLoading} className="mt-2 w-full">
            {t('save')}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Background */}
      <Dialog open={showSetBackground} onOpenChange={(o) => (!o ? setShowSetBackground(false) : null)}>
        <DialogContent className="max-w-[760px]">
          <DialogHeader>
            <DialogTitle>{t('backgroundTitle')}</DialogTitle>
          </DialogHeader>
          {!localUpShow ? (
            <Input
              value={backgroundUrl}
              onChange={(e) => setBackgroundUrl(e.target.value)}
              placeholder={t('backgroundUrlDesc')}
              className="mt-2"
            />
          ) : (
            <div className="mt-2">
              {backgroundImage && (
                <img src={backgroundImage} className="rounded w-full max-h-[400px] object-cover" alt="" />
              )}
            </div>
          )}
          <div className="flex justify-between mt-3">
            {!localUpShow ? (
              <Button variant="link" onClick={openCut}>
                {t('localUpload')}
              </Button>
            ) : (
              <Button variant="link" onClick={() => setLocalUpShow(false)}>
                {t('imageLink')}
              </Button>
            )}
            <Button onClick={saveBackground} disabled={settingLoading}>
              {t('save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* TG bot */}
      <Dialog open={tgSettingShow} onOpenChange={setTgSettingShow}>
        <DialogContent className="max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('tgBot')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder={setting.tgBotToken || t('tgBotToken')}
              value={tgBotToken}
              onChange={(e) => setTgBotToken(e.target.value)}
            />
            <Input
              placeholder={t('toBotTokenDesc')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addChatTag((e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).value = '';
                }
              }}
            />
            {tgChatId.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tgChatId.map((c) => (
                  <Badge key={c} variant="secondary" className="gap-1">
                    {c}
                    <Icon
                      icon="material-symbols-light:close-rounded"
                      width="12"
                      height="12"
                      className="cursor-pointer"
                      onClick={() => setTgChatId((p) => p.filter((x) => x !== c))}
                    />
                  </Badge>
                ))}
              </div>
            )}
            <Input
              placeholder={t('customDomainDesc')}
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select value={tgMsgFrom} onValueChange={setTgMsgFrom}>
                <SelectTrigger>
                  <SelectValue placeholder={t('from')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="show">{t('show')}</SelectItem>
                  <SelectItem value="hide">{t('hide')}</SelectItem>
                  <SelectItem value="only-name">{t('onlyName')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tgMsgTo} onValueChange={setTgMsgTo}>
                <SelectTrigger>
                  <SelectValue placeholder={t('recipient')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="show">{t('show')}</SelectItem>
                  <SelectItem value="hide">{t('hide')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Select value={tgMsgText} onValueChange={setTgMsgText}>
              <SelectTrigger>
                <SelectValue placeholder={t('emailText')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="show">{t('show')}</SelectItem>
                <SelectItem value="hide">{t('hide')}</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={tgBotStatus === 0}
                  onCheckedChange={(v) => setTgBotStatus(v ? 0 : 1)}
                />
                <span>{tgBotStatus === 0 ? t('enable') : t('disable')}</span>
              </div>
              <Button onClick={tgBotSave} disabled={settingLoading}>
                {t('save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Third email */}
      <Dialog open={thirdEmailShow} onOpenChange={setThirdEmailShow}>
        <DialogContent className="max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('otherEmail')}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t('otherEmailInputDesc')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                emailAddTag((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).value = '';
              }
            }}
          />
          {forwardEmail.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {forwardEmail.map((e) => (
                <Badge key={e} variant="secondary" className="gap-1">
                  {e}
                  <Icon
                    icon="material-symbols-light:close-rounded"
                    width="12"
                    height="12"
                    className="cursor-pointer"
                    onClick={() => setForwardEmail((p) => p.filter((x) => x !== e))}
                  />
                </Badge>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={forwardStatus === 0}
                onCheckedChange={(v) => setForwardStatus(v ? 0 : 1)}
              />
              <span>{forwardStatus === 0 ? t('enable') : t('disable')}</span>
            </div>
            <Button onClick={forwardEmailSave} disabled={settingLoading}>
              {t('save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Forward rules */}
      <Dialog open={forwardRulesShow} onOpenChange={setForwardRulesShow}>
        <DialogContent className="max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('forwardingRules')}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t('ruleEmailsInputDesc')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                ruleEmailAddTag((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).value = '';
              }
            }}
          />
          {ruleEmail.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {ruleEmail.map((e) => (
                <Badge key={e} variant="secondary" className="gap-1">
                  {e}
                  <Icon
                    icon="material-symbols-light:close-rounded"
                    width="12"
                    height="12"
                    className="cursor-pointer"
                    onClick={() => setRuleEmail((p) => p.filter((x) => x !== e))}
                  />
                </Badge>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between mt-2">
            <Select value={String(ruleType)} onValueChange={(v) => setRuleType(Number(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{t('forwardAll')}</SelectItem>
                <SelectItem value="1">{t('rules')}</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={ruleEmailSave} disabled={settingLoading}>
              {t('save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resend list */}
      <Dialog open={showResendList} onOpenChange={setShowResendList}>
        <DialogContent className="max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('resendTokenList')}</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('domain')}</TableHead>
                <TableHead>Token</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resendList.map((r) => (
                <TableRow key={r.key}>
                  <TableCell>{r.key}</TableCell>
                  <TableCell>{r.value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* Provider override list */}
      <Dialog open={showProviderOverrideList} onOpenChange={setShowProviderOverrideList}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t('providerOverrideTitle')}</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('domain')}</TableHead>
                <TableHead>{t('provider')}</TableHead>
                <TableHead className="w-[80px]">{t('action')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providerOverrideList.map((r) => (
                <TableRow key={r.domain}>
                  <TableCell>{r.domain}</TableCell>
                  <TableCell>{(r as any).provider}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => removeProviderOverride(r.domain)}>
                      <Icon icon="material-symbols:delete-outline-rounded" width="16" height="16" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* Provider override form */}
      <Dialog open={providerOverrideFormShow} onOpenChange={setProviderOverrideFormShow}>
        <DialogContent className="max-w-[340px]">
          <DialogHeader>
            <DialogTitle>{t('setProvider')}</DialogTitle>
          </DialogHeader>
          <Select
            value={providerOverrideForm.domain}
            onValueChange={(v) => setProviderOverrideForm((f) => ({ ...f, domain: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('domain')} />
            </SelectTrigger>
            <SelectContent>
              {settingStore.domainList.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={providerOverrideForm.provider}
            onValueChange={(v) => setProviderOverrideForm((f) => ({ ...f, provider: v }))}
          >
            <SelectTrigger className="mt-3">
              <SelectValue placeholder={t('provider')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cf" disabled={!setting.hasCfEmail}>
                {t('cloudflareEmailSending')}
              </SelectItem>
              <SelectItem value="resend" disabled={!resendList || resendList.length === 0}>
                {t('resendToken')}
              </SelectItem>
              <SelectItem value="brevo" disabled={!setting.hasBrevo}>
                {t('brevoSender')}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={saveProviderOverride} disabled={settingLoading} className="mt-3 w-full">
            {t('save')}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Verify counts */}
      <Dialog open={regVerifyCountShow} onOpenChange={setRegVerifyCountShow}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('rulesVerifyTitle', { count: regVerifyCount })}</DialogTitle>
          </DialogHeader>
          <Input
            type="number"
            min={1}
            value={regVerifyCount}
            onChange={(e) => setRegVerifyCount(Number(e.target.value))}
          />
          <Button
            onClick={() => editSetting({ regVerifyCount: regVerifyCount || 1 })}
            disabled={settingLoading}
            className="mt-3 w-full"
          >
            {t('save')}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={addVerifyCountShow} onOpenChange={setAddVerifyCountShow}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('rulesVerifyTitle', { count: addVerifyCount })}</DialogTitle>
          </DialogHeader>
          <Input
            type="number"
            min={1}
            value={addVerifyCount}
            onChange={(e) => setAddVerifyCount(Number(e.target.value))}
          />
          <Button
            onClick={() => editSetting({ addVerifyCount: addVerifyCount || 1 })}
            disabled={settingLoading}
            className="mt-3 w-full"
          >
            {t('save')}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Notice popup */}
      <Dialog open={noticePopupShow} onOpenChange={setNoticePopupShow}>
        <DialogContent className="max-w-[820px]">
          <DialogHeader>
            <DialogTitle>{t('noticePopup')}</DialogTitle>
          </DialogHeader>
          <Input
            value={noticeForm.noticeTitle}
            onChange={(e) => setNoticeForm((f: any) => ({ ...f, noticeTitle: e.target.value }))}
            placeholder={t('titleDesc')}
          />
          <div className="grid grid-cols-3 gap-3 mt-3">
            <Select
              value={noticeForm.noticeType}
              onValueChange={(v) => setNoticeForm((f: any) => ({ ...f, noticeType: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('icon')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="primary">Primary</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={noticeForm.noticePosition}
              onValueChange={(v) => setNoticeForm((f: any) => ({ ...f, noticePosition: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('position')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top-left">{t('topLeft')}</SelectItem>
                <SelectItem value="top-right">{t('topRight')}</SelectItem>
                <SelectItem value="bottom-left">{t('bottomLeft')}</SelectItem>
                <SelectItem value="bottom-right">{t('bottomRight')}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={200}
              max={1200}
              value={noticeForm.noticeWidth}
              onChange={(e) => setNoticeForm((f: any) => ({ ...f, noticeWidth: Number(e.target.value) }))}
              placeholder={t('width')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Input
              type="number"
              min={0}
              max={200}
              value={noticeForm.noticeOffset}
              onChange={(e) => setNoticeForm((f: any) => ({ ...f, noticeOffset: Number(e.target.value) }))}
              placeholder={t('offset')}
            />
            <Input
              type="number"
              min={1}
              max={60}
              value={noticeForm.noticeDuration}
              onChange={(e) => setNoticeForm((f: any) => ({ ...f, noticeDuration: Number(e.target.value) }))}
              placeholder={t('duration')}
            />
          </div>
          <textarea
            value={noticeForm.noticeContent}
            onChange={(e) => setNoticeForm((f: any) => ({ ...f, noticeContent: e.target.value }))}
            placeholder={t('noticeContentDesc')}
            rows={6}
            className="w-full mt-3 rounded-md border bg-background p-2 text-sm"
          />
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={noticeForm.notice === 0}
                onCheckedChange={(v) => setNoticeForm((f: any) => ({ ...f, notice: v ? 0 : 1 }))}
              />
              <span>{noticeForm.notice === 0 ? t('enable') : t('disable')}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={previewNoticePopup}>
                {t('preview')}
              </Button>
              <Button onClick={saveNoticePopup} disabled={settingLoading}>
                {t('save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* S3 */}
      <Dialog open={addS3Show} onOpenChange={setAddS3Show}>
        <DialogContent className="max-w-[340px]">
          <DialogHeader>
            <DialogTitle>{t('s3Configuration')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Bucket" value={s3.bucket} onChange={(e) => setS3({ ...s3, bucket: e.target.value })} />
            <Input placeholder="Endpoint" value={s3.endpoint} onChange={(e) => setS3({ ...s3, endpoint: e.target.value })} />
            <Input placeholder="Region" value={s3.region} onChange={(e) => setS3({ ...s3, region: e.target.value })} />
            <Input placeholder={setting.s3AccessKey || 'Access Key'} value={s3.s3AccessKey} onChange={(e) => setS3({ ...s3, s3AccessKey: e.target.value })} />
            <Input placeholder={setting.s3SecretKey || 'Secret Key'} value={s3.s3SecretKey} onChange={(e) => setS3({ ...s3, s3SecretKey: e.target.value })} />
            <div className="flex items-center justify-between">
              <span>ForcePathStyle</span>
              <Switch
                checked={s3.forcePathStyle === 0}
                onCheckedChange={(v) => setS3({ ...s3, forcePathStyle: v ? 0 : 1 })}
              />
            </div>
            <div className="grid grid-cols-[80px_1fr] gap-3">
              <Button onClick={clearS3} disabled={clearS3Loading}>
                {t('clear')}
              </Button>
              <Button onClick={saveS3} disabled={settingLoading}>
                {t('save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email prefix */}
      <Dialog open={emailPrefixShow} onOpenChange={setEmailPrefixShow}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('emailPrefix')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span>{t('atLeast')}</span>
              <Input
                type="number"
                min={1}
                max={20}
                value={minEmailPrefix}
                onChange={(e) => setMinEmailPrefix(Number(e.target.value))}
                className="w-[150px]"
              />
            </div>
            <div>
              <div className="mb-2">{t('mustNotContain')}</div>
              <Input
                placeholder={t('mustNotContainDesc')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addTagFilter((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
              {emailPrefixFilter.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {emailPrefixFilter.map((s) => (
                    <Badge key={s} variant="secondary" className="gap-1">
                      {s}
                      <Icon
                        icon="material-symbols-light:close-rounded"
                        width="12"
                        height="12"
                        className="cursor-pointer"
                        onClick={() => setEmailPrefixFilter((p) => p.filter((x) => x !== s))}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <Button onClick={saveEmailPrefix} disabled={settingLoading} className="w-full">
              {t('save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Blacklist */}
      <Dialog open={blackFormShow} onOpenChange={setBlackFormShow}>
        <DialogContent className="max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('blackList')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-sm">{t('blackFromDesc')}</div>
              <Input
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    banEmailAddTag((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
              {blackListForm.blackFrom?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {blackListForm.blackFrom.map((s: string) => (
                    <Badge key={s} variant="secondary" className="gap-1">
                      {s}
                      <Icon
                        icon="material-symbols-light:close-rounded"
                        width="12"
                        height="12"
                        className="cursor-pointer"
                        onClick={() =>
                          setBlackListForm((p: any) => ({
                            ...p,
                            blackFrom: p.blackFrom.filter((x: string) => x !== s),
                          }))
                        }
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="mb-1 text-sm">{t('blackSubjectDesc')}</div>
              <Input
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    const v = (e.target as HTMLInputElement).value;
                    setBlackListForm((p: any) => ({ ...p, blackSubject: [...p.blackSubject, v] }));
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
              {blackListForm.blackSubject?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {blackListForm.blackSubject.map((s: string) => (
                    <Badge key={s} variant="secondary" className="gap-1">
                      {s}
                      <Icon
                        icon="material-symbols-light:close-rounded"
                        width="12"
                        height="12"
                        className="cursor-pointer"
                        onClick={() =>
                          setBlackListForm((p: any) => ({
                            ...p,
                            blackSubject: p.blackSubject.filter((x: string) => x !== s),
                          }))
                        }
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="mb-1 text-sm">{t('blackContentDesc')}</div>
              <Input
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    const v = (e.target as HTMLInputElement).value;
                    setBlackListForm((p: any) => ({ ...p, blackContent: [...p.blackContent, v] }));
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
              {blackListForm.blackContent?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {blackListForm.blackContent.map((s: string) => (
                    <Badge key={s} variant="secondary" className="gap-1">
                      {s}
                      <Icon
                        icon="material-symbols-light:close-rounded"
                        width="12"
                        height="12"
                        className="cursor-pointer"
                        onClick={() =>
                          setBlackListForm((p: any) => ({
                            ...p,
                            blackContent: p.blackContent.filter((x: string) => x !== s),
                          }))
                        }
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <Button onClick={saveBlackList} disabled={settingLoading} className="w-full">
              {t('save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmAction
        open={delBackgroundOpen}
        onOpenChange={(o) => !delBackgroundLoading && !o && setDelBackgroundOpen(false)}
        title={t('delete')}
        description={t('delBackgroundConfirm')}
        confirmText={t('delete')}
        cancelText={t('cancel')}
        destructive
        loading={delBackgroundLoading}
        onConfirm={confirmDelBackground}
      />
    </div>
  );
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="settings-card">
      <div className="card-title">{title}</div>
      <div className="card-content">{children}</div>
    </div>
  );
}

function SettingItem({
  label,
  children,
  column,
}: {
  label: string;
  children: React.ReactNode;
  column?: boolean;
}) {
  return (
    <div className={`setting-item ${column ? 'flex-col' : ''}`}>
      <div>
        <span>{label}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

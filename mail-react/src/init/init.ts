import { setI18nLang } from '@/i18n';
import { setExtend } from '@/utils/day';
import { cvtR2Url } from '@/utils/convert';
import { loginUserInfo } from '@/request/my';
import { websiteConfig } from '@/request/setting';
import { useUserStore } from '@/store/user';
import { useSettingStore } from '@/store/setting';
import { useAccountStore } from '@/store/account';
import { useUiStore } from '@/store/ui';
import { getToken } from '@/request/http';
import { permsToRouter } from '@/router/perms';
import { resetDB, getDB } from '@/db/db';

export interface InitResult {
  hasToken: boolean;
  routes: ReturnType<typeof permsToRouter>;
  setting: Awaited<ReturnType<typeof websiteConfig>>;
}

export async function init(): Promise<InitResult> {
  document.title = '​';

  const settingStore = useSettingStore.getState();
  const userStore = useUserStore.getState();
  const accountStore = useAccountStore.getState();
  const uiStore = useUiStore.getState();

  // Apply persisted theme to <html>
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', uiStore.dark);
  }

  if (!settingStore.lang) {
    let lang = (navigator.language || 'en').split('-')[0];
    lang = lang === 'zh' ? 'zh' : 'en';
    settingStore.setLang(lang as 'en' | 'zh');
  }

  setI18nLang(settingStore.lang);
  setExtend(settingStore.lang);

  const token = getToken();
  let setting: Awaited<ReturnType<typeof websiteConfig>> | null = null;

  if (token) {
    const userPromise = loginUserInfo().catch((e) => {
      console.error(e);
      return null;
    });

    const [s, user] = await Promise.all([websiteConfig(), userPromise]);
    setting = s;
    settingStore.setSettings(s);
    settingStore.setDomainList(s.domainList ?? []);

    document.title = s.title;

    if (user) {
      accountStore.setCurrentAccountId(user.account.accountId);
      accountStore.setCurrentAccount(user.account);
      userStore.user = user;

      // Reset DB to ensure per-user Dexie is initialized
      resetDB();
      getDB();
    }
  } else {
    setting = await websiteConfig();
    settingStore.setSettings(setting);
    settingStore.setDomainList(setting.domainList ?? []);
    document.title = setting.title;
  }

  // Pre-load background if configured
  if (setting?.background) {
    await new Promise<void>((resolve) => {
      const src = cvtR2Url(setting?.background);
      const img = new Image();
      img.src = src;
      const finish = () => resolve();
      img.onload = finish;
      img.onerror = finish;
      setTimeout(finish, 3000);
    });
  }

  const routes = permsToRouter(userStore.user?.permKeys ?? []);

  return { hasToken: !!token, routes, setting: setting! };
}
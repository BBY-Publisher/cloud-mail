import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WebsiteConfig } from '@/request/setting';

interface SettingState {
  domainList: string[];
  settings: WebsiteConfig;
  lang: 'en' | 'zh';
  setDomainList: (list: string[]) => void;
  setSettings: (s: WebsiteConfig) => void;
  setLang: (lang: 'en' | 'zh') => void;
}

export const useSettingStore = create<SettingState>()(
  persist(
    (set) => ({
      domainList: [],
      settings: {} as WebsiteConfig,
      lang: 'en',
      setDomainList: (list) => set({ domainList: list }),
      setSettings: (s) => set({ settings: s }),
      setLang: (lang) => set({ lang }),
    }),
    {
      name: 'setting',
      partialize: (s) => ({ lang: s.lang }),
    },
  ),
);
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AsideCount {
  email: number;
  send: number;
  sysEmail: number;
}

interface UiState {
  asideShow: boolean;
  accountShow: boolean;
  backgroundLoading: boolean;
  changeNotice: number;
  writerRef: any;
  changePreview: number;
  previewData: any;
  key: number;
  dark: boolean;
  asideCount: AsideCount;
  writerShow: boolean;
  writerData: any;
  setAsideShow: (b: boolean) => void;
  setAccountShow: (b: boolean) => void;
  setBackgroundLoading: (b: boolean) => void;
  showNotice: () => void;
  setWriterRef: (ref: any) => void;
  previewNotice: (data: any) => void;
  toggleDark: () => void;
  setDark: (b: boolean) => void;
  setAsideCount: (c: Partial<AsideCount>) => void;
  openWriter: (data?: any) => void;
  closeWriter: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      asideShow: typeof window !== 'undefined' ? window.innerWidth > 1024 : true,
      accountShow: false,
      backgroundLoading: true,
      changeNotice: 0,
      writerRef: null,
      changePreview: 0,
      previewData: {},
      key: 0,
      dark: false,
      asideCount: { email: 0, send: 0, sysEmail: 0 },
      writerShow: false,
      writerData: null,
      setAsideShow: (b) => set({ asideShow: b }),
      setAccountShow: (b) => set({ accountShow: b }),
      setBackgroundLoading: (b) => set({ backgroundLoading: b }),
      showNotice: () => set((s) => ({ changeNotice: s.changeNotice + 1 })),
      setWriterRef: (ref) => set({ writerRef: ref }),
      previewNotice: (data) =>
        set((s) => ({ previewData: data, changePreview: s.changePreview + 1 })),
      toggleDark: () =>
        set((s) => {
          const next = !s.dark;
          if (typeof document !== 'undefined') {
            document.documentElement.classList.toggle('dark', next);
            const metaTag = document.getElementById('theme-color-meta');
            if (metaTag) {
              const isMobile = !window.matchMedia('(pointer: fine) and (hover: hover)').matches;
              metaTag.setAttribute(
                'content',
                next ? (isMobile ? '#09090b' : '#000000') : isMobile ? '#FFFFFF' : '#F1F1F1',
              );
            }
          }
          return { dark: next };
        }),
      setDark: (b) => set({ dark: b }),
      setAsideCount: (c) => set((s) => ({ asideCount: { ...s.asideCount, ...c } })),
      openWriter: (data) => set({ writerShow: true, writerData: data ?? null }),
      closeWriter: () => set({ writerShow: false }),
    }),
    {
      name: 'ui',
      partialize: (s) => ({ accountShow: s.accountShow, dark: s.dark }),
    },
  ),
);
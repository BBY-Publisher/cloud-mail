import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ContentData {
  email: any;
  delType: 'logic' | 'real';
  showUnread?: boolean;
  showStar: boolean;
  showReply: boolean;
}

interface EmailState {
  deleteIds: number;
  starScroll: any;
  emailScroll: any;
  cancelStarEmailId: number;
  addStarEmailId: number;
  contentData: ContentData;
  sendScroll: any;
  setDeleteIds: (n: number) => void;
  setStarScroll: (ref: any) => void;
  setEmailScroll: (ref: any) => void;
  setCancelStarEmailId: (n: number) => void;
  setAddStarEmailId: (n: number) => void;
  setContentData: (d: ContentData) => void;
  setSendScroll: (ref: any) => void;
}

export const useEmailStore = create<EmailState>()(
  persist(
    (set) => ({
      deleteIds: 0,
      starScroll: null,
      emailScroll: null,
      cancelStarEmailId: 0,
      addStarEmailId: 0,
      contentData: {
        email: null,
        delType: 'logic',
        showUnread: false,
        showStar: false,
        showReply: false,
      },
      sendScroll: null,
      setDeleteIds: (n) => set({ deleteIds: n }),
      setStarScroll: (ref) => set({ starScroll: ref }),
      setEmailScroll: (ref) => set({ emailScroll: ref }),
      setCancelStarEmailId: (n) => set({ cancelStarEmailId: n }),
      setAddStarEmailId: (n) => set({ addStarEmailId: n }),
      setContentData: (d) => set({ contentData: d }),
      setSendScroll: (ref) => set({ sendScroll: ref }),
    }),
    {
      name: 'email',
      partialize: (s) => ({ contentData: s.contentData }),
    },
  ),
);
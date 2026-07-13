import { create } from 'zustand';

interface SendState {
  deleteId: number;
  setDeleteId: (n: number) => void;
}

export const useSendStore = create<SendState>((set) => ({
  deleteId: 0,
  setDeleteId: (n) => set({ deleteId: n }),
}));
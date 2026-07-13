import { create } from 'zustand';

interface DraftState {
  refreshList: number;
  setDraft: any;
  setRefreshList: (n: number) => void;
  setSetDraft: (d: any) => void;
}

export const useDraftStore = create<DraftState>((set) => ({
  refreshList: 0,
  setDraft: {},
  setRefreshList: (n) => set({ refreshList: n }),
  setSetDraft: (d) => set({ setDraft: d }),
}));
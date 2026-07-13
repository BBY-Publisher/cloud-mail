import { create } from 'zustand';

interface RoleState {
  refresh: number;
  refreshSelect: () => void;
}

export const useRoleStore = create<RoleState>((set) => ({
  refresh: 0,
  refreshSelect: () => set((s) => ({ refresh: s.refresh + 1 })),
}));
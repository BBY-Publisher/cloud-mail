import { create } from 'zustand';
import { loginUserInfo } from '@/request/my';
import type { LoginUserInfo } from '@/request/account';

interface UserState {
  user: LoginUserInfo | null;
  refreshList: number;
  refreshUserList: () => Promise<void>;
  refreshUserInfo: () => Promise<void>;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  refreshList: 0,
  refreshUserList: async () => {
    await loginUserInfo();
    set((s) => ({ refreshList: s.refreshList + 1 }));
  },
  refreshUserInfo: async () => {
    const user = await loginUserInfo();
    set({ user });
  },
}));
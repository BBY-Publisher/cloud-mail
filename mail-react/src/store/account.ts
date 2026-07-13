import { create } from 'zustand';
import type { UserAccount } from '@/request/account';

interface AccountState {
  currentAccountId: number;
  currentAccount: UserAccount | null;
  changeUserAccountName: string;
  setCurrentAccountId: (id: number) => void;
  setCurrentAccount: (acc: UserAccount) => void;
  setChangeUserAccountName: (name: string) => void;
}

export const useAccountStore = create<AccountState>((set) => ({
  currentAccountId: 0,
  currentAccount: null,
  changeUserAccountName: '',
  setCurrentAccountId: (id) => set({ currentAccountId: id }),
  setCurrentAccount: (acc) => set({ currentAccount: acc }),
  setChangeUserAccountName: (name) => set({ changeUserAccountName: name }),
}));
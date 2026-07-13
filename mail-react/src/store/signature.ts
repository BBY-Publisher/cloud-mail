import { create } from 'zustand';

interface SignatureState {
  refresh: number;
  refreshSignature: () => void;
}

export const useSignatureStore = create<SignatureState>((set) => ({
  refresh: 0,
  refreshSignature: () => set((s) => ({ refresh: s.refresh + 1 })),
}));
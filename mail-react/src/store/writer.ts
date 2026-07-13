import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface RecipientRecord {
  email: string;
  name?: string;
}

interface WriterState {
  sendRecipientRecord: RecipientRecord[];
  setSendRecipientRecord: (r: RecipientRecord[]) => void;
  pushRecipientRecord: (r: RecipientRecord) => void;
}

const MAX_RECIPIENTS = 500;

export const useWriterStore = create<WriterState>()(
  persist(
    (set) => ({
      sendRecipientRecord: [],
      setSendRecipientRecord: (r) => set({ sendRecipientRecord: r }),
      pushRecipientRecord: (r) =>
        set((s) => {
          const filtered = s.sendRecipientRecord.filter((x) => x.email !== r.email);
          return { sendRecipientRecord: [r, ...filtered].slice(0, MAX_RECIPIENTS) };
        }),
    }),
    { name: 'writer' },
  ),
);
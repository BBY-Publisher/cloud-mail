import Dexie, { type Table } from 'dexie';
import { useUserStore } from '@/store/user';

export interface DraftRecord {
  draftId?: number;
  subject: string;
  toEmail: string;
  content: string;
  createTime: number;
  accountId: number;
}

export interface AttRecord {
  draftId: number;
  atts: { name: string; base64: string; size: number }[];
}

class MailDB extends Dexie {
  draft!: Table<DraftRecord, number>;
  att!: Table<AttRecord, number>;

  constructor(email: string) {
    super(`mail_${email}`);
    this.version(1).stores({
      draft: '++draftId, createTime',
      att: 'draftId',
    });
  }
}

let db: MailDB | null = null;

export function getDB(): MailDB {
  const { user } = useUserStore.getState();
  const email = user?.email || 'anon';
  if (!db || db.name !== `mail_${email}`) {
    db = new MailDB(email);
  }
  return db;
}

export function resetDB() {
  if (db) {
    db.close();
    db = null;
  }
}
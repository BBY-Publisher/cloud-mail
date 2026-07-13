import http, { unwrap } from './http';

export interface UserAccount {
  accountId: number;
  email: string;
  name?: string;
  allReceive: number;
}

export interface UserRole {
  roleId: number;
  name: string;
  sendType: string;
  sendCount: number;
  accountCount: number;
  banEmail?: number;
  banEmailType?: string;
}

export interface LoginUserInfo {
  userId: number;
  email: string;
  name: string;
  sendCount: number;
  type: number;
  role: UserRole;
  permKeys: string[];
  account: UserAccount;
}

export type AccountPerm = 'owner' | 'admin' | 'sender' | 'viewer' | null;

export interface AccountListItem {
  accountId: number;
  email: string;
  name?: string;
  userId?: number;
  ownerEmail?: string;
  status?: number;
  allReceive: number;
  sort?: number;
  perm?: AccountPerm;
  memberCount?: number;
}

export interface AccountMember {
  userId: number;
  email: string;
  role: AccountPerm;
  roleValue: number;
  status: number;
  isDel: number;
  createTime: string;
}

export function accountList(accountId: number, size: number, lastSort?: number) {
  return unwrap<AccountListItem[]>(
    http.get('/account/list', { params: { accountId, size, lastSort } }),
  );
}

export function accountAdd(email: string, token?: string) {
  return unwrap<AccountListItem>(http.post('/account/add', { email, token }));
}

export function accountSetName(accountId: number | undefined, name: string) {
  return unwrap(http.put('/account/setName', { name, accountId }));
}

export function accountDelete(accountId: number) {
  return unwrap(http.delete('/account/delete', { params: { accountId } }));
}

export function accountSetAllReceive(accountId: number) {
  return unwrap(http.put('/account/setAllReceive', { accountId }));
}

export function accountSetAsTop(accountId: number) {
  return unwrap(http.put('/account/setAsTop', { accountId }));
}

export function accountMemberList(accountId: number) {
  return unwrap<AccountMember[]>(http.get('/account/member/list', { params: { accountId } }));
}

export function accountMemberAdd(accountId: number, email: string, role: number | string) {
  return unwrap(http.post('/account/member/add', { accountId, email, role }));
}

export function accountMemberRemove(accountId: number, userId: number) {
  return unwrap(http.delete('/account/member/remove', { params: { accountId, userId } }));
}

export function accountMemberSetRole(accountId: number, userId: number, role: number | string) {
  return unwrap(http.put('/account/member/role', { accountId, userId, role }));
}

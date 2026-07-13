import http, { unwrap } from './http';

export function userList(params: Record<string, unknown>): Promise<{ list: any[]; total: number }> {
  return unwrap(
    http.get('/user/list', { params }),
  );
}

export function userSetPwd(params: { userId: number; password: string }) {
  return unwrap(http.put('/user/setPwd', params));
}

export function userSetStatus(params: { userId: number; status: number }) {
  return unwrap(http.put('/user/setStatus', params));
}

export function userSetType(params: Record<string, unknown>) {
  return unwrap(http.put('/user/setType', params));
}

export function userDelete(userIds: number[]) {
  return unwrap(http.delete(`/user/delete?userIds=${userIds.join(',')}`));
}

export function userAdd(form: Record<string, unknown>) {
  return unwrap(http.post('/user/add', form));
}

export function userRestSendCount(userId: number) {
  return unwrap(http.put('/user/resetSendCount', { userId }));
}

export function userRestore(userId: number, type: 'normal' | 'all') {
  return unwrap(http.put('/user/restore', { userId, type }));
}

export function userAllAccount(userId: number, num: number, size: number): Promise<{ list: any[]; total: number }> {
  return unwrap(
    http.get('/user/allAccount', {
      params: { userId, num, size },
    }),
  );
}

export function userDeleteAccount(accountId: number) {
  return unwrap(http.delete('/user/deleteAccount', { params: { accountId } }));
}

export function adminAccountAdd(userId: number, email: string, name?: string) {
  return unwrap(http.post('/admin/account/add', { userId, email, name }));
}

export function adminAccountRename(accountId: number, name: string) {
  return unwrap(http.put('/admin/account/rename', { accountId, name }));
}

export function adminAccountDelete(accountId: number) {
  return unwrap(http.delete('/admin/account/delete', { params: { accountId } }));
}
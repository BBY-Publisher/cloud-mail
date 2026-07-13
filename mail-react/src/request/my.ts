import http, { unwrap } from './http';
import type { LoginUserInfo } from './account';

export function loginUserInfo(): Promise<LoginUserInfo> {
  return unwrap(http.get('/my/loginUserInfo'));
}

export function resetPassword(oldPassword: string, newPassword: string) {
  return unwrap(http.put('/my/resetPassword', { oldPassword, password: newPassword }));
}

export function userDelete() {
  return unwrap(http.delete('/my/delete'));
}

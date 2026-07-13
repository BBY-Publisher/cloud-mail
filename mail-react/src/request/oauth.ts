import http, { unwrap } from './http';

export function oauthLinuxDoLogin(code: string) {
  return unwrap(http.post('/oauth/linuxDo/login', { code }));
}

export function oauthBindUser(form: Record<string, unknown>) {
  return unwrap(http.put('/oauth/bindUser', form));
}
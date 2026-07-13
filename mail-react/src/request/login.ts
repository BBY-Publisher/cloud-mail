import http, { unwrap } from './http';

export function login(email: string, password: string) {
  return unwrap(http.post('/login', { email, password }));
}

export function logout() {
  return unwrap(http.delete('/logout'));
}

export interface RegisterForm {
  email: string;
  password: string;
  cfToken?: string;
  regKey?: string;
  code?: string;
  token?: string;
}

export function register(form: RegisterForm) {
  return unwrap(http.post('/register', form));
}
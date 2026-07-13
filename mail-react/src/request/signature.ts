import http, { unwrap } from './http';

export function signatureList(): Promise<any[]> {
  return unwrap(http.get('/signature/list'));
}

export function signatureGet(email: string): Promise<string> {
  return unwrap(
    http.get('/signature/get', { params: { email }, noMsg: true }),
  );
}

export function signatureSet(params: Record<string, unknown>) {
  return unwrap(http.put('/signature/set', params));
}
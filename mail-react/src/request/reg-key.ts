import http, { unwrap } from './http';

export function regKeyList(params: Record<string, unknown>): Promise<{ list: any[]; total: number }> {
  return unwrap(
    http.get('/regKey/list', { params }),
  );
}

export function regKeyAdd(form: Record<string, unknown>) {
  return unwrap(http.post('/regKey/add', form));
}

export function regKeyDelete(regKeyIds: number[]) {
  return unwrap(http.delete(`/regKey/delete?regKeyIds=${regKeyIds.join(',')}`));
}

export function regKeyClearNotUse() {
  return unwrap(http.delete('/regKey/clearNotUse'));
}

export function regKeyHistory(regKeyId: number): Promise<any[]> {
  return unwrap(
    http.get('/regKey/history', { params: { regKeyId } }),
  );
}
import http, { unwrap } from './http';

export function starAdd(emailId: number) {
  return unwrap(http.post(`/star/add?emailId=${emailId}`));
}

export function starCancel(emailId: number) {
  return unwrap(http.delete('/star/cancel', { params: { emailId } }));
}

export function starList(emailId: number, size: number): Promise<{ list: any[]; latestEmail: any }> {
  return unwrap(
    http.get('/star/list', {
      params: { emailId, size },
    }),
  );
}
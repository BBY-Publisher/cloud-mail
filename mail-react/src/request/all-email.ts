import http, { unwrap } from './http';

export function allEmailList(params: Record<string, unknown>): Promise<{ list: any[]; total: number; latestEmail: any }> {
  return unwrap(
    http.get('/allEmail/list', {
      params,
    }),
  );
}

export function allEmailDelete(emailIds: number[]) {
  return unwrap(http.delete(`/allEmail/delete?emailIds=${emailIds.join(',')}`));
}

export function allEmailBatchDelete(params: Record<string, unknown>) {
  return unwrap(http.delete('/allEmail/batchDelete', { params }));
}

export function allEmailLatest(emailId: number): Promise<any[]> {
  return unwrap(
    http.get('/allEmail/latest', {
      params: { emailId },
      noMsg: true,
      timeout: 35000,
    }),
  );
}
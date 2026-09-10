import http, { unwrap } from './http';

export function repairBrevoTime(params: { afterEmailId: number; startDate: string; endDate: string }): Promise<{
  processed: number; updated: number; skipped: number; errors: { emailId: number; message: string }[];
  nextEmailId: number; hasMore: boolean;
}> {
  return unwrap(http.post('/allEmail/repairBrevoTime', params, { noMsg: true, timeout: 120000 }));
}

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

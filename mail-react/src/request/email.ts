import http, { unwrap } from './http';

export interface EmailListResp {
  list: any[];
  total: number;
  latestEmail: any;
}

export function emailList(
  accountId: number,
  allReceive: number,
  emailId: number,
  timeSort: number,
  size: number,
  type: number,
): Promise<EmailListResp> {
  return unwrap(
    http.get('/email/list', {
      params: { accountId, allReceive, emailId, timeSort, size, type },
    }),
  );
}

export function emailDelete(emailIds: number[]) {
  const ids = emailIds.join(',');
  return unwrap(http.delete(`/email/delete?emailIds=${ids}`));
}

export function emailLatest(emailId: number, accountId: number, allReceive: number): Promise<any[]> {
  return unwrap(
    http.get('/email/latest', {
      params: { emailId, accountId, allReceive },
      noMsg: true,
      timeout: 35000,
    }),
  );
}

export function emailRead(emailIds: number[]) {
  return unwrap(http.put('/email/read', { emailIds }));
}

export function emailSend(
  form: FormData | Record<string, any>,
  onProgress?: (e: { loaded: number; total?: number }) => void,
) {
  return unwrap(
    http.post('/email/send', form, {
      noMsg: true,
      onUploadProgress: (e) => onProgress?.(e),
    }),
  );
}
import http, { unwrap } from './http';

export function roleAdd(params: Record<string, unknown>) {
  return unwrap(http.post('/role/add', params));
}

export function rolePermTree(): Promise<any[]> {
  return unwrap(http.get('/role/tree'));
}

export function roleRoleList(): Promise<any[]> {
  return unwrap(http.get('/role/list'));
}

export function roleSet(params: Record<string, unknown>) {
  return unwrap(http.put('/role/set', params));
}

export function roleDelete(roleId: number) {
  return unwrap(http.delete('/role/delete', { params: { roleId } }));
}

export function roleSetDef(roleId: number) {
  return unwrap(http.put('/role/setDefault', { roleId }));
}

export function roleSelectUse(): Promise<any[]> {
  return unwrap(http.get('/role/selectUse'));
}
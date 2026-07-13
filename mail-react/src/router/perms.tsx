import { lazy } from 'react';

const User = lazy(() => import('@/views/user'));
const Role = lazy(() => import('@/views/role'));
const SysSetting = lazy(() => import('@/views/sys-setting'));
const Signature = lazy(() => import('@/views/signature'));
const RegKey = lazy(() => import('@/views/reg-key'));
const AllEmail = lazy(() => import('@/views/all-email'));
const Analysis = lazy(() => import('@/views/analysis'));
const Send = lazy(() => import('@/views/send'));
const Draft = lazy(() => import('@/views/draft'));

export interface RouteMeta {
  title: string;
  name: string;
  menu: boolean;
}

export interface PermRoute {
  path: string;
  name: string;
  element: React.ComponentType;
  handle: { meta: RouteMeta };
}

const ROUTE_PERMS: Record<string, PermRoute> = {
  'email:send': {
    path: '/sent',
    name: 'send',
    element: Send,
    handle: { meta: { title: 'sent', name: 'send', menu: true } },
  },
  'email:send|email:send:drafts': {
    path: '/drafts',
    name: 'draft',
    element: Draft,
    handle: { meta: { title: 'drafts', name: 'draft', menu: false } },
  },
  'user:query': {
    path: '/all-users',
    name: 'user',
    element: User,
    handle: { meta: { title: 'allUsers', name: 'user', menu: true } },
  },
  'role:query': {
    path: '/role',
    name: 'role',
    element: Role,
    handle: { meta: { title: 'permissions', name: 'role', menu: true } },
  },
  'setting:query': {
    path: '/system-setting',
    name: 'sys-setting',
    element: SysSetting,
    handle: { meta: { title: 'SystemSettings', name: 'sys-setting', menu: true } },
  },
  'signature:query': {
    path: '/signatures',
    name: 'signature',
    element: Signature,
    handle: { meta: { title: 'signature', name: 'signature', menu: true } },
  },
  'reg-key:query': {
    path: '/invite-code',
    name: 'reg-key',
    element: RegKey,
    handle: { meta: { title: 'inviteCode', name: 'reg-key', menu: true } },
  },
  'all-email:query': {
    path: '/all-mail',
    name: 'all-email',
    element: AllEmail,
    handle: { meta: { title: 'allMail', name: 'all-email', menu: true } },
  },
  'analysis:query': {
    path: '/analysis',
    name: 'analysis',
    element: Analysis,
    handle: { meta: { title: 'analytics', name: 'analysis', menu: true } },
  },
};

/** Generate the list of routes a user with the given perm keys can access. */
export function permsToRouter(permKeys: string[]): PermRoute[] {
  if (permKeys.includes('*')) {
    return Object.values(ROUTE_PERMS).filter(
      (r) => r.name !== 'draft', // drafts handled via email:send
    );
  }

  const out: PermRoute[] = [];
  for (const route of Object.values(ROUTE_PERMS)) {
    const requiredKeys = Object.entries(ROUTE_PERMS).find(([, r]) => r === route)?.[0] ?? '';
    const alternatives = requiredKeys.split('|');
    if (alternatives.some((k) => permKeys.includes(k))) {
      out.push(route);
    }
  }
  return out;
}
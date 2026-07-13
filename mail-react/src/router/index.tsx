import { Suspense, useEffect, useMemo, useState } from 'react';
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  type RouteObject,
} from 'react-router-dom';
import NProgress from 'nprogress';
import { getToken } from '@/request/http';
import { useSettingStore } from '@/store/setting';
import { cvtR2Url } from '@/utils/convert';
import AppLayout from '@/layouts';
import EmailView from '@/views/email';
import ContentView from '@/views/content';
import StarView from '@/views/star';
import SettingView from '@/views/setting';
import MyMailboxView from '@/views/my-mailbox';
import LoginView from '@/views/login';
import NotFoundView from '@/views/404';
import TestView from '@/views/test';
import { permsToRouter, type PermRoute } from './perms';
import { useUserStore } from '@/store/user';

NProgress.configure({ showSpinner: false, trickleSpeed: 50, minimum: 0.1 });

function removeFirstLoading() {
  const el = document.getElementById('loading-first');
  if (el) el.remove();
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function LoginGuard({ children }: { children: React.ReactNode }) {
  const token = getToken();
  if (token) return <Navigate to="/inbox" replace />;
  return <>{children}</>;
}

function buildRoutes(permRoutes: PermRoute[]): RouteObject[] {
  return [
    {
      path: '/',
      element: (
        <AuthGuard>
          <AppLayout />
        </AuthGuard>
      ),
      children: [
        { index: true, element: <Navigate to="/inbox" replace /> },
        { path: 'inbox', element: <EmailView /> },
        { path: 'message', element: <ContentView /> },
        { path: 'settings', element: <SettingView /> },
        { path: 'settings/my-mailboxes', element: <MyMailboxView /> },
        { path: 'starred', element: <StarView /> },
        ...permRoutes.map((r) => ({
          path: r.path.slice(1),
          element: <r.element />,
          handle: r.handle,
        })),
      ],
    },
    {
      path: '/login',
      element: (
        <LoginGuard>
          <LoginView />
        </LoginGuard>
      ),
    },
    { path: '/test', element: <TestView /> },
    { path: '*', element: <NotFoundView /> },
  ];
}

function Router() {
  const user = useUserStore((s) => s.user);
  const [first, setFirst] = useState(true);
  const settings = useSettingStore((s) => s.settings);

  // First-route effect
  useEffect(() => {
    if (first) {
      setFirst(false);
      removeFirstLoading();
    }
  }, [first]);

  const permRoutes = useMemo(() => permsToRouter(user?.permKeys ?? []), [user]);

  useEffect(() => {
    if (settings?.background) {
      const src = cvtR2Url(settings.background);
      const img = new Image();
      img.src = src;
    }
  }, [settings?.background]);

  const router = useMemo(() => createBrowserRouter(buildRoutes(permRoutes)), [permRoutes]);

  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading…</div>}>
      <RouterProvider router={router} />
    </Suspense>
  );
}

export default Router;
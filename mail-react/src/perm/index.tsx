import { useUserStore } from '@/store/user';

export function hasPerm(permKey: string | string[]): boolean {
  const { user } = useUserStore.getState();
  const keys = user?.permKeys ?? [];
  if (keys.includes('*')) return true;
  if (Array.isArray(permKey)) return permKey.some((k) => keys.includes(k));
  return keys.includes(permKey);
}

interface PermGateProps {
  perm: string | string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermGate({ perm, fallback = null, children }: PermGateProps) {
  if (!hasPerm(perm)) return <>{fallback}</>;
  return <>{children}</>;
}

export default PermGate;
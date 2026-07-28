import { useEffect, useState, type ReactNode } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function SessionGate({ children }: { children: ReactNode }) {
  const checkSession = useAuthStore((state) => state.checkSession);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    checkSession().finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, [checkSession]);

  if (!ready) {
    return <div className="min-h-screen bg-background" aria-busy="true" />;
  }
  return <>{children}</>;
}

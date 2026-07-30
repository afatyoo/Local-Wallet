import { useEffect, useState, type ReactNode } from 'react';
import { setupApi } from '@/lib/api';
import { InitialSetup } from '@/pages/InitialSetup';

export function InitialSetupGate({ children }: { children: ReactNode }) {
  const [required, setRequired] = useState<boolean | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void setupApi.getStatus().then(({ data, error: requestError }) => {
      if (!active) return;
      if (data) {
        setRequired(data.required);
        return;
      }
      setError(requestError || 'Unable to check initial setup status');
    });
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold">Setup check failed</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            className="mt-4 text-sm font-medium text-primary"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (required === null) {
    return <div className="min-h-screen bg-background" aria-busy="true" />;
  }

  if (required) {
    return (
      <InitialSetup
        onComplete={() => {
          window.history.replaceState({}, '', '/dashboard');
          setRequired(false);
        }}
      />
    );
  }

  return <>{children}</>;
}

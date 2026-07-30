import { useCallback, useEffect, useState } from 'react';
import { Laptop, Loader2, LogOut, RefreshCw, Smartphone } from 'lucide-react';
import { authApi, type ApiSession } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function deviceLabel(userAgent: string | null) {
  if (!userAgent) return 'Unknown device';
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Firefox\//.test(userAgent)
      ? 'Firefox'
      : /Chrome\//.test(userAgent)
        ? 'Chrome'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'Browser';
  const platform = /Android/.test(userAgent)
    ? 'Android'
    : /iPhone|iPad/.test(userAgent)
      ? 'iOS'
      : /Windows/.test(userAgent)
        ? 'Windows'
        : /Macintosh/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : '';
  return [browser, platform].filter(Boolean).join(' on ');
}

function isMobile(userAgent: string | null) {
  return /Android|iPhone|iPad/i.test(userAgent || '');
}

export function SessionManagement() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const logout = useAuthStore((state) => state.logout);
  const [sessions, setSessions] = useState<ApiSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await authApi.getSessions();
    if (data) setSessions(data);
    if (error) {
      toast({ title: t('common_error'), description: error, variant: 'destructive' });
    }
    setLoading(false);
  }, [t, toast]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const revoke = async (session: ApiSession) => {
    setBusyId(session.id);
    const { data, error } = await authApi.revokeSession(session.id);
    setBusyId(null);
    if (error || !data) {
      toast({ title: t('common_error'), description: error, variant: 'destructive' });
      return;
    }
    if (data.currentSessionRevoked) {
      await logout();
      return;
    }
    setSessions((current) => current.filter((item) => item.id !== session.id));
    toast({ title: t('common_success'), description: t('sessions_revoked') });
  };

  const revokeOthers = async () => {
    setBusyId('others');
    const { data, error } = await authApi.revokeOtherSessions();
    setBusyId(null);
    if (error || !data) {
      toast({ title: t('common_error'), description: error, variant: 'destructive' });
      return;
    }
    setSessions((current) => current.filter((session) => session.current));
    toast({ title: t('common_success'), description: t('sessions_others_revoked') });
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{t('sessions_title')}</CardTitle>
            <CardDescription>{t('sessions_description')}</CardDescription>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => void loadSessions()}
            disabled={loading}
            title={t('sessions_refresh')}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex h-20 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.map((session) => {
          const DeviceIcon = isMobile(session.userAgent) ? Smartphone : Laptop;
          return (
            <div key={session.id} className="flex items-center gap-3 border-b border-border/50 py-3 last:border-0">
              <DeviceIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{deviceLabel(session.userAgent)}</p>
                  {session.current && (
                    <span className="text-xs font-medium text-income">{t('sessions_current')}</span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {session.ipAddress || t('sessions_unknown_ip')} · {t('sessions_last_active')} {new Date(session.lastSeenAt).toLocaleString()}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => void revoke(session)}
                disabled={busyId !== null}
                title={session.current ? t('sessions_logout_current') : t('sessions_revoke')}
              >
                {busyId === session.id
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <LogOut className="h-4 w-4" />}
              </Button>
            </div>
          );
        })}
        {sessions.length > 1 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => void revokeOthers()}
            disabled={busyId !== null}
            className="w-full"
          >
            {busyId === 'others' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('sessions_logout_others')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

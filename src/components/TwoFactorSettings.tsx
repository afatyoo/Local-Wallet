import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  Loader2,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';
import { authApi } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SetupState {
  setupToken: string;
  secret: string;
  qrDataUrl: string;
}

export function TwoFactorSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [recoveryCodesRemaining, setRecoveryCodesRemaining] = useState(0);
  const [setup, setSetup] = useState<SetupState | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void authApi.getTfaStatus().then(({ data, error }) => {
      if (!active) return;
      if (data) {
        setEnabled(data.enabled);
        setRecoveryCodesRemaining(data.recoveryCodesRemaining);
      } else {
        setEnabled(false);
        if (error) {
          toast({ title: t('common_error'), description: error, variant: 'destructive' });
        }
      }
    });
    return () => {
      active = false;
    };
  }, [t, toast]);

  const startSetup = async () => {
    setIsBusy(true);
    const { data, error } = await authApi.startTfaSetup();
    if (!data) {
      toast({
        title: t('common_error'),
        description: error || t('tfa_setup_error'),
        variant: 'destructive',
      });
      setIsBusy(false);
      return;
    }

    try {
      const QRCode = await import('qrcode');
      const qrDataUrl = await QRCode.toDataURL(data.otpAuthUri, {
        width: 220,
        margin: 1,
        errorCorrectionLevel: 'M',
      });
      setSetup({ setupToken: data.setupToken, secret: data.secret, qrDataUrl });
      setRecoveryCodes([]);
      setVerificationCode('');
    } catch {
      toast({
        title: t('common_error'),
        description: t('tfa_qr_error'),
        variant: 'destructive',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const confirmSetup = async () => {
    if (!setup || !/^\d{6}$/.test(verificationCode.trim())) {
      toast({
        title: t('common_error'),
        description: t('tfa_code_required'),
        variant: 'destructive',
      });
      return;
    }

    setIsBusy(true);
    const { data, error } = await authApi.confirmTfaSetup(
      setup.setupToken,
      verificationCode.trim(),
    );
    setIsBusy(false);
    if (!data) {
      toast({
        title: t('common_error'),
        description: error || t('tfa_invalid_code'),
        variant: 'destructive',
      });
      return;
    }

    setEnabled(true);
    setSetup(null);
    setVerificationCode('');
    setRecoveryCodes(data.recoveryCodes);
    setRecoveryCodesRemaining(data.recoveryCodes.length);
    toast({ title: t('common_success'), description: t('tfa_enabled_success') });
  };

  const disableTfa = async () => {
    if (!password || !verificationCode.trim()) {
      toast({
        title: t('common_error'),
        description: t('tfa_disable_required'),
        variant: 'destructive',
      });
      return;
    }

    setIsBusy(true);
    const { data, error } = await authApi.disableTfa(password, verificationCode.trim());
    setIsBusy(false);
    if (!data) {
      toast({
        title: t('common_error'),
        description: error || t('tfa_disable_error'),
        variant: 'destructive',
      });
      return;
    }

    setEnabled(false);
    setPassword('');
    setVerificationCode('');
    setRecoveryCodes([]);
    setRecoveryCodesRemaining(0);
    toast({ title: t('common_success'), description: t('tfa_disabled_success') });
  };

  const recoveryText = recoveryCodes.join('\n');

  const copyRecoveryCodes = async () => {
    await navigator.clipboard.writeText(recoveryText);
    toast({ title: t('common_success'), description: t('tfa_recovery_copied') });
  };

  const downloadRecoveryCodes = () => {
    const blob = new Blob([recoveryText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'my-local-wallet-recovery-codes.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-primary" />
          {t('tfa_title')}
        </CardTitle>
        <CardDescription>{t('tfa_description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {enabled === null ? (
          <div className="flex h-20 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : recoveryCodes.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">{t('tfa_recovery_title')}</p>
                <p className="text-sm text-muted-foreground">{t('tfa_recovery_description')}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/30 p-4 font-mono text-sm sm:grid-cols-4">
              {recoveryCodes.map(code => <span key={code}>{code}</span>)}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={copyRecoveryCodes}>
                <Copy className="mr-2 h-4 w-4" />
                {t('tfa_copy_codes')}
              </Button>
              <Button type="button" variant="outline" onClick={downloadRecoveryCodes}>
                <Download className="mr-2 h-4 w-4" />
                {t('tfa_download_codes')}
              </Button>
              <Button type="button" onClick={() => setRecoveryCodes([])}>
                {t('common_done')}
              </Button>
            </div>
          </div>
        ) : enabled ? (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">{t('tfa_enabled')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('tfa_recovery_remaining')}: {recoveryCodesRemaining}
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tfa-password">{t('common_password')}</Label>
                <Input
                  id="tfa-password"
                  type="password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tfa-disable-code">{t('tfa_code_or_recovery')}</Label>
                <Input
                  id="tfa-disable-code"
                  value={verificationCode}
                  onChange={event => setVerificationCode(event.target.value.toUpperCase())}
                  autoComplete="one-time-code"
                  maxLength={11}
                />
              </div>
            </div>
            <Button type="button" variant="destructive" onClick={disableTfa} disabled={isBusy}>
              {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldOff className="mr-2 h-4 w-4" />}
              {t('tfa_disable')}
            </Button>
          </div>
        ) : setup ? (
          <div className="space-y-5">
            <div className="grid items-start gap-5 md:grid-cols-[220px_1fr]">
              <img
                src={setup.qrDataUrl}
                alt={t('tfa_qr_alt')}
                width={220}
                height={220}
                className="rounded-md border bg-white"
              />
              <div className="space-y-4">
                <div>
                  <p className="font-medium">{t('tfa_scan_title')}</p>
                  <p className="text-sm text-muted-foreground">{t('tfa_scan_description')}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t('tfa_manual_key')}</Label>
                  <div className="break-all rounded-md border bg-muted/30 p-3 font-mono text-sm">
                    {setup.secret}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tfa-confirm-code">{t('tfa_verification_code')}</Label>
                  <Input
                    id="tfa-confirm-code"
                    inputMode="numeric"
                    value={verificationCode}
                    onChange={event => setVerificationCode(event.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    autoComplete="one-time-code"
                    maxLength={6}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={confirmSetup} disabled={isBusy}>
                {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('tfa_confirm_enable')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSetup(null);
                  setVerificationCode('');
                }}
              >
                {t('common_cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <ShieldOff className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">{t('tfa_disabled')}</p>
                <p className="text-sm text-muted-foreground">{t('tfa_disabled_description')}</p>
              </div>
            </div>
            <Button type="button" onClick={startSetup} disabled={isBusy}>
              {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('tfa_enable')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

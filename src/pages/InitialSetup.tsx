import { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
  UserRound,
  Wallet,
} from 'lucide-react';
import { setupApi, type AuthenticatedUserResponse } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TfaSetup {
  setupToken: string;
  secret: string;
  qrDataUrl: string;
}

export function InitialSetup({ onComplete }: { onComplete: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'account' | 'tfa' | 'recovery'>('account');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [setup, setSetup] = useState<TfaSetup | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [createdUser, setCreatedUser] = useState<AuthenticatedUserResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const passwordChecks = [
    { label: t('setup_password_length'), valid: password.length >= 12 },
    { label: t('setup_password_lowercase'), valid: /[a-z]/.test(password) },
    { label: t('setup_password_uppercase'), valid: /[A-Z]/.test(password) },
    { label: t('setup_password_number'), valid: /[0-9]/.test(password) },
  ];
  const accountValid = /^[a-zA-Z0-9_]{3,50}$/.test(username.trim())
    && passwordChecks.every((check) => check.valid)
    && password === confirmPassword;

  const startTfa = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accountValid) return;
    setBusy(true);
    setError('');
    const { data, error: requestError } = await setupApi.startTfa(username.trim());
    if (!data) {
      setError(requestError || t('setup_error'));
      setBusy(false);
      return;
    }
    try {
      const QRCode = await import('qrcode');
      const qrDataUrl = await QRCode.toDataURL(data.otpAuthUri, {
        width: 224,
        margin: 1,
        errorCorrectionLevel: 'M',
      });
      setSetup({ ...data, qrDataUrl });
      setStep('tfa');
    } catch {
      setError(t('tfa_qr_error'));
    } finally {
      setBusy(false);
    }
  };

  const finishSetup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!setup || !/^\d{6}$/.test(verificationCode)) return;
    setBusy(true);
    setError('');
    const { data, error: requestError } = await setupApi.complete({
      username: username.trim(),
      password,
      setupToken: setup.setupToken,
      code: verificationCode,
    });
    setBusy(false);
    if (!data) {
      setError(requestError || t('setup_error'));
      return;
    }
    setCreatedUser(data.user);
    setRecoveryCodes(data.recoveryCodes);
    setStep('recovery');
  };

  const recoveryText = recoveryCodes.join('\n');

  const enterApplication = () => {
    if (!createdUser) return;
    useAuthStore.setState({
      user: createdUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      tfaChallenge: null,
    });
    onComplete();
  };

  const downloadRecoveryCodes = () => {
    const blob = new Blob([recoveryText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'local-wallet-recovery-codes.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-6">
      <Card className="w-full max-w-2xl border-border/70">
        <CardHeader className="space-y-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/15">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>{t('setup_title')}</CardTitle>
              <CardDescription>{t('setup_description')}</CardDescription>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            {[
              ['account', t('setup_step_account')],
              ['tfa', t('setup_step_tfa')],
              ['recovery', t('setup_step_recovery')],
            ].map(([value, label], index) => {
              const order = ['account', 'tfa', 'recovery'];
              const complete = order.indexOf(step) > index;
              const active = step === value;
              return (
                <div key={value} className={`border-t-2 pt-2 ${active || complete ? 'border-primary text-foreground' : 'border-border'}`}>
                  {complete ? <Check className="mr-1 inline h-3.5 w-3.5" /> : null}
                  {label}
                </div>
              );
            })}
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {error && (
            <div className="mb-5 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {step === 'account' && (
            <form onSubmit={startTfa} className="space-y-5">
              <div className="flex items-start gap-3">
                <UserRound className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <h2 className="font-semibold">{t('setup_account_title')}</h2>
                  <p className="text-sm text-muted-foreground">{t('setup_account_description')}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-username">{t('auth_username')}</Label>
                <Input
                  id="setup-username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  maxLength={50}
                  placeholder={t('auth_username_placeholder')}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="setup-password">{t('auth_password')}</Label>
                  <div className="relative">
                    <Input
                      id="setup-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      aria-label={showPassword ? t('auth_hide_password') : t('auth_show_password')}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-confirm-password">{t('auth_confirm_password')}</Label>
                  <Input
                    id="setup-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                {passwordChecks.map((check) => (
                  <div key={check.label} className={check.valid ? 'text-income' : 'text-muted-foreground'}>
                    <Check className="mr-2 inline h-4 w-4" />
                    {check.label}
                  </div>
                ))}
              </div>
              <Button type="submit" disabled={!accountValid || busy} className="w-full sm:w-auto">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                {t('setup_continue_tfa')}
              </Button>
            </form>
          )}

          {step === 'tfa' && setup && (
            <form onSubmit={finishSetup} className="space-y-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <h2 className="font-semibold">{t('setup_tfa_title')}</h2>
                  <p className="text-sm text-muted-foreground">{t('setup_tfa_description')}</p>
                </div>
              </div>
              <div className="grid items-start gap-5 sm:grid-cols-[224px_1fr]">
                <img
                  src={setup.qrDataUrl}
                  alt={t('tfa_qr_alt')}
                  width={224}
                  height={224}
                  className="mx-auto rounded-md border bg-white"
                />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('tfa_manual_key')}</Label>
                    <div className="break-all rounded-md border bg-muted/30 p-3 font-mono text-sm">
                      {setup.secret}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="setup-tfa-code">{t('tfa_verification_code')}</Label>
                    <Input
                      id="setup-tfa-code"
                      inputMode="numeric"
                      value={verificationCode}
                      onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, ''))}
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="123456"
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={() => setStep('account')} disabled={busy}>
                  {t('common_back')}
                </Button>
                <Button type="submit" disabled={verificationCode.length !== 6 || busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('setup_create_admin')}
                </Button>
              </div>
            </form>
          )}

          {step === 'recovery' && (
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-income" />
                <div>
                  <h2 className="font-semibold">{t('setup_complete_title')}</h2>
                  <p className="text-sm text-muted-foreground">{t('setup_complete_description')}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/20 p-4 font-mono text-sm sm:grid-cols-4">
                {recoveryCodes.map((code) => <span key={code}>{code}</span>)}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={() => void navigator.clipboard.writeText(recoveryText)}>
                  <Copy className="mr-2 h-4 w-4" />
                  {t('tfa_copy_codes')}
                </Button>
                <Button type="button" variant="outline" onClick={downloadRecoveryCodes}>
                  <Download className="mr-2 h-4 w-4" />
                  {t('tfa_download_codes')}
                </Button>
                <Button type="button" onClick={enterApplication} className="sm:ml-auto">
                  {t('setup_enter_app')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

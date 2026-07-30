import { useState, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useFinanceStore } from '@/stores/financeStore';
import { useCurrencyStore, SUPPORTED_CURRENCIES, type CurrencyCode } from '@/stores/currencyStore';
import { useTheme } from '@/hooks/useTheme';
import { useBackup } from '@/hooks/useBackup';
import { useTranslation, languages } from '@/lib/i18n';
import { decryptBackup, encryptBackup } from '@/lib/backupCrypto';
import { AppLayout } from '@/components/AppLayout';
import { TwoFactorSettings } from '@/components/TwoFactorSettings';
import { SessionManagement } from '@/components/SessionManagement';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  Settings as SettingsIcon, 
  Download, 
  Upload, 
  Shield, 
  Database,
  FileJson,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Sun,
  Moon,
  Palette,
  Globe,
  RefreshCw,
  Coins,
  Clock,
  LockKeyhole,
  Trash2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { exportData, importData, loadAllData } = useFinanceStore();
  const { theme, toggleTheme } = useTheme();
  const { t, language, setLanguage } = useTranslation();
  const {
    getLocalBackupInfo,
    restoreFromLocalStorage,
    enableLocalBackup,
    unlockLocalBackup,
    disableLocalBackup,
    updateLastBackupDate,
  } = useBackup();
  const displayCurrency = useCurrencyStore((s) => s.displayCurrency);
  const setDisplayCurrency = useCurrencyStore((s) => s.setDisplayCurrency);
  const lastRatesUpdated = useCurrencyStore((s) => s.lastUpdated);
  const isRatesRefreshing = useCurrencyStore((s) => s.isRefreshing);
  const ratesError = useCurrencyStore((s) => s.error);
  const refreshRates = useCurrencyStore((s) => s.refreshRates);

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [encryptExport, setEncryptExport] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [localBackupPassword, setLocalBackupPassword] = useState('');
  const [isConfiguringLocalBackup, setIsConfiguringLocalBackup] = useState(false);

  const localBackupInfo = getLocalBackupInfo();

  const handleExport = async () => {
    if (!user?.id) return;
    
    setIsExporting(true);
    try {
      const jsonData = await exportData(user.id);
      const output = encryptExport
        ? await encryptBackup(jsonData, exportPassword)
        : jsonData;
      const blob = new Blob([output], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finance-backup-${user.username}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Update last backup date
      updateLastBackupDate();
      
      toast({
        title: t('common_success'),
        description: t('settings_export_success'),
      });
    } catch (error) {
      toast({
        title: t('common_error'),
        description: t('settings_export_error'),
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestoreFromLocal = async () => {
    if (!confirm(t('settings_import_warning'))) return;
    
    setIsRestoring(true);
    const success = await restoreFromLocalStorage();
    setIsRestoring(false);
  };

  const handleConfigureLocalBackup = async () => {
    setIsConfiguringLocalBackup(true);
    const success = localBackupInfo.hasBackup
      ? await unlockLocalBackup(localBackupPassword)
      : await enableLocalBackup(localBackupPassword);
    setIsConfiguringLocalBackup(false);
    if (success) {
      setLocalBackupPassword('');
      toast({
        title: t('common_success'),
        description: t(localBackupInfo.hasBackup ? 'backup_local_unlocked' : 'backup_local_enabled'),
      });
    } else {
      toast({
        title: t('common_error'),
        description: t('backup_local_password_error'),
        variant: 'destructive',
      });
    }
  };

  const handleDisableLocalBackup = () => {
    if (!confirm(t('backup_local_disable_confirm'))) return;
    disableLocalBackup();
    setLocalBackupPassword('');
    toast({ title: t('common_success'), description: t('backup_local_disabled') });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    if (!file.name.endsWith('.json')) {
      toast({
        title: t('common_error'),
        description: t('settings_json_required'),
        variant: 'destructive',
      });
      return;
    }

    const confirmImport = confirm(t('settings_import_warning'));

    if (!confirmImport) {
      e.target.value = '';
      return;
    }

    setIsImporting(true);
    try {
      const text = await file.text();
      const decrypted = await decryptBackup(text, importPassword);
      const success = await importData(user.id, decrypted);
      
      if (success) {
        await loadAllData(user.id);
        toast({
          title: t('common_success'),
          description: t('settings_import_success'),
        });
      } else {
        toast({
          title: t('common_error'),
          description: t('settings_invalid_format'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: t('common_error'),
        description: t('settings_import_error'),
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-primary" />
            {t('settings_title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('settings_subtitle')}
          </p>
        </div>

        <TwoFactorSettings />

        <SessionManagement />

        {/* Language Selector */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              {t('settings_language')}
            </CardTitle>
            <CardDescription>
              {t('settings_language_description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={language} onValueChange={(val) => setLanguage(val as typeof language)}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    <span className="flex items-center gap-2">
                      <span>{lang.flag}</span>
                      <span>{lang.nativeName}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Theme Toggle */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" />
              {t('settings_appearance')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {theme === 'dark' ? (
                  <Moon className="w-5 h-5 text-primary" />
                ) : (
                  <Sun className="w-5 h-5 text-accent" />
                )}
                <div>
                  <Label htmlFor="theme-toggle" className="text-base font-medium">
                    {theme === 'dark' ? t('settings_dark_mode') : t('settings_light_mode')}
                  </Label>
                </div>
              </div>
              <Switch
                id="theme-toggle"
                checked={theme === 'light'}
                onCheckedChange={toggleTheme}
              />
            </div>
          </CardContent>
        </Card>


        {/* Currency */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-primary" />
              {t('settings_currency')}
            </CardTitle>
            <CardDescription>
              {t('settings_currency_desc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('settings_currency_display')}</Label>
              <Select
                value={displayCurrency}
                onValueChange={(value) => {
                  const currency = value as CurrencyCode;
                  setDisplayCurrency(currency);
                  if (currency !== 'IDR') {
                    refreshRates();
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('settings_currency_display')} />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                <span>{t('settings_currency_base')}: IDR</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>
                  {t('settings_currency_last_update')}: {lastRatesUpdated ? new Date(lastRatesUpdated).toLocaleString() : '-'}
                </span>
              </div>
            </div>

            {ratesError && (
              <div className="text-sm text-destructive flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>{ratesError}</span>
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() => refreshRates({ force: true })}
              disabled={isRatesRefreshing}
              className="w-fit"
            >
              {isRatesRefreshing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {t('settings_currency_refresh')}
            </Button>
          </CardContent>
        </Card>
        {/* Info Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Shield className="w-5 h-5" />
              {t('settings_data_safe')}
            </CardTitle>
            <CardDescription>
              {t('settings_data_safe_desc')}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Export/Import Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5 text-income" />
                {t('settings_export')}
              </CardTitle>
              <CardDescription>
                {t('settings_export_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="encrypt-backup">{t('settings_backup_encrypt')}</Label>
                <Switch
                  id="encrypt-backup"
                  checked={encryptExport}
                  onCheckedChange={setEncryptExport}
                />
              </div>
              {encryptExport && (
                <div className="space-y-2">
                  <Label htmlFor="export-password">{t('settings_backup_password')}</Label>
                  <Input
                    id="export-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={exportPassword}
                    onChange={(event) => setExportPassword(event.target.value)}
                    placeholder={t('settings_backup_password_hint')}
                  />
                </div>
              )}
              <Button 
                onClick={handleExport} 
                disabled={isExporting || (encryptExport && exportPassword.length < 8)}
                className="w-full gap-2"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('settings_exporting')}
                  </>
                ) : (
                  <>
                    <FileJson className="w-4 h-4" />
                    {t('settings_download_backup')}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-savings" />
                {t('settings_import')}
              </CardTitle>
              <CardDescription>
                {t('settings_import_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="space-y-2">
                <Label htmlFor="import-password">{t('settings_backup_password_optional')}</Label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="import-password"
                    type="password"
                    autoComplete="off"
                    value={importPassword}
                    onChange={(event) => setImportPassword(event.target.value)}
                    className="pl-9"
                    placeholder={t('settings_backup_password_import_hint')}
                  />
                </div>
              </div>
              <Button 
                onClick={handleImportClick} 
                disabled={isImporting}
                variant="outline"
                className="w-full gap-2"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('settings_importing')}
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    {t('settings_upload_backup')}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Local Backup Info */}
        <Card className="glass-card border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" />
              {t('backup_local_info')}
            </CardTitle>
            <CardDescription>
              {t('backup_local_desc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(!localBackupInfo.hasBackup || localBackupInfo.locked) && (
              <div className="space-y-3">
                <Label htmlFor="local-backup-password">
                  {localBackupInfo.hasBackup
                    ? t('backup_local_unlock_password')
                    : t('backup_local_create_password')}
                </Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="local-backup-password"
                      type="password"
                      autoComplete="off"
                      minLength={12}
                      value={localBackupPassword}
                      onChange={(event) => setLocalBackupPassword(event.target.value)}
                      className="pl-9"
                      placeholder={t('backup_local_password_hint')}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => void handleConfigureLocalBackup()}
                    disabled={localBackupPassword.length < 12 || isConfiguringLocalBackup}
                  >
                    {isConfiguringLocalBackup && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {localBackupInfo.hasBackup
                      ? t('backup_local_unlock')
                      : t('backup_local_enable')}
                  </Button>
                </div>
              </div>
            )}
            {localBackupInfo.hasBackup ? (
              <div className="flex items-center justify-between p-4 rounded-lg bg-income/10 border border-income/20">
                <div>
                  <p className="font-medium text-income">{t('backup_has_local')}</p>
                  <p className="text-sm text-muted-foreground">
                    {localBackupInfo.backupDate?.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {localBackupInfo.locked ? t('backup_local_locked') : t('backup_local_unlocked_status')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRestoreFromLocal}
                    disabled={isRestoring || localBackupInfo.locked}
                    className="gap-2"
                  >
                    {isRestoring ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    {t('backup_restore_local')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleDisableLocalBackup}
                    title={t('backup_local_disable')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-secondary/30">
                <p className="text-muted-foreground">{t('backup_no_local_backup')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Storage Info */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              {t('settings_storage_info')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <CheckCircle className="w-4 h-4 text-income" />
                  Database
                </div>
                <p className="font-medium">MySQL</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <CheckCircle className="w-4 h-4 text-income" />
                  Session &amp; local backup
                </div>
                <p className="font-medium">HttpOnly cookie &amp; encrypted local backup</p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">{t('common_warning')}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('settings_clear_warning')}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>{t('settings_account_info')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">{t('settings_username')}</span>
                <span className="font-medium">{user?.username}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">{t('settings_user_id')}</span>
                <span className="font-mono text-sm">{user?.id?.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">{t('settings_registered')}</span>
                <span className="font-medium">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('id-ID') : '-'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Deployment Guide */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>{t('settings_deploy_guide')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">Development</h4>
              <pre className="p-3 rounded-lg bg-secondary/50 text-sm font-mono overflow-x-auto">
{`npm install
npm run dev`}
              </pre>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Build Production</h4>
              <pre className="p-3 rounded-lg bg-secondary/50 text-sm font-mono overflow-x-auto">
{`npm run build`}
              </pre>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Docker</h4>
              <pre className="p-3 rounded-lg bg-secondary/50 text-sm font-mono overflow-x-auto">
{`docker-compose up -d`}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

import { useState, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useFinanceStore } from '@/stores/financeStore';
import { useTheme } from '@/hooks/useTheme';
import { useBackup } from '@/hooks/useBackup';
import { useTranslation, languages } from '@/lib/i18n';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  const { getLocalBackupInfo, restoreFromLocalStorage, updateLastBackupDate } = useBackup();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const localBackupInfo = getLocalBackupInfo();

  const handleExport = async () => {
    if (!user?.id) return;
    
    setIsExporting(true);
    try {
      const jsonData = await exportData(user.id);
      const blob = new Blob([jsonData], { type: 'application/json' });
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
      const success = await importData(user.id, text);
      
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

        {/* Language Selector */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              {t('settings_language')}
            </CardTitle>
            <CardDescription>
              Choose your preferred language
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
            <CardContent>
              <Button 
                onClick={handleExport} 
                disabled={isExporting}
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
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
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
            {localBackupInfo.hasBackup ? (
              <div className="flex items-center justify-between p-4 rounded-lg bg-income/10 border border-income/20">
                <div>
                  <p className="font-medium text-income">{t('backup_has_local')}</p>
                  <p className="text-sm text-muted-foreground">
                    {localBackupInfo.backupDate?.toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRestoreFromLocal}
                  disabled={isRestoring}
                  className="gap-2"
                >
                  {isRestoring ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {t('backup_restore_local')}
                </Button>
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
                <p className="font-medium">IndexedDB</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <CheckCircle className="w-4 h-4 text-income" />
                  Session
                </div>
                <p className="font-medium">LocalStorage</p>
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

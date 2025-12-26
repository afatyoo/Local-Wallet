import { useEffect, useState } from 'react';
import { useBackup } from '@/hooks/useBackup';
import { useTranslation } from '@/lib/i18n';
import { useAuthStore } from '@/stores/authStore';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Download, X } from 'lucide-react';

export function BackupReminder() {
  const { user } = useAuthStore();
  const { checkBackupReminder, quickBackup, getLastBackupDate } = useBackup();
  const { t } = useTranslation();
  const [showReminder, setShowReminder] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  useEffect(() => {
    if (user?.id && checkBackupReminder()) {
      // Delay showing reminder to not be intrusive on load
      const timer = setTimeout(() => {
        setShowReminder(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [user?.id, checkBackupReminder]);

  const handleBackup = async () => {
    setIsBackingUp(true);
    const success = await quickBackup();
    setIsBackingUp(false);
    if (success) {
      setShowReminder(false);
    }
  };

  const handleDismiss = () => {
    setShowReminder(false);
  };

  if (!showReminder) return null;

  const lastBackup = getLastBackupDate();
  const daysSinceBackup = lastBackup 
    ? Math.floor((Date.now() - lastBackup.getTime()) / (24 * 60 * 60 * 1000))
    : null;

  return (
    <Alert className="mb-4 border-warning bg-warning/10">
      <AlertTriangle className="h-4 w-4 text-warning" />
      <AlertTitle className="flex items-center justify-between">
        <span>{t('backup_reminder_title')}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 -mr-2"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p className="text-sm text-muted-foreground mb-3">
          {daysSinceBackup !== null 
            ? t('backup_reminder_days').replace('{days}', String(daysSinceBackup))
            : t('backup_reminder_never')
          }
        </p>
        <Button
          size="sm"
          onClick={handleBackup}
          disabled={isBackingUp}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          {isBackingUp ? t('common_loading') : t('backup_now')}
        </Button>
      </AlertDescription>
    </Alert>
  );
}

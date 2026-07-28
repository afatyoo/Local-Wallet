import { useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useFinanceStore } from '@/stores/financeStore';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/lib/i18n';

const backupKey = (userId: string) => `finance_backup_data:${userId}`;
const backupDateKey = (userId: string) => `finance_backup_date:${userId}`;
const lastBackupKey = (userId: string) => `finance_last_backup:${userId}`;
const REMINDER_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export function useBackup() {
  const { user } = useAuthStore();
  const { exportData, importData, loadAllData } = useFinanceStore();
  const { toast } = useToast();
  const { t } = useTranslation();

  // Get last backup date
  const getLastBackupDate = useCallback((): Date | null => {
    if (!user?.id) return null;
    const lastBackup = localStorage.getItem(lastBackupKey(user.id));
    return lastBackup ? new Date(lastBackup) : null;
  }, [user?.id]);

  // Update last backup date
  const updateLastBackupDate = useCallback(() => {
    if (!user?.id) return;
    localStorage.setItem(lastBackupKey(user.id), new Date().toISOString());
  }, [user?.id]);

  // Auto-save to localStorage (dual storage)
  const autoSaveToLocalStorage = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const jsonData = await exportData(user.id);
      localStorage.setItem(backupKey(user.id), jsonData);
      localStorage.setItem(backupDateKey(user.id), new Date().toISOString());
    } catch (error) {
      console.error('Auto-save to localStorage failed:', error);
    }
  }, [user?.id, exportData]);

  // Quick backup to file
  const quickBackup = useCallback(async () => {
    if (!user?.id) return false;

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

      // Also save to localStorage
      await autoSaveToLocalStorage();

      toast({
        title: t('common_success'),
        description: t('backup_success'),
      });

      return true;
    } catch (error) {
      toast({
        title: t('common_error'),
        description: t('backup_error'),
        variant: 'destructive',
      });
      return false;
    }
  }, [user?.id, user?.username, exportData, toast, t, updateLastBackupDate, autoSaveToLocalStorage]);

  // Restore from localStorage backup
  const restoreFromLocalStorage = useCallback(async () => {
    if (!user?.id) return false;

    const backupData = localStorage.getItem(backupKey(user.id));
    if (!backupData) {
      toast({
        title: t('common_warning'),
        description: t('backup_no_local_backup'),
        variant: 'destructive',
      });
      return false;
    }

    try {
      const success = await importData(user.id, backupData);
      if (success) {
        await loadAllData(user.id);
        toast({
          title: t('common_success'),
          description: t('backup_restore_success'),
        });
        return true;
      }
      return false;
    } catch (error) {
      toast({
        title: t('common_error'),
        description: t('backup_restore_error'),
        variant: 'destructive',
      });
      return false;
    }
  }, [user?.id, importData, loadAllData, toast, t]);

  // Check if backup reminder is needed
  const checkBackupReminder = useCallback(() => {
    const lastBackup = getLastBackupDate();
    if (!lastBackup) {
      return true; // Never backed up
    }
    
    const timeSinceBackup = Date.now() - lastBackup.getTime();
    return timeSinceBackup > REMINDER_INTERVAL;
  }, [getLastBackupDate]);

  // Get local backup info
  const getLocalBackupInfo = useCallback(() => {
    if (!user?.id) return { hasBackup: false, backupDate: null };
    const backupDate = localStorage.getItem(backupDateKey(user.id));
    const hasBackup = localStorage.getItem(backupKey(user.id)) !== null;
    
    return {
      hasBackup,
      backupDate: backupDate ? new Date(backupDate) : null,
    };
  }, [user?.id]);

  // Auto-save on data changes (debounced effect in components that use this)
  useEffect(() => {
    if (user?.id) {
      // Initial auto-save
      autoSaveToLocalStorage();
    }
  }, [user?.id, autoSaveToLocalStorage]);

  return {
    quickBackup,
    autoSaveToLocalStorage,
    restoreFromLocalStorage,
    checkBackupReminder,
    getLastBackupDate,
    getLocalBackupInfo,
    updateLastBackupDate,
  };
}

import { useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useFinanceStore } from '@/stores/financeStore';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/lib/i18n';
import { decryptBackup, encryptBackup, isEncryptedBackup } from '@/lib/backupCrypto';

const backupKey = (userId: string) => `finance_backup_data:${userId}`;
const backupDateKey = (userId: string) => `finance_backup_date:${userId}`;
const lastBackupKey = (userId: string) => `finance_last_backup:${userId}`;
const REMINDER_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const autoSaveInFlight = new Map<string, Promise<void>>();
const localBackupPasswords = new Map<string, string>();

async function saveBackupToLocalStorage(userId: string, jsonData: string) {
  const password = localBackupPasswords.get(userId);
  if (!password) return false;
  localStorage.setItem(backupKey(userId), await encryptBackup(jsonData, password));
  localStorage.setItem(backupDateKey(userId), new Date().toISOString());
  return true;
}

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

    const existing = autoSaveInFlight.get(user.id);
    if (existing) return existing;
    const operation = (async () => {
      try {
        const jsonData = await exportData(user.id);
        await saveBackupToLocalStorage(user.id, jsonData);
      } catch (error) {
        console.error('Auto-save to localStorage failed:', error);
      } finally {
        autoSaveInFlight.delete(user.id);
      }
    })();
    autoSaveInFlight.set(user.id, operation);
    return operation;
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

      // Reuse the same export instead of issuing another set of API requests.
      await saveBackupToLocalStorage(user.id, jsonData);

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
  }, [user?.id, user?.username, exportData, toast, t, updateLastBackupDate]);

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
      const password = localBackupPasswords.get(user.id);
      if (!password) {
        toast({
          title: t('common_warning'),
          description: t('backup_local_locked_error'),
          variant: 'destructive',
        });
        return false;
      }
      const decrypted = await decryptBackup(backupData, password);
      const success = await importData(user.id, decrypted);
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
    if (!user?.id) return { hasBackup: false, backupDate: null, locked: false };
    const storedBackup = localStorage.getItem(backupKey(user.id));
    if (storedBackup && !isEncryptedBackup(storedBackup)) {
      localStorage.removeItem(backupKey(user.id));
      localStorage.removeItem(backupDateKey(user.id));
      return { hasBackup: false, backupDate: null, locked: false };
    }
    const backupDate = localStorage.getItem(backupDateKey(user.id));
    const hasBackup = storedBackup !== null;
    
    return {
      hasBackup,
      backupDate: backupDate ? new Date(backupDate) : null,
      locked: hasBackup && !localBackupPasswords.has(user.id),
    };
  }, [user?.id]);

  const enableLocalBackup = useCallback(async (password: string) => {
    if (!user?.id || password.length < 12) return false;
    try {
      localBackupPasswords.set(user.id, password);
      const jsonData = await exportData(user.id);
      await saveBackupToLocalStorage(user.id, jsonData);
      return true;
    } catch {
      localBackupPasswords.delete(user.id);
      return false;
    }
  }, [user?.id, exportData]);

  const unlockLocalBackup = useCallback(async (password: string) => {
    if (!user?.id) return false;
    const backupData = localStorage.getItem(backupKey(user.id));
    if (!backupData || !isEncryptedBackup(backupData)) return false;
    try {
      await decryptBackup(backupData, password);
      localBackupPasswords.set(user.id, password);
      return true;
    } catch {
      return false;
    }
  }, [user?.id]);

  const disableLocalBackup = useCallback(() => {
    if (!user?.id) return;
    localBackupPasswords.delete(user.id);
    localStorage.removeItem(backupKey(user.id));
    localStorage.removeItem(backupDateKey(user.id));
  }, [user?.id]);

  return {
    quickBackup,
    autoSaveToLocalStorage,
    restoreFromLocalStorage,
    checkBackupReminder,
    getLastBackupDate,
    getLocalBackupInfo,
    enableLocalBackup,
    unlockLocalBackup,
    disableLocalBackup,
    updateLastBackupDate,
  };
}

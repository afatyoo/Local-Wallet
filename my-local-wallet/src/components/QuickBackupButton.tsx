import { useState } from 'react';
import { useBackup } from '@/hooks/useBackup';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Download, Loader2, Check } from 'lucide-react';

export function QuickBackupButton() {
  const { quickBackup, getLastBackupDate } = useBackup();
  const { t } = useTranslation();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [justBacked, setJustBacked] = useState(false);

  const handleBackup = async () => {
    setIsBackingUp(true);
    const success = await quickBackup();
    setIsBackingUp(false);
    
    if (success) {
      setJustBacked(true);
      setTimeout(() => setJustBacked(false), 2000);
    }
  };

  const lastBackup = getLastBackupDate();
  const lastBackupText = lastBackup 
    ? lastBackup.toLocaleDateString()
    : t('backup_never');

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBackup}
            disabled={isBackingUp}
            className="relative"
          >
            {isBackingUp ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : justBacked ? (
              <Check className="h-5 w-5 text-income" />
            ) : (
              <Download className="h-5 w-5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('backup_quick')}</p>
          <p className="text-xs text-muted-foreground">
            {t('backup_last')}: {lastBackupText}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

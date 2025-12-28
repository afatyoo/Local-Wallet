import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useFinanceStore } from '@/stores/financeStore';
import { 
  useSavingsTargets, 
  SavingsTarget,
  getTargetsFromStorage,
  saveTargetsToStorage,
  deleteTarget as deleteTargetFromStorage
} from '@/hooks/useSavingsTargets';
import { useTranslation } from '@/lib/i18n';
import { AppLayout } from '@/components/AppLayout';
import { formatCurrency, parseCurrencyInputToBase, formatInputNumberFromBase } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { 
  Target, 
  Plus, 
  Pencil, 
  Trash2, 
  Trophy, 
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Lightbulb
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export default function TargetsPage() {
  const { user } = useAuthStore();
  const { loadAllData } = useFinanceStore();
  const { accountNames, calculateProgress, generateInsights } = useSavingsTargets();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [targets, setTargets] = useState<SavingsTarget[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<SavingsTarget | null>(null);
  const [formData, setFormData] = useState({
    namaTarget: '',
    targetAmount: '',
    startDate: new Date().toISOString().split('T')[0],
    targetDate: '',
    linkedAccount: '',
  });

  // Load data
  useEffect(() => {
    if (user?.id) {
      loadAllData(user.id);
      setTargets(getTargetsFromStorage(user.id));
    }
  }, [user?.id, loadAllData]);

  // Hitung progress untuk semua target
  const targetsWithProgress = useMemo(() => {
    return targets.map((t) => calculateProgress(t));
  }, [targets, calculateProgress]);

  // Generate insights
  const insights = useMemo(() => {
    return generateInsights(targetsWithProgress);
  }, [targetsWithProgress, generateInsights]);

  // Summary stats
  const stats = useMemo(() => {
    const active = targetsWithProgress.filter((t) => t.status === 'Aktif');
    const completed = targetsWithProgress.filter((t) => t.status === 'Tercapai');
    const totalTarget = targetsWithProgress.reduce((sum, t) => sum + t.targetAmount, 0);
    const totalCurrent = targetsWithProgress.reduce((sum, t) => sum + t.currentAmount, 0);

    return {
      activeCount: active.length,
      completedCount: completed.length,
      totalTarget,
      totalCurrent,
      overallProgress: totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0,
    };
  }, [targetsWithProgress]);

  const resetForm = () => {
    setFormData({
      namaTarget: '',
      targetAmount: '',
      startDate: new Date().toISOString().split('T')[0],
      targetDate: '',
      linkedAccount: '',
    });
    setEditingTarget(null);
  };

  const handleOpenDialog = (target?: SavingsTarget) => {
    if (target) {
      setEditingTarget(target);
      setFormData({
        namaTarget: target.namaTarget,
        targetAmount: formatInputNumberFromBase(target.targetAmount),
        startDate: target.startDate,
        targetDate: target.targetDate,
        linkedAccount: target.linkedAccount,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.namaTarget || !formData.targetAmount || !formData.targetDate || !formData.linkedAccount) {
      toast({
        title: t('common_error'),
        description: t('target_fill_all_fields'),
        variant: 'destructive',
      });
      return;
    }

    const targetAmount = parseCurrencyInputToBase(formData.targetAmount);
    if (isNaN(targetAmount) || targetAmount <= 0) {
      toast({
        title: t('common_error'),
        description: t('target_invalid_amount'),
        variant: 'destructive',
      });
      return;
    }

    let updatedTargets: SavingsTarget[];

    if (editingTarget) {
      updatedTargets = targets.map((t) =>
        t.id === editingTarget.id
          ? {
              ...t,
              namaTarget: formData.namaTarget,
              targetAmount,
              startDate: formData.startDate,
              targetDate: formData.targetDate,
              linkedAccount: formData.linkedAccount,
            }
          : t
      );
    } else {
      const newTarget: SavingsTarget = {
        id: uuidv4(),
        userId: user!.id,
        namaTarget: formData.namaTarget,
        targetAmount,
        currentAmount: 0,
        startDate: formData.startDate,
        targetDate: formData.targetDate,
        status: 'Aktif',
        linkedAccount: formData.linkedAccount,
      };
      updatedTargets = [...targets, newTarget];
    }

    saveTargetsToStorage(updatedTargets);
    setTargets(updatedTargets);
    setIsDialogOpen(false);
    resetForm();

    toast({
      title: t('common_success'),
      description: editingTarget ? t('target_updated') : t('target_added'),
    });
  };

  const handleDelete = (targetId: string) => {
    if (confirm(t('target_delete_confirm'))) {
      deleteTargetFromStorage(targetId);
      setTargets(targets.filter((t) => t.id !== targetId));
      toast({
        title: t('common_success'),
        description: t('target_deleted'),
      });
    }
  };

  const getMilestoneIcon = (reached: boolean) => {
    return reached ? (
      <CheckCircle2 className="w-4 h-4 text-green-500" />
    ) : (
      <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Target className="w-8 h-8 text-primary" />
              {t('target_title')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('target_subtitle')}
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} className="gap-2">
                <Plus className="w-4 h-4" />
                {t('target_add')}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingTarget ? t('target_edit') : t('target_add')}
                </DialogTitle>
                <DialogDescription>
                  {t('target_subtitle')}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="namaTarget">{t('target_name')}</Label>
                  <Input
                    id="namaTarget"
                    placeholder={t('target_name_placeholder')}
                    value={formData.namaTarget}
                    onChange={(e) => setFormData({ ...formData, namaTarget: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="targetAmount">{t('target_amount')}</Label>
                  <Input
                    id="targetAmount"
                    placeholder="10000000"
                    value={formData.targetAmount}
                    onChange={(e) => setFormData({ ...formData, targetAmount: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="linkedAccount">{t('target_linked_account')}</Label>
                  <Select
                    value={formData.linkedAccount}
                    onValueChange={(value) => setFormData({ ...formData, linkedAccount: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('target_select_account')} />
                    </SelectTrigger>
                    <SelectContent>
                      {accountNames.length > 0 ? (
                        accountNames.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="__none" disabled>
                          {t('target_no_accounts')}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">{t('target_start_date')}</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="targetDate">{t('target_end_date')}</Label>
                    <Input
                      id="targetDate"
                      type="date"
                      value={formData.targetDate}
                      onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t('common_cancel')}
                </Button>
                <Button onClick={handleSubmit}>
                  {editingTarget ? t('common_save') : t('common_add')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Target className="w-4 h-4" />
                {t('target_active')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.activeCount}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-500" />
                {t('target_completed')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-income">{stats.completedCount}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                {t('target_progress')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.overallProgress.toFixed(0)}%</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-500" />
                {t('target_total_target')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(stats.totalTarget)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-500" />
                {t('target_insights')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {insights.map((insight, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg flex items-start gap-3 ${
                      insight.type === 'success'
                        ? 'bg-green-500/10 text-green-700 dark:text-green-300'
                        : insight.type === 'warning'
                        ? 'bg-orange-500/10 text-orange-700 dark:text-orange-300'
                        : 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
                    }`}
                  >
                    {insight.type === 'success' ? (
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                    ) : insight.type === 'warning' ? (
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    ) : (
                      <Lightbulb className="w-5 h-5 flex-shrink-0" />
                    )}
                    <span>{insight.message}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Targets List */}
        <div className="space-y-4">
          {targetsWithProgress.length > 0 ? (
            targetsWithProgress.map((target) => (
              <Card key={target.id} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                    {/* Info */}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            {target.namaTarget}
                            {target.status === 'Tercapai' && (
                              <Badge variant="default" className="bg-green-500">
                                <Trophy className="w-3 h-3 mr-1" />
                                {t('target_achieved')}
                              </Badge>
                            )}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {t('target_account')}: {target.linkedAccount}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(target)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(target.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">
                            {formatCurrency(target.currentAmount)}
                          </span>
                          <span className="text-muted-foreground">
                            {formatCurrency(target.targetAmount)}
                          </span>
                        </div>
                        <Progress value={target.progress} className="h-3" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{target.progress.toFixed(1)}% {t('target_achieved_label')}</span>
                          <span>{formatCurrency(target.remaining)} {t('target_remaining')}</span>
                        </div>
                      </div>

                      {/* Milestones */}
                      <div className="flex items-center gap-4">
                        {target.milestones.map((milestone) => (
                          <div
                            key={milestone.percentage}
                            className="flex items-center gap-1"
                            title={milestone.label}
                          >
                            {getMilestoneIcon(milestone.reached)}
                            <span className={`text-xs ${
                              milestone.reached ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                            }`}>
                              {milestone.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex flex-row lg:flex-col gap-4 text-sm">
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-muted-foreground">{t('target_time_left')}</p>
                        <p className="font-bold text-lg">
                          {target.monthsRemaining} {t('target_months')}
                        </p>
                      </div>
                      {target.monthlyRequired > 0 && target.status === 'Aktif' && (
                        <div className="text-center p-3 bg-muted/50 rounded-lg">
                          <p className="text-muted-foreground">{t('target_monthly_needed')}</p>
                          <p className="font-bold text-lg">
                            {formatCurrency(target.monthlyRequired)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">{t('target_no_targets')}</h3>
                <p className="text-muted-foreground mb-4">{t('target_no_targets_desc')}</p>
                <Button onClick={() => handleOpenDialog()} className="gap-2">
                  <Plus className="w-4 h-4" />
                  {t('target_add')}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

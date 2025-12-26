import { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useFinanceStore } from '@/stores/financeStore';
import { useTranslation } from '@/lib/i18n';
import { AppLayout } from '@/components/AppLayout';
import { formatCurrency, getMonthName } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Progress } from '@/components/ui/progress';
import { Plus, Pencil, Trash2, Target, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Budget } from '@/stores/financeStore';

export default function BudgetPage() {
  const { user } = useAuthStore();
  const { budgets, expenses, masterData, selectedMonth, loadAllData, addBudget, updateBudget, deleteBudget } = useFinanceStore();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Budget | null>(null);
  const [formData, setFormData] = useState({
    kategori: '',
    anggaran: '',
  });

  useEffect(() => {
    if (user?.id) {
      loadAllData(user.id);
    }
  }, [user?.id, loadAllData]);

  const categories = useMemo(
    () => masterData.filter((m) => m.type === 'kategoriPengeluaran').map((m) => m.value),
    [masterData]
  );

  const filteredBudgets = useMemo(
    () => selectedMonth === 'all' ? budgets : budgets.filter((b) => b.bulan === selectedMonth),
    [budgets, selectedMonth]
  );

  const monthlyExpenses = useMemo(
    () => selectedMonth === 'all' ? expenses : expenses.filter((e) => e.bulan === selectedMonth),
    [expenses, selectedMonth]
  );

  // Calculate realization per category
  const budgetWithRealization = useMemo(() => {
    return filteredBudgets.map((budget) => {
      const realisasi = monthlyExpenses
        .filter((e) => e.kategori === budget.kategori)
        .reduce((sum, e) => sum + e.jumlah, 0);
      const selisih = budget.anggaran - realisasi;
      const percentage = budget.anggaran > 0 ? (realisasi / budget.anggaran) * 100 : 0;
      const status = realisasi <= budget.anggaran ? 'safe' : 'over';
      
      return {
        ...budget,
        realisasi,
        selisih,
        percentage: Math.min(percentage, 100),
        status,
      };
    });
  }, [filteredBudgets, monthlyExpenses]);

  const totalBudget = useMemo(
    () => filteredBudgets.reduce((sum, b) => sum + b.anggaran, 0),
    [filteredBudgets]
  );

  const totalRealisasi = useMemo(
    () => budgetWithRealization.reduce((sum, b) => sum + b.realisasi, 0),
    [budgetWithRealization]
  );

  const resetForm = () => {
    setFormData({
      kategori: '',
      anggaran: '',
    });
    setEditingItem(null);
  };

  const handleOpenDialog = (item?: Budget) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        kategori: item.kategori,
        anggaran: item.anggaran.toString(),
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.kategori || !formData.anggaran) {
      toast({
        title: t('common_error'),
        description: t('common_error'),
        variant: 'destructive',
      });
      return;
    }

    const amount = parseFloat(formData.anggaran.replace(/[^\d]/g, ''));
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: t('common_error'),
        description: t('common_error'),
        variant: 'destructive',
      });
      return;
    }

    // Check if budget already exists for this category and month
    if (!editingItem) {
      const exists = filteredBudgets.some((b) => b.kategori === formData.kategori);
      if (exists) {
        toast({
          title: t('common_error'),
          description: t('common_error'),
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      if (editingItem) {
        await updateBudget(editingItem.id, {
          kategori: formData.kategori,
          anggaran: amount,
        });
        toast({ title: t('common_success'), description: t('common_success') });
      } else {
        await addBudget(user!.id, {
          bulan: selectedMonth,
          kategori: formData.kategori,
          anggaran: amount,
        });
        toast({ title: t('common_success'), description: t('common_success') });
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast({ title: t('common_error'), description: t('common_error'), variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(t('budget_delete_confirm'))) {
      await deleteBudget(id);
      toast({ title: t('common_success'), description: t('common_success') });
    }
  };

  const usedCategories = filteredBudgets.map((b) => b.kategori);
  const availableCategories = categories.filter(
    (c) => !usedCategories.includes(c) || (editingItem && editingItem.kategori === c)
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Target className="w-8 h-8 text-primary" />
              {t('budget_title')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('budget_subtitle')} - {getMonthName(selectedMonth)}
            </p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} className="gap-2" disabled={availableCategories.length === 0}>
                <Plus className="w-4 h-4" />
                {t('budget_add')}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingItem ? t('budget_edit') : t('budget_add')}</DialogTitle>
                <DialogDescription>
                  {t('budget_subtitle')}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="kategori">{t('common_category')}</Label>
                  <Select
                    value={formData.kategori}
                    onValueChange={(value) => setFormData({ ...formData, kategori: value })}
                    disabled={!!editingItem}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('common_category')} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="anggaran">{t('budget_limit')}</Label>
                  <Input
                    id="anggaran"
                    type="text"
                    placeholder="0"
                    value={formData.anggaran}
                    onChange={(e) => setFormData({ ...formData, anggaran: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t('common_cancel')}
                </Button>
                <Button onClick={handleSubmit}>
                  {editingItem ? t('common_save') : t('common_add')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="stat-card-balance">
            <p className="text-sm text-muted-foreground">
              {t('common_total')} {t('budget_limit')}
            </p>
            <p className="text-2xl font-bold font-mono mt-1">{formatCurrency(totalBudget)}</p>
          </div>
          <div className="stat-card-expense">
            <p className="text-sm text-muted-foreground">
              {t('common_total')} {t('budget_used')}
            </p>
            <p className="text-2xl font-bold font-mono text-expense mt-1">{formatCurrency(totalRealisasi)}</p>
          </div>
          <div className={totalBudget - totalRealisasi >= 0 ? 'stat-card-income' : 'stat-card-expense'}>
            <p className="text-sm text-muted-foreground">{t('budget_remaining')}</p>
            <p className={`text-2xl font-bold font-mono mt-1 ${totalBudget - totalRealisasi >= 0 ? 'text-income' : 'text-expense'}`}>
              {formatCurrency(totalBudget - totalRealisasi)}
            </p>
          </div>
        </div>

        {/* Budget Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgetWithRealization.length > 0 ? (
            budgetWithRealization.map((budget) => (
              <div key={budget.id} className="glass-card p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{budget.kategori}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {budget.status === 'safe' ? (
                        <span className="flex items-center gap-1 text-sm text-income">
                          <CheckCircle className="w-4 h-4" />
                          {t('bills_paid')}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-sm text-expense">
                          <AlertTriangle className="w-4 h-4" />
                          Over Budget
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(budget)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(budget.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('budget_used')}</span>
                    <span className="font-mono">{formatCurrency(budget.realisasi)}</span>
                  </div>
                  <Progress
                    value={budget.percentage}
                    className={`h-3 ${budget.status === 'over' ? '[&>div]:bg-expense' : '[&>div]:bg-income'}`}
                  />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('budget_limit')}</span>
                    <span className="font-mono">{formatCurrency(budget.anggaran)}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-border/50">
                    <span className="text-muted-foreground">{t('budget_remaining')}</span>
                    <span className={`font-mono font-medium ${budget.selisih >= 0 ? 'text-income' : 'text-expense'}`}>
                      {budget.selisih >= 0 ? '+' : ''}{formatCurrency(budget.selisih)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-2 glass-card p-12 text-center text-muted-foreground">
              <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('common_no_data')}</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

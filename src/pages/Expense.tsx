import { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useFinanceStore } from '@/stores/financeStore';
import { useTranslation } from '@/lib/i18n';
import { AppLayout } from '@/components/AppLayout';
import { formatCurrency, formatDate, getMonthName } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2, ArrowDownCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Expense } from '@/stores/financeStore';

export default function ExpensePage() {
  const { user } = useAuthStore();
  const { expenses, masterData, selectedMonth, loadAllData, addExpense, updateExpense, deleteExpense } = useFinanceStore();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Expense | null>(null);
  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    nama: '',
    kategori: '',
    metode: '',
    jumlah: '',
    catatan: '',
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

  const paymentMethods = useMemo(
    () => masterData.filter((m) => m.type === 'metodePembayaran').map((m) => m.value),
    [masterData]
  );

  const filteredExpenses = useMemo(
    () => expenses
      .filter((e) => selectedMonth === 'all' || e.bulan === selectedMonth)
      .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()),
    [expenses, selectedMonth]
  );

  const totalExpense = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + e.jumlah, 0),
    [filteredExpenses]
  );

  const resetForm = () => {
    setFormData({
      tanggal: new Date().toISOString().split('T')[0],
      nama: '',
      kategori: '',
      metode: '',
      jumlah: '',
      catatan: '',
    });
    setEditingItem(null);
  };

  const handleOpenDialog = (item?: Expense) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        tanggal: item.tanggal,
        nama: item.nama,
        kategori: item.kategori,
        metode: item.metode,
        jumlah: item.jumlah.toString(),
        catatan: item.catatan,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.tanggal || !formData.nama || !formData.kategori || !formData.metode || !formData.jumlah) {
      toast({
        title: t('common_error'),
        description: t('common_error'),
        variant: 'destructive',
      });
      return;
    }

    const amount = parseFloat(formData.jumlah.replace(/[^\d]/g, ''));
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: t('common_error'),
        description: t('common_error'),
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingItem) {
        await updateExpense(editingItem.id, {
          tanggal: formData.tanggal,
          nama: formData.nama,
          kategori: formData.kategori,
          metode: formData.metode,
          jumlah: amount,
          catatan: formData.catatan,
        });
        toast({ title: t('common_success'), description: t('common_success') });
      } else {
        await addExpense(user!.id, {
          tanggal: formData.tanggal,
          nama: formData.nama,
          kategori: formData.kategori,
          metode: formData.metode,
          jumlah: amount,
          catatan: formData.catatan,
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
    if (confirm(t('expense_delete_confirm'))) {
      await deleteExpense(id);
      toast({ title: t('common_success'), description: t('common_success') });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ArrowDownCircle className="w-8 h-8 text-expense" />
              {t('expense_title')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('expense_subtitle')} - {getMonthName(selectedMonth)}
            </p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} className="gap-2">
                <Plus className="w-4 h-4" />
                {t('expense_add')}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingItem ? t('expense_edit') : t('expense_add')}</DialogTitle>
                <DialogDescription>
                  {t('expense_subtitle')}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tanggal">{t('common_date')}</Label>
                    <Input
                      id="tanggal"
                      type="date"
                      value={formData.tanggal}
                      onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jumlah">{t('common_amount')}</Label>
                    <Input
                      id="jumlah"
                      type="text"
                      placeholder="0"
                      value={formData.jumlah}
                      onChange={(e) => setFormData({ ...formData, jumlah: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nama">{t('common_description')}</Label>
                  <Input
                    id="nama"
                    placeholder={t('common_description')}
                    value={formData.nama}
                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="kategori">{t('common_category')}</Label>
                    <Select
                      value={formData.kategori}
                      onValueChange={(value) => setFormData({ ...formData, kategori: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('common_category')} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="metode">{t('common_method')}</Label>
                    <Select
                      value={formData.metode}
                      onValueChange={(value) => setFormData({ ...formData, metode: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('common_method')} />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map((method) => (
                          <SelectItem key={method} value={method}>{method}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="catatan">{t('common_notes')}</Label>
                  <Textarea
                    id="catatan"
                    placeholder={t('common_notes')}
                    value={formData.catatan}
                    onChange={(e) => setFormData({ ...formData, catatan: e.target.value })}
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

        {/* Summary Card */}
        <div className="stat-card-expense">
          <p className="text-sm text-muted-foreground">
            {t('dashboard_total_expense')}
          </p>
          <p className="text-3xl font-bold font-mono text-expense mt-1">{formatCurrency(totalExpense)}</p>
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common_date')}</TableHead>
                <TableHead>{t('common_description')}</TableHead>
                <TableHead>{t('common_category')}</TableHead>
                <TableHead>{t('common_method')}</TableHead>
                <TableHead className="text-right">{t('common_amount')}</TableHead>
                <TableHead className="text-right">{t('common_actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.length > 0 ? (
                filteredExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{formatDate(expense.tanggal)}</TableCell>
                    <TableCell className="font-medium">{expense.nama}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded-full text-xs bg-expense/10 text-expense">
                        {expense.kategori}
                      </span>
                    </TableCell>
                    <TableCell>{expense.metode}</TableCell>
                    <TableCell className="text-right font-mono text-expense">
                      {formatCurrency(expense.jumlah)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(expense)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(expense.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {t('common_no_data')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}

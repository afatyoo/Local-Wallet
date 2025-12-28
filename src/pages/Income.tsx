import { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useFinanceStore } from '@/stores/financeStore';
import { useTranslation } from '@/lib/i18n';
import { AppLayout } from '@/components/AppLayout';
import { formatCurrency, formatDate, getMonthName, parseCurrencyInputToBase, formatInputNumberFromBase } from '@/lib/utils';
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
import { Plus, Pencil, Trash2, ArrowUpCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Income } from '@/stores/financeStore';

export default function IncomePage() {
  const { user } = useAuthStore();
  const { incomes, masterData, selectedMonth, loadAllData, addIncome, updateIncome, deleteIncome } = useFinanceStore();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Income | null>(null);
  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    sumber: '',
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
    () => masterData.filter((m) => m.type === 'kategoriPemasukan').map((m) => m.value),
    [masterData]
  );

  const paymentMethods = useMemo(
    () => masterData.filter((m) => m.type === 'metodePembayaran').map((m) => m.value),
    [masterData]
  );

  const filteredIncomes = useMemo(
    () => incomes
      .filter((i) => selectedMonth === 'all' || i.bulan === selectedMonth)
      .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()),
    [incomes, selectedMonth]
  );

  const totalIncome = useMemo(
    () => filteredIncomes.reduce((sum, i) => sum + i.jumlah, 0),
    [filteredIncomes]
  );

  const resetForm = () => {
    setFormData({
      tanggal: new Date().toISOString().split('T')[0],
      sumber: '',
      kategori: '',
      metode: '',
      jumlah: '',
      catatan: '',
    });
    setEditingItem(null);
  };

  const handleOpenDialog = (item?: Income) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        tanggal: item.tanggal,
        sumber: item.sumber,
        kategori: item.kategori,
        metode: item.metode,
        jumlah: formatInputNumberFromBase(item.jumlah),
        catatan: item.catatan,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.tanggal || !formData.sumber || !formData.kategori || !formData.metode || !formData.jumlah) {
      toast({
        title: t('common_error'),
        description: t('common_error'),
        variant: 'destructive',
      });
      return;
    }

    const amount = parseCurrencyInputToBase(formData.jumlah);
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
        await updateIncome(editingItem.id, {
          tanggal: formData.tanggal,
          sumber: formData.sumber,
          kategori: formData.kategori,
          metode: formData.metode,
          jumlah: amount,
          catatan: formData.catatan,
        });
        toast({ title: t('common_success'), description: t('common_success') });
      } else {
        await addIncome(user!.id, {
          tanggal: formData.tanggal,
          sumber: formData.sumber,
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
    if (confirm(t('income_delete_confirm'))) {
      await deleteIncome(id);
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
              <ArrowUpCircle className="w-8 h-8 text-income" />
              {t('income_title')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('income_subtitle')} - {getMonthName(selectedMonth)}
            </p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} className="gap-2">
                <Plus className="w-4 h-4" />
                {t('income_add')}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingItem ? t('income_edit') : t('income_add')}</DialogTitle>
                <DialogDescription>
                  {t('income_subtitle')}
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
                  <Label htmlFor="sumber">{t('income_source')}</Label>
                  <Input
                    id="sumber"
                    placeholder={t('income_source')}
                    value={formData.sumber}
                    onChange={(e) => setFormData({ ...formData, sumber: e.target.value })}
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
        <div className="stat-card-income">
          <p className="text-sm text-muted-foreground">
            {t('dashboard_total_income')}
          </p>
          <p className="text-3xl font-bold font-mono text-income mt-1">{formatCurrency(totalIncome)}</p>
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common_date')}</TableHead>
                <TableHead>{t('income_source')}</TableHead>
                <TableHead>{t('common_category')}</TableHead>
                <TableHead>{t('common_method')}</TableHead>
                <TableHead className="text-right">{t('common_amount')}</TableHead>
                <TableHead className="text-right">{t('common_actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIncomes.length > 0 ? (
                filteredIncomes.map((income) => (
                  <TableRow key={income.id}>
                    <TableCell>{formatDate(income.tanggal)}</TableCell>
                    <TableCell className="font-medium">{income.sumber}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded-full text-xs bg-income/10 text-income">
                        {income.kategori}
                      </span>
                    </TableCell>
                    <TableCell>{income.metode}</TableCell>
                    <TableCell className="text-right font-mono text-income">
                      {formatCurrency(income.jumlah)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(income)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(income.id)}
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

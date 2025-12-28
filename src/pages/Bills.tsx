import { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useFinanceStore } from '@/stores/financeStore';
import { useTranslation } from '@/lib/i18n';
import { AppLayout } from '@/components/AppLayout';
import { formatCurrency, getMonthName, parseCurrencyInputToBase, formatInputNumberFromBase } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Bill } from '@/stores/financeStore';
import {
  Receipt,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
} from 'lucide-react';

const kategoriTagihan = [
  'Listrik',
  'Air',
  'Internet',
  'Telepon',
  'TV Kabel',
  'Asuransi',
  'Cicilan',
  'Sewa',
  'Langganan',
  'Lainnya',
];

export default function BillsPage() {
  const { user } = useAuthStore();
  const {
    bills,
    billPayments,
    selectedMonth,
    loadAllData,
    addBill,
    updateBill,
    deleteBill,
    addBillPayment,
    deleteBillPayment,
  } = useFinanceStore();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [formData, setFormData] = useState({
    nama: '',
    kategori: '',
    jumlah: '',
    tanggalJatuhTempo: '',
    mulaiDari: '',
    sampaiDengan: '',
    catatan: '',
    isOngoing: true,
  });

  useEffect(() => {
    if (user?.id) {
      loadAllData(user.id);
    }
  }, [user?.id, loadAllData]);

  // Get bills for current month
  const currentMonthBills = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const today = new Date();
    const currentDay = today.getDate();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

    return bills
      .filter((bill) => {
        if (!bill.isActive) return false;
        const startMonth = bill.mulaiDari;
        const endMonth = bill.sampaiDengan;
        
        if (selectedMonth < startMonth) return false;
        if (endMonth !== 'ongoing' && selectedMonth > endMonth) return false;
        
        return true;
      })
      .map((bill) => {
        const payment = billPayments.find(
          (p) => p.billId === bill.id && p.bulan === selectedMonth
        );
        const isPaid = !!payment;
        
        // Check if overdue
        let isOverdue = false;
        if (!isPaid && isCurrentMonth && currentDay > bill.tanggalJatuhTempo) {
          isOverdue = true;
        } else if (!isPaid && selectedMonth < `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`) {
          isOverdue = true;
        }

        return {
          ...bill,
          isPaid,
          isOverdue,
          payment,
        };
      })
      .sort((a, b) => {
        // Unpaid first, then by due date
        if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
        return a.tanggalJatuhTempo - b.tanggalJatuhTempo;
      });
  }, [bills, billPayments, selectedMonth]);

  // Statistics
  const stats = useMemo(() => {
    const total = currentMonthBills.length;
    const paid = currentMonthBills.filter((b) => b.isPaid).length;
    const unpaid = total - paid;
    const overdue = currentMonthBills.filter((b) => b.isOverdue).length;
    const totalAmount = currentMonthBills.reduce((sum, b) => sum + b.jumlah, 0);
    const paidAmount = currentMonthBills
      .filter((b) => b.isPaid)
      .reduce((sum, b) => sum + (b.payment?.jumlahDibayar || b.jumlah), 0);

    return { total, paid, unpaid, overdue, totalAmount, paidAmount };
  }, [currentMonthBills]);

  const resetForm = () => {
    setFormData({
      nama: '',
      kategori: '',
      jumlah: '',
      tanggalJatuhTempo: '',
      mulaiDari: '',
      sampaiDengan: '',
      catatan: '',
      isOngoing: true,
    });
    setEditingBill(null);
  };

  const handleOpenDialog = (bill?: Bill) => {
    if (bill) {
      setEditingBill(bill);
      setFormData({
        nama: bill.nama,
        kategori: bill.kategori,
        jumlah: formatInputNumberFromBase(bill.jumlah),
        tanggalJatuhTempo: bill.tanggalJatuhTempo.toString(),
        mulaiDari: bill.mulaiDari,
        sampaiDengan: bill.sampaiDengan === 'ongoing' ? '' : bill.sampaiDengan,
        catatan: bill.catatan,
        isOngoing: bill.sampaiDengan === 'ongoing',
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    try {
      const billData = {
        nama: formData.nama.trim(),
        kategori: formData.kategori,
        jumlah: parseCurrencyInputToBase(formData.jumlah),
        tanggalJatuhTempo: parseInt(formData.tanggalJatuhTempo),
        mulaiDari: formData.mulaiDari,
        sampaiDengan: formData.isOngoing ? 'ongoing' : formData.sampaiDengan,
        catatan: formData.catatan.trim(),
        isActive: true,
      };

      if (!Number.isFinite(billData.jumlah) || billData.jumlah <= 0) {
        toast({
          title: t('common_error'),
          description: t('common_error'),
          variant: 'destructive',
        });
        return;
      }

      if (editingBill) {
        await updateBill(editingBill.id, billData);
        toast({
          title: t('common_success'),
          description: t('common_success'),
        });
      } else {
        await addBill(user.id, billData);
        toast({
          title: t('common_success'),
          description: t('common_success'),
        });
      }

      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast({
        title: t('common_error'),
        description: t('common_error'),
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBill(id);
      toast({
        title: t('common_success'),
        description: t('common_success'),
      });
    } catch (error) {
      toast({
        title: t('common_error'),
        description: t('common_error'),
        variant: 'destructive',
      });
    }
  };

  const handleTogglePaid = async (bill: (typeof currentMonthBills)[0]) => {
    if (!user?.id) return;

    try {
      if (bill.isPaid && bill.payment) {
        await deleteBillPayment(bill.payment.id);
        toast({
          title: t('common_success'),
          description: t('bills_mark_unpaid'),
        });
      } else {
        await addBillPayment(user.id, {
          billId: bill.id,
          bulan: selectedMonth,
          dibayarPada: new Date().toISOString().slice(0, 19).replace('T', ' '),
          jumlahDibayar: bill.jumlah,
        });
        toast({
          title: t('common_success'),
          description: t('bills_mark_paid'),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: t('common_error'),
        description: message || t('common_error'),
        variant: 'destructive',
      });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">{t('bills_title')}</h1>
            <p className="text-muted-foreground">
              {t('bills_subtitle')} - {getMonthName(selectedMonth)}
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                {t('bills_add')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingBill ? t('bills_edit') : t('bills_add')}
                </DialogTitle>
                <DialogDescription>
                  {t('bills_subtitle')}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nama">{t('bills_name')}</Label>
                  <Input
                    id="nama"
                    value={formData.nama}
                    onChange={(e) =>
                      setFormData({ ...formData, nama: e.target.value })
                    }
                    placeholder={t('bills_name')}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="kategori">{t('common_category')}</Label>
                  <Select
                    value={formData.kategori}
                    onValueChange={(value) =>
                      setFormData({ ...formData, kategori: value })
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('common_category')} />
                    </SelectTrigger>
                    <SelectContent>
                      {kategoriTagihan.map((kat) => (
                        <SelectItem key={kat} value={kat}>
                          {kat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jumlah">{t('common_amount')}</Label>
                  <Input
                    id="jumlah"
                    type="number"
                    value={formData.jumlah}
                    onChange={(e) =>
                      setFormData({ ...formData, jumlah: e.target.value })
                    }
                    placeholder="0"
                    min="0"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tanggalJatuhTempo">{t('bills_due_date')}</Label>
                  <Select
                    value={formData.tanggalJatuhTempo}
                    onValueChange={(value) =>
                      setFormData({ ...formData, tanggalJatuhTempo: value })
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('bills_due_date')} />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                        <SelectItem key={day} value={day.toString()}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mulaiDari">{t('bills_start_month')}</Label>
                  <Input
                    id="mulaiDari"
                    type="month"
                    value={formData.mulaiDari}
                    onChange={(e) =>
                      setFormData({ ...formData, mulaiDari: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isOngoing"
                      checked={formData.isOngoing}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, isOngoing: checked as boolean })
                      }
                    />
                    <Label htmlFor="isOngoing" className="cursor-pointer">
                      {t('bills_ongoing')}
                    </Label>
                  </div>

                  {!formData.isOngoing && (
                    <div className="space-y-2">
                      <Label htmlFor="sampaiDengan">{t('bills_end_month')}</Label>
                      <Input
                        id="sampaiDengan"
                        type="month"
                        value={formData.sampaiDengan}
                        onChange={(e) =>
                          setFormData({ ...formData, sampaiDengan: e.target.value })
                        }
                        min={formData.mulaiDari}
                        required={!formData.isOngoing}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="catatan">{t('common_notes')}</Label>
                  <Textarea
                    id="catatan"
                    value={formData.catatan}
                    onChange={(e) =>
                      setFormData({ ...formData, catatan: e.target.value })
                    }
                    placeholder={t('common_notes')}
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    {t('common_cancel')}
                  </Button>
                  <Button type="submit">
                    {editingBill ? t('common_save') : t('common_add')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('bills_total')}</p>
                  <p className="text-xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('bills_paid')}</p>
                  <p className="text-xl font-bold">{stats.paid}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('bills_unpaid')}</p>
                  <p className="text-xl font-bold">{stats.unpaid}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('bills_overdue')}</p>
                  <p className="text-xl font-bold">{stats.overdue}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{t('bills_total')}</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{t('bills_paid')}</p>
                <p className="text-2xl font-bold text-green-500">
                  {formatCurrency(stats.paidAmount)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bills List */}
        <Card>
          <CardHeader>
            <CardTitle>{t('bills_title')}</CardTitle>
            <CardDescription>
              {t('bills_subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentMonthBills.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  {t('common_no_data')}
                </p>
                <Button
                  variant="link"
                  onClick={() => handleOpenDialog()}
                  className="mt-2"
                >
                  {t('bills_add')}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {currentMonthBills.map((bill) => (
                  <div
                    key={bill.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                      bill.isPaid
                        ? 'bg-muted/30 border-border/50'
                        : bill.isOverdue
                        ? 'bg-destructive/5 border-destructive/30'
                        : 'bg-card border-border'
                    }`}
                  >
                    <Checkbox
                      checked={bill.isPaid}
                      onCheckedChange={() => handleTogglePaid(bill)}
                      className="h-5 w-5"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className={`font-medium ${
                            bill.isPaid ? 'line-through text-muted-foreground' : ''
                          }`}
                        >
                          {bill.nama}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {bill.kategori}
                        </Badge>
                        {bill.isOverdue && !bill.isPaid && (
                          <Badge variant="destructive" className="text-xs">
                            {t('bills_overdue')}
                          </Badge>
                        )}
                        {bill.isPaid && (
                          <Badge
                            variant="secondary"
                            className="text-xs bg-green-500/10 text-green-600"
                          >
                            {t('bills_paid')}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {t('bills_due_date')}: {bill.tanggalJatuhTempo}
                        </span>
                        {bill.catatan && (
                          <span className="truncate">{bill.catatan}</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <p
                        className={`font-bold ${
                          bill.isPaid ? 'text-muted-foreground' : ''
                        }`}
                      >
                        {formatCurrency(bill.jumlah)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(bill)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('bills_delete_confirm')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {bill.nama}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('common_cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(bill.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {t('common_delete')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

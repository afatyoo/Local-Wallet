import { useEffect, useState, useMemo, useRef } from 'react';
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
import { Plus, Pencil, Trash2, ArrowDownCircle, Download, Eye, Paperclip, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Expense } from '@/stores/financeStore';
import {
  downloadReceipt,
  fetchReceiptBlob,
  planningApi,
  uploadExpenseReceipt,
} from '@/lib/api';

interface ReceiptItem {
  id: string;
  original_name: string;
  mime_type: string;
  size: number;
}

export default function ExpensePage() {
  const { user } = useAuthStore();
  const { expenses, masterData, selectedMonth, setSelectedMonth, loadAllData, addExpense, updateExpense, deleteExpense } = useFinanceStore();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Expense | null>(null);
  const [rules, setRules] = useState<Array<{ pattern: string; category: string; active: boolean | number }>>([]);
  const [receipts, setReceipts] = useState<Record<string, ReceiptItem[]>>({});
  const [pendingReceipt, setPendingReceipt] = useState<File | null>(null);
  const [previewReceipt, setPreviewReceipt] = useState<ReceiptItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    nama: '',
    kategori: '',
    metode: '',
    jumlah: '',
    catatan: '',
  });
  const pendingReceiptUrl = useMemo(
    () => pendingReceipt ? URL.createObjectURL(pendingReceipt) : null,
    [pendingReceipt],
  );

  useEffect(() => () => {
    if (pendingReceiptUrl) URL.revokeObjectURL(pendingReceiptUrl);
  }, [pendingReceiptUrl]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (user?.id) {
      loadAllData(user.id);
    }
  }, [user?.id, loadAllData]);

  useEffect(() => {
    planningApi.list<{
      id: string;
      transaction_type: 'expense' | 'income';
      pattern: string;
      category: string;
      active: boolean | number;
    }>('rules').then((result) => setRules(
      (result.data || []).filter(
        (rule) => rule.transaction_type === 'expense' && Boolean(rule.active),
      ),
    ));
  }, []);

  useEffect(() => {
    planningApi.listAllReceipts().then((result) => {
      const grouped: Record<string, ReceiptItem[]> = {};
      (result.data || []).forEach((receipt) => {
        (grouped[receipt.expense_id] ||= []).push(receipt);
      });
      setReceipts(grouped);
    });
  }, []);

  useEffect(() => {
    if (!formData.nama || formData.kategori) return;
    const name = formData.nama.toLocaleLowerCase();
    const match = rules.find((rule) => name.includes(rule.pattern.toLocaleLowerCase()));
    if (match) setFormData((current) => ({ ...current, kategori: match.category }));
  }, [formData.nama, formData.kategori, rules]);

  // Auto-switch to latest month when on 'all' and data loads
  const hasAutoSwitched = useRef(false);
  useEffect(() => {
    if (hasAutoSwitched.current) return;
    if (selectedMonth === 'all' && expenses.length > 0) {
      const months = [...new Set(expenses.map(e => e.bulan))];
      if (months.length > 0) {
        months.sort();
        const latestMonth = months[months.length - 1];
        setSelectedMonth(latestMonth);
        hasAutoSwitched.current = true;
      }
    }
  }, [expenses, selectedMonth, setSelectedMonth]);

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

  const clearPendingReceipt = () => {
    setPendingReceipt(null);
    if (receiptInputRef.current) receiptInputRef.current.value = '';
  };

  const resetForm = () => {
    setFormData({
      tanggal: new Date().toISOString().split('T')[0],
      nama: '',
      kategori: '',
      metode: '',
      jumlah: '',
      catatan: '',
    });
    clearPendingReceipt();
    setEditingItem(null);
  };

  const handleOpenDialog = (item?: Expense) => {
    clearPendingReceipt();
    if (item) {
      setEditingItem(item);
      setFormData({
        tanggal: item.tanggal,
        nama: item.nama,
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
    if (!formData.tanggal || !formData.nama || !formData.kategori || !formData.metode || !formData.jumlah) {
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
      let expenseId: string;
      if (editingItem) {
        await updateExpense(editingItem.id, {
          tanggal: formData.tanggal,
          nama: formData.nama,
          kategori: formData.kategori,
          metode: formData.metode,
          jumlah: amount,
          catatan: formData.catatan,
        });
        expenseId = editingItem.id;
      } else {
        const created = await addExpense(user!.id, {
          tanggal: formData.tanggal,
          nama: formData.nama,
          kategori: formData.kategori,
          metode: formData.metode,
          jumlah: amount,
          catatan: formData.catatan,
        });
        expenseId = created.id;
      }

      let attachmentError: string | null = null;
      if (pendingReceipt) {
        try {
          await uploadExpenseReceipt(expenseId, pendingReceipt);
          const result = await planningApi.listReceipts(expenseId);
          setReceipts((current) => ({ ...current, [expenseId]: result.data || [] }));
        } catch (error) {
          attachmentError = error instanceof Error ? error.message : t('common_error');
        }
      }
      toast({
        title: attachmentError ? t('expense_attachment_failed') : t('common_success'),
        description: attachmentError || t('common_success'),
        variant: attachmentError ? 'destructive' : 'default',
      });
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

  const handleReceiptUpload = (expenseId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,application/pdf';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        await uploadExpenseReceipt(expenseId, file);
        const result = await planningApi.listReceipts(expenseId);
        setReceipts((current) => ({ ...current, [expenseId]: result.data || [] }));
        toast({ title: t('common_success') });
      } catch (error) {
        toast({
          title: t('common_error'),
          description: error instanceof Error ? error.message : t('common_error'),
          variant: 'destructive',
        });
      }
    };
    input.click();
  };

  const handlePendingReceipt = (file?: File) => {
    if (!file) {
      clearPendingReceipt();
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type) || file.size > 5 * 1024 * 1024) {
      clearPendingReceipt();
      toast({
        title: t('common_error'),
        description: t('expense_attachment_hint'),
        variant: 'destructive',
      });
      return;
    }
    setPendingReceipt(file);
  };

  const handlePreviewReceipt = async (receipt: ReceiptItem) => {
    setPreviewReceipt(receipt);
    setIsPreviewLoading(true);
    setPreviewUrl(null);
    try {
      const blob = await fetchReceiptBlob(receipt.id);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (error) {
      setPreviewReceipt(null);
      toast({
        title: t('common_error'),
        description: error instanceof Error ? error.message : t('common_error'),
        variant: 'destructive',
      });
    } finally {
      setIsPreviewLoading(false);
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
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
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

                <div className="space-y-2">
                  <Label htmlFor="expense-receipt">{t('expense_receipt')}</Label>
                  <Input
                    ref={receiptInputRef}
                    id="expense-receipt"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(event) => handlePendingReceipt(event.target.files?.[0])}
                  />
                  <p className="text-xs text-muted-foreground">{t('expense_attachment_hint')}</p>
                  {pendingReceipt && pendingReceiptUrl && (
                    <div className="relative overflow-hidden rounded-md border bg-muted/20">
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="absolute right-2 top-2 z-10"
                        title={t('expense_remove_attachment')}
                        onClick={clearPendingReceipt}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      {pendingReceipt.type === 'application/pdf' ? (
                        <iframe
                          src={pendingReceiptUrl}
                          title={pendingReceipt.name}
                          className="h-48 w-full bg-background"
                        />
                      ) : (
                        <img
                          src={pendingReceiptUrl}
                          alt={pendingReceipt.name}
                          className="h-48 w-full object-contain"
                        />
                      )}
                      <p className="truncate border-t px-3 py-2 text-xs">{pendingReceipt.name}</p>
                    </div>
                  )}
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
                          title={t('expense_upload_receipt')}
                          onClick={() => handleReceiptUpload(expense.id)}
                        >
                          <Paperclip className="w-4 h-4" />
                        </Button>
                        {receipts[expense.id]?.[0] && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t('expense_preview_receipt')}
                            onClick={() => handlePreviewReceipt(receipts[expense.id][0])}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
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

        <Dialog
          open={Boolean(previewReceipt)}
          onOpenChange={(open) => {
            if (!open) {
              setPreviewReceipt(null);
              setPreviewUrl(null);
            }
          }}
        >
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{previewReceipt?.original_name}</DialogTitle>
              <DialogDescription>{t('expense_preview_receipt')}</DialogDescription>
            </DialogHeader>
            <div className="flex min-h-64 items-center justify-center overflow-hidden rounded-md border bg-muted/20">
              {isPreviewLoading && <p className="text-muted-foreground">{t('common_loading')}</p>}
              {!isPreviewLoading && previewUrl && previewReceipt?.mime_type === 'application/pdf' && (
                <iframe
                  src={previewUrl}
                  title={previewReceipt.original_name}
                  className="h-[65vh] w-full bg-background"
                />
              )}
              {!isPreviewLoading && previewUrl && previewReceipt?.mime_type.startsWith('image/') && (
                <img
                  src={previewUrl}
                  alt={previewReceipt.original_name}
                  className="max-h-[65vh] w-full object-contain"
                />
              )}
            </div>
            <DialogFooter>
              {previewReceipt && (
                <Button
                  onClick={() => downloadReceipt(previewReceipt.id, previewReceipt.original_name)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {t('expense_download_receipt')}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

import { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useFinanceStore } from '@/stores/financeStore';
import { useTranslation } from '@/lib/i18n';
import { AppLayout } from '@/components/AppLayout';
import { formatCurrency, formatDate } from '@/lib/utils';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, PiggyBank, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Saving } from '@/stores/financeStore';

export default function SavingsPage() {
  const { user } = useAuthStore();
  const { savings, loadAllData, addSaving, updateSaving, deleteSaving } = useFinanceStore();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Saving | null>(null);
  const [activeTab, setActiveTab] = useState<'Tabungan' | 'Investasi'>('Tabungan');
  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    jenis: 'Tabungan' as 'Tabungan' | 'Investasi',
    namaAkun: '',
    setoran: '',
    penarikan: '',
    catatan: '',
  });

  useEffect(() => {
    if (user?.id) {
      loadAllData(user.id);
    }
  }, [user?.id, loadAllData]);

  const filteredSavings = useMemo(
    () => savings.filter((s) => s.jenis === activeTab).sort((a, b) => 
      new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
    ),
    [savings, activeTab]
  );

  // Calculate running balance per account
  const accountSummary = useMemo(() => {
    const accounts: { [key: string]: { setoran: number; penarikan: number; saldo: number } } = {};
    
    filteredSavings.forEach((s) => {
      if (!accounts[s.namaAkun]) {
        accounts[s.namaAkun] = { setoran: 0, penarikan: 0, saldo: 0 };
      }
      accounts[s.namaAkun].setoran += s.setoran;
      accounts[s.namaAkun].penarikan += s.penarikan;
      accounts[s.namaAkun].saldo += s.setoran - s.penarikan;
    });

    return accounts;
  }, [filteredSavings]);

  const totalTabungan = useMemo(
    () => savings.filter((s) => s.jenis === 'Tabungan').reduce((sum, s) => sum + s.setoran - s.penarikan, 0),
    [savings]
  );

  const totalInvestasi = useMemo(
    () => savings.filter((s) => s.jenis === 'Investasi').reduce((sum, s) => sum + s.setoran - s.penarikan, 0),
    [savings]
  );

  const resetForm = () => {
    setFormData({
      tanggal: new Date().toISOString().split('T')[0],
      jenis: activeTab,
      namaAkun: '',
      setoran: '',
      penarikan: '',
      catatan: '',
    });
    setEditingItem(null);
  };

  const handleOpenDialog = (item?: Saving) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        tanggal: item.tanggal,
        jenis: item.jenis,
        namaAkun: item.namaAkun,
        setoran: item.setoran.toString(),
        penarikan: item.penarikan.toString(),
        catatan: item.catatan,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.tanggal || !formData.namaAkun) {
      toast({
        title: t('common_error'),
        description: t('common_error'),
        variant: 'destructive',
      });
      return;
    }

    const setoran = parseFloat(formData.setoran.replace(/[^\d]/g, '') || '0');
    const penarikan = parseFloat(formData.penarikan.replace(/[^\d]/g, '') || '0');

    if (setoran === 0 && penarikan === 0) {
      toast({
        title: t('common_error'),
        description: t('common_error'),
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingItem) {
        await updateSaving(editingItem.id, {
          tanggal: formData.tanggal,
          jenis: formData.jenis,
          namaAkun: formData.namaAkun,
          setoran,
          penarikan,
          catatan: formData.catatan,
        });
        toast({ title: t('common_success'), description: t('common_success') });
      } else {
        await addSaving(user!.id, {
          tanggal: formData.tanggal,
          jenis: formData.jenis,
          namaAkun: formData.namaAkun,
          setoran,
          penarikan,
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
    if (confirm(t('savings_delete_confirm'))) {
      await deleteSaving(id);
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
              <PiggyBank className="w-8 h-8 text-savings" />
              {t('savings_title')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('savings_subtitle')}
            </p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} className="gap-2">
                <Plus className="w-4 h-4" />
                {t('savings_add')}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingItem ? t('savings_edit') : t('savings_add')}</DialogTitle>
                <DialogDescription>
                  {t('savings_subtitle')}
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
                    <Label htmlFor="jenis">Type</Label>
                    <Select
                      value={formData.jenis}
                      onValueChange={(value: 'Tabungan' | 'Investasi') => 
                        setFormData({ ...formData, jenis: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Tabungan">{t('savings_title')}</SelectItem>
                        <SelectItem value="Investasi">Investment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="namaAkun">{t('savings_name')}</Label>
                  <Input
                    id="namaAkun"
                    placeholder={t('savings_name')}
                    value={formData.namaAkun}
                    onChange={(e) => setFormData({ ...formData, namaAkun: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="setoran">Deposit</Label>
                    <Input
                      id="setoran"
                      type="text"
                      placeholder="0"
                      value={formData.setoran}
                      onChange={(e) => setFormData({ ...formData, setoran: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="penarikan">Withdrawal</Label>
                    <Input
                      id="penarikan"
                      type="text"
                      placeholder="0"
                      value={formData.penarikan}
                      onChange={(e) => setFormData({ ...formData, penarikan: e.target.value })}
                    />
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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="stat-card-savings">
            <div className="flex items-center gap-3">
              <PiggyBank className="w-6 h-6 text-savings" />
              <div>
                <p className="text-sm text-muted-foreground">{t('dashboard_total_savings')}</p>
                <p className="text-2xl font-bold font-mono text-savings">{formatCurrency(totalTabungan)}</p>
              </div>
            </div>
          </div>
          <div className="stat-card border-l-4 border-l-investment">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-investment" />
              <div>
                <p className="text-sm text-muted-foreground">Total Investment</p>
                <p className="text-2xl font-bold font-mono text-investment">{formatCurrency(totalInvestasi)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'Tabungan' | 'Investasi')}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="Tabungan" className="gap-2">
              <PiggyBank className="w-4 h-4" />
              {t('savings_title')}
            </TabsTrigger>
            <TabsTrigger value="Investasi" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Investment
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {/* Account Summary */}
            {Object.keys(accountSummary).length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {Object.entries(accountSummary).map(([account, data]) => (
                  <div key={account} className="glass-card p-4">
                    <h4 className="font-medium mb-2">{account}</h4>
                    <p className={`text-xl font-mono font-bold ${data.saldo >= 0 ? 'text-income' : 'text-expense'}`}>
                      {formatCurrency(data.saldo)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Table */}
            <div className="glass-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common_date')}</TableHead>
                    <TableHead>{t('savings_name')}</TableHead>
                    <TableHead className="text-right">Deposit</TableHead>
                    <TableHead className="text-right">Withdrawal</TableHead>
                    <TableHead className="text-right">{t('common_actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSavings.length > 0 ? (
                    filteredSavings.map((saving) => (
                      <TableRow key={saving.id}>
                        <TableCell>{formatDate(saving.tanggal)}</TableCell>
                        <TableCell className="font-medium">{saving.namaAkun}</TableCell>
                        <TableCell className="text-right font-mono text-income">
                          {saving.setoran > 0 ? `+${formatCurrency(saving.setoran)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-expense">
                          {saving.penarikan > 0 ? `-${formatCurrency(saving.penarikan)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(saving)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(saving.id)}
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
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {t('common_no_data')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

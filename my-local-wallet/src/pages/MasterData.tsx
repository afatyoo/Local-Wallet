import { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useFinanceStore } from '@/stores/financeStore';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Database, Tag, CreditCard, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type MasterDataType = 'kategoriPemasukan' | 'kategoriPengeluaran' | 'metodePembayaran';

export default function MasterDataPage() {
  const { user } = useAuthStore();
  const { masterData, loadAllData, addMasterData, deleteMasterData } = useFinanceStore();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<MasterDataType>('kategoriPemasukan');
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    if (user?.id) {
      loadAllData(user.id);
    }
  }, [user?.id, loadAllData]);

  const filteredData = useMemo(
    () => masterData.filter((m) => m.type === activeTab),
    [masterData, activeTab]
  );

  const handleAdd = async () => {
    if (!newValue.trim()) {
      toast({
        title: 'Error',
        description: 'Nama tidak boleh kosong',
        variant: 'destructive',
      });
      return;
    }

    const exists = filteredData.some(
      (m) => m.value.toLowerCase() === newValue.trim().toLowerCase()
    );

    if (exists) {
      toast({
        title: 'Error',
        description: 'Data sudah ada',
        variant: 'destructive',
      });
      return;
    }

    await addMasterData(user!.id, activeTab, newValue.trim());
    toast({ title: 'Berhasil', description: 'Data berhasil ditambahkan' });
    setNewValue('');
    setIsDialogOpen(false);
  };

  const handleDelete = async (id: string, value: string) => {
    if (confirm(`Yakin ingin menghapus "${value}"?`)) {
      await deleteMasterData(id);
      toast({ title: 'Berhasil', description: 'Data berhasil dihapus' });
    }
  };

  const tabConfig = {
    kategoriPemasukan: {
      label: 'Kategori Pemasukan',
      icon: Tag,
      description: 'Kelola kategori untuk pemasukan',
    },
    kategoriPengeluaran: {
      label: 'Kategori Pengeluaran',
      icon: Wallet,
      description: 'Kelola kategori untuk pengeluaran',
    },
    metodePembayaran: {
      label: 'Metode Pembayaran',
      icon: CreditCard,
      description: 'Kelola metode pembayaran',
    },
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Database className="w-8 h-8 text-primary" />
              Master Data
            </h1>
            <p className="text-muted-foreground mt-1">
              Kelola kategori dan metode pembayaran
            </p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Tambah Data
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Tambah {tabConfig[activeTab].label}</DialogTitle>
                <DialogDescription>
                  Masukkan nama baru
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <Input
                  placeholder={`Nama ${tabConfig[activeTab].label.toLowerCase()}`}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Batal
                </Button>
                <Button onClick={handleAdd}>Tambah</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MasterDataType)}>
          <TabsList className="grid w-full grid-cols-3">
            {Object.entries(tabConfig).map(([key, config]) => (
              <TabsTrigger key={key} value={key} className="gap-2 text-xs sm:text-sm">
                <config.icon className="w-4 h-4 hidden sm:block" />
                <span className="truncate">{config.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(tabConfig).map(([key, config]) => (
            <TabsContent key={key} value={key} className="mt-6">
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <config.icon className="w-6 h-6 text-primary" />
                  <div>
                    <h3 className="font-semibold">{config.label}</h3>
                    <p className="text-sm text-muted-foreground">{config.description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredData.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                    >
                      <span className="font-medium">{item.value}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(item.id, item.value)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  
                  {filteredData.length === 0 && (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      Belum ada data
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useFinanceStore } from '@/stores/financeStore';
import { useTranslation } from '@/lib/i18n';
import { useBackup } from '@/hooks/useBackup';
import { cn, generateDynamicMonthOptions } from '@/lib/utils';
import {
  LayoutDashboard,
  ArrowUpCircle,
  ArrowDownCircle,
  Target,
  PiggyBank,
  Database,
  Settings,
  LogOut,
  Menu,
  Wallet,
  FileText,
  Receipt,
  PieChart,
  Heart,
  CalendarDays,
  Flag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { QuickBackupButton } from '@/components/QuickBackupButton';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { selectedMonth, setSelectedMonth, incomes, expenses, budgets, savings, bills, billPayments } = useFinanceStore();
  const { t } = useTranslation();
  const { autoSaveToLocalStorage } = useBackup();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  // Dynamic month options based on actual transaction data
  const monthOptions = useMemo(() => {
    const allDates: string[] = [
      ...incomes.map(i => i.tanggal),
      ...expenses.map(e => e.tanggal),
      ...budgets.map(b => b.bulan ? `${b.bulan}-01` : ''),
      ...savings.map(s => s.tanggal),
      ...bills.map(b => b.mulaiDari ? `${b.mulaiDari}-01` : ''),
      ...billPayments.map(bp => bp.dibayarPada),
    ].filter(Boolean);
    
    return generateDynamicMonthOptions(allDates);
  }, [incomes, expenses, budgets, savings, bills, billPayments]);

  // Auto-save to localStorage whenever data changes
  useEffect(() => {
    if (user?.id) {
      const timer = setTimeout(() => {
        autoSaveToLocalStorage();
      }, 2000); // Debounce 2 seconds
      return () => clearTimeout(timer);
    }
  }, [user?.id, incomes, expenses, budgets, savings, bills, billPayments, autoSaveToLocalStorage]);

  const navItems = [
    { path: '/dashboard', labelKey: 'nav_dashboard' as const, icon: LayoutDashboard },
    { path: '/income', labelKey: 'nav_income' as const, icon: ArrowUpCircle },
    { path: '/expense', labelKey: 'nav_expense' as const, icon: ArrowDownCircle },
    { path: '/bills', labelKey: 'nav_bills' as const, icon: Receipt },
    { path: '/budget', labelKey: 'nav_budget' as const, icon: Target },
    { path: '/savings', labelKey: 'nav_savings' as const, icon: PiggyBank },
    { path: '/insights', labelKey: 'nav_insights' as const, icon: PieChart },
    { path: '/heatmap', labelKey: 'nav_heatmap' as const, icon: CalendarDays },
    { path: '/health-score', labelKey: 'nav_health_score' as const, icon: Heart },
    { path: '/targets', labelKey: 'nav_targets' as const, icon: Flag },
    { path: '/reports', labelKey: 'nav_reports' as const, icon: FileText },
    { path: '/master-data', labelKey: 'nav_master_data' as const, icon: Database },
    { path: '/settings', labelKey: 'nav_settings' as const, icon: Settings },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-lg">FinanceApp</h1>
            <p className="text-xs text-muted-foreground">Personal Manager</p>
          </div>
        </div>
      </div>

      {/* Month Selector */}
      <div className="p-4 border-b border-border/50">
        <label className="text-xs text-muted-foreground mb-2 block">{t('common_month')}</label>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-full bg-secondary/50 border-border/50">
            <SelectValue placeholder={t('common_month')} />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setIsMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                isActive
                  ? 'bg-primary/10 text-primary border-l-2 border-l-primary ml-0'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{t(item.labelKey)}</span>
          </NavLink>
        ))}
      </nav>

      {/* User & Logout */}
      <div className="p-4 border-t border-border/50">
        <div className="flex items-center gap-3 px-4 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-sm font-medium text-primary">
              {user?.username?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.username}</p>
          </div>
          <QuickBackupButton />
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5" />
          <span>{t('nav_logout')}</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-72 border-r border-border/50 bg-sidebar">
        <SidebarContent />
      </aside>

      {/* Mobile Header & Sheet */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center justify-between p-4 border-b border-border/50 bg-card/50 backdrop-blur-lg sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <span className="font-bold">FinanceApp</span>
          </div>
          
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-sidebar">
              <SidebarContent />
            </SheetContent>
          </Sheet>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <div className="max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

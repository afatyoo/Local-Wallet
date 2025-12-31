import { useEffect, useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useFinanceStore } from '@/stores/financeStore';
import { useTranslation } from '@/lib/i18n';
import { AppLayout } from '@/components/AppLayout';
import { BackupReminder } from '@/components/BackupReminder';
import { HealthScoreWidget } from '@/components/HealthScoreWidget';
import { formatCurrency, getMonthName } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Wallet,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const CHART_COLORS = [
  'hsl(160, 84%, 39%)',
  'hsl(0, 84%, 60%)',
  'hsl(38, 92%, 50%)',
  'hsl(262, 83%, 58%)',
  'hsl(200, 84%, 50%)',
  'hsl(320, 84%, 50%)',
  'hsl(50, 84%, 50%)',
  'hsl(280, 84%, 50%)',
];

export default function Dashboard() {
  const { user } = useAuthStore();
  const { incomes, expenses, savings, selectedMonth, loadAllData, error, clearError, isLoading } = useFinanceStore();
  const { t } = useTranslation();

  useEffect(() => {
    if (user?.id) {
      loadAllData(user.id);
    }
  }, [user?.id, loadAllData]);

  const handleRetry = () => {
    if (user?.id) {
      clearError();
      loadAllData(user.id);
    }
  };

  // Filter data by selected month
  const monthlyIncomes = useMemo(
    () => selectedMonth === 'all' ? incomes : incomes.filter((i) => i.bulan === selectedMonth),
    [incomes, selectedMonth]
  );

  const monthlyExpenses = useMemo(
    () => selectedMonth === 'all' ? expenses : expenses.filter((e) => e.bulan === selectedMonth),
    [expenses, selectedMonth]
  );

  // Calculate totals
  const totalIncome = useMemo(
    () => monthlyIncomes.reduce((sum, i) => sum + i.jumlah, 0),
    [monthlyIncomes]
  );

  const totalExpense = useMemo(
    () => monthlyExpenses.reduce((sum, e) => sum + e.jumlah, 0),
    [monthlyExpenses]
  );

  const runningBalance = useMemo(() => {
    if (selectedMonth === 'all') {
      const allIncome = incomes.reduce((sum, i) => sum + i.jumlah, 0);
      const allExpense = expenses.reduce((sum, e) => sum + e.jumlah, 0);
      return allIncome - allExpense;
    }

    const incomeToMonth = incomes
      .filter((i) => i.bulan && i.bulan <= selectedMonth)
      .reduce((sum, i) => sum + i.jumlah, 0);

    const expenseToMonth = expenses
      .filter((e) => e.bulan && e.bulan <= selectedMonth)
      .reduce((sum, e) => sum + e.jumlah, 0);

    return incomeToMonth - expenseToMonth;
  }, [incomes, expenses, selectedMonth]);

  const totalSavings = useMemo(
    () => savings.reduce((sum, s) => sum + s.setoran - s.penarikan, 0),
    [savings]
  );

  // Bar chart data - last 6 months
  const barChartData = useMemo(() => {
    const months: { [key: string]: { income: number; expense: number } } = {};
    
    incomes.forEach((i) => {
      if (!months[i.bulan]) months[i.bulan] = { income: 0, expense: 0 };
      months[i.bulan].income += i.jumlah;
    });
    
    expenses.forEach((e) => {
      if (!months[e.bulan]) months[e.bulan] = { income: 0, expense: 0 };
      months[e.bulan].expense += e.jumlah;
    });

    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, data]) => ({
        name: getMonthName(month).split(' ')[0],
        [t('nav_income')]: data.income,
        [t('nav_expense')]: data.expense,
      }));
  }, [incomes, expenses, t]);

  // Pie chart data - expense categories
  const pieChartData = useMemo(() => {
    const categories: { [key: string]: number } = {};
    
    monthlyExpenses.forEach((e) => {
      if (!categories[e.kategori]) categories[e.kategori] = 0;
      categories[e.kategori] += e.jumlah;
    });

    return Object.entries(categories).map(([name, value]) => ({
      name,
      value,
    }));
  }, [monthlyExpenses]);

  const StatCard = ({
    title,
    value,
    icon: Icon,
    variant,
  }: {
    title: string;
    value: number;
    icon: React.ElementType;
    variant: 'income' | 'expense' | 'balance' | 'savings';
  }) => {
    const variantClasses = {
      income: 'stat-card-income',
      expense: 'stat-card-expense',
      balance: 'stat-card-balance',
      savings: 'stat-card-savings',
    };

    const iconColors = {
      income: 'text-income',
      expense: 'text-expense',
      balance: 'text-primary',
      savings: 'text-savings',
    };

    return (
      <div className={variantClasses[variant]}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className="text-2xl font-bold font-mono">{formatCurrency(value)}</p>
          </div>
          <div className={`p-2 rounded-lg bg-secondary/50 ${iconColors[variant]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Koneksi Gagal</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-3">{error}</p>
              <Button variant="outline" size="sm" onClick={handleRetry} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Coba Lagi
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Backup Reminder */}
        <BackupReminder />

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">{t('dashboard_title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('dashboard_subtitle')} - {getMonthName(selectedMonth)}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title={t('dashboard_total_income')}
            value={totalIncome}
            icon={ArrowUpCircle}
            variant="income"
          />
          <StatCard
            title={t('dashboard_total_expense')}
            value={totalExpense}
            icon={ArrowDownCircle}
            variant="expense"
          />
          <StatCard
            title={t('dashboard_balance')}
            value={runningBalance}
            icon={Wallet}
            variant="balance"
          />
          <StatCard
            title={t('dashboard_total_savings')}
            value={totalSavings}
            icon={PiggyBank}
            variant="savings"
          />
        </div>

        {/* Health Score Widget */}
        <HealthScoreWidget />

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold mb-4">{t('reports_income_vs_expense')}</h3>
            <div className="h-80">
              {barChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend />
                    <Bar dataKey={t('nav_income')} fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={t('nav_expense')} fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  {t('common_no_data')}
                </div>
              )}
            </div>
          </div>

          {/* Pie Chart */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold mb-4">{t('dashboard_expense_by_category')}</h3>
            <div className="h-80">
              {pieChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  {t('common_no_data')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4">{t('dashboard_recent_transactions')}</h3>
          <div className="space-y-3">
            {[...monthlyIncomes.slice(-3), ...monthlyExpenses.slice(-3)]
              .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())
              .slice(0, 5)
              .map((transaction) => {
                const isIncome = 'sumber' in transaction;
                return (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isIncome ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'}`}>
                        {isIncome ? <ArrowUpCircle className="w-5 h-5" /> : <ArrowDownCircle className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-medium">
                          {isIncome ? (transaction as any).sumber : (transaction as any).nama}
                        </p>
                        <p className="text-sm text-muted-foreground">{transaction.kategori}</p>
                      </div>
                    </div>
                    <p className={`font-mono font-medium ${isIncome ? 'text-income' : 'text-expense'}`}>
                      {isIncome ? '+' : '-'}{formatCurrency(transaction.jumlah)}
                    </p>
                  </div>
                );
              })}
            {monthlyIncomes.length === 0 && monthlyExpenses.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {t('common_no_data')}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

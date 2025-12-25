import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useFinanceStore } from '@/stores/financeStore';
import { useExpenseInsights } from '@/hooks/useExpenseInsights';
import { useTranslation } from '@/lib/i18n';
import { AppLayout } from '@/components/AppLayout';
import { formatCurrency, generateMonthOptions, getMonthName } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import { TrendingDown, Lightbulb, ChevronRight, PieChartIcon } from 'lucide-react';

const CHART_COLORS = [
  'hsl(160, 84%, 39%)', // green
  'hsl(0, 84%, 60%)',   // red
  'hsl(38, 92%, 50%)',  // orange
  'hsl(262, 83%, 58%)', // purple
  'hsl(200, 84%, 50%)', // blue
  'hsl(320, 84%, 50%)', // pink
  'hsl(50, 84%, 50%)',  // yellow
  'hsl(280, 84%, 50%)', // violet
];

export default function InsightsPage() {
  const { user } = useAuthStore();
  const { loadAllData, selectedMonth, setSelectedMonth } = useFinanceStore();
  const { t } = useTranslation();
  const [viewMonth, setViewMonth] = useState(selectedMonth);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const monthOptions = generateMonthOptions();

  useEffect(() => {
    if (user?.id) {
      loadAllData(user.id);
    }
  }, [user?.id, loadAllData]);

  const {
    categoryData,
    totalExpense,
    topCategory,
    insights,
    getTransactionsByCategory,
  } = useExpenseInsights(viewMonth);

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category);
    setIsDialogOpen(true);
  };

  const selectedTransactions = selectedCategory 
    ? getTransactionsByCategory(selectedCategory) 
    : [];

  // Custom label untuk pie chart
  const renderCustomLabel = ({ name, percentage }: { name: string; percentage: number }) => {
    if (percentage < 5) return null;
    return `${percentage.toFixed(0)}%`;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <PieChartIcon className="w-8 h-8 text-primary" />
              {t('insights_title')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('insights_subtitle')}
            </p>
          </div>

          {/* Period Selector */}
          <Select value={viewMonth} onValueChange={setViewMonth}>
            <SelectTrigger className="w-full md:w-64">
              <SelectValue />
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

        {categoryData.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="py-12 text-center">
              <TrendingDown className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-lg">{t('insights_no_data')}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardDescription>{t('common_total')} {t('nav_expense')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-expense">
                    {formatCurrency(totalExpense)}
                  </p>
                </CardContent>
              </Card>

              {topCategory && (
                <Card className="glass-card border-expense/30">
                  <CardHeader className="pb-2">
                    <CardDescription>{t('insights_highest_spending').split(':')[0]}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{topCategory.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {topCategory.percentage.toFixed(1)}% • {formatCurrency(topCategory.value)}
                    </p>
                  </CardContent>
                </Card>
              )}

              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardDescription>{t('insights_category_count').split(' ')[0]}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{categoryData.length}</p>
                  <p className="text-sm text-muted-foreground">{t('common_category')}</p>
                </CardContent>
              </Card>
            </div>

            {/* Insights Section */}
            <Card className="glass-card bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Lightbulb className="w-5 h-5" />
                  Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {insights.map((insight, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Pie Chart & Category List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pie Chart */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>{t('dashboard_expense_by_category')}</CardTitle>
                  <CardDescription>{t('insights_click_category')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={120}
                          paddingAngle={2}
                          dataKey="value"
                          label={renderCustomLabel}
                          onClick={(data) => handleCategoryClick(data.name)}
                          style={{ cursor: 'pointer' }}
                        >
                          {categoryData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                              stroke="transparent"
                            />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Category List */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>{t('common_category')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {categoryData.map((category, index) => (
                      <Button
                        key={category.name}
                        variant="ghost"
                        className="w-full justify-between p-4 h-auto hover:bg-secondary/50"
                        onClick={() => handleCategoryClick(category.name)}
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                          />
                          <div className="text-left">
                            <p className="font-medium">{category.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {t('insights_transactions_count').replace('{count}', String(category.count))}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-medium">{formatCurrency(category.value)}</p>
                            <p className="text-sm text-muted-foreground">
                              {category.percentage.toFixed(1)}%
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Transaction Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>
                {t('insights_transactions')} - {selectedCategory}
              </DialogTitle>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common_date')}</TableHead>
                  <TableHead>{t('common_description')}</TableHead>
                  <TableHead className="text-right">{t('common_amount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{new Date(tx.tanggal).toLocaleDateString()}</TableCell>
                    <TableCell>{tx.nama}</TableCell>
                    <TableCell className="text-right text-expense">
                      {formatCurrency(tx.jumlah)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

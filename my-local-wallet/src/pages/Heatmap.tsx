import { useState } from 'react';
import { useFinanceStore } from '@/stores/financeStore';
import { useExpenseHeatmap } from '@/hooks/useExpenseHeatmap';
import { useTranslation } from '@/lib/i18n';
import { AppLayout } from '@/components/AppLayout';
import { formatCurrency, formatDate, generateMonthOptions } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { CalendarDays, Flame, TrendingDown, Calendar, Info } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function HeatmapPage() {
  const { selectedMonth, setSelectedMonth } = useFinanceStore();
  const { daysData, insights, monthName, firstDayOffset, daysInMonth } = useExpenseHeatmap(selectedMonth);
  const { t } = useTranslation();
  const monthOptions = generateMonthOptions();
  
  const [selectedDay, setSelectedDay] = useState<typeof daysData[0] | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const weekDays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  const handleDayClick = (day: typeof daysData[0]) => {
    if (day.transactions.length > 0) {
      setSelectedDay(day);
      setIsDialogOpen(true);
    }
  };

  // Warna berdasarkan intensitas
  const getIntensityColor = (intensity: string) => {
    switch (intensity) {
      case 'none':
        return 'bg-muted/30 text-muted-foreground';
      case 'low':
        return 'bg-green-500/30 text-green-700 dark:text-green-300 border-green-500/50';
      case 'medium':
        return 'bg-yellow-500/30 text-yellow-700 dark:text-yellow-300 border-yellow-500/50';
      case 'high':
        return 'bg-orange-500/30 text-orange-700 dark:text-orange-300 border-orange-500/50';
      case 'very-high':
        return 'bg-red-500/30 text-red-700 dark:text-red-300 border-red-500/50';
      default:
        return 'bg-muted/30';
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <CalendarDays className="w-8 h-8 text-primary" />
              {t('heatmap_title')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('heatmap_subtitle')}
            </p>
          </div>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-48">
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

        {/* Insights Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Flame className="w-4 h-4 text-red-500" />
                {t('heatmap_most_expensive')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {insights.mostExpensiveDay ? (
                <>
                  <p className="text-2xl font-bold text-expense">
                    {formatCurrency(insights.mostExpensiveDay.total)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(insights.mostExpensiveDay.date)}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">-</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-green-500" />
                {t('heatmap_zero_days')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-income">
                {insights.zeroExpenseDays} {t('heatmap_days')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('heatmap_no_expense')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                {t('heatmap_average_daily')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatCurrency(insights.averageDaily)}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('heatmap_per_day')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Info className="w-4 h-4 text-purple-500" />
                {t('common_total')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-expense">
                {formatCurrency(insights.totalExpense)}
              </p>
              <p className="text-sm text-muted-foreground">
                {insights.activeDays} {t('heatmap_active_days')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-muted-foreground">{t('heatmap_legend')}:</span>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-muted/30 border" />
            <span>{t('heatmap_no_expense')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500/30 border border-green-500/50" />
            <span>{t('heatmap_low')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-500/30 border border-yellow-500/50" />
            <span>{t('heatmap_medium')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-orange-500/30 border border-orange-500/50" />
            <span>{t('heatmap_high')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500/30 border border-red-500/50" />
            <span>{t('heatmap_very_high')}</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="glass-card p-4 sm:p-6">
          <h2 className="text-xl font-semibold mb-4">{monthName}</h2>
          
          {/* Week Headers */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center text-xs sm:text-sm font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {/* Empty cells for offset */}
            {Array.from({ length: firstDayOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {/* Day cells */}
            {daysData.map((day) => (
              <button
                key={day.date}
                onClick={() => handleDayClick(day)}
                disabled={day.transactions.length === 0}
                className={cn(
                  'aspect-square rounded-lg flex flex-col items-center justify-center text-xs sm:text-sm transition-all border',
                  getIntensityColor(day.intensity),
                  day.transactions.length > 0 
                    ? 'cursor-pointer hover:scale-105 hover:shadow-md' 
                    : 'cursor-default'
                )}
              >
                <span className="font-medium">{day.day}</span>
                {day.total > 0 && (
                  <span className="text-[10px] sm:text-xs font-mono hidden sm:block">
                    {(day.total / 1000).toFixed(0)}k
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Click hint */}
        <p className="text-sm text-muted-foreground text-center">
          {t('heatmap_click_hint')}
        </p>

        {/* Day Detail Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {selectedDay && formatDate(selectedDay.date)}
              </DialogTitle>
            </DialogHeader>

            {selectedDay && (
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">{t('common_total')}</span>
                  <span className="text-xl font-bold text-expense">
                    {formatCurrency(selectedDay.total)}
                  </span>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common_description')}</TableHead>
                      <TableHead>{t('common_category')}</TableHead>
                      <TableHead className="text-right">{t('common_amount')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedDay.transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-medium">{tx.nama}</TableCell>
                        <TableCell>{tx.kategori}</TableCell>
                        <TableCell className="text-right font-mono text-expense">
                          {formatCurrency(tx.jumlah)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

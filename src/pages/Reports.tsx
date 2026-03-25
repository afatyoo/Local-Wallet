import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useFinanceStore } from '@/stores/financeStore';
import { AppLayout } from '@/components/AppLayout';
import { generateFinanceReport } from '@/lib/pdfGenerator';
import { generateExcelReport } from '@/lib/excelExport';
import { getMonthName, generateMonthOptions } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FileText,
  Download,
  Loader2,
  FileSpreadsheet,
  Calendar,
  CheckCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ReportsPage() {
  const { user } = useAuthStore();
  const { incomes, expenses, budgets, savings, loadAllData } = useFinanceStore();
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [includeOptions, setIncludeOptions] = useState({
    income: true,
    expense: true,
    budget: true,
    categoryBreakdown: true,
  });

  const monthOptions = generateMonthOptions();

  useEffect(() => {
    if (user?.id) {
      loadAllData(user.id);
    }
  }, [user?.id, loadAllData]);

  const handleGeneratePDF = async () => {
    if (!user) return;

    setIsGenerating(true);

    try {
      // Small delay for UX
      await new Promise(resolve => setTimeout(resolve, 500));

      generateFinanceReport({
        incomes: includeOptions.income ? incomes : [],
        expenses: includeOptions.expense ? expenses : [],
        budgets: includeOptions.budget ? budgets : [],
        savings,
        selectedMonth: selectedPeriod,
        username: user.username,
      });

      toast({
        title: 'Success',
        description: 'PDF report has been downloaded',
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate PDF report',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateExcel = async () => {
    if (!user) return;

    setIsGenerating(true);

    try {
      // Small delay for UX
      await new Promise(resolve => setTimeout(resolve, 500));

      generateExcelReport({
        incomes: includeOptions.income ? incomes : [],
        expenses: includeOptions.expense ? expenses : [],
        budgets: includeOptions.budget ? budgets : [],
        selectedMonth: selectedPeriod,
        username: user.username,
      });

      toast({
        title: 'Success',
        description: 'Excel report has been downloaded',
      });
    } catch (error) {
      console.error('Excel generation error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate Excel report',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getDataSummary = () => {
    const filtered = {
      incomes: selectedPeriod === 'all' ? incomes : incomes.filter(i => i.bulan === selectedPeriod),
      expenses: selectedPeriod === 'all' ? expenses : expenses.filter(e => e.bulan === selectedPeriod),
      budgets: selectedPeriod === 'all' ? budgets : budgets.filter(b => b.bulan === selectedPeriod),
    };

    return {
      incomeCount: filtered.incomes.length,
      expenseCount: filtered.expenses.length,
      budgetCount: filtered.budgets.length,
    };
  };

  const summary = getDataSummary();

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            Reports
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate financial reports in PDF or Excel format
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Settings Card */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Report Settings
                </CardTitle>
                <CardDescription>
                  Select period and data to include in the report
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Period Selection */}
                <div className="space-y-2">
                  <Label>Report Period</Label>
                  <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue placeholder="Select period" />
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

                {/* Include Options */}
                <div className="space-y-3">
                  <Label>Data to Include</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center space-x-3 p-3 rounded-lg bg-secondary/30">
                      <Checkbox
                        id="income"
                        checked={includeOptions.income}
                        onCheckedChange={(checked) =>
                          setIncludeOptions(prev => ({ ...prev, income: !!checked }))
                        }
                      />
                      <label htmlFor="income" className="text-sm font-medium cursor-pointer">
                        Income Data
                      </label>
                    </div>

                    <div className="flex items-center space-x-3 p-3 rounded-lg bg-secondary/30">
                      <Checkbox
                        id="expense"
                        checked={includeOptions.expense}
                        onCheckedChange={(checked) =>
                          setIncludeOptions(prev => ({ ...prev, expense: !!checked }))
                        }
                      />
                      <label htmlFor="expense" className="text-sm font-medium cursor-pointer">
                        Expense Data
                      </label>
                    </div>

                    <div className="flex items-center space-x-3 p-3 rounded-lg bg-secondary/30">
                      <Checkbox
                        id="budget"
                        checked={includeOptions.budget}
                        onCheckedChange={(checked) =>
                          setIncludeOptions(prev => ({ ...prev, budget: !!checked }))
                        }
                      />
                      <label htmlFor="budget" className="text-sm font-medium cursor-pointer">
                        Budget Data
                      </label>
                    </div>

                    <div className="flex items-center space-x-3 p-3 rounded-lg bg-secondary/30">
                      <Checkbox
                        id="categoryBreakdown"
                        checked={includeOptions.categoryBreakdown}
                        onCheckedChange={(checked) =>
                          setIncludeOptions(prev => ({ ...prev, categoryBreakdown: !!checked }))
                        }
                      />
                      <label htmlFor="categoryBreakdown" className="text-sm font-medium cursor-pointer">
                        Category Breakdown
                      </label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Generate Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleGeneratePDF}
                disabled={isGenerating}
                size="lg"
                className="flex-1 gap-3"
                variant="default"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5" />
                    Export PDF
                  </>
                )}
              </Button>

              <Button
                onClick={handleGenerateExcel}
                disabled={isGenerating}
                size="lg"
                className="flex-1 gap-3"
                variant="outline"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-5 h-5" />
                    Export Excel
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Preview Card */}
          <div className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  Data Preview
                </CardTitle>
                <CardDescription>
                  {getMonthName(selectedPeriod)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-income/10">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-income" />
                      <span className="text-sm">Income</span>
                    </div>
                    <span className="font-mono font-medium">{summary.incomeCount} records</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-expense/10">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-expense" />
                      <span className="text-sm">Expenses</span>
                    </div>
                    <span className="font-mono font-medium">{summary.expenseCount} records</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-primary" />
                      <span className="text-sm">Budget</span>
                    </div>
                    <span className="font-mono font-medium">{summary.budgetCount} records</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <FileText className="w-5 h-5 text-primary mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium mb-1">Report Formats</p>
                    <p className="text-muted-foreground">
                      Export to PDF (formatted for printing) or Excel (editable spreadsheet).
                      Both include summary, tables, and category breakdown.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

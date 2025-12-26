import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useFinanceStore } from '@/stores/financeStore';
import { useFinancialHealth } from '@/hooks/useFinancialHealth';
import { useTranslation } from '@/lib/i18n';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Heart, 
  PiggyBank, 
  Target, 
  TrendingDown, 
  CalendarCheck,
  Lightbulb,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react';

export default function HealthScorePage() {
  const { user } = useAuthStore();
  const { loadAllData, selectedMonth } = useFinanceStore();
  const { t } = useTranslation();

  useEffect(() => {
    if (user?.id) {
      loadAllData(user.id);
    }
  }, [user?.id, loadAllData]);

  const {
    totalScore,
    breakdown,
    status,
    statusColor,
    statusEmoji,
    recommendations,
    savingRatioPercent,
    overBudgetCategories,
    spendingChange,
    activeDaysPercent,
  } = useFinancialHealth();

  const statusText = {
    healthy: t('health_status_healthy'),
    moderate: t('health_status_moderate'),
    needs_attention: t('health_status_needs_attention'),
  };

  const getScoreColor = (score: number, max: number) => {
    const ratio = score / max;
    if (ratio >= 0.7) return 'bg-income';
    if (ratio >= 0.4) return 'bg-yellow-500';
    return 'bg-expense';
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Heart className="w-8 h-8 text-primary" />
            {t('health_title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('health_subtitle')}
          </p>
        </div>

        {/* Main Score Card */}
        <Card className="glass-card overflow-hidden">
          <div className={`h-2 ${
            status === 'healthy' ? 'bg-income' : 
            status === 'moderate' ? 'bg-yellow-500' : 'bg-expense'
          }`} />
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col md:flex-row items-center justify-center gap-8">
              {/* Score Circle */}
              <div className="relative">
                <div className={`w-48 h-48 rounded-full border-8 flex items-center justify-center ${
                  status === 'healthy' ? 'border-income/30' : 
                  status === 'moderate' ? 'border-yellow-500/30' : 'border-expense/30'
                }`}>
                  <div className="text-center">
                    <span className="text-5xl font-bold">{totalScore}</span>
                    <p className="text-muted-foreground">/ 100</p>
                  </div>
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                  <span className={`px-4 py-1 rounded-full text-sm font-medium ${
                    status === 'healthy' ? 'bg-income/20 text-income' : 
                    status === 'moderate' ? 'bg-yellow-500/20 text-yellow-600' : 'bg-expense/20 text-expense'
                  }`}>
                    {statusEmoji} {statusText[status]}
                  </span>
                </div>
              </div>

              {/* Score Breakdown */}
              <div className="flex-1 w-full max-w-md space-y-4">
                {/* Saving Ratio */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <PiggyBank className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{t('health_saving_ratio')}</span>
                    </div>
                    <span className="text-sm font-bold">{breakdown.savingRatio}/40</span>
                  </div>
                  <Progress value={(breakdown.savingRatio / 40) * 100} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {savingRatioPercent.toFixed(1)}% {t('health_saving_ratio_desc')}
                  </p>
                </div>

                {/* Budget Discipline */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{t('health_budget_discipline')}</span>
                    </div>
                    <span className="text-sm font-bold">{breakdown.budgetDiscipline}/30</span>
                  </div>
                  <Progress value={(breakdown.budgetDiscipline / 30) * 100} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {overBudgetCategories.length > 0 
                      ? `Over budget: ${overBudgetCategories.join(', ')}`
                      : t('health_budget_discipline_desc')
                    }
                  </p>
                </div>

                {/* Spending Stability */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{t('health_spending_stability')}</span>
                    </div>
                    <span className="text-sm font-bold">{breakdown.spendingStability}/20</span>
                  </div>
                  <Progress value={(breakdown.spendingStability / 20) * 100} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    {spendingChange > 0 ? (
                      <><ArrowUp className="w-3 h-3 text-expense" /> +{spendingChange.toFixed(0)}%</>
                    ) : spendingChange < 0 ? (
                      <><ArrowDown className="w-3 h-3 text-income" /> {spendingChange.toFixed(0)}%</>
                    ) : (
                      <><Minus className="w-3 h-3" /> 0%</>
                    )}
                    <span className="ml-1">{t('health_spending_stability_desc')}</span>
                  </p>
                </div>

                {/* Consistency */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <CalendarCheck className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{t('health_consistency')}</span>
                    </div>
                    <span className="text-sm font-bold">{breakdown.consistencyScore}/10</span>
                  </div>
                  <Progress value={(breakdown.consistencyScore / 10) * 100} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {activeDaysPercent.toFixed(0)}% {t('health_consistency_desc')}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card className="glass-card bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Lightbulb className="w-5 h-5" />
              {t('health_recommendations')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recommendations.length > 0 ? (
              <ul className="space-y-3">
                {recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-3 p-3 rounded-lg bg-background/50">
                    <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium text-primary">
                      {index + 1}
                    </span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">
                {t('health_rec_good_job')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Score Explanation */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>{t('health_calculation_title')}</CardTitle>
            <CardDescription>{t('health_calculation_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-2 mb-2">
                  <PiggyBank className="w-5 h-5 text-income" />
                  <span className="font-medium">{t('health_saving_ratio')} (40 {t('health_points')})</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('health_saving_formula')}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-5 h-5 text-primary" />
                  <span className="font-medium">{t('health_budget_discipline')} (30 {t('health_points')})</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('health_budget_formula')}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-5 h-5 text-expense" />
                  <span className="font-medium">{t('health_spending_stability')} (20 {t('health_points')})</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('health_stability_formula')}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarCheck className="w-5 h-5 text-savings" />
                  <span className="font-medium">{t('health_consistency')} (10 {t('health_points')})</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('health_consistency_formula')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

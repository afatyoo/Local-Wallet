import { useFinancialHealth } from '@/hooks/useFinancialHealth';
import { useTranslation } from '@/lib/i18n';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Widget ringkas untuk menampilkan Financial Health Score di Dashboard
 * Menampilkan skor, status, dan tombol untuk melihat detail
 */
export function HealthScoreWidget() {
  const { t } = useTranslation();
  const { totalScore, status, statusEmoji } = useFinancialHealth();

  const statusText = {
    healthy: t('health_status_healthy'),
    moderate: t('health_status_moderate'),
    needs_attention: t('health_status_needs_attention'),
  };

  const statusColors = {
    healthy: 'border-income/30 bg-income/5',
    moderate: 'border-yellow-500/30 bg-yellow-500/5',
    needs_attention: 'border-expense/30 bg-expense/5',
  };

  const scoreColors = {
    healthy: 'text-income',
    moderate: 'text-yellow-500',
    needs_attention: 'text-expense',
  };

  return (
    <Card className={`glass-card ${statusColors[status]} transition-all hover:shadow-lg`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full border-4 flex items-center justify-center ${
              status === 'healthy' ? 'border-income' : 
              status === 'moderate' ? 'border-yellow-500' : 'border-expense'
            }`}>
              <span className={`text-xl font-bold ${scoreColors[status]}`}>
                {totalScore}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Heart className={`w-4 h-4 ${scoreColors[status]}`} />
                <span className="text-sm font-medium">{t('health_title')}</span>
              </div>
              <p className={`text-sm ${scoreColors[status]}`}>
                {statusEmoji} {statusText[status]}
              </p>
            </div>
          </div>
          <Link to="/health-score">
            <Button variant="ghost" size="icon">
              <ChevronRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

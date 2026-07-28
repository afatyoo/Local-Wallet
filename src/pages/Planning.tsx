import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { planningApi, type PlanningRecord } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
import { ArchiveRestore, Bell, BookOpenCheck, Landmark, Plus, RotateCcw, Trash2 } from 'lucide-react';

interface NetWorthItem extends PlanningRecord {
  type: 'asset' | 'liability';
  name: string;
  category: string;
  value: number | string;
  as_of_date: string;
}

interface Debt extends PlanningRecord {
  direction: 'owed' | 'receivable';
  name: string;
  principal: number | string;
  remaining: number | string;
  interest_rate: number | string;
  due_date?: string;
  status: 'active' | 'paid';
}

interface Rule extends PlanningRecord {
  transaction_type: 'expense' | 'income';
  pattern: string;
  category: string;
  active: boolean | number;
}

interface Notification extends PlanningRecord {
  title: string;
  message: string;
  read_at?: string;
  created_at: string;
}

interface Activity extends PlanningRecord {
  action: string;
  summary: string;
  created_at: string;
}

interface TrashItem extends PlanningRecord {
  table_name: string;
  record_id: string;
  deleted_at: string;
  expires_at: string;
}

const today = new Date().toISOString().slice(0, 10);

export default function PlanningPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [netWorth, setNetWorth] = useState<NetWorthItem[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [trash, setTrash] = useState<TrashItem[]>([]);
  const [preferences, setPreferences] = useState({
    email: '',
    email_enabled: false,
    bill_days: 3,
    budget_threshold: 80,
    debt_days: 7,
  });
  const [worthForm, setWorthForm] = useState({
    type: 'asset',
    name: '',
    category: '',
    value: '',
    as_of_date: today,
    notes: '',
  });
  const [debtForm, setDebtForm] = useState({
    direction: 'owed',
    name: '',
    principal: '',
    interest_rate: '0',
    due_date: '',
    notes: '',
  });
  const [ruleForm, setRuleForm] = useState({
    transaction_type: 'expense',
    pattern: '',
    category: '',
  });
  const [paymentDebt, setPaymentDebt] = useState<Debt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  const load = useCallback(async () => {
    const [worth, debt, rule, notice, history, trashItems, pref] = await Promise.all([
      planningApi.list<NetWorthItem>('net-worth'),
      planningApi.list<Debt>('debts'),
      planningApi.list<Rule>('rules'),
      planningApi.list<Notification>('notifications'),
      planningApi.list<Activity>('activity'),
      planningApi.list<TrashItem>('trash'),
      planningApi.getPreferences(),
    ]);
    setNetWorth(worth.data || []);
    setDebts(debt.data || []);
    setRules(rule.data || []);
    setNotifications(notice.data || []);
    setActivity(history.data || []);
    setTrash(trashItems.data || []);
    if (pref.data) {
      setPreferences({
        email: String(pref.data.email || ''),
        email_enabled: Boolean(pref.data.email_enabled),
        bill_days: Number(pref.data.bill_days || 3),
        budget_threshold: Number(pref.data.budget_threshold || 80),
        debt_days: Number(pref.data.debt_days || 7),
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const assets = netWorth.filter((item) => item.type === 'asset').reduce((sum, item) => sum + Number(item.value), 0);
    const liabilities = netWorth.filter((item) => item.type === 'liability').reduce((sum, item) => sum + Number(item.value), 0);
    return { assets, liabilities, net: assets - liabilities };
  }, [netWorth]);

  const success = async () => {
    await load();
    toast({ title: t('common_success') });
  };

  const addWorth = async () => {
    await planningApi.create('net-worth', { ...worthForm, value: Number(worthForm.value) });
    setWorthForm({ type: 'asset', name: '', category: '', value: '', as_of_date: today, notes: '' });
    await success();
  };

  const addDebt = async () => {
    const principal = Number(debtForm.principal);
    await planningApi.create('debts', {
      ...debtForm,
      principal,
      remaining: principal,
      interest_rate: Number(debtForm.interest_rate || 0),
      due_date: debtForm.due_date || null,
      status: 'active',
    });
    setDebtForm({ direction: 'owed', name: '', principal: '', interest_rate: '0', due_date: '', notes: '' });
    await success();
  };

  const payDebt = async () => {
    if (!paymentDebt || Number(paymentAmount) <= 0) return;
    await planningApi.payDebt(paymentDebt.id, { amount: Number(paymentAmount), paid_at: today });
    setPaymentDebt(null);
    setPaymentAmount('');
    await success();
  };

  const addRule = async () => {
    await planningApi.create('rules', { ...ruleForm, priority: 0, active: true });
    setRuleForm({ transaction_type: 'expense', pattern: '', category: '' });
    await success();
  };

  const savePreferences = async () => {
    const result = await planningApi.savePreferences(preferences);
    if (result.error) {
      toast({ title: t('common_error'), description: result.error, variant: 'destructive' });
      return;
    }
    await success();
  };

  const refreshNotifications = async () => {
    await planningApi.refreshNotifications();
    await success();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Landmark className="w-8 h-8 text-primary" />
            {t('planning_title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('planning_subtitle')}</p>
        </div>

        <Tabs defaultValue="worth">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="worth">{t('planning_net_worth')}</TabsTrigger>
            <TabsTrigger value="debt">{t('planning_debt')}</TabsTrigger>
            <TabsTrigger value="rules">{t('planning_rules')}</TabsTrigger>
            <TabsTrigger value="notifications">{t('planning_notifications')}</TabsTrigger>
            <TabsTrigger value="activity">{t('planning_activity')}</TabsTrigger>
          </TabsList>

          <TabsContent value="worth" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card><CardHeader><CardTitle className="text-sm">{t('planning_assets')}</CardTitle></CardHeader><CardContent className="text-2xl font-mono text-income">{formatCurrency(totals.assets)}</CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">{t('planning_liabilities')}</CardTitle></CardHeader><CardContent className="text-2xl font-mono text-expense">{formatCurrency(totals.liabilities)}</CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">{t('planning_net_worth')}</CardTitle></CardHeader><CardContent className="text-2xl font-mono">{formatCurrency(totals.net)}</CardContent></Card>
            </div>
            <Card>
              <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-6 gap-3">
                <Select value={worthForm.type} onValueChange={(type) => setWorthForm({ ...worthForm, type })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="asset">{t('planning_asset')}</SelectItem><SelectItem value="liability">{t('planning_liability')}</SelectItem></SelectContent></Select>
                <Input placeholder={t('planning_name')} value={worthForm.name} onChange={(event) => setWorthForm({ ...worthForm, name: event.target.value })} />
                <Input placeholder={t('common_category')} value={worthForm.category} onChange={(event) => setWorthForm({ ...worthForm, category: event.target.value })} />
                <Input type="number" placeholder={t('common_amount')} value={worthForm.value} onChange={(event) => setWorthForm({ ...worthForm, value: event.target.value })} />
                <Input type="date" value={worthForm.as_of_date} onChange={(event) => setWorthForm({ ...worthForm, as_of_date: event.target.value })} />
                <Button onClick={addWorth} disabled={!worthForm.name || !worthForm.value}><Plus className="w-4 h-4 mr-2" />{t('common_add')}</Button>
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {netWorth.map((item) => (
                <Card key={item.id}><CardContent className="pt-5 flex items-center justify-between"><div><p className="font-medium">{item.name}</p><p className="text-sm text-muted-foreground">{item.category} · {item.as_of_date}</p></div><div className="flex items-center gap-2"><span className={`font-mono ${item.type === 'asset' ? 'text-income' : 'text-expense'}`}>{formatCurrency(Number(item.value))}</span><Button size="icon" variant="ghost" onClick={async () => { await planningApi.delete('net-worth', item.id); await success(); }}><Trash2 className="w-4 h-4" /></Button></div></CardContent></Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="debt" className="space-y-4">
            <Card><CardContent className="pt-6 grid grid-cols-1 md:grid-cols-6 gap-3">
              <Select value={debtForm.direction} onValueChange={(direction) => setDebtForm({ ...debtForm, direction })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="owed">{t('planning_owed')}</SelectItem><SelectItem value="receivable">{t('planning_receivable')}</SelectItem></SelectContent></Select>
              <Input placeholder={t('planning_name')} value={debtForm.name} onChange={(event) => setDebtForm({ ...debtForm, name: event.target.value })} />
              <Input type="number" placeholder={t('planning_principal')} value={debtForm.principal} onChange={(event) => setDebtForm({ ...debtForm, principal: event.target.value })} />
              <Input type="number" placeholder={t('planning_interest')} value={debtForm.interest_rate} onChange={(event) => setDebtForm({ ...debtForm, interest_rate: event.target.value })} />
              <Input type="date" value={debtForm.due_date} onChange={(event) => setDebtForm({ ...debtForm, due_date: event.target.value })} />
              <Button onClick={addDebt} disabled={!debtForm.name || !debtForm.principal}><Plus className="w-4 h-4 mr-2" />{t('common_add')}</Button>
            </CardContent></Card>
            {debts.map((debt) => <Card key={debt.id}><CardContent className="pt-5 flex items-center justify-between gap-3"><div><p className="font-medium">{debt.name}</p><p className="text-sm text-muted-foreground">{debt.due_date || '-'} · {Number(debt.interest_rate)}%</p></div><div className="text-right"><p className="font-mono">{formatCurrency(Number(debt.remaining))}</p><Button size="sm" variant="outline" onClick={() => { setPaymentDebt(debt); setPaymentAmount(''); }} disabled={debt.status === 'paid'}>{t('planning_pay')}</Button></div></CardContent></Card>)}
          </TabsContent>

          <TabsContent value="rules" className="space-y-4">
            <Card><CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-3">
              <Select value={ruleForm.transaction_type} onValueChange={(transaction_type) => setRuleForm({ ...ruleForm, transaction_type })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="expense">{t('expense_title')}</SelectItem><SelectItem value="income">{t('income_title')}</SelectItem></SelectContent></Select>
              <Input placeholder={t('planning_pattern')} value={ruleForm.pattern} onChange={(event) => setRuleForm({ ...ruleForm, pattern: event.target.value })} />
              <Input placeholder={t('common_category')} value={ruleForm.category} onChange={(event) => setRuleForm({ ...ruleForm, category: event.target.value })} />
              <Button onClick={addRule} disabled={!ruleForm.pattern || !ruleForm.category}><Plus className="w-4 h-4 mr-2" />{t('common_add')}</Button>
            </CardContent></Card>
            {rules.map((rule) => <Card key={rule.id}><CardContent className="pt-5 flex items-center justify-between"><div><p className="font-medium">“{rule.pattern}” → {rule.category}</p><p className="text-sm text-muted-foreground">{rule.transaction_type}</p></div><Button size="icon" variant="ghost" onClick={async () => { await planningApi.delete('rules', rule.id); await success(); }}><Trash2 className="w-4 h-4" /></Button></CardContent></Card>)}
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5" />{t('planning_email_settings')}</CardTitle></CardHeader><CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2 space-y-2"><Label>Email</Label><Input type="email" value={preferences.email} onChange={(event) => setPreferences({ ...preferences, email: event.target.value })} /></div>
                <div className="space-y-2"><Label>{t('planning_budget_threshold')}</Label><Input type="number" value={preferences.budget_threshold} onChange={(event) => setPreferences({ ...preferences, budget_threshold: Number(event.target.value) })} /></div>
                <div className="flex items-center justify-between gap-3"><Label>{t('planning_email_enabled')}</Label><Switch checked={preferences.email_enabled} onCheckedChange={(email_enabled) => setPreferences({ ...preferences, email_enabled })} /></div>
              </div>
              <div className="flex flex-wrap gap-2"><Button onClick={savePreferences}>{t('common_save')}</Button><Button variant="outline" onClick={async () => { const result = await planningApi.sendTestEmail(); toast({ title: result.error ? t('common_error') : t('common_success'), description: result.error }); }}>{t('planning_test_email')}</Button><Button variant="outline" onClick={refreshNotifications}><RotateCcw className="w-4 h-4 mr-2" />{t('planning_refresh')}</Button></div>
            </CardContent></Card>
            {notifications.map((item) => <Card key={item.id} className={item.read_at ? 'opacity-60' : ''}><CardContent className="pt-5"><p className="font-medium">{item.title}</p><p className="text-sm text-muted-foreground">{item.message}</p></CardContent></Card>)}
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card><CardHeader><CardTitle className="flex gap-2"><BookOpenCheck className="w-5 h-5" />{t('planning_activity')}</CardTitle></CardHeader><CardContent className="space-y-3">{activity.map((item) => <div key={item.id} className="border-b pb-2"><p className="font-medium">{item.summary}</p><p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p></div>)}</CardContent></Card>
              <Card><CardHeader><CardTitle className="flex gap-2"><ArchiveRestore className="w-5 h-5" />{t('planning_trash')}</CardTitle></CardHeader><CardContent className="space-y-3">{trash.map((item) => <div key={item.id} className="flex items-center justify-between border-b pb-2"><div><p className="font-medium">{item.table_name}</p><p className="text-xs text-muted-foreground">{new Date(item.deleted_at).toLocaleString()}</p></div><Button size="sm" variant="outline" onClick={async () => { await planningApi.restoreTrash(item.id); await success(); }}><RotateCcw className="w-4 h-4 mr-2" />{t('planning_restore')}</Button></div>)}</CardContent></Card>
            </div>
          </TabsContent>
        </Tabs>
        <Dialog open={Boolean(paymentDebt)} onOpenChange={(open) => { if (!open) setPaymentDebt(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('planning_pay')} {paymentDebt?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label>{t('planning_payment_amount')}</Label>
              <Input
                type="number"
                min="1"
                max={Number(paymentDebt?.remaining || 0)}
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaymentDebt(null)}>{t('common_cancel')}</Button>
              <Button onClick={payDebt} disabled={Number(paymentAmount) <= 0}>{t('planning_pay')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

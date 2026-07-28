import { z } from 'zod';

const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const MAX_ITEMS_PER_COLLECTION = 10_000;

const idSchema = z.string().min(1).max(64);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const textSchema = z.string().max(2_000);
const moneySchema = z.number().finite().nonnegative();
const ownedRecordSchema = {
  id: idSchema,
  userId: idSchema,
};

const incomeSchema = z.object({
  ...ownedRecordSchema,
  tanggal: dateSchema,
  bulan: monthSchema,
  sumber: z.string().min(1).max(100),
  kategori: z.string().min(1).max(100),
  metode: z.string().min(1).max(100),
  jumlah: moneySchema,
  catatan: textSchema,
  savingId: idSchema.optional(),
});

const expenseSchema = z.object({
  ...ownedRecordSchema,
  tanggal: dateSchema,
  bulan: monthSchema,
  nama: z.string().min(1).max(100),
  kategori: z.string().min(1).max(100),
  metode: z.string().min(1).max(100),
  jumlah: moneySchema,
  catatan: textSchema,
  billPaymentId: idSchema.optional(),
  savingId: idSchema.optional(),
});

const budgetSchema = z.object({
  ...ownedRecordSchema,
  bulan: monthSchema,
  kategori: z.string().min(1).max(100),
  anggaran: moneySchema,
  rollover: z.boolean().optional().default(false),
});

const savingSchema = z.object({
  ...ownedRecordSchema,
  tanggal: dateSchema,
  jenis: z.enum(['Tabungan', 'Investasi']),
  namaAkun: z.string().min(1).max(100),
  setoran: moneySchema,
  penarikan: moneySchema,
  catatan: textSchema,
});

const savingsTargetSchema = z.object({
  ...ownedRecordSchema,
  namaTarget: z.string().min(1).max(100),
  targetAmount: z.number().finite().positive(),
  currentAmount: moneySchema.optional(),
  startDate: dateSchema,
  targetDate: dateSchema,
  status: z.enum(['Aktif', 'Tercapai']).optional(),
  linkedAccount: z.string().min(1).max(100),
}).refine((target) => target.targetDate >= target.startDate, {
  message: 'Target date must not be before start date',
});

const masterDataSchema = z.object({
  ...ownedRecordSchema,
  type: z.enum(['kategoriPemasukan', 'kategoriPengeluaran', 'metodePembayaran']),
  value: z.string().min(1).max(100),
});

const billSchema = z.object({
  ...ownedRecordSchema,
  nama: z.string().min(1).max(100),
  kategori: z.string().min(1).max(100),
  jumlah: moneySchema,
  tanggalJatuhTempo: z.number().int().min(1).max(31),
  mulaiDari: monthSchema,
  sampaiDengan: z.string().min(1).max(10),
  catatan: textSchema,
  isActive: z.boolean(),
});

const billPaymentSchema = z.object({
  ...ownedRecordSchema,
  billId: idSchema,
  bulan: monthSchema,
  dibayarPada: z.string().min(1).max(40),
  jumlahDibayar: moneySchema,
});

const netWorthSchema = z.object({
  ...ownedRecordSchema,
  type: z.enum(['asset', 'liability']),
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(100),
  value: moneySchema,
  asOfDate: dateSchema,
  notes: textSchema,
});

const debtSchema = z.object({
  ...ownedRecordSchema,
  direction: z.enum(['owed', 'receivable']),
  name: z.string().min(1).max(100),
  principal: moneySchema,
  remaining: moneySchema,
  interestRate: moneySchema,
  dueDate: dateSchema.optional(),
  status: z.enum(['active', 'paid']),
  notes: textSchema,
});

const debtPaymentSchema = z.object({
  ...ownedRecordSchema,
  debtId: idSchema,
  amount: z.number().finite().positive(),
  paidAt: dateSchema,
  notes: textSchema,
});

const categorizationRuleSchema = z.object({
  ...ownedRecordSchema,
  transactionType: z.enum(['expense', 'income']),
  pattern: z.string().min(1).max(100),
  category: z.string().min(1).max(100),
  priority: z.number().int(),
  active: z.boolean(),
});

const collection = <T extends z.ZodTypeAny>(schema: T) =>
  z.array(schema).max(MAX_ITEMS_PER_COLLECTION);

export const backupSchema = z.object({
  version: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  exportDate: z.string().datetime(),
  incomes: collection(incomeSchema),
  expenses: collection(expenseSchema),
  budgets: collection(budgetSchema),
  savings: collection(savingSchema),
  savingsTargets: collection(savingsTargetSchema).optional().default([]),
  masterData: collection(masterDataSchema),
  bills: collection(billSchema),
  billPayments: collection(billPaymentSchema),
  netWorthItems: collection(netWorthSchema).optional().default([]),
  debts: collection(debtSchema).optional().default([]),
  debtPayments: collection(debtPaymentSchema).optional().default([]),
  categorizationRules: collection(categorizationRuleSchema).optional().default([]),
}).strict().superRefine((backup, context) => {
  const billIds = new Set(backup.bills.map((bill) => bill.id));
  for (const payment of backup.billPayments) {
    if (!billIds.has(payment.billId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['billPayments'],
        message: `Payment ${payment.id} references an unknown bill`,
      });
    }
  }
  const debtIds = new Set(backup.debts.map((debt) => debt.id));
  for (const payment of backup.debtPayments) {
    if (!debtIds.has(payment.debtId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['debtPayments'],
        message: `Debt payment ${payment.id} references an unknown debt`,
      });
    }
  }

  const duplicateCheck = [
    ...backup.incomes,
    ...backup.expenses,
    ...backup.budgets,
    ...backup.savings,
    ...backup.savingsTargets,
    ...backup.masterData,
    ...backup.bills,
    ...backup.billPayments,
    ...backup.netWorthItems,
    ...backup.debts,
    ...backup.debtPayments,
    ...backup.categorizationRules,
  ];
  const ids = new Set<string>();
  for (const item of duplicateCheck) {
    if (ids.has(item.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate record ID: ${item.id}`,
      });
      break;
    }
    ids.add(item.id);
  }
});

export type BackupData = z.infer<typeof backupSchema>;

export function parseBackupData(jsonData: string): BackupData {
  if (new Blob([jsonData]).size > MAX_BACKUP_BYTES) {
    throw new Error('Backup file exceeds the 5 MB limit');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonData);
  } catch {
    throw new Error('Backup file is not valid JSON');
  }

  const result = backupSchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`Invalid backup at ${issue.path.join('.') || 'root'}: ${issue.message}`);
  }
  return result.data;
}

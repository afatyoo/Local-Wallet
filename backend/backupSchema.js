import { z } from 'zod';

const MAX_ITEMS_PER_COLLECTION = 10_000;
const id = z.string().min(1).max(64);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const text = z.string().max(2_000);
const money = z.number().finite().nonnegative();
const owned = { id, userId: id };
const collection = (schema) => z.array(schema).max(MAX_ITEMS_PER_COLLECTION);

export const backupSchema = z.object({
  version: z.union([z.literal(2), z.literal(3)]),
  exportDate: z.string().datetime(),
  incomes: collection(z.object({
    ...owned,
    tanggal: date,
    bulan: month,
    sumber: z.string().min(1).max(100),
    kategori: z.string().min(1).max(100),
    metode: z.string().min(1).max(100),
    jumlah: money,
    catatan: text,
    savingId: id.optional(),
  })),
  expenses: collection(z.object({
    ...owned,
    tanggal: date,
    bulan: month,
    nama: z.string().min(1).max(100),
    kategori: z.string().min(1).max(100),
    metode: z.string().min(1).max(100),
    jumlah: money,
    catatan: text,
    billPaymentId: id.optional(),
    savingId: id.optional(),
  })),
  budgets: collection(z.object({
    ...owned,
    bulan: month,
    kategori: z.string().min(1).max(100),
    anggaran: money,
  })),
  savings: collection(z.object({
    ...owned,
    tanggal: date,
    jenis: z.enum(['Tabungan', 'Investasi']),
    namaAkun: z.string().min(1).max(100),
    setoran: money,
    penarikan: money,
    catatan: text,
  })),
  savingsTargets: collection(z.object({
    ...owned,
    namaTarget: z.string().min(1).max(100),
    targetAmount: z.number().finite().positive(),
    currentAmount: money.optional(),
    startDate: date,
    targetDate: date,
    status: z.enum(['Aktif', 'Tercapai']).optional(),
    linkedAccount: z.string().min(1).max(100),
  }).refine((target) => target.targetDate >= target.startDate, {
    message: 'Target date must not be before start date',
  })).optional().default([]),
  masterData: collection(z.object({
    ...owned,
    type: z.enum(['kategoriPemasukan', 'kategoriPengeluaran', 'metodePembayaran']),
    value: z.string().min(1).max(100),
  })),
  bills: collection(z.object({
    ...owned,
    nama: z.string().min(1).max(100),
    kategori: z.string().min(1).max(100),
    jumlah: money,
    tanggalJatuhTempo: z.number().int().min(1).max(31),
    mulaiDari: month,
    sampaiDengan: z.string().min(1).max(10),
    catatan: text,
    isActive: z.boolean(),
  })),
  billPayments: collection(z.object({
    ...owned,
    billId: id,
    bulan: month,
    dibayarPada: z.string().min(1).max(40),
    jumlahDibayar: money,
  })),
}).strict().superRefine((backup, context) => {
  const ids = new Set();
  const allItems = [
    ...backup.incomes,
    ...backup.expenses,
    ...backup.budgets,
    ...backup.savings,
    ...backup.savingsTargets,
    ...backup.masterData,
    ...backup.bills,
    ...backup.billPayments,
  ];
  for (const item of allItems) {
    if (ids.has(item.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate record ID: ${item.id}`,
      });
      break;
    }
    ids.add(item.id);
  }

  const billIds = new Set(backup.bills.map((item) => item.id));
  const paymentIds = new Set(backup.billPayments.map((item) => item.id));
  const savingIds = new Set(backup.savings.map((item) => item.id));
  backup.billPayments.forEach((item, index) => {
    if (!billIds.has(item.billId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['billPayments', index, 'billId'],
        message: 'Unknown bill reference',
      });
    }
  });
  [...backup.incomes, ...backup.expenses].forEach((item) => {
    if (item.savingId && !savingIds.has(item.savingId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown saving reference: ${item.savingId}`,
      });
    }
  });
  backup.expenses.forEach((item, index) => {
    if (item.billPaymentId && !paymentIds.has(item.billPaymentId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expenses', index, 'billPaymentId'],
        message: 'Unknown bill payment reference',
      });
    }
  });
});

export function parseBackup(value) {
  const result = backupSchema.safeParse(value);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const error = new Error(`Invalid backup at ${issue.path.join('.') || 'root'}: ${issue.message}`);
  error.statusCode = 400;
  throw error;
}

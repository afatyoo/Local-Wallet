import { create } from 'zustand';
import { getMonthFromDate, getCurrentMonth } from '@/lib/utils';
import {
  incomesApi,
  expensesApi,
  budgetsApi,
  savingsApi,
  masterDataApi,
  billsApi,
  billPaymentsApi,
  convertToFrontend,
  type ApiIncome,
  type ApiExpense,
  type ApiBudget,
  type ApiSaving,
  type ApiMasterData,
  type ApiBill,
  type ApiBillPayment,
} from '@/lib/api';

// Frontend interfaces (camelCase)
export interface Income {
  id: string;
  userId: string;
  tanggal: string;
  bulan: string;
  sumber: string;
  kategori: string;
  metode: string;
  jumlah: number;
  catatan: string;
  savingId?: string;
}

export interface Expense {
  id: string;
  userId: string;
  tanggal: string;
  bulan: string;
  nama: string;
  kategori: string;
  metode: string;
  jumlah: number;
  catatan: string;
  billPaymentId?: string;
  savingId?: string;
}

export interface Budget {
  id: string;
  userId: string;
  bulan: string;
  kategori: string;
  anggaran: number;
}

export interface Saving {
  id: string;
  userId: string;
  tanggal: string;
  jenis: 'Tabungan' | 'Investasi';
  namaAkun: string;
  setoran: number;
  penarikan: number;
  catatan: string;
}

export interface MasterData {
  id: string;
  userId: string;
  type: 'kategoriPemasukan' | 'kategoriPengeluaran' | 'metodePembayaran';
  value: string;
}

export interface Bill {
  id: string;
  userId: string;
  nama: string;
  kategori: string;
  jumlah: number;
  tanggalJatuhTempo: number;
  mulaiDari: string;
  sampaiDengan: string;
  catatan: string;
  isActive: boolean;
}

export interface BillPayment {
  id: string;
  billId: string;
  userId: string;
  bulan: string;
  dibayarPada: string;
  jumlahDibayar: number;
}

interface FinanceState {
  incomes: Income[];
  expenses: Expense[];
  budgets: Budget[];
  savings: Saving[];
  masterData: MasterData[];
  bills: Bill[];
  billPayments: BillPayment[];
  selectedMonth: string;
  isLoading: boolean;
  error: string | null;

  setSelectedMonth: (month: string) => void;
  clearError: () => void;
  loadAllData: (userId: string) => Promise<void>;
  
  addIncome: (userId: string, data: Omit<Income, 'id' | 'userId' | 'bulan'>) => Promise<void>;
  updateIncome: (id: string, data: Partial<Income>) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;
  
  addExpense: (userId: string, data: Omit<Expense, 'id' | 'userId' | 'bulan'>) => Promise<void>;
  updateExpense: (id: string, data: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  
  addBudget: (userId: string, data: Omit<Budget, 'id' | 'userId'>) => Promise<void>;
  updateBudget: (id: string, data: Partial<Budget>) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  
  addSaving: (userId: string, data: Omit<Saving, 'id' | 'userId'>) => Promise<void>;
  updateSaving: (id: string, data: Partial<Saving>) => Promise<void>;
  deleteSaving: (id: string) => Promise<void>;
  
  addMasterData: (userId: string, type: MasterData['type'], value: string) => Promise<void>;
  deleteMasterData: (id: string) => Promise<void>;
  
  addBill: (userId: string, data: Omit<Bill, 'id' | 'userId'>) => Promise<void>;
  updateBill: (id: string, data: Partial<Bill>) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;
  
  addBillPayment: (userId: string, data: Omit<BillPayment, 'id' | 'userId'>) => Promise<void>;
  deleteBillPayment: (id: string) => Promise<void>;
  
  exportData: (userId: string) => Promise<string>;
  importData: (userId: string, jsonData: string) => Promise<boolean>;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  incomes: [],
  expenses: [],
  budgets: [],
  savings: [],
  masterData: [],
  bills: [],
  billPayments: [],
  selectedMonth: getCurrentMonth(),
  isLoading: false,
  error: null,

  setSelectedMonth: (month) => set({ selectedMonth: month }),
  clearError: () => set({ error: null }),

  loadAllData: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const [incomesRes, expensesRes, budgetsRes, savingsRes, masterDataRes, billsRes, billPaymentsRes] = 
        await Promise.all([
          incomesApi.getAll(userId),
          expensesApi.getAll(userId),
          budgetsApi.getAll(userId),
          savingsApi.getAll(userId),
          masterDataApi.getAll(userId),
          billsApi.getAll(userId),
          billPaymentsApi.getAll(userId),
        ]);

      // Check for errors in any of the responses
      const errors = [
        incomesRes.error,
        expensesRes.error,
        budgetsRes.error,
        savingsRes.error,
        masterDataRes.error,
        billsRes.error,
        billPaymentsRes.error,
      ].filter(Boolean);

      if (errors.length > 0) {
        set({ 
          isLoading: false, 
          error: errors[0] || 'Gagal memuat data dari server' 
        });
        return;
      }

      set({
        incomes: (incomesRes.data || []).map(convertToFrontend.income),
        expenses: (expensesRes.data || []).map(convertToFrontend.expense),
        budgets: (budgetsRes.data || []).map(convertToFrontend.budget),
        savings: (savingsRes.data || []).map(convertToFrontend.saving),
        masterData: (masterDataRes.data || []).map(convertToFrontend.masterData),
        bills: (billsRes.data || []).map(convertToFrontend.bill),
        billPayments: (billPaymentsRes.data || []).map(convertToFrontend.billPayment),
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Error loading data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Terjadi error tidak dikenal';
      set({ isLoading: false, error: errorMessage });
    }
  },

  // Income CRUD
  addIncome: async (userId, data) => {
    const bulan = getMonthFromDate(data.tanggal);
    const apiData: Omit<ApiIncome, 'id'> = {
      user_id: userId,
      tanggal: data.tanggal,
      bulan,
      sumber: data.sumber,
      kategori: data.kategori,
      metode: data.metode,
      jumlah: data.jumlah,
      catatan: data.catatan,
    };
    const { data: result } = await incomesApi.create(apiData);
    if (result) {
      set((state) => ({ incomes: [...state.incomes, convertToFrontend.income(result)] }));
    }
  },

  updateIncome: async (id, data) => {
    const updateData: Partial<ApiIncome> = {};
    if (data.tanggal !== undefined) {
      updateData.tanggal = data.tanggal;
      updateData.bulan = getMonthFromDate(data.tanggal);
    }
    if (data.sumber !== undefined) updateData.sumber = data.sumber;
    if (data.kategori !== undefined) updateData.kategori = data.kategori;
    if (data.metode !== undefined) updateData.metode = data.metode;
    if (data.jumlah !== undefined) updateData.jumlah = data.jumlah;
    if (data.catatan !== undefined) updateData.catatan = data.catatan;

    const { data: result } = await incomesApi.update(id, updateData);
    if (result) {
      set((state) => ({
        incomes: state.incomes.map((i) => (i.id === id ? convertToFrontend.income(result) : i)),
      }));
    }
  },

  deleteIncome: async (id) => {
    await incomesApi.delete(id);
    set((state) => ({ incomes: state.incomes.filter((i) => i.id !== id) }));
  },

  // Expense CRUD
  addExpense: async (userId, data) => {
    const bulan = getMonthFromDate(data.tanggal);
    const apiData: Omit<ApiExpense, 'id'> = {
      user_id: userId,
      tanggal: data.tanggal,
      bulan,
      nama: data.nama,
      kategori: data.kategori,
      metode: data.metode,
      jumlah: data.jumlah,
      catatan: data.catatan,
    };
    const { data: result } = await expensesApi.create(apiData);
    if (result) {
      set((state) => ({ expenses: [...state.expenses, convertToFrontend.expense(result)] }));
    }
  },

  updateExpense: async (id, data) => {
    const updateData: Partial<ApiExpense> = {};
    if (data.tanggal !== undefined) {
      updateData.tanggal = data.tanggal;
      updateData.bulan = getMonthFromDate(data.tanggal);
    }
    if (data.nama !== undefined) updateData.nama = data.nama;
    if (data.kategori !== undefined) updateData.kategori = data.kategori;
    if (data.metode !== undefined) updateData.metode = data.metode;
    if (data.jumlah !== undefined) updateData.jumlah = data.jumlah;
    if (data.catatan !== undefined) updateData.catatan = data.catatan;

    const { data: result } = await expensesApi.update(id, updateData);
    if (result) {
      set((state) => ({
        expenses: state.expenses.map((e) => (e.id === id ? convertToFrontend.expense(result) : e)),
      }));
    }
  },

  deleteExpense: async (id) => {
    await expensesApi.delete(id);
    set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) }));
  },

  // Budget CRUD
  addBudget: async (userId, data) => {
    const apiData: Omit<ApiBudget, 'id'> = {
      user_id: userId,
      bulan: data.bulan,
      kategori: data.kategori,
      anggaran: data.anggaran,
    };
    const { data: result } = await budgetsApi.create(apiData);
    if (result) {
      set((state) => ({ budgets: [...state.budgets, convertToFrontend.budget(result)] }));
    }
  },

  updateBudget: async (id, data) => {
    const updateData: Partial<ApiBudget> = {};
    if (data.bulan !== undefined) updateData.bulan = data.bulan;
    if (data.kategori !== undefined) updateData.kategori = data.kategori;
    if (data.anggaran !== undefined) updateData.anggaran = data.anggaran;

    const { data: result } = await budgetsApi.update(id, updateData);
    if (result) {
      set((state) => ({
        budgets: state.budgets.map((b) => (b.id === id ? convertToFrontend.budget(result) : b)),
      }));
    }
  },

  deleteBudget: async (id) => {
    await budgetsApi.delete(id);
    set((state) => ({ budgets: state.budgets.filter((b) => b.id !== id) }));
  },

  addSaving: async (userId, data) => {
    const apiData: Omit<ApiSaving, 'id'> = {
      user_id: userId,
      tanggal: data.tanggal,
      jenis: data.jenis,
      nama_akun: data.namaAkun,
      setoran: data.setoran,
      penarikan: data.penarikan,
      catatan: data.catatan,
    };

    const savingRes = await savingsApi.create(apiData);
    if (!savingRes.data) return;

    const saving = convertToFrontend.saving(savingRes.data);

    set((state) => ({ savings: [...state.savings, saving] }));

    const bulan = getMonthFromDate(data.tanggal);

    // 🔻 SETORAN → EXPENSE (POTONG BALANCE)
    if (data.setoran > 0) {
      const expenseRes = await expensesApi.create({
        user_id: userId,
        tanggal: data.tanggal,
        bulan,
        nama: `Setoran ${data.jenis} - ${data.namaAkun}`,
        kategori: data.jenis,
        metode: 'Transfer',
        jumlah: data.setoran,
        catatan: data.catatan,
        saving_id: saving.id, // 🔗 LINK
      });

      if (expenseRes.data) {
        set((state) => ({
          expenses: [...state.expenses, convertToFrontend.expense(expenseRes.data!)],
        }));
      }
    }

    // 🔺 PENARIKAN → INCOME (NABAH BALANCE)
    if (data.penarikan > 0) {
      const incomeRes = await incomesApi.create({
        user_id: userId,
        tanggal: data.tanggal,
        bulan,
        sumber: `Penarikan ${data.jenis} - ${data.namaAkun}`,
        kategori: data.jenis,
        metode: 'Transfer',
        jumlah: data.penarikan,
        catatan: data.catatan,
        saving_id: saving.id, // 🔗 LINK
      });

      if (incomeRes.data) {
        set((state) => ({
          incomes: [...state.incomes, convertToFrontend.income(incomeRes.data!)],
        }));
      }
    }
  },


  updateSaving: async (id, data) => {
    const old = get().savings.find((s) => s.id === id);
    if (!old) return;

    // If no fields are provided, do nothing (avoid deleting linked transactions by accident)
    const hasAnyField =
      data.tanggal !== undefined ||
      data.jenis !== undefined ||
      data.namaAkun !== undefined ||
      data.setoran !== undefined ||
      data.penarikan !== undefined ||
      data.catatan !== undefined;

    if (!hasAnyField) return;

    // 🔥 HAPUS SEMUA TRANSAKSI TERKAIT (bukan cuma 1 item)
    const linkedExpenses = get().expenses.filter((e) => e.savingId === id);
    const linkedIncomes = get().incomes.filter((i) => i.savingId === id);

    await Promise.all(linkedExpenses.map((e) => expensesApi.delete(e.id)));
    await Promise.all(linkedIncomes.map((i) => incomesApi.delete(i.id)));

    set((state) => ({
      expenses: state.expenses.filter((e) => e.savingId !== id),
      incomes: state.incomes.filter((i) => i.savingId !== id),
    }));

    // 🔄 UPDATE SAVING (hanya field yang dikirim)
    const updateData: Partial<ApiSaving> = {};
    if (data.tanggal !== undefined) updateData.tanggal = data.tanggal;
    if (data.jenis !== undefined) updateData.jenis = data.jenis;
    if (data.namaAkun !== undefined) updateData.nama_akun = data.namaAkun;
    if (data.setoran !== undefined) updateData.setoran = data.setoran;
    if (data.penarikan !== undefined) updateData.penarikan = data.penarikan;
    if (data.catatan !== undefined) updateData.catatan = data.catatan;

    const res = await savingsApi.update(id, updateData);
    if (!res.data) return;

    const updatedSaving = convertToFrontend.saving(res.data);

    set((state) => ({
      savings: state.savings.map((s) => (s.id === id ? updatedSaving : s)),
    }));

    // ✅ RE-CREATE transaksi linked TANPA bikin saving baru
    const bulan = getMonthFromDate(updatedSaving.tanggal);
    const userId = updatedSaving.userId;

    // 🔻 SETORAN → EXPENSE (POTONG BALANCE)
    if (updatedSaving.setoran > 0) {
      const expenseRes = await expensesApi.create({
        user_id: userId,
        tanggal: updatedSaving.tanggal,
        bulan,
        nama: `Setoran ${updatedSaving.jenis} - ${updatedSaving.namaAkun}`,
        kategori: updatedSaving.jenis,
        metode: 'Transfer',
        jumlah: updatedSaving.setoran,
        catatan: updatedSaving.catatan,
        saving_id: updatedSaving.id, // 🔗 LINK ke saving yang sama
      });

      if (expenseRes.data) {
        set((state) => ({
          expenses: [...state.expenses, convertToFrontend.expense(expenseRes.data!)],
        }));
      }
    }

    // 🔺 PENARIKAN → INCOME (NABAH BALANCE)
    if (updatedSaving.penarikan > 0) {
      const incomeRes = await incomesApi.create({
        user_id: userId,
        tanggal: updatedSaving.tanggal,
        bulan,
        sumber: `Penarikan ${updatedSaving.jenis} - ${updatedSaving.namaAkun}`,
        kategori: updatedSaving.jenis,
        metode: 'Transfer',
        jumlah: updatedSaving.penarikan,
        catatan: updatedSaving.catatan,
        saving_id: updatedSaving.id, // 🔗 LINK ke saving yang sama
      });

      if (incomeRes.data) {
        set((state) => ({
          incomes: [...state.incomes, convertToFrontend.income(incomeRes.data!)],
        }));
      }
    }
  },


  deleteSaving: async (id) => {
    // Hapus semua transaksi yang ter-link ke saving ini (biar nggak nyisa kalau pernah duplicate)
    const linkedExpenses = get().expenses.filter((e) => e.savingId === id);
    const linkedIncomes = get().incomes.filter((i) => i.savingId === id);

    await Promise.all(linkedExpenses.map((e) => expensesApi.delete(e.id)));
    await Promise.all(linkedIncomes.map((i) => incomesApi.delete(i.id)));

    await savingsApi.delete(id);

    set((state) => ({
      savings: state.savings.filter((s) => s.id !== id),
      expenses: state.expenses.filter((e) => e.savingId !== id),
      incomes: state.incomes.filter((i) => i.savingId !== id),
    }));
  },


  // Master Data
  addMasterData: async (userId, type, value) => {
    const apiData: Omit<ApiMasterData, 'id'> = {
      user_id: userId,
      type,
      value,
    };
    const { data: result } = await masterDataApi.create(apiData);
    if (result) {
      set((state) => ({ masterData: [...state.masterData, convertToFrontend.masterData(result)] }));
    }
  },

  deleteMasterData: async (id) => {
    await masterDataApi.delete(id);
    set((state) => ({ masterData: state.masterData.filter((m) => m.id !== id) }));
  },

  // Bills CRUD
  addBill: async (userId, data) => {
    const apiData: Omit<ApiBill, 'id'> = {
      user_id: userId,
      nama: data.nama,
      kategori: data.kategori,
      jumlah: data.jumlah,
      tanggal_jatuh_tempo: data.tanggalJatuhTempo,
      mulai_dari: data.mulaiDari,
      sampai_dengan: data.sampaiDengan,
      catatan: data.catatan,
      is_active: data.isActive,
    };
    const { data: result } = await billsApi.create(apiData);
    if (result) {
      set((state) => ({ bills: [...state.bills, convertToFrontend.bill(result)] }));
    }
  },

  updateBill: async (id, data) => {
    const updateData: Partial<ApiBill> = {};
    if (data.nama !== undefined) updateData.nama = data.nama;
    if (data.kategori !== undefined) updateData.kategori = data.kategori;
    if (data.jumlah !== undefined) updateData.jumlah = data.jumlah;
    if (data.tanggalJatuhTempo !== undefined) updateData.tanggal_jatuh_tempo = data.tanggalJatuhTempo;
    if (data.mulaiDari !== undefined) updateData.mulai_dari = data.mulaiDari;
    if (data.sampaiDengan !== undefined) updateData.sampai_dengan = data.sampaiDengan;
    if (data.catatan !== undefined) updateData.catatan = data.catatan;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    const { data: result } = await billsApi.update(id, updateData);
    if (result) {
      set((state) => ({
        bills: state.bills.map((b) => (b.id === id ? convertToFrontend.bill(result) : b)),
      }));
    }
  },

  deleteBill: async (id) => {
    await billsApi.delete(id);
    // Related payments are deleted by CASCADE in database
    set((state) => ({ 
      bills: state.bills.filter((b) => b.id !== id),
      billPayments: state.billPayments.filter((p) => p.billId !== id),
    }));
  },

  // Bill Payments - also creates expense for balance tracking
// Bill Payments - also creates expense for balance tracking
  addBillPayment: async (userId, data) => {
    const apiPaymentData: Omit<ApiBillPayment, 'id'> = {
      bill_id: data.billId,
      user_id: userId,
      bulan: data.bulan,
      dibayar_pada: data.dibayarPada,
      jumlah_dibayar: data.jumlahDibayar,
    };
  
    const paymentRes = await billPaymentsApi.create(apiPaymentData);
    if (paymentRes.error || !paymentRes.data) {
      throw new Error(paymentRes.error || 'Gagal membuat pembayaran tagihan');
    }
  
    const payment = convertToFrontend.billPayment(paymentRes.data);
  
    // Find the bill to get its details for expense
    const bill = get().bills.find((b) => b.id === data.billId);
  
    // Paid status must be saved even if expense creation fails
    set((state) => ({ billPayments: [...state.billPayments, payment] }));
  
    // If bill not found, stop here
    if (!bill) return;
  
    // Best-effort: create expense entry for this bill payment (so balance decreases)
    try {
      // IMPORTANT:
      // - expenses.tanggal is VARCHAR(10) => must be YYYY-MM-DD
      // - use data.bulan (selectedMonth) so it affects the correct month balance
      const tanggal = (data.dibayarPada || '').slice(0, 10); // works for ISO or "YYYY-MM-DD HH:MM:SS"
    
      const apiExpenseData: Omit<ApiExpense, 'id'> = {
        user_id: userId,
        tanggal,
        bulan: data.bulan, // <-- this is key, so the selectedMonth balance decreases
        nama: `Tagihan: ${bill.nama}`,
        kategori: bill.kategori,
        metode: 'Transfer', // match default master data
        jumlah: data.jumlahDibayar,
        catatan: `Pembayaran tagihan ${bill.nama}`,
        bill_payment_id: payment.id,
      };
    
      const expenseRes = await expensesApi.create(apiExpenseData);
      if (expenseRes.data) {
        set((state) => ({
          expenses: [...state.expenses, convertToFrontend.expense(expenseRes.data!)],
        }));
      } else if (expenseRes.error) {
        console.warn('Failed to create linked expense for bill payment:', expenseRes.error);
      }
    } catch (e) {
      console.warn('Failed to create linked expense for bill payment:', e);
    }
  },


  deleteBillPayment: async (id) => {
    // Find and delete the linked expense first (best-effort)
    const linkedExpense = get().expenses.find((e) => e.billPaymentId === id);
    if (linkedExpense) {
      const delExpenseRes = await expensesApi.delete(linkedExpense.id);
      if (delExpenseRes.error) {
        console.warn('Failed to delete linked expense for bill payment:', delExpenseRes.error);
      }
    }

    const delPaymentRes = await billPaymentsApi.delete(id);
    if (delPaymentRes.error) {
      throw new Error(delPaymentRes.error || 'Gagal menghapus pembayaran tagihan');
    }

    set((state) => ({
      billPayments: state.billPayments.filter((p) => p.id !== id),
      expenses: linkedExpense ? state.expenses.filter((e) => e.id !== linkedExpense.id) : state.expenses,
    }));
  },

  // Export/Import
  exportData: async (userId) => {
    const { incomes, expenses, budgets, savings, masterData, bills, billPayments } = get();
    const exportObj = {
      version: 2,
      exportDate: new Date().toISOString(),
      incomes: incomes.filter((i) => i.userId === userId),
      expenses: expenses.filter((e) => e.userId === userId),
      budgets: budgets.filter((b) => b.userId === userId),
      savings: savings.filter((s) => s.userId === userId),
      masterData: masterData.filter((m) => m.userId === userId),
      bills: bills.filter((b) => b.userId === userId),
      billPayments: billPayments.filter((p) => p.userId === userId),
    };
    return JSON.stringify(exportObj, null, 2);
  },

  importData: async (userId, jsonData) => {
    try {
      const data = JSON.parse(jsonData);
      
      // Delete existing data
      const { incomes, expenses, budgets, savings, masterData, bills, billPayments } = get();
      
      await Promise.all([
        ...incomes.filter(i => i.userId === userId).map(i => incomesApi.delete(i.id)),
        ...expenses.filter(e => e.userId === userId).map(e => expensesApi.delete(e.id)),
        ...budgets.filter(b => b.userId === userId).map(b => budgetsApi.delete(b.id)),
        ...savings.filter(s => s.userId === userId).map(s => savingsApi.delete(s.id)),
        ...masterData.filter(m => m.userId === userId).map(m => masterDataApi.delete(m.id)),
        ...bills.filter(b => b.userId === userId).map(b => billsApi.delete(b.id)),
      ]);

      // Import new data
      const billIdMap = new Map<string, string>();

      // Import incomes
      for (const item of data.incomes || []) {
        await incomesApi.create({
          user_id: userId,
          tanggal: item.tanggal,
          bulan: item.bulan,
          sumber: item.sumber,
          kategori: item.kategori,
          metode: item.metode,
          jumlah: item.jumlah,
          catatan: item.catatan,
        });
      }

      // Import expenses (excluding bill-linked ones)
      for (const item of data.expenses || []) {
        if (!item.billPaymentId) {
          await expensesApi.create({
            user_id: userId,
            tanggal: item.tanggal,
            bulan: item.bulan,
            nama: item.nama,
            kategori: item.kategori,
            metode: item.metode,
            jumlah: item.jumlah,
            catatan: item.catatan,
          });
        }
      }

      // Import budgets
      for (const item of data.budgets || []) {
        await budgetsApi.create({
          user_id: userId,
          bulan: item.bulan,
          kategori: item.kategori,
          anggaran: item.anggaran,
        });
      }

      // Import savings
      for (const item of data.savings || []) {
        await savingsApi.create({
          user_id: userId,
          tanggal: item.tanggal,
          jenis: item.jenis,
          nama_akun: item.namaAkun,
          setoran: item.setoran,
          penarikan: item.penarikan,
          catatan: item.catatan,
        });
      }

      // Import master data
      for (const item of data.masterData || []) {
        await masterDataApi.create({
          user_id: userId,
          type: item.type,
          value: item.value,
        });
      }

      // Import bills and create ID mapping
      for (const item of data.bills || []) {
        const { data: result } = await billsApi.create({
          user_id: userId,
          nama: item.nama,
          kategori: item.kategori,
          jumlah: item.jumlah,
          tanggal_jatuh_tempo: item.tanggalJatuhTempo,
          mulai_dari: item.mulaiDari,
          sampai_dengan: item.sampaiDengan,
          catatan: item.catatan,
          is_active: item.isActive,
        });
        if (result) {
          billIdMap.set(item.id, result.id!);
        }
      }

      // Import bill payments with expense creation
      for (const item of data.billPayments || []) {
        const newBillId = billIdMap.get(item.billId);
        if (newBillId) {
          const { data: paymentResult } = await billPaymentsApi.create({
            bill_id: newBillId,
            user_id: userId,
            bulan: item.bulan,
            dibayar_pada: item.dibayarPada,
            jumlah_dibayar: item.jumlahDibayar,
          });
          
          // Find corresponding expense from export and recreate it
          if (paymentResult) {
            const linkedExpense = (data.expenses || []).find(
              (e: Expense) => e.billPaymentId === item.id
            );
            if (linkedExpense) {
              await expensesApi.create({
                user_id: userId,
                tanggal: linkedExpense.tanggal,
                bulan: linkedExpense.bulan,
                nama: linkedExpense.nama,
                kategori: linkedExpense.kategori,
                metode: linkedExpense.metode,
                jumlah: linkedExpense.jumlah,
                catatan: linkedExpense.catatan,
                bill_payment_id: paymentResult.id,
              });
            }
          }
        }
      }

      // Reload all data
      await get().loadAllData(userId);
      return true;
    } catch (error) {
      console.error('Import error:', error);
      return false;
    }
  },
}));

// API client for MySQL backend
// Configure this to point to your backend server.
//
// Why this exists:
// - When you open the app from another device (or from an online preview),
//   `http://localhost:3001` points to *that device*, not your server.
// - In production, the safest default is **same-origin**: `${window.location.origin}/api`.
// - In local development, default to `http://localhost:3001/api`.

function normalizeBaseUrl(base: string): string {
  // Remove trailing slashes so `${base}${endpoint}` behaves predictably
  return base.replace(/\/+$/, '');
}

function resolveApiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (fromEnv) return normalizeBaseUrl(fromEnv);

  // Vite exposes DEV/PROD flags
  if (import.meta.env.DEV) {
    return 'http://localhost:3001/api';
  }

  // Production default: same-origin
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api`;
  }

  // Last resort
  return '/api';
}

const API_BASE_URL = resolveApiBaseUrl();

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { error: errorData.error || `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    console.error('API request failed:', error);

    // Common in Lovable preview: browser can’t reach your local machine’s localhost.
    return {
      error:
        `Gagal terhubung ke server (${API_BASE_URL}). ` +
        `Kalau kamu buka lewat preview online, alamat localhost tidak bisa diakses. ` +
        `Jalankan app secara lokal, atau ubah VITE_API_URL ke URL backend yang bisa diakses publik.`,
    };
  }
}

// Auth API
export const authApi = {
  login: (username: string, password: string) =>
    apiRequest<{ id: string; username: string; createdAt: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  register: (username: string, password: string) =>
    apiRequest<{ id: string; username: string; createdAt: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
};

// Generic CRUD API factory
function createCrudApi<T extends { id?: string }>(tableName: string) {
  return {
    getAll: (userId: string) => apiRequest<T[]>(`/${tableName}/${userId}`),

    create: (data: Omit<T, 'id'>) =>
      apiRequest<T>(`/${tableName}`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<T>) =>
      apiRequest<T>(`/${tableName}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      apiRequest<{ success: boolean }>(`/${tableName}/${id}`, {
        method: 'DELETE',
      }),
  };
}

// Data types matching backend snake_case
export interface ApiIncome {
  id?: string;
  user_id: string;
  tanggal: string;
  bulan: string;
  sumber: string;
  kategori: string;
  metode: string;
  jumlah: number;
  catatan: string;
}

export interface ApiExpense {
  id?: string;
  user_id: string;
  tanggal: string;
  bulan: string;
  nama: string;
  kategori: string;
  metode: string;
  jumlah: number;
  catatan: string;
  bill_payment_id?: string;
}

export interface ApiBudget {
  id?: string;
  user_id: string;
  bulan: string;
  kategori: string;
  anggaran: number;
}

export interface ApiSaving {
  id?: string;
  user_id: string;
  tanggal: string;
  jenis: 'Tabungan' | 'Investasi';
  nama_akun: string;
  setoran: number;
  penarikan: number;
  catatan: string;
}

export interface ApiMasterData {
  id?: string;
  user_id: string;
  type: 'kategoriPemasukan' | 'kategoriPengeluaran' | 'metodePembayaran';
  value: string;
}

export interface ApiBill {
  id?: string;
  user_id: string;
  nama: string;
  kategori: string;
  jumlah: number;
  tanggal_jatuh_tempo: number;
  mulai_dari: string;
  sampai_dengan: string;
  catatan: string;
  is_active: boolean;
}

export interface ApiBillPayment {
  id?: string;
  bill_id: string;
  user_id: string;
  bulan: string;
  dibayar_pada: string;
  jumlah_dibayar: number;
}

// API instances for each table
export const incomesApi = createCrudApi<ApiIncome>('incomes');
export const expensesApi = createCrudApi<ApiExpense>('expenses');
export const budgetsApi = createCrudApi<ApiBudget>('budgets');
export const savingsApi = createCrudApi<ApiSaving>('savings');
export const masterDataApi = createCrudApi<ApiMasterData>('master_data');
export const billsApi = createCrudApi<ApiBill>('bills');
export const billPaymentsApi = createCrudApi<ApiBillPayment>('bill_payments');

// Helper to convert between frontend camelCase and backend snake_case
export const convertToFrontend = {
  income: (api: ApiIncome) => ({
    id: api.id!,
    userId: api.user_id,
    tanggal: api.tanggal,
    bulan: api.bulan,
    sumber: api.sumber,
    kategori: api.kategori,
    metode: api.metode,
    jumlah: Number(api.jumlah),
    catatan: api.catatan,
  }),

  expense: (api: ApiExpense) => ({
    id: api.id!,
    userId: api.user_id,
    tanggal: api.tanggal,
    bulan: api.bulan,
    nama: api.nama,
    kategori: api.kategori,
    metode: api.metode,
    jumlah: Number(api.jumlah),
    catatan: api.catatan,
    billPaymentId: api.bill_payment_id,
  }),

  budget: (api: ApiBudget) => ({
    id: api.id!,
    userId: api.user_id,
    bulan: api.bulan,
    kategori: api.kategori,
    anggaran: Number(api.anggaran),
  }),

  saving: (api: ApiSaving) => ({
    id: api.id!,
    userId: api.user_id,
    tanggal: api.tanggal,
    jenis: api.jenis,
    namaAkun: api.nama_akun,
    setoran: Number(api.setoran),
    penarikan: Number(api.penarikan),
    catatan: api.catatan,
  }),

  masterData: (api: ApiMasterData) => ({
    id: api.id!,
    userId: api.user_id,
    type: api.type,
    value: api.value,
  }),

  bill: (api: ApiBill) => ({
    id: api.id!,
    userId: api.user_id,
    nama: api.nama,
    kategori: api.kategori,
    jumlah: Number(api.jumlah),
    tanggalJatuhTempo: api.tanggal_jatuh_tempo,
    mulaiDari: api.mulai_dari,
    sampaiDengan: api.sampai_dengan,
    catatan: api.catatan,
    isActive: Boolean(api.is_active),
  }),

  billPayment: (api: ApiBillPayment) => ({
    id: api.id!,
    billId: api.bill_id,
    userId: api.user_id,
    bulan: api.bulan,
    dibayarPada: api.dibayar_pada,
    jumlahDibayar: Number(api.jumlah_dibayar),
  }),
};

// Health check
export const healthCheck = () => apiRequest<{ status: string }>('/health');

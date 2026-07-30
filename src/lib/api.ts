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

// Handler untuk unauthorized (401) - dapat di-set oleh auth store
let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler;
}

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('wallet_csrf='));
  return match ? decodeURIComponent(match.slice('wallet_csrf='.length)) : null;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface AuthenticatedUserResponse {
  id: string;
  username: string;
  role: string;
  createdAt: string;
}

export interface TfaChallengeResponse {
  requiresTwoFactor: true;
  challenge: string;
}

export interface ApiSession {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
}

export interface InitialSetupResponse {
  user: AuthenticatedUserResponse;
  recoveryCodes: string[];
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  behavior: { logoutOnUnauthorized?: boolean } = {},
): Promise<ApiResponse<T>> {
  try {
    const mergedHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    };
    const method = String(options.method || 'GET').toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const csrfToken = getCsrfToken();
      if (csrfToken) mergedHeaders['X-CSRF-Token'] = csrfToken;
    }

    const { headers: _discardedHeaders, ...restOptions } = options;
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...restOptions,
      headers: mergedHeaders,
      credentials: 'include',
    });

    // Auto-logout on 401 (expired/invalid token)
    if (response.status === 401 && behavior.logoutOnUnauthorized !== false) {
      if (unauthorizedHandler) {
        unauthorizedHandler();
      }
      const errorData = await response.json().catch(() => ({}));
      return { error: errorData.error || 'Sesi habis, silakan login ulang' };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { error: errorData.error || `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    console.error('API request failed:', error);

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
    apiRequest<AuthenticatedUserResponse | TfaChallengeResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  register: (username: string, password: string) =>
    apiRequest<ApiUser>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  verifyTwoFactor: (challenge: string, code: string) =>
    apiRequest<AuthenticatedUserResponse>('/auth/tfa/verify-login', {
      method: 'POST',
      body: JSON.stringify({ challenge, code }),
    }, { logoutOnUnauthorized: false }),

  getSession: () =>
    apiRequest<AuthenticatedUserResponse>('/auth/session', {}, { logoutOnUnauthorized: false }),

  logout: () =>
    apiRequest<{ success: true }>('/auth/logout', {
      method: 'POST',
    }, { logoutOnUnauthorized: false }),

  getSessions: () =>
    apiRequest<ApiSession[]>('/auth/sessions'),

  revokeSession: (sessionId: string) =>
    apiRequest<{ success: true; currentSessionRevoked: boolean }>(`/auth/sessions/${sessionId}`, {
      method: 'DELETE',
    }),

  revokeOtherSessions: () =>
    apiRequest<{ success: true }>('/auth/sessions', {
      method: 'DELETE',
    }),

  getTfaStatus: () =>
    apiRequest<{ enabled: boolean; recoveryCodesRemaining: number }>('/auth/tfa/status'),

  startTfaSetup: () =>
    apiRequest<{ setupToken: string; secret: string; otpAuthUri: string }>('/auth/tfa/setup', {
      method: 'POST',
    }),

  confirmTfaSetup: (setupToken: string, code: string) =>
    apiRequest<{ enabled: true; recoveryCodes: string[] }>('/auth/tfa/confirm', {
      method: 'POST',
      body: JSON.stringify({ setupToken, code }),
    }),

  disableTfa: (password: string, code: string) =>
    apiRequest<{ enabled: false }>('/auth/tfa/disable', {
      method: 'POST',
      body: JSON.stringify({ password, code }),
    }),
};

export const setupApi = {
  getStatus: () =>
    apiRequest<{ required: boolean }>('/setup/status', {}, { logoutOnUnauthorized: false }),

  startTfa: (username: string) =>
    apiRequest<{ setupToken: string; secret: string; otpAuthUri: string }>('/setup/tfa', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }, { logoutOnUnauthorized: false }),

  complete: (payload: {
    username: string;
    password: string;
    setupToken: string;
    code: string;
  }) =>
    apiRequest<InitialSetupResponse>('/setup/complete', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, { logoutOnUnauthorized: false }),
};

// Generic CRUD API factory
function createCrudApi<T extends { id?: string; user_id: string }>(tableName: string) {
  return {
    getAll: () => apiRequest<T[]>(`/${tableName}`),

    create: (data: Omit<T, 'id' | 'user_id'>) =>
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
  saving_id?: string; // ✅ NEW

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
  saving_id?: string; // ✅ NEW

}

export interface ApiBudget {
  id?: string;
  user_id: string;
  bulan: string;
  kategori: string;
  anggaran: number;
  rollover?: boolean;
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

export interface ApiSavingsTarget {
  id?: string;
  user_id: string;
  nama_target: string;
  target_amount: number;
  start_date: string;
  target_date: string;
  linked_account: string;
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
export const savingsTargetsApi = createCrudApi<ApiSavingsTarget>('savings_targets');
export const masterDataApi = createCrudApi<ApiMasterData>('master_data');
export const billsApi = createCrudApi<ApiBill>('bills');
export const billPaymentsApi = createCrudApi<ApiBillPayment>('bill_payments');

export const backupApi = {
  restore: (backup: unknown) =>
    apiRequest<{ success: true; restoredRecords: number }>('/backup/restore', {
      method: 'PUT',
      body: JSON.stringify(backup),
    }),
};

export interface PlanningRecord {
  id: string;
  [key: string]: unknown;
}

export const planningApi = {
  list: <T extends PlanningRecord>(resource: string) =>
    apiRequest<T[]>(`/planning/${resource}`),
  create: <T extends PlanningRecord>(resource: string, data: Record<string, unknown>) =>
    apiRequest<T>(`/planning/${resource}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: <T extends PlanningRecord>(resource: string, id: string, data: Record<string, unknown>) =>
    apiRequest<T>(`/planning/${resource}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (resource: string, id: string) =>
    apiRequest<{ success: true }>(`/planning/${resource}/${id}`, { method: 'DELETE' }),
  payDebt: (id: string, data: { amount: number; paid_at: string; notes?: string }) =>
    apiRequest<{ success: true; remaining: number }>(`/planning/debts/${id}/payments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getPreferences: () => apiRequest<Record<string, unknown>>('/planning/preferences'),
  savePreferences: (data: Record<string, unknown>) =>
    apiRequest<{ success: true }>('/planning/preferences', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  refreshNotifications: () =>
    apiRequest<{ success: true }>('/planning/notifications/refresh', { method: 'POST' }),
  markNotificationRead: (id: string) =>
    apiRequest<{ success: true }>(`/planning/notifications/${id}/read`, { method: 'PUT' }),
  sendTestEmail: () =>
    apiRequest<{ success: true }>('/planning/email/test', { method: 'POST' }),
  restoreTrash: (id: string) =>
    apiRequest<{ success: true }>(`/planning/trash/${id}/restore`, { method: 'POST' }),
  listReceipts: (expenseId: string) =>
    apiRequest<Array<{ id: string; original_name: string; mime_type: string; size: number }>>(
      `/planning/expenses/${expenseId}/receipts`,
    ),
  listAllReceipts: () =>
    apiRequest<Array<{
      id: string;
      expense_id: string;
      original_name: string;
      mime_type: string;
      size: number;
    }>>('/planning/receipts'),
  deleteReceipt: (id: string) =>
    apiRequest<{ success: true }>(`/planning/receipts/${id}`, { method: 'DELETE' }),
};

export const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;

export async function uploadExpenseReceipt(expenseId: string, file: File) {
  if (file.size > MAX_RECEIPT_SIZE) {
    throw new Error('Receipt is too large. Maximum file size is 5 MB.');
  }
  const body = new FormData();
  body.append('receipt', file);
  const headers: Record<string, string> = {};
  const csrfToken = getCsrfToken();
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  const response = await fetch(`${API_BASE_URL}/planning/expenses/${expenseId}/receipts`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body,
  });
  if (!response.ok) {
    if (response.status === 413) {
      throw new Error('Receipt is too large. Maximum file size is 5 MB.');
    }
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Receipt upload failed');
  }
  return response.json();
}

export async function downloadReceipt(id: string, filename: string) {
  const blob = await fetchReceiptBlob(id);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function fetchReceiptBlob(id: string) {
  const response = await fetch(`${API_BASE_URL}/planning/receipts/${id}/file`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Receipt download failed');
  return response.blob();
}

// User management API (admin only)
export interface ApiUser {
  id: string;
  username: string;
  role: 'admin' | 'user';
  tfaEnabled: boolean;
  createdAt: string;
}

export const usersApi = {
  getAll: () => apiRequest<ApiUser[]>(`/users`, {
    method: 'GET'
  }),
  getById: (id: string) => apiRequest<ApiUser>(`/users/${id}`, {
    method: 'GET'
  }),
  updateRole: (id: string, role: string) => apiRequest<{ message: string }>(`/users/${id}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role })
  }),
  updatePassword: (id: string, password: string) => apiRequest<{ message: string }>(`/users/${id}/password`, {
    method: 'PUT',
    body: JSON.stringify({ password })
  }),
  resetTfa: (id: string) => apiRequest<{ success: boolean; message: string }>(`/users/${id}/tfa`, {
    method: 'DELETE'
  }),
  delete: (id: string) => apiRequest<{ success: boolean; message: string }>(`/users/${id}`, {
    method: 'DELETE'
  })
};

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
    savingId: api.saving_id, // ✅ NEW
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
    savingId: api.saving_id, // ✅ NEW
  }),

  budget: (api: ApiBudget) => ({
    id: api.id!,
    userId: api.user_id,
    bulan: api.bulan,
    kategori: api.kategori,
    anggaran: Number(api.anggaran),
    rollover: Boolean(api.rollover),
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

  savingsTarget: (api: ApiSavingsTarget) => ({
    id: api.id!,
    userId: api.user_id,
    namaTarget: api.nama_target,
    targetAmount: Number(api.target_amount),
    currentAmount: 0,
    startDate: api.start_date,
    targetDate: api.target_date,
    status: 'Aktif' as const,
    linkedAccount: api.linked_account,
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

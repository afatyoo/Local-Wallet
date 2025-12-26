// Database types - now imported from financeStore
// This file is kept for backward compatibility
// All data is now stored in MySQL via the backend API

// Re-export types from financeStore for backward compatibility
export type { 
  Income, 
  Expense, 
  Budget, 
  Saving, 
  MasterData, 
  Bill, 
  BillPayment 
} from '@/stores/financeStore';

// User type for auth
export interface User {
  id: string;
  username: string;
  createdAt: string;
}

// Default master data for reference (now managed by backend)
export const defaultMasterData = {
  kategoriPemasukan: ['Gaji', 'Bonus', 'Investasi', 'Freelance', 'Hadiah', 'Lainnya'],
  kategoriPengeluaran: ['Makanan', 'Transportasi', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Pendidikan', 'Lainnya'],
  metodePembayaran: ['Tunai', 'Transfer Bank', 'Kartu Kredit', 'Kartu Debit', 'E-Wallet', 'QRIS'],
};

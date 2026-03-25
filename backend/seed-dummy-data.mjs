import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// Database connection using env variables
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'finance_user',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'finance_db',
  waitForConnections: true,
  connectionLimit: 1,
});

// Helper to format date as YYYY-MM-DD (ISO format for consistency with frontend)
const formatDate = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Helper to format month as YYYY-MM (ISO format for consistency with frontend)
const formatMonth = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const runSeed = async () => {
  const connection = await pool.getConnection();
  try {
    console.log('🌱 Starting dummy data seed...\n');

    // Clear existing data (for re-seeding)
    console.log('🧹 Clearing existing data...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('TRUNCATE TABLE bill_payments');
    await connection.query('TRUNCATE TABLE bills');
    await connection.query('TRUNCATE TABLE savings');
    await connection.query('TRUNCATE TABLE budgets');
    await connection.query('TRUNCATE TABLE expenses');
    await connection.query('TRUNCATE TABLE incomes');
    await connection.query('TRUNCATE TABLE master_data');
    await connection.query('TRUNCATE TABLE users');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('   ✅ Data cleared\n');

    // 1. Create a test user
    const userId = uuidv4();
    const testPassword = 'password123';
    const passwordHash = await bcrypt.hash(testPassword, 10);

    console.log('👤 Creating test user...');
    await connection.query(
      'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)',
      [userId, 'testuser', passwordHash]
    );
    console.log(`   ✅ User created: testuser / password123 (ID: ${userId.slice(0, 8)}...)`);

    // 2. Master Data (Categories & Payment Methods)
    console.log('\n📂 Creating master data (categories & payment methods)...');

    const incomeCategories = ['Gaji', 'Freelance', 'Investasi', 'Bonus', 'Lainnya'];
    const expenseCategories = ['Makanan', 'Transportasi', 'Sewa', 'Hiburan', 'Belanja', 'Kesehatan', 'Pendidikan', 'Tagihan', 'Lainnya'];
    const paymentMethods = ['Tunai', 'Transfer Bank', 'E-Wallet', 'Kartu Debit', 'Kartu Kredit', 'QRIS'];

    for (const cat of incomeCategories) {
      await connection.query(
        'INSERT INTO master_data (id, user_id, type, value) VALUES (?, ?, ?, ?)',
        [uuidv4(), userId, 'kategoriPemasukan', cat]
      );
    }
    for (const cat of expenseCategories) {
      await connection.query(
        'INSERT INTO master_data (id, user_id, type, value) VALUES (?, ?, ?, ?)',
        [uuidv4(), userId, 'kategoriPengeluaran', cat]
      );
    }
    for (const method of paymentMethods) {
      await connection.query(
        'INSERT INTO master_data (id, user_id, type, value) VALUES (?, ?, ?, ?)',
        [uuidv4(), userId, 'metodePembayaran', method]
      );
    }
    console.log(`   ✅ Added ${incomeCategories.length} income categories`);
    console.log(`   ✅ Added ${expenseCategories.length} expense categories`);
    console.log(`   ✅ Added ${paymentMethods.length} payment methods`);

    // 3. Savings Accounts
    console.log('\n💰 Creating savings/investment accounts...');
    const savings = [
      { jenis: 'Tabungan', nama_akun: 'Tabungan BCA', initial: 5000000 },
      { jenis: 'Tabungan', nama_akun: 'Tabungan Mandiri', initial: 2000000 },
      { jenis: 'Investasi', nama_akun: 'Reksadana Syariah', initial: 10000000 },
    ];

    for (const s of savings) {
      const today = formatDate(new Date());
      await connection.query(
        'INSERT INTO savings (id, user_id, tanggal, jenis, nama_akun, setoran) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), userId, today, s.jenis, s.nama_akun, s.initial]
      );
      console.log(`   ✅ ${s.jenis}: ${s.nama_akun} (Initial: Rp ${s.initial.toLocaleString('id-ID')})`);
    }

    // 4. Incomes (last 3 months)
    console.log('\n💵 Adding income transactions (last 3 months)...');
    const incomes = [
      { date: '2025-01-10', sumber: 'PT.tech', kategori: 'Gaji', jumlah: 15000000, metode: 'Transfer Bank' },
      { date: '2025-01-15', sumber: 'Freelance', kategori: 'Freelance', jumlah: 2500000, metode: 'E-Wallet' },
      { date: '2025-01-20', sumber: 'Dividen', kategori: 'Investasi', jumlah: 1200000, metode: 'Transfer Bank' },
      { date: '2025-02-10', sumber: 'PT.tech', kategori: 'Gaji', jumlah: 15000000, metode: 'Transfer Bank' },
      { date: '2025-02-15', sumber: 'Upcoming', kategori: 'Freelance', jumlah: 3000000, metode: 'E-Wallet' },
      { date: '2025-02-18', sumber: 'Bonus Q1', kategori: 'Bonus', jumlah: 5000000, metode: 'Transfer Bank' },
      { date: '2025-03-10', sumber: 'PT.tech', kategori: 'Gaji', jumlah: 15000000, metode: 'Transfer Bank' },
      { date: '2025-03-12', sumber: 'Side project', kategori: 'Freelance', jumlah: 2000000, metode: 'QRIS' },
      { date: '2025-03-15', sumber: 'Return Investment', kategori: 'Investasi', jumlah: 2500000, metode: 'Transfer Bank' },
    ];

    for (const inc of incomes) {
      const d = new Date(inc.date);
      const tanggal = formatDate(inc.date);
      const bulan = formatMonth(inc.date);
      await connection.query(
        'INSERT INTO incomes (id, user_id, tanggal, bulan, sumber, kategori, metode, jumlah, catatan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), userId, tanggal, bulan, inc.sumber, inc.kategori, inc.metode, inc.jumlah, null]
      );
    }
    const totalIncome = incomes.reduce((sum, i) => sum + i.jumlah, 0);
    console.log(`   ✅ Added ${incomes.length} income transactions (Total: Rp ${totalIncome.toLocaleString('id-ID')})`);

    // 5. Expenses (last 3 months)
    console.log('\n💸 Adding expense transactions (last 3 months)...');
    const expenses = [
      // January
      { date: '2025-01-05', nama: 'Sewa apartemen Januari', kategori: 'Sewa', jumlah: 3500000, metode: 'Transfer Bank', catatan: 'Sewa bulanan' },
      { date: '2025-01-08', nama: 'Token listrik', kategori: 'Tagihan', jumlah: 300000, metode: 'E-Wallet', catatan: 'Prabayar' },
      { date: '2025-01-12', nama: 'Internet Indihome', kategori: 'Tagihan', jumlah: 450000, metode: 'E-Wallet', catatan: '50 Mbps' },
      { date: '2025-01-15', nama: 'Groceries', kategori: 'Makanan', jumlah: 1200000, metode: 'Kartu Debit' },
      { date: '2025-01-18', nama: 'Transportasi/Grab', kategori: 'Transportasi', jumlah: 800000, metode: 'E-Wallet' },
      { date: '2025-01-20', nama: 'Netflix Subscription', kategori: 'Hiburan', jumlah: 150000, metode: 'Kartu Kredit' },
      { date: '2025-01-22', nama: 'Gym Membership', kategori: 'Kesehatan', jumlah: 500000, metode: 'Transfer Bank' },
      { date: '2025-01-25', nama: 'New Balance shoes', kategori: 'Belanja', jumlah: 2500000, metode: 'Kartu Kredit' },
      { date: '2025-01-28', nama: 'Family dinner', kategori: 'Makanan', jumlah: 750000, metode: 'Tunai' },

      // February
      { date: '2025-02-05', nama: 'Sewa apartemen Februari', kategori: 'Sewa', jumlah: 3500000, metode: 'Transfer Bank', catatan: 'Sewa bulanan' },
      { date: '2025-02-09', nama: 'Token listrik', kategori: 'Tagihan', jumlah: 280000, metode: 'E-Wallet' },
      { date: '2025-02-12', nama: 'Internet Indihome', kategori: 'Tagihan', jumlah: 450000, metode: 'E-Wallet' },
      { date: '2025-02-15', nama: 'Groceries', kategori: 'Makanan', jumlah: 1500000, metode: 'Kartu Debit' },
      { date: '2025-02-18', nama: 'Transportasi/Grab & Gojek', kategori: 'Transportasi', jumlah: 950000, metode: 'E-Wallet' },
      { date: '2025-02-20', nama: 'Spotify + Disney+', kategori: 'Hiburan', jumlah: 120000, metode: 'Kartu Kredit' },
      { date: '2025-02-23', nama: 'Medical checkup', kategori: 'Kesehatan', jumlah: 750000, metode: 'Transfer Bank' },
      { date: '2025-02-25', nama: 'Course online', kategori: 'Pendidikan', jumlah: 2000000, metode: 'Kartu Kredit' },
      { date: '2025-02-27', nama: 'Shopping Uniqlo', kategori: 'Belanja', jumlah: 1800000, metode: 'Kartu Debit' },

      // March
      { date: '2025-03-05', nama: 'Sewa apartemen Maret', kategori: 'Sewa', jumlah: 3500000, metode: 'Transfer Bank' },
      { date: '2025-03-08', nama: 'Token listrik', kategori: 'Tagihan', jumlah: 320000, metode: 'E-Wallet' },
      { date: '2025-03-12', nama: 'Internet Indihome', kategori: 'Tagihan', jumlah: 450000, metode: 'E-Wallet' },
      { date: '2025-03-15', nama: 'Groceries', kategori: 'Makanan', jumlah: 1300000, metode: 'Kartu Debit' },
      { date: '2025-03-18', nama: 'Transportasi', kategori: 'Transportasi', jumlah: 700000, metode: 'E-Wallet' },
      { date: '2025-03-20', nama: 'Tempat makan fine dining', kategori: 'Hiburan', jumlah: 1200000, metode: 'Kartu Kredit' },
      { date: '2025-03-22', nama: 'Susu & vitamin', kategori: 'Kesehatan', jumlah: 350000, metode: 'Tunai' },
      { date: '2025-03-24', nama: 'Buku programming', kategori: 'Pendidikan', jumlah: 500000, metode: 'Transfer Bank' },
      { date: '2025-03-26', nama: 'Electronics accessories', kategori: 'Belanja', jumlah: 2200000, metode: 'Kartu Kredit' },
    ];

    for (const exp of expenses) {
      const d = new Date(exp.date);
      const tanggal = formatDate(exp.date);
      const bulan = formatMonth(exp.date);
      await connection.query(
        'INSERT INTO expenses (id, user_id, tanggal, bulan, nama, kategori, metode, jumlah, catatan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), userId, tanggal, bulan, exp.nama, exp.kategori, exp.metode, exp.jumlah, exp.catatan || null]
      );
    }
    const totalExpenses = expenses.reduce((sum, e) => sum + e.jumlah, 0);
    console.log(`   ✅ Added ${expenses.length} expense transactions (Total: Rp ${totalExpenses.toLocaleString('id-ID')})`);

    // 6. Budgets (for current month March 2025)
    console.log('\n🎯 Setting up budgets for March 2025...');
    const budgets = [
      { kategori: 'Makanan', anggaran: 5000000 },
      { kategori: 'Transportasi', anggaran: 2500000 },
      { kategori: 'Sewa', anggaran: 3500000 },
      { kategori: 'Hiburan', anggaran: 2000000 },
      { kategori: 'Belanja', anggaran: 3000000 },
      { kategori: 'Kesehatan', anggaran: 1500000 },
      { kategori: 'Pendidikan', anggaran: 1000000 },
      { kategori: 'Tagihan', anggaran: 2000000 },
      { kategori: 'Lainnya', anggaran: 1000000 },
    ];

    const currentMonth = '2025-03';
    for (const bud of budgets) {
      await connection.query(
        'INSERT INTO budgets (id, user_id, bulan, kategori, anggaran) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), userId, currentMonth, bud.kategori, bud.anggaran]
      );
    }
    const totalBudget = budgets.reduce((sum, b) => sum + b.anggaran, 0);
    console.log(`   ✅ Added ${budgets.length} budget categories for ${currentMonth} (Total: Rp ${totalBudget.toLocaleString('id-ID')})`);

    // 7. Bills (Recurring)
    console.log('\n📅 Creating recurring bills...');
    const today = new Date();
    const billCurrentMonth = formatMonth(today);

    const bills = [
      {
        nama: 'Sewa Apartemen',
        kategori: 'Sewa',
        jumlah: 3500000,
        tanggal_jatuh_tempo: 5,
        mulai_dari: '01/2025',
        sampai_dengan: '12/2025',
      },
      {
        nama: 'Internet Indihome',
        kategori: 'Tagihan',
        jumlah: 450000,
        tanggal_jatuh_tempo: 12,
        mulai_dari: '01/2025',
        sampai_dengan: '12/2025',
      },
      {
        nama: 'Token Listrik',
        kategori: 'Tagihan',
        jumlah: 100000,
        tanggal_jatuh_tempo: 10,
        mulai_dari: '01/2025',
        sampai_dengan: '12/2025',
      },
      {
        nama: 'Netflix',
        kategori: 'Hiburan',
        jumlah: 150000,
        tanggal_jatuh_tempo: 20,
        mulai_dari: '01/2025',
        sampai_dengan: '12/2025',
      },
    ];

    for (const bill of bills) {
      await connection.query(
        'INSERT INTO bills (id, user_id, nama, kategori, jumlah, tanggal_jatuh_tempo, mulai_dari, sampai_dengan, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), userId, bill.nama, bill.kategori, bill.jumlah, bill.tanggal_jatuh_tempo, bill.mulai_dari, bill.sampai_dengan, 1]
      );
    }
    console.log(`   ✅ Added ${bills.length} recurring bills`);

    // 8. Bill Payments (some already paid for current month)
    console.log('\n✅ Recording some bill payments for March...');
    const billPayments = [
      { bulan: '2025-03', jumlah_dibayar: 3500000 },
      { bulan: '2025-03', jumlah_dibayar: 450000 },
    ];

    // Get bill IDs to insert payments
    const [billsRows] = await connection.query('SELECT id, nama FROM bills WHERE user_id = ?', [userId]);
    for (const payment of billPayments) {
      const bill = billsRows.find(b => {
        const billAmount = bills.find(b => b.nama === b.nama)?.jumlah;
        return Math.abs(billAmount - payment.jumlah_dibayar) < 100;
      });
      if (bill) {
        const billId = bill.id;
        await connection.query(
          'INSERT INTO bill_payments (id, bill_id, user_id, bulan, dibayar_pada, jumlah_dibayar) VALUES (?, ?, ?, ?, NOW(), ?)',
          [uuidv4(), billId, userId, payment.bulan, payment.jumlah_dibayar]
        );
        console.log(`   ✅ Payment recorded: ${payment.bulan} - Rp ${payment.jumlah_dibayar.toLocaleString('id-ID')}`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('🎉 DUMMY DATA SEED COMPLETE!');
    console.log('='.repeat(50));
    console.log('\n📊 Summary:');
    console.log(`   👤 Test User: testuser / password123`);
    console.log(`   💰 Total Income: Rp ${totalIncome.toLocaleString('id-ID')}`);
    console.log(`   💸 Total Expenses: Rp ${totalExpenses.toLocaleString('id-ID')}`);
    console.log(`   📈 Net Balance: Rp ${(totalIncome - totalExpenses).toLocaleString('id-ID')}`);
    console.log(`   🎯 Total Budget (Mar 2025): Rp ${totalBudget.toLocaleString('id-ID')}`);
    console.log('\n🌐 You can now login at http://localhost:3000 with:');
    console.log('   Username: testuser');
    console.log('   Password: password123');
    console.log('\n');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await connection.end();
    await pool.end();
  }
};

runSeed().catch(console.error);

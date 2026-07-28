function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidMonth(value) {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function isNonNegativeNumber(value) {
  return value !== undefined && value !== null && Number.isFinite(Number(value)) && Number(value) >= 0;
}

function isRequiredText(value, maxLength = 100) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

export function normalizeMysqlDatetime(value) {
  if (!value) return value;
  if (typeof value === 'string' && value.includes('T')) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 19).replace('T', ' ');
    }
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+/.test(value)) {
    return value.slice(0, 19);
  }
  return value;
}

export function pickColumns(body, allowedColumns) {
  const output = {};
  for (const column of allowedColumns) {
    if (Object.prototype.hasOwnProperty.call(body, column)) {
      output[column] = body[column];
    }
  }
  return output;
}

function stripHtml(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/<[^>]*>/g, '');
}

const TEXT_FIELDS = [
  'catatan',
  'nama',
  'sumber',
  'nama_akun',
  'nama_target',
  'linked_account',
  'value',
  'kategori',
  'metode',
];

export function sanitizePayload(payload) {
  const sanitized = { ...payload };
  for (const field of TEXT_FIELDS) {
    if (sanitized[field] !== undefined) {
      sanitized[field] = stripHtml(sanitized[field]).trim();
    }
  }
  return sanitized;
}

export const VALIDATORS = {
  incomes: (body) => {
    if (!isValidDate(body.tanggal)) return 'tanggal harus format YYYY-MM-DD';
    if (!isRequiredText(body.sumber)) return 'sumber wajib diisi';
    if (!isRequiredText(body.kategori)) return 'kategori wajib diisi';
    if (!isRequiredText(body.metode)) return 'metode wajib diisi';
    if (!isNonNegativeNumber(body.jumlah)) return 'jumlah harus berupa angka >= 0';
    return null;
  },
  expenses: (body) => {
    if (!isValidDate(body.tanggal)) return 'tanggal harus format YYYY-MM-DD';
    if (!isRequiredText(body.nama)) return 'nama wajib diisi';
    if (!isRequiredText(body.kategori)) return 'kategori wajib diisi';
    if (!isRequiredText(body.metode)) return 'metode wajib diisi';
    if (!isNonNegativeNumber(body.jumlah)) return 'jumlah harus berupa angka >= 0';
    return null;
  },
  budgets: (body) => {
    if (!isValidMonth(body.bulan)) return 'bulan harus format YYYY-MM';
    if (!isRequiredText(body.kategori)) return 'kategori wajib diisi';
    if (!isNonNegativeNumber(body.anggaran)) return 'anggaran harus berupa angka >= 0';
    return null;
  },
  savings: (body) => {
    if (!isValidDate(body.tanggal)) return 'tanggal harus format YYYY-MM-DD';
    if (!['Tabungan', 'Investasi'].includes(body.jenis)) return 'jenis harus Tabungan atau Investasi';
    if (!isRequiredText(body.nama_akun)) return 'nama_akun wajib diisi';
    if (!isNonNegativeNumber(body.setoran ?? 0)) return 'setoran harus berupa angka >= 0';
    if (!isNonNegativeNumber(body.penarikan ?? 0)) return 'penarikan harus berupa angka >= 0';
    return null;
  },
  savings_targets: (body) => {
    if (!isRequiredText(body.nama_target)) return 'nama_target wajib diisi';
    if (!Number.isFinite(Number(body.target_amount)) || Number(body.target_amount) <= 0) {
      return 'target_amount harus berupa angka > 0';
    }
    if (!isValidDate(body.start_date)) return 'start_date harus format YYYY-MM-DD';
    if (!isValidDate(body.target_date)) return 'target_date harus format YYYY-MM-DD';
    if (body.target_date < body.start_date) return 'target_date tidak boleh sebelum start_date';
    if (!isRequiredText(body.linked_account)) return 'linked_account wajib diisi';
    return null;
  },
  master_data: (body) => {
    if (!['kategoriPemasukan', 'kategoriPengeluaran', 'metodePembayaran'].includes(body.type)) {
      return 'type tidak valid';
    }
    if (!isRequiredText(body.value)) return 'value wajib diisi';
    return null;
  },
  bills: (body) => {
    if (!isRequiredText(body.nama)) return 'nama wajib diisi';
    if (!isRequiredText(body.kategori)) return 'kategori wajib diisi';
    if (!isNonNegativeNumber(body.jumlah)) return 'jumlah harus berupa angka >= 0';
    if (!Number.isInteger(Number(body.tanggal_jatuh_tempo))
      || Number(body.tanggal_jatuh_tempo) < 1
      || Number(body.tanggal_jatuh_tempo) > 31) {
      return 'tanggal_jatuh_tempo harus 1-31';
    }
    if (!isValidMonth(body.mulai_dari)) return 'mulai_dari harus format YYYY-MM';
    return null;
  },
  bill_payments: (body) => {
    if (!isRequiredText(body.bill_id, 36)) return 'bill_id wajib diisi';
    if (!isValidMonth(body.bulan)) return 'bulan harus format YYYY-MM';
    if (!isNonNegativeNumber(body.jumlah_dibayar)) return 'jumlah_dibayar harus berupa angka >= 0';
    return null;
  },
};

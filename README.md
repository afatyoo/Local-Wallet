# 👛 My Local Wallet

A simple personal finance tracker built with **React + TypeScript** (frontend) and **Node.js + Express + MySQL** (backend).  
Great for tracking **income, expenses, budgets, savings/investments, and recurring bills** — with charts and export/import.

![React](https://img.shields.io/badge/React-18.3-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue) ![Vite](https://img.shields.io/badge/Vite-5.4-purple) ![Tailwind](https://img.shields.io/badge/Tailwind-3.4-teal) ![MySQL](https://img.shields.io/badge/MySQL-8.0-orange) ![Docker](https://img.shields.io/badge/Docker-Ready-blue)

---

## ✨ Features

- 🔐 **Register & Login** (passwords hashed with bcrypt) — registration is admin-only (see User Management)
- 🔑 **Two-Factor Authentication** — optional TOTP, authenticator QR setup, one-time recovery codes, and admin reset
- 📊 **Dashboard**: income vs expense, balance summary, recent transactions
- 💵 **Income**: CRUD + categories + payment methods
- 💸 **Expenses**: CRUD + categories + payment methods
- 🧾 **Expense receipts**: attach JPG, PNG, WebP, or PDF evidence (up to 5 MB)
- 🎯 **Budgets** per category and month, with optional positive-balance rollover
- 🐷 **Savings / Investments** tracking
- 📅 **Bills** (recurring) + payment history
- 🏦 **Planning**: net worth, debts/receivables, payment history, and smart categorization rules
- 🔔 **Notifications**: bill, debt, and budget alerts with optional SMTP email delivery
- ↩️ **Activity & Trash**: audit history and 30-day restore for deleted finance records
- 📈 **Insights & Heatmap** (spending patterns)
- 🧾 **Reports** + **Export to PDF**
- ♻️ **Export/Import JSON** for backup/restore

### 👤 User Management (Admin)
- Admins can view all users, update roles, reset passwords/TFA, and create new users via inline modal
- Self-registration is disabled; only administrators can create accounts
- Dates (e.g., Created At) are displayed in the server's local timezone for consistency

### 🕒 Timezone Handling
- All timestamps stored in MySQL use the server's timezone
- Frontend displays dates (e.g., user Created At) in DD/MM/YYYY format based on server timezone, ensuring consistent date display regardless of client location

### 💱 Currency (Multi-currency Display)
- ✅ **Base currency: IDR** (amounts are stored in IDR)
- 🌍 Choose a **display currency** (IDR, USD, EUR, GBP, SGD, JPY, and more)
- 🔄 **Automatic conversion** using the latest exchange rates + a **Refresh rates** action
- 🕒 Rates are **cached** (lightweight and fast), with manual refresh whenever needed

### 🌐 Multi-language (Enhanced i18n)
- 🌐 **Bilingual UI** — Bahasa Indonesia (`id`) and English (`en`), selectable per user
- ⚙️ **Auto sync & auto translate** for missing keys, with optional changed-key retranslation
- 🐳 **LibreTranslate via Docker** support for auto-translation without paid APIs (optional)

---

## 🧱 Tech Stack

- Frontend: React 18, TypeScript, Vite, Tailwind, shadcn/ui, Zustand
- Charts: Recharts
- PDF Export: jsPDF + jspdf-autotable
- Currency: Zustand store + persisted settings + exchange rates (public currency rates API)
- Backend: Node.js, Express, mysql2, bcryptjs, uuid
- Container: Docker + Docker Compose (Nginx serves the frontend + reverse-proxy `/api`)

---

## 🗂 Project Structure

```
my-local-wallet/
├─ src/                  # React app
├─ backend/              # Express API + MySQL schema/init
├─ docker-compose.yml    # app + backend + mysql (+ libretranslate + i18n tools)
├─ nginx.conf            # proxy /api -> backend
├─ Dockerfile            # build React -> serve via Nginx
├─ backend/Dockerfile    # backend image
├─ .env.example          # env template (copy to .env)
└─ README_DOCKER.md      # Docker quick notes
```

---

## 🚀 Quick Start (Docker - recommended)

1) Copy the env file:

```bash
cp .env.example .env
```

2) Edit `.env` (at minimum: MySQL credentials). Example:

```env
WEB_PORT=3000
MYSQL_ROOT_PASSWORD=change_me_root
MYSQL_DATABASE=finance_db
MYSQL_USER=finance_user
MYSQL_PASSWORD=change_me_password
JWT_SECRET=generate_a_long_random_value
TFA_ENCRYPTION_KEY=generate_a_different_long_random_value
```

3) Run:

```bash
docker compose up -d --build
```

4) Open:

- Frontend: http://localhost:3000  
- Backend health: http://localhost:3000/api/health

> Note: In Docker, the frontend uses `VITE_API_URL=/api` and Nginx proxies `/api/*` to the backend container.

### Email notifications (optional)

Configure any SMTP provider in `.env`, then rebuild the backend:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=wallet@example.com
SMTP_PASSWORD=your_smtp_password
SMTP_FROM=wallet@example.com
APP_URL=https://wallet.example.com
NOTIFICATION_SCAN_INTERVAL_MS=21600000
```

- Use port `587` with `SMTP_SECURE=false` for STARTTLS, or port `465` with `SMTP_SECURE=true`.
- For providers that require two-factor authentication, use an SMTP/API app password instead of the account password.
- In **Planning → Notifications**, enter the recipient email, enable email delivery, save, and use **Test email**.
- The backend scans automatically every six hours by default. The minimum supported interval is one minute.

Apply changes:

```bash
docker compose up -d --build backend
```

### Receipt storage and backups

Docker stores receipt files in the persistent `receipts_data` volume. JSON export version 4 includes net worth, debts, debt payments, and categorization rules, but does not embed receipt binaries. Include both `mysql_data` and `receipts_data` in server-level backups when receipt evidence must be recoverable.

### Reset the database (delete all data)

```bash
docker compose down -v
docker compose up -d --build
```

---

## 🧑‍💻 Local Development (no Docker)

### Prerequisites
- Node.js 18+ (Docker uses Node 20)
- MySQL 8.0+

### 1) Start the backend
```bash
cd backend
npm install
# set env then run:
MYSQL_HOST=127.0.0.1 MYSQL_PORT=3306 MYSQL_USER=root MYSQL_PASSWORD=your_password MYSQL_DATABASE=finance_db npm run dev
```

Backend runs on: `http://localhost:3001`

### 2) Start the frontend
Open a new terminal:

```bash
npm install
# point frontend to backend:
export VITE_API_URL="http://localhost:3001/api"
npm run dev
```

Frontend runs on: `http://localhost:5173`

---

## 🔌 Environment Variables

### Frontend
- `VITE_API_URL`  
  Base URL for the backend API.  
  - Local dev: `http://localhost:3001/api`
  - Docker: `/api` (default in Dockerfile)

### Docker Compose / Backend
- `WEB_PORT` (default `3000`) — exposed port for the web UI
- `MYSQL_ROOT_PASSWORD`
- `MYSQL_DATABASE`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_HOST` (Docker uses `mysql`)
- `MYSQL_PORT` (default `3306`)
- `JWT_SECRET` — required signing key for short-lived TFA challenges
- `TFA_ENCRYPTION_KEY` — recommended separate key for encrypting TOTP secrets at rest; keep this value stable after users enable TFA
- `COOKIE_SECURE` — set to `true` when the public app is served through HTTPS

---

## 💱 Currency / Exchange Rates Notes

- **All amounts are stored in IDR**, then displayed in the user-selected **display currency**.
- Rates are fetched from a **public exchange-rates API** and cached to reduce repeated calls.
- If rates cannot be fetched (e.g., offline), the app still works and falls back to IDR / last-known rates.

---

## 🧾 API Endpoints (summary)

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/session`
- `POST /api/auth/logout`
- `POST /api/auth/tfa/verify-login`
- `GET /api/auth/tfa/status`
- `POST /api/auth/tfa/setup`
- `POST /api/auth/tfa/confirm`
- `POST /api/auth/tfa/disable`
- `PUT /api/backup/restore`
- CRUD:
  - `/api/incomes/*`
  - `/api/expenses/*`
  - `/api/budgets/*`
  - `/api/savings/*`
  - `/api/master_data/*`
  - `/api/bills/*`
  - `/api/bill_payments/*`

---

## 🔐 Notes / Security

- Passwords are **hashed** (bcrypt) before being stored.
- TOTP secrets are encrypted with AES-256-GCM and recovery codes are stored only as keyed hashes.
- Login TFA challenges expire after five minutes and cannot be used as API access tokens.
- Login sessions are opaque, revocable, stored in MySQL, and sent through `HttpOnly` cookies.
- Authenticated write requests use a per-session CSRF token.
- JSON restore is validated and committed atomically; encrypted backup files use password-derived AES-256-GCM.
- For production: change DB passwords, and run behind HTTPS (reverse proxy like Nginx/Caddy/Traefik).
- CORS is restricted through `ALLOWED_ORIGINS`.

---

## 🌍 i18n / Auto Translation

**Base translations** live in:

- `src/locales/id.json` ✅ (source of truth)

Other languages:

- `src/locales/en.json`, `es.json`, `fr.json`, `de.json`, `pt.json`, `ru.json`, `ar.json`, `hi.json`, `zh.json`, `ja.json`, `ko.json`

### Workflow (automatic ✅)
1) Add/update keys in `src/locales/id.json`
2) Run the app:

```bash
npm run dev
```

The system will:
- sync locale files (create missing language files)
- auto-translate new/changed keys (when a translator service is available)

### Manual scripts (optional)
```bash
npm run i18n:sync
npm run i18n:translate
npm run i18n:auto
```

### Docker (LibreTranslate) — optional but recommended
If you’re using Docker Compose, you can enable **LibreTranslate** for automatic translations without a paid API.  
In `docker-compose.yml`, these services are already included:

- `libretranslate`
- `i18n_bootstrap` (one-shot generation)
- `i18n_watcher` (periodic sync/translate)

> Default provider: **LibreTranslate** (free). (Optional) you can switch to another provider via the `TRANSLATE_PROVIDER` env variable.

---

## 📄 License

See `LICENSE`.

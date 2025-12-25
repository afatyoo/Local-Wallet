# 👛 My Local Wallet

A simple personal finance tracker built with **React + TypeScript** (frontend) and **Node.js + Express + MySQL** (backend).  
Works great for tracking **income, expenses, budgets, savings/investments, and monthly bills** — with charts + export/import.

![React](https://img.shields.io/badge/React-18.3-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue) ![Vite](https://img.shields.io/badge/Vite-5.4-purple) ![Tailwind](https://img.shields.io/badge/Tailwind-3.4-teal) ![MySQL](https://img.shields.io/badge/MySQL-8.0-orange) ![Docker](https://img.shields.io/badge/Docker-Ready-blue)

---

## ✨ Features

- 🔐 **Register & Login** (password hashed with bcrypt)
- 📊 **Dashboard**: income vs expense, balance summary, recent transactions
- 💵 **Income**: CRUD + categories + payment methods
- 💸 **Expense**: CRUD + categories + payment methods
- 🎯 **Budgets** per category & month
- 🐷 **Savings / Investments** tracking
- 📅 **Bills** (recurring) + paid history
- 📈 **Insights & Heatmap** (spending patterns)
- 🧾 **Reports** + **Export to PDF**
- ♻️ **Export/Import JSON** for backup/restore
- 🌐 **Multi-language UI** (ID, EN, 中文, ES, AR, HI)

---

## 🧱 Tech Stack

- Frontend: React 18, TypeScript, Vite, Tailwind, shadcn/ui, Zustand, React Router
- Charts: Recharts
- PDF Export: jsPDF + jspdf-autotable
- Backend: Node.js, Express, mysql2, bcryptjs, uuid
- Container: Docker + Docker Compose (Nginx serves frontend + reverse-proxy `/api`)

---

## 🗂 Project Structure

```
my-local-wallet/
├─ src/                  # React app
├─ backend/              # Express API + MySQL schema init
├─ docker-compose.yml    # app + backend + mysql
├─ nginx.conf            # proxy /api -> backend
├─ Dockerfile            # build React -> serve via Nginx
├─ backend/Dockerfile    # backend image
├─ .env.example          # env template (copy to .env)
└─ README_DOCKER.md      # docker quick notes
```

---

## 🚀 Quick Start (Docker - recommended)

1) Copy env file:

```bash
cp .env.example .env
```

2) Edit `.env` (minimum: MySQL passwords). Example:

```env
WEB_PORT=3000
MYSQL_ROOT_PASSWORD=change_me_root
MYSQL_DATABASE=finance_db
MYSQL_USER=finance_user
MYSQL_PASSWORD=change_me_password
```

3) Run:

```bash
docker compose up -d --build
```

4) Open:

- Frontend: http://localhost:3000  
- Backend health: http://localhost:3000/api/health

> Note: In Docker, frontend uses `VITE_API_URL=/api` and Nginx will proxy `/api/*` to the backend container.

### Reset database (delete all data)

```bash
docker compose down -v
docker compose up -d --build
```

---

## 🧑‍💻 Local Development (no Docker)

### Prerequisites
- Node.js 18+ (project Docker uses Node 20)
- MySQL 8.0+

### 1) Start backend
```bash
cd backend
npm install
# set env then run:
MYSQL_HOST=127.0.0.1 MYSQL_PORT=3306 MYSQL_USER=root MYSQL_PASSWORD=your_password MYSQL_DATABASE=finance_db npm run dev
```

Backend runs on: `http://localhost:3001`

### 2) Start frontend
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
  Base URL for backend API.  
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

---

## 🧾 API Endpoints (summary)

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
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

- Passwords are **hashed** (bcrypt) before stored.
- For production: change DB passwords, and run behind HTTPS (reverse proxy like Nginx/Caddy/Traefik).
- Default CORS is enabled (backend uses `cors()`).

---

## 📄 License

See `LICENSE`.

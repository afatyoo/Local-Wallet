# Changelog

All notable changes to **My Local Wallet** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] — Initial Release

### Added
- 🔐 User registration and login with bcrypt password hashing
- 📊 Dashboard with income vs expense summary, balance, and recent transactions
- 💵 Income management — CRUD, categories, payment methods
- 💸 Expense management — CRUD, categories, payment methods
- 🎯 Budget tracking per category and month
- 🐷 Savings and investments tracking
- 📅 Recurring bills management with payment history
- 📈 Insights and spending heatmap
- 🧾 Reports with PDF export (jsPDF + jspdf-autotable)
- ♻️ JSON export/import for backup and restore
- 💱 Multi-currency display — base IDR, supports USD, EUR, GBP, SGD, JPY, and more
- 🔄 Automatic exchange rate fetching with caching and manual refresh
- 🌐 Multi-language UI — EN, ID, ES, FR, DE, PT, RU, AR, HI, ZH, JA, KO
- ⚙️ Auto i18n sync and auto-translation (hash-based, avoids redundant work)
- 🐳 Docker + Docker Compose full stack setup (Nginx + backend + MySQL)
- 🌍 LibreTranslate Docker support for free auto-translation
- 📦 Tech stack: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Zustand, Recharts
- 🔧 Backend: Node.js, Express, mysql2, bcryptjs, uuid

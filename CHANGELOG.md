# Changelog

All notable changes to **My Local Wallet** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
---

## [Unreleased]

### Added
- **User Management page**: Added a new page for managing users with the ability to view, update, and delete users.
- **User Management navigation**: Added a navigation link to the User Management page in the sidebar.
- **User Management i18n**: Added translation keys for the User Management page in all 12 locale files.
- **Admin-only User Management nav**: Added "User Management" sidebar link (ShieldCheck icon) visible only to admin users. Non-admin users do not see this menu item.
- **i18n for User Management**: Added `nav_user_management` translation key to all 12 locale files (ID, EN, ES, FR, DE, PT, RU, AR, HI, ZH, JA, KO).
- **Default admin user**: On Docker startup, a default admin account (username: `admin`, password: `admin`) is automatically created if it doesn't already exist.

### Fixed
- **UserManagement React import bug**: Fixed `React.useEffect` usage without importing `React` in `UserManagement.tsx`; replaced with direct `useEffect` import.
- **JWT auth token not sent**: Fixed "Access Token Required" error on User Management and all protected API endpoints. Root cause: frontend never stored or sent the JWT token from login/register. Now `authStore` persists the token and `apiRequest` attaches `Authorization: Bearer` header on every request. Backend register endpoint also returns a JWT token (login already did).

---

## [1.1.0]

### Added
- **Auto-switch to latest month**: When viewing Income or Expense pages with "All Period" selected, the app automatically switches to the most recent month with data (prevents blank screens).
- **Improved dummy data seeding**: New seed script (`backend/seed-dummy-data.mjs`) that clears existing data and populates realistic test data with correct date formats (`YYYY-MM` for months, `YYYY-MM-DD` for dates).
- **Docker port configuration**: MySQL exposed on port 3307 to avoid conflicts with local MySQL installations.
- **Excel export**: Added ability to export financial reports to Excel (XLSX) format alongside PDF. Excel reports include multiple sheets: Summary, Income, Expenses, Budget, and Category Breakdown.


### Fixed
- **Month filter bug**: Fixed mismatch between seed data format (`MM/YYYY`) and frontend expectations (`YYYY-MM`), causing income/expense filters to return empty results.
- **ReferenceError**: Added missing `setSelectedMonth` destructuring in `Income.tsx` and `Expense.tsx` which caused blank pages when auto-switch triggered.
- **Date format consistency**: All seeded dates now use ISO format compatible with frontend date inputs and month filtering.
- **PDF generation error**: Fixed `Invalid argument passed to jsPDF.f3` error by using hex color strings instead of RGB arrays and ensuring jsPDF 2.5.1 + jspdf-autotable 3.5.13 compatibility.
- **Report UI localization**: Changed report page UI and generated PDFs to use English as default language for better internationalization.


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

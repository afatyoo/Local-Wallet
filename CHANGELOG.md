# Changelog

All notable changes to **My Local Wallet** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).




---

## [Unreleased]

### Fixed
- **401 logout sync**: When API returns 401, `apiRequest` now calls `unauthorizedHandler` which triggers `authStore.logout()` to ensure frontend state matches the cleared localStorage. Prevents "Access Token Required" errors on retry after token expiry.

---

## [1.2.1] — 2026-03-26

>>>>>>> f50ab5f (fix: sync auth store logout on 401 responses)
### Added
- **User Management page**: Added a new page for managing users with the ability to view, update, and delete users.
- **User Management navigation**: Added a navigation link to the User Management page in the sidebar.
- **User Management i18n**: Added translation keys for the User Management page in all 12 locale files.
- **Admin-only User Management nav**: Added "User Management" sidebar link (ShieldCheck icon) visible only to admin users. Non-admin users do not see this menu item.
- **i18n for User Management**: Added `nav_user_management` translation key to all 12 locale files (ID, EN, ES, FR, DE, PT, RU, AR, HI, ZH, JA, KO).
- **Default admin user**: On Docker startup, a default admin account (username: `admin`, password: `admin`) is automatically created if it doesn't already exist.
- **Rate limiting**: Global limit (100 req/15 min) + aggressive auth limit (5 req/15 min) via `express-rate-limit` to prevent brute-force attacks.
- **Security headers**: Added `helmet()` middleware — sets `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, and 8+ other headers automatically.
- **Input validation**: Required-field checks, date/month format validation (`YYYY-MM-DD` / `YYYY-MM`), and minimum password length (6 chars) on all endpoints.
- **HTML sanitization**: All text inputs are stripped of HTML tags before reaching the database.
- **CORS restriction**: CORS now reads `ALLOWED_ORIGINS` env var instead of allowing every origin (`*`).
- **Docker env passthrough**: `JWT_SECRET` and `ALLOWED_ORIGINS` are now forwarded to the backend container in `docker-compose.yml`.
- **`.env.example`**: Documents all required backend environment variables including `JWT_SECRET` and `ALLOWED_ORIGINS`.


### Fixed
- **Auth middleware gap**: `authenticateToken` middleware was missing from all CRUD routes (income, expense, budget, savings, bills, bill-payments, admin). Any unauthenticated request could previously read or modify any user's data.
- **Ownership verification**: Added `userId` ownership check on every CRUD endpoint — a logged-in user can no longer read or modify another user's records (returns 403).
- **Hardcoded JWT secret**: Backend previously fell back to the literal string `'your_jwt_secret'` when `JWT_SECRET` env var was not set. Server now crashes at startup with a clear error if the var is missing.
- **API header merge bug**: `apiRequest()` spread `...options` after the merged `headers` object, silently overwriting the `Authorization: Bearer` header on every request. Fixed by destructuring `options.headers` out before the spread.
- **Auto-logout on 401**: Frontend now clears the persisted session and returns a user-friendly message when the server responds with 401.
- **JWT expiry check**: `checkSession()` now decodes the JWT payload and checks the `exp` claim locally — expired or malformed tokens are cleared on app load rather than waiting for a server rejection.
- **`ApiUser.role` type**: Narrowed from `string` to `'admin' | 'user'` to match the actual backend ENUM, fixing a TypeScript lint error in `UserManagement.tsx`.
- **UserManagement React import bug**: Fixed `React.useEffect` usage without importing `React` in `UserManagement.tsx`; replaced with direct `useEffect` import.
- **JWT auth token not sent**: Fixed "Access Token Required" error on User Management and all protected API endpoints. Root cause: frontend never stored or sent the JWT token from login/register. Now `authStore` persists the token and `apiRequest` attaches `Authorization: Bearer` header on every request. Backend register endpoint also returns a JWT token (login already did).

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

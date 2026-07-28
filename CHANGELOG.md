# Changelog

All notable changes to **My Local Wallet** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.7.0] — 2026-07-28

### Added
- **Planning workspace**: Track assets, liabilities, debts, receivables, due dates, interest, and payment history.
- **Smart categorization rules**: Expense names can automatically select a matching category.
- **Budget rollover**: Optionally carry a positive remaining category budget into the next month.
- **Notifications**: In-app alerts for upcoming bills and debts plus budget threshold warnings.
- **SMTP delivery**: Optional automatic email alerts with configurable scan interval and a test-email action.
- **Expense receipts**: Attach and download JPG, PNG, WebP, or PDF evidence up to 5 MB.
- **Receipt preview**: Preview images and PDFs before saving an expense or from the expense table.
- **Activity and trash**: Finance changes are recorded and deleted records remain restorable for 30 days.

### Changed
- **Backup version 4**: Net worth, debts, debt payments, and categorization rules are included in JSON export and atomic restore.
- **Receipt persistence**: Receipt metadata survives expense deletion and reconnects when the expense is restored.
- **Dependent restore**: Bill and debt payment history is preserved when its parent record is deleted and restored.

### Security
- **Upload restrictions**: Receipt uploads enforce an allowlist, single-file requests, and a 5 MB size limit.
- **SMTP hardening**: Nodemailer file and URL access are disabled.
- **Planning validation**: Dates, enum values, money values, and text lengths are validated or sanitized server-side.

---

## [1.6.0] — 2026-07-28

### Added
- **Server-side sessions**: Login now creates revocable opaque sessions stored in MySQL.
- **CSRF protection**: Authenticated mutations require a per-session CSRF token.
- **Atomic backup restore**: Validated backups are restored in a single MySQL transaction with rollback on failure.
- **Encrypted backups**: JSON backup files can be protected with password-derived AES-256-GCM encryption.
- **Versioned migrations**: Database schema changes and finance query indexes are tracked in `schema_migrations`.

### Changed
- **HttpOnly authentication**: Browser sessions use `HttpOnly`, `SameSite` cookies instead of JWTs in local storage.
- **Immediate privilege updates**: Role changes are read from MySQL on every request; password, role, and TFA resets revoke active sessions.
- **Per-user local backups**: Browser backup keys are namespaced by user ID.
- **Backend modules**: Database, migrations, sessions, CRUD, backup validation, and restore routes are split by responsibility.
- **Smaller finance store**: Restore orchestration moved from the browser store to the backend transaction endpoint.

### Security
- **No browser-readable access token**: XSS can no longer extract a long-lived API bearer token from `localStorage`.
- **Session revocation**: Administrative password, role, and TFA changes invalidate existing sessions immediately.
- **Relational restore validation**: Invalid or cross-record backup references are rejected before existing data is touched.

---

## [1.5.0] — 2026-07-28

### Added
- **Authenticator TFA**: Users can enable TOTP two-factor authentication from Settings using a QR code or manual setup key.
- **Recovery codes**: Eight one-time recovery codes are generated on enrollment and stored only as keyed hashes.
- **Two-step login**: TFA-enabled accounts complete a short-lived verification challenge before receiving an access token.
- **Admin TFA reset**: Administrators can see TFA status and reset it for users who lose access to their authenticator.
- **TFA cryptography tests**: Added RFC 6238 verification, encrypted-secret, and recovery-code tests.

### Security
- **Encrypted TOTP secrets**: Authenticator secrets are protected at rest with AES-256-GCM.
- **Scoped JWTs**: Setup and login challenges cannot be used as normal API access tokens.
- **Rate-limited verification**: Password login and second-factor verification share the authentication rate limiter.
- **Admin-only registration API**: User creation now requires an authenticated administrator and no longer replaces the admin's active session.

---

## [1.4.0] — 2026-07-28

### Added
- **MySQL savings targets**: Savings targets now persist per user in the backend instead of browser local storage.
- **Backup schema validation**: JSON backups are size-limited and validated before existing data is changed; version 2 backups remain compatible.
- **Automated tests**: Added validation and backup-format tests using Node's built-in test runner.

### Changed
- **Bilingual UI**: Language selection is intentionally limited to Bahasa Indonesia and English.
- **Smaller initial bundle**: Pages are route-split, while PDF and Excel engines load only when an export is requested.
- **Lightweight XLSX export**: Replaced the unpatched SheetJS npm package with a small native workbook generator while preserving all five report sheets.
- **Runtime translation flow**: The i18n watcher stays alive, writes to the locale volume used by Nginx, and preserves curated English translations.
- **Backup version 3**: Savings targets and linked savings transaction references are included in exports.

### Security
- **Token-derived ownership**: User data endpoints no longer accept a user ID in list URLs or create payloads.
- **Reference isolation**: Linked savings, bills, and bill payments must belong to the authenticated user.
- **Safer updates**: Foreign records return 404, update validation is enforced, and complete records are returned after updates.
- **Dependency hardening**: Updated vulnerable PDF, build, lint, and backend packages; replaced the vulnerable router and spreadsheet packages. Frontend and backend npm audits now report zero vulnerabilities.

### Fixed
- **Docker login via 127.0.0.1**: Added the local origin and configured Express proxy trust for Nginx.
- **i18n watcher restart loop**: Replaced the one-shot command with a persistent interval worker.
- **Storage messaging**: Settings now accurately describes MySQL primary storage and local backups.

---

## [1.3.1] — 2026-03-28

### Added
- **Admin password reset**: Administrators can now change user passwords directly from the User Management page via an inline modal (Key icon button). This allows admins to reset passwords for any user except themselves.

### Changed
- **Registration flow moved**: User registration is now only available through the User Management page as an inline modal for admins. The standalone `/register` page has been removed. Non-admin users can no longer self-register; only administrators can create new user accounts.
- **User Management modal localized**: The "Add New User" modal in User Management page is now in English with improved styling (glass-card effect, smooth animations).
- **Created At display fixed**: Fixed bug where user creation dates were not displaying correctly due to timezone issues. Backend now returns `createdAt` as a date string (YYYY-MM-DD) based on the server's local timezone. Frontend displays it in DD/MM/YYYY format, ensuring the date matches what the server shows regardless of the client's timezone.
- **Insights page translations improved**: Fixed hardcoded "Insights" section title by adding `insights_insights` translation key. Changed English `insights_title` from "Where's My Money" to "Spending Insights" for better professionalism. Indonesian translations remain natural ("Kemana Uang Saya").

---

## [1.2.2] — 2026-03-26

### Fixed
- **401 logout sync**: When API returns 401, `apiRequest` now calls `unauthorizedHandler` which triggers `authStore.logout()` to ensure frontend state matches the cleared localStorage. Prevents "Access Token Required" errors on retry after token expiry.

---

## [1.2.1] — 2026-03-26

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

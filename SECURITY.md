# Contributing to My Local Wallet

Thanks for your interest in contributing to **My Local Wallet**! Bug fixes, new features, translations, and documentation improvements are all welcome.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Branching Strategy](#branching-strategy)
- [Making Changes](#making-changes)
- [Code Style](#code-style)
- [Working with i18n / Translations](#working-with-i18n--translations)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)
- [Security Issues](#security-issues)
- [What NOT to Commit](#what-not-to-commit)

---

## Getting Started

1. **Fork** this repository
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/your-username/my-local-wallet.git
   cd my-local-wallet
   ```
3. Add the upstream remote:
   ```bash
   git remote add upstream https://github.com/afatyoo/my-local-wallet.git
   ```

---

## Development Setup

### Requirements

- **Node.js 18+** (Docker uses Node 20)
- **MySQL 8.0+**
- **Docker + Docker Compose** (recommended for full stack)

---

### Option A — Docker (Recommended)

```bash
cp .env.example .env
# Edit .env with your MySQL credentials
docker compose up -d --build
```

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:3000/api/health`

---

### Option B — Local Development (no Docker)

**Backend:**
```bash
cd backend
npm install
MYSQL_HOST=127.0.0.1 MYSQL_PORT=3306 MYSQL_USER=root MYSQL_PASSWORD=your_password MYSQL_DATABASE=finance_db npm run dev
```

**Frontend** (new terminal):
```bash
npm install
export VITE_API_URL="http://localhost:3001/api"
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

---

## Project Structure

```
my-local-wallet/
├─ src/                  # React app (frontend)
├─ backend/              # Express API + MySQL schema
├─ docker-compose.yml    # Full stack containers
├─ nginx.conf            # Reverse proxy /api -> backend
├─ Dockerfile            # Frontend build image
├─ backend/Dockerfile    # Backend image
├─ .env.example          # Env template
└─ README_DOCKER.md      # Docker quick notes
```

---

## Branching Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Stable, production-ready code |
| `dev` | Active development |
| `feature/<name>` | New features |
| `fix/<name>` | Bug fixes |
| `docs/<name>` | Documentation only |
| `i18n/<lang>` | Translation contributions |

Always branch off from `dev`:

```bash
git checkout dev
git pull upstream dev
git checkout -b feature/my-feature
```

---

## Making Changes

- Keep PRs **focused** — one feature or fix per PR
- Write clear **commit messages**:
  ```
  feat: add dark mode toggle
  fix: correct budget calculation for multi-month view
  docs: update Docker setup instructions
  i18n: add missing keys for Japanese locale
  ```
- If you add a new feature, **update the README** accordingly
- If you add a new env variable, **update `.env.example`**
- If you change an API endpoint, **update the API summary** in the README

---

## Code Style

### Frontend (React + TypeScript)
- Use **TypeScript** — avoid `any` where possible
- Use **functional components** with hooks
- State management via **Zustand**
- Styling via **Tailwind CSS** utility classes
- Follow existing component structure in `src/`

### Backend (Node.js + Express)
- Use `async/await` — avoid raw `.then()` chains
- Always validate and sanitize user input
- Never log passwords, tokens, or sensitive data
- Keep route handlers thin — move logic to service/helper functions

---

## Working with i18n / Translations

The source of truth for translations is:

```
src/locales/id.json
```

### To add or update translations:

1. Add/update keys in `src/locales/id.json`
2. Run the app or the sync script:
   ```bash
   npm run i18n:sync      # sync missing keys to other locales
   npm run i18n:translate # auto-translate new keys
   npm run i18n:auto      # sync + translate in one step
   ```
3. Review the auto-translated output — machine translations may need manual correction

### Want to improve a specific language?

Edit the file directly:
```
src/locales/en.json
src/locales/ja.json
src/locales/zh.json
# etc.
```

Then open a PR with the label `i18n`.

---

## Submitting a Pull Request

1. Push your branch to your fork:
   ```bash
   git push origin feature/my-feature
   ```
2. Open a **Pull Request** against the `dev` branch
3. Fill in the PR description:
   - **What** does this change do?
   - **Why** is it needed?
   - **How** was it tested?
   - Any **breaking changes** or migration notes?
4. Be responsive to review feedback

---

## Reporting Bugs

Please open an issue and include:

- A clear **title** and **description** of the bug
- **Steps to reproduce**
- **Expected** vs **actual** behavior
- Your environment:
  - Node.js version (`node -v`)
  - Browser and version
  - Docker version (if applicable)
  - OS
- Any relevant **console errors** or **network responses**

---

## Requesting Features

Open an issue with the label `enhancement` and describe:

- The **use case** or problem you're solving
- Your **proposed solution**
- Any **alternatives** you've considered

---

## Security Issues

**Do not open a public issue for security vulnerabilities.**

Please report privately via email: [afatyo.ajeung@gmail.com](mailto:afatyo.ajeung@gmail.com)

---

## What NOT to Commit

Make sure your `.gitignore` covers these:

```
.env                # Contains DB passwords and secrets
node_modules/
dist/
backend/dist/
```

---

## Thank You

Every contribution helps make **My Local Wallet** better for everyone. 🙌

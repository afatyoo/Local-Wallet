# 💰 Personal Finance Manager

A personal finance management application with **two deployment options**:
1. **Local-first mode**: All data stored in browser using IndexedDB
2. **Server mode**: Full-stack with MySQL database backend

![Finance App](https://img.shields.io/badge/React-18.3-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-3.4-teal) ![Vite](https://img.shields.io/badge/Vite-5.0-purple) ![MySQL](https://img.shields.io/badge/MySQL-8.0-orange) ![Docker](https://img.shields.io/badge/Docker-Ready-blue)

---

## 📋 Table of Contents

- [Key Features](#-key-features)
- [Technology Stack](#-technology-stack)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [Docker Deployment](#-docker-deployment)
- [MySQL Backend Setup](#-mysql-backend-setup)
- [Folder Structure](#-folder-structure)
- [User Guide](#-user-guide)
- [Contributing](#-contributing)

---

## ✨ Key Features

### 🔐 Authentication
- **Register & Login** with username and password
- Passwords are hashed using **bcrypt** for security
- Session stored in localStorage
- Supports both local (IndexedDB) and server (MySQL) authentication

### 📊 Dashboard
- Financial summary: total income, expenses, balance, savings
- Bar chart: Income vs Expenses (last 6 months)
- Pie chart: Expense distribution by category
- Recent transactions
- **Financial Health Score** widget
- Automatic **Backup Reminder**

### 💵 Income Management
- CRUD income transactions
- Custom categories (Salary, Bonus, Freelance, etc.)
- Payment methods (Cash, Transfer, E-Wallet, etc.)
- Filter by month

### 💸 Expense Tracking
- CRUD expense transactions
- Custom categories (Food, Transport, Entertainment, etc.)
- Track by category and payment method
- Filter by month

### 📅 Bills Management
- Manage recurring monthly bills
- Due date tracking
- Status: Unpaid, Paid, Overdue
- Active period (start - end or ongoing)

### 🎯 Budget Planning
- Set budget limits per category per month
- Track usage vs limits
- Visual progress bar
- Alerts when approaching/exceeding limits

### 🐷 Savings & Investments
- Track deposits and withdrawals
- Separate Savings and Investments
- Balance per account
- Total portfolio value

### 🎯 Savings Targets
- Create savings goals with deadlines
- Link to existing savings accounts
- **Progress bar** with percentage
- **Automatic milestones** (25%, 50%, 75%, 100%)
- Monthly requirement estimation
- Insights and recommendations

### 🔥 Expense Heatmap Calendar
- Calendar visualization of daily expenses
- Color intensity based on amount:
  - ⬜ White/Gray: No expenses
  - 🟢 Green: Low
  - 🟡 Yellow: Medium
  - 🟠 Orange: High
  - 🔴 Red: Very High
- Click date for transaction details
- Insights: most expensive day, zero-expense days, daily average

### 📈 Where My Money Goes (Insights)
- Expense analysis by category
- Interactive pie chart
- Click category to view transactions
- **Automatic insights**:
  - Largest category percentage
  - Highest spending category
  - Top 3 expenses

### 💪 Financial Health Score
Score from 0-100 based on 4 factors:

| Factor | Points | Calculation |
|--------|--------|-------------|
| **Saving Ratio** | 40 | (Total savings / total income) × 100 |
| **Budget Discipline** | 30 | Number of categories not over budget |
| **Spending Stability** | 20 | Comparison vs previous month |
| **Consistency** | 10 | Number of active recording days |

**Status:**
- 🟢 80-100: Healthy
- 🟡 60-79: Moderate
- 🔴 < 60: Needs Attention

### 📊 Reports
- Income vs expense charts
- Expense trends
- **Export to PDF**

### ⚙️ Master Data
- Manage income categories
- Manage expense categories
- Manage payment methods

### 🔧 Settings
- **Theme**: Light / Dark Mode
- **Language**: 6 languages supported
  - 🇮🇩 Indonesian
  - 🇺🇸 English
  - 🇨🇳 Chinese (中文)
  - 🇪🇸 Spanish (Español)
  - 🇸🇦 Arabic (العربية)
  - 🇮🇳 Hindi (हिन्दी)
- **Export Data**: Download JSON backup
- **Import Data**: Restore from backup
- **Auto Backup**: Automatic save to localStorage
- **Quick Backup**: One-click backup to file

---

## 🛠 Technology Stack

| Category | Technology |
|----------|------------|
| **Frontend** | React 18 + TypeScript |
| **Build Tool** | Vite 5 |
| **Styling** | Tailwind CSS + shadcn/ui |
| **State Management** | Zustand |
| **Local Database** | IndexedDB (idb) |
| **Server Database** | MySQL 8.0 |
| **Backend** | Node.js + Express |
| **Routing** | React Router v6 |
| **Charts** | Recharts |
| **PDF Export** | jsPDF + jspdf-autotable |
| **Date Handling** | date-fns |
| **Password Hashing** | bcryptjs |
| **Containerization** | Docker + Docker Compose |

---

## 🏗 Architecture

### Option 1: Local-First (IndexedDB)

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Pages     │  │ Components  │  │   Hooks     │          │
│  │  - Dashboard│  │  - AppLayout│  │  - useBackup│          │
│  │  - Income   │  │  - Cards    │  │  - useTheme │          │
│  │  - Expense  │  │  - Charts   │  │  - useHealth│          │
│  │  - etc...   │  │  - Forms    │  │  - etc...   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────┐        │
│  │              ZUSTAND STORES                      │        │
│  │  - authStore (user session)                      │        │
│  │  - financeStore (income, expense, budget, etc)   │        │
│  └─────────────────────────────────────────────────┘        │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────┐        │
│  │              IndexedDB (Browser)                 │        │
│  │  - users, incomes, expenses, budgets             │        │
│  │  - savings, bills, billPayments, masterData      │        │
│  └─────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Option 2: Full-Stack (MySQL Backend)

```
┌─────────────────────────────────────────────────────────────┐
│                      DOCKER COMPOSE                          │
│  ┌─────────────────────────────────────────────────┐        │
│  │  Frontend (Nginx)         :3000                 │        │
│  │  React + Vite Production Build                  │        │
│  └─────────────────────────────────────────────────┘        │
│                           │                                  │
│                           ▼ HTTP API                         │
│  ┌─────────────────────────────────────────────────┐        │
│  │  Backend (Express.js)     :3001                 │        │
│  │  REST API Server                                │        │
│  │  - /api/auth/* (login, register)               │        │
│  │  - /api/incomes/*                              │        │
│  │  - /api/expenses/*                             │        │
│  │  - /api/budgets/*                              │        │
│  │  - /api/savings/*                              │        │
│  │  - /api/bills/*                                │        │
│  │  - /api/master_data/*                          │        │
│  └─────────────────────────────────────────────────┘        │
│                           │                                  │
│                           ▼ mysql2                           │
│  ┌─────────────────────────────────────────────────┐        │
│  │  MySQL 8.0               :3306                  │        │
│  │  Persistent Volume: mysql_data                  │        │
│  │  Tables: users, incomes, expenses, budgets,     │        │
│  │          savings, bills, bill_payments,         │        │
│  │          master_data                            │        │
│  └─────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Installation

### Prerequisites
- Node.js 18+ 
- npm or bun

### Installation Steps

```bash
# 1. Clone repository
git clone <repository-url>
cd finance-manager

# 2. Install dependencies
npm install
# or
bun install

# 3. Run development server
npm run dev
# or
bun dev

# 4. Open in browser
# http://localhost:5173
```

### Build for Production

```bash
# Build
npm run build

# Preview production build
npm run preview
```

---

## 🐳 Docker Deployment

### Option 1: Frontend Only (Local IndexedDB)

For simple deployment with browser-based storage:

```bash
# Build and run frontend only
docker build -t finance-manager .
docker run -d -p 3000:80 --name finance-app finance-manager

# Access at http://localhost:3000
```

### Option 2: Full-Stack with MySQL (Recommended)

For persistent server-side storage with MySQL database:

```bash
# Build and run all services
docker-compose up -d --build

# Services:
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:3001
# - MySQL: localhost:3306

# Stop all services
docker-compose down

# Stop and remove data
docker-compose down -v
```

---

## 🗄 MySQL Backend Setup

### Docker Compose Configuration

The `docker-compose.yml` includes three services:

```yaml
version: '3.8'

services:
  # Frontend (React + Nginx)
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    depends_on:
      - backend

  # Backend API (Express.js)
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - MYSQL_HOST=mysql
      - MYSQL_PORT=3306
      - MYSQL_USER=finance_user
      - MYSQL_PASSWORD=finance_password
      - MYSQL_DATABASE=finance_db
    depends_on:
      mysql:
        condition: service_healthy

  # MySQL Database
  mysql:
    image: mysql:8.0
    ports:
      - "3306:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=root_password
      - MYSQL_DATABASE=finance_db
      - MYSQL_USER=finance_user
      - MYSQL_PASSWORD=finance_password
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  mysql_data:
```

### MySQL Credentials

| Setting | Default Value |
|---------|---------------|
| Host | `mysql` (Docker) / `localhost` (external) |
| Port | `3306` |
| Database | `finance_db` |
| Username | `finance_user` |
| Password | `finance_password` |
| Root Password | `root_password` |

### Customizing MySQL Connection

To use your own MySQL server, update the environment variables in `docker-compose.yml`:

```yaml
backend:
  environment:
    - MYSQL_HOST=your-mysql-host
    - MYSQL_PORT=3306
    - MYSQL_USER=your-username
    - MYSQL_PASSWORD=your-password
    - MYSQL_DATABASE=your-database
```

Or run backend without Docker:

```bash
cd backend
MYSQL_HOST=localhost \
MYSQL_USER=your-user \
MYSQL_PASSWORD=your-pass \
MYSQL_DATABASE=finance_db \
npm start
```

### Database Schema

Tables are automatically created on first run:

| Table | Description |
|-------|-------------|
| `users` | User accounts with hashed passwords |
| `incomes` | Income transactions |
| `expenses` | Expense transactions |
| `budgets` | Monthly budget limits per category |
| `savings` | Savings and investment records |
| `bills` | Recurring bill definitions |
| `bill_payments` | Bill payment history |
| `master_data` | Categories and payment methods |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/auth/register` | POST | Register new user |
| `/api/auth/login` | POST | Login user |
| `/api/incomes/:userId` | GET | Get all incomes |
| `/api/incomes` | POST | Create income |
| `/api/incomes/:id` | PUT | Update income |
| `/api/incomes/:id` | DELETE | Delete income |
| `/api/expenses/*` | CRUD | Expense operations |
| `/api/budgets/*` | CRUD | Budget operations |
| `/api/savings/*` | CRUD | Savings operations |
| `/api/bills/*` | CRUD | Bill operations |
| `/api/bill_payments/*` | CRUD | Bill payment operations |
| `/api/master_data/*` | CRUD | Master data operations |

### Backend Folder Structure

```
backend/
├── Dockerfile          # Backend Docker image
├── package.json        # Node.js dependencies
└── server.js           # Express.js API server
```

---

### Cloud Deployment

#### Deploy to VPS (Ubuntu)

```bash
# 1. SSH to server
ssh user@your-server-ip

# 2. Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 3. Clone repository
git clone <repository-url>
cd finance-manager

# 4. Build and run (with MySQL)
docker-compose up -d --build

# 5. (Optional) Setup reverse proxy with Nginx
sudo apt install nginx
# Configure nginx to forward to port 3000
```

#### Deploy to Railway

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Deploy
railway up
```

#### Deploy to Vercel (Frontend Only)

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Deploy
vercel
```

#### Deploy to Netlify (Frontend Only)

```bash
# 1. Install Netlify CLI
npm install -g netlify-cli

# 2. Build
npm run build

# 3. Deploy
netlify deploy --prod --dir=dist
```

---

## 📁 Folder Structure

```
src/
├── components/          # Reusable components
│   ├── ui/              # shadcn/ui components
│   ├── AppLayout.tsx    # Main layout with sidebar
│   ├── BackupReminder.tsx
│   ├── HealthScoreWidget.tsx
│   ├── QuickBackupButton.tsx
│   └── ProtectedRoute.tsx
│
├── hooks/               # Custom React hooks
│   ├── useBackup.ts     # Backup & restore logic
│   ├── useExpenseHeatmap.ts  # Heatmap calculations
│   ├── useExpenseInsights.ts # Expense analysis
│   ├── useFinancialHealth.ts # Health score calculation
│   ├── useSavingsTargets.ts  # Target management
│   └── useTheme.ts      # Theme switcher
│
├── lib/                 # Utilities & configurations
│   ├── db.ts            # IndexedDB schema & operations
│   ├── i18n.ts          # Translations (6 languages)
│   ├── pdfGenerator.ts  # PDF export logic
│   └── utils.ts         # Helper functions
│
├── pages/               # Page components
│   ├── Dashboard.tsx
│   ├── Income.tsx
│   ├── Expense.tsx
│   ├── Bills.tsx
│   ├── Budget.tsx
│   ├── Savings.tsx
│   ├── Targets.tsx      # Savings targets
│   ├── Heatmap.tsx      # Expense heatmap
│   ├── Insights.tsx     # Expense analysis
│   ├── HealthScore.tsx  # Health score
│   ├── Reports.tsx
│   ├── MasterData.tsx
│   ├── Settings.tsx
│   ├── Login.tsx
│   ├── Register.tsx
│   └── NotFound.tsx
│
├── stores/              # Zustand state management
│   ├── authStore.ts     # User authentication
│   └── financeStore.ts  # Financial data
│
├── App.tsx              # Root component & routing
├── main.tsx             # Entry point
└── index.css            # Global styles & design tokens
```

---

## 📖 User Guide

### 1. Registration & Login
1. Open the application
2. Click "Register" to create a new account
3. Enter username and password
4. Login with your credentials

### 2. Initial Setup
1. Go to **Master Data**
2. Add income categories as needed
3. Add expense categories
4. Add payment methods

### 3. Start Recording
1. **Income**: Record salary, bonuses, or other income
2. **Expenses**: Record every expense transaction
3. **Bills**: Set up recurring monthly bills
4. **Budget**: Set spending limits per category

### 4. Monitor Your Finances
- Check **Dashboard** for summary
- View **Insights** for category analysis
- Check **Heatmap** for daily patterns
- Monitor **Health Score** for financial condition

### 5. Savings Targets
1. Go to **Savings** and create a savings account
2. Go to **Savings Targets**
3. Create a new target (e.g., "Vacation", $10,000)
4. Link to savings account
5. Set target date
6. Monitor progress and milestones

### 6. Data Backup
- **Auto backup**: Data automatically saved to localStorage
- **Quick backup**: Click backup button in sidebar
- **Export**: Go to Settings → Export Data
- **Import**: Settings → Import Data (to restore)

---

## ⚠️ Important Notes

### Data Security

**Local Mode (IndexedDB):**
- All data is stored **locally** in the browser
- Clearing browser data will delete all application data
- **Regular backups** are highly recommended

**Server Mode (MySQL):**
- Data is stored in MySQL database
- Data persists in Docker volume `mysql_data`
- Data survives container restarts
- Backup MySQL data regularly

**Both Modes:**
- Passwords are hashed with bcrypt
- Use strong passwords

### Limitations

**Local Mode:**
- Data does not sync across devices
- No automatic cloud backup
- Capacity depends on browser IndexedDB quota

**Server Mode:**
- Requires Docker or MySQL server
- API must be accessible from frontend

### Browser Support
- Chrome 80+
- Firefox 75+
- Safari 14+
- Edge 80+

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

MIT License - Free to use for personal and commercial purposes.

---

## 🙏 Credits

Built with ❤️ using:
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Zustand](https://zustand-demo.pmnd.rs/)
- [Recharts](https://recharts.org/)
- [Lovable](https://lovable.dev/)

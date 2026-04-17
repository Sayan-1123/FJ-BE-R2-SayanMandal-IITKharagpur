# Personal Finance Tracker

AI-Powered Personal Finance Tracker built with Node.js, Express, and PostgreSQL.

## Features

### Core (Day 1-2)
- **User Authentication** — Register, login, JWT-based sessions, profile management
- **Category Management** — Income/expense categories with icons and colors
- **Transaction CRUD** — Add, edit, delete transactions with validation
  - Handles negative amounts (refunds)
  - Category deletion moves transactions to "Uncategorized"
  - DECIMAL(15,2) for financial precision
- **Dashboard** — Real-time overview with Chart.js visualizations
- **Reporting** — Monthly income vs expenses, category breakdowns, trends
- **Budgeting** — Set budget goals with progress tracking and alerts

### Additional (Day 3)
- **Google OAuth** — Sign in with Google, account linking
- **Email Notifications** — Budget alerts and anomaly notifications via SendGrid/SMTP
- **Receipt Uploading** — Attach images/PDFs to transactions
- **Multi-Currency** — 30+ currencies with live exchange rates

### Extra Credit (Part B)
- **OpenAI Integration** — Financial insights, chatbot, auto-categorization
- **Bank Statement Import** — CSV/PDF upload with auto-parsing and deduplication
- **Anomaly Detection** — Statistical Z-score, IQR, and spike detection

## Tech Stack
- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL, Sequelize ORM
- **Auth:** JWT, Passport.js, Google OAuth 2.0
- **Frontend:** Vanilla HTML/CSS/JS, Chart.js
- **AI:** OpenAI GPT-4o-mini
- **Email:** Nodemailer, SendGrid

## Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### Installation

```bash
# Clone the repo
git clone <repo-url>
cd personal-finance-tracker

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database credentials

# Create PostgreSQL database
createdb finance_tracker

# Start development server
npm run dev
```

### Environment Variables
See `.env.example` for all configuration options.

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Get profile |
| PUT | /api/auth/profile | Update profile |
| PUT | /api/auth/password | Change password |
| GET | /api/auth/google | Google OAuth |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/transactions | List (paginated, filtered) |
| POST | /api/transactions | Create |
| PUT | /api/transactions/:id | Update |
| DELETE | /api/transactions/:id | Delete |

### Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/categories | List |
| POST | /api/categories | Create |
| PUT | /api/categories/:id | Update |
| DELETE | /api/categories/:id | Delete |

### Budgets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/budgets | List with progress |
| POST | /api/budgets | Create |
| PUT | /api/budgets/:id | Update |
| DELETE | /api/budgets/:id | Delete |

### Dashboard & Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/dashboard | Financial overview |
| GET | /api/reports/monthly | Monthly report |
| GET | /api/reports/category | Category breakdown |
| GET | /api/reports/trends | Spending trends |
| GET | /api/reports/summary | Period summary |

### AI
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/ai/insights | AI financial insights |
| POST | /api/ai/chat | Financial chatbot |
| POST | /api/ai/categorize | Auto-categorize |
| GET | /api/ai/anomalies | Anomaly detection |
| POST | /api/ai/import-statement | Import bank statement |

### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/currencies | List currencies |
| GET | /api/currencies/convert | Convert amount |
| GET | /api/notifications | List notifications |
| POST | /api/receipts/:txId | Upload receipt |

## Project Structure

```
├── config/
│   ├── database.js      # Sequelize connection
│   ├── passport.js      # Auth strategies
│   └── multer.js        # File upload config
├── middleware/
│   ├── auth.js          # JWT authentication
│   ├── validation.js    # Request validation
│   ├── errorHandler.js  # Error handling
│   └── rateLimiter.js   # Rate limiting
├── models/
│   ├── User.js
│   ├── Category.js
│   ├── Transaction.js
│   ├── Budget.js
│   ├── Notification.js
│   └── index.js         # Associations
├── routes/
│   ├── auth.js
│   ├── categories.js
│   ├── transactions.js
│   ├── budgets.js
│   ├── dashboard.js
│   ├── reports.js
│   ├── notifications.js
│   ├── receipts.js
│   ├── currencies.js
│   └── ai.js
├── services/
│   ├── currencyService.js
│   ├── emailService.js
│   ├── aiService.js
│   ├── anomalyService.js
│   └── bankStatementService.js
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── api.js
│       ├── app.js
│       ├── auth.js
│       ├── components.js
│       ├── dashboard.js
│       ├── transactions.js
│       ├── budgets.js
│       ├── reports.js
│       └── ai.js
├── server.js
├── package.json
└── .env.example
```

## License
ISC

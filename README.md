# OpenSeller.ma - Moroccan Dropshipping Platform

A complete white-label dropshipping platform for cosmetics and dietary supplements in Morocco.

## 🚀 Features

- **Multi-role System**: Super Admin, Finance Admin, Vendor, Call Center Agent, Fulfillment Operator, Courier Partner, Supplier
- **Brand Designer**: Custom packaging design with Fabric.js canvas
- **Lead Management**: CSV import, auto-assignment, CRM workflow
- **Order Processing**: COD orders, status tracking, production workflow
- **Wallet System**: Instant credits, payout requests via RIB/ICE
- **Real-time Updates**: WebSocket notifications
- **PWA Support**: Offline-capable mobile app

## 📦 Tech Stack

### Backend
- Node.js 20+ with Express
- TypeScript
- PostgreSQL 16 with Prisma ORM
- Redis + BullMQ for queues
- Socket.io for real-time

### Frontend
- React 19
- TypeScript
- Tailwind CSS 4
- TanStack Query
- Vite

## 🛠️ Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 16
- Redis

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database
npm run db:seed

# Start development server
npm run dev
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## 📁 Project Structure

```
openseller/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma    # Database schema
│   │   └── seed.ts          # Demo data seeder
│   └── src/
│       ├── controllers/     # Request handlers
│       ├── middleware/      # Auth, error handling
│       ├── routes/          # API endpoints
│       ├── services/        # Business logic
│       ├── jobs/            # Background jobs
│       └── utils/           # Helpers
│
└── frontend/
    └── src/
        ├── components/      # Reusable UI
        ├── pages/           # Route pages
        ├── hooks/           # Custom hooks
        ├── lib/             # API, config
        ├── contexts/        # React contexts
        └── utils/           # Helpers
```

## 🔐 Demo Accounts

After running the seed:

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@openseller.ma | password123 |
| Vendor | vendor@openseller.ma | password123 |
| Agent | agent@openseller.ma | password123 |

## 📡 API Endpoints

### Auth
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

### Vendor
- `GET /api/v1/brands`
- `POST /api/v1/brands`
- `GET /api/v1/products`
- `GET /api/v1/leads`
- `POST /api/v1/leads/import`
- `GET /api/v1/orders`
- `GET /api/v1/wallet`

### Admin
- `GET /api/v1/admin/dashboard`
- `GET /api/v1/users`
- `PATCH /api/v1/payouts/:id/approve`

## 🇲🇦 Morocco-Specific

- Currency: MAD (Moroccan Dirham)
- Phone format: +212
- Cities: 20+ Moroccan cities seeded
- Banks: CIH, Banque Populaire, Attijariwafa, etc.
- RIB (24 digits) and ICE validation

## 📱 PWA

The app is PWA-ready:
- Offline support
- Push notifications
- Home screen install

## 🔧 Environment Variables

See `.env.example` for required variables:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `JWT_SECRET` - JWT signing key
- `SMTP_*` - Email configuration
- `TWILIO_*` - SMS configuration
- `WHATSAPP_*` - WhatsApp Business API

## 📄 License

MIT

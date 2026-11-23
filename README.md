# hotelapivaibhav

Hotel Management System Backend API.

## Features
- Express.js REST API
- Prisma ORM with PostgreSQL
- JWT Authentication & RBAC Middleware
- Controllers for Bookings, Rooms, Guests, Billing, Staff, Inventory, Maintenance, and Housekeeping

## Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL

### Installation
```bash
npm install
```

### Environment Configuration
Copy `.env.example` to `.env` and update your database credentials:
```bash
cp .env.example .env
```

### Database Setup
```bash
npx prisma generate
npx prisma db push
node prisma/seed.js
```

### Run Server
```bash
# Development mode
npm run dev

# Production mode
npm start
```

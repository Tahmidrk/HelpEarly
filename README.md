# At Your Service

> **Connecting households with trusted local service workers in Bangladesh — quickly, safely, and transparently.**

Current zero-budget implementation/deployment strategy and approval gates: [docs/FREE_STACK_STRATEGY.md](docs/FREE_STACK_STRATEGY.md). Render backend, existing Supabase migration/private media and live API tests passed; Vercel release, signed Android builds and real push/device verification remain pending.

Project roadmap: [operational completion, separate branding approvals, regression/device testing and signed APK/AAB release](docs/FREE_STACK_STRATEGY.md#project-roadmap-and-final-branding-approval-gates). Android visuals remain unchanged until the future branding phase is explicitly approved.

Render deployment: [actual service/build/runtime report](docs/RENDER_DEPLOYMENT.md). Production database/security/media changes were [approved and completed after verified production backup and isolated restore](docs/SUPABASE_RELEASE_APPROVAL.md).

Android UI preservation and website feature parity: [comparison, implementation and executed checks](docs/FEATURE_PARITY.md).

An academic software project (SDP II) — a web-based platform that enables households to discover, compare, and book verified local home service workers (plumbers, electricians, cleaners, carpenters, handymen, and more).

---

## Platform Overview

**At Your Service** solves a common problem in Bangladesh: households struggle to find reliable, nearby service workers, and skilled workers lack a dedicated platform to grow their income. This platform bridges that gap.

### Key Highlights

| Feature | Description |
|---|---|
| **Smart Recommendation** | Ranks helpers by distance, rating, price, availability & category match |
| **Emergency / Urgent Mode** | Broadcast urgent requests to all nearby available helpers |
| **Photo-Based Job Posts** | Upload photos of the problem so helpers understand before proposing |
| **In-App Chat** | Real-time Socket.io messaging between households and helpers |
| **Role-Based Access** | Separate dashboards for Households, Helpers, and Admins |
| **Advance Scheduling** | Book now or schedule for a future date |
| **Re-booking** | Quickly re-book a previously trusted helper |
| **Complaint System** | Report disputes — investigated by Admins |

---

## Features by Role

### Households
- Browse & filter verified helpers (category, location, rating, price, availability)
- Post jobs with photos, description, preferred date/time, and location
- Receive Smart Helper Recommendations
- Send emergency / urgent requests
- In-app chat with helpers before booking
- View booking history & re-book trusted helpers
- Rate and review completed services
- Submit complaints about workers or services

### Service Helpers
- Live job feed — receive nearby job alerts
- View job photos and submit price proposals
- Toggle availability on/off
- Manage active and completed bookings
- Track earnings and payment status
- Build reputation through ratings and reviews

### Admins
- Review and approve/reject helper registrations
- Platform analytics dashboard (users, bookings, revenue, categories)
- Account suspension, restriction, and ban management
- Complaint investigation and resolution
- Content and review moderation

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js + Vite + React Router |
| Backend | Node.js + Express.js |
| Database | Existing Supabase PostgreSQL; approved schema migration and preserved records verified |
| Real-Time | Socket.io |
| Authentication | JWT + bcrypt |
| Authorization | Role-Based Access Control (RBAC) |
| Styling | Vanilla CSS (Light + Dark Theme) |
| Push Notifications | Expo/FCM integration implemented; real credentials and delivery pending |
| Maps *(planned)* | Google Maps API + Expo Location |
| Media Storage | Private Supabase Storage behind the backend storage abstraction |

---

## Getting Started

### Prerequisites
- Node.js 22.13+
- PostgreSQL 14+

### 1. Setup Database

**Option A — Shared Online Database (Supabase/Render)**

Create one hosted PostgreSQL instance and share the connection string:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

Set this in `server/.env` on every machine. All bookings, accounts, chats, and complaints will be stored in the shared database.

**Option B — Local Database**

```bash
# Copy and edit env
cd server
cp .env.example .env

# Create the database and initialize its schema (existing records are preserved)
npm run db:create
npm run db:init
```

### 2. Start the Server

```bash
cd server
npm install
node server.js
# or for dev: npm run dev
```

Server runs on `http://localhost:5000`

### 3. Start the Client

```bash
cd client
npm install
npm run dev
```

Client runs on `http://localhost:5173`

---

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Household | fatima@example.com | test123 |
| Helper | rahim@example.com | test123 |
| Admin | admin@atyourservice.com | admin123 |

---

## Project Structure

```
at-your-service/
├── client/                   # React Frontend (Vite)
│   ├── public/               # Static assets (logo, favicon)
│   └── src/
│       ├── components/       # Reusable UI (Navbar, Footer, Cards, etc.)
│       ├── pages/            # Page views (Home, Dashboard, Chat, Admin, etc.)
│       ├── context/          # AuthContext (JWT + role management)
│       └── utils/            # API helpers, icon mapping
├── server/                   # Express.js Backend
│   ├── controllers/          # Route handler logic
│   ├── routes/               # API route definitions
│   ├── middleware/           # Auth (JWT) & file upload middleware
│   ├── db/                   # Schema, migrations & seed data
│   └── socket/               # Socket.io real-time chat
└── README.md
```

---

## API Endpoints (Summary)

Current live status: [Render/Supabase release report](docs/RENDER_DEPLOYMENT.md). Render Free, PostgreSQL preservation, private media and actual HTTP/WSS MVP checks passed. Existing Vercel still uses its unavailable Railway API until the approved redeployment completes; Vercel account sign-in is pending. Signed Android builds, physical-device testing, AI provider credentials and real push delivery remain pending. Earlier [production audit](docs/PRODUCTION_AUDIT.md), [deployment guide](docs/DEPLOYMENT.md) and [local completion report](docs/COMPLETION_REPORT.md) describe earlier states; use the current report for release status. [Physical Android checklist](docs/ANDROID_CHECKLIST.md).

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login and receive JWT |
| GET | `/api/helpers` | List helpers (with filters) |
| GET | `/api/helpers/:id` | Helper profile |
| POST | `/api/jobs` | Create a job post |
| GET | `/api/jobs` | Browse job listings |
| POST | `/api/bookings` | Create a booking |
| GET | `/api/bookings` | User's bookings |
| GET | `/api/messages` | Chat messages |
| POST | `/api/reviews` | Submit a review |
| POST | `/api/complaints` | Submit a complaint |
| GET | `/api/admin/*` | Admin management endpoints |

---

## Academic Context

- **Course**: CSE 4104 — Software Development Project II (SDP II)
- **Project Type**: Mobile-first web platform (prototype)
- **Constraint**: Realistic for a student development team; no unrealistic AI/ML claims — Smart Recommendation uses a transparent scoring algorithm (distance + rating + price + availability).

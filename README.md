# Vigility Analytics Dashboard

A self-referential product analytics dashboard — every interaction a user makes with the dashboard (filter changes, chart clicks) is tracked and fed back into the visualizations in real time.

**Live Demo:** https://vigility-frontend-sigma.vercel.app/

---

## Tech Stack

| Layer    | Technology                                 |
| -------- | ------------------------------------------ |
| Frontend | React 18, Vite, Chart.js, react-datepicker |
| Backend  | Node.js, Express.js                        |
| ORM      | Prisma (schema-first, no raw SQL)          |
| Database | PostgreSQL                                 |
| Auth     | JWT (jsonwebtoken) + bcryptjs              |
| Deploy   | Frontend → Vercel · Backend + DB → Render  |

---

## Features

- **JWT Authentication** — Register and login with hashed passwords. Token stored in localStorage.
- **Cookie-persisted Filters** — Date range, age group, and gender filters are saved to cookies. Refreshing the page restores your last selection automatically.
- **Bar Chart (Feature Usage)** — Horizontal bar chart showing total clicks per feature. Click any bar to drill into that feature's daily trend.
- **Line Chart (Daily Trend)** — Shows click count over time, filtered to the feature selected in the bar chart.
- **Self-tracking** — Every filter change and chart interaction fires `POST /api/track`, logging the event to the database. The dashboard literally watches itself being used.
- **Summary Cards** — Total clicks, unique users, and active feature count for the current filter context.
- **Data Seeding** — `npm run seed` populates the database with 10 users and 300 click events spread across the last 90 days.

---

## Local Setup

### Prerequisites

- Node.js >= 18
- PostgreSQL running locally (or a hosted instance)

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/vigility-dashboard.git
cd vigility-dashboard
```

### 2. Backend

> **Note:** Create the PostgreSQL database first:
>
> ```sql
> CREATE DATABASE vigility_db;
> ```
>
> Then `npx prisma db push` reads `prisma/schema.prisma` and creates all tables automatically — no SQL needed.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Set VITE_API_URL if your backend is not on localhost:5000
npm run dev       # Start Vite dev server on http://localhost:5173
```

**`.env` values:**

```env
VITE_API_URL=http://localhost:5000/api
```

---

## Seeding the Database

```bash
cd backend
npm run seed
```

This will:

1. Clear all existing `feature_clicks` and `users` data.
2. Insert 10 dummy users across different age groups and genders.
3. Insert 300 feature click events with randomised timestamps spread over the past 90 days, weighted so `date_filter` and `gender_filter` appear most frequently (realistic usage distribution).

**Test credentials after seeding:**

| Username | Password    | Age | Gender |
| -------- | ----------- | --- | ------ |
| alice    | password123 | 25  | Female |
| bob      | password123 | 34  | Male   |
| charlie  | password123 | 42  | Male   |

---

## API Reference

All protected routes require `Authorization: Bearer <token>` header.

| Method | Endpoint       | Auth | Description                              |
| ------ | -------------- | ---- | ---------------------------------------- |
| POST   | /api/register  | No   | Register a new user                      |
| POST   | /api/login     | No   | Login, returns JWT                       |
| POST   | /api/track     | Yes  | Record a feature interaction             |
| GET    | /api/analytics | Yes  | Fetch aggregated chart data with filters |
| GET    | /api/health    | No   | Health check                             |

### `GET /api/analytics` query params

| Param      | Values                              | Description                     |
| ---------- | ----------------------------------- | ------------------------------- |
| start_date | `YYYY-MM-DD`                        | Filter clicks from this date    |
| end_date   | `YYYY-MM-DD`                        | Filter clicks up to this date   |
| age_group  | `<18` · `18-40` · `>40` · `All`     | Filter by user age group        |
| gender     | `Male` · `Female` · `Other` · `All` | Filter by user gender           |
| feature    | any feature_name string             | Scope line chart to one feature |

---

## Deployment

### Backend → Render

1. Push backend to a GitHub repo.
2. Create a new **Web Service** on [Render](https://render.com).
3. Set the build command to `npm install` and start command to `npm start`.
4. Add a **PostgreSQL** instance on Render and copy the `DATABASE_URL` into environment variables.
5. Set `JWT_SECRET` and `FRONTEND_URL` (your Vercel URL) in environment variables.
6. After first deploy, run from Render's shell:
   ```bash
   npx prisma db push   # creates tables
   npm run seed         # loads dummy data
   ```

### Frontend → Vercel

1. Push frontend to a GitHub repo.
2. Import the repo on [Vercel](https://vercel.com).
3. Set `VITE_API_URL` to your Render backend URL (e.g. `https://vigility-api.onrender.com/api`).
4. Deploy.

---

## Architecture & Design Decisions

**Why raw SQL over an ORM?**  
The aggregation queries for the analytics endpoint benefit from hand-written SQL — grouping by date, joining on the users table for demographic filters, and building parameterised WHERE clauses dynamically. An ORM adds abstraction overhead that makes these kinds of queries harder to reason about and optimise. Using `pg` directly keeps things explicit.

**Why JWT over sessions?**  
The frontend is deployed separately from the backend (Vercel + Render). Stateless JWT auth avoids the need for a shared session store between the two services and makes horizontal scaling of the backend trivial.

**Why cookies for filter persistence?**  
The spec required filter state to survive a page refresh. Cookies outlive the React component lifecycle and survive hard refreshes, making them the right primitive here. `js-cookie` keeps the implementation clean. An alternative would be `localStorage`, but cookies have the advantage of being sent with requests automatically if we ever move filters server-side.

**Database indexes**  
Three indexes are created on `feature_clicks`: `user_id` (for JOIN performance), `timestamp` (for date range filtering), and `feature_name` (for GROUP BY performance). These are the three columns that every analytics query touches.

---

## Scaling to 1 Million Write-Events per Minute

The current architecture — a single Express server writing directly to PostgreSQL — would fall over well before reaching this throughput. PostgreSQL can comfortably handle thousands of writes per second, but a million events per minute (~16,700/sec) with a single-instance backend is a different problem entirely.

Here's how I'd evolve the architecture:

**1. Decouple writes from the database using a message queue.**  
Instead of writing every `POST /track` event directly to Postgres, I'd publish each event to a message queue — Apache Kafka or AWS SQS. The API responds immediately with a `202 Accepted`, and a pool of worker processes consumes from the queue and batch-inserts into the database. Batch inserts (e.g. 500 rows at a time) are dramatically more efficient than single-row inserts at scale. Kafka specifically gives us durable, replayable event logs, which is valuable for analytics use cases.

**2. Scale the write API horizontally behind a load balancer.**  
The Express service is stateless (JWT auth, no in-memory session), so spinning up multiple instances behind an AWS ALB or NGINX load balancer is straightforward. Kubernetes or ECS would handle auto-scaling based on CPU/request throughput.

**3. Use Redis for ephemeral counters and rate limiting.**  
Redis (already in my stack at Klimb) can absorb real-time counter increments using `INCR` at sub-millisecond latency. For the read side of the dashboard, we could cache aggregated analytics results in Redis with a short TTL (e.g. 30 seconds), so the `GET /analytics` queries aren't hammering Postgres on every page load from multiple users.

**4. Separate the read and write databases (CQRS pattern).**  
Write events go to a primary Postgres instance. Analytics reads are served from a read replica — or better yet, from a purpose-built OLAP store like ClickHouse or Amazon Redshift that's designed for aggregation queries over large event datasets. ClickHouse in particular handles hundreds of millions of rows with sub-second GROUP BY queries.

**5. Time-series partitioning on `feature_clicks`.**  
Even within Postgres, partitioning the `feature_clicks` table by month (using `PARTITION BY RANGE`) ensures that date-filtered queries only scan the relevant partition, keeping query times bounded as the dataset grows.

The core principle: the event ingestion path (write) and the analytics query path (read) have very different performance characteristics and should be optimised independently.

---

## Author

**Krishna Sharma**

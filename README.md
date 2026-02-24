# Order Management System

An event-driven Order Management System (OMS) built with Apache Kafka and the Saga Pattern.

## Architecture

Order flow follows a strict event-driven pattern:

1. **API (Next.js):** Receives the order and atomically writes to PostgreSQL, saving an `ORDER_CREATED` event into a local Outbox table. 
2. **Outbox Processor (CDC):** A background worker polls the Outbox table and pushes events to Kafka, ensuring at-least-once delivery.
3. **Saga Consumer:** Listens for `ORDER_CREATED` from Kafka and orchestrates Payment Processing and Inventory Reservation workflows. If a step fails, it triggers compensating transactions (e.g., cancellations/refunds) to maintain consistency. 
4. **CQRS Projection:** A secondary consumer listens to the event stream and updates a denormalized read-model (`orders_read`).
5. **Real-time Tracking:** The frontend subscribes to Server-Sent Events (SSE) from the API for status updates.

## Tech Stack

- **Frontend & API:** React, Next.js, Vercel
- **Database:** PostgreSQL (Neon)
- **Message Broker:** Apache Kafka (Aiven, configured with mTLS)
- **Background Workers:** Node.js (Back4App)
- **ORM:** Prisma Client

## Running Locally

**Prerequisites:**
- Node.js (v20+)
- Docker & Docker Compose

### 1. Boot Infrastructure
```bash
npm run infra:up
```
Starts PostgreSQL, Kafka, Zookeeper, and Kafka UI (`http://localhost:8080`).

### 2. Configure Environment
```bash
cp .env.example .env.local
```
The `.env.example` defaults are pre-mapped to the Docker containers.

### 3. Setup Database
```bash
npm run db:migrate
```

### 4. Start Application
Run these commands in two separate terminal windows:
```bash
# Terminal 1: Web App & API
npm run dev

# Terminal 2: Background workers
npm run worker:all
```

The application is accessible at `http://localhost:3000`.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/orders` | Create an order |
| `GET`  | `/api/orders` | List all orders (paginated) |
| `GET`  | `/api/orders/:id` | Get order details |
| `POST` | `/api/orders/:id/cancel` | Cancel an order |
| `GET`  | `/api/orders/:id/stream` | Stream status updates via SSE |

## Core Design Principles

- **Event-Driven:** The API drops events in the outbox and responds immediately. The web server never talks directly to external downstream systems.
- **Idempotency:** All Kafka consumers handle duplicate messages gracefully to guarantee data consistency during restarts.
- **At-least-once Delivery:** The Transactional Outbox pattern guarantees that committed local database transactions will always be pushed to downstream consumers.

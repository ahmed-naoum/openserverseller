# Technical Documentation & System Architecture

This document provides a deep dive into the technical architecture, data structures, and workflows of the SILACOD platform.

## 1. System Architecture

The system follows a decoupled architecture with a TypeScript-based full-stack environment.

```mermaid
graph TD
    subgraph Client_Side [Frontend - React/PWA]
        UI[React Components]
        State[Zustand/TanStack Query]
        SocketClient[Socket.io Client]
    end

    subgraph Server_Side [Backend - Node.js/Express]
        API[Express Router]
        Auth[Passport.js/JWT]
        ORM[Prisma ORM]
        Queue[BullMQ Workers]
        SocketServer[Socket.io Server]
    end

    subgraph Infrastructure
        DB[(PostgreSQL)]
        Redis[(Redis Cache/Queue)]
        Nginx[Nginx Reverse Proxy]
    end

    UI <--> API
    State <--> API
    SocketClient <--> SocketServer
    API <--> Auth
    API <--> ORM
    ORM <--> DB
    API <--> Queue
    Queue <--> Redis
    Nginx --> Client_Side
    Nginx --> API
```

## 2. Core Business Workflow (Lead to Order)

The lifecycle of a sale in the Moroccan dropshipping context:

```mermaid
sequenceDiagram
    participant V as Vendor
    participant S as System
    participant A as Call Center Agent
    participant C as Customer
    participant W as Warehouse

    V->>S: Import Leads (CSV)
    S->>S: Validate & Deduplicate
    S->>A: Auto-assign Lead (Round-robin)
    A->>C: Phone Call / WhatsApp
    alt Confirmed
        C-->>A: Confirms Order Details
        A->>S: Convert Lead to Order
        S->>V: Notify (Real-time)
        S->>W: Create Production Job
    else Rejected/No Answer
        A->>S: Update Lead Status
    end
    W->>S: Update Status (In Production -> Shipped)
    S->>C: WhatsApp Tracking Update
```

## 3. Database Schema Structure

The PostgreSQL schema is optimized for Moroccan e-commerce, supporting multiple roles and complex relationships.

```mermaid
erDiagram
    USER ||--o{ ROLE : has
    USER ||--o| USER_PROFILE : has
    USER ||--o{ BRAND : owns
    USER ||--o{ LEAD : manages
    USER ||--o{ ORDER : places
    USER ||--o{ WALLET : has
    
    BRAND ||--o{ PRODUCT : contains
    BRAND ||--o{ LEAD : receives
    BRAND ||--o{ ORDER : fulfills

    PRODUCT ||--o{ ORDER_ITEM : included_in
    PRODUCT ||--o{ INVENTORY : tracked_in
    
    LEAD ||--o| ORDER : converts_to
    
    ORDER ||--o{ ORDER_ITEM : contains
    ORDER ||--o{ ORDER_STATUS_HISTORY : logs
    ORDER ||--o| SHIPMENT : has

    SHIPMENT ||--o{ SHIPMENT_TRACKING_EVENT : tracks
```

## 4. Key Components & Services

### Security & Authentication
- **Passport.js**: Integrated for Google OAuth and JWT strategies.
- **Helmet & Rate Limiting**: Protection against common web vulnerabilities and brute-force attacks.
- **Audit Logging**: Every sensitive action (admin edits, balance updates) is logged.

### Communication Services
- **WhatsApp Business API**: Automated order confirmations, OTPs, and delivery updates.
- **Twilio SMS**: Fallback for verification codes.
- **Nodemailer**: Transactional emails for account updates.

### Queue Management (BullMQ)
Used for asynchronous processing to ensure high performance:
- `lead-assignment`: Distributes incoming leads to available agents.
- `notifications`: Handles real-time push and messaging.
- `order-processing`: Manages complex status transitions and wallet credits.

## 5. Deployment Information (Hostinger VPS)
- **Web Server**: Nginx (Reverse Proxy with SSL via Certbot)
- **Process Management**: PM2 (Auto-restart on failure)
- **PWA**: Offline-first strategy with Service Workers.

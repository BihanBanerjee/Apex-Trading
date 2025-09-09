# Trading Application Backend Architecture

## Overview
Building the backend of a trading application with high-speed execution and crash recovery capabilities.

## System Components

### 1. Price-Poller
- **Function**: WebSocket client connected to Backpack's WS server
- **Data Flow**: Receives real-time market data and forwards to Redis stream
- **Sample Data Format**:
```json
{
  data: {
    A: "6.9717",        // Best ask quantity
    B: "5.0264",        // Best bid quantity  
    E: 1757143198737843, // Event time
    T: 1757143198736215, // Transaction time
    a: "4303.93",       // Best ask price
    b: "4303.92",       // Best bid price
    e: "bookTicker",    // Event type
    s: "ETH_USDC_PERP", // Symbol
    u: 2063435950,      // Update ID
  },
  stream: "bookTicker.ETH_USDC_PERP",
}
```

### 2. HTTP API Server (Modular Architecture)
- **Structure**: Organized into controllers, middleware, and routes
- **Authentication**: Magic link authentication via email with JWT sessions
- **Endpoints**:
  - **Auth Routes** (`/api/v1/auth`): Magic link sending, token verification, logout
  - **Trading Routes** (`/api/v1/trade`): Create trade, close trade, place orders
  - **Account Routes** (`/api/v1/account`): Balance queries, supported assets
- **Function**: Processes user requests and sends instructions to engine via Redis stream
- **Communication**: Uses same Redis stream as price-poller for sending orders/instructions
- **Security**: HTTP-only cookies, JWT validation middleware for protected routes

### 3. Engine (Stateful Core)
- **Architecture**: In-memory state management for high-speed execution
- **State Variables**:
  - **Balances**: User balance data for all application users
  - **Open Orders**: All active orders (market, stop loss, take profit)
  - **Positions**: User positions with associated stop loss/take profit levels
  - **Prices**: Real-time asset prices (ETH, BTC, SOL) from price-poller
- **Performance**: Avoids database calls during execution for speed
- **Order Types Supported**:
  - **Market Orders**: Immediate execution at current market price
  - **Stop Loss Orders**: Automatic position closure when price hits stop level
  - **Take Profit Orders**: Automatic position closure when price hits profit target

### 4. Redis Streams & Worker Architecture
- **Single Primary Stream**: Handles all communication between components
- **Stream Message Types**:
  - `price_update`: Real-time prices from price-poller → Engine
  - `user_instruction`: Trading instructions from HTTP server → Engine
  - `order_response`: Processed order responses from Engine → Worker → HTTP server
  - `closed_order`: Completed orders from Engine → Worker → Database
- **Order Execution**: Instructions use the latest price available in stream
- **Worker Process**: Acts as intelligent message router consuming engine outputs

### 5. Crash Recovery System

#### Snapshot Mechanism
- **Frequency**: Every 10 seconds (async operation)
- **Storage**: PostgreSQL database with single-row UPSERT strategy
- **Performance**: Non-blocking async dumps (~20ms) - zero impact on trading performance
- **Data Structure**: JSONB format containing complete engine state
- **Schema**:
```sql
CREATE TABLE engine_snapshots (
  id INTEGER PRIMARY KEY DEFAULT 1,
  snapshot_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);
```
- **Strategy**: New snapshots replace old ones (single row maintenance)

#### Worker Process Architecture
- **Purpose**: Intelligent message router and I/O handler
- **Dual Function**:
  1. **Response Handler**: Routes `order_response` messages back to HTTP server for real-time frontend updates
  2. **Database Handler**: Processes `closed_order` messages and saves to database for historical records
- **Flow**: Engine → Single Stream → Worker → (HTTP Server | Database)
- **Performance**: Offloads all I/O operations from engine for maximum trading speed

#### Recovery Process
1. Load latest snapshot from PostgreSQL (t=0 state)
2. Replay all Redis stream events from snapshot time to crash time (t=0 to t=4)
3. Apply price updates and execute orders in chronological order
4. Restore engine to exact state at crash moment

### 6. Complete Order Processing Flow
1. **User Request**: HTTP server receives trading request
2. **Instruction Publishing**: Server sends `user_instruction` message to Redis stream
3. **Order Processing**: Engine consumes instruction and processes with latest available price
4. **Response Publishing**: Engine publishes `order_response` message to stream
5. **Response Routing**: Worker consumes response and forwards to HTTP server
6. **Frontend Notification**: HTTP server sends real-time response to frontend
7. **Order Completion**: For closed orders, Engine publishes `closed_order` message
8. **Historical Storage**: Worker consumes closed order and saves to database

### 7. Message Flow Architecture
```
Price-Poller ──┐
               ├──→ Redis Stream ──→ Engine ──→ Redis Stream ──┐
HTTP Server ───┘                                              ├──→ Worker ──┬──→ HTTP Server
                                                               │              └──→ Database
                                                               └──→ (Snapshots) ──→ PostgreSQL
```

### 8. User Onboarding & Balance Management
- **New User Detection**: First-time auth endpoint access triggers initial balance allocation
- **Initial Balance**: Engine receives instruction and allocates free starting balance (in-memory)
- **Balance Storage**: All user balances maintained in-memory for zero-latency trading
- **Balance Persistence**: Included in periodic snapshots for crash recovery

## Implementation Phases

### Phase 1 (Current Focus)
- Price-poller ✅
- HTTP server (auth complete, trading endpoints pending)
- Engine with core trading features:
  - Market orders
  - Stop loss orders
  - Take profit orders
  - Position management
- Worker process for response routing and database operations
- Redis stream communication

### Phase 2 (Future)  
- Real-time WebSocket connections to frontend
- Advanced analytics and reporting
- Multi-asset portfolio management
- Advanced order types (trailing stops, OCO orders)

## API Server Structure

### Directory Organization
```
apps/api/
├── controllers/           # Business logic
│   ├── authController.ts     # Magic link & JWT handling
│   ├── tradingController.ts  # Trade & order processing  
│   └── accountController.ts  # Balance & asset queries
├── middleware/           # Request processing
│   └── auth.ts              # JWT validation & user context
├── routes/              # HTTP endpoint definitions
│   ├── auth.ts             # Public auth endpoints
│   ├── trading.ts          # Protected trading endpoints
│   └── account.ts          # Protected account endpoints
└── index.ts             # Main server & route mounting
```

### Authentication Flow
1. **Magic Link Request**: User provides email → JWT token generated → Email sent via Resend
2. **Token Verification**: User clicks link → Token verified → Session cookie set (7 days)
3. **Protected Routes**: Cookie extracted → JWT validated → User context added to request

### API Endpoints Reference
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | ❌ | Server health check |
| `/api/v1/auth` | POST | ❌ | Send magic link email |
| `/api/v1/auth/verify` | GET | ❌ | Verify token & set session |
| `/api/v1/auth/logout` | DELETE | ❌ | Clear session cookie |
| `/api/v1/trade/create` | POST | ✅ | Create new trade |
| `/api/v1/trade/close` | POST | ✅ | Close existing trade |
| `/api/v1/trade/order` | POST | ✅ | Place market order |
| `/api/v1/account/balance/usd` | GET | ✅ | Get USD balance |
| `/api/v1/account/balance` | GET | ✅ | Get all balances |
| `/api/v1/account/assets` | GET | ✅ | Get supported assets |

## Technical Considerations
- **Assets Supported**: ETH, BTC, SOL, ADA
- **Data Source**: Backpack WebSocket server
- **Storage**: 
  - Redis for real-time streams and instructions
  - PostgreSQL for engine snapshots (single-row UPSERT)
  - PostgreSQL for historical closed orders (via worker process)
- **Performance**: 
  - In-memory processing for all trading operations
  - Zero database calls during trade execution
  - Async snapshots every 10s (~20ms, non-blocking)
- **Authentication**: Nodemailer email service, JWT tokens, HTTP-only cookies
- **Security**: CORS protection, secure cookies in production
- **Crash Recovery**: PostgreSQL snapshots + Redis stream replay
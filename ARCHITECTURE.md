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

### 2. HTTP Backend Server
- **Endpoints**: signup, signin, trade/create, trade/close, etc.
- **Function**: Processes user requests and sends instructions to engine via Redis stream
- **Communication**: Uses same Redis stream as price-poller for sending orders/instructions

### 3. Engine (Stateful Core)
- **Architecture**: In-memory state management for high-speed execution
- **State Variables**:
  - **Balances**: User balance data for all application users
  - **Open Orders**: All active orders that change with market conditions
  - **Prices**: Real-time asset prices (ETH, BTC, SOL) from price-poller
- **Performance**: Avoids database calls during execution for speed

### 4. Redis Streams
- **Primary Stream**: Contains both real-time prices and user instructions/orders
- **Order Execution**: Instructions get the latest price available in stream (price right before instruction)
- **Stream Structure**: Sequential mix of price updates and order instructions

### 5. Crash Recovery System

#### Snapshot Mechanism
- **Frequency**: Every 10 seconds
- **Storage**: Database dump of complete engine state (balances, open orders, prices)
- **Purpose**: Baseline state for recovery

#### Recovery Process
1. Load latest snapshot (e.g., t=0 state)
2. Replay all stream events from snapshot time to crash time (e.g., t=0 to t=4)
3. Apply price updates and execute orders in chronological order
4. Restore engine to exact state at crash moment

### 6. Order Processing Flow
1. HTTP server receives user request
2. Server sends instruction to Redis stream
3. Engine processes instruction with latest available price
4. **[Future Implementation]** Engine sends processed order to response stream
5. **[Future Implementation]** HTTP server receives response and notifies frontend
6. Closed orders dumped to database for historical records

## Implementation Phases

### Phase 1 (Current Focus)
- Price-poller
- HTTP server  
- Engine
- Basic Redis stream communication

### Phase 2 (Future)
- Response stream from engine to HTTP server
- Frontend notifications
- Order history management

## Technical Considerations
- **Assets Supported**: ETH, BTC, SOL
- **Data Source**: Backpack WebSocket server
- **Storage**: Redis for streams, Database for snapshots and closed orders
- **Performance**: In-memory processing, minimal database interactions during trading
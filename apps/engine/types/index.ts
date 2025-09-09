// Scaling factor for integer arithmetic (8 decimal places)
export const SCALE = 100_000_000; // 10^8

// Types for in-memory state
export interface Position {
    orderId: string;
    userId: string;
    asset: string;
    type: 'LONG' | 'SHORT';
    margin: number;           // In scaled integers
    leverage: number;
    entryPrice: number;       // In scaled integers
    quantity: number;         // In scaled integers
    stopLoss?: number;        // In scaled integers
    takeProfit?: number;      // In scaled integers
    timestamp: number;
    liquidationPrice: number; // In scaled integers
}

export interface UserBalance {
    userId: string;
    balance: number;          // In scaled integers (USD equivalent)
    lockedMargin: number;     // In scaled integers
}

export interface PriceData {
    symbol: string;
    price: number;            // In scaled integers
    timestamp: number;
}

export interface TradeCreateMessage {
    orderId: string;
    userId: string;
    asset: string;
    type: 'LONG' | 'SHORT';
    margin: number;
    leverage: number;
    slippage?: number;
}

export interface TradeCloseMessage {
    orderId: string;
    userId: string;
    action: 'CLOSE';
}

export interface PriceUpdateMessage {
    stream: string;
    data: {
        e: string; // event type
        s: string; // symbol
        b: string; // best bid
        a: string; // best ask
        [key: string]: any;
    };
}

export interface OrderResponse {
    type: 'order_response';
    userId: string;
    orderId: string;
    status: 'EXECUTED' | 'REJECTED' | 'CLOSED';
    reason?: string;
    executionPrice?: number;
    exitPrice?: number;
    quantity?: number;
    margin?: number;
    leverage?: number;
    pnl?: number;
    newBalance?: number;
    timestamp: number;
}

export interface ClosedOrderMessage {
    type: 'closed_order';
    orderId: string;
    userId: string;
    asset: string;
    positionType: 'LONG' | 'SHORT';
    margin: number;
    leverage: number;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pnl: number;
    reason: string;
    openTime: number;
    closeTime: number;
}

export interface EngineSnapshot {
    userBalances: Record<string, UserBalance>;
    openPositions: Record<string, Position>;
    currentPrices: Record<string, PriceData>;
    timestamp: number;
    lastProcessedMessageId: string;  // For crash recovery
}
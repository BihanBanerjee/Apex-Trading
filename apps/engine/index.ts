import redisClient from "@repo/redis-client";
import { REDIS_STREAMS } from "@repo/shared/config";
import type { 
    TradeCreateMessage, 
    TradeCloseMessage, 
    PriceUpdateMessage,
    OrderResponse,
    ClosedOrderMessage 
} from './types/index';
import { BalanceManager } from './modules/BalanceManager';
import { PositionManager } from './modules/PositionManager';
import { PriceManager } from './modules/PriceManager';
import { RiskManager } from './modules/RiskManager';
import { SnapshotManager } from './modules/SnapshotManager';
import { MathUtils } from './utils/math';

class TradingEngine {
    // Modular managers - NO DATABASE CALLS during trading
    private balanceManager = new BalanceManager();
    private positionManager = new PositionManager();
    private priceManager = new PriceManager();
    private riskManager = new RiskManager();
    private snapshotManager = new SnapshotManager();
    
    // Track last processed message for crash recovery
    private lastProcessedMessageId = '$';
    
    constructor() {
        this.initializeFromSnapshot();
    }
    
    private async initializeFromSnapshot() {
        // Load snapshot and restore state
        const snapshot = await this.snapshotManager.loadLatestSnapshot();
        
        if (snapshot) {
            // Restore state from snapshot
            this.balanceManager.loadFromSnapshot(snapshot.userBalances);
            this.positionManager.loadFromSnapshot(snapshot.openPositions);
            this.priceManager.loadFromSnapshot(snapshot.currentPrices);
            this.lastProcessedMessageId = snapshot.lastProcessedMessageId;
            console.log(`📖 Restored state from snapshot (last message: ${this.lastProcessedMessageId})`);
        } else {
            // Create initial snapshot for fresh start
            await this.snapshotManager.createInitialSnapshot();
            console.log('💾 Created initial snapshot');
        }
        
        this.startSnapshotting();
        this.startProcessing();
        console.log('🚀 Trading Engine started with in-memory processing');
    }

    // ================== TRADE CREATION ==================
    
    private async handleTradeCreate(data: TradeCreateMessage) {
        const { orderId, userId, asset, type, margin, leverage } = data;
        
        // Scale margin to integer
        const marginInt = MathUtils.scaleToInt(margin);
        
        // Check if user has sufficient balance
        if (!this.balanceManager.hasAvailableBalance(userId, marginInt)) {
            await this.sendResponse({
                type: 'order_response',
                userId,
                orderId,
                status: 'REJECTED',
                reason: 'Insufficient balance',
                timestamp: Date.now()
            });
            return;
        }
        
        // Get current price for the asset
        const priceData = this.priceManager.getAssetPrice(asset);
        if (!priceData) {
            await this.sendResponse({
                type: 'order_response',
                userId,
                orderId,
                status: 'REJECTED',
                reason: 'Price data unavailable',
                timestamp: Date.now()
            });
            return;
        }
        
        // Create position
        const position = this.positionManager.createPosition(
            orderId,
            userId,
            asset,
            type,
            marginInt,
            leverage,
            priceData
        );
        
        // Lock margin
        this.balanceManager.lockMargin(userId, marginInt);
        
        // Send success response
        await this.sendResponse({
            type: 'order_response',
            userId,
            orderId,
            status: 'EXECUTED',
            executionPrice: MathUtils.scaleFromInt(priceData.price),
            quantity: MathUtils.scaleFromInt(position.quantity),
            margin: MathUtils.scaleFromInt(marginInt),
            leverage,
            timestamp: Date.now()
        });
        
        console.log(`✅ Position created: ${orderId} - ${type} ${asset} with ${leverage}x leverage`);
    }

    // ================== TRADE CLOSING ==================
    
    private async handleTradeClose(data: TradeCloseMessage) {
        const { orderId, userId } = data;
        
        const position = this.positionManager.getPosition(orderId);
        if (!position || position.userId !== userId) {
            await this.sendResponse({
                type: 'order_response',
                userId,
                orderId,
                status: 'REJECTED',
                reason: 'Position not found',
                timestamp: Date.now()
            });
            return;
        }
        
        await this.closePosition(position, 'USER_CLOSE');
    }

    // ================== POSITION MANAGEMENT ==================
    
    private async closePosition(position: any, reason: string) {
        const currentPrice = this.priceManager.getAssetPrice(position.asset)?.price;
        if (!currentPrice) {
            console.error(`❌ Cannot close position ${position.orderId}: No current price`);
            return;
        }
        
        // Calculate P&L
        const pnl = this.positionManager.calculatePositionPnL(position.orderId, currentPrice) || 0;
        
        // Release locked margin and apply P&L
        this.balanceManager.releaseMarginAndApplyPnL(position.userId, position.margin, pnl);
        
        // Get updated balance
        const userBalance = this.balanceManager.getUserBalance(position.userId);
        
        // Remove position
        this.positionManager.removePosition(position.orderId);
        
        // Send closed order to stream for database storage
        await this.sendClosedOrder({
            type: 'closed_order',
            orderId: position.orderId,
            userId: position.userId,
            asset: position.asset,
            positionType: position.type,
            margin: MathUtils.scaleFromInt(position.margin),
            leverage: position.leverage,
            entryPrice: MathUtils.scaleFromInt(position.entryPrice),
            exitPrice: MathUtils.scaleFromInt(currentPrice),
            quantity: MathUtils.scaleFromInt(position.quantity),
            pnl: MathUtils.scaleFromInt(pnl),
            reason,
            openTime: position.timestamp,
            closeTime: Date.now()
        });
        
        // Send response to user
        await this.sendResponse({
            type: 'order_response',
            userId: position.userId,
            orderId: position.orderId,
            status: 'CLOSED',
            reason,
            exitPrice: MathUtils.scaleFromInt(currentPrice),
            pnl: MathUtils.scaleFromInt(pnl),
            newBalance: MathUtils.scaleFromInt(userBalance.balance),
            timestamp: Date.now()
        });
        
        console.log(`🔒 Position closed: ${position.orderId} - P&L: $${MathUtils.scaleFromInt(pnl).toFixed(2)}`);
    }

    // ================== PRICE PROCESSING ==================
    
    private async handlePriceUpdate(data: PriceUpdateMessage) {
        const priceUpdate = this.priceManager.updatePrice(data);
        if (!priceUpdate) return;
        
        // Check all positions for liquidation and stop loss/take profit
        await this.checkPositions(priceUpdate.symbol, priceUpdate.price);
    }

    // ================== RISK MANAGEMENT ==================
    
    private async checkPositions(symbol: string, currentPrice: number) {
        const asset = this.priceManager.getAssetFromSymbol(symbol);
        const positions = this.positionManager.getPositionsByAsset(asset);
        
        for (const position of positions) {
            const riskCheck = this.riskManager.checkPosition(position, currentPrice);
            
            if (riskCheck.shouldClose && riskCheck.action) {
                await this.closePosition(position, riskCheck.action);
            }
        }
    }

    // ================== REDIS COMMUNICATION ==================
    
    private async sendResponse(message: OrderResponse) {
        // Send responses to ENGINE_OUTPUT stream for HTTP server
        await redisClient.xadd(REDIS_STREAMS.ENGINE_OUTPUT, '*', 'data', JSON.stringify(message));
        console.log(`📤 Response sent: ${message.status} for order ${message.orderId}`);
    }
    
    private async sendClosedOrder(message: ClosedOrderMessage) {
        // Send closed orders to ENGINE_OUTPUT stream for database worker
        await redisClient.xadd(REDIS_STREAMS.ENGINE_OUTPUT, '*', 'data', JSON.stringify(message));
        console.log(`📤 Closed order sent: ${message.orderId}`);
    }
    
    private async startProcessing() {
        console.log('📡 Starting Redis stream processing...');
        
        let lastId = this.lastProcessedMessageId;
        
        while (true) {
            try {
                const streams = await redisClient.xread('BLOCK', 1000, 'STREAMS', REDIS_STREAMS.ENGINE_INPUT, lastId);
                
                if (streams && streams.length > 0) {
                    for (const [_, messages] of streams) {
                        for (const [messageId, fields] of messages) {
                            if (fields.length >= 2 && typeof fields[1] === 'string') {
                                const data = JSON.parse(fields[1]); // fields[0] is 'data', fields[1] is JSON
                                
                                // Route message based on type
                                switch (data.type) {
                                    case 'TRADE_CREATE':
                                        await this.handleTradeCreate(data.data);
                                        break;
                                    case 'TRADE_CLOSE':
                                        await this.handleTradeClose(data.data);
                                        break;
                                    case 'bookTicker':
                                        await this.handlePriceUpdate(data);
                                        break;
                                    default:
                                        console.log(`⚠️ Unknown message type: ${data.type}`);
                                }
                                
                                lastId = messageId;
                                this.lastProcessedMessageId = messageId;  // Update for snapshots
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('❌ Redis processing error:', error);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
            }
        }
    }

    // ================== SNAPSHOT SYSTEM ==================
    
    private startSnapshotting() {
        this.snapshotManager.startSnapshotting(
            () => this.balanceManager.getAllBalances(),
            () => this.positionManager.getAllPositions(),
            () => this.priceManager.getAllPrices(),
            () => this.lastProcessedMessageId
        );
    }
    
    // ================== CLEANUP ==================
    
    public shutdown() {
        this.snapshotManager.stopSnapshotting();
        console.log('🛑 Trading Engine shutdown complete');
    }
}

// Start the engine
const engine = new TradingEngine();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Trading Engine...');
    engine.shutdown();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down Trading Engine...');
    engine.shutdown();
    process.exit(0);
});
import type { Position, PriceData } from '../types/index';
import { MathUtils } from '../utils/math';

export class PositionManager {
    private openPositions: Map<string, Position> = new Map();
    
    createPosition(
        orderId: string,
        userId: string,
        asset: string,
        type: 'LONG' | 'SHORT',
        margin: number,
        leverage: number,
        priceData: PriceData
    ): Position {
        const quantity = MathUtils.calculatePositionSize(margin, leverage, priceData.price);
        
        const position: Position = {
            orderId,
            userId,
            asset,
            type,
            margin,
            leverage,
            entryPrice: priceData.price,
            quantity,
            timestamp: Date.now(),
            liquidationPrice: 0 // No longer used - P&L based liquidation instead
        };
        
        this.openPositions.set(orderId, position);
        return position;
    }
    
    getPosition(orderId: string): Position | undefined {
        return this.openPositions.get(orderId);
    }
    
    removePosition(orderId: string): void {
        this.openPositions.delete(orderId);
    }
    
    getAllPositions(): Map<string, Position> {
        return this.openPositions;
    }
    
    getPositionsByAsset(asset: string): Position[] {
        const positions: Position[] = [];
        for (const position of this.openPositions.values()) {
            if (position.asset === asset) {
                positions.push(position);
            }
        }
        return positions;
    }
    
    getPositionsByUser(userId: string): Position[] {
        const positions: Position[] = [];
        for (const position of this.openPositions.values()) {
            if (position.userId === userId) {
                positions.push(position);
            }
        }
        return positions;
    }
    
    updateStopLoss(orderId: string, stopLoss: number): boolean {
        const position = this.openPositions.get(orderId);
        if (position) {
            position.stopLoss = stopLoss;
            return true;
        }
        return false;
    }
    
    updateTakeProfit(orderId: string, takeProfit: number): boolean {
        const position = this.openPositions.get(orderId);
        if (position) {
            position.takeProfit = takeProfit;
            return true;
        }
        return false;
    }
    
    calculatePositionPnL(orderId: string, currentPrice: number): number | null {
        const position = this.openPositions.get(orderId);
        if (!position) return null;
        
        return MathUtils.calculatePnL(position, currentPrice);
    }
    
    loadFromSnapshot(positions: Record<string, Position>): void {
        this.openPositions.clear();
        for (const [orderId, position] of Object.entries(positions)) {
            this.openPositions.set(orderId, position);
        }
    }
}
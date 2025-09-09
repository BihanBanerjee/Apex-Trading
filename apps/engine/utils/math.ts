import { SCALE } from '../types/index';

export class MathUtils {
    static scaleToInt(value: number): number {
        return Math.round(value * SCALE);
    }
    
    static scaleFromInt(value: number): number {
        return value / SCALE;
    }
    
    // Removed: Old price-based liquidation method
    // Now using P&L-based liquidation at 90% margin threshold
    
    static calculatePositionSize(margin: number, leverage: number, price: number): number {
        const positionValue = margin * leverage;
        return Math.floor(positionValue / price);
    }
    
    static calculatePnL(position: any, currentPrice: number): number {
        const priceDiff = position.type === 'LONG' 
            ? currentPrice - position.entryPrice
            : position.entryPrice - currentPrice;
            
        return Math.floor((priceDiff * position.quantity * position.leverage) / SCALE);
    }
    
    static calculateMidPrice(bestBid: number, bestAsk: number): number {
        return Math.floor((bestBid + bestAsk) / 2);
    }
}
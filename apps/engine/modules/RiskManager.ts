import type { Position } from '../types/index';
import { MathUtils } from '../utils/math';

export class RiskManager {
    /**
     * Check if position should be liquidated due to margin call
     * Liquidate when losses exceed 90% of margin to prevent negative balance
     */
    shouldLiquidate(position: Position, currentPrice: number): boolean {
        const pnl = MathUtils.calculatePnL(position, currentPrice);
        const liquidationThreshold = Math.floor((position.margin * 90) / 100); // 90% of margin
        
        // Liquidate when losses exceed 90% of margin
        return pnl < 0 && (pnl * -1) >= liquidationThreshold;
    }
    
    /**
     * Check if position should be closed due to stop loss
     * Stop loss triggers when losses exceed the stop loss threshold
     */
    shouldExecuteStopLoss(position: Position, currentPrice: number): boolean {
        if (!position.stopLoss || position.stopLoss === 0) return false;
        
        const pnl = MathUtils.calculatePnL(position, currentPrice);
        // Stop loss triggers when losses exceed the stop loss threshold
        return pnl < 0 && (pnl * -1) >= position.stopLoss;
    }
    
    /**
     * Check if position should be closed due to take profit  
     * Take profit triggers when profits reach the take profit threshold
     */
    shouldExecuteTakeProfit(position: Position, currentPrice: number): boolean {
        if (!position.takeProfit || position.takeProfit === 0) return false;
        
        const pnl = MathUtils.calculatePnL(position, currentPrice);
        // Take profit triggers when profits reach the take profit threshold
        return pnl > 0 && pnl >= position.takeProfit;
    }
    
    /**
     * Check position for liquidation conditions in priority order
     * 1. MARGIN_CALL (liquidation) - highest priority
     * 2. STOP_LOSS - user protection  
     * 3. TAKE_PROFIT - profit realization
     */
    checkPosition(position: Position, currentPrice: number): {
        action: 'MARGIN_CALL' | 'STOP_LOSS' | 'TAKE_PROFIT' | null;
        shouldClose: boolean;
    } {
        // Check liquidation first (highest priority)
        if (this.shouldLiquidate(position, currentPrice)) {
            return { action: 'MARGIN_CALL', shouldClose: true };
        }
        
        // Check stop loss
        if (this.shouldExecuteStopLoss(position, currentPrice)) {
            return { action: 'STOP_LOSS', shouldClose: true };
        }
        
        // Check take profit
        if (this.shouldExecuteTakeProfit(position, currentPrice)) {
            return { action: 'TAKE_PROFIT', shouldClose: true };
        }
        
        return { action: null, shouldClose: false };
    }
    
    calculatePositionHealth(position: Position, currentPrice: number): {
        healthRatio: number;
        unrealizedPnL: number;
        isHealthy: boolean;
    } {
        const priceDiff = position.type === 'LONG' 
            ? currentPrice - position.entryPrice
            : position.entryPrice - currentPrice;
            
        const unrealizedPnL = Math.floor((priceDiff * position.quantity * position.leverage) / 100_000_000);
        
        // Health ratio: how close to liquidation (1.0 = healthy, 0.0 = liquidation)
        const distanceToLiquidation = position.type === 'LONG'
            ? currentPrice - position.liquidationPrice
            : position.liquidationPrice - currentPrice;
            
        const maxDistanceToLiquidation = Math.abs(position.entryPrice - position.liquidationPrice);
        const healthRatio = Math.max(0, Math.min(1, distanceToLiquidation / maxDistanceToLiquidation));
        
        return {
            healthRatio,
            unrealizedPnL,
            isHealthy: healthRatio > 0.2 // Healthy if more than 20% away from liquidation
        };
    }
    
    getPositionsAtRisk(positions: Position[], currentPrices: Map<string, any>, riskThreshold: number = 0.3): Position[] {
        const riskPositions: Position[] = [];
        
        for (const position of positions) {
            const priceData = currentPrices.get(`${position.asset}_USDC_PERP`);
            if (!priceData) continue;
            
            const health = this.calculatePositionHealth(position, priceData.price);
            if (health.healthRatio < riskThreshold) {
                riskPositions.push(position);
            }
        }
        
        return riskPositions;
    }
}
import type { PriceData, PriceUpdateMessage } from '../types/index';
import { MathUtils } from '../utils/math';

export class PriceManager {
    private currentPrices: Map<string, PriceData> = new Map();
    
    updatePrice(message: PriceUpdateMessage): PriceData | null {
        const { data: priceData } = message;
        
        if (priceData.e !== 'bookTicker') {
            return null;
        }
        
        const symbol = priceData.s; // ETH_USDC_PERP
        const bestBid = MathUtils.scaleToInt(parseFloat(priceData.b));
        const bestAsk = MathUtils.scaleToInt(parseFloat(priceData.a));
        const midPrice = MathUtils.calculateMidPrice(bestBid, bestAsk);
        
        const priceUpdate: PriceData = {
            symbol,
            price: midPrice,
            timestamp: Date.now()
        };
        
        this.currentPrices.set(symbol, priceUpdate);
        return priceUpdate;
    }
    
    getPrice(symbol: string): PriceData | undefined {
        return this.currentPrices.get(symbol);
    }
    
    getAllPrices(): Map<string, PriceData> {
        return this.currentPrices;
    }
    
    getAssetSymbol(asset: string): string {
        return `${asset}_USDC_PERP`;
    }
    
    getAssetFromSymbol(symbol: string): string {
        return symbol.split('_')[0] ?? symbol; // Extract ETH from ETH_USDC_PERP
    }
    
    hasPrice(asset: string): boolean {
        const symbol = this.getAssetSymbol(asset);
        return this.currentPrices.has(symbol);
    }
    
    getAssetPrice(asset: string): PriceData | undefined {
        const symbol = this.getAssetSymbol(asset);
        return this.currentPrices.get(symbol);
    }
    
    loadFromSnapshot(prices: Record<string, PriceData>): void {
        this.currentPrices.clear();
        for (const [symbol, price] of Object.entries(prices)) {
            this.currentPrices.set(symbol, price);
        }
    }
}
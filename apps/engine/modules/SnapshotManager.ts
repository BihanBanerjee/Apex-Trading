import prisma from "@repo/database";
import type { EngineSnapshot, UserBalance, Position, PriceData } from '../types/index';

export class SnapshotManager {
    private snapshotTimer?: NodeJS.Timeout;
    
    startSnapshotting(
        getUserBalances: () => Map<string, UserBalance>,
        getOpenPositions: () => Map<string, Position>,
        getCurrentPrices: () => Map<string, PriceData>,
        getLastProcessedMessageId: () => string
    ): void {
        this.snapshotTimer = setInterval(async () => {
            await this.saveSnapshot(getUserBalances(), getOpenPositions(), getCurrentPrices(), getLastProcessedMessageId());
        }, 10000); // Every 10 seconds
        
        console.log('💾 Snapshot system started (10s intervals)');
    }
    
    private async saveSnapshot(
        userBalances: Map<string, UserBalance>,
        openPositions: Map<string, Position>,
        currentPrices: Map<string, PriceData>,
        lastProcessedMessageId: string
    ): Promise<void> {
        try {
            const snapshot: EngineSnapshot = {
                userBalances: Object.fromEntries(userBalances),
                openPositions: Object.fromEntries(openPositions),
                currentPrices: Object.fromEntries(currentPrices),
                timestamp: Date.now(),
                lastProcessedMessageId
            };
            
            await prisma.$executeRaw`
                INSERT INTO engine_snapshots (id, snapshot_data) 
                VALUES (1, ${JSON.stringify(snapshot)}) 
                ON CONFLICT (id) DO UPDATE SET 
                    snapshot_data = ${JSON.stringify(snapshot)}, 
                    created_at = NOW()
            `;
            
            console.log(`📸 Snapshot saved at ${new Date().toISOString()}`);
        } catch (error) {
            console.error('❌ Snapshot save failed:', error);
        }
    }
    
    async loadLatestSnapshot(): Promise<EngineSnapshot | null> {
        try {
            const result = await prisma.engineSnapshot.findUnique({
                where: { id: 1 }
            });
            
            if (result && result.snapshotData) {
                const snapshot = result.snapshotData as unknown as EngineSnapshot;
                console.log(`📖 Snapshot loaded from ${new Date(snapshot.timestamp).toISOString()}`);
                return snapshot;
            }
            
            return null;
        } catch (error) {
            console.error('❌ Failed to load snapshot:', error);
            return null;
        }
    }
    
    async createInitialSnapshot(): Promise<void> {
        try {
            const emptySnapshot: EngineSnapshot = {
                userBalances: {},
                openPositions: {},
                currentPrices: {},
                timestamp: Date.now(),
                lastProcessedMessageId: '$'  // Start fresh on first run
            };
            
            await prisma.$executeRaw`
                INSERT INTO engine_snapshots (id, snapshot_data) 
                VALUES (1, ${JSON.stringify(emptySnapshot)})
                ON CONFLICT (id) DO NOTHING
            `;
            
            console.log('📸 Initial snapshot created');
        } catch (error) {
            console.error('❌ Failed to create initial snapshot:', error);
        }
    }
    
    stopSnapshotting(): void {
        if (this.snapshotTimer) {
            clearInterval(this.snapshotTimer);
            this.snapshotTimer = undefined;
        }
    }
    
    async forceSnapshot(
        userBalances: Map<string, UserBalance>,
        openPositions: Map<string, Position>,
        currentPrices: Map<string, PriceData>,
        lastProcessedMessageId: string
    ): Promise<void> {
        await this.saveSnapshot(userBalances, openPositions, currentPrices, lastProcessedMessageId);
    }
}
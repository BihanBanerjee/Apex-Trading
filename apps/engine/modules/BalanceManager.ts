import type { UserBalance } from '../types/index';

import { MathUtils } from '../utils/math';

export class BalanceManager {
    private userBalances: Map<string, UserBalance> = new Map();
    
    ensureUserBalance(userId: string): UserBalance {
        if (!this.userBalances.has(userId)) {
            // New user gets initial free balance: $10,000
            const initialBalance: UserBalance = {
                userId,
                balance: MathUtils.scaleToInt(10000), // $10,000 starting balance
                lockedMargin: 0
            };
            this.userBalances.set(userId, initialBalance);
            console.log(`💰 New user ${userId} initialized with $10,000 balance`);
        }
        return this.userBalances.get(userId)!;
    }
    
    hasAvailableBalance(userId: string, requiredMargin: number): boolean {
        const userBalance = this.ensureUserBalance(userId);
        return userBalance.balance - userBalance.lockedMargin >= requiredMargin;
    }
    
    lockMargin(userId: string, margin: number): void {
        const userBalance = this.ensureUserBalance(userId);
        userBalance.lockedMargin += margin;
    }
    
    releaseMarginAndApplyPnL(userId: string, margin: number, pnl: number): void {
        const userBalance = this.ensureUserBalance(userId);
        userBalance.lockedMargin -= margin;
        userBalance.balance = userBalance.balance + margin + pnl;
    }
    
    getUserBalance(userId: string): UserBalance {
        return this.ensureUserBalance(userId);
    }
    
    getAllBalances(): Map<string, UserBalance> {
        return this.userBalances;
    }
    
    loadFromSnapshot(balances: Record<string, UserBalance>): void {
        this.userBalances.clear();
        for (const [userId, balance] of Object.entries(balances)) {
            this.userBalances.set(userId, balance);
        }
    }
}
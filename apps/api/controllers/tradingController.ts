import redisClient from "@repo/redis-client";
import { REDIS_STREAMS } from '@repo/shared/config';
import type { Response } from "express";
import type { AuthRequest } from '../middleware/auth';

export const createTrade = async (req: AuthRequest, res: Response) => {
    try {
        const { asset, type, margin, leverage, slippage } = req.body;
        const userId = req.user?.userId;

        // Validation
        if (!asset || !type || !margin || !leverage) {
            return res.status(400).json({
                error: "Missing required fields."
            });
        }

        if (!userId) {
            return res.status(401).json({
                error: "User not authenticated"
            });
        }

        const tradeData = {
            orderId: `trade_${Date.now()}_${Math.random().toString(36).slice(2,11)}`,
            userId,
            asset,
            type,
            margin: parseFloat(margin),
            leverage: parseFloat(leverage),
            slippage: slippage || 100,
            timestamp: Date.now(),
            status: 'PENDING'
        };

        const message = {
            type: "TRADE_CREATE",
            data: tradeData
        };

        await redisClient.xadd(REDIS_STREAMS.ENGINE_INPUT, "*", 'data', JSON.stringify(message));

        res.json({
            orderId: tradeData.orderId
        });
    } catch (error) {
        console.error('Error creating trade', error);
        res.status(500).json({
            error: 'Internal Server Error'
        });
    }
};

export const closeTrade = async (req: AuthRequest, res: Response) => {
    try {
        const { orderId } = req.body;
        const userId = req.user?.userId;

        if (!orderId) {
            return res.status(400).json({
                error: "Order id is required."
            });
        }

        if (!userId) {
            return res.status(401).json({
                error: "User not authenticated"
            });
        }

        const closeData = {
            orderId,
            userId,
            action: "CLOSE",
            timestamp: Date.now()
        };

        const message = {
            type: "TRADE_CLOSE",
            data: closeData
        };

        await redisClient.xadd(REDIS_STREAMS.ENGINE_INPUT, '*', 'data', JSON.stringify(message));
        
        res.json({
            success: true,
            message: 'Close order submitted'
        });

    } catch (error) {
        console.error('Error closing trade', error);
        res.status(500).json({
            error: 'Internal server error.'
        });
    }
};

export const placeOrder = async (req: AuthRequest, res: Response) => {
    try {
        const { symbol, side, quantity, orderType } = req.body;
        const userId = req.user?.userId;

        // Validation
        if (!symbol || !side || !quantity) {
            return res.status(400).json({
                error: "Missing required fields"
            });
        }

        if (!userId) {
            return res.status(401).json({
                error: "User not authenticated"
            });
        }

        const orderData = {
            orderId: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId,
            symbol,
            side, // 'BUY' or 'SELL'
            quantity: parseFloat(quantity),
            orderType: orderType || 'MARKET',
            timestamp: Date.now(),
            status: 'PENDING'
        };

        const message = {
            type: "ORDER",
            data: orderData
        };

        // Send order to engine via Redis stream
        await redisClient.xadd(
            REDIS_STREAMS.ENGINE_INPUT,
            '*',
            'data',
            JSON.stringify(message)
        );

        res.json({
            success: true,
            orderId: orderData.orderId,
            message: 'Order submitted successfully'
        });

    } catch (error) {
        console.error('Error processing order:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
import express from "express";
import redisClient from "@repo/redis-client"
import dotenv from "dotenv";

import { REDIS_STREAMS } from '../shared/config';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());


// just a health check endpoint.
app.get('/health', (req, res) => {
    res.json({
        status: "OK",
        timestamp: new Date().toISOString()
    })
});

// basic auth endpoints

app.post("/api/v1/signup", () => {

})

app.post('/api/v1/signin', () => {

})

app.get('/api/v1/signin/post?token=123', () => {

})


app.post('/api/v1/trade/create', async (req, res) => {
    try {
        const { asset, type, margin, leverage, slippage } = req.body
        // Validation
        if( !asset || !type || !margin || !leverage ) {
            return res.status(400).json({
                error: "Missing required fields."
            })
        }

        const tradeData = {
            orderId: `trade_${Date.now()}_${Math.random().toString(36).slice(2,11)}`,
            asset,
            type,
            margin: parseFloat(margin),
            leverage: parseFloat(leverage),
            slippage: slippage || 100,
            timestamp: Date.now(),
            status: 'PENDING'
        }

        const message = {
            type: "TRADE_CREATE",
            data: tradeData
        }

        await redisClient.xadd(REDIS_STREAMS.ENGINE_INPUT, "*", 'data', JSON.stringify(message))

        res.json({
            orderId: tradeData.orderId
        })
    } catch (error) {
        console.error('Error creating trade', error);
        res.status(500).json({
            error: 'Internal Server Error'
        })
    }
})

app.post('/api/v1/trade/close', async (req, res) => {
    try {
        const { orderId } = req.body;
        if(!orderId) {
            return res.status(400).json({
                error: "Order id is required."
            })
        }

        const closeData = {
            orderId,
            action: "CLOSE",
            timestamp: Date.now()
        }

        const message = {
            type: "TRADE_CLOSE",
            data: closeData
        }

        await redisClient.xadd(REDIS_STREAMS.ENGINE_INPUT, '*', 'data', JSON.stringify(message))
        res.json({
            success: true,
            message: 'Close order submitted'
        })

    } catch(error) {
        console.error('Error closing trade', error)
        res.status(500).json({
            error: 'Internal server error.'
        })
    }
})

app.get('/api/v1/balance/usd', async(req, res) => {

})

app.get('/api/v1/balance', async() => {

})

app.get('/api/v1/supportedAssets', () => {

})







//Place Order endpoint

app.post('/orders', async (req, res) => {
    try {
        const { symbol, side, quantity, orderType } = req.body;

        // validation
        if (!symbol || !side || !quantity) {
            return res.status(400).json({
                error: "Missing required fields"
            });
        }

        const orderData = {
            orderId: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
});





app.listen(PORT, () => {
    console.log(`HTTP API server running on port ${PORT}`);
});


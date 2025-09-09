import express from "express";
import cookieParser from "cookie-parser";
import redisClient from "@repo/redis-client";
import { REDIS_STREAMS } from "@repo/shared/config";

// Import routes
import authRoutes from "./routes/auth";
import tradingRoutes from "./routes/trading";
import accountRoutes from "./routes/account";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(cookieParser());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: "OK",
        timestamp: new Date().toISOString()
    });
});

// Mount routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/trade", tradingRoutes);
app.use("/api/v1/account", accountRoutes);


// Start Redis response listener
startEngineResponseListener();

app.listen(PORT, () => {
    console.log(`HTTP API server running on port ${PORT}`);
});

// ================== ENGINE RESPONSE HANDLER ==================

async function startEngineResponseListener() {
    console.log('📡 Starting engine response listener...');
    
    let lastId = '$'; // Only process new responses
    
    // Run in background - don't block server startup
    setImmediate(async () => {
        while (true) {
            try {
                const streams = await redisClient.xread(
                    'BLOCK', 1000, 
                    'STREAMS', REDIS_STREAMS.ENGINE_OUTPUT, 
                    lastId
                );
                
                if (streams && streams.length > 0) {
                    for (const [_, messages] of streams) {
                        for (const [messageId, fields] of messages) {
                            if (fields.length >= 2 && typeof fields[1] === 'string') {
                                const data = JSON.parse(fields[1]);
                                
                                // Handle different response types
                                switch (data.type) {
                                    case 'order_response':
                                        await handleOrderResponse(data);
                                        break;
                                    case 'closed_order':
                                        await handleClosedOrder(data);
                                        break;
                                    default:
                                        console.log(`⚠️ Unknown response type: ${data.type}`);
                                }
                                
                                lastId = messageId;
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('❌ Engine response processing error:', error);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    });
}

async function handleOrderResponse(response: any) {
    console.log(`📨 Order response received: ${response.status} for ${response.orderId}`);
    
    // TODO: Send to WebSocket clients when implemented
    // TODO: Store in pending responses for HTTP polling if needed
    
    // For now, just log the successful processing
    if (response.status === 'EXECUTED') {
        console.log(`✅ Order ${response.orderId} executed at $${response.executionPrice}`);
    } else if (response.status === 'CLOSED') {
        console.log(`🔒 Position ${response.orderId} closed with P&L: $${response.pnl}`);
    } else if (response.status === 'REJECTED') {
        console.log(`❌ Order ${response.orderId} rejected: ${response.reason}`);
    }
}

async function handleClosedOrder(closedOrder: any) {
    console.log(`📊 Closed order received: ${closedOrder.orderId} - P&L: $${closedOrder.pnl}`);
    
    // TODO: Save to database via worker process
    // For now, just acknowledge receipt
}
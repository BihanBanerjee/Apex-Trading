import WebSocket from "ws";
import redisClient from "@repo/redis-client";
import { REDIS_STREAMS } from '../shared/config';
import type { PriceData } from '../shared/types';

const SUPPORTED_PAIRS = ["SOL_USDC_PERP", "BTC_USDC_PERP", "ETH_USDC_PERP"]

let latestPrices: Map<string, PriceData> = new Map();
const SEND_INTERVAL_MS = 100;

async function main () {
    const ws = new WebSocket("wss://ws.backpack.exchange/")

    ws.onopen = () => {
        console.log("Connected to Backpack");
        const subscribeMessage = {
            "method": "SUBSCRIBE",
            "params": SUPPORTED_PAIRS.map((p) => `bookTicker.${p}`)
        }
        
        ws.send(JSON.stringify(subscribeMessage))
    }

    ws.onmessage = ({data}) => {
        try {
            const payload = JSON.parse(data.toString());
            if (!payload.data.a || !payload.data.b || !payload.data.s) {
                return
            }
            const priceData: PriceData = {
                symbol: payload.data.s,
                askPrice: parseFloat(payload.data.a),
                bidPrice: parseFloat(payload.data.b),
                timestamp: payload.data.E,
                sequence: payload.data.u
            }

            latestPrices.set(payload.data.s, priceData);
        } catch(error) {
            console.error("Error processing message", error);
        }
    }

    setInterval(async () => {
        if (latestPrices.size > 0) {
            for (const [symbol, priceData] of latestPrices) {
                const message = {
                    type: "PRICE",
                    data: priceData
                };
                
                try {
                    await redisClient.xadd(REDIS_STREAMS.ENGINE_INPUT, '*', 'data', JSON.stringify(message));
                } catch (error) {
                    console.error(`Error sending price for ${symbol}:`, error);
                }
            }
        }
    }, SEND_INTERVAL_MS);

    ws.onclose = () => {
        console.log("client closed!!!");
    }
}

main();
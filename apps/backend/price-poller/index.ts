import WebSocket from "ws";
import redisClient from "@repo/redis-client";
import { REDIS_STREAMS } from '../shared/config';
import type { PriceData } from '../shared/types';

const SUPPORTED_PAIRS = ["SOL_USDC_PERP", "BTC_USDC_PERP", "ETH_USDC_PERP"]


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

    ws.onmessage = async({data}) => {
        try {
            const payload = JSON.parse(data.toString());
            // console.log(payload);
            if (!payload.data.a || !payload.data.s) {
                return
            }
            const priceData: PriceData = {
                symbol: payload.data.s,
                price: parseFloat(payload.data.a),
                timestamp: payload.data.E,
                sequence: payload.data.u
            }

            const message = {
                type: "PRICE",
                data: priceData
            };
            
            await redisClient.xadd(REDIS_STREAMS.ENGINE_INPUT, '*', 'data', JSON.stringify(message))
        } catch(error) {
            console.error("Error processing message", error);
        }
    }

    ws.onclose = () => {
        console.log("client closed!!!");
    }
}

main();
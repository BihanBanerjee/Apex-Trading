import { Router } from "express";
import { createTrade, closeTrade, placeOrder } from "../controllers/tradingController";
import { authenticateUser } from "../middleware/auth";

const router = Router();

// Apply auth middleware to all trading routes
router.use(authenticateUser);

// Create trade
router.post("/create", createTrade);

// Close trade
router.post("/close", closeTrade);

// Place order (legacy endpoint)
router.post("/order", placeOrder);

export default router;
import { Router } from "express";
import { createTrade, closeTrade } from "../controllers/tradingController";
import { authenticateUser } from "../middleware/auth";

const router = Router();

// Apply auth middleware to all trading routes
router.use(authenticateUser);

// Create trade
router.post("/create", createTrade);

// Close trade
router.post("/close", closeTrade);

export default router;
import { Router } from "express";
import { getUSDBalance, getAllBalances, getSupportedAssets } from "../controllers/accountController";
import { authenticateUser } from "../middleware/auth";

const router = Router();

// Apply auth middleware to all account routes
router.use(authenticateUser);

// Get USD balance
router.get("/balance/usd", getUSDBalance);

// Get all balances
router.get("/balance", getAllBalances);

// Get supported assets
router.get("/assets", getSupportedAssets);

export default router;
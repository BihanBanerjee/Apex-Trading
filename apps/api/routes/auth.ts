import { Router } from "express";
import { sendMagicLink, verifyToken, logout } from "../controllers/authController";

const router = Router();

// Send magic link to email
router.post("/", sendMagicLink);

// Verify token and set cookie
router.get("/verify", verifyToken);

// Logout - clear cookie
router.post("/logout", logout);

export default router;
import express from "express";
import cookieParser from "cookie-parser";

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


app.listen(PORT, () => {
    console.log(`HTTP API server running on port ${PORT}`);
});
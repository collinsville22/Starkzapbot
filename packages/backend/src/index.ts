import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { rateLimiter } from "hono-rate-limiter";
import { log } from "./utils/logger.js";
import { authMiddleware, handleAuth } from "./middleware/auth.js";
import type { DbUser } from "./services/db.js";

// Route imports
import portfolio from "./routes/portfolio.js";
import swap from "./routes/swap.js";
import { advancedSwapRoutes } from "./routes/swap.js";
import staking from "./routes/staking.js";
import { stakingManage } from "./routes/staking.js";
import publicStaking from "./routes/staking-public.js";
import lending from "./routes/lending.js";
import { advancedLendingRoutes } from "./routes/lending.js";
import dca from "./routes/dca.js";
import bridge from "./routes/bridge.js";
import confidential from "./routes/confidential.js";
import history from "./routes/history.js";
import transfer from "./routes/transfer.js";
import { advancedTransferRoutes } from "./routes/transfer.js";
import tokens from "./routes/tokens.js";
import advanced from "./routes/advanced.js";
import prices from "./routes/prices.js";

const app = new Hono();

app.use("*", cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true,
}));

// ---------- Rate limiters ----------

// Global: 100 requests per 15 min per IP
const globalLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  keyGenerator: (c) =>
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "unknown",
});

// Auth endpoint: 10 per min per IP
const authLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: (c) =>
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "unknown",
});

// Authenticated routes: 60 per min per user (keyed by telegramId after auth)
const userLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: 60,
  keyGenerator: (c) => {
    try {
      const user = (c as any).get("user") as DbUser | undefined;
      return user ? `user:${user.telegram_id}` : "unknown";
    } catch {
      return "unknown";
    }
  },
});

// Apply global limiter to all routes
app.use("*", globalLimiter);

// Health & auth (public)
app.get("/health", (c) => c.json({ status: "ok" }));
app.post("/auth/validate", authLimiter, handleAuth);

// Public routes (no auth)
app.route("/api/tokens", tokens);
app.route("/api/prices", prices);
app.route("/api/staking", publicStaking);

// Authenticated API routes
const api = new Hono();
api.use("*", authMiddleware);
api.use("*", userLimiter);
api.route("/portfolio", portfolio);
api.route("/swap", swap);
api.route("/staking", staking);
api.route("/lending", lending);
api.route("/dca", dca);
api.route("/bridge", bridge);
api.route("/confidential", confidential);
api.route("/history", history);
api.route("/transfer", transfer);
api.route("/staking-manage", stakingManage);

// Advanced routes: account (deploy/sign) + swap/transfer/lending endpoints
api.route("/advanced", advanced);
api.route("/advanced", advancedSwapRoutes);
api.route("/advanced", advancedTransferRoutes);
api.route("/advanced", advancedLendingRoutes);

app.route("/api", api);

const port = parseInt(process.env.BACKEND_PORT || "3001");
log.info("server", `Backend starting on port ${port}`);
serve({ fetch: app.fetch, port });
log.info("server", `Backend running at http://localhost:${port}`);

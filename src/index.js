import express from "express";
import cors from "cors";
import "dotenv/config";
import cookieParser from "cookie-parser";
import "./lib/firebase.js";
import { logger } from "./lib/logger.js";
import { requestId, httpLogger } from "./middlewares/requestLogger.js";
import { notFoundHandler, errorHandler } from "./middlewares/errorHandler.js";
import { authMiddleware } from "./middlewares/auth.middleware.js";
import userRoutes from "./modules/user/user.routes.js";
import authRoutes from "./modules/auth/auth.routes.js";
import profileRoutes from "./modules/profile/profile.routes.js";
import teamRoutes from "./modules/team/team.routes.js";
import tournamentRoutes from "./modules/tournament/tournament.routes.js";
import matchRoutes from "./modules/match/match.routes.js";
import locationRoutes from "./modules/location/location.routes.js";
import sportRoutes from "./modules/sport/sport.routes.js";
import assetRoutes from "./modules/asset/asset.routes.js";
import requestRoutes from "./modules/request/request.routes.js";
import invitationRoutes from "./modules/invitation/invitation.routes.js";
import statsRoutes from "./modules/stats/badmintonStats/stats.routes.js";
import personnelRoutes from "./modules/personnel/personnel.routes.js";
import favoriteRoutes from "./modules/favorite/favorite.routes.js";
import achievementRoutes from "./modules/achievement/achievement.routes.js";
import testRoutes from "./modules/test/test.routes.js";
import { initializeMatchmakingScheduler } from "./modules/scheduler/scheduler.service.js";
import { createServer } from "http";
import { Server } from "socket.io";
import { initializeSocket } from "./socket/index.js";

const app = express();
const PORT = process.env.PORT || 3001;

/* ======================================================
   1️⃣ CREATE HTTP SERVER (for Socket.IO)
   ====================================================== */
const server = createServer(app);

/* ======================================================
   2️⃣ INITIALIZE SOCKET.IO
   ====================================================== */
const io = new Server(server, {
    cors: {
        origin: true,
        credentials: true,
        methods: ["GET", "POST"],
    },
});

// Make io available throughout the app
app.set("io", io);

// Initialize socket handlers
initializeSocket(io);

/* ======================================================
   3️⃣ TRUST PROXY (behind nginx)
   ====================================================== */
app.set("trust proxy", 1);

/* ======================================================
   4️⃣ REQUEST ID + REQUEST LOGGER (must be first)
   ====================================================== */
app.use(requestId);
app.use(httpLogger);

/* ======================================================
   5️⃣ CORS (Flutter-friendly)
   ====================================================== */
app.use(
    cors({
        origin: true, // Flutter mobile + Flutter web
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "X-Session-Id",
            "X-Request-Id",
            "X-Client-Platform",
            "X-App-Version",
        ],
        exposedHeaders: ["X-Request-Id"],
    })
);

/* ======================================================
   6️⃣ COOKIE PARSER
   ====================================================== */
app.use(cookieParser());

/* ======================================================
   7️⃣ BODY PARSERS
   ====================================================== */
app.use((req, res, next) => {
    const contentType = req.headers["content-type"] || "";
    if (contentType.startsWith("multipart/form-data")) return next();
    express.json({ limit: "10mb" })(req, res, next);
});

app.use(express.urlencoded({ extended: true }));

/* ======================================================
   8️⃣ HEALTH CHECK
   ====================================================== */
app.get("/health", (req, res) => {
    res.json({
        status: "Backend running ✅",
        timestamp: new Date().toISOString(),
    });
});

/* ======================================================
   9️⃣ AUTH (ALL APIs BELOW ARE PROTECTED)
   ====================================================== */
app.use(authMiddleware);

/* ======================================================
   🔟 ROUTES
   ====================================================== */
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/sports", sportRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/achievements", achievementRoutes);
app.use("/api/personnel", personnelRoutes);
app.use("/api/test", testRoutes);

/* ======================================================
   1️⃣1️⃣ 404 + GLOBAL ERROR HANDLER (must be last)
   ====================================================== */
app.use(notFoundHandler);
app.use(errorHandler);

/* ======================================================
   🚀 START SERVER WITH SOCKET.IO
   ====================================================== */
server.listen(PORT, "0.0.0.0", () => {
    logger.info({ port: PORT, env: process.env.NODE_ENV }, "Backend started");

    // ✅ INITIALIZE MATCHMAKING SCHEDULER
    try {
        initializeMatchmakingScheduler();
        logger.info("Matchmaking scheduler initialized");
    } catch (error) {
        logger.error({ err: error }, "Failed to initialize matchmaking scheduler");
    }
});

/* ======================================================
   🛡️ PROCESS-LEVEL SAFETY NETS
   ====================================================== */
process.on("unhandledRejection", (reason) => {
    logger.fatal({ err: reason }, "unhandledRejection");
});

process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "uncaughtException");
    process.exit(1); // Docker restarts the container
});

process.on("SIGTERM", () => {
    logger.info("SIGTERM received, shutting down");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
});
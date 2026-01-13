import express from "express";
import cors from "cors";
import "dotenv/config";
import cookieParser from "cookie-parser";
import { authMiddleware } from "./middlewares/auth.middleware.js";
import userRoutes from "./modules/user/user.routes.js";
import authRoutes from "./modules/auth/auth.routes.js";
import profileRoutes from "./modules/profile/profile.routes.js";
// import favouriteRoutes from "./modules/favourite/favourite.routes.js";
import teamRoutes from "./modules/team/team.routes.js";
import tournamentRoutes from "./modules/tournament/tournament.routes.js";
import matchRoutes from "./modules/match/match.routes.js";
import locationRoutes from "./modules/location/location.routes.js";
import sportRoutes from "./modules/sport/sport.routes.js";

const app = express();
const PORT = process.env.PORT || 3001;

/* ======================================================
   1️⃣ TRUST PROXY (if behind LB later)
   ====================================================== */
app.set("trust proxy", 1);

/* ======================================================
   2️⃣ CORS (Flutter-friendly)
   ====================================================== */
app.use(
    cors({
        origin: true, // Flutter mobile + Flutter web
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

/* ======================================================
   3️⃣ COOKIE PARSER
   ====================================================== */
app.use(cookieParser());

/* ======================================================
   4️⃣ BODY PARSERS
   ====================================================== */
app.use((req, res, next) => {
    const contentType = req.headers["content-type"] || "";
    if (contentType.startsWith("multipart/form-data")) return next();
    express.json({ limit: "10mb" })(req, res, next);
});

app.use(express.urlencoded({ extended: true }));

/* ======================================================
   5️⃣ REQUEST LOGGER (GLOBAL)
   ====================================================== */
app.use((req, res, next) => {
    const start = Date.now();

    res.on("finish", () => {
        const duration = Date.now() - start;
        const userId = req.user?.id || "anonymous";

        console.log(
            `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms) | user=${userId}`
        );
    });

    next();
});

/* ======================================================
   6️⃣ HEALTH CHECK
   ====================================================== */
app.get("/health", (req, res) => {
    res.json({
        status: "Backend running ✅",
        timestamp: new Date().toISOString(),
    });
});

/* ======================================================
   7️⃣ AUTH (ALL APIs BELOW ARE PROTECTED)
   ====================================================== */
app.use(authMiddleware);

/* ======================================================
   8️⃣ ROUTES
   ====================================================== */


app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/profiles", profileRoutes);
// app.use("/api/favourites", favouriteRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/sports", sportRoutes);


/* ======================================================
   9️⃣ 404 HANDLER
   ====================================================== */
app.use((req, res) => {
    res.status(404).json({
        error: "NOT_FOUND",
        message: "Route does not exist",
    });
});

/* ======================================================
   🔟 GLOBAL ERROR HANDLER
   ====================================================== */
app.use((err, req, res, next) => {
    console.error("🔥 Error:", err);

    res.status(err.status || 500).json({
        error: err.code || "INTERNAL_SERVER_ERROR",
        message: err.message || "Something went wrong",
    });
});

/* ======================================================
   🚀 START SERVER
   ====================================================== */
app.listen(PORT, "127.0.0.1", () => {
    console.log(`🚀 Backend running on http://127.0.0.1:${PORT}`);
});

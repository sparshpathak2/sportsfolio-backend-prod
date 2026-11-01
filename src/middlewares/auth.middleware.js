import prisma from "../lib/prisma.js";
import { logger, requestContext } from "../lib/logger.js";

export const authMiddleware = async (req, res, next) => {
    // ✅ Always allow preflight
    if (req.method === "OPTIONS") return next();

    // ✅ Allow POST to /users/ exactly
    if (req.method === "POST" && req.path === "/api/users/") {
        return next();
    }

    const publicRoutes = [
        "/auth/login",
        "/auth/signup",
        "/auth/request-otp",
        "/auth/verify-otp",
        "/auth/verify-token",
        "/health",
        "/test/notification",
    ];

    if (publicRoutes.some((route) => req.path.endsWith(route))) {
        return next();
    }

    const sessionId = req.headers["x-session-id"] || req.cookies?.sessionId;

    if (!sessionId) {
        logger.warn({ reason: "no_session_id" }, "Auth rejected");
        return res.status(401).json({
            error: "UNAUTHORIZED",
            message: "Session not found",
        });
    }

    try {
        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: {
                user: {
                    select: {
                        id: true,
                        phone: true,
                        email: true,
                        username: true,
                        name: true,
                        city: true,
                    },
                },
            },
        });

        if (!session || session.expiresAt < new Date()) {
            logger.warn(
                { reason: session ? "session_expired" : "session_not_found" },
                "Auth rejected"
            );
            return res.status(401).json({
                error: "SESSION_EXPIRED",
                message: "Session expired or invalid",
            });
        }

        req.user = session.user;

        // Tag every later log line of this request with the user
        const ctx = requestContext.getStore();
        if (ctx) ctx.userId = session.user.id;

        // Optional: propagate for internal usage
        req.headers["x-user-id"] = session.user.id;

        next();
    } catch (error) {
        logger.error({ err: error }, "Auth middleware error");
        return res.status(500).json({
            error: "AUTH_ERROR",
            message: "Authentication failed",
        });
    }
};
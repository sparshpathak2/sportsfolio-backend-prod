import prisma from "../lib/prisma.js";

export const authMiddleware = async (req, res, next) => {
    // ✅ Always allow preflight
    if (req.method === "OPTIONS") return next();

    const publicRoutes = [
        "/auth/login",
        "/auth/signup",
        "/auth/request-otp",
        "/auth/verify-otp",
        "/health",
    ];

    if (publicRoutes.some(route => req.path.endsWith(route))) {
        return next();
    }

    const sessionId =
        req.headers["x-session-id"] || req.cookies?.sessionId;

    if (!sessionId) {
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
            return res.status(401).json({
                error: "SESSION_EXPIRED",
                message: "Session expired or invalid",
            });
        }

        req.user = session.user;

        // Optional: propagate for internal usage
        req.headers["x-user-id"] = session.user.id;

        next();
    } catch (error) {
        console.error("Auth middleware error:", error);
        return res.status(500).json({
            error: "AUTH_ERROR",
            message: "Authentication failed",
        });
    }
};

import pino from "pino";
import { AsyncLocalStorage } from "node:async_hooks";

// Holds per-request data so ANY logger call (controller, service, prisma) is tagged automatically
export const requestContext = new AsyncLocalStorage();

const isProd = process.env.NODE_ENV === "production";

export const logger = pino({
    level: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
    base: { service: "sportsfolio-backend" },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ level: label }) },
    mixin() {
        const ctx = requestContext.getStore();
        return ctx ? { requestId: ctx.requestId, userId: ctx.userId } : {};
    },
    redact: {
        paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            'req.headers["x-session-id"]',
            'res.headers["set-cookie"]',
            "*.password",
            "*.otp",
            "*.token",
            "*.fcmToken",
            "*.sessionId",
            "*.code",
        ],
        censor: "[REDACTED]",
    },
    ...(!isProd && {
        transport: { target: "pino-pretty", options: { colorize: true } },
    }),
});

export const maskPhone = (phone) => {
    const s = String(phone || "");
    return s.length > 4 ? `${"*".repeat(s.length - 4)}${s.slice(-4)}` : "****";
};
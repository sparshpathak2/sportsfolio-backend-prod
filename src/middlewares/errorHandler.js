import { logger } from "../lib/logger.js";

export const notFoundHandler = (req, res) => {
    res.status(404).json({
        error: "NOT_FOUND",
        message: "Route does not exist",
        requestId: req.id,
    });
};

export const errorHandler = (err, req, res, next) => {
    if (res.headersSent) return next(err);

    const status = err.status || err.statusCode || 500;

    logger[status >= 500 ? "error" : "warn"](
        {
            err,
            status,
            method: req.method,
            path: req.originalUrl.split("?")[0],
            bodyKeys: Object.keys(req.body || {}), // field names only, never values
            prismaCode:
                typeof err.code === "string" && err.code.startsWith("P") ? err.code : undefined,
        },
        err.message
    );

    res.status(status).json({
        error: status >= 500 ? "INTERNAL_SERVER_ERROR" : err.code || "BAD_REQUEST",
        message: status >= 500 ? "Something went wrong" : err.message,
        requestId: req.id,
    });
};
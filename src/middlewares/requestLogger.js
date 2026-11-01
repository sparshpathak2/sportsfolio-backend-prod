import { randomUUID } from "node:crypto";
import pinoHttp from "pino-http";
import { logger, requestContext } from "../lib/logger.js";

const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

// Reuse the client's/nginx's request ID if valid, otherwise create one
export const requestId = (req, res, next) => {
  const incoming = req.headers["x-request-id"];
  req.id = SAFE_ID.test(incoming || "") ? incoming : randomUUID();
  res.setHeader("X-Request-Id", req.id);
  requestContext.run({ requestId: req.id }, next);
};

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.id,
  autoLogging: { ignore: (req) => req.url === "/health" },
  customLogLevel: (req, res, err) =>
    err || res.statusCode >= 500
      ? "error"
      : res.statusCode >= 400
        ? "warn"
        : "info",
  customSuccessMessage: (req, res) =>
    `${req.method} ${(req.originalUrl || req.url).split("?")[0]} ${res.statusCode}`,
  customErrorMessage: (req, res) =>
    `${req.method} ${(req.originalUrl || req.url).split("?")[0]} ${res.statusCode} failed`,
  customProps: (req) => ({
    clientPlatform: req.headers["x-client-platform"],
    appVersion: req.headers["x-app-version"],
  }),
  serializers: {
    // No headers, no query string (can hold tokens), no body
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url.split("?")[0],
      ip: req.remoteAddress,
      userAgent: req.headers?.["user-agent"],
    }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});

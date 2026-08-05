# ---- Stage 1: builder ----
# Debian-based (not Alpine) to match prisma/schema.prisma's binaryTargets,
# which already specifies "debian-openssl-3.0.x" rather than a musl target.
FROM node:20-slim AS builder

WORKDIR /app

# python3/make/g++ needed to compile bcrypt's native bindings.
# openssl needed so Prisma can correctly detect the OpenSSL version at
# generate-time and at runtime — node:20-slim doesn't ship it by default,
# which causes the "could not locate the Query Engine" mismatch error.
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ openssl && \
    rm -rf /var/lib/apt/lists/*

# Layer-cache friendly: deps change less often than source
COPY package*.json ./
COPY prisma ./prisma

RUN npm ci --ignore-scripts
# --ignore-scripts blocks postinstall scripts across ALL deps (supply-chain
# protection, see SOP). bcrypt needs its own install script to compile native
# bindings though, so rebuild just that one package explicitly instead of
# lifting --ignore-scripts for everything.
# NOTE: if your code actually only imports bcryptjs (pure JS, no native
# bindings) and not bcrypt, you can delete this line and drop bcrypt from
# package.json entirely — one less native dependency to worry about.
RUN npm rebuild bcrypt --build-from-source

# Now bring in the rest of the source
COPY . .

RUN npx prisma generate
RUN npm prune --omit=dev

# ---- Stage 2: runtime ----
FROM node:20-slim

# Same reason as the builder stage: the Prisma query engine needs OpenSSL
# present at runtime too, not just at generate-time.
RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Non-root user (SOP Part 2) — Debian syntax
RUN groupadd -r appgroup && useradd -r -g appgroup -m appuser

WORKDIR /app

COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package*.json ./
COPY --from=builder --chown=appuser:appgroup /app/prisma ./prisma
COPY --chown=appuser:appgroup . .

# Drop anything not needed at runtime that COPY . . might have pulled in
RUN rm -rf ./.git ./tests ./.github 2>/dev/null || true

USER appuser

ENV NODE_ENV=production
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/index.js"]
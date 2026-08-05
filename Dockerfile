# ---- Stage 1: builder ----
# Installs ALL deps (incl. dev, since prisma CLI is needed to generate the
# client), generates the Prisma client, then prunes dev deps back out.
FROM node:20-alpine AS builder

WORKDIR /app

# python3/make/g++ are needed to compile bcrypt's native bindings below.
# Alpine has no prebuilt bcrypt binary, unlike Debian-based images.
RUN apk add --no-cache python3 make g++

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
FROM node:20-alpine

# Non-root user (SOP Part 2)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

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
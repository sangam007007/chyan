# Backend Dockerfile — Node.js 20 Alpine
FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/backend/package.json ./packages/backend/
RUN npm ci --workspace=packages/backend

# Development stage
FROM base AS development
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/backend/node_modules ./packages/backend/node_modules
COPY packages/backend ./packages/backend
COPY package.json ./

ENV NODE_ENV=development
EXPOSE 4000

CMD ["npm", "run", "dev", "--workspace=packages/backend"]

# Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/backend/node_modules ./packages/backend/node_modules
COPY packages/backend ./packages/backend
COPY package.json tsconfig.json ./

RUN npm run build --workspace=packages/backend

# Production stage
FROM base AS production
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

COPY --from=builder --chown=appuser:nodejs /app/packages/backend/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/packages/backend/package.json ./package.json

USER appuser

EXPOSE 4000

CMD ["node", "dist/index.js"]

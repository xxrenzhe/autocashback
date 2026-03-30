FROM node:22-bookworm-slim AS base

WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/package.json
COPY apps/scheduler/package.json apps/scheduler/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm install

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends supervisor nginx \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app /app

RUN chmod +x /app/scripts/docker-entrypoint.sh

EXPOSE 80

ENV PORT=3000

CMD ["/app/scripts/docker-entrypoint.sh"]

# Build from the monorepo root: docker build -f apps/api/Dockerfile .
# (the API depends on the sibling @qassemiya/shared-types workspace package)

FROM node:20-bookworm-slim AS base

# openssl: required by Prisma's query engine binary.
# python3/make/g++: argon2 has no prebuilt binary for every platform/Node
# combo and falls back to compiling its native addon via node-gyp at install
# time -- without a compiler toolchain that install step fails outright.
# chromium + fonts: invoices.service.ts renders invoice PDFs via Puppeteer;
# installing a system Chromium is far smaller/faster than letting Puppeteer
# download its own, and PUPPETEER_SKIP_DOWNLOAD below skips that download.
# fonts-noto-core: the invoice template is Arabic-only -- fonts-liberation
# only covers Latin glyphs, so without an Arabic-capable font Chromium has
# nothing to shape Arabic text with and renders tofu boxes instead.
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl \
      python3 \
      make \
      g++ \
      chromium \
      fonts-liberation \
      fonts-noto-core \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

# ---- install only what @qassemiya/api needs (plus its workspace deps) ----
# Every workspace package's manifest must be present for pnpm to reconcile
# pnpm-lock.yaml against pnpm-workspace.yaml's globs, even though apps/web
# and apps/pos are never actually installed by the --filter below.
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/pos/package.json apps/pos/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN pnpm install --frozen-lockfile --filter @qassemiya/api...

# ---- generate the Prisma client (needs the schema, not a live DB) ----
FROM deps AS build
COPY apps/api apps/api
COPY packages/shared-types packages/shared-types
RUN pnpm --filter @qassemiya/api db:generate

# ---- runtime ----
# apps/api's own "build" script is a typecheck only (tsconfig.build.json
# sets noEmit), so this runs the same way "pnpm start" already does in
# every other environment: via ts-node, not a compiled dist/.
FROM build AS runtime
ENV NODE_ENV=production
WORKDIR /app/apps/api
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["sh", "-c", "pnpm db:deploy && pnpm start"]

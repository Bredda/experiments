# syntax=docker/dockerfile:1
#
# Build from the repository root:
#   docker build -f apps/api/Dockerfile -t experiments-api .

FROM node:24-slim AS base
WORKDIR /app
# pnpm comes from "packageManager" in package.json.
COPY package.json ./
RUN corepack enable && corepack install

# Production dependencies of the api and of the workspace packages it uses.
# Scripts are skipped: the root "prepare" script installs git hooks (husky).
FROM base AS deps
COPY . .
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts --filter "api..."

FROM base AS runtime
ENV NODE_ENV=production \
    ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=8080 \
    DB_PATH=/data/simulation.db

# The workspace packages export TypeScript source and the api runs it with tsx,
# so the workspace layout is kept as is.
COPY --from=deps /app/pnpm-workspace.yaml ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/api ./apps/api

# The database lives on a volume so runs survive the container.
RUN mkdir /data && chown node:node /data
VOLUME /data

USER node
WORKDIR /app/apps/api
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||8080)+'/healthz/live').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node_modules/.bin/tsx", "src/index.ts"]

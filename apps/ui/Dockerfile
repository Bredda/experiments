# syntax=docker/dockerfile:1
#
# Build from the repository root:
#   docker build -f apps/ui/Dockerfile -t experiments-ui .
#
# NEXT_PUBLIC_API_URL is where the *browser* reaches the api. It is inlined at
# build time, so an image is only right for the address it was built with.
# Server-side rendering uses the runtime variable API_URL instead.

FROM node:24-slim AS base
WORKDIR /app
# pnpm comes from "packageManager" in package.json.
COPY package.json ./
RUN corepack enable && corepack install

FROM base AS build
COPY . .
# Scripts are skipped: the root "prepare" script installs git hooks (husky).
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts --filter "ui..."
ARG NEXT_PUBLIC_API_URL=http://localhost:8080
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_TELEMETRY_DISABLED=1
# Fonts are fetched from Google at build time (next/font).
RUN pnpm --filter ui build

FROM node:24-slim AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app

# The standalone output mirrors the workspace layout from the tracing root.
COPY --from=build /app/apps/ui/.next/standalone ./
COPY --from=build /app/apps/ui/.next/static ./apps/ui/.next/static
COPY --from=build /app/apps/ui/public ./apps/ui/public

USER node
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.status<500?0:1),()=>process.exit(1))"

CMD ["node", "apps/ui/server.js"]

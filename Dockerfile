# Production image for FreelanceFlow AI (Next.js standalone output + Prisma).
# Build it off the server (2 GB RAM is tight for a Next.js build):
#   docker build --platform linux/amd64 -t freelanceflow-app:<tag> .
# No secrets are needed at build time; all configuration is read at runtime.

FROM node:24-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ── Dependencies (cached unless the lockfile or schema changes) ──────────────
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# ── Build ────────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_OUTPUT=standalone \
    NEXT_LOW_MEMORY_BUILD=1
# Placeholder only so prerendering doesn't log Better Auth's "default secret" error. This stage
# is not part of the final image; the real secret comes from the runtime environment.
RUN BETTER_AUTH_SECRET=build-time-placeholder-not-used-at-runtime npx prisma generate \
  && BETTER_AUTH_SECRET=build-time-placeholder-not-used-at-runtime npx next build

# ── Prisma CLI for `migrate deploy` (kept apart from the app's dependencies) ─
FROM base AS prisma-cli
WORKDIR /opt/prisma-cli
RUN printf '%s' '{"private":true,"dependencies":{"prisma":"6.19.3"},"allowScripts":{"prisma@6.19.3":true,"@prisma/engines@6.19.3":true}}' > package.json \
  && npm install --no-audit --no-fund \
  && npm cache clean --force

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=prisma-cli --chown=node:node /opt/prisma-cli /opt/prisma-cli
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]

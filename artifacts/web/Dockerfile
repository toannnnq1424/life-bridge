FROM node:22.22.0-bookworm-slim@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94 AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/web apps/web
COPY packages/contracts packages/contracts
COPY tools/quality/src/p6-s2-sbom.ts tools/quality/src/p6-s2-sbom.ts
RUN pnpm install --frozen-lockfile && pnpm --filter @lifebridge/web build && node --experimental-strip-types tools/quality/src/p6-s2-sbom.ts /sbom web
FROM node:22.22.0-bookworm-slim@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94
USER node
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
COPY --from=build --chown=node:node /sbom ./sbom
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
EXPOSE 3000
CMD ["node","apps/web/server.js"]

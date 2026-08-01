FROM node:22.22.0-bookworm-slim@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94 AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.build.json ./
COPY services/identity-consent services/identity-consent
COPY packages/config packages/config
COPY packages/contracts packages/contracts
COPY packages/observability packages/observability
COPY tools/quality/src/p6-s2-sbom.ts tools/quality/src/p6-s2-sbom.ts
RUN pnpm install --frozen-lockfile && pnpm --filter @lifebridge/identity-consent build && pnpm --filter @lifebridge/identity-consent deploy --prod --legacy /artifact
RUN cp services/identity-consent/dist/main.mjs /artifact/dist/main.mjs && cp -r services/identity-consent/migrations /artifact/migrations && node --experimental-strip-types tools/quality/src/p6-s2-sbom.ts /artifact/sbom identity-consent
FROM node:22.22.0-bookworm-slim@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94
USER node
WORKDIR /app
COPY --from=build --chown=node:node /artifact ./
ENV NODE_ENV=production IDENTITY_HOST=0.0.0.0
EXPOSE 3100
CMD ["node","dist/main.mjs"]

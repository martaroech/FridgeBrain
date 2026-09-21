# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS dipendenze
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@11.19.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dipendenze AS compilazione
ENV FRIDGEBRAIN_DISTRIBUZIONE=autonoma
COPY . .
RUN mkdir -p public && pnpm build

FROM node:24-bookworm-slim AS esecuzione
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    FRIDGEBRAIN_DATI=/app/data \
    FRIDGEBRAIN_GENERATORE=disabilitato \
    PYTHONUNBUFFERED=1

# Python permette il backup consistente SQLite anche dal contenitore.
RUN apt-get update && apt-get install -y --no-install-recommends python3 \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/data /app/.next/cache \
    && chown -R node:node /app
COPY --from=compilazione --chown=node:node /app/.next/standalone ./
COPY --from=compilazione --chown=node:node /app/.next/static ./.next/static
COPY --from=compilazione --chown=node:node /app/public ./public
COPY --chown=node:node scripts/backup_dati.py ./scripts/

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/api/salute').then(risposta=>process.exit(risposta.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

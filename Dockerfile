# ---- Build Stage ----
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Runtime Stage ----
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && \
    npx playwright install --with-deps chromium && \
    rm -rf /tmp/* /root/.cache/ms-playwright/.links

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js", "--http"]

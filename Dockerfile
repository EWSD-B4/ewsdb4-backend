FROM node:25-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci && \
    npm cache clean --force

COPY . .

RUN npm run build

FROM node:25-alpine

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p logs && \
    chown nodejs:nodejs logs

COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

RUN mkdir -p logs && \
    chown -R nodejs:nodejs logs

USER nodejs

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]

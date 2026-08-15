FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY gateway/tsconfig.json ./gateway/tsconfig.json
COPY gateway/src ./gateway/src
RUN ./node_modules/.bin/tsc -p gateway/tsconfig.json

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/gateway/dist ./gateway/dist

USER node
EXPOSE 8080
CMD ["node", "gateway/dist/index.js"]

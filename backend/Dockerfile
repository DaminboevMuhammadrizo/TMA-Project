# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Prisma's query/schema engines need OpenSSL — Alpine doesn't ship it by
# default, and without it Prisma silently guesses wrong and fails at runtime
# with "Could not parse schema engine response".
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npx prisma generate
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev
RUN npx prisma generate

COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main.js"]

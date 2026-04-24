FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache sqlite
COPY --from=build /app /app
ENV NODE_ENV=production
ENV DB_PATH=/data/smartfarm.db
VOLUME ["/data"]
EXPOSE 4000
CMD ["node", "src/server.js"]

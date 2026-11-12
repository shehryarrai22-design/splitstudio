# SplitStudio container for Google Cloud Run.
# Includes native FFmpeg/FFprobe; app listens on Cloud Run's PORT.
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Install dependencies needed to compile the frontend and run the TypeScript server.
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_DIR=/data
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /data

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server.ts ./server.ts
COPY --from=build /app/server ./server
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/index.html ./index.html

EXPOSE 8080
CMD ["npm", "start"]

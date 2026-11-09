FROM node:24-slim

ARG YT_DLP_VERSION=2026.07.04

# Install ffmpeg + yt-dlp
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg python3 curl ca-certificates && \
    if [ "$YT_DLP_VERSION" = "latest" ]; then \
      curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp; \
    else \
      curl -fsSL "https://github.com/yt-dlp/yt-dlp/releases/download/$YT_DLP_VERSION/yt-dlp" -o /usr/local/bin/yt-dlp; \
    fi && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    /usr/local/bin/yt-dlp --version && \
    python3 --version && \
    ffmpeg -version | head -1 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]

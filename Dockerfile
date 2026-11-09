FROM node:24-slim

ARG YT_DLP_VERSION=2026.10.26
ARG DENO_VERSION=2.9.8
ARG TARGETARCH

# Install ffmpeg, Deno, and yt-dlp.
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg python3 curl ca-certificates unzip && \
    case "${TARGETARCH:-amd64}" in \
      amd64) DENO_TARGET="x86_64-unknown-linux-gnu" ;; \
      arm64) DENO_TARGET="aarch64-unknown-linux-gnu" ;; \
      *) echo "Unsupported Docker architecture: ${TARGETARCH:-amd64}" >&2; exit 1 ;; \
    esac && \
    curl -fsSL "https://github.com/denoland/deno/releases/download/v${DENO_VERSION}/deno-${DENO_TARGET}.zip" -o /tmp/deno.zip && \
    unzip -p /tmp/deno.zip deno > /usr/local/bin/deno && \
    chmod a+rx /usr/local/bin/deno && \
    if [ "$YT_DLP_VERSION" = "latest" ]; then \
      curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp; \
    else \
      curl -fsSL "https://github.com/yt-dlp/yt-dlp/releases/download/$YT_DLP_VERSION/yt-dlp" -o /usr/local/bin/yt-dlp; \
    fi && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    /usr/local/bin/deno --version && \
    /usr/local/bin/yt-dlp --version && \
    python3 --version && \
    ffmpeg -version | head -1 && \
    rm -f /tmp/deno.zip && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]

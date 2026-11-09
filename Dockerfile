FROM node:24-slim

ARG YT_DLP_VERSION=2026.10.26
ARG DENO_VERSION=2.9.8
ARG BGUTIL_VERSION=2.0.2
ARG TARGETARCH

# Build the BgUtils HTTP token provider and install yt-dlp with its plugin.
# The provider is bound to loopback only; it is never exposed publicly.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ffmpeg python3 python3-venv git curl ca-certificates unzip \
      build-essential pkg-config libcairo2-dev libpango1.0-dev \
      libjpeg-dev libgif-dev librsvg2-dev && \
    case "${TARGETARCH:-amd64}" in \
      amd64) DENO_TARGET="x86_64-unknown-linux-gnu" ;; \
      arm64) DENO_TARGET="aarch64-unknown-linux-gnu" ;; \
      *) echo "Unsupported Docker architecture: ${TARGETARCH:-amd64}" >&2; exit 1 ;; \
    esac && \
    curl -fsSL "https://github.com/denoland/deno/releases/download/v${DENO_VERSION}/deno-${DENO_TARGET}.zip" -o /tmp/deno.zip && \
    unzip -p /tmp/deno.zip deno > /usr/local/bin/deno && \
    chmod a+rx /usr/local/bin/deno && \
    python3 -m venv /opt/yt-dlp-venv && \
    /opt/yt-dlp-venv/bin/pip install --no-cache-dir \
      "yt-dlp==${YT_DLP_VERSION}" \
      "bgutil-ytdlp-pot-provider==${BGUTIL_VERSION}" && \
    git clone --depth 1 --branch "${BGUTIL_VERSION}" \
      https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git \
      /opt/bgutil-ytdlp-pot-provider && \
    cd /opt/bgutil-ytdlp-pot-provider/server && \
    npm ci && npx tsc && \
    /usr/local/bin/deno --version && \
    /opt/yt-dlp-venv/bin/yt-dlp --version && \
    node /opt/bgutil-ytdlp-pot-provider/server/build/main.js --help >/dev/null 2>&1 || true

ENV YT_DLP_PATH=/opt/yt-dlp-venv/bin/yt-dlp
ENV YT_DLP_JS_RUNTIME_PATH=/usr/local/bin/deno
ENV BGUTIL_PROVIDER_ENTRYPOINT=/opt/bgutil-ytdlp-pot-provider/server/build/main.js
ENV BGUTIL_POT_PROVIDER_URL=http://127.0.0.1:4416
ENV BGUTIL_POT_PROVIDER_HOST=127.0.0.1
ENV BGUTIL_POT_PROVIDER_PORT=4416

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]

# TCOS Finance Tracking — API
#
# This image exists for one reason: PDF rendering. `GET /reimbursements/:id/document?format=pdf`
# drives Puppeteer, and Railway's auto-detected Nixpacks Node image ships Node but none of
# Chromium's shared libraries — so `format=html` worked while every PDF request returned 500.
# Point the Railway service at this Dockerfile instead of letting it auto-detect.
#
# Chromium comes from Debian here rather than from puppeteer's own download, so the binary and
# its libraries are always the matching pair and the image doesn't carry two copies.

FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# chromium + the fonts the documents actually need. Without a Thai font the rendered PDF is a
# page of tofu boxes: every template is Thai, and Debian slim ships no Thai coverage at all.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      fonts-thai-tlwg \
      ca-certificates \
      dumb-init \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy manifests first so `npm ci` is cached until dependencies actually change.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# Chromium's sandbox needs privileges the container doesn't grant, which is why PDF.util.js
# launches with --no-sandbox. Running as a non-root user is what keeps that acceptable.
RUN useradd --create-home --shell /bin/bash app && chown -R app:app /app
USER app

EXPOSE 4000

# dumb-init reaps the zombie processes Chromium leaves behind — without an init, a long-running
# container accumulates defunct renderer processes until it runs out of PIDs.
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]

# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Cache node_modules layer separately
COPY package*.json ./
RUN npm ci --prefer-offline

COPY . .
RUN npm run build

# ── Stage 2: nginx runtime ────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Non-root: nginx runs as nginx user (uid 101) on alpine image by default
# Copy custom nginx config
COPY --from=build /app/dist /usr/share/nginx/html

# SPA routing: 404 → index.html, security headers
RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    gzip on;\n\
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;\n\
    add_header X-Frame-Options DENY;\n\
    add_header X-Content-Type-Options nosniff;\n\
    add_header Referrer-Policy strict-origin-when-cross-origin;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
    location /health {\n\
        return 200 "ok";\n\
        add_header Content-Type text/plain;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost/health || exit 1

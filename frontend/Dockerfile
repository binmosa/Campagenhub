# ---- Build stage ----
# The API address is baked in at build time (Vite inlines import.meta.env),
# so it has to be known here. On the single-VPS stack the app and the API
# share an origin, which is why the default is a bare "/api" — no CORS, no
# second domain, no mixed-content risk.
FROM node:22-alpine AS build
WORKDIR /app

ARG VITE_API_BASE_URL=/api

COPY package.json package-lock.json ./

# @heroui-pro/react ships from npm as a stub whose postinstall downloads the
# real bundle. That download needs a *CI/CD licence key* in HEROUI_AUTH_TOKEN
# — the token used by `npx heroui-pro login` on a workstation is a different
# thing and the postinstall rejects it with "Invalid or inactive CI/CD
# license key". Get the CI key from the HeroUI Pro dashboard.
#
# It arrives as a BuildKit secret, so it never lands in a layer, an image or
# the build log. If you do not have one yet, build with Dockerfile.prebuilt
# instead (see FRONTEND_DOCKERFILE in docker-compose.yml).
RUN --mount=type=secret,id=heroui_token \
    if [ -s /run/secrets/heroui_token ]; then \
      export HEROUI_AUTH_TOKEN="$(cat /run/secrets/heroui_token)"; \
    fi && \
    npm ci

COPY . .
RUN VITE_API_BASE_URL="$VITE_API_BASE_URL" npm run build

# ---- Runtime stage ----
# Static files only. The edge proxy in docker-compose terminates TLS and
# routes /api and /uploads to the backend; everything else lands here.
FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY deploy/static.Caddyfile /etc/caddy/Caddyfile
EXPOSE 80

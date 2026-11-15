# Web image: builds the Angular app and serves it with Caddy, which also
# proxies /api to the API container and gets HTTPS certificates automatically.
# Build from the frontend folder:  docker build -t umbrella-web .
FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/dist/umbrella-web/browser /srv

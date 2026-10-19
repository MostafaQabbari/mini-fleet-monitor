FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# vite inlines these at build time, so they are build args rather than runtime env
ARG VITE_API_URL=http://localhost:3000
ARG VITE_WS_URL=ws://localhost:3000/ws
RUN npm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

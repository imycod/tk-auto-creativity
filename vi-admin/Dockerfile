FROM node:22-alpine AS build-stage

WORKDIR /app
RUN corepack enable
RUN corepack prepare pnpm@10.17.1 --activate

RUN npm config set registry https://registry.npmmirror.com

COPY .npmrc package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:stable-alpine AS production-stage

# 把你的nginx配置覆盖默认配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build-stage /app/dist /usr/share/nginx/html
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
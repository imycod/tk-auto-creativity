# syntax=docker/dockerfile:1

############################
# 1) 依赖 + 构建阶段
############################
FROM node:20.20.2-bookworm-slim AS builder

# better-sqlite3 是原生模块，若预编译二进制缺失需要这些工具现场编�?
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# 固定 pnpm �?v10（pnpm 11 不再读取 package.json �?"pnpm.onlyBuiltDependencies"�?
# 会跳�?better-sqlite3 的原生编译并�?ERR_PNPM_IGNORED_BUILDS；v10 兼容 lockfile 9.0）�?
# 用国内镜像通过 npm 安装，避�?corepack 拉取 tarball 超时�?
RUN npm install -g pnpm@10.34.4 --registry=https://registry.npmmirror.com

WORKDIR /app

# 先复制依赖清单，利用 Docker 层缓�?
COPY package.json pnpm-lock.yaml .npmrc ./

# 安装全部依赖（含 devDependencies，构建需�?nest cli / ts�?
RUN pnpm install --frozen-lockfile

# 复制源码并构�?
COPY . .
RUN pnpm run build

# 只保留生产依赖，缩小体积
RUN pnpm prune --prod

############################
# 2) 运行阶段
############################
FROM node:20.20.2-bookworm-slim AS runner

ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/app/data/auto-ve.db

WORKDIR /app

# 拷贝构建产物与生产依�?
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# 数据�?/ 运行期数据目录（建议运行时用 -v 挂载持久化）
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "dist/main"]

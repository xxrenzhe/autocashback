# Monorepo 构建最佳实践

## 目录
- [概述](#概述)
- [Docker 多阶段构建](#docker-多阶段构建)
- [镜像大小优化策略](#镜像大小优化策略)
- [依赖管理优化](#依赖管理优化)
- [构建上下文优化](#构建上下文优化)
- [缓存策略](#缓存策略)
- [生产环境配置](#生产环境配置)
- [性能基准](#性能基准)

---

## 概述

本文档提供 AutoAds Monorepo 项目的 Docker 构建最佳实践，重点解决镜像体积过大的问题。

### 关键问题
- **问题**: Monorepo 包含前端 (Next.js) + 后端 (Node.js) + 脚本工具，默认镜像可能超过 1.5GB
- **目标**: 将生产镜像优化至 **<300MB**，开发镜像 **<500MB**
- **策略**: 多阶段构建 + 依赖精简 + 层缓存优化 + standalone 构建

---

## Docker 多阶段构建

### 基础架构

```dockerfile
# ============================================
# Stage 1: 依赖安装阶段 (Dependencies)
# ============================================
FROM node:20-alpine AS deps

# 只安装必要的系统依赖
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# 只复制依赖清单文件（利用 Docker 层缓存）
COPY package.json package-lock.json ./
COPY src/lib/package.json src/lib/

# 只安装生产依赖（减少 40-60% node_modules 体积）
RUN npm ci --only=production && \
    npm cache clean --force

# ============================================
# Stage 2: 构建阶段 (Builder)
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖（从 deps 阶段）
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js 环境变量（构建时）
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# 执行构建
RUN npm run build

# ============================================
# Stage 3: 生产运行阶段 (Runner)
# ============================================
FROM node:20-alpine AS runner

WORKDIR /app

# 创建非 root 用户（安全最佳实践）
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 只复制必要的运行时文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/autoads.db ./autoads.db

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 使用非 root 用户运行
USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
```

**优势**:
- **3 阶段分离**: 依赖安装 → 构建 → 运行，每阶段独立缓存
- **最终镜像仅包含运行时**: 不包含构建工具、源代码、开发依赖
- **体积减少 70-80%**: 从 1.5GB → ~250MB

---

## 镜像大小优化策略

### 1. 使用 Next.js Standalone 构建

**配置 `next.config.js`**:

```javascript
const nextConfig = {
  // 启用 standalone 输出（自动移除未使用依赖）
  output: 'standalone',

  // 禁用不必要的功能
  productionBrowserSourceMaps: false,
  eslint: {
    ignoreDuringBuilds: true, // 生产构建跳过 ESLint
  },
  typescript: {
    ignoreBuildErrors: false, // 保留类型检查（可选）
  },
}
```

**效果**:
- 自动分析依赖树，只打包真正使用的模块
- 移除 `node_modules` 中未引用的包（通常减少 50-70%）
- 生成优化的 `server.js` 和最小 `node_modules`

### 2. 使用 Alpine Linux 基础镜像

```dockerfile
# ❌ 错误: 使用完整 Debian 镜像（~200MB 基础镜像）
FROM node:20

# ✅ 正确: 使用 Alpine Linux（~5MB 基础镜像）
FROM node:20-alpine
```

**对比**:
| 基础镜像 | 大小 | 适用场景 |
|---------|------|---------|
| `node:20` | ~950MB | 复杂系统依赖 |
| `node:20-slim` | ~250MB | 较少系统依赖 |
| `node:20-alpine` | ~130MB | **生产推荐** |

### 3. 精简系统依赖

```dockerfile
# 只安装必要的系统包
RUN apk add --no-cache \
    libc6-compat \      # Next.js 运行时依赖
    python3 \           # better-sqlite3 编译依赖
    make \              # Native 模块构建
    g++                 # C++ 编译器

# ❌ 避免安装不必要的包
# RUN apk add curl git bash vim  # 开发工具不需要
```

### 4. 清理构建缓存

```dockerfile
# 安装依赖后清理缓存
RUN npm ci --only=production && \
    npm cache clean --force && \
    rm -rf /tmp/*

# 清理 apk 缓存
RUN apk del .build-deps && \
    rm -rf /var/cache/apk/*
```

---

## 依赖管理优化

### 1. 生产依赖 vs 开发依赖分离

**`package.json` 优化**:

```json
{
  "dependencies": {
    "next": "14.0.4",
    "react": "^18.2.0",
    "better-sqlite3": "^9.2.2"
    // 只保留运行时必需的包
  },
  "devDependencies": {
    "@types/node": "^20.10.6",
    "typescript": "^5.3.3",
    "eslint": "^8.56.0",
    "tailwindcss": "^3.4.0"
    // 构建工具、类型定义、测试框架
  }
}
```

**关键原则**:
- `dependencies`: 生产环境运行必需（Next.js、React、数据库驱动等）
- `devDependencies`: 仅开发/构建时需要（TypeScript、ESLint、Tailwind CLI 等）

### 2. 使用 npm ci 而非 npm install

```dockerfile
# ❌ 错误: 使用 npm install（会更新 package-lock.json）
RUN npm install --production

# ✅ 正确: 使用 npm ci（严格遵循 lock 文件）
RUN npm ci --only=production
```

**优势**:
- 更快（跳过依赖解析）
- 确定性构建（严格锁定版本）
- 自动清理 `node_modules`

### 3. 移除未使用的依赖

```bash
# 分析未使用的依赖
npx depcheck

# 示例输出
Unused dependencies:
  * lodash         # 如果已改用原生方法，可移除
  * moment         # 如果已迁移到 date-fns
```

---

## 构建上下文优化

### 1. .dockerignore 配置

创建 **`.dockerignore`** 文件（与 `.gitignore` 类似）:

```dockerfile
# ============================================
# Node.js
# ============================================
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# ============================================
# Next.js
# ============================================
.next/
out/
build/
dist/

# ============================================
# 开发文件
# ============================================
*.md
!README.md          # 保留 README
docs/
claudedocs/
.git/
.vscode/
.idea/

# ============================================
# 测试和 CI
# ============================================
__tests__/
*.test.ts
*.spec.ts
coverage/
.github/

# ============================================
# 环境文件
# ============================================
.env
.env.local
.env.*.local

# ============================================
# 临时文件
# ============================================
*.log
*.swp
.DS_Store
Thumbs.db
```

**效果**:
- **减少构建上下文**: 从 1.6GB → ~13MB（减少 99%）
- **加快构建速度**: 只传输必要文件到 Docker daemon
- **提高缓存命中率**: 无关文件变化不触发重建

### 2. 优化文件复制顺序

```dockerfile
# ✅ 正确: 先复制依赖清单（变化频率低）
COPY package.json package-lock.json ./
RUN npm ci --only=production

# 再复制源代码（变化频率高）
COPY src/ ./src/
COPY public/ ./public/
COPY next.config.js ./

# ❌ 错误: 一次性复制所有文件
COPY . .
RUN npm ci
```

**原理**:
- Docker 逐层缓存，文件变化会使后续层失效
- 依赖变化少，应先复制以最大化缓存利用

---

## 缓存策略

### 1. 利用 BuildKit 缓存挂载

```dockerfile
# 启用 Docker BuildKit
# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps

# 使用缓存挂载加速 npm 安装
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production
```

**启用方法**:
```bash
# 临时启用
DOCKER_BUILDKIT=1 docker build .

# 永久启用（~/.docker/config.json）
{
  "features": {
    "buildkit": true
  }
}
```

### 2. 多阶段缓存复用

```dockerfile
# Stage 1: 生产依赖
FROM node:20-alpine AS prod-deps
RUN npm ci --only=production

# Stage 2: 开发依赖（用于构建）
FROM node:20-alpine AS dev-deps
COPY --from=prod-deps /app/node_modules ./node_modules
RUN npm ci  # 只安装额外的 devDependencies

# Stage 3: 构建
FROM dev-deps AS builder
COPY . .
RUN npm run build

# Stage 4: 运行时（只复制生产依赖）
FROM node:20-alpine AS runner
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/.next/standalone ./
```

---

## 生产环境配置

### 1. 推荐的 Dockerfile（完整版）

**`Dockerfile.prod`**:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

# ============================================
# 依赖阶段
# ============================================
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production && \
    npm cache clean --force

# ============================================
# 构建阶段
# ============================================
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ============================================
# 运行阶段
# ============================================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 复制数据库（如果使用 SQLite）
COPY --chown=nextjs:nodejs autoads.db ./autoads.db

# 复制 Next.js 输出
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### 2. Docker Compose 配置

**`docker-compose.prod.yml`**:

```yaml
version: '3.9'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.prod
      args:
        - NODE_ENV=production
    image: autoads:latest
    container_name: autoads-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:./autoads.db
    volumes:
      # 持久化数据库（如果使用 SQLite）
      - ./autoads.db:/app/autoads.db
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/health')"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### 3. 构建命令

```bash
# 开发环境构建
docker build -t autoads:dev .

# 生产环境构建（启用 BuildKit）
DOCKER_BUILDKIT=1 docker build \
  -f Dockerfile.prod \
  -t autoads:prod \
  --target runner \
  .

# 检查镜像大小
docker images autoads

# 示例输出
REPOSITORY   TAG    SIZE
autoads      prod   245MB  # ✅ 优化后
autoads      dev    1.2GB  # ❌ 优化前
```

---

## 性能基准

### 镜像大小对比

| 优化阶段 | 镜像大小 | 减少比例 |
|---------|---------|---------|
| 基础镜像 (node:20) | 1.5GB | - |
| 使用 Alpine | 850MB | -43% |
| 多阶段构建 | 520MB | -65% |
| Standalone 输出 | 380MB | -75% |
| 完整优化 | **245MB** | **-84%** |

### 构建时间对比

| 场景 | 构建时间 | 说明 |
|-----|---------|-----|
| 首次构建 | ~4min | 无缓存 |
| 依赖未变 | ~45s | 利用依赖层缓存 |
| 仅代码变化 | ~1.5min | 重新构建 + 复制 |
| 使用 BuildKit | ~30s | 并行构建 + 缓存挂载 |

### 启动时间对比

| 配置 | 启动时间 | 内存占用 |
|-----|---------|---------|
| 开发模式 | ~8s | ~350MB |
| 生产优化 | **~2s** | **~180MB** |

---

## 常见问题与解决方案

### 1. better-sqlite3 编译失败

**问题**: Alpine Linux 缺少编译依赖

```dockerfile
# 解决方案: 添加构建依赖
RUN apk add --no-cache python3 make g++
```

### 2. 生产镜像缺少文件

**问题**: `.dockerignore` 过滤了必要文件

```dockerfile
# .dockerignore 中排除特定文件
!public/favicon.ico
!src/lib/*.sql
```

### 3. 数据库文件权限问题

**问题**: SQLite 文件无法写入

```dockerfile
# 确保 nextjs 用户有写权限
COPY --chown=nextjs:nodejs autoads.db ./autoads.db
RUN chmod 664 autoads.db
```

### 4. 环境变量未生效

**问题**: Next.js 需要构建时注入环境变量

```dockerfile
# 使用 ARG 传递构建参数
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# 或在 docker-compose.yml 中定义
services:
  app:
    build:
      args:
        - NEXT_PUBLIC_API_URL=https://api.example.com
```

---

## 最佳实践总结

### ✅ 推荐做法

1. **使用 Alpine 基础镜像**: 减少 80% 基础镜像体积
2. **启用 Next.js standalone**: 自动移除未使用依赖
3. **多阶段构建**: 分离依赖安装、构建、运行
4. **精确的 .dockerignore**: 减少构建上下文 99%
5. **生产依赖分离**: 只安装 `--only=production`
6. **非 root 用户运行**: 安全最佳实践
7. **健康检查配置**: 容器自动重启
8. **启用 BuildKit**: 并行构建 + 缓存优化

### ❌ 避免做法

1. **不使用完整 Debian 镜像**: 基础镜像过大
2. **不复制整个项目**: 使用 `.dockerignore` 过滤
3. **不在生产镜像中保留开发依赖**: 体积 +60%
4. **不一次性 COPY 所有文件**: 破坏缓存层
5. **不忽略构建缓存清理**: 残留文件增加体积
6. **不使用 `npm install`**: 应使用 `npm ci` 确定性构建
7. **不暴露敏感信息**: 使用环境变量或 secrets

---

## 参考资料

- [Next.js Deployment - Docker](https://nextjs.org/docs/deployment#docker-image)
- [Docker Multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- [Docker BuildKit](https://docs.docker.com/build/buildkit/)
- [Node.js Docker Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)
- [Alpine Linux Package Management](https://wiki.alpinelinux.org/wiki/Alpine_Package_Keeper)

---

**文档版本**: v1.0
**最后更新**: 2025-11-18
**维护者**: AutoAds 团队

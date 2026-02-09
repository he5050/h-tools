# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

h-tools 是一个前端监控 SDK 的 monorepo 项目，目前包含 `@h-tools/monitor-sdk` 包。SDK 采用零外部依赖设计，纯浏览器 API 实现。

## 常用命令

```bash
# 安装依赖
pnpm install

# 构建所有包（通过 Turborepo）
pnpm build

# 生产环境构建（启用压缩，移除 console）
pnpm build:prod

# 运行测试
pnpm test

# 测试覆盖率
pnpm test:coverage

# 类型检查
pnpm typecheck

# 代码检查
pnpm lint

# 单独运行某个测试文件
pnpm --filter @h-tools/monitor-sdk test tests/fetch-interceptor.test.ts
```

## 架构设计

### 核心设计原则

- **主线程轻量化**：主线程只负责数据采集，计算/存储/上报全部在 Worker 线程完成
- **自动降级**：Worker 不可用时降级到主线程，IndexedDB 不可用时降级到内存队列
- **零侵入**：单行初始化，不污染业务代码

### 目录结构

```
packages/monitor-sdk/src/
├── core/                 # 主线程核心逻辑
│   ├── hook/            # 浏览器 API 拦截（error, fetch, xhr, history, performance, blank-screen, resource）
│   ├── tracker/         # 行为追踪（event, pv）
│   ├── init.ts          # SDK 初始化入口
│   ├── queue.ts         # 事件队列 + Worker 通信
│   ├── session.ts       # 会话管理
│   ├── snapshot.ts      # 页面快照
│   └── replay.ts        # 录屏回放
├── worker/              # Worker 线程处理
│   ├── storage/         # IndexedDB 持久化（schema.ts, idb.ts）
│   ├── transport/       # 数据上报（beacon.ts, batch.ts）
│   └── processor/       # 数据处理（snapshot.ts, replay.ts）
└── shared/              # 共享模块
    ├── types.ts         # 类型定义
    ├── constants.ts     # 配置常量
    ├── utils.ts         # 工具函数
    └── logger.ts        # 日志工具
```

### 数据流

```
浏览器事件 → Hook 拦截 → EventPipeline（采样/过滤/脱敏）→ EventQueue → Worker
                                                                    ↓
                                                        IndexedDB 存储 + 批量上报
```

### 事件类型

ERROR, PROMISE_REJECTION, RESOURCE_ERROR, PERFORMANCE, NETWORK, ROUTE_CHANGE, PV, UV, CLICK, CUSTOM, BLANK_SCREEN, SNAPSHOT, REPLAY, STAY_DURATION, RESOURCE_LOAD

## 构建输出

Rollup 构建三种格式到 `dist/` 目录：
- ESM: `index.esm.js`（支持 tree-shaking）
- CJS: `index.cjs.js`
- UMD: `index.umd.js`（浏览器全局变量）
- 类型声明: `index.d.ts`

## 测试

使用 Vitest + jsdom 环境。测试文件位于 `packages/monitor-sdk/tests/`。

## 代码规范

- TypeScript 严格模式
- 中文注释说明意图，英文标识符
- 所有公共 API 需要 JSDoc 注释
- 使用 oxlint 进行代码检查

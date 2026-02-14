# h-tools

[![NPM Version](https://img.shields.io/npm/v/@h-tools/monitor-sdk)](https://www.npmjs.com/package/@h-tools/monitor-sdk)
[![License](https://img.shields.io/npm/l/@h-tools/monitor-sdk)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](tsconfig.json)

前端监控 SDK 工具集，提供完整的前端监控解决方案。

## 📖 项目概述

h-tools 是一个 monorepo 项目，采用 Turborepo + pnpm workspace 管理，专注于前端监控领域。目前包含：

- **@h-tools/monitor-sdk** - 零外部依赖的前端监控 SDK，支持错误监控、性能监控、用户行为追踪等功能

## ✨ 核心特性

### 🛡️ 零侵入设计
- 单行初始化，不修改业务代码
- 框架无关（React / Vue / 原生）
- 自动降级机制

### 🚀 高性能架构
- 主线程轻量化，计算/存储/上报在 Worker 线程完成
- 自动采样和熔断机制
- 内存优化和资源管理

### 📊 全面监控
- **错误监控**: JavaScript 错误、Promise 异常、资源加载异常
- **性能监控**: Core Web Vitals、页面性能指标、SPA 性能
- **行为追踪**: 页面访问、用户交互、路由变化
- **快照回放**: DOM 快照、录屏回放（Session Replay）

### 🔒 安全隐私
- 数据脱敏机制
- 敏感信息过滤
- 符合数据保护法规

## 🚀 快速开始

### 安装

```bash
pnpm add @h-tools/monitor-sdk
```

### 基本使用

```typescript
import { MonitorSDK } from '@h-tools/monitor-sdk';

// 初始化 SDK
const sdk = new MonitorSDK({
  dsn: 'https://your-api-endpoint.com/collect',
  appId: 'your-app-id',
  appVersion: '1.0.0',
  enableError: true,
  enablePerformance: true,
  enableNetwork: true,
  enableSnapshot: true,
});

// 启动监控
sdk.start();

// 设置用户信息
sdk.setUser('user-123', { name: 'John Doe' });

// 手动上报事件
sdk.track('custom_event', { action: 'button_click' });
```

### 高级配置

```typescript
const sdk = new MonitorSDK({
  // 基础配置
  dsn: 'https://your-api-endpoint.com/collect',
  appId: 'your-app-id',
  appVersion: '1.0.0',
  env: 'production',
  
  // 功能开关
  enableError: true,
  enablePerformance: true,
  enableNetwork: true,
  enableRoute: true,
  enablePV: true,
  enableClick: true,
  enableBlankScreen: true,
  enableSnapshot: true,
  enableReplay: false, // 录屏功能默认关闭
  
  // 性能优化
  sampleRate: 1.0,        // 采样率 0-1
  batchSize: 10,          // 批量上报大小
  flushInterval: 5000,    // 刷新间隔（毫秒）
  
  // 安全配置
  filterErrors: [/^Script error/], // 错误过滤规则
  beforeSend: (event) => {
    // 发送前处理
    if (event.data.message?.includes('sensitive')) {
      return null; // 过滤掉敏感信息
    }
    return event;
  },
  sanitize: (data) => {
    // 数据脱敏
    if (data.url) {
      data.url = data.url.replace(/password=\w+/, 'password=***');
    }
    return data;
  },
  
  // 调试模式
  debug: false,
});
```

## 📚 文档

- [API 文档](packages/monitor-sdk/README.md)
- [配置选项](docs/configuration.md)
- [最佳实践](docs/best-practices.md)
- [架构设计](docs/architecture.md)

## 🔧 开发

### 环境要求

- Node.js >= 18
- pnpm >= 9.0.0

### 安装依赖

```bash
pnpm install
```

### 构建

```bash
# 构建所有包
pnpm build

# 生产环境构建（启用压缩）
pnpm build:prod
```

### 测试

```bash
# 运行测试
pnpm test

# 测试覆盖率
pnpm test:coverage

# 运行特定包的测试
pnpm --filter @h-tools/monitor-sdk test
```

### 代码检查

```bash
# 代码检查
pnpm lint

# 类型检查
pnpm typecheck
```

## 📦 包结构

```
packages/
├── monitor-sdk/          # 前端监控 SDK
│   ├── src/
│   │   ├── core/        # 主线程核心逻辑
│   │   ├── worker/      # Worker 线程处理
│   │   └── shared/      # 共享模块
│   ├── dist/            # 构建产物
│   ├── tests/           # 测试文件
│   └── README.md        # 包文档
└── [future-packages]/   # 未来可能添加的其他包
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范

- 使用 TypeScript 严格模式
- 遵循 ESLint 配置
- 添加适当的 JSDoc 注释
- 编写单元测试

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 📞 联系

如有问题或建议，请通过以下方式联系：

- 提交 Issue: [GitHub Issues](https://github.com/he5050/h-tools/issues)
- 邮箱: he5050@163.com

## 🙏 致谢

感谢所有贡献者和用户的支持！

---

**注意**: 这是一个正在积极开发中的项目，API 可能会发生变化。请关注版本更新和迁移指南。
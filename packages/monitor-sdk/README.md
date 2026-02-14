# @h-tools/monitor-sdk

零外部依赖的前端监控 SDK，提供完整的前端监控解决方案。

[![NPM Version](https://img.shields.io/npm/v/@h-tools/monitor-sdk)](https://www.npmjs.com/package/@h-tools/monitor-sdk)
[![License](https://img.shields.io/npm/l/@h-tools/monitor-sdk)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](tsconfig.json)
[![Bundle Size](https://img.shields.io/bundlephobia/min/@h-tools/monitor-sdk)](https://bundlephobia.com/package/@h-tools/monitor-sdk)

## ✨ 特性

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

### 📱 多环境支持
- 浏览器环境完整支持
- SSR 环境安全降级
- 移动端兼容性优化

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

## 📚 API 文档

### MonitorSDK 类

#### 构造函数

```typescript
constructor(config: InitConfig)
```

**参数:**
- `config` - 初始化配置对象

**配置选项:**

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `dsn` | `string` | `""` | 数据接收地址 |
| `appId` | `string` | `""` | 应用 ID |
| `appVersion` | `string` | `"1.0.0"` | 应用版本 |
| `env` | `"production" \| "development"` | `"production"` | 环境标识 |
| `enableError` | `boolean` | `true` | 是否启用错误监控 |
| `enablePerformance` | `boolean` | `true` | 是否启用性能监控 |
| `enableNetwork` | `boolean` | `true` | 是否启用网络监控 |
| `enableRoute` | `boolean` | `true` | 是否启用路由监控 |
| `enablePV` | `boolean` | `true` | 是否启用 PV/UV 追踪 |
| `enableClick` | `boolean` | `true` | 是否启用点击追踪 |
| `enableBlankScreen` | `boolean` | `true` | 是否启用白屏检测 |
| `enableSnapshot` | `boolean` | `false` | 是否启用快照 |
| `enableReplay` | `boolean` | `false` | 是否启用回放 |
| `enableTracker` | `boolean` | `true` | 是否启用行为追踪 |
| `sampleRate` | `number` | `1.0` | 采样率 (0-1) |
| `batchSize` | `number` | `10` | 批量大小 |
| `flushInterval` | `number` | `5000` | 刷新间隔（毫秒） |
| `maxRetries` | `number` | `3` | 最大重试次数 |
| `debug` | `boolean` | `false` | 是否启用调试模式 |
| `userId` | `string` | `""` | 用户 ID |
| `context` | `Record<string, unknown>` | `{}` | 额外上下文信息 |
| `filterErrors` | `RegExp[]` | `[]` | 错误过滤规则 |
| `enableCompression` | `boolean` | `false` | 是否启用数据压缩 |
| `dataExpireDays` | `number` | `30` | 数据过期时间（天） |
| `beforeSend` | `Function` | `undefined` | 发送前回调 |
| `sanitize` | `Function` | `undefined` | 数据脱敏回调 |

#### 方法

##### `start()`

启动监控。

```typescript
sdk.start();
```

##### `stop()`

停止监控。

```typescript
sdk.stop();
```

##### `setUser(userId: string, userInfo?: Record<string, unknown>)`

设置用户信息。

```typescript
sdk.setUser('user-123', { name: 'John Doe', email: 'john@example.com' });
```

##### `track(eventName: string, data?: Record<string, unknown>)`

手动上报自定义事件。

```typescript
sdk.track('button_click', { buttonId: 'submit-btn', action: 'click' });
```

##### `enableReplay()`

启用会话回放录制。

```typescript
sdk.enableReplay();
```

##### `disableReplay()`

禁用会话回放录制。

```typescript
sdk.disableReplay();
```

##### `resumeReplay()`

恢复会话回放录制。

```typescript
sdk.resumeReplay();
```

##### `pauseReplay()`

暂停会话回放录制。

```typescript
sdk.pauseReplay();
```

##### `captureSnapshot()`

手动触发快照。

```typescript
sdk.captureSnapshot();
```

## 🔧 开发

### 环境要求

- Node.js >= 18
- pnpm >= 9.0.0

### 构建

```bash
# 构建
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
```

### 代码检查

```bash
# 代码检查
pnpm lint

# 类型检查
pnpm typecheck
```

## 📦 构建产物

构建后会生成以下文件：

- `dist/index.esm.js` - ESM 格式（支持 tree-shaking）
- `dist/index.cjs.js` - CommonJS 格式
- `dist/index.umd.js` - UMD 格式（浏览器全局变量）
- `dist/index.d.ts` - TypeScript 类型声明

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

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

---

**注意**: 这是一个正在积极开发中的项目，API 可能会发生变化。请关注版本更新和迁移指南。
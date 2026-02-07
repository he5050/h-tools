# @lanlan/monitor-sdk

一款无侵入、高性能的前端监控 SDK，支持异常监控、性能监控、用户行为追踪、网络请求监控、页面快照与录屏回放。

## 特性

- **无侵入设计** - 单行代码初始化，零业务代码侵入
- **非主线程优先** - 主线程仅采集，计算/存储/上报均在 Worker 完成
- **全面监控** - 异常、性能、行为、网络、白屏全覆盖
- **网络过滤** - 支持白名单/黑名单过滤，灵活控制网络请求记录范围
- **请求参数记录** - 支持记录请求体、查询参数、请求头
- **路由状态追踪** - 记录 history.state 参数，完整还原路由切换上下文
- **会话回放** - 基于 rrweb 的录屏回放能力
- **智能采样** - 支持采样率控制，降低服务端压力
- **离线存储** - IndexedDB 本地持久化，支持断网重试
- **自动降级** - Worker 不支持时自动降级到主线程

## 安装

```bash
# npm
npm install @lanlan/monitor-sdk

# yarn
yarn add @lanlan/monitor-sdk

# pnpm
pnpm add @lanlan/monitor-sdk
```

## 快速开始

### 基础用法

```typescript
import { init } from '@lanlan/monitor-sdk';

const monitor = init({
  dsn: 'https://your-monitor-server.com/api/v1/report',
  appId: 'your-app-id',
  env: 'production',
});
```

### 完整配置示例

```typescript
import { init } from '@lanlan/monitor-sdk';

const monitor = init({
  // 必填项
  dsn: 'https://your-monitor-server.com/api/v1/report',
  appId: 'your-app-id',

  // 可选项
  env: 'production',
  userId: 'user-123',

  // 功能开关
  enableError: true,              // 启用异常监控 (默认: true)
  enablePerformance: true,        // 启用性能监控 (默认: true)
  enableNetwork: true,            // 启用网络监控 (默认: true)
  enableRoute: true,              // 启用路由监控 (默认: true)
  enablePV: true,                 // 启用 PV/UV 追踪 (默认: true)
  enableClick: true,              // 启用点击追踪 (默认: true)
  enableBlankScreen: true,        // 启用白屏检测 (默认: true)
  enableResourceLoad: true,       // 启用资源加载监控 (默认: true)
  enableSnapshot: false,          // 启用页面快照 (默认: false)
  enableReplay: false,            // 启用录屏回放 (默认: false)

  // 网络监控配置
  networkConfig: {
    // 黑名单：匹配的请求不记录（优先级高于白名单）
    blacklist: [
      '/api/health',              // 字符串 includes 匹配
      /\.(png|jpg|gif|svg)$/,     // 正则匹配
      (url) => url.includes('internal'),  // 自定义函数
    ],
    // 白名单：配置后仅记录匹配的请求
    whitelist: ['/api/'],
    recordBody: true,             // 记录请求体 (默认: true)
    recordQuery: true,            // 记录查询参数 (默认: true)
    recordHeaders: true,          // 记录请求头 (默认: true)
    maxBodySize: 2048,            // 请求体最大记录长度 (默认: 2048)
    excludeHeaders: ['Authorization', 'Cookie'],  // 排除的请求头
  },

  // 采样与队列配置
  sampleRate: 1,                  // 采样率 0-1 (默认: 1)
  batchSize: 10,                  // 批量大小 (默认: 10)
  flushInterval: 5000,            // 上报间隔 ms (默认: 5000)

  // 数据预处理
  beforeSend: (event) => {
    // 在发送前修改或过滤事件，返回 null 则丢弃
    return event;
  },
  sanitize: (data) => {
    // 敏感数据脱敏
    if (data.password) {
      data.password = '***';
    }
    return data;
  },
});
```

## 网络监控配置

### 白名单/黑名单过滤

SDK 支持三种匹配规则，可混合使用：

```typescript
networkConfig: {
  // 1. 字符串匹配（url.includes）
  blacklist: ['/api/health', '/api/ping'],

  // 2. 正则匹配
  blacklist: [/\.(png|jpg|gif|svg|woff2?)$/, /\/internal\//],

  // 3. 自定义函数
  blacklist: [(url) => new URL(url).hostname === 'analytics.example.com'],

  // 混合使用
  blacklist: [
    '/api/health',
    /\.png$/,
    (url) => url.includes('internal'),
  ],
}
```

**过滤逻辑：**

- 未传 `networkConfig` → 记录所有请求
- 传了 `networkConfig` 后：
  - 黑名单命中 → 不记录（优先级最高）
  - 白名单已配置且命中 → 记录
  - 未配置白名单或白名单未命中 → 不记录

### 请求参数记录

```typescript
networkConfig: {
  recordBody: true,       // 记录 POST/PUT 等请求体
  recordQuery: true,      // 记录 URL 查询参数
  recordHeaders: true,    // 记录请求头
  maxBodySize: 2048,      // 请求体超过此长度会截断
  excludeHeaders: [       // 排除敏感请求头
    'Authorization',
    'Cookie',
    'X-Auth-Token',
  ],
}
```

记录的网络事件数据结构：

```typescript
{
  type: 'NETWORK',
  timestamp: 1700000000000,
  data: {
    url: 'https://api.example.com/users?page=1&size=10',
    method: 'POST',
    status: 200,
    statusText: 'OK',
    duration: 150,
    size: 1024,
    success: true,
    type: 'fetch',
    // 新增字段
    queryParams: { page: '1', size: '10' },
    requestBody: '{"name":"test"}',
    requestHeaders: { 'Content-Type': 'application/json' },
  }
}
```

## 路由监控

### history.state 记录

SDK 会自动记录路由切换时的 state 参数，包括：

- **state** - `pushState`/`replaceState` 调用时传入的 state 参数
- **historyState** - 路由切换后 `history.state` 的完整快照（包含框架注入的数据）

```typescript
// Vue Router 路由切换时，SDK 会自动记录：
{
  type: 'ROUTE_CHANGE',
  timestamp: 1700000000000,
  data: {
    from: 'https://app.com/list',
    to: 'https://app.com/detail/123',
    trigger: 'pushState',
    pathname: '/detail/123',
    search: '',
    hash: '',
    // pushState 传入的原始 state
    state: { key: 'abc123', current: '/detail/123' },
    // history.state 完整快照（含框架注入数据）
    historyState: {
      key: 'abc123',
      current: '/detail/123',
      back: '/list',
      forward: null,
      replaced: false,
      position: 5,
    },
  }
}
```

这对于调试 SPA 路由问题非常有用，特别是：
- Vue Router / React Router 通过 `history.state` 存储的导航状态
- 页面间传递的隐式参数
- 浏览器前进/后退时的状态恢复

## 使用场景示例

### 场景 1：React 应用集成

```typescript
// App.tsx
import { init } from '@lanlan/monitor-sdk';

let monitor: ReturnType<typeof init>;

export function initMonitor() {
  monitor = init({
    dsn: 'https://monitor.example.com/api/v1/report',
    appId: 'react-app',
    env: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    enableReplay: true,
    sampleRate: 0.5,
    networkConfig: {
      blacklist: ['/api/health', /\.(png|jpg|svg)$/],
      recordBody: true,
      excludeHeaders: ['Authorization'],
    },
  });
  return monitor;
}

// 错误边界组件
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    monitor?.captureException(error, {
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return <h1>出错了，请刷新页面重试</h1>;
    }
    return this.props.children;
  }
}
```

### 场景 2：Vue 应用集成

```typescript
// main.ts
import { createApp } from 'vue';
import { init } from '@lanlan/monitor-sdk';
import App from './App.vue';
import router from './router';

const monitor = init({
  dsn: 'https://monitor.example.com/api/v1/report',
  appId: 'vue-app',
  env: import.meta.env.MODE as 'development' | 'production',
  networkConfig: {
    blacklist: ['/api/health'],
    recordBody: true,
    recordHeaders: true,
    excludeHeaders: ['Authorization', 'Cookie'],
  },
});

// Vue 错误处理
const app = createApp(App);

app.config.errorHandler = (err, vm, info) => {
  monitor.captureException(err as Error, {
    componentName: vm?.$options?.name,
    errorInfo: info,
  });
};

// 路由守卫追踪
router.afterEach((to, from) => {
  monitor.track('page_view', {
    from: from.fullPath,
    to: to.fullPath,
    title: to.meta?.title,
  });
});

app.use(router).mount('#app');
```

### 场景 3：电商网站用户行为追踪

```typescript
import { init } from '@lanlan/monitor-sdk';

const monitor = init({
  dsn: 'https://monitor.example.com/api/v1/report',
  appId: 'ecommerce-site',
  enablePerformance: true,
  enableClick: true,
  networkConfig: {
    whitelist: ['/api/'],
    blacklist: ['/api/health', '/api/ping'],
    recordBody: true,
  },
});

// 商品浏览追踪
function trackProductView(productId: string, productInfo: object) {
  monitor.track('product_view', { productId, ...productInfo });
}

// 加入购物车追踪
function trackAddToCart(productId: string, quantity: number, price: number) {
  monitor.track('add_to_cart', { productId, quantity, price, total: quantity * price });
}

// 支付成功追踪
function trackPurchase(orderId: string, amount: number, items: object[]) {
  monitor.track('purchase', { orderId, amount, itemCount: items.length, items });
  monitor.flush(); // 立即上报关键转化事件
}
```

### 场景 4：性能监控与优化

```typescript
import { init } from '@lanlan/monitor-sdk';

const monitor = init({
  dsn: 'https://monitor.example.com/api/v1/report',
  appId: 'performance-critical-app',
  enablePerformance: true,
  sampleRate: 1,
});

// 自定义性能标记
function measureAsyncOperation<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();

  return operation().finally(() => {
    const duration = performance.now() - startTime;
    monitor.track('custom_performance', {
      operation: operationName,
      duration,
      isSlow: duration > 1000,
    });
  });
}
```

### 场景 5：异常监控与告警

```typescript
import { init } from '@lanlan/monitor-sdk';

const monitor = init({
  dsn: 'https://monitor.example.com/api/v1/report',
  appId: 'stable-app',
  enableError: true,
  sampleRate: 1,
  filterErrors: [
    /ResizeObserver loop limit exceeded/,
    /Script error/,
  ],
});

// 手动捕获异步错误
async function fetchUserData(userId: string) {
  try {
    const response = await fetch(`/api/users/${userId}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    monitor.captureException(error as Error, {
      userId,
      action: 'fetchUserData',
    });
    throw error;
  }
}
```

### 场景 6：多环境配置管理

```typescript
import { init, type InitConfig } from '@lanlan/monitor-sdk';

const configMap: Record<string, Partial<InitConfig>> = {
  development: {
    dsn: 'http://localhost:3000/api/report',
    debug: true,
    sampleRate: 1,
    enableReplay: true,
  },
  production: {
    dsn: 'https://monitor.example.com/api/report',
    debug: false,
    sampleRate: 0.01,
    enableReplay: false,
    networkConfig: {
      blacklist: ['/api/health', /\.(png|jpg|gif|svg)$/],
      recordBody: false,       // 生产环境不记录请求体
      recordHeaders: false,    // 生产环境不记录请求头
    },
  },
};

function createMonitor(env: string) {
  const envConfig = configMap[env] || configMap.development;
  return init({
    appId: 'my-app',
    ...envConfig,
  } as InitConfig);
}

const monitor = createMonitor(process.env.NODE_ENV || 'development');
```

## API 文档

### init(config: InitConfig): Monitor

初始化监控 SDK，返回 Monitor 实例。

```typescript
interface InitConfig {
  dsn: string;                              // 数据上报地址
  appId: string;                            // 应用唯一标识
  appVersion?: string;                      // 应用版本
  env?: 'development' | 'staging' | 'production';  // 运行环境
  userId?: string;                          // 用户 ID

  // 功能开关
  enableError?: boolean;                    // 异常监控 (默认: true)
  enablePerformance?: boolean;              // 性能监控 (默认: true)
  enableNetwork?: boolean;                  // 网络监控 (默认: true)
  enableRoute?: boolean;                    // 路由监控 (默认: true)
  enablePV?: boolean;                       // PV/UV 追踪 (默认: true)
  enableClick?: boolean;                    // 点击追踪 (默认: true)
  enableBlankScreen?: boolean;              // 白屏检测 (默认: true)
  enableResourceLoad?: boolean;             // 资源加载监控 (默认: true)
  enableSnapshot?: boolean;                 // 页面快照 (默认: false)
  enableReplay?: boolean;                   // 录屏回放 (默认: false)

  // 网络监控配置
  networkConfig?: NetworkConfig;

  // 采样与队列
  sampleRate?: number;                      // 采样率 (0-1, 默认: 1)
  batchSize?: number;                       // 批量大小 (默认: 10)
  flushInterval?: number;                   // 上报间隔 ms (默认: 5000)

  // 数据预处理
  beforeSend?: (event: MonitorEvent) => MonitorEvent | null;
  sanitize?: (data: Record<string, unknown>) => Record<string, unknown>;
}

interface NetworkConfig {
  whitelist?: NetworkFilterRule[];           // 白名单规则
  blacklist?: NetworkFilterRule[];           // 黑名单规则（优先级高于白名单）
  recordBody?: boolean;                     // 记录请求体 (默认: true)
  recordQuery?: boolean;                    // 记录查询参数 (默认: true)
  recordHeaders?: boolean;                  // 记录请求头 (默认: true)
  maxBodySize?: number;                     // 请求体最大记录长度 (默认: 2048)
  excludeHeaders?: string[];                // 排除的请求头字段
}

// 支持字符串、正则、自定义函数三种匹配方式
type NetworkFilterRule = string | RegExp | ((url: string) => boolean);
```

### Monitor 实例方法

#### track(eventName: string, data?: Record<string, unknown>): void

手动上报自定义事件。

```typescript
monitor.track('button_click');
monitor.track('purchase', { productId: '123', price: 99.9 });
```

#### captureException(error: Error, context?: Record<string, unknown>): void

手动捕获异常。

```typescript
try {
  riskyOperation();
} catch (error) {
  monitor.captureException(error, { operation: 'riskyOperation' });
}
```

#### captureMessage(message: string, level?: 'error' | 'warning' | 'info'): void

上报文本消息。

```typescript
monitor.captureMessage('用户支付失败', 'error');
```

#### setUser(userId: string, userInfo?: Record<string, unknown>): void

设置用户信息。

```typescript
monitor.setUser('user-456', { name: '张三', plan: 'premium' });
```

#### flush(): void

立即触发数据上报。

```typescript
monitor.flush();
```

#### destroy(): void

销毁 SDK 实例，清理所有监听器。

```typescript
monitor.destroy();
```

## 事件类型

SDK 会自动采集以下类型的事件：

### 异常事件

| 事件类型 | 说明 | 触发时机 |
|---------|------|---------|
| `ERROR` | JavaScript 运行时错误 | 代码抛出异常 |
| `PROMISE_REJECTION` | Promise 未捕获异常 | Promise reject 未处理 |
| `RESOURCE_ERROR` | 资源加载错误 | 图片/脚本/CSS 加载失败 |

### 性能事件

| 事件类型 | 说明 | 指标含义 |
|---------|------|---------|
| `PERFORMANCE` | 性能指标 | LCP / FID / CLS / FCP / TTFB 等 |

### 行为事件

| 事件类型 | 说明 | 触发时机 |
|---------|------|---------|
| `PV` | 页面浏览 | 页面加载或路由切换 |
| `UV` | 独立访客 | 新会话开始时 |
| `CLICK` | 点击事件 | 用户点击页面元素 |
| `STAY_DURATION` | 停留时长 | 页面离开或切换 |

### 网络事件

| 事件类型 | 说明 | 采集内容 |
|---------|------|---------|
| `NETWORK` (xhr) | XMLHttpRequest 请求 | 方法、URL、状态码、耗时、请求参数 |
| `NETWORK` (fetch) | Fetch 请求 | 方法、URL、状态码、耗时、请求参数 |

### 路由事件

| 事件类型 | 说明 | 采集内容 |
|---------|------|---------|
| `ROUTE_CHANGE` | 路由变化 | from/to URL、触发方式、state 参数、history.state 快照 |

### 其他事件

| 事件类型 | 说明 | 触发时机 |
|---------|------|---------|
| `BLANK_SCREEN` | 白屏检测 | 页面加载或路由切换后 |
| `RESOURCE_LOAD` | 资源加载汇总 | 页面加载完成后 |
| `SNAPSHOT` | 页面快照 | 异常发生或手动触发 |
| `REPLAY` | 录屏分片 | 持续录制，定期分片 |

## 使用注意事项

### 1. 采样率控制

生产环境建议设置合理的采样率：

```typescript
init({
  dsn: '...',
  appId: '...',
  sampleRate: 0.1,  // 10% 采样
});
```

### 2. 网络监控最佳实践

```typescript
networkConfig: {
  // 排除健康检查、静态资源等无关请求
  blacklist: ['/api/health', /\.(png|jpg|gif|svg|woff2?|css|js)$/],
  // 生产环境建议关闭请求体和请求头记录以减少数据量
  recordBody: process.env.NODE_ENV !== 'production',
  recordHeaders: process.env.NODE_ENV !== 'production',
  // 始终排除敏感请求头
  excludeHeaders: ['Authorization', 'Cookie', 'X-Auth-Token'],
}
```

### 3. 用户隐私保护

- 输入框内容默认会被掩码处理
- URL 中的敏感参数（token、password 等）会被自动脱敏
- 可通过 `excludeHeaders` 排除敏感请求头
- 可通过 `data-monitor-ignore` 属性标记不需要监听的元素

### 4. 跨域脚本错误

对于跨域加载的脚本，需要在 script 标签添加 `crossorigin` 属性：

```html
<script src="https://cdn.example.com/app.js" crossorigin="anonymous"></script>
```

### 5. 离线支持

SDK 支持离线存储，网络恢复后会自动重试上报。

## 浏览器兼容性

| 浏览器 | 最低版本 |
|-------|---------|
| Chrome | 60+ |
| Firefox | 55+ |
| Safari | 12+ |
| Edge | 79+ |

**降级策略：**
- Worker 不支持时自动降级到主线程
- IndexedDB 不支持时使用内存队列
- Beacon API 不支持时使用同步 XHR 兜底

## 开发指南

### 本地开发

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build

# 运行测试
pnpm test

# 类型检查
pnpm typecheck
```

### 项目结构

```
src/
├── core/           # 主线程核心
│   ├── hook/       # 浏览器 API Hook
│   │   ├── fetch.ts        # Fetch 拦截（支持过滤+参数记录）
│   │   ├── xhr.ts          # XHR 拦截（支持过滤+参数记录）
│   │   ├── history.ts      # History 拦截（支持 state 记录）
│   │   ├── error.ts        # 错误捕获
│   │   ├── performance.ts  # 性能监控
│   │   ├── blank-screen.ts # 白屏检测
│   │   └── resource.ts     # 资源加载监控
│   ├── tracker/    # 行为追踪
│   │   ├── event.ts        # 事件追踪
│   │   └── pv.ts           # PV/UV 追踪
│   ├── init.ts     # SDK 初始化
│   ├── session.ts  # 会话管理
│   ├── queue.ts    # 事件队列
│   ├── snapshot.ts # 页面快照
│   └── replay.ts   # 录屏回放
├── worker/         # Worker 线程
│   ├── storage/    # IndexedDB 存储
│   ├── transport/  # 数据上报
│   └── processor/  # 数据处理
└── shared/         # 共享模块
    ├── types.ts    # 类型定义
    ├── constants.ts # 常量配置
    ├── utils.ts    # 工具函数
    └── logger.ts   # 日志工具
```

## 许可证

MIT

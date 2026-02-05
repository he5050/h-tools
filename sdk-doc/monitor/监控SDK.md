# 前端监控 SDK 设计方案

**（无侵入 · 非主线程 · 支持快照与录屏）**

---

## 一、项目目标与设计原则

### 1. 项目目标

构建一套前端通用监控 SDK，用于：

- 前端异常监控
- 性能监控（含 Core Web Vitals）
- 用户行为分析
- 页面访问分析（PV / UV / 停留时长）
- 支持快照（Snapshot）与录屏回放（Session Replay）
- 可长期稳定运行于生产环境

---

### 2. 核心设计原则

- **无侵入**
  - 单行初始化
  - 不修改业务代码
  - 框架无关（React / Vue / 原生）
- **非主线程优先**
  - 主线程只负责采集与入队
  - 计算 / 压缩 / 存储 / 上报全部在 Worker 中完成
- **可降级**
  - 模块级开关
  - 自动熔断与采样
- **安全与隐私**
  - 数据脱敏
  - 白名单采集
- **可扩展**
  - 插件化架构设计

---

## 二、整体架构设计

### 1. 架构分层

```
Application
    │
    ▼
SDK Core（主线程）
    │ postMessage
    ▼
Worker Layer
```

---

### 2. 各层职责

#### 主线程（最小化）

- Hook 浏览器 API
- 监听事件
- 采集原始数据
- 快速入队（Queue）

#### Worker 层

- 数据裁剪与计算
- Snapshot / Replay 处理
- IndexedDB 读写
- 批量数据上报

---

## 三、会话与用户体系（Session & User）

### 1. Session

- Session ID（支持跨刷新恢复）
- Session 生命周期管理
- 所有数据围绕 Session 聚合

### 2. 用户标识

- 匿名用户 ID（UUID）
- 支持业务用户绑定
- UV 统计基础

---

## 四、页面访问分析（PV / UV / 停留时长）

### 1. PV / UV

- 页面初始加载
- SPA 路由切换（History API Hook）
- URL / Route 维度统计

### 2. 页面停留时长

- 页面进入 / 离开时间
- visibilitychange 处理
- 后台时间剔除

---

## 五、性能监控体系

### 1. Core Web Vitals

- LCP（Largest Contentful Paint）
- FID（First Input Delay）
- CLS（Cumulative Layout Shift）

### 2. 页面性能指标

- FP / FCP
- 首屏渲染时间
- 页面加载完成时间
- 白屏时间

### 3. SPA 性能

- 路由切换耗时
- 路由级白屏检测

---

## 六、异常与稳定性监控

### 1. 异常类型

- JS Runtime Error
- Promise 未捕获异常
- 资源加载异常
- 框架异常（可选增强）

### 2. 异常上下文

- 当前页面 / 路由
- 最近用户行为（Breadcrumb）
- 最近接口请求摘要
- 关联 Snapshot / Replay

---

## 七、白屏监控

### 1. 检测策略

- DOM 节点数量
- 关键节点存在性
- 持续时间判断

### 2. 白屏处理

- 自动触发 Snapshot
- 可关联 Replay 片段

---

## 八、快照（Snapshot）模块

### 1. 模块定位

- 默认开启
- 轻量、事件驱动
- Replay 的补充方案

### 2. 触发时机

- 异常发生
- 白屏成立
- 性能指标超阈值
- 手动 API 触发

### 3. 快照内容

- 裁剪后的 DOM 结构
- viewport / scroll 信息
- 页面状态
- 行为 / 性能 / 接口上下文

### 4. 性能策略

- 主线程浅采集
- Worker 中裁剪、压缩
- IndexedDB 持久化

---

## 九、录屏回放（Session Replay）

### 1. 录制内容

- DOM 结构变化
- 用户交互（点击 / 输入 / 滚动）
- 视口变化

### 2. 启用策略

- 采样率控制
- 仅异常 Session
- 自动暂停与降级

### 3. 性能与隐私

- 高频事件节流
- 输入内容脱敏
- 节点黑名单

---

## 十、用户行为与埋点体系

### 1. 自动埋点

- 页面访问
- 路由切换
- 点击事件（配置化）

### 2. 手动埋点

- 自定义事件 Track API
- 异步入队
- 与 Session 关联

### 3. 行为轨迹

- 最近 N 条行为记录
- 与异常 / Snapshot 关联

---

## 十一、网络与接口监控

- 接口耗时统计
- 成功 / 失败率
- 慢接口识别
- 状态码分布

---

## 十二、本地存储（IndexedDB）

### 1. 存储内容

- 异常数据
- 性能指标
- 行为事件
- Snapshot
- Replay 分片

### 2. 存储策略

- Worker 内操作
- 分表管理
- TTL 与容量限制
- 失败重试机制

---

## 十三、数据上报机制

- 批量合并上报
- requestIdleCallback
- 页面卸载 sendBeacon 兜底
- 网络状态感知
- 采样率控制

---

## 十四、非主线程保障机制

- 主线程仅采集与入队
- Worker 统一处理
- 长任务监控
- SDK 自监控
- 自动降级策略
  - 关闭 Replay
  - 降低采样率

---

## 十五、SDK 配置与扩展能力

### 1. 配置能力

- 模块级开关
- 环境隔离（dev / prod）
- 白名单 / 黑名单

### 2. 插件机制

- Performance 插件
- Snapshot 插件
- Replay 插件
- Tracker 插件

---

## 十六、数据规范与安全

- 统一事件模型
- 字段版本控制
- 敏感信息脱敏
- 防止循环上报

---

## 十七、SDK 目录结构与模块拆分

### 1. 总体目录结构

```text
sdk/monitor
├── core/                 # 主线程核心
│   ├── index.ts          # SDK 入口
│   ├── init.ts           # 初始化与配置
│   ├── session.ts        # Session / User 管理
│   ├── queue.ts          # 事件队列
│   ├── hook/             # API Hook
│   │   ├── error.ts
│   │   ├── history.ts
│   │   ├── xhr.ts
│   │   └── fetch.ts
│   └── tracker/          # 行为与埋点
│       ├── pv.ts
│       ├── event.ts
│       └── breadcrumb.ts
│
├── worker/               # Worker 线程
│   ├── index.ts          # Worker 入口
│   ├── processor/       # 数据处理
│   │   ├── error.ts
│   │   ├── performance.ts
│   │   ├── snapshot.ts
│   │   └── replay.ts
│   ├── storage/          # IndexedDB 操作
│   │   ├── idb.ts
│   │   └── schema.ts
│   └── transport/        # 数据上报
│       ├── batch.ts
│       └── beacon.ts
│
├── plugins/              # 插件体系
│   ├── performance.ts
│   ├── snapshot.ts
│   ├── replay.ts
│   └── tracker.ts
│
├── shared/               # 通用能力
│   ├── types.ts          # 类型定义
│   ├── constants.ts
│   ├── utils.ts
│   └── logger.ts
│
└── README.md
```

---

### 2. 模块职责划分

- **core**
  - 主线程运行
  - 数据采集与入队
  - 不做任何重计算
- **worker**
  - 数据裁剪、计算、压缩
  - IndexedDB 读写
  - 批量上报
- **plugins**
  - 可插拔能力
  - 模块级启停
- **shared**
  - 类型与工具复用

---

## 十八、统一事件模型设计

### 1. 设计目标

- 所有数据结构统一
- 支持多类型事件
- 便于扩展与后端解析

---

### 2. 事件通用结构

```ts
interface BaseEvent {
	id: string
	type: "error" | "performance" | "snapshot" | "replay" | "track"
	timestamp: number
	sessionId: string
	userId?: string
	page: {
		url: string
		route?: string
	}
	context?: Record<string, any>
}
```

---

### 3. 各事件扩展字段

#### ErrorEvent

- errorType
- message
- stack
- snapshotId

#### PerformanceEvent

- metricName
- value
- rating

#### SnapshotEvent

- snapshotId
- triggerType
- payload

#### ReplayEvent

- replayId
- chunkIndex
- data

---

### 4. 事件关联关系

- Error → Snapshot
- Performance → Snapshot
- Session → Replay
- Event → Breadcrumb

---

## 十九、IndexedDB 表结构设计

### 1. 数据库设计原则

- Worker 内操作
- 按事件类型分表
- 支持 TTL 清理
- 支持失败重试

---

### 2. 数据库与表结构

#### 数据库

- monitor_sdk_db

#### Object Stores

##### events_store

- id（主键）
- type
- sessionId
- timestamp
- payload
- expireAt

##### snapshot_store

- snapshotId（主键）
- sessionId
- triggerType
- payload
- expireAt

##### replay_chunk_store

- replayId
- chunkIndex
- sessionId
- data
- expireAt

##### queue_store

- id
- payload
- retryCount

---

### 3. TTL 与清理策略

- 定期扫描 expireAt
- 超量优先淘汰 Replay
- 上报成功即删除

---

### 4. Replay 分片策略

- 按时间或大小切片
- 独立 chunk 存储
- 支持断点续传

---

---

## 二十、Worker 消息协议设计

### 1. 设计目标

- 主线程零计算、零阻塞
- 所有计算、裁剪、压缩、存储、上报统一在 Worker 中完成
- 消息结构统一、可扩展
- 支持 ACK / Retry / 自动降级

---

### 2. 通信模型

```
Main Thread  ── postMessage ──▶  Worker
Main Thread  ◀─ onmessage  ────  Worker
```

- 主线程：只负责采集与发送消息
- Worker：负责完整生命周期处理

---

### 3. 消息类型划分

#### 主线程 → Worker

- INIT：初始化
- EVENT：统一事件上报
- SNAPSHOT：快照数据
- REPLAY_CHUNK：录屏分片
- FLUSH：立即触发上报
- CONTROL：运行时配置控制

#### Worker → 主线程

- ACK：处理完成确认
- ERROR：Worker 内部错误
- STATUS：运行状态反馈
- DOWNGRADE：自动降级通知

---

### 4. 消息统一结构

```ts
interface WorkerMessage<T = any> {
	type: string
	payload: T
	meta: {
		messageId: string
		timestamp: number
		sessionId?: string
	}
}
```

- messageId：用于 ACK / 重试
- payload：仅包含最小必要数据

---

### 5. 主线程 → Worker 消息定义

#### INIT

```ts
interface InitPayload {
	appId: string
	env: "dev" | "test" | "prod"
	config: {
		sampleRate: number
		replayEnabled: boolean
		snapshotEnabled: boolean
		maxQueueSize: number
	}
}
```

---

#### EVENT

```ts
interface EventPayload {
	event: BaseEvent
}
```

- Error / Performance / Track / PV / UV 统一入口
- 主线程不做任何加工

---

#### SNAPSHOT

```ts
interface SnapshotPayload {
	snapshotId: string
	triggerType: string
	dom: any
	viewport: {
		width: number
		height: number
		scrollX: number
		scrollY: number
	}
	context: Record<string, any>
}
```

- 主线程只做浅采集
- 不压缩、不序列化

---

#### REPLAY_CHUNK

```ts
interface ReplayChunkPayload {
	replayId: string
	index: number
	data: ArrayBuffer
	isLast: boolean
}
```

- 必须使用 ArrayBuffer + Transferable
- 避免 JSON 数据结构

---

#### FLUSH

```ts
interface FlushPayload {
	reason: "visibilitychange" | "unload" | "manual"
}
```

---

#### CONTROL

```ts
interface ControlPayload {
	action: "enable" | "disable"
	target: "replay" | "snapshot" | "all"
}
```

---

### 6. Worker → 主线程 消息定义

#### ACK

```ts
interface AckPayload {
	messageId: string
	status: "ok" | "failed"
}
```

---

#### ERROR

```ts
interface WorkerErrorPayload {
	message: string
	stack?: string
}
```

---

#### STATUS

```ts
interface StatusPayload {
	queueSize: number
	dbSize: number
	replayActive: boolean
}
```

---

#### DOWNGRADE

```ts
interface DowngradePayload {
	reason: "memory" | "cpu" | "error_rate"
	action: "disable_replay" | "lower_sample_rate"
}
```

---

### 7. 核心处理流程说明

#### EVENT 处理流程

```
collect → postMessage(EVENT)
    → validate
    → enrich
    → IndexedDB
    → batch
    → report
```

---

#### SNAPSHOT 处理流程

```
trigger → shallow collect
    → compress
    → link event
    → store
```

---

#### REPLAY 处理流程

```
record → chunk
    → Transferable
    → persist
    → upload (async)
```

---

### 8. 性能与安全约束

- 主线程禁止：
  - JSON.stringify 大对象
  - IndexedDB 操作
  - 压缩计算
- Worker 统一：
  - 批处理
  - requestIdleCallback
  - 自动熔断
- Replay 超限自动丢弃

---

## 二十一、MVP 阶段建议

第一阶段推荐实现：

1. Session / PV / 停留时长
2. 异常监控
3. Core Web Vitals
4. Snapshot
5. IndexedDB + 上报机制

Replay 作为第二阶段能力接入。

---

## 二十二、总结

这是一套 **无侵入、非主线程、可降级** 的前端监控 SDK，  
以 Session 为核心，覆盖性能、异常、行为、快照与录屏能力，  
可长期稳定运行于真实生产环境。

/**
 * @fileoverview 类型定义模块
 * @description 定义 SDK 中使用的所有类型和接口
 */

/**
 * 网络过滤规则类型
 * @description 支持字符串（includes 匹配）、正则表达式、自定义函数三种匹配方式
 */
export type NetworkFilterRule = string | RegExp | ((url: string) => boolean);

/**
 * 网络监控配置接口
 * @description 控制网络请求的过滤和参数记录行为
 */
export interface NetworkConfig {
	/** 白名单规则：配置后仅记录匹配的请求 */
	whitelist?: NetworkFilterRule[];
	/** 黑名单规则：匹配的请求将被排除（优先级高于白名单） */
	blacklist?: NetworkFilterRule[];
	/** 是否记录请求体（POST/PUT 等） */
	recordBody?: boolean;
	/** 是否记录 URL 查询参数 */
	recordQuery?: boolean;
	/** 是否记录请求头 */
	recordHeaders?: boolean;
	/** 请求体最大记录长度（字节），超出截断，默认 2048 */
	maxBodySize?: number;
	/** 需要排除的请求头字段（如 Authorization） */
	excludeHeaders?: string[];
}

/**
 * 事件类型枚举
 * @description 定义所有支持的事件类型
 */
export enum EventType {
	/** JavaScript 错误 */
	ERROR = "ERROR",
	/** Promise 拒绝错误 */
	PROMISE_REJECTION = "PROMISE_REJECTION",
	/** 资源加载错误 */
	RESOURCE_ERROR = "RESOURCE_ERROR",
	/** 性能指标 */
	PERFORMANCE = "PERFORMANCE",
	/** 网络请求 */
	NETWORK = "NETWORK",
	/** 路由变化 */
	ROUTE_CHANGE = "ROUTE_CHANGE",
	/** 页面浏览 */
	PV = "PV",
	/** 独立访客 */
	UV = "UV",
	/** 点击事件 */
	CLICK = "CLICK",
	/** 自定义事件 */
	CUSTOM = "CUSTOM",
	/** 白屏检测 */
	BLANK_SCREEN = "BLANK_SCREEN",
	/** 快照 */
	SNAPSHOT = "SNAPSHOT",
	/** 回放 */
	REPLAY = "REPLAY",
	/** 停留时长 */
	STAY_DURATION = "STAY_DURATION",
	/** 资源加载汇总 */
	RESOURCE_LOAD = "RESOURCE_LOAD",
}

/**
 * 基础事件接口
 * @description 所有事件的基接口
 */
export interface BaseEvent {
	/** 事件类型 */
	type: EventType
	/** 事件时间戳 */
	timestamp: number
}

/**
 * 错误事件接口
 * @description JavaScript 运行时错误
 * 注意：命名为 MonitorErrorEvent 以避免与浏览器原生 ErrorEvent 冲突
 */
export interface MonitorErrorEvent extends BaseEvent {
	type: EventType.ERROR
	data: {
		/** 错误消息 */
		message: string
		/** 错误堆栈 */
		stack: string
		/** 文件名 */
		filename?: string
		/** 行号 */
		lineno?: number
		/** 列号 */
		colno?: number
		/** 错误类型 */
		errorType: string
	}
}

/**
 * Promise 拒绝事件接口
 * 注意：命名为 MonitorPromiseRejectionEvent 以避免与浏览器原生 PromiseRejectionEvent 冲突
 */
export interface MonitorPromiseRejectionEvent extends BaseEvent {
	type: EventType.PROMISE_REJECTION
	data: {
		/** 错误消息 */
		message: string
		/** 错误堆栈 */
		stack: string
		/** 错误类型 */
		errorType: string
	}
}

/**
 * 资源错误事件接口
 */
export interface ResourceErrorEvent extends BaseEvent {
	type: EventType.RESOURCE_ERROR
	data: {
		/** 资源 URL */
		url: string
		/** 标签名 */
		tagName: string
		/** CSS 选择器 */
		selector?: string
	}
}

/**
 * 性能事件接口
 */
export interface PerformanceEvent extends BaseEvent {
	type: EventType.PERFORMANCE
	data: {
		/** 指标名称 */
		metric: string
		/** 指标值 */
		value: number
		/** 单位 */
		unit?: string
		/** 评级 */
		rating?: string
		/** 额外数据 */
		[key: string]: unknown
	}
}

/**
 * 网络事件接口
 */
export interface NetworkEvent extends BaseEvent {
	type: EventType.NETWORK
	data: {
		/** 请求 URL */
		url: string
		/** HTTP 方法 */
		method: string
		/** 状态码 */
		status: number
		/** 状态文本 */
		statusText: string
		/** 请求耗时 */
		duration: number
		/** 响应大小 */
		size: number
		/** 是否成功 */
		success: boolean
		/** 请求类型 */
		type: "xhr" | "fetch"
		/** 错误信息 */
		error?: string
		/** URL 查询参数 */
		queryParams?: Record<string, string>
		/** 请求体（截断后） */
		requestBody?: string
		/** 请求头 */
		requestHeaders?: Record<string, string>
	}
}

/**
 * 路由变化事件接口
 */
export interface RouteChangeEvent extends BaseEvent {
	type: EventType.ROUTE_CHANGE
	data: {
		/** 来源 URL */
		from: string
		/** 目标 URL */
		to: string
		/** 触发方式 */
		trigger: string
		/** 路径名 */
		pathname: string
		/** 查询参数 */
		search: string
		/** 哈希 */
		hash: string
		/** pushState/replaceState 传入的 state 参数 */
		state?: Record<string, unknown> | null
		/** 当前 history.state 快照 */
		historyState?: Record<string, unknown> | null
	}
}

/**
 * 追踪事件接口
 */
export interface TrackEvent extends BaseEvent {
	type:
		| EventType.PV
		| EventType.UV
		| EventType.CLICK
		| EventType.CUSTOM
		| EventType.STAY_DURATION
		| EventType.BLANK_SCREEN
	data: Record<string, unknown>
}

/**
 * 白屏事件接口
 */
export interface BlankScreenEvent extends BaseEvent {
	type: EventType.BLANK_SCREEN
	data: {
		/** 页面 URL */
		url: string
		/** 路径名 */
		pathname: string
		/** 检测点结果 */
		checkPoints: Array<{
			x: number
			y: number
			isBlank: boolean
			element: string
		}>
		/** 可见元素列表 */
		elements: Array<{
			tag: string
			id?: string
			class?: string
			textPreview?: string
		}>
		/** 可见内容覆盖率 (0-1) */
		coverage?: number
		/** 检测次数 */
		checkCount?: number
		/** 距离页面加载的时间（毫秒） */
		timeSinceLoad?: number
		/** 是否手动触发 */
		manualTrigger?: boolean
		/** 白屏可能原因 */
		reason?: string
		/** 是否已恢复 */
		recovered?: boolean
		/** 恢复耗时（毫秒） */
		recoveryTime?: number
		/** 触发来源（初始加载 / 路由切换） */
		trigger?: "load" | "route_change"
	}
}

/**
 * 资源加载汇总事件接口
 */
export interface ResourceLoadEvent extends BaseEvent {
	type: EventType.RESOURCE_LOAD
	data: {
		/** 资源列表 */
		resources: Array<{
			/** 资源名称（路径） */
			name: string
			/** 资源类型（script/css/img/font/xhr/fetch 等） */
			initiatorType: string
			/** 加载耗时（毫秒） */
			duration: number
			/** 传输大小（字节） */
			transferSize: number
			/** 解码后大小（字节） */
			decodedBodySize: number
			/** 开始时间 */
			startTime: number
			/** DNS 耗时 */
			dnsTime: number
			/** TCP 耗时 */
			connectTime: number
			/** SSL 耗时 */
			sslTime: number
			/** 请求耗时 */
			requestTime: number
			/** 响应耗时 */
			responseTime: number
			/** 是否命中缓存 */
			cached: boolean
			/** 协议 */
			protocol?: string
		}>
		/** 汇总统计 */
		summary: {
			/** 总资源数 */
			totalCount: number
			/** 总传输大小（字节） */
			totalTransferSize: number
			/** 总解码大小（字节） */
			totalDecodedSize: number
			/** 缓存命中数 */
			cachedCount: number
			/** 缓存命中率 (0-1) */
			cacheHitRate: number
			/** 按类型分类统计 */
			byType: Record<string, {
				count: number
				totalSize: number
				avgDuration: number
			}>
			/** 慢资源列表（超过阈值） */
			slowResources: Array<{
				name: string
				duration: number
				initiatorType: string
			}>
			/** 大资源列表（超过大小阈值） */
			largeResources: Array<{
				name: string
				transferSize: number
				initiatorType: string
			}>
		}
	}
}

/**
 * 快照事件接口
 */
export interface SnapshotEvent extends BaseEvent {
	type: EventType.SNAPSHOT
	data: {
		/** 快照数据 */
		snapshot: {
			url: string
			title: string
			viewport: { width: number; height: number }
			dom: string
		}
		/** 关联的错误 ID */
		errorId?: string
	}
}

/**
 * 回放事件接口
 */
export interface ReplayEvent extends BaseEvent {
	type: EventType.REPLAY
	data: {
		/** 回放记录 */
		records: Array<{
			type: string
			timestamp: number
			data: Record<string, unknown>
		}>
		/** 持续时间 */
		duration: number
		/** 记录数 */
		recordCount: number
	}
}

/**
 * 监控事件联合类型
 * @description 所有可能的事件类型
 */
export type MonitorEvent =
	| MonitorErrorEvent
	| MonitorPromiseRejectionEvent
	| ResourceErrorEvent
	| PerformanceEvent
	| NetworkEvent
	| RouteChangeEvent
	| TrackEvent
	| BlankScreenEvent
	| SnapshotEvent
	| ReplayEvent
	| ResourceLoadEvent

/**
 * 页面信息接口
 * @description 页面上下文信息
 */
export interface PageInfo {
	/** 完整 URL */
	url: string
	/** 路由路径 */
	route: string
	/** 页面标题 */
	title: string
	/** 来源页面 */
	referrer: string
}

/**
 * 事件载荷接口
 * @description Worker 消息的事件数据
 */
export interface EventPayload {
	/** 事件数据 */
	event: MonitorEvent
	/** 会话 ID */
	sessionId: string
	/** 用户 ID */
	userId?: string
	/** 页面信息 */
	pageInfo?: PageInfo
}

/**
 * 初始化配置接口
 */
export interface InitConfig {
	/** 数据接收地址 */
	dsn: string
	/** 应用 ID */
	appId: string
	/** 应用版本 */
	appVersion?: string
	/** 环境 */
	env?: "development" | "staging" | "production"
	/** 是否启用错误监控 */
	enableError?: boolean
	/** 是否启用性能监控 */
	enablePerformance?: boolean
	/** 是否启用网络监控 */
	enableNetwork?: boolean
	/** 网络监控配置（白名单/黑名单过滤、请求参数记录） */
	networkConfig?: NetworkConfig
	/** 是否启用路由监控 */
	enableRoute?: boolean
	/** 是否启用 PV/UV 追踪 */
	enablePV?: boolean
	/** 是否启用点击追踪 */
	enableClick?: boolean
	/** 是否启用白屏检测 */
	enableBlankScreen?: boolean
	/** 是否启用资源加载监控 */
	enableResourceLoad?: boolean
	/** 是否启用快照 */
	enableSnapshot?: boolean
	/** 是否启用回放 */
	enableReplay?: boolean
	/** 是否启用行为追踪 */
	enableTracker?: boolean
	/** 采样率 (0-1) */
	sampleRate?: number
	/** 批量大小 */
	batchSize?: number
	/** 刷新间隔（毫秒） */
	flushInterval?: number
	/** 最大重试次数 */
	maxRetries?: number
	/** 是否启用调试模式 */
	debug?: boolean
	/** 用户 ID */
	userId?: string
	/** 额外的上下文信息 */
	context?: Record<string, unknown>
	/** 错误过滤规则 */
	filterErrors?: RegExp[]
	/** 是否启用数据压缩 */
	enableCompression?: boolean
	/** 发送前回调 */
	beforeSend?: (event: MonitorEvent) => MonitorEvent | null
	/** 数据脱敏回调 */
	sanitize?: (data: Record<string, unknown>) => Record<string, unknown>
}

/**
 * Worker 消息类型
 */
export type WorkerMessage =
	| { type: "init"; payload: InitConfig }
	| { type: "event"; payload: MonitorEvent }
	| { type: "flush" }
	| { type: "cleanup" }
	| { type: "destroy" }

/**
 * Worker 响应类型
 */
export interface WorkerResponse {
	type: string
	success?: boolean
	error?: string
	id?: number
}

/**
 * 设备信息接口
 */
export interface DeviceInfo {
	/** 浏览器名称 */
	browser: string
	/** 浏览器版本 */
	browserVersion: string
	/** 操作系统 */
	os: string
	/** 操作系统版本 */
	osVersion: string
	/** 设备类型 */
	deviceType: "desktop" | "tablet" | "mobile"
	/** 屏幕宽度 */
	screenWidth: number
	/** 屏幕高度 */
	screenHeight: number
	/** 设备像素比 */
	devicePixelRatio: number
}

/**
 * 会话信息接口
 */
export interface SessionInfo {
	/** 会话 ID */
	sessionId: string
	/** 开始时间 */
	startTime: number
	/** 页面 URL */
	url: string
	/** 来源页面 */
	referrer: string
}

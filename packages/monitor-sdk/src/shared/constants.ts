/**
 * @fileoverview 常量定义模块
 * @description 定义 SDK 中使用的所有常量
 */

/**
 * SDK 版本号
 */
export const SDK_VERSION = "1.0.0";

/**
 * SDK 名称
 */
export const SDK_NAME = "@h-tools/monitor-sdk";

/**
 * 默认配置常量
 * @description 与 InitConfig 接口对应的默认配置
 */
export const DEFAULT_CONFIG = {
	/** 数据接收地址 */
	dsn: "",
	/** 应用 ID */
	appId: "",
	/** 应用版本 */
	appVersion: "1.0.0",
	/** 环境 */
	env: "production" as const,
	/** 是否启用错误监控 */
	enableError: true,
	/** 是否启用性能监控 */
	enablePerformance: true,
	/** 是否启用网络监控 */
	enableNetwork: true,
	/** 网络监控配置 */
	networkConfig: undefined as import("./types").NetworkConfig | undefined,
	/** 是否启用路由监控 */
	enableRoute: true,
	/** 是否启用 PV/UV 追踪 */
	enablePV: true,
	/** 是否启用点击追踪 */
	enableClick: true,
	/** 是否启用白屏检测 */
	enableBlankScreen: true,
	/** 是否启用资源加载监控 */
	enableResourceLoad: true,
	/** 是否启用快照 */
	enableSnapshot: false,
	/** 是否启用回放 */
	enableReplay: false,
	/** 是否启用行为追踪 */
	enableTracker: true,
	/** 采样率 (0-1) */
	sampleRate: 1.0,
	/** 批量大小 */
	batchSize: 10,
	/** 刷新间隔（毫秒） */
	flushInterval: 5000,
	/** 最大重试次数 */
	maxRetries: 3,
	/** 是否启用调试模式 */
	debug: false,
	/** 用户 ID */
	userId: "",
	/** 额外的上下文信息 */
	context: {} as Record<string, unknown>,
	/** 错误过滤规则 */
	filterErrors: [] as RegExp[],
	/** 是否启用数据压缩 */
	enableCompression: false,
	/** 数据过期时间（天），默认 30 天 */
	dataExpireDays: 30,
	/** 发送前回调 */
	beforeSend: undefined as ((event: { type: string; timestamp: number; data: Record<string, unknown> }) => { type: string; timestamp: number; data: Record<string, unknown> } | null) | undefined,
	/** 数据脱敏回调 */
	sanitize: undefined as ((data: Record<string, unknown>) => Record<string, unknown>) | undefined,
};

/**
 * 性能阈值常量
 */
export const PERFORMANCE_THRESHOLDS = {
	/** LCP 良好阈值（毫秒） */
	LCP_GOOD: 2500,
	/** LCP 较差阈值（毫秒） */
	LCP_POOR: 4000,
	/** FID 良好阈值（毫秒） */
	FID_GOOD: 100,
	/** FID 较差阈值（毫秒） */
	FID_POOR: 300,
	/** CLS 良好阈值 */
	CLS_GOOD: 0.1,
	/** CLS 较差阈值 */
	CLS_POOR: 0.25,
	/** 慢资源阈值（毫秒） */
	SLOW_RESOURCE: 1000,
	/** 白屏检测延迟（毫秒） */
	BLANK_SCREEN_CHECK_DELAY: 3000,
};

/**
 * IndexedDB 配置
 */
export const DB_CONFIG = {
	/** 数据库名称 */
	NAME: "monitor_sdk_db",
	/** 数据库版本 */
	VERSION: 1,
	/** 事件存储对象名称 */
	EVENT_STORE: "events",
	/** 快照存储对象名称 */
	SNAPSHOT_STORE: "snapshots",
	/** 回放存储对象名称 */
	REPLAY_STORE: "replays",
};

/**
 * TTL (Time To Live) 配置
 * @description 不同类型数据的存活时间（毫秒）
 */
export const TTL_CONFIG = {
	/** 默认事件 TTL：30 天 */
	DEFAULT_EVENT_TTL: 30 * 24 * 60 * 60 * 1000,
	/** 错误事件 TTL：30 天 */
	ERROR_EVENT_TTL: 30 * 24 * 60 * 60 * 1000,
	/** 快照数据 TTL：30 天 */
	SNAPSHOT_TTL: 30 * 24 * 60 * 60 * 1000,
	/** 回放数据 TTL：30 天 */
	REPLAY_TTL: 30 * 24 * 60 * 60 * 1000,
	/** 性能数据 TTL：30 天 */
	PERFORMANCE_TTL: 30 * 24 * 60 * 60 * 1000,
};

/**
 * 存储限制配置
 */
export const STORAGE_LIMITS = {
	/** 单个事件最大大小（字节）：100KB */
	MAX_EVENT_SIZE: 100 * 1024,
	/** 单个快照最大大小（字节）：500KB */
	MAX_SNAPSHOT_SIZE: 500 * 1024,
	/** 数据库最大容量（字节）：50MB */
	MAX_DB_SIZE: 50 * 1024 * 1024,
	/** 最大事件数量 */
	MAX_EVENT_COUNT: 10000,
};

/**
 * 事件类型优先级
 */
export const EVENT_PRIORITY = {
	/** 高优先级：立即上报 */
	HIGH: ["ERROR", "PROMISE_REJECTION", "RESOURCE_ERROR", "BLANK_SCREEN"],
	/** 中优先级：批量上报 */
	MEDIUM: ["PERFORMANCE", "NETWORK", "ROUTE_CHANGE"],
	/** 低优先级：延迟上报 */
	LOW: ["PV", "UV", "CLICK", "CUSTOM"],
};

/**
 * 正则表达式常量
 */
export const REGEX = {
	/** 敏感字段匹配 */
	SENSITIVE_FIELDS: /password|passwd|pwd|credit.?card|cvv|ssn|secret|token/i,
	/** 脚本错误匹配 */
	SCRIPT_ERROR: /Script error\.?/i,
	/** 跨域错误匹配 */
	CORS_ERROR: /cross.?origin|CORS/i,
};

/**
 * 浏览器检测正则
 */
export const BROWSER_REGEX = {
	/** Chrome */
	CHROME: /Chrome\/(\d+\.\d+)/,
	/** Firefox */
	FIREFOX: /Firefox\/(\d+\.\d+)/,
	/** Safari */
	SAFARI: /Version\/(\d+\.\d+).*Safari/,
	/** Edge */
	EDGE: /Edg\/(\d+\.\d+)/,
	/** IE */
	IE: /MSIE (\d+\.\d+)|Trident.*rv:(\d+\.\d+)/,
};

/**
 * 操作系统检测正则
 */
export const OS_REGEX = {
	/** Windows */
	WINDOWS: /Windows NT (\d+\.\d+)/,
	/** macOS */
	MAC: /Mac OS X (\d+[._]\d+)/,
	/** iOS */
	IOS: /OS (\d+)_(\d+)/,
	/** Android */
	ANDROID: /Android (\d+\.\d+)/,
	/** Linux */
	LINUX: /Linux/,
};

/**
 * 敏感字段列表
 */
export const SENSITIVE_FIELDS = [
	"password",
	"passwd",
	"pwd",
	"creditCard",
	"credit_card",
	"cvv",
	"ssn",
	"secret",
	"token",
	"apiKey",
	"api_key",
	"privateKey",
	"private_key",
];

/**
 * 需要脱敏的 URL 参数
 */
export const SENSITIVE_URL_PARAMS = [
	"token",
	"password",
	"secret",
	"api_key",
	"apiKey",
	"access_token",
	"refresh_token",
];

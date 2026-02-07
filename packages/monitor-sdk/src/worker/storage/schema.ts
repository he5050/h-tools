/**
 * @fileoverview IndexedDB 数据库结构定义
 * @description 定义数据库名称、版本、存储对象结构
 */

/**
 * 数据库配置常量
 */

/** 数据库名称 */
export const DB_NAME = "monitor_sdk_db";

/** 数据库版本号 */
export const DB_VERSION = 1;

/** 事件存储对象名称 */
export const STORE_NAME = "events";

/** 快照存储对象名称 */
export const SNAPSHOT_STORE_NAME = "snapshots";

/** 回放数据存储对象名称 */
export const REPLAY_STORE_NAME = "replays";

/**
 * TTL (Time To Live) 配置
 * @description 不同类型数据的存活时间（毫秒）
 */
export const TTL_CONFIG = {
	/** 默认事件 TTL：7 天 */
	DEFAULT_EVENT_TTL: 7 * 24 * 60 * 60 * 1000,

	/** 错误事件 TTL：30 天 */
	ERROR_EVENT_TTL: 30 * 24 * 60 * 60 * 1000,

	/** 快照数据 TTL：3 天 */
	SNAPSHOT_TTL: 3 * 24 * 60 * 60 * 1000,

	/** 回放数据 TTL：7 天 */
	REPLAY_TTL: 7 * 24 * 60 * 60 * 1000,

	/** 性能数据 TTL：3 天 */
	PERFORMANCE_TTL: 3 * 24 * 60 * 60 * 1000,
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
 * 事件数据结构接口
 */
export interface EventRecord {
	/** 事件 ID（自增） */
	id?: number;

	/** 事件类型 */
	type: string;

	/** 事件时间戳 */
	timestamp: number;

	/** 事件数据 */
	data: Record<string, unknown>;

	/** 过期时间 */
	expireAt: number;

	/** 会话 ID */
	sessionId?: string;

	/** 页面 URL */
	url?: string;

	/** 用户 ID */
	userId?: string;
}

/**
 * 快照数据结构接口
 */
export interface SnapshotRecord {
	/** 快照 ID（自增） */
	id?: number;

	/** 关联的事件 ID */
	eventId?: number;

	/** 快照时间戳 */
	timestamp: number;

	/** 页面 URL */
	url: string;

	/** 页面标题 */
	title: string;

	/** 视口尺寸 */
	viewport: { width: number; height: number };

	/** DOM 快照 */
	dom: string;

	/** 过期时间 */
	expireAt: number;
}

/**
 * 回放数据结构接口
 */
export interface ReplayRecord {
	/** 回放 ID（自增） */
	id?: number;

	/** 会话 ID */
	sessionId: string;

	/** 开始时间戳 */
	startTime: number;

	/** 持续时间（毫秒） */
	duration: number;

	/** 回放记录数 */
	recordCount: number;

	/** 回放数据 */
	records: Array<{
		type: string;
		timestamp: number;
		data: Record<string, unknown>;
	}>;

	/** 过期时间 */
	expireAt: number;
}

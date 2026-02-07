/**
 * @fileoverview 日志模块
 * @description 提供 SDK 的日志记录功能
 */

/**
 * 日志级别枚举
 */
export enum LogLevel {
	/** 调试级别 */
	DEBUG = 0,
	/** 信息级别 */
	INFO = 1,
	/** 警告级别 */
	WARN = 2,
	/** 错误级别 */
	ERROR = 3,
	/** 静默级别（不输出） */
	SILENT = 4,
}

/**
 * 日志配置接口
 */
interface LoggerConfig {
	/** 当前日志级别 */
	level: LogLevel;
	/** 是否启用 */
	enabled: boolean;
	/** 日志前缀 */
	prefix: string;
}

/**
 * 日志记录器类
 * @description 管理 SDK 的日志输出
 */
class Logger {
	/** 日志配置 */
	private config: LoggerConfig = {
		level: LogLevel.ERROR,
		enabled: false,
		prefix: "[Monitor]",
	};

	/**
	 * 初始化日志配置
	 * @param enabled - 是否启用调试模式
	 * @param level - 日志级别
	 */
	public init(enabled: boolean, level: LogLevel = LogLevel.DEBUG): void {
		this.config.enabled = enabled;
		this.config.level = level;
	}

	/**
	 * 设置日志级别
	 * @param level - 日志级别
	 */
	public setLevel(level: LogLevel): void {
		this.config.level = level;
	}

	/**
	 * 获取当前日志级别
	 * @returns 当前日志级别
	 */
	public getLevel(): LogLevel {
		return this.config.level;
	}

	/**
	 * 输出调试日志
	 * @param message - 日志消息
	 * @param args - 附加参数
	 */
	public debug(message: string, ...args: unknown[]): void {
		this.log(LogLevel.DEBUG, message, ...args);
	}

	/**
	 * 输出信息日志
	 * @param message - 日志消息
	 * @param args - 附加参数
	 */
	public info(message: string, ...args: unknown[]): void {
		this.log(LogLevel.INFO, message, ...args);
	}

	/**
	 * 输出警告日志
	 * @param message - 日志消息
	 * @param args - 附加参数
	 */
	public warn(message: string, ...args: unknown[]): void {
		this.log(LogLevel.WARN, message, ...args);
	}

	/**
	 * 输出错误日志
	 * @param message - 日志消息
	 * @param args - 附加参数
	 */
	public error(message: string, ...args: unknown[]): void {
		this.log(LogLevel.ERROR, message, ...args);
	}

	/**
	 * 内部日志输出方法
	 * @param level - 日志级别
	 * @param message - 日志消息
	 * @param args - 附加参数
	 */
	private log(level: LogLevel, message: string, ...args: unknown[]): void {
		// 检查是否启用
		if (!this.config.enabled) {
			return;
		}

		// 检查日志级别
		if (level < this.config.level) {
			return;
		}

		const prefix = this.config.prefix;
		const timestamp = new Date().toISOString();
		const levelName = LogLevel[level];

		const formattedMessage = `${timestamp} ${prefix} [${levelName}] ${message}`;

		switch (level) {
			case LogLevel.DEBUG:
				// eslint-disable-next-line no-console
				console.debug(formattedMessage, ...args);
				break;
			case LogLevel.INFO:
				// eslint-disable-next-line no-console
				console.info(formattedMessage, ...args);
				break;
			case LogLevel.WARN:
				// eslint-disable-next-line no-console
				console.warn(formattedMessage, ...args);
				break;
			case LogLevel.ERROR:
				// eslint-disable-next-line no-console
				console.error(formattedMessage, ...args);
				break;
		}
	}

	/**
	 * 分组输出日志
	 * @param label - 分组标签
	 * @param fn - 分组内的日志函数
	 */
	public group(label: string, fn: () => void): void {
		if (!this.config.enabled) {
			return;
		}

		// eslint-disable-next-line no-console
		console.group(`${this.config.prefix} ${label}`);
		try {
			fn();
		} finally {
			// eslint-disable-next-line no-console
			console.groupEnd();
		}
	}

	/**
	 * 输出表格日志
	 * @param data - 表格数据
	 * @param columns - 列名
	 */
	public table(data: unknown[], columns?: string[]): void {
		if (!this.config.enabled) {
			return;
		}

		// eslint-disable-next-line no-console
		console.table(data, columns);
	}
}

/**
 * 全局日志实例
 */
export const logger = new Logger();

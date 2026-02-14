/**
 * @fileoverview SDK 核心初始化模块
 * @description 提供 Monitor 类的实现，负责整合所有监控模块的初始化、配置管理和事件分发
 */

import { InitConfig, MonitorEvent, EventType, MonitorErrorEvent, TrackEvent, QueueOptions } from "../shared/types"
import { SessionManager } from "./session"
import { EventQueue } from "./queue"
import { ErrorMonitor } from "./hook/error"
import { PerformanceMonitor } from "./hook/performance"
import { PVTracker } from "./tracker/pv"
import { EventTracker } from "./tracker/event"
import { XHRInterceptor } from "./hook/xhr"
import { FetchInterceptor } from "./hook/fetch"
import { HistoryInterceptor } from "./hook/history"
import { BlankScreenDetector } from "./hook/blank-screen"
import { ResourceLoadMonitor } from "./hook/resource"
import { SnapshotManager } from "./snapshot"
import { ReplayManager } from "./replay"
import { DEFAULT_CONFIG } from "../shared/constants"
import { logger } from "../shared/logger"
import { isBrowser } from "../shared/utils"

/**
 * 事件管道包装器
 * @description 包装 EventQueue，在 push 时经过 handleEvent 管道处理（采样率、beforeSend、sanitize）
 */
class EventPipeline {
	private config: Required<InitConfig>
	private eventQueue: EventQueue

	constructor(config: Required<InitConfig>, eventQueue: EventQueue) {
		this.config = config
		this.eventQueue = eventQueue
	}

	/**
	 * 推送事件到管道
	 * @description 经过采样率过滤、beforeSend 钩子、sanitize 脱敏后，再发送到事件队列
	 */
	public push(event: MonitorEvent): void {
		// 采样率过滤
		if (this.config.sampleRate && this.config.sampleRate < 1) {
			if (Math.random() > this.config.sampleRate) {
				return
			}
		}

		// 应用 beforeSend 钩子（可用于过滤或修改事件）
		if (this.config.beforeSend) {
			const modified = this.config.beforeSend(event)
			if (!modified) return // 事件被过滤掉
			event = modified
		}

		// 应用 sanitize 钩子（用于敏感数据脱敏）
		if (this.config.sanitize) {
			event = { ...event, data: this.config.sanitize(event.data as Record<string, unknown>) } as MonitorEvent
		}

		// 发送到事件队列
		this.eventQueue.push(event)
	}

	/**
	 * 直接刷新底层队列
	 */
	public flush(): void {
		this.eventQueue.flush()
	}

	/**
	 * 销毁底层队列
	 */
	public destroy(): void {
		this.eventQueue.destroy()
	}
}

/**
 * Monitor 核心类
 * @description 监控 SDK 的主入口类，负责协调各监控模块的工作
 */
export class Monitor {
	/** SDK 配置项（合并默认值后的完整配置） */
	private config: Required<InitConfig>
	/** 会话管理器实例 */
	private sessionManager: SessionManager
	/** 底层事件队列实例 */
	private eventQueue: EventQueue
	/** 事件管道（经过采样率/beforeSend/sanitize 处理） */
	private eventPipeline: EventPipeline
	/** 错误监控实例 */
	private errorMonitor?: ErrorMonitor
	/** 性能监控实例 */
	private performanceMonitor?: PerformanceMonitor
	/** PV/UV 追踪实例 */
	private pvTracker?: PVTracker
	/** 事件追踪实例 */
	private eventTracker?: EventTracker
	/** XHR 请求拦截实例 */
	private xhrInterceptor?: XHRInterceptor
	/** Fetch 请求拦截实例 */
	private fetchInterceptor?: FetchInterceptor
	/** 路由拦截实例 */
	private historyInterceptor?: HistoryInterceptor
	/** 白屏检测实例 */
	private blankScreenDetector?: BlankScreenDetector
	/** 资源加载监控实例 */
	private resourceLoadMonitor?: ResourceLoadMonitor
	/** 快照管理实例 */
	private snapshotManager?: SnapshotManager
	/** 回放管理实例 */
	private replayManager?: ReplayManager
	/** 初始化状态标记 */
	private isInitialized: boolean = false

	/** 事件处理函数引用，用于移除监听器 */
	private unloadHandler: (() => void) | null = null
	private visibilityHandler: (() => void) | null = null

	/**
	 * 创建 Monitor 实例
	 * @param config - SDK 初始化配置
	 */
	constructor(config: InitConfig) {
		// 合并默认配置与用户配置
		this.config = { ...DEFAULT_CONFIG, ...config } as Required<InitConfig>
		// 初始化会话管理器
		this.sessionManager = new SessionManager()
		// 初始化事件队列
		this.eventQueue = new EventQueue(
			this.config.dsn,
			this.config.batchSize,
			this.config.flushInterval,
			this.config.appId,
			this.config.queueOptions,
		)
		// 初始化事件管道（所有模块通过管道推送事件，确保采样率/beforeSend/sanitize 生效）
		this.eventPipeline = new EventPipeline(this.config, this.eventQueue)
	}

	/**
	 * 初始化 SDK
	 * @description 启动所有启用的监控模块，设置事件监听
	 */
	public init(): void {
		// SSR 环境检查
		if (!isBrowser()) {
			logger.warn("Monitor SDK 只能在浏览器环境中运行，当前为 SSR 环境")
			return
		}

		if (this.isInitialized) {
			logger.warn("Monitor 已经初始化，请勿重复调用")
			return
		}

		logger.info("正在初始化 Monitor SDK...")

		// 初始化错误监控模块
		if (this.config.enableError) {
			this.errorMonitor = new ErrorMonitor(this.eventPipeline, this.config.filterErrors || [])
			this.errorMonitor.start()
		}

		// 初始化性能监控模块
		if (this.config.enablePerformance) {
			this.performanceMonitor = new PerformanceMonitor(this.eventPipeline)
			this.performanceMonitor.start()
		}

		// 初始化 PV/UV 追踪模块
		if (this.config.enablePV) {
			this.pvTracker = new PVTracker(this.eventPipeline, this.sessionManager)
			this.pvTracker.start()
		}

		// 初始化点击追踪模块
		if (this.config.enableClick) {
			this.eventTracker = new EventTracker(this.eventPipeline)
			this.eventTracker.start()
		}

		// 初始化网络监控模块
		if (this.config.enableNetwork) {
			this.xhrInterceptor = new XHRInterceptor(this.eventPipeline, this.config.networkConfig)
			this.xhrInterceptor.enable()

			this.fetchInterceptor = new FetchInterceptor(this.eventPipeline, this.config.networkConfig)
			this.fetchInterceptor.enable()
		}

		// 初始化路由监控模块
		if (this.config.enableRoute) {
			this.historyInterceptor = new HistoryInterceptor(this.eventPipeline)
			this.historyInterceptor.enable()
		}

		// 初始化白屏检测模块
		if (this.config.enableBlankScreen) {
			this.blankScreenDetector = new BlankScreenDetector(this.eventPipeline)
			this.blankScreenDetector.start()
		}

		// 初始化资源加载监控模块
		if (this.config.enableResourceLoad) {
			this.resourceLoadMonitor = new ResourceLoadMonitor(this.eventPipeline)
			this.resourceLoadMonitor.start()
		}

		// 联动白屏检测与路由监控：路由切换时触发白屏重新检测
		if (this.blankScreenDetector && this.historyInterceptor) {
			this.historyInterceptor.onRouteChange(this.blankScreenDetector.onRouteChange)
		}

		// 初始化快照管理模块
		if (this.config.enableSnapshot) {
			this.snapshotManager = new SnapshotManager()
		}

		// 初始化回放管理模块
		if (this.config.enableReplay) {
			this.replayManager = new ReplayManager(this.eventPipeline)
			this.replayManager.start()
		}

		// 设置页面卸载时的处理逻辑
		this.setupUnloadHandler()

		this.isInitialized = true
		logger.info("Monitor SDK 初始化成功")
	}

	/**
	 * 销毁 SDK 实例
	 * @description 清理所有监控模块和事件监听器，释放资源
	 */
	public destroy(): void {
		this.errorMonitor?.stop()
		this.performanceMonitor?.stop()
		this.pvTracker?.stop()
		this.eventTracker?.stop()
		this.xhrInterceptor?.disable()
		this.fetchInterceptor?.disable()
		this.historyInterceptor?.disable()
		this.blankScreenDetector?.stop()
		this.resourceLoadMonitor?.stop()
		this.replayManager?.stop()

		// 移除页面卸载事件监听器
		this.removeUnloadHandler()

		this.eventPipeline.destroy()
		this.isInitialized = false
		logger.info("Monitor SDK 已销毁")
	}

	/**
	 * 移除页面卸载事件监听器
	 */
	private removeUnloadHandler(): void {
		if (this.unloadHandler) {
			window.removeEventListener("beforeunload", this.unloadHandler)
			window.removeEventListener("pagehide", this.unloadHandler)
			this.unloadHandler = null
		}
		if (this.visibilityHandler) {
			document.removeEventListener("visibilitychange", this.visibilityHandler)
			this.visibilityHandler = null
		}
	}

	/**
	 * 设置页面卸载处理
	 * @description 在页面关闭或切换时触发数据刷新
	 */
	private setupUnloadHandler(): void {
		this.unloadHandler = () => {
			this.eventPipeline.flush()
		}

		this.visibilityHandler = () => {
			if (document.visibilityState === "hidden") {
				this.eventPipeline.flush()
			}
		}

		// 页面关闭前
		window.addEventListener("beforeunload", this.unloadHandler)
		// 页面隐藏（移动端）
		window.addEventListener("pagehide", this.unloadHandler)
		// 页面可见性变化
		document.addEventListener("visibilitychange", this.visibilityHandler)
	}

	/**
	 * 手动上报自定义事件
	 * @param eventName - 事件名称
	 * @param data - 事件数据
	 */
	public track(eventName: string, data?: Record<string, unknown>): void {
		if (!this.isInitialized) {
			logger.warn("Monitor 尚未初始化")
			return
		}
		this.eventTracker?.track(eventName, data)
	}

	/**
	 * 手动捕获异常
	 * @param error - 错误对象
	 * @param context - 上下文信息
	 */
	public captureException(error: Error, context?: Record<string, unknown>): void {
		if (!this.isInitialized) {
			logger.warn("Monitor 尚未初始化")
			return
		}

		const errorEvent: MonitorErrorEvent = {
			type: EventType.ERROR,
			timestamp: Date.now(),
			data: {
				message: error.message,
				stack: error.stack || "",
				errorType: error.name || "Error",
				...context,
			},
		}

		this.eventPipeline.push(errorEvent)
	}

	/**
	 * 手动上报消息
	 * @param message - 消息内容
	 * @param level - 消息级别
	 */
	public captureMessage(message: string, level: "error" | "warning" | "info" = "error"): void {
		if (!this.isInitialized) {
			logger.warn("Monitor 尚未初始化")
			return
		}

		const messageEvent: TrackEvent = {
			type: EventType.CUSTOM,
			timestamp: Date.now(),
			data: {
				eventName: "message",
				message,
				level,
			},
		}

		this.eventPipeline.push(messageEvent)
	}

	/**
	 * 设置用户信息
	 * @param userId - 用户唯一标识
	 * @param userInfo - 用户附加信息
	 */
	public setUser(userId: string, userInfo?: Record<string, unknown>): void {
		this.config.userId = userId
		if (userInfo) {
			try {
				Object.entries(userInfo).forEach(([key, value]) => {
					localStorage.setItem(`monitor_user_${key}`, JSON.stringify(value))
				})
			} catch {
				logger.warn("用户信息存储失败")
			}
		}
	}

	/**
	 * 立即刷新数据上报
	 * @description 强制将队列中的数据立即上报
	 */
	public flush(): void {
		this.eventPipeline.flush()
	}

	/**
	 * 获取页面快照
	 * @returns 快照数据
	 */
	public captureSnapshot(): unknown {
		if (!this.snapshotManager) {
			logger.warn("快照功能未启用")
			return null
		}
		return this.snapshotManager.capture()
	}

	/**
	 * 暂停回放录制
	 */
	public pauseReplay(): void {
		this.replayManager?.pause()
	}

	/**
	 * 恢复回放录制
	 */
	public resumeReplay(): void {
		this.replayManager?.resume()
	}
}

/** SDK 单例实例 */
let monitorInstance: Monitor | null = null

/**
 * 初始化监控 SDK（单例模式）
 * @param config - SDK 配置
 * @returns Monitor 实例
 */
export function init(config: InitConfig): Monitor {
	if (monitorInstance) {
		logger.warn("Monitor 已经初始化，返回现有实例")
		return monitorInstance
	}

	monitorInstance = new Monitor(config)
	monitorInstance.init()
	return monitorInstance
}

/**
 * 获取 Monitor 实例
 * @returns 当前的 Monitor 实例或 null
 */
export function getMonitor(): Monitor | null {
	return monitorInstance
}

/**
 * 销毁 Monitor 实例
 * @description 清理所有资源并重置单例
 */
export function destroy(): void {
	monitorInstance?.destroy()
	monitorInstance = null
}

/**
 * @fileoverview 资源加载监控模块
 * @description 监控页面所有资源的加载情况，提供完整资源列表、分类统计、缓存命中率、大资源告警
 */

import type { ResourceLoadEvent } from "../../shared/types"
import { EventType } from "../../shared/types"
import { PERFORMANCE_THRESHOLDS } from "../../shared/constants"
import { logger } from "../../shared/logger"

/** 大资源阈值：1MB */
const LARGE_RESOURCE_THRESHOLD = 1024 * 1024

/**
 * 资源加载监控器类
 * @description 在页面加载完成后收集所有资源加载数据，并持续监控新资源
 */
export class ResourceLoadMonitor {
	private eventQueue: { push: (event: ResourceLoadEvent) => void }
	private observer: PerformanceObserver | null = null
	private isMonitoring = false
	/** 已上报的初始资源汇总标记 */
	private initialReported = false
	/** 持续监控的新资源缓冲区 */
	private newResourceBuffer: PerformanceResourceTiming[] = []
	/** 持续监控的上报定时器 */
	private reportTimer: ReturnType<typeof setInterval> | null = null

	/**
	 * 构造函数
	 * @param eventQueue - 事件队列实例
	 */
	constructor(eventQueue: { push: (event: ResourceLoadEvent) => void }) {
		this.eventQueue = eventQueue
	}

	/**
	 * 启动资源加载监控
	 */
	public start(): void {
		if (this.isMonitoring) return
		this.isMonitoring = true

		// 页面加载完成后上报初始资源汇总
		if (document.readyState === "complete") {
			setTimeout(() => this.reportInitialResources(), 0)
		} else {
			window.addEventListener("load", () => {
				// 延迟一帧确保所有资源条目已记录
				setTimeout(() => this.reportInitialResources(), 100)
			}, { once: true })
		}

		// 持续监控新加载的资源
		this.startContinuousMonitoring()

		logger.info("资源加载监控已启动")
	}

	/**
	 * 停止资源加载监控
	 */
	public stop(): void {
		this.isMonitoring = false

		if (this.observer) {
			this.observer.disconnect()
			this.observer = null
		}

		if (this.reportTimer) {
			clearInterval(this.reportTimer)
			this.reportTimer = null
		}

		this.newResourceBuffer = []
		logger.info("资源加载监控已停止")
	}

	/**
	 * 上报初始页面加载的所有资源
	 */
	private reportInitialResources(): void {
		if (this.initialReported) return
		this.initialReported = true

		const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[]
		if (entries.length === 0) return

		const event = this.buildResourceLoadEvent(entries)
		this.eventQueue.push(event)
		logger.debug("初始资源加载汇总已上报，资源数:", entries.length)
	}

	/**
	 * 启动持续监控
	 * @description 使用 PerformanceObserver 监控页面加载完成后新加载的资源
	 */
	private startContinuousMonitoring(): void {
		if (!("PerformanceObserver" in window)) return

		try {
			this.observer = new PerformanceObserver((list) => {
				// 只在初始汇总上报后才缓冲新资源
				if (!this.initialReported) return

				const entries = list.getEntries() as PerformanceResourceTiming[]
				this.newResourceBuffer.push(...entries)
			})

			this.observer.observe({ type: "resource", buffered: false })
		} catch (e) {
			logger.warn("资源加载持续监控不支持:", e)
		}

		// 每 30 秒上报一次新资源汇总
		this.reportTimer = setInterval(() => {
			if (this.newResourceBuffer.length > 0) {
				const entries = this.newResourceBuffer.splice(0)
				const event = this.buildResourceLoadEvent(entries)
				this.eventQueue.push(event)
				logger.debug("新资源加载汇总已上报，资源数:", entries.length)
			}
		}, 30000)
	}

	/**
	 * 构建资源加载事件
	 * @param entries - PerformanceResourceTiming 条目数组
	 * @returns ResourceLoadEvent 事件对象
	 */
	private buildResourceLoadEvent(entries: PerformanceResourceTiming[]): ResourceLoadEvent {
		const resources = entries.map((entry) => this.parseResourceEntry(entry))

		// 汇总统计
		const summary = this.buildSummary(resources)

		return {
			type: EventType.RESOURCE_LOAD,
			timestamp: Date.now(),
			data: {
				resources,
				summary,
			},
		}
	}

	/**
	 * 解析单个资源条目
	 */
	private parseResourceEntry(entry: PerformanceResourceTiming): ResourceLoadEvent["data"]["resources"][0] {
		const cached = entry.transferSize === 0 && entry.decodedBodySize > 0

		return {
			name: this.getResourceName(entry.name),
			initiatorType: entry.initiatorType,
			duration: Math.round(entry.duration),
			transferSize: entry.transferSize,
			decodedBodySize: entry.decodedBodySize,
			startTime: Math.round(entry.startTime),
			dnsTime: Math.round(entry.domainLookupEnd - entry.domainLookupStart),
			connectTime: Math.round(entry.connectEnd - entry.connectStart),
			sslTime: Math.round(entry.secureConnectionStart > 0 ? entry.connectEnd - entry.secureConnectionStart : 0),
			requestTime: Math.round(entry.responseStart - entry.requestStart),
			responseTime: Math.round(entry.responseEnd - entry.responseStart),
			cached,
			protocol: entry.nextHopProtocol || undefined,
		}
	}

	/**
	 * 构建汇总统计数据
	 */
	private buildSummary(resources: ResourceLoadEvent["data"]["resources"]): ResourceLoadEvent["data"]["summary"] {
		let totalTransferSize = 0
		let totalDecodedSize = 0
		let cachedCount = 0
		const byType: Record<string, { count: number; totalSize: number; totalDuration: number }> = {}
		const slowResources: ResourceLoadEvent["data"]["summary"]["slowResources"] = []
		const largeResources: ResourceLoadEvent["data"]["summary"]["largeResources"] = []

		for (const res of resources) {
			totalTransferSize += res.transferSize
			totalDecodedSize += res.decodedBodySize
			if (res.cached) cachedCount++

			// 按类型分类
			const type = res.initiatorType || "other"
			if (!byType[type]) {
				byType[type] = { count: 0, totalSize: 0, totalDuration: 0 }
			}
			byType[type].count++
			byType[type].totalSize += res.transferSize
			byType[type].totalDuration += res.duration

			// 慢资源
			if (res.duration > PERFORMANCE_THRESHOLDS.SLOW_RESOURCE) {
				slowResources.push({
					name: res.name,
					duration: res.duration,
					initiatorType: res.initiatorType,
				})
			}

			// 大资源
			if (res.transferSize > LARGE_RESOURCE_THRESHOLD) {
				largeResources.push({
					name: res.name,
					transferSize: res.transferSize,
					initiatorType: res.initiatorType,
				})
			}
		}

		// 计算按类型的平均耗时
		const byTypeResult: Record<string, { count: number; totalSize: number; avgDuration: number }> = {}
		for (const [type, data] of Object.entries(byType)) {
			byTypeResult[type] = {
				count: data.count,
				totalSize: data.totalSize,
				avgDuration: Math.round(data.totalDuration / data.count),
			}
		}

		return {
			totalCount: resources.length,
			totalTransferSize,
			totalDecodedSize,
			cachedCount,
			cacheHitRate: resources.length > 0 ? cachedCount / resources.length : 0,
			byType: byTypeResult,
			slowResources,
			largeResources,
		}
	}

	/**
	 * 获取资源名称（移除查询参数）
	 */
	private getResourceName(url: string): string {
		try {
			return new URL(url, location.origin).pathname
		} catch {
			return url
		}
	}
}

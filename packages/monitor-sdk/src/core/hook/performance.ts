/**
 * @fileoverview 性能监控模块
 * @description 监控 Core Web Vitals 和其他性能指标，支持早期加载和指标聚合
 */

import type { PerformanceEvent } from "../../shared/types"
import { EventType } from "../../shared/types"
import { PERFORMANCE_THRESHOLDS } from "../../shared/constants"
import { logger } from "../../shared/logger"

/**
 * 性能指标数据接口
 */
interface MetricData {
	name: string
	values: number[]
	avg: number
	p50: number
	p90: number
	p95: number
}

/**
 * 性能监控器类
 * @description 使用 Performance Observer API 监控页面性能指标，支持早期加载
 */
export class PerformanceMonitor {
	private eventQueue: { push: (event: PerformanceEvent) => void }
	private observers: PerformanceObserver[] = []
	private isMonitoring = false
	private metrics: Map<string, MetricData> = new Map()
	private lastLargestContentfulPaint = 0
	/** 页面导航开始时间，用于计算各阶段耗时 */
	private navigationStart = 0
	/** CLS 定时上报的定时器引用 */
	private clsReportTimer: ReturnType<typeof setInterval> | null = null

	/**
	 * 性能阈值配置
	 */
	private thresholds = {
		LCP: { good: PERFORMANCE_THRESHOLDS.LCP_GOOD, poor: PERFORMANCE_THRESHOLDS.LCP_POOR },
		FID: { good: PERFORMANCE_THRESHOLDS.FID_GOOD, poor: PERFORMANCE_THRESHOLDS.FID_POOR },
		CLS: { good: PERFORMANCE_THRESHOLDS.CLS_GOOD, poor: PERFORMANCE_THRESHOLDS.CLS_POOR },
		FCP: { good: 1800, poor: 3000 },
		FP: { good: 1000, poor: 2500 },
		TTFB: { good: 600, poor: 1800 },
		INP: { good: 200, poor: 500 },
		TBT: { good: 200, poor: 500 },
		DOM_READY: { good: 2000, poor: 4000 },
		PAGE_LOAD: { good: 3000, poor: 6000 },
	}

	/**
	 * 构造函数
	 * @param eventQueue - 事件队列实例
	 */
	constructor(eventQueue: { push: (event: PerformanceEvent) => void }) {
		this.eventQueue = eventQueue
		this.navigationStart = performance.timeOrigin || Date.now()
	}

	/**
	 * 启动性能监控
	 * @description 立即注册 Performance Observer，无需等待 init
	 */
	public start(): void {
		if (this.isMonitoring) return
		this.isMonitoring = true

		// 立即收集已有的性能条目
		this.collectExistingEntries()

		// 注册性能观察者
		this.observeLCP()
		this.observeFID()
		this.observeCLS()
		this.observeFCP()
		this.observeTTFB()
		this.observeResourceTiming()
		this.observeLongTasks()
		this.observeINP()

		// 监听页面可见性变化
		this.handleVisibilityChange()

		// 在页面完全加载后上报加载瀑布图数据
		this.reportPageLoadWaterfall()

		logger.info("性能监控已启动")
	}

	/**
	 * 收集已有的性能条目
	 * @description 在 Observer 注册前收集已存在的性能数据
	 */
	private collectExistingEntries(): void {
		// 收集 navigation timing
		const navigationEntries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[]
		if (navigationEntries.length > 0) {
			const nav = navigationEntries[0]
			this.reportNavigationTiming(nav)
		}

		// 收集 paint timing
		const paintEntries = performance.getEntriesByType("paint")
		for (const entry of paintEntries) {
			if (entry.name === "first-paint") {
				this.reportMetric("FP", entry.startTime)
			}
			if (entry.name === "first-contentful-paint") {
				this.reportMetric("FCP", entry.startTime)
			}
		}

		// 收集已存在的 resource timing（仅慢资源）
		const resourceEntries = performance.getEntriesByType("resource") as PerformanceResourceTiming[]
		for (const entry of resourceEntries) {
			if (entry.duration > PERFORMANCE_THRESHOLDS.SLOW_RESOURCE) {
				this.reportMetric("SLOW_RESOURCE", entry.duration, {
					url: this.getResourceName(entry.name),
					initiatorType: entry.initiatorType,
				})
			}
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

	/**
	 * 上报导航计时数据
	 * @description 上报完整的导航计时数据，并独立上报关键阶段指标
	 */
	private reportNavigationTiming(nav: PerformanceNavigationTiming): void {
		const timing = {
			// DNS 查询时间
			dnsTime: nav.domainLookupEnd - nav.domainLookupStart,
			// TCP 连接时间
			tcpTime: nav.connectEnd - nav.connectStart,
			// SSL 握手时间
			sslTime: nav.secureConnectionStart > 0 ? nav.connectEnd - nav.secureConnectionStart : 0,
			// 首字节时间
			ttfb: nav.responseStart - nav.requestStart,
			// 内容下载时间
			downloadTime: nav.responseEnd - nav.responseStart,
			// DOM 构建时间
			domBuildTime: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
			// 页面完全加载时间
			loadTime: nav.loadEventEnd > 0 ? nav.loadEventEnd - nav.startTime : 0,
			// DOM 就绪时间
			domReadyTime: nav.domContentLoadedEventEnd - nav.startTime,
			// 重定向时间
			redirectTime: nav.redirectEnd - nav.redirectStart,
			// 请求时间
			requestTime: nav.responseStart - nav.requestStart,
			// 响应时间
			responseTime: nav.responseEnd - nav.responseStart,
			// DOM 解析时间
			domParseTime: nav.domInteractive - nav.responseEnd,
		}

		// 上报完整导航计时数据
		this.reportMetric("NAVIGATION_TIMING", 0, timing)

		// 独立上报 DOM Ready 时间（便于后端聚合分析和评级）
		if (timing.domReadyTime > 0) {
			this.reportMetric("DOM_READY", timing.domReadyTime)
		}

		// 独立上报页面完全加载时间
		if (timing.loadTime > 0) {
			this.reportMetric("PAGE_LOAD", timing.loadTime)
		}
	}

	/**
	 * 在页面完全加载后上报加载瀑布图数据
	 * @description 包含从重定向到页面加载完成的完整链路
	 */
	private reportPageLoadWaterfall(): void {
		const reportWaterfall = () => {
			const navEntries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[]
			if (navEntries.length === 0) return

			const nav = navEntries[0]

			// 确保 loadEventEnd 已经有值
			if (nav.loadEventEnd <= 0) {
				// 页面还没加载完，延迟再试
				setTimeout(reportWaterfall, 1000)
				return
			}

			const waterfall = {
				// 各阶段的起止时间（相对于 startTime）
				redirect: { start: nav.redirectStart, end: nav.redirectEnd },
				dns: { start: nav.domainLookupStart, end: nav.domainLookupEnd },
				tcp: { start: nav.connectStart, end: nav.connectEnd },
				ssl: { start: nav.secureConnectionStart > 0 ? nav.secureConnectionStart : 0, end: nav.secureConnectionStart > 0 ? nav.connectEnd : 0 },
				request: { start: nav.requestStart, end: nav.responseStart },
				response: { start: nav.responseStart, end: nav.responseEnd },
				domParse: { start: nav.responseEnd, end: nav.domInteractive },
				domContentLoaded: { start: nav.domContentLoadedEventStart, end: nav.domContentLoadedEventEnd },
				load: { start: nav.loadEventStart, end: nav.loadEventEnd },
				// 总耗时
				totalTime: nav.loadEventEnd - nav.startTime,
			}

			this.reportMetric("PAGE_LOAD_WATERFALL", waterfall.totalTime, waterfall)
		}

		// 等待页面加载完成后上报
		if (document.readyState === "complete") {
			// 延迟一帧确保 loadEventEnd 已赋值
			setTimeout(reportWaterfall, 0)
		} else {
			window.addEventListener("load", () => {
				// load 事件触发时 loadEventEnd 可能还没赋值，延迟一帧
				setTimeout(reportWaterfall, 0)
			}, { once: true })
		}
	}

	/**
	 * 监控 LCP (Largest Contentful Paint)
	 * @description 最大内容绘制时间，衡量页面主要内容加载完成的时间
	 */
	private observeLCP(): void {
		if (!("PerformanceObserver" in window)) return

		try {
			const observer = new PerformanceObserver((list) => {
				const entries = list.getEntries()
				const lastEntry = entries[entries.length - 1] as PerformanceEntry & {
					startTime: number
					element?: Element
					size: number
				}

				if (lastEntry && lastEntry.startTime > this.lastLargestContentfulPaint) {
					this.lastLargestContentfulPaint = lastEntry.startTime

					this.reportMetric("LCP", lastEntry.startTime, {
						element: lastEntry.element?.tagName || "unknown",
						size: lastEntry.size,
						elementText: lastEntry.element?.textContent?.substring(0, 100) || "",
					})
				}
			})

			observer.observe({ type: "largest-contentful-paint", buffered: true })
			this.observers.push(observer)
		} catch (e) {
			logger.warn("LCP 监控不支持:", e)
		}
	}

	/**
	 * 监控 FID (First Input Delay)
	 * @description 首次输入延迟，衡量用户首次交互的响应时间
	 */
	private observeFID(): void {
		if (!("PerformanceObserver" in window)) return

		try {
			const observer = new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					const fidEntry = entry as PerformanceEntry & {
						processingStart: number
						startTime: number
						target?: Element
					}

					const delay = fidEntry.processingStart - fidEntry.startTime

					this.reportMetric("FID", delay, {
						eventType: fidEntry.entryType,
						target: fidEntry.target?.tagName || "unknown",
					})
				}
			})

			observer.observe({ type: "first-input", buffered: true })
			this.observers.push(observer)
		} catch (e) {
			logger.warn("FID 监控不支持:", e)
		}
	}

	/**
	 * 监控 INP (Interaction to Next Paint)
	 * @description 交互到下一次绘制时间，2024 年新的 Core Web Vital
	 */
	private observeINP(): void {
		if (!("PerformanceObserver" in window)) return

		let maxINP = 0

		try {
			const observer = new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					const inpEntry = entry as PerformanceEntry & {
						processingStart: number
						startTime: number
						duration: number
					}

					// INP 是所有交互中延迟最长的
					const interactionDelay = inpEntry.processingStart - inpEntry.startTime
					if (interactionDelay > maxINP) {
						maxINP = interactionDelay
						// 上报当前最大 INP 值
						this.reportMetric("INP", maxINP, {
							duration: inpEntry.duration,
							startTime: inpEntry.startTime,
						})
					}
				}
			})

			// 使用 type + durationThreshold 而非 entryTypes
			// durationThreshold 是 Event Timing API 的标准参数，但 TS 类型定义尚未包含
			observer.observe({ type: "event", durationThreshold: 40, buffered: true } as PerformanceObserverInit)
			this.observers.push(observer)
		} catch (e) {
			logger.warn("INP 监控不支持:", e)
		}
	}

	/**
	 * 监控 CLS (Cumulative Layout Shift)
	 * @description 累积布局偏移，衡量页面视觉稳定性
	 */
	private observeCLS(): void {
		if (!("PerformanceObserver" in window)) return

		try {
			let clsValue = 0
			let clsEntryCount = 0

			const observer = new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					// 只计算没有最近用户输入的布局偏移
					const entryData = entry as unknown as {
						hadRecentInput: boolean
						value: number
						sources: Array<{ node?: Node; currentRect?: DOMRect }>
					}

					if (!entryData.hadRecentInput) {
						clsValue += entryData.value
						clsEntryCount++
					}
				}
			})

			observer.observe({ type: "layout-shift", buffered: true })
			this.observers.push(observer)

			// 定期上报 CLS 值
			const reportCLS = () => {
				if (clsValue > 0) {
					this.reportMetric("CLS", clsValue, {
						entries: clsEntryCount,
						avgShift: clsEntryCount > 0 ? clsValue / clsEntryCount : 0,
					})
				}
			}

			// 首次上报
			setTimeout(reportCLS, 3000)
			// 后续定期上报
			this.clsReportTimer = setInterval(reportCLS, 5000)
		} catch (e) {
			logger.warn("CLS 监控不支持:", e)
		}
	}

	/**
	 * 监控 FCP (First Contentful Paint)
	 * @description 首次内容绘制时间
	 */
	private observeFCP(): void {
		if (!("PerformanceObserver" in window)) return

		try {
			const observer = new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					if (entry.name === "first-paint") {
						this.reportMetric("FP", entry.startTime)
					}
					if (entry.name === "first-contentful-paint") {
						this.reportMetric("FCP", entry.startTime)
					}
				}
			})

			observer.observe({ type: "paint", buffered: true })
			this.observers.push(observer)
		} catch (e) {
			logger.warn("FCP 监控不支持:", e)
		}
	}

	/**
	 * 监控 TTFB (Time to First Byte)
	 * @description 首字节时间，衡量服务器响应速度
	 */
	private observeTTFB(): void {
		const reportTTFB = () => {
			const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming
			if (navigation) {
				const ttfb = navigation.responseStart - navigation.startTime
				this.reportMetric("TTFB", ttfb)
			}
		}

		// 立即执行
		reportTTFB()

		// 在 idle 时再次确认
		if ("requestIdleCallback" in window) {
			requestIdleCallback(reportTTFB)
		} else {
			setTimeout(reportTTFB, 0)
		}
	}

	/**
	 * 监控资源加载性能
	 * @description 监控图片、脚本、样式表等资源的加载时间
	 */
	private observeResourceTiming(): void {
		if (!("PerformanceObserver" in window)) return

		try {
			const observer = new PerformanceObserver((list) => {
				const entries = list.getEntries() as PerformanceResourceTiming[]

				for (const entry of entries) {
					// 只监控慢资源
					const duration = entry.duration
					if (duration > PERFORMANCE_THRESHOLDS.SLOW_RESOURCE) {
						this.reportMetric("SLOW_RESOURCE", duration, {
							name: this.getResourceName(entry.name),
							initiatorType: entry.initiatorType,
							dnsTime: entry.domainLookupEnd - entry.domainLookupStart,
							connectTime: entry.connectEnd - entry.connectStart,
							responseTime: entry.responseEnd - entry.responseStart,
							transferSize: entry.transferSize,
							decodedBodySize: entry.decodedBodySize,
							cached: entry.transferSize === 0 && entry.decodedBodySize > 0,
						})
					}
				}
			})

			observer.observe({ type: "resource", buffered: true })
			this.observers.push(observer)
		} catch (e) {
			logger.warn("资源计时监控不支持:", e)
		}
	}

	/**
	 * 监控长任务
	 * @description 监控超过 50ms 的长任务
	 */
	private observeLongTasks(): void {
		if (!("PerformanceObserver" in window)) return

		try {
			const observer = new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					const taskEntry = entry as PerformanceEntry & {
						attribution: Array<{ containerType: string; containerId: string }>
					}

					if (entry.duration > 50) {
						this.reportMetric("LONG_TASK", entry.duration, {
							startTime: entry.startTime,
							attribution: taskEntry.attribution?.[0] || {},
						})
					}
				}
			})

			observer.observe({ type: "longtask", buffered: true })
			this.observers.push(observer)
		} catch (e) {
			logger.warn("长任务监控不支持:", e)
		}
	}

	/**
	 * 处理页面可见性变化
	 */
	private handleVisibilityChange(): void {
		const reportVisibleMetrics = () => {
			if (document.visibilityState === "visible") {
				// 上报页面可见时的关键指标
				this.reportVisibleMetrics()
			}
		}

		document.addEventListener("visibilitychange", reportVisibleMetrics)
	}

	/**
	 * 上报页面可见时的指标
	 */
	private reportVisibleMetrics(): void {
		// 上报内存使用情况（如果支持）
		const memory = performance as Performance & {
			memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number }
		}
		if (memory.memory) {
			this.reportMetric("MEMORY", 0, {
				usedJSHeapSize: memory.memory.usedJSHeapSize,
				totalJSHeapSize: memory.memory.totalJSHeapSize,
				jsHeapSizeLimit: memory.memory.jsHeapSizeLimit,
			})
		}

		// 上报网络状态（如果支持）
		const navConn = navigator as Navigator & {
			connection?: { effectiveType: string; downlink: number; rtt: number; saveData: boolean }
		}
		if (navConn.connection) {
			const conn = navConn.connection
			this.reportMetric("NETWORK_INFO", 0, {
				effectiveType: conn.effectiveType,
				downlink: conn.downlink,
				rtt: conn.rtt,
				saveData: conn.saveData,
			})
		}
	}

	/**
	 * 停止性能监控
	 * @description 断开所有 Performance Observer，清理定时器
	 */
	public stop(): void {
		this.observers.forEach((observer) => observer.disconnect())
		this.observers = []
		this.isMonitoring = false

		if (this.clsReportTimer) {
			clearInterval(this.clsReportTimer)
			this.clsReportTimer = null
		}

		logger.info("性能监控已停止")
	}

	/**
	 * 报告性能指标
	 * @param name - 指标名称
	 * @param value - 指标值
	 * @param extra - 额外数据
	 */
	private reportMetric(name: string, value: number, extra?: Record<string, unknown>): void {
		// 聚合指标数据
		this.aggregateMetric(name, value)

		const event: PerformanceEvent = {
			type: EventType.PERFORMANCE,
			timestamp: Date.now(),
			data: {
				metric: name,
				value,
				unit: this.getMetricUnit(name),
				rating: this.getRating(name, value),
				...extra,
				// 添加聚合数据
				...this.getAggregatedData(name),
			},
		}

		this.eventQueue.push(event)
		logger.debug(`性能指标 [${name}]:`, value, extra)
	}

	/**
	 * 获取指标单位
	 */
	private getMetricUnit(name: string): string {
		const units: Record<string, string> = {
			LCP: "ms",
			FID: "ms",
			CLS: "",
			FCP: "ms",
			FP: "ms",
			TTFB: "ms",
			INP: "ms",
			TBT: "ms",
			DOM_READY: "ms",
			PAGE_LOAD: "ms",
			PAGE_LOAD_WATERFALL: "ms",
			NAVIGATION_TIMING: "ms",
			MEMORY: "bytes",
			NETWORK_INFO: "",
		}
		return units[name] || "ms"
	}

	/**
	 * 聚合指标数据
	 */
	private aggregateMetric(name: string, value: number): void {
		if (!this.metrics.has(name)) {
			this.metrics.set(name, {
				name,
				values: [],
				avg: 0,
				p50: 0,
				p90: 0,
				p95: 0,
			})
		}

		const metric = this.metrics.get(name)!
		metric.values.push(value)

		// 只保留最近 100 个样本
		if (metric.values.length > 100) {
			metric.values.shift()
		}

		// 计算统计值
		const sorted = [...metric.values].sort((a: number, b: number) => a - b)
		const len = sorted.length

		metric.avg = sorted.reduce((a: number, b: number) => a + b, 0) / len
		metric.p50 = sorted[Math.floor(len * 0.5)]
		metric.p90 = sorted[Math.floor(len * 0.9)]
		metric.p95 = sorted[Math.floor(len * 0.95)]
	}

	/**
	 * 获取聚合数据
	 * @param name - 指标名称
	 * @returns 聚合数据对象
	 */
	private getAggregatedData(name: string): Record<string, number> {
		const metric = this.metrics.get(name)
		if (!metric || metric.values.length === 0) {
			return {}
		}

		return {
			sampleCount: metric.values.length,
			avg: Math.round(metric.avg * 100) / 100,
			p50: Math.round(metric.p50 * 100) / 100,
			p90: Math.round(metric.p90 * 100) / 100,
			p95: Math.round(metric.p95 * 100) / 100,
		}
	}

	/**
	 * 获取性能指标评级
	 * @param metric - 指标名称
	 * @param value - 指标值
	 * @returns 评级结果 (good/needs-improvement/poor)
	 */
	private getRating(metric: string, value: number): string {
		const threshold = this.thresholds[metric as keyof typeof this.thresholds]
		if (!threshold) return "unknown"

		if (value <= threshold.good) return "good"
		if (value <= threshold.poor) return "needs-improvement"
		return "poor"
	}

	/**
	 * 获取所有性能指标
	 * @returns 指标数据映射
	 */
	public getMetrics(): Map<string, MetricData> {
		return this.metrics
	}

	/**
	 * 清除所有指标数据
	 */
	public clearMetrics(): void {
		this.metrics.clear()
	}
}

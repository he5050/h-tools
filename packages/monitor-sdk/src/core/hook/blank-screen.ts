/**
 * @fileoverview 白屏检测模块
 * @description 检测页面是否出现白屏（无内容渲染），支持早期检测、持续监控、SPA 路由切换检测、白屏原因分析、恢复检测
 */

import type { BlankScreenEvent } from "../../shared/types"
import { EventType } from "../../shared/types"
import { logger } from "../../shared/logger"

/**
 * 白屏检测器类
 * @description 通过检测关键点是否有内容来判断页面是否白屏，支持早期快速检测和持续监控
 */
export class BlankScreenDetector {
	private eventQueue: { push: (event: BlankScreenEvent) => void }
	private checkDelays: number[]
	private isDetecting = false
	private observer: MutationObserver | null = null
	private checkCount = 0
	private maxChecks = 5
	/** 页面导航开始时间（用于计算 timeSinceLoad） */
	private pageLoadTime = 0
	/** 上一次检测到白屏的时间（用于恢复检测） */
	private lastBlankTime = 0
	/** 当前是否处于白屏状态 */
	private isCurrentlyBlank = false
	/** 当前检测的触发来源 */
	private currentTrigger: "load" | "route_change" = "load"
	/** 持续监控的防抖定时器 */
	private debounceTimer: ReturnType<typeof setTimeout> | null = null
	/** 已上报的白屏事件（防止重复上报） */
	private reportedBlank = false
	/** 路由切换检测定时器 */
	private routeChangeTimer: ReturnType<typeof setTimeout> | null = null

	/**
	 * 构造函数
	 * @param eventQueue - 事件队列实例
	 * @param checkDelays - 检测延迟时间数组（毫秒），默认为 [100, 500, 1000, 2000, 3000]
	 */
	constructor(
		eventQueue: { push: (event: BlankScreenEvent) => void },
		checkDelays: number[] = [100, 500, 1000, 2000, 3000],
	) {
		this.eventQueue = eventQueue
		this.checkDelays = checkDelays
		this.pageLoadTime = performance.now()
	}

	/**
	 * 启动白屏检测
	 * @description 在 DOM 构建完成后立即开始检测，无需等待资源加载
	 */
	public start(): void {
		if (this.isDetecting) return
		this.isDetecting = true
		this.checkCount = 0
		this.currentTrigger = "load"

		// 立即执行第一次检测（DOM 已就绪时）
		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", this.handleDOMReady, { once: true })
		} else {
			this.startDetection()
		}

		logger.info("白屏检测已启动")
	}

	/**
	 * 处理 DOMContentLoaded 事件
	 */
	private handleDOMReady = (): void => {
		this.startDetection()
	}

	/**
	 * SPA 路由切换时触发白屏检测
	 * @description 供 HistoryInterceptor 的 onRouteChange 回调调用
	 */
	public onRouteChange = (_from: string, _to: string): void => {
		if (!this.isDetecting) return

		// 清理可能存在的上一个路由检测定时器
		if (this.routeChangeTimer) {
			clearTimeout(this.routeChangeTimer)
			this.routeChangeTimer = null
		}

		this.currentTrigger = "route_change"
		this.checkCount = 0
		// 重置上报标志，允许新路由的白屏检测上报
		this.reportedBlank = false

		// 路由切换后延迟检测（等待新页面渲染）
		this.routeChangeTimer = setTimeout(() => {
			this.routeChangeTimer = null
			this.executeCheck()
			this.scheduleNextCheck()
		}, 200)
	}

	/**
	 * 开始检测流程
	 * @description 执行多次检测，从快速到慢速
	 */
	private startDetection(): void {
		// 执行快速检测
		this.executeCheck()

		// 安排后续检测
		this.scheduleNextCheck()
	}

	/**
	 * 执行白屏检测
	 * @description 检查页面是否有可见内容，使用空闲回调优化性能
	 */
	private executeCheck(): void {
		this.checkCount++

		// 使用空闲回调执行计算密集型任务
		const performCheck = () => {
			// 计算可见内容比例
			const coverage = this.calculateCoverage()

			// 获取检测点数据
			const points = this.getCheckPoints()
			const blankPoints = points.filter((p) => p.isBlank)

			// 判断是否为白屏
			const isBlankScreen = this.isBlankScreen(points, blankPoints, coverage)

			if (isBlankScreen) {
				// 标记白屏状态，用于恢复检测
				if (!this.isCurrentlyBlank) {
					this.isCurrentlyBlank = true
					this.lastBlankTime = performance.now()
				}

				// 防止重复上报：在 maxChecks 周期内只上报一次
				if (this.reportedBlank) {
					return
				}
				this.reportedBlank = true

				// 分析白屏原因（轻量级操作，同步执行）
				const reason = this.analyzeBlankReason()

				// 获取可见元素（限制数量，减少开销）
				const elements = this.getVisibleElements()

				const blankEvent: BlankScreenEvent = {
					type: EventType.BLANK_SCREEN,
					timestamp: Date.now(),
					data: {
						url: location.href,
						pathname: location.pathname,
						checkPoints: points,
						elements: elements,
						coverage: coverage,
						checkCount: this.checkCount,
						timeSinceLoad: Math.round(performance.now() - this.pageLoadTime),
						reason,
						trigger: this.currentTrigger,
					},
				}

				this.eventQueue.push(blankEvent)
				logger.warn("检测到白屏:", blankEvent)
			} else if (this.isCurrentlyBlank) {
				// 之前是白屏，现在恢复了 → 上报恢复事件
				const recoveryTime = Math.round(performance.now() - this.lastBlankTime)
				this.isCurrentlyBlank = false
				// 重置上报标志，允许下一次白屏检测上报
				this.reportedBlank = false

				const recoveryEvent: BlankScreenEvent = {
					type: EventType.BLANK_SCREEN,
					timestamp: Date.now(),
					data: {
						url: location.href,
						pathname: location.pathname,
						checkPoints: points,
						elements: this.getVisibleElements(),
						coverage: coverage,
						checkCount: this.checkCount,
						timeSinceLoad: Math.round(performance.now() - this.pageLoadTime),
						recovered: true,
						recoveryTime,
						trigger: this.currentTrigger,
					},
				}

				this.eventQueue.push(recoveryEvent)
				logger.info("白屏已恢复，恢复耗时:", recoveryTime, "ms")
			}
		}

		// 优先使用 requestIdleCallback，降级使用 setTimeout
		if (typeof requestIdleCallback !== "undefined") {
			requestIdleCallback(performCheck, { timeout: 100 })
		} else {
			setTimeout(performCheck, 0)
		}
	}

	/**
	 * 分析白屏可能原因
	 * @returns 白屏原因描述
	 */
	private analyzeBlankReason(): string {
		const reasons: string[] = []

		// 检查是否有 JS 错误（通过检查 body 是否有内容）
		const bodyChildren = document.body?.children
		if (!bodyChildren || bodyChildren.length === 0) {
			reasons.push("页面 body 无子元素")
		}

		// 检查常见 SPA 挂载点是否为空
		const appRoot = document.getElementById("app") || document.getElementById("root") || document.querySelector("[data-app]")
		if (appRoot && appRoot.innerHTML.trim() === "") {
			reasons.push("SPA 挂载点为空（可能 JS 未执行或执行出错）")
		}

		// 检查是否有未加载的关键脚本
		const scripts = document.querySelectorAll("script[src]")
		let failedScripts = 0
		scripts.forEach((script) => {
			const scriptEl = script as HTMLScriptElement
			// 检查脚本是否有 error 属性（加载失败的标记）
			if (scriptEl.getAttribute("data-error") === "true") {
				failedScripts++
			}
		})
		if (failedScripts > 0) {
			reasons.push(`${failedScripts} 个脚本加载失败`)
		}

		// 检查是否有未加载的关键样式
		const links = document.querySelectorAll("link[rel='stylesheet']")
		let failedStyles = 0
		links.forEach((link) => {
			const linkEl = link as HTMLLinkElement
			if (linkEl.getAttribute("data-error") === "true") {
				failedStyles++
			}
		})
		if (failedStyles > 0) {
			reasons.push(`${failedStyles} 个样式表加载失败`)
		}

		// 检查页面是否有 loading 状态的元素
		const loadingEl = document.querySelector(".loading, .spinner, [data-loading], .skeleton")
		if (loadingEl) {
			reasons.push("页面可能仍在加载中（检测到 loading 元素）")
		}

		// 检查网络状态
		if (!navigator.onLine) {
			reasons.push("网络离线")
		}

		return reasons.length > 0 ? reasons.join("；") : "未知原因"
	}

	/**
	 * 计算页面可见内容覆盖率
	 * @returns 覆盖率 (0-1)
	 * @description 使用20个采样点，平衡精度和性能
	 */
	private calculateCoverage(): number {
		const viewportArea = window.innerWidth * window.innerHeight
		if (viewportArea === 0) return 0

		if (typeof document.elementFromPoint !== "function") {
			return 0
		}

		const samplePoints = this.getSamplePoints(20)
		let coveredPoints = 0

		for (const point of samplePoints) {
			const element = document.elementFromPoint(point.x, point.y)
			if (element && !this.isBlankElement(element)) {
				coveredPoints++
			}
		}

		return coveredPoints / samplePoints.length
	}

	/**
	 * 生成采样检测点
	 * @param count - 采样点数量
	 * @returns 检测点数组
	 */
	private getSamplePoints(count: number): Array<{ x: number; y: number }> {
		const points: Array<{ x: number; y: number }> = []
		const stepX = window.innerWidth / Math.ceil(Math.sqrt(count * (window.innerWidth / window.innerHeight)))
		const stepY = window.innerHeight / Math.ceil(Math.sqrt(count * (window.innerHeight / window.innerWidth)))

		for (let y = stepY / 2; y < window.innerHeight; y += stepY) {
			for (let x = stepX / 2; x < window.innerWidth; x += stepX) {
				if (points.length < count) {
					points.push({ x: Math.round(x), y: Math.round(y) })
				}
			}
		}

		return points
	}

	/**
	 * 获取标准检测点
	 * @returns 检测点数组
	 */
	private getCheckPoints(): Array<{
		x: number
		y: number
		isBlank: boolean
		element: string
	}> {
		const basePoints = [
			{ xRatio: 0.5, yRatio: 0.5 },
			{ xRatio: 0.1, yRatio: 0.1 },
			{ xRatio: 0.9, yRatio: 0.1 },
			{ xRatio: 0.1, yRatio: 0.9 },
			{ xRatio: 0.9, yRatio: 0.9 },
		]

		const edgePoints = [
			{ xRatio: 0.5, yRatio: 0.1 },
			{ xRatio: 0.5, yRatio: 0.9 },
			{ xRatio: 0.1, yRatio: 0.5 },
			{ xRatio: 0.9, yRatio: 0.5 },
		]

		const quarterPoints = [
			{ xRatio: 0.25, yRatio: 0.25 },
			{ xRatio: 0.75, yRatio: 0.25 },
			{ xRatio: 0.25, yRatio: 0.75 },
			{ xRatio: 0.75, yRatio: 0.75 },
		]

		const allPoints = [...basePoints, ...edgePoints, ...quarterPoints]

		const hasElementFromPoint = typeof document.elementFromPoint === "function"

		return allPoints.map((point) => {
			const x = window.innerWidth * point.xRatio
			const y = window.innerHeight * point.yRatio
			const element = hasElementFromPoint ? document.elementFromPoint(x, y) : null

			return {
				x: Math.round(x),
				y: Math.round(y),
				isBlank: !element || this.isBlankElement(element),
				element: element?.tagName || "null",
			}
		})
	}

	/**
	 * 判断是否为白屏
	 * @param points - 检测点数组
	 * @param blankPoints - 空白检测点数组
	 * @param coverage - 可见内容覆盖率
	 * @returns 是否为白屏
	 */
	private isBlankScreen(
		points: Array<{ isBlank: boolean }>,
		blankPoints: Array<{ isBlank: boolean }>,
		coverage: number,
	): boolean {
		// 如果所有检测点都是空白，则判定为白屏
		if (blankPoints.length === points.length) {
			return true
		}

		// 如果覆盖率低于 5%，判定为严重白屏
		if (coverage < 0.05) {
			return true
		}

		// 如果空白点超过 90%，判定为白屏
		if (blankPoints.length / points.length > 0.9) {
			return true
		}

		return false
	}

	/**
	 * 安排下次检测
	 * @description 使用延时队列进行多次检测
	 */
	private scheduleNextCheck(): void {
		if (this.checkCount >= this.maxChecks) {
			// 启动持续监控
			this.startContinuousMonitoring()
			return
		}

		const delay = this.checkDelays[this.checkCount] || 3000

		setTimeout(() => {
			if (this.isDetecting) {
				this.executeCheck()
				this.scheduleNextCheck()
			}
		}, delay)
	}

	/**
	 * 启动持续监控
	 * @description 使用 MutationObserver 监听 DOM 变化
	 */
	private startContinuousMonitoring(): void {
		if (!window.MutationObserver) return

		try {
			this.observer = new MutationObserver(() => {
				if (this.debounceTimer) {
					clearTimeout(this.debounceTimer)
				}

				this.debounceTimer = setTimeout(() => {
					this.executeCheck()
				}, 500)
			})

			// 监听 body 的子节点变化
			if (document.body) {
				this.observer.observe(document.body, {
					childList: true,
					subtree: true,
				})
			}

			logger.info("白屏持续监控已启动")
		} catch (e) {
			logger.warn("持续监控启动失败:", e)
		}
	}

	/**
	 * 停止白屏检测
	 * @description 清理所有检测任务和监听器
	 */
	public stop(): void {
		this.isDetecting = false
		this.checkCount = 0
		this.isCurrentlyBlank = false
		this.reportedBlank = false

		// 移除 DOMContentLoaded 监听器（如果尚未触发）
		document.removeEventListener("DOMContentLoaded", this.handleDOMReady)

		// 清理防抖定时器
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer)
			this.debounceTimer = null
		}

		// 清理路由切换定时器
		if (this.routeChangeTimer) {
			clearTimeout(this.routeChangeTimer)
			this.routeChangeTimer = null
		}

		// 清理样式缓存定时器
		if (this.styleCacheTimer) {
			clearTimeout(this.styleCacheTimer)
			this.styleCacheTimer = null
		}

		// 清理样式缓存
		this.elementStyleCache.clear()

		// 停止 MutationObserver
		if (this.observer) {
			this.observer.disconnect()
			this.observer = null
		}

		logger.info("白屏检测已停止")
	}

	/**
	 * 手动触发一次检测
	 * @returns 检测结果
	 */
	public checkNow(): boolean {
		if (!this.isDetecting) {
			logger.warn("白屏检测未启动")
			return false
		}

		const points = this.getCheckPoints()
		const blankPoints = points.filter((p) => p.isBlank)
		const coverage = this.calculateCoverage()
		const isBlank = this.isBlankScreen(points, blankPoints, coverage)

		if (isBlank) {
			const blankEvent: BlankScreenEvent = {
				type: EventType.BLANK_SCREEN,
				timestamp: Date.now(),
				data: {
					url: location.href,
					pathname: location.pathname,
					checkPoints: points,
					elements: this.getVisibleElements(),
					coverage: coverage,
					checkCount: this.checkCount + 1,
					manualTrigger: true,
					timeSinceLoad: Math.round(performance.now() - this.pageLoadTime),
					reason: this.analyzeBlankReason(),
				},
			}

			this.eventQueue.push(blankEvent)
			logger.warn("手动检测到白屏:", blankEvent)
		}

		return isBlank
	}

	/** 元素样式缓存，减少 getComputedStyle 调用 */
	private elementStyleCache = new Map<Element, CSSStyleDeclaration>()
	/** 缓存清理定时器 */
	private styleCacheTimer: ReturnType<typeof setTimeout> | null = null

	/**
	 * 判断元素是否为空白元素
	 * @param element - DOM 元素
	 * @returns 是否为空白
	 */
	private isBlankElement(element: Element): boolean {
		// 检查是否是 body 或 html 元素
		if (element.tagName === "BODY" || element.tagName === "HTML") {
			return true
		}

		// 跳过脚本和样式标签
		if (element.tagName === "SCRIPT" || element.tagName === "STYLE" || element.tagName === "LINK") {
			return true
		}

		// 从缓存获取样式，减少性能开销
		let style: CSSStyleDeclaration | undefined = this.elementStyleCache.get(element)
		if (!style) {
			try {
				style = window.getComputedStyle(element as HTMLElement)
				this.elementStyleCache.set(element, style)

				// 延迟清理缓存，防止内存泄漏
				if (this.styleCacheTimer) {
					clearTimeout(this.styleCacheTimer)
				}
				this.styleCacheTimer = setTimeout(() => {
					this.elementStyleCache.clear()
					this.styleCacheTimer = null
				}, 1000)
			} catch {
				return true
			}
		}

		if (!style) return true

		// 检查是否隐藏
		if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
			return true
		}

		// 检查尺寸
		const rect = element.getBoundingClientRect()
		if (rect.width === 0 || rect.height === 0) {
			return true
		}

		// 检查是否有实际内容（通过 innerText）
		const text = element.textContent?.trim()
		if (!text && element.children.length === 0) {
			return true
		}

		return false
	}

	/**
	 * 获取页面上可见的元素列表
	 * @returns 可见元素信息数组
	 */
	private getVisibleElements(): Array<{
		tag: string
		id?: string
		class?: string
		textPreview?: string
	}> {
		const elements: Array<{
			tag: string
			id?: string
			class?: string
			textPreview?: string
		}> = []

		// 从主要容器开始收集
		const containers = [
			document.body,
			document.body?.querySelector("main"),
			document.body?.querySelector("#app"),
			document.body?.querySelector("#root"),
			document.body?.querySelector(".container"),
		].filter(Boolean)

		const visited = new Set<Element>()

		const collectElements = (container: Element) => {
			const allElements = container.querySelectorAll("*")

			for (const el of Array.from(allElements)) {
				if (visited.has(el)) continue
				visited.add(el)

				if (this.isBlankElement(el)) continue

				const rect = el.getBoundingClientRect()

				// 只收集在视口内的元素
				if (rect.right < 0 || rect.left > window.innerWidth || rect.bottom < 0 || rect.top > window.innerHeight) {
					continue
				}

				const textContent = el.textContent?.trim()
				const textPreview = textContent && textContent.length > 0 ? textContent.substring(0, 50) : undefined

				elements.push({
					tag: el.tagName.toLowerCase(),
					id: el.id || undefined,
					class: (el as HTMLElement).className || undefined,
					textPreview,
				})

				// 限制数量
				if (elements.length >= 30) return
			}
		}

		for (const container of containers) {
			if (elements.length >= 30) break
			collectElements(container!)
		}

		return elements
	}
}

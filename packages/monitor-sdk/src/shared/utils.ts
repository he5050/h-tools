/**
 * @fileoverview 工具函数模块
 * @description 提供 SDK 使用的通用工具函数
 */

import type { DeviceInfo, NetworkFilterRule, NetworkConfig } from "./types"
import { BROWSER_REGEX, OS_REGEX } from "./constants"

/**
 * 生成唯一 ID
 * @returns 唯一标识字符串
 */
export function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/**
 * 节流函数
 * @description 限制函数执行频率
 * @param fn - 要节流的函数
 * @param wait - 等待时间（毫秒）
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
	fn: T,
	wait: number,
): (...args: Parameters<T>) => void {
	let lastTime = 0
	let timeoutId: ReturnType<typeof setTimeout> | null = null

	return function (this: unknown, ...args: Parameters<T>): void {
		const now = Date.now()
		const remaining = wait - (now - lastTime)

		if (remaining <= 0) {
			if (timeoutId) {
				clearTimeout(timeoutId)
				timeoutId = null
			}
			lastTime = now
			fn.apply(this, args)
		} else if (!timeoutId) {
			timeoutId = setTimeout(() => {
				lastTime = Date.now()
				timeoutId = null
				fn.apply(this, args)
			}, remaining)
		}
	}
}

/**
 * 防抖函数
 * @description 延迟执行函数，直到停止调用后的一段时间
 * @param fn - 要防抖的函数
 * @param wait - 等待时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
	fn: T,
	wait: number,
): (...args: Parameters<T>) => void {
	let timeoutId: ReturnType<typeof setTimeout> | null = null

	return function (this: unknown, ...args: Parameters<T>): void {
		if (timeoutId) {
			clearTimeout(timeoutId)
		}

		timeoutId = setTimeout(() => {
			timeoutId = null
			fn.apply(this, args)
		}, wait)
	}
}

/**
 * 深度合并对象
 * @param target - 目标对象
 * @param source - 源对象
 * @returns 合并后的对象
 */
export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
	const result = { ...target }

	for (const key in source) {
		if (source.hasOwnProperty(key)) {
			const sourceValue = source[key]
			const targetValue = result[key]

			if (
				typeof sourceValue === "object" &&
				sourceValue !== null &&
				!Array.isArray(sourceValue) &&
				typeof targetValue === "object" &&
				targetValue !== null &&
				!Array.isArray(targetValue)
			) {
				result[key] = deepMerge(
					targetValue as Record<string, unknown>,
					sourceValue as Record<string, unknown>,
				) as T[Extract<keyof T, string>]
			} else {
				result[key] = sourceValue as T[Extract<keyof T, string>]
			}
		}
	}

	return result
}

/**
 * 安全地获取嵌套对象属性
 * @param obj - 对象
 * @param path - 属性路径
 * @param defaultValue - 默认值
 * @returns 属性值或默认值
 */
export function getNestedValue<T>(obj: Record<string, unknown>, path: string, defaultValue?: T): T | undefined {
	const keys = path.split(".")
	let result: unknown = obj

	for (const key of keys) {
		if (result === null || result === undefined) {
			return defaultValue
		}
		result = (result as Record<string, unknown>)[key]
	}

	return (result as T) ?? defaultValue
}

/**
 * 格式化日期
 * @param date - 日期对象或时间戳
 * @param format - 格式字符串
 * @returns 格式化后的日期字符串
 */
export function formatDate(date: Date | number, format = "YYYY-MM-DD HH:mm:ss"): string {
	const d = typeof date === "number" ? new Date(date) : date

	const year = d.getFullYear()
	const month = String(d.getMonth() + 1).padStart(2, "0")
	const day = String(d.getDate()).padStart(2, "0")
	const hours = String(d.getHours()).padStart(2, "0")
	const minutes = String(d.getMinutes()).padStart(2, "0")
	const seconds = String(d.getSeconds()).padStart(2, "0")
	const milliseconds = String(d.getMilliseconds()).padStart(3, "0")

	return format
		.replace("YYYY", String(year))
		.replace("MM", month)
		.replace("DD", day)
		.replace("HH", hours)
		.replace("mm", minutes)
		.replace("ss", seconds)
		.replace("SSS", milliseconds)
}

/**
 * 获取设备信息
 * @returns 设备信息对象
 */
export function getDeviceInfo(): DeviceInfo {
	const ua = navigator.userAgent

	// 检测浏览器
	let browser = "Unknown"
	let browserVersion = "Unknown"

	if (BROWSER_REGEX.CHROME.test(ua)) {
		browser = "Chrome"
		browserVersion = ua.match(BROWSER_REGEX.CHROME)?.[1] || "Unknown"
	} else if (BROWSER_REGEX.FIREFOX.test(ua)) {
		browser = "Firefox"
		browserVersion = ua.match(BROWSER_REGEX.FIREFOX)?.[1] || "Unknown"
	} else if (BROWSER_REGEX.EDGE.test(ua)) {
		browser = "Edge"
		browserVersion = ua.match(BROWSER_REGEX.EDGE)?.[1] || "Unknown"
	} else if (BROWSER_REGEX.SAFARI.test(ua)) {
		browser = "Safari"
		browserVersion = ua.match(BROWSER_REGEX.SAFARI)?.[1] || "Unknown"
	} else if (BROWSER_REGEX.IE.test(ua)) {
		browser = "IE"
		const match = ua.match(BROWSER_REGEX.IE)
		browserVersion = match?.[1] || match?.[2] || "Unknown"
	}

	// 检测操作系统
	let os = "Unknown"
	let osVersion = "Unknown"

	if (OS_REGEX.WINDOWS.test(ua)) {
		os = "Windows"
		osVersion = ua.match(OS_REGEX.WINDOWS)?.[1] || "Unknown"
	} else if (OS_REGEX.MAC.test(ua)) {
		os = "macOS"
		osVersion = (ua.match(OS_REGEX.MAC)?.[1] || "Unknown").replace(/_/g, ".")
	} else if (OS_REGEX.IOS.test(ua)) {
		os = "iOS"
		const match = ua.match(OS_REGEX.IOS)
		osVersion = match ? `${match[1]}.${match[2]}` : "Unknown"
	} else if (OS_REGEX.ANDROID.test(ua)) {
		os = "Android"
		osVersion = ua.match(OS_REGEX.ANDROID)?.[1] || "Unknown"
	} else if (OS_REGEX.LINUX.test(ua)) {
		os = "Linux"
	}

	// 检测设备类型
	let deviceType: "desktop" | "tablet" | "mobile" = "desktop"
	if (/iPad|Tablet|PlayBook/.test(ua)) {
		deviceType = "tablet"
	} else if (/Mobile|iPhone|Android/.test(ua)) {
		deviceType = "mobile"
	}

	return {
		browser,
		browserVersion,
		os,
		osVersion,
		deviceType,
		screenWidth: screen.width,
		screenHeight: screen.height,
		devicePixelRatio: window.devicePixelRatio || 1,
	}
}

/**
 * 检查浏览器是否支持特定功能
 * @param feature - 功能名称
 * @returns 是否支持
 */
export function isFeatureSupported(feature: string): boolean {
	switch (feature) {
		case "indexedDB":
			return "indexedDB" in window
		case "webWorker":
			return "Worker" in window
		case "performanceObserver":
			return "PerformanceObserver" in window
		case "mutationObserver":
			return "MutationObserver" in window
		case "fetch":
			return "fetch" in window
		case "beacon":
			return "sendBeacon" in navigator
		case "compression":
			return "CompressionStream" in window
		default:
			return false
	}
}

/**
 * 安全地执行函数
 * @param fn - 要执行的函数
 * @param defaultValue - 出错时的默认值
 * @returns 函数返回值或默认值
 */
export function safeExec<T>(fn: () => T, defaultValue: T): T {
	try {
		return fn()
	} catch {
		return defaultValue
	}
}

/**
 * 计算字符串哈希值
 * @param str - 输入字符串
 * @returns 哈希值
 */
export function hashString(str: string): number {
	let hash = 0
	if (str.length === 0) return hash

	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash = hash & hash // 转换为 32 位整数
	}

	return Math.abs(hash)
}

/**
 * 脱敏处理
 * @param str - 原始字符串
 * @param start - 保留开头字符数
 * @param end - 保留结尾字符数
 * @returns 脱敏后的字符串
 */
export function maskString(str: string, start = 3, end = 4): string {
	if (str.length <= start + end) {
		return "*".repeat(str.length)
	}

	const prefix = str.slice(0, start)
	const suffix = str.slice(-end)
	const middleLength = str.length - start - end

	return `${prefix}${"*".repeat(middleLength)}${suffix}`
}

/**
 * 截断字符串
 * @param str - 原始字符串
 * @param maxLength - 最大长度
 * @param suffix - 后缀
 * @returns 截断后的字符串
 */
export function truncateString(str: string, maxLength: number, suffix = "..."): string {
	if (str.length <= maxLength) {
		return str
	}

	return str.slice(0, maxLength - suffix.length) + suffix
}

/**
 * 解析 URL 参数
 * @param url - URL 字符串
 * @returns 参数对象
 */
export function parseUrlParams(url: string): Record<string, string> {
	const params: Record<string, string> = {}
	const searchParams = new URL(url).searchParams

	searchParams.forEach((value, key) => {
		params[key] = value
	})

	return params
}

/**
 * 构建 URL
 * @param base - 基础 URL
 * @param params - 参数对象
 * @returns 完整的 URL
 */
export function buildUrl(base: string, params: Record<string, string | number | boolean>): string {
	const url = new URL(base)

	Object.entries(params).forEach(([key, value]) => {
		url.searchParams.set(key, String(value))
	})

	return url.toString()
}

/**
 * 清理 URL
 * @param url - 原始 URL
 * @returns 清理后的 URL（移除敏感参数）
 */
export function sanitizeUrl(url: string): string {
	try {
		const urlObj = new URL(url)

		// 移除敏感参数
		const sensitiveParams = ["token", "password", "secret", "api_key", "apikey"]
		sensitiveParams.forEach((param) => {
			if (urlObj.searchParams.has(param)) {
				urlObj.searchParams.set(param, "***")
			}
		})

		return urlObj.toString()
	} catch {
		return url
	}
}

/**
 * 检查是否在浏览器环境
 * @returns 是否在浏览器环境
 */
export function isBrowser(): boolean {
	return typeof window !== "undefined" && typeof document !== "undefined"
}

/**
 * 检查是否支持 localStorage
 * @returns 是否支持 localStorage
 */
export function isLocalStorageSupported(): boolean {
	try {
		const test = "__monitor_test__"
		localStorage.setItem(test, test)
		localStorage.removeItem(test)
		return true
	} catch {
		return false
	}
}

/**
 * 检查是否支持 sessionStorage
 * @returns 是否支持 sessionStorage
 */
export function isSessionStorageSupported(): boolean {
	try {
		const test = "__monitor_test__"
		sessionStorage.setItem(test, test)
		sessionStorage.removeItem(test)
		return true
	} catch {
		return false
	}
}

/**
 * 检查是否支持 Cookie
 * @returns 是否支持 Cookie
 */
export function isCookieSupported(): boolean {
	try {
		return typeof document !== "undefined" && "cookie" in document
	} catch {
		return false
	}
}

/**
 * 安全地获取 localStorage 值
 * @param key - 键名
 * @param defaultValue - 默认值
 * @returns 存储的值或默认值
 */
export function safeGetLocalStorage<T>(key: string, defaultValue: T): T {
	if (!isLocalStorageSupported()) {
		return defaultValue
	}

	try {
		const value = localStorage.getItem(key)
		if (value === null) {
			return defaultValue
		}
		return JSON.parse(value) as T
	} catch {
		return defaultValue
	}
}

/**
 * 安全地设置 localStorage 值
 * @param key - 键名
 * @param value - 值
 * @returns 是否设置成功
 */
export function safeSetLocalStorage(key: string, value: unknown): boolean {
	if (!isLocalStorageSupported()) {
		return false
	}

	try {
		localStorage.setItem(key, JSON.stringify(value))
		return true
	} catch {
		return false
	}
}

/**
 * 安全地移除 localStorage 值
 * @param key - 键名
 * @returns 是否移除成功
 */
export function safeRemoveLocalStorage(key: string): boolean {
	if (!isLocalStorageSupported()) {
		return false
	}

	try {
		localStorage.removeItem(key)
		return true
	} catch {
		return false
	}
}

/**
 * 检查是否运行在 HTTPS 环境
 * @returns 是否 HTTPS
 */
export function isHttps(): boolean {
	return typeof window !== "undefined" && window.location.protocol === "https:"
}

/**
 * 检查是否支持 Service Worker
 * @returns 是否支持 Service Worker
 */
export function isServiceWorkerSupported(): boolean {
	return "serviceWorker" in navigator
}

/**
 * 检查是否支持 Notification API
 * @returns 是否支持 Notification
 */
export function isNotificationSupported(): boolean {
	return "Notification" in window
}

/**
 * 检查是否支持 Geolocation API
 * @returns 是否支持 Geolocation
 */
export function isGeolocationSupported(): boolean {
	return "geolocation" in navigator
}

/**
 * 检查是否支持 WebSocket
 * @returns 是否支持 WebSocket
 */
export function isWebSocketSupported(): boolean {
	return "WebSocket" in window
}

/**
 * 检查是否支持 Canvas
 * @returns 是否支持 Canvas
 */
export function isCanvasSupported(): boolean {
	return !!document.createElement("canvas").getContext
}

/**
 * 检查是否支持 WebGL
 * @returns 是否支持 WebGL
 */
export function isWebGLSupported(): boolean {
	try {
		const canvas = document.createElement("canvas")
		return !!(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")))
	} catch {
		return false
	}
}

/**
 * 检查是否支持 Touch 事件
 * @returns 是否支持 Touch
 */
export function isTouchSupported(): boolean {
	return "ontouchstart" in window || navigator.maxTouchPoints > 0
}

/**
 * 检查是否支持 Passive 事件监听器
 * @returns 是否支持 Passive 事件
 */
export function isPassiveEventSupported(): boolean {
	let supported = false
	try {
		const opts = Object.defineProperty({}, "passive", {
			get() {
				supported = true
				return true
			},
		})
		window.addEventListener("test", () => {}, opts)
		window.removeEventListener("test", () => {}, opts as EventListenerOptions)
	} catch {
		supported = false
	}
	return supported
}

/**
 * 获取环境信息
 * @returns 环境信息对象
 */
export function getEnvironmentInfo(): {
	isBrowser: boolean
	isNode: boolean
	isLocalStorageSupported: boolean
	isSessionStorageSupported: boolean
	isCookieSupported: boolean
	isHttps: boolean
	isServiceWorkerSupported: boolean
	isNotificationSupported: boolean
	isGeolocationSupported: boolean
	isWebSocketSupported: boolean
	isCanvasSupported: boolean
	isWebGLSupported: boolean
	isTouchSupported: boolean
	isPassiveEventSupported: boolean
} {
	return {
		isBrowser: isBrowser(),
		isNode: !isBrowser(),
		isLocalStorageSupported: isLocalStorageSupported(),
		isSessionStorageSupported: isSessionStorageSupported(),
		isCookieSupported: isCookieSupported(),
		isHttps: isHttps(),
		isServiceWorkerSupported: isServiceWorkerSupported(),
		isNotificationSupported: isNotificationSupported(),
		isGeolocationSupported: isGeolocationSupported(),
		isWebSocketSupported: isWebSocketSupported(),
		isCanvasSupported: isCanvasSupported(),
		isWebGLSupported: isWebGLSupported(),
		isTouchSupported: isTouchSupported(),
		isPassiveEventSupported: isPassiveEventSupported(),
	}
}

// ==================== 网络过滤工具函数 ====================

/**
 * 检查 URL 是否匹配单条过滤规则
 * @param url - 请求 URL
 * @param rule - 过滤规则（字符串 includes / 正则 test / 自定义函数）
 * @returns 是否匹配
 */
export function matchNetworkRule(url: string, rule: NetworkFilterRule): boolean {
	if (typeof rule === "string") {
		return url.includes(rule)
	}
	if (rule instanceof RegExp) {
		return rule.test(url)
	}
	if (typeof rule === "function") {
		try {
			return rule(url)
		} catch {
			return false
		}
	}
	return false
}

/**
 * 判断请求 URL 是否应该被记录（通过白名单/黑名单过滤）
 * @description 过滤逻辑：
 *   1. 未传 networkConfig → 记录所有请求
 *   2. 传了 networkConfig → 黑名单命中则排除；必须显式配置白名单且命中才记录
 * @param url - 请求 URL
 * @param config - 网络监控配置
 * @returns true 表示应该记录，false 表示应该跳过
 */
export function shouldRecordRequest(url: string, config?: NetworkConfig): boolean {
	// 未传 networkConfig，记录所有请求
	if (!config) return true

	// 黑名单优先：命中则排除
	if (config.blacklist && config.blacklist.length > 0) {
		for (const rule of config.blacklist) {
			if (matchNetworkRule(url, rule)) {
				return false
			}
		}
	}

	// 白名单：必须显式配置且命中才记录
	if (config.whitelist && config.whitelist.length > 0) {
		for (const rule of config.whitelist) {
			if (matchNetworkRule(url, rule)) {
				return true
			}
		}
	}

	// 未配置白名单或白名单未命中 → 不记录
	return false
}

/**
 * 提取 URL 中的查询参数
 * @param url - 请求 URL
 * @returns 查询参数键值对，解析失败返回 undefined
 */
export function extractQueryParams(url: string): Record<string, string> | undefined {
	try {
		const urlObj = new URL(url, location.origin)
		if (urlObj.search.length <= 1) return undefined

		const params: Record<string, string> = {}
		urlObj.searchParams.forEach((value, key) => {
			params[key] = value
		})
		return Object.keys(params).length > 0 ? params : undefined
	} catch {
		return undefined
	}
}

/**
 * 安全序列化请求体
 * @description 将各种类型的请求体转为字符串，超出 maxSize 截断
 * @param body - 请求体（string / FormData / URLSearchParams / Blob / ArrayBuffer 等）
 * @param maxSize - 最大记录长度（字节），默认 2048
 * @returns 序列化后的字符串，无法序列化返回 undefined
 */
export function serializeRequestBody(
	body: unknown,
	maxSize = 2048,
): string | undefined {
	if (body === null || body === undefined) return undefined

	try {
		let result: string

		if (typeof body === "string") {
			result = body
		} else if (body instanceof URLSearchParams) {
			result = body.toString()
		} else if (body instanceof FormData) {
			// FormData 转为可读的键值对格式
			const entries: Record<string, string> = {}
			body.forEach((value, key) => {
				entries[key] = value instanceof File ? `[File: ${value.name}]` : String(value)
			})
			result = JSON.stringify(entries)
		} else if (body instanceof ArrayBuffer || body instanceof Uint8Array) {
			result = `[Binary: ${body.byteLength} bytes]`
		} else if (body instanceof Blob) {
			result = `[Blob: ${body.size} bytes, type=${body.type}]`
		} else if (typeof body === "object") {
			result = JSON.stringify(body)
		} else {
			result = String(body)
		}

		// 超出长度截断
		if (result.length > maxSize) {
			return result.slice(0, maxSize) + "...[truncated]"
		}
		return result
	} catch {
		return undefined
	}
}

/**
 * 提取请求头信息
 * @param headers - Headers 对象或普通对象
 * @param excludeHeaders - 需要排除的请求头字段列表
 * @returns 请求头键值对，为空返回 undefined
 */
export function extractRequestHeaders(
	headers?: HeadersInit | null,
	excludeHeaders: string[] = [],
): Record<string, string> | undefined {
	if (!headers) return undefined

	try {
		const result: Record<string, string> = {}
		const excludeSet = new Set(excludeHeaders.map((h) => h.toLowerCase()))

		if (headers instanceof Headers) {
			headers.forEach((value, key) => {
				if (!excludeSet.has(key.toLowerCase())) {
					result[key] = value
				}
			})
		} else if (Array.isArray(headers)) {
			for (const [key, value] of headers) {
				if (!excludeSet.has(key.toLowerCase())) {
					result[key] = value
				}
			}
		} else if (typeof headers === "object") {
			for (const [key, value] of Object.entries(headers)) {
				if (!excludeSet.has(key.toLowerCase())) {
					result[key] = value
				}
			}
		}

		return Object.keys(result).length > 0 ? result : undefined
	} catch {
		return undefined
	}
}

/**
 * 安全序列化 history.state
 * @description 将 state 对象转为可记录的格式，处理不可序列化的情况
 * @param state - history.state 或 pushState/replaceState 传入的 state
 * @returns 序列化后的对象，无法序列化返回 null
 */
export function safeSerializeState(state: unknown): Record<string, unknown> | null {
	if (state === null || state === undefined) return null

	try {
		// 验证可序列化性（structuredClone 兼容的对象）
		const serialized = JSON.parse(JSON.stringify(state))
		if (typeof serialized === "object" && serialized !== null) {
			return serialized as Record<string, unknown>
		}
		return { value: serialized }
	} catch {
		return null
	}
}
